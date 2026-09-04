---
title: "There are five ways to make the screen show new data and they are not interchangeable — pick by asking what changed, not by which one you remember"
sidebar_label: "10b · refresh() vs the alternatives"
sidebar_position: 56
description: "refresh() against router.refresh(), revalidatePath, revalidateTag and updateTag: what each one invalidates, where each may be called, who pays the round trip, and the decision tree."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-03 against [`refresh`](https://nextjs.org/docs/app/api-reference/functions/refresh),
> [`useRouter`](https://nextjs.org/docs/app/api-reference/functions/use-router),
> [`revalidatePath`](https://nextjs.org/docs/app/api-reference/functions/revalidatePath),
> [`revalidateTag`](https://nextjs.org/docs/app/api-reference/functions/revalidateTag),
> [`updateTag`](https://nextjs.org/docs/app/api-reference/functions/updateTag) and the
> [Server Actions guide](https://nextjs.org/docs/app/guides/server-actions).
> Target: **Next.js 16.3.4**, App Router. Documentation-verified; **no sandbox run**.

**Five APIs make the screen show new data, and they differ along three axes that nobody memorises: what they invalidate, where they may be called, and whether the user who triggered them sees the result immediately or on some later read. Choosing by habit — "I always call `revalidatePath('/')`" — produces one of two outcomes, both of which get shipped: a page that does not update, or a deployment-wide cache purge fired by a checkbox. The question that picks correctly every time is not "how do I refresh?" but "what changed, and was it in a cache?"**

## The five, side by side

| Call | Module | Callable in | Invalidates | Immediate re-render in the action response? |
|---|---|---|---|---|
| `refresh()` | `next/cache` | Server Actions only | **nothing** | Yes |
| `updateTag(tag)` | `next/cache` | Server Actions only | the tag, immediately | Yes |
| `revalidateTag(tag, profile)` | `next/cache` | Server Functions and Route Handlers | the tag, as stale | **No**, with a stale-while-revalidate profile |
| `revalidatePath(path, type?)` | `next/cache` | Server Functions and Route Handlers | the route path | Yes |
| `router.refresh()` | `next/navigation` (`useRouter`) | Client Components only | client cache for the current route; **not** the server cache | N/A — it is its own request |

Two columns are worth staring at. The **invalidates** column is why `refresh()` is not a stronger `revalidatePath` and `revalidatePath` is not a broader `refresh()` — they sit on opposite ends of it. The **immediate re-render** column is why `revalidateTag(tag, 'max')` in a form action produces the bug report "I have to reload to see my own change".

## `router.refresh()` is a different animal

It lives in `next/navigation`, runs on the client, and issues its own request:

```tsx filename="app/[tenant]/board/live-updates.tsx"
'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export function LiveUpdates({ streamUrl }: { streamUrl: string }) {
  const router = useRouter()

  useEffect(() => {
    const source = new EventSource(streamUrl)
    source.addEventListener('board-changed', () => router.refresh())
    return () => source.close()
  }, [router, streamUrl])

  return null
}
```

What it does: makes a new request to the server, re-fetches data requests, re-renders Server Components, and merges the updated payload into the existing tree **without losing client React state such as `useState`, or browser state such as scroll position**. It clears the Client Cache for the current route. It does **not** invalidate anything on the server — for that you still need `revalidatePath` or `revalidateTag`.

The trap the docs call out directly: `router.refresh()` can reproduce the identical result if the underlying fetches are cached. It is a re-render request, not an invalidation, and in that respect it is the client-side twin of `refresh()`. What genuinely can change across a `router.refresh()` is anything request-time — cookies, headers, and the clock.

One more detail with practical consequences: `router.bfcacheId` — the opaque identifier scoped to the current route segment — **does not change** across a `router.refresh()`, just as it does not change across back/forward navigation. It changes only when a push or replace navigation freshly creates the segment. So a `useEffect` keyed on `bfcacheId` will not re-run on refresh, which is either exactly what you want or a silently missing hook call.

### When `router.refresh()` is the right answer and `refresh()` is not

`refresh()` requires a Server Action. So the client-side version is correct whenever the *trigger* is not an action:

- A server-sent event or WebSocket message says the board changed.
- A polling interval on a job status page.
- A third-party SDK completed something out-of-band — a payment widget, an OAuth popup, a sign-out call that cleared a cookie via its own endpoint.
- A `fetch` to a Route Handler mutated something, and you are not using an action for it.

In all of those there is no action response to piggyback on, so a second request is unavoidable and `router.refresh()` is the intended way to make it.

### When it is the wrong answer

Calling `router.refresh()` from the `onSuccess` of a Server Action you just awaited is a second round trip to obtain something the first one could have carried:

```tsx
// Redundant: the action could have called refresh() or updateTag()
// and the new tree would have arrived in the action's own response.
await saveSettings(formData)
router.refresh()
```

## The decision tree

Ask one question at a time.

**1 · Did the change happen to data inside a `'use cache'` scope?**

- **No** — the page reads it uncached, or from `cookies()`, or from an external system.
  → In a Server Action: `refresh()`. Anywhere else on the client: `router.refresh()`.
- **Yes** — continue.

**2 · Are you inside a Server Action?**

- **Yes**, and the user who triggered it must see their own change immediately (a form, a toggle, a rename)
  → `updateTag(tag)`. It expires the tag and the re-render that ships with the action's response waits for fresh data.
- **Yes**, but staleness for a while is fine (a background counter, a leaderboard)
  → `revalidateTag(tag, 'max')`, accepting that the submitting user will not see the change in this response.
- **No** — you are in a Route Handler, a webhook, a cron endpoint. `updateTag` and `refresh` both throw there.
  → `revalidateTag(tag, 'max')` for stale-while-revalidate, or `revalidateTag(tag, { expire: 0 })` when the data must be gone now.

**3 · Is the data tagged at all?**

- **No, and tagging it is not practical** — it is a whole route's worth of output, or an old `fetch`-cached page.
  → `revalidatePath('/literal/path')`. Reach for a route pattern plus `'page'` / `'layout'` only when you really do mean every matching page.

Tag mechanics, profiles and the deprecated single-argument `revalidateTag` are covered in
[../05-caching-ppr-and-cache-components/10-the-three-cache-directives/05b-revalidatetag-and-updatetag.md](../05-caching-ppr-and-cache-components/10-the-three-cache-directives/05b-revalidatetag-and-updatetag.md).

## Two things that re-render without you asking

Worth knowing so you do not add a redundant call:

- **Mutating a cookie in a Server Function.** Setting or deleting a cookie automatically re-renders the current page so the UI reflects the new value. A theme toggle or a locale switcher that writes a cookie needs no `refresh()`.
- **`redirect()`.** The response navigates the router and streams the destination's payload. Invalidate before it if the destination needs fresh data; do not refresh after it, because `redirect` throws and the line never runs.

## A worked example: three calls in one feature

SprintDesk's board has a rename, a "re-run the nightly digest" button, and a Stripe webhook. Three different answers.

```ts filename="app/[tenant]/board/actions.ts"
'use server'

import { refresh, updateTag } from 'next/cache'
import { getTenantContext } from '@/data/tenant-context'

// 1 · Renames a row the board reads through a cached, tagged function.
export async function renameProject(slug: string, id: string, name: string) {
  const ctx = await getTenantContext(slug)
  await renameProjectFor(ctx, id, name)
  updateTag(`t:${ctx.tenantId}:project:${id}`)
  updateTag(`t:${ctx.tenantId}:projects`)
}

// 2 · Enqueues a job. The page shows the job's status, read live and uncached.
export async function rerunDigest(slug: string) {
  const ctx = await getTenantContext(slug)
  await enqueueDigestJob(ctx)
  refresh() // nothing cached changed; the render just needs to run again
}
```

```ts filename="app/api/webhooks/billing/route.ts"
import { revalidateTag } from 'next/cache'

// 3 · Out-of-band, no session, no action. updateTag and refresh both throw here.
export async function POST(request: Request) {
  const event = await verifyWebhook(request)
  revalidateTag(`t:${event.data.metadata.tenantId}:billing`, { expire: 0 })
  return Response.json({ ok: true })
}
```

The rename could have used `refresh()` and would have appeared to do nothing. The digest button could have used `revalidatePath` and would have worked while needlessly cold-starting every cached scope on the route. The webhook has no choice at all.

## Gotchas

**★ Symptom: the user submits a form and has to reload to see their own change.** Cause: the action called `revalidateTag(tag, 'max')`, and a stale-while-revalidate profile deliberately omits the immediate re-render from the action's response. Fix: use `updateTag` in Server Actions when the submitter must see the write.

```ts
// Before — correct data eventually, wrong experience now
revalidateTag(`t:${ctx.tenantId}:projects`, 'max')

// After — expires immediately, and the action's re-render waits for fresh data
updateTag(`t:${ctx.tenantId}:projects`)
```

**★ `router.refresh()` after awaiting a Server Action is a wasted round trip.** The action could have carried the new tree in its own response via `refresh()`, `updateTag` or `revalidatePath`. The client-side call is for triggers that are not actions.

**★ `router.refresh()` does not invalidate anything on the server.** It clears the Client Cache for the current route and asks for a new render. If the value lives in a `'use cache'` entry that is still fresh, you get the same bytes back. The docs say this outright about cached fetches.

**★ `refresh()` and `router.refresh()` are different functions from different modules with the same name.** One is `next/cache`, server, Server-Actions-only. The other is a method on the object returned by `useRouter` from `next/navigation`, client-only. Autocomplete will happily give you the wrong one.

**★ `updateTag` and `refresh` throw in Route Handlers.** Both are Server-Actions-only. Webhooks, cron endpoints and API routes get `revalidateTag` and `revalidatePath`, nothing else.

**★ `revalidateTag(tag)` without a profile is deprecated.** It behaves like `{ expire: 0 }` and only survives while TypeScript errors are suppressed. In an action the replacement is usually `updateTag`; in a handler it is an explicit profile.

**★ `revalidatePath('/', 'layout')` purges the Client Cache and invalidates all cached data.** It is the correct tool for an admin "clear everything" button and a serious incident when it is wired to a per-item mutation.

**★ `revalidatePath` addresses route files, not the URL in the address bar.** Under a rewrite you must pass the destination path. This bites hardest in multi-tenant apps where a subdomain is rewritten to a `[tenant]` segment — see [../15-databases-apis-and-full-stack-patterns/10e-tenant-scoped-invalidation-and-prerendering.md](../15-databases-apis-and-full-stack-patterns/10e-tenant-scoped-invalidation-and-prerendering.md).

**★ From a Server Function, `revalidatePath` currently also refreshes previously visited pages on next navigation.** The docs describe this as temporary and intended to narrow to the specific path. Do not build behaviour that depends on the wide version.

**★ `router.bfcacheId` does not change on `router.refresh()`.** Effects keyed on it will not re-run. It changes when a push or replace navigation freshly creates the segment, not on refresh, back/forward, or search-param- and hash-only navigations.

**★ Neither refresh touches a client data cache.** TanStack Query and SWR own their own stores; re-rendering the Server Components around them changes nothing they hold. Invalidate through their APIs — see [05 · TanStack Query / RTK Query](05-tanstack-query-rtk-query-in-app-router-when-a-client-cache-s.md).

**★ Polling with `router.refresh()` re-renders the whole route.** For a single status field on a heavy page that is a lot of tree for one string. Consider a narrow Route Handler polled with SWR, or server-sent events that trigger a refresh only when something actually changed.

**★ A refresh is not an optimistic update.** Both `refresh()` and `router.refresh()` complete after the server responds. For interactions that must feel instant, `useOptimistic` renders the intended state immediately and the refresh reconciles it. See [06 · useOptimistic and useActionState](06-useoptimistic-and-useactionstate-as-framework-native-alterna.md).

## Interview questions

**★ What is the difference between `refresh()` and `router.refresh()`?**
`refresh()` is a server function from `next/cache` callable only inside a Server Action; it makes that action's response carry a freshly rendered payload for the current route, invalidating nothing. `router.refresh()` is a client method from `useRouter` in `next/navigation`; it issues its own request, clears the Client Cache for the current route, re-renders Server Components and merges the result while preserving `useState` and scroll position. It also invalidates nothing on the server. Same idea, two different transports — and the choice is decided by where the trigger lives.

**★ Which of the five calls do you reach for after a form submission that renames a cached, tagged row?**
`updateTag` on the tags covering that row and its collection. It expires the entries immediately and the re-render bundled into the action's response therefore reads fresh data, which is what read-your-own-writes means. `refresh()` would re-render and replay the same cache entry. `revalidateTag(tag, 'max')` would be correct data eventually but the submitter would still see the old name.

**★ Why does `revalidateTag` take a second argument now, and what does the value mean?**
It sets how long stale content may still be served after the tag is marked. `'max'` is a one-year window, so requests effectively always get the stale value while a revalidation runs in the background. `{ expire: 0 }` means no stale content, so the next request blocks on a fresh render. The single-argument form is deprecated and behaves like `{ expire: 0 }`. The parameter exists because "invalidate this" is ambiguous about whether correctness or latency wins in the gap.

**★ You are writing a webhook handler that must clear a cache when an external system changes. What is available to you?**
`revalidateTag` and `revalidatePath`. `updateTag` and `refresh` are Server-Actions-only and throw in a Route Handler. Pass `{ expire: 0 }` if the stale value is unacceptable — a downgraded plan, a revoked permission — and `'max'` if serving stale for a while is fine. Also authenticate the webhook by signature, because there is no session behind it.

**★ Your job-status page polls with `router.refresh()` and the status never changes. What are the candidates?**
Either the status is read through a cached scope whose entry is still fresh — `router.refresh()` does not invalidate server caches, and the docs warn that a refresh can reproduce the same result when the underlying fetches are cached — or the component holding the status is a Client Component whose state is preserved across the merge, so the new server value never reaches it. The first is fixed by tagging the read and invalidating, or by not caching a live status at all; the second by deriving the displayed value from props rather than seeding it into `useState`.

**★ Why does `router.refresh()` preserve `useState` while a normal navigation may not?**
Because it is not a navigation. It requests a new RSC payload for the current route and merges it into the existing tree, so the client component instances are not unmounted — their state and the browser's scroll position survive. That is also why it is the right tool for live updates: the board re-renders with new server data while the user's open dialog and scroll position stay put.

**★ When is doing nothing the correct answer?**
When the action set or deleted a cookie — that already re-renders the current page — and when the action ends in `redirect()`, because the destination is rendered as part of the navigation. Adding a refresh in either case is a redundant call that makes the next reader think there is a subtlety they are missing.

**★ Give a case where `refresh()` is correct and every tag-based call is wrong.**
A page that shows the live status of a queued job. The status is read from the queue on every render with no cache directive, so there is no tag to expire and no path whose cached output is wrong. The action enqueues the job and calls `refresh()`; the render runs again, re-reads the queue, and the row appears as "queued". `revalidatePath` would achieve the same visible result while additionally cold-starting every cached scope on that route for no reason.

---

← [10 · refresh()](10-refresh.md) · [Chapter 8 overview](01-explanation.md)
