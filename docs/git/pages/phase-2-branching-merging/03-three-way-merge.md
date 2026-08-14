---
title: "The three-way merge and the merge base"
sidebar_label: "03 · Three-way merge"
sidebar_position: 3
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against **git 2.55.0** — `man git-merge` (DESCRIPTION,
> `--strategy`, `-X`), `man git-merge-base`, `man git-config` (`merge.conflictStyle`).
> **Documentation-validated, not sandbox-proven.**

**A merge has three inputs, not two: your side, their side, and the common
ancestor both diverged from. The ancestor is what lets Git tell "you added this"
apart from "they deleted it" — without it, every difference would be a conflict.
Almost every surprising merge result is explained by which commit turned out to be
the base.**

## Why two inputs are not enough

Take a file that says `timeout = 30` on your branch and `timeout = 60` on theirs.
With only those two versions, Git cannot tell which of these happened:

- the value was `30`, and they changed it to `60` → take theirs;
- the value was `60`, and you changed it to `30` → take yours;
- the value was `10`, and you both changed it → a genuine conflict.

The **merge base** — the common ancestor — settles it. Git diffs each side against
the base and applies the changes: a hunk changed on one side only is taken
automatically, and a hunk changed on **both** sides, differently, is a conflict.

That is the whole algorithm, and it explains the shape of everyday merges: a
thousand-line branch usually merges cleanly because almost every hunk changed on
one side only.

## Seeing the base

```bash
git merge-base main feature            # the common ancestor's hash
git merge-base --all main feature      # if there are several (criss-cross history)
git log --oneline $(git merge-base main feature)..feature   # what your side adds
git diff $(git merge-base main feature) feature             # ...as a diff
```

That last one is exactly what `git diff main...feature` is shorthand for, and what
a pull request shows ([`git diff`](../phase-1-everyday-loop/04-git-diff.md)).

`--all` matters occasionally: when history has criss-crossed (two branches merged
each other at different points) there can be **more than one** common ancestor.
The default strategy handles that by merging the bases together into a synthetic
base — which is where a merge result can be surprising in a way no single diff
explains.

## `ort`, the default strategy

Since Git 2.34 the default strategy is **`ort`** ("ostensibly recursive's twin"),
replacing `recursive`. For everyday use the differences are speed and better
handling of renames and directory moves; the model is the same three-way merge.

The strategies you might name explicitly:

| Strategy | What it does |
|---|---|
| `ort` | The default. Three-way merge, with rename detection |
| `ours` | Take **our** side entirely, discarding theirs — but record the merge |
| `octopus` | Merge more than two branches at once. Refuses if any conflict |
| `subtree` | For merging a project into a subdirectory of another |

**`-s ours` is not `-X ours`, and confusing them is expensive.** `-s ours` throws
away the other branch's changes completely while recording a merge commit that
*claims* it was merged. `-X ours` is an *option* to the normal strategy: merge
properly, and when a hunk genuinely conflicts, prefer our version of that hunk.

| Command | Effect |
|---|---|
| `git merge -X ours feature` | Normal merge; conflicting **hunks** resolve to ours. Non-conflicting changes from theirs are still taken |
| `git merge -s ours feature` | **Nothing** from theirs is taken. The tree is exactly ours, with a merge commit recorded |

`-s ours` has legitimate uses — marking a branch as superseded so future merges
skip it — and no legitimate use in "just make the conflict go away".

## Conflict styles: `merge` versus `zdiff3`

When Git cannot decide, it writes markers into the file. The default style shows
two sides:

```text
<<<<<<< HEAD
timeout = 30
=======
timeout = 60
>>>>>>> feature
```

`zdiff3` adds the **base** — the third input, which is the one that tells you what
actually changed:

```text
<<<<<<< HEAD
timeout = 30
||||||| merge base
timeout = 10
=======
timeout = 60
>>>>>>> feature
```

Now it is obvious: the base was `10`, both sides raised it, and you have to decide
which. Without the base you were guessing.

```bash
git config --global merge.conflictStyle zdiff3
```

This is the single highest-value merge setting there is. `zdiff3` is a refinement
of the older `diff3` that trims common lines from the conflict region, so it is
strictly the better of the two.

## `AUTO_MERGE` — seeing your resolution as a diff

When `ort` hits a conflict it writes the auto-merged tree — including the conflict
markers — to a ref called `AUTO_MERGE`. That gives you a way to see **only what
you changed while resolving**:

```bash
git diff AUTO_MERGE
```

Anything in that diff is your resolution work. It is the fastest way to check you
did not accidentally delete a line while removing markers, which is the most
common resolution mistake.

## Rename handling

Because Git detects rather than records renames
([topic 12 of phase 1](../phase-1-everyday-loop/12-removing-and-moving.md)), a
merge where one side renamed a file and the other edited it requires the merge
machinery to notice the rename and apply the edit to the new path. `ort` does this
well, and it is one of the main reasons it replaced `recursive`.

Where it still goes wrong is the same place detection goes wrong: a rename plus a
heavy rewrite falls below the similarity threshold, so the merge sees a delete on
one side and an edit on the other — which Git reports as a **modify/delete**
conflict rather than resolving it. That is a real conflict, not a bug, and the
resolution is to decide where the edit belongs.

## Trade-off

**The three-way merge resolves most conflicts automatically, and its silence is
not the same as correctness.**

Git merges at the level of **text hunks**. If you rename a function in one file
and a colleague adds a call to the old name in another file, both sides changed
different hunks — so the merge succeeds cleanly and the result does not compile.
Git has no idea what a function is.

This is the honest limit of the whole model: a clean merge means *no textual
conflict*, and nothing more. Semantic conflicts pass through silently, and they
are the ones that reach production, because a merge with conflict markers is
impossible to ignore and a merge that "worked" is easy to trust.

The practical answer is not distrust of merging, it is: **build and test after
every merge, especially the clean ones.** A conflicted merge already forces
attention. It is the effortless one that deserves the extra minute.

## Gotchas

**Symptom:** a merge conflicted on a file neither side seems to have changed much
**Cause:** the merge base is not what you assumed — often after a rebase or a squash-merge changed the ancestry
**Fix:** `git merge-base main feature` and diff each side against it. Criss-cross history can also yield several bases; `--all` shows them

**Symptom:** the merge succeeded and the build broke
**Cause:** a semantic conflict — both sides changed different hunks, so there was no textual conflict, but the results are incompatible
**Fix:** nothing Git can do. Build and test after every merge; a clean merge is not a verified one

**Symptom:** `-s ours` discarded all of the other branch's work
**Cause:** that is what the `ours` **strategy** does — it records a merge but keeps our tree entirely
**Fix:** you almost certainly wanted `-X ours`, which merges normally and only prefers our side in conflicting hunks. Undo with `git reset --hard ORIG_HEAD`

**Symptom:** conflict markers show two versions and you cannot tell which changed
**Cause:** the default `merge` conflict style hides the base — the input that carries the answer
**Fix:** `git config --global merge.conflictStyle zdiff3`, then re-create the conflict (`git merge --abort` and merge again)

**Symptom:** a modify/delete conflict on a file that was only renamed
**Cause:** the rename was accompanied by enough editing to fall below the rename-detection threshold
**Fix:** resolve by hand, deciding where the edit belongs. In future, commit renames separately from rewrites

---

← Prev: [Fast-forward versus a real merge](02-fast-forward-vs-merge.md) · Next → [Resolving a conflict, properly](04-resolving-conflicts.md)
