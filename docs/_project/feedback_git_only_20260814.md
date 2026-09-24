---
name: devbible-git-only-20260814
description: Standing order — Git is locked to session 45e775dc; docs/git only, phases 1-12, doc-validated not sandboxed, per-file cadence
metadata:
  type: feedback
---

# Git only — session `45e775dc`, locked 2026-08-14

## The instruction, verbatim

> *"There was git course yet to complete the explanations can you pick it up ? and
> lock it in ?"*

**Why:** the user runs several sessions at once, each pinned to one technology
([[devbible-parallel-sessions]]). Git had a complete syllabus and a complete
Phase 0 sitting untouched since 2026-08-13, with **no claim row at all** in
`docs/README.md` — genuinely free, not another session's work. "Lock it in" is
the same phrasing used for Express and JavaScript, and carries the same meaning:
a lock that lives until the user revokes it, worked without waiting for approval
between units.

**How to apply:**

- Work **`docs/git/` and nothing else**. Broken links, stale counts and MDX
  failures in other corpora belong to their owning sessions — see
  [[devbible-parallel-sessions]]. Never `git add -A`; stage explicit paths.
- **Resume automatically.** Open [[devbible-git-pages]] first and start at the
  topic its cursor names. Do not ask whether to continue.
- **Cadence is per file**, not per 2–3 ([[devbible-memory-update-cadence]]):
  write a page → update the four boards → commit → update the memory.
- The 300-line cap is a **file-size** rule, never a content budget
  ([[devbible-never-compress-to-fit-cap]]). A Master Git topic that wants 700
  lines becomes three chunks in a `NN-topic/` directory.

## 🔴 Re-scoped, then re-locked to completion — same day

Mid-session the user narrowed it twice. First:

> *"I just need to know about the git to work daily tasks not more than that"*

Offered three widths, they chose the **minimal** — **52 topics, phases 0, 1, 2, 4, 5** —
and, on depth, **"practical depth, no interview sections"**. Then, on being told plainly
that 20 of 52 were done and 32 remained (two of the five phases with zero pages):

> *"Fine lock it on untill completing this whole git"*

**That is a run-to-completion order.** Work all 52 without stopping to report and wait.
The per-phase worklists are in `:::info In scope` boxes in the syllabus files — read
them, do not re-derive the subset. Detail: [[devbible-git-pages]].

⚠️ **Correcting an optimistic reading is part of the job here.** The user asked whether
Git was "completed apart from the parked ones" when it was at 20 of 52 with phases 2, 4
and 5 at literally zero pages. The boards said 38% and the phase table said "Not
started", but a claim row can still read as done at a glance. Answer that question with
the directory listing, not the board.

## 🔴 The `ex3` plan in the old progress memory is dead

[[devbible-git-pages]] was written on **2026-08-13** and says Phase 1 *"needs a
new `sandbox/git-p0/ex3-everyday-loop.sh` **before** any page is written"*, with
a fifteen-item list of what it must measure. **[[devbible-no-new-sandbox-scripts]]
landed after that and closed sandboxing.** Do not write `ex3`.

What replaces it:

- **Phase 0 stays sandbox-proven** — its 14 pages keep their console blocks,
  which came from `ex1-version-facts.sh` and `ex2-object-model.sh`, and the pages
  README now labels the two kinds of evidence explicitly.
- **Phases 1–12 are documentation-validated** against `git help <cmd>` and
  git-scm.com, with the source named in each page's `> Verified:` line.
- **No run means no console block.** The recorded `ex1-output.txt` /
  `ex2-output.txt` may be reused where they genuinely cover a claim (they do
  cover `git status --short` codes including `AM`, and the three `git diff`
  pairings). Everything else shows the *command* and explains the behaviour in
  prose. Git output is unusually easy to fabricate convincingly — that is the
  reason for the hard line, not pedantry.

## Two measured facts that contradict the common claim

Both from `ex1`, run with `GIT_CONFIG_GLOBAL=/dev/null` and
`GIT_CONFIG_SYSTEM=/dev/null` so the default measured is Git's, not this laptop's:

1. **`git init` still defaults to `master` on git 2.55.0.** The hint says the
   change to `main` arrives in **Git 3.0**. Most blog posts say Git already
   defaults to `main` — they are wrong, and a later session must not "fix" the
   pages to match them.
2. **`git-filter-repo` and `git-lfs` are not installed.** Phases 5, 7 and 11 name
   both. Those pages state plainly that their content comes from upstream
   documentation rather than a run here.

Related: [[devbible-git-pages]] · [[devbible-git-syllabus]] ·
[[devbible-no-new-sandbox-scripts]] · [[devbible-parallel-sessions]] ·
[[devbible-never-compress-to-fit-cap]] · [[devbible-memory-update-cadence]]
