---
title: "Composing them"
sidebar_label: "03 · Composing them"
sidebar_position: 3
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the **TypeScript handbook** (*Conditional Types* —
> *Inferring Within Conditional Types*, *Distributive Conditional Types*), whose
> `Flatten`, `GetReturnType`, `ToArray`, `ToArrayNonDist` and `StrArrOrNumArr`
> examples are **quoted verbatim**, and *Utility Types* for the `Exclude` and
> `Omit` definitions. **No console block** — no sandbox run covers this phase.

A conditional on its own answers a yes/no question. Everything useful comes from
composing it — with `infer` to pull a type out, with a mapped type to run it over
every property, and with itself to build the standard utilities.

## With `infer`: naming what the check matched

```ts
type Flatten<Type> = Type extends Array<infer Item> ? Item : Type;

type Str = Flatten<string[]>;
// type Str = string

type Num = Flatten<number>;
// type Num = number
```

`infer Item` says *"if the left side matches `Array<something>`, call that
something `Item` and let me use it in the true branch"*. It is pattern matching:
the check and the extraction happen in one step, which is why `Flatten` needs no
indexed access and no second helper.

```ts
type GetReturnType<Type> = Type extends (...args: never[]) => infer Return
  ? Return
  : never;

type Num = GetReturnType<() => number>;
// type Num = number
```

That is `ReturnType` from the standard library, near enough. **`infer` has its own
page — 06 · Extracting with `infer`** *(not written yet)* — including multiple
`infer` sites, `infer … extends …` constraints, and where inference goes wrong.
What matters here is the shape: a conditional is the only place `infer` is legal,
so every extractor you will ever read is a conditional type underneath.

## With a union: distribution, in one paragraph

```ts
type ToArray<Type> = Type extends any ? Type[] : never;

type StrArrOrNumArr = ToArray<string | number>;
// type StrArrOrNumArr = string[] | number[]
```

The conditional ran **once per union member** and the results were unioned back
together — `string[] | number[]`, not `(string | number)[]`. That happens
whenever the checked type is a *naked* type parameter.

```ts
type ToArrayNonDist<Type> = [Type] extends [any] ? Type[] : never;

type ArrOfStrOrNum = ToArrayNonDist<string | number>;
// type ArrOfStrOrNum = (string | number)[]
```

Wrapping both sides in brackets stops it. That is the whole trick, and the rest
— why `never` disappears, what "naked" means precisely, when distribution is what
you wanted — is **05 · Distributive conditional types** *(not written yet)*. It
is listed here because you cannot read library types without meeting it, and
because the two examples above are the ones everyone learns it from.

## With a mapped type: a condition per property

The composition from [topic 01](../01-mapped-types/03-writing-your-own.md): the
mapping supplies each property, the conditional decides what it becomes.

```ts
type NullableKeys<T> = {
  [K in keyof T]: null extends T[K] ? K : never;
}[keyof T];
```

Read it in two steps, because this idiom appears constantly and is opaque until
you have taken it apart once:

1. The mapped type produces an object whose *values* are either the key name or
   `never` — `{ id: never; nickname: "nickname" }`.
2. Indexing that object with `[keyof T]` takes the union of all its value types —
   `never | "nickname"` — and `never` disappears from a union, leaving
   `"nickname"`.

**That is the standard "select keys by a property test" pattern**, and it is worth
recognising rather than re-deriving. Its modern alternative is a key-remapping
`as` clause that maps rejected keys to `never`, which arrived in 4.1 and reads
better — topic 04's subject.

## With itself: building the utilities

`Exclude` is a conditional and nothing else:

```ts
type Exclude<T, U> = T extends U ? never : T;
```

It works entirely through distribution: `Exclude<"a" | "b" | "c", "a">` runs the
check three times, produces `never | "b" | "c"`, and the `never` falls out. Its
sibling `Extract<T, U> = T extends U ? T : never` is the same machine wired the
other way.

And `Omit` — the utility people assume is primitive — is two utilities stacked:

```ts
type Omit<T, K extends keyof any> = Pick<T, Exclude<keyof T, K>>;
```

A conditional computes the surviving key union; a mapped type loops over it.
That is the phase in one line, and it is why the phase gate asks for `Omit`
specifically: writing it requires knowing that `Pick` is a mapping, that
`Exclude` is a distributing conditional, and that the two compose in that order.

⚠️ **`Omit`'s `K` is not constrained to `keyof T`**, which is deliberate and
occasionally awful: `Omit<User, "nmae">` compiles and silently omits nothing. If
you want the typo caught, use `Omit<T, K extends keyof T>` in your own alias.

## A worked example: making one bad shape unrepresentable

```ts
type Result<T> =
  | { ok: true; value: T }
  | { ok: false; error: Error };

type ValueOf<R> = R extends { ok: true; value: infer V } ? V : never;

type A = ValueOf<Result<string>>;   // string
```

`Result<T>` is a discriminated union; `ValueOf` is a conditional with an `infer`
that only matches the success arm. The failure arm contributes `never`, which
disappears. Nothing here needs a type assertion, and adding a third arm to
`Result` cannot break `ValueOf` silently — it either matches the pattern or
contributes `never`.

## Gotchas

**Symptom:** `infer` is rejected
**Cause:** It is only legal in the `extends` clause of a conditional type.
**Fix:** Wrap the pattern in a conditional, even a trivially true one.

**Symptom:** A helper returns `string[] | number[]` where `(string | number)[]`
was wanted
**Cause:** Distribution over a naked type parameter.
**Fix:** The bracket form, `[T] extends [U]`.

**Symptom:** `Exclude<T, U>` returned `never` for everything
**Cause:** `U` is wider than expected — every member matched, so every branch
produced `never`.
**Fix:** Hover `U`. A union that includes `string` will exclude every string
literal.

**Symptom:** `Omit<User, "nmae">` compiles despite the typo
**Cause:** The standard `Omit`'s second parameter is `keyof any`, not `keyof T`.
**Fix:** Use a stricter local alias when the typo matters more than the
flexibility.

**Symptom:** The "select keys" idiom returns `never`
**Cause:** No key passed the test, so every value was `never` and the indexed
access produced `never`.
**Fix:** Check the predicate independently on one known key before debugging the
whole expression.

**Symptom:** The key-selection idiom includes `undefined` or `never` in its result
**Cause:** The mapped values are not exclusively `K` or `never` — a branch is
producing something else.
**Fix:** Make both branches exactly `K` and `never`; anything else survives the
union.

**Symptom:** A conditional inside a mapped type produced `boolean`
**Cause:** The property's type is a union, so the conditional distributed and both
`true` and `false` came back.
**Fix:** Bracket the check, or narrow the value type before testing it.

## Interview questions

**★ Write `Exclude` and `Omit` from memory and explain how they work.**
`type Exclude<T, U> = T extends U ? never : T` — distribution runs the check per
union member and the `never`s fall out of the result. `type Omit<T, K extends
keyof any> = Pick<T, Exclude<keyof T, K>>` — the conditional computes the
surviving key union and the mapped type loops over it. `Omit` is the phase's
gate question precisely because it needs both halves.

**★ Why is `infer` only allowed in a conditional type?**
Because it introduces a type variable that is only meaningful if the pattern
matched, and the conditional is what expresses "if it matched". There is nowhere
else for the false case to go. That is why every extractor in the standard
library — `ReturnType`, `Parameters`, `InstanceType`, `Awaited` — is a
conditional with an `infer` in its check.

**★ Explain the `{ [K in keyof T]: test ? K : never }[keyof T]` idiom.**
It selects keys by a predicate. The mapped type produces an object whose values
are either the key name or `never`; indexing with `[keyof T]` unions all the
values; `never` vanishes from a union, leaving only the keys that passed. Since
4.1, a key-remapping `as` clause mapping rejected keys to `never` does the same
job more legibly.

**What is the difference between `ToArray<T>` and `ToArrayNonDist<T>`?**
`type ToArray<T> = T extends any ? T[] : never` distributes, so
`ToArray<string | number>` is `string[] | number[]`.
`type ToArrayNonDist<T> = [T] extends [any] ? T[] : never` wraps both sides, which
suppresses distribution, so the same input gives `(string | number)[]`. The
brackets are the switch.

**Why is `Omit`'s key parameter not constrained to `keyof T`?**
So it can be used with keys that may not exist on every member of a union, which
is genuinely useful. The cost is that a misspelled key compiles and removes
nothing. Where correctness matters more than flexibility, define a local
`StrictOmit<T, K extends keyof T>`.

**How do conditional types and mapped types compose?**
The mapped type provides the iteration, the conditional provides the decision
per property — `{ [K in keyof T]: T[K] extends Fn ? A : B }`. Nearly every real
helper type is that pairing, which is why these two topics sit next to each other
and why the utilities are built from exactly these two mechanisms.

---

← Prev: [02 · When it is deferred](./02-deferred.md) · Next → [04 · Keeping them readable](./04-readable.md)
