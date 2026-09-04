---
title: "Both URL hooks are Client-only by design, and both can force a Suspense boundary — useSearchParams fails the production build without one on a prerendered route, and usePathname suspends under Cache Components whenever the params are not known at build time"
sidebar_label: "04j · usePathname and useSearchParams"
sidebar_position: 148
description: "Why reading the URL from a Server Component is intentionally unsupported, what each hook returns including the empty-value and repeated-key edge cases, and exactly when each one requires a Suspense boundary — plus why development never shows you."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-04 against the Next.js [`useSearchParams`](https://nextjs.org/docs/app/api-reference/functions/use-search-params) reference (`lastUpdated: 2026-07-14`), [`usePathname`](https://nextjs.org/docs/app/api-reference/functions/use-pathname) (`lastUpdated: 2026-06-09`) and [Linking and Navigating](https://nextjs.org/docs/app/getting-started/linking-and-navigating) (`lastUpdated: 2026-08-25`).
> Target: **Next.js 16.3.4** · both hooks since **v13.0.0**. Documentation-verified — **no sandbox run**.

**The question worth settling first, because it is the one people guess at: yes, both hooks can force a `Suspense` boundary, and the two cases are different. `useSearchParams` on a *prerendered* route causes the Client Component tree up to the nearest boundary to be client-side rendered, and a production build of a static page that calls it without a boundary **fails** with an explicit error. `usePathname` is fine on static routes and on routes covered by `generateStaticParams`, but under `cacheComponents` it **suspends** on any route whose dynamic param is not known until request time — and the build fails there too. Both are invisible in `next dev`, because development renders routes on demand, which is exactly why this lands as a CI failure on a Friday rather than as a local error on a Tuesday. What you do with the values once you have them — the `searchParams` prop, updating the URL, and the rewrite hydration trap — is [04k](04k-query-state-in-practice.md).**

## Client-only, on purpose

> *"`usePathname` intentionally requires using a Client Component. It's important to note Client Components are not a de-optimization. They are an integral part of the Server Components architecture."*

> *"Reading the current URL from a Server Component is not supported. This design is intentional to support layout state being preserved across page navigations."*

That second sentence is the whole rationale. A layout is not re-rendered on navigation — that is what makes client-side transitions cheap — so if a layout could read the URL on the server, it would hold a value that went stale the moment the user navigated. `useSearchParams` carries the mirror-image note: it is *"not supported in Server Components to prevent stale values during partial rendering."*

The compensating property is that a Client Component reading the pathname is not re-fetched on navigation:

> *"For example, a Client Component with `usePathname` will be rendered into HTML on the initial page load. When navigating to a new route, this component does not need to be re-fetched. Instead, the component is downloaded once (in the client JavaScript bundle), and re-renders based on the current state."*

## What each returns

`usePathname` returns a string, and drops the query:

| URL | Returned value |
| --- | --- |
| `/` | `'/'` |
| `/dashboard` | `'/dashboard'` |
| `/dashboard?v=2` | `'/dashboard'` |
| `/blog/hello-world` | `'/blog/hello-world'` |

`useSearchParams` returns *"a **read-only** version of the `URLSearchParams` interface"*, and the edge cases in its own table are worth memorising because they are the source of two silent bugs:

| URL | `searchParams.get("a")` |
| --- | --- |
| `/dashboard?a=1` | `'1'` |
| `/dashboard?a=` | `''` |
| `/dashboard?b=3` | `null` |
| `/dashboard?a=1&a=2` | `'1'` — use `getAll()` to get all values |

`?a=` returns the empty string, not `null`, so `if (searchParams.get('a'))` treats "present but empty" as absent. And a repeated key silently yields only the first value.

```tsx title="app/dashboard/search-bar.tsx"
'use client'

import { useSearchParams } from 'next/navigation'

export default function SearchBar() {
  const searchParams = useSearchParams()
  const search = searchParams.get('search')

  // URL -> `/dashboard?search=my-project`
  // `search` -> 'my-project'
  return <>Search: {search}</>
}
```

## 🔴 `useSearchParams` and the Suspense boundary

The rule, verbatim:

> *"If a route is prerendered, calling `useSearchParams` will cause the Client Component tree up to the closest `Suspense` boundary to be client-side rendered."*

> *"We recommend wrapping the Client Component that uses `useSearchParams` in a `<Suspense/>` boundary. This will allow any Client Components above it to be prerendered and sent as part of initial HTML."*

and the part that turns a recommendation into a requirement:

> *"During production builds, a static page that calls `useSearchParams` from a Client Component must be wrapped in a `Suspense` boundary, otherwise the build fails with the Missing Suspense boundary with useSearchParams error."*

> *"In development, routes are rendered on-demand, so `useSearchParams` doesn't suspend and things may appear to work without `Suspense`."*

So the boundary is not optional on a prerendered route, and `next dev` will never tell you. The fix is mechanical:

```tsx title="app/dashboard/page.tsx"
import { Suspense } from 'react'
import SearchBar from './search-bar'

// This component passed as a fallback to the Suspense boundary
// will be rendered in place of the search bar in the initial HTML.
// When the value is available during React hydration the fallback
// will be replaced with the `<SearchBar>` component.
function SearchBarFallback() {
  return <>placeholder</>
}

export default function Page() {
  return (
    <>
      <nav>
        <Suspense fallback={<SearchBarFallback />}>
          <SearchBar />
        </Suspense>
      </nav>
      <h1>Dashboard</h1>
    </>
  )
}
```

If the route is meant to be dynamic anyway, the boundary is not the answer:

> *"If you intend the route to be dynamically rendered, prefer using the `connection` function first in a Server Component to wait for an incoming request, this excludes everything below from prerendering."*

```tsx title="app/dashboard/page.tsx"
import { connection } from 'next/server'
import SearchBar from './search-bar'

export default async function Page() {
  await connection()
  return (
    <>
      <nav>
        <SearchBar />
      </nav>
      <h1>Dashboard</h1>
    </>
  )
}
```

> *"Previously, setting `export const dynamic = 'force-dynamic'` on the page was used to force dynamic rendering. Prefer using `connection()` instead, as it semantically ties dynamic rendering to the incoming request."*

Once a route is dynamically rendered, the hook is available server-side during the initial render: *"If a route is dynamically rendered, `useSearchParams` will be available on the server during the initial server render of the Client Component."*

## 🔴 `usePathname` and the Suspense boundary

Different trigger, same shape of failure, and it only applies with Cache Components on:

> *"When `cacheComponents` is enabled, `usePathname` may require a `Suspense` boundary. This depends on whether the pathname can be resolved during prerendering."*

> *"**Static routes and routes with `generateStaticParams`**: every route segment, including dynamic params, is known at build time. The pathname can be resolved during prerendering, so `usePathname` resolves on the server and no `Suspense` boundary is required."*

> *"**Routes with dynamic params not covered by `generateStaticParams`**: the param is a fallback param that is not known until request time. The pathname cannot be resolved during prerendering, so `usePathname` suspends. Wrap the component (or a parent) in a `Suspense` boundary so its fallback can be rendered during prerendering; otherwise, the build fails."*

The sting is in the next paragraph, because it means the component that suspends is not the component with the problem:

> *"This applies even when the component that calls `usePathname` is itself static. For example, a sidebar with active links rendered in a layout suspends on any page below it that has an unknown dynamic param. To keep the rest of the layout prerendered, wrap the component that calls `usePathname` (or a parent) in a `Suspense` boundary with a fallback."*

An active-link sidebar is completely static, and it will suspend because of a page three levels below it. That is the argument for isolating the pathname read into the smallest possible component:

```tsx title="app/ui/sidebar.tsx"
import { Suspense } from 'react'
import { ActiveLinks } from './active-links' // 'use client', calls usePathname

export function Sidebar() {
  return (
    <aside>
      <h2>Project</h2>
      <Suspense fallback={<nav aria-hidden className="nav-skeleton" />}>
        <ActiveLinks />
      </Suspense>
    </aside>
  )
}
```

Both hooks point at the same error page for the full menu of options: [Next.js encountered URL data in a Client Component outside of Suspense](https://nextjs.org/docs/messages/blocking-prerender-client-hook).

## Gotchas

**★ Symptom: the production build fails with *Missing Suspense boundary with useSearchParams*, and everything worked in `next dev`.** Cause: development renders routes on demand so the hook never suspends; a production build of a prerendered page requires the boundary. Fix: wrap the component that calls the hook.

```tsx
<Suspense fallback={<SearchBarFallback />}>
  <SearchBar />
</Suspense>
```

**★ Symptom: after enabling `cacheComponents`, the build fails on a sidebar that has not changed in months.** Cause: the sidebar calls `usePathname`, and a page below it has a dynamic param not covered by `generateStaticParams`, so the pathname cannot be resolved at prerender and the hook suspends — *"even when the component that calls `usePathname` is itself static."* Fix: wrap that component in a boundary so the rest of the layout still prerenders.

```tsx
<Suspense fallback={<nav aria-hidden className="nav-skeleton" />}>
  <ActiveLinks />
</Suspense>
```

**★ Symptom: `export const dynamic = 'force-dynamic'` was added to escape the Suspense requirement and the page is now dynamic everywhere.** Cause: it is the blunt instrument, and the docs now prefer a narrower one. Fix: `await connection()` in the Server Component, which ties dynamic rendering to the incoming request semantically rather than to a global flag.

```tsx
import { connection } from 'next/server'

export default async function Page() {
  await connection()
  return <SearchBar />
}
```

**★ Symptom: `useSearchParams()` is typed as possibly `null` and TypeScript rejects `.get()`.** Cause: *"If an application includes the `/pages` directory, `useSearchParams` will return `ReadonlyURLSearchParams | null`"* — a migration compatibility affordance, because search params cannot be known during prerendering of a Pages Router page without `getServerSideProps`. Fix: narrow it, and remember the `null` disappears once `/pages` is gone.

```ts
const searchParams = useSearchParams()
const q = searchParams?.get('q') ?? ''
```

**Symptom: a component using `usePathname` returns `null` in a Pages Router route.** Cause: the same compatibility layer — `usePathname` *"may return `null` if the router is not yet initialized"*, in cases such as fallback routes or Automatic Static Optimization. Fix: guard the value in any component shared between the two routers.

**★ Symptom: you added the `Suspense` boundary and now the whole page is client-rendered.** Cause: the boundary was placed around the page rather than around the component that reads the URL. The rule is that the tree *up to the closest boundary* is client-side rendered, so a boundary at the top of the page means the whole page qualifies. Fix: wrap the smallest component that calls the hook — the reference's stated benefit is that this *"will allow any Client Components above it to be prerendered and sent as part of initial HTML."*

```tsx
// 🚩 everything under here is client-rendered
<Suspense fallback={<PageSkeleton />}>
  <Nav />
  <SearchBar />
  <Results />
</Suspense>

// ✅ only the search bar is
<nav>
  <Suspense fallback={<SearchBarFallback />}>
    <SearchBar />
  </Suspense>
</nav>
```

**★ Symptom: a shared component builds fine on one page and fails the build on another.** Cause: the Suspense requirement follows the *route*, not the component. A component calling `useSearchParams` is fine on a dynamically rendered page and fails on a prerendered one, so the same import can be safe in one place and a build error in another. Fix: give the component its own boundary at its own definition site so it is safe everywhere, rather than relying on each consumer to remember.

```tsx title="app/ui/search-bar.tsx"
import { Suspense } from 'react'
import { SearchBarInner } from './search-bar-inner' // 'use client'

export function SearchBar() {
  return (
    <Suspense fallback={<span className="search-skeleton" />}>
      <SearchBarInner />
    </Suspense>
  )
}
```

**Symptom: the page jumps as the search bar hydrates.** Cause: `fallback={null}` renders nothing, so the element has no space in the initial HTML and appears when hydration completes. Fix: give the fallback the same box as the real component — the documented example passes a `SearchBarFallback` placeholder rather than `null` precisely so something occupies that slot in the initial HTML.

## Interview questions

**★ Does `useSearchParams` force a Suspense boundary? Answer precisely.**
On a prerendered route, yes — and the failure is a build failure, not a runtime one. Calling it causes the Client Component tree up to the nearest `Suspense` boundary to be client-side rendered, and a production build of a static page that calls it without a boundary fails with *Missing Suspense boundary with useSearchParams*. On a dynamically rendered route it does not suspend and is available on the server during the initial render. And in development nothing happens either way, because routes are rendered on demand — which is why this is a CI discovery rather than a local one.

**★ And `usePathname`? When does that need a boundary?**
Only with `cacheComponents` enabled, and only when the pathname cannot be resolved during prerendering. Static routes and routes covered by `generateStaticParams` resolve on the server and need nothing. A route with a dynamic param that is a fallback param — not known until request time — makes the hook suspend, and without a boundary the build fails. The trap is that this applies even when the calling component is itself completely static: a layout sidebar with active links suspends because of a page below it.

**★ Why is reading the URL from a Server Component unsupported?**
Because layouts are not re-rendered during navigation — that is what makes client-side transitions cheap — so a server-side URL read inside a layout would be correct once and stale from the first navigation onwards. The docs call the restriction intentional and say it exists *to support layout state being preserved across page navigations*. `useSearchParams` carries the same rationale phrased as preventing stale values during partial rendering. The compensation is that a Client Component reading the URL is downloaded once and re-renders from client state, so it is not re-fetched per navigation.

**★ Someone hits the `useSearchParams` build error and adds `export const dynamic = 'force-dynamic'`. What is wrong with that?**
It works and it over-corrects: the whole route is now dynamically rendered, losing prerendering for everything on the page, not just the part that reads the URL. If the component really should be client-rendered, the boundary is the right fix and keeps the rest prerendered. If the route genuinely is dynamic, the docs now prefer `await connection()` in a Server Component, because it ties dynamic rendering to the incoming request rather than to a page-wide flag.

**★ Where exactly do you put the `Suspense` boundary, and why not at the top of the page?**
Around the smallest component that reads the URL. The rule is that the Client Component tree *up to the closest boundary* gets client-side rendered, so a boundary wrapping the whole page opts the whole page out of prerendering and you have traded a build error for a performance regression. The reference states the benefit of placing it tightly: Client Components above the boundary can still be prerendered and sent in the initial HTML. And give the fallback the same footprint as the real component, or you have swapped a hydration error for layout shift.

**A shared component using `useSearchParams` builds on one page and breaks the build on another. Why?**
Because the requirement belongs to the route, not to the component. On a dynamically rendered route the hook does not suspend and is available on the server during the initial render; on a prerendered route it forces client-side rendering up to the nearest boundary, and a production build with no boundary fails. So the same import is safe in one place and fatal in another. The robust fix is to ship the boundary *with* the component, at its definition site, rather than documenting a rule every consumer has to remember.

---

← [04i · `not-found.js` and the status](04i-the-not-found-boundary-and-the-404-status.md) · [Chapter 2 overview](01-explanation.md) · Next → [04k · Query state in practice](04k-query-state-in-practice.md)
