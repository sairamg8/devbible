---
title: "Patch mode — the habit that improves every commit"
sidebar_label: "03 · Patch mode"
sidebar_position: 3
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against **git 2.55.0** — `man git-add`, sections *INTERACTIVE
> MODE* (the `patch` subcommand key list) and *EDITING PATCHES*.
> **Documentation-validated, not sandbox-proven** — the key table is quoted from
> the manual; no interactive session is reproduced here.

**`git add -p` walks you through your own diff, one hunk at a time, and asks
whether each belongs in this commit. It is the single highest-return habit in
everyday Git: it makes commits small without any planning discipline, and it
catches the debug line you forgot before a reviewer has to.**

## What it is, underneath

`-p` / `--patch` is not a separate feature. The manual is explicit: it *"effectively
runs `add --interactive`, but bypasses the initial command menu and directly jumps
to the patch subcommand"*. What it presents is the diff **between the index and
the working tree** — the second section of
[`git status`](../01-git-status/01-the-three-sections.md) — and each `y` copies
that hunk into the index.

The result is a staged version of the file that exists in **neither** HEAD nor
your working tree. That is only possible because the index is a real file holding
real blobs; `add -p` writes a blob containing exactly the hunks you accepted. It is
the clearest demonstration of why Git has a staging area at all.

## The keys

| Key | Action |
|---|---|
| `y` | stage this hunk |
| `n` | do not stage this hunk |
| `q` | quit — do not stage this hunk or any remaining ones |
| `a` | stage this hunk and **all later hunks in the file** |
| `d` | do not stage this hunk or any later hunks in the file |
| `g` | select a hunk to go to |
| `/` | search for a hunk matching a regex |
| `j` | go to the next **undecided** hunk, rolling over at the bottom |
| `J` | go to the next hunk, rolling over at the bottom |
| `k` | go to the previous undecided hunk, rolling over at the top |
| `K` | go to the previous hunk, rolling over at the top |
| `s` | **split** the current hunk into smaller hunks |
| `e` | manually edit the current hunk |
| `p` | print the current hunk |
| `P` | print the current hunk using the pager |
| `?` | print help |

After every hunk has a verdict, the index is updated with the ones you chose. If
you chose none, nothing happens.

Three of these do most of the work.

**`s` — split.** Git's hunk boundaries come from the diff algorithm's context
rules, not from your intent, so two unrelated edits a few lines apart arrive as one
hunk. `s` splits it wherever there is an unchanged line between the changes. Press
it whenever a hunk contains two things; press it repeatedly until it refuses.

**`?` — help.** The list above is printed on demand. There is no reason to memorise
it, and every reason to know `?` exists.

**`q` versus `d`.** `q` abandons the whole run; `d` abandons the rest of the
current file and moves on to the next one. Reaching for `q` when you meant `d` is
the most common misstep, and it costs you the decisions you had already made in
later files.

`interactive.singleKey=true` removes the need to press Return after each key,
which turns the whole review into single keystrokes. It is the one config setting
that materially changes how pleasant patch mode is.

## Hunk size is a setting

```bash
git add -p -U10                    # 10 lines of context per hunk
git add -p --inter-hunk-context=3  # fuse hunks within 3 lines of each other
```

`-U<n>` / `--unified=<n>` sets the context lines, defaulting to `diff.context` or
3. More context makes each hunk easier to judge and makes hunks merge together;
less context splits them apart. When `s` refuses to split a hunk you are sure
contains two changes, a smaller `-U` is the tool — the two edits are separated by
fewer unchanged lines than the current context requires.

`--inter-hunk-context=<n>` goes the other way, fusing hunks that are close
together (default `diff.interHunkContext`, or 0). Useful when a mechanical change
produces dozens of one-line hunks you intend to accept as a group.

Note one historical quirk from the manual: **`-U` without a number is silently
accepted as a synonym for `-p`**, "due to a historical accident". So `git add -U`
is patch mode, not "unified context of some default". Write the number.

## `e` — editing the hunk by hand

Pressing `e`, or running `git add -e` directly, opens the diff in your editor and
applies the result to the index. This is how you stage **part of a line's worth of
change**, or half of a modification the hunk splitter cannot separate.

The manual gives precise rules, and they are worth following exactly:

| In the patch | To exclude it from staging |
|---|---|
| An added line, starting with `+` | **Delete the line** |
| A removed line, starting with `-` | **Change the `-` to a space** |
| A modification (a `-` line followed by a `+` line) | Change the `-` to a space **and** delete the `+` line |

To abort entirely, **delete every line of the patch** — nothing new is staged.

And the operations that will produce a patch that cannot be applied at all:

- adding context (`" "`) or removal (`"-"`) lines;
- deleting context or removal lines;
- modifying the contents of context or removal lines.

### The mind-bending part

The patch is applied to **the index only**, never the working tree. So anything you
invent while editing appears **reverted** in the working tree afterwards. Stage a
line that exists in neither HEAD nor your file, and Git will duly record it in the
index — and `git status` will then show your working tree as removing it again,
because the file on disk does not contain it.

The manual's advice on those constructs is *"avoid using these constructs, or do so
with extreme caution"*, and that is the right level of enthusiasm. `e` is excellent
for excluding half a hunk and a trap for authoring content.

## The other interactive subcommands

`git add -i` opens the menu that `-p` skips:

```text
*** Commands ***
  1: status       2: update       3: revert       4: add untracked
  5: patch        6: diff         7: quit         8: help
What now>
```

| Subcommand | What it does |
|---|---|
| `status` | The two-column staged/unstaged line counts per path |
| `update` | Multi-select paths and stage them whole — accepts ranges like `2-5 7,9`, `7-` for "the rest", `*` for everything, and `-2` to deselect |
| `revert` | Multi-select paths and reset their staged state to HEAD. **Reverting new paths makes them untracked** |
| `add untracked` | Multi-select from the untracked list |
| `patch` | What `-p` jumps straight to |
| `diff` | Review what will be committed — HEAD versus the index |

The status display is worth recognising, because its two columns are the same two
comparisons the short format uses:

```text
          staged     unstaged path
 1:       binary      nothing foo.png
 2:     +403/-35        +1/-1 add-interactive.c
```

`binary`/`nothing` in place of line counts means exactly what it says: the staged
change is binary so lines cannot be counted, and there is no difference at all
between the index and the working tree for that path.

A prompt ending in a single `>` takes **one** choice; a prompt ending in `>>`
takes **several**, whitespace- or comma-separated, with ranges. Selections are
marked with `*`, and an empty line confirms.

In practice `-i` is rarely the right tool now — `revert` is clearer as
`git restore --staged`, and `update` as `git add -u` with a pathspec. Learn the
menu enough to recognise it, and spend the effort on `-p`.

## Trade-off

**Patch mode buys reviewable history at the cost of a slower commit, and it can
stage something that has never been tested.**

The cost people expect — thirty seconds per commit — is real and small. The cost
they do not expect is the interesting one: the staged version of the file exists
nowhere on disk. It has not been run, compiled or tested. Accept the bug fix while
leaving the refactor unstaged and the resulting commit may not build, even though
your working tree does. Every argument for `git bisect` and for atomic commits
depends on each commit building, so this is not hypothetical.

The defence is a habit, not a flag: after staging with `-p`, run
`git stash --keep-index` to hide everything you did not stage, run the tests
against exactly what you are about to commit, then `git stash pop`. `git stash` is
[topic 12](../README.md) of this phase, and this is its single best use.

That said, the failure mode of `git add -A` is worse and far more common: the
commit builds, and contains three unrelated changes plus a stray credential. Patch
mode's risk is one you can check for; `-A`'s risk is one you find out about in
review, or in a security audit.

## Gotchas

**Symptom:** `git add -p` shows one hunk containing two unrelated changes, and `s` will not split it
**Cause:** the changes are closer together than the context setting, so the splitter sees one region
**Fix:** re-run with fewer context lines — `git add -p -U1` — or use `e` and delete the `+` lines you do not want

**Symptom:** you pressed `q` intending to skip the rest of one file
**Cause:** `q` quits the entire run; `d` is the per-file version
**Fix:** re-run `git add -p`; decisions already staged are kept, so the cost is only the re-walk

**Symptom:** after `e`, `git status` shows the working tree *removing* the line you just staged
**Cause:** the edited patch is applied to the index only. A line staged but absent from the file on disk shows as an unstaged deletion
**Fix:** this is documented behaviour, not corruption. Either put the line in the file too, or unstage with `git restore --staged`

**Symptom:** the edited patch fails to apply
**Cause:** context or removal lines were added, deleted or modified — the three operations the manual lists as making a patch unapplicable
**Fix:** only delete `+` lines and convert `-` to a space. To abandon, delete every line of the patch

**Symptom:** a commit staged with `-p` fails CI although the working tree was green
**Cause:** the staged content was never executed — it is a version of the file that exists in neither HEAD nor your disk
**Fix:** `git stash --keep-index`, run the tests, `git stash pop`. Make it the habit for anything larger than a one-line change

**Symptom:** `git add -U` unexpectedly entered patch mode
**Cause:** `-U` with no number is a documented historical synonym for `-p`
**Fix:** always write the number: `-U10`

## Interview questions

**★ What does `git add -p` let you do that `git add` cannot?**
Stage selected hunks of a file rather than the whole file, producing a staged
version that exists in neither HEAD nor the working tree. That is only possible
because the index holds its own full blob for the path.

**★ What do `s`, `a`, `d` and `q` do in patch mode?**
`s` splits the current hunk into smaller ones; `a` stages this and all later hunks
in the file; `d` skips this and all later hunks in the file; `q` quits the whole
run without deciding the remainder.

**★ You accepted a hunk with `e` and now the working tree shows it being removed. Why?**
The edited patch is applied to the index only. A line present in the index but not
on disk reads as an unstaged deletion. The manual warns about exactly this and
advises extreme caution when inventing content in `e`.

**★ How do you exclude a removed line while editing a patch?**
Change its leading `-` to a space. To exclude an added line, delete it. To abandon
the edit entirely, delete every line of the patch.

**Why might a commit staged with `-p` fail to build even though your working tree is fine?**
Because the staged combination of hunks has never been run. The fix is
`git stash --keep-index`, test, `git stash pop` — testing exactly what will be
committed.

**When does `s` refuse to split a hunk, and what do you do?**
When there are not enough unchanged lines between the changes for the current
context setting. Reduce the context (`-U1`) so the hunk boundaries fall between
them, or edit the hunk by hand with `e`.

**What is `interactive.singleKey` and why turn it on?**
It removes the need to press Return after each patch-mode key, so reviewing a diff
becomes a series of single keystrokes. It is the setting that makes `-p` fast
enough to use by default.

---

← Prev: [Pathspecs, properly](02-pathspecs.md) · Next → [`git commit`](../README.md)
