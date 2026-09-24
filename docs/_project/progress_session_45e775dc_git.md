---
name: devbible-session-45e775dc-git
description: Session handoff — Git picked up, locked, re-scoped 191→52 and finished; what was decided, what is parked, and the traps found
metadata:
  type: progress
---

# Session `45e775dc` — Git, start to finish (2026-08-14)

**Outcome: the Git corpus is COMPLETE at its re-scoped size and the claim is
released.** Nothing is left half-written. Detail lives in
[[devbible-git-pages]]; the standing order in [[devbible-git-only-20260814]].
This file is the arc of the session, for anyone reconstructing why the corpus
looks the way it does.

## What the user asked, in order

1. *"There was git course yet to complete the explanations can you pick it up ?
   and lock it in ?"* → claimed Git (it had **no** claim row), locked as rule 11
   §11d, started Phase 1.
2. *"How much time will it take ?"* and *"I just need to know about the git to
   work daily tasks not more than that"* → **stopped and asked how far to cut**,
   with three widths offered.
3. Chose the **minimal** option (**52 topics**) plus **"practical depth, no
   interview sections"**.
4. *"So we completed git right apart from parked ones ?"* → **no**, it was 20 of
   52 with three phases at zero. Answered with the directory listing.
5. *"Fine lock it on untill completing this whole git"* → ran straight through
   the remaining 32 without stopping.
6. Asked whether a per-2–3-files memory rule existed → it did; the question was
   the signal that the cadence had slipped.

## Final state

**52 of 52 in-scope topics · 70 files · 12,485 lines · 0 files over 300 · 0
broken links · MDX clean 70/70 · isolated build 69 git HTML routes, zero git
warnings.**

| Phase | Topics | Files | Lines |
|---|---|---|---|
| 0 · How Git stores things | 14 | 16 | ~2,400 (sandbox-proven) |
| 1 · The everyday loop | 12 | 19 | 4,113 |
| 2 · Branching, merging, rebasing | 10 | 11 | 1,953 |
| 4 · Remotes and syncing | 8 | 9 | 1,428 |
| 5 · Undo, recover and rewrite | 8 | 9 | 1,344 |

**Parked, deliberately, and not to be reopened without a new instruction:**
phase 3 (reading history in depth — bisect, blame, pickaxe), phase 6 (team
workflow and review), and Parts 3–4 entirely (7 fullstack repo, 8 hooks/CI,
9 speed and scale, 10 plumbing, 11 history surgery, 12 the error catalogue).
**Their syllabus rows were kept, not deleted**, under `:::warning` banners, and
each in-scope phase carries a `:::info In scope` box naming its exact topics.

## Decisions a later session should not silently reverse

- **Topics 1/01 and 1/02 keep their Interview-questions sections.** They were
  written before the depth change; the content is already paid for and stripping
  it would delete good material. Everything from 1/03 onward uses the practical
  format. The phase README says which is which. The user was told and did not
  object.
- **Phase 0 was kept** even though it is not strictly "daily", because it was
  already written and it is why the daily commands make sense.
- **Topic 02's fourth chunk was dropped mid-write** (`--renormalize`, `--chmod`,
  `--sparse`, the `-i` menu) as beyond daily use; `-i` is summarised inside the
  patch-mode chunk instead.
- **Phase 1 went 16 → 12** by dropping the file-state-machine (inside `git
  status`) and finding-the-documentation, folding what-belongs-in-one-commit
  into the message topic, and merging `rm`/`mv` with `clean`.

## Traps found this session

1. 🔴 **`strings $(command -v git)` is the trick that makes Git pages possible
   without a sandbox.** It yields the exact message strings Git ships — the
   `status` hint lines, the three different `nothing to commit` messages, the
   eleven "You are currently…" in-progress states. A real source, not a
   reconstruction. Used throughout phases 1–5.
2. 🔴 **MDX cannot parse a bare `{a, b, c}` in prose** — acorn reads the braces
   as a JS expression and the build fails with *"Could not parse expression with
   acorn"*. Inside backticks is fine. `mdx-check.mjs` catches it in seconds.
3. 🔴 **A build that overlaps your own writes reports phantom broken links.** The
   first isolated build flagged one Git link to a file that demonstrably existed
   and that the filesystem checker passed; a clean rebuild reported zero. Rebuild
   before investigating — this is distinct from [[devbible-parallel-sessions]],
   because it was my own writes racing my own build.
4. **Phase directory names were pre-declared** in `src/data/progress.js` back in
   2026-08-13 (`phase-1-everyday-loop`, not `phase-1-the-everyday-loop`). Check
   that file before naming a phase directory; the first one had to be renamed.
5. **Forward links to unwritten topics were written as plain text**, becoming
   links only when the target existed. That is what kept the link check at zero
   at every commit.
6. ⚠️ **Cadence drift.** Memory writes slid to per-phase instead of per-2–3
   files during phases 4 and 5, and the user caught it. `~/.claude/CLAUDE.md`
   rule 9 now carries the specific drift note: the phase boundary is a convenient
   stopping point, **not the cadence**.

## Evidence policy, as shipped

- **Phase 0 is sandbox-proven** — its console blocks come from
  `sandbox/git-p0/ex1-version-facts.sh` and `ex2-object-model.sh`.
- **Phases 1–5 are documentation-validated** against `man git-<cmd>` on 2.55.0,
  git-scm.com and the binary's own strings, each named on the page's
  `> Verified:` line. Console blocks appear **only** where the output is reused
  from the recorded `ex1`/`ex2` runs, and each one says so underneath.
- The `ex3` script the old memory demanded is **dead** — rule 7 closed it. Nothing
  was fabricated.
- ⚠️ Two measured facts that contradict common claims and must not be
  "corrected": **`git init` still defaults to `master` on 2.55.0** (the hint says
  `main` arrives in Git 3.0), and **`git-filter-repo` / `git-lfs` are not
  installed** — no in-scope page needs either.

## Where it all landed

Project commits on `main` in the shared checkout, from the claim through
`8040378` (phase 5 complete, claim released). Store commits through `15de8a1`
(lock released). ⚠️ The devbible working tree still shows modified files under
`docs/javascript/`, `docs/react/` and `graphify-out/` — **those are other
sessions' and were deliberately left alone** ([[devbible-parallel-sessions]]).

Related: [[devbible-git-pages]] · [[devbible-git-only-20260814]] ·
[[devbible-git-syllabus]] · [[devbible-no-new-sandbox-scripts]] ·
[[devbible-memory-update-cadence]] · [[devbible-parallel-sessions]]
