---
title: "pg_trgm similarity and fuzzy matching"
sidebar_label: "06 · pg_trgm fuzzy"
sidebar_position: 6
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 on **PostgreSQL 18.4** (`postgres:18-alpine`, `127.0.0.1:55432`),
> **Node 24.19.0**, `pg` 8.23.0. Script: `sandbox/pg-api/ex45-search.mjs`.

**`pg_trgm` compares strings by the three-character sequences they share, which
is why it finds typos that full-text search cannot — and why it has no idea that
`jumped` and `jumping` are the same word.** It also makes `ILIKE '%x%'`
indexable, which is the reason most people install it.

## Trigrams

```console
$ node ex45-search.mjs
=== 10. trigrams, similarity and distance ===
show_trgm('router') → {"  r"," ro","er ",out,rou,ter,ute}
```

The string is padded with spaces and cut into overlapping three-character
sequences. Similarity is then the overlap between two such sets — how many
trigrams they share, relative to how many they have in total.

```console
router           vs router           sim=1.000 dist=0.000 word_sim=1.000
router           vs routr            sim=0.444 dist=0.556 word_sim=0.571
router           vs routers          sim=0.667 dist=0.333 word_sim=0.857
router           vs route            sim=0.625 dist=0.375 word_sim=0.714
router           vs kettle           sim=0.000 dist=1.000 word_sim=0.000
wireless router  vs wireles routr    sim=0.579 dist=0.421 word_sim=0.647
```

`<->` is distance, simply `1 - similarity`. Nothing here understands language:
`routers` scores 0.667 against `router` not because it is a plural but because
the strings overlap.

## `%` compares whole strings — the trap

This is the mistake that makes people conclude pg_trgm does not work:

```console
=== 11. % compares WHOLE strings — the trap ===
query 'routr' vs title 'wireles routr special': { whole_string: '0.273', word_level: '1.000' }
thresholds → similarity: 0.3 | word_similarity: 0.6

title %  'routr'   (whole-string) → 0 rows
'routr' <% title    (word-level)  → 13336 rows
↑ % scores the query against the ENTIRE title, so one word inside a long
  title scores below the threshold. <% scores against the best word.
```

**`similarity('routr', 'wireles routr special')` is 0.273** — below the 0.3
threshold — even though the title contains the word exactly. The query is being
compared against the *whole title*, and most of that title is other words.

`word_similarity` compares the query against the best-matching **continuous
substring**, so the same pair scores **1.000**.

| Operator | Function | Compares |
|---|---|---|
| `%` | `similarity` | the two whole strings |
| `<%` | `word_similarity` | query against the best-matching extent of the target |
| `<<%` | `strict_word_similarity` | as above, but respecting word boundaries |
| `<->` | `1 - similarity` | whole-string distance, for `ORDER BY` |

**Use `%` when the column holds one short value** — a name, an email, a SKU. **Use
`<%` when searching for a word inside a longer field**, which is the common case
for titles and descriptions. Note the argument order: the query goes on the *left*
of `<%`.

Each operator has its own threshold GUC, and they differ: `similarity_threshold`
is **0.3**, `word_similarity_threshold` is **0.6**.

## Ordering by distance

```console
┌─────────┬───────────────────────────┬─────────┐
│ (index) │ title                     │ sim     │
├─────────┼───────────────────────────┼─────────┤
│ 0       │ 'wireles routr special'   │ '0.636' │
│ 1       │ 'wireless router special' │ '0.407' │
│ 2       │ 'wireless lamp 3'         │ '0.304' │
└─────────┴───────────────────────────┴─────────┘
```

```sql
SELECT title FROM fts_products ORDER BY title <-> 'wireles routr' LIMIT 5
```

This is "did you mean" — a ranked list of nearest strings with no threshold at
all. It is the right shape for a spelling-correction suggestion.

## The indexes

```console
=== 12. the cost, and the index that fixes it ===
% similarity, no trgm index    247.7 ms → ->  Parallel Seq Scan on fts_products
ILIKE '%routr%', no index       87.0 ms → ->  Parallel Seq Scan on fts_products
% similarity, GIN trgm         62.01 ms → ->  Bitmap Heap Scan on fts_products
ILIKE '%routr%', GIN trgm       1.13 ms → ->  Bitmap Heap Scan on fts_products
trgm index size: 9016 kB | fts tsv index: 13 MB
```

**`ILIKE '%routr%'` went from 87.0 ms to 1.13 ms — 77×.** This is the headline
feature: a leading-wildcard `LIKE`/`ILIKE` cannot use a B-tree at all, and a
trigram index makes it indexable. It is often the entire reason to install the
extension.

Similarity search improved less dramatically — 247.7 ms to 62.01 ms — because the
predicate is far less selective, so the index returns many candidates that still
need rechecking.

At 9016 kB the trigram index is smaller than the 13 MB full-text index over the
same table.

### GIN or GiST

```console
ORDER BY <-> with GIN only  → ->  Parallel Seq Scan on fts_products
ORDER BY <-> with GiST      → ->  Index Scan using fts_title_trgm_gist on fts_products
  110.9 ms | gist size: 22 MB
```

**`ORDER BY <->` needs GiST.** GIN cannot serve a distance ordering — it has no
notion of nearest-neighbour — so with only a GIN index present the plan was a
parallel sequential scan. Adding `gist_trgm_ops` turned it into an `Index Scan`.

| | GIN `gin_trgm_ops` | GiST `gist_trgm_ops` |
|---|---|---|
| Size here | **9016 kB** | 22 MB |
| `ILIKE`, `%`, `<%` | **faster** | works |
| `ORDER BY <->` | **not supported** | **supported** |

GIN for filtering, GiST when you need ranked nearest-neighbour results. Both is
legitimate if you do both, at the cost of maintaining two indexes.
[Phase 10 · GIN and trigram](../phase-10-indexes/11-gin-trgm.md) has the
index-mechanics detail.

## Against full-text search

```console
=== 13. each one failing at the other's job ===
user types 'router'; the document says 'routr':
  full-text @@  → 0 rows
  trigram   <%  → 0 rows  (word_similarity = 0.571, threshold 0.6)
  ↑ the DEFAULT threshold is too strict for this typo. Lowering it:
    threshold 0.6 → misspelled row found: no  · total rows matched: 13335
    threshold 0.55 → misspelled row found: YES · total rows matched: 13336
    threshold 0.5 → misspelled row found: YES · total rows matched: 13336
    threshold 0.4 → misspelled row found: YES · total rows matched: 13336

user types 'jumped'; the documents say 'jumping':
  full-text @@  → 200000 rows  (both stem to 'jump')
  trigram   <%  → 0 rows
↑ neither is a substitute for the other
```

Three things worth taking from that.

**Full-text search cannot cross a typo.** `router` against a document containing
`routr` returned nothing, however it is indexed.

**Trigram did not find it either — at the default threshold.** `word_similarity`
was 0.571 against a threshold of 0.6. The default is tuned conservatively, and
out of the box it misses a one-character typo in a six-letter word.

**Lowering the threshold to 0.55 found it at no cost.** The match count went from
13 335 to 13 336 — the misspelled row and nothing else. So the threshold is a knob
you are expected to tune against your own data, and leaving it at the default is a
decision, not a neutral choice. Tune it by measuring both numbers: did the target
appear, and how much noise came with it.

**And trigram has no concept of stemming.** `jumped` matched 200 000 documents
containing `jumping` under full-text search and **zero** under trigram.

### Using both

The usual production shape is full-text first, trigram as a fallback:

```sql
-- 1. relevance
SELECT id, title FROM fts_products
 WHERE tsv @@ websearch_to_tsquery('english', $1)
 ORDER BY ts_rank_cd(tsv, websearch_to_tsquery('english', $1)) DESC LIMIT 20;

-- 2. only if that returned nothing: "did you mean"
SELECT id, title FROM fts_products
 ORDER BY title <-> $1 LIMIT 5;
```

Running both unconditionally and merging is possible but rarely worth it — the
trigram results are noisier, and the second query only earns its keep when the
first fails.

## Trade-off

pg_trgm gives you fuzzy matching and indexable `ILIKE` for one extension and one
index. What it costs is precision: it is a string-overlap metric with no idea what
a word means, so its results are inherently noisier than full-text search, and
every use of it involves a threshold that you have to tune and that will be wrong
for some inputs.

It is also a poor fit for long text. Similarity against a whole description is
meaningless — the `%` trap above — and even `<%` gets less discriminating as
fields grow. Trigram belongs on short, identifier-like fields: names, titles,
emails, SKUs. Full-text search belongs on prose.

## Gotchas

**Symptom:** `%` returns nothing although the word is in the column
**Cause:** `similarity` compares whole strings. Measured: `'routr'` against
`'wireles routr special'` scored 0.273, below the 0.3 threshold, while
`word_similarity` scored 1.000.
**Fix:** `'routr' <% title` — and note the query goes on the left.

**Symptom:** `<%` matches nothing at all
**Cause:** Its threshold is `word_similarity_threshold`, default **0.6** — a
different GUC from `%`'s 0.3.
**Fix:** `SET pg_trgm.word_similarity_threshold = 0.55`, tuned against your data.

**Symptom:** A one-character typo is not found
**Cause:** The default threshold is too strict. Measured: `word_similarity` 0.571
against a 0.6 threshold, so 0 rows; at 0.55 the row was found with no extra noise.
**Fix:** Lower the threshold, measuring both the hit and the false-positive count.

**Symptom:** `ORDER BY col <-> $1` sequentially scans despite a trigram index
**Cause:** The index is GIN, which cannot serve distance ordering. Measured: a
parallel sequential scan.
**Fix:** Add a `gist_trgm_ops` index.

**Symptom:** `ILIKE '%x%'` is slow
**Cause:** A leading wildcard cannot use a B-tree.
**Fix:** `gin_trgm_ops`. Measured: 87.0 ms → 1.13 ms.

**Symptom:** Fuzzy search on a description column returns nonsense
**Cause:** Trigram similarity is meaningless over long text.
**Fix:** Use it on short fields; use full-text search for prose.

**Symptom:** `jumped` finds nothing although documents say `jumping`
**Cause:** Trigram does no stemming. Measured: 0 rows against full-text's 200 000.
**Fix:** Full-text search for language-aware matching.

## Interview questions

**★ How does pg_trgm decide two strings are similar?**
It splits each into overlapping three-character sequences — measured,
`show_trgm('router')` gives `{"  r"," ro","er ",out,rou,ter,ute}` — and scores the
overlap between the two sets. It is purely lexical: `routers` scores 0.667 against
`router` because the strings overlap, not because it knows about plurals.

**★ Why does `%` fail to find a word inside a longer column?**
Because `similarity` compares the whole strings. Measured: `'routr'` against
`'wireles routr special'` scored 0.273, under the 0.3 threshold, so `%` returned 0
rows — while `word_similarity`, which compares against the best-matching substring,
scored 1.000 and `<%` returned 13 336. Use `%` for short values and `<%` for words
inside longer fields.

**★ What is the main reason to install pg_trgm?**
To make `LIKE '%x%'` and `ILIKE '%x%'` indexable — a leading wildcard cannot use a
B-tree. Measured: 87.0 ms sequential scan against 1.13 ms with a `gin_trgm_ops`
index, about 77×.

**★ When do you need GiST rather than GIN for trigrams?**
For `ORDER BY col <-> $1` — nearest-neighbour ranking, the "did you mean" query.
GIN cannot serve distance ordering; measured, it fell back to a parallel
sequential scan, while a `gist_trgm_ops` index produced an `Index Scan`. GIN is
smaller (9016 kB vs 22 MB) and faster for filtering.

**★ How do full-text search and trigram differ in what they can find?**
Measured both ways. A correctly-spelled query against a misspelled document:
full-text 0 rows — stemming normalises grammar, not typos. A stemmed variant
(`jumped` against documents saying `jumping`): full-text 200 000 rows, trigram 0 —
trigram has no concept of stemming. They are complements, not alternatives.

**Is the default similarity threshold safe to leave alone?**
No — it is a decision. Measured, the default `word_similarity_threshold` of 0.6
missed a one-character typo (score 0.571); lowering it to 0.55 found the row and
matched exactly one extra row in total. Tune it against your data by measuring
both the hit and the noise.

---

← [Full-text search](./full-text/) · Next → [Views](07-views.md)
