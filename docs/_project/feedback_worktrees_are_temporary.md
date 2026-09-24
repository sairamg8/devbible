---
name: devbible-feedback-worktrees-are-temporary
description: 🔴 STANDING RULE — a worktree is temporary. Merge it to main and DELETE it in the same breath, branch included. Never leave one behind. Said twice, 2026-08-15 and 2026-08-31.
metadata:
  type: feedback
---

# 🔴 A worktree is temporary. Merge it to `main`, then delete it — always

**The user's instruction, 2026-08-31, verbatim:**

> *"make sure worktrees are merged to main and delete them afterwards"*

and again, the same day, as a rule to keep rather than a task to do:

> *"especially there were no worktresss we have to merge them to main and delete it
> afterwards please remeber this"*

**This is the second time.** On 2026-08-15 it was:

> *"commit every uncommitted branch to main and delete everything"*

— which retired 8 worktrees and 10 branches at once. Treat it as settled policy, not as a
per-occasion request.

## The rule

1. **Create a worktree only when the user asks for one.** They have asked twice
   (*"Please move all your changes to new worktree"*), so it is a legitimate request — but
   it is never the default.
2. **The moment its work is on `main`, delete it.** Same turn. Not "kept after the merge",
   not "left for later" — that is exactly how the last two accumulated.
3. **Delete the branch too**, and prune. A merged branch left behind is the same debt in a
   cheaper form. That includes a **PR branch**: `gh pr merge --delete-branch`, then
   `git remote prune origin` to clear the stale remote-tracking ref, which
   `--delete-branch` does not always remove locally.
4. **End state to verify, every time:**
   ```bash
   git worktree list     # only /mnt/Storage/Backup/Knowledge/devbible
   git branch -a         # only main + the origin refs
   git status --porcelain
   ```

## Before deleting anything — the check that makes this safe

Never delete on the strength of "I think it merged". The 2026-08-15 consolidation
established the check and 2026-08-31 reused it:

```bash
git rev-list --count main..<branch>              # MUST be 0
git -C <worktree-path> status --porcelain        # MUST be empty
```

🔴 **Both, for every worktree — including ones belonging to other sessions.** On 2026-08-31
one of the two (`devbible-status`, branch `feat/status-config`) was another live session's.
It was verified at 0 unique commits and 0 uncommitted files before being touched. Had it
carried uncommitted work, the correct move was to **stop and report**, not to force it —
several sessions share this checkout and a `--force` there destroys work nobody can
reconstruct.

## Why it matters — the actual cost

Not disk. **Stale pointers.** After the 2026-08-31 cleanup, four memory files were still
naming directories that no longer existed — [[cursor-angular]],
[[devbible-homepage-dashboard-rebuild]], [[devbible-progress-status-config]] and
[[devbible-locks]] all had to be corrected in a follow-up commit. A worktree that outlives
its work becomes a path the next session reads, trusts, and cannot find.

**So: if you delete a worktree, grep the store for its path and its branch name in the same
turn.**

```bash
grep -rl "<worktree-path>\|<branch-name>" /mnt/Storage/my-learning/claude/devbible/
```

## How to apply

- Asked for a worktree → create it, do the work, merge, delete, prune, fix the pointers.
- Finishing any session → `git worktree list` is part of the wind-down, alongside the
  commit and the cursor repoint. If it shows more than the main checkout, you are not done.
- Related: [[devbible-locks]] carries the two consolidation banners with the dated tables of
  what was removed and what was verified first.
