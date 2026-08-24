---
title: "`timestamp` and `timestamptz` are different types, and only one of them is an instant"
sidebar_label: "14 · Dates, times and `timestamptz`"
sidebar_position: 16
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-20 against the PostgreSQL 18 manual *Data Types → Date/Time
> Types* (postgresql.org/docs/18/datatype-datetime.html), the JDK 25 API for
> `java.sql.ResultSet.getObject(int, Class)`,
> `java.sql.PreparedStatement.setObject` and `java.time`
> (docs.oracle.com/en/java/javase/25/docs/api/), and the pgJDBC documentation
> index (jdbc.postgresql.org/documentation/). JDK 25, JDBC 4.3, PostgreSQL 18,
> pgjdbc 42.7.13.

**The single most consequential schema decision in this whole phase is which of
two PostgreSQL types you store a point in time in, and the names are actively
misleading. `timestamp with time zone` — `timestamptz` — does **not** store a time
zone. It stores an absolute instant, normalised to UTC, and renders it in whatever
zone the session asks for. `timestamp without time zone` stores wall-clock digits
with no instant attached, so the same value means a different moment depending on
where you stand. Choose the second by accident for a `created_at` column — which is
what happens when someone maps a Java `LocalDateTime` and lets the schema follow —
and you have built a system that cannot order events across regions, breaks twice a
year at daylight-saving boundaries, and produces bug reports that are impossible to
reproduce because they depend on the reporter's timezone.**

## What PostgreSQL actually does

The manual is unambiguous. For `timestamptz`:

> All timezone-aware dates and times are stored internally in UTC.

> For `timestamp with time zone` values, an input string that includes an explicit
> time zone will be converted to UTC using the appropriate offset for that time
> zone. If no time zone is stated in the input string, then it is assumed to be in
> the time zone indicated by the system's `TimeZone` parameter, and is converted to
> UTC using the offset for the `timezone` zone.

> When a `timestamp with time zone` value is output, it is always converted from
> UTC to the current `timezone` zone, and displayed as local time in that zone.

And for `timestamp`:

> In a value that has been determined to be `timestamp without time zone`,
> PostgreSQL will silently ignore any time zone indication. That is, the resulting
> value is derived from the date/time fields in the input string, and is not
> adjusted for time zone.

🔴 **Read the third quote carefully, because it is the source of most confusion:**
`timestamptz` output is *rendered* in the session's zone. Two clients reading the
same row see different strings and the same instant. Nothing is stored per row about
zones; the rendering is a session property. So "the timestamps in my database are in
the wrong timezone" is almost always a statement about a display setting, not about
the data.

⚠️ **The manual also discourages `time with time zone` outright:** it does *not*
recommend the type, since a zone has little meaning without a date — UTC offsets
move at daylight-saving boundaries. Do not use it.

## The mapping

| PostgreSQL | Java (JDBC 4.2 typed accessor) | Means |
|---|---|---|
| `timestamptz` | **`OffsetDateTime`** (or convert to `Instant`) | an absolute instant |
| `timestamp` | `LocalDateTime` | wall-clock digits, no instant |
| `date` | `LocalDate` | a calendar date |
| `time` | `LocalTime` | a clock time |
| `timetz` | `OffsetTime` | ⛔ avoid the type |
| `interval` | ⚠️ no direct `java.time` mapping; pgJDBC has `PGInterval` | a duration in months/days/seconds |

```java
// ✅ reading and writing an instant
OffsetDateTime placedAt = rs.getObject("placed_at", OffsetDateTime.class);
ps.setObject(4, OffsetDateTime.now(clock));

// ✅ if your domain wants an Instant
Instant placed = rs.getObject("placed_at", OffsetDateTime.class).toInstant();
```

⚠️ **On the pgjdbc side I could not find a published data-type mapping table in
the online documentation** — its documentation index has no date/time page — so I
am stating the mapping as the JDBC 4.2 mapping that pgJDBC implements, which is
what the typed `getObject(col, Class)` accessor is specified to do. If you need the
authoritative per-type list for a specific driver version, read the driver's own
javadoc or source rather than trusting a blog. What *is* documented and quoted
above is PostgreSQL's semantics, and that is the half the design decision turns on.

⛔ **`java.sql.Timestamp`, `java.sql.Date` and `java.sql.Time` are legacy.** They
are `java.util.Date` subclasses carrying its mutability and its implicit default
timezone. Every one of them is a source of the "it works on my machine, which is in
UTC" class of bug. Use `java.time` via `getObject`/`setObject`, always, in new code.

## `Instant` vs `OffsetDateTime`, and which to prefer

Both represent an instant. `Instant` is the purer model — a point on the timeline,
no offset, no calendar — and it is what a domain object should usually hold.
`OffsetDateTime` is what the JDBC mapping for `timestamptz` is defined in terms of.

The pragmatic shape:

```java
record Order(long id, Instant placedAt) { }

// mapper
new Order(rs.getLong("id"),
          rs.getObject("placed_at", OffsetDateTime.class).toInstant());
```

⚠️ **`ZonedDateTime` is the one to avoid at this boundary.** It carries a zone
*region* (`Europe/London`), and `timestamptz` does not store one — so a round trip
loses it and hands you back an offset, silently. If your domain genuinely needs the
zone the user was in, that is a **separate column** holding the zone id, alongside
a `timestamptz`. Two facts, two columns.

## When `timestamp without time zone` is the right choice

It is not always wrong — it is wrong as a default. It is right when the value is a
wall-clock fact rather than an instant:

- **A recurring appointment at 09:00 local**, which must stay at 09:00 after a
  daylight-saving change. Storing the instant would move it.
- **A date-and-time printed on a document** — an invoice timestamp that is part of
  the document's content.
- **A business day boundary** in a fixed local calendar.

In all three the correct storage is the local wall time *plus a zone id column*,
because a wall time alone cannot be converted to an instant later without knowing
where it applies.

🔴 **Everything else — `created_at`, `updated_at`, `placed_at`, `expires_at`,
audit and event times — is `timestamptz`.** If you are unsure, it is `timestamptz`.

## The session `TimeZone` parameter, and why it is not a solution

Because rendering depends on the session's `timezone` setting, it is tempting to
"fix" a display problem by setting it. Two cautions:

- **In a pool, a `SET TIME ZONE` leaks to the next borrower** — the general problem
  of [chunk 4](04-connection-is-expensive.md). Use `SET LOCAL` inside a transaction
  if you must set it at all.
- **It does not change what is stored** and it does not make a `timestamp` column
  into an instant. If the data is wrong, the session setting cannot fix it.

⚠️ **The JVM's default timezone matters too**, and it is the thing that differs
between a developer laptop and a container. Anything that formats a time for a user
should take an explicit `ZoneId`; anything that produces a time should take a
`Clock`. `Instant.now()` is fine — it has no zone — but `LocalDateTime.now()` reads
the JVM default and is almost always a bug in server code.

## Testing time without a sandbox

Inject a `java.time.Clock` and use `Clock.fixed(...)` in tests. That is the whole
technique, and it is the difference between a test suite that fails in the hour
around a daylight-saving change and one that does not.

```java
class OrderRepository {
    private final Clock clock;
    void place(Connection c, Order o) throws SQLException {
        ps.setObject(4, OffsetDateTime.now(clock));   // ✅ controllable
    }
}
```

## The trade-off

`timestamptz` everywhere costs you the ability to express a wall-clock fact, and
teams that adopt it as an absolute rule end up storing a recurring 09:00 appointment
as an instant and watching it drift by an hour twice a year. The rule is not
"`timestamptz` always"; it is "`timestamptz` unless you can articulate why this
value is a wall clock rather than a moment" — and then, when you can, store the
zone id next to it so the conversion remains possible.

## Gotchas

**⚠️ `timestamp without time zone` for `created_at`**
**Symptom:** events from two regions that cannot be ordered; a one-hour gap or
overlap in the audit log twice a year.
**Cause:** the column stores wall-clock digits with no instant.
**Fix:** `timestamptz`. Migrating requires knowing which zone the existing values
were recorded in — which is exactly the information the type failed to store, and
why this is expensive to fix later.

**⚠️ "The database is showing the wrong timezone"**
**Symptom:** a reported bug that different clients see different times.
**Cause:** `timestamptz` renders in the session's `timezone`; the stored instant is
identical.
**Fix:** nothing in the data. Set the display zone at the presentation layer.

**⚠️ `java.sql.Timestamp` in new code**
**Symptom:** off-by-one-hour bugs that appear only outside UTC, and mutable date
objects shared between threads.
**Cause:** the legacy types are `java.util.Date` subclasses with an implicit
default zone.
**Fix:** `getObject(col, OffsetDateTime.class)` and `setObject`.

**⚠️ Binding a `ZonedDateTime` to a `timestamptz`**
**Symptom:** the zone region is gone after a round trip and only an offset remains.
**Cause:** `timestamptz` stores an instant; there is nowhere to put a region.
**Fix:** store the zone id in its own column if you need it.

**⚠️ `LocalDateTime.now()` in server code**
**Symptom:** behaviour that differs between a laptop and a container because the
JVM default zone differs.
**Cause:** the call reads the JVM default timezone.
**Fix:** `OffsetDateTime.now(clock)` or `Instant.now(clock)`, with an injected
`Clock`.

**⚠️ Setting the session timezone to fix rendering, on a pooled connection**
**Symptom:** unrelated requests rendering times in an unexpected zone.
**Cause:** session state survives the return to the pool.
**Fix:** `SET LOCAL` inside a transaction, or — better — format at the presentation
layer and leave the session alone.

**⚠️ Storing a recurring local appointment as an instant**
**Symptom:** a 09:00 meeting that becomes 08:00 after a clock change.
**Cause:** an instant is a fixed moment; the requirement was a wall time.
**Fix:** `timestamp` plus a zone-id column, and convert at read time.

## Interview questions

**★ What is the difference between `timestamp` and `timestamptz` in PostgreSQL?**
`timestamptz` stores an absolute instant: the manual says all timezone-aware values
are stored internally in UTC, input with an explicit offset is converted to UTC, and
output is always converted from UTC to the session's current `timezone` and
displayed as local time there. `timestamp without time zone` stores wall-clock
fields and, in the manual's words, silently ignores any time zone indication in the
input. So `timestamptz` is a moment and `timestamp` is a set of digits. The name is
the problem — `timestamptz` does not store a time zone, it stores an instant, and
the "with time zone" refers to the input and output conversions rather than to
anything kept per row.

**★ Two clients read the same `timestamptz` row and see different times. Is the
data wrong?**
No — that is the type working correctly. The stored value is a single UTC instant,
and output is rendered in whatever the reading session's `timezone` parameter says,
so a client in Tokyo and a client in London see different strings for the same
moment. It is a display property, not a data property. The mistake this leads to is
"fixing" it with `SET TIME ZONE` on the connection, which in a pooled application
leaks to the next borrower and still does not change anything stored. Formatting
belongs at the presentation layer with an explicit `ZoneId`.

**★ Which `java.time` type do you map `timestamptz` to, and why not
`ZonedDateTime`?**
`OffsetDateTime` via `getObject(col, OffsetDateTime.class)`, usually converted
straight to an `Instant` for the domain object, because an instant is what the
column actually holds. `ZonedDateTime` is wrong at this boundary because it carries
a zone *region* like `Europe/London`, and `timestamptz` has nowhere to store one —
so a write-then-read round trip silently degrades the region to a bare offset, and
the difference matters exactly at daylight-saving boundaries where an offset is
ambiguous and a region is not. If the domain genuinely needs to know which zone the
user was in, that is a second column holding the zone id.

**★ When is `timestamp without time zone` the right choice?**
When the value is a wall-clock fact rather than a moment: a recurring appointment
at 09:00 local that must stay at 09:00 after a clock change, a time printed as part
of a document's content, a business-day boundary in a fixed local calendar. Storing
those as instants makes them drift by an hour twice a year, which is a real bug and
the reason "`timestamptz` always" is too blunt a rule. The important addition is
that a wall time on its own cannot be converted to an instant later, so it needs a
zone-id column beside it — two facts, two columns. Everything else — `created_at`,
`expires_at`, audit and event times — is `timestamptz`.

**★ Why avoid `java.sql.Timestamp`?**
Because it is a `java.util.Date` subclass and inherits its two defects: it is
mutable, so a shared instance can be changed under you, and it has no zone of its
own, so conversions quietly use the JVM's default timezone. That last property is
precisely the one that makes a bug reproduce on a container running in UTC and not
on a developer's laptop, or the reverse. JDBC 4.2 added `getObject(col, Class)` and
`setObject` with `java.time` types, which are immutable and explicit about whether
they carry an offset, and there is no reason to use the legacy types in new code.

**★ How do you write tests for time-dependent persistence code without a
database?**
Inject a `java.time.Clock` rather than calling `now()` statically, and use
`Clock.fixed` in tests. That makes the timestamp a value the test controls, which
turns "does this row get the right `placed_at`" into an ordinary assertion instead
of a tolerance window. It also removes the class of test that fails in the hour
around a daylight-saving change or when CI runs in a different zone from the
developer's machine. The rule that follows is that `LocalDateTime.now()` and
`Instant.now()` with no argument have no place in code you intend to test.

---

← Prev: [13 · Nulls, primitives and `wasNull`](13-nulls-and-wasnull.md) · Index: [JDBC](README.md) · Next → [15 · Fetch size and streaming](15-fetch-size-and-streaming.md)
