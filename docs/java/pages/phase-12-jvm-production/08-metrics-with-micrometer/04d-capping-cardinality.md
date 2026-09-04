---
title: "Spring Boot already caps one tag for you at a hundred values and logs about it exactly once, and understanding that filter is how you build the same guard for the tag that will actually take your service down"
sidebar_label: "04d · Capping cardinality"
sidebar_position: 12
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-01 against the **Micrometer 1.17 reference** — *Concepts · Meter Filters*
> ([docs.micrometer.io](https://docs.micrometer.io/micrometer/reference/concepts/meter-filters.html)),
> the **Spring Boot 4.1 production-ready reference** — *Metrics · Customizing Individual Metrics*
> and *Per-meter Properties*
> ([docs.spring.io](https://docs.spring.io/spring-boot/reference/actuator/metrics.html)), and the
> **Spring Boot 4.1.1 sources** at tag `v4.1.0` —
> [`MaximumAllowableTagsMeterFilter`](https://github.com/spring-projects/spring-boot/blob/v4.1.0/module/spring-boot-micrometer-metrics/src/main/java/org/springframework/boot/micrometer/metrics/MaximumAllowableTagsMeterFilter.java),
> [`WebMvcObservationAutoConfiguration`](https://github.com/spring-projects/spring-boot/blob/v4.1.0/module/spring-boot-webmvc/src/main/java/org/springframework/boot/webmvc/autoconfigure/WebMvcObservationAutoConfiguration.java),
> [`MetricsProperties`](https://github.com/spring-projects/spring-boot/blob/v4.1.0/module/spring-boot-micrometer-metrics/src/main/java/org/springframework/boot/micrometer/metrics/autoconfigure/MetricsProperties.java)
> and
> [`MeterRegistryPostProcessor`](https://github.com/spring-projects/spring-boot/blob/v4.1.0/module/spring-boot-micrometer-metrics/src/main/java/org/springframework/boot/micrometer/metrics/autoconfigure/MeterRegistryPostProcessor.java).
> No JVM was run for this page; the Java below is quoted from those sources. JDK 25 ·
> Spring Boot 4.1.1 · Micrometer 1.17.0.

**[04b](04b-cardinality.md) argued that review-time arithmetic is the only thing that prevents a
cardinality explosion. This page is the thing that *contains* one when review fails. It is a hard
bound, it degrades a single metric rather than the whole backend, and Spring Boot already ships one
you are relying on without knowing it.**

## The guard you already have

Boot 4.1 auto-configures a cap on the `uri` tag of `http.server.requests`:

```java
@Bean
@Order(0)
MaximumAllowableTagsMeterFilter metricsHttpServerUriTagFilter(ObservationProperties observationProperties,
        MetricsProperties metricsProperties) {
    String meterNamePrefix = observationProperties.getHttp().getServer().getRequests().getName();
    int maxUriTags = metricsProperties.getWeb().getServer().getMaxUriTags();
    return new MaximumAllowableTagsMeterFilter(meterNamePrefix, "uri", maxUriTags);
}
```

The default is **100**, from `MetricsProperties.Web.Server`, whose javadoc is the whole behaviour
in one sentence:

> *"Maximum number of unique URI tag values allowed. After the max number of tag values is
> reached, metrics with additional tag values are denied by filter."*

```properties
management.metrics.web.server.max-uri-tags=100
management.metrics.web.client.max-uri-tags=100
```

There is an identical cap on `http.client.requests`, which matters more than the server one,
because an outbound URI template is easier to get wrong ([06b · The URI
tag](06b-the-uri-tag.md)).

## What it actually does, from the source

```java
@Override
public MeterFilterReply accept(Id id) {
    if (this.meterNamePrefix == null) {
        return logAndDeny();
    }
    String tagValue = id.getName().startsWith(this.meterNamePrefix) ? id.getTag(this.tagKey) : null;
    if (tagValue != null && !this.observedTagValues.contains(tagValue)) {
        if (this.observedTagValues.size() >= this.maximumTagValues) {
            return logAndDeny();
        }
        this.observedTagValues.add(tagValue);
    }
    return MeterFilterReply.NEUTRAL;
}

private MeterFilterReply logAndDeny() {
    if (this.logger.isWarnEnabled() && this.alreadyWarned.compareAndSet(false, true)) {
        this.logger.warn(this.message.get());
    }
    return MeterFilterReply.DENY;
}
```

Read that carefully, because the semantics are specific and every one of them matters:

- **It counts distinct values it has *seen*, in an unbounded `Set`.** Once the set reaches the
  limit, every *new* value is denied. Values already in the set keep working forever.
- **It is first-come-first-served, not most-important-first.** If a scanner hits you with a hundred
  junk paths before your real endpoints get traffic, the junk occupies the budget and your real
  endpoints are the ones denied. This is the argument for normalising at the call site and
  treating the cap as a backstop, not a policy.
- **It warns exactly once per process**, guarded by an `AtomicBoolean` compare-and-set. The message
  format is `"Reached the maximum number of '%s' tags for '%s'."`. There is no second warning, no
  metric about it, and nothing recurring. If you did not have log alerting on that line at the
  moment it fired, you will find out later from a gap in a dashboard.
- **Denial is per meter, not per registry.** Only meters whose name starts with the prefix *and*
  carry the capped tag key are affected. Nothing else in your service degrades.
- **The set never shrinks.** A tag value seen once at 04:00 holds a slot for the life of the
  process.

## Micrometer's general form

```java
MeterFilter.maximumAllowableTags(
    "orders.processed",              // meter name prefix
    "tenant",                        // the tag key to bound
    100,                             // how many distinct values
    MeterFilter.deny());             // what to do once the bound is reached
```

> *"`maximumAllowableTags(String meterNamePrefix, String tagKey, int maximumTagValues, MeterFilter
> onMaxReached)`: Places an upper bound on the number of tags produced by the matching series."*

The fourth argument is the interesting one. `MeterFilter.deny()` throws the excess away, which is
what Boot does. But `onMaxReached` is a full `MeterFilter`, so it can also *transform*:

```java
MeterFilter.maximumAllowableTags("orders.processed", "tenant", 100,
    MeterFilter.replaceTagValues("tenant", value -> "other"));
```

Now the hundred-and-first tenant does not vanish — it is folded into a single `tenant=other`
series. You keep the aggregate correct (a denied meter's recordings are discarded entirely, so a
`deny` makes your totals *wrong*, not merely less detailed) and you cap the series count. This is
almost always the better choice for a business metric and almost never worth it for `uri`.

## The other bound: a ceiling on the whole registry

> *"`maximumAllowableMetrics(int)`: Deny any meter after the registry has reached a certain number
> of meters."*

```java
registry.config().meterFilter(MeterFilter.maximumAllowableMetrics(10_000));
```

This is the blunt instrument and it is genuinely useful as a last-resort seatbelt: it bounds the
registry's heap footprint regardless of which tag went wrong. Its weakness is that it is
first-come-first-served across the *entire* process, so the meters denied are whichever ones
happened to register last — quite possibly the JVM binders, if a runaway tag saturated the budget
during warm-up. Set it well above your steady-state meter count and treat it as protection against
`OutOfMemoryError`, not as cardinality management.

## Where these filters sit, and why order decides whether they work

> *"By default, all `MeterFilter` beans are automatically bound to the Spring-managed
> `MeterRegistry`."*

Three things the reference does not spell out but the 4.1.0 sources do.

**Order is bean order.** `MeterRegistryPostProcessor` applies `this.filters.orderedStream()`, so
`@Order` on a filter bean decides its position in a chain whose semantics are order-dependent.

**Boot's own filters are `@Order(0)`.** Both `PropertiesMeterFilter` and the URI cap declare it. A
filter bean of yours with no `@Order` gets `LOWEST_PRECEDENCE` and therefore runs *after* them.

**Customizers run before filters, and filters before binders.** From the post-processor's own
comment: *"Customizers must be applied before binders, as they may add custom tags or alter timer
or summary configuration."*

🔴 The consequence that bites: **an `ACCEPT` earlier in the chain short-circuits your cap.**
Micrometer is explicit that *"if a filter returns `ACCEPT`, the meter is immediately registered
without interrogating the accept methods of any further filters."* A well-meaning
`acceptNameStartsWith("orders")` whitelist placed before your `maximumAllowableTags("orders…")`
guard disables the guard completely, and nothing reports it. Put caps first, or never use `ACCEPT`.

## Choosing the number

There is no documented right answer, so here is the reasoning that survives review:

1. **Count the legitimate values today.** Forty endpoints, twelve tenants, six outcomes.
2. **Multiply by growth you can name**, not by a comfort factor. "We add roughly one endpoint a
   sprint and this cap will be reviewed in a year" is a number; "let's say 1000" is not.
3. **Check the per-combination cost of the meter.** A cap of 500 on a counter is 500 series. A cap
   of 500 on a timer with a percentile histogram is roughly 38,000
   ([04b](04b-cardinality.md) has the arithmetic).
4. **Decide `deny` or fold-to-`other`.** If the metric's *total* must stay correct, fold. If the
   metric is a per-dimension breakdown whose total you never use, deny.
5. **Alert on the warning line**, because it happens once and never again.

## Gotchas

**★ The cap warns exactly once, ever, per process.** An `AtomicBoolean` compare-and-set guards it.
No repeat, no counter, no metric. If your log alerting does not match that message you will
discover the cap from a missing series months later.

**★ It is first-come-first-served, so noise can evict signal.** The values that get the slots are
whichever arrived first, not whichever matter. A scanner or a bad client at start-up can fill the
budget with junk and starve your real endpoints.

**★ `deny` makes your totals wrong, not just less detailed.** A denied meter is a no-op — its
recordings are *discarded*, not aggregated into a catch-all. If `sum(orders_processed_total)` is a
number anyone relies on, use a `replaceTagValues` fold instead of `deny` as `onMaxReached`.

**★ The observed-values set never shrinks.** A tag value seen once holds its slot until the process
restarts, so a burst of garbage at 04:00 permanently consumes budget for the rest of the day.

**★ An earlier `ACCEPT` in the filter chain silently disables the cap.** `ACCEPT` short-circuits
the remaining accept methods. This is the most likely reason a cap you configured does nothing.

**★ Boot's own filters are `@Order(0)` and yours defaults to lowest precedence.** If your filter
needs to run before Boot's — to widen a cap by name, say — you must annotate it.

**★ Capping does not repair the damage already emitted.** The series that were registered before
the cap engaged still exist in the backend until retention expires.

**★ `maximumAllowableMetrics` denies whatever registers last, which may be something important.**
JVM and pool binders register during start-up; if a runaway tag saturates the budget first, the
binders are what get denied. Set it as an `OutOfMemoryError` seatbelt, comfortably above your
steady state.

**★ A cap on the meter name prefix does nothing if the meter is renamed by an earlier filter.**
`MaximumAllowableTagsMeterFilter` matches with `id.getName().startsWith(prefix)`, and `map`
transformations from earlier filters have already been applied. Cap on the name that reaches the
registry, not the name in your source.

**★ There is no cap on the number of *tag keys*, only on values of one named key.** A meter that
grows new tag keys — some instrumentation does this — is not bounded by any of these mechanisms.
`denyUnless` on a predicate that checks the tag set is the only tool that helps.

**★ `management.metrics.web.server.max-uri-tags` is not a substitute for a correct `uri` tag.**
The cap exists because the URI tag is the documented cardinality trap, but hitting it means you
have already lost data. The fix is the templated path ([06b](06b-the-uri-tag.md)); the cap is what
stops the loss from becoming an outage.

## Interview questions

**★ Spring Boot already caps one tag by default. Which one, at what value, and what happens when
you hit it?**
The `uri` tag on `http.server.requests` (and separately on `http.client.requests`), at 100 distinct
values, configured by `management.metrics.web.server.max-uri-tags`. Boot registers a
`MaximumAllowableTagsMeterFilter` at `@Order(0)` that tracks the distinct values it has seen; once
the set reaches the limit, meters carrying a *new* value are denied — they become no-ops and their
recordings are discarded. It logs a single warning the first time this happens and never again.
Existing values keep working, so the symptom is that some endpoints have request metrics and some
silently do not.

**★ Why is `deny` sometimes the wrong `onMaxReached` action?**
Because a denied meter discards its recordings entirely rather than folding them into a catch-all,
so any aggregate over that metric name is now missing the excess. For a breakdown metric whose
total nobody uses, that is fine. For something like `orders.processed` where
`sum(rate(...))` is a business number on a dashboard, it is a silent data-quality bug. Passing
`MeterFilter.replaceTagValues(key, v -> "other")` as `onMaxReached` keeps the total exact while
capping the series count, which is usually what you wanted.

**★ You configured `maximumAllowableTags` and it is not capping anything. What do you check?**
Three things, in order. Whether an earlier filter in the chain returns `ACCEPT` for those meters —
`ACCEPT` short-circuits every later `accept` method and silently disables the cap. Whether the
meter name prefix still matches after earlier `map` transformations, since the cap matches on the
name that reaches the registry. And whether the filter bean's `@Order` puts it where you think:
Boot's own filters are `@Order(0)` and an unannotated bean of yours runs after them.

**★ Why is a cap first-come-first-served, and what does that imply operationally?**
Because the filter cannot know which values matter — it sees only a `Meter.Id` at registration
time, with no notion of importance or traffic volume. Operationally it means the cap is a
containment device, not a selection policy: whatever arrives during warm-up gets the slots. If
your service is publicly routable, a scanner can consume the `uri` budget with paths that match no
handler before your own endpoints receive their first request, which is precisely why the URI tag
must be normalised at the call site as well as capped.

**★ Is `maximumAllowableMetrics` a good way to control metric costs?**
No — it is a way to avoid an `OutOfMemoryError`. It denies whichever meters register after the
ceiling is reached, with no regard for value, which in practice means the ones that register late.
JVM, pool and cache binders register during start-up, so a runaway tag that saturates the budget
early can cost you the JVM metrics you would need to diagnose it. Set it well above steady state
and treat it as a seatbelt; control cost with per-meter caps, filters and the histogram budget.

**★ How would you know that a cap has engaged in production?**
From the one warning line, if you were alerting on it, and otherwise from the absence of series:
an endpoint that appears in your access logs but has no `http_server_requests` series. The
proactive check is Prometheus's own `scrape_samples_scraped` per target — a count that plateaus
sharply while traffic keeps growing is a cap engaging. Adding a log-based alert on the
"Reached the maximum number of" message is the cheapest thing on this page.

**★ Where should the cap live — in code or in configuration?**
The tag-specific caps belong in code as `MeterFilter` beans, because the tag key and the meter name
are facts about your instrumentation and should change with it. The *numbers* belong in
configuration, so a cap can be widened during an incident without a release. Boot's own design
makes exactly that split: the filter is a bean, the limit is
`management.metrics.web.server.max-uri-tags`.

{/* FOOTER */}
