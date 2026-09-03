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
`/mnt/Storage/Backup/Code/frontend/docs/nextjs`. **19 chapters, 135 pages**, carried
across verbatim (140 at import; 5 duplicate appendix pages have since been removed).

Next.js is the second React meta-framework in this bible and the one most likely to be the
thing you actually ship. The React track teaches you components; this track teaches you the
server that renders them — routing, caching, rendering strategy, and the deployment surface
underneath.

## 🔴 Read this before you trust a page

This corpus was authored against **Next.js 16.2, with 16.3 still in preview**, and imported
as-is. A verification pass on **2026-09-03** found the version layer had drifted.

✅ **Steps 1–2 of the refresh were applied 2026-09-03.** **13 pages now carry an inline
correction callout** naming what changed upstream, and the chapter 18/19 appendix duplication
is fixed. **The structure is sound; the corrected facts are flagged in place.** What remains
is additive — see *Still open* below.

| | Corpus says | Upstream, 2026-09-03 |
|---|---|---|
| Current stable | 16.2.x | **16.3.4** |
| 16.3 | "in preview" | **stable since 2026-08-03** |
| LTS model | stable / canary / preview | **16.3 = Active LTS · 15.5 = Maintenance LTS** |
| Node.js floor | 20+ | **20.9** |
| React | 19.2+ | App Router **bundles React canary** |
| React Compiler | "stable … Rust" | `reactCompiler` **stable**; the **Rust port is experimental** |

The three findings that changed what a page tells you to do — **all three now carry a
correction callout on the page itself**:

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

## What was done, 2026-09-03

The track arrived as 140 imported pages and is now **215**. Four steps ran in one day:

1. **Corrected** the facts upstream contradicted — 13 pages carry an inline callout.
2. **De-duplicated** the chapter 18/19 appendices.
3. **Absorbed** what 16.3 shipped: the three cache directives (8 chunks), `catchError` and the
   error model, auth interrupts, `useOffline`, Instant Navigations (6 chunks), root params,
   prefetch inlining, the `instant()` helper, TypeScript 7.
4. **Extended** to the concepts with no bullet anywhere: the Adapters API (9 pages), OpenNext,
   immutable static assets, CSP, Authentication with Cache Components, the 2026 CVE record,
   Draft Mode, BFF, SWR and TanStack Query.

Then a **de-quoting pass**: the new pages were first written with ~12,900 words of Vercel's
documentation quoted verbatim across 394 blockquotes. All of it was rewritten in our own
voice, with **zero facts lost** — verified by diffing every identifier, number and cited URL
against the pre-rewrite commit. Eight quotes survive, one per page, each under 25 words and
each kept because the exact wording is normative.

### Then brought to house style

Measured against `.agents/references/house-style.md` rather than guessed: real
`← Prev · Index · Next →` footers replacing 40 `{/* FOOTER */}` markers (a valid MDX comment
with no link, which every other check passes while the page has no navigation at all);
`**★ ` entry markers, which are also the project's split-proof counter; and every `:::`
admonition converted to the corpus form of bold lead-ins with 🔴/⚠️.

The version pin in `src/data/pins.js` is current at **16.3.4**. 🔴 It carries a comment
explaining that 16.3.1 → 16.3.4 was **not** a patch bump — it spans the August security
release that disabled AVIF — so a future 16.3.x is not treated mechanically.

### Still open

- **Absorb the ten features that shipped in 16.3** into the chapters that already have a home
  for them: `catchError` + `retry()` (§7), root params (§2), the real Instant Navigations
  names (§2), the `instant()` Playwright helper and TypeScript 7 (§13), glob imports,
  prefetch inlining, immutable static assets, Node.js-streams SSR (§11/§16), `useOffline` (§7).
- **Extend to the ~15 documented concepts with no bullet anywhere**: `use cache: private` /
  `use cache: remote` (the largest single gap), `forbidden()`/`unauthorized()` +
  `authInterrupts`, Draft Mode, CSP, Authentication with Cache Components, Multi-tenant,
  PWAs, `useLinkStatus`, `refresh()`, OpenNext and the 12-page Adapters section.

## Known defects carried over from the source

Recorded so they can be fixed deliberately:

- ✅ ~~**Chapters 18 and 19 duplicate the appendices.**~~ **Fixed 2026-09-03** — chapter 18's
  five byte-identical copies were deleted (0 inbound links). Appendices live in chapter 19
  only, and **Appendix E was rewritten from a watchlist into a shipped/withdrawn record**.
- **Every chapter has two files prefixed `01-`** — `01-explanation.md` alongside
  `01-<first-topic>.md`. Cosmetic only: `sidebar_position` values do not collide, so the
  sidebar renders correctly.
- **Depth is well below the devbible norm.** 135 files averaging **~70 lines per page**, one
  file over 300 (`04-data-fetching/01-explanation.md` at 431, inherited unchanged). devbible topics run 250–300 lines per chunk with
  exhaustive gotchas and interview questions. Reaching that bar is roughly a 5–8× expansion.
- **No `> Verified:` lines** on the 135 imported pages, and the `[D]`/`[O]`/`[R]` badges
  have not been re-tiered against devbible's four-tier system.

**Changes made to the copied material, in full.** At import (2026-09-03): chapter 1 shipped
two differing files both at `sidebar_position: 4`, and the shorter moved to `4.5`; 18 broken
relative links were repointed (13 already broken in the source, 5 broken by the move).
Then, under steps 1–2: **13 pages gained a correction callout** and **5 duplicate appendix
pages were deleted from chapter 18**. No other prose was edited.
