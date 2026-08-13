---
title: "GIN for jsonb, arrays and full text; pg_trgm for LIKE"
sidebar_label: "11 · GIN and trigrams"
sidebar_position: 11
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 on **PostgreSQL 18.4** (`postgres:18-alpine`, `127.0.0.1:55432`),
> **Node 24.19.0**, `pg` 8.23.0. Script: `sandbox/pg-api/ex25-index-kinds.mjs`.

**A B-tree indexes a value. GIN indexes the *parts* of a value — each key in a `jsonb`
document, each element of an array, each word of a text field, each three-character run
of a string. That is what makes `@>`, `@@` and `LIKE '%x%'` indexable.**

## jsonb containment — and where GIN stops winning

300 000 rows. Both ends of the selectivity range measured, not just the flattering one:

```console
$ node ex25-index-kinds.mjs
=== 4. GIN — jsonb, arrays, full text ===
selective @>, no index  : ->  Parallel Seq Scan on g_items → 58.166 ms
broad     @>, no index  : ->  Parallel Seq Scan on g_items → 91.850 ms
selective @>, with GIN  : ->  Bitmap Heap Scan on g_items  → 0.447 ms | hit=11 read=1
broad     @>, with GIN  : ->  Bitmap Heap Scan on g_items  → 150.558 ms | hit=348 read=6936 written=5188
  gin size: 24 MB | heap: 57 MB
```

- `doc @> '{"sku": "sku-123456"}'` — one row. **58 ms → 0.447 ms, 130×.**
- `doc @> '{"tags": ["t3"]}'` — 48 000 rows, 16% of the table. **The GIN plan was
  *slower* than the sequential scan**, 150 ms against 92 ms.

The same rule as [scan types](04-scan-types.md) applies to GIN: an index that has to
return a sixth of the table is not helping. GIN is for needles.

## `jsonb_ops` versus `jsonb_path_ops`

```console
  jsonb_path_ops size: 19 MB ← smaller, but cannot serve ? / ?| / ?&
doc ? 'discount', only jsonb_path_ops present: ->  Parallel Seq Scan on g_items → 42.061 ms
doc ? 'discount', default jsonb_ops present : ->  Bitmap Heap Scan on g_items   → 0.064 ms
```

`jsonb_path_ops` is 19 MB against 24 MB and faster for `@>`, because it hashes whole
paths instead of storing every key and value separately. The price is exactly what the
measurement shows: **the key-existence operators `?`, `?|` and `?&` fall back to a
sequential scan** — 42 ms versus 0.064 ms.

Default to `jsonb_ops` unless you know you only ever use `@>`.

## Arrays and full text, same index type

```console
tags @> ARRAY['t3']     : ->  Bitmap Heap Scan on g_items → 33.488 ms | hit=7204
full text @@            : ->  Bitmap Heap Scan on g_items → 0.312 ms | hit=12
```

```sql
CREATE INDEX ON g_items USING gin (tags);
CREATE INDEX ON g_items USING gin (to_tsvector('english', body));
```

The full-text query — `to_tsvector('english', body) @@ to_tsquery('english','fox &
12345')` — returned one row in **0.312 ms from 12 buffers**. That is GIN doing what it is
for. The array query returned 48 000 rows and shows the same broad-predicate mediocrity
as the jsonb case.

Note the full-text index is an [expression index](10-expression.md), so the query must
spell `to_tsvector('english', body)` identically. A `GENERATED ALWAYS AS (…) STORED`
`tsvector` column avoids that.

## The write cost is real

```console
GIN write cost — 20000 inserts:
 with 4 GIN indexes   448 ms
 with none            142 ms
gin_pending_list_limit: 4MB — GIN buffers inserts in a pending list, so the cost is deferred, not avoided
```

**3.2× on inserts.** GIN softens this with a pending list — new entries are appended
cheaply and merged later — which means the cost shows up somewhere other than the
`INSERT` that caused it: in a `VACUUM`, or in a query that has to scan the unmerged
pending list. `fastupdate = off` trades insert speed for predictable reads.

## `pg_trgm`: making `LIKE '%x%'` indexable

```console
=== 5. pg_trgm — indexing LIKE '%x%' ===
infix LIKE, btree only  : ->  Parallel Seq Scan on e_users → 58.931 ms | hit=108 read=7020
infix LIKE, gin_trgm_ops: ->  Bitmap Heap Scan on e_users  → 21.785 ms | hit=449 read=2
  trgm index size: 13 MB | btree on same column: 31 MB
ILIKE                   : ->  Bitmap Heap Scan on e_users  → 23.615 ms
```

```sql
CREATE EXTENSION pg_trgm;
CREATE INDEX ON e_users USING gin (email gin_trgm_ops);
```

A trigram index stores every three-character run, so any substring long enough to contain
one can be looked up. `ILIKE` comes along for free.

```console
trigrams of "abcd": [ '  a', ' ab', 'abc', 'bcd', 'cd ' ]
pattern shorter than 3  : ->  Bitmap Heap Scan on e_users → 167.947 ms
```

**`LIKE '%99%'` used the index and took 167 ms** — slower than the 41 ms sequential scan
it replaced. A two-character pattern produces almost no distinguishing trigrams, so the
index returns most of the table and the recheck does the rest. Short search terms are
where trigram search disappoints, and the usual mitigation is a minimum query length in
the application.

## Distance ordering needs GiST, not GIN

```console
<-> ordering, GIN trgm  : ->  Parallel Seq Scan on e_users → 766.569 ms
<-> ordering, GiST trgm : ->  Index Scan using e_users_email_trgm_gist → 109.946 ms
  gist trgm size: 48 MB
```

`ORDER BY col <-> 'text'` is a nearest-neighbour search. **GIN cannot do it at all** —
766 ms of sequential scan. `gist_trgm_ops` can, at 110 ms, and costs 48 MB against GIN's
13 MB.

So: **GIN for "does it match", GiST for "how close is it"**. See
[GiST, BRIN and hash](15-gist-brin-hash.md).

## In SQL

```sql
CREATE INDEX ON t USING gin (doc);                              -- jsonb, all operators
CREATE INDEX ON t USING gin (doc jsonb_path_ops);               -- @> only, smaller
CREATE INDEX ON t USING gin (tags);                             -- arrays
CREATE INDEX ON t USING gin (to_tsvector('english', body));     -- full text
CREATE INDEX ON t USING gin (email gin_trgm_ops);               -- LIKE '%x%', ILIKE
CREATE INDEX ON t USING gist (email gist_trgm_ops);             -- similarity ordering

-- a single jsonb field queried by equality does not need GIN at all
CREATE INDEX ON t ((doc->>'sku'));                              -- plain B-tree, much smaller

CREATE INDEX ON t USING gin (doc) WITH (fastupdate = off);      -- predictable reads
```

That fourth-from-last line is worth taking seriously: if you always query one known
field, a B-tree on `(doc->>'field')` is a fraction of the size of a GIN index over the
whole document.

## From Node

```js
// containment — pass the whole jsonb fragment as one parameter
const {rows} = await pool.query(
  `SELECT id, doc FROM g_items WHERE doc @> $1::jsonb LIMIT 20`,
  [JSON.stringify({sku})]);

// array overlap
await pool.query(`SELECT id FROM g_items WHERE tags @> $1::text[]`, [[tag]]);

// substring search — build the pattern in JS, never concatenate into the SQL
await pool.query(`SELECT id FROM e_users WHERE email ILIKE $1 LIMIT 20`, [`%${term}%`]);
```

Two practical notes. `pg` returns `jsonb` already parsed, so `rows[0].doc` is an object —
see [type parsing](../phase-7-pg-driver/08-type-parsing.md). And enforce a minimum
length on `term` before running the trigram query; below three characters the index makes
things worse, as measured above.

## Trade-off

**GIN buys operators a B-tree cannot express, at roughly 3× the insert cost and an index
that can rival the table in size.** 24 MB of index against 57 MB of heap here, and
448 ms versus 142 ms for 20 000 inserts.

It is also selectivity-sensitive in a way that catches people out: it was 130× faster on
a one-row match and *slower than a sequential scan* on a 16% match. Before adding one, ask
how many rows the query actually returns.

For full text beyond a single table, this is where PostgreSQL's built-in search stops
being obviously the right tool — no ranking tuning, no fuzzy matching across fields, no
faceting. It is excellent for "find the document", weaker for "build a search product".

## Gotchas

**Symptom:** GIN index exists and the query is slower than before
**Cause:** The predicate matches a large fraction of the table
**Fix:** Measure the row count; 16% was already a loss in the measurement above

**Symptom:** `doc ? 'key'` sequential-scans with a GIN index present
**Cause:** The index uses `jsonb_path_ops`, which supports only `@>`
**Fix:** Use the default `jsonb_ops`, or add a second index

**Symptom:** `ORDER BY col <-> 'x'` ignores the trigram index
**Cause:** Distance ordering is a GiST capability; GIN has no such operator
**Fix:** `CREATE INDEX ... USING gist (col gist_trgm_ops)`

**Symptom:** Short search terms are slower than no index at all
**Cause:** Under three characters there are too few distinguishing trigrams
**Fix:** Enforce a minimum term length in the application

**Symptom:** Inserts slowed after adding GIN indexes, and `VACUUM` got slow too
**Cause:** The pending list defers merge work rather than removing it
**Fix:** Accept it, or `fastupdate = off` to pay on insert instead

**Symptom:** Full-text index unused
**Cause:** The query's `to_tsvector(...)` does not match the indexed expression exactly —
often a different configuration name
**Fix:** Match it character for character, or use a stored generated `tsvector` column

## Interview questions

**★ What does GIN index that a B-tree cannot?**
The components of a composite value — jsonb keys and values, array elements, lexemes,
trigrams — which is what makes `@>`, `@@`, `?` and `LIKE '%x%'` indexable.

**★ When is a GIN index a bad idea?**
When the predicate is not selective. Measured: 130× faster on a one-row match, but
150 ms versus 92 ms for a sequential scan on a 16% match.

**★ `jsonb_ops` or `jsonb_path_ops`?**
`jsonb_path_ops` is smaller (19 MB vs 24 MB) and faster for `@>`, but cannot serve `?`,
`?|` or `?&` — measured 42 ms sequential scan versus 0.064 ms with `jsonb_ops`. Default to
`jsonb_ops`.

**★ How do you make `LIKE '%term%'` fast?**
`CREATE EXTENSION pg_trgm` then a GIN index with `gin_trgm_ops` — 58.9 ms to 21.8 ms
measured, and `ILIKE` benefits too. Enforce a minimum term length of three characters.

**Why would you use GiST rather than GIN for trigrams?**
GiST supports the `<->` distance operator for similarity ordering. Measured: GIN fell back
to a 766 ms sequential scan, GiST did it in 110 ms — for 48 MB against 13 MB.

**Is GIN always right for jsonb?**
No. If you query one known field by equality, a B-tree on `(doc->>'field')` is far smaller
and faster to maintain.

---

← [Expression indexes](10-expression.md) · Next → [CREATE INDEX CONCURRENTLY](12-concurrently.md)
