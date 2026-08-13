---
title: "VACUUM, autovacuum and bloat"
sidebar_label: "13 · VACUUM and bloat"
sidebar_position: 13
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 on **PostgreSQL 18.4** (`postgres:18-alpine`, `127.0.0.1:55432`),
> **Node 24.19.0**, `pg` 8.23.0. Scripts: `sandbox/pg-api/ex30-vacuum-horizon.mjs`,
> `ex28-mvcc-isolation.mjs`.

**VACUUM marks dead row versions reusable; it does not give space back to the operating
system. `VACUUM FULL` does, by rewriting the table under a lock that blocks everything.
Knowing which one you need — usually neither, because autovacuum handles it — is the
whole skill.**

## VACUUM does not shrink the file

```console
$ node ex30-vacuum-horizon.mjs
=== 2. VACUUM reuses space; only VACUUM FULL returns it ===
200k rows              : 46 MB
after deleting half   : 46 MB
after VACUUM          : 46 MB
after VACUUM FULL     : 23 MB  (took 260.0 ms, ACCESS EXCLUSIVE the whole time)
reuse: 23 MB -> delete+vacuum 23 MB -> insert 40k more 23 MB
```

Deleting 100 000 of 200 000 rows changed the file size by nothing. `VACUUM` changed it by
nothing. Only `VACUUM FULL` halved it.

**That is not a failure — it is the design.** The last line is the point: after another
delete and `VACUUM`, inserting 40 000 fresh rows kept the table at 23 MB. The freed space
was *reused* rather than returned. For a table with steady churn this is exactly what you
want, and running `VACUUM FULL` on it would be pure waste — the space would be re-consumed
immediately, having taken an `ACCESS EXCLUSIVE` lock to give it back.

**Use `VACUUM FULL` only when the table will not regrow**: after a one-off bulk delete of
historical data, or after dropping a large column. Never on a schedule. (The
`pg_repack` extension does the same rewrite without the exclusive lock, which is the
production answer when you must reclaim from a live table.)

## What autovacuum does, and when

```console
=== 6. autovacuum thresholds ===
  autovacuum                             on
  autovacuum_freeze_max_age              200000000
  autovacuum_naptime                     60s
  autovacuum_vacuum_insert_threshold     1000
  autovacuum_vacuum_scale_factor         0.2
  autovacuum_vacuum_threshold            50
  vacuum_freeze_min_age                  50000000
  vacuum_max_eager_freeze_failure_rate   0.03
  v_bloat has 90000 live rows -> autovacuum fires at 50 + 0.2 x 90000 = 18050 dead rows
```

The trigger is `autovacuum_vacuum_threshold + scale_factor × live_rows`. With the
defaults that is **20% of the table plus 50 rows**, and the scale factor is what makes
the default wrong at size:

| Live rows | Dead rows before autovacuum runs |
|---|---|
| 1 000 | 250 |
| 90 000 | 18 050 (measured above) |
| 10 000 000 | 2 000 050 |

**On a large hot table, two million dead rows accumulate before cleanup starts.** The
standard fix is a per-table override:

```sql
ALTER TABLE orders SET (
  autovacuum_vacuum_scale_factor = 0.02,   -- 2% instead of 20%
  autovacuum_vacuum_threshold = 1000,
  autovacuum_analyze_scale_factor = 0.01
);
```

Two other settings from the same output are worth knowing:
`autovacuum_vacuum_insert_threshold` (1000) means insert-only tables now get vacuumed
too — before PostgreSQL 13 they never were, so the visibility map never got set and
[index-only scans](../phase-10-indexes/08-index-only.md) never happened.
`vacuum_max_eager_freeze_failure_rate` is PostgreSQL 18's eager freezing, which spreads
freeze work out instead of leaving it all to an
[anti-wraparound emergency](16-xid-wraparound.md).

## The three commands

| Command | Lock | Effect |
|---|---|---|
| `VACUUM t` | `SHARE UPDATE EXCLUSIVE` — reads and writes continue | marks dead space reusable, updates the visibility map |
| `VACUUM (ANALYZE) t` | same | the above plus fresh planner statistics |
| `VACUUM FULL t` | `ACCESS EXCLUSIVE` — blocks everything | rewrites the table compactly, returns space to the OS |

`VACUUM` never blocks your application; `VACUUM FULL` blocks all of it, and needs free
disk equal to the table's live size while it runs.

## Preventing bloat instead of cleaning it

Three levers, in order of effectiveness:

**1. Do not let dead rows pile up faster than autovacuum clears them.** That is the
per-table `scale_factor` above.

**2. Make updates HOT.** [Measured on the MVCC page](05-mvcc.md), the same 250 000
updates produced a 24 MB table at the default `fillfactor = 100` and 13 MB at 70, with
HOT updates rising from 0.1% to 76.6%:

```sql
ALTER TABLE sessions SET (fillfactor = 70);
```

And do not index columns you update constantly — an index on the updated column drove
HOT to 0% regardless of fillfactor.

**3. Keep transactions short.** No amount of tuning helps if
[an old transaction pins the horizon](12-long-transactions.md) — measured, VACUUM removed
0 of 100 000 dead rows and the file grew 27 MB → 40 MB.

## Monitoring

```sql
SELECT relname,
       n_live_tup, n_dead_tup,
       round(100.0 * n_dead_tup / nullif(n_live_tup, 0), 1) AS dead_pct,
       last_autovacuum, autovacuum_count
FROM pg_stat_user_tables
WHERE n_dead_tup > 1000
ORDER BY n_dead_tup DESC;
```

```console
deadest tables          : [{"relname":"v_h","n_live_tup":"200000","n_dead_tup":"300000","dead_pct":"150.0"},
                           {"relname":"v_bloat","n_live_tup":"0","n_dead_tup":"150001","dead_pct":null}]
```

**`dead_pct` above 100 is possible and normal-looking in the stats** — here 300 000 dead
against 200 000 live. What you are watching for is a table where `dead_pct` stays high
*and* `last_autovacuum` is old or null: that means autovacuum is not keeping up, or is
being blocked.

These counters are estimates maintained by the stats collector, and they lag. For a
sized measurement use `pgstattuple` or compare `pg_relation_size` against the size
implied by the row count.

## Trade-off

**Autovacuum's defaults are tuned for small tables and safety, not for large hot ones.**
Leaving them costs disk and degrading plans; tightening them costs I/O during business
hours — every vacuum reads and dirties pages, competing with your queries. The right
setting is per-table, not global: aggressive on the few tables with heavy churn, default
everywhere else. And `VACUUM FULL` is not a stronger vacuum, it is a different operation
with an outage attached; reaching for it routinely means the autovacuum settings are
wrong.

## Gotchas

**Symptom:** `VACUUM` ran but the table is the same size on disk
**Cause:** Correct behaviour — it marks space reusable, it does not truncate the file
**Fix:** Nothing, unless the table will not regrow; then `VACUUM FULL` or `pg_repack`

**Symptom:** A large table is never vacuumed until it is badly bloated
**Cause:** `autovacuum_vacuum_scale_factor = 0.2` means 20% of the rows must die first
**Fix:** Per-table `SET (autovacuum_vacuum_scale_factor = 0.02, autovacuum_vacuum_threshold = 1000)`

**Symptom:** `VACUUM FULL` on a live table caused an outage
**Cause:** It takes `ACCESS EXCLUSIVE` for the whole rewrite
**Fix:** `pg_repack`, or a maintenance window; never schedule `VACUUM FULL` routinely

**Symptom:** Autovacuum runs constantly and never catches up
**Cause:** Dead rows are being created faster than it can clear them, or the horizon is pinned
**Fix:** Check for [long transactions](12-long-transactions.md) first, then raise `autovacuum_max_workers` / `autovacuum_vacuum_cost_limit`

**Symptom:** An update-heavy table bloats despite frequent vacuuming
**Cause:** No HOT updates — `fillfactor = 100`, or an index on the updated column
**Fix:** `SET (fillfactor = 70)` and drop the index on the hot column (measured 24 MB → 13 MB)

**Symptom:** `n_dead_tup` looks fine but the table is clearly bloated
**Cause:** The counters are lagging estimates
**Fix:** Measure with `pgstattuple`, or compare `pg_relation_size` to the expected size

## Interview questions

**★ Does `VACUUM` free disk space?**
It makes space reusable by the table, but does not return it to the OS. Measured:
deleting half of a 46 MB table and vacuuming left it at 46 MB; a later insert of 40 000
rows reused the space rather than growing the file.

**★ When should you run `VACUUM FULL`?**
Only when a table has permanently shrunk — after a one-off historical purge or dropping
a big column — and can tolerate `ACCESS EXCLUSIVE` for the rewrite. Never on a schedule.

**★ When does autovacuum trigger?**
At `threshold + scale_factor × live_rows`, by default 50 + 20%. Measured: 90 000 live
rows → 18 050 dead rows required. On a 10-million-row table that is two million dead rows,
which is why large tables need a per-table override.

**★ How do you reduce bloat rather than clean it up?**
Lower `fillfactor` so updates stay HOT (measured 24 MB → 13 MB), avoid indexing
frequently-updated columns, tighten per-table autovacuum settings, and keep transactions
short.

**★ Autovacuum is running but dead tuples keep growing. Why?**
Usually an old transaction, replication slot or standby feedback pinning the xmin
horizon — VACUUM runs and removes nothing. Measured: 0 of 100 000 removed with a blocker
open.

**What lock does a plain `VACUUM` take?**
`SHARE UPDATE EXCLUSIVE` — reads and writes continue; it conflicts only with DDL and
another vacuum on the same table.

**Why do insert-only tables need vacuuming?**
To set the visibility map, which is what makes index-only scans possible.
`autovacuum_vacuum_insert_threshold` (default 1000) exists for exactly this.

---

← [Long-running transactions](12-long-transactions.md) · Next → [Idle in transaction](14-idle-in-transaction.md)
