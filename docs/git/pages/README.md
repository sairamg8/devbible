---
title: "Git — Explanations"
sidebar_label: "Overview"
sidebar_position: 0
---

:::info 🔒 Claimed — session `45e775dc`, 2026-08-14

All of `docs/git/` is being written by one session. **Phase 0 is complete (14
pages); Phase 1 · The everyday loop is in progress.** Other sessions: please do
not write here. Claim table: [Contents](../../README.md).

:::

> **Target: git 2.55.0.** Two kinds of evidence appear in these pages, and each
> page says which it is on its `> Verified:` line.
>
> - **Sandbox-proven** — every console block came from a script in
>   `sandbox/git-*/`, run in a throwaway repository with the machine's global and
>   system config neutralised. All of Phase 0 is this.
> - **Documentation-validated** — the claim is checked against the official
>   `git help` pages and `git-scm.com`, with the source named. Under the
>   no-new-sandboxes rule these pages carry **no console output**: commands are
>   shown as commands, and nothing is reconstructed from memory.
>
> Nothing here is written from memory either way.

One page per topic from the [syllabus](../README.md), with runnable commands,
real output, gotchas written symptom → cause → fix, and interview questions with
answers.

## Phases — 52 topics, daily-driver scope

🔴 **Re-scoped 2026-08-14** to the Git you use to get work done, on the user's
instruction (*"I just need to know about the git to work daily tasks not more
than that"*). Five phases, down from thirteen. What was cut and why is in the
[syllabus overview](../README.md).

| Phase | Topics | Written | Status |
|---|---|---|---|
| **[00 · How Git stores things](./phase-0-how-git-stores-things/README.md)** | 14 | 14 | ✅ **Complete** |
| **[01 · The everyday loop](./phase-1-everyday-loop/README.md)** | 12 | 12 | ✅ **Complete** |
| **[02 · Branching, merging and rebasing](./phase-2-branching-merging/README.md)** | 10 | 10 | ✅ **Complete** |
| 04 · Remotes and syncing | 8 | 0 | Not started |
| 05 · Undo, recover and rewrite | 8 | 0 | Not started |

**Parked, not being written:** 03 · reading history in depth · 06 · team workflow
and code review · 07 · the fullstack repository · 08 · hooks and CI · 09 · speed
and scale · 10 · plumbing · 11 · history surgery · 12 · the error catalogue.
Their syllabus rows are still there, marked, as a record of the original plan.

## Progress

import Progress from '@site/src/components/Progress';

<Progress lang="git" />

## The sandbox

| Script | Covers |
|---|---|
| `sandbox/git-p0/ex1-version-facts.sh` | Version and command surface, the `init` default-branch hint, ref backends (`files` vs `reftable`), object formats, the divergent-pull failure, the empty-identity error, and the hash-by-hand proof |
| `sandbox/git-p0/ex2-object-model.sh` | Objects and content addressing, the three trees, the index, refs and HEAD, the commit DAG, `.git/` contents, loose-objects-to-packfile, config precedence, and a commit built with plumbing only |

Each script writes its output next to it as `exN-output.txt`, so a page's
console block can be diffed against a fresh run.

## Two things that are absent on this machine

**`git-filter-repo` and `git-lfs` are not installed.** They were named by phases
5, 7 and 11 — and after the 2026-08-14 re-scope, **no page in scope needs
either**: the history-surgery topics that used them are parked. Recorded here so
nobody re-discovers it.

---

← [Syllabus overview](../README.md) · Start → [Phase 0 — How Git stores things](./phase-0-how-git-stores-things/README.md)
