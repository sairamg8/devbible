---
title: "Part 4 — Rigour and tooling"
sidebar_label: "4 · Rigour and tooling"
sidebar_position: 4
---

> **Phases 10–12 · 40 topics · 5 Master**
> Turning the strictness up, inheriting a JavaScript codebase, and keeping the
> compiler out of your way.

Parts 1–3 teach what the type system can express. This part is about making it
hold in a codebase with history, other people, and a CI budget — the flags
beyond `strict`, the honest list of what TypeScript cannot promise, and the
tooling that decides whether any of it is actually checked.

---

## Phase 10 — Strictness and correctness

*13 topics.* `strict: true` is the start, not the finish. This phase is the flags
beyond it, and the honest inventory of where TypeScript is **unsound on purpose**
— because trusting a guarantee you do not have is worse than having no guarantee.

| Topic | Tier |
|---|---|
| **`strict` flag by flag** — `strictNullChecks`, `noImplicitAny`, `strictFunctionTypes`, `strictBindCallApply`, `strictPropertyInitialization`, `useUnknownInCatchVariables`, `alwaysStrict`; what each rejects | <span className="db-tier t-master">Master</span> |
| **`noUncheckedIndexedAccess`** — `arr[0]` and `record[key]` become `T \| undefined`; the flag that finds the most real bugs and annoys people the most | <span className="db-tier t-master">Master</span> |
| **Containing `any`** — the four doors it enters through (untyped deps, `as`, `JSON.parse`, implicit returns) and how it spreads silently once inside | <span className="db-tier t-master">Master</span> |
| **Reading a TypeScript error** — start at the innermost "Type X is not assignable to type Y", read the trailing property path first, and ignore the outer noise | <span className="db-tier t-master">Master</span> |
| **`exactOptionalPropertyTypes`** — the difference between "absent" and "present and `undefined`", and the API bugs that difference causes | <span className="db-tier t-understand">Understand</span> |
| **The other correctness flags** (grouped) — `noImplicitOverride`, `noPropertyAccessFromIndexSignature`, `noFallthroughCasesInSwitch`, `noImplicitReturns`, `noUnusedLocals`/`noUnusedParameters` | <span className="db-tier t-understand">Understand</span> |
| **Where TypeScript is unsound by design** — assertions, `any`, index access, method bivariance, mutation through an alias, and `Object.keys` returning `string[]` | <span className="db-tier t-understand">Understand</span> |
| **`@ts-expect-error` vs `@ts-ignore` vs `@ts-nocheck`** — why the first is the only acceptable one (it fails when the error goes away) | <span className="db-tier t-understand">Understand</span> |
| **Excess property checks vs assignability** — why an object literal errors where an identically-shaped variable does not | <span className="db-tier t-understand">Understand</span> |
| **The error codes you will actually meet** — 2322, 2345, 2339, 2367, 2551, 7053, 18046, 18048, 2589 — and what each one really means | <span className="db-tier t-understand">Understand</span> |
| **typescript-eslint type-aware rules** — `no-floating-promises`, `no-misused-promises`, `no-unnecessary-condition`, `strict-boolean-expressions`; the checks the compiler will not do, and their CI cost | <span className="db-tier t-understand">Understand</span> |
| **Assertion discipline** — treating every `as` as a review comment, banning `as any`, and the guard that should have been written instead | <span className="db-tier t-understand">Understand</span> |
| Designing APIs `unknown`-first — making the caller prove the shape, rather than trusting a parameter type | <span className="db-tier t-know">Know</span> |

**Gate — move on when:** you can turn `noUncheckedIndexedAccess` on in a real
codebase and fix the first twenty errors without a single `!` or `as`.

---

## Phase 11 — Migration and legacy

*12 topics.* Almost nobody starts clean. This phase is inheriting JavaScript,
inheriting bad TypeScript, and moving both forward without a six-month rewrite
nobody approved.

| Topic | Tier |
|---|---|
| **A migration strategy that ships** — `allowJs` first, file-by-file conversion, leaf modules before shared ones, and never converting and refactoring in the same commit | <span className="db-tier t-understand">Understand</span> |
| **`checkJs` and JSDoc types** — type-checking JavaScript without renaming a single file; `@param`, `@type`, `@typedef`, `@satisfies`, and what JSDoc cannot express | <span className="db-tier t-understand">Understand</span> |
| **Adopting `strict` incrementally** — per-directory configs, a stricter config for new code, and ratcheting rather than a big-bang flip | <span className="db-tier t-understand">Understand</span> |
| **Taming an untyped dependency** — a local `.d.ts` shim, `@types/*` if it exists, and upstreaming the fix so the shim can be deleted | <span className="db-tier t-understand">Understand</span> |
| **CommonJS legacy** — `esModuleInterop`, `import x = require()`, `export =`, and mixed-module codebases | <span className="db-tier t-understand">Understand</span> |
| **Migrating `enum` to `const` objects** — an `as const` map plus a derived union, keeping the call sites and dropping the emitted code (and unblocking Node's strip-only mode) | <span className="db-tier t-understand">Understand</span> |
| **Deprecations across 5.x → 6.0 → 7.0** — the flags and behaviours that were removed, and how to plan a compiler upgrade for a large repo | <span className="db-tier t-understand">Understand</span> |
| **An `any` budget** — measuring it (`type-coverage`), ratcheting it in CI, and why a hard ban on day one just produces creative `as` casts | <span className="db-tier t-know">Know</span> |
| **`allowJs` and `outDir` interplay** — the emit surprises when JS and TS live in one tree | <span className="db-tier t-know">Know</span> |
| **Legacy React types** — `React.FC`, `PropTypes`, class components, and `defaultProps` in a modern codebase | <span className="db-tier t-know">Know</span> |
| Namespaces and `/// <reference>` — the pre-module world, still alive in `.d.ts` files and old libraries | <span className="db-tier t-when">When Needed</span> |
| Codemods at scale — automated conversion and the review discipline it needs | <span className="db-tier t-when">When Needed</span> |

**Gate — move on when:** you can put a legacy JavaScript file under `checkJs`,
fix what it reports without converting it, and explain what conversion would
buy on top.

---

## Phase 12 — Tooling, performance and testing

*15 topics.* The compiler as part of a build system. Everything here shows up as
"the editor is slow" or "CI takes eleven minutes" long before anyone calls it a
TypeScript problem.

| Topic | Tier |
|---|---|
| **Type checking in CI** — `tsc --noEmit` as a required gate, and why a transpile-only build **cannot** replace it | <span className="db-tier t-master">Master</span> |
| **What TypeScript 7 changed for tooling** — the native compiler's speed, and the classic root `ts.*` API moving to an explicitly `unstable/` surface that AST tools must be ported to; auditing your toolchain before upgrading | <span className="db-tier t-understand">Understand</span> |
| **Build pipelines** — `tsc` vs esbuild/swc/Rollup/Vite, who checks and who only strips, and where declaration emit fits | <span className="db-tier t-understand">Understand</span> |
| **Testing types** — `expectTypeOf`/`assertType` in Vitest, `tsd`, and `@ts-expect-error` as an assertion that a wrong call is rejected | <span className="db-tier t-understand">Understand</span> |
| **Typing tests** — typed fixtures, `satisfies` on test data, typing mocks and spies, and keeping test types honest instead of `as any` | <span className="db-tier t-understand">Understand</span> |
| **Diagnosing a slow compile** — `--extendedDiagnostics`, `--generateTrace`, and the usual culprits (deep conditionals, huge unions, `DeepPartial`, giant barrel files) | <span className="db-tier t-understand">Understand</span> |
| **Editor performance** — why the language server lags, project size, barrel imports, and `includes` that pull in the world | <span className="db-tier t-understand">Understand</span> |
| **`skipLibCheck` as a performance lever** — what it saves and what it hides | <span className="db-tier t-understand">Understand</span> |
| **Caching TypeScript in CI and Docker** — `.tsbuildinfo`, layer caching, and the multi-stage build that does not reinstall the world | <span className="db-tier t-understand">Understand</span> |
| **Monorepo orchestration** — Turborepo/Nx task graphs, typecheck as a cached task, and build order | <span className="db-tier t-know">Know</span> |
| **Declaration emit** — `.d.ts` generation cost, `isolatedDeclarations`, and bundling declarations for a published package | <span className="db-tier t-know">Know</span> |
| **Validating published types** — `arethetypeswrong`, `publint`, and testing the package as a consumer sees it | <span className="db-tier t-know">Know</span> |
| **Measuring type coverage** — what the number means and what it does not | <span className="db-tier t-know">Know</span> |
| AST tooling after TS 7 — `ts-morph` and custom transformers, and what still works | <span className="db-tier t-when">When Needed</span> |
| Contributing to DefinitelyTyped — the process, and when writing types beats waiting | <span className="db-tier t-when">When Needed</span> |

**Gate — move on when:** you can explain why a green `vite build` proves nothing
about your types, and show where the check actually runs in your pipeline.

---

## Where this connects

- **Phase 10 → every earlier phase** — the strict flags are what make narrowing,
  generics and boundary parsing actually mean something.
- **Phase 11 → Phase 1** — migrating `enum` to a `const` object is the Phase 1
  row applied to a codebase that already shipped one.
- **Phase 12 → Node Phase 9** — the test runner and the CI shape are Node's;
  what is being checked is here.
- **Deliberately not here:** domain and architecture decisions — service
  boundaries, caching strategy, queue topology, how to model *your* orders and
  carts. The brief keeps application layering project-based, learned against a
  real build rather than from a topic list. This syllabus gives you the type
  system to express those decisions; choosing them is the build's job.

---

← [Part 3 — TypeScript in the stack](./03-in-the-stack.md) · [Overview](../README.md)
