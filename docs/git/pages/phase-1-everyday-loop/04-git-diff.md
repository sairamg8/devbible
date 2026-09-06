---
title: "`git diff` and the three questions it answers"
sidebar_label: "04 · git diff"
sidebar_position: 4
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against **git 2.55.0** — `man git-diff` (DESCRIPTION's seven
> invocation forms, OPTIONS). **Documentation-validated, not sandbox-proven**;
> the one console block is recorded output from
> `sandbox/git-p0/ex2-object-model.sh`.

**`git diff` always compares two things. The entire command is: which two? Get
that wrong and the output is not wrong — it is answering a different question,
which is why "my change disappeared" is nearly always a `diff` with no flag when
`--staged` was meant.**

## The three you use every day

| Command | Compares | The question it answers |
|---|---|---|
| `git diff` | **working tree ↔ index** | What have I changed that is **not staged**? |
| `git diff --staged` | **index ↔ HEAD** | What exactly will the next commit contain? |
| `git diff HEAD` | **working tree ↔ HEAD** | What have I changed since the last commit, staged or not? |

`--cached` is the older synonym of `--staged`; they are identical, and `--staged`
reads better. The manual's own framing of the bare form is the useful one: the
differences are *"what you could tell Git to further add to the index but you
still haven't."*

Phase 0 ran the first two side by side on the same working tree:

```console
$ git diff --stat             # working tree vs index
 greeting.txt | 1 +
 1 file changed, 1 insertion(+)
$ git diff --staged --stat    # index vs HEAD
 greeting.txt | 1 +
 src/math.js  | 1 +
 2 files changed, 2 insertions(+)
```

<small>Recorded output — `sandbox/git-p0/ex2-object-model.sh` §4, kept in
`sandbox/git-p0/ex2-output.txt`. Two different answers about one repository, at
one moment, because they are two different comparisons.</small>

These are the same three pairings as the three sections of
[`git status`](01-git-status/01-the-three-sections.md). `status` tells you *which
files* differ; `diff` tells you *how*. They are one tool split in two.

**The habit worth building:** `git diff --staged` immediately before every
`git commit`, or `commit.verbose=true` so it appears in the editor automatically.

## Comparing commits and branches

| Form | Compares |
|---|---|
| `git diff <commit>` | Working tree ↔ that commit |
| `git diff <a> <b>` | Commit `a` ↔ commit `b` |
| `git diff <a>..<b>` | Identical to the above — the `..` is decoration here |
| `git diff <a>...<b>` | **Merge base** of `a` and `b` ↔ `b` |
| `git diff --merge-base <a> <b>` | Same as `a...b`, spelled explicitly |

The three-dot form is the one worth learning properly. `git diff main...feature`
shows **what the feature branch changed**, ignoring everything that landed on
`main` in the meantime — it is equivalent to
`git diff $(git merge-base main feature) feature`.

Two dots shows something different and usually less useful: every difference
between the two tips, including `main`'s new commits appearing as if your branch
had deleted them.

**Pull requests show the three-dot diff.** If a review looks nothing like your
change, you are probably reading a two-dot diff locally. Use `...` to see what
the reviewer sees.

Note that `...` means something else entirely in `git log`, where it selects the
symmetric difference of two commit sets. Same punctuation, different tool,
different meaning — this catches people, and it is a genuine wart.

## Limiting the diff

```bash
git diff -- src/                   # only this directory
git diff --staged -- '*.ts'        # only TypeScript, quoted so Git expands it
git diff HEAD -- ':!package-lock.json'   # everything except the lockfile
```

Everything after `--` is a path. The pathspec rules are the same ones
[`git add` uses](02-git-add/02-pathspecs.md), including `:(exclude)` and its short
form `:!` — and excluding a generated lockfile is the difference between reading
a change and scrolling past it.

## Reading a unified diff

```text
diff --git a/src/invoice.js b/src/invoice.js
index 4a3b2c1..9f8e7d6 100644
--- a/src/invoice.js
+++ b/src/invoice.js
@@ -12,7 +12,7 @@ function total(items) {
```

<small>The shape of a diff header, annotated below — a schematic, not a capture.</small>

| Line | What it tells you |
|---|---|
| `diff --git a/… b/…` | The two sides. `a/` is the "before", `b/` the "after" — they are conventional prefixes, not directories |
| `index 4a3b2c1..9f8e7d6 100644` | The blob hashes of both versions, and the file mode. A mode change shows up here |
| `--- a/…` / `+++ b/…` | Before and after paths. `/dev/null` on one side means the file was created or deleted |
| `@@ -12,7 +12,7 @@` | The hunk header: from line 12, 7 lines, on each side. The text after it is the enclosing function, found heuristically |

Inside a hunk, `-` is removed, `+` is added, and a leading space is unchanged
context. Those single leading characters are why a diff cannot be pasted into a
file as-is, and why `git apply` exists.

## The options that make diffs readable

| Option | What it does |
|---|---|
| `--stat` | One line per file with a change count. The right first look at anything large |
| `--name-only` | Just the filenames — pipe-friendly |
| `--name-status` | Filenames prefixed with `A`/`M`/`D`/`R`, the same letters as `git status` |
| `-w` / `--ignore-all-space` | Ignore whitespace entirely. The reformatting rescue |
| `--ignore-space-change` | Ignore *amount* of whitespace but not its presence |
| `--word-diff` / `--color-words` | Highlight changed words rather than whole lines. For prose and long lines |
| `-U<n>` | More or fewer context lines than the default 3 |
| `--color-moved` | Colour blocks that **moved** differently from ones that changed. Turns a giant refactor diff into a readable one |
| `-M` / `--find-renames` | Detect renames (on by default in most commands); `-M40%` lowers the similarity threshold |
| `--patience` / `--diff-algorithm=histogram` | A different diff algorithm when the default lines up the wrong braces |

`--color-moved` and `-w` are the two that most often turn "this diff is
unreviewable" into "oh, that is all it does". They are worth knowing before the
day you need them.

## When the diff looks nothing like your change

Git's default algorithm optimises for a small diff, not a meaningful one. On code
with many similar lines — closing braces, JSX, repeated config blocks — it can
pair up the wrong ones and produce a diff that is technically minimal and
humanly unreadable.

```bash
git diff --diff-algorithm=histogram
git config diff.algorithm histogram     # make it the default
```

`histogram` (an improved `patience`) prefers matching rare lines first, which
usually lines up the change the way a person would. It costs a little more time
and is a reasonable default for a code repository.

## Binary files and generated output

Git prints `Binary files a/x and b/x differ` rather than the content. That is not
a failure — a diff of two PNGs would be noise. But it is the tell that something
in the repository is not diffable, and therefore not really reviewable: images,
lockfiles the size of a novel, compiled assets, `.pdf`s.

`.gitattributes` can mark a path as binary explicitly, or point a `diff` driver at
something that can summarise it. The bigger question — should that file be in Git
at all — belongs to [what Git is not](../phase-0-how-git-stores-things/12-what-git-is-not.md).

## Diffing things that are not commits

```bash
git diff --no-index old.txt new.txt    # two files, no repository needed
git difftool -d main                   # open the whole diff in your merge tool
```

`--no-index` makes Git a general-purpose diff tool; it implies `--exit-code`, so
it is scriptable. `git difftool` runs the same comparisons through a configured
GUI, and `-d` shows the whole change as two directory trees rather than file by
file.

## Trade-off

**A diff is a story Git makes up about how one snapshot became another, and the
default story is optimised for size rather than for comprehension.**

Git stores snapshots ([commits are snapshots](../phase-0-how-git-stores-things/02-commit-is-a-snapshot.md));
every diff you read is computed on demand. Nothing about "these 7 lines changed"
is recorded anywhere — it is one of many valid descriptions of the difference, and
Git picks the smallest by default.

That is why a rename plus an edit can read as a delete plus an add, why a
reformat can bury a one-line fix under 400 changed lines, and why moving a
function reads as deleting it and writing a new one. None of these is a bug; they
are the cost of not recording intent.

The mitigation is to know the knobs before you are stuck with an unreadable
review: `-w` for whitespace, `--color-moved` for moves, `-M40%` for renames, and
`--diff-algorithm=histogram` when the pairing itself is wrong. The alternative
mitigation is upstream and better: keep the reformat in its own commit, so the
diff never has to be untangled.

## Gotchas

**Symptom:** `git diff` prints nothing, but you definitely changed something
**Cause:** the change is staged. Bare `git diff` compares the working tree to the **index**, and they now agree
**Fix:** `git diff --staged` for the staged change, or `git diff HEAD` for everything since the last commit

**Symptom:** `git diff main feature` shows changes that are not yours
**Cause:** the two-dot form compares the tips, so commits added to `main` since you branched appear as differences
**Fix:** `git diff main...feature` — the merge-base form, and the one a pull request shows

**Symptom:** a review diff is 400 lines for a one-line fix
**Cause:** a reformat, a line-ending change or an editor stripping trailing whitespace, mixed into the same commit
**Fix:** `git diff -w` to read it now; commit formatting separately in future so the diff never needs untangling

**Symptom:** a moved function reads as a large delete plus a large add
**Cause:** Git does not record moves; it infers them, and rename detection works per file, not per block
**Fix:** `git diff --color-moved` distinguishes moved blocks from changed ones; `-M40%` lowers the rename threshold for whole files

**Symptom:** the diff pairs up the wrong lines — closing braces matched to the wrong opening
**Cause:** the default Myers algorithm minimises diff size, and repetitive code has many equally small answers
**Fix:** `git diff --diff-algorithm=histogram`, or set `diff.algorithm=histogram` for the repository

**Symptom:** `git diff` on a file prints only `Binary files … differ`
**Cause:** Git detected binary content and will not print it
**Fix:** expected. Ask whether the file belongs in the repository; if it does, a `.gitattributes` diff driver can summarise it

## Interview questions

**★ `git diff` prints nothing but you have definitely changed something. What is
going on?**
The change is staged. Bare `git diff` compares the working tree to the *index*, and
once you have run `git add` those two agree, so there is nothing to print. The
command is not wrong — it is answering a different question from the one you meant.
`git diff --staged` shows index against `HEAD`, which is exactly what the next
commit will contain, and `git diff HEAD` shows everything since the last commit,
staged or not.

**★ What is the difference between `git diff a b` and `git diff a...b`, and which one
does a pull request show?**
Two dots compares the two tips, so anything that landed on `a` since you branched
appears as a difference — usually as if your branch had deleted it. Three dots
compares the **merge base** of the two against `b`, which is exactly *what your
branch changed*. A pull request shows the three-dot diff, so if a review looks
nothing like the change you thought you made, you are almost certainly reading a
two-dot diff locally.

**★ Why can a one-line fix produce a 400-line diff, and what do you do about it?**
Because the diff is computed, not recorded. Git stores snapshots and works out a
description of the difference on demand, so a reformat, a line-ending change or an
editor stripping trailing whitespace is indistinguishable from real work in the
output. To read it now, `-w` ignores whitespace entirely. The better fix is
upstream: keep the reformat in its own commit so the diff never has to be
untangled by the reviewer.

**★ Why does a moved function read as a large delete plus a large add?**
Because Git does not record moves, it infers them, and rename detection works per
*file* rather than per block — a function relocated inside a file, or across two
files that both still exist, has nothing to match. `--color-moved` colours blocks
that moved differently from ones that changed, which turns a large refactor into a
readable diff, and `-M40%` lowers the similarity threshold for whole-file renames.
Neither is a bug fix; both are ways of asking Git for a more useful story.

**★ The diff has matched the wrong closing brace and reads as nonsense. Why, and
what is the switch?**
The default algorithm minimises the *size* of the diff, not its meaning, and code
with many identical lines — closing braces, JSX, repeated config blocks — has many
equally small answers to choose from. `--diff-algorithm=histogram` prefers matching
rare lines first, which lines the change up the way a person would, and
`git config diff.algorithm histogram` makes it the default. It costs slightly more
time and is a reasonable default for a code repository.

**How does `git diff` relate to `git status`?**
They are one tool split in two, over the same three pairings: working tree against
index, index against `HEAD`, and working tree against `HEAD`. `status` tells you
*which files* differ, `diff` tells you *how*. That is why the sections of a
`status` line up exactly with the three everyday `diff` forms, and why "read
`status`, then `diff --staged`, then commit" is a loop rather than three unrelated
commands.

**What does `Binary files a/x and b/x differ` actually tell you?**
That Git detected binary content and declined to print it — which is correct
behaviour, since a diff of two PNGs would be noise. It is also a signal worth
reading: a file Git cannot diff is a file nobody can review, so images, compiled
assets and enormous lockfiles are being version-controlled without being
inspectable. `.gitattributes` can point a diff driver at something that summarises
the format, but the better question is usually whether the file belongs in the
repository at all.

---

← Prev: [`git commit`](03-git-commit.md) · Next → [`.gitignore`](05-gitignore.md)
