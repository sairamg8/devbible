---
title: "GiST, BRIN and hash"
sidebar_label: "15 · GiST, BRIN, hash"
sidebar_position: 15
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08 on **PostgreSQL 18.4** (`postgres:18-alpine`, `127.0.0.1:55432`),
> **Node 24.19.0**, `pg` 8.23.0. Script: `sandbox/pg-api/ex26-index-ops.mjs`.

**Three index types that each answer one question a B-tree cannot. BRIN: "this table is
huge and physically ordered." Hash: "equality only, nothing else, ever." GiST: "do these
two things overlap?"**

## BRIN — 2743× smaller, and one condition

3 million rows, timestamps inserted in order:

```console
$ node ex26-index-ops.mjs
=== 5. BRIN, hash and GiST — what each is genuinely for ===
heap: 173 MB | BRIN: 24 kB | B-tree: 64 MB (BRIN is 2743x smaller)

BRIN  : ->  Bitmap Heap Scan on r_logs  → 26.926 ms | hit=421 read=355
B-tree: ->  Index Only Scan using r_logs_at_btree → 24.085 ms | hit=1 read=239
```

**24 kB against 64 MB, for the same one-day range query at nearly the same speed.**

BRIN — Block Range INdex — stores only the min and max value per 128-page range. To find
a range it reads its tiny summary, discards the block ranges that cannot contain a match,
and scans the rest. It is a filter, not a lookup: the plan is always a bitmap scan with a
recheck.

The whole thing depends on **physical correlation**:

```console
BRIN on shuffled data: ->  Parallel Seq Scan on r_shuffled → 142.993 ms
┌─────────┬──────────────┬─────────┬─────────────┐
│ (index) │ tablename    │ attname │ correlation │
├─────────┼──────────────┼─────────┼─────────────┤
│ 0       │ 'r_logs'     │ 'at'    │ 1           │
│ 1       │ 'r_shuffled' │ 'at'    │ 0.011932906 │
└─────────┴──────────────┴─────────┴─────────────┘
```

Same data, same index type, rows written in random order — **correlation 0.0119, and the
planner ignored the index entirely**. Every block range now spans nearly the whole time
span, so nothing can be excluded.

`correlation` in `pg_stats` is the check to run before creating a BRIN index. Close to 1
(or −1): BRIN is excellent. Anywhere near 0: useless.

The natural fit is append-only data whose insert order matches the column's order — logs,
events, metrics, time-series. And note the cost of a `CLUSTER` or a bulk reload that
reorders such a table: it can silently destroy a BRIN index's value.

## Hash — equality and nothing else

500 000 md5 strings:

```console
hash: 16 MB | btree: 28 MB
equality with hash : Index Scan using h_tok_hash on h_tok → 0.049 ms
range/sort with hash: ->  Parallel Seq Scan on h_tok      → 58.286 ms ← hash serves = only
UNIQUE hash index → 0A000 access method "hash" does not support unique indexes
```

**43% smaller than the B-tree** — the payoff for storing a 32-bit hash instead of the
whole value, which grows with the width of the column. On long text keys the gap is much
larger.

Everything else is a restriction:

- `>`, `<`, `BETWEEN`, `ORDER BY` — sequential scan.
- `UNIQUE` — **`0A000` not supported**, so it can never back a constraint.
- No multicolumn hash indexes, no `INCLUDE`, no index-only scans.

Hash indexes became crash-safe and WAL-logged in PostgreSQL 10, so the old "never use
them" advice is obsolete — but the case for one is narrow: a wide column, looked up only
by exact equality, where the size difference matters.

## GiST — overlap, containment, distance

GiST is a framework rather than one index. Its distinctive power is answering questions
with no total order.

**The exclusion constraint** — no two bookings for the same room may overlap in time:

```sql
CREATE EXTENSION btree_gist;
CREATE TABLE g_book (
  room int,
  during tstzrange,
  EXCLUDE USING gist (room WITH =, during WITH &&)
);
```

```console
overlapping booking, same room → 23P01 | conflicting key value violates exclusion constraint "g_book_room_during_excl"
same window, different room → inserted room 2
```

**`23P01`** is the SQLSTATE for an exclusion violation — distinct from `23505`, and worth
handling separately in the application. `btree_gist` is what allows the plain-equality
`room` column to sit in the same GiST index as the range column.

There is no way to express this with a unique constraint or a `CHECK`. Doing it in
application code means a race condition you will eventually meet.

GiST also serves similarity ordering, which GIN cannot — from
[GIN and trigrams](11-gin-trgm.md): `ORDER BY email <-> 'text'` was a 766 ms sequential
scan with GIN and a 110 ms index scan with `gist_trgm_ops`, at 48 MB against 13 MB.

Its other established homes are PostGIS geometry, `range` and `inet` containment, and
nearest-neighbour search generally.

## Choosing

| Need | Index |
|---|---|
| Equality, ranges, sorting, `min`/`max` | [B-tree](02-btree.md) |
| Containment of parts — `jsonb @>`, arrays, full text, `LIKE '%x%'` | [GIN](11-gin-trgm.md) |
| Overlap, exclusion constraints, distance ordering, geometry | **GiST** |
| Enormous physically-ordered table, range queries, disk matters | **BRIN** |
| Equality only, wide keys, no constraint needed | **hash** |

## In SQL

```sql
CREATE INDEX ON r_logs USING brin (at);
CREATE INDEX ON r_logs USING brin (at) WITH (pages_per_range = 32);  -- finer, larger
SELECT brin_summarize_new_values('r_logs_at_brin');                   -- summarise new blocks

CREATE INDEX ON h_tok USING hash (token);

CREATE EXTENSION btree_gist;
ALTER TABLE g_book ADD EXCLUDE USING gist (room WITH =, during WITH &&);

-- the check to run BEFORE creating a BRIN index
SELECT attname, correlation FROM pg_stats WHERE tablename = 'r_logs';
```

`pages_per_range` is BRIN's one real knob: fewer pages per range means a more precise but
larger index. The default 128 gave 24 kB here.

## From Node

Ranges arrive as strings and are best constructed in SQL:

```js
try {
  await pool.query(
    `INSERT INTO g_book (room, during) VALUES ($1, tstzrange($2, $3, '[)'))`,
    [roomId, start, end]);
} catch (e) {
  if (e.code === '23P01') throw new ConflictError('room already booked for that period');
  throw e;
}
```

`'[)'` — inclusive start, exclusive end — is the bound style that makes back-to-back
bookings not overlap. Getting it wrong is the most common bug in this pattern, and it
shows up as spurious `23P01`s at exactly the boundary.

For a time-series table, add the BRIN index in the migration and check correlation
afterwards:

```js
const {rows: [s]} = await pool.query(
  `SELECT correlation FROM pg_stats WHERE tablename = $1 AND attname = $2`,
  ['r_logs', 'at']);
console.log('correlation', s.correlation);   // near 1 → BRIN is worth it
```

## Trade-off

**Each of these three is a specialist, and the specialisation is the whole point.**

BRIN gives up precision for size — 2743× smaller, at the cost of a recheck on every
matching block range and total dependence on physical ordering that nothing enforces.

Hash gives up every operator except `=`, plus uniqueness and index-only scans, for around
40% of a B-tree's size on this data.

GiST gives up the simplicity of a sorted structure for the ability to index things that
have no order — and is generally slower and larger than the B-tree it replaces, when a
B-tree was an option at all.

If you are unsure which applies, the answer is B-tree. These three are for when you know
exactly why the B-tree is wrong.

## Gotchas

**Symptom:** BRIN index created, planner ignores it
**Cause:** Low physical correlation — measured 0.0119 on shuffled data, and it fell back to
a sequential scan
**Fix:** Check `pg_stats.correlation` first; BRIN needs near 1

**Symptom:** BRIN stopped helping after a bulk reload or `CLUSTER`
**Cause:** The physical order changed
**Fix:** Re-check correlation; reload in key order

**Symptom:** BRIN misses recently inserted rows
**Cause:** New block ranges are not summarised until autovacuum runs
**Fix:** `brin_summarize_new_values()`, or `autosummarize = on`

**Symptom:** `0A000 access method "hash" does not support unique indexes`
**Cause:** Hash indexes cannot enforce uniqueness
**Fix:** Use a B-tree for anything backing a constraint

**Symptom:** `ORDER BY` slow despite a hash index
**Cause:** Hash serves `=` only
**Fix:** B-tree

**Symptom:** `EXCLUDE USING gist (room WITH =, ...)` fails to create
**Cause:** `btree_gist` not installed — plain equality types need it inside a GiST index
**Fix:** `CREATE EXTENSION btree_gist`

## Interview questions

**★ What is BRIN for and when does it fail?**
Very large tables physically ordered by the indexed column. It stores min/max per block
range — 24 kB against 64 MB for a B-tree on 3 M rows. It fails when correlation is low:
measured 0.0119 on shuffled data, and the planner ignored it.

**★ Why would you use a hash index?**
Equality-only lookups on wide keys where size matters — 16 MB against 28 MB here. It
cannot do ranges, ordering, uniqueness (`0A000`), or index-only scans.

**★ What can GiST do that no other index type can?**
Back an exclusion constraint — "no two bookings for the same room may overlap", enforced
in the database, raising `23P01`. It also serves `<->` distance ordering, which GIN
cannot.

**How do you check whether BRIN suits a table?**
`SELECT correlation FROM pg_stats WHERE tablename = … AND attname = …`. Near 1 or −1 is
good; near 0 is useless.

**Are hash indexes still considered unsafe?**
No — they have been WAL-logged and crash-safe since PostgreSQL 10. The reason to avoid
them is functional, not reliability.

**Which SQLSTATE does an exclusion violation raise?**
`23P01`, distinct from the `23505` of a unique violation.

---

← [pg_stat_statements](14-pg-stat-statements.md) · Next → [Statistics and ANALYZE](16-statistics.md)
