---
title: "A write in a two-cache app has two readers to satisfy and they are invalidated by different calls in different files — and the reads must never go through a Server Action, because the client dispatches those one at a time"
sidebar_label: "05e · Invalidating both caches"
sidebar_position: 143
description: "The server-tag and client-key halves of one invalidation, useMutation over a Server Action, the revalidateTag stale-while-revalidate trap, and why a Server Action must never be a queryFn."
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-05 against the Next.js [Server Actions and Mutations](https://nextjs.org/docs/app/guides/server-actions)
> guide (`lastUpdated: 2026-06-17`), the TanStack Query
> [Advanced Server Rendering](https://tanstack.com/query/latest/docs/framework/react/guides/advanced-ssr) guide,
> and the React [Server Functions](https://react.dev/reference/rsc/use-server) reference.
> Target: **Next.js 16.3.4** App Router · **React 19.2.8** · **`@tanstack/react-query` 5.102.8** · TypeScript 7.0.2.
> Documentation-verified; **no sandbox run**.

**Once a client cache is in the app, every mutation has to expire two things: the server cache, so the next navigation renders new data, and the client cache, so the current screen does. They are separate calls, made in separate files, by APIs that have never heard of each other. Forgetting the server half gives you a screen that is right now and wrong after a navigation; forgetting the client half gives you the opposite. And the read path has its own hard rule — a Server Action is not a `queryFn`, because Next.js dispatches actions serially and a query cache fetches in parallel.**

## Mutations: two caches, two invalidations

```ts filename="app/board/actions.ts"
'use server'

import { updateTag } from 'next/cache'
import { db } from '@/lib/db'

export async function renameTask(id: string, title: string) {
  await db.task.update({ where: { id }, data: { title } })
  updateTag('board')          // server side: expire, and re-render in this response
  return { ok: true as const }
}
```

```tsx filename="app/board/rename-form.tsx"
'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { renameTask } from './actions'

export function RenameForm({ id }: { id: string }) {
  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationFn: (title: string) => renameTask(id, title),
    onSuccess: () => {
      // client side: the other half of the same invalidation
      queryClient.invalidateQueries({ queryKey: ['board'] })
    },
  })

  return (
    <form action={(formData) => mutation.mutate(String(formData.get('title')))}>
      <input name="title" defaultValue="" />
      <button type="submit" disabled={mutation.isPending}>Rename</button>
    </form>
  )
}
```

Using a Server Action as the `mutationFn` is supported and sensible — the TanStack guide says so explicitly: *"Server Actions remain a good fit for **mutations** (`useMutation`)."* The write goes through the framework's security boundary, and the client cache is told about it afterwards.

Note what the action's own response does *as well*: because `updateTag` ran, Next.js re-renders the current route and ships a fresh RSC payload in the same round trip.

> *"When `updateTag`, `revalidatePath`, or `refresh` runs, Next.js re-renders the current route server-side and includes a newly rendered RSC Payload in the action's response, so the page reflects the change in the same roundtrip."*
> — [Server Actions and Mutations](https://nextjs.org/docs/app/guides/server-actions#choosing-a-cache-update)

So the RSC-owned parts of the screen and the query-owned parts both update — but through two entirely different mechanisms that you wired separately.

### 🔴 The `revalidateTag` stale-while-revalidate trap

> *"`revalidateTag` with a stale-while-revalidate profile is the exception: it marks the tag for background refresh and does **not** include a re-render in the action response. The page reflects the change on a later read."*
> — [Server Actions and Mutations](https://nextjs.org/docs/app/guides/server-actions#a-single-response-carries-data-and-ui)

An action that calls `revalidateTag` returns to a client that got **no** fresh RSC payload. If the client cache also holds that data and you invalidated it in `onSuccess`, the screen updates anyway — from the *client* refetch — and you never notice the server half did nothing this round trip. Six months later somebody deletes the client cache from that screen and the update stops working, with no obvious cause.

Use `updateTag` when the user must see their own write in the same round trip. The full five-way comparison lives in [10b](10b-refresh-against-the-alternatives.md); [`refresh()`](10-refresh.md) is the member of that family that invalidates nothing and exists for state that was never cached.

## 🔴 Do not use a Server Action as a `queryFn`

The TanStack guide carries an explicit warning:

> *"We do **not** recommend using Next.js Server Actions to _fetch_ data in a `queryFn`. When called from the client, Server Actions run serially, not in parallel, which conflicts with how React Query fetches and refetches queries. This can leave queries stuck in a pending state or cause the action to never run at all. Passing a Server Action reference to `queryFn` can also fail with `Only plain objects, and a few built-ins, can be passed to Server Actions...`, since you have to _call_ the action rather than pass it as a reference. For fetching data on the client, `fetch` from an API route or use an RPC layer such as tRPC instead."*
> — [Advanced Server Rendering](https://tanstack.com/query/latest/docs/framework/react/guides/advanced-ssr#prefetching-and-dehydrating-data)

The serial half is confirmed from the Next.js side:

> *"Next.js dispatches Server Actions one at a time per client. If a user triggers three actions in quick succession, the second waits for the first to finish, then the third waits for the second. This keeps the re-rendered server tree consistent with the action result that produced it."*
> — [Server Actions and Mutations](https://nextjs.org/docs/app/guides/server-actions#sequential-dispatch-on-the-client)

A `queryFn` that refetches on focus, on reconnect and on an interval — potentially for several keys at once — is precisely the workload a serial queue handles worst.

```ts
// 🚩 A Server Action as the query source: serial, and refetch-hostile.
useQuery({ queryKey: ['board'], queryFn: () => listTasksAction() })

// ✅ A Route Handler: concurrent, cancellable via the AbortSignal, cacheable by the browser.
useQuery({
  queryKey: ['board'],
  queryFn: ({ signal }) => fetch('/api/board', { signal }).then((r) => r.json()),
})
```

The `signal` argument matters beyond style: TanStack passes an `AbortSignal` into every `queryFn`, and a Server Action has nowhere to put it, so a superseded fetch keeps running.

## Where each invalidation call is legal

| Call | Callable from | Effect |
|---|---|---|
| `updateTag` | Server Actions only | Expires a tag; the action's response carries a re-render that waits for fresh data |
| `revalidateTag` | Server Action or Route Handler | Marks for background refresh; under SWR, **no** re-render in this response |
| `revalidatePath` | Server Action or Route Handler | Invalidates by URL; re-render ships with the action response |
| `refresh()` | Server Actions only | Invalidates nothing; re-renders the current route in this response |
| `router.refresh()` | Client Components | Re-requests the route payload; preserves `useState` and scroll |
| `queryClient.invalidateQueries` | Client only, meaningfully | Marks client cache entries stale and refetches active ones |

The last row is the one people get wrong in both directions: calling `invalidateQueries` on the per-request server client does nothing observable, and expecting `revalidateTag` to touch `['board']` in the browser is a category error.

## Gotchas

**★ Symptom: the list is correct on this screen but stale after navigating away and back.** Cause: the mutation invalidated the client cache but not the server cache, so the fresh RSC render still reads an unexpired `use cache` entry. Fix: invalidate on both sides — tag on the server, key on the client.

```ts
'use server'
export async function renameTask(id: string, title: string) {
  await db.task.update({ where: { id }, data: { title } })
  updateTag('board')
}
```
```ts
onSuccess: () => queryClient.invalidateQueries({ queryKey: ['board'] })
```

**★ Symptom: queries hang in `pending` forever, or a `queryFn` throws `Only plain objects, and a few built-ins, can be passed to Server Actions...`.** Cause: a Server Action is being used as the query source — passed by reference rather than called, and dispatched serially against a cache that wants to fetch in parallel. Fix: fetch through a Route Handler and keep Server Actions for writes.

```ts
useQuery({
  queryKey: ['board'],
  queryFn: ({ signal }) => fetch('/api/board', { signal }).then((r) => r.json()),
})
```

**★ Symptom: after a mutation the server-rendered parts of the page are stale while the query-driven parts are fresh.** Cause: the action called `revalidateTag` under a stale-while-revalidate profile, which deliberately ships no re-render in the action's response. Fix: use `updateTag` when the user must see their own write in the same round trip.

```ts
'use server'
import { updateTag } from 'next/cache'
export async function publish(id: string) {
  await db.post.update({ where: { id }, data: { published: true } })
  updateTag('posts')   // not revalidateTag: this response carries the re-render
}
```

**★ Symptom: `queryClient.invalidateQueries()` in a Server Component does nothing.** Cause: it ran against the per-request server client, which is discarded when the response ends; the browser's client never heard about it. Fix: invalidation belongs on whichever side owns the cache — `updateTag`/`revalidatePath` on the server, `invalidateQueries` in a client `onSuccess`.

```ts
// server action
updateTag('board')
// client, after the mutation resolves
queryClient.invalidateQueries({ queryKey: ['board'] })
```

**★ Symptom: the invalidation runs but the screen does not change, and the action also redirects.** Cause: `redirect` throws a control-flow exception, so anything after it never executes. Fix: invalidate before redirecting.

```ts
'use server'
import { updateTag } from 'next/cache'
import { redirect } from 'next/navigation'

export async function archive(id: string) {
  await db.task.update({ where: { id }, data: { archived: true } })
  updateTag('board')     // before
  redirect('/board')     // this throws; nothing below runs
}
```

**★ Symptom: a superseded search request still resolves and overwrites the newer result.** Cause: the `queryFn` ignored the `AbortSignal` TanStack passes it — or could not accept one, because it was a Server Action. Fix: thread the signal into `fetch`.

```ts
useQuery({
  queryKey: ['task-search', term],
  queryFn: ({ signal }) =>
    fetch(`/api/tasks?q=${encodeURIComponent(term)}`, { signal }).then((r) => r.json()),
})
```

**★ Symptom: firing several mutations at once from one click is far slower than the sum of the individual requests suggests.** Cause: they are Server Actions and the client dispatcher is serial by design. Fix: batch the work into one action.

```ts
'use server'
export async function moveMany(ids: string[], status: string) {
  await Promise.all(ids.map((id) => db.task.update({ where: { id }, data: { status } })))
  updateTag('board')
}
```

## Interview questions

**★ You mutate through a Server Action and invalidate the query cache in `onSuccess`. What is still broken?**
The server cache. `invalidateQueries` only expires the browser's copy, so the current screen is right, but the next navigation renders a Server Component that reads an unexpired `use cache` entry and shows the old value. The action must also call `updateTag`, `revalidateTag` or `revalidatePath`. The reverse mistake is equally common: invalidating only on the server and wondering why the current screen does not change, because the client cache was never told.

**★ Why does the TanStack guide say not to use a Server Action as a `queryFn`?**
Two independent reasons. Mechanically, you have to call the action rather than pass its reference, and passing the reference can fail with the "Only plain objects, and a few built-ins, can be passed to Server Actions" error. Behaviourally, Next.js dispatches Server Actions one at a time per client, while a query cache wants to fetch several keys concurrently and to refetch on focus, reconnect and interval; running that traffic through a serial queue can leave queries pending or stop an action running at all. There is also no place to put the `AbortSignal` a `queryFn` receives. Reads go through a Route Handler or an RPC layer; Server Actions stay on the write path, where `useMutation` is a good fit for them.

**★ Why is `revalidateTag` under a stale-while-revalidate profile dangerous specifically in a two-cache app?**
Because the bug it causes is masked. `revalidateTag` under SWR marks the tag for background refresh and deliberately ships no re-render in the action's response, so the server-rendered half of the screen is unchanged when the action returns. In a two-cache app the client invalidation updates the query-driven half anyway, so the screen looks correct and the missing server re-render is never noticed — until the client cache is removed from that screen, at which point a mutation silently stops updating the UI. `updateTag` is the call that gives read-your-own-writes in the same round trip.

**Why is a Server Action a good `mutationFn` but a bad `queryFn`?**
Because the properties that make actions serial and framework-integrated are assets on the write path and liabilities on the read path. A write should be ordered, should go through the framework's security boundary, and should be able to invalidate server caches and return a re-rendered payload in the same response — all of which actions do. A read wants concurrency, cancellation, browser caching and retries on the client's terms, none of which a serially dispatched action offers.

**Where does `router.refresh()` fit when a client cache is present?**
It is the client-side way to re-request the current route's RSC payload without invalidating any server cache entry, and it preserves `useState` and scroll position — so it re-syncs the RSC-owned half of the screen after something changed outside the action path, such as a socket event or an out-of-band write. It is not a substitute for `invalidateQueries`, which is the only thing that touches the client cache, and it is not a substitute for a tag invalidation, because it does not expire anything.

**An action calls `updateTag` and then `redirect`. Does the invalidation take effect?**
Yes, because it ran first. The failure mode is the other order: `redirect` throws a control-flow exception, so any invalidation written after it never executes, and the destination route renders from the unexpired cache. The Next.js docs state this directly — place revalidation calls before `redirect` if the destination needs the fresh data.

---

← [05d · When the two caches disagree](05d-when-the-two-caches-disagree.md) · [Chapter 8 overview](01-explanation.md) · Next → [05f · RTK Query and the Redux question](05f-rtk-query-and-the-redux-question.md)
