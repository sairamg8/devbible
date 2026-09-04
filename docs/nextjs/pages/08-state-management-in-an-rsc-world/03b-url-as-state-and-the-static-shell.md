---
title: "Awaiting searchParams suspends the component you await in, so the await belongs in a leaf behind Suspense — where you put it decides how much of the page a CDN can serve without ever reaching your server"
sidebar_label: "03b · URL state and the static shell"
sidebar_position: 120
description: "How searchParams opts a route into dynamic rendering, why a synchronous page component with the await pushed into a leaf restores the static shell, why Suspense is a seam and not a switch, and why layouts never receive searchParams."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-05 against [Caching](https://nextjs.org/docs/app/getting-started/caching) (`lastUpdated: 2026-08-25`)
> and [`layout.js`](https://nextjs.org/docs/app/api-reference/file-conventions/layout) (`lastUpdated: 2026-05-27`).
> Target: **Next.js 16.3.4** App Router · **React 19.2.8**. Cache Components (`cacheComponents: true`) assumed throughout.
> Documentation-verified; **no sandbox run**.

**Putting state in the URL is free at the browser and expensive at the render. `searchParams` is a request-time API: the moment a component awaits it, that component and everything above it drops out of the prerendered static shell — the artefact a CDN can serve without ever reaching your server. The mistake is not *using* `searchParams`. It is awaiting it at the top of `page.tsx`, where it costs you the entire page instead of one list. The whole fix is structural and costs a `Suspense` boundary and one extra function.**

## The mechanism: what a static shell is and what excludes you from it

With Cache Components enabled, Next.js renders as much of every route as it can before a request arrives. What it produces is the **static shell**: HTML plus a serialised RSC payload, servable from a CDN with no upstream request.

> *"This generates a static shell consisting of HTML for initial page loads and a serialized RSC Payload for client-side navigation, ensuring the browser receives fully rendered content instantly whether users navigate directly to the URL or transition from another page. This rendering approach is called **Partial Prerendering (PPR)**, the default behavior with Cache Components."*
> — [Caching, Prerendering](https://nextjs.org/docs/app/getting-started/caching#prerendering)

> *"Every produced static shell can be served directly from a CDN, without going through to the upstream server."*
> — same section

Four things are runtime data and can never be in the shell:

> *"Runtime APIs require information that is only available when a user makes a request. These include: `cookies` … `headers` … `searchParams` - URL query parameters … `params` - Dynamic route parameters"*
> — [Caching, Working with runtime APIs](https://nextjs.org/docs/app/getting-started/caching#working-with-runtime-apis)

And the framework will not let you ignore the problem:

> *"Next.js requires you to explicitly handle components that can't complete during prerendering. It surfaces a validation insight in the dev overlay and dev server console that names the route and points at fixes (cache the access, move it into a `<Suspense>` boundary, or opt the route out). This validation keeps every route producing a static shell, so direct navigations stay instant."*
> — [Caching, Prerendering](https://nextjs.org/docs/app/getting-started/caching#prerendering)

## Where you await is the whole game

This is the shape almost everyone writes first, and it has an empty shell:

```tsx filename="app/[tenant]/board/page.tsx"
// ❌ The whole page is request-time. Nothing prerenders.
export default async function BoardPage(props: PageProps<'/[tenant]/board'>) {
  const { status = 'open' } = await props.searchParams
  const tasks = await listTasks(status)

  return (
    <main>
      <BoardHeader />
      <FilterBar />
      <TaskList tasks={tasks} />
    </main>
  )
}
```

`BoardHeader` and `FilterBar` do not depend on the query string at all. But the `await` suspends the component it is written in, so *nothing* under `BoardPage` — including the header — reaches the shell.

> *"The deeper your async work sits in the tree, the more of the page can be prerendered. This is the structural pattern Cache Components rewards: a general practice worth applying everywhere, and the foundation for the instant navigation and prefetching that follow."*
> — [Caching, Maximizing the static shell](https://nextjs.org/docs/app/getting-started/caching#maximizing-the-static-shell)

> *"The same principle applies to `cookies()`, `headers()`, `searchParams`, and data fetches."*
> — same section

**So the page component must not be `async`.** Pass the promise down; await it inside a `Suspense` boundary:

```tsx filename="app/[tenant]/board/page.tsx"
import { Suspense } from 'react'
import { BoardHeader } from '@/components/board-header'
import { FilterBar } from '@/components/filter-bar'
import { TaskListSkeleton } from '@/components/task-list-skeleton'

// Not async: this page never awaits anything.
export default function BoardPage(props: PageProps<'/[tenant]/board'>) {
  return (
    <main>
      <BoardHeader />
      <FilterBar />
      <Suspense fallback={<TaskListSkeleton />}>
        <TaskList searchParams={props.searchParams} />
      </Suspense>
    </main>
  )
}

async function TaskList({
  searchParams,
}: Pick<PageProps<'/[tenant]/board'>, 'searchParams'>) {
  const { status = 'open', sort = 'age' } = await searchParams
  const tasks = await listTasks({ status, sort })

  return (
    <ul>
      {tasks.map((task) => (
        <li key={task.id}>{task.title}</li>
      ))}
    </ul>
  )
}
```

`BoardHeader`, `FilterBar` and `TaskListSkeleton` are now in the shell. Only `TaskList` streams at request time.

The docs show the same move for `params`, including the option of resolving the promise inline with `.then()` rather than extracting a child component:

```tsx filename="app/shop/[slug]/layout.tsx"
import { Suspense } from 'react'

// Not async: this layout never awaits params
export default function Layout({ children, params }: LayoutProps<'/shop/[slug]'>) {
  return (
    <div>
      <Sidebar />
      <Suspense fallback={<h1>Loading...</h1>}>
        {/* await happens inside the boundary, so the shell still renders */}
        {params.then(({ slug }) => (
          <SlugHeading slug={slug} />
        ))}
      </Suspense>
      {children}
    </div>
  )
}

function SlugHeading({ slug }: { slug: string }) {
  return <h1>{slug}</h1>
}
```

— pattern from [Caching, Maximizing the static shell](https://nextjs.org/docs/app/getting-started/caching#maximizing-the-static-shell).

> *"Now `<Sidebar />`, `{children}`, and the Suspense fallback are all part of the static shell. Only `SlugHeading` streams in at request time."*
> — same section

## `Suspense` is a seam, not a switch

⚠️ Wrapping a component in `Suspense` does not make it dynamic:

> *"`<Suspense>` provides a fallback UI while async work completes, but it does not itself opt a component into dynamic rendering. If a component only performs synchronous work, it will complete during prerendering regardless of whether it is wrapped in `<Suspense>`."*
> — [Caching](https://nextjs.org/docs/app/getting-started/caching)

Read the two halves separately, because they explain two different bugs:

- **Wrapping a synchronous component achieves nothing.** It still prerenders. Boundaries sprinkled defensively around static UI are pure noise.
- **Wrapping the awaiting component achieves everything.** The fallback goes in the shell; the real content streams behind it.

The boundary marks where the prerender *stops*. That is why it must sit exactly around the component that awaits — not its parent, not its sibling.

## Client navigations are validated separately from direct visits

A structure that produces a shell on a direct visit is not automatically instant on a client transition, and 16.3 added validation for the second case:

> *"Cache Components shipped in 16.0.0 with verification that direct visits to a route produce a static shell. Client navigations are different: a `<Suspense>` boundary that covers a direct visit may not be part of the render during a transition. Getting that structure right is easier when the framework steps in. Cache Components now validates these navigations too, giving you insights and errors that guide you to make navigations to your route instant."*
> — [Caching, Instant navigation](https://nextjs.org/docs/app/getting-started/caching#instant-navigation)

So a dev-overlay insight about a route you *thought* you had fixed is usually the navigation check, not the direct-visit check, complaining about a different boundary.

## Layouts do not get `searchParams`, and this is deliberate

```tsx filename="app/[tenant]/board/layout.tsx"
// ❌ There is no searchParams prop here. It is not an oversight.
export default function BoardLayout({ children }: { children: React.ReactNode }) {
  return <section>{children}</section>
}
```

> *"Layouts do not rerender on navigation, so they cannot access search params which would otherwise become stale."*
> — [`layout.js`, Query params](https://nextjs.org/docs/app/api-reference/file-conventions/layout#query-params)

> *"To access updated query parameters, you can use the Page `searchParams` prop, or read them inside a Client Component using the `useSearchParams` hook. Since Client Components re-render on navigation, they have access to the latest query parameters."*
> — same section

The same reasoning applies to `usePathname`, and the docs say so in the neighbouring section: *"Layouts do not re-render on navigation, so they do not access pathname which would otherwise become stale."*

If a persistent sidebar needs the current filter, it is a client component reading `useSearchParams()` — see [03e](03e-url-as-state-reading-from-a-client-component.md) — or it moves into the page. There is no third option: the "prop-drill it from the page into the layout" instinct is impossible, because layouts wrap pages rather than the reverse.

## Gotchas

**★ Symptom: `next build` marks the route dynamic and your CDN hit rate collapses the day you added one filter.** Cause: `await props.searchParams` at the top of the page component makes the whole subtree request-time. Fix: make the page synchronous and push the await into a child behind `Suspense`.

```tsx
// ❌ before
export default async function Page(props: PageProps<'/board'>) {
  const { q } = await props.searchParams
  return <><Header /><Results q={q} /></>
}

// ✅ after
export default function Page(props: PageProps<'/board'>) {
  return (
    <>
      <Header />
      <Suspense fallback={<ResultsSkeleton />}>
        <Results searchParams={props.searchParams} />
      </Suspense>
    </>
  )
}
```

**★ Symptom: you wrapped the component in `Suspense` and the shell did not get any bigger.** Cause: you wrapped a *synchronous* component; the boundary does not opt anything into dynamic rendering, so nothing moved. Fix: wrap the component that performs the `await`.

```tsx
// ❌ the boundary is above the header, which was never the problem
<Suspense fallback={null}><Header /></Suspense>
<Results searchParams={props.searchParams} />

// ✅ the boundary is exactly around the awaiting component
<Header />
<Suspense fallback={<ResultsSkeleton />}>
  <Results searchParams={props.searchParams} />
</Suspense>
```

**★ Symptom: the page component is synchronous but the shell is still empty.** Cause: you moved the `await` into a child but forgot the boundary, so the child suspends its nearest *ancestor* boundary — which is the route's own `loading.tsx`, or nothing at all. Fix: a boundary must sit between the shell content and the awaiting child.

```tsx
// ❌ no boundary — TaskList suspends whatever is above it
<BoardHeader />
<TaskList searchParams={props.searchParams} />

// ✅
<BoardHeader />
<Suspense fallback={<TaskListSkeleton />}>
  <TaskList searchParams={props.searchParams} />
</Suspense>
```

**★ Symptom: an insight fires on a route whose direct visit prerenders perfectly.** Cause: since 16.3, Cache Components validates *client navigations* separately, and a boundary that covers a direct visit may not be part of the render during a transition. Fix: read which check is failing before changing anything, then add the boundary the navigation path is missing — the fix is structural in the same way, just at a different point in the tree.

**★ Symptom: a sidebar in `layout.tsx` shows the filter from two navigations ago.** Cause: layouts do not re-render on navigation, so any query state captured there is frozen at the first render. Fix: read it in a client component, which does re-render.

```tsx filename="app/[tenant]/board/filter-badge.tsx"
'use client'
import { useSearchParams } from 'next/navigation'

export function FilterBadge() {
  return <span>{useSearchParams().get('status') ?? 'open'}</span>
}
```

That component needs a `Suspense` boundary of its own — see [03e](03e-url-as-state-reading-from-a-client-component.md).

**★ Symptom: a breadcrumb in a layout points at the previous route.** Cause: the same mechanism as the stale filter — layouts do not re-render on navigation, so a pathname captured in a layout is stale for exactly the same reason a query param would be. Fix: `usePathname()` in a client component.

```tsx filename="app/ui/breadcrumbs.tsx"
'use client'
import { usePathname } from 'next/navigation'

export function Breadcrumbs() {
  return <nav aria-label="Breadcrumb">{usePathname()}</nav>
}
```

## Interview questions

**★ Why did `searchParams` become a promise, when the value is trivially available the moment the request arrives?**
Because making it a promise is what lets the framework start rendering *before* the value is needed. If the prop were synchronous, the render function could not begin until request data existed, so no part of that route could ever be produced ahead of a request. As a promise it can be created at build time, passed through the tree unresolved, and awaited only where it is genuinely needed — everything above that point completes during prerendering and lands in the static shell. The promise is not about asynchronous I/O; it is a marker saying "this value is request-time, suspend here, not at the top".

**★ Where in the tree should you await `searchParams`, and what changes if you get it wrong?**
As deep as possible, inside a `Suspense` boundary, and never in the page or layout component itself. Awaiting suspends the component you await in, so everything at or above that component is excluded from the shell. Awaiting at the top of the page means the shell is empty and every visitor pays a full server render before seeing anything; awaiting inside a leaf means the header, nav, filter bar and skeleton come off the CDN instantly and only the query-dependent list streams. The documentation states it directly: the deeper the async work sits, the more of the page can be prerendered.

**★ Does wrapping a component in `<Suspense>` make it dynamic?**
No, and believing it does leads to boundaries scattered in all the wrong places. `Suspense` provides a fallback while async work completes; it does not opt anything into dynamic rendering. A synchronous component wrapped in `Suspense` still completes during prerendering and still lands in the shell. The boundary matters because it marks where the prerender can *stop* — the fallback goes in the shell and the real content streams in later. So you place it around the component that awaits request data, and placing it anywhere else is a no-op that costs you a component and some indirection.

**★ Why do layouts not receive `searchParams`?**
Because layouts do not re-render during a client-side navigation — that is the point of the layout/page split and what makes navigation cheap. If a layout received `searchParams` it would receive them once and then hold a stale value across every later navigation, which is worse than not having them at all: it would be silently, plausibly wrong. Next.js removes the footgun by removing the prop. The supported reads are the page's own `searchParams` prop or `useSearchParams()` in a client component, because client components *do* re-render on navigation. The identical argument applies to `usePathname`.

**★ What is the difference between the "static shell" and the "App Shell"?**
The static shell is what a specific route prerenders when its inputs are known — for a route whose dynamic params come from `generateStaticParams`, it includes the concrete param-specific content, with any remaining uncached data still behind its fallback. The App Shell is the reusable, URL-independent version: the same shell with the param-specific parts left behind their fallbacks, used when the params are not known ahead of time. ISR fills in the concrete versions after the first visit. The distinction matters for prefetching, because Partial Prefetching prefetches the App Shell by default — see [03d](03d-prefetching-query-driven-routes-and-opting-out.md).

**★ Your route prerenders on a direct visit but the dev overlay still complains. What is it checking?**
The client-navigation path. Cache Components shipped in 16.0 verifying that direct visits produce a shell; 16.3 added validation of navigations, because a `Suspense` boundary that covers a direct visit may not be part of the render during a transition. The two checks look at different renders of the same route, so a structure can pass one and fail the other. The fixes are the same three moves — wrap in `Suspense`, cache it with `use cache`, or move where the access happens — applied at whichever point the transition render is missing one.

---

← [03 · URL as state — the store you already ship](03-url-as-state-searchparams-nuqs-style-patterns-shareable-filt.md) · [Chapter 8 overview](01-explanation.md) · Next → [03c · Caching query-driven routes](03c-caching-query-driven-routes.md)
