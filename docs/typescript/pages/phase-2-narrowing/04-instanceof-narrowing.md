---
title: "`instanceof` narrowing"
sidebar_label: "04 · instanceof"
sidebar_position: 4
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 on **TypeScript 7.0.2**. Narrowed types revealed by
> assignment to `1`; `sandbox/ts-p2/ex2-guards-and-loss.sh`.

**`instanceof` narrows anything built with a constructor — classes, `Error`,
`Date`, `RegExp`, `Map`.** It is the standard way to make sense of a caught
value, and it is the narrowing most likely to fail for reasons that have nothing
to do with your code.

## The measurement

```ts
class ApiError extends Error {
  constructor(public status: number) { super(); }
}

declare const e: unknown;

if (e instanceof ApiError) { const r: 1 = e; }
if (e instanceof Error)    { const r: 1 = e; }
```

```console
src-ex2/guards.ts(10,36): error TS2322: Type 'ApiError' is not assignable to type '1'.
src-ex2/guards.ts(11,36): error TS2322: Type 'Error' is not assignable to type '1'.
```

Note the starting point: `e` is **`unknown`**, and `instanceof` narrows it all
the way to a usable type in one step. That is the whole pattern for error
handling ([12 · `unknown` in `catch`](./12-unknown-in-catch.md)).

## The error-handling pattern

```ts
try {
  await chargeCard(order);
} catch (err) {
  if (err instanceof ApiError) {
    logger.warn({ status: err.status }, 'payment declined');
  } else if (err instanceof Error) {
    logger.error({ msg: err.message, stack: err.stack }, 'unexpected');
  } else {
    logger.error({ thrown: String(err) }, 'threw a non-Error');
  }
}
```

Three branches, because JavaScript can throw anything — a string, a number, an
object literal. The last branch is not paranoia; it is the one that fires when a
library rejects with a plain object.

Order matters: **the most specific class first.** `ApiError instanceof Error` is
true, so an `Error` check placed first would swallow it.

## Custom error classes need one line of care

```ts
class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
    this.name = 'ApiError';
  }
}
```

Setting `name` is worth the line — it is what appears in logs and in
`String(err)`. Under an ES5 `target`, subclassing built-ins also required
`Object.setPrototypeOf(this, ApiError.prototype)`; with `target: es2015` or
later, which is every project targeting Node 24, that workaround is unnecessary.

## Where `instanceof` fails

**1. Across realms.** A value from another JavaScript context — an iframe, a
`vm` context, a worker — has a *different* `Error` constructor:

```ts
err instanceof Error;   // false, even though it is an Error
```

**2. Across duplicated packages.** If two copies of a library exist in
`node_modules` (different versions, or a pnpm layout), `instanceof TheirError`
fails for an error created by the other copy. This is the version that actually
bites in production, and it is invisible in the source.

**3. On plain object types.** `instanceof` needs a constructor:

```ts
type Cat = { meow(): void };
pet instanceof Cat;   // error: 'Cat' only refers to a type, but is being used as a value
```

Use `in` ([03](./03-in-operator-narrowing.md)) or a type predicate
([07](./07-type-guards.md)).

**4. After serialisation.** A `Date` that has been through `JSON.stringify` /
`parse` is a `string`; a class instance is a plain object. Nothing survives the
wire ([Phase 9](../../syllabus/03-in-the-stack.md)).

## The robust alternative when realms are in play

```ts
function isError(e: unknown): e is Error {
  return typeof e === 'object' && e !== null && 'message' in e && 'stack' in e;
}
```

Structural rather than nominal, so it survives realm and duplicate-package
boundaries. Use it in library code and at process boundaries; plain `instanceof`
is fine inside a single application.

Node also provides `util.types.isNativeError(e)`, which is realm-safe for genuine
`Error` instances.

## `Symbol.hasInstance`

`instanceof` is customisable — the right-hand side may define its own check:

```ts
class Even {
  static [Symbol.hasInstance](value: unknown) {
    return typeof value === 'number' && value % 2 === 0;
  }
}

4 instanceof Even;   // true
```

Rarely worth writing, occasionally worth recognising in library code, and it does
narrow like any other `instanceof`.

## Trade-off

**`instanceof`** is precise, needs no helper, and narrows `unknown` in one step —
the cleanest tool inside a single application. It is **nominal**, so it breaks
across realms and duplicate package copies, and it cannot see plain object types
at all.

**A structural predicate** survives those boundaries at the cost of a function
you write and maintain, and a check that can be fooled by a lookalike object.

## Gotchas

**Symptom:** `instanceof Error` is false for something that is clearly an Error
**Cause:** It came from another realm (iframe, `vm`, worker) or from a duplicate
copy of a package.
**Fix:** A structural predicate, or `util.types.isNativeError` in Node.

**Symptom:** `'X' only refers to a type, but is being used as a value`
**Cause:** `instanceof` needs a runtime constructor; you gave it an interface or
type alias.
**Fix:** `in`, or a type predicate.

**Symptom:** A subclass check never runs
**Cause:** A base-class branch is earlier in the chain and matches first.
**Fix:** Order the checks most specific first.

**Symptom:** A `Date` from an API is not a `Date`
**Cause:** JSON has no date type — it arrived as a string.
**Fix:** Parse and construct it at the boundary; validate rather than assert.

**Symptom:** `err.message` is `undefined` after catching
**Cause:** Something threw a non-`Error` — a string or object literal.
**Fix:** Keep the final `else` branch and stringify defensively.

## Interview questions

**★ How do you narrow a caught value?**
`catch (err)` gives `unknown` under `strict`, so narrow with
`err instanceof ApiError`, then `err instanceof Error`, then a final `else` for
non-`Error` throws — JavaScript allows throwing anything. Measured, `instanceof`
takes `unknown` straight to `ApiError` in one step.

**★ Why might `instanceof Error` return false for an actual error?**
Because it compares constructor identity. A value from another realm — iframe,
`vm` context, worker — or from a second copy of a package in `node_modules` has a
different constructor, so the check fails. The duplicate-package case is the one
that bites in production.

**★ What can't `instanceof` narrow?**
Anything without a runtime constructor: interfaces, type aliases, plain object
types. It also cannot help after serialisation, since JSON strips prototypes.
Use `in` or a type predicate instead.

**How do you write a realm-safe error check?**
Structurally: `typeof e === 'object' && e !== null && 'message' in e && 'stack'
in e`, declared as a predicate returning `e is Error`. In Node,
`util.types.isNativeError` does it natively.

**Does the order of `instanceof` checks matter?**
Yes — subclasses satisfy their base class, so a base-class branch placed first
captures everything. Always check the most specific type first.

---

← Prev: [The `in` operator](./03-in-operator-narrowing.md) · Next → [Discriminated unions](./05-discriminated-unions.md)
