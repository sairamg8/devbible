---
title: "Modifiers, and what 'homomorphic' buys you"
sidebar_label: "02 · Modifiers"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the **TypeScript handbook** (*Mapped Types* —
> *Mapping Modifiers*), whose `CreateMutable`/`LockedAccount` and
> `Concrete`/`MaybeUser` examples are **quoted verbatim**; the **TypeScript 2.8
> release notes** (*Improved control over mapped type modifiers*), quoted
> verbatim including the `strictNullChecks` note; and the **TypeScript 3.1
> release notes** (*Mapped types on tuples and arrays*), also quoted verbatim.
> **No console block** — no sandbox run covers this phase.

A mapped type can do more than choose each property's *type*. It can also decide
whether the property is **optional** and whether it is **`readonly`** — and the
rules for that are where `Partial`, `Required` and `Readonly` actually come from.

## Writing a modifier

Put `readonly` before the bracket and `?` after it, exactly as you would in an
ordinary object type:

```ts
type ReadonlyPartial<T> = { readonly [P in keyof T]?: T[P] };
```

That much is unsurprising. The interesting half is **removing** a modifier the
input already had, which is what `-` is for.

## `+` and `-`

The 2.8 release notes introduced them, and are worth quoting in full because they
also name the behaviour the operators exist to control:

> "Mapped types support adding a `readonly` or `?` modifier to a mapped property,
> but they did not provide support for the ability to *remove* modifiers. This
> matters in *homomorphic mapped types* which by default preserve the modifiers
> of the underlying type."
>
> "TypeScript 2.8 adds the ability for a mapped type to either add or remove a
> particular modifier. Specifically, a `readonly` or `?` property modifier in a
> mapped type can now be prefixed with either `+` or `-` to indicate that the
> modifier should be added or removed."

```ts
type MutableRequired<T> = { -readonly [P in keyof T]-?: T[P] }; // Remove readonly and ?
type ReadonlyPartial<T> = { +readonly [P in keyof T]+?: T[P] }; // Add readonly and ?
```

> "A modifier with no `+` or `-` prefix is the same as a modifier with a `+`
> prefix."

So `readonly` and `+readonly` are identical, and the `+` form exists only for
symmetry when you want the pair to read alike. **`-` is the one that carries
information.**

The handbook's two worked examples, verbatim:

```ts
type CreateMutable<Type> = {
  -readonly [Property in keyof Type]: Type[Property];
};

type LockedAccount = {
  readonly id: string;
  readonly name: string;
};

type UnlockedAccount = CreateMutable<LockedAccount>;
// type UnlockedAccount = {
//   id: string;
//   name: string;
// }
```

```ts
type Concrete<Type> = {
  [Property in keyof Type]-?: Type[Property];
};

type MaybeUser = {
  id: string;
  name?: string;
  age?: number;
};

type User = Concrete<MaybeUser>;
// type User = {
//   id: string;
//   name: string;
//   age: number;
// }
```

`Concrete` is `Required` under a different name — the notes say so directly:
*"Using this ability, `lib.d.ts` now has a new `Required<T>` type."*

```ts
type Required<T> = { [P in keyof T]-?: T[P] };
```

### `-?` also removes `undefined`, and that is not obvious

> "Note that in `strictNullChecks` mode, when a homomorphic mapped type removes a
> `?` modifier from a property in the underlying type it also removes `undefined`
> from the type of that property:"

```ts
type Foo = { a?: string }; // Same as { a?: string | undefined }
type Bar = Required<Foo>; // Same as { a: string }
```

This is the behaviour people expect but could not get by hand: writing
`{ [P in keyof T]: T[P] }` with the `?` merely dropped would leave
`string | undefined` behind. `-?` does both jobs — and only in a homomorphic
mapped type, which is the next section.

## What "homomorphic" means, and why the word matters

A mapped type is **homomorphic** when it iterates `keyof T` for some type `T` —
that is, when it maps *over the keys of a given type* rather than over a union
you constructed. `{ [P in keyof T]: … }` is homomorphic; `{ [K in "a" | "b"]: … }`
is not.

The distinction is not academic. A homomorphic mapped type gets three behaviours
the general form does not:

**1. It preserves the input's modifiers by default.** That is the sentence the 2.8
notes lead with, and it is why `Partial<T>` does not silently strip `readonly`
from a `readonly` property. It is also why `-readonly` had to be invented: there
was previously no way to opt *out* of the preservation.

**2. It preserves arrays and tuples.** From the 3.1 release notes:

> "In TypeScript 3.1, mapped object types over tuples and arrays now produce new
> tuples/arrays, rather than creating a new type where members like `push()`,
> `pop()`, and `length` are converted."

```ts
type MapToPromise<T> = { [K in keyof T]: Promise<T[K]> };

type Coordinate = [number, number];

type PromiseCoordinate = MapToPromise<Coordinate>; // [Promise<number>, Promise<number>]
```

> "`MapToPromise` takes a type `T`, and when that type is a tuple like
> `Coordinate`, only the numeric properties are converted."

Before 3.1 the same mapping over `[number, number]` produced an object with
mapped `push`, `pop` and `length` members — which is exactly as useless as it
sounds. This is why `Partial<string[]>` gives you an array and not a mangled
object.

**3. It distributes over a union.** `Partial<A | B>` is `Partial<A> | Partial<B>`,
not a mapping over the shared keys of the union. That is usually what you want,
and occasionally a surprise — the surprise being that a *non*-homomorphic mapping
over `keyof (A | B)` sees only the keys `A` and `B` have in common.

**The practical test:** if the loop is `[K in keyof T]` where `T` is a type
parameter, you get all three behaviours. Wrap the key union in anything —
`[K in keyof T & string]`, `[K in Exclude<keyof T, "id">]` — and you have left
homomorphic territory, the modifiers stop being preserved, and arrays map to
objects again.

That last point is the one that bites, and it is worth stating as a rule: **key
remapping and key filtering cost you modifier preservation.** Topic 04 covers the
`as` clause on its own terms; this is the part to remember when you use it.

## The four one-liners worth knowing by heart

```ts
type Partial<T>  = { [P in keyof T]?: T[P] };
type Required<T> = { [P in keyof T]-?: T[P] };
type Readonly<T> = { readonly [P in keyof T]: T[P] };
type Mutable<T>  = { -readonly [P in keyof T]: T[P] };
```

Three of those ship in `lib.es5.d.ts`. The fourth — `Mutable`, the handbook's
`CreateMutable` — does not, which is the standard example of *"the missing
utility you can now write yourself"* that topic 03 is built around.

## Gotchas

**Symptom:** `Partial<T>` silently dropped a `readonly`
**Cause:** It did not — a homomorphic mapped type preserves modifiers by default.
Something else in the chain (a key remap, an intersection, a non-homomorphic
mapping) broke homomorphism.
**Fix:** Check whether the loop is still `[K in keyof T]` over a type parameter.

**Symptom:** `Required<T>` left `undefined` in a property's type
**Cause:** Either `strictNullChecks` is off, or the mapping is not homomorphic —
the `undefined`-stripping behaviour is specified for homomorphic mapped types in
`strictNullChecks` mode.
**Fix:** Turn on `strictNullChecks`; keep the mapping homomorphic; or strip it
explicitly with `Exclude<T[P], undefined>`.

**Symptom:** A mapping over an array produced an object with `push` and `length`
mapped
**Cause:** The mapping is not homomorphic, so the 3.1 tuple/array behaviour does
not apply.
**Fix:** Map over `keyof T` directly, or handle the array case with a conditional
type before mapping.

**Symptom:** `-?` was written but the property is still optional
**Cause:** The `-` is on the wrong modifier — `-readonly [P in keyof T]?` removes
`readonly` and *adds* `?`.
**Fix:** Read the two positions separately: before the bracket is `readonly`,
after it is `?`.

**Symptom:** A key-filtered mapping lost every `readonly`
**Cause:** Filtering with `as` or `Exclude` makes the mapping non-homomorphic, and
non-homomorphic mappings do not preserve modifiers.
**Fix:** Re-apply them explicitly (`readonly [K in …]`), or filter after mapping
rather than during it.

**Symptom:** `Partial<A | B>` behaves as if the union were collapsed
**Cause:** It distributes — the result is `Partial<A> | Partial<B>`. What you were
expecting is a mapping over `keyof (A | B)`, which sees only shared keys.
**Fix:** Decide which you want and write it explicitly; do not rely on the reader
guessing.

**Symptom:** `+readonly` looks like it does something extra
**Cause:** It does not. `+` is the default; the notes say a modifier with no
prefix is the same as one with `+`.
**Fix:** Use it only for symmetry with a nearby `-`, or leave it off.

## Interview questions

**★ What do `+` and `-` do in a mapped type, and which is the default?**
They add or remove a `readonly` or `?` modifier. `+` is the default, so
`readonly` and `+readonly` are identical — `-` is the operator that carries
information. `-readonly` produces a mutable copy; `-?` produces a required one,
which is exactly how `lib.d.ts` defines `Required<T>`.

**★ What is a homomorphic mapped type, and why should you care?**
One that iterates `keyof T` for a given type `T`, rather than a union you built.
It matters because homomorphic mappings **preserve the input's `readonly` and `?`
modifiers by default**, **map tuples and arrays to tuples and arrays** (3.1), and
**distribute over unions**. Break the pattern — filter the keys, remap with `as`,
intersect the key union — and you lose all three.

**★ Why does `Required<T>` remove `undefined` and not just the question mark?**
Because the 2.8 notes specify that in `strictNullChecks` mode, a homomorphic
mapped type removing a `?` modifier also removes `undefined` from that property's
type: `{ a?: string }` becomes `{ a: string }`, not `{ a: string | undefined }`.
It is a rule about homomorphic mappings specifically — a hand-rolled
non-homomorphic version does not get it.

**Write `Mutable<T>` and say why it is not in the standard library.**
`type Mutable<T> = { -readonly [P in keyof T]: T[P] }`. It is the handbook's
`CreateMutable`. It is not in `lib.es5.d.ts` — `Partial`, `Required` and
`Readonly` are, its opposite is not — which makes it the standard example of a
utility you write yourself once you understand the modifier operators.

**What happened in TypeScript 3.1 to mapped types over arrays?**
Before 3.1, mapping over a tuple or array produced an object whose `push`, `pop`
and `length` members had been mapped too. Since 3.1, a mapped object type over a
tuple or array produces a new tuple or array, converting only the numeric
properties — so `MapToPromise<[number, number]>` is
`[Promise<number>, Promise<number>]`.

**How would you make every property of `T` mutable *and* required in one type?**
`type MutableRequired<T> = { -readonly [P in keyof T]-?: T[P] }` — the 2.8 notes'
own example. Both operators apply in the same mapping, one on each side of the
bracket.

---

← Prev: [01 · The loop](./01-the-loop.md) · Next → [03 · Writing your own](./03-writing-your-own.md)
