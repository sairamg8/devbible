---
title: "A counter and a gauge are not two ways to store a number — they are two different promises to the monitoring backend, and only one of them survives your next deploy"
sidebar_label: "03c · Counter vs gauge"
sidebar_position: 5
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-01 against the **Micrometer 1.17 reference** — *Concepts · Counters* and
> *Concepts · Gauges*
> ([docs.micrometer.io](https://docs.micrometer.io/micrometer/reference/concepts/counters.html)),
> and the **Prometheus documentation** — *Concepts · Metric types*
> ([prometheus.io](https://prometheus.io/docs/concepts/metric_types/)).
> No JVM was run for this page and no scrape output appears below that was not quoted from a
> document. JDK 25 · Spring Boot 4.1.1 / Spring Framework 7.0.9 · Micrometer 1.17.0 ·
> Prometheus Java client 1.5.1.

**The question "counter or gauge?" sounds like a storage question and is actually a question
about what you are promising the backend. A counter promises the series only goes up, and that
any drop to zero is a restart. A gauge promises nothing. Choosing a gauge for an event count does
not make a slightly worse graph — it makes a graph on which every increment between two scrapes
never happened and every deploy looks like an outage. This page is the choice; the arithmetic the
choice unlocks is [03e](03e-rate-aggregation-and-the-step-registry.md).**

## The two contracts, verbatim

Prometheus states both in two sentences:

> *"A counter is a cumulative metric that represents a single monotonically increasing counter
> whose value can only increase or be reset to zero on restart."*

> *"A gauge is a metric that represents a single numerical value that can arbitrarily go up and
> down."*

Read the counter definition again for the clause everyone skips: **"or be reset to zero on
restart"**. The reset is *part of the contract*, not a violation of it. The backend is told in
advance that a drop to zero means the process died, and it is entitled to act on that knowledge.
Nothing equivalent is true of a gauge — a gauge going down is simply a gauge going down, and no
query function can distinguish "the level fell" from "the pod was rescheduled".

Prometheus also gives the rule in imperative form, which is worth having in your head as a
sentence rather than a principle:

> *"Do not use a counter to expose a value that can decrease. For example, do not use a counter
> for the number of currently running processes; instead use a gauge."*

Micrometer's two prescriptions from [03](03-the-meter-types.md) sit on top of that — *"Never
count something you can time"* and *"Never gauge something you can count"* — and between the four
sentences almost every real case is decided.

## The "heisen-gauge", and what sampling costs you

Micrometer's gauge page is unusually explicit that a gauge is a *sampling* instrument, not an
accumulating one:

> *"Micrometer takes the stance that gauges should be sampled and not be set, so there is no
> information about what might have occurred between samples. Any intermediate values set on a
> gauge are lost by the time the gauge value is reported to a metrics backend, so there is little
> value in setting those intermediate values in the first place."*

> *"Think of a `Gauge` as a 'heisen-gauge': a meter that changes only when it is observed. Every
> other meter type accumulates intermediate counts toward the point where the data is sent to the
> metrics backend."*

That image is the whole difference. A counter is *read* at publish time but *accumulated*
continuously. A gauge is only ever the instantaneous value at publish time. With a 15-second
scrape, a gauge describes one instant out of every fifteen seconds of your service's life and
discards the rest — which is entirely fine for a pool size and catastrophic for anything you
wanted a total of.

## The anti-pattern, written out

```java
// WRONG — a counter wearing a gauge's clothes.
private final AtomicLong ordersPlaced = new AtomicLong();

MyService(MeterRegistry registry) {
    registry.gauge("orders.placed", ordersPlaced);   // returns the AtomicLong, not the Gauge
}

void placeOrder(Order o) {
    // ...
    ordersPlaced.incrementAndGet();
}
```

This compiles, publishes, and produces a line that goes up and to the right. It is broken in four
independent ways:

- **Restarts produce a cliff, not a reset.** The value drops from whatever it had reached to
  zero, and nothing in the query layer is entitled to repair it — see
  [03e](03e-rate-aggregation-and-the-step-registry.md).
- **It cannot be summed across instances into anything with a name.** Ten pods summed gives
  "orders since each pod last started", a quantity that depends on your deployment history rather
  than on your business.
- **It is unbounded**, which Micrometer names directly: *"We do not recommend using a gauge to
  monitor things like request count, as they can grow without bound for the duration of an
  application instance's life."*
- **Intermediate values are gone.** Harmless while the number only increases; instantly wrong the
  moment somebody "improves" it by decrementing on cancellation, because the cancellations between
  two scrapes vanish and the ones that happen to land on a scrape do not.

The fix is one line and changes the contract:

```java
private final Counter ordersPlaced;

MyService(MeterRegistry registry) {
    this.ordersPlaced = Counter.builder("orders.placed")
        .description("Orders accepted by this instance")
        .register(registry);
}

void placeOrder(Order o) {
    // ...
    ordersPlaced.increment();
}
```

…and if `placeOrder` is also timed anywhere, this counter should not exist at all: the timer's
`count` statistic already *is* it.

## The mirror-image mistake: a level modelled as a counter

The other direction is rarer and worse, because the API half-permits it. A counter has no
decrement — the interface *"lets you increment by a fixed amount, which must be positive"*. So
queue depth cannot be a counter. There are two correct answers and they are not interchangeable.

**A gauge over the live structure** — right when the structure can be asked its size cheaply and
without taking a lock:

```java
Gauge.builder("orders.queue.depth", queue, Queue::size)
    .description("Orders waiting to be dispatched")
    .register(registry);
```

**Two counters** — `orders.queue.enqueued` and `orders.queue.dequeued`:

```java
Counter enqueued = Counter.builder("orders.queue.enqueued").register(registry);
Counter dequeued = Counter.builder("orders.queue.dequeued").register(registry);
```

The backend subtracts the two *rates*, which answers "am I falling behind", and each counter
independently reports throughput on its side. That is strictly more information than the gauge,
and it is the only option when `size()` is O(n) or contended — `ConcurrentLinkedQueue.size()` is
documented as *not* a constant-time operation and traverses the queue.

What the two-counter form does **not** give you is the absolute depth. If you need depth and
trend, publish both; they answer different questions and it is not redundancy.

🔴 What you must not do is subtract the two counters' **raw values** in a dashboard. Counter
totals are not comparable across restarts — that is the reset clause again — so the subtraction
is only meaningful on rates. `enqueued_total - dequeued_total` gives a plausible-looking depth
that is wrong by the whole backlog every time a pod recycles.

## The decision, compressed

| What you are measuring | Meter | Why |
|---|---|---|
| An event happened, and it has a duration | `Timer` | publishes `count` too — you get the counter free |
| An event happened, no duration | `Counter` | you will graph the rate, and rate needs the contract |
| An event counted by someone else's monotonic method | `FunctionCounter` | portable rate normalisation; you assert monotonicity |
| A level that moves both ways and is cheap to read | `Gauge` | naturally bounded, sampling is adequate |
| A level where you need trend as well as depth | two `Counter`s, plus a `Gauge` if depth matters | rates of ins and outs answer "falling behind?" |
| A level you would have to `set()` on every change | you wanted a counter or a timer | the intermediate values are discarded anyway |
| Time since / until something | `TimeGauge` | the unit travels with the value |
| A level with a bounded, changing set of keys | `MultiGauge` | see [03d](03d-the-specialised-meters.md) |

## Gotchas

**★ `registry.gauge(name, number)` hands you back the number, not the meter, and that is a design
signal.** Micrometer: *"in this form, unlike other meter types, you do not get a reference to the
`Gauge` when creating one. Rather, you get a reference to the thing being observed."* The API is
telling you a gauge is not something you interact with. If your code calls `.set()` on the
returned object on every business event, you have built a counter badly.

**★ Constructing a gauge over a `Long`, `Integer` or any boxed primitive is always wrong.**
Verbatim: *"Attempting to construct a gauge with a primitive number or one of its `java.lang`
object forms is always incorrect. These numbers are immutable. Thus, the gauge cannot ever be
changed."* Use `AtomicLong` / `AtomicInteger`, or better, a function over a live object.

**★ Re-registering a gauge under the same name and tags is ignored, not replaced.** Micrometer
logs it once: *"WARNING: This Gauge has been already registered (MeterId{'{'}name='my.gauge',
tags=[]{'}'}), the registration will be ignored. Note that subsequent logs will be logged at debug
level."* Note the second sentence — every later occurrence is at debug, so a fleet-wide
misconfiguration produces exactly one log line per process.

**★ A `MeterFilter` can cause that collision without any duplicate registration in your code.**
The documentation calls this out: re-registration *"can happen indirectly for example as the
result of a `MeterFilter` modifying the name and/or the tags of two different gauges so that they
will be the same after the filter is applied."* An `ignoreTags` filter added to control cardinality
is the usual culprit — see [04d · Capping cardinality](04d-capping-cardinality.md).

**★ A gauge dropping to zero at 03:00 has three possible meanings and the graph cannot tell you
which.** The level genuinely fell; the process restarted; or the gauged object was garbage
collected and the gauge is reporting `NaN` or nothing
([03b](03b-the-gauge-that-was-garbage-collected.md)). A counter dropping to zero has exactly one
documented meaning. "Gauge everything, it is simpler" bills you at precisely the moment you need
the graph to be unambiguous.

**★ `Counter.increment(n)` requires a positive `n`, and passing a negative one is not a supported
way to model a decrease.** If you are reaching for it, re-read the mirror-image section: you want
a gauge, or two counters.

**★ The counter's absolute value is a deployment artefact, not a business number.** Two instances
of the same service started an hour apart show wildly different totals and identical rates.
Alerting on `orders_placed_total > 10000` means your alert state is a function of when you last
deployed.

**★ Success and failure of the same operation are one meter with a tag, not two meters.**
`orders.placed` carrying an `outcome` tag of `success` or `failure` lets the backend compute an error
ratio in one expression. `orders.placed` plus a separate `orders.failed` forces a join across two
series that can be scraped at different instants and maintained by different people.
[04 · Tags](04-tags.md) is the general form of this argument.

**★ Prometheus's server does not enforce the type, so a wrong choice is never an error.** From the
metric-types page: the server *"does not yet make use of the type information and flattens all
types except native histograms into untyped time series of floating point values."* The type is
metadata for exposition and for humans. Choosing wrong produces a plausible number, never a
failure.

**★ A gauge over a collection you also mutate concurrently can be an expensive gauge.** The value
function runs on the publishing thread at every scrape. `Queue::size` on a linked queue,
`Map::size` on some concurrent maps, or anything that takes a lock, turns your scrape into a
contention point — and the scrape happens on every instance simultaneously if your scrape
intervals are aligned.

## Interview questions

**★ Why does the counter-versus-gauge distinction matter if Prometheus flattens both to floats?**
Because the distinction is not about storage, it is about what the query functions are entitled to
assume. `rate()` and `increase()` are documented to adjust automatically for breaks in
monotonicity, and they can only do that because a counter has promised that any decrease is a
restart. Applying them to a gauge is not rejected — Prometheus's server does not use the type at
evaluation time — it is just meaningless, because every legitimate downward movement of the level
gets reinterpreted as a restart and added back into the total. The contract is enforced at the
point of interpretation, not at the point of storage.

**★ A colleague has instrumented request counts as an `AtomicLong` gauge and the graph looks
right. What do you tell them, concretely?**
Three things, in order. First, it looks right until the next deploy, when it falls to zero and
every rate-like derivation goes negative; a counter's reset is repaired by the query layer, a
gauge's is not. Second, the value cannot be summed across instances into anything with a name,
because "orders since each pod last started" is a fact about your deploy schedule. Third, they
opted out of the entire rate machinery for zero benefit — `Counter.increment()` is the same
amount of code. Then check whether the operation is timed anywhere, because if it is, the counter
should be deleted rather than converted.

**★ You need queue depth and queue throughput. What do you register, and what changes your
answer?**
A `Gauge` over the queue for depth plus two counters for enqueue and dequeue. The gauge answers
"how deep right now"; the difference of the two counter rates answers "is it growing", which is
the question that predicts the incident. What changes the answer is the cost of `size()`: if it
is O(n) or contended — `ConcurrentLinkedQueue` is the classic case — drop the gauge, because the
value function runs on the publishing thread at every scrape. You keep the alertable signal and
lose only the absolute number.

**★ What does "heisen-gauge" mean and what does it rule out?**
It is Micrometer's own term for the fact that a gauge changes only when observed: it is sampled at
publish time and everything between samples is discarded. It rules out any quantity whose *total
over an interval* is what you care about, because that total is exactly what sampling throws
away. It permits any quantity whose *instantaneous value* is the thing — pool size, queue depth,
certificate expiry, heap used.

**★ Your dashboard shows a counter decreasing. Give three explanations and say which needs a code
change.**
One: a restart — documented, benign, and already handled by `rate()`. Two: it is not really a
counter but a `FunctionCounter` over a non-monotonic function, so the underlying value genuinely
went down; that is an instrumentation bug and needs a code change. Three: it is a step registry's
per-interval export being read as if it were cumulative, so nothing decreased at all and the
reader needs to be told which registry they are looking at. Only the second is your code's fault.

**★ When is summing a gauge across instances legitimate?**
When the gauge measures a resource genuinely partitioned across the fleet and the sum names
something real: total connections in use, total queue depth across consumers, total heap
committed. It is illegitimate when the gauge is a per-instance cumulative total, because then the
sum is a function of restart history; and when the quantity is a ratio, a percentage or a maximum,
because summing those is arithmetic on the wrong scale — you wanted `avg`, `max`, or a
count-weighted mean.

**★ Give an example where a gauge is the only correct choice even though the thing being measured
is a count of events.**
A count of events *currently in flight* — active requests, in-progress batch jobs, checked-out
connections. It is a count, but it is a count of a *population*, not of *occurrences*: it goes up
and down, it is naturally bounded by a pool or a thread limit, and its instantaneous value is
what you act on. Micrometer's `LongTaskTimer` exists for precisely this shape when the population
is "operations still running", and its active-task count is explicitly listed as one of the
measurements that is *not* a rate.

{/* FOOTER */}
