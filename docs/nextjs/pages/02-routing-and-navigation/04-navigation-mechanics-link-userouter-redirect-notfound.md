---
title: "Link is the default because it renders a real anchor and is the only thing the prefetch scheduler can see, so every router.push in your codebase is a claim that no anchor could have done the job"
sidebar_label: "04 · The Link component"
sidebar_position: 4
description: "Why the Link component rather than router.push, the full prop surface and its version history, the object form of href, replace versus push, external links, and prefetching links that a proxy rewrites."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-04 against the Next.js [Link Component](https://nextjs.org/docs/app/api-reference/components/link) reference (`lastUpdated: 2026-08-25`), [`useRouter`](https://nextjs.org/docs/app/api-reference/functions/use-router) (`lastUpdated: 2026-07-01`), [Linking and Navigating](https://nextjs.org/docs/app/getting-started/linking-and-navigating) (`lastUpdated: 2026-08-25`) and [How to handle redirects](https://nextjs.org/docs/app/guides/redirecting) (`lastUpdated: 2026-08-25`).
> Target: **Next.js 16.3.4** (the `version:` field on all four pages). Documentation-verified — **no sandbox run**.

**`<Link>` and `useRouter().push()` both change the URL, and that is where the similarity stops. `<Link>` renders an actual `<a href>`, so the browser's entire navigation contract comes with it for free: middle-click opens a tab, `Cmd`-click opens a tab, right-click offers "Copy link address", a screen reader lists it in the links rota, and a crawler follows it. It is also the only thing Next.js watches for prefetching — a route behind a `router.push` in an `onClick` is invisible to the prefetch scheduler until the click happens. This page is the element and its props; [04b](04b-scroll-behaviour-and-the-navigation-lifecycle.md) is what happens to the scroll position when it is clicked, [04c](04c-onnavigate-and-blocking-navigation.md) is the click lifecycle, and [04e](04e-userouter-programmatic-navigation-and-refresh.md) is the programmatic escape hatch.**

## The recommendation is in the reference, not in a blog post

The `<Link>` reference opens with the role:

> *"`<Link>` is a React component that extends the HTML `<a>` element to provide prefetching and client-side navigation between routes. It is the primary way to navigate between routes in Next.js."*

And the `useRouter` reference opens by pointing back at it:

> *"**Recommendation:** Use the `<Link>` component for navigation unless you have a specific requirement for using `useRouter`."*

The redirects guide repeats it a third time, in the `useRouter` section: *"If you don't need to programmatically navigate a user, you should use a `<Link>` component."* Three separate pages say the same thing, which is a reasonable signal that the mistake is common.

What you lose by wrapping `router.push` in a `<button onClick>`:

| Capability | `<Link href>` | `<button onClick={() => router.push()}>` |
| --- | --- | --- |
| Middle-click / `Cmd`-click new tab | yes, browser-native | no |
| Right-click → copy / open in new window | yes | no |
| Screen-reader link list, `role="link"` semantics | yes | no — it is announced as a button |
| Crawlable by a search engine | yes | no |
| Prefetched on entering the viewport | yes | no |
| Status-bar URL preview on hover | yes | no |

That last row is the one users notice without being able to name it.

## The prop surface

| Prop | Example | Type | Required |
| --- | --- | --- | --- |
| `href` | `href="/dashboard"` | String or Object | Yes |
| `replace` | `replace={false}` | Boolean | – |
| `scroll` | `scroll={false}` | Boolean | – |
| `prefetch` | `prefetch={false}` | Boolean, `"auto"`, or null | – |
| `onNavigate` | `onNavigate={(e) => {}}` | Function | – |
| `transitionTypes` | `transitionTypes={['slide-in']}` | `string[]` | – |

> *"`<a>` tag attributes such as `className` or `target="_blank"` can be added to `<Link>` as props and will be passed to the underlying `<a>` element."*

Four of those six are covered elsewhere in this chapter, because each belongs to a bigger subject than the component:

| Prop | Where it is explained |
| --- | --- |
| `scroll` | [04b · Scroll on navigation](04b-scroll-behaviour-and-the-navigation-lifecycle.md) |
| `onNavigate` | [04c · `onNavigate` vs `onClick`](04c-onnavigate-and-blocking-navigation.md) and [04d · Blocking navigation](04d-blocking-navigation-and-what-it-cannot-see.md) |
| `prefetch` | [13b · Prefetch control and link status](13b-prefetch-control-and-link-status.md), with the mechanics in [05 · Prefetching fundamentals](05-prefetching-fundamentals-and-the-native-view-transitions-api.md) |
| `transitionTypes` | **05b · The native View Transitions API** *(not written yet)* |

Version history worth carrying in your head: `transitionTypes` is **v16.2.0**, `onNavigate` is **v15.3.0**, `"auto"` as an explicit alias for the default `prefetch` behaviour is **v15.4.0**, and since **v13.0.0** `<Link>` no longer requires a child `<a>` tag — if you meet `<Link><a>…</a></Link>` in an old codebase, a codemod removes it. Since **v10.0.0**, an `href` pointing at a dynamic route resolves automatically and no longer needs an `as` prop for that purpose.

## `href`, in both forms

`href` takes an object as well as a string, which is the readable way to build a query string without hand-concatenating:

```tsx title="app/page.tsx"
import Link from 'next/link'

// Navigates to /about?name=test
export default function Page() {
  return (
    <Link href={{ pathname: '/about', query: { name: 'test' } }}>About</Link>
  )
}
```

For dynamic segments, template interpolation is the documented pattern — no `as` prop, no route manifest:

```tsx title="app/blog/post-list.tsx"
import Link from 'next/link'

interface Post {
  id: number
  title: string
  slug: string
}

export default function PostList({ posts }: { posts: Post[] }) {
  return (
    <ul>
      {posts.map((post) => (
        <li key={post.id}>
          <Link href={`/blog/${post.slug}`}>{post.title}</Link>
        </li>
      ))}
    </ul>
  )
}
```

Hash links work because `<Link>` really is an anchor. `<Link href="/dashboard#settings">Settings</Link>` renders `<a href="/dashboard#settings">Settings</a>`, with one rider from the reference: *"Next.js will scroll to the Page if it is not visible in the viewport upon navigation."*

## `replace` versus `push`

> *"**Defaults to `false`.** When `true`, `next/link` will replace the current history state instead of adding a new URL into the browser's history stack."*

```tsx title="app/page.tsx"
import Link from 'next/link'

export default function Page() {
  return (
    <Link href="/about" replace>
      About us
    </Link>
  )
}
```

Use it wherever a Back button landing on the previous state would be wrong or confusing — a step in a wizard you have already committed, a filter or sort toggle that would otherwise fill the history stack with noise, a locale switch. The test is whether the previous URL still describes a state the user could meaningfully return to.

## Marking the active link

`usePathname()` is the documented way, and it needs a Client Component:

```tsx title="app/ui/nav-links.tsx"
'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'

export function Links() {
  const pathname = usePathname()

  return (
    <nav>
      <Link className={`link ${pathname === '/' ? 'active' : ''}`} href="/">
        Home
      </Link>
      <Link
        className={`link ${pathname === '/about' ? 'active' : ''}`}
        href="/about"
      >
        About
      </Link>
    </nav>
  )
}
```

That innocent-looking component has a Suspense consequence under Cache Components, and a hydration-mismatch consequence behind rewrites. Both are in [04j · `usePathname` and `useSearchParams`](04j-usepathname-and-usesearchparams.md).

## Prefetching through a rewriting proxy

When `proxy.ts` rewrites `/dashboard` to `/auth/dashboard` or `/public/dashboard`, `<Link href="/dashboard">` cannot know which one to prefetch without asking the proxy. The documented fix is to give it both URLs — the one to display and the one to fetch:

```tsx title="app/page.tsx"
'use client'

import Link from 'next/link'
import useIsAuthed from './hooks/useIsAuthed'

export default function Page() {
  const isAuthed = useIsAuthed()
  const path = isAuthed ? '/auth/dashboard' : '/public/dashboard'
  return (
    <Link as="/dashboard" href={path}>
      Dashboard
    </Link>
  )
}
```

> *"In order for the `<Link />` component to properly prefetch links with rewrites via Proxy, you need to tell Next.js both the URL to display and the URL to prefetch. This is required to avoid un-necessary fetches to proxy to know the correct route to prefetch."*

The proxy layer itself is [07 · The `proxy.ts` layer](07-the-proxyts-layer-successor-to-middlewarets-request-intercep.md).

## Gotchas

**★ Symptom: middle-clicking your primary nav does nothing.** Cause: the nav is `<button onClick={() => router.push(href)}>`, and a button has no `href` for the browser to open in a new tab. Fix: it is an anchor, so make it an anchor — style the `<Link>`, do not rebuild it.

```tsx
// 🚩 no new tab, no prefetch, announced as a button
<button onClick={() => router.push('/pricing')}>Pricing</button>

// ✅
<Link href="/pricing" className="nav-item">Pricing</Link>
```

**★ Symptom: you replaced `<Link>` with `<a>` "to keep it simple" and navigation got slower everywhere.** Cause: a bare `<a>` is a full document load — no prefetch, no client-side transition, shared layouts torn down and rebuilt. The Linking and Navigating guide labels it in its own example: `{/* No prefetching */}` sits on the `<a href="/contact">` line and `{/* Prefetched when the link is hovered or enters the viewport */}` on the `<Link>` above it. Fix: keep `<Link>`, and if the goal was to stop prefetching, say that instead.

```tsx
// 🚩 full document load, layouts destroyed and rebuilt
<a href="/settings">Settings</a>

// ✅ client-side transition, prefetch explicitly declined — see 13b
<Link href="/settings" prefetch={false}>Settings</Link>
```

**★ Symptom: a `<Link>` to an external site does a client-side navigation and blanks the page.** Cause: `<Link>` is for same-origin routes; the `onNavigate` note confirms navigation handling is *"only for client-side and same-origin navigations"*. Fix: use a plain anchor for anything off-origin, with the security attributes an external link needs.

```tsx
<a href="https://status.example.com" target="_blank" rel="noopener noreferrer">
  Status
</a>
```

**Symptom: `target="_blank"` on a `<Link>` "does nothing special".** Cause: it does exactly what it does on an anchor — the props pass straight through to the underlying `<a>` — so the browser opens a new tab and no client-side transition happens. Fix: that is usually what you wanted; just add `rel="noopener noreferrer"`, which `<Link>` will not add for you.

**★ Symptom: a link in a rewritten route prefetches the wrong page, or prefetches nothing.** Cause: the proxy rewrite means the display URL and the real route differ, and Next.js will not call the proxy to find out. Fix: `<Link as="/dashboard" href={resolvedPath}>` — display URL in `as`, prefetch target in `href`.

**Symptom: hydration warnings and odd focus behaviour around every nav item, in a codebase migrated from Next 12.** Cause: leftover `<Link><a>…</a></Link>` nesting. Since v13.0.0 `<Link>` renders the anchor itself, so the child `<a>` produces an anchor inside an anchor — invalid HTML that browsers and assistive technology resolve inconsistently. Fix: run the documented codemod rather than hand-editing a large nav.

```bash
npx @next/codemod@latest new-link .
```

**Symptom: a query string built by hand double-encodes, or drops a `+`.** Cause: string concatenation into `href`. Fix: use the object form, which encodes the query for you.

```tsx
// 🚩
<Link href={'/search?q=' + userQuery}>Results</Link>

// ✅
<Link href={{ pathname: '/search', query: { q: userQuery } }}>Results</Link>
```

## Interview questions

**★ Why does Next.js push you toward `<Link>` when `router.push` reaches the same URL?**
Because the URL is the smaller half of a navigation. `<Link>` renders a real `<a href>`, so the browser supplies middle-click and modifier-click new tabs, the context menu, the hover status bar, link semantics for assistive technology, and crawlability. It is also the unit the prefetch scheduler watches — routes are prefetched as a `<Link>` enters the viewport, so a destination that only exists inside an `onClick` handler is never warmed. `useRouter` gives you the URL change and none of the rest, which is why the reference frames it as the thing you use when you have *"a specific requirement"*.

**★ When is `replace` the right choice over `push`?**
Whenever a Back press landing on the previous state would be wrong rather than merely unhelpful: after a step the user has already committed, when toggling a filter or a sort that would otherwise fill the history stack with noise, and when switching locale — Next.js's own documented `window.history.replaceState` example is exactly a locale switcher. The test is whether the previous URL still describes a state the user could meaningfully return to.

**★ You need a link that prefetches correctly behind a proxy rewrite. What do you write?**
Both URLs on the same `<Link>`: `as` carries the URL to display, `href` carries the route to actually prefetch. The reference gives the reason — without it Next.js would have to hit the proxy just to learn which route to prefetch, and it deliberately does not. So an authenticated dashboard rewritten from `/dashboard` becomes `<Link as="/dashboard" href="/auth/dashboard">`.

**Why does `<Link>` no longer need a child `<a>`, and what breaks if you leave one in?**
Since v13.0.0 `<Link>` renders the anchor itself. A nested `<a>` produces an anchor inside an anchor, which is invalid HTML and behaves unpredictably across browsers and assistive technology — nested interactive elements are not something the HTML parser resolves the way the author intended. Next.js ships a codemod to strip them, and that is the migration you want rather than hand-editing a large nav.

**How do you mark the active item in a nav, and what does that decision cost?**
`usePathname()` compared against each `href`, in a Client Component — that is the documented pattern. The cost is that the nav is now a Client Component, which under Cache Components can suspend on routes whose dynamic params are not known at build time, and which can hydrate against a different pathname than the server rendered when a rewrite is in play. Both are solvable, and both are reasons the active-link check is worth isolating into the smallest component that needs it.

**What actually happens to props you put on a `<Link>` that are not in its prop table?**
They pass through to the underlying `<a>`. `className`, `target`, `rel`, `aria-*`, `data-*` all land on the anchor, which is why `<Link target="_blank">` opens a new tab like any anchor and skips the client-side transition entirely. It also means `<Link>` will not add `rel="noopener noreferrer"` on your behalf.

---

← [03 · Dynamic routes](03-dynamic-routes-slug-catch-all-optional-catch-all.md) · [Chapter 2 overview](01-explanation.md) · Next → [04b · Scroll behaviour and the navigation lifecycle](04b-scroll-behaviour-and-the-navigation-lifecycle.md)
