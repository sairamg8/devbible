---
title: "Instant in the data, zones at the edge"
sidebar_label: "3 · Instant in the data"
sidebar_position: 3
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-18 against the JDK 25 Javadoc for `Instant` (the Java
> Time-Scale section), `java.sql` package docs and the JDBC 4.2 mapping
> table (`java.sql.JDBCType`, `setObject`/`getObject` notes), the
> `Date`/`Calendar`/`GregorianCalendar`/`java.sql.Timestamp` conversion
> methods, and the PostgreSQL documentation on `timestamptz`
> (microsecond resolution, UTC normalization).

**The architecture rule that prevents the whole zone-bug class: a moment
that happened is stored and transported as a point on the timeline —
`Instant`, or its offset-preserving cousin `OffsetDateTime` in UTC — and
becomes a wall-clock reading only at the last edge, where a human with a
known zone looks at it. One conversion, at the boundary, with the zone
named explicitly. Everything between the edges computes on instants and
cannot be off by a zone, because there is no zone to be off by.**

## The rule, concretely

- **Write path:** event happens → `Instant.now()` → database column of
  timestamp-with-offset type → wire as ISO-8601 with `Z`.
- **Read path:** query in instants → business logic in instants →
  controller/UI converts once: `instant.atZone(user.zoneId())` → format.
- The *user's* zone is data about the user (their profile, their browser),
  never `ZoneId.systemDefault()` on a server — a server's default zone is
  a deployment accident (and best pinned to UTC anyway so accidents are
  visible).
- Group-by-day, "is it the same date", scheduling — anything with a
  calendar word in it — takes an explicit zone parameter. That is not
  boilerplate; it is the question's missing half being asked out loud.

## JDBC 4.2 — the mapping that finally works

Since JDBC 4.2 (Java 8), drivers accept `java.time` types directly via
`setObject`/`getObject` — the `java.sql.Date`/`Timestamp` shims are
legacy:

| Java type | SQL type |
|---|---|
| `LocalDate` | `DATE` |
| `LocalTime` | `TIME` |
| `LocalDateTime` | `TIMESTAMP` |
| `OffsetDateTime` | `TIMESTAMP WITH TIME ZONE` |
| `OffsetTime` | `TIME WITH TIME ZONE` |

```java
ps.setObject(1, OffsetDateTime.ofInstant(instant, ZoneOffset.UTC));
OffsetDateTime odt = rs.getObject("created_at", OffsetDateTime.class);
Instant back = odt.toInstant();
```

- **`Instant` is not in the JDBC spec's table** — the portable move is
  through `OffsetDateTime` at UTC as above (some drivers accept `Instant`
  directly as an extension; don't rely on it).
- `ZonedDateTime` isn't in the table either, deliberately: region rules
  have no SQL representation. Databases store offsets at best.
- PostgreSQL's `timestamptz` does **not store a zone**: it normalizes to
  UTC on write and renders in the connection's zone on read. It is "a
  timestamp that *understands* zones", not one that remembers yours —
  which is exactly what an `Instant` column should be. Plain `timestamp`
  is the `LocalDateTime` trap in SQL form: a wall reading with an
  out-of-band convention.
- JPA/Hibernate ride the same mapping — entity fields of type `Instant`
  or `OffsetDateTime` map to `timestamptz` cleanly (**Phase 10 · Data
  access** *(not written yet)*).

## Precision — nanoseconds meet microseconds

`Instant` carries nanoseconds. Databases mostly don't:

- PostgreSQL `timestamptz`: **microseconds** (6 digits).
- MySQL `DATETIME`/`TIMESTAMP`: **seconds** unless declared with a
  fractional precision — `DATETIME(6)` for micros.
- SQL Server `datetime2`: 100ns steps.

So a round-trip truncates, and `savedEntity.getCreatedAt()` no longer
`equals` the in-memory value it was saved from — the classic
"test passes locally, fails against the real database" identity bug.
Truncate *before* the value escapes:

```java
Instant stored = Instant.now().truncatedTo(ChronoUnit.MICROS);
```

Same story at serialization boundaries that default to millis (epoch-milli
JSON, message brokers): decide the precision at the edge once, or
equality-compare with a tolerance.

## ISO-8601 at API boundaries

- `Instant.toString()` → `2026-08-18T14:05:30.123456Z` — parseable by
  `Instant.parse`, sortable as a string, unambiguous. This is the wire
  format; use it.
- Epoch millis are defensible for high-volume internal APIs (compact,
  no parsing) but are unreadable in logs and silently drop sub-milli
  precision; pick one convention per API, never both.
- Jackson serializes `java.time` correctly only with the JavaTime module
  registered and `WRITE_DATES_AS_TIMESTAMPS` disabled — the mapper-policy
  chunk of [JSON with Jackson](../05-json-jackson/README.md) owns that
  story.
- Accept offsets on *input* generously (`OffsetDateTime.parse`), normalize
  to UTC immediately; emit `Z` on output. Clients keep their local
  readings; your system keeps one timeline.

## The legacy boundary — converting, not computing

Every pre-2014 API hands you `Date`, `Calendar` or `java.sql.Timestamp`.
Convert at the seam, in one call, and do all arithmetic on the new types:

| From legacy | To `java.time` | Back |
|---|---|---|
| `java.util.Date` | `date.toInstant()` | `Date.from(instant)` |
| `Calendar` | `calendar.toInstant()` | `GregorianCalendar.from(zonedDateTime)` |
| `GregorianCalendar` | `gcal.toZonedDateTime()` (keeps the zone) | same as above |
| `java.sql.Timestamp` | `ts.toInstant()` (keeps nanos) | `Timestamp.from(instant)` |
| `java.sql.Date` | `sqlDate.toLocalDate()` | `java.sql.Date.valueOf(localDate)` |

- `java.sql.Date.toInstant()` **throws** (`UnsupportedOperationException`
  — it's a date, not a moment); the pair is `toLocalDate`. Same asymmetry
  for `java.sql.Time`/`toLocalTime`.
- `Date.from(instant)` truncates nanos to millis — another precision seam.
- `Calendar.toInstant()` drops the zone; if the calendar's zone matters
  (it usually encodes user intent), go through `GregorianCalendar
  .toZonedDateTime()` instead.

## The Java Time-Scale — why you can ignore leap seconds

The `java.time` package summary defines its own time-scale: every day is
exactly 86,400 SI-ish seconds, and UTC leap seconds are absorbed by
**UTC-SLS smoothing** — the last 1,000 seconds of a leap day run
imperceptibly long or short. Consequences:

- `Instant` arithmetic never sees a 61-second minute; `Duration.between`
  across a leap second differs from true UTC by under a second, once every
  few years.
- You cannot *represent* `23:59:60`, and `Instant.parse` rejects it.
- For business systems this is pure win — determinism over astronomical
  fidelity. Systems that genuinely care (GPS, astronomy) don't use
  `java.time` for that part.

## Gotchas

**Symptom:** every timestamp shifts by hours after a container migration or base-image change
**Cause:** a `timestamp`-without-zone column (or `LocalDateTime` field) interpreted through the JVM/DB default zone, which just changed under you
**Fix:** `timestamptz` + `OffsetDateTime`/`Instant` end to end; pin server and DB session to UTC so any remaining leak is loud

**Symptom:** an entity saved then reloaded fails `equals` on its `createdAt`
**Cause:** Java nanos truncated to database micros (or millis) on write
**Fix:** `truncatedTo(ChronoUnit.MICROS)` at creation time — pick the storage precision as *the* precision

**Symptom:** `rs.getObject(col, ZonedDateTime.class)` throws or returns driver-dependent results
**Cause:** `ZonedDateTime` isn't a JDBC 4.2 mapping — no SQL type carries region rules
**Fix:** read `OffsetDateTime`, convert with `.toInstant().atZone(zone)` if a region view is needed

**Symptom:** "same day" grouping in reports disagrees with what users see
**Cause:** `instant.atZone(ZoneId.systemDefault()).toLocalDate()` on a UTC server — the day boundary is the server's, not the user's
**Fix:** day-bucketing takes the *consumer's* zone as an explicit parameter; there is no zone-free "what day"

**Symptom:** `java.sql.Date.toInstant()` throws `UnsupportedOperationException` in a generic converter
**Cause:** `java.sql.Date` narrows `java.util.Date` to a pure date and disables instant conversion
**Fix:** branch on the concrete type: `toLocalDate()` for `java.sql.Date`, `toInstant()` for everything else `Date`-shaped

**Symptom:** two services disagree about an event's time by exactly the sub-millisecond digits
**Cause:** one leg of the pipeline (epoch-milli JSON, `Date.from`) silently truncated to millis
**Fix:** one precision convention per system, applied at write time — not rediscovered per boundary

**Symptom:** parsing an upstream feed fails once in a blue moon on a `:60` seconds field
**Cause:** the feed emits real UTC leap seconds; the Java Time-Scale cannot represent them and `Instant.parse` rejects `23:59:60`
**Fix:** pre-normalize at the boundary (clamp `:60` to `:59.999...`), and record that the smoothing is deliberate

## Interview questions

**★ State the architecture rule for timestamps in a service, and what it buys.**
`Instant` (UTC) in storage, transport and logic; convert to a zoned
wall-clock reading once, at the display edge, with the consumer's explicit
zone. It removes the zone from every intermediate computation, so no
intermediate step *can* be off by one.

**★ PostgreSQL `timestamptz` "stores the time zone" — true?**
False. It normalizes to UTC (microsecond precision) and stores no zone at
all; the name means "zone-aware on input/output". Which is precisely the
`Instant` contract — and why `timestamp` without tz is the dangerous one,
being a `LocalDateTime` with a convention nobody wrote down.

**★ How do you get an `Instant` into a database portably, given JDBC 4.2 doesn't list it?**
Via `OffsetDateTime.ofInstant(instant, ZoneOffset.UTC)` and
`setObject`; read back with `getObject(col, OffsetDateTime.class)
.toInstant()`. The spec's mapping table covers `OffsetDateTime` ↔
`TIMESTAMP WITH TIME ZONE`; direct `Instant` support is a driver extension.

**★ Why does a saved-then-loaded timestamp fail an equality assertion, and where do you fix it?**
Precision: `Instant` is nanosecond, `timestamptz` microsecond, epoch-JSON
millisecond. Fix at value *creation* (`truncatedTo`), not in the
assertion — otherwise every comparison in the system inherits the
tolerance problem.

**★ You inherit a `Calendar` from an old API and the user's zone matters. What's the conversion?**
Not `toInstant()` — that discards the zone. `((GregorianCalendar) cal)
.toZonedDateTime()` keeps moment *and* zone; from there `toInstant()` for
storage and the `ZoneId` for the user's profile if it was meaningful.

**★ What is the Java Time-Scale's deal with leap seconds?**
`java.time` days are always 86,400 seconds; leap seconds are smoothed
(UTC-SLS) across the last 1,000 seconds of the affected day. `23:59:60`
is unrepresentable and unparseable. Business arithmetic stays simple and
deterministic at the cost of sub-second accuracy against true UTC around
a leap event.

---

← Prev: [Machine vs calendar time](02-machine-vs-calendar-time.md) · Index: [java.time](README.md) · Next → [Formatting, parsing and testing](04-formatting-parsing-testing.md)
