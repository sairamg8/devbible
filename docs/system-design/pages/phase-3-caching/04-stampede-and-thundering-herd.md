---
title: "A cache stampede is what happens when a hot key stops being served from the cache for the length of one recomputation and every request that arrives in that window goes to the origin, and the first line of defence is making exactly one of them go"
sidebar_label: "04 · Stampede and thundering herd"
sidebar_position: 4
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-10-14. Single-flight, request coalescing, lock-guarded recomputation and the
> arithmetic of the miss window are **common practice and mathematics, stated as mechanism rather
> than cited** — no RFC or vendor page defines them, and nothing on this page is quoted. The
> Redis `SET ... NX PX` shape is named as mechanism; the command semantics belong to the
> [Redis track](../../../redis/README.md). Spring's `@Cacheable(sync = true)`, Caffeine's per-key
> atomic loading and the `ConcurrentHashMap` bin-locking behaviour are named from general knowledge
> and were **not fetched**. The protocol-level answer (RFC 5861) is quoted in
> [04c](04c-early-refresh-jitter-and-serving-stale.md). **No sandbox run.**

**A stampede is not a cache problem, it is an origin problem that a cache was hiding: the cache
turns a hot key's thousand reads a second into zero origin reads, and the moment the entry is
gone, for as long as one recomputation takes, the origin is handed all thousand a second again.**
Nothing was wrong with the origin yesterday because the cache absorbed the traffic; the origin
was never sized for the traffic the cache absorbs. That is why the outage looks like it came from
nowhere — one popular key expired, the database saturated, the recomputation got slower because the
database was saturated, which lengthened the window, which admitted more requests. The interviewer
asking "what happens when this key expires?" is asking whether you know the cache is a
*load-shedding device with a hole in it*, and whether you can name the defences in order of what
they cost: coalesce the requests, guard the recomputation, refresh before expiry, desynchronise the
expiries, and warm what you know is coming. This page is the first, coalescing; the sequel pages are the lock ([04b](04b-the-distributed-lock-and-its-limits.md)),
early refresh, jitter and serve-stale ([04c](04c-early-refresh-jitter-and-serving-stale.md)), and warming ([04d](04d-warming-cold-starts-and-the-flash-sale.md)).

## Three ways to lose the entry, one way to die

The word "stampede" covers three different triggers. They need different defences, and a design
that names only the first has not understood the problem.

| Trigger | Why the entry is missing | What makes it a herd |
|---|---|---|
| **Expiry of a hot key** | its TTL elapsed | many concurrent readers of one key; recomputation takes real time |
| **Synchronised expiry** | many keys were written together with the same TTL (a deploy, a cache restart, a bulk load) | the keys die together, so the herd is spread over *many* keys and no per-key defence sees it |
| **Cold start** | the cache is empty — new cluster, flushed, failed over to an empty replica, a new region | every key is a miss at once; the working set is demanded before any of it is resident |

A fourth entry belongs here but is a different disease: **eviction of a hot key** under memory
pressure. The mechanics are in [Redis eviction](../../../redis/README.md); the consequence for
this page is that "the key was evicted" produces the same herd as "the key expired", so a defence
that only hooks TTL expiry (a scheduled refresh, say) does not cover it.

## The arithmetic of the miss window

Let `r` be the request rate for one key and `d` the time to recompute it. Between the moment the
entry disappears and the moment the first recomputation finishes and is written back, every request
for that key misses. Requests arrive at rate `r` for a duration `d`, so by Little's law the number
of concurrent recomputations in flight is about `r · d`. Two consequences:

1. **The herd size is the product, not either factor.** A key read a hundred times a second is no
   threat if it recomputes instantly; a slow aggregate read ten times a second can be. The dangerous
   keys are the ones where `r` is high *and* `d` is not small — the product-page assembly that joins
   six tables, the "top sellers" aggregate, the search facet counts.
2. **`d` is not a constant, and it is the term that feeds back.** `r · d` concurrent queries load
   the database; a loaded database answers more slowly; `d` grows; the window lengthens and admits
   more. Below some load the system recovers when the first recomputation lands. Above it, `d` grows
   faster than the window closes and no recomputation ever finishes. That positive feedback loop —
   not the original expiry — is the outage. Retries make it worse: a client timeout shorter than
   `d` re-issues the request, adding to `r` exactly while the system can least afford it (see
   [timeouts, retries and budgets](../phase-2-request-path/08-timeouts-retries-and-budgets.md)).

The storefront's flash-sale SKU is this arithmetic at its worst: `r` is the highest the site ever
sees, concentrated on one key, and the recomputation (current price, remaining stock, the
promotional banner) joins the very tables the checkout is writing to. The sale page is the page
where a stampede is most likely *and* where the origin is least able to absorb it.

## Defence 1: coalesce — one in-flight load per key

**Single-flight** (also called request coalescing, or dog-pile prevention) is the smallest change
that removes the herd: when a request misses, it checks whether a load for the same key is already
running. If so it waits for that load's result instead of starting its own. For `r · d` requests in
the window, one goes to the origin and the rest share its answer.

It needs no lock, no network and no coordination — only a map from key to *the pending
computation*, kept inside one process. In Node the pending computation is a promise, and a
promise can be awaited by any number of callers:

```js
const inflight = new Map();           // key -> Promise<value>

function singleFlight(key, load) {
  const existing = inflight.get(key);
  if (existing) return existing;      // join the load already running

  const p = Promise.resolve()
    .then(load)                       // always async: see the gotcha on sync throws
    .finally(() => inflight.delete(key));
  inflight.set(key, p);
  return p;
}

async function getProduct(id) {
  const key = `product:${id}`;
  const hit = await redis.get(key);
  if (hit !== null) return JSON.parse(hit);

  return singleFlight(key, async () => {
    const row = await db.query('SELECT ... FROM products WHERE id = $1', [id]);
    await redis.set(key, JSON.stringify(row), 'EX', 300);
    return row;
  });
}
```

Node's single-threaded event loop is what makes this safe without a mutex: the `get` followed by
the `set` into the map happens in one synchronous stretch, so two requests cannot both see "no
load in flight". The `.finally` removes the entry on success *and* on failure, so a failed load
does not poison the key forever.

The JVM has real threads, so the check-and-insert must be atomic. `ConcurrentHashMap.computeIfAbsent`
is the primitive, with a `CompletableFuture` as the shared pending value:

```java
private final ConcurrentHashMap<String, CompletableFuture<Product>> inflight =
    new ConcurrentHashMap<>();

public CompletableFuture<Product> load(String key, Supplier<Product> loader) {
    CompletableFuture<Product> mine = new CompletableFuture<>();
    CompletableFuture<Product> existing = inflight.putIfAbsent(key, mine);
    if (existing != null) return existing;            // someone else is loading

    CompletableFuture.supplyAsync(loader, executor).whenComplete((v, ex) -> {
        inflight.remove(key, mine);                   // remove only my own entry
        if (ex != null) mine.completeExceptionally(ex); else mine.complete(v);
    });
    return mine;
}
```

`putIfAbsent` rather than `computeIfAbsent` with the load inside is deliberate: running a slow,
blocking load inside `computeIfAbsent` holds the map's bin lock for the whole load and blocks
unrelated keys that hash to the same bin, and the `ConcurrentHashMap` contract forbids the
mapping function from modifying the map. The pattern above publishes the future first and does
the work outside the map. In practice most JVM services do not hand-roll this: a Caffeine
`LoadingCache` loads a missing key atomically per key, and Spring's `@Cacheable(sync = true)` asks
the cache provider to serialise the load for a key (both named from general knowledge — **not
fetched for this page**; confirm the provider honours `sync` before depending on it).

### What single-flight does and does not buy

- **It is per process.** With `N` application instances, a hot key's miss sends up to `N`
  requests to the origin, one per instance — not one in total. At two instances that is invisible;
  at two hundred pods it is a herd of two hundred, each running the expensive query. Per-process
  coalescing is the cheap first defence, not the whole answer.
- **It coalesces the origin load, not the cache read.** Waiters still pay a round trip to the
  cache before they find out the key is missing.
- **Every waiter inherits the loader's fate.** One load fails, every joined request fails with it
  (usually what you want — a hundred retries of a failing query is the stampede again) and a slow
  load makes every joined request slow. Joined requests have no timeout of their own unless you add one.


## Where coalescing stops

Single-flight reacts to the miss and is bounded by the process. It shrinks the herd from `r · d`
to one *per instance*, but that one still waits `d`, and every joined request waits with it. To get
one load across the fleet, take a lock in the shared store: [04b](04b-the-distributed-lock-and-its-limits.md).
To stop relying on expiry as the trigger, and to deal with the many-keys triggers that coalescing
never sees, see [04c](04c-early-refresh-jitter-and-serving-stale.md) and [04d](04d-warming-cold-starts-and-the-flash-sale.md).

## Gotchas

**★ Symptom: a rejected promise that never clears — every later request for the key fails instantly.**
Cause: the in-flight map entry is deleted in a `finally` that ran before the entry was inserted. A
naive version wraps the loader in an `async` function with `try/finally`; a loader that throws before its
first `await` runs that `finally` synchronously, so `inflight.delete(key)` fires first, then `inflight.set(key, p)` stores an already-settled, rejected
promise that nothing ever removes. Fix: start the load on a later tick — `Promise.resolve().then(load)`
as above — so insertion always precedes cleanup, and clean up with `.finally` on the *stored* promise.

**★ Symptom: a user sees another user's data after single-flight was added.**
Cause: the coalescing key omitted something the result depends on — the user id, the locale, the
price list, the A/B bucket. Joined requests share one computed value, so whoever loaded first
decides what everyone gets. Fix: the single-flight key must be exactly the cache key, and the cache
key must contain every input to the result. If the value is personalised, do not coalesce across
users at all.

**★ Symptom: one client aborts and a hundred other requests fail with "aborted".**
Cause: the load was started with the first caller's `AbortSignal` or request-scoped timeout, and the
joined requests share the shared promise. Fix: the shared load owns its own lifetime and timeout,
independent of any caller; each caller applies its own timeout to *waiting* for it
(`Promise.race` against a timer) without cancelling the load.


**Symptom: per-process single-flight "didn't work" in the load test.**
Cause: the test ran many instances; the origin saw one load per instance. Nothing is broken — that is
the stated limit. Fix: put the lock (or an origin-side shield or request collapsing at the edge, as
in [CDNs](../phase-2-request-path/05-cdns.md)) in front of the per-instance map.


**Symptom: memory climbs in the in-flight map.**
Cause: entries are added on a miss and removed only on completion; a load that never settles
(a socket with no timeout) pins the entry and every waiter forever. Fix: every shared load gets its
own hard timeout, and the map is observable (its size is a gauge).


## Interview questions

**★ A popular product page's cache entry expires and the database falls over. Walk me through why, and what you change.**
Name the window first: from the entry's disappearance until the first recomputation is written back,
every request misses, so about `r · d` recomputations run concurrently. The cache was hiding a load
the database was never sized for, and the extra load slows the recomputation, lengthening the window — a
feedback loop. The fix is layered: coalesce misses per key inside each instance, take a short
lease-based lock so only one instance recomputes, then stop relying on expiry as the trigger at all
(early refresh, serve-stale — [04c](04c-early-refresh-jitter-and-serving-stale.md)). Say the order and
say why: the first two react to a miss, the later ones prevent it.

**★ What is single-flight, and why is it not enough on its own?**
Concurrent requests for a missing key share one in-flight load instead of each starting their own.
It is correct and cheap, but it lives in one process: `N` instances still send `N` loads, and it
does nothing for many different keys expiring together, where each key has a single reader. It also
makes every joined request depend on one load's latency and failure.


{/* FOOTER */}
