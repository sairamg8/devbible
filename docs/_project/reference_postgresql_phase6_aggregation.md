---
name: devbible-postgresql-phase6-aggregation
description: The measured dataset behind PostgreSQL Phase 6 (aggregation, windows, CTEs) — the fixture seed bug that had to be fixed mid-phase, the two claims that died on re-measurement, and the results worth reusing
metadata:
  type: reference
---

# PostgreSQL Phase 6 — aggregation, windows, CTEs

Child of [[devbible-postgresql-rewrite-handoff]]. Six new sandbox scripts, all in
`sandbox/pg-api/`. Fixture: `agg_customers` / `agg_orders` / `agg_items` (6 orders,
5 customers, 5 items) plus **`agg_events`, 500 000 rows, 40 MB, 3783 heap pages**.

| Script | Covers |
|---|---|
| `ex36-aggregation.mjs` | topics 01–08 semantics + the 500k seed |
| `ex36b-agg-plans.mjs` | full `EXPLAIN` text, **index state controlled explicitly** (Part 1 no index / Part 2 with) |
| `ex36c-agg-checks.mjs` | driver types, empty groups, time zones, ordinals/aliases |
| `ex36d-count-having.mjs` | count variants, fan-out, `HAVING` pushdown |
| `ex36e-shaping.mjs` | `array_agg`/`string_agg`/`jsonb_agg`, the empty-array trap |
| `ex37-cte-subquery.mjs` | topics 09–16 (CTEs, subqueries, frames, recursive, grouping sets) |

## ⚠️ The fixture bug — the transferable lesson of this phase

The first seed used `user_id = (g % 5000) + 1` and `kind = (g % 4) + 1`. **4 divides
5000**, so `kind` was functionally determined by `user_id`: every user had exactly one
kind, and `count(DISTINCT (user_id, kind))` was 5000 instead of 20 000. Any query
grouping or filtering on both was measuring one column twice.

Caught because a `HAVING` plan reported **1250 groups where 5000 were expected**. Fixed
to `((g / 5000) % 4) + 1`, which cycles all four kinds across each user's 100 events.
**Everything was re-run and every number on the already-written pages was updated.**

> **Rule for any generated fixture: check that columns derived from one counter are
> actually independent. Two moduli sharing a factor are not.**

## Two claims that did not survive re-measurement

Both were written up from the first run and **removed or rewritten** after the reseed —
this is [[devbible-verify-your-own-measurements]] catching things a second time.

1. **"`count(nullable_col)` is 1.6× slower than `count(*)`"** — first run showed 44.36 ms
   vs 27.85 ms. After reseed: `count(*)` 26.73, `count(1)` 28.35, `count(id)` 33.21,
   `count(amount)` **31.25** — the one doing *more* work was faster than `count(id)`. All
   four share a plan and `buffers=3783`. The page now says the spread is noise and states
   the "compare buffers, treat sub-2× timing gaps on a cached scan as unproven" rule.
2. **"Low `work_mem` makes hash agg spill"** — a script comment claimed the planner keeps
   the hash plan. It does not: it re-costs and picks sort-based `GroupAggregate`. The
   comment was fixed before it reached a page.

## Results worth reusing

**Counting (500k, all `buffers=3783`)**
- `count(DISTINCT user_id)` **208.87 ms** — single-threaded, no `Gather`, sorts and spills
  (`external merge Disk: 5880kB`). Distinct aggregates are **not combinable**, so no
  parallel path.
- Rewrite `count(*) FROM (SELECT DISTINCT …)` → **57.61 ms, 3.6×**, parallel `HashAggregate`.
- **The ranking flips with an index**: with `(user_id, amount DESC)`, `count(DISTINCT)`
  becomes an index-only scan at **63.53 ms / 575 buffers** and now *beats* the rewrite's
  76.21 ms. "Always rewrite `count(DISTINCT)`" is wrong.

**Grouping**
- 4 groups **58.59 ms** vs 5000 groups **59.57 ms** — same buffers, scan dominates.
- `work_mem=64kB`: **117.68 ms**, `Batches: 5 Disk Usage: 3696kB` + an external merge sort.
  With the index: **85.19 ms** and buffers 3801 → **577**.
- **B vs B2: identical plans, identical buffers, 59.57 ms vs 83.22 ms.** Used on the page
  as the argument for comparing `Buffers` before milliseconds.

**Windows** — `WindowAgg` is **not parallel-aware** (no `Gather`, ever).
- one window **530 ms** (sort spills 8560 kB) · two sharing a sort **999 ms** · two with
  different `PARTITION BY` **1518 ms**, temp blocks 1070 → **3671**.
- With an ordered index the sort disappears: **283 ms, 575 buffers**.

**Top-N per group — contradicts Phase 5**
- `row_number` + `WHERE rn<=3`: **434.74 ms / 3783 buffers**, plan shows
  **`Run Condition: (row_number() OVER w1 <= 3)`** (PG15+ pushes the filter into `WindowAgg`).
- **Adding `(user_id, amount DESC)` made it SLOWER**: 533.67 ms and **500574 buffers** —
  `Index Scan`, not `Index Only Scan`, because `id` is not in the index. 132× the buffers.
- `LATERAL` without an index: **`57014` statement timeout at 30 s**. With the index:
  906.59 ms. [[devbible-postgresql-phase5-joins]] measured LATERAL *winning*; the
  difference is **group count relative to table size**.

**`HAVING` pushdown** — `GROUP BY user_id, kind HAVING kind='purchase'` produces a plan
**byte-identical** to the `WHERE` version: `Group Key: user_id` (kind dropped) and
`Filter: (kind='purchase')` on the scan. 55.08 vs 57.21 ms. A `HAVING` on an *aggregate*
cannot be pushed — `Filter` sits on `Finalize HashAggregate`, and selectivity buys
nothing: keeping 0 of 5000 groups was **not** faster than keeping all 5000.

**`FILTER`** — same speed as `CASE` (65.45 vs 65.14 ms, same buffers). The real win is
against N scalar subqueries: 4 counts = **161.21 ms and 15132 buffers (4× scans)** vs
**65.45 ms / 3783**. `FILTER` is *not* a scan filter — no index narrows it.

**Shaping**
- An unordered `array_agg` **inherited a sibling aggregate's sort** — same expression,
  different output once `array_agg(x ORDER BY id DESC)` joined the select list. Always put
  `ORDER BY` inside a collection aggregate.
- The empty-array trap needs **both** `FILTER` and `coalesce`: naked → `[null]`, `FILTER`
  alone → `null`, `FILTER` + `coalesce(…, '[]'::jsonb)` → `[]`.
- `json` vs `jsonb` duplicate-key difference is **invisible from Node** — `JSON.parse`
  collapses duplicates too. `pg_column_size` 23 vs 60 bytes.
- `jsonb_object_agg`: `NULL` key → **`22023`**; duplicate keys → last wins, silently.

**Error codes produced for real:** `42803` (ungrouped column / aggregate in WHERE or
GROUP BY), `42703` (alias in WHERE/HAVING), `42P20` (window in WHERE/HAVING), `42P10`
(DISTINCT + mismatched ORDER BY), `42809` (FILTER on a non-aggregate), `42883`
(`count(DISTINCT a,b)`, `string_agg(int,…)`), `22023` (NULL jsonb key), `22003` (`::int`
overflow), `57014` (statement timeout).

---

## Session 9 — topics 09–16 (CTEs, subqueries, counts, ordered-set, frames, recursion, grouping sets)

**Four of the six new scripts exist because an `ex37` demo did not establish the claim
printed next to it.** That is the pattern to expect from this script, not an accident:

| `ex37` showed | Why it proved nothing | Fixed by |
|---|---|---|
| volatile CTE "not inlined" via `(SELECT x FROM r) = (SELECT x FROM r)` | that query references `r` **twice** — the multiple-reference rule alone explains `true` | `ex37b`, one variable at a time, verdict read off the plan |
| `NOT IN` narration "0 rows" | hardcoded string, stale after §10 mutates the fixture; actual result was **1** | narration fixed in `ex37`, re-run |
| capped-count "rare filter" also `capped:true` | `kind='refund' AND amount>890` matches **2264** rows — never rare | `ex37d`, with a genuinely rare filter (120 rows) |
| `mode() -> click` | all four kinds tie at **exactly 125000**; it reports a sort order | `ex37e`, incl. `ORDER BY kind DESC` → **`view`** |
| `CUBE` 710 ms vs 3 `GROUP BY`s 171 ms | compares **8 grouping sets against 3** | `ex37g`, same three sets both ways |

**CTE inlining — inlined unless ANY of:** referenced >1×, `MATERIALIZED`, recursive,
data-modifying, **contains a volatile function** (`random()` fences in target list *and*
`WHERE`; `now()` is `STABLE` and does not).
- `MATERIALIZED` on a 500k scan: **28.42 → 174.49 ms (6.1×)**. Filter moves off the scan
  (487014 rows discarded after materialization), `Storage: Disk Maximum Storage: 21344kB`,
  `temp written=2668`, **and the parallel plan is lost**.
- Referenced twice → auto-materialized, `shared hit=3803`, 56.5 ms. `NOT MATERIALIZED`
  → **7606 buffers (exactly 2×)**, 124.1 ms. A `Materialize` node in that plan sits *above*
  a second full aggregate — node name is not evidence the work happened once.
- **`NOT MATERIALIZED` is ignored** when inlining would change the answer: a volatile CTE
  still plans as `CTE r` + `CTE Scan on r`.
- **`LIMIT` does not fence** — still inlined, and the `Limit` stays below the outer filter
  (10 rows then filtered to 5, `n=5`).
- **`OFFSET 0` still blocks subquery pull-up in 18** — no `CTE` node, yet the filter is
  stuck above a `Subquery Scan` and parallelism is gone. **"No CTE node" ≠ "the filter
  reached the scan".**

**Correlated subquery cost is coupled to the visibility map** — the session's most important
methodology catch. Two `ex37` runs of the *same* query gave **136.85 ms and 889.41 ms**
(plan flipped Index Only Scan ↔ Bitmap Heap Scan over 500000 heap blocks). Controlled in
`ex37c`:
- freshly vacuumed: correlated **145.00** vs `GROUP BY` **65.26** ms (2.2×), `Heap Fetches: 0`
- after touching 1 row in 500: **413.69** vs **90.34** ms (4.6×), `Heap Fetches: 133359`
- the correlated form degrades **2.9×**, the `GROUP BY` 1.4× — *never benchmark this on a
  freshly vacuumed table and conclude it is fine.*

**Pagination counts** (500k rows, 125k matching): exact `count(*)` **48.83 ms**, page only
**2.11 ms**, `limit+1` **2.10 ms** (free), `count(*) OVER ()` **152.77 ms** — worst, because
`WindowAgg` sees all 125000 rows before `Limit` can stop. Planner estimate **125833 vs
125000 (100.7%)** for free. Capped count: **23× cheaper when matches are plentiful**
(1.46 vs 33.85 ms) and **no saving at all when rare** (3.01 vs 3.02 ms for 120 matches) —
the opposite of the intuition.

**GROUPING SETS are NOT parallelised** — the headline result of topic 16. Same three sets:
one scan **293.67 ms** (`buffers=3790`) vs three separate `GROUP BY`s **170.22 ms**
(3810 buffers ×3). **One scan LOSES by 1.7×**, because each plain `GROUP BY` gets
`Gather Merge` + 2 workers over a `Parallel Seq Scan` while the grouping-set plan is a
single serial `Seq Scan` feeding `MixedAggregate`. Every buffer is a shared **hit**, so this
is CPU, not I/O — on a table too large to cache the single scan should win. `CUBE(a,b,c)` =
8 sets = 749.70 ms (93.71 ms/set vs 56.74 ms/set separately).

**Smaller measured facts:** percentile **178.32** vs `avg` **57.41** ms (3.1×, must sort);
`percentile_disc(0.0)/(1.0)` = `min`/`max` (10 / 909); `bool_and` over an empty set is
`NULL` not `true`; `every()` proven identical to `bool_and`; `EXCLUDE GROUP` = `EXCLUDE
TIES` + `CURRENT ROW` (6→4 vs 6→5 for a row with one peer); **a frame clause on
`row_number()` is accepted and silently ignored** (even an absurd one gives identical
output); recursive cycle produced **107 rows from an 8-row table** before a `d < 40` guard;
`CYCLE` flags the repeat (`root` twice, second `is_cycle: true`).

**New error codes:** `42P19` (recursive ref twice / aggregate in recursive term), `42P10`
(CTE column-alias count), `42712` (duplicate CTE name), `22013` (negative frame offset),
`0A000` (`RANGE` offset on `text`), `42803` (`GROUPING` on a non-grouped column), `21000`
(scalar subquery >1 row).

**The link trap bit again, in the file-link direction.** Six broken links in the final
build, all `../subqueries/03-x.md` / `../lag-lead/01-x.md` — prefix dropped *and* filename
kept. Correct: `../11-subqueries/03-x.md`. **Drop the prefix only when the link ends in
`/`.** Converting 8 flat files to directories also means fixing every inbound link,
including ones in *other* topics' "Where this connects" lists.

Related: [[devbible-postgresql-rewrite-handoff]] · [[devbible-postgresql-sandbox]] ·
[[devbible-verify-your-own-measurements]] · [[devbible-never-compress-to-fit-cap]]
