---
title: "Force-pushing safely"
sidebar_label: "06 · Force-pushing safely"
sidebar_position: 6
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against **git 2.55.0** — `man git-push`
> (`--force`, `--force-with-lease`, `--force-if-includes`, and the note that
> `--force-if-includes` is enabled by default when `--force-with-lease` is given
> without an expected value). **Documentation-validated, not sandbox-proven.**

**A force-push replaces the remote branch with yours, discarding whatever was
there. `--force` does it unconditionally. `--force-with-lease` does it only if the
remote is where you last saw it. There is no reason to type the first one in
normal work, and the second has a hole worth knowing about.**

## Why a push gets rejected

```text
! [rejected]  main -> main (non-fast-forward)
```

Git refuses any push that would make the remote branch **lose commits** — that is,
where the remote tip is not an ancestor of what you are pushing. Three things
produce it:

| Cause | The right response |
|---|---|
| You rebased or amended | Force-push, **if the branch is yours** |
| Someone else pushed while you worked | `git fetch`, then merge or rebase. **Do not force** |
| You reset back to an earlier commit | Force-push, if that was deliberate and the branch is yours |

The distinction is everything: the first and third mean *my history is the correct
one*; the second means *I am about to delete someone's work*. The rejection
message is identical in all three cases, so the check is yours to make:

```bash
git fetch
git log --oneline HEAD..'@{u}'    # is there anything on the remote I do not have?
```

Empty output means nothing is lost by forcing. Non-empty means stop.

## `--force-with-lease`

```bash
git push --force-with-lease
```

The lease: overwrite the remote branch **only if it still points where my
remote-tracking ref says it does**. If someone pushed since your last fetch, the
push is rejected instead of overwriting them.

```text
! [rejected]  main -> main (stale info)
```

That message means "someone else pushed, go and look" — and it has just prevented
you from destroying their commit. Never work around it by switching to `--force`;
fetch and read what arrived.

## The hole, and `--force-if-includes`

`--force-with-lease` compares against your **remote-tracking ref**, and a bare
`git fetch` updates that without touching your branch. So:

1. A colleague pushes to the branch.
2. Something runs `git fetch` — your editor, in the background, without telling
   you.
3. `origin/feature` now matches the remote, so the lease check **passes**.
4. Your force-push destroys their commit anyway.

`--force-if-includes` closes it: it additionally requires that the commits you are
about to overwrite are **reachable from your branch** — that you actually
integrated them rather than merely downloaded them.

```bash
git push --force-with-lease --force-if-includes
```

The manual notes it is **enabled by default when `--force-with-lease` is given
without an explicit expected value**, which covers the common form. Spelling it
out costs nothing and removes the doubt.

Background fetching is on by default in most editors, so this is not a theoretical
concern.

## Make the safe one your default

```bash
git config --global alias.pushf 'push --force-with-lease --force-if-includes'
```

There is no config that redirects `--force` to the lease version, so an alias is
the practical answer. Type `git pushf` and never type `--force` again.

## When a force-push is legitimate

| Situation | Force? |
|---|---|
| Your own feature branch, after `rebase` or `--amend` | ✅ Yes, with a lease |
| Your own branch, cleaned up before review | ✅ Yes |
| A branch a colleague has also committed to | ❌ No — merge instead |
| A shared feature branch under review | ⚠️ Only after telling the reviewer |
| `main` or any protected branch | ❌ Never. Use `git revert` |

The middle rows are the judgement calls, and the deciding question is the one from
[the golden rule](../phase-2-branching-merging/08-the-golden-rule.md): **does
anyone else have these commits?** A message before force-pushing turns a confusing
afternoon for a colleague into a ten-second `git reset --hard origin/<branch>`.

## What happens to whoever else had the branch

They now hold commits that no longer exist upstream. Their `git pull` sees a
divergence and — with a merging default — **merges the old and new versions
cleanly**, giving them duplicates of every rewritten commit. Nothing errors.

Their recovery, once they know:

```bash
git fetch
git reset --hard origin/<branch>                     # if they have no unique work
git rebase --onto origin/<branch> <old-tip> <branch> # if they do
```

Both require knowing a rewrite happened. That knowledge only comes from you.

## Branch protection

Hosts can refuse force-pushes to named branches regardless of your flags. That is
a host feature, not a Git one, and it is the correct place for the rule about
`main` — a convention people follow is weaker than a server that says no.

When protection rejects a force-push, the answer is never to find a way around it.
It is `git revert`.

## Trade-off

**A lease converts an unrecoverable mistake into an error message, and cannot
detect the mistake that matters most.**

`--force-with-lease` is strictly better than `--force` and costs nothing, so the
choice between them is not really a trade-off. The genuine one is subtler: the
lease protects against *concurrent pushes you have not seen*, and it cannot say
anything about *people who have already pulled your branch*. Nobody has pushed, so
the lease passes; five colleagues have your commits, and they all get the duplicate
mess.

That gap is not closable by any flag, because Git has no idea who has fetched.
It is a social fact, and the only instruments are convention (do not rewrite shared
branches), announcement (say so before you do), and enforcement (branch protection
on the host).

So the honest position: **use the lease always, and do not mistake it for
permission.** It protects the remote from a race. It does not protect your
colleagues from a rewrite.

## Gotchas

**Symptom:** `! [rejected] (non-fast-forward)`
**Cause:** the remote has commits your branch does not — either you rewrote history, or someone else pushed
**Fix:** `git fetch` and check `git log HEAD..'@{u}'`. Empty means safe to force; non-empty means integrate instead

**Symptom:** `! [rejected] (stale info)` from `--force-with-lease`
**Cause:** the remote moved since your last fetch — the lease is doing its job
**Fix:** `git fetch`, read what arrived, decide. Never switch to plain `--force` to get past it

**Symptom:** `--force-with-lease` overwrote a colleague's commit anyway
**Cause:** a background `git fetch` — usually your editor — refreshed the remote-tracking ref and satisfied the lease
**Fix:** add `--force-if-includes`, which also requires the commits to be reachable from your branch

**Symptom:** colleagues have duplicate commits after your force-push
**Cause:** their `pull` merged the old and new versions, which merge cleanly because the content is identical
**Fix:** tell them to `git reset --hard origin/<branch>`, or `git rebase --onto` if they have unique local work

**Symptom:** the host rejected your force-push
**Cause:** branch protection
**Fix:** working as intended. `git revert` is the tool for a protected branch

**Symptom:** you force-pushed the wrong branch
**Cause:** bare `git push --force` with `push.default` sending somewhere unexpected
**Fix:** the old commits are still in **your** reflog — `git reflog`, find the tip, push it back. Then set `push.default simple` and use an alias for the lease

---

← Prev: [Divergent branches](05-divergent-branches.md) · Next → [`git push` in full](07-git-push.md)
