---
title: "`git reflog` as the safety net"
sidebar_label: "09 · git reflog"
sidebar_position: 9
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against **git 2.55.0** — `man git-reflog` (DESCRIPTION,
> `--expire`, `--expire-unreachable`), `man gitrevisions` (the `@{...}` syntax),
> `man git-fsck`. **Documentation-validated, not sandbox-proven.**

**Every time a ref moves — a commit, a checkout, a merge, a rebase, a reset — Git
writes the old and new values to a log. That log is local, it is not part of
history, and it is why almost every "I destroyed my work" is recoverable in about
thirty seconds. Learn it before you need it, not during.**

## What it records

The manual: reflogs *"record when the tips of branches and other references were
updated **in the local repository**"*.

Two words carry the weight:

- **Tips of references.** It logs where a ref *pointed*, not what changed in your
  files. Uncommitted work is not in the reflog, ever — that is the boundary
  ([undo before you push](../phase-1-everyday-loop/08-undo-before-you-push.md)).
- **Local.** The reflog is not pushed, not fetched and not cloned. A fresh clone
  has an almost empty reflog, and your colleague's reflog cannot help you.

The HEAD reflog additionally records **branch switching**, so it is a complete
record of where you have been.

```bash
git reflog                 # HEAD's reflog — the usual one
git reflog show main       # a specific branch's
git reflog show stash      # yes, the stash list IS a reflog
git log -g --oneline       # the same data through `log` (reflog show is an alias for this)
```

## The `@{...}` syntax

| Expression | Means |
|---|---|
| `HEAD@{2}` | Where HEAD pointed **two moves ago** |
| `main@{1}` | Where `main` pointed one move ago |
| `main@{one.week.ago}` | Where `main` pointed a week ago, in **this** repository |
| `stash@{0}` | The most recent stash |
| `@{u}` / `@{upstream}` | The upstream of the current branch — **not** a reflog entry |

Do not confuse `HEAD@{2}` with `HEAD~2`. `~2` is **two commits back in ancestry**;
`@{2}` is **two operations back in time**. After a reset they are wildly different,
and `@{2}` is the one that undoes things.

⚠️ Quote them in shells that treat braces specially: `git reset --hard 'HEAD@{2}'`.

## The recovery procedure

Whatever went wrong, it is the same three steps:

```bash
# 1. find where you were
git reflog

# 2. verify it is the right point — never skip this
git show <hash>
git log --oneline <hash> -5

# 3. go back, or branch from it
git reset --hard <hash>        # move the current branch there
git branch rescue <hash>       # safer: create a branch, look, then decide
```

**Step 2 is not optional.** A reflog entry looks like
`a1b2c3d HEAD@{4}: rebase (finish): returning to refs/heads/feature`, and the
descriptions are terse. `git show` costs a second and prevents resetting to the
wrong point, which is a second disaster on top of the first.

**Step 3's second form is the better habit.** Creating a branch is
non-destructive; you can inspect it, compare it, and merge or reset afterwards. A
`reset --hard` while panicking is how one recoverable mistake becomes two.

## What each entry tells you

Reflog descriptions name the operation that caused the move:

| Description | What happened |
|---|---|
| `commit: <subject>` | An ordinary commit |
| `commit (amend): <subject>` | An amend — the entry **before** it is the pre-amend commit |
| `checkout: moving from X to Y` | A branch switch |
| `reset: moving to <target>` | A reset — the entry before it is where you were |
| `rebase (start)` / `(pick)` / `(finish)` | A rebase, step by step |
| `merge <branch>` | A merge |
| `pull` / `clone` | A fetch-and-integrate, or the initial clone |

Reading the operation names is usually enough to spot the entry you want without
inspecting each hash.

## The four disasters, and their fixes

| What happened | Fix |
|---|---|
| `git reset --hard` on the wrong commit | `git reset --hard ORIG_HEAD`, or the reflog entry before the reset |
| Deleted a branch you still needed | `git reflog`, find the tip, `git branch <name> <hash>` |
| A rebase went wrong | `git reset --hard ORIG_HEAD` — set before the rebase started |
| Amended a commit and lost the original | The entry before `commit (amend)` is the original |

**`ORIG_HEAD`** is the shortcut for the most recent of these: Git sets it before
any operation that moves HEAD substantially — reset, merge, rebase, pull. It is
one level deep. The reflog goes back much further.

## The limits — worth knowing before you rely on it

**It expires.** Reachable entries default to **90 days**
(`gc.reflogExpire`), unreachable ones to **30 days**
(`gc.reflogExpireUnreachable`). After that, `git gc` can prune the entries and the
commits they protected become collectable.

```bash
git config gc.reflogExpire "never"                 # for a repository you care about
git config gc.reflogExpireUnreachable "never"
```

**It is per-repository and per-clone.** A fresh clone has none of your history of
operations. Neither does your colleague's.

**It only covers committed work.** A `reset --hard` over uncommitted edits is not
recoverable from the reflog, because those edits never became a commit. If they
were *staged*, the blob exists and `git fsck --lost-found` may find it; if they
were only on disk, nothing has a copy.

**A missing branch reflog.** If `git reflog show <branch>` is empty, the HEAD
reflog usually still has the movements — `git reflog` unfiltered is the fallback.

## When the reflog is not enough

```bash
git fsck --lost-found            # dangling commits and blobs
git fsck --unreachable | grep commit
```

`fsck` finds objects that exist in the object store with nothing pointing at them.
It is the layer below the reflog: no operation record, just orphaned objects.

This is how you recover a **staged but never committed** file, and how you look
for commits after a `git stash clear` — the manual warns that cleared stashes *"may
be impossible to recover"*, and `fsck` is the attempt.

## Trade-off

**The reflog makes Git enormously forgiving, and it does so in a way that is
invisible, local, and expiring — three properties that undermine the reassurance
it provides.**

The strength is genuine. Because commits are immutable objects and refs are just
pointers, nothing that moves a pointer can destroy a commit; the reflog records
every such move, so almost every destructive-looking operation is a `reset` away
from being undone. This is why `rebase`, `reset --hard` and branch deletion are
routine in Git and terrifying in systems without an equivalent.

But it protects the wrong noun for the most common accident. It records **commits**
— and the work people actually lose is uncommitted. `git reset --hard` and
`git restore` destroy content that no reflog entry describes, and the widespread
belief that "Git never loses anything" causes exactly the carelessness that
produces those losses.

It also creates a false sense of permanence. Ninety days is not forever, the log
does not survive a re-clone, and nobody discovers either fact until the day it
matters.

The practical stance: **commit early and often, including work you are ashamed
of** — a commit is protected, a working tree is not. And treat the reflog as a
local, temporary safety net rather than as backup, because that is exactly what
it is.

## Gotchas

**Symptom:** `git reflog` does not contain your lost work
**Cause:** it was never committed. The reflog records ref movements, not file content
**Fix:** `git fsck --lost-found` if it was ever staged. Otherwise it is gone — use `git stash` instead of `reset --hard` in future

**Symptom:** `HEAD@{2}` gave a completely different commit from `HEAD~2`
**Cause:** they are different questions — `@{2}` is two *operations* ago, `~2` is two *commits* back in ancestry
**Fix:** use `@{n}` for undoing operations, `~n` for walking history

**Symptom:** `git reset --hard HEAD@{2}` failed with a shell error
**Cause:** braces are special in some shells
**Fix:** quote it: `git reset --hard 'HEAD@{2}'`

**Symptom:** a fresh clone has no reflog for your old work
**Cause:** reflogs are local and are never cloned, fetched or pushed
**Fix:** recover in the original clone if it still exists. This is why the reflog is not a backup

**Symptom:** an old commit is no longer in the reflog
**Cause:** expiry — 90 days for reachable entries, 30 for unreachable, then `gc` prunes
**Fix:** `git fsck --unreachable` may still find the object if `gc` has not collected it. Set `gc.reflogExpire` to `never` in repositories that matter

**Symptom:** you reset to a reflog entry and landed somewhere unexpected
**Cause:** the entry chosen was not the one you meant — the descriptions are terse
**Fix:** `git branch rescue <hash>` first and inspect, rather than `reset --hard` directly. Verify with `git show` before moving anything

---

← Prev: [The rule about rewriting shared history](08-the-golden-rule.md) · Next → [Aborting cleanly](10-aborting-cleanly.md)
