---
title: "\"The cache\" is at least five caches with different owners, different lifetimes and different invalidation stories — and on a self-hosted fleet the default one is per-instance, so tuning a window means nothing until you know which layer answered the request"
sidebar_label: "03d · The cache is not one thing"
sidebar_position: 13
description: "The layered cache at enterprise scale: client router cache, CDN, per-instance ISR cache, cacheHandler versus cacheHandlers, shared coordination with updateTags and refreshTags, and how to observe whether your tuning works."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-04 for **Next.js 16.3.4** against [How revalidation works in Next.js](https://nextjs.org/docs/app/guides/how-revalidation-works) (docs `lastUpdated` 2026-06-01), [How to implement Incremental Static Regeneration](https://nextjs.org/docs/app/guides/incremental-static-regeneration) (`lastUpdated` 2026-06-23) and [`cacheLife`](https://nextjs.org/docs/app/api-reference/functions/cacheLife) (`lastUpdated` 2026-08-25), plus banked [`use cache`](https://nextjs.org/docs/app/api-reference/directives/use-cache) quotes.
> Target: **Next.js 16.3.4**, React 19.2.8, Node >= 20.9. Documentation-verified; **no sandbox run** — `next` is not installed in this checkout, so no header, log line or cache-hit figure on this page was observed. Header names and values are quoted from the documentation.

**Every previous chunk has talked about "the cache" as though it were one thing. On a single machine that fiction holds. On a fleet it collapses, and it collapses in a specific way: the default ISR cache is the local filesystem, so twenty containers hold twenty independent caches with twenty independent staleness clocks, and an on-demand invalidation reaches exactly one of them. Above that sit a CDN and a client router cache with their own lifetimes; below it sit your upstream services. A user's request is answered by whichever layer says yes first, and until you can tell which one that was, you are not tuning — you are changing numbers and watching a graph you cannot attribute. This page is about naming the layers, coordinating the one you own, and building the observation that closes the loop.**

## The layers, top to bottom

| Layer | Lifetime knob | Invalidated by | Owner |
|---|---|---|---|
| **Client router cache** | `stale` (`cacheLife`), `staleTimes` | A Server Action calling a revalidation function; a hard navigation | The browser |
| **CDN** | `Cache-Control`, `Vary` | Your CDN's own purge API | Platform / infra |
| **Route cache (ISR)** | segment `revalidate` | `revalidatePath`, `revalidateTag` | Next.js server, via `cacheHandler` (singular) |
| **`use cache` entries** | `cacheLife` | `revalidateTag`, `updateTag` | Next.js server, via `cacheHandlers` (plural) |
| **Upstream** | your own | your own | you |

🔴 **The singular/plural distinction is a genuine configuration trap**, and it is documented in one sentence:

> *"Pages Router on-demand ISR APIs (for example `res.revalidate()` and the `x-prerender-revalidate` flow) are still supported and use the server cache handler (`cacheHandler`, singular). The `cacheHandlers` option (plural) is for `'use cache'` directives."*
> — [How revalidation works](https://nextjs.org/docs/app/guides/how-revalidation-works)

Two options whose names differ by one letter, controlling two different caches. Configuring one and expecting the other to be shared is a failure with no error message. The Cache Components ISR guide reinforces that both can coexist: keep an existing ISR `cacheHandler` **alongside** `cacheHandlers` for `'use cache'`.

The client layer has its own floor worth remembering when you are wondering why a page will not refresh: `stale` is delivered via `x-nextjs-stale-time`, it controls the client cache and *not* the `Cache-Control` header, and there is an enforced *"Minimum of 30 seconds ... to ensure prefetched links remain usable"*. The exception: calling `revalidateTag`, `revalidatePath`, `updateTag` or `refresh` from a Server Action clears the entire client cache immediately, bypassing the stale time — which is why a mutation feels instant and a background refresh does not.

## Per-instance by default, and what that actually does to users

> *"When running multiple Next.js instances behind a load balancer, revalidation events are local by default. Calling `revalidateTag()` on instance A only invalidates the cache on that instance. Other instances continue serving the stale content until they learn about the invalidation."*

> *"Without coordination, each instance independently serves content and handles revalidation using only its local cache. Different users may see different content depending on which instance serves their request, and on-demand revalidation only takes effect on the instance that received the call."*
> — [How revalidation works](https://nextjs.org/docs/app/guides/how-revalidation-works)

Read the last sentence as a bug report you will receive: *"the page updates sometimes and then goes back to the old version."* It is not a caching bug in your code. It is a load balancer alternating between an invalidated instance and nineteen that never heard.

## Coordinating it: `updateTags` and `refreshTags`

The documented hooks, verbatim:

> *"`updateTags()` is called when `revalidateTag()` is invoked. Your handler should write the invalidation event to shared storage (for example, Redis or a database) so other instances can discover it."*

> *"`refreshTags()` is called periodically, but always before starting a new request. Your handler should check shared storage for recent invalidation events and update its local tag state accordingly."*

Two rules in the same section decide whether your handler is an improvement or an outage:

> *"Your handler must catch errors in `refreshTags()`: if it throws, the exception propagates as a request failure. Catching the error allows requests to continue with the last known local tag state, serving potentially stale content until connectivity is restored."*

> *"Cache read failure: your handler should catch internal errors and return `undefined` (the cache miss signal). ... A thrown error is not treated as a cache miss; it propagates as a render error, so always return `undefined` to signal a miss."*

🔴 **Both say the same thing: a cache handler that throws converts a Redis blip into a site outage.** The default posture is degrade, never fail.

```ts
// cache-handler.ts — the shape the two rules dictate. Wire via `cacheHandlers`.
import { createClient } from 'redis'

const redis = createClient({ url: process.env.CACHE_REDIS_URL })
let connected = false

async function client() {
  if (!connected) {
    await redis.connect()
    connected = true
  }
  return redis
}

export async function get(cacheKey: string, softTags: string[]) {
  try {
    const raw = await (await client()).get(`entry:${cacheKey}`)
    if (!raw) return undefined
    const entry = JSON.parse(raw)
    const invalidatedAt = await getExpiration(...softTags)
    if (invalidatedAt > entry.timestamp) return undefined
    return entry
  } catch (err) {
    // 🔴 A throw here is a render error, not a miss. Degrade instead.
    console.error('[cache] read failed, treating as miss', err)
    return undefined
  }
}

export async function getExpiration(...tags: string[]) {
  try {
    const values = await (await client()).mGet(tags.map((t) => `tag:${t}`))
    return values.reduce<number>((max, v) => Math.max(max, v ? Number(v) : 0), 0)
  } catch (err) {
    console.error('[cache] getExpiration failed, assuming not revalidated', err)
    return 0
  }
}

export async function updateTags(tags: string[]) {
  const now = Date.now()
  try {
    const c = await client()
    await Promise.all(tags.map((t) => c.set(`tag:${t}`, String(now))))
  } catch (err) {
    // Losing the write means other instances keep serving stale. Alert on it.
    console.error('[cache] updateTags failed; invalidation did NOT propagate', err)
  }
}

export async function refreshTags() {
  try {
    await (await client()).ping()
  } catch (err) {
    // 🔴 Documented: a throw here fails the REQUEST. Never rethrow.
    console.error('[cache] refreshTags failed, continuing on local tag state', err)
  }
}
```

The `getExpiration` semantics are documented and worth getting right: it *"returns the most recent revalidation timestamp across all provided tags, or `0` if none have been revalidated"*, it can return `Infinity` to signal that soft tags should instead be passed to `get()` and checked there, and *"Your handler should treat an entry as stale if the returned timestamp is newer than the entry's own timestamp."*

## HTML and the RSC payload must not drift apart

> *"When a route is revalidated, Next.js regenerates **both** the HTML response and the RSC payload ... from the same React component tree. Both artifacts are stored together in the same cache entry."*

> *"If a platform's cache serves HTML from one render and an RSC payload from a different render, users may see stale or mismatched content during client-side navigation."*

> *"Do not cache HTML and RSC payload responses separately with different TTLs."*

This is a CDN configuration rule as much as an application one, and the symptom it produces is bizarre enough to waste a day: **a hard reload shows one version of the page and a client-side navigation to the same route shows another.** The mitigation is to cache both together with the same TTL and invalidation policy, and to respect the `Vary` header Next.js sets.

The neighbouring hazard is deployment skew: during rolling deploys a client built from deploy A can hit a server on deploy B. `deploymentId` is the documented mitigation — *"when the client detects a different deployment ID from the server, it triggers a hard navigation to fetch consistent content."*

## Observing whether the tuning works

**1 · The response header.** This is the primary signal and it is documented exactly:

> *"You can use the `x-nextjs-cache` response header to observe cache behavior. Values are `HIT` (served from cache), `STALE` (served from cache, revalidating in background), `MISS` (not in cache, rendered fresh), or `REVALIDATED` (regenerated via on-demand revalidation)."*
> — [ISR guide](https://nextjs.org/docs/app/guides/incremental-static-regeneration)

Four values, and each answers a different question. A high `MISS` rate on a route you believe is prerendered means your enumeration does not cover real traffic ([02](02-generatestaticparams-for-pre-rendering-dynamic-routes-at-sca.md)). A high `STALE` rate means your window is short relative to traffic, which is the healthy state for ISR, not a problem. `REVALIDATED` appearing is proof your on-demand path is alive — and its *disappearance* is the alert that catches a dead webhook, which is the failure [03c](03c-revalidate-budgets-and-time-based-versus-on-demand.md) says produces silence rather than errors.

Log it per route and per instance. Per instance matters because of everything above: a fleet where one instance shows `REVALIDATED` and nineteen show `HIT` is a fleet with no shared cache handler.

**2 · Local verification, before production.** The guide's own procedure: run `next build` then `next start`, because `next dev` does not exhibit production caching. Then:

```bash
# .env — documented: makes the server log ISR cache hits and misses
NEXT_PRIVATE_DEBUG_CACHE=1
```

```js
// next.config.js — documented: which fetches are cached, with full URLs
module.exports = {
  logging: {
    fetches: {
      fullUrl: true,
    },
  },
}
```

**3 · Measure actual age, not configured age.** This is the one that changes minds, and it exists because of [03](03-isr-at-enterprise-level-stale-while-revalidate-tuning.md)'s core argument: the configured window is not the staleness users see. Render the generation moment into the page and compare it to the moment the page is observed.

```tsx
// app/products/[slug]/page.tsx — the page carries its own generation timestamp
export default async function Page({ params }: PageProps<'/products/[slug]'>) {
  const { slug } = await params
  const product = await getProduct(slug)
  return (
    <>
      <meta name="x-generated-at" content={new Date().toISOString()} />
      <ProductView product={product} />
    </>
  )
}
```

A synthetic check that fetches the page and reads that meta tag gives you the **real** age distribution per route: not "we configured 900 seconds" but "the 95th percentile of observed content age on this route is X". That is the number to hold against the product requirement [03](03-isr-at-enterprise-level-stale-while-revalidate-tuning.md) told you to write down. ⚠️ This is a technique, not a documented feature — nothing in Next.js emits a generation timestamp for you, and adding one puts a value in your HTML that changes on every regeneration, which is worth knowing if anything downstream diffs your output.

## What the tuning question becomes under Cache Components

🔴 `v16.0.0` removes `dynamic`, `dynamicParams`, `revalidate` and `fetchCache` under `cacheComponents`. Everything on these four pages that names the segment `revalidate` export is describing the previous model, which the docs themselves now label *Caching and Revalidating (Previous Model)*. The mechanics of the replacement are [ch5 · choosing a directive](../05-caching-ppr-and-cache-components/10-the-three-cache-directives/01-choosing-a-directive.md) and [ch5 · revalidation and lifetimes](../05-caching-ppr-and-cache-components/10-the-three-cache-directives/05-revalidation-and-lifetimes.md). What changes about *tuning* is this:

**One number becomes three, and the three are the terms you were already reasoning about.** `stale` is the client layer, `revalidate` is the background-refresh trigger, `expire` is the blocking floor. The sparse-traffic hole in the previous model — where a path nobody visits ages without bound — is now expressible, because `expire` names it.

**Short lifetimes change where content can be delivered from.** These thresholds have no analogue in the previous model and they surprise people:

> *"`revalidate` of `0`, or `expire` under 5 minutes: excluded from prerenders, becoming a 'dynamic hole' resolved at request time."*
> *"`stale` under 30 seconds: excluded from prerenders, because a prefetch would expire before the user could click."*
> *"`stale` of at least 30 seconds but under 5 minutes: included in prerenders, but excluded from the route's App Shell."*
> *"Of the presets, only `seconds` falls under any of these thresholds: its `expire` of 1 minute excludes it from prerenders."*
> — [`cacheLife`](https://nextjs.org/docs/app/api-reference/functions/cacheLife)

**So tightening a window can silently remove a component from the static shell.** Dropping `expire` below five minutes to "make it fresher" converts that subtree into a dynamic hole resolved at request time — which is often what you wanted, but it is a rendering change dressed as a timing change, and it is the kind of thing that shows up as a latency regression nobody can attribute.

**Serverless storage is not persistent.** The banked `use cache` runtime table: on serverless, *"Cache entries typically don't persist across requests (each request can be a different instance), or during revalidation. Build-time caching works normally."* Self-hosted, *"Cache entries persist across requests."* This is why the `cacheLife` docs reach for `'use cache: remote'` in their short-lived example, noting that *"runtime caching in serverless deployments doesn't persist across requests with the default in-memory cache. For self-hosted environments, `"use cache"` may be sufficient."* **Your platform decides whether runtime caching is a cache at all.** The directive itself is [ch5 · `use cache: remote`](../05-caching-ppr-and-cache-components/10-the-three-cache-directives/03-use-cache-remote.md).

**And the fact that dominates all of them:** *"Neither caching directive carries over to a new deploy, because the cache key includes the build (or `deploymentId`) ID."* On a team deploying several times a day, no runtime cache entry lives longer than the gap between releases, and a `revalidate` of an hour on a site that deploys every forty minutes is a number that never fires. Before tuning anything, compare your windows against your deploy cadence; on many teams that single comparison explains the whole caching picture.

## Gotchas

**★ Symptom: a page updates for some users and not others, and refreshing flips between versions.** Cause: per-instance caches with no coordination — the invalidation reached the instance that received the call and no other, and the load balancer alternates. Fix: a shared cache handler implementing `updateTags` to publish invalidation events and `refreshTags` to consume them. Until then, the observable signature is `x-nextjs-cache` differing by instance for the same URL.

**★ Symptom: adding a Redis cache handler turned a Redis blip into 500s across the fleet.** Cause: the handler threw. Both documented rules were violated: a throw from `refreshTags()` *"propagates as a request failure"*, and a thrown read *"is not treated as a cache miss; it propagates as a render error"*. Fix: catch everything, return `undefined` from `get()` on failure, and swallow-and-log in `refreshTags()`. The design intent is explicit — *"Cache failures result in degraded performance (stale content, extra renders), not broken applications."*

**★ Symptom: you configured a shared cache handler and `use cache` entries are still per-instance.** Cause: the singular/plural split. `cacheHandler` is the server cache handler used by the Pages Router ISR APIs; `cacheHandlers` is the option for `'use cache'` directives. Configuring one does nothing for the other, and there is no error. Fix: configure both, which the Cache Components guide explicitly supports — keep the existing ISR `cacheHandler` alongside `cacheHandlers`.

**★ Symptom: a hard reload shows the new content and a client-side navigation to the same page shows the old.** Cause: HTML and the RSC payload cached separately with different TTLs or invalidation timing, usually at the CDN. Both artifacts are generated together from the same component tree and stored in the same cache entry; splitting them downstream reintroduces the skew the design removed. Fix: cache them together with one TTL and one invalidation policy, and respect the `Vary` header Next.js sets.

**★ Symptom: after a rolling deploy some users get errors or mismatched behaviour until they hard-refresh.** Cause: cross-deployment skew — a client from deploy A talking to a server on deploy B. Fix: configure `deploymentId`, which makes the client detect the mismatch and trigger a hard navigation to fetch consistent content.

**★ Symptom: your revalidate windows appear to have no effect at all.** Cause: check the deploy cadence before anything else. Runtime cache entries do not survive a deploy because the cache key includes the build or `deploymentId` ID, so a team deploying every forty minutes has no entry older than forty minutes regardless of configuration. Fix: nothing about the window. Either prerender the head at build time so freshness comes from the build, or accept that deploys are your effective invalidation mechanism and tune with that in mind.

**Symptom: shortening `expire` to five minutes made a component slower rather than fresher.** Cause: the documented prerendering thresholds — an `expire` under five minutes excludes the content from prerenders and turns it into a dynamic hole resolved at request time. It is a rendering change disguised as a timing change. Fix: if you want the content prerendered, keep `expire` at or above five minutes; if you want the dynamic hole, wrap it in `<Suspense>` and give it a real fallback, because it is now request-time work.

**Symptom: runtime caching works locally and does nothing in production.** Cause: platform. On serverless, cache entries typically do not persist across requests because each request can be a different instance, while build-time caching works normally; self-hosted, they persist. Fix: use a remote cache directive or a shared cache handler on serverless, and stop reasoning about runtime cache behaviour from local `next start` alone.

**Symptom: you cannot tell whether a slow request was a cache miss or a slow upstream.** Cause: no attribution. Fix: log `x-nextjs-cache` alongside latency per route and per instance. `MISS` with high latency is a render; `HIT` with high latency is not the cache's problem at all and you have just eliminated four layers from the investigation.

## Interview questions

**★ Someone says "the page is cached." What do you ask next?**
Which cache. There are at least five with different owners: the client router cache governed by `stale` with its enforced 30-second minimum, the CDN governed by `Cache-Control` and `Vary`, the route/ISR cache behind the singular `cacheHandler`, the `use cache` entries behind the plural `cacheHandlers`, and whatever your upstream does. They have different lifetimes and different invalidation stories, and a request is answered by whichever says yes first. Until you know which layer answered — which is what `x-nextjs-cache` tells you — every subsequent statement about staleness is a guess. The follow-up question is "on which instance", because the default ISR cache is per-instance and a fleet answers the same URL differently depending on routing.

**★ Why is a cache handler that throws worse than no cache handler?**
Because it converts a dependency outage into an application outage, and the documentation says so twice. A throw from `refreshTags()` propagates as a request failure; a throw from a read is not treated as a cache miss but propagates as a render error. So a Redis hiccup that should have produced a few extra renders produces 500s across the fleet instead. The correct posture is that every handler method degrades: return `undefined` to signal a miss, swallow and log in `refreshTags()` so requests continue on the last known local tag state. The stated design principle is that the revalidation system prioritises availability over strict consistency, and a handler that throws inverts it.

**★ How would you tell whether your ISR tuning is working?**
Two measurements and one comparison. First, `x-nextjs-cache` logged per route and per instance: `HIT` and `STALE` are the healthy states, a high `MISS` rate on a route you believe is prerendered means your enumeration does not match real traffic, and the presence of `REVALIDATED` is proof the on-demand path is alive — its disappearance is the alert that catches a dead webhook. Second, actual observed content age rather than configured age, which means rendering a generation timestamp into the page and having a synthetic check read it back; that is the only way to see the gap between "we configured 900 seconds" and what users experience, which on a low-traffic route can be enormous. The comparison is those observed ages against the written product requirement. If nobody wrote the requirement down, there is nothing to compare against and you are not tuning.

**★ What is the difference between `cacheHandler` and `cacheHandlers`?**
One letter and two different caches. `cacheHandler`, singular, is the server cache handler used by the route/ISR cache and by the Pages Router on-demand APIs like `res.revalidate()` and the `x-prerender-revalidate` flow. `cacheHandlers`, plural, is the option for `'use cache'` directives. They can and often should coexist — the Cache Components guide explicitly says to keep an existing ISR `cacheHandler` alongside `cacheHandlers`. The failure mode is that configuring only one and expecting both to be shared produces no error at all: half your caching is coordinated across the fleet and half is not, and the symptom is intermittent stale content that correlates with nothing.

**★ Under Cache Components, what does the tuning work actually consist of?**
Choosing three numbers per content class instead of one, and knowing that two of them have rendering consequences. `stale` is the client layer, `revalidate` triggers background refresh, `expire` is the point at which a request blocks — which finally makes the sparse-traffic case expressible, since the previous model had no way to say "if nobody visits for a day, make the next visitor wait". The trap is the prerendering thresholds: an `expire` under five minutes or a `revalidate` of zero excludes content from prerenders and turns it into a dynamic hole, and a `stale` under thirty seconds excludes it too because a prefetch would expire before a click. So tightening a window to make something fresher can quietly convert it from prerendered to request-time — a rendering change wearing the costume of a timing change.

**Why does deploy cadence matter more than any revalidate number on some teams?**
Because runtime cache entries do not survive a deploy: the cache key includes the build or `deploymentId` ID, so a release is a total cold start for them. A team that deploys six times a day has no runtime cache entry older than a couple of hours no matter what the config says, and an hour-long window on a site that deploys every forty minutes never fires — freshness is coming from releases, not from ISR. That is fine until deploy frequency drops, for example because the build got slow, at which point content that was always fresh starts going stale and no config change explains it. So the first thing to compare a window against is the release interval, and on many teams that one comparison explains the entire caching picture.

**What produces "a hard reload shows one version and a client-side navigation shows another"?**
HTML and the RSC payload being cached separately with different TTLs or invalidation timing, almost always at a CDN. Next.js regenerates both from the same component tree and stores them in one cache entry precisely so this cannot happen, because the RSC payload is what client-side navigations consume and browser navigations consume the HTML — they must agree. A downstream cache that splits them reintroduces the skew. The fix is to cache them together with the same TTL and invalidation policy and to respect the `Vary` header, and the related mitigation for the rolling-deploy version of the same class of problem is `deploymentId`.

---

← [03c · Budgets and on-demand](03c-revalidate-budgets-and-time-based-versus-on-demand.md) · [Chapter index](01-explanation.md) · Next → [04 · Full static export vs serverful edge distribution](04-full-static-export-vs-serverful-edge-distribution.md)
