---
title: "Nothing you set with SQL is ever reset, so one request's session settings become another request's environment"
sidebar_label: "7b · What SQL leaves behind"
sidebar_position: 19
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the HikariCP 7.0.2 source
> (`pool/PoolBase.java` `resetConnectionState()`, read at tag `HikariCP-7.0.2`)
> ([github.com/brettwooldridge/HikariCP](https://github.com/brettwooldridge/HikariCP))
> and the PostgreSQL 18 documentation for `SET`, `CREATE TABLE` (temporary
> tables), advisory-lock functions, `LISTEN`, `PREPARE`, `DECLARE`, and the
> error-code appendix
> ([postgresql.org/docs/18/](https://www.postgresql.org/docs/18/)).
> JDK 25, HikariCP 7.0.2, pgjdbc 42.7.13, PostgreSQL 18.

**[Chunk 7](07-session-state.md) established that HikariCP resets six JDBC
properties. Here is the complement, and it is the sentence to remember from this
whole topic: **anything you change by executing SQL is not reset at all.** The
pool cannot see it. The next request to borrow that connection inherits it. Since
that next request belongs to a different user, on a different endpoint, minutes
later, the resulting bugs are non-deterministic, unreproducible locally, and
occasionally a security incident.**

## The catalogue

| What you executed | Scope | What the next borrower gets |
|---|---|---|
| `SET search_path TO tenant_a` | session | 🔴 queries resolving to **another tenant's tables** |
| `SET ROLE reporting` / `SET SESSION AUTHORIZATION` | session | 🔴 **someone else's privileges** |
| `SET TIME ZONE 'America/New_York'` | session | timestamps interpreted in the wrong zone |
| `SET statement_timeout = 0` | session | 🔴 **no query timeout**, forever |
| `SET lock_timeout` / `SET idle_in_transaction_session_timeout` | session | the same, for locks and idle transactions |
| `SET work_mem = '512MB'` | session | every later sort on that connection takes the memory |
| `SET SESSION CHARACTERISTICS AS TRANSACTION ISOLATION LEVEL SERIALIZABLE` | session | 🔴 a different isolation level, **untracked** by the ISOLATION bit |
| `CREATE TEMP TABLE staging (...)` | session | the table still exists — the next `CREATE TEMP TABLE staging` fails with `42P07` |
| `SELECT pg_advisory_lock(42)` | session | 🔴 the lock is **still held**, by nobody |
| `LISTEN order_events` | session | notifications keep arriving on a connection nothing is reading |
| `PREPARE find_order AS ...` | session | the next `PREPARE find_order` fails with `42P05` |
| `DECLARE c CURSOR WITH HOLD FOR ...` | session, survives commit | an open cursor holding resources |
| `SELECT nextval('order_id_seq')` | session | 🔴 a later `currval()` returns **your** value instead of erroring |

Every row is the same mechanism: PostgreSQL scopes it to the *session*, the pool
recycles the *session*, and HikariCP's six bits do not cover it.

## The two worst ones

### `SET search_path` — cross-tenant data exposure

Schema-per-tenant is a common design, and the natural implementation is to set
the search path at the start of each request:

```java
try (var c = dataSource.getConnection();
     var st = c.createStatement()) {
    st.execute("SET search_path TO " + tenantSchema);   // ⛔ never reset
    ...
}
```

The connection returns to the pool with `search_path` still pointing at that
tenant. The next request borrows it, does *not* set the search path — because it
is a different code path, or the tenant is the same as the pool default, or an
exception skipped the setter — and its unqualified `SELECT * FROM orders`
resolves against the previous tenant's schema. No error, correct-looking rows,
wrong customer.

🔴 **[Chunk 7](07-session-state.md) showed the cruel part:**
`connection.setSchema("tenant_a")` does *exactly the same thing on the server* —
pgjdbc implements it as `SET SESSION search_path TO '<schema>'` — but goes
through the JDBC API, so HikariCP tracks it and restores the pool's value on
return. **Same server state, opposite safety, decided entirely by which line you
wrote.**

### Advisory locks — a lock held by nobody

```sql
SELECT pg_advisory_lock(hashtext('nightly-rollup'));
```

Session-level advisory locks are held until explicitly unlocked or the session
ends. If the code that took one throws before its `pg_advisory_unlock`, the lock
survives the connection's return to the pool — and the connection may then live
for hours ([chunk 4b](04b-maxlifetime-and-keepalive.md)).

⛔ **What makes it vicious is that nothing owns it.** No transaction is open, no
query is running, the connection looks perfectly idle in `pg_stat_activity`, and
every future attempt to take that lock blocks forever. Restarting the application
fixes it, which is how it gets diagnosed as "a weird glitch".

## The quieter ones

**`SET statement_timeout = 0`.** A batch job raises its own timeout to run a long
migration, and every subsequent request on that connection has no statement
timeout — so the one protection against a runaway query is silently removed for
a random subset of the pool.

**`SET TIME ZONE`.** A report needs local time, sets the zone, and later requests
on that connection read and write `timestamptz` values in that zone. The values
are not corrupted — `timestamptz` stores an instant
([topic 01 chunk 14](../01-jdbc/14-dates-times-and-timestamptz.md)) — but
rendering and any `date_trunc('day', ...)` shift, so daily aggregates come out
wrong for some rows and right for others.

**Temp tables.** A job creates `CREATE TEMP TABLE staging`, finishes, and returns
the connection. The next run of the same job on the same connection fails with
`42P07 duplicate_table`. It works nine times out of ten, which is the worst
possible failure rate.

**Session-level `PREPARE`.** Same shape — the second `PREPARE` of the same name
fails with `42P05 duplicate_prepared_statement`. Note this is *not* what a JDBC
`PreparedStatement` does; pgjdbc manages server-side prepared statements per
connection under its own generated names
([topic 01 chunk 9](../01-jdbc/09-server-side-prepared-statements.md)).

**`currval()`.** It errors only if `nextval()` has not been called *in this
session*. On a pooled connection, another request's `nextval()` satisfies that
condition — so `currval()` returns a value belonging to somebody else's insert
instead of failing. A bug that turns an error into a wrong answer is strictly
worse than one that crashes.

## Why the pool cannot help

HikariCP sees JDBC method calls. `statement.execute("SET ...")` is, from the
proxy's point of view, an opaque string being sent to the database — it would
have to parse SQL to know what it did, and even then it could not know how to
undo an arbitrary `SET`. The alternative is what PgBouncer does in session mode:
issue a blanket `DISCARD ALL` on every release ([chunk 8e](08e-pgbouncer-in-front.md)).
That is correct and costs a round trip on every single return, which is precisely
the cost HikariCP's six-bit design exists to avoid.

⚠️ **So this is not a HikariCP defect to be fixed.** It is the boundary of what a
client-side pool can know, and the responsibility sits with the code that issues
the SQL. [Chunk 7c](07c-scoping-state-correctly.md) is how to discharge it.

## The trade-off

The whole hazard is the price of connection reuse. A connection-per-request model
would have none of these problems and would pay a TCP handshake, a TLS handshake,
an authentication exchange and a forked backend for every request
([chunk 1](01-what-the-pool-hands-you.md)) — orders of magnitude more expensive
than the bugs are likely. Pooling is the right choice; the session leakage is a
known, bounded consequence of it, and every item in the catalogue above has a
mechanical fix.

## Gotchas

**⚠️ `SET search_path` per request for multi-tenancy**
**Symptom:** occasional cross-tenant data, usually noticed by a customer.
**Cause:** the setting is session-scoped and never reset.
**Fix:** `connection.setSchema()`, which HikariCP tracks — or fully qualified
table names, or a pool per tenant.

**⚠️ `SET ROLE` for privilege scoping**
**Symptom:** a request runs with elevated privileges it never asked for.
**Cause:** the role change survives the return to the pool.
**Fix:** transaction-scoped scoping, or a separate `DataSource` per role.

**⚠️ Session-level advisory locks**
**Symptom:** a scheduled job stops running and the connection looks idle.
**Cause:** the lock is held by a session nobody is using, and `maxLifetime` may
be hours away.
**Fix:** `pg_advisory_xact_lock()`, released automatically at the end of the
transaction.

**⚠️ Raising `statement_timeout` for one slow job**
**Symptom:** unrelated endpoints lose their query timeout at random.
**Cause:** the change lands on one pooled connection and stays there.
**Fix:** `SET LOCAL` inside a transaction, or a dedicated pool for the job.

**⚠️ `CREATE TEMP TABLE` without `ON COMMIT DROP`**
**Symptom:** `42P07 duplicate_table` on roughly one run in ten.
**Cause:** the table survives on whichever connection created it.
**Fix:** `ON COMMIT DROP`, or `CREATE TEMP TABLE IF NOT EXISTS` plus an explicit
`TRUNCATE` — the first is better, since stale rows are their own bug.

**⚠️ `LISTEN` on a pooled connection**
**Symptom:** notifications are missed, duplicated, or delivered to code that has
no idea what they are.
**Cause:** `LISTEN` is a long-lived session subscription; a pooled connection is
not long-lived and is not yours.
**Fix:** a dedicated connection outside the pool for `LISTEN/NOTIFY`.

**⚠️ Relying on `currval()`**
**Symptom:** an object is linked to the wrong parent row, occasionally.
**Cause:** the "not yet defined in this session" guard is satisfied by another
request's `nextval()`.
**Fix:** `INSERT ... RETURNING id`, or JDBC generated keys
([topic 01 chunk 20](../01-jdbc/20-generated-keys.md)).

**⚠️ Testing session leakage with a pool of one**
**Symptom:** everything reproduces perfectly, and the fix appears to work
because the connection is always the same one.
**Cause:** a pool of one hides the *randomness*, which is the defining property
of the bug.
**Fix:** reproduce with a realistic pool size and concurrency, and reason about
the mechanism rather than trusting a green test.

**⚠️ Concluding that HikariCP should reset more**
**Symptom:** an issue report, or a homemade wrapper that runs `DISCARD ALL`.
**Cause:** the reset boundary looks arbitrary until you see the cost.
**Fix:** it is a deliberate trade. If you genuinely want a blanket reset on every
return, that is a pooler's job, not the client pool's
([chunk 8e](08e-pgbouncer-in-front.md)).

## Interview questions

**★ What does a pooled connection carry over from the previous borrower?**
Everything that PostgreSQL scopes to the session and that was not set through one
of the six JDBC setters HikariCP tracks. That means every `SET` — search path,
time zone, statement and lock timeouts, `work_mem`, role, session-level
transaction characteristics — plus temporary tables, session-level advisory
locks, `LISTEN` subscriptions, session-level prepared statements, `WITH HOLD`
cursors and the session's sequence state for `currval()`. The pool resets six
properties; the session has a great deal more state than that, and none of the
rest is touched.

**★ Why can the pool not reset it?**
Because it only sees JDBC method calls. A `statement.execute("SET ...")` is an
opaque string as far as the proxy is concerned — the pool would have to parse SQL
to know what happened, and would then have to know how to undo arbitrary session
changes. The only way to be thorough is a blanket reset like `DISCARD ALL` on
every return, which is exactly what PgBouncer does in session mode and which
costs a server round trip per release. HikariCP's six-bit design is the opposite
trade: usually zero cost, and a documented boundary.

**★ Give the most dangerous concrete example.**
`SET search_path` for schema-per-tenant multi-tenancy. The connection goes back
to the pool still pointing at one tenant's schema, and the next request that does
not set the path — because it is a different code path, or an exception skipped
the setter — runs its unqualified queries against that tenant's tables. There is
no error and the rows look correct; it is simply the wrong customer's data. The
detail that makes it memorable is that `connection.setSchema()` performs the
identical `SET SESSION search_path` on the server and *is* reset, because it goes
through the JDBC API. Same effect, opposite safety.

**★ Why are session-level advisory locks such a bad fit for a pool?**
Because they outlive everything that would normally clean up. They are not tied
to a transaction, so a rollback does not release them; the connection returns to
the pool still holding the lock; the session looks completely idle in
`pg_stat_activity`, so nothing about it looks wrong; and the connection may live
for hours before `maxLifetime` retires it. Every subsequent attempt to acquire
that lock blocks. The transaction-scoped variant, `pg_advisory_xact_lock`, is
released automatically at the end of the transaction and has none of these
properties — which is why it should be the default choice on any pooled
connection.

**★ How would `currval()` produce a wrong answer rather than an error?**
`currval` is documented to error if `nextval` has not been called for that
sequence in the current session. On a pooled connection the "current session" is
shared over time with other requests, so somebody else's `nextval` satisfies the
precondition and `currval` cheerfully returns their value. The guard that was
supposed to make misuse loud is defeated by connection reuse, and the failure
converts from an exception into a silently mis-linked row. `INSERT ... RETURNING`
avoids the whole class.

**★ Why does this class of bug never reproduce locally?**
Because it needs two things a local run does not have: a pool large enough that
which connection you get is effectively random, and a second, unrelated request
arriving afterwards on the same connection. With a pool of one, the same
connection is always returned, so the polluted state is either always present or
always absent — deterministic either way, and therefore not the bug. With low
concurrency there is no unrelated second request. That is why these are reasoned
about from the mechanism rather than found by testing.

**★ Is this a flaw in HikariCP?**
No, it is the boundary of what a client-side pool can know, and HikariCP is
explicit about it in the code: `resetConnectionState` restores exactly the
properties it tracked. A pool that guaranteed a clean session would have to issue
a blanket reset on every return, adding a round trip to an operation that is
otherwise pure in-process work — a real cost paid by every application, to
protect against a pattern the application controls. The responsibility properly
belongs to the code issuing the SQL, and every item in the catalogue has a
transaction-scoped or connection-level alternative.

---

← Prev: [7 · Session state](07-session-state.md) · Index: [Connection pooling with HikariCP](README.md) · Next → [7c · Scoping state correctly](07c-scoping-state-correctly.md)
