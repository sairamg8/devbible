---
name: devbible-react-phase2
description: React Phase 2 (Components, props and composition) — COMPLETE, the first fully doc-validated phase, and the resume point for Phase 3
metadata:
  type: project
---

**Updated after every completed page and at phase end** ([[devbible-memory-update-cadence]]).
Syllabus: [[devbible-react-syllabus]]. Phase 0: [[devbible-react-phase0]].
Phase 1: [[devbible-react-phase1]]. Validation: [[devbible-react-validation-status]].

## Status — COMPLETE

**Phase 2 is written, build-verified and committed as `c462cc8` on `main`.**
16 topics → **29 content files + 1 phase README**, `docs/react/pages/phase-2-components/`.

🔴 **Next: React Phase 3 — State and the render cycle (17 topics), no sandbox.**
The syllabus calls it "the phase that decides whether React makes sense to you"; 8 of its
17 topics are Master tier, so expect most of them to chunk.

**Not in a worktree.** Phase 1 was; this phase was written directly on `main`. The
`react-phases` worktree and its branch still exist and are still `locked`
([[devbible-react-phase1]]) — do not resume there, it predates this commit.

## The six chunked topics

Six of sixteen ran past the 300-line cap and became topic directories. **Nothing was
trimmed to fit** — this is rule 1 working as intended.

| Topic | Chunks | Split at |
|---|---|---|
| 01 Function components | 2 | definition ↔ identity and reconciliation |
| **02 Purity** | **3** | the rules ↔ what they still allow ↔ enforcement |
| 03 Composition | 2 | the problem ↔ the three concrete patterns |
| 04 Controlled vs uncontrolled | 2 | design ↔ the switch warning and dual-mode |
| 05 Lifting state up | 2 | procedure ↔ cost |
| 14 Class components | 2 | anatomy and `this` ↔ lifecycle and hooks |

⚠️ **Purity needed a re-split after it was written.** Chunk 01 came out at **305 lines**,
five over. The fix was a third chunk on a real concept boundary ("what purity still
allows" — local mutation, where side effects belong, the three tiers of consequence), not
a trim. Each chunk got its own gotchas and interview questions. Line spread across the
phase is **221–288**, longest file 288.

🔴 **The Edit that split it left the old tail in place** — replacing a section heading only
replaces the heading, not the section. The file silently became 393 lines with duplicated
content. Caught by re-running `wc -l`, fixed with `head -248`. **Always re-check line
counts after an in-place split.**

## Per-topic table

| # | Topic | Tier | Files |
|---|---|---|---|
| 01 | Function components | Master | dir, 2 chunks |
| 02 | Purity | Master | dir, **3** chunks |
| 03 | Composition over configuration | Master | dir, 2 chunks |
| 04 | Controlled vs uncontrolled | Master | dir, 2 chunks |
| 05 | Lifting state up | Master | dir, 2 chunks |
| 06 | Props are read-only | Understand | 1 |
| 07 | Destructuring and default values | Understand | 1 |
| 08 | Children patterns | Understand | 1 |
| 09 | `ref` as a prop (React 19) | Understand | 1 |
| 10 | Component boundaries | Understand | 1 |
| 11 | Portals | Understand | 1 |
| 12 | Render props | Know | 1 |
| 13 | Higher-order components | Know | 1 |
| 14 | Class components | Know | dir, 2 chunks |
| 15 | `Component` vs `PureComponent` | Know | 1 |
| 16 | `cloneElement`, `Children`, `isValidElement` | Know | 1 |

## Validation — no sandbox, and it worked

First phase written entirely under **rule 8**. No `react-p2`, **no console block on any
page**, every `> Verified:` line naming documentation pages and the date. The full source
list and the two flagged-as-uncertain claims are in
[[devbible-react-validation-status]].

**This is the shape Phases 3–14 should copy.** It cost far less time than Phase 1's
sandbox and the pages are not visibly weaker — the depth came from explaining mechanism
rather than from printing output.

## Findings worth reusing

- **`propTypes` was removed *silently* in React 19** — the upgrade guide's own words are
  that using it "will be silently ignored". An upgrade deletes every runtime prop check
  with no warning. `defaultProps` is gone for function components but **deliberately kept
  for classes**, "since there is no ES6 alternative".
- **`forwardRef` is NOT removed in React 19.** It is documented as unnecessary and carries
  a "will be deprecated in a future release" notice. Commonly overstated as removed; the
  page states the real status.
- **`shouldComponentUpdate` returning `false` is a hint React may ignore** — stated
  outright in the docs, and it applies to `memo` equally. Memoization is never a
  correctness mechanism.
- **The nesting rule is really reconciliation-by-type.** HOC applied in render, `lazy()`
  in render and `memo()` in render are the same bug wearing different clothes. Worth
  carrying into Phase 6.
- **`Children.count` does not traverse fragments**, so `<><A/><B/></>` counts as one
  child. That is why positional slot-slicing cannot be made safe.

## Build

`rm -rf .docusaurus node_modules/.cache && yarn build --out-dir build-react-p2`.
**30 HTML routes** under `phase-2-components/`, **zero React warnings, zero MDX
failures**. The 23 remaining broken-link warnings are pre-existing forward references in
PostgreSQL phase-13, JavaScript phase-3 and TypeScript phase-2 — **none in React**.

🔴 **The first build attempt failed outright** (`EXIT=1`) and it was **not my work**: a
parallel session was mid-re-split of `javascript/…/08-hoisting-and-tdz/`, and both
`02-the-temporal-dead-zone.md` and `03-the-temporal-dead-zone.md` existed at once →
*"The docs plugin found docs sharing the same id"*. It cleared on its own a few minutes
later when that session finished. **A duplicate doc id is a hard build failure, unlike
broken links** — and in a shared checkout it can be someone else's transient state. Wait
and retry before investigating.

**Link checking without a build:** a 20-line Python walk that resolves every
`](…​.md)` against the filesystem found the one real break (a forward ref to unwritten
Phase 5) in seconds, and confirmed **zero slug-form links**. Faster than a 10-minute
rebuild and it works while the site is unbuildable. Worth reusing — see
[[devbible-postgresql-repo-and-build]] for why `fixlinks.py` cannot do this job.

## READMEs updated (the user asked for this explicitly)

- `docs/react/pages/phase-2-components/README.md` — new phase index: topic table, coverage
  with the chunk table, the source list, three findings, the gate.
- `docs/react/pages/README.md` — phase 2 row → ✅ Written, **and the "every console block
  came from a script" paragraph rewritten** to say Phases 0–1 are measured while Phase 2
  onward is documentation-validated with no console blocks.
- `docs/react/pages/phase-1-jsx/README.md` and its last page — forward links into Phase 2.
- `src/data/progress.js` — react phase 2 `pages: 0` → `16`.

## Traps for the next session

- **Never `git add -A` here.** Two other sessions were writing during this one
  (PostgreSQL phase-13 chunking, JavaScript phase-3 topic 08). Stage explicit paths only.
- **`yarn build` exits 0 with broken links** — grep the log, strip ANSI first. But a
  **duplicate doc id exits 1**, so a non-zero exit is worth reading before assuming it is
  yours.
- **Re-run `wc -l` after any in-place chunk split.** See the Edit trap above.
- Phase 1's README lacks a `_category_.json` (phase 0 and phase 2 have one). Harmless,
  left alone as out of scope.
