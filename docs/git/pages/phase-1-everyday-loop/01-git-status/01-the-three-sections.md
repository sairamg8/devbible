---
title: "The long format is three questions"
sidebar_label: "01 · The three sections"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against **git 2.55.0** — `man git-status` (DESCRIPTION,
> OUTPUT) and the message strings shipped inside the `git` binary itself
> (`strings $(command -v git)`). **Documentation-validated, not sandbox-proven:**
> every message quoted below is one Git ships; nothing is a reconstructed
> terminal capture.

**`git status` does not report "the state of your files". It reports three
comparisons, in a fixed order, and each section is one pair of the three trees.
Once you read the sections as comparisons, the command stops being a wall of
text and becomes the answer to "which of my changes are where".**

## The sentence in the manual that explains the whole layout

The DESCRIPTION in `man git-status` is unusually precise, and it is the entire
design in two sentences:

> Displays paths that have differences between the index file and the current
> HEAD commit, paths that have differences between the working tree and the
> index file, and paths in the working tree that are not tracked by Git (and are
> not ignored by gitignore(5)). The first are what you would commit by running
> `git commit`; the second and third are what you could commit by running
> `git add` before running `git commit`.

Three groups, three comparisons, and a statement of what each one means for your
next command:

| Section heading | The comparison | What it means |
|---|---|---|
| **Changes to be committed** | HEAD ↔ **index** | This *is* the next commit. Nothing else is. |
| **Changes not staged for commit** | index ↔ **working tree** | Real edits Git knows about, that `git commit` will ignore |
| **Untracked files** | in the working tree, in neither of the other two | Files Git has never been told about, and is not ignoring |

That is the same [three trees](../../phase-0-how-git-stores-things/04-three-trees.md)
from Phase 0, printed top to bottom in the order the content flows: working tree
→ index → commit, read upwards.

## Why the first section is the important one

Everything above the second heading is the commit you are about to make. Not
"roughly" — exactly. `git commit` writes a tree built from the index, and the
first section is the index diffed against HEAD.

This is the fix for the single most common surprise in daily Git: *"I committed,
but my change isn't in it."* The change was in the second section. Git told you,
in a heading, and the heading was read as a category label rather than as a
statement about the next commit.

The habit that follows is small and pays forever: **read the first section as
a commit preview, and if it does not read like the commit you intend to make,
do not commit yet.**

## The same file can appear in two sections at once

This is the part that looks like a bug and is the model working correctly.
Stage a file, then edit it again. The staged content and the on-disk content are
now different, so:

- the **first** section lists the file — the staged version differs from HEAD;
- the **second** section lists the same file — the working tree differs from the
  staged version.

There is no contradiction. The index holds a hash captured at `git add` time
([the index is a real file](../../phase-0-how-git-stores-things/05-the-index.md)),
so editing afterwards cannot change what is staged. This is exactly the `AM` code
the [short format](02-the-short-format.md) prints for it, and it was measured
in Phase 0 rather than assumed:

```console
$ git status --short          # staged AND modified, at the same time
AM greeting.txt
A  src/math.js
```

<small>Recorded output — `sandbox/git-p0/ex2-object-model.sh` §4, kept in
`sandbox/git-p0/ex2-output.txt`.</small>

## The hints are the answer, not decoration

Under every heading, Git prints the commands that move files *out* of that
section. They are not generic help text — they are chosen for the state you are
actually in, and they are correct more often than most people expect. These are
the strings the 2.55.0 binary ships:

| Section | Hint Git prints |
|---|---|
| Changes to be committed | `(use "git restore --staged <file>..." to unstage)` |
| …in a repository with **no commit yet** | `(use "git rm --cached <file>..." to unstage)` |
| …when a `--source` is in play | `(use "git restore --source=<commit> --staged <file>..." to unstage)` |
| Changes not staged for commit | `(use "git add <file>..." to update what will be committed)` |
| | `(use "git restore <file>..." to discard changes in working directory)` |
| Untracked files | `(use "git add <file>..." to include in what will be committed)` |
| Nothing staged, but edits exist | `no changes added to commit (use "git add" and/or "git commit -a")` |

Two of these repay a closer look.

**`git rm --cached` in a fresh repository.** Before the first commit there is no
HEAD to restore *from*, so `restore --staged` has nothing to name. Git detects
that and prints a different hint. If you ever wondered why unstaging advice seems
to change, that is why — it is state-dependent, not inconsistent.

**`(use "git restore <file>..." to discard changes in working directory)`** is
the only hint on this list that destroys work. Everything else moves content
between trees; that one throws away the working-tree version, and there is no
reflog for content that was never staged or committed. Git prints it in exactly
the same tone as the others, which is worth knowing before you paste it.

You can silence all of it with `advice.statusHints=false`. That is a reasonable
setting for someone who has internalised the three trees, and a bad one for
anyone still learning them.

## The clean states, and how they differ

There are three "nothing to do" messages, and they are not interchangeable:

| Message Git prints | What it actually means |
|---|---|
| `nothing to commit, working tree clean` | Index matches HEAD, working tree matches index, no untracked files |
| `nothing to commit (use -u to show untracked files)` | Same, except untracked files were **suppressed** by `-uno` or `status.showUntrackedFiles=no` |
| `nothing to commit (create/copy files and use "git add" to track)` | An empty repository — nothing tracked at all yet |

The middle one is a small trap in a repository configured for speed. "Working
tree clean" is not what it says, and it is not what it means: there may be
untracked files sitting right there. More on that setting and its cost in
[untracked files and performance](04-untracked-and-performance.md).

## The header line — where you are, before what changed

Above the sections, `git status` answers a different question: what is HEAD, and
how does it compare to its upstream.

| Header Git prints | State |
|---|---|
| `On branch <name>` | The normal case — HEAD is a symbolic ref |
| `HEAD detached at <commit>` | Detached, sitting exactly on a named commit |
| `HEAD detached from <commit>` | Detached, and you have committed since detaching |
| `You are on a branch yet to be born` | The branch name exists in HEAD, but has no commits |
| `Your branch is ahead of '<upstream>' by N commits.` | Tracking info, when an upstream is configured |

The ahead/behind counts come from comparing your branch to its remote-tracking
ref — **not** from contacting the remote. They are as fresh as your last `fetch`
and no fresher, which is the whole content of Phase 4's "your branch is behind"
confusion.

Detached HEAD is worth pausing on because `status` is where most people meet it.
Git's own wording is deliberately calm — *"You are in 'detached HEAD' state. You
can look around, make experimental…"* — because it is a normal state, not an
error. Phase 0's [refs and HEAD](../../phase-0-how-git-stores-things/06-refs-and-head.md)
covers why.

## `git status` is also the "what am I in the middle of" command

An interrupted operation leaves state on disk, and `status` is the command that
reports it. Every one of these lines ships in the 2.55.0 binary:

| Line | You are inside |
|---|---|
| `You have unmerged paths.` | A conflicted merge |
| `All conflicts fixed but you are still merging.` | A merge, resolved but not committed |
| `You are currently rebasing branch '<x>' on '<y>'.` | A rebase |
| `Last commands done (N commands done):` | An interactive rebase — with the todo progress |
| `You are currently editing a commit while rebasing branch '<x>' on '<y>'.` | `edit` in an interactive rebase |
| `You are currently splitting a commit while rebasing branch '<x>' on '<y>'.` | A commit being split mid-rebase |
| `You are currently cherry-picking commit <sha>.` | A cherry-pick |
| `You are currently reverting commit <sha>.` | A revert |
| `You are currently bisecting, started from branch '<x>'.` | A bisect |
| `You are in the middle of an am session.` | `git am`, usually a patch series |
| `You are in a sparse checkout with N% of tracked files present.` | A sparse checkout |

This is why "run `git status` first" is genuinely the right advice when something
has gone wrong, and not a platitude. A repository in the middle of a rebase
behaves differently from a clean one — commands are refused, HEAD is somewhere
unexpected, and a conflicted file is in three index stages at once. `status` names
the situation before you type anything that assumes otherwise.

The interactive-rebase case deserves special mention: `Last commands done` prints
the todo list's progress, so you can see which pick you are stuck on without
opening `.git/rebase-merge/`.

## `-v` — see the change, not just the filename

`git status -v` appends the staged diff (the same content as
`git diff --staged`), and `-v -v` appends the unstaged diff below it. So:

```bash
git status -v        # header + sections + the exact diff that will be committed
git status -vv       # the above, plus what you are leaving behind
```

`-vv` is the closest thing Git has to a single "show me everything, in the right
order" command, and it is the strongest possible version of the commit-preview
habit. It is also why the long format's contents are documented as *"subject to
change at any time"* — it is a template for humans, and Git reserves the right to
improve it. Never parse it; see [porcelain, for scripts](03-porcelain-for-scripts.md).

## Paths are relative to where you are standing

One more piece of deliberate design: unlike most Git commands, the paths in
`status` output are relative to your **current directory**, not the repository
root. The manual says this is on purpose — so you can copy a path out of the
output and paste it into the next command without editing it.

`status.relativePaths=false` switches to repository-root paths. The `--porcelain`
formats ignore the setting entirely and always print root-relative paths, which
is exactly what a script wants.

## Gotchas

**Symptom:** you committed, and your change is not in the commit
**Cause:** the change was in *Changes not staged for commit*; `git commit` only ever writes the index
**Fix:** `git add` the file and `git commit --amend`. Make reading the first section — or `git status -v` — the step before every commit

**Symptom:** the same file is listed twice, in two different sections
**Cause:** it was edited after `git add`; the staged version and the on-disk version genuinely differ
**Fix:** nothing is broken. `git add` again to make them agree, or `git diff` to see what the commit would miss

**Symptom:** `nothing to commit` while there are obviously new files on disk
**Cause:** untracked files are suppressed — `-uno`, or `status.showUntrackedFiles=no` in config
**Fix:** `git status -uall`, and check with `git config --show-origin status.showUntrackedFiles` to find which config file set it

**Symptom:** "your branch is behind by 3 commits" but the remote has 20 new commits
**Cause:** the counts compare against the **remote-tracking ref**, which is only as current as your last fetch
**Fix:** `git fetch` first, then read `status` again. The count was never live

**Symptom:** a script that reads `git status` output broke after a Git upgrade
**Cause:** the long format is explicitly documented as subject to change, and it also honours the user's colour and `status.relativePaths` config
**Fix:** `git status --porcelain=v1` (or `v2`), which is contractually stable — see [porcelain, for scripts](03-porcelain-for-scripts.md)

## Interview questions

**★ What are the three sections of `git status`, in terms of the three trees?**
*Changes to be committed* is HEAD versus the index; *Changes not staged for
commit* is the index versus the working tree; *Untracked files* is the working
tree only. The first is the next commit; the other two are not part of it until
`git add` moves them.

**★ A file appears under both "to be committed" and "not staged". What happened?**
It was staged and then edited. The index holds the blob hash captured at `git add`
time, so the staged content and the on-disk content are two different versions and
both are reported. The short format prints this as `AM` or `MM`.

**★ You run `git commit` and the change is missing. Where do you look first?**
At the *Changes not staged for commit* section of the `status` you ran before
committing. `git commit` builds a tree from the index and nothing else, so
anything below the first heading was never a candidate.

**★ Does `git status` contact the remote to compute "ahead 2, behind 1"?**
No. It compares the branch with its remote-tracking ref in `refs/remotes/`, which
is updated by `fetch`, `pull` and `push` — never by `status`. The counts are as
stale as your last fetch.

**Why should a script never parse `git status` output?**
The long format is documented as subject to change at any time, and it varies with
the user's colour settings and `status.relativePaths`. `--porcelain=v1` is
guaranteed stable across versions and ignores user configuration; `--porcelain=v2`
adds structured headers for the same guarantee.

**What does `git status -vv` show that `git status` does not?**
The staged diff and, below it, the unstaged diff — the exact content of the next
commit followed by what you would be leaving behind. It is `git diff --staged`
and `git diff` folded into the status output, in the order the trees flow.

**Git says `nothing to commit, working tree clean`. Can there still be new files?**
Yes, if they are ignored — ignored files are never listed unless `--ignored` is
passed. And if untracked reporting is switched off, Git prints the different
message `nothing to commit (use -u to show untracked files)` instead, which is
the tell.

---

← Prev: [Topic index](README.md) · Next → [The short format and its two columns](02-the-short-format.md)
