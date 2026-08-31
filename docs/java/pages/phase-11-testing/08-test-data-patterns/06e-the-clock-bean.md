---
title: "Spring Boot does not auto-configure a Clock bean and the request for one was closed as not planned, so you declare it — and the three decisions packed into that one-line @Bean method are the ones that decide whether your tests can control time at all"
sidebar_label: "06e · The clock bean"
sidebar_position: 44
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-31 against the JDK 25 javadoc for `java.time.Clock` — `systemUTC`,
> `systemDefaultZone`, `system(ZoneId)`, `tick`
> ([Clock](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/time/Clock.html))
> and `java.time.InstantSource`
> ([InstantSource](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/time/InstantSource.html)).
> Spring Boot issue 31397 *"Auto-configure java.time.Clock"*
> ([github.com](https://github.com/spring-projects/spring-boot/issues/31397)) is cited only as
> evidence that no such auto-configuration exists — the issue is **closed as not planned**, and
> I could not read a maintainer rationale, so none is claimed here. Version spine from
> `spring-boot-dependencies:4.1.0`: JDK 25, **Spring Boot 4.1.0**, Spring Framework 7.0.8,
> JUnit Jupiter 6.0.3, Mockito 5.23.0. **No sandbox** — Java source and documented
> configuration only, never a run.

**The earlier chunks made the clock a constructor parameter. In a Spring application that
parameter has to be satisfied by a bean, and Boot does not supply one: there is no `Clock`
auto-configuration, and the request to add one is closed as not planned. So the bean is yours,
which is a single line and three decisions — which system clock, which declared type, and what
to call it. Each of the three has a failure mode that shows up somewhere other than where the
mistake was made.**

## There is no `Clock` auto-configuration

A constructor that takes a `Clock` in an application that never declared the bean fails at
context startup with a missing-dependency error naming `java.time.Clock`. That is the **good**
case: it fails immediately, on every environment, before a single request. The bad case is a
slice test that papers over it — see [06f](06f-overriding-the-clock-in-a-slice.md), where
`@MockitoBean` will create the bean for you and leave the application broken.

Boot's position is a reasonable one to inherit. The choice between `systemUTC()`,
`systemDefaultZone()` and a truncated clock is an application decision with consequences for
time zones and for storage precision, and a framework default would have made it invisibly.

## The bean, and the three decisions inside it

```java
@Configuration(proxyBeanMethods = false)
class TimeConfiguration {

    @Bean
    Clock applicationClock() {
        return Clock.systemUTC();
    }
}
```

### 1 · `systemUTC()`, not `systemDefaultZone()`

`systemDefaultZone()` resolves through `ZoneId.systemDefault()`, so the application's calendar
behaviour depends on the container's `TZ` — the variable that differs between a laptop, a CI
agent and whichever region the pod landed in. With `systemUTC()` in the bean, `LocalDate.now(clock)`
means "today in UTC" everywhere, deterministically, and the test that pins it agrees with
production.

That is not the same as "the application has no time zones". It has them; they are just
**explicit and configured** rather than ambient:

```java
@ConfigurationProperties("billing")
record BillingProperties(ZoneId statementZone) { }        // e.g. billing.statement-zone=Europe/Berlin
```

```java
LocalDate statementDate = LocalDate.ofInstant(clock.instant(), props.statementZone());
```

A test can now set `billing.statement-zone` and assert the month-end behaviour for Berlin
without touching the host's `TZ` or `TimeZone.setDefault` — which would be JVM-global mutation
requiring a resource lock ([12c · Resource locks](../01-junit-5/12c-resource-locks.md)).

### 2 · Declared return type `Clock`, not `InstantSource`

The container matches candidates on the **declared type of the bean definition**, not on the
runtime class of the instance. A factory method returning `InstantSource` registers an
`InstantSource`, and every constructor asking for a `Clock` fails to resolve at startup even
though the object sitting in the context is one. Declaring `Clock` satisfies both kinds of
injection point, because `Clock implements InstantSource` ([06b](06b-what-to-inject.md)).

```java
@Bean
Clock applicationClock() { return Clock.systemUTC(); }    // ✅ satisfies Clock and InstantSource

@Bean
InstantSource timeSource() { return Clock.systemUTC(); }  // ❌ Clock injection points cannot resolve
```

### 3 · A distinct method name is worth the keystrokes

A Boot application with Actuator on the classpath has **two unrelated types called `Clock`** in
scope: `java.time.Clock` and Micrometer's `io.micrometer.core.instrument.Clock`. They never
conflict by type, but they collide in an import list and in a reader's head, and a bean method
called `clock()` in a configuration class that also imports the other one is a fifteen-minute
mistake with a confusing error message. Name it `applicationClock()` and import `java.time.Clock`
explicitly.

## Where `tick` goes, if you use it

Production-side precision matching belongs in this bean and nowhere else
([06c](06c-the-clocks-a-test-passes.md)):

```java
@Bean
Clock applicationClock() {
    return Clock.tick(Clock.systemUTC(), Duration.ofMillis(1));   // columns are timestamp(3)
}
```

Every `Instant` the application produces is now truncated to the precision the database can
store, so the in-memory object and the row read back are equal, and the tests that compare them
stop needing a tolerance. The cost is that the application can no longer distinguish two events
in the same millisecond — which matters only if something orders by timestamp, and if it does,
it was already broken ([06g](06g-the-clocks-you-do-not-own.md)).

## In a shared library or starter

If several services share a platform module, put the clock there with
`@ConditionalOnMissingBean` so an application can still override it:

```java
@AutoConfiguration
public class ClockAutoConfiguration {

    @Bean
    @ConditionalOnMissingBean(Clock.class)
    public Clock applicationClock() {
        return Clock.systemUTC();
    }
}
```

⚠️ `@ConditionalOnMissingBean` is evaluated against the beans defined *at the point the
auto-configuration is processed*, which is after user configuration — so an application's own
`@Bean Clock` wins. It does **not** protect you from a second auto-configuration in another
starter also defining one; ordering between auto-configurations is its own problem, and the
symptom is a `Clock` you did not choose. If you own the platform module, own the clock in it and
do not let two starters both define one.

## Unit tests need none of this

Everything above is about tests that build a Spring context. A plain unit test constructs the
object:

```java
var service = new TrialService(Clock.fixed(instant, ZoneOffset.UTC));
```

No annotation, no context, no cache key, no startup. **If controlling the clock is the only
reason a test loads a Spring context, the test is at the wrong level**
([02 · A unit test needs no Spring](../05-the-test-pyramid/02-a-unit-test-needs-no-spring.md)).
That is worth stating plainly because the next chunk is entirely about context-based overrides,
and the best override is the one you did not need.

## Where this connects

- Why the clock is a parameter: [06 · Random and time](06-random-and-time.md).
- Which type the parameter has, and why the bean must be declared as `Clock`:
  [06b · What to inject](06b-what-to-inject.md).
- The values a test passes: [06c · The clocks a test passes](06c-the-clocks-a-test-passes.md).
- Replacing this bean in a slice: [06f · Overriding the clock in a slice](06f-overriding-the-clock-in-a-slice.md).
- The timestamps this bean does *not* reach — the scheduler, JPA auditing, the database:
  [06g · The clocks you do not own](06g-the-clocks-you-do-not-own.md).

## Gotchas

**★ Spring Boot does not auto-configure a `Clock` bean, and the failure is at startup.**
There is no `ClockAutoConfiguration` in Boot; the request for one (spring-boot#31397) is closed
as not planned. A constructor taking a `Clock` in an application that never declared the bean
fails context startup with a missing-dependency error — the good case, because it fails
everywhere at once. The bad case is a slice test that creates the bean implicitly and hides the
omission ([06f](06f-overriding-the-clock-in-a-slice.md)).

**★ `Clock.systemDefaultZone()` as the production bean.**
It works, and it moves a behavioural decision into the deployment environment, where it is
untested and undocumented and differs between the machine that ran the tests and the machine
that runs the code. Prefer `Clock.systemUTC()` and make each display or scheduling zone an
explicit configuration property.

**★ Declaring the bean's return type as `InstantSource`.**
The container matches on the declared type, so a `Clock` dependency finds no candidate even
though the instance is a `Clock`. The error is a missing-bean failure for a type you can see
being constructed two lines away, which is one of the more disorienting startup messages Spring
produces. Declare `Clock`; inject the narrower type at the classes that deserve it.

**★ A bean method named `clock()` in a file that also imports Micrometer's `Clock`.**
Two unrelated interfaces share the simple name on an Actuator classpath. They do not collide by
type, but a wrong import produces either a bean of the wrong kind or an error that reads as
nonsense. Import `java.time.Clock` explicitly and give the method a distinct name.

**★ Setting the JVM default zone instead of configuring one.**
`TimeZone.setDefault(...)` in a `main` method, or `-Duser.timezone`, "fixes" the
`systemDefaultZone()` problem by making the ambient value predictable — but it is still ambient,
still global, and in a test it is JVM-wide mutation that needs
`@ResourceLock(Resources.TIME_ZONE)` to be safe under parallel execution. Configure the zone as
a property and pass it.

**★ Two starters both defining a `Clock` bean.**
`@ConditionalOnMissingBean` protects an auto-configuration against *user* beans, not reliably
against another auto-configuration processed in a different order. The symptom is an
application running on a clock nobody in the room chose. One platform module owns the clock.

**★ Loading a Spring context solely to control the clock.**
If the only reason a test carries `@SpringBootTest` is that the class under test needs a `Clock`,
construct the class directly with `Clock.fixed(...)` and delete the annotation. A context costs
seconds and a cache slot; a constructor call costs neither.

**★ Putting `Clock.tick(...)` in the bean without checking what orders by timestamp.**
Truncating to milliseconds makes round-tripping exact and makes two events in the same
millisecond indistinguishable. If anything sorts by a timestamp column, or dedupes on one, you
have just made ties more frequent. That code needed a tiebreaker anyway — but find out before
shipping the truncation, not after.

## Interview questions

**★ Does Spring Boot give you a `Clock` bean?**
No. There is no `Clock` auto-configuration in Boot 4.1, and the request to add one is closed as
not planned. You declare it yourself — one `@Bean` method returning `Clock.systemUTC()`. That is
arguably the better outcome: the choice between `systemUTC()`, `systemDefaultZone()` and a
`tick`-truncated clock has real consequences for time zones and for storage precision, and a
framework default would have made all three invisibly.

**★ `systemUTC()` or `systemDefaultZone()` for the application clock, and where do time zones live then?**
`systemUTC()`, always, for the bean. `systemDefaultZone()` puts a behavioural decision into the
deployment environment: the container's `TZ` then determines what "today" means, so the same
code gives different answers on a laptop, in CI, and in two regions. Time zones do not disappear
— they become explicit. Each place that renders a date for a human, or schedules something in
local terms, takes a configured `ZoneId` and converts from the instant. That also makes the
zone-sensitive behaviour testable, because a test can set the property instead of mutating the
JVM's default.

**★ Would you put the `Clock` bean in a shared starter?**
Yes, if several services share a platform module, and with `@ConditionalOnMissingBean(Clock.class)`
so any application can substitute its own. The caveat is that the condition protects against user
beans reliably and against a *second auto-configuration* only as far as ordering allows, so the
rule is that exactly one platform module owns the clock. The benefit is worth it: it makes
`Clock.systemUTC()` the organisational default and stops each new service reinventing the
decision — usually as `systemDefaultZone()`.

**★ What breaks first if a team never declares the clock bean and injects `Clock` anyway?**
Context startup, everywhere, immediately — which is the outcome you want. The dangerous variant
is a team that hits that error only in production because their slice tests used
`@MockitoBean Clock clock`, whose documented `REPLACE_OR_CREATE` strategy creates the bean when
none exists. Then every test is green against a wiring the application does not have, and the
first honest signal is a failed deployment.

**★ Why would you truncate the production clock to milliseconds?**
Because the storage precision and the clock precision have to agree somewhere, and the cheapest
place is the source. If the column is `timestamp(3)` and the JVM clock produces microseconds,
every value the application writes differs from the value it reads back, so every assertion that
compares them either fails or gets a tolerance that then hides real bugs.
`Clock.tick(Clock.systemUTC(), Duration.ofMillis(1))` makes them equal by construction. The
trade-off is that two events in the same millisecond become indistinguishable, so anything
ordering by that timestamp needs a tiebreaker — which it needed anyway.

{/* FOOTER */}
