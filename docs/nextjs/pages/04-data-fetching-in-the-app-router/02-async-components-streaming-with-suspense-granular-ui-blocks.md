---
title: "An async Server Component is coherent because the server renderer emits a stream rather than a tree, and a `<Suspense>` boundary is the seam in that stream — the shell flushes with the fallback in it, and the real HTML arrives later with a script that swaps it in"
sidebar_label: "02 · async components and streaming"
sidebar_position: 2
description: "Why a Server Component is allowed to be async, what a Suspense boundary actually does to the HTML stream, the static shell, the component payload, selective hydration, and why one await above a boundary blocks everything below it."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-03 for **Next.js 16.3.4** against [Streaming](https://nextjs.org/docs/app/guides/streaming) (docs `lastUpdated` 2026-08-25), [Fetching Data](https://nextjs.org/docs/app/getting-started/fetching-data) (`lastUpdated` 2026-08-25) and [`<Suspense>`](https://react.dev/reference/react/Suspense) on react.dev.
> Target: **Next.js 16.3.4**, **React 19.2.8**, App Router, Node >= 20.9. Documentation-verified; **no sandbox run**.

**`async function Page()` looks like it should not work. A React component is supposed to return an element synchronously, and a function that returns a promise cannot be called by a renderer that expects one. It works because the server renderer does not build a tree and hand it over — it emits a *stream*, and a promise in the middle of that stream is a hole that gets filled later. `<Suspense>` is the declaration of where such a hole is allowed to be. Everything else on this page follows from that one fact: what the shell is, why the fallback ships in the first chunk, why each boundary hydrates on its own, and why a single `await` placed above a boundary rather than inside it deletes the benefit entirely. This page is the mechanism; [02b](02b-where-to-put-boundaries-loading-js-and-granular-streaming.md) is where to put the boundaries and [02c](02c-streaming-after-the-shell-status-codes-errors-and-infrastructure.md) is what happens once the shell has already flushed.**

## Why a Server Component may be `async`, and a Client Component may not

A Server Component runs once, on the server, and never re-renders. It has no state, no effects and no lifecycle — so there is no reason it must return synchronously. The renderer can await it and continue when it resolves, because there is no subsequent render to be consistent with.

A Client Component cannot be `async`. The documentation states this positively rather than as a prohibition — a Client Component resolves a promise with `use()` — but the reason is the same fact viewed from the other side: it re-renders, and a re-render that returned a promise would give React two different pending results for one component with no rule for which wins. Client Components read a promise with `use()` instead, which suspends in a way React can restart.

```tsx
// app/orders/page.tsx — a Server Component. The component IS the loader.
export default async function OrdersPage() {
  const orders = await getOrders()
  return <OrderTable rows={orders} />
}
```

```tsx
// app/orders/live-total.tsx — a Client Component. Not async; reads a promise.
'use client'

import { use } from 'react'

export function LiveTotal({ totalPromise }: { totalPromise: Promise<number> }) {
  const total = use(totalPromise)
  return <strong>{total.toFixed(2)}</strong>
}
```

There is no `getServerSideProps`, no `useEffect` fetch and no data-fetching hook on the server, because none is needed: the function that produces the UI is the same function that loads the data, and the framework's job is to know when it resolved.

## What a `<Suspense>` boundary does to the response

React's server renderer produces HTML in chunks aligned with `<Suspense>` boundaries. The sequence, per the Next.js streaming guide:

1. **The shell goes out first.** Everything that renders before any async work resolves — layouts, navigation, and the fallback UI of every boundary — is the **static shell**, and it is sent immediately. That includes the `<link>` and `<script>` tags in the first chunk, so the browser starts fetching CSS, JS and fonts while the server is still working.
2. **Each boundary resolves independently.** When the content inside a boundary is ready, React streams its completed HTML plus two inline `<script>` tags: one that swaps the fallback DOM node for the new content, and one carrying the component payload so React can hydrate it later.
3. **The swap happens without JavaScript being ready.** The browser executes the swap script immediately — it does not wait for the page's bundle to load or for hydration to finish. This is why streamed content appears before the page is interactive.

> *"React sends the shell with the `fallback` first, then streams in each boundary's HTML and swaps out its `fallback` as that content arrives."*

The transport is [chunked transfer encoding](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Transfer-Encoding); the placeholders React leaves in the shell are `<template>` elements with generated IDs, and the resolved content arrives as a hidden `<div>` that the swap script moves into place. Two consequences that matter later: the response has already committed to a status code by the time the first chunk leaves ([02c](02c-streaming-after-the-shell-status-codes-errors-and-infrastructure.md)), and anything that buffers the response — a reverse proxy, a CDN, a compression layer — collapses all of this back into one delayed document.

## The component payload, and what changes on navigation

Alongside the HTML, React streams a **component payload**: a serialized representation of the component tree used to hydrate the page and to handle client-side updates. On the initial load it is embedded in the HTML stream. On a client-side navigation, **only** the payload is fetched — with an `rsc: 1` request header — and no HTML is transferred at all; React updates the tree in place.

That asymmetry explains a class of confusing bug reports. A boundary that behaves one way on a hard load and another way on an in-app navigation is not flaky: the first path streamed HTML with swap scripts, and the second path streamed a payload into an already-mounted React tree. `loading.js` fallbacks are also prefetched for navigation, which is why an in-app transition can show its skeleton instantly and a cold load cannot.

## Selective hydration: each boundary is a hydration unit

Without boundaries, React hydrates the whole page in one blocking pass — one long task on the main thread. With them, hydration is split per boundary, the tasks yield to the browser, and React prioritises hydrating whatever the user is interacting with. The Next.js docs name this directly as an INP lever: each `<Suspense>` boundary is a hydration unit.

This is the second reason to put a boundary somewhere, and it is independent of the first. Even if a section's data were instant, splitting it out still splits its hydration. It is also the reason not to sprinkle boundaries everywhere — see the warning below.

## The failure everyone hits: one `await` above the boundary

```tsx
// 🔴 The boundary is decorative. The page already awaited before it rendered
// any JSX at all, so the shell cannot flush until getRevenue() resolves —
// and the fallback is never even shown.
export default async function Dashboard() {
  const revenue = await getRevenue()      // blocks the entire response
  return (
    <div>
      <h1>Dashboard</h1>
      <RevenueCard data={revenue} />
      <Suspense fallback={<OrdersSkeleton />}>
        <RecentOrders />
      </Suspense>
    </div>
  )
}
```

A `<Suspense>` boundary only helps work that happens **inside** it. An `await` in the component that *renders* the boundary happens before the boundary exists, so it delays the shell, the fallback, and every sibling. The fix is to move the await into a component of its own and wrap that:

```tsx
// ✅ Nothing in the page function awaits. The h1 and both skeletons ship in
// the first chunk; each card streams in when its own data resolves.
import { Suspense } from 'react'

export default function Dashboard() {
  return (
    <div>
      <h1>Dashboard</h1>
      <Suspense fallback={<RevenueSkeleton />}>
        <RevenueCard />
      </Suspense>
      <Suspense fallback={<OrdersSkeleton />}>
        <RecentOrders />
      </Suspense>
    </div>
  )
}
```

```tsx
// app/dashboard/revenue-card.tsx — the await moved down, inside the boundary
export async function RevenueCard() {
  const revenue = await getRevenue()
  return <Card title="Revenue" value={revenue.total} />
}
```

The general rule, and it is the summary the docs themselves give: the trigger is your code — async work, non-deterministic output, or runtime data — and when the framework meets it, it walks **up** the tree looking for a boundary. Everything above the boundary it finds is the shell. So the position of your `await` relative to your `<Suspense>` is the entire design.

## What actually activates a boundary

Data is not the only reason a boundary shows its fallback, and this catches people who reason purely about fetches.

- **Async work inside the boundary** — the case you designed for.
- **A large boundary.** React may hold back a boundary because sending its HTML itself takes time; the Next.js docs call this out explicitly as a reason a boundary can delay an LCP element even when the data was instant.
- **Concurrent rendering pressure.** The docs are blunt about it: as a rule of thumb, if there is a boundary, React might use it — under a slow network or a busy CPU it can fall back even when you did not expect it.

The practical instruction that follows is *"do not add a boundary you do not need"*. A boundary is not free decoration; it is permission for React to show a fallback there.

React adds one caveat from its own side that only bites on the client: a boundary that has already shown content and then suspends **again** shows the fallback again, unless the update was wrapped in `startTransition` or `useDeferredValue`. On the initial server stream this does not arise, because the boundary never showed content before it suspended.

## Gotchas

**★ Symptom: you wrapped the slow component in `<Suspense>` and the page still takes the full time to show anything, and the skeleton never appears.** Cause: the component that renders the boundary awaits something itself, so it blocks before the boundary is emitted. A boundary only covers work inside it. Fix: make the boundary-rendering component synchronous and move the `await` into the child.

```tsx
export default function Page() {                 // no async, no await
  return (
    <Suspense fallback={<Skeleton />}>
      <SlowSection />                            {/* the await lives in here */}
    </Suspense>
  )
}
```

**★ Symptom: a component was made `async` and it is a Client Component, and the build or runtime rejects it.** Cause: only Server Components may be `async`; a Client Component re-renders, so an async return has no coherent semantics. Fix: keep the fetch on the server and hand the Client Component a promise it reads with `use()`, with a boundary above it.

```tsx
// server
const dataPromise = getData()
return (
  <Suspense fallback={<Skeleton />}>
    <ClientChart dataPromise={dataPromise} />
  </Suspense>
)
```

**★ Symptom: streaming works locally and the production page arrives all at once.** Cause: something between the server and the browser buffers the response. Nginx buffers by default; CDNs may buffer whole responses; AWS Lambda needs response streaming mode explicitly enabled; gzip and Brotli buffer internally before flushing. Fix: start with the reverse proxy — the documented header is `X-Accel-Buffering: no`. The full checklist is [02c](02c-streaming-after-the-shell-status-codes-errors-and-infrastructure.md).

**★ Symptom: a page has boundaries everywhere and feels worse, with content flashing in piecemeal.** Cause: every boundary is permission for React to show a fallback there, and it may use one under CPU or network pressure even when the data was ready. Fix: remove boundaries that do not correspond to a genuinely slower section, and never put one around an LCP element — keep that in the shell.

**Symptom: the fallback flashes for a few milliseconds and looks like a bug.** Cause: it is not one — a boundary streams as soon as its content is ready, and React reveals suspended content at most once every 300ms, measured from the last reveal, so several near-simultaneous boundaries appear in a small cascade. Fix: design fallbacks that are visually close to the resolved content so the swap is not a jolt, and match their dimensions to avoid layout shift.

**Symptom: an in-app navigation behaves differently from a hard reload of the same URL.** Cause: they are different transports. A hard load streams HTML with inline swap scripts; a client navigation fetches only the component payload with an `rsc: 1` header and updates the tree in place. Fix: reproduce the bug on the path it actually occurs on, and remember that `loading.js` fallbacks are prefetched for navigation but not for a cold load.

**Symptom: a tiny demo page does not stream even though everything is configured correctly.** Cause: client-side buffering. WebKit buffers a streaming response until 1024 bytes have arrived, so a minimal page paints all at once. Fix: nothing — real pages with layouts, styles and scripts exceed the threshold immediately. Do not restructure an application because a hello-world did not stream.

**Symptom: `<Suspense>` was added to make a component "dynamic" and the component still renders at build time.** Cause: a boundary does not opt anything into dynamic rendering; it declares where a fallback may go. A synchronous component completes during prerendering whether or not it is wrapped. Fix: the thing that makes work request-time is the work itself — a Request-time API, an uncached fetch, or `connection()`. See [01g](01g-react-cache-connection-and-non-fetch-memoization.md) and [03](03-static-vs-dynamic-rendering-force-dynamic-force-static-reval.md).

## Interview questions

**★ Why is a Server Component allowed to be `async` when a Client Component is not?**
Because a Server Component renders exactly once and has no state, effects or re-renders, so there is no later render for an awaited result to be inconsistent with — the renderer can simply wait and continue. A Client Component re-renders, and an async component that re-rendered would produce a second pending promise with no rule for which result wins, so React does not allow it. Client Components read promises with `use()` instead, which suspends in a way React can restart and replay.

**★ What does a `<Suspense>` boundary actually change about the HTTP response?**
It creates a seam in the HTML stream. React's server renderer emits chunks aligned to boundaries: the static shell — layouts, navigation and every boundary's fallback — is flushed immediately, and then each boundary's real HTML arrives later with two inline scripts, one to swap the fallback DOM node for the real content and one carrying the component payload for hydration. Two things follow. The browser paints and swaps content before the page's JavaScript has loaded, and the response has already committed to its headers and status code, so nothing after the first chunk can change them.

**★ Someone wraps their slow component in `<Suspense>` and nothing improves. What do you look at first?**
Whether the component that renders the boundary awaits anything itself. A boundary only covers work inside it, so `const x = await slow()` on the first line of the page function blocks the shell, the fallback and every sibling before the boundary is ever emitted. The framework walks *up* from the async work to the nearest boundary, so what matters is the position of the `await` relative to the boundary, not its position on the page. The fix is to make the boundary-rendering component synchronous and push the await into a child.

**★ Why does streaming help INP and not just perceived load time?**
Because each `<Suspense>` boundary is a hydration unit. Without boundaries React hydrates the entire page in one blocking pass — a single long main-thread task. With them, hydration splits into smaller tasks that yield to the browser, and React prioritises hydrating whatever the user is interacting with. That is a real interactivity win independent of how fast the data was.

**A boundary shows its fallback even though the data inside it was already cached. Is that a bug?**
No. Data is one of several reasons React activates a boundary. It may hold back a large boundary because sending its HTML takes time, and under a slow network or a busy CPU concurrent rendering can fall back to a boundary that was not expected to be used. The docs state the rule of thumb directly — if there is a boundary, React might use it — which is also the argument against adding boundaries you do not need, and the argument for keeping an LCP element outside them.

**What is the component payload, and why does client navigation behave differently from a cold load?**
The component payload is a serialized representation of the component tree that React uses to hydrate and to apply client-side updates. On a cold load it is embedded in the HTML stream alongside the markup. On an in-app navigation, only the payload is fetched — with an `rsc: 1` header — and no HTML crosses the wire at all; React updates the existing tree in place. So the same route can behave differently on the two paths, and a bug reproduced on one is not automatically reproducible on the other.

**Does wrapping a component in `<Suspense>` make it dynamic?**
No, and this is a common inversion. A boundary declares where a fallback is allowed to be rendered; it does not change when the component's work happens. A synchronous component still completes during prerendering whether or not it is wrapped. What makes work request-time is the work: a Request-time API such as `cookies()` or `headers()`, an uncached fetch, or an explicit `connection()`. The boundary is what lets the rest of the route prerender *despite* that work existing.

**Why does the swap happen before the page's JavaScript bundle has loaded?**
Because the swap is not React's job at that point — it is a small inline `<script>` that React streams next to the boundary's HTML, and the browser runs it the moment it parses it. Hydration comes later and separately, driven by the component payload. This is what makes streamed content visible on a slow connection long before the page is interactive, and it is also why a boundary costs something on the client even when its data was instant: the content only appears once that script has run.

---

← [01i · co-location and preloading](01i-co-location-preloading-and-where-the-fetch-call-belongs.md) · Next → [02b · where to put boundaries](02b-where-to-put-boundaries-loading-js-and-granular-streaming.md)
