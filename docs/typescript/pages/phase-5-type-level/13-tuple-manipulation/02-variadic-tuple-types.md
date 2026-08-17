---
title: "Variadic tuple types"
sidebar_label: "02 · Variadic tuple types"
sidebar_position: 2
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08 against the **TypeScript 4.0 release notes**, *Variadic Tuple Types* —
> the `tail`, `concat` and `Unbounded` examples below are the notes' own, quoted verbatim,
> as is the sentence stating the unbounded rule. **No sandbox, no console block, no
> timings.**

[Chunk 01](./01-the-accessors.md) used variadic patterns to take tuples apart. This chunk is
the feature itself — what 4.0 actually changed, and the one rule about it that produces
surprises.

The notes are explicit that it is **two** changes, not one.

## Change 1 — spreads in tuple types can be generic

> The first change is that spreads in tuple type syntax can now be generic. This means that
> we can represent higher-order operations on tuples and arrays even when we don't know the
> actual types we're operating over.

```ts
function tail<T extends any[]>(arr: readonly [any, ...T]) {
  const [_ignored, ...rest] = arr;
  return rest;
}

const myTuple = [1, 2, 3, 4] as const;
const myArray = ["hello", "world"];

const r1 = tail(myTuple);
// const r1: [2, 3, 4]

const r2 = tail([...myTuple, ...myArray] as const);
// const r2: [2, 3, 4, ...string[]]
```

📌 **Read `r2` carefully — it is the whole feature in one line.** The result is a tuple with
three known literal elements followed by an unbounded `string[]` tail. Neither "a tuple" nor
"an array" describes that; it is a tuple *type* with a spread inside it, and before 4.0 there
was no way to write it.

## Change 2 — a rest element can appear anywhere

> The second change is that rest elements can occur anywhere in a tuple - not just at the
> end!

```ts
type Strings = [string, string];
type Numbers = [number, number];
type StrStrNumNumBool = [...Strings, ...Numbers, boolean];
```

> Previously, TypeScript would issue an error like the following:
>
> ```
> A rest element must be last in a tuple type.
> ```
>
> But with TypeScript 4.0, this restriction is relaxed.

This is what makes `Last` and `Init` expressible ([chunk 01](./01-the-accessors.md)), and it
is what makes "insert in the middle" a pattern rather than a recursion.

## 🔴 The rule that catches everyone

> Note that in cases when we spread in a type without a known length, the resulting type
> becomes unbounded as well, and all the following elements factor into the resulting rest
> element type.

```ts
type Strings = [string, string];
type Numbers = number[];
type Unbounded = [...Strings, ...Numbers, boolean];
```

**One unbounded spread makes everything after it unbounded.** `Unbounded` is not "two
strings, some numbers, then a boolean" — the compiler cannot know where the numbers stop, so
the boolean is absorbed into the rest element and the positional information after the spread
is gone.

The consequence is a rule with no exceptions worth remembering:

🔴 **Positions before an unbounded spread survive. Positions after it do not.** So a signature
that needs to know its last parameter — a callback, an options object — must not put an
unbounded spread in front of it, or the knowledge is destroyed at the type level while the
code still looks correct.

⚠️ **This is the failure mode of "just spread the array in".** Mixing a tuple with a plain
array in one tuple type looks harmless and silently converts the precise half into the
imprecise one.

## `concat`, and why one signature beats fourteen

With both changes, the notes give the signature that replaced the overload pile from
[chunk 01](./01-the-accessors.md):

```ts
type Arr = readonly any[];

function concat<T extends Arr, U extends Arr>(arr1: T, arr2: U): [...T, ...U] {
  return [...arr1, ...arr2];
}
```

> While that one signature is still a bit lengthy, it's just one signature that doesn't have
> to be repeated, and it gives predictable behavior on all arrays and tuples.

📌 **`readonly any[]` as the constraint is deliberate.** It accepts tuples, arrays, mutable
and readonly alike — the widest bound that still says "this is a list". Constraining to
`unknown[]` instead rejects readonly inputs, which is the same `as const` trap
[chunk 01](./01-the-accessors.md) flagged for patterns.

## Building tuples, not just taking them apart

The same syntax composes in the other direction, and these are the four moves worth knowing:

```ts
type Push<T extends readonly unknown[], V> = [...T, V];
type Unshift<T extends readonly unknown[], V> = [V, ...T];
type Concat<A extends readonly unknown[], B extends readonly unknown[]> = [...A, ...B];
type Replace1<T extends readonly [unknown, ...unknown[]], V> =
  T extends readonly [unknown, ...infer R] ? [V, ...R] : never;
```

None of them needs recursion. That matters: a `Push` written as a recursive walk costs an
instantiation per element and hits
[topic 11 · chunk 04](../11-recursive-types/04-the-fine-print.md)'s ceilings; written as a
spread it is one step regardless of length.

🔴 **If an operation can be expressed as a spread, it should be.** Recursion is for
operations whose shape depends on the elements — filtering, mapping with a per-element
decision, anything conditional. Structural surgery on a tuple usually is not one of those.

## Gotchas

**Symptom:** A tuple type lost all its positions after a spread.
**Cause:** Something unbounded was spread in earlier — an array rather than a tuple — and
everything after it was absorbed into the rest element.
**Fix:** Put unbounded spreads last, or keep the precise part in its own type and combine at
the call site rather than in the type.

**Symptom:** `concat` rejects an `as const` argument.
**Cause:** The constraint is `unknown[]` rather than `readonly unknown[]`.
**Fix:** Constrain with `readonly any[]` or `readonly unknown[]`. The release notes' own
`Arr` alias uses `readonly any[]` for exactly this reason.

**Symptom:** A helper written as a recursive `Push` is slow on long tuples.
**Cause:** It is doing an instantiation per element for something that is one spread.
**Fix:** `[...T, V]`. Recursion is for element-dependent operations, not structural ones.

**Symptom:** *"A rest element must be last in a tuple type"* on a modern compiler.
**Cause:** Not the 4.0 restriction — that is relaxed. Usually **two** rest elements in one
tuple, which is still an error because the boundary between them would be undecidable.
**Fix:** One unbounded spread per tuple type. If you genuinely need two, the shape is a
nested tuple, not a flat one.

**Symptom:** Spreading a generic parameter produced `unknown[]` instead of the tuple.
**Cause:** The parameter was constrained to `unknown[]` and inference widened it to an array
because there was no `const` context at the call site.
**Fix:** `as const` at the call site, or a `const` type parameter
([phase 3 · topic 12](../../phase-3-generics/12-const-type-parameters/README.md)) so the literal
tuple is inferred rather than the array.

**Symptom:** A function's return type is right for tuples and useless for arrays.
**Cause:** `[...T, U]` over an array `T` is an array — correct, and not what the tuple case
suggested.
**Fix:** Expected behaviour. If both must work precisely, that is two overloads, and here
that is the right answer rather than a defeat.

**Symptom:** The result of a spread has a label you did not write.
**Cause:** Labels propagate through spreads; that is deliberate and it is
[chunk 03 · Labels, optionality and the spread rule](./03-labels-and-optionality.md)'s subject.
**Fix:** Nothing — it is the feature working.

## Interview questions

**★ What two things did TypeScript 4.0 change about tuple types?**
Spreads in tuple type syntax became **generic**, so `[any, ...T]` is expressible with `T` a
type parameter — that is what lets one signature describe operations over unknown tuples. And
a **rest element may appear anywhere** in a tuple, not only at the end, which lifted the
*"A rest element must be last in a tuple type"* error. The accessors `Last` and `Init` exist
because of the second change; `concat` and `tail` because of both.

**★ What happens when you spread an unbounded type into the middle of a tuple?**
Everything after it becomes part of the rest element. The notes state it directly: when you
spread in a type without a known length, the resulting type becomes unbounded and all
following elements factor into the rest element type. So `[...Strings, ...Numbers, boolean]`
with `Numbers = number[]` does not have a boolean in a known position — positions before an
unbounded spread survive, positions after it do not.

**★ Write `concat` with one signature.**
`function concat<T extends readonly any[], U extends readonly any[]>(a: T, b: U): [...T, ...U]`.
The constraint has to include `readonly` or `as const` arguments are rejected, and the return
type is a spread rather than `Array<T[number] | U[number]>` — which is the version that
discards the lengths and the order.

**★ When should a tuple operation be recursive and when a spread?**
A spread when the operation is structural — push, unshift, concatenate, replace a known
position — because that is one step regardless of length. Recursion only when the result
depends on the elements themselves: filtering, per-element conditionals, anything that has to
look at each one. Writing `Push` recursively costs an instantiation per element and moves you
toward the ceilings for no benefit.

**★ Why does the release notes' `Arr` alias use `readonly any[]`?**
Because it is the widest bound that still means "a list": it accepts tuples and arrays,
mutable and readonly. Constraining to `unknown[]` excludes readonly inputs, and readonly
inputs are exactly what `as const` produces — so the narrower constraint rejects the most
precisely-typed arguments a caller can offer.

**Can a tuple type have two rest elements?**
No, and that restriction survives 4.0. With two unbounded spreads there is no way to decide
where one ends and the next begins, so the type would be ambiguous rather than merely
imprecise. One unbounded spread per tuple; if you need two lists, keep them as two types.

**What does `tail([...myTuple, ...myArray] as const)` return, and why is it interesting?**
`[2, 3, 4, ...string[]]` — three known literal elements followed by an unbounded tail. It is
interesting because it is neither a tuple nor an array in the old sense: the precise prefix
survives and the imprecise suffix is preserved as a spread, which is precisely the
representation that did not exist before 4.0.

---

← [01 · The accessors](./01-the-accessors.md) · [Topic index](./README.md) ·
Next → [03 · Labels, optionality and the spread rule](./03-labels-and-optionality.md)
