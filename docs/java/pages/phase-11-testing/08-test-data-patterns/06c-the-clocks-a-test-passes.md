---
title: "The JDK ships three real clock implementations — fixed for calendar behaviour, offset for and-then-later, tick for precision — and the fourth clock, the one that moves under the test's control, is eight lines the JDK deliberately does not ship"
sidebar_label: "06c · The clocks a test passes"
sidebar_position: 25
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-31 against the JDK 25 javadoc for `java.time.Clock` — class
> description, `fixed(Instant,ZoneId)`, `offset(Clock,Duration)`, `tick(Clock,Duration)`,
> `tickMillis`, `tickSeconds`, `tickMinutes`, `systemUTC`, `equals`, `hashCode`,
> "Implementation Requirements"
> ([Clock](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/time/Clock.html))
> — and `java.time.InstantSource`
> ([InstantSource](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/time/InstantSource.html)).
> Spring Framework issue 24884 *"Provide a Mutable Clock in Spring Test Context Framework"*
> ([github.com](https://github.com/spring-projects/spring-framework/issues/24884)) is cited
> only as evidence that no such type is provided. Version spine from
> `spring-boot-dependencies:4.1.0`: JDK 25, Spring Boot 4.1.0, Spring Framework 7.0.8,
> JUnit Jupiter 6.0.3, Mockito 5.23.0, AssertJ 3.27.7. **No sandbox** — Java source and
> documented behaviour only, never a run.

**[06b](06b-what-to-inject.md) settled the parameter's type. This chunk settles its value.
The JDK's three factories are real, immutable, documented `Clock` implementations, and each
one exists for a different shape of test: `fixed` for calendar behaviour, `offset` for "and
then, later", `tick` for precision. The fourth case — time that moves under the test's
control — is eight lines the JDK deliberately does not ship, and knowing why it does not is
the point of writing it yourself.**

## `Clock.fixed(Instant, ZoneId)` — time does not move

> *"Obtains a clock that always returns the same instant. This clock simply returns the
> specified instant. As such, it is not a clock in the conventional sense. **The main use
> case for this is in testing, where the fixed clock ensures tests are not dependent on the
> current clock.**"*

> *"The returned implementation is immutable, thread-safe and `Serializable`."*

The default choice, and the one that makes calendar behaviour testable at all — 29 February,
the 31st of a month, the last day of a billing period, the hour that does not exist in a DST
spring-forward. It is also the only one of the three you can construct without a base clock,
so it is the one that makes a test hermetic.

Its limitation is its definition: with a fixed clock, `start` and `end` are the same instant,
so any code measuring elapsed time sees `Duration.ZERO`, and any assertion of the form
`assertThat(end).isAfter(start)` fails. That is not a bug in `fixed`; it is `fixed` telling
you that the code under test is a *duration* measurement, not a *timestamp* one, and needs a
different clock.

## `Clock.offset(Clock, Duration)` — the same run, shifted

> *"Obtains a clock that returns instants from the specified clock with the specified
> duration added. This clock wraps another clock, returning instants that are later by the
> specified duration. If the duration is negative, the instants will be earlier than the
> current date and time. **The main use case for this is to simulate running in the future
> or in the past.**"*

> *"A duration of zero would have no offsetting effect. Passing zero will return the
> underlying clock."*

> *"The returned implementation is immutable, thread-safe and `Serializable` providing that
> the base clock is."*

Use it to build a *second* clock from the first, so a test can assert on what the system does
later without waiting:

```java
Clock t0    = Clock.fixed(Instant.parse("2026-08-31T12:00:00Z"), ZoneOffset.UTC);
Clock day29 = Clock.offset(t0, Duration.ofDays(29));
Clock day31 = Clock.offset(t0, Duration.ofDays(31));

Subscription sub = new SubscriptionService(t0).subscribe(customer);

assertThat(new SubscriptionService(day29).isActive(sub)).isTrue();
assertThat(new SubscriptionService(day31).isActive(sub)).isFalse();
```

Three clocks, two assertions, and the boundary is stated in the test body rather than
inferred from a tolerance. Both sides of the boundary are checked, which is the part people
skip: a test that only asserts `isFalse()` at day 31 also passes if the subscription was
never active.

⚠️ `offset` shifts *whatever clock you give it*. `Clock.offset(Clock.systemUTC(), Duration.ofDays(1))`
is a **moving** clock that happens to be a day ahead — occasionally useful for a manual soak,
never what you want in an assertion. Offset a `fixed`.

## `Clock.tick(Clock, Duration)` — coarse, but still moving

> *"Obtains a clock that returns instants from the specified clock truncated to the nearest
> occurrence of the specified duration. This clock will only tick as per the specified
> duration. Thus, if the duration is half a second, the clock will return instants truncated
> to the half second."*

> *"The tick duration must be positive. If it has a part smaller than a whole millisecond,
> then the whole duration must divide into one second without leaving a remainder. All normal
> tick durations will match these criteria, including any multiple of hours, minutes, seconds
> and milliseconds, and sensible nanosecond durations, such as 20ns, 250,000ns and
> 500,000ns."*

> *"A duration of zero or one nanosecond would have no truncation effect. Passing one of these
> will return the underlying clock."*

It throws `IllegalArgumentException` *"if the duration is negative, or has a part smaller than
a whole millisecond such that the whole duration is not divisible into one second"*, and
`ArithmeticException` *"if the duration is too large to be represented as nanos"*.

Its real use is not in the test — it is in **production**, to match the precision of the
column you are about to write to:

```java
@Bean
Clock clock() {
    return Clock.tick(Clock.systemUTC(), Duration.ofMillis(1));   // column is timestamp(3)
}
```

With that bean, the in-memory `Instant` and the value read back from a millisecond-precision
column are the same value, and the test comparing them stops needing a tolerance.
`Clock.tickMillis(zone)`, `Clock.tickSeconds(zone)` and `Clock.tickMinutes(zone)` are the
pre-built cases. [06f](06g-the-clocks-you-do-not-own.md) has the round-trip mismatch in
full.

One documented caveat before relying on `tick` for determinism:

> *"Implementations may use a caching strategy for performance reasons. As such, it is
> possible that the start of the requested duration observed via this clock will be later
> than that observed directly via the underlying clock."*

## A mutable clock, when you need one

The JDK ships no advanceable clock, and neither does Spring — Spring Framework issue 24884,
*"Provide a Mutable Clock in Spring Test Context Framework"*, is a request, not a feature.
Writing one is eight lines, because `Clock` is an ordinary abstract class with three abstract
methods:

```java
final class MutableClock extends Clock {

    private volatile Instant instant;
    private final ZoneId zone;

    MutableClock(Instant instant, ZoneId zone) {
        this.instant = instant;
        this.zone = zone;
    }

    void advance(Duration by) { this.instant = this.instant.plus(by); }
    void setTo(Instant to)    { this.instant = to; }

    @Override public Instant instant()          { return instant; }
    @Override public ZoneId  getZone()          { return zone; }
    @Override public Clock   withZone(ZoneId z) { return new MutableClock(instant, z); }
}
```

```java
@Test
void aSessionIdlesOutAfterThirtyMinutes() {
    var clock = new MutableClock(Instant.parse("2026-08-31T12:00:00Z"), ZoneOffset.UTC);
    var sessions = new SessionRegistry(clock);

    Session session = sessions.open("ada");

    clock.advance(Duration.ofMinutes(29));
    assertThat(sessions.isLive(session)).isTrue();

    clock.advance(Duration.ofMinutes(2));
    assertThat(sessions.isLive(session)).isFalse();
}
```

29 minutes live, 31 minutes dead — stated in the body, with no sleeping and no tolerance. Use
it when the object under test **holds** the clock (a registry, a cache, a rate limiter), where
the two-clock `offset` trick does not apply because you cannot rebuild the object.

⚠️ Build it per test method, never as a shared static: it is mutable state with no lock, so a
shared instance makes test order significant
([12e · Shared state under parallelism](../01-junit-5/12e-shared-state-under-parallelism.md)).
The `volatile` field is there because the code under test may read the clock from another
thread. Even so, this class knowingly falls short of `Clock`'s documented expectations —
*"All implementations must be thread-safe"* — in that `advance` is read-modify-write and not
atomic. Keep it in test sources, and if two threads will advance it, use an
`AtomicReference<Instant>`.

## Where this connects

- Why the clock is a parameter: [06 · Random and time](06-random-and-time.md).
- Which type that parameter has: [06b · What to inject](06b-what-to-inject.md).
- The two mocks people reach for instead of these values, and what each costs:
  [06d · The two mocks that are not the fix](06d-the-two-mocks-that-are-not-the-fix.md).
- Making the bean overridable in a Spring slice:
  [06e · The clock in Spring](06e-the-clock-bean.md).
- Precision, truncation and the database round trip:
  [06f · Timestamps you did not write](06g-the-clocks-you-do-not-own.md).

## Gotchas

**★ `Clock.fixed` makes elapsed-time code untestable in the opposite direction.**
Any code computing `Duration.between(start, end)` sees `Duration.ZERO` under a fixed clock, so
a rate limiter tests as "always over the limit" or "never", a cache always looks fresh, and a
backoff never backs off. Use `Clock.offset` to build a second clock, or a `MutableClock` you
advance. The tell is a test that had to be written as `assertThat(elapsed).isZero()` to go
green.

**★ `Clock.offset(Clock.systemUTC(), …)` in a test.**
`offset` shifts whatever base it is given, so wrapping a system clock produces a moving clock
that is merely wrong by a constant. The test is still non-deterministic. Offset a
`Clock.fixed`, always.

**★ `Clock.offset(base, Duration.ZERO)` returns `base` itself, not a copy.**
Documented: *"A duration of zero would have no offsetting effect. Passing zero will return the
underlying clock."* `Clock.tick` does the same for zero or one nanosecond. Harmless until a
test computes the offset dynamically, gets zero, and wonders why the "shifted" clock is
identical — the identity is the API keeping its word.

**★ `Clock.tick` throws `IllegalArgumentException` for durations that look reasonable.**
A duration with a sub-millisecond part must divide one second exactly. `Duration.ofNanos(250_000)`
is fine; `Duration.ofNanos(250_001)` is not. Any multiple of whole milliseconds is always safe,
which is why `tickMillis`, `tickSeconds` and `tickMinutes` exist as named shortcuts.

**★ `Clock` has no guaranteed `equals`, so asserting on the clock is not a test.**
The javadoc makes equality opt-in: *"Clocks should override this method to compare equals based
on their state … If not overridden, the behavior is defined by `Object.equals(Object)`."*
`Clock.fixed` does override it; `Clock.systemUTC()` and any hand-written clock promise nothing.
Assert on the value the clock produced.

**★ A `MutableClock` as a `static final` field shared by a test class.**
Mutable state with no lock. Under the default per-method lifecycle a fresh instance per test is
free; under `@TestInstance(PER_CLASS)` or parallel execution a shared one makes test order
significant, which is the failure [05b · Tests that depend on each other](05b-tests-that-depend-on-each-other.md)
is about.

**★ `MutableClock.advance` is read-modify-write and therefore not atomic.**
`volatile` makes the write visible; it does not make `instant.plus(by)` a single operation. One
thread advancing while another advances loses an update. If only the test thread advances — the
normal case — this is fine; if the code under test also advances it, use an
`AtomicReference<Instant>` and `updateAndGet`.

**★ Fixing the clock's zone to UTC while production runs in the platform zone.**
The clock's zone is used by every `LocalDate`/`LocalDateTime` derived from it, so a UTC-fixed
test never exercises the zone a user sees. Pin the zone deliberately, and parameterize over the
awkward ones when the behaviour depends on it — [14b](../01-junit-5/14b-time-and-determinism.md)
lists which.

**★ Assuming two consecutive reads of a system clock differ.**
The javadoc promises only *"the best available system clock. This may use
`System.currentTimeMillis()`, or a higher resolution clock if one is available"* — no resolution
guarantee at all. A test asserting `second.isAfter(first)` on two reads in the same method is
asserting about the host's clock granularity, not about your code.

## Interview questions

**★ When is `Clock.fixed` the wrong test clock, and what do you use instead?**
Whenever the behaviour is about *elapsed* time rather than *calendar* time. A fixed clock
returns the same instant forever, so a session timeout, a rate limiter, a retry backoff, a cache
TTL and any `Duration.between` all see zero elapsed. Two replacements: `Clock.offset(base, duration)`
builds a second, later clock, which is enough when the object under test can be reconstructed
around it; and a small mutable clock with `advance(Duration)`, which the JDK does not ship, is
right when the object *holds* the clock — a registry or a cache you cannot rebuild between
assertions. The mutable version makes the test read as "29 minutes: live; 31 minutes: expired".

**★ You need to test that a subscription expires after 30 days. Sketch it without sleeping.**
Three clocks and two assertions. Fix the first at the moment of subscription and build the
subscription through a service on it; then build `Clock.offset(t0, Duration.ofDays(29))` and
assert the subscription is still active, and `Clock.offset(t0, Duration.ofDays(31))` and assert
it is not. Checking both sides matters: a test that only asserts inactive at day 31 also passes
if the subscription was never active. If the object under test holds the clock rather than the
service, replace the three with one `MutableClock` and `advance` between assertions.

**★ Why would you use `Clock.tick` in production rather than in a test?**
Because it is the cheapest way to stop a precision mismatch from existing. If the column holds
milliseconds and the JVM clock produces microseconds or nanoseconds, the in-memory object and
the row read back are different values, so every test comparing them either fails or acquires a
tolerance that hides real bugs. A production bean of `Clock.tick(Clock.systemUTC(), Duration.ofMillis(1))`
truncates at the source and makes the two equal by construction. In the test itself `Clock.fixed`
already has whatever precision the `Instant` literal had, so `tick` adds nothing there.

**★ Why does the JDK not ship a mutable clock, and is writing one a smell?**
`Clock`'s implementation requirements say every implementation must be thread-safe, and the
factories all promise immutable, thread-safe, serialisable results — a clock you can move is
none of those, so it does not belong in `java.time`. Spring was asked for one too and has not
added it. Writing one in test sources is not a smell: it is eight lines, it extends a public
abstract class with three abstract methods, and it stays on the test side of the boundary. The
smell would be making it a bean, or sharing one instance across tests, because then you have
reintroduced global mutable state — the exact thing injecting a clock was meant to remove.

{/* FOOTER */}
