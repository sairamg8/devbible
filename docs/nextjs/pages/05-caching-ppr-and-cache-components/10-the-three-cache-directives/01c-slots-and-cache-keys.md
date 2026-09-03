---
title: "A slot passes through a cached component untouched, and a captured variable does not"
sidebar_label: "1c · Slots and cache keys"
sidebar_position: 3
description: "Interleaving children through a cached component, closure capture silently enlarging the cache key, and choosing the dimension you cache on."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-03 against the Next.js API reference for
> [`use cache`](https://nextjs.org/docs/app/api-reference/directives/use-cache) and
> [`use cache: remote`](https://nextjs.org/docs/app/api-reference/directives/use-cache-remote).
> Target: **Next.js 16.3.4**, App Router, Cache Components.

**Two things decide whether a cached component is useful, and both are about what ends up in
its key.** A slot handed in as `children` does *not* join the key, which is what lets a cached
layout wrap dynamic content. A variable the body happens to reference from an enclosing scope
*does* join the key, invisibly, which is what turns a function with one parameter into
thousands of entries. The first is the composition mechanism you should reach for; the second
is the bug you will spend an afternoon on. Neither is stated in the function's signature,
which is why both surprise people.

## Interleaving: slots pass through without joining the key

Composition with `children` and other slots keeps working inside a cached component. **As long
as you do not reference a slot inside the body of the cacheable function, its presence in the
returned JSX does not affect the cache entry.**

```tsx filename="app/page.tsx"
export default async function Page() {
  const uncachedData = await getData()
  return (
    // Pass compositional slots as props: header and children
    <CacheComponent header={<h1>Home</h1>}>
      <DynamicComponent data={uncachedData} />
    </CacheComponent>
  )
}

async function CacheComponent({
  header,
  children,
}: {
  header: ReactNode
  children: ReactNode
}) {
  'use cache'
  const res = await fetch('https://api.example.com/cached-data')
  const cachedData = await res.json()
  return (
    <div>
      {header}
      <PrerenderedComponent data={cachedData} />
      {children}
    </div>
  )
}
```

This is what makes a cached `layout` usable at all: **a cached layout does not cache the
`children` it renders**, because the slot passes through.

Server Actions pass through the same way — as long as you do not *call* one inside the cached
body:

```tsx
async function CachedForm({ action }: { action: () => Promise<void> }) {
  'use cache'
  // Do not call action here — just hand it on
  return <form action={action}>{/* ... */}</form>
}
```

## Serialization: arguments and return values use different systems

Arguments and return values must both be serializable, but **not by the same rules**.
Arguments use React **Server Component** serialization; return values use React **Client
Component** serialization, which is more permissive.

| | Arguments | Return values |
|---|---|---|
| Primitives, plain objects, arrays | ✅ | ✅ |
| Dates, Maps, Sets, TypedArrays, ArrayBuffers | ✅ | ✅ |
| React elements | pass-through only | ✅ |
| Class instances | ❌ | ❌ |
| Functions | pass-through only | pass-through only |
| Symbols, WeakMaps, WeakSets, `URL` instances | ❌ | ❌ |

The practical consequence: **you can return JSX but you cannot accept it as an argument**
except as an un-introspected pass-through.

```tsx
// Valid — primitives and plain objects
async function UserCard({ id, config }: { id: string; config: { theme: string } }) {
  'use cache'
  return <div>{id}</div>
}

// Invalid — class instance cannot be serialized
async function UserProfile({ user }: { user: UserClass }) {
  'use cache'
  return <div>{user.name}</div>
}
```

`URL` being unsupported catches people out, because it looks like a plain value. Pass
`url.toString()` instead.

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

The same logic applies to user data. Instead of caching `getUserProfile(sessionID)` — one
entry per user — cache `getCMSContent(language)`, which produces perhaps ten to fifty entries
for any number of users.

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

**Fix.** Never cache a per-user payload in a shared directive.

```tsx
// BAD — one entry per user at best, cross-user bleed at worst
async function getUserProfile(sessionId: string) {
  'use cache: remote'
  return db.users.findBySession(sessionId)
}

// GOOD — cache the shared thing the preference selects
async function getCMSContent(language: string) {
  'use cache: remote'
  cacheLife({ expire: 3600 })
  return cms.getHomeContent(language)   // ~10-50 entries, not thousands
}
```

### Introspecting a slot inside a cached component

**Symptom.** A cached component behaves as if it were not cached, or its entries multiply
unexpectedly.

**Cause.** Pass-through holds only while you do not read or modify the slot. Touch `children`
inside the body — count it, map it, inspect its props — and it stops being a pass-through.

**Fix.** Keep the slot opaque. If you need to know something about it, compute that in the
uncached parent and pass a serializable summary in as a separate prop.

### Calling a passed-in Server Action inside the cached body

**Symptom.** A mutation runs at render time, or during prerendering.

**Cause.** Server Actions pass through *only* when handed on untouched. Invoking one inside a
cached body executes it as part of producing the cache entry.

**Fix.** Hand the action to the client component and let the client invoke it:

```tsx
async function CachedForm({ action }: { action: () => Promise<void> }) {
  'use cache'
  // await action()          ← never
  return <form action={action} />
}
```

### Passing a `URL` and getting a serialization error

**Symptom.** A cached function rejects an argument that looks like an ordinary value.

**Cause.** `URL` instances are explicitly unsupported as arguments, alongside class instances,
symbols, `WeakMap` and `WeakSet`.

**Fix.** Pass `url.toString()` and reconstruct inside if needed.

## Interview questions

**★ Can a cached component accept `children`?**
Yes. Slots pass through without joining the cache entry, **provided the cached body does not
reference them**. This is why a cached `layout` does not cache its children.

**★ What breaks pass-through?**
Introspecting the slot — reading, mapping or modifying it — or, for a Server Action, calling
it inside the cached body.

**★ Do arguments and return values follow the same serialization rules?**
No. Arguments use Server Component serialization; return values use Client Component
serialization, which is more permissive. You can return JSX but not accept it as an argument
except as pass-through.

**★ Name types that cannot be passed to a cached function.**
Class instances, functions (except as pass-through), symbols, `WeakMap`, `WeakSet`, and `URL`
instances.

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

---

**Previous:** [1b · Composing the three](01b-composing-the-three.md)
