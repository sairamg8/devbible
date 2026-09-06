---
title: "`git switch` and `git restore`"
sidebar_label: "07 · switch and restore"
sidebar_position: 7
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against **git 2.55.0** — `man git-switch`, `man git-restore`
> (DESCRIPTION, OPTIONS), and `man git` §*Reset, restore and revert*. `ex1`
> recorded that neither command is advertised as experimental in its usage output
> on this build. **Documentation-validated, not sandbox-proven.**

**`git checkout` did two unrelated jobs: move HEAD to another branch, and
overwrite files from some version. Git 2.23 split it in two — `switch` moves
between branches, `restore` overwrites file content. Every "checkout deleted my
work" story is a person who typed one meaning and got the other.**

## The split

| Old | New | What it does |
|---|---|---|
| `git checkout <branch>` | **`git switch <branch>`** | Move HEAD to a branch. Working tree and index update to match |
| `git checkout -b <new>` | **`git switch -c <new>`** | Create a branch and move to it |
| `git checkout -- <file>` | **`git restore <file>`** | Overwrite the file in the working tree from the index |
| `git checkout <commit> -- <file>` | **`git restore --source=<commit> <file>`** | Overwrite the file from a specific commit |
| `git reset HEAD <file>` | **`git restore --staged <file>`** | Unstage — restore the index entry from HEAD |

`checkout` still works and is not deprecated; you will meet it in every tutorial
written before 2019 and in most people's fingers. But the two new commands are
worth switching to for one reason: **they cannot be confused with each other.**
`git checkout main` and `git checkout main.py` differ by a file extension and do
completely different things — the first moves your branch, the second overwrites
a file. `switch` and `restore` cannot make that mistake.

## `git switch`

```bash
git switch main                 # move to an existing branch
git switch -c feature/pricing   # create it and move there
git switch -                    # back to the previous branch
git switch --detach v1.4.0      # deliberately detach HEAD at a tag
```

Three things the manual makes explicit:

**A clean tree is not required.** *"Switching branches does not require a clean
index and working tree."* Uncommitted changes come with you, as long as they do
not conflict with what the target branch has for those files.

**It aborts rather than losing work.** *"The operation is aborted however if the
operation leads to loss of local changes, unless told otherwise with
`--discard-changes` or `--merge`."* This is the important safety property, and it
is a real improvement on `checkout`, which was more willing to do damage on a
path argument.

**`-` is the previous branch.** `git switch -` toggles back and forth, the same
way `cd -` does. It is the single most-used form after the plain one.

`git switch -c` versus `-C`: lowercase creates and fails if the branch exists;
uppercase creates **or resets** an existing branch to your current commit. `-C`
is a small loaded gun — it moves someone else's branch pointer if the name
collides.

### When it refuses

```text
error: Your local changes to the following files would be overwritten by checkout
```

The target branch has a different version of a file you have edited. Three
honest options:

| Option | Command | When |
|---|---|---|
| Take the changes with you | Not possible here — that is the error | — |
| Park them | `git stash` (topic 11), switch, `git stash pop` | You want them on the other branch, or later |
| Commit them | `git commit` on the current branch | They belong where they are |
| Throw them away | `git switch --discard-changes <branch>` | You are certain. There is no undo |

`--merge` is the fourth: it attempts a three-way merge of your local changes into
the target branch, which can leave you with conflict markers to resolve. Useful
when you started work on the wrong branch and want to carry it across.

## `git restore`

This is the destructive one, and it is worth reading its default carefully.

```bash
git restore <file>                       # working tree ← index
git restore --staged <file>              # index ← HEAD          (unstage)
git restore --staged --worktree <file>   # both ← HEAD           (full reset of that path)
git restore --source=HEAD~2 <file>       # working tree ← that commit
```

The **restore location** is chosen by `-W`/`--worktree` and `-S`/`--staged`;
neither given means the working tree. The **restore source** defaults to the
index — unless `--staged` is given, in which case it defaults to HEAD.

That gives the table that actually matters:

| Command | Source | Target | Effect |
|---|---|---|---|
| `git restore f` | index | working tree | **Discards your unstaged edits.** No undo |
| `git restore --staged f` | HEAD | index | Unstages. Your working-tree edits survive |
| `git restore --staged --worktree f` | HEAD | both | Wipes the path back to HEAD entirely |
| `git restore --source=<c> f` | commit `<c>` | working tree | Pulls an old version of the file into your tree, unstaged |

**Only the first and third destroy anything**, and they destroy content that was
never committed — which means the reflog cannot help. This is the one everyday
Git command with no undo, and `git status` prints it as a hint in the same tone
as everything else:

```text
(use "git restore <file>..." to discard changes in working directory)
```

Read the word *discard* every time. If there is any doubt, `git diff` first, or
`git stash` instead — stash is a recoverable version of the same operation.

### Restoring a file from another commit

```bash
git restore --source=HEAD~3 src/config.js    # the version three commits ago
git restore --source=main -- src/            # main's version of a whole directory
```

This is how you recover a single file without touching anything else. The result
lands in your working tree as an uncommitted change, so you can look at it before
deciding.

`--source` also accepts the merge-base shortcut: `<rev-A>...<rev-B>` means the
merge base of the two, and leaving one side out defaults it to HEAD — the same
three-dot idea as [`git diff`](04-git-diff.md).

### `-p` works here too

```bash
git restore -p <file>
```

Patch mode, hunk by hunk, exactly as in [`git add -p`](02-git-add/03-patch-mode.md)
— but discarding rather than staging. It is the right tool for "undo two of the
five changes I made to this file", and it is much safer than the whole-file form
because you see each hunk before it goes.

### During a conflict

`--ours` and `--theirs` select stage 2 or stage 3 for an unmerged path — the two
sides Git is holding in the index while a conflict is open (see
[the index](../phase-0-how-git-stores-things/05-the-index.md)). `-m` / `--merge`
recreates the conflicted state if you have already resolved it and want to start
over. Both only work when restoring **from the index**, not with `--source`.

Note the warning the manual attaches: during `git rebase` and `git pull --rebase`,
**ours and theirs may appear swapped**, because a rebase replays your commits on
top of theirs. That is not a bug and it catches everyone once.

## Which command, from the sentence you would say

| What you want to say | Command |
|---|---|
| "Take me to that branch" | `git switch <branch>` |
| "Start a new branch here" | `git switch -c <name>` |
| "Back to where I just was" | `git switch -` |
| "Unstage this, keep my edits" | `git restore --staged <file>` |
| "Throw away my edits to this file" | `git restore <file>` — **destructive** |
| "Throw away everything about this file" | `git restore --staged --worktree <file>` |
| "Get me the old version of this file" | `git restore --source=<commit> <file>` |
| "Undo some of my edits, not all" | `git restore -p <file>` |
| "Undo a whole commit" | Not this — `reset` or `revert`, [topic 08](08-undo-before-you-push.md) |

The last row is the boundary. `restore` operates on **paths**; it never moves
HEAD and never touches a branch pointer. Anything that changes which commit your
branch points at is `reset`, `revert` or `switch`.

## Trade-off

**The split traded one memorable command for two unambiguous ones, and left a
decade of documentation pointing at the wrong one.**

`git checkout` is genuinely fewer things to remember, and it is what every
StackOverflow answer, every older tutorial and most colleagues still say. Someone
who only learns `switch` and `restore` will still have to *read* `checkout` fluently
for years.

What the split buys is that the dangerous operation now has its own name. Under
`checkout`, "move me to `main`" and "destroy my edits to `main.py`" were the same
verb distinguished by an argument, and the failure was silent and total.
`git restore` cannot be typed by accident when you meant to switch branch.

That is worth the transition cost, and the transition is cheap: use the new
commands, read the old one. There is no need to convert anything, and no reason
to argue with a colleague who types `checkout` — it is not deprecated and does
not appear to be going anywhere.

## Gotchas

**Symptom:** `git restore <file>` and your last hour of edits is gone
**Cause:** it overwrites the working tree from the index — and unstaged, uncommitted content is not in the object store, so the reflog has nothing to offer
**Fix:** none reliably. Check your editor's local history. Then adopt `git stash` for "get this out of the way" and reserve `restore` for changes you have looked at with `git diff`

**Symptom:** `git switch` refuses with "your local changes would be overwritten"
**Cause:** the target branch has a different version of a file you have edited; Git aborts rather than losing work
**Fix:** `git stash`, switch, `git stash pop` — or commit. `--discard-changes` throws them away; `--merge` carries them across with a possible conflict

**Symptom:** you ran `git restore --staged <file>` and expected the file to revert
**Cause:** that restores the **index** from HEAD — it unstages. Your working-tree edits are untouched by design
**Fix:** add `--worktree` to do both, if that is really what you want

**Symptom:** `git switch -C` moved a branch someone else was using
**Cause:** uppercase `-C` creates **or resets** an existing branch to your current commit
**Fix:** use `-c`, which fails if the name exists. Recover the moved branch from `git reflog`

**Symptom:** `--ours` gave you their version during a rebase
**Cause:** documented behaviour — during `rebase` and `pull --rebase`, ours and theirs appear swapped, because your commits are being replayed onto theirs
**Fix:** check with `git diff` before resolving. In a rebase, "ours" is the branch you are replaying *onto*

**Symptom:** `git restore --ours <file>` fails with a message about tree-ish
**Cause:** `--ours` / `--theirs` / `--merge` only work restoring from the index, not with `--source`
**Fix:** drop `--source`. Those flags exist to pick between the conflict stages the index is holding

## Interview questions

**★ Why did Git split `checkout` into `switch` and `restore`?**
Because `checkout` did two unrelated jobs — move `HEAD` to another branch, and
overwrite file content from some version — and the two were distinguished only by
the argument. `git checkout main` and `git checkout main.py` differ by a file
extension and do completely different things, one of them destructive and silent.
The new commands cannot be confused: `switch` only moves between branches,
`restore` only overwrites paths and never touches a branch pointer. `checkout` is
not deprecated, so the practical advice is to type the new ones and be able to
read the old one, which every pre-2019 tutorial and most colleagues still use.

**★ Does `git switch` need a clean working tree?**
No — the manual says switching branches does not require a clean index and working
tree, so uncommitted changes come with you. What it will not do is lose them: if
the target branch has a different version of a file you have edited, the operation
is *aborted* rather than completed, unless you explicitly pass `--discard-changes`
or `--merge`. That abort is the real safety improvement over `checkout`, which was
more willing to do damage when given a path.

**★ `git restore <file>` just destroyed an hour of edits. Can the reflog get them
back?**
No, and this is the sharp edge of the command. The reflog records where branches
and `HEAD` have pointed, so it protects *commits*. Unstaged, uncommitted content
was never written to the object store, so there is nothing for it to point at. Had
the content been staged, a blob would exist and `git fsck --lost-found` might find
it. The lesson is not to memorise a recovery command but to prefer `git stash`,
which is the recoverable version of the same operation, and to read the word
*discard* in the hint `git status` prints.

**★ What is the difference between `git restore f`, `git restore --staged f` and
`git restore --staged --worktree f`?**
They differ in source and target. Bare `restore` copies the *index* over the
working tree, discarding unstaged edits — destructive. `--staged` copies `HEAD`
over the *index*, which unstages while leaving your working-tree edits untouched.
Both flags together copies `HEAD` over both, wiping the path entirely. The rule
behind it: `-W`/`-S` choose the restore *location* and default to the working
tree, while the *source* defaults to the index unless `--staged` is given, in which
case it defaults to `HEAD`.

**★ How do you recover one file from an old commit without disturbing anything
else?**
`git restore --source=<commit> <path>`. The old version lands in your working tree
as an uncommitted change, so you can read it, diff it and decide before anything is
permanent — and nothing about `HEAD`, the branch or other files moves.
`--source` also takes the merge-base form `<a>...<b>`, the same three-dot idea as
`git diff`, which is how you get "the version as of where this branch diverged".

**★ During a rebase, `--ours` gave you the other side's version. Is that a bug?**
No, it is documented: during `git rebase` and `git pull --rebase`, *ours* and
*theirs* appear swapped, because a rebase replays *your* commits on top of the
other branch — so the branch being replayed onto is "ours" and your own commit is
"theirs". It catches everyone once. The defence is to run `git diff` on the
conflicted path before choosing a side rather than trusting the label, and to
remember that these flags select conflict stages held in the index, which is why
they cannot be combined with `--source`.

**When is `git switch -C` the wrong command?**
Almost always, unless you know the branch name is free or yours. Lowercase `-c`
creates a branch and fails if the name exists; uppercase `-C` creates **or resets**
an existing branch to your current commit — so a name collision silently moves
somebody else's branch pointer. Recovery is via that branch's reflog, but the
better habit is to use `-c` and let the failure tell you the name is taken.

---

← Prev: [Ignoring does not untrack](06-ignoring-does-not-untrack.md) · Next → [Undo before you push](08-undo-before-you-push.md)
