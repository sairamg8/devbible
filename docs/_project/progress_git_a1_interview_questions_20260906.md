---
name: devbible-git-a1-interview-questions-20260906
description: Audit item A1 CLOSED 2026-09-06 — all 36 git pages that lacked `## Interview questions` now have it, so all 57 pages in the track carry the section. Records the method, the counts and the one build break it caused.
metadata:
  type: project
---

# A1 closed — the git track's house-style breach is gone

**The finding (2026-09-06 corpus audit):** 36 of 57 git pages shipped without
`## Interview questions`, in a track the homepage shows as **100% complete**. It was the
single largest house-style breach in the corpus and the audit ranked it first in tier A
because the pages are *live*.

**Done 2026-09-06.** All 36 written, 5–8 questions each, `★` on the frequently-asked,
answers in prose and grounded only in what each page already teaches — no new claims, no
new sources fetched. Committed **per file** (36 commits), pushed.

| Phase | Files | Note |
|---|---:|---|
| phase-1-everyday-loop | 10 | commit, diff, gitignore, untracking, switch/restore, undo, log, messages, stash, rm/mv/clean |
| phase-2-branching-merging | 10 | pointer, ff-vs-merge, three-way, conflicts, rebase, rebase-vs-merge, interactive, golden rule, reflog, aborting |
| phase-4-remotes | 8 | remote URL, fetch-vs-pull, tracking, upstream, divergence, force-push, push, transports |
| phase-5-undo-recover | 8 | decision table, reset, revert, reflog recovery, rewriting, branch recovery, undoing a merge, undoing a push |

**Verification, all clean:** every page under the 300-line cap (largest 297) ·
`yarn linkcheck docs/git` 70 files, 0 problems · `mdxcheck` with raw-tag detection ON,
0 hazards · `grep -L '^## Interview questions'` returns nothing.

## 🔴 The one defect it caused, and the lesson

A verbatim quote of `git status` output contained `<sha>` in prose. MDX read it as a JSX
tag and **the Docusaurus build failed**. Every local gate passed, including the project's
own documented `mdxcheck --no-rawtag` — because that flag is exactly what suppresses the
class. Full write-up and the rule:
[[devbible-feedback-mdxcheck-no-rawtag-hides-a-build-breaker]].

## Method worth reusing

Read the page in full, then write questions from *its* content only — the strongest ones
came from the page's own trade-off section and from its gotchas, restated as "why does
this happen" rather than "what is the command". Insertion was scripted: a small python
helper spliced the block in before the final `---` footer rule, so the footer chain was
never disturbed. Pages ran 145–238 lines before and 189–297 after, so nothing needed a
split.

Next in tier A: **A2** (validate the 11 imported toolchain tracks, 164 pages, 0 validated)
and **A3** (TanStack two-line correction). See [[cursor-audit]].
