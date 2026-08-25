---
title: "HikariCP corrects your configuration at startup instead of rejecting it, so a setting in your YAML is not evidence that it is in force"
sidebar_label: "4e · When a clock is silently disabled"
sidebar_position: 13
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the HikariCP 7.0.2 source
> (`HikariConfig.validateNumerics()`, read at tag `HikariCP-7.0.2`) and the
> HikariCP 7.0.2 README
> ([github.com/brettwooldridge/HikariCP](https://github.com/brettwooldridge/HikariCP)).
> JDK 25, HikariCP 7.0.2, Spring Boot 4.1.0.

**HikariCP checks its own configuration when the pool is built. When it finds a
combination it cannot honour, it does not refuse to start — it **corrects the
value or turns the feature off**, logs a line, and carries on serving traffic.
That is a defensible design: nobody wants an application to fail to boot because
leak detection was set badly. It has one consequence you must internalise. **A
setting present in `application.yaml` is not evidence that the setting is
active.** The only evidence is the running pool.**

## The anchor problem

The rules are not independent. **`maxLifetime` is the anchor**, and three other
settings are validated against it:

```
                    maxLifetime
                   /     |      \
      keepaliveTime  idleTimeout  leakDetectionThreshold
      (must be <)    (+1s must be <=)   (must be <=)
```

🔴 **So lowering `maxLifetime` can switch off three features in one commit,**
and this is not a hypothetical. Here is a completely reasonable change:

```yaml
spring:
  datasource:
    hikari:
      max-lifetime: 60000            # ← tightened for a 90-second reaper
      keepalive-time: 120000         # (default, untouched)
      idle-timeout: 600000           # (default, untouched)
      leak-detection-threshold: 120000
```

One line changed. The effect:

| Setting | Written | In force |
|---|---|---|
| `maxLifetime` | 60000 | ✅ 60000 |
| `keepaliveTime` | 120000 | ⛔ **disabled** — not less than `maxLifetime` |
| `idleTimeout` | 600000 | ⛔ **disabled** — `+1s` exceeds `maxLifetime` |
| `leakDetectionThreshold` | 120000 | ⛔ **disabled** — greater than `maxLifetime` |

Three protections gone, three WARN lines in a startup log, and an application
that starts and serves traffic perfectly. It will be weeks before anybody notices
that leak detection stopped reporting.

## The full set of rules

From `validateNumerics()`:

| Condition | What HikariCP does |
|---|---|
| `maxLifetime` > 0 and < 30 s | reset to the default **30 minutes**, with a WARN |
| `keepaliveTime` > 0 and < 30 s | **disabled** |
| `keepaliveTime` >= `maxLifetime` | **disabled** |
| `leakDetectionThreshold` > 0 and < 2 s | **disabled**, with a WARN |
| `leakDetectionThreshold` > `maxLifetime` | **disabled**, with a WARN |
| `connectionTimeout` < 250 ms | reset to the default **30 seconds** |
| `validationTimeout` < 250 ms | reset to the default **5 seconds** |
| `minimumIdle` < 0 or > `maximumPoolSize` | set to `maximumPoolSize` |
| `idleTimeout` + 1 s > `maxLifetime` *(elastic pool only)* | **disabled** |
| `idleTimeout` > 0 and < 10 s *(elastic pool only)* | reset to the default **10 minutes** |
| `idleTimeout` set while `minimumIdle` == `maximumPoolSize` | inert; WARN that it *"has no effect because the pool is operating as a fixed size pool"* |

Plus the constraint the README states directly: `validationTimeout` must be less
than `connectionTimeout`.

⚠️ **Notice the two different remedies.** Some violations *reset to a default* —
a value you did not choose, often much larger than the one you wrote. Others
*disable the feature entirely*. Neither is what your file says, and the two fail
in opposite directions: a reset `connectionTimeout` waits thirty seconds where
you asked for two hundred milliseconds, while a disabled
`leakDetectionThreshold` simply stops watching.

## A configuration that satisfies every rule

```yaml
spring:
  datasource:
    hikari:
      pool-name: shop-oltp
      maximum-pool-size: 6           # minimumIdle defaults to this → fixed size
      connection-timeout: 2000       # >= 250; > validation-timeout
      validation-timeout: 1000       # >= 250; < connection-timeout
      max-lifetime: 240000           # >= 30000; the anchor
      keepalive-time: 60000          # >= 30000; < max-lifetime
      leak-detection-threshold: 30000 # >= 2000; <= max-lifetime
      # idle-timeout deliberately omitted — a fixed-size pool ignores it
```

Read down the comments and every constraint is visible. That is the point of
writing them: the relationships are invisible in the property names, so they have
to be visible in the file.

## How to check what is actually in force

Three levels, in increasing order of trustworthiness.

**1 · Read the startup log.** HikariCP's warnings all name the pool and the
property. It is worth having a log-based alert for `WARN` from
`com.zaxxer.hikari`, because these lines appear exactly once, at boot, in the
noisiest part of the log.

**2 · Read the metrics.** `hikaricp.connections.max` and
`hikaricp.connections.min` report the sizes actually in use
([chunk 8c](08c-watching-the-pool.md)). They will not tell you about the timeouts.

**3 · Read the config object.** With `registerMbeans: true`, the
`com.zaxxer.hikari:type=PoolConfig (poolName)` MBean exposes the effective
configuration. Alternatively, log the values from the `HikariDataSource` bean at
startup:

```java
@Bean
ApplicationRunner logPoolConfig(HikariDataSource ds) {
    return args -> log.info(
        "pool={} max={} minIdle={} connTimeout={} maxLifetime={} keepalive={} leakDetect={}",
        ds.getPoolName(), ds.getMaximumPoolSize(), ds.getMinimumIdle(),
        ds.getConnectionTimeout(), ds.getMaxLifetime(),
        ds.getKeepaliveTime(), ds.getLeakDetectionThreshold());
}
```

🔴 **This ten-line bean is worth more than any amount of care with the YAML**,
because it also catches the other silent failure: a misspelled property, which
Spring's relaxed binding ignores without a word
([chunk 3f](03f-wiring-a-second-datasource.md)).

## The trade-off

Correct-and-continue is the right default for a library that sits under every
request in the application. A pool that refused to start because
`leakDetectionThreshold` was two milliseconds would convert a misconfigured
*diagnostic* into an outage, which is a worse failure than the one it prevents.
What you give up is the ability to trust configuration by reading it, and the
compensation for that is not more careful reading — it is checking the running
system. Treat the YAML as intent and the pool as truth.

## Gotchas

**⚠️ Lowering `maxLifetime` without re-checking the other three**
**Symptom:** keepalive, idle retirement and leak detection all stop working after
a one-line change.
**Cause:** `maxLifetime` is the anchor for all three constraints.
**Fix:** treat those four settings as one block. Change them together, and check
the effective values afterwards.

**⚠️ `leakDetectionThreshold` set to 30 minutes on a default pool**
**Symptom:** leak detection never reports anything, and the absence is read as
"we have no leaks".
**Cause:** the default `maxLifetime` is also 30 minutes, and a threshold greater
than `maxLifetime` is disabled. The boundary is exactly where a reasonable person
would set it.
**Fix:** keep the threshold well below `maxLifetime` — tens of seconds, not tens
of minutes ([chunk 6](06-leak-detection.md)).

**⚠️ `connectionTimeout: 200` to fail fast**
**Symptom:** requests wait thirty seconds, the opposite of the intent.
**Cause:** below the 250 ms floor the value is reset to the *default*, not to the
floor.
**Fix:** 250 ms is the minimum; in practice a second or two.

**⚠️ Lowering `connectionTimeout` and leaving `validationTimeout`**
**Symptom:** a startup warning and a value you did not choose.
**Cause:** validation must be shorter than the borrow budget.
**Fix:** move both in the same edit.

**⚠️ `maxLifetime: 10000` because the network reaper is aggressive**
**Symptom:** connections live for thirty minutes, not ten seconds.
**Cause:** below the 30-second minimum it is reset to the default of 30 minutes —
the most dangerous of these corrections, because it lands *further* from your
intent than doing nothing would have.
**Fix:** 30 seconds is the floor. If the reaper is faster than that, the reaper is
the thing to change.

**⚠️ Assuming a warning would be noticed**
**Symptom:** a pool has been running with three disabled features for a year.
**Cause:** the lines are emitted once, at boot, among thousands of startup lines,
in a service nobody was watching that day.
**Fix:** alert on `WARN` from `com.zaxxer.hikari`, or log the effective
configuration explicitly.

**⚠️ Trusting a code review of the YAML**
**Symptom:** three reviewers approve a configuration in which two settings are
inert.
**Cause:** the constraints are between properties, not within them, and nothing
in the property names hints at the relationships.
**Fix:** put the constraints in comments next to the values, and verify from the
running pool rather than from the diff.

**⚠️ Copying a HikariCP block between two services with different pool sizes**
**Symptom:** the same YAML behaves differently in two applications.
**Cause:** several rules depend on `minimumIdle` versus `maximumPoolSize`, so a
block that produced an elastic pool in one service produces a fixed-size pool —
with `idleTimeout` inert — in another.
**Fix:** copy the *reasoning*, not the numbers.

## Interview questions

**★ What does HikariCP do with a configuration it cannot honour?**
It corrects it and continues. `HikariConfig.validateNumerics()` runs when the
pool is constructed; depending on the rule it either resets the value to
HikariCP's default or disables the feature outright, logs a warning, and starts
the pool normally. Nothing throws. The design reasoning is sound — a pool that
refused to boot over a badly set diagnostic would turn a small mistake into an
outage — but the consequence is that the presence of a setting in your
configuration file tells you nothing about whether it is in effect.

**★ Which setting is the anchor, and why does that matter?**
`maxLifetime`. Three other settings are validated against it: `keepaliveTime`
must be strictly less, `idleTimeout` plus one second must not exceed it, and
`leakDetectionThreshold` must not exceed it. So a single change to `maxLifetime`
— a very normal change, made whenever someone discovers a network idle timeout —
can silently disable keepalive, idle retirement and leak detection at once. That
is why those four properties should be treated as one block and reviewed
together, and why the effective values should be checked after the change rather
than assumed.

**★ Give an example where the correction is worse than the original mistake.**
`maxLifetime: 10000`. Someone sets ten seconds because a proxy is reaping
aggressively. Ten seconds is below the documented 30-second minimum, so HikariCP
resets it to the *default* of thirty minutes — not to the thirty-second floor.
The pool now holds connections a hundred and eighty times longer than intended
and far longer than the reaper allows, which is the exact failure the change was
meant to prevent, and worse than having made no change at all.
`connectionTimeout` below 250 ms behaves the same way: asking for 200 ms gets you
thirty seconds.

**★ Why is `leakDetectionThreshold: 1800000` a particularly nasty configuration?**
Because it is disabled, and it looks careful. The default `maxLifetime` is also
thirty minutes, and a leak threshold greater than `maxLifetime` is turned off —
so the value someone chose precisely to avoid false positives lands exactly on
the boundary that switches the feature off. The failure is silent and the
symptom is an *absence*: no leak warnings ever appear, which reads as evidence of
correctness rather than of a disabled detector.

**★ How would you verify what a pool is actually running with?**
Ask the pool, not the file. The simplest reliable method is a small
`ApplicationRunner` that logs `getMaximumPoolSize`, `getMinimumIdle`,
`getConnectionTimeout`, `getMaxLifetime`, `getKeepaliveTime` and
`getLeakDetectionThreshold` off the `HikariDataSource` bean at startup. With
`registerMbeans` enabled, the `PoolConfig` MBean exposes the same values for
inspection at runtime. Metrics give you the sizes but not the timeouts. Whichever
route, the point is the same: the effective values are the only ones worth
reading, and they also catch misspelled properties, which Spring's relaxed
binding discards without complaint.

**★ Would you prefer HikariCP to fail fast on a bad configuration?**
For some of these, yes, and it is a genuine design argument. A value below a
documented floor is unambiguously a mistake, and resetting it to a default that
is orders of magnitude away from the intent is arguably worse than refusing to
start. For others — a leak-detection threshold above `maxLifetime`, say —
disabling and warning is clearly right, because failing to boot over a
diagnostic would be a self-inflicted outage. The pragmatic position is to accept
the library's choice and compensate for it: alert on the pool's warnings and log
the effective configuration, so that "it corrected me" is something you find out
in a deploy rather than in an incident.

---

← Prev: [4d · idleTimeout and minimumIdle](04d-idletimeout-and-minimumidle.md) · Index: [Connection pooling with HikariCP](README.md) · Next → [5 · Connection is not available](05-connection-is-not-available.md)
