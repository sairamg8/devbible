---
title: "Phase 5 — Undo, recover and rewrite"
sidebar_label: "Overview"
sidebar_position: 0
---

> **Target: git 2.55.0.** This phase is **documentation-validated**, not
> sandbox-proven: claims are checked against `git help <cmd>` on 2.55.0, and each
> page names its sources on its `> Verified:` line. The one console block — a
> branch being 41 bytes — is recorded output from
> `sandbox/git-p0/ex2-object-model.sh`.

Every command that gets you out of trouble, organised **by the trouble rather than
by the command**. The framing question is the same on every page:

> **Has anyone else got these commits?**

Answer it first and the command follows. Answer it last and you will eventually
rewrite something you should not have.

**8 topics**, after the 2026-08-14 re-scope to daily-driver Git.

| # | Page | Tier | In one line |
|---|---|---|---|
| 01 | **[The undo decision table](01-the-undo-decision-table.md)** | <span className="db-tier t-master">Master</span> | Every "what went wrong" mapped to a command, plus the recoverability ladder |
| 02 | **[`reset` in terms of the three trees](02-reset-in-depth.md)** | <span className="db-tier t-master">Master</span> | `--soft`/`--mixed`/`--hard`, and `--keep` as the cautious `--hard` |
| 03 | **[`revert` is the undo for shared history](03-revert.md)** | <span className="db-tier t-master">Master</span> | Adds a commit rather than removing one; `-m 1` for merges |
| 04 | **[Recovery with `reflog`](04-reflog-recovery.md)** | <span className="db-tier t-master">Master</span> | The rescue procedure, `fsck --lost-found`, and how long it stays possible |
| 05 | **[Rewriting your own last few commits](05-rewriting-your-own-commits.md)** | <span className="db-tier t-understand">Understand</span> | `--amend --only`, the `--fixup` workflow, splitting, `--root` |
| 06 | **[Recovering a deleted branch](06-recovering-a-branch.md)** | <span className="db-tier t-understand">Understand</span> | A branch is 41 bytes; the commits were never touched |
| 07 | **[Undoing a merge](07-undoing-a-merge.md)** | <span className="db-tier t-master">Master</span> | Three situations, three commands — and why you must revert the revert |
| 08 | **[Undoing something already pushed](08-undoing-something-pushed.md)** | <span className="db-tier t-master">Master</span> | Revert or rewrite-and-coordinate; and the secret case, in order |

## Coverage

✅ **PHASE COMPLETE — 8 of 8 topics, 9 files, 1,344 lines.**

## The two things this phase is really about

**1 · The recoverability ladder.** Not everything Git holds is equally safe:

| State | Recoverable? | How |
|---|---|---|
| Committed | ✅ Almost always | `git reflog`, `ORIG_HEAD` |
| Stashed | ✅ Yes | `git stash list`; `git fsck` even after `drop` |
| Staged | ⚠️ Sometimes | The blob exists — `git fsck --lost-found` |
| Working tree only | ❌ **No** | Nothing in Git has a copy |

"Git never loses anything" protects the wrong noun. What people lose is
uncommitted — hence **commit early, even badly**, and `git stash` rather than
`git reset --hard` as the reflex for "clean tree".

**2 · The safety net expires.** `gc.reflogExpire` 90 days,
`gc.reflogExpireUnreachable` **30 days**, `gc.pruneExpire` **two weeks** for loose
objects — and `gc.auto` fires during ordinary work. An orphaned commit is reliably
recoverable for **two weeks to a month**, not forever. ⚠️ `git gc --prune=now` and
`git reflog expire --expire=now --all` destroy exactly that window, and both appear
in "clean up your repository" advice online.

The only real backup is a **pushed branch** — a copy in another repository.

## What was cut on 2026-08-14

This phase was 16 topics. Eight are parked as beyond daily use: dangling objects
and `git fsck` as a topic of its own (folded into 04), `gc` and expiry windows
(also 04), stash recovery (in the phase-1 stash topic), removing a secret from
history and the rewrite tools `filter-repo` / BFG (the *ordering* that matters is
in topic 08), squashing a branch before merge, `ORIG_HEAD` / `MERGE_HEAD` /
`CHERRY_PICK_HEAD` as a topic (used throughout), and recovering from a bad
`rebase --onto`.

## Gate — move on when

You can hard-reset away three commits on purpose, restore them from the reflog,
and **explain how long that would have stayed possible**.

## Where this phase connects

- **Back to [Phase 1](../phase-1-everyday-loop/README.md)** — `restore` and the
  first `reset` table live there; this phase is the same commands with the
  shared-history question attached.
- **Back to [Phase 2](../phase-2-branching-merging/README.md)** — the golden rule
  is what makes `revert` the answer, and `reflog` appears there as a safety net and
  here as a procedure.
- **Back to [Phase 4](../phase-4-remotes/README.md)** — "pushed" is where undo
  stops being a local decision, and `--force-with-lease` is the tool this phase
  keeps qualifying.

---

← [Phase 4 — Remotes and syncing](../phase-4-remotes/README.md) ·
Start → [The undo decision table](01-the-undo-decision-table.md)
