---
title: "`revert` is the undo for shared history"
sidebar_label: "03 · git revert"
sidebar_position: 3
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against **git 2.55.0** — `man git-revert` (DESCRIPTION,
> `-m`, `--no-commit`, `--continue` / `--skip` / `--abort`), `man git` §*Reset,
> restore and revert*. **Documentation-validated, not sandbox-proven.**

**`git revert` does not remove a commit. It computes the inverse of that commit's
changes and records them as a **new** commit on top. Nothing is rewritten, no
force-push is needed, and every clone stays valid — which is why it is the only
correct undo for anything anyone else has.**

## The mechanism

```bash
git revert <commit>              # opens an editor for the message
git revert --no-edit <commit>    # accept the default "Revert "<subject>""
git revert HEAD                  # undo the last commit
git revert <a>..<b>              # a range, newest first
```

The history afterwards contains **both** commits — the original and its inverse.
That is the point: the record of what happened, including the mistake and the
correction, stays true.

The manual requires a **clean working tree** (`revert` refuses otherwise) and
distinguishes itself clearly from the alternatives: use `reset --hard` to throw
away uncommitted work, `restore --source` to extract files, and take care because
both of those discard uncommitted changes.

## Reverting a merge: `-m`

A merge commit has two parents, so "undo it" is ambiguous — undo relative to
which? `-m` names the parent to treat as the mainline:

```bash
git revert -m 1 <merge-commit>
```

**`-m 1` is almost always right**: parent 1 is the branch you were on when you
merged (usually `main`), so `-m 1` means "keep main, remove what the feature
branch brought in".

```bash
git log --pretty=%P -1 <merge-commit>   # list the parents, in order
```

### The trap that follows

Reverting a merge undoes its **changes**, but the merge itself stays in history —
so Git still considers that branch merged. If you fix the branch and merge it
again, **only the commits made after the revert come in**; everything from the
original merge is treated as already present.

The fix, when you genuinely want the branch back:

```bash
git revert <the-revert-commit>    # revert the revert, restoring the changes
# then merge the new work on top
```

Reverting a revert sounds absurd and is the documented, correct answer. It is the
single most confusing consequence in this phase, and it is worth reading twice
before reverting a merge on a shared branch.

## Reverting several commits

```bash
git revert <oldest>..<newest>        # each becomes its own revert commit
git revert --no-commit <a> <b> <c>   # combine them into one
git commit -m "Revert the pricing experiment"
```

Ranges are applied newest-first, which is the order that works: undoing the later
change before the earlier one avoids conflicts that the reverse order would
create.

`--no-commit` (`-n`) stages the inverse without committing, so several reverts can
be one commit. It is also how you revert and then adjust before recording.

## When it conflicts

A revert applies an inverse patch, so it can conflict exactly like a merge —
typically because the code has moved on since the commit you are undoing:

```bash
git revert --continue
git revert --skip
git revert --abort
git revert --quit        # stop, but keep what has already been applied
```

Same machinery, same three index stages, same resolution procedure as
[resolving conflicts](../phase-2-branching-merging/04-resolving-conflicts.md).

## `revert` versus `reset`, decided

| | `git revert` | `git reset` |
|---|---|---|
| Changes history | ✖ Adds a commit | ✅ Moves the branch |
| Safe on pushed commits | ✅ **Always** | ✖ Requires a force-push |
| Needs everyone else to act | ✖ No | ✅ Yes, after a force-push |
| Leaves a record of the mistake | ✅ Yes | ✖ No |
| Works on a protected branch | ✅ | ✖ |

The second row decides it. On a protected `main`, `revert` is not merely
preferable — it is the only one the host will accept.

## Trade-off

**`revert` is always safe and always leaves the history longer and uglier than the
truth needed to be.**

Undo a commit and a revert; undo the revert and there are three commits, none of
which changed anything net. `git log` on a branch that has been through a few
false starts reads like an argument. The information is honest — those things
really did happen — but nobody reading history a year later benefits from the
round trip.

The alternative is a rewrite, which produces a clean line and costs everyone who
has the branch a recovery procedure, silently, with duplicate commits as the
failure mode
([the golden rule](../phase-2-branching-merging/08-the-golden-rule.md)).

So the trade is **local tidiness against everyone else's time**, and it is not
close: revert's cost is a few extra lines in `git log`, and a rewrite's cost is
measured in colleagues. Use `revert` for anything published, and spend the
tidiness budget where it is free — on branches nobody has seen, with
[interactive rebase](../phase-2-branching-merging/07-interactive-rebase.md).

## Gotchas

**Symptom:** `git revert` refuses to start
**Cause:** it requires a clean working tree
**Fix:** commit or stash first

**Symptom:** `git revert <merge>` fails with "is a merge but no -m option was given"
**Cause:** a merge has two parents, so Git cannot tell which side to treat as mainline
**Fix:** `git revert -m 1 <merge>` — parent 1 is the branch you were on when you merged

**Symptom:** you reverted a merge, fixed the branch, merged again — and most of the changes are missing
**Cause:** the original merge is still in history, so Git considers those commits already merged; only post-revert commits arrive
**Fix:** revert the revert first, then merge the new work on top

**Symptom:** a revert conflicted
**Cause:** the code changed since the commit being undone, so the inverse patch does not apply cleanly
**Fix:** resolve as any conflict, then `git revert --continue`. `--abort` backs out entirely

**Symptom:** reverting a range produced conflicts you did not expect
**Cause:** ranges apply newest-first for a reason; reverting individual commits oldest-first creates conflicts
**Fix:** use the range form `git revert <old>..<new>`, or `--no-commit` and combine

**Symptom:** the revert commit's message says nothing useful
**Cause:** the default is just `Revert "<original subject>"`
**Fix:** write a body saying **why** it was reverted. That is the one piece of information the diff cannot carry

## Interview questions

**★ What does `git revert` actually do?**
It computes the inverse of a commit's changes and records them as a **new** commit
on top. Nothing is rewritten, no force-push is needed, every clone stays valid, and
the history afterwards contains both the original and its inverse — which is the
point, because the record of what happened, mistake included, stays true. It also
requires a clean working tree and will refuse otherwise.

**★ Why does reverting a merge need `-m`, and why is `-m 1` almost always right?**
A merge commit has two parents, so "undo it" is ambiguous: undo relative to which
line of history? `-m` names the parent to treat as the mainline. Parent 1 is the
branch you were on when you merged — normally `main` — so `-m 1` means "keep main,
remove what the feature branch brought in". `git log --pretty=%P -1 <merge>` lists
the parents in order if you want to check rather than assume.

**★ You reverted a merge, fixed the branch, merged it again, and most of the changes
are missing. Why, and what is the fix?**
Because reverting a merge undoes its *changes* while the merge commit itself stays in
history — so Git still considers those commits merged, and a second merge brings in
only what was committed after the revert. The documented fix is to **revert the
revert**, which restores the original changes, and then merge the new work on top. It
sounds absurd, it is correct, and it is the most confusing consequence in this area —
worth reading twice before reverting a merge on a shared branch.

**★ How do you revert several commits, and why does order matter?**
`git revert <oldest>..<newest>` reverts a range, producing one revert commit each,
and it applies them **newest-first** — which is the order that works, because undoing
a later change before an earlier one avoids conflicts that the reverse order creates.
`--no-commit` stages the inverses without committing, so several reverts can be
combined into one commit with a message that explains the whole retreat.

**★ Why is `revert` the only option on a protected `main`?**
Because every alternative needs a force-push, and the host will refuse one. `reset`
moves your branch, leaving the remote's commit unreachable from it — a non-fast-forward
push. `revert` only ever adds a commit, so the push is an ordinary fast-forward that
branch protection has no reason to reject. On a protected branch the choice is not
between preferable options; there is one.

**What does `revert` cost, and why is the trade not close?**
Longer, uglier history: undo a commit and there are two, undo the revert and there
are three, none of which changed anything net, and `git log` on a branch with a few
false starts reads like an argument. The alternative is a rewrite, which produces a
clean line and costs everyone holding the branch a silent recovery procedure with
duplicate commits as the failure mode. So the trade is local tidiness against other
people's time — a few extra lines against colleagues — and the tidiness budget is
better spent on branches nobody has seen.

---

← Prev: [`reset` in terms of the three trees](02-reset-in-depth.md) · Next → [Recovery with `reflog`](04-reflog-recovery.md)
