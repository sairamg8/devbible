---
title: "Function components"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-13 against **react 19.2.8**, from documentation — react.dev
> [Your First Component](https://react.dev/learn/your-first-component) and
> [Preserving and Resetting State](https://react.dev/learn/preserving-and-resetting-state).
> No sandbox script backs this topic; claims are cited, not measured.

A component is a function of props returning UI — but the definition that
matters is *who calls it*. React does, which is what lets it own the timing,
the repetition, the position and the identity. Two chunks:

| # | Chunk | In one line |
|---|---|---|
| 01 | **[What makes a function a component](01-what-makes-a-component.md)** | React calls it, not you — and `<Widget />` is not `Widget()` |
| 02 | **[Component identity and the nesting rule](02-identity-and-nesting.md)** | A new function object per render destroys everything below it |

**Split at 300 lines on a concept boundary.** Chunk 01 is the definition and the
element-vs-call distinction; chunk 02 is reconciliation by type and the four
disguises of the nesting bug. Both carry their own gotchas and interview
questions.

## Where this connects

- **← Phase 1** — [Capitalization](../../phase-1-jsx/05-capitalization.md)
  explains *why* the capital letter changes what JSX emits. This topic explains
  why that matters.
- **← Phase 1** — [What can be rendered](../../phase-1-jsx/03-what-can-be-rendered.md)
  is the full set of legal return values.
- **→ [Purity](../02-purity/README.md)** — the second obligation React attaches
  to a function once it is a component.
- **→ Phase 3** — resetting state with `key` uses the identity rule from
  chunk 02 deliberately.
- **→ [Higher-order components](../13-higher-order-components/README.md)** — the
  most common real-world source of an unstable component type.

---

← Index: [Phase 2](../README.md) · Start → [What makes a function a component](01-what-makes-a-component.md)
