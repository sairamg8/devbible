---
title: "`loading.js` is a `<Suspense>` boundary you did not get to place, and the one thing it does not wrap is the layout in its own segment — which is exactly where the uncached fetch that blocks your navigation usually lives"
sidebar_label: "02b · where to put boundaries"
sidebar_position: 2.1
description: "Choosing where Suspense boundaries go: what loading.js wraps and what it deliberately does not, sibling versus nested boundaries, pushing dynamic access down, and how boundary placement decides LCP, CLS and INP."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-03 for **Next.js 16.3.4** against [`loading.js`](https://nextjs.org/docs/app/api-reference/file-conventions/loading) (docs `lastUpdated` 2026-06-08) and [Streaming](https://nextjs.org/docs/app/guides/streaming) (`lastUpdated` 2026-08-25).
> Target: **Next.js 16.3.4**, App Router, Node >= 20.9. Documentation-verified; **no sandbox run**.

**Every boundary you place is a decision about three separate things at once: how much of the page can be prerendered into the static shell, which sections can arrive independently, and how hydration is split. [02](02-async-components-streaming-with-suspense-granular-ui-blocks.md) explained what a boundary does to the stream. This page is where to put them — and the single most valuable fact on it is a negative: `loading.js` wraps `page.js`, `not-found.js` and nested layouts, and it deliberately does **not** wrap the `layout.js` in its own segment. An uncached fetch in that layout is therefore invisible to the loading state you added to fix exactly that problem, and navigation blocks on it with no fallback at all.**

## What `loading.js` is, precisely

Drop a `loading.js` beside a `page.js` and Next.js wraps the page content in a `<Suspense>` boundary using your component as the fallback. It is a convention over a boundary, not a separate mechanism.

```tsx
// app/dashboard/loading.tsx
export default function Loading() {
  return (
    <div className="animate-pulse">
      <div className="h-8 w-48 rounded bg-gray-200" />
      <div className="h-4 w-full rounded bg-gray-200" />
      <div className="h-4 w-2/3 rounded bg-gray-200" />
    </div>
  )
}
```

Three behaviours come with the convention and none of them come with a hand-written boundary:

- **The fallback is prefetched**, so navigation is immediate unless prefetching has not completed.
- **Navigation is interruptible** — changing routes does not require the content of the current route to finish loading first.
- **Shared layouts remain interactive** while new segments load.

It is a Server Component by default and can be made a Client Component with `'use client'`. It takes no parameters — no `params`, no `searchParams`, nothing. If your skeleton needs to know something about the route, it cannot be a `loading.js`.

## The boundary it does not draw

> *"It does **not** wrap the `layout.js`, `template.js`, or `error.js` in the same segment."*

In the component hierarchy, `loading.js` sits *inside* `layout.js` and wraps `not-found.js`, `page.js` and nested `layout.js` files. So a layout that reads uncached or runtime data — `cookies()`, `headers()`, an uncached fetch — is above its own segment's loading state, and:

- **Without Cache Components:** navigation blocks until the layout finishes rendering. No fallback, no skeleton, nothing on screen.
- **With Cache Components:** the uncached access in the layout must be wrapped in `<Suspense>` explicitly, or Next.js fails the build with a message telling you so. The static shell then streams first and the uncached content fills in.

That difference is worth stating plainly: without Cache Components the mistake is a silent performance bug in production; with them it is a build error on your machine. It is one of the strongest practical arguments for turning Cache Components on.

There are two fixes and they are not equivalent.

```tsx
// Fix 1 — move the data access out of the layout and into the page,
// where loading.js does cover it.
// app/dashboard/layout.tsx
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return <div className="shell"><Nav />{children}</div>
}
```

```tsx
// Fix 2 — keep it in the layout, but give it its own boundary.
// The layout itself stays synchronous.
import { Suspense } from 'react'
import { cookies } from 'next/headers'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = cookies() // started, not awaited

  return (
    <div className="shell">
      <Nav>
        <Suspense fallback={<UserMenuSkeleton />}>
          <UserMenu cookiePromise={cookieStore} />
        </Suspense>
      </Nav>
      {children}
    </div>
  )
}
```

Fix 1 is right when the data was only ever needed by the page. Fix 2 is right when the layout genuinely renders it — a user menu, a workspace switcher, a theme — and it is the shape that keeps the nav and the children in the static shell.

## `loading.js` versus a hand-placed boundary

| | `loading.js` | `<Suspense>` |
|---|---|---|
| Scope | the entire page | any component |
| Setup | drop in a file | wrap explicitly |
| Navigation | prefetched as an instant fallback | not prefetched by default |
| Parameters | none | whatever props you pass the child |
| Best for | pages where nothing renders without data | most pages, for granular control |

The documentation's recommendation is explicit and worth following: prefer explicit `<Suspense>` boundaries close to the dynamic access. The reason is mechanical. When the prerenderer meets dynamic work it walks up the tree for the nearest boundary; a `loading.js` high in the tree **is** a valid boundary, so the framework finds it, stops, and the whole page falls back to a full-page skeleton instead of streaming granularly. A `loading.js` does not merely fail to help — it absorbs the search and hides the fact that the boundary was in the wrong place.

Use `loading.js` when there is genuinely nothing meaningful to show until the page's data resolves. Use explicit boundaries the moment part of the page could be shown earlier.

## Sibling boundaries: sections that arrive independently

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
        <Suspense fallback={<CardSkeleton />}>
          <Revenue />
        </Suspense>
        <Suspense fallback={<CardSkeleton />}>
          <RecentOrders />
        </Suspense>
      </div>
      <Suspense fallback={<ListSkeleton />}>
        <Recommendations />
      </Suspense>
    </div>
  )
}
```

Each boundary is an independent streaming point; components inside different boundaries resolve and stream in whatever order they finish, without blocking each other. The `<h1>` is in the shell. Note what the page function does **not** do: it does not `await` anything, which is the precondition for any of this working.

## Nested boundaries: progressive detail

Nesting produces a loading *sequence* rather than parallel arrivals. The outer fallback shows until the outer content resolves; then the inner fallback becomes visible until the inner content resolves.

```tsx
// app/product/[id]/page.tsx
import { Suspense } from 'react'

export default async function ProductPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  return (
    <div>
      <h1>Product</h1>
      <Suspense fallback={<DetailsSkeleton />}>
        <ProductDetails id={id} />
        <Suspense fallback={<ReviewsSkeleton />}>
          <Reviews productId={id} />
        </Suspense>
      </Suspense>
    </div>
  )
}
```

React's own framing: when a component suspends, the closest parent boundary shows its fallback, so nesting boundaries creates a loading sequence in which each level fills in as its content becomes available. Choose nesting when the inner content genuinely has no meaning until the outer content exists — reviews of a product you have not identified yet. Choose siblings when the sections are independent, because siblings arrive as they finish and nested boundaries impose an order.

## Push the dynamic access down

The lever that decides how much of the page is prerendered is how deep the runtime data access sits. This applies to `params`, `searchParams`, `cookies()`, `headers()` and every data fetch.

```tsx
// app/shop/[category]/page.tsx — <Hero /> ships in the static shell.
import { Suspense } from 'react'

export default function ShopPage({ params }: { params: Promise<{ category: string }> }) {
  return (
    <div>
      <Hero />
      <Suspense fallback={<GridSkeleton />}>
        {params.then(({ category }) => (
          <ProductGrid category={category} />
        ))}
      </Suspense>
    </div>
  )
}
```

Unwrapping the promise inline with `.then()` inside the boundary is the documented trick that lets the child keep a plain `string` prop instead of a `Promise<string>` — the deferral is real, but it does not leak into the child's type. Passing the promise as a prop and awaiting it in the child is the equivalent shape when the child is doing more with it.

## Placement and Web Vitals

Boundary placement is a performance decision with three named effects.

- **LCP.** An element inside a boundary cannot paint until that boundary's content is swapped in, and the swap itself costs a script execution on the client. Keep the LCP element — hero image, main heading, product photo — **outside or above** every boundary. For an LCP image, `next/image`'s `preload` prop injects a `<link rel="preload">` into the head so the fetch starts from the first chunk; it controls when the image is *fetched*, not when it *paints*, so an image inside a boundary still waits for the swap.
- **CLS.** A fallback replaced by differently-sized content reflows the page. Match the skeleton's dimensions to the resolved content, or reserve space with a fixed or min-height container around the boundary.
- **INP.** Each boundary is a hydration unit, so boundaries split one long hydration task into several that yield to the browser.

The counterweight, stated in the docs as a rule of thumb: if there is a boundary, React might use it — under a slow network or a busy CPU, concurrent rendering can fall back to a boundary you did not expect it to use. Adding a boundary is accepting that. Do not add one you do not need.

## Gotchas

**★ Symptom: you added `loading.js` and navigation to the route still hangs with the old page on screen.** Cause: the segment's `layout.js` reads uncached or runtime data, and `loading.js` does not wrap the layout in its own segment. Without Cache Components, navigation blocks until the layout finishes. Fix: move the access into `page.js`, or wrap it in its own boundary inside the layout while keeping the layout function synchronous.

```tsx
// app/dashboard/layout.tsx
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = cookies()
  return (
    <div>
      <Suspense fallback={<UserMenuSkeleton />}>
        <UserMenu cookiePromise={cookieStore} />
      </Suspense>
      {children}
    </div>
  )
}
```

**★ Symptom: the whole page shows a full-page skeleton when only one card is slow.** Cause: the nearest boundary above the dynamic work is a `loading.js` high in the tree. The prerenderer walks up, finds it, and stops — so the entire page falls back instead of streaming granularly. Fix: put an explicit boundary next to the slow component; the walk-up then terminates there.

```tsx
<Suspense fallback={<CardSkeleton />}>
  <SlowCard />
</Suspense>
```

**★ Symptom: your LCP got worse after adding streaming.** Cause: the LCP element is inside a boundary, so it cannot paint until the boundary's HTML arrives and its swap script runs. Fix: move it out of the boundary entirely so it renders in the static shell.

```tsx
export default function Page() {
  return (
    <>
      <h1>Autumn collection</h1>                {/* LCP text — in the shell */}
      <HeroImage />                              {/* LCP image — in the shell */}
      <Suspense fallback={<GridSkeleton />}>
        <ProductGrid />                          {/* everything slow, below */}
      </Suspense>
    </>
  )
}
```

**★ Symptom: content jumps around as sections stream in.** Cause: fallbacks whose dimensions differ from the resolved content, so each swap reflows the page. Fix: size the skeleton like the content, or reserve the space around the boundary.

```tsx
<div className="min-h-[420px]">
  <Suspense fallback={<GridSkeleton rows={3} />}>
    <ProductGrid />
  </Suspense>
</div>
```

**Symptom: your `loading.js` needs the route's `params` to render a meaningful skeleton, and there is no way to get them.** Cause: loading UI components accept no parameters at all. Fix: use an explicit boundary in the page instead, where the fallback is ordinary JSX and can be given whatever props you like.

```tsx
export default function Page({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<ItemSkeleton variant="detail" />}>
      {params.then(({ id }) => <Item id={id} />)}
    </Suspense>
  )
}
```

**Symptom: two sections stream in a fixed order even though they are independent.** Cause: the boundaries are nested rather than siblings, and a nested boundary is only revealed once its parent has resolved. Fix: make them siblings so each arrives when its own data is ready.

**Symptom: adding boundaries around everything made the page feel choppier.** Cause: every boundary is permission for React to show a fallback, and under CPU or network pressure it may use one you did not expect; several near-simultaneous reveals also cascade because React reveals suspended content at most once every 300ms. Fix: keep boundaries where a section is genuinely slower than the rest, and delete the decorative ones.

**Symptom: the page prerenders nothing even though every fetch is inside a boundary.** Cause: something above the boundaries awaits — most often `const { id } = await params` on the first line of the page or layout. The boundaries are below the blocking call, so they never get a chance. Fix: pass the promise into the boundary and resolve it there, as shown above.

**Symptom: a `loading.js` was added at a parent segment and now every child route shows the parent's skeleton.** Cause: `loading.js` wraps `page.js` and any children below it, so a `loading.js` at `app/dashboard/` covers `app/dashboard/settings/` too unless that segment has its own. Fix: add a `loading.js` at the deeper segment, or replace the parent one with explicit boundaries so each route controls its own fallback.

## Interview questions

**★ What exactly does `loading.js` wrap, and what does it not?**
It is nested inside `layout.js` and wraps `not-found.js`, `page.js` and nested `layout.js` files in a `<Suspense>` boundary. It does not wrap the `layout.js`, `template.js` or `error.js` of its own segment. The consequence is the one that bites: a layout that reads `cookies()`, `headers()` or an uncached fetch is above its own loading state, so without Cache Components navigation blocks until the layout finishes rendering, with no fallback shown at all. With Cache Components the same code is a build-time error instead, which is a considerably better place to find it.

**★ Why does the documentation prefer explicit `<Suspense>` boundaries over `loading.js`?**
Because of how the prerenderer resolves dynamic work: it walks up the tree looking for the nearest boundary and stops at the first one it finds. A `loading.js` high in the tree is a valid boundary, so the search terminates there and the entire page falls back to a full-page skeleton rather than streaming section by section. Placing an explicit boundary close to the dynamic access ends the walk-up where you intended it to end. `loading.js` remains right when nothing on the page is meaningful until the data resolves.

**★ When do you nest boundaries and when do you make them siblings?**
Siblings when the sections are independent — each streams as soon as its own work finishes, in whatever order that happens, and none blocks another. Nested when the inner content is meaningless until the outer content exists, such as reviews for a product that has not been identified yet. Nesting imposes an order: the inner fallback is not even visible until the outer boundary has resolved. Choosing nesting for independent sections is a common accidental serialisation.

**★ How does boundary placement affect LCP, CLS and INP differently?**
LCP wants the element *outside* boundaries, because content inside one cannot paint until its HTML arrives and its swap script runs — and `next/image`'s `preload` changes when the image is fetched, not when it paints. CLS wants the fallback to be the same size as the content, or the space reserved around the boundary, because every swap reflows. INP wants *more* boundaries, because each one is a hydration unit and splits a single long blocking hydration pass into tasks that yield. The three pull in different directions, which is why "wrap everything" and "wrap nothing" are both wrong.

**Your page renders a skeleton for the whole route even though only one widget is slow. Where do you look?**
At what sits between the widget and the top of the route. The framework attaches the dynamic work to the nearest boundary above it; if that is a `loading.js` at the segment or higher, the whole page is the fallback. Add a boundary immediately around the widget. Then check that nothing above it awaits — a boundary below a blocking `await` never runs, and the symptom for that is different: no skeleton at all, just a slow blank response.

**Can a `loading.js` show a skeleton that depends on which item is being loaded?**
No. Loading UI components accept no parameters — no `params`, no `searchParams`. If the fallback needs route information, it has to be an explicit `<Suspense fallback={...}>` in the page, where the fallback is ordinary JSX you can pass anything to. This is one of the more common reasons a team migrates from `loading.js` to hand-placed boundaries.

**Why does `loading.js` make navigation feel instant when a hand-written boundary does not?**
Its fallback is prefetched, so on navigation the skeleton is already available on the client and appears immediately unless prefetching has not completed. Explicit `<Suspense>` fallbacks are not prefetched by default. Navigation with `loading.js` is also interruptible — changing route again does not wait for the current route's content — and shared layouts stay interactive while the new segment loads. Those three behaviours are the real reason to keep a `loading.js` even in a codebase that mostly uses explicit boundaries.

**Is there a downside to adding a boundary that is not needed?**
Yes, and the docs state it as a rule of thumb: if there is a boundary, React might use it. Under a slow network or a busy CPU, concurrent rendering can fall back to a boundary you added "just in case", which shows a skeleton where content would otherwise have rendered. React may also hold back a large boundary simply because sending its HTML takes time. A boundary is permission, not decoration.

---

← [02 · async components and streaming](02-async-components-streaming-with-suspense-granular-ui-blocks.md) · Next → [02c · streaming after the shell](02c-streaming-after-the-shell-status-codes-errors-and-infrastructure.md)
