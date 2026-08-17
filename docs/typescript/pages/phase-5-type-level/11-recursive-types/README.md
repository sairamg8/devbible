---
title: "Recursive types"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-know">Know</span>

:::info Topic in progress
**Chunk 01 is written.** Chunks 02 (the accumulator pattern) and 03 (capping depth
deliberately) are planned and not yet written — they are referred to as plain text until they
land.
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
| 02 | **The accumulator pattern** *(not written yet)* | Converting nested recursion to tail position; tuple and string accumulators |
| 03 | **Capping depth deliberately** *(not written yet)* | The counter tuple, whether the cap errors or stops, and the circularity diagnostics |

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
