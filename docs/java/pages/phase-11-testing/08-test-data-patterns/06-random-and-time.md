---
title: "A method that calls LocalDate.now() has hard-coded its clock — the javadoc says so in exactly those words — so the fix is not a cleverer test, it is one more constructor parameter"
sidebar_label: "06 · Random and time"
sidebar_position: 40
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-31 against the JDK 25 javadoc for `java.time.Clock`
> ([Clock](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/time/Clock.html)),
> `java.time.InstantSource`
> ([InstantSource](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/time/InstantSource.html))
> and `java.time.LocalDate`
> ([LocalDate](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/time/LocalDate.html)).
> Version spine from `spring-boot-dependencies:4.1.0`: JDK 25, Spring Boot 4.1.0, Spring
> Framework 7.0.8, JUnit Jupiter 6.0.3, Mockito 5.23.0, AssertJ 3.27.7, Testcontainers
> 2.0.5, Awaitility 4.3.0. **There is no sandbox on this machine** — this page carries
> Java source and documented behaviour, never a test run, a timing or a console
> transcript.

**Every test data pattern in this topic — the builder, the object mother, the `@Sql`
fixture — exists to make a test say out loud what it depends on. A call to
`LocalDate.now()` in production code defeats all of them at once, because it introduces
an input that no builder can set, no fixture can pin and no assertion can name. The JDK's
own javadoc for that method does not describe it as convenient; it describes it as a
defect: "Using this method will prevent the ability to use an alternate clock for testing
because the clock is hard-coded." This chunk is about taking the clock out of the method
body and putting it in the constructor. [06b](06b-what-to-inject.md) is about which type the
parameter should be, and [06c](06c-the-clocks-a-test-passes.md) about the values a test
hands it.**

## The javadoc already told you

`LocalDate` ships three `now()` methods and documents them as three different decisions,
not three conveniences. The wording is unusually blunt for a JDK class:

> *"Obtains the current date from the system clock in the default time-zone. … Using this
> method will prevent the ability to use an alternate clock for testing because the clock
> is hard-coded."* — `LocalDate.now()`

> *"Obtains the current date from the system clock in the specified time-zone. …
> Specifying the time-zone avoids dependence on the default time-zone. Using this method
> will prevent the ability to use an alternate clock for testing because the clock is
> hard-coded."* — `LocalDate.now(ZoneId)`

> *"Obtains the current date from the specified clock. This will query the specified clock
> to obtain the current date - today. **Using this method allows the use of an alternate
> clock for testing. The alternate clock may be introduced using dependency injection.**"*
> — `LocalDate.now(Clock)`

The same triple exists on `LocalDateTime`, `LocalTime`, `ZonedDateTime`, `OffsetDateTime`,
`Year`, `YearMonth`, `MonthDay` and `Instant`. **Passing a `ZoneId` fixes the second
problem and not the first** — that is the detail people miss, and it is why
`LocalDate.now(ZoneId.of("UTC"))` in a domain method is still untestable. The zone was
never the hard part; the *instant* is.

`Clock`'s own class javadoc states the design intent directly, with the injection example
inline:

> *"Best practice for applications is to pass a `Clock` into any method that requires the
> current instant and time-zone. A dependency injection framework is one way to achieve
> this … This approach allows an alternative clock, such as `fixed` or `offset` to be used
> during testing."*

> *"Use of a `Clock` is optional. All key date-time classes also have a `now()` factory
> method that uses the system clock in the default time zone. The primary purpose of this
> abstraction is to allow alternate clocks to be plugged in as and when required."*

## What "untestable" concretely costs

"Untestable" is a vague word and it lets people argue. Here is what it actually buys you,
in three specific failures, for a method that reads the clock itself:

```java
class TrialService {

    Trial start(Customer customer) {
        LocalDate today = LocalDate.now();               // the defect
        return new Trial(customer.id(), today, today.plusDays(30));
    }
}
```

**1 · The only assertion you can write is a tautology.** To assert the trial ends in
thirty days, the test must compute the expectation the same way the production code did:

```java
assertThat(trial.endsOn()).isEqualTo(LocalDate.now().plusDays(30));   // proves nothing
```

That assertion passes if `plusDays(30)` is wrong in both places, and it passes if the
production method is deleted and replaced with the test's own expression. It
re-implements the code under test, which is the definition of an assertion that cannot
fail for the right reason.
[09d · Setup drift and computed expectations](../03-parameterized-tests/09d-setup-drift-and-computed-expectations.md)
is the same failure seen from the parameterized-test side.

**2 · The interesting cases are unreachable.** What does a trial started on 31 January end
on? What about 29 February 2024? What about the last day the customer is eligible? Those
are the behaviours the method exists to get right, and you cannot write any of them,
because you cannot choose the start date. You can only test the method on the day the CI
agent happens to run it.

**3 · The test has a nightly window in which it is wrong.** Call `LocalDate.now()` twice
in one operation — once in the service, once in the test — and there is a slice of every
day, however narrow, in which the two calls straddle midnight and disagree. That is a
flake with a schedule: it fails at 00:00 UTC, roughly never, and always on the day of a
release. [14b · Time and determinism](../01-junit-5/14b-time-and-determinism.md) catalogues
this family alongside locale, charset and hash order.

## The fix: the clock is a constructor parameter

```java
class TrialService {

    private final Clock clock;

    TrialService(Clock clock) {
        this.clock = clock;
    }

    Trial start(Customer customer) {
        LocalDate today = LocalDate.now(clock);
        return new Trial(customer.id(), today, today.plusDays(30));
    }
}
```

```java
@Test
void aTrialStartedOnTheThirtyFirstOfJanuaryEndsOnTheSecondOfMarch() {
    Clock jan31 = Clock.fixed(Instant.parse("2026-01-31T09:00:00Z"), ZoneOffset.UTC);

    Trial trial = new TrialService(jan31).start(aCustomer().build());

    assertThat(trial.endsOn()).isEqualTo(LocalDate.of(2026, 3, 2));
}
```

The expectation is now a **literal**. `LocalDate.of(2026, 3, 2)` is a fact about the
calendar that a reviewer can check by hand, and it cannot drift with the implementation
because it does not mention the implementation. That is the whole return on the extra
constructor parameter, and it is the same argument the builder makes in
[02 · The builder](02-the-builder.md): the value the test is about should appear,
spelled out, in the test.

Read the clock **once** per operation and pass the value down. A service that calls
`LocalDate.now(clock)` in four places has four opportunities to straddle a boundary even
with an injected clock — a fixed clock in the test hides that, and a `Clock.systemUTC()`
in production does not.

## Which classes take the clock, and which must not

The objection to injection is always "so now every class needs a `Clock`". It does not,
and the rule that keeps the parameter from spreading is a scope rule, not a taste one.

- **Application services and use-case handlers take the clock.** They own the transaction,
  they own "when did this happen", and they are the natural place to read it once.
- **Entities, records and value objects take the *value*, not the clock.** `new Order(customerId, placedAt)`
  keeps `Order` a thing you can write down in a builder. `new Order(customerId, clock)`
  means every construction site — every test builder, every JSON deserialization path,
  every `@Sql` fixture's Java equivalent — has to produce a clock before it can produce an
  order, and the object is no longer a value.
- **Pure calculators take neither.** A method that answers "given this start date, what is
  the end date" should take the start date. If a class has a clock *and* a rule, split it:
  the rule becomes a function of dates you can table-test with
  [`@ParameterizedTest`](../03-parameterized-tests/01-one-test-many-cases.md), and the
  service does the single clock read that feeds it.

Applied consistently, a service module usually ends up with a handful of clock-taking
classes and everything else pure — which is also why the suite gets fast, since the pure
half needs no Spring context at all
([02 · A unit test needs no Spring](../05-the-test-pyramid/02-a-unit-test-needs-no-spring.md)).

## Where this connects

- Which type to inject — `Clock` or the narrower `InstantSource`:
  [06b · What to inject](06b-what-to-inject.md).
- The values a test passes — `fixed`, `offset`, `tick`, a mutable clock — and why
  `mock(Clock.class)` and `mockStatic(LocalDate.class)` are the inferior fixes:
  [06c · The clocks a test passes](06c-the-clocks-a-test-passes.md).
- Declaring the `Clock` bean and replacing it in a slice:
  [06d · The clock in Spring](06e-the-clock-bean.md).
- Timestamps written by JPA auditing or by the database, and how to assert on them:
  [06e · Timestamps you did not write](06g-the-clocks-you-do-not-own.md).
- Random values, generated ids and seeded generators:
  **06f · Random values and generated ids** *(not written yet)*.
- Day boundaries, DST and time zones are catalogued from the flake side in
  [14b · Time and determinism](../01-junit-5/14b-time-and-determinism.md).
- What `Instant` is and why it is not `LocalDateTime`:
  [Phase 7 · Machine vs calendar time](../../phase-7-io-time-stdlib/01-java-time/02-machine-vs-calendar-time.md).
- Asserting on a time you did not choose:
  [02 · AssertJ · 08b · Dates and times](../02-assertj/08b-dates-and-times.md).

## Gotchas

**★ `LocalDate.now(ZoneId.of("UTC"))` looks like the fixed version and is not.**
Passing a zone removes the *default-time-zone* dependency and leaves the *system-clock*
dependency exactly where it was — the javadoc says so for that overload in the same
sentence it uses for the no-arg one: *"Using this method will prevent the ability to use
an alternate clock for testing because the clock is hard-coded."* Only the `Clock` overload
is testable. If you see a codebase that "fixed the time-zone bug" by adding `ZoneId`
arguments everywhere, the clock is still hard-coded in every one of them.

**★ Injecting a `Clock` and then calling `Instant.now()` anyway.**
The seam is only worth what it covers. A service that takes a `Clock` in its constructor
and then calls `System.currentTimeMillis()` inside a private helper is untestable in
precisely the place the helper matters. Grep the module for `now()`, `currentTimeMillis`,
`new Date(`, `Instant.now`, `LocalDate.now`, `LocalDateTime.now` and `nanoTime` after you
introduce the clock; the remaining hits are the ones that will flake.

**★ `System.nanoTime()` is the honest exception, and people "fix" it anyway.**
It is a monotonic tick with no epoch, no zone and no `Clock` equivalent — the javadoc is
explicit that its absolute value is meaningless and only differences are. Code that
measures a `Duration` with it is measuring elapsed time, not reading a calendar, and
wrapping it in a `Clock` gains nothing. What the clock discipline *does* say about it is
that a test should not assert on the elapsed value, because that is an assertion about the
CI machine's scheduler.

**★ Reading the injected clock more than once inside one operation.**
`LocalDate.now(clock)` called at the top of a method and again in a helper is two reads. A
fixed clock in a test makes them agree and hides the bug; a system clock in production
lets them straddle midnight. Read once, assign to a local, pass it down — the injected
clock removed the *untestability*, not the *double read*.

**★ Putting the `Clock` in a record's compact constructor instead of in the service.**
A value object should be handed the time it was created at, not go and look it up. If
`Order` takes a `Clock` so it can stamp itself, every construction site now needs a clock,
including every test builder and every deserialization path, and the object is no longer a
value. Stamp at the boundary: the service reads the clock once and passes an `Instant`
into the constructor.

**★ A default method or static helper that reads the clock behind the injected one.**
`interface Expirable { default boolean expired() { return expiresAt().isBefore(Instant.now()); } }`
is untestable no matter how many clocks the implementing service takes, because the read
is in the interface. Interface defaults and static utility methods are the two places the
clock hides after a refactor that "injected the clock everywhere".

**★ "Every class needs a `Clock` now" — used as an argument against injecting it at all.**
It is a real cost and the answer is a scope rule, not a compromise. Services take the
clock, entities take the value, pure calculators take neither. If the parameter really is
spreading into dozens of classes, that is a signal that time-reading logic is scattered
through the domain rather than concentrated at the use-case boundary — and the scattering
was the bug, not the parameter.

## Interview questions

**★ Why is `LocalDate.now()` inside a domain method a problem, and what exactly does injecting a `Clock` buy you?**
It makes the current date an input the caller cannot supply, so a test can only assert
against a value it computed the same way the code did — which is a tautology — and cannot
reach the interesting cases at all: month ends, leap days, the boundary the feature exists
to handle. The javadoc says it outright: using `now()` "will prevent the ability to use an
alternate clock for testing because the clock is hard-coded". Injecting a `Clock` turns the
expectation into a literal date a reviewer can check by hand, makes 29 February a test case
rather than an incident, and removes the midnight window in which the test and the code
disagree about what day it is. It costs one constructor parameter and `Clock.systemUTC()`
in the production wiring.

**★ A colleague fixed a "time-zone bug" by changing every `LocalDate.now()` to `LocalDate.now(ZoneId.of("UTC"))`. Is the code now testable?**
No. Two independent dependencies were hiding in `now()`: the default time zone and the
system clock. Passing a `ZoneId` removes the first, which is a genuine improvement — the
value no longer depends on where the process runs. The second is untouched, and the javadoc
for the `ZoneId` overload repeats the same warning word for word: the clock is still
hard-coded. The tests still cannot choose a date, still cannot reach 29 February, and still
have a midnight window. The `Clock` overload is the only one of the three that the javadoc
describes as testable.

**★ Where should the clock be read — the entity, the service, or the controller?**
Once, at the boundary of the operation, in the component that already owns the transaction —
normally the application service. Reading it in an entity or a value object means every
construction site, including every test builder and every deserialization path, has to
supply a clock, and the object stops being a value you can write down. Reading it in the
controller and passing it through is defensible for a request timestamp but spreads the
parameter through every signature in between. One read at the top of the use case, assigned
to a local, passed down as an `Instant`, keeps the whole operation on a single consistent
"now" — which is also what stops the same operation from straddling midnight internally.

**★ How do you find the remaining clock reads after you have "injected the clock"?**
Grep, then compile. Grep the module for `Instant.now`, `LocalDate.now`, `LocalDateTime.now`,
`LocalTime.now`, `ZonedDateTime.now`, `OffsetDateTime.now`, `System.currentTimeMillis`,
`new Date(` and `Calendar.getInstance` — and remember to look inside interface default
methods and static utility classes, which is where the reads survive a refactor. The
stronger, non-grep version is architectural: an ArchUnit rule or a Checkstyle
`IllegalMethodCall` that fails the build on the no-arg `now()` overloads, which turns
"someone will notice in review" into "the build stops". `System.nanoTime` is the one hit
you leave alone.

**★ The team objects that injecting a clock will put a `Clock` parameter in a hundred constructors. How do you answer?**
By pointing at where the hundred came from. If a hundred classes read the current time, the
time-reading is scattered through the domain, and that scattering is the actual defect —
it is also why nobody can say what "now" means for a single request. Concentrating the read
at the use-case boundary usually collapses the hundred to a handful: services take the
clock, entities are handed the resulting `Instant`, and pure calculation takes a date
parameter it can be table-tested against. The refactor pays twice, because the pure half
then needs no Spring context to test.

{/* FOOTER */}
