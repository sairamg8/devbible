---
title: "RSC data flow is enough exactly when every value on screen is a function of the URL, the session and the system of record, and the trigger for every change is a request the user made"
sidebar_label: "02 · When RSC data flow is enough"
sidebar_position: 6
description: "The four moves of the RSC loop, the two structural properties that decide its limits — segment granularity and request-driven triggering — the signals that say it suffices, the signals that say it does not, and the one symptom that looks like insufficiency and is really the wrong invalidation call."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-05 against the [Server Actions guide](https://nextjs.org/docs/app/guides/server-actions), [The Server and Client Boundary](https://nextjs.org/docs/app/guides/server-and-client-boundary) (`lastUpdated: 2026-08-25`), [`refresh`](https://nextjs.org/docs/app/api-reference/functions/refresh) (`lastUpdated: 2026-06-25`), [`revalidateTag`](https://nextjs.org/docs/app/api-reference/functions/revalidateTag), [`useRouter`](https://nextjs.org/docs/app/api-reference/functions/use-router), the [Instant navigation guide](https://nextjs.org/docs/app/guides/instant-navigation) and [`cookies`](https://nextjs.org/docs/app/api-reference/functions/cookies) (`lastUpdated: 2026-06-09`).
> Target: **Next.js 16.3.4** App Router · **React 19.2.8** · TypeScript 7.0.2. Documentation-verified; **no sandbox run**.

**"Do I need a state library" is the wrong question, because the answer is always "for some of it". The right question is where the line falls, and the line is not a matter of taste — it is a structural property of the RSC loop. That loop re-renders **a route segment** and it is triggered by **a request**. Every value whose granularity is coarser than a segment and whose change is caused by something the user asked for is inside the loop, and adding a store for it buys you duplication, a second authority and a bigger bundle. Every value that is finer-grained than a segment, or that changes because of something other than a request, is outside the loop, and refusing a client solution for it buys you prop-drilling you cannot actually perform and round trips you cannot actually parallelise. This page makes both sides of that line testable.**

## The loop, in four moves

Everything Next.js gives you for server state is these four, and nothing else. Knowing them individually is what makes the boundary obvious.

**1 · Render.** A Server Component reads data during its own render — no loader step, no API route in between.

> *"Because a Server Component runs only on the server, it can access resources such as a database, the filesystem, an internal service, or a secret. The component reads these resources during its own render, without an API route that exposes the data to the client first."*
> — [The Server and Client Boundary](https://nextjs.org/docs/app/guides/server-and-client-boundary)

**2 · Navigate.** A navigation is a new server render of part of the tree, and the *part* matters:

> *"**Client navigations** only re-render below the layout the current and destination routes share, so the fallback UI defined by a `<Suspense>` boundary above that point can't be used during the transition."*
> — [Instant navigation › What "instant" means](https://nextjs.org/docs/app/guides/instant-navigation#what-instant-means)

**3 · The URL.** `searchParams` are inputs to that render, so changing them re-derives server state without any client mechanism at all. A `<form method="get">` is a complete state update with zero JavaScript.

**4 · Mutate.** A Server Action writes to the system of record and then names what is now wrong. The payoff is documented precisely:

> *"When `updateTag`, `revalidatePath`, or `refresh` runs, Next.js re-renders the current route server-side and includes a newly rendered RSC Payload in the action's response, so the page reflects the change in the same roundtrip."*
> — [Server Actions](https://nextjs.org/docs/app/guides/server-actions)

Setting a cookie has the same property without any explicit call:

> *"After you set or delete a cookie in a Server Function, Next.js can return both the updated UI and new data in a single server roundtrip when the function is used as a Server Action."*
> — [`cookies`](https://nextjs.org/docs/app/api-reference/functions/cookies)

The four functions differ in what they invalidate on the way; the comparison lives in [10](10-refresh.md) and [10b](10b-refresh-against-the-alternatives.md) and is not repeated here.

## The two properties that decide everything

Compress the four moves and two facts remain. Every question in this chapter is one of these two in disguise.

> **Granularity: the unit the loop re-renders is a route segment — specifically, everything below the layout the current and destination routes share. Not a component, not a value.**

> **Trigger: the loop runs because a request happened — a navigation, a form submission, a Server Action. Nothing else starts it.**

A value is *inside* the loop when both hold: it is fine for the whole segment to re-render when it changes, and it changes because the user did something that produced a request. A value is *outside* when either fails.

That is the entire boundary. The two lists below are just that sentence applied.

## The signals that RSC data flow is enough

Each signal comes with the test that settles it, because the signal alone is too easy to agree with.

**1 · Every value on screen is derivable from (URL + session + system of record).**
*Test:* open the page in a private window, paste the URL, and ask whether the screen should look identical. If yes, there is nothing for a store to hold.

**2 · Every change is user-initiated and one round trip is acceptable.**
*Test:* name the event that changes the value. If every answer is "the user clicked/typed/navigated", the trigger property holds.

**3 · No two client components need to agree on a value that is not in the URL.**
*Test:* draw the tree and mark the components that read the value. If they share a *client* ancestor, `useState` in that ancestor is sufficient. If they share only a *server* ancestor, see [02d](02d-look-alikes-forms-boundaries-and-streaming.md) before reaching for a store — lifting the boundary usually solves it.

**4 · Nothing pushes.**
*Test:* is there a websocket, an SSE stream, a poll, or another user whose action must appear here without this user acting? If not, the trigger property holds.

**5 · No value must survive a route change while staying out of the URL.**
*Test:* list what should still be true after navigating away and back. If the answer is "the filters" or "the page" or "the sort", that is URL state. If it is "nothing", the loop is enough.

**6 · Optimism is scoped to one action.**
*Test:* while a mutation is in flight, does anything *outside the action's own subtree* need to show the pending value? If not, `useOptimistic` covers it and the state dies with the action — see [02c](02c-look-alikes-url-cookies-and-optimistic.md).

**7 · Segment-wide re-rendering is affordable.**
*Test:* if the value changes ten times a second, would you re-render the segment ten times a second? A drag handle fails this immediately, and so does a text input bound to a server-side search — the fix for the second is a client-side debounce feeding the URL, not a store.

When all seven hold, a client state library adds a second authority, a second copy of the data in the payload and the bundle, and an invalidation protocol you now have to maintain. That is the actual cost, and it is enumerated in [02e](02e-the-cost-of-getting-it-wrong.md).

## The signals that it is not enough

**1 · Two client leaves must agree, and their only common ancestor is a Server Component.**
This is the hard case, and it is hard for a structural reason: you cannot pass a setter down. *"Data crosses through props, and it must be serializable, so functions like event handlers cannot cross."* A Server Component physically cannot hand `setSelected` to its children. Your options are exactly three — put the value in the URL, lift the client boundary above both leaves so they share a client ancestor, or use a store. [04 · Client state tools compared](04-client-state-tools-compared-react-context-zustand-jotai.md) is the third option in detail.

**2 · Optimistic state must be visible outside the action's subtree.**
`useOptimistic` is scoped to a component and to an in-flight Action: *"Optimistic state only renders while an Action is in progress, otherwise `value` is rendered."* If a header count and a list row must both show the pending value, and they do not share a client ancestor, that is a store.

**3 · Data arrives without a request.**
Websockets, server-sent events, a poll faster than a user would navigate, a collaborative cursor. The framework cache is not driving any of these; nothing in the four moves fires. This is the canonical case for [05 · TanStack Query / RTK Query in App Router](05-tanstack-query-rtk-query-in-app-router-when-a-client-cache-s.md).

**4 · A client cache must accumulate across navigations.**
Infinite scroll where page 4 must still be there after visiting a detail route and coming back; a list whose scroll position and loaded pages are the product of a long session. A server re-render produces the *current* segment, not the accumulation.

**5 · State must survive a route change and must not be in the URL.**
A half-completed multi-step form. A draft comment. An unsaved diagram. Encoding these in the URL is either impossible or a privacy problem, and they are destroyed by the navigation that a server-driven flow relies on.

**6 · The value changes faster than a round trip.**
Drag position, canvas pan and zoom, a resize handle, a virtualised scroll index. Sixty updates a second is not a candidate for segment re-rendering under any invalidation strategy.

**7 · The value is derived from a browser-only API.**
Viewport size, media query state, geolocation, clipboard, `IntersectionObserver`, device orientation. The server cannot compute these, so they are client state by definition — the only question is scope.

**8 · The interaction must work offline or across a disconnection.**
A queue of pending mutations is client state with a persistence requirement, and nothing in the four moves models it.

## Gotchas

**★ Symptom: a store was added "because the RSC loop is too slow", and profiling shows the slowness is in the first paint.** Cause: a client store cannot make the server faster; it moves the fetch into the browser, which adds a round trip after hydration rather than removing one. Fix: stream the server fetch instead, which starts the request before the client exists — a promise is serializable, so it can be handed across the boundary and read with `use`.

```tsx filename="app/board/page.tsx"
import { Suspense } from 'react'
import { getBoardStats } from '@/data/stats'
import { StatsPanel } from './stats-panel'

export default function Page() {
  const statsPromise = getBoardStats() // started here, NOT awaited
  return (
    <Suspense fallback={<p>Loading stats…</p>}>
      <StatsPanel statsPromise={statsPromise} />
    </Suspense>
  )
}
```

```tsx filename="app/board/stats-panel.tsx"
'use client'

import { use } from 'react'

export function StatsPanel({ statsPromise }: { statsPromise: Promise<BoardStats> }) {
  const stats = use(statsPromise)
  return <p>{stats.open} open · {stats.done} done</p>
}
```

**★ Symptom: a fresh value on the page is stale for exactly the first few minutes after every deploy, then correct.** Cause: nothing to do with state management — cache entries key on the build id, so the first request per route recomputes, and any `stale` window in the browser is measured from that. Fix: none in application code; verify by checking whether the same value is correct on a hard reload, which bypasses the browser copy, before you conclude the loop is at fault.

```ts filename="data/board.ts"
import 'server-only'

export async function boardColumns(teamId: string) {
  'use cache'
  // If this must be warm at t=0 after deploy, prerender the route that uses it
  // rather than relying on an on-demand cache entry.
  return db.column.findMany({ where: { teamId }, orderBy: { position: 'asc' } })
}
```

**★ Symptom: a component reads the same data as its parent and someone adds a store "to avoid fetching twice".** Cause: on the server there is no second fetch to avoid — *"Identical `fetch` requests are memoized during a server render"*, and `React.cache` covers non-`fetch` data access. Fix: call the data function again where you need it, and memoise it once at the data layer.

```ts filename="data/tasks.ts"
import 'server-only'
import { cache } from 'react'

// Called from the page, the header and a sidebar in one render: one query.
export const getBoard = cache(async (teamId: string) => {
  return db.board.findUnique({ where: { teamId }, include: { columns: true } })
})
```

**★ Symptom: after an action the list is right but a `useEffect` in a client child runs again unexpectedly.** Cause: the documented consequence of the single-round-trip model — *"The UI is not unmounted, but effects that depend on data coming from the server will re-run."* Fix: this is correct behaviour; make the effect idempotent rather than trying to suppress the re-render.

```tsx
'use client'

import { useEffect, useRef } from 'react'

export function AnalyticsOnce({ boardId }: { boardId: string }) {
  const sent = useRef<string | null>(null)
  useEffect(() => {
    if (sent.current === boardId) return // idempotent across payload merges
    sent.current = boardId
    track('board_viewed', { boardId })
  }, [boardId])
  return null
}
```

## Interview questions

**★ State the boundary between "RSC data flow is enough" and "you need a client store" in one sentence, without listing examples.**
The RSC loop re-renders a route segment and is triggered by a request, so it covers exactly the values whose change is both segment-grained and user-initiated; anything finer-grained than a segment or triggered by something other than a request is outside it. Every example on either list is a consequence of that sentence — drag position fails the granularity half, a websocket fails the trigger half, a filter fails neither and therefore belongs in the URL.

**★ Why is "two sibling client components need to share state" a *structural* argument rather than a preference?**
Because the usual fix is unavailable. Normally you lift the state to the closest common ancestor and pass a setter down. Here the closest common ancestor is a Server Component, and a Server Component cannot pass a setter to anything: data crosses the boundary by serialization, and *"functions like event handlers cannot cross"*. So the ordinary React answer is physically impossible, and you are left with exactly three: move the value into the URL where the server can read it, lift the client boundary so both leaves share a client ancestor, or introduce a store. Choosing between those three is a real design decision; "just lift state up" is not an option you have.

**★ A colleague says the app needs TanStack Query because the dashboard must refresh every ten seconds. Is that right?**
It depends entirely on whether the ten seconds is a *cache lifetime* or a *push*. If the requirement is "data no more than ten seconds old, refreshed when the user is looking", a `cacheLife` profile with a short `revalidate` plus a re-render on navigation is a server-side answer with no client cache and no extra bundle. If the requirement is "the number changes on screen while nobody touches the page", nothing in the four moves fires — no navigation, no action, no request — and you need something client-side driving it. The question to ask is not "how often" but "what makes it happen".

**★ Why does a client store never fix a slow first paint?**
Because it moves the fetch to after hydration. The server render already had the opportunity to start the request before the browser had parsed anything; a store starts it once the JavaScript has downloaded, parsed and mounted. The documented alternative is to start the request on the server and pass the pending promise across the boundary — promises are serializable — so *"the Client Component does not need to fetch the same data after mount"*. A store is the right tool for data that depends on client-only state or on an interaction, which is precisely the data the server could not have started fetching anyway.

**★ How does the segment granularity of the loop show up as a performance problem, and what do you do about it?**
The unit re-rendered is everything below the shared layout of the current and destination routes, so a value that changes often forces a large re-render even when only one leaf displays it. Two remedies exist before a store: push the boundary down by moving the changing content into a deeper segment or a separate `<Suspense>` boundary so less is in scope, and move the expensive work into a cached function so the re-render replays a payload instead of re-querying. A store is the right answer only when the update frequency is genuinely beyond what a request-driven loop should be doing — sixty times a second, not once a click.

---

← [01e · Stale mirrors and drift](01e-the-stale-mirror-and-the-drifting-store.md) · [Chapter 8 overview](01-explanation.md) · Next → [02b · The symptom that lies](02b-the-symptom-that-lies.md)
