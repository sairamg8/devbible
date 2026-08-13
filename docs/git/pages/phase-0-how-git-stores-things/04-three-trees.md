---
title: "The three trees"
sidebar_label: "04 · The three trees"
sidebar_position: 4
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 on **git 2.55.0** (`git --version`). Script:
> `sandbox/git-p0/ex2-object-model.sh`, sections 3 and 4.

**Git juggles three versions of your project at once: HEAD (the last commit),
the index (what the next commit will contain), and the working tree (the files
on disk). Every core command is a move between two of them. Naming which two is
how you choose a command instead of guessing at one.**

| Tree | Where it lives | What it is |
|---|---|---|
| **HEAD** | `.git/refs/…` via `.git/HEAD` | The snapshot of the last commit on the current branch |
| **Index** | `.git/index` | The staged snapshot — what `git commit` will turn into a tree |
| **Working tree** | your directory | Actual files, editable by anything, tracked or not |

## Watching a file cross all three

A new file starts in the working tree only — `??`:

```console
$ git status --short          # ?? = in the working tree only
?? greeting.txt
?? src/
```

`git add` copies its content into the index. The status code moves to the first
column, which is always **"index versus HEAD"**:

```console
$ git add greeting.txt src/math.js && git status --short   # A = in the index
A  greeting.txt
A  src/math.js
```

And the index is not a list of filenames — it holds real blob hashes:

```console
$ git ls-files --stage        # the index is a real file with real blobs
100644 ce013625030ba8dba906f756967f9e9ca394464a 0	greeting.txt
100644 d0f87bf2ef282c7a997d8c88e5d2539bbfe562db 0	src/math.js
```

`ce013625…` is the same hash [page 01](01-what-git-is.md) produced from
`hello\n`. Staging genuinely wrote the content into the object store; the index
just records which hash occupies which path.

## The proof that they are separate: `AM`

Edit the file *after* staging it and both are true at once:

```console
$ git status --short          # staged AND modified, at the same time
AM greeting.txt
A  src/math.js
```

Two columns, two comparisons. `A` (left) is index-versus-HEAD: added. `M`
(right) is working-tree-versus-index: modified. The staged content is still the
old `hello\n`; the newer `hello\nworld\n` exists only on disk.

`git diff` answers whichever question you ask it:

```console
$ git diff --stat             # working tree vs index
 greeting.txt | 1 +
 1 file changed, 1 insertion(+)
$ git diff --staged --stat    # index vs HEAD
 greeting.txt | 1 +
 src/math.js  | 1 +
 2 files changed, 2 insertions(+)
```

Bare `git diff` shows one file, `--staged` shows two. Neither is wrong — they
compare different pairs. **Committing here would commit `hello\n`**, not what
is in your editor, and this is the single most common cause of "my change didn't
make it into the commit".

## Every command, as a move between trees

Once you see the three trees, the command set collapses into a table:

| Command | Moves | Effect |
|---|---|---|
| `git add <path>` | working tree → index | Stage current content |
| `git restore <path>` | index → working tree | Discard your edit |
| `git restore --staged <path>` | HEAD → index | Unstage, keep the edit on disk |
| `git commit` | index → new commit, HEAD advances | Freeze the index as a tree |
| `git reset --soft <c>` | HEAD only | Move the branch; index and disk untouched |
| `git reset --mixed <c>` | HEAD + index | The default: unstages everything |
| `git reset --hard <c>` | HEAD + index + working tree | **The only one that can lose uncommitted work** |
| `git checkout <c>` / `git switch <b>` | HEAD + index + working tree | Move to another commit, refusing if it would clobber edits |

Every "which reset flag do I want?" question is answered by asking how far down
the list you want the change to reach.

## Trade-off

**The index is real power and real overhead.**

It is what makes `git add -p` possible — reviewing your own change hunk by hunk
and committing only the coherent part, leaving debug prints on disk. No
staging-area-free VCS can do that. The price is a third state to keep track of,
an entire class of confusion (`AM`, "I committed the wrong version", "why does
diff show nothing?"), and one more thing to explain to every newcomer.

The habit that pays it off: **run `git diff --staged` immediately before every
commit.** It shows exactly what is about to be committed, and costs a second.

## Gotchas

**Symptom:** you committed and the change is not in the commit
**Cause:** the file was edited after `git add`; the index still held the earlier content
**Fix:** `git add` again, then `git commit --amend`. Prevent it by reading `git diff --staged` before committing

**Symptom:** `git diff` prints nothing but `git status` says the file is modified
**Cause:** the change is staged, so working tree and index now agree — bare `diff` compares exactly those two
**Fix:** `git diff --staged` (or `git diff HEAD` for both at once)

**Symptom:** `git reset --hard` deleted work you had not committed
**Cause:** `--hard` is the only reset that overwrites the working tree, and uncommitted content is not in the object store
**Fix:** unrecoverable if it was never staged. If it was ever staged, `git fsck --lost-found` can find the blob — staging writes objects, which is a real safety net

**Symptom:** `git switch` refuses with "local changes would be overwritten"
**Cause:** switching would need to overwrite files whose working-tree content differs from the index
**Fix:** commit, `git stash`, or `git restore` the file — choose depending on whether you want to keep the work

## Interview questions

**★ What are Git's three trees, and what does each represent?**
HEAD (the last commit's snapshot), the index (the staged snapshot that becomes
the next commit) and the working tree (files on disk). Every core command moves
content between two of them.

**★ What does `AM` mean in `git status --short`?**
Two independent comparisons: `A` = added in the index relative to HEAD, `M` =
modified in the working tree relative to the index. The file is staged *and*
edited since staging, so committing now would record the earlier content.

**★ Explain the difference between `reset --soft`, `--mixed` and `--hard`.**
All three move HEAD. `--mixed` (the default) also resets the index, unstaging
everything. `--hard` also overwrites the working tree, and is the only variant
that can destroy uncommitted work.

**★ Why does `git diff` sometimes show nothing when a file is clearly changed?**
Because the change is staged. Bare `git diff` compares the working tree with the
index, and they now match. `--staged` compares index with HEAD.

**What is actually stored in `.git/index`?**
A sorted list of path entries, each with a mode, a blob hash and cached stat
data. It holds real object hashes, shown above with `git ls-files --stage` — not
a to-do list of filenames.

**How do you unstage a file without losing your edit?**
`git restore --staged <path>` — it copies HEAD's version into the index and
leaves the working tree alone. The older spelling is `git reset HEAD <path>`.

---

← Prev: [The four object types](03-object-types.md) · Next → [The index is a real file](05-the-index.md)
