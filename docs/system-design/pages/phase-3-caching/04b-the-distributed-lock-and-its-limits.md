---
title: "A lock around the recomputation gets the whole fleet down to one load per key, but it is a lease that can lapse, a queue that can spin, and a decision about what the losers do that the page must make explicitly"
sidebar_label: "04b · The distributed lock and its limits"
sidebar_position: 4.1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-10-14. Lock-guarded recomputation is **common practice stated as mechanism**; no RFC
> or vendor page defines it and nothing here is quoted. The `SET ... NX PX` acquire and the
> compare-and-delete release are named as the usual Redis shape; their exact semantics are the
> [Redis track's](../../../redis/README.md) and were **not re-fetched**. Continues
> [04](04-stampede-and-thundering-herd.md). **No sandbox run.**

**Per-process coalescing leaves one load per instance; a shared lock leaves one load in total, and
buys it with a new component that can itself fail.** This chunk is that trade: the code for the
lock, why every line of it exists, the limits of a lease, and the one question the lock forces you
to answer — what does a request that lost the race do?

## The lock around the recomputation

To get *one* load across all instances, the miss path takes a lock in the shared store: the
winner recomputes, the losers wait and re-read the cache. In Redis the standard shape is
`SET key token NX PX ttl` for acquire and a compare-and-delete script for release; the mechanics
of those commands are the [Redis track's](../../../redis/README.md), the design decision is here.

```js
const crypto = require('node:crypto');

const RELEASE = `
  if redis.call('get', KEYS[1]) == ARGV[1] then
    return redis.call('del', KEYS[1])
  end
  return 0`;

async function getWithLock(key, load, { ttl = 300, lockMs = 5000 } = {}) {
  for (let attempt = 0; attempt < 20; attempt++) {
    const hit = await redis.get(key);
    if (hit !== null) return JSON.parse(hit);

    const token = crypto.randomUUID();
    const won = await redis.set(`lock:${key}`, token, 'PX', lockMs, 'NX');
    if (won === 'OK') {
      try {
        const value = await load();
        await redis.set(key, JSON.stringify(value), 'EX', ttl);
        return value;
      } finally {
        await redis.eval(RELEASE, 1, `lock:${key}`, token);
      }
    }
    await sleep(50 + Math.random() * 50);   // jittered poll, then re-read the cache
  }
  return load();    // gave up waiting: a deliberate decision, see below
}
```

Every line of that is answering a failure:

- **The token and the compare-and-delete.** If the holder is slow and its lock expires, another
  instance acquires it. When the slow holder finishes and does a plain `DEL`, it deletes the
  *new* holder's lock. The token proves the lock is still mine.
- **`PX` on the lock.** A holder that crashes must not hold the lock forever. The expiry is a
  lease: it is the longest you are willing to make everyone else wait for a dead holder.
- **Polling with jitter.** Waiters that all sleep the same interval wake together and form a
  smaller herd against Redis itself.
- **The final `load()`.** After the retries run out the waiter has to choose: fail the request,
  serve stale if you have it, or go to the origin. Going to the origin is *fail-open* — correct
  for availability, and it reopens the herd when the lock holder is the thing that is slow.
  Failing closed protects the database and returns errors to users. That choice is a product
  decision, and the page should say which it made.

### The lock's own limits

A lock held for the duration of a recomputation is a lease, and a lease can be wrong: the holder
pauses (GC, a stalled network call) past `lockMs`, a second instance acquires, and now two
recomputations run. For caching that is *acceptable* — both write the same value for the same key,
so the cost is a duplicated query, not corruption. The lock is an efficiency device here, not a
correctness device, and that is why a simple `SET NX PX` is enough and a consensus-grade lock is
not warranted. The moment the guarded work has side effects that must not happen twice, this
argument stops holding and it is no longer a caching problem.

## What the losers do — the decision table

| Loser behaviour | Protects the origin | User experience | Use for |
|---|---|---|---|
| **Wait, then re-read the cache** | yes | latency, bounded by the wait | values where wrong or stale is costly: the flash-sale price and remaining stock |
| **Serve the stale copy** | yes | fast; old data | catalogue listings, review counts — needs a stale copy to exist (see [04c](04c-early-refresh-jitter-and-serving-stale.md)) |
| **Go to the origin anyway (fail open)** | no — reopens the herd | fast for this request | only when the origin has headroom and the lock service is the unreliable part |
| **Fail the request (fail closed)** | yes | errors | when the origin is the scarce thing and an error is better than an outage |

Whichever row you pick, put a bound on the wait. A waiter with no deadline turns a slow recomputation
into a pile of held connections, which is how a stampede becomes a connection-pool exhaustion
(see [connection pooling](../phase-2-request-path/14-connection-pooling-and-keep-alive.md)).

## Choosing among coalescing, locking and a shield

| Mechanism | Scope | Cost | Fails how |
|---|---|---|---|
| single-flight map | one process | memory for the map | `N` instances still send `N` loads |
| lock in the shared cache | the fleet | a round trip per attempt, polling | lease lapses, holder dies, waiters spin |
| origin shield / request collapsing at the CDN | all edges for one origin | configuration at the edge | only covers cacheable HTTP responses ([CDNs](../phase-2-request-path/05-cdns.md)) |

They compose: the in-process map means one waiter per instance polls Redis; the lock means one
instance queries the database. Neither reduces the time the first request spends waiting, which is
why the proactive defences exist.


## Gotchas

**★ Symptom: the lock is "working" yet the database is still hammered during a slow query.**
Cause: the lock lease (`lockMs`) is shorter than the recomputation under load. Each lease expires
mid-load, the next waiter acquires, and `r · d / lockMs` loads run concurrently — the lock has degraded
into a rate limit on the herd rather than a mutex. Fix: set the lease from the *worst* observed
recomputation time, not the typical one, and treat a lease expiring as a metric to alert on.


**Symptom: waiters burn the Redis CPU polling.**
Cause: a fixed-interval spin on `GET`, from every instance, for every waiter. Fix: jittered sleep as
shown, a bounded attempt count, and coalescing in-process first so only one waiter per instance polls.


**★ Symptom: a bounded wait still stampedes — when waiters time out they all hit the origin together.**
Cause: the fail-open fallback releases every waiter at the same deadline, so the herd the lock
suppressed is re-created at `t + wait`, synchronised. Fix: jitter the deadline per waiter, cap the
number of fail-open requests (a semaphore on origin loads), or fail closed.

**Symptom: the lock key outlives its purpose and blocks a key forever.**
Cause: the lock was acquired without an expiry (`SET NX` with no `PX`), or the expiry was set with a
second command after acquisition and the process died between them. Fix: acquire and set the expiry
in the one command, as above.

**Symptom: the "unlock" script is skipped on exceptions and the lock lingers until its lease.**
Cause: release placed after the `await load()` rather than in `finally`. Fix: release in `finally`;
the lease is the backstop, not the plan.

## Interview questions

**★ Why not just put a lock around the recomputation and be done?**
A lock bounds the load to one, but it is reactive (the winner still takes `d` and everyone queues
behind it), it adds a failure mode of its own (holder dies, lease too short, waiters spin), and the
waiters' fallback — fail open or fail closed — is a decision you must make explicitly. For a cache
the lock is an efficiency device: if the lease lapses and two instances recompute, the cost is a
duplicate query, because both compute the same value. That is also why a plain `SET NX PX` suffices.


**Should waiters that lose the lock wait, serve stale data, or go to the origin?**
It is the product decision the lock forces. Waiting preserves correctness and costs latency; serving
stale is the best user experience if staleness is tolerable and an old copy exists; going to the
origin protects availability of the single request and reopens the herd. For the flash-sale price,
where being wrong has a cost, wait briefly then fail; for a catalogue listing, serve stale.

**★ Your lock holder pauses for longer than the lease. What happens, and does it matter?**
The lease lapses, a second instance acquires, and two recomputations run; when the first wakes it
completes and writes. If its release is a plain `DEL` it removes the second holder's lock, so a
third instance joins too — that is what the token and compare-and-delete prevent. For a cache the
outcome is a duplicated query, because every holder computes the same value for the same key, so
the lock is an efficiency device and a simple lease is enough. It stops being acceptable when the
guarded work has side effects that must run once; that is a correctness lock and a different design.

**Single-flight, a Redis lock, or a CDN shield — which do you reach for first?**
The cheapest that covers the failure you have. A single-flight map costs nothing and is the right
default inside every instance. Add a shared lock when `N` instances times the query cost is still
too much for the origin. A shield covers cacheable HTTP at the edge and does nothing for an
internal object cache. Say that they compose and that none removes the first request's wait.

{/* FOOTER */}
