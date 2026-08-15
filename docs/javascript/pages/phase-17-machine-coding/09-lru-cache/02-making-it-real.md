---
title: "09.2 · Making it real"
sidebar_label: "02 · Making it real"
sidebar_position: 2
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-15 against MDN — [`Map`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map), [`WeakMap`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/WeakMap), [`Date.now()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date/now), [`performance.now()`](https://developer.mozilla.org/en-US/docs/Web/API/Performance/now). Documentation-validated; **nothing was run**.

The cache in [09.1](./01-the-map-trick.md) is complete as an algorithm and incomplete as a
cache. **Four things separate the two**: expiry, what a "key" means, what happens when ten
callers miss at once, and admitting that a count-based capacity is a guess.

## TTL — recency is not freshness

An LRU evicts what has not been *used*; it says nothing about what has gone *stale*. A hot key
can sit at the front of the list for hours serving data that changed minutes ago.

```js
set(key, value, ttlMs = this.defaultTtl) {
  if (this.#map.has(key)) this.#map.delete(key);
  this.#map.set(key, { value, expires: ttlMs ? Date.now() + ttlMs : Infinity });
  if (this.#map.size > this.capacity) this.#map.delete(this.#map.keys().next().value);
}

get(key) {
  const entry = this.#map.get(key);
  if (!entry) return undefined;
  if (entry.expires <= Date.now()) { this.#map.delete(key); return undefined; }   // lazy expiry
  this.#map.delete(key); this.#map.set(key, entry);
  return entry.value;
}
```

**Expire lazily, on read.** A timer per entry costs a timer per entry and keeps the process
awake; a sweep is a scan. Checking on access is O(1) and pays only for keys anyone wants —
with the caveat that expired-but-unread entries keep occupying capacity until someone asks for
them or they are evicted for age.

⚠️ **`Date.now()` can move backwards** — a clock adjustment, an NTP correction — which makes
entries appear un-expired. `performance.now()` is monotonic and is the better clock when the
TTL matters and the values do not need to survive a reload.

## Keys

`Map` keys compare by **SameValueZero**, so two structurally identical objects are two
different keys. Cache keys therefore have to be derived:

```js
const keyOf = (url, params) => `${url}?${new URLSearchParams(params)}`;   // stable, readable
const keyOf = (args) => JSON.stringify(args);                             // ⚠️ order-sensitive
```

⚠️ **`JSON.stringify` is not a canonical key.** `{a:1,b:2}` and `{b:2,a:1}` stringify
differently, so the same request misses; `undefined` values vanish; `Date`s become strings.
Sort the keys, or build the key explicitly from the fields that matter — the same problem
`memoize` has (**11 · `memoize`** *(not written yet)*).

**When the key genuinely is an object**, a `WeakMap` keyed on identity is the right structure —
and it is a *different* cache: it has no capacity, because entries disappear when the key is
garbage collected. That is exactly what you want for "extra data attached to this object", and
useless for "the last 100 API responses".

## The stampede: ten callers, one miss

The bug that makes a cache actively harmful under load. Ten components ask for the same
uncached key in the same tick; all ten miss; all ten fetch.

```js
class AsyncCache {
  #cache = new LRUCache(100);
  #inflight = new Map();                            // key → the pending promise

  async get(key, load) {
    const hit = this.#cache.get(key);
    if (hit !== undefined) return hit;

    if (this.#inflight.has(key)) return this.#inflight.get(key);   // ← join the existing request

    const promise = load(key)
      .then((value) => { this.#cache.set(key, value); return value; })
      .finally(() => this.#inflight.delete(key));                  // ← always clear, even on failure

    this.#inflight.set(key, promise);
    return promise;
  }
}
```

**Cache the promise, not just the value.** The `#inflight` map is what turns ten requests into
one, and `finally` is what stops a failed load from being remembered forever as pending. Note
what is *not* cached: the rejection. A failed load leaves nothing behind, so the next caller
retries — which is usually right, and is a decision worth stating
([08 · Retry with backoff](../08-retry-backoff/README.md) for how that retry should behave).

**Stale-while-revalidate** is the same machinery with one more branch: serve the expired value
immediately, kick off a refresh, and let the next reader get the fresh one. It trades
correctness-now for latency, so it belongs to data where slightly-stale is acceptable.

## Capacity is a guess

`capacity: 100` is 100 *entries*, and entries are not the same size. A cache of 100 API
responses might hold a megabyte or a hundred.

- **Weight-based eviction** — give `set` a cost and evict until the total is under a budget.
  Better, and now you need a size function that is itself a guess.
- **Count-based is fine for uniform values** — memoised computations, parsed selectors, small
  DTOs.
- **Nothing here bounds memory absolutely.** A cache holds strong references, so anything in it
  is alive. That is the point, and it is also how a cache becomes a leak
  ([Phase 8 · 04 · Leaks](../../phase-8-modules-errors/04-leaks/README.md)).

**No numbers appear on this page** — nothing was measured, and a hit rate depends entirely on
the workload. Instrument hits and misses in your own application before tuning the size; a
cache with a low hit rate is pure overhead, and only the counters can tell you.

## LRU is not the only policy

| Policy | Evicts | Good for |
|---|---|---|
| **LRU** | least recently used | general purpose; temporal locality |
| **LFU** | least frequently used | stable hot sets; ⚠️ new entries starve, and old hot keys stay forever |
| **FIFO** | oldest inserted | trivial; ignores use entirely |
| **TTL only** | whatever expired | freshness matters more than size |
| **`WeakMap`** | when the key is collected | per-object metadata; no capacity concept |

LRU is the default for a reason: it is cheap, it adapts to changing access patterns, and it
degrades gracefully. LFU needs ageing to avoid cementing yesterday's hot keys in place.

## Before writing one at all

- **HTTP caching already exists.** `Cache-Control`, ETags and the browser cache handle
  responses better than an in-memory map, and survive a reload.
- **Your data layer probably has one.** TanStack Query, Apollo and SWR are caches with
  invalidation, deduplication and staleness rules already thought through.
- **Write your own** for in-process work the network layer cannot see: memoised computations,
  parsed structures, derived values — and in interviews.

## Gotchas

**Symptom:** The cache served data that was hours out of date
**Cause:** LRU tracks recency, not freshness.
**Fix:** Add a TTL and check it on read.

**Symptom:** Entries expired inconsistently
**Cause:** `Date.now()` moved backwards after a clock change.
**Fix:** `performance.now()` for in-process TTLs.

**Symptom:** The same request missed every time
**Cause:** The key was an object (identity comparison) or `JSON.stringify` with unstable key
order.
**Fix:** Build a canonical string key from the fields that matter.

**Symptom:** A cold start fired the same request ten times
**Cause:** No in-flight deduplication.
**Fix:** Cache the promise in an `#inflight` map and clear it in `finally`.

**Symptom:** One failure was cached and every later call failed instantly
**Cause:** The rejected promise was left in the in-flight map — or stored in the cache.
**Fix:** `finally` to delete it; decide deliberately whether failures are cacheable at all.

**Symptom:** Memory grew steadily with a "bounded" cache
**Cause:** 100 entries can be any size, and every entry is a strong reference.
**Fix:** Weight-based eviction, a smaller capacity, or a `WeakMap` if the key owns the value's
lifetime.

**Symptom:** The cache made things slower
**Cause:** A low hit rate — every access pays the bookkeeping and gets nothing back.
**Fix:** Count hits and misses; delete the cache if the ratio does not justify it.

## Interview questions

**★ What does an LRU cache not give you?**
Freshness. It evicts by recency of use, so a frequently-read key can serve stale data
indefinitely. Freshness needs a TTL, checked lazily on read.

**★ Ten callers ask for the same uncached key at once. What happens?**
Without in-flight deduplication, ten loads. Store the pending **promise** under the key so
later callers join it, and remove it in `finally` so a failure is not remembered as pending.

**★ How do you key a cache on function arguments?**
Derive a canonical string. `JSON.stringify` is tempting but is order-sensitive and drops
`undefined`, so equal-in-meaning arguments can miss. Build the key from the fields that matter,
or sort keys before stringifying.

**★ When is a `WeakMap` the right cache?**
When the key is an object and the entry should live exactly as long as that object —
per-object metadata. It has no capacity and no eviction policy, because collection handles
both. It is not a bounded response cache.

**Is capacity a good bound on memory?**
No. It bounds the *number* of entries, not their size, and every entry is a strong reference.
Weight-based eviction is closer to the truth if the values vary.

**LRU or LFU?**
LRU by default — cheap, adapts to changing patterns. LFU suits a stable hot set but needs
ageing, or old hot keys never leave and new entries starve.

---

← Prev [The `Map` trick](./01-the-map-trick.md) · [Topic index](./README.md)
