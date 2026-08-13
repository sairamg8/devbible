---
title: "ON vs WHERE"
sidebar_label: "02 · ON vs WHERE"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 on **PostgreSQL 18.4** (`postgres:18-alpine`, `127.0.0.1:55432`),
> **Node 24.19.0**, `pg` 8.23.0. Script: `sandbox/pg-api/ex35-joins.mjs`.

**For an inner join, `ON` and `WHERE` are interchangeable and the planner moves conditions
between them freely. For an outer join they mean different things, and putting a
right-table condition in `WHERE` silently converts it back to an inner join.**

## The measurement

The same query, filtered to paid orders, differing only in which clause holds the filter:

```sql
-- WHERE: evaluated AFTER the join has NULL-extended the unmatched rows
SELECT c.name, o.id FROM j_customers c
LEFT JOIN j_orders o ON o.customer_id = c.id
WHERE o.status = 'paid' ORDER BY c.id;

-- ON: part of the match rule itself
SELECT c.name, o.id FROM j_customers c
LEFT JOIN j_orders o ON o.customer_id = c.id AND o.status = 'paid'
ORDER BY c.id;
```

```console
$ node ex35-joins.mjs
filter in WHERE          : [{"name":"Ann","id":10},{"name":"Bob","id":12}]
  ^ Dee vanished: WHERE on the right table drops the NULL-extended rows
filter in ON             : [{"name":"Ann","id":10},{"name":"Bob","id":12},
                            {"name":"Cid","id":null},{"name":"Dee","id":null}]
  ^ Dee and Cid kept, with NULL - the filter belongs in ON
```

**Two rows against four**, from a one-word difference. Note that the `WHERE` version lost
*two* customers, not one: Dee, who has no orders at all, and **Cid**, whose order exists
but is `cancelled`. The second loss is the more insidious — Cid genuinely has data, and a
query titled "customers and their paid orders" has silently become "customers who have a
paid order".

## Why: the order the clauses run in

The logical evaluation order is fixed, whatever order you write the clauses:

```
FROM (including all JOIN … ON)  →  WHERE  →  GROUP BY  →  HAVING  →  SELECT  →  ORDER BY
```

`ON` belongs to the `FROM` stage. It participates in *matching*, so a left row that fails
it simply produces no pair — and the outer join then rescues that row by NULL-extending it.
The guarantee is honoured.

`WHERE` runs afterwards, on the finished join output. By then Dee's row exists as
`('Dee', NULL, NULL, NULL)`, and the predicate is evaluated against it:

```sql
NULL = 'paid'   →   NULL
```

Not `false` — `NULL`. And `WHERE` keeps a row only when the predicate is **true**, so
`NULL` is discarded exactly like `false`. The row the outer join went to the trouble of
manufacturing is thrown away one stage later. This is
[three-valued logic](../../phase-2-types/06-null.md) doing precisely what it is defined to
do; nothing here is a special case for joins.

That also explains why the bug is invisible to testing that uses only matched fixtures: if
every left row has a matching right row, `ON` and `WHERE` produce identical results. The
divergence only appears with unmatched data.

## The classification rule

Every predicate in an outer join belongs to one of three categories. Learn to classify on
sight:

| Predicate on… | Belongs in | Because |
|---|---|---|
| the **right** table | `ON` | in `WHERE` it discards NULL-extended rows and cancels the join |
| the **left** table | `WHERE` | in `ON` it does nothing useful — a failing left row is kept anyway, just NULL-extended |
| **both** tables (the join key) | `ON` | it *is* the match rule |

The middle row surprises people. Putting a left-table condition in `ON`:

```sql
FROM j_customers c
LEFT JOIN j_orders o ON o.customer_id = c.id AND c.country = 'GB'
```

does not filter customers at all. Non-GB customers still appear — they simply fail to
match and come back NULL-extended. The query returns every customer, which is almost never
what someone writing that meant. Left-table filters go in `WHERE`.

For an **inner** join none of this matters: with no rows to preserve, a condition in either
clause removes the same rows, and the planner pushes predicates around freely by cost. This
is why the habit "filters go in WHERE" survives for years before failing — it is correct
until the first `LEFT JOIN`.

## The other ways to cancel an outer join

The `WHERE` filter is the common one, but anything that evaluates the NULL-extended row and
rejects it has the same effect:

**An inner join further down the chain.**

```sql
FROM a
LEFT JOIN b ON b.a_id = a.id
JOIN c ON c.b_id = b.id     -- ← cancels the LEFT JOIN
```

`c.b_id = NULL` is NULL, so rows where `b` was NULL-extended match nothing and drop out.
Fix by making the downstream join `LEFT` too, or by parenthesising the inner pair so it
joins as a unit — [multi-table joins](../04-multi-join.md).

**A negated or comparison predicate in `WHERE`.**

```sql
WHERE o.status <> 'cancelled'   -- NULL <> 'cancelled' is NULL → row dropped
```

The intent is usually "no order, or an order that is not cancelled", which must be written
explicitly:

```sql
WHERE o.id IS NULL OR o.status <> 'cancelled'
-- or, better, put it in ON:
LEFT JOIN j_orders o ON o.customer_id = c.id AND o.status <> 'cancelled'
```

**A `HAVING` predicate on the outer-joined table** behaves the same way, and for the same
reason: `HAVING` runs after the join and after the grouping, so a condition on `o.status`
there discards the null-extended row exactly as a `WHERE` would. Moving a filter from
`WHERE` to `HAVING` does not rescue an outer join — only moving it into `ON` does, because
`ON` is the only one of the three that runs *while* the join is being formed.

The one predicate that is *safe* in `WHERE` is the deliberate `IS NULL` anti-join test,
because `IS NULL` returns true rather than NULL for the manufactured row.

## Diagnosing it in an existing query

Three checks, in order of speed:

1. **Read every `WHERE` conjunct and name its table.** Any that names the outer-joined
   table is a suspect.
2. **Count with and without.** Drop the suspect predicate and compare row counts against
   `count(*)` on the left table alone. If the full query returns fewer rows than the left
   table has, the outer join is not delivering its guarantee.
3. **Read the plan.** `EXPLAIN` reports the join node's actual type: a `Hash Join` where
   you wrote `LEFT JOIN` means the planner proved the outer part redundant and rewrote it —
   which is a definitive answer, since it only does that when a `WHERE` clause makes the
   NULL-extended rows unreachable.

That third check is worth internalising. PostgreSQL does not warn you, but it does record
what it did, and the node name is the evidence.

## From Node

```js
const {rows} = await pool.query(
  `SELECT c.id, c.name, count(o.id)::int AS paid_orders
   FROM j_customers c
   LEFT JOIN j_orders o
          ON o.customer_id = c.id
         AND o.status = $1
         AND o.created_at >= $2
   WHERE c.country = $3
   GROUP BY c.id, c.name
   ORDER BY c.id`,
  ['paid', since, country],
);
```

Every right-table condition — status *and* date range — sits in `ON`, so every GB customer
appears with a count, zero included. The left-table filter sits in `WHERE`, where it does
filter. Parameters work identically in `ON` and `WHERE`; there is nothing special about
placeholders in a join condition.

A useful review habit for this shape: if a query has a `LEFT JOIN` and the endpoint's name
contains "all", check that no right-table column appears in `WHERE`.

## Trade-off

Putting conditions in `ON` keeps the outer join's guarantee, at the cost of a join
condition that is doing two jobs — matching and filtering — which is more to read and
occasionally harder for the planner to estimate. The alternative shapes (filtering the
right table in a subquery or CTE first, then joining) separate the concerns and can plan
better when the filter is very selective, at the cost of another named intermediate. Both
are defensible; what is not defensible is a right-table filter in `WHERE` on an outer join,
which is simply a different query from the one intended.

## Gotchas

**Symptom:** A LEFT JOIN returns exactly the rows an INNER JOIN would
**Cause:** A condition on the right table sits in `WHERE`
**Fix:** Move it into `ON` — two rows became four in the measurement

**Symptom:** Rows disappear when you add `AND right.col <> 'x'`
**Cause:** `NULL <> 'x'` is NULL, not true, so NULL-extended rows fail it
**Fix:** Move it to `ON`, or write `(right.id IS NULL OR right.col <> 'x')`

**Symptom:** A left-table condition in `ON` does not filter anything
**Cause:** Failing left rows are kept and NULL-extended rather than removed
**Fix:** Left-table conditions belong in `WHERE`

**Symptom:** A `LEFT JOIN` in the middle of a chain behaves like an inner join
**Cause:** A later inner join filters out the NULL-extended rows
**Fix:** Make the downstream join `LEFT`, or parenthesise the inner pair

**Symptom:** The plan shows `Hash Join` where the query says `LEFT JOIN`
**Cause:** The planner proved the outer part unreachable because of a `WHERE` predicate
**Fix:** That is the diagnosis — find the predicate and move it to `ON`

**Symptom:** Tests pass, production data is wrong
**Cause:** Fixtures have a matching row for every left row, so `ON` and `WHERE` agree
**Fix:** Include an unmatched row in the fixture — Dee exists for exactly this reason

## Interview questions

**★ What is the difference between a condition in `ON` and the same condition in `WHERE`?**
For an inner join, none — the planner moves them freely. For an outer join it changes the
result: `ON` is part of the match rule, so unmatched left rows are still emitted
NULL-extended; `WHERE` runs after the join and discards those rows, cancelling the outer
join. Measured: 4 rows with `ON`, 2 with `WHERE`.

**★ Why does the `WHERE` version drop the row rather than keep it?**
Because the predicate evaluates to NULL, not false — `NULL = 'paid'` is unknown — and
`WHERE` keeps only rows where the predicate is true. Unknown is discarded like false.

**★ Where does a condition on the *left* table of a LEFT JOIN belong?**
`WHERE`. In `ON` it has no filtering effect at all: a left row that fails it is still
emitted, just NULL-extended. This is the half of the rule people miss.

**★ Write "every GB customer with their paid-order count, including zeros".**
`LEFT JOIN orders o ON o.customer_id = c.id AND o.status = 'paid'`, `WHERE c.country = 'GB'`,
`count(o.id)`. Right-table filter in `ON`, left-table filter in `WHERE`, count over a
column.

**How would you spot this bug in code review without running anything?**
Any right-table column appearing in the `WHERE` of a query with an outer join. Confirm by
checking whether the plan node is a `Hash Join` rather than a `Hash Left Join`.

**Why do tests often miss it?**
Fixtures usually give every parent a child, and with no unmatched rows `ON` and `WHERE`
return identical results. The bug needs an unmatched row to appear.

---

← [The guarantee and its NULLs](01-null-extension.md) · Next → [Semi and anti joins](../semi-anti/)
