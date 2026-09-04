---
title: "The half of Cache Components nobody puts in the release notes: `use cache` is a weaker store than the one it replaces, and no cache you can buy survives a deploy"
sidebar_label: "01b · What the model costs"
sidebar_position: 2
description: "The persistence regression against the fetch Data Cache and unstable_cache, the three physical places one cached value lives, why the build id in the cache key makes every deploy a cold start, and the Node.js runtime floor."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-04 for **Next.js 16.3.4** against [Migrating to Cache Components](https://nextjs.org/docs/app/guides/migrating-to-cache-components) (docs `lastUpdated` 2026-08-25), [Caching](https://nextjs.org/docs/app/getting-started/caching) (`lastUpdated` 2026-08-25), [`cacheComponents`](https://nextjs.org/docs/app/api-reference/config/next-config-js/cacheComponents) (`lastUpdated` 2026-06-22) and [`use cache`](https://nextjs.org/docs/app/api-reference/directives/use-cache).
> Target: **Next.js 16.3.4**, App Router, Node.js runtime. Documentation-verified; **no sandbox run**.

**[01](01-the-explicit-caching-model-cachecomponents-build-flag-and-th.md) is what Cache Components buys you. This page is the invoice, and it has three lines on it. The first is that `use cache` is a genuinely weaker store than the `fetch` Data Cache and `unstable_cache` it replaces — a fact stated once, in a note, in the migration guide. The second is that a cached value is copied to as many as three physically different places with three separately-governed lifetimes, so "the cache" is never one thing you can reason about. The third is that the Node.js runtime is now a floor rather than a default. None of these is a reason not to adopt the model; all of them are reasons a migration that looked correct produces a bigger cloud bill than the thing it replaced.**

## 🔴 What it costs: `use cache` is a weaker store than what it replaces

This is the half of the trade that the marketing does not mention, and it is stated only in the migration guide — in a note, under a heading about `fetch` options, where nobody migrating a working app will look for it.

> *"Note the persistence difference. The `fetch` Data Cache persists cached responses across deployments and across serverless instances."*

> *"`use cache` defaults to in-memory storage, so its entries are discarded when the serverless instance is destroyed and are scoped to a single deployment. Use `use cache: remote` or a cache handler for storage that survives instance teardown. Even with durable storage, expect cached values to recompute after a new deployment."*

And, so there is no doubt that `unstable_cache` was also stronger:

> *"Like the `fetch` Data Cache, `unstable_cache` persists cached values across deployments and serverless instances, while `use cache` does not."*

Put the two models side by side on the axis that decides your infrastructure bill:

| | Survives a new instance? | Survives a deploy? |
|---|---|---|
| `fetch` Data Cache (previous model) | ✅ yes | ✅ yes |
| `unstable_cache` (previous model) | ✅ yes | ✅ yes |
| `use cache` (default, in-memory) | ❌ no | ❌ no |
| [`use cache: remote`](10-the-three-cache-directives/03-use-cache-remote.md) | ✅ yes | ❌ **still no** |

The last cell is the one that surprises people who did the migration properly, paid for a durable cache handler, and still watched their origin get hammered every deploy:

> *"All of these stores are scoped to a single deployment. A new deploy starts fresh, new prerenders are built, and `use cache` entries don't carry over, even durable `remote` ones, because the cache key includes the build id."*

The build id is *in the key*. A durable store does not help, because after a deploy you are asking it different questions. If you deploy ten times a day and your upstream is a rate-limited third-party API, that is ten cold starts a day against it, and the fix is not a cache setting — it is an architectural one, such as putting your own cache in front of the upstream, below Next.js entirely.

⚠️ **Both models can run at once during a migration**, which is the escape hatch if the persistence regression is unacceptable for one particular read:

> *"Your existing `fetch` and `unstable_cache` caching keeps working as a separate layer, so let the insights and errors guide what to change."*

Leaving a genuinely deploy-spanning read on `unstable_cache` while everything else moves to `use cache` is a legitimate, documented position, not a failure to finish the migration.

## Where a cached value physically lives

One cached function produces one artefact, and that artefact gets copied to up to three places with three different lifetimes. Knowing which copy you are looking at is most of cache debugging.

> *"A cached function's output is serialized into an **RSC payload**, at build time or at runtime. This payload is what everything else works from."*

| Copy | Where it lives | What controls its freshness |
|---|---|---|
| **Prerendered HTML** | on disk when self-hosting, or platform durable storage behind a CDN | `revalidate` and `expire` |
| **Shared store** | per-instance in-memory by default; a durable [cache handler](10-the-three-cache-directives/03-use-cache-remote.md) with `use cache: remote` | `revalidate` and `expire` |
| **Browser** | the RSC payload sent with a navigation or prefetch | `stale` |

The three `cacheLife` properties are not three settings of one thing — each one governs a different copy. That is why a value can be simultaneously fresh in one place and stale in another, and why "I revalidated it and the user still sees the old thing" is nearly always a question about the *browser* copy. The lifetimes themselves are set out at [10 · 05](10-the-three-cache-directives/05-revalidation-and-lifetimes.md).

Two consequences worth memorising:

> *"An App Shell that reads `cookies()` or `headers()` is session-specific, cached per session on the client rather than in the shared server cache."*

> *"By default the result stays in a per-instance, in-memory store that is ephemeral on serverless. `use cache: remote` moves it to a durable cache handler shared across instances, a network roundtrip that pays off only at a **high hit rate**."*

That second sentence is a cost warning wearing a performance sentence's clothes. A remote cache is a network round trip on the *read* path. At a low hit rate you have added latency to every request and removed none, which is why [10 · 03](10-the-three-cache-directives/03-use-cache-remote.md) treats "few distinct cache-key values" as a precondition rather than a nicety.

### Serverless and self-hosted are two different products

The `use cache` reference splits its runtime behaviour into two rows, and they are different enough that a lifetime tuned on one is meaningless on the other:

| Deployment | Documented behaviour |
|---|---|
| **Serverless** | *"Cache entries typically don't persist across requests (each request can be a different instance), or during revalidation. Build-time caching works normally."* |
| **Self-hosted** | *"Cache entries persist across requests."* |

Read the serverless row twice. *"Typically don't persist across requests"* is close to saying the default in-memory store is not a cross-request cache at all on serverless — what survives is the **build-time** prerender, not the runtime cache. That is why a page whose data was cached at build time behaves beautifully on Vercel while a value first computed at request time appears to ignore its `cacheLife` entirely. Both are working as documented.

On a self-hosted long-lived process the in-memory store is real, and its ceiling is configurable through `cacheMaxMemorySize`. On serverless there is nothing to size, because the process holding it is about to disappear.

⚠️ **Draft Mode suspends caching wholesale.** Inside Draft Mode every cached function re-executes per request and the results are not saved — which is correct for a CMS preview and catastrophic as a load test. Benchmarking a route with Draft Mode enabled measures the uncached path and tells you nothing about production. `draftMode().isEnabled` is readable inside a cache scope; `cookies()` and `headers()` still are not.

## The runtime constraint

> *"Cache Components requires the Node.js runtime. Migrate any routes that set the deprecated `runtime = 'edge'` export, and note that other server-side JavaScript runtimes are not guaranteed to work."*

There is no partial adoption here — you cannot keep three edge routes and enable the flag for the rest, because the flag is global. If you need edge behaviour for specific paths, the documented replacement is [Proxy](../15-databases-apis-and-full-stack-patterns/10b-tenant-routing-with-proxy-and-root-params.md), which still runs at the edge and still does redirects and rewrites cheaply. What you cannot do any more is *render* a route at the edge.

⚠️ Note the hedge in *"not guaranteed to work"*. The documentation does not enumerate which non-Node runtimes fail or how. If you are on Deno, Bun or a vendor's proprietary runtime, treat Cache Components as unsupported rather than untested — the sentence is an absence of a guarantee, not a report of success.


## Gotchas

**★ Symptom: cached data recomputes after every deploy, even though you configured a durable remote cache handler.** Cause: the cache key includes the build id, so a new deployment asks the store for keys it has never seen. Nothing is wrong with the handler. Fix: this is not adjustable from Next.js config — the fix is to put a cache in front of the upstream, outside the framework, so that Next's cold start hits your cache rather than the third party.

```ts
// lib/pricing.ts — the upstream is protected below Next.js, not by it
import { cacheLife } from 'next/cache'
import { redis } from '@/lib/redis'

const UPSTREAM_TTL_SECONDS = 3600

export async function getPricing() {
  'use cache'
  cacheLife('hours')

  // Survives deploys because it is keyed by us, not by the build id.
  const cached = await redis.get('pricing:v1')
  if (cached) return JSON.parse(cached)

  const res = await fetch('https://api.acme.com/pricing')
  const pricing = await res.json()
  await redis.set('pricing:v1', JSON.stringify(pricing), { ex: UPSTREAM_TTL_SECONDS })
  return pricing
}
```

**★ Symptom: a route that was fast under the previous model is now slower on serverless, with no code change other than the migration.** Cause: you converted `unstable_cache` to `use cache` verbatim. The old call persisted across instances; the new one is in-memory per instance, so on a platform that spreads traffic over many short-lived instances your hit rate collapsed. Fix: for a value that is shared across users and expensive to compute, move it to the durable store explicitly.

```ts
// Before the migration this persisted across instances. Now it does not —
// unless you say so.
export async function getPricing() {
  'use cache: remote'
  cacheLife('hours')
  const res = await fetch('https://api.acme.com/pricing')
  return res.json()
}
```

**★ Symptom: the same `use cache` function returns a fresh value locally on every request but a stale one in production, or the reverse.** Cause: the default store is per-instance and in-memory, and `next dev` is a single long-lived process while production is many short-lived ones. The two environments have genuinely different cache behaviour for the same code. Fix: do not tune lifetimes against `next dev`. Either reason about the store explicitly (`remote` for shared durable, default for per-instance) or verify against a production-like build.

**★ Symptom: `export const runtime = 'edge'` on one route blocks the entire migration.** Cause: the runtime requirement is not per-route; Cache Components needs Node.js and the flag is global. Fix: delete the export and move the edge-specific work into `proxy.ts`, which still runs at the edge:

```ts
// proxy.ts — geolocation redirect stays at the edge; the route renders on Node
import { NextResponse, type NextRequest } from 'next/server'

export function proxy(request: NextRequest) {
  const country = request.headers.get('x-vercel-ip-country')
  if (country === 'DE' && !request.nextUrl.pathname.startsWith('/de')) {
    return NextResponse.redirect(new URL(`/de${request.nextUrl.pathname}`, request.url))
  }
  return NextResponse.next()
}

export const config = {
  matcher: '/((?!api|_next/static|_next/image|.*\\.png$).*)',
}
```


**★ Symptom: a value cached at build time is fast in production, but the identical function cached at request time behaves as if `cacheLife` were ignored.** Cause: on serverless the two are not the same mechanism. The build-time result is baked into the prerender; the request-time result goes into a per-instance in-memory store that *"typically doesn't persist across requests"* because the next request may land on a different instance. The lifetime is being honoured — there is simply rarely an instance alive to honour it on. Fix: if the value must be cached across requests on serverless, name the durable store rather than relying on the default.

```ts
// A value first computed at request time needs somewhere to live that
// outlives the instance. The default store does not qualify on serverless.
import { cacheLife, cacheTag } from 'next/cache'

export async function getExchangeRates(base: string) {
  'use cache: remote'
  cacheLife('minutes')
  cacheTag(`rates-${base}`)
  const res = await fetch(`https://api.acme.com/rates?base=${base}`)
  return res.json()
}
```

**★ Symptom: you load-test a route with Draft Mode on and every request costs a full render, so you conclude caching is broken.** Cause: Draft Mode deliberately re-executes every cached function per request and does not save the results, because a CMS preview that served a cached page would defeat the point. Fix: measure with Draft Mode off. If you need the preview path to be fast too, that is a different problem with a different answer — the preview is *supposed* to be uncached.

```ts
// Correct, and correctly uncached: this branch is a preview, not a cache miss.
import { draftMode } from 'next/headers'

export async function getArticle(slug: string) {
  'use cache'
  cacheLife('hours')
  // Readable inside a cache scope; cookies() and headers() still are not.
  const { isEnabled } = await draftMode()
  return isEnabled ? fetchDraft(slug) : fetchPublished(slug)
}
```

## Interview questions

**★ You migrate `unstable_cache` to `use cache` faithfully and your origin traffic goes up. Why?**
Because `use cache` is a weaker store. `unstable_cache` persisted across deployments and across serverless instances; `use cache` defaults to a per-instance in-memory store that is discarded when the instance is torn down and is scoped to a single deployment. On a serverless platform spreading traffic across many short-lived instances, the hit rate falls sharply. `use cache: remote` restores sharing across instances, but not across deploys — the cache key includes the build id, so every deployment starts cold no matter how durable the handler is.

**★ If a durable remote cache still does not survive a deploy, when is it worth paying for?**
When the traffic between deploys is high enough that cross-instance sharing dominates. The documentation frames it as a network round trip that *"pays off only at a high hit rate"*, so the question is whether many requests will hit the same key within one deployment's lifetime. A value with thousands of distinct cache-key variants has a low hit rate per key and a remote cache mostly adds latency; a value with a handful of variants and heavy traffic has a high hit rate and the round trip is repaid many times over. Deploy frequency is a real input: an app that ships ten times a day gets ten cold starts, which shortens every window the cache has to earn its cost in.

**What does it mean that the cache key includes the build id, and what would you do about it?**
It means every deployment is a distinct cache namespace, so no `use cache` entry from the previous build is reachable after a deploy — including entries in a durable remote handler. The practical effect is a guaranteed cold cache at every release, sized by however much traffic you serve. You cannot configure this away inside Next.js. The available responses are architectural: reduce deploy frequency, accept the cold start and size the upstream for it, or place a cache you control between the application and the upstream so that the framework's cold start hits your store rather than a rate-limited third party. The last option is the only one that genuinely removes the problem, and it lives outside the framework.

**★ Why does the same `use cache` code have different caching behaviour on Vercel and on a self-hosted Node server?**
Because the default store is a per-instance, in-memory one, and the two deployments have very different instance lifetimes. Self-hosted, the documentation says plainly that *"cache entries persist across requests"* — one long-lived process holds the store, and `cacheMaxMemorySize` bounds it. Serverless, entries *"typically don't persist across requests (each request can be a different instance)"*, so the runtime cache is close to a no-op while build-time caching *"works normally"*. The practical consequence is that a lifetime tuned against a self-hosted dev server tells you nothing about serverless production, and that `use cache: remote` is not an optimisation on serverless but the thing that makes runtime caching exist at all.

**One cached value, three copies, three lifetimes — name them and say which governs which.**
The value is serialized once into an RSC payload, and that payload is copied to up to three places. Prerendered HTML on disk or in platform storage behind a CDN, governed by `revalidate` and `expire`. The shared server store — per-instance in-memory by default, or a durable handler under `use cache: remote` — also governed by `revalidate` and `expire`. And the browser, which receives the payload with a navigation or prefetch and keeps it for its `stale` window. This is why `stale`, `revalidate` and `expire` are not three dials on one cache: `stale` is the only one the browser copy obeys, which is why "I revalidated on the server and the user still sees the old value" is almost always a question about the client, not the server.

**How would you explain the trade to someone who liked the previous model?**
That they are trading a cache that was stronger and less predictable for one that is weaker and fully declared. The previous Data Cache genuinely persisted better — across instances and across deploys. What it did not do was tell you what it was doing: a route's staticness was an emergent property of every `fetch` call beneath it, and one runtime API access in a shared component could flip an entire section to per-request rendering with no signal. Cache Components gives up some persistence and buys the guarantee that what you declared is what ships, checked at build time, with the offending filename named when it is not. Whether that is a good trade depends on whether their production incidents have historically been about cost or about correctness.


---

← [01 · The explicit caching model](01-the-explicit-caching-model-cachecomponents-build-flag-and-th.md) · [Chapter index](01-explanation.md) · Next → [01c · Flipping the flag on an existing app](01c-flipping-the-flag-on-an-existing-app.md)
