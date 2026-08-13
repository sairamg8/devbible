---
title: "A commit is a snapshot, not a diff"
sidebar_label: "02 · Snapshot, not diff"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 on **git 2.55.0** (`git --version`). Script:
> `sandbox/git-p0/ex2-object-model.sh`, sections 5 and 11.

**Every commit names a complete tree describing the entire project at that
moment. Git does not store "what changed" — it stores "what everything was", and
computes the change when you ask for it. The diffs you read all day are derived
output, not stored data.**

This is the single most common misconception about Git, and it is worth being
precise about because two very different things are both true: the *model* is
snapshots, and the *storage* uses deltas. Confusing the two is what makes
packfiles sound like they contradict this page.

## What a commit object contains

Print one. There is nothing hidden:

```console
$ git cat-file -p HEAD
tree 867606d725142c531644a7572a2b400a9160e51e
author dev <dev@example.com> 1786615200 +0000
committer dev <dev@example.com> 1786615200 +0000

Add greeting and math helper
```

Five things: one tree, zero or more parents (this is the first commit, so none),
an author, a committer, and a message. **No file contents and no diff.** The
`tree` line is the entire snapshot, by reference.

Follow it and you get the project's root directory as it stood:

```console
$ git cat-file -p HEAD^{tree}   # the root tree
100644 blob 94954abda49de8615a048f8d2e64b5de848e27a1	greeting.txt
040000 tree 451e85bb5416042fc0bec926639f9f1f31f4d220	src
$ git cat-file -p HEAD:src      # a subdirectory is its own tree object
100644 blob d0f87bf2ef282c7a997d8c88e5d2539bbfe562db	math.js
```

A tree is a directory listing: mode, type, hash, name. Directories nest as more
trees. That recursive structure *is* the snapshot — walk it and you can
reconstruct every byte of the project without consulting any other commit.

## Why a snapshot is not expensive

The obvious objection: if every commit snapshots everything, does a 10 000-file
repository store 10 000 blobs per commit?

No — because of [content addressing](01-what-git-is.md). A file that did not
change hashes to the same name, so the new tree simply points at the *same*
blob. Change one file in a 10 000-file project and the new commit creates: one
new blob, one new tree per directory on the path to it, and one commit object.
Every other entry is a pointer to an object that already exists.

So the snapshot model gets diff-like storage economy for free, without ever
representing history as a chain of patches.

## Where deltas actually live

Deltas are real, but they are a *packfile* concern — a storage layer beneath the
model, applied across objects that resemble each other regardless of which
commits they belong to:

```console
$ find .git/objects -type f | wc -l      # loose objects before gc
51
$ du -sh .git/objects
204K	.git/objects
$ git gc && find .git/objects -type f -not -path "*/pack/*" | wc -l
2
$ du -sh .git/objects
36K	.git/objects
$ git count-objects -vH
count: 0
size: 0 bytes
in-pack: 51
packs: 2
size-pack: 6.03 KiB
prune-packable: 0
garbage: 0
size-garbage: 0 bytes
```

51 loose objects, 204K on disk, became 2 packfiles totalling 6.03 KiB of packed
content. Inside a packfile Git stores some objects as deltas against a similar
base object and zlib-compresses the result.

The important part: **nothing above the packfile knows this.** `git cat-file -p`
still hands you a whole object, `git show` still reconstructs a whole tree.
Delta compression can be turned off and every command behaves identically, just
using more disk. That is the test for "storage detail versus model".

## What follows from snapshots

| Consequence | Why |
|---|---|
| `git show <old-commit>` is as fast as a recent one | It reads one tree, not a chain of patches replayed from the beginning |
| Checking out any commit is a direct operation | The tree fully describes the working state; there is nothing to replay |
| Two commits' content can be compared directly | Equal tree hashes mean identical directories — no diff needed |
| A corrupt object breaks one object, not everything after it | Nothing downstream is expressed *in terms of* it, unlike a patch chain |

The last row is the real robustness argument. In a system that stores history as
sequential patches, a damaged early patch invalidates everything built on top.
Here, each snapshot stands alone.

## Trade-off

**Snapshots cost storage that a pure patch model would not, and make "the diff"
an interpretation rather than a fact.**

Storage is the smaller cost — packfiles claw most of it back, as measured above.
The interpretive cost is the one you feel: because Git never recorded what you
*did*, only what things *became*, a rename is not stored as a rename, a move
between directories is a delete plus an add until similarity detection says
otherwise, and `git diff` output can change depending on which algorithm
(`myers`, `histogram`, `patience`) you ask for. The bytes are certain; the story
about them is reconstructed.

## Gotchas

**Symptom:** "Git stores diffs, so how can it store a snapshot per commit without exploding?"
**Cause:** conflating the object model with packfile storage
**Fix:** both are true at different layers — the model is snapshots, the storage deduplicates identical blobs and delta-compresses inside packfiles. Verified above: 51 objects, 6.03 KiB packed

**Symptom:** a commit that "only changed one line" created several objects
**Cause:** a new blob, plus a new tree for every directory from the root down to that file, plus the commit
**Fix:** expected and cheap. Trees are tiny; only the changed path is rebuilt, and every untouched entry is a pointer to an existing object

**Symptom:** `.git` did not shrink after deleting files and committing
**Cause:** old commits still name the old trees and blobs, so they remain reachable — and reachable objects are never garbage collected
**Fix:** normal operation. Only a history rewrite removes content that earlier commits still reference

**Symptom:** two commits look identical in `git show` but have different hashes
**Cause:** the commit object also hashes the parent, both timestamps and both identities — none of which appear in the diff you are reading
**Fix:** compare `git rev-parse <commit>^{tree}` on both. Equal tree hashes prove the content matches even when the commits differ

## Interview questions

**★ Does Git store snapshots or differences between versions?**
Snapshots. Each commit points to one tree that fully describes the project.
Diffs are computed on demand. Delta compression exists inside packfiles as a
storage optimisation, and no command's behaviour depends on it.

**★ If every commit is a full snapshot, why isn't the repository enormous?**
Unchanged files hash to the same object name, so a new commit's trees point at
the *existing* blobs — only genuinely new content is stored. Packfiles then
delta-compress what remains: measured 204K of loose objects packing down to
6.03 KiB.

**★ What exactly is inside a commit object?**
A tree hash, zero or more parent hashes, author (name, email, timestamp),
committer (the same three, often different values), and the message. Printed
above with `git cat-file -p HEAD` — no file contents appear in it.

**Why is `git checkout` of a five-year-old commit not slow?**
Because that commit's tree describes the whole project directly. There is no
patch chain to replay — Git reads one tree, walks its subtrees, and writes the
files out.

**What is the difference between a tree and a directory?**
A tree is the stored object: a sorted list of (mode, type, hash, name) entries.
A directory is what appears on disk when Git materialises one. A tree has no
location and no timestamp, which is why the same tree object can appear in many
commits and many paths.

**How can you tell whether two branches contain identical files?**
Compare tree hashes: `git rev-parse main^{tree}` and
`git rev-parse feature^{tree}`. Identical hashes prove byte-identical content —
a stronger and cheaper check than reading a diff.

---

← Prev: [What Git actually is](01-what-git-is.md) · Next → [The four object types](03-object-types.md)
