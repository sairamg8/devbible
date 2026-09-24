---
name: devbible-feedback-shared-file-staging
description: "Stage explicit paths" is NOT enough protection on src/data/progress.js — several sessions edit that one file, and `git add <path>` stages the whole file including their lines. Use `git add -p`, or diff before staging. Happened twice in both directions on 2026-09-04.
metadata:
  type: feedback
---

# 🔴 On a shared FILE, `git add <path>` is not the safe operation you think

The global rule says **never `git add -A`; stage explicit paths** — because several sessions
share this checkout. That rule is right and it is **insufficient**, because it protects
against staging another lane's *files* and does nothing about another lane's *lines in a file
you both edit*.

**`src/data/progress.js` is the hotspot.** Every language has a row in it, so every session
edits it, and `git add src/data/progress.js` stages whatever anyone else has left uncommitted
in it.

## It happened twice in one day, in both directions

**2026-09-04, session `cb25d15f` (Next.js):**

1. **To me.** I rewrote the 19 Next.js rows. Minutes later `git diff src/data/progress.js`
   showed only *java* changes and my work appeared to be gone. It was not: the java session's
   commit `705839d7` had **already committed my uncommitted rows inside its own commit**.
   🔴 **In a shared checkout, "my change was clobbered" and "someone else committed my change"
   are indistinguishable from `git diff`.** Check `git show HEAD:<file>` before re-applying
   anything that looks lost — re-applying would have produced a confusing duplicate edit.
2. **By me.** Closing chapter 1, I ran `git add src/data/progress.js` and swept **the java
   session's two lines** (their `updated` stamp and their phase-14 row) into my board commit.
   Same mistake, opposite direction, within the same hour — after having flagged it.

Neither caused damage: both sets of content were correct and landed in `main` once. The cost
is attribution — a commit message describing a Next.js board update that also contains
someone else's Java progress, which is misleading to anyone reading history later.

## What to actually do

```bash
git diff src/data/progress.js        # 🔴 LOOK FIRST — whose lines are in here?
git add -p src/data/progress.js      # stage only your own hunks
git diff --cached                    # confirm before committing
```

**The rule, stated so it covers both cases:** *stage explicit paths, and on a file more than
one lane edits, stage explicit **hunks**.* For a file only your lane touches, `git add <path>`
remains fine.

**Corollary for the "vanished edit" case:** before re-applying an edit that `git diff` no
longer shows, run `git show HEAD:<file>` and look for your content. An empty index plus a
missing diff usually means *committed by someone else*, not *lost*.

Related: [[progress-nextjs-import]] · [[devbible-locks]] · [[feedback-parallel-sessions]]
