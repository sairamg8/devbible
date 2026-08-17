---
title: "Recursion as computation, and the two limits"
sidebar_label: "01 · The two limits"
sidebar_position: 1
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08. 🔴 **The two limits and the tail-call condition were read out of the
> compiler's own source** — **TypeScript 5.9.3**,
> `sandbox/ts-p0/node_modules/typescript5/lib/typescript.js`: the `while (true)` loop in
> `getConditionalType` with its `tailCount === 1e3` guard, the `tailCount++` that fires **only
> when the tail call is to a named alias**, and the bail-out when a distributive root's check
> type has become a union. The nesting limit (`instantiationDepth === 100`) is
> [topic 09 · chunk 01](../09-type-level-performance/01-the-three-budgets.md)'s, from the same
> read. Recursive **conditional** types and their history are from the **4.1** and **4.5
> release notes**. ⚠️ **Constants are 5.9.3's and are not claimed for the 7.0.2 Go port.**
> **No sandbox, no console block, no timings.**

Recursive **data** types — JSON, trees, linked structures — are
[phase 1 · topic 15](../../phase-1-type-vocabulary/15-recursive-types.md), and that page is not
repeated here.

This topic is recursion as **computation**: a type that walks a structure and produces a
different one. And the single most useful thing to know about it is that **there are two
recursion limits, an order of magnitude apart, and which one you get depends on how you wrote
the type.**

## The two limits

| Recursion shape | Limit | Diagnostic |
|---|---|---|
| **Nested** — the recursive call is inside another type | **100** instantiation levels | `TS2589` |
| **Tail** — the recursive call *is* the branch's result | **1,000** iterations | `TS2589` |

Same message, ten times the headroom. The mechanism is in `getConditionalType`, which is not
recursive at all but a **loop**:

```js
// TypeScript 5.9.3, getConditionalType
let tailCount = 0;
while (true) {
  if (tailCount === 1e3) {
    error2(currentNode, Diagnostics.Type_instantiation_is_excessively_deep_and_possibly_infinite);
    return errorType;
  }
  // … resolve checkType and extendsType, pick a branch …
}
```

When the chosen branch turns out to be *another conditional type*, the compiler **re-enters the
loop instead of nesting an instantiation** — tail-call elimination, shipped in **4.5**. Nothing
is stacked, so `instantiationDepth` does not climb, and the only ceiling is `tailCount`.

> 🔴 **This is why "rewrite it with an accumulator" is not folklore.** Moving the recursive call
> into tail position changes which counter you are spending, and the two counters differ by 10×.

## What counts as a tail call — three conditions, all readable

From the same function, the loop continues only when the branch's type:

1. **is itself a conditional type** with outer type parameters — i.e. a call to another generic
   conditional alias, not an object wrapping one;
2. **is not a distributive root whose check type has become a union or `never`** — if it is, the
   optimisation bails and the work goes back to nesting; and
3. 🔴 **`tailCount` only increments `if (newRoot.aliasSymbol)`** — the tail call must be to a
   **named** type alias.

Point 2 is the trap that costs people the whole benefit:

```ts
// ❌ distributes on every step, so the tail-call path bails
type Walk<T> = T extends [infer H, ...infer R] ? Walk<R> : Done<T>;

// ✅ keeps the union whole, staying in the loop
type Walk2<T> = [T] extends [[infer H, ...infer R]] ? Walk2<R> : Done<T>;
```

The bracket form is [topic 05](../05-distributive-conditionals.md)'s tool, introduced there for
*correctness*. Here it is also what keeps you on the 1,000 path — the same syntax buying two
unrelated things.

📌 **Point 3 is the second reason naming matters**, after
[topic 09 · chunk 02](../09-type-level-performance/02-caching-and-naming.md)'s caching argument.
An inline conditional cannot be a counted tail call.

## What the shape looks like in each case

```ts
// NESTED — the recursive result is wrapped, so each step stacks. Ceiling ~100.
type Flatten<T> = T extends readonly (infer E)[] ? [Flatten<E>] : T;
//                                                 ^^^^^^^^^^^ inside a tuple

// TAIL — the recursive call IS the result. Ceiling ~1,000.
type Length<T extends readonly unknown[], Acc extends 1[] = []> =
  T extends readonly [unknown, ...infer R] ? Length<R, [...Acc, 1]> : Acc["length"];
//                                           ^^^^^^^^^^^^^^^^^^^^^ nothing around it
```

**The test is mechanical:** if the recursive call has *anything* around it in the branch — a
tuple, an object, a union, another utility — it is not a tail call. `[...Acc, 1]` is an argument
being built, not a wrapper around the call, which is why the accumulator pattern works.

That conversion is **chunk 02 · The accumulator pattern** *(not written yet)*.

## Neither limit is the one you should be relying on

Both ceilings are the compiler's, not yours, and hitting either is
[topic 09 · chunk 03](../09-type-level-performance/03-what-makes-it-slow.md)'s uncapped-recursion
shape: **a performance profile you did not choose.** A deliberate depth cap is
**chunk 03 · Capping depth deliberately** *(not written yet)*.

⚠️ **And 1,000 is a limit on *iterations*, not on cost.** A tail-recursive type that survives 900
iterations is still doing 900 instantiations against the five-million count budget
([topic 09 · chunk 01](../09-type-level-performance/01-the-three-budgets.md)), per use, in every
file that uses it.

## Gotchas

**Symptom:** `TS2589` at around a hundred elements, when you expected a thousand.
**Cause:** The recursion is nested, not tail — something wraps the recursive call.
**Fix:** Convert to an accumulator so the call is the branch's whole result
(**chunk 02**, *not written yet*).

**Symptom:** You converted to an accumulator and the ceiling did not move.
**Cause:** The conditional distributes, so the tail-call path bails out.
**Fix:** Wrap both sides in tuples — `[T] extends [[…]]` — to keep the union whole.

**Symptom:** An inline recursive conditional behaves worse than the same logic as a named alias.
**Cause:** `tailCount` increments only for a **named** alias; an anonymous tail call is not on
that path.
**Fix:** Name it. This is the third independent reason to.

**Symptom:** The type works on your test tuple of ten and fails on real data.
**Cause:** Either ceiling, reached by input you did not have.
**Fix:** Cap the depth deliberately and decide what happens at the cap.

**Symptom:** Deep recursion succeeds but the editor becomes sluggish in every consuming file.
**Cause:** 1,000 iterations is still 1,000 instantiations, re-done per unit of work.
**Fix:** Reduce the iterations, or resolve the type once at a boundary and export the result.

**Symptom:** `TS2615` — *"Type of property `'{0}'` circularly references itself in mapped type
`'{1}'`"*.
**Cause:** Not a depth problem at all: the definition refers to itself at the same level.
**Fix:** [Topic 01 · chunk 04](../01-mapped-types/04-limits.md) has the shapes; a named
intermediate or an interface breaks the cycle.

**Symptom:** Recursion over an object type hits the limit far sooner than over a tuple.
**Cause:** Each property is its own recursive branch, so the work multiplies rather than adding.
**Fix:** Expect object recursion to be the expensive kind — that is topic 12's subject for
`DeepPartial`.

## Interview questions

**★ How deep can a recursive type go?**
Two different answers, and knowing which applies is the point. Nested recursion — where the
recursive call sits inside another type — is bounded by the instantiation depth of **100**. A
**tail-recursive** conditional, where the call is the branch's entire result, is evaluated by a
loop in `getConditionalType` rather than by nesting, and its ceiling is `tailCount === 1000`.
Same `TS2589` message, ten times the headroom.

**★ Why does the accumulator rewrite actually raise the limit?**
Because it moves the recursive call into tail position, and tail calls are re-entered through a
`while` loop instead of stacking an instantiation. So `instantiationDepth` stops climbing and
the only counter being spent is `tailCount`, which allows 1,000. It is a change of which budget
you are consuming, not a micro-optimisation.

**★ What stops a conditional type from getting the tail-call treatment?**
Three things, all in the compiler's continue condition: the branch must be another conditional
with outer type parameters; it must **not** be a distributive root whose check type has become a
union or `never` — distribution bails out of the loop; and the tail call must be to a **named**
alias, because `tailCount` only increments when `newRoot.aliasSymbol` exists. So `[T] extends
[…]` and naming your helper are both load-bearing.

**★ How do you tell by eye whether a recursive call is in tail position?**
Look at what surrounds it in the branch. If the call is wrapped in anything — a tuple, an object
literal, a union, another utility type — it is nested. `? Walk<R>` is tail; `? [Walk<R>]` is not.
Arguments *to* the call, including a growing accumulator like `[...Acc, 1]`, do not count as
wrapping, which is exactly why the accumulator pattern is the standard conversion.

**Is 1,000 iterations "enough"?**
For lengths and paths, usually. But it is a limit on *iterations*, not on cost: 900 iterations is
900 instantiations counted against the five-million budget, incurred per use and re-done in every
consuming unit of work. A type that only just fits is one that will be slow everywhere it is
used, and it will fail on the first input that is slightly deeper.

**What is the difference between `TS2589` and `TS2615` in a recursive type?**
`TS2589` is a limit — the compiler could keep going and has decided not to. `TS2615` is a
structural impossibility: the definition refers to itself at the same level, so there is nothing
to compute. The first is fixed with an accumulator or a cap; the second needs the cycle broken,
usually with a named intermediate or an interface.

**Why is recursion over an object type worse than over a tuple?**
Because each property is a separate recursive branch, so the work at each level is multiplied by
the property count rather than advanced by one. Tuple recursion consumes its input one element at
a time; object recursion fans out. That is why the deep-object helpers are their own topic, and
why they are the usual source of `TS2589` in application code.

---

← [Topic index](./README.md) · Next → **02 · The accumulator pattern** *(not written yet)*
