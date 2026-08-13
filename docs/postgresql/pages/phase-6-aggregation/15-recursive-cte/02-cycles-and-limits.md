---
title: "Cycles, guards and limits"
sidebar_label: "02 · Cycles, guards and limits"
sidebar_position: 2
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08 on **PostgreSQL 18.4** (`postgres:18-alpine`, `127.0.0.1:55432`),
> **Node 24.19.0**, `pg` 8.23.0. Script: `sandbox/pg-api/ex37-cte-subquery.mjs`.

**A recursive CTE terminates when an iteration produces no new rows. A cycle in the data
means that never happens — the query runs until it exhausts memory or someone kills it.
Nothing in the schema prevents a cycle, a self-referencing foreign key permits one happily,
and there are three ways to stop it, only one of which reports that a cycle existed.**

## Introducing a cycle

The fixture is a clean tree until one row is repointed — `root`'s parent becomes one of its
own descendants:

```console
now introduce a cycle: 1 -> 8
unguarded recursion with a cycle             ok  rows=1 [{"rows_before_the_depth_guard_stopped_it":107}]
```

```sql
WITH RECURSIVE t AS (
  SELECT id, 0 AS d FROM agg_cat WHERE id = 1
  UNION ALL
  SELECT c.id, t.d+1 FROM agg_cat c JOIN t ON c.parent_id = t.id
  WHERE t.d < 40                      -- the only reason this returned at all
)
SELECT count(*)::int AS rows_before_the_depth_guard_stopped_it FROM t;
```

**107 rows, from an 8-row table.** The cycle keeps regenerating nodes, each iteration
producing another lap around the loop, and the query only returned because of
`WHERE t.d < 40`. Remove that predicate and there is no natural stopping point — the row
count grows until the server runs out of memory or the statement is cancelled.

Note that the foreign key `parent_id REFERENCES agg_cat(id)` was satisfied throughout. **A
self-referencing foreign key guarantees that every parent exists; it says nothing about
whether the graph is acyclic.** No constraint in standard PostgreSQL enforces that, so any
"tree" maintained by application code is one bad update away from this.

## Three ways to stop it

### 1. A depth guard

```sql
... UNION ALL SELECT ... FROM agg_cat c JOIN t ON c.parent_id = t.id WHERE t.d < 40
```

Simple, and works everywhere. It bounds the work unconditionally, which is why it belongs in
production queries **even when the data is believed to be acyclic**. Its weakness is that it
cannot tell "this hierarchy is legitimately 40 deep" from "this hierarchy has a loop" — it
truncates both silently. Choose a bound comfortably above any legitimate depth so that
hitting it is a signal.

### 2. `UNION` instead of `UNION ALL`

```console
UNION (not ALL) dedupes and terminates: [{"n":8}]
```

```sql
WITH RECURSIVE t AS (
  SELECT id FROM agg_cat WHERE id = 1
  UNION SELECT c.id FROM agg_cat c JOIN t ON c.parent_id = t.id
)
SELECT count(*)::int AS n FROM t;
```

**Eight rows — the whole table, once each, and it terminated.** `UNION` discards rows
already produced, so going round the loop a second time yields nothing new and the recursion
stops. This is the neat trick for graphs where you want *reachable nodes* rather than
*paths*.

Two costs. Every row must be compared against everything produced so far, which is real work
on a large result. And it only works when the recursive rows are genuinely identical — carry
a `depth` or `path` column and every lap produces a *different* row, so the dedup never
fires and you are back to an infinite loop. **`UNION` and a path column do not compose.**

### 3. The `CYCLE` clause (PG 14+)

```sql
WITH RECURSIVE t AS (
  SELECT id, name FROM agg_cat WHERE id = 1
  UNION ALL
  SELECT c.id, c.name FROM agg_cat c JOIN t ON c.parent_id = t.id
)
CYCLE id SET is_cycle USING path
SELECT id, name, is_cycle FROM t ORDER BY id, is_cycle;
```

```console
the CYCLE clause (PG 14+): [{"id":1,"name":"root","is_cycle":false},
                            {"id":1,"name":"root","is_cycle":true},
                            {"id":2,"name":"electronics","is_cycle":false},
                            {"id":3,"name":"books","is_cycle":false},
                            {"id":4,"name":"phones","is_cycle":false},
                            {"id":5,"name":"laptops","is_cycle":false},
                            {"id":6,"name":"android","is_cycle":false},
                            {"id":7,"name":"ios","is_cycle":false}]
```

**Nine rows, and `root` appears twice** — once reached normally, once flagged `is_cycle:
true`. That second row is where the loop closed. The recursion stopped there instead of
continuing, and the flag says *why*.

This is the only option that **reports** the cycle rather than silently absorbing it. The
syntax is:

```
CYCLE <columns> SET <flag_column> [ TO <value> DEFAULT <value> ] USING <path_column>
```

`USING path` names a column the database maintains itself — an array of the cycle columns
seen so far, which is how it detects the repeat. You can select it if you want to see the
route that looped.

**Prefer `CYCLE` when the data might legitimately contain cycles** and you need to handle
them — filter on `WHERE NOT is_cycle` to get the acyclic part, or surface the flagged rows
as a data-quality report.

## Ordering the walk: `SEARCH`

```sql
WITH RECURSIVE t AS (
  SELECT id, name FROM agg_cat WHERE id = 2
  UNION ALL SELECT c.id, c.name FROM agg_cat c JOIN t ON c.parent_id = t.id
)
SEARCH DEPTH FIRST BY id SET ord
SELECT id, name FROM t ORDER BY ord;
```

```console
the SEARCH clause       : [{"id":2,"name":"electronics"},{"id":4,"name":"phones"},
                           {"id":6,"name":"android"},{"id":7,"name":"ios"},
                           {"id":5,"name":"laptops"}]
```

Electronics → phones → android → ios → laptops: **each branch is followed to its end before
the next begins**, which is what a rendered tree needs. `SEARCH BREADTH FIRST` gives
level-by-level order instead.

`SET ord` creates a sortable column; you must still `ORDER BY ord`, since the clause defines
the ordering value rather than applying it. This replaces the hand-rolled `path` column
built purely for sorting — though a `path` of *names* is still worth building when humans
read the output.

## The three errors

```console
recursive term referencing the CTE twice     ->  42P19 recursive reference to query "t" must not appear more than once
aggregate in the recursive term              ->  42P19 aggregate functions are not allowed in a recursive query's recursive term
no RECURSIVE keyword                         ->  42P01 relation "t" does not exist
```

| Error | Cause | What to do |
|---|---|---|
| `42P19` … *must not appear more than once* | the recursive term joins the CTE to itself | restructure so the term references the CTE once; a self-join usually means the algorithm needs rethinking |
| `42P19` … *aggregate functions are not allowed* | `max()`, `count()` etc. in the recursive term | aggregate **outside** the CTE, over its finished result |
| `42P01 relation "t" does not exist` | the `RECURSIVE` keyword is missing | add it to `WITH` |

The aggregate restriction is the one worth understanding rather than memorising: the
recursive term is evaluated against **only the previous iteration's rows**, so an aggregate
there would summarise a fragment rather than the whole. `LEFT JOIN` against the CTE,
`ORDER BY` and `LIMIT` inside the recursive term are barred for related reasons. Aggregate
afterwards — the subtree count in
[the previous chunk](01-walking-a-tree.md) does exactly that.

The missing-keyword error being `42P01` — the ordinary "no such table" — is why it gets
misdiagnosed as a typo or a search-path problem rather than a missing keyword.

## In Node

```js
const {rows} = await pool.query(
  `WITH RECURSIVE t AS (
     SELECT id, parent_id, name, 0 AS depth
     FROM agg_cat WHERE id = $1
     UNION ALL
     SELECT c.id, c.parent_id, c.name, t.depth + 1
     FROM agg_cat c
     JOIN t ON c.parent_id = t.id
     WHERE t.depth < $2
   )
   CYCLE id SET is_cycle USING cycle_path
   SELECT id, name, depth, is_cycle FROM t ORDER BY depth, id`,
  [rootId, MAX_DEPTH],
);

const looped = rows.filter((r) => r.is_cycle);
if (looped.length) log.warn({rootId, looped}, 'cycle in category tree');
```

- **Belt and braces: a depth guard *and* `CYCLE`.** The guard bounds the work even if the
  `CYCLE` columns are wrong; the flag tells you a cycle was the reason.
- **Log the flagged rows.** A silently truncated tree is a data-quality bug that otherwise
  surfaces as "some categories are missing from the menu".
- **`statement_timeout` is the outer backstop.** An unguarded recursive query is one of the
  few ways a single statement can consume the server's memory, and the driver's
  `query_timeout` does not stop the server working — only `statement_timeout` does
  ([measured in phase 7](../../phase-7-pg-driver/11-timeouts.md)).
- **Do not build the recursion structure from user input.** The starting id is a parameter;
  the query shape is not.

## Trade-off

The stopping condition for a recursive CTE lives in the *data*, not in the query, which is
what makes it able to follow a structure of unknown depth — and what makes it the one
construct here that can run away. Each guard trades something: a depth limit is universal
but silent, `UNION` is elegant but incompatible with path columns and pays a dedup cost,
and `CYCLE` reports honestly but needs PostgreSQL 14 and the right key columns. In
production code the depth guard is not optional; the other two are about whether you need
to *know*.

## Gotchas

**Symptom:** a recursive query never returns and memory climbs
**Cause:** a cycle in the data — the recursion has no natural termination. Measured: an
8-row table produced 107 rows before a `d < 40` guard stopped it
**Fix:** a depth guard in the recursive term, plus `CYCLE` if you need to know it happened

**Symptom:** the data "cannot" have a cycle because there is a foreign key
**Cause:** a self-referencing FK guarantees the parent exists, not that the graph is acyclic
**Fix:** guard anyway. No standard constraint enforces acyclicity

**Symptom:** switching to `UNION` did not stop the runaway
**Cause:** the rows carry a `depth` or `path` column, so every lap produces a distinct row
and the dedup never matches
**Fix:** drop the varying columns, or use `CYCLE`/a depth guard instead

**Symptom:** `42P19 recursive reference to query "t" must not appear more than once`
**Cause:** the recursive term references the CTE twice — usually a self-join
**Fix:** restructure to a single reference

**Symptom:** `42P19 aggregate functions are not allowed in a recursive query's recursive term`
**Cause:** an aggregate in the recursive term, which would summarise only the previous
iteration
**Fix:** aggregate outside the CTE, over its finished result

**Symptom:** `42P01 relation "t" does not exist` on a self-referencing CTE
**Cause:** the `RECURSIVE` keyword is missing, and the error is the ordinary missing-table one
**Fix:** `WITH RECURSIVE`

**Symptom:** a tree renders with branches interleaved
**Cause:** no defined traversal order
**Fix:** `SEARCH DEPTH FIRST BY id SET ord` and `ORDER BY ord` — the clause creates the
column, it does not apply the ordering

## Interview questions

**★ What stops a recursive CTE, and what happens when nothing does?**
It stops when an iteration produces no new rows. With a cycle in the data that never
happens, and the query runs until memory is exhausted or it is cancelled. Measured: 107 rows
generated from an 8-row table before a depth guard cut it off.

**★ Name three ways to survive a cycle, and their trade-offs.**
A depth guard — universal, but truncates silently and cannot distinguish a deep tree from a
loop. `UNION` instead of `UNION ALL` — dedups so the loop terminates, but pays a comparison
cost and breaks entirely if rows carry a depth or path column. The `CYCLE` clause (PG 14+) —
stops at the repeat and flags it, the only option that reports the cycle.

**★ A self-referencing foreign key exists. Can the data still cycle?**
Yes. The FK only guarantees each parent row exists; nothing enforces acyclicity. Measured by
repointing one row and watching an 8-row table generate 107.

**★ Why can't you use an aggregate in the recursive term?**
`42P19`. The recursive term sees only the previous iteration's rows, so an aggregate there
would summarise a fragment rather than the whole set. Aggregate outside the CTE instead.

**★ What does the `CYCLE` clause actually produce?**
A boolean flag column set on the row where the loop closed, and a path column tracking the
key values seen so far. Measured: `root` appeared twice, the second time with
`is_cycle: true`, and the recursion stopped there.

**How do you control traversal order?**
`SEARCH DEPTH FIRST BY id SET ord` or `SEARCH BREADTH FIRST BY id SET ord`, then
`ORDER BY ord`. The clause defines the ordering column; it does not order the result by
itself.

---

← [Walking a tree](01-walking-a-tree.md) · Next topic → [GROUPING SETS, ROLLUP, CUBE](../grouping-sets/)
