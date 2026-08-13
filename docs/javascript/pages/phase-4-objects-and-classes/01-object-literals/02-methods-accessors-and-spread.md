---
title: "01.2 · Methods, accessors and spread"
sidebar_label: "02 · Methods, accessors and spread"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-13 against MDN — [Object initializer](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Object_initializer), [Method definitions](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Functions/Method_definitions), [`Object.assign`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/assign). Documentation-validated.

Three features that look like conveniences and are not. Method shorthand is **not**
the same as a function-valued property. Spread copies less than people think.
And duplicate keys are silently legal.

## Method shorthand is **not** `prop: function () {}`

```js
const o = {
  property(parameters) {},
  *generator() {},
  async asyncMethod() {},
};
```

This looks like pure sugar. It is not, and MDN says so directly: *"note that the
method syntax is not equivalent to a normal property with a function as its value —
there are semantic differences."*

**Difference 1 — methods cannot be constructors.** MDN: *"Methods cannot be
constructors! They will throw a `TypeError` if you try to instantiate them."*

```js
const obj = {
  method() {},
};
new obj.method(); // TypeError: obj.method is not a constructor
```

The function-expression form *can* be `new`-ed. Methods have no `prototype`
property to hang instances off — the same reason arrow functions cannot be
constructed, covered in
[Phase 3 · 04 · Arrow functions and `this`](../../phase-3-functions/04-arrow-functions-and-this/README.md).

**Difference 2 — only methods get `super`.** MDN: *"Only functions defined as
methods have access to the `super` keyword."*

```js
const obj = {
  __proto__: {
    prop: "foo",
  },
  notAMethod: function () {
    console.log(super.prop); // SyntaxError: 'super' keyword unexpected here
  },
};
```

Note that is a **`SyntaxError`** — a parse-time failure, so the whole file fails to
load rather than throwing on that line when called. The method form has a **home
object** (the literal it was defined in), and `super` resolves against that home
object's prototype. A plain function expression has no home object, so `super` is
not even grammatical there.

**What to do:** prefer method shorthand. It is shorter, it matches class syntax,
and the two capabilities it removes — being `new`-ed, and serving as a standalone
constructor — are things you essentially never want from a member of an object
literal. The long form is for the rare case where the property value genuinely is a
constructor function.

### Neither form gives you lexical `this`

Both a method and a function-valued property take `this` from the **call site**.
Writing an arrow in an object literal to "fix" `this` is the classic mistake:

```js
const counter = {
  count: 0,
  increment: () => {
    this.count++; // NOT the object — `this` came from the enclosing scope
  },
};
```

The arrow captured the surrounding scope's `this`, which at module top level is
`undefined`. This is the single most common object-literal bug, and it is covered
properly in [07 · `this` inside methods, and losing it](../README.md).

## Getters and setters

```js
const o = {
  get property() {
    return 1;
  },
  set property(value) {},
};
```

An accessor property looks like a data property from outside — `o.property` reads,
`o.property = x` writes — but each side runs a function. Two consequences:

- **A getter makes reading arbitrary work.** A property access that triggers a
  recomputation, a network call, or a `console.log` is legal and completely
  invisible at the call site. "Just add a getter" is a bigger decision than it
  looks: every reader of that property now pays whatever the getter costs, and
  debuggers evaluate it too, sometimes repeatedly.
- **Copying converts them to data properties.** Spread and `Object.assign` both
  *read* a source getter and store the resulting value, so the copy has a frozen
  snapshot where the original had live behaviour. A lazily-computed getter becomes
  eagerly computed, once. To preserve the accessor, copy descriptors with
  `Object.getOwnPropertyDescriptors` instead.

A setter with no getter makes the property write-only: assignment runs, reads give
`undefined`. That asymmetry is legal and almost always a mistake.

## Spread — own, enumerable, and shallow

MDN: *"It copies own enumerable properties from a provided object onto a new
object."*

```js
const obj1 = { foo: "bar", x: 42 };
const obj2 = { foo: "baz", y: 13 };

const clonedObj = { ...obj1 };
// { foo: "bar", x: 42 }

const mergedObj = { ...obj1, ...obj2 };
// { foo: "baz", x: 42, y: 13 }
```

Every word in "own enumerable" is load-bearing:

- **own** — inherited properties are not copied. Spreading a **class instance**
  gives you its fields and **none of its methods**, because methods live on the
  prototype. `{ ...someInstance }` produces a plain object that has lost all its
  behaviour, and every method call on it then throws
  `TypeError: x.foo is not a function`. This is the most common way people
  accidentally destroy an object they meant to copy.
- **enumerable** — non-enumerable properties are skipped entirely.
- and, unstated but critical, **shallow** — nested objects are shared by reference,
  not copied. MDN calls it *"shallow-cloning (excluding `prototype`)"*. That is
  topic 04's entire subject.

Later spreads win, which makes `{ ...defaults, ...overrides }` the standard
options-merging idiom. Note it is a **replace**, not a deep merge: if both objects
have a nested `options` object, the second wins whole and any keys that existed
only in the first are gone.

### Spread does not trigger setters; `Object.assign` does

MDN flags this as a **warning**: *"Note that `Object.assign()` triggers setters,
whereas the spread syntax doesn't!"*

- `{ ...source }` **defines** properties on a fresh object. No setter on the target
  can run, because the target is new and empty.
- `Object.assign(target, source)` **assigns** to the target. If `target` has a
  setter for that key, it runs — with its side effects, with the possibility that
  it stores something other than what you passed, and with the possibility that it
  throws.

So `Object.assign(existing, patch)` and `{ ...existing, ...patch }` are not
interchangeable. The first mutates and may run arbitrary code; the second builds a
new plain object. **Reach for spread by default** — the non-mutating one is almost
always what you meant, and it is the one with no hidden execution.

One more difference: `Object.assign` preserves the target's prototype, because it
writes into an object you supplied. Spread always produces a plain object with
`Object.prototype`.

## Duplicate keys — last wins, silently

```js
const a = { x: 1, x: 2 };
console.log(a); // {x: 2}
```

MDN: *"When using the same name for your properties, the second property will
overwrite the first."* And the part people get wrong: *"After ES2015, duplicate
property names are allowed everywhere, including strict mode."*

In ES5 strict mode this was a `SyntaxError`. That rule was **removed** when computed
keys arrived, because `{ [a]: 1, [b]: 2 }` cannot be checked for duplicates at parse
time anyway. So there is no runtime protection at all, and your linter is the only
thing that will catch `{ status: "active", …, status: "archived" }` in a long
literal. `no-dupe-keys` is on in every standard ESLint config for exactly this
reason.

The same silence applies to spread ordering: `{ ...a, x: 1, ...b }` lets `b.x`
overwrite the explicit `x: 1` you wrote, because `b` comes later. **A spread placed
after an explicit key is almost always a bug.**

MDN notes one exception to the permissiveness: *"private elements, which must be
unique in the class body."* Duplicate `#name` declarations are still an error.

## Gotchas

**Symptom:** `TypeError: obj.method is not a constructor`
**Cause:** Method shorthand definitions cannot be `new`-ed (MDN) — they have no
`prototype` property.
**Fix:** Use `method: function () {}` if you genuinely need a constructor, or a
`class`.

**Symptom:** `SyntaxError: 'super' keyword unexpected here`
**Cause:** `super` used inside a function-valued property rather than a method
shorthand. MDN: *"Only functions defined as methods have access to the `super`
keyword."*
**Fix:** Rewrite `notAMethod: function () {}` as `notAMethod() {}`. This is a parse
error, so nothing in the file runs.

**Symptom:** `this` is `undefined` inside a member of an object literal
**Cause:** The member is an arrow function, which takes `this` from the enclosing
scope, not the object.
**Fix:** Use method shorthand. Arrows belong in callbacks, not in object literals
that need `this`.

**Symptom:** Spreading a class instance loses all its methods
**Cause:** Spread copies **own** enumerable properties; methods live on the
prototype. MDN: *"shallow-cloning (excluding `prototype`)"*.
**Fix:** Do not spread instances. Use a `clone()` method, or `Object.create` with
the same prototype, or copy only the data you need.

**Symptom:** `Object.assign` into an existing object behaves strangely — values
change, or something throws
**Cause:** `Object.assign` triggers **setters** on the target; spread does not (MDN
warning).
**Fix:** Use `{ ...target, ...patch }` to build a new object, unless you
specifically want the setters to run.

**Symptom:** A lazy getter runs immediately, or its value goes stale after a copy
**Cause:** Spread and `Object.assign` read source getters and store the resulting
**value**, converting the accessor into a plain data property.
**Fix:** Copy descriptors with `Object.getOwnPropertyDescriptors` when the accessor
must stay live.

**Symptom:** A key in a long literal has the wrong value and nothing errors
**Cause:** A duplicate key later in the literal silently overwrote it — legal even
in strict mode since ES2015.
**Fix:** Enable ESLint's `no-dupe-keys`, and check for a `...spread` placed after
the explicit key.

## Interview questions

**★ Is `{ foo() {} }` the same as `{ foo: function () {} }`?**
No. MDN states the two are *"not equivalent"*. Method shorthand produces a function
that **cannot be used as a constructor** (`new` throws `TypeError`) and that **can
use `super`**, because it has a home object. The function-expression form is
constructable and makes `super` a `SyntaxError`.

**★ What does object spread actually copy?**
**Own**, **enumerable**, string- and symbol-keyed properties, **shallowly**, and
excluding the prototype. So inherited properties and non-enumerable properties are
skipped, and nested objects are shared by reference rather than copied.

**★ Difference between `{ ...a, ...b }` and `Object.assign(a, b)`?**
Three. `Object.assign` **mutates** `a` while spread builds a new object;
`Object.assign` **triggers setters** on the target while spread defines properties
directly (MDN flags this as a warning); and `Object.assign` keeps the target's
prototype while spread always yields a plain object.

**★ Are duplicate keys in an object literal an error?**
No — the last one silently wins. MDN: *"After ES2015, duplicate property names are
allowed everywhere, including strict mode."* The ES5 strict-mode `SyntaxError` was
removed because computed keys make duplicates undetectable at parse time. Only
private class elements must still be unique.

**Why does spreading a class instance not give you a working object?**
Methods live on the prototype and spread copies own properties only. You get the
fields as a plain object with `Object.prototype` behind it, and every method call
throws `TypeError: x.foo is not a function`.

**What happens to a getter when you spread the object it is on?**
It is *invoked once*, and the returned value is stored as a plain data property. The
copy has no accessor — so a lazy getter becomes eager, and a computed one becomes a
snapshot. Use `Object.getOwnPropertyDescriptors` to copy the accessor itself.

---

← [Shorthand and computed keys](./01-shorthand-and-computed-keys.md) · [Topic index](./README.md) · Next → [Keys and enumeration order](./03-keys-and-order.md)
