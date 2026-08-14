---
title: "Recovering a deleted branch"
sidebar_label: "06 · Recovering a branch"
sidebar_position: 6
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against **git 2.55.0** — `man git-branch` (`-d` / `-D` and
> the "not fully merged" check), `man git-reflog`, `man git-fsck`
> (`--lost-found`, `--unreachable`), `man git-fetch`.
> **Documentation-validated, not sandbox-proven**; the branch-costs-no-objects
> measurement is recorded output from `sandbox/git-p0/ex2-object-model.sh`.

**Deleting a branch deletes a 41-byte file. The commits are untouched — they are
in the object store, unreferenced, waiting. Recovery is finding the tip hash and
writing a new pointer to it, which takes about ten seconds once you know where to
look.**

## Why it works

Phase 0 measured it: creating a branch wrote **41 bytes and zero objects**, and
the object count was unchanged before and after
([a branch is a pointer](../phase-2-branching-merging/01-a-branch-is-a-pointer.md)).
Deleting one is the same operation in reverse. Nothing about the commits changes.

```console
$ wc -c .git/refs/heads/feature/pricing
41
```

<small>Recorded output — `sandbox/git-p0/ex2-object-model.sh` §8.</small>

So "recovering a branch" is really "finding a hash and giving it a name again".

## The usual case: the reflog has it

```bash
git reflog                                   # the HEAD reflog: everything
git reflog | grep -i 'pricing'               # narrow by branch name
git branch feature/pricing <hash>            # recreate
```

The HEAD reflog records branch switching, so entries like
`checkout: moving from feature/pricing to main` name the branch and carry the hash
it was at. That is usually enough.

If you happened to be **on** the branch just before deleting it, its own reflog may
still exist for a short while:

```bash
git reflog show feature/pricing
```

Deleting a branch also deletes its reflog, so this works only in narrow cases —
`git reflog` unfiltered is the reliable route.

## When Git tells you the hash as it deletes

```text
Deleted branch feature/pricing (was a1b2c3d).
```

That message contains everything you need. It is worth reading `-D` output rather
than scrolling past it — the fastest recovery is `git branch feature/pricing
a1b2c3d` straight from the line Git just printed.

## When the reflog does not have it

```bash
git fsck --lost-found
git fsck --unreachable | grep commit
git show <hash>                # inspect candidates
git log --oneline <hash> -10
```

`fsck` reports objects nothing points at. Output is unlabelled hashes, so recovery
means inspecting candidates until you recognise the work — tedious, and it works.

This is the route when the branch was deleted long enough ago that reflog entries
expired, but `gc` has not yet collected the objects — a window of roughly two
weeks to a month by default
([reflog recovery](04-reflog-recovery.md) has the exact numbers).

## Recovering a branch deleted on the remote

Deleting locally and deleting on the server are separate operations, so the
recovery differs:

| Where it was deleted | Recovery |
|---|---|
| Locally only | The remote still has it — `git fetch` then `git switch <branch>` |
| On the remote only | Your local branch is intact — `git push -u origin <branch>` |
| Both | Reflog or `fsck` locally, then push it back |
| Both, and you have no clone with it | Ask the host — GitHub and GitLab keep deleted branches recoverable for a period, and their reflog is server-side |

⚠️ **A `git fetch --prune` removes only your remote-tracking ref.** The local
branch and its commits are unaffected — see
[remote-tracking branches](../phase-4-remotes/03-remote-tracking-branches.md).

## Why `-d` refused, and why that was useful

`git branch -d` refuses when the branch tip is not **reachable** from HEAD. It is a
reachability check, not a review check, which produces two familiar behaviours:

- a branch merged with **squash** or rebased is not reachable, so `-d` refuses
  even though the work landed — `-D` is correct there;
- `-d` run from a different branch that lacks the merge refuses too. Check
  properly with `git branch --merged main`.

```bash
git branch --merged main       # safe to delete
git branch --no-merged main    # still carrying unlanded work
```

The habit worth having is deleting branches at the moment they land, and using
`git branch -vv | grep ': gone]'` to find local branches whose upstream was
deleted on the server.

## Trade-off

**Branches are so cheap to create and delete that Git offers almost no
protection, and relies entirely on a safety net that expires.**

`git branch -D` is instant, unconfirmed and unlogged beyond the reflog line. That
is right for the common case: a branch is a name, names are disposable, and
demanding confirmation for every one would be intolerable.

The exposure is that the protection has a shelf life. Commits orphaned by a branch
deletion are recoverable while the reflog entry survives (30 days unreachable by
default) and while `gc` has not pruned them (two weeks for loose objects). Nothing
warns you when that window closes, and the failure mode is discovering months
later that a branch you assumed was archived is gone.

The reliable fix is not a Git setting: **push branches you care about.** A pushed
branch exists in a second repository with its own retention, and that is the only
thing in this phase that is genuinely a backup. Everything else — reflog, `fsck`,
`ORIG_HEAD` — is a local, temporary net.

## Gotchas

**Symptom:** you deleted a branch and think the commits are gone
**Cause:** they are not — deleting a branch removes a 41-byte pointer
**Fix:** `git reflog`, find the tip, `git branch <name> <hash>`. The deletion message also printed the hash

**Symptom:** `git reflog show <branch>` is empty for the deleted branch
**Cause:** deleting a branch deletes its reflog
**Fix:** use `git reflog` unfiltered — the HEAD reflog records switching to and from it

**Symptom:** neither the reflog nor `ORIG_HEAD` has it
**Cause:** the entries expired, or the branch was deleted in a different clone
**Fix:** `git fsck --lost-found` while `gc` has not collected the objects. If it was ever pushed, the host may still have it

**Symptom:** `git branch -d` refuses on a branch you merged via the host's squash button
**Cause:** squash creates a commit with no ancestry link, so the branch is not reachable
**Fix:** confirm the change is in `main`, then `-D`

**Symptom:** you pruned and think you deleted local branches
**Cause:** pruning removes remote-tracking refs only
**Fix:** nothing lost. `git branch -vv | grep ': gone]'` lists local branches whose upstream is gone — those are the ones now safe to delete

**Symptom:** the branch is gone from the server and no local clone has it
**Cause:** every copy was deleted
**Fix:** the host is the last resort — GitHub and GitLab retain deleted branch tips for a period and can restore them

---

← Prev: [Rewriting your own last few commits](05-rewriting-your-own-commits.md) · Next → [Undoing a merge](07-undoing-a-merge.md)
