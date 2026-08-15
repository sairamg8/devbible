---
title: "Generic functions and inference"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the **TypeScript handbook** (*Generics*, *Type
> argument inference*). `TS2345`, `TS2344`, `TS2558` and `TS2347` were read out
> of the compiler's own diagnostic table — ⚠️ TypeScript **6.0.3**, not the
> 7.0.2 this corpus targets. **No console block on either chunk**; no sandbox
> run covers this phase.

The first topic of the phase, and the one the other thirteen assume. Two ideas,
one per chunk:

> **A type parameter is a variable in the type language** — declared in `<>`,
> used in the signature, and *solved* by the compiler at every call site.
>
> **The solving happens from the arguments**, in order, which is why a callback's
> parameter is typed for free and why moving an argument can break it.

| # | Chunk | What it covers |
|---|---|---|
| 01 | [What a type parameter is](./01-what-a-type-parameter-is.md) | Why `any` and overloads both fail, the type-variable model, why an unconstrained `T` permits almost nothing, why `new T()` cannot work, and what a second parameter buys |
| 02 | [Where inference comes from](./02-where-inference-comes-from.md) | Inference sites and their ordering, conflicting candidates, the `unknown` fallback, explicit type arguments and `TS2558`, the `extends string` literal trick, and how to read what was inferred |

## Phase gate

You are done with this topic when you can write `map<T, U>` from an empty file
and explain, without compiling, why the callback's parameter does not need an
annotation — and when you can look at `getJson<T>(url: string): Promise<T>` and
say immediately what is wrong with it.

## Where this connects

- **← [Phase 1 · `any`/`unknown`](../../phase-1-type-vocabulary/06-any-unknown-never-void.md)**
  — the `any` version of `first` is the baseline a generic improves on.
- **← [Phase 0 · Erasure](../../phase-0-how-typescript-runs/02-erasure.md)** —
  why `new T()` and `typeof T` cannot exist.
- **→ [02 · Constraints](../02-constraints/README.md)** — what makes the body able to *do*
  something with the value.
- → [10 · Inference sites and contextual typing](../10-inference-sites-and-contextual-typing.md) — the
  full treatment of the ordering rules sketched here.
- **→ [13 · When not to write a generic](../13-when-not-to-write-a-generic.md)** — the
  return-position-only parameter, which this topic names and that one dissects.

---

← [Phase 3 index](../README.md) · Next → [02 · Constraints](../02-constraints/README.md)
