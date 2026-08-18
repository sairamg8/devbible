---
title: "Machine vs calendar time"
sidebar_label: "2 · Machine vs calendar time"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-18 against the JDK 25 Javadoc for `Duration`, `Period`,
> `ZonedDateTime` (the gap/overlap resolution rules in the class summary and
> `of`/`atZone` docs), `ZoneRules`, `ZoneOffsetTransition` and
> `ChronoUnit`; DST transition dates from the IANA tzdb rules for
> `Europe/Berlin` (EU: last Sunday of March / last Sunday of October).

**`java.time` has two kinds of "amount of time" because humans and machines
disagree about what a day is. `Duration` is machine time — an exact count
of seconds. `Period` is calendar time — years, months and days as humans
mean them, where "one month" varies in length and "one day" is usually
86,400 seconds but twice a year is not. Every DST arithmetic bug is one of
these used where the other was meant.**

## `Duration` — seconds, exactly

```java
Duration d = Duration.ofHours(2).plusMinutes(30);   // PT2H30M
Duration between = Duration.between(start, end);    // start/end: Instants
```

- Stored as **seconds + nanosecond adjustment**. `Duration.ofDays(1)` is
  *exactly* 86,400 seconds — the Javadoc is explicit that days here are
  24-hour units "ignoring daylight savings effects".
- Natural partner of `Instant`: `instant.plus(duration)` is exact timeline
  arithmetic, no calendar involved.
- `toString()` is ISO-8601: `PT2H30M`, `PT0.5S`. Parse back with
  `Duration.parse`.
- Can be negative (`Duration.between(later, earlier)`); `isNegative()`,
  `negated()`, `abs()` exist for a reason — comparing raw `getSeconds()`
  without checking the sign is a bug.

## `Period` — the calendar's units

```java
Period p = Period.of(0, 3, 2);                      // P3M2D — 3 months 2 days
Period age = Period.between(birthDate, today);      // LocalDates
```

- Stored as **three separate `int` fields**: years, months, days. They do
  not normalize to each other automatically — `Period.ofMonths(15)` stays
  "15 months" until you call `normalized()` (which makes it 1 year
  3 months, and touches only years/months, never days — a month has no
  fixed day length to normalize with).
- `Period.between` works on `LocalDate`s — it is a date-to-date calendar
  difference, the thing you mean by "how old is this person".
- Adding a `Period` is calendar arithmetic with **end-of-month clamping**:
  `LocalDate.of(2026, 1, 31).plusMonths(1)` is February 28th — the day
  field clamps to the target month's length. Consequence: month arithmetic
  is not reversible (`plusMonths(1).minusMonths(1)` can land on a
  different day) and not associative.

## The DST fork: `plusDays(1)` vs `plus(Duration.ofDays(1))`

On `ZonedDateTime` the two are *different operations*:

```java
ZoneId berlin = ZoneId.of("Europe/Berlin");
ZonedDateTime beforeFallBack =
    ZonedDateTime.of(2026, 10, 24, 9, 0, 0, 0, berlin);   // day before EU clocks go back

beforeFallBack.plusDays(1);                  // Oct 25, 09:00 — same wall time, 25 real hours later
beforeFallBack.plus(Duration.ofDays(1));     // Oct 25, 08:00 — exactly 24h later, wall time shifted
```

- `plusDays` (and any `Period` addition) works on the **local date-time**,
  then re-resolves the zone: "same time tomorrow" as a human means it.
- `plus(Duration)` works on the **instant**: exactly that many seconds
  later, whatever the wall then says.
- Both are correct. The bug is not knowing which question you asked. A
  daily 09:00 report scheduled by adding `Duration.ofDays(1)` drifts an
  hour after every transition; a rate-limiter window computed with
  `plusDays` is 23 or 25 hours long twice a year.

The same fork exists between `Duration.between` and `Period.between` /
`ChronoUnit.DAYS.between`: the first counts seconds, the second counts
calendar boundaries.

## Gaps and overlaps — when a local time doesn't exist, or exists twice

The EU springs forward on the last Sunday of March (2026-03-29 in Berlin:
02:00 jumps to 03:00) and falls back on the last Sunday of October
(2026-10-25: 03:00 returns to 02:00). So in Berlin, **02:30 on March 29th
2026 never happens**, and **02:30 on October 25th 2026 happens twice**.
`ZonedDateTime` refuses to throw for either; the class documents a
deterministic resolution:

- **Gap** (spring forward): the local time is shifted **forward by the
  length of the gap** — asking for 02:30 in the gap yields 03:30 with the
  new offset.
- **Overlap** (fall back): the **earlier offset** (summer time) is chosen
  by default. `withEarlierOffsetAtOverlap()` / `withLaterOffsetAtOverlap()`
  pick explicitly; `ZonedDateTime.ofStrict` throws instead of resolving.
- Interrogate transitions directly via `zoneId.getRules()` —
  `ZoneRules.getTransition(localDateTime)` returns the
  `ZoneOffsetTransition` (or null), and `isValidOffset`/`getValidOffsets`
  enumerate the possibilities.

Silent resolution is the right default for calendaring, and a trap for
validation: a form accepting "02:30" on the gap day will quietly store
03:30 unless you check `getValidOffsets(ldt).isEmpty()` yourself.

## Storing future events — why an eager `Instant` is wrong

For *past* events the rule from chunk 3 holds: store the `Instant`. For
**future, human-scheduled** events it inverts:

- "Board meeting, 09:00 on 2027-03-10, Berlin office" is a *calendar*
  commitment. Its instant depends on the tzdb rules **in force on that
  day** — and governments change those rules with months of notice (the
  EU has debated abolishing the switch for years; countries adjust zones
  regularly).
- If you convert eagerly and store the `Instant`, a later tzdb change
  moves the meeting's wall time: everyone shows up at 09:00, the system
  fires at 10:00. This is the "meeting moved an hour" bug — self-inflicted
  at write time, unfixable at read time because the intent (09:00 wall
  time) was thrown away.
- **Store the intent**: `LocalDateTime` + `ZoneId` (two columns), convert
  to an instant *at read time* with the rules current then. Recompute any
  materialized instant when the tzdb updates (the JDK ships tzdb updates
  in every CPU release; Oracle's `tzupdater` patches between releases).
- Recurring events are the same decision repeated: store the rule
  ("every weekday 09:00 Europe/Berlin"), never the expanded instants.

## Measuring elapsed time — neither of these types is a stopwatch

`Instant.now()` reads the wall clock, and wall clocks jump: NTP
corrections, manual changes, leap-second smoothing. For elapsed-time
measurement inside one JVM, use `System.nanoTime()` — it is monotonic and
exists only for differences. `Duration.between(instantA, instantB)` is for
timestamps that already exist as data; `Duration.ofNanos(nanoEnd -
nanoStart)` is for measurement. (Benchmarks have further traps —
**Phase 12 · JVM in production** *(not written yet)* covers JMH.)

## Gotchas

**Symptom:** a nightly 02:30 cron-like job silently runs at 03:30 one day a year
**Cause:** 02:30 falls in the spring-forward gap; `ZonedDateTime` resolves gap times forward by the gap length instead of throwing
**Fix:** schedule daily jobs at times that exist every day (03:30+), or check `zone.getRules().getValidOffsets(ldt)` and decide explicitly

**Symptom:** an event stored for the fall-back overlap fires an hour early
**Cause:** the default overlap resolution picks the *earlier* offset (summer time); the intent may have been the second 02:30
**Fix:** `withLaterOffsetAtOverlap()` when the later reading is meant, or `ofStrict` to force the ambiguity into the open

**Symptom:** "24-hour" token expiry is 23 hours long once a year and users are logged out early
**Cause:** expiry computed with `zonedDateTime.plusDays(1)` — calendar arithmetic — where a fixed window was meant
**Fix:** compute expiries on `Instant` + `Duration`; wall-clock types are for display and scheduling, not TTLs

**Symptom:** a daily digest drifts to 08:00, then back to 09:00, over the year
**Cause:** next run computed as `lastRun.plus(Duration.ofDays(1))` on the instant — exact 24h steps ignore the DST shift
**Fix:** next run is a *calendar* question: `plusDays(1)` on the `ZonedDateTime`, letting the zone rules re-resolve the wall time

**Symptom:** `Period.between(a, b)` returns 0 years, 0 months, large negative days — or "P15M" never becomes "P1Y3M"
**Cause:** `Period` fields don't auto-normalize, and the result is negative when `a` is after `b`
**Fix:** `normalized()` for display; check argument order (or `isNegative()`) before formatting an "age"

**Symptom:** billing dates walk backwards through the month: Jan 31 → Feb 28 → Mar 28 → …
**Cause:** each cycle computed from the previous date; end-of-month clamping is lossy and the loss compounds
**Fix:** anchor arithmetic to the *original* date (`start.plusMonths(n)`), or model "last day of month" explicitly with `TemporalAdjusters.lastDayOfMonth()`

**Symptom:** `Duration.between` on two `LocalDateTime`s around a transition gives an answer that's wrong by an hour
**Cause:** `LocalDateTime` has no zone, so the calculation is pure wall arithmetic — the real elapsed time crossed a transition it can't see
**Fix:** elapsed time between real moments is an `Instant`/`ZonedDateTime` question; convert first, subtract after

**Symptom:** a request-timing metric occasionally reports negative or absurdly large durations
**Cause:** timing measured with `Instant.now()` pairs — the wall clock stepped (NTP, VM migration) between the two reads
**Fix:** `System.nanoTime()` for intra-process elapsed time; wall-clock instants only for cross-system timestamps

## Interview questions

**★ `Duration` vs `Period` — what's the real difference?**
Representation and meaning: `Duration` is seconds + nanos, exact machine
time; `Period` is `{years, months, days}` as separate calendar fields with
context-dependent length. `plus(Duration.ofDays(1))` moves 86,400 seconds;
`plus(Period.ofDays(1))` moves one calendar day — different results across
a DST transition.

**★ A meeting is stored as an `Instant` for next March and the government changes the DST rules in January. What happens, and what should have been stored?**
The wall time shifts: the instant is fixed, so under new rules it renders
an hour off from the scheduled 09:00. Future human events should store
intent — `LocalDateTime` + `ZoneId` — and resolve to an instant at read
time under the rules current then.

**★ What does `ZonedDateTime` do with a spring-forward gap time, and how would you detect it instead?**
It shifts the local time forward by the gap's length and uses the new
offset — silently. Detect via `zone.getRules()`:
`getValidOffsets(localDateTime)` returns an empty list for a gap (two
entries for an overlap), or `getTransition(localDateTime)` returns the
transition itself.

**★ Why is `LocalDate.plusMonths` not reversible, and what does that break?**
End-of-month clamping: Jan 31 + 1 month = Feb 28, and Feb 28 − 1 month =
Jan 28. Anything that derives each period from the previous result — 
billing cycles, subscription renewals — walks toward the 28th. Anchor to
the original date or model month-end as a rule.

**★ Why is timing code with two `Instant.now()` calls wrong, when `Duration.between` accepts them happily?**
`Instant.now()` is the wall clock, which is not monotonic — NTP slews and
steps it. Elapsed time inside a process needs `System.nanoTime()`, which
is monotonic and meaningless except as a difference. `Duration.between`
on instants is for data that already lives as timestamps.

**★ Why doesn't `Period.ofMonths(15)` become "1 year 3 months" on its own, and why does `normalized()` never touch the days field?**
`Period` is three independent ints with no defined exchange rate at
construction time — normalization is a *presentation* choice, so it's
opt-in. Years-to-months is exact (12:1), so `normalized()` converts it;
months-to-days has no fixed ratio (28–31), so days are left alone — any
other behavior would silently change the period's meaning.

**★ Your scheduler stores "every day at 09:00 Berlin" — walk through what happens on the two transition days.**
Spring forward: 09:00 exists; the day is 23 hours long, so the run comes
23 hours after the previous one — correct, because the *rule* is wall
time. Fall back: 09:00 exists once (only 02:00–03:00 repeats); the gap
between runs is 25 hours. Had the rule been implemented as "+24h from
last run", both days would drift the wall time by an hour instead.

---

← Prev: [The type system](01-the-type-system.md) · Index: [java.time](README.md) · Next → [`Instant` in the data, zones at the edge](03-instant-in-the-data.md)
