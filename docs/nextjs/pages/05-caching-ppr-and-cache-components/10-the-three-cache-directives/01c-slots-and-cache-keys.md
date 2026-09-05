---
title: "A slot passes through a cached component untouched, which is the only reason a cached layout is usable"
sidebar_label: "1c · Slots and cache keys"
sidebar_position: 3
description: "Interleaving children and Server Actions through a cached component, and the two different serialization systems that arguments and return values are held to."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-03 against the Next.js API reference for
> [`use cache`](https://nextjs.org/docs/app/api-reference/directives/use-cache) and
> [`use cache: remote`](https://nextjs.org/docs/app/api-reference/directives/use-cache-remote).
> Target: **Next.js 16.3.4**, App Router, Cache Components.
> Validated: 2026-09-05 · claims + version spine re-checked against the Next.js 16.3.4 docs · session d2e9b9fe

**A slot handed in as `children` does *not* join the cache key, and that single fact is what
makes cached components composable at all.** It is why a cached `layout` can wrap dynamic
content without freezing it, and why a Server Action can travel through a cached component to
a client one. The rule has an exact boundary — pass-through holds only while the cached body
does not *reference* the slot — and a second rule sits beside it that catches people just as
often: arguments and return values are serializable under two **different** systems, so a value
you can return is not necessarily a value you can accept. The other half of the key story, what
*does* join the key and what that costs, is [chunk 1d](01d-cache-keys-and-cardinality.md).

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

## Gotchas

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

---

**Previous:** [1b · Composing the three](01b-composing-the-three.md) · **Next:** [1d · Cache keys and cardinality](01d-cache-keys-and-cardinality.md)
