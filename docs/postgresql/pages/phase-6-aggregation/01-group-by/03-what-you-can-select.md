---
title: "What you are allowed to select"
sidebar_label: "03 · What you can select"
sidebar_position: 3
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 on **PostgreSQL 18.4** (`postgres:18-alpine`, `127.0.0.1:55432`),
> **Node 24.19.0**, `pg` 8.23.0. Scripts: `sandbox/pg-api/ex36-aggregation.mjs`,
> `sandbox/pg-api/ex36c-agg-checks.mjs`.

**Once you write `GROUP BY`, the select list is no longer free. Every expression must
reduce to one value per group — either because it is the grouping key, or because an
aggregate folded it. PostgreSQL enforces this and refuses to guess; the error is
`42803`, and it is the most-seen SQL error in this phase.**

## The rule and the error

```sql
SELECT status, total FROM agg_orders GROUP BY status;
```

```console
select a non-grouped column -> 42803 column "agg_orders.total" must appear in the
                               GROUP BY clause or be used in an aggregate function
```

There are three orders in the `paid` group, with totals 100, 200 and 200. The query
asks for "the total" of that group. There isn't one. PostgreSQL will not pick
arbitrarily on your behalf.

This is a genuine difference from MySQL, where the same query runs by default in older
configurations and returns *some* row's value — a behaviour that produces reports which
are internally inconsistent (the `status` from one row, the `total` from another) and
almost impossible to debug, because they look fine. `ONLY_FULL_GROUP_BY` exists in
MySQL to switch the strictness back on. PostgreSQL has no such setting because it never
had the loose mode.

The same error from a different direction:

```console
select a bare column with GROUP BY -> 42803 column "agg_orders.coupon" must appear in
                                     the GROUP BY clause or be used in an aggregate function
```

## The four ways out

Every fix is one of these, and choosing between them is a modelling decision, not a
syntax one:

| You want | Write |
|---|---|
| one row per `(status, total)` pair | add it to `GROUP BY` |
| a representative value | `min(total)`, `max(total)`, `(array_agg(total ORDER BY id))[1]` |
| all the values | `array_agg(total)`, `jsonb_agg(...)` — see [json_agg](../json-agg/) |
| one whole row per group | `DISTINCT ON`, or a `row_number()` window |

The first is the one to be suspicious of. Adding a column to `GROUP BY` to silence the
error **changes the grouping**, and therefore the row count and every aggregate in the
query. It compiles, it runs, and the numbers are now answering a different question.

### "A representative value" usually is not

```sql
SELECT status, min(coupon) AS a_coupon, count(*)::int
FROM agg_orders GROUP BY status ORDER BY status;
```

```console
...wrapped in an aggregate instead  ok  rows=3
  [{"status":"cancelled","a_coupon":null,"count":1},
   {"status":"open","a_coupon":null,"count":2},
   {"status":"paid","a_coupon":"SPRING","count":3}]
```

The `paid` group reports `SPRING`, even though `WELCOME` appears **twice** in it and
`SPRING` once. `min()` over text is alphabetical; it was never "a representative
value". And the `open` group reports `null` — not because there is no coupon, but
because `min` skipped the `NULL`s and there was nothing left.

If you meant "the coupon from the highest-value order", say that:

```sql
SELECT DISTINCT ON (status) status, id, total
FROM agg_orders ORDER BY status, total DESC NULLS LAST;
```

```console
DISTINCT ON for a whole row per group  ok  rows=3
  [{"status":"cancelled","id":13,"total":0},
   {"status":"open","id":11,"total":50},
   {"status":"paid","id":12,"total":200}]
```

`DISTINCT ON` is the PostgreSQL-specific answer to "one whole row per group", and its
advantage over assembling columns with separate aggregates is **consistency**: every
column comes from the same row. `min(id), max(total)` could report an `id` and a
`total` that never appeared together.

Two rules for `DISTINCT ON`: the `ORDER BY` must *start* with the `DISTINCT ON`
expressions, and whatever follows decides which row wins. Without the trailing sort
key the winner is arbitrary — the same "no unique tiebreaker" failure as
[unstable pagination](../../phase-4-crud/03-limit-offset.md). Note `NULLS LAST` above:
without it, order 15's `NULL` total would have sorted first under `DESC` and won its
group. Full treatment on [DISTINCT ON](../../phase-4-crud/12-distinct-on.md); the
general N-per-group version is on [ranking](../ranking/).

## Functional dependency: grouping by a primary key

The rule has a documented exception that is genuinely useful:

```sql
SELECT o.id, o.status, count(i.id)::int
FROM agg_orders o LEFT JOIN agg_items i ON i.order_id = o.id
GROUP BY o.id;
```

```console
group by the PK, select others  ok  rows=6
  [{"id":10,"status":"paid","count":2},
   {"id":13,"status":"cancelled","count":0},
   {"id":11,"status":"open","count":1}]
```

`o.status` is not in the `GROUP BY`, and the query is still legal. Grouping by a
table's **primary key** functionally determines every other column of that table —
there is exactly one `agg_orders` row per group, so "the status of the group" is
unambiguous. PostgreSQL implements this properly: it checks the declared `PRIMARY KEY`
constraint, not merely that the data happens to be unique.

This is what makes the standard list-with-counts query readable:

```sql
SELECT c.id, c.name, c.country, c.plan, count(o.id)::int AS orders
FROM agg_customers c LEFT JOIN agg_orders o ON o.customer_id = c.id
GROUP BY c.id;
```

```console
two tables, group by one PK  ok  rows=5
  [{"id":3,"name":"Cid","count":"1"},{"id":5,"name":"Eve","count":"0"},
   {"id":4,"name":"Dee","count":"1"},…]
```

Without functional dependency you would repeat all four columns in the `GROUP BY`, and
adding a fifth column to the table would mean editing every such query. Note `Eve` at
`0` — that is `count(o.id)`, not `count(*)`, and the difference is the subject of
[count variants](../count-variants/).

### Its limits

**It applies per table, and only to that table's own columns.** Group by the *other*
side's key and you are back to the error:

```console
...group by the OTHER table PK instead -> 42803 column "c.id" must appear in the
                                          GROUP BY clause or be used in an aggregate function
```

Grouping by `o.id` says nothing about which `c.id` belongs to the group — many orders
could in principle map to one customer, so the dependency runs the other way.

Three more limits worth knowing:

- It needs a declared **`PRIMARY KEY`**. A `UNIQUE` index alone does not license it,
  because a unique column can be `NULL` and `NULL`s group together.
- It is lost when the key stops being visible to the planner — inside a view or
  subquery that does a `UNION`, a `DISTINCT`, or a set-returning function, you are back
  to listing columns by hand.
- It does not extend across a join: grouping by `c.id` licenses `c.*`, never `o.*`.

## Trade-off

The `42803` rule costs keystrokes on every list-with-counts query and buys the
guarantee that no report can mix columns from different rows. That is a good trade, and
functional dependency removes most of the cost. The remaining cost is real: `GROUP BY
c.id` works only because a primary key is declared and visible, so the moment the query
moves inside a view that unions two sources, it breaks — and it breaks at the point
where the query is hardest to read.

## Gotchas

**Symptom:** `42803 column "x" must appear in the GROUP BY clause`
**Cause:** the select list asks for a value that is not one-per-group
**Fix:** pick deliberately among the four outs. Do **not** add the column to `GROUP BY`
reflexively — that changes the grouping, the row count, and every aggregate in the
query, silently

**Symptom:** the query ran fine in MySQL and errors in PostgreSQL
**Cause:** MySQL's non-`ONLY_FULL_GROUP_BY` mode picks an arbitrary row's value
**Fix:** the PostgreSQL error is correct — the MySQL result was mixing columns across
rows. Rewrite with `DISTINCT ON` or an explicit aggregate, and check whether the old
report was ever right

**Symptom:** `min(some_text_column)` returns a value that makes no business sense
**Cause:** `min`/`max` over text is alphabetical, and it skips `NULL`s
**Fix:** use `DISTINCT ON` or `row_number()` when you want "the row that wins by a
rule". Measured: `min(coupon)` reported `SPRING` for a group where `WELCOME` occurred
twice as often

**Symptom:** a "top row per group" query returns a row that never existed
**Cause:** columns were assembled from separate aggregates — `min(id)` and `max(total)`
can come from different rows
**Fix:** `DISTINCT ON`, which takes every column from one row

**Symptom:** `DISTINCT ON` picks the wrong row, intermittently
**Cause:** the `ORDER BY` after the `DISTINCT ON` expressions is missing or not unique,
so the winner is whichever row the scan produced first
**Fix:** add a deterministic sort key, and `NULLS LAST` if the sort column is nullable
— otherwise a `NULL` sorts first under `DESC` and wins

**Symptom:** `GROUP BY c.id` worked until the query was moved inside a view with a
`UNION`
**Cause:** functional dependency needs a visible declared primary key, which a set
operation loses
**Fix:** list the columns explicitly, or group in the inner query where the key is
still visible

## Interview questions

**★ Why does PostgreSQL reject `SELECT status, total FROM t GROUP BY status` when MySQL
historically allowed it?**
Because the group has several `total` values and no rule for choosing one. MySQL's
loose mode returned an arbitrary row's value, producing reports that silently mix
columns from different rows. `ONLY_FULL_GROUP_BY` is MySQL adopting the strict
behaviour; PostgreSQL never had the loose one.

**★ Then why is `SELECT c.id, c.name, count(*) … GROUP BY c.id` legal?**
Functional dependency. `c.id` is the declared primary key, so there is exactly one
`agg_customers` row per group and every other column *of that table* is determined. It
works per table only — grouping by `o.id` does not license `c.id`, which was measured
as `42803`.

**★ Does a `UNIQUE` constraint give you the same licence as a `PRIMARY KEY`?**
No. A unique column can be `NULL`, and `NULL`s group together, so uniqueness alone does
not guarantee one row per group. PostgreSQL requires a declared primary key.

**★ You need one whole row per group — the newest order per customer. `min`/`max` or
something else?**
Something else. Assembling columns from separate aggregates can return a combination
that never existed in any row. Use `DISTINCT ON (customer_id) … ORDER BY customer_id,
placed_at DESC`, or `row_number()` if you need more than one per group.

**Someone silences a `42803` by adding the column to `GROUP BY`. What did that change?**
The grouping key, and therefore the number of groups, the row count, and every
aggregate in the query. The error is gone and the answer is now to a different
question — which is worse than the error, because nothing fails.

---

← [Empty groups and grouping keys](02-empty-groups-and-keys.md) ·
Next → [Ordinals, aliases and DISTINCT](04-ordinals-and-distinct.md)
