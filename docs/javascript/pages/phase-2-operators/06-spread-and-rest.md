---
title: "06 · Spread and rest"
sidebar_label: "06 · Spread and rest"
sidebar_position: 6
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 on **Node 24.19.0**. Script: `sandbox/js-p2/ex4-spread-bitwise.mjs`.

**Same three dots, two opposite operations.** Spread *expands* a value into
individual elements; rest *collects* individual elements into one. Which you get
depends entirely on position: rest on the left of an `=` or in a parameter list,
spread everywhere else.

## Measured

```
--- spread copies are shallow ---
  orig.nested.b after copy mutation = 99
  object spread order matters: {"a":1,"b":3} vs {"b":2,"a":1}
  array spread of string: [ 'h', 'i' ]
  spread non-iterable {}: TypeError: {} is not iterable
  object spread of array: {"0":"x","1":"y"}

--- rest ---
  (first,...rest) length property = 1 <- rest not counted
  object rest: 1 {"b":2,"c":3}
```

## Two different mechanisms with the same syntax

| | Uses | Works on |
|---|---|---|
| **Array spread** `[...x]` | the **iteration protocol** (`Symbol.iterator`) | arrays, strings, `Map`, `Set`, generators, `NodeList` |
| **Object spread** `{...x}` | **own enumerable properties** | any object — including non-iterables |

They are genuinely different operations, which is why:

```
  spread non-iterable {}: TypeError: {} is not iterable
  object spread of array: {"0":"x","1":"y"}
```

`[...{}]` **throws** — a plain object has no iterator. But `{...['x','y']}` works
and produces `{"0":"x","1":"y"}`, because an array's own enumerable properties are
its indices.

## Spread copies are shallow

```
  orig.nested.b after copy mutation = 99
```

`{...orig}` creates a new outer object whose nested values are the **same
references**. Mutating `copy.nested.b` changed `orig.nested.b`. This is the
single most important thing on the page and it is covered in full in
[Phase 1 · 02](../phase-1-values-and-coercion/02-references-vs-values.md).

For immutable updates, spread each level you actually change:

```js
const updated = {
  ...cart,
  items: cart.items.map(i =>
    i.sku === sku ? { ...i, qty: i.qty + 1 } : i        // new object only for the changed line
  ),
};
```

Untouched lines keep their original references — structural sharing, which is
what keeps immutable updates cheap.

## Object spread order decides the winner

```
  object spread order matters: {"a":1,"b":3} vs {"b":2,"a":1}
```

```js
{ ...defaults, ...overrides }   // overrides win — the usual intent
{ ...overrides, ...defaults }   // defaults win — usually a bug
```

Later keys overwrite earlier ones. The idiom for options merging is
**defaults first**:

```js
function createClient(options = {}) {
  const config = { timeoutMs: 5000, retries: 3, ...options };
}
```

One trap: a key present with value `undefined` **does** overwrite. Spread copies
the key, it does not skip it:

```js
{ timeoutMs: 5000, ...{ timeoutMs: undefined } }   // { timeoutMs: undefined }
```

So an options object built with explicit `undefined`s wipes your defaults. Filter
them out, or use `??=` per key ([page 02](./02-assignment.md)).

## Rest collects

```
  (first,...rest) length property = 1 <- rest not counted
  object rest: 1 {"b":2,"c":3}
```

```js
function log(level, ...messages) { }        // messages is a real Array
const [first, ...others] = items;
const { id, ...fields } = product;          // object rest — omit a key
```

Three rules:

1. **Rest must be last.** `(...rest, last)` is a `SyntaxError`.
2. **Rest is not counted in `fn.length`** — measured, `((a, ...r) => 0).length`
   is `1`. Libraries that inspect arity (test runners deciding whether a callback
   takes `done`, for instance) see only the fixed parameters.
3. **Object rest gives you "everything except"** — the cleanest way to strip a
   field:

```js
const { password, ...safeUser } = user;     // send safeUser to the client
```

That one line is worth the whole feature.

## Spread beats `apply`

```js
Math.max(...prices);                 // modern
Math.max.apply(null, prices);        // legacy
```

But note the limit: spreading a very large array into a call passes every element
as an argument, and engines cap argument counts — roughly 100k+ elements will
throw `RangeError: Maximum call stack size exceeded`. For large arrays, use
`reduce` instead of `Math.max(...arr)`.

Also remember `Math.max()` with no arguments is `-Infinity`
([Phase 1 · 16](../phase-1-values-and-coercion/16-object-is-and-zero.md)), so
`Math.max(...[])` returns `-Infinity` rather than throwing.

## Strings and iterables

```
  array spread of string: [ 'h', 'i' ]
```

Spreading a string splits it by **code point**, not code unit — which is why
`[...'🛒']` has length 1 while `'🛒'.length` is 2
([Phase 1 · 10](../phase-1-values-and-coercion/10-strings-are-utf16.md)). Spread
is the safer way to split a string into characters.

## Gotchas

**Symptom:** you spread an object to copy it and a nested mutation leaked.
**Cause:** spread is one level deep — measured.
**Fix:** spread each nested level you change, or `structuredClone` for a true
copy.

**Symptom:** defaults were overwritten by `undefined`.
**Cause:** spread copies a key even when its value is `undefined`.
**Fix:** strip undefined keys, or apply defaults with `??=`.

**Symptom:** `TypeError: {} is not iterable`.
**Cause:** array spread needs an iterable; plain objects are not.
**Fix:** `Object.entries(obj)` or object spread `{...obj}`.

**Symptom:** merged options came out with the wrong precedence.
**Cause:** spread order — later wins.
**Fix:** `{ ...defaults, ...overrides }`.

**Symptom:** `SyntaxError` on a rest parameter.
**Cause:** rest is not the last parameter.
**Fix:** move it last; only one rest is allowed.

**Symptom:** a library mis-detected your callback's arity.
**Cause:** `fn.length` excludes rest parameters and parameters with defaults.
**Fix:** declare fixed parameters explicitly when arity is inspected.

**Symptom:** `Math.max(...hugeArray)` threw a `RangeError`.
**Cause:** every element becomes a separate argument and engines cap that.
**Fix:** `hugeArray.reduce((m, n) => n > m ? n : m, -Infinity)`.

## Interview questions

**★ What is the difference between spread and rest?**
Position. Rest **collects** — in a parameter list or on the left of a
destructuring assignment. Spread **expands** — everywhere else. Same `...`
syntax, opposite direction.

**★ Is spread a deep copy?**
No — one level. Measured: after `{...orig}`, mutating `copy.nested.b` changed
`orig.nested.b`, because the nested object is the same reference. Use
`structuredClone` for a genuine deep copy, or spread each level you change.

**★ Why does `[...{}]` throw while `{...[]}` works?**
They are different mechanisms. Array spread uses the iteration protocol and a
plain object has no `Symbol.iterator`. Object spread copies own enumerable
properties, and an array has those — measured, `{...['x','y']}` gives
`{"0":"x","1":"y"}`.

**How do you remove a property from an object without mutating it?**
Object rest: `const { password, ...rest } = user`. `rest` is a new object with
everything except that key.

**What does `fn.length` report for `(a, ...rest) => {}`?**
`1` — measured. Rest parameters and parameters with defaults are excluded from
the arity count, which matters for libraries that inspect it.

---

← [05 · Loops](./05-loops.md) · [Phase index](./) · Next: [07 · Comparison](./07-comparison.md) →
