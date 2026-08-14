---
title: "10.1 · The memory settings"
sidebar_label: "01 · Memory"
sidebar_position: 1
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-13 against the **PostgreSQL 18 documentation** —
> [resource consumption](https://www.postgresql.org/docs/18/runtime-config-resource.html),
> [query planning](https://www.postgresql.org/docs/18/runtime-config-query.html),
> [connection settings](https://www.postgresql.org/docs/18/runtime-config-connection.html).
> **Not sandbox-measured** — no console output on this page.
> ⚠️ Phase 0 contains a `shared_buffers` benchmark that was found to be
> **confounded**; it is deliberately **not** reused here, and no timing claim on
> this page is presented as measured.

**Four settings account for most of what anyone means by "tuning PostgreSQL",
and only one of them allocates the memory you think it does.**

| Setting | Default | Context | Allocated… |
|---|---|---|---|
| `shared_buffers` | **128 MB** | **postmaster** (restart) | once, for the whole server |
| `work_mem` | **4 MB** | user (`SET`) | **per sort or hash operation** |
| `maintenance_work_mem` | **64 MB** | user | per maintenance operation |
| `effective_cache_size` | **4 GB** | user | **never — it allocates nothing** |

That last row is the one to internalise first, because it is the most commonly
misunderstood setting in PostgreSQL.

## `effective_cache_size` allocates nothing

The documentation is unambiguous: it "has no effect on the size of shared memory
allocated by PostgreSQL, nor does it reserve kernel disk cache; it is used only
for estimation purposes."

It is a **hint to the planner** about how much cache — shared buffers *plus* the
operating system's page cache — a single query can expect to benefit from. Its
only effect is on cost estimates:

- **Higher** → the planner believes index pages will be cached → **index scans
  look cheaper** → more index scans.
- **Lower** → index scans look more expensive → more sequential scans.

So setting it is free in memory terms and consequential in plan terms. A common
starting point is roughly 50–75% of system RAM, reflecting that most of the
machine's memory ends up as page cache holding your data.

The failure mode worth naming: leaving it at the 4 GB default on a 64 GB server
tells the planner it has a fraction of the cache it really has, which biases it
toward sequential scans on queries where an index would win. That is a plan
regression caused by an *estimate*, and no amount of adding indexes fixes it.

## `work_mem` is per operation, not per query

The docs state the allocation rule precisely: `work_mem` is the memory used by a
query operation before spilling to temporary disk files, and it applies **per sort
or hash operation** — a complex query "can spawn multiple concurrent operations,
each allocated up to `work_mem`", and multiple sessions do so concurrently.

The arithmetic that follows is the reason this setting causes outages:

```
worst case ≈ work_mem × operations per query × concurrent queries
```

A `work_mem` of 64 MB with a query doing four sorts and hash joins, at 50
concurrent connections, is a theoretical 12.8 GB — from a setting that reads like
"64 MB". This is not a hypothetical: it is the standard way a server gets OOM-
killed after someone "tuned" it.

Which operations allocate it: `ORDER BY`, `DISTINCT`, merge joins, hash joins,
hash aggregation, memoize nodes and hash-based `IN` subqueries.

Note also **`hash_mem_multiplier`**, default **2.0**: hash-based operations may
use `work_mem × hash_mem_multiplier`, so the real ceiling for a hash node is
double what `work_mem` says. The docs suggest raising it (2.0–8.0) when
`work_mem` is already ≥ 40 MB and hashes still spill — hash operations degrade
worse on spilling than sorts do, which is the reasoning behind giving them their
own multiplier.

### Setting it where it belongs

Because its context is `user`, `work_mem` does not have to be a single global
number, and it usually should not be. Set a conservative global value and raise
it only where it is earned:

```sql
-- for one report, in its own transaction
BEGIN;
SET LOCAL work_mem = '256MB';
SELECT … ;   -- the big sort
COMMIT;
```

```sql
-- or for a role that only runs analytics
ALTER ROLE reporting SET work_mem = '256MB';
```

`SET LOCAL`, not `SET`, on a pooled connection — plain `SET` persists on the
backend and the next transaction to use it inherits the setting, which here means
unrelated queries silently claiming 256 MB per sort node. That is the pooling
rule from [07 · PgBouncer](../07-pgbouncer/02-pool-modes.md), and `work_mem` is
its most expensive victim.

### Knowing whether it is too low

Do not guess. Two sources of evidence:

- **`EXPLAIN (ANALYZE, BUFFERS)`** shows `Sort Method: external merge  Disk:
  NNNNkB` when a sort spilled. That number tells you what `work_mem` would have
  needed to be.
- **`pg_stat_database.temp_files` / `temp_bytes`** count spills across the whole
  database over time — the trend that says "this workload is systematically
  spilling", covered in
  [09 · Monitoring](../09-monitoring/05-database-health.md).

Raise `work_mem` when you have one of those; not because a blog post suggested a
number.

## `shared_buffers`

PostgreSQL's own buffer cache, allocated **once at startup** — context is
**postmaster**, so changing it requires a restart. Default is **128 MB**, which
is a conservative value chosen to start anywhere, not a recommendation.

The documented guidance for a dedicated database server with ≥ 1 GB RAM is
**about 25% of RAM**. The reason it is not "as much as possible" is that
PostgreSQL relies on the OS page cache as a second tier: pages evicted from
shared buffers are frequently still in kernel cache, so giving everything to
shared buffers does not double your caching, it just moves it — and it takes
memory away from `work_mem`, connections and everything else. Beyond roughly 40%
the returns are widely reported to flatten or reverse.

**This page makes no timing claim about that.** Phase 0 of this corpus contains a
`shared_buffers` benchmark that was later found to be confounded, and it is not
being reused. If you need a number for your workload, measure it on your
workload — and read
[Verify your own measurements](../../phase-11-mvcc/README.md) first, because a
buffer-cache benchmark is unusually easy to get wrong (cold vs warm cache, the
OS cache underneath, and a `pg_prewarm` you forgot about).

Two related settings:

- **`temp_buffers`** (default **8 MB**, per session) — buffers for temporary
  table access only, allocated per session on first temp-table use.
- **`wal_buffers`** (default **-1**, auto) — auto-sized to about 3% of
  `shared_buffers`, between 64 kB and 16 MB. The automatic value is nearly always
  right; it appears on tuning lists more often than it deserves.

## `maintenance_work_mem`

Default **64 MB**, used by `VACUUM`, `CREATE INDEX` and `ALTER TABLE ADD FOREIGN
KEY`. Only one maintenance operation runs per session at a time, so unlike
`work_mem` it does not multiply within a query — which makes it much safer to
raise.

Raising it to a few hundred megabytes materially speeds index builds and vacuum
on large tables, and is one of the safer changes on this page.

The multiplication *does* return via autovacuum, and this is the trap: the docs
note it can be allocated up to `autovacuum_max_workers` times when autovacuum
runs. So `maintenance_work_mem = 1GB` with three autovacuum workers is up to 3 GB
of background memory. **`autovacuum_work_mem`** exists precisely to decouple
these — set it lower than `maintenance_work_mem` so interactive index builds get
the large value and background vacuum does not.

## How these interact with connection count

Connections and memory are the same conversation, which is why
[07 · PgBouncer](../07-pgbouncer/README.md) sits next to this topic. Each backend
can allocate `work_mem` several times over, so:

```
max_connections ↑  ⇒  the safe value of work_mem ↓
```

Raising `max_connections` to accommodate more clients therefore forces
`work_mem` down for everybody, degrading every large query — which is a much
better argument for a pooler than any amount of "connections are expensive". A
smaller `max_connections` with a pooler in front lets you afford a larger
`work_mem`, and that is the combination you want.

A defensible starting shape for a dedicated 16 GB server serving a web
application through a pooler:

| Setting | Value | Reasoning |
|---|---|---|
| `shared_buffers` | 4 GB | ~25% of RAM |
| `effective_cache_size` | 12 GB | ~75% — an estimate, allocates nothing |
| `work_mem` | 16–32 MB | conservative; raise per role or per query |
| `maintenance_work_mem` | 512 MB | one at a time, safe |
| `autovacuum_work_mem` | 128 MB | so N workers cannot claim 512 MB each |
| `max_connections` | 100–200 | with a pooler doing the real bounding |

Treat that as a starting point to measure from, not an answer.

## Trade-off

Every memory setting here trades **the speed of one query against the safety of
the whole server**. `work_mem` is the sharpest case: raising it makes big sorts
dramatically faster right up to the point where concurrency multiplies it into an
OOM kill, and the boundary moves with your traffic. The safe posture is a modest
global value plus targeted increases, which costs you some per-query performance
you could have had, in exchange for a server that behaves the same at 3am as it
did in testing.

`shared_buffers` trades against the OS page cache rather than against your
queries — which is why the guidance is a fraction of RAM rather than a maximum,
and why the difference between 25% and 40% is much less interesting than most
tuning discussions assume.

And `effective_cache_size` trades nothing at all. It is free, it only affects
plans, and leaving it at the default on a large server is the cheapest
misconfiguration to fix on this page.

## Gotchas

**Symptom:** The server was OOM-killed after raising `work_mem`
**Cause:** It is allocated **per sort/hash operation per query**, not per query
or per connection — one query can allocate it several times, and so can every
concurrent session.
**Fix:** Keep the global value modest; raise it with `SET LOCAL` for specific
transactions or `ALTER ROLE` for analytics roles.

**Symptom:** Setting `effective_cache_size` higher did not free any memory
**Cause:** It allocates nothing — documented as estimation-only.
**Fix:** Correct expectation. Its effect is on *plans*: higher makes index scans
look cheaper.

**Symptom:** The planner prefers sequential scans on a large, well-indexed server
**Cause:** `effective_cache_size` left at the 4 GB default while the machine has
far more cache available.
**Fix:** Raise it to roughly 50–75% of RAM. No restart needed.

**Symptom:** `shared_buffers` change had no effect
**Cause:** Context is **postmaster** — restart required.
**Fix:** Restart, and check `pg_settings.pending_restart`.

**Symptom:** Autovacuum uses far more memory than expected
**Cause:** `maintenance_work_mem` is allocated per autovacuum worker, up to
`autovacuum_max_workers` times.
**Fix:** Set `autovacuum_work_mem` lower than `maintenance_work_mem`.

**Symptom:** `work_mem` set in a request leaks into unrelated queries
**Cause:** Plain `SET` on a pooled connection persists on that backend.
**Fix:** `SET LOCAL` inside a transaction.

**Symptom:** Queries spill to disk despite a large `work_mem`
**Cause:** The plan may need it several times over, or the estimate driving the
node is wrong so the allocation is not what you assumed.
**Fix:** `EXPLAIN (ANALYZE, BUFFERS)` and read the `Sort Method` line; if row
estimates are far off, the fix is statistics, not memory.

## Interview questions

**★ How is `work_mem` allocated?**
Per sort or hash operation, per query, per session — not per query and not per
connection. A query with several sorts and hash joins allocates it multiple times
concurrently, and every concurrent session does the same, so the worst case is
`work_mem` × operations × concurrency. That is why raising it globally is the
classic way to get a server OOM-killed.

**★ What does `effective_cache_size` do?**
Nothing to memory. It is documented as estimation-only: a hint about how much
cache (shared buffers plus OS page cache) a query can expect, used to cost index
scans against sequential scans. Raising it makes index scans look cheaper.
Leaving it at the 4 GB default on a large server biases the planner toward
sequential scans.

**★ Why is `shared_buffers` recommended at ~25% of RAM rather than as much as
possible?**
Because PostgreSQL leans on the operating system's page cache as a second tier.
Memory given to shared buffers is taken from that cache and from `work_mem` and
connections, so past a point you are moving caching around rather than adding it.
It is also restart-only, so it is not a knob to iterate on casually.

**★ How do `max_connections` and `work_mem` interact?**
Multiplicatively, and in opposite directions. Every additional backend can
allocate `work_mem` several times, so a higher `max_connections` forces a lower
safe `work_mem`. That is the strongest argument for a connection pooler: fewer
backends lets you afford more memory per query.

**When would you raise `maintenance_work_mem` but not `work_mem`?**
Almost always. `maintenance_work_mem` is used by one operation per session at a
time, so it does not multiply within a query, making it far safer to raise — it
speeds `CREATE INDEX` and `VACUUM` noticeably. Guard the autovacuum side with
`autovacuum_work_mem`, since that one *is* multiplied by the worker count.

**How do you know `work_mem` is too low?**
Evidence, not guesswork: `EXPLAIN (ANALYZE, BUFFERS)` showing
`Sort Method: external merge  Disk: …`, and a rising `temp_bytes` in
`pg_stat_database`. Both tell you spilling is happening and roughly how much
memory would have avoided it.

---

← [Phase index](../README.md) · Next → [Planner, WAL, and changing settings](02-planner-wal-and-changing.md)
