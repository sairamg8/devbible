---
title: "Part 2 · Data, Rendering & Resilience"
sidebar_label: "2 · Data, Rendering & Resilience"
sidebar_position: 2
---

> Verified: 2026-09-03 against the [Next.js 16.3 release post](https://nextjs.org/blog/next-16-3)
> and the [`use cache: private` reference](https://nextjs.org/docs/app/api-reference/directives/use-cache-private).
> ⚠️ Imported syllabus verbatim; drift flagged inline.

## 4 · Data Fetching in the App Router

- Fetch in Server Components: automatic request deduplication, `React.cache()` for non-fetch memoization.
- Async components, streaming with `<Suspense>`, granular UI blocks.
- Static vs. dynamic rendering (`force-dynamic`, `force-static`, `revalidate`).
- Route Handlers (`route.ts`) for RESTful APIs.
- Server Actions: mutations, form submissions, progressive enhancement.
- **Project Milestone:** scaffold SprintDesk — team-scoped routes, first server-rendered task list, one Server Action (create task).
  - ➕ **Missing:** **Draft Mode** (CMS preview), the **Backend for Frontend** pattern, and the documented client-fetching escape hatches (SWR, TanStack Query).

## 5 · Caching, PPR, and Cache Components

- The explicit caching model: `cacheComponents` build flag and the philosophy shift from implicit to declared caching.
- The `use cache` directive and custom `cacheLife` profiles.
  - ➕ **Missing: the directive variants.** **`use cache: private`** may read `cookies()`/`headers()`/`searchParams`, and its results are **never stored on the server** — browser memory only, gone on reload. **`use cache: remote`** is a third variant. Two thresholds worth knowing: `stale` ≥ **30s** for per-link prefetching, ≥ **5min** to reach the App Shell. `connection()` is banned in every cache scope.
- **Partial Pre-Rendering (PPR):** static shell + dynamic holes for minimal TTFB.
- Revalidation: time-based (ISR), tag-based on-demand (`revalidateTag`), synchronous mutation validation (`updateTag`) and edge-propagation lag.
- Turbopack build caches, persistent build cache, and memory eviction.
  - ⚠️ **Now named flags, both on by default:** `turbopackFileSystemCache` (covers `next build`; up to **5.5× faster CI builds**) and `turbopackMemoryEviction` (up to **90% less dev RAM**).
- **Project Milestone:** cache SprintDesk's team dashboard shell with PPR; tag-based revalidation on task mutations.

## 6 · SSG, ISR, and SSR Strategy

- Choosing a rendering pattern: SEO, build time, data velocity, personalization trade-offs.
- `generateStaticParams` for pre-rendering dynamic routes at scale.
- ISR at enterprise level: stale-while-revalidate tuning.
  - ➕ **New in 16.3:** a route left out of `generateStaticParams` now serves an **instant shell** on first visit, then upgrades to fully prerendered in the background. The old either/or is gone.
- Full static export vs. serverful edge distribution.
- Architecture decision walkthroughs: marketing pages, content platforms, authenticated dashboards.
- **Project Milestone:** static marketing pages + ISR'd public team pages + fully dynamic authenticated dashboard in one SprintDesk codebase.

## 7 · Error Handling, Loading States, and Resilience

- The unified error model: `error.tsx` boundaries, `global-error.tsx`, and error boundary placement strategy.
  - ➕ **Missing, and it is this chapter's centrepiece now:** **`catchError`** (`next/error`), new in 16.3. Stock React boundaries *interfered* with `notFound()`/`redirect()` and could only reset client state; `catchError` boundaries get a **`retry()`** that refetches children, **re-rendering failed Server Components**.
  - ➕ **Also missing:** `forbidden()` / `unauthorized()` and the `forbidden.js` / `unauthorized.js` conventions behind `authInterrupts` — the 401/403 half of the model.
- Errors in streaming: failures thrown mid-`<Suspense>`, partial page recovery.
- Server Action error contracts: returning typed errors vs. throwing; pairing with `useActionState`.
- Route Handler error responses and consistent API error envelopes.
- `loading.tsx` vs. inline `<Suspense>`: skeleton strategy and layout-shift avoidance.
- Retry, fallback, and graceful-degradation patterns; `notFound()` and `redirect()` inside error flows.
  - ➕ **Missing (experimental):** `experimental.useOffline` — a dropped connection normally *throws*; with the flag the navigation/fetch/Action stays pending and retries on reconnect. `useOffline()` from `next/offline` reports the state.
- **Project Milestone:** SprintDesk gets full error boundary coverage, typed Server Action errors, and skeleton loading for the board view.
