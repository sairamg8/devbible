---
title: "Conventions, filtering and getting context across threads"
sidebar_label: "15 · Conventions and propagation"
sidebar_position: 15
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-20 against the Spring Boot 4.1.0 reference — *Actuator ·
> Observability* (docs.spring.io/spring-boot/reference/actuator/observability.html:
> `management.observations.key-values.*` as common tags applied to all
> observations; `management.observations.enable.<prefix>=false` and the
> `ObservationPredicate` example, with observations reported only if all
> predicates return true; `management.observations.annotations.enabled` and the
> statement that annotating already-instrumented classes such as Spring Data
> repositories or Spring MVC controllers gives *"duplicate observations"*;
> `spring.reactor.context-propagation`, `spring.task.execution.propagate-context`
> and the `ContextPropagatingTaskDecorator` bean) and the Micrometer 1.17
> reference — *Observation · Components*
> (docs.micrometer.io/micrometer/reference/observation/components.html:
> `ObservationConvention` supplying names and key values, the precedence of a
> call-site convention over a `GlobalObservationConvention` over the
> instrumentation default, and `ObservationFilter` mutating the context).
> Spring Boot 4.1.0, Spring Framework 7.0.x, JDK 25.

**The Observation API's real leverage is not on the code you write — it is on
the code you did not. A `GlobalObservationConvention` renames somebody else's
instrumentation, a predicate silences it, a common key value tags all of it, and
none of that requires touching the library or forking Boot. The one thing that
does not come free is context crossing a thread boundary, and its failure mode is
the nastiest in this topic because the trace comes out looking merely incomplete
rather than broken.**

## Conventions name things consistently

An `ObservationConvention` supplies the name and the key values for a kind of
observation, so naming lives in one place instead of at every call site.
Micrometer defines the precedence: a convention passed at the call site wins over
a `GlobalObservationConvention` registered on the registry, which wins over the
instrumentation's own default.

The value of that is not tidiness. Metric names are a published contract —
[chunk 10](10-custom-metrics.md) makes the argument — and the observation name
*becomes* the metric name. A `GlobalObservationConvention` is therefore the
supported mechanism for changing how instrumentation you do not own appears in
your backend, including Boot's own, without forking anything or waiting for an
upstream release.

That is worth knowing before you need it, because the instinct when a library's
metric is badly named is to give up and live with it, or to wrap the library.
Neither is necessary.

## Common key values, and how they differ from common tags

```properties
management.observations.key-values.region=eu-west-1
management.observations.key-values.stack=prod
```

These are applied to **observations**, where `management.metrics.tags.*` from
[chunk 11](11-tags-filters-cardinality.md) is applied to **meters**. The two
overlap heavily and are not interchangeable:

| | Reaches meters that were observations | Reaches meters that were never observations (JVM, system, pools) | Reaches spans |
|---|---|---|---|
| `management.observations.key-values.*` | yes | no | yes |
| `management.metrics.tags.*` | yes | yes | no |

Setting `region` in only one place therefore tags some of your telemetry and not
the rest — and the gap is invisible until the day you filter a dashboard by
region and half the panels go empty. Decide deliberately which lever owns each
dimension, and if you want a dimension everywhere, it goes in both.

⚠️ The cardinality warning from chunk 11 applies unchanged, and slightly harder:
a common key value multiplies your metric set exactly as a common tag does, and
also lands on every span.

## Turning observations off

By name prefix:

```properties
management.observations.enable.spring.security=false
management.observations.enable.denied.prefix=false
```

Or programmatically, when the condition is not a name:

```java
@Component
class SkipActuatorObservations implements ObservationPredicate {
    @Override
    public boolean test(String name, Observation.Context context) {
        return !"http.server.requests".equals(name)
                || !isActuatorRequest(context);
    }
}
```

Observations are reported only if **every** `ObservationPredicate` returns true,
so predicates compose as an AND. A second bean can never re-enable what a first
one denied, which is the right default for a safety mechanism and occasionally
surprising when two teams add predicates independently.

An `ObservationFilter`, by contrast, does not decide whether an observation
happens — it mutates the context on the way out, which is the hook for adding a
key value that is only knowable at the end, such as a result classification.

## Duplicate observations, and the two ways out

The reference is explicit that annotating something already instrumented — a
Spring MVC controller, a Spring Data repository — produces *"duplicate
observations"*, and that you have two remedies: disable the automatic
instrumentation with properties or an `ObservationPredicate` and rely on your
annotations, or remove the annotations.

[Chunk 10](10-custom-metrics.md) argued for the second, and that is still the
right default: the built-in instrumentation is consistent across your fleet and
somebody else maintains it. The first is the answer in one specific situation —
when the built-in observation genuinely does not carry what you need and your
annotation does. Choosing it means you now own instrumenting that boundary
everywhere, which is a larger commitment than it looks on the day you make it.

`@Observed` itself needs `management.observations.annotations.enabled=true`,
AspectJ via `spring-boot-starter-aspectj`, and a call arriving through the proxy
rather than from a sibling method of the same bean — all covered in
[chunk 10](10-custom-metrics.md) and not repeated here.

## Context propagation is the part that breaks

An observation's scope lives in a `ThreadLocal`. It does not follow work onto
another thread by itself, and neither the compiler nor the runtime will mention
it. Boot supplies the switches:

```properties
spring.reactor.context-propagation=auto
spring.task.execution.propagate-context=true
```

and, for an `AsyncTaskExecutor` you construct yourself, a decorator bean:

```java
@Bean
ContextPropagatingTaskDecorator contextPropagatingTaskDecorator() {
    return new ContextPropagatingTaskDecorator();
}
```

**The symptom is the reason this section exists.** Without propagation, the
parent span ends at the handoff and the work on the other thread appears as a
separate trace with no parent. Nothing errors. The trace you are looking at is
complete and internally consistent — it simply stops early, and the second half
of the request is a different trace you have no reason to open. Teams live with
this for months because "the tracing works", and it does, for the synchronous
part.

The same applies to log correlation: the trace and span ids that a
`ThreadLocal`-based MDC puts in your log lines vanish at the same boundary, so
the asynchronous half of a request logs without correlation ids and cannot be
joined to the rest.

## The trade-off

The cost of the Observation API is conceptual and it is real: registry, handlers,
conventions, predicates, filters, contexts and scopes are seven ideas where
`Timer.start(...)` was one. For a single timing in a single service that is a bad
trade, and reaching for a `Timer` directly is not a mistake.

It becomes the right trade at the point where you want more than one output from
one instrumentation — the moment tracing arrives, or log correlation — because
the alternative is parallel instrumentations that agree only while someone is
watching them. And it is *already* the right trade for the code you did not
write, which is the argument this chunk has been making: Boot's own
instrumentation is observation-based, so a convention or a handler bean changes
the behaviour of the entire application rather than of your call sites.

The second cost is indirection. Reading `Observation.createNotStarted(...)` does
not tell you a timer exists — that depends on which handlers are registered,
which is a property of the application rather than of the line you are reading.
Anyone adopting this should hear that stated plainly, because the first debugging
session where a metric is missing is otherwise very confusing.

## Gotchas

**Symptom:** an `ObservationPredicate` was added to re-enable observations another predicate denied, and it has no effect
**Cause:** predicates are ANDed — an observation is reported only if every predicate returns true
**Fix:** remove or narrow the predicate doing the denying. There is no bean you can add that overrides a denial, and that is deliberate

**Symptom:** `region` is on your HTTP metrics but missing from JVM metrics, or missing from spans
**Cause:** `management.observations.key-values.*` and `management.metrics.tags.*` reach different telemetry — observations and spans versus every meter
**Fix:** decide which lever owns each dimension, and set it in both places when you want it everywhere:
```properties
management.observations.key-values.region=eu-west-1
management.metrics.tags.region=eu-west-1
```

**Symptom:** spans stop at an executor handoff and the async work shows up as a separate parentless trace
**Cause:** observation scope lives in a `ThreadLocal` and did not cross the boundary
**Fix:** turn on propagation, and add the decorator for executors you build yourself:
```properties
spring.task.execution.propagate-context=true
spring.reactor.context-propagation=auto
```

**Symptom:** log lines from asynchronous work have no trace or span id while the synchronous ones do
**Cause:** the same missing propagation — MDC correlation is `ThreadLocal`-based too, so it disappears at exactly the same boundary
**Fix:** the same switches. It is worth checking both symptoms together, because seeing only one of them tends to send people looking at their logging configuration instead

**Symptom:** disabling built-in instrumentation to remove duplicates leaves a gap on services that were never annotated
**Cause:** `management.observations.enable.<prefix>=false` is global to the application, while the annotations that were supposed to replace it are per method
**Fix:** prefer removing the annotations instead — the reference offers both remedies, and only one of them keeps a consistent baseline across the fleet without ongoing effort

**Symptom:** a `GlobalObservationConvention` is registered and the names do not change
**Cause:** a convention passed explicitly at the call site takes precedence over the global one
**Fix:** remove the call-site convention, or accept that this instrumentation has opted out. The precedence order — call site, then global, then instrumentation default — is the thing to check first rather than the bean registration

## Interview questions

**★ How do you rename or re-tag observations produced by a library you do not control?**
Register a `GlobalObservationConvention`. A convention supplies the name and key
values for a kind of observation, and Micrometer's precedence puts a global
convention above the instrumentation's own default, so you can change how a
library's — or Boot's — observations appear in your backend without forking or
wrapping anything. Since the observation name becomes the metric name and metric
names are a contract with dashboards and alerts, that is a more valuable escape
hatch than it first appears.

**★ What is the difference between `management.observations.key-values` and `management.metrics.tags`?**
They tag different things. The observation form is applied to observations, so it
reaches the metrics derived from them *and* the spans; the metrics form is
applied to meters, so it reaches every meter including JVM, system and pool
metrics that were never observations, and reaches no spans at all. Setting a
dimension in only one place is a common and confusing half-configuration —
filtering a dashboard by `region` then empties exactly the panels fed by the
other lever.

**★ How do you stop an observation you do not want?**
Either `management.observations.enable.<prefix>=false` for a name prefix, or an
`ObservationPredicate` bean when the condition is not a name. The composition
rule matters: predicates are ANDed, so every one must return true and no bean can
re-enable what another denied. An `ObservationFilter` is the different tool for a
different job — it does not decide whether the observation happens, it mutates
the context, which is where you add a key value only known at the end.

**★ You annotate a repository method with `@Observed` and the numbers double. What happened and what are your options?**
The repository was already instrumented, so the annotation added a second
observation of the same call — the duplicate-observation case the reference warns
about by name. Two remedies exist: disable the built-in instrumentation with a
property or a predicate and rely on the annotations, or remove the annotations.
The second is almost always right, because the built-in instrumentation is
consistent across every service and maintained by somebody else; choosing the
first means you have taken on instrumenting that boundary everywhere, forever.

**★ Why do traces go missing at an executor boundary, and why does it take so long to notice?**
Because the observation's scope is held in a `ThreadLocal` and the handoff to
another thread does not carry it. It takes long to notice because nothing fails:
the parent span ends cleanly at the handoff, the async work becomes a separate
parentless trace, and the trace you open looks complete and consistent — just
short. Tracing appears to be working, which is why teams live with it for months.
`spring.task.execution.propagate-context`,
`spring.reactor.context-propagation` and a `ContextPropagatingTaskDecorator` for
executors you construct are what carry it across.

**★ Your async log lines have no correlation ids. Where do you look?**
At context propagation, not at the logging configuration. MDC-based correlation
is `ThreadLocal`-backed in exactly the way observation scope is, so both
disappear at the same boundary for the same reason. The tell is that the
synchronous half of the request logs correlation ids fine — a logging pattern
problem would affect every line, while a propagation problem affects only the
lines after a handoff.

**★ When is the Observation API the wrong tool?**
When you want one number from one place and are not going to add tracing. It
brings registry, handlers, conventions, predicates, filters, contexts and scopes
into a codebase where `Timer.start(...)` was a single idea, and paying that for a
single counter in a small service is a poor trade. It earns itself the moment a
second output is wanted from the same instrumentation — and it is already earned
for Boot's own instrumentation whether or not you ever write an observation
yourself, which is why understanding the model is worthwhile even if you never
call the API.

**★ What is the honest downside of deriving outputs from handlers?**
That the call site no longer tells you what it produces. Reading
`Observation.createNotStarted(...)` does not reveal whether a timer, a span, both
or neither exists — that is decided by which handlers are registered, which is a
property of the application's configuration rather than of the code in front of
you. It is the same indirection cost that any plugin architecture pays, and it is
worth stating explicitly to a team adopting the API, because the first
investigation into a missing metric is otherwise bewildering.

---

← Prev: [The Observation API](14-the-observation-api.md) · Index: [Actuator](README.md) · Next → [`/info` and build metadata](16-info-and-the-catalogue.md)
