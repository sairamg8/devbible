---
title: "One statement, several writes"
sidebar_label: "01 · One statement, several writes"
sidebar_position: 1
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 on **PostgreSQL 18.4** (`postgres:18-alpine`, `127.0.0.1:55432`),
> **Node 24.19.0**, `pg` 8.23.0. Script: `sandbox/pg-api/ex37-cte-subquery.mjs`.

**A CTE may contain `INSERT`, `UPDATE`, `DELETE` or `MERGE`, not just `SELECT`. With
`RETURNING` feeding the next step, a move-then-record operation that would otherwise be
three statements and a transaction becomes one statement — atomic by construction, one
round trip, and no window in which a crash leaves the work half done.**

## The archive pattern

Move rows out of a live table and into an archive, in one statement:

```sql
WITH moved AS (
  DELETE FROM agg_orders WHERE status = 'cancelled' RETURNING *
)
INSERT INTO agg_archive SELECT * FROM moved
RETURNING id, status;
```

```console
before                  : [{"orders":6}]
move cancelled to archive: [{"id":13,"status":"cancelled"}]
after                   : [{"orders":5,"archived":1}]
```

The `DELETE` produces the rows it removed, and the `INSERT` consumes them. Six orders
became five, and one row landed in the archive. **There is no moment at which the row
exists in neither table, or in both** — one statement is one atomic unit, so a crash
between the delete and the insert is not a state the database can be left in.

This is the canonical use, and it generalises to anything shaped *"take these rows out of
here and put a record of them somewhere else"*: archiving, moving to a dead-letter table,
draining a queue table, promoting staged rows into a live one.

## `RETURNING` is what makes it a pipeline

Only `RETURNING` exposes what a write did. Without it, a data-modifying CTE produces no
rows to chain from:

```sql
WITH up AS (
  INSERT INTO agg_orders (id, customer_id, status, total, coupon, placed_at)
  VALUES (13, 3, 'cancelled', 0, NULL, '2026-03-04 08:05+00')
  ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status
  RETURNING id, (xmax = 0) AS inserted
)
INSERT INTO agg_audit (what, order_id)
SELECT CASE WHEN inserted THEN 'insert' ELSE 'update' END, id FROM up
RETURNING what, order_id;
```

```console
upsert + audit in one   : [{"what":"insert","order_id":13}]
```

Two useful things in one statement:

- **An upsert that reports which branch it took.** `xmax = 0` is true for a freshly
  inserted row and false for one that came back through `DO UPDATE` — the standard trick
  for telling insert from update, [measured in phase 4](../../phase-4-crud/06-on-conflict.md).
  The audit row correctly says `insert`, because the earlier `DELETE` had removed order 13.
- **The audit written from the same statement as the change it records.** There is no path
  where the order changes and the audit row does not.

## `WITH` goes on the writing statement too

The examples above attach `WITH` to an `INSERT`. All four write statements accept it, and
the CTE list is evaluated for the statement as a whole:

```sql
WITH pick AS (SELECT id FROM agg_orders ORDER BY id LIMIT 1)
UPDATE agg_orders SET total = total
WHERE id IN (SELECT id FROM pick)
RETURNING id;
```

This is the standard answer to *"delete/update only N rows"*, because `DELETE` and
`UPDATE` take no `LIMIT` of their own — `DELETE ... LIMIT 100` is `42601`,
[measured in phase 4](../../phase-4-crud/11-delete.md). Choose the rows in a CTE, then
match on the result. For a batching loop the `ctid` variant is cheaper, and the same page
covers why batching a large delete is 4.2× slower than one statement and still the right
practice.

## An unreferenced data-modifying CTE still runs

This is the sharpest difference from a plain CTE:

```sql
WITH dead AS (
  INSERT INTO agg_audit (what, order_id) VALUES ('unreferenced', 99) RETURNING id
)
SELECT 1 AS ignored;
```

```console
a CTE nobody references still runs           ok  rows=1 [{"ignored":1}]
  audit rows            : [{"what":"probe","order_id":10},{"what":"insert","order_id":13},{"what":"unreferenced","order_id":99}]
```

**The row is there.** Nothing in the outer query mentions `dead`, and the write happened
anyway. A `SELECT`-only CTE that nobody references is dead code the planner can discard; a
data-modifying one is a side effect the statement promises to perform, so it is executed
exactly once whether or not anyone reads it.

That cuts both ways. It is how you write *"do this write, and return something unrelated"*
in a single statement — and it is how an editor who deletes the reference but not the CTE
leaves a write running that no longer looks connected to anything.

## Always a fence, never inlined

A data-modifying CTE is one of the five exclusions from
[the inlining rule](../09-ctes/02-the-inlining-rule.md):

```console
1 reference, data-modifying                          MATERIALIZED (fenced)
```

It is materialized whether you ask or not, and `NOT MATERIALIZED` will not change it —
inlining a write would mean executing it once per reference, which would change what the
statement does. So the cost model for these is simple: each write CTE runs once, in full,
and its `RETURNING` rows are held in a tuplestore for whoever reads them.

## In Node

The whole point is that this is **one** `pool.query` call, so it needs no explicit
transaction and cannot be interrupted midway:

```js
const {rows} = await pool.query(
  `WITH moved AS (
     DELETE FROM agg_orders
     WHERE status = 'cancelled' AND placed_at < $1
     RETURNING *
   ),
   archived AS (
     INSERT INTO agg_archive SELECT * FROM moved RETURNING id
   )
   INSERT INTO agg_audit (what, order_id)
   SELECT 'archived', id FROM archived
   RETURNING order_id`,
  [cutoff],
);
```

- **No `BEGIN`/`COMMIT` needed.** A single statement is already atomic. Wrapping it in a
  transaction adds nothing unless other statements must share the same unit of work.
- **No pooled-client checkout needed either.** Because it is one statement, `pool.query` is
  correct — you only need `pool.connect()` when several statements must run on the same
  connection, which is where the release-in-`finally` discipline matters
  ([phase 7](../../phase-7-pg-driver/07-connect-release.md)).
- **`rowCount` reflects the outermost statement only.** The rows returned are the final
  `RETURNING`'s. If you need counts from an inner write, return them explicitly — a
  `SELECT count(*) FROM moved` in a later CTE, for instance.

## Trade-off

You buy atomicity without a transaction, one round trip instead of three, and a written
guarantee that the audit cannot drift from the change it records. What you pay is that the
statement is now doing several things whose relative order is not something you control or
can read off the page — and the rules for what each part *sees* are not the ones intuition
supplies. Those rules are the subject of [the next chunk](02-the-snapshot-rule.md), and
they are where the real bugs live. Keep these statements short enough that the whole
pipeline fits in your head; a five-CTE write chain is a correctness review every time it
is edited.

## Gotchas

**Symptom:** a write happens that nothing in the query appears to reference
**Cause:** an unreferenced data-modifying CTE still executes — unlike a `SELECT` CTE, it is
a promised side effect
**Fix:** delete the CTE, not just the reference to it. Measured: an `INSERT` CTE nobody
referenced still added its row

**Symptom:** `RETURNING` was omitted and the next CTE has nothing to consume
**Cause:** a write exposes its rows only through `RETURNING`
**Fix:** add `RETURNING` — `RETURNING *` while developing, then narrow it

**Symptom:** `DELETE ... LIMIT 100` fails with `42601`
**Cause:** `DELETE` and `UPDATE` take no `LIMIT`
**Fix:** select the rows in a CTE and match on that, or use the `ctid IN (SELECT ctid …
LIMIT n)` form for batching

**Symptom:** `NOT MATERIALIZED` on a write CTE appears to be ignored
**Cause:** it is. Data-modifying CTEs are always fenced, because inlining would run the
write once per reference
**Fix:** nothing to fix; remove the hint so it does not mislead the next reader

**Symptom:** the outer `rowCount` is not the number of rows written
**Cause:** it counts the outermost statement's rows, not the inner CTEs'
**Fix:** return the inner counts explicitly if the caller needs them

## Interview questions

**★ How do you move rows between tables atomically in one statement?**
A data-modifying CTE: `WITH moved AS (DELETE … RETURNING *) INSERT INTO archive SELECT *
FROM moved`. One statement is one atomic unit, so there is no window where the row is in
neither table or both. Measured: 6 orders → 5, with 1 archived.

**★ Does a data-modifying CTE run if nothing references it?**
Yes. A `SELECT` CTE that nobody references can be discarded; a write is a promised side
effect and executes exactly once regardless. Measured — the `INSERT` landed with the outer
query selecting a literal.

**★ Can a data-modifying CTE be inlined?**
No, never. It is one of the exclusions from the inlining rule, and `NOT MATERIALIZED`
cannot override it, because inlining would execute the write once per reference.

**★ Do you need a transaction around a multi-CTE write?**
No. A single statement is already atomic. You need an explicit transaction only when other
statements must be part of the same unit of work.

**How do you tell whether an upsert inserted or updated?**
`RETURNING (xmax = 0) AS inserted` — true for a fresh insert, false for a row that came
through `ON CONFLICT DO UPDATE`. Feeding that into an audit CTE records which branch ran in
the same statement as the change.

**Why does `DELETE` need a CTE to get a `LIMIT`?**
Because it does not support one (`42601`). The rows are chosen by a `SELECT` — which does
support `LIMIT` — inside a CTE, and the `DELETE` matches on that result.

---

← [Topic index](README.md) · Next → [The snapshot rule](02-the-snapshot-rule.md)
