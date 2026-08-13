---
title: "Phase 1 — The type vocabulary"
sidebar_label: "Phase 1 · The type vocabulary"
sidebar_position: 1
---

> Verified: 2026-08 on **TypeScript 7.0.2** and **Node 24.19.0**. Every console
> block in this phase came from a script in `sandbox/ts-p1/`, and inferred types
> were read out of emitted `.d.ts` files rather than editor tooltips.

**17 pages.** Every type you will write for the next year. This is the densest
phase in the syllabus for Master-tier rows, because these are the ones you use
without looking anything up.

| # | Page | Tier | What it settles |
|---|---|---|---|
| 01 | [Primitives and inference](./01-primitives-and-inference.md) | <span className="db-tier t-master">Master</span> | `let` widens, `const` does not — read out of the emitted declarations |
| 02 | [Literal types and `as const`](./02-literal-types-and-as-const.md) | <span className="db-tier t-master">Master</span> | One list, with the union derived from it |
| 03 | [Arrays and tuples](./03-arrays-and-tuples.md) | <span className="db-tier t-master">Master</span> | Why a hook returning `[value, setValue]` needs `as const` |
| 04 | [Object types](./04-object-types.md) | <span className="db-tier t-master">Master</span> | Excess property checks, and the weak-type rule behind them |
| 05 | [Union types](./05-union-types.md) | <span className="db-tier t-master">Master</span> | Discriminated unions and exhaustiveness naming the missed case |
| 06 | [`any`, `unknown`, `never`, `void`](./06-any-unknown-never-void.md) | <span className="db-tier t-master">Master</span> | The two `any` lines the compiler had nothing to say about |
| 07 | [`type` vs `interface`](./07-type-vs-interface.md) | <span className="db-tier t-master">Master</span> | Merging vs `TS2300`, and the error-message folklore that failed |
| 08 | [Function types](./08-function-types.md) | <span className="db-tier t-master">Master</span> | Fewer parameters is fine; returning into `void` is fine |
| 09 | [Structural typing](./09-structural-typing.md) | <span className="db-tier t-master">Master</span> | Shapes not names — and what that costs you in identity |
| 10 | [`null` and `undefined`](./10-null-and-undefined.md) | <span className="db-tier t-master">Master</span> | Narrowing that disappears after an `await` |
| 11 | [Intersection types](./11-intersection-types.md) | <span className="db-tier t-understand">Understand</span> | Conflicting members become `never`, silently |
| 12 | [Call and construct signatures](./12-call-and-construct-signatures.md) | <span className="db-tier t-understand">Understand</span> | Callables with properties, and `typeof MyClass` |
| 13 | [`enum` vs union](./13-enum-vs-union.md) | <span className="db-tier t-understand">Understand</span> | The IIFE `enum` emits, and the two-line replacement |
| 14 | [`readonly` and immutability](./14-readonly-and-immutability.md) | <span className="db-tier t-understand">Understand</span> | A promise, not a freeze — and shallow either way |
| 15 | [Recursive types](./15-recursive-types.md) | <span className="db-tier t-understand">Understand</span> | `JsonValue`, and where `TS2589` actually starts |
| 16 | [`object`, `Object`, `{}`](./16-object-Object-braces.md) | <span className="db-tier t-know">Know</span> | Three types that accept wildly different values |
| 17 | [`symbol` and `unique symbol`](./17-symbols.md) | <span className="db-tier t-know">Know</span> | `const` gives `unique symbol`; `let` widens |

## What the measurements changed

Five claims on these pages were written one way and corrected by running the
script — three of them were things I believed and one is common folklore:

1. **Weak type detection exists and then stops.** A typo in an optional property
   is caught through a *variable* (`TS2559`) only when **every** property of the
   target is optional. Add one required property and the same typo passes
   silently. Both halves measured.
2. **"Interfaces give better error messages" did not reproduce.** A plain object
   alias and an equivalent interface produced identical `TS2741` text, each
   naming its own type.
3. **`TS2589` is far away.** Type-level recursion at depth 50 and 500 compiled
   fine; only 5000 tripped the limit. The error means *type-level arithmetic has
   gone too far*, not "your data is too nested".
4. **A `reduce` example on this site did not compile** until the script was run —
   the accumulator infers from the array's elements, not from the initial value,
   so `reduce<number>` is required. It is on the page as a worked correction.
5. **A plain `symbol` was accepted as a computed key** in both an interface and a
   type alias, against the widely-documented `unique symbol` requirement.

## Phase gate

Move on when you can model an API payload — optional fields, a status union, a
nested object, a list — without reaching for `any`, and say for each choice why
it is not one of the neighbouring ones.

## Where this connects

- **→ Phase 2 (Narrowing)** — every union here is unusable until narrowed; that
  phase is the other half.
- **→ Phase 3 (Generics)** — `keyof`, `typeof` and indexed access build directly
  on the object and literal types here.
- **→ Phase 5 (Type-level programming)** — mapped and conditional types are these
  primitives turned into machinery.
- **→ Phase 9 (Types at the boundary)** — `unknown` is introduced here and
  becomes policy there.

## Sandbox

`sandbox/ts-p1/` — `ex1-inference-widening.sh` … `ex7-object-types.sh`.
`npm install`, then run any script directly. `ex1` establishes the technique used
throughout: **emit declarations and read the inferred types out of the `.d.ts`**,
so no claim about inference rests on a tooltip.

---

← [Phase 0](../phase-0-how-typescript-runs/README.md) · Next → [01 · Primitives and inference](./01-primitives-and-inference.md)
