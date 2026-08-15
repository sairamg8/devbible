---
title: "Explanations"
sidebar_label: "Overview"
sidebar_position: 0
---

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
| **[5 · The built-in library](./phase-5-built-in-library/README.md)** | Data & async | 26 | 🚧 **Master ✅ 8/8** · Understand under way (03, 08, 11–17 done) |
| **[6 · Iteration, destructuring and generators](./phase-6-iteration-and-destructuring/README.md)** | Data & async | 13 | 🟡 **Master tier ✅** (01–03); rest deferred |
| **[7 · Asynchronous JavaScript](./phase-7-async/README.md)** | Data & async | 22 | 🟡 **Master tier ✅** (01–11 — all eleven); 12–22 deferred |
| **[8 · Modules, errors, memory and the toolchain](./phase-8-modules-errors/README.md)** | Data & async | 18 | 🟡 **Master tier ✅** (01–04 — all four); 05–18 deferred |
| **[9 · The DOM](./phase-9-dom/README.md)** | Web APIs | 19 | 🚧 **Master ✅** (01–06) · Understand under way (**07–13** ✅) |
| **[10 · Events and user input](./phase-10-events/README.md)** | Web APIs | 14 | 🟡 **Master tier ✅** (01–04 — all four); 05–14 deferred |
| **[11 · Network, storage and data transfer](./phase-11-network-storage/README.md)** | Web APIs | 21 | 🟡 **Master tier ✅** (01–05 — all five); 06–21 deferred |
| **[12 · The browser platform](./phase-12-browser-platform/README.md)** | Web APIs | 21 | 🟡 **Master tier ✅** (01–02 — both); 03–21 deferred |
| **[13 · Complexity and JavaScript's real costs](./phase-13-complexity/README.md)** | DSA | 10 | 🟡 **Master tier ✅** (01–03 — all three); 04–10 deferred |
| **[14 · Core data structures in JavaScript](./phase-14-data-structures/README.md)** | DSA | 17 | 🟡 **Master tier ✅** (01–05 — all five); 06–17 deferred |
| **[15 · Algorithmic patterns](./phase-15-algorithm-patterns/README.md)** | DSA | 20 | 🟡 **Master tier ✅** (01–04, 06 — all five); rest deferred |
| **[16 · Dynamic programming and the harder set](./phase-16-dynamic-programming/README.md)** | DSA | 16 | 🟡 **Master tier ✅** (01–03 — all three); rest deferred |
| **[17 · Machine coding: implement it yourself](./phase-17-machine-coding/README.md)** | DSA | 18 | 🟡 **Master tier ✅** (01–04 — all four); rest deferred |
| **[18 · Building the store front end](./phase-18-storefront/README.md)** | Applied | 18 | 🟡 **Master tier ✅** (01–07 — all seven); rest deferred |

## 🔒 TWO LANES — `docs/javascript/` is split between two sessions (2026-08-14)

🔴 **Read this before writing anything.** JavaScript is worked by **two sessions at once**,
split by phase. Take your lane's phases and **never write in the other lane's**.

| Lane | Phases | Topics left | Held by |
|---|---|---|---|
| **A · The language** | **3, 4, 5, 6, 7, 8** — functions, objects, the built-in library, iteration, async, modules/errors | **44** | session `edbfba95` |
| **B · Platform and applied** | **9, 10, 11, 12, 17, 18** — DOM, events, network/storage, browser platform, machine coding, storefront | **68** | session `75e511e6` |

**The seam is the language itself versus the browser platform**, so the two lanes barely
cross-reference each other. Where a page needs the other lane's topic, **write it as bold plain
text with *(not written yet)*** rather than a link — a link to an unwritten page breaks the
build, and the other lane may not have written it yet.

**Shared files, and the rule for each:**

| File | Rule |
|---|---|
| `src/data/progress.js` | Edit **only your own phases' rows**. Expect the other lane's rows in your `git diff` — leave them. |
| `docs/README.md` | Two JavaScript rows, one per lane. Touch only yours. |
| this file | The lane table above, and your lane's block below. |
| a phase `README.md` | Belongs to whichever lane owns that phase. |

**Never `git add -A`.** Stage explicit paths, every time.

## 🔒 Lane A claim — phases 3–8

| | |
|---|---|
| **Claimed by** | session `edbfba95` (Opus 5), from 2026-08-14 — took over from `ec7d13f7` ← `016cfc46` ← `c5329658` ← `01ECVvH5` |
| **Claim** | **all of `docs/javascript/`** — 🔴 **TIER-LOCKED to Understand and Know.** Master is **closed at 99/99** and is not to be reopened for depth. 🔴 **SCOPE CUT 2026-08-14:** phase 16 (Dynamic programming) **dropped** beyond its 3 Master topics; phase 18 trimmed to **11, 12 and 15 only**; the whole DSA block **parked** — 13 (Complexity), 14 (Data structures) and 15 (Algorithmic patterns) — *"mostly language focus"*. **21 dropped, 34 parked.** 17 · Machine coding stays **in scope**: it implements JavaScript's own library functions, which is language work. Nothing already written was deleted.** |
| **Last touched** | 🎉 **PHASE 4 COMPLETE — 20 of 20, every tier** (Master 7/7 · Understand 9/9 · Know 4/4), closed by topic 20 · Private state before `#`, 2026-08-15. **Phases 3 and 4 are both complete at every tier.** |
| **Where lane A writes** | 🔴 the worktree **`devbible-js-lane-a`, branch `js-lane-a`** — not on `main`. Merged into `main` at every phase boundary; last merge `a7a92fec`, after which `main..js-lane-a` was empty |
| **Done and committed** | Phases 0–2 complete · **Master tiers complete** for Phase 3 (01–08), Phase 4 (01, 03–08), Phase 5 (01, 02, 04–07, 09, 10), Phase 6 (01–03), Phase 7 (01–11), Phase 8 (01–04), Phase 9 (01–06), Phase 10 (01–04), Phase 11 (01–05), Phase 12 (01–02), Phase 13 (01–03), Phase 14 (01–05), Phase 15 (01–04, 06), Phase 16 (01–03), Phase 17 (01–04), Phase 18 (01–07) |
| **Next** | **Phase 5 · 18 · `Object` statics**, then 19–22 and the four Know topics. **9 left in phase 5.** Inside each phase: **Understand → Know → When Needed** |
| **Remaining** | **119 topics in the active queue** — Understand **79**, Know **37**, When Needed **3**. Plus **34 parked** (phases 13, 14, 15) and **21 dropped** (phases 16, 18). Thinnest live phase: **12 · browser platform, 2/21** |
| **Totals** | **154 of 316 in scope** (337 syllabus rows − 21 dropped). **0 files over 300 lines**, **0 broken links under lane A's phases 3–8**. ⚠️ The earlier "253 pages / 311 verified" figure was wrong — audited 2026-08-14 |

**If you are another session:** please do not write under `docs/javascript/` while
this claim stands — pick another language (PostgreSQL is parked, React/TypeScript/CSS
are free). If you must, say so here first and take a *different phase*.

**We share one working tree.** During this session the broken-link count moved
21 → 31 → 19 → 26 → 31 purely from other sessions' **uncommitted** edits under
`docs/postgresql/` and `docs/react/`. So:

- `git add` **only your own paths**. Never `git add -A`.
- When a build reports broken links, **check whose page they are on** before assuming
  you caused them.
- Clean-rebuild and grep rather than trusting `[SUCCESS]`:
  `rm -rf .docusaurus build node_modules/.cache && yarn build 2>&1 | grep -iE 'warning|broken'`

## 🔒 Lane B claim — phases 9–12, 17, 18

| | |
|---|---|
| **Claimed by** | session `75e511e6` (Opus 5), from 2026-08-14 — took over from `b4ffc223`, the first holder |
| **Claim** | **phases 9, 10, 11, 12, 17 and 18 only** — DOM, events, network/storage, browser platform, machine coding, and the three kept storefront topics. 🔴 **TIER-LOCKED to Understand and Know**; Master is closed at 99/99 and is not reopened for depth. The 2026-08-14 scope cut applies: phase 18 keeps **only topics 11, 12 and 15**; phases 13, 14, 15 are parked and 16 is dropped — none of them are in either lane |
| **Last touched** | **Phase 9 topic 13 · Measuring elements** — 2026-08-14, 3 files |
| **Next** | **Phase 9 topic 14 · Scrolling**, then 15 (Understand), 16–18 (Know), 19 (When Needed); then phase 10 from topic 05 |
| **Remaining** | **68 topics** — 9 (6), 10 (10), 11 (16), 12 (19), 17 (14), 18 (3) |
| **Verification** | Documentation-validated against MDN and the specifications, named in each page's `> Verified:` line. **No sandbox, no timings, no console block for a run that did not happen** |

⛔ **Lane B never writes in phases 3–8** — those are lane A's, live in another session
right now. Not to fix a link, not to correct a count.

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
