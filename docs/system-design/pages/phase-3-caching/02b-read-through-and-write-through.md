---
title: "Read-through and write-through move the cache from a side store the application consults to a layer the application talks to instead of the database — which removes the forgotten-invalidation bug and adds a dual-write problem the cache layer now has to solve"
sidebar_label: "02b · Read-through and write-through"
sidebar_position: 2.1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-10-14. Read-through and write-through are **common practice stated as
> mechanism**, not cited to a standard. The Caffeine behaviours named here (`LoadingCache`, the
> loader, `refreshAfterWrite`) are described from Caffeine's public API; the one Caffeine page in
> the research bank is the [Efficiency page](https://github.com/ben-manes/caffeine/wiki/Efficiency),
> quoted for the eviction policy only, and the loader semantics are **not quoted**. Redis does not
> ship read-through or write-through; stating otherwise would be invention. **No sandbox run.**

**In cache-aside the cache is a place the application remembers to look; in read-through and write-through the cache is the thing the application calls, and the database becomes an implementation detail behind it.** That inversion buys one real property — the loading and writing logic lives in exactly one place, so no code path can forget it — and costs another: the cache component must now be able to talk to the database, and the question "what if the cache write succeeds and the database write fails" stops being the application's problem and becomes the cache layer's. This page is those two strategies, what they look like in the JVM and Node where they are actually found, and why the standalone-cache-server versions are rare.

Strategy overview, the table of the two questions, and cache-aside are in [02](02-the-four-strategies.md). Write-behind and the per-data-type choice are in [02c](02c-write-behind-and-choosing-per-data-type.md).

## Read-through, the mechanism

The application calls `cache.get(key)`. On a hit it returns. On a miss the cache invokes a **loader** — a function registered with the cache when it was built — stores the result, and returns it. The caller never sees the miss and never touches the database.

```java
// Caffeine: read-through in-process
LoadingCache<Long, Product> products = Caffeine.newBuilder()
    .maximumSize(10_000)
    .expireAfterWrite(Duration.ofMinutes(5))
    .build(id -> repo.findById(id).orElse(null));   // the loader

Product p = products.get(42L);                      // hit, or the loader runs
```

Two properties distinguish this from `@Cacheable` and from cache-aside code that happens to be wrapped in a helper:

- **The loader belongs to the cache.** The cache can call it at times of its own choosing — to refresh an entry in the background, to reload after eviction, to load a batch. In Caffeine, `refreshAfterWrite` serves the old value while a reload runs asynchronously; the caller who triggered the reload does not wait, and later callers see the new value. This is `stale-while-revalidate` ([RFC 5861](https://www.rfc-editor.org/rfc/rfc5861.html): *"caches MAY serve the response in which it appears after it becomes stale, up to the indicated number of seconds."*) as a library behaviour rather than an HTTP header.
- **Concurrent misses on one key can be coalesced by the cache itself.** Because the cache is the one calling the loader, it can notice that a load for this key is already in flight and make the second caller wait for it rather than start another. A loading cache that does this is single-flight for free; cache-aside code has to build it. Whether a given library does so is a property to check, not assume.

### Where read-through actually lives

Read-through is natural when the cache is a library inside the process and awkward when the cache is a separate server. A remote Redis cannot hold your loader: the loader is a closure over your repository and connection pool, and it runs in the application's runtime. The few "read-through" products that exist for remote caches work by having the cache server load a data source through a plug-in configured on the server; that makes the cache a database client with its own credentials, connection pool, failure modes and deployment lifecycle, which most teams decline. In practice, what a Node or Spring team means by read-through over Redis is a small wrapper in application code — `getOrLoad(key, loader)` — which is cache-aside with the miss path factored into one function. That is a good thing to build, and it should be called what it is.

```js
// "read-through" over Redis is a helper, not a property of Redis
async function getOrLoad(key, ttlSeconds, loader) {
  const hit = await redis.get(key);
  if (hit !== null) return JSON.parse(hit);
  const value = await loader();
  if (value !== null) await redis.set(key, JSON.stringify(value), 'EX', ttlSeconds);
  return value;
}
const product = await getOrLoad(`product:${id}`, 300, () => loadProduct(id));
```

The helper is where you add the pieces that make misses safe: single-flight keyed by `key`, jittered TTL, a timeout on the loader, a decision about caching `null`. Putting them in one function is the entire benefit.

### What read-through does not fix

- **It does not solve invalidation.** A loader populates on a miss. After a write the entry is stale until it expires or is evicted or someone invalidates it. Read-through with a TTL and no write path is a system that serves stale data for up to a TTL after every change — acceptable for a product description, not for a price.
- **A loader that throws.** The cache must decide whether to cache the failure. Most libraries do not cache exceptions, so every caller retries the loader, and a failing database gets the full request rate. Caffeine's loader exceptions propagate to the caller; do not turn them into cached `null`.
- **A loader that returns `null`.** Caffeine treats a `null` from the loader as "no mapping" and does not cache it. A missing product therefore reaches the database every time, which is the cache-penetration problem and is why negative caching is a separate decision (**12 Negative caching and penetration** *(not written yet)*).
- **The loader runs under a lock in some implementations.** A slow loader that holds a per-key lock is fine; a loader that holds a lock covering the whole map blocks every unrelated key. Read the library's concurrency notes before putting a slow query in the loader.

## Write-through, the mechanism

The application writes to the cache layer. The cache layer writes the **database first or the cache first**, synchronously, and returns only when both are done.

```
write(k, v):
  1. persist v to the database          // may fail → the write fails, cache untouched
  2. put v in the cache                 // cache now equals database
  3. return success
```

The ordering matters and is a real design choice. Database-then-cache means a failed database write leaves the cache untouched (good) and a failed cache write leaves the database correct and the cache stale or empty (repairable by deleting the key). Cache-then-database means a failed database write leaves the cache holding a value that was never persisted — a phantom read of data that does not exist — unless the cache write is undone. Persist first.

Properties:

- **A read after a write sees the write.** The cache is updated as part of the write, so there is no stale window caused by the invalidation gap. This is the property people want from it.
- **Every write is paid at the slower of the two stores' latency** plus the sum when sequential. Write-through makes writes slower than writing the database alone, always; the cache is purely additional work on the write path.
- **The cache fills with data that may never be read.** Every written row lands in the cache whether or not anyone will read it. A write-heavy table with a read-rarely access pattern — the orders table, audit logs — turns write-through into a way to evict the useful entries with useless ones.
- **It does not populate on a read miss.** A key that was never written through (data loaded by a migration, or evicted) is absent until some read loads it, so write-through is almost always paired with read-through for the miss path.

### The dual-write problem is not solved by calling it a layer

Write-through is two writes to two systems that have no shared transaction. The failure matrix is the same as any dual write:

| Database write | Cache write | Result |
|---|---|---|
| succeeds | succeeds | consistent |
| fails | not attempted | consistent; the caller sees an error |
| succeeds | fails | database right, cache stale or absent |
| succeeds | succeeds, but the process dies before returning | consistent, caller may retry a write that already happened |

The third row is the one that matters, and the cache layer's only honest options are: **delete the key** (so the next read loads truth), **retry** (making the cache write idempotent, which `SET` is), or **return an error with the database already committed** (which makes the caller's retry a duplicate unless the write is idempotent — see [RFC 9110](https://www.rfc-editor.org/rfc/rfc9110.html) §9.2.2: *"A request method is considered 'idempotent' if the intended effect on the server of multiple identical requests with that method is the same as the effect for a single such request."*). The only way to close the gap completely is to not have two systems: either the cache is derived from the database's change log, or the cache is the system of record (and then it is write-behind with durability concerns, below).

A write-through helper in Node, with the failure policy visible:

```js
async function writeThroughProduct(id, fields) {
  const { rows } = await pg.query(
    'UPDATE products SET title = $2, price_cents = $3 WHERE id = $1 RETURNING *',
    [id, fields.title, fields.price_cents]);
  const row = rows[0];
  try {
    await redis.set(`product:${id}`, JSON.stringify(row), 'EX', 300);
  } catch (e) {
    await redis.del(`product:${id}`).catch(() => {});   // best effort; TTL is the backstop
  }
  return row;
}
```

Note `RETURNING *`: the value written to the cache is the row the database returned, not the request body the caller sent. Caching the request instead of the persisted row stores values the database normalised, defaulted, truncated, or rejected a trigger on.

### Write-through has the same race as update-in-place

[02](02-the-four-strategies.md) showed that updating a cache key from concurrent writers can land in the wrong order. Write-through does exactly that unless the layer serialises writes per key. Two concurrent writers to one key each commit to the database (in some order) and then each `SET` the cache (in some order, independently). A cache layer that wants correctness has to hold a per-key lock across the database write and the cache write, which serialises writers on a hot key — acceptable for a product, a bottleneck for a flash-sale counter — or carry a version and refuse to move it backwards.

## Gotchas

**★ Symptom: "we use write-through, so the cache is always consistent" — and a stale value is found anyway.** Cause: write-through makes the cache consistent *with the writes that went through it*. Rows changed by a migration, an admin SQL console, another service, or a replica lag-delayed reader repopulating are all invisible to it, and two concurrent writers can apply their cache writes in the wrong order. Fix: treat write-through as reducing the stale window, keep a TTL, and use version-checked cache writes. The honest claim is "read-your-writes for writes through this path".

**★ Symptom: a failed cache write fails the user's order, though the order was committed.** Cause: the database write and the cache write were in one `try` and the cache error propagated after the commit. Fix: persist first, treat the cache write as best effort, fall back to `del` and then to the TTL. A cache outage must not turn a successful write into a user-visible error.

**★ Symptom: the cache holds a value the database never stored.** Cause: cache-then-database ordering, where the database write failed or a transaction rolled back after the cache was updated. Fix: write the database first and write to the cache only the row the database returned; never put a value in the cache from inside an open transaction.

**★ Symptom: write-through is on for the orders table and the product cache's hit ratio collapses.** Cause: write-through fills the cache with every written row; orders are written once and rarely read, and they evict hot catalogue entries. Fix: write-through only for data that is read soon after being written, and do not cache write-mostly aggregates at all.

**Symptom: every `get` for a missing product hits the database, despite a read-through cache.** Cause: the loader returned `null`, which Caffeine-style loaders treat as no mapping and do not store. Fix: return a sentinel or an `Optional`-shaped value deliberately, with a short TTL, and invalidate it on create.

**Symptom: when the database is slow the cache makes it worse.** Cause: a loader without a timeout holds threads, retries from many callers stack up, and no entry is stored because the loads never complete. Fix: a loader timeout shorter than the caller's, coalesced loads, and serving a stale value while a refresh is in flight (`refreshAfterWrite` rather than `expireAfterWrite` for data where stale is tolerable).

**Symptom: "read-through Redis" is described in the design doc and nobody can find the loader.** Cause: Redis cannot hold your loader; what exists is a wrapper in application code. Fix: name it as cache-aside with a shared helper, put single-flight and jitter in that helper, and do not build the design on a capability the store does not have.

**Symptom: write-through latency is higher than before the cache was introduced.** Cause: the cache is an additional synchronous hop on every write, and in a different availability zone it is a network round trip per write. Fix: this is inherent. If write latency matters more than read-your-writes, choose delete-on-write cache-aside instead, or write-behind where durability permits.

## Interview questions

**★ What do read-through and write-through each add that cache-aside lacks?**
They move the miss path and the write path out of every call site and into the cache layer, so no call site can forget to load, populate or update. What they cost is that the cache must be able to reach the database, and that the write path becomes a synchronous dual write. Cache-aside keeps the cache optional and the database the only thing the application depends on. Many designs choose read-through for reads and delete-on-write for writes — a combination, not a pair.

**★ Is Redis read-through?**
No. Redis is a store; it has no hook that runs your database query on a miss. Anything described as read-through over Redis is a wrapper in application code, which is cache-aside with the miss path centralised. Read-through is a property of in-process libraries such as Caffeine's `LoadingCache`, and of data-grid products configured to load from a data source. A candidate who says "Redis read-through" without that qualification has named a pattern and not a mechanism.

**★ What goes wrong in write-through when the cache write fails after the database write succeeded?**
The database holds the new value and the cache holds the old one or nothing. The layer can delete the key, retry the idempotent `SET`, or surface an error to a caller who may then retry a committed write. Persist first, treat the cache write as best effort, delete on failure, and let the TTL clean up what the delete missed. The question that follows is usually how to make it atomic, and the answer is that two independent stores cannot be made atomic without a coordinator; the realistic answer is to derive the cache from the database's change log.

**★ Why would you not use write-through for everything?**
Because it makes every write slower, fills the cache with data nobody reads, and still is not a guarantee of consistency. It earns its place for data read soon after being written and where read-your-writes matters — a user's own profile, a just-posted review — and does not for write-mostly data.

**How does a loading cache avoid a stampede on a popular key?**
By coalescing: the cache is the only caller of the loader, so when a load for a key is in flight it can make later callers wait for that same result. Whether a given library does so should be confirmed in its documentation. A cache-aside helper over Redis does this only if you write the in-flight map, and that is single-flight within one process only; across processes it takes a lock or a lease.

**What is `refreshAfterWrite` and how is it different from expiry?**
Expiry removes the entry, so the next caller waits for a load. Refresh keeps serving the existing value and reloads in the background, so no caller waits except the first after the refresh interval, and then only for the trigger rather than the load. It is the library form of stale-while-revalidate, and the right choice when serving a slightly old value is acceptable and tail latency is not.

**Why persist before caching in write-through?**
Because the reverse order can leave the cache holding a value that was never stored — a phantom that readers will see and the database will deny. The failure the other order produces, a stale or missing cache entry, is repaired by a delete or the TTL; the phantom is not repaired by anything.

{/* FOOTER */}
