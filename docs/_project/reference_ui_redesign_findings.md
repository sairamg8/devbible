---
name: devbible-ui-redesign-findings
description: The measured evidence behind the 2026-09 docs navigation redesign — the four proposed architectures, the eight findings, the corpus and tier numbers, the Docusaurus sidebar DOM, and the full working of the three bugs it fixed. Open when re-deriving a number or touching src/theme/DocSidebar again; the parent has the state.
metadata:
  type: reference
---

# Docs navigation redesign — the findings behind it

> Split out of [[devbible-ui-redesign-workspace-rail]] on 2026-09-06 at the 300-line cap
> ([[devbible-memory-file-cap]]). The parent keeps current state, the resume handoff and the
> standing rules. **This file is the evidence** — open it to re-derive a number or before
> touching `src/theme/DocSidebar` again, not every session.

## The proposal

Four architectures, with live interactive mockups, published as an artifact and committed
to the repo at `.agents/design/nav-options.html`:
<https://claude.ai/code/artifact/91d0ee19-fc40-4668-a004-5716b8fd4c31>

| | Character | Verdict |
|---|---|---|
| A · Tuned Classic | an instrument panel | subsumed into B |
| **B · Workspace Rail** | see the whole building from any room | **CHOSEN**, then its rail reversed |
| C · Command First | a terminal (⌘K over all 6,797 titles) | the interesting outlier |
| D · Study Mode | a curriculum (tier becomes navigation) | deferred, separate decision |

**B = A plus a permanent left rail of all 31 technologies grouped by layer.** So the build
includes A's whole list: sidebar filter box, tier dots, page counts per category, three real
type levels by depth, and the collapse control unhidden.

⚠️ **C is the one worth revisiting.** It is the only option that gives back cross-technology
search, which the 94.7 MB single-index problem took away by necessity — and a titles-only
index (~400 KB for the whole corpus) sidesteps that entirely.

## The eight findings, all measured on the running site

1. **Stranded inside a technology.** `navbar.items: []` in `docusaurus.config.js` — the only
   route from Java to React is back to the homepage. ✅ **Fixed** by the navbar dropdown.
2. **A technology opens on furniture.** `/docs/java` shows Overview / Syllabus / Explanations.
   The 17 phases are one level further down. Two clicks before any content. **Open.**
3. **Tier is invisible in navigation.** 6,519 of 6,797 pages carry a `db-tier` badge and the
   sidebar reads none of it. **Open** — see the parent's frontmatter-migration finding.
4. **Collapse all / Expand all was painted behind the navbar.** ✅ **Fixed** — below.
5. **Every category at every depth is styled identically** —
   `.menu__list-item-collapsible .menu__link` is 0.72rem uppercase mono in `--db-ink-3`, the
   palest ink, applied to a top-level phase and a fourth-level chapter alike. All 17 Java
   phase labels wrap to two lines. **Open.**
6. **No sense of a category's size.** Java's Data access is 585 pages, Messaging is 1; both
   are one row of the same height with no number. **Open.**
7. **Six levels of nesting** (`python/pages/phase-1-language-core/12-eafp-vs-lbyl/05j-…/`) —
   by that depth a 300px sidebar leaves roughly 150px of label width. **Open.**
8. **Nothing remembers you were here.** No visited marks, no resume point, no scroll
   restoration, no per-technology collapse memory. **Open** — this is Option D.

## The corpus numbers these rest on

Measured 2026-09-05. ⚠️ These count **all `.md` including READMEs and syllabus**, which is a
different rule from the site's page count — see the counting rule below, and
[[devbible-corpus-audit-20260905]] for the audit's own baseline.

**6,797 pages · 1,047 categories · 31 technologies · nesting to 6 levels.**

Per technology (md, excluding `reviews/`): java 2240 · javascript 763 · nextjs 665 ·
python 460 · typescript 424 · postgresql 361 · react 338 · docker 271 · real-world 260 ·
nodejs 255 · expressjs 188 · css 102 · git 70 · storybook 54 · mongodb 53 · nginx 47 ·
jest-rtl 40 · eslint-oxlint 23 · webpack 23 · babel 18 · framer-motion 18 · playwright 18 ·
redux-toolkit 18 · tanstack-query 18 · vite 18 · frontend-architecture 17 ·
web-vitals-performance 13 · redis 12 · angular 9.

**Tier, counted by FIRST badge per page** (the rule in
[[devbible-feedback-count-by-first-tier-badge]]) — corpus: master 2833 · understand 2768 ·
know 734 · when 179 · no badge 289. Java sums exactly: 831 + 1008 + 244 + 97 + 60 = 2240.

Java per phase (pages / of which master): 00 platform 20/9 · 01 language core 42/35 ·
02 classes 42/36 · 03 generics 32/21 · 04 lambdas 28/20 · 05 exceptions 21/17 ·
06 concurrency 46/22 · 07 io-time 21/10 · 08 build 53/11 · 09 spring boot 209/71 ·
10 data access 585/182 · 11 testing 496/176 · 12 jvm production 372/30 · 13 oauth2 100/80 ·
14 microservices 164/112 · 15 messaging 1/1 · 16 resilience 1/1.

## The desktop sidebar DOM (expensive to re-derive — Docusaurus 3.10.2)

```
aside.theme-doc-sidebar-container          h = full page
└ div.sidebarViewport                      position: sticky; top: 0; height: 100vh
  └ div.wrapper            ← src/theme/DocSidebar/index.js
    ├ div.tools            ← SidebarCollapseAll
    └ div.sidebar_<hash>   ← theme; carried padding-top: var(--ifm-navbar-height)
      ├ nav.menu.thin-scrollbar
      └ button (hide sidebar)
```

Below 997px the aside is hidden and the menu renders inside
`div.navbar-sidebar` (`position: fixed`) instead. Anything measured while that drawer is
open is measuring the wrong tree — reload at desktop width first. Sidebar width is 300px.

## Finding 4 — what it actually was (fixed, commit `448fa0bf`)

`.sidebarViewport` is `position: sticky; top: 0`, so it begins at the very top of the
viewport, **under the 60px fixed navbar**. The theme clears that with
`padding-top: var(--ifm-navbar-height)` on *its own inner sidebar div* — which works only
while that div is genuinely first in the column.

The swizzled control bar broke the assumption. Measured: the bar occupied **y = 0–38**,
entirely behind the navbar, and the theme's padding then started the menu at y = 98 instead
of 60. The buttons were in the DOM, focusable and keyboard-reachable, and invisible.

🔴 **The feature was never broken.** Clicking Expand all takes Java's sidebar from **36
rendered links to 2,186**. Nobody could reach the button to find out. Two months of it
looking like a missing feature was a 4-line CSS placement bug.

The fix moves the clearance to the wrapper (the element that IS first) and zeroes the
theme's. The control also gets its own `tools` element: selecting the sidebar with
`:last-child` was the other half — on mobile `DocSidebar` renders nothing into this aside,
the bar becomes the last child, and `flex: 1 1 auto` stretched a 38px bar to the full 900px
of the sticky viewport. Padding is `min-width: 997px` only; below that the aside is hidden
and the sidebar renders into the navbar drawer.

## 🔴 The "page count" was a UNIT MISMATCH, not drift — resolved in `c6d0620d`

I first reported this as `progress.js` having drifted. **That was wrong and the correction
matters**, because it changes what the right fix is.

`pages` in `progress.js` is **not a file count and never was**. It counts *topics whose
explanation is written*. The tell is that phases read `topics: 13, pages: 13` — identical
numbers — while `docs/java/pages/phase-4-lambdas-streams/` holds 28 files. The 300-line file
cap means one topic routinely becomes eight files, so the two diverge **by design**.

It matters because `pages` drives the completion model: `phaseStatus`, `topicsDone` and the
percentage all read it. **Swapping it for a disk count would have silently moved every
percentage on the homepage** and flipped phase statuses — a phase with `pagesPlanned: 15`
and 585 real files would read "585 of ~15 pages" and contribute >100% of its topics.

The real bug was narrower: that number was being *printed* as "187 pages" on a card for a
track with 2,095. Corpus-wide, 2,831 declared against 5,875 real.

**The fix separates the two measures instead of merging them.**

- `pages` keeps driving the model, untouched. No percentage moved.
- Every **displayed** page count comes from `src/data/page-counts.json`, generated by
  `scripts/page-counts.mjs` and wired into `start` / `build` / `build:fast`, plus
  `yarn page-counts --check` for CI.
- `summarise()` returns `pagesWritten` from disk and adds `topicsCovered` (the old sum) so
  the gap stays visible; every phase gains `files`.
- Homepage cards, the `Progress` block and the navbar dropdown all read that one number.

Measured change on the homepage: JavaScript 282 → 526, TypeScript 136 → 347, React 214 →
277, Java 187 → 2,095, CSS 74 → 80. Percentages unchanged.

🔴 **The count was wrong by 59 until `0ebfda49`, and the corpus audit caught it.**
[[devbible-corpus-audit-20260905]] measured **5,816** leaf content pages independently; this
generator reported **5,875**. Two measurements of one quantity — the exact failure the
generator exists to prevent. The audit was right: the 59 are `_plan.md` and `_PHASE-NOTES.md`
working files under Java phases 11 and 14, and `docusaurus.config.js` already excludes
`**/_*.{js,jsx,ts,tsx,md,mdx}` and `**/_*/**`, so they are never routes. The generator was
walking straight past that rule.

**Counting rule** — a leaf `.md` under `docs/<track>/pages/`, excluding `README.md`
(category furniture), `reviews/`, `syllabus/` and **anything whose name starts with `_`**.
The site, the corpus audit and the currency scan now share this one definition; a fourth is
how the site ends up quoting two totals again.

**The join** — per-phase counts key on the directory name, which is exactly the `slug` in
`progress.js`. 347 of 407 phases match; every miss is a phase at `pages: 0` with no
directory yet. **Storybook is the one real mismatch** — its imported chapters are named
`01-core-concepts`, not `phase-4-documentation` — so its per-phase figures read 0 while its
track total stays right, because the total is measured on the whole `pages/` tree rather
than summed from phases.

⚠️ **No timestamp in the JSON, on purpose.** It would churn on every run and conflict
between the sessions sharing this checkout, for information git history already carries.

## The collapsed sidebar left a strip of sliced-off names — fixed in `c6d0620d`

Reported by the user from the preview: collapsing the sidebar left *"half UI screen
visible"* when it should leave only a toggle.

The theme collapses by shrinking the aside to `--doc-sidebar-hidden-width` (30px) with
`clip-path: inset(0)`, and **separately** sets `opacity: 0; visibility: hidden` on *its own*
inner sidebar div — which is only the page tree. The rail was not that div, so it held its
full 168px, got clipped to 30, and showed a column of first-few-letters down the left edge.

🔴 **`isHidden` is a real prop on `DocSidebar`**, passed from `DocRoot/Layout/Sidebar`, and
`ExpandButton` is a **sibling** of `DocSidebar` rather than a child. So the whole shell can
take the theme's own hide treatment and the toggle still survives. **This still applies** —
the rail is gone but the collapse/expand control bar is not, and it would show the same
sliver without `isHidden`.

⚠️ The width transition is slow enough to measure mid-flight — an aside read 365px three
seconds after the click and 30px shortly after. Do not conclude "stuck" from one
measurement; re-measure before diagnosing.

## The original resume plan — SUPERSEDED, kept for the reasoning

Steps 1 and 2 below were built and then step 2 was **reversed** by the user's verdict on the
rail. `stack.js` (step 1) survives and is what the dropdown reads. Steps 3 and 4 are the
work that is still open, restated in *What is left to build* in the parent.

1. ~~**`src/data/stack.js`** — lift `LAYERS` out of `src/pages/index.js`~~ — DONE, kept.
2. ~~**The rail inside the existing `DocSidebar` swizzle**~~ — built, then removed.
3. Tier map + tier dots, page counts per category, the filter box, the three type levels.
4. Breakpoints at 996 / 1280 / 1600.

⚠️ The old warning *"do not edit `docusaurus.config.js`, the concurrent main session is
scoping search there"* is **spent** — that session's work is in `main`, the dropdown's one
line is in the config, and there is no worktree contending for it any more.
