---
title: "Knowing when to stop"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the **TypeScript handbook** (*Declaration Files → Do's and
> Don'ts*, *Functions → Guidelines for Writing Good Generic Functions*, *Template Literal
> Types*, *Utility Types*) and the **TypeScript wiki, *Performance*** (*Naming Complex
> Types*, *Using Type Annotations*, *Preferring Interfaces Over Intersections*, *Preferring
> Base Types Over Unions*) — every quotation in the chunks is verbatim. Fourteen
> diagnostics were read out of the **compiler's own numbered message table** (**TypeScript
> 5.9.3**) and confirmed present in the installed **TypeScript 7.0.2** native compiler;
> `noErrorTruncation` and its `false` default come from the compiler's **option record**.
> **No sandbox, no console block** — the multi-line error shapes are assembled from the
> quoted message templates and labelled as such on each page. Recommendations that
> documentation does not settle are marked **judgement** where they appear.

Seven topics of machinery, and this is the one that decides whether any of it was worth
using. The phase is built around one sentence:

> **A clever type that produces an unreadable error message is a net loss.**

That is not a slogan about taste. It is a claim about **who pays** — you write the type
once, holding the whole design; strangers fail against it many times while already stuck —
and it has a mechanical cause: the compiler reports on **the type you produced, not the
program that produced it.** There is no diagnostic for "the third branch did not match".

| # | Chunk | What it settles |
|---|---|---|
| 01 | [The error is the interface](./01-the-error-is-the-interface.md) | The cost asymmetry, and exactly what the checker can and cannot say — `TS2322`/`2326`/`2328`/`2345`, `TS2344` as the only human-authored diagnostic, `TS6500`/`TS6502` as locations |
| 02 | [Three designs, one mistake](./02-three-designs-one-mistake.md) | One typo through an unconstrained conditional (**no error at all**), a constrained one, and two overloads — and the rule that falls out |
| 03 | [Four fixes that cost nothing](./03-four-fixes.md) | Name every step, bound the input, treat truncation as a budget, and the hover test |
| 04 | [Four tests before you keep it](./04-the-stopping-tests.md) | Explain at review speed · open or closed input set · name the bug · where the failure lands |
| 05 | [Is a type the tool?](./05-is-a-type-the-tool.md) | Validate rather than compute · who maintains it · lint rules, generators and comments · **the ratchet** |
| 06 | [Write the types out](./06-what-to-write-instead.md) | Two named types, a discriminated union, an annotated return, deleting the type parameter, deriving *narrowly* |
| 07 | [Overloads, and the handbook's two warnings](./07-overloads-and-the-handbook.md) | *Use Union Types*, *Use Optional Parameters*, the pass-through problem, and a six-row decision table |
| 08 | [Tables, interfaces and base types](./08-structure-and-tooling.md) | The lookup interface that replaces most conditional chains; `interface extends` over `&`; a base type over a wide union |
| 09 | [The boundary and the generator](./09-the-boundary-and-the-generator.md) | `satisfies`, deriving from a validator, generating declarations, `unknown` plus a guard |
| 10 | [Keeping the ones you keep](./10-keeping-the-ones-you-keep.md) | Façade over machinery, message-type fallbacks, bounded recursion, **the five walls** and the three circularity diagnostics |
| 11 | [The cases that earn it](./11-the-cases-that-earn-it.md) | The six places a computed type is the only correct answer — and why they clear the tests |

## The one-sentence version

**Compute a type when the input is open and the failure is locatable; write it when the
input is closed; check it when the data comes from outside.**

## The four sentences to keep

1. **The error message is the interface.** It is the only part of your type most people
   will ever read, and the compiler can only print the type you produced — never the
   branch that failed.
2. **Enumerable candidates produce enumerable errors.** Overload signatures and union
   members can be listed back with a reason each; a resolved conditional can only be
   printed as a value.
3. **Bad input is excluded by a bound, never handled by a branch.** A constraint fails at
   the call site naming what was expected; a `never` fallback fails somewhere else, silently,
   because `never` is assignable to everything.
4. **The tests apply to the next change, not to the type's birth.** Type-level code
   accretes — two branches, a third, recursion, `TS2589`, a suppression comment — and every
   individual step is defensible while the total is not.

## Where this connects

- **← [02 · Conditional types · chunk 04](../02-conditional-types/04-readable.md)** — the
  conditional-specific half of this argument: the five habits, and the checklist before
  merging one. This topic is the general case.
- **← [Phase 3 · 13 · When *not* to write a generic](../../phase-3-generics/13-when-not-to-write-a-generic/README.md)**
  — the same argument one level down, at the **signature**: a type parameter used once
  relates nothing. Check it before redesigning anything here.
- **← [01 · Mapped types · chunk 01](../01-mapped-types/01-the-loop.md)** — `Prettify`, the
  identity mapping that flattens a display; chunk 10 says to apply it once, at the boundary.
- **← [Phase 2 · `satisfies`](../../phase-2-narrowing/10-satisfies/README.md)** and
  **[assertion functions](../../phase-2-narrowing/09-assertion-functions/README.md)** — the
  two tools that replace a computed type at a boundary.
- **← [Phase 10 · Reading a TypeScript error](../../phase-10-strictness/04-reading-a-typescript-error.md)**
  — the reader's side of the same problem, including `noErrorTruncation`. This topic is the
  author's side.
- **→ 09 · Type-level performance** *(not written yet)* — the compile-time half of the five
  walls, and the depth-capping construction chunk 10 defers.
- **→ 10 · Deriving one function's type from another** *(not written yet)* — chunk 11's case
  2 in full: wrappers, decorators and adapters.

---

← [Phase 5 index](../README.md) · Next → [01 · The error is the interface](./01-the-error-is-the-interface.md)
