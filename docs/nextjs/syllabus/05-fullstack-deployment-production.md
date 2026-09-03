---
title: "Part 5 · Full-Stack, Deployment & Production"
sidebar_label: "5 · Full-Stack, Deployment & Production"
sidebar_position: 5
---

> Verified: 2026-09-03 against the [live docs navigation](https://nextjs.org/docs) and the
> [Next.js blog](https://nextjs.org/blog).
> ⚠️ Imported syllabus verbatim; drift flagged inline.
> ✅ **The chapter 18/19 appendix duplication was FIXED on 2026-09-03**; Appendix E has been
> rewritten from a watchlist into a shipped/withdrawn record.

## 15 · Databases, APIs, and Full-Stack Patterns

- Database integrations: serverless Postgres (Neon), Prisma, Drizzle, connection pooling.
- Hybrid API design: Route Handlers and Server Actions side-by-side, and when to pick each.
- Real-time: Server-Sent Events and WebSockets in a serverless-first world.
- Background jobs and message queues for async workloads.
- Edge Functions and custom cache structures for global compute.
- **Project Milestone:** SprintDesk on Drizzle + Neon with pooling; SSE-powered live board updates; a background job for digest emails.
  - ➕ **Missing:** the **Multi-tenant** guide — which is what SprintDesk *is*, unnamed for 18 chapters — plus Custom Server and Environment Variables.

## 16 · Deployment, Scaling, and Observability

- Vercel: automated deployments, edge network, preview branches.
- Self-hosting: Docker containerization, the stable Build Adapters API, deploying beyond Vercel.
  - ⚠️ **One bullet, thirteen upstream pages.** Adapters is now a full section: Creating an
    Adapter · Testing Adapters · Routing with `@next/routing` · **Implementing PPR in an
    Adapter** · Runtime Integration · Invoking Entrypoints · Output Types · Supported
    Providers. And **OpenNext** — the main non-Vercel deployment story — is named nowhere.
- Multi-region strategies and data-locality patterns.
  - ⚠️ Re-audit against the **`preferredRegion` deprecation** (chapter 11).
- Telemetry: Sentry, Logtail, Datadog integration via `instrumentation.ts`.
- Cost engineering: function compute, bandwidth, and edge-cache hit-rate economics.
  - ➕ **Missing:** **immutable static assets reused across deployments** (16.3) — immutable
    by definition, therefore skew-proof, and a real cache-hit-rate lever.
- **Project Milestone:** SprintDesk deployed twice — Vercel and a Dockerized self-host — with shared observability.

## 17 · Advanced Ecosystem Topics

- Micro-frontends and multi-zone architectures for decoupled teams.
- Pages Router → App Router migration roadmaps for legacy codebases.
  - ⚠️ **Now a security argument too.** CVE-2026-75604 affects apps running Pages Router
    *and* App Router without Cache Components on Windows hosts, with **no workaround**.
- Enterprise compliance: OWASP mapping, token-leakage prevention, supply-chain vigilance.
  - ➕ **Made concrete:** the AVIF RCE arrived through libheif → `sharp` → Next.js. The
    framework's own code was never at fault — that is the supply-chain lesson.
- Framework extension and plugin development.

## 18 · Capstone, Decision Trees, and Outlook

- **SprintDesk retrospective:** the finished multi-tenant SaaS reviewed end-to-end against the Production Readiness Checklist.
- **Case Study 2 (contrast):** a PPR-driven e-commerce storefront — different rendering, caching, and state decisions, and why.
- Architecture decision trees: rendering strategy, caching strategy, state placement, runtime selection.
  - ➕ **A fourth tree is now needed:** which cache directive — `use cache` vs
    `use cache: private` vs `use cache: remote` vs none — driven by whether the scope reads
    request APIs and whether the data may rest on the server.
- Outlook: deeper AI runtimes, compiler evolution, and how to evaluate preview features without betting production on them.
  - ➕ **Concrete near-term item:** Vercel states the Instant Navigations behaviours become
    the **default in a future major**, so plan `cacheComponents` + `partialPrefetching` as a
    migration. And the honest counter-example: the **retired Skills** (chapter 14) — a
    previewed feature withdrawn rather than stabilized.
- **Appendices A–E.**
  - ✅ **FIXED 2026-09-03.** Chapter 18 used to close by listing Appendices A–E in full while
    chapter 19 repeated all five **verbatim** — five byte-identical duplicate pages. Chapter
    18's copies were deleted (0 inbound links); **the appendices now live in chapter 19
    only.**

## 19 · Appendices

- **Appendix A:** Glossary (PPR, RSC, Turbopack, Cache Components, MCP, Instant Navigations).
  - ➕ Add: App Shell, Partial Prefetching, root params, Active/Maintenance LTS, adapter.
- **Appendix B:** React upgrade blueprint (tracking React canary → Next.js stable).
  - ⚠️ **Premise needs correcting.** The App Router **bundles React canary** itself; the
    Pages Router uses your `package.json` version. So the tracking is something Next.js does
    *for* you in the App Router — the blueprint is about knowing which half is on which.
- **Appendix C:** Tooling — editor/agent setups, MCP configuration, CLI wrappers.
- **Appendix D:** Production Readiness Checklist (security, caching, observability, a11y, SEO).
  - ➕ Add: patched to current LTS · AVIF status re-verified · not Windows-hosted with mixed
    routers and no Cache Components · `preferredRegion` audited.
- **Appendix E:** Version watchlist — every **[16.3 Preview]** feature in this book, with its stabilization status to verify before production use.
  - 🔴 **The premise has resolved.** 16.3 shipped 2026-08-03, so this becomes a
    shipped/withdrawn record:
    **Stable** — Instant Insights · Partial Prefetching · ISR loading shells · Navigation
    Inspector · `instant()` helper · `catchError` · root params · glob imports · prefetch
    inlining · immutable static assets · TS 7 type checking · versioned agent docs · Node.js
    streams SSR · FS build cache · memory eviction.
    **Still experimental** — `turbopackRustReactCompiler` · `useOffline`.
    **Withdrawn** — the earlier first-party Skills.
    **Deprecated/removed** — `preferredRegion` · `next lint`.
