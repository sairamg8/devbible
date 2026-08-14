---
title: "10.3 · Changing a setting, and where to start"
sidebar_label: "03 · Changing a setting"
sidebar_position: 3
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-13 against the **PostgreSQL 18 documentation** —
> [setting parameters](https://www.postgresql.org/docs/18/config-setting.html).
> The `pg_settings.context` values quoted below are **sandbox-measured** —
> `sandbox/pg-api/ex53-hba-tls.sh` read them directly from a running PG 18.4.
> No other console output on this page.

**Knowing which value to change is half the problem; knowing what it takes to
apply it is the other half.** A reload that silently does nothing is the most
common way a tuning session wastes an afternoon.

## Changing a setting: the four contexts

`pg_settings.context` tells you what a change requires. Measured directly on
PG 18.4 by `ex53`:

| `context` | To apply | Examples measured |
|---|---|---|
| `postmaster` | **restart** | `shared_buffers`, `port`, `hba_file`, `max_connections` |
| `sighup` | **reload** | `ssl`, `log_min_duration_statement`, `random_page_cost` |
| `superuser` | `SET` by a superuser | `log_statement` |
| `user` | `SET` by anyone | `work_mem`, `statement_timeout` |

Check before you plan a change, rather than after a reload does nothing:

```sql
SELECT name, setting, unit, context, pending_restart
  FROM pg_settings
 WHERE name IN ('shared_buffers','work_mem','random_page_cost','max_connections');
```

**`pending_restart`** is the column that tells you a change is staged but not yet
in force — the direct answer to "did my change apply?".

### `ALTER SYSTEM` vs editing the file

```sql
ALTER SYSTEM SET random_page_cost = 1.1;   -- writes postgresql.auto.conf
SELECT pg_reload_conf();                    -- apply, for sighup settings
```

`ALTER SYSTEM` writes to `postgresql.auto.conf`, which is read **after**
`postgresql.conf` and therefore **overrides it**. That precedence is the source of
a genuinely confusing failure: someone edits `postgresql.conf`, reloads, and the
value does not change, because an `ALTER SYSTEM` from months ago is still winning.

To undo one:

```sql
ALTER SYSTEM RESET random_page_cost;   -- remove from postgresql.auto.conf
ALTER SYSTEM RESET ALL;                -- remove everything
```

Precedence, lowest to highest: `postgresql.conf` → `postgresql.auto.conf`
(`ALTER SYSTEM`) → per-database (`ALTER DATABASE … SET`) → per-role (`ALTER ROLE
… SET`) → per-session (`SET`) → per-transaction (`SET LOCAL`).

Two operational notes from the same measured run: **`pg_reload_conf()` returns
before the new configuration is actually in force** — `ex53` needed a wait for
results to stop lagging one step behind the change — and a **syntax error in a
configuration file does not take the server down**: the reload is refused, the
old values stay in force, and the error is reported. The danger is a *restart*
with a bad file, which will fail to start. That is why `pg_file_settings` and
`pg_hba_file_rules` are worth checking after an edit and before a restart, and it
is covered in [05 · pg_hba.conf](../05-pg-hba.md).

## Where to actually start

For a typical PERN application on a managed instance, in order of value:

1. **`random_page_cost = 1.1`** if you are on SSD — plan quality, no restart.
2. **`effective_cache_size`** to ~75% of RAM — plan quality, no restart, no
   memory cost.
3. **Timeouts** (`statement_timeout`, `idle_in_transaction_session_timeout`,
   `lock_timeout`) per role — incident prevention.
4. **`work_mem`** raised carefully, per role, with spill evidence.
5. **`max_wal_size`** if writes are heavy and you see periodic I/O stalls.
6. **`shared_buffers`** to ~25% of RAM — needs a restart, so batch it with
   something else.

Notice that the first three cost nothing and need no restart, and that the
setting everyone talks about first (`shared_buffers`) is sixth.

## Trade-off

Configuration trades **generality for fit**. PostgreSQL's defaults are chosen to
start successfully on almost any machine, which necessarily means they are wrong
for a dedicated server — conservative on memory, and modelling storage that is
two decades old in `random_page_cost`.

The counter-pressure is that every value you set is a value you now own. A tuned
`work_mem` that was right at 50 connections is wrong at 300; a `random_page_cost`
tuned for one workload's access pattern may mis-cost another's. Settings that
alter *plans* are especially double-edged, because a plan that improves ten
queries can regress one, and the regression is discovered in production.

So the honest posture is: change the few settings whose defaults are clearly
wrong for your hardware, measure the queries you care about, and leave the rest
alone. Tuning is not a checklist to complete, and most systems need fewer changes
than tuning guides imply.

## Gotchas

**Symptom:** "PostgreSQL ignores my index" on an SSD system
**Cause:** `random_page_cost = 4.0` models a spinning disk, over-costing index
scans.
**Fix:** Test `SET random_page_cost = 1.1` in a session with
`EXPLAIN (ANALYZE, BUFFERS)`, then apply globally with `ALTER SYSTEM`.

**Symptom:** Editing `postgresql.conf` has no effect
**Cause:** `postgresql.auto.conf` is read afterwards and overrides it — someone
ran `ALTER SYSTEM`.
**Fix:** `ALTER SYSTEM RESET <name>`, or check `pg_file_settings` to see which
source is winning.

**Symptom:** A reload did not apply the change
**Cause:** The setting's context is `postmaster`.
**Fix:** Check `pg_settings.context` and `pending_restart`; restart.

**Symptom:** Periodic latency spikes on a write-heavy database
**Cause:** `max_wal_size` at the 1 GB default forcing frequent checkpoints, each
causing a burst of full-page writes.
**Fix:** Raise `max_wal_size` to several GB. Accept longer crash recovery.

**Symptom:** The server would not start after a config change
**Cause:** A syntax error is tolerated by a *reload* (refused, old values kept)
but fatal at *restart*.
**Fix:** Check `pg_file_settings` and `pg_hba_file_rules` for errors **before**
restarting.

**Symptom:** A change applied "sometimes" right after a reload
**Cause:** `pg_reload_conf()` returns before the new settings are in force —
measured; a short wait was required for consistent results.
**Fix:** Do not assert on configuration immediately after reloading.

**Symptom:** Short queries got slower after an upgrade
**Cause:** `jit` is on by default and can add overhead to queries the planner
mis-costs above the JIT threshold.
**Fix:** Test with `SET jit = off` per session before changing it globally.

## Interview questions

**★ Why might PostgreSQL choose a sequential scan when an index exists?**
Often because `random_page_cost` is still **4.0**, a value that models a
rotational disk — on SSD, random reads are much closer in cost to sequential, so
index scans are over-costed. `effective_cache_size` left at 4 GB compounds it by
understating how much will be cached. Both are one-line, no-restart changes and
should be tested with `EXPLAIN (ANALYZE, BUFFERS)`.

**★ What is the difference between `ALTER SYSTEM` and editing `postgresql.conf`?**
`ALTER SYSTEM` writes `postgresql.auto.conf`, which is read *after*
`postgresql.conf` and overrides it. That precedence is why an edit to the main
file can appear to do nothing. `ALTER SYSTEM RESET` removes the override.

**★ How do you know whether a setting needs a restart or a reload?**
`pg_settings.context`: `postmaster` needs a restart, `sighup` a reload,
`superuser`/`user` can be `SET` in a session. `pending_restart` shows a staged
change that is not yet in force. Measured on PG 18.4: `shared_buffers`, `port`
and `hba_file` are `postmaster`; `ssl` is `sighup`.

**★ Why would raising `max_wal_size` reduce latency spikes?**
At the 1 GB default a write-heavy system hits the limit frequently, forcing
checkpoints; each checkpoint causes a burst of full-page writes, which generates
more WAL and brings the next checkpoint sooner. Raising it lengthens the interval
and smooths the I/O, at the cost of longer crash recovery.

**Is `fsync = off` ever acceptable?**
Not on data you care about — it risks unrecoverable corruption on a crash.
`synchronous_commit = off` is the safe way to trade durability for speed: it can
lose recently committed transactions but does not risk corruption. Use that
instead, and prefer setting it per transaction.

**What is the precedence order for settings?**
`postgresql.conf` → `postgresql.auto.conf` → per-database → per-role →
per-session `SET` → `SET LOCAL`. The narrowest scope wins, which is what makes
`ALTER ROLE … SET` the right tool for giving an analytics role more `work_mem`
without affecting the API.

---


---

← [Planner and WAL](02-planner-wal-and-changing.md) · Next → [Logging slow queries](../11-logging/README.md)
