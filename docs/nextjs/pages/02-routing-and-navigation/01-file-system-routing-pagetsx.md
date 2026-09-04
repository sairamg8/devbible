---
title: "A route segment in the App Router is not one component but a stack of six reserved filenames composed in a fixed order, and that order is the whole reason a boundary catches what it catches"
sidebar_label: "01 · Special files"
sidebar_position: 1
description: "The App Router's reserved filenames, the exact order they compose in, why page.tsx is the only routable leaf, and which of the special files receive params and searchParams."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-04 against the Next.js file-convention references — [`page.js`](https://nextjs.org/docs/app/api-reference/file-conventions/page) (`lastUpdated: 2026-06-09`), [Project structure](https://nextjs.org/docs/app/getting-started/project-structure) (`2026-07-21`), [Route Handlers](https://nextjs.org/docs/app/getting-started/route-handlers) (`2026-03-03`), [`loading.js`](https://nextjs.org/docs/app/api-reference/file-conventions/loading) (`2026-06-08`), [`not-found.js`](https://nextjs.org/docs/app/api-reference/file-conventions/not-found) (`2026-07-10`) and the [version 16 upgrade guide](https://nextjs.org/docs/app/guides/upgrading/version-16) (`2026-08-25`).
> Target: **Next.js 16.3.4** (the `version:` field the docs site serves on every page). Documentation-verified — **no sandbox run**.

**Folders in `app/` decide the URL. Files inside a folder decide the *roles* that segment plays. There are only a handful of reserved names, but they are not siblings in a list — they are nested inside one another in a fixed order, and every confusing thing about the App Router (why `error.tsx` will not catch the crash in the layout next to it, why `loading.tsx` never appears when the layout is slow, why a template remounts and a layout does not) falls straight out of that order. Learn the stack once and you stop guessing.**

## Folders are segments; files are roles

A route is a path through folders. It only becomes reachable when you add a file that produces a response.

> *"However, even though route structure is defined through folders, a route is **not publicly accessible** until a `page.js` or `route.js` file is added to a route segment."*
> — [Project structure](https://nextjs.org/docs/app/getting-started/project-structure#colocation)

That single rule is why colocation is safe: a `queries.ts`, a `columns.tsx` or a `use-filters.ts` can sit inside `app/dashboard/` and never become a URL. The reserved names, and the extensions each accepts, are fixed:

| File | Extensions | Role |
|---|---|---|
| `layout` | `.js` `.jsx` `.tsx` | Shared UI that wraps the segment and everything below it |
| `page` | `.js` `.jsx` `.tsx` | The leaf UI for exactly this URL |
| `loading` | `.js` `.jsx` `.tsx` | Suspense fallback for the segment |
| `not-found` | `.js` `.jsx` `.tsx` | UI for `notFound()` thrown in the segment |
| `error` | `.js` `.jsx` `.tsx` | React error boundary for the segment |
| `global-error` | `.js` `.jsx` `.tsx` | Error boundary that replaces the root layout |
| `route` | `.js` `.ts` | An HTTP endpoint — no JSX |
| `template` | `.js` `.jsx` `.tsx` | Like a layout, but re-mounted per navigation |
| `default` | `.js` `.jsx` `.tsx` | Fallback page for an unmatched parallel-route slot |

(Transcribed from the *Routing Files* table on the Project structure page. `.ts` on `route` and not on the JSX files is not a typo — a route handler returns a `Response`, never markup.)

`page` and `route` compete for the same URL, so they cannot share a segment:

> *"There **cannot** be a `route.js` file at the same route as `page.js`."*
> — [Route Handlers](https://nextjs.org/docs/app/getting-started/route-handlers#route-resolution)

| Page | Route | Result |
|---|---|---|
| `app/page.js` | `app/route.js` | ✗ Conflict |
| `app/page.js` | `app/api/route.js` | ✓ Valid |
| `app/[user]/page.js` | `app/api/route.js` | ✓ Valid |

## The composition order — memorise this list, not the diagrams

The docs state the hierarchy as a flat list, outermost first:

> *"The components defined in special files are rendered in a specific hierarchy:*
> *• `layout.js` • `template.js` • `error.js` (React error boundary) • `loading.js` (React suspense boundary) • `not-found.js` (React error boundary for "not found" UI) • `page.js` or nested `layout.js`"*
> — [Project structure › Component hierarchy](https://nextjs.org/docs/app/getting-started/project-structure#component-hierarchy)

Written out as the tree Next.js actually builds for one segment:

```jsx
// pseudo-code — the shape Next.js composes for a single route segment
<Layout>            {/* layout.tsx      — persists across navigation      */}
  <Template>        {/* template.tsx    — new key per navigation          */}
    <ErrorBoundary> {/* error.tsx       — 'use client'                    */}
      <Suspense>    {/* loading.tsx     — the fallback                    */}
        <NotFoundBoundary>  {/* not-found.tsx                             */}
          <Page />          {/* page.tsx — or the next segment's Layout   */}
        </NotFoundBoundary>
      </Suspense>
    </ErrorBoundary>
  </Template>
</Layout>
```

And then, crucially:

> *"The components are rendered recursively in nested routes, meaning the components of a route segment will be nested **inside** the components of its parent segment."*

So for `/dashboard/settings` the whole six-file stack of `app/` wraps the whole six-file stack of `app/dashboard/`, which wraps the stack of `app/dashboard/settings/`. Three consequences you will meet in production, each with its own chunk:

- A boundary sits **inside** the layout of its own segment, so it cannot catch that layout — that is the parent boundary's job. See [01e · Error and not-found boundaries](01e-error-and-not-found-boundaries.md).
- `loading.tsx` is inside `layout.tsx` too, so a slow layout is invisible to it. See [01d · loading.tsx](01d-loading-tsx-and-the-suspense-boundary.md).
- `template.tsx` sits between the layout and everything below it, which is exactly why one remounts and the other does not. See [01c · Layout vs template](01c-layout-vs-template.md).

## `page.tsx` — the leaf

```tsx title="app/blog/[slug]/page.tsx"
export default async function Page(props: PageProps<'/blog/[slug]'>) {
  const { slug } = await props.params
  const { preview } = await props.searchParams

  return (
    <article>
      <h1>{slug}</h1>
      {preview === '1' ? <p>Draft preview</p> : null}
    </article>
  )
}
```

Four rules the reference states outright:

> *"A `page` is always the **leaf** of the route subtree."*
> *"A `page` file is required to make a route segment **publicly accessible**."*
> *"Pages are Server Components by default, but can be set to a Client Component."*
> *"In the component hierarchy, `page.js` is the innermost file convention. It is wrapped by `loading.js` (Suspense boundary), `error.js` (error boundary), `template.js`, and `layout.js` in the same segment."*
> — [`page.js`](https://nextjs.org/docs/app/api-reference/file-conventions/page#good-to-know)

**`page.tsx` is the only file that receives `searchParams`.** It is also, along with `layout.tsx`, `route.ts` and `default.tsx`, one of the files that receives `params`. Both props are promises, and since Next.js 16 there is no synchronous escape hatch left:

> *"Starting with **Next.js 16**, synchronous access is fully removed. These APIs can only be accessed asynchronously."* — listing `cookies`, `headers`, `draftMode`, `params` in `layout.js` / `page.js` / `route.js` / `default.js` and the metadata image files, and `searchParams` in `page.js`.
> — [Upgrade to version 16 › Async Request APIs](https://nextjs.org/docs/app/guides/upgrading/version-16#async-request-apis-breaking-change)

Two facts about `searchParams` that cost people an afternoon each:

> *"`searchParams` is a **Request-time API** whose values cannot be known ahead of time. Using it will opt the page into **dynamic rendering** at request time."*
> *"`searchParams` is a plain JavaScript object, not a `URLSearchParams` instance."*

A Client Component page reads the same promise with React's `use`:

```tsx title="app/shop/page.tsx"
'use client'
import { use } from 'react'

export default function Page({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const filters = use(searchParams).filters
  return <p>Filtering by: {String(filters ?? 'nothing')}</p>
}
```

`PageProps<'/blog/[slug]'>` is a **globally available generated** helper — produced by `next dev`, `next build` or `next typegen`, not shipped inside the package, which is why a clean CI checkout that runs `tsc` before any Next.js command cannot resolve it.

## Which file gets which props

| File | `children` | `params` | `searchParams` | Other |
|---|---|---|---|---|
| `page` | — | ✓ (promise) | ✓ (promise) | — |
| `layout` | ✓ required | ✓ (promise) | ✗ never | named parallel slots as props |
| `template` | ✓ required | — | — | receives a generated `key` |
| `loading` | — | — | — | *"Loading UI components do not accept any parameters."* |
| `error` | — | — | — | `error`, `retry`, `reset` |
| `not-found` | — | — | — | *"do not accept any props"* |
| `default` | — | ✓ (promise) | — | — |

The `loading` and `not-found` cells are verbatim from [`loading.js` › Parameters](https://nextjs.org/docs/app/api-reference/file-conventions/loading#parameters) and [`not-found.js` › Props](https://nextjs.org/docs/app/api-reference/file-conventions/not-found#props). `layout.tsx` and its root-layout obligations are the subject of [01b](01b-layout-and-the-root-layout.md).

## Gotchas

**★ Symptom: the folder exists, the component exists, the URL 404s.** Cause: the segment has no `page.tsx` — or the default export is missing, or the file is named `Page.tsx` on a case-sensitive CI filesystem while your Mac happily served it. A route is not public until a `page` or `route` file exists in it. Fix — the file must default-export a component:

```tsx title="app/dashboard/settings/page.tsx"
export default function Page() {
  return <h1>Settings</h1>
}
```

**★ Symptom: `params.slug` is `undefined`, or TypeScript says `Property 'slug' does not exist on type 'Promise<…>'`.** Cause: destructuring `params` synchronously, which Next.js 15 tolerated and **Next.js 16 removed entirely**. Fix — await it, and make the component `async`:

```tsx
// ✗ throws in Next.js 16
export default function Page({ params }: { params: { slug: string } }) {
  return <h1>{params.slug}</h1>
}

// ✓
export default async function Page(props: PageProps<'/blog/[slug]'>) {
  const { slug } = await props.params
  return <h1>{slug}</h1>
}
```

The official codemod, `npx @next/codemod@latest next-async-request-api .`, rewrites this across a codebase — the docs note it handles `params` and `searchParams` property access in `page.js`, `layout.js`, `route.js` and `default.js` as well as `cookies()`, `headers()` and `draftMode()`.

**Symptom: a build error about two files resolving to the same path, naming `route.ts`.** Cause: `page.tsx` and `route.ts` in the same segment. Fix — move the handler down one segment:

```
app/orders/page.tsx        ✓ the UI at /orders
app/orders/api/route.ts    ✓ the endpoint at /orders/api
app/orders/route.ts        ✗ conflict with page.tsx
```

**Symptom: a helper in `app/dashboard/_components/table.tsx` is fine, but one in `app/dashboard/components/page.tsx` became a live URL.** Cause: colocation is safe for any filename *except* the reserved ones — `components/` is a real segment, and a `page.tsx` inside it is a real route at `/dashboard/components`. Fix — prefix the folder with an underscore to opt the whole subtree out of routing (`_components/`), or simply never name a colocated file `page` or `route`.

**★ Symptom: CI fails with `Cannot find name 'PageProps'` although it compiles locally.** Cause: `PageProps`, `LayoutProps` and `RouteContext` are **generated** types, produced by `next dev`, `next build` or `next typegen`. A pipeline that runs `tsc --noEmit` before any Next.js command has nothing to resolve. Fix — generate first:

```json title="package.json"
{
  "scripts": {
    "typecheck": "next typegen && tsc --noEmit"
  }
}
```

**Symptom: a page that should have been static is rendered per request, and the build output marks it dynamic.** Cause: it touched `searchParams`. Reading search params is a request-time API and opts the page into dynamic rendering — even if you only read it to decide a default. Fix — push the read down into a small child under its own Suspense boundary so the rest of the page can still prerender:

```tsx title="app/shop/page.tsx"
import { Suspense } from 'react'
import { FilteredList } from './filtered-list'

export default function Page() {
  return (
    <section>
      <h1>Shop</h1>
      <Suspense fallback={<p>Loading results…</p>}>
        <FilteredList />
      </Suspense>
    </section>
  )
}
```

**Symptom: `searchParams.getAll('tag')` is not a function.** Cause: it is a plain object, not a `URLSearchParams`. A repeated key arrives as an array, a single key as a string. Fix — normalise at the boundary:

```tsx
const raw = (await props.searchParams).tag
const tags = raw === undefined ? [] : Array.isArray(raw) ? raw : [raw]
```

## Interview questions

**★ Why can't `error.tsx` catch an error thrown by the `layout.tsx` sitting beside it in the same folder?**
Because of the composition order. The hierarchy is `layout` → `template` → `error` → `loading` → `not-found` → `page`, so within a single segment the error boundary is rendered *inside* the layout. A React error boundary only catches errors thrown by its descendants; the layout is its ancestor. An error in `app/dashboard/layout.tsx` therefore propagates upward until it reaches an error boundary defined in a parent segment — in practice `app/error.tsx`, or `app/global-error.tsx` if the failing layout is the root one.

**★ What exactly makes a URL reachable in the App Router?**
A `page` file, or a `route` file, in the segment — and not both. Folders alone define structure without exposing anything, which is what makes it safe to colocate queries, tests, styles and components inside `app/`. A segment with only a `layout.tsx` renders nothing on its own; navigating to it produces a 404 unless a child segment supplies the page.

**★ In Next.js 16, what happened to synchronous `params`?**
It is gone. Version 15 made `params`, `searchParams`, `cookies()`, `headers()` and `draftMode()` async with a temporary synchronous compatibility layer; version 16 removed that layer entirely. `params` in `layout.js`, `page.js`, `route.js`, `default.js` and the metadata image conventions, and `searchParams` in `page.js`, are promises and only promises. The official codemod is `next-async-request-api`.

**Which of the special files can be Server Components, and which cannot?**
`page`, `layout`, `template`, `loading`, `not-found` and `default` are Server Components by default. `loading` and `page` can opt into `'use client'`. `error.tsx` and `global-error.tsx` are the exception: they *must* carry `'use client'`, because a React error boundary is a class component with `componentDidCatch` / `getDerivedStateFromError`, and that only exists in the client runtime.

**Why does `route.ts` accept only `.js` and `.ts` while every other convention accepts `.tsx`?**
Because a route handler returns a `Response`, not markup — there is no JSX to compile, so there is no reason for a JSX-enabled extension. It is a small signal of a bigger rule the docs state directly: route handlers *"do not participate in layouts or client-side navigations like `page`"*. They sit outside the whole composition stack described on this page.

**★ Reading `searchParams` in a page makes it dynamic. How do you keep most of the page static anyway?**
Do not read it at the top of the page component. Anything above the read can still be prerendered, so move the read into a child component and wrap that child in a `Suspense` boundary. The shell — heading, navigation, filters chrome — is prerendered and streamed immediately; only the part that genuinely depends on the query string waits for the request. The same trick is what makes the Cache Components model workable, and it generalises to `cookies()` and `headers()`.

---

← [Chapter 2 overview](01-explanation.md) · Next → [01b · Layout and the root layout](01b-layout-and-the-root-layout.md)
