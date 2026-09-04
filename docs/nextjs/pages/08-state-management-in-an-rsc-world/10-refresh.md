---
title: "refresh() is the only member of next/cache that invalidates nothing — it re-renders the current route inside the action's own response, which is exactly right when the thing that changed was never in the cache"
sidebar_label: "10 · refresh()"
sidebar_position: 55
description: "What refresh() from next/cache does, why it is restricted to Server Actions, how it rides the action's existing round trip, and the failure mode when the page you are refreshing is fully cached."
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-03 against [`refresh`](https://nextjs.org/docs/app/api-reference/functions/refresh)
> (doc `lastUpdated: 2026-06-25`), the [Server Actions guide](https://nextjs.org/docs/app/guides/server-actions)
> and [`useRouter`](https://nextjs.org/docs/app/api-reference/functions/use-router).
> Target: **Next.js 16.3.4**, App Router. Documentation-verified; **no sandbox run**.

**Every other on-demand function in `next/cache` exists to throw cached data away: `revalidatePath` by route, `revalidateTag` and `updateTag` by tag. `refresh()` is the odd one out. It invalidates nothing at all. It tells the framework to re-render the current route and ship the new RSC payload back inside the Server Action's own response, leaving every cache entry exactly where it was. That makes it precisely the right call — and the only correct one — when the state the user just changed was never cached in the first place, and precisely the wrong call when it was.**

## The API is one line

```ts
refresh(): void
```

No parameters, no return value, imported from `next/cache`. And one hard restriction:

> *"`refresh` can **only** be called from within Server Actions."*
> — [`refresh`, Usage](https://nextjs.org/docs/app/api-reference/functions/refresh#usage)

Route Handlers, Client Components and every other context throw. The docs' own counter-example is a `POST` handler calling `refresh()` and erroring.

```ts filename="app/[tenant]/board/actions.ts"
'use server'

import { refresh } from 'next/cache'
import { getTenantContext } from '@/data/tenant-context'

export async function reorderColumns(slug: string, order: string[]) {
  const ctx = await getTenantContext(slug)
  await persistColumnOrder(ctx, order)
  refresh()
}
```

## What it actually does

A Server Action already runs as a POST to the route that invoked it, and the response is a Flight stream. When the action does something that requires the UI to change, Next.js re-renders the current route **server-side, inside that same request**, and puts the new RSC payload in the response alongside the action's return value. The client commits it as a seeded navigation.

`refresh()` is one of the four things that trigger that re-render. The others are `updateTag`, `revalidatePath`, mutating a cookie through `cookies()`, and `redirect` (which navigates instead). What distinguishes `refresh()` from the first two is what it *does not* do on the way: it does not mark any cache entry stale, does not expire any tag, and does not invalidate any path.

So the sequence is: your action mutates something, the route re-renders, and every `'use cache'` scope on that route serves its existing entry. Only the uncached parts of the tree run again.

## Which is either the whole point, or the whole bug

**The point.** Some of what a page shows was never in a cache to begin with:

- A Server Component that queries the database directly, with no cache directive on it.
- A dynamic hole under PPR that resolves at request time on every render.
- Anything derived from request-time APIs — `cookies()`, `headers()`, `searchParams` — which cannot live inside a shared cache scope at all.
- State in an external system your action just poked: a job you enqueued, a webhook you triggered, a third-party record you updated, whose status the page reads uncached.

For all of those, `revalidatePath` would be wrong in the way a sledgehammer is wrong — it works, and it also throws away cached data that did not change, forcing a cold render of everything on that route. `refresh()` re-runs the render and leaves the caches alone.

**The bug.** If the value the user changed lives inside a `'use cache'` scope, `refresh()` re-renders the route, the cached scope returns the same entry it returned a second ago, and the UI does not move. Nothing errors. The action succeeded, the round trip happened, the payload came back — with the old data in it. This is the single most common way `refresh()` is misused, and the fix is not to add a second `refresh()`; it is to expire the tag:

```ts filename="app/[tenant]/board/actions.ts"
'use server'

import { updateTag } from 'next/cache'
import { getTenantContext } from '@/data/tenant-context'

export async function renameProject(slug: string, id: string, name: string) {
  const ctx = await getTenantContext(slug)
  await renameProjectFor(ctx, id, name)

  // The project list is a cached scope. refresh() would re-render it
  // and get the same entry back. Expire the tag instead.
  updateTag(`t:${ctx.tenantId}:projects`)
}
```

The full comparison — and how to decide between the four — is in
[10b · refresh() against the alternatives](10b-refresh-against-the-alternatives.md).

## `refresh()` does not throw, so it composes

Unlike `redirect()`, which throws a control-flow exception so nothing after it runs, `refresh()` returns normally. An action can call it and then still return a value to `useActionState`:

```ts filename="app/[tenant]/board/actions.ts"
'use server'

import { refresh } from 'next/cache'

export async function submitTimesheet(
  _prev: { error?: string },
  formData: FormData
) {
  const result = await recordHours(formData)
  if (!result.ok) return { error: result.message }

  refresh()
  return { error: undefined }
}
```

Both halves come back in one response: the returned object for `useActionState`, and the re-rendered tree for the router. See
[06 · useOptimistic and useActionState](06-useoptimistic-and-useactionstate-as-framework-native-alterna.md) for the client half.

The corollary: putting `refresh()` **after** a `redirect()` is dead code. `redirect` throws, so the line never executes — and it would be pointless anyway, because the destination route renders fresh as part of that navigation.

## One action, one refresh, one round trip

Two framework behaviours make `refresh()` cheaper than the client-side equivalent:

- The re-render travels in the action's existing response. There is no second request, and therefore no window in which the client has committed the mutation but not yet seen its effect.
- Next.js dispatches Server Actions **one at a time per client**. Three rapid clicks queue rather than race, and each one's re-render is consistent with the action result that produced it. You do not get a refresh from action 1 landing after the mutation from action 3.

That second property is also why `Promise.all` over Server Actions from the client does not parallelise anything. If you need parallel work, do it inside a single action.

## Gotchas

**★ Symptom: the action runs, the round trip completes, and the UI still shows the old value.** Cause: the data the user changed lives in a `'use cache'` scope, and `refresh()` invalidates nothing, so the re-render replays the same cache entry. Fix: expire the entry, and only then does the re-render see the change.

```ts
// Broken
await updateProject(ctx, id, data)
refresh()

// Fixed — updateTag both expires the entry AND triggers the re-render
await updateProject(ctx, id, data)
updateTag(`t:${ctx.tenantId}:project:${id}`)
```

**★ `refresh()` in a Route Handler throws, and TypeScript will not stop you.** The import resolves, the signature type-checks, and it fails at request time. The docs show this exact counter-example. For a webhook or an API endpoint the available call is `revalidateTag(tag, profile)`; `updateTag` and `refresh` are both Server-Actions-only.

**★ `refresh()` in a Client Component is a different function.** `next/cache` is a server module. What you want on the client is `router.refresh()` from `useRouter` in `next/navigation`, which is a separate API with separate semantics — see [10b](10b-refresh-against-the-alternatives.md).

**★ Calling `refresh()` after `redirect()` is unreachable.** `redirect` throws. Anything after it in the action body does not run. If the destination needs fresh data, invalidate *before* the redirect.

**★ `refresh()` does not help a page whose data comes from a client cache.** If TanStack Query or SWR owns the value on the client, re-rendering the Server Components underneath does not touch their store. Invalidate through that library's own API. See [05 · TanStack Query / RTK Query](05-tanstack-query-rtk-query-in-app-router-when-a-client-cache-s.md).

**★ You do not need `refresh()` after setting or deleting a cookie.** Mutating cookies in a Server Function already re-renders the current page so the UI reflects the new value. A `refresh()` there is redundant.

**★ `refresh()` refreshes *the current route*, not the whole application.** A sidebar on a different route that shows the same counter is untouched. If several routes depend on the changed value, that is a tag-shaped problem, not a refresh-shaped one.

**★ It is not a substitute for optimistic UI.** The re-render is fast because it rides the existing response, but it is still a server round trip. For a checkbox toggle the user should see the change immediately via `useOptimistic`, with `refresh()` or a tag update reconciling afterwards.

**★ Reaching for `revalidatePath` "because it also refreshes" costs you the caches.** `revalidatePath` invalidates the route's cached data as well as re-rendering, and from a Server Function it currently also causes previously visited pages to refresh when navigated to again — behaviour the docs describe as temporary. If nothing cached changed, that is a large amount of collateral for a re-render you could have had for free.

**★ Sequential dispatch means a burst of actions is a queue, not a race.** That is usually a relief, but it also means an action that takes two seconds delays every subsequent action from the same client, refresh included. Long mutations belong in a background job with a status the page can poll.

## Interview questions

**★ What does `refresh()` invalidate?**
Nothing. It is the one on-demand function in `next/cache` that does not touch the cache at all. It signals that the current route's RSC payload should be re-rendered and returned in the Server Action's response. Every `'use cache'` entry the route depends on is served again from cache during that render.

**★ Then why does it exist, when `revalidatePath` also re-renders?**
Because `revalidatePath` re-renders *by way of* invalidating, and the invalidation is collateral damage when the thing that changed was never cached. If your page shows a job status read live from a queue, or a value derived from `cookies()`, or output from an uncached Server Component, there is no cache entry standing between the mutation and the UI — you just need the render to happen again. `refresh()` does that and leaves the rest of the route's cached data intact.

**★ Why is `refresh()` restricted to Server Actions?**
Because what it does is defined relative to an action: it makes the action's own response carry a freshly rendered payload for the route that invoked the action. Outside that context there is no "current route" in flight and no response to attach a re-render to. A Route Handler serves an arbitrary HTTP request that may have nothing to do with any rendered page, which is why the tag-based `revalidateTag` is the function available there.

**★ A teammate adds `refresh()` at the end of an action and reports that "it does not work". What do you check?**
Whether the data the action changed is inside a cache scope. If the page reads it through a `'use cache'` function, the re-render replays the cached entry and produces identical output. The fix is `updateTag` on a tag that covers that entry — which also triggers the re-render, so the `refresh()` becomes redundant rather than additional.

**★ Does `refresh()` cost an extra network round trip?**
No. The re-render is produced server-side during the action's own request and streamed back in the same response, which the client commits as a seeded navigation. That is the main advantage over doing the same thing from the client after the action resolves.

**★ Can you call `refresh()` and still return a value from the action?**
Yes. It does not throw, unlike `redirect()`, so control flow continues. The response carries both the action's return value — consumed by `useActionState` or the awaited promise — and the re-rendered tree.

**★ Where in an action should invalidation calls go relative to `redirect()`?**
Before it. `redirect` throws a control-flow exception, so any invalidation after it never runs. If the redirect destination needs to reflect the mutation, the tag or path has to be invalidated first.

---

← [07 · SprintDesk board filters in the URL](07-project-milestone-sprintdesk-board-filters-in-the-url.md) · [Chapter 8 overview](01-explanation.md) · Next → [10b · refresh() against the alternatives](10b-refresh-against-the-alternatives.md)
