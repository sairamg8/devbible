---
name: prompt-javascript-lane-b
description: Paste this into the new session
metadata:
  type: reference
---

# Paste this into the new session

Work **devbible JavaScript, lane B** — and nothing else. Do not ask whether to continue between
topics; run it to completion.

## First, read these three, in order

1. `~/.claude/CLAUDE.md` — **rule 11 §11b** (the two-lane split) and **§11b-scope** (what was cut).
   This auto-loads, so it is already in your context.
2. `/mnt/Storage/my-learning/claude/devbible/progress_javascript_lane_b.md` — **your brief.**
3. `/mnt/Storage/my-learning/claude/devbible/progress_javascript_build.md` — lane A's file, for
   the shared rules and the traps that have already cost time. **Read it; do not write to it.**

## Your lane

Phases **9, 10, 11, 12, 17, 18** in `docs/javascript/pages/`. **75 topics left.**

**Start at phase 9 topic 07 · Traversal.** Finish a phase, then take the next in that order.
Inside a phase: **Understand → Know → When Needed**.

| Phase | From | Left |
|---|
:::danger SUPERSEDED 2026-08-15 — JavaScript is now FOUR chunks, A B C D
The two-lane split this file describes is **closed**, and its letters are **dead**
("lane A = phases 3–8", "lane B = phases 9–12, 17, 18" mean nothing now). The live cursor is
[[devbible-javascript-split-4way]] — **A** phases 5+11 · **B** 6+17 · **C** 7+8 · **D** 12+18.
Read this file for traps, concepts and history only, never for "which phases are mine".
:::

---|---|
| 9 · The DOM | topic 07 | 13 |
| 10 · Events and user input | 05 | 10 |
| 11 · Network, storage and data transfer | 06 | 16 |
| 12 · The browser platform | 03 | 19 |
| 17 · Machine coding | 05 | 14 |
| 18 · Storefront | **only 11, 12, 15** | 3 |

⛔ **Phases 3, 4, 5, 6, 7 and 8 belong to lane A — never write in them.** Not to fix a link, not
to correct a count. Lane A is running right now in another session.

⛔ **Phases 13, 14, 15 are parked and 16 is dropped.** They are in neither lane. Leave them.

## The rules that are not negotiable

- **Tier lock: Understand and Know only.** The Master tier is complete at 99/99 across every
  phase. **Never reopen a Master topic to deepen it** — the remaining work is breadth.
- **300 lines per file is a FILE-SIZE rule, never a content budget.** Write the explanation the
  topic deserves *first*, then split on a concept boundary into `NN-topic/` with a
  `_category_.json`, a `README.md` index and numbered chunks. Never trim a section, a gotcha or
  an interview answer to fit. A run of pages all landing just under 300 is the tell you got this
  wrong.
- **No sandboxes, no timings, no invented output.** Validate against MDN and the spec, and name
  the sources in the page's `> Verified:` line. **No run means no console block** — never
  reconstruct one from memory. Where a measured fact already exists on a written page, **link to
  that page instead of restating its output**.
- **Links always end in `.md` and keep every numeric prefix** — `../09-forms/README.md`,
  `../09-forms/02-validation.md`. Never a bare directory slug.
- ⛔ **No cross-lane links.** A link to one of lane A's unwritten topics breaks the build. Write
  the reference as **bold plain text with *(not written yet)***.

## Cadence — after every single file

1. Write the file.
2. Update the boards: the phase `README.md` topic row and status, `src/data/progress.js` (**your
   phases' rows only**), the claim notice in `docs/javascript/pages/README.md` (**the lane B
   block**), and the **lane B row** in `docs/README.md`.
3. Clean rebuild and grep — a green build proves nothing:
   ```bash
   rm -rf .docusaurus build node_modules/.cache && yarn build 2>&1 | grep -iE 'warning|broken'
   ```
   Broken links under `docs/git/` or `docs/typescript/` are **other sessions'** — leave them.
   Tally before reacting:
   ```bash
   yarn build 2>&1 | grep "source page path" | sed 's#.*/devbible/docs/##' | cut -d/ -f1 | sort | uniq -c
   ```
4. Check the cap: `find docs/javascript -name '*.md' -exec wc -l {} + | awk '$1>300 && $2!="total"'`
5. Commit with **explicit paths — never `git add -A`.** Several sessions write to this checkout;
   expect lane A's rows in your `git diff` and leave them.
6. Update and commit `progress_javascript_lane_b.md` in the memory store, and record the topic's
   load-bearing claims in a `reference_javascript_concepts_phase<N>.md`.

## The page shape to match

Read `docs/javascript/pages/phase-3-functions/12-composition.md`, `13-memoization.md`,
`14-recursion.md`, `15-pure-functions.md` and `16-no-function-overloading.md` — the five most
recent lane-A pages. Understand-tier topics land at **~220–280 lines, single file**:

front matter · tier badge · `> Verified:` line naming the MDN pages · prose sections that lead
with the one thing that matters · **Gotchas** written **symptom → cause → fix** ·
**Interview questions** with ★ on the ones that actually get asked · a
`← prev · [Phase index] · next →` footer.

## Before you write anything

Claim lane B: put your session id in the lane table in `docs/javascript/pages/README.md` and in
the **lane B row** of `docs/README.md`.
