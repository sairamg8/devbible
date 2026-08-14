---
title: "A branch is a moving pointer"
sidebar_label: "01 · A branch is a pointer"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against **git 2.55.0** — `man git-branch` (DESCRIPTION,
> OPTIONS), `man git-switch`. **Documentation-validated, not sandbox-proven**;
> the console block is recorded output from `sandbox/git-p0/ex2-object-model.sh`.

**A branch is a file containing one 40-character hash and a newline. Creating one
writes 41 bytes and no objects; committing on it rewrites those 41 bytes.
Everything that feels expensive or risky about branching in other tools is absent
here, and every branch command below is a consequence of that.**

## 41 bytes, measured

```console
$ git switch -c feature/pricing && wc -c .git/refs/heads/feature/pricing
41
$ git cat-file --batch-all-objects --batch-check | wc -l
8
```

<small>Recorded output — `sandbox/git-p0/ex2-object-model.sh` §8, kept in
`sandbox/git-p0/ex2-output.txt`. The object count was 8 before creating the branch
and 8 after: **a branch creates no objects at all.**</small>

That is the whole data structure. `refs/heads/<name>` holds a commit hash; HEAD is
a symbolic ref naming which branch you are on; committing moves the branch's hash
forward. See [refs and HEAD](../phase-0-how-git-stores-things/06-refs-and-head.md).

Three consequences worth stating explicitly:

- **Branching is O(1)** regardless of repository size. There is no copy.
- **Deleting a branch deletes no commits.** It removes a pointer. The commits stay
  in the object store until garbage collection, and `git reflog` can still find
  them.
- **A branch name has no owner and no history of its own.** "Whose branch is this"
  is not a question Git can answer.

## Creating, switching, listing

```bash
git switch -c feature/pricing            # create from HEAD and move there
git branch feature/pricing               # create WITHOUT moving there
git switch -c hotfix v1.4.0              # create from a tag, or any commit
git branch                               # list local branches
git branch -a                            # local + remote-tracking
git branch -v                            # with the tip commit of each
```

`git branch <name>` creates without switching — useful for marking a point you
want to come back to. `git switch -c` does both, and is the normal one.

The start point can be **any commit-ish**: a branch, a tag, a hash, `HEAD~3`. It
can also be the merge-base shortcut `<rev-A>...<rev-B>`, the same three-dot idea
`diff` and `restore` use.

⚠️ When listing with a pattern you **must** write `--list`, or Git may read the
pattern as a branch to create:

```bash
git branch --list 'feature/*'
```

## Naming

Slashes are just characters — `feature/pricing` is one name, not a hierarchy,
though Git stores it as nested directories under `.git/refs/heads/` and most tools
display it as a tree.

Two constraints worth knowing: a branch cannot be named both `feature` and
`feature/x` (the first would have to be a file and a directory at once), and names
are restricted by `git check-ref-format` — no spaces, no `..`, no trailing `.lock`.

## Deleting, and the check that `-d` performs

```bash
git branch -d feature/pricing     # refuses if not fully merged
git branch -D feature/pricing     # force
```

`-d` refuses when the branch is *not fully merged*, and it is worth knowing what
that actually checks: whether the branch tip is **reachable** from HEAD (or from
its upstream). It is a reachability question, not a "was this reviewed" question.

That produces two real behaviours:

- A branch merged with **squash** or rebased onto main is **not** reachable — its
  original commits are not ancestors of anything — so `-d` refuses even though the
  work is fully landed. `-D` is correct there.
- `-d` from a *different* branch that lacks the merge will refuse even though main
  has it. Switch to main first, or use `git branch --merged main` to check
  properly.

```bash
git branch --merged main       # safe to delete
git branch --no-merged main    # still carrying unlanded work
```

Those two are the honest way to audit branches, and `--merged` is what "fully
merged" means.

**Recovering a deleted branch** is a one-liner, because the commits were never
deleted:

```bash
git reflog                      # find the tip hash
git branch feature/pricing <hash>
```

## Renaming

```bash
git branch -m old-name new-name    # -M to force over an existing name
```

Local only. A branch already pushed keeps its old name on the remote until you
push the new one and delete the old — remotes are Phase 4.

## Detached HEAD

HEAD normally points at a branch name. **Detached** means it points straight at a
commit instead. You get there deliberately or by accident:

```bash
git switch --detach v1.4.0      # deliberately, at a tag
git checkout <hash>             # the classic accidental route
```

It is a normal state, not an error — Git's own message says *"You are in 'detached
HEAD' state. You can look around, make experimental…"*. The one thing to know is
that **commits made there belong to no branch**. Move away and nothing points at
them; they are unreferenced and eventually collectable.

The fix, before you move:

```bash
git switch -c keep-this-work    # name the commits you just made
```

And after you have already moved away: `git reflog`, find the hash, branch from
it. `git status` always tells you when you are detached — it is the first line.

## Trade-off

**Branches are so cheap that the cost moves entirely to naming and cleanup.**

Nothing in Git discourages creating a branch — no space, no time, no ceremony. So
the friction that other systems provide by being expensive has to come from
somewhere else, and in practice it does not come at all: repositories accumulate
dozens of stale branches, several of which are the "real" version of something,
and nobody can tell which without reading them.

Git offers exactly two tools against this, and they are both reachability
questions rather than intent: `git branch --merged` and `--no-merged`. They cannot
tell you that a branch was squash-merged and is safe to delete, because a
squash-merge produces a commit with different content and no ancestry link. That
gap is why `-d` refuses on squash-merged branches and why people learn to reach
for `-D` reflexively — which then removes the safety check in the case where it
would have mattered.

The practical settlement: delete branches at the moment they land, while you still
know they landed. A weekly `git branch --no-merged main` review is the fallback,
and naming branches after the ticket rather than after the idea is what makes that
review possible at all.

## Gotchas

**Symptom:** `git branch -d` refuses on a branch you definitely merged
**Cause:** it was squash-merged or rebased, so the original commits are not ancestors of `main`. `-d` checks reachability, not intent
**Fix:** confirm with `git log main --oneline | grep`, then `-D`. Or check properly with `git branch --merged main`

**Symptom:** you deleted a branch and lost the work
**Cause:** you did not — deleting a branch removes a pointer, not commits
**Fix:** `git reflog`, find the tip, `git branch <name> <hash>`. Available until garbage collection, which by default is not soon

**Symptom:** commits made and then apparently gone
**Cause:** they were made on a detached HEAD, so no branch pointed at them, and moving away left them unreferenced
**Fix:** `git reflog` and branch from the hash. Read the first line of `git status` — it names the detached state

**Symptom:** `git branch 'feature/*'` created a branch with a strange name
**Cause:** without `--list`, a pattern argument is read as a branch to create
**Fix:** `git branch --list 'feature/*'`. Delete the accidental branch with `-D`

**Symptom:** cannot create `feature` because `feature/api` exists
**Cause:** refs are stored as paths — `feature` cannot be both a file and a directory
**Fix:** pick a different name. This is also why `git branch -m` sometimes refuses

---

← Prev: [Phase 2 index](README.md) · Next → [Fast-forward versus a real merge](02-fast-forward-vs-merge.md)
