---
title: "`use cache: private` is the only directive that may read cookies, and the only one that stores nothing on your server"
sidebar_label: "4 · `use cache: private`"
sidebar_position: 9
description: "The compliance escape hatch: browser-memory-only caching, the two cacheLife thresholds that decide whether it prefetches at all, and why it is not a safe default."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-03 against the Next.js API reference for
> [`use cache: private`](https://nextjs.org/docs/app/api-reference/directives/use-cache-private)
> and [`use cache`](https://nextjs.org/docs/app/api-reference/directives/use-cache).
> Target: **Next.js 16.3.4**, App Router, Cache Components.
> Validated: 2026-09-05 · claims + version spine re-checked against the Next.js 16.3.4 docs · session d2e9b9fe

**`use cache: private` exists for two situations and no others: you cannot refactor the
runtime read out of the cached scope, or a compliance rule forbids the data resting on a
server even temporarily.** It is the only directive that may call `cookies()`, `headers()` or
read `searchParams` directly — and it pays for that by storing **nothing** server-side. Results
live in the browser's memory, do not persist across page reloads, and cannot be backed by a
custom cache handler. Because it reads runtime data, the function **executes on every server
render and is excluded from static shell generation**. That is a substantial permanent cost,
which is why the documentation frames it as a last resort rather than the convenient directive
that finally lets you use cookies.

## Usage

Same flag, then the directive plus a `cacheLife`:

```tsx filename="app/product/[id]/page.tsx"
import { Suspense } from 'react'
import { cookies } from 'next/headers'
import { cacheLife, cacheTag } from 'next/cache'

export async function generateStaticParams() {
  return [{ id: '1' }]
}

export default async function ProductPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  return (
    <div>
      <ProductDetails id={id} />
      <Suspense fallback={<div>Loading recommendations...</div>}>
        <Recommendations productId={id} />
      </Suspense>
    </div>
  )
}

async function Recommendations({ productId }: { productId: string }) {
  const recommendations = await getRecommendations(productId)
  return <div>{recommendations.map((rec) => <ProductCard key={rec.id} product={rec} />)}</div>
}

async function getRecommendations(productId: string) {
  'use cache: private'
  cacheTag(`recommendations-${productId}`)
  cacheLife({ stale: 60 })

  // Allowed here, and nowhere else
  const sessionId = (await cookies()).get('session-id')?.value || 'guest'
  return getPersonalizedRecommendations(productId, sessionId)
}
```

## What it may read

| API | `use cache` | `'use cache: private'` |
|---|---|---|
| `cookies()` | No | **Yes** |
| `headers()` | No | **Yes** |
| `searchParams` | No | **Yes** |
| `connection()` | No | **No** |

`connection()` stays prohibited in both, because it exposes connection-specific information
that cannot be safely cached at all. `private` lifts three of the four restrictions, not all
four.

## The two thresholds that decide whether it does anything useful

This is the part most easily missed, and it turns a working cache into a decorative one:

- **`stale` must be at least 30 seconds** for **per-link prefetching** to work.
- **`stale` must be at least 5 minutes** for the content to be included in the route's
  **App Shell**.

A `cacheLife({ stale: 10 })` is not a more aggressive cache. It is a cache that has opted out
of prefetching entirely. If you want the entry to participate in navigation, the lifetime has
to clear the relevant bar.

## What you give up

| | Consequence |
|---|---|
| **No server storage** | Results are never written to a server, even temporarily — the point of the directive |
| **Browser memory only** | Gone on reload. Not shared between tabs, devices, or users |
| **No custom cache handlers** | `cacheHandlers` cannot be configured for `private` |
| **Excluded from static shell** | The function executes on **every server render** |

That last row is the one with a performance price attached. A `private` scope is permanently
outside prerendering, so it can never contribute to a prerendered page.

One precision on the second row: the documentation states the scope as *"Per-client
(browser)"* and says results *"do not persist across page reloads"*. It does not say anything
about two tabs of the same browser, so do not build on either answer — an entry that dies with
the document cannot be relied on to outlive it in a sibling tab.

## Where it sits in a mixed page

`private` is normally one directive among three, handling only the genuinely per-user slice:

```tsx
// Shared, static
async function getProduct(id: string) {
  'use cache'
  cacheTag(`product-${id}`)
  return db.products.find({ where: { id } })
}

// Shared, request-time
async function getProductPrice(id: string) {
  'use cache: remote'
  cacheLife({ expire: 300 })
  return db.products.getPrice({ where: { id } })
}

// Per-user, never on a server
async function getRecommendations(productId: string) {
  'use cache: private'
  cacheLife({ expire: 60 })
  const sessionId = (await cookies()).get('session-id')?.value
  return db.recommendations.findMany({ where: { productId, sessionId } })
}
```

Remember the nesting rule from
[chunk 1b](01b-composing-the-three.md): **`remote` cannot nest inside `private`, and `private`
cannot nest inside `remote`**, in either direction.

## Version history

| Version | Change |
|---|---|
| `v16.0.0` | `"use cache: private"` enabled with the Cache Components feature |

## Gotchas

### Using it as the general fix for `next-request-in-use-cache`

**Symptom.** A cached function fails because it reads cookies; switching the directive to
`private` makes the error go away.

**Cause.** It makes the error go away by removing server-side caching altogether. The scope now
runs on every server render and never reaches the static shell. The error is gone; so is the
cache.

**Fix.** Hoist the read and pass the value as an argument. That is the documented preferred
pattern, and it keeps the scope prerenderable:

```tsx
// BAD — private used to silence the error
async function getRecs(productId: string) {
  'use cache: private'
  const sessionId = (await cookies()).get('session-id')?.value
  return db.recommendations.findMany({ where: { productId, sessionId } })
}

// GOOD — read outside, cache the shared dimension
async function Recs({ productId }: { productId: string }) {
  const language = (await cookies()).get('language')?.value ?? 'en'
  const content = await getCMSContent(language)   // 'use cache: remote'
  return <RecList content={content} />
}
```

### Setting `stale` below 30 seconds and wondering why prefetching stopped

**Symptom.** Navigations to a route feel slower after a "more aggressive" cache tuning.

**Cause.** `stale` must be **≥ 30 seconds** for per-link prefetching to work at all. Below
that, the entry does not participate.

**Fix.** Raise `stale` to at least 30 seconds, or accept that this content is not prefetchable
and stop treating the directive as a navigation optimisation.

### Expecting content to reach the App Shell at a 60-second `stale`

**Symptom.** The content never appears in the route's App Shell despite clearing the 30-second
prefetch bar.

**Cause.** Two different thresholds. Prefetching needs **30 seconds**; the **App Shell needs 5
minutes**.

**Fix.** If App Shell inclusion is the goal, `stale` must be at least 5 minutes — and if the
data cannot tolerate being 5 minutes old, it does not belong in the shell.

### Expecting the cache to survive a reload

**Symptom.** Every full page load re-executes the function; only client-side navigation
benefits.

**Cause.** Results are cached **only in the browser's memory** and explicitly do not persist
across page reloads.

**Fix.** This is the contract, not a bug. If persistence is required, the data has to be
allowed on a server — which means it was never a `private` case.

### Trying to configure a cache handler for it

**Symptom.** `cacheHandlers` configuration appears to have no effect on a `private` scope.

**Cause.** It is **not possible** to configure custom cache handlers for `'use cache: private'`.

**Fix.** None available. If you need handler-backed storage, you need `remote`, which means
the data must be allowed to rest on a server.

### Assuming `private` means "safe", and skipping authorization

**Symptom.** A per-user scope returns another user's data under some conditions.

**Cause.** `private` describes *where the result is stored*, not *who is allowed to ask*. It
performs no authorization. A `sessionId` read from a cookie is an identifier, not a permission
check.

**Fix.** Authorize in the data access layer as you would anywhere else. The caching directive
is orthogonal to access control.

### Reading `connection()` inside it

**Symptom.** An error, despite `private` being the permissive directive.

**Cause.** `connection()` is prohibited in **both** `use cache` and `use cache: private`.

**Fix.** Call `connection()` outside any cache scope — it is a deferral tool, not a data
source.

## Interview questions

**★ What is `use cache: private` for?**
Two cases only: caching a function that already accesses runtime data where refactoring to
pass values as arguments is impractical, and compliance requirements that prevent storing
certain data on the server even temporarily.

**★ Where are its results stored?**
In the browser's memory only. Never on the server, and they do not persist across page
reloads.

**★ Which request APIs can it read?**
`cookies()`, `headers()` and `searchParams`. **Not `connection()`** — that is banned in every
cache scope.

**★ What does it give up relative to `use cache`?**
All server-side caching. It executes on every server render, is excluded from static shell
generation, and cannot use a custom cache handler.

**★ What are the two `cacheLife` thresholds and what does each gate?**
`stale` ≥ **30 seconds** for per-link prefetching to work; `stale` ≥ **5 minutes** for content
to be included in the route's App Shell.

**★ Why isn't it the safe default for anything user-related?**
It permanently forfeits prerendering and server-side caching. Most user-related data is better
served by extracting the low-cardinality preference and caching the shared thing it selects.

**★ Can it nest with `use cache: remote`?**
No — in neither direction. `remote` inside `private` and `private` inside `remote` are both
prohibited.

**★ Does `private` provide any security guarantee about who can read the data?**
No. It constrains **where the result is stored**, not who may request it. Authorization still
belongs in the data access layer.

**★ When was it introduced?**
`v16.0.0`, with the Cache Components feature.

---

**Previous:** [3d · Cache handler failure modes](03d-cache-handler-failure-modes.md)
