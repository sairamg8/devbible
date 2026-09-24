---
name: devbible-postgresql-phase12-beyond-tables
description: The measured dataset behind the phase-12 pages — GIN not serving ->> equality, jsonb costing 13x in storage, the 42P17 indexing trap, and pg_trgm's whole-string % trap
metadata:
  type: reference
---

# PostgreSQL Phase 12 — beyond plain tables

**PHASE COMPLETE — 17 topics, 19 pages, zero stamps** (session 10). Scripts `ex44`–`ex49`.
01, 05 and 01-jsonb-operators are chunked directories.

Parent: [[devbible-postgresql-rewrite-handoff]] · sandbox inventory:
[[devbible-postgresql-sandbox]]

## jsonb (topics 01–04) — `ex44`

Fixture: 200 000 rows, 1000 distinct tags (200 rows/tag), the same two facts stored
both as jsonb keys and as real columns.

### The result that matters most

**A GIN index does not serve `->>` equality.** With `gin (doc)` present:

| Query | Time | Plan |
|---|---|---|
| `doc @> '{"tag":"t42"}'` | **4.5 ms** | Bitmap Index Scan, `Index Cond` |
| `doc->>'tag' = 't42'` | **35.4 ms** | Parallel Seq Scan, `Filter`, 66 600 rows removed |

No index at all: `@>` 43.6 ms, `->>` 34.2 ms — i.e. the GIN index changed *nothing*
for the `->>` form. Write filters as containment, or build an expression index.

### The three index kinds

| Index | Size | `@>` | `->>` = | `?` |
|---|---|---|---|---|
| GIN `jsonb_ops` (default) | **17 MB** | 4.5 ms | ✗ | ✓ |
| GIN `jsonb_path_ops` | **13 MB** | **1.1 ms** | ✗ | **✗ (seq scan)** |
| Expression `((doc->>'tag'))` | **1352 kB** | ✗ | **0.9 ms** | ✗ |

`jsonb_path_ops` is 4× faster for containment *and* smaller, but cannot serve key
existence at all. The expression index is ~13× smaller than the default GIN and the
only one that answers `->>`.

`? 'tag'` at 41.0 ms with `jsonb_ops` present was **supported but not chosen** — the
key exists on every row, so there is no selectivity. Support ≠ usefulness.

### Column vs document

- **Storage: 22 MB (jsonb) vs 1736 kB (columns)** for the same two facts — ~13×.
  jsonb repeats every key name on every row.
- Equality with an expression index is close: **1.13 ms vs 0.71 ms**.
- **Range is the real gap**: `(doc->>'qty')::int > 45` = 40.3 ms with a parallel seq
  scan and 61 333 rows removed per worker, vs 20.5 ms for `qty > 45`. One column
  index serves equality + ranges + sorting; a jsonb key needs an expression index
  **per access pattern**, with the cast included.
- **Constraints — better than folklore, worse where it counts:**
  `CHECK (doc ? 'tag')` → **OK**. `CHECK (((doc->>'qty')::int) BETWEEN 0 AND 49)` →
  **OK**. `FOREIGN KEY ((doc->>'tag'))` → **`42601` syntax error**. Referential
  integrity is the guarantee you actually lose.
- `{"a":1}` vs `{"a":"1"}`: `jsonb_typeof` gives `number`/`string`, but `->>` renders
  both as the text `1`, so a text filter matches both.

### Accessors

- `->>` returns SQL `NULL` for **both** a missing key and a JSON `null`. Only
  `? 'k'` (false vs true) or `jsonb_typeof` distinguishes them.
- `-> 'tags' ->> 0` is the element; `->> 'tags'` is the whole array as text.
- jsonb **sorts keys** (`to_jsonb` gave `id, qty, tag`); `row_to_json` preserved
  `id, tag, qty`.
- `||` is a **shallow** merge; every mutation builds a new document, so an `UPDATE`
  rewrites the whole column.

## Search (topics 05–06) — `ex45`

Fixture: 200 002 products, two rows deliberately misspelled (`wireles routr`).

### Full-text search

- `to_tsvector('english', …)` stems and drops stop words:
  `'dog':3 'fox':10 'jump':6 'lazi':9 'quick':5 'run':2`. `simple` keeps everything
  including `'the':1,8`. **Note `lazi` — stems are not words.**
- **`to_tsquery` raises `42601` on ordinary user text**: `running foxes`, `fox dog`,
  `it's a fox!` and a quoted phrase all failed. `websearch_to_tsquery` never raises
  and parses the search-engine grammar:
  `cheap "red shoes" -blue` → `'cheap' & 'red' <-> 'shoe' & !'blue'`.
  It **discards** what it cannot parse (`it's a fox!` → `'fox'`).
- **`CREATE INDEX … gin (to_tsvector(body))` → `42P17`** — the one-arg form depends
  on `default_text_search_config`, a session setting. Naming the config fixes it.
- **1165.3 ms (parallel seq scan) → 17.36 ms** (Bitmap Heap Scan) with the GIN index,
  ~66×. Index 13 MB.
- **The expression must match exactly**: the same query with `'simple'` against an
  `'english'` index fell back to a parallel seq scan.
- **Generated tsvector column is the same speed**, not faster: 17.87 ms vs 17.36 ms,
  both 13 MB indexes; the table grew to **51 MB** because the vector is stored.
  Choose it for multi-column vectors, weights, and one canonical query spelling.
- Weights visible in the vector: `'router':2A,8B` (title A, body B).
- `ts_rank` 0.9988 vs `ts_rank_cd` 1.5143 (cd is not bounded to 0–1). Normalization
  flag 32 turned 0.243171 into 0.195605. **Ranking is not indexable.**
- `ts_headline` works on the **original text**, so it cannot use the index — apply
  after `LIMIT`.
- Lexeme matching: `router` and `routers` both → **13 335 rows** (same stem);
  `rout` → **0**; `rout:*` → **13 336**.

### pg_trgm

- `show_trgm('router')` → `{"  r"," ro","er ",out,rou,ter,ute}`.
- **`%` compares WHOLE strings — the trap.** `similarity('routr', 'wireles routr
  special')` = **0.273** (below the 0.3 threshold) while `word_similarity` = **1.000**.
  So `title % 'routr'` → **0 rows**, `'routr' <% title` → **13 336 rows**.
  Thresholds differ: `similarity_threshold` **0.3**, `word_similarity_threshold`
  **0.6**. Query goes on the **left** of `<%`.
- **`ILIKE '%routr%'`: 87.0 ms → 1.13 ms** with `gin_trgm_ops` (~77×). `%` similarity
  247.7 → 62.01 ms (less selective, so more rechecking). trgm index **9016 kB**, vs
  the 13 MB FTS index.
- **`ORDER BY col <-> $1` needs GiST.** With only GIN present: parallel seq scan.
  With `gist_trgm_ops`: `Index Scan`, 110.9 ms, index **22 MB**.

### FTS vs trigram — neither substitutes for the other

User types the **correct** spelling; the document is misspelled (`routr`):

| | rows |
|---|---|
| full-text `@@` | **0** — stemming normalises grammar, not typos |
| trigram `<%` at default 0.6 | **0** — `word_similarity` = 0.571 |
| trigram `<%` at 0.55 | **found**, total matches 13 335 → **13 336** |

**The default threshold misses a one-character typo, and 0.55 found it with zero
extra false positives.** The threshold is a knob you are expected to tune; leaving
the default is a decision.

Reverse direction — `jumped` against documents saying `jumping`: full-text
**200 000 rows** (both stem to `jump`), trigram **0**.

## Views, triggers, matviews (topics 07, 08, 11) — `ex46`

Fixture: 300 000 orders, 5000 customers.

### Views

- A view stores **0 bytes**; it is expanded into the caller's query before
  planning. Filtering through a simple view gave an identical plan and timing to
  writing the query out (0.87 vs 1.13 ms).
- **Pushdown is the whole story.** Same `GROUP BY` view: filtering on the
  **grouped key** → 0.8 ms, index scan, 60 rows read. Filtering on the
  **aggregate result** → **135.8 ms**, seq scan of all 300 000 rows, 5000 removed
  by filter. **170×.** Aggregates, `DISTINCT`, window functions and `LIMIT` inside
  a view are fences.
- `CREATE VIEW ... WHERE x = $1` → **`42P02` there is no parameter $1**. A
  `LANGUAGE sql STABLE` set-returning function does take one (and can be inlined).
- Updatable: simple view → OK; `GROUP BY` view → **`55000` cannot update view**.
  **`WITH CHECK OPTION`** turns an insert that would be invisible through the view
  into **`44000`**; without it the insert silently succeeds.
- Dependencies are hard: dropping a column a view selects, or the table, →
  **`2BP01`**.

### Triggers

- **An `AFTER` trigger's assignment to `NEW` is silently discarded** — the column
  stayed `null`. `BEFORE` to change the row, `AFTER` to react.
- One `UPDATE` over 1000 rows: **row trigger fired 1000×, statement trigger 1×**.
  A statement trigger **also fires when the statement matched 0 rows**.
- **Cost, each arm on a freshly built table** (the first version reused one table
  and mixed trigger cost with accumulating bloat):
  no trigger **455.3 ms** · statement **447.9 ms** (free, within noise) ·
  row **563.0 ms (1.24×)** · row + `WHEN` **486.0 ms (0.86× of the row trigger)**.
  `WHEN` is checked before the `plpgsql` call — move `IF ... THEN RETURN NEW` out
  of the function body and into `WHEN`.
- `RETURN NULL` in a `BEFORE` trigger **silently drops the row**: 10 submitted, 5
  stored, `rowCount` reported 5.
- **Firing order is alphabetical by trigger name**, not creation order (created
  zebra/alpha/middle → fired alpha, middle, zebra).

### Materialized views

- Stores its result: **256 kB** vs a plain view's 0 bytes. Needs **its own
  indexes** (0.88 → 0.51 ms once indexed).
- **Honest caveat:** for this query the plain view was already 0.6 ms because the
  predicate pushed into an index. A matview only wins where pushdown cannot
  help — the 135.8 ms aggregate-filter case above.
- **`REFRESH CONCURRENTLY` requires a UNIQUE index** (`55000` without one) because
  it diffs new against old, and is **1.6× slower** (227 vs 142 ms).
- Locking: plain `REFRESH` takes `AccessExclusiveLock` and blocked a reader
  **32 ms** of a 142 ms refresh; `CONCURRENTLY` blocked it **2 ms**.
- No automatic refresh — an insert left the value unchanged. `WITH NO DATA` →
  **`55000` has not been populated**; `pg_class.relispopulated` reports the state.

## Extensions, partitioning, FDW, pgvector, NOTIFY (09, 13, 14, 16, 17)

### Extensions (`ex48`)
60 available in the image · **per DATABASE, not per cluster** — `42883` in a fresh one ·
`CREATE EXTENSION pgcrypto` brings **37 objects** · `2BP01` blocks a drop while a column
uses the type · `plpgsql` is itself an extension, in `pg_catalog`.

### Partitioning (`ex48`)
Pruning: **15.6 ms with the key in WHERE vs 32.9 ms without — only ~2×**, because the
Append is parallel. **The real payoff is retention: DROP of a 103 353-row partition took
10 ms, DETACH 5 ms.** No default partition → **`23514`**. A partition-key UPDATE moves
the row (delete + insert, never HOT). Every unique constraint must include the key.

### postgres_fdw (`ex48`)
**2.9 ms fully pushed down** (`Remote SQL: SELECT count(*) … WHERE region = …`) **vs
41.9 ms** when a `VOLATILE` predicate forced `SELECT NULL FROM …` and every row across
the wire — **14×**. Read the `Remote SQL` line. **No two-phase commit**, so it is a read
tool.

### pgvector (`ex48`, on the :55434 container)
`<->` L2 · `<=>` cosine · `<#>` negative inner product, all distances so ASC = nearest.
**Exact 88 ms → HNSW 2.1 ms (42×)** on 50 000 × 384 dims. **Build 22.9 s; index 98 MB
against a 78 MB table.** Recall **10/10 at every `ef_search`** — but the fixture is 200
well-separated clusters, so raising it bought only latency (1.2 → 4.5 ms).
**`54000` past 2000 dimensions for an HNSW index** (the column allows 16 000).
⚠️ **First fixture was uniformly random vectors and the recall figure was noise** (0/10,
then 10/10, then 0/10 as `ef_search` rose — impossible). High-dimensional uniform random
points are all equidistant. Clustered data is the correct fixture.

### LISTEN/NOTIFY, server side (`ex49`)
`pg_notify` from an `AFTER` trigger with `TG_OP` · **500 rows → 500 notifications from a
ROW trigger, 1 from a STATEMENT trigger** · **`NOTIFY` folds an unquoted channel name,
`pg_notify()` does not**, and only `pg_notify` takes a computed channel · a notification
sent while nobody listened is **discarded, no replay**.
⚠️ The 8 GB queue read **0.000000% even after 2000 notifications**, so filling it was
**not** demonstrated and the page says so plainly.

Related: [[devbible-postgresql-rewrite-handoff]] · [[devbible-postgresql-sandbox]] ·
[[devbible-postgresql-phase10-indexes]] · [[devbible-verify-your-own-measurements]]
