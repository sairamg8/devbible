---
title: "The lost update, and four ways to stop it"
sidebar_label: "04 · Lost update"
sidebar_position: 4
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 on **PostgreSQL 18.4** (`postgres:18-alpine`, `127.0.0.1:55432`),
> **Node 24.19.0**, `pg` 8.23.0. Script: `sandbox/pg-api/ex28-mvcc-isolation.mjs`.

**Read a value, compute a new one in JavaScript, write it back — and under concurrency
most of the writes disappear. No error, no warning, no deadlock. Measured: 20
concurrent increments of a counter produced a final value of 2.**

## The bug

```js
// every one of these is a correct-looking read-modify-write
const {qty} = (await c.query(`SELECT qty FROM m_ctr WHERE id = 1`)).rows[0];
await c.query(`UPDATE m_ctr SET qty = $1 WHERE id = 1`, [qty + 1]);
```

```console
$ node ex28-mvcc-isolation.mjs
=== 5. lost update — 20 concurrent read-modify-writes ===
(a) SELECT then UPDATE, 20 concurrent : qty = 2  <- writes lost, no error
```

**Twenty increments, final value 2. Eighteen writes vanished.** Every transaction
committed successfully. Nothing in the logs, nothing in the response, no exception to
catch — the only symptom is that the number is wrong later.

Why: each transaction read `qty` under [READ COMMITTED](03-read-committed.md), got the
value current at that moment, and wrote back an absolute number computed from a version
that was already stale. The last writer wins, and it wins with a value computed from an
old read.

This is the same class of bug as a decrementing stock count, a balance transfer, or
"append one item to a JSON array column" — anywhere the new value is computed outside
the database from a value read inside it.

## Fix 1 — do the arithmetic in SQL

```console
(b) UPDATE ... SET qty = qty + 1        : qty = 20 | 37.9 ms
```

```sql
UPDATE m_ctr SET qty = qty + 1 WHERE id = 1;
```

**Correct and the fastest of the four.** A single `UPDATE` statement is atomic: the row
is locked for the duration, and `qty` is read and written inside the same statement, so
no other transaction can slip between them. Use this whenever the new value is a
function of the old one.

Its limit is that the new value must be expressible in SQL. Counters, balances,
`jsonb_set`, array append — all fine. Anything needing application logic, an external
call, or a decision the database cannot make is not.

## Fix 2 — `SELECT … FOR UPDATE`

```console
(c) SELECT ... FOR UPDATE then UPDATE   : qty = 20 | 58.0 ms
```

```js
const {qty} = (await c.query(
  `SELECT qty FROM m_ctr WHERE id = 1 FOR UPDATE`)).rows[0];   // locks the row
const next = recomputeInJs(qty);
await c.query(`UPDATE m_ctr SET qty = $1 WHERE id = 1`, [next]);
```

The `FOR UPDATE` takes a row lock that every other writer must wait for, so the
read-modify-write becomes serial. **Correct, 1.5× slower than fix 1, and it works with
arbitrary application logic** — which is why it is the general answer.

The cost is real: the lock is held from the `SELECT` to the `COMMIT`, so keep that
window short and do no I/O inside it. Details in [Row locks](07-row-locks.md).

## Fix 3 — optimistic locking with a version column

```console
(d) optimistic version column          : qty = 20 | 170 retries | 337.4 ms
```

```js
const MAX = 5;
for (let attempt = 1; ; attempt++) {
  const {qty, version} = (await pool.query(
    `SELECT qty, version FROM m_ctr WHERE id = 1`)).rows[0];
  const r = await pool.query(
    `UPDATE m_ctr SET qty = $1, version = version + 1
     WHERE id = 1 AND version = $2`, [qty + 1, version]);
  if (r.rowCount === 1) break;                       // won
  if (attempt === MAX) throw new Error('too much contention on m_ctr#1');
  await sleep(5 * attempt * (0.5 + Math.random()));   // backoff + jitter
}
```

No locks are taken. The `WHERE version = $2` makes the write conditional on nothing
having changed since the read, and `rowCount === 0` means you lost and must retry.

**The bound and the jitter are not decoration.** A bare `for (;;)` here is the livelock this
phase warns about [two pages on](06-isolation-levels.md) — under sustained contention on one
row it spins forever at two queries per iteration, generating load that makes the contention
it is waiting out worse. And without jitter the losers re-read at the same instant and
collide again in lockstep, so the retry rate barely falls. The same shape appears in the
`withRetry` helper below and in `withSerializable`; every retry loop in this phase has a cap
and a jittered delay for these two reasons.

**Correct, and the slowest here: 170 retries and 337 ms for 20 increments.** That is
what optimistic locking looks like under *high* contention on a *single* row — the
worst possible case for it. Its natural home is the opposite: low-contention rows edited
by humans, where the retry almost never fires and the reward is holding no database
lock across a long think-time. It is also the only one of the four that works when the
read and the write are in different requests — the classic "someone else modified this
record" edit form.

## Fix 4 — let the isolation level catch it

```console
(e) REPEATABLE READ, no retry          : qty = 1 | 1 committed, 19 rejected  <- lost writes became errors
    first failure → 40001 could not serialize access due to concurrent update
```

Under [REPEATABLE READ](06-isolation-levels.md) the same read-modify-write code is
**not** silently wrong — 19 of the 20 transactions were refused with `40001` and only one
committed. The anomaly became an error.

That is only a fix if you retry, and a retry loop is mandatory:

```js
async function withRetry(fn, tries = 5) {
  for (let i = 1; ; i++) {
    try { return await fn(); }
    catch (e) {
      if ((e.code !== '40001' && e.code !== '40P01') || i === tries) throw e;
      await sleep(5 * i * (0.5 + Math.random()));   // backoff + jitter
    }
  }
}
```

Without the loop you have simply converted lost updates into user-visible 500s.

## Which one to use

| Situation | Use |
|---|---|
| New value is a function of the old (`+ 1`, `- qty`, `jsonb_set`) | **Fix 1** — SQL arithmetic |
| Application logic decides the new value, same request | **Fix 2** — `FOR UPDATE` |
| Read and write span requests (an edit form), or contention is low | **Fix 3** — version column |
| Invariants across *several* rows, not one | **Fix 4** — `SERIALIZABLE` + retry |

Fix 1 first, because it is the fastest and has no failure mode. Fix 2 when logic must
live in JavaScript. The other two are for the cases those cannot express.

## Trade-off

**Every fix costs either throughput or code.** Fix 1 costs nothing but only handles
expressible updates. Fix 2 costs a lock held to commit — 1.5× here, much more if you
do anything slow inside the window. Fix 3 costs a retry loop and degrades badly under
contention (measured 170 retries on one hot row). Fix 4 costs a retry loop plus the
serialization overhead. What you cannot do is nothing: the default level will not tell
you the write was lost.

## Gotchas

**Symptom:** A counter, balance or stock level drifts below what the logs say it should be
**Cause:** Read-modify-write under READ COMMITTED; concurrent writers overwrite each other
**Fix:** `SET col = col ± $1` in one statement

**Symptom:** The bug never reproduces locally
**Cause:** It needs genuine concurrency on the same row; serial requests always look right
**Fix:** Reproduce with N parallel clients (measured: 20 concurrent → final value 2)

**Symptom:** `40001 could not serialize access due to concurrent update` in production
**Cause:** REPEATABLE READ or SERIALIZABLE detected the conflict — working as designed
**Fix:** Add a bounded retry loop with jitter; do not lower the isolation level to hide it

**Symptom:** An optimistic update loops forever
**Cause:** Unbounded retry on a hot row; `rowCount: 0` every time
**Fix:** Cap the attempts and fail loudly, or switch that row to `FOR UPDATE`

**Symptom:** `FOR UPDATE` fixed correctness and destroyed throughput
**Cause:** The lock is held until `COMMIT`, and something slow runs inside the window
**Fix:** Move every non-database call outside the transaction; lock as late as possible

## Interview questions

**★ What is a lost update and why is it silent?**
Two transactions read the same value, each computes a new one, and the second write
overwrites the first. Both commit successfully — under READ COMMITTED there is no
conflict to report. Measured: 20 concurrent increments produced 2.

**★ Fix it without changing the isolation level.**
Do the arithmetic in SQL (`SET qty = qty + 1`), which is atomic within the statement, or
take a row lock with `SELECT … FOR UPDATE` before computing. Measured 20/20 correct
either way, at 37.9 ms and 58.0 ms.

**★ Why is `UPDATE … SET qty = qty + 1` safe when `SELECT` then `UPDATE` is not?**
It is one statement. The row is locked while it executes, and the old value is read
inside that same statement, so nothing can intervene between the read and the write.

**★ What does REPEATABLE READ do to this code?**
Turns the silent corruption into `40001` errors — measured 1 commit, 19 rejections out
of 20. It is a fix only if you add a retry loop.

**★ When is optimistic locking the right answer?**
When the read and the write are separated by user think-time (an edit form), or when
contention is low. Under heavy single-row contention it is the worst option — measured
170 retries and 337 ms where `FOR UPDATE` took 58 ms.

**How do you know an optimistic update lost the race?**
`rowCount === 0` — the `WHERE version = $2` matched nothing. Always check it; a
successful query with zero rows affected is the failure signal.

---

← [READ COMMITTED](03-read-committed.md) · Next → [MVCC snapshots](05-mvcc.md)
