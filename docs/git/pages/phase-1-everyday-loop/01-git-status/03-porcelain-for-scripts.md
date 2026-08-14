---
title: "Porcelain, for scripts"
sidebar_label: "03 · Porcelain for scripts"
sidebar_position: 3
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against **git 2.55.0** — `man git-status`, sections
> *Porcelain Format Version 1*, *Porcelain Format Version 2* and *Pathname Format
> Notes and -z*. **Documentation-validated, not sandbox-proven** — the formats
> below are quoted from the specification, not from a capture.

**Anything that parses `git status` output and is not using `--porcelain` is a
bug that has not fired yet. The human formats are documented as changeable and
they honour the user's configuration; the porcelain formats are contractually
stable and ignore it. That is the whole distinction, and it is worth taking
seriously in a five-line shell function, not only in a real tool.**

## What `--porcelain` guarantees

`--porcelain` (equivalently `--porcelain=v1`) prints something that looks like
the short format, with two promises the short format does not make:

1. It **will not change** in a backwards-incompatible way between Git versions.
2. It **ignores user configuration** — `color.status` is forced off, and
   `status.relativePaths` is ignored, so paths are always relative to the
   repository root.

The second promise is the one that bites in practice. `git status -s` prints
paths relative to your *current directory*, so the same script produces different
strings depending on where it was launched from. A CI job that runs from the repo
root and a pre-commit hook that runs from a subdirectory will disagree, and the
difference will look like a Git bug rather than a config-dependent format.

One more simplification: in porcelain v1, all the submodule vocabulary from the
[short format](02-the-short-format.md) — `M`, `m`, `?` — collapses back to a
plain `M`. A stable format cannot afford a vocabulary that grows over time.

## `-z`, and the three things it changes

```bash
git status --porcelain -z
```

`-z` is not just "use NUL instead of newline". It changes three things, and each
removes an ambiguity a hostile filename could exploit:

- entries are terminated with **NUL** instead of a newline — a filename can
  contain a newline, it cannot contain a NUL;
- for renames the `->` is dropped and **the field order reverses**, becoming
  `to<NUL>from` rather than `from -> to`;
- filenames are printed **raw**, with no quoting and no backslash-escaping.

That last point is the pair to a behaviour in the non-`-z` formats: without `-z`,
a path with unusual characters is quoted as explained under the `core.quotePath`
config. So a parser has a choice — implement C-string unquoting correctly, or use
`-z` and never think about it again. Only one of those is a good use of an
afternoon.

`-z` implies `--porcelain=v1` when no other format was requested, so
`git status -z` is already a machine format.

## Porcelain v2 — when you need hashes, modes and scores

Version 2 keeps the stability guarantee and adds structure. Header lines start
with `#`, and parsers are told explicitly to **ignore headers they do not
recognise** — that instruction is what lets the format grow without breaking
anyone.

With `--branch`:

| Line | Notes |
|---|---|
| `# branch.oid <commit>` or `(initial)` | Current commit |
| `# branch.head <branch>` or `(detached)` | Current branch |
| `# branch.upstream <upstream-branch>` | Only if an upstream is set |
| `# branch.ab +<ahead> -<behind>` | Only if an upstream is set and the commit is present |

`--show-stash` adds `# stash <N>`, printed only when the count is non-zero.

Then one line per entry, in one of five shapes:

```text
1 <XY> <sub> <mH> <mI> <mW> <hH> <hI> <path>
2 <XY> <sub> <mH> <mI> <mW> <hH> <hI> <X><score> <path><sep><origPath>
u <XY> <sub> <m1> <m2> <m3> <mW> <h1> <h2> <h3> <path>
? <path>
! <path>
```

`1` is an ordinary change, `2` a rename or copy, `u` an unmerged path, `?`
untracked, `!` ignored. The manual warns that tracked entries are printed in an
**undefined order** and that the three tracked line types may be mixed — a parser
must not assume grouping.

### The fields

| Field | Meaning |
|---|---|
| `<XY>` | The same two characters as the short format — except **unchanged is `.` rather than a space**, so the field never contains whitespace |
| `<sub>` | `N...` for a normal file; `S<c><m><u>` for a submodule, where `C` / `M` / `U` flag a changed commit, tracked changes and untracked changes (`.` otherwise) |
| `<mH> <mI> <mW>` | The octal file mode in HEAD, the index and the worktree |
| `<hH> <hI>` | The object name in HEAD and in the index |
| `<X><score>` | The rename or copy similarity score — `R100` for an exact rename, `C75` for a 75 %-similar copy |
| `<m1> <m2> <m3>` and `<h1> <h2> <h3>` | For unmerged paths only: the modes and object names in **stages 1, 2 and 3** — base, ours, theirs |
| `<path>` | The pathname; for a rename or copy, the **target** |
| `<sep>` | A TAB between the two pathnames — or NUL under `-z` |
| `<origPath>` | Where a renamed or copied path came from, present only on `2` lines |

Two of these are worth dwelling on.

**`.` instead of a space** is the clearest signal that v2 is a machine format and
its v1 cousin is not. In the short format, `M ` and ` M` are opposite meanings
distinguished by whitespace; in v2 they are `M.` and `.M`, and a naive
`split(' ')` cannot destroy them.

**The stage 1/2/3 hashes** expose the index's conflict representation directly. A
merge tool can fetch base, ours and theirs with three `git cat-file` calls and
never touch the working tree — which is exactly how graphical merge tools
populate their three panes.

### Modes are not decoration

`<mH> <mI> <mW>` are the octal modes in the three trees, which makes v2 the only
status format that can distinguish a content change from a mode change without a
second command. `100644` → `100755` is a permission bit; `100644` → `120000` is a
file that became a symlink — the `T` code from the short format, with the evidence
attached.

## Which one to reach for

| You want | Use |
|---|---|
| A fast look while working | `git status -sb` |
| A shell one-liner or a shell prompt | `git status --porcelain` |
| Anything that must survive weird filenames | `git status --porcelain -z` |
| Hashes, modes, rename scores, conflict stages | `git status --porcelain=v2 --branch` |
| A commit preview for a human | `git status -v` — see [the long format](01-the-three-sections.md) |

The two most common real uses are both one-liners. "Is the tree dirty?" is
`test -z "$(git status --porcelain)"` — an empty output means clean, and it is
empty regardless of colour settings, language or relative paths. "Are there
untracked files I should worry about?" is the same command filtered for `??`.

## Rename detection is a `status` option too

Git does not record renames; it detects them at diff time by content similarity
(the mechanism is topic 14 of this phase, `git rm`, `git mv` and rename detection).
`status` participates in that, and can be told what to do:

| Flag | Effect |
|---|---|
| `--renames` / `--no-renames` | Force detection on or off, ignoring config |
| `--find-renames[=<n>]` | Turn detection on with an explicit similarity threshold |
| `status.renames` | The config default; set it to `copies` to detect copies too, which is what enables the `C` code and the `2`-line `C<score>` field |

Detection costs time proportional to the number of added and deleted paths, which
is why copy detection is off by default and why `--no-renames` is a real
optimisation on a commit that moved a thousand files.

## Trade-off

**A stable format costs expressiveness, and Git chose to ship both rather than
compromise either.**

The long format can be improved whenever a clearer wording is found, because
nothing depends on it. Porcelain v1 can never gain the submodule vocabulary,
because a parser written in 2010 must still work. Version 2 exists precisely
because v1's guarantee had become a ceiling — the only way to add hashes, modes
and scores was a new format with its own version number and an explicit
"ignore unknown headers" rule.

The cost lands on you as one decision, made once per script: **who reads this
output?** If the answer is a person, use `-s` or the long format and enjoy the
better wording. If it is any parser at all — including `grep` in a shell function
— use `--porcelain`, and add `-z` if the repository could contain a filename you
did not choose.

## Gotchas

**Symptom:** a script that ran fine for a year suddenly mis-reads paths
**Cause:** it parsed `git status -s`, which honours `status.relativePaths` — the output changed with the directory the script was launched from
**Fix:** `--porcelain` (or `--porcelain=v2`), which always prints root-relative paths and ignores user config

**Symptom:** a script breaks on one specific file
**Cause:** the filename contains a space, a quote or a newline, and the non-`-z` format quotes it as a C string literal
**Fix:** `git status --porcelain -z` and split on NUL. Remember the rename fields also **reverse order** under `-z`

**Symptom:** a parser reads `git status --porcelain=v2` and mis-assigns half the fields
**Cause:** it assumed `1`, `2` and `u` lines appear in groups. The manual says tracked entries come in an **undefined order** and may be mixed
**Fix:** dispatch on the first character of every line, never on position

**Symptom:** a script's "is the tree clean?" check passes on a machine with junk files lying around
**Cause:** untracked reporting is switched off in that user's config, or the check filtered out `??` lines
**Fix:** decide explicitly — `git status --porcelain -uall` if untracked files should count, `-uno` if they should not. Do not inherit the answer from config

**Symptom:** an internationalised CI job fails to detect a dirty tree
**Cause:** it grepped for an English phrase from the long format, which is translated
**Fix:** porcelain output is not translated. `test -z "$(git status --porcelain)"`

## Interview questions

**★ Why should a script use `--porcelain` rather than `-s`?**
`--porcelain` is guaranteed stable across Git versions and ignores user
configuration — colour forced off, paths always relative to the repository root.
The short format is explicitly documented as subject to change and varies with
the user's settings, so a script that parses it depends on the environment it
happens to run in.

**★ What does `-z` change beyond the line terminator?**
Three things: entries end with NUL rather than newline, rename entries drop the
`->` and reverse to `to<NUL>from`, and filenames are printed raw with no quoting
or escaping. It implies `--porcelain=v1` if no format was given.

**★ Why does porcelain v2 use `.` where the short format uses a space?**
So the two-character status field never contains whitespace and a parser can split
on spaces safely. It is the clearest single sign that v2 was designed for machines
and v1's human cousin was not.

**★ What does `R100` mean in porcelain v2?**
A rename with a similarity score of 100 % — identical content, different path.
`C75` would be a copy whose source and target are 75 % similar. The score only
appears on `2` lines.

**How would you check "is the working tree clean" in a shell script?**
`test -z "$(git status --porcelain)"`. Empty output means clean. Decide
deliberately whether untracked files count and pass `-uall` or `-uno` rather than
inheriting the user's `status.showUntrackedFiles`.

**What information can porcelain v2 give you that v1 cannot?**
The object names in HEAD and the index, the octal file modes in all three trees,
rename and copy similarity scores, the full submodule state field, structured
branch headers, and — for conflicts — the modes and hashes of stages 1, 2 and 3.

**Why can porcelain v1 never gain the submodule `m` and `?` codes?**
Because its guarantee is that it will not change incompatibly. A parser written
against the original format must keep working, so new vocabulary had to go into a
new version — which is exactly why v2 exists and why its header rule tells
parsers to ignore what they do not recognise.

---

← Prev: [The short format](02-the-short-format.md) · Next → [Untracked files, performance and config](04-untracked-and-performance.md)
