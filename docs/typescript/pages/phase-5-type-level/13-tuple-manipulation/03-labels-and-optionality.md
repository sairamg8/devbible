---
title: "Labels, optionality and the spread rule"
sidebar_label: "03 · Labels and optionality"
sidebar_position: 3
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08 against the **TypeScript 4.0 release notes**, *Labeled Tuple Elements* —
> every rule and example below is quoted from there. The spread-versus-rebuild argument is
> [topic 10 · chunk 02](../10-deriving-function-types/02-what-it-loses.md)'s, reused rather
> than re-derived; the mapped-type preservation is
> [topic 12 · chunk 01](../12-deep-helpers/01-the-naive-version.md)'s read of the **5.9.3**
> checker. **No sandbox, no console block, no timings.**

A tuple type carries three things beyond its element types: **labels**, **optional markers**
and **the rest element's position**. All three are easy to destroy by accident, and the
mechanism that destroys them is always the same one.

## Why labels exist at all

The 4.0 notes make the case from parameter lists rather than from data:

> Improving the experience around tuple types and parameter lists is important because it
> allows us to get strongly typed validation around common JavaScript idioms - really just
> slicing and dicing argument lists and passing them to other functions.

A tuple used as a rest parameter should be indistinguishable from a normal parameter list:

```ts
function foo(...args: [string, number]): void {
  // ...
}
```

> …should appear no different from the following function…

```ts
function foo(arg0: string, arg1: number): void {
  // ...
}
```

> There is one place where the differences begin to become observable though: readability.
> In the first example, we have no parameter names for the first and second elements. While
> these have no impact on type-checking, the lack of labels on tuple positions can make them
> harder to use - harder to communicate our intent.

Hence:

```ts
type Range = [start: number, end: number];
```

📌 **"No impact on type-checking" is the sentence to hold onto.** A label is documentation
that the tooling can see. It changes nothing about assignability — and that is exactly why
losing one is silent.

## The three rules

**1. The syntax mirrors parameter lists**, deliberately:

> To deepen the connection between parameter lists and tuple types, the syntax for rest
> elements and optional elements mirrors the syntax for parameter lists.

```ts
type Foo = [first: number, second?: string, ...rest: any[]];
```

**2. Label all or label none.**

> There are a few rules when using labeled tuples. For one, when labeling a tuple element,
> all other elements in the tuple must also be labeled.

```ts
type Bar = [first: string, number];
```

That is an error. ⚠️ **It is also the shape you produce by hand-editing one element of a
labelled tuple** — add a position, forget the name, and the whole type stops compiling. That
is the one loss in this chunk that is *not* silent, and it is the least costly for exactly
that reason.

**3. Labels do not bind names.**

> It's worth noting - labels don't require us to name our variables differently when
> destructuring. They're purely there for documentation and tooling.

```ts
function foo(x: [first: string, second: number]) {
  // ...
  // note: we didn't need to name these 'first' and 'second'
  const [a, b] = x;

  a;
  // const a: string

  b;
  // const b: number
}
```

## 🔴 Spread preserves; rebuilding destroys

This is the load-bearing fact of the whole topic, and
[topic 10 · chunk 02](../10-deriving-function-types/02-what-it-loses.md) argues it in full
for function wrappers. Restated here as a tuple rule:

```ts
type Args = [id: string, count?: number, ...flags: boolean[]];

// ✅ everything survives — labels, the optional marker, the rest element
type Kept = [...Args];

// ❌ everything is gone — three anonymous, required elements
type Lost = [Args[0], Args[1], Args[2]];
```

**A spread copies the tuple's structure. Indexed access copies element *types*.** Labels,
`?` and the rest element are structure, not types, so the rebuild silently produces a tuple
that type-checks in most positions and has lost every piece of information a reader needed.

⚠️ **`Lost` is worse than it looks.** `Args[1]` is `number | undefined` — the optionality
became a union member — so the rebuilt tuple requires an argument that may be `undefined`
rather than allowing it to be omitted. Arity changed, and nothing said so.

🔴 **The rule, and it covers every operation in this topic: if you can express it with
`[...T]` and pattern matching, the structure survives. If you find yourself writing `T[0]`,
`T[1]`, `T[2]`, you are rebuilding, and you have already lost.**

## What a mapped type does to a labelled tuple

A homomorphic mapped type is the exception, and it is a deliberate one:

```ts
type Promisified<T extends readonly unknown[]> = { [K in keyof T]: Promise<T[K]> };

type P = Promisified<[first: string, second?: number]>;
// [first: Promise<string>, second?: Promise<number | undefined>]
```

Labels and element flags survive, because `instantiateMappedTupleType` rebuilds the tuple
with its original `labeledElementDeclarations` and translated element flags —
[topic 12 · chunk 01](../12-deep-helpers/01-the-naive-version.md) has the source read.

📌 **So there are exactly two structure-preserving operations: a spread, and a homomorphic
mapped type.** Everything else — indexed access, `Extract`, rebuilding from `infer`ed pieces
one at a time — is a rebuild.

⚠️ **Pattern matching with `infer` sits in between.** `T extends readonly [infer A, ...infer R]`
preserves `R` as a structured tail (labels intact) but `A` is now a bare element type with no
label — the label lived on the position, and the position is gone. Reassembling as `[A, ...R]`
therefore keeps the tail's labels and drops the head's, which produces the
*"all elements must be labelled"* error the moment the tail has any. **That specific
combination is the most common way this rule bites in real code.**

## Optionality has its own trap

```ts
type A = [a: string, b?: number];          // length 1 or 2
type B = [a: string, b: number | undefined];  // length 2, always
```

Assignable in one direction, different arities, and the second is what a rebuild produces
from the first. In a rest-parameter position the difference is whether `f("x")` compiles.

**The `?` marker is the only thing that makes an argument omittable**, and it cannot be
recovered from the element type — `number | undefined` does not imply optional. This is the
tuple form of the same distinction
[phase 10 · topic 05](../../phase-10-strictness/05-exactoptionalpropertytypes/README.md)
draws for object properties.

## Gotchas

**Symptom:** *"Tuple members must all have names or all not have names."*
**Cause:** One element was added or edited without a label.
**Fix:** Label it. This is the loud failure in this chunk, and it is the one you want.

**Symptom:** A wrapper's parameter hints went from `(start, end)` to `(arg0, arg1)`.
**Cause:** The parameter tuple was rebuilt from indexed access instead of spread.
**Fix:** `(...args: Args)`, spreading the tuple. The labels were never type information, so
nothing errored when they vanished.

**Symptom:** A function that used to accept one argument now demands two.
**Cause:** The optional marker was lost in a rebuild; `T[1]` gives `number | undefined`,
which is required-but-nullable rather than optional.
**Fix:** Spread. Optionality is structure and cannot be reconstructed from the element type.

**Symptom:** Reassembling `[Head, ...Tail]` after an `infer` produces the all-or-none label
error.
**Cause:** The inferred tail kept its labels and the inferred head lost its own.
**Fix:** Either label the head explicitly in the reassembly, or keep the whole thing as a
spread and avoid splitting off the head at all.

**Symptom:** A mapped type over a tuple preserved labels and you assumed it had done nothing.
**Cause:** That preservation is deliberate 3.1-and-later behaviour.
**Fix:** Nothing — it is one of only two structure-preserving operations, and it is the one
people do not expect.

**Symptom:** `[...T]` and `T` behave differently somewhere.
**Cause:** They should not for structure, but `[...T]` is a fresh tuple type, so identity
comparisons and some inference sites can see them differently.
**Fix:** Prefer `T` directly when you are not actually changing anything; use the spread when
you are combining.

**Symptom:** A rest element ended up in the middle after a refactor and everything after it
went imprecise.
**Cause:** [Chunk 02](./02-variadic-tuple-types.md)'s unbounded rule — positions after an
unbounded spread are absorbed.
**Fix:** Keep the unbounded part last, or keep the precise positions in their own tuple.

**Symptom:** Labels appear in the editor's signature help as separate overloads.
**Cause:** Deliberate — the notes say TypeScript's editor support "will try to display them
as overloads when possible" for a union of labelled tuples.
**Fix:** Nothing. It is worth knowing because it makes a union of labelled tuples a genuinely
better API surface than an unlabelled one.

## Interview questions

**★ What do tuple labels actually do?**
Nothing to type-checking — the release notes say so explicitly. They are documentation the
tooling can read: hovers, signature help, and the editor's ability to display a union of
labelled tuples as separate overloads. Because they carry no type information, losing one
produces no error, which is what makes them worth being careful about.

**★ What are the rules for labelling?**
The syntax mirrors parameter lists, including `?` and rest elements. If you label one element
you must label all of them. And labels do not bind names — destructuring a labelled tuple
does not require using those names, they exist purely for documentation and tooling.

**★ Why does spreading preserve a tuple's structure when rebuilding does not?**
Because labels, optional markers and the rest element are properties of the *positions*, not
of the element types. A spread copies the structure; indexed access copies types. So
`[...Args]` keeps everything and `[Args[0], Args[1]]` produces two anonymous required
elements — and `Args[1]` on an optional element yields `number | undefined`, which changes
the arity from "one or two arguments" to "always two".

**★ Which operations preserve structure?**
Exactly two: a spread, and a homomorphic mapped type. The second is the surprising one —
`instantiateMappedTupleType` rebuilds the tuple with its original labelled element
declarations and translated element flags, so `{ [K in keyof T]: Promise<T[K]> }` over a
labelled tuple comes back labelled. Everything else is a rebuild.

**★ Where does `infer` sit on that spectrum?**
In between, and this is the case that catches people. `T extends readonly [infer A, ...infer R]`
keeps `R` as a structured tail with its labels intact, but `A` is a bare element type whose
label lived on the position that no longer exists. Reassembling `[A, ...R]` then trips the
all-or-none rule as soon as the tail has any labels — the most common way this bites in real
code.

**Can you recover optionality from an element type?**
No. `[a: string, b?: number]` and `[a: string, b: number | undefined]` have different arities
— the first accepts one argument, the second demands two — and nothing in `number | undefined`
says "omittable". It is the same absent-versus-undefined distinction
`exactOptionalPropertyTypes` draws for object properties, in tuple form.

**Why is the all-or-none label rule the least costly of these losses?**
Because it is the only one that errors. Losing a label is silent, losing optionality is silent
until a call site breaks somewhere unrelated, and losing positions to an unbounded spread is
silent forever. The all-or-none rule fails at the definition, which is the cheapest possible
place.

---

← [02 · Variadic tuple types](./02-variadic-tuple-types.md) · [Topic index](./README.md) ·
Next → **04 · Typing `bind`, `curry` and partial application** *(not written yet)*
