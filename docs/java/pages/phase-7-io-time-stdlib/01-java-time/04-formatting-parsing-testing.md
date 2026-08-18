---
title: "Formatting, parsing and testing"
sidebar_label: "4 · Formatting, parsing, testing"
sidebar_position: 4
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-18 against the JDK 25 Javadoc for `DateTimeFormatter`
> (pattern-letter table, resolver-style notes: ISO constants resolve
> STRICT, `ofPattern` defaults to SMART), `ResolverStyle`, `Clock`,
> `InstantSource`, and the `ChronoZonedDateTime`/`OffsetDateTime`
> comparison-method docs.

**`DateTimeFormatter` is immutable and thread-safe — the single fact that
retires the `SimpleDateFormat`-in-a-`ThreadLocal` folklore. What it does
not retire is the pattern language's traps: five pattern letters that look
interchangeable and are not, a locale dependency that only fails in
production, and a resolver whose default is more forgiving than you think.
And because parsing and formatting sit next to `now()` in the same code,
this chunk ends with the discipline that makes any of it testable: inject
a `Clock`.**

## Formatters are constants

```java
public static final DateTimeFormatter AUDIT_TS =
    DateTimeFormatter.ofPattern("uuuu-MM-dd HH:mm:ss", Locale.ROOT)
                     .withZone(ZoneOffset.UTC);
```

- Immutable, thread-safe — build once, `static final`, share everywhere.
  Every `with*` call returns a new formatter.
- This is the exact mutable-formatter problem
  [`ThreadLocal`](../../phase-6-concurrency/12-threadlocal-scopedvalue/01-threadlocal.md)
  was historically abused to contain; `java.time` deletes the reason, and
  new code carrying a `ThreadLocal<SimpleDateFormat>` is cargo cult.
- Prefer the ISO constants (`ISO_INSTANT`, `ISO_LOCAL_DATE`,
  `ISO_OFFSET_DATE_TIME`…) wherever the format is machine-facing —
  they're pre-built, unambiguous, and resolve STRICT.

## Two defaults that differ: resolver style and locale

- **Resolver style.** The ISO constants resolve **STRICT**;
  `ofPattern` builds **SMART** formatters. SMART quietly "fixes" input —
  it resolves day-of-month overflows sensibly and accepts 24:00 as
  end-of-day; LENIENT goes further and rolls anything over (month 13 →
  January next year). Validation code wants
  `.withResolverStyle(ResolverStyle.STRICT)` — and with STRICT comes the
  `u`-vs-`y` requirement below.
- **Locale.** `ofPattern(pattern)` captures the *JVM default locale*.
  `MMM`, `EEE`, localized digits — all of it shifts when ops changes a
  container's `LANG`. Machine formats: `Locale.ROOT`, always. Human
  formats: the *user's* locale, passed in — and prefer
  `ofLocalizedDateTime(FormatStyle.MEDIUM)` over hand-built patterns, so
  the whole layout localizes, not just the month names.

## The pattern letters that bite

| Wrote | Meant | What actually happens |
|---|---|---|
| `YYYY` | `uuuu` | `Y` is **week-based year** — agrees with the calendar year ~51 weeks, then Dec 29 2025 formats as 2026. The end-of-December bug with a one-week window |
| `yyyy` | `uuuu` | `y` is year-of-era — fine until STRICT parsing demands an era field (`G`), then refuses dates that look perfectly valid; `u` is the signed proleptic year and just works |
| `hh` | `HH` | `h` is clock-hour 1–12 — every afternoon timestamp formats as morning unless `a` (AM/PM) is present |
| `DD` | `dd` | `D` is day-of-**year**: the 42nd of January |
| `mm`/`MM` | each other | minute vs month — both parse, both format, silently transposed |

One more that isn't a letter mix-up: formatting an `Instant` with a
pattern containing calendar fields (`uuuu`, `HH`…) throws
`UnsupportedTemporalTypeException` — an `Instant` has no year until a zone
says so. `.withZone(zone)` on the formatter supplies it.

## Parsing

```java
LocalDate d      = LocalDate.parse("2026-08-18");                  // ISO by default
OffsetDateTime o = OffsetDateTime.parse("2026-08-18T14:05:30+02:00");
TemporalAccessor best = FLEXIBLE.parseBest(text,
        ZonedDateTime::from, LocalDateTime::from);                  // richest match wins
```

- Every type's `parse(CharSequence)` assumes its ISO form; pass a
  formatter for anything else. Failure is `DateTimeParseException` —
  unchecked, carries the offending index; catch it at input boundaries,
  never deeper ([exception hierarchy](../../phase-5-exceptions/01-hierarchy-checked-unchecked/README.md)).
- Parse into the type that matches what the *string carries*. Parsing a
  zone-less string as `OffsetDateTime` fails; parsing an offset string
  into `LocalDateTime` silently discards the offset — the worse outcome,
  because it's a data-loss bug that parses green.
- `parseBest` handles feeds where the offset is sometimes present; you get
  back the richest type the text supports and `instanceof` from there.

## `Clock` — the testability seam

Every `now()` overload takes an optional `Clock`, and that is the entire
testing story:

```java
public final class InvoiceService {
    private final Clock clock;                    // injected; Clock.systemUTC() in prod
    InvoiceService(Clock clock) { this.clock = clock; }

    boolean isOverdue(Invoice inv) {
        return inv.dueDate().isBefore(LocalDate.now(clock));
    }
}

// test:
Clock fixed = Clock.fixed(Instant.parse("2026-03-29T01:30:00Z"), ZoneId.of("Europe/Berlin"));
```

- `Clock.fixed` freezes time; `Clock.offset(base, duration)` shifts it —
  "what does this code do the day after tomorrow" as a unit test, no
  sleeping, no mocking frameworks bending static calls.
- Bare `Instant.now()` sprinkled through domain logic is an untestable
  hidden dependency — same disease as `new Date()` was. The seam costs one
  constructor parameter.
- Since 17, `InstantSource` is the narrower interface — inject it when
  only "current instant" is needed and no zone; `Clock` implements it.
- Pick the DST edges deliberately in tests: the fixed clock above sits
  30 minutes before Berlin's spring-forward gap — exactly where chunk 2's
  bugs live.

## Comparing — four methods, three meanings

- `isBefore`/`isAfter` — timeline comparison. On `ZonedDateTime`/
  `OffsetDateTime` these compare the **instant**, regardless of zone.
- `equals` — full state. Two `ZonedDateTime`s at the same instant in
  different zones are **not** equal; same for `OffsetDateTime` with
  different offsets. Fine for caching keys, wrong for "same moment?".
- `isEqual` — instant equality across different zones/offsets; the one
  you almost always meant in business logic.
- `compareTo` on `OffsetDateTime`/`ZonedDateTime` is *consistent with
  equals*, so it orders by instant **then** by local reading/zone — for a
  pure timeline sort use
  `OffsetDateTime.timeLineOrder()` / `ChronoZonedDateTime.timeLineOrder()`
  or sort the `toInstant()` values.
- `LocalDate.equals(LocalDateTime)` and friends are always false —
  cross-type comparison isn't defined; convert first.

## Gotchas

**Symptom:** timestamps for Dec 29–31 carry next year's number
**Cause:** `YYYY` (week-based year) in a pattern where `uuuu` was meant; ISO week 1 of 2026 starts Dec 29 2025
**Fix:** `uuuu` in every machine format; treat any `Y` in a code review as a bug until proven intentional

**Symptom:** switching a formatter to STRICT makes it reject valid dates it accepted yesterday
**Cause:** the pattern uses `y` (year-of-era), and STRICT requires an era field to disambiguate; SMART was filling it in
**Fix:** `u` instead of `y` — proleptic year, no era needed at any strictness

**Symptom:** all afternoon events display as morning
**Cause:** `hh` (1–12 clock-hour) without `a`; 14:05 formats as 02:05
**Fix:** `HH` for 24-hour formats; if `hh`, the pattern must carry `a`

**Symptom:** `formatter.format(instant)` throws `UnsupportedTemporalTypeException` in production but the same pattern works in a test
**Cause:** the pattern needs calendar fields an `Instant` doesn't have; the test happened to format a `ZonedDateTime`
**Fix:** `.withZone(...)` baked into the formatter constant, so the conversion is part of the format definition

**Symptom:** month names come out in German after a base-image update
**Cause:** `ofPattern` without a locale captured the JVM default, which followed the container's `LANG`
**Fix:** `Locale.ROOT` for machine formats, explicit user locale for display; never let the default in

**Symptom:** an API accepts `"2026-08-18T14:05:30+02:00"` but stores 14:05 UTC — silently two hours off
**Cause:** parsed as `LocalDateTime`, which drops the offset the client sent
**Fix:** parse the type the string carries (`OffsetDateTime.parse`), then normalize with `.toInstant()` — explicit, lossless

**Symptom:** a "same moment" check fails between a UTC-normalized value and the user's zoned copy
**Cause:** `equals` on `ZonedDateTime`/`OffsetDateTime` compares zone and local state, not just the instant
**Fix:** `isEqual` (or compare `toInstant()`); reserve `equals` for identity/caching semantics

**Symptom:** time-dependent tests pass at 2pm and fail in the nightly CI run
**Cause:** logic reads `Instant.now()`/`LocalDate.now()` directly — the test's day boundary, month end or DST edge moved
**Fix:** inject `Clock`; test with `Clock.fixed` pinned to the edges (month end, Feb 29, both DST transitions)

**Symptom:** a sorted timeline of `OffsetDateTime`s puts simultaneous events in surprising order
**Cause:** natural ordering is consistent-with-equals — instant first, then local time — not a pure timeline order
**Fix:** `sort(OffsetDateTime.timeLineOrder())`, or map to `Instant` for the sort key

## Interview questions

**★ Why is `DateTimeFormatter` safe as a `static final` when `SimpleDateFormat` famously wasn't?**
`SimpleDateFormat` kept mutable intermediate state in the instance, so
concurrent `parse`/`format` corrupted results — hence per-thread copies.
`DateTimeFormatter` is immutable; all state is per-call. The `ThreadLocal`
workaround survives only as legacy.

**★ `uuuu` vs `yyyy` vs `YYYY` — rank them for a log timestamp.**
`uuuu`: proleptic signed year, correct at every resolver style — use it.
`yyyy`: year-of-era, same digits for CE dates but needs an era under
STRICT parsing. `YYYY`: week-based year, wrong for about a week every
year-end — the classic silent corruption.

**★ What do SMART, STRICT and LENIENT change, and when does each fit?**
They govern *resolution* after field parsing. STRICT demands
calendar-valid, unambiguous fields — external input validation. SMART
(the `ofPattern` default) applies sensible corrections like 24:00 →
next-day 00:00. LENIENT rolls overflow arbitrarily (month 13) — only for
tolerant ingestion of known-sloppy legacy feeds, immediately re-validated.

**★ How do you unit-test "this invoice becomes overdue at month end" without mocking statics?**
Inject `Clock` and call `LocalDate.now(clock)` in the logic. Test with
`Clock.fixed` at the last instant of the month and the first of the next;
`Clock.offset` walks time forward. The JDK put a `Clock` parameter on
every `now()` precisely so time is an injectable dependency.

**★ Two `ZonedDateTime`s: `2026-08-18T14:00+02:00[Europe/Berlin]` and `2026-08-18T13:00+01:00[Europe/London]`. What do `equals`, `isEqual`, `isBefore` say?**
`equals` — false: different zones and local readings. `isEqual` — true:
same instant. `isBefore` — false either way round, since neither precedes
the other on the timeline. Business "same time?" logic wants `isEqual`.

**★ `Clock` vs `InstantSource` — which do you inject, and why does the narrower one exist?**
`InstantSource` (17+) supplies only `instant()` — no zone. Inject it when
the code needs "now" and nothing calendar-shaped; injecting `Clock` there
smuggles in a zone dependency the code shouldn't have. `Clock` implements
`InstantSource`, so production wiring passes `Clock.systemUTC()` either
way; the interface choice documents what the class actually uses.

**★ Why did the JDK make `ofPattern` default to SMART rather than STRICT?**
Compatibility with what people paste: real-world patterns written with `y`
and real-world input with 24:00 or slightly-off fields would fail under
STRICT, so the forgiving default minimizes surprise for formatting-heavy
code. The cost lands on *validation* code, which must remember to opt in
to STRICT — the default is tuned for output, not input.

**★ A feed sometimes includes an offset, sometimes not. How do you parse it without two code paths?**
One formatter with optional sections (`[XXX]`) and `parseBest(text,
OffsetDateTime::from, LocalDateTime::from)` — the richest type the text
supports comes back; branch once on the result, attach the documented
default zone to the `LocalDateTime` case explicitly.

---

← Prev: [`Instant` in the data, zones at the edge](03-instant-in-the-data.md) · Index: [java.time](README.md) · Next → [Phase 7 — I/O, time and the everyday stdlib](../README.md)
