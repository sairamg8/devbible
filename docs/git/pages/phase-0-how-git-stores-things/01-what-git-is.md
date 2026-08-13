---
title: "What Git actually is"
sidebar_label: "01 · What Git is"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 on **git 2.55.0** (`git --version`). Scripts:
> `sandbox/git-p0/ex1-version-facts.sh`, `sandbox/git-p0/ex2-object-model.sh`.
> Every command below ran in a throwaway repository under `/tmp` with the
> machine's own config neutralised.

**Git is a key-value store where the key is the SHA of the content and the value
is the content — plus a handful of small files that name entry points into it.
Branches, tags, HEAD and the staging area are all just names pointing at hashes,
which is why almost every Git operation is instant and why almost nothing is
ever truly lost.**

Learn this page and the rest of Git stops being a list of commands to memorise.
`reset --soft` versus `--hard`, why rebasing changes every hash, why deleting a
branch is safe — all three answers fall out of the storage model.

## The hash is over the content, not the file

Git names an object by hashing a short header plus the bytes. Nothing else goes
in: not the filename, not the path, not the timestamp.

```console
$ git hash-object greeting.txt
ce013625030ba8dba906f756967f9e9ca394464a
$ printf "blob 6\0hello\n" | sha1sum        # the header Git prepends
ce013625030ba8dba906f756967f9e9ca394464a
```

Those two lines are the whole idea. `blob 6\0` is the type, the byte count and a
NUL — prepend it to `hello\n`, take the SHA-1, and you have reproduced Git's
object name by hand with a tool that knows nothing about Git.

Because the name is the content, two identical files are **one** object:

```console
$ git hash-object copy-of-greeting.txt        # same bytes, same object
ce013625030ba8dba906f756967f9e9ca394464a
```

Copy a 4 MB file to ten locations and commit them all: Git stores the content
once and records ten tree entries pointing at it. Deduplication is not a feature
somebody added — it is unavoidable once the name is the hash.

## Computing a name is not storing it

`hash-object` alone tells you what an object *would* be called. Only `-w`
writes it:

```console
$ git cat-file -t ce013625030ba8dba906f756967f9e9ca394464a
fatal: git cat-file: could not get object info
$ git hash-object -w greeting.txt             # -w actually writes
ce013625030ba8dba906f756967f9e9ca394464a
$ git cat-file -t ce013625030ba8dba906f756967f9e9ca394464a
blob
$ git cat-file -s ce013625030ba8dba906f756967f9e9ca394464a   # size in bytes
6
```

And the object is a file on disk, in a directory named after the first two
characters of the hash:

```console
$ find .git/objects -type f
.git/objects/ce/013625030ba8dba906f756967f9e9ca394464a
```

The two-character split exists because some filesystems degrade badly with
hundreds of thousands of entries in one directory. That is the only reason.

## The store is content; the refs are names

A repository is those two things and nothing more. The object store is
append-only content addressed by hash. Everything you actually *type* —
`main`, `HEAD`, `v0.1` — is a name resolving to one of those hashes:

```console
$ cat .git/HEAD
ref: refs/heads/main
$ cat .git/refs/heads/main
69dccb02fbe9f498e7373e6498a8fac400c3d1eb
$ git rev-parse HEAD            # the same 40 characters
69dccb02fbe9f498e7373e6498a8fac400c3d1eb
```

`HEAD` is a file containing the text `ref: refs/heads/main`. `main` is a file
containing 40 hex characters and a newline. That is the entire branching
mechanism, which is why creating a branch costs exactly this much:

```console
$ git branch feature/pricing && wc -c .git/refs/heads/feature/pricing
41 .git/refs/heads/feature/pricing
$ git cat-file --batch-all-objects --batch-check | wc -l   # object count unchanged
8
```

41 bytes — 40 hex characters plus a newline — and **zero new objects**. In a
version-control system that stored branches as copies, branching a large project
would be an expensive, deliberate act. Here it is a file write, and that single
performance fact is why Git-based workflows are branch-per-feature while older
systems were not.

## What this buys you, immediately

Three everyday behaviours are direct consequences:

| Behaviour | Why it follows |
|---|---|
| Deleting a branch does not delete commits | The branch was a name; the objects are still in the store, still reachable by hash |
| Rebasing produces new hashes | A rebased commit has a different parent, so different content, so a different name. It cannot keep the old one |
| Git can verify itself | Recompute the hash of an object and compare it to its name; any corruption shows up as a mismatch (`git fsck`) |

## Trade-off

**The cost of content addressing is that history is immutable and cumulative.**
Every version of every file you ever committed is in the object store, forever,
until garbage collection can prove it is unreachable — and reachable objects are
never collected at all.

That is what makes recovery so reliable, and it is exactly why a committed
secret is a genuine incident rather than an inconvenience: deleting the file in
a later commit does not remove the blob, because the old commit still points at
it. It is also why one 200 MB video committed once makes every clone of that
repository 200 MB heavier forever, even after you delete it. Both problems need
history rewriting, not a normal commit.

## Gotchas

**Symptom:** `git hash-object` prints a hash but `git cat-file` says `could not get object info`
**Cause:** `hash-object` without `-w` only computes the name; nothing was written
**Fix:** add `-w`. The two-step split is deliberate — it lets tools ask "what would this be called?" without polluting the store

**Symptom:** you deleted a large file and committed, but `.git` did not shrink
**Cause:** the blob is still referenced by every earlier commit that contained it; content is only unreachable once *no* commit references it
**Fix:** nothing normal will help — this needs a history rewrite (Phase 11). Prevention is Phase 7's ignore rules

**Symptom:** you renamed a file and the diff shows a delete plus an add
**Cause:** Git never records renames; a tree entry is a (mode, hash, name) triple, and a rename just changes which name points at the same blob
**Fix:** nothing is wrong — use `git log --follow` or `git diff -M` to make the detection explicit. See [Reading history](../../syllabus/01-how-git-works.md)

**Symptom:** two developers' commits of the "same" change have different hashes
**Cause:** a commit hashes its tree, its parents, both timestamps and both identities. Same content, different parent or author, different name
**Fix:** expected. Compare trees (`git diff A B`), not commit hashes, when you want to ask whether the *content* matches

## Interview questions

**★ Does Git store diffs or snapshots?**
Snapshots. Every commit names a complete tree describing the whole project at
that moment. Diffs are computed on demand between two snapshots — which is why
`git show` on a 500-commit-old commit is just as fast as on the newest one.
Delta compression does exist, but inside packfiles as a storage optimisation
that the model above never exposes.

**★ Why is creating a branch in Git effectively free?**
A branch is a 41-byte file containing a commit hash. Nothing is copied and no
objects are created — measured above as a 41-byte file with the repository's
object count unchanged.

**★ What is actually hashed to produce an object's name?**
The type, a space, the content length in bytes, a NUL byte, then the content —
`blob 6\0hello\n`. Verified above by reproducing `ce013625…` with `sha1sum` and
no Git involved. The filename is not part of it, which is why identical files
share one object.

**★ If a commit is deleted, is the data gone?**
Not immediately. The commit object stays in the store until garbage collection
runs *and* can prove nothing reaches it — and the reflog keeps it reachable for
90 days by default. This is why `reflog` recovery works, and why "I deleted the
branch" is almost never fatal.

**Why does a rebase change commit hashes, when the code is identical?**
The parent is part of what a commit hashes. Replaying a commit onto a new base
gives it a different parent, so the object's content differs, so its name
differs. There is no way to keep the old hash — which is the whole reason
rewriting shared history is disruptive.

**How would you check whether two branches have identical content, ignoring history?**
Compare the tree objects: `git rev-parse main^{tree}` against
`git rev-parse feature^{tree}`. Equal tree hashes mean byte-identical
directories, regardless of how many commits each took to get there.

---

← [Phase index](README.md) · Next → [A commit is a snapshot](02-commit-is-a-snapshot.md)
