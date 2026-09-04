---
title: "The last step is the one that decides whether any of the previous ones were worth doing: if a mid-stream failure returns 200, the only thing that ever sees it is the boundary you wired to report"
sidebar_label: "07e · Milestone: making failures visible"
sidebar_position: 133
description: "Chapter 7's capstone, final step: sizing SprintDesk's skeletons so loading, loaded and error states occupy the same space, deciding against a board-level loading.tsx, and reporting from the boundaries because no status code will ever tell you the board is broken."
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-09-04 against the Next.js
> [Streaming guide](https://nextjs.org/docs/app/guides/streaming)
> (`version: 16.3.4`, `lastUpdated: 2026-08-25`) — its Web Vitals and HTTP-contract sections —
> the [`loading.js` reference](https://nextjs.org/docs/app/api-reference/file-conventions/loading)
> (`lastUpdated: 2026-06-08`) and the
> [`error.js` reference](https://nextjs.org/docs/app/api-reference/file-conventions/error)
> (`lastUpdated: 2026-07-10`) for `digest`. Target: **Next.js 16.3.4**, App Router.
> Documentation-validated; **no sandbox run** — 🔴 **no error rates, timings or Web Vitals
> figures appear on this page.**

**SprintDesk's board streams, so every failure inside it arrives with a `200 OK` that was sent
before the failure happened.** Uptime checks pass. The load balancer is satisfied. The 5xx
dashboard is empty. Meanwhile a column has been showing "This column could not be loaded" to every
member of a team since the morning. That is not a monitoring gap to be patched later — it is a
structural property of streaming, established in
[02](02-errors-in-streaming-failures-thrown-mid-suspense-partial-pag.md), and the boundaries
placed in [07b](07b-milestone-placing-the-boundaries.md) are the only components in the system
that observe it. This step wires them, and sizes the three states a slot can be in so that moving
between them does not move the page.

## Three states, one size

A column is a skeleton, then content, then possibly an error. All three occupy the same slot, and
any difference between them is a layout shift the user experiences as the page jumping.

```tsx
// app/(dashboard)/boards/[boardId]/column-shell.tsx
// One container owns the size. Skeleton, content and error all render inside it.
export function ColumnShell({
  name,
  children,
}: {
  name: string
  children: React.ReactNode
}) {
  return (
    <section className="flex min-h-96 w-72 shrink-0 flex-col rounded-lg bg-slate-50 p-3">
      <h3 className="mb-2 text-sm font-medium">{name}</h3>
      {children}
    </section>
  )
}
```

```tsx
// app/(dashboard)/boards/[boardId]/column-skeleton.tsx
export function ColumnSkeleton({ name }: { name: string }) {
  return (
    <ColumnShell name={name}>
      <div aria-busy="true" aria-live="polite" className="space-y-2">
        <span className="sr-only">Loading {name}</span>
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="h-16 animate-pulse rounded bg-slate-200" />
        ))}
      </div>
    </ColumnShell>
  )
}
```

🔴 **The container carries `min-h-96`, not the skeleton.** That is what makes the guarantee hold
for all three states rather than only the one you remembered to size — the rule from
[05c](05c-skeletons-layout-shift-and-the-cost-of-a-boundary.md), and the error state is the one
teams forget.

⚠️ **Four skeleton cards is a guess about the common case, not a neutral choice.** A board whose
columns typically hold a dozen cards shifts on every load with four; the `min-h` on the container
is what bounds that, and it should be set from what the columns actually contain.

## No `loading.tsx` on the board

The board route deliberately does not get one, and the reasons are all from
[05](05-loadingtsx-vs-inline-suspense-skeleton-strategy-and-layout-s.md):

- **The board has meaningful partial states.** Column headers, the filter bar and the board title
  render without any card data. A `loading.tsx` would replace all of that with one skeleton.
- **It would become the nearest boundary for everything.** Anything dynamic below it with no
  boundary of its own would resolve to the page-level fallback, collapsing the per-column
  streaming that [07b](07b-milestone-placing-the-boundaries.md) built.
- **It would commit the response before the board's existence check.** Rendering a Suspense
  fallback is what starts the stream, so `notFound()` for a missing board id would stop being a
  real 404 — [02b](02b-notfound-and-redirect-after-the-first-chunk.md).

The dashboard *shell* is a different question: a `loading.tsx` at the `(dashboard)` level is
reasonable, because navigating between boards has nothing meaningful to show until the new board
resolves, and it buys prefetched instant navigation. Its condition is that the `(dashboard)`
layout does no uncached data access — the check already on
[07b](07b-milestone-placing-the-boundaries.md)'s list, for the reason in
[05b](05b-the-layout-that-stops-your-skeleton-appearing.md).

## Reporting, because nothing else will

Every boundary placed in this milestone reports. That is not defensive coding; it is the only
instrumentation that sees a streamed failure at all.

```tsx
// lib/observability.ts
type Context = { surface: string; digest?: string } & Record<string, unknown>

export function reportError(cause: unknown, context: Context): void {
  // one function, so every surface reports the same shape and nothing is missed in review
  const error = cause instanceof Error ? cause : new Error(String(cause))
  send({
    name: error.name,
    message: error.message,
    stack: error.stack,
    ...context,
  })
}
```

```tsx
// app/(dashboard)/boards/[boardId]/column-error.tsx
'use client'

import { useEffect } from 'react'
import { catchError, type ErrorInfo } from 'next/error'
import { reportError } from '@/lib/observability'
import { ColumnShell } from './column-shell'

function ColumnFallback(props: { name: string }, { error, retry }: ErrorInfo) {
  useEffect(() => {
    reportError(error, { surface: 'board.column', column: props.name })
  }, [error, props.name])

  return (
    <ColumnShell name={props.name}>
      <div role="alert">
        <p>This column could not be loaded.</p>
        <button onClick={() => retry()}>Try again</button>
      </div>
    </ColumnShell>
  )
}

export default catchError(ColumnFallback)
```

The four places that must report, and what each one uniquely knows:

| Surface | Reports | Knows what nothing else does |
|---|---|---|
| `(dashboard)/error.tsx` | segment failures, with `digest` | that the whole dashboard area is down |
| `column-error.tsx` | per-column failures | *which* column |
| `card-body.tsx` `catch` | markdown parse failures | that a specific card's content is malformed |
| `activity-feed` `catch` | an omitted panel | that a feature is invisibly absent |

🔴 **The last two are the ones that get dropped**, because they are deliberate degradations and
degrading feels like handling. A `catch` that returns a fallback and does not report is a decision
never to find out — the exact failure named in
[06](06-retry-fallback-and-graceful-degradation-patterns.md).

## What to alert on

Not 5xx. For a streamed route the meaningful signal is **how many responses contained a rendered
error state**, which only exists because the boundaries report it. Three alerts are enough:

- **Rate of `board.column` reports** — a column-level dependency degrading.
- **Rate of `dashboard` segment reports** — the board area is down for real.
- **Rate of `staleBuild` reports outside a deploy window** — an unstable action-ID situation
  rather than a normal rotation, from
  [03d](03d-action-ids-rotate-and-what-that-does-to-an-open-tab.md).

## Milestone acceptance checklist

- [ ] Skeleton, content and error states for a column occupy the **same** reserved space.
- [ ] Every skeleton has an accessible name and a busy state; every error state has
      `role="alert"`.
- [ ] There is no `loading.tsx` on the board route, and the reason is written down.
- [ ] Any `loading.tsx` that does exist sits above a layout that performs no uncached data
      access.
- [ ] Every boundary and every deliberate degradation calls the single reporting function.
- [ ] `error.digest` is surfaced to the user wherever a support conversation could follow.
- [ ] Alerting is defined on reported error rates, not on HTTP status.
- [ ] The failure map from [07](07-project-milestone-sprintdesk-gets-full-error-boundary-covera.md)
      is committed to the repository, so the next person inherits the decisions rather than
      re-deriving them.

## Gotchas

### Monitoring that has never seen the board break
**Symptom.** Availability graphs are flat at 100% through an incident users reported by email.
**Cause.** The failure happened after the first chunk, so the response was a `200` containing an
error UI.
**Fix.** Alert on boundary reports. There is no configuration of a status-based check that can
detect this, so adding more of them does not help.

### An error state that resizes the board
**Symptom.** A failing column becomes two lines tall and the remaining three shuffle sideways.
**Cause.** The size was put on the skeleton rather than on the container the three states share.
**Fix.** `ColumnShell` above — one container, one reserved size, three possible children.

### A `loading.tsx` added to the board "for consistency"
**Symptom.** Per-column streaming disappears and the whole board becomes one skeleton; separately,
the 404 for a deleted board becomes a 200.
**Cause.** The file is a Suspense boundary at page level, so it becomes the nearest boundary for
everything below it and commits the response before the existence check.
**Fix.** Do not add it, and record why — a decision with no note attached is one somebody will
undo.

### Reporting from the boundary only
**Symptom.** A dashboard of client-reported errors that is missing every failure a bot or a
non-JavaScript client experienced, and every failure in a deliberate degradation.
**Cause.** `error.tsx` runs on the client. A throw in an async Server Component is a server event
first.
**Fix.** Report at both ends — capture where the error is thrown as well as where it renders — and
make sure the two can be correlated by `digest`.

### A digest that the user never sees
**Symptom.** Support asks for a reference and the user has only the words "Something went wrong".
**Cause.** The boundary rendered a generic message and kept the digest for the log.
**Fix.** Show it. In production a Server Component's message is replaced by a generic string
before it reaches the client, so the digest is the only thing tying the two ends together.

### Alert thresholds set on a metric that did not previously exist
**Symptom.** Either constant paging or total silence in the first week.
**Cause.** Boundary reports are a new signal with no baseline, and a threshold guessed against
5xx rates does not transfer.
**Fix.** Ship the reporting first and observe it before defining thresholds. A metric with no
history cannot have a meaningful threshold on day one, and saying so is better than picking a
number that will be ignored.

## Interview questions

**★ Why is this step last, and what would go wrong if it were first?**
Because it instruments the boundaries, and until the placement is settled you would be
instrumenting components that are about to move. Reporting wired to a boundary that later gets
split into three tells you a segment failed when you now need to know which column did.

**★ Your board is streamed. Which of your existing monitors can detect that it is broken?**
None of the status-based ones. The status line went out with the first chunk, so a mid-stream
failure is delivered inside a `200 OK` — invisible to uptime checks, health probes, CDN rules and
5xx dashboards alike. The boundaries that render the error are the only things in the system that
observe it.

**★ Why does the board deliberately not have a `loading.tsx`?**
Three reasons, and any one of them is sufficient. The board has meaningful partial states that a
page-level skeleton would erase; the file would become the nearest Suspense boundary for
everything below it and collapse the per-column streaming; and rendering its fallback commits the
response, which turns a real 404 for a missing board into a 200.

**★ Where does the reserved size for a column belong, and why not on the skeleton?**
On the container that wraps all three states. Putting it on the skeleton guarantees the loading
state is the right size and says nothing about the error state, which is the one that ships the
layout shift because nobody thinks of it as a visual state at all.

**★ Which reporting calls are the easiest to omit, and why does it matter most that they are
not?**
The ones inside deliberate degradations — the markdown fallback and the omitted activity panel.
They feel handled, because the user sees something reasonable. But they are the failures with no
other symptom at all: a boundary at least renders something a user might mention, while a
degraded path is silent by design and can stay broken indefinitely.

**★ What is the one artefact from this milestone that should outlive the code?**
The failure map. The boundaries can be re-derived from it, but it cannot be re-derived from them —
a tree of `error.tsx` files records what the application does, not what an outage in each
dependency is *supposed* to cost. Committing it is what stops the next person re-litigating every
decision from scratch.

**★ How should alert thresholds be chosen for boundary reports?**
By observing first. It is a new signal with no history, and a threshold carried over from 5xx
rates is measuring something different — those counted requests that never rendered, this counts
requests that rendered a failure. Shipping the reporting, watching a normal week, and then setting
thresholds is slower and is the only version that produces alerts anyone acts on.

---

← [07d · The board's three auth answers](07d-milestone-the-boards-three-auth-answers.md) · **Next → [09 · `error.js` props: `retry` and `reset`](09-errorjs-props-retry-and-reset.md)**
