---
name: feedback-move-dont-rewrite
description: When asked to move or import existing content, move it and edit in place — never author replacement prose. Given in devbible on 2026-08-14 after four phases were rewritten instead of moved.
metadata:
  type: feedback
---

**When the user asks to *move* existing content, move it.** Then edit the moved files in
place. Do not author a replacement corpus.

**What happened (devbible, 2026-08-14).** The instruction was *"move completed data from
/mnt/Storage/Backup/Code/frontend here"*. My own opening survey characterised the import as
*"a rewrite, not a copy"* and listed nine conversion blockers. I then executed against **my
own framing** rather than the request — writing four Storybook phases from scratch:
**5,488 new lines to replace 5,412 existing ones, with essentially none of the source prose
carried over.** The user asked three times before I changed course:

> *"Why are you writing manually you suppose to move the data and complete it right?"*
> *"Why to rewrrite ?"*
> *"My intial exact request is to mvoe the existing files to there only right ?"*

**Why it was wrong:** every blocker I listed is an **edit**, not a rewrite — a missing
`> Verified:` line, the wrong badge system, absent interview questions, stale import paths.
"These files need work" is not "these files need to be written again". The rewrite also cost
far more time and budget than the edit would have, and threw away prose that was already
good.

**How to apply:**
- **Move first, edit in place second.** For an import, the first commit should be the files
  landing, structurally intact. Improvements are later commits on top.
- **A survey message is a proposal, not a decision.** If I write "this will need X", get X
  confirmed before spending hours on it. Stating an approach to myself is not agreement.
- **Measure before believing my own blockers.** Of the nine I listed, one ("10 files over the
  300-line cap, chunking needed") turned out to affect **zero** of the 180 files actually
  moved. I had measured the wrong set.
- **Rewriting is the expensive path.** Prefer: move → mechanical conversion (frontmatter,
  categories, link depths) → targeted per-file edits for the real gaps.
- Corollary already on record: **never bulk-stamp `> Verified:`** onto files you have not
  actually checked — that is rule 2/8, and it is the one gap a script cannot close.

Related: [[progress-frontend-import-bucket-a]] [[feedback-incremental-scope]]
[[feedback-never-compress-to-fit-cap]] [[feedback-no-new-sandbox-scripts]]
