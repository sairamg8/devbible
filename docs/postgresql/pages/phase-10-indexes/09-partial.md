---
title: "Partial indexes"
sidebar_label: "09 · Partial indexes"
sidebar_position: 9
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 on **PostgreSQL 18.4** (`postgres:18-alpine`, `127.0.0.1:55432`),
> **Node 24.19.0**, `pg` 8.23.0. Script: `sandbox/pg-api/ex25-index-kinds.mjs`.

**A `WHERE` clause on `CREATE INDEX` indexes only the rows that match. When the hot subset
is 1% of the table, the index is 1% of the size — and the planner will only use it when it
can *prove* your query's predicate implies the index's.**

## 85× smaller for the same query

400 000 documents, 4000 of them live (`deleted_at IS NULL`):

```console
$ node ex25-index-kinds.mjs
=== 2. partial indexes ===
rows: 400000 | live (deleted_at IS NULL): 4000
full index : 8792 kB | partial index: 104 kB

predicate matches exactly    : ->  Index Scan using p_docs_live_idx on p_docs → 0.096 ms | hit=18
```

**8792 kB against 104 kB.** And the saving is not only disk: rows outside the predicate
are not indexed at all, so writes to the 99% of soft-deleted rows never touch this index.

This is the standard soft-delete shape. Almost every query filters `deleted_at IS NULL`,
so indexing the other 396 000 rows is pure waste.

## The predicate must be *implied*, not merely similar

The planner has to prove your `WHERE` guarantees the index's `WHERE`. It is better at
this than people expect:

```console
an equivalent the planner CAN prove (IS NOT DISTINCT FROM NULL): ->  Index Scan using p_docs_live_idx
extra AND on top of predicate: ->  Index Scan using p_docs_live_idx on p_docs → 0.125 ms
no predicate at all          : ->  Index Scan using p_docs_full_idx on p_docs → 0.103 ms
```

- `deleted_at IS NOT DISTINCT FROM NULL` — a different spelling, proven equivalent, index
  used.
- `state = 'published' AND deleted_at IS NULL` — **stricter** than the index predicate,
  which is fine: a stricter query is still contained in the indexed subset.
- No predicate at all — the partial index cannot be used, and it falls back to the full
  one. Drop that full index and this query has none.

What it cannot do is prove anything about a value it has not got. Here the index is
`WHERE state = 'published'`:

```console
WHERE state = 'published' (literal) : ->  Index Scan using p_docs_pub_idx on p_docs → 0.085 ms
same via PREPARE/EXECUTE ($1), 8th run — the generic plan:
Limit
  ->  Index Scan using p_docs_pub_idx on p_docs
```

The generic plan **did** still use it in this case — but that is a planner decision made
without knowing `$1`, not a guarantee. When a parameterised query stops using a partial
index, this is where to look; see
[prepared statements](../phase-7-pg-driver/10-prepared.md) for the custom-to-generic
switch.

**Write the query's predicate to match the index's, character for character, wherever you
can.** Relying on the prover is fragile in exactly the cases you care about.

## Partial `UNIQUE` — the other reason to reach for this

This is the feature with no alternative. "Slugs must be unique among *live* rows":

```sql
CREATE UNIQUE INDEX p_slugs_live_uq ON p_slugs (slug) WHERE deleted_at IS NULL;
```

```console
two soft-deleted "about" rows plus one live one: inserted OK
second LIVE "about" → 23505 p_slugs_live_uq | duplicate key value violates unique constraint "p_slugs_live_uq"
```

Any number of soft-deleted duplicates, exactly one live. A plain `UNIQUE (slug)` would
reject the second soft-deleted row and make soft delete unusable.

Note the SQLSTATE is the ordinary **`23505`**, and `err.constraint` names the index — so
it is handled exactly like any other unique violation. See
[soft delete](../phase-9-api-crud/09-delete-soft-hard.md) for the endpoint-level pattern.

## In SQL

```sql
-- hot subset
CREATE INDEX ON docs (id)         WHERE deleted_at IS NULL;
CREATE INDEX ON orders (user_id)  WHERE state IN ('new','paid');
CREATE INDEX ON jobs (run_at)     WHERE finished_at IS NULL;

-- uniqueness within a subset
CREATE UNIQUE INDEX ON slugs (slug) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX ON users (email) WHERE is_active;

-- see the predicate on an existing index
SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'p_docs';
```

The predicate may only reference columns of the table and immutable functions — the same
restriction as [expression indexes](10-expression.md), so `WHERE created_at > now()` is
rejected.

## From Node

The one rule that matters: **the constant in the index predicate must appear as a constant
in the query too.**

```js
// matches the index predicate exactly
const live = await pool.query(
  `SELECT id, title FROM p_docs WHERE deleted_at IS NULL AND state = $1
   ORDER BY id LIMIT $2`, ['published', 20]);
```

```sql
CREATE INDEX p_docs_live_idx ON p_docs (id) WHERE deleted_at IS NULL;
```

`deleted_at IS NULL` is written literally; only the *other* filter is parameterised. That
keeps the implication provable regardless of how the statement is planned.

Handle the partial-unique violation like any other:

```js
try {
  await pool.query(`INSERT INTO p_slugs (slug) VALUES ($1)`, [slug]);
} catch (e) {
  if (e.code === '23505' && e.constraint === 'p_slugs_live_uq') {
    throw new ConflictError('slug already in use');
  }
  throw e;
}
```

## Trade-off

**A partial index is smaller and cheaper, and serves fewer queries.** The full index
answered the no-predicate query at 0.103 ms; the partial one cannot answer it at all. If
some code paths query the whole table, you either keep both indexes — losing the saving —
or accept a sequential scan on those paths.

The predicate also becomes a hidden coupling: change the application's definition of
"live" and every partial index silently stops matching, with no error and no failing
test — just slower queries.

## Gotchas

**Symptom:** Partial index ignored despite an apparently matching query
**Cause:** The planner could not prove implication — often a parameter where the index has
a literal
**Fix:** Write the predicate literally in the query; compare `indexdef` to your `WHERE`

**Symptom:** It works from `psql` and not from the app
**Cause:** Generic plan for a prepared statement, planned without the parameter value
**Fix:** Keep the index predicate out of the parameterised part of the query

**Symptom:** `CREATE INDEX ... WHERE created_at > now()` rejected
**Cause:** `now()` is not immutable; predicates must be
**Fix:** Use a fixed cutoff and rebuild periodically, or index a boolean column

**Symptom:** Soft delete broke uniqueness
**Cause:** Plain `UNIQUE (slug)` counts deleted rows
**Fix:** `CREATE UNIQUE INDEX ... WHERE deleted_at IS NULL`

**Symptom:** A query that used to be fast slowed after dropping the "redundant" full index
**Cause:** That query has no predicate and the partial index cannot serve it
**Fix:** Check `idx_scan` on both before dropping either

## Interview questions

**★ What is a partial index and when do you use it?**
An index with a `WHERE` clause, covering only matching rows. Use it when queries always
filter on a small subset — measured 8792 kB full versus 104 kB partial for 4000 live rows
out of 400 000.

**★ What has to be true for the planner to use it?**
The query's predicate must *imply* the index's. Stricter predicates qualify; equivalent
spellings like `IS NOT DISTINCT FROM NULL` are proven; a query with no predicate cannot
use it.

**★ How do you make an email unique only among active users?**
`CREATE UNIQUE INDEX ON users (email) WHERE is_active` — the one thing a table constraint
cannot express. Violations still raise `23505` with `err.constraint` naming the index.

**Why might a partial index stop being used from the application but work in psql?**
A prepared statement's generic plan is built without the parameter value, so the
implication may not be provable. Keep the index predicate as a literal in the query.

**Can the predicate use `now()`?**
No — index predicates must be immutable, for the same reason
[expression indexes](10-expression.md) must be.

---

← [Index-only scans and INCLUDE](08-index-only.md) · Next → [Expression indexes](10-expression.md)
