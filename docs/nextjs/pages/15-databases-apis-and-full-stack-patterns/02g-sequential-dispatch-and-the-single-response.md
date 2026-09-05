---
title: "Actions are dispatched one at a time per client and answer with the mutation result and a re-rendered tree in one Flight response — two mechanical facts that decide which work belongs in an action and which does not"
sidebar_label: "02g · Dispatch and the response"
sidebar_position: 205
description: "Why Promise.all does not parallelise Server Actions, what the queue buys you, the single-roundtrip response carrying both the return value and a new RSC payload, the four triggers that include a re-render, and the revalidateTag stale-while-revalidate exception."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-05 against [Next.js · Server Actions and Mutations](https://nextjs.org/docs/app/guides/server-actions) (§ *Sequential dispatch on the client*, § *A single response carries data and UI*, § *Choosing a cache update*) and [Next.js · Backend for Frontend](https://nextjs.org/docs/app/guides/backend-for-frontend) (§ *Server Actions*) — both `version: 16.3.4`.
> Documentation-verified; **no sandbox run**. No timings are given; the docs state ordering, not latency.
> Target: **Next.js 16.3.4** · React **19.2.8** · Node **24.20.0**.

**Two documented behaviours make Server Actions a different tool from Route Handlers, and neither is about security or ergonomics. First, the client dispatches actions strictly one at a time, so concurrency you write in the browser is not concurrency you get. Second, an action that revalidates answers with both its return value and a freshly rendered tree in the same HTTP response, so the UI is already correct when the promise resolves. The first rules a whole category of work out of actions; the second removes a follow-up fetch you would otherwise write by hand.**

## Sequential dispatch, and why it exists

> *"Next.js dispatches Server Actions one at a time per client. If a user triggers three actions in quick succession, the second waits for the first to finish, then the third waits for the second. This keeps the re-rendered server tree consistent with the action result that produced it."*

The rationale is in the last sentence and it is worth dwelling on. Because each action's response can carry a re-rendered tree ([below](#a-single-response-carries-both-the-result-and-the-ui)), two actions in flight at once would produce two trees rendered from two different database states, committed in whatever order the network delivered them. Serialising the dispatch means the tree you commit is always the tree produced by the mutation you just applied.

The consequence the docs spell out:

> *"A consequence: do not rely on `Promise.all` to parallelize Server Actions from the client."*

```tsx
'use client'
import { startTransition } from 'react'
import { archiveOrder } from './actions'

// This does NOT run three requests concurrently. It runs them one after another.
async function archiveAllWrong(ids: string[]) {
  await Promise.all(ids.map((id) => archiveOrder(id)))
}
```

`Promise.all` is not broken — it awaits three promises correctly. The dispatcher underneath simply does not start the second request until the first resolves, so the wall-clock cost is the sum, not the maximum. The three documented ways out:

> *"If you need parallel work, do it inside a single Server Action, fetch in parallel from a [Server Component], or use a [Route Handler] for non-mutation requests."*

```ts
// app/orders/actions.ts — one action, parallelism on the server where it is free
'use server'

import { archiveOrders } from '@/data/orders'
import { revalidatePath } from 'next/cache'

export async function archiveOrdersAction(ids: string[]) {
  await archiveOrders(ids)     // the DAL can Promise.all internally, or issue one query
  revalidatePath('/orders')
}
```

And the scope of the rule, which stops people over-generalising it:

> *"**Good to know:** This is a property of the client dispatcher, not of Server Functions in general. Server-side, an action runs in its own request and can do anything an async function can do."*

So a single action may fan out to ten upstream services with `Promise.all` inside its body. The serialisation is strictly about *invocations from one client*, and it is a property of the dispatcher — which also means a script that POSTs action IDs directly is not bound by it ([02f](02f-return-values-and-rate-limiting.md)).

### What this rules out

Head-of-line blocking is the practical failure. One slow action stalls every action that client queues behind it, so any of the following belongs in a Route Handler:

- **Typeahead / autocomplete.** Every keystroke queues behind the last, and the user sees results for a prefix they typed three characters ago.
- **Polling.** A five-second poll implemented as an action occupies the queue on a schedule.
- **Anything a component fires on mount to fetch.** The BFF guide is direct: *"[Server Actions'] primary purpose is to mutate data from your frontend client. Server Actions are queued. Using them for data fetching introduces sequential execution."*
- **Long uploads.** Not only the 1MB cap ([02d](02d-what-the-framework-gives-an-action.md)) — a slow body blocks the queue for the whole tab.

## A single response carries both the result and the UI

> *"When a Server Action triggers an immediate revalidation, Next.js does the work inside one HTTP request: it runs the action, then re-renders the current route server-side. The response that comes back contains both pieces in the same Flight stream:"*

> *"* The action's return value, consumed by `useActionState` or the awaited promise on the client.
> * A newly rendered [RSC Payload] for the current route, which the client commits as a seeded navigation."*

> *"Your application code does not need a follow-up fetch to see the updated UI for the current page."*

This is the part that most changes how you write mutation code, because the habit from a REST world is: POST, then invalidate, then refetch, then re-render. Here the mutation, the invalidation and the re-render are one roundtrip and the client commits the result as a navigation.

A re-render is included when, and only when, the action does one of four things:

> *"* Calls `updateTag` or `revalidatePath` to immediately invalidate cached data.
> * Calls `refresh` to refetch the current route's RSC Payload.
> * Mutates cookies through `cookies()`. Setting or deleting a cookie automatically re-renders the current page so the UI reflects the new value.
> * Calls `redirect`. The response navigates the router and streams the destination's RSC Payload."*

```ts
// app/posts/actions.ts
'use server'

import { revalidatePath } from 'next/cache'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'

export async function createPost(formData: FormData) {
  const session = await auth()
  if (!session?.user) throw new Error('Unauthorized')

  await db.post.create({
    data: {
      title: String(formData.get('title')),
      authorId: session.user.id,
    },
  })

  revalidatePath('/posts')
}
```

> *"The mutation, the cache invalidation, and the page re-render all complete in a single roundtrip."*

And the flip side, which explains a very common "why is my list stale?" bug:

> *"An action that does none of the above carries only its return value, and the current route is not re-rendered."*

### `redirect` throws, and ordering matters

> *"Because `redirect` throws a control-flow exception, any code after it does not run. Place revalidation calls before `redirect` if the destination needs the fresh data."*

```ts
'use server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'

export async function publishAndGo(id: string) {
  await publish(id)
  revalidatePath('/posts')   // must come first
  redirect(`/posts/${id}`)   // throws — nothing below this line executes
}
```

> *"Unlike `redirect`, none of these throw, so an action can call them and still return a value to the caller."*

That is what lets an action both invalidate a tag and return `{ error: null }` for `useActionState` to render.

## Choosing the cache update

Four functions, four different jobs, quoted:

> *"`updateTag`: immediate expiration of a tag. The next read (including the route re-render that ships with the action's response) waits for fresh data. Use when the action needs **read-your-own-writes** so the user immediately sees their change. Server Actions only."*

> *"`revalidateTag`: stale-while-revalidate refresh of a tag with a cache-life profile. Subsequent reads get the stale value while a fresh fetch happens in the background, so the action's own re-render does **not** wait for the new data."*

> *"`revalidatePath`: invalidate by URL path. Use when one route is affected and tagging is overkill."*

> *"`refresh`: refetch the current route's RSC Payload without invalidating cached data. Use when the view depends on state outside the cache that the action just changed."*

| Function | Waits for fresh data in this response? | Scope | Available in |
|---|---|---|---|
| `updateTag` | **yes** — read-your-own-writes | a tag | Server Actions only |
| `revalidateTag` (SWR profile) | **no** — background refresh | a tag | actions and handlers |
| `revalidatePath` | yes | a URL path | actions and handlers |
| `refresh` | yes (re-renders, does not invalidate) | current route | Server Actions |

🔴 **The exception that produces the most confusing bug in this whole area:**

> *"`revalidateTag` with a stale-while-revalidate profile is the exception: it marks the tag for background refresh and does **not** include a re-render in the action response. The page reflects the change on a later read."*

So an action that saves a record and calls `revalidateTag` returns successfully, the form clears, and the list still shows the old value — because the refresh is happening behind the response, not inside it. If the user must see their own write, `updateTag` is the function that promises it. `updateTag` is also **Server Actions only**, which is one of the few capabilities an action has that a handler does not.

## Gotchas

**★ Symptom: three actions wrapped in `Promise.all` take three times as long as one.** Cause: the client dispatcher sends one at a time per client; the promises resolve in order, not in parallel. Fix: do the fan-out on the server inside a single action.

```ts
// app/orders/actions.ts
'use server'
import { revalidateTag } from 'next/cache'

export async function archiveOrdersAction(ids: string[]) {
  await Promise.all(ids.map(archiveOrderInDal))   // parallel here is real parallel
  revalidateTag('orders')
}
```

**★ Symptom: a typeahead built on a Server Action lags badly and shows results for an earlier prefix.** Cause: every keystroke queues behind the previous one, and the queue is FIFO per client. Fix: search is a read — put it in a `GET` Route Handler, which has no queue.

```ts
// app/api/search/route.ts
import { searchItems } from '@/data/items'

export async function GET(request: Request) {
  const q = new URL(request.url).searchParams.get('q') ?? ''
  return Response.json(await searchItems(q))
}
```

**★ Symptom: the mutation succeeds and the list on screen still shows the old data.** Cause: the action called neither `updateTag`, `revalidatePath`, `refresh`, `redirect`, nor mutated cookies, so no re-render shipped with the response. Fix: pick the cache update that matches the intent.

```ts
'use server'
import { updateTag } from 'next/cache'

export async function renameItem(id: string, title: string) {
  await renameItemInDal(id, title)
  updateTag('items')          // the re-render in this response waits for fresh data
  return { ok: true }
}
```

**★ Symptom: the mutation succeeds, `revalidateTag` is called, and the UI *still* shows stale data — but it is correct after a refresh.** Cause: `revalidateTag` on a stale-while-revalidate cache-life profile deliberately does not include a re-render in the action response. Fix: use `updateTag` when the user must see their own write.

```ts
'use server'
import { updateTag, revalidateTag } from 'next/cache'

export async function saveProfile(input: ProfileInput) {
  await saveProfileInDal(input)
  updateTag(`profile:${input.id}`)   // the user sees their change now
  revalidateTag('directory')         // everyone else's list can refresh lazily
}
```

**★ Symptom: `revalidatePath` after `redirect` appears to do nothing.** Cause: `redirect` throws a control-flow exception, so nothing after it runs. Fix: revalidate first.

```ts
'use server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'

export async function deleteAndReturn(id: string) {
  await deletePostInDal(id)
  revalidatePath('/posts')     // before
  redirect('/posts')           // throws
}
```

**★ Symptom: an upload action makes every other button in the tab unresponsive until it finishes.** Cause: head-of-line blocking in the per-client action queue. Fix: move the bytes out of the action entirely — upload direct to storage and let the action record the resulting key ([02d](02d-what-the-framework-gives-an-action.md)).

**Symptom: `updateTag` throws or is unavailable inside a Route Handler.** Cause: the documentation lists it as *"Server Actions only."* Fix: from a handler, use `revalidateTag` or `revalidatePath`; if the caller genuinely needs read-your-own-writes semantics, that caller is your own UI and the work belongs in an action.

**Symptom: a component calls `router.refresh()` after every action to make the UI update.** Cause: the follow-up refetch habit from a REST codebase. Fix: delete it — *"Your application code does not need a follow-up fetch to see the updated UI for the current page"* when the action revalidates. The extra refresh doubles the render work and can race the seeded navigation the action response already committed.

**Symptom: two actions triggered by a fast double-click both apply.** Cause: the queue serialises them, which prevents interleaving but does not deduplicate — the second still runs after the first. Fix: disable the control while `pending` from `useActionState`, and make the mutation idempotent server-side for the case where the client control fails.

## Interview questions

**★ Why does Next.js dispatch Server Actions one at a time, and what is the cost of that decision?**
Because an action's response can carry a re-rendered RSC payload for the current route, and two concurrent actions would produce two trees rendered from two different database states, committed in whatever order the network happened to deliver them. Serialising the dispatch guarantees that the tree you commit is the one produced by the mutation you just applied — the docs put it as *"This keeps the re-rendered server tree consistent with the action result that produced it."* The cost is head-of-line blocking: one slow action stalls everything that client queues behind it, which is why reads, polling and typeahead belong in Route Handlers rather than actions.

**★ A colleague wraps five Server Actions in `Promise.all` and reports it did not get faster. Explain.**
`Promise.all` is doing its job — it awaits five promises. The dispatcher underneath refuses to start the second request until the first resolves, so the wall-clock time is the sum rather than the maximum. The documentation says it outright: *"do not rely on `Promise.all` to parallelize Server Actions from the client."* The important nuance is scope — this is *"a property of the client dispatcher, not of Server Functions in general"*, so a single action may fan out with `Promise.all` on the server and get real parallelism. The fix is to move the fan-out into one action, fetch in parallel from a Server Component, or use a Route Handler for the non-mutating parts.

**★ What comes back from a Server Action that calls `revalidatePath`, and why does that remove code you would otherwise write?**
One HTTP response carrying two things in the same Flight stream: the action's return value, which `useActionState` or the awaited promise consumes, and a newly rendered RSC payload for the current route, which the client commits as a seeded navigation. In a REST codebase this is four steps — POST, invalidate, refetch, re-render — and here it is one roundtrip, so there is no follow-up fetch and no `router.refresh()`. It also explains the failure mode: an action that revalidates nothing, refreshes nothing, sets no cookie and does not redirect carries only its return value, and the route is not re-rendered at all.

**★ `updateTag` and `revalidateTag` both invalidate a tag. When does the difference actually show on screen?**
`updateTag` expires the tag immediately, so the route re-render that ships inside the action's own response waits for fresh data — that is read-your-own-writes, and it is what you want after a user edits something they are looking at. `revalidateTag` against a cache-life profile is stale-while-revalidate: it marks the tag for a background refresh and, per the docs, *"does **not** include a re-render in the action response"*, so the response commits the old data and the change appears on a later read. The symptom is a save that succeeds and a screen that does not change until you reload — one of the more confusing bugs in this area, because everything reports success. `updateTag` is also Server Actions only, so a Route Handler cannot offer the same guarantee.

**Why does the order of `revalidatePath` and `redirect` matter inside an action?**
`redirect` throws a control-flow exception. Anything written after it does not execute, so a `revalidatePath` placed below a `redirect` never runs and the destination renders from the stale cache. The docs state the rule directly: *"Place revalidation calls before `redirect` if the destination needs the fresh data."* The contrast is worth remembering — `updateTag`, `revalidateTag`, `revalidatePath` and `refresh` do not throw, so an action can call them and still return a value to `useActionState`.

**When is `refresh` the right choice rather than a tag or a path invalidation?**
When the thing that changed is not in the data cache at all. `refresh` refetches the current route's RSC payload without invalidating cached data — the documented case is *"when the view depends on state outside the cache that the action just changed."* Session state, a cookie-derived flag, a row read uncached inside a Server Component: none of those have a tag to expire, so invalidating one would be a no-op and re-rendering is exactly what you want. Reach for it deliberately though, because it re-renders unconditionally and buys nothing when a tag would have been precise.

**Is sequential dispatch a form of protection against abuse?**
Against accident, yes; against an attacker, no. A single tab cannot issue concurrent invocations, which does bound a UI that fires on every keystroke. But the constraint lives in the client dispatcher, and a script POSTing action IDs directly never loads the dispatcher — nor does a second tab, a second browser, or a distributed client. Real limits are yours to build ([02f](02f-return-values-and-rate-limiting.md)), backed by whatever the host offers in front of the function.

---

← [02f · Return values and rate limiting](02f-return-values-and-rate-limiting.md) · Next → [02h · Route Handler mechanics](02h-route-handler-mechanics.md)
