---
title: "20 · Appendices — the reference half of the book: a glossary that disambiguates rather than defines, an upgrade blueprint, the agent and CLI tooling, a corrected production checklist, and the watchlist that resolved"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-09-04 against the [Next.js Glossary](https://nextjs.org/docs/app/glossary), [How to upgrade to version 16](https://nextjs.org/docs/app/guides/upgrading/version-16), [How to set up your Next.js project for AI coding agents](https://nextjs.org/docs/app/guides/ai-agents), [Enabling Next.js MCP Server for Coding Agents](https://nextjs.org/docs/app/guides/mcp), the [`next` CLI reference](https://nextjs.org/docs/app/api-reference/cli/next) and [How to optimize your Next.js application for production](https://nextjs.org/docs/app/guides/production-checklist).
> Target: **Next.js 16.3.4** · 16.3 GA **2026-08-03** · React **canary** · Node.js **20.9+** · TypeScript **5.1+** · Turbopack default. Documentation-verified; **no sandbox run, no timings**.

**Chapters 1 to 18 teach. This one is what you open with the thing already broken, or at the moment someone asks a question you should be able to answer without looking it up and cannot. Five appendices, thirteen pages: the vocabulary, the upgrade, the tooling, the launch checklist and the release record. Each is written against a primary source and says which — and where the primary source is wrong, out of date, or silent, the appendix says that too rather than smoothing it over. Three of those cases turned out to matter, and they are listed below.**

## 🔴 What this chapter corrects

An appendix that only restates the docs is worth nothing. These are the places where checking the source changed the answer.

| Correction | Where |
|---|---|
| **The official production checklist is six months behind the release it is stamped with.** Fetched as Markdown it reports `version: 16.3.4` and `lastUpdated: 2026-03-10`; the body follows the second. It still calls PPR experimental, still says accessibility linting is built in, and still links a bundle analyzer anchored `for-webpack`. | [Appendix D part 1](04-appendix-d-production-readiness-checklist-security.md) |
| **The first-party Skills were not withdrawn.** This book said they were. The docs say framework knowledge moved to the bundled docs and Skills kept the workflow job — they ship today. | [Appendix E](05-appendix-e-version-watchlist.md) · [Appendix C part 2](03b-appendix-c-runtime-sight-mcp-and-the-error-loop.md) |
| **The official glossary has no entry for `MCP` or `Instant Navigations`**, and both are current shipped features. Six terms this book uses are missing from it; each is sourced here from the guide that owns it, with the gap stated rather than papered over. | [Appendix A part 3](01c-appendix-a-glossary-the-a-to-z.md) |
| **`next upgrade` and `next experimental-analyze` exist** as first-party commands added in 16.1. The second is the real successor to the `size` / `First Load JS` metrics that 16.0 removed — so any CI gate parsing build output for sizes now passes vacuously. | [Appendix C part 3](03c-appendix-c-the-cli-surface.md) |
| **A docs page's `version:` field is the docs build, not a review date**, and is stamped identically on every page. `lastUpdated:` is the only freshness signal, and fetching with `.md` appended returns both. | [Appendix C part 1](03-appendix-c-tooling.md) |

## Pages

| # | Page | Covers |
|---|---|---|
| 1 | **[Glossary, part 1 — PPR, RSC, Cache Components](01-appendix-a-glossary-ppr.md)** | the rendering vocabulary, each term defined against what it is mistaken for · 🔴 the Static Shell / App Shell distinction and the 30-second and 5-minute floors |
| 2 | **[Glossary, part 2 — Turbopack, MCP, Instant Navigations](01b-appendix-a-glossary-turbopack-mcp-instant.md)** | the build and tooling vocabulary · what Turbopack breaks loudly and what it breaks silently · why instant navigation has no HTTP signal |
| 3 | **[Glossary, part 3 — the A–Z](01c-appendix-a-glossary-the-a-to-z.md)** | every official term, cross-linked to the chapter that teaches it · 🔴 the six terms the official glossary does not carry |
| 4 | **[Appendix B — the React canary model](02-appendix-b-react-upgrade-blueprint-tracking-react-canary-nex.md)** | 🔴 why the `react` in your `package.json` is not what renders your pages · the React Compiler's stable-but-off status and its Babel cost |
| 5 | **[Appendix B — the migration the build catches](02b-appendix-b-the-15-to-16-migration-mechanically.md)** | the three codemods and the gap between them · removed synchronous Request APIs · every removal in one table |
| 6 | **[Appendix B — the changes nothing catches](02c-appendix-b-the-changes-nothing-catches.md)** | 🔴 six `next/image` defaults that moved, one coercing silently · scroll behaviour · the metrics that stopped existing |
| 7 | **[Appendix C — agent docs and AGENTS.md](03-appendix-c-tooling.md)** | the docs bundled in `node_modules` · the managed block you do not own · the three version tiers · the monorepo path trap |
| 8 | **[Appendix C — MCP and the error loop](03b-appendix-c-runtime-sight-mcp-and-the-error-loop.md)** | all nine MCP tools · the browser view · 🔴 `[stream]` / `[cache]` / `[block]` as three different products |
| 9 | **[Appendix C — the CLI surface](03c-appendix-c-the-cli-surface.md)** | all eight commands, two added in 16.1 · `--debug-prerender` and `--debug-build-paths` · 🔴 `--keepAliveTimeout` and the 502s that never reproduce locally |
| 10 | **[Appendix D — what the official checklist gets wrong](04-appendix-d-production-readiness-checklist-security.md)** | 🔴 the six drift points, each traced to the document that supersedes it · corrected rendering and caching |
| 11 | **[Appendix D — security](04b-appendix-d-security.md)** | the half that has not aged · a Server Action is a public endpoint · `server-only`, tainting, and what `NEXT_PUBLIC_` actually means |
| 12 | **[Appendix D — metadata, a11y, measurement](04c-appendix-d-metadata-a11y-and-the-measurements.md)** | 🔴 nothing checks accessibility on a default 16 project · the class of a11y bug no linter reaches · the corrected 14-item pre-launch pass |
| 13 | **[Appendix E — the version watchlist](05-appendix-e-version-watchlist.md)** | what stabilized in 16.3, what did not, and the entry this book had wrong · the four states a two-column watchlist cannot express |

## How to use this chapter

**Reading it front to back is not the point.** Three entry points cover almost every real use:

- **"What does this word mean, exactly?"** → [Appendix A part 3](01c-appendix-a-glossary-the-a-to-z.md), then part 1 or 2 if the answer turns out to be a distinction rather than a definition. Most of the expensive confusions in this framework are two words for one thing, or one word for two.
- **"We are upgrading."** → [Appendix B part 2](02b-appendix-b-the-15-to-16-migration-mechanically.md) for what the build will catch, then [part 3](02c-appendix-b-the-changes-nothing-catches.md), which is the one that matters because nothing else will surface it.
- **"We are launching."** → [Appendix D](04-appendix-d-production-readiness-checklist-security.md), all three parts, and do not substitute the official checklist without reading part 1 first.

## Phase gate

You are done with this chapter when you can do four things without opening a browser: **state which React renders your App Router pages and why your `package.json` cannot tell you** · **name what changes in a 15 → 16 upgrade that no build, test or type check will catch** · **explain why a route that lost instant navigation still returns `200` with correct HTML, and what you would write in CI to catch it** · and **say what checks accessibility on a default Next.js 16 project.** The last one is a trick question, and knowing that it is a trick question is the answer.

## Where this connects

- [05 · Caching, PPR and Cache Components](../05-caching-ppr-and-cache-components/01-explanation.md) — the model Appendix A's vocabulary describes
- [12 · SEO, metadata and accessibility](../12-seo-metadata-and-accessibility/01-explanation.md) — the depth behind Appendix D part 3
- [14 · Agent-driven development](../14-agent-driven-development/01-explanation.md) — the chapter Appendix C is the reference half of
- [16 · Deployment, scaling and observability](../17-deployment-scaling-and-observability/01-explanation.md) — where `keepAliveTimeout`, version skew and `deploymentId` are worked through

---

Start → [Glossary, part 1 — PPR, RSC, Cache Components](01-appendix-a-glossary-ppr.md)
