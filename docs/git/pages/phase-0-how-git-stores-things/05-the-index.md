---
title: "The index is a real file"
sidebar_label: "05 · The index"
sidebar_position: 5
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 on **git 2.55.0** (`git --version`). Script:
> `sandbox/git-p0/ex2-object-model.sh`, sections 3, 4 and 10.

**"Staged" is not a flag on a file. The index is a binary file at `.git/index`
holding a complete list of paths with their blob hashes and cached filesystem
metadata. `git add` writes the content into the object store and records the
hash there — which is why staging is a copy, not a bookmark.**

## It is a file, and it announces itself

```console
$ ls -1 .git
COMMIT_EDITMSG
config
description
HEAD
hooks
index
info
logs
objects
refs
$ file .git/index
.git/index: Git index, version 2, 2 entries
```

Version 2, two entries — one per staged path. Delete this file and Git rebuilds
it from HEAD; everything you had staged (but no working-tree content) is lost.

## What an entry contains

```console
$ git ls-files --stage
100644 ce013625030ba8dba906f756967f9e9ca394464a 0	greeting.txt
100644 d0f87bf2ef282c7a997d8c88e5d2539bbfe562db 0	src/math.js
```

Four columns: **mode**, **blob hash**, **stage number**, **path**. The hash is
the important one — `ce013625…` is a real object that `git add` wrote into
`.git/objects` before recording it here. Staging is not deferred work; the
content is already stored.

That is why staged work survives disasters that unstaged work does not: a blob
in the object store can be recovered with `git fsck --lost-found` even if no
commit ever referenced it.

### The stage number, and why it is `0`

The third column is the merge stage. In normal operation it is always `0`.
During a conflicted merge, one path can occupy three entries at once — `1` for
the merge base, `2` for ours, `3` for theirs. That is how Git holds all three
versions of a conflicted file simultaneously, and why `git checkout --ours` /
`--theirs` have something to select from. A `git status` showing `UU` means the
index has stage 1, 2 and 3 entries for that path and no stage 0.

## Staging is a copy — the consequence

```console
$ git status --short          # staged AND modified, at the same time
AM greeting.txt
A  src/math.js
```

Because the index recorded a *hash*, editing the file afterwards cannot change
what is staged. The index still points at `hello\n`; the disk now holds
`hello\nworld\n`. Both are true, and `git commit` will use the index.

## Why the cached stat data matters

Each entry also stores the file's size and modification time as of staging.
`git status` uses them to skip work: if a file's stat data is unchanged, Git
assumes the content is unchanged and does not re-hash it. On a large repository
this is the difference between an instant `status` and one that reads every
file.

It also explains two behaviours that look like bugs:

- A `status` that is slow the first time after checkout and fast afterwards —
  the cache is being populated.
- A repository where *everything* shows as modified on a network or Windows
  share — the filesystem reports modes or timestamps Git cannot match, so the
  cache never validates. `core.fileMode=false` and `core.trustctime=false` are
  the usual settlements.

## What the index makes possible

| Capability | Why it needs an index |
|---|---|
| `git add -p` | Stage some hunks of a file and not others — the index holds a version of the file that exists in neither HEAD nor your disk |
| Reviewing before committing | `git diff --staged` shows exactly the future commit, because the index *is* the future commit |
| Conflict resolution | Three stages per path hold base/ours/theirs at once |
| Fast `status` | Cached stat data lets Git skip re-hashing unchanged files |

## Trade-off

**The index buys precision and costs a whole extra state.**

Without it, commits would be "everything currently on disk" and `git add -p`
could not exist — you could not commit the bug fix while leaving the debug
logging uncommitted. With it, there is a third version of the project that is
neither what you last committed nor what you are looking at in your editor, and
it is invisible unless you ask. Every `AM`, every "I committed the wrong
version", every "diff shows nothing" traces back to this.

The mitigation is one habit: `git diff --staged` before `git commit`.

## Gotchas

**Symptom:** `git commit` recorded an older version of the file than the one on disk
**Cause:** the file was edited after `git add`; the index holds the hash from staging time
**Fix:** `git add` again then `git commit --amend`. Read `git diff --staged` first, every time

**Symptom:** every file in the repository shows as modified, suddenly
**Cause:** the cached stat data no longer validates — often a filesystem that reports different modes (Windows shares, some network mounts) after a tooling or OS change
**Fix:** `git config core.fileMode false` where the filesystem lies about the executable bit; re-check with `git diff` to confirm the *content* is unchanged

**Symptom:** `git status` is slow on a large repository
**Cause:** the stat cache is not helping — either it is cold, or something is touching every file (a build, a container mount)
**Fix:** confirm with a second run; if it stays slow, `core.untrackedCache` and `core.fsmonitor` are the levers (Phase 9)

**Symptom:** `.git/index.lock` exists and every command fails
**Cause:** a Git process died mid-write, or an editor's Git integration is running concurrently
**Fix:** make sure no Git process is running, then delete `.git/index.lock`. The index itself is intact — the lock is only a mutex

## Interview questions

**★ Is the staging area a list of filenames?**
No. `.git/index` is a binary file holding, per path, a mode, a **blob hash**,
a stage number and cached stat data — shown above with `git ls-files --stage`.
The content is already in the object store by the time it is staged.

**★ What happens if you edit a file after `git add`?**
Nothing to the index: it still points at the hash captured at staging time.
`git status --short` shows `AM`, and a commit now records the older content.

**★ Why is it possible to stage part of a file?**
Because the index holds a full blob independent of both HEAD and your disk.
`git add -p` writes a blob containing only the hunks you selected, so the staged
version can be one that exists nowhere else.

**★ What is the third column in `git ls-files --stage`?**
The merge stage: `0` normally, and `1`/`2`/`3` for base/ours/theirs while a
conflict is unresolved. It is how Git keeps three versions of one path in the
index at the same time.

**If you delete `.git/index`, what have you lost?**
Only staging. Git rebuilds the index from HEAD, so tracked files with no staged
changes are unaffected, and working-tree content is untouched. Any staged-but-
uncommitted arrangement is gone — though the blobs remain in the object store.

**Why does staged work survive a `reset --hard` better than unstaged work?**
Staging writes real objects into `.git/objects`. Even with no ref pointing at
them, `git fsck --lost-found` can recover the blobs. Content that was never
staged exists only on disk, and `--hard` overwrites it.

---

← Prev: [The three trees](04-three-trees.md) · Next → [Refs and HEAD](06-refs-and-head.md)
