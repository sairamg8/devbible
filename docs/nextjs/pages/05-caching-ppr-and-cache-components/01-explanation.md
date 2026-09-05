---
title: "05 · Caching, PPR and Cache Components"
sidebar_label: "Overview"
sidebar_position: 0
description: "Chapter index: the explicit caching model, custom cacheLife profiles, the three cache directives, Partial Prerendering, the complete revalidation inventory, Turbopack build caches, and the SprintDesk shell milestone."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-04 for **Next.js 16.3.4** against [Caching](https://nextjs.org/docs/app/getting-started/caching) (docs `lastUpdated` 2026-08-25), [`cacheComponents`](https://nextjs.org/docs/app/api-reference/config/next-config-js/cacheComponents) (`lastUpdated` 2026-06-22) and [Migrating to Cache Components](https://nextjs.org/docs/app/guides/migrating-to-cache-components) (`lastUpdated` 2026-08-25).
> Target: **Next.js 16.3.4**, App Router, Node.js runtime. Documentation-verified; **no sandbox run**.
> Validated: 2026-09-05 · claims + version spine re-checked against the Next.js 16.3.4 docs · session d2e9b9fe

**This chapter is about one inversion and everything that follows from it. The previous caching model cached by default and made you opt out; Cache Components caches nothing and makes you opt in, and because every cacheable thing is now declared, the framework can check at build time that each route produces a static shell and name the component standing in the way when one does not. That is the trade: you write more annotations and you stop shipping rendering behaviour you did not choose. The cost side is real and under-advertised — `use cache` is a weaker store than the `fetch` Data Cache it replaces, and nothing you can buy survives a deploy — so the chapter treats it as a trade rather than an upgrade throughout.**

## Chunks

| # | Page | Covers |
|---|---|---|
| 1 | **[The explicit caching model](01-the-explicit-caching-model-cachecomponents-build-flag-and-th.md)** | The flag, the three experimental flags it replaced, the exact inversion of the `fetch` default, and what mandatory declaration buys in validation |
| 1b | **[What the model costs](01b-what-the-model-costs-persistence-storage-and-the-runtime-floor.md)** | 🔴 The persistence regression against `fetch`/`unstable_cache`, the three physical copies of one value, serverless vs self-hosted, the Node.js floor |
| 1c | **[Flipping the flag on an existing app](01c-flipping-the-flag-on-an-existing-app.md)** | The migration order, the complete removal table, `instant = false` and its two hard limits, why synchronous IO cannot be deferred |
| 1d | **[What changes once the flag is on](01d-what-changes-once-the-flag-is-on.md)** | Navigation hooks that suspend, `GET` handlers that throw to bail out, React `<Activity>` preserving state across navigations |
| 2 | **[Custom `cacheLife` profiles](02-the-use-cache-directive-and-custom-cachelife-profiles.md)** | Defining profiles in `next.config.ts`, redefining built-ins, and 🔴 the three thresholds that silently exclude content from the shell |
| — | **[The three cache directives](10-the-three-cache-directives/README.md)** | Nine chunks on `use cache`, `use cache: remote` and `use cache: private` — the directive itself, keys, composition and lifetimes |
| 3 | **[Partial Prerendering](03-partial-pre-rendering-ppr-static-shell-dynamic-holes-for-min.md)** | What PPR produces, the four shell rules, why `cookies()` no longer costs the route, and why `<Suspense>` makes nothing dynamic |
| 3b | **[Maximizing the shell, and crawlers](03b-maximizing-the-shell-the-app-shell-and-what-crawlers-get.md)** | The depth rule, static shell vs App Shell, per-link prefetch cost, and 🔴 the bot path that can fail for Googlebot alone |
| 3c | **[Validation, DevTools and CI](03c-instant-navigation-validation-devtools-and-proving-it-in-ci.md)** | Why a page load and a client navigation differ, the Navigation Inspector, and the `instant()` helper that makes a shell a CI assertion |
| 4 | **[Revalidation: every way a lifetime ends](04-revalidation-time-based-isr.md)** | The full inventory of 15 endings, including 🔴 the two calls that re-render without invalidating anything |
| 5 | **[Turbopack build caches](05-turbopack-build-caches-persistent-build-cache-and-memory-evi.md)** | The two real config keys, why a containerized CI build gets no benefit, and the tri-state eviction setting that only affects `next dev` |
| 6 | **[Milestone: cache the board shell](06-project-milestone-cache-sprintdesks-team-dashboard-shell-wit.md)** | SprintDesk's board as a PPR shell with tag-based invalidation, and eight criteria that each fail diagnostically |

## The five facts most likely to catch you

1. **`use cache` does not survive a deploy** — the build id is part of the cache key, so even a durable `remote` handler starts cold at every release. [01b](01b-what-the-model-costs-persistence-storage-and-the-runtime-floor.md)
2. **A short `cacheLife` profile silently removes content from the static shell.** An `expire` under five minutes or a `stale` under thirty seconds excludes it from prerenders, with no error. [02](02-the-use-cache-directive-and-custom-cachelife-profiles.md)
3. **A `<Suspense>` boundary does not make anything dynamic.** It permits a hole; it does not create one. Synchronous work completes during the prerender regardless. [03](03-partial-pre-rendering-ppr-static-shell-dynamic-holes-for-min.md)
4. **Crawlers do not get the shell.** They are detected by user agent and served a full request-time render, so a shell depending on build-time-only data works for every human and fails for Googlebot. [03b](03b-maximizing-the-shell-the-app-shell-and-what-crawlers-get.md)
5. **`refresh()` and `router.refresh()` expire no cached data.** They re-render — `refresh()` "allows you to refresh the client router from within a Server Action" and clears the client cache — but no `use cache` entry on the server is expired, so the re-render reads the same cached value back. [04](04-revalidation-time-based-isr.md)

## ⚠️ On the four-layer model

Material written for Next.js 15 and earlier — including earlier revisions of this page — describes caching as four independently-invalidated layers: Request Memoization, the Data Cache, the Full Route Cache and the client Router Cache. **That model is not wrong, but it is not this chapter.** It describes the previous caching model, which is still supported and still what you have if `cacheComponents` is off. It is documented upstream at [Caching and Revalidating (Previous Model)](https://nextjs.org/docs/app/guides/caching-without-cache-components), taught in this corpus at [ch4 · 03](../04-data-fetching-in-the-app-router/03-static-vs-dynamic-rendering-force-dynamic-force-static-reval.md), and its layer-by-layer breakdown lives at [ch6 · 03d](../06-ssg-isr-and-ssr-strategy/03d-the-cache-is-not-one-thing.md).

The reason to be careful about which model you are reading is that the two have **opposite defaults**. A bare `fetch()` leaves a route static and stale under the previous model, and makes it dynamic under Cache Components. Any advice about caching in Next.js is only correct relative to the model it was written for, and most of what is findable online predates this one.

## Phase gate

You are done with this chapter when you can take any route in an application, say which of its components land in the static shell and which are holes, give the reason for each, move one from either category to the other on purpose, and say what happens to all of it at the next deploy.

## Where this connects

- [ch4 · Data fetching in the App Router](../04-data-fetching-in-the-app-router/01-explanation.md) — the previous model, `unstable_cache`, and the SprintDesk scaffold this chapter's milestone extends
- [ch6 · SSG, ISR and SSR strategy](../06-ssg-isr-and-ssr-strategy/01-explanation.md) — the tuning question: what number to choose, staleness budgets, the stampede, and the cache layers
- [ch8 · State management in an RSC world](../08-state-management-in-an-rsc-world/10b-refresh-against-the-alternatives.md) — the five-way decision between refresh, updateTag, revalidateTag, revalidatePath and router.refresh
- [ch15 · Databases and full-stack patterns](../15-databases-apis-and-full-stack-patterns/10d-tenancy-and-caching.md) — tenancy in the cache key and tenant-scoped invalidation
- [ch17 · Deployment, scaling and observability](../17-deployment-scaling-and-observability/01-explanation.md) — cache handlers, the Adapters API and self-hosting

---

Start → [01 · The explicit caching model](01-the-explicit-caching-model-cachecomponents-build-flag-and-th.md)
