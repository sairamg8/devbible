---
title: "Phase 2 — Narrowing and control flow analysis"
sidebar_label: "Phase 2 · Narrowing"
sidebar_position: 2
---

> Verified: 2026-08 on **TypeScript 7.0.2**. Every narrowed type on these pages
> was revealed by assigning the value to `1` and reading the compiler's error,
> from `sandbox/ts-p2/ex1-narrowing-basics.sh` and `ex2-guards-and-loss.sh`.
> Behaviour not covered by those two runs is validated against the TypeScript
> handbook (*Narrowing*, *Type predicates*, *Assertion functions*) and carries no
> console block.

**13 pages.** [Phase 1](../phase-1-type-vocabulary/README.md) gave you unions.
A union is unusable until you can tell the compiler which member you are holding
— and that is this phase. It is also the single most common source of the
question *"why is this still possibly `undefined`?"*, which almost always has the
same answer: the narrowing was real, and then something threw it away.

The mental model worth carrying: **the compiler reads your `if` statements.**
Control flow analysis walks each branch and keeps a *narrowed* type for every
reference along it. Everything in this phase is either a way to create one of
those narrowings, or a way to lose one.

| # | Page | Tier | What it settles |
|---|---|---|---|
| 01 | [`typeof` narrowing](./01-typeof-narrowing.md) | <span className="db-tier t-master">Master</span> | The six results, and the `typeof null === 'object'` hole inherited from JavaScript |
| 02 | [Truthiness and equality](./02-truthiness-and-equality.md) | <span className="db-tier t-master">Master</span> | `if (x)` and `x != null` produce **identical types** — so the `''`/`0` bug is invisible |
| 03 | [`in` operator narrowing](./03-in-operator-narrowing.md) | <span className="db-tier t-understand">Understand</span> | Discriminating by property presence when there is no tag to check |
| 04 | [`instanceof` narrowing](./04-instanceof-narrowing.md) | <span className="db-tier t-understand">Understand</span> | Prototype chains, why it fails across realms and duplicate bundles |
| 05 | [Discriminated unions](./05-discriminated-unions.md) | <span className="db-tier t-master">Master</span> | A literal tag on every member — the most valuable modelling pattern in the language |
| 06 | [Exhaustiveness with `never`](./06-exhaustiveness.md) | <span className="db-tier t-master">Master</span> | The `assertNever` default that turns a new variant into a compile error |
| 07 | [User-defined type guards](./07-type-guards.md) | <span className="db-tier t-master">Master</span> | `v is T`, and the fact that the compiler **trusts you** rather than checking the body |
| 08 | [`as` assertions](./08-as-assertions/README.md) *(2 chunks)* | <span className="db-tier t-understand">Understand</span> | What a cast actually does — silence the checker — and the `as unknown as T` escape |
| 09 | [Assertion functions](./09-assertion-functions/README.md) *(2 chunks)* | <span className="db-tier t-understand">Understand</span> | `asserts v is T`, and the explicit-annotation requirement that catches everyone once |
| 10 | [`satisfies`](./10-satisfies/README.md) *(2 chunks)* | <span className="db-tier t-master">Master</span> | Check a value against a type **without** widening it |
| 11 | [Narrowing you lose without noticing](./11-narrowing-lost.md) | <span className="db-tier t-master">Master</span> | Callbacks, reassignment, mutable properties — and what `await` actually does |
| 12 | [`unknown` in `catch`](./12-unknown-in-catch.md) | <span className="db-tier t-understand">Understand</span> | JavaScript can throw anything, so every handler starts by proving what it caught |
| 13 | [The non-null assertion `!`](./13-non-null-assertion.md) | <span className="db-tier t-know">Know</span> | When it is legitimate, and why it is usually a missing guard in disguise |

## The technique behind every claim here

You cannot photograph a type. Hover tooltips are editor tooling, not the
compiler, and they are the wrong evidence for a written claim.

So the pages in this phase **make the compiler say the type out loud**:

```ts
if (typeof v === 'string') {
  const r: 1 = v;   // error TS2322: Type 'string' is not assignable to type '1'.
}
```

Assign the narrowed value to the literal type `1`. Nothing is assignable to `1`
except `1`, so the assignment always fails — and the failure message names the
exact type the checker is holding at that point. Every narrowing claim on pages
01–07 and 09–11 is backed that way.

## What the measurements changed

Three results from `sandbox/ts-p2/` were not what the page drafts said:

1. **Truthiness and `!= null` produce identical narrowed types.** `if (v)` and
   `if (v != null)` on `string | number | string[] | null` both leave
   `string | number | string[]`. The compiler cannot see the difference, so the
   classic empty-string/zero bug is a *logic* error the type system will never
   report. That is page 02's centrepiece.
2. **`typeof v === 'object'` narrows to `string[] | null`** — `null` is still in
   there, because `typeof null === 'object'` is a JavaScript wart the checker
   models faithfully rather than fixing.
3. **Narrowing survived an `await` and was lost in a callback.** The `ex2` script
   was written expecting both to lose it; only the `forEach` line raised
   `TS18047`. Page 11 is built around *why* the two differ, and a claim already
   shipped on [phase 1 page 10](../phase-1-type-vocabulary/10-null-and-undefined.md)
   was corrected because of it.

## Phase gate

Move on when you can take a union of four API response shapes and handle every
case with **zero assertions**, and make adding a fifth shape break the build.

If you reach for `as` or `!` to get past a "possibly undefined", stop — that is
the signal you have not finished this phase, not that TypeScript is being
awkward.

## Where this connects

- **← Phase 1 (The type vocabulary)** — unions, `unknown` and optional properties
  are the raw material. This phase is what makes them usable.
- **→ Phase 3 (Generics)** — a constrained type parameter narrows in the same
  way, and `keyof` guards are type predicates over keys.
- **→ Phase 5 (Type-level programming)** — conditional types are narrowing moved
  from control flow into the type system itself.
- **→ Phase 9 (Types at the boundary)** — narrowing is the *static* half of
  trusting data. Runtime validation is the other half, and a type guard that
  lies is exactly where the two come apart.
- **→ Phase 10 (Strictness)** — `useUnknownInCatchVariables` and
  `noUncheckedIndexedAccess` both exist to force narrowing where it was being
  skipped.

## Sandbox

`sandbox/ts-p2/` — `ex1-narrowing-basics.sh` (the six `typeof` results,
truthiness vs `!= null`, `Array.isArray`) and `ex2-guards-and-loss.sh` (`in`,
`instanceof`, predicates, assertion functions, and the four ways a narrowing
disappears). `npm install`, then run either script directly.

**Pages 08, 12 and 13 carry no console block.** Nothing in the recorded runs
covers them, and under the no-new-sandboxes rule a plausible-looking `tsc` error
written from memory is not evidence.

---

← [Phase 1](../phase-1-type-vocabulary/README.md) · Next → [01 · `typeof` narrowing](./01-typeof-narrowing.md)
