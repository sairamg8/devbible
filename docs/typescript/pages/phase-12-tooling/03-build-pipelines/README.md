---
title: "Build pipelines"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the **`tsconfig` reference**, the **esbuild**, **swc**,
> **Rollup** and **Vite** documentation for what each states it does, and the
> **TypeScript 5.9.3 diagnostic table read from disk** (`sandbox/ts-p0`).
> ⚠️ **No timing figure on these pages is ours. No console block.**

:::info 🚧 This topic is mid-write — 1 chunk
Chunk **01 is written**. References to the rest are deliberately **plain text
rather than links** so the build stays green. Resume point:
`devbible/progress_typescript_part_b.md` in the memory store.
:::

The syllabus row asks *"who checks and who only strips, and where declaration emit
fits."* [Topic 01](../01-type-checking-in-ci/README.md) already settled **why** a
transpiler cannot check. This topic is the practical map that follows from it:

> 🔴 **"Building TypeScript" is four jobs — check, transform, bundle, emit
> declarations — and every tool does a different subset.** Most tooling arguments
> dissolve the moment they are named, because the tools are not competing for the
> same job.
>
> 🔴 **And one column has a single entry: only `tsc` emits `.d.ts`.** So if you
> publish types, the compiler is in your build whatever bundler you chose.

## The chunks

| # | Chunk | What it settles |
|---|---|---|
| 01 | [Four jobs, not one](./01-four-jobs-not-one.md) | The job-by-tool matrix; 🔴 why **declaration emit cannot be fast** (it needs inferred return types, so it needs the checker); and what `TS5069` and `TS6304` tell you — including that **composite projects and declaration emit are one feature, not two settings** |
| 02 | **The two pipeline shapes** *(not written yet)* | The app shape and the library shape, and where the check goes in each |
| 03 | **Making two tools agree** *(not written yet)* | One config or two, source maps across the seam, and the settings that must match |

## Phase gate

You are done when you can say, for your own build, **which tool does each of the
four jobs** — and can name the one that would stop your package shipping types if
you removed it.

## Where this connects

- **← [Phase 0 · 10 · Checking vs transpiling](../../phase-0-how-typescript-runs/10-checking-vs-transpiling.md)**
  — the mechanism: one file versus the whole program, and `isolatedModules`.
- **← [01 · Type checking in CI](../01-type-checking-in-ci/README.md)** — ⚠️ **owns
  the argument that a transpiler cannot replace the check.** This topic assumes it.
- **→ 08 · `skipLibCheck` as a performance lever** *(not written yet)* and
  **→ 09 · Caching TypeScript in CI and Docker** *(not written yet)*.
- **→ Phase 6 · 11 · Publishing a typed package** — what actually ships and how
  consumers resolve it. **This topic stops at the build; that one takes it from
  there.**
- **→ Phase 6 · 15 · `isolatedDeclarations`** — the flag that exists to make
  declaration emit cheap, by removing the inference this topic explains.

---

← [Phase 12 index](../README.md) · Start → [01 · Four jobs, not one](./01-four-jobs-not-one.md)
