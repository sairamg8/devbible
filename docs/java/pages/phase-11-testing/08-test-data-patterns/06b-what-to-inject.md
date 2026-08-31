---
title: "The parameter's type is a claim about the class: InstantSource says this component has no time-zone behaviour, Clock says it does, and choosing the wide one by default is how a zone bug gets in later"
sidebar_label: "06b · What to inject"
sidebar_position: 24
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-31 against the JDK 25 javadoc for `java.time.InstantSource`
> ([InstantSource](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/time/InstantSource.html))
> — class description, "Since: 17", "All Known Implementing Classes", `instant`, `millis`,
> `withZone`, `fixed`, `offset`, `tick`, `system` — and `java.time.Clock`
> ([Clock](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/time/Clock.html)).
> Version spine from `spring-boot-dependencies:4.1.0`: JDK 25, Spring Boot 4.1.0, Spring
> Framework 7.0.8, JUnit Jupiter 6.0.3, Mockito 5.23.0, AssertJ 3.27.7. **No sandbox** —
> Java source and documented behaviour only, never a run.

**[06](06-random-and-time.md) argued that the clock belongs in the constructor. It did not
say what type the parameter is, and on JDK 25 there are two answers, not one. `InstantSource`
arrived in JDK 17 as the narrow half of `Clock`: an instant with no zone. Which of the two a
class takes is a statement in its signature about whether it has any calendar behaviour at
all — and because that statement is checked by the compiler, choosing `Clock` "to be safe" is
the option that lets a zone bug in six months later.**

## Two types, and the sentence that separates them

`java.time.InstantSource` — **Since: 17**:

> *"Provides access to the current instant."*

> *"Instances of this interface are used to access a pluggable representation of the current
> instant. For example, `InstantSource` can be used instead of
> `System.currentTimeMillis()`."*

Its javadoc lists exactly one implementation — *"All Known Implementing Classes: `Clock`"* —
and defines the relationship on `withZone`:

> *"Returns a clock with the specified time-zone. This returns a `Clock`, which is an
> extension of this interface that combines this source and the specified time-zone."*

So: **`InstantSource` is an instant. `Clock` is an instant plus a zone.** `Clock` is a
subtype, so anywhere an `InstantSource` is wanted a `Clock` will do, and one bean serves both.

The interface is deliberately small — `instant()`, `millis()`, `withZone(ZoneId)`, and the
static factories `fixed`, `offset`, `tick`, `system`. There is no `getZone()`, and that
absence is the entire point.

## The choice is mechanical

| Your code produces or compares | Inject | Because |
|---|---|---|
| `Instant`, epoch-millis, "has this expired", a TTL, a retry window | `InstantSource` | No zone is involved and none should be reachable |
| `LocalDate`, `LocalDateTime`, `LocalTime`, `YearMonth`, `ZonedDateTime` | `Clock` | Converting an instant to a calendar value *requires* a zone |

```java
class TokenValidator {

    private final InstantSource time;                    // no zone needed, so none taken

    TokenValidator(InstantSource time) {
        this.time = time;
    }

    boolean isExpired(Token token) {
        return token.expiresAt().isBefore(time.instant());
    }
}
```

```java
@Test
void aTokenIsExpiredOneNanosecondAfterItsExpiry() {
    Instant expiry = Instant.parse("2026-08-31T12:00:00Z");
    var validator = new TokenValidator(InstantSource.fixed(expiry.plusNanos(1)));

    assertThat(validator.isExpired(new Token(expiry))).isTrue();
}
```

Compare with the calendar case, which cannot be written without a zone because "what day is
it" is not a question about an instant:

```java
class StatementPeriod {

    private final Clock clock;                           // a zone is genuinely required

    StatementPeriod(Clock clock) {
        this.clock = clock;
    }

    YearMonth current() {
        return YearMonth.now(clock);
    }
}
```

## Why the narrow type is not pedantry

The argument is not "smaller interfaces are nicer". It is that `InstantSource` in a signature
is a **compile-time proof of a property you would otherwise have to test for**: this class
cannot produce a different answer in `Australia/Sydney` than in UTC, because it has no way to
ask what zone it is in.

That property decays silently under `Clock`. A class takes a `Clock` because a `Clock` bean
was lying around; a year later someone adds a "expired today?" convenience method using
`LocalDate.now(clock)`; and a component that was zone-free now has a date boundary in it that
nobody wrote a test for. With `InstantSource` that edit does not compile.

The corollary is the honest one: **if a class legitimately needs both**, it needs a `Clock`,
and that is a signal worth reading. A class that computes both expiries (instants) and
statement periods (calendar) is doing two jobs, and splitting it usually leaves one
`InstantSource` class and one `Clock` class, each with fewer tests.

## `millis()`, and the `System.currentTimeMillis()` replacement

`InstantSource.millis()` is the documented replacement for `System.currentTimeMillis()` — the
javadoc names that method explicitly. It matters for legacy interop: a codebase full of
`long` timestamps does not have to convert to `Instant` to become testable.

```java
class RateLimiter {

    private final InstantSource time;

    boolean allow(String key) {
        long now = time.millis();                 // was System.currentTimeMillis()
        // ... window arithmetic on longs, unchanged
    }
}
```

That is a one-line-per-call-site refactor that removes an entire untestable global, and it is
the cheapest first move in an old codebase — much cheaper than converting the arithmetic to
`java.time` first. Convert the type later; take the seam now.

⚠️ `millis()` returns *milliseconds*, so a fixed source built from an `Instant` with
nanosecond precision truncates on the way out. That is normally what you want; it is
occasionally a surprise when a test fixes the source to `…T12:00:00.000000500Z` and asserts
on `millis()`.

## One bean, both parameter types

Because `Clock implements InstantSource`, a context containing a single `Clock` bean
satisfies constructors of both shapes. You do not declare two beans, and you do not need a
qualifier:

```java
@Bean
Clock clock() {
    return Clock.systemUTC();
}
```

```java
// both of these are satisfied by the single Clock bean above
StatementPeriod(Clock clock)      { … }
TokenValidator(InstantSource time) { … }
```

[06d · The clock in Spring](06e-the-clock-bean.md) covers the wiring and what replaces
it in a test.

⚠️ It does **not** work in the other direction. If someone declares the bean as
`InstantSource instantSource() { return Clock.systemUTC(); }`, the declared bean *type* is
`InstantSource`, and a constructor asking for a `Clock` will fail to resolve at startup even
though the instance is one. Declare the bean as `Clock`; inject it as whichever type the
class deserves.

## The JDK floor

`InstantSource` is **JDK 17+**. On the Boot 4.1 / JDK 25 spine that is free. In a shared
module that still compiles against 11 — a client library, an SDK published to other teams —
`Clock` is the only option, and none of this narrowing argument applies. Do not invent a
local `interface TimeSource` to work around it: a home-grown type has no factories, no
meaning to a reader, and will be deleted the moment the module's floor moves.

## Where this connects

- Why the clock is a parameter at all: [06 · Random and time](06-random-and-time.md).
- The values a test actually passes — `fixed`, `offset`, `tick`, a mutable clock, and why a
  mock is never one of them: [06c · The clocks a test passes](06c-the-clocks-a-test-passes.md).
- Declaring the bean and overriding it in a slice:
  [06d · The clock in Spring](06e-the-clock-bean.md).
- Timestamps produced by JPA or by the database, where the type question resurfaces as a
  precision question: [06e · Timestamps you did not write](06g-the-clocks-you-do-not-own.md).
- `Instant` versus `LocalDateTime` as a data-modelling decision:
  [Phase 7 · Machine vs calendar time](../../phase-7-io-time-stdlib/01-java-time/02-machine-vs-calendar-time.md).

## Gotchas

**★ Taking a `Clock` when the class never needs a zone.**
It compiles, it tests fine, and it leaves the door open: the next person adds
`LocalDate.now(clock)` to a class that had no calendar semantics, and its behaviour now
depends on a zone nobody chose. `InstantSource` in the signature is a compile-time guarantee
that this cannot happen, and on JDK 17+ it costs nothing.

**★ Declaring the bean as `InstantSource` rather than as `Clock`.**
The bean's *declared* type is what the container matches on. A factory method returning
`InstantSource` registers an `InstantSource`, and every constructor asking for a `Clock`
fails to resolve at context startup — a failure that appears as a missing-bean error for a
type you can see being created two lines away. Declare `Clock`, inject the narrower type
where it fits.

**★ `InstantSource.millis()` truncates to milliseconds.**
It is the `System.currentTimeMillis()` replacement, so it returns a `long` of milliseconds
regardless of the precision of the underlying instant. A test that fixes the source to a
sub-millisecond instant and asserts on `millis()` is asserting on the truncated value, which
is right but occasionally surprising when the same test also asserts on `instant()`.

**★ Introducing a home-grown `TimeProvider` interface because "the JDK types are awkward".**
It has no `fixed`, no `offset`, no `tick`, no `withZone`, and no meaning to anyone who has
not read your codebase — so every test writes its own lambda, and every one of them is a
slightly different clock. The two JDK types already are the abstraction; a wrapper adds a
name and removes four implementations.

**★ `Supplier<Instant>` as a substitute for `InstantSource`.**
It works and it is slightly worse: the type says "a supplier of some instant", not "the
current time"; it carries none of the factories; and it invites `mock(Supplier.class)` where
`() -> instant` would do. If you inherited one, it converts to `InstantSource` mechanically.

**★ Assuming `InstantSource` exists on the module's compilation target.**
JDK 17. A library module with `--release 11` will not see it, and the failure is at compile
time in that module only — which is exactly where nobody looks after a green build in the
application module.

**★ Splitting the injection type per method instead of per class.**
Taking an `InstantSource` in the constructor and a `ZoneId` as a method parameter, so the
class can "do calendar work when asked", reconstructs a `Clock` by hand and loses the
guarantee. If the class needs both, take a `Clock` — or, better, notice that it is two
classes.

## Interview questions

**★ `Clock` or `InstantSource` — how do you choose, and why does it matter?**
`InstantSource`, added in JDK 17, is "access to the current instant" and nothing more;
`Clock` extends it with a `ZoneId`. If the class only compares instants — expiry, TTL, an
audit stamp, a retry window — take `InstantSource`, because the signature then *proves* the
class has no time-zone behaviour to get wrong, and the proof is enforced by the compiler
rather than by a test. If the class produces a `LocalDate` or `LocalDateTime` it needs a zone
and must take a `Clock`. It matters because the wide type decays: a class given a `Clock` it
did not need acquires calendar behaviour later, and that behaviour arrives without the
date-boundary tests it would have had if it had been written that way on purpose.

**★ A class needs both an expiry check and a "which statement month is it" calculation. What do you inject?**
A `Clock`, because the second half genuinely needs a zone — and then treat the answer as a
finding rather than a conclusion. A class doing both is doing two jobs with two different
notions of time, and the usual refactor leaves one `InstantSource` component for the expiry
rule and one `Clock` component for the calendar period. That split also splits the tests: the
expiry cases stop needing a zone in their fixture, and the calendar cases stop needing a
token.

**★ How do you make a legacy class full of `System.currentTimeMillis()` testable without rewriting its arithmetic?**
Inject an `InstantSource` and replace each call with `time.millis()`. The javadoc names that
substitution explicitly — `InstantSource` "can be used instead of
`System.currentTimeMillis()`" — and it is a one-token change per call site, so the `long`
arithmetic, the windows and the comparisons all stay exactly as they were. The class becomes
testable immediately with `InstantSource.fixed(…)`; converting the arithmetic to `java.time`
is a separate, later, and now-safe refactor because there are tests.

**★ Someone declared the bean as `InstantSource instantSource() { return Clock.systemUTC(); }` and a class asking for a `Clock` will not start. Why?**
Because the container matches on the *declared* type of the bean definition, not on the
runtime class of the instance. The factory method's return type is `InstantSource`, so that
is the type registered, and a `Clock` dependency finds no candidate — even though the object
sitting in the context is a `Clock`. Declaring the bean as `Clock` fixes it and loses nothing,
since `Clock` is an `InstantSource` and will satisfy the narrower injection points too.

**★ Why not define your own `TimeProvider` interface?**
Because the JDK already defines it twice, with implementations. A home-grown interface has no
`fixed`, `offset` or `tick`, so every test hand-rolls a lambda and the codebase accumulates
several subtly different notions of a test clock; it has no `withZone`, so calendar code
either can't be written or reaches for the default zone; and it carries no meaning to a
reader or to a static-analysis rule. The only defensible reason is a compilation target below
JDK 17, and there the answer is `Clock`, not a new type.

{/* FOOTER */}
