---
title: "A cache that only remembers answers forwards every question about a thing that does not exist straight to the database, so negative caching stores the absence itself, and the design work is the sentinel, the short TTL, the race with creation, and keeping an attacker from filling the cache with nothing"
sidebar_label: "12 · Negative caching and penetration"
sidebar_position: 12
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-10-14. Negative caching and cache penetration are **common practice stated as
> mechanism**; the phase-3 research bank carries no primary authority for them and no sentence on
> this page is quoted. Not fetched, and therefore marked rather than asserted: the HTTP default
> cacheability of a `404` (RFC 9110 / RFC 9111), the null-value behaviour of Spring's cache
> abstraction and of Caffeine loaders. The Redis `nil` reply is the [Redis track's](../../../redis/README.md)
> territory. No hit-ratio, memory or latency figure appears. The defences in depth — validation, a
> Bloom filter, rate limits — continue in [12b](12b-bloom-filters-validation-and-enumeration.md).
> **No sandbox run.**

**A cache stores the answer to a question; when the answer is "there is no such thing", a naive
cache has nothing to store, so every repeat of the question reaches the database — and a request
stream made of keys that do not exist is a request stream the cache cannot absorb at all.** That is
*penetration*: requests that go through the cache to the origin every time, not because the entry
expired but because there never is an entry. It is the third cache-miss pathology and it is not the
stampede ([04](04-stampede-and-thundering-herd.md)): a stampede is many requests for one key that
*exists*; penetration is many requests for keys that *do not*, usually many different ones. It
arrives three ways — a bug (a client polling a deleted product), a crawler walking ids, and an
attacker enumerating them on purpose — and the interviewer is checking whether you cache the
absence, whether you know that caching it creates its own hazards, and what you put in front.

## What penetration looks like

Take the storefront's `GET /products/:id`. Cache-aside: read the cache, on a miss read the database,
write the cache. For an id that exists, the second request is a hit. For an id that does not:

```js
async function getProduct(id) {
  const hit = await redis.get(`product:${id}`);
  if (hit !== null) return JSON.parse(hit);

  const row = await db.oneOrNone('SELECT ... FROM products WHERE id = $1', [id]);
  if (row === null) return null;                 // nothing to cache, so nothing is cached
  await redis.set(`product:${id}`, JSON.stringify(row), 'EX', 300);
  return row;
}
```

The `return null` line is the hole. Each request for `product:999999999` reads the cache (miss), then
the database (empty), then returns, leaving the cache exactly as it found it. The next request
repeats all of it. The cache's hit ratio for these requests is zero by construction, and the
database sees the full request rate. Worse, a primary-key lookup on a missing id is cheap per
query, so the problem hides until the rate is high; at that point it is the database's *read
capacity* being spent on questions with no answer, and a request flood needs no hot key to do it.

| | Stampede | Penetration |
|---|---|---|
| keys involved | one (or a cohort) that **exists** | many, usually distinct, that **do not** exist |
| why the cache misses | entry expired or evicted | there is never an entry to expire |
| what coalescing does | removes the herd | nothing — each key has one reader |
| first defence | single-flight, early refresh | cache the absence; reject impossible keys |

## Negative caching: store the absence

Cache the *fact that the thing is missing*. The one practical difficulty is representation: a Redis
`GET` returns `nil` for a key that is absent, and returns it for a key you never wrote. You cannot
use "no value" to mean "cached as missing", because that is also what an uncached key looks like.
Store a **sentinel** that is distinguishable from every real value:

```js
const MISSING = JSON.stringify({ __missing: true });

async function getProduct(id) {
  const raw = await redis.get(`product:${id}`);
  if (raw !== null) {
    const v = JSON.parse(raw);
    return v.__missing ? null : v;               // a cached "not found" is a hit
  }
  const row = await db.oneOrNone('SELECT ... FROM products WHERE id = $1', [id]);
  if (row === null) {
    await redis.set(`product:${id}`, MISSING, 'EX', 30);   // short TTL, see below
    return null;
  }
  await redis.set(`product:${id}`, JSON.stringify(row), 'EX', 300);
  return row;
}
```

On the JVM the same problem has a framework-level face. A Spring `@Cacheable` method that returns
`null` is cached or not depending on the cache manager's null-value setting and the `unless`
expression; Redis-backed caches can be configured to refuse null values, and an in-process Caffeine
loader that returns `null` records no mapping. These behaviours are named from general knowledge and
were **not fetched for this page** — the safe design is to return an explicit `Optional`-like or
sentinel object from the loader so that "missing" is a value the cache stores on purpose rather than
a null it may silently drop.

### The negative TTL is shorter, and it is a product decision

A positive entry can live as long as the data is allowed to be stale. A negative entry lies in a
different way: it says *"this does not exist"* about something that may be created in the next
second. So the negative TTL is bounded by **how long a new thing may remain invisible after it is
created** — and for the storefront, "a new product is not findable by its id for thirty seconds" is
tolerable for the catalogue and not tolerable for an order id the customer was just redirected to.
Choose it per type. The sentinel TTL is a staleness budget for creation, the mirror of the
staleness budget for update.

### Creation must clear the negative entry

A short TTL is a backstop; the correct fix is that **the write that creates the thing overwrites
the negative entry**. The insert path, after commit, sets or deletes `product:{id}`. This is where the
page meets the invalidation problem proper (the **invalidation** page, *(not written yet)*), and it
has a genuine race:

1. Reader R misses the cache, reads the database, finds no row.
2. Writer W inserts the row and commits, then deletes (or overwrites) the cache key.
3. R, which read before the commit, now writes the negative sentinel.

The key now holds "missing" for a row that exists, until the negative TTL runs out. The window is the
time between R's database read and R's cache write — exactly the window a slow query widens. Defences:
a short negative TTL bounds the damage; a creation-time write of the *positive* value does not help
if R overwrites it, so use a conditional write — set the sentinel only `NX` (only if the key is
absent), so R cannot overwrite W's positive value:

```js
await redis.set(`product:${id}`, MISSING, 'EX', 30, 'NX');   // never clobber a real entry
```

`NX` closes the case where W wrote *after* R's read but *before* R's write. It does not close the
case where W's delete lands before R's write and nothing was written (the key is absent when R writes
the sentinel). That residual window is why the TTL stays short.

## Negative caching is also an attack surface

Caching absences converts a CPU-and-read-capacity attack into a **memory** attack. An attacker who
requests a million distinct non-existent ids now causes a million sentinel entries. Each is small,
but they occupy keyspace, they trigger eviction under `maxmemory`, and the entries evicted to make
room may be the real hot entries — so naive negative caching trades a database overload for a cache
that is full of nothing and a hit ratio that collapses for legitimate traffic. The controls:

- a short TTL, so the junk ages out quickly;
- rejecting impossible keys *before* the cache is consulted (validation, a Bloom filter — [12b](12b-bloom-filters-validation-and-enumeration.md));
- rate limiting the enumerating client ([rate limiting](../phase-2-request-path/07-rate-limiting.md));
- keeping negative entries from displacing positives — a separate cache or keyspace with its own
  memory bound, so the eviction policy for junk is not the eviction policy for the catalogue.

## Not found is not "failed"

The most expensive negative-caching bug is caching the wrong kind of nothing. The loader can return
nothing for very different reasons:

| Loader outcome | Cache it as a negative? |
|---|---|
| query succeeded, zero rows | yes — this is the absence |
| query timed out, connection refused, pool exhausted | **no** — the thing may exist |
| caller is not authorised to see it | not under the shared key (see the gotcha below) |
| upstream service returned 5xx | **no**, or only a very short "error" entry to shed load |

Treat the database exception and the empty result as different code paths; only the empty result
is an absence. If you do cache failures to shed load, use a separate sentinel with a TTL measured in
seconds so a recovered origin is not shadowed.

## HTTP negative caching

The same idea exists at the protocol layer: a CDN or browser can store a `404`. Whether a `404` is
stored without explicit freshness headers is a protocol default that this page's research did **not
fetch** — do not rely on it in either direction. Set `Cache-Control` explicitly on error responses:
a short `max-age` on a deliberate `404` for a deleted product keeps crawlers off the origin, and the
phase-2 [CDN page](../phase-2-request-path/05-cdns.md) already notes that `429` and `5xx` are not stored.
The full directive semantics belong to the **HTTP caching semantics** page *(not written yet)*.

## Gotchas

**★ Symptom: a database outage turns into a "product not found" outage that outlives it.**
Cause: the loader's `catch` returned `null`, and the caller cached null as an absence, so every
product requested during the failure was stored as missing. Fix: only a successful, empty result is a
negative; exceptions propagate (or write a separate, seconds-long error sentinel).

**★ Symptom: a product that was just created is "not found" for the length of the negative TTL.**
Cause: the negative entry written before the insert is still alive; creation did not touch it, or the
reader-writer race above re-wrote the sentinel after the creation cleared it. Fix: the create path
overwrites the key after commit, the sentinel is written with `NX`, and the negative TTL is chosen
as the longest invisibility the product tolerates.

**★ Symptom: memory and eviction rise during a crawl, and legitimate hit ratio falls.**
Cause: negative entries from a million distinct junk ids occupy the keyspace and evict real entries.
Fix: validate or Bloom-filter first ([12b](12b-bloom-filters-validation-and-enumeration.md)), keep the negative TTL
short, and bound negative entries separately.

**★ Symptom: a user sees "not found" for something they are allowed to see, or a user is told something exists.**
Cause: the negative (or positive) entry is keyed by resource id alone, but the answer depends on who
is asking — an unpublished draft visible to its author, a per-tenant catalogue. A "not found" computed for
an anonymous caller is served to the owner. Fix: the cache key includes every input the answer
depends on, or authorisation runs after a cache of the *existence* of the resource only.

**Symptom: the cache "works" in tests and still never hits for absent ids.**
Cause: the code uses `if (value)` or relies on `nil` meaning missing, so the sentinel is read back and
treated as a miss. Fix: compare against the sentinel explicitly; the test must read a cached absence
and assert no database call.

**Symptom: a Spring `@Cacheable` method hits the database every time for ids that do not exist.**
Cause: the method returns `null` and the cache configuration does not store null values. Fix: return
an explicit empty marker from the method, or configure the cache to accept nulls — verify the
setting for your cache manager rather than assume.

## Interview questions

**★ What is cache penetration, and how is it different from a stampede?**
Penetration is requests for keys that do not exist: there is never an entry, so the cache misses every
time and the origin sees the full rate, usually across many distinct keys. A stampede is many
concurrent requests for one key that exists but just left the cache. Coalescing fixes the second and
does nothing for the first, because each missing key has a single reader.

**★ How do you negative-cache safely?**
Store a sentinel distinguishable from "uncached"; cache only a successful empty result, never an error;
give it a short TTL tied to how long a new item may stay invisible; have the create path overwrite it
after commit; write the sentinel conditionally so it cannot clobber a real entry; and bound negative
entries so a flood of junk keys cannot evict real data.

**★ A user creates an order and is redirected to its page, which says "not found". Why?**
A request for that order id ran before the commit and cached the absence, or raced with the create so the
sentinel was written after the creation cleared the key. The negative TTL then hides the order. The fix
is not a shorter TTL alone: the create path must overwrite the entry, the sentinel must be written with
a conditional set, and for read-your-writes pages the response of the create can carry the object
so the redirect need not depend on the cache.

**Why can caching "not found" make an attack worse?**
It moves the cost from database reads to cache memory. A million distinct fake ids become a million cached
sentinels, which fill the keyspace and trigger evictions of legitimate hot entries. Negative caching
without validation or a filter in front is a trade, not a fix.

**What do you return and cache when the caller is not allowed to see the resource?**
That is not a plain absence. Either the key includes the caller's identity, or the cache holds only
the existence of the resource and authorisation is applied on every read afterward. Returning `404`
instead of `403` to avoid disclosing existence is a product choice that changes what an attacker can
learn from timing and from the cache.

{/* FOOTER */}
