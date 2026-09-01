---
title: "A tag is a dimension you can group by, not a word you glued into the metric name, and the difference decides whether a single query can answer a question or a human has to enumerate every series by hand"
sidebar_label: "04 · Tags"
sidebar_position: 8
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-01 against the **Micrometer 1.17 reference** — *Concepts · Naming Meters*
> (Tag Naming, Common Tags, Tag Values)
> ([docs.micrometer.io](https://docs.micrometer.io/micrometer/reference/concepts/naming.html)),
> the **Spring Boot 4.1 production-ready reference** — *Metrics · Common Tags* and
> *Observability · Common Tags*
> ([docs.spring.io](https://docs.spring.io/spring-boot/reference/actuator/metrics.html)), and the
> **Spring Framework 7 reference** — *Integration · Observability*
> ([docs.spring.io](https://docs.spring.io/spring-framework/reference/integration/observability.html)).
> No JVM was run for this page; no scrape output appears below. JDK 25 · Spring Boot 4.1.0 /
> Spring Framework 7.0.8 · Micrometer 1.17.0.

**A meter's identity is its name *plus its tags*, and that single sentence is the entire design.
Tags are what make a metrics system dimensional: one name, many series, and the backend does the
slicing. The failure mode is not exotic — it is putting the dimension into the name, producing a
hundred metric names that no query can relate to one another, and then writing a hundred
dashboard panels by hand.**

## The recommended and the bad approach, in Micrometer's own words

The naming page gives the same measurement written twice. First the recommendation:

```java
registry.counter("database.calls", "db", "users")
registry.counter("http.requests", "uri", "/api/users")
```

> *"This variant provides enough context so that, if only the name is selected, the value can be
> reasoned about and is at least potentially meaningful. For example if we select
> `database.calls`, we can see the total number of calls to all databases. Then we can group by or
> select by `db` to drill down further or perform comparative analysis on the contribution of
> calls to each database."*

Then the version people actually write:

```java
registry.counter("calls",
    "class", "database",
    "db", "users");

registry.counter("calls",
    "class", "http",
    "uri", "/api/users");
```

> *"In this approach, if we select `calls`, we get a value that is an aggregate of the number of
> calls to the database and to our API endpoint. This time series is not useful without further
> dimensional drill-down."*

🔴 Read the actual criterion buried in those two paragraphs: **the name must be the thing you
would want the unfiltered total of.** If summing every series under a name yields a number that
means something ("all database calls", "all HTTP requests"), the name is right. If it yields a
number that is an accident of what you happened to instrument, the name is too generic and one of
your tags is really part of the name.

The third variant — the one Micrometer does not bother to show because it is not dimensional at
all — is the one migrating from Graphite:

```java
// WRONG on a dimensional backend
registry.counter("database.calls.users");
registry.counter("database.calls.orders");
```

Now `db` is not a dimension. You cannot `group by` it, you cannot compute "share of calls per
database" in one expression, and adding a database means editing every dashboard.

## Identity: name + tags, and nothing else

The registry keeps *"only one meter for each unique combination of name and tags"*. Everything
downstream follows from that:

- Registering `Counter.builder("a").tag("x","1")` twice gives you the same counter, which is why
  it is safe to look one up on a hot path.
- Registering `Counter.builder("a").tag("x","1")` and `Counter.builder("a").tag("x","2")` gives
  you two meters and, on the backend, two time series.
- **Every distinct value of every tag multiplies the series count.** Three tags with 10, 5 and 4
  values is 200 series for one meter name, before common tags. This is the whole of
  [04b · Cardinality](04b-cardinality.md), and it is why the arithmetic belongs in your head at
  the moment you type `.tag(...)`.

⚠️ A meter with a tag key that another meter of the same name lacks is a *different* meter.
Prometheus and most backends will accept both and your `sum by (…)` will silently exclude one of
them. Keep the tag *set* constant per meter name — always emit the key, with a sentinel value like
`"none"` or `"unknown"`, rather than omitting it conditionally.

## Naming tags

> *"We recommend that you follow the same lowercase dot notation described for meter names when
> naming tags. Using this consistent naming convention for tags allows for better translation into
> the respective monitoring system's idiomatic naming schemes."*

The reason it matters is the same reason meter names use dots. Each registry carries a
`NamingConvention` that rewrites names *and tag keys* into the backend's dialect and, crucially:

> *"Additionally, this naming convention implementation removes special characters that are
> disallowed by the monitoring system from the metric names and tags."*

So a tag key of `http-status` or `user id` is not rejected — it is silently rewritten, differently
per backend. Write `http.status` and `user.id` and let the convention produce `http_status` for
Prometheus and whatever Atlas wants, and you never have to think about it again.

```java
Timer.builder("orders.processing")
    .tag("order.type", type.name().toLowerCase(Locale.ROOT))   // bounded enum
    .tag("outcome", outcome)                                    // success | failure
    .register(registry);
```

Two details in that snippet are deliberate. `Locale.ROOT` because `toLowerCase()` with a Turkish
default locale turns `I` into `ı` and gives you two tag values for one enum constant on some of
your pods. And `name()` rather than `toString()`, because a `toString()` override is a change
someone can make in a different pull request that silently doubles your series count.

## Tag values

> *"Tag values must be non-null."*

That is a hard requirement, not advice: a null tag value throws. The practical consequence is that
every nullable field you want to tag with needs a sentinel:

```java
.tag("tenant", tenantId == null ? "none" : tenantId)
```

And then the sentence that this whole topic orbits around:

> *"Beware of the potential for tag values coming from user-supplied sources to blow up the
> cardinality of a metric. You should always carefully normalize and add bounds to user-supplied
> input. Sometimes, the cause is sneaky. Consider the URI tag for recording HTTP requests on
> service endpoints. If we do not constrain 404's to a value like `NOT_FOUND`, the dimensionality
> of the metric would grow with each resource that cannot be found."*

That example is not hypothetical, and Spring solves it for you in a specific way that is worth
knowing about — [06b · The URI tag](06b-the-uri-tag.md). The general failure is
[04b](04b-cardinality.md).

## Gotchas

**★ A tag value is a *value*, not a piece of the name — but the registry cannot tell.** Nothing
stops `.tag("endpoint", "/api/users/" + id)`. There is no length limit, no validation, no warning.
The registry will happily hold a million meters and the process will die of it. Bounds are your
job at the call site; [04d](04d-capping-cardinality.md) is the net underneath.

**★ Omitting a tag conditionally splits one meter into two incompatible ones.** `if (tenant !=
null) builder.tag("tenant", tenant)` produces some series with a `tenant` label and some without.
`sum by (tenant)` puts the tagless ones in an empty-label bucket on Prometheus, and a naive
dashboard shows them as a separate mystery series. Always emit the key with a sentinel.

**★ Tag keys are rewritten per backend, so a key that is legal in your test is not necessarily the
key you query.** The naming convention *"removes special characters that are disallowed by the
monitoring system from the metric names and tags"*. `order-type` becomes `order_type` on
Prometheus. Two keys that differ only by a disallowed character can collide after normalisation.

**★ The `/actuator/metrics` endpoint uses the *code* name, not the exported name.** Spring Boot:
*"if `jvm.memory.max` appears as `jvm_memory_max` in Prometheus because of its snake case naming
convention, you should still use `jvm.memory.max` as the selector when inspecting the meter in the
metrics endpoint."* Two different naming worlds, one service. This trips people the first time
they try to look up a meter they only know from a Grafana panel.

**★ `String.toLowerCase()` without a locale is a cardinality bug waiting for a Turkish pod.**
`"ID".toLowerCase()` is `"ıd"` under `tr-TR`. If any instance runs with a different default locale
— a base image change is enough — you get two tag values for one logical value, and both are
"correct".

**★ Tagging with `enum.toString()` couples your metric identity to a method someone else may
override.** `name()` is final and cannot be overridden; `toString()` is a display concern. A
"nicer display name" pull request should not be able to fork a time series.

**★ A tag whose value depends on the request cannot be set from a `MeterFilter`.** Micrometer is
explicit: *"Use cases where dynamic behavior is desired, such as defining tags based on the context
of a request etc., should be implemented in the instrumentation itself rather than in a
`MeterFilter`."* Filters see only the `Meter.Id`, which is fixed for the life of the meter.

**★ Every common tag multiplies your *entire* metric surface, not one meter.** Adding
`pod=<name>` as a common tag multiplies every series in the process by the number of pods, and
does it retroactively across every dashboard. Instance-level identity is usually better supplied
by the scraper's target labels than by the application.

## Interview questions

**★ How do you decide whether something is a tag or part of the metric name?**
Ask what the unfiltered sum of the name means. If `sum(database_calls)` is "all database calls" —
a number you would actually put on a dashboard — then `db` is correctly a tag. If summing across
the name gives you an aggregate of unrelated things, as in Micrometer's `calls` example where
database calls and HTTP calls land in one series, then the name is too generic and one of the tags
is really part of the name. The complementary test is whether you would ever want to `group by` it;
if yes, it cannot be in the name on a dimensional backend.

**★ What is a meter's identity, and why does the answer matter on a hot path?**
Name plus the full set of tags — the registry keeps exactly one meter per unique combination. It
matters because looking a meter up by name and tags is idempotent and cheap, so you can build the
identity at the call site rather than caching a field. It also matters in the other direction: the
same lookup with one different tag value creates a *new* meter and a new time series, so a lookup
inside a loop over user ids is not a lookup, it is a leak.

**★ Why must you emit a tag key even when you have no value for it?**
Because the tag set is part of identity, so omitting the key produces a genuinely different meter.
You end up with two families of series under one name — one with the key, one without — and every
aggregation that groups by that key silently drops or mis-buckets half your data. A sentinel value
like `none` or `unknown` keeps a single, uniform series family and makes "we did not know" an
answerable query rather than a gap.

**★ You inherit a service with `orders.created.gold`, `orders.created.silver`, and
`orders.created.bronze`. What do you change and what breaks while you change it?**
Collapse them to `orders.created` with a `tier` tag. What breaks is every dashboard, alert and
recording rule referring to the old names, and the historical data does not migrate — the old
series simply stop and new ones start. The usual approach is to emit both for one retention period,
cut the dashboards over, then delete the old instrumentation; a `MeterFilter` that renames can do
the transitional half without touching call sites
([04c · MeterFilter](04c-meterfilter.md)).

{/* FOOTER */}
