---
title: "Union → intersection and other identities"
sidebar_label: "15 · Union → intersection"
sidebar_position: 15
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08 against the **TypeScript handbook** (*Conditional Types* — distributive
> conditional types and `infer`) and the corpus pages that own each underlying mechanism:
> distribution is [topic 05](./05-distributive-conditionals.md), `infer` is
> [topic 06](./06-infer/README.md), variance is
> [phase 3 · topic 14](../phase-3-generics/14-variance.md), and inference sites are
> [phase 3 · topic 10](../phase-3-generics/10-inference-sites-and-contextual-typing.md).
> ⚠️ **These identities are community patterns built out of documented behaviour, not
> documented features** — the page says so, and nothing here is claimed as specified.
> **No sandbox, no console block, no timings.**

This topic is **recognition, not recipe**. Every identity below appears in library code you
will read, and each of them is worth being able to decode in ten seconds. None of them is
worth reaching for casually, and the page ends by saying why.

## The one that matters: union → intersection

```ts
type UnionToIntersection<U> =
  (U extends any ? (k: U) => void : never) extends (k: infer I) => void ? I : never;

type R = UnionToIntersection<{ a: string } | { b: number }>;
// { a: string } & { b: number }
```

🔴 **It is two documented behaviours stacked, and neither is a trick on its own.**

**Step 1 — distribution turns the union into a union of functions.** `U extends any ? … : …`
is a distributive conditional ([topic 05](./05-distributive-conditionals.md)) over a naked
type parameter, so `A | B` becomes `((k: A) => void) | ((k: B) => void)`. Nothing clever has
happened yet; the union is still a union.

**Step 2 — inferring from a parameter position asks for a type that satisfies *all* of
them.** A function is assignable to another when its parameter accepts *at least* what the
target's does — parameters are **contravariant**
([phase 3 · topic 14](../phase-3-generics/14-variance.md)). So the single `I` that makes
`((k: A) => void) | ((k: B) => void)` assignable to `(k: I) => void` has to be acceptable to
both, and the only such type is `A & B`.

📌 **The union-to-intersection flip is contravariance, applied deliberately.** That sentence
is the whole explanation, and it is the one thing to take away — the rest is syntax around
it.

⚠️ **It has a real edge case people hit.** Because step 1 distributes, `UnionToIntersection`
of a union containing `never` drops that member (distribution over `never` yields `never`),
and applied to a single non-union type it returns that type unchanged — which is usually
what you want and occasionally not what you tested for.

## `IsUnion`

```ts
type IsUnion<T, U = T> = T extends any ? ([U] extends [T] ? false : true) : never;
```

The trick is the **second type parameter defaulted to the first**. `T` distributes and `U`
does not, so inside the conditional `T` is one member while `U` is still the whole union.
`[U] extends [T]` — bracketed to stop *its* distribution — is therefore false exactly when
the union has more than one member.

📌 **"Capture the whole thing in a second parameter before distributing" is the reusable
idea**, and it appears in half the identities in this topic. It is the type-level equivalent
of saving a value before entering a loop.

## `IsNever`, `IsAny` and the equality problem

```ts
type IsNever<T> = [T] extends [never] ? true : false;
type IsAny<T> = 0 extends 1 & T ? true : false;
```

**`IsNever` needs the brackets** because a naked `never` in a distributive conditional
distributes over *no* members and yields `never` rather than taking a branch — the check
would answer `never` instead of `true`.

**`IsAny` works because `1 & any` is `any`**, which `0` extends; for every other `T`,
`1 & T` is `1` or `never` and `0` extends neither. [Topic 12 · chunk 03](./12-deep-helpers/03-the-version-that-holds-up.md)
uses it as the first guard in a deep helper, for the reason that `any` satisfies both branches
of every conditional below it.

⚠️ **Type-level "equality" is the one to be most careful with.** The widely-copied version
relies on how the checker compares two *deferred conditional types* — behaviour that is not
specified in the handbook. It works, it is used in real libraries, and **this page will not
present it as a rule you can depend on**: if two types being identical is load-bearing for
your code, that is a test, not a type.

## Union → tuple, and why it is on this page as a warning

Turning a union into a tuple is expressible — take one member, remove it, recurse — and it is
the identity most likely to be a mistake:

- **The order is not defined.** Union members have no order the language guarantees, so the
  resulting tuple's order is an implementation detail you are now depending on.
- **It is a recursion over an unbounded set**, so it meets
  [topic 11](./11-recursive-types/README.md)'s ceilings on real inputs.
- **Almost every use of it wants something else** — usually a mapped type over the union, or
  an array whose element type is the union.

🔴 **If you find union-to-tuple in a codebase, the question to ask is what it feeds.** If the
answer is "an exhaustiveness check", a mapped type does that with a better error. If it is "a
list to iterate at runtime", the list should be a value with the type derived from it, which
is [topic 08 · chunk 09](./08-knowing-when-to-stop/09-the-boundary-and-the-generator.md)'s
derive-from-the-source rule.

## The small ones worth recognising

| Identity | What it does | The mechanism |
|---|---|---|
| `T extends any ? … : …` | distributes over a union | a naked type parameter in a conditional |
| `[T] extends [U]` | asks about the union as a whole | brackets suppress distribution |
| `T & {}` | removes `null` and `undefined` | intersecting with the empty object type |
| `{ [K in keyof T]: T[K] } & {}` | flattens an intersection for display | a homomorphic map plus an intersection, purely cosmetic |
| `T[number]` | union of an array's or tuple's elements | indexed access with the numeric index |
| `keyof T & string` | drops symbol and number keys | intersection as a filter |

📌 **The `Prettify`-style flatten in row four is cosmetic only** — it changes nothing about
assignability and exists so a hover reads as one object instead of `A & B & C`. That makes it
the one identity here whose purpose is *entirely* the error message, which is a good reason to
apply it at a boundary and nowhere else ([topic 12 · chunk 05](./12-deep-helpers/05-the-cost.md)).

## The honest conclusion

Every identity on this page has the same profile: **a short expression whose behaviour is
obvious only if you already know the mechanism**, and whose failure mode is an error message
naming the expanded machinery rather than the mistake.

🔴 **That is exactly what [topic 08](./08-knowing-when-to-stop/README.md) is about, and the
conclusion is the same one:** these are things to *recognise* when reading a library, not
things to reach for when writing application code. A library author has thousands of callers
and can amortise the cost of a clever type across all of them. An application has one, and it
is you, next quarter.

**Recognise them. Decode them. Then ask whether the thing you are about to write needs one.**

## Gotchas

**Symptom:** `UnionToIntersection<T>` returns `T` unchanged.
**Cause:** `T` was not a union. The identity is a no-op on a single type, correctly.
**Fix:** Nothing — but check the test covered the union case, because a single-type test
passes trivially.

**Symptom:** A union containing `never` came back with that member missing.
**Cause:** Distribution over `never` produces `never`, so the member contributes nothing.
**Fix:** Expected. If `never` was meaningful in that union, the union is modelling something
the type system will not carry.

**Symptom:** `IsNever<T>` answered `never` instead of `true` or `false`.
**Cause:** The check was written without brackets, so it distributed over no members.
**Fix:** `[T] extends [never]`. This is the canonical reason the bracket form exists outside
performance work.

**Symptom:** An `IsUnion` check reports `false` for something that is clearly a union.
**Cause:** The second parameter was not defaulted, so both sides distributed and the
comparison was member-against-itself.
**Fix:** `IsUnion<T, U = T>` and compare `[U]` against `T`. Capturing the whole union before
distributing is the mechanism.

**Symptom:** A type-level equality check disagrees with itself across compiler versions.
**Cause:** It depends on how deferred conditional types are compared, which is unspecified.
**Fix:** Do not make it load-bearing. Assert identity in a test if it matters.

**Symptom:** A union-to-tuple conversion produced a different order after an unrelated edit.
**Cause:** Union member order is not a guarantee.
**Fix:** Stop depending on it. If order matters, the source should be a tuple or an array
value, not a union.

**Symptom:** `T & {}` was used to remove `null` and someone replaced it with `NonNullable<T>`
and behaviour changed.
**Cause:** They are close but not identical in every position, particularly around generics
and `unknown`.
**Fix:** Prefer the named utility for readability, and check the specific position rather than
assuming the swap is free.

**Symptom:** An identity works in isolation and breaks inside a generic function.
**Cause:** Most of these depend on the type being *resolved*; inside a generic body the type
parameter is still deferred, so the conditional does not evaluate.
**Fix:** Apply them at the boundary where the type is known, not inside generic machinery.

## Interview questions

**★ Explain how `UnionToIntersection` works.**
Two stacked behaviours. First, a distributive conditional over a naked type parameter turns
`A | B` into a union of function types `((k: A) => void) | ((k: B) => void)`. Second,
inferring a single parameter type from that union asks for a type that all of those functions
accept — and because parameters are **contravariant**, the only type acceptable to both is
`A & B`. It is contravariance applied deliberately; there is no trick beyond that.

**★ Why does `IsNever` need `[T] extends [never]`?**
Because a naked type parameter in a conditional distributes, and distributing over `never`
means distributing over no members at all — the result is `never` rather than either branch.
Bracketing both sides suppresses distribution so the comparison is made against the whole
type, which is the only way to get `true` back.

**★ What is the trick in `IsUnion<T, U = T>`?**
The second parameter captures the whole union before distribution begins. Inside the
conditional `T` has been narrowed to a single member while `U` is still the full union, so
`[U] extends [T]` is false precisely when there was more than one member. "Save the whole
thing in a second parameter before you distribute" is the reusable idea, and it recurs across
these identities.

**★ Why is union-to-tuple a warning rather than a tool?**
Because union member order is not guaranteed, so the tuple's order is an implementation detail
you have started depending on; because it is a recursion over an unbounded set and meets the
compiler's ceilings on real input; and because nearly every use of it wants something else — a
mapped type for exhaustiveness, or a runtime array with the type derived *from* it rather than
the other way round.

**★ What is the honest advice about all of these?**
Recognise them, do not reach for them. They are short expressions whose behaviour is obvious
only if you already know the mechanism, and whose failure mode is an error naming the expanded
machinery rather than the mistake. A library author has thousands of callers to amortise that
cost across; an application has one reader, and it is you in six months.

**Why is type-level equality treated more cautiously than the others here?**
Because the common implementation relies on how the checker compares two deferred conditional
types, which is not specified behaviour. It works and it is used in real libraries — but if
two types being identical is load-bearing, that belongs in a test rather than in a type, where
an unspecified comparison rule is holding up your build.

**Where does `Prettify` fit among these?**
It is the only one whose entire purpose is the error message — a homomorphic map plus an
intersection with `{}`, changing nothing about assignability and everything about how a hover
reads. That makes it worth applying at a boundary, once, and worth keeping off the recursive
path where it costs work at every step.

## Where this connects

- **← [05 · Distributive conditional types](./05-distributive-conditionals.md)** — the first
  half of the union-to-intersection identity, and the bracket form every other identity here
  uses.
- **← [06 · Extracting with `infer`](./06-infer/README.md)** — the second half.
- **← [Phase 3 · Variance](../phase-3-generics/14-variance.md)** — why inferring from a
  parameter position produces an intersection. Without this the identity is memorisation.
- **← [08 · Knowing when to stop](./08-knowing-when-to-stop/README.md)** — the argument this
  page ends on, applied to exactly the shapes it names.
- **→ [16 · Higher-kinded types](./16-higher-kinded-types.md)** — the other recognition topic: what
  TypeScript cannot express at all, rather than what it can express awkwardly.

---

← [14 · `NoInfer<T>`](./14-noinfer.md) · [Phase 5 index](./README.md) ·
Next → [16 · Higher-kinded types](./16-higher-kinded-types.md)
