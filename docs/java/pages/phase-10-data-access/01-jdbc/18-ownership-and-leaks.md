---
title: "A leaked connection is not found where it leaked, and that is the whole difficulty"
sidebar_label: "18 · Ownership and leaks"
sidebar_position: 18
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the JDK 25 API for `java.sql.Connection` and
> `java.sql.Statement`
> ([docs.oracle.com/en/java/javase/25/docs/api/java.sql/](https://docs.oracle.com/en/java/javase/25/docs/api/java.sql/)),
> the HikariCP 7.0.2 README (`leakDetectionThreshold`, `maximumPoolSize`,
> `connectionTimeout` defaults) and the PostgreSQL 18 manual on
> `pg_stat_activity`. JDK 25, JDBC 4.3, pgjdbc 42.7.13, PostgreSQL 18.

**Closing correctly, which [chunk 17](17-resource-handling.md) covers, is only
half the problem. The other half is knowing *whose* resource it is — because in
any real service the connection you are holding was probably opened by something
else, and the two failure modes are opposite. Close a connection you do not own
and you break the transaction a framework is running. Fail to close one you do
own and the pool drains, and the exception surfaces on an innocent thread minutes
later, naming a caller that did nothing wrong. Neither failure points at the line
that caused it, which is why ownership has to be a rule you follow rather than
something you work out from a stack trace.**

## Who owns the connection

| Context | Who opened it | Who must close it | What you write |
|---|---|---|---|
| plain JDBC | you, via `dataSource.getConnection()` | you | `try`-with-resources |
| Spring `@Transactional` | the transaction manager, bound to the thread | the transaction manager | nothing — use `JdbcClient` / a repository |
| `JdbcTemplate` callback | `JdbcTemplate` | `JdbcTemplate` | use the `Connection`, never close it |
| a pool, directly | the pool (it opened the physical connection) | you close the *proxy*, which returns it | `try`-with-resources |
| a framework handing you one | the framework | the framework, unless it documents a transfer | read the javadoc |

🔴 **The rule that covers all five rows: close what you opened, and nothing
else.** A `close()` on a connection you did not open is not a tidy-up; it is a
statement that you are finished with somebody else's transaction.

## The effectively-final form

Since Java 9 an existing variable may be used as a resource directly, provided it
is final or effectively final:

```java
Connection c = transactionManager.currentConnection();  // owned elsewhere
try (c) {                                               // legal since Java 9
    ...
}
```

This is worth knowing and rarely worth using in JDBC code, because it hides
*ownership*: the `try (c)` block closes a connection it did not open. Use it when
a factory hands you an already-open resource and the ownership genuinely
transfers; do not use it to tidy up a connection somebody else is managing.

## `closeOnCompletion`

`Statement.closeOnCompletion()` says: *"this `Statement` will be closed when all
its dependent result sets are closed."* It exists for the case where a method
returns a `ResultSet` and the caller cannot see the statement:

```java
PreparedStatement ps = c.prepareStatement(sql);
ps.closeOnCompletion();
return ps.executeQuery();      // caller closes the ResultSet; the Statement follows
```

⚠️ It does **not** close the connection, and it is not a substitute for
try-with-resources — it is a way to make one specific API shape (returning a live
`ResultSet`) safe. Returning a live `ResultSet` from a repository method is
itself a design worth avoiding: the row mapper in
[chunk 16](16-mapping-rows-to-objects.md) exists so that the resource never
escapes the method that opened it.

## Closing a connection with a transaction open

The `Connection.close()` javadoc is explicit and is not what people assume:

> *It is **strongly recommended** that an application explicitly commits or rolls
> back an active transaction prior to calling the `close` method. If the `close`
> method is called and there is an active transaction, the results are
> **implementation-defined**.*

So "closing rolls back" is **not** something the specification promises. In a
pooled application the connection is not being closed at all — it is going back
into the pool with whatever session state you left on it, which is the failure
[chunk 4](04-connection-is-expensive.md) describes and **Topic 03 — transactions
at the JDBC level** *(not written yet)* owns in full. The rule that survives every
combination of driver and pool: **end the transaction yourself, in the code that
started it.**

## What a leak looks like from outside

Leaks do not announce themselves at the leak site. The observable symptoms:

- **`Connection is not available, request timed out after 30000ms`** from
  HikariCP, on threads that are innocent. The leaking path may not appear
  anywhere in the log.
- **Throughput that degrades over hours** and recovers on restart — the
  hallmark of a slow leak against a pool.
- **`idle in transaction` sessions in `pg_stat_activity`** with a `query_start`
  minutes old, when a connection was leaked mid-transaction.
- **Growing heap in a service that only reads** — a leaked streaming `ResultSet`
  holds its buffer and its transaction.

The tool for the first one is HikariCP's `leakDetectionThreshold`, **default `0`
(off)**: set it to a value above your slowest legitimate query — 20–60 seconds is
usual — and the pool logs a stack trace of the borrow site for any connection
held longer. It is a diagnostic, not a fix: it does not reclaim the connection,
it tells you which line took it.

## Gotchas

**⚠️ `try`-with-resources around a Spring-managed connection**
**Symptom:** a `@Transactional` method that commits half its work, or a
`Connection is closed` on the next statement in the same transaction.
**Cause:** under Spring, the transaction manager owns the connection; obtaining
one from the `DataSource` yourself and closing it fights the manager, and using
`DataSourceUtils.getConnection` then closing it manually is the same bug.
**Fix:** in Spring code, do not touch `Connection` — use `JdbcClient`,
`JdbcTemplate` or the repository, all of which participate correctly.

**⚠️ A loop that opens a connection per iteration**
**Symptom:** pool exhaustion under a batch job that works fine for small inputs.
**Cause:** the `try`-with-resources is *inside* the loop, so N iterations borrow
N connections in sequence — fine — but any concurrency over that loop multiplies
it by the thread count.
**Fix:** hoist the connection outside the loop and keep the statement, which is
also what makes batching and statement reuse possible
([chunk 9](09-server-side-prepared-statements.md)).

**⚠️ Closing the `ResultSet` but returning it**
**Symptom:** `ResultSet is closed` in the caller.
**Cause:** the resource block ended when the method returned.
**Fix:** map inside the block and return the mapped objects — never the cursor.

**⚠️ Relying on `Connection.close()` to roll back**
**Symptom:** committed work you expected to be discarded, on a different driver
or after a pool change.
**Cause:** the javadoc calls the outcome implementation-defined.
**Fix:** `rollback()` explicitly on the failure path.

**⚠️ `isClosed()` used as a health check**
**Symptom:** code that checks `isClosed()`, gets `false`, and then fails on the
next statement.
**Cause:** the javadoc says it *"generally cannot be called to determine whether
a connection to a database is valid"* — it is guaranteed `true` only after
`close()` was called.
**Fix:** `isValid(timeout)`, which the driver implements by actually asking the
server; or nothing at all, and let the pool's validation handle it.

**⚠️ Holding a `Connection` in a field or a singleton**
**Symptom:** intermittent `ResultSet is closed` and interleaved results under
load; a service that works with one user and corrupts with two.
**Cause:** a `Connection` is not thread-safe, and a field on a singleton bean is
shared by every request thread.
**Fix:** get a connection per unit of work from the `DataSource`, which is what
the pool is for ([chunk 4](04-connection-is-expensive.md)).

**⚠️ Using a connection after it has been returned to the pool**
**Symptom:** `Connection is closed`, or — worse — statements that succeed on a
connection now owned by another thread.
**Cause:** a reference kept past the end of the `try` block, typically captured
by a lambda, a callback or an `@Async` method.
**Fix:** never let the reference escape the block; hand mapped objects across the
boundary, not handles.

**⚠️ Stashing a connection in a `ThreadLocal` under virtual threads**
**Symptom:** a pattern that worked on a fixed pool of platform threads leaks or
cross-talks once tasks are cheap and numerous.
**Cause:** one connection per thread is a bounded assumption; with virtual
threads there is no bound, and the pool is still ten.
**Fix:** scope the connection to the unit of work, not to the thread.

**⚠️ `leakDetectionThreshold` set below a legitimate query time**
**Symptom:** the log fills with leak warnings for a nightly report that is simply
slow, and the real leak is lost in the noise.
**Cause:** the threshold is a wall-clock hold time, and it does not know a slow
query from a forgotten one.
**Fix:** set it above the slowest legitimate hold — and if a hold is genuinely
minutes long, move that work off the request path rather than raising the
threshold forever.

**⚠️ Closing the `DataSource` instead of the connection**
**Symptom:** the whole pool shuts down mid-request; every subsequent borrow
fails.
**Cause:** `HikariDataSource` is itself `Closeable`, so a `try`-with-resources
written around the wrong variable compiles perfectly.
**Fix:** the pool's lifetime is the application's — it is closed by the container
at shutdown, never by request-scoped code.

## Interview questions

**★ What actually leaks when you forget to close a `ResultSet`, a `Statement`, a
`Connection`?**
All three hold state the garbage collector cannot see. A `ResultSet` may hold a
server-side portal and, when streaming, a transaction that stays open — visible
as `idle in transaction` in `pg_stat_activity` — plus its row buffer on the heap.
A `Statement` holds driver buffers and, once it has crossed the prepare
threshold, a named statement in the backend. A `Connection` holds a backend
process and a socket, and in a pooled application it holds one of a very small
number of pool slots, so leaking it is the one that ends the service: ten
connections and a leak on a per-minute path is ten minutes to total failure. The
diagnostic is HikariCP's `leakDetectionThreshold`, off by default, which logs the
borrow stack for connections held too long.

**★ If closing a `Connection` ends the transaction anyway, why commit or roll
back explicitly?**
Because the specification does not say it ends the transaction. `Connection.close`
states that an application should explicitly commit or roll back first, and that
if there is an active transaction the results are implementation-defined. Beyond
the spec, in a pooled application `close()` is not a close: it returns the object
to the pool, still connected, still carrying whatever session state you left —
autocommit setting, isolation level, `search_path`, an open transaction. The next
borrower gets that. So the transaction has to end in the code that started it,
and that is true whether the driver happens to roll back or not.

**★ When would you *not* wrap a JDBC `Connection` in `try`-with-resources?**
When you do not own it. Inside a Spring `@Transactional` method the transaction
manager owns the connection and binds it to the thread; taking one from the
`DataSource` and closing it yourself gets you a second connection outside the
transaction, or a closed connection under the manager's feet. The same applies to
a connection handed in by a framework callback — `JdbcTemplate` gives you a
`Connection` in a `ConnectionCallback` and takes it back afterwards. The rule is
ownership, not syntax: the code that opened it closes it.

**★ What is `closeOnCompletion` for, and why is it rarely the right answer?**
It marks a `Statement` to close itself once all its dependent result sets are
closed, which makes it possible to return a live `ResultSet` from a method
without leaking the statement behind it. It is rarely right because returning a
live `ResultSet` is the problem: the cursor, its statement and its connection all
outlive the method that created them, so the caller now owns resources it did not
open and may not close. Mapping inside the block and returning objects removes
the question, and that is what every abstraction above JDBC does.

**★ You inherit a service that dies after six hours with "Connection is not
available". How do you find the leak?**
Turn on `leakDetectionThreshold` — set it above the slowest legitimate query,
typically 20–60 seconds — and the pool logs a stack trace of the *borrow* site
for any connection held longer, which names the leaking path directly. In
parallel, look at `pg_stat_activity` for sessions in `idle in transaction` with
old `query_start` values, which tells you whether connections are being held
mid-transaction rather than merely held. The reason the ordinary log is useless
here is that the exception surfaces on whichever thread happened to ask next, so
the stack trace you already have points at an innocent caller.

**★ Can you put an already-open resource in a `try`-with-resources?**
Yes, since Java 9, if the variable is final or effectively final: `try (c) { ... }`.
It compiles and it closes `c` at the end of the block. Whether you *should* is a
different question, and in JDBC the answer is usually no, because it separates
opening from closing and hides who owns the resource. The legitimate case is a
factory method that hands you an open resource and transfers ownership with it;
the illegitimate case — the common one — is tidying up a connection that a
framework is still managing, which produces a closed connection under the
framework's feet.

**★ What is the difference between closing a pooled connection and closing a
real one?**
Almost everything. On a physical connection, `close()` ends the session: the
backend process on the database server exits and the socket is released. On a
pooled connection you are holding a proxy, and `close()` means "return me" — the
physical connection stays open, keeps its backend process, and keeps whatever
session state you left on it, which is why an unreset `search_path`, isolation
level or open transaction becomes the next borrower's problem. The practical
consequences are that closing is cheap and must still be done promptly, because
what you are releasing is one of a very small number of pool slots; and that you
cannot reason about session state as though each unit of work got a fresh
connection, because it did not.

**★ Your leak detector logged a stack trace. Is the connection reclaimed?**
No. `leakDetectionThreshold` is a diagnostic: after the configured hold time the
pool logs the stack trace captured at the *borrow* site, so you learn which code
path took the connection and never gave it back. The connection stays out. That
is deliberate — forcibly reclaiming a connection that another thread believes it
owns would produce far stranger failures than exhaustion — but it means the leak
detector is a tool for finding the bug, not a mitigation you can leave on and
consider the problem handled. The fix is always in the code the trace names.

---
<!--FOOTER-->
