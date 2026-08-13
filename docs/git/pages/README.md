---
title: "Git — Explanations"
sidebar_label: "Overview"
sidebar_position: 0
---

> **Target: git 2.55.0.** Every command block in these pages was produced by a
> script in `sandbox/git-*/`, run in a throwaway repository under `/tmp` with
> the machine's global and system config neutralised. Nothing here is written
> from memory.

One page per topic from the [syllabus](../README.md), with runnable commands,
real output, gotchas written symptom → cause → fix, and interview questions with
answers.

## Phases

| Phase | Topics | Pages | Status |
|---|---|---|---|
| **[00 · How Git stores things](./phase-0-how-git-stores-things/README.md)** | 14 | 14 | ✅ **Complete** |
| 01 · The everyday loop | 16 | 0 | Not started |
| 02 · Branching, merging and rebasing | 17 | 0 | Not started |
| 03 · Reading history | 14 | 0 | Not started |
| 04 · Remotes and syncing | 16 | 0 | Not started |
| 05 · Undo, recover and rewrite | 16 | 0 | Not started |
| 06 · Team workflow and code review | 15 | 0 | Not started |
| 07 · The repository in a fullstack project | 15 | 0 | Not started |
| 08 · Hooks, CI and automation | 14 | 0 | Not started |
| 09 · Speed, scale and daily ergonomics | 13 | 0 | Not started |
| 10 · Plumbing and internals | 14 | 0 | Not started |
| 11 · History surgery and migration | 13 | 0 | Not started |
| 12 · When Git goes wrong | 14 | 0 | Not started |

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

**`git-filter-repo` and `git-lfs` are not installed.** Phases 5, 7 and 11 name
them. Those pages will either be measured after installing the tools, or state
explicitly that their output came from upstream documentation rather than a run
here — the never-invent-output rule does not bend for a missing dependency.

---

← [Syllabus overview](../README.md) · Start → [Phase 0 — How Git stores things](./phase-0-how-git-stores-things/README.md)
