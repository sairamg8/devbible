---
title: "Recursive types"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-know">Know</span>

:::info Topic in progress
**Chunks 01 and 02 are written.** Chunks 03, 04 and 05 are planned and not yet written —
they are referred to as plain text until they land. ⚠️ The plan grew from three chunks to
five when chunk 02's draft came in at **349 lines**: it was **split on a concept boundary,
not trimmed**, and the remaining material earned two chunks of its own rather than being
compressed into one.
:::

> Verified: 2026-08. 🔴 **The recursion limits were read out of the compiler's own source** —
> **TypeScript 5.9.3**, `sandbox/ts-p0/node_modules/typescript5/lib/typescript.js`: the
> `while (true)` loop in `getConditionalType`, its `tailCount === 1e3` guard, the `tailCount++`
> that fires only for a **named** alias, and the bail-out when a distributive root's check type
> has become a union. The nesting limit (`instantiationDepth === 100`) comes from the same read,
> via [topic 09 · chunk 01](../09-type-level-performance/01-the-three-budgets.md). Recursive
> conditional types and their history are from the **4.1** and **4.5 release notes**.
> ⚠️ **Constants are 5.9.3's and are not claimed for the 7.0.2 Go port.** **No sandbox, no
> console block, no timings.**

Recursive **data** types — JSON, trees, linked structures — are
[phase 1 · topic 15](../../phase-1-type-vocabulary/15-recursive-types.md). This topic is
recursion as **computation**: a type that walks a structure and produces a different one.

| # | Chunk | What it settles |
|---|---|---|
| 01 | [The two limits](./01-the-two-limits.md) | 🔴 **100 for nested recursion, 1,000 for tail recursion** — the loop that makes the difference, the three conditions for staying on the fast path, and the eyeball test for tail position |
| 02 | [The accumulator pattern](./02-the-accumulator-pattern.md) | The conversion itself, in the release notes' own words — the five-step recipe, the three seeds (`never`, `""`, `[]`), and why a type whose input never shrinks needs a counter |
| 03 | [Order and position](./03-order-and-position.md) | Why the conversion reverses tuples and strings but not unions, what may wrap in the base branch (and should), how free the argument list really is, and the nine-shape eyeball table |
| 04 | [The fine print](./04-the-fine-print.md) | 🔴 **A third ceiling — 10,000 tuple elements, `TS2799`/`TS2800`, checked at the spread and unrelated to recursion depth** — plus the public-alias split as a correctness issue, iterations against cost, and the three shapes no accumulator can reach |
| 05 | **Capping depth deliberately** *(not written yet)* | The counter tuple, whether the cap errors or stops, and the circularity diagnostics |

## The one-sentence version

**There are two recursion ceilings an order of magnitude apart, both reported as `TS2589`**, and
which one you get depends on whether the recursive call is the branch's entire result.

## The three sentences to keep

1. **`getConditionalType` is a loop, not a recursive function.** A tail call re-enters it instead
   of stacking an instantiation, so `instantiationDepth` never climbs and the ceiling is
   `tailCount` — 1,000 instead of 100.
2. 🔴 **Distribution bails out of that loop.** `[T] extends [[…]]` keeps the union whole and keeps
   you on the 1,000 path, so the bracket form is a *performance* tool as well as a correctness one.
3. 🔴 **`tailCount` only counts tail calls to a named alias**, which is the third independent
   reason to name helper types — after caching and error messages.

## Where this connects

- **← [Phase 1 · Recursive types](../../phase-1-type-vocabulary/15-recursive-types.md)** —
  recursive *data*: JSON, trees, interfaces that recurse. Assumed here, not repeated.
- **← [05 · Distributive conditional types](../05-distributive-conditionals.md)** — the bracket
  form, introduced there for correctness and load-bearing here for the tail-call path.
- **← [09 · Type-level performance](../09-type-level-performance/README.md)** — the budgets these
  limits are drawn against, and why an uncapped recursive type has a profile you did not choose.
- **← [01 · Mapped types · chunk 04](../01-mapped-types/04-limits.md)** — `TS2615`, and why
  circularity is a different failure from a depth limit.
- **→ 12 · `DeepPartial` / `DeepReadonly`** *(not written yet)* — recursion over *objects*, where
  each property is its own branch, so the work fans out rather than advancing.
- **→ 13 · Tuple manipulation** *(not written yet)* — the variadic patterns the accumulator
  conversion is built from.

---

← [Phase 5 index](../README.md) · Next → [01 · The two limits](./01-the-two-limits.md)
