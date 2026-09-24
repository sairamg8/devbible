---
name: devbible-typescript-split-part-c
description: The 2026-08-17 split of TypeScript Part A into two — Part A keeps phase 5's tail, the new Part C owns phase 6 (Modules, declarations and the build) in full — with a paste-ready bootstrap prompt and the shared-file rules
metadata:
  type: project
---

# TypeScript — Part A split in two · **Part C** created 2026-08-17

:::danger ⛔ SUPERSEDED THE SAME DAY — read [[devbible-typescript-split-4way]] instead
🔴 **2026-08-17, later:** phase 6 was **split again, between C and D**, because weighting
the remaining topics by tier showed it projecting to **~10,350 lines — 43% of everything
left in TypeScript — in one unclaimed lane** (its three Master rows sit at the front).
**"Part C = the whole of phase 6" is DEAD.** C now owns topics **01–06**; a new **Part D**
owns **07–16**. The cut after topic 06 gives ~5,100 / ~5,250, a delta of 150.

**This file is kept for the reasoning behind the original A→C split and for the inherited
material in the two sections below, which still applies.** The worklist table further down
is still correct as a *phase* worklist — but the lane column is now in the 4-way file.
:::

🔴 **Set on the user's instruction**, given mid-session while `bbd2d39d` held
Part A:

> *"Can you split your work into half ? create typescript phase c ?"* ·
> *"and save the progress to memnory i will ask another session to work it out"*

## The split

**25 topics remained in Part A. They are split at the phase boundary**, because
that is the only line that gives two sessions no shared file at all — the same
rule the JavaScript and Docker four-way splits follow.

| Part | Scope | Topics left | Start at | Held by |
|---|---|---|---|---|
| **A** | **phase 5 · Type-level programming**, topics 08–16 | **9** | **08 · Knowing when to stop** | session `bbd2d39d` (2026-08-17) |
| ~~**C**~~ | ~~phase 6, all of it~~ — ⛔ **superseded: now C = topics 01–06, D = 07–16** | ~~16~~ | see [[devbible-typescript-split-4way]] | — |

⚠️ **It was 9 versus 16, not 12 and 13** — and that imbalance is exactly what the later
four-way split fixed. The reasoning below is why the *first* cut was made at a phase
boundary; the second cut deliberately broke that rule, once, because phase 6 was too heavy
for one lane. Original note follows.

⚠️ **It is 9 versus 16, not 12 and 13.** Only two phases remain, so an even split
would mean two sessions writing in one phase directory and one phase `README.md`.
That collision has cost this repo real time before; the phase boundary is worth
the imbalance. Phase 5's nine are also the heavier nine — three of them
(recursion, `DeepPartial`, tuples) will chunk.

⛔ **Part C never touches `docs/typescript/pages/phase-5-type-level/`, and Part A
never creates `phase-6-modules-build/`.** Part B (phases 10 and 12) is a third
live session; nobody touches phase 7.

## 📋 Paste-ready prompt for the Part C session

> Pick up **devbible TypeScript Part C**. Work on `main` in
> `/mnt/Storage/Backup/Knowledge/devbible`.
>
> **Scope: `docs/typescript/pages/phase-6-modules-build/` only — 16 topics, the
> whole phase.** The directory does not exist yet; scaffold it with a `README.md`
> carrying the full 16-topic table (a *phase* directory gets no
> `_category_.json` — phases 0–5 use README frontmatter plus autogeneration).
> Start at **topic 01 · `module` and `moduleResolution`**. The worklist is the
> phase-6 table in `docs/typescript/syllabus/02-types-at-scale.md`, in row order.
>
> Read `devbible/progress_typescript_build.md` in the memory store first — it has
> the conventions, the traps and the per-file cadence. Do not touch phase 5
> (Part A, session `bbd2d39d`) or phases 10 and 12 (Part B).
>
> **The rule that matters most: 300 lines is a FILE-SIZE cap and never a content
> budget.** Write everything the topic has — every gotcha, every worked example,
> every interview question — without looking at the line count, then split on
> concept boundaries into `NN-topic/` chunks so no file passes 300, and index the
> chunks from the topic `README.md`. A topic may run 1,000+ lines. Never trim,
> reword or drop a section to fit.
>
> No sandbox and no console blocks: validate against the TypeScript handbook and
> the release notes, name the sources in each page's `> Verified:` line, and read
> diagnostics out of the compiler's own message table rather than recalling them.
> Update the four boards after every topic and commit the memory every 2–3 files.
> Run to completion; do not stop to ask between topics.

## Part C's worklist — phase 6, with tiers

Three Master topics up front, which means chunk directories; the rest are mostly
single files of 200–290.

| # | Topic | Tier |
|---|---|---|
| 01 | `module` and `moduleResolution` | **Master** |
| 02 | `import type` / `export type` and `verbatimModuleSyntax` | **Master** |
| 03 | Path aliases — `paths` | **Master** |
| 04 | `lib`, `target` and the ambient environment | Understand |
| 05 | `isolatedModules` | Understand |
| 06 | File extensions — `.ts`/`.mts`/`.cts`/`.d.ts` | Understand |
| 07 | Authoring `.d.ts` files | Understand |
| 08 | Typing an untyped dependency | Understand |
| 09 | `esModuleInterop` and default imports | Understand |
| 10 | `skipLibCheck` | Understand |
| 11 | Publishing a typed package | Understand |
| 12 | Sharing types across a monorepo | Understand |
| 13 | Project references and `tsc -b` | Know |
| 14 | Incremental builds | Know |
| 15 | `isolatedDeclarations` | Understand |
| 16 | Typing non-code imports | Know |

### 🔴 Two things Part C inherits from work already written

**1. `isolatedDeclarations` (topic 15) already has its best material written
elsewhere.** [[devbible-typescript-build-progress]] records it: the mixin factory
pattern is **unbuildable** under the flag, and there are two diagnostics aimed at
it —

> `TS9021`: Extends clause can't contain an expression with `--isolatedDeclarations`.
> `TS9022`: Inference from class expressions is not supported with `--isolatedDeclarations`.

Both are quoted in
`docs/typescript/pages/phase-4-classes-declarations/14-mixins/05-the-cost-in-the-build.md`,
which **forward-links to phase 6 as bold plain text with *(not written yet)***.
🔴 **Repoint that link when topic 15 lands.**

**2. Sweep the forward references.** Phase 5's pages link forward to phase 6 the
same way. At each topic close:

```bash
grep -rn "not written yet" docs/typescript/pages/ | grep -i "phase 6\|module\|isolatedDeclarations"
```

## Shared files — the collision rules

| File | Rule |
|---|---|
| `src/data/progress.js` | Edit **only** the `phase-6-modules-build` row, anchored on its `slug:`. Assert the match count is 1 before writing — a numeric pattern has matched two languages' rows before |
| `docs/typescript/pages/README.md` | Your phase's row only. Re-read immediately before editing |
| `docs/README.md` | ⚠️ **One shared TypeScript row that three sessions increment.** Re-read it every single time; take the higher number if it moved |
| The claim notice in `pages/README.md` | Add a Part C row; do not edit A's or B's |

**Never `git add -A`.** Stage explicit paths. Expect other sessions' edits in your
`git status` and leave them.

## Verification, without a build

Rule 12 (the dev-server/build registry) still applies — do not run `yarn build`
without claiming the registry. These three need no claim and are what Part A has
been using:

```bash
# 1 · every link resolves against the filesystem
# 2 · MDX compiles (await it, strip frontmatter)
# 3 · the render-bomb AST walk for bare {identifier} expressions
```

The exact scripts are in [[devbible-realworld-split-3way]] and in Part A's commits
from 2026-08-17.

Related: [[devbible-typescript-split-parts-ab]] (the original A/B split) ·
[[devbible-typescript-build-progress]] (Part A's live cursor and traps) ·
[[devbible-typescript-part-b]] (phases 10 and 12) ·
[[devbible-typescript-syllabus]]
