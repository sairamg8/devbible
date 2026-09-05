---
title: "Set `cacheLife` explicitly in every cached scope, or the lifetime stops being visible at the call site"
sidebar_label: "5 · Revalidation and lifetimes"
sidebar_position: 10
description: "Time-based and on-demand revalidation, the default profile's real numbers, the nested short-lived cache build failure, and the 50-second prerender timeout."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-03 against the Next.js API reference for
> [`use cache`](https://nextjs.org/docs/app/api-reference/directives/use-cache)
> and the [`cacheLife`](https://nextjs.org/docs/app/api-reference/functions/cacheLife) reference.
> Target: **Next.js 16.3.4**, App Router, Cache Components.
> Validated: 2026-09-05 · claims + version spine re-checked against the Next.js 16.3.4 docs ([`cacheLife`](https://nextjs.org/docs/app/api-reference/functions/cacheLife), `lastUpdated: 2026-08-25`) · session d2e9b9fe

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

## Nesting: whether the inner lifetime escapes depends on the outer one

The rule has two branches, and collapsing them into "the inner lifetime wins" is the usual
mistake. **With an explicit `cacheLife` on the outer scope**, the outer lifetime wins outright:

> *"The outer cache uses its own lifetime, regardless of inner cache lifetimes. When the outer
> cache hits, it returns the complete output including all nested data. An explicit
> `cacheLife` always takes precedence, whether it's longer or shorter than inner lifetimes."*
> — [`cacheLife` › Nested caching behavior](https://nextjs.org/docs/app/api-reference/functions/cacheLife)

**Without one**, the outer scope sits on `default` and the inner scope can pull it down but
never up:

> *"If you don't call `cacheLife` in the outer cache, it uses the `default` profile (15 min
> revalidate). Inner caches with shorter lifetimes can reduce the outer cache's `default`
> lifetime. Inner caches with longer lifetimes cannot extend it beyond the default."*

```tsx
export default async function Dashboard() {
  'use cache'
  // No cacheLife call - uses default (15 min)
  // If Widget has 5 min  → Dashboard becomes 5 min
  // If Widget has 1 hour → Dashboard stays 15 min
  return <Widget />
}
```

That asymmetry is the argument for stating a lifetime everywhere: without one, a lifetime you
never wrote can be pulled into your page by a component someone else wrote.

### What counts as "short-lived"

The thresholds are stated on `cacheLife`, and they are about **prerendering**, not about speed:

| Lifetime | Consequence |
|---|---|
| `revalidate` of `0`, or `expire` **under 5 minutes** | Excluded from prerenders — a dynamic hole resolved at request time |
| `stale` **under 30 seconds** | Excluded from prerenders, because a prefetch would expire before the user could click |
| `stale` **≥ 30 seconds but under 5 minutes** | Prerendered, but excluded from the route's App Shell |

> *"Of the presets, only `seconds` falls under any of these thresholds: its `expire` of 1
> minute excludes it from prerenders."*

### The short-lived nesting case is a build error, not a silent inheritance

🔴 **Nesting a short-lived `use cache` inside one that has no explicit `cacheLife` fails the
build during prerendering** — deliberately:

> *"When a short-lived cache is nested inside another `use cache` without an explicit
> `cacheLife`, the outer cache's lifetime would silently become short too via propagation. To
> prevent this accidental misconfiguration, Next.js throws an error during prerendering."*

> *"Note that the nested cache may not be obvious — it could be in an imported module or even
> a third-party dependency"*

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
```

There are **two** documented fixes and they produce different pages. Choose by asking whether
the outer scope should still be prerendered.

**Fix A — keep the outer scope static.** Any explicit non-short lifetime clears the error, and
`'default'` is the minimum-commitment way to say "I meant this":

```tsx
export default async function Page() {
  'use cache'
  cacheLife('default')          // explicit → no error, still prerendered
  return <ShortLivedWidget />
}
```

**Fix B — make the outer scope short-lived on purpose.** State it, and wrap the scope in a
`<Suspense>` boundary, because it is now a dynamic hole with a gap to fill:

```tsx
async function Content() {
  'use cache: remote'
  cacheLife('seconds')          // explicit → intentionally short-lived
  return <ShortLivedWidget />
}

export default function Page() {
  return (
    <Suspense fallback={<p>Loading...</p>}>
      <Content />
    </Suspense>
  )
}
```

The docs use `'use cache: remote'` in Fix B rather than plain `use cache`, and say why:

> *"This example uses `"use cache: remote"` because runtime caching in serverless deployments
> doesn't persist across requests with the default in-memory cache. For self-hosted
> environments, `"use cache"` may be sufficient."*

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
build-time error, thrown so the outer lifetime cannot silently become short by propagation.
The inner cache may be in an imported module or a third-party dependency, which is why the
stack does not always point at your own code.

**Fix.** State the lifetime on the outer scope — `cacheLife('default')` to stay prerendered,
or an explicitly short profile plus a `<Suspense>` boundary if the outer scope really should
be a dynamic hole.

## Interview questions

**★ What are the two revalidation strategies, and are they exclusive?**
Time-based via `cacheLife`, and on-demand via `cacheTag` with `revalidateTag`/`updateTag`.
Not exclusive — the common configuration pairs a long lifetime with tag invalidation.

**★ What does the `default` cacheLife profile actually specify?**
`stale` 5 minutes (client), `revalidate` 15 minutes (server), and `expire` never by time.

**★ Why set `cacheLife` even when the default would do?**
So the lifetime is explicit at the call site rather than depending on the default profile or
on a surrounding cache.

**★ What happens when you nest a short-lived cache inside one with no explicit lifetime?**
The build fails during prerendering. Next.js throws rather than letting the outer lifetime
become short by propagation. Fix it by stating the outer lifetime: `cacheLife('default')` keeps
the outer scope prerendered, an explicitly short profile plus `<Suspense>` accepts the dynamic
hole.

**★ Does an inner cached function's lifetime affect the cache around it?**
Only when the outer scope has no explicit `cacheLife`. With one, the outer lifetime always
takes precedence, longer or shorter. Without one, the outer scope is on `default` and an inner
cache with a *shorter* lifetime reduces it — but an inner cache with a longer one cannot extend
it beyond the default.

**★ What makes a cache "short-lived" for prerendering purposes?**
`revalidate` of `0` or `expire` under 5 minutes excludes it from prerenders entirely; `stale`
under 30 seconds does the same, because a prefetch would expire before the click; `stale`
between 30 seconds and 5 minutes is prerendered but kept out of the App Shell. Of the presets
only `seconds` crosses any of those lines.

**★ Can uncached and cached functions coexist in one module?**
Yes. An uncached function called from inside a cached one runs only when the cached one runs,
and can still be exported for callers that need fresh data.

**★ Do `cacheLife` and `cacheTag` apply on the client too?**
Yes — both integrate across the client and server caching layers, so the semantics are
configured once and apply in both.

---

**Previous:** [4 · `use cache: private`](04-use-cache-private.md)
