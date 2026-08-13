---
title: "Long-running transactions and the xmin horizon"
sidebar_label: "12 · Long-running transactions"
sidebar_position: 12
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 on **PostgreSQL 18.4** (`postgres:18-alpine`, `127.0.0.1:55432`),
> **Node 24.19.0**, `pg` 8.23.0. Script: `sandbox/pg-api/ex30-vacuum-horizon.mjs`.

**VACUUM may only remove a row version no running transaction could still need. One old
transaction anywhere in the database therefore pins the cleanup point for every table —
and dead rows accumulate until it ends. But not every open transaction does this, and
which ones do is not what most people assume.**

## Measured: which transactions actually block VACUUM

100 000 rows, updated once (100 000 dead versions), then `VACUUM (VERBOSE)`, with a
different kind of transaction open each time:

```console
$ node ex30-vacuum-horizon.mjs
=== 1. not every open transaction blocks VACUUM — measured per kind ===
no other transaction open                      removed 100000, not yet removable      0 | cutoff xid 58831 | 27 MB -> 27 MB -> 27 MB (reused)
idle in transaction, READ COMMITTED, read-only removed 100000, not yet removable      0 | cutoff xid 58837 | 27 MB -> 27 MB -> 27 MB (reused)
idle in transaction, REPEATABLE READ           removed      0, not yet removable 100000 | cutoff xid 58842 | 27 MB -> 27 MB -> 40 MB (file GREW)
idle in transaction that WROTE (holds an xid)  removed      0, not yet removable 100000 | cutoff xid 58848 | 27 MB -> 27 MB -> 40 MB (file GREW)
a long-running SELECT still executing          removed      0, not yet removable 100000 | cutoff xid 58855 | 27 MB -> 27 MB -> 40 MB (file GREW)
```

**An idle READ COMMITTED transaction that has only read does not block VACUUM.** All
100 000 dead rows were removed and the next update reused the space. This contradicts
the common advice that any `idle in transaction` session stalls cleanup.

The reason is [where snapshots come from](03-read-committed.md): under READ COMMITTED a
snapshot lasts one statement. Between statements the session holds none, so there is
nothing to pin. `pg_stat_activity` shows it directly:

```console
=== 3. finding the transactions that matter ===
[{"pid":1275,"state":"idle in transaction","xact_age_s":"1.2","idle_s":"1.2","xid":"59131","xmin":null},
 {"pid":1277,"state":"idle in transaction","xact_age_s":"1.2","idle_s":"1.2","xid":null,"xmin":null}]
  NOTE: both show backend_xmin = null. An idle READ COMMITTED transaction holds
  no snapshot between statements. The one that WROTE still pins the horizon via
  its backend_xid, which is why section 1 shows it blocking VACUUM.
```

The three kinds that **do** block, each for a different reason:

| Kind | What pins the horizon |
|---|---|
| **REPEATABLE READ / SERIALIZABLE, even idle** | its snapshot lives for the whole transaction |
| **Any transaction that wrote** | its `backend_xid` is still in progress, so nothing after it can be cleaned |
| **Any statement still executing** | it holds an active snapshot right now |

The last is the one people forget: **a long-running `SELECT` blocks VACUUM exactly as
hard as a long-running write.** A 40-minute analytics query is a 40-minute cleanup
stall.

## What it costs

Look at the size column: `27 MB -> 27 MB -> 40 MB (file GREW)`. With the blocker
present, VACUUM freed nothing, so the next round of updates had to extend the file —
**a 48% size increase from one blocked cleanup cycle.** Repeat that all day and you get
the classic "the table is 10× its data" report.

The damage is not limited to the table you are working on: **the horizon is
database-wide.** One open transaction in an unrelated part of the application stops dead
rows being removed everywhere, including from your hottest table. Add the second-order
effects — indexes bloat too, plans get worse as tables grow, and the query that was
already slow gets slower — and a single forgotten transaction degrades the whole system.

## Finding them

```sql
-- transactions by age, worst first
SELECT pid, state,
       now() - xact_start  AS xact_age,
       now() - state_change AS in_this_state,
       backend_xid, backend_xmin,
       left(query, 60) AS query
FROM pg_stat_activity
WHERE datname = current_database() AND xact_start IS NOT NULL
ORDER BY xact_start;
```

Read it in this order:

- **`xact_age`** — how long the transaction has been open. This is the number that
  matters, not how long the current query has run.
- **`backend_xmin`** — non-null means it is pinning the horizon *right now*.
- **`backend_xid`** — non-null means it wrote, so it pins regardless of `backend_xmin`.
- **`state`** — `idle in transaction` means the application is holding it open while
  doing something else; `active` means the database is genuinely busy.

Everything else that holds the horizon lives outside `pg_stat_activity`: replication
slots (`pg_replication_slots.xmin`), a standby with `hot_standby_feedback = on`, and
prepared (two-phase) transactions in `pg_prepared_xacts`. An "impossible" bloat problem
with no long transaction visible is almost always one of those three — most often an
inactive replication slot nobody removed.

## Preventing them

```js
// the transaction covers exactly the database work, and nothing else
const priced = await callPricingApi(order);        // slow, outside
const shipping = computeShipping(order);           // outside

await withTransaction(pool, async (c) => {         // opens here
  await c.query(`UPDATE orders SET total = $1 WHERE id = $2`, [priced.total, order.id]);
  await c.query(`INSERT INTO order_events (order_id, kind) VALUES ($1, 'priced')`, [order.id]);
});                                                // closes here

await sendConfirmationEmail(order);                // after commit
```

The rule: **no network call, no user interaction, and no unbounded loop inside a
transaction.** An HTTP call with a 30-second timeout inside a transaction is a
30-second horizon stall whenever the remote service is slow.

Server-side backstops, which belong in every deployment:

```sql
ALTER SYSTEM SET idle_in_transaction_session_timeout = '60s';  -- kill forgotten transactions
ALTER SYSTEM SET statement_timeout = '30s';                    -- kill runaway statements
ALTER SYSTEM SET log_min_duration_statement = '1s';            -- see them coming
SELECT pg_reload_conf();
```

`idle_in_transaction_session_timeout` is the single highest-value setting here — see
[Idle in transaction](14-idle-in-transaction.md) for exactly what it does to the
connection. Give long-running analytics its own role with a much larger
`statement_timeout` rather than raising it globally.

## Trade-off

**Bounding transaction age trades occasional killed queries for predictable cleanup.**
A 60-second `idle_in_transaction_session_timeout` will eventually terminate something
that was legitimately slow, and the application must handle that connection dying. The
alternative is unbounded: one forgotten transaction growing every table in the database
for as long as it lives. Long analytics queries are a genuine conflict — they must hold
a snapshot to be consistent — and the honest resolutions are a read replica or accepting
the bloat during the window.

## Gotchas

**Symptom:** Tables grow while row counts stay flat, VACUUM appears to do nothing
**Cause:** An old transaction is pinning the horizon; VACUUM runs but removes nothing
**Fix:** Find it in `pg_stat_activity` by `xact_start`, then end it

**Symptom:** Bloat with no long transaction anywhere in `pg_stat_activity`
**Cause:** A replication slot, a standby with `hot_standby_feedback`, or a prepared transaction
**Fix:** Check `pg_replication_slots.xmin` and `pg_prepared_xacts`; drop inactive slots

**Symptom:** `idle in transaction` sessions everywhere
**Cause:** Transactions opened around application logic, or a `BEGIN` with no matching commit
**Fix:** Open the transaction as late as possible; set `idle_in_transaction_session_timeout`

**Symptom:** A read-only reporting query is blamed and dismissed as harmless
**Cause:** A running `SELECT` holds an active snapshot and blocks cleanup exactly like a write — measured
**Fix:** Run reporting on a replica, or bound it with `statement_timeout`

**Symptom:** Bloat grows only during the nightly batch window
**Cause:** One long batch transaction spanning the whole job
**Fix:** Chunk the batch into many short transactions

## Interview questions

**★ Why does one long transaction bloat every table?**
VACUUM may only remove versions no running transaction could need, so the oldest
snapshot in the database sets a cleanup cutoff for all tables. Measured: with a blocker
open, 0 of 100 000 dead rows were removed and the file grew from 27 MB to 40 MB.

**★ Does an idle READ COMMITTED transaction block VACUUM?**
Not if it has only read. It holds no snapshot between statements — measured, all 100 000
dead rows were still removed. It does block if it wrote, because its `backend_xid` is
still in progress.

**★ Does a long `SELECT` block VACUUM?**
Yes, as completely as a write. Measured: 0 removed, 100 000 not yet removable, file grew.
A running statement holds an active snapshot.

**★ How do you find the transaction responsible?**
`pg_stat_activity` ordered by `xact_start`, looking at `xact_age`, `backend_xmin` and
`backend_xid` — not at how long the current query has run.

**★ Bloat is growing but no long transaction exists. What else?**
A replication slot's `xmin`, a standby with `hot_standby_feedback = on`, or an orphaned
prepared transaction in `pg_prepared_xacts`.

**Why should HTTP calls never happen inside a transaction?**
The transaction lives for the duration of the call, holding a connection, any row locks,
and the xmin horizon. A slow upstream becomes a database-wide cleanup stall.

**What is the highest-value setting for this problem?**
`idle_in_transaction_session_timeout`. It bounds the failure mode you cannot fix from the
database side — an application that opened a transaction and wandered off.

---

← [Deadlocks](11-deadlocks.md) · Next → [VACUUM and bloat](13-vacuum.md)
