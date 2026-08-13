---
title: "RANGE offsets, GROUPS and EXCLUDE"
sidebar_label: "02 · RANGE offsets, GROUPS, EXCLUDE"
sidebar_position: 2
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08 on **PostgreSQL 18.4** (`postgres:18-alpine`, `127.0.0.1:55432`),
> **Node 24.19.0**, `pg` 8.23.0. Scripts: `sandbox/pg-api/ex37-cte-subquery.mjs`,
> `sandbox/pg-api/ex37f-frame-extras.mjs`.

**`ROWS` counts rows and `RANGE` groups peers, but neither can express "the last 7 days"
when some days are missing. `RANGE` with a value offset can — it measures the frame in the
units of the ordering column rather than in rows — and `GROUPS` counts distinct ordering
values. `EXCLUDE` then removes rows from whatever frame you built, and the difference
between its two useful options is one row.**

## `RANGE` with a value offset: a real time window

```sql
SELECT id, day, amt,
       sum(amt) OVER (ORDER BY day
                      RANGE BETWEEN '1 day' PRECEDING AND CURRENT ROW) AS last_2_days
FROM agg_tick ORDER BY id;
```

```console
RANGE with a value offset: [{"id":1,"day":"2026-03-01","amt":10,"last_2_days":"30"},
                            {"id":2,"day":"2026-03-01","amt":20,"last_2_days":"30"},
                            {"id":3,"day":"2026-03-02","amt":30,"last_2_days":"60"},
                            {"id":4,"day":"2026-03-03","amt":40,"last_2_days":"120"},
                            {"id":5,"day":"2026-03-03","amt":50,"last_2_days":"120"},
                            {"id":6,"day":"2026-03-04","amt":60,"last_2_days":"150"}]
```

The offset is an **interval in the units of the `ORDER BY` column**, not a row count. Row 4
(2026-03-03) sums its own day's 40 + 50 plus the previous day's 30 = 120. Row 6 (03-04) sums
60 plus 03-03's 90 = 150.

**This is the only frame that is correct over a sparse series.** `ROWS BETWEEN 1 PRECEDING`
means "the previous row", which is the previous *day with data* — so a gap in the data
silently widens the window in real time. `RANGE '1 day' PRECEDING` means the previous day
whether or not it has rows. That is the same class of bug as
[`lag` counting rows rather than days](../08-lag-lead/01-lag-and-lead.md), and the same fix
applies when you need the missing days to appear as rows at all.

It works on any type with a defined addition — `interval` for dates and timestamps, plain
numbers for numeric columns (`RANGE BETWEEN 100 PRECEDING AND CURRENT ROW` over a price).

### The two errors it raises

```console
RANGE offset without a single ORDER BY column ->  42P20 RANGE with offset PRECEDING/FOLLOWING requires exactly one ORDER BY column
```

**Exactly one `ORDER BY` column.** This collides directly with the advice to always add a
unique tiebreaker: you cannot write `ORDER BY day, id RANGE BETWEEN '1 day' PRECEDING`. The
offset needs a single well-defined axis to measure along, and two columns do not give it
one. Either drop the tiebreaker for this window, or use `GROUPS` below.

```console
RANGE offset on a text ORDER BY column         ->  0A000 RANGE with offset PRECEDING/FOLLOWING is not supported for column type text
```

`0A000` is "feature not supported" — there is no defined `text` minus `text`, so there is
nothing for the offset to mean. Ordering by a formatted date string instead of the date
itself hits this.

## `GROUPS`: count distinct ordering values

```sql
SELECT id, day, amt,
       sum(amt) OVER (ORDER BY day GROUPS BETWEEN 1 PRECEDING AND CURRENT ROW) AS two_days
FROM agg_tick ORDER BY id;
```

```console
GROUPS frame            : [{"id":1,"day":"2026-03-01","amt":10,"two_days":"30"},
                           {"id":2,"day":"2026-03-01","amt":20,"two_days":"30"},
                           {"id":3,"day":"2026-03-02","amt":30,"two_days":"60"},
                           {"id":4,"day":"2026-03-03","amt":40,"two_days":"120"},
                           {"id":5,"day":"2026-03-03","amt":50,"two_days":"120"},
                           {"id":6,"day":"2026-03-04","amt":60,"two_days":"150"}]
```

Identical results to the `RANGE` version **on this data**, because every day in the fixture
is present. The difference appears the moment a day is missing: `GROUPS 1 PRECEDING` means
"the previous distinct value present in the data", while `RANGE '1 day' PRECEDING` means
"the calendar day before". With a gap, `GROUPS` reaches back further in time and `RANGE`
returns a smaller window.

| Frame | "1 preceding" means |
|---|---|
| `ROWS` | the previous row |
| `GROUPS` | the previous distinct ordering value that exists |
| `RANGE` (offset) | one unit back on the ordering scale, present or not |

So `GROUPS` is right for "the previous two trading days" and `RANGE` for "the last 48
hours". `GROUPS` also accepts multi-column `ORDER BY`, which is the workaround when `42P20`
blocks a `RANGE` offset.

## `EXCLUDE`: removing rows from the frame

All four options, over a frame covering the whole partition:

```console
=== A. all four EXCLUDE options, over the whole partition ===
[{"id":1,"day":"03-01","amt":10,"no_exclude":"6","excl_current":"5","excl_group":"4","excl_ties":"5","excl_no_others":"6"},
 {"id":2,"day":"03-01","amt":20,"no_exclude":"6","excl_current":"5","excl_group":"4","excl_ties":"5","excl_no_others":"6"},
 {"id":3,"day":"03-02","amt":30,"no_exclude":"6","excl_current":"5","excl_group":"5","excl_ties":"6","excl_no_others":"6"},
 {"id":4,"day":"03-03","amt":40,"no_exclude":"6","excl_current":"5","excl_group":"4","excl_ties":"5","excl_no_others":"6"},
 {"id":5,"day":"03-03","amt":50,"no_exclude":"6","excl_current":"5","excl_group":"4","excl_ties":"5","excl_no_others":"6"},
 {"id":6,"day":"03-04","amt":60,"no_exclude":"6","excl_current":"5","excl_group":"5","excl_ties":"6","excl_no_others":"6"}]
  GROUP drops the row AND its peers; TIES drops the peers but KEEPS the row
  (so TIES = GROUP + 1 wherever the row has peers, and NO OTHERS is the default)
```

| Option | Removes | Row 1 (has a peer) | Row 3 (alone) |
|---|---|---|---|
| *(none)* / `EXCLUDE NO OTHERS` | nothing — the default | 6 | 6 |
| `EXCLUDE CURRENT ROW` | this row | 5 | 5 |
| `EXCLUDE GROUP` | this row **and** its peers | **4** | 5 |
| `EXCLUDE TIES` | its peers, **keeping** this row | **5** | 6 |

Read rows 1 and 3 against each other. Row 1 shares its day with row 2, so `GROUP` removes
both (6 → 4) while `TIES` removes only the peer (6 → 5). Row 3 is alone on its day, so it
has no peers: `GROUP` removes just itself (→ 5) and `TIES` removes nothing (→ 6).

**`GROUP` = `TIES` + `CURRENT ROW`.** That is the whole distinction, and it is why
`EXCLUDE TIES` is the odd one — it is the only option that keeps the current row while
dropping rows equal to it.

The practical uses:

```sql
-- each row against the total of all the others
sum(amt) OVER (ORDER BY id ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING
               EXCLUDE CURRENT ROW) AS others
```

```console
EXCLUDE CURRENT ROW     : [{"id":1,"amt":10,"all_":"210","others":"200"},
                           {"id":2,"amt":20,"all_":"210","others":"190"},
                           ...
                           {"id":6,"amt":60,"all_":"210","others":"150"}]
```

Every row's `others` is 210 minus its own amount — "everyone but me", which is the shape for
leave-one-out comparisons and "how does this row compare to the rest". `EXCLUDE GROUP` is
the version for "compare this day against all other days".

## In Node

```js
// A true rolling 7-day window, correct across days with no data.
const {rows} = await pool.query(
  `SELECT to_char(day, 'YYYY-MM-DD') AS day,
          amt,
          sum(amt) OVER (ORDER BY day
                         RANGE BETWEEN '6 days' PRECEDING AND CURRENT ROW) AS rolling_7d,
          sum(amt) OVER (ORDER BY day
                         RANGE BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING
                         EXCLUDE GROUP) AS all_other_days
   FROM agg_tick
   ORDER BY day`,
);
```

- **`RANGE '6 days' PRECEDING AND CURRENT ROW` is 7 days**, not 6 — the frame includes the
  current row's own day. Off-by-one here is easy and silent.
- **No tiebreaker in that `ORDER BY`**, because a `RANGE` offset permits exactly one column
  (`42P20`). If you need a tiebreaker, use `GROUPS`.
- **Interval literals are strings in SQL**, so `'6 days'` is fine inline; parameterise the
  number with `($1 || ' days')::interval` if it is dynamic, rather than concatenating into
  the query text.
- **These sums come back as strings** — `sum(int)` is `bigint`
  ([phase 7](../../phase-7-pg-driver/09-pg-types.md)).

## Trade-off

`RANGE` offsets and `GROUPS` are what make window frames correct over real time series
rather than merely over row positions, and `EXCLUDE` expresses leave-one-out comparisons
that would otherwise need a self-join. The cost is a set of restrictions that only appear at
runtime — one ordering column for `RANGE` offsets, a type that supports subtraction, and
four `EXCLUDE` spellings whose differences are invisible until the data contains peers. All
of it is worth learning once; none of it is worth guessing at.

## Gotchas

**Symptom:** `42P20 RANGE with offset PRECEDING/FOLLOWING requires exactly one ORDER BY column`
**Cause:** a `RANGE` value offset needs a single axis to measure along, and the window has a
tiebreaker column
**Fix:** drop the tiebreaker for this window, or use `GROUPS`, which accepts several
ordering columns

**Symptom:** `0A000 RANGE with offset PRECEDING/FOLLOWING is not supported for column type text`
**Cause:** the ordering column is text, and there is no defined subtraction for it — often
from ordering by a formatted date string
**Fix:** order by the real `date`/`timestamptz` column and format only in the output

**Symptom:** a "last 7 days" window silently covers more than 7 days
**Cause:** `ROWS BETWEEN 6 PRECEDING` counts rows, so days with no data are skipped rather
than counted
**Fix:** `RANGE BETWEEN '6 days' PRECEDING AND CURRENT ROW`, which measures in calendar time

**Symptom:** a rolling 7-day total is actually 8 days
**Cause:** `'7 days' PRECEDING AND CURRENT ROW` includes the current day as well
**Fix:** `'6 days' PRECEDING` for a 7-day inclusive window

**Symptom:** `EXCLUDE GROUP` and `EXCLUDE TIES` seem to do the same thing
**Cause:** they only differ where a row has peers — `GROUP` drops the current row too.
Measured: for a row with one peer, 6 → 4 versus 6 → 5; for a row with none, 5 versus 6
**Fix:** `GROUP` for "all other groups", `TIES` for "me, but not my duplicates"

**Symptom:** `OVER (w EXCLUDE CURRENT ROW)` is a syntax error
**Cause:** a named window that already carries a frame clause cannot have `EXCLUDE` added at
the reference site
**Fix:** spell the frame out in full, or define the named window without a frame

## Interview questions

**★ How do you write a rolling 7-day total that is correct when some days have no data?**
`RANGE BETWEEN '6 days' PRECEDING AND CURRENT ROW`. The offset is measured in the ordering
column's units, so a missing day narrows the window rather than silently extending it back
in time — which is what `ROWS BETWEEN 6 PRECEDING` would do.

**★ What is the difference between `ROWS`, `RANGE` and `GROUPS`?**
`ROWS` counts physical rows; `GROUPS` counts distinct ordering values that exist in the
data; a `RANGE` offset measures in the units of the ordering column whether or not values
exist. On a dense series all three can agree — the fixture's `GROUPS` and `RANGE` output was
identical — and they diverge as soon as there is a gap.

**★ Why does a `RANGE` offset reject a two-column `ORDER BY`?**
`42P20` — the offset needs one well-defined axis to measure along. It conflicts with adding
a unique tiebreaker, and `GROUPS` is the way out when you need both.

**★ What is the difference between `EXCLUDE GROUP` and `EXCLUDE TIES`?**
`GROUP` removes the current row and all its peers; `TIES` removes the peers but keeps the
current row — so `GROUP` = `TIES` + `CURRENT ROW`. Measured on a row with one peer: 6 → 4
for `GROUP`, 6 → 5 for `TIES`. For a row with no peers, `TIES` removes nothing.

**How do you compute "the total of every row except this one"?**
A frame over the whole partition with `EXCLUDE CURRENT ROW`. Measured: a total of 210 with
each row's `others` coming out as 210 minus its own value.

**Which `EXCLUDE` option is the default?**
`EXCLUDE NO OTHERS` — writing it changes nothing, and it exists to make the default
explicit.

---

← [ROWS vs RANGE](01-rows-vs-range.md) · Next topic → [Recursive CTEs](../recursive-cte/)
