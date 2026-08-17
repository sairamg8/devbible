---
title: "Key remapping — `as` in a mapped type"
sidebar_label: "04 · Key remapping with `as`"
sidebar_position: 4
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the **TypeScript handbook** (*Mapped Types* — *Key
> Remapping via `as`*), whose `MappedTypeWithNewProperties`, `Getters`/`Person`/
> `LazyPerson`, `RemoveKindField`/`Circle` and `EventConfig`/`Config` examples are
> **quoted verbatim**, and the **4.1 release notes**, which introduced the clause
> alongside template literal types. **No console block** — no sandbox run covers
> this phase.

[Topic 01](./01-mapped-types/README.md) established that a mapped type produces
one property per key it iterates, and that it cannot skip a key or rename one.
The `as` clause, added in TypeScript 4.1, is what removes both restrictions.

## The syntax

```ts
type MappedTypeWithNewProperties<Type> = {
  [Properties in keyof Type as NewKeyType]: Type[Properties];
};
```

Read it as *"for each `Properties` in `keyof Type`, **call the result
`NewKeyType`** and give it this value type"*. The loop variable still ranges over
the original keys — `Type[Properties]` still works — but the key that comes out
is whatever the `as` expression evaluates to.

Three things follow, and they are the whole topic:

1. **Rename a key** by computing a new string from it.
2. **Drop a key** by mapping it to `never`.
3. **Key by something other than the original key**, such as a discriminant.

## 1 · Renaming: template literals over keys

The handbook's example, verbatim:

```ts
type Getters<Type> = {
  [Property in keyof Type as `get${Capitalize<string & Property>}`]: () => Type[Property]
};

interface Person {
  name: string;
  age: number;
  location: string;
}

type LazyPerson = Getters<Person>;
// type LazyPerson = {
//   getName: () => string;
//   getAge: () => number;
//   getLocation: () => string;
// }
```

Two details worth stopping on:

- **`string & Property` is not decoration.** `keyof Type` can include `number` and
  `symbol`, and `Capitalize` only accepts strings, so the intersection narrows the
  key before the intrinsic sees it. Without it, this does not compile.
- **The value can use `Property` too.** `() => Type[Property]` types each getter
  with *that* property's type, which is what makes the result useful rather than
  decorative.

The same shape produces setters, event names, action creators and prefixed config
keys:

```ts
type Setters<T> = {
  [K in keyof T as `set${Capitalize<string & K>}`]: (value: T[K]) => void
};

type Events<T> = {
  [K in keyof T as `on${Capitalize<string & K>}Change`]: (value: T[K]) => void
};
```

**07 · Template literal types** *(not written yet)* covers the string side of
this properly — pattern matching on strings, `infer` inside a template, and the
four case intrinsics.

## 2 · Filtering: map the key to `never`

> "You can filter out keys by producing `never` via a conditional type."

```ts
type RemoveKindField<Type> = {
  [Property in keyof Type as Exclude<Property, "kind">]: Type[Property]
};

interface Circle {
  kind: "circle";
  radius: number;
}

type KindlessCircle = RemoveKindField<Circle>;
// type KindlessCircle = {
//   radius: number;
// }
```

A key that becomes `never` produces no property. That single rule replaces the
older two-step dance of computing a key union first and then `Pick`ing it — and
it is more expressive, because the test can look at the **value** as well as the
key:

```ts
// Keep only the function-valued properties
type MethodsOnly<T> = {
  [K in keyof T as T[K] extends Function ? K : never]: T[K]
};

// Drop everything the API should not expose
type PublicShape<T> = {
  [K in keyof T as K extends `_${string}` ? never : K]: T[K]
};
```

`MethodsOnly` is the readable modern form of the
`{ [K in keyof T]: … }[keyof T]` key-selection idiom from
[topic 02 · chunk 03](./02-conditional-types/03-composing.md). Both are worth
recognising: the old one still appears everywhere in library code written before
4.1.

## 3 · Keying by something else entirely

The most surprising use, and the one that reads least like the others —
verbatim:

```ts
type EventConfig<Events extends { kind: string }> = {
  [E in Events as E["kind"]]: (event: E) => void;
}

type SquareEvent = { kind: "square", x: number, y: number };
type CircleEvent = { kind: "circle", radius: number };

type Config = EventConfig<SquareEvent | CircleEvent>;
// type Config = {
//   square: (event: SquareEvent) => void;
//   circle: (event: CircleEvent) => void;
// }
```

Look at what is being iterated: **`E in Events`, not `E in keyof Events`.** The
loop runs over the *members of a union*, and each member's discriminant becomes
the key. That turns a discriminated union into a handler map, with each handler
typed for exactly its own event — and adding a member to the union adds a
required handler.

This is the single best argument for the feature. Written by hand, that map
drifts from the union within a sprint.

## What it costs: homomorphism

A mapping with an `as` clause is **not homomorphic**, so it loses the three
behaviours [topic 01 · chunk 02](./01-mapped-types/02-modifiers.md) lists:
modifier preservation, array-and-tuple preservation, and union distribution.

```ts
type Renamed<T> = { [K in keyof T as `new_${string & K}`]: T[K] };

type Source = { readonly id: string; name?: string };
type Result = Renamed<Source>;
// keys renamed — and `readonly` and `?` are gone
```

If you need them back, say so explicitly:

```ts
type Renamed<T> = { readonly [K in keyof T as `new_${string & K}`]?: T[K] };
```

**That is a blunt instrument** — it forces `readonly` and `?` onto *every*
property rather than preserving each one's original state, and there is no way to
preserve them per-property through a remap. When per-property modifiers matter,
remap after the fact with an intersection, or do not remap at all.

## Collisions

Two keys can map to the same new key, and the result is not an error:

```ts
type Collide<T> = { [K in keyof T as "same"]: T[K] };
type C = Collide<{ a: string; b: number }>;   // { same: string | number }
```

The values are unioned. That is occasionally what you want and usually a sign the
remap expression is not injective — a prefix that strips information, or a
conditional that funnels several keys into one name. Nothing warns you.

## Gotchas

**Symptom:** `Capitalize<Property>` does not compile inside an `as` clause
**Cause:** `keyof T` may include `number` and `symbol`; the string intrinsics
require a string.
**Fix:** `Capitalize<string & Property>`, as the handbook's own example does.

**Symptom:** The remapped type lost every `readonly` and `?`
**Cause:** An `as` clause makes the mapping non-homomorphic.
**Fix:** Re-apply them explicitly, accepting that it is all-or-nothing, or avoid
the remap.

**Symptom:** Filtering with `never` removed nothing
**Cause:** The conditional is producing the key in both branches — check that the
false branch is exactly `never`, not `undefined` or the key itself.
**Fix:** `K extends Pattern ? never : K`, and hover the result for one known key.

**Symptom:** Two properties merged into one
**Cause:** The remap expression maps both keys to the same new key; the values are
unioned silently.
**Fix:** Make the expression injective — keep something key-specific in the new
name.

**Symptom:** `[E in Events as E["kind"]]` errors
**Cause:** `Events` is not constrained to have a `kind`, so `E["kind"]` is not a
valid indexed access.
**Fix:** Constrain it — `Events extends { kind: string }` — exactly as the
handbook does.

**Symptom:** A remapped key is `string` rather than a literal
**Cause:** Something upstream widened the key — a `string` in the union, or a
template literal with an unconstrained parameter.
**Fix:** Constrain the input to literal types; check with `as const` at the source.

**Symptom:** The result has an index signature you did not ask for
**Cause:** The source type has one, and it maps through the `as` clause too.
**Fix:** Filter it out — a key that is exactly `string` can be mapped to `never`.

**Symptom:** Errors mentioning the remapped type print an unreadable object
**Cause:** The result is a computed type with no name.
**Fix:** Alias it at the point of use, or apply the `Prettify` identity mapping
from [topic 01 · chunk 01](./01-mapped-types/01-the-loop.md).

## Interview questions

**★ What does `as` add to a mapped type?**
It computes the key that comes out, so a mapping can now **rename** keys, **drop**
them (by producing `never`), or key the result by something else entirely — such
as a union member's discriminant. Before 4.1, renaming was impossible and
dropping meant computing a key union first and then `Pick`ing it.

**★ How do you filter properties out of a mapped type?**
Map the unwanted key to `never` in the `as` clause: the handbook's
`Exclude<Property, "kind">`, or a conditional that tests the value type —
`[K in keyof T as T[K] extends Function ? K : never]`. A key of `never` produces
no property at all.

**★ What does an `as` clause cost you?**
Homomorphism. The mapping is no longer the plain `[K in keyof T]` form, so it
stops preserving `readonly` and `?`, stops mapping arrays and tuples to arrays and
tuples, and stops distributing over unions. Re-applying the modifiers is possible
but all-or-nothing — there is no way to preserve each property's original
modifiers through a remap.

**Why does the handbook write `Capitalize<string & Property>` rather than
`Capitalize<Property>`?**
Because `keyof Type` can contain `number` and `symbol` keys, and the string
intrinsics only accept strings. Intersecting with `string` narrows the key to its
string members before `Capitalize` sees it.

**Explain `[E in Events as E["kind"]]`.**
The loop iterates the *members of a union*, not the keys of an object, and uses
each member's discriminant as the key of the result. It turns a discriminated
union of events into a handler map where every handler is typed for its own event,
and adding a member to the union makes a new handler required.

**What happens when two keys remap to the same name?**
Their value types are unioned into one property, silently. It is legal and
occasionally intended, but it usually means the remap expression is losing
information — a prefix or conditional that funnels several keys to one name.

---

← [Phase 5 index](./README.md) · Prev: [03 · The built-in utility types](./03-utility-types/README.md) · Next → **05 · Distributive conditional types** *(not written yet)*
