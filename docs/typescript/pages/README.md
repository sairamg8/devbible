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

:::info 🔒 Active work — TypeScript is split FOUR ways: A · B · C · D

🔴 **Re-split 2026-08-17.** Up to four sessions write TypeScript in parallel on
`main`. **No lane creates or edits a file outside its own scope**, and a session
started with just a letter — *"typescript c"* — reads its row below and begins.

| Lane | Scope — the only directories it may touch | Left | Claimed by |
|---|---|---|---|
| **A · type-level** | `phase-5-type-level/` topics **08–16** | 3 | session `65de22b3`, 2026-08-17 |
| **B · strictness + tooling** | `phase-10-strictness/` **and** `phase-12-tooling/` | 13 | session `c01e37bb`, 2026-08-17 (took over from `ede9cd9f`) |
| **C · the module system** | `phase-6-modules-build/` topics **01–06** | ✅ **0 — DONE 6/6** | session `f4392a13`, 2026-08-17 (took over from `5ff47a9c`) |
| **D · declarations & the build** | `phase-6-modules-build/` topics **07–16** | ✅ **0 — DONE 10/10** | session `e28ddf99`, 2026-08-17 (took over from `8dcc0095`) |

🔴 **Re-split four ways on 2026-08-17.** Phase 6 was the imbalance, not the lanes: weighted
by tier it projected to ~10,350 lines — 43% of all remaining TypeScript — in one unclaimed
part, because its three Master rows sit at the front. Cutting after topic 06 gives ~5,100 /
~5,250 and falls on a real boundary: **C is the module system and how the compiler sees
files; D is declarations, packaging and the build.**

⚠️ **C and D share one phase directory — devbible's only intra-phase split.** Whoever
arrives first scaffolds `phase-6-modules-build/README.md` with the **full 16-row table**;
after that each lane edits **only its own rows** (C 01–06, D 07–16) and re-reads the file
immediately before every edit. They also share that phase's row in `src/data/progress.js`.

⚠️ **Two of the four remaining directories do not exist yet** —
`phase-6-modules-build/` (C + D) and `phase-12-tooling/` (B). **31 of the 44
remaining topics live in them.** A phase directory takes **no `_category_.json`**:
phases 0–5 use README frontmatter plus autogeneration, and only a *chunk*
directory inside a topic gets one.

Other technologies still belong to other live sessions. Shared files — this
README's phase rows, `docs/README.md`, and `src/data/progress.js` (anchor every
edit on the row's **slug**, never on a number) — are edited a row at a time,
re-read immediately before writing. **Never `git add -A`.** Where a page needs a
topic that is not written yet, write it as bold plain text with
*(not written yet)* rather than a link.

🔴 **The cursor for all four lanes: `devbible/progress_typescript_split_4way.md`.** History: `devbible/project_typescript_split_parts_ab.md` (the original A/B) and `devbible/project_typescript_split_part_c.md` (superseded — it gave C the whole of phase 6).

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
| [4 · Classes, objects and declaration merging](./phase-4-classes-declarations/README.md) | Types at scale | 14 / 14 | ✅ written |
| [5 · Type-level programming](./phase-5-type-level/README.md) | Types at scale | 13 / 16 | 🚧 writing |
| [6 · Modules, declarations and the build](./phase-6-modules-build/README.md) | Types at scale | 16 / 16 | ✅ written |
| [7 · TypeScript on the server](./phase-7-server/README.md) | In the stack | 5 / 5 | ✅ written — **cut to its 5 Master rows** |
| ~~8 · TypeScript in React~~ | In the stack | — | ⛔ **dropped 2026-08-15** |
| ~~9 · Types at the boundary~~ | In the stack | — | ⛔ **dropped 2026-08-15** |
| [10 · Strictness and correctness](./phase-10-strictness/README.md) | Rigour and tooling | 13 / 13 | ✅ written |
| ~~11 · Migration and legacy~~ | Rigour and tooling | — | ⛔ **dropped 2026-08-15** |
| [12 · Tooling, performance and testing](./phase-12-tooling/README.md) | Rigour and tooling | 2 / 15 | 🚧 writing |

import Progress from '@site/src/components/Progress';

<Progress lang="typescript" />

---

Start → [Phase 0 — How TypeScript runs](./phase-0-how-typescript-runs/README.md)
