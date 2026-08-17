---
title: "Tuple manipulation"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-know">Know</span>

**5 chunks, 1,211 lines with this index**, spread **200 · 219 · 229 · 237 · 266** — no file near the cap.

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
| 03 | [Labels, optionality and the spread rule](./03-labels-and-optionality.md) | The three 4.0 labelling rules, 🔴 **the only two structure-preserving operations there are**, and why `infer` sits between them — the case that bites hardest |
| 04 | [Typing `bind`, `curry` and partial application](./04-bind-and-curry.md) | The notes' own `partialCall` with all four of its error cases, why currying is the recursive version, and 🔴 **the four places the pattern stops — all one root cause** |
| 05 | [The limits](./05-the-limits.md) | The three ceilings applied to tuples, 🔴 **the three cheaper things to check before writing a recursion**, the four shapes a tuple is the wrong tool for, and the four-clause test for when this earns its cost |

## The five sentences to keep

1. **Length and order are the information.** The general signature
   `concat<T, U>(a: T[], b: U[]): Array<T | U>` throws both away, and that is the sentence
   the 4.0 notes use to justify the whole feature.
2. 🔴 **Positions before an unbounded spread survive; positions after it do not.** One
   array spread into a tuple absorbs everything that follows it into the rest element.
3. 🔴 **Spread preserves structure; rebuilding from indexed access destroys it.** Labels,
   `?` and the rest element belong to the *positions*, so `[T[0], T[1]]` silently returns
   anonymous required elements — and changes the arity.
4. **There are exactly two structure-preserving operations** — a spread, and a homomorphic
   mapped type. Everything else is a rebuild.
5. **This is a parameter-list tool.** The 10,000-element ceiling and the per-use cost make
   it poor for anything resembling data, and the syntax hides that.

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
