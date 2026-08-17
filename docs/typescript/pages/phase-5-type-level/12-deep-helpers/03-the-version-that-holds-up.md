---
title: "The version that holds up"
sidebar_label: "03 · The version that holds up"
sidebar_position: 3
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08 against the **TypeScript handbook** (*Conditional Types*, *Mapped
> Types*) and the **2.8** / **3.1 release notes** for the homomorphic behaviours quoted in
> [topic 01 · chunk 02](../01-mapped-types/02-modifiers.md). The `never[]` bound argument
> is [topic 10 · chunk 01](../10-deriving-function-types/01-the-wrapper-signature.md)'s,
> reused rather than re-derived. **No sandbox, no console block, no timings.**

[Chunk 02](./02-what-it-breaks.md) ended with the shape of the fix: not one guard on
`object`, but **a list of the things that must be handed back untouched**, in an order that
matters. Here is that list, built one guard at a time, with the failure each one answers.

## Building it up

```ts
type DeepReadonly<T> =
  IsAny<T> extends true                       ? T                                   // 1
  : T extends (...args: never[]) => unknown   ? T                                   // 2
  : T extends Map<infer K, infer V>           ? ReadonlyMap<DeepReadonly<K>, DeepReadonly<V>>
  : T extends Set<infer V>                    ? ReadonlySet<DeepReadonly<V>>        // 3
  : T extends Date | RegExp | Error | URL     ? T                                   // 4
  : { readonly [K in keyof T]: DeepReadonly<T[K]> };                                 // 5
```

with the `any` test that has to be written as a trick because there is no `IsAny`:

```ts
type IsAny<T> = 0 extends 1 & T ? true : false;
```

Five guards, five reasons:

1. **`any` first, before anything else can see it.** `any` satisfies both branches of every
   conditional, so any guard below it gives a union of both outcomes. Testing it first is
   the only way to get a predictable answer, and `0 extends 1 & T` works because `1 & any`
   is `any`, which `0` extends — while `1 & X` for any other `X` is not something `0`
   extends.
2. **Functions next**, because a mapped type cannot carry a call signature at all
   ([chunk 02](./02-what-it-breaks.md)). ⚠️ **`(...args: never[]) => unknown` and not
   `(...args: any[]) => unknown`** — this position wants the *widest bound* that every
   function is assignable to, which is exactly the argument
   [topic 10 · chunk 01](../10-deriving-function-types/01-the-wrapper-signature.md) makes:
   `never[]` is the bound, `any[]` is the signature you intend to call. Here nothing is
   called, so `never[]` is right.
3. **`Map` and `Set` before the general object case**, because their type arguments are not
   properties and a structural mapping never reaches them. Delegating to `ReadonlyMap` and
   `ReadonlySet` gets both the immutability and the recursion, and uses types that already
   exist in `lib`.
4. **The class instances you actually care about**, listed by name and returned unchanged.
5. **The mapping**, unchanged from the naive version — and by this point everything reaching
   it is plain data, which is what it was always for.

## 🔴 The guard you should *not* add, and it is the popular one

There is no array branch in that list, and that is deliberate.

An array guard is the obvious next line — `T extends readonly (infer E)[] ? readonly DeepReadonly<E>[] : …`
— and for `DeepReadonly` it makes things **worse**, because it takes arrays away from the
homomorphic path that was already handling them correctly. A tuple matches
`readonly (infer E)[]`, so the guard flattens `[string, number]` into
`readonly (string | number)[]`: the length is gone, the positions are gone, and the 4.0
labels are gone.

📌 **The naive version got tuples right** ([chunk 01](./01-the-naive-version.md)), through
`instantiateMappedTupleType`. Adding a guard to "handle arrays properly" is how people
lose that without noticing, because a tuple still type-checks as an array in most
positions.

⚠️ **`DeepPartial` does not get this choice.** It *needs* an array branch, because the
homomorphic path applies the optional modifier to the array's numeric element and turns
`string[]` into `(string | undefined)[]` ([chunk 02](./02-what-it-breaks.md)). So it pays
the tuple cost — unless it handles tuples explicitly first:

```ts
type DeepPartial<T> =
  // … the any / function / Map / Set / instance guards, as above …
  T extends readonly [unknown, ...unknown[]]  ? { [K in keyof T]: DeepPartial<T[K]> }
  : T extends readonly (infer E)[]            ? DeepPartial<E>[]
  : { [K in keyof T]?: DeepPartial<T[K]> };
```

🔴 **That asymmetry is the most useful thing in this chunk.** `DeepReadonly` and
`DeepPartial` are usually presented as the same type with a different modifier. They are
not: **one wants fewer guards than the other**, because the `readonly` modifier composes
with arrays and the `?` modifier does not.

## Distribution: decide it once, per guard

Every guard is a conditional with a naked type parameter, so every guard **distributes over
a union** ([topic 05](../05-distributive-conditionals.md)). With five guards, a union input
is taken apart and put back together five times.

Usually that is what you want — `DeepReadonly<A | B>` should be
`DeepReadonly<A> | DeepReadonly<B>`, and the homomorphic mapping at the end would have
distributed anyway. But it is worth knowing it is happening, because:

- a guard that should test **the whole union** must be bracketed: `[T] extends [Date]` asks
  "is this union exactly `Date`", where `T extends Date` asks it member by member;
- distribution multiplies the work, and this is a type that already fans out
  ([chunk 05 · The cost](./05-the-cost.md)).

**The default is right; the exception is when a guard is about the union rather than its
members.**

## What it still cannot do

Three limits survive every guard, and it is better to know them than to keep adding lines:

1. **The class list is finite and yours is not.** `Date`, `Map`, `Set`, `RegExp`, `Error`,
   `URL` — then `Buffer`, `Temporal.Instant`, an ORM's model class, a branded value object.
   Anything you did not list is still mangled by guard 5, and nothing warns you.
2. **A class instance's private state is not expressible anyway.** A mapped type produces a
   structural object; a class with `#private` fields is nominal in practice, so even the
   "correct" mapping of it is not assignable back to the class.
3. **Recursive data still recurses.** The guards change *what* gets mapped, not *how deep*.
   A self-referential type is still `TS2589`, and the answer is still a deliberate depth cap
   ([topic 11 · chunk 05](../11-recursive-types/05-capping-depth-deliberately.md)).

📌 **Limit 1 is the one that decides whether you should be writing this at all.** A helper
whose correctness depends on a hand-maintained list of every non-data class in your
dependency tree is exactly what
[topic 08 · the stopping tests](../08-knowing-when-to-stop/04-the-stopping-tests.md) is
about.

## Gotchas

**Symptom:** The helper returns a union of both branches for one property.
**Cause:** That property is `any`, and `any` satisfies both sides of a conditional.
**Fix:** Test for `any` first with `0 extends 1 & T`. No other position works, because
every guard below it has already been passed.

**Symptom:** Tuples came back as arrays after you "fixed" array handling.
**Cause:** A tuple matches `readonly (infer E)[]`, so the array guard catches it and
flattens it.
**Fix:** For `DeepReadonly`, delete the array guard — the homomorphic path was already
correct. For `DeepPartial`, put a tuple branch above the array branch.

**Symptom:** `DeepReadonly` behaves well and the `DeepPartial` written the same way does
not.
**Cause:** They are not the same type with a different modifier. `readonly` composes with
arrays; `?` applies to the element.
**Fix:** Let them diverge. Sharing an implementation between them costs more than it saves.

**Symptom:** A guard for a union type fires per member and you wanted the whole union.
**Cause:** Naked type parameters distribute.
**Fix:** `[T] extends [X]`. Do it per guard, deliberately — bracketing all of them changes
the top-level behaviour you probably wanted.

**Symptom:** An ORM model or a `Buffer` came back as a shell.
**Cause:** It is not in the class list, so it fell through to the mapping.
**Fix:** Add it — and then ask how many more there are, because that answer is the argument
for not using a deep helper here.

**Symptom:** The helper works but the hover is now unreadable.
**Cause:** Six conditionals plus a mapping is what the checker prints when something does
not fit.
**Fix:** Nothing local. This is the cost side of the trade and it is
[chunk 05 · The cost](./05-the-cost.md).

**Symptom:** `T extends Function` behaves differently from
`T extends (...args: never[]) => unknown`.
**Cause:** `Function` is a nominal-ish interface, not a structural bound over call
signatures; some callable types are not assignable to it in the way you expect.
**Fix:** Use the call-signature bound. It is the same choice
[topic 10](../10-deriving-function-types/README.md) makes for wrapper signatures.

**Symptom:** Adding a guard slowed the whole codebase's editor.
**Cause:** Each guard is a conditional instantiated at every level of every input, and this
type already fans out per property.
**Fix:** Fewer guards, applied at a boundary rather than everywhere — the ordering here is
also a cost ordering, cheapest tests first.

## Interview questions

**★ Walk through the guards a real `DeepReadonly` needs, in order.**
`any` first, because `any` satisfies both branches of every conditional and would otherwise
give a union of both outcomes at every guard below. Then functions, because a mapped type
cannot carry a call signature. Then `Map` and `Set`, because their type arguments are not
properties and a structural mapping cannot reach them — delegate to `ReadonlyMap` and
`ReadonlySet`. Then the class instances you care about, returned unchanged. Then the mapped
type, which by that point only sees plain data.

**★ Why is there no array guard in that list?**
Because the homomorphic mapping already handles arrays and tuples correctly — that is 3.1
behaviour, and it preserves element flags and labels. An array guard matches tuples too, so
it flattens `[string, number]` into `readonly (string | number)[]`. Adding it to "handle
arrays properly" silently loses tuple information that was never at risk.

**★ Then why does `DeepPartial` need one?**
Because the optional modifier is applied to the array's numeric element, so the homomorphic
path turns `string[]` into `(string | undefined)[]`. `DeepPartial` has to intercept arrays
to avoid that, and therefore has to handle tuples explicitly to avoid flattening them. It
is the clearest case of the two helpers not being the same type with a different modifier.

**★ Why `(...args: never[]) => unknown` rather than `Function` or `(...args: any[])`?**
Because this position needs the widest *bound* — a type every function is assignable to —
and contravariance makes `never[]` parameters accept any parameter list. `any[]` is the
right choice when you intend to *call* the value, which is not the case in a type guard.
`Function` is not a structural call-signature bound and behaves differently for some
callable types.

**★ How do you test for `any` in a conditional?**
`0 extends 1 & T ? true : false`. `1 & any` collapses to `any`, and `0` extends `any`, so
the true branch is taken; for every other `T`, `1 & T` is either `1` or `never`, and `0`
extends neither. It is a trick rather than a feature, which is worth saying out loud when
you write it.

**What does the finished helper still get wrong?**
Three things. The class list is hand-maintained and finite, so any non-data class you did
not name is still mangled with no warning. A class with private state is nominal in
practice, so even a "correct" structural mapping of it is not assignable back. And the
depth problem is untouched — self-referential data still hits `TS2589`, and the answer is
still a deliberate cap.

**Does adding guards change how the helper treats unions?**
Yes — every guard is a conditional with a naked type parameter, so each one distributes.
That is usually what you want, and the final mapping would have distributed anyway. The
exception is a guard that is asking about the union as a whole, which has to be bracketed
as `[T] extends [X]`.

---

← [02 · What it breaks](./02-what-it-breaks.md) · [Topic index](./README.md) ·
Next → [04 · `DeepPartial` is not `DeepReadonly`](./04-partial-is-not-readonly.md)
