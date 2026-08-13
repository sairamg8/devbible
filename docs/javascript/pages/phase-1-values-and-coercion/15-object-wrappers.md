---
title: "15 · Object wrappers and autoboxing"
sidebar_label: "15 · Object wrappers"
sidebar_position: 15
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08 on **Node 24.19.0**. Script: `sandbox/js-p1/ex8-null-nan-equality.mjs`.

**Primitives have no properties, yet `'abc'.toUpperCase()` works.** The mechanism
is *autoboxing*, and understanding it explains why `new String('abc')` is never
the right thing to write.

## Measured

```
  typeof              : string / object
  prim == wrapped     : true | === : false
  Boolean(new Boolean(false)) : true <- object, always truthy
```

## Autoboxing

```js
'abc'.toUpperCase();
```

`'abc'` is a primitive with no methods. When you access a property on it, the
engine temporarily wraps it in a `String` object, reads the method from
`String.prototype`, calls it, and discards the wrapper.

The wrapper is invisible and short-lived — which is why assigning to it does
nothing:

```js
const s = 'abc';
s.custom = 1;      // silently discarded in sloppy mode; TypeError in strict
s.custom;          // undefined — a NEW wrapper each access, and it has no such property
```

Each property access creates a *fresh* wrapper. There is nowhere for the
assignment to persist.

The same applies to `number`, `boolean`, `symbol` and `bigint`. `null` and
`undefined` have no wrapper at all, which is exactly why
`null.toString()` throws.

## Why `new String()` is wrong

```
  typeof              : string / object
  prim == wrapped     : true | === : false
```

```js
const prim = 'abc';
const wrapped = new String('abc');

typeof prim;        // 'string'
typeof wrapped;     // 'object'
prim == wrapped;    // true  — == unwraps via ToPrimitive
prim === wrapped;   // false — different types
```

Every type check in your code and in every library you use will treat them
differently. And the truthiness case is worse:

```
  Boolean(new Boolean(false)) : true
```

```js
if (new Boolean(false)) {
  // this runs
}
```

An object is always truthy ([page 04](./04-truthiness.md)), including one that
wraps `false`. This is the single most cited reason never to use the wrapper
constructors.

**Never call `new String`, `new Number` or `new Boolean`.** There is no use case.

## Calling them *without* `new` is different, and useful

```js
String(123);        // '123'   — conversion function
Number('42');       // 42
Boolean(0);         // false
```

Without `new`, these are plain conversion functions returning **primitives** —
the ones page 09 recommends. The constructor form is the problem, not the name.

`String(x)` is also the only stringification that is safe for every input,
including `null`, `undefined` and symbols ([page 12](./12-symbol.md)).

## Where the methods actually live

```js
'abc'.toUpperCase === String.prototype.toUpperCase;   // true
(5).toFixed        === Number.prototype.toFixed;      // true
```

Autoboxing is just the lookup path to `String.prototype`. That is also why
extending a built-in prototype *appears* to work:

```js
String.prototype.shout = function () { return this.toUpperCase() + '!'; };
'sale'.shout();   // 'SALE!'
```

**Do not do this.** It affects every string in the process, including inside
libraries; two libraries adding the same method silently conflict; and a future
ECMAScript version adding a real method with that name will break your version or
be broken by it. This is not hypothetical — `Array.prototype.flatten` was renamed
to `flat` because a widely-used library had already taken the name.

Write a plain function, or a ponyfill
([Phase 0 · 09](../phase-0-how-javascript-runs/transpilation-polyfills)).

One note on `this` inside such a method: in a **strict** context `this` is the
primitive; in sloppy mode it is autoboxed to a wrapper object. Another reason
everything should be a module.

## The number-literal parse trap

```js
5.toFixed(2);       // SyntaxError
(5).toFixed(2);     // '5.00'
5..toFixed(2);      // '5.00'  — the first dot is the decimal point
5 .toFixed(2);      // '5.00'
```

The parser reads `5.` as the start of a decimal number, so the method dot has
nowhere to attach. Parenthesise. This never comes up with a variable — only with
a literal.

## Gotchas

**Symptom:** a property assigned to a string vanished.
**Cause:** the assignment went to a temporary wrapper that was immediately
discarded.
**Fix:** use an object or a `Map` if you need to attach data.

**Symptom:** `if (new Boolean(false))` runs the block.
**Cause:** objects are always truthy.
**Fix:** never use `new Boolean`. Use `Boolean(x)` or `!!x`.

**Symptom:** `typeof value === 'string'` fails for something that is clearly a
string.
**Cause:** it is a `String` object, not a primitive.
**Fix:** stop creating wrappers; if the value comes from elsewhere, `String(value)`
or `value.valueOf()` unwraps it.

**Symptom:** `5.toFixed(2)` is a `SyntaxError`.
**Cause:** the parser reads `5.` as a decimal literal.
**Fix:** `(5).toFixed(2)`.

**Symptom:** a library broke after you added a method to a built-in prototype.
**Cause:** prototype extension is global and collides.
**Fix:** a standalone function.

**Symptom:** `null.toString()` throws.
**Cause:** `null` and `undefined` have no wrapper object.
**Fix:** `String(value)`.

## Interview questions

**★ How can `'abc'.toUpperCase()` work if strings are primitives?**
Autoboxing. On property access the engine temporarily wraps the primitive in a
`String` object, resolves the method on `String.prototype`, calls it, and
discards the wrapper. Each access creates a fresh wrapper, which is why assigning
a property to a string does not persist.

**★ Why should you never use `new String()` or `new Boolean()`?**
They produce **objects**, not primitives, so `typeof` reports `'object'` and
every type check behaves differently — measured, `'abc' == new String('abc')` is
`true` but `===` is `false`. Worse, objects are always truthy, so
`Boolean(new Boolean(false))` is `true` and `if (new Boolean(false))` runs. There
is no situation where the wrapper constructor is the right choice.

**What is the difference between `String(x)` and `new String(x)`?**
Called as a function, `String(x)` converts and returns a **primitive** string —
this is the correct conversion form, and it safely handles `null`, `undefined`
and symbols. With `new`, it constructs a wrapper object.

**Why is extending a built-in prototype discouraged?**
It is global: every value of that type in the process is affected, including
inside libraries. Two libraries adding the same method conflict silently, and a
future standard method with the same name collides — which really happened,
forcing `Array.prototype.flatten` to be renamed `flat`.

**Why does `5.toFixed(2)` throw a `SyntaxError`?**
The parser reads `5.` as the beginning of a decimal literal, so the method
access has nothing to attach to. `(5).toFixed(2)` or `5..toFixed(2)` work.

---

← [14 · Value equality](./14-value-equality.md) · [Phase index](./) · Next: [16 · `Object.is`, `-0` and `Infinity`](./16-object-is-and-zero.md) →
