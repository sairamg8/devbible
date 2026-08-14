---
title: "Recovery with `reflog` — and how long it stays possible"
sidebar_label: "04 · Reflog recovery"
sidebar_position: 4
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against **git 2.55.0** — `man git-reflog` (`--expire`,
> `--expire-unreachable`, and the 90/30-day defaults), `man git-gc`
> (`gc.reflogExpire`, `gc.pruneExpire`), `man git-fsck` (`--lost-found`,
> `--unreachable`). **Documentation-validated, not sandbox-proven.**

**Nearly every "I destroyed my work" is a commit that still exists with nothing
pointing at it. The reflog names where your refs used to be, `fsck` finds objects
nothing points at, and `gc` is the clock that eventually removes both. Knowing the
expiry windows is the difference between "recoverable" and "was recoverable".**

## The procedure

```bash
# 1. find the point you want
git reflog

# 2. verify — never skip
git show <hash>
git log --oneline <hash> -5

# 3. rescue it NON-destructively
git branch rescue <hash>

# 4. having looked, decide
git reset --hard <hash>     # or merge/cherry-pick from `rescue`
```

Step 3 is the improvement over the obvious version. Creating a branch costs
nothing and is reversible; `reset --hard` while panicking is how one recoverable
mistake becomes two.

The reflog is covered as a concept in
[Phase 2](../phase-2-branching-merging/09-reflog.md); this page is about the
recoveries themselves and the clock.

## The four recoveries

| Lost | Recovery |
|---|---|
| Commits after `reset --hard` | `git reset --hard ORIG_HEAD`, or the reflog entry before the reset |
| A deleted branch | `git reflog`, find its tip, `git branch <name> <hash>` |
| A rebase gone wrong | `git reset --hard ORIG_HEAD` — set before the rebase started |
| The pre-amend version of a commit | The reflog entry **before** `commit (amend): …` |

Finding a deleted branch's tip when the HEAD reflog is noisy:

```bash
git reflog | grep -i 'feature/pricing'
git fsck --lost-found | head          # if the reflog entry is gone too
```

## When the reflog is not enough

`git fsck` looks at the object store directly and reports objects nothing
references:

```bash
git fsck --lost-found            # writes them to .git/lost-found/
git fsck --unreachable | grep commit
git show <hash>                  # inspect each candidate
```

This is the layer below the reflog. It is how you recover:

- **a staged-but-never-committed file** — `git add` wrote a real blob, so it is in
  the object store even though no commit references it. `--lost-found` puts blobs
  in `.git/lost-found/other/` with hash filenames; `git show <hash>` reads them;
- **commits after `git stash clear`** — the manual warns cleared stashes *"may be
  impossible to recover"*, and `fsck` is the attempt;
- **anything after the reflog entry expired but before `gc` ran.**

`fsck` output is unlabelled — a list of hashes with no descriptions — so recovery
means inspecting candidates. It works, and it is tedious, which is the correct
relationship for a last resort.

## The clock

This is the part people do not know until it matters:

| Setting | Default | What it governs |
|---|---|---|
| `gc.reflogExpire` | **90 days** | Reflog entries still reachable from the ref |
| `gc.reflogExpireUnreachable` | **30 days** | Reflog entries no longer reachable — i.e. exactly the ones protecting your rescued commits |
| `gc.pruneExpire` | **2 weeks** | How old a loose unreachable object must be before `gc` deletes it |

So the honest statement is: **an orphaned commit is reliably recoverable for about
two weeks to a month**, not forever. After `gc` runs and the windows pass, the
objects are gone.

`git gc` runs automatically — `gc.auto` triggers it after enough loose objects
accumulate, so it happens during ordinary work without you invoking it.

For a repository where this matters:

```bash
git config gc.reflogExpire never
git config gc.reflogExpireUnreachable never
```

Set per-repository rather than globally; it trades disk for safety, and the trade
is only obviously worth it somewhere specific.

⚠️ **`git gc --prune=now` removes the safety net immediately.** So does
`git reflog expire --expire=now --all`. Both appear in "clean up your repository"
advice online, and both destroy exactly what this page is about. Do not run them
while something is missing.

## What is never recoverable

| State | Why |
|---|---|
| Working-tree edits never staged or committed | No object was ever written. Nothing has a copy |
| Files removed by `git clean` | They were untracked — Git never held them |
| Anything after `gc` collected it | The object is deleted from disk |

The first row is the important one and the reason `git stash` beats
`git reset --hard` as a reflex: stash writes real objects, so it lands on the
recoverable side of the line.

## Trade-off

**The safety net is generous, automatic and silently temporary.**

It costs nothing and requires no forethought: every ref movement is logged, every
orphaned commit survives, and `reset --hard ORIG_HEAD` fixes most disasters in one
command. That is why Git tolerates destructive-looking operations that would be
terrifying elsewhere.

But three properties undermine the reassurance it creates. It is **local** — never
cloned, fetched or pushed, so a colleague's reflog cannot help and a fresh clone
has none. It **expires** on a schedule nobody has read, run by a `gc` that
triggers itself. And it protects **commits**, not content, which is the opposite
of what people lose.

The result is a widespread belief that Git cannot lose work, which produces
exactly the carelessness that loses work. The accurate version is narrower and
worth holding: **committed work is safe for weeks; everything else is safe only
because you have not typed `--hard` yet.**

Two habits follow, and they are the whole practical content of this phase:
**commit early and often**, and **push branches you care about** — a pushed branch
is the only backup Git has, because it is the only copy that survives your disk.

## Gotchas

**Symptom:** `git reflog` has nothing about your lost work
**Cause:** it records ref movements, not file content — the work was never committed
**Fix:** `git fsck --lost-found` if it was ever staged. Otherwise gone

**Symptom:** an orphaned commit that was there last month has disappeared
**Cause:** expiry plus `gc` — 30 days for unreachable reflog entries, and `gc` prunes loose objects older than two weeks
**Fix:** none afterwards. Set `gc.reflogExpireUnreachable never` in repositories that matter

**Symptom:** you ran `git gc --prune=now` while trying to fix a problem, and now recovery is impossible
**Cause:** it deletes unreachable objects immediately — precisely the ones holding your lost commits
**Fix:** none. Never run `gc --prune=now` or `reflog expire --expire=now` while something is missing

**Symptom:** a fresh clone has no reflog for your old work
**Cause:** reflogs are local and are never transferred
**Fix:** recover in the original clone if it still exists. The reflog is not a backup

**Symptom:** `git fsck --lost-found` printed hashes with no indication what they are
**Cause:** dangling objects carry no labels
**Fix:** `git show <hash>` on each. Tedious by design — it is the last resort

**Symptom:** you recovered to the wrong commit and made things worse
**Cause:** `reset --hard` straight from a reflog entry without inspecting it
**Fix:** `git branch rescue <hash>` first, look, then decide. The reflog still has the state before your recovery attempt

---

← Prev: [`revert` is the undo for shared history](03-revert.md) · Next → [Rewriting your own last few commits](05-rewriting-your-own-commits.md)
