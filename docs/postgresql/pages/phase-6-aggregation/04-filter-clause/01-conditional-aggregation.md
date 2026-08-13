---
title: "Conditional aggregation"
sidebar_label: "01 · Conditional aggregation"
sidebar_position: 1
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 on **PostgreSQL 18.4** (`postgres:18-alpine`, `127.0.0.1:55432`),
> **Node 24.19.0**, `pg` 8.23.0. Scripts: `sandbox/pg-api/ex36-aggregation.mjs`,
> `sandbox/pg-api/ex36d-count-having.mjs`.

**`FILTER (WHERE …)` attaches a predicate to a single aggregate. The rest of the query
is untouched — other aggregates in the same select list see all the rows. That is the
difference from `WHERE`, and it is what makes a one-row summary possible.**

## The syntax

```sql
SELECT count(*) FILTER (WHERE status = 'paid')::int      AS paid,
       count(*) FILTER (WHERE status = 'open')::int      AS open,
       count(*) FILTER (WHERE status = 'cancelled')::int AS cancelled,
       sum(total) FILTER (WHERE status = 'paid')::int    AS paid_revenue
FROM agg_orders;
```

```console
$ node ex36-aggregation.mjs
=== 4. FILTER — conditional aggregation without a CASE pile ===
one pass, three counts : [{"paid":3,"open":2,"cancelled":1,"paid_revenue":500}]
```

`FILTER` goes **after** the aggregate's closing parenthesis and before any `OVER`. It
takes a full `WHERE`-style predicate, including references to any column in the
`FROM` — not only the ones in the select list.

Standard SQL, supported since PostgreSQL 9.4. MySQL and SQL Server do not have it,
which is the main reason `CASE` remains common in portable code.

## The `CASE` equivalent, and where it stops being equivalent

```sql
SELECT count(CASE WHEN status = 'paid' THEN 1 END)::int          AS paid,
       sum(CASE WHEN status = 'paid' THEN total ELSE 0 END)::int AS paid_revenue
FROM agg_orders;
```

```console
the CASE equivalent : [{"paid":3,"paid_revenue":500}]
```

Same answers here. And with four different spellings side by side, they still agree:

```console
=== D5. FILTER vs count(col) vs CASE — do they agree? ===
[{"via_filter":5,"via_count_col":5,"via_case":5,"via_sum_case":5}]
```

The mechanism behind the `count` version is worth stating, because it is not obvious:
`CASE WHEN … THEN 1 END` has **no `ELSE`**, so non-matching rows yield `NULL`, and
`count()` skips `NULL`s. It is the same `NULL`-skipping rule from
[collapsing rows](../01-group-by/01-collapsing-rows.md) being used deliberately. Write
`ELSE 0` there by accident and every row counts — a genuinely common bug, and one
`FILTER` cannot express because it has no `ELSE` to get wrong.

### Where they disagree: nothing matched

```sql
SELECT sum(total) FILTER (WHERE status = 'refunded')             AS filt,
       sum(CASE WHEN status = 'refunded' THEN total ELSE 0 END)  AS case_else0
FROM agg_orders;
```

```console
empty, FILTER vs CASE : [{"filt":null,"case_else0":"0"}]
```

**`NULL` against `0`.** `FILTER` removed every row from that aggregate's input, so it
summed over an empty set — which is `NULL`. The `CASE` version kept all six rows and
summed six zeros — which is `0`.

Neither is "right". They answer different questions: "what did refunded orders total?"
(unknown — there were none) versus "what is the sum of the refunded portion of each
order?" (zero). Pick deliberately, and if you want `FILTER`'s clarity with `CASE`'s
zero, say so:

```sql
SELECT coalesce(sum(total) FILTER (WHERE status = 'refunded'), 0) AS refunded_revenue
FROM agg_orders;
```

### Where they *agree*, surprisingly: no rows at all

```console
on an EMPTY set : [{"cnt_filter":0,"sum_filter":null,"sum_case_else0":null}]
```

Run the same pair with `WHERE status = 'refunded'` on the **query** — so zero rows
reach the aggregates at all — and `sum(CASE … ELSE 0)` is `NULL` too. The `ELSE 0`
only fires per row, and there are no rows to fire it on.

So the full picture is three cases, and it is worth having them straight:

| Situation | `count() FILTER` | `sum() FILTER` | `sum(CASE … ELSE 0)` |
|---|---|---|---|
| rows exist, some match | count of matches | sum of matches | sum of matches |
| rows exist, none match | **0** | **`NULL`** | **0** |
| no rows at all | **0** | **`NULL`** | **`NULL`** |

`count` is `0` in every case, because `count` over an empty input is `0`. `sum` is
`NULL` whenever its input is empty, whichever route emptied it. The only cell where
`CASE` differs from `FILTER` is the middle-right one — and it is the cell people
generalise from, which is why "`FILTER` is just `CASE` with nicer syntax" is a belief
that survives until it silently does not.

## `count(*)` vs `count(col)` inside a `FILTER`

The two counting rules compose, and both still apply:

```sql
SELECT count(*)     FILTER (WHERE status = 'open')::int AS star,
       count(total) FILTER (WHERE status = 'open')::int AS col
FROM agg_orders;
```

```console
count(*) vs count(col) under FILTER : [{"star":2,"col":1}]
```

Two open orders; one of them (order 15) has `total` `NULL`. `FILTER` narrowed the
input to those two rows, then `count(total)` applied its own `NULL` rule to what was
left. `FILTER` does not replace the choice between `count(*)` and `count(col)` — it
happens first, and you still have to make it.

That composition is also the clean way to express "how many open orders have been
priced", which as a `CASE` needs a nested condition.

## Building a pivot

`FILTER` with `GROUP BY` is how you turn rows into columns:

```sql
SELECT c.country,
       count(*) FILTER (WHERE o.status = 'paid')::int  AS paid,
       count(*) FILTER (WHERE o.status <> 'paid')::int AS other
FROM agg_customers c JOIN agg_orders o ON o.customer_id = c.id
GROUP BY c.country ORDER BY c.country;
```

```console
per group : [{"country":"GB","paid":1,"other":2},
             {"country":"IN","paid":0,"other":1},
             {"country":"US","paid":2,"other":0}]
```

One row per country, one column per status, **zeros where nothing matched** — because
`count` over an empty filtered input is 0, not `NULL`. Do the same with `sum` and you
get `NULL`s in those cells instead, which is the single most common reason a pivot
renders blanks:

```sql
       coalesce(sum(o.total) FILTER (WHERE o.status = 'paid'), 0)::int AS paid_revenue
```

The columns are fixed at query-writing time — that is the defining limitation of this
technique. A pivot over a set of statuses that changes at runtime cannot be written
this way at all; you need dynamic SQL, `crosstab` from the `tablefunc` extension, or a
row-shaped result that the client pivots. For the usual case — a handful of known
statuses — the fixed columns are a feature, because the response shape is stable.

## Trade-off

`FILTER` is clearer than `CASE`, standard, and impossible to get wrong in the specific
way `count(CASE … ELSE 0)` is. It is also PostgreSQL-and-standard-SQL only, so a query
that must also run on MySQL cannot use it, and it disagrees with the `ELSE 0` idiom
exactly where a summary shows "no data yet". Use it, and `coalesce` the sums.

## Gotchas

**Symptom:** a pivot column shows `null` instead of `0` for the categories with no rows
**Cause:** `sum()`/`avg()` over an empty filtered input is `NULL`; only `count` returns 0
**Fix:** `coalesce(sum(x) FILTER (…), 0)`. Decide once whether the zero is truthful —
"no revenue" and "no orders" are different claims

**Symptom:** switching a `sum(CASE … ELSE 0)` to `sum(…) FILTER (…)` changed a
displayed `0` into a blank
**Cause:** they genuinely differ when rows exist but none match — measured `0` vs `NULL`
**Fix:** wrap in `coalesce` if the old behaviour was the intended one

**Symptom:** `count(CASE WHEN x THEN 1 ELSE 0 END)` counts every row
**Cause:** `count()` counts non-`NULL` values, and `0` is not `NULL`
**Fix:** drop the `ELSE`, or use `count(*) FILTER (WHERE x)`, which cannot express the
mistake

**Symptom:** `count(col) FILTER (…)` is lower than expected
**Cause:** two independent filters are composing — `FILTER` narrows the rows, then
`count(col)` drops the ones where `col` is `NULL`. Measured 2 vs 1
**Fix:** intended behaviour; use `count(*)` if you meant "rows matching the filter"

**Symptom:** the pivot needs a new column every time a status is added
**Cause:** `FILTER` columns are fixed when the query is written
**Fix:** accept it for a small stable set; otherwise return one row per status and pivot
in the client, or use `crosstab` from `tablefunc`

## Interview questions

**★ What does `FILTER (WHERE …)` do that `WHERE` cannot?**
It restricts the input of **one** aggregate rather than the whole query, so several
aggregates in the same select list can see different subsets of the same scan. That is
what makes a one-row paid/open/cancelled summary possible.

**★ Is `FILTER` just nicer syntax for `CASE`?**
Not quite. When rows exist but none match, `sum(x) FILTER (…)` returns `NULL` while
`sum(CASE … ELSE 0)` returns `0` — measured. They agree when nothing at all reaches the
aggregate, where both are `NULL`. Use `coalesce` if you need the zero.

**★ Why does `count(CASE WHEN x THEN 1 ELSE 0 END)` count everything?**
Because `count()` counts non-`NULL` values and `0` is not `NULL`. The working idiom
omits the `ELSE` so non-matching rows become `NULL`. `count(*) FILTER (WHERE x)` has no
way to express the bug.

**★ How do you build a paid/open/cancelled pivot per country?**
`GROUP BY country` with one `count(*) FILTER (WHERE status = …)` per column. Counts
come out as 0 for empty cells; sums come out as `NULL` and need `coalesce`. The column
set is fixed at query-writing time.

**Does `FILTER` change what `count(*)` versus `count(col)` means?**
No — they compose. `FILTER` narrows the rows first, then `count(col)` applies its own
`NULL` rule to the survivors. Measured: `count(*) FILTER` gave 2 and `count(total)
FILTER` gave 1 over the same two open orders.

**Which engines support `FILTER`?**
PostgreSQL (9.4+) and standard SQL; SQLite added it too. MySQL and SQL Server have not,
so portable code still uses `CASE` — with the `ELSE`-less form for counts.

---

← [Topic index](README.md) · Next → [When it pays](02-when-it-pays.md)
