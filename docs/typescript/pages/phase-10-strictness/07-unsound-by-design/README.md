---
title: "Where TypeScript is unsound by design"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the **TypeScript Design Goals**, whose *Non-goals*
> list states the position outright — *"Apply a sound or 'provably correct' type
> system. Instead, strike a balance between correctness and productivity."* —
> the **TypeScript handbook** on structural typing, type assertions and the
> method-syntax exemption, **`lib.es5.d.ts`** and **`lib.es2017.object.d.ts`**
> read directly for `Object.keys` / `Object.entries`, and the **compiler's own
> option table** for `strictFunctionTypes` (`strictFlag: true`).
> **No sandbox, no console block on any chunk.**

The map of where the compiler stops protecting you. Five chunks:

> **TypeScript's unsoundness is a stated non-goal, not an unfixed bug.** A value
> typed `T` is not guaranteed to be a `T` at runtime, and never will be — so the
> useful question is never *whether*, it is **where**, and that list is short
> enough to learn.
>
> **Of the seven holes, three are ones you write** (`any`, `as`, `!`) and are the
> only ones that appear in a diff — which is why every migration metric in this
> phase counts assertions. **Two more are closable by a flag** this phase has
> already sold you.
>
> 🔴 **That leaves two nobody opts into and no flag removes: mutation through an
> alias, and method parameter bivariance.** Both produce a runtime `TypeError`
> from code where every line type-checks. They are the two to memorise, and both
> have free mitigations that almost no team applies.
>
> **`Object.keys` returning `string[]` is not an oversight** — a `keyof T` return
> would be a *larger* unsoundness, because structural typing lets a value carry
> properties its type never declared.

| # | Chunk | What it covers |
|---|---|---|
| 01 | [What unsound means](./01-what-unsound-means.md) | The definition and the Design Goals position; why the trade was made; the three-way split between a compiler bug, a deliberate hole and a missing flag; the seven-hole table with a *closable?* column; how to use the list rather than memorise it |
| 02 | [The holes you opt into](./02-the-holes-you-opt-into.md) | `any`, `as` and `!`; why an assertion is not a cast; `as unknown as T` as a distinct construct deserving a comment; `satisfies` as the sound alternative most `as` uses actually wanted; why these three are the only holes you can put a number on; when each is genuinely correct |
| 03 | [The holes in your data](./03-the-holes-in-your-data.md) | Index access and object-spread-over-optionals, both closable, and 🔴 **why a flag's fix is usually to remove a possible input rather than add a check**; `Object.keys` read from `lib.es5.d.ts`, why `string[]` is the honest answer, and the four things to do instead |
| 04 | [Mutation and variance](./04-mutation-and-variance.md) | Array covariance demonstrated end to end with no assertion; aliasing away `readonly`, and why `readonly T[]` behaves better than a `readonly` property; method bivariance — the debt owed by topic 01 — and why the exemption exists *for* array covariance; the shared failure signature |
| 05 | [Working with the holes](./05-working-with-the-holes.md) | All eight rows with their honest mitigation and cost; **validate at the edge, once, and type the result**; ⚠️ the three holes that live entirely inside validated code and are untouched by it; a six-question review checklist; the position to hold when someone says types are pointless |

## Phase gate

You are done with this topic when you can **write an unsound program using only
classes and arrays — no `any`, no `as`** — explain why `Object.keys` returning
`(keyof T)[]` would be worse than `string[]`, and name the two holes that are
neither opt-in nor closable by a flag.

The tell that it has not landed: treating the list as an argument against
TypeScript. Five of the eight mitigations cost essentially nothing, and two of
those improve the code independently of soundness.

## Where this connects

- **← [01 · `strict` flag by flag](../01-strict-flag-by-flag/03-the-other-eight.md)**
  — `strictFunctionTypes`' method-syntax exemption, introduced there and
  catalogued here.
- **← [02 · `noUncheckedIndexedAccess`](../02-nouncheckedindexedaccess.md)** — the
  flag that narrows hole 4, and its own admission that it *"narrows the soundness
  gap rather than closing it"*.
- **← [03 · Containing `any`](../03-containing-any.md)** — hole 1 in full, and the
  `no-unsafe-*` family for the `any` nobody wrote.
- **← [05 · `exactOptionalPropertyTypes`](../05-exactoptionalpropertytypes/03-spread-defaults-and-construction.md)**
  — where the object-spread hole is proved in four lines, and the flag that
  closes it.
- **← [Phase 2 · `satisfies`](../../phase-2-narrowing/10-satisfies/README.md)** and
  [Type guards](../../phase-2-narrowing/07-type-guards.md) — the two sound
  alternatives to an assertion.
- **← [Phase 2 · The non-null assertion](../../phase-2-narrowing/13-non-null-assertion.md)**
  — hole 3, argued where it lives.
- **← [Phase 7 · Typing `process.env`](../../phase-7-server/03-typing-process-env/README.md)**
  and [`catch (e: unknown)`](../../phase-7-server/04-catch-e-unknown/README.md) —
  the two worked examples of validating at the edge.
- **→ 09 · Excess property checks vs assignability** *(not written yet)* — the
  heuristic that catches an extra property on a literal and not on a variable,
  which is why `Object.keys` cannot promise `keyof T`.
- **→ 12 · Assertion discipline** *(not written yet)* — holes 1–3 as a process
  problem rather than a type-system one.

---

← [Phase 10 index](../README.md) · Start → [01 · What unsound means](./01-what-unsound-means.md)
