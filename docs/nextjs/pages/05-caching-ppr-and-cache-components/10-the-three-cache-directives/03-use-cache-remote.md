---
title: "`use cache: remote` buys a shared, durable cache, and you pay for it in latency and infrastructure"
sidebar_label: "3 · `use cache: remote`"
sidebar_position: 5
description: "When a remote cache handler earns its cost, when it is strictly worse than nothing, and how cache-key cardinality decides which it is."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-03 against the Next.js API reference for
> [`use cache: remote`](https://nextjs.org/docs/app/api-reference/directives/use-cache-remote)
> and [`use cache`](https://nextjs.org/docs/app/api-reference/directives/use-cache).
> Target: **Next.js 16.3.4**, App Router, Cache Components.
> Validated: 2026-09-05 · claims + version spine re-checked against the Next.js 16.3.4 docs · session d2e9b9fe

**`use cache: remote` is the answer to one specific complaint: cached operations re-running
more often than they should, and upstream services taking more traffic than the page view
count suggests they should.** Plain `use cache` stores entries in memory, and memory is
evicted, constrained, and — in serverless — not shared between instances or preserved across
requests. `remote` moves the entry into a handler every instance can reach. That is a real
fix with a real bill: infrastructure cost, and a network round trip on every lookup. It is
the declarative version of putting a key-value store in front of your database, and it is
worth exactly as much as that decision usually is: a great deal in some places, nothing in
most.

## Enabling it

Same flag as the others, plus a handler:

```ts filename="next.config.ts"
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  cacheComponents: true,
}

export default nextConfig
```

The handler implementation is configured via **`cacheHandlers`**. Hosting providers should
typically supply this automatically; **if you self-host, you configure the storage yourself —
and if you do not, the directive silently falls back to the same in-memory LRU that plain
`use cache` uses.** That configuration surface is [chunk 3b](03b-configuring-cache-handlers.md),
the handler interface is [chunk 3c](03c-writing-a-cache-handler.md), and the ways a working
handler still fails are [chunk 3d](03d-cache-handler-failure-modes.md).

## When it makes sense

Remote caching provides the most value when content is **deferred to request time** — outside
the static shell. That normally happens because a component reads `cookies()`, `headers()` or
`searchParams` and therefore sits inside a Suspense boundary. In that situation:

- each request executes the component and looks up the cache;
- in serverless, each instance has its own ephemeral memory and a low hit rate;
- a remote cache is shared across all instances, raising the hit rate and cutting backend load.

The compelling cases:

| Situation | Why remote wins |
|---|---|
| **Rate-limited APIs** | You risk hitting quotas; a shared cache collapses N requests into one |
| **Slow backends** | The database becomes the bottleneck under traffic |
| **Expensive operations** | Costly queries or computations repeated needlessly |
| **Flaky services** | External services that intermittently fail or are unavailable |

In each, the cost and latency of remote caching is justified by avoiding a worse outcome:
rate-limit errors, backend overload, high compute bills, or a degraded user experience.

## When to avoid it

- You **already have a key-value store wrapping your data layer** — plain `use cache` may be
  enough to get the data into the static shell without adding a second caching layer.
- Operations are **already fast (under ~50ms)** through proximity or local access — the remote
  lookup may not improve anything.
- Cache keys carry **mostly unique values per request** (search filters, price ranges,
  user-specific parameters) — utilization approaches zero.
- Data **changes every few seconds to minutes** — hits go stale fast, producing frequent misses
  that still wait on the upstream.

The last two are the ones that bite, because in both the code looks correct and the cache
simply never pays.

## Cardinality is the whole game

Every distinct key value is a separate entry. The winning pattern is to **find the dimension
with fewer unique values and cache on that**, filtering the rest in memory.

```tsx filename="app/products/[category]/page.tsx"
async function ProductList({ params, searchParams }) {
  const { category } = await params
  const { minPrice } = await searchParams

  // Cache on category (few values). Do NOT include price (many values).
  const products = await getProductsByCategory(category)

  const filtered = minPrice
    ? products.filter((p) => p.price >= parseFloat(minPrice))
    : products

  return <div>{/* render filtered */}</div>
}

async function getProductsByCategory(category: string) {
  'use cache: remote'
  return db.products.findByCategory(category)
}
```

The entry is deliberately **larger** — every product in the category — in exchange for a hit
rate that actually protects the backend. That trade is worth it when the cost of a miss
outweighs the storage cost of a bigger entry.

The same reasoning applies to user data, and it is the more important case:

- ❌ remote-caching `getUserProfile(sessionID)` → **one entry per user**
- ✅ remote-caching `getCMSContent(language)` → **one entry per language**

```tsx filename="app/components/welcome-message.tsx"
import { cookies } from 'next/headers'
import { cacheLife } from 'next/cache'

export async function WelcomeMessage() {
  // Extract the preference — not unique per user
  const language = (await cookies()).get('language')?.value || 'en'
  const content = await getCMSContent(language)
  return <div>{content.welcomeMessage}</div>
}

async function getCMSContent(language: string) {
  'use cache: remote'
  cacheLife({ expire: 3600 })
  // ~10-50 entries instead of thousands
  return cms.getHomeContent(language)
}
```

If the service behind `getUserProfile` genuinely cannot scale with frontend load, a short
`cacheLife` on plain `use cache` may help. For most user data, fetch from the source — which
is often already behind a key-value store of its own. **Reach for `use cache: private` only
for compliance requirements or when you cannot refactor to pass runtime data as arguments.**

## Deferring on purpose with `connection()`

Sometimes the value is shared by everyone and reads nothing request-specific, yet you still
do not want it in the static shell — a stats panel that must be current, for instance.
`connection()` defers it explicitly:

```tsx filename="app/dashboard/page.tsx"
import { Suspense } from 'react'
import { connection } from 'next/server'
import { cacheLife, cacheTag } from 'next/cache'

export default function DashboardPage() {
  return (
    <Suspense fallback={<div>Loading stats...</div>}>
      <DashboardStats />
    </Suspense>
  )
}

async function DashboardStats() {
  await connection()                      // defer to request time
  const stats = await getGlobalStats()
  return <StatsDisplay stats={stats} />
}

async function getGlobalStats() {
  'use cache: remote'
  cacheTag('global-stats')
  cacheLife({ expire: 60 })
  return db.analytics.aggregate({
    total_users: 'count',
    active_sessions: 'count',
    revenue: 'sum',
  })
}
```

The upstream now sees **at most one query per minute**, however many users load the dashboard.

## Platform support

| Deployment | `use cache: remote` |
|---|---|
| Node.js server | Yes |
| Docker container | Yes |
| **Static export** | **No** |
| Adapters | Yes |

Note this differs from plain `use cache`, where adapter support is platform-specific rather
than a flat yes.

## Gotchas

### Remote-caching a key with per-request-unique values

**Symptom.** Cache metrics show near-zero hit rate, latency is *worse* than before, and the
infrastructure bill is real.

**Cause.** Search filters, price ranges and user IDs produce a distinct key per request. Every
lookup misses, and every miss still pays the network round trip before falling through to the
upstream.

**Fix.** Cache on the low-cardinality dimension and filter the rest in memory, as in
`getProductsByCategory` above. If no such dimension exists, do not use a remote cache.

### Adding remote caching in front of a store that already exists

**Symptom.** Two caching layers, twice the invalidation surface, no measurable improvement.

**Cause.** If your data layer is already wrapped in a key-value store, `use cache` may be all
you need to get the value into the static shell. `remote` adds a second layer solving a
problem the first already solved.

**Fix.** Establish where the actual miss is happening before adding a layer.

### Expecting remote entries to survive a deploy

**Symptom.** Every release cold-starts the shared cache and the upstream takes a spike.

**Cause.** Remote entries **do not persist across deploys** — the key includes `deploymentId`
(when configured) or the build ID, so a new build produces new keys. This is intentional:
between builds the function's identity hash or return shape can change, and reusing entries
could serve stale or malformed data.

**Fix.** Plan for the spike. If persistence across deploys is genuinely required, use
`unstable_cache` for non-`fetch` functions, or the `fetch` cache.

### Using it for content that is in the static shell

**Symptom.** Extra latency on prerendered content that was already fast.

**Cause.** For static shell content, plain `use cache` is normally sufficient — the entry is
filled at prerender, so a remote lookup adds a round trip and buys nothing.

**Fix.** Keep `remote` for content deferred to request time. The exception worth knowing: if
the upstream cannot handle concurrent **revalidation** requests — a rate-limited CMS, say —
`use cache: remote` acts as the shared layer that collapses them.

### Reaching for `private` when `remote` was the right answer

**Symptom.** Per-user data is uncached and the backend is still overloaded.

**Cause.** Assuming that anything touching a user needs `private`. Very often the *shared*
thing the user's preference selects is what should be cached.

**Fix.** Extract the preference and cache on it. `private` is for compliance or
un-refactorable code, not for "this request involved a user."

## Interview questions

**★ What problem does `use cache: remote` solve?**
In-memory entries are evicted, memory-constrained, and in serverless not shared across
instances or preserved across requests. `remote` provides durable caching shared by every
server instance.

**★ What does it cost?**
Infrastructure (storage, network) and a cache-handler lookup on every access.

**★ Where does remote caching provide the most value?**
For content deferred to request time — outside the static shell — typically because the
component reads `cookies()`, `headers()` or `searchParams` and sits inside a Suspense boundary.

**★ Name four situations where it is the wrong tool.**
An existing key-value store already wrapping the data layer; operations already under ~50ms;
cache keys with mostly-unique values per request; data that changes every few seconds.

**★ Why is a bigger cache entry sometimes the better design?**
Because hit rate is decided by key cardinality. Caching all products in a category — rather
than per price filter — trades storage for a hit rate that actually protects the backend.

**★ How do you cache per-user-preference data without one entry per user?**
Cache the shared thing the preference selects: `getCMSContent(language)`, not
`getUserProfile(sessionId)`. Tens of entries instead of thousands.

**★ Do remote cache entries persist across deploys?**
No. The key includes `deploymentId` or the build ID. Intentional — a function's identity or
return shape may change between builds.

**★ What is `connection()` for in this context?**
Explicitly deferring a component to request time when nothing else in it would have, so a
value that must be current does not get frozen into the static shell.

**★ Which deployment target does `use cache: remote` not support?**
Static export.

**★ Your CMS is rate-limited and struggles with concurrent revalidation of static content.
Does `remote` help, given the content is in the static shell?**
Yes — this is the documented exception. It acts as a shared layer that collapses concurrent
revalidation requests into one.

---

**Next:** [3b · Configuring `cacheHandlers`](03b-configuring-cache-handlers.md)
