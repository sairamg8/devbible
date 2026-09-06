---
title: "Undoing a merge"
sidebar_label: "07 · Undoing a merge"
sidebar_position: 7
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against **git 2.55.0** — `man git-revert` (`-m`),
> `man git-merge` (`--abort`, `ORIG_HEAD`), `man git-reset`.
> **Documentation-validated, not sandbox-proven.**

**Three different situations get called "undo the merge", and they need three
different commands. Which one you are in depends on how far the merge got: still
in progress, committed but local, or pushed. Getting this wrong is how a bad merge
becomes a bad week.**

## Which situation are you in?

| Where the merge got to | Command |
|---|---|
| Conflicted, **not yet committed** | `git merge --abort` |
| Committed, **not pushed** | `git reset --hard ORIG_HEAD` |
| **Pushed** | `git revert -m 1 <merge-commit>` |

`git status` tells you which — *"You have unmerged paths"* or *"All conflicts fixed
but you are still merging"* means the merge is in progress.

## In progress: `--abort`

```bash
git merge --abort
```

Returns to the pre-merge state. ⚠️ Reliable only if your working tree was clean
when the merge started — the manual states `--abort` *"will in some cases be unable
to reconstruct the original (pre-merge) changes"* when there were uncommitted
changes, especially if they were modified during the merge. That is the reason for
the commit-or-stash-before-merging rule.

## Committed but not pushed: `reset --hard ORIG_HEAD`

```bash
git reset --hard ORIG_HEAD
```

Git sets `ORIG_HEAD` to your branch tip before starting a merge, so this puts the
branch back exactly. If several operations have happened since, use the reflog:

```bash
git reflog
git reset --hard 'HEAD@{3}'
```

The merged-in commits are untouched — only your branch pointer moves. The other
branch still has all of them.

## Pushed: `revert -m 1`

```bash
git revert -m 1 <merge-commit>
```

A merge has two parents, so `-m` names which one is the **mainline**. Parent 1 is
the branch you were on when you merged — usually `main` — so `-m 1` means *"keep
main, remove what the branch brought in"*.

```bash
git log --pretty=%P -1 <merge-commit>   # confirm the parents and their order
```

`-m 2` is the rare inverse: keep the feature branch's side and undo main's. Almost
never what you want, and worth double-checking before running.

## The trap: reverting a merge does not un-merge it

This is the consequence that catches everyone, and it is worth stating precisely.

`git revert -m 1` undoes the merge's **changes**. It does not remove the merge
**commit**, so in Git's model that branch is still merged — its commits are
ancestors of `main`.

Merge the branch again after fixing it, and only the commits made **after the
revert** come in. Everything from the original merge is treated as already
present, so the fixed feature arrives half-missing and nothing errors.

### The fix

```bash
git revert <the-revert-commit>     # revert the revert — restores the changes
# then merge the new work on top
```

Reverting a revert sounds absurd and is the correct, documented answer. The
resulting history is: merge → revert → revert-of-revert → new work. Ugly, honest,
and it works.

The alternative, when the branch is being reworked substantially, is to build the
fixed work on a **new branch** from current `main` rather than reusing the old one.
That sidesteps the ancestry problem entirely and is usually cleaner than the
double revert.

## Choosing between them, in advance

| You want | Do |
|---|---|
| The branch to come back later, fixed | `revert -m 1`, and remember the double-revert requirement |
| The branch abandoned entirely | `revert -m 1`, and do not merge it again |
| The merge never to have happened, and nobody has seen it | `reset --hard ORIG_HEAD` |
| To keep the merge but undo one commit inside it | `git revert <that commit>` — not the merge |

That last row is worth noticing. If a merge brought in five commits and one is
bad, reverting the **merge** removes all five. Reverting the single commit is
usually what you meant, and it has none of the ancestry consequences.

## Trade-off

**Merge commits record something true — two lines of work joined — and that record
is exactly what makes them awkward to undo.**

A normal commit's inverse is a well-defined patch. A merge commit's is not, until
you say which parent counts as the baseline; hence `-m`. And even then, undoing the
*changes* cannot undo the *ancestry*, because the ancestry is the thing the merge
commit exists to record. Git will not lie about the graph, so it leaves you with a
merge that happened, changes that are gone, and a branch it still considers merged.

The alternative designs are worse. Removing the merge commit outright is a rewrite,
with all the shared-history consequences; pretending the branch was never merged
would make the graph false. Git chose truth, and the double revert is the price.

The practical response is preventative and cheap: **look before you merge.**
`git diff main...feature` and `git log main..feature` cost two seconds and prevent
nearly every merge anyone ends up reverting. And for anything under review, the
host's merge button plus a required approval is a stronger guard than any command
on this page.

## Gotchas

**Symptom:** you reverted a merge, fixed the branch, merged again — and most changes are missing
**Cause:** the merge commit remains in history, so those commits are still ancestors; only post-revert work comes in
**Fix:** revert the revert, then merge the new work. Or build the fix on a fresh branch from current `main`

**Symptom:** `git revert <merge>` fails with "is a merge but no -m option was given"
**Cause:** Git cannot guess which parent is the mainline
**Fix:** `git revert -m 1 <merge>`. Confirm parent order with `git log --pretty=%P -1 <merge>`

**Symptom:** `-m 2` produced the opposite of what you wanted
**Cause:** parent 2 is the merged-in branch; `-m 2` keeps *its* side and undoes main's
**Fix:** `git reset --hard ORIG_HEAD` if unpushed, or revert the revert. Use `-m 1` in almost every case

**Symptom:** `git merge --abort` left the working tree odd
**Cause:** there were uncommitted changes when the merge began, which `--abort` cannot always reconstruct
**Fix:** `git reflog` and reset to the pre-merge commit. Commit or stash before merging in future

**Symptom:** you reverted a whole merge to remove one bad commit
**Cause:** reverting a merge removes everything it brought in
**Fix:** revert the individual commit instead — no `-m`, no ancestry consequences

**Symptom:** `reset --hard ORIG_HEAD` did not undo the merge
**Cause:** `ORIG_HEAD` holds only the most recent operation, and something has happened since
**Fix:** `git reflog` and reset to the entry before the merge

## Interview questions

**★ Three situations get called "undo the merge". What are they and which command
does each need?**
A merge that is conflicted and **not yet committed** is `git merge --abort`. A merge
that is **committed but not pushed** is `git reset --hard ORIG_HEAD`, since Git sets
`ORIG_HEAD` to your tip before starting. A merge that is **pushed** is
`git revert -m 1 <merge>`. `git status` tells you which of the first two you are in —
*"You have unmerged paths"* or *"All conflicts fixed but you are still merging"* means
the merge is still in progress and has not been recorded.

**★ Why does reverting a merge need `-m`, and what does `-m 2` do?**
A merge commit has two parents, so its inverse is undefined until you say which side
is the baseline. `-m 1` names parent 1 — the branch you were on when you merged,
normally `main` — so it means "keep main, remove what the branch brought in". `-m 2`
is the inverse: keep the feature branch's side and undo main's, which is almost never
wanted and worth double-checking before running. `git log --pretty=%P -1 <merge>`
prints the parents in order if you want to confirm rather than assume.

**★ Why does reverting a merge not un-merge the branch?**
Because it undoes the merge's **changes**, not the merge **commit** — which stays in
history, so those commits remain ancestors of `main` and Git still considers the
branch merged. Merge it again after fixing it and only the commits made *after the
revert* arrive; everything from the original merge is treated as already present, the
feature lands half-missing, and nothing errors. The documented fix is to revert the
revert, restoring the changes, and then merge the new work on top. The cleaner
alternative for a substantial rework is to build it on a fresh branch from current
`main`, which sidesteps the ancestry problem entirely.

**★ A merge brought in five commits and one of them is bad. What do you revert?**
The single commit, not the merge. Reverting the merge removes all five and drags in
the whole `-m` and ancestry problem; reverting one commit is an ordinary revert with
none of those consequences. It is the row people skip in the decision table, and it
is usually what "undo the merge" actually meant.

**Why can Git not simply make a merge disappear?**
Because the ancestry is the thing a merge commit exists to record, and Git will not
falsify the graph. Removing the merge commit outright is a rewrite, with every
shared-history consequence that carries; pretending the branch was never merged would
make the graph a lie. So Git undoes the changes, keeps the ancestry, and leaves you
with a merge that happened, changes that are gone, and a branch it still considers
merged — with the double revert as the price. The cheap preventative is to look
before merging: `git diff main...feature` and `git log main..feature` cost two
seconds and prevent nearly every merge anyone ends up reverting.

---

← Prev: [Recovering a deleted branch](06-recovering-a-branch.md) · Next → [Undoing something already pushed](08-undoing-something-pushed.md)
