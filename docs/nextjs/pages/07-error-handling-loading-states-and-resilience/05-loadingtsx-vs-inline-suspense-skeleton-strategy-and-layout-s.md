---
title: "`loading.tsx` is one `<Suspense>` boundary the framework places for you, in a position you did not choose — which is why the documentation tells you to prefer writing your own"
sidebar_label: "05 · `loading.tsx` vs inline Suspense"
sidebar_position: 15
description: "Exactly what loading.js wraps and what it pointedly does not, the documented comparison table, why a loading.js high in the tree satisfies the prerenderer and costs you granular streaming, and when the file convention is still the right answer."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-04 against the Next.js
> [`loading.js` file-convention reference](https://nextjs.org/docs/app/api-reference/file-conventions/loading)
> (page metadata `version: 16.3.4`, `lastUpdated: 2026-06-08`) — its component-hierarchy rule,
> behaviour list and Version History are quoted verbatim below — and the
> [Streaming guide](https://nextjs.org/docs/app/guides/streaming) (`lastUpdated: 2026-08-25`),
> whose `loading.js` vs `<Suspense>` comparison table is reproduced verbatim.
> Target: **Next.js 16.3.4**, App Router. Documentation-validated; **no sandbox run**.

**A `loading.tsx` is not a loading feature; it is a Suspense boundary, and every property of a
Suspense boundary comes with it.** It decides where the response commits and therefore whether
your 404s are real 404s. It decides the blast radius of a failure, because a boundary is where
streaming stops and where a thrown error surfaces. It decides a hydration unit, and it decides
which part of your page cannot be part of the static shell. Dropping the file into a folder is a
one-line change with all of those consequences attached, and the framework's own guidance —
*"Prefer explicit `<Suspense>` boundaries close to the dynamic access"* — exists because the
position the convention picks is almost never the position you would pick.

## What `loading.js` wraps, precisely

> *"In the component hierarchy, `loading.js` wraps `not-found.js`, `page.js`, and nested
> `layout.js` files in a `<Suspense>` boundary. It does **not** wrap the `layout.js`,
> `template.js`, or `error.js` in the same segment."*

Read the exclusions as carefully as the inclusions. `loading.js` **does** wrap nested layouts
further down; it does **not** wrap the layout beside it. That asymmetry is the same shape as
`error.js`'s — a boundary covers what is below it, not the sibling that renders it — and it is
the reason a skeleton can fail to appear at all, which is
[05b](05b-the-layout-that-stops-your-skeleton-appearing.md)'s subject.

The reference is equally clear on the smaller facts:

- It sits *"nested inside `layout.js`"* and *"will automatically wrap the `page.js` file and any
  children below in a `<Suspense>` boundary."*
- *"Loading UI components do not accept any parameters."* There is no `params`, no
  `searchParams`, nothing — a skeleton cannot know what it is a skeleton *of*.
- *"By default, this file is a Server Component - but can also be used as a Client Component
  through the `"use client"` directive."*
- The Version History has exactly one row: **`v13.0.0` `loading` introduced.** Nothing about this
  convention has changed since it shipped.

## The behaviour you get for free

> - *"The Fallback UI is prefetched, making navigation immediate unless prefetching hasn't
>   completed."*
> - *"Navigation is interruptible, meaning changing routes does not need to wait for the content
>   of the route to fully load before navigating to another route."*
> - *"Shared layouts remain interactive while new route segments load."*

🔴 **Prefetching is the one thing an inline `<Suspense>` does not give you**, and it is the whole
argument for the file convention. On a client-side navigation the `loading.tsx` fallback is
already in the browser, so the new route paints instantly; a hand-written boundary's fallback is
part of the payload being fetched.

## The documented comparison

| | `loading.js` | `<Suspense>` |
|---|---|---|
| **Scope** | Entire page | Any component |
| **Setup** | Drop in a file | Wrap components explicitly |
| **Navigation** | Prefetched as instant fallback | Not prefetched by default |
| **Best for** | Pages where nothing renders without data | Most pages, for granular control |

And the recommendation that follows it:

> *"Prefer explicit `<Suspense>` boundaries close to the dynamic access."*

## The prerenderer's rule, and the trap inside it

This is the paragraph that explains why a well-meant `loading.tsx` can quietly cost you
everything streaming was for:

> *"When the prerenderer encounters dynamic work, it walks up the tree looking for the nearest
> Suspense boundary. If none is found, the build fails with a blocking route error. A
> `loading.js` high in the tree is a valid boundary, so the framework finds it and stops, but
> now the entire page falls back to a full-page skeleton instead of streaming granularly."*

🔴 **A `loading.js` therefore turns a build error into a performance regression.** Without it,
dynamic work with no boundary above it fails the build and you are told about it. With it, the
build passes and the page renders one big skeleton — the same symptom, no diagnostic, and it will
be attributed to a slow server rather than to a boundary in the wrong place.

```tsx
// app/dashboard/page.tsx
// ❌ with a loading.tsx at app/dashboard/, this builds and shows one full-page skeleton
export default async function Dashboard() {
  const revenue = await getRevenue() // slow
  const orders = await getRecentOrders() // fast
  return (
    <>
      <Revenue data={revenue} />
      <Orders data={orders} />
    </>
  )
}
```

```tsx
// ✅ boundaries close to the dynamic access: orders paints while revenue is still resolving
import { Suspense } from 'react'

export default function Dashboard() {
  return (
    <>
      <h1>Dashboard</h1>
      <Suspense fallback={<RevenueSkeleton />}>
        <Revenue />
      </Suspense>
      <Suspense fallback={<OrdersSkeleton />}>
        <Orders />
      </Suspense>
    </>
  )
}
```

## When `loading.js` is still the right answer

The comparison table's own criterion: *"Pages where nothing renders without data."* If the page
is a single record view and the record is the page, there is no partial state worth designing —
and you get prefetching for free. The reference's own framing agrees: `loading.js` *"is useful
when there's nothing meaningful to show until the page's data resolves. If the page needs to
await data before it can render anything, a full-page skeleton is a reasonable fallback."*

The mistake is not using `loading.tsx`. It is using it on a page that *does* have meaningful
partial states, where it converts them into one undifferentiated wait.

## Gotchas

### Adding `loading.tsx` makes the whole page skeleton where it used to stream in parts
**Symptom.** A dashboard that painted section by section now shows one full-page skeleton and
then everything at once.
**Cause.** The prerenderer walks up from the dynamic work to the nearest boundary. The new
`loading.tsx` is now the nearest one for everything on the page, so it became the single
streaming point.
**Fix.** Keep the inline boundaries and remove the file, or accept that the file is now the
boundary. The two do not compose into finer granularity — the higher one wins for anything with
no boundary below it.

### A skeleton that needs to know what it is loading
**Symptom.** A `loading.tsx` that wants the route's `params` to render "Loading invoice #1234"
cannot get them.
**Cause.** *"Loading UI components do not accept any parameters."*
**Fix.** Use an inline `<Suspense>` inside the page, where the fallback is ordinary JSX with
access to everything the page has.

```tsx
// app/invoices/[id]/page.tsx
import { Suspense } from 'react'

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  return (
    <Suspense fallback={<p>Loading invoice #{id}…</p>}>
      <Invoice id={id} />
    </Suspense>
  )
}
```

### A `loading.tsx` that quietly changed the route's status codes
**Symptom.** The route's 404s became 200s and nobody changed the 404 logic.
**Cause.** Rendering a Suspense fallback is what commits the response. The file's whole purpose
is to render one immediately.
**Fix.** Keep the existence check above the boundary — the full explanation and the documented
pattern are in
[02b · `notFound()` after the first chunk](02b-notfound-and-redirect-after-the-first-chunk.md).

### Both a `loading.tsx` and an inline boundary around the same content
**Symptom.** A brief double flash — the page skeleton, then the component skeleton — on
navigation.
**Cause.** Two nested boundaries, each resolving on its own schedule. It is not a bug; it is two
fallbacks doing exactly what they were asked to.
**Fix.** Decide which boundary owns the wait. Nesting boundaries is a legitimate technique for
progressive reveal, but it should be a designed sequence rather than an accident of one file and
one wrapper both existing.

### Expecting a `loading.tsx` to cover the segment's own layout
**Symptom.** The layout's slow header blocks navigation and the skeleton never shows.
**Cause.** `loading.js` does not wrap the `layout.js` in the same segment — only nested ones.
**Fix.** See [05b · The layout that stops your skeleton appearing](05b-the-layout-that-stops-your-skeleton-appearing.md);
the fix is to move or wrap the layout's data access, not to change the loading file.

### Reaching for `loading.tsx` to fix a blocking-prerender build error
**Symptom.** The build failed with a blocking route error, a `loading.tsx` was added, the build
passed, and the page got slower.
**Cause.** The error was telling you that dynamic work had no boundary. Adding one at the top of
the tree satisfies the check without addressing the placement.
**Fix.** Put the boundary where the dynamic access is. The build error is a better diagnostic
than the silence that replaces it.

## Interview questions

**★ What does `loading.js` wrap, and what does it deliberately not wrap?**
It wraps `not-found.js`, `page.js` and **nested** `layout.js` files in a `<Suspense>` boundary. It
does not wrap the `layout.js`, `template.js` or `error.js` in the same segment. The asymmetry
matters: a slow nested layout is covered, a slow same-segment layout is not.

**★ The docs recommend inline `<Suspense>` over `loading.js`. What do you give up by following
that advice?**
Prefetching. The documented comparison is explicit that a `loading.js` fallback is *"prefetched
as instant fallback"* while `<Suspense>` is *"not prefetched by default"*, so on a client-side
navigation the file-convention skeleton is already in the browser and a hand-written one is not.
That is the trade: granularity against instant paint on navigation.

**★ Why can adding a `loading.tsx` make a page slower?**
Because the prerenderer walks up from dynamic work to the nearest Suspense boundary, and a
`loading.js` high in the tree is a valid one. Without it the build fails with a blocking route
error and tells you exactly where the problem is. With it, the build passes and the whole page
falls back to a single skeleton instead of streaming section by section.

**★ Can a loading component read `params`?**
No — loading UI components accept no parameters at all. A fallback that needs to know what it is
loading has to be an inline `<Suspense>` fallback inside the page, where it is ordinary JSX.

**★ When is the file convention the better choice?**
When nothing meaningful renders without the data — a single-record view where the record *is* the
page. There is no partial state to design, and you get prefetched instant navigation for free.
The failure case is using it on a page that does have meaningful partial states and flattening
them into one wait.

**★ What has changed about `loading.js` since it shipped?**
Nothing. The Version History has a single row: `v13.0.0`, `loading` introduced. That is worth
knowing when reading old material about it — unlike `error.js`, whose props changed as recently
as 16.3, guidance about `loading.js` does not go stale from version drift.

**★ Is a `loading.tsx` a Server Component?**
By default, yes — and it can be a Client Component with `'use client'` when the skeleton itself
needs interactivity or client-only APIs. Most skeletons want neither, and a Server Component
fallback keeps it out of the bundle.

---

← [04b · Designing the error envelope](04b-designing-the-error-envelope.md) · **Next → [05b · The layout that stops your skeleton appearing](05b-the-layout-that-stops-your-skeleton-appearing.md)**
