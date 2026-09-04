---
title: "useSearchParams cannot resolve during prerendering, so it client-side renders everything up to the nearest Suspense boundary — and with no boundary, that is the entire route"
sidebar_label: "03e · Reading the URL from a client component"
sidebar_position: 123
description: "What useSearchParams returns, why the prerender bailout propagates up to the closest Suspense boundary, why the failure is invisible in next dev, the five navigation hooks that trigger the blocking-prerender insight, and why pushing the read into a leaf beats wrapping the world."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-05 against [`useSearchParams`](https://nextjs.org/docs/app/api-reference/functions/use-search-params) (`lastUpdated: 2026-07-14`),
> [`layout.js`](https://nextjs.org/docs/app/api-reference/file-conventions/layout) (`lastUpdated: 2026-05-27`) and
> [Next.js encountered URL data in a Client Component outside of Suspense](https://nextjs.org/docs/messages/blocking-prerender-client-hook).
> Target: **Next.js 16.3.4** App Router · **React 19.2.8**.
> Documentation-verified; **no sandbox run**.

**A filter bar is a client component, so it reads the URL with `useSearchParams()` — and that one hook is the single most effective way to accidentally turn a server-rendered page into a client-rendered one. Search params come from the request URL, so they do not exist during prerendering; React responds by client-side rendering the tree *up to the closest `Suspense` boundary*. With no boundary, the closest boundary is the route root. A two-line "active tab" highlight in a nav bar can therefore cost you the server HTML of the entire page, and the failure is invisible in `next dev`.**

## What the hook is and what it returns

```tsx filename="app/[tenant]/board/status-chip.tsx"
'use client'

import { useSearchParams } from 'next/navigation'

export function StatusChip({ value, label }: { value: string; label: string }) {
  const searchParams = useSearchParams()
  const active = (searchParams.get('status') ?? 'open') === value
  return <span aria-current={active ? 'page' : undefined}>{label}</span>
}
```

> *"`useSearchParams` is a **Client Component** hook that lets you read the current URL's **query string**."*
> *"`useSearchParams` returns a **read-only** version of the `URLSearchParams` interface."*
> — [`useSearchParams`](https://nextjs.org/docs/app/api-reference/functions/use-search-params)

It takes no parameters and it is not available on the server. The docs give the reason, and it is the same reason layouts do not get `searchParams`:

> *"`useSearchParams` is a Client Component hook and is **not supported** in Server Components to prevent stale values during partial rendering."*
> — [`useSearchParams`, Good to know](https://nextjs.org/docs/app/api-reference/functions/use-search-params)

Read-only means read-only: `set`, `append` and `delete` are not on the returned object. To *write* a param you construct a fresh `URLSearchParams` from `searchParams.toString()` and navigate — see [03f](03f-url-as-state-writing-declaratively.md).

The recommendation in the same block is worth taking seriously before you reach for the hook at all:

> *"If you want to fetch data in a Server Component based on search params, it's often a better option to read the `searchParams` prop of the corresponding Page. You can then pass it down by props to any component (Server or Client) within that Page."*
> — same section

## The bailout, precisely

> *"If a route is prerendered, calling `useSearchParams` will cause the Client Component tree up to the closest `Suspense` boundary to be client-side rendered."*
> — [`useSearchParams`, Prerendering](https://nextjs.org/docs/app/api-reference/functions/use-search-params#prerendering)

Parse "up to the closest `Suspense` boundary" as *everything between this component and the nearest boundary above it, inclusive*. There are only two cases:

| Boundary above the hook? | What renders on the client |
|---|---|
| Yes, immediately around it | Just that component; everything else is prerendered HTML |
| Yes, but at the top of the layout | The whole layout subtree |
| No | The entire client tree of the route |

> *"This allows a part of the route to be prerendered while the dynamic part that uses `useSearchParams` is client-side rendered."*
> *"We recommend wrapping the Client Component that uses `useSearchParams` in a `<Suspense/>` boundary. This will allow any Client Components above it to be prerendered and sent as part of initial HTML."*
> — same section

```tsx filename="app/[tenant]/board/page.tsx"
import { Suspense } from 'react'
import { StatusChip } from './status-chip'

// This component passed as a fallback will be rendered in place of the
// chip in the initial HTML, and swapped for the real one at hydration.
function ChipFallback() {
  return <span>Open</span>
}

export default function BoardPage() {
  return (
    <>
      <nav>
        <Suspense fallback={<ChipFallback />}>
          <StatusChip value="open" label="Open" />
        </Suspense>
      </nav>
      <h1>Board</h1>
    </>
  )
}
```

**Choose a fallback that occupies the same space as the real thing.** The fallback is what a first-time visitor sees in the HTML and what a crawler indexes; `null` is legal and produces a layout shift the moment hydration lands.

## The failure is invisible in development

> *"In development, routes are rendered on-demand, so `useSearchParams` doesn't suspend and things may appear to work without `Suspense`."*
> *"During production builds, a static page that calls `useSearchParams` from a Client Component must be wrapped in a `Suspense` boundary, otherwise the build fails with the `Missing Suspense boundary with useSearchParams` error."*
> — [`useSearchParams`, Prerendering](https://nextjs.org/docs/app/api-reference/functions/use-search-params#prerendering)

This is one of the few Next.js errors where "it works locally" carries *no* information. A team that only runs the dev server ships the bailout and never sees a warning until a build fails or someone views source.

## Under Cache Components it is an insight, and it covers five hooks

> *"During prerendering, a Client Component called a navigation hook (`usePathname`, `useParams`, `useSearchParams`, `useSelectedLayoutSegment`, or `useSelectedLayoutSegments`) outside of a `<Suspense>` boundary. With Cache Components enabled, Next.js prerenders as much of a route as possible before a request arrives. These hooks read URL data that is not available during prerendering, so the component needs a fallback to include in the static shell."*
> — [Next.js encountered URL data in a Client Component outside of Suspense](https://nextjs.org/docs/messages/blocking-prerender-client-hook)

> *"The `useSearchParams` hook triggers this error on any prerendered route because search params come from the request URL. The other four hooks trigger it when the route has dynamic params and is rendered per-request."*
> — same page

So `useSearchParams` is the strict case — *any* prerendered route — while `usePathname` and friends only bite on per-request dynamic routes. If you have been wrapping `usePathname` defensively everywhere and wondering why nothing changed, that asymmetry is why.

The page offers exactly two fixes: *"Wrap in or move into Suspense"* and *"Allow blocking route"* (`export const instant = false`, covered in [03d](03d-prefetching-query-driven-routes-and-opting-out.md)). Server-side request reads have a different error and different fixes — do not apply this page's advice to `cookies()`.

## Push the read down rather than wrapping the world

The better fix is usually not a bigger boundary but a smaller component. The docs' own example moves the read into a leaf, so the nav itself stays prerendered:

```jsx filename="app/nav.js"
import { Suspense } from 'react'
import Link from 'next/link'
import { ActiveDot } from './active-dot'

export function Nav() {
  return (
    <nav>
      <Link href="/dashboard">
        Dashboard
        <Suspense>
          <ActiveDot href="/dashboard" />
        </Suspense>
      </Link>
      <Link href="/settings">
        Settings
        <Suspense>
          <ActiveDot href="/settings" />
        </Suspense>
      </Link>
    </nav>
  )
}
```

```jsx filename="app/active-dot.js"
'use client'

import { usePathname } from 'next/navigation'

export function ActiveDot({ href }) {
  const pathname = usePathname()
  const isActive = pathname === href || pathname.startsWith(`${href}/`)
  return isActive ? <span aria-hidden="true"> •</span> : null
}
```

— from the same error page, under *"Push the hook read down to the leaf"*: *"When the hook is read at the top of the tree but only one piece of UI depends on the value, move the read down. The parent stays prerenderable and only the leaf needs a boundary."*

## The alternative: pass the value down as a prop

The hook is not the only way for a client component to know the filter. The page already has it, and props cross the server/client boundary fine:

```tsx filename="app/[tenant]/board/page.tsx"
import { Suspense } from 'react'
import { FilterBar } from './filter-bar'

export default function BoardPage(props: PageProps<'/[tenant]/board'>) {
  return (
    <Suspense fallback={<FilterBarSkeleton />}>
      <FilterSection searchParams={props.searchParams} />
    </Suspense>
  )
}

async function FilterSection({
  searchParams,
}: Pick<PageProps<'/[tenant]/board'>, 'searchParams'>) {
  const { status = 'open' } = await searchParams
  return <FilterBar active={Array.isArray(status) ? status[0] : status} />
}
```

```tsx filename="app/[tenant]/board/filter-bar.tsx"
'use client'

// No hook, no bailout: the value arrives as a prop, already normalised.
export function FilterBar({ active }: { active: string }) {
  return <nav aria-label="Filter">{/* chips styled from `active` */}</nav>
}
```

This is strictly better whenever the value needed parsing or validating, because the parse happens once, on the server, in the place that already has a schema. Reach for `useSearchParams()` when the component is not reachable from the page by props — something inside a layout, or a widget mounted by a portal.

## Gotchas

**★ Symptom: `next build` fails with `Missing Suspense boundary with useSearchParams`, and the page worked all week in `next dev`.** Cause: development renders on demand so the hook never suspends; a production prerender has no URL to give it. Fix: wrap the component that calls the hook.

```tsx
<Suspense fallback={<ChipFallback />}>
  <StatusChip value="open" label="Open" />
</Suspense>
```

**★ Symptom: adding an "active tab" highlight made the whole page client-rendered and the HTML source went nearly empty.** Cause: the bailout propagates up to the *closest* boundary, and there was none between the hook and the route root. Fix: push the read into the smallest possible leaf and wrap that leaf.

```tsx
// ❌ the hook is at the top of a large client component
'use client'
export function Nav() { const p = useSearchParams(); /* the whole nav is CSR */ }

// ✅ the hook is in a two-line leaf with its own boundary
<nav>
  <Link href="/board">Board<Suspense><ActiveDot param="status" /></Suspense></Link>
</nav>
```

**★ Symptom: `searchParams.set is not a function` in a client component.** Cause: the hook returns a **read-only** `URLSearchParams`; mutators are absent by design. Fix: copy it before mutating.

```tsx
const params = new URLSearchParams(searchParams.toString())
params.set('status', 'blocked')
router.replace(`${pathname}?${params.toString()}`, { scroll: false })
```

**★ Symptom: the chip flashes the wrong label on first paint, then corrects itself.** Cause: the `Suspense` fallback renders something different from the real component and there was no attempt to make them match. Fix: make the fallback the most likely real value, or a neutral placeholder of the same size.

```tsx
function ChipFallback() {
  return <span>Open</span>          // the default filter, not `null`
}
```

**★ Symptom: `?a=1&a=2` highlights only one chip on the client but the server filtered by both.** Cause: `useSearchParams().get()` returns the *first* value for a repeated key while the server prop gives the full array. Fix: use `getAll()` when a key is genuinely repeatable.

```tsx
const statuses = searchParams.getAll('status')   // ['open', 'done']
const active = statuses.includes(value)
```

**★ Symptom: a component in a layout shows the value from the previous route.** Cause: the layout is a Server Component and computed the value once, passing it down as a frozen prop — layouts do not re-render on navigation. Fix: read the hook in the client component itself rather than accepting a server-computed prop from a layout.

```tsx filename="app/[tenant]/board/filter-badge.tsx"
'use client'
import { useSearchParams } from 'next/navigation'

export function FilterBadge() {
  return <span>{useSearchParams().get('status') ?? 'open'}</span>
}
```

**★ Symptom: you wrapped `usePathname` in `Suspense` everywhere and nothing about the build changed.** Cause: only `useSearchParams` triggers the insight on *any* prerendered route; the other four navigation hooks trigger it only when the route has dynamic params and is rendered per-request. Fix: read the insight, identify which hook on which route it names, and wrap that one — defensive boundaries elsewhere are noise you will maintain forever.

**★ Symptom: a client component gets `null` from `useSearchParams()` and the types say that is possible.** Cause: the application also contains a `/pages` directory. Fix: handle the null, or finish the migration.

> *"If an application includes the `/pages` directory, `useSearchParams` will return `ReadonlyURLSearchParams | null`. The `null` value is for compatibility during migration since search params cannot be known during prerendering of a page that doesn't use `getServerSideProps`"*
> — [`useSearchParams`, Good to know](https://nextjs.org/docs/app/api-reference/functions/use-search-params)

## Interview questions

**★ Why does `useSearchParams` require a `Suspense` boundary, and what exactly happens without one?**
Search params come from the request URL, so they do not exist during prerendering. When a prerendered route calls the hook, React cannot resolve it on the server and instead client-side renders the tree *up to the closest `Suspense` boundary*. Without a boundary, "up to the closest boundary" means up to the route root, so the entire client tree renders in the browser — you lose the server HTML for everything above the hook, not just the component that called it. In a production build of a static page this fails outright with `Missing Suspense boundary with useSearchParams`; under Cache Components it surfaces as a blocking-prerender insight naming the route.

**★ Why does the problem never appear in `next dev`?**
Because development renders routes on demand, per request, so a URL always exists when the hook runs and it never suspends — the docs state this explicitly. That makes it one of the few Next.js errors where "works locally" carries no information at all. The correct verification is a production build; a team that only ever runs the dev server ships the bailout and finds out from a failing build or from someone viewing source.

**★ Which navigation hooks trigger the blocking-prerender insight, and are they equivalent?**
Five: `usePathname`, `useParams`, `useSearchParams`, `useSelectedLayoutSegment` and `useSelectedLayoutSegments`. They are not equivalent. `useSearchParams` triggers it on *any* prerendered route, because search params always come from the request URL and can never be known ahead of time. The other four trigger it only when the route has dynamic params and is rendered per-request — on a fully static route the pathname and segments are known at build time, so they resolve. That asymmetry explains why blanket-wrapping `usePathname` changes nothing while forgetting one `useSearchParams` breaks a build.

**★ When should a client component read `useSearchParams()` and when should it take a prop?**
Take a prop whenever the component is reachable from the page by props, which is most of the time. The page already receives `searchParams`, it is the natural place to parse and validate them, and a prop crosses the server/client boundary without any prerendering consequence at all — no bailout, no boundary, no fallback to design. Reach for the hook when the component is not reachable that way: something rendered inside a layout, which never receives `searchParams`; a widget mounted through a portal; a shared component used on many routes that cannot assume a particular page's props. The hook is the escape hatch, not the default.

**★ What does "read-only" mean for the object `useSearchParams` returns, and how do you update a param?**
It returns a read-only view of the `URLSearchParams` interface — `get`, `getAll`, `has`, `keys`, `values`, `entries`, `forEach` and `toString` are there; `set`, `append` and `delete` are not. To change a param you serialise the current value with `toString()`, build a fresh mutable `URLSearchParams` from it, apply your change, and navigate to the new query string. That the object is immutable is deliberate: the URL is owned by the router, and mutating a snapshot of it would produce a value that no longer describes the page.

**★ Why can a component in a layout appear to show a stale query value even though client components re-render on navigation?**
Because the staleness is not in the client component — it is in the prop. Layouts are Server Components that do not re-render on navigation, so if a layout computes something and passes it down, that value is frozen at the first render regardless of how often the child re-renders. A client component that reads `useSearchParams()` itself is always current, because client components *do* re-render on navigation. The rule is that a query-derived value must be read at or below the point that re-renders, never captured above it.

---

← [03d · Prefetching query-driven routes, and opting out](03d-prefetching-query-driven-routes-and-opting-out.md) · [Chapter 8 overview](01-explanation.md) · Next → [03f · Writing the URL declaratively](03f-url-as-state-writing-declaratively.md)
