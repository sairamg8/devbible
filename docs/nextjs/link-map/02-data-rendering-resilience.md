---
title: "Link map · Next.js · Part 2 (chapters 4–7)"
sidebar_label: "02 · data rendering resilience"
sidebar_position: 2
---

# Link map · Next.js · Part 2 (chapters 4–7)

Covers every topic row of chapters 4 to 7 in `docs/nextjs/syllabus/02-data-rendering-resilience.md`: data fetching (T04-01 to T04-05), caching, PPR and Cache Components (T05-01 to T05-05), SSG, ISR and SSR strategy (T06-01 to T06-05), and error handling and resilience (T07-01 to T07-06). That is 21 topic rows. The four "Project Milestone" bullets (T04-06, T05-06, T06-06, T07-07) are not topics and are skipped. Every row has a written page of ours; a chunked topic shows its first chunk file, under `docs/nextjs/pages/<chapter-dir>/`.
*read* = I read the passage that supports the claim; *headings only* = fetched at 200, title or headings checked. Third-party links carry a date only where the page shows one. No `#anchors` are given. Where no good non-official explanation turned up after searching, the block has no "Beyond the docs" line.

🔴 **Version note.** The syllabus targets **Next.js 16.3** and React 19.2. Every official pick is the unversioned `nextjs.org/docs/app/...` page, which on 2026-10-14 serves 16.x (some pages carry a 16.4.0 version header). Three things differ from what the syllabus bullets say. First, with `cacheComponents` on, the route segment options `dynamic`, `revalidate` and `fetchCache` are removed (since 16.0.0), so T04-03 and T06-03 describe the previous model; the guide "Caching and Revalidating (Previous Model)" is the page that still documents them. Second, the Turbopack build cache is not one flag named `turbopackFileSystemCache`: the options are `turbopackFileSystemCacheForDev` and `turbopackFileSystemCacheForBuild` (under `experimental`, both default true), plus `turbopackMemoryEviction`. Third, third-party picks were mostly written for Next.js 13 to 15 and each such block says so.

---

## Chapter 4 — Data Fetching in the App Router

### T04-01 · Fetch in Server Components, deduplication and `React.cache` — ✅ written `docs/nextjs/pages/04-data-fetching-in-the-app-router/01-fetch-in-server-components-automatic-request-deduplication.md`
- **Read this:** [Fetching Data](https://nextjs.org/docs/app/getting-started/fetching-data) · nextjs.org docs, updated 2026-09-01 · identical `fetch` calls in one component tree are memoized, and a "Reusing data with React.cache" section wraps an ORM query so many components share one result per request (*read*) · covers our angle: **full** — also covers parallel, sequential and preloading · fetched 2026-10-14
- **Also good:** [cache](https://react.dev/reference/react/cache) · react.dev · cache lifetime is one server request, arguments compare by `Object.is` so pass primitives, and calling `cache` inside a component makes a fresh cache every render (*read*) · fetched 2026-10-14
- **Beyond the docs:** [Common Errors in Next.js Caching](https://trackjs.com/blog/common-errors-in-nextjs-caching/) · Jordan Griffin, TrackJS, updated 2024-11-12 · shows the trap where a page that repeats a request on purpose gets the first memoized result; written for Next.js 14 to 15, so its fetch-cache advice predates Cache Components · fetched 2026-10-14 (*read*)
- **Our delta:** `React.cache` is isolated inside `use cache` scopes, and what changes once the flag is on.

### T04-02 · Async components, streaming and `<Suspense>` — ✅ written `docs/nextjs/pages/04-data-fetching-in-the-app-router/02-async-components-streaming-with-suspense-granular-ui-blocks.md`
- **Read this:** [Streaming](https://nextjs.org/docs/app/guides/streaming) · nextjs.org guide, updated 2026-10-06 · the HTML stream and component payload, sibling and nested boundaries, "push dynamic access down", and why a status code cannot change after the first chunk (*read*) · covers our angle: **full** · fetched 2026-10-14
- **Also good:** [Fetching Data](https://nextjs.org/docs/app/getting-started/fetching-data) · nextjs.org docs · the short version: `loading.js` wraps the page in a boundary, and a layout that reads runtime data does not fall back to its own segment's `loading.js` (*read*) · fetched 2026-10-14
- **Our delta:** the per-block boundary placement drills and the infrastructure that buffers a stream.

### T04-03 · Static vs. dynamic rendering: `force-dynamic`, `force-static`, `revalidate` — ✅ written `docs/nextjs/pages/04-data-fetching-in-the-app-router/03-static-vs-dynamic-rendering-force-dynamic-force-static-reval.md`
- **Read this:** [Caching and Revalidating (Previous Model)](https://nextjs.org/docs/app/guides/caching-without-cache-components) · nextjs.org guide, updated 2026-08-18 · the only current page that defines `dynamic` (`auto`, `force-dynamic`, `error`, `force-static`) and the route `revalidate` values, including that the lowest `revalidate` in a route wins (*read*) · covers our angle: **full** for the three options; written for apps without the flag · fetched 2026-10-14
- **Also good:** [Route Segment Config](https://nextjs.org/docs/app/api-reference/file-conventions/route-segment-config) · nextjs.org reference, updated 2026-10-01 · lists only `dynamicParams`, `runtime`, `preferredRegion`, `maxDuration`, and says `dynamic`, `revalidate` and `fetchCache` were removed in 16.0.0 under Cache Components (*read*) · fetched 2026-10-14
- **Our delta:** which of the three still exist per flag state, and diagnosing a route that went dynamic by accident.

### T04-04 · Route Handlers (`route.ts`) for RESTful APIs — ✅ written `docs/nextjs/pages/04-data-fetching-in-the-app-router/04-route-handlers-routets-for-restful-apis.md`
- **Read this:** [route.js](https://nextjs.org/docs/app/api-reference/file-conventions/route) · nextjs.org reference, updated 2026-04-30 · the seven methods, automatic `OPTIONS`, `params` as a promise, cookies, headers, CORS, webhooks, streaming; `GET` handlers are dynamic since 15.0.0-RC (*read*) · covers our angle: **full** · fetched 2026-10-14
- **Also good:** [Route Handlers](https://nextjs.org/docs/app/getting-started/route-handlers) · nextjs.org docs, updated 2026-08-27 · convention, caching, special handlers and route resolution; links the Cache Components behavior of `GET` handlers (*headings only*) · fetched 2026-10-14
- **Our delta:** the request-body validation boundary and the public-endpoint contract; no good non-official explainer for Next.js 16 turned up that I could read.

### T04-05 · Server Actions: mutations, forms and progressive enhancement — ✅ written `docs/nextjs/pages/04-data-fetching-in-the-app-router/05-server-actions-mutations-form-submissions-progressive-enhanc.md`
- **Read this:** [Mutating Data](https://nextjs.org/docs/app/getting-started/mutating-data) · nextjs.org docs, updated 2026-10-06 · creating and invoking Server Functions; Server Component forms work without JavaScript, Client Component forms queue until hydration; actions are POST-only and reachable directly (*read*) · covers our angle: **full** · fetched 2026-10-14
- **Also good:** [Server Actions and Mutations](https://nextjs.org/docs/app/guides/server-actions) · nextjs.org guide · sequential dispatch, one response carrying data and UI, CSRF and action-ID protections, and how `updateTag` differs from `revalidateTag` (*read*) · fetched 2026-10-14
- **Beyond the docs:** [Next.js Forms with Server Actions](https://www.robinwieruch.de/next-forms/) · Robin Wieruch, updated 2026-05-28 · builds a form with `useActionState` and Zod, then shows what still works with JavaScript off and what is lost (loading feedback, toast); written for Next.js 15 · fetched 2026-10-14 (*read*)
- **Our delta:** what crosses the wire and the hook-by-hook behavior.

## Chapter 5 — Caching, PPR, and Cache Components

### T05-01 · The explicit caching model and the `cacheComponents` flag — ✅ written `docs/nextjs/pages/05-caching-ppr-and-cache-components/01-the-explicit-caching-model-cachecomponents-build-flag-and-th.md`
- **Read this:** [Caching](https://nextjs.org/docs/app/getting-started/caching) · nextjs.org docs, updated 2026-10-06 · enabling `cacheComponents` with `partialPrefetching`, data-level and UI-level `use cache`, streaming uncached data, runtime APIs, `connection()` and where cached content is stored (*read*) · covers our angle: **full** · fetched 2026-10-14
- **Also good:** [cacheComponents](https://nextjs.org/docs/app/api-reference/config/next-config-js/cacheComponents) · nextjs.org reference, updated 2026-10-02 · data fetching is dynamic by default, the flag replaces `ppr`, `useCache` and `dynamicIO`, requires the Node.js runtime (*read*) · fetched 2026-10-14
- **Beyond the docs:** [Cache Components in Next.js](https://certificates.dev/blog/cache-components-in-nextjs) · Aurora Scharff (Next.js team), 2026-07-09 · walks one store page through stream, cache or block for each data source, then `cacheLife` and tag invalidation · fetched 2026-10-14 (*read*)
- **Our delta:** the philosophy shift and the cost of flipping the flag on an existing app.

### T05-02 · The `use cache` directive and custom `cacheLife` profiles — ✅ written `docs/nextjs/pages/05-caching-ppr-and-cache-components/02-the-use-cache-directive-and-custom-cachelife-profiles.md`
- **Read this:** [cacheLife](https://nextjs.org/docs/app/api-reference/functions/cacheLife) · nextjs.org reference, updated 2026-09-29 · `stale`, `revalidate`, `expire`, the preset table, custom and inline profiles, the 30-second client minimum and the prerender thresholds (*read*) · covers our angle: **full** for profiles · fetched 2026-10-14
- **Also good:** [use cache](https://nextjs.org/docs/app/api-reference/directives/use-cache) · nextjs.org reference, updated 2026-09-29 · cache keys, serialization, why `cookies()` and `headers()` are banned inside, `React.cache` isolation, build hangs; names `use cache: private` and `use cache: remote` as the escape hatches (*read*) · fetched 2026-10-14
- **Our delta:** the three variants side by side, plus the 30s and 5min thresholds the syllabus flags.

### T05-03 · Partial Pre-Rendering (PPR): static shell and dynamic holes — ✅ written `docs/nextjs/pages/05-caching-ppr-and-cache-components/03-partial-pre-rendering-ppr-static-shell-dynamic-holes-for-min.md`
- **Read this:** [Caching: Prerendering](https://nextjs.org/docs/app/getting-started/caching) · nextjs.org docs · the Prerendering section defines PPR as the default with Cache Components: cached, `Suspense` fallback and predictable parts form the shell, the rest streams; also "Maximizing the static shell" and the App Shell (*read*) · covers our angle: **full** · fetched 2026-10-14
- **Also good:** [Optimizing the static shell](https://nextjs.org/docs/app/guides/optimizing-the-static-shell) · nextjs.org guide, updated 2026-10-06 · patterns and a five-step worked example that moves URL work and auth behind `Suspense` (*headings only*) · fetched 2026-10-14
- **Beyond the docs:** [Cache Components for Instant and Fresh Pages](https://vercel.com/academy/nextjs-foundations/cache-components) · Vercel Academy, updated 2026-08-21 · a lesson that builds the shell, the dynamic holes and the cached parts in one app · fetched 2026-10-14 (*read*)
- **Our delta:** instant-navigation validation and proving the shell in CI. The old `experimental.ppr` flag and `experimental_ppr` export are gone; Next 15 era PPR articles are stale.

### T05-04 · Revalidation: ISR, `revalidateTag`, `updateTag` and edge lag — ✅ written `docs/nextjs/pages/05-caching-ppr-and-cache-components/04-revalidation-time-based-isr.md`
- **Read this:** [Revalidating](https://nextjs.org/docs/app/getting-started/revalidating) · nextjs.org docs, updated 2026-06-25 · `cacheLife`, `cacheTag`, `revalidateTag` (stale-while-revalidate, profile `max` recommended), `updateTag` (read-your-own-writes, Server Actions only), `revalidatePath` (*read*) · covers our angle: **partial** — nothing on edge propagation lag · fetched 2026-10-14
- **Also good:** [updateTag](https://nextjs.org/docs/app/api-reference/functions/updateTag) · nextjs.org reference, updated 2026-08-18 · the `updateTag` versus `revalidateTag` rules, and that a one-argument `revalidateTag` is the legacy form (*read*) · fetched 2026-10-14
- **Our delta:** edge-propagation lag; see also [How revalidation works](https://nextjs.org/docs/app/guides/how-revalidation-works) (multi-instance and CDN sections, *headings only*). No good non-official explainer for `updateTag` turned up.

### T05-05 · Turbopack build caches and memory eviction — ✅ written `docs/nextjs/pages/05-caching-ppr-and-cache-components/05-turbopack-build-caches-persistent-build-cache-and-memory-evi.md`
- **Read this:** [Turbopack FileSystem Caching](https://nextjs.org/docs/app/api-reference/config/next-config-js/turbopackFileSystemCache) · nextjs.org reference, updated 2026-10-06 · the two options `turbopackFileSystemCacheForDev` and `turbopackFileSystemCacheForBuild`, both default true; cache lives in `.next/cache` and CI only benefits if that directory is restored (*read*) · covers our angle: **full** · fetched 2026-10-14
- **Also good:** [Turbopack: What's New in Next.js 16.3](https://nextjs.org/blog/next-16-3-turbopack) · nextjs.org blog, 2026-06-29 · memory eviction (21.5 GB to 2 GB on vercel.com) and build cache timings (5.5x on one site, 1.4x on another); the `turbopackMemoryEviction` value is `'auto'` by default (*read*) · fetched 2026-10-14
- **Our delta:** the syllabus names one flag `turbopackFileSystemCache`; the real flag names differ, as the version note says. No non-official explainer worth linking.

## Chapter 6 — SSG, ISR, and SSR Strategy

### T06-01 · Choosing a rendering pattern — ✅ written `docs/nextjs/pages/06-ssg-isr-and-ssr-strategy/01-choosing-a-rendering-pattern-seo-build-time-data-velocity-pe.md`
- **Read this:** [Next.js Rendering Philosophy](https://nextjs.org/docs/app/guides/rendering-philosophy) · nextjs.org guide, updated 2026-03-30 · static versus dynamic as a spectrum at component level, and what that does to infrastructure and portability (*read*) · covers our angle: **partial** — the model, not a trade-off matrix · fetched 2026-10-14
- **Also good:** [Caching](https://nextjs.org/docs/app/getting-started/caching) · nextjs.org docs · the four things that decide what lands in the shell: cached, `Suspense`, predictable, random (*read*) · fetched 2026-10-14
- **Our delta:** the SEO, build-time, data-velocity and personalization decision procedure. No single non-official piece covered it for 16.x; the usual SSG/ISR/SSR comparison blogs I found were written for Pages Router APIs.

### T06-02 · `generateStaticParams` at scale — ✅ written `docs/nextjs/pages/06-ssg-isr-and-ssr-strategy/02-generatestaticparams-for-pre-rendering-dynamic-routes-at-sca.md`
- **Read this:** [generateStaticParams](https://nextjs.org/docs/app/api-reference/functions/generate-static-params) · nextjs.org reference, updated 2026-10-01 · single, multiple and catch-all segments, `dynamicParams` to disable unspecified paths, use with Route Handlers and with Cache Components (*headings only*) · covers our angle: **partial** — little on scale or build time · fetched 2026-10-14
- **Also good:** [Incremental Static Regeneration with Cache Components](https://nextjs.org/docs/app/guides/incremental-static-regeneration-cache-components) · nextjs.org guide, updated 2026-10-06 · prerender a subset, serve the App Shell for the rest, upgrade after the first visit (*read*) · fetched 2026-10-14
- **Our delta:** database enumeration, the nested-segment explosion, and the 16.3 shell-first behavior. No non-official source I could read added to this.

### T06-03 · ISR at enterprise level: stale-while-revalidate tuning — ✅ written `docs/nextjs/pages/06-ssg-isr-and-ssr-strategy/03-isr-at-enterprise-level-stale-while-revalidate-tuning.md`
- **Read this:** [Incremental Static Regeneration](https://nextjs.org/docs/app/guides/incremental-static-regeneration) · nextjs.org guide, updated 2026-06-23 · time-based and on-demand revalidation, debugging, caveats; background regeneration runs on the instance that got the request (*read*) · covers our angle: **partial** — previous-model guide, `revalidate` export based · fetched 2026-10-14
- **Also good:** [How revalidation works](https://nextjs.org/docs/app/guides/how-revalidation-works) · nextjs.org guide, updated 2026-06-01 · time-based revalidation is stale-while-revalidate; soft and explicit tags; multi-instance behavior (*read*) · fetched 2026-10-14
- **Beyond the docs:** [Preventing the stampede: Request collapsing in the Vercel CDN](https://vercel.com/blog/cdn-request-collapsing) · Sachin Raja, Vercel, 2025-09-25 · many requests to an expired ISR page each start a function; one per region now does the work. Describes Vercel's CDN only, not self-hosting · fetched 2026-10-14 (*read*)
- **Our delta:** tuning budgets and what a self-hosted deployment does not protect you from.

### T06-04 · Full static export vs. serverful distribution — ✅ written `docs/nextjs/pages/06-ssg-isr-and-ssr-strategy/04-full-static-export-vs-serverful-edge-distribution.md`
- **Read this:** [Static Exports](https://nextjs.org/docs/app/guides/static-exports) · nextjs.org guide, updated 2026-08-09 · `output: 'export'`, what survives, and the unsupported list: dynamic routes without `generateStaticParams`, request-reading Route Handlers, cookies, rewrites, redirects, headers, Proxy, ISR (*read*) · covers our angle: **full** for the export side · fetched 2026-10-14
- **Also good:** [Next.js Rendering Philosophy](https://nextjs.org/docs/app/guides/rendering-philosophy) · nextjs.org guide · "Infrastructure Implications" and "Portability and Fidelity": what you need from a host once components go dynamic (*headings only*) · fetched 2026-10-14
- **Our delta:** the `force-static` trap and the one-way door of leaving export. No good non-official explainer for the 16.x model turned up.

### T06-05 · Architecture decision walkthroughs — ✅ written `docs/nextjs/pages/06-ssg-isr-and-ssr-strategy/05-architecture-decision-walkthroughs-marketing-pages.md`
- **Read this:** [Optimizing the static shell](https://nextjs.org/docs/app/guides/optimizing-the-static-shell) · nextjs.org guide, updated 2026-10-06 · the worked example turns a dynamic, authenticated page into a shell plus streamed parts, which is the dashboard end of the spectrum (*headings only*) · covers our angle: **partial** — one example, no marketing or content-platform cases · fetched 2026-10-14
- **Beyond the docs:** [When to Use SSR in Next.js 16: A Decision Framework](https://makerkit.dev/blog/tutorials/nextjs-when-to-use-ssr) · MakerKit, published 2026-01-22, updated 2026-09 for Next.js 16 · dynamic for dashboards, static or cached for marketing and blog, Cache Components with `Suspense` for mostly static pages with one personal section; no author named, so treat as one team's opinion · fetched 2026-10-14 (*read*)
- **Our delta:** the content-platform and archive-scale cases and the authenticated-dashboard walkthrough.

## Chapter 7 — Error Handling, Loading States, and Resilience

### T07-01 · The unified error model: `error.tsx`, `global-error.tsx`, placement — ✅ written `docs/nextjs/pages/07-error-handling-loading-states-and-resilience/01-the-unified-error-model-errortsx-boundaries.md`
- **Read this:** [Error Handling](https://nextjs.org/docs/app/getting-started/error-handling) · nextjs.org docs, updated 2026-10-06 · expected errors versus uncaught exceptions, nested error boundaries, global errors (*read*) · covers our angle: **full** · fetched 2026-10-14
- **Also good:** [catchError](https://nextjs.org/docs/app/api-reference/functions/catchError) · nextjs.org reference, updated 2026-08-24 · the 16.3 boundary: leaves `redirect()` and `notFound()` alone, `retry()` re-renders inside a Transition, clears on client navigation. Also [error.js](https://nextjs.org/docs/app/api-reference/file-conventions/error), where the recovery prop is now `retry` (older pages say `reset`) (*read*) · fetched 2026-10-14
- **Beyond the docs:** [Error Handling in Next.js with catchError](https://certificates.dev/blog/error-handling-in-nextjs-with-catcherror) · Aurora Scharff, 2026-06-18 · why `retry()` can recover from a transient database timeout where `react-error-boundary`'s reset cannot · fetched 2026-10-14 (*read*)
- **Our delta:** placement strategy, `global-error` not inheriting, and the 401/403 half (`forbidden()`, `unauthorized()`; see [forbidden](https://nextjs.org/docs/app/api-reference/functions/forbidden), *headings only*).

### T07-02 · Errors in streaming: failures mid-`<Suspense>` — ✅ written `docs/nextjs/pages/07-error-handling-loading-states-and-resilience/02-errors-in-streaming-failures-thrown-mid-suspense-partial-pag.md`
- **Read this:** [Streaming: Error handling mid-stream and The HTTP contract](https://nextjs.org/docs/app/guides/streaming) · nextjs.org guide, updated 2026-10-06 · the nearest `error.js` replaces only the failed section, the 200 is already sent, `notFound()` mid-stream injects `noindex`, `redirect()` becomes a client redirect (*read*) · covers our angle: **full** · fetched 2026-10-14
- **Also good:** [loading.js: Status codes](https://nextjs.org/docs/app/api-reference/file-conventions/loading) · nextjs.org reference, updated 2026-09-23 · put `notFound()`, `forbidden()` or `unauthorized()` before the first suspend to keep a real 404, 403 or 401 (*read*) · fetched 2026-10-14
- **Our delta:** what silently defeats streaming in production. No non-official source I found covered the mid-stream error case in detail.

### T07-03 · Server Action error contracts and `useActionState` — ✅ written `docs/nextjs/pages/07-error-handling-loading-states-and-resilience/03-server-action-error-contracts-returning-typed-errors-vs.md`
- **Read this:** [Error Handling: Server Functions](https://nextjs.org/docs/app/getting-started/error-handling) · nextjs.org docs · model expected errors as return values, avoid `try`/`catch` for them, read the state with `useActionState` (*read*) · covers our angle: **partial** — an untyped message object, not a typed contract · fetched 2026-10-14
- **Also good:** [Forms](https://nextjs.org/docs/app/guides/forms) · nextjs.org guide, updated 2026-10-06 · "Validation errors": Zod `safeParse` plus `useActionState`, where the action gains a `prevState` first argument (*read*). Also [useActionState](https://react.dev/reference/react/useActionState) · react.dev (*headings only*) · fetched 2026-10-14
- **Beyond the docs:** [Next.js Server Actions: The Complete Guide (2026)](https://makerkit.dev/blog/tutorials/nextjs-server-actions) · MakerKit, 2026-01-22 · a `success`, `error`, `data` result object, a generic message to the user with the real error logged server-side; no author named · fetched 2026-10-14 (*read*)
- **Our delta:** the typed discriminated result, sequential dispatch, rotating action IDs.

### T07-04 · Route Handler error responses and API error envelopes — ✅ written `docs/nextjs/pages/07-error-handling-loading-states-and-resilience/04-route-handler-error-responses-and-consistent-api-error-envel.md`
- **Read this:** [route.js](https://nextjs.org/docs/app/api-reference/file-conventions/route) · nextjs.org reference · handlers return a Web `Response`, so status and body are yours (the webhook example returns a 400 on a bad payload); nothing on envelope design (*read*) · covers our angle: **partial** · fetched 2026-10-14
- **Beyond the docs:** [RFC 9457: Problem Details for HTTP APIs](https://www.rfc-editor.org/rfc/rfc9457.html) · IETF, 2023-07 · the `type`, `title`, `status`, `detail`, `instance` members and the `application/problem+json` type, which is the standard shape to base an envelope on; not Next.js specific · fetched 2026-10-14 (*headings only*)
- **Our delta:** designing the envelope in Next.js terms. I found no Next.js specific article worth linking.

### T07-05 · `loading.tsx` vs. inline `<Suspense>`, skeletons and layout shift — ✅ written `docs/nextjs/pages/07-error-handling-loading-states-and-resilience/05-loadingtsx-vs-inline-suspense-skeleton-strategy-and-layout-s.md`
- **Read this:** [Streaming: when to use loading.js vs Suspense](https://nextjs.org/docs/app/guides/streaming) · nextjs.org guide · a comparison table, the rule to prefer boundaries near the dynamic access, and CLS advice: size skeletons like the content and reserve space (*read*) · covers our angle: **full** · fetched 2026-10-14
- **Also good:** [Optimize Cumulative Layout Shift](https://web.dev/articles/optimize-cls) · web.dev · the platform-level fixes for shifts (*headings only*) · fetched 2026-10-14
- **Beyond the docs:** [How loading.tsx in Next.js Caused Massive CLS Issues](https://dev.to/homielab/how-loadingtsx-in-nextjs-caused-massive-cls-issues-and-hurt-my-seo-4n0c) · HomieLab, DEV Community, 2025-07-13 · a small spinner replaced by a tall page flagged 35,000 mobile URLs; the fix was matching skeleton heights. One site's case study, Next.js 13 to 15 era · fetched 2026-10-14 (*read*)
- **Our delta:** the layout that stops `loading.tsx` from appearing and the cost of each extra boundary.

### T07-06 · Retry, fallback, graceful degradation; `notFound()` and `redirect()` in errors — ✅ written `docs/nextjs/pages/07-error-handling-loading-states-and-resilience/06-retry-fallback-and-graceful-degradation-patterns.md`
- **Read this:** [unstable_rethrow](https://nextjs.org/docs/app/api-reference/functions/unstable_rethrow) · nextjs.org reference, updated 2026-03-03 · `notFound()` and `redirect()` throw, so a `try`/`catch` swallows them; rethrow framework errors first. Marked "Unstable" (*read*) · covers our angle: **partial** — the control-flow half · fetched 2026-10-14
- **Also good:** [catchError](https://nextjs.org/docs/app/api-reference/functions/catchError) for `retry()` (*read*), and [Handling connectivity drops](https://nextjs.org/docs/app/guides/offline-support) for the experimental `useOffline` flag (*headings only*) · fetched 2026-10-14
- **Beyond the docs:** [Timeouts, retries, and backoff with jitter](https://builder.aws.com/content/3EumjoZascWd1oZiEgL8ORlv3qE/timeouts-retries-and-backoff-with-jitter) · Amazon Builders' Library · why every call needs a timeout, retries need backoff and jitter, and retries are unsafe without idempotency; not Next.js specific, and read as search excerpts, page body not fully read · fetched 2026-10-14 (*headings only*)
- **Our delta:** `Promise.allSettled` partial data and which retries you own versus the framework's.
