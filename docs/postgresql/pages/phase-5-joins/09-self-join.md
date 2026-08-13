---
title: "Self joins"
sidebar_label: "09 · Self joins"
sidebar_position: 9
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 on **PostgreSQL 18.4** (`postgres:18-alpine`, `127.0.0.1:55432`),
> **Node 24.19.0**, `pg` 8.23.0. Script: `sandbox/pg-api/ex35-joins.mjs`.

**A self join is an ordinary join where both sides happen to be the same table — the
aliases are what make it work. One self join walks one level of a hierarchy; walking an
arbitrary number of levels needs `WITH RECURSIVE`.**

## One level: row and its parent

```sql
CREATE TABLE j_emp (id int PRIMARY KEY, name text,
                    manager_id int REFERENCES j_emp(id));
INSERT INTO j_emp VALUES (1,'Root',NULL),(2,'Mid',1),(3,'Leaf',2),(4,'Leaf2',2);
```

The FK points back at the same table — the standard adjacency-list model.

```sql
SELECT e.name AS employee, m.name AS manager
FROM j_emp e
LEFT JOIN j_emp m ON m.id = e.manager_id
ORDER BY e.id;
```

```console
$ node ex35-joins.mjs
=== 9. self joins — hierarchies ===
employee + manager       : [{"employee":"Root","manager":null},{"employee":"Mid","manager":"Root"},
                            {"employee":"Leaf","manager":"Mid"},{"employee":"Leaf2","manager":"Mid"}]
```

Four rows, one per employee, **including Root with `manager: null`**. Two details carry
the query:

- **The aliases are mandatory.** `FROM j_emp JOIN j_emp` is `42712 table name "j_emp"
  specified more than once`. `e` and `m` give the two roles distinct names, and every
  column must then be qualified.
- **`LEFT JOIN`, not `JOIN`.** The root's `manager_id` is NULL, so an inner join drops the
  top of the hierarchy — reliably the one row anyone notices missing.

The same shape covers any "row plus a related row from the same table": a message and the
message it replies to, a version and the version it supersedes, a category and its parent.

## Arbitrary depth: WITH RECURSIVE

One self join reaches one level. Two reach two. For "everyone under Root, however deep"
there is no fixed number of joins, and the recursive CTE is the answer:

```sql
WITH RECURSIVE chain AS (
  SELECT id, name, manager_id, 1 AS depth, name::text AS path
  FROM j_emp WHERE manager_id IS NULL          -- anchor
  UNION ALL
  SELECT e.id, e.name, e.manager_id, c.depth + 1, c.path || ' > ' || e.name
  FROM j_emp e JOIN chain c ON e.manager_id = c.id)   -- recursive term
SELECT depth, path FROM chain ORDER BY path;
```

```console
recursive full chain     : [{"depth":1,"path":"Root"},{"depth":2,"path":"Root > Mid"},
                            {"depth":3,"path":"Root > Mid > Leaf"},{"depth":3,"path":"Root > Mid > Leaf2"}]
```

The anchor selects the roots. The recursive term joins the table against **the rows
produced by the previous iteration**, and repeats until an iteration produces none. The
accumulators — `depth` and `path` — are the reason to prefer this over a client-side loop:
they are computed as the walk happens.

`UNION ALL` is almost always correct here; `UNION` deduplicates on every iteration, which
costs more and hides genuine repeats. Direction is set by the join: `e.manager_id = c.id`
walks **down** to subordinates, `e.id = c.manager_id` walks **up** to ancestors.

**A cycle makes this run forever.** `manager_id` pointing back into the subtree gives an
infinite loop, and a self-referencing FK does not prevent one. Two defences:

```sql
-- PostgreSQL 14+: built in
WITH RECURSIVE chain AS (…) CYCLE id SET is_cycle USING path_arr

-- portable: carry the path and refuse to revisit
SELECT … , c.path_arr || e.id
FROM j_emp e JOIN chain c ON e.manager_id = c.id
WHERE NOT e.id = ANY(c.path_arr)
```

A `depth < 20` guard is a blunt third option — cheap, and it converts a hang into a wrong
answer, which at least surfaces.

### What the recursive term may and may not do

The recursive term has real restrictions, and the error messages are opaque enough to be
worth knowing in advance:

- It may reference the CTE **once only**. Two references raise
  `recursive reference to query "chain" must not appear more than once`.
- It may not appear in the right-hand side of a `LEFT JOIN`, in a subquery, or under
  `EXCEPT`/`INTERSECT` — anything requiring the full recursive result before the next
  iteration is computed.
- Aggregates and `ORDER BY`/`LIMIT` are not allowed **in** the recursive term; apply them
  in the outer `SELECT`, as the example does with `ORDER BY path`.

A `LIMIT` in the outer query does *not* stop the recursion early in general — the CTE is
evaluated to completion first unless the planner can prove otherwise. For a bounded walk,
carry a `depth` column and filter inside the recursive term, which is what the Node example
below does.

### Breadth-first, and ordering the output

The iteration is inherently breadth-first: level 1, then level 2, and so on. The *output*
order is not guaranteed to be anything, so it must be imposed by the outer `ORDER BY`.

Ordering by the accumulated `path` string, as above, gives depth-first reading order —
`Root`, `Root > Mid`, `Root > Mid > Leaf` — which is what a tree UI wants. Ordering by
`depth` gives level-by-level. Building the path as an **array** rather than a string is
better when names may contain the separator, and it doubles as the cycle-detection
structure:

```sql
c.path_arr || e.id AS path_arr
…
ORDER BY path_arr
```

## Other self-join shapes

**Find duplicates** — pair rows sharing a key, using `<` so each pair appears once and no
row pairs with itself:

```sql
SELECT a.id, b.id FROM j_emp a JOIN j_emp b ON b.name = a.name AND b.id > a.id;
```

**Compare to the previous row** — this is the shape where a window function beats the self
join outright:

```sql
SELECT id, total, total - lag(total) OVER (ORDER BY id) AS delta FROM j_orders;
```

`lag()` scans once; the equivalent self join on `b.id = a.id - 1` breaks the moment ids
have gaps, which they always eventually do. Reach for a window function whenever the
"other row" is defined by ordering rather than by a stored key.

## From Node

```js
const {rows} = await pool.query(
  `WITH RECURSIVE sub AS (
     SELECT id, name, 1 AS depth FROM j_emp WHERE id = $1
     UNION ALL
     SELECT e.id, e.name, s.depth + 1
     FROM j_emp e JOIN sub s ON e.manager_id = s.id
     WHERE s.depth < $2)
   SELECT * FROM sub ORDER BY depth, id`,
  [rootId, maxDepth],
);
```

The depth cap is a parameter, not a constant — an unbounded recursive walk driven by user
input is a resource risk, and a `statement_timeout` should back it up
([Phase 11](../phase-11-mvcc/)).

## Trade-off

The adjacency list that self joins read is the cheapest hierarchy to *write*: moving a
subtree is one `UPDATE` of one `manager_id`. Reading is where it costs — depth-N needs N
joins or a recursive CTE that visits every level. The alternatives invert that: a
materialised path or closure table makes reads a single indexed lookup and makes moves
expensive and error-prone. For hierarchies that are shallow, small, or read with a bounded
depth, the adjacency list plus a recursive CTE is the right default; measure before adding
a closure table.

## Gotchas

**Symptom:** `ERROR: 42712 table name "j_emp" specified more than once`
**Cause:** Self join without aliases
**Fix:** Alias both sides (`e`, `m`) and qualify every column

**Symptom:** The top of the hierarchy is missing from the results
**Cause:** Inner join on a NULL parent id
**Fix:** `LEFT JOIN` — Root has `manager_id IS NULL`

**Symptom:** A recursive CTE never returns and the connection sits `active`
**Cause:** A cycle in the parent pointers
**Fix:** `CYCLE … SET … USING …` (PostgreSQL 14+), a path array with `NOT … = ANY(path)`,
or a depth cap — plus `statement_timeout` as the backstop

**Symptom:** Duplicate-finding self join reports every pair twice, plus each row against
itself
**Cause:** The condition allows both orderings and the identity match
**Fix:** `b.id > a.id` rather than `b.id <> a.id`

**Symptom:** "Compare with the previous row" breaks after some rows are deleted
**Cause:** Joining on `id - 1` assumes contiguous ids
**Fix:** `lag()` / `lead()` over an explicit `ORDER BY`

## Interview questions

**★ What makes a self join work?**
Aliases. The table appears twice under different names so each occurrence is a distinct
role and its columns can be qualified. Without them PostgreSQL raises `42712`.

**★ Why `LEFT JOIN` when reading a parent-child hierarchy?**
The root's parent id is NULL, so an inner join silently drops the top of the tree. The
measurement kept `{"employee":"Root","manager":null}` only because of it.

**★ When do you need `WITH RECURSIVE` instead of a self join?**
When the depth is not known at query-writing time. One self join is one level; arbitrary
depth needs the anchor plus recursive term, which also lets you accumulate depth and path
as you go.

**★ How do you stop a recursive CTE looping forever?**
Detect the cycle: `CYCLE id SET is_cycle USING path` on 14+, or carry a path array and
exclude already-visited ids. A depth cap plus `statement_timeout` limits the damage but
does not detect the cycle.

**Self join or window function for "difference from the previous row"?**
Window function. `lag()` needs one scan and defines "previous" by ordering; a self join on
`id - 1` assumes contiguous ids and breaks after the first delete.

**What are the alternatives to an adjacency list?**
Materialised path (`ltree` or a text column) and closure tables. Both make reads a single
indexed lookup and make subtree moves expensive — the opposite trade to the adjacency list.

---

← [ON vs USING vs NATURAL](08-on-using-natural.md) · Next → [LATERAL](10-lateral.md)
