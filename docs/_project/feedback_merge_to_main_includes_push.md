---
name: devbible-feedback-merge-to-main-includes-push
description: In devbible, "merge to main" is a standing instruction that INCLUDES pushing to origin. Never stop to ask for the push separately. Read with the worktrees-are-temporary rule.
metadata:
  type: feedback
---

# "Merge to main" means merge **and push**

When the user says **"merge to main"** on devbible, that means merge **and push to
`origin/main`**. Do not stop after the merge to ask whether to push.

Said explicitly on **2026-08-31**, after I merged `python-phase-1` into `main`, then
held the push back and asked for confirmation:

> *"commit everything and push to main i do not need to tell explicity when i asked
> merge to main unless if i mention not to push"*

## Why I got it wrong

`.github/workflows/deploy.yml` fires on **any** push to `main`, so **the push is the
deploy** — the site at https://sairamg8.github.io/devbible/ rebuilds from it. I
treated that as an outward-facing action needing its own confirmation. The user's
position is that they have already made that decision, and being asked every time is
friction. **The merge instruction carries the deploy with it.**

## How to apply

- `git merge` → verify → `git push origin main`, in **one turn**, no check-in.
- The **only** exception is the user saying not to push in that same instruction.
- **Still report what went out**, especially the commit range and whose work it
  carried. Several sessions share this checkout, so a push to `main` routinely
  publishes CSS / Angular / Java commits alongside the language you are locked to.
  On 2026-08-31 a single push carried 17 commits across three languages.
- Does **not** generalise to other repos, and does **not** authorise a force-push or
  a history rewrite.

## Where it sits in the sequence

This is the missing last step of [[devbible-feedback-worktrees-are-temporary]]. The
full sequence when a worktree's work is done:

1. Merge the branch into `main`.
2. Verify: 0 unique commits, 0 uncommitted files, caps/MDX/links clean.
3. Delete the worktree **and** its branch, then `git worktree prune`.
4. Grep the store for the worktree path and repoint every reference.
5. 🔴 **`git push origin main`.**

See also [[devbible-locks]] for the per-language locks.
