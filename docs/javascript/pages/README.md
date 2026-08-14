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
| **[3 · Functions, scope and closures](./phase-3-functions/README.md)** | Language core | 20 | 🟡 **Master tier ✅** (01–08); 09–20 deferred |
| **[4 · Objects, prototypes and classes](./phase-4-objects-and-classes/README.md)** | Language core | 20 | 🟡 **Master tier ✅** (01, 03–08); 02 and 09–20 deferred |
| **[5 · The built-in library](./phase-5-built-in-library/README.md)** | Data & async | 26 | 🟡 **Master tier ✅** (01, 02, 04–07, 09, 10); rest deferred |
| **[6 · Iteration, destructuring and generators](./phase-6-iteration-and-destructuring/README.md)** | Data & async | 13 | 🟡 **Master tier ✅** (01–03); rest deferred |
| **[7 · Asynchronous JavaScript](./phase-7-async/README.md)** | Data & async | 22 | 🟡 **Master tier ✅** (01–11 — all eleven); 12–22 deferred |
| **[8 · Modules, errors, memory and the toolchain](./phase-8-modules-errors/README.md)** | Data & async | 18 | 🟡 **Master tier ✅** (01–04 — all four); 05–18 deferred |
| **[9 · The DOM](./phase-9-dom/README.md)** | Web APIs | 19 | 🟡 **Master tier ✅** (01–06 — all six); 07–19 deferred |
| 10 · Events and user input | Web APIs | 14 | planned |
| 11 · Network, storage and data transfer | Web APIs | 21 | planned |
| 12 · The browser platform | Web APIs | 21 | planned |
| 13 · Complexity and JavaScript's real costs | DSA | 10 | planned |
| 14 · Core data structures in JavaScript | DSA | 17 | planned |
| 15 · Algorithmic patterns | DSA | 20 | planned |
| 16 · Dynamic programming and the harder set | DSA | 16 | planned |
| 17 · Machine coding: implement it yourself | DSA | 18 | planned |
| 18 · Building the store front end | Applied | 18 | planned |

## 🔒 Active work claim — read before editing anything under `docs/javascript/`

| | |
|---|---|
| **Claimed by** | session `01ECVvH5` (Opus 5), started 2026-08-13 |
| **Claim** | **all of `docs/javascript/`** — currently **Phase 7 · Asynchronous JavaScript**, Master tier |
| **Last touched** | **Phase 9 topic 06 · Sanitising HTML** — **Phase 9 Master tier COMPLETE** (2026-08-14) |
| **Done and committed** | Phases 0–2 complete · **Master tiers complete** for Phase 3 (01–08), Phase 4 (01, 03–08), Phase 5 (01, 02, 04–07, 09, 10), Phase 6 (01–03) · **Phase 7 Master 01–11 ✅** |
| **Next** | **Phase 10 · Events and user input** — Master topics |
| **Totals** | **148 pages**, 196 carrying `> Verified:`, **0 files over 300 lines**, **0 broken links** |

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

## Working order — Master-first

Phases are written **Master tier first, across all phases**, rather than one phase
to completion. Understand and Know tiers are filled in on demand afterwards. So a
phase marked *Master tier ✅* is finished for now and the next unit of work is the
**next phase's Master topics**, not that phase's topic 09.

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
