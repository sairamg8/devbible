---
title: "12.1 · The lock queue — how one migration stops everything"
sidebar_label: "01 · The lock queue"
sidebar_position: 1
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-13 against the **PostgreSQL 18 documentation** —
> [`ALTER TABLE`](https://www.postgresql.org/docs/18/sql-altertable.html),
> [explicit locking](https://www.postgresql.org/docs/18/explicit-locking.html),
> [client connection defaults](https://www.postgresql.org/docs/18/runtime-config-client.html).
> **Not sandbox-measured** — no console output on this page. The *measured*
> `ALTER TABLE` timings and lock behaviour on a 200 000-row table are in
> [Phase 3 · ALTER TABLE](../../phase-3-ddl/05-alter-table.md), from
> `sandbox/pg-api/ex11-ddl-alter.mjs`.

**The migration that causes an outage is usually not slow. It is fast, and it
spends four seconds waiting.** Understanding why requires one non-obvious fact
about how PostgreSQL queues locks.

## The fact that explains the outage

`ALTER TABLE` takes an **`ACCESS EXCLUSIVE`** lock unless the documentation
explicitly says otherwise — that is the documented default across its subforms.
`ACCESS EXCLUSIVE` conflicts with *every* other lock mode, including the
`ACCESS SHARE` that a plain `SELECT` takes. So while it is held, nothing else
touches that table.

That alone would be survivable if the lock were held briefly. The problem is what
happens while the migration is **waiting** to acquire it:

1. A long-running `SELECT` holds `ACCESS SHARE` on `orders`. Perfectly normal —
   say a 30-second report.
2. Your migration requests `ACCESS EXCLUSIVE`. It conflicts, so it **queues**.
3. A new `SELECT` arrives. It would not conflict with the report — two
   `ACCESS SHARE` locks coexist happily — **but PostgreSQL does not let it jump
   the queue.** It queues behind the waiting `ACCESS EXCLUSIVE`.
4. Every subsequent query on `orders` queues too.

**The table is now effectively down, and the statement causing it has not even
started.** The migration is blocked by one slow reader, and it is blocking
everyone else on that reader's behalf.

This queueing behaviour is deliberate — without it, a stream of short readers
could starve the writer forever — but it means the blast radius of a DDL
statement is set by *the longest transaction touching that table*, not by the
DDL's own duration. A migration that takes 5 ms can cause a 30-second outage.

Two consequences follow immediately, and they are the whole of this chunk:

- **Never run DDL without `lock_timeout`.**
- **Never run DDL while a long transaction may be open** — which, on a live
  system, is always.

## `lock_timeout` is not optional

```sql
SET lock_timeout = '3s';
ALTER TABLE orders ADD COLUMN notes text;
```

`lock_timeout` defaults to **0 — disabled**, meaning wait forever. Setting it
converts the failure mode from "the site is down until someone notices" into "the
migration failed and can be retried", which is an enormously better outcome.

The correct pattern is **short timeout plus retry**:

```js
async function ddlWithRetry(pool, sql, {attempts = 10, timeout = '3s'} = {}) {
  for (let i = 0; i < attempts; i++) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(`SET LOCAL lock_timeout = '${timeout}'`);
      await client.query(sql);
      await client.query('COMMIT');
      return;
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      if (err.code !== '55P03') throw err;          // lock_not_available
      await new Promise(r => setTimeout(r, 2 ** i * 100));  // back off
    } finally {
      client.release();
    }
  }
  throw new Error('could not acquire lock after retries');
}
```

Three details in that helper matter:

- **`55P03` (`lock_not_available`)** is the SQLSTATE to retry on. Anything else is
  a real error and should propagate.
- **`SET LOCAL`** scopes the timeout to the transaction, so it does not leak onto
  a pooled connection — the rule from
  [07 · PgBouncer](../07-pgbouncer/02-pool-modes.md).
- **Backoff matters** because the blocker is often a periodic job. Retrying
  immediately ten times in a row hits the same 30-second report ten times.

`statement_timeout` is *not* a substitute. In many PostgreSQL versions it does not
cover time spent waiting for a lock, which is precisely the phase you need
bounded. Use `lock_timeout` for DDL, and set both.

## Find the blocker first

Before running a migration, check what is already open on the table — and know
that any transaction with `xact_age` above a few seconds is a hazard:

```sql
SELECT pid, now() - xact_start AS xact_age, state, left(query, 60)
  FROM pg_stat_activity
 WHERE backend_type = 'client backend'
   AND xact_start < now() - interval '5 seconds'
 ORDER BY xact_start;
```

If the migration is already stuck, the diagnosis is in
[09 · Monitoring](../09-monitoring/01-whats-happening-now.md):
`pg_blocking_pids()` finds the root of the chain. In an emergency,
`pg_cancel_backend()` on the *blocker* releases everything queued behind it —
cancelling the migration itself does not help nearly as much, because the queue
formed behind its lock request.

**`idle in transaction` sessions are the worst blockers**, because they hold
locks indefinitely while doing nothing, and they are invisible to anyone looking
for "slow queries". Set `idle_in_transaction_session_timeout`
([10 · Config](../10-config-keys/02-planner-wal-and-changing.md)) before you need
it.

## Which operations are actually cheap

Not every `ALTER TABLE` is dangerous. The lock is nearly always
`ACCESS EXCLUSIVE`; what varies is **how long it is held**, and that is the number
that matters. From the documentation:

| Operation | Rewrite? | Practical cost |
|---|---|---|
| `ADD COLUMN` (no default, or **non-volatile** default) | **no** | catalog only — the default is stored in metadata |
| `ADD COLUMN` with a **volatile** default (`clock_timestamp()`) | **yes** | full rewrite |
| `ADD COLUMN` stored generated / identity / constrained domain | **yes** | full rewrite |
| `DROP COLUMN` | no | catalog only; space reclaimed later |
| `SET NOT NULL` | no rewrite, but **full scan** | proportional to table size |
| `ADD CONSTRAINT` (CHECK/FK) | no rewrite, but **full scan** | proportional to table size |
| `ADD CONSTRAINT … NOT VALID` | no | **scan skipped** — the key trick |
| `VALIDATE CONSTRAINT` | no | scan, but **`SHARE UPDATE EXCLUSIVE`** |
| `ALTER COLUMN TYPE` | **usually yes** | full rewrite (exception below) |
| `RENAME` | no | catalog only |

Three of those rows deserve emphasis.

**`ADD COLUMN` with a constant default is fast, and has been since PostgreSQL
11.** The docs state the default "is evaluated at the time of the statement and
the result stored in the table's metadata", applied only when the table is later
rewritten — "making the `ALTER TABLE` very fast even on large tables". The
folklore that adding a defaulted column rewrites the table is more than a decade
out of date. What still rewrites is a **volatile** default, an identity column, a
stored generated column, or a constrained domain type.

**`VALIDATE CONSTRAINT` takes only `SHARE UPDATE EXCLUSIVE`**, which does not
block reads or writes. That is what makes the two-step constraint pattern in
[chunk 02](02-expand-and-contract.md) work.

**`ADD FOREIGN KEY` is a documented exception**: it requires only
`SHARE ROW EXCLUSIVE`, not `ACCESS EXCLUSIVE`. It still blocks writes on both
tables, so it is not free — but it does not block reads.

**`ALTER COLUMN TYPE` has one exception worth knowing**: if the `USING` clause
does not change the contents and the old type is binary coercible to the new one,
no rewrite is needed. `varchar(50)` → `varchar(100)` and `varchar` → `text` fall
in this category. `int` → `bigint` does **not** — that is a full rewrite, and on
a large table it is a maintenance window.

The measured timings behind these — on a 200 000-row table — are in
[Phase 3 · ALTER TABLE](../../phase-3-ddl/05-alter-table.md), which owns the
statement-level view. This page owns the deployment view.

## Transactional DDL cuts both ways

PostgreSQL supports DDL inside transactions, which is genuinely excellent: a
migration that fails halfway rolls back completely, leaving no half-applied
schema. Phase 3 covers the semantics in
[07 · Transactional DDL](../../phase-3-ddl/07-transactional-ddl.md).

The operational catch is that **locks are held until the transaction commits**.
Wrapping five `ALTER TABLE` statements in one transaction means the first table's
`ACCESS EXCLUSIVE` lock is held for the duration of all five. Migration tools
often wrap the whole migration in one transaction by default.

So the guidance splits:

- **Small, fast, related changes** → one transaction. Atomicity is worth more
  than lock duration when everything is catalog-only.
- **Anything involving a scan, a rewrite, or several large tables** → separate
  transactions, each with its own `lock_timeout`. Accept that a failure can leave
  you partly migrated, and make each step independently safe — which is what
  expand/contract in [chunk 02](02-expand-and-contract.md) is for.

Note also that `CREATE INDEX CONCURRENTLY` and `DROP INDEX CONCURRENTLY`
**cannot run inside a transaction block at all**, which forces the second style
whenever indexes are involved.

## Trade-off

The lock queue trades **fairness for predictability**. Letting new readers
overtake a waiting writer would keep the table available — and would let a busy
table starve DDL indefinitely, so schema changes could never complete under load.
PostgreSQL chose "the writer eventually gets in", and the cost is that a waiting
writer blocks the readers behind it.

You cannot change that, so the engineering is entirely about **not waiting**:
a short `lock_timeout` so failure is fast and retryable, no long transactions on
the tables you are about to alter, and statement forms that need the heavy lock
only for milliseconds. The price of that discipline is more migration steps and
more deploys — which is exactly what the next chunk is about.

## Gotchas

**Symptom:** A trivial migration took the site down
**Cause:** It queued behind a long-running query, and every subsequent query
queued behind *it*. The DDL's own duration was irrelevant.
**Fix:** `SET LOCAL lock_timeout = '3s'` and retry on `55P03`. Never run DDL
without it.

**Symptom:** The migration hangs forever
**Cause:** `lock_timeout` defaults to **0** — wait indefinitely.
**Fix:** Set it. In the moment, cancel the *blocker* (`pg_blocking_pids()` →
`pg_cancel_backend()`), not the migration.

**Symptom:** `statement_timeout` was set but the migration still hung
**Cause:** It does not reliably bound time spent *waiting for a lock*.
**Fix:** `lock_timeout` is the setting for that phase. Set both.

**Symptom:** Adding a column with a default was fast in staging, slow in prod
**Cause:** A **volatile** default (or identity/generated/constrained domain)
forces a rewrite; a constant default does not.
**Fix:** Add the column with a constant default or none, and backfill separately
— [chunk 02](02-expand-and-contract.md).

**Symptom:** One slow `ALTER` in a multi-statement migration blocked everything
**Cause:** DDL is transactional, so all locks are held until commit.
**Fix:** Split into separate transactions when any step scans or rewrites.

**Symptom:** `int` → `bigint` locked a large table for minutes
**Cause:** Not binary coercible — a full table and index rewrite.
**Fix:** Treat as a maintenance-window operation, or use the expand/contract
column-swap approach.

## Interview questions

**★ Why can a 5 ms migration cause a 30-second outage?**
Because `ALTER TABLE` requests `ACCESS EXCLUSIVE`, which conflicts with every
other lock mode. If a long query holds `ACCESS SHARE`, the DDL queues — and
PostgreSQL does not let subsequent queries jump that queue, so they pile up
behind the *waiting* DDL. The table is unavailable for as long as the original
blocker runs, before the migration has executed at all.

**★ What is the single most important setting when running migrations?**
`lock_timeout`, which defaults to 0 (wait forever). A short value plus retry on
`55P03` turns "the site is down until a human intervenes" into "the migration
failed, try again". `statement_timeout` is not a substitute because it does not
reliably bound lock waiting.

**★ Does adding a column with a default rewrite the table?**
Not since PostgreSQL 11, provided the default is **non-volatile** — the value is
stored in the table's metadata and applied only on a later rewrite, so the
statement is fast even on large tables. A volatile default, an identity column, a
stored generated column, or a constrained domain type does still force a rewrite.

**★ Which DDL operations avoid `ACCESS EXCLUSIVE`?**
`VALIDATE CONSTRAINT` and `SET STATISTICS` take `SHARE UPDATE EXCLUSIVE`;
`ADD FOREIGN KEY` is a documented exception requiring only
`SHARE ROW EXCLUSIVE`; and `CREATE INDEX CONCURRENTLY` / `DROP INDEX
CONCURRENTLY` avoid blocking reads and writes entirely. Those exceptions are what
the safe migration patterns are built from.

**Should a migration run in one transaction?**
For small catalog-only changes, yes — atomicity is worth it. For anything that
scans or rewrites, no: locks are held until commit, so one slow step extends
every earlier step's lock. And `CREATE INDEX CONCURRENTLY` cannot run in a
transaction block at all.

**A migration is stuck. What do you do?**
Find the root blocker with `pg_blocking_pids()` and cancel *that* backend, not
the migration — the queue formed behind the migration's lock request, so removing
the original blocker drains it. Then add `lock_timeout` so it cannot recur.

---

← [Phase index](../README.md) · Next → [Expand and contract](02-expand-and-contract.md)
