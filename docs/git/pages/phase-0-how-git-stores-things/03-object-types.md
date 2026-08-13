---
title: "The four object types"
sidebar_label: "03 · Object types"
sidebar_position: 3
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 on **git 2.55.0** (`git --version`). Script:
> `sandbox/git-p0/ex2-object-model.sh`, sections 5 and 6.

**Everything Git stores is one of four types: a blob is file bytes, a tree is a
directory listing, a commit is a snapshot with parents and metadata, and an
annotated tag is a named pointer with its own message. There is no fifth type,
and no object knows anything Git did not put in it.**

## Counting them in a live repository

`cat-file --batch-all-objects` walks the whole store; `--batch-check` prints one
line per object:

```console
$ git cat-file --batch-all-objects --batch-check="%(objecttype)" | sort | uniq -c
      3 blob
      1 commit
      2 tree
```

Three blobs (two versions of `greeting.txt` and one `math.js`), two trees (the
root and `src/`), one commit. Add an annotated tag and the fourth type appears:

```console
$ git tag -a v0.1 -m "first tag" && (recount)
      3 blob
      1 commit
      1 tag
      2 tree
```

## Blob — content, and nothing else

A blob is the bytes of a file. It has no name, no path, no mode and no
timestamp:

```console
$ git cat-file -s ce013625030ba8dba906f756967f9e9ca394464a   # size in bytes
6
```

The filename lives in the *tree* that points at the blob. That separation is why
identical files anywhere in the project share one object, and why a rename
creates no new blob at all.

## Tree — a sorted directory listing

```console
$ git cat-file -p HEAD^{tree}   # the root tree
100644 blob 94954abda49de8615a048f8d2e64b5de848e27a1	greeting.txt
040000 tree 451e85bb5416042fc0bec926639f9f1f31f4d220	src
$ git cat-file -p HEAD:src      # a subdirectory is its own tree object
100644 blob d0f87bf2ef282c7a997d8c88e5d2539bbfe562db	math.js
```

Each entry is **mode, type, hash, name**. The modes are a deliberately tiny set:

| Mode | Meaning |
|---|---|
| `100644` | regular file |
| `100755` | executable file |
| `120000` | symbolic link (the blob holds the target path) |
| `040000` | directory (another tree) |
| `160000` | gitlink — a submodule's recorded commit |

That is the complete list. Git records the executable bit and nothing else: no
owner, no group, no read/write permissions, no creation time. Anything your
project needs beyond the executable bit has to be re-established at deploy time,
because Git will not carry it.

**Trees are why empty directories cannot be committed.** A tree stores entries;
a directory with no files produces no entries, so there is nothing to store. The
conventional workaround is a `.gitkeep` file, which exists purely to give the
tree something to hold.

## Commit — a snapshot plus lineage

```console
$ git cat-file -p HEAD
tree 867606d725142c531644a7572a2b400a9160e51e
author dev <dev@example.com> 1786615200 +0000
committer dev <dev@example.com> 1786615200 +0000

Add greeting and math helper
```

One tree, zero or more parents, author, committer, message. **Author and
committer are two different fields** and they diverge routinely: rebasing,
cherry-picking and applying a patch all preserve the original author while
recording you as the committer. Both timestamps are stored as Unix seconds plus
an offset — `1786615200 +0000` above.

Parent count is what classifies a commit: zero parents is a root commit, one is
ordinary, two or more is a merge.

## Tag — the only optional type

```console
$ git cat-file -p v0.1
object 107d81646dd232e7933d4e373f98528714900d12
type commit
tag v0.1
tagger dev <dev@example.com> 1786615200 +0000

first tag
```

An **annotated** tag is a real object with a tagger, a date, a message and an
optional signature — which is why releases should use them. A **lightweight**
tag is just a file in `refs/tags/` containing a hash: it creates no object at
all, which is exactly why the object census above only gained a `tag` entry when
`-a` was used.

| | Annotated (`git tag -a`) | Lightweight (`git tag`) |
|---|---|---|
| Creates an object | Yes | No |
| Carries message, tagger, date | Yes | No |
| Can be GPG/SSH signed | Yes | No |
| `git describe` prefers it | Yes | Only with `--tags` |
| Right for | releases | temporary local bookmarks |

## Trade-off

**Four types is a deliberately impoverished vocabulary, and it costs you
fidelity about intent.**

Because there is no "rename" object, no "move" object and no per-file history
object, Git cannot tell you what you *did* — only what the tree became. Renames
are inferred by similarity at diff time, file permissions beyond the executable
bit are lost, and empty directories simply cannot exist. In exchange the model
is small enough to hold in your head, verify by hand, and reason about when
something goes wrong — which is the trade this whole system keeps making.

## Gotchas

**Symptom:** an empty directory disappears after clone
**Cause:** trees store entries; a directory with no entries is not representable
**Fix:** commit a placeholder (`.gitkeep`), or have the application create the directory at runtime

**Symptom:** a file lost its executable bit after checkout, or every file shows as modified on a shared drive
**Cause:** Git stores only `100644` vs `100755`; some filesystems report modes Git then sees as changes
**Fix:** `git update-index --chmod=+x <file>` to set it deliberately; set `core.fileMode=false` where the filesystem lies about modes

**Symptom:** `git log` shows a colleague as author but you as committer
**Cause:** you rebased, cherry-picked or applied their patch — that preserves author and records you as committer
**Fix:** working as intended; it is the audit trail. `--format="%an / %cn"` shows both

**Symptom:** `git describe` ignores the tag you just made
**Cause:** a lightweight tag creates no object, and `describe` looks at annotated tags by default
**Fix:** use `git tag -a` for anything a build or release keys off; `--tags` makes `describe` consider lightweight ones

## Interview questions

**★ Name Git's object types and what each holds.**
Blob (file content, no name), tree (a sorted directory listing of mode/type/
hash/name entries), commit (one tree, zero or more parents, author, committer,
message) and annotated tag (a pointer to an object plus tagger, message and
optional signature). Verified above by censusing a live repository.

**★ What is the difference between a lightweight and an annotated tag?**
A lightweight tag is only a ref file containing a hash — no object is created.
An annotated tag is a real object with its own message, tagger, timestamp and
optional signature. Releases should be annotated; the object census above showed
`tag` appearing only after `git tag -a`.

**★ Where is a file's name stored?**
In the tree that references its blob, not in the blob. That is why two identical
files at different paths are one object, and why renaming a file creates no new
blob.

**★ Why can't Git track an empty directory?**
Because directories exist only as tree *entries*, and an empty directory
produces none. The `.gitkeep` convention exists to give the tree an entry to
record.

**What file metadata does Git preserve?**
The executable bit, and symlink-versus-file. Not owner, group, permissions,
access times or creation times. Anything else your deployment needs must be set
by the deployment.

**How can you tell a merge commit from an ordinary one, at the object level?**
Count its `parent` lines: two or more means a merge, one is ordinary, none is a
root commit. `git cat-file -p <sha>` shows them directly.

---

← Prev: [A commit is a snapshot](02-commit-is-a-snapshot.md) · Next → [The three trees](04-three-trees.md)
