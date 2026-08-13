---
title: "05.1 · The three methods"
sidebar_label: "01 · The three methods"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 on **Node 24.19.0** (V8 13.6). Scripts: `sandbox/js-p3/ex5-call-apply-bind.mjs`, `sandbox/js-p3/ex5b-thisarg-sloppy.cjs`.

**All three set `this` explicitly. Only `bind` defers the call.** That is the
whole distinction, and everything else follows from it.

## Side by side

```
--- the three, side by side ---
  describe.call(user, "hi", "!")                   hi, ada!
  describe.apply(user, ["hi", "!"])                hi, ada!
  describe.bind(user)("hi", "!")                   hi, ada!
  describe.bind(user, "hi")("!")   ← partial       hi, ada!
  bind returns a NEW function each time            false
  call/apply invoke immediately; bind returns      function
```

```js
function describe(greeting, punctuation) { return `${greeting}, ${this.name}${punctuation}`; }
const user = {name: 'ada'};
```

| | Signature | Invokes? | Returns |
|---|---|---|---|
| `call` | `fn.call(thisArg, a, b)` | immediately | the function's result |
| `apply` | `fn.apply(thisArg, [a, b])` | immediately | the function's result |
| `bind` | `fn.bind(thisArg, a)` | **no** | a new function |

The mnemonic that actually sticks: **a**pply takes an **a**rray. `call` takes the
arguments spread out.

Row five is the one with consequences: **`bind` returns a new function object
every time it is called**, so `describe.bind(user) === describe.bind(user)` is
`false`. That is the source of the `removeEventListener` bug covered in
[the previous topic](../03-this/02-losing-and-fixing-this.md).

## `thisArg` coercion: strict versus sloppy

In strict mode the `thisArg` is passed through completely untouched:

```
--- what a non-object thisArg becomes ---
  call(undefined)  in a module (strict)            undefined:undefined
  call(null)       in a module (strict)            object:[object Null]
  call(42)         in a module (strict)            number:[object Number]
  call("str")      in a module (strict)            string:[object String]
```

In sloppy mode it is coerced — `null` and `undefined` become `globalThis`, and
primitives are **boxed into wrapper objects**:

```
--- sloppy mode: primitives are BOXED, null/undefined become globalThis ---
  what.call(undefined)                             object (globalThis)
  what.call(null)                                  object (globalThis)
  what.call(42)                                    object [object Number]
  what.call("str")                                 object [object String]
  what.call(true)                                  object [object Boolean]

--- strict mode: the thisArg is passed through untouched ---
  whatStrict.call(undefined)                       undefined (undefined)
  whatStrict.call(null)                            object [object Null]
  whatStrict.call(42)                              number [object Number]
  whatStrict.call("str")                           string [object String]
  whatStrict.call(true)                            boolean [object Boolean]
```

Note the difference in `typeof`: sloppy reports `object` for `42`, strict reports
`number`. That boxing has a real consequence, because each call boxes a **fresh**
wrapper:

```
--- the practical consequence ---
  sloppy: addOne.call(42) twice                    each call boxes a NEW Number, so count is always 1
    second call returned                           1
```

```js
function addOne() { this.count = (this.count || 0) + 1; return this.count; }
addOne.call(42);      // 1
addOne.call(42);      // 1  — a different Number object each time
```

State written to a boxed primitive is discarded the moment the call ends. In
strict mode this is a clean `TypeError` instead, which is why **you should assume
strict**: modules and classes always are.

The idiom `fn.call(null, …)` is common in older code purely to say "I don't care
about `this`". In strict mode that literally passes `null`, so it only works if
the function never touches `this`.

## Gotchas

**Symptom:** `fn.apply(obj, arg)` throws
`TypeError: CreateListFromArrayLike called on non-object`
**Cause:** `apply`'s second argument must be an array or array-like. A bare value
is not.
**Fix:** Wrap it — `fn.apply(obj, [arg])` — or use `call`.

**Symptom:** State written inside a function called via `call(somePrimitive)`
vanishes between calls
**Cause:** Sloppy mode boxes the primitive into a fresh wrapper object per call.
Measured: `addOne.call(42)` returned `1` twice, never `2`.
**Fix:** Use strict mode, where it is a `TypeError` on the write — or pass a real
object.

**Symptom:** `TypeError: Cannot read properties of undefined` after
`fn.call(null, …)`
**Cause:** In strict mode `null` is passed through literally rather than being
replaced by `globalThis`. Measured: `typeof this` is `object` in sloppy mode and
`undefined`/`object` respectively in strict.
**Fix:** Pass the object the function actually needs, or use an arrow that closes
over it.

**Symptom:** A function behaves differently when moved from a `.cjs` file into a
module
**Cause:** Modules are strict, so `thisArg` coercion stops happening — measured
`typeof this` as `number` in strict against `object` in sloppy for the same
`call(42)`.
**Fix:** Do not depend on coercion. Pass what the function expects.

## Interview questions

**★ Difference between `call`, `apply` and `bind`?**
`call` and `apply` invoke immediately and differ only in argument packaging —
`call(thisArg, a, b)` versus `apply(thisArg, [a, b])`. `bind` invokes nothing and
returns a **new** function with `this` fixed permanently, optionally with leading
arguments pre-filled. Mnemonic: **a**pply takes an **a**rray.

**★ What happens to a primitive passed as `thisArg`?**
In strict mode it is passed through untouched — measured `typeof this` as
`number` for `call(42)`. In sloppy mode it is boxed into a wrapper object, and
`null`/`undefined` become `globalThis`. Because each sloppy call boxes a *fresh*
wrapper, any state written to `this` is discarded.

**★ Why does `fn.call(null)` behave differently in strict mode?**
Sloppy mode substitutes `globalThis` for `null`; strict mode passes `null`
through. So the old "I don't care about `this`" idiom only holds if the function
genuinely never touches `this`.

**Does `bind` return the same function if you call it twice?**
No — measured `describe.bind(user) === describe.bind(user)` is `false`. A new
function object every time, which is why binding inline in
`addEventListener`/`removeEventListener` pairs never removes the listener.

---

← [Topic index](./README.md) · Next → [What `bind` does](./02-what-bind-does.md)

