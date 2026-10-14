---
title: "Link map · Next.js · Part 1 (chapters 1–3)"
sidebar_label: "01 · foundations"
sidebar_position: 1
---

# Link map · Next.js · Part 1 (chapters 1–3)

Covers every topic row of chapters 1, 2 and 3 in `docs/nextjs/syllabus/01-foundations.md`: introduction to Next.js (T01-01 to T01-07), routing and navigation (T02-01 to T02-08) and Server versus Client Components (T03-01 to T03-06). That is 21 rows; every one has a written page of ours (a chunked topic shows its first chunk file). Syllabus bullets that start with "Project Milestone" are not topics and are skipped (none occur in this part).
*read* = I read the passage that supports the claim; *headings only* = fetched at 200, headings or opening checked. Third-party links carry a date only where the page shows one. No `#anchors` are given. Where no good non-official explanation turned up, the block has no "Beyond the docs" line.

🔴 **Version note.** Our target is **Next.js 16.3** (stable 16.3.4 on 2026-09-03) and **React 19.2**. The live `nextjs.org/docs` pages fetched on 2026-10-14 carry `version: 16.4.0` in their front matter, so they are slightly ahead of our target; the concepts below are unchanged. Two official pages still carry old text: the Pages-to-App migration guide is written for Next 13 (it says Node 18.17), and the routing sections of the older `docs/13` to `docs/15` URLs differ on details. Every official link below is the unversioned current URL. Third-party picks are flagged where they predate 16.

---

## Chapter 1 — Introduction to Next.js

### T01-01 · Pages Router to App Router — ✅ written `docs/nextjs/pages/01-introduction-to-next-js/01-evolution-from-pages-router-to-app-router-why-app-router-is.md`
- **Read this:** [How to migrate from Pages to the App Router](https://nextjs.org/docs/app/guides/migrating/app-router-migration) · nextjs.org · the side-by-side table of what replaced what (`getServerSideProps` to async Server Components, `_app`/`_document` to the root layout, API routes to Route Handlers) and the "both routers run together" rule (*read*) · covers our angle: **partial** — written for Next 13 (Node 18.17, `cache: 'no-store'` examples), so it explains the "why it replaced X" but not why it is now the standard; skim the Node line · fetched 2026-10-14
- **Beyond the docs:** [Migrating from Pages Router to App Router: An Incremental Guide](https://clerk.com/blog/migrating-pages-router-to-app-router-an-incremental-guide) · Clerk blog, no author or date shown · a page-by-page recipe (root layout from `_document`, a `use client` wrapper for `_app`, a `ClientPage` plus a server `page`), written before Next 15/16 · fetched 2026-10-14 (*read*)
- **Our delta:** why App Router is the standard now (Cache Components, `proxy.ts`, async request APIs), not just how to move.

### T01-02 · Next.js vs Remix/React Router v7, Astro, TanStack Start — ✅ written `docs/nextjs/pages/01-introduction-to-next-js/02-nextjs-vs-alternatives-remix-react-router-v7-astro-tanstack.md`
- **Read this:** [Comparison: TanStack Start vs Next.js vs React Router](https://tanstack.com/start/latest/docs/framework/react/comparison) · tanstack.com · a feature matrix checked against Next 16.3 and React Router 8.3 in September 2026, with an honest "when to choose each" and a warning that it proves no performance winner (*read*) · covers our angle: **partial** — vendor-authored by TanStack, no Astro column · fetched 2026-10-14
- **Beyond the docs:** [Five Alternatives to Next.js](https://blog.openreplay.com/next-js-alternatives/) · OpenReplay Team, 2026-05-28 · one paragraph each on React Router v7, Astro and TanStack Start with the "who should switch" call; says TanStack Start was still RC in mid-2026, so check that line · fetched 2026-10-14 (*read*)
- **Our delta:** SEO and performance trade-offs framed against a SaaS dashboard (SprintDesk), with Astro scoped to content sites.

### T01-03 · Core philosophy: server-first, zero client JS, hybrid — ✅ written `docs/nextjs/pages/01-introduction-to-next-js/03-core-philosophy-server-first-rendering.md`
- **Read this:** [Server and Client Components](https://nextjs.org/docs/app/getting-started/server-and-client-components) · nextjs.org · layouts and pages are Server Components by default, the RSC Payload, HTML plus hydration on first load, and the "reduce JS bundle size" example (*read*) · covers our angle: **partial** — server-first yes; static versus dynamic hybrid is in the next link · fetched 2026-10-14
- **Also good:** [Next.js Rendering Philosophy](https://nextjs.org/docs/app/guides/rendering-philosophy) · nextjs.org · static and dynamic as a spectrum at the component level, not the route level (*read*) · fetched 2026-10-14
- **Beyond the docs:** [Making Sense of React Server Components](https://joshwcomeau.com/react/server-components/) · Josh Comeau, 2023-09-06, updated 2025-05-09 · builds the mental model that Server Components run once on the server and never ship, while Client Components still render on the server and then hydrate · fetched 2026-10-14 (*read*)
- **Our delta:** the cost model for the hybrid (what makes a route dynamic).

### T01-04 · Versioning, LTS, stable/canary/preview — ✅ written `docs/nextjs/pages/01-introduction-to-next-js/04-versioning-and-lts-model-what-stable-canary-and-preview-mean.md`
- **Read this:** [Next.js Support Policy](https://nextjs.org/support-policy) · nextjs.org · Active LTS until the next major, then Maintenance LTS for two years (critical fixes only, shipped as semver-minor), and canary is published daily and not for production traffic (*read*) · covers our angle: **full** — the table lists 16.x Active and 15.x Maintenance · fetched 2026-10-14
- **Also good:** [Next.js 16.3](https://nextjs.org/blog/next-16-3) · nextjs.org blog · the stable release post that replaces the "16.3 is in preview" callout (*headings only*) · fetched 2026-10-14
- **Our delta:** how to read the channel before adopting a feature; the syllabus callout is stale (stable is 16.3.4).

### T01-05 · Project setup: create-next-app — ✅ written `docs/nextjs/pages/01-introduction-to-next-js/05-project-setup-create-next-app-turbopack-defaults-typescript.md`
- **Read this:** [create-next-app](https://nextjs.org/docs/app/api-reference/cli/create-next-app) · nextjs.org · every flag with its default: TypeScript, Tailwind, Turbopack and `AGENTS.md` on by default, `--eslint` / `--biome` / `--no-linter`, `--react-compiler`, `--cache-components` (*read*) · covers our angle: **full** · fetched 2026-10-14
- **Also good:** [Installation](https://nextjs.org/docs/app/getting-started/installation) · nextjs.org · Node 20.9 floor, the `--yes` quick start, `next lint` removal, linting via the ESLint or Biome CLI (*read*) · fetched 2026-10-14
- **Our delta:** what each default is for and what to change for SprintDesk.

### T01-06 · Hello World with the app/ directory — ✅ written `docs/nextjs/pages/01-introduction-to-next-js/06-hello-world-with-the-app-directory.md`
- **Read this:** [Installation: Create the app directory](https://nextjs.org/docs/app/getting-started/installation) · nextjs.org · the required root layout with `html` and `body`, then `app/page.tsx` rendering at `/`; notes `next dev` creates a missing root layout (*read*) · covers our angle: **full** · fetched 2026-10-14
- **Also good:** [Layouts and Pages](https://nextjs.org/docs/app/getting-started/layouts-and-pages) · nextjs.org · a page, a layout, nesting and a dynamic segment in one short tour (*headings only*) · fetched 2026-10-14
- **Our delta:** the first request traced end to end.

### T01-07 · Key framework shifts: React Compiler, async params, Node 20+ — ✅ written `docs/nextjs/pages/01-introduction-to-next-js/07-key-framework-shifts-stable-react-compiler-support.md`
- **Read this:** [How to upgrade to version 16](https://nextjs.org/docs/app/guides/upgrading/version-16) · nextjs.org · Node 20.9 / TypeScript 5.1 floor, synchronous `params` and `searchParams` removed (with `next typegen` helpers), `reactCompiler: true` stable but off by default and slower to build (*read*) · covers our angle: **full** · fetched 2026-10-14
- **Also good:** [Next.js 16](https://nextjs.org/blog/next-16) · nextjs.org blog · the release post, including the React Compiler support section (*headings only*) · fetched 2026-10-14
- **Our delta:** the Rust React Compiler port is experimental (`experimental.turbopackRustReactCompiler`); neither linked page covers it.

---

## Chapter 2 — Routing and Navigation

### T02-01 · File-system routing and special files — ✅ written `docs/nextjs/pages/02-routing-and-navigation/01-file-system-routing-pagetsx.md`
- **Read this:** [Layouts and Pages](https://nextjs.org/docs/app/getting-started/layouts-and-pages) · nextjs.org · folders are routes, `page` makes one public, `layout` wraps and persists (*read*) · covers our angle: **partial** — page and layout only · fetched 2026-10-14
- **Also good:** [Template](https://nextjs.org/docs/app/api-reference/file-conventions/template) · nextjs.org · a template remounts on navigation, and a Suspense fallback in it shows on every navigation (*read*) · fetched 2026-10-14; plus [loading](https://nextjs.org/docs/app/api-reference/file-conventions/loading), [error](https://nextjs.org/docs/app/api-reference/file-conventions/error) and [not-found](https://nextjs.org/docs/app/api-reference/file-conventions/not-found) (*headings only*) · fetched 2026-10-14
- **Our delta:** the render order of the six files in one picture.

### T02-02 · Nested layouts, parallel routes, intercepting routes, route groups — ✅ written `docs/nextjs/pages/02-routing-and-navigation/02-nested-layouts-parallel-routes-slot-intercepting-routes-rout.md`
- **Read this:** [Parallel Routes](https://nextjs.org/docs/app/api-reference/file-conventions/parallel-routes) · nextjs.org · named `@folder` slots passed to the parent layout as props, with `default.js` as fallback (*read*) · covers our angle: **partial** — slots only · fetched 2026-10-14
- **Also good:** [Intercepting Routes](https://nextjs.org/docs/app/api-reference/file-conventions/intercepting-routes) · nextjs.org · the `(.)` / `(..)` convention and the modal recipe (shareable URL, survives refresh, back closes it) (*read*) · fetched 2026-10-14; [Route Groups](https://nextjs.org/docs/app/api-reference/file-conventions/route-groups) · nextjs.org · organizing without changing the URL (*read*) · fetched 2026-10-14
- **Beyond the docs:** [Maximizing Routing Flexibility with Next.js Parallel and Intercepting Routes](https://www.thisdot.co/blog/maximizing-routing-flexibility-with-next-js-parallel-and-intercepting-routes) · Mattia Magi, This Dot Labs, 2024-04-05 · builds the shareable modal end to end; names no Next version and the page warns it is old, so the missing-`default.js` break in 16 is not covered · fetched 2026-10-14 (*read*)
- **Our delta:** `default.js` is now mandatory in 16 (builds fail without it).

### T02-03 · Dynamic routes, catch-all, optional catch-all — ✅ written `docs/nextjs/pages/02-routing-and-navigation/03-dynamic-routes-slug-catch-all-optional-catch-all.md`
- **Read this:** [Dynamic Route Segments](https://nextjs.org/docs/app/api-reference/file-conventions/dynamic-routes) · nextjs.org · `[slug]`, `[...slug]`, `[[...slug]]`, the TypeScript shapes, and behaviour under Cache Components (*read*) · covers our angle: **full** · fetched 2026-10-14
- **Our delta:** match precedence and `generateStaticParams` strategies (our chunks 03d to 03g).

### T02-04 · Navigation mechanics: Link, useRouter, redirect, notFound — ✅ written `docs/nextjs/pages/02-routing-and-navigation/04-navigation-mechanics-link-userouter-redirect-notfound.md`
- **Read this:** [Linking and Navigating](https://nextjs.org/docs/app/getting-started/linking-and-navigating) · nextjs.org · server rendering, prefetching, streaming and client transitions, then what makes a transition slow (*read*) · covers our angle: **partial** — concept page; the API is in the next links · fetched 2026-10-14
- **Also good:** [Link](https://nextjs.org/docs/app/api-reference/components/link) · nextjs.org · `prefetch`, `scroll`, `onNavigate` and `transitionTypes` props (*read*) · fetched 2026-10-14; [redirect](https://nextjs.org/docs/app/api-reference/functions/redirect), [notFound](https://nextjs.org/docs/app/api-reference/functions/not-found) and [useRouter](https://nextjs.org/docs/app/api-reference/functions/use-router) (*headings only*) · fetched 2026-10-14
- **Our delta:** which of the four works in which environment, and what `redirect()` throws.

### T02-05 · Prefetching and native View Transitions via Link — ✅ written `docs/nextjs/pages/02-routing-and-navigation/05-prefetching-fundamentals-and-the-native-view-transitions-api.md`
- **Read this:** [Prefetching](https://nextjs.org/docs/app/guides/prefetching) · nextjs.org · how prefetching works, what is prefetched automatically, and how to control or disable it (*headings only*) · covers our angle: **partial** — prefetch half only · fetched 2026-10-14
- **Also good:** [Designing view transitions](https://nextjs.org/docs/app/guides/view-transitions) · nextjs.org · how to use view transitions during navigation and loading (*read*) · fetched 2026-10-14; the `transitionTypes` prop on [Link](https://nextjs.org/docs/app/api-reference/components/link) · it is the real Link hook, there is no `viewTransition` prop (*read*) · fetched 2026-10-14
- **Our delta:** directional slides and same-route crossfades (chunks 05b to 05d).

### T02-06 · 16.3 Instant Navigations and Partial Prefetching — ✅ written `docs/nextjs/pages/02-routing-and-navigation/06-163-preview-instant-navigations-stream-cache-block-and-parti.md`
- **Read this:** [Ensuring instant navigations](https://nextjs.org/docs/app/guides/instant-navigation) · nextjs.org · what "instant" means, building the static shell, validating in DevTools and in CI, and fixing a navigation that blocks (*read*) · covers our angle: **full** — current docs; the syllabus "Preview" label is stale · fetched 2026-10-14
- **Also good:** [Next.js 16.3](https://nextjs.org/blog/next-16-3) · nextjs.org blog · Instant Insights and Partial Prefetching sections (*headings only*) · fetched 2026-10-14; [Building app-like experiences with Next.js 16.3](https://nextjs.org/blog/building-app-like-experiences-with-nextjs-16-3) · nextjs.org blog (*headings only*) · fetched 2026-10-14
- **Beyond the docs:** [Next.js 16.3 Instant Navigations](https://alexcloudstar.com/blog/nextjs-16-3-instant-navigations-cache-components/) · Alex Cloudstar, 2026-08-31 · frames Partial Prefetching as a cost fix over `prefetch={true}` and shows the `instant = false` opt-out · fetched 2026-10-14 (*read*)
- **Our delta:** the opt-in flag pair and the Stream / Cache / Block decision (chunks under 10-instant-navigations).

### T02-07 · The proxy.ts layer — ✅ written `docs/nextjs/pages/02-routing-and-navigation/07-the-proxyts-layer-successor-to-middlewarets-request-intercep.md`
- **Read this:** [proxy.js](https://nextjs.org/docs/app/api-reference/file-conventions/proxy) · nextjs.org · the `proxy` export, matcher, execution order, Node.js runtime; warns that a matcher change can silently remove coverage and to verify auth inside each Server Function, not in Proxy alone (*read*) · covers our angle: **full** · fetched 2026-10-14
- **Also good:** [Data Security](https://nextjs.org/docs/app/guides/data-security) · nextjs.org · the data-layer auth pattern the Proxy page points to (*headings only*) · fetched 2026-10-14
- **Beyond the docs:** [Next.js 16 middleware change](https://www.buildwithmatija.com/blog/nextjs16-middleware-change) · Matija Žiberna, 2025-10-14 · ties the rename to the March 2025 middleware-bypass CVE and argues for data-layer checks; an opinion piece, not official · fetched 2026-10-14 (*read*)
- **Our delta:** the matcher's silent skips and testing flags (chunks 07c to 07f).

### T02-08 · Localized routing (i18n) — ✅ written `docs/nextjs/pages/02-routing-and-navigation/08-localized-routing-i18n-locale-prefixed-routes-locale-detecti.md`
- **Read this:** [Internationalization](https://nextjs.org/docs/app/guides/internationalization) · nextjs.org · sub-path versus domain routing, locale from `Accept-Language`, everything under `app/[lang]`, dictionaries by locale (*read*) · covers our angle: **partial** — no root params in the body · fetched 2026-10-14
- **Also good:** [next-root-params](https://nextjs.org/docs/app/api-reference/functions/next-root-params) · nextjs.org · reading `[lang]` without prop-drilling (*headings only*) · fetched 2026-10-14
- **Our delta:** root params restrictions, `prefetchInlining`, `useLinkStatus` (the ➕ items in the syllabus).

---

## Chapter 3 — Server Components vs. Client Components

### T03-01 · Default architecture: everything is a Server Component — ✅ written `docs/nextjs/pages/03-server-components-vs-client-components/01-default-architecture-everything-is-a-server-component-rsc.md`
- **Read this:** [Server and Client Components](https://nextjs.org/docs/app/getting-started/server-and-client-components) · nextjs.org · when to pick which, the RSC Payload and the first-load versus later-navigation flow (*read*) · covers our angle: **full** · fetched 2026-10-14
- **Also good:** [Server Components](https://react.dev/reference/rsc/server-components) · react.dev · the framework-neutral definition (*headings only*) · fetched 2026-10-14; [The Server and Client Boundary](https://nextjs.org/docs/app/guides/server-and-client-boundary) · nextjs.org · a table of where each type runs (a Client Component also renders on the server) (*read*) · fetched 2026-10-14
- **Beyond the docs:** [Making Sense of React Server Components](https://joshwcomeau.com/react/server-components/) · Josh Comeau, 2023-09-06, updated 2025-05-09 · same mental model through running examples (*read*) · fetched 2026-10-14
- **Our delta:** direct data access and the secure environment, with SprintDesk queries.

### T03-02 · use client: when and why — ✅ written `docs/nextjs/pages/03-server-components-vs-client-components/02-use-client-when-and-why-to-opt-in-interactivity-browser-apis.md`
- **Read this:** [use client](https://nextjs.org/docs/app/api-reference/directives/use-client) · nextjs.org · the directive as a module-graph boundary (*headings only*) · covers our angle: **partial** · fetched 2026-10-14
- **Also good:** [Server and Client Components: Using Client Components](https://nextjs.org/docs/app/getting-started/server-and-client-components) · nextjs.org · state, effects and browser APIs as the triggers; imports of a client file join the bundle (*read*) · fetched 2026-10-14; [react.dev 'use client'](https://react.dev/reference/rsc/use-client) · react.dev (*headings only*) · fetched 2026-10-14
- **Our delta:** wrapping third-party components that lack the directive.

### T03-03 · Composition patterns: boundaries, serializable props, children slots — ✅ written `docs/nextjs/pages/03-server-components-vs-client-components/03-composition-patterns-server-to-client-boundaries.md`
- **Read this:** [The Server and Client Boundary: Crossing the boundary](https://nextjs.org/docs/app/guides/server-and-client-boundary) · nextjs.org · code crosses by import, data by serializable props, and rendered output passed as `children` keeps a Server Component out of the client graph (*read*) · covers our angle: **full** · fetched 2026-10-14
- **Beyond the docs:** [Navigating the Interplay of Server and Client Components in Next.js](https://leapcell.io/blog/navigating-the-interplay-of-server-and-client-components-in-next-js) · Takashi Yamamoto, Leapcell, 2025-08-13 · wrapper components receiving `children` and named slot props; shorter than the official guide · fetched 2026-10-14 (*read*)
- **Our delta:** the context-provider placement rule and compound components across the boundary.

### T03-04 · React 19.2 primitives: useEffectEvent and Activity — ✅ written `docs/nextjs/pages/03-server-components-vs-client-components/04-react-192-primitives-useeffectevent-for-non-reactive-side-ef.md`
- **Read this:** [useEffectEvent](https://react.dev/reference/react/useEffectEvent) · react.dev · reads the latest props and state without re-running the Effect, and may only be called from Effects or other Effect Events (*read*) · covers our angle: **partial** — hook only · fetched 2026-10-14
- **Also good:** [Activity](https://react.dev/reference/react/Activity) · react.dev · `visible` / `hidden` modes; hidden keeps state and DOM, uses `display: none` and cleans up Effects (*read*) · fetched 2026-10-14; [React 19.2](https://react.dev/blog/2025/10/01/react-19-2) · react.dev blog, 2025-10-01 · the release post for both (*headings only*) · fetched 2026-10-14
- **Our delta:** how both behave inside the App Router (Activity and route state).

### T03-05 · Enforcing boundaries with server-only / client-only — ✅ written `docs/nextjs/pages/03-server-components-vs-client-components/05-enforcing-boundaries-with-server-only-client-only-packages.md`
- **Read this:** [Server and Client Components: Preventing environment poisoning](https://nextjs.org/docs/app/getting-started/server-and-client-components) · nextjs.org · the `API_KEY` example, why unprefixed env vars become empty strings, `server-only` giving a build-time error; install is optional (*read*) · covers our angle: **full** · fetched 2026-10-14
- **Also good:** [Data Security](https://nextjs.org/docs/app/guides/data-security) · nextjs.org (*headings only*) · fetched 2026-10-14; [experimental_taintObjectReference](https://react.dev/reference/react/experimental_taintObjectReference) · react.dev, experimental (*headings only*) · fetched 2026-10-14
- **Beyond the docs:** [Server-only Code in Next.js 16](https://makerkit.dev/blog/tutorials/server-only-code-nextjs) · Makerkit, no author, page date 2024-12-10 (title says 16, body names no version) · shows props leaking server data and why taint alone is not enough, since a derived string is untainted · fetched 2026-10-14 (*read*)
- **Our delta:** what `server-only` does not protect (chunk 05b).

### T03-06 · Bundle size and Core Web Vitals — ✅ written `docs/nextjs/pages/03-server-components-vs-client-components/06-bundle-size-implications-and-core-web-vitals-impact.md`
- **Read this:** [Optimizing package bundling](https://nextjs.org/docs/app/guides/package-bundling) · nextjs.org · the Turbopack bundle analyzer (filter modules, trace import chains) and `@next/bundle-analyzer` for webpack (*headings only*) · covers our angle: **partial** — the measuring half · fetched 2026-10-14
- **Also good:** [Interaction to Next Paint (INP)](https://web.dev/articles/inp) · web.dev · 200 ms good threshold at the 75th percentile, and JavaScript as the main driver of interactivity delay (*read*) · fetched 2026-10-14; [How to upgrade to version 16: Performance Improvements](https://nextjs.org/docs/app/guides/upgrading/version-16) · nextjs.org · `next build` dropped its `First Load JS` column as inaccurate under RSC; measure with Lighthouse or Core Web Vitals (*read*) · fetched 2026-10-14
- **Our delta:** tying the client boundary to LCP and INP with a measurement loop (chunk 06b).
