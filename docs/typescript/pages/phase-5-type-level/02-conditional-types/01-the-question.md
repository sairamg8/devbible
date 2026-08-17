---
title: "The question it actually asks"
sidebar_label: "01 · The question it asks"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the **TypeScript handbook** (*Conditional Types* —
> the introduction and *Conditional Type Constraints*), whose `Animal`/`Dog`,
> `Example1`/`Example2` and `MessageOf`/`Email` examples are **quoted verbatim**.
> **No console block** — no sandbox run covers this phase.

## The syntax is a ternary

```ts
SomeType extends OtherType ? TrueType : FalseType;
```

That is the whole grammar. The interesting part is what `extends` means here,
because it is **not** the `extends` of class inheritance and it is not the
`extends` of an interface declaration.

## `extends` asks "is assignable to"

The handbook's opening example, verbatim:

```ts
interface Animal {
  live(): void;
}

interface Dog extends Animal {
  woof(): void;
}

type Example1 = Dog extends Animal ? number : string;
// type Example1 = number

type Example2 = RegExp extends Animal ? number : string;
// type Example2 = string
```

`Dog extends Animal` is `true` because a `Dog` **is assignable to** `Animal` —
it has everything `Animal` requires. `RegExp` is not, so the false branch wins.
Nothing about a declared inheritance relationship is being consulted; this is
[structural typing](../../phase-1-type-vocabulary/09-structural-typing.md) asking
its usual question.

That distinction is the single most useful thing to hold onto, because it makes
results predictable that otherwise look arbitrary:

```ts
type A = { name: string; age: number } extends { name: string } ? 1 : 0;  // 1
type B = "hello" extends string ? 1 : 0;                                  // 1
type C = string extends "hello" ? 1 : 0;                                  // 0
type D = 42 extends number ? 1 : 0;                                       // 1
type E = number extends 42 ? 1 : 0;                                       // 0
type F = never extends string ? 1 : 0;                                    // 1
type G = string extends any ? 1 : 0;                                      // 1
```

Read every one of them as *"can a value of the left type be used where the right
type is expected?"* — `"hello"` can be used as a `string`; a `string` cannot be
used where the literal `"hello"` is required; `never` can be used anywhere,
because there are no values of it to go wrong.

**Specific extends general is `true`; general extends specific is `false`.** Most
confusion about conditional types is that sentence, forgotten.

## The two things that break the rule

**`any` takes both branches.**

```ts
type WithAny<T> = T extends string ? "yes" : "no";
type R = WithAny<any>;   // "yes" | "no"
```

The compiler cannot decide, so it gives you the union of both results. This is
documented behaviour rather than a bug, and it is a good reason to keep `any` out
of type-level code: a single `any` upstream turns every downstream conditional
into a union of everything it could have been.

**`never` in a naked type parameter produces `never`.**

```ts
type IsString<T> = T extends string ? true : false;
type R2 = IsString<never>;   // never — not false
```

This is distribution (topic 05) doing its job: a conditional over a naked type
parameter distributes across the union it is given, `never` is the empty union,
and mapping over nothing produces nothing. It surprises everyone once. The fix,
when you need an answer rather than an absence, is the bracket form —
`[T] extends [string] ? true : false` — which is
[05 · Distributive conditional types](../05-distributive-conditionals.md).

## Using a conditional to extract

A conditional does not have to return a flag. Once the check has passed, the true
branch knows something about the type and can index into it. The handbook's
example, verbatim:

```ts
type MessageOf<T> = T extends { message: unknown } ? T["message"] : never;

interface Email {
  message: string;
}

type EmailMessageContents = MessageOf<Email>;
// type EmailMessageContents = string
```

Two details in that one line are worth naming, because they recur everywhere:

- **`T["message"]` is only legal inside the true branch.** Outside it, `T` is not
  known to have that key. The check is what earns the indexed access, which is
  the same bargain a runtime type guard makes with a value.
- **`never` is the idiomatic false branch.** It means "there is no such type", it
  disappears from any union it lands in, and it makes the helper compose. Return
  `undefined` or `unknown` instead and every caller has to handle a value that
  cannot exist.

The `unknown` in `{ message: unknown }` is doing work too: it means *"has a
`message` property of any type"*. Writing `{ message: string }` would have made
the check narrower than intended.

## Chaining: first match wins

Conditionals nest in the false branch, and read as an ordered list of cases:

```ts
type TypeName<T> =
  T extends string    ? "string"    :
  T extends number    ? "number"    :
  T extends boolean   ? "boolean"   :
  T extends undefined ? "undefined" :
  T extends Function  ? "function"  :
  "object";
```

Formatting it as a column of `check ? result :` lines is the convention worth
adopting — it makes the chain read as a `switch`, and it makes an out-of-order
case visible.

**Order is significant, because the first assignable match wins.** Put a general
check before a specific one and the specific branch becomes unreachable:

```ts
type Wrong<T> =
  T extends object ? "object" :
  T extends any[]  ? "array"  :   // ❌ unreachable: an array is an object
  "primitive";
```

Nothing warns you about that. Arrays are objects, so `Wrong<string[]>` is
`"object"` and the second branch never runs. **Order the cases most-specific
first**, exactly as you would order `instanceof` checks at runtime.

## Gotchas

**Symptom:** `T extends U` is `false` for a type that "obviously" extends `U`
**Cause:** The question is assignability, not declared inheritance — and it runs
in the direction written. `string extends "hello"` is `false`.
**Fix:** Read it as "can a `T` be used where a `U` is expected", and check the
order of the operands.

**Symptom:** A conditional returned a union of both branches
**Cause:** The checked type is `any`, which satisfies and fails the check at once.
**Fix:** Keep `any` out of the input, or guard with `IsAny` before the real check.

**Symptom:** `IsString<never>` is `never` rather than `false`
**Cause:** A naked type parameter distributes, and distributing over the empty
union produces the empty union.
**Fix:** Use the bracket form `[T] extends [string]` when you want an answer for
`never`.

**Symptom:** A branch that should be reachable never is
**Cause:** An earlier, more general case matched first — `object` before `any[]`,
`string` before a string-literal union.
**Fix:** Reorder most-specific first. The compiler will not warn.

**Symptom:** `T["message"]` is an error in the false branch
**Cause:** Only the true branch knows the property exists.
**Fix:** Index inside the true branch; return `never` from the false one.

**Symptom:** A conditional on an optional property behaves oddly under
`strictNullChecks`
**Cause:** The property's type includes `undefined`, so the check is against
`X | undefined`.
**Fix:** Strip it first — `Exclude<T[K], undefined>` — or test with
`undefined extends T[K]`, which is the idiomatic "is this optional" probe.

**Symptom:** The false branch returns `unknown` and every caller has to handle it
**Cause:** `unknown` means "some value exists"; `never` means "this case does not
happen".
**Fix:** Use `never` unless you genuinely have a value.

## Interview questions

**★ What question does `extends` ask in a conditional type?**
Assignability: *can a value of the left type be used where the right type is
expected?* Not class inheritance and not declaration. So `Dog extends Animal` is
`true` structurally, `"hello" extends string` is `true`, and
`string extends "hello"` is `false`. Specific-extends-general is true; the
reverse is not.

**★ Why is `never` the conventional false branch?**
Because it means "no such type". It vanishes from unions, so a helper that
returns it composes cleanly; it makes a mapped value disappear rather than
producing a bogus one; and it forces a caller who ignores the case to deal with
an impossible value rather than a plausible wrong one. `unknown` or `undefined`
in that position pushes work onto every consumer.

**★ What happens when the checked type is `any`?**
You get **both** branches as a union — `T extends string ? "yes" : "no"` with
`any` gives `"yes" | "no"`. The compiler cannot decide, so it keeps both. It is a
good argument for keeping `any` out of type-level code, because one upstream
`any` blurs every conditional downstream.

**Why does `IsString<never>` give `never` instead of `false`?**
A conditional over a *naked* type parameter distributes over the union it
receives, and `never` is the empty union — so there is nothing to distribute
over and the result is `never`. Wrap both sides in brackets,
`[T] extends [string]`, to get a real answer.

**How do you extract a property's type with a conditional?**
Check for it, then index inside the true branch:
`type MessageOf<T> = T extends { message: unknown } ? T["message"] : never`. The
check is what makes the indexed access legal — outside the true branch, `T` is
not known to have the key.

**Does the order of a nested conditional chain matter?**
Yes, and nothing warns you when you get it wrong. The first assignable match
wins, so a general case placed before a specific one makes the specific branch
unreachable — `T extends object` before `T extends any[]` means arrays are
reported as objects. Order most-specific first.

---

← [Topic index](./README.md) · Next → [02 · When it is deferred](./02-deferred.md)
