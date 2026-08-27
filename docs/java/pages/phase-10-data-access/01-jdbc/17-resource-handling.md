---
title: "Every JDBC object is a handle on something that is not garbage, and closing is not optional"
sidebar_label: "17 · Resource handling"
sidebar_position: 19
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the JDK 25 API for `java.sql.Connection`,
> `java.sql.Statement`, `java.sql.ResultSet` and `java.lang.AutoCloseable`
> ([docs.oracle.com/en/java/javase/25/docs/api/java.sql/](https://docs.oracle.com/en/java/javase/25/docs/api/java.sql/)),
> the Java Language Specification SE 25 §14.20.3 (`try`-with-resources), and the
> HikariCP 7.0.2 README for `leakDetectionThreshold`. JDK 25, JDBC 4.3,
> pgjdbc 42.7.13, PostgreSQL 18.

**A `Connection`, a `Statement` and a `ResultSet` are all handles on state that
lives outside the JVM heap — a backend process on the database server, a portal,
a socket. The garbage collector does not know any of that exists, so an object
you drop without closing does not free anything; it leaves the server-side half
allocated until something else notices. `Connection`, `Statement` and `ResultSet`
all extend `AutoCloseable` for exactly this reason, and `try`-with-resources is
not a style preference over a `finally` block — it is the only form that closes
in the right order, closes the resources it opened even when the close itself
throws, and preserves the exception you actually care about. The pre-Java-7
pattern loses that exception, and it lost it in production for a decade.**

## The three handles, and what each one is holding

| Object | What is really allocated | What leaking it costs |
|---|---|---|
| `Connection` | a backend process on the database server, a TCP socket, a session with its own state | one slot out of `max_connections`; from a pool, one of ten |
| `Statement` | driver-side buffers, and once prepared, a named statement in the backend | server memory per connection, plus the statement cache |
| `ResultSet` | a cursor/portal on the server when streaming, and a row buffer in your heap | a held-open transaction and unbounded heap |

The asymmetry matters: **leaking a `ResultSet` is usually survivable, leaking a
`Connection` takes the service down.** A pool of ten connections with a leak on a
path that runs once a minute is dead in ten minutes, and the stack trace you get
names the *next* caller — the one that asked for a connection and waited — never
the one that leaked.

## The shape

```java
public List<Order> findByCustomer(long customerId) throws SQLException {
    var sql = "SELECT id, total_cents, placed_at FROM orders WHERE customer_id = ?";
    try (Connection c = dataSource.getConnection();
         PreparedStatement ps = c.prepareStatement(sql)) {
        ps.setLong(1, customerId);
        try (ResultSet rs = ps.executeQuery()) {
            var out = new ArrayList<Order>();
            while (rs.next()) {
                out.add(new Order(rs.getLong("id"),
                                  rs.getLong("total_cents"),
                                  rs.getObject("placed_at", OffsetDateTime.class)));
            }
            return out;
        }
    }
}
```

Three things about that shape are deliberate.

**The resources are declared in one `try` where they can be**, because a later
resource's initializer may reference an earlier one — `c.prepareStatement(sql)`
uses `c`. The JLS defines a multi-resource `try` as nested single-resource
`try`s, so the semantics are identical to writing them nested by hand.

**The `ResultSet` gets its own inner `try`** because it is not created at
declaration time here: the parameters have to be bound between `prepareStatement`
and `executeQuery`. When there is nothing to bind you can put all three in one
header, and for a plain query that reads fine:

```java
try (Connection c = dataSource.getConnection();
     PreparedStatement ps = c.prepareStatement(sql);
     ResultSet rs = ps.executeQuery()) {          // legal: initializer may use ps
```

**Nothing is closed by hand.** No `finally`, no null checks, no `if (rs != null)`.

## Close order, and what cascades

Resources close **in the reverse of declaration order**, which is the order you
want: `ResultSet`, then `Statement`, then `Connection`. Closing outward-in would
close the connection while a cursor on it is still open.

Two cascades are documented, and both are traps if you lean on them:

- **`Statement.close()` closes its current `ResultSet`.** The javadoc: *"When a
  `Statement` object is closed, its current `ResultSet` object, if one exists, is
  also closed."* True — but only the **current** one, and it does not help you if
  the statement itself is the thing you leaked.
- **Closing a `Connection` releases what the driver holds for it.** In a *pool*
  this is not a close at all: the object you hold is a proxy, and `close()` means
  *return me*. Whether the pool then closes the statements you left open is the
  pool's business, not the specification's.

🔴 **Never rely on a cascade you did not write.** The cascade is real, but the
code that reads correctly to the next person — and behaves the same on a raw
connection, a pooled one and a mock — is the one that closes each resource it
opened.

## Why `finally` was worse than it looked

The pattern try-with-resources replaced:

```java
Connection c = null;
PreparedStatement ps = null;
try {
    c = dataSource.getConnection();
    ps = c.prepareStatement(sql);
    ps.executeUpdate();                 // ← throws: "duplicate key value violates unique constraint"
} finally {
    if (ps != null) ps.close();
    if (c != null) c.close();           // ← also throws: "connection reset"
}
```

The body throws the exception you need to see. Then `c.close()` throws too — and
a `finally` block that throws **discards the exception in flight**. The caller
gets "connection reset"; the duplicate key is gone, along with the stack trace
pointing at the insert. Debugging that means reading the code, because the
evidence was destroyed by the cleanup.

`try`-with-resources fixes it structurally. The JLS specifies that if the body
throws and a close also throws, **the body's exception propagates and the close
exception is attached to it as a suppressed exception**:

```java
try (var c = dataSource.getConnection(); var ps = c.prepareStatement(sql)) {
    ps.executeUpdate();
} catch (SQLException e) {
    log.error("insert failed: {}", e.getMessage(), e);
    for (Throwable s : e.getSuppressed()) {
        log.error("  ...and closing failed too: {}", s.getMessage(), s);
    }
    throw e;
}
```

⚠️ **Suppressed exceptions are printed by `printStackTrace` and by every logging
framework's stack renderer** (as `Suppressed:` lines) — so in practice you get
them for free and only need `getSuppressed()` when you are handling them
programmatically. What you must not do is catch around the close and swallow.

## `AutoCloseable`, not `Closeable`

A detail worth having straight, because it explains the checked exception you
have to handle. `Closeable` (from `java.io`) declares `close() throws
IOException`; `AutoCloseable` (from `java.lang`, added with try-with-resources)
declares `close() throws Exception`, which is what lets a `Connection.close()`
throw `SQLException`. `Closeable` extends `AutoCloseable`, not the other way
round.

The consequence in JDBC code: the resource block can throw `SQLException` from
the close, so the enclosing method must declare or handle it — which is correct,
because a failed close is a real event, not noise. What it must not become is a
`catch (Exception ignored) {}` around the block to make the compiler quiet.

## Gotchas

**⚠️ Declaring the `ResultSet` in the same header when it is not yet available**
**Symptom:** you cannot bind parameters, because binding has to happen between
`prepareStatement` and `executeQuery`.
**Cause:** resource initializers run in declaration order, at declaration time.
**Fix:** nest — outer `try` for connection and statement, inner `try` for the
`ResultSet`.

**⚠️ Assigning to a resource variable inside the block**
**Symptom:** `resource may not be assigned` at compile time, or a second
statement's `ResultSet` silently unclosed.
**Cause:** a resource variable is implicitly final, and reassigning it would
break the guarantee that the thing closed is the thing opened.
**Fix:** a new nested `try` per resource; never reuse one variable for two
cursors.

**⚠️ Catching `SQLException` around the whole block and returning `null`**
**Symptom:** an empty list where an error occurred; a silent failure that
surfaces as a business bug days later.
**Cause:** the `catch` is a habit, not a decision, and there is nothing useful to
do at this layer.
**Fix:** translate and rethrow — [exception translation](../../phase-5-exceptions/04-custom-exceptions-translation.md)
is the phase 5 discipline, and **[chunk 21 · `SQLException`](21-sqlexception.md)**
is the JDBC-specific version.

**⚠️ Assuming `close()` is cheap and always succeeds**
**Symptom:** an exception thrown from cleanup that hides the real one, or a hang
on close.
**Cause:** `close()` on a real connection talks to the server; on a broken
network it can block until the socket read times out.
**Fix:** `try`-with-resources for the suppression semantics, plus a
`socketTimeout` on the URL so a dead peer cannot block forever
([chunk 3](03-the-jdbc-url.md)).

**⚠️ Swallowing the close exception "because the work already succeeded"**
**Symptom:** a commit that appears to have worked and did not, or a connection
returned broken to the pool.
**Cause:** a `close()` that fails after a successful body can indicate the
network died between the last statement and the close — which says nothing
reassuring about the commit.
**Fix:** let it propagate; if the operation is idempotent-sensitive, the retry
decision belongs to the caller, not to a swallowed `catch`.

**⚠️ Using a lambda or method reference that outlives the block**
**Symptom:** `ResultSet is closed` from inside a `Stream` consumed by the caller.
**Cause:** a stream built over a cursor is lazy; the block closed before the
terminal operation ran.
**Fix:** either collect inside the block, or hand ownership over explicitly with
a stream that closes its resources — and then the caller must use it in a
`try`-with-resources of its own.

**⚠️ Wrapping in `try`-with-resources but keeping a `finally { c.close(); }`**
**Symptom:** a second close, usually harmless, occasionally an exception from a
driver that is stricter.
**Cause:** belt-and-braces added during a refactor.
**Fix:** delete the `finally` — `close()` on an already-closed object is
specified as a no-op, but the duplicate signals to every reader that ownership
is unclear.

## Interview questions

**★ Why is `try`-with-resources better than a `finally` block for JDBC?**
Three reasons, and only the first is about brevity. It closes in reverse
declaration order automatically, so the cursor closes before the connection. It
closes every resource it opened even if an earlier close throws, which the naive
`finally` chain does not — `ps.close()` throwing means `c.close()` never runs.
And it preserves the exception from the body: if the body throws and a close also
throws, the body's exception propagates and the close exception is attached as a
*suppressed* exception, whereas a throwing `finally` discards the in-flight
exception entirely. That last one is the reason the old pattern produced
unexplainable production incidents — the real error was destroyed by the cleanup
that was supposed to be invisible.

**★ In what order are resources closed, and why does the order matter here?**
Reverse of declaration order. It matters because JDBC resources are nested by
ownership: a `ResultSet` is a cursor on a `Statement`, which belongs to a
`Connection`. Closing outward-in would close the connection while a cursor over
it is still open, which is at best undefined and at worst an error from the
driver. Declaring them in the order you obtained them — connection, statement,
result set — gives you the correct teardown for free, which is exactly why the
JLS defines a multi-resource `try` as nested single-resource `try`s.

**★ What is a suppressed exception and how do you see one?**
It is the exception that lost. When the body of a `try`-with-resources throws and
a `close()` also throws, the language keeps the body's exception as the one that
propagates and attaches the close's exception to it via `addSuppressed`. You read
them with `getSuppressed()`, and in practice you rarely have to: `printStackTrace`
and every logging framework's stack renderer print them as `Suppressed:` lines
beneath the main trace. The reason to know the mechanism is diagnostic — when a
stack trace has a `Suppressed:` section, that is the language telling you the
cleanup failed too, which usually means the connection or the network died rather
than that your SQL was wrong.

**★ `AutoCloseable` or `Closeable` — which do JDBC types implement, and does it
matter?**
`AutoCloseable`. `Closeable` is the older `java.io` interface whose `close()`
throws `IOException`; `AutoCloseable` came with try-with-resources in Java 7 and
declares `close() throws Exception`, which is what allows `Connection.close()` to
throw `SQLException`. It matters in one practical way: the close is a checked
throw, so the method containing the block must handle or declare `SQLException`.
That is not an inconvenience to route around — a failed close is a real signal —
but it is why you see `catch (Exception ignored)` bolted onto JDBC code by people
who wanted the compiler to be quiet.

**★ If a `Statement` closes its `ResultSet` automatically, why close the
`ResultSet` yourself?**
Because the cascade is narrower than it sounds and you should not build on it.
The javadoc guarantees that closing a `Statement` closes its *current* result
set — one of them — and says nothing about a statement you failed to close in the
first place, which is the actual failure mode. Beyond that, code that closes what
it opens behaves identically against a raw connection, a pooled proxy and a test
double, and reads unambiguously to whoever changes it next. Relying on a cascade
is relying on the object above having been closed correctly, which is precisely
the thing in doubt.

---
← Prev: [16 · Mapping rows to objects](16-mapping-rows-to-objects.md) · Index: [JDBC](README.md) · Next → [18 · Ownership and leaks](18-ownership-and-leaks.md)
