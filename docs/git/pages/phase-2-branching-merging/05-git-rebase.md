---
title: "`git rebase` — replaying commits onto a new base"
sidebar_label: "05 · git rebase"
sidebar_position: 5
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against **git 2.55.0** — `man git-rebase` (DESCRIPTION,
> `--onto`, `--continue` / `--skip` / `--abort`, RECOVERING FROM UPSTREAM REBASE).
> **Documentation-validated, not sandbox-proven.**

**Rebase does not move commits. It takes the changes each commit introduced,
replays them one at a time on top of a different base, and creates a **new commit
for each** — new hashes, new committer dates, same authors. Everything about
rebase that surprises people follows from "new commit", including why you must not
do it to history someone else has.**

## What it does

```text
before                             after `git rebase main`

  A---B---C main                     A---B---C main
       \                                      \
        D---E feature                          D'---E' feature
```

`D'` and `E'` contain the same changes as `D` and `E`, applied on top of `C`
instead of `B`. They are **different commits** — different parents, therefore
different hashes. The originals still exist, unreferenced, until garbage
collection.

```bash
git switch feature
git rebase main            # replay feature's commits onto main's tip
git rebase --onto main x y # replay y's commits (excluding x's) onto main
```

The plain form is what you want 95% of the time: *"pretend I started this branch
from where main is now."*

## `--onto`, in the one situation it is needed

`--onto <newbase> <upstream> <branch>` replays the commits in
`<upstream>..<branch>` onto `<newbase>`. The case it exists for is a branch built
on another branch:

```text
  A---B main
       \
        C---D featureA
             \
              E---F featureB
```

`featureA` is merged and gone. You want `featureB` on `main`, without dragging
`C` and `D` along:

```bash
git rebase --onto main featureA featureB
```

Read it as: **replay onto `main`, everything after `featureA`, from `featureB`.**
Without `--onto`, a plain `git rebase main featureB` would try to replay `C`, `D`,
`E` and `F` — including two commits already in `main` under different hashes.

## When it stops

A rebase replays commits one at a time, so it can stop at any of them:

```bash
git rebase --continue    # I resolved it; carry on
git rebase --skip        # drop THIS commit entirely and continue
git rebase --abort       # put everything back
```

`--abort` restores the original branch and is completely reliable — the original
commits still exist and the branch pointer simply moves back.

⚠️ `--skip` **discards the commit being applied.** It is the right answer when the
change is already present upstream (so replaying it produces nothing), and the
wrong answer for a conflict you did not want to resolve. Read what you are
skipping first: `git show REBASE_HEAD`.

While stopped, `git status` names the state and how many commits are done —
*"You are currently rebasing branch 'x' on 'y'"* and `Last commands done (N
commands done)`.

**And remember the swap:** during a rebase, "ours" is the branch you are replaying
**onto** and "theirs" is your own commit. See
[resolving conflicts](04-resolving-conflicts.md).

## The same conflict, several times

A rebase of five commits can hit the same conflict five times, once per commit,
because each replay is independent. Two things help:

```bash
git config --global rerere.enabled true    # record and replay your resolutions
```

and rebasing more often, so there is less divergence to replay. `rerere` is the
single best reason to enable a non-default setting in Git.

## Why the hashes change, and what it costs

A commit's hash covers its tree, its **parents**, its author and committer fields
and its message ([object types](../phase-0-how-git-stores-things/03-object-types.md)).
Replaying changes the parent, so the hash must change. There is no way to rebase
and keep hashes.

Consequences:

- **Author and author date are preserved.** Committer and committer date are
  updated — which is why a rebased branch can look like it was all written today
  in `git log` unless you read `%ad` rather than `%cd`
  ([`git log`](../phase-1-everyday-loop/09-git-log.md)).
- **The old commits become unreachable**, and `git reflog` is how you get back to
  them.
- **Anyone else holding the old commits now has a divergent branch.** This is the
  entire content of [the rule about rewriting shared history](08-the-golden-rule.md),
  and the manual has a whole section called RECOVERING FROM UPSTREAM REBASE about
  cleaning up after someone does it to you.

## Undoing a rebase

```bash
git reset --hard ORIG_HEAD     # ORIG_HEAD is set before the rebase starts
git reflog                     # or find the pre-rebase tip and reset to it
```

Both work because the pre-rebase commits are still in the object store. This is
reliable and worth knowing before your first rebase rather than during it.

## `--update-refs`, for stacked branches

If you have branches pointing at intermediate commits of the branch you are
rebasing, they are left behind pointing at the **old**, now-abandoned commits:

```bash
git rebase --update-refs main
git config --global rebase.updateRefs true
```

With it on, Git moves those branch pointers to the replayed commits as it goes.
Without it, a stack of dependent branches silently detaches from the work — a
confusing enough failure that turning the config on is a reasonable default.

## Trade-off

**Rebase buys a history that reads as if the work happened in order, and pays for
it by making every commit new.**

The benefit is not aesthetic. A linear history means `git log` is a straight line
you can read, `git bisect` walks a sequence rather than a graph, and a feature's
commits sit together with their real content rather than being interleaved with
whatever else landed. Reviewing "what does this branch add" is exactly `git log
main..feature` with nothing extraneous.

The cost is that a rebased commit **was never actually built or tested in that
form**. `D'` is your change applied to a base it was never written against; the
tests you ran on `D` prove nothing about `D'`. Intermediate commits in a rebased
branch are especially suspect, because only the final one usually gets tested —
which quietly undermines the `bisect` argument used to justify rebasing.

And the sharp edge: it is the only everyday operation with a **social**
precondition. Merge is always safe. Rebase is safe only while you are the only
person holding the commits, and that condition is not something Git can check for
you.

The workable position: **rebase your own unpublished branch freely** to tidy it
before review, and **never rebase anything anyone else has**. Where the branch has
been pushed to a shared feature branch, merge instead — the ugliness of a merge
commit is cheaper than the cleanup the manual devotes a section to.

## Gotchas

**Symptom:** after rebasing, `git push` is rejected as non-fast-forward
**Cause:** your branch now consists of different commits; the remote still has the originals
**Fix:** `git push --force-with-lease` if the branch is yours alone. If others have it, you should not have rebased — Phase 4 covers the lease

**Symptom:** the same conflict appears repeatedly during one rebase
**Cause:** each commit is replayed independently, so each one hits the disagreement
**Fix:** `git config --global rerere.enabled true` and re-run. Longer term, rebase more often so there is less to replay

**Symptom:** `git rebase --skip` and a change vanished
**Cause:** `--skip` drops the commit being applied entirely. It is not "skip this conflict"
**Fix:** `git reflog` to find the pre-rebase tip and start again. Inspect with `git show REBASE_HEAD` before skipping

**Symptom:** every commit on the branch now shows today's date
**Cause:** the committer date was updated by the replay; the author date was preserved
**Fix:** read `%ad` — `git log --pretty=format:'%h %ad %s' --date=short`

**Symptom:** a dependent branch now points at commits that are not in your rebased branch
**Cause:** its pointer was left on the old, abandoned commits
**Fix:** `git rebase --update-refs`, or set `rebase.updateRefs true`. Recover the stranded branch with `git reflog`

**Symptom:** rebasing onto a branch pulled in commits already present
**Cause:** the wrong upstream — you needed `--onto` to exclude the commits from an intermediate branch
**Fix:** `git rebase --onto <newbase> <upstream> <branch>`, reading it as "onto X, everything after Y, from Z"

---

← Prev: [Resolving a conflict, properly](04-resolving-conflicts.md) · Next → [Rebase versus merge, decided on purpose](06-rebase-vs-merge.md)
