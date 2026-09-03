---
sidebar_position: 38
title: "One click updates two caches, and coordinating them is about identity and invalidation — never about matching their durations"
sidebar_label: "TanStack Query: mutations with Cache Components"
description: "The optimistic useMutation contract, the four-step order inside onMutate, resolving the user id server-side, and why updateTag rather than revalidateTag for the writer's own change."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-03 against [How to fetch client-side data with TanStack Query](https://nextjs.org/docs/app/guides/client-side-data-fetching/tanstack-query) (docs `lastUpdated` 2026-08-25), [`updateTag`](https://nextjs.org/docs/app/api-reference/functions/updateTag) and [`revalidateTag`](https://nextjs.org/docs/app/api-reference/functions/revalidateTag).
> Target: **Next.js 16.3.4**. Requires `cacheComponents: true` and **TanStack Query 5.40.0 or later**. Prior page: [19 · TanStack Query with Cache Components](19-tanstack-query-with-cache-components-and-mutations.md).

**A single click now has to update two caches that know nothing about each other: the browser's, optimistically and immediately, so the UI responds; and the server's, by tag expiry, so the next render reads fresh. What has to be coordinated between them is narrower than it first appears — the identity a value is stored under, and the event that invalidates it. Their durations are three independent policies and trying to keep them in step is work with no correctness payoff.**

## Mutations


The browser half uses `useMutation` with an `onMutate` callback that writes the optimistic value and returns the previous one, and an `onError` callback that puts it back:

```tsx filename="app/activity/mark-read-button.tsx"
'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { markActivityReadAction } from './actions'
import { activityCache } from './activity-cache'

export function MarkReadButton() {
  const queryClient = useQueryClient()
  const queryKey = activityCache.key

  const markRead = useMutation({
    mutationFn: markActivityReadAction,
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey })
      const previous = queryClient.getQueryData(queryKey)
      queryClient.setQueryData(queryKey, { count: 0 })
      return { previous }
    },
    onError: (_error, _variables, context) => {
      queryClient.setQueryData(queryKey, context?.previous)
    },
  })

  return <button onClick={() => markRead.mutate()}>Mark read</button>
}
```

`cancelQueries` comes first and is not optional decoration. An in-flight fetch for the same key that resolves after `setQueryData` would overwrite the optimistic value with pre-mutation data, producing a UI that flickers back to the old state for no visible reason. Cancelling first closes that race.

`getQueryData` before `setQueryData` captures the rollback value, and returning it as the mutation context is how `onError` gets hold of it — TanStack passes whatever `onMutate` returns as the third argument to `onError`.

There is no `onSettled` refetch here because the final value is known: the action sets the count to zero, and zero is what the optimistic write already put in the cache. When the server may return something you cannot predict — a generated id, a server-computed total, a normalised field — you need a refetch or an invalidation, or the browser will assert its guess indefinitely.

The contract module carries both identities, exactly as in the read path:

```ts filename="app/activity/activity-cache.ts"
export const activityCache = {
  key: ['activity', 'unread'] as const,
  tag: (userId: string) => `activity:${userId}`,
}
```

And the Server Action writes to the database and expires the tagged server read:

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

The user id comes from `getCurrentUserId()` inside the action, not from an argument. A Server Action is a public HTTP endpoint, so an id supplied by the caller would let anyone write to — and invalidate the cache of — another account.

`updateTag` is the right call here rather than `revalidateTag(tag, 'max')` because the person who clicked must not see their own change missing. `updateTag` makes the next server read wait for fresh data; `revalidateTag` with `'max'` would serve the stale value while refreshing in the background, which is correct for passive updates and wrong for the writer.

Two caches are now updated by one interaction: the browser's, optimistically and immediately, and the server's, by tag expiry so the next render reads fresh. Skipping either leaves a visible inconsistency — a stale badge after a hard reload if you skip the tag, or a button that appears to do nothing until the next navigation if you skip the optimistic write.

## Gotchas

**★ Omitting `cancelQueries` from `onMutate`.**
An in-flight fetch for the same key can resolve after your optimistic `setQueryData` and overwrite it with pre-mutation data. The user sees the new value appear and then revert with no error and no obvious cause. `await queryClient.cancelQueries({ queryKey })` before reading and writing the cache closes the race.

**★ Capturing the rollback value after writing the optimistic one.**
`getQueryData` must run before `setQueryData`, or the "previous" value you return as context is the optimistic value you just wrote, and `onError` restores the failed write instead of undoing it. The order in `onMutate` is: cancel, read, write, return.

**★ Skipping the follow-up when the server's final value is not predictable.**
The documented button omits any refetch because the action's outcome is exactly the optimistic value. When the server may return a generated id, a computed total or a normalised field, the browser cache will hold your guess forever unless you invalidate or refetch after settling.

**★ Passing the user id into the Server Action from the client.**
Server Actions are public HTTP endpoints and every argument is attacker-controlled. Resolving the id server-side with `getCurrentUserId()` and building the tag from that is what stops a caller writing to another account or expiring another user's cached reads.

**★ Choosing `revalidateTag(tag, 'max')` for the writer's own mutation.**
It serves stale data while revalidating, so the person who just clicked sees their change missing on the next render. Use `updateTag` when the write must be visible immediately, and reserve `revalidateTag` with `'max'` for passive updates where an instant stale response beats a slower fresh one.

**★ An `onMutate` path that returns nothing, so the rollback silently does nothing.**
TanStack hands `onError` whatever `onMutate` returned, as its third argument. An early return — a guard that skips the optimistic write when there is no cached value yet, say — returns `undefined`, so `context?.previous` is `undefined` and `setQueryData(queryKey, undefined)` clears the entry rather than restoring it. Every path out of `onMutate` must return the context shape `onError` expects.

## Interview questions

**★ Walk through `onMutate` and explain the order of its four steps.**
Cancel, read, write, return. `await queryClient.cancelQueries({ queryKey })` stops an in-flight fetch that could land after the optimistic write and revert it. `queryClient.getQueryData(queryKey)` captures the pre-mutation value *before* it is overwritten. `queryClient.setQueryData(queryKey, ...)` applies the optimistic value so the UI responds immediately. Returning `{ previous }` hands that captured value to `onError` as its third argument, which is how the rollback gets its data.

**★ The documented mutation has no refetch after success. Why, and when would that be a bug?**
Because the final value is known in advance: the action marks activity read, so the count is zero, which is precisely what the optimistic write already stored. It becomes a bug the moment the server can return something unpredictable — a generated identifier, a server-computed total, a normalised or trimmed field — because then the browser cache holds a guess with nothing scheduled to correct it.

**★ Why `updateTag` rather than `revalidateTag(tag, 'max')` after a user-initiated write?**
Because the person who clicked must not see their own change missing. `updateTag` makes the next server read wait for fresh data. `revalidateTag` with `'max'` serves the stale entry while refreshing in the background, which is the right trade for passive updates driven by someone else's activity and the wrong one for the writer's own screen.

**★ Two caches now hold the same fact. What must be true of them, and what need not be?**
Their identities and their invalidation must be coordinated: the query key the browser stores under and the tag the server invalidates have to be derivable from one shared contract module, and a mutation has to address both. Their durations need not agree at all — TanStack's `staleTime`, the `cacheLife` `stale` window for the Next.js client cache, and `revalidate`/`expire` for the server cache are three independent policies chosen from three different behaviours.

**★ What happens if one branch of `onMutate` returns early without a context object?**
`onError` receives `undefined` as its third argument, so `context?.previous` is `undefined` and the rollback writes `undefined` into the cache — clearing the entry instead of restoring the pre-mutation value. The failure only shows up when that branch is taken *and* the mutation fails, which is why it survives testing. Return the same context shape from every path.

---

← [TanStack Query with Cache Components](19-tanstack-query-with-cache-components-and-mutations.md) · [Chapter 4 overview](01-explanation.md)
