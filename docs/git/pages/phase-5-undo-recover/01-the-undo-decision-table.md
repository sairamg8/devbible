---
title: "The undo decision table"
sidebar_label: "01 · The decision table"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against **git 2.55.0** — `man git` §*Reset, restore and
> revert*, `man git-reset`, `man git-restore`, `man git-revert`.
> **Documentation-validated, not sandbox-proven.**

**Git has no undo. It has four commands that each move a different thing, and one
question that picks between them: *has anyone else seen this?* Answer that first
and the command follows; answer it last and you will eventually rewrite something
you should not have.**

## The one question

```text
Has anyone else got these commits?

  NO  → you may rewrite: reset, amend, rebase
  YES → you may only add: revert
```

Everything below is downstream of that. Git cannot answer it for you — it does not
know who fetched — so it is a judgement, and the safe default when unsure is
**yes**.

## The table

| What went wrong | Anyone else got it? | Command |
|---|---|---|
| Edited a file, want the committed version back | — | `git restore <file>` **destroys edits** |
| Staged something by mistake | — | `git restore --staged <file>` |
| Want the path exactly as HEAD has it | — | `git restore --staged --worktree <file>` |
| Last commit's message is wrong | No | `git commit --amend` |
| Forgot a file in the last commit | No | `git add <f>` then `git commit --amend --no-edit` |
| Committed too early — want changes back staged | No | `git reset --soft HEAD~1` |
| …want them back unstaged | No | `git reset HEAD~1` |
| …want them gone entirely | No | `git reset --hard HEAD~1` **destructive** |
| Several messy commits, want them tidy | No | `git rebase -i` |
| A bad commit that is already pushed | **Yes** | `git revert <commit>` |
| A bad merge that is already pushed | **Yes** | `git revert -m 1 <merge>` |
| Deleted a branch you needed | — | `git reflog` then `git branch <name> <hash>` |
| A rebase or reset went wrong | — | `git reset --hard ORIG_HEAD` |
| Want one file from an old commit | — | `git restore --source=<commit> <file>` |
| Working tree is a mess, want a clean start | — | `git stash` (recoverable) or `git reset --hard` (not) |

The rows with **—** are safe regardless, because they do not touch published
commits.

## The four commands, one sentence each

| Command | Moves |
|---|---|
| **`git restore`** | File content, in the working tree and/or index. **Never** moves a branch |
| **`git reset`** | The branch tip, and optionally the index and working tree with it |
| **`git revert`** | Nothing — it **adds** a commit that undoes an earlier one |
| **`git checkout`** | The old command that did the first two. Prefer the new names |

`man git-revert` states the division explicitly, and points at `reset --hard` for
discarding uncommitted work and `restore --source` for extracting files —
*"Take care with these alternatives as both will discard uncommitted changes in
your working directory."*

## The safety ladder

Not everything Git holds is equally recoverable, and knowing the order changes how
carefully you type:

| State | Recoverable after a mistake? | How |
|---|---|---|
| **Committed** | ✅ Almost always | `git reflog`, `ORIG_HEAD` |
| **Stashed** | ✅ Yes | `git stash list`; even after `drop`, `git fsck` may find it |
| **Staged** | ⚠️ Sometimes | The blob is in the object store — `git fsck --lost-found` |
| **In the working tree only** | ❌ **No** | Nothing in Git has a copy |

This is why "Git never loses anything" is a half-truth that gets people hurt. Git
protects **commits**; the thing people lose is uncommitted work, and no reflog
entry describes it.

The practical consequence is a habit, not a command: **commit early, even badly.**
An embarrassing commit is recoverable and can be rewritten later
([interactive rebase](../phase-2-branching-merging/07-interactive-rebase.md)); an
uncommitted afternoon cannot.

## Before any destructive command

```bash
git status                     # what state am I actually in?
git diff && git diff --staged  # what exactly am I about to lose?
git stash                      # if unsure — it costs nothing and is reversible
```

`git stash` is the universally safe alternative to `reset --hard` when the goal is
just "clean tree". Same result, and the changes are still there
([`git stash`](../phase-1-everyday-loop/11-git-stash.md)).

## Trade-off

**Git makes destroying published history technically easy and socially expensive,
and the interface gives no hint which of the two you are doing.**

`git reset --hard` and `git push --force` are two short commands. Whether they are
routine tidying or a repository-wide incident depends entirely on a fact Git cannot
see: who else has the commits. There is no warning, no confirmation prompt, no
difference in the output.

That asymmetry is the reason this phase is organised by *what went wrong* rather
than by command. Choosing between `reset` and `revert` on mechanical grounds —
"which one moves what" — gets the right answer only by accident. Choosing on the
social question gets it right every time, and it is a question you can actually
answer.

The residual cost is that `revert` produces uglier history than a rewrite would:
an extra commit saying "undo the thing above". That ugliness is the price of never
needing to coordinate a fix across everyone's clone, and it is cheap.

## Gotchas

**Symptom:** you used `reset --hard` to undo a pushed commit and now cannot push
**Cause:** your branch no longer contains a commit the remote has; the push is not a fast-forward
**Fix:** `git revert` is the tool for pushed commits. Recover with `git reset --hard ORIG_HEAD` and revert instead

**Symptom:** `git reset --hard` took uncommitted work with it
**Cause:** `--hard` overwrites the working tree, and uncommitted content exists nowhere else
**Fix:** `git fsck --lost-found` if it was ever staged. Otherwise gone — use `git stash` in future

**Symptom:** `git revert` refuses to run
**Cause:** it requires a clean working tree, as the manual states
**Fix:** commit or stash first

**Symptom:** you cannot tell whether to reset or revert
**Cause:** you are choosing on mechanics rather than on whether the commits are shared
**Fix:** ask the one question. If anyone might have fetched it, `revert`

**Symptom:** the reflog does not have your lost work
**Cause:** it records ref movements, not file content — uncommitted work was never a commit
**Fix:** nothing reliable. This is the reason to commit early and often

## Interview questions

**★ Git has no undo. What does it have instead, and what is the one question that
picks between them?**
Four commands that each move a different thing: `restore` moves file content in the
working tree or index and never touches a branch; `reset` moves the branch tip and
optionally drags the index and working tree along; `revert` moves nothing and adds a
commit undoing an earlier one; `checkout` is the old command that did the first two.
The question that selects among them is not mechanical — it is *has anyone else got
these commits?* No means you may rewrite; yes means you may only add. Git cannot
answer it, because it does not know who fetched, so the safe default when unsure is
yes.

**★ Rank Git's states by how recoverable they are.**
Committed work is almost always recoverable, through the reflog and `ORIG_HEAD`.
Stashed work is recoverable, and even a dropped stash may be findable with `git
fsck`. Staged work is *sometimes* recoverable — staging writes a blob into the object
store, so `git fsck --lost-found` can surface it even with no commit referencing it.
Work that exists only in the working tree is not recoverable at all, because nothing
in Git has a copy. That ladder is why "Git never loses anything" is a half-truth: it
protects commits, and what people lose is uncommitted.

**★ Why is this phase organised by "what went wrong" rather than by command?**
Because choosing between `reset` and `revert` on mechanical grounds — which one moves
what — gets the right answer only by accident. The commands differ in what they touch
locally, but the consequence that matters is social: rewriting a commit somebody else
holds creates duplicates in their clone that merge cleanly and go unnoticed. Choosing
on "has anyone seen this?" gets it right every time, and unlike the mechanical
question it is one you can actually answer.

**★ What should you run before any destructive command?**
`git status` to see what state you are actually in, `git diff` and `git diff --staged`
to see exactly what you are about to lose, and `git stash` if there is any doubt —
it produces the same clean tree as `reset --hard` and keeps the changes. That last
substitution is the single most useful habit in this phase, because the difference
between the two commands is entirely whether the work still exists afterwards.

**Why is `revert`'s uglier history worth it?**
Because the alternative is coordinating a fix across every clone. A revert adds a
commit that says "undo the thing above", which reads worse than a clean rewrite and
costs nothing to anyone else: no force-push, no divergence, no colleague pulling
duplicates. A rewrite of shared history buys tidier output and spends other people's
afternoons. That trade is what makes the extra commit cheap.

---

← Prev: [Phase 5 index](README.md) · Next → [`reset` in terms of the three trees](02-reset-in-depth.md)
