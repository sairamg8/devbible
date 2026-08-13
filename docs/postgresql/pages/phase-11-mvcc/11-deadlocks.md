---
title: "Deadlocks"
sidebar_label: "11 · Deadlocks"
sidebar_position: 11
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 on **PostgreSQL 18.4** (`postgres:18-alpine`, `127.0.0.1:55432`),
> **Node 24.19.0**, `pg` 8.23.0. Script: `sandbox/pg-api/ex29-locks.mjs`.

**Two transactions each holding what the other needs. PostgreSQL detects the cycle after
one second, kills one of them with `40P01`, and lets the other finish. The fix is not
retry logic — it is locking rows in a consistent order.**

## The cycle, and the fix, measured

```console
$ node ex29-locks.mjs
=== 8. deadlock — opposite lock order, and the fix ===
deadlock_timeout: 1s
opposite order (A:1->2, B:2->1) after 1155.0 ms : ["A: 40P01 deadlock detected","B: committed"]
same order     (A:1->2, B:1->2) after 326.2 ms : ["B: committed","A: committed"]
final: [{"id":1,"v":3},{"id":2,"v":3}]
```

Same two transactions, same two rows, same updates. The only difference is the order the
rows are touched:

- **Opposite order** — A locks row 1 then wants row 2; B locks row 2 then wants row 1.
  Neither can proceed. After 1155 ms PostgreSQL aborted A with `40P01` and B committed.
- **Same order** — both take row 1 first, so one simply waits for the other. Both
  committed, in 326 ms, with no error at all.

**Ordering is the fix.** Retry is the seatbelt.

Note the cost of the detection: 1155 ms, essentially all of it the `deadlock_timeout`.
PostgreSQL does not check for cycles on every lock wait (that would be expensive) — it
waits one second, and only then looks for a cycle. **Every deadlock therefore costs at
least a second** of two blocked transactions, on top of the retry.

## Reading the error

```console
  the full error object:
    code  : 40P01
    msg   : deadlock detected
    detail: Process 1319 waits for ShareLock on transaction 60604; blocked by process 1321.
    detail: Process 1321 waits for ShareLock on transaction 60603; blocked by process 1319.
    hint  : See server log for query details.
```

The `DETAIL` names both sides of the cycle. The queries themselves are only in the server
log, so turn that on before you need it:

```sql
ALTER SYSTEM SET log_lock_waits = on;      -- logs waits past deadlock_timeout
ALTER SYSTEM SET deadlock_timeout = '1s';  -- the default; also the log threshold
SELECT pg_reload_conf();
```

`log_lock_waits` is the setting that earns its keep: it records long lock waits
*before* they become deadlocks, so you see the contention building.

## Locking in a consistent order

The rule is mechanical: **every code path that locks multiple rows locks them in the
same order, by a stable key.**

```js
// WRONG — the order depends on which way the money moves
await c.query(`UPDATE accounts SET balance = balance - $1 WHERE id = $2`, [amt, from]);
await c.query(`UPDATE accounts SET balance = balance + $1 WHERE id = $2`, [amt, to]);

// RIGHT — lock both rows in id order first, then update in any order
const [lo, hi] = from < to ? [from, to] : [to, from];
await c.query(`SELECT id FROM accounts WHERE id IN ($1,$2) ORDER BY id FOR UPDATE`, [lo, hi]);
await c.query(`UPDATE accounts SET balance = balance - $1 WHERE id = $2`, [amt, from]);
await c.query(`UPDATE accounts SET balance = balance + $1 WHERE id = $2`, [amt, to]);
```

The `SELECT … ORDER BY id FOR UPDATE` acquires every lock the transaction needs, in a
deterministic order, in one statement. [Measured on the same workload](06-isolation-levels.md),
this handled 20 concurrent transfers in 71 ms with zero retries — where SERIALIZABLE
needed 115 retries and 12.4 s.

Bulk statements need the same treatment, and here the mistake is tempting: sorting the
array you pass in does **nothing**.

```js
// WRONG — the sort never reaches the executor
ids.sort((a, b) => a - b);
await c.query(`UPDATE items SET n = n + 1 WHERE id = ANY($1::int[])`, [ids]);
```

A multi-row `UPDATE` locks rows in the order the *plan* produces them — heap order under a
seq or bitmap scan — and the order of values inside an array literal is not an ordering the
planner sees. Two concurrent bulk updates over overlapping id sets deadlock exactly as
before the `sort()`.

The only construct that imposes an order is `ORDER BY` in a locking `SELECT`:

```js
// RIGHT — the locking SELECT fixes the order, then the UPDATE finds every row already locked
await c.query(`
  SELECT id FROM items WHERE id = ANY($1::int[]) ORDER BY id FOR UPDATE
`, [ids]);
await c.query(`UPDATE items SET n = n + 1 WHERE id = ANY($1::int[])`, [ids]);
```

Lock order comes from `ORDER BY` in a locking `SELECT`, never from the order of the values
you send.

## The other common source: foreign keys and indexes

Not every deadlock comes from two rows in one table:

- **Foreign keys.** Inserting a child takes `FOR KEY SHARE` on the parent
  ([measured](07-row-locks.md)). Two transactions inserting children of each other's
  parents, in opposite order, deadlock exactly like the two-row case.
- **`ON CONFLICT` upserts.** Two sessions upserting the same set of keys in different
  orders deadlock on the unique index. Sort the batch by conflict key.
- **DDL against DML.** A migration wanting `ACCESS EXCLUSIVE` while a transaction holds
  a row lock and then requests something the migration holds.

## The retry loop

Ordering prevents the ones you control; retry covers the rest.

```js
async function withDeadlockRetry(pool, fn, tries = 3) {
  for (let i = 1; ; i++) {
    try { return await withTransaction(pool, fn); }
    catch (e) {
      if ((e.code !== '40P01' && e.code !== '40001') || i === tries) throw e;
      await sleep(50 * i * (0.5 + Math.random()));
    }
  }
}
```

A deadlock victim's transaction is **fully rolled back**, so retrying is always safe from
the database's point of view — provided the function has no external side effects, since
it will run again.

## Trade-off

**Consistent lock ordering costs a design constraint and a little code; deadlocks cost a
second of blocked work each plus a retry.** Occasionally the ordering is genuinely
awkward — a workload that legitimately touches rows in data-dependent order — and then
retry is the honest answer. What is not acceptable is treating a steady rate of `40P01`
as normal: each one means two transactions blocked for `deadlock_timeout` before either
made progress.

## Gotchas

**Symptom:** `40P01 deadlock detected` under load
**Cause:** Two transactions taking the same locks in opposite orders
**Fix:** Lock in a fixed order (`ORDER BY id FOR UPDATE`) — measured: identical work, zero deadlocks

**Symptom:** Deadlocks in single-statement bulk updates
**Cause:** Row order within the statement is plan-dependent
**Fix:** Sort the id array before sending it, or lock via an ordered subquery

**Symptom:** `40P01` with no explicit locking anywhere in the code
**Cause:** Foreign keys (`FOR KEY SHARE` on parents) or unique-index conflicts in upserts
**Fix:** Sort batches by conflict key; insert parents in a consistent order

**Symptom:** The error names processes but not queries
**Cause:** Query text goes to the server log, not the client
**Fix:** `log_lock_waits = on`, then read the log around the deadlock

**Symptom:** Retry loop turns deadlocks into duplicate side effects
**Cause:** Emails or payments inside the retried transaction body
**Fix:** Only database work inside; side effects after commit

**Symptom:** Latency spikes of exactly ~1 second
**Cause:** `deadlock_timeout` — every deadlock costs that before detection
**Fix:** Fix the ordering; lowering the timeout raises CPU spent checking for cycles

## Interview questions

**★ What is a deadlock and how does PostgreSQL handle it?**
Two transactions each holding a lock the other needs. After `deadlock_timeout` (default
1s) the detector finds the cycle and aborts one with `40P01`; the other proceeds.
Measured at 1155 ms.

**★ What is the actual fix?**
Consistent lock ordering. Measured: A:1→2 with B:2→1 deadlocked; A:1→2 with B:1→2 both
committed in 326 ms with no error.

**★ Why does detection take a second?**
Checking for a cycle on every lock wait would be expensive, so PostgreSQL waits
`deadlock_timeout` first and only then looks. That second is paid by both transactions.

**★ Can a single statement deadlock?**
Yes. A multi-row `UPDATE` locks rows in plan order, so two concurrent bulk updates over
the same rows can deadlock. Sort the input ids.

**★ Is retrying a deadlock safe?**
From the database's side, yes — the victim is fully rolled back. It is only unsafe if
the retried code has external side effects.

**Which is the victim?**
The one PostgreSQL judges cheapest to abort; you cannot rely on it being either
particular transaction. Both sides need the retry loop.

**How do deadlocks arise without explicit `FOR UPDATE`?**
Foreign key checks take row locks on parents, and `ON CONFLICT` takes index locks.
Ordinary inserts are enough to deadlock if two sessions do them in opposite orders.

---

← [Table locks and DDL](10-table-locks-ddl.md) · Next → [Long-running transactions](12-long-transactions.md)
