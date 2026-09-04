---
title: "HikariCP chains the driver's real error onto its timeout exception, and neither getMessage() nor a stack trace will show it to you"
sidebar_label: "5b · The exception underneath"
sidebar_position: 15
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the HikariCP 7.0.2 source
> (`pool/HikariPool.java` `createTimeoutException()`, read at tag
> `HikariCP-7.0.2`), the JDK 25 API for `java.sql.SQLException` and
> `java.sql.SQLTransientConnectionException`
> ([docs.oracle.com/en/java/javase/25/docs/api/java.sql/](https://docs.oracle.com/en/java/javase/25/docs/api/java.sql/)),
> and the PostgreSQL 18 error-code appendix
> ([postgresql.org/docs/18/errcodes-appendix.html](https://www.postgresql.org/docs/18/errcodes-appendix.html)).
> JDK 25, HikariCP 7.0.2, PostgreSQL 18, pgjdbc 42.7.13, Spring Framework 7.0.9.

**When HikariCP gives up waiting, it does not invent an error out of nothing. If
a connection attempt failed recently, it takes that driver exception, **copies
its SQLState and vendor error code onto its own exception**, and attaches the
original with `setNextException()`. The real cause travels with the timeout. And
then almost every application throws it away, because `getMessage()` does not
include it — and neither does a stack trace.**

## What `createTimeoutException()` does

Three things, in the source:

1. Builds the message with the pool's four numbers
   ([chunk 5](05-connection-is-not-available.md)).
2. If there was a recent connection failure, **copies that exception's SQLState
   and error code onto the new `SQLTransientConnectionException`**.
3. Chains the original driver exception onto it with `setNextException()`.

So the object your `catch` block receives already carries the driver's verdict —
in two places, one of which is easy to reach and one of which is not.

## Why a stack trace does not show it

🔴 **`getNextException()` is not `getCause()`.** They are separate chains with
separate purposes:

| | `getCause()` | `getNextException()` |
|---|---|---|
| Defined on | `Throwable` | `SQLException` |
| Printed by `printStackTrace()` | ✅ yes, as `Caused by:` | ⛔ **no** |
| Printed by SLF4J / Logback `log.error(msg, e)` | ✅ yes | ⛔ **no** |
| Purpose | this failure happened *because of* that one | a *sequence* of SQL errors from one operation |

⛔ **This is the trap, and it is worse than the usual "log the whole exception"
advice, because logging the whole exception is not enough.** A perfectly
correct-looking handler:

```java
catch (SQLException e) {
    log.error("Database call failed", e);   // ← prints the trace. Not the chain.
}
```

produces a stack trace ending at HikariCP's timeout message, and the `53300` or
the authentication failure that actually caused it never appears anywhere.

## Walking the chain properly

Since JDBC 4.0, `SQLException` implements `Iterable<Throwable>`, and iterating it
walks the next-exception chain *and* the cause chain of each link. That makes the
correct handler short:

```java
static void logSqlFailure(String context, SQLException e) {
    log.error("{} — {} [state={} code={}]",
              context, e.getMessage(), e.getSQLState(), e.getErrorCode(), e);

    for (Throwable t : e) {                       // Iterable<Throwable>
        if (t instanceof SQLException chained && chained != e) {
            log.error("  ↳ chained: [state={} code={}] {}",
                      chained.getSQLState(), chained.getErrorCode(),
                      chained.getMessage());
        }
    }
}
```

⚠️ **Under Spring, start one level higher.** A `DataAccessException` keeps the
original `SQLException` as its *cause*, so the stack trace shows you the
`SQLTransientConnectionException` — and then stops, exactly as above. Reach the
`SQLException` through `getCause()` and then walk it:

```java
catch (DataAccessException e) {
    if (e.getCause() instanceof SQLException sql) {
        logSqlFailure("order lookup", sql);
    }
}
```

## What you find down there

| Chained SQLState | Condition | What it means | Retry? |
|---|---|---|---|
| `53300` | `too_many_connections` | the server is at `max_connections`, or your role's limit ([chunk 3c](03c-the-server-side-ceiling.md)) | ⚠️ only with backoff, and only if the cause is transient |
| `28P01` | `invalid_password` | credentials rotated and the pool was not restarted | ⛔ **never** — retrying burns attempts forever |
| `28000` | `invalid_authorization_specification` | the role cannot connect at all | ⛔ never |
| `3D000` | `invalid_catalog_name` | the database name is wrong or the database was dropped | ⛔ never |
| `08001` | `sqlclient_unable_to_establish_sqlconnection` | could not reach the server — DNS, routing, port | ✅ yes, with backoff |
| `08006` | `connection_failure` | the connection died mid-flight | ✅ yes |
| *(none)* | — | no recent connection failure; the pool was simply busy | ✅ yes — it is a queueing problem |

🔴 **The last row is the point of the whole table.** An empty chain means the pool
had connections and they were all in use — a capacity or leak problem
([chunk 5](05-connection-is-not-available.md)). A populated chain means the pool
could not *make* a connection, which is a different problem with a different
owner.

## The type is a claim about the pool, not the database

`SQLTransientConnectionException` extends `SQLTransientException`, whose contract
in the JDK API is that the operation may succeed if it is retried. HikariCP
throws it because, from the pool's point of view, that is true: a request that
found no free connection may find one next time.

⛔ **But the chained cause can make retrying useless or harmful.** A pool timing
out because the password was rotated will throw a "transient" exception every
time, forever, and a retry loop that trusts the type will hammer the database
with failing authentications for as long as the deployment lives. The exception's
*type* tells you the pool thinks a retry is reasonable; the *chain* tells you
whether it actually is.

That is the shape a good retry policy takes: retry on the type, but check the
chained SQLState first and give up immediately on the authorisation and
invalid-name classes ([topic 01 chunk 21e](../01-jdbc/21e-retrying-and-translating.md)).

## The pool name is in there too

The message begins with the pool name, which is why
[chunk 3f](03f-wiring-a-second-datasource.md) insists on distinct `pool-name`
values. In an application with a request pool and a reports pool, that first word
is what tells you which one failed — and the two have entirely different correct
responses.

## The trade-off

Walking the chain is more code in every handler, and it is code that runs on the
failure path where nobody tests it. The honest answer is not to write it
everywhere: write it once, in a shared handler or a logging helper, and route
every `SQLException` through it. The alternative — losing the cause on every
failure — is not neutral, because the missing information is precisely the part
that distinguishes "add capacity" from "the credentials expired", and those are
answered by different teams.

## Gotchas

**⚠️ Logging `e.getMessage()` only**
**Symptom:** logs full of "Connection is not available" and no idea why.
**Cause:** the driver's error is chained, not concatenated.
**Fix:** walk `getNextException()`, or iterate the `SQLException`.

**⚠️ Logging the exception object and assuming that is enough**
**Symptom:** a complete stack trace that still does not name the cause.
**Cause:** `printStackTrace()` and SLF4J follow `getCause()`, and the SQL chain is
a *different* chain.
**Fix:** the iteration above. This is the one that catches experienced people,
because "log the exception, not the message" is normally correct advice.

**⚠️ Switching on `e.getSQLState()` of the timeout exception without knowing it is borrowed**
**Symptom:** a `53300` handler fires on what looks like a HikariCP exception, or
does not fire when it should.
**Cause:** HikariCP copies the SQLState from the last connection failure, so it
is sometimes the driver's and sometimes absent.
**Fix:** it is usable, and worth using — but treat an absent SQLState as
meaningful too, since it means there was no connection failure at all.

**⚠️ Retrying on `SQLTransientConnectionException` unconditionally**
**Symptom:** a rotated credential produces an infinite retry storm against the
database.
**Cause:** the type describes the pool's view, not the underlying cause.
**Fix:** inspect the chained SQLState and stop on class 28 and `3D000`.

**⚠️ Catching `Exception` at the top of a request and logging a one-liner**
**Symptom:** every database failure in the service looks the same.
**Cause:** the chain is lost at the outermost layer, which is where most
applications actually log.
**Fix:** one shared helper that knows about `SQLException`, called from the
global handler.

**⚠️ Losing the chain in a wrapper**
**Symptom:** the application's own `RepositoryException` carries a message and
nothing else.
**Cause:** `new RepositoryException("could not load order: " + e.getMessage())`
throws the object away.
**Fix:** always pass the original as the cause — `new RepositoryException(msg,
e)` — so the chain is still reachable further up.

**⚠️ Assuming an empty chain means HikariCP has no information**
**Symptom:** time spent hunting for a database error that does not exist.
**Cause:** no recent connection failure means the pool was simply busy.
**Fix:** an empty chain is itself a diagnosis — go to
[chunk 5's](05-connection-is-not-available.md) matrix and read the four numbers.

**⚠️ Forgetting the pool name in a multi-pool application**
**Symptom:** an incident where nobody can say which pool timed out.
**Cause:** two pools with the default name.
**Fix:** distinct `pool-name` per pool; the message starts with it.

## Interview questions

**★ Your logs show "Connection is not available, request timed out". Where is the real cause?**
Usually attached to the same exception, and thrown away by the logging. When
HikariCP builds the timeout exception it copies the SQLState and vendor error
code of the most recent connection failure onto it, and chains the original
driver exception with `setNextException()`. So `getSQLState()` on the exception
you caught may already be PostgreSQL's `53300`, and `getNextException()` holds
the driver's own exception with its message. If the chain is empty, that is also
information: it means no connection attempt failed, so the pool simply had
nothing free and the problem is capacity or a leak.

**★ Why does logging the whole exception not show it?**
Because `getNextException()` is not `getCause()`. They are two separate chains:
`getCause()` comes from `Throwable` and is what `printStackTrace()` and every
logging framework follow when they print `Caused by:`. `getNextException()` is
specific to `SQLException` and represents a sequence of SQL errors arising from
one operation; nothing prints it automatically. This is why the usual advice —
"log the exception object, not just the message" — is necessary but not
sufficient for JDBC, and it is the single most common reason a database incident
has no diagnosable evidence.

**★ How do you walk the chain correctly?**
Since JDBC 4.0 `SQLException` implements `Iterable<Throwable>`, so a for-each over
the exception visits every chained `SQLException` and their causes. In practice:
log the top-level exception with its SQLState and error code, then iterate and log
each chained `SQLException`'s state, code and message. Under Spring you start one
level up, because a `DataAccessException` holds the `SQLException` as its cause —
so you unwrap once and then iterate. It is worth writing once as a shared helper
rather than in every handler, since it runs on the path nobody tests.

**★ `SQLTransientConnectionException` says the operation may succeed if retried. Do you trust it?**
Only as a statement about the pool. From HikariCP's perspective it is honest: a
borrow that found nothing free may find something next time. But the reason the
pool could not produce a connection may be entirely non-transient — a rotated
password, a dropped database, a role without connect privilege — and those throw
the same "transient" exception forever. A retry loop that trusts the type will
retry an authentication failure indefinitely, which is worse than failing, since
it adds load to a database that is already refusing you. The correct policy
retries on the type but consults the chained SQLState and stops immediately on the
authorisation classes.

**★ What does an empty exception chain tell you?**
That there was no recent failure to *create* a connection, which narrows the
diagnosis considerably: the pool had connections, and they were all in use. That
puts you in the capacity, leak, deadlock or slow-query part of the matrix, all of
which are read from the four numbers in the message rather than from a driver
error. It is a good example of an absence being evidence — and a reason to log
the presence or absence of the chain explicitly, rather than only logging it when
it exists.

**★ Give a concrete example where reading the chain changes who fixes the incident.**
A pool timing out with `53300 too_many_connections` chained underneath. Read
naively, the message says the application's pool was too small, so the
application team raises `maximumPoolSize` — which makes it strictly worse, since
the server was already refusing connections and the fleet now asks for more. Read
properly, the chained code says the *database* is at its ceiling, which is a
budget problem spanning every service on that server, and the fix is per-role
connection limits and a fleet-wide accounting exercise. Same exception, same
stack trace, two different teams and two opposite changes.

---

← Prev: [5 · Connection is not available](05-connection-is-not-available.md) · Index: [Connection pooling with HikariCP](README.md) · Next → [6 · Leak detection](06-leak-detection.md)
