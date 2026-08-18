---
title: "The type system"
sidebar_label: "1 · The type system"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-18 against the JDK 25 Javadoc for `Instant`,
> `LocalDate`, `LocalTime`, `LocalDateTime`, `ZonedDateTime`,
> `OffsetDateTime`, `ZoneId`, `ZoneOffset` and the `java.time` package
> summary; `Date` and `Calendar` Javadoc for the legacy deprecation notes.

**`java.time` is a family of small immutable types where each type can
represent exactly one kind of temporal fact — a point on the timeline, a
date with no zone, a time with no date, a zoned moment. Picking the type
*is* the design decision: if a value compiles as `LocalDateTime`, you have
asserted "this has no time zone", and every bug in the class comes from
making that assertion by accident.**

## Why `Date` and `Calendar` are read-only legacy

`java.util.Date` is a millisecond timestamp wearing a date costume:
mutable (`setTime`), months are 0-indexed, years count from 1900,
`toString` renders in the JVM default zone so the same value prints
differently on different machines, and it has no concept of a time zone —
`Calendar` bolted that on, mutably, with `MONTH = 0` still meaning
January. Treat both as wire formats from old APIs: convert at the boundary
(chunk 3 *(not written yet)*), never compute with them.

## `Instant` — a point on the timeline

```java
Instant now = Instant.now();          // 2026-08-18T10:15:30.123456789Z
```

- An `Instant` is **epoch seconds + nanosecond adjustment** — no zone, no
  calendar, no opinion about walls or clocks. It is *when something
  happened*, universally.
- `toString()` is ISO-8601 with the `Z` suffix — already the right wire
  format for logs and APIs.
- Nanosecond precision — finer than most databases store, which is a real
  trap (chunk 3 *(not written yet)*).
- Arithmetic is exact machine time: `plusSeconds`, `plus(Duration)`. Asking
  an `Instant` for "the next day" is a category error until you give it a
  zone — `instant.plus(1, ChronoUnit.DAYS)` works (24h exactly) but
  *calendar* days need `ZonedDateTime` (chunk 2 *(not written yet)*).

## The `Local` family — "local" means *no zone at all*

`LocalDate`, `LocalTime` and `LocalDateTime` do **not** mean "the server's
local time". They mean **no zone information exists in the value**:

```java
LocalDateTime meeting = LocalDateTime.of(2026, Month.NOVEMBER, 3, 9, 0);
// "November 3rd, 09:00" — in WHOSE morning? The type refuses to say.
```

- A `LocalDateTime` is a **wall-clock reading**, not a moment. Two people
  in different zones holding the same `LocalDateTime` are talking about
  different points on the timeline.
- That makes it the *right* type for genuinely zone-free facts: a date of
  birth (`LocalDate`), a store's daily opening time (`LocalTime`), a
  recurring "every day at 09:00 *wherever the branch is*" rule.
- And the *wrong* type for anything that happened: an order placed, a log
  line, a payment — those are `Instant`s. A `LocalDateTime` column holding
  event timestamps is only interpretable through an out-of-band convention
  ("it's UTC, everyone knows"), and out-of-band conventions are where the
  off-by-one-zone bugs live.
- Conversion always demands a zone, and the API makes you say it:
  `localDateTime.atZone(ZoneId.of("Europe/Berlin")).toInstant()` /
  `instant.atZone(zone).toLocalDateTime()`.

## `ZonedDateTime` vs `OffsetDateTime` — rules vs a frozen offset

Both are "a moment plus how it reads on a wall", but they differ in what
they carry:

| | Carries | DST-aware arithmetic | Meant for |
|---|---|---|---|
| `ZonedDateTime` | `Instant` + `ZoneId` (**region** — `Europe/Berlin`) + the zone's *rules* | ✅ `plusDays` respects transitions | Human scheduling: calendars, recurring events, "9am in Berlin" |
| `OffsetDateTime` | `Instant` + `ZoneOffset` (**fixed** — `+02:00`) | ❌ offset never changes | Storage and interchange where you want the local reading preserved but no rule dependency |

- `ZoneId.of("Europe/Berlin")` embeds the IANA tzdb rules — the offset it
  implies **changes twice a year**, and the rules themselves change when
  the tzdb updates. `ZoneOffset.of("+02:00")` is just a number.
- The Javadoc's own guidance: `OffsetDateTime` is the interchange type
  (unambiguous, stable, sortable); `ZonedDateTime` is the calendaring type.
- A subtle consequence: two `ZonedDateTime`s at the same instant in
  different zones are `isEqual` but not `equals` — `equals` compares the
  zone too (chunk 4 *(not written yet)*).

`ZoneOffset` is itself a `ZoneId` subtype, so APIs taking `ZoneId` accept
both — `Instant.now().atZone(ZoneOffset.UTC)` is fine and common.

## The choosing table

| The fact you are recording | Type |
|---|---|
| Something happened (log, event, audit, `created_at`) | `Instant` |
| A calendar date with no time or zone (birthday, invoice date) | `LocalDate` |
| A time of day rule (opening hours) | `LocalTime` |
| A future appointment for humans in a place | `ZonedDateTime` — or `LocalDateTime` + `ZoneId` columns (chunk 2 *(not written yet)*) |
| A timestamp that must keep its local reading in transit | `OffsetDateTime` |
| Elapsed machine time between two instants | `Duration` (chunk 2 *(not written yet)*) |
| A calendar quantity ("3 months, 2 days") | `Period` (chunk 2 *(not written yet)*) |

Every type here is **immutable and thread-safe** — share them freely,
cache them in statics, hand them to any thread. `plusDays` returns a new
object; ignoring the return value is a no-op bug the compiler won't catch.

## Gotchas

**Symptom:** timestamps in the database are off by exactly the server's UTC offset
**Cause:** event times stored as `LocalDateTime` and interpreted through the JVM default zone somewhere in the pipeline
**Fix:** store `Instant` (chunk 3 *(not written yet)*); `LocalDateTime` never represents a moment

**Symptom:** `zonedDateTime.plusDays(1)` and `zonedDateTime.plus(Duration.ofDays(1))` disagree twice a year
**Cause:** they answer different questions — calendar day vs 86,400 seconds — and DST transitions expose the difference
**Fix:** that's correct behavior; pick the method for the question you're asking (chunk 2 *(not written yet)*)

**Symptom:** `date.plusDays(1)` appears to do nothing
**Cause:** every `java.time` type is immutable — the result is the return value, the receiver never changes
**Fix:** `date = date.plusDays(1);` — and treat an ignored return from any `java.time` method as a bug

**Symptom:** the same `Date` prints as different times on the laptop and the server
**Cause:** `Date.toString()` renders in the JVM default zone; the value is a zone-less millisecond count
**Fix:** convert to `Instant` at the boundary and print that (ISO-8601, `Z`), or format explicitly with a named zone

**Symptom:** code reviews argue about `ZonedDateTime` vs `OffsetDateTime` for a REST payload
**Cause:** the rules-vs-frozen-offset distinction isn't visible in the JSON — both serialize to an ISO string with an offset
**Fix:** `OffsetDateTime` (or `Instant`) at boundaries — parsing `2026-11-03T09:00+01:00[Europe/Berlin]` requires the bracketed zone extension only `ZonedDateTime` uses; plain offsets interchange cleanly

**Symptom:** `ZoneId.of("CET")` or `"EST"` behaves wrongly half the year
**Cause:** three-letter abbreviations are ambiguous legacy aliases — `EST` is *fixed* UTC-5, never observing daylight saving
**Fix:** IANA region ids only (`America/New_York`, `Europe/Paris`); reserve `ZoneOffset` for genuinely fixed offsets

**Symptom:** a new month is off by one when constructing dates from ints coming out of legacy code
**Cause:** `Calendar.MONTH` is 0-indexed; `java.time` months are 1-indexed (and `Month.NOVEMBER` exists precisely to end this)
**Fix:** use the `Month` enum at the seam, or convert the whole value with `calendar.toInstant()` instead of field-by-field

## Interview questions

**★ What does a `LocalDateTime` represent, and when is it the right column type?**
A wall-clock reading with no zone — not a moment on the timeline. Right
for zone-free facts (birth dates, opening hours, recurring local rules) and
for future events stored alongside an explicit `ZoneId`. Wrong for
anything that *happened*, because interpreting it as a moment requires an
out-of-band zone convention.

**★ `ZonedDateTime` vs `OffsetDateTime` — what's the actual difference?**
Both wrap an instant plus a local reading. `ZonedDateTime` carries a
region `ZoneId` and its tzdb *rules*, so calendar arithmetic crosses DST
correctly and the offset can change; `OffsetDateTime` freezes a numeric
offset — stable, unambiguous, no rules. Schedule with the first,
interchange and store with the second (or with `Instant`).

**★ Why is `Instant` alone insufficient to answer "what day did this happen"?**
A day is a calendar concept that depends on a zone — the same instant is
Tuesday in Tokyo and Monday in Los Angeles. `instant.atZone(zone).toLocalDate()`
makes the dependency explicit; any API that answers without taking a zone
is guessing.

**★ Why are three-letter zone ids like `EST` dangerous?**
They're legacy fixed-offset aliases: `EST` is UTC-5 year-round and never
becomes daylight time, so half the year it's an hour off from what a New
York user means. IANA region ids carry the full transition rules.

**★ The whole API is immutable. What do you gain, and what's the one new bug class?**
Gain: thread-safety for free (share formatters and values across threads —
the `SimpleDateFormat`-per-`ThreadLocal` hack dies), safe use as map keys,
values that can't be mutated by a callee. New bug: discarding the return
value of `plusX`/`withX` — a silent no-op the compiler accepts.

**★ You receive `int year, int month, int day` from a `Calendar`-era API. What do you watch for?**
The month index: `Calendar` months are 0-based, `java.time` months are
1-based. `LocalDate.of(year, month + 1, day)` — or better, avoid the
field-by-field seam entirely with `calendar.toInstant().atZone(...)`.

---

← Prev: [java.time](README.md) · Index: [java.time](README.md) · Next → **Machine vs calendar time** *(not written yet)*
