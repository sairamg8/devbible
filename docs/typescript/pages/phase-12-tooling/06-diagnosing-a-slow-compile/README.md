---
title: "Diagnosing a slow compile"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the **TypeScript 5.9.3 option table read from disk**
> (`sandbox/ts-p0`) and the **TypeScript wiki's Performance** page. The checker's
> cost model is [phase 5 · 09](../../phase-5-type-level/09-type-level-performance/README.md)'s,
> read from the compiler source and **linked rather than re-derived**.
> ⚠️ **No timing figure on these pages is ours** — there is no build sandbox, so the
> topic teaches how to read *your* numbers and quotes none of its own.
> **No console block.**

:::info 🚧 This topic is mid-write — 1 chunk
Chunk **01 is written**. References to the rest are deliberately **plain text
rather than links** so the build stays green. Resume point:
`devbible/progress_typescript_part_b.md` in the memory store.
:::

Every slow-compile investigation goes wrong the same way: a theory, a config change,
and a build that is still slow — now with a setting nobody can justify.

> 🔴 **Read the phase split before anything else.** *Too many files* and *types too
> complex* both present as "the build is slow" and have **opposite** fixes, so a
> change aimed at the wrong one does nothing.

## The chunks

| # | Chunk | What it settles |
|---|---|---|
| 01 | [Measure before you guess](./01-measure-before-you-guess.md) | The four flags in the compiler's own words — including 🔴 `--generateTrace` emitting **"a list of types"**, the half that names the culprit, and `--generateCpuProfile`, which the syllabus does not mention — plus the phase-split table and the loop that works |
| 02 | **The shapes that are slow** *(not written yet)* | Deep conditionals, huge unions, `DeepPartial`, and what to write instead |

## Phase gate

You are done when your first move on a slow build is **a measurement that tells you
which phase**, and when you can say why *"the project got too big"* is almost never
the explanation.

## Where this connects

- **← [Phase 5 · 09 · Type-level performance](../../phase-5-type-level/09-type-level-performance/README.md)**
  — ⚠️ **owns the checker's limits, read from source**: the per-expression reset and
  the shrinking comparison budget. This topic uses them; it does not re-derive them.
- **← [01 · Type checking in CI · chunk 04](../01-type-checking-in-ci/04-making-it-fast-enough.md)**
  — the levers, and which ones cost coverage. **Diagnose here, decide there.**
- **← [01 · chunk 02](../01-type-checking-in-ci/02-what-the-gate-guarantees.md)** —
  `--explainFiles`, and why an oversized program is a **coverage** finding too.
- **→ 07 · Editor performance** *(not written yet)* — the same program, a different
  process.

---

← [Phase 12 index](../README.md) · Start → [01 · Measure before you guess](./01-measure-before-you-guess.md)
