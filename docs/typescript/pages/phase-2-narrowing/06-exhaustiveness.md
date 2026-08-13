---
title: "Exhaustiveness with `never`"
sidebar_label: "06 · Exhaustiveness"
sidebar_position: 6
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 on **TypeScript 7.0.2**. Compiler output from
> `sandbox/ts-p1/ex2-any-unknown-never-void.sh`.

**Handle every variant and the value becomes `never`. Miss one and the error
names it.** This is the mechanism that turns "add a new status" from a bug hunt
into a compile error at every site that must change — and it is the single
biggest return on modelling with a discriminated union.

## The measurement

```ts
type Status = 'pending' | 'shipped' | 'cancelled';

function complete(x: Status) {
  if (x === 'pending') {} else if (x === 'shipped') {} else if (x === 'cancelled') {}
  else { const impossible: 1 = x; }
}

function incomplete(x: Status) {
  if (x === 'pending') {} else if (x === 'shipped') {}
  else { const impossible: 1 = x; }
}
```

```console
$ tsc --noEmit --strict src-ex2/exhaust.ts
src-ex2/exhaust.ts(13,16): error TS2322: Type '"cancelled"' is not assignable to type '1'.
exit=1
```

**One error, and it names `"cancelled"`.** `complete` compiles in silence because
after three checks the value is `never`, and `never` is assignable to everything
([Phase 1](../phase-1-type-vocabulary/06-any-unknown-never-void.md)).

## The idiom

Do not write `const impossible: 1` in real code — use a helper whose *parameter*
is `never`:

```ts
function assertNever(value: never): never {
  throw new Error(`Unhandled variant: ${JSON.stringify(value)}`);
}

function label(s: Status): string {
  switch (s) {
    case 'pending':   return 'Awaiting dispatch';
    case 'shipped':   return 'On its way';
    case 'cancelled': return 'Cancelled';
    default:          return assertNever(s);
  }
}
```

Two guarantees for the price of one function:

- **Compile time:** add `'refunded'` to `Status` and every `assertNever` call
  fails with `Argument of type '"refunded"' is not assignable to parameter of
  type 'never'`.
- **Runtime:** if a value arrives that the types said was impossible — from
  `JSON.parse`, an `as`, or a service deployed at a different version — it throws
  loudly instead of falling through silently.

That second half matters more than people expect. The types are erased; the only
runtime protection is this throw.

## Why `default` returning a fallback is the enemy

```ts
switch (s) {
  case 'pending': return 'Awaiting dispatch';
  default:        return 'Unknown';     // swallows every future variant
}
```

This compiles forever, no matter how many variants you add. It is the single most
common reason a codebase "uses discriminated unions" and still ships bugs when a
variant is introduced.

**The rule: a `default` branch either throws via `assertNever`, or the switch has
no `default` at all** — an exhaustive switch with a declared return type gets the
same protection:

```ts
function label(s: Status): string {
  switch (s) {
    case 'pending':   return 'Awaiting dispatch';
    case 'shipped':   return 'On its way';
    case 'cancelled': return 'Cancelled';
  }
  // error TS2366: Function lacks ending return statement — if a case is missing
}
```

The explicit return type is what makes this work; without it the return type
would just become `string | undefined`.

## On object unions

```ts
type Event =
  | { type: 'created'; id: string }
  | { type: 'shipped'; id: string; carrier: string }
  | { type: 'cancelled'; id: string; reason: string };

function describe(e: Event): string {
  switch (e.type) {
    case 'created':   return `Order ${e.id} created`;
    case 'shipped':   return `Order ${e.id} via ${e.carrier}`;
    case 'cancelled': return `Order ${e.id}: ${e.reason}`;
    default:          return assertNever(e);
  }
}
```

The error when a variant is added names the whole object shape, which is longer
but equally precise about what is unhandled.

## Making it exhaustive without a switch

An object map is often cleaner, and `Record` over the union makes it exhaustive
by construction:

```ts
const LABELS: Record<Status, string> = {
  pending: 'Awaiting dispatch',
  shipped: 'On its way',
  cancelled: 'Cancelled',
};
// adding a variant → error TS2739: Type '…' is missing the following properties
```

**Prefer this for pure value lookups.** It cannot forget a case, it needs no
helper, and the error arrives at the table rather than in a function. Use a
`switch` when the branches do work rather than return values.

## Where exhaustiveness quietly fails

**`any` in the union.** If any member is `any`, the residual type never becomes
`never` and the check silently passes.

**A widened discriminant.** If `type` is `string` rather than a literal, no case
eliminates anything ([05](./05-discriminated-unions.md)).

**Non-exhaustive `if` chains without an else.** If the final branch simply falls
off the end, there is no place for the `never` to be observed.

## Trade-off

**`assertNever`** gives a compile error at every site when a variant is added —
which is exactly what you want for a domain type, and *friction* when the union
is genuinely open (a locale, a feature-flag name, an event type from a third
party you do not control).

For open sets, model the fallback deliberately with a real `default` and treat
the unknown value as data, not as a bug.

## Gotchas

**Symptom:** Adding a union member did not break anything
**Cause:** A `default` branch that returns a fallback, or `any` in the union.
**Fix:** `assertNever` in `default`, or remove the `default` and declare the
return type.

**Symptom:** `Argument of type '"refunded"' is not assignable to parameter of
type 'never'`
**Cause:** Working exactly as designed — a variant is unhandled here.
**Fix:** Handle it. The error location is the list of places that must change.

**Symptom:** `Function lacks ending return statement` (`TS2366`) after adding a
variant
**Cause:** The exhaustive-switch form without a `default` — also working as
designed.
**Fix:** Add the case.

**Symptom:** `assertNever` compiles but throws in production
**Cause:** Unvalidated data carried a variant the types denied.
**Fix:** That is the runtime half doing its job — validate at the boundary
([Phase 9](../../syllabus/03-in-the-stack.md)).

**Symptom:** Exhaustiveness passes but a case is genuinely missing
**Cause:** An `any` or a widened discriminant defeated the residual type.
**Fix:** Check the union members' types; ban `any` in domain unions.

## Interview questions

**★ How do you make the compiler tell you when a union gains a variant?**
Handle every case and pass the value to a helper whose parameter is `never`:
`function assertNever(v: never): never { throw … }`. With all cases handled the
value is `never` and it compiles; miss one and the error names it — measured as
`Type '"cancelled"' is not assignable to type '1'`.

**★ Why does `assertNever` need to throw at runtime as well?**
Because types are erased. If unvalidated data carries a variant the types said
was impossible, the compile-time guarantee is worthless — the throw is what turns
that into a loud, located failure instead of silent fall-through.

**★ Why is a `default` branch that returns a fallback dangerous?**
It makes the switch compile forever, so new variants are never reported. It is
the most common reason a codebase that "uses discriminated unions" still breaks
when a variant is added. Either `assertNever` in `default`, or no `default` at
all with an explicit return type.

**Is there an alternative to a switch?**
`Record<Union, T>` for value lookups — a missing key is `TS2739` at the table
itself, with no helper function and no possibility of forgetting.

**When is exhaustiveness checking the wrong goal?**
When the set is genuinely open — locales, third-party event names, feature flags.
There a real `default` that handles the unknown value as data is correct, and
forcing exhaustiveness just produces churn.

---

← Prev: [Discriminated unions](./05-discriminated-unions.md) · Next → [Type guards](./07-type-guards.md)
