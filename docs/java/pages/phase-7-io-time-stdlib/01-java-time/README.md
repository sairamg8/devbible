---
title: "java.time"
sidebar_label: "01 · java.time"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-18 against the JDK 25 Javadoc for the `java.time`
> package (`Instant`, `LocalDate`, `LocalDateTime`, `ZonedDateTime`,
> `OffsetDateTime`, `Duration`, `Period`, `DateTimeFormatter`, `Clock`,
> `ZoneRules`), the `java.time` package summary's Java Time-Scale section,
> and the JDBC 4.2 mapping notes in the `java.sql` Javadoc.

**Every date-time bug in production is one of three confusions: a point on
the timeline confused with a wall-clock reading, machine time confused with
calendar time, or formatting confused with the value itself. `java.time`
(JSR-310, JDK 8) makes the three distinctions *types* — `Instant` vs
`LocalDateTime`, `Duration` vs `Period`, value vs `DateTimeFormatter` — so
the confusion becomes a compile error or an honest API choice instead of a
meeting that silently moves an hour after a DST transition.**

This topic runs deeper than one file. The chunks:

| # | Chunk | Covers |
|---|---|---|
| 1 | **[The type system](01-the-type-system.md)** | Why `Date`/`Calendar` are read-only legacy; `Instant`; what "local" really means; `ZonedDateTime` vs `OffsetDateTime`; the choosing table |
| 2 | **[Machine vs calendar time](02-machine-vs-calendar-time.md)** | `Duration` vs `Period`; `plusDays` vs `plus(Duration)` across DST; gap and overlap resolution; storing future events; the meeting-moved-an-hour bug prevented |
| 3 | **[`Instant` in the data, zones at the edge](03-instant-in-the-data.md)** | The architecture rule; JDBC 4.2 / `timestamptz` mapping; precision truncation; ISO-8601 at API boundaries; legacy conversions; the Java Time-Scale |
| 4 | **[Formatting, parsing and testing](04-formatting-parsing-testing.md)** | `DateTimeFormatter` (immutable, thread-safe); ISO constants vs `ofPattern`; the pattern-letter traps; `ResolverStyle`; `Clock` injection; comparison traps |

## Why this is a Master topic

- **Every service stores, transmits or displays timestamps** — this is
  daily code, and the wrong type compiles fine and fails in March.
- **The DST bug class is designed away only if you use the types as
  designed** — `LocalDateTime` in a database column is the bug, not a style
  choice.
- **Interviews lean on the distinctions** — `Instant` vs `LocalDateTime`,
  `Duration` vs `Period`, `ZonedDateTime` vs `OffsetDateTime` are precision
  questions with exactly one right answer each.
- **The legacy boundary is still everywhere** — `Date`, `Calendar`,
  `java.sql.Timestamp` survive in every codebase older than a decade, and
  converting at the boundary correctly is part of the skill.

## Where this connects

- **[Immutable design](../../phase-2-classes-objects/12-immutable-design/README.md)** —
  every `java.time` type is immutable and thread-safe; this is the JDK's
  flagship application of that recipe.
- **[`ThreadLocal`](../../phase-6-concurrency/12-threadlocal-scopedvalue/01-threadlocal.md)** —
  the classic `SimpleDateFormat`-per-thread hack exists *because* the old
  formatter was mutable; `DateTimeFormatter` deletes the reason.
- **[Topic 05 · JSON with Jackson](../05-json-jackson/README.md)** — serializing
  `java.time` types needs the JavaTime module registered.

---

← Prev: [Phase 7 — I/O, time and the everyday stdlib](../README.md) · Next → [The type system](01-the-type-system.md)
