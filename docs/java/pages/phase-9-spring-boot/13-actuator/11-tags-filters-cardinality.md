---
title: "Tags, filters and cardinality"
sidebar_label: "11 · Tags and cardinality"
sidebar_position: 11
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-19 against the Spring Boot 4.1.0 reference — *Actuator ·
> Metrics · Common Tags* and *Customizing Individual Metrics*
> (docs.spring.io/spring-boot/reference/actuator/metrics.html:
> `management.metrics.tags.*`, `MeterRegistryCustomizer` with
> `config().commonTags(...)`, the documented caveat that the order of common
> tags set through properties is not guaranteed, `MeterFilter` beans being bound
> automatically, and the explicit warning that high-cardinality tags such as
> user identifiers or request URLs cause performance problems) and the
> Micrometer 1.17 `io.micrometer.core.instrument.config.MeterFilter` javadoc
> for `maximumAllowableTags`, `ignoreTags`, `renameTag` and `denyNameStartsWith`.
> Spring Boot 4.1.0, Spring Framework 7.0.x, JDK 25.

**🔴 A tag whose values are unbounded will destroy your metrics backend, and it
will do it quietly, at a rate proportional to your success. Every distinct
combination of metric name and tag values is a separate time series that is
stored, indexed and billed. Putting a user id in a tag is not "a bit
expensive" — it is one time series per user, forever, for every metric that
carries the tag.**

## Why cardinality is the failure mode

A metric is not one number. `http.server.requests` with tags `method`, `uri`,
`status`, `outcome` and `exception` is one series **per combination**: eight
methods times two hundred endpoints times a dozen statuses is already thousands
of series from a single meter, and that is with every tag bounded.

Now add a tag whose values are not bounded by anything you control:

- `userId` — one series per user who ever made a request;
- `orderId`, `sessionId`, `requestId` — one per event, which is the worst case
  because the series count grows *with traffic and never shrinks*;
- an unsanitised `uri` carrying the raw path rather than the template;
- an exception message rather than an exception class name;
- an email address, a tenant hostname, an uploaded filename.

The consequences are not gradual. Backend ingestion slows, queries that used to
return in a second time out, retention gets cut to keep costs down, and the
application's own memory grows because the registry holds every meter it has
created. Then the incident arrives and the dashboards do not load.

**The rule is one sentence: a tag value must come from a small, fixed set you
control.** Status codes, HTTP methods, endpoint templates, region names, outcome
buckets, a boolean, an enum. If you cannot write down the complete list of
possible values, it is not a tag.

**And the thing you actually wanted is a log line or a trace span.** High-
cardinality identifiers belong there: a trace can carry a user id and an order
id because a trace is sampled and stored per-event, whereas a metric is
aggregated and stored per-series-forever. That distinction is the whole design
of [observations](12-distributions-and-observations.md), which separates low-
cardinality key values from high-cardinality ones and sends them to different
places on purpose.

## Common tags multiply everything

```properties
management.metrics.tags.region=eu-west-1
management.metrics.tags.stack=prod
```

or programmatically, which you need when the value is computed:

```java
@Bean
MeterRegistryCustomizer<MeterRegistry> commonTags(BuildProperties build) {
    return registry -> registry.config().commonTags(
            "application", build.getName(),
            "version", build.getVersion());
}
```

Common tags are applied to **every meter**, which makes them the right home for
dimensions describing the *emitter* rather than the *event* — region, stack,
application name, version, role — and the cheapest cardinality mistake
available. A common tag with a hundred distinct values makes a hundred copies of
your entire metric set, not of one metric.

`version` is the interesting borderline case. It is genuinely useful, because it
lets you compare latency across a rolling deployment, and it is genuinely
unbounded over time — every release adds a value. It is usually worth it, and it
is worth knowing that you are making that trade rather than discovering it.
`instance` is the one to think hardest about: whether it belongs depends
entirely on whether your backend expects per-instance series or expects you to
have pre-aggregated.

⚠️ The reference notes that the **order** of common tags set through properties
is not guaranteed. That is irrelevant for a dimensional backend and matters for
a hierarchical one like Graphite, where tag order is part of the metric path —
there, use a `MeterFilter`.

## `MeterFilter`: retrofitting policy

A `MeterFilter` bean is applied to the Spring-managed registry and can rename,
transform, deny or cap any meter — **including meters emitted by libraries whose
source you are not going to change**, which is the situation it really exists
for.

```java
@Bean
MeterFilter dropNoisyMeters() {
    return MeterFilter.denyNameStartsWith("jvm.gc.pause");
}

@Bean
MeterFilter renameRegionTag() {
    return MeterFilter.renameTag("com.example", "mytag.region", "mytag.area");
}
```

The one that earns its place in production is the cardinality cap:

```java
@Bean
MeterFilter limitUriCardinality() {
    return MeterFilter.maximumAllowableTags(
            "http.server.requests", "uri", 200, MeterFilter.deny());
}
```

After two hundred distinct `uri` values, new ones are refused. It is a blunt
instrument — you lose data for whatever crosses the threshold, and you have no
control over which — and it is far better than the alternative, because the
alternative is your monitoring vendor telling you after a week of ingestion.

And when a tag turns out to be unbounded in production, this removes it without
waiting for a code change to ship:

```java
@Bean
MeterFilter dropUserTag() {
    return MeterFilter.ignoreTags("userId");
}
```

That is worth internalising as a habit: **a cardinality incident is fixed by
configuration first and by a code change second.** The filter stops the bleeding
in the next deployment of a property change; removing the tag from the source is
the follow-up.

## Where the built-in metrics already protect you

Two pieces of Boot's own instrumentation exist because of this problem, and both
are worth understanding as examples of the pattern:

- **`http.server.requests` tags the URI *template*, not the path.** `/orders/{id}`
  is one series; `/orders/91f2…` would be one per order.
- **Unmatched requests collapse to a constant.** A request that matches no
  handler is tagged `NOT_FOUND` rather than by its literal path, which is what
  stops a scanner spraying random URLs from creating a million series from
  outside your system.

If you write a custom URI tag provider, preserving both behaviours is the entire
job — and getting it wrong hands control of your metrics bill to whoever is
scanning you.

## The trade-off

Every defence here costs information. The URI template hides which specific
order was slow. A cardinality cap discards data non-deterministically.
`ignoreTags` removes a dimension somebody wanted. The honest position is that
metrics are the wrong tool for per-entity questions and always were: they are
aggregates, and their value comes precisely from the aggregation. "Which user
saw the error" is a logging and tracing question, and answering it with a tag
buys you one query at the price of a monitoring system.

The second trade is that the caps are crude. `maximumAllowableTags` has no
notion of which two hundred values matter, so under a cardinality event you keep
an arbitrary subset. That is acceptable because the alternative is keeping all
of them and losing the backend, but it does mean a cap is a safety net rather
than a design.

## Gotchas

**Symptom:** the monitoring bill jumps sharply after a release and traffic is unchanged
**Cause:** a tag with unbounded values was added — an id, a session, a raw path, an exception message
**Fix:** remove the dimension immediately with a filter, before fixing the source:
```java
@Bean
MeterFilter dropUnboundedTag() {
    return MeterFilter.ignoreTags("orderId");
}
```

**Symptom:** adding an `instance` common tag multiplies the series count across every metric
**Cause:** a common tag applies to all meters, so its cardinality multiplies the whole metric set rather than one metric
**Fix:** decide whether the backend needs per-instance series at all; if it aggregates for you, drop it with `MeterFilter.ignoreTags("instance")`

**Symptom:** a scanner hitting random URLs appears to have created thousands of series
**Cause:** a custom URI tag provider replaced Boot's and reports the literal request path instead of collapsing unmatched requests to a constant
**Fix:** restore the collapsing behaviour — an unmatched request must produce a fixed tag value, or an outsider controls your cardinality

**Symptom:** a `MeterFilter` you added has no effect on meters emitted by a third-party library
**Cause:** those meters were registered on the static global `Metrics` registry, not the Spring-managed one your filter is attached to
**Fix:** the filter genuinely cannot reach them; the library has to accept an injected `MeterRegistry`. Setting `management.metrics.use-global-registry=false` at least makes the problem visible instead of silent

**Symptom:** application memory grows steadily and heap analysis shows a large number of meter objects
**Cause:** cardinality is an in-process problem too — the registry holds every meter it has created, so an unbounded tag leaks memory as well as money
**Fix:** the same filters; and treat a growing meter count as a leak indicator, because a healthy application's meter count is roughly constant after warm-up

**Symptom:** an exception tag has hundreds of values
**Cause:** the tag is carrying exception *messages*, which usually embed identifiers, rather than exception class names
**Fix:** tag the class name only — `IllegalStateException`, not "no order 91f2… in state PENDING" — and put the message in the log or the span

**Symptom:** you cap `uri` cardinality and lose visibility of a genuinely important endpoint
**Cause:** `maximumAllowableTags` keeps an arbitrary subset, with no notion of which values matter
**Fix:** fix the reason there are so many values rather than tuning the cap; a well-templated API has tens of URI values, not hundreds, and a cap being hit is a symptom rather than a setting to raise

**Symptom:** a Graphite metric path has its components in a different order between deployments
**Cause:** the order of common tags set through properties is not guaranteed, and Graphite's path is built from tag order
**Fix:** set the tags through a `MeterFilter` instead of properties, where the order is under your control

## Interview questions

**★ What is metric cardinality and why is it the thing that breaks monitoring systems?**
Cardinality is the number of distinct time series a metric produces, which is the
product of the distinct values of all its tags. Each series is stored, indexed
and billed independently, so a tag with unbounded values does not make a metric
somewhat more expensive — it creates one series per distinct value, forever. The
characteristic damage is that it scales with your success: a `userId` tag costs
nothing in staging and takes down your monitoring backend once real users arrive.

**★ What is the test for whether something may be a tag?**
Whether you can write down the complete set of possible values. Status codes,
HTTP methods, URI templates, regions, outcomes, enums and booleans pass. User
ids, order ids, session ids, raw paths, exception messages, filenames and email
addresses fail. The corollary matters as much: the thing you wanted a
high-cardinality tag for is a log line or a trace span, both of which are stored
per event and sampled, rather than aggregated per series and kept forever.

**★ Why are common tags a cardinality risk out of proportion to their number?**
Because they apply to *every* meter, so their cardinality multiplies the entire
metric set rather than one metric. One common tag with a hundred distinct values
produces a hundred copies of everything the application emits. That makes them
right for dimensions describing the emitter — region, stack, application,
version — and wrong for anything varying per event. `version` is the defensible
borderline case, because comparing across a rolling deploy is worth the cost of
one new value per release.

**★ How does Boot's own HTTP instrumentation avoid this problem?**
Two deliberate choices. The `uri` tag carries the URI *template* — `/orders/{id}`
— rather than the actual path, so every identifier collapses into one series.
And requests that match no handler are tagged with a constant such as
`NOT_FOUND` rather than their literal path, which is what stops an external
scanner from generating unbounded cardinality in your system. A custom URI tag
provider that loses either property hands control of your metrics bill to
whoever is probing you.

**★ You discover a high-cardinality tag in production on a Friday. What do you do first?**
Add a `MeterFilter.ignoreTags(...)` for that tag and deploy the configuration —
the dimension disappears and the series stop growing, without waiting for a code
change to be written, reviewed and released. Removing the tag from the source is
the follow-up, not the first move. It is worth having the filter mechanism in
mind before you need it, because the instinct under pressure is to start editing
instrumentation code, which is the slower path.

**★ What is `MeterFilter.maximumAllowableTags` and what are you accepting when you use it?**
It caps the number of distinct values a given tag may take on a given meter and
applies a filter — usually `deny()` — beyond the limit. You are accepting that
you lose data non-deterministically: the cap has no notion of which values
matter, so under a cardinality event you keep an arbitrary subset. That is a
reasonable trade for keeping the monitoring system alive, but it is a safety net
rather than a design, and a cap being hit should be investigated as a symptom
rather than raised as a setting.

**★ Why does cardinality cost memory as well as money?**
Because the registry holds every meter it has created, in process, for the
lifetime of the application. An unbounded tag therefore leaks heap at the same
rate it inflates your bill, and the two symptoms often arrive together — a
steadily rising heap with a large number of meter objects, and a monitoring
invoice nobody can explain. A useful heuristic is that a healthy application's
meter count is roughly constant after warm-up, so a growing meter count is a
leak indicator in its own right.

---

← Prev: [Registering custom metrics](10-custom-metrics.md) · Index: [Actuator](README.md) · Next → [Distributions and observations](12-distributions-and-observations.md)
