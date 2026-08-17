---
title: "Phase 12 — Tooling, performance and testing"
sidebar_label: "Phase 12 · Tooling, performance and testing"
sidebar_position: 12
---

> Verified: 2026-08 against the **`tsconfig` reference** and the **TypeScript
> handbook** on typescriptlang.org, the **release notes**, and the **compiler's own
> option and diagnostic tables** read from disk rather than recalled
> (`sandbox/ts-p0`, the 5.9.3 numbered table; the **7.0.2** native binary for
> cross-checks). Targets **TypeScript 7.0.2** and **Node 24.19.0**.
> **No sandbox, no console blocks** — no timing on these pages is our own, and
> where a figure exists it is quoted from documentation with the source named.

**15 topics — ✅ COMPLETE.** The compiler as part of a build system.

Everything in this phase shows up as *"the editor is slow"* or *"CI takes eleven
minutes"* long before anyone calls it a TypeScript problem. The phase's job is to
make those two complaints diagnosable — and the first topic is the one that decides
whether your pipeline is checking anything at all.

## Topics

| # | Topic | Tier | What it settles |
|---|---|---|---|
| 01 | [Type checking in CI](./01-type-checking-in-ci/README.md) *(5 chunks)* | <span className="db-tier t-master">Master</span> | ✅ `tsc --noEmit` as a required gate — 🔴 a transpiler **cannot** check, because the speed and the blindness are the same design decision; what a green run does **not** claim; the **semantic merge conflict** only a merge queue catches; speed as a **correctness** concern; and why **advisory is the failure mode, not a halfway house** |
| 02 | [What TypeScript 7 changed for tooling](./02-typescript-7-for-tooling/README.md) *(3 chunks)* | <span className="db-tier t-understand">Understand</span> | 🔴 Tools that **run** the compiler are unaffected — the CLI is the stable interface — so the migration is only the tools that **import** it, which is a much shorter list |
| 03 | [Build pipelines](./03-build-pipelines/README.md) *(3 chunks)* | <span className="db-tier t-understand">Understand</span> | 🔴 Four jobs, not one — and **only `tsc` emits `.d.ts`**, so if you publish types the compiler is in your build whatever bundler you chose |
| 04 | [Testing types](./04-testing-types/README.md) *(2 chunks)* | <span className="db-tier t-understand">Understand</span> | 🔴 The runner is `tsc`, so a type test outside the checked program **cannot fail** — and asserting a call is **rejected** is the half nothing else covers |
| 05 | [Typing tests](./05-typing-tests/README.md) *(2 chunks)* | <span className="db-tier t-understand">Understand</span> | 🔴 A mistyped fixture makes a test pass for the **wrong reason** — and `{…} as User` stops matching `User` silently when the type gains a field |
| 06 | [Diagnosing a slow compile](./06-diagnosing-a-slow-compile/README.md) *(2 chunks)* | <span className="db-tier t-understand">Understand</span> | 🔴 Read the **phase split** first — *too many files* and *types too complex* present identically and have opposite fixes |
| 07 | [Editor performance](./07-editor-performance.md) | <span className="db-tier t-understand">Understand</span> | 🔴 A cost the build pays **once** the editor pays **per keystroke**, and the program stays resident for days — plus the second program nobody counts: **in-editor type-aware lint** |
| 08 | [`skipLibCheck` as a performance lever](./08-skiplibcheck-as-a-performance-lever.md) | <span className="db-tier t-understand">Understand</span> | 🔴 The skip predicate read from source — gated on **nothing but `isDeclarationFile`**, so it includes **your own** declarations — and the saving scales with your **dependencies**, not your code |
| 09 | [Caching TypeScript in CI and Docker](./09-caching-in-ci-and-docker.md) | <span className="db-tier t-understand">Understand</span> | 🔴 **The cache needs to be recent, not current** — a `.tsbuildinfo` is a starting point the compiler validates, which is what makes a fallback key safe |
| 10 | [Monorepo orchestration](./10-monorepo-orchestration.md) | <span className="db-tier t-know">Know</span> | 🔴 **Two graphs describe the same structure** — references and tasks — and nothing keeps them in sync; plus the stale-green bug: *"run after"* is not *"invalidate when"* |
| 11 | [Declaration emit](./11-declaration-emit.md) | <span className="db-tier t-know">Know</span> | 🔴 The 4xxx range exists **only in the emit path**, so a green `--noEmit` gate and a failing declaration build are not a contradiction — and for a library **the declaration build IS the gate** |
| 12 | [Validating published types](./12-validating-published-types.md) | <span className="db-tier t-know">Know</span> | 🔴 **What breaks consumers is resolution, not types** — so no amount of type checking surfaces it, and the cheapest check is to **pack and install into an empty project** |
| 13 | [Measuring type coverage](./13-measuring-type-coverage.md) | <span className="db-tier t-know">Know</span> | 🔴 **An `as` produces a covered expression**, so a coverage target set alone pays people to make the codebase worse in a way the metric cannot see |
| 14 | [AST tooling after TS 7](./14-ast-tooling-after-ts7.md) | <span className="db-tier t-when">When Needed</span> | 🔴 The surface was **re-shaped, not re-exported**, so a port is a rewrite — and the question to ask first is **whether the tool needs to exist** |
| 15 | [Contributing to DefinitelyTyped](./15-contributing-to-definitelytyped.md) | <span className="db-tier t-when">When Needed</span> | 🔴 **Two upstreams, and they are not the same** — plus: an `any` you leave in a contributed `.d.ts` becomes **inherited `any`** in every consumer's program |

## Phase gate

Move on when you can explain **why a green `vite build` proves nothing about your
types**, and point at the exact step in your pipeline where the check actually runs.

## 🔴 What this phase deliberately does not repeat

Three phases already own material this one is built on. **Link, do not restate:**

| Already argued | Where |
|---|---|
| checking vs transpiling — one file versus the whole program, and `isolatedModules` | [Phase 0 · 10](../phase-0-how-typescript-runs/10-checking-vs-transpiling.md) |
| the four ways the editor and the build **disagree** | [Phase 0 · 09](../phase-0-how-typescript-runs/09-language-server-vs-build.md) |
| TypeScript 7's native compiler, its speed and the moved API | [Phase 0 · 07](../phase-0-how-typescript-runs/07-typescript-7-native-compiler.md) |
| **the CI cost of type-aware linting** — the two-type-checks arithmetic, why changed-files filtering does not help, and *flags before rules* | [Phase 10 · 11 · chunk 10](../phase-10-strictness/11-typescript-eslint/10-adoption-and-ci-cost.md) |
| `skipLibCheck`'s **correctness** trade, and that it is **not** a suppression mechanism | [Phase 7 · 01 · chunk 03](../phase-7-server/01-tsconfig-for-a-node-service/03-target-lib-and-types.md) · [Phase 10 · 08 · chunk 03](../phase-10-strictness/08-suppression-directives/03-the-suppression-tiers.md) |
| the type-checking performance **limits**, read from the checker | [Phase 5 · 09](../phase-5-type-level/09-type-level-performance/README.md) |

---

← [Phase 10 · Strictness and correctness](../phase-10-strictness/README.md) · Start → [01 · Type checking in CI](./01-type-checking-in-ci/README.md)
