---
name: devbible-postgresql-concepts-phase13
description: The load-bearing concepts and cited sources behind PostgreSQL phase 13 topics 07-18, plus the two missing rows (money, multi-tenancy) — written doc-validated under the no-new-sandboxes rule
metadata:
  type: reference
---

# PostgreSQL phase 13 (07–18) — concepts and sources

Written **2026-08-13, overnight session `052a10c2`**, when PostgreSQL was
un-parked and finished. All twelve stamps replaced. Companion to
[[devbible-postgresql-phase13-ops]], which holds the *measured* dataset for
topics 01–06; this file holds the **doc-validated** concepts for 07–18 so a later
session can review or reuse them without re-reading the pages.

**Provenance rule applied throughout:** measured claims are marked
**sandbox-measured** and name their script; everything else cites the
documentation URL in the `> Verified:` line. **No page carries a console block
that was not produced by a run that actually happened** ([[devbible-no-new-sandbox-scripts]]).

## What was reused vs cited

| Reused measured data | From | Used on |
|---|---|---|
| 40 clients → 1 backend; 40 concurrent → exactly 5 | `ex54` §1–2 | 07 |
| pool exhaustion: 2 clients waited **120 204 ms**, `08P01` | `ex54` §2 | 07 |
| `SET` persists across pooled handoff, `SET LOCAL` does not | `ex54` §3 | 07, 14, phase-3/20 |
| `pg_settings.context` values (postmaster/sighup) | `ex53` | 10 |
| `log_statement='all'` logs `DETAIL: Parameters: $1 = '…'`; `log_parameter_max_length` **-1** | `ex51` | 11 |
| `ALTER ROLE … PASSWORD` writes plaintext to the log | `ex51` | 11 |
| restore = **4×** dump; `pg_restore -t` restored **0** indexes | `ex52` | 15, 18 |
| numeric vs float8 vs bigint cents (76.8 / 27.3 / 27.7 ms) | `ex33` | phase-2/17 |

⚠️ **`ex54`'s later sections ran but were never captured** — nothing was
reconstructed from them. Where a claim needed that output it was cited to docs
instead.

## Load-bearing concepts, per topic

**07 PgBouncer** (chunked ×3) — connection = OS **process**, so cost is
structural. `max_connections` 100, **postmaster** context; `superuser_reserved_connections`
3, `reserved_connections` 0. Real count = **replicas × pool max**. Pool modes:
session/transaction/statement; transaction mode breaks `SET`, `LISTEN`, `WITH HOLD`,
SQL `PREPARE`, temp tables, `LOAD`, session advisory locks. **`server_reset_query`
is NOT used in transaction mode** (documented). **PgBouncer 1.21.0+ supports
protocol-level prepared statements** via `max_prepared_statements` (default 200) —
the "prepared statements don't work" advice is out of date. `query_wait_timeout`
**120 s** default. Smaller pool is usually faster.

**08 Replicas** (chunked ×2, consumer half only) — four LSN stages
sent/write/flush/**replay**; durability ≠ visibility, and the flush→replay gap is
the read-your-writes window. `replay_lag` documented as approximating "the delay
before recent transactions became visible". Lag columns **revert to NULL** when
caught up — not zero, not an error. `synchronous_commit`: only **`remote_apply`**
gives read-your-writes; with `synchronous_standby_names` empty, `remote_apply`/
`remote_write`/`local` all behave as `on`. Conflicts: `40001`
`canceling statement due to conflict with recovery`, `max_standby_streaming_delay`
**30 s**, `hot_standby_feedback` **off** (cost = bloat on the primary).
`vacuum_defer_cleanup_age` was **removed in PG16**. Reads that feed writes must go
to the primary.

**09 Monitoring** (chunked ×3) — three questions, three views: `pg_stat_activity`
(now), `pg_stat_statements` (aggregate), the log (individual). PG18 adds the
`starting` state. Order by `xact_start`; `xact_age` ≫ `query_age` = *idle in
transaction*. `pg_blocking_pids()`. cancel (query) vs terminate (session).
**`total_exec_time` beats `mean_exec_time`.** `pg_stat_statements.max` **5000**,
`.track` **top**, `.track_planning` **off**; needs `shared_preload_libraries` +
**restart** + `CREATE EXTENSION`. **`queryid` not stable across major versions.**
Cache-hit ratio understates because `blks_read` misses may be served by OS page
cache.

**10 Config** (chunked ×2) — **`work_mem` is per sort/hash operation**, worst case
`work_mem × operations × concurrency`; `hash_mem_multiplier` **2.0**.
**`effective_cache_size` allocates nothing** (estimation only, default 4 GB) —
raising it makes index scans look cheaper. `shared_buffers` 128 MB default,
~25% of RAM, **postmaster**. `maintenance_work_mem` 64 MB, safe to raise, but ×
`autovacuum_max_workers` — use `autovacuum_work_mem`. **`random_page_cost` 4.0
models a spinning disk; 1.1 on SSD** is the highest-value one-line change.
`max_wal_size` 1 GB default causes checkpoint-driven latency spikes.
`postgresql.auto.conf` (`ALTER SYSTEM`) **overrides** `postgresql.conf`.
⚠️ Phase 0's `shared_buffers` benchmark is **confounded** — deliberately not reused.

**11 Logging** (chunked ×2) — defaults log nothing useful:
`log_min_duration_statement` **-1**, `log_statement` **none**, `log_lock_waits`
**off**, `log_temp_files` **-1**, `log_autovacuum_min_duration` **10min**,
`log_line_prefix` `'%m [%p] '`. **Parameters do NOT protect the log** — measured.
`log_parameter_max_length_on_error` **0** (why people think params are never
logged). `auto_explain.log_analyze` instruments **every** statement — docs warn
"extremely negative impact"; mitigate with `log_timing=off` / `sample_rate`.

**12 Zero-downtime DDL** (chunked ×2) — **a waiting `ACCESS EXCLUSIVE` blocks
everything behind it**; new queries do not jump the queue, so a 5 ms migration
causes a 30 s outage. `lock_timeout` **0** default → set it, retry on **`55P03`**.
`ADD COLUMN` with **non-volatile** default is catalog-only **since PG11**;
volatile/identity/generated/constrained-domain still rewrite. `VALIDATE CONSTRAINT`
= **`SHARE UPDATE EXCLUSIVE`**; `ADD FOREIGN KEY` = **`SHARE ROW EXCLUSIVE`**.
`NOT VALID` → `VALIDATE` → `SET NOT NULL` (PG12+ uses the validated CHECK as proof).
`CREATE INDEX CONCURRENTLY` cannot run in a transaction block and **leaves an
invalid index on failure** that still costs writes — check `indisvalid` after every
migration. Phase 3 owns the measured statement-level view (`ex11`).

**13 Managed Postgres** (chunked ×2) — root cause is **you are not a superuser**
(`rds_superuser`). Config via **parameter groups** (defaults not editable);
extensions from an **allowlist**; no server-side `COPY FROM '/path'`.
**Most common incident = wrong endpoint.** Neon = PgBouncer, `-pooler` hostname,
protocol-level prepared statements **supported**. Supabase = Supavisor, port
**6543** transaction / 5432 direct, docs say transaction mode **does not support
prepared statements** — a real per-provider difference. Migrations → **direct**
endpoint. ⚠️ Provider facts are the fastest-moving in the corpus; dated 2026-08-13.

**14 RLS** (chunked ×2) — enabling with no policy = **default deny, table looks
empty**. `USING` (existing rows) vs `WITH CHECK` (resulting row); `UPDATE` needs
**both** or a user can reassign `owner_id`. PERMISSIVE = **OR**, RESTRICTIVE =
**AND**; restrictive alone grants nothing. **Table owners bypass RLS by default** →
`FORCE ROW LEVEL SECURITY` + non-owner role. `set_config(name,val,true)` because
`SET LOCAL x = $1` is **`42601`**. Policy columns must be indexed. Helper functions
**STABLE**, never IMMUTABLE. `BYPASSRLS` role for jobs, explicitly.

**15 Physical backup / PITR** (chunked ×2) — base backup + WAL; backup need not be
filesystem-consistent because replay repairs it. `archive_mode` **off**, restart.
`archive_command` must return non-zero on failure; `test ! -f` guard.
`archive_timeout` **0** bounds worst-case loss. `-X stream` makes a backup
standalone. `recovery.signal` vs `standby.signal`; `recovery_target_action`
**pause** default — verify before promoting. **Target must be after the base backup
ends.** Timelines make a wrong PITR attempt repeatable. RPO/RTO are product
decisions.

**16 Logical replication** — decodes changes, target is **writable** and may be a
**different major version**. Not replicated: **DDL/schema, sequence data, large
objects**; only tables. **`TRUNCATE` IS replicated** (folklore says otherwise) but
fails with FKs outside the subscription. Replica identity needed for UPDATE/DELETE;
`REPLICA IDENTITY FULL` fails for types without a default B-tree/hash opclass
(`point`, `box`). **Abandoned replication slot fills the publisher's disk** —
`max_slot_wal_keep_size`. Not for HA.

**17 Major upgrades** — `--check` works with the old server running. `--link` /
`--swap` **destroy the rollback path** (quoted warnings). Extensions: install the
`.so`, **do not** `CREATE EXTENSION`. 🔵 **PG18 change: `pg_upgrade` now transfers
most optimizer statistics** — the classic "always catastrophically slow until
ANALYZE" warning is pre-18. Still run `vacuumdb --all --analyze-in-stages`;
`CREATE STATISTICS` objects are not transferred. Sequences not replicated →
`23505` storm is the classic logical-replication cutover failure.

**18 Disaster drill** — synthesis. Untested backup = belief. The **most likely
disaster is one you cause** (bad migration / wrong DELETE) and **replicas do not
help** — only PITR does. Retention must be set against "how long might this go
unnoticed". Runbook lives outside the systems it describes; someone who did not
write it must be able to follow it.

## The two missing rows (closed)

**phase-2 `17-modelling-money/`** (chunked ×2, Master) — amount **+ currency**;
never the `money` type (**locale-dependent**, documented dump/restore hazard).
Declare the scale (unconstrained numeric allows 16 383 fractional digits).
**`numeric` rounds ties away from zero, float rounds to even** — documented table,
2.5 → 3 vs 2. Round **once**, at the end. **Allocation**: 100/3 loses a penny —
largest-remainder; assert parts sum to whole. Store `fx_rate` + `fx_rate_at`.
Append-only ledger, derive balances. `pg` returns numeric as a **string** — never
`parseFloat`. **ISO 4217 minor units are not always 2** (JPY 0, some 3).

**phase-3 `20-multi-tenancy/`** (chunked ×2) — the *decision*, where page 10 is the
*mechanism*. Shared schema is the default and the **only reversible** direction
(separated → shared requires remapping colliding ids). `tenant_id` **leads every
index**. Uniqueness per tenant. Composite FK `(invoice_id, currency)`-style ties
child rows to parent. RLS as backstop; `SET LOCAL` is a **security** requirement.
Schema-per-tenant costs N migrations + `UNION` reporting + catalog growth.
Hybrid is a legitimate destination.

## Final state — verified on disk 2026-08-13

| | |
|---|---|
| Pages (chunks counted separately) | **298** |
| Carrying `> Verified:` | **298 — 100%** |
| Files over 300 lines | **0** |
| PostgreSQL broken links in a clean build | **0** |

Per-phase page counts, now correct in `src/data/progress.js`: 13 · 15 · 19 · 22 ·
22 · 16 · 40 · 16 · 16 · 24 · 18 · 16 · 21 · **40**.

**9 files initially landed 301–328 lines and were split on concept boundaries**
(never trimmed — [[devbible-never-compress-to-fit-cap]]). The splits, with the
renumbering they forced:

| Topic | Became |
|---|---|
| `phase-13/07-pgbouncer` | 03 split → new **04-node-and-observing** |
| `phase-13/09-monitoring` | 02 split → new **03-reading-pg-stat-statements**; old 03 → **04-table-health** + **05-database-health** (now 5 chunks) |
| `phase-13/10-config-keys` | 02 split → new **03-changing-a-setting** |
| `phase-13/12-zero-downtime-ddl` | 02 split → new **03-indexes-and-checklist** |
| `phase-13/14-rls` | 01 split → new **02-carrying-the-identity**; old 02 → **03-performance-and-practice** |
| `phase-13/15-physical-backup` | file → directory: **01-archiving** + **02-restoring-and-rpo** |
| `phase-2/17-modelling-money` | 02 split → new **03-ledgers-and-node** |
| `phase-3/20-multi-tenancy` | 01 split → new **02-models-compared**; old 02 → **03-operating-it** |

⚠️ **Every split renumbering required an inbound-link sweep** — the corpus's most
repeated mistake. All were fixed and the clean build confirms zero PG broken
links. The only broken links remaining in the build belong to the **JavaScript
and TypeScript** sessions' in-progress pages, not to PostgreSQL.

## What is left for PostgreSQL — review only, no writing

1. The **rubric review** per phase (`docs/reviews/review-prompt.md`, D1–D5) —
   still never run per-phase.
2. `/code-review ultra` — user-triggered only.
3. **Item 14**, the re-split of ~20 Master-tier pages in *other* technologies
   that cluster just under the cap ([[devbible-postgresql-review-remediation]]).
   PostgreSQL's own clustering is now resolved.

`devbible` itself is **not committed** — that repo needs an explicit instruction
naming the commit. Only this store was committed.

Related: [[devbible-postgresql-phase13-ops]] · [[devbible-postgresql-rewrite-handoff]] ·
[[devbible-no-new-sandbox-scripts]] · [[devbible-never-compress-to-fit-cap]] ·
[[devbible-postgresql-repo-and-build]]
