---
title: "16 · new, Object.create and instanceof by hand"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08-15 against MDN — [`new`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/new), [`new.target`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/new.target), [`Object.create()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/create), [`Reflect.construct()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Reflect/construct), [`instanceof`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/instanceof), [`Function.prototype[Symbol.hasInstance]()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Function/Symbol.hasInstance), [`Array.isArray()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/isArray). Documentation-validated; **nothing was run**.

**Three operators, one idea.** `new` builds an object and links it, `Object.create` does the
linking without the building, and `instanceof` reads the link back. Writing all three is the
clearest proof that prototypes are a mechanism to you rather than a diagram.

```js
const instance = Object.create(Ctor.prototype);        // new, steps 1–2
const result = Reflect.apply(Ctor, instance, args);    // step 3
return Object(result) === result ? result : instance;  // step 4
```

## Chunks

| # | Chunk | Covers |
|---|---|---|
| 1 | **[`new` and `Object.create`](./01-new-and-object-create.md)** | MDN's four numbered steps, implemented; why `Object(x) === x` is the right non-primitive test and `typeof === "object"` is wrong twice; the silent fallback when `Ctor.prototype` is not an object; 🔴 the three things a hand-written `new` **cannot** do — construct a class, set `new.target`, or detect a non-constructible function — and `Reflect.construct` as the real primitive; the `Object.create` shim and the null prototype it **cannot** produce; descriptors as the second argument, and defaults that are all `false` |
| 2 | **[`instanceof`](./02-instanceof.md)** | The prototype walk, implemented; 🔴 why that walk **is** `Function.prototype[Symbol.hasInstance]` rather than a fallback; the three checks before the walk (throwing RHS, primitive LHS, non-object `prototype`); bound functions; customising with `Symbol.hasInstance` and the readability it costs; and the boundaries where `instanceof` simply stops working — realms, duplicate package copies, transpiled built-in subclasses — with what to use instead |

## Four facts worth carrying out of this topic

- **`new` returns the constructor's result only if it is non-primitive** — objects, arrays *and*
  functions.
- **`Object.create` is steps 1 and 2 of `new`**; the constructor call is steps 3 and 4. That is the
  whole relationship.
- **The ES5 `Object.create` shim cannot make `Object.create(null)`**, because `new` falls back to
  `Object.prototype` when the prototype is not an object.
- **`instanceof` compares identity with one specific `prototype` object**, so a second realm or a
  second installed copy of a package makes it `false` for a value that is obviously "one of those".

## Phase gate

You are done with this topic when you can write all three from an empty file, say what your `new`
cannot do and why `Reflect.construct` exists, and name two situations where `instanceof` gives the
wrong answer along with the check you would use instead.

## Where this connects

- [Phase 4 · Objects, prototypes and classes](../../phase-4-objects-and-classes/README.md) — the model these three operators expose
- [02 · `call`, `apply` and `bind`](../02-call-apply-bind/README.md) — `apply` is step 3, and bound functions are a documented `instanceof` special case
- [12 · Deep equality](../12-deep-equality/README.md) — the other place prototype identity and cross-realm values decide the answer
- [06 · Deep clone](../06-deep-clone/README.md) — where preserving a prototype is the hard part

---

Start → [`new` and `Object.create`](./01-new-and-object-create.md)
