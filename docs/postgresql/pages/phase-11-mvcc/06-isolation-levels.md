---
title: "REPEATABLE READ and SERIALIZABLE"
sidebar_label: "06 · REPEATABLE READ SERIALIZABLE"
sidebar_position: 6
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 on **PostgreSQL 18.4** (`postgres:18-alpine`, `127.0.0.1:55432`),
> **Node 24.19.0**, `pg` 8.23.0. Script: `sandbox/pg-api/ex28-mvcc-isolation.mjs`.

**The two stronger levels do not prevent anomalies by waiting — they detect conflicts
and abort one transaction with `40001`. Choosing them means writing a retry loop.
Without one you have replaced silent wrong data with visible failures, which is
sometimes worse.**

## REPEATABLE READ: one snapshot for the whole transaction

```console
$ node ex28-mvcc-isolation.mjs
=== 6. REPEATABLE READ — same query, same answer, all transaction long ===
reader first look : [{"id":1,"v":100},{"id":2,"v":100}]
reader after both : [{"id":1,"v":100},{"id":2,"v":100}] <- no non-repeatable read, no phantom
reader after COMMIT: [{"id":1,"v":999},{"id":2,"v":100},{"id":3,"v":7}]
```

Another session updated row 1 and inserted row 3, and committed. The REPEATABLE READ
reader saw neither, for its whole lifetime. Compare
[READ COMMITTED](03-read-committed.md), where the same sequence changed under the
reader's feet.

The snapshot is taken at the transaction's **first statement**, not at `BEGIN`, and the
level must be set before that first query:

```console
SET ISOLATION after the first query → 25001 SET TRANSACTION ISOLATION LEVEL must be called before any query
```

```js
await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ');   // right
// not: BEGIN; SELECT …; SET TRANSACTION ISOLATION LEVEL …
```

**This is the correct level for multi-statement reports.** Several queries, one
consistent view, no retry loop needed as long as the transaction only reads — a
read-only REPEATABLE READ transaction cannot fail with `40001`.

Writers are a different story. If a REPEATABLE READ transaction tries to update a row
that changed since its snapshot, it is refused:

```console
(e) REPEATABLE READ, no retry          : qty = 1 | 1 committed, 19 rejected
    first failure → 40001 could not serialize access due to concurrent update
```

## What REPEATABLE READ still allows: write skew

Each transaction sees a consistent snapshot, and each write is individually legal —
but together they break an invariant that neither could see being broken:

```console
=== 7. write skew — REPEATABLE READ allows it, SERIALIZABLE does not ===
REPEATABLE READ both saw 2/2 on call -> both committed | still on call: 0
SERIALIZABLE    both saw 2/2 on call -> b: 40001 could not serialize access due to read/write dependencies among transactions | still on call: 1
```

Two people on call. Both check "is anyone else on call?", both see 2, both take
themselves off. Under REPEATABLE READ **both commit and nobody is on call** — the
invariant "at least one person on call" is violated without either transaction ever
seeing an inconsistent state. They wrote to *different rows*, so there is no update
conflict to detect.

SERIALIZABLE catches it: it tracks read/write dependencies, sees that the two
transactions' reads and writes cannot be ordered into any serial sequence, and aborts
one. One person remains on call.

Note the different error text — `could not serialize access due to read/write
dependencies among transactions` rather than `due to concurrent update`. Same SQLSTATE
`40001`, different cause: the first means "you read something someone else wrote", the
second means "you tried to write something someone else wrote".

## SERIALIZABLE: correct, and it costs

SERIALIZABLE guarantees the outcome equals *some* serial execution of the
transactions. Whatever invariant holds in single-threaded code holds under concurrency,
with no explicit locking. The price is measurable:

```console
=== 8. SERIALIZABLE with a retry loop — 20 concurrent transfers ===
SERIALIZABLE + retry (backoff 5ms x attempt): 135 attempts, 115 retries, 12419.9 ms
  balances: [{"id":1,"balance":1000},{"id":2,"balance":1000}] | total: 2000
READ COMMITTED + FOR UPDATE in id order    : 20 attempts, 0 retries, 71.2 ms
  balances: [{"id":1,"balance":1000},{"id":2,"balance":1000}] | total: 2000
```

Twenty transfers between two accounts. Both approaches are **correct** — the total is
2000 either way. But SERIALIZABLE needed **135 attempts for 20 transfers** and took
12.4 seconds, against 20 attempts and 71 ms for explicit row locks taken in a fixed
order.

Two rows, twenty writers is the pathological case for SERIALIZABLE: near-total conflict.
Part of the 12.4 s is my `5 ms × attempt` backoff rather than the database. The lesson
is not "SERIALIZABLE is slow" but **"SERIALIZABLE degrades sharply as conflict rate
rises, and explicit locking degrades gracefully."** On a workload where transactions
rarely touch the same rows, the retry rate is near zero and the overhead is small.

## The retry loop is not optional

```js
async function withSerializable(pool, fn, maxTries = 5) {
  for (let attempt = 1; ; attempt++) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN ISOLATION LEVEL SERIALIZABLE');
      const out = await fn(client);
      await client.query('COMMIT');
      return out;
    } catch (e) {
      await client.query('ROLLBACK').catch(() => {});
      if ((e.code !== '40001' && e.code !== '40P01') || attempt === maxTries) throw e;
    } finally {
      client.release();          // released BEFORE the backoff — see below
    }
    await sleep(5 * attempt * (0.5 + Math.random()));   // backoff with jitter, holding nothing
  }
}
```

Requirements this loop encodes:

- **Retry `40001` and `40P01`** (serialization failure and [deadlock](11-deadlocks.md)) —
  both mean "try again", nothing else does.
- **The whole transaction re-runs**, including the reads. Retrying only the failed
  statement is wrong; the snapshot is gone.
- **Bound the attempts.** An unbounded loop under sustained contention is a livelock.
- **Jitter the backoff**, or the same set of transactions collides again in lockstep.
- **Sleep *outside* the `try`/`finally`.** This one is easy to get wrong and expensive.
- **`fn` must be side-effect free** outside the database. It will run more than once —
  no emails, no charges, no queue publishes inside it.

### Why the sleep must be outside the `finally`

The natural place to put the backoff is next to the error test, inside the `catch`. Do not:
`finally { client.release(); }` cannot run until the `catch` block finishes, so **every
sleeping retry pins a pooled connection while doing no work at all.**

That turns a retry storm into a connection shortage. The sleeping transaction is doing
nothing the database can see — it has already rolled back — but it still counts against
`max`, so a caller that was ready to *do* work blocks in `pool.connect()` behind a queue of
deliberately idle clients.

**The measurement above is not affected by this**, and it is worth being precise about why
rather than assuming: `ex28-mvcc-isolation.mjs` opens its pool with `max: 25` against 20
concurrent transfers, so every sleeper has a connection of its own and none of the 12.4 s is
time spent queueing for one.

Resist the temptation to predict what happens when the pool *is* smaller than the
concurrency. It is not a clean "and therefore it is slower" story: capping the pool also
caps how many transactions can conflict at once, which lowers the retry rate, and on a
near-total-conflict workload like this one that effect is large enough to move the total in
either direction. Fix this pattern because holding a pooled connection while deliberately
idle is wrong on its face — not because a benchmark of this shape will show it to you.

The cost that *is* certain is the one that does not appear in a benchmark of this shape:
every other caller of the same pool — the HTTP request that needs one query, the health
check — waits behind the sleepers.

The rule generalises past retries: **never `await` anything slow between acquiring a pooled
resource and releasing it.** A sleep, an HTTP call, a `fs` read, an unbounded queue publish
— if it is in the middle of a checked-out connection, the pool size is the real concurrency
limit and the delay is multiplied by every waiter behind it.

## Choosing a level

| Need | Level |
|---|---|
| Ordinary single-statement writes and reads | READ COMMITTED (default) |
| A multi-statement report that must be internally consistent | REPEATABLE READ, read-only |
| Read-then-write on the **same rows** | READ COMMITTED + [`FOR UPDATE`](07-row-locks.md) |
| An invariant spanning **different rows** (write skew) | SERIALIZABLE + retry |

**Try explicit locking before reaching for SERIALIZABLE.** It was 175× faster here and
needs no retry loop. SERIALIZABLE earns its place when the invariant cannot be
attached to a specific row you could lock — which is exactly what write skew is.

## Trade-off

**Stronger isolation converts silent corruption into errors you must handle.** That is
a good trade only if you handle them. REPEATABLE READ costs nothing for read-only work
and gives perfect report consistency. SERIALIZABLE gives you single-threaded reasoning
about invariants, paid for in retries that scale with the conflict rate — measured
115 retries for 20 transactions on two hot rows, against zero for ordered row locks.

## Gotchas

**Symptom:** `40001 could not serialize access due to concurrent update`
**Cause:** A REPEATABLE READ or SERIALIZABLE transaction wrote a row that changed after its snapshot
**Fix:** Retry the whole transaction with backoff; this is the level working correctly

**Symptom:** `25001 SET TRANSACTION ISOLATION LEVEL must be called before any query`
**Cause:** The level was set after the transaction's first statement
**Fix:** `BEGIN ISOLATION LEVEL REPEATABLE READ`

**Symptom:** SERIALIZABLE transactions retry constantly and throughput collapses
**Cause:** High conflict rate — many transactions touching the same few rows
**Fix:** Use `FOR UPDATE` in a fixed order instead (measured 12.4 s → 71 ms)

**Symptom:** Retrying sends duplicate emails or charges
**Cause:** Side effects inside a retried transaction body
**Fix:** Move them after commit; keep the retried function purely database work

**Symptom:** A REPEATABLE READ transaction cannot see a row that definitely exists
**Cause:** It was inserted after the snapshot was taken at the first statement
**Fix:** Correct behaviour — commit and start a new transaction to see current data

**Symptom:** Two transactions each break an invariant while both look consistent
**Cause:** Write skew — they wrote different rows, so there is no update conflict to detect
**Fix:** SERIALIZABLE, or materialise the invariant into one lockable row

## Interview questions

**★ What does REPEATABLE READ guarantee that READ COMMITTED does not?**
One snapshot for the whole transaction, so no non-repeatable reads and no phantoms.
Measured: a concurrent `UPDATE` and `INSERT` were both invisible to the reader until it
committed.

**★ What is write skew, and which level stops it?**
Two transactions read an overlapping set, then write to *different* rows, together
breaking an invariant neither could see break. Measured: both on-call staff went off
call under REPEATABLE READ; SERIALIZABLE aborted one with `40001` and left one on call.

**★ Why are there two different `40001` messages?**
`due to concurrent update` means you wrote a row someone else wrote after your
snapshot. `due to read/write dependencies among transactions` means SERIALIZABLE found
a dependency cycle involving what you *read*. Same SQLSTATE, different detection.

**★ What must a SERIALIZABLE retry loop do?**
Re-run the entire transaction, retry only on `40001`/`40P01`, bound the attempts, back
off with jitter, and contain no external side effects — the body will run more than
once.

**★ SERIALIZABLE or `SELECT … FOR UPDATE`?**
Locking when the invariant lives in identifiable rows — measured 71 ms against
12.4 s for the same 20 transfers. SERIALIZABLE when it does not, which is the write-skew
case.

**Does a read-only REPEATABLE READ transaction need a retry loop?**
No. It cannot get a serialization failure, so it is a free way to make a
multi-statement report consistent.

**When is the snapshot taken?**
At the first statement, not at `BEGIN`. An idle `BEGIN` holds no snapshot yet — which is
also why it does not block [VACUUM](12-long-transactions.md).

---

← [MVCC snapshots](05-mvcc.md) · Next → [Row locks FOR UPDATE](07-row-locks.md)
