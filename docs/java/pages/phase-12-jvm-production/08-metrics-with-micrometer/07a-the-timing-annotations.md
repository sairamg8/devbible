---
title: "@Timed is four lines shorter than the explicit form and carries five separate conditions that make it do nothing at all, every one of which fails silently"
sidebar_label: "07a · The timing annotations"
sidebar_position: 19
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-01 against the **Micrometer 1.17 reference** — *Concepts · Timers · The
> `@Timed` Annotation* and *`@MeterTag` on Method Parameters*, and *Concepts · Counters · The
> `@Counted` Annotation*
> ([docs.micrometer.io](https://docs.micrometer.io/micrometer/reference/concepts/timers.html)), and
> the **Spring Boot 4.1 production-ready reference** — *Observability · Micrometer Observation
> Annotations support*
> ([docs.spring.io](https://docs.spring.io/spring-boot/reference/actuator/observability.html)) and
> *Metrics · Spring Data Repository Metrics*
> ([docs.spring.io](https://docs.spring.io/spring-boot/reference/actuator/metrics.html)).
> No JVM was run for this page. JDK 25 · Spring Boot 4.1.1 · Micrometer 1.17.0.

**An annotation that silently does nothing is worse than no annotation, because it looks like
instrumentation in code review and produces no metric in production. `@Timed` has five independent
ways of being inert and none of them logs anything. Learn the list once and the annotations become
genuinely useful for the narrow case they fit: uniform, cross-cutting timing with no per-call
tags.**

## Form 3 · `@Timed`

```java
@Service
public class ExampleService {

  @Timed
  public void sync() {
    // @Timed will record the execution time of this method,
    // from the start and until it exits normally or exceptionally.
  }

  @Async
  @Timed
  public CompletableFuture<?> async() {
    // @Timed will record the execution time of this method,
    // from the start and until the returned CompletableFuture
    // completes normally or exceptionally.
    return CompletableFuture.supplyAsync(...);
  }
}
```

Note the second comment carefully: on a method returning a `CompletableFuture`, the aspect times
until the *future* completes, not until the method returns. That is the behaviour you want and it is
not obvious.

🔴 **`@Timed` does nothing without an aspect, and on Boot 4 the aspect needs two things.**

> *"To enable scanning of observability annotations like `@Observed`, `@Timed`, `@Counted`,
> `@MeterTag` and `@NewSpan`, set the `management.observations.annotations.enabled` property to
> `true`. A dependency on `org.aspectj:aspectjweaver`, which is part of
> `spring-boot-starter-aspectj`, is also required."*

```properties
management.observations.annotations.enabled=true
```

```xml
<dependency>
  <groupId>org.springframework.boot</groupId>
  <artifactId>spring-boot-starter-aspectj</artifactId>
</dependency>
```

Outside Spring Boot, the aspect is a bean you declare yourself:

```java
@Configuration
public class TimedConfiguration {
   @Bean
   public TimedAspect timedAspect(MeterRegistry registry) {
      return new TimedAspect(registry);
   }
}
```

And the warning Boot attaches to all of this:

> *"When you annotate methods or classes which are already instrumented (for example, Spring Data
> repositories or Spring MVC controllers), you will get duplicate observations. In that case you
> can either disable the automatic instrumentation using properties or an `ObservationPredicate`
> and rely on your annotations, or you can remove your annotations."*

Two more constraints from Micrometer itself: *"`TimedAspect` doesn't support meta-annotations with
`@Timed`"* — so your own `@BusinessOperation` composed annotation will not work — and, because it is
Spring AOP, **a self-invocation is not intercepted**. A `@Timed` method called from another method
of the same bean records nothing.

`@Timed(longTask = true)` switches to a `LongTaskTimer`; Boot notes for repositories that *"long
task timers require a separate metric name and can be stacked with a short task timer"*, and the
same is true anywhere else.

## Form 4 · `@Counted`

The same machinery, for things with no duration:

```java
@Service
public class ExampleService {
  @Counted
  public void sync() { ... }
}
```

with a `CountedAspect` bean outside Boot, and the same enabling property inside it. Reach for it
rarely: by [03](03-the-meter-types.md)'s rule, if the method takes measurable time you wanted
`@Timed`, which publishes the count anyway.

## Tagging from method parameters

`@MeterTag` turns an argument into a tag, with three ways to derive the value:

```java
interface MeterTagClassInterface {

    @Timed
    void getAnnotationForTagValueResolver(@MeterTag(key = "test", resolver = ValueResolver.class) String test);

    @Timed
    void getAnnotationForTagValueExpression(
            @MeterTag(key = "test", expression = "'hello' + ' characters'") String test);

    @Timed
    void getAnnotationForArgumentToString(@MeterTag("test") Long param);
}
```

It needs explicit wiring — *"To support using the `@MeterTag` annotation on method parameters, you
need to configure the `@TimedAspect` to add the `MeterTagAnnotationHandler`"* — and Micrometer adds
a constraint that catches people: *"remember that the implementation needs to be annotated with
`@Timed` annotation too"*.

🔴 **`@MeterTag("test") Long param` uses the argument's `toString()`.** That is a tag value derived
directly from a method parameter, which is the definition of the cardinality bomb in
[04b](04b-cardinality.md). Use the `resolver` or `expression` forms to map the argument onto a small
fixed set, or do not tag on it at all.


## The five ways it does nothing

Collected, because each one is silent and they are diagnosed in this order:

1. **No aspect.** `@Timed` is an annotation in `micrometer-core` with no runtime behaviour of its
   own. Something has to interpret it: `TimedAspect` as a bean, or Boot 4's annotation support.
2. **The Boot property is off.** `management.observations.annotations.enabled` defaults to false.
3. **The AspectJ dependency is missing.** Boot names it: `org.aspectj:aspectjweaver`, shipped in
   `spring-boot-starter-aspectj`.
4. **Self-invocation.** Spring AOP intercepts through a proxy, so a call from another method of the
   same bean never reaches the aspect. This is the classic Spring proxy limitation and it applies
   in full.
5. **A meta-annotation.** *"`TimedAspect` doesn't support meta-annotations with `@Timed`."* Your
   composed `@BusinessOperation` is not detected. The identical sentence appears for
   `CountedAspect`.

A sixth, which is not the annotation's fault: a `MeterFilter` or `management.metrics.enable.*`
denying the meter, in which case the aspect runs and records into a no-op
([04c](04c-meterfilter.md)).

## Where Boot already applies `@Timed` for you

Spring Data repositories are the one place Boot builds `@Timed` support in:

> *"The `@Timed` annotation from the `io.micrometer.core.annotation` package is supported on
> `Repository` interfaces and methods. If you do not want to record metrics for all `Repository`
> invocations, you can set `management.metrics.data.repository.autotime.enabled` to `false` and
> exclusively use `@Timed` annotations instead."*

> *"A `@Timed` annotation with `longTask = true` enables a long task timer for the method. Long
> task timers require a separate metric name and can be stacked with a short task timer."*

That is a genuinely good pattern to copy: repository timing is on for everything by default, and
the escape hatch is to turn the blanket instrumentation off and annotate only what you care about
— which trades completeness for a much smaller `method` tag surface.

## Gotchas


**★ `@Timed` is silent when the aspect is missing.** No error, no warning, no meter. On Boot 4 you
need `management.observations.annotations.enabled=true` *and* the AspectJ dependency. Outside Boot
you need the `TimedAspect` bean. The failure mode is "the metric does not exist", which looks
identical to "we never instrumented it".

**★ `@Timed` on a self-invoked method records nothing.** Spring AOP proxies the bean, so a call
from another method of the same class bypasses the proxy entirely. This is a general Spring AOP
property, not a Micrometer one, and it is the second most common reason a `@Timed` meter is
missing.

**★ `TimedAspect` does not support meta-annotations.** A composed `@BusinessOperation` annotated
with `@Timed` is not detected. Micrometer states this for both `TimedAspect` and `CountedAspect`.

**★ Annotating something Boot already instruments produces duplicates, not overrides.** Two
observations, two sets of meters, two spans. Boot's guidance is to disable one side, not to accept
both.

**★ `@MeterTag` on a parameter defaults to `toString()`, which is a user-supplied tag value.**
The exact hazard Micrometer's naming page warns about. Use `resolver` or `expression` to project it
onto a bounded set.

**★ `@MeterTag` requires the *implementation* to carry `@Timed` too, not just the interface.** Easy
to miss when the annotations live on an interface for documentation reasons.

**★ A `@Timed` method returning `CompletableFuture` is timed until the future completes.** That is
usually what you want, and it is also why a future that is never completed leaks a running
measurement. It is documented behaviour, not a bug, but it changes what "the method took 3 ms"
means.


**★ `@Counted` is almost always the wrong annotation.** If the method takes measurable time,
`@Timed` publishes a count as well, and Micrometer's rule is *"never count something you can time"*.
`@Counted` earns its place only for events with no duration worth recording.

**★ The enabling property is observation-wide, not timer-specific.**
`management.observations.annotations.enabled=true` switches on scanning for `@Observed`, `@Timed`,
`@Counted`, `@MeterTag` **and** `@NewSpan` together. Enabling it to get one timer also enables span
creation from `@Observed`, which is usually welcome and is never silent about cost.

**★ `@Timed` on a controller method duplicates `http.server.requests`.** Two timers for one
request, with different names and different tag sets, both of which someone will later put on a
dashboard. Boot's advice is to pick one side and disable the other.

## Interview questions


**★ Someone added `@Timed` and no metric appeared. Walk through the causes.**
First, the aspect: `@Timed` is inert without one, and on Boot 4 that means
`management.observations.annotations.enabled=true` plus the AspectJ dependency, or an explicit
`TimedAspect` bean elsewhere. Second, self-invocation: Spring AOP works through a proxy, so a call
from another method of the same bean is not intercepted. Third, a meta-annotation: `TimedAspect`
does not support `@Timed` applied through a composed annotation. Fourth, a `MeterFilter` or
`management.metrics.enable.*` denying the meter, in which case it exists as a no-op. All four are
silent.

**★ When would you accept `@Timed` over explicit instrumentation?**
When the timing is genuinely cross-cutting and needs no per-call tags — a uniform "how long does
each method of this integration client take" across a dozen methods, where the method name is the
only dimension. The moment you want an outcome tag, or a tag derived from a result, the annotation
stops fitting and you are into `@MeterTag` gymnastics that are less readable than four lines of
`Timer.Sample`. The other argument for explicit code is that it is visible at the call site, and
metrics that nobody can find in the source are metrics nobody maintains.

**★ Why is `@MeterTag("id") Long orderId` dangerous?**
Because in that form the tag value is the argument's `toString()`, so the tag takes one distinct
value per order — a cardinality explosion sourced directly from user-supplied input, which is the
scenario Micrometer's naming page warns about by name. The safe forms are the `resolver` and
`expression` variants, which project the argument onto a bounded set before it becomes a tag. The
order id itself belongs on the span as a high-cardinality attribute, where it costs one field per
request rather than one time series per value.

**★ How does `@Timed` behave on a method that returns a `CompletableFuture`?**
It times until the future completes, normally or exceptionally, rather than until the method
returns. Micrometer documents this in the sample itself. It is the behaviour you want for async
work — a method that returns in microseconds after submitting three seconds of work is not a
three-microsecond operation — but it means the meter's semantics differ from the synchronous case,
and a future that is never completed holds an open measurement.


**★ Why is Spring Data's repository instrumentation on by default while its `@Timed` support is
opt-in?**
Because the default gives complete coverage at a known cardinality — the tags are `repository`,
`method`, `state` and `exception`, all bounded by your code rather than by traffic — and because a
repository call is almost always worth timing. The `@Timed` route exists for services where the
repository surface is large enough that "one timer per method" is itself the cardinality problem;
turning `management.metrics.data.repository.autotime.enabled` off and annotating the handful of
queries that matter trades completeness for a much smaller series count. It is the same trade as
RED per endpoint versus RED per service, one layer down.

**★ Your team wants a custom `@Instrumented` annotation that means `@Timed` with standard tags.
Will it work?**
Not through `TimedAspect`, which does not support meta-annotations — the documentation says so for
both `TimedAspect` and `CountedAspect`. The composed annotation will compile, pass review, and
produce nothing. The workable equivalents are a custom aspect of your own that looks for your
annotation and drives a `Timer.Sample`, or Micrometer's `@Observed`, which goes through the
Observation API and gives you a metric and a span from one annotation. The second is usually the
better answer because it is the direction the whole Spring stack has moved.

{/* FOOTER */}
