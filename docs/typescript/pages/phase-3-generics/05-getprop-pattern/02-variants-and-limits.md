---
title: "Variants, and where it breaks"
sidebar_label: "02 · Variants and limits"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the **TypeScript handbook** (*Indexed Access Types*,
> *Generics*) and the **`lib.es5.d.ts`** declarations of `Pick` and `Record`,
> read directly. `TS7053` (*"Element implicitly has an 'any' type because
> expression of type '{0}' can't be used to index type '{1}'."*) and `TS2536`
> (*"Type '{0}' cannot be used to index type '{1}'."*) were read out of the
> **compiler's own diagnostic table** — ⚠️ TypeScript **6.0.3**, not the 7.0.2
> this corpus targets. **No console block** — no sandbox run covers this phase.

[Chunk 01](./01-the-signature.md) built the signature. This chunk is the family
it belongs to, and the four places it stops working.

## The family

Every one of these is `<T, K extends keyof T>` with a different body.

```ts
// Read one property.
function getProp<T, K extends keyof T>(obj: T, key: K): T[K] {
  return obj[key];
}

// Write one property — note the value type.
function setProp<T, K extends keyof T>(obj: T, key: K, value: T[K]): T {
  return { ...obj, [key]: value };
}

// Read one property from many objects.
function pluck<T, K extends keyof T>(items: readonly T[], key: K): T[K][] {
  return items.map(i => i[key]);
}

// Read several properties from one object.
function pick<T extends object, K extends keyof T>(obj: T, keys: readonly K[]): Pick<T, K> {
  const out = {} as Pick<T, K>;
  for (const k of keys) out[k] = obj[k];
  return out;
}

// Group by a property's value.
function groupBy<T, K extends keyof T>(
  items: readonly T[],
  key: K,
): Map<T[K], T[]> { … }
```

**`setProp`'s third parameter is the one worth studying.** `value: T[K]` means
the value must match *the property named by the key that was passed* — so
`setProp(user, 'age', 'thirty')` is an error at the value, with the key named in
the message. That is a genuinely hard thing to express in most type systems and
it costs one indexed access here.

`groupBy` returning `Map<T[K], T[]>` is the same idea in the key position: the
map's key type is whatever that property's type is.

## Constraining by the *value* type, not just the key

`K extends keyof T` says "a key". Sometimes you need "a key whose value is a
number":

```ts
type KeysOfType<T, V> = {
  [K in keyof T]-?: T[K] extends V ? K : never
}[keyof T];

function sumBy<T, K extends KeysOfType<T, number>>(
  items: readonly T[],
  key: K,
): number {
  return items.reduce((n, i) => n + (i[key] as number), 0);
}

sumBy(users, 'age');     // fine
sumBy(users, 'name');    // rejected — 'name' is not a number-valued key
```

This is the natural next step and it is where the pattern starts needing Phase 5
machinery (a mapped type with a conditional, indexed by `keyof T`). Note the
`as number` in the body: with a computed constraint the compiler can no longer
prove the body on its own, which is an honest cost of the extra precision rather
than a mistake — and a reason not to reach for it until the plain version is
genuinely insufficient.

## 🔴 Where it breaks

**1. The key is a widened `string`.**

```ts
let k = 'name';                 // string, not 'name'
getProp(user, k);               // TS2345
```

The constraint keeps a literal only if the argument *has* one. A `let`, a
function parameter typed `string`, or anything from outside the file arrives
widened. Fixes, in order of preference: a `const` binding, `as const`, or — for
genuinely external input — a guard
([`isKeyOf`](../04-keyof/02-keyof-in-practice.md)), never an assertion.

**2. Indexing a type that has no index signature.**

```ts
const style: Record<string, string> = {};
function read(obj: { a: number }, k: string) {
  return obj[k];
}
```

```text
error TS7053: Element implicitly has an 'any' type because expression of type
'string' can't be used to index type '{ a: number; }'.
```

`TS7053` is the un-generic version of this whole topic showing up as an error —
the message is telling you to constrain the key. Its sibling `TS2536`
(*"Type '{0}' cannot be used to index type '{1}'."*) appears when the indexing
type is a type parameter that is not constrained to `keyof`.

**3. `T` is a union.**

```ts
type Shape = { kind: 'circle'; r: number } | { kind: 'square'; side: number };

getProp(shape, 'r');    // rejected — keyof Shape is just 'kind'
```

`keyof` a union gives only the **common** keys
([topic 04](../04-keyof/02-keyof-in-practice.md)), so the constraint collapses to
the discriminant. The fix is to narrow `shape` before the call, not to loosen the
helper — the constraint is correctly reporting that the property may not exist.

**4. Optional properties and `noUncheckedIndexedAccess`.**

`T[K]` on an optional property already includes `| undefined`, which is right.
But under `noUncheckedIndexedAccess`, an *index signature* access adds
`| undefined` as well:

```ts
type Dict = Record<string, User>;
function getUser(d: Dict, k: string) {
  return d[k];        // User | undefined under the flag
}
```

That is the flag working — a `Record<string, X>` genuinely can miss — and the
answer is to handle the `undefined`, not to `!` it away
([Phase 2 · topic 13](../../phase-2-narrowing/13-non-null-assertion.md)).

## Deep paths are a different problem

`getProp(user, 'address.city')` does not work, and cannot with this signature:
`'address.city'` is not a key of `User`. Typed deep access needs **template
literal types plus recursion** to build the union of valid paths and resolve the
type at the end of one — which is Phase 5, and a genuinely large amount of
machinery.

Before reaching for it, note what it costs: path strings are worse to refactor
than property access (a rename tool will not follow them), the error messages get
much harder to read, and compile time on a large type is noticeable. **A form
library needs this. Application code usually does not** — `user.address?.city`
is checked, refactorable and free.

## Trade-off

**The `getProp` shape** gives exact return types, rejects typo'd keys with a
message that lists the valid ones, and needs no assertion in its body. It costs a
second type parameter that everyone maintaining the signature has to understand,
and it is fragile at the edges — a widened key or a union `T` and it stops
helping.

**A plain `obj.name`** is simpler, refactorable by tooling, and always correct.
Prefer it. The pattern earns its place when the key is genuinely **data** — a
column name from a config, a sort field from a query string, a form field name.

## Gotchas

**Symptom:** `TS2345` on a key that is spelled correctly
**Cause:** The argument widened to `string` — a `let`, or a parameter typed
`string`.
**Fix:** `const`, `as const`, or a guard for external input.

**Symptom:** `TS7053: Element implicitly has an 'any' type…`
**Cause:** Indexing an object type with a plain `string`.
**Fix:** Constrain the key — this is the error the pattern exists to remove.

**Symptom:** `TS2536: Type 'K' cannot be used to index type 'T'`
**Cause:** A type parameter used as an index without `K extends keyof T`.
**Fix:** Add the constraint.

**Symptom:** Only the discriminant is an accepted key
**Cause:** `T` is a union, so `keyof T` is the common keys only.
**Fix:** Narrow before calling.

**Symptom:** `setProp` accepts a wrong-typed value
**Cause:** The value parameter is `unknown` or `any` rather than `T[K]`.
**Fix:** `value: T[K]` — that is what ties the value to the key.

**Symptom:** The result is `X | undefined` and the object clearly has the key
**Cause:** `noUncheckedIndexedAccess` on an index-signature access.
**Fix:** Handle it. The flag is right that a `Record<string, X>` can miss.

## Interview questions

**★ How do you type `setProp(obj, key, value)` so the value must match the key?**
`function setProp<T, K extends keyof T>(obj: T, key: K, value: T[K]): T`. The
indexed access `T[K]` in the value position ties the third argument to whatever
property the second one named, so `setProp(user, 'age', 'thirty')` errors at the
value.

**★ Why does `getProp` stop working when the key comes from a variable?**
Because the constraint preserves a literal only if the argument has one, and a
`let` or a `string`-typed parameter has already widened. Use a `const` binding or
`as const`; for input from outside, use an `isKeyOf` guard rather than an
assertion.

**★ What is `TS7053` telling you?**
That you are indexing an object type with a plain `string`, so the result would
be an implicit `any`. It is precisely the failure this whole pattern removes —
the fix is to constrain the key to `keyof T` rather than to silence the error.

**Why does the pattern fail when `T` is a union?**
`keyof` a union gives only the keys common to every member, so the constraint
collapses — often to just the discriminant. The helper is correctly reporting
that the property might not exist; narrow the value first.

**When should you *not* use this pattern?**
When the key is written in the source. `user.name` is simpler, refactorable by
tooling and always correct. The pattern earns its place only when the key is
data — a sort field from a query string, a column from config, a form field name.

---

← Prev: [01 · The signature, piece by piece](./01-the-signature.md) · Next → [06 · Indexed access types](../06-indexed-access-types.md)
