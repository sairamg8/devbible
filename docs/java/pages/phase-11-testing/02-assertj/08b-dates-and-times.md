---
title: "Date and time assertions are where a test learns to be flaky, because the value under test was produced by a clock — so the useful part of this API is isCloseTo with an offset, and the isEqualToIgnoringX family is a trap that fails on a one-nanosecond difference"
sidebar_label: "08b · Dates, times and durations"
sidebar_position: 22
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-27 against the `assertj-core` **3.27.7** sources on GitHub
> (tag `assertj-build-3.27.7`) — the javadoc and implementations on
> [`AbstractLocalDateTimeAssert`](https://github.com/assertj/assertj/blob/assertj-build-3.27.7/assertj-core/src/main/java/org/assertj/core/api/AbstractLocalDateTimeAssert.java)
> (`isBefore`, `isAfter`, `isBetween`, `isStrictlyBetween`, `hasYear`…`hasNano`,
> `isEqualToIgnoringNanos`/`Seconds`/`Minutes`/`Hours`, `isCloseToUtcNow`,
> `isInThePast`, `isInTheFuture`, the `String` overloads),
> [`AbstractTemporalAssert`](https://github.com/assertj/assertj/blob/assertj-build-3.27.7/assertj-core/src/main/java/org/assertj/core/api/AbstractTemporalAssert.java)
> (`isCloseTo`, `usingComparator`) and
> [`AbstractDurationAssert`](https://github.com/assertj/assertj/blob/assertj-build-3.27.7/assertj-core/src/main/java/org/assertj/core/api/AbstractDurationAssert.java).
> JDK 25 · Spring Boot 4.1.0 → AssertJ Core 3.27.7, JUnit Jupiter 6.0.3.

**Almost every temporal assertion that goes wrong goes wrong the same way: the value came
from `now()`, the test compares it to another `now()`, and the two are microseconds apart.
The right answer is a tolerance — `isCloseTo(expected, within(1, ChronoUnit.SECONDS))` — and
the wrong answer that looks right is `isEqualToIgnoringNanos`, which is not a tolerance at
all. This page is that distinction first, and the rest of the API after it.**

## Ordering and ranges

```java
assertThat(placedAt).isBefore(shippedAt);
assertThat(placedAt).isBeforeOrEqualTo(shippedAt);
assertThat(shippedAt).isAfter(placedAt);
assertThat(shippedAt).isAfterOrEqualTo(placedAt);

assertThat(placedAt).isBetween(windowStart, windowEnd);          // inclusive both ends
assertThat(placedAt).isStrictlyBetween(windowStart, windowEnd);  // exclusive both ends
```

The parameter names in the source say the semantics outright: `isBetween(LocalDateTime
startInclusive, LocalDateTime endInclusive)` and `isStrictlyBetween(LocalDateTime
startExclusive, LocalDateTime endExclusive)`. No guessing required, and the two differ only
at the boundary — which is exactly the case a test about a window should be covering.

Every one of these has a `String` overload that parses:

```java
assertThat(placedAt).isBefore("2026-08-27T10:00:00");
assertThat(placedAt).isBetween("2026-08-27T00:00:00", "2026-08-27T23:59:59");
```

⚠️ Concise, and it moves a parse error from compile time to runtime. The source rejects a
`null` string with an `IllegalArgumentException` — *"The String representing the
LocalDateTime to compare actual with should not be null"* — but a malformed one is a
`DateTimeParseException` in the middle of your test.

## Fields

```java
assertThat(placedAt).hasYear(2026)
                    .hasMonth(Month.AUGUST)
                    .hasMonthValue(8)
                    .hasDayOfMonth(27)
                    .hasHour(10)
                    .hasMinute(30)
                    .hasSecond(0)
                    .hasNano(0);
```

Useful when only part of the value is under test — "the report is dated today" cares about
the date and not the time. Note `hasMonth(Month)` and `hasMonthValue(int)` are separate
methods, which is the library declining to guess whether your `8` means August or an index.

## 🔴 `isCloseTo` versus the `isEqualToIgnoringX` family

This is the section that matters.

### `isCloseTo` — a genuine tolerance

From the `AbstractTemporalAssert` javadoc:

```java
assertThat(_07_10).isCloseTo(_07_42, within(1, ChronoUnit.HOURS));
assertThat(_07_10).isCloseTo(_07_42, within(32, ChronoUnit.MINUTES));
assertThat(_07_10).isCloseTo(_07_42, byLessThan(32, ChronoUnit.MINUTES));
assertThat(_07_10).isCloseTo(_07_42, within(10, ChronoUnit.SECONDS));
```

`within` is inclusive of the boundary, `byLessThan` is exclusive — the same pair as in
[02d · Numbers and offsets](02d-numbers-and-offsets.md), and the `isCloseToUtcNow` javadoc
states the inclusive rule explicitly: *"If the difference is equal to the offset, the
assertion succeeds."* There is a `String` overload too:

```java
assertThat(LocalTime.parse("07:10:30")).isCloseTo("07:12:11", within(5, ChronoUnit.MINUTES));
```

### `isEqualToIgnoringNanos` — not a tolerance

The javadoc is unusually blunt about its own method, and it is worth quoting in full:

> *"Verifies that actual and given `LocalDateTime` have same year, month, day, hour, minute
> and second fields, (nanosecond fields are ignored in comparison).*
>
> *Assertion can fail with localDateTimes in same chronological nanosecond time window,
> e.g : 2000-01-01T00:00:**01.000000000** and 2000-01-01T00:00:**00.999999999**.*
>
> *Assertion fails as second fields differ even if time difference is only 1ns."*

with the examples:

```java
// successful assertions
LocalDateTime localDateTime1 = LocalDateTime.of(2000, 1, 1, 0, 0, 1, 0);
LocalDateTime localDateTime2 = LocalDateTime.of(2000, 1, 1, 0, 0, 1, 456);
assertThat(localDateTime1).isEqualToIgnoringNanos(localDateTime2);

// failing assertions (even if time difference is only 1ms)
LocalDateTime localDateTimeA = LocalDateTime.of(2000, 1, 1, 0, 0, 1, 0);
LocalDateTime localDateTimeB = LocalDateTime.of(2000, 1, 1, 0, 0, 0, 999999999);
assertThat(localDateTimeA).isEqualToIgnoringNanos(localDateTimeB);
```

**Two values one nanosecond apart, and the assertion fails.** It truncates fields; it does
not measure a distance. The same applies to `isEqualToIgnoringSeconds`, `…Minutes` and
`…Hours` — each one fails at its own boundary, and the coarser the unit the rarer and
nastier the flake. `isEqualToIgnoringHours` is green all day and red at midnight.

**Use `isCloseTo(other, within(n, unit))`.** It is what people mean when they reach for
`isEqualToIgnoringNanos`, and it has no boundary to straddle.

### `isCloseToUtcNow`

```java
LocalDateTime actual = LocalDateTime.now(Clock.systemUTC());

// assertion will pass as if executed less than one second after actual was built
assertThat(actual).isCloseToUtcNow(within(1, ChronoUnit.SECONDS));

// assertion will fail
assertThat(actual.plusSeconds(2)).isCloseToUtcNow(within(1, ChronoUnit.SECONDS));
```

The implementation is `isCloseTo(now(systemUTC()), offset)`. Note the javadoc's own hedge —
*"as if executed less than one second after actual was built"*. It is a real-clock
assertion, and on a loaded CI box a one-second window is not always enough.

## `isInThePast` and `isInTheFuture`

```java
assertThat(placedAt).isInThePast();
assertThat(expiresAt).isInTheFuture();
```

Both read the real clock. `isInTheFuture()` on a value one millisecond ahead is a race, and
a test that passes locally will eventually fail on a slower machine.

## Durations

```java
assertThat(elapsed).isPositive()
                   .hasSeconds(30);

assertThat(Duration.ZERO).isZero();
assertThat(elapsed).isCloseTo(Duration.ofSeconds(30), Duration.ofMillis(50));
```

`hasNanos`, `hasMillis`, `hasSeconds`, `hasMinutes`, `hasHours`, `hasDays`, plus `isZero`,
`isNegative`, `isPositive`, and an `isCloseTo(Duration expected, Duration allowedDifference)`
that takes a `Duration` as the tolerance rather than a `TemporalOffset`.

## The real fix: inject a `Clock`

Every gotcha on this page comes from the code under test calling `LocalDateTime.now()`
itself. The assertion-side answer is a tolerance; the design-side answer is better:

```java
// production
public Order place(Basket basket) {
    return new Order(basket, LocalDateTime.now(clock));   // Clock injected
}

// test
Clock fixed = Clock.fixed(Instant.parse("2026-08-27T10:00:00Z"), ZoneOffset.UTC);
// ... build the service with `fixed` ...
assertThat(order.placedAt()).isEqualTo(LocalDateTime.of(2026, 8, 27, 10, 0));
```

With a fixed `Clock`, `isEqualTo` is correct, exact and never flaky — and Spring Boot will
inject a `Clock` bean like any other. **Reach for `isCloseTo` when you cannot change the
production code; reach for a `Clock` when you can.**

## Gotchas

**★ `isEqualToIgnoringNanos` is not a tolerance and fails on a 1ns difference.**
The javadoc says so with its own example: `00:00:01.000000000` and `00:00:00.999999999`
fail, *"even if time difference is only 1ns"*. It truncates fields; it does not measure
distance. Use `isCloseTo(other, within(...))`.

**★ The whole `isEqualToIgnoringX` family has the same boundary problem, scaled up.**
`isEqualToIgnoringHours` compares year, month, day and hour, so two values a millisecond
apart across a midnight boundary differ in every one of them. The coarser the ignored unit,
the rarer the failure — and the harder to reproduce.

**★ `within` includes the boundary, `byLessThan` excludes it.**
The `isCloseToUtcNow` javadoc states it: *"If the difference is equal to the offset, the
assertion succeeds."* Getting this backwards produces an off-by-one-unit flake at exactly
the tolerance.

**★ `isInTheFuture()` on a value milliseconds ahead.**
It reads the real clock at assertion time. A value built one millisecond in the future is a
race between your test and the CPU. Assert against a fixed reference instead.

**★ `isCloseToUtcNow(within(1, SECONDS))` on a loaded CI machine.**
One second sounds generous and is not, on a box running a full suite in parallel. Either
widen it deliberately with a comment, or inject a `Clock` and stop guessing.

**★ The `String` overloads move parse errors to runtime.**
`isBefore("2026-08-27T10:00:00")` is concise; a typo is a `DateTimeParseException` inside
the test rather than a compile error. A `null` string is rejected with an explicit
`IllegalArgumentException`, which is at least a clear message.

**★ Comparing a `LocalDateTime` to a value that crossed a time zone.**
`LocalDateTime` has no zone. Asserting one produced in UTC against one produced in the
JVM's default zone compares two different instants that look like the same type. Use
`Instant` or `ZonedDateTime` where the zone matters, and pin the test JVM's zone.

**★ Asserting a database-round-tripped timestamp for exact equality.**
PostgreSQL `timestamp` stores microseconds; `LocalDateTime` holds nanoseconds. A value
saved and re-read has been truncated, so `isEqualTo` fails on a value that is correct.
`isCloseTo(..., within(1, ChronoUnit.MICROS))` — or store what the column can hold.

**★ `hasMonth(Month.AUGUST)` and `hasMonthValue(8)` are different methods.**
Deliberately, so nobody has to guess whether an `int` month is zero-based. Reaching for
`hasMonth(8)` does not compile, which is the library working correctly.

**★ `isBetween` is inclusive and `isStrictlyBetween` is exclusive.**
The parameter names say it — `startInclusive`/`endInclusive` versus
`startExclusive`/`endExclusive`. A test about a window that never checks its boundary is not
testing the thing the window exists for.

**★ Using a tolerance to paper over a design that reads the clock.**
`isCloseTo(..., within(5, SECONDS))` on a value the production code produced with
`LocalDateTime.now()` is a correct assertion about untestable code. Injecting a `Clock`
makes `isEqualTo` valid and removes the flake class entirely.

## Interview questions

**★ What is wrong with `isEqualToIgnoringNanos`?**
It is not a tolerance. It compares year, month, day, hour, minute and second as fields, so
two values one nanosecond apart across a second boundary — the javadoc's own example is
`00:00:01.000000000` versus `00:00:00.999999999` — differ in the second field and the
assertion fails. What people want is `isCloseTo(other, within(1, ChronoUnit.SECONDS))`.

**★ `within` or `byLessThan`?**
`within(n, unit)` is inclusive — a difference exactly equal to the offset passes, which the
`isCloseToUtcNow` javadoc states directly. `byLessThan(n, unit)` is exclusive. The pair
mirrors the numeric offsets, and picking the wrong one gives you a failure that appears only
at exactly the tolerance.

**★ How do you test code that timestamps with `LocalDateTime.now()`?**
Properly: inject a `Clock`, use `Clock.fixed(...)` in the test, and assert with `isEqualTo`.
The value becomes deterministic and the whole class of temporal flakiness disappears. Only
when the production code cannot be changed do you fall back to `isCloseTo` with a tolerance
wide enough for the slowest machine that will run it.

**★ Why might `isEqualTo` fail on a timestamp read back from PostgreSQL?**
Because the column stores microseconds and `LocalDateTime` holds nanoseconds, so the value
was truncated on the way in. The object is correct and the assertion is too strict. Compare
with a microsecond tolerance, or make the field's precision match the column's.

**★ What is the difference between `isBetween` and `isStrictlyBetween`?**
Inclusive versus exclusive at both ends — the source's parameter names are literally
`startInclusive`/`endInclusive` and `startExclusive`/`endExclusive`. The distinction only
shows up at the boundary, which is precisely the case a test about a validity window should
be pinning.

**★ Is `isInTheFuture()` safe to use?**
Only when the margin is large. It evaluates against the real clock at assertion time, so a
value a few milliseconds ahead is a race between the test and the machine. A token that
expires in an hour is fine; a value produced "now plus a bit" is a flake waiting for a slow
CI run.

**★ You need to assert an elapsed `Duration` is about 30 seconds. How?**
`assertThat(elapsed).isCloseTo(Duration.ofSeconds(30), Duration.ofMillis(50))` — the
`Duration` assert's `isCloseTo` takes the allowed difference as a `Duration` rather than a
`TemporalOffset`. And then ask why the test is measuring wall-clock time at all, because
that is a flake source no tolerance fully removes.

{/* FOOTER */}
