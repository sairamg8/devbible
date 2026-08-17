---
title: "The accessors, and the problem they replaced"
sidebar_label: "01 · The accessors"
sidebar_position: 1
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08 against the **TypeScript 4.0 release notes**, *Variadic Tuple Types* —
> the `concat` overload pile, the `tail` signature and the *"death by a thousand overloads"*
> framing are quoted verbatim from there. The `TS2799` tuple ceiling is
> [topic 11 · chunk 04](../11-recursive-types/04-the-fine-print.md)'s read of the **5.9.3**
> checker. **No sandbox, no console block, no timings.**

A tuple type is a list whose length and element positions are known, and every useful
operation on one is a way of taking it apart. This topic is those operations — and the four
accessors below are what everything else in it is built from.

## What this replaced, in the release notes' own words

The 4.0 notes open by typing `concat` the only way that was previously available:

```ts
function concat(arr1: [], arr2: []): [];
function concat<A>(arr1: [A], arr2: []): [A];
function concat<A, B>(arr1: [A, B], arr2: []): [A, B];
function concat<A, B, C>(arr1: [A, B, C], arr2: []): [A, B, C];
function concat<A, B, C, D>(arr1: [A, B, C, D], arr2: []): [A, B, C, D];
function concat<A, B, C, D, E>(arr1: [A, B, C, D, E], arr2: []): [A, B, C, D, E];
function concat<A, B, C, D, E, F>(arr1: [A, B, C, D, E, F], arr2: []): [A, B, C, D, E, F];
```

> Uh…okay, that's…seven overloads for when the second array is always empty.

and, after another seven for a one-element second argument:

> We hope it's clear that this is getting unreasonable. […] This is another case of what we
> like to call "death by a thousand overloads", and it doesn't even solve the problem
> generally. It only gives correct types for as many overloads as we care to write.

The catch-all they reject is the one people still reach for:

```ts
function concat<T, U>(arr1: T[], arr2: U[]): Array<T | U>;
```

> But that signature doesn't encode anything about the lengths of the input, or the order of
> the elements, when using tuples.

🔴 **That sentence is the whole justification for this topic.** Tuple manipulation is not
cleverness for its own sake — it is the difference between a signature that knows `[string,
number]` and one that only knows "an array of string-or-number". Length and order are the
information, and the naive signature throws both away.

## The four accessors

```ts
type Head<T extends readonly unknown[]> = T extends readonly [infer H, ...unknown[]] ? H : never;
type Tail<T extends readonly unknown[]> = T extends readonly [unknown, ...infer R] ? R : [];
type Last<T extends readonly unknown[]> = T extends readonly [...unknown[], infer L] ? L : never;
type Init<T extends readonly unknown[]> = T extends readonly [...infer I, unknown] ? I : [];
```

| | Takes | Empty input gives |
|---|---|---|
| `Head<T>` | the first element | `never` |
| `Tail<T>` | everything after the first | `[]` |
| `Last<T>` | the final element | `never` |
| `Init<T>` | everything before the last | `[]` |

Two decisions are encoded there and both are worth making on purpose.

**`readonly` on the pattern, not on the input only.** `T extends readonly [...]` matches
*both* mutable and readonly tuples, because a mutable tuple is assignable to the readonly
form. Writing the pattern without `readonly` makes the accessor silently fail on
`as const` data — which is exactly the data most likely to be a tuple.

**`never` for an element, `[]` for a list.** An empty tuple has no first element, so `Head<[]>`
has no answer and `never` says so. It *does* have an empty tail, so `Tail<[]>` is `[]` rather
than `never`. Returning `never` for both would make `Tail` poison every downstream
computation; returning `undefined` for `Head` would claim the element exists and is
`undefined`, which is a different and false statement.

## `Last` and `Init` only work because of 4.0

Both patterns put the rest element **first**, and before 4.0 that was an error:

```
A rest element must be last in a tuple type.
```

> But with TypeScript 4.0, this restriction is relaxed.

📌 **This is why `Last` is a one-liner today and was effectively unwritable before.** The
pre-4.0 workaround was to reverse the tuple and take the head — two traversals and a
recursive helper for something that is now a pattern match. If you meet that shape in an old
codebase, it is not a clever idiom; it is a workaround for a restriction that no longer
exists.

## `Length`, and why it is the odd one out

```ts
type Length<T extends readonly unknown[]> = T["length"];
```

No conditional, no `infer` — an indexed access. For a tuple, `T["length"]` is a **numeric
literal type**; for an array it is `number`. That single fact is what makes tuples usable as
counters, and it is the machinery behind
[topic 11 · chunk 02](../11-recursive-types/02-the-accumulator-pattern.md)'s accumulators and
[chunk 05](../11-recursive-types/05-capping-depth-deliberately.md)'s depth caps.

⚠️ **`Length<string[]>` is `number`, and that is not a failure** — it is the type system
correctly saying the length is not known statically. Code that branches on
`Length<T> extends 0` needs to consider the `number` case, because `number extends 0` is
false and the branch silently takes the wrong arm for every non-tuple array.

## Composing them

The accessors compose, and the composition is where the cost starts:

```ts
type Second<T extends readonly unknown[]> = Head<Tail<T>>;
type SecondToLast<T extends readonly unknown[]> = Last<Init<T>>;
```

Each layer is another conditional and another instantiation. For a fixed position this is
fine — but reaching for `Head<Tail<Tail<Tail<T>>>>` means the real operation is indexing, and
`T[3]` says it in one step with a better error message.

🔴 **The rule: use the accessors to take a tuple apart *recursively*, and indexed access to
reach a *fixed* position.** They look interchangeable and they are not — one is a loop, the
other is a lookup.

## Gotchas

**Symptom:** An accessor returns `never` for an `as const` tuple that clearly has elements.
**Cause:** The pattern omits `readonly`, so a readonly tuple does not match it.
**Fix:** `T extends readonly [infer H, ...unknown[]]`. Write every tuple pattern with
`readonly`; it costs nothing and matches strictly more inputs.

**Symptom:** `Tail<[]>` poisoned a whole computation with `never`.
**Cause:** The base case returns `never` rather than `[]`.
**Fix:** Return the empty tuple for list-shaped results and `never` only where an *element*
genuinely does not exist. The two failures behave completely differently downstream.

**Symptom:** `Length<T> extends 0` took the wrong branch for a plain array.
**Cause:** `Length<string[]>` is `number`, and `number extends 0` is false.
**Fix:** Handle the array case explicitly — `number extends Length<T> ? … : …` asks the
question the other way round and catches it.

**Symptom:** `Last` produces an error about rest elements in an older codebase.
**Cause:** The project is on a pre-4.0 compiler, where a rest element had to be last.
**Fix:** Nothing at the type level — the feature is the fix. Do not reimplement the
reverse-then-head workaround on a modern compiler.

**Symptom:** A chain of four accessors is slow and reports badly.
**Cause:** Each is a conditional instantiated per use; the chain multiplies them.
**Fix:** Use `T[3]` for a fixed position. Reserve the accessors for recursion, where the
position is not known.

**Symptom:** `Head<T>` on a union of tuples gives a union of first elements, unexpectedly.
**Cause:** The conditional distributes ([topic 05](../05-distributive-conditionals.md)).
**Fix:** Usually correct. Bracket it — `[T] extends [readonly [infer H, ...unknown[]]]` — if
you meant to ask about the union as a whole.

**Symptom:** An accessor works on `[string, number]` and fails on `(string | number)[]`.
**Cause:** An array has no known length, so no fixed-length pattern matches it.
**Fix:** Expected. If the input can be an array, decide what the accessor means for one and
write that branch; there is no correct default.

## Interview questions

**★ What problem did variadic tuple types solve?**
The one the 4.0 notes call "death by a thousand overloads". Before them, typing `concat`
meant writing an overload per input length — the notes show seven just for the case where the
second array is empty — and the general fallback,
`concat<T, U>(a: T[], b: U[]): Array<T | U>`, throws away exactly the information tuples
exist to carry: the lengths and the order. Variadic tuples let one signature encode both.

**★ Write `Head`, `Tail`, `Last` and `Init`.**
All four are pattern matches: `T extends readonly [infer H, ...unknown[]] ? H : never` for
`Head`, `readonly [unknown, ...infer R] ? R : []` for `Tail`, and the mirror images with the
rest element first for `Last` and `Init`. The two details that matter are `readonly` on every
pattern, so `as const` inputs match, and returning `never` for a missing *element* but `[]`
for a missing *list*.

**★ Why do `Last` and `Init` need TypeScript 4.0 specifically?**
Because they put the rest element at the front of the pattern, and before 4.0 the compiler
rejected that with *"A rest element must be last in a tuple type."* 4.0 relaxed the
restriction. The old workaround was to reverse the tuple and take its head, which is two
traversals and a recursive helper for what is now a single pattern.

**★ Why is `Length` written as an indexed access rather than a conditional?**
Because `T["length"]` is already the answer — a numeric literal type for a tuple, and
`number` for an array. That conversion from a tuple back to a number is what makes tuples
usable as counters, and it underpins every accumulator and depth cap in the phase. It also
means `Length<T> extends 0` quietly misbehaves for arrays, since `number extends 0` is false.

**★ When should you use an accessor and when indexed access?**
Accessors for recursion, indexed access for a fixed position. `Head<Tail<Tail<T>>>` and
`T[2]` produce the same type, but the first is three conditionals instantiated per use with a
correspondingly worse error message. If the position is a literal you typed, use the lookup.

**Why does `Head<[]>` return `never` while `Tail<[]>` returns `[]`?**
Because they are answering different kinds of question. There is no first element of an empty
tuple, and `never` is how the type system says "no such thing". There *is* an empty tail, and
it is `[]`. Returning `never` from `Tail` would propagate through every downstream operation;
returning `undefined` from `Head` would assert an element exists whose value is `undefined`,
which is false.

**What breaks if you leave `readonly` off a tuple pattern?**
Every `as const` input stops matching, so the accessor falls to its base case and returns
`never` or `[]` for a tuple that plainly has elements. Since `as const` is the most common
way to *get* a tuple type in the first place, the pattern without `readonly` fails on the
inputs it was written for.

---

[Topic index](./README.md) · Next → [02 · Variadic tuple types](./02-variadic-tuple-types.md)
