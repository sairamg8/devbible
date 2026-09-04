---
title: "Instrumenting a new service in the order that works: what you will be asked at 03:00 first, then what Boot already answers, then the two decisions that are irreversible once the first deploy has registered a meter, and only then any code of your own"
sidebar_label: "12 · The checklist"
sidebar_position: 33
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-03 — this page assembles conclusions established and sourced in the preceding
> chunks of this topic rather than introducing new claims; each step links to the page carrying
> its evidence. The underlying sources are the **Micrometer** reference
> ([docs.micrometer.io](https://docs.micrometer.io/micrometer/reference/concepts/)), the
> **Spring Boot 4.1 production-ready reference · Metrics**
> ([docs.spring.io](https://docs.spring.io/spring-boot/reference/actuator/metrics.html)) and the
> **Google SRE Workbook**, chapter 5 ([sre.google](https://sre.google/workbook/alerting-on-slos/)).
> JDK 25 · Spring Boot 4.1.1 / Spring Framework 7.0.9 · Micrometer 1.17.0.

**This is the order to instrument a service in, and the ordering is the content. Two of these
steps are effectively irreversible after the first deploy — common tags and the cardinality
bound — and both of them come before any code you write. The most common failure in this topic is
not under-instrumenting; it is doing step 5 first and discovering steps 2 and 3 six months later,
by which time the fix is a metric rename and every dashboard and alert that reads it.**

## Step 0 — Write down the question you will be asked at 03:00

Not "what should we measure". *What will somebody ask, out loud, while the service is
misbehaving?* There are only two shapes, and you need both:

- **Are users suffering, and how badly?** — rate, errors, duration.
  [05 · RED and USE](05-red-and-use.md).
- **Which resource is causing it?** — utilisation, saturation, errors, on the pools and queues a
  JVM service actually contends for. [05b · USE for a JVM service](05b-use-for-a-jvm-service.md).

Cost: an hour with a whiteboard, no code. This step is what stops you from building a dashboard of
things that are easy to measure instead of things that are worth knowing.

**Output:** a list of five to ten sentences of the form *"I will need to know X"*. Everything
below is in service of that list. A meter that does not answer one of them is a meter you are
paying for and will not read.

## Step 1 — Find out what you already have before writing a line

Spring Boot registers several hundred meters before your first instrumentation runs, and a large
fraction of step 0's list is already answered by them.

- What Boot gives you: [06 · What Boot gives you free](06-what-boot-gives-you-free.md).
- The one tag Boot normalises for you, with its four documented fallbacks:
  [06b · The `uri` tag](06b-the-uri-tag.md).
- The one it cannot normalise, on the client side:
  [06c · The client `uri` tag](06c-the-client-uri-tag.md).

Cost: run the service and read `/actuator/metrics`. Do this before step 5 and you will write
substantially less code.

## Step 2 — Install common tags, before anything registers a meter

**This is the first of the two irreversible steps.** A `MeterFilter` only affects meters
registered *after* it, so a common tag installed late is a common tag missing from every meter
binder that ran during context startup — which is most of them.

[04a · Common tags](04a-common-tags.md) has the ordering rule and the mechanism. The decisions to
make here are which dimensions belong on *every* series (`application`, `environment`, `region`,
`instance` — and that is usually the whole list) and, importantly, which do not: anything that
changes per deploy multiplies your entire metric surface every time you ship.

**Output:** one `MeterRegistryCustomizer` bean, registered early, reviewed by somebody other than
its author.

## Step 3 — Bound the cardinality before the first deploy

**The second irreversible step, and the one that causes incidents.** Every tag is a
multiplication, the product is paid in your heap and again in your backend, and the failure mode
is not a warning — it is a metrics backend that stops accepting writes.

- The multiplication, and the catalogue of tags that are unbounded in practice:
  [04b · Cardinality](04b-cardinality.md).
- The instrument for controlling it: [04c · `MeterFilter`](04c-meterfilter.md).
- Boot's own cap, which you should leave alone unless you can say why:
  [04d · Capping cardinality](04d-capping-cardinality.md).

**Output:** a written answer to *"what is the maximum number of distinct values this tag can
take?"* for every tag you have added. If the answer is "it depends on the request", the tag is
wrong or it needs `withMaximumAllowableTags`.

## Step 4 — Decide the histogram budget, per meter name, once

Distribution statistics are the difference between a timer that costs ~1.8kb and one that costs
~14.3kb, and between one series and dozens.

- Why a client-side percentile is not a number you can aggregate:
  [08 · Percentiles](08-percentiles.md).
- What `publishPercentileHistogram` actually adds:
  [08b · Histograms and buckets](08b-histograms-and-buckets.md).
- The one thing that gives you an exact answer about a promise you made:
  [08c · SLOs and the bucket budget](08c-slos-and-the-bucket-budget.md).
- The four inputs, decided together: [08d · The bucket budget](08d-the-bucket-budget.md).

**Output:** a list — usually one to three entries long — of the meter names that get a histogram,
and the SLO boundaries for each. Everything else gets count and total time, which is enough for a
rate and a mean and is nearly free.

## Step 5 — Only now, instrument your own code

By this point you know what you need, what you already have, and what a new series costs. What is
left is usually much smaller than the list you would have written on day one.

- The explicit forms and when each is right: [07 · Timing your own code](07-timing-your-own-code.md).
- `@Timed`, and the five conditions that make it silently do nothing:
  [07a · The timing annotations](07a-the-timing-annotations.md).
- The API to prefer, because one call site produces a metric, a span and a correlated log:
  [07b · The Observation API](07b-observation-api.md).
- How it is configured, and in what order: [07c · Configuring the observation registry](07c-configuring-the-observation-registry.md).

**Prefer `Observation` to a bare `Timer` for anything that crosses a boundary.** The metric alone
tells you a call was slow; the span tells you where, and the correlated log tells you what
happened to that specific request. Instrumenting three times for three signals is the thing this
API exists to stop.

## Step 6 — Wire the export, and check the exemplars

- The pull model and everything that follows from it:
  [09 · Exporting to Prometheus](09-exporting-to-prometheus.md).
- The cheapest high-value thing in the whole topic, and its four preconditions:
  [09b · Exemplars](09b-exemplars.md).

**Output:** `/actuator/prometheus` returning, and a scrape config that reaches it. Confirm the
`uri` tag is templated and not raw — this is the moment that mistake is cheap to fix.

## Step 7 — Write the alert before you need it

An alert is a claim that a human should stop what they are doing right now, and most alerts fail
that test.

- What makes an alert worth paging on: [10 · Alerting on what matters](10-alerting-on-what-matters.md).
- The rule shape that pages proportionally to how fast you are spending the budget:
  [10b · Burn-rate alerts](10b-burn-rate-alerts.md).
- The second window that makes the page clear promptly, the recording rules, and what to do for a
  service with too little traffic: [10c · Multi-window rules and low traffic](10c-multiwindow-rules-and-low-traffic.md).

**Output:** at least one symptom-based page, its recording rules, and an explicit note of what is
deliberately *not* paged.

## Step 8 — Measure what it cost, and put the numbers in the pull request

- The heap: [11 · Cost and overhead](11-cost-and-overhead.md).
- The scrape, the CPU and the four levers:
  [11b · The scrape, the CPU and the levers](11b-the-scrape-the-cpu-and-the-levers.md).

```bash
curl -s localhost:8080/actuator/prometheus | wc -c
curl -s localhost:8080/actuator/prometheus | grep -vc '^#'
```

**Output:** two numbers, in the pull request description, next to the two numbers from before the
change. This is the only part of an instrumentation change that is visible in review.

## The audit for a service that already exists

Running the list above backwards is a decent audit of a service somebody else instrumented.

| Question | Where the answer is | The bad answer |
|---|---|---|
| How many series does it publish? | `grep -vc '^#'` on the scrape | "We have never counted" |
| Which tag has the most values? | The backend's own cardinality view | An id, a version string, a raw path |
| Which meter names carry histograms? | `management.metrics.distribution.*` | "All of them" / "I don't know" |
| Are common tags on every series? | Pick any series and look | Some series have them, some do not |
| Which of these has an alert or a dashboard? | The alert rules | Fewer than a tenth |
| Is the `uri` tag templated? | Any `http.server.requests` series | `/orders/8a2f-...` |

**★ The most common finding is not a missing metric.** It is a large number of series nobody has
ever queried, sitting alongside one or two genuinely missing signals from step 0's list. The fix
is subtractive first and additive second, which is the opposite of what an instrumentation task
usually gets budgeted as.

## Gotchas

**★ Steps 2 and 3 are cheap before the first deploy and expensive after it.** A common tag added
later is missing from the historical data; a cardinality bound added later does not retroactively
delete the series you already created, so your backend keeps them for the retention period. Both
are minutes of work on day one.

**★ Doing step 5 first is the default failure, and it feels productive.** Writing timers is the
part that looks like engineering. It is also the part that produces the least value per hour,
because most of what you need is already registered by step 1 and the expensive mistakes are all
in steps 2 to 4.

**★ A step-0 list written after the code is a rationalisation of the code.** If the list is
produced by reading the existing metrics, it will contain exactly the questions the existing
metrics can answer, which is the one thing it must not be.

**★ "We'll add the alert later" means the metric is decorative.** A series with no alert and no
dashboard is a cost with no reader. That is a legitimate choice for a small number of
diagnostic-only meters, but it should be a choice, and the audit table above is how you find out
how many you have made by accident.

**★ The checklist does not include "add a dashboard".** Dashboards are for exploring an incident
you already know about; alerts are for finding out. Building the dashboard first produces a wall
of graphs that is very hard to read at 03:00 and gives no signal at all when nobody is looking at
it.

**★ Every step names the page carrying its evidence, and that is deliberate.** A checklist that
asserts without linking becomes cargo cult within one team rotation. If a step ever looks wrong
for your service, the link is where the reasoning is, and the reasoning is what tells you whether
your case is genuinely different.

**★ Step 6's `uri` check is the last cheap moment.** Once a raw path with ids in it has been
scraped for a week, you have a cardinality problem in the backend as well as in the process, and
fixing the tag does not clean up what is already stored.

**★ The order survives a rewrite; the specific meters do not.** Rewriting a service in another
framework changes step 1 entirely and leaves steps 0, 2, 3, 4, 7 and 8 identical. That is a
reasonable test of whether a checklist is about the domain or about the tool.

## Interview questions

**★ You are asked to add metrics to a service that has none. What do you do first?**
Not write a meter. Write down the questions somebody will ask while the service is misbehaving —
the RED questions about user suffering and the USE questions about which resource is causing it.
Then look at what the framework already publishes, because on Spring Boot that answers a large
part of the list before any code exists. Instrumentation written before that list exists measures
what is easy rather than what is needed.

**★ Which decisions in this process are hard to reverse, and why?**
Two. Common tags, because a `MeterFilter` only affects meters registered after it, so a tag
installed late is missing from every meter binder that ran during startup and from all historical
data. And the cardinality bound, because the series you have already created stay in the backend
for the retention period regardless of what you do to the code afterwards. Both cost minutes
before the first deploy and can cost a metric rename — and every dashboard and alert reading it —
afterwards.

**★ How do you decide which meters get percentile histograms?**
By starting from a promise rather than from curiosity. If there is a latency SLO, the meter that
measures it gets an SLO boundary, which gives an exact count of requests that breached the
promise. If there is not, the meter probably does not need a histogram at all: a count and a total
give you a rate and a mean for nearly nothing. The list should be one to three meter names long,
because each entry costs roughly the difference between ~1.8kb and ~14.3kb per series and
multiplies the series count by the bucket count.

**★ Why prefer the Observation API over a `Timer` when instrumenting new code?**
Because one call site then produces a metric, a span and a correlated log line, instead of three
separate instrumentations that drift apart. The metric tells you a call was slow, the span tells
you where in the call graph, and the correlated log tells you what happened to that specific
request. The cost is a configuration surface — five collaborators evaluated in a documented order
— which is real but is paid once per service rather than once per call site.

**★ You inherit a service publishing 40,000 time series. How do you approach it?**
Subtract before adding. Count the series and find the highest-cardinality tag; that single answer
usually accounts for most of the number, and it is almost always an id, a version string or an
untemplated path. Then list which meter names have an alert or a dashboard reading them, which is
typically under a tenth. Deny the rest at the registry rather than at the scrape, because only the
registry saves the heap and the rendering cost. Then, and only then, check step 0's list for what
is genuinely missing.

**★ What belongs in the pull request description for an instrumentation change?**
The payload size and the series count, before and after. Neither is visible in a diff, both are
one command, and the series count is the number the platform team will eventually raise. It also
makes the reviewer's question concrete: not "does this look reasonable" but "is 1,200 new series
worth this".

**★ Why is "add a dashboard" not on this list?**
Because a dashboard only helps once you already know there is a problem, and nothing on a
dashboard tells anybody that. The alert is the part that has to exist; the dashboard is what you
open after it fires. Teams that build the dashboard first usually end up with a lot of graphs, no
pages, and an incident found by a customer.

**★ A service handles a few hundred requests a day. Does this checklist change?**
Steps 0 to 6 and 8 are unchanged. Step 7 is the one that breaks: at that volume a single failure
is a four-figure burn rate, and burn-rate alerting pages immediately and constantly. The options
are the Workbook's — generate synthetic traffic, combine the service with related ones into a
larger monitored unit, reduce the user impact of a single failure, or lengthen the window and
accept slower detection. What does not work is tuning the threshold until it goes quiet.

{/* FOOTER */}
