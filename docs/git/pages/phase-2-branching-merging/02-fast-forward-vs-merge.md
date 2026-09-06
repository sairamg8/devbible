---
title: "Fast-forward versus a real merge"
sidebar_label: "02 · Fast-forward vs merge"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against **git 2.55.0** — `man git-merge` (DESCRIPTION, the
> `--ff` / `--no-ff` / `--ff-only` options), `man git-config` (`merge.ff`,
> `pull.ff`). **Documentation-validated, not sandbox-proven.**

**Git has two ways to incorporate a branch. If your branch has not moved since the
other one left, Git can just slide the pointer forward — no new commit, no merge.
Otherwise it must build a commit with two parents. Which one happens is decided by
the graph, not by you, and every `--ff` flag is about overriding that.**

## Fast-forward: no merge at all

```text
before                      after `git merge feature`

  A---B---C main              A---B---C---D---E main, feature
           \                                    ↑ main just moved here
            D---E feature
```

`main` is an **ancestor** of `feature`, so there is nothing to reconcile. Git
moves `main`'s pointer to `feature`'s tip and stops. No new commit exists, no
merge is recorded, and afterwards there is no evidence a branch was ever involved.

That is the default whenever it is possible.

## A real merge: two parents

```text
before                      after `git merge feature`

  A---B---C---F main          A---B---C---F---M main
           \                           \     /
            D---E feature               D---E feature
```

`main` moved on (commit `F`) while `feature` was being written, so neither tip is
an ancestor of the other. Git computes the **merge base** — their common
ancestor, `C` — compares both sides against it, and records the result as commit
`M` with **two parents**.

The manual states what `M` holds: the result *"along with the names of the two
parent commits and a log message from the user describing the changes"*. Before
the operation Git sets `ORIG_HEAD` to your previous tip, which is your one-step
undo ([undo before you push](../phase-1-everyday-loop/08-undo-before-you-push.md)).

## Forcing the choice

| Flag | Behaviour |
|---|---|
| `--ff` | Fast-forward when possible, otherwise merge. **The default** |
| `--no-ff` | **Always** create a merge commit, even when a fast-forward was possible |
| `--ff-only` | Fast-forward, or **fail**. Never create a merge commit |

`--no-ff` is the interesting one. It preserves the fact that a branch existed:
the merge commit groups its commits visibly, `git log --graph` shows the branch
shape, and reverting the whole feature is one `git revert -m 1` rather than five
separate reverts.

The cost is a merge commit for every branch, including the one-commit typo fix,
and a history where the graph is mostly bookkeeping.

`--ff-only` is the other useful one, and it is the right default for **pulling**:
it guarantees Git never silently creates a merge commit you did not ask for. If
it fails, you have diverged and should decide deliberately — that is Phase 4's
divergent-branches topic.

```bash
git config --global pull.ff only     # never auto-merge on pull
git config merge.ff false            # this repo always records merges
```

## Which policy, and when

| Policy | Good for | The cost |
|---|---|---|
| Default (`--ff` where possible) | Small teams, short branches | Merged branches leave no trace once fast-forwarded |
| `--no-ff` always | Teams that want feature boundaries visible in history | Noisy graph; a merge commit per trivial change |
| `--ff-only` on pull, explicit merges otherwise | Most people, most of the time | You must handle divergence yourself, deliberately |

Hosts complicate this: GitHub's "Merge pull request" button is `--no-ff`, "Squash
and merge" produces a single new commit with no ancestry link to the branch, and
"Rebase and merge" replays commits and then fast-forwards. Which button your team
presses matters more than your local `merge.ff` setting, and it is a team decision
— parked with the team-workflow phase.

## The message, and `--no-commit`

A merge opens your editor with a default message (`Merge branch 'feature'`) unless
it fast-forwards. Options worth knowing:

```bash
git merge --no-edit feature      # accept the default message
git merge -m "..." feature       # supply one
git merge --no-commit feature    # do the merge, stop before committing
```

`--no-commit` leaves the merged result staged so you can inspect or adjust it. It
is also the state a conflicted merge leaves you in, which is
[topic 04](04-resolving-conflicts.md).

## Merging with a dirty working tree

The manual attaches an explicit warning:

> Running `git merge` with **non-trivial uncommitted changes is discouraged**:
> while possible, it may leave you in a state that is hard to back out of in the
> case of a conflict.

And it is specific about why: `git merge --abort` tries to reconstruct the
pre-merge state, but *"if there were uncommitted changes when the merge started
(and especially if those changes were further modified after the merge was
started), `git merge --abort` will in some cases be unable to reconstruct the
original"*.

So the rule is simple and worth following without exception: **commit or stash
before merging.** A merge is one of the few Git operations whose undo is
best-effort rather than guaranteed.

## Checking what a merge will do, first

```bash
git log --oneline --graph --decorate main feature   # see the shape
git merge --no-commit --no-ff feature               # stage it, look, then decide
git merge --abort                                   # ...or back out
git diff main...feature                             # what the branch actually adds
```

`git merge-base main feature` prints the common ancestor if you want to see
exactly what Git will compare against.

## Trade-off

**Fast-forward gives you a clean linear history and throws away the information
that a branch existed.**

After a fast-forward, `main` contains the branch's commits in a straight line.
There is nothing in the graph saying which five commits were one feature, no
single commit to revert, and no record that a review happened. For a two-commit
fix, none of that is a loss. For a fortnight of work, it can be.

`--no-ff` keeps that information at the cost of a merge commit whose only content
is bookkeeping. In a busy repository the graph becomes a braid, and `git log
--graph` becomes hard to read for exactly the reason the flag was meant to help
with.

There is no universally right answer, and the genuinely useful position is
narrower than the usual argument: **be consistent within a repository, and make
the decision at the point of merge rather than by accident.** `pull.ff only` is
the one setting that is defensible everywhere, because its failure mode is a
message telling you to think, rather than a merge commit you never intended.

## Gotchas

**Symptom:** you merged and no merge commit appeared
**Cause:** it fast-forwarded — your branch was an ancestor, so there was nothing to reconcile
**Fix:** working as designed. Use `--no-ff` if you want the branch boundary recorded

**Symptom:** `git pull` created a merge commit you did not want
**Cause:** the default pull merges when branches have diverged
**Fix:** `git config --global pull.ff only`. It fails instead, and you choose merge or rebase deliberately

**Symptom:** a conflicted merge, `git merge --abort`, and your uncommitted work is mangled
**Cause:** documented — `--abort` cannot always reconstruct pre-merge uncommitted changes, especially if they were modified during the merge
**Fix:** none afterwards. Always commit or stash before merging; the manual explicitly discourages merging with a dirty tree

**Symptom:** `--ff-only` failed with "not possible to fast-forward"
**Cause:** the branches have diverged — both have commits the other lacks
**Fix:** that is the flag doing its job. Decide: `git merge`, or `git rebase`, or fetch first and look at `git log main..feature` and `feature..main`

**Symptom:** `git branch -d` refuses after the host's "Squash and merge"
**Cause:** squash creates a new commit with no ancestry link, so the branch is not reachable and not "merged" in Git's sense
**Fix:** `-D`, after confirming the change is in `main`. See [a branch is a pointer](01-a-branch-is-a-pointer.md)

## Interview questions

**★ What decides whether a merge fast-forwards?**
The graph, not you. If your branch's tip is an **ancestor** of the branch you are
merging, there is nothing to reconcile — Git slides the pointer forward, creates no
commit, and records nothing. If both sides have commits the other lacks, neither
tip is an ancestor of the other, so Git computes the merge base, compares both
sides against it and writes a commit with **two parents**. Every `--ff` flag is
about overriding what the graph would otherwise decide.

**★ What does `--no-ff` buy, and what does it cost?**
It buys the information that a branch existed. The merge commit groups the branch's
commits visibly, `git log --graph` shows the shape, and reverting the whole feature
becomes one `git revert -m 1` rather than five separate reverts. The cost is a
merge commit for every branch including the one-commit typo fix, so in a busy
repository the graph turns into a braid that is hard to read for exactly the reason
you enabled the flag. For a fortnight of work it is worth it; for a two-commit fix
it is bookkeeping.

**★ Which merge setting is defensible in every repository, and why?**
`pull.ff only`. It guarantees that `git pull` never silently creates a merge commit
you did not ask for: if the branches have diverged, it fails and you decide
between merging and rebasing deliberately. Its failure mode is a message telling
you to think, which is the property that makes it safe to recommend without knowing
anything about the team. Every other choice — always `--no-ff`, always fast-forward
— is a taste question that should be settled per repository and applied
consistently.

**★ Why does the manual discourage merging with a dirty working tree?**
Because the undo is best-effort. `git merge --abort` tries to reconstruct the
pre-merge state, and the documentation says plainly that if there were uncommitted
changes when the merge started — especially if they were further modified during
it — `--abort` will in some cases be unable to reconstruct the original. A merge is
one of the few Git operations whose undo is not guaranteed, so the rule is to
commit or stash first, without exception. `ORIG_HEAD` still points at your previous
tip, but that recovers *commits*, not uncommitted work.

**★ How do you look at a merge before committing to it?**
`git merge --no-commit --no-ff <branch>` performs the merge and stops with the
result staged, so you can read it, test it, adjust it, or run `git merge --abort`.
Before that, `git diff main...feature` shows what the branch actually adds — the
three-dot form, measured from the merge base — and
`git log --oneline --graph --decorate main feature` shows the shape you are about
to change. `git merge-base main feature` prints the exact commit Git will compare
against, if you want to check your mental model.

**Why does a host's "Squash and merge" break `git branch -d`?**
Because squashing produces a single new commit whose content matches the branch but
whose ancestry does not include it. Git's "fully merged" test is reachability, so
the branch tip is not an ancestor of `main` and `-d` refuses even though the change
is unquestionably in. `-D` is the right answer once you have confirmed the content
landed. It is worth knowing which button your team presses — merge, squash, or
rebase-and-merge — because that choice governs your history far more than any local
`merge.ff` setting.

---

← Prev: [A branch is a moving pointer](01-a-branch-is-a-pointer.md) · Next → [The three-way merge and the merge base](03-three-way-merge.md)
