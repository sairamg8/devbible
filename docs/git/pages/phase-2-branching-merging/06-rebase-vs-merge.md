---
title: "Rebase versus merge, decided on purpose"
sidebar_label: "06 · Rebase vs merge"
sidebar_position: 6
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against **git 2.55.0** — `man git-merge`, `man git-rebase`
> (including RECOVERING FROM UPSTREAM REBASE), `man git-config` (`pull.rebase`,
> `pull.ff`). **Documentation-validated, not sandbox-proven.** The workflow
> recommendations below are stated as opinion where they are opinion.

**Both commands answer "my branch is behind, what now?" and they answer it
differently: merge records that two lines of work came together, rebase pretends
they never diverged. The technical difference is small. The consequential
difference is that one is always safe and the other has a precondition.**

## The difference in one table

| | `git merge main` | `git rebase main` |
|---|---|---|
| Your commits | Untouched | **Replaced** by new ones with new hashes |
| History shape | A graph with a merge commit | A straight line |
| Safe on pushed branches | **Always** | **No** — requires a force-push |
| Conflicts | Resolved **once** | Possibly once **per commit** |
| Preserves what actually happened | Yes | No — it invents a plausible order |
| Was each commit ever tested as it now exists | Yes | **No** |
| Undo | `git reset --hard ORIG_HEAD` | `git reset --hard ORIG_HEAD` |

The last-but-one row is under-appreciated and is the strongest argument against
rebasing habitually: a replayed commit is your change applied to a base it was
never written against, and only the tip usually gets tested.

## The decision

The question that settles it is not stylistic:

> **Has anyone else got these commits?**

| Situation | Do this |
|---|---|
| Local branch, never pushed | **Rebase** freely — tidy it however you like |
| Pushed, but it is your branch and nobody else works on it | **Rebase**, then `push --force-with-lease` |
| Pushed, and someone else has committed to it or based work on it | **Merge.** Do not rewrite |
| `main` or any shared long-lived branch | **Never rebase.** Not once |
| Updating your feature branch from `main` | Either — see below |
| Bringing a finished feature into `main` | Merge (or the host's button, which is a team decision) |

Everything else is preference. That row about shared branches is not.

## Updating a feature branch from `main`

This is the case people actually argue about, and both answers are defensible:

**`git merge main` into your branch** keeps your commits intact and resolves
conflicts once. The cost is merge commits accumulating in your branch, so the PR
diff includes "Merge branch 'main' into feature" noise and your commits are
interleaved with main's in date order.

**`git rebase main`** gives a clean branch that applies straight onto main, and a
PR that shows only your commits. The cost is a force-push each time and possibly
resolving the same conflicts repeatedly (mitigated by `rerere`).

The genuinely useful observation is that this only matters for **long-lived**
branches. A branch merged within a day or two rarely diverges enough for the
choice to have consequences. If the rebase-versus-merge decision feels important,
the branch has probably lived too long — and that is the actual problem.

## `git pull` is where this happens by accident

`git pull` is `fetch` plus **either** merge or rebase, and the default merges:

```bash
git config --global pull.ff only     # RECOMMENDED: fail on divergence, decide yourself
git config --global pull.rebase true # always rebase your local commits on pull
# (leaving both unset means merge, and a merge commit you did not ask for)
```

`pull.ff only` is the setting worth adopting: it fast-forwards when it can and
**fails** when your branch has diverged, so no merge commit ever appears without
your say-so. `ex1` recorded what happens with everything unset — a bare `pull` on
diverged branches fails with `fatal: Need to specify how to reconcile divergent
branches`, which is Git asking you to make exactly this choice once.

`pull.rebase true` is also reasonable, with one caveat: it rebases **your local
commits**, which is safe because they are local — but it makes rebasing automatic
rather than deliberate, and it is a surprise the first time it rewrites commits
you had already pushed to a shared branch.

## The third option: squash

The host's "Squash and merge" collapses a branch into a single commit on `main`.

It gives the tidiest possible `main` — one commit per feature, trivially
revertable — and it discards the branch's internal history entirely. It also
produces a commit with **no ancestry link** to the branch, which is why
`git branch -d` refuses afterwards and why the branch looks unmerged
([a branch is a pointer](01-a-branch-is-a-pointer.md)).

Whether to use it is a team decision, and it belongs with the parked team-workflow
phase. What is worth knowing here is the mechanism: squash is not a merge, and
Git will treat the branch as unmerged forever.

## Trade-off

**The choice is between history that is true and history that is readable, and
teams argue about it because both are legitimately valuable.**

A merge-based history is an accurate record: this work happened in parallel, and
here is where it came together. Nothing is invented, every commit is a commit that
existed and was tested in that form, and no operation ever requires a force-push.
The cost is that `git log --graph` on a busy repository becomes a braid, and
tracing what happened means following several strands.

A rebased history is a readable story: one thing after another, each commit
applying cleanly to the one before. `bisect` walks a line. Reviews show only your
changes. The cost is that the story is fiction — those commits never existed in
that order — and the operation that produces it is unsafe on anything shared.

The position worth holding, stated as opinion: **rebase is a private tidying tool,
merge is the public integration tool.** Rebase your own branch before anyone looks
at it; merge to bring work together. That gives most of the readability with none
of the social risk, and it makes the one rule that is not negotiable — never
rewrite what someone else has — easy to follow, because you stop rewriting the
moment the work becomes shared.

## Gotchas

**Symptom:** a colleague's branch broke after you rebased and force-pushed a shared branch
**Cause:** their branch is based on commits that no longer exist upstream
**Fix:** they follow the manual's RECOVERING FROM UPSTREAM REBASE procedure — usually `git rebase --onto <new-upstream> <old-upstream> <their-branch>`. Better: do not rewrite shared branches

**Symptom:** `git pull` created a merge commit you did not want
**Cause:** the default pull merges when the branch has diverged
**Fix:** `git config --global pull.ff only`, then choose merge or rebase deliberately when it fails

**Symptom:** your PR diff contains "Merge branch 'main' into feature" commits
**Cause:** you updated the branch by merging main into it repeatedly
**Fix:** cosmetic, not wrong. Rebase before review if the branch is yours alone; or merge less often by keeping branches short

**Symptom:** `git branch -d` refuses after a squash-merge
**Cause:** squash creates a commit with no ancestry link, so Git cannot see the branch as merged
**Fix:** confirm the change is in `main`, then `-D`

**Symptom:** `pull.rebase true` rewrote commits you had already pushed
**Cause:** it rebases your local commits on every pull, including ones already published to a shared branch
**Fix:** `pull.ff only` is the safer default. If you keep `pull.rebase`, know that a branch others share is not a branch to pull-rebase

---

← Prev: [`git rebase`](05-git-rebase.md) · Next → [Interactive rebase](07-interactive-rebase.md)
