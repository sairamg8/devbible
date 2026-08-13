---
title: "pgvector — embeddings and HNSW"
sidebar_label: "17 · pgvector"
sidebar_position: 17
---

<span className="db-tier t-when">Learn When Needed</span>

> Verified: 2026-08 on **PostgreSQL 18.4** (`pgvector/pgvector:pg18`,
> `127.0.0.1:55434`), **pgvector 0.8.6**, **Node 24.19.0**, `pg` 8.23.0. Script:
> `sandbox/pg-api/ex48-extensions-partitioning.mjs`.

**pgvector stores embeddings and finds the nearest ones.** It is what lets a
PostgreSQL you already run serve semantic search or retrieval-augmented generation
without adding a dedicated vector database.

## It is not in the stock image

```console
$ podman run -d --name devbible-pg-vector \
    -e POSTGRES_USER=devbible -e POSTGRES_PASSWORD=devbible -e POSTGRES_DB=devbible \
    -p 55434:5432 docker.io/pgvector/pgvector:pg18
```

```console
=== 10. pgvector — the type and the distance operators ===
server: PostgreSQL 18.4 (Debian 18.4-1.pgdg12+1)
pgvector version: 0.8.6
```

Everything else in this phase runs against `postgres:18-alpine`. **`vector` is not
in that image at all** — not merely uninstalled, absent — so no `CREATE EXTENSION`
can help. This topic needed a different server image, which is the practical
version of the point made in [Extensions](09-extensions.md): check
`pg_available_extensions` before designing around one.

The same applies to your provider. Most managed PostgreSQL now offers pgvector, but
"most" is not "all", and the version offered lags the project.

## The type and the distance operators

```sql
CREATE TABLE v_docs (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  embedding vector(384)
);
```

The dimension is fixed per column and must match your model — 384 for
`all-MiniLM-L6-v2`, 1536 for OpenAI's `text-embedding-3-small`. Changing model
means changing the column.

```console
┌─────────┬──────────┬──────────┬───────────┬─────────────┐
│ (index) │ l2       │ cosine   │ neg_inner │ cosine_same │
├─────────┼──────────┼──────────┼───────────┼─────────────┤
│ 0       │ '1.4142' │ '1.0000' │ '0.0000'  │ '0.0000'    │
└─────────┴──────────┴──────────┴───────────┴─────────────┘
<-> L2 · <=> cosine · <#> negative inner product (negated so ASC = nearest)
```

| Operator | Distance | Index opclass |
|---|---|---|
| `<->` | L2 / Euclidean | `vector_l2_ops` |
| `<=>` | cosine | `vector_cosine_ops` |
| `<#>` | negative inner product | `vector_ip_ops` |

**All three are *distances*, so `ORDER BY ... ASC` is always "nearest first".**
That is why inner product is negated — `<#>` returns the negative so ascending
order still means most similar.

Cosine of a vector with itself is `0.0000`, and of two orthogonal vectors
`1.0000`. **Use the distance your model was trained for** — for most sentence
embeddings that is cosine, and if your vectors are normalised, cosine and L2 rank
identically.

```console
adding vectors of different dimensions         → 22000 different vector dimensions 3 and 2
```

Dimension mismatches are caught, not silently coerced.

## Exact search, then HNSW

50 000 clustered 384-dimension vectors:

```console
=== 11. exact search vs an HNSW index ===
seeded 50000 clustered 384-dim vectors (200 clusters) in 20138 ms
table size: 78 MB

exact scan (no index)       88 ms
    Limit (actual rows=10.00 loops=1)
                  Sort Method: top-N heapsort  Memory: 25kB
                  ->  Parallel Seq Scan on v_docs (actual rows=16666.67 loops=3)
  10th-nearest distance: 0.3787
```

**Exact search reads every row.** 88 ms for 50 000 vectors — and it scales
linearly, so a million rows is seconds. It is also *exactly* right, which is worth
remembering: below a few tens of thousands of rows, no index is a legitimate
choice.

```sql
CREATE INDEX v_docs_hnsw ON v_docs USING hnsw (embedding vector_l2_ops);
```

```console
HNSW build: 22885 ms
index size: 98 MB
HNSW search                2.1 ms   (42x faster)
    Limit (actual rows=10.00 loops=1)
      ->  Index Scan using v_docs_hnsw on v_docs (actual rows=10.00 loops=1)
```

**88 ms → 2.1 ms, 42×.** Two numbers next to it deserve as much attention:

- **The build took 22.9 seconds** for 50 000 rows. HNSW builds a navigable graph;
  that cost grows with row count and is paid again on every `REINDEX`.
- **The index is 98 MB against a 78 MB table** — *larger than the data*. Budget for
  it.

## Approximate means approximate

```console
recall and result quality as ef_search rises:
  ef_search= 10 → recall 10/10 · 10th distance 0.3787 · 1.2 ms
  ef_search= 40 → recall 10/10 · 10th distance 0.3787 · 1.4 ms
  ef_search=100 → recall 10/10 · 10th distance 0.3787 · 1.8 ms
  ef_search=400 → recall 10/10 · 10th distance 0.3787 · 4.5 ms
```

**On this data HNSW returned the exact answer at every setting** — 10/10 recall and
an identical 10th-nearest distance — so raising `ef_search` bought nothing but
latency, 1.2 ms to 4.5 ms.

That is a real result and it needs its caveat stated plainly: **the fixture is 200
well-separated clusters**, which is what real embeddings tend to look like and is
the case HNSW handles easily. `ef_search` is the knob to raise when recall *is*
poor on your data — and this measurement shows it is not free, so raise it because
you measured bad recall, not preemptively.

Measure recall on **your** vectors: run the query with and without the index and
compare the result sets. An approximate index that silently returns the wrong
neighbours is the failure mode here, and nothing in the plan tells you.

| | HNSW | IVFFlat |
|---|---|---|
| Build time | slow (22.9 s here) | fast |
| Query speed | fastest | good |
| Recall | high | depends on `lists`/`probes` |
| Needs data before building | no | **yes** — clusters are learned from the rows |

**HNSW is the default choice.** IVFFlat builds much faster but must be built
*after* the table has representative data, and its recall depends on tuning
`lists` and `probes`.

## The dimension limit

```console
=== 12. the dimension limit ===
an index on a 2001-dimension vector            → 54000 column cannot have more than 2000 dimensions for hnsw index
```

**A `vector` column may hold up to 16 000 dimensions; an HNSW index caps at
2000.** So a 3072-dimension embedding can be stored and searched exactly, but not
HNSW-indexed. Options: use a model with fewer dimensions, reduce dimensions
(`halfvec` indexes up to 4000), or accept exact search.

## When it earns its place

**Yes:** you already run PostgreSQL, your corpus is thousands to low millions of
vectors, and you want the embedding stored *next to* the row it describes — so a
filter like `WHERE tenant_id = $1 AND status = 'live'` combines with the vector
search in one query. That last point is pgvector's real advantage over a separate
vector database: no two-system join, no sync, and the transaction covers both.

**No:** hundreds of millions of vectors, or a workload where vector search *is* the
product. Dedicated engines do that better.

Note the filter case has a sharp edge: a `WHERE` clause plus an HNSW `ORDER BY` can
force the index to search past many non-matching rows to find enough that match.
Partial indexes per tenant, or `iterative_scan` in pgvector 0.8+, address it — and
this is the thing to benchmark before committing.

## Trade-off

pgvector keeps embeddings in the database you already operate, back up and secure,
alongside the rows they belong to. That is a large operational saving against
running a second stateful system, and the ability to combine a relational filter
with a similarity search in one statement is the genuine technical win.

Against that: an index larger than the table, a build measured in tens of seconds
for 50 000 rows, approximate results with no signal when they are wrong, and a
2000-dimension ceiling on indexing. At small-to-moderate scale that is a good
trade; at the scale where vector search is the whole product, it is not.

## Gotchas

**Symptom:** `CREATE EXTENSION vector` fails on a stock PostgreSQL image
**Cause:** pgvector is not bundled — it is absent from `pg_available_extensions`,
not merely uninstalled.
**Fix:** An image or provider that ships it, e.g. `pgvector/pgvector:pg18`.

**Symptom:** `54000 column cannot have more than 2000 dimensions for hnsw index`
**Cause:** HNSW caps at 2000 dimensions; the column may hold up to 16 000.
**Fix:** A smaller model, `halfvec` (up to 4000), or exact search.

**Symptom:** Results are subtly wrong compared to a brute-force check
**Cause:** HNSW is approximate, and nothing in the plan says so.
**Fix:** Measure recall against an exact scan on your own data; raise `ef_search`
if it is poor — measured, it costs latency (1.2 → 4.5 ms).

**Symptom:** Creating the index takes minutes
**Cause:** HNSW builds a graph. Measured: 22.9 s for 50 000 rows.
**Fix:** Expected; raise `maintenance_work_mem`, build concurrently, and remember
`REINDEX` pays it again.

**Symptom:** Disk usage doubled
**Cause:** The HNSW index was 98 MB against a 78 MB table.
**Fix:** Budget for it; it is normal.

**Symptom:** A filtered vector query is slow or returns too few rows
**Cause:** The HNSW scan searches nearest-first and may exhaust its candidates
before finding enough matching the `WHERE`.
**Fix:** Partial indexes per filter value, or `iterative_scan` in pgvector 0.8+.
Benchmark this case specifically.

**Symptom:** `22000 different vector dimensions`
**Cause:** A vector of the wrong length reached the column — usually a model change.
**Fix:** The dimension is fixed per column; changing model means a migration.

## Interview questions

**★ What does pgvector give you over a dedicated vector database?**
The embedding lives next to the row it describes, so a relational filter and a
similarity search combine in one query and one transaction — no second system to
sync, back up or secure. That is the real advantage at small-to-moderate scale; at
hundreds of millions of vectors a dedicated engine wins.

**★ What are the three distance operators?**
`<->` L2, `<=>` cosine, `<#>` negative inner product. All are distances, so
`ORDER BY ... ASC` is always nearest-first — inner product is negated for exactly
that reason. Match the one your model was trained for; on normalised vectors
cosine and L2 rank identically.

**★ What does an HNSW index cost and buy?**
Measured on 50 000 384-dimension vectors: search went 88 ms → 2.1 ms, about 42×.
The build took 22.9 seconds and the index is 98 MB against a 78 MB table — larger
than the data. And the results are approximate.

**★ How do you know whether the approximate results are good enough?**
Measure recall yourself: run the query with and without the index and compare.
Nothing in the plan indicates approximation. Measured here, recall was 10/10 at
every `ef_search` because the fixture was well-separated clusters — raising it only
added latency, 1.2 ms to 4.5 ms. On harder data `ef_search` is the knob, and it is
not free.

**★ What is the dimension limit?**
A `vector` column holds up to 16 000 dimensions, but an **HNSW index caps at
2000** — measured, `54000` for 2001. A 3072-dimension embedding can be stored and
searched exactly but not HNSW-indexed; use a smaller model, `halfvec`, or accept
exact search.

**When is no index the right answer?**
Below a few tens of thousands of vectors. Exact search read 50 000 rows in 88 ms
and is exactly correct — no build time, no index storage, no recall question.

---

← [Foreign data wrappers](16-fdw.md) · Next → [Phase index](README.md)
