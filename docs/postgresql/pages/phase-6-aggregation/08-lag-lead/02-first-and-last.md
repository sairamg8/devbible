---
title: "first_value, last_value, nth_value"
sidebar_label: "02 · first_value and last_value"
sidebar_position: 2
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 on **PostgreSQL 18.4** (`postgres:18-alpine`, `127.0.0.1:55432`),
> **Node 24.19.0**, `pg` 8.23.0. Script: `sandbox/pg-api/ex36-aggregation.mjs`.

**`last_value` does not return the last row of the partition. It returns the last row of
the *frame*, and the default frame ends at the current row — so it returns the current
row's own value. This is the most reported "PostgreSQL bug" that is not one, and the fix
is one clause.**

## The trap, measured

```sql
SELECT id, total,
       first_value(total) OVER (ORDER BY id) AS first,
       last_value(total)  OVER (ORDER BY id) AS last_default_frame
FROM agg_orders WHERE total IS NOT NULL ORDER BY id;
```

```console
first_value / last_value : [{"id":10,"total":100,"first":100,"last_default_frame":100},
                            {"id":11,"total":50, "first":100,"last_default_frame":50},
                            {"id":12,"total":200,"first":100,"last_default_frame":200},
                            {"id":13,"total":0,  "first":100,"last_default_frame":0},
                            {"id":14,"total":200,"first":100,"last_default_frame":200}]
  last_value returns the CURRENT row: the default frame ends at the current row
```

Read the two columns against each other. **`first` is 100 on every row** — correct, the
first order's total. **`last_default_frame` is a copy of `total`** — 100, 50, 200, 0, 200.
It is not the last value of anything; it is the current row.

## Why

Adding `ORDER BY` to a window implies a default frame:

```
RANGE BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
```

"From the start of the partition to the current row." Under that frame:

- `first_value` looks at the frame's first row → the partition's first row. Correct by
  accident of the frame starting at `UNBOUNDED PRECEDING`.
- `last_value` looks at the frame's last row → **the current row**. Also correct, and
  useless.

So `first_value` appears to work and `last_value` appears broken, when in fact both are
doing the same thing to the same frame. That asymmetry is why the bug is so easy to
ship: the column you checked looked right.

## The fix

State the frame explicitly:

```sql
SELECT id, total,
       last_value(total) OVER (ORDER BY id
         ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING) AS last
FROM agg_orders WHERE total IS NOT NULL ORDER BY id;
```

```console
last_value fixed : [{"id":10,"total":100,"last":200},{"id":11,"total":50,"last":200},
                    {"id":12,"total":200,"last":200},{"id":13,"total":0,"last":200},
                    {"id":14,"total":200,"last":200}]
```

**200 on every row** — order 14's total, the last row by `id`. That is what was wanted.

Three ways to get the same answer, in rough order of preference:

```sql
-- 1. explicit full frame
last_value(total) OVER (ORDER BY id ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING)

-- 2. reverse the order and take the first — no frame clause needed
first_value(total) OVER (ORDER BY id DESC)

-- 3. max() if the value you want is the maximum, not the last
max(total) OVER ()
```

Option 2 is the one to remember: **`first_value` over the reverse ordering** is shorter,
harder to get wrong, and needs no frame reasoning. It is what most experienced queries
use. Option 3 is only equivalent when "last" and "largest" coincide — here they do not,
since the last total is 200 and so is the max, but order 13's 0 would break the analogy in
a different fixture.

Use option 1 when you need both ends of the same window and want the frame stated once in
a named `WINDOW` clause.

## `nth_value`

```sql
SELECT id, nth_value(total, 2) OVER (ORDER BY id
         ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING) AS second
FROM agg_orders WHERE total IS NOT NULL ORDER BY id;
```

```console
nth_value : [{"id":10,"second":50},{"id":11,"second":50},{"id":12,"second":50},
             {"id":13,"second":50},{"id":14,"second":50}]
```

50 on every row — the second row's total. Same frame caveat: **with the default frame,
`nth_value(x, 2)` is `NULL` on the first row** of each partition, because the frame does
not yet contain two rows. The explicit full frame is what makes it constant across the
partition.

`nth_value` is 1-based. There is no negative form for "second from the end" — reverse the
ordering for that.

## When to use these instead of `lag`

They answer different questions, and picking the wrong one is a correctness issue rather
than a style one:

| Question | Function |
|---|---|
| the value one row back | `lag(x)` |
| the value at the start of the partition | `first_value(x)` |
| the value at the end of the partition | `first_value(x) OVER (… ORDER BY … DESC)` |
| the value N rows back | `lag(x, n)` |
| the Nth value in the partition | `nth_value(x, n)` with a full frame |

The distinction that matters: **`lag`/`lead` are relative to the current row and ignore
the frame; `first_value`/`last_value`/`nth_value` are relative to the frame.** So a
moving-average style frame (`ROWS BETWEEN 2 PRECEDING AND CURRENT ROW`) changes what
`first_value` returns and does nothing to `lag`.

A common and correct use of `first_value` is normalising a series against its baseline:

```sql
SELECT day, n,
       round(100.0 * n / first_value(n) OVER (ORDER BY day), 1) AS pct_of_first
FROM daily_counts;
```

Every row as a percentage of the first day — the frame's `UNBOUNDED PRECEDING` start makes
this correct with no frame clause, which is the one case where the default helps.

## In Node

```js
const {rows} = await pool.query(
  `SELECT id, total,
          first_value(total) OVER w                  AS opening,
          first_value(total) OVER (ORDER BY id DESC) AS closing,
          total - first_value(total) OVER w          AS change_since_open
   FROM agg_orders
   WHERE customer_id = $1 AND total IS NOT NULL
   WINDOW w AS (ORDER BY id)
   ORDER BY id`,
  [customerId],
);
```

`closing` uses the reversed-order trick rather than a frame clause, and deliberately does
**not** reuse `w` — a named window cannot have its `ORDER BY` overridden, only extended.
Trying to write `OVER (w ORDER BY id DESC)` is an error, which is a small reason the
reversed `first_value` sometimes costs an extra window definition. Whether that is worth
a second sort is the subject of
[what windows cost](../06-windows-intro/03-what-windows-cost.md) — here the two orderings are
`id` and `id DESC`, which PostgreSQL can serve from one sort read in either direction.

## Trade-off

`first_value`/`last_value`/`nth_value` are the only way to reach a *positional* element of
a window, and they hand you the frame semantics whether or not you were thinking about
frames. `lag` and `lead` are frame-independent and therefore safer by default, at the cost
of only being able to count rows. When both express the question, prefer `lag`/`lead` and
`first_value` over the reversed order — leaving `last_value` and explicit frames for the
cases that genuinely need them.

## Gotchas

**Symptom:** `last_value` returns the current row's own value on every row
**Cause:** the default frame with `ORDER BY` is `RANGE BETWEEN UNBOUNDED PRECEDING AND
CURRENT ROW`, so the frame's last row *is* the current row
**Fix:** `ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING`, or use
`first_value(x) OVER (… ORDER BY … DESC)`

**Symptom:** `first_value` looked correct, so the frame was assumed to be fine
**Cause:** `first_value` happens to be right under the default frame because the frame
starts at `UNBOUNDED PRECEDING`. Only `last_value` exposes the problem
**Fix:** state the frame when you use `last_value` or `nth_value`; checking `first_value`
proves nothing about them

**Symptom:** `nth_value(x, 2)` is `NULL` on the first row of every partition
**Cause:** with the default frame, the frame does not contain two rows yet
**Fix:** the explicit full frame, which makes the value constant across the partition

**Symptom:** `OVER (w ORDER BY id DESC)` raises an error
**Cause:** a named window's `ORDER BY` can be extended but not overridden
**Fix:** define a second window, or write the ordering out inline

**Symptom:** a moving-average frame changed what `first_value` returns but not `lag`
**Cause:** `first_value` is frame-relative, `lag` is row-relative and ignores the frame
**Fix:** intended; pick the one matching the question

**Symptom:** `max(x) OVER ()` was substituted for `last_value` and the number changed
**Cause:** "last" and "largest" are only the same when the series is monotonic
**Fix:** use the reversed `first_value` for "last"; `max` only when you mean the maximum

## Interview questions

**★ Why does `last_value` return the current row?**
Because an `ORDER BY` inside `OVER` implies the default frame `RANGE BETWEEN UNBOUNDED
PRECEDING AND CURRENT ROW`, and the last row of that frame is the current row. Measured:
the column was a copy of the input on all five rows.

**★ Two ways to fix it.**
`ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING`, or — usually better —
`first_value(x) OVER (… ORDER BY … DESC)`, which needs no frame reasoning at all.

**★ Why does `first_value` appear to work when `last_value` does not?**
Both use the same default frame; it just happens to start at `UNBOUNDED PRECEDING`, so
the frame's first row is the partition's first row. The asymmetry is what makes the bug
easy to miss — the column you sanity-checked was the one that looked right.

**★ What is the difference between `lag(x, 3)` and `nth_value(x, 3)`?**
`lag` is relative to the current row and ignores the frame — three rows back from here.
`nth_value` is relative to the frame — the third row of the frame, which under the default
frame is `NULL` until the frame has three rows.

**When is `max(x) OVER ()` a valid substitute for the last value?**
Only when the series is monotonic, so that "last" and "largest" coincide. Otherwise they
are different questions with the same answer by luck.

**Can you override a named window's `ORDER BY`?**
No — a named window can be extended with an `ORDER BY` and a frame if it has none, but an
existing `ORDER BY` cannot be replaced and `PARTITION BY` cannot be changed. Define a
second window instead.

---

← [lag and lead](01-lag-and-lead.md) · Next topic → [CTEs](../09-ctes.md)
