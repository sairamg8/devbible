---
title: "17 · Deployment, scaling and observability — every default on this list is correct for exactly one instance in exactly one region, and the chapter is the list of what stops being true the moment there are two of anything"
sidebar_label: "Overview"
sidebar_position: 0
description: "Chapter 18 index: Vercel deployments, environments and skew protection, self-hosting with standalone output and Docker, the cache across containers, multi-region and data locality, instrumentation.ts and OpenTelemetry, cost engineering, the deployed-twice milestone, and the Adapters API."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-04 against **Next.js 16.3.4** documentation — [Deploying](https://nextjs.org/docs/app/getting-started/deploying), [Self-hosting](https://nextjs.org/docs/app/guides/self-hosting), [Deploying to platforms](https://nextjs.org/docs/app/guides/deploying-to-platforms), [`output`](https://nextjs.org/docs/app/api-reference/config/next-config-js/output), [`instrumentation.js`](https://nextjs.org/docs/app/api-reference/file-conventions/instrumentation), [OpenTelemetry](https://nextjs.org/docs/app/guides/open-telemetry), [`logging`](https://nextjs.org/docs/app/api-reference/config/next-config-js/logging) and [`preferredRegion` (deprecated)](https://nextjs.org/docs/app/api-reference/file-conventions/route-segment-config/preferredRegion) — plus the Vercel platform documentation for deployments, environments, protection, skew protection, regions and pricing. Every chunk carries its own `> Verified:` line naming the pages and `lastUpdated` values it was written from.
> Version spine: **Next.js 16.3.4** · Node `>= 20.9` · Turbopack is the default bundler since 16.0. `next` is **not installed in this checkout**, so nothing here is probed — documentation-verified throughout, with **no sandbox run**, no timings, no console output and no invoices reproduced.

**Every deployment default in Next.js is correct, and almost every one of them is correct for exactly one instance with one persistent disk in one region. The documentation is unusually honest about this: a single `next start` process handles every feature correctly, and the only extra dependency is `sharp`. What the chapter is really about is the second of everything. A second container splits the ISR cache in two and makes `revalidateTag()` a per-pod fact. A second region moves your compute away from your database and multiplies every query round trip. A second deployment, live at the same time as the one a user already loaded, is version skew. A second environment turns every `NEXT_PUBLIC_` value into a promotion blocker. And the bill is the sum of all of it, metered on five resources that a cache hit reduces to two. Read the chapter for the mechanisms; the milestone at the end ships the same application to two targets, because that is the only exercise that separates a framework guarantee from a platform convenience.**

## 🔴 What this chapter corrects

Six claims in wide circulation are wrong at 16.3.4, each corrected with a verbatim source on the page that owns it:

| Claim you will meet | What the documentation says | Where |
|---|---|---|
| `preferredRegion` is how you place a route near its data | **Deprecated**; the migration is to delete the export, and no framework-level successor is named | [03](03-multi-region-strategies-and-data-locality-patterns.md) |
| `output: 'standalone'` produces a deployable folder | It *"does not copy the `public` or `.next/static` folders by default"* — you copy them | [02](02-self-hosting-docker-containerization.md) |
| `logging.fetches` controls production request logging | The whole block configures the terminal *"when running Next.js in **development mode**"* | [04](04-telemetry-sentry-logtail-datadog-integration-via-instrumenta.md) |
| Serverless means you stop paying while waiting on I/O | Active CPU pauses; *"memory billing continues"* until the last in-flight request completes | [05](05-cost-engineering-function-compute-bandwidth-and-edge-cache-h.md) |
| Skew protection pins the whole page to one deployment | Not custom client `fetch` calls, and *"doesn't pin full-page navigations by default"* | [01c](01c-the-edge-network-and-skew-protection.md) |
| More regions means lower latency | *"Functions should be executed in the same region as your database"* — the round trips multiply | [03](03-multi-region-strategies-and-data-locality-patterns.md) |

## Chunks

| # | Chunk | Covers |
|---|---|---|
| 1 | **[Vercel: deploys, previews, protection](01-vercel-automated-deployments-edge-network-preview-branches.md)** | 🔴 the first deploy is always production; branch vs commit URLs; rollback is promotion; the `VERCEL_URL` trap protection springs |
| 2 | **[Environments and build-time vs runtime](01b-vercel-environments-and-the-build-time-runtime-split.md)** | 🔴 `NEXT_PUBLIC_` is inlined at build, so "promote the build" ships the wrong configuration |
| 3 | **[The edge network and skew protection](01c-the-edge-network-and-skew-protection.md)** | 126 PoPs in front of 20 dense regions; what `?dpl` pins and what it deliberately does not; `__vdpl`; maximum age |
| 4 | **[Self-hosting: standalone and Docker](02-self-hosting-docker-containerization.md)** | 🔴 the two folders standalone leaves behind; the official Dockerfile line by line; `HOSTNAME`; tracing native modules |
| 5 | **[The cache across containers](02b-caching-and-the-cachehandler-when-you-run-more-than-one-container.md)** | 🔴 `cacheHandler` **and** `cacheMaxMemorySize: 0`; `refreshTags`; `cacheHandler` vs `cacheHandlers`; keep-alive 502s |
| 6 | **[Multi-region and data locality](03-multi-region-strategies-and-data-locality-patterns.md)** | 🔴 `preferredRegion` deprecated; the round-trip arithmetic; read replicas and read-your-own-writes; residency |
| 7 | **[Telemetry and `instrumentation.ts`](04-telemetry-sentry-logtail-datadog-integration-via-instrumenta.md)** | 🔴 `register()` blocks readiness; `onRequestError` and the `digest` trap; `instrumentation-client` before hydration |
| 8 | **[OpenTelemetry and the span catalogue](04b-opentelemetry-the-span-catalogue-and-trace-volume.md)** | every default span with its `next.span_type`; the `next.page` identity trap; `NEXT_OTEL_VERBOSE` and fetch-span volume |
| 9 | **[Cost engineering](05-cost-engineering-function-compute-bandwidth-and-edge-cache-h.md)** | 🔴 Active CPU pauses, memory does not; two meters vs five; image transformations on MISS and STALE; build minutes |
| 10 | **[Milestone: deployed twice](06-project-milestone-sprintdesk-deployed-twice.md)** | one repo, two targets, one `instrumentation.ts`, and an acceptance checklist for both |
| 11 | **[The Adapters API](10-the-adapters-api-why-it-exists-and-how-a-platform-wires-one-in.md)** | why a stable build API exists and how a platform wires one in |
| 12 | **[The two adapter hooks](11-modifyconfig-and-onbuildcomplete-the-two-hooks-in-detail.md)** | `modifyConfig` and `onBuildComplete` in detail |
| 13 | **[Adapter output types](12-adapter-output-types-what-a-build-actually-is.md)** | what a Next.js build actually decomposes into |
| 14 | **[Adapter routing](13-adapter-routing-seven-phases-and-the-next-routing-package.md)** | the seven routing phases and the `next/routing` package |
| 15 | **[Invoking entrypoints](14-invoking-entrypoints-runtime-integration-and-ppr-resume.md)** | runtime integration and PPR resume |
| 16 | **[Testing adapters](15-testing-adapters-and-the-verified-adapter-contract.md)** | the compatibility suite and the verified-adapter contract |
| 17 | **[OpenNext](16-opennext-the-community-adapter-that-became-the-standard.md)** | the community adapter that became the standard |
| 18 | **[Deploying beyond Vercel](17-choosing-a-deployment-target-beyond-vercel.md)** | 🔴 the five things multi-instance changes, as a checklist |
| 19 | **[Immutable static assets](18-immutable-static-assets-across-deployments.md)** | 🔴 `supportsImmutableAssets`, `immutableHash`, and the never-change/never-delete obligation |

## Phase gate

You are done with this chapter when you can take an application that currently runs on one platform and, **without deploying it anywhere**, write down two lists: the things that would stop working if it ran as two containers behind a load balancer, and the things that would stop working if it ran in three regions with one database. Each entry must name the mechanism — the per-instance cache, the per-build Server Function encryption key, the missing `deploymentId`, the buffering proxy, the multiplied query round trip — and the configuration or code that fixes it.

The common stopping point is being able to write a Dockerfile. That is chunk 4 of nineteen, and it is the part the documentation already hands you.

## Where this connects

- [Chapter 5 · Caching, PPR and Cache Components](../05-caching-ppr-and-cache-components/01-explanation.md) — the cache this chapter has to make shared, and the directives that decide how much compute a request costs
- [Chapter 6 · SSG, ISR and SSR strategy](../06-ssg-isr-and-ssr-strategy/01-explanation.md) — the rendering decisions that set both the invoice and the build minutes
- [Chapter 4 · Data fetching](../04-data-fetching-in-the-app-router/01-explanation.md) — request waterfalls, which become the dominant term in both multi-region latency and Provisioned Memory
- [Chapter 8 · State in an RSC world](../08-state-management-in-an-rsc-world/01-explanation.md) — why URL state survives the hard navigation that version skew forces
- [Chapter 9 · `next/image` and `remotePatterns`](../09-styling-and-ui/04d-remote-patterns-is-a-security-control.md) — the allow-list whose cache keys become the image-optimization bill
- [Chapter 10 · Forms, auth and security hardening](../10-forms-authentication-and-security-hardening/01-explanation.md) — Server Actions, whose encryption key must be shared across instances
- [Chapter 11 · Native Node.js streams in SSR](../11-performance-optimization-turbopack/11-native-nodejs-streams-in-ssr.md) — the 16.3 change that invalidates pre-16.3 capacity models
- [Chapter 13 · Testing and developer experience](../13-testing-and-developer-experience/01-explanation.md) — why CI must target the commit preview URL and not the branch one
- [Appendix C · the CLI surface](../20-appendices/03c-appendix-c-the-cli-surface.md) — `next start` flags, `next experimental-analyze`, `next upgrade`
- [Appendix D · production readiness checklist](../20-appendices/04-appendix-d-production-readiness-checklist-security.md) — the security, accessibility and SEO gate this chapter deliberately does not duplicate

---

Start → [01 · Vercel: deploys, previews, protection](01-vercel-automated-deployments-edge-network-preview-branches.md)
