---
title: "A timer with a percentile histogram holds about fourteen kilobytes of heap and the documentation prints the formula, which means the memory your metrics cost is the one observability number you can compute before you deploy rather than discover in a heap dump"
sidebar_label: "11 · Cost and overhead"
sidebar_position: 31
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-03 against the **Micrometer** reference · *Timers* — the *Memory Footprint
> Estimation* section, its variable definitions and its configuration table
> ([docs.micrometer.io](https://docs.micrometer.io/micrometer/reference/concepts/timers.html));
> *Meter Filters* — the `DENY`/NOOP behaviour
> ([docs.micrometer.io](https://docs.micrometer.io/micrometer/reference/concepts/meter-filters.html));
> *Registry* — *"Meters in Micrometer are created from and held in a `MeterRegistry`"*
> ([docs.micrometer.io](https://docs.micrometer.io/micrometer/reference/concepts/registry.html));
> and the **Spring Boot 4.1 production-ready reference · Metrics** for the per-meter
> `management.metrics.enable.*` and `management.metrics.distribution.*` properties
> ([docs.spring.io](https://docs.spring.io/spring-boot/reference/actuator/metrics.html)).
> 🔴 **No sandbox.** Every kilobyte figure on this page is Micrometer's own published estimate,
> quoted as such; nothing here was measured. JDK 25 · Spring Boot 4.1.0 · Micrometer 1.17.0.

**Every other page in this topic has told you what a metric is worth. This one tells you what it
costs, and the reason it can is unusual: Micrometer publishes the memory formula for its most
expensive meter, so the heap your instrumentation will occupy is arithmetic you can do at design
time rather than a surprise in a heap dump.**

Three costs are paid, and they are paid in different places by different people. **Heap**, in your
process, once per meter and for the life of the process. **Scrape**, on the wire and in the
backend, once per series per scrape interval, for as long as you retain it. And **CPU**, split
very unevenly between a recording path that is almost free and a scrape path that is not. The
sections below take them in that order, because that is the order in which they surprise people.

## The quotable sentence

> *"Timers are the most memory-consuming meter, and their total footprint can vary dramatically,
> depending on which options you choose."*

Both halves matter. Timers are the expensive ones — which is unfortunate, because timers are also
the meters you actually care about, since `http.server.requests` is a timer and so is every
`@Timed` method. And the variance is not marginal: the documented configurations in the table
below span **~0.1kb to ~14.3kb for a single timer**, a factor of over a hundred, decided entirely
by two configuration flags most services never look at.

## The variables, as the documentation defines them

| Symbol | What it is | Default |
|---|---|---|
| **R** | Ring buffer length — `Timer.Builder#distributionStatisticBufferLength` | **3** |
| **B** | Total histogram buckets, derived from SLO boundaries or percentile-histogram buckets; the default range spans **1ms to 30 seconds** | **66** for percentile histograms |
| **I** | Interval estimator, present only when pause detection is on | **~1.7kb** |
| **M** | Time-decaying max | **104 bytes** |
| **Fb** | Fixed-boundary histogram | **8 bytes × B × R** |
| **Hdr(Pp)** | High dynamic range histogram, present only for client-side percentiles | see below |
| **Pp** | Percentile precision — `Timer.Builder#percentilePrecision`, range **0–3** | **1** |

`Hdr(Pp)` is where the cost lives, and it is not linear in `Pp`:

| `Pp` | Size |
|---|---|
| 0 | 1.9kb × R + 0.8kb |
| 1 | 3.8kb × R + 1.1kb |
| 2 | 18.2kb × R + 4.7kb |
| 3 | 66kb × R + 33kb |

**★ Read that table as a warning about `percentilePrecision`, not as an invitation to tune it.**
Going from the default `Pp=1` to `Pp=3` multiplies the histogram by roughly seventeen — at the
default `R=3`, from about 12.5kb to about 231kb **per timer**. There is no configuration in this
topic with a worse cost-to-benefit ratio, and [08 · Percentiles](08-percentiles.md) already
explained that the precision you are buying is precision in a number you cannot aggregate across
instances anyway.

## The whole table, which is the page to bank

| Pause detection | Client percentiles | Histogram / SLOs | Formula | Documented example |
|---|---|---|---|---|
| Yes | No | No | I + M | **~1.8kb** |
| Yes | No | Yes | I + M + Fb | **~7.7kb** (defaults) |
| Yes | Yes | Yes | I + M + Hdr(Pp) | **~14.3kb** (0.95 percentile) |
| No | No | No | M | **~0.1kb** |
| No | No | Yes | M + Fb | **~6kb** (defaults) |
| No | Yes | Yes | M + Hdr(Pp) | **~12.6kb** (0.95 percentile) |

Three readings fall straight out of it.

**Pause detection is the floor, and it is about 1.7kb of it.** The difference between row 1
(~1.8kb) and row 4 (~0.1kb) is almost entirely `I`. A timer with pause detection off and no
distribution statistics is essentially free — a hundred bytes — and a timer with pause detection
on has already spent eighteen times that before it has recorded anything.

**Turning on a histogram costs about 6kb at the defaults, whatever else you have set.** Rows 1→2
and 4→5 both move by roughly six kilobytes, which is `Fb` = 8 bytes × 66 buckets × 3 buffers ≈
1.6kb… and does not obviously match. The documented examples are the authority here, not the
arithmetic: treat `Fb`'s formula as the shape and the ~6kb as the number.

**Client-side percentiles roughly double a histogram-enabled timer.** ~7.7kb → ~14.3kb. That is
the price of a statistic that [08 · Percentiles](08-percentiles.md) argues you should not be
publishing from more than one instance in the first place.

## The Prometheus footnote that changes the arithmetic

> *"For Prometheus, specifically, R is always equal to 1, regardless of how you attempt to
> configure it through `Timer.Builder`"*

**★ On Prometheus every `× R` in the table above collapses to `× 1`, and your
`distributionStatisticBufferLength` setting is ignored.** This is the single most useful sentence
on the page for a Spring Boot service, because Prometheus is the default export target in this
corpus — see [09 · Exporting to Prometheus](09-exporting-to-prometheus.md). It is not a bug and it
is not overridable: Prometheus wants cumulative histograms, and a ring buffer of decaying windows
is the wrong shape for that, so the registry pins it. The practical consequence is that a
Prometheus service pays roughly a third of the `Hdr` and `Fb` costs the table implies, and that
anyone who "tuned" the buffer length for memory reasons on Prometheus changed nothing at all.

## Heap: multiplying it out

The unit of cost is not the meter you declared, it is the **time series** — one per distinct
combination of name and tag values. [04b · Cardinality](04b-cardinality.md) is the page about how
that number gets large; this is the page about what each one costs once it has.

The multiplication is:

```
heap ≈ (per-meter footprint from the table) × (distinct tag combinations)
```

For `http.server.requests` on a Boot service, the tag set is roughly `method` × `uri` ×
`status` × `outcome` × `exception`, and [06b · The `uri` tag](06b-the-uri-tag.md) is what keeps
`uri` finite. A service with 40 routes, 3 methods in use and 5 observed status codes is already at
600 combinations — and at the ~7.7kb default row, **600 × 7.7kb ≈ 4.6MB of heap for one meter
name**, before any of your own instrumentation exists.

**★ That number is why the `uri` cap exists rather than why cardinality is "untidy".** Boot's
default cap of 100 distinct `uri` values, covered in
[04d · Capping cardinality](04d-capping-cardinality.md), is a memory control. Remove it on a
service that takes an id in a path and the multiplication has no upper bound, so neither does the
heap.

**Meters are held for the life of the process unless you remove them.** The reference is explicit
that *"Meters in Micrometer are created from and held in a `MeterRegistry`"* — the registry is the
owner, not a cache. Nothing evicts a time series because its route was retired or its tag value
stopped appearing. A series you created once during startup is a series you are paying for at
03:00 six months later.

## What a `DENY` actually saves

> *"When you try to register a meter against a registry and the filter returns `DENY`, the registry
> returns a NOOP version of that meter (for example, `NoopCounter` or `NoopTimer`). Your code can
> continue to interact with the NOOP meter, but anything recorded to it is discarded immediately
> with minimal overhead."*

**★ A denied meter costs a NOOP object, not the footprint in the table.** This is the mechanism
behind every lever in [04c · `MeterFilter`](04c-meterfilter.md) and behind
`management.metrics.enable.*`: you are not suppressing the *export* of a meter that still exists,
you are preventing the distribution statistics from ever being allocated. That is why a filter is
cheap enough to apply broadly, and why "we'll just drop it at the scrape" is a strictly worse plan
— it saves the wire and the backend, and none of the heap.

The corresponding Boot property is per-meter-name and hierarchical:

```yaml
management:
  metrics:
    enable:
      jvm: true
      process: false
      logback: true
```


**★ A denied meter is the only meter that costs nothing.** Everything else in this topic — a
filter that renames, a filter that adds a common tag, a property that changes a histogram — still
leaves a `Timer` in the registry with a footprint from the table above. `DENY` is the one lever
that removes the allocation rather than changing it.

The scrape-side and CPU-side halves of the cost, and the order to reach for the levers, are
[11b · The scrape, the CPU and the levers](11b-the-scrape-the-cpu-and-the-levers.md).

## Gotchas

**★ `percentilePrecision=3` is a 231kb-per-timer decision.** 66kb × R + 33kb, at the default
`R=3`. On a meter with a few hundred tag combinations that is tens of megabytes of heap for a
statistic that cannot be aggregated across instances. Nobody sets this deliberately; people set it
because "3" looked like "more accurate".

**★ Setting `distributionStatisticBufferLength` on a Prometheus service does nothing, silently.**
The documentation says R *"is always equal to 1, regardless of how you attempt to configure it"*.
No warning is logged, the builder accepts the value, and the memory does not change.

**★ The cheap-looking row is the one nobody is on.** ~0.1kb requires pause detection off *and* no
histogram *and* no client percentiles. Boot's defaults for `http.server.requests` are not that
row, and the difference between the row people assume they are on and the one they are actually on
is roughly seventy-fold.

**★ Retired routes never leave the registry.** Delete a controller and redeploy and the series is
gone — because the process restarted, not because anything unregistered it. Within a running
process, a meter created for a tag value that will never appear again is paid for until shutdown.

**★ A `MeterFilter` only affects meters registered after it.** This is the ordering rule from
[04a · Common tags](04a-common-tags.md) and [04c](04c-meterfilter.md), and it has a cost
consequence: a filter registered too late does not merely fail to rename a meter, it fails to
prevent that meter's histogram from being allocated. The memory is spent at registration.

**★ The table's numbers are per timer, not per meter name.** Every reading of the estimate that
starts "we only have 30 timers" is off by the tag-combination factor, which is usually one to
three orders of magnitude.

**★ Counters and gauges are not in the table because they are not the problem.** The documentation
singles out timers as *"the most memory-consuming meter"*. If your metrics heap is large, it is
timers and distribution summaries; auditing counters is time spent on the wrong meters.

**★ The figures are estimates and the documentation says so.** They are labelled a *footprint
estimation*, and the examples are prefixed with `~`. Use them for the order of magnitude and for
the ratios between rows, which are the decision-relevant part; do not quote them to three
significant figures in a capacity plan, and do not treat a heap dump that disagrees by 20% as
evidence that something is wrong.

**★ Two registries mean two copies.** A composite registry that exports to Prometheus *and* to a
step registry holds a meter in each — including a distribution statistic in each, with each
registry's own R. This is the case where the Prometheus `R=1` pinning stops helping, because the
other registry is not pinned.

**★ The 30-second ceiling in `B`'s default range is a real boundary, not a formality.** The
default histogram spans 1ms to 30 seconds. A timer measuring something that routinely runs longer
lands everything in the overflow bucket, so you pay the full 66-bucket footprint and get a
distribution with no resolution where your data actually is. If the operation is minutes long, set
the range or do not publish a histogram for it.

## Interview questions

**★ Which Micrometer meter type is the most memory-hungry, and by how much?**
Timers — the reference says so in as many words: *"Timers are the most memory-consuming meter, and
their total footprint can vary dramatically, depending on which options you choose."* The
documented range for a single timer is about **0.1kb** with pause detection off and no
distribution statistics, to about **14.3kb** with pause detection, a histogram and client-side
percentiles at 0.95. The two flags that move it most are pause detection (~1.7kb of interval
estimator) and the choice between a fixed-boundary histogram and an HDR histogram.

**★ You have a `MeterRegistry` using 300MB. Where do you look first, and what is the arithmetic?**
Not at the number of meter *names* — at the number of **time series**, which is names × distinct
tag-value combinations. Multiply that count by the per-timer footprint for your configuration
(~7.7kb at Boot's histogram defaults, ~14.3kb with client percentiles). A single
`http.server.requests` with 600 combinations is already several megabytes. Then find the unbounded
tag: a path variable leaking into `uri`, a version string, a user id — the catalogue is in
[04b · Cardinality](04b-cardinality.md).

**★ Why does `distributionStatisticBufferLength` not help on Prometheus?**
Because the Prometheus registry pins the ring buffer length to 1 — the documentation says R
*"is always equal to 1, regardless of how you attempt to configure it through `Timer.Builder`"*.
Prometheus expects cumulative histograms, so the decaying multi-window ring buffer that R
configures is the wrong shape for it. The upside is that Prometheus services already pay about a
third of the `Hdr`/`Fb` costs the general table implies; the downside is that a memory fix based
on tuning R is a no-op that logs nothing.

**★ A team wants `percentilePrecision=3` "for accuracy". What do you tell them?**
That the HDR histogram goes from 3.8kb × R + 1.1kb to 66kb × R + 33kb — about seventeen times
larger, roughly 231kb per timer at the default buffer length — and that the accuracy being bought
is accuracy in a client-side percentile, which [08 · Percentiles](08-percentiles.md) shows cannot
be aggregated across instances. If they need better latency answers across the fleet, the answer
is an SLO boundary and a server-side histogram ([08c](08c-slos-and-the-bucket-budget.md)), not
more precision in a number that has to be averaged to be displayed.

**★ Does a meter for a route you have deleted still cost you?**
Within the running process, yes. The registry *holds* meters; nothing evicts them when a tag value
stops appearing. It goes away at the next restart, which means a long-lived process accumulates
the union of every tag combination it has ever seen — one of the reasons an unbounded tag is a
slow leak rather than a step change.

**★ What exactly does a `MeterFilter` returning `DENY` save you, in memory terms?**
The distribution statistics — which is nearly all of it. The registry hands back a NOOP meter and
*"anything recorded to it is discarded immediately with minimal overhead"*, so no interval
estimator, no time-decaying max, no histogram and no HDR buffers are ever allocated for that id.
What remains is a NOOP object, which is a rounding error against the ~7.7kb the real meter would
have cost.

**★ Estimate the metrics heap for a service before it is written. What do you need to know?**
Four numbers, and they are all knowable at design time: the number of meter names you intend to
publish, the expected distinct tag combinations per name, which row of the footprint table your
configuration puts you on, and whether the export target pins `R`. Multiply the second by the
third and sum over the first. The point of doing it in advance is that the answer changes design
decisions — a tag you were about to add stops looking free when it multiplies a 7.7kb figure by
ten.

**★ Why is pause detection on by default if it costs eighteen times the base footprint?**
Because the base footprint is a hundred bytes, so eighteen times it is still under two kilobytes,
and what it buys is correction for coordinated omission — the effect where a stalled system stops
generating the very samples that would have shown the stall. It is a good default. It stops being
free when you have thousands of timers, which is the point at which disabling it per meter name
becomes a real lever rather than a micro-optimisation.

{/* FOOTER */}
