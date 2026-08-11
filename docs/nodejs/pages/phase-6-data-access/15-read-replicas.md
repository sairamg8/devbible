---
title: "Read replicas and routing reads vs writes"
sidebar_label: "15 · Read replicas"
sidebar_position: 15
---

<span className="db-tier t-when">When Needed</span>

> Verified: 2026-08 on **Node 24.19.0** — `pg` 8.23.0 against **PostgreSQL 17.10**
> primary and a **real streaming replica** built with `pg_basebackup -R`, both on
> localhost.

**A replica is a second copy of the database that is slightly behind.** Routing reads
to it is four lines of code. The bug it introduces is that a user sometimes cannot see
what they just saved — and this page is mostly about that bug, because the four lines
are trivial.

## Two pools

```js
import pg from 'pg';

const primary = new pg.Pool({connectionString: process.env.DATABASE_URL});
const replica = new pg.Pool({connectionString: process.env.REPLICA_URL});

// hard-fails writes: the replica physically cannot accept them
export const db = {
  read:  (text, values) => replica.query(text, values),
  write: (text, values) => primary.query(text, values),
};
```

The replica is genuinely read-only, so a mis-routed write does not corrupt anything —
it errors:

```js
await replica.query("insert into users (email) values ('x@example.com')");
```

```console
error: cannot execute INSERT in a read-only transaction
code: '25006'
```

```js
console.log(await replica.query('select pg_is_in_recovery()'));
```

```console
{ pg_is_in_recovery: true }
```

`25006` from the replica pool is a routing bug, always. It is a useful thing to alert
on.

## How far behind is it?

On the primary:

```sql
select client_addr, state, sync_state, replay_lag from pg_stat_replication;
```

```console
 client_addr | state     | sync_state | replay_lag
-------------+-----------+------------+-----------------
 127.0.0.1   | streaming | async      | 00:00:00.001587
```

**1.6 milliseconds**, on an idle pair on the same machine. That is the best case that
exists, and it is exactly why this problem is so easy to miss in development. On a
real deployment — different hosts, real write volume, a nightly batch job — the same
number is tens of milliseconds, and seconds during a bulk load. `sync_state: async`
is the key word: the primary commits without waiting for the replica.

## The bug, measured

Write to the primary, then immediately read through the router:

```js
await db.write('insert into users (email) values ($1)', ['new@example.com']);
const {rows} = await db.read('select id from users where email = $1', ['new@example.com']);
console.log('rows:', rows.length);
```

```console
rows: 0
```

The same query sent to the primary returned 1. **The user just created an account and
the next page says it does not exist.**

Timed over 20 rounds on that idle localhost pair:

```console
visible after 1.5–2.5 ms typically
worst case  8821 µs
sometimes needed 2–3 reads before the row appeared
```

Under 9 ms, on the friendliest possible setup — and still enough to break a
create-then-redirect flow, because the redirect is faster than the replication.

## Read your own writes

The fix is not to make replication faster. It is to send *this user's* reads to the
primary for a while after they write.

**The simple, correct version:** after a write, pin that request's remaining reads to
the primary.

```js
import {AsyncLocalStorage} from 'node:async_hooks';

const store = new AsyncLocalStorage();

export function withRouting(fn) {
  return store.run({sawWrite: false}, fn);
}

export const db = {
  async write(text, values) {
    const ctx = store.getStore();
    if (ctx) ctx.sawWrite = true;
    return primary.query(text, values);
  },
  async read(text, values) {
    const ctx = store.getStore();
    return (ctx?.sawWrite ? primary : replica).query(text, values);
  },
};
```

Wrap each request in `withRouting` and a handler that writes never reads stale data
again — within that request. `AsyncLocalStorage` here is the same mechanism used for
transaction propagation in [page 06](./06-transactions.md).

**Across requests** — POST then a redirected GET — one request's flag is gone. The
options, cheapest first:

1. **Route by intent.** Anything the user is about to be shown after acting on it
   reads from the primary. A dashboard, a search, a report, a feed reads from the
   replica. This is a per-endpoint decision, and for most applications it is the whole
   solution.
2. **A short session pin.** Record "this user wrote at time T" (a cookie, or Redis)
   and route their reads to the primary for the next few seconds.
3. **LSN tracking.** Capture `pg_current_wal_lsn()` after the write, pass it along,
   and have the read wait until `pg_last_wal_replay_lsn()` has caught up. Precise,
   and considerably more machinery than most applications need.

## When a replica is the right tool

**It is for read capacity and isolation, not for latency.** A replica does not make
any single query faster — it is the same query on the same schema, plus a network hop.
It gives you somewhere to put load that would otherwise compete with writes.

Good reasons: analytics and reporting queries that would otherwise thrash the
primary's cache; a genuine read:write ratio like 20:1 where the primary is CPU-bound
on reads; a geographically distant read population; a standby you were going to run
for failover anyway, put to work.

Bad reasons: "for performance" with no measurement — an index usually buys more than a
replica, at a fraction of the complexity; "for high availability" — a read replica is
not automatic failover, and promoting one is an operational procedure with data-loss
characteristics you need to understand before the day you need it.

**The first thing to try is not a replica.** Fix the N+1
([page 07](./07-n-plus-1.md)), add the missing index, cache the hot read. All three
are cheaper than a permanently stale copy of your data.

## MongoDB says the same thing differently

Mongo has this built in, as `readPreference` on the connection string or per query:

```js
const client = new MongoClient(uri, {readPreference: 'secondaryPreferred'});
const users = db.collection('users').find(query, {readPreference: 'primary'});
```

`primary` (the default) has no staleness. `secondaryPreferred` gets the same benefit
and the same bug as above. Mongo's own answer to read-your-writes is **causal
consistency**: operations inside a session with `causalConsistency: true` see the
session's own prior writes, wherever they are routed. That is LSN tracking, done for
you.

## Gotchas

**Symptom:** A user creates something and the next page says it does not exist
**Cause:** The read went to a replica before replication caught up. Measured: 0 rows
immediately after the write, on an idle localhost pair.
**Fix:** Route post-write reads to the primary — per request via `AsyncLocalStorage`,
per endpoint by intent, or by pinning the session briefly.

**Symptom:** `25006 cannot execute INSERT in a read-only transaction`
**Cause:** A write went through the read pool.
**Fix:** Fix the routing. Keep the error loud — it is proof the replica cannot be
corrupted by this bug.

**Symptom:** Replica lag spikes during a nightly job
**Cause:** Bulk writes generate WAL faster than the replica replays it.
**Fix:** Monitor `replay_lag`; route reads back to the primary above a threshold;
throttle the batch.

**Symptom:** Everything works in development, breaks in production
**Cause:** Development had no replica, or lag was ~1 ms on one machine.
**Fix:** Run a replica in staging with injected delay
(`recovery_min_apply_delay`), so stale reads surface before users find them.

**Symptom:** A transaction's reads are inconsistent
**Cause:** Statements inside one logical unit were split across pools.
**Fix:** A transaction is entirely on the primary, on one connection
([page 06](./06-transactions.md)).

**Symptom:** Adding a replica did not improve latency
**Cause:** It never does — it adds capacity, not speed.
**Fix:** Measure what is slow. Indexes, query count and caching come first.

## Interview questions

**★ What actually breaks when you route reads to a replica?**
Read-your-own-writes. Replication is asynchronous, so a read issued immediately after
a write can miss it — measured here as 0 rows on an idle localhost pair, with the
primary returning 1. In production the window is tens of milliseconds or more.

**★ How do you fix it without giving up the replica?**
Send reads that follow a write to the primary. Per request, track "this request has
written" in `AsyncLocalStorage`; across requests, route by endpoint intent or pin the
user's session to the primary for a few seconds. The precise version tracks the WAL
LSN and waits for the replica to catch up; MongoDB offers that as causal consistency.

**★ Does a read replica make queries faster?**
No. It is the same query on the same data, plus a network hop. It adds read capacity
and isolates heavy reporting from the primary. If a single query is slow, the answer
is an index or a rewrite.

**★ What happens if a write reaches the replica?**
PostgreSQL rejects it — `25006 cannot execute INSERT in a read-only transaction`,
because `pg_is_in_recovery()` is true. Corruption is not possible; it is purely a
routing bug, and worth alerting on.

**How do you know how far behind a replica is?**
`pg_stat_replication` on the primary — `replay_lag`, plus `state` and `sync_state`.
Measured 1.6 ms on an idle local pair with `sync_state: async`, meaning the primary
commits without waiting for the replica.

**Can a transaction span primary and replica?**
No. A transaction is one connection on the primary. Splitting reads out of a
transaction to "save load" gives you statements from two points in time.

**Is a read replica high availability?**
Not by itself. It is a warm copy; promoting it is an operational procedure with its
own data-loss window on asynchronous replication. Real HA needs automatic failover
and a decision about synchronous commit.

---

← Prev: [Retry and backoff](./14-retry-backoff.md) · Next → [Streaming large result sets](./16-cursors.md)
