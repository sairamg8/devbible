---
title: "Mapped types"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the **TypeScript handbook** (*Mapped Types*, *Keyof
> Type Operator*, *Indexed Access Types*) and the release notes for **2.1**
> (mapped types introduced), **2.8** (`+`/`-` modifiers) and **3.1** (mapped
> types over tuples and arrays) — every example in the chunks is quoted verbatim
> from one of those. Diagnostics are read out of the compiler's own message table
> and confirmed present in **TypeScript 7.0.2**. **No console block** — no
> sandbox run covers this phase.

A mapped type is **a loop over a union of keys that produces properties**. That
one sentence covers the mechanism; the four chunks below cover what you can put
in the loop, what the modifiers do, and where the pattern stops working.

This is the first Master topic of the phase because everything after it is built
on it: `Partial`, `Readonly`, `Pick` and `Record` are all four lines of mapping,
and the utilities topic 03 asks you to write from an empty file are variations of
what is here.

| # | Chunk | What it settles |
|---|---|---|
| 01 | [The loop](./01-the-loop.md) | The syntax and where it comes from, `keyof` plus indexed access, iterating a union that is not `keyof T`, and why only a `type` can hold a mapping |
| 02 | [Modifiers](./02-modifiers.md) | `readonly` and `?`, the `+`/`-` operators, and what **homomorphic** buys you — modifier preservation, arrays staying arrays, union distribution |
| 03 | [Writing your own](./03-writing-your-own.md) | The value expression, conditionals inside a mapping, building `Partial`/`Required`/`Pick`/`Record` from an empty file, and two patterns worth stealing |
| 04 | [Limits and misreadings](./04-limits.md) | The four things a mapping cannot do, the `keyof` results that look like bugs, deferred generics, circularity, and the readability limit |

## The one-sentence version

**`{ [K in keyof T]: T[K] }` is `keyof` and indexed access in a loop** — change
what you iterate to change the keys, change the expression after the colon to
change the values, and put `+`/`-` on `readonly` and `?` to change the modifiers.

## The three sentences to keep

1. **A mapped type is the whole object type.** You cannot add a member beside the
   loop (`TS7061`) — intersect instead.
2. **Homomorphic is a real distinction, not jargon.** `[K in keyof T]` over a type
   parameter preserves modifiers, keeps arrays as arrays and distributes over
   unions. Filter or remap the keys and you lose all three at once.
3. **`-` is the operator that carries information.** `+` is the default, so
   `-readonly` and `-?` are the two spellings worth memorising — they are exactly
   how `Mutable` and `Required` are written.

## Phase gate contribution

The phase gate asks you to write `Pick`, `Omit` and `ReturnType` from an empty
file. This topic gives you `Pick`; `Omit` needs a conditional type on the key
union (topic 03) and `ReturnType` needs `infer` (topic 06).

## Where this connects

- **← [Phase 3 · `keyof`](../../phase-3-generics/04-keyof/README.md)** and
  **[Indexed access types](../../phase-3-generics/06-indexed-access-types.md)** —
  the two halves a mapped type is assembled from.
- **← [Phase 1 · `type` vs `interface`](../../phase-1-type-vocabulary/07-type-vs-interface.md)**
  — an interface cannot contain a mapping, which is one of the few genuine
  capability differences between them.
- **← [Phase 1 · `readonly` and immutability](../../phase-1-type-vocabulary/14-readonly-and-immutability.md)**
  — what the modifier means before a mapping starts adding and removing it.
- **→ 02 · Conditional types** *(not written yet)* — the other half of every
  useful helper type; chunk 03 composes the two.
- **→ 04 · Key remapping with `as`** *(not written yet)* — renaming and filtering
  keys, and the homomorphism it costs you.

---

← [Phase 5 index](../README.md) · Next → [01 · The loop](./01-the-loop.md)
