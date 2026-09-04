---
title: "leakDetectionThreshold never reclaims a connection — it prints the stack trace of the code that borrowed it, and that is the whole point"
sidebar_label: "6 · Leak detection"
sidebar_position: 16
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the HikariCP 7.0.2 README and source
> (`pool/ProxyLeakTask.java`, `pool/ProxyConnection.java`,
> `HikariConfig.validateNumerics()`, read at tag `HikariCP-7.0.2`)
> ([github.com/brettwooldridge/HikariCP](https://github.com/brettwooldridge/HikariCP)).
> JDK 25, HikariCP 7.0.2, Spring Boot 4.1.1, Spring Framework 7.0.9.

**A leaked connection is one that was borrowed and never returned. The pool
cannot tell the difference between a leak and a slow operation — from its side
both look like a connection that has been out for a long time — so it does not
try to. `leakDetectionThreshold` starts a timer at every borrow, and if the timer
fires, it **logs a warning containing the stack trace of the code that did the
borrowing**. It does not reclaim the connection. It never reclaims the
connection. It is a diagnostic, and the diagnosis it gives you is a line number,
which is exactly what you need and nothing more.**

## The setting

> *This property controls the amount of time that a connection can be out of the
> pool before a message is logged indicating a possible connection leak. A value
> of 0 means leak detection is disabled. Lowest acceptable value for enabling
> leak detection is 2000 (2 seconds). Default: 0*

🔴 **The default is 0 — off.** A pool that has never been configured has no leak
detection at all, which means the first symptom of a leak is the outage.

## What actually happens

At borrow, `ProxyConnection` schedules a `ProxyLeakTask` for
`leakDetectionThreshold` milliseconds in the future. Two things can happen next.

**The connection is returned first.** `close()` cancels the task
([chunk 1](01-what-the-pool-hands-you.md), step 2). Nothing is logged, and there
is no cost beyond a cancelled timer.

**The timer fires.** HikariCP logs at WARN:

```
Connection leak detection triggered for <connection> on thread <thread>, stack trace follows
```

🔴 **and attaches a stack trace captured at the moment of the *borrow*.** It is
built as `new Exception("Apparent connection leak detected")` with the first
frames — HikariCP's own — stripped off, so the top of the trace is **your code,
on the line that called `getConnection()`**.

That is the entire value of the feature. A leak is discovered somewhere else
entirely, on some other thread, minutes later; without this you have a pool that
is full and no idea which of two hundred call sites filled it. With it you have a
file and a line.

⚠️ **The exception is a stack-trace carrier, not a thrown error.** Nothing
propagates it. The word "Exception" and the trace make it look like a crash in a
log aggregator, which is why these lines get triaged as errors and then ignored.

## The "unleaked" message

If the connection is eventually returned after the warning, HikariCP logs at
INFO:

```
Previously reported leaked connection <connection> on thread <thread> was returned to the pool (unleaked)
```

🔴 **That message is good news and it is routinely misread.** It means the
earlier warning was a **false positive** — the operation was slow, not lost. A
run of warnings each followed by an "unleaked" is not a leak; it is a threshold
set below your slowest legitimate operation.

| You see | It means |
|---|---|
| WARN, then INFO "unleaked" | slow operation. Raise the threshold, or fix the query |
| WARN, no INFO, connection never comes back | 🔴 a real leak. Go to the stack trace |
| many WARNs, all unleaked | the threshold is below normal holding time |
| no WARNs and a full pool | detection is off, or silently disabled — see below |

## Choosing the threshold

Two hard constraints and one judgement:

```
2000  <=  leakDetectionThreshold  <=  maxLifetime
```

- **Below 2 seconds → disabled**, silently.
- **Above `maxLifetime` → disabled**, silently, with a warning at startup.
- **Between them:** comfortably above your slowest legitimate connection
  holding time, so genuine work does not trip it.

⛔ **The upper bound is a trap that punishes caution.** The default `maxLifetime`
is thirty minutes. Someone deciding "half an hour is surely long enough that only
a real leak would trip it" sets `leak-detection-threshold: 1800000` — equal to
`maxLifetime`, therefore **disabled**. The most careful-looking value is the
broken one. [Chunk 4e](04e-when-a-clock-is-silently-disabled.md) collects every
rule of this shape.

A workable pair for a request-path pool:

```yaml
spring:
  datasource:
    hikari:
      max-lifetime: 240000            # 4 minutes
      leak-detection-threshold: 30000 # 30 s — above any legitimate request
```

Thirty seconds is far longer than any request-path operation should take, and far
shorter than `maxLifetime`, so the constraint holds even after
[chunk 4b's](04b-maxlifetime-and-keepalive.md) tightening.

⚠️ **A reports pool needs a much larger value** — a two-minute export is not a
leak. This is one more setting that differs per workload
([chunk 3e](03e-two-pools-not-one-bigger.md)).

## Why it cannot reclaim the connection

Because it does not know. From the pool's side, "borrowed twenty seconds ago" is
all the information there is. The borrower might be running a legitimately slow
query, waiting on a lock, or streaming a large result set
([topic 01 chunk 15](../01-jdbc/15-fetch-size-and-streaming.md)). Forcibly
reclaiming it would mean handing a live, in-use connection to a second thread —
`java.sql.Connection` is not thread-safe, so that corrupts both callers, and it
would do so in the middle of somebody's transaction.

⚠️ **The consequence: leak detection buys you nothing at runtime.** It does not
slow the leak, it does not extend the pool's life, and it does not keep the
service up. It shortens the time from "connections are disappearing" to "here is
the line", which is the only part a tool can help with. The rest is
[topic 01 chunk 18's](../01-jdbc/18-ownership-and-leaks.md) discipline —
[chunk 6b](06b-finding-and-preventing-leaks.md) is about doing that part.

## The trade-off

Leak detection schedules and cancels a timer on every single borrow. On a pool
serving thousands of borrows a second that is real work, though small next to a
round trip to the database. The larger cost is log noise when the threshold is
too low, and the failure mode there is social rather than technical: people
silence the warning instead of raising the threshold, and then the detector is
gone when it matters. Set it once, above the slowest legitimate operation, and
leave it on in production — the cost is small and the alternative is discovering
a leak from an outage.

## Gotchas

**⚠️ `leakDetectionThreshold` equal to or above `maxLifetime`**
**Symptom:** no leak warnings, ever, and the absence is read as "no leaks".
**Cause:** HikariCP disables the feature. With both at the default of 30 minutes
this happens at exactly the value a cautious person would pick.
**Fix:** keep it well below `maxLifetime`; re-check whenever either changes.

**⚠️ `leakDetectionThreshold` below 2 seconds**
**Symptom:** silently disabled.
**Cause:** the documented floor.
**Fix:** seconds to tens of seconds, matched to the workload.

**⚠️ Leaving it at the default of 0**
**Symptom:** the first evidence of a leak is a total outage.
**Cause:** detection is off out of the box.
**Fix:** set it. It is the cheapest diagnostic in the pool.

**⚠️ Expecting the warning to fix anything**
**Symptom:** the warnings appear and the pool still empties.
**Cause:** the feature logs; it never reclaims.
**Fix:** the warning is a pointer to the code to change. Change the code.

**⚠️ Reading "unleaked" as confirmation of a leak**
**Symptom:** an investigation into a leak that does not exist.
**Cause:** the INFO message reports that the connection *came back* — a false
positive.
**Fix:** WARN with no matching "unleaked" is the real signal.

**⚠️ Turning detection off because of the noise**
**Symptom:** a warning storm from a batch job, then the setting is removed.
**Cause:** the threshold is below legitimate holding time for that workload.
**Fix:** raise the threshold, or give the slow workload its own pool with its own
threshold.

**⚠️ Setting the same threshold in every pool**
**Symptom:** the reports pool produces constant warnings, or the request pool
produces none.
**Cause:** the right value is a function of the slowest legitimate operation.
**Fix:** per pool, like `connectionTimeout`.

## Interview questions

**★ What does `leakDetectionThreshold` do?**
It starts a timer when a connection is borrowed. If the connection has not been
returned by the time the threshold elapses, HikariCP logs a warning containing a
stack trace captured at the moment of the borrow — with its own frames stripped,
so the top of the trace is the application line that called `getConnection()`. If
the connection is returned later, it logs an informational "unleaked" message
saying the earlier warning was a false alarm. That is all it does. It is purely a
diagnostic.

**★ Why does it not reclaim the connection?**
Because it cannot know whether the connection is leaked or merely busy. From the
pool's perspective the only fact available is how long ago it was handed out, and
a legitimately slow query, a lock wait or a streamed result set all look
identical to a lost connection. Reclaiming would mean handing an in-use
connection to another thread, and `java.sql.Connection` is not thread-safe — so
you would corrupt two callers and interrupt a transaction in order to recover one
pool slot. Logging and letting a human fix the code is the only safe behaviour.

**★ How do you choose the threshold?**
Above the slowest legitimate connection holding time for that pool, and
comfortably below `maxLifetime`, with 2 seconds as the absolute floor. For a
request-path pool something like thirty seconds works, because nothing on a
request path should legitimately hold a connection that long. A reports or batch
pool needs a much larger value, since a two-minute export is normal there — which
is another setting that differs per workload and another argument for separate
pools. The failure mode of setting it too low is not technical: it produces noise,
and noise gets silenced.

**★ There are no leak warnings. Does that mean there are no leaks?**
Not necessarily, and this is the question worth being suspicious about. The
default is 0, which is off. And even when set, HikariCP disables it silently if
the value is below two seconds or above `maxLifetime` — and since both
`maxLifetime` and a "safely large" threshold default to thirty minutes, the most
cautious-looking configuration is the one that turns it off. Before concluding
there are no leaks, verify the effective value from the running pool rather than
from the configuration file.

**★ Would you leave leak detection on in production?**
Yes. The runtime cost is a scheduled timer per borrow, cancelled on return — real
but negligible against a database round trip — and the benefit is that the first
occurrence of a leak arrives as a stack trace pointing at a line, instead of as
an outage weeks later with no evidence. The condition is that the threshold be
set above the slowest legitimate operation for that pool, because the practical
risk is not overhead, it is a noisy warning being suppressed and taking the
detector with it.

---

← Prev: [5b · The exception underneath](05b-the-exception-underneath.md) · Index: [Connection pooling with HikariCP](README.md) · Next → [6b · Finding and preventing leaks](06b-finding-and-preventing-leaks.md)
