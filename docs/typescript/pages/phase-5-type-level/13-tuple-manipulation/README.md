---
title: "Tuple manipulation"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-know">Know</span>

:::info Topic in progress
**Chunks 01 and 02 are written.** The remaining chunks are planned and referred to as plain text until
they land.
:::

> Verified: 2026-08 against the **TypeScript 4.0 release notes** (*Variadic Tuple Types*,
> *Labeled Tuple Elements*), quoted verbatim where they are quoted at all. The tuple element
> ceiling is [topic 11 · chunk 04](../11-recursive-types/04-the-fine-print.md)'s read of the
> **5.9.3** checker. **No sandbox, no console block, no timings.**

A tuple is a list whose **length and positions are known**, and every operation here is a way
of taking one apart or putting one back together without losing that knowledge. The 4.0
release notes state the stakes directly: the general signature
`concat<T, U>(a: T[], b: U[]): Array<T | U>` *"doesn't encode anything about the lengths of
the input, or the order of the elements"* — and length and order are the entire reason the
tuple type exists.

| # | Chunk | What it settles |
|---|---|---|
| 01 | [The accessors](./01-the-accessors.md) | `Head`, `Tail`, `Last`, `Init`, `Length` — why every pattern needs `readonly`, why `never` and `[]` are different base cases, and why `Last` was unwritable before 4.0 |
| 02 | [Variadic tuple types](./02-variadic-tuple-types.md) | The two changes 4.0 actually made, 🔴 **the rule that positions before an unbounded spread survive and positions after it do not**, and why a structural operation should be a spread rather than a recursion |
| 03 | **Labels, optionality and the spread rule** *(not written yet)* | The 4.0 labelling rules, and why rebuilding a tuple from indexed access destroys what a spread preserves |
| 04 | **Typing `bind`, `curry` and partial application** *(not written yet)* | The release notes' own `partialCall`, and where the pattern stops working |
| 05 | **The limits** *(not written yet)* | The 10,000-element ceiling, the cost of a recursive tuple walk, and when a tuple type is the wrong shape |

## The one-sentence version

**Tuple manipulation is the difference between a signature that knows `[string, number]` and
one that only knows "an array of string-or-number"** — and the whole toolkit exists because
the alternative was an overload per input length.

## Where this connects

- **← [11 · Recursive types · chunk 02](../11-recursive-types/02-the-accumulator-pattern.md)**
  — the accumulator conversion, and `Reverse`, `Split`, `Range`, `Repeat`, `Join` worked in
  full. This topic uses those and does not repeat them.
- **← [11 · Recursive types · chunk 03](../11-recursive-types/03-order-and-position.md)** —
  `[...Acc, H]` against `[H, ...Acc]`, and why the order of a spread decides the order of the
  result.
- **← [11 · Recursive types · chunk 04](../11-recursive-types/04-the-fine-print.md)** — the
  **10,000-element** tuple ceiling, `TS2799`/`TS2800`, checked at the spread.
- **← [10 · Deriving function types · chunk 02](../10-deriving-function-types/02-what-it-loses.md)**
  — 🔴 **optionality and labels survive a spread and are destroyed by rebuilding from indexed
  access.** That is the single most load-bearing fact in this topic and it is already argued
  there.
- **← [12 · The deep helpers · chunk 01](../12-deep-helpers/01-the-naive-version.md)** —
  `instantiateMappedTupleType` preserves labels and element flags, which is why a tuple
  survives a mapped type.

---

← [Phase 5 index](../README.md) · Next → [01 · The accessors](./01-the-accessors.md)
