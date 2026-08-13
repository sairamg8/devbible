---
title: "\\timing and \\watch"
sidebar_label: "10 · \\timing and \\watch"
sidebar_position: 10
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 on **PostgreSQL 18.4** (`postgres:18-alpine`, `127.0.0.1:55432`),
> **psql 18.4**. Script: `sandbox/pg-api/ex32-psql-io.sh`.

**`\timing` measures the client's round trip — network, server execution and rendering the
result. `EXPLAIN ANALYZE` measures what the server did. The gap between them is the honest
part, and knowing which number answers which question is the point of this page.**

## `\timing` measures the whole round trip

```console
$ ./ex32-psql-io.sh
=== 10a. \timing measures the round trip, not server execution ===
Timing is on.
  count
---------
 2000000
(1 row)

Time: 584.697 ms
 pg_sleep
----------

(1 row)

Time: 251.352 ms
Timing is off.
```

`pg_sleep(0.25)` reported 251 ms — 250 ms of sleeping plus roughly 1 ms of round trip. That
1 ms is the floor `\timing` adds to everything.

Compare the same query against the server's own accounting:

```console
=== 10b. compare \timing against the server's own view ===
 Aggregate  (cost=25000.00..25000.01 rows=1 width=8) (actual rows=1.00 loops=1)
   Buffers: temp read=3418 written=3418
   ->  Function Scan on generate_series  (cost=0.00..20000.00 rows=2000000 width=0)
         (actual rows=2000000.00 loops=1)
 Planning Time: 0.118 ms
 Execution Time: 615.546 ms
(8 rows)

Time: 617.003 ms
```

**Execution 615.5 ms, `\timing` 617.0 ms — a 1.5 ms difference.** On a local connection
returning one row the two effectively agree, which is exactly why the distinction is easy to
forget until it matters:

| Situation | `\timing` | `EXPLAIN ANALYZE` |
|---|---|---|
| Local, one row returned | ≈ execution time | execution time |
| Remote server | includes network latency | excludes it |
| Query returning 100 000 rows | includes transfer **and rendering** | excludes both |
| Anything | includes planning | reports planning separately |

The dangerous case is the third. A query returning many rows spends real time formatting
them into an ASCII table — that time is in `\timing` and is not the database's fault. To
time such a query honestly, discard the rendering:

```sql
\timing on
\o /dev/null
SELECT * FROM big_table;      -- output discarded, transfer still measured
\o
```

Or use `EXPLAIN (ANALYZE, BUFFERS)` and read `Execution Time`, which is the number to quote
when discussing whether a query or an index is the problem —
see [EXPLAIN](../phase-10-indexes/03-explain.md).

## Which number to trust

- **Optimising SQL or an index?** `EXPLAIN (ANALYZE, BUFFERS)`. `\timing` includes noise
  you cannot fix by changing the query.
- **Answering "why is this endpoint slow?"** `\timing` is closer to what a user
  experiences, but still misses connection setup and your application's own work.
- **Comparing two queries?** Either, as long as it is the same one for both — and run each
  more than once. The first run pays for cold caches; measured, a second identical run of
  the 2-million-row aggregate is consistently faster because the pages are already in
  `shared_buffers`.

Turn it on permanently in [`.psqlrc`](13-psqlrc.md) — `\timing` costs nothing and you will
otherwise always want it on the query you just ran.

## `\watch` — re-run on an interval

```console
=== 10c. \watch re-runs the buffer on an interval ===
Wed 12 Aug 2026 05:57:21 PM IST (every 1s)

        t        | conns
-----------------+-------
 12:27:21.899385 |     1
(1 row)

Wed 12 Aug 2026 05:57:22 PM IST (every 1s)

        t        | conns
-----------------+-------
 12:27:22.899866 |     1
(1 row)
```

```sql
SELECT now()::time AS t, count(*) AS conns FROM pg_stat_activity WHERE datname = 'devbible'
\watch 1
```

`\watch n` re-runs the query buffer every `n` seconds until Ctrl-C. It is `watch(1)` for
SQL, and it turns psql into a live monitor with no extra tooling.

Note the header timestamp reads `05:57:21 PM IST` while the query's own `now()` reads
`12:27:21` — **the header is your client's local time, the query result is the server's
time zone.** The sandbox machine is `Asia/Calcutta` and the server is UTC. Do not compare
the two columns; they are different clocks.

```console
=== 10d. \watch with a count limit (PostgreSQL 16+) ===
 beat |       now
------+-----------------
 tick | 12:27:25.904136
(1 row)
...
```

PostgreSQL 16+ adds named parameters, including a repeat count — which is what makes
`\watch` usable inside a script rather than only interactively:

```sql
\watch i=0.5 c=3      -- every 0.5s, three times, then stop
\watch interval=5 count=12
\watch m=10           -- (PG 17+) stop after 10 consecutive identical results
```

## What to watch

```sql
-- what is running right now, longest first
SELECT pid, state, now() - xact_start AS xact_age, left(query, 60) AS query
FROM pg_stat_activity
WHERE datname = current_database() AND state <> 'idle'
ORDER BY xact_start
\watch 2

-- is anything blocked
SELECT pid, wait_event_type, wait_event, pg_blocking_pids(pid) AS blockers
FROM pg_stat_activity WHERE cardinality(pg_blocking_pids(pid)) > 0
\watch 1

-- is a long migration progressing
SELECT phase, blocks_done, blocks_total,
       round(100.0 * blocks_done / nullif(blocks_total,0), 1) AS pct
FROM pg_stat_progress_create_index
\watch 2

-- is autovacuum keeping up
SELECT relname, n_live_tup, n_dead_tup FROM pg_stat_user_tables
WHERE n_dead_tup > 1000 ORDER BY n_dead_tup DESC LIMIT 5
\watch 5
```

The `pg_stat_progress_*` views are the ones to remember: `create_index`, `vacuum`,
`analyze`, `cluster`, `basebackup`, `copy`. Paired with `\watch` they answer "is this
long-running operation actually moving?" without guessing.

## Trade-off

**`\watch` polls, and polling costs.** Every iteration is a real query against a server that
may already be struggling — a one-second `\watch` on an expensive diagnostic query adds to
the problem you are diagnosing. Keep watched queries cheap (catalog and stats views are),
widen the interval when the server is under stress, and prefer `count=` limits in scripts so
a forgotten `\watch` cannot poll forever. For anything permanent this is a monitoring
system's job, not psql's.

## Gotchas

**Symptom:** `\timing` and `EXPLAIN ANALYZE` disagree substantially
**Cause:** `\timing` includes network transfer and client rendering
**Fix:** Expected. Use `\o /dev/null` to discard rendering, or trust `Execution Time`

**Symptom:** A query "got faster" on the second run
**Cause:** Cold cache the first time; the pages are now in `shared_buffers`
**Fix:** Run several times and compare like with like; `EXPLAIN (ANALYZE, BUFFERS)` shows hits versus reads

**Symptom:** A `SELECT *` of a large table looks slow in psql but fast in the app
**Cause:** psql is formatting every row into an aligned table
**Fix:** Measure with `\o /dev/null`, or `-At`, or `EXPLAIN ANALYZE`

**Symptom:** The `\watch` header time does not match the query's timestamps
**Cause:** The header is client local time; the query returns the server's time zone
**Fix:** Compare `now()` values only, or set both to UTC

**Symptom:** `\watch` will not stop
**Cause:** It runs until interrupted
**Fix:** Ctrl-C, or use `c=` / `count=` (PostgreSQL 16+)

**Symptom:** `\watch` does nothing
**Cause:** The query buffer is empty — it re-runs the *previous* buffer
**Fix:** Type the query (without a semicolon) and then `\watch n`

## Interview questions

**★ What does `\timing` actually measure?**
The full client round trip: network, planning, execution, transfer and rendering. Measured
against `EXPLAIN ANALYZE`: 617.0 ms versus 615.5 ms `Execution Time` on a local one-row
result.

**★ When do the two diverge?**
On remote connections (network latency) and on large result sets (transfer and psql's
rendering). Both are included in `\timing` and excluded from `Execution Time`.

**★ Which do you use to judge whether an index helped?**
`EXPLAIN (ANALYZE, BUFFERS)` — it isolates server-side work and shows buffer hits versus
reads, so a caching difference does not look like an improvement.

**★ What is `\watch` for?**
Re-running the query buffer on an interval — live monitoring of `pg_stat_activity`,
blocking, or a `pg_stat_progress_*` view — without leaving psql.

**★ How do you stop `\watch` in a script?**
`\watch c=N` (PostgreSQL 16+) for a fixed number of iterations, or `m=` (17+) to stop when
the result stops changing. Interactively, Ctrl-C.

**How do you time a query without paying for output rendering?**
`\o /dev/null` before running it, or `-At`; the transfer still counts but the formatting
does not.

**Why is the first run of a query slower?**
Cold cache. Compare `shared hit` versus `read` in `EXPLAIN (ANALYZE, BUFFERS)` to see it
directly.

---

← [\copy vs COPY](09-copy.md) · Next → [\i and \ir](11-include-files.md)
