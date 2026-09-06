---
title: "The rule about rewriting shared history"
sidebar_label: "08 · Never rewrite shared history"
sidebar_position: 8
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against **git 2.55.0** — `man git-rebase` §RECOVERING FROM
> UPSTREAM REBASE, `man git-push` (`--force-with-lease`, `--force-if-includes`),
> `man git-commit` (`--amend`'s warning). **Documentation-validated, not
> sandbox-proven.**

**Do not rewrite commits that anyone else has. Not rebase, not amend, not reset
and force-push. The rule is absolute in practice, and the reason is mechanical
rather than cultural: your rewrite does not update their repository, so their next
pull tries to merge two versions of the same work and succeeds — producing
duplicates nobody notices until later.**

## What "shared" means precisely

**Shared = someone else's repository contains these commits.** That is it. Not
"the branch is important", not "it is on `main`".

| Situation | Shared? |
|---|---|
| Committed locally, never pushed | **No** — rewrite freely |
| Pushed to your own feature branch, nobody else fetched it | Technically no. In practice, treat as yes if anyone might have |
| Pushed, and a colleague has pulled it | **Yes** |
| Pushed, and CI or a bot has cloned it | **Yes**, in the same mechanical sense |
| `main`, or any long-lived shared branch | **Yes, permanently** |

The middle row is the honest grey area. You cannot tell from your machine whether
anyone fetched. The practical convention — one worth adopting rather than
deriving — is that **your own feature branch is yours to rewrite until it is
under review**, and after that you add commits instead.

## What actually goes wrong

You rebase and force-push. Your colleague, who has the old commits, runs
`git pull`:

1. Their branch still points at the **old** commits. The remote now has the
   **new** ones.
2. Neither is an ancestor of the other, so Git sees a divergence.
3. A default `pull` **merges** them — and it merges cleanly, because the two sides
   contain the same changes with different hashes.
4. Their branch now contains **both copies** of every rewritten commit.
5. They push, and the duplicates are back on the remote.

Nothing errors. The failure is silent and it *restores the very commits you
rewrote*, which is why "I removed a secret with a rebase" is not a fix — the
manual devotes a whole section, RECOVERING FROM UPSTREAM REBASE, to cleaning up
after exactly this.

The recovery, for someone on the receiving end:

```bash
git fetch
git rebase --onto origin/feature <old-upstream> feature
```

or, if they have no local work worth keeping:

```bash
git fetch && git reset --hard origin/feature   # discards their local commits
```

Both require them to know a rewrite happened. **Tell people.** A message before
force-pushing turns a confusing afternoon into a one-line instruction.

## `--force-with-lease`, not `--force`

When you legitimately rewrite your own branch, the push has to be forced. Which
force matters:

| Command | Behaviour |
|---|---|
| `git push --force` | Overwrite the remote branch **whatever is there** |
| `git push --force-with-lease` | Overwrite **only if** the remote is still where you last saw it |

`--force-with-lease` checks the remote-tracking ref against the actual remote and
**refuses** if someone else pushed in the meantime. It converts "I silently
destroyed a colleague's commit" into an error message.

There is no reason to type plain `--force` in normal work. Alias the safe one:

```bash
git config --global alias.pushf 'push --force-with-lease'
```

### The hole in the lease, and `--force-if-includes`

`--force-with-lease` compares against your **remote-tracking ref** — which a bare
`git fetch` updates without touching your branch. So this sequence defeats it:

1. A colleague pushes to the branch.
2. You run `git fetch` (or your editor does, automatically, in the background).
3. Your `origin/feature` now matches the remote, so the lease check passes.
4. You force-push and destroy their commit anyway.

`--force-if-includes` closes it: it additionally requires that the commits you are
about to overwrite are **reachable from your own branch** — i.e. that you actually
integrated them rather than merely fetching them.

```bash
git push --force-with-lease --force-if-includes
```

This is worth knowing because background fetching is on by default in most
editors, so the naive lease is weaker than it looks.

## Amend counts too

`git commit --amend` creates a **new commit**
([`git commit`](../phase-1-everyday-loop/03-git-commit.md)). Amending a pushed
commit is a rewrite of shared history at a scale of one, with exactly the same
consequences and the same need for a forced push.

`git reset --hard` followed by a push is the same story again. There is no
rewriting operation that escapes the rule; the list is just rebase, amend, reset
and `filter-*`.

## The alternative that is always safe

```bash
git revert <commit>
```

`revert` creates a **new commit that undoes an old one**. History is unchanged, no
force-push is needed, everyone's clone stays valid, and the record of what
happened — including the mistake — remains true.

It is the correct answer for anything already shared, and the reason "undo" splits
into two commands rather than one. Phase 5 covers it, including `revert -m 1` for
undoing a merge.

## Trade-off

**The rule costs you a tidy history in exactly the cases where you most want one,
and it is still the right rule.**

The temptation is real: a bad commit message on `main`, a `console.log` in a
pushed commit, a wrong author on a commit from last week. Each is a two-second
rebase and a force-push, and each would leave the history genuinely better.

What you cannot see from your terminal is the blast radius. Every clone, every
open branch based on that commit, every CI cache, every fork, and every colleague
who is about to run `pull` — all of them have the old version, and none of them
gets updated by your push. The cost is not proportional to the size of your fix;
it is proportional to how many people have the branch, which is exactly the number
you cannot measure.

So the asymmetry decides it: rewriting a private branch is free and reversible,
rewriting a shared one is expensive and reversible only by everyone else doing
work. `git revert` is uglier and always safe. Take the ugly one, and spend your
rewriting budget on branches nobody has seen — which is what
[interactive rebase](07-interactive-rebase.md) is for.

## Gotchas

**Symptom:** duplicate commits appeared on the branch after someone rebased it
**Cause:** a colleague's `pull` merged the old and new versions, which merge cleanly because they contain the same changes
**Fix:** `git rebase --onto origin/<branch> <old-upstream> <branch>` per the manual's RECOVERING FROM UPSTREAM REBASE, or reset hard to the remote if they have no local work

**Symptom:** `--force-with-lease` still destroyed a colleague's commit
**Cause:** something ran `git fetch` — often the editor, in the background — which updated the remote-tracking ref and satisfied the lease
**Fix:** add `--force-if-includes`, which also requires those commits to be reachable from your branch

**Symptom:** your force-push was rejected by the host
**Cause:** branch protection, which is a host feature and independent of Git
**Fix:** it is working. Use `git revert` for a protected branch

**Symptom:** you amended a pushed commit and now `push` is rejected as non-fast-forward
**Cause:** amend creates a new commit; the remote still has the original, which your branch no longer contains
**Fix:** if the branch is genuinely yours, `--force-with-lease`. If not, `git revert` and add the correction as a new commit

**Symptom:** a rewrite to remove a secret, and the secret came back
**Cause:** someone else's clone still had it and pushed it back — or a fork, or a CI cache, or the host's own reflog
**Fix:** rotate the credential. That is the only step that actually resolves it; rewriting history never was

## Interview questions

**★ What does "shared" mean, precisely?**
That someone else's repository contains these commits. Not that the branch is
important, not that it is `main`. Committed locally and never pushed is not shared;
pushed and pulled by a colleague is; pushed and cloned by CI or a bot is, in exactly
the same mechanical sense. The honest grey area is your own pushed feature branch
that nobody may have fetched — you cannot tell from your machine, so the workable
convention is that your branch is yours to rewrite until it is under review, and
after that you add commits instead of rewriting them.

**★ Walk through what actually goes wrong when you rewrite shared history.**
You rebase and force-push. Your colleague still holds the old commits, so their
branch and the remote have diverged with neither an ancestor of the other. A default
`pull` merges them — and it merges **cleanly**, because both sides contain the same
changes under different hashes. Their branch now holds two copies of every rewritten
commit, they push, and the duplicates are back on the remote. Nothing errors at any
point, and the net effect is that your rewrite was undone by someone else's routine
pull. That is why the manual has a section called RECOVERING FROM UPSTREAM REBASE.

**★ Why `--force-with-lease` instead of `--force`?**
`--force` overwrites the remote branch whatever is there, including a colleague's
commit pushed thirty seconds ago. `--force-with-lease` overwrites **only if** the
remote is still where your remote-tracking ref last saw it, and refuses otherwise —
it converts silent destruction into an error message. There is no reason to type
plain `--force` in normal work; alias the safe one.

**★ How can `--force-with-lease` still destroy a colleague's commit?**
Because the lease compares against your **remote-tracking ref**, and a bare
`git fetch` updates that ref without touching your branch. So: they push, your
editor fetches in the background, your `origin/feature` now matches the remote, the
lease check passes, and your force-push overwrites their work. `--force-if-includes`
closes the hole by additionally requiring that the commits you are about to
overwrite are reachable from your own branch — that you actually integrated them
rather than merely fetching them. Background fetching is on by default in most
editors, so the naive lease is weaker than it looks.

**★ Is `git commit --amend` a rewrite of shared history?**
Yes, at a scale of one. Amend does not edit a commit; it creates a new one and moves
the branch, so amending something already pushed has exactly the consequences above
and needs a forced push. The same is true of `reset --hard` plus a push and of the
`filter-*` family. There is no rewriting operation that escapes the rule — the list
is simply rebase, amend, reset and filter.

**★ You rewrote history to remove a secret and the secret came back. Why?**
Because someone else's clone still had it and pushed it back — or a fork did, or a
CI cache, or the host's own reflog kept the unreferenced commit reachable by URL.
Rewriting only changes what *your* repository points at; it cannot un-copy what has
already been distributed. The step that actually resolves the incident is rotating
the credential, and it should come first, before any history surgery.

**What is the always-safe alternative, and why is taking the ugly option correct?**
`git revert`, which adds a new commit undoing an old one: history is unchanged, no
force-push is needed, every clone stays valid, and the record — including the
mistake — stays true. The asymmetry is what decides it. Rewriting a private branch is
free and reversible by you alone; rewriting a shared one is expensive and reversible
only by everyone else doing work, and its cost scales with how many people hold the
branch, which is the one number you cannot measure from your terminal.

---

← Prev: [Interactive rebase](07-interactive-rebase.md) · Next → [`git reflog` as the safety net](09-reflog.md)
