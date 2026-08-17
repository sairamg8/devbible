---
title: "The cache layer"
sidebar_label: "08 · The cache layer"
sidebar_position: 8
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the Node.js v24 docs (`Map`, promises). Concept
> home: [Node — caching strategy](../../../nodejs/pages/phase-10-observability/16-caching-strategy.md)
> — stampedes, TTLs, invalidation — and
> [memory leaks](../../../nodejs/pages/phase-10-observability/17-memory-leaks.md).

## The problem

Three reads dominate the API: the catalog's first page, single product pages,
and the category list. All change rarely and are read constantly — the
textbook cache case. The design must survive the two classic failures — the
**stampede** (a hot key expires and every concurrent request hits Postgres at
once) and the **unbounded map** (a cache that is secretly a memory leak) —
and it must be honest about multi-instance staleness.

## The design choices

**In-process first, Redis-shaped on purpose.** One API instance's cache is a
`Map` — zero infrastructure, zero serialization, microsecond hits. The
interface is `get/set/del` with TTLs — exactly Redis's shape — so promotion
to a shared cache when instance count makes hit rates sag is a new
implementation of the same interface, not a refactor. (Redis mechanics
belong to the Redis track; this chapter's job is the seam.)

**Single-flight is the stampede fix.** The cache stores *promises*, not just
values: the first miss starts the load, concurrent misses await the same
promise, and Postgres sees one query per expiry instead of one per request.
The [concept page](../../../nodejs/pages/phase-10-observability/16-caching-strategy.md)
demonstrates the failure; this is the production shape of its fix.

**Bounded size, LRU eviction.** Product pages are keyed per id — an
unbounded map grows with the catalog. A max-entries bound with
least-recently-used eviction caps the worst case at "a cache that forgets",
never "a process that dies".

**TTL is the guarantee; NOTIFY tightens it.** Every entry expires (60 s
here). The [LISTEN/NOTIFY chapter](../phase-1-database/12-listen-notify.md)
already wired `product_changed` — each instance evicts its own copy on
notification, so typical staleness is milliseconds while the TTL remains the
worst case *even if notifications are missed*.

## The implementation

```js
// services/cache.js — in-process, single-flight, bounded, TTL'd
export function createCache({maxEntries = 5_000, defaultTtlMs = 60_000} = {}) {
  const entries = new Map(); // key -> {promise, expiresAt}; Map = insertion order

  function evictIfNeeded() {
    while (entries.size > maxEntries) {
      entries.delete(entries.keys().next().value);   // oldest-inserted first
    }
  }

  return {
    /** Single-flight read-through: one loader flight per key per TTL. */
    async get(key, loader, {ttlMs = defaultTtlMs} = {}) {
      const now = Date.now();
      const hit = entries.get(key);
      if (hit && hit.expiresAt > now) {
        entries.delete(key);                         // refresh LRU position
        entries.set(key, hit);
        return hit.promise;
      }

      const promise = Promise.resolve()
        .then(loader)
        .catch((err) => {
          entries.delete(key);                       // never cache a failure
          throw err;
        });
      entries.set(key, {promise, expiresAt: now + ttlMs});
      evictIfNeeded();
      return promise;
    },

    del(key) { entries.delete(key); },
    delPrefix(prefix) {
      for (const k of entries.keys()) if (k.startsWith(prefix)) entries.delete(k);
    },
    stats() { return {size: entries.size}; },        // chapter 09 exports this
  };
}
```

Wired into the data path:

```js
// services/catalog.js (excerpt) — the read-through in use
export function catalogService({pool, cache}) {
  return {
    product: (slug) =>
      cache.get(`product:${slug}`, () => productsRepo(pool).bySlug(slug)),
    categories: () =>
      cache.get('categories', () => categoriesRepo(pool).all(),
                {ttlMs: 300_000}),
  };
}

// worker/cache-invalidate.js — the NOTIFY listener (ch. 1·12's client shape)
// on 'product_changed' payload=slug:  cache.delPrefix(`product:${payload}`)
// and cache.delPrefix('catalog:')     — list pages containing it are stale too
```

## What to notice

- **Failures are never cached.** The `catch` deletes the entry before
  rethrowing — otherwise one transient DB error becomes sixty seconds of
  every request failing from cache. (Negative caching — "this slug is a
  404" — is a *separate, deliberate* entry with its own short TTL, made in
  the endpoint that owns 404 semantics, not here.)
- **Storing promises has one sharp edge** — every awaiter shares one
  rejection, which is why the catch-and-delete matters more than it looks:
  the *next* request after a failure gets a fresh flight, not the cached
  rejection.
- **List pages invalidate by prefix.** A product edit invalidates its own
  key *and* `catalog:*` — the coarse hammer is correct at this scale;
  per-page dependency tracking is complexity the 60-second TTL already
  bounds.
- **What is deliberately not cached:** anything user-specific (carts,
  orders, sessions) — per the
  [statelessness rule](../phase-0-the-app/02-architecture-and-data-model.md),
  user state lives in the database, and caching it per-instance would make
  two instances *disagree about the user's own actions*. Catalog data is
  shared truth; that is what makes it cacheable here.

## Gotchas

- **Symptom:** after a price update, one instance shows the new price and
  another the old one for up to a minute. **Cause:** the NOTIFY eviction
  reached one instance and not the other (listener reconnecting). **Fix:**
  this is the designed worst case — the TTL bounds it. If the business
  can't accept 60 s, lower the TTL for `product:*` keys and pay the hit
  rate; do not build "reliable invalidation" on NOTIFY, which
  [cannot promise it](../phase-1-database/12-listen-notify.md).
- **Symptom:** heap grows steadily under a crawler hitting every product
  page. **Cause:** would be the unbounded-map leak — prevented by
  `maxEntries`; the crawler instead churns the LRU and drops the hit rate.
  **Fix:** working as designed; `stats().size` flat at the cap plus a low
  hit rate is the *signature* of a crawl, useful in itself.
- **Symptom:** the categories menu shows a deleted category for five
  minutes. **Cause:** `categories` has the long TTL and no invalidation
  hook — admin category edits are rare enough that nobody wired one.
  **Fix:** the admin endpoint calls `cache.del('categories')` on write —
  one line, and the chapter's rule: **every cached key is either
  TTL-tolerable or has a named invalidation path**; "both unknown" is the
  bug.

## Interview questions

1. **★ Why cache promises instead of values?** Because the dangerous moment
   is the *miss*, not the hit: on expiry of a hot key, N concurrent
   requests all see "no value" and all query. Storing the in-flight promise
   makes request 2…N await request 1's flight — the stampede becomes one
   query by construction rather than by luck.
2. **★ Why is a bounded LRU non-negotiable for a per-key cache?** The key
   space grows with data (every product) and with abuse (every probed URL).
   An unbounded cache is a memory leak with a respectable name — the
   process dies at peak traffic, which is when the cache was busiest
   "helping". Bounding turns the failure mode into reduced hit rate, which
   degrades instead of crashing.
3. **When does this move to Redis, and what changes?** When multiple
   instances make per-instance hit rates poor, or when an expensive
   computation is worth sharing (the dashboard). The interface holds;
   what's *new* is serialization cost, a network hop on every hit, and a
   shared failure domain — which is why "Redis from day one" is not free
   and wasn't chosen. The seam was built so the day it pays, it's a small
   diff.
4. **Why must user-specific data never enter this cache?** Two instances
   with independent caches would serve the same user different views of
   their own cart — a correctness bug, not a staleness trade. Shared
   mutable per-user state belongs in the database (or a *shared* cache with
   the same single-source property). In-process caching is for data whose
   staleness is uniform and tolerable.

---

← Prev: [The search indexer job](07-the-search-indexer.md) ·
Next → **The health and metrics kit** *(not written yet)*
