---
title: "Extracting with `infer`"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the **TypeScript handbook** (*Conditional Types* —
> *Inferring Within Conditional Types*) and the **4.7** and **4.8 release notes**
> (constrained `infer`; `infer` in template string types), with every example
> quoted verbatim in the chunks. **No console block** — no sandbox run covers
> this phase.

`infer` names a piece of a pattern. `T extends Array<infer E> ? E : never` does
not ask *"is this an array?"* — it asks *"is this an array, and if so, of what?"*,
and that second question is what every extractor in the standard library is built
on.

The basics are already written and are not repeated here: `Flatten` and
`GetReturnType` in
[topic 02 · chunk 03](../02-conditional-types/03-composing.md), and the whole
`ReturnType` / `Parameters` / `Awaited` family — with the documented overload rule
— in [topic 03 · chunk 04](../03-utility-types/04-extractors.md).

| # | Chunk | What it settles |
|---|---|---|
| 01 | [Pattern matching](./01-pattern-matching.md) | Where `infer` is legal, `readonly` array patterns, **constrained `infer`** (4.7) replacing nested conditionals, several `infer` sites at once, and recursive extraction |
| 02 | [In strings, and your own](./02-strings-and-your-own.md) | `infer` inside template literal types, **parsing a primitive out of a string** (4.8) and the round-tripping rule, writing your own extractors, and the four ways inference goes wrong |

## The one-sentence version

**A conditional, a pattern, an `infer`, a `never` fallback** — every extractor you
will ever write is that line with a different pattern.

## The three sentences to keep

1. **A constraint on the `infer` removes a level of nesting.**
   `[infer S extends string, ...unknown[]]` says match *and* check in one place;
   if the constraint fails, the conditional takes the false path.
2. **Template-string parsing only keeps a literal if it round-trips.** `"100"`
   gives `100`; `"1.0"` gives `number`, because printing `1` back does not
   reproduce `"1.0"`.
3. **Reusing an `infer` name is not a shortcut.** Co-variant positions union the
   candidates, contra-variant ones intersect them — which is how you end up with
   `string & number`.

## Where this connects

- **← [02 · Conditional types](../02-conditional-types/README.md)** — `infer` is
  only legal in a conditional's `extends` clause; chunk 03 there introduces it.
- **← [03 · The built-in utility types](../03-utility-types/README.md)** — the
  seven standard extractors, the overload rule, and the variance rule for repeated
  `infer` names.
- **← [Phase 3 · `infer` in conditional types](../../phase-3-generics/11-infer-in-conditional-types.md)**
  — the first encounter, in a generics context.
- **→ [07 · Template literal types](../07-template-literal-types.md)** — the string half of chunk
  02, on its own terms.
- **→ 13 · Tuple manipulation** *(not written yet)* — variadic patterns like
  `[...infer Rest, infer Last]`, which chunk 01 previews.

---

← [Phase 5 index](../README.md) · Next → [01 · Pattern matching](./01-pattern-matching.md)
