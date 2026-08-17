---
title: "What it breaks"
sidebar_label: "02 · What it breaks"
sidebar_position: 2
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08. 🔴 **Two mechanisms read out of the compiler's own source** —
> **TypeScript 5.9.3**, `sandbox/ts-p0/node_modules/typescript5/lib/typescript.js`:
> `resolveMappedTypeMembers` opens with
> `setStructuredTypeMembers(type, emptySymbols, emptyArray, emptyArray, emptyArray)` and
> only ever repopulates `members` and `indexInfos`; and `instantiateMappedTypeTemplate`
> applies `getOptionalType(propType, /*isProperty*/ true)` whenever the mapping carries
> `IncludeOptional` under `strictNullChecks`, including for the numeric element that
> `instantiateMappedArrayType` passes it. ⚠️ **Internals are 5.9.3's and are not claimed
> for the 7.0.2 Go port.** **No sandbox, no console block, no timings.**

[Chunk 01](./01-the-naive-version.md) showed the naive deep helper is already right about
primitives. Here is what it is wrong about — five failures, in the order you will meet
them, and every one of them is silent. Nothing below produces an error at the type's
definition. They all surface at a use site, later, as something that does not fit.

## 1. Methods are destroyed, and the mechanism is structural

```ts
type DeepReadonly<T> = { readonly [K in keyof T]: DeepReadonly<T[K]> };

type Session = { id: string; refresh(): void };
type R = DeepReadonly<Session>;
// { readonly id: string; readonly refresh: {} }
//                                         ^^ the method is now an empty object type
```

A function type has no properties, so `keyof` gives it nothing to map, and the result is
an object type with no members. But the deeper reason it cannot be a function is
structural — from `resolveMappedTypeMembers`:

```js
// TypeScript 5.9.3, resolveMappedTypeMembers — the first statement in the function
setStructuredTypeMembers(type, emptySymbols, emptyArray, emptyArray, emptyArray);
//                             members       call sigs   construct   index infos
```

**The call- and construct-signature lists start empty and are never repopulated** — the
rest of the function only fills in `members` and `indexInfos`. 🔴 **A mapped type cannot
carry a call signature at all.** So this is not a bug you can work around inside the
mapping; a type that must keep its methods has to *avoid* being mapped.

⚠️ **This is the failure people misdiagnose most.** The symptom appears at a call site —
*"This expression is not callable"* — in a file that never mentions `DeepReadonly`, so the
search starts in the wrong place.

## 2. Class instances become structurally different objects

`Date`, `RegExp`, `Error`, `URL`, `Map`, `Set`, `Promise` — anything whose type is a class
instance — carries the `Object` flag, so it takes the general mapping branch:

```ts
type R = DeepReadonly<{ createdAt: Date }>;
// { readonly createdAt: { readonly getTime: {}; readonly toISOString: {}; … } }
```

Every method of `Date` is enumerated by `keyof`, then each one is mapped by failure 1 into
an empty object. The result is **not assignable to `Date`**, has no usable members, and
prints as a wall of text in the hover.

For `Map<K, V>` and `Set<V>` there is a second problem on top: the mapping walks the
*methods*, not the type arguments, so `V` is never reached. A "deep readonly" `Map` is
neither deep nor readonly — it is a mangled object.

📌 **`ReadonlyMap` and `ReadonlySet` already exist in `lib`**, and `readonly T[]` exists
for arrays. A deep helper that means it should hand these types to their real immutable
counterparts rather than mapping over them.

## 3. `DeepPartial` makes array elements possibly `undefined`

This one is invisible until it is not:

```ts
type DeepPartial<T> = { [K in keyof T]?: DeepPartial<T[K]> };

type P = DeepPartial<{ tags: string[] }>;
// { tags?: (string | undefined)[] }
//           ^^^^^^^^^^^^^^^^^^^ every ELEMENT, not just the property
```

The mechanism is in `instantiateMappedTypeTemplate`: when the mapping carries the optional
modifier and `strictNullChecks` is on, the property type becomes
`getOptionalType(propType, /*isProperty*/ true)`. `instantiateMappedArrayType` calls that
same function for the array's **numeric** element, so the `?` you wrote for object
properties is applied to array elements too.

The result type-checks everywhere and then produces `undefined` in a `.map` callback that
had no reason to expect one. `DeepReadonly` does not have this problem, because `readonly`
on an array element position means something sensible.

## 4. A recursive data type recurses forever

The deep helpers are recursion over objects, and
[topic 11 · chunk 04](../11-recursive-types/04-the-fine-print.md) explains why that shape
cannot be converted to tail position: **every property is its own branch, so the work fans
out rather than advancing.** A type that refers to itself makes that unbounded:

```ts
type Json = { [k: string]: Json | string | number | boolean | null };

type R = DeepReadonly<Json>;   // Type instantiation is excessively deep — TS2589
```

There is no accumulator to write here. The options are a deliberate depth cap
([topic 11 · chunk 05](../11-recursive-types/05-capping-depth-deliberately.md)) or not
applying the helper to self-referential data — and a JSON type is exactly the shape people
apply it to first.

## 5. `any` is mapped rather than passed through

`any` matches the flag test in `instantiateConstituent` (`AnyOrUnknown`), so it does not
take the `return t` path that primitives take. A property typed `any` therefore goes
through the mapping, and what comes back is not `any` — which sounds like an improvement
and is not, because it makes the deep helper's behaviour depend on how much `any` is in
the input. [Phase 10 · chunk on `any`](../../phase-10-strictness/03-containing-any.md)
owns that argument; here it is enough to know the deep helper does not leave `any` alone.

## The pattern behind all five

Four of the five are the same mistake: **`keyof` and a mapped type describe *data*, and the
helper is being applied to things that are not data.** A method, a `Date`, a `Map`, a
`Promise` — these are objects with behaviour, and a structural mapping over their keys
produces a shape that has their names and none of their meaning.

🔴 **So the guard the naive version needs is not `T extends object` — it is a list of the
things that must be handed back untouched.** That is **chunk 03 · The version that holds up** *(not written yet)*'s
subject, and it explains why every serious implementation has a stack of conditionals at
the top rather than one.

## Gotchas

**Symptom:** *"This expression is not callable"* at a call site, in a file that never
mentions the deep helper.
**Cause:** A mapped type has no call signature, so the method became `{}` several levels
up.
**Fix:** Guard functions out of the mapping. There is no way to keep a call signature
*through* a mapped type.

**Symptom:** A `Date` field no longer accepts a `Date`.
**Cause:** It was mapped into an object with `Date`'s method names and empty object types
as their values.
**Fix:** Return `T` unchanged for class-instance types you care about, explicitly listed.

**Symptom:** `.map(x => x.trim())` errors on a deep-partial array with *"possibly
undefined"*.
**Cause:** The optional modifier is applied to the array's numeric element, not only to
the property.
**Fix:** Handle arrays as their own case in the helper, so the element type is made deep
without being made optional.

**Symptom:** A `Map` came out with no key or value types anywhere.
**Cause:** The mapping walked the `Map`'s methods; the type arguments are not properties,
so nothing reached them.
**Fix:** `ReadonlyMap<DeepReadonly<K>, DeepReadonly<V>>` as an explicit case, or leave
`Map` alone.

**Symptom:** `TS2589` the first time the helper meets a JSON-shaped type.
**Cause:** Self-referential data plus object fan-out; there is no bounded input to consume.
**Fix:** Cap the depth deliberately, or exclude recursive shapes from the helper's inputs.
Adding an accumulator is not available for this shape.

**Symptom:** The helper behaves inconsistently between two codebases with the same
structure.
**Cause:** One of them has `any` in the data. `any` is mapped rather than passed through,
so it changes what the whole branch produces.
**Fix:** Handle `any` explicitly at the top of the conditional stack, before anything else
gets to see it.

**Symptom:** Everything above was fixed and the type still misbehaves inside a union.
**Cause:** Adding guards made the helper a conditional, which distributes
([topic 05](../05-distributive-conditionals.md)) — sometimes twice, if you added more than
one guard.
**Fix:** Decide per guard whether distribution is wanted, and bracket the ones where it is
not.

**Symptom:** `readonly` was applied successfully and the value still changed at runtime.
**Cause:** `readonly` is a compile-time modifier;
[phase 1 · topic 14](../../phase-1-type-vocabulary/14-readonly-and-immutability.md) has the
full argument.
**Fix:** Nothing in the type system. If runtime immutability is the requirement, the type
is the wrong tool for it.

## Interview questions

**★ Why does a deep helper destroy methods?**
Because a mapped type cannot carry a call signature. `resolveMappedTypeMembers` initialises
the call- and construct-signature lists to empty arrays and only ever fills in members and
index infos, so whatever a mapped type produces is a property bag. A function type also has
no properties for `keyof` to find, so a method maps to an empty object type. It is
structural, not a bug — which is why the fix is to keep functions out of the mapping rather
than to map them better.

**★ What happens to a `Date` inside `DeepReadonly`?**
It is object-flagged, so it is mapped: `keyof Date` enumerates every method, each method
maps to `{}`, and the result is an object with `Date`'s method names and no behaviour, not
assignable to `Date`. The same happens to `RegExp`, `Error`, `URL` and every class
instance, and to `Map` and `Set` with the extra insult that their type arguments are never
reached.

**★ Name a failure specific to `DeepPartial` that `DeepReadonly` does not have.**
`DeepPartial` makes array *elements* possibly `undefined`. Under `strictNullChecks` the
optional modifier makes the mapped property type `getOptionalType(...)`, and the array path
runs the same template instantiation for the numeric element — so `string[]` becomes
`(string | undefined)[]`. It type-checks everywhere and surfaces as an unexpected
`undefined` inside a `.map` callback.

**★ Why can't a deep helper over a recursive type be fixed with an accumulator?**
Because object recursion fans out. Each property is a separate recursive branch, so there
is no single "rest of the input" to pass along and therefore no tail call to make. The
accumulator conversion needs one shrinking argument; an object walk has one per property.
The available answers are a deliberate depth cap or not applying the helper to that shape.

**★ What is the common thread in these failures?**
The helper describes data and is being applied to things that are not data. A structural
mapping over the keys of an object with behaviour keeps the names and discards the
meaning. That is why a working implementation is a stack of guards naming what to leave
alone, rather than one clever mapped type.

**Is the `T extends object` guard the fix for any of this?**
Only accidentally, and only for the cases it happens to exclude. It does not distinguish a
plain data object from a `Date` or a function — all three are object-flagged — so it lets
every failure in this chunk through. The guards that matter are specific: functions first,
then the class instances you care about, then arrays, then the mapping.

**Does `any` survive a deep helper unchanged?**
No. `any` matches the object-ish flag test in `instantiateConstituent`, so it is mapped
rather than returned untouched the way primitives are. It is worth handling explicitly at
the top of the conditional stack, because otherwise the amount of `any` in the input
changes what the helper produces.

---

← [01 · The naive version](./01-the-naive-version.md) · [Topic index](./README.md) ·
Next → **03 · The version that holds up** *(not written yet)*
