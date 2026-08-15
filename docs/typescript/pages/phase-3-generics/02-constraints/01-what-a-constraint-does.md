---
title: "What a constraint does"
sidebar_label: "01 · What a constraint does"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the **TypeScript handbook** (*Generics → Generic
> Constraints*). `TS2344` (*"Type '{0}' does not satisfy the constraint
> '{1}'."*), `TS2345` and `TS2313` (*"Type parameter '{0}' has a circular
> constraint."*) were read out of the **compiler's own diagnostic table**, not
> recalled. ⚠️ Compiler inspected: TypeScript **6.0.3**, not the 7.0.2 this
> corpus targets. **No console block** — no sandbox run covers this phase.

[Topic 01](../01-generic-functions-and-inference/README.md) ended on the problem:
an unconstrained `T` lets you pass, store and return a value and nothing else. A
constraint is how you buy back the ability to *look at* it — without giving up
the relationship that made the generic worth writing.

```ts
function longest<T extends { length: number }>(a: T, b: T): T {
  return a.length >= b.length ? a : b;
}

longest('ab', 'abc');            // string
longest([1, 2], [1, 2, 3]);      // number[]
longest(1, 2);                   // TS2345 — number has no `length`
```

The body can read `.length` because the constraint promises it exists. The
return type is still `T`, so a caller who passed strings gets a `string` back,
not a `{ length: number }`. **Both halves matter** — that is the whole design.

## `extends` here does not mean inheritance

The keyword is reused and it is the single biggest source of confusion in this
topic. In `T extends X`, `extends` means:

> **`T` must be assignable to `X`.**

Assignable, in TypeScript's structural sense
([Phase 1 · Structural typing](../../phase-1-type-vocabulary/09-structural-typing.md))
— so a plain object literal type satisfies `{ length: number }` if it has a
numeric `length`, with no `implements`, no base class and no declaration
relating them:

```ts
longest({ length: 3, name: 'a' }, { length: 5, name: 'b' });   // fine
```

It is an **upper bound**: `T` can be `X` itself or anything narrower. Reading it
as "T is a subtype of X, structurally" is accurate; reading it as "T inherits
from X" will mislead you every time the bound is a union or a primitive.

## What a constraint gives you, and what it does not

**It gives you a floor of knowledge inside the body.** Everything guaranteed by
the constraint is available on `T`.

**It does not let you construct a `T`.** This is the asymmetry people trip over:

```ts
function reset<T extends { count: number }>(x: T): T {
  return { count: 0 };            // error
}
```

`{ count: 0 }` satisfies the *constraint*, but `T` is chosen by the **caller**
and could be `{ count: number; label: string }`. Returning a bare
`{ count: 0 }` would be missing `label`, so the compiler refuses. The constraint
is a lower bound on what you *know*, never on what you may *produce*.

The correct versions say what you actually mean:

```ts
function reset<T extends { count: number }>(x: T): T {
  return { ...x, count: 0 };      // spread the caller's value — still a T
}

function makeCounter(): { count: number } {   // not generic at all
  return { count: 0 };
}
```

**If the body needs to create a value of the parameter's type, the parameter is
probably wrong.** Either take a factory, or drop the generic.

## The constraints you will actually write

```ts
<T extends object>                        // anything non-primitive
<T extends { id: string }>                // a shape — the most common by far
<T extends string>                        // preserves literal types (topic 01)
<T extends readonly unknown[]>            // any array or tuple, read-only-safe
<T extends (...args: never[]) => unknown> // any function
<K extends keyof T>                       // a key of another parameter — topic 04
```

Two notes on the less obvious ones.

**`readonly unknown[]` rather than `any[]`.** `unknown[]` keeps the element type
checked; and including `readonly` means callers can pass an `as const` tuple,
which `T extends unknown[]` rejects. A constraint that quietly excludes readonly
arrays is one of the more annoying things to hit from the outside.

**`(...args: never[]) => unknown` rather than `Function`.** `Function` accepts
anything callable and gives back `any` when you call it, which reintroduces the
hole the generic was supposed to close. The `never[]` parameter list is the
idiom for "any function, whatever its parameters", because `never` is assignable
to everything in the contravariant position.

## Two error codes, two different mistakes

```ts
longest(1, 2);
```

```text
error TS2345: Argument of type 'number' is not assignable to parameter of
type '{ length: number; }'.
```

```ts
longest<number>(1, 2);
```

```text
error TS2344: Type 'number' does not satisfy the constraint '{ length: number; }'.
```

Same underlying problem, reported at different places. **`TS2345` means an
argument did not fit; `TS2344` means an explicit type argument did not fit the
constraint.** When you see 2344, go and look at the angle brackets, not the
parentheses — which sounds obvious and saves real time when the call is long.

## Constraints can refer to other type parameters

This is what makes generics compose, and it is the seed of most of the useful
patterns in this phase:

```ts
function getProp<T, K extends keyof T>(obj: T, key: K): T[K] { … }

function merge<A extends object, B extends object>(a: A, b: B): A & B { … }

function pluck<T, K extends keyof T>(items: T[], key: K): T[K][] { … }
```

`K extends keyof T` says "K is one of T's keys" — a constraint whose bound is
*computed from another parameter*. That is a genuinely different level of
expressiveness from `K extends string`, and it is the whole content of
[topic 05 · The `getProp` pattern](../05-getprop-pattern/README.md).

What you may **not** do is have the constraints refer to each other in a loop:

```ts
function bad<A extends B, B extends A>(a: A, b: B) { … }
```

```text
error TS2313: Type parameter 'A' has a circular constraint.
```

## When a constraint means the generic should not exist

A constraint narrows what `T` can be. Push it far enough and there is nothing
left for the type parameter to vary over:

```ts
function log<T extends string>(msg: T): void {
  console.log(msg);
}
```

`T` appears once, in a parameter position, and the return type ignores it. This
is `function log(msg: string): void` with extra ceremony — the generic preserves
information that nothing downstream uses.

Contrast with:

```ts
function tag<T extends string>(msg: T): T { … }        // T survives to the caller
function head<T extends readonly unknown[]>(xs: T): T[0] { … }
```

Here the parameter is load-bearing: the caller gets back something more specific
than the constraint. **The test is whether removing `<T>` and using the
constraint directly would lose a caller anything.** If not, remove it —
[topic 13 · When not to write a generic](../13-when-not-to-write-a-generic/README.md).

## Gotchas

**Symptom:** `Property 'x' does not exist on type 'T'` even though the constraint
mentions it
**Cause:** The constraint is on a different parameter, or it is `object`/`{}`
rather than a shape.
**Fix:** Constrain to the shape you need: `<T extends { x: string }>`.

**Symptom:** `Type '{ … }' is not assignable to type 'T'` when returning a
literal
**Cause:** `T` is chosen by the caller and may be narrower than the constraint;
you cannot manufacture one.
**Fix:** Spread the input (`{ ...x, count: 0 }`), take a factory, or return the
constraint type and drop the generic.

**Symptom:** `TS2344` on a call you thought was about the arguments
**Cause:** An explicit type argument violated the constraint.
**Fix:** Look at the angle brackets. 2345 is the arguments, 2344 is the type
arguments.

**Symptom:** A caller cannot pass an `as const` array
**Cause:** The constraint is `T extends unknown[]`, which excludes readonly.
**Fix:** `T extends readonly unknown[]`.

**Symptom:** Calling a `T extends Function` parameter returns `any`
**Cause:** `Function` is the untyped escape hatch.
**Fix:** `T extends (...args: never[]) => unknown`.

**Symptom:** `TS2313: Type parameter 'A' has a circular constraint`
**Cause:** Two parameters constrain each other.
**Fix:** Break the cycle — usually one of them should be `keyof` the other, or a
concrete bound.

## Interview questions

**★ What does `extends` mean in `T extends X`?**
"`T` must be assignable to `X`" — an upper bound, checked structurally. It is not
inheritance: any type with the right shape satisfies it, with no `implements` or
base class involved. Reading it as inheritance breaks down immediately when the
bound is a union or a primitive.

**★ Why can't you return `{ count: 0 }` from `<T extends { count: number }>(x: T):
T`?**
Because `T` is chosen by the caller and may be narrower than the constraint —
`{ count: number; label: string }`, for instance — so a bare `{ count: 0 }` would
be missing properties. A constraint is a floor on what you *know*, never a
licence to *construct* a `T`. Spread the input instead, or drop the generic.

**★ What is the difference between TS2344 and TS2345?**
`TS2345` is an argument that is not assignable to a parameter type. `TS2344` is
an explicit *type argument* that does not satisfy a constraint. The code tells
you whether to look inside the parentheses or the angle brackets.

**Why `T extends readonly unknown[]` rather than `T extends any[]`?**
`unknown[]` keeps elements checked where `any[]` does not, and the `readonly`
means an `as const` tuple can be passed — a constraint of `unknown[]` silently
rejects them, which is a frustrating limitation to hit from outside the library.

**When does a constraint tell you the generic should be deleted?**
When the type parameter appears only once and the return type does not mention
it — `<T extends string>(msg: T): void` is just `(msg: string): void`. If
replacing `T` with its constraint costs no caller any precision, the parameter
is ceremony.

---

← [Topic index](./README.md) · Next → [02 · Constraints in practice](./02-constraints-in-practice.md)
