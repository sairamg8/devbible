---
title: "Next.js — Syllabus"
sidebar_label: "Overview"
sidebar_position: 0
---

> Verified: 2026-09-03 against the [Next.js blog](https://nextjs.org/blog), the
> [16.3 release post](https://nextjs.org/blog/next-16-3), the
> [installation docs](https://nextjs.org/docs/app/getting-started/installation) and the
> [August 2026 security release](https://nextjs.org/blog/august-2026-security-release).
> **No sandbox run** — this is an inventory plus an imported corpus, not a fresh authoring pass.

The Next.js track, **imported 2026-09-03** from the frontend-bible corpus at
`/mnt/Storage/Backup/Code/frontend/docs/nextjs`. **19 chapters, 140 pages, 9,434 lines**,
carried across verbatim.

Next.js is the second React meta-framework in this bible and the one most likely to be the
thing you actually ship. The React track teaches you components; this track teaches you the
server that renders them — routing, caching, rendering strategy, and the deployment surface
underneath.

## 🔴 Read this before you trust a page

This corpus was authored against **Next.js 16.2, with 16.3 still in preview**. It was
imported as-is, on the instruction to copy rather than rewrite. A verification pass on
**2026-09-03** found the version layer has drifted. **The structure is sound; some facts are
not.**

| | Corpus says | Upstream, 2026-09-03 |
|---|---|---|
| Current stable | 16.2.x | **16.3.4** |
| 16.3 | "in preview" | **stable since 2026-08-03** |
| LTS model | stable / canary / preview | **16.3 = Active LTS · 15.5 = Maintenance LTS** |
| Node.js floor | 20+ | **20.9** |
| React | 19.2+ | App Router **bundles React canary** |
| React Compiler | "stable … Rust" | `reactCompiler` **stable**; the **Rust port is experimental** |

Three findings that change what a page tells you to do:

1. **AVIF is currently disabled upstream.** Chapter 9 teaches `next/image` with AVIF output.
   The August 2026 security release **turned AVIF optimization off** to mitigate
   **GHSA-2xp9-vwfh-vxw4** — unauthenticated RCE via `libheif` (under `sharp`) on an
   attacker-controlled AVIF image. Treat that bullet as *disabled, status to re-verify*.
2. **Every `[16.3 Preview]` tag is stale**, and Appendix E is a watchlist whose subject has
   resolved. The features shipped: Instant Insights, Partial Prefetching, the Navigation
   Inspector, better ISR, the `instant()` Playwright helper, `catchError`, root params,
   glob imports, prefetch inlining, TypeScript 7 type-checking.
3. **Chapter 14's Skills bullet reversed.** It lists first-party Skills as a coming
   attraction; Vercel is **retiring** them, because `next dev` now maintains a
   version-matched `AGENTS.md` pointing at docs bundled in `node_modules`.

A second critical CVE the corpus predates: **CVE-2026-75604** — unauthenticated RCE on
**Windows-hosted** servers running Pages Router *and* App Router without Cache Components.
No workaround; patch to 16.3.3 / 15.5.24.

Full evidence, and a corrected syllabus proposal, live in the frontend repo:
`syllabus/NEXTJS_SYLLABUS_VERIFICATION_20260903.md` and
`syllabus/nextjs_bible_syllabus_v2_16.3_PROPOSED.txt`.

## How this track is shaped

It is **not** in devbible's usual `phase-N-topic/` form. The frontend-bible generator
produced one directory per syllabus chapter and one page per syllabus concept, and the
import preserved that so the pages stay traceable to their source. Each chapter opens with
an `01-explanation.md` overview, then one page per concept.

| Part | Chapters | What it covers |
|---|---|---|
| **1 · Foundations** | 1–3 | App Router, routing and navigation, the server/client split |
| **2 · Data, Rendering & Resilience** | 4–7 | Fetching, caching and PPR, rendering strategy, error handling |
| **3 · State, Styling & UX** | 8–10 | State in an RSC world, styling, forms and security |
| **4 · Advanced Architecture & Performance** | 11–14 | Turbopack, SEO, testing, agent-driven development |
| **5 · Full-Stack, Deployment & Production** | 15–19 | Databases, deployment, ecosystem, capstone, appendices |

The running project throughout is **SprintDesk**, a multi-tenant SaaS task dashboard, with a
PPR-driven e-commerce storefront as the contrast case study in chapter 18.

## Known defects carried over from the source

These were in the corpus before the import and were **not** silently fixed — they are
recorded here so they can be fixed deliberately:

- **Chapters 18 and 19 duplicate the appendices.** Appendices A–E appear in full in both,
  in the syllabus and on disk (`18-capstone…/` holds `06-appendix-b-…` and
  `09-appendix-e-…`; `19-appendices/` holds them again).
- **Every chapter has two files prefixed `01-`** — `01-explanation.md` alongside
  `01-<first-topic>.md`. Cosmetic only: `sidebar_position` values do not collide, so the
  sidebar renders correctly.
- **Depth is well below the devbible norm.** 140 files across 9,434 lines averages **~67
  lines per page**, one file over 300. devbible topics run 250–300 lines per chunk with
  exhaustive gotchas and interview questions. Reaching that bar is roughly a 5–8× expansion.
- **No `> Verified:` lines** on the 140 imported pages, and the `[D]`/`[O]`/`[R]` badges
  have not been re-tiered against devbible's four-tier system.

**One thing was changed during the import:** chapter 1 shipped two differing files both at
`sidebar_position: 4` (`04-versioning-and-lts-model-…md` at 65 lines and `…-2.md` at 32).
The shorter one was moved to `4.5` so the sidebar order is deterministic. Nothing else was
edited.
