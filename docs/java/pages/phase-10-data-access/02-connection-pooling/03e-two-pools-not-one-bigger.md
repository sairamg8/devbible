---
title: "When one pool serves both a 3-millisecond query and a 30-second report, the answer is two pools, not a bigger one"
sidebar_label: "3e · Two pools, not one bigger"
sidebar_position: 7
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the HikariCP wiki *About Pool Sizing* (§ Caveat
> Lector)
> ([github.com/brettwooldridge/HikariCP/wiki/About-Pool-Sizing](https://github.com/brettwooldridge/HikariCP/wiki/About-Pool-Sizing)),
> the HikariCP 7.0.2 README
> ([github.com/brettwooldridge/HikariCP](https://github.com/brettwooldridge/HikariCP)),
> the Spring Boot 4.1 how-to *Configure Two DataSources*
> ([docs.spring.io/spring-boot/how-to/data-access.html](https://docs.spring.io/spring-boot/how-to/data-access.html))
> and the PostgreSQL 18 documentation for `statement_timeout` and
> `pg_stat_activity`
> ([postgresql.org/docs/18/](https://www.postgresql.org/docs/18/)).
> JDK 25, HikariCP 7.0.2, Spring Boot 4.1.0, PostgreSQL 18.

**HikariCP's sizing guide ends with a warning it calls *Caveat Lector*: "Pool
sizing is ultimately very specific to deployments." The specific deployment it
singles out as hardest to tune is the one almost every service eventually
becomes — a system running long transactions and short ones through the same
pool. Its recommendation is not a number. It is to stop using one pool.**

## Why one pool cannot serve both

A pool's occupancy is arrival rate multiplied by holding time. Two workloads with
the same arrival rate and wildly different holding times therefore consume wildly
different amounts of the same fixed resource:

| Workload | Holding time | Calls per second | Connections occupied |
|---|---|---|---|
| request path: `SELECT ... WHERE id = ?` | 3 ms | 500 | ~1.5 |
| CSV export: a full scan with a join | 30 s | 0.2 | **6** |

Five hundred requests a second need about one and a half connections. **One
export every five seconds needs six.** The workload nobody thinks about consumes
four times the pool of the one the service exists for — and it does so with a
call rate three thousand times lower, which is why it never shows up in a
throughput graph.

🔴 **The consequence is head-of-line blocking.** With a pool of eight, seven
concurrent exports leave one connection for everything else. The request path
does not slow down gracefully; it queues, then hits `connectionTimeout`, then
fails — while the database itself is nearly idle, because six of its backends are
sitting in a sequential scan.

⚠️ **Raising the shared pool does not fix it, it postpones it.** Sixteen
connections buys room for eight more exports and takes the whole of
[chunk 2's](02-why-a-small-pool-is-faster.md) argument in the wrong direction:
more concurrent long queries on the same server means every long query gets
slower, holds its connection longer, and occupies more of the pool. The
occupancy formula has holding time in it, and you just increased it.

## The shape that works

Two pools, sized and timed for their own workload, on the same database:

```yaml
spring:
  datasource:                        # the request path
    url: jdbc:postgresql://db.internal:5432/shop
    username: shop_app
    password: ${DB_PASSWORD}
    configuration:
      pool-name: shop-oltp
      maximum-pool-size: 6
      connection-timeout: 2000       # fail fast — a user is waiting
      max-lifetime: 900000

app:
  datasource:                        # reports and exports
    url: jdbc:postgresql://db.internal:5432/shop
    username: shop_reports           # its own role, its own CONNECTION LIMIT
    password: ${REPORTS_PASSWORD}
    configuration:
      pool-name: shop-reports
      maximum-pool-size: 3
      connection-timeout: 30000      # a queued report can wait
      leak-detection-threshold: 120000
      data-source-properties:
        options: "-c statement_timeout=120000"
        ApplicationName: shop-reports
```

Three things are doing work there.

**Different `connectionTimeout` per workload.** A user-facing request should give
up after two seconds; a nightly export can queue for thirty. One pool forces one
answer to that question, and the answer is wrong for one of them.

**A server-side `statement_timeout` on the reports connection**, passed through
pgjdbc's `options` property. Without it, `connection-timeout: 30000` merely means
a runaway query gets to hold a connection for hours instead of failing. Client
timeouts and server timeouts are different mechanisms —
[topic 01 chunk 22d](../01-jdbc/22d-server-side-timeouts.md).

**A separate database role.** That is what makes
[chunk 3c's](03c-the-server-side-ceiling.md) `ALTER ROLE ... CONNECTION LIMIT`
usable as a bulkhead: the reports workload cannot consume more than its
allocation no matter what the YAML says.

The Spring wiring that puts the second `DataSource` bean in place — and the two
ways it silently goes wrong — is [chunk 3f](03f-wiring-a-second-datasource.md).

## The other reasons to split

Separating pools buys three things beyond head-of-line blocking:

- **Independent `Cm` accounting.** A thread holding one connection from each pool
  has `Cm = 1` in both, so neither pool acquires the deadlock floor from
  [chunk 3](03-the-connection-budget.md).
- **Independent failure.** A pooler or replica outage on one side does not empty
  the other pool.
- **Independent evidence.** Two sets of pool metrics answer "which workload is
  starving" without any correlation work.

## The trade-off

Two pools cost two allocations from the same server budget
([chunk 3d](03d-the-fleet-budget.md)), so the total footprint goes *up*, not
down — 6 + 3 where one pool of 8 stood. You are spending connections to buy
isolation. They also cost real configuration surface: a second transaction
manager, a second set of credentials, a second thing to size, and a new way to
get it wrong by routing a query to the wrong pool. And a transaction cannot span
them, which is a hard boundary, not an inconvenience. Split when the workloads
have genuinely different holding times and different urgency; do not split
because it sounds tidy.

## Gotchas

**⚠️ One pool for the request path and the reports**
**Symptom:** user-facing requests time out while database CPU is low.
**Cause:** long queries occupy connections; occupancy is rate x holding time, and
the long side wins on holding time by four orders of magnitude.
**Fix:** two pools, or move reports to a replica.

**⚠️ Raising the shared pool to make room for the reports**
**Symptom:** it helps for a week and then both workloads are slower.
**Cause:** more concurrent long queries make each long query slower, which raises
holding time, which raises occupancy again.
**Fix:** split first, then size each side.

**⚠️ Two pools sized independently against one budget**
**Symptom:** the fleet hits `max_connections` after a change nobody connected to
the database.
**Cause:** the budget is per server; splitting a pool does not split the ceiling.
**Fix:** the sum of both pools times the replica count is the number that
matters.

**⚠️ A long `connectionTimeout` with no `statement_timeout`**
**Symptom:** a report connection is held for hours and the reports pool is
permanently full.
**Cause:** `connectionTimeout` bounds how long you wait *for* a connection, not
how long a query may run once you have one.
**Fix:** set `statement_timeout` on the reports role or via the connection's
`options`.

**⚠️ Routing a query to the wrong pool**
**Symptom:** a heavy aggregate runs on the OLTP pool and the split appears not to
work at all.
**Cause:** nothing in the type system says which pool a repository belongs to; it
is a naming convention enforced by review.
**Fix:** keep the boundary at a package or service level — a `ReportService` that
only ever receives the qualified `DataSource` — rather than choosing per call
site.

**⚠️ The reports pool pointed at a replica, used for read-your-writes**
**Symptom:** a user exports data immediately after saving and their change is
missing.
**Cause:** replication lag. The split moved the read off the primary, and off its
snapshot with it.
**Fix:** route only reads that tolerate lag to the replica, and say in the code
which ones those are.

**⚠️ Splitting a workload that does not need it**
**Symptom:** twice the configuration, twice the connections, no change in
behaviour.
**Cause:** both workloads had similar holding times, so there was no head-of-line
blocking to remove.
**Fix:** measure holding time before splitting. If the ratio is not at least an
order of magnitude, one pool is simpler and cheaper.

## Interview questions

**★ Why does one slow endpoint take down fast ones that share a pool?**
Because the pool is a fixed number of slots and occupancy is arrival rate times
holding time. A query that holds a connection for thirty seconds occupies a slot
ten thousand times longer than one that holds it for three milliseconds, so a
trickle of slow calls can own the entire pool while contributing almost nothing
to the request rate. Everything else then queues behind them and eventually times
out, and the confusing part is that the database looks fine — its CPU is low,
because the connections are held by a handful of long sequential scans rather
than by contention.

**★ What is HikariCP's actual advice for mixed workloads?**
Its sizing guide's closing caveat says pool sizing is very specific to
deployments, singles out systems mixing long-running and short transactions as
the hardest case to tune, and recommends creating separate pool instances for the
different workload types. The important thing about that advice is what it is
*not*: it does not offer a formula or a larger number. It says the problem is not
solvable by sizing one pool, because the two workloads want different sizes and
different timeouts and one pool can only have one of each.

**★ How would you size the two pools?**
Independently, from each workload's own occupancy, and then check the sum against
the server budget. For the request path, use the throughput formula and keep it
small — its holding time is milliseconds, so a handful of connections carries a
very high request rate. For the reports pool, decide how many long queries you
are willing to have running at once on that database and set the size to exactly
that; it is a concurrency limit for expensive work, not a throughput setting. Then
add both, multiply by the replica count, and confirm it fits inside
`max_connections` minus the reserved slots and the other consumers.

**★ Besides head-of-line blocking, what does splitting buy you?**
Three things. Separate deadlock-floor accounting, because a thread holding one
connection from each pool has `Cm = 1` in both. Separate failure domains, so a
problem on one side — a stuck query, a pooler restart, a replica falling behind —
does not empty the other pool. And separate evidence: two sets of pool metrics
and two `application_name` values in `pg_stat_activity` answer "which workload is
consuming the budget" directly, instead of requiring you to correlate.

**★ Why must the reports pool have a server-side statement timeout?**
Because none of HikariCP's clocks bound query execution. `connectionTimeout`
bounds how long a thread waits *for* a connection; `validationTimeout` bounds an
aliveness check; `maxLifetime` bounds a connection's age. Once a thread holds a
connection and issues a query, HikariCP has nothing to say about how long it
runs. A pool deliberately configured to wait thirty seconds for a connection,
without `statement_timeout`, is a pool that will eventually be entirely occupied
by queries nobody is waiting for any more. The timeout belongs on the server —
set on the role, or passed as `options=-c statement_timeout=...` — so it applies
even to a query whose client has gone away.

**★ How do you decide which pool a query belongs in?**
By holding time and by who is waiting, not by whether it is a read or a write.
Anything a user is blocked on belongs in the fast pool with a short
`connectionTimeout`; anything measured in seconds — exports, aggregates,
backfills, migrations of data rather than schema — belongs in the slow one with
a long timeout and a server-side `statement_timeout`. The boundary is best drawn
at a service or package level rather than per call site, because "which pool" is
a property of the workload, and a decision made per query is a decision that will
eventually be made wrong.

**★ When would you not split?**
When the holding times are within an order of magnitude of each other, because
then there is no head-of-line blocking to remove and you have bought two
transaction managers and two allocations for nothing. Also when the two
workloads genuinely need to be in one transaction, since a transaction cannot
span two `DataSource` beans without JTA. And when the real answer is a read
replica: if the reports do not need to see the last few seconds of writes,
pointing the second pool at a replica removes their load from the primary
entirely, which is strictly better than isolating it there.

---

← Prev: [3d · The fleet budget](03d-the-fleet-budget.md) · Index: [Connection pooling with HikariCP](README.md) · Next → [3f · Wiring a second DataSource](03f-wiring-a-second-datasource.md)
