---
title: "TypeScript — Explanations"
sidebar_label: "Overview"
sidebar_position: 0
---

:::info 🔒 Active work — TypeScript is held whole by ONE session

🔴 **The A/B split is closed as of 2026-08-14.** Part A (phases 2–6) was claimed
by session `3bbe364c`, which wrote the phase-2 index and topic 08 and then went
quiet; Part B (phases 7–12) was never picked up at all. Both halves are now held
by a **single** session, so there is no cross-part boundary left to police.

| Part | Phases | Topics | Claimed by |
|---|---|---|---|
| **A · the type system** | 2, 3, 4, 5, 6 | 73 | session `713ec3db`, 2026-08-14 |
| **B · TypeScript in the stack** | 7, 8, 9, 10, 11, 12 | 84 | session `713ec3db`, 2026-08-14 |

🔴 **Work happens in the worktree
`/run/media/sairam/Storage/Backup/Knowledge/devbible-typescript`, branch
`typescript-pages`** — not on `main`. ⚠️ **That branch is not merged into `main`
yet.** It merges at each phase boundary; saying so plainly rather than leaving it
stranded is the standing lesson from the React worktree.

Other technologies still belong to other live sessions. Shared files — this
README's phase rows, `docs/README.md`, and `src/data/progress.js` (anchor every
edit on the row's **slug**, never on a number) — are edited a row at a time,
re-read immediately before writing. **Never `git add -A`.** Where a page needs a
topic that is not written yet, write it as bold plain text with
*(not written yet)* rather than a link.

Split rules, kept for history: `devbible/project_typescript_split_parts_ab.md`.

:::

> Verified: 2026-08 on **TypeScript 7.0.2** and **Node 24.19.0** (Active LTS).

One page per topic from the [syllabus](../syllabus/01-type-system.md) — code,
gotchas written symptom → cause → fix, and interview questions with answers.

Every console block on these pages was produced by a script in `sandbox/ts-p0/`
and its siblings. Nothing is written from memory; where a measurement turned out
to be confounded, the correction is on the page rather than quietly removed.

## Phases

| Phase | Part | Pages | Status |
|---|---|---|---|
| [0 · How TypeScript runs](./phase-0-how-typescript-runs/README.md) | The type system | 13 | ✅ written |
| [1 · The type vocabulary](./phase-1-type-vocabulary/README.md) | The type system | 17 | ✅ written |
| [2 · Narrowing and control flow analysis](./phase-2-narrowing/README.md) | The type system | 10 / 13 | 🚧 writing |
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

Start → [Phase 0 — How TypeScript runs](./phase-0-how-typescript-runs/README.md)
