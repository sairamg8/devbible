---
name: devbible-parallel-sessions
description: Several Claude sessions work on devbible at once, sharing one working tree and one git HEAD — what that breaks and how to stage safely
metadata:
  type: feedback
---

# Other sessions are working in the same directory

Confirmed 2026-08-13: while this session wrote PostgreSQL phases 9 and 12, another
was writing the **JavaScript** and **TypeScript** corpora — in the *same* checkout of
`/mnt/Storage/Backup/Knowledge/devbible` and committing to the *same* memory store.

**Why:** the working tree, the index and `HEAD` are shared. Anything you do to git
is done to the other session too, silently, and it cannot see your intent.

## What actually went wrong

**`git add -A -- sandbox` swept in 12 files that were not mine.** Commit `60ec1ee`
("PostgreSQL phase 12 COMPLETE") contains `sandbox/js-p0/ex1-stack.mjs` and eleven
siblings belonging to the JavaScript session. Additive, so nothing was lost — but
their work is now under someone else's commit message, and they may commit it again.

**A near miss on `src/data/progress.js`.** The other session added `javascript:` and
`typescript:` blocks to it while I was editing the `postgresql:` block. A targeted
`sed` on one line was safe; a rewrite of the file would have destroyed their work.
It was luck, not care.

**The build reports their broken links as failures.** A clean rebuild showed a dozen
broken links from `docs/javascript/` pointing at pages not yet written. Nothing to do
with PostgreSQL, and it would have looked like my breakage.

## Update 2026-08-13 — the peers moved into worktrees

**The "one shared working tree" picture above is now only half true.** The
JavaScript and React sessions were moved into **git worktrees** at the user's
instruction (`.claude/worktrees/javascript-phases`, `.claude/worktrees/react-phases`),
each on its own branch with its own checkout and its own `HEAD`.

What that changes:

- **Their edits no longer land in your `git status`.** The shared-working-tree
  hazard — the thing that caused the `60ec1ee` accident — does not apply to a peer
  who is in a worktree.
- **The refs are still shared.** Deleting their branch, or unlocking/removing their
  worktree, still reaches across. Both worktrees show as **`locked`** in
  `git worktree list`; treat that as "a session may be live in here".
- **`.claude/worktrees/` is 1.4 GB and untracked**, and `.gitignore` does not cover
  it. It will appear in every `git status` in the main checkout forever. Never
  stage it.
- A peer still in a worktree branches from the **pre-merge** commit, so their next
  commits will look "behind". That is expected; the next merge absorbs it.

**Check `git worktree list` before concluding a peer shares your tree.** A peer in
a worktree and a peer in your checkout need opposite precautions.

### The `-A` exception, and what it cost

This session ran `git add -A -- . ':!.claude/worktrees' ':!sandbox/…/*.db'` — an
`-A` form, against the rule below — because the user's instruction was explicitly
*"in main any uncommitted code please commit"*. **A blanket instruction to commit
everything is the one case that overrides the rule**, and even then the exclusions
were what made it safe: without `':!.claude/worktrees'` it would have swept 1.4 GB
of two live sessions' worktrees into the commit.

If you must use an `-A` form, **run `git status` first and account for every path**,
then exclude explicitly. Do not reach for it otherwise.

## How to apply

1. **Never `git add -A` in devbible.** Stage explicit, narrow paths:
   `git add -- docs/postgresql src/data/progress.js sandbox/pg-api`
   Not `-- sandbox`, not `-- docs`, not `-A`.
2. **Read `git status` before every commit** and account for every path you are
   about to stage. If something unfamiliar appears, it is someone else's.
3. **Verify a build against your own corpus**, not the whole log:
   ```bash
   grep -A 30 "Exhaustive list" build.log | grep -i postgresql   # empty = yours is clean
   ```
   **The user's instruction (2026-08-13): do not fix another corpus's broken links.
   Wait, skip, re-check later — the session writing them will resolve them.**
4. **Do not switch branches, rebase, amend or reset** while another session may be
   active. `HEAD` is shared, so a branch switch silently moves their working tree
   too. If history must be rewritten, ask first.
5. **The memory store is shared as well.** Interleaved commits worked fine because
   the sessions touched different files. Keep to your own project files and commit
   often, so a conflict window stays small.
6. **Edit surgically.** Prefer a targeted `sed`/`Edit` on the line you own over
   rewriting a shared file like `progress.js` or `sidebars.js`.

## Also worth knowing

`ListAgents` shows the peers — the JavaScript work appeared there as a separate
interactive session. Checking it is cheap when something unexplained shows up in
`git status`.

Related: [[devbible-postgresql-rewrite-handoff]] · [[devbible-progress]] ·
[[feedback-scope-of-changes]]
