---
title: "The naive version, and what it is already right about"
sidebar_label: "01 · The naive version"
sidebar_position: 1
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08. 🔴 **The primitive pass-through was read out of the compiler's own
> source** — **TypeScript 5.9.3**,
> `sandbox/ts-p0/node_modules/typescript5/lib/typescript.js`, `instantiateMappedType`'s
> inner `instantiateConstituent`: the flag test
> `t.flags & (AnyOrUnknown | InstantiableNonPrimitive | Object | Intersection)` and the
> bare `return t` that follows it. The three homomorphic behaviours are the **2.8** and
> **3.1 release notes**, already quoted in
> [topic 01 · chunk 02](../01-mapped-types/02-modifiers.md). ⚠️ **Constants and internals
> are 5.9.3's and are not claimed for the 7.0.2 Go port.** **No sandbox, no console block,
> no timings.**

`Partial`, `Readonly` and `Required` are **one level deep**. That is not an oversight — it
is what makes them cheap and predictable — but it means the moment your data has a nested
object, the standard library stops helping and everybody writes the same four lines:

```ts
type DeepReadonly<T> = { readonly [K in keyof T]: DeepReadonly<T[K]> };
type DeepPartial<T> = { [K in keyof T]?: DeepPartial<T[K]> };
```

These are the versions in every blog post and half the codebases. They are **more correct
than they look in one specific way and badly wrong in five others**, and knowing which is
which is the whole topic. This chunk is the first half.

## Start from what a homomorphic mapping already gives you

`{ [K in keyof T]: … }` over a type parameter is **homomorphic**, and
[topic 01 · chunk 02](../01-mapped-types/02-modifiers.md) establishes the three things
that buys — all three of which the deep version inherits for free:

1. **Modifiers are preserved**, so a `readonly` property stays `readonly` and an optional
   property stays optional at every level.
2. **Arrays and tuples stay arrays and tuples** (3.1), rather than becoming objects with
   mapped `push` and `length` members.
3. **It distributes over a union**, so `DeepPartial<A | B>` is
   `DeepPartial<A> | DeepPartial<B>` rather than a mapping over the keys they share.

None of that is something the recursive version adds. It is inherited, and it is the
reason the naive one-liner is usable at all.

## 🔴 The part everybody guards against unnecessarily

Almost every published `DeepPartial` is written with a guard on `object`:

```ts
// the usual defensive shape
type DeepPartial<T> = T extends object ? { [K in keyof T]?: DeepPartial<T[K]> } : T;
//                    ^^^^^^^^^^^^^^^^^ "so it doesn't try to map a string"
```

The stated reason is to stop the recursion mapping over primitives. **That is not
something it was going to do.** From `instantiateMappedType`, the function that
instantiates a homomorphic mapped type once its type variable is known:

```js
// TypeScript 5.9.3, instantiateMappedType → instantiateConstituent
function instantiateConstituent(t) {
  if (t.flags & (3 /* AnyOrUnknown */ | 58982400 /* InstantiableNonPrimitive */
                 | 524288 /* Object */ | 2097152 /* Intersection */)
      && t !== wildcardType && !isErrorType(t)) {
    // … array / tuple / intersection / anonymous-object handling …
  }
  return t;          // ← everything else comes back untouched
}
```

**The mapping is only applied to constituents whose flags say object-ish.** A `string`, a
`number`, a `boolean`, a string literal, `null`, `undefined`, `bigint`, `symbol`, `void`,
`never`, an enum member — none of them match the test, so they fall through to `return t`
and come back exactly as they went in.

So on the primitive question, the naive one-liner is already correct:

```ts
type DeepReadonly<T> = { readonly [K in keyof T]: DeepReadonly<T[K]> };

type User = { id: number; name: string; address: { city: string } };
type R = DeepReadonly<User>;
// { readonly id: number; readonly name: string; readonly address: { readonly city: string } }
//              ^^^^^^ not mapped, not mangled — returned as-is
```

📌 **Why this is worth knowing rather than a curiosity.** The `T extends object ? … : T`
guard is not free: it makes the type a **conditional**, which means it distributes over
unions ([topic 05](../05-distributive-conditionals.md)), it is a different shape in an
error message, and it changes what the type does with `any`. People pay all three costs to
solve a problem they did not have — and then are surprised when the guard *also* fails to
fix the problems they did have, which are the subject of
[chunk 02 · What it breaks](./02-what-it-breaks.md).

⚠️ **The guard is still needed — for other reasons.** `Object` in that flag test covers
functions, class instances, `Date`, `Map`, `RegExp` and everything else with an object
type, and those *do* get mapped, usually to something useless. **Guard against those, not
against `string`.**

## Where the mapping goes when it does apply

The same function tells you what happens to the constituents that do match, and it is
worth reading because it explains behaviour 2 above:

- an **array** type takes `instantiateMappedArrayType`, which maps the element type once
  and rebuilds an array — preserving `readonly` through
  `getModifiedReadonlyState`;
- a **tuple** takes `instantiateMappedTupleType`, which maps each fixed element by its
  index, converts the element flags for `?` modifiers, and rebuilds a tuple **keeping its
  labels**;
- an **intersection** is mapped constituent by constituent and re-intersected;
- anything else object-shaped goes to `instantiateAnonymousType` — the general case, and
  the one that causes the damage in [chunk 02 · What it breaks](./02-what-it-breaks.md).

🔴 **Note what is missing from that list: there is no case for a function.** A function
type has the `Object` flag, so it takes the last branch and is mapped like any other
object.

## Gotchas

**Symptom:** You added `T extends object ? … : T` to stop the type mapping primitives, and
the behaviour did not change.
**Cause:** It was never mapping primitives — `instantiateConstituent` returns non-object
constituents unchanged.
**Fix:** Keep the guard only if you need it for functions, `Date`, `Map` and friends, and
know that is what it is for.

**Symptom:** Adding the `object` guard made the type distribute over a union.
**Cause:** The guard turns a mapped type into a **conditional** type, and a naked type
parameter in a conditional distributes.
**Fix:** `[T] extends [object] ? … : …` if you want the union kept whole
([topic 05](../05-distributive-conditionals.md)), or drop the guard.

**Symptom:** `DeepReadonly<any>` produces something strange.
**Cause:** `any` matches the flag test (`AnyOrUnknown`), so it *is* mapped rather than
passed through.
**Fix:** Handle `any` explicitly if it can reach the type — and note that the `object`
guard behaves differently here too, since `any extends object` takes **both** branches.

**Symptom:** `readonly` disappeared from an array somewhere inside the structure.
**Cause:** The mapping was made non-homomorphic — a key remap, an `Exclude` on the key
union, a `& string`.
**Fix:** Keep the loop as `[K in keyof T]`. [Topic 01 · chunk 02](../01-mapped-types/02-modifiers.md)'s
rule applies at every level of a recursive mapping, not just the top one.

**Symptom:** A tuple came back with its labels intact and you assumed the type was doing
nothing.
**Cause:** `instantiateMappedTupleType` deliberately preserves labels and element flags.
**Fix:** Nothing — that is correct 3.1 behaviour, and it is one of the few places the deep
helpers behave better than people expect.

**Symptom:** The deep type behaves differently on `A | B` than on the union's members.
**Cause:** Homomorphic mappings distribute over unions by design.
**Fix:** Usually what you want. If not, that is the same bracket trick
([topic 05](../05-distributive-conditionals.md)) — and note that adding the `object` guard
introduces a *second*, independent distribution.

## Interview questions

**★ Why are `Partial` and `Readonly` shallow?**
Because a one-level mapping is predictable, cheap, and composes — you can apply it to the
piece you actually mean. A deep version has to make decisions the standard library has no
business making for you: what to do with a `Date`, a `Map`, a method, an array element. The
absence is a design choice, and every hand-written deep helper is a place where those
decisions get made, usually implicitly.

**★ Does a recursive mapped type need a guard to avoid mapping primitives?**
No. A homomorphic mapped type only applies its template to constituents flagged
`Any`/`Unknown`, `InstantiableNonPrimitive`, `Object` or `Intersection`; everything else
falls through a bare `return t` in `instantiateConstituent` and comes back unchanged. The
guard that appears in most published implementations is solving a problem that does not
exist — though a guard is genuinely needed for functions and class instances, which *are*
object-flagged.

**★ What does the naive one-liner get right?**
Three things, all inherited from being homomorphic rather than added by the recursion:
modifiers are preserved at every level, arrays and tuples stay arrays and tuples with
their labels and element flags, and the type distributes over unions. Plus primitives pass
through. That is why it survives casual use long enough to reach production before its
real problems show up.

**★ What does adding `T extends object` actually cost?**
Three things. It makes the type a conditional, so it distributes over unions unless you
bracket it. It changes the shape reported in errors and hovers, which matters because a
deep helper's error messages are its worst feature. And it changes the `any` case, since
`any` satisfies both branches of a conditional. None of those is fatal; they are just
costs paid for nothing if the guard was added to protect primitives.

**Why does a tuple survive a deep mapping intact?**
Because there is a dedicated path — `instantiateMappedTupleType` — that maps each fixed
element by index, translates the optional flags according to the mapping's modifiers, and
rebuilds a tuple with its original labels. Before 3.1 there was no such path and a mapped
tuple became an object with mapped `push` and `length` members, which is the behaviour the
release notes explicitly fixed.

**Where does a function end up?**
In the general object branch, because a function type carries the `Object` flag. There is
no special case for it, which is exactly why the naive deep helper destroys methods — the
subject of the next chunk.

---

[Topic index](./README.md) · Next → [02 · What it breaks](./02-what-it-breaks.md)
