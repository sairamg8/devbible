---
title: "The cache key is everything the body touches from outside itself, not the parameter list you wrote"
sidebar_label: "1d · Cache keys and cardinality"
sidebar_position: 4
description: "The four components of a cache key, closure capture enlarging it invisibly, choosing the low-cardinality dimension, and the shared-cache failure that passes single-user testing."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-05 against the Next.js API reference for
> [`use cache`](https://nextjs.org/docs/app/api-reference/directives/use-cache)
> (page header `version: 16.3.4`, `lastUpdated: 2026-08-25`, sections *Cache keys* and
> *Cache output*) and
> [`use cache: remote`](https://nextjs.org/docs/app/api-reference/directives/use-cache-remote)
> (`lastUpdated: 2026-08-25`, section *Cache key considerations*).
> Target: **Next.js 16.3.4**, App Router, Cache Components. Documentation-verified; **no sandbox run** — no entry counts below were measured.
> Validated: 2026-09-05 · claims + version spine re-checked against the Next.js 16.3.4 docs · session d2e9b9fe

**Cache hit rate is not a property of your cache. It is a property of your key, and the key is
not what the function signature says it is.** A variable the body happens to reference from an
enclosing scope is captured and bound as an argument — so a function with one parameter can
have as many entries as there are users. And even when the key is exactly what you wrote,
choosing the *wrong dimension* to key on produces a cache that costs money and never hits.
This chunk is what enters the key, what that costs, and the one failure mode of a shared cache
that is a security incident rather than a performance one. Slots and serialization are
[chunk 1c](01c-slots-and-cache-keys.md).

## What a key is made of

> *"A cache entry's key is generated using a serialized version of its inputs, which includes:
> 1. **Build ID** — Unique per build, changing this invalidates all cache entries. If
> `deploymentId` is configured, it overrides the build ID for cache key purposes.
> 2. **Function ID** — A secure hash of the function's location and signature in the codebase
> 3. **Serializable arguments** — Props (for components) or function arguments
> 4. **HMR refresh hash** (development only) — Invalidates cache on hot module replacement"*
> — [`use cache` › Cache keys](https://nextjs.org/docs/app/api-reference/directives/use-cache)

Three consequences fall straight out of that list, and each explains a question people ask
without connecting it to the key:

- **Entries never survive a deploy**, because the build ID changes. That is not a bug to work
  around — see [chunk 1b](01b-composing-the-three.md).
- **Moving or renaming a cached function invalidates its entries**, because the function ID is
  a hash of its *location and signature*. A pure refactor is a cache flush.
- **Only serializable arguments count.** A pass-through slot never becomes an input, which is
  the mechanism behind [chunk 1c](01c-slots-and-cache-keys.md).

## Nested entries are separate entries, and they fill each other

Caching a function that calls another cached function does not produce one entry, it produces
two, and the inner one can be filled by a completely different caller:

> *"In the example above, each `accountId` has its own entry for `getOrderSummary`, holding the
> serialized `{ orders, totals }` object it returns. Calls to `getOrders` have their own
> entries, keyed by the same `accountId`. If an earlier call, through the summary or directly,
> already filled one, `db.orders.findMany` doesn't run and those orders become part of the
> summary's output."*

So the useful mental model is not a tree of caches but a flat pool of entries keyed
independently, which is why an inner cache can hit while the outer one misses.

## Choosing the dimension you cache on

Every distinct key value is a separate entry, so **cache utilization is decided by
cardinality**. The winning move is almost always to cache on the low-cardinality dimension a
high-cardinality one *selects*.

```tsx filename="app/products/[category]/page.tsx"
async function ProductList({ params, searchParams }) {
  const { category } = await params
  const { minPrice } = await searchParams

  // Cache on category (few values); do NOT include the price filter (many values)
  const products = await getProductsByCategory(category)

  // Filter in memory rather than creating an entry per price
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

The entry is larger — all products in a category — and that is the trade being made
deliberately: more storage per entry, in exchange for a hit rate that actually protects the
backend.

> *"In this example, the remote handler stores more data per cache entry (all products in a
> category) to achieve better cache hit rates. This is worth it when the cost of cache misses
> (hitting your backend) outweighs the storage cost of larger entries."*

The same logic applies to user data. Instead of caching `getUserProfile(sessionID)` — one
entry per user — cache `getCMSContent(language)`, which the documentation describes as
creating *"~10-50 cache entries (one per language) instead of thousands (one per user)"*.

The general statement of the rule, worth keeping as a sentence: *"find the dimension with fewer
unique values (category vs. price, language vs. user ID), cache on that dimension, and filter
or select the rest in memory."*

## Gotchas

### Closure capture silently enlarges the cache key

**Symptom.** A cached function has one argument but produces far more entries than that
argument has distinct values. Hit rate is near zero and memory climbs.

**Cause.** When a cached function references variables from an outer scope, **those variables
are automatically captured and bound as arguments**, making them part of the cache key. The
signature does not show it.

```tsx
async function Component({ userId }: { userId: string }) {
  const getData = async (filter: string) => {
    'use cache'
    // Key includes BOTH userId (captured from closure) and filter (argument)
    const res = await fetch(`https://api.example.com/users/${userId}/data?filter=${filter}`)
    return res.json()
  }
  return getData('active')
}
```

**Fix.** Read the key as *everything the body touches from outside itself*, not just the
parameter list. Hoist genuinely shared functions to module scope so nothing can be captured
by accident:

```tsx
// GOOD — module scope, nothing captured; the key is exactly (userId, filter)
async function getUserData(userId: string, filter: string) {
  'use cache'
  const res = await fetch(`https://api.example.com/users/${userId}/data?filter=${filter}`)
  return res.json()
}
```

**Related and easy to miss:** when a cached function reads root parameters, **only the ones it
actually reads** become part of its key — so `next/root-params` does not silently fragment
entries by every root param the route has.

### Assuming a shared cache is a per-user cache

**Symptom.** Users intermittently see another user's content — a name, a basket, a price tier.

**Cause.** `use cache` and `use cache: remote` are **shared across all users**. A per-user
value either reaches the key and fragments the entry into one-per-user (useless), or it does
not reach the key and **everyone shares one entry** (a data leak). The second is the dangerous
one, and it passes single-user testing perfectly.

The obvious route in is closed — `cookies()` and `headers()` throw inside a shared cache scope,
and a captured variable is bound as an argument and therefore lands in the key. What is left is
an identifier the body *reads* rather than *receives*: a module-scope request context. Nothing
about that is documented as forbidden, and nothing warns.

**Fix.** Never cache a per-user payload in a shared directive.

```tsx
// BAD — sessionId is an argument, so it IS in the key: one useless entry per user
async function getUserProfile(sessionId: string) {
  'use cache: remote'
  return db.users.findBySession(sessionId)
}

// WORSE — the identifier never enters the key, so one entry is served to everyone
async function getDashboard() {
  'use cache'
  const { userId } = requestContext.get()   // module-scope AsyncLocalStorage
  return db.dashboards.findFor(userId)
}

// GOOD — cache the shared thing the preference selects
async function getCMSContent(language: string) {
  'use cache: remote'
  cacheLife({ expire: 3600 })
  return cms.getHomeContent(language)   // ~10-50 entries, not thousands
}
```

### Renaming a cached function and losing every entry

**Symptom.** A refactor lands and the upstream takes a load spike that nothing in the diff
explains.

**Cause.** The function ID in the key is *"a secure hash of the function's location and
signature in the codebase"*. Move it to another file, rename it, or change its parameter list,
and every existing entry becomes unreachable.

**Fix.** Nothing to prevent — but sequence it. Do not ship a cached-function refactor at the
same time as a traffic peak, and expect the same cold-cache behaviour you would expect from a
deploy, because mechanically it is the same thing.

### Reading `deploymentId` as a way to keep entries across deploys

**Symptom.** `deploymentId` is configured in the hope of stabilising the cache, and entries
still vanish on every release.

**Cause.** `deploymentId` *overrides* the build ID for cache key purposes — it does not remove
it. If the value changes per deploy, the keys change per deploy.

**Fix.** For data that must genuinely persist across deploys, the documented options are
`unstable_cache` for non-`fetch` functions or the `fetch` cache; the directives do not offer
it.

## Interview questions

**★ What exactly goes into a cache key?**
The build ID (or `deploymentId` when configured), a Function ID that is a secure hash of the
function's location and signature, the serializable arguments or props, and — in development
only — an HMR refresh hash.

**★ A cached function takes one `filter` argument but you see thousands of entries. Why?**
Closure capture. Variables referenced from an outer scope are bound as arguments and become
part of the key, so a captured `userId` multiplies entries by the number of users.

**★ How do you fix closure capture?**
Hoist the function to module scope and pass everything it needs explicitly, so the key is
exactly its parameter list.

**★ How do you cache per-user-preference data without one entry per user?**
Cache on the dimension with few unique values that the preference *selects* — language,
currency, category — and filter or select the rest in memory.

**★ What is the most dangerous failure mode of a shared cache directive?**
Caching a per-user payload where the user identifier is *not* in the key. Every user then
shares one entry. It passes single-user testing and leaks data under real traffic.

**★ If a cached function reads root params, do all of the route's root params enter its key?**
No — only the ones it actually reads.

**★ Why does renaming a cached function empty its cache?**
The key includes a hash of the function's location and signature. Change either and the entries
that existed are keyed under an identity nothing will ask for again.

**★ Does a nested cached function share the outer function's entry?**
No. It has its own entry, keyed independently. An earlier call from anywhere — through the
outer function or directly — can already have filled it, in which case the inner work does not
run and its stored output becomes part of the outer entry.

**★ Why is a bigger cache entry sometimes the better design?**
Because hit rate is a function of key cardinality, not entry size. Storing all products in a
category rather than one entry per price filter trades storage for a hit rate that actually
protects the backend.

---

**Previous:** [1c · Slots and pass-through](01c-slots-and-cache-keys.md) · **Next:** [2 · `use cache` at runtime](02-use-cache-at-runtime.md)
