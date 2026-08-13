---
title: "01 · Object literals"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-13 against MDN — [Object initializer](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Object_initializer), [Method definitions](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Functions/Method_definitions), [`Reflect.ownKeys`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Reflect/ownKeys), [`Object.getOwnPropertyNames`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/getOwnPropertyNames), [`Object.keys`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/keys). Documentation-validated.

**The most-typed construct in JavaScript, with three things in it that are not
what they look like.** Method shorthand is not a function-valued property.
`{ __proto__: x }` is not a property at all. And the key order you get back is not
the order you wrote.

Everything else about object literals is exactly as obvious as it seems — which is
why those three are worth a Master-tier topic.

## Chunks

| # | Chunk | Covers |
|---|---|---|
| 1 | **[Shorthand and computed keys](./01-shorthand-and-computed-keys.md)** | `{ a }`, computed key expressions and their evaluation order, symbol keys, and the `...(cond && { k })` conditional-key idiom |
| 2 | **[Methods, accessors and spread](./02-methods-accessors-and-spread.md)** | Why method shorthand is *not* `prop: function () {}`, getters and setters, what spread actually copies, `Object.assign` triggering setters, and silent duplicate keys |
| 3 | **[Keys and enumeration order](./03-keys-and-order.md)** | Keys are strings or symbols only, the three-tier order and what counts as an integer index, where the rule bites, and the enumeration-method comparison table |
| 4 | **[`__proto__` and null-prototype objects](./04-proto-and-null-prototype.md)** | The prototype setter and its three look-alike forms, JSON vs object literals, prototype pollution and three defences, and `Object.create(null)` |

## The three surprises, in one place

| It looks like | It actually is |
|---|---|
| `{ foo() {} }` ≡ `{ foo: function () {} }` | not constructable, and `super` works — two real semantic differences |
| `{ __proto__: x }` sets a property | sets the **prototype**; sets nothing at all if `x` is not an object or `null` |
| keys come back in insertion order | integer-like keys first, **ascending**; then strings by insertion; then symbols |

## Phase gate

You are done with this topic when you can say why `{ ...instance }` loses an
object's methods, predict the output of `Object.keys({ 1002: …, 17: … })`, and
explain the difference between `{ __proto__: p }`, `{ __proto__ }` and
`{ ["__proto__"]: p }`.

## Where this connects

- [03 · Existence checks and `delete`](../03-existence-checks-and-delete/README.md) — `Object.hasOwn`, and why a null-prototype object needs it
- [04 · Shallow vs deep copy](../README.md) — spread is shallow; this is where that gets paid for
- [05 · The prototype chain](../README.md) — what `__proto__` is actually pointing at
- [Phase 3 · 04 · Arrow functions and `this`](../../phase-3-functions/04-arrow-functions-and-this/README.md) — why an arrow is the wrong thing to put in an object literal

---

Start → [Shorthand and computed keys](./01-shorthand-and-computed-keys.md)
