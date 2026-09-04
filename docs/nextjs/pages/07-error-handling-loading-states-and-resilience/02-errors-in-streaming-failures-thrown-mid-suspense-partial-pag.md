---
title: "Once the first chunk is on the wire the status code is spent, so a failure mid-stream is a hole in the page rather than an error response"
sidebar_label: "02 · Errors in streaming"
sidebar_position: 2
description: "What actually happens when an async Server Component throws after streaming has started: the nearest boundary swaps in place, the rest of the document survives, and 200 OK is already committed and cannot be taken back."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-04 against the Next.js
> [Streaming guide](https://nextjs.org/docs/app/guides/streaming) (page metadata
> `version: 16.3.4`, `lastUpdated: 2026-08-25`) — its "Error handling mid-stream" and
> "The HTTP contract" sections are quoted verbatim below — and the
> [`loading.js` reference](https://nextjs.org/docs/app/api-reference/file-conventions/loading)
> (`lastUpdated: 2026-06-08`) for the status-code behaviour.
> Target: **Next.js 16.3.4**, App Router. Documentation-validated; **no sandbox run**.

**Streaming changes what an error *is*.** In a blocking render the server has the whole document
before it sends anything, so a failure can still become a 500 with an error page. In a streaming
render the shell has already left the building: the status line, the headers and the first chunk
of HTML are in the browser, the user is looking at a rendered layout, and only then does the
revenue widget's database call fail. There is no status code left to change and no document left
to replace. What the framework does instead is surgical — it swaps the failed boundary's
fallback for the nearest `error.js`, leaves everything else exactly as it is, and the response
that carries all of this is still, unavoidably, `200 OK`. Almost every surprising behaviour in
this part of the chapter is a consequence of that one fact.

## What the documentation actually says

> *"If a component throws an error after streaming has started, the nearest `error.js` boundary
> catches it and renders the error UI in place of the failed component. The rest of the page
> remains intact, only the section that errored is replaced."*

And the constraint underneath it:

> *"Because the HTTP status code (`200 OK`) has already been sent with the first chunk, it
> cannot be changed to a `4xx` or `5xx`."*

Stated as a general rule in the guide's own words: **"You cannot change the status code or
headers after streaming starts."**

## Why boundaries are independent, and what that buys you

> *"Each `<Suspense>` boundary is an independent streaming point. Components inside different
> boundaries resolve and stream in independently. They don't block each other."*

That independence is exactly what makes partial failure possible. Three sibling boundaries mean
three separately resolvable slots; one of them throwing does not disturb the other two, because
React has already emitted their HTML or will emit it when their own promises settle.

```tsx
// app/dashboard/page.tsx
import { Suspense } from 'react'
import { Revenue } from './revenue'
import { RecentOrders } from './recent-orders'
import { Recommendations } from './recommendations'

export default function Dashboard() {
  return (
    <div>
      <h1>Dashboard</h1>
      <div className="grid grid-cols-2 gap-4">
        <Suspense fallback={<RevenueSkeleton />}>
          <Revenue />
        </Suspense>
        <Suspense fallback={<OrdersSkeleton />}>
          <RecentOrders />
        </Suspense>
      </div>
      <Suspense fallback={<RecommendationsSkeleton />}>
        <Recommendations />
      </Suspense>
    </div>
  )
}
```

If `Recommendations` throws, the `<h1>`, the revenue panel and the orders panel are already
painted and stay painted. The recommendations slot is replaced by whatever the nearest `error.js`
renders. If instead there were one boundary around all three, one failure would take all three
with it — the blast radius of a throw is exactly the subtree of the boundary that catches it.

🔴 **A boundary is therefore two decisions at once: a loading decision and a failure decision.**
People place `<Suspense>` thinking only about what should show a skeleton, and inherit a failure
granularity they never chose. Ask both questions in the same breath: *what should this show
while it loads*, and *what should still be on screen if it never loads at all*.

## Co-locating `error.js` with the boundary

An `error.js` catches for its whole segment subtree. If a page has three independently streaming
widgets and one segment-level `error.tsx`, all three failures produce the same full-segment error
UI — the streaming was granular and the recovery was not.

For per-widget recovery, the boundary has to be a component, not a file. That is what `catchError`
is for, and it is covered in
[10 · Custom error boundaries with `catchError`](10-custom-error-boundaries-with-catcherror.md);
the placement rules that decide which file catches what are in
[10c · Where boundaries sit in the hierarchy](10c-where-boundaries-sit-in-the-hierarchy.md).

```tsx
// app/dashboard/page.tsx — recovery granularity matched to streaming granularity
import { Suspense } from 'react'
import WidgetError from './widget-error' // built with catchError

export default function Dashboard() {
  return (
    <div>
      <h1>Dashboard</h1>
      <WidgetError title="Revenue unavailable">
        <Suspense fallback={<RevenueSkeleton />}>
          <Revenue />
        </Suspense>
      </WidgetError>
      <WidgetError title="Orders unavailable">
        <Suspense fallback={<OrdersSkeleton />}>
          <RecentOrders />
        </Suspense>
      </WidgetError>
    </div>
  )
}
```

## The monitoring consequence nobody plans for

Your uptime check requests the page and gets `200 OK`. Your load balancer's health check gets
`200 OK`. Your CDN caches — if you let it — a `200 OK`. And the page contains an error panel
where the revenue was. **Every HTTP-status-based signal you own is blind to a mid-stream
failure**, because by the time the failure happened the status had been sent.

This is not a bug to work around; it is the cost of streaming, and the fix is to stop treating
status as the health signal for streamed routes:

- **Report from the boundary.** `error.tsx` runs on the client; a `useEffect` that ships the
  error and its `digest` to your reporting service is the only thing that sees the failure at
  all. The props that carry it are covered in
  [09 · `error.js` props](09-errorjs-props-retry-and-reset.md).
- **Instrument the server side too.** A throw inside an async Server Component is a server event
  before it is a client one; capture it where it happens, not only where it renders.
- **Alert on rendered error UI, not on 5xx.** For a streamed route the meaningful metric is "how
  many responses contained a fallback error panel", and nothing gives you that for free.

## Gotchas

### The health check is green while the dashboard is broken
**Symptom.** Monitoring reports 100% availability for a page that has been rendering "Something
went wrong" in its main panel for an hour.
**Cause.** The failure happened after the first chunk, so the response is a `200` containing an
error UI. Status-based monitoring cannot see it.
**Fix.** Report from the boundary itself, and treat that as the signal.

```tsx
// app/dashboard/error.tsx
'use client'

import { useEffect } from 'react'
import { reportError } from '@/lib/observability'

export default function DashboardError({
  error,
  retry,
}: {
  error: Error & { digest?: string }
  retry: () => void
}) {
  useEffect(() => {
    reportError(error, { digest: error.digest, surface: 'dashboard' })
  }, [error])

  return (
    <section role="alert">
      <h2>We could not load your dashboard</h2>
      <button onClick={() => retry()}>Try again</button>
    </section>
  )
}
```

### One slow widget takes down the whole page on failure
**Symptom.** A recommendations panel that nobody would miss brings down the entire dashboard
when its upstream service is unavailable.
**Cause.** The nearest boundary above it is the segment's `error.tsx`, so its subtree — the
whole segment — is what gets replaced.
**Fix.** Give the optional widget its own component-level boundary so the blast radius matches
its importance, as in the `catchError` example above. Streaming granularity without matching
recovery granularity buys nothing.

### Expecting a 500 for a streamed failure in an integration test
**Symptom.** A test asserting `expect(res.status).toBe(500)` fails with `200`, and the team
concludes error handling is broken when it is working exactly as documented.
**Cause.** The status was committed with the first chunk.
**Fix.** Assert on the response body, not the status line.

```ts
// tests/dashboard.spec.ts
const res = await fetch('http://localhost:3000/dashboard')

expect(res.status).toBe(200) // streamed responses always are
const html = await res.text()
expect(html).toContain('We could not load your dashboard')
```

### A `try`/`catch` around the awaited fetch, so the boundary never fires
**Symptom.** A widget renders empty rather than showing its error UI, and nothing is reported.
**Cause.** The component caught its own failure and returned normal markup, so no error ever
reached a boundary. The page looks fine and is silently wrong — worse than a visible error.
**Fix.** Let genuine failures throw; catch only to add context.

```tsx
// app/dashboard/revenue.tsx
export async function Revenue() {
  let rows: RevenueRow[]
  try {
    rows = await db.revenue.byMonth()
  } catch (cause) {
    // add context, then let the boundary do its job
    throw new Error('Revenue query failed', { cause })
  }

  return <RevenueChart rows={rows} />
}
```

### Assuming an error in one boundary cancels the others
**Symptom.** A design that relies on "if anything fails, show one error for the page" produces
three separate error panels instead.
**Cause.** Boundaries are independent streaming points; there is no cross-boundary cancellation.
Each failing slot resolves to its own nearest boundary.
**Fix.** If a single failure genuinely should replace the page, that is an argument for **one**
boundary above all of them, not for co-ordinating three. Choose the shape deliberately.

### Setting a header in a component after streaming has begun
**Symptom.** A `Cache-Control` or custom header set from deep in the render never appears on the
response.
**Cause.** Headers go out with the status line, in the first chunk. *"You cannot change the
status code or headers after streaming starts."*
**Fix.** Set headers where they are still settable — `next.config.js`, `proxy`, or a Route
Handler — not from a component that renders inside a boundary.

## Interview questions

**★ A Server Component inside a Suspense boundary throws two seconds into the response. What
does the user see, and what status code did the request return?**
The nearest `error.js` boundary renders in place of that component, and the rest of the page —
shell, layout, sibling boundaries — remains exactly as it was. The status is `200 OK`, and it was
already `200 OK` before the failure happened, because the status line went out with the first
chunk and cannot be revised.

**★ Why can't Next.js return a 500 for a mid-stream failure?**
HTTP does not allow it. The status line and headers precede the body; once the body has started
streaming they have been sent. The Streaming guide states the constraint plainly and derives the
rest of its behaviour from it: *"You cannot change the status code or headers after streaming
starts."*

**★ How does the blast radius of a thrown error get decided?**
By which boundary catches it — the error replaces that boundary's subtree and nothing else. A
single `error.tsx` at the segment root means any failure blanks the segment; a component-level
boundary around one widget means a failure blanks that widget. It is a placement decision, and
it is independent of how granular your Suspense boundaries are.

**★ You have three sibling Suspense boundaries and one `error.tsx` for the segment. What is the
recovery granularity?**
One. All three failures render the same segment-level error UI and take the whole segment's
subtree with them. Streaming granularity and recovery granularity are separate choices, and
matching them requires component-level boundaries — `catchError` — rather than more files.

**★ Your uptime monitor shows 100% availability for a route that has been visibly broken for an
hour. Explain.**
Mid-stream failures are delivered inside a `200 OK`. Every status-based signal — uptime checks,
load-balancer health probes, CDN caching decisions, 5xx dashboards — is blind to them by
construction. The only thing that observes the failure is the boundary that rendered, so the
reporting call has to live there.

**★ Is catching the error inside the component a reasonable alternative to a boundary?**
Only if you can render something genuinely useful without the data. A `catch` that returns empty
markup converts a visible failure into an invisible one: the user sees a blank panel, the
boundary never fires, and nothing is reported. If you catch, catch to add context and rethrow,
or to render an explicit degraded state — never to make the error disappear.

**★ Does an error in one Suspense boundary abort the others?**
No. They are independent streaming points and resolve independently, so a failure in one does
not cancel or affect the others. Three failures produce three error UIs.

---

← [01e · `unstable_rethrow`](01e-unstable-rethrow-and-its-exact-contract.md) · **Next → [02b · `notFound()` and `redirect()` after the first chunk](02b-notfound-and-redirect-after-the-first-chunk.md)**
