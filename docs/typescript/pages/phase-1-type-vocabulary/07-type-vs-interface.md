---
title: "`type` vs `interface`"
sidebar_label: "07 · type vs interface"
sidebar_position: 7
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 on **TypeScript 7.0.2**. Every error below is literal
> compiler output from `sandbox/ts-p1/ex4-type-vs-interface.sh`. One piece of
> common folklore did **not** reproduce — see "Error messages" below.

**They overlap almost completely. Three real differences decide which to use, and
only one of them matters day to day: interfaces merge, type aliases do not.**

## What both can do

```ts
interface Parcel { id: string; weightKg: number }
type TParcel = { id: string; weightKg: number };

interface WithExtras extends Parcel { express: boolean }
type TWithExtras = TParcel & { express: boolean };

interface Repo<T> { find(id: string): T | undefined }
type TRepo<T> = { find(id: string): T | undefined };
```

Objects, generics, extension, implementation by a class, structural
compatibility — identical. An `interface` and a `type` describing the same shape
are the same type, and either satisfies the other.

## Difference 1 — declaration merging

Two interfaces with the same name combine:

```ts
interface Box { width: number }
interface Box { height: number }
const b: Box = { width: 1, height: 2 };   // fine
const missing: Box = { width: 1 };        // error
```

```console
src-ex4/merge.ts(4,7): error TS2741: Property 'height' is missing in type '{ width: number; }' but required in type 'Box'.
```

The error proves the merge happened. A type alias refuses outright:

```console
src-ex4/merge.ts(6,6): error TS2300: Duplicate identifier 'TBox'.
src-ex4/merge.ts(7,6): error TS2300: Duplicate identifier 'TBox'.
```

**This is the difference with real consequences.** Merging is how you add
properties to types you do not own — `Express.Request` gaining `req.user`,
`ProcessEnv` gaining your variables, a library's options object gaining a
plugin's fields ([Phase 4](../../syllabus/02-types-at-scale.md)).

It is also a hazard in your own code: two `interface User` declarations in one
scope silently become one type, and the error surfaces somewhere else entirely.

## Difference 2 — only a type alias can be a union

```ts
type Id = string | number;      // fine
interface IId extends Id {}     // error
```

```console
src-ex4/union.ts(2,23): error TS2312: An interface can only extend an object type or intersection of object types with statically known members.
```

An interface always describes an object shape. Unions, tuples, primitives,
mapped types, conditional types and template literal types are alias-only:

```ts
type Status = 'pending' | 'shipped';
type Pair = [number, number];
type Getters<T> = { [K in keyof T as `get${Capitalize<string & K>}`]: () => T[K] };
```

Since discriminated unions are the main modelling tool in the language
([05](./05-union-types.md)), a large share of your types must be aliases.

## Difference 3 — extends vs intersection on conflict

```ts
interface A { x: string }
interface B extends A { x: number }
// error TS2430: Interface 'B' incorrectly extends interface 'A'.

type TA = { x: string };
type TB = TA & { x: number };   // no error — TB['x'] is `string & number`, i.e. never
```

`extends` **checks** compatibility and reports the conflict at the declaration.
An intersection silently produces an impossible type, and you find out at the
call site when nothing is assignable to it.

For layered domain shapes, that makes `extends` the safer default.

## Error messages — the folklore that did not reproduce

The received wisdom is that interfaces produce nicer errors because aliases get
expanded into their full shape. Measured on a simple alias, both report by name:

```console
src-ex4/errshape.ts(5,7): error TS2741: Property 'weightKg' is missing in type '{ id: string; }' but required in type 'IParcel'.
src-ex4/errshape.ts(6,7): error TS2741: Property 'weightKg' is missing in type '{ id: string; }' but required in type 'TParcel'.
```

Identical, name for name. The folklore is not baseless — an alias built from
intersections, mapped or conditional types **can** be expanded in a message,
because there is no single name to print. But a plain object alias is not, and
"interfaces give better errors" is not a reason to pick one here.

## Which to use

| Situation | Use |
|---|---|
| A union, tuple, primitive alias, or anything type-level | **`type`** — the only option |
| A public API others may need to augment | **`interface`** — merging is the extension point |
| An object shape in application code | Either. Pick one and be consistent |
| Layered shapes where a conflict should error | **`interface extends`** |
| Props, config objects, function types | Either; `type` composes more predictably |

A defensible house rule: **`type` by default, `interface` when you want merging
or `extends` checking.** The opposite rule is equally defensible. What is not
defensible is mixing them arbitrarily in one codebase — the inconsistency costs
more than either choice.

## Trade-off

**`interface`** buys declaration merging (essential for augmenting other people's
types) and conflict-checked `extends`. It costs the ability to express anything
that is not an object shape.

**`type`** buys the whole type language — unions, mapped, conditional, template
literal types — and refuses to merge, which is safer inside your own codebase and
useless when you need to augment a dependency.

## Gotchas

**Symptom:** `Duplicate identifier 'X'`
**Cause:** Two type aliases share a name.
**Fix:** Rename one. If you *wanted* the combination, an interface merges instead.

**Symptom:** A type gained a property nobody added
**Cause:** Declaration merging — another `interface` with the same name, possibly
in a `.d.ts`.
**Fix:** Search the name across the repo including declaration files. Prefer
aliases inside your own code where merging is never intended.

**Symptom:** `An interface can only extend an object type…` (`TS2312`)
**Cause:** Extending a union or another non-object type.
**Fix:** Use a type alias with `&`, or restructure the union.

**Symptom:** An intersection produced a property nothing can satisfy
**Cause:** Conflicting members intersected to `never` (`string & number`).
**Fix:** `interface extends` would have reported it at the declaration —
`TS2430`.

**Symptom:** Module augmentation has no effect
**Cause:** You augmented a `type` alias, or the file is not part of the program.
**Fix:** Augmentation requires an `interface` and a file the compiler includes
([Phase 0 · project layout](../phase-0-how-typescript-runs/11-project-layout.md)).

## Interview questions

**★ What is the real difference between `type` and `interface`?**
Three: interfaces merge across declarations and aliases error with
`TS2300: Duplicate identifier`; only aliases can express unions, tuples, mapped
and conditional types; and `interface extends` reports a member conflict
(`TS2430`) where an intersection silently produces `never`.

**★ When do you *need* an interface?**
When something must be augmentable — adding `user` to `Express.Request`, typing
your own `ProcessEnv` keys, letting a plugin extend a library's options.
Declaration merging is the mechanism, and only interfaces have it.

**★ When do you *need* a type alias?**
For anything that is not an object shape: unions (so, most domain modelling),
tuples, primitive aliases, and every type-level construct — mapped, conditional
and template literal types.

**Is it true that interfaces give better error messages?**
Not as a rule. Measured on a simple object alias, both produced the identical
`TS2741 … but required in type 'TParcel'` naming the alias. Aliases built from
intersections or mapped types can be expanded in messages because there is no
single name to print — that is the grain of truth behind the claim.

**Why can an intersection be more dangerous than `extends`?**
`extends` checks the parent-child relationship and errors on a conflict at the
declaration. An intersection just combines, so `{ x: string } & { x: number }`
gives `x: never` — a type nothing satisfies, discovered later and further away.

---

← Prev: [`any`, `unknown`, `never`, `void`](./06-any-unknown-never-void.md) · Next → [Function types](./08-function-types.md)
