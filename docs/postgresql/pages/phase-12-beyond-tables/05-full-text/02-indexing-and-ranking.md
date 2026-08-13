---
title: "Indexing and ranking"
sidebar_label: "02 · Indexing and ranking"
sidebar_position: 2
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 on **PostgreSQL 18.4** (`postgres:18-alpine`, `127.0.0.1:55432`),
> **Node 24.19.0**, `pg` 8.23.0. Script: `sandbox/pg-api/ex45-search.mjs`.

**Unindexed full-text search re-tokenises every row on every query**, which on
200 002 products took **1165 ms**. Indexing it takes one `CREATE INDEX` and one
piece of knowledge about why the obvious form is rejected.

## The baseline

```console
$ node ex45-search.mjs
=== 3. searching without an index ===
no index    1165.3 ms  → ->  Parallel Seq Scan on fts_products
```

Every row's `body` is being converted to a `tsvector` and thrown away, for every
query. The conversion is the expensive part, not the matching.

## The `42P17` trap

```console
=== 4. the IMMUTABLE trap when indexing ===
CREATE INDEX ... gin (to_tsvector(body)) → 42P17 functions in index expression must be marked IMMUTABLE
  ↑ the one-arg form depends on default_text_search_config, a session setting
with an explicit config it is accepted; index size: 13 MB
```

`to_tsvector(body)` works in a query and is **rejected in an index**. The
one-argument form reads `default_text_search_config`, a session setting, so two
sessions could produce different vectors for the same row — and an index whose
contents depend on who wrote them is not an index.

```sql
CREATE INDEX fts_body_gin ON fts_products USING gin (to_tsvector('english', body));
```

Naming the configuration makes the expression `IMMUTABLE`, and it is accepted. The
same rule governs every expression index — see
[Phase 10 · Expression indexes](../../phase-10-indexes/10-expression.md).

## The payoff, and the exact-match rule

```console
=== 5. the same search with the index ===
GIN index    17.36 ms  → ->  Bitmap Heap Scan on fts_products
'simple' config, same index → ->  Parallel Seq Scan on fts_products
```

**1165 ms → 17.36 ms**, a Bitmap Heap Scan driven by the GIN index.

The second line is the rule you must internalise: **the query's expression has to
match the index's expression exactly.** The same query with `'simple'` instead of
`'english'` is a different expression, so the index is invisible to it and the
plan falls back to a sequential scan. One index per configuration you actually
search with.

## A generated column instead

```sql
ALTER TABLE fts_products ADD COLUMN tsv tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce(title,'')), 'A') ||
    setweight(to_tsvector('english', coalesce(body ,'')), 'B')) STORED;
CREATE INDEX fts_tsv_gin ON fts_products USING gin (tsv);
```

```console
=== 6. a generated tsvector column instead of an expression index ===
generated column + GIN    17.87 ms → ->  Bitmap Heap Scan on fts_products
column size on disk: 51 MB | tsv index: 13 MB
```

**The same speed — 17.87 ms against 17.36 ms.** The index is the same size; the
difference is that the vector is now materialised in the table, which is why the
heap grew to 51 MB.

So the generated column is not faster. It is chosen for three other reasons:

1. **It combines several columns.** An expression index can only index one
   expression; here `title` and `body` are merged into one searchable vector.
2. **It carries weights** (below), which an expression index could also do but far
   less readably.
3. **Queries are simpler and harder to get wrong** — `WHERE tsv @@ ...` rather
   than repeating `to_tsvector('english', body)` at every call site, where one
   mismatch silently loses the index.

`GENERATED ALWAYS AS ... STORED` means PostgreSQL maintains it; there is no
trigger to write and no way for it to drift from the source columns. Before
generated columns this needed a `BEFORE INSERT OR UPDATE` trigger, which is what
older documentation still describes.

`coalesce(...,'')` is required: `to_tsvector` of `NULL` is `NULL`, and `NULL ||
anything` is `NULL`, so one null column would blank the whole vector.

## Weights

```console
a weighted tsvector: 'correct':5B 'router':2A,8B 'special':3A 'spell':6B 'wireless':1A,7B ...
↑ :A came from the title, :B from the body
```

`setweight` labels lexemes `A`, `B`, `C` or `D`. Note `'router':2A,8B` — the word
appears in both the title and the body, and the vector records both.

Weights do nothing on their own; they are input to ranking. The default weights
are `{0.1, 0.2, 0.4, 1.0}` for `D, C, B, A` — so a title match counts five times a
body match.

## Ranking

```console
=== 7. ranking ===
┌─────────┬───────────────────────────┬──────────┬──────────┐
│ (index) │ title                     │ rank     │ rank_cd  │
├─────────┼───────────────────────────┼──────────┼──────────┤
│ 0       │ 'wireless router special' │ '0.9988' │ '1.5143' │
└─────────┴───────────────────────────┴──────────┴──────────┘
normalization flag 32 (rank/(rank+1)): { default_rank: '0.243171', norm_32: '0.195605' }
```

| Function | Considers |
|---|---|
| `ts_rank` | frequency and weight of the matching lexemes |
| `ts_rank_cd` | also **cover density** — how close the terms are to each other |

`ts_rank_cd` is generally better for multi-word queries, because two words next to
each other usually indicate a better match than the same two words far apart. Note
its value is not bounded to 0–1.

**Ranking is not indexable.** The index finds the matching rows; `ts_rank` then
runs on each one, so `ORDER BY ts_rank(...) DESC LIMIT 10` computes a rank for
every match before sorting. On a query matching 13 000 rows that is fine; on one
matching a million it is the slow part, and the fix is to narrow the match rather
than to optimise the rank.

The normalization flag divides the rank by document length so long documents do
not win by having more words. `32` is `rank/(rank+1)`, which bounds the result
into 0–1 — measured, `0.243171` became `0.195605`.

## Snippets

```console
=== 8. ts_headline for snippets ===
<b>running</b> and <b>jumping</b>. Item 1
↑ ts_headline re-reads the original text, so it cannot use the index
```

`ts_headline` produces the highlighted excerpt for a result list. It works on the
**original text**, not the vector — it has to, since the vector has no word order
or punctuation.

That makes it expensive: it re-tokenises the document per row. **Apply it after
`LIMIT`, never before:**

```sql
SELECT id, title, ts_headline('english', body, q, 'MaxWords=12, MinWords=5')
  FROM (SELECT id, title, body FROM fts_products
         WHERE tsv @@ q ORDER BY ts_rank(tsv, q) DESC LIMIT 10) s,
       websearch_to_tsquery('english', $1) q
```

Ten headlines instead of thirteen thousand.

## What full-text search cannot find

```console
=== 13. each one failing at the other's job ===
user types 'router'; the document says 'routr':
  full-text @@  → 0 rows
```

**A misspelling in the document is invisible to a correctly spelled query.**
Stemming normalises grammatical variation, not typos — `routr` and `router` are
simply different lexemes.

That is the boundary of this tool, and the reason
[pg_trgm](../06-pg-trgm.md) exists. The two are complementary and a production
search usually runs both: full-text for relevance, trigram as a fallback when it
returns nothing.

## Trade-off

A GIN index on a `tsvector` costs 13 MB against a 51 MB table here, and GIN is the
most expensive index kind to maintain — every insert adds an entry per lexeme.
Full-text search on a write-heavy table is a real write cost, mitigated but not
removed by GIN's pending list ([Phase 10](../../phase-10-indexes/11-gin-trgm.md)).

The generated column doubles down on that: the vector is stored as well as
indexed, so the table grew from its base size to 51 MB. You are trading disk and
write throughput for a 66× read improvement and much less error-prone queries.

For most applications that is obviously worth it, and it is worth it *before*
adding Elasticsearch — one index, no second system to keep in sync, and the search
sees committed data immediately.

## Gotchas

**Symptom:** `42P17 functions in index expression must be marked IMMUTABLE`
**Cause:** One-argument `to_tsvector(body)`, which depends on the session's
`default_text_search_config`.
**Fix:** Name the configuration: `to_tsvector('english', body)`.

**Symptom:** The index exists but the search still scans sequentially
**Cause:** The query's expression differs from the indexed one — a different
configuration, or a different column list. Measured: `'simple'` against an
`'english'` index fell back to a parallel sequential scan.
**Fix:** Match the expression exactly, or use a generated column so there is only
one spelling.

**Symptom:** The whole tsvector is `NULL` when one column is null
**Cause:** `to_tsvector(NULL)` is `NULL` and `NULL || x` is `NULL`.
**Fix:** `coalesce(col, '')` around every part.

**Symptom:** Search is fast but the endpoint is slow
**Cause:** `ts_headline` applied to every match rather than to the page.
**Fix:** Compute headlines in an outer query after `LIMIT`.

**Symptom:** Ranking dominates the query time
**Cause:** `ts_rank` is not indexable and runs per matching row.
**Fix:** Narrow the match; rank a smaller set.

**Symptom:** Long documents always outrank short ones
**Cause:** No normalization flag.
**Fix:** Pass one — `32` gives `rank/(rank+1)`, bounded 0–1.

**Symptom:** Writes slowed noticeably after adding search
**Cause:** GIN maintenance, one entry per lexeme per row.
**Fix:** Expected; the pending list defers it. Consider indexing only the columns
you truly search.

## Interview questions

**★ Why does `CREATE INDEX ... USING gin (to_tsvector(body))` fail?**
Because the one-argument form reads `default_text_search_config`, a session
setting, so it is not `IMMUTABLE` — two sessions could index the same row
differently. PostgreSQL raises `42P17`. Naming the configuration explicitly makes
it immutable and the index is accepted.

**★ What does indexing full-text search actually buy?**
Measured on 200 002 rows: 1165.3 ms with a parallel sequential scan against
17.36 ms with a Bitmap Heap Scan — about 66×. Without an index every row is
re-tokenised on every query, and the tokenising is the expensive part.

**★ Expression index or a generated `tsvector` column?**
They perform the same — measured 17.36 ms against 17.87 ms with identical 13 MB
indexes. Choose the generated column to combine several columns into one vector,
to carry `setweight` weights, and so queries say `WHERE tsv @@ ...` rather than
repeating the expression at every call site, where one mismatch silently loses the
index. The cost is that the vector is stored: the table grew to 51 MB.

**★ How do weights and ranking fit together?**
`setweight` labels lexemes A–D — typically A for the title, B for the body — and
the vector records both when a word appears in each, e.g. `'router':2A,8B`.
Weights do nothing until `ts_rank` uses them, with default multipliers
`{0.1, 0.2, 0.4, 1.0}` for D–A. `ts_rank_cd` additionally accounts for how close
the matched terms are.

**★ Why is `ts_headline` slow, and what do you do about it?**
It works on the original text rather than the vector — it needs word order and
punctuation — so it re-tokenises each document and cannot use the index. Apply it
in an outer query after `LIMIT`, so it runs for ten rows rather than every match.

**What can full-text search never find?**
A misspelling in the document when the query is spelled correctly — measured, 0
rows for `router` against a document containing `routr`. Stemming normalises
grammar, not typos. That is what pg_trgm is for.

---

← [tsvector and tsquery](01-tsvector-and-queries.md) · Next → [pg_trgm similarity](../06-pg-trgm.md)
