---
title: "The searchParams prop is the right tool in a Page and does not exist in a Layout, and updating the URL splits into two mechanisms — a navigation the server sees, and a History API push the server never hears about"
sidebar_label: "04k · Query state in practice"
sidebar_position: 149
description: "When to use the searchParams prop instead of the hook, why Layouts deliberately do not receive one, router.push versus window.history.pushState, the read-only URLSearchParams and its edge cases, and the rewrite hydration mismatch."
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-04 against the Next.js [`useSearchParams`](https://nextjs.org/docs/app/api-reference/functions/use-search-params) reference (`lastUpdated: 2026-07-14`), [`usePathname`](https://nextjs.org/docs/app/api-reference/functions/use-pathname) (`lastUpdated: 2026-06-09`) and [Linking and Navigating](https://nextjs.org/docs/app/getting-started/linking-and-navigating) (`lastUpdated: 2026-08-25`).
> Target: **Next.js 16.3.4** · both hooks since **v13.0.0**. Documentation-verified — **no sandbox run**.

**[04j](04j-usepathname-and-usesearchparams.md) settled when the hooks force a `Suspense` boundary. This is what to do with the values, and the two decisions that matter are both about *who needs to see the change*. Reading: a Page gets a `searchParams` prop and should usually use it; a Layout deliberately does not get one, because a shared layout is not re-rendered during navigation and the prop would go stale — so a Layout must read the URL from a Client Component and accept the boundary. Writing: `router.push` and `<Link>` are real navigations, so the Page's prop updates and Server Components re-run, while `window.history.pushState` changes the URL and keeps the hooks in sync without the server ever hearing about it. Choosing the second when you needed the first produces a URL that is correct and a page that is stale.**

## The Server Component alternatives

For a **Page**, the `searchParams` prop is usually the better tool:

> *"If you want to fetch data in a Server Component based on search params, it's often a better option to read the `searchParams` prop of the corresponding Page. You can then pass it down by props to any component (Server or Client) within that Page."*

For a **Layout**, there is no alternative, because there is no prop:

> *"Unlike Pages, Layouts (Server Components) **do not** receive the `searchParams` prop. This is because a shared layout is not re-rendered during navigation which could lead to stale `searchParams` between navigations."*

So the decision tree is short: in a Page, prefer the prop; in a Layout, you must use the hook in a Client Component, *"which is re-rendered on the client with the latest `searchParams`"* — and then you own the Suspense boundary.

## Updating the URL

Two mechanisms, and they are not interchangeable.

**`useRouter` or `<Link>`** — a real navigation, so the Page's `searchParams` prop updates and Server Components re-render:

```tsx title="app/example-client-component.tsx"
'use client'

import { useCallback } from 'react'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'

export default function ExampleClientComponent() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  // Get a new searchParams string by merging the current
  // searchParams with a provided key/value pair
  const createQueryString = useCallback(
    (name: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString())
      params.set(name, value)
      return params.toString()
    },
    [searchParams]
  )

  return (
    <>
      <p>Sort By</p>
      <button onClick={() => router.push(pathname + '?' + createQueryString('sort', 'asc'))}>
        ASC
      </button>
      <Link href={pathname + '?' + createQueryString('sort', 'desc')}>DESC</Link>
    </>
  )
}
```

**The native History API** — a URL update with no navigation, which Next.js integrates with:

> *"Next.js allows you to use the native `window.history.pushState` and `window.history.replaceState` methods to update the browser's history stack without reloading the page. `pushState` and `replaceState` calls integrate into the Next.js Router, allowing you to sync with `usePathname` and `useSearchParams`."*

```tsx title="app/ui/sort-products.tsx"
'use client'

import { useSearchParams } from 'next/navigation'

export default function SortProducts() {
  const searchParams = useSearchParams()

  function updateSorting(sortOrder: string) {
    const params = new URLSearchParams(searchParams.toString())
    params.set('sort', sortOrder)
    window.history.pushState(null, '', `?${params.toString()}`)
  }

  return (
    <>
      <button onClick={() => updateSorting('asc')}>Sort Ascending</button>
      <button onClick={() => updateSorting('desc')}>Sort Descending</button>
    </>
  )
}
```

Use `pushState` when the user should be able to press Back to the previous state, `replaceState` when they should not — the documented `replaceState` example is a locale switcher.

## Hydration mismatch behind rewrites

> *"If your page is being statically prerendered and your app has rewrites in `next.config` or a Proxy file, reading the pathname with `usePathname()` can result in hydration mismatch errors, because the initial value comes from the server and may not match the actual browser pathname after routing."*

The documented mitigation is to defer the read to after mount and keep the affected surface tiny:

```tsx title="app/ui/pathname-badge.tsx"
'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'

export default function PathnameBadge() {
  const pathname = usePathname()
  const [clientPathname, setClientPathname] = useState('')

  useEffect(() => {
    setClientPathname(pathname)
  }, [pathname])

  return (
    <p>
      Current pathname: <span>{clientPathname}</span>
    </p>
  )
}
```

> *"To avoid hydration mismatches, design the UI so that only a small, isolated part depends on the client pathname. Render a stable fallback on the server and update that part after mount."*

## Gotchas

**★ Symptom: `?q=` with an empty value is treated as "no filter", and the user's cleared search silently reverts to the default.** Cause: `get()` returns `''` for a present-but-empty parameter, and `''` is falsy. Fix: test presence with `has()`, not truthiness.

```ts
const q = searchParams.has('q') ? searchParams.get('q')! : DEFAULT_QUERY
```

**★ Symptom: a multi-select filter only ever applies the first selection.** Cause: `get()` returns the first value for `?tag=a&tag=b`. Fix: `getAll()`.

```ts
const tags = searchParams.getAll('tag') // ['a', 'b']
```

**★ Symptom: a Layout needs the current search params and there is no prop for them.** Cause: Layouts deliberately do not receive `searchParams`, because a shared layout is not re-rendered during navigation and the value would go stale. Fix: read them in a Client Component inside the layout — and take the Suspense boundary that comes with it.

```tsx title="app/dashboard/layout.tsx"
import { Suspense } from 'react'
import { FilterChips } from './filter-chips' // 'use client', useSearchParams

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <section>
      <Suspense fallback={null}>
        <FilterChips />
      </Suspense>
      {children}
    </section>
  )
}
```

**★ Symptom: hydration mismatch warnings on a page reached through a rewrite.** Cause: the HTML was prerendered for the source pathname while the browser's URL is the rewritten one, so `usePathname` disagrees with the server render. Fix: render a stable fallback and set the real value in an effect, keeping the pathname-dependent surface as small as possible.

**Symptom: `window.history.pushState` updates the URL and the Server Component below never re-renders.** Cause: that is what it is for — a history entry with no navigation. Fix: if the server needs to see the new params, navigate with `router.push` or a `<Link>`; use `pushState` only for state the client owns.

**Symptom: `usePathname` is used to decide the locale prefix and drifts from the router's idea of the route.** Cause: the hook reports the *browser's* pathname, which under rewrites or proxy routing need not match the route that rendered. Fix: for locale-prefixed routing, take the locale from the route params rather than parsing the pathname — see [08 · Localized routing](08-localized-routing-i18n-locale-prefixed-routes-locale-detecti.md).

**Symptom: `searchParams.set(...)` does not compile.** Cause: the returned object is a **read-only** `URLSearchParams`. Fix: copy it into a mutable one, which is what the documented `createQueryString` helper does.

```ts
const params = new URLSearchParams(searchParams.toString())
params.set('sort', 'asc')
```

**Symptom: the sort control works, and sharing the URL gives a colleague the default sort.** Cause: the sort was applied with `pushState`, so the URL carries it but no Server Component ever read it — the receiving page renders from its own defaults. Fix: if the URL is meant to be shareable *state*, it must be a navigation, because a fresh load has no client state to apply.

```tsx
// 🚩 shareable-looking, not actually shared
window.history.pushState(null, '', `?sort=${order}`)

// ✅ the server sees it, so a cold load reproduces it
router.push(`${pathname}?${createQueryString('sort', order)}`)
```

**Symptom: `createQueryString` drops every other parameter.** Cause: it was built from scratch rather than from the current params. Fix: seed the `URLSearchParams` from `searchParams.toString()` — which is what the documented helper does, and the reason it takes `searchParams` as a dependency.

```ts
const params = new URLSearchParams(searchParams.toString()) // ✅ preserves the rest
params.set(name, value)
```

**Symptom: a filter panel re-renders the whole page on every keystroke.** Cause: each change is a `router.push`, so each keystroke is a navigation and a server render. Fix: debounce, use `replace` rather than `push` so the history stack does not fill with intermediate states, and consider `pushState` for state the server does not need.

```tsx
const onChange = useDebouncedCallback((q: string) => {
  router.replace(`${pathname}?${createQueryString('q', q)}`)
}, 300)
```

## Interview questions

**★ Why do Layouts not receive a `searchParams` prop when Pages do?**
For the same reason. A Page re-renders on navigation, so a prop derived from the URL is fresh. A shared Layout is not re-rendered during navigation, so a `searchParams` prop on it would hold the values from whenever the layout last rendered and quietly diverge. Rather than hand you a prop that is right sometimes, the framework removes it and directs you to a Client Component that re-renders on the client with the latest values.

**★ A user clears a search box and the results revert to the default set instead of showing nothing. Where is the bug?**
Almost certainly `if (searchParams.get('q'))`. The documented return table says `?a=` yields `''`, not `null`, so a present-but-empty parameter is falsy and the code falls through to its default branch. Use `has()` to test presence and treat the empty string as a legitimate value, because the user typing nothing is a real state distinct from the parameter being absent.

**When would you use `window.history.pushState` instead of `router.push`?**
When the URL is describing client state that the server does not need to re-render for — a sort order applied to data already loaded, an open panel, a selected tab within a page. `pushState` and `replaceState` integrate with the router and stay in sync with `usePathname` and `useSearchParams`, so the URL remains shareable, but no navigation occurs and no Server Component re-runs. The moment the server needs to see the new parameter, it has to be a navigation.

**Two components both read the pathname: a sidebar highlighting the active link, and a breadcrumb trail. What do you do differently for each?**
Both go in Client Components and both are candidates for a Suspense boundary under Cache Components, so the design question is how much of the layout each one can take down with it. Keep each read in the smallest component that needs it and wrap that component rather than the whole sidebar, so the static chrome around it still prerenders. And if the app has rewrites, prefer deriving breadcrumbs from route params rather than parsing `usePathname`, because the browser pathname and the rendered route can legitimately differ.

**★ You need the current filters inside a Layout. What are your options?**
There is only one: read them in a Client Component rendered by the layout, using `useSearchParams`, and wrap it in a `Suspense` boundary. Layouts do not receive a `searchParams` prop by design, because a shared layout is not re-rendered during navigation and the prop would carry values from whenever the layout last rendered. The framework's own recommendation is exactly this — the hook in a Client Component, which re-renders on the client with the latest values.

**A URL parameter set with `pushState` is shared with a colleague and does not work. Explain.**
Because `pushState` never told the server anything. It updated the browser's history entry and, because Next.js integrates with it, kept `usePathname` and `useSearchParams` in sync in that tab — but no navigation occurred and no Server Component re-ran, so nothing on the server consumed the value. A cold load by someone else starts from the server, which renders the page from the URL it is given only if something actually reads it. If the URL is meant to be a shareable description of state, the change has to be a navigation.

---

← [04j · `usePathname` and `useSearchParams`](04j-usepathname-and-usesearchparams.md) · [Chapter 2 overview](01-explanation.md) · Next → [05 · Prefetching fundamentals](05-prefetching-fundamentals-and-the-native-view-transitions-api.md)
