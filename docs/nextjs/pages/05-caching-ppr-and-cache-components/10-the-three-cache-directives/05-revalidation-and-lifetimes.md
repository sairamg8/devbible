---
title: "Set `cacheLife` explicitly in every cached scope, or the lifetime stops being visible at the call site"
sidebar_label: "5 · Revalidation and lifetimes"
sidebar_position: 7
description: "Time-based and on-demand revalidation, the default profile's real numbers, the nested short-lived cache build failure, and the 50-second prerender timeout."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-03 against the Next.js API reference for
> [`use cache`](https://nextjs.org/docs/app/api-reference/directives/use-cache)
> and the [`cacheLife`](https://nextjs.org/docs/app/api-reference/functions/cacheLife) reference.
> Target: **Next.js 16.3.4**, App Router, Cache Components.

**A cached scope without an explicit `cacheLife` still has a lifetime — you just cannot see it
where you are reading.** It inherits the `default` profile, whose numbers are not obvious
(stale 5 minutes, revalidate 15 minutes, never expires by time), and it interacts with any
cache it is nested inside. The documentation's recommendation is unambiguous: set `cacheLife`
in **every** `use cache` scope, so behaviour is stated at the call site rather than inferred
from a default or from a surrounding cache. The two revalidation strategies — time-based and
on-demand — are not alternatives; the useful configurations usually pair them.

## The two strategies, and why they pair

| | Mechanism | Fits |
|---|---|---|
| **Time-based** | `cacheLife` | Content that drifts on its own — a list of recent posts |
| **On-demand** | `cacheTag` + `revalidateTag` / `updateTag` | Content that changes at a known moment — a post its author edits |

🔴 **`revalidateTag` takes a required second argument and `updateTag` is Server-Action-only —
both are covered in [5b](05b-revalidatetag-and-updatetag.md).**

A blog post that changes only when edited takes a long `cacheLife` such as `max` plus a
`cacheTag`, invalidated on save. A list of recent posts that drifts through the day takes a
shorter profile such as `hours` and refreshes itself with no manual invalidation.

```tsx filename="lib/data.ts"
import { cacheLife, cacheTag } from 'next/cache'

async function getData() {
  'use cache'
  cacheLife('hours')                       // built-in profile
  const res = await fetch('https://api.example.com/data')
  return res.json()
}

async function getProducts() {
  'use cache'
  cacheTag('products')
  const res = await fetch('https://api.example.com/products')
  return res.json()
}
```

```tsx filename="app/actions.ts"
'use server'
import { updateTag } from 'next/cache'

export async function updateProduct() {
  await db.products.update(/* ... */)
  updateTag('products')                    // invalidates every 'products' cache
}
```

Both `cacheLife` and `cacheTag` integrate across the client and server caching layers, so the
semantics are configured once and apply in both places.

## The `default` profile's actual numbers

Omit `cacheLife` and you get:

| Field | Value | Where it applies |
|---|---|---|
| `stale` | **5 minutes** | Client-side |
| `revalidate` | **15 minutes** | Server-side |
| `expire` | **never expires by time** | — |

None of those are guessable from reading the call site, which is the argument for always
stating the profile.

Recall the two floors from the neighbouring chunks: the **client router enforces a 30-second
minimum stale time** whatever you configure, and for `use cache: private`, `stale` must be
**≥ 30s** to prefetch and **≥ 5 minutes** to reach the App Shell.

## Nesting: the inner lifetime is not local

An inner cached function's lifetime affects the entry around it. Concretely:

🔴 **Nesting a short-lived `use cache` inside one that has no explicit `cacheLife` fails the
build during prerendering.**

The fix is to state the lifetime on the outer scope, rather than letting it fall through to
`default` and collide with the inner one.

```tsx
// BAD — outer has no explicit cacheLife, inner is short-lived → build failure
async function outer() {
  'use cache'
  return await inner()
}
async function inner() {
  'use cache'
  cacheLife('seconds')
  return getData()
}

// GOOD — the outer lifetime is stated, so the relationship is explicit
async function outer() {
  'use cache'
  cacheLife('seconds')
  return await inner()
}
```

## Caching does not have to be all-or-nothing within a module

A useful pattern the docs make explicit: an uncached function called from inside a cached one
runs only when the cached one runs, and can still be exported for uncached callers.

```tsx filename="lib/orders.ts"
import { cacheLife } from 'next/cache'

export async function getOrderSummary(accountId: string) {
  'use cache'
  cacheLife('hours')
  const orders = await getOrders(accountId)
  const totals = await getOrderTotals(accountId)
  return { orders, totals }
}

export async function getOrders(accountId: string) {
  'use cache'
  cacheLife('hours')
  return db.orders.findMany({ where: { accountId } })
}

// NOT cached — exported so other code can read fresh totals
export async function getOrderTotals(accountId: string) {
  return db.orders.aggregate({ where: { accountId }, _sum: { amount: true } })
}
```

Each `accountId` gets its own `getOrderSummary` entry holding the serialized `{ orders,
totals }`. `getOrders` has its own entries keyed the same way — so if an earlier call already
filled one, `db.orders.findMany` does not run and those orders become part of the summary's
output. Inside `getOrderSummary`, the totals query runs only when that function runs, on the
`'hours'` lifetime set there.

## The 50-second prerender timeout

If a build hangs, the cause is a cached scope awaiting a Promise that resolves to uncached or
runtime data created **outside** the cache boundary. It cannot resolve during the build, and
the fill times out after **50 seconds** with:

> Error: Filling a cache during prerender timed out, likely because request-specific arguments
> such as params, searchParams, cookies() or uncached data were used inside "use cache".

Three ways it happens:

**1 · Passing a runtime Promise as a prop**

```tsx
async function Dynamic() {
  const cookieStore = cookies()          // not awaited
  return <Cached promise={cookieStore} /> // build hangs
}

async function Cached({ promise }: { promise: Promise<unknown> }) {
  'use cache'
  const data = await promise             // waits forever during build
  return <p>..</p>
}
```

Await the store in `Dynamic` and pass a **value** into `Cached`.

**2 · Reaching it through a closure** — the same problem with the Promise captured rather than
passed.

**3 · Retrieving it from shared storage**

```tsx
const cache = new Map<string, Promise<string>>()

async function Dynamic({ id }: { id: string }) {
  cache.set(id, fetch(`https://api.example.com/${id}`).then((r) => r.text()))
  return <p>Dynamic</p>
}

async function Cached({ id }: { id: string }) {
  'use cache'
  return <p>{await cache.get(id)}</p>    // build hangs
}
```

Use Next.js's built-in `fetch` deduplication, or keep separate Maps for cached and uncached
contexts.

🔴 **Directly calling `cookies()` or `headers()` inside `use cache` fails immediately with
`next-request-in-use-cache` — a different error, not a timeout.** A hang means an *indirect*
dependency on runtime data; an immediate failure means a direct read. The two have different
fixes, and the error you get tells you which you have.

## Gotchas

### Omitting `cacheLife` and inheriting numbers you did not choose

**Symptom.** Content is staler or fresher than expected and nothing in the file says why.

**Cause.** The `default` profile applies: stale 5 min, revalidate 15 min, never expires by
time. The lifetime is real but invisible at the call site.

**Fix.** Set `cacheLife` in every `use cache` scope. It is the documented recommendation
precisely so behaviour does not depend on a default or on a surrounding cache.

### A short-lived cache nested inside one with no explicit lifetime

**Symptom.** The build fails during prerendering, often after adding a cache to a helper that
was previously uncached.

**Cause.** Nesting a short-lived `use cache` inside one without an explicit `cacheLife` is a
build-time error.

**Fix.** State the lifetime on the outer scope.

### Reading a build hang as a slow build

**Symptom.** The build sits still, then fails after roughly 50 seconds.

**Cause.** A cached scope is awaiting a Promise for runtime or uncached data created outside
the boundary — passed as a prop, captured in a closure, or fetched from a shared Map.

**Fix.** Resolve the Promise **outside** the cached scope and pass the resulting value in.

### Confusing the timeout with the direct-read error

**Symptom.** You search for the wrong problem.

**Cause.** Two distinct failures. A direct `cookies()`/`headers()` call inside `use cache`
fails **immediately** with `next-request-in-use-cache`. An indirect dependency on runtime data
**hangs and times out** after 50 seconds.

**Fix.** Read the error. Immediate → find the direct read. Timeout → find the Promise crossing
the boundary.

### Using a shared `Map` to deduplicate across cached and uncached code

**Symptom.** Intermittent build hangs that depend on render order.

**Cause.** The Map hands a dynamic Promise to cached code, which then awaits something that
cannot resolve at build time.

**Fix.** Use `fetch` deduplication, or keep cached and uncached contexts in separate stores.

## Interview questions

**Q. What are the two revalidation strategies, and are they exclusive?**
Time-based via `cacheLife`, and on-demand via `cacheTag` with `revalidateTag`/`updateTag`.
Not exclusive — the common configuration pairs a long lifetime with tag invalidation.

**Q. What does the `default` cacheLife profile actually specify?**
`stale` 5 minutes (client), `revalidate` 15 minutes (server), and `expire` never by time.

**Q. Why set `cacheLife` even when the default would do?**
So the lifetime is explicit at the call site rather than depending on the default profile or
on a surrounding cache.

**Q. What happens when you nest a short-lived cache inside one with no explicit lifetime?**
The build fails during prerendering. State the lifetime on the outer scope.

**Q. A build hangs and fails after ~50 seconds. What is happening?**
A cached scope is awaiting a Promise that resolves to runtime or uncached data created outside
the cache boundary, so it cannot resolve during prerendering.

**Q. How do you tell that apart from a direct request-API read?**
A direct `cookies()`/`headers()` call inside `use cache` fails **immediately** with
`next-request-in-use-cache`. The indirect case **times out**.

**Q. Three ways a runtime Promise reaches a cached scope?**
Passed as a prop, captured through a closure, or retrieved from shared storage such as a Map.

**Q. Can uncached and cached functions coexist in one module?**
Yes. An uncached function called from inside a cached one runs only when the cached one runs,
and can still be exported for callers that need fresh data.

**Q. Do `cacheLife` and `cacheTag` apply on the client too?**
Yes — both integrate across the client and server caching layers, so the semantics are
configured once and apply in both.

---

**Previous:** [4 · `use cache: private`](04-use-cache-private.md)
