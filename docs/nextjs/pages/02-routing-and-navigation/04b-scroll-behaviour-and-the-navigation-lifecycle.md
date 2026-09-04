---
title: "The scroll default is maintain-position, not scroll-to-top, and the search that finds the scroll target deliberately walks past sticky and fixed elements — which is why your content ends up underneath your own header"
sidebar_label: "04b · Scroll on navigation"
sidebar_position: 20
description: "The documented scroll algorithm on client-side navigation, the conditional that decides whether anything moves at all, why sticky and fixed elements are bypassed, and what scroll-padding-top actually fixes."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-04 against the Next.js [Link Component](https://nextjs.org/docs/app/api-reference/components/link) reference (`lastUpdated: 2026-08-25`) — the `scroll` prop, "Disable scrolling to the top of the page" and "Scroll offset with sticky headers" — plus [Linking and Navigating](https://nextjs.org/docs/app/getting-started/linking-and-navigating) (`lastUpdated: 2026-08-25`) and [`useRouter`](https://nextjs.org/docs/app/api-reference/functions/use-router) (`lastUpdated: 2026-07-01`).
> Target: **Next.js 16.3.4**. Documentation-verified — **no sandbox run**.

**Almost everyone carries the wrong summary of this: "Next.js scrolls to the top on navigation". It does not. The default is to *maintain* scroll position, exactly as a browser does for Back and Forward, and the router only scrolls when the destination Page element is **not** already in the viewport. Then the search that finds that element explicitly bypasses sticky and fixed positioned nodes — so the offset is computed as if your header did not exist, and the header, which does exist, covers the content you were scrolled to. Both halves of that are documented, and both produce bug reports that do not reproduce on the developer's monitor.**

## The rule is a conditional, not a constant

> *"**Defaults to `true`.** The default scrolling behavior of `<Link>` in Next.js **is to maintain scroll position**, similar to how browsers handle back and forwards navigation. When you navigate to a new Page, scroll position will stay the same as long as the Page is visible in the viewport. However, if the Page is not visible in the viewport, Next.js will scroll to the top of the first Page element."*

Two branches:

| Is the new Page element visible in the viewport? | What happens |
| --- | --- |
| Yes | Nothing. Scroll position is maintained. |
| No | Next.js scrolls to the top of the first Page element. |

That is why a nav bar inside a tall layout can navigate without appearing to do anything — the destination Page's top edge was already in view, so there was nothing to scroll to.

It also explains a shape of bug report that never reproduces for the developer: *"the page doesn't change when I click"*. On a 27-inch monitor the whole Page element fits above the fold and no scroll happens because none is needed. On a laptop, halfway down a long article, the same click scrolls. Same code, opposite symptom, and the difference is the reporter's window height — not their browser, not their network, not a race.

## The target search, and why it walks past your header

> *"Next.js checks if `scroll: false` before managing scroll behavior. If scrolling is enabled, it identifies the relevant DOM node for navigation and inspects each top-level element. All non-scrollable elements and those without rendered HTML are bypassed, this includes sticky or fixed positioned elements, and non-visible elements such as those calculated with `getBoundingClientRect`. Next.js then continues through siblings until it identifies a scrollable element that is visible in the viewport."*

Read the bypass list carefully. Three categories are skipped:

- **non-scrollable elements**, which is most of a page's chrome;
- **sticky or fixed positioned elements** — named explicitly;
- **non-visible elements**, determined by measuring with `getBoundingClientRect`.

The traversal then continues *through siblings* until it finds a scrollable element that is visible. The consequence is not a bug: the router is looking for the content region, and a fixed header is by definition not the content region. But the scroll target is therefore computed as if your sticky header did not exist, and the header then overlaps the top of the destination.

## The fix is a browser property, not a router option

```tsx title="app/layout.tsx"
import './globals.css'

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>
        <header className="sticky top-0 h-16 bg-white">{/* Navigation */}</header>
        {children}
      </body>
    </html>
  )
}
```

```css title="app/globals.css"
html {
  scroll-padding-top: 64px; /* Match the height of your sticky header */
}
```

> *"This is a browser CSS property that offsets scroll-based positioning. It applies whenever Next.js uses the native `scrollIntoView()` API, including hash fragment (`#id`) navigation."*

Two things follow from that last clause. First, because it is a *browser* property it also corrects plain `#anchor` navigation, find-in-page and any other native `scrollIntoView()` — including the ones Next.js has nothing to do with. That breadth is the signal you are fixing the cause rather than patching a symptom. Second, the reference offers `scroll-margin-top` on individual target elements as the per-element alternative, for when a single global offset is wrong because different sections sit under headers of different heights.

## Opting out

`scroll={false}` on the link:

```tsx title="app/page.tsx"
import Link from 'next/link'

export default function Page() {
  return (
    <Link href="/#hashid" scroll={false}>
      Disables scrolling to the top
    </Link>
  )
}
```

or `{ scroll: false }` as the second argument to the programmatic equivalents:

```tsx
import { useRouter } from 'next/navigation'

const router = useRouter()
router.push('/dashboard', { scroll: false })
```

The realistic reasons to reach for it: a tab strip that swaps the URL while the user is reading; a filter or sort control that navigates to keep the state shareable; an infinite list whose "load more" changes the URL. In all three the content region changes but the *page*, conceptually, did not — so moving the reading position is a regression, not a service.

## Gotchas

**★ Symptom: navigating from a long page leaves the user in the middle of the new one.** Cause: this is the documented default — scroll position is *maintained* while the new Page element is still in the viewport. Fix: if a given navigation must always start at the top, say so at the call site rather than fighting the router.

```tsx
'use client'
import Link from 'next/link'

<Link href="/docs/intro" onNavigate={() => window.scrollTo(0, 0)}>
  Start over
</Link>
```

**★ Symptom: after navigating to `/page#section`, the heading sits underneath your sticky header.** Cause: the scroll-target search *"bypasses"* sticky and fixed positioned elements, so the header's height is never accounted for. Fix: one CSS declaration on the scroll container, matched to the header height.

```css title="app/globals.css"
html { scroll-padding-top: 64px; }
```

**Symptom: `scroll-padding-top` fixes most anchors but overshoots inside a modal or a scrollable panel.** Cause: `scroll-padding-top` applies to a *scroll container*, and you set it on `html` while the real container is the panel. Fix: put the offset on the element that actually scrolls, or use `scroll-margin-top` on the individual targets.

```css
.panel { overflow-y: auto; scroll-padding-top: 3rem; }
/* or, per target */
h2[id] { scroll-margin-top: 4rem; }
```

**★ Symptom: the tab strip scrolls the page to the top every time a tab is selected.** Cause: each tab is a `<Link>` to a different route, the Page element sits below the fold, so the router correctly scrolls to it. Fix: `scroll={false}` on the tab links — the URL changes, the reading position does not.

```tsx
<Link href={`/reports/${tab}`} scroll={false}>{label}</Link>
```

**Symptom: `router.push` respects `scroll: false` but a `<Link>` next to it does not.** Cause: they are separate opt-outs and both must be set — the prop on the component, the option on the call. Fix:

```tsx
<Link href="/reports/weekly" scroll={false}>Weekly</Link>
router.push('/reports/weekly', { scroll: false })
```

**Symptom: you added top padding to every page to clear the sticky header, and now pages without a header have a gap.** Cause: layout padding changes the geometry permanently; the problem was only ever about where a *scroll* lands. Fix: replace the padding with `scroll-padding-top`, which affects scrolling and nothing else.

**Symptom: navigation scrolls to a point above the content, into an empty region.** Cause: the first top-level element the traversal accepts is a rendered, scrollable, visible one — and a wrapper `<div>` with no visible content of its own can qualify. Fix: make the page's real content region the first meaningful top-level element rather than nesting it inside decorative wrappers, or set `scroll-margin-top` on that region.

## Interview questions

**★ Describe Next.js's scroll behaviour on client-side navigation, precisely.**
The default is to *maintain* scroll position, the way browsers do for Back and Forward — not to jump to the top. Position is kept as long as the new Page element is still visible in the viewport. If it is not visible, Next.js scrolls to the top of the first Page element. Finding that element, it walks top-level nodes and skips anything non-scrollable or without rendered HTML, explicitly including sticky and fixed positioned elements and elements measured as non-visible via `getBoundingClientRect`, continuing through siblings until it finds a scrollable element visible in the viewport. `scroll={false}` on the link, or `{ scroll: false }` on `push`/`replace`, opts out.

**★ Content lands under your sticky header after navigating to a hash. Why, and what is the fix?**
Because the scroll-target search bypasses sticky and fixed elements, so the computed position ignores the header's height and the header then overlaps it. The fix is CSS, not router config: `scroll-padding-top` on the scroll container matched to the header height, or `scroll-margin-top` on individual targets. It applies wherever Next.js uses the native `scrollIntoView()`, so it fixes plain `#id` navigation and find-in-page at the same time.

**★ A tester says clicking a nav link "does nothing", and you cannot reproduce it. Where do you look first?**
At the viewport, before the code. The router only scrolls when the destination Page element is not visible; on a large screen the whole Page can fit above the fold, so a correct navigation produces no visible motion and the content swap can be subtle when the layout is shared. Reproduce at the reporter's window size and scroll position before assuming the click handler is broken.

**Why is `scroll-padding-top` a better answer than adding top padding to the page content?**
Because it changes only the scroll geometry, not the layout. Padding on the content moves everything down permanently and has to be undone on every page that has no sticky header; `scroll-padding-top` affects where a scroll operation lands and nothing else. And because it is a browser property rather than a framework one, it also corrects plain hash navigation, find-in-page and every other native `scrollIntoView()` — you fix one thing and four symptoms go away.

**When would you deliberately disable managed scrolling, and what do you owe the user if you do?**
Tab strips, filter and sort controls, and paginated lists where the URL changes to stay shareable but the user's reading position should not move. What you owe them is a visible change: if nothing scrolls and the content region updates below the fold, the click looks ignored. Either keep the changing region in view or give it an in-place loading state — see [13b · `useLinkStatus`](13b-prefetch-control-and-link-status.md).

---

← [04 · The Link component](04-navigation-mechanics-link-userouter-redirect-notfound.md) · [Chapter 2 overview](01-explanation.md) · Next → [04c · `onNavigate` and blocking navigation](04c-onnavigate-and-blocking-navigation.md)
