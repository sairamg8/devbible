---
title: "Both shortcuts around injecting a clock are mocks — mock(Clock.class) and mockStatic(LocalDate.class) — and both fail for the same underlying reason: a clock is a value, and mocking a value produces a thing no real clock could be"
sidebar_label: "06d · The two mocks that are not the fix"
sidebar_position: 43
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-31 against the JDK 25 javadoc for `java.time.Clock` — `equals`,
> `hashCode`, "Implementation Requirements"
> ([Clock](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/time/Clock.html))
> — and `java.time.LocalDate`
> ([LocalDate](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/time/LocalDate.html)).
> Mockito behaviour cross-checked against this phase's
> [11 · Static and final](../04-mockito/11-static-and-final.md) and
> [03e · Unstubbed defaults](../04-mockito/03e-unstubbed-defaults.md), which own the
> mechanism. Version spine from `spring-boot-dependencies:4.1.0`: JDK 25, Spring Boot 4.1.0,
> Spring Framework 7.0.8, JUnit Jupiter 6.0.3, **Mockito 5.23.0**, AssertJ 3.27.7.
> **No sandbox** — Java source and documented behaviour only, never a run.

**Every team that reads [06](06-random-and-time.md) and does not want the constructor
parameter arrives at one of two mocks. `mock(Clock.class)` keeps the parameter and fakes the
value; `mockStatic(LocalDate.class)` keeps the value and fakes the JDK. They fail differently
and they fail for the same reason: a clock is a *value*, and Mockito's job is *collaborators*.
This chunk shows what each one actually does, what it costs, and the one case — third-party
code you cannot change — where something mock-shaped is genuinely the answer, along with what
that something should be.**

## `mock(Clock.class)` — it compiles, which is the problem

`Clock` is a public non-final abstract class, so Mockito will mock it happily. Then every
unstubbed method returns the type's default: `null` for `Instant`, `null` for `ZoneId`.

```java
Clock clock = mock(Clock.class);            // succeeds
new TrialService(clock).start(customer);    // NPE inside java.time
```

`LocalDate.now(clock)` calls `clock.getZone()` and `clock.instant()`, gets `null` from one or
both, and throws inside `java.time`. The stack trace names JDK classes and your service — it
does not name the mock, and it does not say "you forgot to stub `getZone()`". Developers lose
twenty minutes to this and then stub both methods, at which point the mock is a worse
`Clock.fixed`.

Worse in four concrete ways, even fully stubbed:

- **It can be self-contradictory.** Stub `instant()` to one value and `getZone()` to a zone,
  and nothing forces the pair to be coherent — you can build a clock whose `withZone` returns
  something unrelated to either. No real `Clock` can be in that state.
- **It costs more than the thing it replaces.** `Clock.fixed(instant, UTC)` is one allocation
  of a JDK value class; a mock is a generated subclass, an invocation container and a
  `MockingProgress` entry.
- **Strict stubs make it fragile.** `when(clock.instant())` that a changed code path stops
  using is reported as an `UnnecessaryStubbingException`
  ([07 · Strictness](../04-mockito/07-strictness.md)). A value cannot be "unnecessarily
  supplied".
- **It invites verification.** Once the clock is a mock, someone writes
  `verify(clock).instant()` — an assertion about *how many times the code read the clock*,
  which breaks precisely when you make the improvement of reading it once and passing the
  value down.

The replacement is one line and cannot be wrong:

```java
Clock clock = Clock.fixed(Instant.parse("2026-01-31T09:00:00Z"), ZoneOffset.UTC);
```

The same argument applies to `InstantSource`, and to a home-grown `Supplier<Instant>` — pass
`() -> instant`, do not mock a functional interface.

## `mockStatic(LocalDate.class)` — the JVM-wide shortcut

Mockito 5's inline mock maker can stub the static itself, which is what people reach for when
they will not add the parameter:

```java
try (MockedStatic<LocalDate> mocked = mockStatic(LocalDate.class, CALLS_REAL_METHODS)) {
    mocked.when(LocalDate::now).thenReturn(LocalDate.of(2026, 1, 31));
    // exercise TrialService, which still calls LocalDate.now() with no argument
    assertThat(new TrialService().start(customer).endsOn())
        .isEqualTo(LocalDate.of(2026, 3, 2));
}
```

It works. It is worse in five specific ways.

**1 · The dependency stays invisible.** `TrialService`'s constructor still claims it needs
nothing. The next reader cannot tell that time is an input, which is the problem you were
trying to solve; the test merely knows a secret about the implementation.

**2 · The scope is the whole JVM for the duration of the block**, not the object under test.
Anything the code path touches — a validator, a logging appender, a Spring component, a
library — sees the stubbed `LocalDate.now()` too. Behaviour changes in places nobody
inspected, and the test is green either way.

**3 · It pins only the signature you named.** Stub `LocalDate.now()` and an `Instant.now()`
two frames down is still on the wall clock. The test is *half*-deterministic, which is the
worst amount: it looks pinned, so nobody suspects the clock when it flakes at midnight.

**4 · Without `CALLS_REAL_METHODS` every other static on the class is stubbed too.**
`LocalDate.of(...)`, `LocalDate.parse(...)`, `LocalDate.ofEpochDay(...)` all begin returning
`null`, so the fixture the test built two lines earlier evaporates and the resulting
`NullPointerException` points at your builder rather than at the mock. And the static mock is
**thread-scoped**, so a condition evaluated on another thread — an async assertion, a polling
helper — does not see it at all.

**5 · It cannot express movement.** Advancing time means re-stubbing inside the try block,
which reads as plumbing rather than as a statement about the system, and the *order* of the
re-stubs becomes load-bearing.

[11 · Static and final](../04-mockito/11-static-and-final.md) and
[11b · Static mocking as a design signal](../04-mockito/11b-static-mocking-as-a-design-signal.md)
own the general argument. `LocalDate.now()` is its single most common trigger, and the refactor
it points at costs one parameter.

## The honest exception, and what it actually looks like

There is one case the argument above does not cover: **third-party code you cannot change**. A
library class calls `Instant.now()` internally and offers no clock, no constructor overload and
no setter. You cannot inject into it because you do not own its constructor.

The fix is still not a static mock. It is an interface **you** own, with the vendor call sealed
behind one thin implementation and your clock on your side of it:

```java
interface ExpiryPolicy {
    boolean expired(Token token);
}
```

```java
// production: the only class that touches the vendor, and the only one that is not unit-tested
final class VendorExpiryPolicy implements ExpiryPolicy {

    private final VendorSdk sdk;

    VendorExpiryPolicy(VendorSdk sdk) { this.sdk = sdk; }

    @Override public boolean expired(Token token) { return sdk.isExpired(token.raw()); }
}
```

```java
// your service now depends on the interface, and its tests supply a value
class SessionService {
    SessionService(ExpiryPolicy expiry, InstantSource time) { … }
}
```

Everything above `ExpiryPolicy` is testable with a two-line fake. `VendorExpiryPolicy` itself
gets one integration test against the real SDK — a contract test
([12c · Contract testing a fake](../04-mockito/12c-contract-testing-a-fake.md)) — which is the
only place the vendor's hidden clock reading can hurt you, and it is now a single known place
rather than an unbounded set of them.
[10e · The anti-corruption adapter](../04-mockito/10e-the-anti-corruption-adapter.md) is the
general shape.

**Where a static mock *is* defensible:** as a temporary characterisation harness while you build
that adapter around legacy code with no tests — the scaffolding that lets you write the first
assertions so the refactor is safe. As a stepping stone, with the adapter already planned. Not
as the destination, and never in a test that is meant to live.

## Where this connects

- Why the clock is a parameter at all: [06 · Random and time](06-random-and-time.md).
- The values you should be passing instead: [06c · The clocks a test passes](06c-the-clocks-a-test-passes.md).
- Replacing a `Clock` bean in a Spring slice — where the *right* answer is `@TestBean` and the
  wrong one is `@MockitoBean`: [06e · The clock in Spring](06e-the-clock-bean.md).
- What a mock is for in the first place:
  [01 · What a mock is for](../04-mockito/01-what-a-mock-is-for.md).
- Mocking JDK types in general: [10f · Mocking JDK types](../04-mockito/10f-mocking-jdk-types.md).
- Mocking value objects: [10g · Mocking value objects](../04-mockito/10g-mocking-value-objects.md).

## Gotchas

**★ A mock `Clock` returns `null` from `instant()`, and the failure lands fifty frames away.**
`mock(Clock.class)` succeeds because `Clock` is a non-final class, and unstubbed methods return
the type default. `LocalDate.now(clock)` then throws inside `java.time` with a trace that names
JDK classes and your service but never the mock. Use `Clock.fixed`; it cannot be in that state.

**★ Stubbing `instant()` but not `getZone()`.**
Half the calendar conversions need the zone, so the test passes for `Instant`-shaped assertions
and throws for `LocalDate`-shaped ones — in the same test class, which makes it look like a
problem with the code under test. A real clock cannot have an instant and no zone.

**★ `verify(clock).instant()` is an assertion about implementation detail.**
It pins *how many times* the code read the clock, so the refactor you actually want — read once
at the top of the operation and pass the value down — turns the test red for doing the right
thing. Assert on the value the operation produced.

**★ Mockito strict stubs turn a stale clock stubbing into a build failure.**
`when(clock.instant())` on a path that no longer reads the clock is reported as
`UnnecessaryStubbingException`. That is strictness working correctly and it is a failure mode a
*value* simply does not have: nobody ever reported an unnecessary `Clock.fixed`.

**★ `mockStatic` without `CALLS_REAL_METHODS` stubs every static on the class.**
`LocalDate.of(...)` and `LocalDate.parse(...)` start returning `null`, so the fixture built two
lines above the mock evaporates and the `NullPointerException` points at your builder. People
then "fix" the builder.

**★ A static mock is thread-scoped and does not reach another thread.**
The registration is per-thread, so a condition evaluated on a polling thread, an `@Async` call
or an executor task sees the real `LocalDate.now()`. The test then pins time on the path it
does not care about and leaves it wall-clock on the path it does.

**★ A static clock mock left open across an assertion that reports a date.**
If the assertion library formats a date while the static is still mocked, what appears in the
failure message is the stubbed value, not the real one — so the message describes a world that
only existed inside the `try` block. Keep the block as narrow as the call.

**★ "We mock the static because the class is legacy and we cannot change the constructor."**
Usually you can: add an overloaded constructor taking a `Clock`, delegate the old one to it
with `Clock.systemUTC()`, and no call site changes. That is a two-line, source-compatible edit
that gets you a real seam, and it is available in almost every case where this argument is
made.

**★ Mocking `Clock` in a Spring slice with `@MockitoBean` instead of supplying one with `@TestBean`.**
Same defect as `mock(Clock.class)` with an extra failure mode: `@MockitoBean` uses
`REPLACE_OR_CREATE`, so if no `Clock` bean existed it silently creates one and the test now
proves something about a bean the application does not have.
[06e](06e-the-clock-bean.md) has the mechanism.

## Interview questions

**★ What is wrong with `mock(Clock.class)`?**
Every unstubbed method on a Mockito mock returns the type's default, so `instant()` and
`getZone()` return `null`, and the first `LocalDate.now(clock)` throws inside `java.time` with a
stack trace that does not mention your test. Even fully stubbed it is worse: the JDK ships three
correct implementations that are cheaper to construct, cannot be stubbed inconsistently, and are
documented as immutable and thread-safe; strict stubs will fail the build on a stubbing a
changed code path stopped using; and a mock invites `verify(clock).instant()`, which asserts on
how many times the code read the clock. A mock is for a collaborator whose behaviour you want to
control; a clock's behaviour is a value, so supply the value.

**★ Someone proposes `mockStatic(LocalDate.class)` instead of refactoring. What is your argument?**
That it treats the symptom and keeps the disease. The class's signature still says it depends on
nothing but its arguments, so the invisible dependency that made the test hard survives. The
stub's scope is the whole JVM for the block, so libraries, validators and logging on the same
path silently see a different clock. It pins only the signature you named, so an `Instant.now()`
two frames down is still on the wall clock and the test is half-deterministic — which is worse
than not pinned, because now nobody suspects the clock. Without `CALLS_REAL_METHODS` every other
static on `LocalDate` returns `null` and the fixture collapses. And it cannot express time
moving without re-stubbing. The refactor it avoids is one constructor parameter.

**★ Is there ever a legitimate use for a static clock mock?**
Only against code you cannot change, and even then it is second-best. If a third-party class
reads `Instant.now()` internally, the right move is an adapter interface you own, with the
vendor call sealed behind one thin implementation and the clock on your side of the boundary;
your tests then supply a value through your own interface, and the vendor's clock reading is
confined to one class covered by a contract test. A static mock is defensible as a temporary
characterisation harness while you build that adapter around untested legacy code — as
scaffolding, with a plan, not as the destination.

**★ The legacy class you need to test is constructed in forty places. How do you introduce the clock?**
Add an overloaded constructor that takes the `Clock` and have the existing constructor delegate
to it with `Clock.systemUTC()`. Nothing at the forty call sites changes, nothing recompiles
differently, and the test can now construct the class with a fixed clock. In Spring, the same
move is one `@Bean` method plus a single constructor — and if the class is instantiated by the
container, there are no forty call sites to begin with. "We cannot change the constructor" is
almost always "we did not want to", and the source-compatible version costs two lines.

**★ How would you spot this problem in code review, rather than after a midnight failure?**
Two mechanical checks. First, a grep or an ArchUnit rule that fails the build on the no-arg
`now()` family — `LocalDate.now()`, `LocalDateTime.now()`, `Instant.now()`,
`System.currentTimeMillis()`, `new Date()` — outside a whitelisted composition root. Second, a
review heuristic: any test containing `mockStatic` of a JDK class, or `mock(Clock.class)`, is a
design signal, not a technique, and the question to ask on the pull request is "what would this
look like with the clock as a parameter?". Both checks turn "someone will notice" into "the
build stops", which is the only version that survives a busy week.

{/* FOOTER */}
