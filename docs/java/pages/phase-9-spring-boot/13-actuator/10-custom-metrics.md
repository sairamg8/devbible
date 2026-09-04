---
title: "Registering custom metrics"
sidebar_label: "10 · Registering custom metrics"
sidebar_position: 10
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-19 against the Spring Boot 4.1.1 reference — *Actuator ·
> Metrics · Registering Custom Metrics*
> (docs.spring.io/spring-boot/reference/actuator/metrics.html: `MeterBinder`
> beans being bound automatically, and the caveat about using the
> Spring-managed registry rather than the static `Metrics` class) and *Actuator ·
> Observability* (docs.spring.io/spring-boot/reference/actuator/observability.html:
> `management.observations.annotations.enabled`, the `aspectjweaver` requirement
> supplied by `spring-boot-starter-aspectj`, and the duplicate-observation
> warning for already-instrumented methods). Spring Boot 4.1.1, Spring Framework
> 7.0.x, JDK 25.

**Custom instrumentation is easy to add and hard to remove, because the moment
a metric appears on a dashboard or in an alert it is a contract with somebody
else's tooling. There are two ways to create one — a `MeterBinder` bean and an
annotation — and the choice between them is less about taste than about which
failure modes you are prepared to inherit.**

## Registering: prefer `MeterBinder`

Two ways to register a meter. The direct one:

```java
@Component
public class BasketMetrics {

    private final Counter abandoned;

    public BasketMetrics(MeterRegistry registry) {
        this.abandoned = Counter.builder("basket.abandoned")
                .description("baskets abandoned before checkout")
                .register(registry);
    }

    public void recordAbandonment() {
        this.abandoned.increment();
    }
}
```

And the one the reference recommends:

```java
@Bean
MeterBinder pendingWorkMetrics(WorkQueue queue) {
    return registry -> {
        Gauge.builder("work.queue.depth", queue, WorkQueue::size)
                .description("items awaiting processing")
                .register(registry);
        Gauge.builder("work.queue.oldest.age", queue, q -> q.oldestAgeSeconds())
                .baseUnit("seconds")
                .register(registry);
    };
}
```

All `MeterBinder` beans are bound to the Spring-managed registry automatically.
It is the better default for three reasons: the binder bean holds a strong
reference to the sampled object, which is the fix for the
[gauge weak-reference trap](08-metrics.md); it keeps instrumentation out of the
class being instrumented, so your domain code does not depend on Micrometer; and
it runs at registry-configuration time, so it composes correctly with filters
and common tags rather than racing them.

## Annotations, and the switch they need

`@Timed`, `@Counted`, `@Observed`, `@MeterTag` and `@NewSpan` are **not active
by default** in Boot 4. Two things are required:

```properties
management.observations.annotations.enabled=true
```

```xml
<dependency>
  <groupId>org.springframework.boot</groupId>
  <artifactId>spring-boot-starter-aspectj</artifactId>
</dependency>
```

⚠️ Note the starter name — Boot 4 renamed `spring-boot-starter-aop` to
**`spring-boot-starter-aspectj`**, so a copied snippet from any pre-4 tutorial
adds a dependency that no longer exists.

```java
@Timed(value = "report.generation", description = "time to build a monthly report")
public Report generateMonthlyReport(YearMonth month) { /* ... */ }
```

⚠️ **Do not annotate something already instrumented.** The reference warns
explicitly about duplicate observations: putting `@Timed` on a controller method
or a Spring Data repository method produces a second measurement of the same
call, so you get two meters with different names measuring one thing and a
dashboard that double-counts. Annotate the layer nothing else covers — usually
a service method or a scheduled job — and leave the instrumented boundaries
alone.

Being annotation-driven, these are also [proxy-based](../02-the-ioc-container/05-proxies-and-self-invocation.md),
so a call from one method of a bean to another method of the same bean is not
intercepted and produces no measurement at all.

## The trade-off

Every custom metric is permanent in practice. Once it is on a dashboard, in a
runbook or in an alert, removing it is a change to someone else's tooling — and
renaming it silently breaks a query that will not fail. It will return no data,
which is indistinguishable from "nothing is happening" at exactly the wrong
moment.

So the real cost of instrumentation is not CPU, it is the contract. That argues
for fewer, better-named, well-tagged metrics established deliberately, rather
than a counter added in each pull request. It also argues for reviewing names
and tags with the same seriousness as an API response field, which is what they
are.

## Gotchas

**Symptom:** `@Timed` produces no measurement at all
**Cause:** annotation support is off by default and needs both the property and the AspectJ dependency
**Fix:** both, and note the Boot 4 starter name:
```properties
management.observations.annotations.enabled=true
```
```xml
<artifactId>spring-boot-starter-aspectj</artifactId>
```

**Symptom:** a controller method's timings are double-counted after adding `@Timed`
**Cause:** `http.server.requests` already measures it, so the annotation adds a second observation of the same call under a different name
**Fix:** remove the annotation from instrumented boundaries — controllers and Spring Data repositories are already covered — and annotate an inner service method instead if you need a narrower measurement

**Symptom:** `@Timed` works when the method is called from a controller and not when a sibling method of the same bean calls it
**Cause:** annotation-driven instrumentation is proxy-based, and self-invocation bypasses the proxy
**Fix:** move the annotated method to a collaborator, which is the same remedy as every other [self-invocation](../02-the-ioc-container/05-proxies-and-self-invocation.md) case

**Symptom:** a metric registered in a constructor is missing from the export while others from the same class are present
**Cause:** it was registered before the registry finished configuring, so a filter or a common-tag customiser applied to the others and not to this one
**Fix:** register through a `MeterBinder` bean, which is invoked at registry-configuration time by design

**Symptom:** renaming a metric during a refactor makes an alert stop firing rather than break
**Cause:** monitoring queries fail *empty*, not loudly — no data reads exactly like no problem
**Fix:** treat metric names as a published contract. Register the new meter alongside the old one for a deprecation window, migrate the queries, then remove the old one

**Symptom:** a gauge added inside a domain class makes that class awkward to unit test
**Cause:** the class now depends on a `MeterRegistry` and its constructor demands one in every test
**Fix:** move the registration to a `MeterBinder` bean that samples the domain object from outside, so the domain class stays free of monitoring dependencies entirely

**Symptom:** `@Counted` on a method that throws records nothing for the failures you care about
**Cause:** the default behaviour records the exception as a tag rather than as a separate meter, so a query filtering on the meter name alone mixes successes and failures
**Fix:** query on the exception tag, which is present precisely so you do not need two meters:
```
/actuator/metrics/report.generation?tag=exception:none
```

## Interview questions

**★ Why does the reference recommend `MeterBinder` over registering in a constructor?**
Three reasons, and the first is a real bug class. A `MeterBinder` bean holds a
strong reference to the object being sampled, which prevents the weak-reference
gauge failure where a collected object turns a gauge into a permanent `NaN`. It
also keeps instrumentation out of the domain class, so business code does not
import Micrometer and stays testable without a registry. And it runs at
registry-configuration time, so filters and common tags apply consistently
rather than depending on whether your bean happened to be constructed before or
after the customisers ran.

**★ Why does `@Timed` frequently do nothing?**
Because annotation support is not on by default in Boot 4: it needs
`management.observations.annotations.enabled=true` **and** AspectJ on the
classpath, which in Boot 4 means `spring-boot-starter-aspectj` rather than the
old `spring-boot-starter-aop`. Even with both, it is proxy-based, so a
self-invocation from another method of the same bean is not intercepted. And
when it does work, putting it on a controller or a repository method duplicates
instrumentation that already exists — which is the failure the reference warns
about by name.

**★ Where should instrumentation live — in the class being measured or outside it?**
Outside it wherever the measurement can be taken from outside, which is what
`MeterBinder` and the auto-configured boundaries give you. A counter inside a
domain class couples business logic to a monitoring library, spreads metric
names through code with no other reason to know them, and forces every unit test
to supply a registry. The cases that genuinely need in-class instrumentation are
those where the interesting event has no external boundary — a particular branch
taken, a cache miss resolved a particular way — and those are worth doing
deliberately rather than by habit.

**★ You need to rename a metric. What is the safe procedure?**
Treat it as a breaking change to a published contract, because it is. Search
every dashboard, alert rule and runbook for the old name; register the new meter
alongside the old one so both emit during a deprecation window; migrate the
queries; then remove the old one. The ceremony exists because monitoring queries
fail *empty* rather than loudly — a renamed metric makes an alert stop firing,
which looks exactly like the system being healthy, and you discover the mistake
when the thing the alert was watching finally happens.

**★ When is an annotation the right instrumentation and when is programmatic registration better?**
Annotations are right for a whole-method timing where the method boundary is
exactly the thing you want to measure and nothing else already measures it — a
scheduled job, a service operation, an expensive computation. Programmatic
registration is right for everything else: gauges of state, counters of events
that are not method calls, anything with dynamic tags, and anything where you
want the metric to exist whether or not the method is ever called. The annotation
also carries a proxying constraint and an aspect dependency that programmatic
registration does not.

---

← Prev: [What Boot already measures](09-what-boot-measures.md) · Index: [Actuator](README.md) · Next → [Tags, filters and cardinality](11-tags-filters-cardinality.md)
