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
| **[0 · How JavaScript runs](./phase-0-how-javascript-runs/)** | Language core | 12 | ✅ written |
| **[1 · Values, types and coercion](./phase-1-values-and-coercion/)** | Language core | 17 | ✅ written |
| **[2 · Operators, expressions and control flow](./phase-2-operators/)** | Language core | 15 | ✅ written |
| 3 · Functions, scope and closures | Language core | 20 | planned |
| 4 · Objects, prototypes and classes | Language core | 20 | planned |
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

## How these pages are verified

| Parts | Host | Provenance |
|---|---|---|
| 1, 2, 4 | **Node 24.19.0** (V8 13.6) | Scripts in `sandbox/js-*/`; pages carry `> Verified:` |
| 3, 5 | Browser | Node-runnable APIs are measured and marked; DOM, event and CORS output carries a `VERIFY` marker until run in a real browser |

**No page carries a `> Verified:` line for output that was not produced.** A
claim without a script gets a marker, not a plausible-looking transcript.

---

Start → [Phase 0 — How JavaScript runs](./phase-0-how-javascript-runs/)
