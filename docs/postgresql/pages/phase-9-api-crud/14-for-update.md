---
title: "SELECT ... FOR UPDATE inside a request"
sidebar_label: "14 · SELECT FOR UPDATE"
sidebar_position: 14
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 on **PostgreSQL 18.4** (`postgres:18-alpine`, `127.0.0.1:55432`),
> **Node 24.19.0**, `pg` 8.23.0. Script: `sandbox/pg-api/ex40-api-concurrency.mjs`.

**`FOR UPDATE` takes the lock at read time so the row cannot change before you
write it.** It is the pessimistic answer to the same problem
[optimistic concurrency](13-optimistic.md) solves — no retries, no lost work, and
a queue instead.

## The handler

```js
const client = await pool.connect();
try {
  await client.query('BEGIN');
  const {rows} = await client.query(
    `SELECT balance FROM c_accounts WHERE id = 1 FOR UPDATE`);
  await client.query(`UPDATE c_accounts SET balance = $1 WHERE id = 1`,
    [rows[0].balance + add]);
  await client.query('COMMIT');
} catch (e) {
  await client.query('ROLLBACK');
} finally {
  client.release();
}
```

```console
$ node ex40-api-concurrency.mjs
=== 5. SELECT ... FOR UPDATE serialises the two requests ===
both requests returned: [ 'ok', 'ok' ]
balance: 130 ← no retry needed, and nothing was lost
```

130, which is correct, and both requests succeeded on their first attempt. The
second `SELECT` blocked until the first transaction committed, then read the
updated balance.

**`FOR UPDATE` is meaningless outside a transaction.** The lock is held until
commit or rollback, so without an explicit `BEGIN` the statement autocommits and
the lock is released immediately — leaving the same race with extra steps. If you
write `FOR UPDATE`, there must be a `BEGIN` above it.

## How long you hold it decides everything

The lock lasts until the transaction ends, so any work between the `SELECT` and the
`COMMIT` is work every other request waits through. Eight concurrent requests, each
doing 100 ms of work:

```console
=== 6. lock held across the slow work vs lock taken last ===
8 concurrent requests, 100 ms of work each
  lock held across the work : 863 ms total
  lock taken only to write  : 143 ms total
  ratio: 6.0x
```

Identical work, identical concurrency — the only difference is whether the 100 ms
happened inside the lock or before it.

- **Lock held across the work: 863 ms.** Fully serialised. Eight requests × 100 ms,
  one after another.
- **Lock taken only to write: 143 ms.** The 100 ms ran in parallel across all
  eight; only the short write serialised.

The rule: **do the slow part first, take the lock last, and re-read inside it.**

```js
const quote = await pricing.calculate(input);        // slow, no lock held
await client.query('BEGIN');
const {rows} = await client.query(
  `SELECT balance FROM c_accounts WHERE id = $1 FOR UPDATE`, [id]);
// re-check against the freshly locked row before writing
if (rows[0].balance < quote.total) throw new InsufficientFunds();
await client.query(`UPDATE c_accounts SET balance = balance - $1 WHERE id = $2`,
  [quote.total, id]);
await client.query('COMMIT');
```

The re-check matters: the value you computed the quote against may have changed
while you were computing it. The locked read is the authoritative one.

## Not waiting

The default is to queue. Three ways not to:

```console
=== 7. NOWAIT and SKIP LOCKED instead of queueing ===
NOWAIT      : 55P03 could not obtain lock on row in relation "c_accounts"
SKIP LOCKED : 0 rows — the locked row is simply not returned
lock_timeout: 55P03 canceling statement due to lock timeout after 302 ms
```

| Form | Behaviour | Use for |
|---|---|---|
| `FOR UPDATE` | waits indefinitely | the default; a short critical section |
| `FOR UPDATE NOWAIT` | raises `55P03` immediately | "someone else is editing this" → 409 |
| `FOR UPDATE SKIP LOCKED` | omits locked rows | queue workers claiming jobs |
| `SET lock_timeout` | raises `55P03` after a bound | a ceiling on how long a request can queue |

`NOWAIT` and `lock_timeout` share SQLSTATE `55P03` but differ in message —
`could not obtain lock on row` versus `canceling statement due to lock timeout`.
Do not try to tell them apart by code alone.

**`SKIP LOCKED` changes what the query means**, not just how it waits: it returns a
different set of rows. It is exactly right for "claim the next available job" and
wrong for "load account 1", where skipping it returns *nothing* and the handler
concludes the account does not exist. The measured queue patterns are in
[Phase 11 · SKIP LOCKED](../phase-11-mvcc/08-skip-locked.md).

**Set `lock_timeout` for request-serving roles.** Without it a request can queue
until the client gives up while still holding its connection:

```sql
ALTER ROLE api_user SET lock_timeout = '3s';
```

## Locking the right rows, in the right order

`FOR UPDATE` locks every row the `SELECT` returns. A query with a join locks rows
from all tables involved unless you say otherwise — `FOR UPDATE OF accounts`
restricts it. Locking more than you need widens the critical section for no gain.

When a request locks several rows, **lock them in a consistent order**. Two
requests locking rows 1 and 2 in opposite orders deadlock:

```console
40P01 deadlock detected
```

PostgreSQL detects it and kills one transaction, so it is not a hang — but it is an
error a user sees. Ordering the rows (`WHERE id = ANY($1) ORDER BY id FOR UPDATE`)
removes the possibility. [Phase 11 · Deadlocks](../phase-11-mvcc/11-deadlocks.md)
has the measured detail.

Note also that `FOR UPDATE` **blocks other writers, not readers**. A plain `SELECT`
still sees the old row version — that is MVCC — so locking does not stop anyone
reading stale data, only from writing over you.

## Choosing between this and a version column

| | `FOR UPDATE` | Version column |
|---|---|---|
| Conflicts | queue and wait | fail and retry |
| Wasted work under contention | none | every conflict |
| Cost with no contention | a transaction and a lock | nothing |
| Across two HTTP requests | impossible | works |
| Failure mode | deadlocks, lock waits | 409s, retry storms |

The dividing line is **whether the read and the write are in the same request**.
`FOR UPDATE` requires one transaction, so it cannot protect a user who loaded a
form five minutes ago — nothing can hold a lock that long. Optimistic
concurrency is the only option there.

Within a request, prefer `FOR UPDATE` when the row is contended: it does the work
once instead of retrying. And for the specific case of an increment, neither is
needed — `SET balance = balance + $1` is atomic on its own, measured in
[Phase 11 · Lost updates](../phase-11-mvcc/04-lost-update.md). Reach for a lock
only when you must *read* a value and act on it.

## Trade-off

`FOR UPDATE` converts a correctness problem into a throughput problem, and
throughput problems are easier to reason about — a queue is predictable in a way
that a retry storm is not. It costs an open transaction for the duration, so it
inherits everything in
[transaction duration](./05-transactions-request/02-savepoints-and-duration.md): a
held connection, held locks, and a pinned xmin horizon.

The real risk is scope creep. A lock taken at the top of a handler "to be safe"
serialises the whole request — measured at 6× here — and the fix is not to remove
the lock but to move it. Locks are cheap when they are narrow and ruinous when
they are wide.

## Gotchas

**Symptom:** `FOR UPDATE` does not prevent the lost update
**Cause:** No explicit transaction, so the statement autocommitted and released the
lock immediately.
**Fix:** `BEGIN` before the `SELECT`, `COMMIT` after the write.

**Symptom:** Throughput collapses under concurrency
**Cause:** Slow work between the locking read and the commit. Measured: 863 ms
versus 143 ms for the same eight requests, purely from lock scope.
**Fix:** Do the slow work first, take the lock last, re-read inside it.

**Symptom:** `55P03` in the logs
**Cause:** `NOWAIT`, or `lock_timeout` expiring. Measured: both report `55P03`,
with different messages.
**Fix:** Expected with either; map to 409 and let the client retry.

**Symptom:** A handler reports "not found" for a row that exists
**Cause:** `SKIP LOCKED` on a point lookup — the locked row is omitted, not waited
for.
**Fix:** `SKIP LOCKED` is for claiming work, not for loading a known row.

**Symptom:** `40P01 deadlock detected` under load
**Cause:** Two requests locking the same rows in different orders.
**Fix:** Lock in a deterministic order, e.g. `ORDER BY id`.

**Symptom:** Requests queue for the length of an external API call
**Cause:** The lock is held across a call to a third party.
**Fix:** External calls outside the transaction; set `lock_timeout` as a backstop.

**Symptom:** A join with `FOR UPDATE` locks more than intended
**Cause:** It locks rows from every table in the query by default.
**Fix:** `FOR UPDATE OF <table>`.

## Interview questions

**★ What does `SELECT ... FOR UPDATE` do and what does it require?**
It locks the rows it returns against other writers until the transaction ends, so a
read-modify-write cannot be interleaved. It requires an explicit transaction —
without `BEGIN` the statement autocommits and the lock is gone immediately.
Measured: two concurrent requests produced the correct 130 with no retries.

**★ Why does it matter where in the handler you take the lock?**
Because the lock is held to commit, so everything after it is serialised. Measured
with eight concurrent requests doing 100 ms of work each: 863 ms with the work
inside the lock, 143 ms with the lock taken only for the write — 6× from lock scope
alone.

**★ What is the difference between `NOWAIT` and `SKIP LOCKED`?**
`NOWAIT` raises `55P03` if the row is locked; `SKIP LOCKED` omits locked rows and
returns the rest. `SKIP LOCKED` changes the result set, which makes it right for
claiming queue jobs and wrong for loading a specific row — measured, it returned 0
rows for a locked point lookup, which a handler reads as "not found".

**★ When do you choose a version column over `FOR UPDATE`?**
When the read and the write are in different requests. A lock cannot span a user
filling in a form, so optimistic concurrency is the only option there. Within one
request, `FOR UPDATE` is usually better on a contended row because it does the work
once instead of retrying.

**Does `FOR UPDATE` stop other transactions reading the row?**
No — readers are never blocked under MVCC and continue to see the previous row
version. It blocks other writers and other `FOR UPDATE` locks.

**How do you avoid deadlocks when a request locks several rows?**
Lock them in a deterministic order, such as ascending id. Deadlocks come from two
transactions acquiring the same locks in opposite orders; PostgreSQL detects the
cycle and raises `40P01`, killing one of them.

---

← [Optimistic concurrency](13-optimistic.md) · Next → [Shaping in SQL vs JavaScript](15-shape-sql-vs-js.md)
