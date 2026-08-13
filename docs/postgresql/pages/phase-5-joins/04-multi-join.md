---
title: "Multi-table joins"
sidebar_label: "04 · Multi joins"
sidebar_position: 4
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 on **PostgreSQL 18.4** (`postgres:18-alpine`, `127.0.0.1:55432`),
> **Node 24.19.0**, `pg` 8.23.0. Script: `sandbox/pg-api/ex35-joins.mjs`.

**Joins chain left to right, each one seeing the result of everything before it. The
planner is free to reorder inner joins for speed, but it is not free to reorder an outer
join — which is why one `LEFT JOIN` in the middle of a chain changes the meaning of every
join after it.**

## A three-table chain

Posts, tags, and the junction table between them:

```sql
CREATE TABLE j_posts (id int PRIMARY KEY, title text);
CREATE TABLE j_tags  (id int PRIMARY KEY, name text);
CREATE TABLE j_post_tags (post_id int REFERENCES j_posts(id),
                          tag_id  int REFERENCES j_tags(id),
                          PRIMARY KEY (post_id, tag_id));

INSERT INTO j_posts VALUES (1,'First'),(2,'Second'),(3,'Untagged');
INSERT INTO j_tags  VALUES (1,'sql'),(2,'node'),(3,'unused');
INSERT INTO j_post_tags VALUES (1,1),(1,2),(2,1);
```

```sql
SELECT p.title, t.name
FROM j_posts p
JOIN j_post_tags pt ON pt.post_id = p.id
JOIN j_tags t ON t.id = pt.tag_id
ORDER BY p.id, t.id;
```

```console
$ node ex35-joins.mjs
=== 4. multi-table joins and the N-N join table ===
three-table join         : [{"title":"First","name":"sql"},{"title":"First","name":"node"},
                            {"title":"Second","name":"sql"}]
```

Three rows from three tables. **'Untagged' is absent and 'unused' is absent** — an inner
join anywhere in a chain drops non-matching rows from *both* ends of it. The post with no
tags and the tag with no posts are equally invisible, which is worth noticing because the
query looks like it is "about" posts.

## How the chain is read

Read it as accumulation. `j_posts` joined to `j_post_tags` produces post-tag pairs; that
intermediate result is then joined to `j_tags`. The second `ON` may reference **any table
already introduced** — `t.id = pt.tag_id` works, and so would a condition mentioning `p`:

```sql
JOIN j_tags t ON t.id = pt.tag_id AND t.name <> p.title   -- legal, if odd
```

Referencing a table that appears *later* in the FROM clause is an error:

```console
referring to the old table name after aliasing ->  42P01 invalid reference to FROM-clause entry for table "j_customers"
```

`42P01` is the same code you get for a genuinely missing table and for a `LATERAL`
reference without the keyword; the message body distinguishes them. This scoping rule is
the mechanical reason the textual order matters even though the planner reorders execution.

## Inner joins reorder, outer joins do not

The planner treats a run of inner joins as a set it may execute in any order, starting with
whichever table is most selective. Join order in the text has **no** effect on the result
or the plan for those.

That freedom stops at an outer join:

```sql
FROM a
JOIN b  ON b.a_id = a.id
LEFT JOIN c ON c.b_id = b.id
JOIN d  ON d.c_id = c.id        -- ← this filters out the NULL-extended rows
```

Rows where `c` was NULL-extended cannot satisfy `d.c_id = c.id` — `d.c_id = NULL` is NULL,
not true — so they drop out and the `LEFT JOIN` was pointless. **An inner join downstream
of an outer join cancels it**, exactly as a `WHERE` on the right table does
([ON vs WHERE](02-left-join/02-on-vs-where.md)).

Two fixes. Continue in the outer world:

```sql
LEFT JOIN c ON c.b_id = b.id
LEFT JOIN d ON d.c_id = c.id
```

Or parenthesise the inner pair so it is joined as a unit, which keeps `d` mandatory
*relative to `c`* while the pair as a whole stays optional:

```sql
FROM a
JOIN b ON b.a_id = a.id
LEFT JOIN (j_c c JOIN j_d d ON d.c_id = c.id) ON c.b_id = b.id
```

These are genuinely different queries. The first keeps a row where `c` exists but `d` does
not; the second drops it. Choose deliberately rather than by which one compiles.

### The planner's search space

For inner joins the planner enumerates orderings, but only up to
`join_collapse_limit` (default 8). Past that it stops exploring and joins them roughly in
the order written — so **for very wide joins the textual order starts to matter again**,
and a query with twelve tables can be fast or slow depending on how it was typed. If you
have a query that large and it plans badly, that limit is the first thing to check; the
better answer is usually to split the query.

`from_collapse_limit` does the same for subqueries being flattened into the parent.

## Fan-out compounds across branches

Each additional one-to-many multiplies. A post with 2 tags and 3 comments joined to both in
one query yields **6 rows**, not 5, and every aggregate over that result is wrong in both
directions — `count(DISTINCT tag)` survives, a naive `sum(comment.score)` does not.

The rule from [fan-out and aggregates](01-inner-join/02-fan-out-and-aggregates.md) applies
once per branch: aggregate each child at its own grain first.

```sql
SELECT p.id, p.title, tg.tag_count, cm.comment_count
FROM j_posts p
LEFT JOIN (SELECT post_id, count(*) AS tag_count
           FROM j_post_tags GROUP BY post_id) tg ON tg.post_id = p.id
LEFT JOIN (SELECT post_id, count(*) AS comment_count
           FROM j_comments GROUP BY post_id) cm ON cm.post_id = p.id;
```

Each subquery returns at most one row per post, so no multiplication happens. For a single
child, `LATERAL` ([page 10](10-lateral.md)) usually plans better because it can be
correlated to the driving row and stop early.

A quick diagnostic that works on any query, regardless of how many tables:

```sql
SELECT count(*) AS rows, count(DISTINCT p.id) AS posts FROM …;
```

Unequal means something multiplied.

## Readability rules that survive review

- **Alias every table**, one or two letters, and qualify every column
  ([alias discipline](12-alias-discipline.md)). In a five-table join an unqualified column
  is either ambiguous — `42702` — or, worse, unambiguous but not the one you meant.
- **Order the FROM clause as the reader thinks**: the driving entity first, then outward
  along the relationships. The planner ignores your order (below the collapse limit); the
  reviewer does not.
- **One join per line**, `ON` on the same line as its `JOIN`, conditions aligned.
- **Put outer joins last** where the shape allows. A `LEFT JOIN` in the middle forces the
  reader to check every subsequent join for the cancellation above.
- **Stop at three or four tables per statement.** Beyond that, a CTE naming the
  intermediate result reads better and plans the same — PostgreSQL has inlined
  non-recursive CTEs since 12, so a plain `WITH` is no longer an optimisation fence unless
  you write `MATERIALIZED`.
- **Name the grain in a comment** above any query with more than two joins and an
  aggregate. It is the cheapest defence against the compounding above.

## From Node

```js
const {rows} = await pool.query(
  `SELECT p.id, p.title, t.name AS tag
   FROM j_posts p
   JOIN j_post_tags pt ON pt.post_id = p.id
   JOIN j_tags t       ON t.id = pt.tag_id
   WHERE p.id = ANY($1::int[])
   ORDER BY p.id, t.id`,
  [postIds],
);
```

Passing an array through one parameter with `= ANY($1)` avoids building
`IN ($1,$2,$3,…)` at runtime, and keeps you clear of the 65535-parameter ceiling that
[bulk operations](../phase-8-schema-from-node/04-bulk-insert.md) run into. The flat result
still needs grouping in JS, which is the trade-off [N-N relationships](05-nn-join-table.md)
addresses with `array_agg`.

## Trade-off

One statement across four tables is one round trip and one consistent snapshot — the
planner sees the whole shape and can pick join orders no sequence of separate queries
could. Against that: the result is the *product* of the branches, so payload grows
multiplicatively while information grows additively; every added table is another chance
for a mis-typed `ON` to produce a silent cross join; and past `join_collapse_limit` the
planner stops searching for a good order at all. Beyond three or four tables, splitting into
a query per grain usually transfers less data and is far easier to debug.

## Gotchas

**Symptom:** A `LEFT JOIN` in the middle of a chain behaves like an inner join
**Cause:** A later inner join filters out the NULL-extended rows
**Fix:** Make the downstream joins `LEFT`, or parenthesise the inner pair — and know that
those two are different queries

**Symptom:** Row count explodes and every total is wrong
**Cause:** Two independent one-to-many branches multiplying each other
**Fix:** Pre-aggregate each branch in its own subquery or `LATERAL`; diagnose with
`count(*)` vs `count(DISTINCT parent.id)`

**Symptom:** `ERROR: 42P01 invalid reference to FROM-clause entry`
**Cause:** An `ON` referencing a table introduced later in the FROM clause
**Fix:** Reorder so the referenced table comes first

**Symptom:** A wide join plans badly and reordering the SQL text changes the plan
**Cause:** More tables than `join_collapse_limit` (default 8), so the planner stopped
searching
**Fix:** Split the query, or raise the limit knowingly — the split is usually better

**Symptom:** The query is fast in `psql` and slow from the app
**Cause:** A generic plan chosen after five executions of a prepared statement
**Fix:** Compare `EXPLAIN` on the same parameters —
[prepared statements](../phase-7-pg-driver/10-prepared.md) has the custom/generic switch

## Interview questions

**★ Does the order of joins in the FROM clause affect performance?**
For inner joins below `join_collapse_limit`, no — the planner reorders freely by cost. It
affects readability, and it constrains what each `ON` may reference. For outer joins the
order is semantic. Above the collapse limit the planner stops searching and the written
order starts to matter.

**★ Why does a `LEFT JOIN` followed by an inner join lose rows?**
The inner join is applied to the NULL-extended rows, whose join key is NULL, so they match
nothing and are dropped — the outer join is cancelled. Same mechanism as putting the filter
in `WHERE`.

**★ You join a parent to two child tables and the counts are wrong. What happened?**
The branches multiplied: 2 tags × 3 comments = 6 rows per post. Pre-aggregate each child
separately, or use `count(DISTINCT …)` when a count is all you need.

**★ How do you keep an outer join optional while requiring a join beyond it?**
Parenthesise the inner pair: `LEFT JOIN (c JOIN d ON …) ON …`. That makes `d` mandatory
relative to `c` while the pair remains optional to the driving row.

**When would you use a CTE instead of more joins?**
When naming the intermediate result makes the statement legible, or when you need it more
than once. Since PostgreSQL 12 a non-recursive CTE is inlined, so it is not an optimisation
fence unless declared `MATERIALIZED`.

---

← [Semi and anti joins](semi-anti/) · Next → [Reading N-N relationships](05-nn-join-table.md)
