---
title: "Seq scan vs index scan vs bitmap heap scan"
sidebar_label: "04 · Scan types"
sidebar_position: 4
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 on **PostgreSQL 18.4** (`postgres:18-alpine`, `127.0.0.1:55432`),
> **Node 24.19.0**, `pg` 8.23.0. Script: `sandbox/pg-api/ex23-index-basics.mjs`.

**One table, one index, five predicates — and three different scan types, chosen by how
many rows come back. A sequential scan is not a failure; on a large fraction of the table
it is the correct plan, and forcing an index there made the query 3× slower.**

## The same index, five selectivities

500 000 rows, index on `bucket`:

```console
$ node ex23-index-basics.mjs
=== 4. the three scan shapes on ONE table and ONE index ===
1 row        rows=     1  Index Scan using b_events_at_idx on b_events  [0.137 ms]
~500 rows    rows=   500  Bitmap Heap Scan on b_events                  [1.298 ms]
~50k rows    rows= 50000  Bitmap Heap Scan on b_events                  [13.698 ms]
~250k rows   rows=250000  Bitmap Heap Scan on b_events                  [61.531 ms]
all rows     rows=500000  Seq Scan on b_events                          [77.412 ms]
```

Nothing changed but the predicate. The planner walks up the same ladder every time:

| Rows expected | Plan | Why |
|---|---|---|
| A handful | **Index Scan** | Walk the index, fetch each heap row directly. Random I/O, but very few of them. |
| A meaningful slice | **Bitmap Heap Scan** | Collect *all* matching row locations first, sort them, then read the heap in **physical order**. Turns random I/O into sequential I/O. |
| Most of the table | **Seq Scan** | The index is pure overhead when you are going to read every page anyway. |

## What a bitmap scan actually does

```console
-- the bitmap plan in full (two-step: index then heap) --
Bitmap Heap Scan on b_events  (cost=561.71..4888.68 rows=49198 width=28) (actual time=3.036..10.027 rows=50000.00 loops=1)
  Recheck Cond: (bucket < 100)
  Heap Blocks: exact=882
  Buffers: shared hit=929
  ->  Bitmap Index Scan on b_events_bucket_idx  (cost=0.00..549.41 rows=49198 width=0) (actual time=2.807..2.808 rows=50000.00 loops=1)
        Index Cond: (bucket < 100)
        Index Searches: 1
        Buffers: shared hit=47
Planning Time: 0.091 ms
Execution Time: 13.007 ms
```

Read it inside out:

- The **`Bitmap Index Scan`** reads only the index — 47 buffers — and builds a bitmap of
  matching row locations. It returns no data.
- The **`Bitmap Heap Scan`** then reads the heap **once, in page order**: 882 heap
  blocks, no page visited twice.
- **`Recheck Cond`** is there because if the bitmap gets big enough PostgreSQL degrades it
  to *page*-level ("lossy") granularity and must re-test each row on the page. A
  `Heap Blocks: lossy=` line means that happened — usually a sign to raise `work_mem`.

50 000 rows retrieved in 929 total buffers. An index scan would have done 50 000
separate heap lookups.

## Is the sequential scan the correct plan?

This is the part worth measuring rather than believing. Same query
(`bucket < 800`, ~400 000 of 500 000 rows), forcing each alternative:

```console
-- is the seq scan the CORRECT plan? force the alternative and time it --
planner default      : Seq Scan on b_events                             → 91.043 ms | hit=3712
enable_seqscan=off   : Bitmap Heap Scan on b_events                     → 96.381 ms | hit=3665 read=133
+ bitmapscan=off     : Index Scan using b_events_bucket_idx on b_events → 272.446 ms | hit=400358
```

**400 358 buffer accesses against 3712.** The pure index scan visited the heap once per
matching row, revisiting the same pages over and over, and took **3× longer**. The
planner was right, and the "missing index" was never the problem.

`enable_seqscan = off` is a **diagnostic, not a fix**. It does not forbid sequential
scans, it just prices them absurdly high — and if the forced plan is slower, you have
your answer.

## In SQL

```sql
-- diagnosis only, session-local, never in application code
SET enable_seqscan = off;
EXPLAIN (ANALYZE, BUFFERS) SELECT * FROM b_events WHERE bucket < 800;
RESET enable_seqscan;

-- the knob that actually shifts the planner's index/seq balance
SHOW random_page_cost;   -- 4.0 by default; 1.1 is usual on SSDs
```

`random_page_cost = 4` dates from spinning disks. On SSD or cloud block storage, lowering
it to around `1.1` legitimately makes index scans more attractive, and is the right
setting to change instead of disabling plan types.

## From Node

The scan type is not something you choose from the application — you choose the *query*,
and the planner does the rest. What you can do from Node is check it:

```js
const p = await pool.query(
  `EXPLAIN (ANALYZE, BUFFERS) SELECT * FROM b_events WHERE bucket < $1`, [100]);
const text = p.rows.map(r => r['QUERY PLAN']).join('\n');
console.log(text.split('\n').find(l => /Scan/.test(l)).trim());
// → Bitmap Heap Scan on b_events  (cost=561.71..4888.68 rows=49198 ...)
```

The practical application lever is `LIMIT`. A query returning 250 000 rows to Node is a
design problem before it is a planner problem — see
[cursors](../phase-7-pg-driver/15-cursors.md) and
[keyset pagination](../phase-4-crud/03-limit-offset.md).

## Trade-off

**Index scans win on few rows, sequential scans win on many, and the bitmap scan exists
precisely because the middle is wide.** Trying to force the endpoints — "we should always
use the index" — costs you exactly what the measurement above shows.

The corollary: the fastest fix for a slow sequential scan is often not an index but a
**more selective query**. If the predicate genuinely matches 80% of the table, no index
type will save it.

## Gotchas

**Symptom:** "It's doing a seq scan, we need an index"
**Cause:** The query returns a large fraction of the table
**Fix:** Force the alternative with `enable_seqscan = off` and time it. Measured here,
the forced index scan was 3× slower with 100× the buffers.

**Symptom:** `Heap Blocks: lossy=12345` in a bitmap plan and slow recheck
**Cause:** The bitmap exceeded `work_mem` and degraded to page granularity
**Fix:** Raise `work_mem` for that session, or narrow the predicate

**Symptom:** Index scans everywhere on an SSD but plans still feel conservative
**Cause:** `random_page_cost = 4` assumes seek-heavy spinning disks
**Fix:** Lower it toward `1.1` and re-measure; this is a server-wide decision

**Symptom:** `SET enable_seqscan = off` left in a migration or a connection setup
**Cause:** Treating a diagnostic as a fix
**Fix:** Remove it. It distorts every plan on that connection — and with a pool, on
whichever requests happen to get that connection

## Interview questions

**★ What are the three scan types and when is each chosen?**
Index Scan for very few rows (walk index, fetch each row); Bitmap Heap Scan for a
meaningful slice (build a bitmap of locations, read the heap in physical order); Seq Scan
when most of the table qualifies. Measured on one table and one index: 1 row → Index Scan,
500–250 000 → Bitmap, all rows → Seq.

**★ Is a sequential scan always bad?**
No. Forcing an index scan on a query matching 80% of a 500 000-row table took 272 ms and
400 358 buffers, versus 91 ms and 3712 buffers for the sequential scan.

**★ Why does a bitmap scan exist at all?**
To convert many random heap fetches into one ordered pass. It reads each heap page at
most once — 882 blocks for 50 000 rows in the measurement above.

**What is `Recheck Cond`?**
When the bitmap grows past `work_mem` it stores pages rather than rows, so each row on
those pages must be re-tested. `Heap Blocks: lossy=` confirms it happened.

**How do you prove the planner made the right choice?**
Turn off the plan type it chose, re-run `EXPLAIN (ANALYZE, BUFFERS)`, and compare
`Execution Time` and `Buffers`. If the alternative is slower, the planner was right.

---

← [EXPLAIN vs EXPLAIN ANALYZE](03-explain.md) · Next → [Why an index is not used](05-index-not-used.md)
