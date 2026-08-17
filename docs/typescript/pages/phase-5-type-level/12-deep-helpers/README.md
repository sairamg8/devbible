---
title: "DeepPartial / DeepReadonly"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-know">Know</span>

**5 chunks, 1,225 lines**, spread **207 · 230 · 231 · 241 · 257** — no file at the cap, and
nothing trimmed to reach it.

> Verified: 2026-08. 🔴 **The primitive pass-through and the empty call-signature list were
> read out of the compiler's own source** — **TypeScript 5.9.3**,
> `sandbox/ts-p0/node_modules/typescript5/lib/typescript.js`. The three homomorphic
> behaviours are the **2.8** and **3.1 release notes**, quoted in
> [topic 01 · chunk 02](../01-mapped-types/02-modifiers.md). ⚠️ **Internals are 5.9.3's and
> are not claimed for the 7.0.2 Go port.** **No sandbox, no console block, no timings.**

The standard library's `Partial` and `Readonly` are one level deep. Every codebase
eventually writes the recursive version, and the recursive version is where the
mechanisms of [topic 01](../01-mapped-types/README.md) meet the costs of
[topic 11](../11-recursive-types/README.md) — because **recursion over an object fans
out**: every property is its own branch, so the work multiplies at each level rather than
advancing by one.

| # | Chunk | What it settles |
|---|---|---|
| 01 | [The naive version](./01-the-naive-version.md) | What the four-line version already gets right — and 🔴 **the `T extends object` guard everyone writes to protect primitives is guarding against something that cannot happen** |
| 02 | [What it breaks](./02-what-it-breaks.md) | Five silent failures — 🔴 **a mapped type structurally cannot carry a call signature**, class instances become name-only shells, `DeepPartial` makes array *elements* `undefined`, recursive data cannot be fixed with an accumulator, and `any` is mapped rather than passed through |
| 03 | [The version that holds up](./03-the-version-that-holds-up.md) | The five guards in the order they must go, 🔴 **why `DeepReadonly` should NOT have an array branch and `DeepPartial` must**, and the three limits no guard removes |
| 04 | [`DeepPartial` is not `DeepReadonly`](./04-partial-is-not-readonly.md) | 🔴 **One is a restriction, the other a widening** — the three places a deep-partial genuinely belongs, all of them *partial in, complete out*, and what happens when it escapes |
| 05 | [The cost, and the alternatives](./05-the-cost.md) | Three costs that multiply, why the error messages are the underrated one, the six fixes cheapest-first, and 🔴 **what a published helper actually sells you — the guard list, not the mapped type** |

## The one-sentence version

**A deep helper is a homomorphic mapped type applied recursively**, which means it
inherits modifier preservation, array and tuple handling and union distribution for free —
and inherits nothing at all about what to do with the objects that are not plain data.

## The four sentences to keep

1. 🔴 **The `T extends object` guard everybody writes is unnecessary for the reason it is
   always given** — `instantiateConstituent` returns primitives untouched — **and necessary
   for a different one**, because functions and class instances are object-flagged.
2. 🔴 **A mapped type structurally cannot carry a call signature.**
   `resolveMappedTypeMembers` starts the call- and construct-signature lists empty and never
   refills them, so a method that goes through a mapping comes out as `{}`.
3. 🔴 **`DeepReadonly` should not have an array branch and `DeepPartial` must.** `readonly`
   composes with arrays; `?` lands on the element and turns `string[]` into
   `(string | undefined)[]`.
4. **One is a restriction and the other is a widening.** `DeepReadonly` cannot describe a
   value that does not exist; `DeepPartial` claims every subset of your structure is
   meaningful, which is a statement about your domain and usually false.

## Where this connects

- **← [01 · Mapped types · chunk 02](../01-mapped-types/02-modifiers.md)** — what
  "homomorphic" buys, quoted from the 2.8 and 3.1 release notes. Everything correct about
  the deep version is inherited from there.
- **← [11 · Recursive types](../11-recursive-types/README.md)** — the depth limits, why
  object recursion cannot be converted to tail position, and the depth-cap construction
  this topic uses rather than restates.
- **← [08 · Knowing when to stop](../08-knowing-when-to-stop/README.md)** — a deep helper
  over a wide shape is the canonical unreadable hover.
- **← [Phase 1 · `readonly` and immutability](../../phase-1-type-vocabulary/14-readonly-and-immutability.md)**
  — what `readonly` does and does not guarantee at runtime; assumed here, not repeated.
- **← [Phase 10 · `exactOptionalPropertyTypes`](../../phase-10-strictness/05-exactoptionalpropertytypes/README.md)**
  — the flag that decides what a deep-optional property actually means.

---

← [Phase 5 index](../README.md) · Next → [01 · The naive version](./01-the-naive-version.md)
