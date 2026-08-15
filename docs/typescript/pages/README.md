---
title: "TypeScript — Explanations"
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

:::info 🔒 Active work — the A/B split is REOPENED, both parts are live

🔴 **Reopened 2026-08-15.** Two sessions now write TypeScript in parallel, on
`main`, with a hard directory boundary between them. **Neither creates nor edits
a file in the other's phase directories.**

| Part | Phases | Topics | Claimed by |
|---|---|---|---|
| **A · the type system** | 2, 3, 4, 5, 6 | 73 | session `3af83cbb`, 2026-08-15 — phases 0–2 ✅, phase 3 at 11/14 |
| **B · TypeScript in the stack** | 7, 8, 9, 10, 11, 12 | 84 | session `27931e79`, 2026-08-15 — cold start, phase 7 in progress |

Part B's six phase directories **did not exist** at claim time; each is scaffolded
(`_category_.json` plus a `README.md` carrying the full topic table) as it is
reached, which is why they show as `planned` below until their index lands.

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

:::caution Part B was re-scoped on 2026-08-15 — phases 8, 9 and 11 are dropped
On the user's instruction (*"I just need phase 10 and phase 12 apart from rest
drop, if they are already written let it be and if not written yet drop those"*),
**Part B keeps only phases 10 and 12.** Phases 8, 9 and 11 had **nothing
written** and are dropped; phase 7 **keeps its five written Master topics** and
its ten unwritten rows are dropped.

**Nothing written was deleted** — a dropped phase that still has pages is
correct, and phase 7's five topics stay on the reading path. The syllabus rows
for the dropped phases are kept under banners in
[Part 3](../syllabus/03-in-the-stack.md) and
[Part 4](../syllabus/04-rigour-and-tooling.md); reopening any of them needs a new
instruction. **TypeScript's in-scope total is therefore 136, not 187.**

⚠️ This cut applies to **Part B only**. Phases 2–6 belong to Part A and are
untouched by it.
:::


| Phase | Part | Pages | Status |
|---|---|---|---|
| [0 · How TypeScript runs](./phase-0-how-typescript-runs/README.md) | The type system | 13 | ✅ written |
| [1 · The type vocabulary](./phase-1-type-vocabulary/README.md) | The type system | 17 | ✅ written |
| [2 · Narrowing and control flow analysis](./phase-2-narrowing/README.md) | The type system | 13 | ✅ written |
| [3 · Generics](./phase-3-generics/README.md) | The type system | 14 | ✅ written |
| [4 · Classes, objects and declaration merging](./phase-4-classes-declarations/README.md) | Types at scale | 11 / 14 | 🚧 writing |
| 5 · Type-level programming | Types at scale | — | planned |
| 6 · Modules, declarations and the build | Types at scale | — | planned |
| [7 · TypeScript on the server](./phase-7-server/README.md) | In the stack | 5 / 5 | ✅ written — **cut to its 5 Master rows** |
| ~~8 · TypeScript in React~~ | In the stack | — | ⛔ **dropped 2026-08-15** |
| ~~9 · Types at the boundary~~ | In the stack | — | ⛔ **dropped 2026-08-15** |
| [10 · Strictness and correctness](./phase-10-strictness/README.md) | Rigour and tooling | 2 / 13 | 🚧 writing |
| ~~11 · Migration and legacy~~ | Rigour and tooling | — | ⛔ **dropped 2026-08-15** |
| 12 · Tooling, performance and testing | Rigour and tooling | — | 🎯 **in scope** |

import Progress from '@site/src/components/Progress';

<Progress lang="typescript" />

---

Start → [Phase 0 — How TypeScript runs](./phase-0-how-typescript-runs/README.md)
