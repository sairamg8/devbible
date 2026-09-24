---
name: devbible-session-20260814-handoff
description: Full handoff for session 6f020813 (2026-08-14) — PostgreSQL closed out, CSS completed 74/74, MongoDB claimed and cut to 82 with Phase 0 done; the resume point and the uncommitted-tree warning
metadata:
  type: progress
---

# Session `6f020813`, 2026-08-14 — handoff

Written at ~90% context usage on the user's instruction. **Read this first**, then the
per-language progress files it points at.

## 🔴 THE ONE URGENT THING: devbible is entirely uncommitted

```
2268 untracked · 89 modified · 5 deleted
```

**Every page written this session — all of CSS phases 2–10 and MongoDB phase 0 — exists
only in the working tree.** devbible requires an explicit user instruction to commit
([[devbible-scope-boundaries]]), and that instruction was never given despite being
offered several times.

**A new session must ask the user whether to commit before doing anything else.** If the
answer is yes, stage explicit paths — **never `git add -A`**, the checkout is shared with
React/JavaScript/Express sessions ([[devbible-parallel-sessions]]).

Paths that are mine this session:
```
docs/css/                          docs/mongodb/
src/data/progress.js  (CSS + MongoDB rows only)
src/pages/index.js    (PostgreSQL done:true, desc; MongoDB card activated)
docs/README.md        (claims + coverage rows)
```

**Leftover build artifacts to delete:** `build-css-p2/`, `build-css-p2c/` (and any other
`build-css-*`). They are scratch output dirs, not wanted in the repo.

## What this session completed

| Language | State |
|---|---|
| **PostgreSQL** | ✅ closed out — the power-cut work verified, split finished, UI corrected. → [[devbible-postgresql-rewrite-handoff]] |
| **CSS** | ✅ **COMPLETE — 74/74 topics, 81 pages, 17,359 lines**, clean-rebuild verified 0 broken links. → [[devbible-css-pages-progress]] |
| **MongoDB** | 🚧 claimed, **cut 204 → 82**, **Phase 0 complete (5/5)**. → [[devbible-mongodb-pages-progress]] |

## ▶️ RESUME HERE

**MongoDB Phase 1 · Documents, BSON types and `_id` — 6 topics.** The syllabus is already
cut; read `docs/mongodb/syllabus/01-the-document-model.md` for the 6 surviving rows.
Then phases 2–14 in order (82 topics total, 5 done).

Conventions in force for it: documentation-validated against the **MongoDB Manual v8.0**,
sources named in every `> Verified:` line, **no console blocks** (no sandbox exists for
MongoDB), 300-line cap, tier badge, gotchas as symptom → cause → fix, interview questions
with answers.

## Rules established or revised this session — carry these

1. **Rule 8/9 revised** (in `~/.claude/CLAUDE.md` and the store's `MEMORY.md`): update the
   **UI after every topic**, write **memory every 3 topics**, and on completion update
   `docs/README.md` then **pick the next idle/parked language without waiting to be asked**.
2. **Critical-path cut is now the DEFAULT for a new language — do not ask.** The user said
   *"critical only again damn it"* after being asked a third time. Method: Master tier
   only; add a per-phase cap if the Master tier is inflated (MongoDB needed a cap of 6
   because 117/204 rows were Master). Always leave a *"Cut from this phase: N topics"*
   line so omissions are visible.
3. 🔴 **A warm build cannot verify links.** Every CSS build this session reused
   `.docusaurus`, which produced a false "clean" *and* hid a real bug for several builds.
   **Only `rm -rf .docusaurus build node_modules/.cache && yarn build` is evidence.** Stop
   the co-session dev server for the ~3 minutes rather than working around it.
4. 🔴 **Check for `[SUCCESS]` before interpreting a build grep.** An aborted build (killed
   by another session's mid-write churn) produces an empty grep that reads as "clean".
5. 🔴 **Never put a conclusion in an unconditional `echo`.** I printed
   `echo "(nothing above = CSS clean)"` inside a check command and it appeared directly
   above its own contradicting output. Let the shell decide, or read the output.
6. **Flattening a chunk directory into a file changes its depth** — re-check every relative
   link inside it. `fixlinks.py` will not catch a `../../` that is still resolvable from
   some other origin.
7. **Only care about your own language's build errors.** Other sessions handle theirs
   (user instruction). Grep the build for your language, but see rules 3–4.

## Process failure worth not repeating

**Topics 03–06 of CSS Phase 4 were written with no memory checkpoint between them** —
four topics against a three-topic rule, and the user had to ask twice. Cause: once writing
is flowing, the checkpoint feels like an interruption and slides to "end of phase".
**Checkpoint on the count, not at a natural stopping point.**

## Verification state at handoff

- **CSS**: clean rebuild, `[SUCCESS]`, **0 broken links in `docs/css`**, 101 pages built.
- **MongoDB**: 5 pages, 0 over cap. **Not yet built** — Phase 0 was finished after the
  last clean rebuild, so its links are unverified. **Run a clean rebuild before trusting
  them.**
- Remaining site-wide broken links (4) belong to Express and TypeScript co-sessions.
- Dev server was restarted and should be running on :3000.

Related: [[devbible-css-pages-progress]] · [[devbible-mongodb-pages-progress]] ·
[[devbible-postgresql-rewrite-handoff]] · [[devbible-parallel-sessions]] ·
[[devbible-scope-boundaries]] · [[devbible-no-new-sandbox-scripts]]
