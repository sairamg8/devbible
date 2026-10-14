---
title: "Cold starts and synchronised expiries have no hot key to coalesce, so the defence is to fill the cache before the traffic arrives, to bound what the origin will accept when it does anyway, and to read the signals that tell a stampede from a slow query"
sidebar_label: "04d · Warming, cold starts and the flash sale"
sidebar_position: 4.3
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-10-14. Cache warming, readiness gating, bounded-concurrency loading and load
> shedding are **common practice stated as mechanism**; the research bank carries no authority for
> them and nothing here is quoted. Spring Boot's readiness states and `ApplicationRunner` ordering,
> and the `Retry-After` header, are named from general knowledge and were **not fetched** — confirm
> against the version you run. No hit-ratio, latency or capacity figure appears. Continues
> [04c](04c-early-refresh-jitter-and-serving-stale.md). **No sandbox run.**

**Single-flight and early refresh protect a hot key; they do nothing when the cache is empty and the
working set is demanded all at once, so the defences for a cold start are to fill the cache before
admitting traffic, to ration what reaches the origin while it fills, and to make the miss path
fail fast rather than queue.** The interviewer for a flash-sale question is checking that you know
the sale page's cache entry is the single most dangerous object in the system, that you can name
what you do the hour before it, and that you have a plan for the minute the plan fails.

## Warming: fill it before the traffic is allowed in

Warming is loading a known set of keys into the cache *before* they are asked for. It works only
when you know the set, and you usually do:

| Source of the list | Good for | Caveat |
|---|---|---|
| a business list — the flash-sale SKUs, the homepage carousel | events that are scheduled | someone must remember to add the SKU |
| top-N from access logs or analytics | the steady hot set after a restart | the list is yesterday's; it lags a shift in demand |
| a replayed sample of recent keys from a live instance | a new instance or region | needs an export path; copies stale-ish data |

Warming is a **bulk load against the origin**, so it can cause the stampede it exists to prevent.
Bound it: a fixed concurrency, a rate, and jittered TTLs on what it writes.

```js
async function warm(keys, loadAndStore, { concurrency = 8 } = {}) {
  const queue = [...keys];
  const worker = async () => {
    for (let k = queue.shift(); k !== undefined; k = queue.shift()) {
      try { await loadAndStore(k); }              // writes with jittered TTL (04c)
      catch (err) { log.warn({ k, err }, 'warm failed'); }   // one bad key must not stop the rest
    }
  };
  await Promise.all(Array.from({ length: concurrency }, worker));
}
```

In Spring Boot the natural hook is an `ApplicationRunner`, which runs before the application is
reported ready, so the instance joins the load balancer already warm. Pair it with the readiness
probe so the platform does not route to a half-warmed pod, and give the warmer a deadline — a
warmer that cannot finish must let the instance in anyway (cold is better than never starting).

```java
@Component
class CacheWarmer implements ApplicationRunner {
    private final ProductRepository products;
    private final Cache<String, Product> cache;     // an in-process cache, e.g. Caffeine

    @Override
    public void run(ApplicationArguments args) {
        products.findHotSkus(Limit.of(500)).forEach(p -> cache.put("product:" + p.id(), p));
    }
}
```

The in-process cache of an instance is cold by construction every time that instance starts:
a deploy, a crash loop, and — the one people forget — **autoscaling**. A scale-out triggered by
a traffic surge adds instances whose in-process caches are empty precisely when the surge is
asking for the hot keys. Each new pod's first requests all miss. Warm on startup, or admit the pod
gradually.

## When the shared cache itself is cold

A restarted cache, a failover to a replica without the data, a flush, or a new region are all the
same event at the fleet level: every key is a miss. Mitigations, in order of cost:

1. **Do not let it be empty.** Persistence or a replica that actually holds the data is a
   design choice with trade-offs the [Redis track](../../../redis/README.md) covers; for a pure
   cache the decision is whether a cold start is survivable *without* it.
2. **Warm from the known list before cutting traffic over** to the new cache or region, rather
   than after.
3. **Admit traffic gradually.** Route a fraction first (weighted routing at the load balancer or
   gateway — [reverse proxies and gateways](../phase-2-request-path/03-reverse-proxies-and-api-gateways.md))
   and widen as the hit rate recovers. The fraction passing is the fraction of keys that miss.
4. **Bound the origin anyway**, below.

## The flash-sale SKU, end to end

Treat the sale SKU's product page as three different caches with different rules:

- **The static shell** (title, images, description) is cacheable at the CDN with a long TTL and
  `stale-while-revalidate` ([04c](04c-early-refresh-jitter-and-serving-stale.md)); the origin sees
  at most one revalidation per edge per window, and the shield collapses those
  ([CDNs](../phase-2-request-path/05-cdns.md)).
- **The price and the promotional state** change at known times. Write them into the cache *at*
  those times (overwrite, never delete) and warm them the hour before. Use logical expiry with a long
  grace so a refresh failure serves the last known price rather than an error.
- **The remaining stock** is not a cacheable fact the way the price is — it is a counter that
  changes on every purchase. Showing a slightly stale "12 left" is a product decision; *deciding
  whether an order can be placed* must not read the cache at all. The authoritative count lives
  with the order path, and the cached figure is a hint.

On the day, the sequence is: warmed entry, long grace, overwrite on change, per-instance
single-flight, a lock for the fleet, and a bound on the origin for the case where all of that
fails.

## Bounding the origin: the last line

Every defence above assumes the origin survives the misses that still happen. Put the limit
*on the miss path itself*, so that cache failure degrades the response instead of the database.

```js
let inFlightLoads = 0;
const MAX_LOADS = 32;                       // sized from what the database tolerates

async function boundedLoad(key, load) {
  if (inFlightLoads >= MAX_LOADS) {
    const stale = await readStale(key);     // any copy, however old
    if (stale !== null) return stale;
    throw new ShedError('origin busy');     // mapped to 503 + Retry-After
  }
  inFlightLoads++;
  try { return await withTimeout(load(), 2000); }
  finally { inFlightLoads--; }
}
```

This is a **bulkhead** on cache-miss work: beyond the limit a request gets a stale copy or a
fast refusal, not a queue behind a saturated database. Two companion rules:

- **A load timeout shorter than the herd's patience.** A load with no timeout holds a connection
  indefinitely; the shared single-flight promise holds every joined request with it.
- **Shed with a signal clients respect.** A `503` with `Retry-After` lets well-behaved clients
  back off; one without it invites immediate retry. The broader treatment is in
  [rate limiting](../phase-2-request-path/07-rate-limiting.md), [retries and budgets](../phase-2-request-path/08-timeouts-retries-and-budgets.md)
  and [degrading instead of falling over](../phase-2-request-path/18e-degrading-instead-of-falling-over.md).

## Telling a stampede from a slow query

The signature is a *step*, not a drift: origin query rate jumps at the instant a key or a batch of
keys disappears, the cache miss rate for that key spikes, the number of concurrent loads for one
key climbs well above one, and database connection use saturates while the cache itself is idle.
Instrument what lets you see it: misses per key (or per key prefix), the in-flight loads gauge,
the count of requests coalesced onto each load, age of the served entry, and loader duration (`δ`).
The hit ratio's definition and the Redis counters to compute it belong to the **measuring a cache**
page *(not written yet)*; an aggregate hit ratio can look healthy while one hot key is the whole
outage, which is why per-key miss counts matter.

## Which defence for which trigger

| Trigger | Coalesce | Lock | Early refresh / stale | Jitter | Warm | Bound origin |
|---|---|---|---|---|---|---|
| hot key expires | yes | yes, for `N` instances | **best** | — | — | backstop |
| many keys expire together | no help | no help | partly | **best** | — | backstop |
| cold cache / new region | no help | no help | — | at the warmer | **best** | **essential** |
| hot key *evicted* | yes | yes | yes | — | — | backstop |
| origin slow, not stampede | would mask it | would mask it | stale hides it | — | — | timeouts, bulkhead |

## Gotchas

**★ Symptom: the warmer stampeded the database before the sale started.**
Cause: warming issued thousands of loads at full concurrency, which is a bulk read against the
origin. Fix: fixed concurrency and a rate on the warmer, run it off-peak, and write jittered TTLs.

**★ Symptom: all warmed keys expire at the same instant an hour later.**
Cause: the warmer wrote a uniform TTL, so it manufactured the synchronised expiry of
[04c](04c-early-refresh-jitter-and-serving-stale.md). Fix: jitter in the warmer, or use logical
expiry so the keys refresh on read instead of dying.

**★ Symptom: autoscaling made the outage worse.**
Cause: new pods have cold in-process caches and join exactly when traffic peaks; their first
requests all miss and load the same origin that triggered the scale-out. Fix: warm on startup behind
the readiness gate, bring pods in with slow-start weighting, and scale on a signal early enough that
the pod is warm before it is needed.

**★ Symptom: a rolling deploy flushes the cache and the origin spikes every release.**
Cause: in-process caches are lost per pod as pods restart, and a fast roll replaces the whole fleet
in a short span. Fix: roll slowly enough to rewarm, warm on start, and keep the hot set in a shared
cache that survives the roll.

**Symptom: the warmer blocks startup and a deploy hangs.**
Cause: readiness depends on a warmer that cannot finish (origin down, bad key). Fix: a deadline on
warming after which the instance reports ready anyway, and per-key error handling as above.

**Symptom: the sale page serves a price that was correct an hour ago.**
Cause: warming loaded a snapshot, then the price changed and no write path overwrote the key.
Fix: price changes are write events that update the cache entry; warming is a head start, not the
update mechanism.

**Symptom: the 503 shed response is cached and the product stays "unavailable" after recovery.**
Cause: an error response was stored by an intermediary or by the application cache with a TTL. Fix:
never store the shed response in the object cache, mark it uncacheable at the HTTP layer, and if you
must cache failures give them a very short TTL — see [negative caching](12-negative-caching-and-penetration.md).

## Interview questions

**★ Design the cache for the flash-sale product page.**
Split it. The static shell goes to the CDN with a long TTL and stale-while-revalidate behind a
shield. The price and promo state are warmed the hour before, overwritten at the scheduled change, and
held with logical expiry and a long grace so a failed refresh serves the last known value. The
remaining-stock figure is a hint — the order path owns the authoritative count and never reads the
cache to decide whether to sell. On the miss path: per-instance single-flight, a fleet lock, and a
bulkhead that sheds with `Retry-After` or serves stale. Then name what you would watch.

**★ The cache cluster failed over to an empty replica. What happens and what do you do?**
Every key is a miss, so origin load is the sum over the whole working set and there is no hot key to
coalesce. Reduce what reaches the origin: serve traffic gradually, warm from the known hot list,
and rely on the miss-path bulkhead so the database gets a bounded load while the cache refills. In
the design review, ask whether the failover target should have held the data.

**★ How does autoscaling interact with caching?**
New instances start with empty in-process caches exactly when load is highest, so scale-out adds
miss traffic to the origin. Warm on startup, gate readiness on a bounded warmup, and use slow-start
or gradual weights. A shared cache layer reduces the effect because new pods read warm entries.

**How do you tell a stampede from a slow query?**
A stampede is a step: origin QPS rises at the instant one key or a cohort of keys disappears, with
concurrent loads for that key well above one while the cache is idle. A slow query is a drift in
loader duration without the miss-rate spike. Per-key miss counts and an in-flight-loads gauge
separate them; an aggregate hit ratio does not.

**What is the difference between a bulkhead on the miss path and a rate limiter?**
A rate limiter bounds requests per time by caller or route. A bulkhead bounds the *concurrent* work
the miss path may place on one dependency, whoever asks, which is the quantity the database is
actually sensitive to. Both shed; the bulkhead's fallback can be a stale copy.

{/* FOOTER */}
