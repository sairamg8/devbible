---
title: "A gauge holds a weak reference to the thing it measures, so the object it was watching can be collected and the metric quietly becomes `NaN` — and the same `NaN` is returned when your value function throws, with a warning that is logged once and then downgraded to debug so that nobody ever sees it"
sidebar_label: "03b · The gauge that was collected"
sidebar_position: 4
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-01 against the **Micrometer 1.17.0 sources** at tag `v1.17.0` —
> [`DefaultGauge`](https://github.com/micrometer-metrics/micrometer/blob/v1.17.0/micrometer-core/src/main/java/io/micrometer/core/instrument/internal/DefaultGauge.java),
> which declares `private final WeakReference<T> ref`, constructs it with
> `this.ref = new WeakReference<>(obj)`, and whose `value()` returns `Double.NaN` both when
> `ref.get()` is null and when the value function throws — the latter logged through a
> `WarnThenDebugLogger`; and the **Micrometer 1.17 reference** — *Concepts · Gauges*
> ([docs.micrometer.io](https://docs.micrometer.io/micrometer/reference/concepts/gauges.html)).
> JDK 25 · Spring Boot 4.1.1 / Spring Framework 7.0.9 · Micrometer 1.17.0.

**Every other meter type holds its own state. A gauge does not — it holds a reference to something
in your application and reads it when the registry asks. That single design decision produces the
most confusing failure mode in Micrometer, because the reference is weak, and a weak reference is
exactly the kind of thing that works perfectly in a test and stops working in production once the
heap gets busy.**

## The source

`DefaultGauge` is short enough to hold in your head, and everything on this page follows from it:

```java
public class DefaultGauge<T> extends AbstractMeter implements Gauge {

    private static final WarnThenDebugLogger logger = new WarnThenDebugLogger(DefaultGauge.class);

    private final WeakReference<T> ref;
    private final ToDoubleFunction<T> value;

    public DefaultGauge(Meter.Id id, @Nullable T obj, ToDoubleFunction<T> value) {
        super(id);
        this.ref = new WeakReference<>(obj);
        this.value = value;
    }

    @Override
    public double value() {
        T obj = ref.get();
        if (obj != null) {
            try {
                return value.applyAsDouble(obj);
            }
            catch (Throwable ex) {
                logger.log(() -> "Failed to apply the value function for the gauge '"
                                 + getId().getName() + "'.", ex);
            }
        }
        return Double.NaN;
    }
}
```

Three facts, in the order they matter:

1. **The reference is weak.** The registry does not keep your object alive. If nothing else in the
   application holds a strong reference, the collector takes it and the gauge is measuring
   nothing.
2. **A collected referent produces `NaN`, silently.** No exception, no removal, no log line.
3. **A throwing value function *also* produces `NaN`** — and the failure goes through a
   `WarnThenDebugLogger`, which by design warns the first time and logs at debug thereafter. So a
   value function that throws on every scrape produces one warning, ever, and then nothing.

## Why the reference is weak, and why that is right

The alternative is worse. A registry holding strong references to every object anyone ever gauged
is a memory leak by construction: `Gauge` is often registered against short-lived or replaceable
objects — a cache instance that gets rebuilt, a connection pool that gets recreated on
reconfiguration, a per-tenant structure — and a strong reference would keep every generation of
them alive forever, rooted from a global registry. That failure would be worse than `NaN`, harder
to find, and would show up as a leak in [04 · `OutOfMemoryError`](../04-out-of-memory-error/README.md)
with the metrics registry as the dominator.

So the weak reference is a deliberate trade: **Micrometer chooses a visibly wrong metric over an
invisible memory leak.** Knowing that is what makes the behaviour predictable rather than
mysterious.

## How it actually happens

The canonical mistake is registering a gauge against something with no other owner:

```java
// Broken: the list is unreachable the moment this method returns.
Gauge.builder("queue.depth", new ArrayList<>(), List::size).register(registry);

// Broken in a subtler way: the map is a local that outlives nothing.
Map<String, Job> jobs = loadJobs();
Gauge.builder("jobs.pending", jobs, Map::size).register(registry);
```

The second is the one that ships, because it works — for a while. The local is reachable while
the enclosing method's frame is live, and in a test that is the whole test. In production the
method returns, the map becomes unreachable, and the next collection takes it. The metric was
correct in CI and is `NaN` in production, which is close to the worst possible distribution of
evidence.

The fix is that **something must own the object for as long as the gauge should exist**: a field
on a singleton bean, an entry in a long-lived structure, or a value the gauge closes over via a
strong reference the registry cannot see through. Registering against a field of the bean that
declares the gauge is the ordinary correct shape.

## `NaN` is not zero, and what it does downstream

`NaN` is not a small number or a missing sample — it is a value the exporters and backends each
handle differently. Prometheus can represent it; most dashboards render a gap; aggregation
functions over a series containing `NaN` frequently return `NaN` for the whole aggregate, which
means **one broken gauge can turn a working dashboard panel into a blank one**.

That is worth stating clearly because it changes the severity: a gauge whose referent was
collected does not merely lose its own series, it can poison an aggregate that several teams
depend on. And the failure is silent at every step — nothing throws, nothing alerts, and the panel
looks empty rather than broken.

## The other silent half: a throwing value function

The `catch (Throwable ex)` in `value()` is easy to skim past. Its effect is that any exception
inside your lambda — a `NullPointerException` because a field is not initialised yet, an
`IllegalStateException` from a pool that has been closed, a division by zero — becomes `NaN`
rather than a failure.

`WarnThenDebugLogger` is what makes it invisible: the name describes the behaviour exactly, and it
exists so that a repeated failure does not flood the log. The consequence for you is that the one
warning is emitted at startup or at the first scrape, is lost among startup logging, and every
subsequent occurrence is at debug — which is off. So **the log tells you once, at the least
convenient moment, and then never again.**

The defensive shape is to make the value function total: return a sentinel rather than throwing,
and guard the fields it reads.

## Gotchas

**★ A gauge holds a `WeakReference`, so the registry will not keep your object alive.**
`DefaultGauge` declares `private final WeakReference<T> ref`. If nothing else holds the object
strongly, it is collected and the gauge reports `NaN` from then on.

**★ It works in tests and fails in production, which is the worst failure distribution.**
A local variable is reachable for the duration of a short test. In a long-running service the
enclosing frame returns, the object becomes unreachable, and the next collection takes it.

**★ `NaN` is silent — no exception, no removal, no log line.**
The meter stays registered and keeps reporting. Nothing in the application indicates that the
thing being measured no longer exists.

**★ A throwing value function produces the same `NaN` as a collected referent.**
`value()` catches `Throwable` and falls through to `Double.NaN`, so two completely different bugs
present identically. Distinguishing them requires reading the code, not the metric.

**★ The warning for a throwing value function is logged once and then downgraded to debug.**
`WarnThenDebugLogger` does exactly what its name says. The single warning lands during startup
noise and every later occurrence is invisible.

**★ One `NaN` series can blank an entire aggregate panel.**
Many aggregation functions propagate `NaN`, so a single broken gauge can turn a dashboard several
teams rely on into an empty graph — a much larger blast radius than losing one series.

**★ The weak reference is deliberate and the alternative is worse.**
A registry holding strong references to every gauged object would keep every replaced cache, pool
and per-tenant structure alive forever, rooted from a global. Micrometer chose a visibly wrong
metric over an invisible leak.

**★ Registering a gauge against a freshly constructed argument is always wrong.**
`Gauge.builder("x", new ArrayList<>(), List::size)` is unreachable before the first scrape. It
compiles, registers cleanly, and never reports a number.

**★ The fix is ownership, not a Micrometer setting.**
Something in the application must hold the object for as long as the gauge should live — a field
on a singleton bean is the ordinary shape. There is no flag that makes the reference strong.

**★ `NaN` is not zero, and treating it as zero in an alert hides the failure.**
An alert written as "queue depth is 0" will not fire on `NaN`, and one written to coalesce `NaN`
to zero converts a broken gauge into a reassuring number. Alert on the absence of data separately.

**★ A gauge that is registered twice under the same identity does not replace the first.**
The registry keeps the original, so a second registration against a *live* object silently keeps
reading the *collected* one. This is how a "fixed" gauge stays broken after a redeploy of the
bean but not the process.

## Interview questions

**★ Your gauge reports `NaN` in production and worked in tests. What happened?**
Almost certainly the object it measures was garbage collected, because `DefaultGauge` holds it
through a `WeakReference` and `value()` returns `Double.NaN` when `ref.get()` comes back null. The
reason it worked in the test is that the object was reachable from a local variable for the whole
short life of the test, whereas in production the enclosing method returned, nothing else held the
object strongly, and the next collection took it. The fix is ownership rather than configuration:
the gauged object has to be reachable — a field on a singleton bean, an entry in a structure that
outlives the registration — for as long as the gauge is meant to report. It is worth also
checking the second possibility, because it presents identically: `value()` catches `Throwable`
from the value function and also returns `NaN`, so a lambda that throws produces the same symptom
with a completely different cause.

**★ Why does Micrometer use a weak reference at all, when it causes this?**
Because the alternative is a memory leak that would be much harder to diagnose. Gauges are
routinely registered against objects that are replaced during the application's life — a cache
that gets rebuilt on configuration change, a connection pool recreated after a failover, a
per-tenant structure that comes and goes — and if a globally reachable registry held strong
references, every generation of every one of those would be kept alive forever, rooted from a
static. That leak would show up as steadily growing old-generation occupancy with the metrics
registry as the dominator in a heap dump, and it would be extremely surprising to find the
monitoring library holding your application's history. So Micrometer takes the trade
deliberately: a metric that visibly reads `NaN` is a better failure than an invisible leak. Once
you know that is the reasoning, the behaviour stops being mysterious and becomes a constraint you
design around.

**★ How would you detect this class of bug across a whole service?**
By alerting on the absence of data rather than on its value, because every value-based alert is
blind to it. A rule that fires when a gauge series is missing or `NaN` for longer than some
interval catches both the collected referent and the throwing value function, and neither will
ever trip a threshold-based rule — a "queue depth above N" alert simply never fires. The second
mechanism is a startup or health check that reads every registered gauge once and asserts none of
them is `NaN`, which catches the freshly-constructed-argument mistake immediately rather than
after the first collection. And the third is to notice the blast radius in reverse: because many
aggregation functions propagate `NaN`, a panel that has silently gone blank is often the first
visible symptom, so a blank panel deserves investigation rather than a shrug. What does not work
is coalescing `NaN` to zero in the query, which is the common instinct and converts a detectable
failure into a reassuring number.

**★ Two different bugs produce `NaN` from a gauge. How do you tell them apart?**
Not from the metric, which is the point — `value()` returns `Double.NaN` both when `ref.get()` is
null and when the value function throws, so the two are indistinguishable downstream. You separate
them by reasoning about the code. If the gauged object is a local, a constructor argument, or
anything without a long-lived owner, suspect collection first. If it is a field on a singleton and
therefore certainly reachable, suspect the value function — a field read before initialisation, a
pool queried after close, an arithmetic edge case. The log is theoretically the discriminator,
because the throwing case is logged and the collected case is not, but in practice it is a weak
signal: the failure goes through a `WarnThenDebugLogger`, which warns once and then logs at debug,
so the single warning is emitted during startup and is very likely already rotated away by the
time anybody looks.

{/* FOOTER */}
