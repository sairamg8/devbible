---
title: "Distributive conditional types"
sidebar_label: "05 · Distributive conditionals"
sidebar_position: 5
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the **TypeScript handbook** (*Conditional Types* —
> *Distributive Conditional Types*), whose `ToArray`, `ToArrayNonDist` and
> `StrArrOrNumArr` examples are **quoted verbatim**, and *Everyday Types* /
> *Literal Types* for the statement that `boolean` is an alias for the union
> `true | false`. *Utility Types* supplies the `Exclude` and `NonNullable`
> definitions referred to here. **No console block** — no sandbox run covers this
> phase.

[Topic 02](./02-conditional-types/README.md) introduced this in a paragraph and
deferred it. Here it is in full, because it is the behaviour that makes
conditional types feel unpredictable — and the one that makes `Exclude` work at
all.

## The rule

> "When conditional types act on a generic type, they become distributive when
> given a union type."

```ts
type ToArray<Type> = Type extends any ? Type[] : never;

type StrArrOrNumArr = ToArray<string | number>;
// type StrArrOrNumArr = string[] | number[]
```

The conditional ran **once per union member**, and the results were unioned back
together. Not `(string | number)[]` — `string[] | number[]`. If you expected one
array of a union, this is the moment the feature announces itself.

## What "naked" means, precisely

Distribution happens when the **checked type is a bare type parameter**, and only
then. The term used for it is *naked* — nothing wrapped around it.

| Checked position | Distributes? |
|---|---|
| `T extends U ? … : …` | ✅ `T` is naked |
| `[T] extends [U] ? … : …` | ❌ wrapped in a tuple |
| `T[] extends U ? … : …` | ❌ `T[]` is not `T` |
| `Wrapper<T> extends U ? … : …` | ❌ |
| `keyof T extends U ? … : …` | ❌ the checked type is `keyof T` |
| `string extends U ? … : …` | ❌ not a type parameter at all |

The **false** side and the branches are irrelevant — only the position to the left
of `extends` matters.

## Turning it off

```ts
type ToArrayNonDist<Type> = [Type] extends [any] ? Type[] : never;

type ArrOfStrOrNum = ToArrayNonDist<string | number>;
// type ArrOfStrOrNum = (string | number)[]
```

> "Typically, distributivity is the desired behavior. To avoid that behavior, you
> can surround each side of the `extends` keyword with square brackets."

**Both sides must be wrapped**, because the comparison has to stay meaningful: a
one-element tuple is assignable to another one-element tuple exactly when the
elements are. The brackets are pure ceremony for the checker; they carry no other
meaning.

Any wrapper works in principle — `T[]` against `U[]`, `() => T` against `() => U`
— but the tuple form is the convention, it is what the handbook uses, and it
avoids variance surprises. Use it and nothing else.

## The three results that surprise people

**1. `never` in gives `never` out.**

```ts
type IsString<T> = T extends string ? true : false;

type A = IsString<never>;   // never — not false
```

`never` is the empty union, so distribution has no members to iterate and produces
nothing. This is the single most reported "bug" in this area, and it is exact
behaviour. When you need an answer for `never`, wrap:

```ts
type IsStringSafe<T> = [T] extends [string] ? true : false;

type B = IsStringSafe<never>;   // true — `never` is assignable to `string`
```

Note that the answer is `true`, not `false`: `never` is assignable to everything.
Whether that is the answer you wanted is a design question — sometimes the honest
move is to special-case `never` first.

**2. `boolean` is two members.**

The handbook states that `boolean` is an alias for the union `true | false`, so a
distributing conditional sees two members and answers twice:

```ts
type Flip<T> = T extends true ? "yes" : "no";

type C = Flip<boolean>;   // "yes" | "no"
```

That is why a mapped type with a conditional value so often produces `boolean`
where a single literal was expected: both branches ran, and `true | false`
collapses back to `boolean` in the display.

**3. `any` produces both branches.**

```ts
type D = IsString<any>;   // true | false → boolean
```

Documented behaviour, and a good reason to keep `any` out of type-level inputs:
one upstream `any` blurs every downstream conditional into a union of everything
it might have been.

## Why the whole union-filter family depends on it

```ts
type Exclude<T, U> = T extends U ? never : T;
```

`Exclude<"a" | "b" | "c", "a">` works **only** because of distribution: the check
runs three times, produces `never | "b" | "c"`, and `never` falls out of a union.
Wrap the checked type and the utility stops working entirely —
`["a" | "b" | "c"] extends ["a"]` is one comparison, and it is `false`, so nothing
would be excluded.

The same is true of `Extract`, and it was true of `NonNullable` until 4.8
rewrote it as `T & {}` ([topic 03 · chunk 03](./03-utility-types/03-union-filters.md)).

**So the rule of thumb is:** if the helper is a *filter* over a union, you want
distribution. If it is a *question about the union as a whole*, you do not.

## Distributing on purpose

Two idioms worth having in reach, both of which exist only because distribution
does:

```ts
// Apply Omit to each member of a discriminated union instead of collapsing it
type DistributiveOmit<T, K extends keyof any> = T extends any ? Omit<T, K> : never;

// Narrow a union by discriminant, without Extract
type ByKind<T extends { kind: string }, K extends T["kind"]> =
  T extends { kind: K } ? T : never;
```

`T extends any ? … : …` is the standard idiom for *"distribute, then do
something"* — the check is deliberately trivial, and its only job is to be naked
so the union splits. Seeing `extends any` in library code almost always means
this.

## Gotchas

**Symptom:** A helper returns `A[] | B[]` where `(A | B)[]` was wanted
**Cause:** Distribution over a naked type parameter.
**Fix:** `[T] extends [U]` — wrap both sides.

**Symptom:** A type-level predicate returns `never` for some inputs
**Cause:** The input was `never`, and distributing over the empty union produces
the empty union.
**Fix:** Wrap in brackets, and decide deliberately what `never` should answer —
wrapped, it answers `true` for every check, because `never` is assignable to
everything.

**Symptom:** A conditional over a `boolean` returned both branches
**Cause:** `boolean` is `true | false`, so distribution runs twice.
**Fix:** Wrap, or test with `[T] extends [true]` when you mean the literal.

**Symptom:** `Exclude` stopped filtering after a "harmless" refactor
**Cause:** The checked type is no longer naked — someone wrapped it, aliased it
through another helper, or intersected it.
**Fix:** Keep the type parameter bare in the checked position.

**Symptom:** A mapped type's conditional value produced `boolean` instead of
`true` or `false`
**Cause:** The property's type is a union, so the conditional distributed.
**Fix:** `[T[K]] extends [X] ? true : false`.

**Symptom:** Wrapping fixed the result but broke a different case
**Cause:** Only one side was wrapped, so the comparison changed meaning rather
than just switching distribution off.
**Fix:** Wrap **both** sides, always the same way.

**Symptom:** A distributed conditional over a large union is slow or hits
`TS2589`
**Cause:** Distribution multiplies work — an *n*-member union runs the conditional
*n* times, and each may distribute again.
**Fix:** Wrap where distribution is not needed, and keep unions from feeding
nested conditionals.

## Interview questions

**★ When does a conditional type distribute?**
When the checked type — the part to the left of `extends` — is a **naked type
parameter**, and the argument is a union. Then the conditional runs once per
member and the results are unioned: `ToArray<string | number>` is
`string[] | number[]`. Wrap the checked type in anything and distribution stops.

**★ How do you switch distribution off, and why must both sides be wrapped?**
`[T] extends [U]`. Both sides are wrapped so the comparison still asks the same
question — a one-element tuple is assignable to another exactly when its element
is — while the checked type is no longer naked. Wrapping one side only changes
what is being compared.

**★ Why does `IsString<never>` return `never` rather than `false`?**
`never` is the empty union, and distributing over it produces nothing. Wrapping —
`[T] extends [string]` — gives an answer, and that answer is `true`, because
`never` is assignable to every type. If neither is what you want, special-case
`never` explicitly.

**Why does `Exclude` need distribution?**
Because it filters members: `T extends U ? never : T` runs per member, the matches
become `never`, and `never` disappears from the resulting union. Without
distribution it would be a single comparison of the whole union against `U`,
which is `false` for any partial overlap, so nothing would ever be excluded.

**What does `T extends any ? … : …` mean when you see it in library code?**
It is the "distribute on purpose" idiom. The check is trivially true; its only job
is to put a naked type parameter on the left so the union splits. It is how you
write a distributive `Omit`, or apply any non-distributive helper per member.

**Why did a conditional over a `boolean` produce both branches?**
Because `boolean` is an alias for `true | false`, so a distributing conditional
sees a two-member union and answers for each. The result `"yes" | "no"` — or
`true | false` displayed as `boolean` — is distribution, not a bug.

---

← [Phase 5 index](./README.md) · Prev: [04 · Key remapping with `as`](./04-key-remapping.md) · Next → [06 · Extracting with `infer`](./06-infer/README.md)
