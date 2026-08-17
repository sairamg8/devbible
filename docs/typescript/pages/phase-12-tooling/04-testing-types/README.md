---
title: "Testing types"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against **Vitest's** *Testing Types* documentation, the **`tsd`**
> documentation, and the **TypeScript handbook** for `@ts-expect-error`.
> ⚠️ **Neither Vitest nor `tsd` is installed in this repository**, so every tool
> claim is documentation-attributed and **no page here carries a console block.**

:::info 🚧 This topic is mid-write — 1 chunk
Chunk **01 is written**. References to the rest are deliberately **plain text
rather than links** so the build stays green. Resume point:
`devbible/progress_typescript_part_b.md` in the memory store.
:::

A type test asserts what the **compiler** concludes, not what the program computes —
which makes it a different kind of test with two consequences that decide everything
else:

> 🔴 **Its runner is `tsc`.** The assertions are evaluated when the file is checked,
> so a type test outside the checked program **cannot fail** — and tests are exactly
> what people exclude from the build config.
>
> 🔴 **Only one of the two directions is load-bearing.** Asserting a type *is*
> correct is usually redundant, because your application already exercises it.
> Asserting a call is **rejected** is irreplaceable: a signature that quietly widens
> breaks nothing, and every existing call still compiles.

## The chunks

| # | Chunk | What it settles |
|---|---|---|
| 01 | [A test whose runner is the compiler](./01-a-test-whose-runner-is-the-compiler.md) | Where type tests actually run and the program-membership trap; the positive/negative asymmetry; and 🔴 `@ts-expect-error` as an assertion, using `TS2578` — **the only diagnostic that reports a problem which has stopped existing** |
| 02 | **Exactness, `any`, and choosing a tool** *(not written yet)* | Equal vs assignable, why `any` defeats a naive check, and when the cost is worth it |

## Phase gate

You are done when you can say **why a type test that has never failed is suspicious**
— and when your instinct on a published API is to test that the *wrong* call is
refused rather than that the right one works.

## Where this connects

- **← [Phase 10 · 08 · Suppression directives](../../phase-10-strictness/08-suppression-directives/README.md)**
  — ⚠️ **owns `@ts-expect-error` and `TS2578`.** This topic puts them to work; it
  does not re-derive them.
- **← [01 · Type checking in CI](../01-type-checking-in-ci/README.md)** — the
  program-membership trap is the same one, arriving where it does the most damage:
  a suite that passes by not being checked.
- **← [Phase 10 · 03 · Containing `any`](../../phase-10-strictness/03-containing-any.md)**
  — the regression negative tests exist to catch.
- **→ 05 · Typing tests** *(not written yet)* — ⚠️ **a different topic with a
  confusingly similar name.** This one tests *your types*; that one is about keeping
  *test code* honestly typed.

---

← [Phase 12 index](../README.md) · Start → [01 · A test whose runner is the compiler](./01-a-test-whose-runner-is-the-compiler.md)
