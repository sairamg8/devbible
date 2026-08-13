---
title: "Structural typing and assignability"
sidebar_label: "09 · Structural typing"
sidebar_position: 9
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 on **TypeScript 7.0.2**. Compiler output from
> `sandbox/ts-p1/ex3-structural-and-excess.sh` and `ex5-functions.sh`.

**TypeScript compares shapes, never names.** Two types with the same members are
the same type, whatever they were called and wherever they were declared. Every
"why was this accepted?" and "why was this rejected?" question resolves to the
assignability rules on this page.

## The rule

`A` is assignable to `B` when `A` has **at least** `B`'s members, each of a
compatible type.

```ts
interface Parcel { id: string; weightKg: number }

class Crate {
  constructor(public id: string, public weightKg: number, public fragile = true) {}
}

const c: Parcel = new Crate('C-1', 3);   // fine — Crate never mentions Parcel
```

No `implements`, no import, no inheritance. Extra members (`fragile`) are fine —
`Crate` is *more* than a `Parcel`, and more is always acceptable.

That is the opposite of a nominal language such as Java, where a class satisfies
an interface only if it says it does. It is what makes it cheap to type data you
did not create — API payloads, test doubles, config objects — against your own
interfaces.

## Extra members are fine; missing ones are not

```ts
declare function ship(p: Parcel): string;

const extra = { id: 'P-1', weightKg: 2, express: true };
ship(extra);              // fine

const partial = { id: 'P-2' };
ship(partial);            // error TS2345 … Property 'weightKg' is missing
```

## The exception: fresh object literals

```ts
ship({ id: 'P-2', weightKg: 2, express: true });   // error
```

```console
src-ex3/structural.ts(14,32): error TS2353: Object literal may only specify known properties, and 'express' does not exist in type 'Parcel'.
```

Same shape as `extra`, opposite verdict. A **fresh literal** assigned straight to
a typed target is additionally checked for unknown properties, because a stray
property in a literal is nearly always a typo rather than deliberate extra data.
Store it in a variable and the freshness is gone.

Detail, including the weak-type rule that also fires through variables, is in
[04 · Object types](./04-object-types.md).

## Functions: parameters compare in reverse

```ts
type Formatter = (value: number, currency: string) => string;

const f2: Formatter = (v) => `${v}`;             // fine — fewer params
const f3: Formatter = (v, c, extra) => `${v}`;   // error
```

```console
Target signature provides too few arguments. Expected 3 or more, but got 2.
```

A function may **accept less and return more** than the target requires. Returns
compare covariantly (a `Dog`-returning function fits a `Animal`-returning slot);
parameters compare the other way — which is why a handler that demands an extra
argument is rejected, while one that ignores arguments is accepted.

The known unsoundness: **method parameters are compared bivariantly** —
`{ handle(x: Animal): void }` and `{ handle(x: Dog): void }` are mutually
assignable, which is not safe but keeps a great deal of DOM and library code
working. `strictFunctionTypes` tightens this for function-typed *properties*, not
for method shorthand. Variance in full is
[Phase 3](../../syllabus/01-type-system.md).

## What structural typing costs: no nominal identity

```ts
type UserId = string;
type OrderId = string;

declare function loadUser(id: UserId): User;

const orderId: OrderId = 'O-1';
loadUser(orderId);   // no error. Both are just `string`.
```

A type alias creates a *name*, not a new type. Passing an order ID where a user
ID belongs is a real bug the compiler cannot see.

The fix is to make the shapes genuinely different — a **brand**:

```ts
type UserId = string & { readonly __brand: 'UserId' };
type OrderId = string & { readonly __brand: 'OrderId' };

const orderId = 'O-1' as OrderId;
loadUser(orderId);   // error: 'OrderId' is not assignable to parameter of type 'UserId'
```

The brand exists only in the type system — at runtime it is still a string. Full
treatment, including where to mint and unwrap them, in
[Phase 4](../../syllabus/02-types-at-scale.md).

## Private members do create nominal behaviour

```ts
class A { private token = ''; }
class B { private token = ''; }

const a: A = new B();   // error: Types have separate declarations of a private property 'token'.
```

Two classes with identical private members are **not** interchangeable. Each
`private` declaration is unique to its class, which is the one place TypeScript
behaves nominally without a brand.

## Reading an assignability error

The messages nest, and the useful line is the innermost one:

```
Type 'X' is not assignable to type 'Y'.
  Types of property 'items' are incompatible.
    Type 'string[]' is not assignable to type 'number[]'.
      Type 'string' is not assignable to type 'number'.
```

Read **bottom-up**: the real mismatch is `string` vs `number` at
`X.items[]`. The outer lines only describe the path taken to get there. This is
the single most useful habit for large object types
([Phase 10](../../syllabus/04-rigour-and-tooling.md)).

## Trade-off

**Structural typing** makes types cheap to satisfy and to test — no ceremony, no
imports between unrelated modules, mocks are just object literals.

**It costs identity.** Anything with the same shape is interchangeable, so
domain distinctions (`UserId` vs `OrderId`, `Celsius` vs `Fahrenheit`, validated
vs raw input) do not exist unless you create them with brands or private members.

## Gotchas

**Symptom:** An unrelated class or object satisfied your interface
**Cause:** Structural typing — the shape matched.
**Fix:** Usually fine. If the distinction is real, brand the type.

**Symptom:** Two ID types are interchangeable
**Cause:** Aliases of `string` are the same type.
**Fix:** A branded type, checked at the boundary where the ID is created.

**Symptom:** `Types have separate declarations of a private property 'x'`
**Cause:** Private members are nominal per class.
**Fix:** Share a base class, or type against an interface with only the public
surface.

**Symptom:** A callback with an extra parameter is rejected
**Cause:** Parameters compare contravariantly; you cannot demand what will not be
supplied.
**Fix:** Remove the parameter.

**Symptom:** An enormous unreadable assignability error
**Cause:** A deep object type with the mismatch buried.
**Fix:** Read the innermost line first; it names the actual incompatible pair.

## Interview questions

**★ What does "structural typing" mean and what does it buy you?**
Compatibility is decided by shape, not by declared name — a class that never
mentions an interface satisfies it if its members line up. It makes typing
external data, literals and test doubles cheap, with no `implements` ceremony.

**★ Why are `type UserId = string` and `type OrderId = string` interchangeable,
and how do you stop it?**
Both alias the same type; an alias is a name, not a new type. Brand them —
`string & { readonly __brand: 'UserId' }` — so the shapes actually differ. The
brand is erased at runtime.

**★ Why can you assign a function with fewer parameters but not more?**
Parameters compare contravariantly: ignoring an argument is safe, demanding one
the caller never sends is not. Return types compare covariantly, so returning
*more* specific data is fine.

**Where does TypeScript behave nominally?**
Private and protected class members. Two classes with identically-named private
fields are not assignable to each other, because each declaration is unique to
its class.

**How do you read a deeply nested assignability error?**
Bottom-up. The innermost "Type 'A' is not assignable to type 'B'" names the real
mismatch; the outer lines are the property path the compiler walked to reach it.

---

← Prev: [Function types](./08-function-types.md) · Next → [`null` and `undefined`](./10-null-and-undefined.md)
