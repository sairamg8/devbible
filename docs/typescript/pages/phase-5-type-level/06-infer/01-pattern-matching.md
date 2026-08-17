---
title: "Pattern matching with `infer`"
sidebar_label: "01 · Pattern matching"
sidebar_position: 1
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the **TypeScript handbook** (*Conditional Types* —
> *Inferring Within Conditional Types*) and the **TypeScript 4.7 release notes**
> (*extends Constraints on `infer` Type Variables*), whose three `FirstIfString`
> variants and every explanatory sentence quoted here are **verbatim**. The 2.8
> release notes supply the variance rule, quoted in
> [topic 03 · chunk 04](../03-utility-types/04-extractors.md). **No console
> block** — no sandbox run covers this phase.

`infer` declares a type variable **inside a pattern** and binds it to whatever
matched. It is the difference between asking *"is this an array?"* and asking
*"is this an array, and if so, of what?"*.

The mechanism and the standard extractors are already covered —
[topic 02 · chunk 03](../02-conditional-types/03-composing.md) for `Flatten` and
`GetReturnType`, [topic 03 · chunk 04](../03-utility-types/04-extractors.md) for
the whole `ReturnType`/`Parameters`/`Awaited` family and the overload rule. **This
topic is the parts of `infer` those two did not need:** constraining it, using
several at once, matching inside strings, and writing your own.

## Where it is legal

Only in the `extends` clause of a conditional type, and only usable in the **true**
branch. That is not an arbitrary restriction: the variable is only meaningful if
the pattern matched, and the conditional is what expresses "if it matched".

```ts
type ElementOf<T> = T extends readonly (infer E)[] ? E : never;

type A = ElementOf<string[]>;              // string
type B = ElementOf<readonly [1, 2, 3]>;    // 1 | 2 | 3
type C = ElementOf<string>;                // never
```

`readonly (infer E)[]` matches both mutable and readonly arrays, which the plain
`(infer E)[]` form does not — a small detail that decides whether the helper works
on `as const` data.

## Constraining an `infer` — TypeScript 4.7

Before 4.7, "match it *and* check what it is" needed two nested conditionals. The
release notes' own example, verbatim:

```ts
type FirstIfString<T> =
    T extends [infer S, ...unknown[]]
        ? S extends string ? S : never
        : never;

// string
type A = FirstIfString<[string, number, number]>;

// "hello"
type B = FirstIfString<["hello", number, number]>;

// "hello" | "world"
type C = FirstIfString<["hello" | "world", boolean]>;

// never
type D = FirstIfString<[boolean, number, string]>;
```

The notes then show the manual alternative and say why it is worse:

```ts
type FirstIfString<T> =
    T extends [string, ...unknown[]]
        // Grab the first type out of `T`
        ? T[0]
        : never;
```

> "This works, but it's slightly more 'manual' and less declarative. Instead of
> just pattern-matching on the type and giving the first element a name, we have
> to fetch out the `0`th element of `T` with `T[0]`. If we were dealing with types
> more complex than tuples, this could get a lot trickier, so `infer` can simplify
> things."

And the 4.7 form that replaces both:

```ts
type FirstIfString<T> =
    T extends [infer S extends string, ...unknown[]]
        ? S
        : never;
```

> "This way, when TypeScript matches against `S`, it also ensures that `S` has to
> be a `string`. If `S` isn't a `string`, it takes the false path, which in these
> cases is `never`."

**One conditional instead of two, and the constraint sits where the reader is
already looking.** Nested conditionals are the main source of unreadable
type-level code, so this is worth adopting wherever the old shape appears.

## Several `infer` variables at once

Different names, extracting several parts of one pattern:

```ts
type Split<T> = T extends `${infer Head}.${infer Tail}` ? [Head, Tail] : never;
type S = Split<"user.name">;   // ["user", "name"]

type FnParts<F> = F extends (first: infer A, ...rest: infer R) => infer Ret
  ? { first: A; rest: R; returns: Ret }
  : never;
```

The **same** name used twice is a different thing entirely, and it is the rule
worth memorising: **co-variant positions union, contra-variant positions
intersect** — quoted from the 2.8 notes and worked through in
[topic 03 · chunk 04](../03-utility-types/04-extractors.md). The practical
consequence is that reusing an `infer` name across two parameter positions can
produce `string & number`, a type nothing satisfies.

## Recursive extraction

`infer` composes with recursion, which is how `Awaited` unwraps nested promises
and how tuple helpers walk their elements:

```ts
type DeepUnwrap<T> = T extends Promise<infer U> ? DeepUnwrap<U> : T;

type Last<T extends readonly unknown[]> =
  T extends readonly [...unknown[], infer L] ? L : never;

type Init<T extends readonly unknown[]> =
  T extends readonly [...infer Rest, unknown] ? Rest : never;
```

`[...infer Rest, unknown]` matching from the *end* of a tuple is worth knowing —
variadic tuple patterns are what make head/tail, reverse and length helpers
possible, and they belong to [13 · Tuple manipulation](../13-tuple-manipulation/README.md).

⚠️ **Recursion needs a base case and a bound.** `DeepUnwrap` terminates because a
non-promise takes the false branch. A recursion whose false branch also recurses
meets `TS2589` — *"Type instantiation is excessively deep and possibly
infinite."*

## Gotchas

**Symptom:** `infer` is rejected with a syntax error
**Cause:** It is only legal in the `extends` clause of a conditional type.
**Fix:** Wrap the pattern in a conditional, even a trivially true one.

**Symptom:** An `infer` variable is not usable in the false branch
**Cause:** It only exists where the pattern matched.
**Fix:** Return `never` (or a message type) from the false branch instead.

**Symptom:** An array extractor fails on `as const` data
**Cause:** The pattern is `(infer E)[]`, which does not match a `readonly` array.
**Fix:** `readonly (infer E)[]` — it matches both.

**Symptom:** Reusing an `infer` name produced `string & number`
**Cause:** The two positions are contra-variant (parameters), and multiple
candidates there intersect.
**Fix:** Use distinct names, or infer from one position only.

**Symptom:** A constrained `infer` silently returns the false branch
**Cause:** That is what the constraint does — the 4.7 notes say so directly: if it
does not satisfy the constraint, the conditional takes the false path.
**Fix:** Intended. Split into two conditionals if you need to distinguish "did not
match the shape" from "matched but failed the constraint".

**Symptom:** A tuple pattern does not match a longer tuple
**Cause:** `[infer A, infer B]` matches exactly two elements.
**Fix:** Add a rest element — `[infer A, infer B, ...unknown[]]`.

**Symptom:** `TS2589` from a recursive extractor
**Cause:** No base case, or a recursion that grows rather than shrinks.
**Fix:** Ensure the false branch terminates and that each step consumes structure;
consider a depth bound.

## Interview questions

**★ What does `infer` do, and where is it legal?**
It declares a type variable inside the pattern on the right of `extends`, bound to
whatever matched, and usable in the true branch. It is legal only in a
conditional type's `extends` clause, because the variable is only meaningful when
the pattern matched — there is nowhere for the false case to go.

**★ What did TypeScript 4.7 change about `infer`?**
It allowed a constraint on the inferred variable: `T extends [infer S extends
string, ...unknown[]] ? S : never`. Before that, matching *and* checking needed
two nested conditionals. If the inferred type does not satisfy the constraint, the
conditional takes the false path. It removes a level of nesting, which is the main
source of unreadable type-level code.

**★ What happens if you use the same `infer` name twice?**
It depends on variance. Co-variant positions — property or return types —
produce a **union** of the candidates; contra-variant positions — parameters —
produce an **intersection**, since a function would have to accept both. That is
how `Bar<{ a: (x: string) => void; b: (x: number) => void }>` yields
`string & number`.

**Why write `readonly (infer E)[]` rather than `(infer E)[]`?**
Because the plain form does not match a `readonly` array, so the helper silently
fails on `as const` data and on `readonly` parameters. The `readonly` form matches
both mutable and readonly arrays.

**How do you match the last element of a tuple?**
`T extends readonly [...unknown[], infer L] ? L : never` — a variadic pattern with
the rest element first. The same shape with `[...infer Rest, unknown]` gives
everything but the last, which is how tuple head/tail helpers are built.

**What stops a recursive `infer` helper from running forever?**
A false branch that terminates and a pattern that consumes structure at each step
— `T extends Promise<infer U> ? DeepUnwrap<U> : T` ends as soon as it meets a
non-promise. Without that, the compiler reports `TS2589`, *"Type instantiation is
excessively deep and possibly infinite."*

---

← [Topic index](./README.md) · Next → [02 · In strings, and your own](./02-strings-and-your-own.md)
