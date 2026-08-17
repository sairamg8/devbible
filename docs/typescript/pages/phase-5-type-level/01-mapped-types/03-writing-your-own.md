---
title: "Writing your own"
sidebar_label: "03 · Writing your own"
sidebar_position: 3
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the **TypeScript handbook** (*Mapped Types* —
> *Further Exploration*), whose `ExtractPII` / `DBFields` example is **quoted
> verbatim**, and the **TypeScript 2.1 release notes**, whose `Deferred` and
> `Proxify` examples are quoted verbatim. The `lib.es5.d.ts` definitions named
> here are the ones the 2.1 and 2.8 notes state. **No console block** — no
> sandbox run covers this phase.

[Chunk 01](./01-the-loop.md) was the loop and [chunk 02](./02-modifiers.md) the
modifiers. Everything left is the **value expression** — the part after the colon,
which can be any type at all, computed from the key, the original value type, or
neither.

This chunk is the one to work through with an editor open. The mechanism is
small; the fluency is in having written six of them.

## The value can be anything

```ts
// Same property names, but make the value a promise instead of a concrete one
type Deferred<T> = {
  [P in keyof T]: Promise<T[P]>;
};
```

```ts
// Wrap proxies around properties of T
type Proxify<T> = {
  [P in keyof T]: { get(): T[P]; set(v: T[P]): void };
};
```

Both from the 2.1 notes, and between them they cover the two shapes you will
write most: **wrap the value** (`Promise<T[P]>`, `Array<T[P]>`, `Ref<T[P]>`) and
**replace the value with a structure built from it** (a getter/setter pair, a
validator, a form field).

Three more that come up constantly, none of which is in the standard library:

```ts
type Nullable<T>   = { [P in keyof T]: T[P] | null };
type Stringify<T>  = { [P in keyof T]: string };
type Handlers<T>   = { [P in keyof T]: (value: T[P]) => void };
```

`Handlers` is worth a second look: the parameter type is `T[P]`, so each callback
is typed with *that specific property's* type. This is the shape behind every
typed event map and every `onChange` bag you have used.

## The value can depend on the key's type

The value expression sees `T[P]`, so it can branch on it with a conditional type.
The handbook's own example, verbatim:

```ts
type ExtractPII<Type> = {
  [Property in keyof Type]: Type[Property] extends { pii: true } ? true : false;
};

type DBFields = {
  id: { format: "incrementing" };
  name: { type: string; pii: true };
};

type ObjectsNeedingGDPRDeletion = ExtractPII<DBFields>;
// type ObjectsNeedingGDPRDeletion = {
//   id: false;
//   name: true;
// }
```

That is a mapped type and a conditional type composed, and it is the pattern most
real helper types are made of. Conditional types get their own page — **02 ·
Conditional types** *(not written yet)* — but the composition is worth meeting
here, because a mapped type whose value never branches is rare in practice.

A second, very common form of the same idea keeps the value and only *tests* it:

```ts
type ReadonlyDeep1<T> = {
  readonly [P in keyof T]: T[P] extends object ? ReadonlyDeep1<T[P]> : T[P];
};
```

Recursion is legal and useful, and it is also where the phase's discipline starts
to matter — see [12 · `DeepPartial` / `DeepReadonly`](../12-deep-helpers/README.md) for
what this costs in error messages and editor responsiveness.

## Building the standard utilities from an empty file

This is the phase gate, so it is worth doing deliberately rather than reading:

```ts
type MyPartial<T>  = { [P in keyof T]?: T[P] };
type MyRequired<T> = { [P in keyof T]-?: T[P] };
type MyReadonly<T> = { readonly [P in keyof T]: T[P] };
type MyMutable<T>  = { -readonly [P in keyof T]: T[P] };

type MyPick<T, K extends keyof T> = { [P in K]: T[P] };
type MyRecord<K extends keyof any, V> = { [P in K]: V };
```

Two observations that are the whole reason to write them out:

- **`Pick` loops over `K`, not over `keyof T`.** That is what makes it a subset,
  and it is why the constraint `K extends keyof T` is load-bearing: without it,
  `T[P]` would not type-check and a caller could ask for a key that does not
  exist.
- **`Record` is not homomorphic.** It loops over a union you supplied and has no
  `T` to take modifiers from, which is why `Record<K, V>` never preserves
  anything — there is nothing to preserve. Contrast that with `Partial<T>`,
  which does. Same syntax; different relationship to the input.

`Omit` is the odd one out, and deliberately left for topic 03 — it is built from
`Pick` and `Exclude`, so it needs a conditional type, and it is the standard
example of a utility that is *not* a plain mapping.

## Two patterns worth stealing

**A form state derived from a model.** One type in, three related types out, all
guaranteed to move together:

```ts
type Model = { name: string; age: number; subscribed: boolean };

type FormValues<T> = { [K in keyof T]: T[K] };
type FormErrors<T> = { [K in keyof T]?: string };
type FormTouched<T> = { readonly [K in keyof T]: boolean };
```

The point is not the individual types — it is that adding a field to `Model`
updates all three, and forgetting to handle it becomes a compile error at the
place that consumes them.

**A capability map keyed by a literal union.** The non-homomorphic form, used
when the keys are the source of truth rather than a type:

```ts
type Role = "admin" | "editor" | "viewer";

type Permissions = {
  [R in Role]: readonly string[];
};

const permissions: Permissions = {
  admin: ["read", "write", "delete"],
  editor: ["read", "write"],
  viewer: ["read"],
  // omit one and the object literal fails to compile
};
```

The value of this over an index signature is exhaustiveness: add `"auditor"` to
`Role` and every `Permissions` object in the codebase stops compiling until it is
handled. An index signature `{ [role: string]: string[] }` would accept the
incomplete object silently.

## Gotchas

**Symptom:** A wrapped value type lost its optionality
**Cause:** `Promise<T[P]>` on an optional property gives `Promise<T[P]> | undefined`
in `strictNullChecks`, because `T[P]` already includes `undefined`.
**Fix:** Intended most of the time. If not, strip it — `Promise<Exclude<T[P], undefined>>`.

**Symptom:** A recursive mapped type never terminates, or reports `TS2589`
**Cause:** No base case — every branch recurses, including for primitives and
built-ins like `Date` and `Function`.
**Fix:** Guard the recursion with a conditional (`T[P] extends object ? … : T[P]`)
and exclude the built-ins you do not want walked. See [09 · Type-level
performance](../09-type-level-performance/README.md).

**Symptom:** `Record<K, V>` did not preserve `readonly` from the source type
**Cause:** There is no source type — `Record` loops over a key union, so it is
not homomorphic and has nothing to preserve.
**Fix:** Expected. Use a homomorphic mapping if preservation is what you want.

**Symptom:** `Pick<T, K>` rejects a key that visibly exists
**Cause:** `K` is being inferred as `string` rather than as a literal — usually a
`const` without `as const`, or a widened variable.
**Fix:** `as const`, or pass the literal type explicitly.

**Symptom:** A conditional inside a mapped type produces `boolean` instead of
`true` or `false`
**Cause:** The property's type is a union, and the conditional distributed over
it, producing `true | false`.
**Fix:** Stop the distribution with the bracket trick — `[T[P]] extends [X] ? … : …`.
Covered on [05 · Distributive conditional types](../05-distributive-conditionals.md).

**Symptom:** The mapped type over a model type includes methods you did not want
**Cause:** `keyof T` includes every member, methods among them.
**Fix:** Filter by value type with a key-remapping `as` clause (topic 04), or map
over an explicit key union.

## Interview questions

**★ Write `Pick` and `Record` from memory, and say how they differ.**
`type Pick<T, K extends keyof T> = { [P in K]: T[P] }` and
`type Record<K extends keyof any, V> = { [P in K]: V }`. Both loop over a key
union rather than over `keyof T` directly, so **neither is homomorphic**. `Pick`
still reaches back into `T` for each value type and needs the
`K extends keyof T` constraint to do it; `Record` never looks at a source type at
all, which is why it has no modifiers to preserve.

**★ How do you make a mapped type's value depend on the original property's
type?**
Put a conditional type in the value position:
`{ [P in keyof T]: T[P] extends { pii: true } ? true : false }` — the handbook's
`ExtractPII`. The value expression can use both `P` and `T[P]`, so it can branch,
recurse, or build a new structure from either.

**★ Why is `Omit` not just a mapped type?**
Because it has to *remove* keys, and the plain loop has no way to skip one. It is
defined as `Pick<T, Exclude<keyof T, K>>` — a conditional type computes the
remaining key union, then a mapping loops over it. The alternative, filtering with
an `as` clause that maps unwanted keys to `never`, arrived later with key
remapping.

**When would you use a mapped type over a literal union instead of over
`keyof T`?**
When the keys are the source of truth — a role list, a set of event names, a
config section. The payoff is exhaustiveness: adding a member to the union breaks
every object that has not handled it, which an index signature would not do. The
cost is that the mapping is non-homomorphic, so there are no modifiers to
inherit.

**Give a practical use for mapping one model into several related types.**
Form state: `FormValues<T>`, `FormErrors<T>` (all optional strings) and
`FormTouched<T>` (all `readonly boolean`) derived from one `Model`. Adding a field
to the model updates all three at once, and the compiler points at every place
that has not caught up — which is the whole argument for computing types instead
of writing them out.

**What is the danger of a recursive mapped type?**
It walks everything, including `Date`, `Function`, `Map` and arrays, unless you
give it a base case — and the resulting type is large enough to slow the checker
and to produce error messages nobody can read. `TS2589` (*"Type instantiation is
excessively deep and possibly infinite"*) is the compiler's version of the
complaint; the readability cost arrives long before that.

---

← Prev: [02 · Modifiers](./02-modifiers.md) · Next → [04 · Limits and misreadings](./04-limits.md)
