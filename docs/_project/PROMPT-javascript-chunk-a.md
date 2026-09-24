---
name: devbible-prompt-javascript-chunk-a
description: Paste-ready bootstrap prompt for JavaScript chunk A (phases 5 and 11 — the built-in library, then network, storage and data transfer) — hand it to a fresh session and it starts cold
metadata:
  type: reference
---

**Paste everything below the line into a fresh session.** Or just type **`pick javascript A`** —
`~/.claude/CLAUDE.md` §11b now recognises that on its own and starts the same work without asking.

---

You are taking **JavaScript chunk A** of the devbible corpus: **phases 5 and 11 — the built-in library, then network, storage and data transfer**. **23 topics left.**

**Repo:** `/run/media/sairam/Storage/Backup/Knowledge/devbible`, branch `main`. There are no
worktrees — every one was merged and deleted on 2026-08-15.

## Read these first, in this order

1. `~/.claude/CLAUDE.md` — the hard rules. §11b is the four-chunk split; rule 1 is the line cap,
   rule 8 is no-new-sandboxes, rule 9 is the save cadence.
2. `/run/media/sairam/Storage/my-learning/claude/devbible/progress_javascript_split_4way.md` — the
   live cursor for all four chunks. **Yours is chunk A.**
3. `docs/javascript/pages/README.md` in the repo — the chunk table, the shared-file rules and the
   page shape.

Do **not** re-derive your position from the git log or the phase READMEs; the cursor file is
authoritative.

## Your chunk — nothing outside it

| Phase | Written | Left | Start at | Directory |
|---|---|---|---|---|
| **5 · The built-in library** | 17/26 | **9** | **18 · `Object` statics (Understand)** | `docs/javascript/pages/phase-5-built-in-library/` |
| **11 · Network, storage and data transfer** | 7/21 | **14** | **08 · Aborting and timing out (Understand)** | `docs/javascript/pages/phase-11-network-storage/` |

They pair on purpose: `structuredClone`, typed arrays and `TextEncoder` from phase 5 are exactly what phase 11's `postMessage`, `Blob` and streams pages lean on.

**⛔ Everything outside your two phases belongs to another live session** — the four chunks are
**A** (5, 11) · **B** (6, 17) · **C** (7, 8) · **D** (12, 18). Do not write in another chunk's phase, not to fix a link,
not to correct a stale count. Phases 0–4, 9 and 10 are complete at every tier; phases 13, 14 and 15
are **parked** and 16 is **dropped** — none of them are anyone's work.

## The worklist, in order

**Phase 5 · The built-in library — 9 left.** Start at **18 · `Object` statics (Understand)**, then 19 `Date` · 20 `Intl` · 21 `structuredClone` · 22 Array-likes and iterables — then **Know**: 23 `WeakMap`/`WeakSet` · 24 `Temporal` · 25 typed arrays, `ArrayBuffer`, `DataView` · 26 Text encoding.

**Phase 11 · Network, storage and data transfer — 14 left.** Start at **08 · Aborting and timing out (Understand)**, then 09 Cookies · 10 `localStorage`/`sessionStorage` · 11 Uploading files · 12 `Blob`/`File`/`FileReader` · 13 WebSocket · 14 Same-origin and `postMessage` · 15 CSP — then **Know**: 16 IndexedDB · 17 Service workers and the Cache API · 18 Server-sent events · 19 Streams · 20 `sendBeacon` and keepalive · 21 `XMLHttpRequest`.

**Inside a phase: Understand → Know → When Needed**, lowest unwritten number first. Finish your
first phase completely before starting the second.

## Before you write a line — claim the chunk

Put your session id in **both** boards:

- `docs/javascript/pages/README.md` — the `Held by` cell of the chunk A row.
- `docs/README.md` — the `Claimed by` cell of the **JavaScript · chunk A** row.

Naming a chunk transfers it to you; if the row shows an older session id, take it over and say so.

## The rules — none of these are optional

- 🔴 **Tier-locked to Understand and Know.** The Master tier is **closed at 99/99**. Never reopen a
  Master topic to deepen it — what is left is breadth. Where an Understand topic overlaps a Master
  one, write the **concept and the choice** and link to the Master implementation; never write the
  implementation twice.
- 🔴 **300 lines is a FILE-SIZE cap, never a content budget.** A topic may run 1000+ lines in total.
  Write the explanation the topic deserves **first**, then split on a concept boundary into
  `NN-topic/` with `_category_.json`, a `README.md` index and numbered chunks that link
  `← Prev` / `Next →`. Every chunk repeats the tier badge and `> Verified:` line and carries its own
  Gotchas and Interview questions. **Never trim a section to fit the number.** The tell that you got
  it wrong is a run of pages all landing just under 300.
- 🔴 **No sandbox, no invented output.** Validate against MDN and the specifications, name the
  sources in the page's `> Verified:` line. **No run means no console block** — never reconstruct a
  plausible console block, timing or error string from memory. A claim the docs cannot settle is
  stated as uncertain or left out.
- **Links** always end in `.md` and keep every numeric prefix — `../05-topic/README.md`,
  `../05-topic/02-chunk.md`. Never the directory slug. Where a page needs a topic another chunk
  owns, write it as **bold plain text with *(not written yet)*** — a link to an unwritten page
  breaks the build.
- **Never `git add -A`.** Four sessions share this checkout; stage explicit paths every time, and
  treat a build failure in another language as someone else's to fix.

## The cadence — per file, not per phase

After **every file**: update the boards → commit → update the memory. A session that dies must lose
at most one file.

**Boards, after every completed topic:**

1. `src/data/progress.js` — **only your phases' rows**. Mid-phase needs both `pages: N` and
   `pagesPlanned: <total>`; drop `pagesPlanned` only when the phase closes.
2. That phase's `README.md` — the count, the topic row with its link, the Coverage block.
3. `docs/javascript/pages/README.md` — the phase row and your chunk block.
4. `docs/README.md` — your chunk row, and the JavaScript technology row when a phase closes.

**Memory:** update `progress_javascript_split_4way.md` in the store (your rows only) and commit it.
An uncommitted memory is not a memory. Per phase, also record the load-bearing claims and their
sources in `reference_javascript_concepts_phase<N>.md`.

**Checks before each commit:**

```bash
find docs/javascript -name '*.md' -exec wc -l {} + | awk '$1>300 && $2!="total"'   # must print nothing
yarn build > build.log 2>&1
grep "source file" build.log | grep 'docs/javascript' | sed 's#.*pages/##' | cut -d/ -f1 | sort | uniq -c
```

## How to work

**Run it to completion. Do not stop between topics to ask.** Write a topic → boards → build →
commit → memory → **start the next topic in the same turn**. Reporting progress is not a reason to
pause; a turn ends because it runs out, not because a topic finished. Start now at
**phase 5 topic 18 · `Object` statics (Understand)** — no plan, no confirmation.
