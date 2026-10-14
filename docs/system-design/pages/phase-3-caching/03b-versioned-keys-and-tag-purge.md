---
title: "Versioned keys sidestep invalidation by never editing an entry — the name changes and the old one is left to expire — and tag-based purge solves the opposite problem of invalidating a set you cannot enumerate, at the cost of a second index that must itself be kept correct"
sidebar_label: "03b · Versioned keys and tag purge"
sidebar_position: 3.1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-10-14 against [RFC 8246](https://www.rfc-editor.org/rfc/rfc8246.html) §2
> (`immutable`), [RFC 9111](https://www.rfc-editor.org/rfc/rfc9111.html) §4.1 (`Vary`) and the
> [Redis key-eviction documentation](https://redis.io/docs/latest/develop/reference/eviction/),
> quoted below. Versioned keys, generation counters, tag sets and CDN surrogate-key purging are
> **common practice stated as mechanism** — CDN vendors differ in header names, limits and purge
> latency, none of which is stated here. **No sandbox run.**

**There are two ways to make a cached value stop being served that involve no deletion of the value itself: change the name that readers look it up under, so the old entry is simply never asked for again; or record which entries depend on which tag, so one operation can find and remove all of them.** The first is versioned keys, and it turns invalidation into an atomic pointer swap. The second is tag-based purge, and it is the answer to "invalidate every page that mentions product 42" when the pages are not enumerable. Both have a cost that is easy to miss: versioning leaves garbage that only eviction or TTL collects, and tagging maintains an index whose consistency with the cache is exactly as hard as the problem it was meant to solve.

Basic mechanisms (TTL, delete on write, what an invalidation must reach) are in [03](03-invalidation.md). The storefront's hard case, which uses both, is in [03c](03c-price-versus-description-the-hard-case.md).

## Versioned keys

Include a version in the key. When the data changes, readers move to a new key; the old one is never touched, never raced and never "invalidated".

### Content-addressed versions: immutable assets

The cleanest case is a key derived from the content itself: `app.4f3a9c.js`, where `4f3a9c` is a hash of the file. A changed file has a different name, so a cached copy under the old name can never be wrong. The cache can keep it for a very long time. HTTP has a directive for exactly this, and its definition is precise:

> *"When present in an HTTP response, the immutable Cache-Control extension indicates that the origin server will not update the representation of that resource during the freshness lifetime of the response."* — RFC 8246 §2

> *"Clients SHOULD NOT issue a conditional request during the response's freshness lifetime (e.g., upon a reload) unless explicitly overridden by the user (e.g., a force reload)."* — RFC 8246 §2

> *"The immutable extension only applies during the freshness lifetime of the stored response. Stale responses SHOULD be revalidated as they normally would be in the absence of the immutable extension."* — RFC 8246 §2

The hashed-filename pattern is common practice; the *meaning* of the directive is what is quoted. The consequence worth saying aloud: with content addressing the cache needs no purge, because the thing that changes is the reference — and the reference lives in a small mutable document (`index.html`, or a manifest) with a short lifetime or revalidation. **The mutable pointer is the only thing with an invalidation problem, and it is small.** The storefront's product images work the same way: `/img/9f2c…/front.webp` is cached for as long as the CDN and browsers will hold it, and "replacing the image" means publishing a new hash and updating the product row.

### Generation counters: versioning a set

A version can also be a number the system increments. Instead of invalidating every cached listing page for the shoes category, hold a counter and put it in the key:

```js
async function categoryKey(slug, page) {
  const gen = (await redis.get(`gen:category:${slug}`)) ?? '0';
  return `list:${slug}:g${gen}:p${page}`;
}

async function bumpCategory(slug) {
  await redis.incr(`gen:category:${slug}`);   // every cached page for the category is now unreachable
}
```

One `INCR` makes every page of the category (however many pages, filters and sort orders were cached) unreachable at once. There is no enumeration, no scan, no list of keys. Properties:

- **Atomic from the reader's point of view.** A reader sees either all-old or all-new for a given read, because the key it asks for is computed once from one read of the counter.
- **The cost moves to the read path.** Each read pays an extra round trip for the counter (or an in-process copy refreshed on a short interval, which reintroduces a bounded staleness for the counter itself — the bound on staleness has moved, not gone).
- **Garbage is left behind.** The old generation's entries are no longer read, but they still occupy memory until their TTL passes or the eviction policy removes them. A versioned-key scheme without a TTL on every key is a slow memory leak in a place that happens to be called a cache. Eviction will reclaim them eventually; Redis describes its approach as sampling: *"It samples a small number of keys at random and then evicts the ones with the longest time since last access."* Dead generations are exactly the keys with the longest time since last access, so an LRU-style policy treats them correctly; a policy blind to recency does not.
- **The counter is a hot key.** Every read of a category reads one counter. At storefront scale that is one key receiving every category read — a read-mostly hot key that the in-process copy or replicas can serve (the skew topic, **06 Hot keys and skew** *(not written yet)*).
- **The counter must not go backwards.** If the counter's key is evicted or flushed, it restarts at zero and old generations come back to life with stale data. Give the counter no TTL, keep it out of the evictable keyspace, or derive the version from something monotonic and durable (the row's update timestamp or a database sequence).

### Row versions: versioning the entity

If the source row has a version (an `updated_at` or an integer `version`), put it in the key or the value. This gives version-aware reads and, more importantly, **version-checked writes** — see [03c](03c-price-versus-description-the-hard-case.md) — because a writer can compare versions and refuse to replace a newer value with an older one.

### What versioning cannot do

- **The pointer still needs an answer.** To look up `list:shoes:g7:p1` you need to know the generation is 7. Somewhere there is a mutable thing, and its freshness is a TTL or an invalidation problem. Versioning shrinks that mutable thing to one small value; it does not remove it.
- **It does not help with derived data the cache does not index.** A page that embeds product titles has no generation counter for "product 42"; you either include per-entity versions of everything it shows in its key (expensive, and the key gets long) or tag it.
- **It cannot reach copies you did not name.** A browser holding `/products/42` has no way to learn that generation 8 exists. For a URL you control, the response *is* the pointer, which is why mutable URLs get short lifetimes or revalidation and immutable ones get the long lifetime.

## Tag-based purge

A tag is a label attached to cached entries so that they can be found by what they depend on. The listing page for shoes page 1 is tagged `category:shoes`, `product:42`, `product:57`, `product:91`. A change to product 57 purges everything tagged `product:57`.

CDNs implement this as **surrogate keys**: the origin sends a response header listing the tags, the CDN indexes the object under each, and a purge-by-tag API call removes everything carrying a tag. Header names, per-response tag limits and purge propagation time differ by vendor and are not stated here; read the vendor's documentation.

In an application cache you build the index yourself, typically with a Redis set per tag:

```js
async function setTagged(key, value, ttl, tags) {
  const tx = redis.multi().set(key, JSON.stringify(value), 'EX', ttl);
  for (const t of tags) {
    tx.sadd(`tag:${t}`, key);
    tx.expire(`tag:${t}`, ttl + 3600);          // the tag set must outlive its members
  }
  await tx.exec();
}

async function purgeTag(tag) {
  const keys = await redis.smembers(`tag:${tag}`);
  if (keys.length) await redis.del(...keys, `tag:${tag}`);
}
```

What this costs, which is the actual content:

- **Two structures to keep in step.** The key and its membership in the tag sets are separate writes. They sit in one `MULTI` above, but on a cluster the tag set and the key hash to different slots, and a multi-key transaction across slots is not available; the writes become independent and a crash between them leaves an entry that is in the cache but not in its tag (never purged) or in the tag but not the cache (harmless).
- **The tag set outlives or undershoots its members.** If the set expires before a member, that member can no longer be purged by tag; if it outlives, it holds dangling keys. Give the tag set a longer lifetime than any member and tolerate dangling entries.
- **Large tags are expensive.** A tag like `category:all` accumulates every entry; `SMEMBERS` on a large set is a blocking, linear operation on a single-threaded server, and the `DEL` of thousands of keys is as well. Page the purge (`SSCAN` with batched deletes, or `UNLINK`), or avoid wide tags and use a generation counter for wide sets.
- **A purge is itself an invalidation that can be lost** — see the reliability discussion in [03](03-invalidation.md). The TTL remains the bound.
- **The write path must know which tags apply.** Computing the tag list is the dependency analysis made explicit: when the listing query is changed to include ratings, its tags must now include review changes. A missed tag is a stale page that never gets purged; it is the same "forgotten invalidation" bug, relocated to where the page is built.

### Choosing between generation counters and tags

| | Generation counter | Tag set |
|---|---|---|
| Invalidates | everything under a name prefix, all at once | exactly the entries carrying the tag |
| Index to maintain | one number | a set per tag, per member |
| Granularity | coarse (the whole category) | fine (pages containing product 57) |
| Garbage | dead generations until TTL or eviction | none after the purge |
| Read cost | one extra counter read | none |
| Best for | wide sets, bulk edits, "everything changed" | narrow, precise dependencies |

A common split in a storefront: tags (or surrogate keys) at the CDN for product pages, where a change to one product must purge the one page and its listing; a generation counter for category listings in Redis, where "re-sort the whole category" is the typical event.

## Varying the key correctly

A versioned or tagged key is still a key, and a key too narrow serves one user another's data. RFC 9111 states the HTTP form of the rule for the secondary key: *"…the cache MUST NOT use that stored response without revalidation unless all the presented request header fields nominated by that Vary field value match those fields in the original request."* In an application cache the equivalent is that every input that changes the response — currency, locale, a feature flag, the user's tier — must be in the key or the entry must not be shared. Each input added multiplies the entries for one logical object; that is key cardinality, and it is a cost of every dimension you vary on.

## Gotchas

**★ Symptom: after a Redis restart or flush, old stale pages reappear.** Cause: the generation counter was lost and restarted at zero, so keys of a previous generation became reachable again. Fix: keep the counter durable and out of the evictable data, or derive the generation from a monotonic source such as a database sequence or the row's timestamp, and never reuse a version value.

**★ Symptom: memory grows although the cache hit ratio is fine.** Cause: versioned keys with no TTL — dead generations accumulate and only the eviction policy removes them, perhaps never if the instance runs `noeviction`. Fix: a TTL on every versioned key, at least as long as the longest time a reader could still hold the old version, and a recency-aware eviction policy.

**★ Symptom: a tag purge leaves some pages stale permanently.** Cause: the tag membership write and the key write were not atomic (different cluster slots, or a crash between them), or the tag set expired before the entry. Fix: write the membership before the entry, give the tag set a longer lifetime than its members, keep a TTL on the entries as the bound, and monitor purge-miss cases by sampling.

**★ Symptom: a purge call blocks Redis and latency rises for unrelated requests.** Cause: `SMEMBERS` plus a multi-thousand-key `DEL` on a large tag runs in the server's single command-execution thread. Fix: iterate the tag with `SSCAN`, delete in batches with `UNLINK`, split wide tags into narrower ones, or use a generation counter for wide sets.

**★ Symptom: a purge removes the entries and the next requests all miss, overloading the source.** Cause: purging a hot tag empties every entry at once; the refill is a stampede. Fix: serve stale while refilling, coalesce loads, or prefer a version bump where the new entry is produced by the writer before readers are switched to it (build, then swap the pointer).

**Symptom: the browser keeps serving old HTML after a deploy with hashed assets.** Cause: `index.html` was given a long freshness lifetime, so the one mutable pointer was cached like an immutable file. Fix: long `immutable` lifetime for hashed assets only; short lifetime or revalidation for the document that names them.

**Symptom: one user's price shows up for another.** Cause: a dimension (currency, tier, a personalisation flag) that changes the response is missing from the key. Fix: include every response-affecting input in the key, or do not cache the response across users.

**Symptom: the "version" in the key is the application release number, and every deploy empties the cache.** Cause: using a coarse version to dodge schema compatibility concerns. Fix: version the *schema of the cached value* separately from releases, so a deploy that did not change the shape keeps its cache, and one that did changes only the affected prefix.

**Symptom: the extra counter read per request shows up as the hottest key in the cluster.** Cause: every request reads `gen:category:shoes`. Fix: hold the counter in process memory refreshed on a short interval and accept that interval as additional staleness, or replicate that key's reads.

## Interview questions

**★ What is a versioned key and what problem does it solve?**
A key that includes a version, so changing the data means a new key rather than editing an entry. It removes the race between invalidator and repopulator, because nothing is deleted or overwritten; readers move atomically when the pointer changes. For content-addressed assets it removes invalidation entirely and lets the entry live at a very long lifetime. The residual problem is the pointer, which is small, and the garbage, which a TTL or eviction collects.

**★ How would you invalidate every cached listing page for a category when one product changes, when you cannot enumerate the pages?**
Two options. Keep a generation counter per category in the key and increment it; every page is unreachable at once, and dead generations expire. Or tag each page with the products and category it contains and purge by tag, which needs a maintained index. The counter is cheaper and coarser; tags are precise and need care. At the CDN, surrogate keys are the tag mechanism.

**★ What are the costs of tag-based invalidation?**
An index of tag to entries that must stay consistent with the cache, with non-atomic updates across cluster slots; wide tags that make a purge a long blocking operation; the obligation for the write path to compute the right tags, so a missed dependency is a permanently stale entry; and a purge that empties hot entries and causes a refill stampede.

**★ Explain the cache strategy for static assets and for the HTML that references them.**
Content-hash the asset filenames and serve them with a very long lifetime and `immutable`, since RFC 8246 defines it as the origin's statement that it will not update the representation during its freshness lifetime, so clients should not revalidate on reload. The HTML that references them is the mutable pointer, so it gets a short lifetime or must be revalidated. A deploy then needs no purge: new HTML names new files, and old files fall out of use.

**Why is it dangerous if the generation counter is evictable?**
If it is evicted it reads as absent and defaults to zero, resurrecting every entry from an old generation that has not yet expired, and these are by definition stale. Counters must be durable or monotonic and must never be reused.

**What is the difference between versioning the key and versioning the value?**
Versioning the key makes old entries unreachable and requires a pointer lookup. Versioning the value keeps one key and carries a version inside it, so that a writer can compare versions and refuse to overwrite a newer value. The first is for invalidating without deleting; the second is for ordering concurrent writers.

**Why does a purge not reach the browser?**
A purge is an operation on caches you run. A private cache on a user's device has no channel for the operator to reach it, so the only control is the freshness lifetime you gave it, or changing the URL so the cached object is simply not requested. This is the main reason mutable resources are given short lifetimes.

**Where would you use tags and where counters in the storefront?**
Tags or surrogate keys on the CDN for product detail pages, where one product's change must purge that page and the few listings that show it. A generation counter for the category listing cache in Redis, where bulk re-sorts or promotions change the whole set. Content hashes for images and bundles.

{/* FOOTER */}
