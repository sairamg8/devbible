---
title: "The object shapers"
sidebar_label: "02 · The object shapers"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the **TypeScript handbook** (*Utility Types* —
> `Partial`, `Required`, `Readonly`, `Record`, `Pick`, `Omit`), whose one-line
> descriptions are quoted, and the **2.8 release notes** for `Required`'s
> definition. `TS2540` and `TS2339` are read out of the compiler's own message
> table and confirmed present in **TypeScript 7.0.2**. **No console block.**

Five mapped types and one composite. Their construction is
[topic 01](../01-mapped-types/03-writing-your-own.md)'s subject and is not
repeated here — **this chunk is what they do to a real codebase, and where each
one lies to you.**

## `Partial<T>` — and the update-shaped hole in it

> "Constructs a type with all properties of `Type` set to optional."

The overwhelmingly common use is a patch object:

```ts
function update(id: string, changes: Partial<Todo>): Promise<Todo> { /* … */ }
```

Two things it does not say, and both cause bugs:

**1. `Partial` permits the empty object.** `update("1", {})` compiles and does
nothing. If at least one field is required, `Partial` is the wrong type — you
want "at least one key", which the standard library does not have:

```ts
type AtLeastOne<T> = { [K in keyof T]: Pick<T, K> }[keyof T];

function update(id: string, changes: AtLeastOne<Todo>): Promise<Todo> { /* … */ }
```

That is the key-selection idiom from
[topic 02 · chunk 03](../02-conditional-types/03-composing.md) used to produce a
union of single-key objects.

**2. `Partial` is shallow.** `Partial<Config>` makes the top-level keys optional
and leaves every nested object fully required, which is almost never what a
config-merge function wants. That is topic 12's subject and its warning label.

Under `exactOptionalPropertyTypes`, one more distinction appears: `Partial<T>`
makes a property *absent-able*, not settable to `undefined`. `{ title: undefined }`
is then an error where `{}` is fine — which is usually the intent, and a surprise
the first time.

## `Required<T>` — and what it does to `undefined`

> "Constructs a type consisting of all properties of `Type` set to required. The
> opposite of `Partial`."

```ts
type Required<T> = { [P in keyof T]-?: T[P] };
```

The `-?` also strips `undefined` from the property's type in `strictNullChecks`
mode, which the 2.8 notes state directly and
[topic 01 · chunk 02](../01-mapped-types/02-modifiers.md) quotes. So
`Required<{ a?: string }>` is `{ a: string }`, not `{ a: string | undefined }`.

⚠️ **It does not strip `undefined` from a property that was never optional.**
`Required<{ a: string | undefined }>` keeps the union — there is no `?` to remove.
The two look identical in a hover and behave differently, which is the single
most confusing thing about this utility.

## `Readonly<T>` — shallow, and compile-time only

> "Constructs a type with all properties of `Type` set to `readonly`"

```ts
const todo: Readonly<Todo> = { title: "Delete inactive users" };
todo.title = "Hello";   // ❌ TS2540
```

> **`TS2540`: Cannot assign to `'{0}'` because it is a read-only property.**

Two limits worth stating plainly:

- **Shallow.** `Readonly<{ user: { name: string } }>` still allows
  `config.user.name = "x"`. Deep immutability needs a recursive mapping
  (topic 12).
- **Compile-time only.** `readonly` disappears at runtime; nothing stops
  `Object.assign`, a cast, or a JSON round-trip. `Object.freeze` is the runtime
  half, and its type signature returns `Readonly<T>` — which is the pairing worth
  using when the guarantee has to be real.

## `Record<Keys, Type>` — the one that is not homomorphic

> "Constructs an object type whose property keys are `Keys` and whose property
> values are `Type`."

Two very different uses hide behind one name:

```ts
type Roles = Record<"admin" | "editor", string[]>;   // exhaustive: 2 keys, both required
type Cache = Record<string, User>;                   // open: any string key
```

The first is a **closed map** and is genuinely useful: add a member to the key
union and every object literal fails until it is handled. The second is an
**index signature in disguise**, and it carries the index-signature trap:

```ts
const cache: Record<string, User> = {};
cache["nobody"].name;    // ✅ compiles — and throws at runtime
```

`noUncheckedIndexedAccess` is the flag that fixes it, by making every indexed read
`User | undefined`. Without it, `Record<string, T>` promises a value for every
string in existence.

**Prefer `Map` when the keys are data** — user ids, request ids, anything unbounded
— and keep `Record` for closed key unions where exhaustiveness is the point.

## `Pick<T, K>` and `Omit<T, K>` — the asymmetric pair

> `Pick`: "Constructs a type by picking the set of properties `Keys` from
> `Type`." · `Omit`: "Constructs a type by picking all properties from `Type` and
> then removing `Keys`. The opposite of `Pick`."

They look like mirror images and are not, in one way that matters:

```ts
type A = Pick<Todo, "titel">;   // ❌ TS2344 — "titel" is not a key of Todo
type B = Omit<Todo, "titel">;   // ✅ compiles, removes nothing
```

`Pick`'s `K` is constrained to `keyof T`; `Omit`'s is `keyof any`. The looseness
is deliberate — it lets `Omit` be used on union types where a key is not present
on every member — but it means **a typo in an `Omit` silently does nothing**.
Where that matters:

```ts
type StrictOmit<T, K extends keyof T> = Omit<T, K>;
```

Two more behaviours worth knowing:

- **`Omit` is not distributive.** `Omit<A | B, "id">` collapses the union into one
  object type built from the shared keys, rather than omitting from each member.
  If you need per-member behaviour, distribute explicitly:
  `type DistOmit<T, K extends keyof any> = T extends any ? Omit<T, K> : never`.
  This is the most common real-world surprise in this chunk, and it silently
  destroys discriminated unions.
- **Both lose homomorphism**, so neither preserves `readonly` or `?` from `T`… with
  one wrinkle: `Pick` *does* keep the modifiers of the properties it picks,
  because it reads `T[P]` and the modifier travels with the declaration. What is
  lost is the *array/tuple* and *distribution* behaviour.

## Choosing between them

| You want | Use |
|---|---|
| A patch object where every field is optional | `Partial<T>` |
| A patch object with at least one field | the `AtLeastOne` idiom above |
| To fill in a config with defaults | `Required<T>` on the result, `Partial<T>` on the input |
| An exhaustive map over a closed key union | `Record<Union, V>` |
| A lookup keyed by data | `Map`, or `Record<string, V>` **with** `noUncheckedIndexedAccess` |
| A DTO that is a subset of a model | `Pick<T, …>` — it fails on a typo |
| A model minus internal fields | `Omit<T, …>` — but consider `StrictOmit` |
| A discriminated union minus a field | a **distributive** `Omit`, never the plain one |

## Gotchas

**Symptom:** An update function accepts `{}` and does nothing
**Cause:** `Partial<T>` permits the empty object.
**Fix:** The `AtLeastOne<T>` idiom, or a required discriminator alongside the
partial payload.

**Symptom:** `Partial` did not make nested fields optional
**Cause:** It is shallow, by design.
**Fix:** A recursive `DeepPartial` (topic 12), knowing what it costs in error
messages.

**Symptom:** `Required<T>` left `undefined` in a property
**Cause:** The property was `string | undefined` without a `?`, so there was no
optional modifier to remove.
**Fix:** `Exclude<T[K], undefined>`, or fix the source type to use `?`.

**Symptom:** `Readonly<T>` did not stop a nested mutation
**Cause:** Shallow again.
**Fix:** Recursive mapping, or `Object.freeze` for a runtime guarantee at one
level.

**Symptom:** `TS2540` on a property you meant to set once
**Cause:** The type is `Readonly`, so even initialisation-after-construction is
rejected.
**Fix:** Build the object completely, then widen to `Readonly`; do not fight it
with `as`.

**Symptom:** `Record<string, T>` returns a value for a key that is not there
**Cause:** An index signature promises a value for every key.
**Fix:** `noUncheckedIndexedAccess`, or a `Map`.

**Symptom:** `Omit<Todo, "titel">` compiled with a typo
**Cause:** `Omit`'s key parameter is `keyof any`, not `keyof T`.
**Fix:** A local `StrictOmit`, or `Pick` with the keys you want instead.

**Symptom:** `Omit` flattened a discriminated union and narrowing stopped working
**Cause:** `Omit` is not distributive — it builds one object type from the union.
**Fix:** Distribute explicitly with `T extends any ? Omit<T, K> : never`.

**Symptom:** A `Pick` of a `readonly` property is no longer `readonly`
**Cause:** Check the chain — a key remap or an intersection upstream broke
homomorphism.
**Fix:** Re-apply modifiers explicitly, or reorder so `Pick` reads directly from
`T`.

## Interview questions

**★ What is wrong with `Partial<T>` as the type of an update payload?**
It permits `{}`, so a call that changes nothing type-checks. If at least one field
must be present, `Partial` cannot express it — you need a union of single-key
objects, `{ [K in keyof T]: Pick<T, K> }[keyof T]`. `Partial` is also shallow, so
nested objects remain fully required.

**★ How do `Pick` and `Omit` differ beyond direction?**
Their key parameters are constrained differently. `Pick<T, K extends keyof T>`
rejects a key that does not exist; `Omit<T, K extends keyof any>` accepts
anything, so a typo silently removes nothing. `Omit` is also non-distributive, so
applying it to a discriminated union collapses the union instead of omitting from
each member — the fix is `T extends any ? Omit<T, K> : never`.

**★ Why does `Required<T>` sometimes leave `undefined` behind?**
Because it removes the `?` modifier, and the `undefined`-stripping rule that comes
with `-?` applies to that modifier. A property declared `a: string | undefined`
has no `?` to remove, so the union survives. `a?: string` and
`a: string | undefined` look similar and behave differently here.

**When is `Record<string, T>` the wrong choice?**
Whenever the keys are data rather than a closed set. It is an index signature, so
every read type-checks even when the key is absent — a runtime crash the type
system endorsed. Either enable `noUncheckedIndexedAccess`, which makes reads
`T | undefined`, or use a `Map`, which is honest about lookup failing.

**What does `Readonly<T>` actually guarantee?**
That the compiler will reject assignment to a top-level property (`TS2540`) in
code it checks. It is shallow — nested objects stay mutable — and it vanishes at
runtime, so casts, `Object.assign` and unchecked JavaScript are unaffected.
`Object.freeze`, whose signature returns `Readonly<T>`, is the runtime half of the
guarantee.

**You need a type that is `Todo` without its internal fields, and you want typos
caught. What do you write?**
Either `Pick<Todo, "title" | "completed">`, which rejects unknown keys outright,
or a local `type StrictOmit<T, K extends keyof T> = Omit<T, K>`. The built-in
`Omit` will not catch the typo, and on a union it will also flatten the
discriminant away.

---

← Prev: [01 · The map](./01-the-map.md) · Next → [03 · The union filters](./03-union-filters.md)
