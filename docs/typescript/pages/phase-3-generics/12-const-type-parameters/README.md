---
title: "`const` type parameters"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the **TypeScript 5.0 release notes** (*const Type
> Parameters*) — the `getNamesExactly`, `fnGood` and `fnBad` examples and their
> inferred types are **quoted verbatim from that page**. Modifier-placement
> message text is read out of the **compiler's own diagnostic table** (⚠️ install
> inspected: TypeScript **6.0.3**, not the 7.0.2 this corpus targets). **No
> console block** — no sandbox run covers this phase.

[Topic 02](../02-constraints/README.md) established that `<T extends string>`
preserves literal types: constrain a parameter to `string` and a call with
`'red'` infers `'red'`, not `string`. That trick works for primitives and stops
dead at objects and arrays. **`const` type parameters (TypeScript 5.0) are the
missing half** — one keyword that moves `as const` off every call site and into
the declaration that actually knows it is needed.

It is a small feature with a disproportionately large failure mode: **two
distinct situations where it compiles, looks correct, and does nothing at all**,
one of which reports no error. That is why this topic is three parts rather than
one.

| # | Chunk | What it settles |
|---|---|---|
| 01 | [What `const` inference does](./01-what-const-inference-does.md) | The widening problem, the one-keyword fix, and exactly which three things you get back |
| 02 | [Where it silently does nothing](./02-where-it-silently-does-nothing.md) | The two no-op cases, where the modifier may be written, and what it does *not* do |
| 03 | [Designing APIs with it](./03-designing-apis-with-it.md) | The builder pattern it exists for, the three-way `as const` / `satisfies` / `<const T>` split, and when to leave it off |

## The one-sentence version

`<const T>` tells inference to treat the argument **as if the caller had written
`as const`** — but only for expressions physically written inside the call, and
only if the constraint is `readonly` all the way down.

## Where this connects

- **← [Phase 1 · Literal types and `as const`](../../phase-1-type-vocabulary/02-literal-types-and-as-const.md)**
  — what `as const` actually produces, which is exactly what this modifier
  reproduces at a call site.
- **← [02 · Constraints](../02-constraints/README.md)** — `<T extends string>` is
  the primitive-only version of the same goal.
- **← [06 · Indexed access types](../06-indexed-access-types.md)** — `T[number]`
  and `T[K]` are what read the preserved literals back out; without them there is
  no reason to preserve anything.
- **→ [13 · When not to write a generic](../13-when-not-to-write-a-generic/README.md)** —
  a `const` on a parameter nothing indexes into is one of the listed failure
  shapes.
- **→ [14 · Variance](../14-variance.md)** — the `in`/`out` annotations share the
  modifier-placement diagnostics discussed in chunk 02, and sit on the opposite
  list.

---

← [Phase 3 index](../README.md) · Next → [01 · What `const` inference does](./01-what-const-inference-does.md)
