---
title: "Every page in your application is already using a rendering strategy — the only question is whether anyone chose it, and the four concepts in this chapter are the four places that choice gets made or gets made for you"
sidebar_label: "01 · Overview: the chapter map"
sidebar_position: 0
description: "Chapter index for SSG, ISR and SSR strategy: choosing a rendering pattern, generateStaticParams at scale, ISR tuning, static export versus serverful edge distribution, three decision walkthroughs, and the milestone that puts all three strategies in one deployment."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-04 for **Next.js 16.3.4 · React 19.2.8 · Node 20.9 floor**. Every page in this
> chapter was written against documentation whose own metadata reports `version: 16.3.4`; the
> per-page `> Verified:` lines name the exact sources and dates. Documentation-verified;
> **no sandbox run** — and note that **`next` is not installed in this checkout**, so no page here
> rests on a probe of the Next.js package.

**This chapter is the strategy layer, and it deliberately owns none of the mechanics.** How `dynamic`, `revalidate`, `fetchCache` and `dynamicParams` behave is [chapter 4's segment config surface](../04-data-fetching-in-the-app-router/03b-the-segment-config-surface.md); what the cache directives do is [chapter 5's three-directives topic](../05-caching-ppr-and-cache-components/10-the-three-cache-directives/README.md); where the bytes are served from is [chapter 16](../16-deployment-scaling-and-observability/01-vercel-automated-deployments-edge-network-preview-branches.md). What none of those answer is the question you actually face: **given this page, with these requirements, which pattern — and what did that cost you?** That is this chapter, and it is worth being explicit that the honest default is *static until something forces otherwise*, because in most codebases the thing that forced otherwise was an accident nobody reviewed.

## Chunks

| # | Chunk | Covers |
|---|---|---|
| 01 | **[Choosing a rendering pattern](01-choosing-a-rendering-pattern-seo-build-time-data-velocity-pe.md)** | SEO and build time made operational. 🔴 Crawlers are detected by user agent and served a full dynamic render — which retires most "SSR for SEO" reasoning |
| 01b | **[Data velocity and the staleness budget](01b-data-velocity-and-the-staleness-budget.md)** | How stale is *acceptable* is a product question people try to answer technically. `revalidate: 60` does not mean "at most 60 seconds old" |
| 01c | **[Personalization without going dynamic](01c-personalization-without-going-dynamic.md)** | The shell/hole split, and what reading `cookies()` does and no longer does |
| 01d | **[The decision procedure, and when SSR is right](01d-the-decision-procedure-and-when-ssr-is-right.md)** | An ordered set of questions you can actually run, and the positive case for request-time rendering |
| 01e | **[The accidental opt-out](01e-the-accidental-opt-out-and-what-each-pattern-costs.md)** | 🔴 One `cookies()` call in a shared utility makes a whole route dynamic — how to find it, and what each pattern costs |
| 02 | **[`generateStaticParams` at scale](02-generatestaticparams-for-pre-rendering-dynamic-routes-at-sca.md)** | Build time as the axis nobody budgets for, and partial enumeration as a strategy |
| 02b | **[Enumerating from a database at build time](02b-enumerating-from-a-database-at-build-time.md)** | What it does to CI and to build reproducibility |
| 02c | **[Nested segments and combinatorics](02c-nested-segments-and-the-combinatorial-explosion.md)** | The explosion, and what `dynamicParams` decides about the tail |
| 02d | **[What Cache Components changes](02d-when-the-path-set-changes-and-what-cache-components-changes.md)** | 🔴 v16.0.0 removes `dynamic`, `dynamicParams`, `revalidate` and `fetchCache` under Cache Components |
| 03 | **[ISR tuning](03-isr-at-enterprise-level-stale-while-revalidate-tuning.md)** | Picking a revalidate window from a product requirement rather than a habit |
| 03b | **[The stampede](03b-the-stampede-and-what-the-framework-does-not-protect-you-from.md)** | 🔴 Whether N concurrent requests cause one regeneration or N is **not settled by the documentation** — the page says so and engineers around it |
| 03c | **[Budgets and on-demand](03c-revalidate-budgets-and-time-based-versus-on-demand.md)** | Per-route budgets, and time-based vs on-demand as different operational shapes |
| 03d | **[The cache is not one thing](03d-the-cache-is-not-one-thing.md)** | Multi-instance reality — the default file-system cache is per-instance |
| 04 | **[Static export: what it removes](04-full-static-export-vs-serverful-edge-distribution.md)** | The thirteen unsupported features, each checked. 🔴 "Headers" in that list is the **config option**, not `headers()` |
| 04b | **[What survives, and the `force-static` trap](04b-what-survives-and-the-force-static-trap.md)** | A `force-static` `GET` Route Handler **is** prerendered to a file; `force-static` blanks `cookies()`/`headers()` rather than erroring |
| 04c | **[When export wins, what a server buys](04c-when-export-wins-and-what-a-server-buys.md)** | Export is sometimes right; *"to run Next.js, your platform needs a Node.js server"* |
| 04d | **[The migration back](04d-the-migration-back-and-the-one-way-door.md)** | Discovering too late that you needed a removed feature |
| 05 | **[Deciding, and marketing pages](05-architecture-decision-walkthroughs-marketing-pages.md)** | The first walkthrough, run as a decision rather than a description |
| 05b | **[Content platforms and the SSR reflex](05b-content-platforms-and-the-ssr-reflex.md)** | Where teams most reliably over-choose request-time rendering |
| 05c | **[Operating it at archive scale](05c-operating-a-decomposed-page-at-archive-scale.md)** | What the content-platform choice costs once the archive is large |
| 05d | **[Authenticated dashboards](05d-authenticated-dashboards.md)** | The case where personalization genuinely drives the decision |
| 06 | **[Milestone: three strategies, one deploy](06-project-milestone-static-marketing-pages-isrd-public-team-pa.md)** | Static marketing, ISR'd public pages and a dynamic authenticated app in one deployment |
| 06b | **[What breaks at the seams](06b-what-breaks-at-the-seams.md)** | 🔴 The actual lesson — a shared layout reading cookies drags a static route dynamic |
| 06c | **[Data-layer seams, choosing a fix](06c-data-layer-seams-and-choosing-a-fix.md)** | Lifting the read out versus reaching for a directive |
| 06d | **[Acceptance and the Cache Components variant](06d-acceptance-criteria-and-the-cache-components-variant.md)** | What you assert in CI, and what the Cache Components version of the milestone looks like |

## What this chapter does not own

- [ch4 · static vs dynamic rendering](../04-data-fetching-in-the-app-router/03-static-vs-dynamic-rendering-force-dynamic-force-static-reval.md) and [ch4 · the segment config surface](../04-data-fetching-in-the-app-router/03b-the-segment-config-surface.md) — the mechanics of `dynamic`, `revalidate`, `fetchCache` and `dynamicParams`, including `generateStaticParams`'s timing rules.
- [ch4 · diagnosing stale and unexpectedly dynamic routes](../04-data-fetching-in-the-app-router/03c-diagnosing-stale-and-unexpectedly-dynamic-routes.md) — reading what the build actually decided.
- [ch5 · the three cache directives](../05-caching-ppr-and-cache-components/10-the-three-cache-directives/README.md) — `use cache`, `cacheLife`, `revalidateTag`/`updateTag`, cache keys and directive choice.
- [ch16 · deployment and cost](../16-deployment-scaling-and-observability/05-cost-engineering-function-compute-bandwidth-and-edge-cache-h.md) — topology and the bill.

⚠️ **A gap worth knowing about, recorded rather than hidden.** There is **no authored Partial Pre-Rendering page anywhere in this track**, and the standalone upstream PPR URL 404s in 16.3.4 — PPR is documented inside the Caching page. Chapter 5's PPR page is still a generated stub, so [01c](01c-personalization-without-going-dynamic.md)'s deferral for the shell-and-holes mechanics currently points at a page thinner than the one linking to it.

## Phase gate

You are done with this chapter when you can take a page you have never seen, state which rendering pattern it should use and why, name the one requirement that would change your answer, and say what that choice costs — in build time, in staleness, and in money. And when you can look at a route that went dynamic and find the line that did it.

## Where this connects

- [ch2 · Routing and navigation](../02-routing-and-navigation/01-file-system-routing-pagetsx.md) — the segments these strategies are applied to.
- [ch7 · Error handling and resilience](../07-error-handling-loading-states-and-resilience/01-explanation.md) — what happens when a regeneration fails.
- [ch17 · Advanced ecosystem topics](../17-advanced-ecosystem-topics/01-explanation.md) — multi-zone architecture, where two applications make these choices independently.

---

Start → [01 · Choosing a rendering pattern](01-choosing-a-rendering-pattern-seo-build-time-data-velocity-pe.md)
