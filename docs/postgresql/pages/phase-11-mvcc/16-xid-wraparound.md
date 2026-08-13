---
title: "XID wraparound and freezing"
sidebar_label: "16 · XID wraparound"
sidebar_position: 16
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08 on **PostgreSQL 18.4** (`postgres:18-alpine`, `127.0.0.1:55432`),
> **Node 24.19.0**, `pg` 8.23.0. Script: `sandbox/pg-api/ex30-vacuum-horizon.mjs`.

**Transaction ids are 32 bits and visibility is decided by comparing them, so the counter
cannot simply wrap — old rows would appear to be from the future and vanish. VACUUM
prevents this by *freezing* old rows. You will almost certainly never hit wraparound;
you should recognise the warning signs, because by the time it forces a shutdown the
options are bad.**

## The mechanism

Each row version carries the `xmin` that created it. Visibility asks "did that
transaction commit before my snapshot?", which is a comparison in a 32-bit space that
holds 2³¹ ids "in the past" and 2³¹ "in the future". If the counter advanced far enough
past a row's `xmin`, that row would flip from ancient to future-dated and become
invisible — silent data loss.

**Freezing** is the escape. VACUUM marks sufficiently old rows as *frozen*, meaning
"visible to everyone, do not compare". A frozen row is immune to wraparound, and the
table's `relfrozenxid` records how far freezing has progressed.

```console
$ node ex30-vacuum-horizon.mjs
=== 7. XID age, freezing, and how far from wraparound this database is ===
new table         : {"a":1,"f":"59134"}
after burning 5 xids: {"a":6,"f":"59134"}
after VACUUM FREEZE: {"a":1,"f":"59140"} <- relfrozenxid moved up to now
```

`age(relfrozenxid)` is how many transactions have passed since this table was last
frozen — it grows with every transaction *in the database*, whether or not the table is
touched. `VACUUM FREEZE` reset it to 1. **That number, not the table's own write rate, is
what you monitor.**

## How much headroom there really is

```console
per database: [{"datname":"postgres","age":58388,...},{"datname":"devbible","age":58388,...}]
worst age 58388 of a 2^31 (2147483648) budget = 0.002719%
anti-wraparound autovacuum triggers at autovacuum_freeze_max_age = 200000000 (0.03% of the way there)
200 autocommitted UPDATEs burned 201 xids in 1.36 s (1.00 per statement, 147 xids/s)
  at that measured rate a 2^31 budget lasts 169 days of nonstop single-row writes
200 SELECTs burned 0 xids beyond the two probes
```

Three things worth carrying:

- **One xid per write statement.** 200 autocommitted `UPDATE`s burned 201 ids. Batching
  100 writes into one transaction costs one id instead of 100 — the same batching that
  helps [durability](01-acid.md) also slows xid consumption 100-fold.
- **Read-only statements burn nothing.** 200 `SELECT`s consumed zero. A read-heavy
  application is essentially immune.
- **The budget is large but not infinite.** At this sandbox's modest 147 xids/s, 2³¹ ids
  is about 169 days of continuous writing. A busy production server writing 10 000
  transactions/s would exhaust it in **under three days** — which is exactly why
  autovacuum freezes continuously rather than waiting.

The defence triggers long before the cliff: **anti-wraparound autovacuum starts at
`autovacuum_freeze_max_age` = 200 million**, less than 10% of the budget. It will vacuum
a table even if the table is idle and even if `autovacuum` is switched off.

Note also that [savepoints consume ids](09-savepoints.md): each writing subtransaction
takes one, so a savepoint-per-row loop multiplies consumption.

## Monitoring

```sql
-- per database
SELECT datname, age(datfrozenxid) AS xid_age,
       round(100.0 * age(datfrozenxid) / 2147483648, 2) AS pct_of_budget
FROM pg_database ORDER BY xid_age DESC;

-- per table: the ones that are falling behind
SELECT c.relname, age(c.relfrozenxid) AS xid_age
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE c.relkind IN ('r','m','t') AND n.nspname NOT LIKE 'pg\_%'
ORDER BY age(c.relfrozenxid) DESC LIMIT 10;
```

```console
oldest relfrozenxid     : [{"relname":"phase1_demo","xid_age":58580},{"relname":"measure_orders","xid_age":58568}]
```

Read the number against these thresholds:

| `age()` | Meaning |
|---|---|
| under 200 million | normal |
| **200 million** | anti-wraparound autovacuum kicks in (`autovacuum_freeze_max_age`) |
| ~2.134 billion | `WARNING: database "x" must be vacuumed within N transactions` |
| ~2.144 billion | **the database refuses new write transactions until vacuumed** |

Those last two numbers are not round, and the gap between them is the thing to understand.
PostgreSQL derives both from the wrap limit rather than from human-friendly milestones —
in `varsup.c`:

- `xidWrapLimit` = the point half the id space away, ≈ 2^31 ≈ **2,147,483,648**
- `xidStopLimit` = `xidWrapLimit − 3,000,000` ≈ **2.144 billion** — writes refused
- `xidWarnLimit` = `xidStopLimit − 10,000,000` ≈ **2.134 billion** — the `WARNING` starts

So the warning does not appear at a billion, and it is not the halfway mark: it fires about
**10 million XIDs before the shutdown**, out of a 2.1-billion budget. That is 0.5% of the
runway, at the very end of it.

**Do not build alerting on the WARNING.** It reads like an early-warning signal and is the
opposite. Ten million XIDs is one id per write statement, so on a system doing a few
thousand writes a second it is **minutes** — not enough time to diagnose a pinned `xmin`
horizon, let alone vacuum a large table. By the time the warning is in your log the
situation is already unrecoverable without downtime.

**Alert at 500 million instead**, and treat `autovacuum_freeze_max_age` (default
**200 million**) as the number that matters. Crossing it means an anti-wraparound
autovacuum is now running whether or not autovacuum is otherwise enabled and whether or not
the table looks busy — that worker is the system telling you it has started cleaning up
after something. An age that keeps climbing *past* 200 million means the anti-wraparound
vacuum exists but cannot advance the cutoff, which is a blocked horizon, not a throughput
problem. At 500 million you still have hundreds of millions of ids to find the blocker in.
The 2.13-billion warning is the "you already lost" line.

## When it does go wrong

The cause is almost never write volume — it is something *blocking* freezing, and the
list is the same one as for [long-running transactions](12-long-transactions.md):

- A very old open transaction or prepared transaction.
- An inactive **replication slot** holding `xmin` — the most common real-world cause.
- Autovacuum switched off, or starved by cost limits and never finishing on a huge table.
- A standby with `hot_standby_feedback = on` sitting on an old snapshot.

If the age is climbing, find the blocker first; vacuuming harder cannot advance the
cutoff past a pinned horizon.

```sql
-- the emergency lever, once the blocker is gone
VACUUM (FREEZE, VERBOSE) large_table;
```

If the database has already shut down to protect itself, it must be started in
single-user mode and vacuumed there. That is a real outage of hours on a large database —
which is the entire reason to monitor the number rather than react to it.

## Trade-off

**Freezing is I/O you pay continuously to avoid an outage you would otherwise pay once,
catastrophically.** Aggressive settings mean autovacuum rereads old, cold data to freeze
it — wasted work if that data will be deleted soon. Lax settings mean the work piles up
until an anti-wraparound vacuum runs at the worst moment on the largest table. PostgreSQL
18's eager freezing (`vacuum_max_eager_freeze_failure_rate`) exists to spread this out
rather than leave it all to the emergency path. The defaults are reasonable; the thing to
change is not the settings but the monitoring.

## Gotchas

**Symptom:** `WARNING: database must be vacuumed within N transactions`
**Cause:** `age(datfrozenxid)` approaching the limit; freezing has not kept up
**Fix:** Find what pins the horizon (long transaction, replication slot), then `VACUUM FREEZE`

**Symptom:** Aggressive autovacuum runs on a table nobody writes to
**Cause:** Anti-wraparound vacuum at `autovacuum_freeze_max_age` — age grows with database-wide activity
**Fix:** Expected behaviour; do not disable it

**Symptom:** Age keeps climbing despite constant vacuuming
**Cause:** A pinned xmin horizon — most often an inactive replication slot
**Fix:** `SELECT slot_name, active, xmin FROM pg_replication_slots;` and drop unused slots

**Symptom:** The database stops accepting writes
**Cause:** Wraparound protection engaged at ~2.1 billion
**Fix:** Single-user mode vacuum — hours of downtime; this is what monitoring prevents

**Symptom:** XIDs consumed far faster than the transaction count
**Cause:** One id per write statement in autocommit, plus one per writing savepoint
**Fix:** Batch writes into transactions (measured: 201 ids for 200 autocommitted updates)

**Symptom:** `autovacuum = off` was set for performance and age is now climbing
**Cause:** Anti-wraparound still runs, but nothing else does — bloat and freeze debt accumulate
**Fix:** Never disable autovacuum globally; tune per table instead

## Interview questions

**★ What is XID wraparound?**
Transaction ids are 32-bit and visibility is a modular comparison, so if the counter
advanced 2³¹ past a row's `xmin` that row would appear future-dated and become invisible.
VACUUM prevents it by freezing old rows.

**★ What does freezing do?**
Marks a row as visible to all transactions regardless of id comparison, making it immune
to wraparound. `relfrozenxid` tracks progress; `age(relfrozenxid)` is what you monitor.
Measured: `VACUUM FREEZE` reset an age of 6 back to 1.

**★ When does PostgreSQL take emergency action?**
Anti-wraparound autovacuum at `autovacuum_freeze_max_age` (default 200 million, under 10%
of the budget) — that is the threshold to alert on. The `WARNING` comes far later, at
`xidStopLimit − 10 million` ≈ 2.134 billion, only about 10 million ids before writes are
refused at ≈ 2.144 billion. Both are derived from the 2^31 wrap limit, not from round
numbers, and the warning is too late to act on.

**★ How fast are XIDs actually consumed?**
One per write statement in autocommit — measured 201 for 200 `UPDATE`s — and zero for
read-only statements. Batching 100 writes into one transaction costs one id instead of
100.

**★ Age is rising and vacuum is running constantly. What is wrong?**
Something is pinning the xmin horizon so the cutoff cannot advance: an old transaction, a
prepared transaction, an inactive replication slot, or standby feedback. Vacuuming harder
does not help until it is cleared.

**Is wraparound something a normal application hits?**
No. It takes a blocked horizon plus sustained write volume plus nobody watching. This
sandbox measured 0.0027% of the budget used. Alert at 500 million and it stays
theoretical.

**Why does an idle table need an anti-wraparound vacuum?**
`age(relfrozenxid)` counts transactions across the whole database, not writes to that
table. A table nobody touches still ages.

---

← [Advisory locks](15-advisory-locks.md) · [Phase index](README.md)
