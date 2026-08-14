---
title: "Divergent branches"
sidebar_label: "05 · Divergent branches"
sidebar_position: 5
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against **git 2.55.0** — `man git-pull` (the divergence
> handling and `pull.rebase` / `pull.ff`), `man git-merge-base`. The exact
> `fatal:` message was recorded by `sandbox/git-p0/ex1-version-facts.sh` with
> `pull.rebase`, `pull.ff` and `push.default` all unset.
> **Documentation-validated, with one sandbox-proven message.**

**Divergence means both you and the remote have commits the other does not. It is
the normal outcome of two people working, it is not an error, and Git deliberately
refuses to guess what you want. This topic is the one that ends most daily
confusion about remotes.**

## What it looks like

```text
        C---D  origin/main   (someone else pushed)
       /
  A---B
       \
        E---F  main          (your commits)
```

Neither tip is an ancestor of the other. There is no fast-forward available;
something has to reconcile them.

`git status` says it plainly:

```text
Your branch and 'origin/main' have diverged,
and have 2 and 2 different commits each, respectively.
```

Read that carefully — **two numbers**, not one. "Behind by 2" alone is a
fast-forward; "2 and 2" is divergence and needs a decision.

## Git refuses to guess

With `pull.rebase`, `pull.ff` and `push.default` all unset, a bare `git pull` on
diverged branches **fails**:

```console
fatal: Need to specify how to reconcile divergent branches
```

<small>Recorded on git 2.55.0 by `sandbox/git-p0/ex1-version-facts.sh`, running in
a throwaway repository with the machine's global and system config neutralised —
so this is Git's behaviour, not this laptop's configuration.</small>

Git then prints the three settings you could choose. This refusal is a feature: it
turns a silent, consequential decision into a one-time explicit one.

## The three answers

| Choice | Result | When |
|---|---|---|
| **Merge** — `git merge origin/main` | A merge commit with both parents; nothing rewritten | Shared branch, or you want the true record |
| **Rebase** — `git rebase origin/main` | Your commits replayed on top; new hashes | Your own branch, and you want a linear history |
| **Discard yours** — `git reset --hard origin/main` | Your commits are gone from the branch | You genuinely do not want them. **Destructive** |

```bash
git config --global pull.ff only      # fail on divergence — decide each time
git config --global pull.rebase true  # always rebase
git config --global pull.rebase false # always merge
```

**`pull.ff only` is the recommendation.** It fast-forwards the common case (you
have no local commits) and stops when there is an actual decision, which is the
only time you want to be involved.

## Look before you choose

```bash
git fetch
git log --oneline HEAD..'@{u}'       # what they added
git log --oneline '@{u}'..HEAD       # what you added
git log --oneline --graph --decorate --all -20
```

Two seconds, and the choice is usually obvious: if your side is one small commit,
rebasing is trivial; if it is a week of work with merges in it, merge.

## When divergence is not what it looks like

**"Ahead 12, behind 12" with the same commit messages on both sides** is not
parallel work — it is someone having **rewritten** the branch. Your commits and
theirs are the same changes with different hashes.

Merging that produces **duplicates of every commit**, and it merges cleanly,
which is why nobody notices until later. This is exactly the failure described in
[the golden rule](../phase-2-branching-merging/08-the-golden-rule.md).

The fix is not to merge:

```bash
# if you have no unique local work:
git fetch && git reset --hard origin/main

# if you do have local commits worth keeping:
git rebase --onto origin/main <old-upstream-hash> main
```

The tell is the shape: real divergence has *different* commits on each side.
Rewrite-divergence has the same subjects on both sides.

## After a merge or rebase, push

Merging or rebasing changes only your local branch. The remote still has its
version until you push:

- After a **merge**, `git push` is an ordinary fast-forward.
- After a **rebase**, your branch no longer contains the remote's commits in the
  same form, so the push must be forced —
  `git push --force-with-lease --force-if-includes`
  ([force-pushing safely](06-force-pushing-safely.md)).

That asymmetry is the practical reason merge is the default answer on shared
branches: it never requires a force-push.

## Trade-off

**Git's refusal to guess is correct and lands the cost on the person least
prepared for it.**

There is no defensible default. Merging silently would add merge commits to
everyone's history without consent; rebasing silently would rewrite commits, which
is dangerous on shared branches; failing means someone meets a `fatal:` at the
exact moment they wanted to get on with something. Git chose to fail, and it is
the right call — the other two make an irreversible-ish choice on your behalf.

The residual cost is that the failure is met by someone who typed `git pull`
expecting "get latest", and the message names three config settings rather than
explaining the situation. The fix is to answer the question once, deliberately,
before it is asked in anger: **`pull.ff only`**, and then reach for `merge` or
`rebase` with the log in front of you.

And the deeper point: divergence is a **frequency** problem. Two people on the
same branch diverge constantly; two people on separate short-lived branches almost
never do. Most of what looks like a Git problem here is a branching-strategy
problem wearing Git's error message.

## Gotchas

**Symptom:** `fatal: Need to specify how to reconcile divergent branches`
**Cause:** branches diverged and none of `pull.ff`, `pull.rebase` is configured
**Fix:** `git config --global pull.ff only`, then `git merge origin/main` or `git rebase origin/main` deliberately

**Symptom:** `git pull` silently created a merge commit
**Cause:** `pull.rebase false`, explicitly or by default in older configurations
**Fix:** `git reset --hard ORIG_HEAD` to undo, then set `pull.ff only`

**Symptom:** ahead 12 / behind 12, with the same commit subjects on both sides
**Cause:** the branch was rewritten upstream — these are the same changes with new hashes, not parallel work
**Fix:** do **not** merge; it duplicates every commit. `git reset --hard origin/<branch>` if you have nothing unique, otherwise `git rebase --onto`

**Symptom:** you rebased onto the remote and now `push` is rejected
**Cause:** your branch was rewritten, so it is no longer a fast-forward of the remote
**Fix:** `git push --force-with-lease --force-if-includes`, and only if the branch is yours

**Symptom:** divergence on `main` every single morning
**Cause:** several people committing directly to a shared branch
**Fix:** a workflow problem, not a Git one. Short-lived feature branches diverge far less; `pull.ff only` at least makes each occurrence explicit

---

← Prev: [Upstream tracking](04-upstream-tracking.md) · Next → [Force-pushing safely](06-force-pushing-safely.md)
