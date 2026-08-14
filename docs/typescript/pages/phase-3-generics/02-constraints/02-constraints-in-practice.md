---
title: "Constraints in practice"
sidebar_label: "02 · In practice"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the **TypeScript handbook** (*Generics → Generic
> Constraints*, *Using Type Parameters in Generic Constraints*). **`NoInfer<T>`
> is read directly from `lib.es5.d.ts`** — declared `type NoInfer<T> =
> intrinsic;` under the comment *"Marker for non-inference type position"*, so
> it is a compiler intrinsic rather than a type written in TypeScript. ⚠️ The
> install inspected is TypeScript **6.0.3**, not the 7.0.2 this corpus targets.
> **No console block** — no sandbox run covers this phase.

[Chunk 01](./01-what-a-constraint-does.md) covered what a constraint *is*. This
chunk is the working knowledge: the patterns that recur, the two syntax traps,
and the tool for the case where a constraint is not the thing you actually
needed.

## Constraining to a union preserves the member

A union bound behaves differently from a shape bound, and usefully so:

```ts
type Status = 'idle' | 'loading' | 'done';

function describe<T extends Status>(s: T): `status:${T}` {
  return `status:${s}` as `status:${T}`;
}

const d = describe('loading');    // 'status:loading'
```

The caller passed one member and got a result derived from **that member**, not
from the whole union. Written non-generically as `(s: Status) => string` the
call site learns nothing.

This is the same mechanism as `<T extends string>` from
[topic 01](../01-generic-functions-and-inference/02-where-inference-comes-from.md)
— a primitive or union bound makes inference keep the literal instead of
widening — and it is behind most APIs that feel unusually precise for how little
code they contain.

## Constraining against another parameter

The pattern that makes generics compose, and worth collecting in one place:

```ts
// A key of an object you were also given
function getProp<T, K extends keyof T>(obj: T, key: K): T[K] { … }

// A subset of keys
function pick<T, K extends keyof T>(obj: T, keys: readonly K[]): Pick<T, K> { … }

// Only the keys whose values are of a given type
function sumBy<T, K extends keyof T>(
  items: readonly T[],
  key: T[K] extends number ? K : never,
): number { … }

// Two objects, related only by both being objects
function merge<A extends object, B extends object>(a: A, b: B): A & B { … }
```

`K extends keyof T` is the workhorse. It says *"K is one of T's keys"*, so the
compiler can reject `getProp(user, 'nmae')` at the call site and compute the
return type as `T[K]`. Full treatment in **topic 04 · `keyof`** and
**topic 05 · The `getProp` pattern** *(both not written yet)*.

## Self-referential constraints for recursive shapes

A parameter may appear in its own bound as long as the reference is not circular
between two parameters:

```ts
type Json = string | number | boolean | null | Json[] | { [k: string]: Json };

function deepFreeze<T extends Record<string, unknown>>(obj: T): Readonly<T> { … }

function walk<T extends { children?: readonly T[] }>(node: T): void {
  node.children?.forEach(walk);
}
```

That last one is the tree shape, and it is exactly the case where a constraint
earns its place: the body needs `children`, and the caller keeps their own node
type on the way out.

## 🔴 Two syntax traps

**In a `.tsx` file, `<T>` is ambiguous with JSX.** The parser cannot tell a type
parameter list from an element:

```tsx
const identity = <T>(x: T) => x;        // parsed as JSX — error
```

Two fixes, both conventional:

```tsx
const identity = <T,>(x: T) => x;              // trailing comma
const identity = <T extends unknown>(x: T) => x;   // a bound disambiguates
```

The trailing comma is the more common; `extends unknown` is a constraint that
constrains nothing and exists purely to make the parse unambiguous. Seeing
`<T extends unknown>` in a React codebase almost always means *this* rather than
a considered bound.

**A constraint is not a default.** `<T extends string>` does not mean "T is
`string` if you do not say" — with no inference site it falls back *to the
constraint*, which looks the same in that one case and is a different mechanism.
Defaults are `<T = string>`, they compose with constraints
(`<T extends string = 'idle'>`), and they are **topic 08** *(not written yet)*.

## When a constraint is the wrong tool: `NoInfer<T>`

Sometimes the problem is not *what* `T` may be but *where the compiler is
allowed to learn it from*:

```ts
function fill<T>(items: T[], fallback: T): T[] { … }

fill([1, 2, 3], 'zero');     // T infers as number | string. Probably not wanted.
```

Both parameters are inference sites, so a wrong second argument silently widens
`T` instead of erroring. A constraint cannot express "infer from the first
argument only". `NoInfer<T>` can:

```ts
function fill<T>(items: T[], fallback: NoInfer<T>): T[] { … }

fill([1, 2, 3], 'zero');
//              ~~~~~~ error — T was fixed to number by the first argument
```

`lib.es5.d.ts` declares it as `type NoInfer<T> = intrinsic;` with the comment
*"Marker for non-inference type position"* — it is a compiler intrinsic, not
something you could write yourself, and it means "this position uses `T` but does
not contribute a candidate for it".

**Reach for it whenever one parameter should define the type and the others
should merely conform to it** — a default value, an initial state, a fallback,
an expected value in a test helper. It is a small feature that removes a whole
class of confusing widening. Requires a lib new enough to declare it (TypeScript
5.4 onwards).

## Choosing the bound: too tight and too loose

**Too loose** is the common failure and it shows up inside the body:

```ts
function label<T extends object>(x: T): string {
  return x.name;              // error — `object` says nothing about `name`
}
```

`object` and `{}` are almost never the constraint you want. `{}` in particular
accepts everything except `null`/`undefined`, which makes it look permissive and
useless in equal measure.

**Too tight** shows up at the call site, usually as a complaint from someone
else:

```ts
function first<T extends unknown[]>(xs: T): T[0] { … }
const xs = [1, 2, 3] as const;
first(xs);                    // rejected — readonly tuple is not unknown[]
```

The rule of thumb: **constrain to exactly what the body reads, and no more.** If
the body only touches `.length`, the bound is `{ length: number }`, not
`unknown[]`. Every property you add to the bound is a caller you exclude for no
benefit.

## Trade-off

**A tight constraint** documents the contract, gives good errors at the call
site, and makes the body writable. It costs flexibility — every future caller
must satisfy it, and widening it later is a breaking change in reverse (easy for
you, but it changes what the body may assume).

**A loose constraint** accepts more callers and leaves the body unable to do
anything useful, which usually gets patched with an `as` — at which point the
type safety is gone and only the ceremony remains.

**No constraint** is right for genuine pass-through code: `identity`, `first`,
`pipe`, containers.

## Gotchas

**Symptom:** `<T>(x: T) => x` fails to parse in a `.tsx` file
**Cause:** Ambiguity with JSX.
**Fix:** `<T,>` or `<T extends unknown>`.

**Symptom:** `T` widens to a union because a second argument disagreed
**Cause:** Every parameter mentioning `T` is an inference site.
**Fix:** `NoInfer<T>` on the parameters that should conform rather than decide.

**Symptom:** `<T extends string>` behaves like a default when nothing is passed
**Cause:** With no inference site the fallback *is* the constraint — a
coincidence, not a default.
**Fix:** If you want a default, write one: `<T extends string = 'idle'>`.

**Symptom:** `Property 'name' does not exist on type 'T'` with `T extends object`
**Cause:** `object` guarantees nothing about properties.
**Fix:** Constrain to the shape the body reads.

**Symptom:** A library helper rejects your `as const` array
**Cause:** Its bound is `unknown[]`, not `readonly unknown[]`.
**Fix:** In your own code, always write the `readonly` form.

**Symptom:** The body is full of `as` despite a constraint
**Cause:** The bound is looser than what the body assumes.
**Fix:** Tighten the bound until the assertions become unnecessary — that is the
signal you have the right one.

## Interview questions

**★ How do you make a helper preserve which member of a union was passed?**
Constrain the parameter to the union — `<T extends Status>(s: T)` — so inference
keeps the literal rather than widening to the whole union. A non-generic
`(s: Status)` loses that at the call site immediately.

**★ What is `NoInfer<T>` and when do you reach for it?**
A compiler intrinsic — `lib.es5.d.ts` declares it `type NoInfer<T> = intrinsic`
under "Marker for non-inference type position" — that makes a parameter *use* `T`
without contributing a candidate for it. Use it when one argument should decide
the type and the others should merely conform: a fallback, a default, an initial
value. Without it, a wrong second argument widens `T` instead of erroring.

**★ Why does `<T>(x: T) => x` fail in a `.tsx` file?**
The parser cannot distinguish the type parameter list from a JSX element. Write
`<T,>` or `<T extends unknown>`; the latter is a constraint that constrains
nothing and exists only to disambiguate, which is why you see it so often in
React code.

**How do you choose how tight a constraint should be?**
Constrain to exactly what the body reads. If the body only uses `.length`, the
bound is `{ length: number }`. Anything more excludes callers for no benefit;
anything less leaves the body unable to compile and invites an `as`, which
removes the safety the generic existed for.

**Is a constraint the same as a default type parameter?**
No. With no inference site an unconstrained parameter falls back to `unknown` and
a constrained one to its constraint — which resembles a default in that one case
but is a different mechanism. Defaults are `<T = X>` and compose with constraints
as `<T extends X = Y>`.

---

← Prev: [01 · What a constraint does](./01-what-a-constraint-does.md) · Next → **03 · Generic interfaces and type aliases** *(not written yet)*
