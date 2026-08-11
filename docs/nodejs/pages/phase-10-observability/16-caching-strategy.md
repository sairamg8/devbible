---
title: "Caching strategy — what to cache, TTLs, invalidation, stampedes"
sidebar_label: "16 · Caching strategy"
sidebar_position: 16
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 on **Node 24.19.0**. Patterns are runtime-agnostic; Redis and
> in-process examples assume a single Node process or a shared cache as noted.

**A cache is a correctness trade: you serve something that might be stale in exchange
for not hitting the expensive path. If you cannot name the invalidation rule, you do
not have a cache strategy — you have a future incident.**

Phase 10 owns the **strategy**. Redis as a technology is its own track; here the
questions are what, how long, how you bust it, and how you survive simultaneous misses.

## What deserves a cache

| Good candidates | Poor candidates |
|---|---|
| Read-heavy, write-rare reference data | Data that must be right on the next read (balances, inventory) without versioning |
| Expensive computed responses with a clear key | Huge objects that blow RSS when cached in-process |
| Auth session lookups you already designed for TTL | User-specific data with unbounded key cardinality in a tiny heap |

**In-process (`Map`, LRU)** is fastest and **per pod**. After deploy or scale-out you
have N independent caches. **Redis / Memcached** is shared and adds a network hop and
an operational dependency.

## TTLs

```js
// pseudo-code — shared cache client
async function getUserProfile(userId) {
  const key = `user:profile:${userId}`;
  const hit = await redis.get(key);
  if (hit) return JSON.parse(hit);

  const profile = await db.user.findById(userId);
  // TTL is a safety net, not the only invalidation
  await redis.set(key, JSON.stringify(profile), 'EX', 60);
  return profile;
}
```

**TTL alone is not invalidation** — it bounds how wrong you can be. For updates that
must show up sooner, **delete or overwrite the key on write**:

```js
async function updateUserProfile(userId, patch) {
  const profile = await db.user.update(userId, patch);
  await redis.del(`user:profile:${userId}`);
  return profile;
}
```

Pick TTLs from product tolerance ("stale for 60 s is fine") and load ("DB dies at
this QPS"), not from superstition.

## Cache stampede

When a hot key expires, **many requests miss at once** and stampede the DB.

```js
// single-flight style in one process
const inflight = new Map();

async function getHotConfig() {
  const key = 'config:hot';
  const cached = await redis.get(key);
  if (cached) return JSON.parse(cached);

  if (inflight.has(key)) return inflight.get(key);

  const p = (async () => {
    try {
      const value = await db.loadConfig();
      await redis.set(key, JSON.stringify(value), 'EX', 30);
      return value;
    } finally {
      inflight.delete(key);
    }
  })();
  inflight.set(key, p);
  return p;
}
```

Across processes you need a **distributed lock or probabilistic early refresh**
(soft TTL). In-process single-flight alone does not protect a 20-pod fleet.

Other stampede controls: slightly **jittered TTLs**, serve stale while revalidating,
and rate-limit the origin path.

## Invalidation shapes

| Strategy | When |
|---|---|
| TTL only | Staleness OK; simple reads |
| Write-through / write-around + delete | Updates must drop the old value |
| Versioned keys (`user:42:v7`) | Avoids some races; old keys expire via TTL |
| Pub/sub bust | Multi-layer caches need a signal |

**Never** invent a second source of truth without a rule for which wins after a crash.

## Gotchas

**Symptom:** Users see old data after save
**Cause:** TTL-only cache; write path did not bust the key
**Fix:** Delete or set on write; short TTL as backstop

**Symptom:** DB melts at the same second every minute
**Cause:** Aligned TTLs on a hot key → stampede
**Fix:** Single-flight, jitter, soft TTL, or lock around recompute

**Symptom:** Memory climbs until OOM
**Cause:** Unbounded in-process cache, no LRU/max
**Fix:** Cap entries; prefer Redis with maxmemory policy for shared data

**Symptom:** Cache works in one pod, wrong in another
**Cause:** In-process cache after write hit a different replica
**Fix:** Shared cache or sticky sessions + bust on write to shared store

**Symptom:** Null cached forever
**Cause:** Caching "not found" without TTL, or caching errors
**Fix:** Short negative-cache TTL; never cache 5xx

## Interview questions

**★ What must you define before adding a cache?**
The key, the TTL, the invalidation path on write, and what staleness the product allows.

**★ What is a cache stampede?**
Many concurrent misses on one expired hot key overload the origin. Mitigate with
single-flight, locks, jittered TTLs, or stale-while-revalidate.

**In-process vs Redis cache?**
In-process: lowest latency, per instance, dies on deploy. Redis: shared, networked,
operational cost. Choose based on coherence needs.

**Why is caching errors dangerous?**
A transient failure becomes a long outage for every client that hits that key.

**How do caches interact with connection pools?**
A stampede is a pool exhaustion event. Cache fixes often show up as pool wait metrics
dropping ([Phase 6](../phase-6-data-access/01-connection-pooling.md)).

---

← Prev: [Finding the bottleneck](./15-finding-the-bottleneck.md) · Next → [Memory leaks](./17-memory-leaks.md)
