---
title: "Cardinality is a multiplication you perform every time you type a dot-tag, the product is paid twice — once in your heap and once in a database somebody else operates — and the only reliable moment to stop it is before the code merges"
sidebar_label: "04b · Cardinality"
sidebar_position: 10
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-01 against the **Micrometer 1.17 reference** — *Concepts · Naming Meters ·
> Tag Values* and *Concepts · Histograms and Percentiles*
> ([docs.micrometer.io](https://docs.micrometer.io/micrometer/reference/concepts/naming.html)),
> the **Prometheus documentation** — *Best practices · Metric and label naming* and *Concepts ·
> Data model* ([prometheus.io](https://prometheus.io/docs/practices/naming/)), and the
> **Spring Framework 7 reference** — *Integration · Observability*
> ([docs.spring.io](https://docs.spring.io/spring-framework/reference/integration/observability.html)).
> No JVM was run for this page and no series counts below are measurements — every number is
> arithmetic on the documented bucket counts, shown with its working. JDK 25 · Spring Boot 4.1.0 ·
> Micrometer 1.17.0.

**A tag with an unbounded value set does not degrade your metrics; it destroys the system that
stores them, and usually that system is shared with every other team. The mechanism is a
multiplication that nobody performs at the keyboard, and the reason it keeps happening is that the
code that causes it is indistinguishable, at review time, from the code that does not.**

## The multiplication

A meter's identity is name plus tags ([04](04-tags.md)). So the number of time series a single
meter name produces is the product of the value counts of its tags, times the value counts of your
common tags:

```
series(name) = ∏ distinct values of each tag  ×  ∏ distinct values of each common tag
```

Two things about that formula are counter-intuitive enough to be worth saying out loud.

**It is a product, not a sum.** Adding a fourth tag with five values to a meter that already had
three tags does not add five series; it multiplies the existing count by five. Reviewers reason
additively — "it is only one more tag" — and the system behaves multiplicatively.

**A timer is not one series.** Micrometer's own arithmetic, from the histogram documentation:

> *"By default, the generator yields 276 buckets, but Micrometer includes only those that are
> within the range set by `minimumExpectedValue` and `maximumExpectedValue`, inclusive. Micrometer
> clamps timers by default to a range of 1 millisecond to 1 minute, **yielding 73 histogram
> buckets per timer dimension**."*

So a timer with `publishPercentileHistogram` produces 73 bucket series *plus* `count`, `sum` and
`max` — call it 76 — **per tag combination**. A timer with three tags of 4, 5 and 10 values is
200 combinations, which is 15,200 series from one `Timer.builder(...)` call. [08b · Histograms and
buckets](08b-histograms-and-buckets.md) is where that budget gets managed deliberately.

*(That is arithmetic on Micrometer's documented bucket counts, not a measurement.)*

## Why it is paid twice

**In your process.** Every distinct combination is a live `Meter` object held in the registry's
map, with its `Meter.Id`, its immutable tag list, and its accumulator state — for a timer with a
histogram, an `HdrHistogram` structure whose footprint is a function of the configured range.
**Nothing evicts them.** The registry has no TTL and no LRU; a meter registered once lives until
the process exits. That is not an oversight — a metric that disappeared when traffic stopped would
break every rate calculation — but it means an unbounded tag is a textbook memory leak with a
metrics-shaped API. When it kills the process it kills it with `java.lang.OutOfMemoryError: Java
heap space` and a dominator tree pointing at a `ConcurrentHashMap` inside the registry
([04 · `OutOfMemoryError`](../04-out-of-memory-error/README.md)).

**In the backend.** Prometheus is blunt:

> *"CAUTION: Remember that every unique combination of key-value label pairs represents a new time
> series, which can dramatically increase the amount of data stored. **Do not use labels to store
> dimensions with high cardinality (many different label values), such as user IDs, email
> addresses, or other unbounded sets of values.**"*

The asymmetry that makes this a social problem rather than a technical one: the cost lands on a
shared time-series database, on the ingestion pipeline, on the query latency of every dashboard in
the company, and on a bill that is not attributed to your service. Your service, meanwhile, looks
fine.

## Micrometer names the sneaky case

> *"Beware of the potential for tag values coming from user-supplied sources to blow up the
> cardinality of a metric. You should always carefully normalize and add bounds to user-supplied
> input. **Sometimes, the cause is sneaky.** Consider the URI tag for recording HTTP requests on
> service endpoints. If we do not constrain 404's to a value like `NOT_FOUND`, the dimensionality
> of the metric would grow with each resource that cannot be found."*

Read the 404 example carefully, because it is the best one in the documentation. The tag is
`uri`, which is *bounded* — you have forty endpoints. But a request to a path that matches no
handler has no URI template to report, so a naive implementation reports the raw path. And the raw
paths that match no handler are chosen by **whoever is scanning your service on the public
internet**. Your cardinality is now controlled by an adversary. Spring solves this specifically,
and the way it solves it is worth a page of its own —
[06b · The URI tag](06b-the-uri-tag.md).

## The catalogue of unbounded tags

Every one of these has shipped. The first three are obvious in hindsight; the rest are why this
page exists.

| Tag value | Why it is unbounded |
|---|---|
| user id, tenant id, account id | one series per user, forever |
| order id, request id, session id, trace id | one series per *request* |
| the raw request path | attacker-controlled on 404, as above |
| `exception.getMessage()` | messages embed ids, row counts, file paths, SQL fragments |
| a downstream host or resolved IP | changes on every deploy of the *other* service |
| a generated queue or topic name | reply queues are usually per-consumer or per-request |
| a version string (`app.version`, `client.version`) | grows monotonically forever, never shrinks |
| a date, a day-of-month, an hour bucket | the series count grows with the age of your service |
| a retry attempt number, an unbounded page number | bounded in theory, unbounded when something misbehaves |
| an enum from an *external* API | bounded by someone else's release schedule, not yours |
| an HTTP `User-Agent` or `Referer` | effectively free-text |
| a full SQL statement | unbounded when the query is built by string concatenation |
| a Kubernetes pod name as a **common** tag | multiplies the *whole* surface, and rolls on every deploy |

The last row is the expensive one. A per-meter tag with N values multiplies one meter. A common
tag with N values multiplies **every meter the process exports**, including the several hundred
that the JVM, Hikari, Tomcat and cache binders registered without you asking
([04a · Common tags](04a-common-tags.md)).

## The version-string trap, in full

It looks bounded and it is not:

```java
// Looks harmless. Is not.
Counter.builder("api.calls")
    .tag("client.version", request.getHeader("X-Client-Version"))
    .register(registry);
```

Three separate problems. The header is client-supplied, so it is unbounded in the same way a user
id is. Even if it were honest, a mobile client fleet has hundreds of live versions and gains one a
week and never loses one, because the registry never evicts. And the series that matter — the
current version and the previous one — are drowned in a long tail you will never look at.

If you genuinely need per-version comparison, the bounded form is a *derived* tag:

```java
private static final Set<String> TRACKED = Set.of("current", "previous");

String versionBucket(String raw) {
    if (raw == null) return "unknown";
    if (raw.equals(currentVersion)) return "current";
    if (raw.equals(previousVersion)) return "previous";
    return "other";                                  // the long tail collapses to one series
}
```

Four values, forever, regardless of what any client sends. That is the shape of every correct fix
on this page: **map an unbounded domain onto a small fixed codomain at the call site.** The
`MeterFilter` mechanisms in [04c](04c-meterfilter.md) do the same thing centrally when you cannot
change the call site, and [04d](04d-capping-cardinality.md) is the hard limit for when neither
worked.

## How you find out, in rough order of how much it has already cost

1. **`/actuator/metrics/<name>`** shows `availableTags` with their value lists. A tag with hundreds
   of listed values is your answer, and this is the check that costs nothing.
2. **Scrape size and scrape duration.** Prometheus records `scrape_samples_scraped` and
   `scrape_duration_seconds` per target. A target whose sample count is climbing steadily while
   its traffic is flat is registering meters it never had before.
3. **Your own heap.** Steadily-rising old-generation occupancy with no corresponding business
   growth, and a heap dump whose dominators are `Meter.Id` and `Tags` instances.
4. **A message from whoever runs the time-series database.** By this point the cost is measured in
   somebody else's on-call.

## What you can and cannot undo

Deploying the fix stops the *growth*. It does not delete what you emitted: those series are in the
backend until retention expires, they continue to consume index space, and queries that touch the
metric name still have to consider them. Prometheus can delete series through its admin API, but
that is an operator action on a shared system, not something you do from your pipeline.

The realistic sequence is: stop the bleeding centrally with a `MeterFilter`
([04c](04c-meterfilter.md)) so the fix ships in minutes rather than in a release; fix the call site
properly; then ask the platform team whether the historical series are worth deleting or worth
waiting out.

## Gotchas

**★ Meters are never evicted, so an unbounded tag is a memory leak with a metrics API.** No TTL,
no LRU, no size bound by default. This is correct behaviour — an evicted meter would break every
`rate()` over the gap — and it means the JVM-side symptom of a cardinality bug is
`OutOfMemoryError`, not a metrics error.

**★ It is a product, not a sum, and reviewers reason additively.** "One more tag with five values"
multiplies the existing series count by five. Get into the habit of saying the multiplication out
loud in the pull request: "four times five times ten is two hundred combinations".

**★ A timer with a percentile histogram is roughly 76 series per combination, not one.**
Micrometer's default clamp of 1 ms to 1 minute yields *"73 histogram buckets per timer dimension"*
plus count, sum and max. Turning `percentiles-histogram` on globally across a service with
well-tagged timers is the most common way to multiply a metric surface by seventy without adding a
single tag.

**★ The 404 case makes an attacker your cardinality administrator.** Any unauthenticated path that
ends up in a tag is a remote resource-exhaustion vector against your monitoring, and it will be
found by an untargeted scanner within days of a service being publicly routable.

**★ `exception` as a tag is fine; `exception.getMessage()` is not.** Boot's own convention takes
*"the simple class name of any exception that was thrown"*. Messages contain ids and values. The
message belongs in the log line and on the span.

**★ A common tag with a bad value multiplies everything, including meters you did not write.**
JVM, GC, buffer-pool, Hikari, Tomcat and cache binders register hundreds of meters. A
high-cardinality common tag multiplies all of them.

**★ Cardinality is not symmetric across signals — the same value is ruinous in a metric and free in
a span.** Spring Framework's rule is that low-cardinality key values go to metrics only and high
cardinality to traces only. "We cannot record the order id" is almost never true; "we cannot record
the order id *as a metric tag*" always is.

**★ You will not catch it in a test, because tests have three users.** Every cardinality bug passes
CI. The only mechanisms that work are review-time arithmetic, a
`maximumAllowableTags` guard ([04d](04d-capping-cardinality.md)), and an alert on
`scrape_samples_scraped`.

**★ Shipping the fix does not remove the damage.** The series persist until retention expires and
keep costing index space and query time. Deletion is an operator action on a shared system.

**★ A bounded-looking enum from an external API is bounded by someone else's release schedule.**
Payment providers add decline reasons; carriers add status codes. Map external enums through a
`switch` with a `default -> "other"` before they become a tag.

**★ Dropping a tag later is itself a breaking change.** Removing a label ends the old series and
starts a new one, so the emergency `ignoreTags` filter that saves your backend also puts a
discontinuity in every dashboard using that metric. That is the right trade, but say it out loud
before you deploy it at 2am.

## Interview questions

**★ Why is a user id in a metric tag worse than a user id in a log line?**
Because their storage models are opposite. A log line costs storage proportional to the number of
*events*; a metric tag costs storage proportional to the number of *distinct values*, forever,
whether or not anything is happening. One user who makes a single request creates a time series
that is then scraped every fifteen seconds for the life of the process and retained for the life
of the retention window. And it is paid twice: once as an unevictable `Meter` in your heap, once in
a time-series database that other teams share.

**★ Someone proposes adding a `customer` tag to your main request timer. How do you evaluate it?**
Do the multiplication out loud and ask for the number of distinct customers now and in eighteen
months. If it is a bounded set of large B2B accounts — dozens, contractually bounded — it may be
fine, and the timer's series count multiplies by that number, times 76 if a percentile histogram
is on. If it is consumer accounts, it is unbounded and the answer is no. The middle case, "a few
big customers and a long tail", has a real answer: map the tracked accounts to their own values
and collapse everything else to `other`, so the codomain stays fixed no matter how the customer
base grows.

**★ Your service caused a metrics incident on a shared Prometheus. Walk me through your response.**
First stop the growth without a release: a `MeterFilter` that denies the offending meter or
`ignoreTags` the offending key, deployed as configuration if the service supports it. Second,
confirm from `/actuator/metrics/<name>` and from `scrape_samples_scraped` that the growth has
stopped. Third, fix the call site properly, by mapping the unbounded domain onto a fixed set of
values rather than by deleting the dimension, so the signal survives. Fourth, add a
`maximumAllowableTags` bound so the next occurrence degrades instead of exploding. Finally, agree
with whoever operates the backend whether the historical series get deleted or left to expire —
that decision is not yours to make unilaterally.

**★ Why does a timer produce dramatically more series than a counter with the same tags?**
Because a timer publishes several statistics — at minimum count, total time and max — and, if
percentile histograms are enabled, a bucket series for every bucket inside the configured range.
Micrometer's default clamp yields 73 buckets per dimension, so each tag combination costs roughly
76 series rather than one. Enabling `percentiles-histogram` service-wide is therefore a
seventy-fold multiplication of an already-multiplied number, which is why it should be turned on
per meter through a filter and not as a global default.

**★ How is high cardinality supposed to be handled if the information is genuinely useful?**
By routing it to the signal whose storage model can afford it. The order id, the full URI and the
user id belong on the span as high-cardinality attributes, where the cost is per span rather than
per distinct value, and on the log line, where the cost is per event. The metric keeps a bounded
projection of the same information — the endpoint template, the outcome, the tier. Then the trace
id in the log and the exemplar on the metric let you get from the aggregate to the individual
request, which is what you actually wanted.

**★ Is there any legitimate use for a tag with a few hundred values?**
Yes, if it is genuinely bounded and you have done the multiplication. A `country` tag has around
two hundred values and is stable for decades; on a counter with no other tags that is two hundred
series and nobody will notice. The same tag on a timer with percentile histograms and two other
tags is a different conversation. The number that matters is never the tag's cardinality on its
own — it is the product, times the per-combination series count of the meter type.

**★ What single mechanism gives you the best chance of catching this before production?**
Review-time arithmetic is the only thing that prevents it, and `maximumAllowableTags` is the only
thing that contains it when review fails. Tests cannot catch it, because a test suite exercises a
handful of distinct values by construction. Staging rarely catches it either, for the same reason.
The realistic defence is a hard bound configured once, plus an alert on the per-target scraped
sample count so that the failure is noticed by you rather than reported to you.

{/* FOOTER */}
