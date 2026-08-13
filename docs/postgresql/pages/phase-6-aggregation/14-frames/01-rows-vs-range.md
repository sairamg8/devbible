---
title: "ROWS vs RANGE"
sidebar_label: "01 · ROWS vs RANGE"
sidebar_position: 1
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08 on **PostgreSQL 18.4** (`postgres:18-alpine`, `127.0.0.1:55432`),
> **Node 24.19.0**, `pg` 8.23.0. Scripts: `sandbox/pg-api/ex37-cte-subquery.mjs`,
> `sandbox/pg-api/ex37f-frame-extras.mjs`.

**Every window aggregate is computed over a *frame* — a slice of the partition, not the
whole of it. If you never wrote a frame clause you still got one, and the default is
`RANGE`, which treats rows with equal `ORDER BY` values as a single unit. That default is
why a running total can jump two rows at once, and it is the most common source of "my
running total is wrong" that is not actually wrong.**

## The default frame is `RANGE`, and peers share a value

```sql
SELECT id, day, amt,
       sum(amt) OVER (ORDER BY day)                          AS range_default,
       sum(amt) OVER (ORDER BY day ROWS UNBOUNDED PRECEDING) AS rows_frame
FROM agg_tick ORDER BY id;
```

```console
default frame is RANGE, and peers share a value:
[{"id":1,"day":"2026-03-01","amt":10,"range_default":"30","rows_frame":"10"},
 {"id":2,"day":"2026-03-01","amt":20,"range_default":"30","rows_frame":"30"},
 {"id":3,"day":"2026-03-02","amt":30,"range_default":"60","rows_frame":"60"},
 {"id":4,"day":"2026-03-03","amt":40,"range_default":"150","rows_frame":"100"},
 {"id":5,"day":"2026-03-03","amt":50,"range_default":"150","rows_frame":"150"},
 {"id":6,"day":"2026-03-04","amt":60,"range_default":"210","rows_frame":"210"}]
  rows 1 and 2 are peers on 2026-03-01: RANGE gives both 30, ROWS gives 10 then 30
```

Rows 1 and 2 are both on 2026-03-01, so under `RANGE` they are **peers** — indistinguishable
to the frame — and both get 30, the total of the whole day. Under `ROWS` they get 10 and 30,
counting rows one at a time.

*(Dates render a day early in JavaScript for the usual `+5:30` reason —
[see empty groups and grouping keys](../01-group-by/02-empty-groups-and-keys.md). The
values above are shown as the SQL sees them.)*

**Neither is wrong; they answer different questions.** "Total through the end of this day"
is `RANGE`. "Total through this row" is `ROWS`. The trap is that `RANGE` is what you get by
default, so a running total on a non-unique ordering silently reports the former when the
author meant the latter.

The rule for choosing:

| You want | Frame |
|---|---|
| A running total that advances one row at a time | **`ROWS`** |
| A running total per distinct ordering value | `RANGE` (the default) |
| Anything where the `ORDER BY` is unique | either — they agree |

That last row is why this bug hides. With a unique `ORDER BY` the two are identical:

```console
=== B. the running-total shorthand ===
[{"id":1,"amt":10,"default_frame":"10","explicit_rows":"10","spelled_out":"10"},
 {"id":2,"amt":20,"default_frame":"30","explicit_rows":"30","spelled_out":"30"},
 ...
 {"id":6,"amt":60,"default_frame":"210","explicit_rows":"210","spelled_out":"210"}]
  ^ identical here because id is unique: with no peers, RANGE and ROWS agree
```

So a running total developed against `ORDER BY id` works perfectly, and breaks the day
someone changes it to `ORDER BY day`. **Write `ROWS` explicitly when you mean rows**, even
where it currently makes no difference.

## The three spellings of a running total

```sql
sum(amt) OVER (ORDER BY id)                                          -- RANGE, implicit
sum(amt) OVER (ORDER BY id ROWS UNBOUNDED PRECEDING)                 -- shorthand
sum(amt) OVER (ORDER BY id ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW)
```

The second and third are the same thing: **a frame with only a start point implies
`AND CURRENT ROW`**. The measured output above shows all three agreeing on a unique key.

The full form is `frame_kind BETWEEN start AND end`, where each endpoint is one of
`UNBOUNDED PRECEDING`, `n PRECEDING`, `CURRENT ROW`, `n FOLLOWING`, `UNBOUNDED FOLLOWING`.

## Moving averages, and the partial window at the start

```sql
SELECT id, amt,
       round(avg(amt) OVER (ORDER BY id ROWS BETWEEN 2 PRECEDING AND CURRENT ROW), 1) AS ma3
FROM agg_tick ORDER BY id;
```

```console
moving average, 3 rows  : [{"id":1,"amt":10,"ma3":"10.0"},{"id":2,"amt":20,"ma3":"15.0"},
                           {"id":3,"amt":30,"ma3":"20.0"},{"id":4,"amt":40,"ma3":"30.0"},
                           {"id":5,"amt":50,"ma3":"40.0"},{"id":6,"amt":60,"ma3":"50.0"}]
  the first two rows average over 1 and 2 rows — a partial window, not NULL
```

**The first row's "3-row moving average" is its own value.** The frame is clipped at the
partition edge rather than producing `NULL`, so rows 1 and 2 average over 1 and 2 values
respectively. That is usually not what a chart wants — the first points of the series are
noisier than the rest and nothing marks them as such.

If a partial window should be blank, say so explicitly:

```sql
CASE WHEN count(*) OVER (ORDER BY id ROWS BETWEEN 2 PRECEDING AND CURRENT ROW) = 3
     THEN avg(amt) OVER (ORDER BY id ROWS BETWEEN 2 PRECEDING AND CURRENT ROW)
END AS ma3_full_only
```

`count(*)` over the same frame tells you how many rows it actually contained, which is the
general technique for detecting a clipped frame.

## Frames can look forward

```sql
SELECT id, amt,
       sum(amt) OVER (ORDER BY id ROWS BETWEEN 1 PRECEDING AND 1 FOLLOWING) AS around
FROM agg_tick ORDER BY id;
```

```console
centred frame           : [{"id":1,"amt":10,"around":"30"},{"id":2,"amt":20,"around":"60"},
                           {"id":3,"amt":30,"around":"90"},{"id":4,"amt":40,"around":"120"},
                           {"id":5,"amt":50,"around":"150"},{"id":6,"amt":60,"around":"110"}]
```

A centred window — each row plus its immediate neighbours. Row 1 sums 10+20 and row 6 sums
50+60, clipped at both ends again. Frames entirely in the future are legal too:

```console
a frame that is entirely in the future         ok  [{"id":1,"sum":"50"},{"id":2,"sum":"70"},{"id":3,"sum":"90"}]
```

`ROWS BETWEEN 1 FOLLOWING AND 2 FOLLOWING` — the next two rows, excluding this one. Useful
for "what happened after this event".

## A frame never crosses a partition boundary

```console
=== C. a frame never crosses a partition boundary ===
[{"id":1,"amt":10,"within_day":"30"},{"id":2,"amt":20,"within_day":"30"},
 {"id":3,"amt":30,"within_day":"30"},{"id":4,"amt":40,"within_day":"90"},
 {"id":5,"amt":50,"within_day":"90"},{"id":6,"amt":60,"within_day":"60"}]
  ^ rows 3 and 6 are alone in their day, so their "neighbours" frame is just themselves
```

With `PARTITION BY day`, a "1 preceding and 1 following" frame stops at the partition edge.
Rows 3 and 6 are the only rows on their day, so their neighbour window contains just
themselves. This is the same clipping as at the start of the partition, and it is what makes
`PARTITION BY` the right tool for "compare within a group, never across groups".

## Ranking functions ignore the frame — silently

```console
frame on a ranking function (accepted, ignored) ok  [{"row_number":"1"},{"row_number":"2"},{"row_number":"3"}]
  ^ compare: the same ranking with a deliberately silly frame gives identical output
...same ranking, absurd frame                  ok  [{"row_number":"1"},{"row_number":"2"},{"row_number":"3"}]
```

`row_number()`, `rank()`, `dense_rank()`, `lag()` and `lead()` are defined over the
partition, not the frame. PostgreSQL **accepts** a frame clause on them and disregards it —
even a nonsensical one produces identical output. No error, no warning.

That is worse than a rejection would be, because a frame written next to a ranking function
looks like it is doing something. If you see one, delete it: it has never had any effect.
The functions that *do* depend on the frame are the aggregates, plus `first_value`,
`last_value` and `nth_value` — which is exactly why `last_value` famously returns the
current row ([topic 08](../08-lag-lead/02-first-and-last.md)).

## In Node

```js
const {rows} = await pool.query(
  `SELECT to_char(day, 'YYYY-MM-DD') AS day,
          amt,
          sum(amt) OVER (ORDER BY day, id ROWS UNBOUNDED PRECEDING) AS running,
          round(avg(amt) OVER (ORDER BY day, id
                               ROWS BETWEEN 6 PRECEDING AND CURRENT ROW), 1) AS ma7,
          count(*) OVER (ORDER BY day, id
                         ROWS BETWEEN 6 PRECEDING AND CURRENT ROW) AS ma7_rows
   FROM agg_tick
   ORDER BY day, id`,
);
```

- **`ROWS`, spelled out**, because the intent is per-row. With `ORDER BY day` alone the
  default `RANGE` would total whole days.
- **A unique tiebreaker in the `ORDER BY`** — `day, id`. Without it, peers make the frame
  ambiguous and `ROWS` picks an arbitrary order among them.
- **Return `ma7_rows` alongside `ma7`** so the client can grey out or drop the first six
  points instead of plotting a partial average as though it were a full one.
- **`to_char` for the date**, so the driver does not shift it into the previous day.

## Trade-off

The frame is what makes window functions expressive — running totals, moving averages,
centred smoothing and "the next two events" are all one clause apart. The cost is a default
that is easy to not notice: `RANGE` with peers is the correct SQL semantic and the wrong
answer for most running totals, and it only reveals itself when the ordering key stops
being unique. Writing the frame explicitly costs a line and removes a whole class of
silently wrong report.

## Gotchas

**Symptom:** a running total jumps by two rows' worth at once
**Cause:** the default frame is `RANGE`, and rows with equal `ORDER BY` values are peers
sharing one total. Measured: two rows on the same day both showed 30 under `RANGE`, versus
10 and 30 under `ROWS`
**Fix:** `ROWS UNBOUNDED PRECEDING`, or add a unique tiebreaker to the `ORDER BY`

**Symptom:** the running total was right in development and wrong in production
**Cause:** it was developed against a unique `ORDER BY`, where `RANGE` and `ROWS` agree, and
later reordered by a non-unique column
**Fix:** always write `ROWS` when you mean rows, even where it currently makes no difference

**Symptom:** the first points of a moving average look wrong
**Cause:** the frame is clipped at the partition start, so a 3-row average over row 1 is
just row 1 — a partial window, not `NULL`
**Fix:** `count(*)` over the same frame, and blank the value when it is short of full width

**Symptom:** a frame clause on `row_number()` does nothing
**Cause:** ranking functions are defined over the partition and ignore the frame. Measured:
even an absurd frame produced identical output, with no error
**Fix:** delete the frame clause — it has never done anything

**Symptom:** a moving average bleeds across groups
**Cause:** no `PARTITION BY`, so the frame spans the whole result
**Fix:** `PARTITION BY` the group. Frames never cross a partition boundary

## Interview questions

**★ What is the default window frame, and why does it matter?**
`RANGE BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW`. It matters because `RANGE` treats rows
with equal `ORDER BY` values as peers that share one frame — so a running total over a
non-unique ordering advances a whole group at a time. Measured: two same-day rows both
showed 30, where `ROWS` gave 10 then 30.

**★ When do `ROWS` and `RANGE` give the same answer?**
Whenever the `ORDER BY` is unique, since there are no peers. That is exactly why the bug
survives development and appears after someone changes the ordering column.

**★ What does a 3-row moving average return for the first row?**
That row's own value — the frame is clipped at the partition edge rather than returning
`NULL`. Measured: 10.0, then 15.0, then 20.0. Use `count(*)` over the same frame to detect
and blank the partial windows.

**★ Does a frame clause affect `row_number()` or `rank()`?**
No. Ranking functions are defined over the partition and ignore it. PostgreSQL accepts the
clause silently — measured, an absurd frame gave identical output with no error — which
makes it worse than an error, because it looks intentional.

**Which window functions actually depend on the frame?**
The aggregates used as window functions, plus `first_value`, `last_value` and `nth_value`.
`lag` and `lead` do not — they count rows relative to the current one within the partition.

**How do you write "the next two rows, not counting this one"?**
`ROWS BETWEEN 1 FOLLOWING AND 2 FOLLOWING`. Frames entirely in the future are legal.

---

← [Topic index](README.md) · Next → [RANGE offsets, GROUPS and EXCLUDE](02-range-groups-exclude.md)
