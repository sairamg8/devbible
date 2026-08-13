---
title: "Intersection types"
sidebar_label: "11 · Intersection types"
sidebar_position: 11
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 on **TypeScript 7.0.2**. Errors from
> `sandbox/ts-p1/ex4-type-vs-interface.sh`.

**`A & B` means "both at once".** It is the composition tool for object shapes —
and the one place where an impossible type is produced silently instead of being
reported.

## Combining shapes

```ts
type Timestamps = { createdAt: Date; updatedAt: Date };
type Identified = { id: string };

type Order = Identified & Timestamps & {
  total: number;
};

const o: Order = {
  id: 'O-1',
  total: 4800,
  createdAt: new Date(),
  updatedAt: new Date(),
};
```

Every member of every operand is required. This is the mixin pattern for types:
small named fragments composed into the shape you need, rather than one interface
repeated with variations.

## Union vs intersection — the direction confuses everyone

```ts
type A = { a: string };
type B = { b: string };

declare const u: A | B;   // one of them: only common members are accessible (none)
declare const i: A & B;   // both: every member is accessible
```

`|` widens the set of **values** and narrows the set of usable **members**;
`&` does the reverse. The intuition that trips people up is that "or" feels
permissive — for values it is, but it makes the type *less* useful until you
narrow.

## The silent failure: conflicting members

```ts
type TA = { x: string };
type TB = TA & { x: number };   // no error here
```

`TB['x']` is `string & number` — a type with no possible values, which is
`never`. Nothing can satisfy it, and the compiler says nothing at the
declaration. You discover it at the first assignment:

```ts
const t: TB = { x: 'a' };   // error: Type 'string' is not assignable to type 'never'
```

Interfaces catch it at the declaration instead:

```ts
interface A { x: string }
interface B extends A { x: number }
// error TS2430: Interface 'B' incorrectly extends interface 'A'.
```

**That is the argument for `interface extends` over `&` when modelling layered
domain shapes** ([07 · type vs interface](./07-type-vs-interface.md)) — the error
arrives where the mistake is.

## Intersections of unions distribute

```ts
type Result = ({ ok: true; data: string } | { ok: false; error: Error }) & { id: string };
// ⇒ { ok: true; data: string; id: string } | { ok: false; error: Error; id: string }
```

Adding a common field to every branch of a discriminated union is a legitimate
and useful pattern — the union stays discriminated and every member gains `id`.

## Intersections with primitives

```ts
type Impossible = string & number;   // never
type Branded = string & { readonly __brand: 'UserId' };   // useful
```

The second is the branded-type trick ([09 · Structural typing](./09-structural-typing.md)):
a `string` intersected with an object shape no real string has. No value can be
created accidentally, but a `string` can be *asserted* into it at a validated
boundary — which is exactly the control you want.

## Where intersections beat extension

```ts
type WithPagination<T> = T & { page: number; pageSize: number };
type Props = ButtonProps & { loading?: boolean };
```

Generic composition and one-off extension of an imported type read better as
intersections, and do not require the target to be an interface. React props are
the most common real use.

## Trade-off

**Intersections** compose anything, including generics and unions, with no
declaration ceremony. They cost you the conflict check — a mistake becomes
`never` and surfaces later, further away.

**`interface extends`** reports conflicts at the declaration and documents a
hierarchy. It only works between object types with statically known members.

## Gotchas

**Symptom:** `Type 'string' is not assignable to type 'never'`
**Cause:** An intersection combined conflicting member types.
**Fix:** Find the two operands declaring the same member differently. Consider
`interface extends`, which reports it at the declaration.

**Symptom:** An intersection of unions produced an unreadable type
**Cause:** It distributed across every branch.
**Fix:** Usually intended; name the result with an alias so error messages have
something short to print.

**Symptom:** `A & B` where both declare the same method with different signatures
**Cause:** The result is an overloaded signature, not an error — call resolution
tries them in order.
**Fix:** Fine if intended; otherwise rename one of the methods.

**Symptom:** An intersection with a primitive is `never`
**Cause:** `string & number` has no values.
**Fix:** You probably wanted a union (`string | number`).

**Symptom:** Optional members behave unexpectedly in an intersection
**Cause:** `{ a?: string } & { a: string }` requires `a` — the stricter side wins.
**Fix:** Working as designed; make the intent explicit with a single declaration.

## Interview questions

**★ What is the difference between `A | B` and `A & B`?**
`|` is "one of" — the value is one of the types, so only members common to every
branch are accessible until you narrow. `&` is "both at once" — every member of
every operand is present and required. Unions widen the values and narrow the
usable members; intersections do the opposite.

**★ What happens when an intersection has conflicting members?**
The member's type becomes the intersection of the conflicting types — `string &
number`, which is `never`. No error is reported at the declaration; the failure
appears at the first assignment as
`Type 'string' is not assignable to type 'never'`.

**★ Why might you prefer `interface extends` over `&`?**
`extends` checks compatibility and reports a conflict where it is written
(`TS2430`), while an intersection produces an unsatisfiable type silently. For
layered domain models that makes `extends` the safer default.

**How do intersections behave with unions?**
They distribute: `(A | B) & C` becomes `(A & C) | (B & C)`. That is how you add
a shared field to every branch of a discriminated union without breaking the
discriminant.

**What is a branded type and how does it use an intersection?**
`string & { readonly __brand: 'UserId' }` — a primitive intersected with a shape
no ordinary string has, so an arbitrary `string` is not assignable to it. It
exists only in the type system and is created deliberately at a validated
boundary.

---

← Prev: [`null` and `undefined`](./10-null-and-undefined.md) · Next → [Call and construct signatures](./12-call-and-construct-signatures.md)
