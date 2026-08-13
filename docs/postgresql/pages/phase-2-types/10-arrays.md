---
title: "Arrays"
sidebar_label: "10 · Arrays"
sidebar_position: 10
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 on **PostgreSQL 18.4** (`postgres:18-alpine`, `127.0.0.1:55432`),
> **Node 24.19.0**, `pg` 8.23.0. Script: `sandbox/pg-api/ex34-types-more.mjs`.

**Any type can be an array, and a GIN index makes containment queries fast. What an array
cannot do is carry a foreign key, per-element constraints, or per-element metadata — which
is the line between an array and a child table.**

## The basics, and the 1-based indexing

```console
$ node ex34-types-more.mjs
=== 10. arrays — and when a child table is better ===
basics: {"first_element":"t1","len":3,"card":3,"has_common":true,"contains_common":true}
1-based indexing: {"idx1":"a","idx0":null,"idx99":null} <- out of range is NULL, not an error
```

**Arrays are 1-based, and an out-of-range subscript returns `NULL` rather than raising.**
Both are worth internalising: JavaScript habits produce `arr[0]`, which is silently NULL, and
a typo'd index gives no error at all.

```sql
tags[1]                    -- first element (1-based)
tags[2:3]                  -- a slice
array_length(tags, 1)      -- length of dimension 1; NULL for an empty array
cardinality(tags)          -- total elements; 0 for an empty array  ← usually what you want
'common' = ANY(tags)       -- membership
tags @> ARRAY['a','b']     -- contains all of these
tags && ARRAY['a','b']     -- overlaps: has any of these
array_append / array_remove / array_position / array_agg / unnest
```

Prefer `cardinality()` to `array_length()`: the latter returns `NULL` for an empty array,
which then poisons any arithmetic around it.

## The index, and the operator that does not use it

```console
@> without an index : ->  Seq Scan on ty_arr (actual time=0.034..72.760 rows=4000.00 loops=1) 73.193 ms
@> with a GIN index : ->  Bitmap Heap Scan on ty_arr (actual time=1.643..4.294 rows=4000.00 loops=1) 4.790 ms | index 920 kB
= ANY() with the same index: ->  Parallel Seq Scan on ty_arr (actual time=0.038..31.629 rows=2000.00 loops=2) 41.792 ms  <- ANY does NOT use GIN
```

200 000 rows. **A GIN index took containment from 73.2 ms to 4.8 ms — 15× — for 920 kB.**

But the third line is the one that costs people hours: **`'t42' = ANY(tags)` did not use the
index** and fell back to a parallel sequential scan at 41.8 ms. The two expressions are
logically equivalent; only `@>` is indexable.

```sql
CREATE INDEX ON docs USING gin (tags);

-- uses the index
WHERE tags @> ARRAY['t42']
WHERE tags && ARRAY['t42','t43']     -- overlap, also indexable

-- does NOT use it
WHERE 't42' = ANY(tags)
```

**Write array membership as `@> ARRAY[...]`, always.** `= ANY()` reads more naturally and is
the wrong habit.

## What arrays cannot do

```console
a foreign key from an array element              ->  42804 foreign key constraint "ty_arr_fk_ids_fkey" cannot be implemented
```

**There is no foreign key from array elements.** Nothing stops an array holding an id that
does not exist, or keeps it consistent when the referenced row is deleted. That is the single
biggest reason to prefer a child table for anything referential.

The full list of what you give up:

| Need | Array | Child table |
|---|---|---|
| Referential integrity | **no** (`42804`) | yes |
| Per-element constraints | only via a whole-array `CHECK` | yes, ordinary column constraints |
| Per-element extra columns (added_at, position, quantity) | **no** | yes |
| Update one element without rewriting the row | **no** — MVCC rewrites the whole row | yes |
| Ordering preserved | **yes**, for free | needs a position column |
| Fetch with the parent, no join | **yes** | needs a join or a second query |

The MVCC row-rewrite point matters for hot data: changing one tag rewrites the entire row
including every other column, which is a new row version and possibly a
[non-HOT update](../phase-11-mvcc/05-mvcc.md).

## Choosing

**Use an array when** the elements are simple values, belong wholly to the parent, are read
together with it, and are replaced rather than individually edited — tags, labels, a list of
enabled feature flags, a small ordered set of scores.

**Use a child table when** elements reference other tables, need their own attributes, are
edited individually, are numerous, or need to be counted and grouped across parents.

Unnesting back into rows is easy when you need relational operations anyway:

```console
unnest to rows: [{"tag":"common","n":1000},{"tag":"x6","n":143},{"tag":"x1","n":143}]
```

```sql
SELECT tag, count(*) FROM docs, unnest(tags) AS tag GROUP BY tag ORDER BY count(*) DESC;
```

That is a lateral join in disguise, and it is how most "top tags" queries are written.
`unnest` is also the fast path for bulk operations from Node — [measured in phase 4](../phase-4-crud/19-values-unnest.md),
5000 rows through 3 parameters.

## From Node

`pg` maps arrays natively in both directions:

```js
// JS array -> text[]
await pool.query('INSERT INTO docs (tags) VALUES ($1)', [['a', 'b', 'c']]);

// text[] -> JS array
const {rows} = await pool.query('SELECT tags FROM docs WHERE id = $1', [id]);
rows[0].tags;      // ['a','b','c']

// the indexable membership form
await pool.query('SELECT * FROM docs WHERE tags @> $1', [['t42']]);
```

Two things to watch. **An empty JavaScript array becomes `{}`**, an empty array — not
`NULL`, so `cardinality()` is 0 and `array_length()` is NULL. And `= ANY($1)` with an array
parameter is the idiom for an `IN` list — which is a different use of `ANY` from array
membership, and this one *is* indexable because it expands against a scalar column:

```js
// IN-list against a scalar column — fine, uses a normal B-tree index
await pool.query('SELECT * FROM users WHERE id = ANY($1)', [[1, 2, 3]]);
```

## Trade-off

**An array buys locality and ordering, and gives up referential integrity and per-element
manipulation.** Measured, containment with a GIN index is fast (4.8 ms over 200 000 rows), so
performance is rarely the deciding factor — the deciding factor is whether anything else in
the schema needs to point at those elements, and whether they are edited individually. The
subtle cost is MVCC: every element change rewrites the whole row. Arrays are for values that
travel with the row; child tables are for entities.

## Gotchas

**Symptom:** `arr[0]` is always NULL
**Cause:** PostgreSQL arrays are 1-based
**Fix:** `arr[1]`; note out-of-range returns NULL rather than erroring

**Symptom:** A GIN index exists but the query still scans
**Cause:** `= ANY(tags)` is not indexable — measured 41.8 ms vs 4.8 ms for `@>`
**Fix:** Rewrite as `tags @> ARRAY['x']`

**Symptom:** `42804 foreign key constraint cannot be implemented`
**Cause:** Foreign keys from array elements do not exist
**Fix:** Use a child table when referential integrity matters

**Symptom:** Arithmetic on `array_length()` yields NULL
**Cause:** It returns NULL for an empty array
**Fix:** `cardinality()`, which returns 0

**Symptom:** Updating one tag bloats the table
**Cause:** MVCC rewrites the entire row for any change
**Fix:** A child table if elements change independently and often

**Symptom:** An array of ids contains values that no longer exist
**Cause:** Nothing enforces referential integrity
**Fix:** A child table, or a periodic reconciliation job if you keep the array

## Interview questions

**★ Are PostgreSQL arrays 0- or 1-based?**
1-based, and an out-of-range subscript returns NULL rather than raising an error. Measured:
`(ARRAY['a','b','c'])[0]` is NULL.

**★ Which array operators can use an index?**
`@>`, `<@` and `&&` with a GIN index — measured 73.2 ms → 4.8 ms on 200 000 rows.
`= ANY(arr)` cannot, and fell back to a sequential scan at 41.8 ms.

**★ When do you use an array rather than a child table?**
When the elements are simple values owned entirely by the parent, read with it, and replaced
rather than edited individually. Tags are the canonical case.

**★ What can a child table do that an array cannot?**
Foreign keys (measured `42804` when attempted), per-element constraints and extra columns,
and updating one element without rewriting the whole row.

**★ `array_length()` or `cardinality()`?**
`cardinality()` — it returns 0 for an empty array where `array_length()` returns NULL and
poisons any arithmetic.

**How do arrays map to Node?**
Directly: a JavaScript array in, a JavaScript array out. An empty JS array becomes an empty
SQL array, not NULL.

**How do you aggregate across array elements?**
`unnest()` in the `FROM` clause turns them into rows: `FROM docs, unnest(tags) AS tag GROUP
BY tag`.

---

← [boolean, date, interval](09-boolean-dates.md) · Next → [enum vs CHECK vs lookup](11-enum-check-lookup.md)
