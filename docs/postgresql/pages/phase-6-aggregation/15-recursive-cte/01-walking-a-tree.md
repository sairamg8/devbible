---
title: "Walking a tree"
sidebar_label: "01 · Walking a tree"
sidebar_position: 1
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08 on **PostgreSQL 18.4** (`postgres:18-alpine`, `127.0.0.1:55432`),
> **Node 24.19.0**, `pg` 8.23.0. Script: `sandbox/pg-api/ex37-cte-subquery.mjs`.

**`WITH RECURSIVE` is how a single statement follows a parent pointer to arbitrary depth. It
is two queries joined by `UNION ALL` — a starting set, and a rule for producing more rows
from the rows you already have — repeated until the rule produces nothing. That is the whole
mechanism, and everything else on this page follows from it.**

## The shape

```sql
WITH RECURSIVE t AS (
  -- anchor: where to start
  SELECT id, parent_id, name, 0 AS depth, name::text AS path
  FROM agg_cat WHERE parent_id IS NULL

  UNION ALL

  -- recursive term: given rows already in t, produce more
  SELECT c.id, c.parent_id, c.name, t.depth + 1, t.path || ' > ' || c.name
  FROM agg_cat c JOIN t ON c.parent_id = t.id
)
SELECT depth, path FROM t ORDER BY path;
```

```console
descend from root       : [{"depth":0,"path":"root"},
                           {"depth":1,"path":"root > books"},
                           {"depth":2,"path":"root > books > fiction"},
                           {"depth":1,"path":"root > electronics"},
                           {"depth":2,"path":"root > electronics > laptops"},
                           {"depth":2,"path":"root > electronics > phones"},
                           {"depth":3,"path":"root > electronics > phones > android"},
                           {"depth":3,"path":"root > electronics > phones > ios"}]
```

Three things are being carried along that the table does not store:

- **`depth`** — incremented in the recursive term. There is no other way to know how deep a
  row is, and it is what a depth guard tests.
- **`path`** — built by concatenating as you descend. This is what makes the output
  readable, and sorting by it produces a tree-shaped listing.
- **`name::text`** — the explicit cast in the *anchor*. Without it the anchor's type may be
  `varchar` while the recursive term produces `text`, and the two branches of the `UNION ALL`
  must agree. Casting in the anchor is the conventional fix.

**The recursive term joins the table to the CTE**, not to itself. `JOIN t ON c.parent_id =
t.id` reads as *"rows whose parent is something I have already found"*.

## Climbing instead of descending

Reverse the join condition and you walk up:

```sql
WITH RECURSIVE up AS (
  SELECT id, parent_id, name FROM agg_cat WHERE id = 6
  UNION ALL
  SELECT c.id, c.parent_id, c.name FROM agg_cat c JOIN up ON up.parent_id = c.id
)
SELECT id, name FROM up;
```

```console
climb to the root       : [{"id":6,"name":"android"},{"id":4,"name":"phones"},
                           {"id":2,"name":"electronics"},{"id":1,"name":"root"}]
```

`up.parent_id = c.id` — *"the row that is my parent"* — instead of `c.parent_id = t.id`.
This is the breadcrumb query: four rows, ordered from the node to the root, in one
statement.

## Subtree aggregates

Once the subtree is a row set, aggregating it is ordinary SQL:

```sql
WITH RECURSIVE sub AS (
  SELECT id FROM agg_cat WHERE id = 2
  UNION ALL SELECT c.id FROM agg_cat c JOIN sub ON c.parent_id = sub.id
)
SELECT count(*)::int AS nodes_including_self FROM sub;
```

```console
subtree aggregate       : [{"nodes_including_self":5}]
```

Electronics plus phones, laptops, android and ios. **The anchor row is included**, which is
the off-by-one to watch: "how many descendants" is this minus one, and "how many products in
this category and below" usually wants the anchor in.

## How it executes

```console
  -- 15a. the plan — Recursive Union with a Worktable Scan
  Aggregate (actual rows=1.00 loops=1)
    CTE t
      ->  Recursive Union (actual rows=8.00 loops=1)
            Storage: Memory  Maximum Storage: 33kB
            ->  Seq Scan on agg_cat (actual rows=1.00 loops=1)
                  Filter: (parent_id IS NULL)
                  Rows Removed by Filter: 7
            ->  Hash Join (actual rows=1.75 loops=4)
                  Hash Cond: (c.parent_id = t_1.id)
                  ->  Seq Scan on agg_cat c (actual rows=8.00 loops=4)
                  ->  Hash (actual rows=2.00 loops=4)
                        ->  WorkTable Scan on t t_1 (actual rows=2.00 loops=4)
  Planning Time: 0.168 ms
  Execution Time: 0.275 ms
```

Two node types make this legible:

- **`Recursive Union`** is the whole construct. Its first child is the anchor, run once; its
  second child is the recursive term.
- **`WorkTable Scan`** is the rows produced by the *previous* iteration. That is the actual
  algorithm: each round reads only what the last round produced, not everything found so
  far.

**`loops=4` on the recursive term** is the number of iterations — the tree is 4 levels deep,
so the term ran 4 times and the fourth produced nothing, which is what stops it. `actual
rows=1.75` is the average per iteration; the total is 7, plus the 1 anchor row = 8.

The `Seq Scan on agg_cat c` inside the loop is worth noticing: **the table is scanned once
per iteration**. On this 8-row fixture that is free, but on a real tree it is the thing that
matters — an index on the join column (`parent_id` when descending, the primary key when
climbing) turns each iteration into an index lookup instead of a full scan. A recursive
query over a large table with no index on the parent column is `depth × full scan`.

## Recursion is not always the answer

```console
generate_series via recursion (and why you would not): [{"xs":[1,2,3,4,5]}]
```

```sql
WITH RECURSIVE n AS (SELECT 1 AS i UNION ALL SELECT i+1 FROM n WHERE i < 5)
SELECT array_agg(i) AS xs FROM n;
```

It works, and `generate_series(1, 5)` does the same thing in a fraction of the code and
without the recursive machinery ([phase 4](../../phase-4-crud/18-generate-series.md)). Use
`WITH RECURSIVE` when the *shape* of the data is what you are following — a hierarchy, a
graph, a chain of references. For generating a sequence, generating a date spine, or
anything where the next value is a pure function of the last, the set-returning functions
are better on every axis.

## In Node

```js
// Breadcrumbs for one node, deepest-first.
const {rows} = await pool.query(
  `WITH RECURSIVE up AS (
     SELECT id, parent_id, name, 0 AS depth
     FROM agg_cat WHERE id = $1
     UNION ALL
     SELECT c.id, c.parent_id, c.name, up.depth + 1
     FROM agg_cat c
     JOIN up ON up.parent_id = c.id
     WHERE up.depth < $2
   )
   SELECT id, name, depth FROM up ORDER BY depth DESC`,
  [nodeId, MAX_DEPTH],
);
```

- **A depth guard even on data you believe is a tree.** `WHERE up.depth < $2` bounds the
  work whatever the data does; without it, one bad row can make this run until it exhausts
  memory. The next chunk measures exactly that.
- **Parameterise the starting node, never the recursion structure.** The anchor's `WHERE`
  takes `$1` like any other query.
- **`ORDER BY depth DESC`** to get root-first breadcrumbs, since the query produces them
  node-first.
- **Index the join column.** `parent_id` for descending, and the primary key already covers
  climbing.

## Trade-off

`WITH RECURSIVE` replaces a loop of round trips — fetch a node, fetch its parent, repeat —
with a single statement whose cost is one pass per level rather than one round trip per
level. For a hierarchy of any depth that is a large win, and it composes with ordinary SQL
so a subtree can be aggregated, joined or filtered like any other row set. What you give up
is a bounded cost: the query's work depends on the shape of the data, the table is
re-scanned once per iteration, and an unexpected cycle turns "walk the tree" into an
unbounded loop. Guard the depth and index the join column, and it is one of the best tools
in the language.

## Gotchas

**Symptom:** `42P01 relation "t" does not exist` for a CTE that references itself
**Cause:** the `RECURSIVE` keyword is missing — a plain `WITH` cannot self-reference
**Fix:** `WITH RECURSIVE`. The keyword attaches to `WITH`, not to the individual CTE

**Symptom:** the `UNION ALL` branches disagree on type
**Cause:** the anchor produces `varchar` (or `unknown` from a literal) where the recursive
term produces `text`
**Fix:** cast explicitly in the anchor — `name::text`, `0::int`

**Symptom:** the recursion is slow on a large table
**Cause:** the table is scanned once per iteration; the plan shows a `Seq Scan` inside the
`Recursive Union`
**Fix:** index the join column — `parent_id` when descending

**Symptom:** a subtree count is one higher than expected
**Cause:** the anchor row is part of the result
**Fix:** subtract one, or start the anchor from the children rather than the node

**Symptom:** a recursive CTE is used to generate a number or date series
**Cause:** reaching for recursion when the next value is a pure function of the last
**Fix:** `generate_series`, which is simpler and faster

## Interview questions

**★ What are the two parts of a recursive CTE?**
An anchor term that produces the starting rows, and a recursive term joined to it by
`UNION ALL` that produces more rows from the rows already found. It repeats until an
iteration produces nothing.

**★ What does `WorkTable Scan` mean in the plan?**
It is the set of rows produced by the *previous* iteration — the only input the recursive
term reads. `loops=` on the recursive term is the number of iterations, which is the depth
of the structure. Measured: `loops=4` on a 4-level tree.

**★ How do you carry the depth or the path of each node?**
Compute them in the recursive term — `t.depth + 1` and `t.path || ' > ' || c.name` — with
the initial values in the anchor. The table stores neither; they exist only in the CTE.

**★ How do you turn a descending walk into a climb?**
Reverse the join condition: `c.parent_id = t.id` descends, `t.parent_id = c.id` climbs.
Measured: starting at `android`, the climb returned android → phones → electronics → root.

**Why index the parent column?**
Because the recursive term joins the table on it once per iteration. Without an index the
cost is depth × full scan, which the plan shows as a `Seq Scan` inside the `Recursive Union`.

**When should you not use `WITH RECURSIVE`?**
When the next value is a pure function of the last rather than something followed through
the data — number or date series belong to `generate_series`.

---

← [Topic index](README.md) · Next → [Cycles, guards and limits](02-cycles-and-limits.md)
