---
name: devbible-merge-implies-push
description: Standing instruction 2026-08-31 — "merge to main" ALWAYS includes pushing to origin. Never stop to ask for push permission; only withhold the push if the user says not to.
metadata:
  type: feedback
---

# "Merge to main" means merge **and push**. Do not ask.

**User instruction, 2026-08-31, verbatim:**

> *"commit everything and push to main i do not need to tell explicity when i asked merge to
> main unless if i mention not to push"*

## The rule

**`merge to main` = commit what is outstanding → merge → `git push origin main`, in one go.**
The push is part of the request, not a separate decision. **Only skip it when the user says
so** — *"don't push"*, *"local only"*, *"just merge"* with an explicit no-push.

**Why:** it was asked for after a turn where the merge was verified, the state was reported,
and then a push confirmation was requested anyway. The confirmation added a round trip and no
information — the repo is the user's own, `main` is its default branch, and the branch already
tracks `origin/main`. Treating a routine push as an outward-facing action worth blocking on
was the wrong call.

## What still holds

This changes **when to ask**, not **what to check**. Before pushing, still:

- 🔴 **`git add` explicit paths — never `git add -A`.** Several sessions write to this
  checkout at once and this rule is untouched by the above.
- **Confirm a merge is nearly pure insertion.** `git show --stat` on the merge: a large
  deletion count needs an explanation from the merge's own commit message before pushing
  (the 2026-08-31 angular merge showed −227, explained by "the homepage strip removal").
- **Re-check `git status` and the ahead count immediately before pushing.** Another session
  may have merged, pushed, or deleted a branch between two of your own commands. On
  2026-08-31 both branches were merged by another session *between two consecutive tool
  calls*, and the push then reported `Everything up-to-date` because that session had already
  pushed. **Verify by ancestry, not by the push output** —
  `git merge-base --is-ancestor <sha> origin/main` for each commit that matters.
- **Say whether a build was run.** A push after two sessions' merges landed independently is
  the classic moment for cross-merge broken links. Not a reason to withhold the push; a
  reason to say plainly that no build was run.

## What this does NOT license

**It is not permission to commit another session's in-flight files.** That judgement is
separate and unchanged: files being written *right now* by a live session are not yours to
stage. Check mtimes against the clock — on 2026-08-31 the cadence hook flagged 13 Python
files whose newest was **19 seconds old**, and the correct move was to leave them for the
session writing them, which committed and merged them itself minutes later.

Related: [[devbible-parallel-sessions]] · [[devbible-locks]] ·
[[devbible-worktree-consolidation-20260815]]
