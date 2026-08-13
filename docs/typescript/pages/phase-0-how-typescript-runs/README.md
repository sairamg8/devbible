---
title: "Phase 0 — How TypeScript runs"
sidebar_label: "Phase 0 · How TypeScript runs"
sidebar_position: 0
---

> Verified: 2026-08 on **TypeScript 7.0.2** and **Node 24.19.0** (Active LTS),
> with **5.9.3** installed alongside for comparison. Every console block in this
> phase was produced by a script in `sandbox/ts-p0/`.

**13 pages.** Before any syntax: what the tool is, what it leaves behind, and
which of the three programs that accept your `.ts` file actually reads the types.

The erasure page is the one everything else hangs off. Once "types are deleted
and never checked at runtime" is properly internalised, `enum`'s bad reputation,
`erasableSyntaxOnly`, the need for runtime validation, and why a green bundler
proves nothing all stop being separate facts.

| # | Page | Tier | What it settles |
|---|---|---|---|
| 01 | [Checker, not a runtime](./01-static-checker-not-runtime.md) | <span className="db-tier t-master">Master</span> | Node prints `HEAVY` for a `number`; `tsc` emits broken JS and exits 2 |
| 02 | [Erasure](./02-erasure.md) | <span className="db-tier t-master">Master</span> | 15 lines in, 7 out — and the four constructs that emit code instead |
| 03 | [The three ways to run it](./03-three-ways-to-run.md) | <span className="db-tier t-master">Master</span> | `tsc`, transpilers, Node directly — only one checks |
| 04 | [Strip-only and `erasableSyntaxOnly`](./04-strip-only-and-erasable-syntax.md) | <span className="db-tier t-master">Master</span> | `ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX` moved to `TS1294` at check time |
| 05 | [`strict`](./05-strict.md) | <span className="db-tier t-master">Master</span> | Seven flags — and **it now defaults to `true`** |
| 06 | [tsconfig.json anatomy](./06-tsconfig-anatomy.md) | <span className="db-tier t-understand">Understand</span> | Which files, what rules, and what `"types": []` is really for |
| 07 | [TypeScript 7](./07-typescript-7-native-compiler.md) | <span className="db-tier t-understand">Understand</span> | Native compiler, 3× measured, and the API that moved to `unstable/` |
| 08 | [Where types come from](./08-where-types-come-from.md) | <span className="db-tier t-understand">Understand</span> | `TS7016`, and why a declaration is a promise rather than a check |
| 09 | [Editor vs build](./09-language-server-vs-build.md) | <span className="db-tier t-understand">Understand</span> | Same file, two compilers: four errors and none |
| 10 | [Checking vs transpiling](./10-checking-vs-transpiling.md) | <span className="db-tier t-understand">Understand</span> | One file at a time vs the whole program — and `isolatedModules` |
| 11 | [Project layout](./11-project-layout.md) | <span className="db-tier t-understand">Understand</span> | Why `rootDir` is set explicitly, and why `dist` is excluded |
| 12 | [Release cadence](./12-release-cadence.md) | <span className="db-tier t-know">Know</span> | Why a minor breaks builds, and the 5 → 6 → 7 path |
| 13 | [Playground and `@ts-check`](./13-playground-and-ts-check.md) | <span className="db-tier t-know">Know</span> | Type-checking JavaScript with no build step at all |

## What the measurements changed

Four things on these pages contradict what is commonly written, and each came
from a script rather than from memory:

1. **`strict` defaults to `true` in TypeScript 7.** The first version of
   `ex4-strict.sh` used "no flag" as its loose baseline and got identical output
   on both sides — because there was no difference. `esModuleInterop` and
   `moduleResolution` changed defaults too.
2. **The TypeScript 7 speed-up measured 3×, not 10×.** The first benchmark
   reported 10× because 5.9.3 was also loading ambient `@types` from an ancestor
   directory — and moving the fixture to `/tmp` did not fix it, because that
   resolution follows the **cwd**. The script now asserts both sides report zero
   diagnostics before either timing is believed.
3. **The compiler API moved rather than disappearing.** `require('typescript')`
   exports two keys, but `typescript/unstable/sync` and
   `typescript/unstable/ast` (409 exports) are live.
4. **`tsc` emits broken JavaScript by default and exits 2.** `--noEmitOnError`
   and `--noEmit` both exit 1. A build script that ignores the exit code ships
   output the compiler already rejected.

## Phase gate

Move on when you can answer, for any project you are handed:

- Which program runs the code, and which one checks it — naming the command.
- What happens to an `enum` on each of those paths.
- Whether `strict` is on, and how you verified it rather than assumed it.

## Where this connects

- **→ Phase 1 (The type vocabulary)** — the checker's rules only start mattering
  once you know what it is and is not doing.
- **→ Phase 6 (Modules and build)** — `module`, `moduleResolution` and `paths`
  are named here and explained properly there.
- **→ Phase 9 (Types at the boundary)** — erasure is the reason runtime
  validation exists at all.
- **→ [Node · TypeScript without a build step](/docs/nodejs/pages/phase-1-modules/typescript-natively)**
  — the runtime mechanics of type stripping, the `node_modules` exclusion and the
  import-specifier rule belong to Node; this phase covers the checking side.

## Sandbox

`sandbox/ts-p0/` — `ex1-erasure.sh` … `ex9-node-runs-ts.sh`, each self-contained.
`npm install` there, then run any script directly. Both compilers are installed:
`node_modules/typescript` is 7.0.2 and `node_modules/typescript5` is 5.9.3
(invoke them by path — the alias package's `bin` wins in `.bin/`).

---

Next → [01 · Checker, not a runtime](./01-static-checker-not-runtime.md)
