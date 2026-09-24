---
name: devbible-session-20260814-react
description: Session handoff 2026-08-14 (session 6ffd754d) — React phases 4, 5 and 6 completed; MongoDB syllabus written and handed off; resume at React Phase 7
metadata:
  type: project
---

**Session `6ffd754d`, 2026-08-14.** Written at ~90% context usage as a cold-start
handoff. Everything below is committed.

## ⛔ SUPERSEDED as a resume point — go to [[devbible-react-phase7]]

**This file is history, not the resume point.** Session `63fa2a80` took the React
claim on 2026-08-14 (on the user's direct instruction), moved the work into a
**worktree** — `Backup/Knowledge/devbible-react`, branch `react-phase-7` — and wrote
Phase 7 topics 01 and 02. **Resume at Phase 7 topic 03.** The traps and verification
claims below are still accurate and worth reading; the "RESUME HERE" below is not.

## 🔴 RESUME HERE *(stale — see the banner above)*

**React Phase 7 — Custom hooks and the Rules of React (12 topics).** Nothing of it
is written. React is **claimed by this session** in `docs/README.md`; if you are a
new session continuing the work, update the claim row to your own id.

```
docs/react/syllabus/02-hooks.md   → the Phase 7 topic table
docs/react/pages/                 → phases 0-6 written
```

Read first: [[devbible-react-phase6]] (traps) and
[[devbible-react-concepts-phase6]] (claims already established, so Phase 7 does not
re-derive them).

## What this session completed

| | Result |
|---|---|
| **React Phase 4 · Effects** | ✅ 18 topics, 27 files. 3 chunked topics (04, 06, 11) |
| **React Phase 5 · Refs, context, reducers** | ✅ 16 topics, 18 files. 1 chunked topic (02) |
| **React Phase 6 · Performance & Compiler** | ✅ 17 topics, 18 files. None chunked |
| **MongoDB syllabus** | ✅ written (204 topics), then **trimmed by another session to 82** and **handed off** |

**React is now phases 0–6 complete, 142 content files, 0 broken links, 0 files over
300 lines.** Phases 7–14 remain = **128 topics**.

Concept records exist for phases 4, 5 and 6 —
[[devbible-react-concepts-phase4]] · [[devbible-react-concepts-phase5]] ·
[[devbible-react-concepts-phase6]]. **Read the relevant one before writing an
adjacent phase**; they exist so claims are not re-derived or duplicated.

## 🔴🔴 The three traps that cost time this session

**1. `rm -rf .docusaurus` is NOT enough.** Twice the build reported broken React
links to files that existed on disk. The rule-4 full clean is the real command:

```bash
rm -rf .docusaurus build node_modules/.cache && yarn build --out-dir build-react-p<N>
```

Use a **private `--out-dir`** — a shared `build/` collides with parallel sessions
and produces a bogus `ENOENT … build/__server/server.bundle.js`. Those dirs are
gitignored (`build-react*`) and are ~65 MB each; delete them after.

**2. A Python link walker is not sufficient.** It only checks that target files
exist; Docusaurus resolves differently and rejects links the walker passes. The
walker is a fast between-topics check. **Run the build at phase close.**

**3. Converting a topic to a directory breaks inbound links in page BODIES, not
just footers.** Grep for the old filename; a footer-only replace missed one
mid-page in Phase 5.

## 🔴 The working rules, as corrected by the user this session

The user gave several corrections. All are now in `~/.claude/CLAUDE.md` rule 9 and
mirrored in the store's `MEMORY.md`:

- **UI after EVERY topic** (four places: `src/data/progress.js` react row — mid-phase
  needs **both** `pages` and `pagesPlanned` or the phase reads as complete; that
  phase's `README.md`; `docs/<lang>/pages/README.md`; `docs/README.md` claims **and**
  technology rows).
- **Memory every 3 topics**, committed.
- 🔴 **Finish the CURRENT language before picking a new one.** I parked React after
  Phase 4 and claimed MongoDB; the user corrected this — *"pick next untill you
  complete current lang"*. React was re-claimed and MongoDB handed off with its
  syllabus finished rather than abandoned half-planned.
- 🔴 **Do not stop to ask.** *"Do not wait for meeee"* — keep going through phases
  without seeking approval between them.
- **Only fix your own language's build errors.** CSS, TypeScript, Express and
  JavaScript warnings belong to other sessions.

## Coordination as of this handoff

`docs/README.md` claims table:

| Area | Owner | State |
|---|---|---|
| **React** | session `6ffd754d` (this one) | 🔴 phases 0–6 done, **phase 7 next** |
| **MongoDB** | session `6f020813` | 🔴 active — syllabus cut to 82 topics, **Phase 0 complete (5/5)**, phase 1 next |
| **JavaScript** | session `01ECVvH5` | 🔴 active — phase 10 |
| **Express** | session `8679dc8c` | 🔴 active |
| **PostgreSQL** | — | ✅ complete, 298 pages |
| **Node.js** | — | ✅ complete, 248/248 |
| **Unclaimed, zero pages** | — | Docker & Podman, Redis, Nginx |

⚠️ **Known broken links that are NOT mine** — leave them: 3 TypeScript
(`phase-2-narrowing`), and `docs/README.md` → `./mongodb/pages/README.md` (session
`6f020813` wrote MongoDB pages without a `pages/README.md`).

## Verification claims worth carrying

- 🔴 **`useEffectEvent` is stable in 19.2** — reference page has no experimental
  banner (re-checked).
- 🔴 **The `useId` prefix DID change in 19.2** (`:r:`/`«r»` → `_r_`). I first wrote
  "could not confirm" and **corrected the page** once the release post was read.
  **Lesson: the release post answers version questions the API reference does not.**
- **`eslint-plugin-react-hooks`: v6 shipped with 19.2, npm shows 7.1.1 now.** Both
  numbers appear in docs; not a contradiction.
- **React Compiler 1.0 stable since 7 Oct 2025**; `target` accepts `'17' | '18' |
  '19'`, so it does **not** require React 19.
- **`<Activity>` shipped in 19.2** with `hidden` / `visible`.

## Shared-checkout hygiene

**Never `git add -A`.** `src/data/progress.js` and `docs/README.md` are edited by
every session — stage explicit paths, touch only your own rows, and expect your
commits to carry other sessions' in-flight rows (say so in the message).
