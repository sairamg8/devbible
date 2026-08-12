---
title: "Building predicates and parameters"
sidebar_label: "01 · Predicates and params"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 on **PostgreSQL 18.4** (`postgres:18-alpine`, `127.0.0.1:55432`),
> **Node 24.19.0**, `pg` 8.23.0. Script: `sandbox/pg-api/ex5-filter-sort.mjs`.

**Chapter 1 of [Safe dynamic `WHERE`](README.md).** Building the fragment array and
the parameter array in one pass, so the `$n` numbering cannot drift.

## The pattern

One array for fragments, one for values. Every `push` to `params` decides the
placeholder number, so they cannot disagree.

```js
function buildList(filters) {
  const where = [];
  const params = [];

  if (filters.status) {
    params.push(filters.status);
    where.push(`status = $${params.length}`);
  }
  if (filters.owner) {
    params.push(filters.owner);
    where.push(`owner = $${params.length}`);
  }
  if (filters.minPrice != null) {
    params.push(filters.minPrice);
    where.push(`price >= $${params.length}`);
  }
  if (filters.q) {
    params.push(`%${filters.q}%`);
    where.push(`name ILIKE $${params.length}`);
  }

  const sql =
    `SELECT id, name, status, price, owner FROM fs_items` +
    (where.length ? ` WHERE ${where.join(' AND ')}` : '') +
    ` ORDER BY id`;
  return {sql, params};
}
```

`params.length` *after* the push is the placeholder number, because `$n` is
1-based. Reading the value straight out of `params.length` is what removes the
manual counter — the classic bug is an `i++` that increments on a branch which did
not actually push a value.

```console
$ node ex5-filter-sort.mjs
=== 4. dynamic WHERE built alongside its parameter array ===

filters {}
  sql: SELECT id, name, status, price, owner FROM fs_items ORDER BY id
  params: []
  rows: apple, Banana, cherry, date, Elderberry, fig

filters {"status":"active"}
  sql: SELECT id, name, status, price, owner FROM fs_items WHERE status = $1 ORDER BY id
  params: ["active"]
  rows: apple, Banana, date, Elderberry

filters {"status":"active","owner":"ann"}
  sql: SELECT id, name, status, price, owner FROM fs_items WHERE status = $1 AND owner = $2 ORDER BY id
  params: ["active","ann"]
  rows: apple, date

filters {"q":"an","minPrice":"10.00"}
  sql: SELECT id, name, status, price, owner FROM fs_items WHERE price >= $1 AND name ILIKE $2 ORDER BY id
  params: ["10.00","%an%"]
  rows: Banana
```

Note the last case: `minPrice` is `$1` and `q` is `$2` — the numbering follows the
order the filters were *pushed*, not the order they appear in the function or in
the request. That is exactly why the number must come from the array rather than
from a variable you maintain.

The no-filter case matters too. `where.length ? … : ''` omits the `WHERE` keyword
entirely rather than emitting `WHERE ` with nothing after it, and rather than the
`WHERE 1=1` trick — which works, but leaves a permanently true predicate in every
plan and in every log line you will later read.

## Why the value side is safe

A parameter is never parsed as SQL. It is sent separately from the statement text
and bound to an already-parsed plan, so its content cannot become syntax.

```js
const res = await pool.query(
  `SELECT id, name FROM fs_items WHERE name = $1`,
  [`apple'; DROP TABLE fs_items; --`],
);
```

```console
=== 3. the same payload as a parameter ===
rows: 0 | table still there: fs_items
```

Zero rows, table intact. PostgreSQL searched for an item literally named
`apple'; DROP TABLE fs_items; --` and did not find one. The identical payload
concatenated into an `ORDER BY` does drop the table — see
[Sort and filter allowlists](../allowlists/), which is where that lands.

The rule this establishes: **values go in `params`, always; identifiers and
keywords never can.**

## `IN (…)` with a variable-length list

The wrong instinct is to generate `$1, $2, $3…`. It works, but every distinct list
length produces a different statement text, which defeats prepared-statement reuse
and fills your `pg_stat_statements` with near-duplicates. Pass an array instead:

```js
// one parameter, any number of ids
const {rows} = await pool.query(
  `SELECT id, name FROM fs_items WHERE id = ANY($1::bigint[])`,
  [[1, 3, 5]],
);
```

`= ANY($1)` takes a single array parameter, so the SQL text is constant no matter
how many ids arrive. It also handles the empty list correctly — `= ANY('{}')`
matches nothing, whereas a generated `IN ()` is a syntax error you have to
special-case.

## Gotchas

**Symptom:** `bind message supplies 2 parameters, but prepared statement requires 3`
**Cause:** The placeholder counter and the values array were maintained separately
and drifted — usually a branch that increments the counter without pushing.
**Fix:** Derive the number from `params.length` after the push. Never keep a
separate counter.

**Symptom:** `syntax error at or near "ORDER"`
**Cause:** `WHERE` emitted with no predicates after it, because the filter object
was empty.
**Fix:** Only add the `WHERE` keyword when `where.length > 0`.

**Symptom:** `pg_stat_statements` is full of near-identical queries
**Cause:** Generated `IN ($1, $2, $3…)` produces a distinct statement per list
length.
**Fix:** `= ANY($1::bigint[])` with one array parameter.

**Symptom:** An empty filter list produces `IN ()` and a syntax error
**Cause:** Generating placeholders from a zero-length array.
**Fix:** `= ANY($1)` handles the empty array as "matches nothing" with no special
case.

**Symptom:** A filter silently stops applying after a refactor
**Cause:** `if (filters.minPrice)` rather than `!= null` — `0` is falsy, so a
legitimate `minPrice=0` is dropped.
**Fix:** Test for `!= null` on anything numeric or boolean.

## Interview questions

**★ How do you build a `WHERE` clause from optional filters without opening an
injection hole?**
Build the fragment array and the parameter array together in one pass, taking the
placeholder number from `params.length` after each push. Values only ever travel
in the parameter array, so nothing the user sends is ever parsed as SQL. Join the
fragments with `AND` and emit the `WHERE` keyword only if there is at least one.

**★ Why is a parameter safe when escaping is not?**
The statement is parsed before the parameter is bound. The value is attached to an
already-built plan as data, so it cannot become syntax regardless of its content —
measured: `apple'; DROP TABLE fs_items; --` as `$1` returned 0 rows and left the
table intact. Escaping tries to neutralise a string that *will* be parsed, and
depends on getting encoding, quoting mode and every metacharacter right.

**★ Why not `WHERE 1=1` and append `AND …` unconditionally?**
It works and it is readable. The cost is a permanently true predicate in every
plan and every logged statement, and it hides the "no filters at all" case that
usually deserves a different query — often a cheaper one using a different index.
Conditionally emitting `WHERE` costs one ternary.

**★ How do you parameterize `IN` with a variable number of values?**
`= ANY($1::bigint[])`, passing a JavaScript array as one parameter. The statement
text stays constant regardless of list length, which preserves prepared-statement
reuse, keeps `pg_stat_statements` readable, and makes the empty list a non-special
case instead of an `IN ()` syntax error.

**Why derive the placeholder number from `params.length` rather than a counter?**
Because the two cannot then disagree. A manual counter drifts the moment a branch
increments without pushing a value, and the symptom — `bind message supplies N
parameters` — points at the query rather than at the branch that caused it.

---

← [Topic index](README.md) · Next → [Pattern matching and composition](02-patterns-and-composition.md)
