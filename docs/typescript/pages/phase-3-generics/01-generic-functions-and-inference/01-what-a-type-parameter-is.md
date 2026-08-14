---
title: "What a type parameter is"
sidebar_label: "01 · What a type parameter is"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the **TypeScript handbook** (*Generics*). `TS2345`
> (*"Argument of type '{0}' is not assignable to parameter of type '{1}'."*) and
> `TS2344` (*"Type '{0}' does not satisfy the constraint '{1}'."*) were read out
> of the **compiler's own diagnostic table**, not recalled. ⚠️ Compiler
> inspected: TypeScript **6.0.3**, not the 7.0.2 this corpus targets. **No
> console block** — no sandbox run covers this phase.

## The problem, before the solution

You want a function that returns the first element of an array. Without
generics there are two options and both are bad.

```ts
function first(arr: any[]): any {
  return arr[0];
}

const n = first([1, 2, 3]);
n.toUpperCase();          // compiles. Explodes.
```

`any` works for every caller and checks nothing for any of them — the return
value has lost every fact about where it came from
([Phase 1 · `any` vs `unknown`](../../phase-1-type-vocabulary/06-any-unknown-never-void.md)).

```ts
function firstNumber(arr: number[]): number { return arr[0]; }
function firstString(arr: string[]): string { return arr[0]; }
// …and one per type, forever
```

Overloads keep the checking and lose the reuse. **A generic keeps both**, and
that is the entire pitch:

```ts
function first<T>(arr: T[]): T {
  return arr[0];
}

const n = first([1, 2, 3]);        // number
const s = first(['a', 'b']);       // string
```

```text
error TS2345: Argument of type 'number' is not assignable to parameter of
type 'string'.
```

— which is what you now get if you feed the result of `first(['a'])` to
something expecting a number. The relationship between the argument and the
return value **survived the call**, and preserving that relationship is what
generics are for.

## A type parameter is a variable in the type language

This framing is worth taking literally, because every confusing generic becomes
readable under it.

```ts
function first<T>(arr: T[]): T
//            ^^^ declaration     ^^^ use    ^^^ use
```

`<T>` **declares** a variable that exists for the duration of this signature.
`T[]` and `T` **use** it. At each call site the compiler *solves* for `T` — it
looks at what was passed, works out what value of `T` makes the signature fit,
and substitutes it everywhere.

`first([1, 2, 3])` sets `T = number`, so for that one call the signature reads
`(arr: number[]) => number`. Nothing more mysterious than that is happening.

Two consequences fall straight out:

- **`T` is a different value at every call site.** It is not a property of the
  function; it is a parameter to it.
- **`T` does not exist at runtime.** Like every other type-layer construct it is
  erased ([Phase 0 · Erasure](../../phase-0-how-typescript-runs/02-erasure.md)).
  There is no way to ask "what was `T`?" inside the body, which is the source of
  the most common beginner disappointment — see *You cannot inspect `T`* below.

## Where the parameter may appear

```ts
function example<T>(a: T, b: T[], c: (x: T) => void): Map<string, T> { … }
```

A type parameter can appear anywhere a type can: parameter positions, the
return type, nested inside other types, inside a function type. The more
positions it appears in, the more the signature actually *says* — a `T` that
appears exactly once says almost nothing, which is **topic 13**'s subject *(not written yet)*.

**Naming.** `T` is conventional for one; `T`, `U`, `V` for more. Once a
signature has three or more, prefer real names — `<Item, Key, Result>` — because
by then the single letters cost more than they save. This is a readability
convention, not a rule the compiler cares about.

## What you can do with an unconstrained `T` — almost nothing

Inside the body, `T` is a type the compiler knows nothing about, so it permits
almost no operations on it:

```ts
function bad<T>(x: T) {
  x.length;         // error — no such property is known to exist
  x + 1;            // error
  x.toUpperCase();  // error
}
```

**This is correct and it is the point.** `T` stands for *every* type the caller
might pass. If the body could call `.length`, the function would be lying to
every caller who passed a number.

So an unconstrained type parameter lets you do exactly three things: **pass the
value around, store it, and return it**. That is enough for `first`, `identity`,
`pipe` and every container type — and it is not enough for anything that
inspects the value, which is what **02 · Constraints** *(not written yet)* exists to fix.

The tell that you have this wrong: writing `<T>` and then immediately writing
`as` inside the body to get at a property. That is a type parameter pretending
to be a constraint.

## You cannot inspect `T` at runtime

```ts
function make<T>(): T {
  if (T === String) { … }        // error — T is not a value
  return new T();                // error
}
```

`T` is erased. There is no reflection, no `typeof T`, no `new T()`. Frameworks
in other languages that do this rely on runtime type information, and TypeScript
deliberately has none.

**The workaround is to pass a value that carries the information:**

```ts
function make<T>(ctor: new () => T): T {
  return new ctor();
}

const d = make(Date);        // Date — inferred from the constructor argument
```

Now the type flows from a real runtime value, which is the only mechanism
available. The same shape underlies every "factory" and every decoder that takes
a schema object.

## Multiple type parameters relate their arguments

One parameter preserves a type. Two or more express a **relationship**:

```ts
function pair<A, B>(a: A, b: B): [A, B] {
  return [a, b];
}

const p = pair('id', 42);        // [string, number]
```

```ts
function map<T, U>(arr: T[], fn: (item: T) => U): U[] {
  return arr.map(fn);
}

const lengths = map(['a', 'bb'], s => s.length);   // number[]
```

Read that second signature as a sentence: *given an array of some type `T` and a
function from `T` to some other type `U`, you get back an array of `U`.* Both
parameters are inferred — `T` from the array, `U` from what the callback
returns — and the callback's own parameter `s` is typed `string` for free,
because `T` was solved before the callback body was checked.

**That last effect is most of the day-to-day value of generics** and it is
easy to miss: you did not annotate `s`, and it is not `any`.

## Constraints, in one line ahead of the next page

When the body needs to *do* something with the value, restrict what `T` can be:

```ts
function longest<T extends { length: number }>(a: T, b: T): T {
  return a.length >= b.length ? a : b;
}

longest([1, 2], [1, 2, 3]);      // number[]
longest('ab', 'abc');            // string
longest(1, 2);                   // TS2345 — number has no `length`
```

`T extends { length: number }` says "any type, as long as it has a `length`",
and it is what makes the body legal. Violating a constraint in an *explicit*
type argument reports the other code:

```text
error TS2344: Type 'number' does not satisfy the constraint '{ length: number; }'.
```

Two codes for the same idea, and which one you see tells you where the mismatch
was found: **TS2345 is an argument that did not fit; TS2344 is a type argument
that did not fit.** **02 · Constraints** *(not written yet)* is the full treatment.

## Gotchas

**Symptom:** `Property 'length' does not exist on type 'T'`
**Cause:** `T` is unconstrained, so no property is known to exist on it.
**Fix:** Constrain it — `<T extends { length: number }>`. Do not `as` your way
in.

**Symptom:** A generic function returns `any` at every call site
**Cause:** The body has an `any` in it, or the type parameter is not connected to
the return type.
**Fix:** Check that `T` appears in both a parameter position and the return type;
that connection *is* the feature.

**Symptom:** `new T()` or `typeof T` does not compile
**Cause:** Type parameters are erased — `T` is not a value.
**Fix:** Take a constructor or a factory as a parameter: `(ctor: new () => T)`.

**Symptom:** A callback parameter inside `map(arr, x => …)` is implicitly `any`
**Cause:** The signature does not relate the array's element type to the
callback's parameter type.
**Fix:** `<T, U>(arr: T[], fn: (item: T) => U)`. The relationship is what types
the callback.

**Symptom:** Three or four single-letter parameters and nobody can read the
signature
**Cause:** Convention followed past its usefulness.
**Fix:** Name them — `<Item, Key, Result>`.

## Interview questions

**★ What problem do generics solve that `any` does not?**
They preserve the *relationship* between input and output. `first(arr: any[]):
any` accepts everything and tells the caller nothing, so the result is unchecked.
`first<T>(arr: T[]): T` accepts everything and still reports that the result has
the array's element type, so misusing it is an error at the call site.

**★ Why can you not call `x.length` on an unconstrained `T`?**
Because `T` stands for every type a caller might pass, including ones with no
`length`. Permitting it would make the function unsound for those callers. An
unconstrained parameter lets you pass, store and return the value and nothing
else — constrain it when the body needs to inspect it.

**★ Why can you not write `new T()`?**
Type parameters are erased; `T` does not exist at runtime, so there is nothing to
construct. Pass a constructor instead — `function make<T>(ctor: new () => T): T`
— which makes the type flow from a real value.

**What does a second type parameter buy you?**
It expresses a relationship rather than just preserving one type. `map<T, U>(arr:
T[], fn: (item: T) => U): U[]` says the callback's input is the array's element
type and the result's element type is whatever the callback returns — which is
also what types the callback's parameter without an annotation.

**What is the difference between TS2345 and TS2344?**
`TS2345` is an *argument* that is not assignable to a parameter. `TS2344` is a
*type argument* that does not satisfy a type parameter's constraint. Same idea,
different position, and the code tells you which one to go and look at.

---

← [Topic index](./README.md) · Next → [02 · Where inference comes from](./02-where-inference-comes-from.md)
