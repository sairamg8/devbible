---
title: "Removing and moving files"
sidebar_label: "12 · rm, mv and clean"
sidebar_position: 12
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against **git 2.55.0** — `man git-rm`, `man git-mv`,
> `man git-clean` (DESCRIPTION and OPTIONS), `man git-diff` (`-M`,
> `--find-renames`). **Documentation-validated, not sandbox-proven.**

**Three ways for a file to stop being where it was, and they are not
interchangeable. `git rm` deletes something tracked. `git clean` deletes something
untracked. `git mv` is a convenience that records nothing — because Git does not
store renames at all, it infers them later by comparing content.**

## `git rm` — delete a tracked file

```bash
git rm old-module.js            # delete from the working tree AND stage the deletion
git rm --cached .env            # remove from the index only; the file stays on disk
git rm -r legacy/               # recursive, for directories
git rm -f still-modified.js     # override the safety check
```

`git rm` refuses if the file has changes that are not committed — that is the
check `-f` overrides. The refusal is deliberate: deleting a tracked file with
uncommitted edits destroys those edits, and Git makes you say so.

**`--cached` is the one to know.** It untracks without deleting, which is the fix
for a committed `.env` or `node_modules` — covered fully in
[ignoring does not untrack](06-ignoring-does-not-untrack.md).

You can also just delete the file with your editor or `rm`, then `git add -A` (or
`git add -u`) to stage the deletion. Both routes produce the same commit; `git rm`
does it in one step and refuses when it would lose work.

## `git mv` — and the thing it does not do

```bash
git mv old-name.js new-name.js
```

This is exactly equivalent to:

```bash
mv old-name.js new-name.js
git add new-name.js
git rm --cached old-name.js
```

**Nothing about the rename is recorded.** The commit contains one path gone and
another path added, and there is no field anywhere in the object model saying they
are related — [tree objects](../phase-0-how-git-stores-things/03-object-types.md)
hold names and blob hashes, and nothing else.

That is a deliberate design choice, and it works because of what comes next.

## Rename detection, and when it fails

Renames are **detected at diff time**, by similarity. When Git prints a diff it
looks at the deleted and added paths and pairs up any whose content is similar
enough — the default threshold is 50%, and an exact rename scores `R100`.

The consequences you actually meet:

| Situation | What you see | Why |
|---|---|---|
| Rename only | `R` in `git status`, `R100` in porcelain v2 | Content identical, 100% similar |
| Rename + small edit | `R` with a lower score | Still above the threshold |
| Rename + heavy rewrite | `D` plus `??` — **delete plus add** | Similarity fell below 50% |
| Rename of a tiny file | Often `D` plus `??` | Little content to compare; small edits swing the ratio hugely |

```bash
git status --find-renames=40%      # lower the threshold
git log --follow -- new-name.js    # follow history across a rename
git diff -M50% --stat              # explicit threshold on a diff
```

`git log --follow` is the one worth remembering. Without it, `git log -- <file>`
stops at the rename, because that path did not exist before it — which is why
history "disappears" after a move.

**The practical rule: move in one commit, edit in the next.** A pure rename is
always detected; a rename tangled with a rewrite may not be, and no flag reliably
recovers a pairing that is genuinely below the threshold.

### The case-only rename trap

On macOS and Windows, the filesystem is usually case-insensitive, so renaming
`User.js` to `user.js` may not register at all — Git sees no change, or sees a
confusing half-state. The reliable route is two steps through a temporary name:

```bash
git mv User.js temp.js && git mv temp.js user.js
```

This is a genuine cross-platform bug source: the rename works on the Linux CI box
and not on the developer's laptop, or vice versa.

## `git clean` — delete what Git is *not* tracking

This is the dangerous one, because it removes files Git has no copy of.

```bash
git clean -n            # DRY RUN. always first
git clean -f            # remove untracked files
git clean -fd           # ...and untracked directories
git clean -fdx          # ...and ignored files too
git clean -i            # interactive
```

| Flag | Effect |
|---|---|
| `-n` / `--dry-run` | Show what would be removed. Removes nothing |
| `-f` / `--force` | Actually delete. **Required** unless `clean.requireForce` is set to false |
| `-d` | Recurse into untracked **directories** — without it, they are left alone |
| `-x` | **Ignore the ignore rules** — also delete ignored files |
| `-X` | Delete **only** ignored files, keeping other untracked ones |
| `-e <pattern>` | An extra exclude pattern for this run |
| `-i` | Interactive mode, which is its own safety net |

Three things to internalise:

**`-f` is required by default.** Git refuses without it (`clean.requireForce`),
and refuses to touch an untracked **nested Git repository** unless you pass `-f`
**twice**. That second guard exists because deleting someone's unpushed clone is
unrecoverable.

**`-d` is needed for directories**, and its absence is why "`git clean -f` didn't
clean anything" is a common complaint. With a pathspec, `-d` is irrelevant —
everything matching is removed.

**`-x` is the one that eats your `.env`.** It disables the ignore rules, so
everything untracked-and-ignored goes: `.env`, local databases, `node_modules`,
editor settings, build caches. `git clean -fdx` is a genuinely useful command for
reproducing a clean build — and it is the single most common way people delete
their own local configuration.

The habit is not optional: **`git clean -n` first, read the list, then repeat with
`-f`.** `-i` is the interactive alternative and needs no `-f`.

## Which command, from the sentence

| What you want | Command |
|---|---|
| "Delete this file and record it" | `git rm <file>` |
| "Stop tracking it, keep it on disk" | `git rm --cached <file>` |
| "Rename this" | `git mv <old> <new>` |
| "Where did this file's history go?" | `git log --follow -- <file>` |
| "Get rid of these stray untracked files" | `git clean -n`, then `git clean -fd` |
| "Give me a pristine tree for a clean build" | `git clean -fdx` — **check `-n` first** |
| "Undo my edits to a tracked file" | `git restore <file>` — not `clean` ([topic 07](07-switch-and-restore.md)) |

The last row is the distinction that matters: **`clean` only ever touches
untracked files.** It cannot revert an edit to a tracked file, and `restore`
cannot remove an untracked one. People reach for the wrong one under stress
because both are spelled "make this go away".

## Trade-off

**Not recording renames keeps the object model tiny and makes every rename a
guess.**

The benefit is real and structural: a tree object holds names and hashes, a commit
holds a tree, and nothing has to track file identity over time. Content addressing
means an unchanged file that moved is the *same blob* — the repository stores no
extra bytes for the move, and there is no rename metadata to become wrong when
history is rewritten, rebased or filtered.

The cost is that "the history of this file" is not a question Git can answer
directly. It is reconstructed by similarity, per diff, with a threshold — so it
can be wrong, it varies with the flags you pass, and `git log -- <file>` silently
stops at a move unless you remember `--follow`.

The mitigation is behavioural and cheap: **pure renames in their own commit**.
That gives 100% similarity, unambiguous detection, and a diff a reviewer can read
in one line instead of as several hundred deleted and added lines.

## Gotchas

**Symptom:** `git clean -f` removed nothing, though there are clearly untracked directories
**Cause:** without `-d`, `git clean` does not recurse into untracked directories
**Fix:** `git clean -nd` to preview, then `-fd`

**Symptom:** `git clean -fdx` deleted your `.env` and local database
**Cause:** `-x` disables the ignore rules, so ignored files are deleted too — that is precisely its purpose
**Fix:** none; the files were untracked and Git never had them. Use `-e <pattern>` to protect specific paths, or `-X` to delete only ignored files when that is what you meant

**Symptom:** `git log -- src/new-name.js` shows only commits since the rename
**Cause:** that path did not exist before the move, and Git records no rename
**Fix:** `git log --follow -- src/new-name.js`, which re-detects the rename at each step

**Symptom:** a rename shows as a delete plus an add in review
**Cause:** the file was edited enough during the move to fall below the 50% similarity threshold
**Fix:** `--find-renames=40%` to read it now; in future commit the move and the edit separately

**Symptom:** renaming `User.js` to `user.js` does nothing
**Cause:** a case-insensitive filesystem — macOS and Windows — so no change is visible to Git
**Fix:** two steps through a temporary name: `git mv User.js temp.js && git mv temp.js user.js`

**Symptom:** `git rm` refuses with a message about local modifications
**Cause:** the file has uncommitted changes, and deleting it would destroy them
**Fix:** commit or stash them first. `-f` overrides, and there is no undo for the discarded edits

**Symptom:** `git clean` refused to remove a directory containing `.git`
**Cause:** it is an untracked nested repository, and Git guards it behind a **second** `-f`
**Fix:** confirm it holds nothing unpushed before passing `-ff`. This guard exists because that deletion is unrecoverable

---

← Prev: [`git stash`](11-git-stash.md) · Next → [Phase 1 index](README.md)
