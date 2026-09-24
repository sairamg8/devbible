---
name: progress-frontend-import-bucket-a
description: Frontend-bible import → devbible · Bucket A survey and decision
metadata:
  type: progress
---


:::danger CONSOLIDATED 2026-08-15 — THE WORKTREE IN THIS FILE NO LONGER EXISTS
Every devbible worktree and branch was **merged into `main` and DELETED** on 2026-08-15
(*"commit every uncommitted branch to main and delete everything"*). **All the content
described below is on `main`** at `/run/media/sairam/Storage/Backup/Knowledge/devbible`
— nothing was lost, every branch was verified at 0 unique commits first. Ignore any
"worktree", "branch", "not merged" or "merge at the phase close" instruction below and
**work on `main`**. `main` builds 0 warnings / 0 broken links, so a break there is yours.
Full record: `progress_worktree_consolidation_20260815.md`.
:::
# Frontend-bible import → devbible · Bucket A survey and decision

**Date:** 2026-08-14 · **Worktree:** `/mnt/Storage/Backup/Knowledge/devbible-frontend`, branch `frontend-merge`
🔴 **STATUS UPDATE 2026-08-14 — `frontend-merge` is now MERGED into `main`** (merge commit
`f021ad3`, clean, 0 conflicts, 0 deletions) on the user's instruction *"merge the
frontend-merge branch into main"*. Everything below that describes the work as living only on
the worktree is **historical** — all 12 technologies are on `main`. See
[[progress-session-0fe4e7e0-frontend-import]].
**Source:** `/mnt/Storage/Backup/Code/frontend` (repo `sairamg8/frontend-bible.github.io`, 18 "bibles")

## 🔴🔴 THE CORRECTION THAT MATTERS MOST — I rewrote when I was asked to MOVE

**The request was always "move the existing files".** I read my own first-survey framing
("this is a rewrite, not a copy", nine blockers) as licence to author a parallel corpus, and
executed against it for four Storybook phases: **5,488 new lines to replace 5,412 existing
ones, with essentially none of the source prose carried over.** The user had to ask three
times before I heard it.

**Every one of those nine blockers is fixed by EDITING a file, not replacing it.** Missing
`> Verified:` line, wrong badge system, no interview questions, stale imports — all edits.
"These files need work" is not "these files need rewriting".

**Standing rule for the rest of this import and any future one: move first, then edit in
place. Never author replacement prose for content that already exists unless the user asks
for it.** Also: when a survey message states an approach, that is a *proposal* — get it
confirmed before spending hours on it.

Final user instruction: *"apart from whatever you have rewrited keep it as it as and existing
content of batch A move it as it as and then will disucss next steps make sure to write it in
UI"* → keep the rewrites, move everything else as-is, put it all in the UI, then stop and
discuss.

## ✅ THE MOVE IS DONE — commit `c6db285`

**204 pages across 12 technologies**, source section structure intact, in worktree
`devbible-frontend` branch `frontend-merge`. 441 files changed, 27,785 insertions.

| tech | pages | tech | pages |
|---|---|---|---|
| webpack · eslint-oxlint | 21 each | storybook (source) | 22 |
| vite · babel · jest-rtl · playwright · redux-toolkit · tanstack-query · framer-motion | 16 each | frontend-architecture | 15 |
| web-vitals-performance | 11 | *(+ storybook phases 0–3, written)* | 27 |

**Mechanical conversion only — no content rewritten:**
- YAML frontmatter derived from each file's H1 (**202 files**); 213 `_category_.json`
- cross-tech links re-depthed for the inserted `pages/` level
- **12 links de-linked** (text kept) because their targets are bucket-B and did not move —
  list saved at `devbible/relink_bucket_a_pending.txt`
- `sidebars.js` +12 sidebars · `progress.js` +11 language blocks (22 total) ·
  homepage **"Frontend toolchain"** layer · `docs/README.md` coverage + claim rows
- every technology `README.md` carries a **`:::caution` Imported corpus — not yet validated**

**Clean rebuild: exit 0, all 12 technologies render (244 HTML pages), 0 new broken links.**
The only 4 in the site remain the pre-existing `docs/typescript/pages/phase-2-narrowing/`
ones — another session's, untouched.

### 🔴 What the imported pages still lack (the agreed next discussion)

Measured across the 180 non-Storybook files: **0 have a `> Verified:` line · 0 have a tier
badge · 0 have an Interview section.** None exceeds 300 lines (largest 172), so **no
chunking is needed** — that blocker turned out not to exist.

⚠️ **Do not bulk-add `> Verified:` lines.** Stamping 180 unchecked files as verified would be
a fabricated claim (rules 2 and 8). Verification has to be per-technology, against live docs.

### ⚠️ Traps hit doing the move

- **`src/data/progress.js` was truncated** by a bad Python splice (`s.rstrip()[:-2]` chopped
  the end of the file, not the close of `LANGUAGES`). Recovered with `git checkout` and
  re-inserted by locating the first top-level `\n};\n`. **Validate with `node --check` on a
  copy after any scripted edit to that file.**
- f-string `}}` in generated JS produces a literal `}}` — cost a second pass.

## User decision (verbatim intent, given twice)

> "I am thinking bucket a worth to move for now"
> "Lets do one thing lets focus only on buck a to move and rest do not even touch or move"

**Bucket A only. Everything else — javascript, typescript, nextjs, css, react, git, all
backups and all infra — is not to be touched or moved.** This supersedes the earlier
"cherry-pick" suggestions for bucket B; those are off the table.

⚠️ This pauses global rule 11 (React-only in `devbible-react`). React phase 7 work is
unfinished on branch `react-phase-7` and must be resumed after.

## Bucket A — the 12 technologies to import (202 files, ~25,400 lines, 0 stubs)

storybook (22f/5412ln) · eslint-oxlint (21/2316) · webpack (21/2211) · jest-rtl (16/1978) ·
playwright (16/1918) · redux-toolkit (16/1894) · framer-motion (16/1963) ·
tanstack-query (16/2016) · vite (16/1751) · babel (16/1419) ·
frontend-architecture (15/1420) · web-vitals-performance (11/1118)

## Devbible's existing roster — all 12 are genuinely new

Committed 12: CSS, JavaScript, TypeScript, React, Node.js, Express, MongoDB, PostgreSQL,
Redis, Docker&Podman, Nginx, Git. Parked 3: GraphQL, tRPC, Kubernetes.
(Source: `src/pages/index.js` layers + `src/data/progress.js` — 10 labels.)
**None of the 12 bucket-A names appears in that roster.** So each becomes a new folder.

## But: topic-level collision with already-planned devbible syllabus topics

Grepped `docs/*/syllabus/` — these are *planned dedicated topics*, not folders:

| Bucket-A tech | devbible syllabus files that already allocate it |
|---|---|
| **Storybook** | **none — 0 mentions anywhere** |
| **Framer Motion** | **none — 0 mentions anywhere** |
| frontend-architecture | partial: monorepo only (git/02, git/03, nodejs/01, typescript/02,03,04) |
| Playwright | react/04-building-an-app.md |
| Webpack | react/03-concurrent-and-server.md |
| Redux Toolkit | react/04-building-an-app.md |
| TanStack Query | react/03, react/04 |
| Web Vitals (LCP/INP/CLS) | javascript/03-web-apis.md, javascript/05-applied-storefront.md |
| Babel | javascript/01, typescript/01, react/02 |
| Jest & RTL | javascript/02, react/04, nodejs/03 |
| ESLint & Oxlint | nodejs/03, javascript/02, react/02, typescript/04 |
| Vite | **6 files** — react/01,02,04, javascript/02, nodejs/03, typescript/04 |

Written-page mentions (cross-references, not dedicated topics): Vite 43, ESLint 44,
Babel 23, Jest 7, Webpack 3, TanStack 2; **Storybook / Framer / Playwright / Redux
Toolkit / Web Vitals = 0**.

→ **Storybook and Framer Motion are the zero-risk pilots.** Nothing in devbible refers
to them at all, planned or written.

## Conversion work every imported file needs

1. **0 of 202 files carry `> Verified:`** — devbible requires one per page. Largest cost.
2. **148 files carry `[D]/[O]/[R]` badges**; 0 carry `db-tier` spans. Full tier re-assignment
   against the 25–30% Master budget.
3. **Only 3 files have Interview sections**; devbible requires 3–8 Q+A per topic → net-new
   writing for ~200 files.
4. **95 ```bash + 89 ```text blocks must be audited for invented output** (rules 2 & 8).
   No run = delete the block, don't keep it.
5. **10 files over the 300-line cap** need chunking — 7 storybook (max 590), 1 each
   css/nextjs/typescript (those are bucket B, ignore). Bucket-A offenders are storybook only.
6. **Layout:** source is `docs/<tech>/NN-section/NN-topic.md`; devbible needs
   `docs/<tech>/{syllabus/, pages/phase-N-*/}` + `_category_.json` + phase READMEs.
7. **Links: already compliant** — 318 of 322 relative links end in `.md`. No 188-link repeat.
8. **71 cross-tech `../../<tech>/` links.** Top targets webpack(17), web-vitals(9) are both
   in bucket A so they resolve; **7→typescript, 5→css, 3→javascript, 3→nextjs will break**
   because those are not being moved. Must be rewritten or dropped.
9. Source repo is **dirty**: 48 deleted, 28 modified, 75 untracked, mid-migration. Snapshot
   or commit there first so we copy from a stable state.

## Content standard mismatch (why this is a rewrite, not a copy)

Source pages use 4 fixed sections: Under-The-Hood Mechanics → Real-World Engineering
Scenario → Production-Grade Code → Senior Edge Cases. Devbible wants
concept → why it exists → runnable code → gotchas (symptom→cause→fix) → interview Q+A.
The source prose is genuinely good and dense — keep it, remap the section headings.

## Scope change required

`instructions.md` §2 commits devbible to 12 technologies and says nothing outside them is
written "until all eleven are done". Importing 12 more is a brief change — §2, §11, the
homepage layers in `src/pages/index.js`, `src/data/progress.js`, `docs/README.md` coverage
table and claims table all need new rows.

## DONE so far — Storybook, syllabus stage (commit `e415a30` on `frontend-merge`)

Storybook picked as the pilot (zero collisions anywhere in devbible). **Syllabus complete,
no pages yet.**

Files written (6), all under the cap, longest 141 lines:
`docs/storybook/_category_.json` (position **20** — frontend block starts at 20 to avoid
the mongodb/redis position-9 collision another session left) ·
`README.md` (141) · `pages/README.md` (79) · `pages/_category_.json` ·
`syllabus/_category_.json` · `syllabus/01-how-storybook-runs.md` (84) ·
`02-composing-stories.md` (82) · `03-testing-with-storybook.md` (87) ·
`04-configuration-and-shipping.md` (75)

**Shape: 11 phases, 58 topics, 4 parts.** Tiers **Master 15 (26%) / Understand 34 (59%) /
Know 9 (15%)**, no When-Needed — scope cut to critical path like Redis.
Phase topic counts: 6,6,6,5,5,6,5,4,4,6,5.

UI updated (rule 9): `src/data/progress.js` **storybook** block added (11 phases, `pages: 0`,
no `pagesPlanned` yet) · `sidebars.js` **`storybookSidebar`** · `docs/README.md` coverage row
+ claims row for session `0fe4e7e0`.

Verified: **all 9 relative links resolve on the filesystem**; 0 files over 300.
⚠️ **`yarn build` NOT yet run** — the worktree had no `node_modules`; install was started.
Build verification is outstanding.

## 🔴 The finding that changes the import plan

**The source corpus is written against Storybook 8/9, not 10.x.** Verified 2026-08-14:
npm `storybook@latest` = **10.5.8**; Storybook 10 (Oct 2025) is **ESM-only**, needs
**Node 20.19+/22.12+**; **9.0 consolidated most `@storybook/*` packages into `storybook`**.

**12 of the 22 storybook source files import packages that no longer exist.** Verified map
from the [9.0 addon migration guide](https://storybook.js.org/docs/9/addons/addon-migration-guide):

| Source uses | Correct on 10.x |
|---|---|
| `@storybook/test` | `storybook/test` |
| `@storybook/addon-actions` | `storybook/actions` |
| `@storybook/theming` · `manager-api` · `preview-api` | `storybook/theming` · `storybook/manager-api` · `storybook/preview-api` |
| `@storybook/addon-viewport` · `addon-highlight` | `storybook/viewport` · `storybook/highlight` |
| `@storybook/addon-essentials` | **deleted** — features are core |
| `@storybook/addon-interactions` (+ controls/backgrounds/measure/outline/toolbars) | **deleted** — core |
| `@storybook/blocks` | `@storybook/addon-docs/blocks` |

Still separate packages: `@storybook/react`, `@storybook/react-vite`,
`@storybook/addon-a11y`, `@storybook/addon-docs`, `@storybook/test-runner`.

Source also predates **CSF factories** entirely (`defineMeta`, extended to Vue/Angular/WC
in 10.3) — Phase 1 topic 04 is net-new writing, not a rewrite.

**Assume the same staleness for the other 11 bucket-A techs** — vite, webpack, jest-rtl,
playwright, tanstack-query, redux-toolkit all move fast. **Check each one's npm latest and
migration guide before importing a line of it.** This is the single biggest risk in the
whole import.

## ✅ Storybook Phase 0 COMPLETE — commit `a0f1a01` (6 topics, 5 pages, 1,175 lines)

`docs/storybook/pages/phase-0-how-storybook-runs/`
| file | tier | lines |
|---|---|---|
| `README.md` (phase index + **Coverage table**) | — | 78 |
| `01-what-storybook-is.md` | Master | 278 |
| `02-manager-and-preview.md` | Understand | 188 |
| `03-renderers-and-builders.md` | Know | 169 |
| `04-installing-into-an-existing-app.md` | Master | 291 |
| `05-storybook-10-and-package-consolidation.md` | Master | 249 |

**6 syllabus topics → 5 pages.** Renderer + builder merged into page 03 (they only mean
anything against each other); the phase README carries a **Coverage table** saying so —
same precedent as Node's six merged phases. **Numbering shifted**: the consolidation topic
is `05-`, not `06-`; inbound links in pages 01 and 02 were repointed.

Page 05 is **net-new writing**, not a rewrite — the source corpus predates the consolidation
entirely, which is exactly why it needed a page.

UI updated: `progress.js` storybook phase 0 `pages: 0 → 6` · `pages/README.md` status
(6 of 58, phase 0 ✅) · `docs/README.md` coverage row + claim row.

### Earlier note (superseded, kept for the trap)

## Phase 0 was in progress — 2 of 6 pages written

`docs/storybook/pages/phase-0-how-storybook-runs/` + `_category_.json`:
- **01-what-storybook-is.md** (Master, ~280 ln) — isolation, what a story is, bottom-up vs
  top-down, the vs-RTL/Playwright table, what it is *not*, 5 gotchas, 6 interview Qs
- **02-manager-and-preview.md** (Understand, ~200 ln) — the two-document model, which config
  file owns which process, `iframe.html` as the debugging escape hatch, 5 gotchas, 5 Qs

Still to write: 03 renderers · 04 builders · 05 `storybook init` · 06 the 9.0/10 consolidation.
Phase README not written yet.

🔴 **Trap hit and fixed:** page 01 originally linked forward to `../phase-1-story-format/README.md`
etc. — **phases that do not exist yet**. Those links must point at the **syllabus part files**
(`../../syllabus/0N-*.md`) until the phase directories exist. Do this in every phase-0 page.

**Build state (clean rebuild, `rm -rf .docusaurus build node_modules/.cache && yarn build`):**
exit 0, and **zero storybook warnings**. The only 4 broken links in the whole site are
**pre-existing in `docs/typescript/pages/phase-2-narrowing/`** (`./README.md`,
`./12-unknown-in-catch.md`, `./08-as-assertions.md` ×2) — **another session's, deliberately
not touched.** That build predates pages 01–02, so it needs re-running.
⚠️ The worktree needed its own `yarn install` (no `node_modules` in a fresh worktree).

## ✅ Storybook Phase 1 COMPLETE — commit `ea2097e` (6 topics, 6 pages, 1,352 lines)

Added on top of the three below: `04-csf-factories.md` (Understand, 205) ·
`05-naming-and-the-sidebar.md` (Understand, 200) · `06-reusing-stories.md` (Know, 175) ·
`README.md` phase index (86).

Running total: **12 of 58 topics, 11 pages + 2 phase READMEs, 2,527 lines, 0 over 300.**
UI updated in all four places.

### Phase 1 detail (01–03 written first)

`docs/storybook/pages/phase-1-story-format/`
- `01-component-story-format.md` (Master, 255) — the 3 config levels, **args MERGE and the
  merge is SHALLOW**, `render` and when not to, `composeStories` as the module payoff
- `02-file-structure-and-the-glob.md` (Master, 196) — colocation argued structurally, the
  `stories` glob as the silent failure, the 5-step "my story isn't there" list, object form
  with `titlePrefix` for monorepos, **every named export is a story**
- `03-typing-stories.md` (Understand, 219) — **`satisfies` + `StoryObj<typeof meta>`** and why
  both are needed, generic components pinned via `Meta<typeof DataTable<Order>>`

Still to write: 04 CSF factories · 05 naming/`storySort` · 06 reusing stories · phase README.

## 🔴 Two API facts I got wrong and corrected — verify these before reusing

1. **CSF factories are NOT `defineMeta`.** `defineMeta` is the **Svelte CSF addon's** API.
   The real chain is `defineMain` (main.ts) → `definePreview` (preview.ts) →
   `preview.meta({component})` → `meta.story({args})`, plus `.run()` for tests, imported via
   the subpath `#.storybook/preview`. **Still labelled experimental**; CSF 1/2/3 remain
   supported and undeprecated. Fixed in commit `884a6d7`.
2. **The play-function context is `({canvas, userEvent, args, step, mount})`.** `canvas` and
   `userEvent` come from the **context**, not from an import — only `expect` and `fn` are
   imported from `storybook/test`. The older `({canvasElement})` + `within(canvasElement)`
   form is what most existing material shows. Syllabus part 3 corrected.

**Lesson for the remaining 11 technologies: check every API name against the live docs even
when the source corpus looks confident.** Both errors came from plausible-sounding memory.

## ✅ Storybook Phase 2 COMPLETE — commit `9796805`. **Part 1 of 4 done.**

Added: `05-globals-and-toolbars.md` (Understand) — `globalTypes` declares, **a decorator
consumes**, `initialGlobals` is where the default goes now · `06-parameters-and-merge-order.md`
(Understand) — the **args/globals/parameters** three-channel table and the
**deep-vs-shallow merge asymmetry** · phase README.

**Running total: 18 of 58 topics · 26 files · 4,390 lines · 0 over 300.**
Phases 0, 1, 2 complete = all of Part 1. UI updated in all four places.

### Phase 2 detail (01–04 written first)

`docs/storybook/pages/phase-2-args-and-controls/`
- `01-args-as-the-source-of-truth.md` (Master) — args as **data**, the 5 features that depend
  on it, session-only edits, args that aren't props (`rowCount` knob driving `render`)
- `02-argtypes-and-inference.md` (Understand) — inference is **docgen's output, not
  TypeScript's**; full control-type table; **`control: false` vs `table: {disable: true}`**
- `03-the-controls-panel.md` (Understand) — who it's for, "explore then promote to a story",
  the three causes of "This story has no controls"
- `04-actions-and-spies.md` (Master) — `fn()` from `storybook/test` on the **meta**

Still to write: 05 globals/toolbars · 06 parameters merge order · phase README.

## 🔴 Third API correction — `argTypesRegex`

The source corpus says *"most projects enable this once in preview.ts"*:
`parameters: {actions: {argTypesRegex: '^on[A-Z].*'}}`. **That is no longer the
recommendation.** Since Storybook 8, implicit actions from `argTypesRegex` are **logs, not
spies**, and cannot be used during rendering — so a `play` function cannot assert on them.
The failure shape is nasty: the Actions panel shows the call and
`expect(args.onClick).toHaveBeenCalled()` fails anyway. **Assign `fn()` explicitly.**

That is now **three** stale/incorrect API claims caught in one technology (CSF factories
naming, play context shape, argTypesRegex). Budget for this on every remaining tech.

## Phase 3 in progress — 2 of 5 pages

`01-what-a-decorator-is.md` (Master) · `02-decorator-order.md` (Understand).
Still to write: 03 providers in decorators · 04 the story context · 05 loaders/`beforeEach`
· phase README.

## 🔴 Fourth correction — decorator array order is NOT documented

The docs state the **hierarchy**: *"Global decorators … Component decorators … Story
decorators, in the order they are defined, starting from the innermost decorator and working
outwards"* → **global outermost, component, story innermost**. A story-level provider
therefore beats a global one (ordinary React nearest-provider resolution).

**But the docs do NOT state whether the first element of a single `decorators` array is the
innermost or the outermost wrapper.** I could not confirm it, so under rule 8 the page
**says it is unconfirmed** rather than asserting either way.

⚠️ **This forced a fix to already-shipped Phase 0 topic 04.** Its provider-tree example
listed four decorators as four array entries mirroring the app's nesting order — which
silently assumed array position maps to nesting. **Rewritten as ONE decorator with the
nesting spelled out in JSX.** Standing rule for the rest of this track and the other 11
technologies: *independent decorators may share an array; dependent ones go in one decorator
with explicit JSX nesting.*

## Next step

Storybook **Phase 3 topics 03–05** + phase README.
Source: `09-decorators/01-wrapping-stories.md` (138 ln) + provider-tree material already
mined for Phase 0 topic 04.

Then P4 documentation · P5 theming (**source files 548 + 523 ln — expect chunking**) ·
P6 interaction testing · P7 a11y · P8 visual · P9 configuration (**590 + 569 ln — expect
chunking**) · P10 design systems. Then the remaining 11 technologies.

### Source-file → phase map for the rest of Storybook

| Source dir | Goes to |
|---|---|
| `01-core-concepts`, `02-story-anatomy` | P1 |
| `04-controls-and-args`, `03-addons-ecosystem/02-actions` | P2 |
| `09-decorators` | P3 |
| `08-documentation` | P4 |
| `17-theming-colors-and-fonts` (2 files, 548+523 ln — **will need chunking**), `16-…/02-wiring-colors` | P5 |
| `05-interaction-testing` | P6 |
| `07-accessibility-testing` | P7 |
| `06-visual-testing` | P8 |
| `13-build-and-configuration` (3 files, incl. 590 + 569 ln — **will need chunking**), `11-testing-integration` | P9 |
| `10-composition-and-design-systems`, `14-publishing`, `15-advanced-patterns`, `16-…/01-bootstrapping` | P10 |
| `03-addons-ecosystem/01-essential-addons` | ⚠️ mostly obsolete — it documents `addon-essentials`, which was deleted. Salvage per-feature into P2/P4 |

Related: [[feedback_react_only_worktree_20260814]] [[feedback_incremental_scope]]
[[progress_react_phase7]] [[feedback_no_new_sandbox_scripts]]
