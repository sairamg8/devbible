---
title: "EXPLAIN (ANALYZE, BUFFERS)"
sidebar_label: "07 · BUFFERS"
sidebar_position: 7
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 on **PostgreSQL 18.4** (`postgres:18-alpine`, `127.0.0.1:55432`),
> **Node 24.19.0**, `pg` 8.23.0. Scripts: `sandbox/pg-api/ex24-index-not-used.mjs`,
> `ex23-index-basics.mjs`.

**Timings move with cache state, machine load and who else is on the box. Buffer counts
do not. `BUFFERS` is the one number in a plan you can compare between two runs and
between two machines — and in PostgreSQL 18 it is on by default with `ANALYZE`.**

## Reading the buffers line

```console
$ node ex24-index-not-used.mjs
buffers line: hit=13
shared hit = found in shared_buffers; read = went to the OS/disk
block size: 8192 bytes — so hit+read x 8 kB is the real work done
```

| Field | Meaning |
|---|---|
| `shared hit` | Page found in PostgreSQL's own `shared_buffers`. Cheap. |
| `shared read` | Page not in `shared_buffers` — from the OS page cache or the disk. PostgreSQL cannot tell which. |
| `shared dirtied` | Pages this query modified for the first time since the last checkpoint. |
| `shared written` | Pages this query had to flush itself because the buffer pool was under pressure. |
| `local …` | Same four, for temporary tables. |
| `temp read/written` | Spills — sorts and hashes that exceeded `work_mem`. Always worth chasing. |

Every count is in 8 kB blocks, so `hit=3712` is about 29 MB of pages touched.

**`dirtied` and `written` on a read-only query are not a mistake** — they come from hint
bits and from evicting pages to make room.

## Why buffers beat milliseconds

From [Seq vs index vs bitmap](04-scan-types.md), the same query forced three ways:

```console
planner default      : Seq Scan on b_events        → 91.043 ms | hit=3712
enable_seqscan=off   : Bitmap Heap Scan            → 96.381 ms | hit=3665 read=133
+ bitmapscan=off     : Index Scan using ...        → 272.446 ms | hit=400358
```

The times say "3× slower". The buffers say **108× more page accesses** — and that ratio
holds on any machine, warm or cold. When you paste a plan into a ticket, the buffer
counts are the part that still means something next week.

## Estimated versus actual — the number to hunt

`country` and `dial_code` are perfectly correlated. The planner assumes columns are
independent:

```console
=== 8. EXPLAIN (ANALYZE, BUFFERS) — estimate vs reality ===
Bitmap Heap Scan on c_corr  (cost=1099.84..4258.14 rows=33080 width=10)
                            (actual time=5.399..28.374 rows=100000.00 loops=1)
  Recheck Cond: (country = 'IN'::text)
  Filter: (dial_code = '+91'::text)
  Heap Blocks: exact=1622
  Buffers: shared hit=1622 read=87
  ->  Bitmap Index Scan on c_corr_country_idx  (cost=0.00..1091.57 rows=99620 width=0)
                            (actual time=4.969..4.969 rows=100000.00 loops=1)
        Index Cond: (country = 'IN'::text)
        Buffers: shared read=87
Planning:
  Buffers: shared hit=11 read=1
Planning Time: 0.281 ms
Execution Time: 34.798 ms

estimated 33080 rows, actual 100000.00 — the planner multiplied two independent-looking filters
```

The inner node estimated 99 620 and got 100 000 — nearly perfect. The outer node then
applied `dial_code = '+91'` and estimated ⅓ of that, because it has no idea the two
columns move together. **3× off on one node**; on a join that error compounds and
produces genuinely wrong plans.

The fix is extended statistics — see [Statistics and ANALYZE](16-statistics.md), where
this same estimate goes from 33 607 to 100 990 against an actual 100 000.

**Where to look, in order:**

1. The node with the largest **ratio** of actual to estimated rows — not the slowest node.
   Errors propagate upward, so the deepest bad estimate is the cause.
2. `Rows Removed by Filter` — work done and thrown away.
3. `temp read/written` — a spill; raise `work_mem` or reduce the row count.
4. `Heap Blocks: lossy=` — the bitmap outgrew `work_mem`.
5. `Buffers` on the scan nodes — where the I/O actually went.

Remember `loops`: `actual rows` and `actual time` are per loop, buffers are cumulative.

## In SQL

```sql
EXPLAIN (ANALYZE, BUFFERS) SELECT ...;

-- PostgreSQL 18 includes BUFFERS with ANALYZE by default; ask explicitly to be portable
EXPLAIN (ANALYZE, BUFFERS, VERBOSE, SETTINGS) SELECT ...;

-- planning-time buffers appear as their own block
-- Planning:
--   Buffers: shared hit=11 read=1

SHOW block_size;      -- 8192
SHOW shared_buffers;  -- how much can be a "hit" at all
SHOW work_mem;        -- the threshold for temp spills
```

## From Node

Capture the plan alongside the query when a request is slow, rather than reproducing it
by hand later:

```js
async function explain(sql, params) {
  const {rows} = await pool.query(`EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${sql}`, params);
  const plan = rows[0]['QUERY PLAN'][0];
  return {
    ms: plan['Execution Time'],
    hit: plan.Plan['Shared Hit Blocks'],
    read: plan.Plan['Shared Read Blocks'],
    estimated: plan.Plan['Plan Rows'],
    actual: plan.Plan['Actual Rows'],
  };
}
console.log(await explain('SELECT * FROM c_corr WHERE country = $1', ['IN']));
```

`FORMAT JSON` is what makes this practical — the text form is for humans, the JSON form
is for assertions. A regression test can then fail on `hit + read` exceeding a budget,
which is stable in CI where wall-clock timing is not.

Two cautions: the `EXPLAIN` prefix has to be interpolated, so build it only from your own
SQL; and `ANALYZE` runs the statement, so never point this at a `DELETE` outside a
transaction you roll back.

## Trade-off

**`BUFFERS` tells you how much work was done, never why it was slow.** A query with 400
000 buffer hits and a warm cache can beat one with 5000 cold reads. Use buffers to
compare plans for the *same* query and to make plan regressions visible; use
`Execution Time` and `pg_stat_statements` to decide which query to look at first.

Also: `shared read` does not mean disk. PostgreSQL cannot see the OS page cache, so a
"read" may have been served from RAM. It is an upper bound on physical I/O, not a
measurement of it.

## Gotchas

**Symptom:** Two runs of the same query report very different times
**Cause:** Cache warmth
**Fix:** Compare `Buffers` instead; `hit` shifting to `read` is the whole story

**Symptom:** `shared dirtied` on a `SELECT`
**Cause:** Hint-bit updates on first read after a write
**Fix:** Normal. It settles after `VACUUM`

**Symptom:** `temp written=…` and a slow sort
**Cause:** The sort or hash exceeded `work_mem` and spilled to disk
**Fix:** Raise `work_mem` for that query, or return fewer rows

**Symptom:** Estimates are fine on every node yet the plan is bad
**Cause:** Correlated columns — each filter is estimated correctly, their combination is
not
**Fix:** `CREATE STATISTICS` on the correlated pair — see [Statistics](16-statistics.md)

**Symptom:** A deep node shows a huge row-estimate error but you optimised the top one
**Cause:** Errors propagate upward; the top node's error is a symptom
**Fix:** Fix the deepest node with the worst ratio first

## Interview questions

**★ Why add `BUFFERS`?**
It is the only measurement in a plan independent of cache state and machine load, so it
is comparable across runs and machines. Measured: two plans 3× apart in time were 108×
apart in buffer accesses.

**★ What does `shared hit` versus `shared read` mean?**
`hit` was found in `shared_buffers`; `read` was not, and came from the OS cache or the
disk — PostgreSQL cannot distinguish those two.

**★ How do you find the cause of a bad plan?**
Find the deepest node with the worst actual-to-estimated row ratio. Measured: a node
estimated 33 080 rows and returned 100 000, because two correlated columns were treated
as independent.

**What unit are buffer counts in?**
8 kB blocks — `SHOW block_size`. `hit=3712` is roughly 29 MB touched.

**What does `temp written` indicate?**
A sort or hash spilled past `work_mem` onto disk.

**Is `BUFFERS` on by default?**
With `ANALYZE` in PostgreSQL 18, yes. Write it explicitly anyway — it costs nothing and
works on every version.

---

← [Multicolumn indexes](06-multicolumn.md) · Next → [Index-only scans and INCLUDE](08-index-only.md)
