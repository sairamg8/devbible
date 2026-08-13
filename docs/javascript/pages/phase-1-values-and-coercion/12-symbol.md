---
title: "12 · `Symbol`"
sidebar_label: "12 · Symbol"
sidebar_position: 12
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 on **Node 24.19.0**. Script: `sandbox/js-p1/ex7-strings-symbols-bigint.mjs`.

**A symbol is a guaranteed-unique value, used as a property key that can never
collide.** You will create your own rarely. You will meet the built-in ones —
`Symbol.iterator` above all — constantly.

## Measured

```
Symbol("id") === Symbol("id") : false
Object.keys hides symbols     : [ 'visible' ]
JSON.stringify drops symbols  : {"visible":"b"}
getOwnPropertySymbols finds it: 1
Symbol.for is global registry : true
implicit string coercion throws: TypeError: Cannot convert a Symbol value to a string
String(sym) works             : Symbol(id)
```

## Every symbol is unique

```js
Symbol('id') === Symbol('id');   // false
```

The string argument is a **description** — a debugging label, nothing more. Two
symbols with the same description are different values. There is no way to
recreate a symbol you have lost the reference to, which is exactly the point.

`Symbol()` is not a constructor: `new Symbol()` throws.

## Symbols as non-colliding keys

```js
const CACHE = Symbol('cache');

function decorate(product) {
  product[CACHE] = computeExpensiveThing(product);
  return product;
}
```

If you attach metadata to an object you do not own — a third-party object, or a
value passed through your library — a string key like `_cache` can collide with
someone else's `_cache`. A symbol cannot. Only code holding that exact symbol can
reach the property.

They are hidden from ordinary enumeration:

```
Object.keys hides symbols     : [ 'visible' ]
JSON.stringify drops symbols  : {"visible":"b"}
getOwnPropertySymbols finds it: 1
```

| Sees symbol keys? | |
|---|---|
| `Object.keys`, `Object.values`, `Object.entries` | ❌ |
| `for…in` | ❌ |
| `JSON.stringify` | ❌ |
| spread `{...obj}` and `Object.assign` | **✅ copied** |
| `Object.getOwnPropertySymbols` | ✅ |
| `Reflect.ownKeys` | ✅ |

The spread row is the one that catches people: symbol keys **are** copied by
spread and `Object.assign`, even though nothing else enumerates them.

> **This is not privacy.** `getOwnPropertySymbols` exposes everything. For real
> privacy use `#private` class fields or a closure. Symbols prevent *accidental*
> collision, not deliberate access.

## `Symbol.for` — the global registry

```
Symbol.for is global registry : true
```

```js
Symbol('app') === Symbol('app');         // false — always distinct
Symbol.for('app') === Symbol.for('app'); // true  — one shared registry
Symbol.keyFor(Symbol.for('app'));        // 'app'
```

`Symbol.for` looks the key up in a process-wide registry and creates it only if
absent, so two independent modules — even two copies of the same library — get
the same symbol. Use it when a symbol must be shared across code that cannot pass
references. Use plain `Symbol()` otherwise, because a registry entry is
effectively global state.

## Well-known symbols — where you actually meet them

These let your objects participate in language protocols.

| Symbol | Controls |
|---|---|
| **`Symbol.iterator`** | `for…of`, spread, destructuring |
| `Symbol.asyncIterator` | `for await…of` |
| `Symbol.toPrimitive` | `+`, template literals, comparisons ([page 08](./08-type-coercion.md)) |
| `Symbol.toStringTag` | `Object.prototype.toString.call(x)` |
| `Symbol.hasInstance` | `instanceof` |

```js
class Cart {
  #lines = [];
  add(line) { this.#lines.push(line); return this; }

  [Symbol.iterator]() { return this.#lines.values(); }        // for…of, spread
  get [Symbol.toStringTag]() { return 'Cart'; }               // [object Cart]
  [Symbol.toPrimitive](hint) {
    const total = this.#lines.reduce((s, l) => s + l.qty * l.priceMinor, 0);
    return hint === 'string' ? `Cart(${this.#lines.length} lines)` : total;
  }
}

const cart = new Cart().add({ qty: 2, priceMinor: 49900 });
[...cart];                    // the lines — because of Symbol.iterator
`${cart}`;                    // 'Cart(1 lines)'
cart * 1;                     // 99800
Object.prototype.toString.call(cart);   // '[object Cart]'
```

Implementing `Symbol.iterator` is the common one, and it is what Phase 6 builds
on.

## Symbols never coerce to string implicitly

```
implicit string coercion throws: TypeError: Cannot convert a Symbol value to a string
String(sym) works             : Symbol(id)
```

```js
const id = Symbol('id');
'' + id;          // TypeError
`${id}`;          // TypeError
String(id);       // 'Symbol(id)'  ✅
id.toString();    // 'Symbol(id)'  ✅
id.description;   // 'id'          ✅
```

This is deliberate: silently stringifying a unique value would produce a
non-unique string and defeat the purpose. It is also a real trap in logging —
interpolating a symbol into a template literal throws where you least expect it.
Use `String(x)` in any generic logging helper.

## Gotchas

**Symptom:** `TypeError: Cannot convert a Symbol value to a string` from a log
line.
**Cause:** a symbol reached a template literal or `'' + x`.
**Fix:** `String(value)` — it handles symbols, `null` and `undefined`.

**Symptom:** symbol-keyed data vanished after `JSON.stringify` and a round trip.
**Cause:** `JSON.stringify` ignores symbol keys entirely.
**Fix:** do not put data you need to serialise behind a symbol key.

**Symptom:** two modules created symbols that should have matched and did not.
**Cause:** each called `Symbol('name')`, which is always unique.
**Fix:** `Symbol.for('name')` for a shared registry entry.

**Symptom:** a symbol-keyed property leaked into a copied object.
**Cause:** spread and `Object.assign` **do** copy symbol keys, unlike every other
enumeration.
**Fix:** copy explicitly if you need to exclude it.

**Symptom:** `new Symbol()` throws.
**Cause:** `Symbol` is not a constructor.
**Fix:** call it as a function.

**Symptom:** `for…of` on your class throws "is not iterable".
**Cause:** no `Symbol.iterator`.
**Fix:** implement it — returning `array.values()` is usually enough.

## Interview questions

**★ What is a `Symbol` and what is it for?**
A unique primitive, used as a property key that cannot collide. Two symbols with
the same description are different values — measured, `Symbol('id') ===
Symbol('id')` is `false`. The main uses are attaching metadata to objects you do
not own, and implementing language protocols through well-known symbols.

**★ Are symbol properties private?**
No. They are hidden from `Object.keys`, `for…in` and `JSON.stringify`, but
`Object.getOwnPropertySymbols` and `Reflect.ownKeys` expose them, and spread
copies them. They prevent accidental collision, not deliberate access — use
`#private` fields for real privacy.

**★ What is the difference between `Symbol('x')` and `Symbol.for('x')`?**
`Symbol('x')` creates a new unique symbol every call. `Symbol.for('x')` looks up
a process-wide registry and returns the same symbol for the same key, so
independent modules can share one — measured, `Symbol.for('app') ===
Symbol.for('app')` is `true`.

**Why does `` `${symbol}` `` throw?**
Implicit string conversion of a symbol is deliberately forbidden — silently
turning a guaranteed-unique value into a non-unique string would defeat its
purpose. `String(sym)` and `sym.toString()` work explicitly.

**Name a well-known symbol you have used.**
`Symbol.iterator` — implementing it makes an object work with `for…of`, spread
and array destructuring. Others worth knowing are `Symbol.asyncIterator`,
`Symbol.toPrimitive` for coercion, and `Symbol.toStringTag`.

---

← [11 · NaN](./11-nan.md) · [Phase index](./) · Next: [13 · `BigInt`](./13-bigint.md) →
