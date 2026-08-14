---
title: "Resolving a conflict, properly"
sidebar_label: "04 · Resolving conflicts"
sidebar_position: 4
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against **git 2.55.0** — `man git-merge` (HOW CONFLICTS ARE
> PRESENTED, `--abort`, `--continue`), `man git-status` (the unmerged XY codes),
> `man git-checkout` (`--ours`, `--theirs`), `man git-mergetool`.
> **Documentation-validated, not sandbox-proven.**

**A conflict is not an error state. It is Git saying "both sides changed this, you
decide" and handing you all three versions in the index. The whole procedure is:
find out what is conflicted, understand what each side wanted, write the version
you want, mark it resolved, continue.**

## What a conflict actually is

For each conflicted path, the index holds **three entries instead of one**:

| Stage | Version |
|---|---|
| 1 | the merge base — the common ancestor |
| 2 | **ours** — the branch you are on |
| 3 | **theirs** — the branch being merged in |

There is no stage-0 entry, which is what "unresolved" means to Git
([the index](../phase-0-how-git-stores-things/05-the-index.md)). `git status`
prints these as the doubled codes from the
[short format](../phase-1-everyday-loop/01-git-status/02-the-short-format.md) —
`UU` both modified, `AA` both added, `DU` deleted by us, and so on.

Marking a path resolved means **writing a stage-0 entry**, which is exactly what
`git add <file>` does. That is why `git add` is the "I have resolved this" verb,
and it is worth knowing that it is not a metaphor — you are collapsing three index
entries into one.

## The procedure

```bash
git status                      # 1. what is conflicted, and in what way
git diff                        # 2. see the conflicting hunks
# 3. edit each file: keep what you want, remove ALL markers
git add <file>                  # 4. mark it resolved
git status                      # 5. confirm nothing is left unmerged
git merge --continue            # 6. finish (or `git commit`)
```

Step 5 is the one people skip, and it is the one that catches a file you edited
but forgot to `add`, or a marker you left in a file you thought you had finished.

At any point before step 6:

```bash
git merge --abort               # back to before the merge
```

⚠️ `--abort` is reliable only if your working tree was clean when the merge
started — the manual is explicit that uncommitted changes may not be
reconstructible. Commit or stash before merging.

## Reading the markers

```text
<<<<<<< HEAD
timeout = 30
||||||| merge base
timeout = 10
=======
timeout = 60
>>>>>>> feature
```

Top is **ours** (the branch you are on), bottom is **theirs**. The middle section
only appears with `merge.conflictStyle = zdiff3`, and it is the base — set that
config before you need it, because it is the section that tells you *what changed*
rather than just what differs. See
[the three-way merge](03-three-way-merge.md).

**Resolving means producing the file you want.** That is frequently neither side:
if they raised the timeout to 60 and you added a comment explaining why it is 30,
the right answer is 60 with an updated comment. Picking a side is a shortcut, not
the definition.

Every marker line must go. `<<<<<<<`, `|||||||`, `=======` and `>>>>>>>` are text
Git wrote into your file; nothing removes them for you.

## Taking one side wholesale

```bash
git checkout --ours  path/to/file      # our version of this file
git checkout --theirs path/to/file     # their version
git restore --source=MERGE_HEAD -- f   # equivalently, theirs
git add path/to/file
```

These operate on **whole files**, not hunks, and they are the right tool for
generated files: a lockfile, a compiled asset, a snapshot. For a lockfile the
better answer is usually to take either side and **regenerate** it:

```bash
git checkout --ours package-lock.json
npm install                            # regenerate from package.json
git add package-lock.json
```

A hand-merged lockfile is a lockfile that describes a dependency tree nobody has
ever installed.

⚠️ **During a rebase, "ours" and "theirs" swap.** The manual warns about this
directly. In a rebase your commits are being replayed **onto** the other branch,
so "ours" is the branch you are replaying onto — usually `main` — and "theirs" is
your own work. This is confusing for everyone the first several times; check with
`git diff` before trusting either flag inside a rebase.

## Checking your resolution

```bash
git diff AUTO_MERGE       # only the changes YOU made while resolving
git diff --check          # whitespace errors and leftover conflict markers
git grep -n '<<<<<<<'     # blunt but effective
```

`git diff --check` catches leftover markers, and it is worth running before every
merge commit. Nothing in Git stops you committing a file full of `<<<<<<<`.

## Merge tools

```bash
git mergetool                          # open a configured three-pane tool
git config --global merge.tool <name>  # meld, vimdiff, kdiff3, vscode, ...
```

A three-pane tool shows base, ours and theirs side by side, which is the same
three inputs as `zdiff3` in a friendlier form. Worth configuring for large or
frequent conflicts; unnecessary for a two-line disagreement.

Older versions left `.orig` backup files behind; `mergetool.keepBackup false`
turns that off, and it is worth adding `*.orig` to your global ignore file.

## `rerere` — resolve once, reuse

```bash
git config --global rerere.enabled true
```

**Re**use **re**corded **re**solution. Git records how you resolved a conflict and
replays that resolution automatically the next time it sees the same one.

The case it exists for is repeated rebases: rebase a long-lived branch onto a
moving `main` and you hit the *same* conflict every time. With `rerere` on, you
resolve it once.

It is off by default and worth turning on globally. The one caution: it will
silently apply a past resolution, so if you resolved it wrongly the first time, it
will keep being wrong. `git rerere forget <path>` clears a recorded resolution.

## Not just merges

The same conflict machinery — and the same three index stages — is used by
`rebase`, `cherry-pick`, `revert`, `stash pop` and `pull`. The only differences
are which command continues:

| Operation | Continue | Abandon |
|---|---|---|
| merge | `git merge --continue` | `git merge --abort` |
| rebase | `git rebase --continue` | `git rebase --abort` |
| cherry-pick | `git cherry-pick --continue` | `git cherry-pick --abort` |
| revert | `git revert --continue` | `git revert --abort` |
| stash pop | resolve, then `git stash drop` | `git checkout -- .` |

`git status` names which one you are in ([the three
sections](../phase-1-everyday-loop/01-git-status/01-the-three-sections.md)), so
when in doubt, read it rather than guessing.

## Trade-off

**Git makes conflict resolution a manual, textual decision — which is why it is
trustworthy and why it does not scale.**

The design refuses to guess. It gives you three versions and a decision, and the
result is that Git essentially never silently loses a change in a conflicted
region. That is a genuinely strong property, and it is why `-X ours` and `-s ours`
feel dangerous: they are the ways of opting out of it.

What you pay is that resolution is entirely on you, at text-hunk granularity,
with no understanding of the language. A long-running branch against a busy `main`
produces the same conflicts repeatedly, and each round is manual work with no
memory — which is exactly the hole `rerere` was invented to fill.

The structural fix is not a better tool, it is shorter-lived branches: a branch
merged daily conflicts rarely and trivially; a branch merged after a month
conflicts in proportion to everything that happened meanwhile. Every conflict-
resolution technique on this page is a mitigation for a branch that lived too
long.

## Gotchas

**Symptom:** you committed a file containing `<<<<<<<` markers
**Cause:** nothing in Git prevents it — markers are ordinary text once written
**Fix:** `git diff --check` before every merge commit, and `git grep -n '<<<<<<<'` as a belt-and-braces check

**Symptom:** `--ours` gave you the wrong side during a rebase
**Cause:** documented behaviour — in a rebase your commits are replayed onto the other branch, so "ours" is that branch, not your work
**Fix:** check with `git diff` before choosing. Inside a rebase, "theirs" is usually your own commit

**Symptom:** `git merge --continue` refuses, saying there are unmerged paths
**Cause:** a file was edited but never `git add`ed, so the index still holds stages 1/2/3 for it
**Fix:** `git status` lists them. `git add` each one — that is what writes the stage-0 entry

**Symptom:** the merge finished but the application is broken in a way neither side was
**Cause:** a hand-merged generated file — usually a lockfile — now describes a state that was never installed
**Fix:** take one side and regenerate: `git checkout --ours <lockfile>` then re-run the package manager

**Symptom:** `git merge --abort` left your working tree in a strange state
**Cause:** there were uncommitted changes when the merge started; `--abort` cannot always reconstruct them
**Fix:** commit or stash before merging. Afterwards, `git reset --hard ORIG_HEAD` if you are willing to lose the uncommitted work

**Symptom:** the same conflict, every time you rebase
**Cause:** each rebase replays the same commits over a moved base, hitting the same textual disagreement
**Fix:** `git config --global rerere.enabled true`. Resolve once and Git replays it — and `git rerere forget <path>` if you get it wrong

---

← Prev: [The three-way merge](03-three-way-merge.md) · Next → [`git rebase`](05-git-rebase.md)
