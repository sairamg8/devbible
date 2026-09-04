---
title: "A boundary does not wrap the layout it sits beside — which is why the most common placement is the wrong one"
sidebar_label: "10c · Where boundaries sit in the hierarchy"
sidebar_position: 12
description: "Where error.js actually sits in the component hierarchy: what it wraps, why a layout's own error escapes the error.tsx next to it, and the two different fixes."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-04 against the Next.js
> [`error.js` file-convention reference](https://nextjs.org/docs/app/api-reference/file-conventions/error)
> (page metadata: version 16.3.4, lastUpdated 2026-07-10) — the component-hierarchy rule
> **quoted verbatim**, no sandbox run.
> Target: **Next.js 16.3.4**, App Router.

**[10b](10b-what-boundaries-do-not-catch.md) covered the errors a boundary misses because of
*when* they are thrown. This page covers the ones it misses because of *where it sits*.**
`error.js` does not wrap the whole segment it lives in — it wraps everything *below* the
layout, and the layout beside it is outside the boundary. So the instinctive placement, an
`error.tsx` dropped next to the `layout.tsx` that does the fetching, catches nothing that
layout throws. The rule is short, it is stated once in the file-convention reference, and
almost every surprising "my error boundary didn't fire" is this rule.

## The rule, verbatim

> *"In the `component hierarchy`, `error.js` wraps `loading.js`, `not-found.js`, `page.js`, and
> nested `layout.js` files in a React error boundary. It does **not** wrap the `layout.js` or
> `template.js` above it in the same segment. To handle errors in the root layout, use
> `global-error.js`."*

Read it as three separate facts, because they are usually collapsed into one wrong one:

1. **It wraps the segment's leaf files** — `page.js`, `loading.js`, `not-found.js`.
2. **It wraps nested `layout.js` files** — the layouts of *child* segments are inside the
   boundary. The common summary "error boundaries don't catch layouts" is wrong; it is one
   specific layout that escapes.
3. **It does not wrap `layout.js` or `template.js` in its own segment** — the two files that
   sit directly beside it, nor anything they do before rendering children.

## Which file catches what

```
app/
├── layout.tsx          ← root layout: only global-error.tsx catches this
├── global-error.tsx    ← the last resort; replaces the root layout when active
├── error.tsx           ← catches app/page.tsx AND dashboard/layout.tsx
├── page.tsx
└── dashboard/
    ├── layout.tsx      ← 🔴 NOT caught by dashboard/error.tsx — it is "above it
    │                        in the same segment". Caught by app/error.tsx
    ├── template.tsx    ← 🔴 same: not caught by dashboard/error.tsx
    ├── error.tsx       ← catches page.tsx, loading.tsx, and settings/layout.tsx
    ├── loading.tsx
    ├── page.tsx
    └── settings/
        ├── layout.tsx  ← a NESTED layout: this one IS caught by dashboard/error.tsx
        └── page.tsx
```

The boundary always catches *downward*. A layout's own failure is the parent's problem, which
is why the answer to "where do I catch this" is always **one segment up**.

## The trap this produces

Layouts are where shared data is fetched — the workspace, the current user, the nav tree. That
makes the layout both the most likely thing to throw and the one thing its own segment's
boundary cannot catch.

```tsx filename="app/dashboard/layout.tsx"
export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const workspace = await getWorkspace()   // throws when the API is down

  return (
    <section>
      <WorkspaceNav workspace={workspace} />
      {children}
    </section>
  )
}
```

```tsx filename="app/dashboard/error.tsx"
'use client'

// This file will NOT render when getWorkspace() above throws.
export default function DashboardError({
  error,
  retry,
}: {
  error: Error & { digest?: string }
  retry: () => void
}) {
  return <button onClick={() => retry()}>Try again</button>
}
```

The error passes `dashboard/error.tsx` untouched and surfaces at `app/error.tsx`, so the user
loses the entire application shell rather than the dashboard panel — the opposite of what the
boundary was placed to achieve.

**Two fixes, and they are different designs, not preferences:**

```tsx filename="app/dashboard/page.tsx"
// FIX 1 — move the fetch below the boundary.
// The layout renders chrome only; the page fetches, so dashboard/error.tsx catches it.
export default async function DashboardPage() {
  const workspace = await getWorkspace()
  return <WorkspacePanels workspace={workspace} />
}
```

```
FIX 2 — accept that a layout failure is a parent-level failure,
and put the boundary where it can actually catch it:

app/
├── error.tsx           ← this is the boundary that catches dashboard/layout.tsx
└── dashboard/
    └── layout.tsx
```

Fix 1 is right when the failure should degrade *part* of the page. Fix 2 is right when the
layout's data is genuinely load-bearing — if the workspace cannot be fetched, there is no
meaningful dashboard to render around the error.

## Gotchas

### An `error.tsx` beside the layout that throws

**Symptom.** A layout's data fetch fails and the segment's own `error.tsx` never renders — the
error surfaces higher up, taking more of the page with it.

**Cause.** `error.js` does not wrap the `layout.js` above it in the same segment.

**Fix.** Move the fetch down into `page.tsx`, or move the boundary up one segment:

```tsx filename="app/dashboard/page.tsx"
export default async function DashboardPage() {
  const workspace = await getWorkspace()   // now inside dashboard/error.tsx
  return <WorkspacePanels workspace={workspace} />
}
```

### Concluding that boundaries never catch layouts

**Symptom.** Boundaries are placed defensively at every level "because layouts are not
covered", producing a fallback that fires for the wrong scope.

**Cause.** Over-reading the rule. **Nested** `layout.js` files *are* wrapped — only the layout
in the boundary's own segment is excluded.

**Fix.** Trust the direction: a boundary catches everything below it, including child segments'
layouts. Place one where you want failure to be contained, not one per segment.

### `template.tsx` forgotten entirely

**Symptom.** A template that re-runs per navigation throws, and the sibling `error.tsx` does
not catch it.

**Cause.** `template.js` is named alongside `layout.js` in the same exclusion.

**Fix.** Same remedy — the parent segment's boundary, or move the failing work below the
template.

### Adding `app/error.tsx` and calling the root covered

**Symptom.** The root layout throws and the brand-new `app/error.tsx` does not render; the
built-in 500 page appears instead.

**Cause.** `app/error.tsx` is in the *same segment* as `app/layout.tsx`, so it is subject to the
same exclusion as every other segment. There is no parent above the root to catch it.

**Fix.** The root layout is `global-error.js`'s job and nothing else's — see
[10d](10d-global-error-and-what-it-does-not-inherit.md).

### Putting the fetch in a layout to "share" it, then wondering why failure is global

**Symptom.** One flaky upstream call takes down every route under the segment.

**Cause.** Data fetched in a layout is outside that segment's boundary by construction, so its
failure is always handled at least one level higher than the code that needed it.

**Fix.** Fetch in the pages that need it — React's request memoization de-duplicates the call
within a render, so sharing via the layout is not the only way to avoid fetching twice:

```tsx filename="app/dashboard/page.tsx"
import { cache } from 'react'

export const getWorkspace = cache(async () => {
  const res = await fetch('https://api.example.com/workspace')
  if (!res.ok) throw new Error('workspace unavailable')
  return res.json()
})
```

## Interview questions

**★ Does a segment's `error.tsx` catch an error thrown by the `layout.tsx` next to it?**
No. `error.js` does not wrap the `layout.js` or `template.js` above it in the same segment. That
error is caught by the **parent** segment's boundary.

**★ Then what does it wrap?**
`loading.js`, `not-found.js`, `page.js`, and **nested** `layout.js` files — everything below it,
including child segments' layouts.

**★ Why is that a practical problem rather than a trivium?**
Layouts are where shared data is fetched, so the layout is both the likeliest thing to throw and
the one file its own segment's boundary cannot catch.

**★ Two ways to fix a layout that throws?**
Move the fetch down into `page.tsx` so the segment's own boundary covers it, or place the
boundary one segment up. The choice is whether the failure should degrade part of the page or
all of it.

**★ What catches an error in the root layout?**
Only `global-error.js`. The root layout has no parent segment, so no `error.tsx` — including
`app/error.tsx` — can wrap it.

**Is a child segment's layout inside or outside the parent's boundary?**
Inside. That is the "nested `layout.js`" clause, and it is the half of the rule people drop.

**Which direction does a boundary catch in?**
Downward only. Everything below it in the tree, nothing beside or above it in its own segment.

---

**Previous:** [10b · What error boundaries do not catch](10b-what-boundaries-do-not-catch.md) · **Next:** [10d · `global-error`, and what it does not inherit](10d-global-error-and-what-it-does-not-inherit.md)
