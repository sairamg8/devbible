---
title: "The second family of flakes is everything your code reads from the JVM without being asked to — the clock, the default time zone, the default locale, the default charset, and the iteration order of a HashMap — and each one fails on a different machine, in a different month, or for one developer only"
sidebar_label: "14b · Time and determinism"
sidebar_position: 52
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-28 against the JUnit 6.0.3 User Guide — "Parallel Execution"
> ([writing-tests/parallel-execution](https://docs.junit.org/6.0.3/writing-tests/parallel-execution.html));
> javadoc for `java.time.Clock`
> ([Clock](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/time/Clock.html)),
> `java.util.HashMap`
> ([HashMap](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/util/HashMap.html))
> and `java.nio.charset.Charset`
> ([Charset](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/nio/charset/Charset.html)).
> JDK 25, Spring Boot 4.1.1, JUnit Jupiter 6.0.3, Spring Framework 7.0.9.

**Every item here is a global the JVM will happily supply a default for, so the code compiles,
the test passes on your machine, and the value it actually depended on was never written down.
These flakes share one fix — make the dependency explicit — and one tell: the test fails on
somebody else's machine, or in a particular month, or once a year.**

[14](14-flaky-tests.md) is the framing and the state-based family;
[14c](14c-timing-and-concurrency.md) is timing and concurrency;
[14d](14d-environment.md) is the environment.

## The clock

**The cause:** `Instant.now()`, `LocalDate.now()`, `LocalDateTime.now()`,
`System.currentTimeMillis()`, `new Date()` — anywhere in *production* code that a test exercises.

**How it fails:**

- **The midnight boundary.** `LocalDate.now()` called twice, once either side of midnight, gives
  two dates. Any test that computes "today" more than once has a nightly window in which it is
  wrong.
- **The month and year boundary.** "Due at end of month", "expires in a year" — arithmetic that
  behaves differently in February, in a leap year, or on the 31st.
- **The elapsed-time assertion.** `assertTrue(end.isAfter(start))` fails when the clock has
  millisecond granularity and both calls land in the same millisecond, or when NTP steps the
  clock backwards.
- **The "within N seconds" assertion.** Widened until it stops failing, then widened again.

**The fix — inject a `java.time.Clock`:**

```java
class SubscriptionService {

    private final Clock clock;

    SubscriptionService(Clock clock) {
        this.clock = clock;
    }

    Subscription renew(Subscription s) {
        return s.renewedUntil(LocalDate.now(clock).plusYears(1));
    }
}
```

```java
@Test
void renewsForOneYear() {
    Clock fixed = Clock.fixed(Instant.parse("2024-02-29T10:15:30Z"), ZoneOffset.UTC);

    Subscription renewed = new SubscriptionService(fixed).renew(subscription);

    assertThat(renewed.expiresOn()).isEqualTo(LocalDate.of(2025, 2, 28));
}
```

`Clock` is in the JDK, `Clock.systemUTC()` is the production wiring, and every `now()` method in
`java.time` takes a `Clock` overload. This is the single highest-value change in this whole
topic: it removes an entire category of flake, it makes leap-day and month-end behaviour
*testable* rather than merely un-flaky, and it costs one constructor parameter.

⚠️ In Spring, expose a `Clock` bean and inject it. Do not reach for a bytecode-level time-mocking
library to avoid the constructor parameter — it makes the dependency invisible again, which is the
original problem.

## Time zones

**The cause:** `TimeZone.getDefault()` / `ZoneId.systemDefault()`, reached implicitly by
`LocalDate.now()`, `new Date()`, `Date.toString()`, JDBC drivers converting `TIMESTAMP`, and
`SimpleDateFormat`.

**How it fails:** a developer in UTC+13 and a CI agent in UTC disagree about what day it is for
eleven hours out of every twenty-four. Add daylight-saving transitions and you get two hours a
year that do not exist and one that happens twice — `2024-03-31T02:30` is not a valid local time
in Europe/London, and constructing it throws or silently shifts.

**Fix:** pass the zone explicitly — `LocalDate.now(clock)` with a zoned `Clock`,
`ZonedDateTime.now(zone)`, `Instant` for anything stored. Store instants in UTC and convert only
at the edges. Never `TimeZone.setDefault` in a test unless you also take
`@ResourceLock(Resources.TIME_ZONE)` ([12c](12c-resource-locks.md)) — Jupiter has a built-in
resource name for exactly this, which tells you how common the problem is.

**And test the awkward zones deliberately.** A parameterized test over `UTC`,
`America/Los_Angeles`, `Asia/Kolkata` (a half-hour offset), `Australia/Lord_Howe` (a half-hour DST
shift) and `Pacific/Kiritimati` (UTC+14) finds date-arithmetic bugs that no amount of running in
UTC ever will.

## Locale

**The cause:** `Locale.getDefault()`, reached by `String.toUpperCase()`, `String.toLowerCase()`,
`String.format`, `NumberFormat`, `DateTimeFormatter` without a locale, and `Collator`.

**How it fails, concretely:** `"i".toUpperCase()` is `"I"` in most locales and `"İ"` (dotted
capital I) in Turkish — the classic. Decimal separators swap between `.` and `,` across Europe, so
`String.format("%.2f", 1.5)` produces `1.50` or `1,50`. Month names, day names and sort order all
change.

**Fix:** `toUpperCase(Locale.ROOT)` for anything that is an identifier rather than human-facing
text; pass the `Locale` explicitly to every formatter; and use
`@ResourceLock(Resources.LOCALE)` if a test must set the default.

## Charset

**The cause:** `new String(bytes)`, `String.getBytes()`, `new FileReader(f)`, `new
FileWriter(f)`, `InputStreamReader` without a charset.

**The JDK 18+ change:** the default charset for these APIs is now UTF-8 regardless of the
platform, which removes most of this category on a modern JDK — a JDK 25 stack
([02b](02b-what-junit-6-changed.md)) is far safer here than an 11 one. What is *not* covered:
`System.out`'s encoding, the platform's `Charset.defaultCharset()` in older code paths, and any
library that still consults the locale.

**Fix:** name the charset. `new String(bytes, UTF_8)`, `Files.readString(path)` (UTF-8 by
contract), `Files.newBufferedReader(path, UTF_8)`. And commit test resource files with a known
encoding rather than relying on whatever the editor produced.

## Iteration order of hash-based collections

**The cause:** asserting on the order of a `HashMap`'s `keySet()`/`entrySet()`/`values()`, or a
`HashSet`'s iteration, or anything downstream of them — a JSON object serialised from a `HashMap`,
a comma-joined string built from a `Set`.

**Why it is not "random":** iteration order is a function of hash codes and table capacity, so it
is deterministic for a given set of keys *and a given insertion history*. Add a key, remove one,
or cross a resize threshold, and the order changes. That is why this flake appears months later,
in a commit that "only added a field".

**And it genuinely varies between runs** when the keys' hash codes do: any key whose `hashCode()`
derives from `Object`'s identity hash — an enum is safe, a `String` is safe, a record of `String`s
is safe, but a class that has not overridden `hashCode` is not.

**Fix:** assert on order only when order is part of the contract. AssertJ's
`containsExactlyInAnyOrder` for sets, `containsExactly` only for genuine sequences
([02 · AssertJ](../02-assertj/README.md)). If the production code's output order *is* the
contract — a serialised response, a report — then the production code must use a `LinkedHashMap`
or a `TreeMap`, and the test failure was correct to complain.

## Unseeded randomness

**The cause:** `new Random()`, `Math.random()`, `UUID.randomUUID()`, `ThreadLocalRandom`, and
data-generation libraries in their default configuration.

**How it fails:** the test passes for the values it happens to draw and fails for the ones it does
not. This is the worst flake to debug because the input is not in the failure report — you see an
assertion failure with no way to reconstruct what was fed in.

**Fix, in order of preference:**

1. **Use a fixed value.** Most tests do not need a random one; `"ada@example.com"` is clearer than
   a generated address and it appears in the failure message.
2. **Seed it, and print the seed.** `new Random(seed)` with the seed in the failure message, the
   pattern `MethodOrderer.Random` itself uses ([11b](11b-random-order.md)).
3. **Use property-based testing deliberately** — jqwik (topic 10 of this phase), which generates
   inputs *and* shrinks a failure to a minimal reproducing case *and* reports the seed. That is
   randomness done properly; `new Random()` in a test is randomness by accident.

⚠️ `UUID.randomUUID()` is often fine — as a *unique* value rather than an *arbitrary* one, it is
exactly what you want for per-test database keys ([14](14-flaky-tests.md)). The flake is asserting
on it, or letting it into a snapshot comparison.

## Gotchas

**★ Widening a time tolerance until the test stops failing.**
The tolerance is a guess about scheduling, and parallelism ([12](12-parallel-execution.md)) can
deschedule a test for arbitrarily long. An injected `Clock` removes the guess.

**★ `Instant.now()` in a test to build expected data.**
Both the test and the code then read a clock, and the two reads differ. Fix a `Clock` and derive
both sides from it.

**★ `LocalDate.now()` called twice in one operation.**
Once before midnight and once after gives two different dates. A `Clock` read once and passed
down gives one.

**★ Testing only in UTC.**
Half the date bugs in a codebase are invisible in UTC. Run date logic through a parameterized test
over a half-hour-offset zone, a DST-shifting zone and a UTC+14 zone.

**★ `TimeZone.setDefault` or `Locale.setDefault` without a resource lock.**
JVM-global mutation. Jupiter ships `Resources.TIME_ZONE` and `Resources.LOCALE` precisely because
this is common, and without the lock a concurrent test sees your value
([12c](12c-resource-locks.md)).

**★ `toUpperCase()` with no locale on an identifier.**
Turkish `"i"` uppercases to a dotted `İ`, so a case-insensitive comparison of `"id"` fails for one
locale and nobody else. `Locale.ROOT` for machine-facing strings.

**★ Assuming JDK 18+ fixed every charset problem.**
It made the *default charset for the standard file and string APIs* UTF-8, which is most of it. It
did not change `System.out`'s encoding on every platform, and it does not help a library that
consults the locale itself.

**★ Asserting on `HashMap` iteration order.**
It is deterministic per key set and capacity, not stable across changes. Adding one entry can
reorder everything. Use an order-insensitive assertion, or a `LinkedHashMap` if the order is
genuinely the contract.

**★ Assuming hash iteration order is stable across JVM runs.**
It is for `String` and enum keys. It is not for any key whose `hashCode()` falls back to identity,
which changes every run.

**★ `new Random()` in a test.**
The input that failed is not in the report, so you cannot reproduce it. Fixed values, or a seeded
generator that prints its seed, or a property-based framework that shrinks and reports.

**★ Asserting on a generated UUID.**
Generated identity is for uniqueness, not for assertions. Assert that the row exists under the id
you were given, not that the id equals anything.

## Interview questions

**★ How do you make time-dependent code testable?**
Inject a `java.time.Clock` and have production code call `LocalDate.now(clock)` rather than
`LocalDate.now()`. Tests supply `Clock.fixed(instant, zone)`; production supplies
`Clock.systemUTC()` or a zoned system clock. Beyond removing an entire category of flake, it makes
month-end, leap-day and DST behaviour something you can actually write a test for, instead of
something you wait to observe in production.

**★ Why does a date test fail for one developer and nobody else?**
Almost always the default time zone. `LocalDate.now()` resolves through `ZoneId.systemDefault()`,
so a developer in UTC+13 and a CI agent in UTC disagree about the current date for eleven hours a
day. The related cases are DST transitions, where a local time can be invalid or ambiguous, and
half-hour-offset zones, which break assumptions about whole-hour arithmetic.

**★ A test asserts on the order of a `HashMap`'s keys and fails six months after it was written.
What happened?**
Hash iteration order is a function of the keys' hash codes and the table's capacity. Adding a key,
removing one, or crossing a resize threshold reorders everything — so a commit that "only added a
field" changed the order. Either the assertion should be order-insensitive, or the production code
should use a `LinkedHashMap` because the order really is part of the contract.

**★ What is wrong with `new Random()` inside a test?**
The input that caused the failure is not recorded anywhere, so the failure cannot be reproduced or
even understood — you see an assertion diff with no idea what was fed in. Use a fixed value if the
test does not need variety, a seeded generator that reports its seed if it does, or a
property-based framework, which generates, shrinks to a minimal failing case, and tells you the
seed.

**★ Which locale-sensitive methods bite most often?**
`String.toUpperCase()` and `toLowerCase()` without a locale — the Turkish dotted-I is the standard
example, and it breaks case-insensitive comparison of ASCII identifiers — followed by `String.format`
and `NumberFormat`, where the decimal separator swaps between `.` and `,`. Use `Locale.ROOT` for
machine-facing strings and pass the locale explicitly for human-facing ones.

**★ Is `UUID.randomUUID()` in a test a flake?**
Not by itself. As a source of *uniqueness* it is exactly right — a per-test key that cannot collide
with another test's data solves a whole family of database flakes. It becomes a flake the moment
you assert on the value, or let it into a comparison against recorded output, because then the test
is depending on a value it did not choose.

{/* FOOTER */}
