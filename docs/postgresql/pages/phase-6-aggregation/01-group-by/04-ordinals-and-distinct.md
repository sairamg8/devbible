---
title: "Ordinals, aliases and DISTINCT"
sidebar_label: "04 · Ordinals and DISTINCT"
sidebar_position: 4
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 on **PostgreSQL 18.4** (`postgres:18-alpine`, `127.0.0.1:55432`),
> **Node 24.19.0**, `pg` 8.23.0. Scripts: `sandbox/pg-api/ex36-aggregation.mjs`,
> `sandbox/pg-api/ex36c-agg-checks.mjs`.

**Where you may write `1` instead of a column name, where an output alias is visible,
and why `GROUP BY x` with no aggregate is the same thing as `SELECT DISTINCT x`. All
three fall out of one fact — the order in which clauses are evaluated.**

## The grid

| Written in | Ordinal (`1`) | Output alias (`s`) | Aggregate |
|---|---|---|---|
| `GROUP BY` | ✅ | ✅ | ❌ `42803` |
| `ORDER BY` | ✅ | ✅ | ✅ |
| `WHERE` | ❌ | ❌ `42703` | ❌ `42803` |
| `HAVING` | ❌ | ❌ `42703` | ✅ |

Measured, every cell:

```console
GROUP BY ordinal          ok  rows=3 [{"status":"open","count":2},…]
GROUP BY output alias     ok  rows=3 [{"s":"open","count":2},…]
GROUP BY expression alias ok  rows=5 [{"dbl":null,"count":"1"},{"dbl":200,"count":"1"},…]
ORDER BY an output alias  ok  rows=3 [{"s":"paid","n":"3"},{"s":"open","n":"2"},…]
WHERE on an output alias  ->  42703 column "s" does not exist
GROUP BY an aggregate     ->  42803 aggregate functions are not allowed in GROUP BY
```

## The pattern behind it: evaluation order

Hold this and the grid stops needing memorisation:

```
FROM → WHERE → GROUP BY → HAVING → SELECT (aliases are born here)
     → window functions → DISTINCT → ORDER BY → LIMIT
```

- **`WHERE` runs before the select list exists**, so an alias defined there is
  genuinely not yet a thing. The error is `42703 column "s" does not exist` — a
  *different* error from `42803`, and the distinction is diagnostic: `42703` means "no
  such column", `42803` means "that column exists but is not one-per-group".
- **`ORDER BY` runs last**, so it sees aliases, aggregates and window results alike.
- **`GROUP BY` is the odd one.** It runs before `SELECT`, and yet PostgreSQL permits
  output names there as a documented convenience extension — including for a computed
  expression (`GROUP BY dbl` where `dbl` is `total*2`). Standard SQL does not allow
  this, so it does not port.
- **An aggregate in `GROUP BY` is a circular request** — the grouping decides what the
  aggregate folds, so the aggregate cannot decide the grouping. Hence `42803 aggregate
  functions are not allowed in GROUP BY`.

The same order explains why a window function cannot appear in `WHERE` or `HAVING` —
covered on [window functions](../windows-intro/), where the error is `42P20`.

### Ordinals are a readability trade

`GROUP BY 1, 2` is compact, and it breaks silently the moment someone inserts a column
into the select list — the query still runs, grouped by something else, returning
plausible numbers. There is no error and no test failure.

Use ordinals in throwaway analysis. Name the columns in anything that ships. This
corpus uses `GROUP BY 1` only where the grouping expression is long enough that
repeating it verbatim would hurt more than the risk — a `date_trunc(...)` call, for
instance — and never in a select list under active development.

## `GROUP BY` with no aggregate is `DISTINCT`

```sql
SELECT user_id FROM agg_events GROUP BY user_id;   -- vs
SELECT DISTINCT user_id FROM agg_events;
```

```console
=== C8. GROUP BY vs SELECT DISTINCT ===
GROUP BY user_id : 54.49 ms   Finalize HashAggregate |   Group Key: user_id
SELECT DISTINCT  : 55.74 ms   HashAggregate |   Group Key: user_id
```

Same answer, same de-duplication mechanism, and 1.25 ms apart on 500 000 rows — inside
each other's noise. The plans differ in one respect: the `GROUP BY` form was
parallelised into `Partial`/`Finalize HashAggregate`, while `DISTINCT` was planned as a
single `HashAggregate`. **Do not read a rule into that.** It is a costing outcome on
this table at this size, not a guarantee, and it did not translate into a meaningful
time difference.

Prefer whichever states the intent. `SELECT DISTINCT user_id` says "the set of user
ids". `GROUP BY user_id` with no aggregate says the same thing more obscurely — but it
is the form to reach for when an aggregate is about to be added.

### They are not interchangeable in general

`DISTINCT` applies to the whole select list *after* it is computed; `GROUP BY` applies
*before*. Two consequences:

**They can be combined, and the combination is nearly always a mistake.**

```console
DISTINCT + GROUP BY together  ok  rows=3
  [{"status":"open","count":"2"},{"status":"cancelled","count":"1"},{"status":"paid","count":"3"}]
```

Legal, and pointless here — `GROUP BY status` already guarantees distinct rows, so the
`DISTINCT` is a second de-duplication pass over data that cannot contain duplicates. In
a real codebase this pattern almost always means somebody added `DISTINCT` to make
duplicate rows go away without diagnosing where they came from. The duplicates are
usually join fan-out, and the `DISTINCT` does not fix the *aggregates*, which are still
counting the inflated rows. The diagnosis is on
[fan-out and aggregates](../../phase-5-joins/01-inner-join/02-fan-out-and-aggregates.md).

**`DISTINCT` cannot filter, `GROUP BY` can.** There is no way to say "distinct user ids
that have more than 3 events" with `DISTINCT`; that needs `GROUP BY … HAVING`, which is
[the next topic but two](../having/).

## `GROUP BY` does not order

Nothing on these pages came back sorted unless the query said `ORDER BY`. Look again at
the functional-dependency result: `10, 13, 11, …`.

With a `HashAggregate`, output order is hash order — arbitrary, unstable across runs,
and liable to change when the table grows enough to flip the planner to
`GroupAggregate`, which *does* emit sorted, purely as a side effect of how it works.

That side effect is the trap. A report developed against a small table comes back
neatly ordered, ships without an `ORDER BY`, and starts returning rows in a different
order months later when the planner switches strategy. If the order matters, write
`ORDER BY`. If the order matters **and** you paginate, write `ORDER BY` with a unique
tiebreaker — the same rule, for the same reason, as
[LIMIT/OFFSET and keyset paging](../../phase-4-crud/03-limit-offset.md), where paging 100 rows by 5
without a tiebreaker returned 54 distinct rows and 46 repeats.

## Trade-off

Ordinals and output aliases make a long grouped query readable, at the cost of coupling
it to select-list *positions* and to a non-standard PostgreSQL extension. The
readability is real — `GROUP BY 1` beside a three-line `date_trunc` expression is
genuinely clearer than the expression twice. The risk is also real and silent. The line
this corpus draws: ordinals for expressions, names for columns, and never in a query
whose select list is still changing.

## Gotchas

**Symptom:** `42703 column "s" does not exist` on a `WHERE` that references an alias you
can plainly see in the `SELECT`
**Cause:** `WHERE` is evaluated before the select list exists
**Fix:** repeat the expression in `WHERE`, or wrap the query in a subquery/CTE and
filter outside. Note the code: `42703` is "no such column", not `42803` "not grouped"

**Symptom:** adding a column to a `SELECT` changed the grouping and nobody noticed
**Cause:** `GROUP BY 1, 2` refers to select-list positions, which just shifted
**Fix:** name the columns in any query that ships. Reserve ordinals for expressions too
long to repeat

**Symptom:** `42803 aggregate functions are not allowed in GROUP BY`
**Cause:** the grouping determines what the aggregate folds, so the aggregate cannot
determine the grouping
**Fix:** you almost certainly want `HAVING` (filter on the aggregate) or a subquery
that computes the aggregate first and groups on the result

**Symptom:** a report's row order changed after the table grew, breaking pagination
**Cause:** `GROUP BY` does not order; `HashAggregate` emits in hash order and the
planner switched into (or out of) it as the estimates moved
**Fix:** `ORDER BY` explicitly, with a unique tiebreaker if the result is paginated

**Symptom:** `SELECT DISTINCT` was added to remove duplicate rows and the totals are
still wrong
**Cause:** the duplicates are join fan-out. `DISTINCT` de-duplicates the *output* rows
but the aggregates were computed over the inflated input
**Fix:** find the fan-out. Aggregate the child table in a subquery or `LATERAL` before
joining, or use `count(DISTINCT …)` where it applies

**Symptom:** a query that worked on PostgreSQL fails on another engine at `GROUP BY s`
**Cause:** output-column names in `GROUP BY` are a PostgreSQL extension, not standard
SQL
**Fix:** repeat the expression if the query must port

## Interview questions

**★ Why can `ORDER BY` use a select-list alias but `WHERE` cannot?**
Evaluation order. `WHERE` runs before the select list is computed, so the alias does not
exist yet — the error is `42703 column does not exist`. `ORDER BY` runs last and sees
everything. `GROUP BY` is a special case: it runs early, but PostgreSQL permits output
names anyway as a non-standard convenience.

**★ Is `GROUP BY x` with no aggregate the same as `SELECT DISTINCT x`?**
Same result, same de-duplication. Measured on 500 000 rows at 54.49 ms and 55.74 ms —
within noise, both `HashAggregate`. Prefer `DISTINCT` when you mean "the set of values"
and `GROUP BY` when an aggregate is coming. They differ in that `GROUP BY` can be
filtered with `HAVING` and `DISTINCT` cannot.

**★ Someone adds `DISTINCT` to a `GROUP BY` query to remove duplicate rows. What does
that tell you?**
That the duplicates come from somewhere else — almost always join fan-out. `GROUP BY`
already emits distinct rows, so the `DISTINCT` is a no-op over the grouped output while
the real duplication is still inflating the aggregates underneath it.

**★ Does `GROUP BY` return rows in group order?**
No. `HashAggregate` returns hash order, which is arbitrary and can change when the
planner switches strategy; `GroupAggregate` happens to emit sorted, which is exactly
what makes the bug intermittent. Always `ORDER BY` if order matters.

**Why is an aggregate illegal in `GROUP BY` but legal in `HAVING` and `ORDER BY`?**
Because `GROUP BY` runs before aggregation and defines its input, so depending on an
aggregate would be circular. `HAVING` and `ORDER BY` both run after aggregation, when
the values exist.

**What is the difference between error codes `42703` and `42803` here?**
`42703` is "column does not exist" — you referenced an alias too early, or misspelled
something. `42803` is "grouping error" — the column exists but is neither a grouping key
nor inside an aggregate. Reading which one you got tells you which mistake you made.

---

← [What you are allowed to select](03-what-you-can-select.md) · Next → [How it executes](05-how-it-executes.md)
