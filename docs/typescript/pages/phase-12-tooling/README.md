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

**15 topics.** The compiler as part of a build system.

Everything in this phase shows up as *"the editor is slow"* or *"CI takes eleven
minutes"* long before anyone calls it a TypeScript problem. The phase's job is to
make those two complaints diagnosable — and the first topic is the one that decides
whether your pipeline is checking anything at all.

:::info 🚧 This phase is being written
Topics are linked from the table below as they land. Resume point:
`devbible/progress_typescript_part_b.md` in the memory store.
:::

## Topics

| # | Topic | Tier | What it settles |
|---|---|---|---|
| 01 | [Type checking in CI](./01-type-checking-in-ci/README.md) | <span className="db-tier t-master">Master</span> | `tsc --noEmit` as a required gate, and why a transpile-only build **cannot** replace it |
| 02 | What TypeScript 7 changed for tooling | <span className="db-tier t-understand">Understand</span> | The native compiler's speed, the classic root `ts.*` API moving to an explicitly `unstable/` surface, and auditing your toolchain before upgrading |
| 03 | Build pipelines | <span className="db-tier t-understand">Understand</span> | `tsc` vs esbuild/swc/Rollup/Vite — who checks, who only strips, and where declaration emit fits |
| 04 | Testing types | <span className="db-tier t-understand">Understand</span> | `expectTypeOf`/`assertType`, `tsd`, and `@ts-expect-error` as an assertion that a wrong call is rejected |
| 05 | Typing tests | <span className="db-tier t-understand">Understand</span> | Typed fixtures, `satisfies` on test data, typing mocks and spies |
| 06 | Diagnosing a slow compile | <span className="db-tier t-understand">Understand</span> | `--extendedDiagnostics`, `--generateTrace`, and the usual culprits |
| 07 | Editor performance | <span className="db-tier t-understand">Understand</span> | Why the language server lags — project size, barrel imports, `include` globs |
| 08 | `skipLibCheck` as a performance lever | <span className="db-tier t-understand">Understand</span> | What it saves and what it hides |
| 09 | Caching TypeScript in CI and Docker | <span className="db-tier t-understand">Understand</span> | `.tsbuildinfo`, layer caching, and the multi-stage build that does not reinstall the world |
| 10 | Monorepo orchestration | <span className="db-tier t-know">Know</span> | Task graphs, typecheck as a cached task, build order |
| 11 | Declaration emit | <span className="db-tier t-know">Know</span> | `.d.ts` generation cost, `isolatedDeclarations`, bundling declarations |
| 12 | Validating published types | <span className="db-tier t-know">Know</span> | `arethetypeswrong`, `publint`, testing the package as a consumer sees it |
| 13 | Measuring type coverage | <span className="db-tier t-know">Know</span> | What the number means and what it does not |
| 14 | AST tooling after TS 7 | <span className="db-tier t-when">When Needed</span> | `ts-morph`, custom transformers, and what still works |
| 15 | Contributing to DefinitelyTyped | <span className="db-tier t-when">When Needed</span> | The process, and when writing types beats waiting |

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
