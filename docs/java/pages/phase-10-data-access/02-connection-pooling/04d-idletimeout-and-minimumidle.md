---
title: "minimumIdle is not a duration — it is the switch that decides whether your pool is fixed-size or elastic, and idleTimeout does nothing until you flip it"
sidebar_label: "4d · idleTimeout and minimumIdle"
sidebar_position: 12
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the HikariCP 7.0.2 README
> ([github.com/brettwooldridge/HikariCP](https://github.com/brettwooldridge/HikariCP),
> raw at tag `HikariCP-7.0.2`) and its source (`pool/HikariPool.java`
> `HouseKeeper`, `HikariConfig.validateNumerics()`).
> JDK 25, HikariCP 7.0.2, Spring Boot 4.1.1, PostgreSQL 18.

**`idleTimeout` is the most-configured setting in HikariCP that does nothing.
Out of the box it is inert, and it stays inert no matter what you set it to,
because the switch that activates it is a different property that is not a
duration at all. This chunk is about that switch — and about why HikariCP's
authors recommend never flipping it.**

## The switch

> **`minimumIdle`** — *This property controls the minimum number of idle
> connections that HikariCP tries to maintain in the pool.* ... *For maximum
> performance and responsiveness to spike demands, we recommend **not** setting
> this value and instead allowing HikariCP to act as a **fixed size** connection
> pool. Default: same as `maximumPoolSize`*

Because the default equals `maximumPoolSize`, an unconfigured pool is
**fixed-size**: it works toward holding `maximumPoolSize` connections and keeps
them, busy or not.

> **`idleTimeout`** — *This property controls the maximum amount of time that a
> connection is allowed to sit idle in the pool. **This setting only applies when
> `minimumIdle` is defined to be less than `maximumPoolSize`.** Idle connections
> will not be retired once the pool reaches `minimumIdle` connections.* ... *A
> value of 0 means that idle connections are never removed from the pool. The
> minimum allowed value is 10000ms (10 seconds). Default: 600000 (10 minutes)*

🔴 **So the default pool never retires an idle connection, and `idleTimeout`'s
default of ten minutes is a value that is never consulted.** Setting
`idle-timeout: 30000` in `application.yaml` on an otherwise default pool changes
nothing. HikariCP does at least say so — it logs a warning that the setting
*"has no effect because the pool is operating as a fixed size pool"* — but that
warning is one line in a startup log nobody reads.

| `minimumIdle` | Pool behaviour | Is `idleTimeout` consulted? |
|---|---|---|
| unset (= `maximumPoolSize`) | **fixed size** | ❌ no |
| less than `maximumPoolSize` | **elastic** | ✅ yes, down to `minimumIdle` |

## Why fixed-size is the recommendation

A pool holding ten open connections it is not using looks wasteful. It is
deliberate, and the reasoning is the same one from
[chunk 4b](04b-maxlifetime-and-keepalive.md): opening a connection is expensive
and slow. An elastic pool that has shrunk to two connections must pay a TCP
handshake, a TLS handshake, an authentication round trip and a forked backend
before it can serve the third concurrent request of a spike — and it pays that
*during* the spike, when latency is already the thing you care about.

A fixed-size pool has already paid. The README's phrase is *"maximum performance
and responsiveness to spike demands"*, and responsiveness to spikes is exactly
what elasticity trades away.

⚠️ **The cost is that the pool's footprint on the database is constant.** Ten
connections held overnight are ten backend processes and ten slots out of
`max_connections` ([chunk 3c](03c-the-server-side-ceiling.md)). That is the
trade, stated plainly: a fixed-size pool spends database capacity to buy
predictable latency.

## When elastic is actually right

Three cases, and they have something in common — a large number of mostly-idle
pools:

- **Many instances of a low-traffic service.** Fifty pods each holding ten
  connections is five hundred slots for a service that uses twenty at peak.
- **Serverless or scale-to-zero deployments**, where instance count is
  unpredictable ([chunk 3d](03d-the-fleet-budget.md)).
- **A batch or reports pool that is used for one hour a day.** Holding its
  connections for the other twenty-three costs budget for nothing.

```yaml
spring:
  datasource:
    hikari:
      maximum-pool-size: 10
      minimum-idle: 2          # ← the switch. Now idle-timeout matters.
      idle-timeout: 60000
      max-lifetime: 240000
```

🔴 **Elasticity reduces your *average* footprint, not your *budgeted* one.** The
fleet arithmetic in [chunk 3d](03d-the-fleet-budget.md) must still assume every
pool is at `maximumPoolSize`, because they all can be at once — that is what a
correlated traffic spike means. Elastic pools are a way to be a good citizen most
of the time, not a way to overcommit the server.

## How retirement actually happens

Idle retirement is not instantaneous, and the README says how imprecise it is:

> *This value can vary by +30 seconds average variation depending on
> `idleTimeout`, and average variation +15 seconds.*

The reason is the housekeeper. HikariCP runs a background task every
**30 seconds** by default (`com.zaxxer.hikari.housekeeping.periodMs`) which is
what notices that a connection has been idle too long. A connection that crosses
its threshold one second after a sweep waits for the next one.

⚠️ **So a pool does not visibly shrink the moment traffic stops.** Watching
`hikaricp.connections` after a load test and concluding elasticity is broken is
usually just the 30-second sweep plus the variance.

The housekeeper also watches the clock, and logs two things worth recognising:
a **retrograde clock change** (time went backwards — it soft-evicts connections
rather than trusting their ages), and *"Thread starvation or clock leap
detected"*, which means the sweep ran much later than scheduled. The second is
rarely about the pool: it usually means the JVM was paused — a long
stop-the-world GC, a suspended container, or a host under such CPU pressure that
a scheduled task could not run. It is a useful incidental signal.

## Two ways `idleTimeout` disables itself

Even in an elastic pool, `idleTimeout` has rules, enforced at startup:

| Condition | Result |
|---|---|
| `idleTimeout` + 1 second > `maxLifetime` | **disabled** |
| `idleTimeout` < 10000 | reset to the default 10 minutes |
| `minimumIdle` == `maximumPoolSize` | inert, with a warning |
| `minimumIdle` < 0 or > `maximumPoolSize` | set to `maximumPoolSize` |

The first is easy to hit once you have followed
[chunk 4b](04b-maxlifetime-and-keepalive.md) and set a short `maxLifetime`. With
`max-lifetime: 240000` and the default `idle-timeout: 600000`, idle retirement is
off — which is arguably harmless, since connections are being retired by age
anyway, but it is not what the configuration says.
[Chunk 4e](04e-when-a-clock-is-silently-disabled.md) has the whole set.

## Filling the pool at startup

`minimumIdle` describes a target the pool works *toward*, not a guarantee it has
been reached. A pool that has just started may be empty, and the first requests
pay for the first connections. For the cases where that matters — a service that
must be warm before traffic is routed to it — HikariCP exposes a system property
`com.zaxxer.hikari.blockUntilFilled`, which makes startup wait until the pool has
reached its minimum.

⚠️ It is a system property rather than a `HikariConfig` setting, so it is set on
the JVM command line, not in `application.yaml`. Treat it as an advanced escape
hatch: it moves latency from the first requests into startup, which is only an
improvement if something is waiting for the readiness probe.

## The trade-off

The whole page is one trade. A fixed-size pool holds connections you are not
using, spending database slots and backend memory to guarantee that a spike never
waits for a handshake. An elastic pool gives those back during quiet periods and
pays for them again — with interest, in latency — at the start of every busy
period. The default is fixed-size because most services would rather spend the
database's memory than the user's time, and because the connections a pool holds
are usually a small number. Reverse the choice when the number of pools is large
and their duty cycle is low.

## Gotchas

**⚠️ Setting `idle-timeout` on a default pool**
**Symptom:** nothing happens; connections are never retired.
**Cause:** `minimumIdle` defaults to `maximumPoolSize`, so the pool is fixed-size
and the setting is inert.
**Fix:** set `minimum-idle` below `maximum-pool-size` — and be sure that is what
you want.

**⚠️ Setting `minimum-idle` low to "save connections"**
**Symptom:** the first requests after every quiet period are slow, and p99
latency has a daily shape.
**Cause:** the pool shrank and must re-establish connections during the spike.
**Fix:** the README recommends a fixed-size pool for exactly this reason. Shrink
only when there are many mostly-idle pools.

**⚠️ Assuming elasticity buys budget**
**Symptom:** the fleet still exhausts `max_connections` during a correlated
spike.
**Cause:** every pool can reach `maximumPoolSize` simultaneously, and a spike is
precisely when they do.
**Fix:** budget the maximum. Elasticity improves the average, which is not the
number that fails.

**⚠️ `idleTimeout` within a second of `maxLifetime`**
**Symptom:** an elastic pool that never shrinks.
**Cause:** HikariCP disables `idleTimeout` when it is not comfortably below
`maxLifetime`.
**Fix:** keep a clear gap; re-check both whenever either changes.

**⚠️ `idleTimeout` below 10 seconds**
**Symptom:** the effective value is ten minutes.
**Cause:** below the documented minimum, it is reset to the default.
**Fix:** ten seconds is the floor; a value in that region also produces
pathological churn.

**⚠️ Expecting the pool to shrink immediately**
**Symptom:** connection count stays flat for half a minute after traffic stops.
**Cause:** a 30-second housekeeping sweep plus up to 30 seconds of variance.
**Fix:** nothing. Watch over minutes, not seconds.

**⚠️ `minimumIdle` greater than `maximumPoolSize`**
**Symptom:** the pool behaves as fixed-size no matter what you set.
**Cause:** the value is clamped to `maximumPoolSize` at startup.
**Fix:** check the order of the two numbers; it is an easy transposition.

**⚠️ Reading "Thread starvation or clock leap detected" as a pool problem**
**Symptom:** the warning appears during an incident and gets investigated as a
HikariCP bug.
**Cause:** the housekeeping task ran far later than scheduled — usually a long GC
pause, a suspended container or a starved host.
**Fix:** look at JVM pauses and host CPU. The pool is the messenger.

## Interview questions

**★ Why does `idleTimeout` usually do nothing?**
Because it only applies when `minimumIdle` is less than `maximumPoolSize`, and
`minimumIdle` defaults to `maximumPoolSize`. The default pool is fixed-size: it
works toward holding its maximum number of connections and never retires them for
idleness. Setting `idle-timeout` without also lowering `minimum-idle` changes
nothing at all — HikariCP logs a warning that the setting has no effect because
the pool is operating as a fixed-size pool, and otherwise carries on. It is
probably the most common inert setting in a Spring Boot data-source
configuration.

**★ Why does HikariCP recommend a fixed-size pool?**
Because the alternative pays connection-establishment cost at the worst possible
moment. An elastic pool shrinks during quiet periods, so when demand rises it
must perform a TCP handshake, a TLS handshake, an authentication exchange and
cause a new backend process on the database before it can serve the request that
triggered the growth. The README's wording is *"for maximum performance and
responsiveness to spike demands"* — responsiveness to spikes is precisely what
elasticity gives away. Holding idle connections is the price of never paying that
cost in the request path.

**★ When would you make a pool elastic anyway?**
When there are many pools with a low duty cycle. Fifty instances of a
low-traffic service holding ten connections each is five hundred slots for a
workload that peaks at twenty; a reports pool used one hour a day holds its
connections for the other twenty-three; a serverless deployment creates and
destroys instances unpredictably. In all three the constant footprint is the
problem, and the latency cost of re-establishing connections is acceptable
because nobody is waiting or because the alternative is exhausting the server.

**★ Does an elastic pool let you overcommit the database?**
No, and assuming it does is how a fleet fails. Every pool can be at
`maximumPoolSize` simultaneously, and a correlated traffic spike is exactly the
event that makes them all grow at once — so the budget has to assume the maximum.
Elasticity lowers the average footprint, which is good citizenship and shows up
as a lower connection count on a dashboard, but the number that has to fit inside
`max_connections` is the sum of maximums, not the sum of averages.

**★ Why does the pool not shrink the instant traffic stops?**
Because retirement is driven by a housekeeping task that runs every thirty
seconds by default, and because HikariCP adds variance on top of that —
documented as averaging around fifteen seconds with a maximum of thirty. A
connection that crosses its idle threshold just after a sweep waits for the next
one. The practical consequence is that you cannot judge elasticity from a
thirty-second window on a graph; watch over several minutes.

**★ What does "Thread starvation or clock leap detected" mean?**
That HikariCP's housekeeping task ran significantly later than it was scheduled
to. The pool detects this by comparing wall-clock time against its expected
schedule, and it matters to the pool because connection ages and idle times are
computed from that clock. In practice the message is almost never about the pool
itself: it means the JVM or the host stopped executing for a while — a long
stop-the-world garbage collection, a suspended or throttled container, or a host
so oversubscribed that a scheduled task could not run. It is a useful free
signal, and the investigation belongs in the JVM and the platform, not in the
pool configuration.

**★ How would you make sure the pool is warm before traffic arrives?**
Prefer the fixed-size default, which fills toward `maximumPoolSize` on its own
shortly after startup, and gate traffic on a readiness probe that only passes
once the application can actually serve a request. Where that is not enough,
HikariCP has a system property, `com.zaxxer.hikari.blockUntilFilled`, that makes
pool startup block until the minimum is reached. It is set on the JVM command
line rather than in configuration, and it does not remove the cost — it moves it
from the first few requests into startup time, which is only worth doing if
something is actually waiting on readiness.

---

← Prev: [4c · keepaliveTime and the reapers](04c-keepalive-and-the-reapers.md) · Index: [Connection pooling with HikariCP](README.md) · Next → [4e · When a clock is silently disabled](04e-when-a-clock-is-silently-disabled.md)
