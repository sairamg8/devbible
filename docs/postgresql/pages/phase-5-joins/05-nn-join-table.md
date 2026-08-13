---
title: "Reading N-N relationships"
sidebar_label: "05 · N-N"
sidebar_position: 5
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 on **PostgreSQL 18.4** (`postgres:18-alpine`, `127.0.0.1:55432`),
> **Node 24.19.0**, `pg` 8.23.0. Script: `sandbox/pg-api/ex35-joins.mjs`.

**A many-to-many is stored as a third table holding nothing but two foreign keys. Reading
it flat gives one row per pair, which is almost never the shape the API wants — so the
real skill is aggregating back to one row per parent without losing the parents that have
no children.**

## The junction table

```sql
CREATE TABLE j_post_tags (post_id int REFERENCES j_posts(id),
                          tag_id  int REFERENCES j_tags(id),
                          PRIMARY KEY (post_id, tag_id));
```

The composite primary key is doing three jobs at once: it identifies the row, it forbids
the same tag being attached twice, and it provides the index for `post_id` lookups.

It does **not** index `tag_id`. A B-tree on `(post_id, tag_id)` can serve a lookup by
`post_id`, or by both, but not by `tag_id` alone — the leftmost-prefix rule. So "which
posts have tag 7?" falls back to a sequential scan, and that direction is queried just as
often as the other:

```sql
CREATE INDEX ON j_post_tags (tag_id);
```

That is the same unindexed-FK problem [Phase 10](../phase-10-indexes/18-fk-indexes.md)
measures, and junction tables are where it shows up most, precisely because both directions
matter. The column order of the PK is worth a moment's thought too: put the column you
filter by most often first, since that one gets the free index.

### When the relationship grows attributes

Add columns to the junction table when the *relationship* has properties — `added_at`,
`added_by`, `position` for ordering, `weight` for ranking. That is the point at which it
stops being a pure junction table and becomes an entity in its own right, and it is fine
for it to gain a surrogate key then.

Until then, resist adding one. A surrogate `id` on a junction table with no attributes
buys nothing and quietly permits duplicate pairs unless you *also* add a unique constraint
on `(post_id, tag_id)` — at which point you are maintaining two indexes to get what the
composite PK gave you for free.

## Flat read: one row per pair

```sql
SELECT p.title, t.name
FROM j_posts p
JOIN j_post_tags pt ON pt.post_id = p.id
JOIN j_tags t ON t.id = pt.tag_id
ORDER BY p.id, t.id;
```

```console
three-table join         : [{"title":"First","name":"sql"},{"title":"First","name":"node"},
                            {"title":"Second","name":"sql"}]
```

'First' is repeated once per tag, and 'Untagged' is missing entirely. To build
`{title, tags: []}` from this in JS you would group by title and special-case the absent
post — both avoidable, and both a place for bugs to live.

## Aggregated read: one row per parent

```sql
SELECT p.title,
       coalesce(array_agg(t.name ORDER BY t.name)
                FILTER (WHERE t.id IS NOT NULL), '{}') AS tags
FROM j_posts p
LEFT JOIN j_post_tags pt ON pt.post_id = p.id
LEFT JOIN j_tags t       ON t.id = pt.tag_id
GROUP BY p.id, p.title
ORDER BY p.id;
```

```console
posts with their tags aggregated: [{"title":"First","tags":["node","sql"]},
                                   {"title":"Second","tags":["sql"]},
                                   {"title":"Untagged","tags":[]}]
  ^ LEFT JOIN + FILTER keeps the untagged post with an empty array
```

**`tags: []` for the untagged post** — the shape an API can return without post-processing.
Four pieces make that work, and dropping any one breaks it in a different way:

| Piece | Without it |
|---|---|
| `LEFT JOIN` on **both** hops | 'Untagged' disappears entirely |
| `FILTER (WHERE t.id IS NOT NULL)` | `tags: [null]` — the NULL-extended row is aggregated |
| `coalesce(…, '{}')` | `tags: null` — `array_agg` over zero rows returns NULL, not `{}` |
| `GROUP BY p.id, p.title` | grouping by title alone merges two posts that share a title |

The `FILTER` and the `coalesce` are fixing **two different NULLs** and are not
interchangeable. `FILTER` removes the manufactured row from the aggregate's input;
`coalesce` handles the case where the aggregate's input was then empty. This is the
[LEFT JOIN NULL extension](02-left-join/01-null-extension.md) reappearing inside an
aggregate.

`array_agg(… ORDER BY t.name)` sorts within the aggregate, which is what makes the output
stable — `["node","sql"]`, not whatever order the join happened to produce. Without it the
array order is arbitrary and can change between runs, which breaks response snapshot tests
in a way that looks flaky rather than wrong.

`pg` decodes `text[]` straight into a JS array, so no client parsing is needed.

### Nested objects instead of scalars

For `{id, name}` per tag rather than a bare list, `jsonb_agg` takes the same treatment:

```sql
coalesce(jsonb_agg(jsonb_build_object('id', t.id, 'name', t.name)
                   ORDER BY t.name) FILTER (WHERE t.id IS NOT NULL), '[]'::jsonb) AS tags
```

Note `'[]'::jsonb`, not `'{}'` — the empty *array* literal, since `{}` in jsonb is an empty
object. `pg` pre-parses `jsonb`, so that column arrives as a real JS array of objects
([type parsing](../phase-7-pg-driver/08-type-parsing.md)).

### The two-query alternative

Aggregating in SQL is not the only correct answer. For a paginated list, fetching the page
of parents and then their children in a second query is often better:

```js
const {rows: posts} = await pool.query(`SELECT id, title FROM j_posts ORDER BY id LIMIT $1`, [n]);
const {rows: tags}  = await pool.query(
  `SELECT pt.post_id, t.name FROM j_post_tags pt JOIN j_tags t ON t.id = pt.tag_id
   WHERE pt.post_id = ANY($1::int[])`, [posts.map(p => p.id)]);
```

Two round trips, but each result is small and neither aggregates. This is **not** an N+1 —
it is two queries regardless of page size, and it keeps `LIMIT` semantics simple, which
aggregation complicates: `LIMIT 10` on the aggregated query limits *parents* correctly only
because the `GROUP BY` already collapsed them. Choose the aggregate when the client wants
one payload; choose two queries when the child set is large or the parent page is
paginated.

## "Has ALL of these tags" — relational division

The common filter, and not what `IN` gives you — `IN` is "has *any* of":

```sql
SELECT p.title
FROM j_posts p
JOIN j_post_tags pt ON pt.post_id = p.id
WHERE pt.tag_id IN (1,2)
GROUP BY p.id, p.title
HAVING count(DISTINCT pt.tag_id) = 2;
```

```console
posts having ALL of a set of tags: [{"title":"First"}]
```

'Second' has tag 1 but not tag 2, so the `HAVING` filters it out. The pattern is: restrict
to the tags of interest, group by the parent, then require the group's distinct count to
equal the size of the set.

`DISTINCT` inside the count matters only if the junction table permits duplicate pairs —
with the composite PK above it cannot, but it costs almost nothing and survives someone
later replacing the PK with a surrogate key.

Parameterised from Node, the required count must track the array:

```js
const {rows} = await pool.query(
  `SELECT p.id, p.title
   FROM j_posts p
   JOIN j_post_tags pt ON pt.post_id = p.id
   WHERE pt.tag_id = ANY($1::int[])
   GROUP BY p.id, p.title
   HAVING count(DISTINCT pt.tag_id) = cardinality($1::int[])`,
  [tagIds],
);
```

`cardinality($1)` keeps the two in step, so a caller passing three tags cannot accidentally
run the two-tag query. Hard-coding `= 2` there is a real bug that only appears when the
caller changes.

For "has all" with large tag sets, the `EXISTS`-per-tag form sometimes plans better —
measure before assuming the `HAVING` version is optimal.

## Trade-off

The junction table is the only normalised way to store a many-to-many, and it gives both
directions equal support plus room for relationship attributes. The cost is that every read
needs an aggregate to reach the shape the application wants, and aggregation blocks
index-only access — the planner must visit the rows. An array column on the parent
(`tags text[]` with a GIN index) reads faster for a fixed, small tag set, but loses
referential integrity, cheap renames, and the "which posts have this tag" direction unless
you index for it. Use the junction table unless you have measured that it is the
bottleneck.

## Gotchas

**Symptom:** Parents with no children vanish from an aggregated list
**Cause:** Inner join on either hop of the two-hop path
**Fix:** `LEFT JOIN` both hops

**Symptom:** `tags: [null]` for a parent with no children
**Cause:** `array_agg` aggregated the NULL-extended row
**Fix:** `FILTER (WHERE child.id IS NOT NULL)`

**Symptom:** `tags: null` instead of `tags: []`
**Cause:** `array_agg` over an empty group returns NULL
**Fix:** `coalesce(…, '{}')` — and `'[]'::jsonb` for the `jsonb_agg` version

**Symptom:** Array order changes between runs and snapshot tests flake
**Cause:** No `ORDER BY` inside the aggregate
**Fix:** `array_agg(t.name ORDER BY t.name)`

**Symptom:** "which posts have tag 7" is a sequential scan
**Cause:** The composite PK `(post_id, tag_id)` cannot serve a `tag_id`-only lookup
**Fix:** A separate index on `(tag_id)`

**Symptom:** "has all tags" returns posts that have only one of them
**Cause:** `WHERE tag_id IN (…)` alone is "has any"
**Fix:** Add `GROUP BY parent` + `HAVING count(DISTINCT tag_id) = <set size>`, with
`cardinality($1)` rather than a literal

**Symptom:** Duplicate pairs appear after someone adds a surrogate key
**Cause:** The composite PK was the only thing enforcing pair uniqueness
**Fix:** Keep a unique constraint on `(post_id, tag_id)` alongside the surrogate key

## Interview questions

**★ How do you model and read a many-to-many in PostgreSQL?**
A junction table with the two FKs and a composite primary key over them, plus an index on
the second column so both directions are covered. Read it with two `LEFT JOIN`s and
`array_agg`/`jsonb_agg` to collapse back to one row per parent.

**★ Why does `array_agg` need both `FILTER` and `coalesce`?**
They fix different NULLs. `FILTER` excludes the row the `LEFT JOIN` manufactured, otherwise
the array contains `[null]`. `coalesce` handles the aggregate over zero surviving rows,
which returns NULL rather than an empty array. Measured: `tags: []` only with both.

**★ Write "posts tagged with both sql and node".**
Restrict to those tag ids, group by post, `HAVING count(DISTINCT tag_id) = 2` — and from
Node use `cardinality($1::int[])` so the count tracks the parameter array.

**★ What should the junction table's primary key be?**
The composite `(a_id, b_id)`. It enforces pair uniqueness and indexes the first column for
free. Add a surrogate key only when the relationship gains its own attributes and identity,
and keep a unique constraint on the pair when you do.

**When is a junction table the wrong choice?**
When the "many" side is a small fixed vocabulary, never queried in reverse, and never
carries relationship attributes — then an array column with a GIN index is simpler and
faster. You give up FK integrity to get it.

**Aggregate in SQL or fetch children in a second query?**
Aggregate when the client wants one payload and the child sets are small. Use two queries
for paginated parents or large child sets — it is two round trips regardless of page size,
not an N+1, and it keeps `LIMIT` semantics simple.

---

← [Multi-table joins](04-multi-join.md) · Next → [RIGHT and FULL OUTER](06-outer-joins.md)
