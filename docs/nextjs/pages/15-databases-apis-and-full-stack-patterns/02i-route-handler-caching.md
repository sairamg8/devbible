---
title: "Route Handlers stopped caching by default in v15, and under Cache Components whether a GET is prerendered is decided by what your code touches rather than by what you declared"
sidebar_label: "02i · Route Handler caching"
sidebar_position: 23
description: "Why force-dynamic advice from Next 14 is now backwards, opting into static with force-static, the Cache Components model for GET handlers, the exhaustive list of things that stop prerendering, why use cache must live in a helper, and the next-request-in-use-cache failure that passes next build."
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-05 against [Next.js · Route Handlers](https://nextjs.org/docs/app/getting-started/route-handlers) (§ *Caching*, § *With Cache Components*), [Next.js · `route.js`](https://nextjs.org/docs/app/api-reference/file-conventions/route) (version history) and [Next.js · `use cache`](https://nextjs.org/docs/app/api-reference/directives/use-cache) — all `version: 16.3.4`.
> Documentation-verified; **no sandbox run**. The one error identifier named (`next-request-in-use-cache`) is quoted from the docs, not reproduced.
> Target: **Next.js 16.3.4** · React **19.2.8** · Node **24.20.0**.

**Almost every piece of advice about caching a Route Handler that predates Next 15 has the polarity backwards, because v15 flipped the default from static to dynamic. On 16.3.4 a `GET` handler is not cached unless you opt in — and with Cache Components enabled the question changes shape entirely: the handler behaves like a UI route, prerendering when it touches nothing request-specific and falling back to request time the moment it does. The useful mental model is that you no longer cache the *route*; you cache the *data*, in a helper, and let the route follow.**

## The default, and the version that changed it

> *"Route Handlers are not cached by default. You can, however, opt into caching for `GET` methods. Other supported HTTP methods are **not** cached. To cache a `GET` method, use a route config option such as `export const dynamic = 'force-static'` in your Route Handler file."*

```ts
// app/items/route.ts
export const dynamic = 'force-static'

export async function GET() {
  const res = await fetch('https://data.mongodb-api.com/...', {
    headers: {
      'Content-Type': 'application/json',
      'API-Key': process.env.DATA_API_KEY,
    },
  })
  const data = await res.json()

  return Response.json({ data })
}
```

> *"**Good to know**: Other supported HTTP methods are **not** cached, even if they are placed alongside a `GET` method that is cached, in the same file."*

The version history row that explains the internet's stale advice:

| Version | Change |
|---|---|
| `v15.0.0-RC` | *"The default caching for `GET` handlers was changed from static to dynamic"* |

Anything written against Next 13 or 14 assumes a `GET` handler is static unless you opt out, and tells you to add `export const dynamic = 'force-dynamic'` to stop surprise caching. On 16.3.4 that export solves a problem that no longer exists. The live hazard has moved to the other side: a handler that *should* be cheap and static is re-executed on every request, and nobody notices because it is correct — just expensive.

## Under Cache Components, the model changes again

> *"When Cache Components is enabled, `GET` Route Handlers follow the same model as normal UI routes in your application. They run at request time by default, can be prerendered when they don't access uncached or runtime data, and you can use `use cache` to include uncached data in the static response."*

Prerendering becomes a property of what the code *does*, not what you *declared*. The docs give three graded examples.

```tsx
// app/api/project-info/route.ts — prerendered at build: touches nothing dynamic
export async function GET() {
  return Response.json({
    projectName: 'Next.js',
  })
}
```

```tsx
// app/api/random-number/route.ts — prerendering stops at Math.random()
export async function GET() {
  return Response.json({
    randomNumber: Math.random(),
  })
}
```

```tsx
// app/api/user-agent/route.ts — prerendering terminates at headers()
import { headers } from 'next/headers'

export async function GET() {
  const headersList = await headers()
  const userAgent = headersList.get('user-agent')

  return Response.json({ userAgent })
}
```

The exhaustive trigger list, verbatim, is worth keeping to hand:

> *"Prerendering stops if the `GET` handler accesses network requests, database queries, async file system operations, request object properties (like `req.url`, `request.headers`, `request.cookies`, `request.body`), runtime APIs like `cookies()`, `headers()`, `connection()`, or non-deterministic operations."*

Read `req.url` in that list carefully. Merely reading the query string is enough to make a handler request-time — which is *correct*, because a response that varies by query string cannot be one prerendered artefact — and it surprises people who assumed only `cookies()` and `headers()` counted. So does "network requests": a handler that proxies an upstream API is request-time by that clause alone, unless the `fetch` is wrapped in a cached helper.

## `use cache` belongs in a helper, and the reason is mechanical

```tsx
// app/api/products/route.ts
import { cacheLife } from 'next/cache'

export async function GET() {
  const products = await getProducts()
  return Response.json(products)
}

async function getProducts() {
  'use cache'
  cacheLife('hours')

  return await db.query('SELECT * FROM products')
}
```

🔴 > *"`use cache` cannot be used directly inside a Route Handler body; extract it to a helper function. Cached responses revalidate according to `cacheLife` when a new request arrives."*

This is not an arbitrary restriction. A cache entry is keyed on its inputs and stores its output:

> *"A cache entry's key is generated using a serialized version of its inputs, which includes: 1. **Build ID** … 2. **Function ID** - A secure hash of the function's location and signature in the codebase 3. **Serializable arguments** … 4. **HMR refresh hash** (development only)"*

> *"Arguments to cached functions and their return values must be serializable."*

A handler receives a `Request` and returns a `Response`. A `Request` carries a body stream and headers — not a serialisable cache key. A `Response` likewise. A helper that takes strings and returns plain data gives the cache something it can key on and store, which is exactly why the extraction is required rather than merely recommended.

The same rule explains a subtlety about closures:

> *"When a cached function references variables from outer scopes, those variables are automatically captured and bound as arguments, making them part of the cache key."*

So a `use cache` helper that closes over a value silently widens its cache key. That is usually what you want and occasionally a surprise — a captured object that differs by reference per request produces a cache miss every time.

## The restriction that follows the call stack

🔴 > *"Cached functions and components **cannot** access runtime APIs like `cookies()`, `headers()`, or `searchParams`, and the restriction follows the call stack: a helper the cached function calls that reads one of these fails the same way, with the `next-request-in-use-cache` error. On a dynamically rendered route this surfaces when the route runs, so it can pass `next build` and fail under `next start`. Read these values outside the cached scope and pass them as arguments."*

That last property is the dangerous one: **it can pass `next build` and fail under `next start`**, because on a dynamically rendered route the cached function is not exercised until a real request arrives. A CI pipeline that builds and deploys sees green.

```ts
// BAD — the cached helper reaches a runtime API two frames down
async function getProducts() {
  'use cache'
  return await queryForTenant()          // queryForTenant() calls headers() → fails
}

// GOOD — read the runtime value outside, pass it in, and it becomes part of the key
import { headers } from 'next/headers'
import { cacheLife } from 'next/cache'

export async function GET() {
  const tenant = (await headers()).get('x-tenant') ?? 'public'
  return Response.json(await getProducts(tenant))
}

async function getProducts(tenant: string) {
  'use cache'
  cacheLife('hours')
  return await db.query('SELECT * FROM products WHERE tenant = $1', [tenant])
}
```

The docs also quote the build-time failure this produces on a *prerendered* route, which is the same mistake caught earlier:

> *"Error: Filling a cache during prerender timed out, likely because request-specific arguments such as params, searchParams, cookies() or uncached data were used inside \"use cache\"."*

> *"causing a timeout after 50 seconds"*

## Where the cache actually lives, per runtime

> **Serverless** — *"Cache entries typically don't persist across requests (each request can be a different instance), or during revalidation. Build-time caching works normally."*

> **Self-hosted** — *"Cache entries persist across requests."*

That table is the difference between `use cache` being a real hit-rate win and being decorative. On a serverless host, a `cacheLife('hours')` helper in a handler may still hit the database on most requests, because the instance holding the entry is not the instance answering. Build-time caching still works, so a genuinely static handler is still cheap — but a "cached" request-time handler on serverless is a hope, not a guarantee, unless the platform supplies a shared cache handler.

One more scoping rule that catches people combining the two caching systems:

> *"[`React.cache`] operates in an isolated scope inside `use cache` boundaries. Values stored via `React.cache` outside a `use cache` function are not visible inside it."*

So the per-request memoisation your Data Access Layer relies on ([02m](02m-the-data-access-layer.md)) does not deduplicate across a `use cache` boundary. A DAL function called both inside and outside a cached scope runs twice.

## Gotchas

**★ Symptom: a tutorial's `export const dynamic = 'force-dynamic'` appears to do nothing.** Cause: it is correcting a v14 default that no longer exists — since `v15.0.0-RC`, *"the default caching for `GET` handlers was changed from static to dynamic."* Fix: delete it, and if you actually wanted caching, opt in.

```ts
// app/items/route.ts
export const dynamic = 'force-static'
export async function GET() { return Response.json(await listItems()) }
```

**★ Symptom: `'use cache'` at the top of a `GET` handler errors.** Cause: it is not permitted in a handler body — a handler's input is a `Request` and its output a `Response`, and neither is a serialisable cache key or value. Fix: extract the data fetch into a helper and cache that.

```ts
import { cacheLife } from 'next/cache'

export async function GET() {
  return Response.json(await getProducts())
}

async function getProducts() {
  'use cache'
  cacheLife('hours')
  return db.query('SELECT * FROM products')
}
```

**★ Symptom: a `use cache` helper builds cleanly in CI and fails in production with `next-request-in-use-cache`.** Cause: something down the call stack reads `cookies()`, `headers()` or `searchParams`; on a dynamically rendered route the cached function is not exercised until a request arrives, so `next build` never runs it. Fix: hoist the runtime read into the handler and pass the value in as an argument, where it also becomes part of the cache key.

**★ Symptom: `next build` hangs on a route and then reports a cache-fill timeout.** Cause: the same mistake on a *prerendered* route — the docs quote *"Filling a cache during prerender timed out, likely because request-specific arguments such as params, searchParams, cookies() or uncached data were used inside \"use cache\""*. Fix: same fix; the failure just arrives earlier, which is better.

**★ Symptom: a `GET` handler that only reads `request.url` is never prerendered.** Cause: reading a request object property is on the documented list of things that stop prerendering, and a response varying by query string is not one artefact. Fix: this is correct behaviour — cache the expensive part in a helper rather than trying to make the route static.

```ts
export async function GET(request: Request) {
  const category = new URL(request.url).searchParams.get('category') ?? 'all'
  return Response.json(await getByCategory(category))   // cached per category
}

async function getByCategory(category: string) {
  'use cache'
  cacheLife('minutes')
  return db.query('SELECT * FROM products WHERE category = $1', [category])
}
```

**★ Symptom: a `cacheLife('hours')` helper appears to have almost no hit rate in production.** Cause: on a serverless host *"cache entries typically don't persist across requests (each request can be a different instance)"*. Fix: do not treat in-process caching as a database load reduction there — put the shared cache somewhere shared, or accept the reads. The documentation does not promise a hit rate on serverless and neither should your capacity plan.

**Symptom: `POST` responses look stale after adding `force-static` for the `GET` in the same file.** Cause: they are not — other methods are *"not cached, even if they are placed alongside a `GET` method that is cached, in the same file."* Fix: look at the outbound `fetch` options inside your handler and the response headers you send, not at the segment config.

**Symptom: a DAL function memoised with `React.cache` runs twice in one request.** Cause: *"[`React.cache`] operates in an isolated scope inside `use cache` boundaries"* — one call was inside a cached function and one outside. Fix: pick one side of the boundary for that read, or pass the already-fetched value in rather than re-reading it.

**Symptom: a cached helper misses on every request despite identical inputs.** Cause: it closes over a value that differs by reference per request; captured variables *"are automatically captured and bound as arguments, making them part of the cache key."* Fix: take the value as an explicit primitive argument so the key is stable.

## Interview questions

**★ A tutorial says to add `export const dynamic = 'force-dynamic'` to stop a `GET` handler caching. Is that right?**
It was, before v15. The version history records that in `v15.0.0-RC` *"the default caching for `GET` handlers was changed from static to dynamic"*, so on 16.3.4 a handler is not cached unless you opt in with `export const dynamic = 'force-static'`. Advice written for 13 or 14 has the polarity backwards and the export is a no-op. The nuance to add is that under Cache Components the question shifts again: a `GET` handler runs at request time by default but *can* be prerendered when it touches no uncached or runtime data, so what decides it is what your code accesses, not what you declared.

**★ Why can't `use cache` go in a Route Handler body, and what does that tell you about how the cache works?**
Because a cache entry's key is *"a serialized version of its inputs"* — the build ID, a hash of the function's location and signature, and its serialisable arguments — and the entry's value must be serialisable too. A handler takes a `Request`, which carries a body stream and headers, and returns a `Response`; neither is a serialisable key or value. Extracting the data fetch into a helper that takes strings and returns plain data gives the cache something it can key on and store, which is why the docs say *"extract it to a helper function"* rather than suggesting it. The same principle explains why runtime APIs are banned inside a cached scope: a value read from `cookies()` is an input that never appears in the key, so two different requests would share an entry.

**★ Why is `next-request-in-use-cache` a particularly dangerous class of bug?**
Because it can pass CI. The restriction *"follows the call stack"*, so a cached function is poisoned by any helper several frames down that reads `cookies()`, `headers()` or `searchParams` — and on a dynamically rendered route that code path is not executed during `next build` at all, so the failure first appears under `next start` or in production. The fix is structural rather than defensive: read runtime values in the uncached caller and pass them into the cached function as arguments, where they become part of the key and therefore correct rather than merely tolerated.

**★ Under Cache Components, what determines whether a `GET` handler is prerendered?**
What the code touches. It runs at request time by default and can be prerendered when it accesses neither uncached nor runtime data. Prerendering stops the moment the handler makes a network request, queries a database, does async filesystem work, reads a request property such as `req.url`, `request.headers`, `request.cookies` or `request.body`, calls `cookies()`, `headers()` or `connection()`, or does something non-deterministic like `Math.random()`. Reading the query string alone is enough, which is right — a response that varies by query string is not one artefact. If you want a static-ish response with fresh data, the route is a `use cache` helper with a `cacheLife` profile, which the docs describe as revalidating *"according to `cacheLife` when a new request arrives."*

**Your `cacheLife('hours')` helper barely helps in production. What is the first thing to check?**
Where the app runs. The documented runtime table says that on serverless *"cache entries typically don't persist across requests (each request can be a different instance), or during revalidation"*, while self-hosted entries do persist. So the same code has genuinely different behaviour on the two, and an hours-long profile on serverless can still miss constantly because the instance that filled the entry is not the one answering. Build-time caching works normally in both, so genuinely static output is still cheap. If you need shared caching on serverless, that has to come from a shared store or a platform cache handler rather than from the directive.

**Why does a `React.cache`-memoised DAL function sometimes run twice in one request?**
Because the two caching systems have separate scopes: *"[`React.cache`] operates in an isolated scope inside `use cache` boundaries. Values stored via `React.cache` outside a `use cache` function are not visible inside it."* If one call site is inside a `use cache` function and another is outside it, the memo does not bridge them and the work happens twice. The practical rule is to decide which side of the boundary a given read belongs on — usually outside, with the value passed inward as an argument, which also makes it part of the cache key.

---

← [02h · Route Handler mechanics](02h-route-handler-mechanics.md) · Next → [02j · Handler-only territory](02j-handler-only-territory.md)
