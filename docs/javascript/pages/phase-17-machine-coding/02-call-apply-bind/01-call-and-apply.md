---
title: "02.1 · call and apply"
sidebar_label: "01 · call and apply"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-14 against MDN — [`Function.prototype.call()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Function/call), [`Function.prototype.apply()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Function/apply), [`this`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/this), [`Symbol`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Symbol). Documentation-validated; **no timings**.

**Implementing `call` is a test of whether you understand method invocation**, because the trick is
to use it: `this` inside a function is decided by *how the function is called*, so making a function
a temporary property of an object and calling it there sets `this` to that object.

## `call`

```js
Function.prototype.myCall = function (thisArg, ...args) {
  if (typeof this !== "function") throw new TypeError("not callable");

  const target = thisArg == null ? globalThis : Object(thisArg);   // sloppy-mode coercion
  const key = Symbol("fn");                                        // 🔴 a Symbol, not a string

  Object.defineProperty(target, key, {                             // 🔴 non-enumerable
    value: this,
    configurable: true,
    enumerable: false,
    writable: true,
  });

  try {
    return target[key](...args);                                   // ← this is the whole trick
  } finally {
    delete target[key];                                            // 🔴 clean up even on throw
  }
};
```

**`target[key](...args)` is the mechanism.** Calling a function as a member of an object is what
binds `this` to that object — the same rule that makes `obj.method()` work and `const m =
obj.method; m()` not.

Four details, and each is a follow-up question:

- 🔴 **A `Symbol` key, not `"__fn__"`.** A string key can collide with a real property and would
  overwrite it. A fresh `Symbol` cannot collide with anything.
- 🔴 **`enumerable: false`** — a plain assignment would make the temporary property visible to
  `Object.keys` and `for…in` if anything observed the object mid-call.
- 🔴 **`delete` in a `finally`** — if the function throws, the property must still be removed. This
  is the detail most implementations miss.
- **`thisArg == null ? globalThis : Object(thisArg)`** reproduces the **sloppy-mode** coercion:
  `null`/`undefined` become the global object, and primitives are boxed. ⚠️ In **strict mode** —
  which every ES module is — `this` is used as-is, so a strict function receives exactly the
  primitive or `null` you passed. Saying which semantics you are implementing is the complete
  answer.

## `apply`

Identical except that arguments arrive as an array-like:

```js
Function.prototype.myApply = function (thisArg, argsArray) {
  const args = argsArray == null ? [] : Array.from(argsArray);     // 🔴 null/undefined → no args
  return this.myCall(thisArg, ...args);
};
```

⚠️ **`Array.from`, not spread** — `apply` accepts any **array-like**, not just iterables, and
`fn.apply(null, {length: 2, 0: 'a', 1: 'b'})` is legal. Spread would throw "is not iterable".

**`call` versus `apply` is only the argument form**, and the mnemonic is *`a`pply takes an
`a`rray*. Since ES2015, spread makes `apply` largely unnecessary — `fn(...args)` is the modern
form — with one lasting exception:

⚠️ **`Math.max.apply(null, hugeArray)` and `Math.max(...hugeArray)` both throw `RangeError` on a
large array**, because each element becomes an argument. `reduce` is the answer above roughly
100,000 elements.

## Where `this` actually comes from

The implementations above only make sense against the rule they exploit. In order of precedence:

| How a function is called | `this` |
|---|---|
| `new Fn()` | the newly created object |
| `fn.call(x)` / `fn.apply(x)` / bound function | `x` (or the bound value) |
| `obj.fn()` | `obj` |
| `fn()` | `undefined` in strict mode, `globalThis` in sloppy |
| arrow function | 🔴 **lexical — none of the above apply** |

🔴 **An arrow function has no own `this`**, so `call`, `apply` and `bind` cannot change it. Passing
a `thisArg` to an arrow callback does nothing — which is why the `thisArg` parameter of `map` is a
pre-arrow affordance.

**The lost-`this` bug this all exists for:**

```js
const counter = { n: 0, inc() { this.n++; } };
const f = counter.inc;
f();                          // ❌ TypeError in strict mode — `this` is undefined
counter.inc.call(counter);    // ✅
setTimeout(counter.inc.bind(counter), 0);   // ✅ the usual fix
```

**Extracting a method loses its receiver**, because `this` comes from the call site and not from
where the function was defined. That single sentence is what the whole topic is about.

## Borrowing methods

The historical use of `call`, and still occasionally the clearest:

```js
Array.prototype.slice.call(arguments);          // arguments → real array (pre-ES2015)
Array.prototype.forEach.call(nodeList, fn);     // NodeList without converting
Object.prototype.toString.call(value);          // "[object Date]" — the reliable type tag
Object.prototype.hasOwnProperty.call(obj, k);   // safe even if obj shadows hasOwnProperty
```

🔴 **The last two are still current practice, not history.**

- `Object.prototype.toString.call(x)` is the only reliable way to distinguish `Date`, `RegExp`,
  `Map` and plain objects — `typeof` says `"object"` for all of them.
- `Object.prototype.hasOwnProperty.call(obj, k)` protects against an object that defines its own
  `hasOwnProperty` — real for parsed JSON with user-controlled keys. **`Object.hasOwn(obj, k)` is
  the modern replacement** and should be preferred where available.

Modern equivalents have replaced the first two: `Array.from`, spread, and rest parameters.

## Gotchas

**Symptom:** A `myCall` implementation overwrites a real property
**Cause:** A fixed string key like `"__fn__"`.
**Fix:** A fresh `Symbol`.

**Symptom:** The temporary property survives after the call
**Cause:** The function threw and `delete` was skipped.
**Fix:** `delete` in a `finally`.

**Symptom:** The temporary property shows up in `Object.keys`
**Cause:** Plain assignment creates an enumerable property.
**Fix:** `Object.defineProperty` with `enumerable: false`.

**Symptom:** `myApply` throws "is not iterable"
**Cause:** Spread was used on an array-like that has no `Symbol.iterator`.
**Fix:** `Array.from`.

**Symptom:** `call(null)` behaves differently in two files
**Cause:** Strict versus sloppy mode — sloppy substitutes the global object, strict does not. ES
modules are always strict.
**Fix:** Know which you are implementing and say so.

**Symptom:** `thisArg` has no effect on an arrow function
**Cause:** Arrows have no own `this`.
**Fix:** A regular function.

**Symptom:** `TypeError: Cannot read properties of undefined` after extracting a method
**Cause:** `this` comes from the call site; extracting drops the receiver.
**Fix:** `bind`, or call it as a method.

**Symptom:** `Math.max.apply(null, arr)` throws `RangeError`
**Cause:** Every element becomes an argument.
**Fix:** `reduce` for large arrays.

## Interview questions

**★ Implement `Function.prototype.call`.**
Put the function on the target object under a **fresh `Symbol`** key, call it as a method so `this`
binds to the target, and remove it in a `finally`. Define it **non-enumerable**, and decide
deliberately whether to reproduce sloppy-mode coercion of `null`/primitives.

**★ Why a `Symbol` and why `finally`?**
A string key could collide with and clobber a real property; a fresh `Symbol` cannot. And if the
called function throws, the temporary property must still be removed — `finally` is the only place
that guarantees it.

**★ What is the difference between `call` and `apply`?**
Only the argument form — `apply` takes an array-like. Use `Array.from` rather than spread when
implementing it, because `apply` accepts array-likes that are not iterable.

**★ Where does `this` come from?**
The **call site**, not the definition: `new` binds the new object; `call`/`apply`/`bind` bind
explicitly; `obj.fn()` binds `obj`; a bare call gives `undefined` in strict mode. Arrow functions
are the exception — they have no own `this`, so none of these can set it.

**★ Why does extracting a method break it?**
Because `this` is decided at the call site. `const f = obj.method; f()` has no receiver, so `this`
is `undefined` in strict mode. `bind` exists for exactly this.

**★ Is `call` still used in modern code?**
Two places genuinely: `Object.prototype.toString.call(x)` as the reliable type tag, and
`Object.prototype.hasOwnProperty.call(obj, k)` for objects that may shadow it — though
`Object.hasOwn` now replaces that. The array-borrowing uses were replaced by `Array.from`, spread
and rest.

**What still breaks with `apply` on a large array?**
`RangeError: Maximum call stack size exceeded`, because each element becomes an argument. Spread
has the same limit; `reduce` does not.

---

[Topic index](./README.md) · Next → [02 · bind, including with `new`](./02-bind.md)
