---
title: "Object types"
sidebar_label: "04 · Object types"
sidebar_position: 4
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 on **TypeScript 7.0.2**. Errors below are literal compiler
> output from `sandbox/ts-p1/ex3-structural-and-excess.sh`.

**Objects are where nearly all of your types live.** Four features cover almost
every shape you will write: optional properties, `readonly`, index signatures,
and nesting.

## The shape

```ts
type Parcel = {
  id: string;
  weightKg: number;
  express?: boolean;          // optional
  readonly createdAt: Date;   // set once, at construction
  dimensions: {               // nested inline
    width: number;
    height: number;
  };
};
```

`?` and `readonly` are the two modifiers, and both are compile-time only —
`readonly` does not freeze anything at runtime.

## Optional is not the same as `| undefined`

```ts
type A = { retries?: number };
type B = { retries: number | undefined };

const a: A = {};                    // fine — property may be absent
const b: B = {};                    // error: Property 'retries' is missing
const b2: B = { retries: undefined }; // fine — must be present, may be undefined
```

`?` means *the key may not exist*. `| undefined` means *the key must exist and may
hold `undefined`*. Most of the time `?` is what you want; `B` is useful when you
require callers to make a decision explicitly.

Under `exactOptionalPropertyTypes` the distinction gets sharper still — `?` alone
stops accepting an explicit `undefined`
([Phase 10](../../syllabus/04-rigour-and-tooling.md)).

## `readonly` properties

```ts
type Order = { readonly id: string; total: number };

const o: Order = { id: 'O-1', total: 4800 };
o.total = 5000;   // fine
o.id = 'O-2';     // error: Cannot assign to 'id' because it is a read-only property
```

Shallow, like everything else here: `readonly items: string[]` prevents replacing
the array, not mutating it. `readonly items: readonly string[]` prevents both.

## Index signatures

For an object whose keys are not known ahead of time:

```ts
type Headers = { [name: string]: string };

const h: Headers = { 'content-type': 'application/json' };
h['x-request-id'] = 'abc';
```

The cost is real: **every** key is now assumed to exist.

```ts
h.contentType.toUpperCase();   // no error, and undefined at runtime
```

`noUncheckedIndexedAccess` fixes exactly this by making the value type
`string | undefined`. If you have that flag on, index signatures become safe; if
not, they are a hole.

`Record<K, V>` is the same thing, and reads better:

```ts
type Headers = Record<string, string>;
type ByStatus = Record<'pending' | 'shipped', Order[]>;   // exactly two keys, both required
```

With a union key, `Record` produces **required** properties for each member —
which is how you force an exhaustive lookup table.

**Prefer a `Map` when keys are truly dynamic data** (user IDs, cache keys): it
has real `has`/`delete`, no prototype-key collisions, and does not pretend every
key exists.

## Structural typing: shapes, not names

The compiler compares structure, never the name you declared:

```ts
interface Parcel { id: string; weightKg: number }

class Crate {
  constructor(public id: string, public weightKg: number, public fragile = true) {}
}

const c: Parcel = new Crate('C-1', 3);   // fine — never mentions Parcel
```

A class that has never heard of `Parcel` satisfies it. That is not a loophole; it
is the design. You can type third-party data, mocks and plain literals against
your own interfaces without either side importing the other.

## Excess property checks: the exception that confuses everyone

```ts
function ship(p: Parcel) { return p.id; }

const extra = { id: 'P-1', weightKg: 2, express: true };
ship(extra);                                     // fine

ship({ id: 'P-2', weightKg: 2, express: true }); // error
```

```console
src-ex3/structural.ts(14,32): error TS2353: Object literal may only specify known properties, and 'express' does not exist in type 'Parcel'.
```

**Same shape, different verdict.** The rule: a *fresh object literal* assigned
directly to a typed target gets an extra check for unknown properties. Once it is
in a variable, the freshness is gone and ordinary structural rules apply.

The reasoning is that a literal written at the call site with an unknown property
is almost always a mistake — a typo, or a property that does nothing:

```console
src-ex3/typo.ts(6,7): error TS2561: Object literal may only specify known properties,
but 'timeoutMS' does not exist in type 'Options'. Did you mean to write 'timeoutMs'?
```

That `Did you mean` is worth the whole feature.

### The measured surprise: weak type detection

Passing the typo through a variable also errored — which is *not* what excess
property checks alone would do:

```console
src-ex3/typo.ts(8,5): error TS2559: Type '{ timeoutMS: number; }' has no properties in common with type 'Options'.
```

This is a second, separate rule: a **weak type** — one whose properties are *all*
optional — rejects a value with no properties in common. It exists to stop
`{ timeoutMS: 500 }` silently satisfying `{ retries?: number; timeoutMs?: number }`.

And the limit of it, also measured: add **one required property** and the rule no
longer applies —

```ts
interface Mixed { id: string; timeoutMs?: number }
const m = { id: 'P-1', timeoutMS: 500 };
runMixed(m);   // no error. The typo passes silently.
```

So the honest summary: **a typo in an optional property is caught on a literal
always, and through a variable only when every property of the target is
optional.**

## Trade-off

**Structural typing** makes types cheap to satisfy — no `implements`, no imports,
easy mocking. It costs nominal safety: a `UserId` and an `OrderId` that are both
`string` are interchangeable. Branded types are the fix, in
[Phase 4](../../syllabus/02-types-at-scale.md).

**Excess property checks** catch typos where they happen, at the cost of a rule
that appears inconsistent until you know about literal freshness.

## Gotchas

**Symptom:** `TS2353: Object literal may only specify known properties`
**Cause:** A fresh literal with an extra property assigned to a typed target.
**Fix:** Remove the property, add it to the type, or assign via a variable if the
extra data is deliberate.

**Symptom:** The same object passes through a variable but fails inline
**Cause:** Excess property checks only apply to fresh literals.
**Fix:** Working as intended. Prefer the inline form so the check happens.

**Symptom:** `TS2559: has no properties in common with type 'X'`
**Cause:** Weak type detection — `X`'s properties are all optional and you shared
none of them.
**Fix:** Check for a typo, which is what it is nearly every time.

**Symptom:** A misspelled optional property is silently ignored
**Cause:** The target has at least one required property, so the weak-type rule
does not apply and the value came through a variable.
**Fix:** Pass the literal inline, or validate at the boundary (Phase 9).

**Symptom:** `obj[key]` is typed but `undefined` at runtime
**Cause:** An index signature claims every key exists.
**Fix:** `noUncheckedIndexedAccess`, or a `Map`.

**Symptom:** `readonly` did not stop a mutation
**Cause:** It is shallow and compile-time only.
**Fix:** `readonly` on the inner type too; `Object.freeze` for runtime.

## Interview questions

**★ What is structural typing?**
Type compatibility is decided by shape, not by declared name. A class that never
mentions an interface satisfies it if its members line up. It is what makes typing
third-party data, literals and mocks cheap — and it is why two `string`-based ID
types are interchangeable unless you brand them.

**★ Why does an object literal error when the identical variable does not?**
Excess property checks. A fresh literal assigned directly to a typed target is
checked for unknown properties, because a stray property in a literal is almost
always a typo. Assigning through a variable loses that freshness and falls back
to ordinary structural assignability.

**★ What is the difference between `retries?: number` and `retries: number | undefined`?**
The first allows the key to be absent; the second requires it to be present and
allows the value `undefined`. Use `?` for genuinely optional data and the union
when you want callers to state their intent explicitly.

**What is weak type detection?**
A rule that rejects a value sharing no properties with a target type whose
properties are *all* optional — otherwise `{ typo: 1 }` would satisfy
`{ a?: X; b?: Y }`. It stops applying as soon as the target has one required
property, which is a real gap worth knowing.

**When should you use a `Map` instead of an index signature?**
When keys are runtime data rather than a known set — user IDs, cache keys. `Map`
gives real `has`/`delete`, avoids prototype-key surprises, and does not claim
every possible key is present the way an index signature does without
`noUncheckedIndexedAccess`.

---

← Prev: [Arrays and tuples](./03-arrays-and-tuples.md) · Next → [Union types](./05-union-types.md)
