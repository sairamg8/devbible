---
title: "Micrometer and the meter types"
sidebar_label: "8 · Micrometer and meter types"
sidebar_position: 8
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-19 against the Spring Boot 4.1.1 reference — *Actuator ·
> Metrics* (docs.spring.io/spring-boot/reference/actuator/metrics.html: the
> composite `MeterRegistry`, the supported registry list,
> `management.defaults.metrics.export.enabled`,
> `management.metrics.use-global-registry`, and the caveat about the static
> `Metrics` class) and the Micrometer 1.17 `io.micrometer.core.instrument`
> javadoc for `Counter`, `Gauge`, `Timer`, `LongTaskTimer` and
> `DistributionSummary`. Spring Boot 4.1.1, Spring Framework 7.0.x, JDK 25.

**Micrometer is to metrics what SLF4J is to logging: a vendor-neutral facade
your code compiles against, with the decision about where the data goes made by
whichever registry is on the classpath. Everything you instrument survives a
change of monitoring vendor, and the reason that matters is that the change of
monitoring vendor is one of the few things in a system's life that is genuinely
certain.**

## The facade and the registry

`MeterRegistry` is the thing you inject. Boot auto-configures a **composite**
registry, so meters you register once are published to every backend whose
registry implementation it found — the supported set includes AppOptics, Atlas,
Datadog, Dynatrace, Elastic, Ganglia, Graphite, Humio, Influx, JMX, KairosDB,
New Relic, OTLP, Prometheus, StatsD, Stackdriver and a simple in-memory one.

```properties
management.datadog.metrics.export.enabled=false     # one registry off
management.defaults.metrics.export.enabled=false    # all registries off by default
```

⚠️ **Inject the Spring-managed `MeterRegistry`; do not use the static
`Metrics` class.** The static global registry is a separate object with a
separate lifecycle, so meters registered on it are invisible to your configured
filters and common tags and are not cleaned up with the context — which shows up
in tests as meters leaking between contexts. `management.metrics.use-global-registry`
exists to switch the global registry off entirely, and turning it off is a
reasonable way to make the mistake impossible.

## The four meter types that matter

Getting the type right is most of the skill, because the wrong type produces a
number that is not wrong so much as meaningless.

**`Counter` — a monotonically increasing count.** Use it for events. Never for
a quantity that can go down.

```java
Counter ordersPlaced = Counter.builder("orders.placed")
        .description("orders accepted by the checkout endpoint")
        .tag("channel", "web")
        .register(registry);

ordersPlaced.increment();
```

You almost never graph a counter directly — you graph its **rate**, which the
backend computes. That is why a counter's absolute value being reset by a
restart does not matter.

**`Gauge` — a value sampled at scrape time.** Use it for a current level: queue
depth, cache size, active sessions, pool utilisation.

```java
Gauge.builder("checkout.queue.depth", pendingQueue, Queue::size)
        .register(registry);
```

🔴 **A gauge holds a weak reference to the object it samples.** If nothing else
references `pendingQueue`, it is collected and the gauge reports `NaN` forever
after. This is the single most common Micrometer bug and it is silent — the
metric does not disappear, it goes blank. Keep a strong reference in a field of
a bean, which is what the `MeterBinder` form in
[custom metrics](10-custom-metrics.md) does naturally.

**`Timer` — duration and count of short events, together.** A timer records
both, so you never need a separate counter for "how many requests".

```java
Timer paymentTimer = Timer.builder("payment.authorisation")
        .description("time to authorise a payment with the gateway")
        .tag("gateway", "primary")
        .register(registry);

Payment result = paymentTimer.recordCallable(() -> gateway.authorise(request));
```

There is also **`LongTaskTimer`**, which is a genuinely different thing and is
under-used: an ordinary `Timer` records a duration when the task *finishes*, so
a job that has been running for two hours and has not finished contributes
nothing. A `LongTaskTimer` reports the duration of tasks *currently in flight*,
which is what you want for batch jobs, migrations and anything where "it is
stuck" is the failure you care about.

**`DistributionSummary` — the distribution of a non-time quantity.** Payload
sizes, batch sizes, basket values.

```java
DistributionSummary responseSize = DistributionSummary.builder("response.size")
        .baseUnit("bytes")
        .register(registry);
```

### Naming

Micrometer's convention is lowercase, dot-separated, hierarchical from most to
least general: `orders.placed`, `payment.authorisation.duration`. The registry
translates that into whatever the backend wants — Prometheus turns dots into
underscores and appends a unit suffix, Graphite keeps the dots. Writing names
in the backend's dialect (`orders_placed_total`) defeats the facade and produces
a mangled name in every *other* backend.

## The trade-off

Metrics are cheap per event and expensive per **series**. A counter increment is
an atomic add; the cost lives in your monitoring backend, where every distinct
combination of name and tag values is a separate time series that is stored,
indexed and paid for. That asymmetry is why the interesting failure mode in
metrics is not overhead in your application — it is
[cardinality](11-tags-filters-cardinality.md), and it is severe enough to
have its own chunk.

The second trade is that the facade constrains you to roughly the intersection
of what backends support. A `Timer` gives you client-side percentiles or
exportable histograms, not arbitrary backend-specific aggregations, and a team
committed to one vendor's advanced features will occasionally find the facade in
the way. That is the price of the portability, and it is almost always worth
paying.

## Gotchas

**Symptom:** a gauge reports `NaN` after running for a while, and nothing in the logs explains it
**Cause:** gauges hold a **weak** reference to the sampled object; when nothing else references it, it is collected and the gauge goes blank rather than disappearing
**Fix:** keep a strong reference in a bean field, or register through a `MeterBinder`, which does so naturally:
```java
@Bean
MeterBinder queueDepth(PendingQueue queue) {
    return registry -> Gauge.builder("checkout.queue.depth", queue, PendingQueue::size)
            .register(registry);
}
```

**Symptom:** metrics registered in a `@Component` never appear in the export
**Cause:** they were registered on the static global `Metrics` registry rather than the injected `MeterRegistry`, so they bypass the configured registries, filters and common tags
**Fix:** inject `MeterRegistry`, and consider making the mistake impossible:
```properties
management.metrics.use-global-registry=false
```

**Symptom:** a long-running batch job shows nothing in its timer until it completes, and shows nothing at all when it hangs
**Cause:** a `Timer` records on completion, so an in-flight task contributes no data — the failure you most want to see is the one it cannot show
**Fix:** use a `LongTaskTimer`, which reports the duration of tasks currently running:
```java
LongTaskTimer.builder("reindex.duration").register(registry).record(this::reindexAll);
```

**Symptom:** metric names look right in Prometheus and mangled in a second backend added later
**Cause:** the names were written in Prometheus's dialect, with underscores and unit suffixes, so the other registry's naming convention transformed an already-transformed name
**Fix:** use Micrometer's convention — lowercase, dot-separated, `orders.placed` — and let each registry translate

**Symptom:** counts reset to zero after every deployment and somebody files a data-loss bug
**Cause:** an in-process counter is per-JVM and starts at zero; this is expected and is why counters exist
**Fix:** nothing in the application — query the **rate** rather than the absolute value, which is what every backend's counter functions assume

**Symptom:** a gauge on a `ConcurrentHashMap`'s `size()` becomes a performance problem under load
**Cause:** the sampling function runs on every scrape and `size()` on some concurrent collections is not a constant-time read
**Fix:** sample a cheap value — maintain an `AtomicInteger` alongside the collection and gauge that; a gauge's function should be a field read, not a computation

## Interview questions

**★ What is Micrometer and why does Spring Boot use a facade rather than a specific client?**
Micrometer is a vendor-neutral metrics facade — the same relationship to metrics
backends that SLF4J has to logging implementations. Your code depends on
`MeterRegistry`, and the destination is decided by which registry implementation
is on the classpath, with Boot auto-configuring a composite so several can be
active at once. The reason is that instrumentation lives in source code for
years while monitoring vendors change every few of them, and rewriting every
instrumentation call site during a vendor migration is not a project anyone gets
funded.

**★ Counter, gauge, timer, distribution summary — how do you choose?**
A counter is a monotonically increasing count of events, and you graph its rate
rather than its value. A gauge is a current level sampled at scrape time, for
things that go up and down — queue depth, pool utilisation, cache size. A timer
records duration *and* count for short operations, so it subsumes a counter for
the same events and you never need both. A distribution summary is a timer's
shape for a non-time quantity: payload sizes, batch sizes, basket values. The
most common mistake is a gauge where a counter belongs, which produces a value
whose behaviour under scrape intervals and restarts is simply meaningless.

**★ Why do gauges silently stop reporting?**
Because a gauge holds a weak reference to the object it samples, deliberately, so
that instrumentation can never keep an object alive and leak it. If the only
reference is the gauge's, the object is collected and the gauge reports `NaN`
from then on. The metric does not vanish — it goes blank — so nothing alerts and
the dashboard just has a flat line. Keeping a strong reference in a bean field
fixes it, and registering through a `MeterBinder` bean gives you that for free.

**★ What is a `LongTaskTimer` for, and why is an ordinary timer not enough?**
An ordinary `Timer` records a sample when the operation *completes*, so a batch
job that has been running for two hours contributes nothing until it finishes —
and if it never finishes, nothing at all, which means the timer is blind to
exactly the failure you care about. A `LongTaskTimer` reports the count and
duration of tasks currently in flight. Migrations, reindexes and scheduled jobs
want one; a request handler does not.

**★ Why does the naming convention matter if the backend renames everything anyway?**
Because the translation is one-directional and each registry applies its own. If
you write `orders_placed_total` because that is what Prometheus displays, the
Prometheus registry passes it through and every other registry transforms an
already-transformed name into something nobody recognises. Writing
`orders.placed` in Micrometer's convention means each backend produces its own
idiomatic form, which is the entire point of instrumenting against a facade.

**★ Someone injects `Metrics.counter(...)` from the static API. What breaks?**
The meter lands on Micrometer's static global registry rather than the
Spring-managed one, so it is not published through the configured registries,
does not receive common tags, is not seen by your `MeterFilter` beans, and is not
tied to the application context's lifecycle. The last part is what bites in
tests: meters accumulate across contexts because nothing cleans them up. Inject
`MeterRegistry`, and set `management.metrics.use-global-registry=false` if you
want the mistake to be impossible rather than merely discouraged.

---

← Prev: [Groups and graceful shutdown](07-groups-and-graceful-shutdown.md) · Index: [Actuator](README.md) · Next → [What Boot already measures](09-what-boot-measures.md)
