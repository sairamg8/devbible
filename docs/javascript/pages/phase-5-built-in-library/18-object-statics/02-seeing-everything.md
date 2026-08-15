---
title: "2 · Seeing everything"
sidebar_label: "2 · Seeing everything"
sidebar_position: 2
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-15 against MDN — [`Object.getOwnPropertyNames()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/getOwnPropertyNames), [`Object.getOwnPropertySymbols()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/getOwnPropertySymbols), [`Reflect.ownKeys()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Reflect/ownKeys), [`Symbol`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Symbol), [`Symbol.iterator`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Symbol/iterator), [Public class fields](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Classes/Public_class_fields), [`Error`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Error), [`Array.prototype.length`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/length), [`JSON.stringify()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/JSON/stringify). Documentation-validated; **no timings**.

`Object.keys` shows you the properties someone meant you to iterate. **These three show
you the properties that are actually there.**

```js
Object.getOwnPropertyNames(o);    // own string keys — enumerable AND non-enumerable
Object.getOwnPropertySymbols(o);  // own symbol keys
Reflect.ownKeys(o);               // both, in spec order
```

**One axis separates them from `Object.keys`, and it is enumerability.** All three are
still own-only — none of them walks the prototype chain, so to see inherited machinery
you ask about the prototype object itself.

## What they reveal that `keys` hides

### An array has a `length`

```js
Object.keys([10, 20]);                  // ["0", "1"]
Object.getOwnPropertyNames([10, 20]);   // ["0", "1", "length"]
```

`length` is a real own property of every array — writable, but **non-enumerable**, which
is the only reason `Object.keys`, spread, `for...in` and `JSON.stringify` all leave it
alone. Nothing special-cases arrays; the flag does all the work.

### Class methods are invisible by design

```js
class User {
  name = "ada";              // instance field — own, enumerable
  greet() { return "hi"; }   // prototype method — non-enumerable
}
const u = new User();

Object.keys(u);                                   // ["name"]
Object.getOwnPropertyNames(u);                    // ["name"] — greet is not own
Object.getOwnPropertyNames(User.prototype);       // ["constructor", "greet"]
Object.keys(User.prototype);                      // [] — all non-enumerable
```

🔴 **The spec defines class methods as non-enumerable**, and that single decision is why
`{...instance}` loses every method, why `JSON.stringify(instance)` produces only the
fields, and why `for...in` over an instance does not spew method names. Two of the four
axes in [chunk 1](./01-the-map-and-the-four-axes.md) are in play at once here: methods
are non-enumerable **and** not own.

### Built-ins are almost entirely non-enumerable

```js
Object.keys(Math);                  // []  — looks empty
Object.getOwnPropertyNames(Math);   // every constant and method on it
```

⚠️ **This is the trap behind "I logged the object and it was empty".** A built-in, a DOM
node or a host object can look bare through `Object.keys` and be full through
`getOwnPropertyNames`.

### The one that costs real debugging time — `Error`

```js
const err = new Error("database unreachable");

JSON.stringify(err);                  // 🔴 "{}"
Object.keys(err);                     // 🔴 []
Object.getOwnPropertyNames(err);      // ✅ includes "message" and "stack"
```

**An `Error`'s `message` is own but non-enumerable, and `name` lives on the prototype.**
So a log line that JSON-stringifies a caught error ships `{}` to your log aggregator and
throws away the only information you needed. The fix belongs at the logging boundary:

```js
const serialisable = (e) =>
  e instanceof Error
    ? { name: e.name, message: e.message, stack: e.stack, cause: e.cause }
    : e;

logger.error(JSON.stringify(serialisable(err)));   // ✅ actually says something
```

⚠️ **This bites hardest where you cannot see it** — inside a `catch` that logs to a
remote collector, in a worker that `postMessage`s an error back, in a test helper that
diffs objects. The value looks fine locally in a console, which renders errors specially,
and arrives empty everywhere else.

## Symbols, and the machinery they hold

```js
const cache = Symbol("cache");
const o = { visible: 1, [cache]: new Map() };

Object.keys(o);                     // ["visible"]
JSON.stringify(o);                  // '{"visible":1}'
Object.getOwnPropertySymbols(o);    // [Symbol(cache)]
```

**Symbol keys are how a library attaches state to your object without colliding with
your property names and without appearing in your loops or your JSON.** They are not
private — `getOwnPropertySymbols` finds them — but they are out of the way, which is the
actual goal.

The well-known symbols work the same way, which is how a class opts into language
protocols without adding visible properties:

```js
Object.getOwnPropertySymbols(Array.prototype);   // includes Symbol.iterator
```

⚠️ **Symbol keys survive copying but not serialising.** Spread and `Object.assign` carry
them across; `JSON.stringify` and `Object.entries` do not. A round trip through JSON
therefore silently drops exactly the properties `Object.keys` never showed you.

## `Reflect.ownKeys` and the order everything follows

```js
Reflect.ownKeys(o);   // every own key: strings first, then symbols
```

**The order is the spec's own-property order, and it is the same order `Object.keys`,
`JSON.stringify` and `for...in` all follow:**

1. **integer-like string keys**, ascending numerically — `"0"`, `"1"`, `"2"`, `"100"`
2. **all other string keys**, in insertion order
3. **symbol keys**, in insertion order

```js
Reflect.ownKeys({ b: 1, 2: 2, a: 3, 1: 4 });   // ["1", "2", "b", "a"]
```

⚠️ **Integer-like keys jump the queue** — the reason an object keyed by numeric ids
silently reorders itself and a `Map` does not
([10 · `Map` vs a plain object](../10-map-vs-object/README.md)).

`Reflect.ownKeys` is the reflection-namespace counterpart to the two `Object` getters,
and it is what a `Proxy`'s `ownKeys` trap intercepts
([Phase 4 · 19 · 01 · The traps and `Reflect`](../../phase-4-objects-and-classes/19-proxy-and-reflect/01-the-traps-and-reflect.md)).

## Asking about the chain

None of the three walks the prototype chain, so "what can I call on this?" is a
different question from "what is on this?" — and it is answered by walking deliberately:

```js
const chain = (o) => {
  const out = [];
  for (let p = o; p; p = Object.getPrototypeOf(p)) out.push(Object.getOwnPropertyNames(p));
  return out;
};
```

**A debugging tool, not a pattern.** Feature code that needs to know what is callable on
a value wants an interface or a type, not a walk of the prototype chain
([Phase 4 · 05 · The prototype chain](../../phase-4-objects-and-classes/05-the-prototype-chain/README.md)).

## Gotchas

**Symptom:** `JSON.stringify(err)` logged `{}`
**Cause:** `message` is own but non-enumerable, `name` is inherited, and `JSON.stringify`
takes own enumerable string keys only.
**Fix:** Serialise errors explicitly — `{ name, message, stack, cause }`.

**Symptom:** `Object.keys(someBuiltIn)` was empty but the object clearly has members
**Cause:** Built-in properties are non-enumerable.
**Fix:** `Object.getOwnPropertyNames`.

**Symptom:** `Object.keys(instance)` did not list the class's methods
**Cause:** They are on the prototype and non-enumerable — failing both tests at once.
**Fix:** `Object.getOwnPropertyNames(Object.getPrototypeOf(instance))`.

**Symptom:** `getOwnPropertyNames` did not show an inherited method
**Cause:** Every function here is own-only; none walks the chain.
**Fix:** Ask the prototype explicitly, in a loop if you need the whole chain.

**Symptom:** A property vanished after a JSON round trip but survived a spread
**Cause:** It is symbol-keyed. Copying takes symbols; serialising does not.
**Fix:** Use string keys for anything that must cross a serialisation boundary.

**Symptom:** Numeric-ish keys came back in the wrong order
**Cause:** Integer-like string keys sort ascending before every other key, in every
own-key listing.
**Fix:** A `Map`, which is strictly insertion-ordered.

## Interview questions

**★ How do you list every property an object actually has?**
`Reflect.ownKeys(o)` — own string keys and symbol keys, enumerable or not. The `Object`
pair is `getOwnPropertyNames` (strings) and `getOwnPropertySymbols` (symbols). All three
are own-only; for inherited members, ask the prototype object.

**★ Why does `JSON.stringify` on an `Error` give `{}`?**
`JSON.stringify` serialises own enumerable string-keyed properties. An `Error`'s
`message` and `stack` are own but non-enumerable, and `name` is on the prototype, so
nothing qualifies. `Object.getOwnPropertyNames(err)` shows them. Log errors by picking
the fields explicitly.

**★ Why does `Object.keys` not list a class's methods?**
They fail both tests: methods live on the prototype rather than the instance, and the
spec defines them as non-enumerable. That is also why spread loses them and why
`for...in` over an instance stays quiet.

**★ What is the own-key ordering rule?**
Integer-like string keys first in ascending numeric order, then the remaining string keys
in insertion order, then symbol keys in insertion order. Every own-key listing follows
it, which is why an object keyed by numeric ids appears to reorder itself and why a `Map`
is the answer when order matters.

**What are symbol keys actually for?**
Attaching data to an object without colliding with anyone's property names and without
appearing in loops, `Object.keys` or JSON. They are not privacy —
`getOwnPropertySymbols` finds them — they are non-interference.

**What is `Reflect.ownKeys` for, given the two `Object` functions exist?**
It is the single spec-level operation the other two are slices of, and it is the one a
`Proxy` trap corresponds to. In ordinary code it is the fastest way to answer "what is on
this object" in one call.

---

← [1 · The map, and the four axes](./01-the-map-and-the-four-axes.md) · [Topic index](./README.md) · Next: [3 · Descriptors, and faithful copies](./03-descriptors-and-faithful-copies.md) →
