---
title: "The loop"
sidebar_label: "01 · The loop"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the **TypeScript handbook** (*Mapped Types*), whose
> `OptionsFlags`, `Features` and `FeatureOptions` examples are **quoted
> verbatim**, and the **TypeScript 2.1 release notes**, whose definition of a
> mapped type and its `Readonly` / `Deferred` / `Proxify` examples are also
> quoted verbatim. **No console block** — no sandbox run covers this phase.

## The one thing to understand first

A mapped type is **a loop over a union of keys that produces properties**. The
2.1 release notes, which introduced the feature, put it in one sentence:

> "Mapped Types are produced by taking a union of literal types, and computing a
> set of properties for a new object type. They're like list comprehensions in
> Python, but instead of producing new elements in a list, they produce new
> properties in a type."

Two halves worth separating, because almost every mistake in this phase is a
confusion between them:

- **What you iterate** — a union of keys, usually `keyof Type`, but any union of
  `string`, `number` or `symbol` literals will do.
- **What you produce** — the type of the property, written on the right of the
  colon, computed from the key however you like.

## The syntax, and where it comes from

```ts
type OptionsFlags<Type> = {
  [Property in keyof Type]: boolean;
};
```

That is **index-signature syntax with `in` instead of `:`**. An index signature
says "every key of this type has this value type":

```ts
type Dictionary = { [key: string]: number };   // index signature — all string keys
type Flags<T>   = { [K in keyof T]: boolean }; // mapped type — one key at a time
```

The difference is that the index signature describes an *open* set of keys, while
the mapped type enumerates a *closed* one — it produces exactly the properties
that `keyof T` contains, and nothing else. Knowing they share syntax is what
makes the shape recognisable; knowing they mean different things is what stops
you writing the wrong one.

The handbook's example, verbatim:

```ts
type Features = {
  darkMode: () => void;
  newUserProfile: () => void;
};

type FeatureOptions = OptionsFlags<Features>;
// type FeatureOptions = {
//   darkMode: boolean;
//   newUserProfile: boolean;
// }
```

Read it as a loop: *for each `Property` in `"darkMode" | "newUserProfile"`,
produce a property of that name whose type is `boolean`.*

## Reading the parts

```ts
type Deferred<T> = {
  [P in keyof T]: Promise<T[P]>;
};
```

That is the whole vocabulary of the phase in one line, and every piece already
has a home earlier in the corpus:

| Piece | What it is | Where it was taught |
|---|---|---|
| `keyof T` | the union of `T`'s property names | [phase 3 · `keyof`](../../phase-3-generics/04-keyof/README.md) |
| `P in …` | the loop variable, bound to one key per iteration | this page |
| `T[P]` | indexed access — the type of that property | [phase 3 · indexed access types](../../phase-3-generics/06-indexed-access-types.md) |
| `Promise<T[P]>` | anything you like, computed from `P` and `T[P]` | this page |

**A mapped type is `keyof` and indexed access, in a loop.** If either of those
two is shaky, that is the thing to fix — nothing here will make sense on top of a
vague understanding of `keyof`.

The 2.1 notes' third example shows that the value side is arbitrary:

```ts
// Wrap proxies around properties of T
type Proxify<T> = {
  [P in keyof T]: { get(): T[P]; set(v: T[P]): void };
};
```

The key stays; the value becomes a two-method object built from the original.
Nothing about the loop changes — only the expression on the right.

## The identity mapping, and why it matters

The smallest useful mapped type does nothing at all:

```ts
type Identity<T> = { [K in keyof T]: T[K] };
```

It is worth knowing because it is the **skeleton every other mapped type is a
variation of**, and because it has one real use: it forces the compiler to
display a computed type as a flat object rather than as a chain of aliases and
intersections. That trick has a name in the wild — `Prettify`, `Simplify`,
`Expand` — and it is the same identity mapping:

```ts
type Prettify<T> = { [K in keyof T]: T[K] } & {};
```

Nothing is added. What changes is what your editor prints on hover, which is a
real problem worth solving — see **08 · Knowing when to stop** *(not written
yet)* for the argument that readable output is a feature, not a nicety.

## You can iterate any union, not just `keyof`

`keyof Type` is the common case, not the rule. The loop takes any union of key
types:

```ts
type Method = "get" | "post" | "put";

type Handlers = {
  [M in Method]: (body: unknown) => void;
};
// { get: (body: unknown) => void; post: …; put: … }
```

This is exactly how `Record` is built, and it is the reason `Record<K, V>`
behaves differently from `Partial<T>` in ways topic 03 has to explain — one loops
over a union you supplied, the other over the keys of a type you supplied.

The union may also be narrowed on the way in, which is how `Pick` works:

```ts
type Pick2<T, K extends keyof T> = { [P in K]: T[P] };
```

The constraint `K extends keyof T` is doing the safety work: the loop runs over
`K`, and `T[P]` is only legal because every `P` in `K` is known to be a key of
`T`.

## Only a `type` can do this

A mapped type is a **computation**, and only a type alias can hold one:

```ts
interface Bad<T> {
  [K in keyof T]: T[K];   // ❌ not valid in an interface
}
```

This is one of the few genuinely capability-level differences between `type` and
`interface` ([phase 1 · topic 07](../../phase-1-type-vocabulary/07-type-vs-interface.md)),
and the reason every type in this phase is written with `type`. An interface can
*extend* the result of a mapped type, but it cannot contain the mapping.

## Gotchas

**Symptom:** `TS7061` — *"A mapped type may not declare properties or methods."*
**Cause:** A mapped type is the *whole* object type; you cannot add a fixed
property beside the loop.
**Fix:** Intersect instead — `type WithId<T> = { [K in keyof T]: T[K] } & { id: string }`.

**Symptom:** The mapping produces `{}` or far fewer keys than expected
**Cause:** `keyof T` is not what you assumed. `keyof` on a union gives only the
*shared* keys; on `any` it is `string | number | symbol`; on a primitive it is
that primitive's methods.
**Fix:** Hover `keyof T` first and confirm the key union before debugging the
loop.

**Symptom:** `T[P]` is rejected inside the loop
**Cause:** The loop is running over a union that is not constrained to `keyof T`.
**Fix:** Constrain it — `K extends keyof T` — or index with a key you know is
present.

**Symptom:** The mapped type is written in an `interface` and does not compile
**Cause:** Interfaces cannot contain a mapping.
**Fix:** Use `type`. An interface may extend the alias afterwards.

**Symptom:** A mapped type over a union input produces a surprising result
**Cause:** A *homomorphic* mapped type distributes over a union rather than
collapsing it — see [chunk 02](./02-modifiers.md).
**Fix:** Wrap it to stop distribution, or map over `keyof (A | B)` deliberately.

**Symptom:** Hover shows `OptionsFlags<Features>` instead of the resolved object
**Cause:** The compiler defers displaying a mapped type until it needs to.
**Fix:** The identity-mapping `Prettify` trick above forces the flat form.

## Interview questions

**★ What is a mapped type, in one sentence?**
A loop that takes a union of keys and produces one property per key in a new
object type — the release notes call it a list comprehension for types. The
canonical form is `{ [K in keyof T]: T[K] }`, which is `keyof` and indexed access
in a loop.

**★ How does mapped-type syntax relate to an index signature?**
They share the bracket syntax, and that is deliberate: `[key: string]: number` is
an index signature describing an *open* set of keys, `[K in keyof T]: T[K]` is a
mapped type enumerating a *closed* one. The `in` is the difference. An index
signature admits any string key; a mapped type produces exactly the keys it
iterated.

**★ Why must a mapped type be a `type` and not an `interface`?**
Because it is a computation, and interfaces can only declare members — this is one
of the real capability differences between the two. An interface can extend the
result of a mapped type, but the mapping itself has to live in a type alias.

**What can you iterate over besides `keyof T`?**
Any union of `string`, `number` or `symbol` types — a literal union like
`"get" | "post"`, a type parameter constrained to `keyof T`, or the result of
another computed type. `Record` loops over a union you pass in; `Pick` loops over
a constrained subset of `keyof T`.

**What does the identity mapping `{ [K in keyof T]: T[K] }` achieve, given it
changes nothing?**
It changes what the editor prints. A type built from intersections and aliases
hovers as the chain that produced it; passing it through an identity mapping
makes the compiler display a single flat object. That is the `Prettify` /
`Simplify` helper you see in library code — no semantics, all readability.

**How do you add a fixed property to a mapped type?**
Intersect: `{ [K in keyof T]: T[K] } & { id: string }`. A mapped type describes
the entire object, so a literal member cannot sit beside the loop.

---

← [Topic index](./README.md) · Next → [02 · Modifiers](./02-modifiers.md)
