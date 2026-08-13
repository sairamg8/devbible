---
title: "Anti joins and the NOT IN trap"
sidebar_label: "02 · Anti joins"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 on **PostgreSQL 18.4** (`postgres:18-alpine`, `127.0.0.1:55432`),
> **Node 24.19.0**, `pg` 8.23.0. Script: `sandbox/pg-api/ex35-joins.mjs`.

**An anti join keeps the left rows with no match. `NOT EXISTS` implements it correctly and
gets a dedicated plan node. `NOT IN` looks equivalent, and returns the empty set the moment
the subquery contains one NULL — silently, with no error.**

## The correct form

```sql
SELECT c.name FROM j_customers c
WHERE NOT EXISTS (SELECT 1 FROM j_orders o WHERE o.customer_id = c.id);
```

```console
$ node ex35-joins.mjs
NOT EXISTS (anti join)   : [{"name":"Dee"}]
```

Dee is the only customer with no orders. Structurally this is the semi join negated: probe
for a match, and keep the left row precisely when none is found.

## The trap

Insert one order whose `customer_id` is NULL — a perfectly ordinary thing for a nullable
foreign key — then run both forms. This is the orphan row [the fixture
documents](../inner-join/#the-fifth-order-added-part-way-through); from here on the phase has
five orders, and re-running the insert is not needed if you already added it:

```sql
INSERT INTO j_orders VALUES (14, NULL, 'open', 5, '2026-03-05 16:20+00');

SELECT c.name FROM j_customers c
WHERE NOT EXISTS (SELECT 1 FROM j_orders o WHERE o.customer_id = c.id);

SELECT c.name FROM j_customers c
WHERE c.id NOT IN (SELECT customer_id FROM j_orders);
```

```console
after adding an order with customer_id = NULL:
  NOT EXISTS             : [{"name":"Dee"}]
  NOT IN                 : []
  ^ NOT IN returned NOTHING - one NULL poisoned the whole predicate
  NOT IN with NULLs filtered: [{"name":"Dee"}]
```

**`NOT IN` returned the empty set.** Not an error, not a warning — an empty, entirely
plausible-looking result. A "customers who have never ordered" report would simply show
nobody, and the natural reading of that is "great, everyone has ordered".

### Why, from the expansion

`NOT IN` is defined as a chain of inequalities. With the subquery yielding
`(1, 2, 3, NULL)`, the predicate for Dee (`id = 4`) expands to:

```sql
4 <> 1 AND 4 <> 2 AND 4 <> 3 AND 4 <> NULL
true    AND true    AND true    AND NULL     →  NULL
```

The last conjunct is `NULL` for **any** value of the left side, because nothing is known to
be unequal to an unknown. `true AND NULL` is `NULL`, so the whole chain collapses to
`NULL`, and `WHERE` keeps only rows where the predicate is `true`. Every candidate row
fails, whatever its value.

Note the asymmetry with the positive form. `IN` is a chain of `OR`s, so a NULL among them
is harmless when some other branch is `true` — `4 IN (4, NULL)` is `true`. That is why
`IN` behaves sanely and `NOT IN` does not, and why the bug survives review by people who
have verified that `IN` works fine.

This is just [three-valued logic](../../phase-2-types/06-null.md) applied to a set; there
is no special join rule involved.

### It also costs you the plan node

```console
NOT EXISTS: Parallel Hash Anti Join (actual time=23.381..57.848 rows=50000.00 loops=2) 70.651 ms
NOT IN    : Parallel Seq Scan on j_big_a a (actual time=42.069..68.323 rows=50000.00 loops=2) 81.261 ms
```

`NOT EXISTS` gets a **`Parallel Hash Anti Join`** — a first-class operation. `NOT IN` gets
a **`Parallel Seq Scan`** with a subplan, because the planner cannot use an anti-join node
without first proving the column has no NULLs. On this data the times are close, but the
shapes are not equivalent: the anti-join node scales with a hash build, while the subplan
form is materially worse when it cannot be flattened.

Declaring the column `NOT NULL` lets the planner use the better node *and* removes the
correctness problem — but relying on that means every future migration that relaxes the
constraint silently re-introduces a data-loss bug in a query far away.

**Use `NOT EXISTS`.** It compares row by row, so a NULL row simply fails to match and
affects nothing else.

## If you cannot change the `NOT IN`

Generated SQL, a view you do not own, a migration you would rather not touch — filter the
NULLs inside the subquery:

```sql
SELECT c.name FROM j_customers c
WHERE c.id NOT IN (SELECT customer_id FROM j_orders WHERE customer_id IS NOT NULL);
```

```console
  NOT IN with NULLs filtered: [{"name":"Dee"}]
```

Correct again. Treat it as a patch, not a pattern — the next person to edit the subquery
has to know why that `WHERE` is there, so it needs a comment.

## The four ways to write an anti join

| Form | Plan node | Verdict |
|---|---|---|
| `NOT EXISTS (…)` | `Hash Anti Join` | **the default** — correct with NULLs, best node |
| `LEFT JOIN … WHERE r.pk IS NULL` | `Hash Anti Join` | equivalent; older idiom, and breaks if you test a nullable column |
| `EXCEPT` | `HashSetOp` | different semantics — de-duplicates the left side and compares whole rows |
| `NOT IN (…)` | `Seq Scan` + subplan | **avoid** — silently empty on any NULL |

The `LEFT JOIN … IS NULL` form is worth being able to read, since it is everywhere in
older code, and PostgreSQL does plan it as an anti join. It is nonetheless more fragile:
the correctness depends on the tested column being `NOT NULL` in the right table, which the
query text does not show, whereas `NOT EXISTS` has no such dependency.

`EXCEPT` is a genuinely different operation — it compares entire result rows and removes
duplicates from the left side ([set operations](../11-set-ops.md)). It answers "which of
these rows are not in that set", not "which left rows have no related row".

## Indexing

An anti join must prove the *absence* of a match, so it cannot short-circuit the way a semi
join does on a hit — for a left row with no match, every candidate must be ruled out. That
makes the index on the child's correlated column more important here, not less:

```sql
CREATE INDEX ON j_orders (customer_id);
```

This is the same unindexed-foreign-key problem
[Phase 10](../../phase-10-indexes/18-fk-indexes.md) measures, and anti joins are where its
absence hurts most. When both sides are large, expect and want a `Hash Anti Join` rather
than a nested loop — check with `EXPLAIN` that you are getting one.

## From Node

```js
// customers with no order since a cutoff — note the condition is INSIDE the subquery
const {rows} = await pool.query(
  `SELECT c.id, c.name
   FROM j_customers c
   WHERE NOT EXISTS (SELECT 1 FROM j_orders o
                     WHERE o.customer_id = c.id
                       AND o.created_at >= $1)
   ORDER BY c.id`,
  [since],
);
```

Placing `created_at >= $1` inside the subquery makes it "has no *recent* order", which
includes customers with only old orders. Moving it outside would not compile — `o` is not
in scope — and moving it to a `LEFT JOIN`'s `WHERE` would cancel the join, which is the
same class of bug as [ON vs WHERE](../02-left-join/02-on-vs-where.md).

## Trade-off

`NOT EXISTS` is correct under every NULL configuration and gets the best plan node, at the
cost of being slightly more verbose than `NOT IN` and requiring an explicit correlation. Its
real cost is computational: proving absence means examining every candidate for the
unmatched rows, so an anti join over two large unindexed tables is expensive in a way a semi
join over the same data is not. When the "not in" set is small, fixed, and known to contain
no NULLs — a literal list of statuses — `NOT IN` on that literal list is fine and reads
better; the danger is specifically `NOT IN (subquery)`.

## Gotchas

**Symptom:** A `NOT IN` query returns zero rows and the data looks fine
**Cause:** One NULL in the subquery column makes the predicate NULL for every row
**Fix:** `NOT EXISTS`. Measured: `[{"name":"Dee"}]` became `[]` from a single NULL

**Symptom:** `NOT IN` worked for months, then started returning nothing
**Cause:** The first NULL arrived in that column — often via a new nullable FK or a soft
delete
**Fix:** `NOT EXISTS`; do not rely on `NOT NULL` staying in place

**Symptom:** `NOT EXISTS` is slow on large tables
**Cause:** No index on the correlated column; absence must be proven for every left row
**Fix:** Index the child FK column and confirm a `Hash Anti Join` in `EXPLAIN`

**Symptom:** `LEFT JOIN … WHERE r.col IS NULL` returns rows that do have matches
**Cause:** The tested column is nullable, so a stored NULL looks like an unmatched row
**Fix:** Test the primary key, or switch to `NOT EXISTS`

**Symptom:** `EXCEPT` gave a different answer from `NOT EXISTS`
**Cause:** `EXCEPT` compares whole rows and de-duplicates the left side
**Fix:** Use it only for genuine set difference between two result sets

## Interview questions

**★ Why is `NOT IN` with a subquery dangerous?**
If the subquery returns any NULL, the predicate is NULL for every candidate row and the
query returns nothing — silently. Measured: one NULL `customer_id` turned
`[{"name":"Dee"}]` into `[]`. `NOT EXISTS` is unaffected.

**★ Explain the NULL behaviour from the definition, not from memory.**
`x NOT IN (a, b, NULL)` expands to `x <> a AND x <> b AND x <> NULL`. The last conjunct is
NULL for any `x`, so the chain is NULL or false, never true, and `WHERE` keeps only true.
The positive `IN` is a chain of `OR`s, where a NULL branch is harmless — which is why `IN`
is safe and `NOT IN` is not.

**★ How do you write an anti join, and what node should the plan show?**
`NOT EXISTS` with a correlated subquery; the plan should show `Hash Anti Join`. `NOT IN`
prevents that node because the planner cannot assume the column is NULL-free, and falls
back to a sequential scan with a subplan.

**★ Why does an anti join benefit more from an index than a semi join?**
A semi join stops at the first match; an anti join must rule out every candidate to prove
absence. Without an index on the child's correlated column, that is a scan per left row.

**What are the alternatives to `NOT EXISTS` and when are they right?**
`LEFT JOIN … WHERE pk IS NULL` is equivalent and plans the same, but its correctness
depends on the tested column being `NOT NULL`. `EXCEPT` is a different operation — whole-row
set difference with de-duplication. `NOT IN` is acceptable only over a literal list you
control.

---

← [Semi joins: EXISTS and IN](01-semi-joins.md) · Next → [Multi-table joins](../04-multi-join.md)
