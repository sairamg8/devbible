---
title: "02.2 · bind, including with new"
sidebar_label: "02 · bind"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-14 against MDN — [`Function.prototype.bind()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Function/bind), [`new.target`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/new.target), [`Object.create()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/create), [`instanceof`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/instanceof). Documentation-validated; **no timings**.

**`bind` is the interesting one**, because the specification requires the returned function to
behave differently when called with `new` — and that requirement is the whole exercise.

## What the specification requires

MDN, on the returned function:

> "A copy of the given function with the specified `this` value, and initial arguments (if
> provided)."

and, on construction:

> "The value is ignored if the bound function is constructed using the `new` operator."

> "When a bound function is used to construct a value, the provided `this` is ignored."

🔴 **That last sentence is the exercise.** `new (fn.bind(x))()` must ignore `x` entirely and behave
like `new fn()` — same prototype chain, and `instanceof fn` must be `true`.

## The naive version, and why it fails

```js
Function.prototype.badBind = function (thisArg, ...bound) {
  const fn = this;
  return function (...args) {
    return fn.apply(thisArg, [...bound, ...args]);   // ❌ ignores `new`
  };
};

function Point(x, y) { this.x = x; this.y = y; }
const P = Point.badBind(null);
const p = new P(1, 2);
p instanceof Point;      // ❌ false — and `this` was the bound null, not the new object
```

The arrow-function version is worse still: an arrow cannot be constructed at all, so
`new boundFn()` throws `TypeError: boundFn is not a constructor`.

## The version that handles `new`

```js
Function.prototype.myBind = function (thisArg, ...bound) {
  if (typeof this !== "function") throw new TypeError("Bind must be called on a function");

  const target = this;

  function boundFn(...args) {
    const calledWithNew = this instanceof boundFn;          // 🔴 the detection
    return target.apply(calledWithNew ? this : thisArg, [...bound, ...args]);
  }

  boundFn.prototype = Object.create(target.prototype ?? Object.prototype);   // 🔴 the chain
  return boundFn;
};
```

Two lines carry it:

🔴 **`this instanceof boundFn`** detects construction. When called with `new`, `this` is a fresh
object whose prototype is `boundFn.prototype`; when called normally it is the bound value or
`undefined`. **`new.target !== undefined` is the modern, more direct test** and is worth naming as
the better version:

```js
function boundFn(...args) {
  return target.apply(new.target ? this : thisArg, [...bound, ...args]);
}
```

🔴 **`boundFn.prototype = Object.create(target.prototype)`** is what makes `instanceof` work. Without
it, the constructed object's prototype chain does not reach `Point.prototype` and
`p instanceof Point` is `false`.

⚠️ **`Object.create(target.prototype)` rather than `boundFn.prototype = target.prototype`.** Sharing
the object directly means mutating `boundFn.prototype` also mutates `Point.prototype` — a real leak
between the bound and unbound versions.

⚠️ **And `?? Object.prototype`** because arrow functions and methods have no `prototype` property,
so `Object.create(undefined)` would throw.

## Three things the real `bind` does that this does not

Worth naming, because they are the follow-ups:

- 🔴 **A real bound function has no `prototype` property at all.** MDN: *"because a bound function
  does not have the `prototype` property, it cannot be used as a base class for `extends`."* Our
  version adds one, which is how it fakes `instanceof` — the engine does it through an internal
  `[[BoundTargetFunction]]` slot instead.
- **`length` and `name`.** The real one sets `length` to the target's remaining arity and `name` to
  `"bound " + target.name`. Reproducing that needs `Object.defineProperty`, since both are
  non-writable.
- **Re-binding is a no-op for `this`.** MDN: *"The newly bound `thisArg` value is ignored, because
  the target function of `boundFn2`, which is `boundFn`, already has a bound `this`."* Arguments
  **do** accumulate — in order: those bound by the first bind, then the second, then the call's
  own.

## Partial application, which is the other half

```js
function greet(greeting, punctuation, name) {
  return `${greeting}, ${name}${punctuation}`;
}
const hi = greet.bind(null, "Hi", "!");
hi("Ada");                        // "Hi, Ada!"
```

Bound arguments are **prepended**, always — there is no placeholder mechanism, which is exactly
what `curry` with placeholders exists to add (**13 · `curry`, `pipe` and `compose`**, *not written
yet*).

⚠️ **`bind` allocates a new function every call.** In a render path —
`onClick={this.handleClick.bind(this)}` — that creates a fresh function per render, defeating any
memoized child. Bind once in the constructor, or use a class field with an arrow.

## What to use instead, most of the time

```js
class Counter {
  n = 0;
  inc = () => { this.n++; };      // class field + arrow: lexical `this`, bound by construction
}
```

**A class field holding an arrow function is the modern answer to the lost-`this` problem** — the
arrow captures `this` lexically at construction, so extracting the method is safe.

⚠️ **The trade is that it is a per-instance property, not on the prototype** — one function object
per instance rather than one shared. For a component with thousands of instances that is real
memory; for most code it is not, and the safety is worth it. Naming that trade is the complete
answer.

## Gotchas

**Symptom:** `new (fn.bind(x))()` produces an object that is not `instanceof fn`
**Cause:** The bound function's `prototype` does not chain to the target's.
**Fix:** `boundFn.prototype = Object.create(target.prototype)`.

**Symptom:** `new boundFn()` throws "is not a constructor"
**Cause:** The bound function was implemented as an arrow.
**Fix:** A regular function, so it can be constructed.

**Symptom:** Mutating the bound function's prototype changes the original's
**Cause:** `boundFn.prototype = target.prototype` shares the object.
**Fix:** `Object.create`.

**Symptom:** Binding a method or an arrow throws in the implementation
**Cause:** They have no `prototype`, so `Object.create(undefined)` throws.
**Fix:** `?? Object.prototype`.

**Symptom:** Re-binding does not change `this`
**Cause:** Specified behaviour — the first bind wins; only arguments accumulate.
**Fix:** Bind the original function.

**Symptom:** A bound function cannot be used with `extends`
**Cause:** MDN: a real bound function has **no `prototype` property**.
**Fix:** Extend the original.

**Symptom:** A memoized child re-renders every time
**Cause:** `bind` in the render path allocates a new function each render.
**Fix:** Bind once, or use a class field arrow.

**Symptom:** `fn.bind(x).name` is not `"bound fn"` in a hand-rolled version
**Cause:** `name` and `length` are non-writable and need `defineProperty`.
**Fix:** Define them explicitly if fidelity matters.

## Interview questions

**★ Implement `bind` so it still works with `new`.**
Return a **regular** function; detect construction with `new.target` (or `this instanceof boundFn`)
and, when constructing, pass the new `this` through instead of the bound value; and set
`boundFn.prototype = Object.create(target.prototype)` so `instanceof` reaches the original.

**★ Why does the naive closure version fail under `new`?**
It applies the bound `thisArg` unconditionally, so the newly constructed object is discarded, and
its prototype chain never reaches the target — `p instanceof Point` is `false`. An arrow-function
version is worse: it cannot be constructed at all.

**★ Why `Object.create(target.prototype)` rather than assigning it directly?**
Assigning shares the same object, so mutating the bound function's prototype mutates the
original's. `Object.create` gives a fresh object that still chains to it.

**★ Name something the real `bind` does that your version does not.**
A real bound function has **no `prototype` property** — MDN notes it therefore *"cannot be used as
a base class for `extends`"* — and the engine achieves `instanceof` through an internal bound-target
slot instead. It also sets `name` to `"bound " + name` and `length` to the remaining arity.

**★ What happens if you bind an already-bound function?**
The new `this` is **ignored** — MDN: *"The newly bound `thisArg` value is ignored, because the
target function … already has a bound `this`."* Arguments accumulate in order: first bind's, second
bind's, then the call's.

**★ When would you not use `bind` at all?**
In a render path — it allocates a new function per call and defeats memoized children. A class
field holding an arrow is the modern answer, at the cost of one function object per instance
rather than one on the prototype.

**Why is `new.target` better than `this instanceof boundFn`?**
It is direct — it asks whether the function was invoked with `new`, rather than inferring it from
the prototype chain, which can be fooled by
`boundFn.call(Object.create(boundFn.prototype))`.

---

← [01 · call and apply](./01-call-and-apply.md) · [Topic index](./README.md) ·
Next → [Phase index](../README.md)
