---
title: "`revalidateTag()` invalidates the instance it ran on and no others — so on any deployment with more than one server the default behaviour is that some users see the new content and some do not, and closing that gap is infrastructure you provide rather than a flag you set"
sidebar_label: "05h · A shared cache across instances"
sidebar_position: 61
description: "Why revalidation events are local by default, the two handler hooks that make tags propagate, the consistency model Next.js actually promises, and the HTML/RSC pairing that makes a partially-shared cache worse than none."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-05 against the Next.js 16.3.4 documentation — [How revalidation works](https://nextjs.org/docs/app/guides/how-revalidation-works), [`cacheHandlers`](https://nextjs.org/docs/app/api-reference/config/next-config-js/cacheHandlers), [`use cache: remote`](https://nextjs.org/docs/app/api-reference/directives/use-cache-remote), [Deploying to Platforms](https://nextjs.org/docs/app/guides/deploying-to-platforms) — and the Vercel [Functions API reference](https://vercel.com/docs/functions/functions-api-reference/vercel-functions-package) for the Runtime Cache figures.
> Documentation-verified; **no sandbox run**.
> Target: **Next.js 16.3.4** · React 19.2.8 · Node 24.20.0.

**This is the page [03e](03e-pull-sources-and-back-pressure.md) pointed at, and it is the same problem that page has with in-memory subscriber lists, arriving in the cache layer. A `revalidateTag()` call is not a broadcast. The documentation is unambiguous: *"Calling `revalidateTag()` on instance A only invalidates the cache on that instance."* On a single server that is invisible and correct. On any deployment with more than one — which includes every autoscaling platform, every container replica set, and every serverless host — it means a mutation makes the content fresh for a fraction of your users, and the fraction is whatever share of traffic happens to land on the instance that handled the write. Nothing errors. Nothing logs. Some people see the new thing.**

## The default is per-instance, and it is stated twice

Once about the cache itself:

> *"The default in-memory cache is isolated to each Next.js process. If you're running multiple servers or containers, each instance will have its own cache that isn't shared with others and is lost on restart."*
> — [Next.js · `cacheHandlers`](https://nextjs.org/docs/app/api-reference/config/next-config-js/cacheHandlers)

And once about the invalidation:

> *"When running multiple Next.js instances behind a load balancer, revalidation events are local by default. Calling `revalidateTag()` on instance A only invalidates the cache on that instance."*
> — [Next.js · How revalidation works](https://nextjs.org/docs/app/guides/how-revalidation-works)

Those are two different problems and it is worth separating them, because a solution to one is not a solution to the other.

**The storage problem** is that instance B never had the entry instance A computed, so B recomputes it. That costs you work and money and is otherwise harmless.

**The invalidation problem** is that instance B *does* have an entry — its own, computed earlier — and nothing has told it that the entry is now wrong. That costs you correctness, and it is the one users notice.

The deployment guide names the consequence exactly:

> *"Without shared cache, each instance maintains its own cache independently — features still work correctly on each instance, but revalidation events don't propagate across instances."*

Read *"work correctly on each instance"* as the precise and slightly uncomfortable claim it is. Every instance is internally consistent. The system is not.

## What "shared" has to mean

Sharing storage alone fixes the first problem and leaves the second. A handler that reads and writes a common Redis or S3 gives every instance the same entries — but if instance B has already served that entry and holds it, or if B never learns that the tag was revalidated, B keeps serving what it has.

So a genuinely shared cache needs both halves, and the handler interface has a hook for each:

> *"**`updateTags()`** is called when `revalidateTag()` is invoked."*
> *"`refreshTags()` — Called periodically before starting a new request to sync with external tag services."*

That pairing is the whole mechanism, and it is worth stating as a sentence: **`updateTags` is how an instance publishes an invalidation; `refreshTags` is how every other instance hears about it.** A handler that implements storage and omits `refreshTags` has built a shared cache that never invalidates, which is a specific and unpleasant failure — the entries are shared, so now *every* instance serves the same stale value instead of some of them.

The third piece is how a `get` decides whether what it found is still good:

> *"`getExpiration` returns: `0` if none of the tags were ever revalidated; a timestamp (in milliseconds) representing the most recent revalidation; `Infinity` to indicate soft tags should be checked in the `get` method instead."*

An entry is stale if its `timestamp` is older than the most recent revalidation of any tag it carries. That comparison is the invalidation, and it is why the tag ledger has to be shared even when the entries are not.

```ts
// pseudo-code — the shape, not a production handler
const handler = {
  async get(cacheKey, softTags) {
    try {
      const entry = await store.get(cacheKey)
      if (!entry) return undefined
      const invalidatedAt = await getExpiration([...entry.tags, ...softTags])
      if (invalidatedAt !== 0 && entry.timestamp < invalidatedAt) return undefined
      return entry
    } catch {
      return undefined          // a miss, never a throw — see below
    }
  },
  async updateTags(tags, durations) {
    await tagLedger.stampNow(tags, durations)   // publish: revalidateTag() ran
  },
  async refreshTags() {
    try {
      await tagLedger.pull()                    // subscribe: learn what others published
    } catch (err) {
      report(err)                               // must NOT throw — see below
    }
  },
}
```

## Two failure rules that are not symmetric

The documentation is unusually specific about what happens when your handler misbehaves, and the two rules point in opposite directions.

🔴 **A throwing `get()` is a render error, not a cache miss.**

> *"your handler should catch internal errors and return `undefined` (the \"cache miss\" signal). The framework does not wrap `get()` in a try/catch, so an unhandled exception from `get()` will propagate as a render error."*
> *"A thrown error is not treated as a cache miss; it propagates as a render error, so always return `undefined` to signal a miss."*

So a Redis blip in a naively-written handler does not degrade your site to uncached — it takes the page down. Every `get` needs a `try`/`catch` whose `catch` returns `undefined`.

🔴 **A throwing `refreshTags()` fails the request.**

> *"Your handler must catch errors in `refreshTags()`: if it throws, the exception propagates as a request failure."*

Same shape, different call site, and easier to miss because `refreshTags` runs *"periodically before starting a new request"* rather than inside a render — so it fails requests that are not obviously doing anything cache-related.

By contrast, `set()` cannot hurt you:

> *"**`set()` failure**: the response is still served to the user because `set()` is called asynchronously after the response stream is already flowing."*

Which means a broken write path is **silent**. Your cache hit rate is zero, every request is doing full work, and nothing anywhere reports an error. If you take one operational lesson from this page, make it that one: **instrument `set()` explicitly, because the framework will not tell you it is failing.**

## The consistency model, stated by the framework

> *"The revalidation system prioritizes availability over strict consistency."*
> *"Cache failures result in degraded performance (stale content, extra renders), not broken applications."*

That is a design decision, not an apology, and it is the right one for a cache. It also tells you what you may not build on top of it: **nothing whose correctness depends on an invalidation having landed everywhere.** A permission change, a price that must not be shown after a cutoff, an unpublished draft — those need to be enforced at read time in the data layer, not by revalidating a tag and trusting that every instance heard.

## The HTML and RSC pairing, which is why half-sharing is dangerous

> *"When a route is revalidated, Next.js regenerates **both** the HTML response and the RSC payload… Both artifacts are stored together in the same cache entry."*
> *"If a platform's cache serves HTML from one render and an RSC payload from a different render, users may see stale or mismatched content during client-side navigation."*

The two artifacts are one entry precisely so they cannot separate. A custom handler that stores them under different keys, or a CDN configured to cache the HTML but not the RSC response (or the reverse), reintroduces exactly the mismatch the single-entry design exists to prevent — and it presents as one of the worst bug reports you can receive: the page is correct on a hard refresh and wrong when navigated to, or the other way round.

⚠️ **Rolling deployments have the same shape.**

> *"during rolling deployments, a client built with deploy A may receive responses from a server running deploy B. `deploymentId` mitigates this"*

Worth pairing with the cache-key rule that the build ID is part of every key, *"changing this invalidates all cache entries"*, and that `deploymentId` overrides it for cache-key purposes. Setting `deploymentId` is therefore both the fix for the mixed-deploy problem and the thing that makes a durable cache survive nothing across a deploy — the entries are still there and the keys no longer match. **A shared cache is shared across instances, not across deployments**, and expecting a warm cache after a release is the most common disappointment in this area.

## When a remote cache is not worth it

`use cache: remote` is the built-in answer to sharing, and [ch05](../05-caching-ppr-and-cache-components/01b-what-the-model-costs-persistence-storage-and-the-runtime-floor.md) covers the directive itself. What belongs here is the cost, which the documentation is candid about:

> *"This comes with tradeoffs: infrastructure cost and network latency during cache lookups."*

And three cases where it makes things worse rather than better, verbatim:

> *"If operations are already fast (< 50ms) due to proximity or local access, the remote cache lookup might not improve performance"*
> *"If cache keys have mostly unique values per request (search filters, price ranges, user-specific parameters), cache utilization will be near-zero"*
> *"If data changes frequently (seconds to minutes), cache hits will quickly go stale, leading to frequent misses and waiting for upstream revalidation"*

The second is the one that catches people. A cached function whose arguments include a search string or a user id has a key space roughly the size of your traffic, so you have built a write-only cache: every request misses, every request pays the network hop to discover the miss, and every request then writes an entry nobody will ever read. It is strictly slower than no cache at all.

Where it does pay, the docs name the shape rather than the technology — rate-limited APIs, slow backends, expensive operations, flaky services — all of which share one property: **the upstream is worse than the network hop to the cache.**

And a point worth keeping even when you decide against remote storage:

> *"Note that `use cache` still provides value beyond server-side caching: it informs Next.js what can be prefetched and defines stale times for client-side navigation."*

## Platform caches are a third cache, with their own rules

Where a host offers its own shared cache, it is not automatically wired to the framework's. Vercel's Runtime Cache is the concrete example and its documentation is blunt about the seam:

> *"Next.js's `revalidatePath` and `revalidateTag` API does not invalidate the Runtime Cache."*

It also publishes limits worth designing against — *"The maximum size of an item in the cache is 2 MB… A cached item can have a maximum of 128 tags. The maximum tag length is 256 bytes"* — and a propagation figure for its own invalidation: *"This operation is propagated globally across all Vercel regions within 300ms."*

The generalisable lesson is not about one vendor. It is that **every cache layer you add needs its own invalidation path, and none of them are wired together by default.** A mutation that must be visible has to reach the framework cache, the platform cache and the CDN, and the number of teams who have discovered the third one late is large.

## Gotchas

**★ Symptom: after a mutation, some users see the new content and some see the old, with no pattern.** Cause: revalidation is per-instance — *"Calling `revalidateTag()` on instance A only invalidates the cache on that instance"* — and the pattern is which instance served the request. Fix: a shared cache handler that implements both halves, publishing on `updateTags` and subscribing on `refreshTags`. Sharing storage alone does not fix it.

**★ Symptom: the shared cache was deployed and now *every* instance serves stale content, where before only some did.** Cause: the handler implements `get`/`set` against a shared store and omits `refreshTags`, so entries are shared and invalidations never arrive. This is worse than the original defect because it removed the instances that used to be accidentally correct. Fix: implement `refreshTags` and `getExpiration` together — a shared store without a shared tag ledger is not a shared cache.

**★ Symptom: a Redis outage takes the site down rather than making it slow.** Cause: `get()` threw. *"The framework does not wrap `get()` in a try/catch, so an unhandled exception from `get()` will propagate as a render error."* Fix: catch everything and return the miss signal:

```ts
async get(cacheKey, softTags) {
  try { return await store.get(cacheKey) } catch { return undefined }
}
```

**★ Symptom: requests fail intermittently with no cached route involved.** Cause: `refreshTags()` threw. It runs *"periodically before starting a new request"*, so its failures land on requests that have nothing to do with the cache, and *"if it throws, the exception propagates as a request failure."* Fix: wrap it, report the error, and return normally — a failed sync should mean "we may be stale", never "this request fails".

**★ Symptom: cache hit rate is zero in production and nothing is logged anywhere.** Cause: `set()` is failing. It is called after the response stream is already flowing, so *"the response is still served to the user"* and the failure is invisible by design. Fix: instrument it yourself, because nothing else will:

```ts
async set(cacheKey, pendingEntry) {
  try { await store.put(cacheKey, await pendingEntry) }
  catch (err) { metrics.increment('cache.set.failed'); report(err) }
}
```

**★ Symptom: a page is correct on hard refresh and stale when navigated to, or the reverse.** Cause: the HTML and the RSC payload came from different renders. They are *"stored together in the same cache entry"* precisely to prevent this, so something split them — a handler keying them separately, or a CDN caching one and not the other. Fix: treat the entry as atomic in storage, and make sure the CDN's cache key covers both representations of the route.

**★ Symptom: the durable cache is empty after every deploy, despite being durable.** Cause: the build ID is part of every cache key and *"changing this invalidates all cache entries"*. Durability is across instances and restarts, not across deployments. Fix: nothing is broken — but if you need entries to survive a release, `deploymentId` is what overrides the build ID for cache-key purposes, and it is the same setting that mitigates mixed-deploy responses during a rollout.

**★ Symptom: adding a remote cache made a search endpoint slower.** Cause: the cache key includes the query, so *"cache utilization will be near-zero"* — every request pays a network round trip to learn it missed, then pays another to write an entry nobody will read. Fix: do not cache request-unique keys remotely. Cache the expensive *shared* thing underneath the search instead — the facet counts, the candidate set, the upstream API response.

**★ Symptom: a mutation revalidates correctly in the application and users still get old data from the CDN.** Cause: a third cache nobody invalidated. Platform and CDN caches are not wired to the framework's — Vercel's own docs say *"Next.js's `revalidatePath` and `revalidateTag` API does not invalidate the Runtime Cache."* Fix: every mutation that must be visible needs an invalidation path per layer; enumerate the layers once and write them down, because the count is usually three and everyone remembers two.

**★ Symptom: a permission revocation is still honoured minutes later on some instances.** Cause: correctness was built on cache invalidation, and the framework says plainly that *"The revalidation system prioritizes availability over strict consistency."* Fix: enforce authorisation at read time in the data access layer rather than by invalidating a cached fragment. A cache is allowed to be stale; a permission check is not.

## Interview questions

**★ What does `revalidateTag()` actually invalidate?**
The cache on the instance that ran it, and nothing else, unless you have provided a shared cache handler. The documentation states it directly: *"revalidation events are local by default. Calling `revalidateTag()` on instance A only invalidates the cache on that instance."* On one server that is invisible; on any multi-instance deployment it means a mutation is visible to the share of traffic that lands on one instance, with no error and no log to indicate it.

**★ Why is sharing storage not enough to fix stale content across instances?**
Because there are two problems and storage solves the smaller one. Shared storage stops instances recomputing entries they could have read, which costs money. It does not tell an instance that an entry it already holds has been invalidated elsewhere — that requires publishing the invalidation (`updateTags`, called when `revalidateTag()` runs) and subscribing to it (`refreshTags`, called periodically before a request). A handler with storage and no `refreshTags` is arguably worse than none, because it makes every instance consistently stale instead of some of them accidentally fresh.

**★ Your cache handler's `get()` throws during a Redis outage. What happens, and what should happen?**
The site goes down. The framework *"does not wrap `get()` in a try/catch, so an unhandled exception from `get()` will propagate as a render error"*, and *"A thrown error is not treated as a cache miss."* What should happen is that the outage degrades performance rather than availability, which means catching everything inside `get` and returning `undefined` — the documented miss signal. The same rule applies to `refreshTags`, whose exceptions become request failures.

**★ Why is a failing `set()` more dangerous than a failing `get()`?**
Because it is silent. `set()` is called asynchronously after the response is already streaming, so *"the response is still served to the user"* and the failure never surfaces. A broken `get` is loud; a broken `set` presents as a cache that simply never hits, with full recomputation on every request and no error anywhere to explain the cost. It is the one path in the interface that you must instrument yourself.

**★ Why are the HTML and the RSC payload stored in a single cache entry?**
So they cannot disagree. Both are regenerated together on revalidation, and if a cache layer serves one from an older render than the other, users see *"stale or mismatched content during client-side navigation"* — a page that is right on refresh and wrong on navigation, or the reverse. Any custom handler or CDN configuration that splits them reintroduces exactly the failure the single-entry design prevents.

**★ Your durable cache is empty after every deploy. Is it broken?**
No. The build ID is part of every cache key and changing it *"invalidates all cache entries"*, so durability means across instances and restarts, not across releases. If entries need to survive a deploy, `deploymentId` overrides the build ID for cache-key purposes — and it is the same setting that mitigates the rolling-deploy problem where a client built with one deploy receives responses from a server running another.

**★ When does a remote cache make things worse?**
When the key space is request-unique, when the underlying operation is already fast, or when the data changes faster than the cache can serve it. The first is the common one: a cached function whose arguments include a search term or a user id has near-zero utilisation, so every request pays a network hop to learn it missed and another to write an entry nobody will read. That is strictly slower than not caching. Remote caching earns its latency when the upstream is worse than the hop — rate-limited APIs, slow or flaky backends, genuinely expensive computation.

**★ What must you never build on top of tag revalidation?**
Anything whose correctness depends on the invalidation having landed. The framework says it *"prioritizes availability over strict consistency"* and that cache failures produce *"stale content, extra renders — not broken applications"*, which is the right trade for a cache and the wrong one for authorisation. A revoked permission, a price after a cutoff, an unpublished draft: those get enforced at read time in the data layer, where a stale copy cannot answer for them.

**★ How many caches does a mutation have to invalidate in a typical Vercel-hosted Next.js app?**
Usually three, and most teams enumerate two. The framework cache, which `revalidateTag()` reaches on one instance and a shared handler propagates. The platform cache, which is separate — Vercel documents that *"Next.js's `revalidatePath` and `revalidateTag` API does not invalidate the Runtime Cache."* And the CDN, which keeps serving its copy until its own TTL expires regardless of anything the origin did. The useful habit is to write the list down once per application, because the layer people forget is always the one nearest the user.

---

← [05f · Streams and failure semantics](05f-streams-and-failure-semantics-in-a-handler.md) · [Topic index](05-edge-functions-and-custom-cache-structures-for-global-comput.md) · Next → [06 · Project milestone: SprintDesk](06-project-milestone-sprintdesk-on-drizzle-neon-with-pooling.md)
