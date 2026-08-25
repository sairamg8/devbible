---
title: "Ten metrics come out of the pool and three of them answer the only question you will ever ask it in an incident"
sidebar_label: "8c · Watching the pool"
sidebar_position: 24
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the HikariCP 7.0.2 source
> (`metrics/micrometer/MicrometerMetricsTracker.java`, `HikariPoolMXBean`, read
> at tag `HikariCP-7.0.2`), the HikariCP wiki *MBean (JMX) Monitoring*
> ([github.com/brettwooldridge/HikariCP/wiki](https://github.com/brettwooldridge/HikariCP/wiki)),
> the Spring Boot 4.1 reference *Actuator → Metrics → Supported Metrics →
> DataSource*
> ([docs.spring.io/spring-boot/reference/actuator/metrics.html](https://docs.spring.io/spring-boot/reference/actuator/metrics.html)),
> and the PostgreSQL 18 documentation for `pg_stat_activity`
> ([postgresql.org/docs/18/monitoring-stats.html](https://www.postgresql.org/docs/18/monitoring-stats.html)).
> JDK 25, HikariCP 7.0.2, Spring Boot 4.1.0, PostgreSQL 18.

**[Chunk 5](05-connection-is-not-available.md) read the pool's four numbers out of
an exception, after something had already failed. This chunk is the same four
numbers as time series, before anything fails — plus three timers that answer a
question the four numbers cannot. There are ten metrics in total, and knowing
which three to look at first is most of the value. The database's own view of the
same question, and the one JMX button worth knowing, are
[chunk 8d](08d-the-database-side.md).**

## What HikariCP publishes

Boot's reference states the naming rule:

> *Hikari-specific metrics are exposed with a `hikaricp` prefix. Each metric is
> tagged by the name of the pool (you can control it with
> `spring.datasource.name`).*

From `MicrometerMetricsTracker`:

| Metric | Type | What it is |
|---|---|---|
| `hikaricp.connections` | gauge | `total` — connections the pool holds |
| `hikaricp.connections.active` | gauge | handed out right now |
| `hikaricp.connections.idle` | gauge | available right now |
| `hikaricp.connections.pending` | gauge | 🔴 **threads waiting** for a connection |
| `hikaricp.connections.max` | gauge | the **configured** `maximumPoolSize` |
| `hikaricp.connections.min` | gauge | the **configured** `minimumIdle` |
| `hikaricp.connections.acquire` | timer | 🔴 how long a borrow took |
| `hikaricp.connections.usage` | timer | 🔴 how long a connection was **held** |
| `hikaricp.connections.creation` | timer | how long establishing a connection took |
| `hikaricp.connections.timeout` | counter | borrows that failed with a timeout |

⚠️ **`.max` and `.min` are the configured limits, not observed maxima.** That
makes them the cheapest way to check what the pool is *actually* running with
after [chunk 4e's](04e-when-a-clock-is-silently-disabled.md) silent corrections.

Boot also exposes a vendor-neutral `jdbc.connections` family for every
`DataSource`, which is thinner. Use the `hikaricp` metrics; they are the ones with
`pending` and the timers.

## The three that matter

**1 · `hikaricp.connections.pending` — the leading indicator.**
It is above zero whenever a thread is waiting, which happens long before any
thread waits the full `connectionTimeout`. Alerting on this instead of on failures
buys you the whole timeout period of warning.

**2 · `hikaricp.connections.acquire` — is the pool the bottleneck?**
On a healthy pool a borrow is microseconds. A p99 in the tens of milliseconds
means threads are queueing; a p99 near `connectionTimeout` means they are timing
out. It converts "the endpoint is slow" into "the endpoint is slow *waiting for a
connection*", which is a different investigation.

**3 · 🔴 `hikaricp.connections.usage` — the one that settles the argument.**
It measures how long each connection was held. Pair it with `active`:

| `usage` | `active` | Diagnosis |
|---|---|---|
| flat | rising | more traffic — the pool may genuinely need to be larger |
| **rising** | at maximum | 🔴 **queries got slower** — the pool is a symptom, not the cause |
| rising | flat and low | a specific slow path; find it before resizing |
| flat and **very high** | pinned at maximum | 🔴 a **leak** — connections held indefinitely ([chunk 6b](06b-finding-and-preventing-leaks.md)) |

That second row is [chunk 5's](05-connection-is-not-available.md) "nothing was
deployed and the pool started timing out" case, and `usage` is the metric that
identifies it without guesswork.

## What to alert on

| Alert | Condition | Why |
|---|---|---|
| pool saturation | `active / max` > 0.8 for 5 min | early, and actionable |
| queueing | `pending` > 0 for 1 min | the leading indicator |
| borrow latency | `acquire` p99 > 100 ms | the pool has become the bottleneck |
| failures | `rate(timeout) > 0` | ⚠️ lagging — requests have already failed |
| leak shape | `active` high during a known-quiet period | the uptime-not-load fingerprint |

⛔ **An alert on the timeout counter alone is an alert that fires after users
notice.** It is worth having as a backstop; it is not the primary signal.

## JMX, and the one operational button

```yaml
spring:
  datasource:
    hikari:
      register-mbeans: true
```

Two ObjectNames appear: `com.zaxxer.hikari:type=Pool (poolName)` exposing
`HikariPoolMXBean`, and `com.zaxxer.hikari:type=PoolConfig (poolName)` exposing
the effective configuration — the cross-check from
[chunk 4e](04e-when-a-clock-is-silently-disabled.md).

The MXBean gives you `getIdleConnections`, `getActiveConnections`,
`getTotalConnections` and `getThreadsAwaitingConnection` — the same four numbers
again — plus three operations.

🔴 **`softEvictConnections()` is the one worth knowing.** It retires every
connection in the pool: idle ones immediately, in-use ones when they are
returned. That is **a full drain without a restart**, and it is the correct
response to:

- a database failover, where every existing connection points at the old primary;
- a credential rotation, where existing connections still work and new ones
  would fail;
- a certificate change;
- any suspicion that connections are in a bad state.

The pool rebuilds itself against the new reality while continuing to serve
traffic, and no request is interrupted.

`suspendPool()` and `resumePool()` also exist and require
`allowPoolSuspension: true` (default `false`); calling them without it fails.
Suspension blocks all borrows, which is a heavy instrument — occasionally right
before a planned failover, dangerous otherwise.

⚠️ **JMX is an interface, so treat it as one.** An unauthenticated remote JMX port
gives anyone who can reach it the ability to suspend your connection pool.

## The trade-off

Every metric here describes the *pool*, and the pool is downstream of two things
it cannot see: how much traffic arrives, and how long the database takes. So pool
metrics alone will tell you *that* something is wrong and almost never *what*. The
`usage` timer is the partial exception, which is why it earns a place in the top
three. The practical consequence is that a pool dashboard is close to useless on
its own and very good next to request rate and query latency — and that a team
that graphs only the pool will resize it every time.

## Gotchas

**⚠️ No metrics from a hand-wired second `DataSource`**
**Symptom:** the primary pool is on the dashboard and the reports pool is not.
**Cause:** Boot binds the meter registry into the auto-configured pool; a pool
you built yourself has no metrics tracker unless you set one.
**Fix:** set the `MeterRegistry` on the `HikariDataSource` bean explicitly
([chunk 3f](03f-wiring-a-second-datasource.md)).

**⚠️ Two pools sharing a `pool-name`**
**Symptom:** an `active` series that matches neither pool.
**Cause:** metrics are tagged by pool name, so identical names merge.
**Fix:** distinct names — they also appear in the timeout exception and in
HikariCP's own log lines.

**⚠️ Alerting only on `hikaricp.connections.timeout`**
**Symptom:** the alert and the user complaints arrive together.
**Cause:** the counter increments after a thread has waited the entire
`connectionTimeout`.
**Fix:** alert on `pending` and on `acquire` latency; keep the counter as a
backstop.

**⚠️ Reading `hikaricp.connections` as "connections in use"**
**Symptom:** a dashboard that always shows the pool at 100%.
**Cause:** it is `total`, and a fixed-size pool holds its maximum
([chunk 4d](04d-idletimeout-and-minimumidle.md)).
**Fix:** utilisation is `active / max`, not `connections / max`.

**⚠️ Reading `.max` as an observed high-water mark**
**Symptom:** confusion about a gauge that never moves.
**Cause:** it reports the configured `maximumPoolSize`.
**Fix:** that is a feature — it is how you verify the effective configuration.

**⚠️ Judging the pool without query latency beside it**
**Symptom:** the pool is resized every quarter and the problem returns.
**Cause:** rising `usage` from slower queries looks exactly like insufficient
capacity.
**Fix:** put `usage`, `active` and query latency on one graph.

**⚠️ `suspendPool()` without `allowPoolSuspension`**
**Symptom:** the JMX operation fails.
**Cause:** it is disabled by default, deliberately.
**Fix:** enable it in advance if you want it — but `softEvictConnections()` is
almost always the operation actually wanted.

**⚠️ An unsecured JMX port**
**Symptom:** anyone on the network can suspend the pool.
**Cause:** `register-mbeans: true` plus a remote connector with no
authentication.
**Fix:** local access only, through the platform's own tooling.

**⚠️ Restarting the service after a failover**
**Symptom:** an avoidable outage window on top of the failover.
**Cause:** the connections point at the old primary and nobody knew about
`softEvictConnections`.
**Fix:** drain the pool through JMX; the service keeps serving throughout.

## Interview questions

**★ Which pool metrics would you put on a dashboard first?**
`hikaricp.connections.pending`, because it is above zero the moment a thread
waits and therefore leads every failure by up to the whole `connectionTimeout`;
`hikaricp.connections.acquire`, whose p99 says whether the pool has become the
bottleneck for a slow endpoint; and `hikaricp.connections.usage`, which measures
how long connections are held and is the only pool metric that distinguishes
"more traffic" from "slower queries". Utilisation as `active / max` is worth a
fourth panel. The timeout counter belongs on the dashboard as a backstop, not as
the primary signal, because it only increments after a request has already
failed.

**★ Why is the usage timer so important?**
Because pool capacity is size divided by holding time, and `usage` is the only
direct measurement of holding time you get. If `usage` is flat and `active` is
rising, traffic went up and a larger pool may genuinely help. If `usage` is
rising while `active` sits at the maximum, queries got slower and the pool is a
symptom — resizing it will add concurrent slow queries to a database that is
already the bottleneck. If `usage` is enormous and flat while the pool is pinned,
connections are being held indefinitely, which is the leak signature. One metric,
three different conclusions, and without it all three look identical.

**★ What does `hikaricp.connections.max` tell you?**
The configured `maximumPoolSize`, not an observed maximum. That makes it more
useful than it sounds: HikariCP silently corrects configuration it cannot honour,
and Spring's relaxed binding silently ignores misspelled properties, so the value
in `application.yaml` is not evidence of anything. `.max` and `.min` are the
running pool reporting what it actually has, which is the cheapest available
cross-check on the whole configuration.

**★ What can you do to a running pool through JMX?**
Read the same four numbers, read the effective configuration from the
`PoolConfig` MBean, and — the genuinely useful one — call
`softEvictConnections()`, which retires every connection in the pool: idle ones
at once, in-use ones as they are returned. That is a rolling drain without a
restart, and it is the right response to a database failover, a rotated
credential or a replaced certificate, because the pool rebuilds itself against
the new reality while continuing to serve traffic and without interrupting a
single request. `suspendPool` and `resumePool` also exist, require
`allowPoolSuspension`, and block every borrow — a much heavier instrument.

**★ Why is a pool dashboard on its own not enough?**
Because the pool sits downstream of two things it cannot observe: how much
traffic arrives, and how long the database takes to answer. Almost every pool
symptom — saturation, queueing, timeouts — is produced by one of those, so the
pool's metrics reliably tell you *that* something is wrong and rarely *what*. The
usage timer is the partial exception, which is why it matters so much. A team
that graphs only the pool ends up resizing it in response to every incident,
which works occasionally and makes the database worse the rest of the time.

---

← Prev: [8b · Readiness, liveness and shutdown](08b-readiness-liveness-and-shutdown.md) · Index: [Connection pooling with HikariCP](README.md) · Next → [8d · The database side](08d-the-database-side.md)
