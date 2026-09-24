---
name: progress-nextjs-ch02
description: Next.js chapter 02 (Routing and navigation) — CLOSED 2026-09-04 at 51/51 pages. Four parallel forks, per-file commit cadence, the corrections it forced, and the one reconciliation still owed.
metadata:
  type: project
---

# ✅ Next.js ch02 · Routing and navigation — CLOSED

**Closed 2026-09-04, commit `83ff4cb0`. 51 of 51 pages, gap-free 0–50, 11,463 lines, 474 ★.**
From 13 files: 4 written, **8 generated stubs**, 1 generated index.
`src/data/progress.js` line 480 is now `topics: 51, pages: 51`.

## How it was built — four forks, zero collisions

| Fork | Pages | Result | Range |
|---|---|---|---|
| **A** | `01` file-system routing · `02` layouts/parallel/intercepting | 93 L / 0 ★ → **2,499 L / 76 ★** (11 files) | 100–119 |
| **B** | `03` dynamic routes · `08` i18n | 128 L / 0 ★ → **2,282 L / 135 ★** (10 files) | 120–139 |
| **C** | `04` navigation mechanics · `05` prefetching + View Transitions | 128 L / 0 ★ → **3,626 L / 145 ★** (15 files) | 140–159 |
| **D** | `06` Instant Navigations · `07` `proxy.ts` | 92 L / 0 ★ → **2,108 L / 57 ★** (10 files) | 160–179 |

🔴 **Handing each fork an explicit `sidebar_position` RANGE is what produced zero collisions
across FOUR concurrent agents.** Second chapter running; it works.

## 🔴 Per-file commit cadence — new this session, and it earned its keep

On the user's instruction (several agents burn usage fast), a **background watcher committed each
file the moment it was complete** — **60 individual commits** — rather than batching at fork
completion. Every file was gated first on: cap · tier badge · `> Verified:` · `## Gotchas` ·
`## Interview questions` · real footer · no bare `{/* FOOTER */}` · no ```console block · no
truncated title · **MDX with raw-tag detection ON** · every link resolving on disk.

**It caught a real defect class**: parent pages linking chunk filenames their fork had *planned*
and then renamed while splitting (`03d-generatestaticparams-dynamicparams-and-precedence.md`,
`04c-userouter-…`). Those files simply **stayed uncommitted** instead of shipping broken, and the
forks repaired them. 🔴 **Script: `scratchpad/ch02-commit-ready.sh` — worth rebuilding for any
future multi-fork chapter.**

## ✅ The corpus's one known live MDX raw-tag hazard is GONE

It was the malformed H1 in stub `01-file-system-routing-pagetsx.md:7`, on the "still owed" list
for weeks. The rewrite cleared it. `mdxcheck.py` **without** `--no-rawtag` now reports 0 for the
whole directory. 🔴 **This chapter must be checked with raw-tag detection ON — the usual
`--no-rawtag` invocation hides exactly this defect.**

## 🔴 Corrections the chapter forced

1. **Synchronous `params` is REMOVED in 16, not deprecated** — and the `dynamic-routes` reference
   (stamped `16.3.4`) still says it *"will be deprecated in the future"* while the upgrade guide
   says *"fully removed"*. Both quoted; the upgrade guide named authoritative.
2. **`default.js` is now required for every parallel-route slot and builds FAIL without it** — and
   **three live pages disagree**: the upgrade guide says builds fail, the `default.js` reference
   says an error is returned, the Parallel Routes reference *still* says a 404 renders. All three
   printed side by side; could not establish whether the third is stale or narrower.
3. **The `[16.3 Preview]` label is stale** — the announcement post now says it *"has since shipped
   as stable"*.
4. **"Stream / Cache / Block" is NOT an enum.** They are `group` attributes on dev-overlay fix
   cards (`FixCard group="stream|cache|block"`). The chapter's own stub title implied config
   values. The real enums are `instant` and `prefetch`.
5. **`proxy` is Node.js by default and cannot be configured otherwise**, so the "middleware is an
   edge concern" framing is dead. The surviving constraint is a **deployment** one: proxy may run
   outside the app's main runtime, so **module-level globals work in dev and silently do nothing
   in production**.
6. **The `i18n` config block is Pages-Router-only** — there is no such reference page under
   `app/`, proven by resolving the sitemap rather than assuming.
7. ⚠️ **No `viewTransition` config option exists in the current sitemap** — any page still teaching
   `experimental.viewTransition` is stale. **Handed to the currency lane.**

## 🔴 Verification wins worth copying

- Fork B proved the **absence** of an App Router route-matching precedence rule by grepping the
  full **3.9 MB `llms-full.txt`** in one fetch, then wrote it as *"the strong expectation and not a
  documented guarantee"*. **`llms-full.txt` is the tool for proving a negative.**
- Fork D refused to assert a version where the published version history prints a literal
  **`v16.x.x`** placeholder.

## ⚠️ STILL OWED — one reconciliation, deliberately not rushed

🔴 **`notFound()` was assigned to TWO forks because I put it in both page briefs.** Result: four
pages on adjacent ground —

| Page | Angle |
|---|---|
| `01f · not-found.tsx` | the file convention (fork A) |
| `01g · global-not-found.js` | the experimental global variant (fork A) |
| `04h · notFound()` | the function as a navigation mechanic (fork C) |
| `04i · not-found.js and the 404 status` | the boundary and streaming status (fork C) |

All four are sourced, badged, footered and in the chain — **nothing is broken**. But `01f` and
`04i` overlap on `not-found.tsx`. **Owed: read all four, give each a single distinct angle, and
make them link rather than restate.** Not a defect; an editing pass.

🔴 **The dispatch lesson, second time this session** (the first was telling fork B that Proxy was
Edge-constrained): **when fanning work out by PAGE, list the APIs each page owns, not just its
title.**

## ⚠️ Fork reports about OTHER forks' files were stale FOUR times out of four

Forks B, C and D each reported files over the 300-line cap in other lanes; every time, measuring
after they finished showed **0 over cap** — the owners had split them. Fork B also called page
`02` "still generated boilerplate" when it had been rewritten.

🔴 **A fork's observation of another fork's directory is a SNAPSHOT, not a finding. Re-measure
before acting.** The ch13 version of this ("the fork wrote NOTHING") nearly discarded 980 lines.

Likewise `07c` / `07d` looked like a duplication from the filenames and are not — `07c` is matcher
*syntax*, `07d` is what the matcher *skips*. **Deduplicating on filenames would have destroyed a
real page.**

## 🔴 The shared scratchpad is not safe storage for a fork

Fork D lost a staged split payload from `scratchpad/` mid-task and concluded "another live session"
was clearing it. **There was no other session** — the unfamiliar files were the coordinator's own
watcher scripts. **The scratchpad is shared by the coordinator and every fork.** Content lives in
the page file or the memory store, never only in `/tmp`.

## Found outside ch02 — NOT fixed

- **`10-instant-navigations/`** (a subtopic directory in this chapter's tree) overlaps page 06's
  brief with six chunks verified 2026-09-03. Fork D scoped around it and cross-linked. **A
  coordinator may want to decide whether it should be renumbered adjacent to 06.**
- **`_category_.json` uses a `generated-index` link** rather than pointing at `01-explanation.md`,
  so the sidebar's chapter entry does not open the index page. Track-wide shape, like the
  `"N. Label"` drift. Left alone.

## Track position after this chapter

**Eleven of nineteen chapters closed** (1, 2, 3, 4, 5, 6, 9, 11, 12, 13, 14, 16, 17, 19 — verify
off disk). Next unclaimed blocks: **ch07 (8)** · **ch08 (8)** · **ch15 (7)** · **ch10 (7)** ·
**ch18 (5)**.
