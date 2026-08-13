---
title: "Partitioning"
sidebar_label: "14 · Partitioning"
sidebar_position: 14
---

<span className="db-tier t-know">Should Know</span>

> Verified: 2026-08 on **PostgreSQL 18.4** (`postgres:18-alpine`, `127.0.0.1:55432`),
> **Node 24.19.0**, `pg` 8.23.0. Script:
> `sandbox/pg-api/ex48-extensions-partitioning.mjs`.

**Partitioning splits one logical table into several physical ones, and the payoff
is not usually query speed — it is being able to drop a month of data in
milliseconds.** Reach for it when data ages out, not when queries are slow.

Measured on 400 000 events across four monthly partitions.

## Declaring it

```sql
CREATE TABLE p_events (
  id bigint GENERATED ALWAYS AS IDENTITY,
  occurred_at timestamptz NOT NULL,
  kind text NOT NULL,
  payload text NOT NULL
) PARTITION BY RANGE (occurred_at);

CREATE TABLE p_events_2026_01 PARTITION OF p_events
  FOR VALUES FROM ('2026-01-01') TO ('2026-02-01');
-- …one per month…
CREATE TABLE p_events_default PARTITION OF p_events DEFAULT;
```

```console
$ node ex48-extensions-partitioning.mjs
┌─────────┬────────────────────┬──────────┐
│ (index) │ relname            │ rows     │
├─────────┼────────────────────┼──────────┤
│ 0       │ 'p_events_2026_01' │ '103353' │
│ 1       │ 'p_events_2026_02' │ '93334'  │
│ 2       │ 'p_events_2026_03' │ '103323' │
│ 3       │ 'p_events_2026_04' │ '99990'  │
│ 4       │ 'p_events_default' │ '0'      │
└─────────┴────────────────────┴──────────┘
```

The parent holds no rows — it is a routing definition. Three strategies:

| `PARTITION BY` | Splits on | For |
|---|---|---|
| **`RANGE`** | ordered ranges | time series — the overwhelmingly common case |
| **`LIST`** | enumerated values | a tenant id, a region, a status |
| **`HASH`** | a hash of the key | spreading write load with no natural range |

**The partition key must be in the primary key.** `PRIMARY KEY (id)` alone is
rejected on a partitioned table; it has to be `PRIMARY KEY (id, occurred_at)`.
That is a real design constraint — every unique constraint must include the
partition key, so a globally unique `email` cannot be enforced by the database
across partitions.

## Pruning is the whole benefit

```console
with the partition key in WHERE:
  15.6 ms
      ->  Seq Scan on p_events_2026_02 p_events (actual rows=93334.00 loops=1)

without it — every partition is scanned:
  32.9 ms
                  ->  Parallel Append (actual rows=26666.67 loops=3)
                        ->  Seq Scan on p_events_default p_events_5
                        ->  Parallel Seq Scan on p_events_2026_01 p_events_1
                        ->  Parallel Seq Scan on p_events_2026_03 p_events_3
                        ->  Parallel Seq Scan on p_events_2026_04 p_events_4
                        ->  Parallel Seq Scan on p_events_2026_02 p_events_2
```

With `occurred_at` in the `WHERE`, one partition is touched. Without it, a
`Parallel Append` over all five.

**Note the ratio: 15.6 ms against 32.9 ms — about 2×, not 5×.** Four partitions
were skipped and the query got twice as fast, because the scan is parallel and the
work is spread. That is the honest scale of the query benefit, and it is why "we
partitioned to make queries faster" so often disappoints. **An index would have
done more.**

Pruning happens at plan time when the value is a constant, and at execution time
when it comes from a parameter or a subquery — so a `$1` parameter still prunes,
just later.

**Every query that does not filter on the partition key touches every partition.**
Design the key around your access pattern, not around what feels tidy.

## The reason to actually do it

```console
DETACH: 5 ms  (metadata only — the table still exists)
  detached table still holds its rows: 103353
DROP a whole partition: 10 ms  ← vs a DELETE of the same rows
```

**Dropping 103 353 rows took 10 ms.** The equivalent `DELETE` writes a dead tuple
per row, leaves the table bloated, and needs `VACUUM` afterwards — measured in
[Phase 4 · DELETE](../phase-4-crud/11-delete.md), where deleting half a 47 MB table
left it at 47 MB until `VACUUM FULL`.

`DETACH` is even cheaper at 5 ms and keeps the data: the partition becomes an
ordinary standalone table you can archive, export, then drop.

That is the case for partitioning: **retention.** A `logs`, `events` or `metrics`
table where last quarter's rows must go away on a schedule. Roll a new partition
in, detach the old one, done — no long-running `DELETE`, no bloat, no `VACUUM`
storm.

## The default partition

```console
DEFAULT partition after the seed: 0 rows
after inserting a 2030 row      : 1 ← the default catches what no range covers
INSERT with no matching partition and no default → 23514 no partition of relation "p_events" found for row
```

Without a `DEFAULT`, an insert whose key falls outside every range **fails with
`23514`**. That is a production outage the first time nobody created next month's
partition.

A default partition prevents it — and creates a subtler problem: rows accumulate
there, and **attaching a new partition whose range overlaps rows in the default
requires scanning the default** to prove none conflict, which takes an
`ACCESS EXCLUSIVE` lock.

The practical answer is both: keep a default as a safety net, *and* create
partitions ahead of time on a schedule (`pg_cron`, or your job runner) so it stays
empty.

## Updating the partition key moves the row

```console
row lives in: p_events_2026_02
after the UPDATE  : p_events_2026_03 ← the row was moved
  (a partition-key UPDATE is a DELETE + INSERT under the covers)
```

PostgreSQL handles it transparently, but it is a delete and an insert: the `ctid`
changes, every index entry is rewritten, and it can never be a HOT update. If your
partition key changes often, it is the wrong key.

## Indexes

An index created on the parent is **propagated to every partition**, and to new
ones as they are created. Each partition gets its own physical index — there is no
global index across partitions, which is precisely why a unique constraint cannot
span them without including the partition key.

## When it is worth it

Roughly: **when a single partition would still be a sensible table.** Common
guidance is not to bother below tens of millions of rows, and to keep the partition
count in the low hundreds — planning cost grows with the number of partitions, and
thousands of them make planning itself slow.

Before partitioning for performance, check that the problem is not simply a missing
index ([Phase 10](../phase-10-indexes/)). Partitioning is operational machinery;
an index is usually the cheaper answer to a slow query.

## Trade-off

Partitioning buys cheap bulk deletion, smaller per-partition indexes and vacuums
that work on manageable pieces. It costs a partition key baked into every unique
constraint and primary key, queries that must filter on that key or touch
everything, an ongoing job to create future partitions, and a `23514` outage if
that job fails.

It is infrastructure, not a tuning knob. Adopt it when retention is a real
requirement, not because a table feels large.

## Gotchas

**Symptom:** `23514 no partition of relation ... found for row`
**Cause:** The key falls outside every range and there is no default partition —
usually next month's partition was never created.
**Fix:** A `DEFAULT` partition as a safety net, plus a scheduled job creating
partitions ahead of time.

**Symptom:** Queries got slower after partitioning
**Cause:** They do not filter on the partition key, so every partition is scanned.
Measured: 32.9 ms across five partitions against 15.6 ms with pruning.
**Fix:** Choose a key matching the access pattern — or use an index instead.

**Symptom:** `PRIMARY KEY (id)` is rejected
**Cause:** Every unique constraint on a partitioned table must include the
partition key.
**Fix:** `PRIMARY KEY (id, occurred_at)`, and accept that uniqueness cannot be
enforced across partitions on any other column.

**Symptom:** Attaching a partition takes an exclusive lock for a long time
**Cause:** Rows in the `DEFAULT` partition must be scanned to prove none belong in
the new range.
**Fix:** Keep the default empty by creating partitions in advance.

**Symptom:** Updates on the partition key are slow
**Cause:** They are a delete plus an insert, so every index entry is rewritten and
HOT is impossible.
**Fix:** Do not partition on a column that changes.

**Symptom:** Planning time grew noticeably
**Cause:** Too many partitions.
**Fix:** Keep the count in the low hundreds; widen the range per partition.

## Interview questions

**★ What does partitioning actually buy you?**
Cheap bulk deletion, mainly. Measured: dropping a partition of 103 353 rows took
10 ms, and detaching it 5 ms, against a `DELETE` that writes a dead tuple per row
and leaves the table bloated until `VACUUM`. The query benefit is smaller than
people expect — 15.6 ms against 32.9 ms here, about 2× across five partitions.

**★ What is partition pruning and when does it fail?**
The planner skips partitions that cannot contain matching rows. It works when the
`WHERE` filters on the partition key, at plan time for constants and at execution
time for parameters. Any query not filtering on that key touches every partition —
measured, a `Parallel Append` across all five.

**★ What happens to an insert with no matching partition?**
`23514 no partition of relation found for row`, unless a `DEFAULT` partition
exists. That is the classic outage when nobody created next month's partition, so
keep a default *and* create partitions ahead of schedule.

**★ What constraint does partitioning put on your primary key?**
The partition key must be part of every unique constraint, so `PRIMARY KEY (id)`
becomes `PRIMARY KEY (id, occurred_at)`. There is no global index across
partitions, so uniqueness on any other column cannot be enforced database-side.

**What happens when you update the partition key?**
The row moves — PostgreSQL does it transparently, but it is a delete plus an
insert, so every index entry is rewritten and it can never be HOT. A key that
changes often is the wrong key.

**When should you not partition?**
When the table is merely large rather than genuinely needing retention, and before
checking whether an index solves the actual problem. Below tens of millions of
rows the machinery usually costs more than it returns, and thousands of partitions
make planning itself slow.

---

← [LISTEN/NOTIFY](13-listen-notify.md) · Next → [Procedures](15-procedures.md)
