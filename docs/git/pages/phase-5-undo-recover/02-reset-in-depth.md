---
title: "`reset` in terms of the three trees"
sidebar_label: "02 · reset in depth"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against **git 2.55.0** — `man git-reset` (DESCRIPTION and the
> full mode list including `--merge` and `--keep`), `man git-restore`.
> **Documentation-validated, not sandbox-proven.**

**`git reset` moves the current branch tip to a commit, and then optionally drags
the index and the working tree along with it. Which of those three it touches is
the only thing the mode flags control, and the whole command becomes obvious once
you read the flags as "how deep does this reach".**

## The modes

| Mode | HEAD | Index | Working tree | Result |
|---|---|---|---|---|
| `--soft` | ✅ | ✖ | ✖ | The commits' changes come back **staged** |
| `--mixed` *(default)* | ✅ | ✅ | ✖ | Changes come back **unstaged** |
| `--hard` | ✅ | ✅ | ✅ | Changes are **gone** |
| `--merge` | ✅ | ✅ | partial | Keeps unstaged changes; **aborts** if they conflict |
| `--keep` | ✅ | ✅ | partial | **Aborts** if any affected file has local changes |

Read down the first three rows: `--soft` stops at HEAD, `--mixed` reaches the
index, `--hard` reaches your files. Nothing else changes between them.

## The three you use

**`--soft` — the squash tool.** The manual gives the idiom directly:

```bash
git reset --soft HEAD~5
git commit                 # five commits become one, everything already staged
```

HEAD moves back five, but the index still holds the final state, so every change
those commits made is staged. This is the simplest branch cleanup there is and
needs no interactive rebase.

**`--mixed` — the default, and the unstage-everything command.**

```bash
git reset HEAD~1           # undo the commit, keep the changes on disk, unstaged
git reset                  # unstage everything, change no commits
```

Bare `git reset` with no commit resets the index to HEAD — which is exactly "unstage
all", the whole-repository version of
`git restore --staged .`.

**`--hard` — the destructive one.** From the manual: it *"overwrites all files and
directories with the version from `<commit>`, and **may overwrite untracked
files**. Tracked files not in `<commit>` are removed."*

So it can delete work Git has never seen. What survives:

| Was it… | Recoverable? |
|---|---|
| Committed | ✅ `git reflog` / `ORIG_HEAD` |
| Staged | ⚠️ The blob exists — `git fsck --lost-found` |
| Working tree only | ❌ Nothing has a copy |

## The two nobody uses, and should

**`--keep`** is `--hard` with a conscience:

```bash
git reset --keep <commit>
```

It updates files that differ between `<commit>` and HEAD, and **aborts** if any of
them has local changes. Same outcome as `--hard` when nothing would be lost, an
error when something would. If you find yourself typing `--hard` while slightly
unsure, this is the command you actually wanted.

**`--merge`** resets the index and updates differing files while keeping unstaged
changes, aborting if a file that differs between `<commit>` and the index has
unstaged changes. It exists mainly to clear unmerged index entries after a failed
`am` or switch.

## `reset` with a pathspec is a different command

```bash
git reset <paths>          # unstage those paths
git reset --patch          # unstage hunk by hunk
```

With a pathspec, `reset` **does not move HEAD at all**. The manual: *"`git reset
<pathspec>` is the opposite of `git add <pathspec>`… This is equivalent to
`git restore --staged <pathspec>`."*

Two consequences worth holding onto:

- **`git reset <path>` never touches your working tree.** Your edits survive.
- **There is no `git reset --hard <path>`.** The combination is rejected. To wipe a
  single path, `git restore --staged --worktree <path>`.

## Naming the target commit

| Form | Means |
|---|---|
| `HEAD~3` | Three commits back in **ancestry** |
| `HEAD@{3}` | Where HEAD was three **operations** ago (reflog) |
| `ORIG_HEAD` | Where HEAD was before the last big operation |
| `origin/main` | Whatever the remote-tracking ref points at |
| `<hash>` | Exactly that commit |

`~` and `@{}` are constantly confused and mean completely different things. After
a reset they can be wildly apart, and `@{n}` is the one that undoes operations
([`git reflog`](../phase-2-branching-merging/09-reflog.md)).

`git reset --hard origin/main` is the standard "make my branch exactly match the
remote, discard my local commits" — useful, and destructive to anything you had
not pushed.

## Undoing a reset

```bash
git reset --hard ORIG_HEAD     # set before the reset ran
git reflog                     # anything older
```

Reliable, because the commits still exist and only the pointer moved. Worth
knowing before your first `--hard`, not after.

## Trade-off

**One command with five modes covering "unstage a file" through "delete my last
week" is compact, memorable, and dangerously uniform.**

The design is genuinely elegant: one verb, one target, and a flag saying how far
down the three trees the effect reaches. Once you hold that model, you never have
to remember separate commands for unstaging, uncommitting and discarding.

The cost is that the safest and the most destructive operations differ by one
word, look identical in shell history, and produce no confirmation. `git reset
HEAD~1` and `git reset --hard HEAD~1` sit next to each other in muscle memory, and
only one of them is reversible for uncommitted work.

Git's own answer was to split the safe half out: `git restore` now covers the
file-level operations, with a name that cannot be confused with the branch-moving
one, and `git status` suggests `restore` rather than `reset`. Taking that split
seriously — **`restore` for paths, `reset` for commits** — removes most of the
risk, and leaves `--keep` as the honest choice for the times you want `--hard`'s
effect without betting your working tree on it.

## Gotchas

**Symptom:** `git reset --hard` and uncommitted work is gone
**Cause:** `--hard` overwrites the working tree and may remove untracked files; uncommitted content exists nowhere else
**Fix:** `git reset --hard ORIG_HEAD` restores the commits, not the content. `git fsck --lost-found` if it was staged. Use `git stash` next time

**Symptom:** `git reset --hard <path>` errors
**Cause:** a pathspec makes `reset` an unstaging operation; the combination does not exist
**Fix:** `git restore --staged --worktree <path>`

**Symptom:** `git reset --soft HEAD~3` produced a huge staged change
**Cause:** three commits' worth of changes are now staged as one — that is the squash idiom working
**Fix:** `git commit` to combine them, or `git reset` to unstage

**Symptom:** `git reset HEAD~1` did not revert your file edits
**Cause:** `--mixed` leaves the working tree alone by design
**Fix:** intended. Add `--hard` only if you really want the content gone

**Symptom:** `git reset --keep` refused
**Cause:** a file that differs between the target and HEAD has local changes, and `--keep` aborts rather than overwriting
**Fix:** that is the feature. Commit or stash, then repeat

**Symptom:** you reset to `HEAD@{2}` and landed somewhere unexpected
**Cause:** `@{2}` is two *operations* back, not two commits
**Fix:** `git reflog` and read the descriptions; verify with `git show` before resetting

---

← Prev: [The undo decision table](01-the-undo-decision-table.md) · Next → [`revert` is the undo for shared history](03-revert.md)
