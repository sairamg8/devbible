---
title: "02 · Routing and navigation"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-04 against the Next.js file-convention references (`layout`, `template`,
> `loading`, `error`, `not-found`, `default`, `dynamic-routes`, `proxy`, `instant`, `prefetch`),
> the [Link](https://nextjs.org/docs/app/api-reference/components/link) and
> [useRouter](https://nextjs.org/docs/app/api-reference/functions/use-router) references, the
> [prefetching](https://nextjs.org/docs/app/guides/prefetching),
> [view transitions](https://nextjs.org/docs/app/guides/view-transitions) and
> [internationalization](https://nextjs.org/docs/app/guides/internationalization) guides, the
> [version 16 upgrade guide](https://nextjs.org/docs/app/guides/upgrading/version-16)
> (`lastUpdated: 2026-08-25`) and `react.dev` for `<ViewTransition>`.
> Documentation-verified; **no timings, no sandbox run**.
> Target: **Next.js 16.3.4 · React 19.2 · Node 24**.

**Routing is the part of Next.js 16 that changed most and announces it least.** Synchronous
`params` is gone rather than deprecated. Every parallel-route slot now needs a `default.js` or
the build fails. `middleware.ts` is `proxy.ts`, it runs on **Node.js** rather than the edge, and
the globals you relied on there work in development and silently do nothing in production.
Prefetching was rebuilt around layout deduplication and incremental fetches. None of that
produces a helpful error at the moment you get it wrong, which is why this chapter is long: the
failure modes are quiet, and most of what is written about App Router routing predates them.

## Chunks

| # | Page |
|---|---|
| 1 | **[01 · Special files](01-file-system-routing-pagetsx.md)** |
| 2 | **[01b · layout.tsx](01b-layout-and-the-root-layout.md)** |
| 3 | **[01c · Layout vs template](01c-layout-vs-template.md)** |
| 4 | **[01d · loading.tsx](01d-loading-tsx-and-the-suspense-boundary.md)** |
| 5 | **[01e · error.tsx](01e-error-and-not-found-boundaries.md)** |
| 6 | **[01f · not-found.tsx](01f-not-found-and-the-notfound-function.md)** |
| 7 | **[01g · global-not-found.js](01g-global-not-found.md)** |
| 8 | **[02 · Nested layouts and route groups](02-nested-layouts-parallel-routes-slot-intercepting-routes-rout.md)** |
| 9 | **[02b · Parallel routes](02b-parallel-routes-and-named-slots.md)** |
| 10 | **[02c · `default.js` required](02c-defaultjs-is-required-in-nextjs-16.md)** 🔴 builds fail without it |
| 11 | **[02d · Intercepting routes](02d-intercepting-routes-and-the-modal-pattern.md)** |
| 12 | **[03 · Dynamic routes](03-dynamic-routes-slug-catch-all-optional-catch-all.md)** |
| 13 | **[03b · Reading params](03b-reading-params.md)** 🔴 `params` is a Promise in 16 |
| 14 | **[03c · Typing params](03c-typing-params-with-the-generated-helpers.md)** |
| 15 | **[03d · generateStaticParams](03d-generatestaticparams-strategies.md)** |
| 16 | **[03e · gSP under Cache Components](03e-generatestaticparams-under-cache-components.md)** |
| 17 | **[03f · Nested dynamic segments](03f-nested-dynamic-segments-and-route-handlers.md)** |
| 18 | **[03g · dynamicParams and precedence](03g-dynamicparams-and-route-matching-precedence.md)** ⚠️ precedence is undocumented for `app/` |
| 19 | **[04 · The Link component](04-navigation-mechanics-link-userouter-redirect-notfound.md)** |
| 20 | **[04b · Scroll on navigation](04b-scroll-behaviour-and-the-navigation-lifecycle.md)** |
| 21 | **[04c · onNavigate vs onClick](04c-onnavigate-and-blocking-navigation.md)** |
| 22 | **[04d · Blocking navigation](04d-blocking-navigation-and-what-it-cannot-see.md)** |
| 23 | **[04e · useRouter](04e-userouter-programmatic-navigation-and-refresh.md)** |
| 24 | **[04f · Prefetching by hand](04f-prefetching-by-hand-and-ejecting-from-link.md)** |
| 25 | **[04g · redirect and permanentRedirect](04g-redirect-and-permanentredirect.md)** 🔴 it throws — never inside `try` |
| 26 | **[04h · notFound()](04h-notfound-and-the-not-found-boundary.md)** |
| 27 | **[04i · not-found.js and the status](04i-the-not-found-boundary-and-the-404-status.md)** |
| 28 | **[04j · usePathname and useSearchParams](04j-usepathname-and-usesearchparams.md)** 🔴 the Suspense requirement |
| 29 | **[04k · Query state in practice](04k-query-state-in-practice.md)** |
| 30 | **[05 · Prefetching fundamentals](05-prefetching-fundamentals-and-the-native-view-transitions-api.md)** ⚠️ production only |
| 31 | **[05b · View Transitions](05b-the-native-view-transitions-api.md)** |
| 32 | **[05c · Morph and Suspense reveal](05c-view-transition-patterns.md)** |
| 33 | **[05d · Slides and crossfades](05d-directional-slides-and-same-route-crossfades.md)** |
| 34 | **[06 · Instant Navigations: status and vocabulary](06-163-preview-instant-navigations-stream-cache-block-and-parti.md)** 🔴 the preview shipped stable |
| 35 | **[06b · The Insight catalogue](06b-instant-insights-and-the-fix-cards.md)** |
| 36 | **[06c · Stream and Cache in detail](06c-stream-cache-and-block-in-detail.md)** |
| 37 | **[06d · Block, and opting out honestly](06d-block-and-opting-out-honestly.md)** |
| 38 | **[07 · `proxy.ts`: the deployment boundary](07-the-proxyts-layer-successor-to-middlewarets-request-intercep.md)** 🔴 Node.js, not edge |
| 39 | **[07b · Adopting proxy: rename, limits, platforms](07b-adopting-proxy-the-rename-the-limits-and-where-it-runs.md)** |
| 40 | **[07c · The matcher syntax](07c-the-matcher-and-what-it-silently-skips.md)** |
| 41 | **[07d · What the matcher skips](07d-what-the-matcher-silently-skips.md)** 🔴 Server Functions are POSTs |
| 42 | **[07e · Inside the proxy function](07e-inside-the-proxy-function.md)** |
| 43 | **[07f · Flags, the body buffer, testing](07f-proxy-flags-the-body-buffer-and-testing.md)** |
| 44 | **[08 · Localized routing](08-localized-routing-i18n-locale-prefixed-routes-locale-detecti.md)** ⚠️ the `i18n` config is Pages Router only |
| 45 | **[08b · Dictionaries and the locale](08b-dictionaries-and-reading-the-locale.md)** |
| 46 | **[08c · Negotiating and redirecting](08c-negotiating-a-locale-and-redirecting.md)** |
| 47 | **[11 · Root params](11-root-params.md)** |
| 48 | **[11b · Root params: restrictions and typing](11b-root-params-restrictions-and-typing.md)** |
| 49 | **[13 · Prefetch inlining](13-prefetch-inlining.md)** |
| 50 | **[13b · Prefetch control and link status](13b-prefetch-control-and-link-status.md)** |

## Phase gate

You are done with this chapter when you can **lay out a non-trivial route tree and defend each
choice**: where a layout ends and a template begins, which segments are dynamic and what their
`params` cost at prerender time, where a parallel route earns its `default.js`, and what belongs
in `proxy.ts` versus a Server Component.

You should also be able to name **what changed in 16 that older writing still gets wrong** —
synchronous `params` removed rather than deprecated, `default.js` now build-breaking, middleware
renamed to proxy and moved to Node.js, and prefetching rebuilt around deduplication.

## 🔴 What this chapter could not confirm, and says so

- **App Router route-matching precedence.** Not documented for `app/` anywhere — proven by
  grepping the full `llms-full.txt` export, not assumed. Only the Pages Router API-routes doc
  states it. Written as *"the strong expectation and not a documented guarantee."*
- **What happens when a parallel-route slot has no `default.js`.** Three live pages disagree —
  the upgrade guide says builds fail, the Parallel Routes reference still says a 404 renders.
  All three quoted side by side; the upgrade guide named as the one to act on.
- **Which patch shipped `export const instant` / `export const prefetch`.** The published
  version history prints a literal `v16.x.x` placeholder. No version asserted.
- **How long a browser caches a 308.** Neither Next.js nor MDN states it.
- **Why the Edge runtime was deprecated.** No rationale published anywhere.

## Where this connects

- [03 · Server vs Client Components](../03-server-components-vs-client-components/01-explanation.md) — the boundary every navigation hook runs into
- [05 · Caching, PPR and Cache Components](../05-caching-ppr-and-cache-components/01-explanation.md) — `cacheComponents`, which `instant` and `partialPrefetching` both require
- [11 · Performance and Turbopack](../11-performance-optimization-turbopack/01-explanation.md) — where the `runtime = 'edge'` withdrawal is covered in full
- [12 · SEO, metadata and accessibility](../12-seo-metadata-and-accessibility/01-explanation.md) — localized metadata and canonicals for the routes defined here

---

Start → [01 · Special files](01-file-system-routing-pagetsx.md)
