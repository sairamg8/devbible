---
title: "Advisory locks"
sidebar_label: "15 · Advisory locks"
sidebar_position: 15
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08 on **PostgreSQL 18.4** (`postgres:18-alpine`, `127.0.0.1:55432`),
> **Node 24.19.0**, `pg` 8.23.0. Script: `sandbox/pg-api/ex29-locks.mjs`.

**A named mutex, held in the database, attached to a number you choose rather than to a
row. Use it when the thing you need to serialise is not a row — a cron job that must run
on exactly one instance, a migration, an import of a file.**

## Taking and releasing

```console
$ node ex29-locks.mjs
=== 9. advisory locks — a mutex the database does not tie to a row ===
a takes it   : true
b tries      : false <- no waiting, just false
a takes again: true <- re-entrant for the same session
pg_locks     : [{"locktype":"advisory","mode":"ExclusiveLock","objid":987654}]
a unlocks once: true
b tries again : false <- still held: it was taken twice
b after the 2nd unlock: true
```

Four behaviours to take from that:

- **`pg_try_advisory_lock(key)` never waits.** It returns `true` or `false` immediately.
  (`pg_advisory_lock(key)` is the blocking version.)
- **It is re-entrant within a session** — the same session can take the same lock twice
  and succeed both times.
- **Re-entrant means reference-counted.** After taking it twice, one
  `pg_advisory_unlock` left it held; it took a second unlock to release. Unbalanced
  lock/unlock calls are a leak.
- **Advisory locks are visible** in `pg_locks` with `locktype = 'advisory'` — unlike
  [row locks](07-row-locks.md), which are not.

## Session-scoped versus transaction-scoped

```console
session lock after COMMIT, b sees: false <- still held
xact lock after COMMIT, b sees   : true <- released automatically
```

| Function | Released when |
|---|---|
| `pg_advisory_lock(key)` | you call `pg_advisory_unlock`, or the **session** ends |
| `pg_advisory_xact_lock(key)` | the transaction ends — always, automatically |

**Prefer the `_xact_` variants.** A session lock survives `COMMIT`, so a code path that
returns early, throws, or forgets to unlock leaves the lock held for the life of the
connection — and with a connection pool that connection goes back into rotation still
holding it. The transaction-scoped version cannot leak.

Two more measured details:

```console
unlocking a lock you never held  : false
pg_advisory_lock(1,2) in pg_locks : [{"classid":1,"objid":2,"objsubid":2}] (objsubid 2 = two-int form)
```

Unlocking something you do not hold returns `false` and emits a warning rather than
raising — so a `false` return is worth checking. And the two-argument form
`pg_advisory_lock(classid, objid)` is a **different lock space** from the single-bigint
form: `(1, 2)` does not collide with the bigint `4294967298`, even though the bits line
up. Pick one form and use it consistently.

## The canonical use: single-runner

```console
=== 10. 10 processes race to run one job — only one should ===
ran: 1, skipped: 9, rows written: 1
```

Ten concurrent processes, one job, exactly one execution:

```js
const CRON_LOCK = 424242;   // keep these in one constants file

async function runIfLeader(pool, fn) {
  const client = await pool.connect();
  let held = false;
  try {
    const {rows} = await client.query('SELECT pg_try_advisory_lock($1) AS ok', [CRON_LOCK]);
    if (!rows[0].ok) return {ran: false};       // another instance has it
    held = true;
    const result = await fn();
    await client.query('SELECT pg_advisory_unlock($1)', [CRON_LOCK]);
    held = false;
    return {ran: true, result};
  } finally {
    client.release(held);   // still holding? destroy the connection, don't pool it
  }
}
```

This is a session lock deliberately: the job outlives any single transaction.

**The `release(held)` is the whole point of this version.** A session advisory lock lives on
the *connection*, not the transaction, and on a pooled client that is a trap. If the unlock
query itself throws — a network blip, a server restart mid-statement, an `fn()` that left
the connection in a failed state — a plain `client.release()` hands a connection that still
holds `CRON_LOCK` back into the pool. Nothing ever reclaims it: every later `runIfLeader`
gets `ok: false` from whichever instance draws that connection, and the job silently never
runs again for the lifetime of the process. Passing a truthy argument to `release()` tells
`pg` to **destroy** the connection instead of reusing it, which is the only way to
guarantee the lock is gone when its state is unknown.

The commonly-cited backstop — the lock dies with the connection, so a crashed instance
releases it automatically — is true for a *dedicated* connection and false for a pooled one.
A pooled connection that is released rather than closed does not die, so the backstop never
fires. Do not rely on it behind a pool.

**Prefer `pg_advisory_xact_lock` whenever the work fits in one transaction.** The server
releases a transaction-scoped advisory lock at `COMMIT` or `ROLLBACK` no matter what the
client does — no `finally`, no unlock query that can fail, no leak to reason about:

```js
await withTransaction(pool, async (c) => {
  const {rows} = await c.query('SELECT pg_try_advisory_xact_lock($1) AS ok', [CRON_LOCK]);
  if (!rows[0].ok) return {ran: false};        // released at COMMIT/ROLLBACK either way
  return {ran: true, result: await fn(c)};
});
```

Reach for the session-level form only when the critical section genuinely outlives a single
transaction — a long job that must commit in batches, or one that runs DDL and cannot be
wrapped — and when you do, use `release(held)` as above. Either way, this property is what a
Redis-based lock has to emulate with TTLs, and it is why an advisory lock is often the
better choice when you already have PostgreSQL.

**A `try` lock, not a blocking one.** Nine instances discovering they are not the leader
and moving on is correct; nine instances queuing to run the same hourly job is not.

## Choosing keys

The key space is a single `bigint` shared by the whole database — there are no
namespaces, so two features using `1` will block each other with no error and no clue.

```js
// hash a namespaced string to a stable key
const {rows} = await client.query(
  `SELECT pg_try_advisory_xact_lock(hashtextextended($1, 0)) AS ok`,
  [`import:file:${fileId}`]);
```

`hashtextextended(text, seed)` returns a `bigint`, which fits the single-argument form
exactly. Collisions are possible but rare, and their consequence is over-serialisation
rather than incorrectness. The alternative is a constants file where every advisory key
in the codebase is declared in one place — do one or the other, never ad-hoc numbers.

## When to use one, and when not to

**Use it for:** a scheduled job that must run on one instance; serialising a migration;
"only one import of this file at a time"; guarding a non-transactional external
resource; rate-limiting a shared external API to one caller.

**Do not use it for** protecting a row — that is [`FOR UPDATE`](07-row-locks.md), which
the database understands, which appears in deadlock detection with full context, and
which cannot be forgotten because it is released at commit.

**Do not use it as a queue.** Ten workers taking one advisory lock is nine idle workers;
[`SKIP LOCKED`](08-skip-locked.md) keeps all ten busy.

## Trade-off

**Advisory locks are advisory: the database enforces the lock, not the invariant.**
Nothing stops code that forgets to take it from doing the work anyway, so correctness
depends on every path agreeing to ask. They also live in shared memory
(`max_locks_per_transaction`), so taking thousands is a resource question. And they add a
lock nobody sees in the schema — a mutex whose meaning exists only in your code, which is
why the key constants must be centralised and named.

## Gotchas

**Symptom:** A lock stays held after the work finished
**Cause:** A session lock (`pg_advisory_lock`) with no unlock on the error path
**Fix:** Use `pg_advisory_xact_lock`, or unlock in `finally`

**Symptom:** One unlock did not release the lock
**Cause:** It was taken twice in the same session; the locks are reference-counted — measured
**Fix:** Balance every lock with exactly one unlock, or use the transaction-scoped form

**Symptom:** Two unrelated features block each other
**Cause:** Colliding keys in a flat, database-wide key space
**Fix:** Centralise key constants, or derive keys with `hashtextextended('feature:id')`

**Symptom:** A pooled connection behaves as if a lock is held from an earlier request
**Cause:** A session lock leaked and the connection was returned to the pool holding it
**Fix:** Transaction-scoped locks; `release(true)` on a connection whose state is uncertain

**Symptom:** `pg_advisory_unlock` returned `false`
**Cause:** This session did not hold that lock — wrong key, wrong form, or already released
**Fix:** Check the return value; confirm which form (bigint vs two-int) you are using

**Symptom:** All workers idle behind one advisory lock
**Cause:** Using it as a queue primitive
**Fix:** `FOR UPDATE SKIP LOCKED`

## Interview questions

**★ What is an advisory lock and when would you use one?**
A named lock keyed by a number rather than a row, with no meaning to the database. Use it
for single-runner cron jobs, migrations and file imports — anything to serialise that is
not a row.

**★ Session-scoped or transaction-scoped?**
Transaction-scoped (`pg_advisory_xact_lock`) by default: it is released at commit or
rollback and cannot leak. Session locks survive `COMMIT` — measured — and a leaked one
returns to the pool still held.

**★ What does `pg_try_advisory_lock` return when the lock is taken?**
`false`, immediately, with no waiting. That is what makes the leader-election pattern
work: the losers move on rather than queue.

**★ Are advisory locks re-entrant?**
Yes, within a session, and they are reference-counted. Measured: taken twice, one unlock
left it held.

**★ Why not use an advisory lock instead of `FOR UPDATE`?**
Row locks are understood by the database — deadlock detection, automatic release at
commit, no key management. Advisory locks are for things that are not rows.

**How do you avoid key collisions?**
One constants file, or derive from a namespaced string with `hashtextextended`. The key
space is a single flat `bigint` per database and the two-argument form is a separate
space again.

**What happens to an advisory lock if the process crashes?**
The connection dies and the lock is released — no TTL, no reaper. That is a real
advantage over an external lock service.

---

← [Idle in transaction](14-idle-in-transaction.md) · Next → [XID wraparound](16-xid-wraparound.md)
