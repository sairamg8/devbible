---
title: "Behind a pooler, half your HikariCP settings stop meaning what they meant, and the queue you need to watch is the one your metrics cannot see"
sidebar_label: "8f · Operating two layers"
sidebar_position: 27
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the PgBouncer configuration reference
> (`max_client_conn`, `default_pool_size`, `server_lifetime`, `server_idle_timeout`,
> `query_wait_timeout`, the `SHOW` admin commands)
> ([pgbouncer.org/config.html](https://www.pgbouncer.org/config.html),
> [pgbouncer.org/usage.html](https://www.pgbouncer.org/usage.html)), the HikariCP
> 7.0.2 README
> ([github.com/brettwooldridge/HikariCP](https://github.com/brettwooldridge/HikariCP))
> and the PostgreSQL 18 documentation
> ([postgresql.org/docs/18/](https://www.postgresql.org/docs/18/)).
> JDK 25, HikariCP 7.0.2, PostgreSQL 18, pgjdbc 42.7.13.

**[Chunk 8e](08e-pgbouncer-in-front.md) covered what transaction mode does to your
application's semantics. This chunk covers what it does to everything you
configured in chunks 3 to 8 — because a pooler does not sit alongside your
connection pool, it sits *underneath* it, and several settings quietly start
governing a different thing.**

## What your HikariCP settings mean behind a pooler

⚠️ **Several of them stop meaning what they did:**

- 🔴 **`maxLifetime`** now bounds the life of a connection to *PgBouncer*, not to
  a PostgreSQL backend. The backend's lifetime is PgBouncer's own
  `server_lifetime`, and its idle retirement is `server_idle_timeout`. The
  infrastructure-reaper argument from
  [chunk 4b](04b-maxlifetime-and-keepalive.md) still applies to the client hop —
  there may well be a load balancer between your pod and PgBouncer — but "retire
  the connection before the database kills it" is now somebody else's setting.
- **Connection creation is cheap**, because it connects to PgBouncer rather than
  causing a backend to be forked. The "`connectionTimeout` must exceed the
  handshake" concern from [chunk 4](04-the-six-clocks.md) relaxes considerably,
  and so does the cost of an elastic pool
  ([chunk 4d](04d-idletimeout-and-minimumidle.md)) — shrinking and regrowing is
  no longer expensive.
- **`maximumPoolSize` x instances** is now budgeted against `max_client_conn`
  rather than `max_connections`. [Chunk 3d's](03d-the-fleet-budget.md) division
  still happens; the numerator is just much larger.
- **`keepaliveTime`** pings PgBouncer, which answers from its own side. It keeps
  the *client* hop alive and tells you nothing about the backend.
- **Leak detection is unaffected** — it measures how long your code holds the
  connection, which is a property of your code, not of the transport.

## The queue you cannot see

🔴 **A borrow can succeed instantly at HikariCP and then block inside PgBouncer**,
waiting for a server connection out of `default_pool_size`.

From the application's point of view everything is healthy: `pending` is zero,
`acquire` is microseconds, utilisation is low. From the user's point of view the
request is slow. The queue did not disappear — it moved one layer down, to a
place your metrics do not reach.

⚠️ **PgBouncer bounds that wait with `query_wait_timeout`**, and when it expires
the client gets an error rather than a HikariCP timeout — so the exception you
see does not come from the pool at all, and none of
[chunk 5's](05-connection-is-not-available.md) four numbers apply.

**The remedy is to monitor PgBouncer as well.** Its admin console exposes `SHOW
POOLS`, `SHOW STATS`, `SHOW CLIENTS` and `SHOW SERVERS`; `SHOW POOLS` carries the
waiting-client counts and wait times, which are the direct analogue of
`hikaricp.connections.pending`. A dashboard with the application's pool metrics
and no PgBouncer metrics is a dashboard that is confidently describing the
smaller half of the system.

## Three layers of sizing, and which one binds

| Layer | The number | What it limits |
|---|---|---|
| the application | `maximumPoolSize` x instances | how many client connections exist |
| the pooler | `max_client_conn` | how many clients PgBouncer will accept |
| the pooler | `default_pool_size` | 🔴 **how many queries the database runs at once** |
| the database | `max_connections` | the absolute ceiling on backends |

🔴 **`default_pool_size` is where [chunk 2's](02-why-a-small-pool-is-faster.md)
argument now lives**, because it is the number of concurrent queries the database
actually sees. Everything from that chunk — core count, the axiom about a small
pool saturated with waiters, the fact that bigger is usually slower — applies to
it and no longer to `maximumPoolSize`.

⚠️ **And [chunk 3's](03-the-connection-budget.md) deadlock floor moves with it.**
If a code path holds two connections at once, the floor now has to be satisfied
by the layer that is the binding constraint — which, once `max_client_conn` is
large, is `default_pool_size`. A fleet can wedge behind a pooler for exactly the
reasons chunk 3 describes.

## When two layers is right, and when it is not

| Situation | Verdict |
|---|---|
| a large or autoscaling fleet, or serverless instances | ✅ this is what a pooler is for |
| many small services sharing one database | ✅ one budget, centrally enforced |
| connection storms after mass restarts | ✅ the pooler absorbs them |
| a single service with a bounded replica count | ⛔ two places to misconfigure |
| "we need a bigger pool" | ⛔ 🔴 solve the sizing problem instead |
| an application that uses session features | ⛔ session mode only — which buys much less |

## Finding out whether one is already there

Managed database services frequently include a pooler, and platform teams add
them without telling application teams. The signature, from
[chunk 8d](08d-the-database-side.md):

**Fewer backends in `pg_stat_activity` than your pools hold** means something is
multiplexing. Two corroborating signs: backends far older than your configured
`maxLifetime`, and session-scoped features behaving strangely.

⛔ **This is worth checking before debugging anything else**, because if a pooler
is in the path in transaction mode, a meaningful fraction of this topic describes
settings that no longer govern what you think they govern.

## The trade-off

Two layers of pooling means two sets of sizing decisions, two sets of timeouts,
two places for a queue to form and two operational tools — and only one of them
appears in the application's own metrics. What you buy is real: the connection
budget stops being an arithmetic problem distributed across every team's
deployment manifest, and becomes one number enforced in one place. For a large
estate that is worth the complexity. For one service with six replicas it is a
second thing to get wrong in exchange for a problem you did not have.

## Gotchas

**⚠️ Installing PgBouncer because the pool feels too small**
**Symptom:** the same saturation, now with an extra hop.
**Cause:** the database's concurrency limit did not change; only where the queue
forms did.
**Fix:** size the pool properly first ([chunk 2](02-why-a-small-pool-is-faster.md)).
A pooler solves *client count*, not throughput.

**⚠️ Expecting HikariCP's `maxLifetime` to bound the backend's life**
**Symptom:** backends far older than the configured lifetime in
`pg_stat_activity`.
**Cause:** the pool's connection ends at PgBouncer; the backend is governed by
`server_lifetime`.
**Fix:** configure both, and know which one you are looking at
([chunk 8d](08d-the-database-side.md)).

**⚠️ Healthy pool metrics with slow queries**
**Symptom:** `pending` at zero, `acquire` fast, and endpoints timing out.
**Cause:** the wait moved into PgBouncer, which HikariCP cannot see.
**Fix:** monitor `SHOW POOLS` as well; the application's metrics no longer tell
the whole story.

**⚠️ Not knowing there is a pooler in the path**
**Symptom:** settings that do nothing and behaviour nobody can explain.
**Cause:** a managed database service that includes one, or a platform team that
added it.
**Fix:** the cross-check from [chunk 8d](08d-the-database-side.md) — fewer
backends on the server than your pools hold is the signature.

**⚠️ Forgetting the deadlock floor still applies**
**Symptom:** a fleet that wedges behind a pooler.
**Cause:** `default_pool_size` is now the scarce resource, and a code path holding
two connections at once has a floor against *it*.
**Fix:** [chunk 3](03-the-connection-budget.md) applies to whichever layer is the
binding constraint.

**⚠️ Raising `max_client_conn` and not `default_pool_size`**
**Symptom:** thousands of clients accepted, and every one of them queueing.
**Cause:** the two numbers limit different things; only the second is capacity.
**Fix:** they are set together, with `default_pool_size` chosen from the
database's concurrency and `max_client_conn` from the fleet's size.

**⚠️ An exception that does not come from HikariCP**
**Symptom:** a connection error with none of the pool's four numbers in it.
**Cause:** `query_wait_timeout` fired inside PgBouncer, or PgBouncer refused the
client.
**Fix:** recognise it as a pooler error and go to `SHOW POOLS`, not to
`maximumPoolSize`.

**⚠️ Leaving the pool fixed-size out of habit**
**Symptom:** thousands of idle client connections against `max_client_conn`.
**Cause:** the reason for a fixed-size pool — expensive connection creation — is
much weaker when the connection is to a local pooler.
**Fix:** an elastic pool is a reasonable choice here, and this is one of the few
places it clearly is ([chunk 4d](04d-idletimeout-and-minimumidle.md)).

## Interview questions

**★ When is a pooler the right answer, and when is it a mistake?**
It is right when the problem is *client count*: a large or autoscaling fleet,
serverless instances whose number you cannot predict, many small services sharing
one database, or connection storms after mass restarts. In all of those,
`instances x maximumPoolSize` is the thing that will not fit, and a pooler
dissolves that arithmetic by making client connections and backends different
numbers. It is a mistake when the real problem is throughput, because the
database's concurrency limit is unchanged — the queue simply moves one layer down
— and it is a mistake for a single service with a bounded replica count, where it
adds a second set of sizing decisions for no benefit.

**★ Which of your HikariCP settings change meaning behind a pooler?**
`maxLifetime` most obviously: it now bounds a connection to PgBouncer, not to a
PostgreSQL backend, whose lifetime is governed by `server_lifetime` and whose
idle retirement is `server_idle_timeout`. Connection creation becomes cheap,
since it no longer forks a backend, which relaxes the requirement that
`connectionTimeout` exceed a full handshake and makes an elastic pool a
reasonable choice for once. `maximumPoolSize` is budgeted against
`max_client_conn` rather than `max_connections`. And the pool-sizing argument has
not gone away — it has moved to `default_pool_size`, which is now the number of
concurrent queries the database actually sees.

**★ Your pool metrics look healthy and queries are slow. What would you suspect?**
That the queue moved somewhere the pool cannot see. With a pooler in the path, a
borrow can succeed instantly at HikariCP — `pending` zero, `acquire` in
microseconds — and then block inside PgBouncer waiting for a server connection
from `default_pool_size`. The application's metrics report on the client hop
only, so they describe a perfectly healthy pool while requests queue one layer
down. The remedy is to monitor the pooler's own statistics, where `SHOW POOLS`
reports waiting clients and wait times — the direct analogue of
`hikaricp.connections.pending`.

**★ How would you find out whether there is a pooler in the path at all?**
Compare the pool's own connection count with `pg_stat_activity`. If the fleet's
pools hold more connections than the database reports backends for that role,
something is multiplexing, and a pooler is by far the most likely explanation.
Two corroborating signs are backends far older than the configured `maxLifetime`,
and session-scoped features misbehaving. This matters because managed database
services frequently include a pooler and platform teams add them without telling
application teams — and if it is running in transaction mode, a large part of the
pool configuration is governing something other than what its name suggests.

**★ Where does the deadlock floor live once there is a pooler?**
At whichever layer is the binding constraint, which is usually
`default_pool_size` — because `max_client_conn` is typically set large, and the
whole point of the pooler is that client connections are plentiful. So a code
path that holds two connections at once still has a floor; it is simply computed
against the pooler's server pool instead of against `maximumPoolSize`. The
failure looks the same from the application: everything blocked, nothing
returning, no recovery. It is a good example of a pooler moving a constraint
rather than removing it.

**★ Which exception tells you the pooler, rather than the pool, refused you?**
One with none of HikariCP's four numbers in it. The pool's timeout message always
carries `total`, `active`, `idle` and `waiting`; a failure that originates inside
PgBouncer — `query_wait_timeout` expiring while waiting for a server connection,
or the client being refused because `max_client_conn` is reached — arrives as an
ordinary driver-level error instead. Recognising which layer spoke is the first
branch in the investigation, because the two have entirely separate
configurations and entirely separate remedies.

**★ Should the pool be fixed-size or elastic behind a pooler?**
This is one of the few cases where elastic has a clear argument. The reason
HikariCP recommends a fixed-size pool is that establishing a connection is
expensive — a TCP handshake, TLS, authentication and a forked backend — and an
elastic pool pays that during a demand spike. Behind a local pooler, connecting
is cheap and forks nothing, so the cost of regrowing is much lower, while the
benefit of shrinking is real: thousands of idle client connections still count
against `max_client_conn`. It is worth measuring rather than assuming, but the
default recommendation is genuinely weaker here than anywhere else.

---

← Prev: [8e · PgBouncer in front](08e-pgbouncer-in-front.md) · Index: [Connection pooling with HikariCP](README.md)
