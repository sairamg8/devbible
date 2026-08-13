---
title: "Refs and HEAD"
sidebar_label: "06 · Refs and HEAD"
sidebar_position: 6
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 on **git 2.55.0** (`git --version`). Scripts:
> `sandbox/git-p0/ex2-object-model.sh` sections 7 and 8;
> `sandbox/git-p0/ex1-version-facts.sh` section 5.

**A ref is a file containing a hash. A branch is a ref that moves when you
commit; a tag is one that does not; HEAD is a ref that points at another ref.
Nothing about branching is more complicated than that, and every branch
operation is a file write.**

## Read them with `cat`

```console
$ cat .git/HEAD
ref: refs/heads/main
$ cat .git/refs/heads/main
69dccb02fbe9f498e7373e6498a8fac400c3d1eb
$ git rev-parse HEAD            # the same 40 characters
69dccb02fbe9f498e7373e6498a8fac400c3d1eb
$ git symbolic-ref HEAD
refs/heads/main
```

`HEAD` holds the text `ref: refs/heads/main` — it is a **symbolic ref**, a
pointer to a pointer. `main` holds 40 hex characters. `git rev-parse` just
follows the chain: HEAD → refs/heads/main → the commit.

The namespace is a directory tree:

```console
$ ls -R .git/refs
.git/refs:
heads
tags

.git/refs/heads:
main

.git/refs/tags:
v0.1
```

| Namespace | Holds | Moves when |
|---|---|---|
| `refs/heads/*` | Local branches | You commit on them |
| `refs/tags/*` | Tags | Never (that is the point) |
| `refs/remotes/*` | Remote-tracking branches | You fetch |
| `refs/stash` | The stash | You stash |

## Why branching is free

```console
$ git branch feature/pricing && wc -c .git/refs/heads/feature/pricing
41 .git/refs/heads/feature/pricing
$ git cat-file --batch-all-objects --batch-check | wc -l   # object count unchanged
8
```

41 bytes, zero new objects. Deleting that branch removes 41 bytes and deletes no
commits — the objects stay in the store, reachable via the reflog. This is the
mechanical reason "delete the branch" is a recoverable action and "delete the
file" is not.

## HEAD attached and detached

Normally HEAD is **attached**: it names a branch, so committing moves that
branch forward. Point HEAD directly at a commit — `git checkout <sha>`, checking
out a tag, or landing on a remote-tracking ref — and it becomes **detached**:

| | Attached HEAD | Detached HEAD |
|---|---|---|
| `.git/HEAD` contains | `ref: refs/heads/main` | a raw 40-char hash |
| A new commit | advances the branch | advances HEAD only; no branch moves |
| Switching away | safe | **abandons those commits** unless you branch first |

Detached HEAD is a legitimate state, not an error — it is how you inspect an old
commit or build a tag. The danger is only that commits made there are referenced
by nothing once you leave, and are then reachable only through the reflog.
`git switch -c <name>` at that point turns them into a normal branch.

## Two storage backends

Refs do not have to be individual files. This build supports both:

```console
default ref format:  files
reftable supported:  yes → reftable
reftable on disk:    0x000000000001-0x000000000001-5d9a0b8b.ref tables.list
loose-ref layout:    heads tags
```

`files` is the default: one file per ref, plus a `packed-refs` file that Git
periodically consolidates them into so a repository with 40 000 tags is not
40 000 inodes. **`reftable`** is opt-in at `git init --ref-format=reftable`, and
stores everything in a compact table format designed for exactly that scale.

Practical impact for most projects: none. Worth knowing because it is why
`cat .git/refs/heads/main` sometimes fails on a real repository — the ref may
have been packed, or the repository may use reftable. `git rev-parse main` is
the answer that always works.

## Trade-off

**Refs being plain files is what makes Git inspectable and scriptable — and it
is also a footgun.**

You can read the entire branch state with `cat`, script against it, and repair a
repository with a text editor. The cost is that nothing stops you writing a bad
hash into a ref, and that "delete a branch" and "delete 3 000 commits" are the
same size of operation from the filesystem's point of view. Git mitigates this
with the reflog (every ref update is logged) rather than by making refs harder
to touch — which is consistent with the rest of its design: cheap primitives
plus a recovery log, instead of guard rails.

Prefer `git update-ref` over editing ref files by hand: it writes the reflog
entry too, and that entry is what recovery depends on.

## Gotchas

**Symptom:** `cat .git/refs/heads/main` says "No such file or directory" on a real repository
**Cause:** the ref has been packed into `.git/packed-refs`, or the repo uses the reftable backend
**Fix:** use `git rev-parse main` or `git show-ref`, which read both backends. Never parse ref files in a script

**Symptom:** you made commits, switched branch, and they are gone
**Cause:** HEAD was detached; the commits had no ref pointing at them
**Fix:** `git reflog` lists them — `git switch -c rescue <sha>`. Prevention: check `git status`, which says "HEAD detached at …" on its first line

**Symptom:** `git branch -d` refuses with "not fully merged"
**Cause:** the branch has commits unreachable from the branch you are on, so deleting the ref would leave them referenced only by the reflog
**Fix:** merge it, or `-D` if you genuinely mean to discard. Recovery via reflog is still possible afterwards

**Symptom:** a tag points at something unexpected after a rebase
**Cause:** tags are refs that never move; a rebase created new commits and left the tag on the originals
**Fix:** expected. Re-tag deliberately, and prefer tagging only merged, permanent commits

## Interview questions

**★ What is a branch, physically?**
A file under `refs/heads/` containing one commit hash — measured above at 41
bytes (40 hex characters plus a newline). Creating one adds no objects; deleting
one removes no commits.

**★ What is HEAD?**
Usually a symbolic ref: a file containing `ref: refs/heads/<branch>`. It names
the branch you are on, which is how Git knows what to advance when you commit.
When detached, it contains a raw commit hash instead.

**★ What does "detached HEAD" mean, and is it dangerous?**
HEAD points directly at a commit instead of a branch. It is a normal state for
inspecting history; the risk is that commits made there are referenced by
nothing after you switch away, so they survive only in the reflog. `git switch
-c <name>` converts them into a branch.

**★ Why is creating a branch instantaneous even in a huge repository?**
Because it writes a 41-byte file. Nothing is copied and no objects are created —
the object count was unchanged after `git branch` above.

**Why might `cat .git/refs/heads/main` fail even though the branch exists?**
The ref may be packed into `packed-refs`, or the repository may use the
`reftable` backend (supported on this build, opt-in at init). `git rev-parse`
handles all cases.

**How does Git know which branch to move when you commit?**
It reads `.git/HEAD`, follows the symbolic ref to a branch, and writes the new
commit's hash into that branch file. Detached HEAD skips the middle step, so
only HEAD advances.

---

← Prev: [The index is a real file](05-the-index.md) · Next → [The commit graph is a DAG](07-commit-graph.md)
