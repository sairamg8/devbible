---
title: "The union filters"
sidebar_label: "03 · The union filters"
sidebar_position: 3
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the **TypeScript handbook** (*Utility Types* —
> `Exclude`, `Extract`, `NonNullable`), whose descriptions and `T0` examples are
> **quoted verbatim**; the **2.8 release notes**, which introduced all three; and
> the **4.8 release notes**, whose `NonNullable` rewrite is quoted verbatim.
> **No console block** — no sandbox run covers this phase.

Three utilities, one mechanism: **a conditional over a naked type parameter,
which distributes across the union it is given.** Everything they do — including
the things that look like bugs — falls out of that.

## `Exclude<UnionType, ExcludedMembers>`

> "Constructs a type by excluding from `UnionType` all union members that are
> assignable to `ExcludedMembers`."

```ts
type T0 = Exclude<"a" | "b" | "c", "a">;
// type T0 = "b" | "c"

type T1 = Exclude<"a" | "b" | "c", "a" | "b">;
// type T1 = "c"

type T2 = Exclude<string | number | (() => void), Function>;
// type T2 = string | number
```

Note `T2`: the test is **assignability**, not equality. Every member assignable to
`Function` goes, which is why a filter written with a wide second argument removes
far more than intended.

The definition, from [topic 02](../02-conditional-types/03-composing.md):

```ts
type Exclude<T, U> = T extends U ? never : T;
```

## `Extract<Type, Union>`

> "Constructs a type by extracting from `Type` all union members that are
> assignable to `Union`."

```ts
type T0 = Extract<"a" | "b" | "c", "a" | "f">;
// type T0 = "a"

type T1 = Extract<string | number | (() => void), Function>;
// type T1 = () => void
```

The same machine with the branches swapped. Its most valuable use is not filtering
strings but **selecting one arm of a discriminated union**:

```ts
type Event =
  | { kind: "click"; x: number; y: number }
  | { kind: "key"; code: string }
  | { kind: "scroll"; delta: number };

type KeyEvent = Extract<Event, { kind: "key" }>;
// { kind: "key"; code: string }

function handleKey(e: Extract<Event, { kind: "key" }>) {
  e.code;   // ✅ no narrowing needed — the type is already the one arm
}
```

That pattern is worth adopting wherever a handler exists per variant: the handler
signature names the variant it handles, and adding a new arm to `Event` cannot
silently widen it.

## `NonNullable<Type>`

> "Constructs a type by excluding `null` and `undefined` from `Type`."

```ts
type T0 = NonNullable<string | number | undefined>;
// type T0 = string | number

type T1 = NonNullable<string[] | null | undefined>;
// type T1 = string[]
```

Its definition changed in 4.8, and the reason is the most instructive thing in
this chunk:

```ts
- type NonNullable<T> = T extends null | undefined ? never : T;
+ type NonNullable<T> = T & {};
```

> "Another change is that `{}` intersected with any other object type simplifies
> right down to that object type. That meant that we were able to rewrite
> `NonNullable` to just use an intersection with `{}`, because `{} & null` and
> `{} & undefined` just get tossed away."
>
> "This is an improvement because intersection types like this can be reduced and
> assigned to, while conditional types currently cannot. So
> `NonNullable<NonNullable<T>>` now simplifies at least to `NonNullable<T>`,
> whereas it didn't before."

**The practical consequence:** `NonNullable<T>` is now *assignable to* in generic
code, where the old conditional version was deferred and rejected everything. If
you have a helper that fights deferral, that release note is the pattern to
imitate.

## The three behaviours that look like bugs

**1. On a non-union, a filter does almost nothing.**

```ts
type A = Exclude<{ a: 1; b: 2 }, { a: 1 }>;   // never — the whole object matched
```

`Exclude` filters *union members*, and an object type is one member. It does not
remove properties; that is `Omit`'s job. Confusing the two is the most common
misuse of this family.

**2. `never` in, `never` out.**

```ts
type B = Exclude<never, string>;   // never
```

The empty union has nothing to distribute over. It is correct, and it means a
filter chain that produces `never` somewhere in the middle silently produces
`never` at the end.

**3. Everything can be excluded, including what you meant to keep.**

```ts
type Kind = "a" | "b";
type C = Exclude<Kind, string>;   // never — every string literal is a string
```

Widening the second argument by one step removes the entire union. Hover it before
trusting it.

## Building on them

Two idioms that come up constantly, both one line:

```ts
// The string keys of T, dropping any number or symbol keys
type StringKeys<T> = Extract<keyof T, string>;

// NonNullable applied to every property, not to the object as a whole
type Definite<T> = { [K in keyof T]: NonNullable<T[K]> };
```

`StringKeys` is the honest alternative to `keyof T & string`: same result, and it
says *why* at a glance. It breaks homomorphism if you map over it
([topic 01 · chunk 02](../01-mapped-types/02-modifiers.md)), so use it to produce
a key union, not as the loop of a mapping you need modifiers from.

`Definite` is the one to reach for when a partially-loaded model becomes fully
loaded — it applies `NonNullable` to every property in one step, and because the
loop is still `[K in keyof T]` the mapping stays homomorphic, so `readonly`
survives.

## Gotchas

**Symptom:** `Exclude` returned `never` for a whole union
**Cause:** The second argument is wider than intended — `string` excludes every
string literal, `object` excludes every object type.
**Fix:** Hover the second argument. Use literal types, not their supertypes.

**Symptom:** `Exclude<T, "id">` did not remove a property
**Cause:** `Exclude` filters union members, not object keys.
**Fix:** `Omit<T, "id">` removes a property; `Exclude<keyof T, "id">` removes a
key from the *key union*.

**Symptom:** A filter over a non-union produced `never` or the whole type
**Cause:** With one member there are only two possible answers, so the filter looks
broken.
**Fix:** Expected. Filters are for unions.

**Symptom:** `Extract<Event, { kind: "key" }>` returned `never`
**Cause:** The pattern does not match structurally — a typo in the discriminant
value, or a missing required property in the pattern.
**Fix:** The pattern only needs the discriminant; add nothing else to it.

**Symptom:** `NonNullable<T>` behaves differently from a hand-written
`T extends null | undefined ? never : T`
**Cause:** Since 4.8 it is `T & {}`, an intersection — reducible and assignable to,
where the conditional was deferred.
**Fix:** Prefer the built-in; imitate the intersection trick in your own helpers.

**Symptom:** `NonNullable` did not remove `null` from a nested property
**Cause:** It operates on the type given, not recursively.
**Fix:** Map it over the properties — `{ [K in keyof T]: NonNullable<T[K]> }`.

**Symptom:** A filtered union lost `readonly` or optionality
**Cause:** These filters work on unions of *types*; applying them to `keyof T` and
re-picking loses homomorphism.
**Fix:** Filter the keys, then `Pick`, and accept that modifiers on the picked
properties survive but array/union behaviour does not.

## Interview questions

**★ How do `Exclude`, `Extract` and `NonNullable` actually work?**
All three are conditionals over a naked type parameter, so they distribute across
the union they receive: `Exclude<T, U> = T extends U ? never : T`, `Extract` is
the same with the branches swapped, and `NonNullable` was that shape until 4.8
rewrote it as `T & {}`. The filtering is the distribution — on a non-union they
have only one member to test.

**★ What is the difference between `Exclude<keyof T, "id">` and `Omit<T, "id">`?**
The first filters a *union of keys* and produces a union of keys; the second
produces an object type without that property — and is in fact defined as
`Pick<T, Exclude<keyof T, "id">>`, so it uses the first internally. Reaching for
`Exclude` when you wanted `Omit` is the most common misuse of this family.

**★ Why is `Extract` the right tool for a discriminated union?**
Because it selects the arms assignable to a pattern, so
`Extract<Event, { kind: "key" }>` gives exactly that variant, already narrowed. A
handler typed with it needs no runtime narrowing, and adding a new arm to the
union cannot silently widen the handler's parameter.

**Why did 4.8 rewrite `NonNullable` as an intersection?**
Because `{}` intersected with an object type reduces to that object type, and
`{} & null` / `{} & undefined` are discarded — so the intersection expresses the
same thing while remaining *reducible and assignable to*, which a deferred
conditional is not. `NonNullable<NonNullable<T>>` now simplifies; before, it did
not.

**Why does `Exclude<never, string>` give `never`?**
`never` is the empty union, so distribution has nothing to iterate and produces
nothing. It is the same rule that makes `IsString<never>` return `never` rather
than `false`, and it means a `never` appearing mid-chain propagates silently to
the end.

**Write the type "all properties of `T`, with nullish removed from each".**
`type Definite<T> = { [K in keyof T]: NonNullable<T[K]> }` — a homomorphic mapping
so `readonly` and `?` survive, with the filter applied to each property's type
rather than to the object as a whole. `NonNullable<T>` alone would only look at
the top-level type.

---

← Prev: [02 · The object shapers](./02-object-shapers.md) · Next → [04 · The extractors](./04-extractors.md)
