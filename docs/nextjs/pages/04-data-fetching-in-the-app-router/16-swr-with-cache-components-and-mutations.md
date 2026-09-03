---
sidebar_position: 16
title: "Once the server read is cached and tagged, SWR and Next.js hold two independent caches of the same fact — and a mutation has to update both"
sidebar_label: "SWR with Cache Components and mutations"
description: "Caching the server-side read that feeds an SWR fallback with 'use cache', cacheLife and cacheTag, extending the key contract to carry a tag, and coordinating optimistic browser mutations with updateTag on the server."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-03 against [How to fetch client-side data with SWR](https://nextjs.org/docs/app/guides/client-side-data-fetching/swr) (docs `lastUpdated` 2026-08-25), [`updateTag`](https://nextjs.org/docs/app/api-reference/functions/updateTag), [`cacheTag`](https://nextjs.org/docs/app/api-reference/functions/cacheTag), [`cacheLife`](https://nextjs.org/docs/app/api-reference/functions/cacheLife), and [SWR mutation](https://swr.vercel.app/docs/mutation).
> Target: **Next.js 16.3.4**. Requires `cacheComponents: true` for the caching half. Prior page: [15 · SWR: fetching and the server handoff](15-swr-in-the-app-router-fallbacks-keys-and-mutations.md).

**Providing initial data and caching it are independent decisions, and taking the second one creates a coordination problem. The server holds a cached, tagged value; the browser holds its own copy under an SWR key; the two have different lifetimes and neither knows about the other. The discipline that makes this tractable is a single shared module holding both identities — the SWR key and the server tag — so that a mutation can update the browser optimistically and invalidate the server tag with strings that cannot drift apart.**

## Caching the server read

```ts filename="app/products/[id]/data.ts"
import { cacheLife, cacheTag } from 'next/cache'

export async function getProduct(id: string) {
  'use cache'
  cacheLife('max')
  cacheTag(`product:${id}`)

  const product = await db.product.findUnique({ where: { id } })
  if (!product) throw new Error('Product not found')
  return product
}
```

The docs justify `cacheLife('max')` here on one ground: writes invalidate the product tag, so nothing is relying on time to become correct. They also split the profile's fields by which cache each one governs — `stale` controls how long the Next.js **client** cache may reuse a prefetched payload, while `revalidate` and `expire` control the **server** cache. Same profile, two consumers.

SWR sits outside both of those. It owns a separate browser cache, and the docs state plainly that its revalidation options do not have to match `cacheLife` at all.

`cacheLife('max')` is only safe *because* the tag is invalidated on write. A `max` profile on data with no invalidation path is a permanent stale value.

Extend the contract so both identities live together:

```diff filename="app/products/[id]/product-cache.ts"
 export const productCache = {
   key: (id: string) => `/api/products/${id}`,
+  tag: (id: string) => `product:${id}`,
 }
```

The server function then calls `cacheTag(productCache.tag(id))` using that same module. The condition attached is that the contract module stays free of both server-only and client-only imports, so that both cache layers are able to reuse it.

That last clause is a real constraint: the module is imported from a Server Component *and* from a `'use client'` file, so it must contain nothing but pure string construction. An `import 'server-only'` in it breaks the client; a React import breaks the server usage.

## Mutations: optimistic in the browser, tagged on the server

```ts filename="app/activity/activity-cache.ts"
export const activityCache = {
  key: '/api/activity/unread',
  tag: (userId: string) => `activity:${userId}`,
}
```

```tsx filename="app/activity/mark-read-button.tsx"
'use client'

import { useSWRConfig } from 'swr'
import { markActivityReadAction } from './actions'
import { activityCache } from './activity-cache'

export function MarkReadButton() {
  const { mutate } = useSWRConfig()

  function markRead() {
    return mutate(
      activityCache.key,
      async () => {
        await markActivityReadAction()
        return { count: 0 }
      },
      {
        optimisticData: { count: 0 },
        revalidate: false,
        rollbackOnError: true,
        throwOnError: false,
      }
    )
  }

  return <button onClick={markRead}>Mark read</button>
}
```

SWR renders the optimistic value immediately and rolls it back if the write fails. This particular example goes further and keeps the optimistic value even after the action succeeds — the docs give the reason as the final value already being known, so there is nothing to go and ask the server for.

Each option is load-bearing. `optimisticData` is what renders instantly. `revalidate: false` is correct *only because* the final value is known — the action returns `{ count: 0 }` and there is nothing to re-fetch. `rollbackOnError: true` restores the previous value on failure. `throwOnError: false` keeps the rejection from propagating out of the click handler.

```ts filename="app/activity/actions.ts"
'use server'

import { updateTag } from 'next/cache'
import {
  getCurrentUserId,
  markActivityRead as markActivityReadInDatabase,
} from './data'
import { activityCache } from './activity-cache'

export async function markActivityReadAction() {
  const userId = await getCurrentUserId()
  await markActivityReadInDatabase(userId)
  updateTag(activityCache.tag(userId))
}
```

The two calls address two different surfaces. The optimistic SWR value updates the screen the user is looking at right now; `updateTag` is what makes the *next* cached server read return fresh activity rather than the pre-write value.

The rule for when to reach for it: call `updateTag` when a Server Action changes a cached read that has to reflect the write immediately. If the read was never cached, there is no server tag there to update, and the call has nothing to act on.

Note `getCurrentUserId()` is called inside the action rather than the id being passed in from the client. The tag is built from a server-derived identity, so a caller cannot address another user's cache.

## Gotchas

**★ Putting `import 'server-only'` (or anything React) in the cache-contract module.**
It is imported from a Server Component *and* from a `'use client'` component, so it must contain only pure string construction. The docs' instruction is to keep the contract free of server-only and client-only imports precisely so both cache layers can reuse it. Violate that and one of the two call sites fails to build.

**★ Setting `cacheLife('max')` on a read with no invalidation path.**
`max` is only correct because writes call `updateTag` on the matching tag. Without that, `max` is a permanent stale value with no mechanism to ever refresh it. The lifetime and the invalidation strategy are one decision, not two.

**★ Using `revalidate: false` on a mutation whose final value you do not know.**
The documented button can skip revalidation because the action's result is exactly `{ count: 0 }`. When the server may return something else — a generated id, a server-computed total, a normalised value — skipping revalidation leaves the browser asserting the optimistic guess indefinitely.

**★ Passing the user id from the client into the mutation action.**
The documented action calls `getCurrentUserId()` itself and builds the tag from that. Taking the id from the client lets a caller write to, and invalidate the cache of, another account — a Server Action is a public endpoint and every field it receives is attacker-controlled.

**★ Letting the SWR key and the server tag live in different files.**
The whole point of the extended contract is that one module owns both identities, so `cacheTag(productCache.tag(id))` on the server and `useSWR(productCache.key(id))` in the browser cannot drift. Splitting them across a server module and a client module reintroduces exactly the class of silent mismatch the contract exists to prevent.

**★ Assuming SWR's revalidation options must line up with `cacheLife`.**
They are independent caches with independent policies — SWR owns its own browser cache, and its revalidation options are under no obligation to match `cacheLife`. Trying to keep a `refreshInterval` in step with a server `revalidate` produces a coupling nobody asked for and no correctness benefit — identity is what must be shared, not duration.

## Interview questions

**★ Walk through the four `mutate` options in the documented optimistic update.**
`optimisticData` renders immediately so the click feels instant. `revalidate: false` skips the follow-up fetch, which is only correct because the action's final value is known to be `{ count: 0 }`. `rollbackOnError: true` restores the previous value if the write fails. `throwOnError: false` stops the rejection escaping the click handler. Together they give an instant, self-correcting update with no extra request.

**★ Why is the server tag built inside the Server Action rather than passed in?**
Because a Server Action is a public HTTP endpoint and everything the client sends is attacker-controlled. The documented action calls `getCurrentUserId()` and builds `activityCache.tag(userId)` from that server-derived value, so a caller cannot write to another account or invalidate another user's cached reads.

**★ Why can the shared cache-contract module contain nothing but string builders?**
Because it is imported from both a Server Component and a `'use client'` component. Adding `import 'server-only'` breaks the client bundle; adding a client-only import breaks the server render. Keeping it to pure key and tag construction is what lets one module be the single source of identity for both cache layers.

**★ Do SWR's revalidation settings need to match `cacheLife`?**
No. They govern separate caches — SWR's browser cache and the Next.js server cache — and the guide states directly that they need not match. Within the `cacheLife` profile, `stale` controls how long the Next.js *client* cache may reuse a prefetched RSC payload, while `revalidate` and `expire` control the server cache. SWR's `refreshInterval` and revalidation triggers are a third, unrelated policy.

**★ What makes `cacheLife('max')` a defensible choice for a product read?**
Only the presence of an invalidation path. The documented example pairs it with a `cacheTag` of the form `product:<id>` and a Server Action calling `updateTag`, so writes are what refresh the entry rather than time. Without that pairing, `max` is a permanently stale value with no mechanism to change. Lifetime and invalidation are one decision.

---

← [SWR: fetching and the server handoff](15-swr-in-the-app-router-fallbacks-keys-and-mutations.md) · [Chapter 4 overview](01-explanation.md) · Next → [TanStack Query: provider and client fetching](17-tanstack-query-in-the-app-router-provider-and-hydration.md)
