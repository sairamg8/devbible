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
| **[4 · Objects, prototypes and classes](./phase-4-objects-and-classes/README.md)** | Language core | 20 | 🟡 **in progress** — Master tier |
| 5 · The built-in library | Data & async | 26 | planned |
| 6 · Iteration, destructuring and generators | Data & async | 13 | planned |
| 7 · Asynchronous JavaScript | Data & async | 22 | planned |
| 8 · Modules, errors, memory and the toolchain | Data & async | 18 | planned |
| 9 · The DOM | Web APIs | 19 | planned |
| 10 · Events and user input | Web APIs | 14 | planned |
| 11 · Network, storage and data transfer | Web APIs | 21 | planned |
| 12 · The browser platform | Web APIs | 21 | planned |
| 13 · Complexity and JavaScript's real costs | DSA | 10 | planned |
| 14 · Core data structures in JavaScript | DSA | 17 | planned |
| 15 · Algorithmic patterns | DSA | 20 | planned |
| 16 · Dynamic programming and the harder set | DSA | 16 | planned |
| 17 · Machine coding: implement it yourself | DSA | 18 | planned |
| 18 · Building the store front end | Applied | 18 | planned |

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
