---
title: "TypeScript — Explanations"
sidebar_label: "Overview"
sidebar_position: 0
---

> Verified: 2026-08 on **TypeScript 7.0.2** and **Node 24.19.0** (Active LTS).

One page per topic from the [syllabus](../syllabus/01-type-system.md) — code,
gotchas written symptom → cause → fix, and interview questions with answers.

Every console block on these pages was produced by a script in `sandbox/ts-p0/`
and its siblings. Nothing is written from memory; where a measurement turned out
to be confounded, the correction is on the page rather than quietly removed.

## Phases

| Phase | Part | Pages | Status |
|---|---|---|---|
| [0 · How TypeScript runs](./phase-0-how-typescript-runs/) | The type system | 13 | ✅ written |
| [1 · The type vocabulary](./phase-1-type-vocabulary/) | The type system | 17 | ✅ written |
| 2 · Narrowing and control flow analysis | The type system | — | planned |
| 3 · Generics | The type system | — | planned |
| 4 · Classes, objects and declaration merging | Types at scale | — | planned |
| 5 · Type-level programming | Types at scale | — | planned |
| 6 · Modules, declarations and the build | Types at scale | — | planned |
| 7 · TypeScript on the server | In the stack | — | planned |
| 8 · TypeScript in React | In the stack | — | planned |
| 9 · Types at the boundary | In the stack | — | planned |
| 10 · Strictness and correctness | Rigour and tooling | — | planned |
| 11 · Migration and legacy | Rigour and tooling | — | planned |
| 12 · Tooling, performance and testing | Rigour and tooling | — | planned |

import Progress from '@site/src/components/Progress';

<Progress lang="typescript" />

---

Start → [Phase 0 — How TypeScript runs](./phase-0-how-typescript-runs/)
