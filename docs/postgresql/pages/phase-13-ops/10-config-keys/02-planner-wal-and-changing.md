---
title: "10.2 · Planner costs, WAL, and changing a setting"
sidebar_label: "02 · Planner, WAL, changing"
sidebar_position: 2
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-13 against the **PostgreSQL 18 documentation** —
> [query planning](https://www.postgresql.org/docs/18/runtime-config-query.html),
> [write-ahead log](https://www.postgresql.org/docs/18/runtime-config-wal.html),
> [setting parameters](https://www.postgresql.org/docs/18/config-setting.html).
> The `pg_settings.context` values quoted below are **sandbox-measured** —
> `sandbox/pg-api/ex53-hba-tls.sh` read them directly from a running PG 18.4.
> No other console output on this page.

**Most tuning advice on the internet is about the settings in
[chunk 01](01-memory.md). The settings that decide whether the planner picks your
index are here, and they are one-line changes needing no restart.**

## Planner cost constants

The planner does not time anything. It estimates a cost in arbitrary units and
picks the cheapest plan, using these constants as its model of your hardware:

| Setting | Default | Meaning |
|---|---|---|
| `seq_page_cost` | **1.0** | reading a page sequentially — the unit everything else is relative to |
| `random_page_cost` | **4.0** | reading a page at random |
| `cpu_tuple_cost` | **0.01** | processing one row |
| `effective_cache_size` | **4 GB** | assumed cache available to one query (see [chunk 01](01-memory.md)) |

**`random_page_cost = 4.0` encodes a spinning disk.** It says a random read costs
four times a sequential one, which was about right for the rotational drives of
the era the default was chosen in. On SSD or NVMe — which is to say, on anything
you are likely to be running — random reads are far closer to sequential, and the
widely used value is **1.1**:

```sql
ALTER SYSTEM SET random_page_cost = 1.1;
SELECT pg_reload_conf();
```

This is arguably the highest-value single line on this page. Leaving it at 4.0 on
SSD systematically over-costs index scans, so the planner chooses sequential
scans on queries where the index would have won. The symptom is "PostgreSQL is
ignoring my index" — and the usual response, adding more indexes, cannot fix an
index that is being correctly costed under wrong assumptions.

Two cautions so this does not become cargo cult:

- **Change it with evidence.** `EXPLAIN (ANALYZE, BUFFERS)` before and after on
  the queries you care about. It is a `user`-context setting, so you can test it
  in one session (`SET random_page_cost = 1.1;`) before making it global.
- **It is relative, not absolute.** Only the *ratio* between the cost constants
  matters; there is no benefit to scaling them all.

**`default_statistics_target`** (default **100**) controls how much detail
`ANALYZE` collects. Raising it to 250–500 for a specific column with skewed data
gives the planner better estimates at the cost of slower `ANALYZE`:

```sql
ALTER TABLE orders ALTER COLUMN status SET STATISTICS 500;
ANALYZE orders;
```

Prefer the per-column form over raising the global. Phase 10 covers extended
statistics (`CREATE STATISTICS`) for correlated columns, which is the better tool
when the problem is a *combination* of columns rather than one column's
distribution.

**`jit`** defaults to **on**. JIT compilation helps long analytical queries and
can add measurable overhead to short ones that the planner mis-estimates into
crossing the cost threshold. If short queries regressed after an upgrade, `jit`
is worth testing off — per session first.

## WAL and checkpoints

Every change is written to the write-ahead log before the data files, which is
what makes crash recovery and replication possible. Defaults:

| Setting | Default | Notes |
|---|---|---|
| `wal_level` | **`replica`** | supports archiving and replication; `logical` adds decoding info; `minimal` is faster but blocks PITR |
| `checkpoint_timeout` | **5 min** | maximum time between automatic checkpoints |
| `max_wal_size` | **1 GB** | soft limit; a checkpoint is triggered when exceeded |
| `min_wal_size` | **80 MB** | below this, old WAL is recycled rather than removed |
| `checkpoint_completion_target` | **0.9** | spread checkpoint I/O across 90% of the interval |
| `wal_compression` | **off** | `pglz`, `lz4` or `zstd` for full-page images |
| `wal_buffers` | **-1** (auto) | ~3% of `shared_buffers`, 64 kB–16 MB |
| `fsync` | **on** | **never turn this off on real data** |
| `full_page_writes` | **on** | needed for crash safety |

The one that actually causes trouble is **`max_wal_size` at 1 GB**. On a
write-heavy system that limit is reached quickly, forcing frequent checkpoints;
frequent checkpoints mean more full-page writes (the first change to a page after
a checkpoint writes the entire page to WAL), which means more WAL, which triggers
the next checkpoint sooner. The result is a periodic I/O stall pattern that looks
like mysterious latency spikes. Raising `max_wal_size` to several gigabytes on a
write-heavy server is a standard and safe change; the cost is a longer crash
recovery.

`checkpoint_completion_target = 0.9` already does the right thing — spreading
checkpoint writes over most of the interval rather than dumping them — so it is
not the knob to reach for. It was 0.5 in older versions, which is why older
tuning guides tell you to change it.

**`fsync = off` deserves an explicit warning** because it appears in benchmarking
advice: it risks unrecoverable data corruption on a crash. `synchronous_commit =
off` is the *safe* version of the same idea — the docs are clear that it can lose
recent transactions but carries no corruption risk, unlike `fsync = off`. If you
want speed at the cost of durability, `synchronous_commit = off` is the setting
that does it honestly.

The full `synchronous_commit` matrix and its replication meaning are in
[08 · Replicas](../08-replication/01-lag-and-read-your-writes.md); the key point
repeated here is that with `synchronous_standby_names` empty, `remote_apply`,
`remote_write` and `local` all behave identically to `on`.

## Timeouts worth setting

These are not performance settings; they are the ones that stop a bad query from
becoming an incident. All are `user` context, so they can be set per role or per
transaction.

| Setting | Default | Set it to |
|---|---|---|
| `statement_timeout` | **0** (disabled) | bound a single statement |
| `idle_in_transaction_session_timeout` | **0** (disabled) | kill transactions left open |
| `lock_timeout` | **0** (disabled) | **essential for safe DDL** |

`lock_timeout` is the one that matters most in this phase — it is what keeps a
migration from queueing behind a long query and blocking every subsequent
statement while it waits. That mechanism, and why `lock_timeout` plus retry is
the correct pattern, is
[12 · Zero-downtime DDL](../12-zero-downtime-ddl/README.md).

Set them per role rather than globally, so a migration or a nightly report is not
killed by a limit chosen for web requests:

```sql
ALTER ROLE api_user SET statement_timeout = '15s';
ALTER ROLE api_user SET idle_in_transaction_session_timeout = '30s';
```

## Trade-off

Planner and WAL settings trade **generality for fit**. PostgreSQL's defaults are
chosen to start successfully on almost any machine, which necessarily means they
are wrong for a dedicated server — `random_page_cost` models storage that is two
decades old, and `max_wal_size` is sized for a small database.

The counter-pressure is that settings which alter *plans* are double-edged: a
change that improves ten queries can regress one, and the regression is
discovered in production. So change the few whose defaults are clearly wrong for
your hardware, measure the queries you care about, and leave the rest alone.

WAL settings trade differently — **crash-recovery time against steady-state
throughput**. Raising `max_wal_size` smooths checkpoint I/O and lengthens
recovery. That is usually the right direction, and unlike a plan change it fails
predictably.

## Gotchas

**Symptom:** "PostgreSQL ignores my index" on an SSD system
**Cause:** `random_page_cost = 4.0` models a spinning disk, over-costing index
scans.
**Fix:** Test `SET random_page_cost = 1.1` in a session with
`EXPLAIN (ANALYZE, BUFFERS)`, then apply globally.

**Symptom:** Periodic latency spikes on a write-heavy database
**Cause:** `max_wal_size` at the 1 GB default forcing frequent checkpoints, each
causing a burst of full-page writes.
**Fix:** Raise `max_wal_size` to several GB. Accept longer crash recovery.

**Symptom:** Short queries got slower after an upgrade
**Cause:** `jit` is on by default and can add overhead to queries the planner
mis-costs above the JIT threshold.
**Fix:** Test with `SET jit = off` per session before changing it globally.

**Symptom:** A migration or report is killed by a timeout meant for web requests
**Cause:** `statement_timeout` set globally rather than per role.
**Fix:** `ALTER ROLE api_user SET statement_timeout = …` so long-running roles
keep their own limits.

**Symptom:** A benchmark got much faster after `fsync = off`
**Cause:** It also became capable of unrecoverable corruption on a crash.
**Fix:** Never on real data. `synchronous_commit = off` is the safe way to trade
durability for speed — it can lose recent transactions but does not corrupt.

## Interview questions

**★ Why might PostgreSQL choose a sequential scan when an index exists?**
Often because `random_page_cost` is still **4.0**, a value that models a
rotational disk — on SSD, random reads are much closer in cost to sequential, so
index scans are over-costed. `effective_cache_size` left at 4 GB compounds it by
understating how much will be cached. Both are one-line, no-restart changes and
should be tested with `EXPLAIN (ANALYZE, BUFFERS)`.

**★ Why would raising `max_wal_size` reduce latency spikes?**
At the 1 GB default a write-heavy system hits the limit frequently, forcing
checkpoints; each checkpoint causes a burst of full-page writes, which generates
more WAL and brings the next checkpoint sooner. Raising it lengthens the interval
and smooths the I/O, at the cost of longer crash recovery.

**★ Is `fsync = off` ever acceptable?**
Not on data you care about — it risks unrecoverable corruption on a crash.
`synchronous_commit = off` is the safe version of the same idea: the docs are
explicit that it can lose recently committed transactions but carries no
corruption risk. Prefer it, and prefer setting it per transaction.

**Which timeouts should you set, and where?**
`statement_timeout` bounds a single statement,
`idle_in_transaction_session_timeout` bounds the gaps between statements in a
transaction, and `lock_timeout` bounds waiting for a lock — the one that makes
DDL safe. All default to 0 (disabled) and all are `user` context, so set them per
role rather than globally, or a migration gets killed by a limit chosen for web
requests.

**What does `default_statistics_target` do, and when would you change it?**
It controls how much detail `ANALYZE` collects (default 100). Raise it per column
— `ALTER TABLE … ALTER COLUMN … SET STATISTICS 500` — where a skewed distribution
is producing bad row estimates, rather than raising the global and slowing every
`ANALYZE`. For correlated *combinations* of columns, extended statistics
(`CREATE STATISTICS`) is the better tool.

---

← [Memory settings](01-memory.md) · Next → [Changing a setting](03-changing-a-setting.md)
