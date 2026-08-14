---
title: "Aborting cleanly"
sidebar_label: "10 · Aborting cleanly"
sidebar_position: 10
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against **git 2.55.0** — `man git-merge` (`--abort`,
> `--continue`, and its warning about uncommitted changes), `man git-rebase`,
> `man git-cherry-pick`, `man git-revert`, `man git-am`, `man git-status` (the
> in-progress state lines shipped in the binary).
> **Documentation-validated, not sandbox-proven.**

**Every Git operation that can stop halfway can also be abandoned. Knowing the
three words — `--abort`, `--continue`, `--skip` — and that `git status` always
names which operation you are inside removes most of the fear from merging and
rebasing. You can always get back to where you started.**

## The table

| Operation | Continue | Skip this step | Abandon |
|---|---|---|---|
| `merge` | `git merge --continue` | — | `git merge --abort` |
| `rebase` | `git rebase --continue` | `git rebase --skip` | `git rebase --abort` |
| `cherry-pick` | `git cherry-pick --continue` | `git cherry-pick --skip` | `git cherry-pick --abort` |
| `revert` | `git revert --continue` | `git revert --skip` | `git revert --abort` |
| `am` | `git am --continue` | `git am --skip` | `git am --abort` |
| `bisect` | — | `git bisect skip` | `git bisect reset` |
| `stash pop` (conflicted) | resolve, then `git stash drop` | — | `git checkout -- .` |

`--quit` also exists on `rebase`, `cherry-pick` and `revert`: it **stops the
operation but keeps what has already been applied**, rather than undoing it. It is
the middle option between continue and abort, and it is occasionally exactly what
you want after a cherry-pick that has already brought over the commit you cared
about.

## First: find out where you are

Never guess. `git status` prints the state, and these are the strings the 2.55.0
binary ships:

| Status says | You are inside |
|---|---|
| `You have unmerged paths.` | A conflicted merge |
| `All conflicts fixed but you are still merging.` | A merge, resolved, not committed |
| `You are currently rebasing branch 'x' on 'y'.` | A rebase |
| `Last commands done (N commands done):` | An interactive rebase, with its progress |
| `You are currently editing a commit while rebasing…` | An `edit` step |
| `You are currently splitting a commit while rebasing…` | A split in progress |
| `You are currently cherry-picking commit <sha>.` | A cherry-pick |
| `You are currently reverting commit <sha>.` | A revert |
| `You are currently bisecting, started from branch 'x'.` | A bisect |
| `You are in the middle of an am session.` | `git am` |

Git also refuses many commands while an operation is in progress, with a message
naming what to do — for example `try "git cherry-pick (--continue | --abort |
--quit)"`. Read it rather than working around it.

## What `--abort` actually restores

For rebase, cherry-pick and revert, `--abort` is reliable: the original commits
still exist, and the branch pointer moves back.

For **merge**, the manual attaches a specific warning:

> `git merge --abort` will abort the merge process and try to reconstruct the
> pre-merge state. However, **if there were uncommitted changes when the merge
> started** (and especially if those changes were further modified after the merge
> was started), `git merge --abort` will in some cases be **unable to reconstruct
> the original** (pre-merge) changes.

Hence the rule from [fast-forward versus a real
merge](02-fast-forward-vs-merge.md): commit or stash before merging. The manual
puts it as *"Running `git merge` with non-trivial uncommitted changes is
discouraged."*

## When `--abort` will not run

Occasionally an operation leaves state Git will not clear automatically — usually
after a crash, or after `.git/` was edited by hand. The state lives in files at
the top of `.git/`:

| File or directory | Left by |
|---|---|
| `MERGE_HEAD` | An in-progress merge |
| `CHERRY_PICK_HEAD` | A cherry-pick |
| `REVERT_HEAD` | A revert |
| `rebase-merge/` or `rebase-apply/` | A rebase |
| `BISECT_LOG` | A bisect |

Prefer the command every time — `git merge --abort`, `git rebase --abort`. Deleting
these by hand is a last resort, and if you do, `git status` afterwards is
mandatory to confirm the repository agrees with you.

The safest general recovery, when the operation is confused but the commits are
intact:

```bash
git reflog
git reset --hard <the pre-operation hash>
```

`ORIG_HEAD` is usually that hash for the most recent operation
([`git reflog`](09-reflog.md)).

## `--skip` is not "skip this conflict"

Worth repeating, because it is the one flag here that loses work:

- **`rebase --skip`** drops the commit currently being applied, entirely.
- **`cherry-pick --skip`** and **`revert --skip`** do the same for theirs.

The legitimate use is when the change is already present upstream, so replaying it
produces an empty commit. The illegitimate use is "I do not want to resolve this",
which silently discards a change.

```bash
git show REBASE_HEAD      # what am I about to skip?
```

Read that before skipping. Every time.

## The habit

Before starting a merge or rebase:

```bash
git status               # clean tree?
git stash                # if not
git log --oneline --graph --decorate --all -20    # where is everything?
```

Two seconds, and it makes `--abort` reliable and the operation legible. Most bad
Git afternoons start with an operation begun on a dirty tree without knowing where
the branches were.

## Trade-off

**Git's escape hatches are excellent and almost entirely undiscoverable in the
moment you need them.**

The mechanism is genuinely strong: because commits are immutable and operations
record `ORIG_HEAD` and reflog entries, nearly any half-finished operation can be
unwound exactly. There is no equivalent of a corrupted working copy that has to be
re-cloned.

But the interface is a set of subcommand-specific flags, learned separately, and
consulted under stress. Someone in the middle of a conflicted interactive rebase
with two commits applied does not reliably remember whether `--skip` skips the
conflict or the commit — and one of those answers deletes their work. The `-i`
todo list, the three `HEAD` files and the `AUTO_MERGE` ref are all discoverable
only if you already know they exist.

The mitigation is small and entirely behavioural: **`git status` is the first
command in any confusing state**, because it names the operation and often the
exact flag; and **`git reflog` plus `reset --hard` is the universal fallback** that
works when the specific flags do not. Two commands, and they cover nearly
everything.

## Gotchas

**Symptom:** `git merge --abort` left the working tree in a strange state
**Cause:** there were uncommitted changes when the merge began; the manual documents that they cannot always be reconstructed
**Fix:** `git reflog` and `git reset --hard <pre-merge hash>`, accepting the loss of the uncommitted work. Commit or stash before merging in future

**Symptom:** `git rebase --skip` and a commit disappeared
**Cause:** `--skip` drops the commit being applied, not the conflict
**Fix:** `git reflog` for the pre-rebase tip and start again. Inspect with `git show REBASE_HEAD` before skipping

**Symptom:** every command refuses, saying an operation is in progress
**Cause:** leftover state — `MERGE_HEAD`, `CHERRY_PICK_HEAD`, `rebase-merge/`
**Fix:** run the matching `--abort`. Only delete the files by hand if that fails, and verify with `git status` afterwards

**Symptom:** you do not know which operation you are inside
**Cause:** you did not read `git status`, which says so on its first lines
**Fix:** `git status`. It also prints the interactive-rebase progress as `Last commands done (N commands done)`

**Symptom:** `--abort` after an interactive rebase undid commits you wanted to keep
**Cause:** `--abort` returns the branch to its pre-rebase state entirely — including steps that succeeded
**Fix:** `--quit` is the option that stops without undoing. Afterwards, `git reflog` still has every intermediate state

---

← Prev: [`git reflog` as the safety net](09-reflog.md) · Next → [Phase 2 index](README.md)
