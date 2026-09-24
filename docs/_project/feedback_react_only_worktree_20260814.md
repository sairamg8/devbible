---
name: feedback-react-only-worktree-20260814
description: Standing instruction — React only, in a worktree (2026-08-14)
metadata:
  type: feedback
---

# Standing instruction — React only, in a worktree (2026-08-14)

Given to session `63fa2a80` on 2026-08-14, verbatim:

> *"Work on react js and nothing else possible create new worktree and work it make sure
> to remember as hard rule about line count but not content budget along with once you
> complete at least 2 or 3 files make sure and 100% update memory. Please save these
> instructions very hard"*

Four instructions, all standing until the user says otherwise.

🔴 **Where these live.** The user followed up the same day: *"Make sure the instructions
need to load automatically in every session so rather saving it in my-learning/claude
save it inside `~/.claude` with hard rules."* So the **binding copy is
`~/.claude/CLAUDE.md`** — rule 1 (the cap), rule 9 (the 2–3 file cadence) and **rule 11**
(React only, in a worktree). That file loads in every session, project and directory
without anyone choosing to open an index. **This file is the detail behind rule 11, not
the rule itself.** If the two ever disagree, `~/.claude/CLAUDE.md` wins.

## 1. React and nothing else

**Do not touch any other technology's docs.** Not to fix a broken link, not to correct a
stale count, not because another language looks idle and rule 9 says to pick one up.
**This instruction overrides the "pick up the next idle language" half of rule 9** for
this session — when React's current phase completes, the next React phase is the work.

Two counting mismatches are known and were deliberately **left unfixed** for exactly this
reason: CSS reads 64 topics in `progress.js` vs 74 in `docs/README.md`, and JavaScript
308 vs 337. See [[devbible-overall-snapshot]]. They belong to their owning sessions.

## 2. Work in a new worktree

The user asked for one explicitly, which is what makes it in scope under rule 6 (devbible
is not otherwise mine to restructure). It also matters because **the devbible checkout is
shared by several live sessions** — a worktree is the only way to write React without
racing another session's uncommitted files in the same tree.

⚠️ **The last worktree in this project became a trap.** See
[[devbible-javascript-phase3-worktree]]: JS phase 3 was written in a worktree, the
worktree was then left locked and pre-merge, and the real work continued on `main`
instead. A worktree that is never merged is worse than no worktree. Merge it, or say
plainly in the handoff memory that it is unmerged and where the work actually lives.

## 3. The line cap is a FILE-SIZE rule, never a content budget — hard

Now given **three times**. It is rule 1 in `~/.claude/CLAUDE.md` and rule 1 in this
store's `MEMORY.md`, both carrying a dated re-affirmation as of today.

- 300 lines caps one **file**. It says nothing about how much a **topic** is explained.
- A Master-tier React topic may run 1000+ lines in total. That is normal.
- **Write what the topic deserves first, then split** at a concept boundary into
  `NN-topic/` with `_category_.json`, `README.md` and `NN-chunk.md` parts.
- Never trim a section, drop a gotcha, or shorten an interview answer to save lines.
- **The tell you got it wrong:** a run of pages clustering at ~200–290 lines. Caught that
  way twice already in this project.

## 4. Every 2–3 files → update memory, 100%

**Files, not topics. The floor is two.** This tightens rule 9, which previously said
every three *topics* — a chunked React topic that produces three files now owes a memory
write before the topic itself is finished.

"100%" is the load-bearing word: no judgement call, no "nothing worth saying yet", no
waiting for a natural stopping point. Two files written → write the progress memory and
**commit it**. An uncommitted memory is not a memory.

The per-topic UI cadence is unchanged and still applies on top of this: after **every**
topic, update `src/data/progress.js` (React row only — `pages` **and** `pagesPlanned`),
the phase `README.md`, `docs/react/pages/README.md`, and the `docs/README.md` claims +
technology rows.

## Where React actually stood when this was given

Phases 0–6 complete (116 of 244 topics, 129 leaf files), **next unit is Phase 7 · Custom
hooks and the Rules of React, 12 topics**. The claims table shows React held by session
`6ffd754d` since 2026-08-14 — that claim was taken over by this session under the user's
direct instruction, not stolen silently; the claims row says so. Full resume detail and
the three build traps: [[devbible-session-20260814-react]].
