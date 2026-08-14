---
title: "Phase 2 — Branching, merging and rebasing"
sidebar_label: "Overview"
sidebar_position: 0
---

> **Target: git 2.55.0.** This phase is **documentation-validated**, not
> sandbox-proven: every claim is checked against `git help <cmd>` on 2.55.0 and
> the message strings shipped in the `git` binary, and each page names its
> sources on its `> Verified:` line. The single console block — the 41-byte
> branch measurement — is recorded output from `sandbox/git-p0/ex2-object-model.sh`.

The part people are most afraid of, entirely because the model is usually taught
last. **A branch is a file with a hash in it. Merging is a three-input operation.
Rebasing is replaying patches to make new commits.** That is the whole thing, and
every command below is a consequence of one of those three sentences.

**10 topics**, after the 2026-08-14 re-scope to daily-driver Git.

| # | Page | Tier | In one line |
|---|---|---|---|
| 01 | **[A branch is a moving pointer](01-a-branch-is-a-pointer.md)** | <span className="db-tier t-master">Master</span> | 41 bytes, zero objects — and what `-d`'s "not fully merged" really checks |
| 02 | **[Fast-forward versus a real merge](02-fast-forward-vs-merge.md)** | <span className="db-tier t-master">Master</span> | The graph decides, not you; `--ff-only` is the safe pull default |
| 03 | **[The three-way merge and the merge base](03-three-way-merge.md)** | <span className="db-tier t-master">Master</span> | The ancestor is the third input; `zdiff3` shows it to you |
| 04 | **[Resolving a conflict, properly](04-resolving-conflicts.md)** | <span className="db-tier t-master">Master</span> | Three index stages, and `git add` is what marks a path resolved |
| 05 | **[`git rebase`](05-git-rebase.md)** | <span className="db-tier t-master">Master</span> | Replay makes new commits; `--onto`, `--skip`'s teeth, and undo via `ORIG_HEAD` |
| 06 | **[Rebase versus merge, decided on purpose](06-rebase-vs-merge.md)** | <span className="db-tier t-understand">Understand</span> | One question settles it: has anyone else got these commits |
| 07 | **[Interactive rebase](07-interactive-rebase.md)** | <span className="db-tier t-master">Master</span> | `pick`/`reword`/`squash`/`fixup`, `--autosquash`, and `--exec` to test each commit |
| 08 | **[Never rewrite shared history](08-the-golden-rule.md)** | <span className="db-tier t-master">Master</span> | Why a colleague's pull silently restores what you rewrote; `--force-if-includes` |
| 09 | **[`git reflog` as the safety net](09-reflog.md)** | <span className="db-tier t-master">Master</span> | Ninety days of ref movements — and why it cannot save uncommitted work |
| 10 | **[Aborting cleanly](10-aborting-cleanly.md)** | <span className="db-tier t-understand">Understand</span> | `--abort`, `--continue`, `--skip`, `--quit`, and reading which state you are in |

## Coverage

✅ **PHASE COMPLETE — 10 of 10 topics, 11 files, 1,953 lines.**

| Topic | Lines | | Topic | Lines |
|---|---|---|---|---|
| 01 · A branch is a pointer | 195 | | 06 · Rebase vs merge | 152 |
| 02 · Fast-forward vs merge | 184 | | 07 · Interactive rebase | 226 |
| 03 · Three-way merge | 190 | | 08 · The golden rule | 184 |
| 04 · Resolving conflicts | 227 | | 09 · `git reflog` | 205 |
| 05 · `git rebase` | 205 | | 10 · Aborting cleanly | 185 |

## What was cut on 2026-08-14

This phase was 17 topics. Seven are parked as beyond daily use: **cherry-pick**,
**merge strategies and `-X` options** (the essentials are inside topic 03),
**detached HEAD** (covered in topic 01 and in `git status`), **long-lived branch
maintenance**, **`rerere`** (introduced inside topic 04), **stacked branches with
`rebase.updateRefs`** (introduced inside topic 05), and the experimental
**`git replay`**.

## The four settings this phase argues for

| Setting | Why |
|---|---|
| `merge.conflictStyle = zdiff3` | Shows the merge base in conflict markers — the input that tells you what changed |
| `rerere.enabled = true` | Resolve a repeated conflict once, not once per rebase |
| `pull.ff = only` | A `pull` never invents a merge commit; it fails and you decide |
| `rebase.autosquash = true` | `--fixup` commits sort themselves out at rebase time |

## Gate — move on when

You can take a six-commit branch with two "wip" commits and a typo fix, turn it
into three coherent commits rebased onto current `main`, resolve the conflicts
that causes, and explain why every hash changed.

## Where this phase connects

- **Back to [Phase 0](../phase-0-how-git-stores-things/README.md)** — a branch is
  [a ref](../phase-0-how-git-stores-things/06-refs-and-head.md), a merge commit is
  [a commit with two parents](../phase-0-how-git-stores-things/07-commit-graph.md),
  and a conflict is [three index stages](../phase-0-how-git-stores-things/05-the-index.md).
- **Back to [Phase 1](../phase-1-everyday-loop/README.md)** — `git status` names
  every in-progress state, and `reset`/`restore` are the undo commands this phase
  keeps sending you back to.
- **Forward to Phase 4** — remotes are where "shared history" stops being an
  abstraction, and where `--force-with-lease` is actually typed.
- **Forward to Phase 5** — `revert` is the safe undo for anything this phase says
  you must not rewrite.

---

← [Phase 1 — The everyday loop](../phase-1-everyday-loop/README.md) ·
Start → [A branch is a moving pointer](01-a-branch-is-a-pointer.md)
