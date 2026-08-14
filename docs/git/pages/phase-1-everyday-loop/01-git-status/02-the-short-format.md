---
title: "The short format and its two columns"
sidebar_label: "02 · The short format"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against **git 2.55.0** — `man git-status`, section *Short
> Format*. **Documentation-validated, not sandbox-proven**; the one console block
> below is recorded output from `sandbox/git-p0/ex2-object-model.sh`.

**`git status -s` prints two columns, and they are not "status" and "detail" —
they are two independent comparisons. The left column is the index against HEAD.
The right column is the working tree against the index. Read them as a pair and
every code in the table decodes itself.**

## The grammar

```text
<xy> <path>
<xy> <orig-path> -> <path>
```

The second form appears only for a rename or a copy. `<xy>` is always exactly two
characters, and the fields are separated by a single space. A filename containing
whitespace or non-printable characters is quoted like a C string literal — double
quotes, with interior characters backslash-escaped.

The two characters mean different things depending on which of three situations
the path is in, and this is the part that is usually missed:

| Situation | What X means | What Y means |
|---|---|---|
| Normal, or a **successful** merge | The index versus HEAD — *staged* | The working tree versus the index — *unstaged* |
| An **unresolved** merge conflict | The state introduced by **our** side, relative to the merge base | The state introduced by **their** side, relative to the merge base |
| **Untracked** | Always `?` | Always `?` — the path is unknown to the index, so there is nothing to compare |

"Merge" here means more than `git merge`: the manual is explicit that it also
covers rebases using the default `--merge` strategy, cherry-picks, and anything
else that runs the merge machinery.

## The character legend

For the two tracked cases, X and Y are drawn from:

| Char | Meaning |
|---|---|
| *(space)* | unmodified |
| `M` | modified |
| `T` | file type changed — regular file ↔ symlink ↔ submodule |
| `A` | added |
| `D` | deleted |
| `R` | renamed |
| `C` | copied — only when `status.renames` is set to `copies` |
| `U` | updated but unmerged |

And the two whole-path codes:

| Code | Meaning |
|---|---|
| `??` | untracked |
| `!!` | ignored — **only shown when `--ignored` is passed** |

`T` is the one people meet without recognising it. Replacing a regular file with
a symlink is not a modification in Git's model, it is a mode change, and it gets
its own letter.

## Reading the common codes

| Code | X says | Y says | In English |
|---|---|---|---|
| `??` | — | — | Untracked. Git has never been told about this file |
| `A ` | added to the index | clean | Newly staged, and the disk agrees |
| `AM` | added to the index | modified since | **Staged, then edited again.** The commit will take the older content |
| ` M` | clean | modified | Edited, not staged. `git commit` will ignore it |
| `M ` | modified in index | clean | Staged and unchanged since — the normal "ready to commit" state |
| `MM` | modified in index | modified since | Partially staged — usually the result of `git add -p` |
| ` D` | clean | deleted | Deleted on disk, still in the index |
| `D ` | deleted from index | — | `git rm`'d, staged |
| `R ` | renamed in index | clean | Rename detected, staged |
| `RM` | renamed in index | modified since | Renamed, then edited |
| `T ` | type changed in index | clean | e.g. a file became a symlink, staged |

The whole table in the manual reduces to one rule worth carrying instead of a
lookup: **X blank means nothing is staged; Y blank means the working tree matches
the index.** `M ` and ` M` are opposite situations that differ by one space, which
is exactly why the short format is for reading fast and never for parsing.

Phase 0's run demonstrated the first three of these on real files:

```console
$ git status --short          # ?? = in the working tree only
?? greeting.txt
?? src/
$ git add greeting.txt src/math.js && git status --short   # A = in the index
A  greeting.txt
A  src/math.js
$ git status --short          # after editing greeting.txt again
AM greeting.txt
A  src/math.js
```

<small>Recorded output — `sandbox/git-p0/ex2-object-model.sh` §3 and §4, kept in
`sandbox/git-p0/ex2-output.txt`. Note `?? src/` — an untracked *directory*
collapses to one line by default; see
[untracked files](04-untracked-and-performance.md).</small>

## The unmerged codes, and what caused each

During a conflict, X and Y stop meaning staged/unstaged and start meaning
ours/theirs. There are exactly seven combinations, and each one names a specific
conflict:

| Code | Meaning | The situation |
|---|---|---|
| `DD` | both deleted | Both sides deleted the file. Git still asks, because a delete/delete can hide a rename |
| `AU` | added by us | We added a file; their side has nothing there |
| `UD` | deleted by them | We modified it, they deleted it |
| `UA` | added by them | They added a file; our side has nothing there |
| `DU` | deleted by us | We deleted it, they modified it |
| `AA` | both added | Both sides created the same path independently |
| `UU` | both modified | The classic content conflict — the one with `<<<<<<<` markers |

Every one of these has a `U` or a doubled letter, so a conflicted repository is
visually obvious in `-s` output even before you decode the codes.

`UU` connects straight back to the index: a path in that state has **no stage-0
entry** and instead holds stages 1, 2 and 3 — base, ours, theirs — simultaneously.
That is the mechanism behind `git checkout --ours` and `--theirs` having something
to select from, and it is why `git status` can describe a conflict without reading
a single file from disk. See
[the index is a real file](../../phase-0-how-git-stores-things/05-the-index.md).

## Submodules report a fourth vocabulary

A submodule cannot be staged from the superproject the way a file can, so it gets
its own characters:

| Char | Meaning |
|---|---|
| `M` | the submodule's HEAD differs from the commit recorded in the index |
| `m` | the submodule has modified tracked content |
| `?` | the submodule has untracked files |

`m` and `?` apply **recursively** — an untracked file inside a submodule of a
submodule still surfaces as `?` at the top. In `--porcelain=v1` all of this
collapses back to a plain `M`, deliberately: a stable format cannot afford a
vocabulary that grows.

## `-b`: the branch line

`git status -sb` prepends one line:

```text
## <branchname> <tracking-info>
```

In practice that reads as `## main...origin/main [ahead 2, behind 1]` when an
upstream is configured, and just `## main` when there is none. The counts come
from the remote-tracking ref, not from the network — `--no-ahead-behind` skips
computing them, which matters on very large histories.

`--show-stash` adds the number of stash entries, which is the cheapest possible
guard against the classic *"I stashed it last week and forgot"*.

`git status -sb` is the form worth putting in an alias. It fits in a few lines,
names the branch, and shows the two-column truth about every path.

## Trade-off

**The short format buys density and costs self-description.**

`-s` puts twenty files on twenty lines, and an experienced reader takes in the
whole repository state at a glance. The long format takes those same twenty files
and spends thirty lines telling you what each section means and which command
moves things out of it.

The cost is real: `M ` and ` M` are opposite meanings separated by one space, and
nothing on screen says so. The short format assumes you already carry the
two-column model in your head. That is fine — it is one of the highest-value
things to memorise in Git — but it is the reason the long format is still the
default, and the reason `git status` with no flags is the right thing to type when
something has gone wrong and you want Git to explain itself.

The mitigation is not to choose one: `-sb` in an alias for the constant glance,
unadorned `git status` when you are about to do something irreversible.

## Gotchas

**Symptom:** `git status -s` shows `D` and `??` for what was clearly one rename
**Cause:** rename detection found the two files too dissimilar — the content changed too much alongside the move
**Fix:** `git status --find-renames=40%`, or split the move and the edit into two commits so the pairing is unambiguous

**Symptom:** an ignored file never appears in `git status -s`, even though it exists
**Cause:** `!!` is only emitted when `--ignored` is passed; ignored files are suppressed by default
**Fix:** `git status -s --ignored`, and `git check-ignore -v <path>` to find the exact rule that matched

**Symptom:** a submodule shows `?` in the superproject and `git add` cannot clear it
**Cause:** `?` means the submodule contains untracked files — that state belongs to the submodule and cannot be staged from outside it
**Fix:** commit or clean inside the submodule; from the superproject, `--ignore-submodules=untracked` silences it if it is expected

**Symptom:** a file shows `T` and you cannot see any content change
**Cause:** the *type* changed — a regular file became a symlink, or a directory became a submodule. The content may be identical
**Fix:** `git diff` will show the mode change (`100644` → `120000`). Decide deliberately; this is rarely accidental and rarely intended

**Symptom:** `RM` on a file you only renamed
**Cause:** the rename was staged, and then the file was edited on disk afterwards — the same two-column story as `AM`
**Fix:** `git add` it again if the edit belongs in this commit, and check `git diff --staged` before committing

## Interview questions

**★ What do the two columns in `git status -s` mean?**
X is the index compared to HEAD — what is staged. Y is the working tree compared
to the index — what is not staged. During an unresolved conflict they change
meaning entirely: X is our side relative to the merge base, Y is theirs.

**★ What is `AM`?**
Added to the index and modified since. The file was staged, then edited again, so
a commit now would record the older, staged content. `MM` is the same story for a
file that already existed.

**★ What is `UU`, and what does the index look like for that path?**
Both sides modified the file and the conflict is unresolved. The index holds no
stage-0 entry for it; it holds stages 1, 2 and 3 — base, ours, theirs — at the
same time, which is what `--ours` and `--theirs` select between.

**★ Why is `??` always two identical characters?**
Because an untracked path is unknown to the index, so there is nothing to compare
on either side. X and Y have no independent meaning, and Git uses the doubled
character to say so. `!!` for ignored files works the same way.

**What does `T` mean, and why is it not `M`?**
The file type changed — regular file, symlink or submodule. Git records the mode
in the tree object, so a type change is a different kind of difference from a
content change and gets its own letter.

**Why does `git status -s` show `?? src/` rather than every file inside `src/`?**
Untracked reporting defaults to `normal`, which collapses a wholly-untracked
directory to a single entry. `-uall` expands it. The collapse exists because
enumerating every file in a large untracked tree is expensive.

**When would `C` appear in the short format?**
Only when `status.renames` is set to `copies`, which turns on copy detection in
addition to rename detection. It is off by default because copy detection is
significantly more expensive.

---

← Prev: [The three sections](01-the-three-sections.md) · Next → [Porcelain, for scripts](03-porcelain-for-scripts.md)
