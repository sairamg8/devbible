---
title: "Constraints — `T extends …`"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the **TypeScript handbook** (*Generics → Generic
> Constraints*). `TS2344`, `TS2345` and `TS2313` were read out of the compiler's
> own diagnostic table, and **`NoInfer<T>` directly from `lib.es5.d.ts`** —
> ⚠️ TypeScript **6.0.3**, not the 7.0.2 this corpus targets. **No console block
> on either chunk**; no sandbox run covers this phase.

An unconstrained `T` lets you pass a value around, store it and return it —
nothing else. A constraint buys back the ability to *look at* the value while
keeping the relationship that made the generic worth writing.

The sentence to hold on to:

> **`T extends X` means "T must be assignable to X". It is an upper bound
> checked structurally — not inheritance — and it is a floor on what you *know*,
> never a licence to *construct* a `T`.**

| # | Chunk | What it covers |
|---|---|---|
| 01 | [What a constraint does](./01-what-a-constraint-does.md) | Why `extends` is not inheritance, why you cannot return a literal typed `T`, the bounds worth writing, `TS2344` vs `TS2345`, constraints referring to other parameters, and when the bound proves the generic is unnecessary |
| 02 | [Constraints in practice](./02-constraints-in-practice.md) | Union bounds and literal preservation, `K extends keyof T`, recursive shapes, the `.tsx` `<T,>` trap, constraint ≠ default, `NoInfer<T>`, and how tight to make a bound |

## Phase gate

You are done with this topic when you can say why
`<T extends { count: number }>(x: T): T { return { count: 0 } }` is rejected,
choose between `T extends unknown[]` and `T extends readonly unknown[]` without
thinking about it, and name the case `NoInfer<T>` was added for.

## Where this connects

- **← [01 · Generic functions and inference](../01-generic-functions-and-inference/README.md)**
  — the unconstrained `T` this topic fixes, and the `extends string` literal
  trick it generalises.
- **← [Phase 1 · Structural typing](../../phase-1-type-vocabulary/09-structural-typing.md)**
  — a constraint is an assignability check, so structural rules decide what
  satisfies it.
- **→ 04 · `keyof`** and [05 · The `getProp` pattern](../05-getprop-pattern/README.md) —
  `K extends keyof T` is the constraint that makes generics compose.
- **→ [08 · Default type parameters](../08-default-type-parameters.md)** — the mechanism a
  constraint is repeatedly mistaken for.
- **→ [14 · Variance](../14-variance.md)** — why `(...args: never[]) => unknown`
  is the right bound for "any function".

---

← Prev: [01 · Generic functions and inference](../01-generic-functions-and-inference/README.md) · Next → [03 · Generic interfaces and type aliases](../03-generic-interfaces-and-aliases/README.md)
