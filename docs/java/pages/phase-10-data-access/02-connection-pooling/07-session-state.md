---
title: "The pool resets exactly six things when you close a connection, and it tracks them with six bits so it can usually reset nothing at all"
sidebar_label: "7 · Session state"
sidebar_position: 18
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the HikariCP 7.0.2 source
> (`pool/ProxyConnection.java`, `pool/PoolBase.java` `resetConnectionState()`,
> read at tag `HikariCP-7.0.2`)
> ([github.com/brettwooldridge/HikariCP](https://github.com/brettwooldridge/HikariCP)),
> the pgjdbc source for `PgConnection.setSchema` / `setReadOnly` /
> `setNetworkTimeout`
> ([github.com/pgjdbc/pgjdbc](https://github.com/pgjdbc/pgjdbc)), and the JDK 25
> API for `java.sql.Connection`
> ([docs.oracle.com/en/java/javase/25/](https://docs.oracle.com/en/java/javase/25/docs/api/java.sql/java/sql/Connection.html)).
> JDK 25, HikariCP 7.0.2, pgjdbc 42.7.13, PostgreSQL 18.

**A pooled connection is not a fresh connection. It is a **recycled session** —
the same PostgreSQL backend process, with the same session, that somebody else's
request was using a millisecond ago. HikariCP puts it back into a known state
before handing it on, but "a known state" turns out to mean exactly six
properties, and the way it tracks them is worth understanding, because what it
does *not* reset is the subject of [chunk 7b](07b-what-sql-leaves-behind.md) and
is the source of some genuinely alarming bugs.**

## The six dirty bits

`ProxyConnection` keeps a bitmask. Each of six `Connection` setters flips a bit
when it is called:

| Bit | Setter | HikariCP's configured value |
|---|---|---|
| `READONLY` | `setReadOnly(boolean)` | `readOnly` (default `false`) |
| `AUTOCOMMIT` | `setAutoCommit(boolean)` | `autoCommit` (default `true`) |
| `ISOLATION` | `setTransactionIsolation(int)` | `transactionIsolation` (default: the driver's) |
| `CATALOG` | `setCatalog(String)` | `catalog` |
| `NETTIMEOUT` | `setNetworkTimeout(Executor, int)` | the pool's network timeout |
| `SCHEMA` | `setSchema(String)` | `schema` |

On return, `resetConnectionState()` looks at the bitmask and restores **only the
bits that were set, and only where the current value actually differs from the
pool's configured value.** It then logs at DEBUG which ones it reset.

🔴 **The design goal is to do nothing.** Code that borrows a connection, runs a
query and returns it has touched none of the six, so the reset is a bitmask
comparison against zero and no round trip to the database at all. That is the
performance argument for tracking bits rather than issuing a blanket reset — and
it is exactly the trade-off a proxy like PgBouncer makes differently
([chunk 8e](08e-pgbouncer-in-front.md), where `DISCARD ALL` is the default reset
query).

## The order of operations in `close()`

Reading `ProxyConnection.close()`, the sequence is:

| # | Step |
|---|---|
| 1 | close any `Statement` objects still open on this connection |
| 2 | cancel the leak-detection task ([chunk 6](06-leak-detection.md)) |
| 3 | **if `isCommitStateDirty` and autocommit is off → `rollback()`** |
| 4 | `resetConnectionState(dirtyBits)` |
| 5 | `clearWarnings()` |
| 6 | swap the delegate for a `ClosedConnection` sentinel |
| 7 | `poolEntry.recycle()` — the connection is back in the pool |

🔴 **Step 3 before step 4 is not arbitrary.** pgjdbc's `setReadOnly` throws if a
transaction is in progress — *"Cannot change transaction read-only property in
the middle of a transaction"* — so resetting the READONLY bit while a transaction
is open would fail. Rolling back first guarantees the session is idle by the time
the reset runs. The ordering is load-bearing.

**Step 1** matters more than it looks: a `Statement` left open by sloppy code does
not accumulate on the connection for the next borrower
([topic 01 chunk 17](../01-jdbc/17-resource-handling.md)). **Step 5** means
`SQLWarning`s raised during your request are not visible to the next one.

## The rollback safety net, and why it is not a licence

`isCommitStateDirty` is set when a statement executes. So a connection returned
with autocommit off and a statement executed since the last commit gets an
automatic `rollback()`, and HikariCP logs it at DEBUG — *"Executed rollback on
connection ... due to dirty commit state on close()"*.

⚠️ **The JDBC specification refuses to promise this.** `Connection.close()`'s
javadoc calls the behaviour of closing with an active transaction
*implementation-defined*. HikariCP does the safe thing; a different pool, or a
raw connection, may commit or may leave the transaction dangling.

⛔ **So it is a net, not a mechanism.** Code that relies on it is code that will
break when someone swaps the pool, and — more immediately — code whose
transaction outcome is decided by a `finally` block rather than by a decision.
Commit or roll back where the transaction was started
([topic 01 chunk 18](../01-jdbc/18-ownership-and-leaks.md)).

⚠️ **It only fires when autocommit is off.** With autocommit on — the default —
every statement has already committed and there is nothing to roll back. That is
the whole hazard of autocommit, and it is
**[topic 03 · autocommit](../03-jdbc-transactions/01-autocommit-is-a-transaction-you-did-not-choose.md)**.

## What "reset" means for each of the six

Two of them are more interesting than the rest.

🔴 **`setSchema` is `SET search_path`, and that matters enormously.** pgjdbc
implements it by executing:

```sql
SET SESSION search_path TO '<schema>'      -- or: TO DEFAULT, for null
```

So `connection.setSchema("tenant_a")` and
`statement.execute("SET search_path TO tenant_a")` do the *same thing on the
server* — and HikariCP resets one of them and not the other. The JDBC call flips
the SCHEMA bit; the raw SQL is invisible to the proxy. **The same server state is
tracked or untracked purely according to which API you used to set it.** That
single asymmetry is the most useful thing on this page, and it is the doorway to
[chunk 7b](07b-what-sql-leaves-behind.md).

⚠️ **`setReadOnly` on pgjdbc is more subtle than it looks.** It throws if a
transaction is in progress, and whether it issues SQL at all depends on the
driver's `readOnlyBehavior` property and on the autocommit state — so it is a
hint the driver may apply at transaction start rather than an immediate session
change. Either way HikariCP tracks the bit and restores the pool's configured
value.

`setNetworkTimeout` is not a session property at all — it is a socket-level read
timeout in the driver, so resetting it involves no SQL. `setCatalog` on
PostgreSQL cannot switch databases, since a connection is bound to one database
for its lifetime.

## Setting the defaults on the pool instead

If every borrower wants the same value, set it once on the pool. It becomes the
value the reset restores, so nothing has to be set or unset per borrow:

```yaml
spring:
  datasource:
    hikari:
      auto-commit: true
      transaction-isolation: TRANSACTION_READ_COMMITTED
      read-only: false
      schema: app                     # applied to every connection
```

⚠️ **`isolateInternalQueries` (default `false`)** decides whether HikariCP wraps
its *own* internal queries — validation and reset — in a transaction and rolls
them back. It only matters when `autoCommit` is false, where the pool's own
housekeeping would otherwise leave an open transaction on the session.

## The trade-off

Tracking six bits means the common path costs nothing, and it means the pool is
honest about its scope: it restores the JDBC properties it knows about and makes
no claim about the rest. The alternative — a blanket reset on every return —
would be correct for everything but would add a server round trip to every single
borrow, on a hot path measured in microseconds. HikariCP chose speed and a
documented boundary. The price is that the boundary is invisible from application
code: `close()` looks total, and it is not.

## Gotchas

**⚠️ Assuming `close()` gives the next borrower a fresh session**
**Symptom:** state set by one request appears in another.
**Cause:** only six JDBC properties are reset; the session is otherwise the same
one.
**Fix:** [chunk 7b](07b-what-sql-leaves-behind.md) — and never assume, check.

**⚠️ Relying on the rollback at `close()`**
**Symptom:** works with HikariCP, breaks on a different pool or a raw
connection.
**Cause:** the JDBC specification calls it implementation-defined.
**Fix:** commit or roll back where the transaction began.

**⚠️ Expecting the rollback with autocommit on**
**Symptom:** partial writes survive a failure.
**Cause:** with autocommit each statement already committed; there is nothing to
roll back.
**Fix:** turn autocommit off for multi-statement work — or use `@Transactional`,
which does it for you.

**⚠️ Setting the schema with raw SQL for multi-tenancy**
**Symptom:** requests occasionally see another tenant's data.
**Cause:** `SET search_path` issued through a `Statement` is not tracked and not
reset; `connection.setSchema()` is.
**Fix:** use the JDBC setter, or set the pool's `schema` and never change it per
request. This one is worth a code-review rule.

**⚠️ Calling `setReadOnly` inside a transaction**
**Symptom:** `PSQLException` about changing the read-only property mid-transaction.
**Cause:** pgjdbc rejects it once a transaction has started.
**Fix:** set it before any statement executes, or set `read-only` on the pool.

**⚠️ Treating `setCatalog` as "switch database" on PostgreSQL**
**Symptom:** it does not switch, and the code silently queries the original
database.
**Cause:** a PostgreSQL connection is bound to one database for its lifetime.
**Fix:** a second `DataSource` ([chunk 3f](03f-wiring-a-second-datasource.md)).

**⚠️ Changing isolation per borrow instead of per transaction**
**Symptom:** an isolation level that occasionally is not what the code expects.
**Cause:** the setting is reset on return, so it must be applied on each borrow —
easy to apply on some paths and not others.
**Fix:** `@Transactional(isolation = ...)`, which sets it through the JDBC API on
the connection that transaction uses, so it is both applied and reset reliably.

**⚠️ Calling `getSchema()` to check state**
**Symptom:** an unexpected round trip in a hot path.
**Cause:** pgjdbc implements it as `select current_schema()`.
**Fix:** it is a diagnostic, not something to call per request.

## Interview questions

**★ What does a pool reset when you close a connection?**
In HikariCP's case, exactly six JDBC properties: read-only, autocommit,
transaction isolation, catalog, network timeout and schema. It tracks them with a
bitmask — each of the six setters on the proxy flips a bit — and on return it
restores only the bits that were flipped, and only where the current value
differs from the pool's configured value. Before that it closes any statements
you left open, rolls back if a transaction is dirty and autocommit is off, and
clears warnings. What it does not do is reset anything you changed with SQL,
which is the important half.

**★ Why track bits instead of just resetting everything?**
Because the common case is that nothing was changed, and in that case the reset
costs a single comparison against zero and no communication with the database at
all. A blanket reset — the equivalent of PgBouncer's `DISCARD ALL` — would be
correct for every kind of state but would add a server round trip to every
borrow, on a path that is otherwise measured in microseconds. HikariCP chose
speed plus a documented boundary; the cost of that choice is that the boundary is
invisible from application code, since `close()` looks like it cleans everything.

**★ Why does HikariCP roll back before resetting state?**
Because some of the resets cannot run inside a transaction. pgjdbc's
`setReadOnly` throws if a transaction is in progress — it reports that you cannot
change the read-only property in the middle of a transaction — so restoring that
bit while a transaction was still open would fail on return. Rolling back first
guarantees the session is idle before any reset is attempted. It is a small
detail that shows the ordering in `close()` is deliberate rather than incidental.

**★ Should you rely on the rollback at close?**
No. It is a genuine safety net and HikariCP does it deliberately, but the JDBC
specification describes closing a connection with an active transaction as
implementation-defined — another pool may commit, or leave things dangling — and
it only happens at all when autocommit is off. More importantly, code that
depends on it has delegated the commit-or-rollback decision to a `finally` block,
which means the transaction outcome is decided by control flow rather than by
intent. Commit or roll back where the transaction was started.

**★ What is the single most surprising thing about the six?**
That `setSchema` and `SET search_path` are the same operation on the server and
are treated completely differently by the pool. pgjdbc implements `setSchema` by
executing `SET SESSION search_path TO '<schema>'`, so the server state is
identical either way — but the JDBC call goes through HikariCP's proxy and flips
the SCHEMA bit, while the raw SQL goes straight to the driver and is invisible.
One is reset on return and the other leaks to the next borrower. It is a perfect
illustration that the pool tracks *API calls*, not *session state*.

**★ How does this affect schema-per-tenant multi-tenancy?**
It makes the choice of API a correctness issue rather than a style issue. Setting
the tenant's schema with `connection.setSchema()` is safe, because the bit is
tracked and the pool restores its configured value on return. Setting the same
thing with `statement.execute("SET search_path TO tenant_a")` is a cross-tenant
data leak waiting to happen, because the next request to borrow that connection
inherits the search path. Both lines do the same thing on the server, and only
one of them is safe — which is worth an explicit rule in code review, since
nothing about the code makes the difference visible.

**★ What is `isolateInternalQueries` for?**
It controls whether HikariCP wraps its own internal queries — connection
validation and state reset — in a transaction of their own and rolls them back.
It only matters when the pool is configured with `autoCommit` false, because then
the pool's own housekeeping statements would otherwise start a transaction on the
session and leave it open for the next borrower. It defaults to false because the
default `autoCommit` is true, in which case there is nothing to isolate.

---

← Prev: [6b · Finding and preventing leaks](06b-finding-and-preventing-leaks.md) · Index: [Connection pooling with HikariCP](README.md) · Next → [7b · What SQL leaves behind](07b-what-sql-leaves-behind.md)
