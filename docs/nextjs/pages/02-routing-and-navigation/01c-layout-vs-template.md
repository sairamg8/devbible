---
title: "A layout persists and a template remounts, and the only honest reason to reach for template.tsx is that you actively want the state destroyed — a resynchronised effect, a cleared input, or a Suspense fallback that shows on every navigation instead of only the first"
sidebar_label: "01c · Layout vs template"
sidebar_position: 3
description: "Why template.tsx remounts and layout.tsx does not, which segment's key change triggers the remount, and the three cases the docs give for actually needing one."
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-04 against [`template.js`](https://nextjs.org/docs/app/api-reference/file-conventions/template) (`lastUpdated: 2026-03-05`) and [`layout.js`](https://nextjs.org/docs/app/api-reference/file-conventions/layout) (`2026-05-27`).
> Target: **Next.js 16.3.4** · `template` introduced in v13.0.0. Documentation-verified — **no sandbox run**.

**`layout.tsx` and `template.tsx` occupy adjacent slots in the composition stack and wrap the same things, so the file you pick looks like a style choice. It is not. Next.js gives a template a `key` derived from the route, so React unmounts and rebuilds the whole subtree whenever that key changes: client state resets, effects re-run their cleanup and setup, DOM nodes are recreated. A layout keeps all of it. Reach for a template only when the destruction is the feature.**

## The mechanism is one prop you never write

> *"A **template** file is similar to a layout in that it wraps a layout or page. Unlike layouts that persist across routes and maintain state, templates are given a unique key, meaning children Client Components reset their state on navigation."*
> — [`template.js`](https://nextjs.org/docs/app/api-reference/file-conventions/template)

```jsx
// Output shape, quoted from the template.js reference
<Layout>
  {/* Note that the template is automatically given a unique key. */}
  <Template key={routeParam}>{children}</Template>
</Layout>
```

That is the entire difference. React's reconciler treats a changed `key` as "this is a different component instance", so it discards the old tree rather than updating it. Everything below the template — including Client Components several levels down — is remounted.

## Where it sits

> *"In terms of nesting, `template.js` is rendered between a layout and its children."*
> *"In the component hierarchy, `template.js` renders between `layout.js` and `error.js`. It wraps `error.js`, `loading.js`, `not-found.js`, and `page.js`, but does **not** wrap the `layout.js` in the same segment."*

So a template is *inside* its own segment's layout and *outside* that segment's error boundary. Two things follow immediately:

- A template cannot reset its own layout. If you want the sidebar's scroll position destroyed too, the template has to live in the **parent** segment.
- An error thrown by a template is not caught by the `error.tsx` in the same segment — the same ancestor/descendant rule that applies to layouts applies here. `error.js` *"does **not** wrap the `layout.js` or `template.js` above it in the same segment."*

## What a remount actually does

Quoted from the Behavior section:

> *"**Server Components**: By default, templates are Server Components."*
> *"**With navigation**: Templates receive a unique key for their own segment level. They remount when that segment (including its dynamic params) changes. Navigations within deeper segments do not remount higher-level templates. Search params do not trigger remounts."*
> *"**State reset**: Any Client Component inside the template will reset its state on navigation."*
> *"**Effect re-run**: Effects like `useEffect` will re-synchronize as the component remounts."*
> *"**DOM reset**: DOM elements inside the template are fully recreated."*

Two clauses in the middle of that are the ones people miss:

1. **A template only remounts when *its own* segment level changes.** A `template.tsx` in `app/` does not remount when you go from `/blog/first-post` to `/blog/second-post`, because the first segment is still `blog`. A `template.tsx` in `app/blog/` does.
2. **Search params do not trigger a remount.** `?page=2` will not reset anything.

The reference walks through the key values for the tree `app/{page,template,layout}` plus `app/blog/{page,template,[slug]/page}` — starting at `/`, the root template has `key="/"`; navigating to `/about` changes it to `key="/about"` and it remounts; navigating on to `/blog/first-post` and then `/blog/second-post` leaves the root template's key at `"/blog"` while the blog-level template's key changes each time and remounts. (The docs label those key values *"illustrative"* — do not depend on the exact string.)

## The three reasons the docs give

> *"They are useful when you need to:*
> *• Resynchronize `useEffect` on navigation.*
> *• Reset the state of a child Client Components on navigation. For example, an input field.*
> *• To change default framework behavior. For example, Suspense boundaries inside layouts only show a fallback on first load, while templates show it on every navigation."*
> — [`template.js`](https://nextjs.org/docs/app/api-reference/file-conventions/template)

The third is the non-obvious one and the reason most real templates exist. A `Suspense` boundary written inside a layout renders its fallback the first time it mounts and then never again, because the layout is not remounting. Move the same boundary inside a template and it mounts fresh on every navigation, so the fallback shows every time.

```tsx title="app/dashboard/template.tsx"
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="fade-in">{children}</div>
}
```

That four-line file is also the standard enter-animation trick: a CSS animation on `.fade-in` fires on mount, and mount is exactly what a template guarantees per navigation.

Analytics is the other honest case:

```tsx title="app/(app)/template.tsx"
'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { track } from '@/app/lib/analytics'

export default function Template({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  useEffect(() => {
    track('pageview', { pathname })
  }, [pathname])

  return <>{children}</>
}
```

Note the `[pathname]` dependency is still there: the remount makes the effect fire, but writing the dependency keeps the component correct if it ever moves into a layout.

## Choosing

| You want… | Use |
|---|---|
| A sidebar whose scroll position and open/closed accordions survive navigation | `layout.tsx` |
| A nav whose data is fetched once and reused | `layout.tsx` |
| A page-enter animation on every navigation | `template.tsx` |
| A search input cleared whenever the route changes | `template.tsx` |
| An effect that re-runs per navigation without you wiring a dependency array | `template.tsx` |
| A Suspense fallback that shows on every navigation, not only the first | `template.tsx` |
| Both a persistent shell and a per-navigation reset | both files, in the same segment |

The last row is legitimate and common: `layout.tsx` holds the chrome, `template.tsx` sits inside it wrapping the changing content.

## Gotchas

**★ Symptom: you added `template.tsx` for a page transition and the whole app now refetches on every click.** Cause: a template remounts its entire subtree, and any Client Component below it loses state — including form drafts, open dialogs, scroll containers and `useState`-cached data. Fix — push the template as deep as the reset needs to go, rather than putting it at the root:

```
app/template.tsx                    ✗ remounts everything on any top-level nav
app/dashboard/reports/template.tsx  ✓ resets only the reports subtree
```

**★ Symptom: `template.tsx` at the root does not remount when navigating `/blog/a` → `/blog/b`.** Cause: a template remounts when *its own* segment level changes, and the root template's segment is still `blog`. Fix — put the template at the level whose segment actually changes:

```
app/template.tsx        key changes on /about vs /blog — not on /blog/a vs /blog/b
app/blog/template.tsx   key changes on /blog/a vs /blog/b   ← what you wanted
```

**Symptom: you expect a reset when the query string changes (`?tab=notes`) and get none.** Cause: *"Search params do not trigger remounts."* Fix — key the component yourself on the value you care about:

```tsx title="app/notes/page.tsx"
export default async function Page(props: PageProps<'/notes'>) {
  const { tab } = await props.searchParams
  return <Editor key={String(tab)} />
}
```

**Symptom: an animation defined in `layout.tsx` plays once and never again.** Cause: the layout never remounts, so a mount-triggered CSS animation has exactly one chance to fire. Fix — move the animated wrapper into `template.tsx`, which mounts per navigation.

**★ Symptom: a `Suspense` fallback shows on first load and then never appears again during navigation.** Cause: the boundary is inside a layout that does not remount, so React reuses the already-resolved boundary. Fix — move the boundary into a template:

```tsx title="app/dashboard/template.tsx"
import { Suspense } from 'react'
import { PanelSkeleton } from './panel-skeleton'

export default function Template({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<PanelSkeleton />}>{children}</Suspense>
}
```

**Symptom: your `error.tsx` never catches the exception thrown in `template.tsx` beside it.** Cause: the template is the error boundary's ancestor — `error.js` *"does not wrap the `layout.js` or `template.js` above it in the same segment."* Fix — handle it in the parent segment's `error.tsx`, or (better) do not throw from a template at all; templates should be thin wrappers.

**Symptom: the template renders but `children` never appears.** Cause: same as with layouts — `children` is a required prop and forgetting to render it silently blanks the subtree. Fix — always return `children` somewhere in the JSX.

**Symptom: you used a template to force a data refetch and it did not refetch.** Cause: a template remounting is a *React* remount; whether the server data is re-requested depends on the router cache and the page's own caching, not on the template. Fix — control the data instead: revalidate the tag, or make the page dynamic. A template is a state-lifetime tool, not a cache-busting tool.

## Interview questions

**★ What is the actual mechanical difference between a layout and a template?**
The template is rendered with a `key` derived from its own route segment; the layout is not keyed. When that key changes, React's reconciler treats the template as a different element and unmounts the old subtree instead of updating it, so all client state below it is discarded, all effects run their cleanup and then their setup again, and the DOM nodes are rebuilt. A layout with an unchanged identity is simply updated in place, which is why it can be cached on the client and reused across navigations.

**★ When do you genuinely need a template rather than a layout?**
Three cases, and they are all "I want the destruction". You want `useEffect` to resynchronise per navigation without threading a dependency array. You want a child Client Component's state — typically an input — cleared whenever the route changes. Or you want framework behaviour changed: a `Suspense` boundary inside a layout only shows its fallback on the first mount, whereas one inside a template shows it on every navigation. Enter animations are a special case of the third: they fire on mount, and a template guarantees a mount.

**★ A root `template.tsx` does not reset when the user moves between two blog posts. Why?**
Because templates are keyed at their own segment level, and both `/blog/first` and `/blog/second` share the same first segment. The key of `app/template.tsx` does not change, so nothing remounts. Put the template at `app/blog/template.tsx`, whose key includes the changing child segment, and it remounts on each post.

**Does changing `?page=2` remount a template?**
No. The documented behaviour is explicit that search params do not trigger remounts — only a change to the segment (including its dynamic params) does. If you need a reset on a query-string change, key the specific component yourself on that value.

**Where does a template sit relative to `error.tsx` and `loading.tsx`?**
Between the layout and everything else. The order is `layout` → `template` → `error` → `loading` → `not-found` → `page`, so a template wraps `error.js`, `loading.js`, `not-found.js` and `page.js`, but does not wrap the `layout.js` in the same segment. That has a practical edge: a template's own error is not caught by the sibling `error.tsx`, which is why templates should stay thin.

**Can you use both a layout and a template in the same folder?**
Yes, and it is often the right answer. The layout keeps the persistent chrome — sidebar, tabs, fetched navigation — and the template wraps the changing content so animations, resets and per-navigation Suspense fallbacks work. They compose in that order, layout outermost.

---

← [01b · layout.tsx](01b-layout-and-the-root-layout.md) · [Chapter 2 overview](01-explanation.md) · Next → [01d · loading.tsx](01d-loading-tsx-and-the-suspense-boundary.md)
