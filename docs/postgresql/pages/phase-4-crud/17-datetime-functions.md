---
title: "Date and time functions"
sidebar_label: "17 · Date/time functions"
sidebar_position: 17
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 on **PostgreSQL 18.4** (`postgres:18-alpine`, `127.0.0.1:55432`),
> **Node 24.19.0**, `pg` 8.23.0, client machine in **IST (UTC+5:30)**. Scripts:
> `sandbox/pg-api/ex14-crud.mjs`, `ex13-constraints-rel.mjs`.

**Two things cause almost every date bug: `now()` is transaction time, not statement
time, and a `date` column arrives in JavaScript as a `Date` at local midnight —
which can be the previous day.**

## `now()` is frozen for the transaction

```console
$ node ex13-constraints-rel.mjs
=== 3. when is a DEFAULT evaluated? ===
two inserts 150ms apart in ONE transaction:
  id 1 2026-08-12T03:36:00.220Z
  id 2 2026-08-12T03:36:00.220Z
same timestamp? true ← now() is transaction start time, not statement time
```

Identical timestamps 150 ms apart. `now()` is an alias for
`transaction_timestamp()`.

| Function | Returns | Use for |
|---|---|---|
| `now()` / `transaction_timestamp()` | Transaction start — constant within it | `created_at`, anything that should agree across a transaction |
| `statement_timestamp()` | Current statement's start | Per-statement timing |
| `clock_timestamp()` | Real wall clock, advances mid-statement | Measuring duration inside a transaction; per-row true times |

The consistency is usually the feature: every row written by one transaction shares
a timestamp, which makes a batch identifiable. It is wrong when you are timing
something, or ordering rows written within one transaction.

## The `date` → JavaScript `Date` trap

```console
$ node ex14-crud.mjs
=== 12. generate_series, VALUES, unnest ===
┌─────────┬──────────────────────────┐
│ (index) │ d                        │
├─────────┼──────────────────────────┤
│ 0       │ 2025-12-31T18:30:00.000Z │
│ 1       │ 2026-01-01T18:30:00.000Z │
```

That series started at `date '2026-01-01'`. The first row prints as
**2025-12-31T18:30:00Z** — the previous year.

Nothing is wrong in the database. `pg` maps a `date` to a JavaScript `Date` at
**local midnight**, and this machine is UTC+5:30, so local midnight on 2026-01-01 is
18:30 UTC on 2025-12-31. Call `.toISOString()` — as any JSON serialiser does — and
you get yesterday's date.

The same appears in arithmetic:

```console
│ plus_month               │
│ 2026-09-11T18:30:00.000Z │
```

`(date '2026-08-12' + interval '1 month')::date` is 2026-09-12. It prints as
September 11 for exactly the same reason.

**Calendar dates are not instants.** A birthday, an invoice date and a public
holiday have no timezone, and forcing them through a type that does corrupts them.
The fixes, in order of preference:

```js
// 1. return the date as text from SQL — unambiguous
const {rows} = await pool.query(`SELECT to_char(due_on, 'YYYY-MM-DD') AS due_on FROM invoices`);

// 2. or tell pg to leave DATE (OID 1082) as a string
import pg from 'pg';
pg.types.setTypeParser(1082, (v) => v);   // process-wide
```

Do **not** "fix" it by adding the offset back in the client — that is correct until
someone runs the process in another timezone.

`timestamptz` does not have this problem: it is a real instant, and the round trip is
lossless.

## The functions worth knowing

```console
=== 11. date/time functions ===
┌─────────┬──────────────────────────┬─────┬────────────────────┬──────────────────────────┐
│ (index) │ month                    │ dow │ formatted          │ plus_month               │
├─────────┼──────────────────────────┼─────┼────────────────────┼──────────────────────────┤
│ 0       │ 2026-08-01T00:00:00.000Z │ 3   │ '2026-08-12 13:45' │ 2026-09-11T18:30:00.000Z │
└─────────┴──────────────────────────┴─────┴────────────────────┴──────────────────────────┘
```

```sql
date_trunc('month', ts)                  -- 2026-08-01 00:00:00+00 — bucketing
extract(dow FROM date '2026-08-12')      -- 3 (Wednesday; 0 = Sunday)
to_char(ts, 'YYYY-MM-DD HH24:MI')        -- '2026-08-12 13:45'
age(a, b)                                -- a symbolic interval: '1 year 3 mons 11 days'
date '2026-08-12' + interval '1 month'   -- calendar-aware arithmetic
```

**`date_trunc` is the correct way to bucket for reports** — grouping by
`to_char(ts,'YYYY-MM')` works but produces text, sorts lexically (which happens to be
right for that format and wrong for most others), and cannot use an index.

**`date_trunc` takes a timezone argument**, and for any report crossing timezones you
want it:

```sql
-- "orders per day in Berlin", not per UTC day
SELECT date_trunc('day', created_at, 'Europe/Berlin') AS day, count(*)
  FROM orders GROUP BY 1 ORDER BY 1;
```

Without it, "today" is a UTC day, and a Berlin customer ordering at 00:30 local lands
in the previous day's bucket.

**`age()` returns a symbolic interval, not a duration.** `age('2026-03-01','2026-02-01')`
is `1 mon`, which is 28 days here and 31 elsewhere. For real elapsed time subtract the
timestamps (`a - b`) and get an interval in days/hours; for "how many years old", use
`extract(year FROM age(...))`.

`pg` returns `interval` as a `PostgresInterval` object, not a number — visible in the
measured output as `[PostgresInterval]`. It has `.years`, `.months`, `.days` and so
on. Do not expect arithmetic on it in JavaScript.

## Intervals and the DST edge

```sql
ts + interval '1 day'    -- calendar: same wall-clock time tomorrow (23 or 25 h on a DST boundary)
ts + interval '24 hours' -- exactly 24 hours of elapsed time
```

These differ on DST transitions, and which you want depends on the domain: "the
meeting is at the same time tomorrow" is `1 day`; "the token expires 24 hours from
now" is `24 hours`. Choosing by accident produces a bug twice a year.

`interval '1 month'` is calendar-aware — adding it to 31 January gives 28 February,
and adding it back does not return you to 31 January. Month arithmetic is not
invertible.

## Storing and comparing

- **`timestamptz` for instants**, always ([`CREATE TABLE`](../phase-3-ddl/01-create-table.md)).
  It stores UTC and renders in the session's `TimeZone`.
- **`date` for calendar dates** with no time component, handled as text at the
  boundary.
- **Never `timestamp`** (without zone) unless you are deliberately storing a local
  wall-clock reading whose zone is recorded separately.
- Compare timestamps with half-open ranges, never `BETWEEN`
  ([`WHERE` predicates](02-where-predicates.md)).

```sql
SET TIME ZONE 'Europe/Berlin';   -- session-level rendering only; storage is unchanged
SHOW TimeZone;
```

Setting it per session on a **pooled** connection leaks to the next request, exactly
as `search_path` does ([Schemas and tenancy](../phase-3-ddl/10-schemas-tenancy.md)).
Prefer `AT TIME ZONE` in the query, or `SET LOCAL` inside a transaction.

## Trade-off

PostgreSQL's date handling is unusually complete — timezone-aware storage, calendar
arithmetic, DST-correct intervals — and doing this work in SQL means every client
gets the same answer.

The cost is a large surface of near-identical functions with subtly different
semantics (`now()` vs `clock_timestamp()`, `age()` vs subtraction, `1 day` vs
`24 hours`), and a type boundary with JavaScript that silently corrupts calendar
dates. None of it errors; it just produces answers that are off by a day or a month.

## Gotchas

**Symptom:** A date is one day earlier in the API than in the database
**Cause:** `pg` maps `date` to a `Date` at local midnight — measured,
`2026-01-01` printed as `2025-12-31T18:30:00Z` at UTC+5:30.
**Fix:** Return `to_char(col,'YYYY-MM-DD')`, or `pg.types.setTypeParser(1082, v => v)`.

**Symptom:** Every row in a batch has the same `created_at`
**Cause:** `now()` is transaction start time — measured, identical 150 ms apart.
**Fix:** `clock_timestamp()` for true per-row time.

**Symptom:** Daily report buckets are shifted by hours
**Cause:** `date_trunc('day', ts)` buckets by UTC.
**Fix:** `date_trunc('day', ts, 'Europe/Berlin')`.

**Symptom:** `age()` gives a different number of days than expected
**Cause:** It returns a symbolic interval — `1 mon` is 28–31 days.
**Fix:** Subtract timestamps for elapsed time; `extract(year FROM age(...))` for
whole years.

**Symptom:** An interval value is an object in JavaScript
**Cause:** `pg` returns `interval` as `PostgresInterval` — measured.
**Fix:** Compute the number in SQL (`extract(epoch FROM …)`) and return a number.

**Symptom:** A scheduled job fires an hour early or late twice a year
**Cause:** `interval '1 day'` (calendar) vs `'24 hours'` (elapsed) across a DST
boundary.
**Fix:** Choose deliberately based on the domain.

**Symptom:** Timestamps render in the wrong zone for some requests
**Cause:** `SET TIME ZONE` persisted on a pooled connection.
**Fix:** `AT TIME ZONE` in the query, or `SET LOCAL` in a transaction.

**Symptom:** An index on `created_at` is unused in a date filter
**Cause:** `WHERE date(created_at) = …` wraps the column.
**Fix:** `WHERE created_at >= d AND created_at < d + 1`.

## Interview questions

**★ What does `now()` return inside a transaction?**
The transaction's start time, not the current time — measured, two inserts 150 ms
apart got identical timestamps. `statement_timestamp()` is the statement's start and
`clock_timestamp()` is the real wall clock, advancing mid-statement.

**★ Why does a date come back one day early in Node?**
`pg` maps a `date` column to a JavaScript `Date` at *local* midnight. On a UTC+5:30
machine, local midnight on 2026-01-01 is 18:30 UTC on 2025-12-31 — measured — so
`toISOString()` reports the previous day. Return calendar dates as text, or register
a type parser for OID 1082.

**★ How do you bucket rows by month or day correctly?**
`date_trunc('month', ts)` — it returns a timestamp, so it sorts and indexes properly,
unlike `to_char`. For anything crossing timezones pass the zone:
`date_trunc('day', created_at, 'Europe/Berlin')`, or a customer ordering just after
local midnight lands in the wrong day.

**★ What is the difference between `age(a,b)` and `a - b`?**
`age` returns a *symbolic* interval in years/months/days, where `1 mon` is 28–31 real
days depending on the month. Subtraction returns an interval of days and hours —
actual elapsed time. Use `age` for "how old", subtraction for durations.

**★ `interval '1 day'` or `'24 hours'`?**
They differ across DST transitions: `1 day` keeps the wall-clock time (so 23 or 25
hours elapse), `24 hours` is exactly 24 hours. "Same time tomorrow" is `1 day`;
"expires in 24 hours" is `24 hours`. Picking by accident is a bug that appears twice
a year.

**Why `timestamptz` rather than `timestamp`?**
`timestamptz` stores an instant and renders it in the session's timezone, so the
round trip is lossless. `timestamp` stores a wall-clock reading with no zone, so the
same stored value means different instants to different readers and there is no way
to recover which was meant.

---

← [String functions](16-string-functions.md) · Next → [`generate_series`](18-generate-series.md)
