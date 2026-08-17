---
title: "Conditional types"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the **TypeScript handbook** (*Conditional Types* —
> all five sections) with every example quoted verbatim, and *Utility Types* for
> the `Exclude` and `Omit` definitions. `TS2322`, `TS2344`, `TS2321`, `TS2589`
> and `TS7056` are read out of the compiler's own message table and confirmed
> present in **TypeScript 7.0.2**. **No console block** — no sandbox run covers
> this phase.

`SomeType extends OtherType ? TrueType : FalseType` — a ternary for types. Half
of this topic is the mechanism, which is small. The other half is the two
behaviours that make it feel unpredictable until you know them: **deferral**
while a type parameter is unresolved, and **distribution** over unions.

Together with [mapped types](../01-mapped-types/README.md), this is what every
helper type in every library you use is built from. `Exclude` is a conditional.
`Omit` is a conditional and a mapping. `ReturnType` is a conditional with an
`infer`.

| # | Chunk | What it settles |
|---|---|---|
| 01 | [The question it asks](./01-the-question.md) | `extends` means *assignable to*, the results that follow from that, `any` taking both branches, `never` as the false branch, and why chain order matters |
| 02 | [When it is deferred](./02-deferred.md) | One signature instead of overloads, why the function body cannot satisfy its own conditional return type, and what a constraint gives you that a conditional does not |
| 03 | [Composing them](./03-composing.md) | With `infer`, with a union, with a mapped type, and with itself — building `Exclude` and `Omit` from parts |
| 04 | [Keeping them readable](./04-readable.md) | The cost nobody sees until it fails, five habits, the three depth limits, and when to delete the type instead |

## The one-sentence version

**A conditional type asks whether the left type is assignable to the right one**,
and answers with one of two types — deferring the answer while the input is still
a type parameter, and distributing across the members when the input is a naked
union.

## The three sentences to keep

1. **`extends` is assignability, not inheritance.** Specific extends general is
   `true`; general extends specific is `false`. Most confusion is that sentence,
   forgotten.
2. **Narrowing a value never narrows `T`.** A function whose return type is
   conditional cannot satisfy it from inside — implement behind an overload, or
   assert once.
3. **`never` is the composing false branch; a named message type is the
   debuggable one.** Choose deliberately, because that choice is what the next
   person reads when it fails.

## Phase gate contribution

The gate asks for `Pick`, `Omit` and `ReturnType` from an empty file.
[Topic 01](../01-mapped-types/README.md) gave you `Pick`; this topic gives you
`Omit` — `Pick<T, Exclude<keyof T, K>>`, a distributing conditional feeding a
mapping. `ReturnType` needs `infer`, which is topic 06.

## Where this connects

- **← [01 · Mapped types](../01-mapped-types/README.md)** — the other half of
  every helper type. Chunk 03 composes the two.
- **← [Phase 1 · structural typing](../../phase-1-type-vocabulary/09-structural-typing.md)**
  — the assignability rules a conditional is asking about; if these are vague,
  conditional results will look arbitrary.
- **← [Phase 3 · `infer` in conditional types](../../phase-3-generics/11-infer-in-conditional-types.md)**
  — met there in a generics context; chunk 03 uses it, topic 06 takes it apart.
- **→ [05 · Distributive conditional types](../05-distributive-conditionals.md)** — what "naked
  type parameter" means precisely, why `never` vanishes, and the bracket trick in
  full.
- **→ [06 · Extracting with `infer`](../06-infer/README.md)** — multiple `infer` sites,
  constrained `infer`, and the standard-library extractors.
- **→ [09 · Type-level performance](../09-type-level-performance/README.md)** — `TS2589`, `TS2321` and
  what makes a checker slow.

---

← [Phase 5 index](../README.md) · Next → [01 · The question it asks](./01-the-question.md)
