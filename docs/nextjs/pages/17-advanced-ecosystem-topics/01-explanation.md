---
title: "The four topics in this chapter share one property: each is a decision about where Next.js ends and something else begins — another deployed application, another router, an auditor's framework, or your own build tooling"
sidebar_label: "01 · Overview: the chapter map"
sidebar_position: 0
description: "Chapter index for Advanced Ecosystem Topics: multi-zone architecture, Pages to App Router migration, enterprise compliance and supply-chain risk, and framework extension. What each concept settles, and where the boundary material actually lives."
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-09-04 for **Next.js 16.3.4 · React 19.2.8 · Node 20.9 floor**. Every page in this
> chapter was written against documentation whose own metadata reports `version: 16.3.4`; the
> per-page `> Verified:` lines name the exact sources. Documentation-verified; **no sandbox run** —
> and note that **`next` is not installed in this checkout**, so no page here rests on a probe of
> the Next.js package.

**Everything in this chapter is an edge case in the literal sense: a question about the edge of the framework.** Where does one Next.js application stop and the next one start? Where does the router you have stop and the router you want start? Where does the framework's responsibility for security stop and yours start? Where do the documented seams stop and `next/dist` start? None of these are things you reach for weekly, which is why they are here rather than in the chapters on routing, rendering or data. All four are things that, on the day you need them, you need to get right the first time — because each one is expensive to reverse.

## Chunks

| # | Chunk | Covers |
|---|---|---|
| 01 | **[Multi-zone architecture](01-micro-frontends-and-multi-zone-architectures-for-decoupled-t.md)** | What a zone actually is, and how it differs from runtime-composition micro-frontends. The organisational trade-off: independent deploy cadence bought with duplicated bundles and hard navigations |
| 01b | **[Routing requests to a zone](01b-routing-requests-to-a-zone.md)** | `basePath`, `assetPrefix` and `rewrites`, and the eight-step route-checking order. 🔴 `basePath` is inlined into client bundles at build time and cannot change without a rebuild |
| 01c | **[Crossing a zone boundary](01c-crossing-zone-boundaries.md)** | 🔴 Why `next/link` cannot soft-navigate into another zone, and what a hard navigation therefore destroys — router cache, React context, in-memory state |
| 01d | **[When zones are the wrong answer](01d-when-zones-are-the-wrong-answer.md)** | The honest recommendation for one team wanting "modularity": route groups and a monorepo, not zones |
| 02 | **[Pages → App migration](02-pages-router-app-router-migration-roadmaps-for-legacy-codeba.md)** | The roadmap, coexistence, and sequencing. 🔴 The `app/`-wins precedence rule is **not stated in the 16.3.4 docs** — the page says so and supplies a CI guard rather than asserting it |
| 02b | **[Translating request-time data](02b-translating-the-data-fetching-contracts.md)** | `getServerSideProps` → an `async` Server Component, and what you lose with it |
| 02c | **[Translating build-time data](02c-translating-build-time-data.md)** | `getStaticProps` / `getStaticPaths` → `generateStaticParams` and the segment cache |
| 02d | **[The two APIs with no clean successor](02d-the-two-apis-with-no-clean-successor.md)** | `getInitialProps` and `pages/api` — what genuinely does not port, stated plainly |
| 02e | **[The two routers and the hooks](02e-the-two-routers-and-the-client-side-hooks.md)** | 🔴 `next/router` and `next/navigation` both export `useRouter` with different APIs. The single most common migration error, and `next/compat/router` as the escape hatch |
| 02f | **[The shell, metadata and styles](02f-the-document-shell-metadata-and-styles.md)** | `_app` / `_document` → root `layout.tsx`, `next/head` → the Metadata API, and why layout styles do not reach `pages/*` |
| 02g | **[Codemods, traps and when to stop](02g-codemods-cross-router-traps-and-when-to-stop.md)** | What `@next/codemod` does and does not do, and why a permanent two-router codebase is a legitimate outcome |
| 03 | **[OWASP mapping and token leakage](03-enterprise-compliance-owasp-mapping-token-leakage-prevention.md)** | Each OWASP category mapped to the App Router seam that actually enforces it. 🔴 The three doors a secret uses to reach the browser, and why door three looks like ordinary React |
| 03b | **[Supply-chain vigilance](03b-supply-chain-vigilance.md)** | The dependency graph as the real attack surface, why a clean `npm audit` is weak evidence, and what the LTS line does to your dependency policy |
| 04 | **[Framework extension](04-framework-extension-and-plugin-development.md)** | 🔴 There is no plugin API. A "Next.js plugin" is a function from `NextConfig` to `NextConfig`; the Adapters API is the one typed extension point, and it is for hosting platforms |
| 04b | **[The bundler seam](04b-the-bundler-seam-webpack-and-turbopack.md)** | 🔴 Turbopack has been the default since 16.0, so a `webpack()` function is **silently not read**. Turbopack implements loaders and does not support webpack plugins |
| 04c | **[Seams that are files](04c-the-seams-that-are-files.md)** | Extension triggered by a filename: a Babel config disabling SWC, `instrumentation.ts`, `onRequestError`, `proxy.ts` |
| 04d | **[Internals and the decision](04d-internals-coupling-and-the-plugin-decision.md)** | Reaching into `next/dist`, the two-Reacts mechanism, and choosing between a plugin, a template and a codemod |

## What this chapter is not

This page previously carried three sections on `'use client'` placement, `<Suspense>` granularity and `error.tsx` nesting. That is rendering-boundary and error-handling material, and it belongs to — and is covered in depth by — chapters 3 and 7:

- [ch3 · `'use client'`: when and why to opt in](../03-server-components-vs-client-components/02-use-client-when-and-why-to-opt-in-interactivity-browser-apis.md) and [ch3 · bundle-size implications](../03-server-components-vs-client-components/06-bundle-size-implications-and-core-web-vitals-impact.md) — pushing the boundary to the smallest interactive leaf.
- [ch7 · `loading.tsx` vs inline Suspense](../07-error-handling-loading-states-and-resilience/05-loadingtsx-vs-inline-suspense-skeleton-strategy-and-layout-s.md) — why independent boundaries stream independently.
- [ch7 · the unified error model](../07-error-handling-loading-states-and-resilience/01-the-unified-error-model-errortsx-boundaries.md) and [ch7 · what boundaries do not catch](../07-error-handling-loading-states-and-resilience/10b-what-boundaries-do-not-catch.md) — `error.tsx`, `global-error.tsx` and the limits of both.

🔴 **One rule from the removed material is worth carrying explicitly, because it is the kind of thing people assume backwards.** In the component hierarchy, `error.js` wraps `loading.js`, `not-found.js`, `page.js` **and nested `layout.js` files** — but it does **not** wrap the `layout.js` or `template.js` *above it in the same segment*. So a layout's own failure is caught one segment **up**, never by the `error.tsx` sitting beside it, and an error in the root layout needs `global-error.js`. Verified 2026-09-04 against [`error.js`](https://nextjs.org/docs/app/api-reference/file-conventions/error) (`version: 16.3.4`).

## Phase gate

You are done with this chapter when you can decide, without opening documentation: whether a second team's application should be a zone or a route group; what order you would migrate a `pages/` codebase in and where you would stop; which seam enforces each OWASP category in an App Router app; and whether a request for "a Next.js plugin" should become a config wrapper, an adapter, a shared template or a codemod.

## Where this connects

- [ch2 · Routing and navigation](../02-routing-and-navigation/01-file-system-routing-pagetsx.md) — the routing model the migration chapter translates *into*, and the `proxy.ts` layer zones sit behind.
- [ch10 · Authentication and security hardening](../10-forms-authentication-and-security-hardening/04-defense-in-depth-proxyts-as-a-coarse-filter.md) — owns the CVE record and the defence-in-depth argument; chapter 17 draws only the dependency-graph conclusion.
- [ch16 · The Adapters API](../16-deployment-scaling-and-observability/10-the-adapters-api-why-it-exists-and-how-a-platform-wires-one-in.md) — the one typed extension point, covered in depth there rather than here.
- [ch18 · Capstone and decision trees](../18-capstone-decision-trees-and-outlook/01-explanation.md) — where the migration recipe is applied end to end.

---

Start → [01 · Multi-zone architecture](01-micro-frontends-and-multi-zone-architectures-for-decoupled-t.md)
