---
title: "One page normally uses all three directives, because one page normally has all three kinds of data"
sidebar_label: "1b · Composing the three"
sidebar_position: 2
description: "The mixed caching strategy on a single page, and the nesting rules that make remote and private mutually exclusive in both directions."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-03 against the Next.js API reference for
> [`use cache`](https://nextjs.org/docs/app/api-reference/directives/use-cache),
> [`use cache: remote`](https://nextjs.org/docs/app/api-reference/directives/use-cache-remote) and
> [`use cache: private`](https://nextjs.org/docs/app/api-reference/directives/use-cache-private).
> Target: **Next.js 16.3.4**, App Router, Cache Components.

**Picking one directive per application is the wrong granularity — the unit of choice is a
piece of data, and a single product page has at least three.** The product record is identical
for everyone and known at build time. The price is identical for everyone on the same
currency but only knowable at request time. The recommendations are specific to one session
and must never be stored on a shared server. Those are three different answers to
[the two questions](01-choosing-a-directive.md), on one page, and the framework expects you to
use all three. What it does not allow is arbitrary nesting between them.

## The mixed strategy, in full

```tsx filename="app/product/[id]/page.tsx"
import { Suspense } from 'react'
import { connection } from 'next/server'
import { cookies } from 'next/headers'
import { cacheLife, cacheTag } from 'next/cache'

// Static product data — prerendered at build time, shared by everyone
async function getProduct(id: string) {
  'use cache'
  cacheTag(`product-${id}`)
  return db.products.find({ where: { id } })
}

// Shared pricing — request time, but identical for everyone on the same currency
async function getProductPrice(id: string) {
  'use cache: remote'
  cacheTag(`product-price-${id}`)
  cacheLife({ expire: 300 })
  return db.products.getPrice({ where: { id } })
}

// Per-user recommendations — never shared, never stored server-side
async function getRecommendations(productId: string) {
  'use cache: private'
  cacheLife({ expire: 60 })
  const sessionId = (await cookies()).get('session-id')?.value
  return db.recommendations.findMany({ where: { productId, sessionId } })
}

export default async function ProductPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const product = await getProduct(id)

  return (
    <div>
      <ProductDetails product={product} />

      <Suspense fallback={<PriceSkeleton />}>
        <ProductPriceComponent productId={id} />
      </Suspense>

      <Suspense fallback={<RecommendationsSkeleton />}>
        <ProductRecommendations productId={id} />
      </Suspense>
    </div>
  )
}

async function ProductPriceComponent({ productId }: { productId: string }) {
  await connection()               // deliberately defer to request time
  const price = await getProductPrice(productId)
  return <div>Price: ${price}</div>
}

async function ProductRecommendations({ productId }: { productId: string }) {
  const recommendations = await getRecommendations(productId)
  return <RecommendationsList items={recommendations} />
}
```

The static half renders immediately and contributes to the route's static shell; the two
dynamic halves sit behind their own `<Suspense>` boundaries and stream in.

Note `await connection()` in `ProductPriceComponent`. Nothing else in that component reads
request data, so without it the component would be a candidate for the static shell — and a
price cached into the shell is a price frozen at build time. `connection()` is how you say
"this must run per request" when no other API has said it for you.

## The nesting rules

The three directives do **not** compose freely. Remote and private are mutually exclusive in
both directions:

| Outer | Inner | Allowed |
|---|---|---|
| `'use cache: remote'` | `'use cache: remote'` | ✅ |
| `'use cache'` | `'use cache: remote'` | ✅ |
| `'use cache: private'` | `'use cache: remote'` | ❌ |
| `'use cache: remote'` | `'use cache: private'` | ❌ |

```tsx
// VALID — remote inside a regular cache. The inner remote cache
// does its work when the outer scope is deferred to request time.
async function outerCache() {
  'use cache'
  return await innerRemote()
}
async function innerRemote() {
  'use cache: remote'
  return getData()
}

// INVALID — remote inside private
async function outerPrivate() {
  'use cache: private'
  return await innerRemote()   // Error
}

// INVALID — private inside remote
async function outerRemote() {
  'use cache: remote'
  return await innerPrivate()  // Error
}
```

The rule follows from what the two directives promise. `private` guarantees the value never
rests on a server; `remote` guarantees it does. Nesting either inside the other would make one
of those promises false, so the framework refuses rather than silently picking a winner.

Nesting a plain `use cache` inside another also has a lifetime rule attached, covered in
**[chunk 5](05-revalidation-and-lifetimes.md)**: a short-lived cache nested inside one with no
explicit `cacheLife` fails the build during prerendering.

## Gotchas

### Nesting remote inside private, or private inside remote

**Symptom.** An error at the nesting site, often appearing after a refactor that moved a
helper into a different scope rather than after any deliberate caching change.

**Cause.** Those two combinations are prohibited in both directions, because each directive
makes an opposite promise about whether the value rests on a server.

**Fix.** Decide which promise the data actually needs and use one directive for the whole
chain. If both are genuinely needed, split the work rather than nesting — compute the shared
part in a `remote` scope, return it, and let the `private` scope consume the *result*:

```tsx
// BAD — private wrapping remote
async function getPersonalisedFeed() {
  'use cache: private'
  const shared = await getTrendingItems()   // 'use cache: remote' — Error
  const sessionId = (await cookies()).get('session-id')?.value
  return rank(shared, sessionId)
}

// GOOD — call the remote scope outside, pass the result in
async function Feed() {
  const shared = await getTrendingItems()   // 'use cache: remote'
  return <PersonalisedFeed shared={shared} />
}

async function PersonalisedFeed({ shared }: { shared: Item[] }) {
  'use cache: private'
  const sessionId = (await cookies()).get('session-id')?.value
  return <FeedList items={rank(shared, sessionId)} />
}
```

### Expecting entries to survive a deploy

**Symptom.** Every deploy produces a cold cache and a load spike on the upstream.

**Cause.** The cache key includes the **build ID** — or `deploymentId` when configured — for
all three directives. This is deliberate: between builds a function's identity hash or return
shape can change (upgrading a CMS client, refactoring the function, changing a dependency), so
reusing old entries risks serving stale or malformed data.

**Fix.** Accept it and plan for the spike, or use `unstable_cache` for non-`fetch` functions,
or the `fetch` cache, where cross-deploy persistence genuinely matters.

### Caching a request-time value into the static shell by omission

**Symptom.** A price, a stock count or a rate renders correctly in development and is frozen
at its build-time value in production.

**Cause.** A `use cache` scope that reads nothing request-specific is a candidate for
prerendering, so it gets filled at build and contributes to the static shell. Nothing warns
you, because nothing is wrong from the framework's point of view.

**Fix.** Call `await connection()` in the component that must run per request, or give the
scope a `cacheLife` short enough that it cannot be stored in the shell — see
**[chunk 5](05-revalidation-and-lifetimes.md)** for those thresholds.

## Interview questions

**★ Why would one page use all three directives?**
Because one page has three kinds of data: shared-and-static, shared-and-request-time, and
per-user. The unit of choice is a piece of data, not an application.

**★ Which nesting combinations are illegal, and why?**
`remote` inside `private`, and `private` inside `remote` — both directions. `private` promises
the value never rests on a server and `remote` promises it does; nesting would falsify one.

**★ Is `remote` inside a plain `use cache` allowed?**
Yes. The inner remote cache does its work when the outer scope is deferred to request time.

**★ What is `connection()` for?**
Deliberately deferring a component to request time when nothing else in it would have. Without
it, a scope that reads no request data is a candidate for the static shell.

**★ What exactly goes into a cache key?**
The build ID (or `deploymentId`), a hash of the function's location and signature, the
serializable arguments, and — in development only — an HMR refresh hash.

**★ Why do cache entries not survive a deployment?**
The key includes the build ID. Between builds a function's identity or return shape can
change, so reusing entries could serve malformed data. Use `unstable_cache` or the `fetch`
cache when cross-deploy persistence is required.

**★ You need a per-user ranking of a shared, expensive list. How do you structure it?**
Do not nest. Compute the shared list in a `use cache: remote` scope, call it *outside*, and
pass the result into a `use cache: private` scope that applies the per-user ranking.

**★ A price is correct locally and stale in production. What is the first thing to check?**
Whether the scope reads anything request-specific. If it does not, it was prerendered into the
static shell. Add `await connection()` or shorten its `cacheLife`.

---

**Next:** [1c · Slots, pass-through and cache-key cardinality](01c-slots-and-cache-keys.md)
