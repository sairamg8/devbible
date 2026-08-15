---
title: "Explanations"
sidebar_label: "Overview"
sidebar_position: 0
---

:::tip Consolidated 2026-08-15 — all work is on `main`
Every worktree and branch in this repo was **merged into `main` and deleted** on
2026-08-15. Any "worktree `devbible-…`", "branch `…`" or "not merged" note below is
**historical** — nothing is stranded, and all of it is on `main`. Work in
`/run/media/sairam/Storage/Backup/Knowledge/devbible` on `main`, and keep staging
explicit paths (never `git add -A`) since everyone shares the checkout again.
:::

The explanation pages for JavaScript — one page per syllabus topic (or tight
group), with runnable code, gotchas written **symptom → cause → fix**, and
interview questions with answers.

The inventory and tiering live in the [syllabus](../syllabus/01-language-core.md).
This page tracks what is actually written.

import Progress from '@site/src/components/Progress';

<Progress lang="javascript" />

## Phases

| Phase | Part | Topics | Status |
|---|---|---|---|
| **[0 · How JavaScript runs](./phase-0-how-javascript-runs/README.md)** | Language core | 12 | ✅ written |
| **[1 · Values, types and coercion](./phase-1-values-and-coercion/README.md)** | Language core | 17 | ✅ written |
| **[2 · Operators, expressions and control flow](./phase-2-operators/README.md)** | Language core | 15 | ✅ written |
| **[3 · Functions, scope and closures](./phase-3-functions/README.md)** | Language core | 20 | ✅ **complete — every tier** |
| **[4 · Objects, prototypes and classes](./phase-4-objects-and-classes/README.md)** | Language core | 20 | ✅ **complete — every tier** (Master 7/7 · Understand 9/9 · Know 4/4) |
| **[5 · The built-in library](./phase-5-built-in-library/README.md)** | Data & async | 26 | ✅ **COMPLETE — every tier (26/26)** · Master 8/8 · Understand 14/14 · Know 4/4 |
| **[6 · Iteration, destructuring and generators](./phase-6-iteration-and-destructuring/README.md)** | Data & async | 13 | ✅ **COMPLETE — every tier (13/13, 40 files)** |
| **[7 · Asynchronous JavaScript](./phase-7-async/README.md)** | Data & async | 22 | ✅ **COMPLETE — every tier (22/22, 69 files, 11,962 lines)** |
| **[8 · Modules, errors, memory and the toolchain](./phase-8-modules-errors/README.md)** | Data & async | 18 | ✅ **COMPLETE — every tier (18/18)** · Master 4/4 · Understand 10/10 · Know 4/4 |
| **[9 · The DOM](./phase-9-dom/README.md)** | Web APIs | 19 | ✅ **COMPLETE — every tier (19/19, 59 files)** |
| **[10 · Events and user input](./phase-10-events/README.md)** | Web APIs | 14 | ✅ **COMPLETE — every tier (14/14)** |
| **[11 · Network, storage and data transfer](./phase-11-network-storage/README.md)** | Web APIs | 21 | ✅ **COMPLETE — every tier (21/21)** · Master 5/5 · Understand 10/10 · Know 6/6 |
| **[12 · The browser platform](./phase-12-browser-platform/README.md)** | Web APIs | 21 | ✅ **COMPLETE — every tier (21/21)** · Master 2/2 · Understand 11/11 · Know 7/7 · When Needed 1/1 |
| **[13 · Complexity and JavaScript's real costs](./phase-13-complexity/README.md)** | DSA | 10 | 🟡 **Master tier ✅** (01–03 — all three); 04–10 deferred |
| **[14 · Core data structures in JavaScript](./phase-14-data-structures/README.md)** | DSA | 17 | 🟡 **Master tier ✅** (01–05 — all five); 06–17 deferred |
| **[15 · Algorithmic patterns](./phase-15-algorithm-patterns/README.md)** | DSA | 20 | 🟡 **Master tier ✅** (01–04, 06 — all five); rest deferred |
| **[16 · Dynamic programming and the harder set](./phase-16-dynamic-programming/README.md)** | DSA | 16 | 🟡 **Master tier ✅** (01–03 — all three); rest deferred |
| **[17 · Machine coding: implement it yourself](./phase-17-machine-coding/README.md)** | DSA | 18 | ✅ **COMPLETE — every tier (18/18)** · Master 4/4 · Understand 11/11 · Know 3/3 |
| **[18 · Building the store front end](./phase-18-storefront/README.md)** | Applied | 18 | 🟡 **Master tier ✅** (01–07 — all seven); rest deferred |

## 🔒 FOUR CHUNKS — `docs/javascript/` is split between four sessions (2026-08-15)

🔴 **Read this before writing anything.** The old **two-lane** split (A: phases 3–8 · B: phases
9–12, 17, 18) is **CLOSED** — phases 3, 4, 9 and 10 finished under it, so what is left no longer
divides that way. The remaining **94 in-scope topics** are split **four ways, whole phases only**,
so no two sessions ever write in the same phase directory or the same phase `README.md`.

| Chunk | Phases | Topics left | What it is | Held by |
|---|---|---|---|---|
| **A** | **5**, **11** | ✅ **0 — CHUNK A IS FINISHED** (2026-08-15) | Both phases complete at every tier: 5 ✅ 26/26 · 11 ✅ 21/21 | 🔴 session `3d9f98b8`, 2026-08-15 |
| **B** | **6**, **17** | ✅ **0 — CHUNK B IS FINISHED** (phase 6 13/13 · phase 17 18/18) | Iteration, generators and iterator helpers; then machine coding | 🔴 session `233dede7`, 2026-08-15 (took over from `7c6611b4`) |
| **C** | **7**, **8** | ✅ **0 — CHUNK C IS COMPLETE** (7: 22/22 · 8: 18/18) | Async beyond the Master tier; then modules, errors, memory and the toolchain — both phases done 2026-08-15 | ✅ session `f7bca7a9`, 2026-08-15 (took over from `f6dffd4a`) |
| **D** | **12**, **18** | **3** — ✅ **12 COMPLETE 21/21** · 18 (**3**: 11, 12, 15 only) | ✅ the browser platform is finished; now the three kept storefront topics | 🔴 session `dbaa68e7`, 2026-08-15 |

### 🔴 How a session is started — `pick javascript A`, and nothing more

**The user starts a session by naming JavaScript plus a chunk letter, and that is the whole
instruction.** All of these mean the same thing and require **no clarifying question**:

> *"pick javascript A"* · *"javascript chunk B"* · *"JS C"* · *"take D"* · *"pick up js b"*

**On seeing one:** open `devbible/progress_javascript_split_4way.md` in the memory store, start at
the topic that chunk's cursor names, claim the chunk in the two boards, and **write** — no plan, no
confirmation, no "shall I begin". A message that names a **phase** instead of a letter settles it
too: 5 and 11 → A · 6 and 17 → B · 7 and 8 → C · 12 and 18 → D.

⚠️ **The letters were REDEFINED on 2026-08-15.** They no longer mean the old two lanes — "lane A =
phases 3–8" and "lane B = phases 9–12, 17, 18" are **dead**. Read the letter off the table above,
never off an older memory file.

**Only ask which chunk if the user says "JavaScript" with no letter and no phase.**

**Claim your chunk before writing** — put your session id in the row above **and** in your chunk's
row in [`docs/README.md`](../../README.md). Naming a chunk transfers it to the session it was named
in; if a row already carries an older session id, take it over and say so.

**Nothing outside your chunk.** Not to fix a link, not to correct a stale count, not because another
phase looks idle. Phases **0, 1, 2, 3, 4, 9, 10** are complete at every tier. Phases **13, 14, 15**
are **parked** and **16** is **dropped** — they belong to no chunk and are not to be picked up
without a new instruction from the user.

**Where a page needs a topic from another chunk, write it as bold plain text with *(not written
yet)*** rather than a link — a link to an unwritten page breaks the build.

**Shared files, and the rule for each:**

| File | Rule |
|---|---|
| `src/data/progress.js` | Edit **only your own phases' rows**. Expect the other chunks' rows in your `git diff` — leave them. |
| `docs/README.md` | Four JavaScript rows, one per chunk. Touch only yours, plus the JavaScript technology row when a phase closes. |
| this file | The chunk table above, and your own chunk block below. |
| a phase `README.md` | Belongs to whichever chunk owns that phase — and no phase is shared. |

**Never `git add -A`.** Stage explicit paths, every time. Everything is on `main`; there are no
worktrees left.

## 🔒 Chunk claims

| Chunk | Phase | Left | Start at | Then |
|---|---|---|---|---|
| **A** | 5 · The built-in library ✅ **COMPLETE 26/26** | 0 | — | every tier done 2026-08-15 |
| **A** | 11 · Network, storage and data transfer ✅ **21/21** | 0 | — | ✅ **Understand tier complete (06–15)** · ~~16 IndexedDB ✅~~ · ~~17 service workers ✅~~ · ~~18 SSE ✅~~ · ~~19 Streams ✅~~ · ~~20 `sendBeacon` ✅~~ · ~~21 `XMLHttpRequest` ✅~~ |
| **B** | 6 · Iteration, destructuring and generators | ✅ **13/13 — COMPLETE** | — | phase 6 is done; chunk B continues in phase 17 |
| **B** | 17 · Machine coding ✅ **COMPLETE 18/18** | 0 | — | every tier done 2026-08-15; **chunk B has no work left** |
| **C** | 7 · Asynchronous JavaScript ✅ **22/22** | **0** | ✅ **COMPLETE 2026-08-15** — every tier, 69 files, 11,962 lines | — |
| **C** | 8 · Modules, errors, memory and the toolchain ✅ **18/18** | **0** | — | ✅ **chunk C complete**: phase 7 22/22 and phase 8 18/18, finished 2026-08-15 |
| **D** | 12 · The browser platform ✅ **COMPLETE 21/21** | 0 | — every tier done 2026-08-15 | chunk D continues in phase 18 |
| **D** | 18 · Building the store front end (7/18) | 3 | **11 · Infinite scroll and lazy images** | 12 Long lists without freezing · 15 Review uploads. ⚠️ **Only these three** — 08–10, 13, 14 and 16–18 were **dropped** on 2026-08-14 and are not to be written |

**Rules every chunk shares:** 🔴 **tier-locked to Understand and Know** — Master is **closed at
99/99** and a Master topic is not reopened to deepen it. Inside a phase the order is **Understand →
Know → When Needed**, lowest unwritten number first, and a phase is finished before the chunk's next
phase starts. Documentation-validated against MDN and the specifications, named in each page's
`> Verified:` line — **no sandbox, no timings, no console block for a run that did not happen**.
🔴 **Per-file cadence:** write a file → update the boards → commit → update the memory.

## 🔴 The critical rule — a line cap is a FILE-SIZE rule, never a content budget

**300 lines per file, hard. It says nothing about how much a topic gets explained.**

- A Master topic may run **900–1400 lines in total**, across as many chunks as it
  takes. That is normal and expected.
- **Write the explanation the topic deserves first, then split** on a concept
  boundary into `NN-topic/` with `_category_.json`, a `README.md` index and numbered
  chunks. Never size a page to fit the cap; never trim a gotcha or an interview
  answer to save lines.
- Every chunk repeats the tier badge and `> Verified:` line and carries **its own**
  Gotchas and Interview questions.
- **The tell that you got it wrong:** a run of pages all landing just under the cap.
  Real topic lengths vary.

🔴 **Run the check before every commit — knowing the rule is not enough.** Five files
shipped in this session at 315–411 lines and had to be re-split, because nothing ever
counted them:

```bash
find docs/javascript -name '*.md' -exec wc -l {} + | awk '$1>300 && $2!="total"'
```

**Links:** always link the `.md` file and keep every numeric prefix —
`../05-the-prototype-chain/README.md`, `../05-the-prototype-chain/02-…md`. Never the
directory slug. **Chunking a topic is not done until you grep for inbound links to
its old flat path.**

## Working order — 🔴 Master-first is FINISHED; the tiers are the work

**The Master tier is complete: all 99 Master topics across every phase 0–18.** That
strategy is done, and as of 2026-08-14 the claim is **tier-locked to Understand and
Know**. A Master topic is **not** to be reopened to deepen it — what is left is
breadth, not depth.

**Order from here: phase by phase, and inside a phase Understand → Know → When
Needed.** Not Understand-across-all-phases-first — phase 3 is already mid-flight
that way, so any other order strands it. So a phase marked *Master tier ✅* is the
**next** place to work, starting at its lowest unwritten Understand topic.

## How these pages are verified

Every page names its provenance in its own `> Verified:` line. There are two, and
they are not mixed on a single page:

| Provenance | Which pages | What it means |
|---|---|---|
| **Measured** | Phases 0–2, and Phase 3 topics 01–07 | Console blocks were produced by a script in `sandbox/js-*/`, run on **Node 24.19.0** (V8 13.6). Sloppy-mode and CommonJS behaviours have `.cjs` companion scripts |
| **Documentation-validated** | Phase 3 topic 08 onward | Claims are checked against MDN and the specification, cited by name and link. **No new sandboxes are built** |

**No run means no console block.** A documentation-validated page explains the
behaviour in prose rather than printing output nobody produced; where it needs a
measured fact that an existing run already covers, it links to the page that owns
that output. A claim documentation cannot settle is stated as uncertain or left
out. Browser-only behaviour (DOM, events, CORS) carries a `VERIFY` marker until
run in a real browser.

---

Start → [Phase 0 — How JavaScript runs](./phase-0-how-javascript-runs/README.md)
