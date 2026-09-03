---
title: "There are three cache directives, and the choice between them is a data-placement decision"
sidebar_label: "1 · Choosing a directive"
sidebar_position: 1
description: "use cache, use cache: remote and use cache: private — what each one stores, where it stores it, and the two questions that pick one."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-03 against the Next.js API reference for
> [`use cache`](https://nextjs.org/docs/app/api-reference/directives/use-cache),
> [`use cache: remote`](https://nextjs.org/docs/app/api-reference/directives/use-cache-remote) and
> [`use cache: private`](https://nextjs.org/docs/app/api-reference/directives/use-cache-private).
> Target: **Next.js 16.3.4**, App Router, Cache Components.

**Next.js ships three caching directives, not one, and choosing between them is not a
performance tuning exercise — it is a decision about where a piece of data is allowed to
rest.** `use cache` keeps the entry in the server's memory. `use cache: remote` puts it in a
shared store every server instance can reach. `use cache: private` never writes it to a
server at all; it lives in one browser's memory and dies on reload. All three are enabled by
the same `cacheComponents` flag and share the same `cacheLife`/`cacheTag` vocabulary, which
makes them look interchangeable. They are not. Pick the wrong one and you either leak one
user's data into another user's response, or pay a network round trip for a cache that was
never going to hit.

## Enabling them

All three require Cache Components:

```ts filename="next.config.ts"
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  cacheComponents: true,
}

export default nextConfig
```

Then the directive goes at the top of a file, a component, or a function. **Anything a cache
directive covers must be `async`.**

```tsx
// Function level
export async function getData() {
  'use cache'
  const res = await fetch('https://api.example.com/data')
  return res.json()
}

// Component level
export async function MyComponent() {
  'use cache'
  return <></>
}
```

At file level the directive covers **every export**, and each one must be async — including
framework exports like `generateMetadata` and `generateStaticParams` if they live in that
file.

```tsx filename="app/lib/reports.ts"
'use cache'

export async function getMonthlyTotals(accountId: string) {
  return db.orders.aggregate({ where: { accountId }, _sum: { amount: true } })
}

export async function getTopProducts() {
  return db.products.findMany({ orderBy: { sales: 'desc' }, take: 10 })
}
```

A file-level directive on a `page` or `layout` behaves the same way — each route segment is a
separate entry point and is cached independently. **To prerender a whole route you add the
directive to every segment file it renders**: the `page`, the `layout`, and any parallel-route
slots.

## The comparison that actually decides it

| | `use cache` | `'use cache: remote'` | `'use cache: private'` |
|---|---|---|---|
| **Server-side storage** | In-memory, or a cache handler | Remote cache handler | **None** |
| **Scope** | Shared across all users | Shared across all users | **Per-client (browser)** |
| **Can read `cookies()`/`headers()` directly** | No — pass as arguments | No — pass as arguments | **Yes** |
| **Server cache utilization** | May be low outside the static shell | High — shared across instances | N/A |
| **Additional cost** | None | Infrastructure: storage, network | None |
| **Latency impact** | None | Cache handler lookup | None |
| **Persists across deploys** | No | No | N/A |

## Two questions pick the directive

**Question 1 — does the scope need to read request data?**

`cookies()`, `headers()` and `searchParams` are **forbidden** inside `use cache` and
`use cache: remote`. The restriction follows the call stack: a helper that the cached function
calls, which reads one of them, fails identically with the `next-request-in-use-cache` error.

The preferred fix is not a different directive. It is to **read the value outside the cached
scope and pass it in as an argument**:

```tsx
async function ProductPrice({ productId }: { productId: string }) {
  // Read outside — this defers the component to request time
  const currency = (await cookies()).get('currency')?.value ?? 'USD'
  const price = await getProductPrice(productId, currency)
  return <div>Price: {price} {currency}</div>
}

async function getProductPrice(productId: string, currency: string) {
  'use cache: remote'
  cacheLife({ expire: 3600 })
  return db.products.getPrice(productId, currency)
}
```

Only when you genuinely cannot refactor to that shape — or a compliance rule forbids the data
resting on a server even briefly — does `use cache: private` become the answer.

**Question 2 — may this data rest on a shared server?**

If the answer is no, `use cache: private` is the only option, because it is the only one that
never writes to server storage. If the answer is yes, the choice between `use cache` and
`use cache: remote` is an economics question, covered in
**[chunk 3](03-use-cache-remote.md)**.

## The decision tree

1. **Does the scope read `cookies()`, `headers()` or `searchParams`?**
   - No → go to 2.
   - Yes, and you can hoist the read out and pass a value → hoist it, then go to 2. **This is
     the preferred path.**
   - Yes, and you genuinely cannot (compliance, or an un-refactorable call graph) →
     **`use cache: private`**.
2. **Is the content in the static shell — prerendered, not deferred to request time?**
   - Yes → **`use cache`**. The entry is filled at prerender and the remote round trip buys
     you nothing.
   - No, it renders at request time → go to 3.
3. **Is the upstream fragile, rate-limited, slow or expensive, and does the cache key have
   few distinct values?**
   - Yes → **`use cache: remote`** earns its infrastructure cost.
   - No → plain **`use cache`**, or no cache at all.

## `connection()` is banned in every cache scope

`connection()` is prohibited inside **both** `use cache` and `use cache: private` — it exposes
connection-specific information that cannot be safely cached at all.

| API | `use cache` | `'use cache: private'` |
|---|---|---|
| `cookies()` | No | **Yes** |
| `headers()` | No | **Yes** |
| `searchParams` | No | **Yes** |
| `connection()` | No | **No** |

Note the asymmetry in the last row: `use cache: private` relaxes three of the four
restrictions and keeps one. It is a per-client cache, not an unrestricted one.

Read the other direction, that table is also the reason `connection()` is useful *outside* a
cache scope: calling it is how you deliberately defer a component to request time when it
reads nothing else that would have deferred it anyway.

## Gotchas

### Reaching for `use cache: private` because `cookies()` threw

**Symptom.** You add `use cache` to a function, the build or the request fails with
`next-request-in-use-cache`, and the quickest-looking fix is to change the directive to
`use cache: private` because that one is allowed to read cookies.

**Cause.** `private` is documented as the escape hatch for when you *cannot* refactor — not
as the general answer to the error. Switching to it silently gives up **all server-side
caching**: the scope now runs on every server render and is excluded from static shell
generation. You traded a build error for a permanent per-request cost.

**Fix.** Hoist the read and pass the value.

```tsx
// BAD — private used to dodge the error, no server cache at all
async function getRecommendations(productId: string) {
  'use cache: private'
  const sessionId = (await cookies()).get('session-id')?.value
  return db.recommendations.findMany({ where: { productId, sessionId } })
}

// GOOD — read outside, cache on the low-cardinality dimension
async function Recommendations({ productId }: { productId: string }) {
  const language = (await cookies()).get('language')?.value ?? 'en'
  const content = await getCMSContent(language)
  return <Recs content={content} />
}

async function getCMSContent(language: string) {
  'use cache: remote'
  cacheLife({ expire: 3600 })
  return cms.getHomeContent(language)
}
```

### Treating the three directives as a performance dial

**Symptom.** A team convention like "use `remote` for anything slow."

**Cause.** Reading the three as fast/faster/fastest rather than as three storage locations
with different visibility.

**Fix.** Ask the two questions. `remote` on a key with per-request-unique values has
**near-zero** utilization and still costs a network round trip on every miss — strictly worse
than no cache.

### The error passes `next build` and fails under `next start`

**Symptom.** CI is green. The route 500s in production with `next-request-in-use-cache`.

**Cause.** On a **dynamically rendered** route the forbidden read is only reached when the
route actually runs. Nothing forces that path during the build, so the build has no
opportunity to fail.

**Fix.** Do not treat a green build as proof that no cached scope reads request data. Exercise
dynamic routes against a production build before shipping, and prefer hoisting reads to the
component boundary where the constraint is visible in the source.

### A non-async export under a file-level directive

**Symptom.** The file compiles in isolation but fails once the directive is added at the top.

**Cause.** A file-level cache directive covers **every** export, and all of them must be
async. Framework exports are not exempt — `generateMetadata` and `generateStaticParams`
included.

**Fix.** Make them async, or move the synchronous export to another file.

```tsx
// BAD
'use cache'
export function formatCurrency(n: number) { return `$${n}` }   // not async

// GOOD — move it out; it was never cacheable anyway
```

## Interview questions

**Q. What are the three cache directives and what distinguishes them?**
`use cache` (server memory or a cache handler, shared across users), `use cache: remote` (a
remote handler, shared across users and across server instances) and `use cache: private`
(no server storage at all — browser memory, per client). All three need `cacheComponents: true`.

**Q. Which request APIs can each read?**
`use cache` and `use cache: remote` can read none of `cookies()`, `headers()`, `searchParams`.
`use cache: private` can read all three. **`connection()` is banned in all of them.**

**Q. The preferred way to use request data with a cached function?**
Read it **outside** the cached scope and pass it as an argument. `use cache: private` is for
compliance requirements or when refactoring genuinely is not possible.

**Q. Why is `use cache: private` not simply the safest default?**
It gives up server-side caching entirely: the function runs on every server render and is
excluded from static shell generation. It is a targeted escape hatch, not a safe default.

**Q. Where does the restriction on request APIs apply — only in the cached function itself?**
Along the whole call stack. A helper called by the cached function that reads `cookies()`
fails the same way.

**Q. Can a forbidden request-API read survive `next build`?**
Yes. On a dynamically rendered route the failure surfaces when the route runs, so it can pass
the build and fail under `next start`.

**Q. Your dashboard shows global stats, identical for every user, behind an auth check, and
the query is expensive. Which directive?**
`use cache: remote`. It renders at request time (so plain `use cache` gets poor server-side
utilization in serverless), the value is shared by everyone, and the upstream is expensive.
Add `cacheLife` to bound the upstream to one query per window.

**Q. When is `use cache: remote` the wrong call?**
When the operation is already fast (under ~50ms), when the data changes every few seconds, or
when the cache key carries mostly-unique values per request — search filters, price ranges,
user IDs. Utilization approaches zero while you still pay the lookup.

**Q. What does it take to prerender a whole route with `use cache`?**
The directive on **every segment file the route renders** — the `page`, the `layout`, and any
parallel-route slots. Each segment is a separate entry point cached independently.

---

**Next:** [1b · Composing the three, and what a shared cache costs you](01b-composing-the-three.md)
