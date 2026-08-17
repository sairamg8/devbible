---
title: "What TypeScript 7 changed for tooling"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the **TypeScript 7 release notes** and the published
> package's `exports` map. ⚠️ **The package internals, the measured speed and the
> shape of the new surface are [phase 0 · 07](../../phase-0-how-typescript-runs/07-typescript-7-native-compiler.md)'s**
> — that page is sandbox-proven with real console output, and none of it is repeated
> here. Tool-side claims are attributed to each tool's documentation.
> **No sandbox run of our own, no console block.**

:::info 🚧 This topic is mid-write — 1 chunk
Chunk **01 is written**. References to the rest are deliberately **plain text
rather than links** so the build stays green. Resume point:
`devbible/progress_typescript_part_b.md` in the memory store.
:::

Phase 0 established what TypeScript 7 *is*: **the language did not change, the tool
did**, and the root `ts.*` export was replaced by an explicitly `unstable/` surface.
This topic is the operational follow-up — **auditing your toolchain before you
upgrade, rather than discovering it during.**

> 🔴 **The distinction that sorts everything: tools that *run* the compiler are
> unaffected, because the CLI is the stable interface. Only tools that *import* it
> are exposed** — and that is a much shorter list than "everything that uses
> TypeScript".

## The chunks

| # | Chunk | What it settles |
|---|---|---|
| 01 | [Which of your tools actually reach in](./01-which-tools-actually-reach-in.md) | The two columns, the tools that import the API grouped by *why*, the ten-minute audit — and 🔴 that a **type-aware linter is a compiler-API consumer**, which is the entry people miss |
| 02 | **What `unstable/` actually promises** *(not written yet)* | The name is a contract rather than a warning label, and what it means for pinning |
| 03 | **Upgrading in stages** *(not written yet)* | Moving the gate before the tools, the editor's own compiler version, and the rollback |

## Phase gate

You are done when you can produce, for your own project, **the list of packages that
import the compiler** — and say for each one whether it has stated support.

The tell that it has not landed: *"we can't upgrade, too much depends on
TypeScript."*

## Where this connects

- **← [Phase 0 · 07 · TypeScript 7 is a different compiler](../../phase-0-how-typescript-runs/07-typescript-7-native-compiler.md)**
  — ⚠️ **the prerequisite, and it owns the package contents, the exports map and the
  speed measurement.** Read it first.
- **← [Phase 0 · 09 · Language server vs build](../../phase-0-how-typescript-runs/09-language-server-vs-build.md)**
  — the editor runs its own compiler, which is why an upgrade can leave the editor
  and CI on different versions. Chunk 03 takes that up.
- **← [Phase 10 · 11 · typescript-eslint](../../phase-10-strictness/11-typescript-eslint/README.md)**
  — type-aware rules build a `Program`, so enabling them is what puts your linter in
  the exposed column.
- **→ [01 · Type checking in CI](../01-type-checking-in-ci/README.md)** — the gate is
  a `tsc` invocation, so it is in the unexposed column and can move first.
- **→ 14 · AST tooling after TS 7** *(not written yet)* — `ts-morph` and custom
  transformers in depth. **This topic decides whether you have a problem; that one
  is what to do about it.**

---

← [Phase 12 index](../README.md) · Start → [01 · Which of your tools actually reach in](./01-which-tools-actually-reach-in.md)
