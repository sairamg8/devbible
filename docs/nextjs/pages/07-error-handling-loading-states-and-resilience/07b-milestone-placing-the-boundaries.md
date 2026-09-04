---
title: "The failure map decides the tree: each row names the smallest scope that should survive, and that scope is what tells you whether you need a file, a component, or nothing at all"
sidebar_label: "07b · Milestone: placing the boundaries"
sidebar_position: 22
description: "Chapter 7's capstone, step two: the SprintDesk boundary tree with a reason for every file, why three failure-map rows deliberately get no error.tsx, degrading in the component instead of throwing, and an acceptance checklist you can run by reading the tree."
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-09-04 against the Next.js
> [Error Handling guide](https://nextjs.org/docs/app/getting-started/error-handling)
> (`version: 16.3.4`, `lastUpdated: 2026-06-10`) and the
> [`error.js` reference](https://nextjs.org/docs/app/api-reference/file-conventions/error)
> (`lastUpdated: 2026-07-10`). Target: **Next.js 16.3.4**, App Router.
> Documentation-validated; **no sandbox run** — 🔴 **no failure-injection runs or error rates
> appear on this page.** Every criterion below is checkable by reading your own tree.

**Placement is mechanical once the map exists, and arbitrary before it.** Each row of
[07](07-project-milestone-sprintdesk-gets-full-error-boundary-covera.md)'s failure map names a
blast radius; this step turns each of those into the smallest thing that produces it. Three
outcomes are possible per row and all three appear here: a segment file, a component-level
boundary, or nothing at all because the component can render something sensible instead of
throwing. The last is the one teams skip, and it is the reason a card with malformed markdown can
take out the column it lives in.


## Act 1, step 2 — place the boundaries

The map decides the tree. Every boundary below exists because a row asked for it:

```
app/
  error.tsx                      ← row 1 only as a last resort: the app shell survives
  global-error.tsx               ← the root layout itself threw. Own <html>/<body>.
  (dashboard)/
    layout.tsx                   ← nav + team switcher. NO data access. See 05b.
    error.tsx                    ← row 1: the dashboard area fails, nav stays alive
    boards/
      [boardId]/
        not-found.tsx            ← row 7
        forbidden.tsx            ← row 8
        unauthorized.tsx         ← row 9
        page.tsx
        column-error.tsx         ← row 2: a catchError boundary, used per column
        card-body.tsx            ← row 3: degrades in the component, no boundary
```

Two things in that tree are deliberate and easy to get wrong.

**`app/error.tsx` is not where row 1 lands.** A boundary at the root replaces everything below
the root layout. The dashboard group's own `error.tsx` is the one that keeps the nav and team
switcher mounted while the board area shows the failure — which is exactly the correction the
chapter's scenario describes.

**Rows 2, 3 and 4 do not get files.** `error.tsx` is per segment, and all three failures are
inside one segment. Row 2 needs a component-level boundary — `catchError`, from
[10](10-custom-error-boundaries-with-catcherror.md) — and rows 3 and 4 need no boundary at all,
because a component that can render something sensible should do that instead of throwing.

```tsx
// app/(dashboard)/boards/[boardId]/column-error.tsx
'use client'

import { catchError, type ErrorInfo } from 'next/error'

function ColumnFallback(props: { name: string }, { error, retry }: ErrorInfo) {
  return (
    <div role="alert" className="min-h-64 rounded border border-dashed p-4">
      <h3>{props.name}</h3>
      <p>This column could not be loaded.</p>
      <button onClick={() => retry()}>Try again</button>
    </div>
  )
}

export default catchError(ColumnFallback)
```

```tsx
// app/(dashboard)/boards/[boardId]/page.tsx
import { Suspense } from 'react'
import ColumnError from './column-error'

export default async function BoardPage({
  params,
}: {
  params: Promise<{ boardId: string }>
}) {
  const { boardId } = await params
  const board = await getBoardForUser(boardId) // row 7/8/9 decided here — see 07b
  if (!board) notFound()

  return (
    <div className="flex gap-4">
      {board.columns.map((column) => (
        <ColumnError key={column.id} name={column.name}>
          <Suspense fallback={<ColumnSkeleton name={column.name} />}>
            <Column id={column.id} />
          </Suspense>
        </ColumnError>
      ))}
    </div>
  )
}
```

🔴 **The `min-h-64` on the fallback is not decoration.** It matches the column skeleton and the
loaded column, so a failing column does not shift the three healthy ones sideways — the CLS rule
from [05c](05c-skeletons-layout-shift-and-the-cost-of-a-boundary.md), applied to an *error* state
rather than a loading one, which is the case teams forget.

## Act 1, step 3 — degrade the two rows that should never throw

```tsx
// app/(dashboard)/boards/[boardId]/card-body.tsx — row 3
import { reportError } from '@/lib/observability'

export function CardBody({ markdown }: { markdown: string }) {
  try {
    return <div dangerouslySetInnerHTML={{ __html: renderMarkdown(markdown) }} />
  } catch (cause) {
    reportError(cause, { surface: 'card-body' }) // degraded, but still an incident
    return <pre className="whitespace-pre-wrap">{markdown}</pre>
  }
}
```

```tsx
// app/(dashboard)/activity-feed.tsx — row 4
import { reportError } from '@/lib/observability'

export async function ActivityFeed({ teamId }: { teamId: string }) {
  const events = await getActivity(teamId).catch((cause) => {
    reportError(cause, { surface: 'activity-feed', teamId })
    return null
  })

  if (!events?.length) return null // the panel simply is not there
  return <Feed events={events} />
}
```

⚠️ **Both catches report.** A degradation that is not reported is an outage you have decided not
to hear about — the failure mode named in
[06](06-retry-fallback-and-graceful-degradation-patterns.md).

## Act 1 acceptance checklist

Each of these is checkable by reading the tree. None requires breaking anything.

- [ ] Every row of the failure map names a **file or a component** that handles it, or is
      explicitly marked as needing none.
- [ ] `app/error.tsx` is **not** the boundary for a data failure inside the dashboard — the
      dashboard group has its own.
- [ ] `global-error.tsx` exists and defines its own `<html>` and `<body>` tags.
- [ ] The `(dashboard)` layout performs **no** uncached data access, so `loading.tsx` can show a
      fallback at all — the trap in
      [05b](05b-the-layout-that-stops-your-skeleton-appearing.md).
- [ ] Every component-level fallback reserves the **same height** as the content it replaces.
- [ ] Every deliberate `catch` that degrades also calls the reporting function.
- [ ] No `try`/`catch` in the tree wraps a `notFound()`, `redirect()`, `forbidden()` or
      `unauthorized()` call — [01d](01d-control-flow-throws-and-what-a-catch-swallows.md).
- [ ] Every boundary is a Client Component; the framework requires it and the build will tell
      you, but the review should catch it first.

## Gotchas

### A boundary at the root of the app group
**Symptom.** A database outage removes the navigation, so the user cannot even leave the broken
page.
**Cause.** `app/error.tsx` replaces everything under the root layout.
**Fix.** Put the boundary inside the route group whose content can fail, so the chrome above it
stays mounted and interactive.

### A column fallback that shifts the board
**Symptom.** One column fails and the other three jump.
**Cause.** The error UI is shorter than a loaded column, so the flex row reflows.
**Fix.** Size error states as carefully as loading states. The reserved height belongs on the
container, so it applies to skeleton, content and error alike.

### The markdown renderer throwing into the column boundary
**Symptom.** One malformed bug report takes out the entire column it is in.
**Cause.** `CardBody` threw, and the nearest boundary is the column's.
**Fix.** Degrade in place. A card body that cannot be rendered as markdown can still be rendered
as text, and that is a rung 2 decision made at the component rather than a rung 3 escalation made
by default.

## Interview questions

**★ Why is `app/error.tsx` the wrong home for a database failure on the dashboard?**
Because it replaces everything below the root layout, including the navigation the user needs in
order to go somewhere that works. A boundary inside the dashboard route group leaves the chrome
mounted and interactive and confines the failure to the area that actually depends on the data.

**★ Why does the acceptance checklist include "the dashboard layout performs no uncached data
access"?**
Because `loading.js` does not show a fallback for the layout in its own segment. A layout that
awaits `cookies()` or an uncached fetch blocks navigation entirely — with no error and no warning
— so the skeleton work in act three would be wasted before it started.

**★ Why should the error state reserve the same height as the loaded content?**
For the same reason a skeleton should: replacing a differently-sized element reflows the page.
Teams size skeletons carefully and then render a two-line error message where a 400-pixel column
used to be, so the failure path is the one that ships the layout shift.

**★ Why does `global-error.tsx` need its own `<html>` and `<body>` tags?**
Because it replaces the root layout or template when it is active, so nothing above it is
rendering the document any more. The consequence people meet later is broader than the tags: it
renders its own document and does not inherit your global styles or fonts, which is covered in
[10d](10d-global-error-and-what-it-does-not-inherit.md).

**★ You have four columns in a flex row and one fails. What does a correct fallback look like?**
Same width, same reserved height, an accessible alert role, and a recovery affordance scoped to
that column. The size constraints matter because the other three columns must not move; the
`role="alert"` matters because the failure otherwise happens silently for a screen reader user;
and the recovery has to be `retry()` rather than `reset()`, or pressing it re-renders the same
failed data.

**★ How do you decide between a `catchError` boundary and simply handling the failure in the
component?**
By whether the component can still produce something worth rendering. If it can — raw text
instead of parsed markdown, a cached count instead of a live one — handle it in place, because a
boundary replaces the component and a degraded render keeps it. Reach for the boundary when there
is genuinely nothing sensible to show and the failure needs to be announced with a recovery
path.
---

← [07 · Milestone: boundary coverage](07-project-milestone-sprintdesk-gets-full-error-boundary-covera.md) · **Next → [07c · The action and form error contracts](07c-milestone-the-action-and-form-error-contracts.md)**
