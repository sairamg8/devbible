---
title: "If the layout awaits runtime data, `loading.js` shows no fallback for it and navigation simply blocks — the skeleton you wrote is correct and never renders"
sidebar_label: "05b · The layout that blocks your skeleton"
sidebar_position: 120
description: "The documented caveat that explains a skeleton that never appears, how Cache Components turns the same mistake into a build-time error instead of a silent stall, and the push-dynamic-access-down pattern that fixes both."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-04 against the Next.js
> [`loading.js` file-convention reference](https://nextjs.org/docs/app/api-reference/file-conventions/loading)
> (page metadata `version: 16.3.4`, `lastUpdated: 2026-06-08`) — its "Good to know" caveat is
> quoted verbatim below — and the
> [Streaming guide](https://nextjs.org/docs/app/guides/streaming) (`lastUpdated: 2026-08-25`),
> whose "Push dynamic access down" section supplies the pattern and its examples.
> Target: **Next.js 16.3.4**, App Router. Documentation-validated; **no sandbox run**.

**This is the single most common "streaming does not work" report, and the code that causes it
looks like good practice.** A layout reads the session so every page below it can render a user
menu. A layout reads a cookie to pick a theme. A layout fetches the workspace so the sidebar can
show its name. Each is a sensible piece of composition, and each one means the layout cannot
render until that data arrives — and `loading.js` does not cover the layout in its own segment.
So navigation stalls on a blank screen with a perfectly good skeleton file sitting unused two
directories away.

## The caveat, verbatim

> **Good to know**: *"If the layout accesses uncached or runtime data (e.g. `cookies()`,
> `headers()`, or uncached fetches), `loading.js` will not show a fallback for it."*
>
> - *"**Without Cache Components:** Navigation blocks until the layout finishes rendering."*
> - *"**With Cache Components:** Uncached or runtime data access in the layout must be explicitly
>   wrapped in `<Suspense>`, otherwise Next.js guides you with a build-time error. The static
>   shell streams first, and the uncached content fills in."*

And the fix the reference itself names:

> *"To ensure instant navigation, move uncached data fetching from `layout.js` into `page.js`, or
> wrap the runtime data access in your layout in its own `<Suspense>` boundary."*

🔴 **The two halves of that caveat describe the same mistake with wildly different diagnostics.**
Without Cache Components it is silent: no error, no warning, just a slow navigation that looks
like a slow server. With Cache Components it is a build-time error that tells you where the
problem is. If you are debugging a skeleton that never appears, checking which mode you are in is
the first useful question.

## Why the exclusion exists at all

It follows from the hierarchy rather than being a special case. `loading.js` sits *inside*
`layout.js` — the layout renders it — so the layout has already had to render before the fallback
exists. A boundary cannot suspend the thing that mounts it. The same asymmetry governs `error.js`,
which wraps nested layouts but not the one beside it; that rule is in
[10c · Where boundaries sit in the hierarchy](10c-where-boundaries-sit-in-the-hierarchy.md).

## Fix one: move the fetch into the page

The blunt version, and often the right one. If only one route under the layout needs the data,
the layout was the wrong place for it.

```tsx
// ❌ app/dashboard/layout.tsx — blocks every navigation under /dashboard
export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const workspace = await getWorkspace() // uncached: nothing below can paint until this lands
  return (
    <div>
      <Sidebar name={workspace.name} />
      {children}
    </div>
  )
}
```

```tsx
// ✅ the layout is static; the page owns its own data and its own boundary
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <SidebarShell />
      {children}
    </div>
  )
}
```

## Fix two: keep it in the layout, inside its own boundary

When the data genuinely belongs to the layout — a user menu that every route shares — the pattern
is to **start** the work without awaiting it, and let the component that needs the value suspend
inside a boundary:

```tsx
// app/dashboard/layout.tsx
import { Suspense } from 'react'
import { Nav } from './nav'
import { UserMenu } from './user-menu'
import { cookies } from 'next/headers'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const cookieStore = cookies() // Start the work, but don't await

  return (
    <div>
      <Nav>
        <Suspense fallback={<p>Loading user...</p>}>
          <UserMenu cookiePromise={cookieStore} />
        </Suspense>
      </Nav>
      {children}
    </div>
  )
}
```

The guide's own explanation of what this buys: *"`<Nav>` and `{children}` render as part of the
static shell because nothing in the layout awaits. Only `<UserMenu>` suspends when it resolves
the cookie promise. If the layout had called `await cookies()` at the top instead, the entire
layout and all its children would be blocked from prerendering."*

## The general rule this is an instance of

> *"If you `await` any of these at the top of a layout or page, everything below that point
> becomes dynamic and cannot be prerendered as part of the static shell."*

The list is `params`, `searchParams`, `cookies()`, `headers()`, and data fetches. Pass the promise
down instead of awaiting it:

```tsx
// app/shop/[category]/page.tsx
import { Suspense } from 'react'
import { Hero } from './hero'
import { ProductGrid } from './product-grid'

export default function ShopPage({
  params,
}: {
  params: Promise<{ category: string }>
}) {
  return (
    <div>
      <Hero />
      <Suspense fallback={<p>Loading products...</p>}>
        <ProductGrid paramsPromise={params} />
      </Suspense>
    </div>
  )
}
```

Or unwrap it inline, so the child keeps a plain-value prop:

```tsx
<Suspense fallback={<p>Loading products...</p>}>
  {params.then(({ category }) => (
    <ProductGrid category={category} />
  ))}
</Suspense>
```

## Gotchas

### The skeleton file exists and never renders
**Symptom.** `loading.tsx` is in the right folder, the route is slow, and navigation shows the
previous page and then the new one with nothing in between.
**Cause.** The segment's own layout awaits runtime data, and `loading.js` does not cover it.
Navigation blocks until the layout finishes.
**Fix.** Move the fetch to the page, or start it without awaiting and consume it inside a
`<Suspense>` in the layout.

### `await cookies()` at the top of the root layout
**Symptom.** Nothing anywhere in the application prerenders, and every route is slow on first
paint.
**Cause.** Awaiting a runtime API at the top of a layout makes everything below it dynamic — and
the root layout is above everything.
**Fix.** Start the call, pass the promise to the component that needs it, and put that component
in a boundary. The `cookieStore` example above is the exact shape.

### A build-time error after enabling Cache Components, blamed on the migration
**Symptom.** The build fails with an error about unwrapped runtime data access in a layout that
worked yesterday.
**Cause.** It did not work yesterday — it blocked navigation silently. Cache Components turns the
same defect into a diagnostic.
**Fix.** Wrap the access in `<Suspense>` as the error asks. Treat the build failure as the bug
report you did not previously get.

### Passing an already-awaited value and expecting a boundary to help
**Symptom.** The child sits inside `<Suspense>` and the fallback still never shows.
**Cause.** The `await` happened in the parent, so the parent suspended — above the boundary.
Wrapping the child changes nothing, because by the time the child renders the data is already
resolved.
**Fix.** Pass the **promise**, not the value, and let the child do the awaiting inside the
boundary.

```tsx
// ❌ parent suspends; the boundary below it is decorative
const user = await getUser()
return <Suspense fallback={<UserSkeleton />}><UserMenu user={user} /></Suspense>

// ✅ the child suspends, inside the boundary
const userPromise = getUser()
return <Suspense fallback={<UserSkeleton />}><UserMenu userPromise={userPromise} /></Suspense>
```

### A shared layout that fetches "just one small thing"
**Symptom.** A single fast query in a layout costs every route under it its instant navigation,
and the query is too small to look suspicious in a trace.
**Cause.** The cost is not the query's duration, it is the serialisation: nothing below can begin
until it resolves.
**Fix.** Judge a layout fetch by what it blocks, not by how long it takes. If it is not needed by
the layout's own markup, it does not belong in the layout.

### A `loading.tsx` added to fix it
**Symptom.** The skeleton file is moved up a level, or duplicated into the parent segment, and
the stall persists.
**Cause.** The blocked render is the layout's, and no `loading.js` covers a same-segment layout at
any level.
**Fix.** The fix is always on the data-access side. Adding loading files cannot reach it.

## Interview questions

**★ A `loading.tsx` is present and the skeleton never appears. What is the first thing you
check?**
Whether the segment's `layout.js` awaits runtime or uncached data — `cookies()`, `headers()`, or
an uncached fetch. `loading.js` does not show a fallback for the layout in its own segment, so
navigation blocks until the layout finishes rendering, with no error and no warning.

**★ Why can't `loading.js` cover its own segment's layout?**
Because the layout renders it. `loading.js` is nested inside `layout.js`, so the layout must
already have rendered for the fallback to exist at all — a boundary cannot suspend the component
that mounts it.

**★ How does Cache Components change this failure?**
It converts it from silent to loud. Without Cache Components, navigation simply blocks. With
them, unwrapped runtime data access in a layout is a **build-time error**, and once the access is
wrapped the static shell streams first with the uncached content filling in.

**★ What are the two fixes the reference names?**
Move the uncached data fetching from `layout.js` into `page.js`, or wrap the runtime data access
in the layout in its own `<Suspense>` boundary. The second is the one to use when the data really
does belong to the layout.

**★ What does "push dynamic access down" mean concretely?**
Do not `await` `params`, `searchParams`, `cookies()`, `headers()` or a fetch at the top of a
layout or page — everything below that point becomes dynamic and cannot be part of the static
shell. Start the work, pass the promise to the component that needs the value, and put that
component inside a boundary. You can also unwrap inline with `params.then(...)` so the child
receives a plain value.

**★ A component is inside `<Suspense>` and still never shows its fallback. Why?**
Almost always because the suspension happened above the boundary — the parent awaited the data
and passed a resolved value down. A boundary can only catch a suspension that occurs beneath it,
so the promise has to be what crosses the boundary, not the result.

**★ Is a fetch in a layout always wrong?**
No — it is wrong when the layout's own markup does not need it. Data the layout renders belongs
in the layout; data that only the page renders is blocking every route under that layout for no
benefit. The question to ask is not "how slow is it" but "what cannot start until it finishes".

---

← [05 · `loading.tsx` vs inline Suspense](05-loadingtsx-vs-inline-suspense-skeleton-strategy-and-layout-s.md) · **Next → [05c · Skeletons, layout shift and the cost of a boundary](05c-skeletons-layout-shift-and-the-cost-of-a-boundary.md)**
