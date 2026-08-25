---
title: "Anything that should be true for every query is set once when the connection is made — and the strongest place to set it is the database, not the application"
sidebar_label: "7d · Connection-level defaults"
sidebar_position: 21
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the PostgreSQL 18 documentation for `ALTER ROLE`,
> `ALTER DATABASE` and `SET` ([postgresql.org/docs/18/](https://www.postgresql.org/docs/18/)),
> the pgjdbc connection-parameter reference (`options`)
> ([jdbc.postgresql.org/documentation/use/](https://jdbc.postgresql.org/documentation/use/)),
> the HikariCP 7.0.2 README (`connectionInitSql`, `schema`, `catalog`,
> `transactionIsolation`)
> ([github.com/brettwooldridge/HikariCP](https://github.com/brettwooldridge/HikariCP)),
> and the Spring Framework 7.0 reference for `@Transactional`
> ([docs.spring.io/spring-framework/reference/7.0/data-access/transaction.html](https://docs.spring.io/spring-framework/reference/7.0/data-access/transaction.html)).
> JDK 25, HikariCP 7.0.2, pgjdbc 42.7.13, PostgreSQL 18, Spring Boot 4.1.0.

**[Chunk 7c](07c-scoping-state-correctly.md) put per-request state inside a
transaction. This chunk covers the other safe place: settings that should hold
for *everything* a pool does. Set those once, when the connection is created, and
never touch them again — then there is nothing to leak, because nothing ever
changes. The interesting question is *where* to set them, and the answers are
ranked, with the best one furthest from your code.**

## Three places, in increasing order of strength

| Mechanism | Where it lives | Applies to |
|---|---|---|
| `connectionInitSql` | HikariCP config | every connection **this pool** creates |
| pgjdbc `options` property | the JDBC URL or data-source properties | every connection using that URL |
| `ALTER ROLE ... SET` | 🔴 **the database** | every login by that role, from anywhere |

### `connectionInitSql`

Runs once on each newly created connection, before it is put into the pool.

```yaml
spring:
  datasource:
    hikari:
      connection-init-sql: "SET application_name = 'shop-oltp'"
```

⚠️ **It runs once per connection *creation*, not per borrow.** That is roughly
once per `maxLifetime` per pool slot — so on a four-minute lifetime with a pool of
six, about ninety times an hour, not once per request. It is not a reset
mechanism, and using it as one means the SQL runs far less often than the code
implies.

### The pgjdbc `options` property

`options` is passed to the server as a command line at connect time, so every
setting in it becomes a session default:

```yaml
spring:
  datasource:
    hikari:
      data-source-properties:
        options: "-c statement_timeout=5000 -c lock_timeout=2000"
```

⚠️ **The syntax is a server command line, not a list.** Each setting needs its own
`-c`, and the whole thing is one space-separated string. A malformed value either
fails the connection or is silently ignored, so verify it once after a deploy with
`SELECT current_setting('statement_timeout')`.

### `ALTER ROLE ... SET`

```sql
ALTER ROLE shop_app     SET statement_timeout = '5s';
ALTER ROLE shop_app     SET lock_timeout      = '2s';
ALTER ROLE shop_app     SET idle_in_transaction_session_timeout = '30s';
ALTER ROLE shop_reports SET statement_timeout = '120s';
```

🔴 **This is the strongest of the three, and it is not close.** It is enforced at
login, so it applies to every connection by that role — your application, a
migration runner, a `psql` session, a BI tool — regardless of what any
configuration file says. It survives every deployment. It cannot be omitted by a
service that forgot to copy a configuration block, and it cannot be undone by a
change to a YAML file.

It also composes with the per-role `CONNECTION LIMIT` from
[chunk 3c](03c-the-server-side-ceiling.md): **one role per workload**, carrying
both that workload's capacity budget and its timeouts, expressed in one place a
DBA can read.

⚠️ `ALTER DATABASE ... SET` exists too and applies to every role connecting to
that database. Prefer the role, since the whole value of the pattern is that
different workloads get different settings.

## What HikariCP will set for you

Three of the six tracked properties double as connection-level defaults, and
using them is better than any of the above, because the pool then also *restores*
them on every return ([chunk 7](07-session-state.md)):

```yaml
spring:
  datasource:
    hikari:
      schema: app
      transaction-isolation: TRANSACTION_READ_COMMITTED
      read-only: false
```

Set here, the value is applied at connection creation *and* is the value
`resetConnectionState()` restores if any borrower changes it. That is strictly
stronger than a `connectionInitSql` doing the same thing.

## When the connection itself must be separate

Two cases where no amount of scoping helps:

- **`LISTEN` / `NOTIFY`.** A subscription is a long-lived session concern, and a
  pooled connection is neither long-lived nor yours: it can be retired by
  `maxLifetime` at any moment ([chunk 4b](04b-maxlifetime-and-keepalive.md)), and
  between notifications it belongs to other requests. Open a dedicated connection
  outside the pool, hold it for the life of the application, and reconnect it on
  failure. It is also the feature a transaction-mode pooler breaks outright
  ([chunk 8e](08e-pgbouncer-in-front.md)).
- **A workload with genuinely different settings** — different timeouts, a
  different `work_mem`, a different isolation level. That is a second pool with
  its own role ([chunk 3e](03e-two-pools-not-one-bigger.md)), which is cleaner
  than setting and unsetting on every borrow, and it comes with its own
  connection budget for free.

## The decision table

| You want to… | Do this | Not this |
|---|---|---|
| pick a schema per tenant | `connection.setSchema()`, or qualified names | `SET search_path` |
| raise a timeout for one query | `SET LOCAL` inside a transaction | `SET statement_timeout` |
| set a default timeout for a service | `ALTER ROLE ... SET` | a `SET` on each borrow |
| take a named lock | `pg_advisory_xact_lock()` | `pg_advisory_lock()` |
| skip a job another instance is running | `pg_try_advisory_xact_lock()` | a session-level lock |
| stage rows in a temp table | `CREATE TEMP TABLE ... ON COMMIT DROP` | a plain temp table |
| get the id of a row you inserted | `INSERT ... RETURNING id` | `currval()` |
| change isolation | `@Transactional(isolation = ...)` | `SET SESSION CHARACTERISTICS` |
| fix the schema for a whole pool | HikariCP's `schema` property | `connectionInitSql` |
| subscribe to notifications | a dedicated connection | `LISTEN` on a pooled one |

Read down the right-hand column and every entry is session-scoped. Read down the
middle and every entry is transaction-scoped, connection-scoped, or one of the
pool's six tracked bits. Spring's `@Transactional` attributes land in the middle
column too, which [chunk 7c](07c-scoping-state-correctly.md) explains.

## The trade-off

Pushing settings into the database makes them correct and makes them invisible.
An engineer reading the service's configuration will not find the five-second
statement timeout that is killing their new report, because it lives in a
migration applied two years ago. That is a real cost, paid in confusion rather
than in bugs, and the mitigation is documentation plus a startup log line that
reads the effective values back. The alternative — settings in each application's
configuration — is discoverable and unreliable, and unreliable is worse.

## Gotchas

**⚠️ Using `connectionInitSql` as a per-request reset**
**Symptom:** the setting is right for the first query on a connection and wrong
later.
**Cause:** it runs at connection creation, roughly once per `maxLifetime`.
**Fix:** `SET LOCAL` for per-request scope; `connectionInitSql` only for what
should hold for the connection's whole life.

**⚠️ `options` with the wrong syntax**
**Symptom:** the connection fails, or the setting is silently absent.
**Cause:** the value is a server command line — each setting needs its own `-c`,
in one space-separated string.
**Fix:** verify with `SELECT current_setting(...)` once after a deploy rather
than trusting the file.

**⚠️ `ALTER ROLE ... SET` not in the migrations**
**Symptom:** it works in production and not in a rebuilt environment.
**Cause:** it is database state, and database state outside version control does
not exist.
**Fix:** put it in a Flyway migration alongside the role's `CONNECTION LIMIT`.

**⚠️ Using `ALTER DATABASE ... SET` instead of the role**
**Symptom:** the reports workload inherits the request path's five-second
timeout.
**Cause:** the database-level setting applies to every role.
**Fix:** set it per role; that is the granularity the workloads actually differ
at.

**⚠️ `connectionInitSql` for something HikariCP already tracks**
**Symptom:** the schema is correct on a fresh connection and wrong after a
borrower changes it.
**Cause:** `connectionInitSql` applies once; the `schema` property applies once
*and* is restored on every return.
**Fix:** use the pool's own property when one exists.

**⚠️ `LISTEN` on a pooled connection**
**Symptom:** notifications are missed after a while, or arrive on code that has
no idea what they are.
**Cause:** the connection is retired by `maxLifetime` and belongs to other
requests in between.
**Fix:** a dedicated connection outside the pool, with its own reconnect logic.

**⚠️ Settings split across all three mechanisms**
**Symptom:** nobody can say what `statement_timeout` will be for a given query.
**Cause:** a role default, an `options` string and a `connectionInitSql` all
setting the same parameter, with the last one applied winning.
**Fix:** pick one home per parameter and write it down. Read the effective value
back at startup if it matters.

## Interview questions

**★ Where should a service's default `statement_timeout` live?**
On the database role, set with `ALTER ROLE ... SET`, and committed as a
migration. It is applied at login, so it covers every connection made by that
role — the application, the migration runner, a psql session, a reporting tool —
and it cannot be forgotten by a service that did not copy a configuration block
or undone by an edit to a YAML file. It also composes with a per-role
`CONNECTION LIMIT`, so one role expresses both a workload's capacity budget and
its timeouts in a place a DBA can read. The application-side alternatives work,
but they are opt-in, and opt-in safety is the kind that is missing on the one
service that needed it.

**★ What is `connectionInitSql` for, and what is it not for?**
It is for something that should be true for a connection's entire life and cannot
be expressed at the role or URL level — setting an extension-specific parameter,
for instance. It runs once when a connection is created, which is roughly once
per `maxLifetime` per pool slot, so it is cheap. It is *not* a per-borrow reset,
and treating it as one is a common mistake: the SQL runs orders of magnitude less
often than the code reads as implying, and between runs the connection is in
whatever state the previous borrower left it.

**★ HikariCP has `schema`, `transactionIsolation` and `readOnly` properties. Why prefer them?**
Because they are the three connection-level defaults that HikariCP also *tracks*.
Setting them on the pool means the value is applied when a connection is created
and is also the value `resetConnectionState()` restores if a borrower changes it
— so they are protected on both ends. The equivalent expressed as
`connectionInitSql` is applied once and never restored, so a single borrower
calling `setSchema()` changes it for everyone afterwards. Where the pool has a
property for something, that property is strictly stronger than the SQL.

**★ Why can `LISTEN` not live on a pooled connection?**
Because a subscription assumes a session it owns and keeps, and a pooled
connection is neither. The connection can be retired at any moment by
`maxLifetime` or by a failed keepalive, taking the subscription with it silently;
between notifications the connection belongs to other requests, which may
themselves be affected by the buffered notifications; and nothing in the pool
reconnects a subscription. The workable pattern is a dedicated connection created
outside the pool, held for the application's life, with its own reconnect and
resubscribe logic. It is also the first thing to break if a transaction-mode
pooler is ever put in front of the database.

**★ What is the downside of putting settings in the database?**
Discoverability. An engineer reading the service's repository will not find the
five-second statement timeout that is killing their new report, because it lives
in a migration applied two years ago and nothing in the application mentions it.
That is a genuine cost, and it is paid in wasted debugging time rather than in
incidents. The mitigation is to log the effective values at startup — a query for
`current_setting` on the parameters that matter — so the running service can
answer the question even when the repository cannot.

**★ How would you decide between the three mechanisms for a new setting?**
Ask who else should be subject to it. If the answer is "everyone connecting as
this role", it belongs on the role. If it is "everyone using this connection
string", the `options` property is reasonable, though the role is usually still
better. If it is "only this pool, and there is no role or URL expression for it",
`connectionInitSql`. And if HikariCP has a property for it — schema, isolation,
read-only — use that instead of all three, because it is the only option that
also restores the value on return.

---

← Prev: [7c · Scoping state correctly](07c-scoping-state-correctly.md) · Index: [Connection pooling with HikariCP](README.md) · Next → [8 · Starting up, or failing fast](08-starting-up-or-failing-fast.md)
