---
title: "Three statement types, one of which you should almost never create"
sidebar_label: "11 · The three statement types"
sidebar_position: 11
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-20 against the JDK 25 API for `java.sql.Statement`,
> `java.sql.PreparedStatement` and `java.sql.CallableStatement`
> (docs.oracle.com/en/java/javase/25/docs/api/java.sql/), and the pgJDBC
> documentation *Calling Stored Functions and Procedures*
> (jdbc.postgresql.org/documentation/callproc/). JDK 25, JDBC 4.3,
> PostgreSQL 18, pgjdbc 42.7.13.

**JDBC gives you three statement interfaces in a strict inheritance chain —
`Statement`, then `PreparedStatement` extends it, then `CallableStatement` extends
that — and the inheritance is a lie in the way that matters. A
`PreparedStatement` is not a `Statement` with parameters bolted on; the two send
completely different protocol messages and have completely different security
properties. And because `PreparedStatement` inherits `Statement`'s methods, the
API lets you call `ps.executeQuery(String)` — passing SQL to an object that
already has SQL — which is a compile-clean way to throw away every guarantee
`PreparedStatement` exists to provide. Knowing which type to reach for takes ten
seconds; knowing which inherited methods are traps takes longer and is the reason
for this chunk.**

## The three, and what each is for

| Type | Created by | SQL | Parameters | Use it for |
|---|---|---|---|---|
| `Statement` | `createStatement()` | passed to `execute*` | ❌ none | DDL, session `SET`, statements with no variable part |
| `PreparedStatement` | `prepareStatement(sql)` | fixed at creation | ✅ `?` placeholders | **essentially everything** |
| `CallableStatement` | `prepareCall(sql)` | fixed at creation | ✅ plus `OUT`/`INOUT` | stored procedures with output parameters |

🔴 **The default is `PreparedStatement`, unconditionally.** Not "when there are
parameters" — always. A parameterless query written as a `PreparedStatement` costs
nothing extra, keeps the code uniform, and means that the day someone adds a
filter they add a `?` rather than a concatenation. Uniformity is a security
control here: a codebase where `createStatement()` is rare makes each occurrence
worth a second look.

## When `Statement` is genuinely right

There are three cases, and they are narrow:

```java
// 1 — DDL, where there is nothing to parameterize
try (Statement st = c.createStatement()) {
    st.execute("CREATE TEMP TABLE staging_orders (LIKE orders INCLUDING DEFAULTS)");
}

// 2 — session or transaction settings
try (Statement st = c.createStatement()) {
    st.execute("SET LOCAL plan_cache_mode = force_custom_plan");
}

// 3 — a completely fixed query with no variable part
try (Statement st = c.createStatement();
     ResultSet rs = st.executeQuery("SELECT count(*) FROM orders")) { ... }
```

Cases 1 and 2 exist because **PostgreSQL will not accept parameters in DDL or in
`SET`**. `SET LOCAL statement_timeout = ?` is not a thing; the value must be in
the text. That is precisely the "identifiers and clauses cannot be parameters"
boundary from [chunk 7](07-what-a-parameter-can-be.md), and it means any
*dynamic* part of a DDL statement needs the same allow-list discipline. A
migration tool that builds `CREATE INDEX` statements from a config file is
building SQL from data, and if that data is ever user-influenced it is an
injection vector with the highest possible privileges.

⚠️ **Case 3 is the weakest of the three.** "There are no parameters today" is a
statement about today. Writing it as a `PreparedStatement` costs one extra word.

## The inherited methods that should not exist

`PreparedStatement` extends `Statement`, so this compiles:

```java
PreparedStatement ps = c.prepareStatement("SELECT * FROM customers WHERE id = ?");
ResultSet rs = ps.executeQuery("SELECT * FROM customers WHERE id = " + id);  // ❌
```

The inherited `executeQuery(String)` ignores the prepared SQL entirely and runs
the string you passed — as a plain statement, with no binding and no protection.
The JDBC specification requires implementations to throw `SQLException` for these
inherited methods on a `PreparedStatement`, and pgJDBC does, but **it is a runtime
failure on a code path that may be rare**, not a compile error. The affected
methods are `executeQuery(String)`, `executeUpdate(String)`, `execute(String)`,
`addBatch(String)` and their variants.

🔴 **This is a real code-review item, not a curiosity.** The shape that produces
it is a helper method typed as `Statement` — because it wants to accept both — with
a call to `execute(sql)` inside. Passing a `PreparedStatement` to that helper
compiles perfectly and silently bypasses the parameterization at runtime. Type
helpers as `PreparedStatement`, or take a `Connection` and the SQL, but do not
accept the supertype for convenience.

## `CallableStatement` and PostgreSQL's two callable things

`CallableStatement` exists for the `{call ...}` escape syntax and for `OUT`
parameters:

```java
try (CallableStatement cs = c.prepareCall("{ ? = call total_spend(?) }")) {
    cs.registerOutParameter(1, Types.BIGINT);
    cs.setLong(2, customerId);
    cs.execute();
    long total = cs.getLong(1);
}
```

PostgreSQL has **functions** (since forever) and **procedures** (since 11), and
the distinction matters for this API:

| | Function | Procedure |
|---|---|---|
| Called with | `SELECT fn(...)` | `CALL proc(...)` |
| Returns | a value or a set | nothing; may have `INOUT` parameters |
| Transaction control inside | ❌ no | ✅ **yes** — can `COMMIT` / `ROLLBACK` |

🔴 **That last row is the one with teeth.** A PostgreSQL procedure can commit the
transaction from inside the call. So `CALL` from JDBC with autocommit off can
return with your transaction already committed and a new one begun, which makes
your subsequent `rollback()` a no-op over work you thought was still provisional.
If you call procedures, know what they do to the transaction —
**Topic 03** covers the transaction side at
**the shape that survives failure** *(not written yet)*.

⚠️ **For an ordinary PostgreSQL function, a `PreparedStatement` is simpler and
better:**

```java
// ✅ preferred for a function
try (PreparedStatement ps = c.prepareStatement("SELECT total_spend(?)")) {
    ps.setLong(1, customerId);
    try (ResultSet rs = ps.executeQuery()) {
        rs.next();
        long total = rs.getLong(1);
    }
}
```

A function returning `SETOF` or `TABLE` is used as a table source —
`SELECT * FROM report_lines(?)` — and again a `PreparedStatement` is all you need.
`CallableStatement` earns its keep only when you have genuine `OUT` parameters or
you are calling a procedure.

## `execute` vs `executeQuery` vs `executeUpdate`

| Method | Returns | Use when |
|---|---|---|
| `executeQuery()` | `ResultSet` | you know it is a `SELECT` |
| `executeUpdate()` | `int` — rows affected | you know it is `INSERT`/`UPDATE`/`DELETE`/DDL |
| `executeLargeUpdate()` | `long` | the count may exceed `Integer.MAX_VALUE` |
| `execute()` | `boolean` — true if the first result is a `ResultSet` | you do not know, or there are multiple results |

⚠️ **`INSERT ... RETURNING` is a query, not an update.** PostgreSQL's `RETURNING`
clause makes a DML statement produce rows, so `executeUpdate` on it either throws
or discards them depending on the path. Use `executeQuery` and read the
`ResultSet` — that is the whole mechanism behind
[chunk 20](20-generated-keys.md).

⚠️ **`executeUpdate` returning 0 is information, not a failure.** An `UPDATE ...
WHERE id = ?` that affects zero rows means the row did not exist or did not match
— which for an optimistic-locking update is the *signal*, not an anomaly. Code
that ignores the return value of `executeUpdate` is throwing away the only
confirmation it gets.

## The trade-off

Using `PreparedStatement` for everything means paying a small ceremony — a
`prepareStatement` call and numbered setters — for statements that genuinely have
no parameters, and it means a parameterless statement participates in the
server-side preparation machinery of [chunk 9](09-server-side-prepared-statements.md)
for no benefit. Both costs are trivially small. The benefit is that
`createStatement()` becomes a rare enough call that its every appearance is worth
reading, which is exactly the property you want from a security-relevant API.

## Gotchas

**⚠️ `ps.executeQuery(sql)` on a `PreparedStatement`**
**Symptom:** an exception at runtime on an uncommon path, or — in a helper typed
as `Statement` — a silently unparameterized execution.
**Cause:** `PreparedStatement` inherits `Statement`'s SQL-taking methods.
**Fix:** type helpers as `PreparedStatement`, never as `Statement`, and grep for
`execute*(` calls with an argument on prepared objects.

**⚠️ Parameterizing a `SET` or a DDL statement**
**Symptom:** a syntax error on `SET LOCAL statement_timeout = ?`.
**Cause:** PostgreSQL does not accept parameters in those positions.
**Fix:** build the text — and if any part of it is dynamic, allow-list it, because
DDL runs with your migration role's privileges.

**⚠️ `executeUpdate` on `INSERT ... RETURNING`**
**Symptom:** an exception about a result set being returned, or a returned row
silently discarded.
**Cause:** `RETURNING` makes DML produce a result set.
**Fix:** `executeQuery` and read the rows.

**⚠️ Ignoring the `int` from `executeUpdate`**
**Symptom:** an optimistic-locking update that never detects a conflict; a
"delete" that reports success for a row that was not there.
**Cause:** the affected-row count is the only feedback and it was discarded.
**Fix:** check it. Zero rows affected on a `WHERE id = ? AND version = ?` is the
conflict signal.

**⚠️ `CALL`ing a procedure that commits, inside your transaction**
**Symptom:** a `rollback()` that does not roll back, or a transaction that ends
somewhere in the middle of your unit of work.
**Cause:** PostgreSQL procedures can perform transaction control.
**Fix:** know what the procedure does. If it commits, it cannot be composed into a
larger transaction, and that is a design constraint rather than a bug to work
around.

**⚠️ Reaching for `CallableStatement` to call an ordinary function**
**Symptom:** more code, escape syntax nobody reads easily, and `OUT` parameter
registration for something that returns a plain value.
**Cause:** the name suggests it is the way to call things.
**Fix:** `SELECT fn(?)` in a `PreparedStatement`. Keep `CallableStatement` for
genuine `OUT` parameters and procedures.

## Interview questions

**★ When would you use a plain `Statement`?**
For DDL and for session or transaction settings, because PostgreSQL does not
accept bound parameters in those positions — `SET LOCAL statement_timeout = ?` is
a syntax error, so the value has to be in the text. Beyond those, effectively
never. Even a query with no parameters today is better written as a
`PreparedStatement`, because the ceremony is one word and it keeps
`createStatement()` rare enough that every appearance in a diff is worth reading.
That rarity is itself a security control: in a codebase where prepared statements
are the default, a plain `Statement` is a signal rather than noise.

**★ `PreparedStatement` extends `Statement`. Why is that a problem?**
Because it inherits the SQL-taking execution methods — `executeQuery(String)`,
`executeUpdate(String)`, `execute(String)`, `addBatch(String)` — and calling one of
them on a prepared statement runs the string you passed as a plain statement,
ignoring the prepared SQL and every parameter you bound. The specification requires
drivers to throw for those methods and pgJDBC does, but that is a runtime failure
on a possibly-rare path rather than a compile error. The dangerous shape is a
helper method typed as `Statement` so it can accept either: passing a
`PreparedStatement` to it compiles cleanly and bypasses parameterization at
runtime. Type helpers as `PreparedStatement`.

**★ When do you actually need `CallableStatement` on PostgreSQL?**
When you have genuine `OUT` or `INOUT` parameters, or when you are invoking a
PostgreSQL *procedure* with `CALL`. For an ordinary function — which is what most
PostgreSQL "stored procedures" actually are — a `PreparedStatement` running
`SELECT fn(?)` is simpler, uses the same parameter binding as everything else, and
reads better; a set-returning function is used as a table source with `SELECT *
FROM fn(?)`. The one thing to know about procedures is that they can perform
transaction control internally, so a `CALL` can commit your transaction from
underneath you, which makes such a procedure impossible to compose into a larger
unit of work.

**★ What does `executeUpdate` returning 0 tell you?**
That the statement matched no rows — and that is usually meaningful information
rather than an error. For an optimistic-locking update written as `UPDATE ... SET
... WHERE id = ? AND version = ?`, a zero means the version moved and somebody else
won; that is the conflict detection, and code that discards the return value has
no conflict detection at all. For a delete it distinguishes "removed" from "was not
there", which is the difference between a 204 and a 404. The habit worth forming is
that the count is the statement's only acknowledgement and should be examined
rather than ignored.

**★ Why is `INSERT ... RETURNING id` executed with `executeQuery` rather than
`executeUpdate`?**
Because `RETURNING` turns a DML statement into something that produces rows, and
`executeQuery` is the method whose contract is "this produces a `ResultSet`".
`executeUpdate` is specified for statements that return nothing or a count, so
running a `RETURNING` statement through it either throws or discards the rows
depending on the path. This is also the reason `RETURNING` is the better way to
get a generated key on PostgreSQL than `getGeneratedKeys()` — it is an ordinary
result set from an ordinary query, with no driver-specific behaviour in between.

---

← Prev: [The generic plan cliff](10-the-generic-plan-cliff.md) · Index: [JDBC](README.md) · Next → [`ResultSet`: the cursor model](12-resultset-the-cursor-model.md)
