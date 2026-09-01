---
title: "The resources a JVM service actually contends for are pools and queues rather than disks and busses, Boot already meters most of them, and the saturation column of that table is the one nobody dashboards and the one that gives you warning"
sidebar_label: "05b · USE for a JVM service"
sidebar_position: 14
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-01 against **Brendan Gregg's "The USE Method"**
> ([brendangregg.com](https://www.brendangregg.com/usemethod.html)), the **Spring Boot 4.1
> production-ready reference · Metrics — Supported Metrics and Meters**
> ([docs.spring.io](https://docs.spring.io/spring-boot/reference/actuator/metrics.html)), the
> **Micrometer 1.17.0 sources** —
> [`ExecutorServiceMetrics`](https://github.com/micrometer-metrics/micrometer/blob/v1.17.0/micrometer-core/src/main/java/io/micrometer/core/instrument/binder/jvm/ExecutorServiceMetrics.java)
> and
> [`JvmGcMetrics`](https://github.com/micrometer-metrics/micrometer/blob/v1.17.0/micrometer-core/src/main/java/io/micrometer/core/instrument/binder/jvm/JvmGcMetrics.java)
> — and **HikariCP's `MicrometerMetricsTracker`** for the pool meter names. Every meter name below
> was read out of those sources rather than recalled. No JVM was run for this page and no metric
> values appear. JDK 25 · Spring Boot 4.1.0 · Micrometer 1.17.0.

**[05](05-red-and-use.md) established the three checklists. This page is the one that is actually
hard to look up: what "resource" means for a JVM service, which meter is the utilisation and which
is the saturation for each one, and why the saturation column is nearly always missing from the
dashboard that was supposed to warn you.**

## USE, in a JVM service: what the resources actually are

The resource list for a JVM service is not Gregg's hardware list. It is the set of bounded pools
your requests contend for, and Boot instruments most of them. Meter names below are from the
Micrometer 1.17.0 and HikariCP sources, not from memory.

| Resource | Utilisation | Saturation | Errors |
|---|---|---|---|
| DB connection pool | `hikaricp.connections.active` / `hikaricp.connections.max` | **`hikaricp.connections.pending`** — threads waiting for a connection | `hikaricp.connections.timeout` |
| Request thread pool (Tomcat) | busy threads / max threads (`tomcat.*`, needs `server.tomcat.mbeanregistry.enabled=true`) | the accept queue | connector errors |
| Task executor | `executor.active` / `executor.pool.max` | **`executor.queued`**, and `executor.queue.remaining` | rejections |
| Heap | `jvm.memory.used` / `jvm.memory.max` by area | **`jvm.gc.pause` sum per second** — the fraction of wall time spent in GC | `OutOfMemoryError` — [04](../04-out-of-memory-error/README.md) |
| CPU | `system.cpu.usage`, `process.cpu.usage` | run queue length (host metric, not a JVM one) | — |
| Downstream service | your own `http.client.requests` rate | client-side queueing or connection-pool waits | `http.client.requests` errors |

🔴 **The saturation column is the one that predicts incidents, and it is the one nobody puts on a
dashboard.** `hikaricp.connections.pending` is the single most valuable number in that table for a
typical Spring service: it is a *queue length*, exactly as Gregg specifies, it is zero in normal
operation, and it becomes non-zero minutes before latency moves. `executor.queued` plays the same
role for async work.

The GC row deserves its own note. Utilisation of the heap (`used/max`) is a poor signal because a
healthy G1 heap oscillates; the useful saturation signal is the *proportion of wall-clock time
spent paused*, derived from the `jvm.gc.pause` timer's sum. [02 · GC in
practice](../02-gc-in-practice/README.md) owns the interpretation.

## The three queries that make the saturation column exist

```promql
# DB pool saturation — threads blocked waiting to borrow a connection.
# Healthy value is 0. Any sustained non-zero value is the incident, early.
max by (pool) (hikaricp_connections_pending)

# Executor saturation — work accepted and not yet started, per executor bean.
max by (name) (executor_queued_tasks)

# Heap saturation — the fraction of wall-clock time this process spent in GC pauses.
# A ratio, so it is comparable across heap sizes and across services.
sum by (instance) (rate(jvm_gc_pause_seconds_sum[5m]))
```

*(Series names are the Prometheus naming convention applied to the Micrometer meter names above;
confirm the exact suffixes against your own `/actuator/prometheus` output rather than trusting a
page, because they depend on the registry and the meter's base unit.)*

The third query is worth dwelling on. `rate(..._sum[5m])` of a timer measured in seconds is
**seconds of pause per second of wall clock** — a dimensionless fraction between 0 and 1 (or
higher, on a multi-threaded collector where several GC threads pause concurrently). That makes it
directly comparable between a 512 MB pod and a 32 GB one, which `jvm_memory_used / jvm_memory_max`
is not. It is also the number that maps onto the user's experience, because a pause is time your
request was not being served.

## Why the saturation column is always missing

It is not laziness. Three structural reasons:

- **Saturation metrics are boring.** A healthy `hikaricp.connections.pending` is a flat line at
  zero. A panel that is always zero looks broken, gets moved to the bottom of the dashboard, and
  then gets deleted in the next tidy-up.
- **Utilisation is what the vendors ship.** Every out-of-the-box pool dashboard shows active,
  idle and total connections, because those are three interesting-looking lines. Pending is one
  boring line and is frequently omitted from the panel entirely.
- **Saturation has no natural threshold to tune, which feels like a defect and is actually the
  point.** "Alert when pending > 0 for two minutes" needs no percentile, no baseline and no
  seasonal adjustment. Engineers used to tuning CPU thresholds distrust an alert with no number in
  it.

The consequence of the omission is specific and repeatable: the dashboard shows a pool at 60%
utilisation, everybody concludes the pool is not the problem, and the actual state was 100%
utilisation in bursts with threads queued — Gregg's own counter-example, one layer up the stack.

## Queue length is latency, by Little's Law

The reason a queue length predicts a latency change is not a heuristic. For a stable system,
Little's Law says the mean number of items in the system equals the arrival rate times the mean
time in the system — `L = λW`. Rearranged, `W = L / λ`: at a fixed arrival rate, **mean waiting
time is proportional to queue length**. So a pending count that has moved from 0 to 4 has already
told you that mean wait has moved, before any latency percentile has enough samples to show it.

That is also why saturation leads and duration lags, rather than the two being two views of the
same instant. The queue fills first; the requests that are in it have not finished yet, so they are
not in your latency histogram yet.

## The two checklists side by side, for one incident

"p99 latency doubled after the deploy" — the phase's own gate question:

1. **RED on the affected service.** Did rate change? Did the error rate change? Is the duration
   increase on every endpoint or one? This tells you *what* and *where*, in about thirty seconds.
2. **RED on its downstream calls** (`http.client.requests`, tagged by target). If a downstream's
   duration moved and yours followed, you are the victim, not the cause.
3. **USE on this service's resources.** Pool pending non-zero? Executor queue growing? GC pause
   fraction up? Now you have *which resource*.
4. Only then reach for a flame graph or a thread dump — [06 · JFR and
   profiling](../06-jfr-and-profiling/README.md), [05 · Thread
   dumps](../05-thread-dumps/README.md).

The ordering matters because steps 1–3 are queries against data you already have, and step 4 is an
intervention on a live process.


## Gotchas

**★ USE applied to memory is genuinely awkward, and Wilkie says so.** *"Memory utilization is
tricky. What is it? Do you count caches toward utilisation? Saturation of memory is kind of a weird
one… And what is a memory error?"* For a JVM the workable substitutions are heap-used-to-max for
utilisation, GC time fraction for saturation, and `OutOfMemoryError` for errors — but they are
substitutions, not the real thing.

**★ `hikaricp.connections.pending` is usually absent from dashboards and is usually the answer.**
It is a queue length in Gregg's exact sense, it is zero when healthy, and by the time request
latency has moved it has been non-zero for minutes.

**★ Tomcat's metrics are off unless you turn on the MBean registry.** Boot: *"Auto-configuration
enables the instrumentation of Tomcat only when an MBean Registry is enabled. By default, the MBean
registry is disabled, but you can enable it by setting `server.tomcat.mbeanregistry.enabled` to
`true`."* So thread-pool saturation for the request path is missing by default.


**★ `executor.queued` is the async counterpart and is equally absent from dashboards.** Boot
instruments *"all available `ThreadPoolTaskExecutor` and `ThreadPoolTaskScheduler` beans, as long
as the underlying `ThreadPoolExecutor` is available"*, tagged by the executor's bean name. A
growing queue on the executor behind your `@Async` methods is the same warning signal as pending
connections, one layer up.

**★ An unbounded work queue converts saturation into an `OutOfMemoryError`.** A
`ThreadPoolExecutor` with a `LinkedBlockingQueue` of default capacity never rejects, so
`executor.queued` climbs forever and the resource never reports errors — it reports a heap dump
instead. `executor.queue.remaining` is the metric that tells you whether you have a bound at all.

**★ Heap utilisation is a poor signal and heap *saturation* is a derived one.** `used/max` on a
healthy G1 heap sawtooths between wide bounds by design, so it alarms constantly or never. The
signal that behaves monotonically with pressure is the fraction of wall-clock time spent paused,
from the `jvm.gc.pause` timer's sum.

**★ Some of these resources have no error metric at all, and the absence is information.** There
is no counter for "a thread waited too long for a connection and gave up" beyond
`hikaricp.connections.timeout`, and no counter for GC failing. Where Gregg's third column is
empty, the failure surfaces as a request error instead — which is why RED and USE have to be read
together.

## Interview questions

**★ Give a JVM-specific example of Gregg's "low utilisation does not mean no saturation".**
A connection pool of ten showing an average of six active connections looks half idle, while
`hikaricp.connections.pending` is regularly non-zero because the traffic arrives in bursts. Averaged
over a minute, utilisation is 60%; within any given 200 ms window it is 100% with threads queued.
The queue length is the signal and the average is the noise. The same thing happens with CPU when
your scrape interval is longer than your burst duration, which is the case Gregg describes.

**★ What is the single most useful saturation metric for a typical Spring Boot service, and why?**
`hikaricp.connections.pending` — the number of threads blocked waiting to borrow a database
connection. It matches Gregg's definition of saturation exactly (work the resource cannot service,
queued), it is zero in healthy operation so any non-zero value is meaningful without a threshold to
tune, and it becomes non-zero before request latency moves because a thread waiting on the pool has
not yet timed out. Its close cousin for async work is `executor.queued`.

**★ How do RED and USE relate for a single incident?**
RED localises and USE explains. RED on the affected service tells you whether the problem is
latency or errors and which endpoints are involved; RED on that service's downstream calls tells
you whether you are the cause or a victim; then USE on the service's own bounded resources — the
connection pool, the executor queues, GC pause fraction — tells you which resource is exhausted.
Wilkie's phrasing is the mnemonic: RED is about how happy your users are, USE is about how happy
your machines are, and they are two views of one system.


**★ Which resources would you put on a USE dashboard for a Spring Boot service, and in what
order?**
Connection pool first, because it is the resource most requests contend for and its saturation
metric is unambiguous. Then the task executors, because async work failing quietly is the hardest
class of problem to notice. Then the heap, expressed as GC time fraction rather than
used-over-max. Then CPU, from `process.cpu.usage`. Then the request thread pool, which needs
Tomcat's MBean registry turned on. Downstream services come last on the *resource* dashboard
because they are better served by RED on `http.client.requests`.

**★ What does it mean that a resource has no error metric?**
That its failures are expressed somewhere else. A thread pool with an unbounded queue never
rejects work, so it has no error count — it converts saturation directly into heap growth and
eventually an `OutOfMemoryError`. A garbage collector does not report errors; it reports longer
pauses until the process is unusable. The practical consequence is that an empty errors column is
a signal to look harder at the saturation column, and to check whether the resource is bounded at
all: an unbounded resource cannot saturate, it can only consume something else.

{/* FOOTER */}
