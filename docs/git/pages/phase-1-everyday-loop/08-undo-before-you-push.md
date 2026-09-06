---
title: "Undo before you push, decided properly"
sidebar_label: "08 · Undo before you push"
sidebar_position: 8
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against **git 2.55.0** — `man git-reset` (DESCRIPTION and its
> mode list), `man git-restore`, `man git` §*Reset, restore and revert*.
> **Documentation-validated, not sandbox-proven.**

**There is no "undo" command in Git. There is a small set of commands that each
move a specific subset of the three trees — HEAD, the index, the working tree —
and picking the right one
is entirely a matter of naming which of those three you want moved. This page is
that table.**

## First: name what went wrong

| What happened | What you want moved | Command |
|---|---|---|
| Edited a file, want the old content back | working tree | `git restore <file>` **destructive** |
| Staged something by mistake | index | `git restore --staged <file>` |
| Both — wipe the path back to HEAD | index + working tree | `git restore --staged --worktree <file>` |
| Committed too early, want the changes back as staged | HEAD | `git reset --soft HEAD~1` |
| Committed too early, want them back unstaged | HEAD + index | `git reset HEAD~1` (`--mixed`, the default) |
| Committed and want it *gone*, changes and all | HEAD + index + tree | `git reset --hard HEAD~1` **destructive** |
| Last commit is right but its message or content is slightly wrong | — | `git commit --amend` ([topic 03](03-git-commit.md)) |
| Already pushed it | nothing local | `git revert` — Phase 5. **Do not reset** |

The last row is the fork in the road, and it is worth deciding **before** typing
anything: **has anyone else seen this commit?** If yes, adding a commit that
reverses it (`revert`) is the only safe answer; rewriting is Phase 5's territory
and comes with obligations to everyone who has pulled.

## The three trees, and which flags touch which

`git reset [<mode>] <commit>` sets your **branch tip** to `<commit>`, then
optionally updates the index and working tree to match. That is the whole
command:

| Mode | HEAD | Index | Working tree | Net effect |
|---|---|---|---|---|
| `--soft` | ✅ moves | ✖ unchanged | ✖ unchanged | The commit's changes come back **staged** |
| `--mixed` *(default)* | ✅ moves | ✅ reset to new HEAD | ✖ unchanged | Changes come back **unstaged** |
| `--hard` | ✅ moves | ✅ reset | ✅ **overwritten** | Changes are **gone** |

Read the rows as "how far down does the reset reach". `--soft` stops at HEAD.
`--mixed` reaches the index. `--hard` reaches all the way to your files.

Two more modes exist and are worth recognising:

- **`--merge`** resets the index and updates files that differ between `<commit>`
  and HEAD, but keeps unstaged changes. It **aborts** if a file that differs
  between `<commit>` and the index has unstaged changes. It mostly exists to
  clear unmerged index entries.
- **`--keep`** updates files that differ between `<commit>` and HEAD, and
  **aborts** if any of them has local changes. It is the cautious `--hard`: it
  refuses rather than overwriting.

`--keep` is genuinely useful and almost unknown. When you want `--hard`'s effect
but are not certain nothing will be lost, `git reset --keep <commit>` gives you
the same result or an error, never a silent loss.

## `--soft` is the squash tool

The manual gives the idiom directly:

```bash
git reset --soft HEAD~5
git commit
```

Five commits become one. HEAD moves back five, but the index still holds the
final state — so everything those five commits did is staged, ready to commit as
a single change with a proper message.

This is the simplest way to clean up a branch of `wip`, `wip2`, `fix typo`
commits before anyone sees them, and it does not require interactive rebase.

## `--hard` and what it can take with it

```bash
git reset --hard HEAD~1
```

The manual's own wording is worth reading closely: it *"overwrites all files and
directories with the version from `<commit>`, and **may overwrite untracked
files**. Tracked files not in `<commit>` are removed."*

So `--hard` can delete work you never told Git about. Content that was
**committed** is recoverable through the reflog; content that was **staged** has
a blob in the object store and can be found with `git fsck --lost-found`; content
that was only ever in your working tree has no copy anywhere and is simply gone.

That is the practical safety ladder, and it explains a habit worth building:
commit early, even badly. A commit you are embarrassed by is recoverable; an
uncommitted afternoon is not.

## `ORIG_HEAD`: the built-in one-step undo

Before a `reset` — and before a merge, rebase or pull — Git records where you
were in **`ORIG_HEAD`**. Undoing a reset you regret is therefore:

```bash
git reset --hard ORIG_HEAD
```

It only holds the most recent operation, so it is one level deep. Anything older
comes from the reflog:

```bash
git reflog                       # every HEAD movement, newest first
git reset --hard HEAD@{3}        # go back to where you were three moves ago
```

The reflog is local, and by default entries expire after 90 days (30 for
unreachable ones). It is Phase 5's topic in depth; what matters here is that it
exists, and that it makes `reset` far less frightening than it looks — **as long
as the content was committed**.

## `reset` on paths is a different command

```bash
git reset <pathspec>           # unstage those paths
git reset --patch              # unstage hunk by hunk
```

With a pathspec, `reset` does not move HEAD at all. The manual states the
relationship plainly: *"`git reset <pathspec>` is the opposite of `git add
<pathspec>`… This is equivalent to `git restore --staged <pathspec>`."*

Two spellings of one operation. `git restore --staged` is the clearer one, and it
is what `git status` suggests — but `git reset <file>` is what a decade of
tutorials say, so both are worth recognising.

Note the asymmetry that trips people up: **`git reset` with a path never touches
your working tree**, while `git reset --hard` without a path does. There is no
`git reset --hard <path>`; that combination is rejected. To wipe a single path's
working-tree content you use `git restore --staged --worktree <path>`.

## `restore` versus `reset`, in one line each

- **`git restore`** operates on **paths**. It never moves a branch.
- **`git reset`** moves the **branch tip**, and optionally drags the index and
  working tree along.
- **`git revert`** creates a **new commit** that undoes an old one, changing
  nothing about history. It is the only one of the three that is safe on shared
  commits.

If you can say which of those three sentences describes your situation, the
command follows without thinking.

## Trade-off

**`--hard` is the fastest way to a clean tree and the only everyday command that
can destroy work with no recovery path.**

The pull toward it is real: it always works, it never leaves half-finished state,
and it turns a confusing situation into a known one immediately. That is exactly
why it gets typed under stress, which is exactly when the working tree is most
likely to contain something you have not committed.

The cheap alternatives cost seconds and are nearly always available:

- **`git stash`** instead of `git reset --hard` when you only want the tree clean
  — same result, and the changes are still there ([topic 11](11-git-stash.md)).
- **`git reset --keep`** instead of `--hard` when moving between commits — same
  result if nothing would be lost, an error if something would.
- **`git status` first**, every time. `--hard` on a tree you have just read is a
  decision; `--hard` on a tree you have not is a gamble.

The deeper point is that the reflog protects **commits**, not content. Every
safety argument about Git being hard to lose work in assumes the work was
committed. `--hard` is where that assumption gets tested.

## Gotchas

**Symptom:** `git reset --hard` and uncommitted work is gone
**Cause:** `--hard` overwrites the working tree from the target commit, and may remove untracked files. Content that was never committed or staged has no copy anywhere
**Fix:** `git reset --hard ORIG_HEAD` restores the *commits*, not uncommitted content. If it was staged, try `git fsck --lost-found`. Otherwise it is gone — use `git stash` next time

**Symptom:** you reset to undo a pushed commit, and now your push is rejected
**Cause:** `reset` rewrites your local branch; the remote still has the commit and your branch no longer contains it
**Fix:** `git revert <commit>` is the correct tool for anything pushed. If you must rewrite, that is Phase 5, and everyone who pulled has to be told

**Symptom:** `git reset --soft HEAD~3` and `git status` shows a huge staged change
**Cause:** working as designed — three commits' worth of changes are now staged as one
**Fix:** that is the squash idiom. `git commit` to make them one commit, or `git reset` (mixed) to unstage them again

**Symptom:** `git reset --hard <path>` errors
**Cause:** there is no such combination; a pathspec makes `reset` an unstaging operation only
**Fix:** `git restore --staged --worktree <path>` to wipe both for that path

**Symptom:** you unstaged with `git reset <file>` and expected your edits to revert too
**Cause:** `reset` with a path only touches the index — it is exactly `git restore --staged`
**Fix:** intended. Add `--worktree` to the `restore` form if you also want the file reverted

**Symptom:** `git reset --keep` refused to run
**Cause:** a file that differs between the target commit and HEAD has local changes — `--keep` aborts rather than overwriting
**Fix:** that is the feature. Commit or stash the local changes, then repeat

## Interview questions

**★ There is no undo command in Git. What is the question you ask instead?**
Which of the three trees do I want moved — `HEAD`, the index, or the working tree?
Every undo command is a specific answer to that. `restore` moves paths in the index
or working tree and never touches a branch. `reset` moves the branch tip and
optionally drags the index and working tree with it. `revert` moves nothing and
adds a new commit that reverses an old one. If you can say which of those three
sentences describes the situation, the command follows without thinking — and the
one question that outranks all of it is whether anyone else has seen the commit.

**★ What is the difference between `--soft`, `--mixed` and `--hard`?**
How far down the reset reaches. All three move `HEAD`. `--soft` stops there, so the
commits' changes come back **staged**. `--mixed`, the default, also resets the
index, so they come back **unstaged**. `--hard` additionally overwrites the working
tree, so they are **gone**. That single "how far down" reading is worth more than
memorising three definitions, and it explains why `--soft HEAD~5` followed by
`git commit` is the simplest squash in Git: `HEAD` moves back five, the index still
holds the final state.

**★ `git reset --hard` and the work is gone. What can be recovered and what cannot?**
It depends on how far the content ever got. **Committed** content is recoverable —
`git reset --hard ORIG_HEAD` undoes the most recent reset, and the reflog reaches
further back. **Staged** content has a blob in the object store even though no
commit references it, so `git fsck --lost-found` can often find it. Content that
was only ever in the working tree has no copy anywhere and is simply gone. The
manual is also explicit that `--hard` *may overwrite untracked files* and removes
tracked files not present in the target commit. Every "Git makes it hard to lose
work" argument silently assumes the work was committed.

**★ What is `git reset --keep`, and why would you use it over `--hard`?**
`--keep` updates the files that differ between the target commit and `HEAD` but
**aborts** if any of them has local changes. So it gives you either exactly what
`--hard` would have given you, or an error — never a silent loss. It is the
cautious `--hard` for moving between commits, it is almost unknown, and it costs
nothing to prefer. The related `--merge` resets the index and updates differing
files while keeping unstaged changes, and mostly exists to clear unmerged index
entries after a failed merge.

**★ Why does `git reset <path>` behave nothing like `git reset --hard`?**
Because a pathspec turns `reset` into a completely different operation: it does not
move `HEAD` at all, it just resets those index entries. The manual states it
directly — `git reset <pathspec>` is the opposite of `git add <pathspec>`, and is
equivalent to `git restore --staged <pathspec>`. The asymmetry that catches people
is that path-form `reset` never touches the working tree while `--hard` without a
path does, and `git reset --hard <path>` is rejected outright. To wipe one path's
working-tree content, the command is `git restore --staged --worktree <path>`.

**★ You reset to undo a commit and now your push is rejected. What now?**
`reset` rewrote your local branch, so the remote still holds a commit your branch
no longer contains and the histories have diverged. If the commit was pushed, the
correct tool was never `reset` — it is `git revert`, which adds a commit that
reverses the change and leaves everyone's history intact. If you genuinely must
rewrite shared history, that is a deliberate operation with obligations to
everyone who has pulled, and it belongs in the rewriting-history phase, not in an
everyday undo.

**What is `ORIG_HEAD`, and what are its limits?**
Before a `reset`, merge, rebase or pull, Git records where you were in `ORIG_HEAD`,
so `git reset --hard ORIG_HEAD` is a one-step undo for the operation you just ran.
Its limit is in the name: it holds only the most recent such operation, so it is
one level deep. Anything older comes from the reflog — `git reflog` lists every
`HEAD` movement and `HEAD@{3}` addresses them positionally. Both are local to your
clone, and reflog entries expire (90 days by default, 30 for unreachable ones).

---

← Prev: [`git switch` and `git restore`](07-switch-and-restore.md) · Next → [`git log` for the everyday case](09-git-log.md)
