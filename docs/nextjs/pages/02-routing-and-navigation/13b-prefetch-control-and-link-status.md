---
sidebar_position: 14
title: "A prefetch is negotiated between a Link that expresses intent and a destination segment that sets a cost ceiling, and useLinkStatus is the consolation prize for the navigations neither of them could make instant"
sidebar_label: "13b · Prefetch control and link status"
description: "The Next.js 16.3 route segment config surface, the three prefetch values and how they interact with the Link prefetch prop, and useLinkStatus — including why the indicator you see in development will never appear in production."
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-03 against [Route Segment Config](https://nextjs.org/docs/app/api-reference/file-conventions/route-segment-config), [`prefetch`](https://nextjs.org/docs/app/api-reference/file-conventions/route-segment-config/prefetch), [`useLinkStatus`](https://nextjs.org/docs/app/api-reference/functions/use-link-status) and the [version 16 upgrade guide](https://nextjs.org/docs/app/guides/upgrading/version-16).
> Target: **Next.js 16.3.4** · `prefetch` and `instant` are Cache Components only; `useLinkStatus` since v15.3.0.

**Two different files decide what gets prefetched, and they are answering two different questions. The `<Link>` says "should this destination be fetched ahead of time, and how eagerly" — that is intent, and it lives where the user's behaviour is. The destination segment says "how much work is it acceptable to do ahead of time for anyone who links here" — that is a cost ceiling, and it has to live on the destination because a destination cannot know which links point at it. When neither can make a navigation instant, `useLinkStatus` gives you a pending flag to soften the wait — with a trap: if the route is prefetched the pending state is skipped entirely, and development has no prefetching, so the indicator you built and admired locally may never render in production.**

## The route segment config surface in 16.3

| Option | Type | Default |
| --- | --- | --- |
| `dynamicParams` | `boolean` | `true` |
| `runtime` | `'nodejs' \| 'edge' (deprecated)` | `'nodejs'` |
| `preferredRegion` | `'auto' \| 'global' \| 'home' \| string \| string[] (deprecated)` | `'auto'` |
| `maxDuration` | `number` | Set by deployment platform |

Plus the two Cache Components additions documented alongside them: [`instant`](10-instant-navigations/04-instant-insights-and-validation.md) and `prefetch`.

What is *gone* matters as much as what is there. From the version history:

> *"`v16.0.0` — `dynamic`, `dynamicParams`, `revalidate`, and `fetchCache` removed when Cache Components is enabled."*
> *"`v16.0.0` — `export const experimental_ppr = true` removed. A codemod is available."*

So a page carrying `export const revalidate = 60` is not merely stale advice under `cacheComponents`; that option no longer exists in that mode, and its replacement is `'use cache'` with `cacheLife`.

## The three `prefetch` values

```tsx
type Prefetch = 'auto' | 'partial' | 'force-disabled'

export const prefetch: Prefetch = 'partial'
```

**`'auto'`** is the default and means "let the framework decide based on `partialPrefetching`". The docs ask you not to write it:

> *"The meaningful values to set are `'partial'` and `'force-disabled'`. `'auto'` is the default and is equivalent to omitting the export; don't write `prefetch = 'auto'` explicitly."*

**`'partial'`** opts this destination into Partial Prefetching without the global flag — a `<Link>` pointing at it loads the per-route App Shell instead of the legacy full prefetch. It is the incremental adoption tool covered in [10 · 3 · Per-link prefetching and adoption](10-instant-navigations/03-per-link-prefetching-and-incremental-adoption.md).

**`'force-disabled'`** never prefetches this segment:

> *"Never prefetch this segment. The client will not request segment data ahead of navigation. Use this for segments where prefetching would be wasteful, for example pages behind authentication that are rarely visited."*

with two documented holes: it does not prevent metadata about the route being prefetched, and a per-link prefetch of an *ancestor* includes all downstream segments in the same response — `force-disabled` ones included.

## Intent versus ceiling

> *"A prefetch starts with a `<Link>` that expresses intent (should this destination be prefetched, and how eagerly), and ends at a segment that sets a cost ceiling (how much work is it OK to do ahead of time, for any link that points here). A destination can't know which links target it, so the segment config caps what any `<Link prefetch={true}>` pulls."*

| | `'partial'` destination | `'force-disabled'` destination |
| --- | --- | --- |
| `<Link href>` (default) | App Shell | no segment data |
| `<Link href prefetch={true}>` | App Shell **plus** resolved URL data and the cached content behind it | no segment data |
| `<Link href prefetch={false}>` | nothing — the link opts out regardless of the destination | nothing |

The link always wins downward: `prefetch={false}` skips prefetching whatever the destination allows. The destination always wins upward: no link can pull more than the segment's ceiling.

One cost note that decides where you spend server CPU:

> *"On pages where all the content is statically renderable, Next.js serves prefetches from the static cache (or a CDN). If a page accesses non-static data like cookies or headers, it's prefetched at runtime with a fresh server render, which costs server CPU per page view."*

## `useLinkStatus`

```tsx title="app/components/loading-indicator.tsx"
'use client'

import { useLinkStatus } from 'next/link'

export default function LoadingIndicator() {
  const { pending } = useLinkStatus()
  return (
    <span aria-hidden className={`link-hint ${pending ? 'is-pending' : ''}`} />
  )
}
```

```tsx title="app/shop/layout.tsx"
import Link from 'next/link'
import LoadingIndicator from './components/loading-indicator'

function Menubar() {
  return (
    <div>
      {links.map((link) => (
        <Link key={link.label} href={link.href}>
          <span className="label">{link.label}</span> <LoadingIndicator />
        </Link>
      ))}
    </div>
  )
}
```

It returns one property: `pending`, *"`true` before history updates, `false` after"*. The documented conditions for it being useful are narrow:

> *"Prefetching is disabled or in progress meaning navigation is blocked."*
> *"The destination route is dynamic **and** doesn't include a `loading.js` file that would allow an instant navigation."*

and the framing is deliberately grudging:

> *"Navigation is typically fast. Use `useLinkStatus` as a quick patch when you identify a slow transition, then iterate to fix the root cause with prefetching or a `loading.js` fallback."*

The docs' own CSS pattern for it starts the hint invisible with reserved space and delays the animation, so a fast navigation shows nothing at all:

```css title="app/styles/global.css"
.link-hint {
  display: inline-block;
  width: 0.6em;
  height: 0.6em;
  opacity: 0;
  visibility: hidden; /* reserve space without showing the hint */
}

.link-hint.is-pending {
  visibility: visible;
  animation-name: fadeIn, pulse;
  animation-duration: 200ms, 1s;
  /* Appear only if navigation actually takes time */
  animation-delay: 100ms, 100ms;
  animation-fill-mode: forwards, none;
}
```

## Gotchas

**★ The `useLinkStatus` indicator you tuned in development may never appear in production.**
Two documented facts collide: *"If the linked route has been prefetched, the pending state will be skipped"*, and Next.js does not prefetch in development. So the pending phase you can see locally is an artefact of the dev server. If the destination is static and prefetched, production users skip it entirely. That is the *good* outcome — but it means the component is untested by your local experience, and it is why the hook is documented as most useful with `prefetch={false}`.

**★ `useLinkStatus` in the Pages Router is a silent no-op.**
> *"This hook is not supported in the Pages Router and always returns `{ pending: false }`."*

No warning, no error — the indicator simply never fires. In a codebase with both routers, a shared component using it will work on one side of the app and quietly do nothing on the other.

**★ It must be a descendant of a `<Link>`, and it must be a Client Component.**
Rendered outside a `<Link>` subtree it has no link to report on. It also needs `'use client'`, so putting it in a shared server-rendered nav means splitting the indicator into its own client file — which is exactly what the documented example does.

**★ Inline indicators cause layout shift unless you reserve the space.**
> *"Inline indicators can easily introduce layout shifts. Prefer a fixed-size, always-rendered hint element and toggle its opacity, or use an animation."*

The documented CSS uses `visibility: hidden` on a fixed-size element rather than conditional rendering, plus a 100 ms animation delay so a fast navigation never flashes.

**★ Clicking several links quickly shows only the last one's pending state.**
Documented behaviour: *"When clicking multiple links in quick succession, only the last link's pending state is shown."* A per-link spinner in a dense nav will therefore look inconsistent under impatient clicking, and that is not a bug you can fix.

**★ Writing `export const prefetch = 'auto'` is explicitly discouraged.**
It is the default and equivalent to omitting the export, so it adds a line that looks like a decision and encodes none. Worse, it survives the `remove-partial-prefetch` codemod — which only strips `'partial'` — so it accumulates.

**★ `prefetch` and `instant` do nothing without `cacheComponents`, and throw in Client Components.**
`prefetch` *"cannot be used when the segment is a Client Component"*, and both exports only work with Cache Components enabled. A page that gains `'use client'` long after someone added a `prefetch` export is the realistic path into this.

**★ `preferredRegion` and `runtime: 'edge'` are both deprecated in the 16.3 segment config table.**
They still appear in the reference with a `(deprecated)` marker. Treat new uses as technical debt; note in particular that the `proxy` convention that replaced `middleware` does not support the edge runtime at all — its runtime is `nodejs` and cannot be configured.

**★ `revalidate`, `dynamic`, `dynamicParams` and `fetchCache` are removed under Cache Components.**
Not deprecated — removed when `cacheComponents` is enabled. A page still exporting `revalidate = 60` needs to move to `'use cache'` with `cacheLife`. Similarly `experimental_ppr` was removed in 16.0 and has its own codemod.

**★ `force-disabled` on a rarely-visited authenticated page is the documented use, and it is not airtight.**
It stops segment data being requested ahead of navigation for that segment and everything deeper, but route metadata is still prefetched, and a per-link prefetch aimed at an ancestor pulls downstream segments — including this one — into the same response.

## Interview questions

**★ Why does the prefetch *ceiling* live on the destination rather than on the link?**
Because a destination cannot know which links point at it. The link is where intent lives — the author knows whether users are likely to go there — and the segment is where cost lives, because it is the only place that can cap what *any* link pulls. `'partial'` caps a `<Link prefetch={true}>` at the App Shell plus resolved URL data; `'force-disabled'` caps it at nothing.

**★ Which side wins when a link and a destination disagree?**
Both, in their own direction. `<Link prefetch={false}>` skips prefetching regardless of how the destination is configured, so the link can always ask for less. And no link can pull more than the destination's ceiling allows, so the segment can always cap. There is no configuration in which a link overrides `force-disabled`.

**★ Why should you never write `export const prefetch = 'auto'`?**
It is the default and exactly equivalent to omitting the export, so it looks like a decision while encoding none. It is also not removed by the `remove-partial-prefetch` codemod, which strips only `'partial'`, so it lingers in the codebase indefinitely.

**★ What does `useLinkStatus` return, and when is it genuinely useful?**
A single `pending` boolean, `true` before the history entry updates and `false` after. It is useful when prefetching is disabled or still in flight so the navigation is actually blocked, or when the destination is dynamic and has no `loading.js` to provide an instant route-level fallback. The docs frame it as a patch for an identified slow transition, not a default piece of UI.

**★ Your loading hint works perfectly in `next dev` and users never see it. Explain.**
Because the pending state is skipped when the destination has been prefetched, and development does not prefetch at all. Locally every navigation blocks, so the hint always fires; in production a prefetched route commits without a pending phase. The hook is documented as most useful in combination with `prefetch={false}`, which is exactly the case where the pending phase genuinely exists in production.

**★ How do you build the indicator without causing layout shift?**
Render it unconditionally at a fixed size with `visibility: hidden` and zero opacity so it always occupies its space, then toggle a class to reveal it — and give the reveal an animation delay of around 100 ms so a fast navigation never produces a flash. The docs give exactly this pattern rather than conditional rendering.

**★ A page in a Cache Components app still exports `revalidate = 60`. What do you tell the author?**
That the option was removed when `cacheComponents` is enabled — along with `dynamic`, `dynamicParams` and `fetchCache` — and the replacement is `'use cache'` with a `cacheLife` profile. The same 16.0 change removed `experimental_ppr`, for which a codemod exists; PPR is now opted into with the `cacheComponents` config instead.

{/* FOOTER */}
