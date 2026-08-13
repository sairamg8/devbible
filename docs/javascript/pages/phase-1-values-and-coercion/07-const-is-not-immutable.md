---
title: "07 · `const` does not mean immutable"
sidebar_label: "07 · const is not immutable"
sidebar_position: 7
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 on **Node 24.19.0**. Script: `sandbox/js-p1/ex5-references.mjs`.

**`const` protects the binding, not the value.** It says "this name will never
point at something else". It says nothing at all about whether the thing it
points at can change.

## Measured

```
const protects the binding, not the value:
  mutated through const   { qty: 99 }
  reassign throws         TypeError: Assignment to constant variable.
  freeze: top level throws TypeError
  freeze is SHALLOW       {"qty":1,"nested":{"qty":99}}
```

```js
const cart = { qty: 1 };
cart.qty = 99;        // fine — mutating the object
cart = {};            // TypeError: Assignment to constant variable.
```

The binding is frozen. The object is not.

## Why this is the right design

`const` is about **reasoning locally**. When you see `const cart` you know that
every mention of `cart` in this scope refers to the same object — no reassignment
is hiding somewhere below. That is a genuinely useful guarantee, and it is
cheap.

Value immutability is a different, more expensive property, and JavaScript makes
you ask for it separately.

## `const`, `let`, `var`

| | Scope | Reassign | Redeclare | Hoisting |
|---|---|---|---|---|
| `const` | block | ❌ | ❌ | TDZ |
| `let` | block | ✅ | ❌ | TDZ |
| `var` | **function** | ✅ | ✅ | initialised `undefined` |

**Default to `const`.** Use `let` when the binding genuinely changes — a loop
counter, an accumulator, a value assigned in a branch. Never use `var` in new
code; it is function-scoped and initialises to `undefined`, so mistakes are
silent rather than loud
([Phase 0 · 02](../phase-0-how-javascript-runs/parse-compile-execute)).

One place `const` is impossible:

```js
for (let i = 0; i < 3; i++) { }        // i is reassigned each iteration
for (const item of items) { }          // const is correct — a NEW binding per iteration
```

`for…of` and `for…in` create a fresh binding each pass, so `const` works and is
the better choice.

## Actually making a value immutable

```js
const config = Object.freeze({ currency: 'INR', nested: { taxPct: 18 } });
config.currency = 'USD';        // TypeError in strict mode (silently ignored in sloppy)
config.nested.taxPct = 0;       // WORKS — freeze is shallow
```

```
  freeze is SHALLOW       {"qty":1,"nested":{"qty":99}}
```

`Object.freeze` prevents adding, removing and changing **own** properties, one
level deep. Nested objects are untouched.

Note the strict-mode interaction: writing to a frozen property **throws** in a
module or class body, and is **silently ignored** in sloppy mode. Another reason
everything should be a module
([Phase 0 · 04](../phase-0-how-javascript-runs/strict-mode)).

### Deep freeze

```js
function deepFreeze(obj) {
  for (const value of Object.values(obj)) {
    if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
      deepFreeze(value);
    }
  }
  return Object.freeze(obj);
}
```

The `isFrozen` check is not an optimisation — without it, an object containing a
cycle recurses until the stack overflows.

### The three levels

| | Add properties | Remove | Change existing |
|---|---|---|---|
| `Object.preventExtensions` | ❌ | ✅ | ✅ |
| `Object.seal` | ❌ | ❌ | ✅ |
| `Object.freeze` | ❌ | ❌ | ❌ |

`Object.isFrozen`, `isSealed` and `isExtensible` report the state.

## When to freeze, and when not to

**Freeze:** module-level configuration, lookup tables, enum-like constant
objects. Things that are wrong to modify and cheap to protect.

```js
export const ORDER_STATUS = Object.freeze({
  PENDING: 'pending', PAID: 'paid', SHIPPED: 'shipped',
});
```

**Do not freeze** application state or anything on a hot path. Freezing adds a
check to every write and can push an object out of V8's fast paths. Convention
plus code review — or TypeScript's `readonly`, which costs nothing at runtime —
is usually the better trade.

Note that `readonly` and `as const` in TypeScript are **compile-time only**.
They stop *your* code from mutating and do nothing to data arriving from an API.

## Gotchas

**Symptom:** an object declared `const` changed anyway.
**Cause:** `const` freezes the binding, not the value.
**Fix:** `Object.freeze` if it genuinely must not change — and remember it is
shallow.

**Symptom:** `Object.freeze` did not prevent a nested change.
**Cause:** it is one level deep.
**Fix:** `deepFreeze`, with an `isFrozen` guard for cycles.

**Symptom:** a write to a frozen object failed silently.
**Cause:** sloppy mode ignores it instead of throwing.
**Fix:** use ES modules, which are always strict.

**Symptom:** `TypeError: Assignment to constant variable` inside a loop.
**Cause:** `for (const i = 0; i < n; i++)` — the counter is reassigned.
**Fix:** `let` for a counter; `const` is correct for `for…of`.

**Symptom:** `deepFreeze` overflowed the stack.
**Cause:** a circular reference.
**Fix:** skip already-frozen objects, which breaks the cycle.

## Interview questions

**★ Does `const` make a value immutable?**
No. It makes the *binding* immutable — the name can never be reassigned. The
object it points at is fully mutable: `const cart = {}; cart.qty = 1` is legal,
while `cart = {}` throws `TypeError: Assignment to constant variable`.

**★ How do you actually make an object immutable?**
`Object.freeze`, which blocks adding, removing and changing own properties — but
only one level deep. Measured: after freezing `{qty, nested}`, the top-level
write threw while `nested.qty` changed freely. For full immutability, recurse
with an `isFrozen` guard to survive cycles.

**When would you use `let` instead of `const`?**
When the binding genuinely changes: a loop counter, an accumulator, a value
assigned in one branch. Default to `const` — it tells the reader the name refers
to the same value throughout the scope.

**Is `Object.freeze` worth using on application state?**
Usually not. It adds a check to every write and can cost performance on hot
paths. Freeze constants and configuration. For state, rely on convention,
review, or TypeScript's `readonly` — which is compile-time only and therefore
free at runtime, but also does nothing to data arriving from an API.

---

← [06 · Numbers are doubles](./06-numbers-are-doubles.md) · [Phase index](./) · Next: [08 · Type coercion](./08-type-coercion.md) →
