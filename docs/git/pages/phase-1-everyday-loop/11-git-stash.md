---
title: "`git stash`"
sidebar_label: "11 · git stash"
sidebar_position: 11
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against **git 2.55.0** — `man git-stash` (DESCRIPTION,
> COMMANDS, OPTIONS). **Documentation-validated, not sandbox-proven.**

**A stash is a real commit — an unreferenced one, parked on `refs/stash` — holding
your working tree and index so you can get back to a clean tree without losing
anything. It is the recoverable version of `git reset --hard`, and that is the
main reason to reach for it.**

## What it is, literally

The manual is precise about the storage:

> The latest stash you created is stored in **`refs/stash`**; older stashes are
> found in the **reflog of this reference** and can be named using the usual
> reflog syntax (e.g. `stash@{0}` is the most recently created stash,
> `stash@{1}` is the one before it, `stash@{2.hours.ago}` is also possible).

So the "stash list" is a reflog, not a queue, and it is a **stack**: pushing adds
at `stash@{0}` and shifts everything down. You can also just use the integer —
`git stash apply 2` is the same as `git stash apply 'stash@{2}'`, which avoids
fighting your shell over the braces.

Underneath, each entry is a commit object (technically a small merge commit
recording both the working tree and the index). That is why a stash survives
branch switches, and why it can be applied on top of a *different* commit later.

## The commands you need

```bash
git stash push -m "half-done pricing refactor"   # save, with a name
git stash list                                   # what is parked
git stash show -p stash@{1}                      # look before you leap
git stash pop                                    # apply the top one and remove it
git stash apply stash@{2}                        # apply, and KEEP it in the list
git stash drop stash@{0}                         # delete one
```

Bare `git stash` is `git stash push`. The older `git stash save` still works but
`push` is the current spelling — it takes pathspecs, which `save` does not.

**Name your stashes.** The default message is `WIP on <branch>: <hash> <subject>`,
which is indistinguishable from every other stash you made that week. `-m` costs
five seconds and is the difference between a stash you can use in a fortnight and
one you delete because you dare not apply it.

## `pop` versus `apply`

| Command | Applies | Removes from the list |
|---|---|---|
| `pop` | ✅ | ✅ — **unless it conflicts** |
| `apply` | ✅ | ✖ |

The conflict behaviour is the part worth knowing, and it is documented:

> Applying the state can fail with conflicts; in this case, **it is not removed
> from the stash list**. You need to resolve the conflicts by hand and call
> `git stash drop` manually afterwards.

So a failed `pop` leaves you with conflict markers *and* the stash still present.
That is the safe design — nothing is lost — but it means you must remember to
`drop` it once you have resolved, or you will apply the same changes twice later.

`apply` is the more defensive habit for anything you would be upset to lose:
apply, confirm the result builds, then `drop` deliberately.

## Untracked and ignored files

By default `git stash` saves **tracked** modifications only. New files stay in
your working tree, which is usually a surprise at the worst moment.

| Flag | Also stashes |
|---|---|
| `-u` / `--include-untracked` | Untracked files |
| `-a` / `--all` | Untracked **and ignored** files |

Both then remove those files from the working tree with `git clean` — so `-a` on
a repository with `node_modules` ignored will stash and delete it, which is slow
and rarely intended. `-u` is the one you usually want; `-a` needs a reason.

`git stash show -u` includes untracked files in the shown diff, and
`--only-untracked` shows just those.

## The two flags that make stash a precision tool

```bash
git stash push --keep-index        # stash everything, but leave the index as it is
git stash push --staged            # stash ONLY what is staged
git stash push -p                  # choose hunks interactively
git stash push -m "..." -- src/    # stash only these paths
```

**`--keep-index` (`-k`)** is the one that pairs with
[`git add -p`](02-git-add/03-patch-mode.md), and it solves a real problem raised
there: a commit staged hunk by hunk has never been tested as a unit.

```bash
git add -p                    # stage exactly the change you intend to commit
git stash push --keep-index   # park everything else
npm test                      # test EXACTLY what you are about to commit
git commit
git stash pop                 # get the rest back
```

That is the highest-value use of stash there is, and it is why `--keep-index`
exists.

**`--staged` (`-S`)** does the opposite: stash only the staged changes, leaving
unstaged work alone. Useful when you have staged something that turns out to
belong on another branch.

## `git stash branch` — the escape hatch

```bash
git stash branch fix/pricing stash@{1}
```

Creates a branch starting **from the commit that was HEAD when the stash was
made**, applies the stash there, and drops it if it succeeded.

The manual's reason for it is the useful one: the branch you stashed on has moved
so far that `apply` now conflicts. Applying at the original commit sidesteps the
conflict entirely — you get your changes back cleanly and can merge or rebase them
deliberately afterwards.

This is the answer to "my stash won't apply any more", and almost nobody knows it
exists.

## `--index`, and why `pop` sometimes loses your staging

By default, applying a stash puts everything back as **unstaged** changes: what
was staged and what was not are merged into one pile.

`git stash pop --index` tries to restore the index too. The manual notes it *"can
fail, when you have conflicts (which are stored in the index, where you therefore
can no longer apply the changes as they were originally)"* — so it is best-effort,
not guaranteed.

If your staging arrangement matters, a commit is a better container than a stash.
`git commit -m "wip"` followed later by `git reset --soft HEAD~1` preserves far
more and is fully recoverable.

## Trade-off

**A stash is invisible, unnamed by default, and belongs to no branch — which is
exactly what makes it convenient and exactly what makes it a place work goes to
die.**

Nothing in `git status`, `git log` or your host's UI mentions a stash. It does not
travel with a push, it does not appear in a review, and a colleague cannot see it.
Combined with `WIP on main:` as the default message, the practical result is a
stack of stashes nobody dares delete and nobody can identify.

`git stash list` is the mitigation, and it is worth adding to whatever you run at
the start of a work session — `git status --show-stash` does it for free
([`git status`](01-git-status/02-the-short-format.md)).

The stronger mitigation is to use the right container. Stash is for **minutes to
hours** — "let me switch branches to look at something". For anything that will
outlive the day, a WIP commit on a branch is better in every respect: it is
visible, it is named, it can be pushed as a backup, it survives a
`git stash clear`, and `reset --soft` unpicks it whenever you want.

## Gotchas

**Symptom:** you stashed, switched branch, and your new files are still there
**Cause:** `git stash` saves tracked modifications only; untracked files are left alone
**Fix:** `git stash -u`. Use `-a` only when you deliberately want ignored files too — it will happily stash and delete `node_modules`

**Symptom:** `git stash pop` conflicted, and now you have markers *and* the stash still listed
**Cause:** documented behaviour — a conflicted pop does not drop the entry, so nothing is lost
**Fix:** resolve the conflicts, then `git stash drop` manually. Otherwise you will re-apply the same changes later

**Symptom:** everything came back unstaged, though you had carefully staged half of it
**Cause:** applying a stash merges staged and unstaged into one set by default
**Fix:** `git stash pop --index` attempts to restore staging; it can fail on conflicts. For staging that matters, use a WIP commit instead

**Symptom:** an old stash will not apply — conflicts everywhere
**Cause:** the branch has moved a long way since the stash was created
**Fix:** `git stash branch <name> stash@{n}` — it applies at the original commit, where there is no conflict

**Symptom:** `git stash clear` and you needed one of them
**Cause:** `clear` drops all entries, and the manual warns they are then subject to pruning and **may be impossible to recover**
**Fix:** try `git fsck --unreachable | grep commit` immediately and inspect the candidates. Do not rely on this; drop stashes individually

**Symptom:** a stash from three weeks ago that nobody can identify
**Cause:** the default message is `WIP on <branch>`, which is identical for every stash
**Fix:** always `git stash push -m "..."`. Add `git status --show-stash` to your routine so the pile stays visible

## Interview questions

**★ What is a stash, physically?**
A commit — technically a small merge commit recording both your working tree and
your index — parked on `refs/stash`, with older entries living in that ref's
*reflog*. So `stash@{0}` is reflog syntax, not a queue index, and the list behaves
as a stack: pushing adds at `stash@{0}` and shifts everything down. Because each
entry is a real commit, a stash survives branch switches and can be applied on top
of a different commit later. The integer shorthand works too — `git stash apply 2`
saves fighting your shell over braces.

**★ `pop` or `apply`?**
`pop` applies and removes the entry; `apply` applies and keeps it. The documented
subtlety is what happens on conflict: a conflicted `pop` does **not** drop the
entry, so you end up with conflict markers *and* the stash still listed. That is
the safe design — nothing is lost — but it means you must `git stash drop`
manually once you have resolved, or you will apply the same changes again later.
For anything you would be upset to lose, `apply`, confirm the result builds, then
drop deliberately.

**★ You stashed, switched branch, and the new files are still sitting there. Why?**
Because `git stash` saves *tracked* modifications only; untracked files are left
alone. `-u` includes untracked files, and `-a` includes ignored ones too — but
both then remove those files from the working tree with `git clean`, so `-a` on a
repository with `node_modules` ignored will happily stash and delete it. `-u` is
what you usually want and `-a` needs a specific reason.

**★ What is `--keep-index` for, and why is it the highest-value use of stash?**
It stashes everything while leaving the index exactly as it is, which lets you test
precisely what you are about to commit. Stage the change hunk by hunk with
`git add -p`, run `git stash push --keep-index` to park everything else, run the
tests, commit, then `git stash pop`. That closes the real hole in patch-mode
staging: a commit assembled from selected hunks has otherwise never been tested as
a unit, and "it worked in my tree" is not the same claim.

**★ An old stash will not apply — conflicts everywhere. What is the command almost
nobody knows?**
`git stash branch <name> stash@{n}`. It creates a branch starting from the commit
that was `HEAD` when the stash was made, applies the stash there — where by
construction there is no conflict — and drops it if that succeeded. You then merge
or rebase the branch deliberately. It is the documented answer to "my branch has
moved too far for this stash to apply", and it turns an afternoon of conflict
resolution into a two-second command.

**Why did everything come back unstaged when half of it had been staged?**
Because applying a stash merges the staged and unstaged halves into one pile by
default. `git stash pop --index` attempts to restore the staging, and the manual is
explicit that it can fail when there are conflicts, since conflicts are themselves
stored in the index. If the staging arrangement genuinely matters, a stash is the
wrong container: `git commit -m "wip"` followed later by `git reset --soft HEAD~1`
preserves more and is fully recoverable.

**When should you use a WIP commit instead of a stash?**
Whenever the work will outlive the day. A stash is invisible — nothing in `status`,
`log` or your host's UI mentions it, it does not travel with a push, a colleague
cannot see it, and its default message `WIP on <branch>` is identical to every
other stash you made that week. A WIP commit on a branch is visible, named,
pushable as a backup, survives `git stash clear`, and unpicks with `reset --soft`
whenever you want. Stash is for minutes to hours; anything longer deserves a
branch. In the meantime, `git status --show-stash` keeps the pile from becoming
invisible.

---

← Prev: [Commit messages](10-commit-messages.md) · Next → [Removing and moving files](12-removing-and-moving.md)
