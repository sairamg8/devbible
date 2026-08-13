---
title: "Semi joins: EXISTS and IN"
sidebar_label: "01 · Semi joins"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 on **PostgreSQL 18.4** (`postgres:18-alpine`, `127.0.0.1:55432`),
> **Node 24.19.0**, `pg` 8.23.0. Script: `sandbox/pg-api/ex35-joins.mjs`.

**A semi join filters the left side by whether a match exists and stops looking after the
first one. The left row is emitted at most once and no right-hand columns come with it —
which is why it structurally cannot fan out, and why it beat the hand-rolled equivalent by
2.5× here.**

## The same query, two spellings

```sql
SELECT c.name FROM j_customers c
WHERE EXISTS (SELECT 1 FROM j_orders o WHERE o.customer_id = c.id) ORDER BY c.id;

SELECT c.name FROM j_customers c
WHERE c.id IN (SELECT customer_id FROM j_orders) ORDER BY c.id;
```

```console
$ node ex35-joins.mjs
=== 3. semi and anti joins — EXISTS, IN, NOT IN, NOT EXISTS ===
EXISTS (semi join)       : [{"name":"Ann"},{"name":"Bob"},{"name":"Cid"}]
IN (also a semi join)    : [{"name":"Ann"},{"name":"Bob"},{"name":"Cid"}]
```

Identical. And **Ann appears once**, though she has two orders — compare the inner join on
[matching pairs](../01-inner-join/01-matching-pairs.md), where she appeared twice. That single
difference is the whole value proposition: the question was "which customers have orders",
and a semi join answers exactly that question without also answering "how many".

## What makes it a *semi* join

The name comes from the output being half of a join's: the left row's columns only.
Operationally:

- **It short-circuits.** Once one match is found for a left row, the rest are not examined.
- **It emits the left row at most once.** No duplication, so no `DISTINCT` is ever needed.
- **It exposes no right-hand columns.** `SELECT o.total` inside an `EXISTS` is not
  available outside it — the subquery is a predicate, not a source of data.

That third point is the boundary. The moment you need something *from* the matched row, a
semi join is the wrong shape and you want a `LEFT JOIN LATERAL … LIMIT 1`
([LATERAL](../10-lateral.md)) or a plain join if fan-out is acceptable.

## Both spellings plan the same

On 200 000 rows against 100 000:

```console
EXISTS    : Parallel Hash Semi Join (actual time=31.579..72.368 rows=50000.00 loops=2) 91.330 ms
IN        : Parallel Hash Semi Join (actual time=23.535..60.066 rows=50000.00 loops=2) 73.367 ms
JOIN+DISTINCT: HashAggregate (actual time=161.007..178.147 rows=100000.00 loops=1) 189.980 ms
```

`EXISTS` and `IN` both get **`Parallel Hash Semi Join`**. The 91 ms against 73 ms gap is
run-to-run noise between identical plan shapes — the node name is what matters, not the
milliseconds. PostgreSQL normalises both into the same internal semi-join operation, so
choosing between them is a readability decision, not a performance one.

Where they differ is NULL handling, and only in the negated forms — `IN` and `EXISTS`
agree, while `NOT IN` and `NOT EXISTS` emphatically do not. That is
[the next chunk](02-anti-joins.md).

A style guideline that holds up: use `EXISTS` when the subquery is correlated (references
the outer row), and `IN` when you have a genuine independent list — `WHERE status IN
('open','paid')` or `WHERE id = ANY($1::int[])`. Writing a correlated condition as `IN`
works but reads backwards.

## The hand-rolled version costs 2.5×

```sql
SELECT count(*) FROM (
  SELECT DISTINCT a.id FROM j_big_a a JOIN j_big_b b ON b.a_id = a.id
) s;
```

**`HashAggregate` at 189.98 ms**, against ~73–91 ms for the semi join. It does exactly the
extra work the shape implies: produce every matching pair, materialise them, then hash them
to throw the duplicates away. The semi join never produces the duplicates in the first
place.

The gap widens with the number of matches per left row. Here `j_big_b` has one row per
matching `a`, so the join produced 100 000 rows to reduce to 50 000. With ten children per
parent it would produce ten times as many rows to discard, while the semi join's cost is
unchanged — it still stops at the first match.

This matters beyond the benchmark because **`JOIN` + `DISTINCT` is what people write when
duplicates surprise them**. A list endpoint returns each customer three times, someone adds
`DISTINCT`, the symptom goes away, and the query is now doing 2.5× the work to undo damage
it did not need to cause. `DISTINCT` also collapses rows that were legitimately identical,
so it can hide real duplication in the data.

## Correlation is what makes `EXISTS` a filter

```sql
-- ✗ not correlated: true whenever j_orders has any row at all
WHERE EXISTS (SELECT 1 FROM j_orders o)

-- ✓ correlated on the outer row
WHERE EXISTS (SELECT 1 FROM j_orders o WHERE o.customer_id = c.id)
```

The first returns every customer, and it is a genuinely easy typo to make when the
correlation line is deleted during editing. The tell is a filter that has no effect at all
rather than one that filters wrongly.

Extra conditions belong **inside** the subquery, where they participate in the existence
test:

```sql
WHERE EXISTS (SELECT 1 FROM j_orders o
              WHERE o.customer_id = c.id
                AND o.status = 'paid'
                AND o.created_at >= $1)
```

That reads as "has at least one paid order since $1", which is what an outer `WHERE` on
`o.status` could not express — `o` is not in scope out there.

`SELECT 1` is conventional and not required: `EXISTS` never evaluates its select list, so
`SELECT *`, `SELECT 1`, and `SELECT 1/0` are all the same. `SELECT 1` signals intent.

## From Node

```js
const {rows} = await pool.query(
  `SELECT c.id, c.name
   FROM j_customers c
   WHERE EXISTS (SELECT 1 FROM j_orders o
                 WHERE o.customer_id = c.id
                   AND o.status = $1)
   ORDER BY c.id`,
  ['paid'],
);
```

One row per customer, guaranteed by the shape rather than by a `DISTINCT` you have to
trust. For the independent-list case, prefer `= ANY($1::int[])` over building
`IN ($1,$2,$3,…)`: one parameter instead of N, no string assembly, and it stays clear of
the 65535-parameter ceiling
([bulk operations](../../phase-8-schema-from-node/04-bulk-insert.md)).

```js
`WHERE c.id = ANY($1::int[])`, [ids]
```

## Trade-off

A semi join is the cheapest way to express "has at least one": it short-circuits, cannot
duplicate, and needs no de-duplication pass. What you give up is access to the matched
row — and that is a hard boundary, not an inconvenience. Queries that start as "which
customers have orders" and grow into "…and show their latest order total" must be
rewritten as a LATERAL or a join, not patched by adding columns to the `EXISTS`. Recognising
that moment early avoids a rewrite under time pressure.

## Gotchas

**Symptom:** Adding `DISTINCT` "fixed" duplicate rows in a list endpoint
**Cause:** An inner join to a one-to-many where only existence was needed
**Fix:** `EXISTS` — no duplicates to remove, and 2.5× faster in the measurement

**Symptom:** An `EXISTS` filter returns every row
**Cause:** The subquery is not correlated to the outer row
**Fix:** Reference the outer table inside it: `WHERE o.customer_id = c.id`

**Symptom:** You need a column from the matched row and it is out of scope
**Cause:** A semi join exposes no right-hand columns, by definition
**Fix:** `LEFT JOIN LATERAL (… ORDER BY … LIMIT 1) ON true`

**Symptom:** `EXISTS` is slow on a large child table
**Cause:** No index on the correlated column, so each probe is a scan
**Fix:** Index the child's FK column
([FK indexes](../../phase-10-indexes/18-fk-indexes.md))

**Symptom:** An `IN` list built by string concatenation breaks past a few thousand ids
**Cause:** One placeholder per element, against a 65535-parameter protocol limit
**Fix:** `= ANY($1::int[])` — a single array parameter

## Interview questions

**★ What is a semi join and how do you write one in PostgreSQL?**
A join that filters the left side by whether a match exists, without emitting the match.
`EXISTS` or `IN`; both plan to `Hash Semi Join`. The left row appears at most once however
many matches there are.

**★ `EXISTS` vs `IN` — is there a performance difference?**
Not for the positive forms: both produced `Parallel Hash Semi Join` on identical data, and
the millisecond gap was noise. Choose by readability — `EXISTS` for correlated conditions,
`IN`/`= ANY` for independent lists. The negated forms differ enormously.

**★ Why is `EXISTS` better than `JOIN` + `DISTINCT`?**
Same answer without materialising duplicates to discard them: `Hash Semi Join` at ~73–91 ms
against `HashAggregate` at 189.98 ms, and the gap grows with children per parent.
`DISTINCT` also hides legitimate duplication.

**Does `SELECT 1` vs `SELECT *` inside `EXISTS` matter?**
No — the select list is never evaluated. `SELECT 1` is a convention that signals the
subquery is a predicate.

**When can a semi join not do the job?**
When you need columns from the matched row. Then it is `LEFT JOIN LATERAL … LIMIT 1`, or a
plain join if the fan-out is acceptable.

---

← [Topic index](README.md) · Next → [Anti joins and the NOT IN trap](02-anti-joins.md)
