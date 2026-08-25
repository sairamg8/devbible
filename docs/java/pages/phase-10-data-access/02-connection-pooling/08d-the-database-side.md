---
title: "The pool's own numbers and pg_stat_activity should agree, and the two ways they can disagree are both diagnoses"
sidebar_label: "8d · The database side"
sidebar_position: 25
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the PostgreSQL 18 documentation for `pg_stat_activity`
> and `pg_terminate_backend`
> ([postgresql.org/docs/18/monitoring-stats.html](https://www.postgresql.org/docs/18/monitoring-stats.html)),
> the pgjdbc connection-parameter reference (`ApplicationName`)
> ([jdbc.postgresql.org/documentation/use/](https://jdbc.postgresql.org/documentation/use/)),
> the HikariCP wiki *MBean (JMX) Monitoring* and the 7.0.2 source
> (`HikariPoolMXBean`, `HikariConfigMXBean`)
> ([github.com/brettwooldridge/HikariCP](https://github.com/brettwooldridge/HikariCP)).
> JDK 25, HikariCP 7.0.2, PostgreSQL 18, pgjdbc 42.7.13.

**[Chunk 8c](08c-watching-the-pool.md) watched the pool from inside the JVM. This
chunk watches the same connections from the database's side, where they are
backend processes rather than pool entries. Two things are visible there that the
pool cannot see at all: who *else* is using your connection budget, and whether a
connection is sitting inside an open transaction.**

## Making the pool visible in `pg_stat_activity`

A pool you cannot attribute is a pool you cannot budget. pgjdbc sends
`ApplicationName` at connect time:

```yaml
spring:
  datasource:
    hikari:
      pool-name: shop-reports
      data-source-properties:
        ApplicationName: shop-reports
```

```sql
SELECT application_name, state, count(*)
FROM   pg_stat_activity
WHERE  datname = 'shop'
GROUP  BY 1, 2
ORDER  BY 3 DESC;
```

That answers "which pool is holding the connections" directly. Without it, every
backend from the service is indistinguishable and the finest attribution
available is the database role — which is one more reason for
[chunk 3e's](03e-two-pools-not-one-bigger.md) role-per-pool advice, and why
`pool-name` and `ApplicationName` should be set together and set the same.

⚠️ **Set them identically.** The pool name appears in HikariCP's log lines, in its
timeout exception ([chunk 5](05-connection-is-not-available.md)) and as the tag on
every metric; `application_name` appears in `pg_stat_activity` and in the server
log. When they match, one string joins the two halves of an investigation.

## The cross-check, and its two failure modes

🔴 **The sum of `hikaricp.connections` across the fleet should match the count in
`pg_stat_activity` for that role.** When it does not, the direction of the
mismatch is the diagnosis:

| Mismatch | What it means |
|---|---|
| **more on the server** than in the pools | something else is connecting with that role — another service, a batch job, a reporting tool, an engineer's session. Your connection budget ([chunk 3d](03d-the-fleet-budget.md)) is wrong |
| **fewer on the server** than in the pools | 🔴 something between you and the database is **multiplexing** — there is a pooler in the path ([chunk 8e](08e-pgbouncer-in-front.md)), and half the settings in this topic are not doing what you think |

That second row is worth taking seriously. A transaction-mode pooler changes what
a "connection" *is*: `maxLifetime` no longer governs a real backend's lifetime,
`SET` statements behave differently, and session-scoped features stop working.
Discovering it from a metrics mismatch is a much better way to find out than
discovering it from a bug.

## `state` matters as much as the count

```sql
SELECT state, count(*), max(now() - state_change) AS longest
FROM   pg_stat_activity
WHERE  datname = 'shop' AND backend_type = 'client backend'
GROUP  BY state;
```

| `state` | What it means for a pooled connection |
|---|---|
| `idle` | normal — a connection sitting in the pool |
| `active` | running a query |
| 🔴 `idle in transaction` | a transaction is open and nothing is running — **an application bug** |
| `idle in transaction (aborted)` | worse: a statement failed and nobody rolled back |

⛔ **`idle in transaction` is invisible in the pool's metrics.** From HikariCP's
point of view the connection is simply in use, so `active` looks normal and
nothing alerts. Meanwhile the session holds every lock it took and pins the
vacuum horizon, so dead rows accumulate across the whole database.

The usual cause is a transaction opened and then left while the thread went off
to do something slow — an HTTP call inside `@Transactional`. The defence is
`idle_in_transaction_session_timeout` on the role
([chunk 7d](07d-connection-level-defaults.md)), which turns a silent, spreading
problem into a loud, local one.

⚠️ `pg_stat_activity` also carries `backend_start`, `xact_start`, `query_start`,
`state_change`, `wait_event_type` and `wait_event`. `now() - backend_start` is a
direct check on whether `maxLifetime` is doing what you configured
([chunk 4b](04b-maxlifetime-and-keepalive.md)) — if backends are hours old on a
four-minute setting, something is wrong with the setting rather than with the
theory.

## The server-side emergency lever

When the database is at its ceiling and you cannot deploy
([chunk 3c](03c-the-server-side-ceiling.md)), `pg_terminate_backend` is the one
control you have from the database side:

```sql
SELECT pg_terminate_backend(pid)
FROM   pg_stat_activity
WHERE  datname = 'shop'
  AND  state = 'idle'
  AND  state_change < now() - interval '10 minutes';
```

⚠️ **The application will see this as a connection error**, because it is one — the
pool discovers the connection is dead on the next borrow or keepalive
([chunk 4c](04c-keepalive-and-the-reapers.md)) and replaces it. Terminating
`idle` backends is comparatively safe; terminating `active` ones aborts real work.

## The trade-off

Everything on this page requires access to the database, which in most
organisations means a different team, different credentials and a different tool
from the one showing the application's dashboards. That friction is why the pool
metrics get looked at and `pg_stat_activity` does not — and why the two numbers
drift apart unnoticed for months. The mitigation is unglamorous: export the
connection count and state breakdown as metrics alongside the pool's own, so the
cross-check is a panel rather than an expedition.

## Gotchas

**⚠️ `pg_stat_activity` count not matching the pools**
**Symptom:** the numbers disagree and nobody investigates.
**Cause:** either another consumer of the same role, or a pooler multiplexing in
between.
**Fix:** both answers matter, and they have completely different consequences.
Reconcile once, deliberately.

**⚠️ Ignoring `idle in transaction`**
**Symptom:** locks held, vacuum blocked, table bloat, and nothing visible in the
pool's metrics.
**Cause:** the connection is legitimately "in use" from HikariCP's perspective.
**Fix:** watch `pg_stat_activity.state` and set
`idle_in_transaction_session_timeout` on the role.

**⚠️ No `ApplicationName`, so nothing can be attributed**
**Symptom:** the server is at its ceiling and nobody can say which pool did it.
**Cause:** the default `application_name` on a JDBC connection identifies the
driver, not your pool.
**Fix:** set it per pool, matching `pool-name`, and use a role per workload as
well.

**⚠️ `pool-name` and `ApplicationName` set to different strings**
**Symptom:** two halves of an investigation that cannot be joined.
**Cause:** they are configured in different places and nothing enforces
agreement.
**Fix:** same string, set together.

**⚠️ `pg_terminate_backend` on `active` sessions**
**Symptom:** aborted transactions and user-visible errors during an incident.
**Cause:** the filter did not restrict to `idle`.
**Fix:** filter on `state = 'idle'` and an age, and be deliberate about it.

**⚠️ Backends far older than `maxLifetime`**
**Symptom:** `now() - backend_start` in hours on a four-minute setting.
**Cause:** either the setting was silently corrected
([chunk 4e](04e-when-a-clock-is-silently-disabled.md)), or a pooler in between
means these are not your application's connections at all.
**Fix:** check the effective configuration first, then look for the pooler.

## Interview questions

**★ How do you attribute connections on the database side?**
Set `ApplicationName` in the data-source properties, per pool, matching the
`pool-name`. pgjdbc sends it at connect time and it lands in
`pg_stat_activity.application_name`, so one `GROUP BY` tells you which pool holds
how many connections and in what state. Without it, every backend from the
service is indistinguishable and the finest attribution available is the database
role. It costs one line of configuration and it is the difference between "the
service has sixty connections open" and "the reports pool has fifty-four, all
idle in transaction".

**★ The pool metrics and `pg_stat_activity` disagree. What does that mean?**
It depends on the direction, and both directions are informative. More backends
on the server than the pools account for means something else is connecting with
that role — another service, a batch job, a reporting tool, an engineer's session
— so your connection budget is wrong and the fleet arithmetic needs redoing.
Fewer backends than the pools hold means something in between is multiplexing,
which almost certainly means a connection pooler sits in the path. That second
one matters a great deal, because a transaction-mode pooler changes what a
connection actually is, and a number of assumptions in the pool's configuration
stop holding.

**★ Why does `idle in transaction` deserve its own alert?**
Because it is a real pathology that is completely invisible from the application
side. HikariCP considers the connection "in use" — it was borrowed and not
returned — so `active` looks perfectly normal and nothing in the pool's metrics
moves. On the server, that session is holding every lock it acquired and pinning
the vacuum horizon, so dead rows stop being cleaned up across the whole database
and tables bloat. The usual cause is an HTTP call or other slow work inside a
`@Transactional` method. `idle_in_transaction_session_timeout` on the role turns
it from a silent, spreading problem into a loud, local exception.

**★ The database is at `max_connections` right now. What can you do from the database side?**
Terminate idle backends with `pg_terminate_backend`, filtered on `state = 'idle'`
and an age, to free slots without aborting real work. It is a genuine lever
precisely because `max_connections` cannot be raised without a restart. The
application experiences it as a connection error, which is correct — the pool
finds the connection dead on the next borrow or keepalive and replaces it. What
you must not do casually is terminate `active` backends, which aborts
transactions users are waiting on and converts a capacity problem into a
correctness-looking one.

**★ How would you verify `maxLifetime` is actually working?**
Look at `now() - backend_start` in `pg_stat_activity` for that application name.
Connection ages should sit below the configured `maxLifetime`, spread out rather
than clustered, because of the deliberate downward jitter
([chunk 4b](04b-maxlifetime-and-keepalive.md)). Backends hours older than the
setting mean one of two things: the value was silently corrected at startup —
below the 30-second floor it is reset to thirty minutes — or there is a pooler
between you and the database, so those backends are not your application's
connections at all and your pool's clocks govern nothing that appears in that
view.

**★ Why do teams look at pool metrics and not at `pg_stat_activity`?**
Friction. The pool's metrics arrive in the same dashboard as everything else the
application emits; `pg_stat_activity` needs database access, which usually means
different credentials, a different tool and often a different team. So the
cross-check that would catch a wrong connection budget or an unexpected pooler is
the one nobody runs, and the two views drift apart unnoticed. The fix is
unglamorous: export the connection count and state breakdown as metrics next to
the pool's own, so the comparison is a panel rather than an expedition.

---

← Prev: [8c · Watching the pool](08c-watching-the-pool.md) · Index: [Connection pooling with HikariCP](README.md) · Next → [8e · PgBouncer in front](08e-pgbouncer-in-front.md)
