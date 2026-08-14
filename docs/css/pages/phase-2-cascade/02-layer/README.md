---
title: "@layer"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-14 against **MDN — [`@layer`](https://developer.mozilla.org/en-US/docs/Web/CSS/@layer)**
> and the **W3C CSS Cascade Level 5** specification. Baseline: **Widely
> available since 2022-03-14** (`web-features` 3.34.3).

**Declare precedence once, up front, instead of encoding it in every selector.**
Layers sit directly above specificity in the cascade, so a one-class rule in a
later layer beats an id in an earlier one — which is what finally makes
overriding third-party CSS a design decision rather than an escalation.

| # | Chunk | Covers |
|---|---|---|
| 01 | **[Declaring and ordering](./01-declaring-and-ordering.md)** | The statement form, block form, `@import … layer()`, nested layers and dot notation, anonymous layers |
| 02 | **[Precedence and `!important`](./02-precedence-and-important.md)** | Unlayered as the implicit final layer, why `!important` inverts layer order, `revert-layer`, swallowing a vendor stylesheet |

## The one rule that explains the whole feature

> **Unlayered declarations behave as if they were in an implicit final layer.**

Normal declarations are won by the *last* layer, so unlayered wins everything.
Important declarations are won by the *first* layer, so unlayered loses to every
layer. One position, two directions — the full derivation is in
[chunk 02](./02-precedence-and-important.md).

## Phase gate

You can design a layer order for an application that imports a third-party
stylesheet, and explain why nothing in it will ever need `!important`.

## Where this connects

- **← [01 · What the cascade compares](../01-what-the-cascade-compares.md)** —
  layers are criterion 4 of 6; this topic is one row of that table expanded.
- **→ [03 · Specificity](../03-specificity-counted-properly.md)** — the criterion
  directly *below* layers, and the one layers exist to stop you fighting.
- **→ Phase 10 · SCSS** — `@layer` is native cascade control; Sass's `@use` is
  build-time module control. They solve different halves and compose fine.

---

← [01 · What the cascade compares](../01-what-the-cascade-compares.md) · Start → [01 · Declaring and ordering](./01-declaring-and-ordering.md)
