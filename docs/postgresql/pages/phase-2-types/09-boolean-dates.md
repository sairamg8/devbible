---
title: "boolean, date and interval"
sidebar_label: "09 · boolean, date, interval"
sidebar_position: 9
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 on **PostgreSQL 18.4** (`postgres:18-alpine`, `127.0.0.1:55432`),
> **Node 24.19.0**, `pg` 8.23.0. Script: `sandbox/pg-api/ex34-types-more.mjs`.

**A real `boolean` type that accepts a dozen spellings, a 4-byte `date`, and an `interval`
whose arithmetic is calendar-aware — which means `1 month` is not 30 days when you add it,
but is when you compare it.**

## boolean

```console
$ node ex34-types-more.mjs
=== 9. boolean, date and interval ===
boolean inputs: {"t":true,"yes":true,"on_":true,"one":true,"f":false,"bytes":1}
'maybe'::boolean                                 ->  22P02 invalid input syntax for type boolean: "maybe"
```

`true`, `t`, `yes`, `y`, `on`, `1` all become **true**; `false`, `f`, `no`, `n`, `off`, `0`
become false; anything else is `22P02`. Stored in **1 byte**.

A `boolean` column is three-valued unless you forbid it — `true`, `false`, `NULL` — and
`NULL` here usually means "we never asked", which is genuine information. Decide which you
want:

```sql
is_active  boolean NOT NULL DEFAULT true,   -- two states only
email_opt_in boolean                        -- three states: yes / no / never asked
```

Counting needs care because of that third state:

```console
boolean + NULL in a count: {"true_count":"1","non_null":"2","all_rows":"3"}
```

```sql
count(*)                        -- 3: every row
count(b)                        -- 2: non-null values
count(*) FILTER (WHERE b)       -- 1: the true ones          ← usually what you want
sum(b::int)                     -- 1, but NULL-poisoned if any row is NULL
```

`FILTER` is the clean idiom and reads better than `count(CASE WHEN b THEN 1 END)`.

## date

`date` is 4 bytes and holds no time and no zone. Arithmetic with plain integers works in
days:

```console
date arithmetic: {"date_minus_date":28,"date_plus_int":"2026-03-30T18:30:00.000Z",
                  "date_plus_interval":"2026-04-01 00:00:00",
                  "jan31_plus_month":"2026-02-28 00:00:00","mar31_plus_month":"2026-04-30 00:00:00"}
```

- **`date - date` gives an integer** number of days (28), not an interval.
- **`date + integer` gives a date** — 30 days after 1 March.
- **`date + interval` gives a `timestamp`**, not a date. That surprises people: adding
  `interval '1 month'` to a date silently changes the type, so `col + interval '1 day'` in a
  `WHERE` against a date column now compares timestamps.

**Month arithmetic clamps to the end of the month:** 31 January + 1 month = **28 February**,
and 31 March + 1 month = **30 April**. It never overflows into the next month. This is the
sane behaviour, and it is not associative — `+ 1 month + 1 month` from 31 January gives
28 March, not 31 March.

## interval

```console
interval: {"month_eq_30d":true,"day_eq_24h":true,"justified":"3 mons",
           "month_seconds":"2592000.000000","bytes":16}
```

**`interval '1 month' = interval '30 days'` is `true`.** So is
`interval '1 day' = interval '24 hours'`. For *comparison*, PostgreSQL normalises using
30-day months and 24-hour days — but for *arithmetic* it uses the real calendar, which is
why adding a month to 31 January gives 28 February rather than 2 March.

**Comparison and addition use different rules.** That is the single most confusing thing
about the type, and the reason to avoid comparing intervals when you mean to compare
instants:

```sql
-- fragile: interval comparison with 30-day months
WHERE age(now(), created_at) > interval '1 month'

-- exact: compare timestamps, let the calendar do the work
WHERE created_at < now() - interval '1 month'
```

An interval is 16 bytes storing three independent fields — months, days, microseconds — which
is precisely why it can be calendar-aware. `justify_interval()` normalises between them
(90 days → `3 mons`), and `extract(epoch from interval '1 month')` gives **2 592 000
seconds**, i.e. exactly 30 days — the normalised answer, not a calendar one.

## `age()` versus subtraction

```console
age vs subtraction: {"age":"1 year 5 mons 12 days","subtraction":"530 days"}
```

Two correct answers to different questions:

- **`age(a, b)`** gives a calendar-aware breakdown — `1 year 5 mons 12 days`. Right for
  "how old is this?" shown to a human.
- **`a - b`** gives an exact elapsed duration — `530 days`. Right for arithmetic and
  comparison.

`age()` results are not directly comparable between rows in a meaningful way, because
"1 year 5 mons" depends on which months. Use subtraction when you need to sort or threshold.

## From Node

```console
to JS: {"days":3,"hours":4} | date -> Date
```

**An `interval` arrives as a `PostgresInterval` object**, not a string or a number of
milliseconds — `{days: 3, hours: 4}`, with only the non-zero fields present. Converting it to
a duration in the application requires deciding what a month means, which is the ambiguity
the object is preserving.

Usually the better move is to convert in SQL, where the calendar is available:

```sql
SELECT extract(epoch FROM (ends_at - starts_at)) AS seconds FROM bookings;
```

**A `date` arrives as a JavaScript `Date` at local midnight** — the day-shifting trap
covered in [timestamptz vs timestamp](04-timestamptz.md). For a `date` column, either
`to_char(d,'YYYY-MM-DD')` or `pg.types.setTypeParser(1082, v => v)`.

`boolean` maps cleanly to JavaScript `true`/`false`/`null` in both directions.

## Trade-off

**`date` and `interval` are more expressive than the integer-and-milliseconds modelling
most applications default to, and the expressiveness is where the surprises live.** A
`date` column is 4 bytes and cannot represent an instant; an `interval` captures "one
month" honestly but then compares as 30 days. The alternative — storing days as integers
and durations as seconds — is unambiguous and loses the calendar, so "same day next month"
becomes application code. Use the real types, and keep comparisons on timestamps rather
than on intervals.

## Gotchas

**Symptom:** `date + interval '1 day'` no longer compares correctly against a date column
**Cause:** `date + interval` returns a `timestamp`, not a `date`
**Fix:** `date + 1` for whole days, or cast the result back with `::date`

**Symptom:** Adding a month to 31 January gives 28 February, not 2 March
**Cause:** Month arithmetic clamps to the end of the month — deliberate
**Fix:** Expected behaviour; note it is not associative

**Symptom:** `interval '1 month' = interval '30 days'` is true but the arithmetic disagrees
**Cause:** Comparison normalises to 30-day months; addition uses the real calendar
**Fix:** Compare timestamps (`created_at < now() - interval '1 month'`), not intervals

**Symptom:** `sum(flag::int)` returned NULL
**Cause:** A NULL boolean poisons the sum
**Fix:** `count(*) FILTER (WHERE flag)`

**Symptom:** An interval from Node is an object, not a number
**Cause:** `pg` returns `PostgresInterval` to preserve the months/days/seconds distinction
**Fix:** `extract(epoch FROM …)` in SQL if you want seconds

**Symptom:** A date is a day earlier in the application
**Cause:** `date` becomes a `Date` at local midnight
**Fix:** `to_char(d,'YYYY-MM-DD')` or `setTypeParser(1082, v => v)`

**Symptom:** `'maybe'::boolean` fails
**Cause:** Only the recognised spellings are accepted
**Fix:** `22P02` is correct; normalise input before the query

## Interview questions

**★ What does `date - date` return?**
An integer number of days — measured 28 — not an interval. `date + integer` returns a date,
but `date + interval` returns a `timestamp`.

**★ Is `interval '1 month'` equal to `interval '30 days'`?**
For comparison, yes — measured `true`. For arithmetic, no: adding a month to 31 January
gives 28 February. Comparison normalises; addition uses the calendar.

**★ What happens adding a month to the 31st?**
It clamps to the last day of the target month — 31 Jan + 1 month = 28 Feb, 31 Mar + 1 month
= 30 Apr. Measured.

**★ `age()` or subtraction?**
`age()` for a human-readable calendar breakdown (`1 year 5 mons 12 days`); subtraction for an
exact duration (`530 days`) that can be compared and sorted.

**★ How do you count true values in a nullable boolean column?**
`count(*) FILTER (WHERE flag)`. `count(flag)` counts non-nulls including false, and
`sum(flag::int)` returns NULL if any row is NULL.

**How does an interval arrive in Node?**
As a `PostgresInterval` object with only the non-zero fields. Convert with
`extract(epoch FROM …)` server-side if you want a number.

**How big are these types?**
`boolean` 1 byte, `date` 4, `interval` 16 (three fields: months, days, microseconds).

---

← [jsonb vs json](08-jsonb.md) · Next → [Arrays](10-arrays.md)
