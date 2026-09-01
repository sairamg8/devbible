---
title: "A MeterFilter is the only place you can change a metric without changing the code that emits it, it runs once at registration rather than on every recording, and the three methods it can override are three completely different powers"
sidebar_label: "04c · MeterFilter"
sidebar_position: 11
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-01 against the **Micrometer 1.17 reference** — *Concepts · Meter Filters*
> ([docs.micrometer.io](https://docs.micrometer.io/micrometer/reference/concepts/meter-filters.html))
> and *Concepts · Histograms and Percentiles*, the **Spring Boot 4.1 production-ready reference**
> — *Metrics · Customizing Individual Metrics* and *Per-meter Properties*
> ([docs.spring.io](https://docs.spring.io/spring-boot/reference/actuator/metrics.html)), and the
> **Spring Boot 4.1.0 sources** at tag `v4.1.0` —
> [`MetricsAutoConfiguration`](https://github.com/spring-projects/spring-boot/blob/v4.1.0/module/spring-boot-micrometer-metrics/src/main/java/org/springframework/boot/micrometer/metrics/autoconfigure/MetricsAutoConfiguration.java)
> and
> [`MeterRegistryPostProcessor`](https://github.com/spring-projects/spring-boot/blob/v4.1.0/module/spring-boot-micrometer-metrics/src/main/java/org/springframework/boot/micrometer/metrics/autoconfigure/MeterRegistryPostProcessor.java).
> No JVM was run for this page. JDK 25 · Spring Boot 4.1.0 · Micrometer 1.17.0.

**Every other page in this topic changes a metric by changing the call site. This one does not.
A `MeterFilter` intercepts meters as they are *registered* on a registry, and can refuse them,
rewrite their identity, or change how much distribution data they publish — for meters in
libraries you do not own, in code you cannot redeploy quickly, and across a whole service at once.
That is why it is the emergency tool for [04b · Cardinality](04b-cardinality.md) and the routine
tool for [08b · Histograms](08b-histograms-and-buckets.md).**

## Three functions, and they are genuinely separate

> *"You can configure each registry with meter filters, which give you greater control over how
> and when meters are registered and what kinds of statistics they emit. Meter filters serve three
> basic functions:*
> *Deny (or Accept) meters being registered.*
> *Transform meter IDs (for example, changing the name, adding or removing tags, and changing the
> description or base units).*
> *Configure distribution statistics for some meter types."*

Those map onto three overridable methods — `accept(Meter.Id)`, `map(Meter.Id)` and
`configure(Meter.Id, DistributionStatisticConfig)` — and a single `MeterFilter` may implement any
combination. Spring Boot's own `PropertiesMeterFilter` implements all three: `accept` from
`management.metrics.enable.*`, `map` from `management.metrics.tags.*`, and `configure` from
`management.metrics.distribution.*`.

```java
registry.config()
    .meterFilter(MeterFilter.ignoreTags("too.much.information"))
    .meterFilter(MeterFilter.denyNameStartsWith("jvm"));
```

> *"Meter filters are applied in order, and the results of transforming or configuring a meter are
> chained."*

🔴 **They run at registration, not at recording.** A filter sees a `Meter.Id` — a name and a tag
set — once, when the meter is created. It never sees a value, a timestamp or a request. This is
the single most important fact on the page and it rules out a whole category of things people try
to do with filters.

## Deny and accept

```java
new MeterFilter() {
    @Override
    public MeterFilterReply accept(Meter.Id id) {
       if(id.getName().contains("test")) {
          return MeterFilterReply.DENY;
       }
       return MeterFilterReply.NEUTRAL;
    }
}
```

The three replies are not symmetric:

> *"**DENY**: Do not let this meter be registered. When you try to register a meter against a
> registry and the filter returns `DENY`, the registry returns a NOOP version of that meter (for
> example, `NoopCounter` or `NoopTimer`). Your code can continue to interact with the NOOP meter,
> but anything recorded to it is discarded immediately with minimal overhead."*

> *"**NEUTRAL**: If no other meter filter has returned `DENY`, registration of meters proceeds
> normally."*

> *"**ACCEPT**: If a filter returns `ACCEPT`, the meter is immediately registered without
> interrogating the accept methods of any further filters."*

Two consequences worth internalising. **`DENY` is safe for the application** — a denied meter is a
no-op object, not a null and not an exception, so `counter.increment()` on a denied counter is
legal and free. And **`ACCEPT` short-circuits**, which is what makes the whitelist idiom work:

```java
registry.config()
    .meterFilter(MeterFilter.acceptNameStartsWith("http"))
    .meterFilter(MeterFilter.deny());
```

> *"This achieves another form of whitelisting by stacking two filters together. Only `http`
> metrics are allowed to exist in this registry."*

The convenience builders, from the reference:

| Method | Effect |
|---|---|
| `accept()` | *"Accept every meter, overriding the decisions of any filters that follow."* |
| `accept(Predicate<Meter.Id>)` | accept anything matching |
| `acceptNameStartsWith(String)` | accept by prefix |
| `deny()` | *"Deny every meter, overriding the decisions of any filters that follow."* |
| `deny(Predicate<Meter.Id>)` | deny anything matching |
| `denyNameStartsWith(String)` | *"Deny every meter with a matching prefix."* |
| `denyUnless(Predicate<Meter.Id>)` | *"Deny all meters that do not match the predicate."* |
| `maximumAllowableMetrics(int)` | *"Deny any meter after the registry has reached a certain number of meters."* |
| `maximumAllowableTags(...)` | *"Places an upper bound on the number of tags produced by the matching series."* — [04d](04d-capping-cardinality.md) |

The prefix builders exist because Micrometer's binders were named to make them work:

> *"All `MeterBinder` implementations provided by Micrometer have names with common prefixes to
> allow for easy grouping visualization in UIs but also to make them easy to disable or enable as a
> group with a prefix. For example, you can deny all JVM metrics with
> `MeterFilter.denyNameStartsWith("jvm")`."*

## Transform

```java
new MeterFilter() {
    @Override
    public Meter.Id map(Meter.Id id) {
       if(id.getName().startsWith("test")) {
          return id.withName("extra." + id.getName()).withTag("extra.tag", "value");
       }
       return id;
    }
}
```

`Meter.Id` is immutable; `withName` and `withTag` return new ids. The convenience builders cover
most real cases:

- `commonTags(Iterable<Tag>)` — *"Adding common tags for application name, host, region, and
  others is a highly recommended practice."* ([04a](04a-common-tags.md) is the Boot-shaped form.)
- `ignoreTags(String…)` — *"Drops matching tag keys from every meter. This is particularly useful
  when a tag provably comes to have too high cardinality and starts stressing your monitoring
  system or costing too much but you cannot change all the instrumentation points quickly."*
- `replaceTagValues(String tagKey, Function<String, String> replacement, String… exceptions)` —
  *"You can use this to reduce the total cardinality of a tag by mapping some portion of tag values
  to something else."*
- `renameTag(String meterNamePrefix, String fromTagKey, String toTagKey)`.

🔴 **`map` must be a pure function of the id.** Micrometer states the constraint in a boxed note
and it is the rule people break:

> *"The `id` parameter is the only dynamic input that changes over the lifecycle of the
> `MeterFilter` on which `MeterFilter` implementations should depend. Depending on a value that
> will be fixed at runtime such as an instance ID or hostname is fine because it does not change
> after application start-up. **Use cases where dynamic behavior is desired, such as defining tags
> based on the context of a request etc., should be implemented in the instrumentation itself
> rather than in a `MeterFilter`.**"*

The reason follows from "filters run at registration". A meter is registered once — usually on the
*first* request that touches that tag combination — so a filter that read `RequestContextHolder`
would bake whatever that first request happened to contain into the identity of a meter that lives
for the life of the process.

## Apply a filter to only some meters

```java
registry.config()
    .meterFilter(MeterFilter.forMeters(startsWith("prefix"), MeterFilter.ignoreTags("extra")));

Predicate<Meter.Id> startsWith(String prefix) {
    return id -> id.getName().startsWith(prefix);
}
```

> *"Micrometer provides a convenience method `forMeters(Predicate<Meter.Id> predicate, MeterFilter
> delegate)` that enables the provided (delegate) filter for the Meters selected by the
> predicate."*

This is how you avoid the very common mistake of applying an expensive `configure` — percentile
histograms, say — to every meter in the process because the only filter you knew how to write was
global.

## The third function, in one paragraph

`configure(Meter.Id, DistributionStatisticConfig)` is how a filter changes *how much* a timer or
distribution summary publishes — percentiles, SLO boundaries, percentile histograms, and the
expected-value clamp that decides the bucket count:

> *"`Timer` and `DistributionSummary` contain a set of optional distribution statistics (in
> addition to the basics of count, total, and max) that you can configure through filters. These
> distribution statistics include pre-computed percentiles, SLOs, and histograms."*

It is the most expensive of the three powers — a single careless `configure` can multiply a
service's series count by seventy — so the mechanism, the mandatory `merge` call and the bucket
arithmetic all live together in [08b · Histograms and buckets](08b-histograms-and-buckets.md).

## Where Spring Boot puts them

> *"By default, all `MeterFilter` beans are automatically bound to the Spring-managed
> `MeterRegistry`."*

```java
@Configuration(proxyBeanMethods = false)
public class MyMetricsFilterConfiguration {

    @Bean
    public MeterFilter renameRegionTagMeterFilter() {
        return MeterFilter.renameTag("com.example", "mytag.region", "mytag.area");
    }
}
```

Which filters Boot already installed for you, in what order they run, and why an un-annotated
bean of yours runs *after* the property-driven one, is [04d · Capping
cardinality](04d-capping-cardinality.md) — the ordering only becomes load-bearing once a filter
is guarding a limit.

## Gotchas

**★ A filter runs once per meter, at registration — it can never see a value or a request.**
Every "tag this by tenant from the security context" idea dies here, and Micrometer says so in a
note. Dynamic behaviour belongs in the instrumentation, or in an `ObservationFilter`.

**★ A denied meter is a working no-op, not an error.** `NoopCounter` and `NoopTimer` accept calls
and discard them *"immediately with minimal overhead"*. So denying a meter never breaks the
application — and equally, nothing in the application will ever tell you a meter was denied.

**★ `ACCEPT` stops the chain, which is a feature and a trap.** *"If a filter returns `ACCEPT`, the
meter is immediately registered without interrogating the accept methods of any further filters."*
An early broad `acceptNameStartsWith` will therefore bypass a later `maximumAllowableTags` guard
for everything it matches.

**★ `ignoreTags` fixes cardinality *and* forks every affected series.** Dropping a label ends the
old time series and starts a new one. It is still the right emergency action, but it is not free
and every dashboard using that metric gets a discontinuity.

**★ A filter that renames or drops tags can collide two distinct meters into one identity.**
Micrometer warns about this for gauges and function counters: re-registration *"can happen
indirectly for example as the result of a `MeterFilter` modifying the name and/or the tags of two
different gauges so that they will be the same after the filter is applied."* The second one is
ignored, with one warning and then debug-level silence.

**★ Filters attach to a registry, so a composite has subtleties.** In a Boot application with more
than one registry, filters are applied per registry by the post-processor; the auto-configured
composite receives only a specific subset. If a filter appears not to be taking effect, check
*which* registry the meter you are looking at came from.

**★ `denyNameStartsWith("jvm")` disables useful metrics and people reach for it to save money.**
It works, and JVM metrics are among the cheapest and most useful you have. If cost is the problem,
the expensive thing is almost always percentile histograms on a well-tagged timer, not the JVM
binders.

**★ A `MeterFilter` cannot resurrect a meter that a previous filter denied.** The chain evaluates
accepts in order and `DENY` is final for that registration. Ordering is the only lever, and there
is no "un-deny".

**★ `MeterFilter` and `ObservationPredicate` are different layers.** On Boot 4, denying
`http.server.requests` with a meter filter removes the metric but leaves the observation — and
therefore the span — running. Suppressing the observation itself is
`management.observations.enable.*` or an `ObservationPredicate` bean.

## Interview questions

**★ What are the three things a `MeterFilter` can do, and which one do people misuse?**
Deny or accept a meter at registration, transform its id (name, tags, description, base units), and
configure its distribution statistics. The misused one is transform: because `map` receives only a
`Meter.Id`, people try to derive tags from request state, which cannot work — the filter runs once,
when the meter is first registered, so whatever the first request happened to contain would be
baked into a meter that lives as long as the process. Micrometer's documentation says outright that
request-context-dependent behaviour belongs in the instrumentation.

**★ Why is denying a meter safe for application code?**
Because the registry returns a no-op implementation rather than null or an exception:
`NoopCounter`, `NoopTimer` and friends accept every call and discard it with minimal overhead. Code
holding a reference to a denied meter keeps working. The corollary is that nothing in the
application can detect that its metrics are being thrown away, which is why a denial should always
be accompanied by a note somewhere a human will read.

**★ How do you whitelist only HTTP metrics on an expensive backend?**
Stack an accept and a deny, in that order: `acceptNameStartsWith("http")` followed by `deny()`.
The first returns `ACCEPT` for matching meters, which short-circuits the chain and registers them
immediately; everything else falls through to the blanket `deny()`. The ordering is the whole
mechanism, and reversing the two lines denies everything.

**★ A tag has blown up your cardinality and the fix requires touching forty call sites. What do
you ship today?**
A `MeterFilter.ignoreTags("<key>")`, scoped with `forMeters` to the affected meter names, deployed
as a bean or as configuration. The documentation names exactly this scenario: it is useful *"when
a tag provably comes to have too high cardinality … but you cannot change all the instrumentation
points quickly"*. Then the honest caveat — dropping the label starts new time series, so every
dashboard using that metric gets a discontinuity — and then the real fix at the call sites, plus a
`maximumAllowableTags` bound so the next one degrades instead of exploding.

**★ When would you use `replaceTagValues` rather than `ignoreTags`?**
When the dimension is worth keeping and only its tail is the problem. `ignoreTags` deletes the
dimension entirely; `replaceTagValues` maps the values you care about through unchanged and folds
everything else into one bucket, which is the same "unbounded domain onto fixed codomain" move you
would make at the call site. You keep the ability to compare your three biggest tenants and you
stop paying for the other forty thousand.

{/* FOOTER */}
