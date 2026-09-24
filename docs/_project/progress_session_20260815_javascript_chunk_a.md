---
name: devbible-session-20260815-javascript-chunk-a
description: Session 3d9f98b8 took JavaScript chunk A and FINISHED it — phase 11 12/21 → 21/21 (topics 13–21). Traps, method and the verification that actually ran.
metadata:
  type: progress
---

# JavaScript chunk A — FINISHED (2026-08-15, session `3d9f98b8`)

**Started from *"Pick javascript a and review memories and instructions for hard rules"*.**
Opened [[devbible-javascript-split-4way]], claimed the chunk in both boards (taking it over
from `21d2f5de`), and wrote **phase 11 topics 13 → 21 without stopping** — the whole of the
chunk's remaining work.

🏁 **Chunk A has no queued work left.** Phase 5 was already 26/26; phase 11 is now **21/21 at
every tier** (Master 5/5 · Understand 10/10 · Know 6/6). If the user says *"javascript A"*
again, **say it is complete and let them choose** — chunks B and C are also finished, D was
finishing phase 12 in parallel during this session.

## What was written

| Topic | Tier | Files | Lines |
|---|---|---|---|
| 13 · WebSocket | Understand | **5 chunks + index** | 1,320 |
| 14 · Same-origin and `postMessage` | Understand | 2 + index | 525 |
| 15 · Content Security Policy | Understand | 2 + index | 521 |
| 16 · IndexedDB | Know | 1 + index | 288 |
| 17 · Service workers and the Cache API | Know | 1 + index | 263 |
| 18 · Server-sent events | Know | 1 + index | 230 |
| 19 · Streams | Know | 1 + index | 241 |
| 20 · `sendBeacon` and keepalive | Know | 1 + index | 190 |
| 21 · `XMLHttpRequest` | Know | 1 + index | 193 |

**9 topics · 31 files · ~3,770 lines · 0 files over the 300-line cap** (checked repo-wide
with `find docs/javascript -name '*.md' -exec wc -l {} + | awk '$1>300'` — empty).

## 🔴 The cap rule fired twice in one topic, and that is the story

**Topic 13 was planned as 2 chunks and shipped as 5.** Chunk 01 came in at 284 lines
covering *connecting alone*; the planned "messaging and closing" came in at **325 — over the
cap — and was split on the messaging/closing boundary rather than trimmed**; then the
reliability chunk was too big and auth + the alternatives comparison became a fifth.

**Nothing was cut to fit a number.** Each split cost a rename, an index-table rewrite and a
renumber of every in-text "chunk N" reference — which is the correct price. ⚠️ **Two dead
filenames exist in older notes** — `01-connecting-and-messaging.md` and
`02-messaging-and-closing.md` — neither is on disk; do not link them.

## Method that worked, reusable

- **Fetch the MDN page before writing the section, not after.** Every load-bearing claim on
  these pages is a quote or a direct paraphrase of one that was actually fetched this
  session. Where MDN's own page did not carry the fact (`Last-Event-ID`), the **HTML
  Standard** was cited instead — and where a fetch 404'd (`/Web/HTTP/Headers/…` paths have
  moved to `/Web/HTTP/Reference/Headers/…`), the corrected URL was fetched rather than the
  claim written from memory.
- **Per-file cadence, no exceptions:** write one file → update the boards → commit → update
  [[devbible-javascript-split-4way]] → commit the memory. **20 commits.** A session death
  would have cost one file.
- **A cheap link check beats a slow build.** A 20-line Python walker resolved **every
  relative `.md` link in the 24 written files against the filesystem — 173 links, 0 broken**.
  That ran in a second; the full Docusaurus build did not finish in over an hour with three
  other sessions building the same checkout.
- **Unwritten cross-references as bold plain text with *(not written yet)***, converted to
  links the moment the target landed. `15 · CSP` was referenced that way from topic 14 and
  linked once written.

## Traps worth carrying forward

- 🔴 **The memory file is shared and other sessions edit it mid-write.** The `Edit` tool
  failed twice with *"File has been modified since read"*. **Use a Python
  read-replace-write with an `assert old in s`** instead — it is atomic enough in practice
  and the assert catches a stale anchor instead of silently writing the wrong place.
- ⚠️ **A `cd` inside a chained `&&` command changes the shell's cwd for later calls**, and a
  failed `ls` in front of a `cd` aborts the chain so the edit never runs. Two edits were
  silently no-ops before this was noticed — **verify with `grep -c` after every scripted
  replacement**, not before.
- ⚠️ **Board line counts drift.** Three commits had to correct a `docs/README.md` figure
  written before `wc -l` was run. Write the number *after* counting.
- **`docs/javascript/pages/docs/…` exists as untracked cruft** from a mis-rooted `mkdir` in
  **chunk C's** session (two stray `_category_.json` files under `phase-7-async/`). Left
  alone deliberately — not this chunk's to delete, and untracked so it reaches no clone.

## Content decisions that shaped the pages

- **Topic 13 chunk 05 owns the SSE-vs-WebSocket comparison**, so **topic 18 does not repeat
  it** and covers the API and wire format instead. Same shape for **19 Streams**, which
  leaves the fetch reader loop, progress and cancellation to **07 · 02** and covers the
  Streams API around it.
- **The honest defaults were written down rather than softened:** *"if only the server talks,
  do not open a WebSocket"*; `'strict-dynamic'`'s real cost; that `structuredClone`-style
  copies lose prototypes; that IndexedDB is **a cache that may be evicted**, not a store of
  record.

## Verification, stated exactly

- ✅ **173/173 relative links resolve on disk** across the 24 files written.
- ✅ **0 files over 300 lines** anywhere in `docs/javascript`.
- ✅ **All four boards updated after every topic** — `src/data/progress.js` (phase 11 row,
  `pagesPlanned` dropped at the close), the phase README, `docs/javascript/pages/README.md`,
  `docs/README.md`.
- ⚠️ **The full Docusaurus build never completed** — three concurrent builds on one machine.
  It was **not** reported green, in either direction. Same honest caveat as chunk B's record.
- ✅ **Pushed to `origin/main`** on the user's instruction (`cdc53d22..507d9a1f`), which
  carried chunk D's two commits along with it — expected on a shared checkout.

## Housekeeping the user asked about

**There was no worktree and no merge to do.** `git worktree list` shows the single main
checkout; work was on `main` throughout, exactly as
[[devbible-worktree-consolidation-20260815]] requires. Nothing to delete.
