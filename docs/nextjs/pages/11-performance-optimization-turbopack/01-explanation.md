---
title: "11 · Performance optimization and Turbopack"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-04 against the Next.js [Turbopack API reference](https://nextjs.org/docs/app/api-reference/turbopack)
> (`lastUpdated: 2026-08-03`), [Route Segment Config](https://nextjs.org/docs/app/api-reference/file-conventions/route-segment-config)
> (`lastUpdated: 2026-04-30`), [`reactCompiler`](https://nextjs.org/docs/app/api-reference/config/next-config-js/reactCompiler)
> (`lastUpdated: 2026-02-11`), [package bundling](https://nextjs.org/docs/app/guides/package-bundling)
> (`lastUpdated: 2026-06-01`), [lazy loading](https://nextjs.org/docs/app/guides/lazy-loading) (`lastUpdated: 2026-03-10`),
> [analytics](https://nextjs.org/docs/app/guides/analytics) (⚠️ `lastUpdated: 2025-05-13`, stale) and the
> [version 16 upgrade guide](https://nextjs.org/docs/app/guides/upgrading/version-16) (`lastUpdated: 2026-08-25`).
> Documentation-verified; **no timings, no sandbox run** — `next` is not installed in this checkout.
> Target: **Next.js 16.3.4 · React 19.2 · Node 24**.

**Next.js 16 did something unusual to this subject: it took away two of the levers the previous generation of
performance advice was built on, and made a third one measure nothing.** Turbopack stopped being a flag and became
the bundler, so "should we adopt it" turned into "what broke when we had to". `runtime = 'edge'` — the per-route
choice every architecture diagram used to feature — was **deprecated**, and the documented migration is to delete
the export. And `next build` no longer reports `size` or `First Load JS`, which means a CI gate that greps build
output for a bundle budget now passes without testing anything. This chapter is written against what the
documentation says today, and it is explicit about the popular claims it could not source.

## Chunks

| # | Page | Covers |
|---|---|---|
| 1 | **[Turbopack in dev and production](01-turbopack-in-dev-and-production-fast-refresh.md)** | Incremental bundling, the four design claims, default since 16.0, Fast Refresh — and 🔴 that Turbopack does **not** type-check |
| 2 | **[Configuring the compile pipeline](01b-configuring-the-turbopack-compile-pipeline.md)** | The five stable config keys, loaders vs plugins as an architectural distinction, and 🔴 the Babel rule that **reversed** in 16 |
| 3 | **[Build-time constants and profiling](01c-import-meta-env-and-profiling-the-dev-server.md)** | `import.meta.env`'s five properties, dead-branch elimination, `--internal-trace` and the reader for it |
| 4 | **[Migrating from webpack](01d-migrating-from-webpack-the-behavioural-gaps.md)** | 🔴 The four gaps that change what **renders** — CSS Module ordering, Lightning CSS precision, the filesystem root, the Sass tilde |
| 5 | **[What Turbopack does not support](01e-what-turbopack-does-not-support-and-how-to-read-the-list.md)** | The legacy CSS Modules rules, Yarn PnP, `sassOptions.functions` — and how to read three different "unsupported" statuses |
| 6 | **[React Compiler](02-react-compiler-retiring-manual-usememo-usecallback.md)** | Automatic memoization, `reactCompiler` as a stable top-level key that is **not** on by default, the SWC pre-filter |
| 7 | **[What the compiler costs, and the Rust port](02b-what-the-react-compiler-costs-and-the-rust-port.md)** | 🔴 Two doc statements about build cost that **disagree**, dated — plus the experimental Rust port and its conditional numbers |
| 8 | **[Annotation mode and the two directives](02c-annotation-mode-and-the-two-directives.md)** | `compilationMode: 'annotation'`, `"use memo"` / `"use no memo"`, and the modes Next.js does not document |
| 9 | **[Migrating existing memoization](02d-migrating-existing-memoization.md)** | Whether to strip `useMemo`/`useCallback`, and why React's own advice is to leave it alone |
| 10 | **[What the compiler surfaces in old code](02e-what-the-compiler-surfaces-in-old-code.md)** | The rule violations it reveals, and why a bail-out is information rather than a failure |
| 11 | **[Bundle analysis](03-bundle-analysis-dynamic-imports-lazy-loading.md)** | 🔴 16.0 removed `size` and `First Load JS`, so a build-output CI gate passes **vacuously** — and what to replace it with |
| 12 | **[The two analyzers](03b-the-two-analyzers-and-how-to-read-them.md)** | `next experimental-analyze` (16.1+, Turbopack) vs `@next/bundle-analyzer` (whose own heading says "for Webpack") |
| 13 | **[Fixing what the analyzer finds](03c-fixing-what-the-analyzer-finds.md)** | Heavy client workloads, and moving the work to a Server Component instead of shipping the library |
| 14 | **[Package imports and server externals](03d-package-imports-and-server-externals.md)** | `optimizePackageImports`, `serverExternalPackages` and the auto-opt-out list |
| 15 | **[`next/dynamic` and lazy loading](03e-next-dynamic-and-lazy-loading.md)** | A composite of `React.lazy()` and Suspense, named exports, custom loading, on-demand libraries |
| 16 | **[The `ssr: false` and code-splitting rules](03f-the-ssr-false-and-code-splitting-rules.md)** | 🔴 The four traps, including that a Server Component importing a Client Component does **not** code split |
| 17 | **[Magic comments and optional imports](03g-magic-comments-and-optional-imports.md)** | `turbopackIgnore`, `turbopackOptional`, and why `webpackOptional` is unsupported |
| 18 | **[The runtime choice was withdrawn](04-nodejs-runtime-vs-edge-runtime-capabilities-cold-starts-choo.md)** | 🔴 `runtime = 'edge'` is **deprecated** — remove the export, don't switch it — and the popular claims that are **unsourced** |
| 19 | **[What survives the withdrawal](04b-what-survives-the-withdrawal-proxy-and-region-placement.md)** | Proxy (Node.js by default since 16.0), region placement as a platform concern, `NEXT_RUNTIME` |
| 20 | **[Core Web Vitals](05-core-web-vitals-tuning-lcp-inp-cls-auditing-workflows.md)** | `useReportWebVitals`, the client-boundary rule — and ⚠️ that the source guide is stale and still lists FID |
| 21 | **[Shipping the metric](05b-shipping-the-metric-transport-analytics-and-pre-hydration-setup.md)** | `sendBeacon` with a `keepalive` fallback, analytics wiring, `instrumentation-client` before hydration |
| 22 | **[The lever each metric responds to](05c-the-lever-each-metric-actually-responds-to.md)** | What actually moves LCP, INP and CLS — and which are framework problems rather than app problems |
| 23 | **[Instrumentation and its cost](06-instrumentationts-for-opentelemetry-and-application-monitori.md)** | `register()` blocking readiness on every new server instance; ⚠️ `logging` is **development-only** |
| 24 | **[The price of a span](06b-the-price-of-a-span-trace-volume-as-a-production-cost.md)** | Trace volume as a per-request cost, `NEXT_OTEL_VERBOSE`, `NEXT_OTEL_FETCH_DISABLED`, `start response` as a TTFB probe |
| 25 | **[Milestone: the SprintDesk audit](07-project-milestone-sprintdesk-performance-audit.md)** | Produce a bundle map, keep the artefact, diff it — the method, with acceptance criteria rather than numbers |
| 26 | **[The INP problem on the board](07b-the-inp-problem-on-the-board.md)** | Finding and fixing interaction latency on a drag-heavy surface |
| 27 | **[Instrumenting what you changed](07c-instrumenting-what-you-changed.md)** | Adding tracing, deciding the span volume you will pay for, and the gates that keep the win |
| 28 | **[Glob imports with `import.meta.glob`](10-glob-imports-with-import-meta-glob.md)** | The Vite-compatible API, eager and lazy modes, query strings, negation patterns |
| 29 | **[Native Node.js streams in SSR](11-native-nodejs-streams-in-ssr.md)** | The 16.3 change that invalidates pre-16.3 capacity models |

## Phase gate

You are done with this chapter when you can **take an unfamiliar Next.js 16 application and produce a defensible
performance change**: run `next experimental-analyze --output`, name the largest module and the import chain that
pulls it in, decide whether the fix is a Server Component, a dynamic import or `optimizePackageImports` — and then
prove the change with a metric you can attribute, rather than a build-output number the framework no longer prints.

You should also be able to say, without looking it up, **which popular performance claims about Next.js are no
longer true**: that you choose a runtime per route, that `First Load JS` tells you your bundle size, and that
adopting Turbopack is a decision rather than a default.

## 🔴 What this chapter could not confirm, and says so

The corpus rule is that an unsourced claim is stated as uncertain or left out. Several of this chapter's
best-known "facts" fall there, and the pages say so explicitly rather than repeating them:

- **Why the Edge runtime was deprecated.** The deprecation message page was fetched; it publishes **no rationale**.
- **Edge cold-start figures, memory ceilings, V8-isolate comparisons and the Edge API allow-list.** None of it is in
  the current documentation. The `runtime` reference is four sentences.
- **Any Turbopack speed multiplier.** The API reference gives **no numbers at all**.
- **Any React Compiler build-cost number.** Neither documentation page quantifies it.
- **Core Web Vitals thresholds.** These are web.dev's, not Next.js's, and are attributed accordingly.

## Where this connects

- [05 · Caching, PPR and Cache Components](../05-caching-ppr-and-cache-components/01-explanation.md) — the Turbopack
  FileSystem cache and what a warm build actually reuses
- [13 · Testing and developer experience](../13-testing-and-developer-experience/01-explanation.md) — Turborepo,
  remote caching, and the CI pipeline this chapter's gates run in
- [16 · Deployment, scaling and observability](../17-deployment-scaling-and-observability/01-explanation.md) — owns
  telemetry's **contracts**: `register()`, `onRequestError`, the span catalogue. This chapter owns only its cost.
- [03 · Server vs Client Components](../03-server-components-vs-client-components/01-explanation.md) — the boundary
  that decides what ends up in the client bundle in the first place

---

Start → [01 · Turbopack in dev and production](01-turbopack-in-dev-and-production-fast-refresh.md)
