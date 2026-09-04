---
title: "A layout is cached on the client and never re-renders on navigation, which is simultaneously its whole performance value and the reason it has no searchParams prop and cannot hand data to its children"
sidebar_label: "01b · layout.tsx"
sidebar_position: 2
description: "layout.tsx: the children and params props, why there is no searchParams, the root layout's html/body obligation, multiple root layouts and the full page load they cost."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-04 against [`layout.js`](https://nextjs.org/docs/app/api-reference/file-conventions/layout) (`lastUpdated: 2026-05-27`), [Layouts and Pages](https://nextjs.org/docs/app/getting-started/layouts-and-pages) (`2026-08-25`) and [Route Groups](https://nextjs.org/docs/app/api-reference/file-conventions/route-groups) (`2025-06-16`).
> Target: **Next.js 16.3.4**. Documentation-verified — **no sandbox run**.

**A layout is the one component in the App Router that is deliberately frozen. Next.js caches it on the client and reuses it across navigations so that moving between sibling pages never re-runs the sidebar query or the nav-tree fetch. Everything odd about the layout API — no `searchParams` prop, no way to pass data down to `children`, no raw request object — is a direct consequence of that decision, and the root layout adds one further obligation on top: it, and only it, renders the document.**

## The shape

```tsx title="app/dashboard/[team]/layout.tsx"
import { Sidebar } from '@/app/ui/sidebar'

export default async function TeamLayout(
  props: LayoutProps<'/dashboard/[team]'>
) {
  const { team } = await props.params

  return (
    <section>
      <Sidebar team={team} />
      <main>{props.children}</main>
    </section>
  )
}
```

- `children` is **required**. It is the slot where the nested layout or the page renders. Omit it from the JSX and the entire subtree below this segment silently disappears — no error, just a blank region.
- `params` is optional and resolves to *"the dynamic route parameters object from the root segment down to that layout"*. `app/shop/[tag]/[item]/layout.js` at `/shop/1/2` gets `Promise<{ tag: '1', item: '2' }>`.
- `LayoutProps<'/dashboard/[team]'>` types both, and infers named parallel slots too:

> *"You can type layouts with `LayoutProps` to get a strongly typed `params` and named slots inferred from your directory structure. `LayoutProps` is a globally available helper."*
> *"Types are generated during `next dev`, `next build` or `next typegen`."*
> — [`layout.js` › Layout Props Helper](https://nextjs.org/docs/app/api-reference/file-conventions/layout#layout-props-helper)

## Why there is no `searchParams`

> *"Layouts are cached in the client during navigation to avoid unnecessary server requests. Layouts do not rerender. They can be cached and reused to avoid unnecessary computation when navigating between pages. By restricting layouts from accessing the raw request, Next.js can prevent the execution of potentially slow or expensive user code within the layout, which could negatively impact performance."*
> — [`layout.js` › Request Object](https://nextjs.org/docs/app/api-reference/file-conventions/layout#request-object)

> *"Layouts do not rerender on navigation, so they cannot access search params which would otherwise become stale."*
> — [`layout.js` › Query params](https://nextjs.org/docs/app/api-reference/file-conventions/layout#query-params)

Read those two together. The prop is not missing; it is **withheld**, because a value that never updates on a component that never re-renders is a stale-data bug with a friendly API. The documented replacements are the page's own `searchParams` prop, or `useSearchParams` inside a Client Component — client components *do* re-render on navigation, so they see the current query string.

```tsx title="app/ui/search.tsx"
'use client'

import { useSearchParams } from 'next/navigation'

export default function Search() {
  const searchParams = useSearchParams()
  return <input defaultValue={searchParams.get('q') ?? ''} name="q" />
}
```

The raw request is withheld for the same reason, but `cookies()` and `headers()` are explicitly allowed in a layout:

```tsx title="app/shop/layout.tsx"
import { cookies } from 'next/headers'

export default async function Layout({
  children,
}: {
  children: React.ReactNode
}) {
  const cookieStore = await cookies()
  const theme = cookieStore.get('theme')?.value ?? 'light'
  return <div data-theme={theme}>{children}</div>
}
```

⚠️ Doing that has a cost that catches people out: the `loading.tsx` in that segment cannot cover it, because `loading.tsx` renders *below* the layout. That is the subject of [01d](01d-loading-tsx-and-the-suspense-boundary.md), and the fix — a `Suspense` boundary inside the layout — is shown there.

## A layout cannot pass data to its children

> *"Layouts cannot pass data to their `children`. However, you can fetch the same data in a route more than once, and use React `cache` to dedupe the requests without affecting performance."*
> — [`layout.js` › Fetching Data](https://nextjs.org/docs/app/api-reference/file-conventions/layout#fetching-data)

`children` arrives already-rendered as an opaque node; there is no `cloneElement` trick that survives the server/client boundary. The documented pattern is to fetch twice and deduplicate:

```ts title="app/lib/team.ts"
import { cache } from 'react'
import { db } from '@/app/lib/db'

// One database round trip per render pass, however many components ask.
export const getTeam = cache(async (slug: string) => {
  return db.team.findUnique({ where: { slug } })
})
```

```tsx title="app/dashboard/[team]/page.tsx"
import { getTeam } from '@/app/lib/team'

export default async function Page(props: PageProps<'/dashboard/[team]'>) {
  const { team } = await props.params
  const record = await getTeam(team) // deduped against the layout's call
  return <h1>{record?.name}</h1>
}
```

## The root layout's obligations

> *"The `app` directory **must** include a **root layout**, which is the top-most layout in the root `app` directory. Typically, the root layout is `app/layout.js`."*
> *"The root layout **must** define `<html>` and `<body>` tags."*
> *"You should **not** manually add `<head>` tags such as `<title>` and `<meta>` to root layouts. Instead, you should use the Metadata API which automatically handles advanced requirements such as streaming and de-duplicating `<head>` elements."*
> — [`layout.js` › Root Layout](https://nextjs.org/docs/app/api-reference/file-conventions/layout#root-layout)

```tsx title="app/layout.tsx"
import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'SprintDesk',
  description: 'Issue tracking that does not fight you',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
```

## Multiple root layouts

A root layout is defined **structurally**, not by filename:

> *"You can create **multiple root layouts**. Any layout without a `layout.js` above it is a root layout."*
> *"Navigating **across multiple root layouts** will cause a **full page load** (as opposed to a client-side navigation)."*

The Route Groups reference repeats the warning from the other side and adds the two failure modes:

> *"**Full page load**: If you navigate between routes that use different root layouts, it'll trigger a full page reload. For example, navigating from `/cart` that uses `app/(shop)/layout.js` to `/blog` that uses `app/(marketing)/layout.js`. This **only** applies to multiple root layouts."*
> *"**Top-level root layout**: If you use multiple root layouts without a top-level `layout.js` file, make sure your home route (/) is defined within one of the route groups, e.g. app/(marketing)/page.js."*
> — [Route Groups › Caveats](https://nextjs.org/docs/app/api-reference/file-conventions/route-groups#caveats)

```
app/
├── (marketing)/
│   ├── layout.tsx      root layout #1 — renders html + body
│   ├── page.tsx        /            ← the home route lives inside a group
│   └── pricing/page.tsx /pricing
└── (shop)/
    ├── layout.tsx      root layout #2 — renders its own html + body
    └── cart/page.tsx   /cart
```

Finally, the root layout may itself sit under a dynamic segment:

> *"The root layout can be under a **dynamic segment**, for example when implementing internationalization with `app/[lang]/layout.js`. Dynamic segments before the root layout are **root parameters** and can be read from any Server Component with `next/root-params`."*

That is a topic of its own — [11 · Root params](11-root-params.md).

## Gotchas

**★ Symptom: the nested page renders nowhere and the region is blank, with no error.** Cause: the layout forgot to render `{children}`. React is perfectly happy to drop a prop you never use. Fix:

```tsx
// ✗ silently swallows every page below this segment
export default function Layout({ children }: { children: React.ReactNode }) {
  return <section><Sidebar /></section>
}

// ✓
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <section>
      <Sidebar />
      <main>{children}</main>
    </section>
  )
}
```

**★ Symptom: you need the current `?tab=` value in a layout and there is no prop for it.** Cause: layouts do not re-render, so a `searchParams` prop would be stale by design. Fix — read it in a Client Component, or move the logic into the page:

```tsx title="app/dashboard/tab-badge.tsx"
'use client'
import { useSearchParams } from 'next/navigation'

export function TabBadge() {
  const tab = useSearchParams().get('tab') ?? 'overview'
  return <span>{tab}</span>
}
```

**★ Symptom: hydration errors everywhere, or the page renders with no `body` element.** Cause: a root layout returning a fragment or a `div` instead of the document. Fix:

```tsx
// ✗
export default function RootLayout({ children }) {
  return <div className="app">{children}</div>
}

// ✓
export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="app">{children}</body>
    </html>
  )
}
```

**Symptom: the page title renders twice, or a `meta` tag vanishes when the route streams.** Cause: hand-written head tags in the root layout instead of the Metadata API. Fix — export `metadata` (or `generateMetadata`) and delete the manual tags; Next.js de-duplicates them and knows when to block streaming so a crawler that does not run JavaScript still sees them.

```tsx
// ✗ in app/layout.tsx
<head><title>SprintDesk</title></head>

// ✓
export const metadata = { title: 'SprintDesk' }
```

**★ Symptom: a `Link` between two sections of your own app does a full document reload, losing client state and the router cache.** Cause: the two routes live under **different root layouts** — usually two route groups each with their own `layout.tsx` and no `app/layout.tsx` above them. This is documented behaviour, not a bug. Fix — if you need soft navigation between them, give them one shared root layout and push the differences into nested layouts:

```
app/
├── layout.tsx              the ONLY root layout: html + body
├── (marketing)/layout.tsx  nested — marketing chrome only
└── (shop)/layout.tsx       nested — shop chrome only
```

**Symptom: with two root layouts, `/` 404s.** Cause: neither group defines the home route, and there is no top-level `layout.js` to host one. Fix — put `page.tsx` inside one of the groups: `app/(marketing)/page.tsx`.

**Symptom: navigation into a dashboard section feels slow and the loading skeleton never shows.** Cause: the layout awaits `cookies()` or an uncached fetch, and `loading.tsx` sits below it in the hierarchy so it cannot cover the layout's own work. Fix — wrap the runtime data access in its own boundary inside the layout:

```tsx title="app/dashboard/layout.tsx"
import { Suspense } from 'react'
import { NavSkeleton } from './nav-skeleton'
import { DashboardNav } from './dashboard-nav'

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Suspense fallback={<NavSkeleton />}>
        <DashboardNav />
      </Suspense>
      <main>{children}</main>
    </>
  )
}
```

**Symptom: two components fetch the same team record and you assume you doubled the query.** Cause: layouts genuinely cannot pass data to children, so re-fetching is the documented pattern and looks wasteful. Fix — wrap the accessor in React's `cache()` (shown above) so the second call in the same render pass is memoised rather than re-issued.

**Symptom: `Cannot find name 'LayoutProps'` in CI.** Cause: like `PageProps`, it is a generated global, written by `next dev`, `next build` or `next typegen`. Fix — run `next typegen` before `tsc --noEmit`.

## Interview questions

**★ Why does `page.tsx` get `searchParams` but `layout.tsx` never does?**
Layouts do not re-render on navigation — they are cached on the client and reused so that moving between sibling pages does not re-run expensive layout code on the server. A `searchParams` prop on a component that does not re-render would hand you the query string from whenever the layout last rendered, which is a stale-data bug with a friendly API. Next.js removes the footgun by not providing the prop. Query state that belongs to layout-level chrome goes in a Client Component using `useSearchParams`, which does re-render.

**★ If layouts do not re-render, how do they ever show per-request data such as the signed-in user?**
They render on the *server* on the first load of that layout, and they may call `cookies()` and `headers()` while doing so — the restriction is on the raw request object, not on request-scoped APIs. What does not happen is a re-render on each subsequent client-side navigation within that layout's subtree. So the user chip renders once and stays; if you need it to change without a full reload, it has to be a Client Component driven by state, or the navigation has to cross out of that layout.

**★ How does a layout give data to the page inside it?**
It does not. `children` arrives already-rendered as an opaque React node; a layout cannot inject props into it. The documented approach is to fetch the same data in both places and deduplicate with React's `cache()`, which memoises the call for the duration of a single server render pass. Reaching for a module-level singleton instead is a cross-request data-leak bug, because the module is shared across requests in the same server process.

**★ What is a root layout, exactly — and how many can an app have?**
Any layout with no `layout.js` above it. Usually that is `app/layout.tsx` and there is exactly one, but if you delete `app/layout.tsx` and put a `layout.tsx` in each route group, you have several, and each must render its own `html` and `body`. The price is that navigation between routes served by different root layouts is a full page load rather than a client-side transition. It is the right shape when the two areas really are different applications — different fonts, different global CSS, different providers — and the wrong shape when they merely look different.

**Your root layout renders a Client Component provider around `{children}`. Does that make every page a Client Component?**
No. `children` is passed as a prop from the server, so it is rendered on the server and handed to the client provider as an already-serialised React node. That is the standard way to use context providers in the App Router: the provider is `'use client'`, the tree it wraps stays server-rendered. It only breaks if you *import* a Server Component into a Client Component file rather than passing it through as `children`.

**Why is there no `error.tsx` behaviour for the root layout itself?**
Because the error boundary in a segment is rendered inside that segment's layout, so nothing in `app/` can wrap `app/layout.tsx`. The dedicated escape hatch is `global-error.tsx`, which replaces the root layout entirely — and therefore has to render its own `html` and `body`, since the layout that normally does so is the thing that failed. See [01e](01e-error-and-not-found-boundaries.md).

---

← [01 · Special files](01-file-system-routing-pagetsx.md) · [Chapter 2 overview](01-explanation.md) · Next → [01c · Layout vs template](01c-layout-vs-template.md)
