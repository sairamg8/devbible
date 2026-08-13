---
title: "03.2 · Losing `this`, and getting it back"
sidebar_label: "02 · Losing and fixing this"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 on **Node 24.19.0** (V8 13.6) — **sandbox-proven**. Script: `sandbox/js-p3/ex3-this.mjs`.

**Implicit binding is a property of the call site, not the function.** Take the
function out of the call site — assign it, pass it, schedule it — and the binding
does not travel with it. This is the single most common `this` bug in JavaScript,
and it has four standard fixes with different costs.

## The bug

```
--- the lost-this bug: extracting a method drops the receiver ---
  const loose = counter.read; loose()                undefined
  setTimeout-style: passing the method as a value    undefined
```

```js
const counter = {
  label: 'counter',
  read() { return this === undefined ? 'undefined' : this.label; },
};

counter.read();               // 'counter'   — implicit binding
const loose = counter.read;
loose();                      // this is undefined — the dot is gone
```

`loose` and `counter.read` are the *same function object*. The difference is
entirely in the call expression: `counter.read()` has a receiver, `loose()` does
not, so rule 4 applies and `this` is `undefined`.

Every real-world version of this is that same assignment wearing a disguise:

```js
setTimeout(counter.read, 0);            // passed as a value → no receiver
element.addEventListener('click', counter.read);
[1, 2].map(counter.read);
promise.then(counter.read);
const {read} = counter;                 // destructuring is an assignment too
```

In a class the same thing throws instead of returning `undefined`, because the
body actually dereferences `this`:

```
--- class bodies are always strict — the same loss, a clearer error ---
  svc.read()                                         service
  const detached = svc.read; detached()              TypeError: Cannot read properties of undefined (reading 'name')
  a class FIELD arrow survives detaching             service
```

**`TypeError: Cannot read properties of undefined (reading 'name')` for a method
you know exists is this bug until proven otherwise.** The property named in the
message is the first one the method touched on `this`.

## Callbacks and `thisArg`

Some built-ins let you supply the receiver as a second argument, which avoids the
problem without a wrapper:

```
--- callbacks: which array methods hand you a thisArg ---
  map(fn, thisArg)                                   [10,20]
  map(arrow)                                         [10,20]
  map(function) with no thisArg                      TypeError: Cannot read properties of undefined (reading 'factor')
```

```js
const collector = {
  factor: 10,
  viaThisArg(nums) { return nums.map(function (n) { return n * this.factor; }, this); },
  viaArrow(nums)   { return nums.map((n) => n * this.factor); },
  broken(nums)     { return nums.map(function (n) { return n * this.factor; }); },
};
```

Which methods actually accept one is worth knowing rather than guessing, so it
was probed rather than assumed:

```
  Array.prototype.forEach                            thisArg honoured
  Array.prototype.map                                thisArg honoured
  Array.prototype.filter                             thisArg honoured
  Array.prototype.some                               thisArg honoured
  Array.prototype.every                              thisArg honoured
  Array.prototype.find                               thisArg honoured
  Array.prototype.findIndex                          thisArg honoured
  Array.prototype.flatMap                            thisArg honoured
  Array.prototype.reduce                             this = undefined
  Array.prototype.sort                               this = undefined
```

**`reduce` and `sort` do not take a `thisArg`** — they use their second parameter
for the initial value and nothing respectively. Everything else in that list
does, `flatMap` included.

The `thisArg` parameter is a pre-arrow relic. It is still the tersest fix when
you already have a `function` callback, but an arrow needs no second argument at
all, which is why almost nobody reaches for it in new code.

## The four fixes

```
--- rule 0 (lexical): an arrow has no this of its own ---
  method() containing an arrow                       withArrow
  an arrow used AS the method                        undefined (module this)
  new (arrow)                                        TypeError: A is not a constructor
```

### 1. An arrow function — the default answer

```js
setTimeout(() => counter.read(), 0);
```

The arrow has no `this`, so the call inside it is an ordinary `counter.read()`
with its receiver intact. Nothing is bound; the dot is simply preserved.

**Cost:** it captures the *enclosing* `this`, which is only correct if the
enclosing scope has the right one. Measured above: an arrow used **as** a method
gets the module's `this` (`undefined`), not the object — the second row. Arrows
are the fix for callbacks *inside* a method, and the bug when used as the method
itself.

### 2. `bind`

```js
setTimeout(counter.read.bind(counter), 0);
```

Explicit and readable at the call site. **Cost:** `bind` returns a *new function
object every call*, which breaks identity:

```js
element.addEventListener('click', counter.read.bind(counter));
element.removeEventListener('click', counter.read.bind(counter));   // does nothing
```

The second `bind` produced a different function, so the listener is never
removed — a genuine memory leak in long-lived pages. Store the bound function
once if you will need to remove it.

### 3. A class field arrow

```js
class Service {
  constructor() { this.name = 'service'; }
  readBound = () => this.name;
}
```

Measured: **`a class FIELD arrow survives detaching`** → `service`. A class field
is created per instance, with the constructor's `this` captured, so it can be
passed anywhere.

**Cost:** it is a per-instance property, not a prototype method. Ten thousand
instances means ten thousand function objects rather than one shared one, and it
is not on the prototype so it cannot be overridden by a subclass in the normal
way or stubbed via `Service.prototype`. Fine for a handful of long-lived
services and React-style handlers; wrong for a hot value type.

### 4. `thisArg`, where the API offers one

```js
nums.map(function (n) { return n * this.factor; }, this);
```

Zero allocation and no wrapper, but only available on the methods listed above.

### Choosing

| Situation | Reach for |
|---|---|
| Callback inside a method | **Arrow** |
| Handler you must later remove | **`bind`, stored once** |
| Class method passed as a value repeatedly | **Class field arrow** |
| `map`/`filter`/`forEach` with an existing `function` | **`thisArg`** |
| Object method that needs `this` | **Never an arrow** — use shorthand `method()` |

## Gotchas

**Symptom:** `TypeError: Cannot read properties of undefined (reading 'x')` in a
method that definitely exists
**Cause:** The method was detached from its receiver — assigned, destructured,
or passed as a callback. Measured: `const detached = svc.read; detached()`.
**Fix:** An arrow wrapper, `bind`, or a class field arrow — see the table above.

**Symptom:** `this` is `undefined` in an object method written as an arrow
**Cause:** Arrows take `this` from the enclosing scope, which at module level is
`undefined`. Measured: `arrowAsMethod` returned `undefined (module this)`.
**Fix:** Use method shorthand — `read() { … }` — and keep arrows for callbacks
*inside* it.

**Symptom:** `removeEventListener` does not remove the listener
**Cause:** `bind` returns a new function each call, so the reference passed to
`remove` never matches the one passed to `add`.
**Fix:** `this.onClick = this.handle.bind(this)` once, then add and remove that
property.

**Symptom:** `TypeError: Cannot read properties of undefined (reading 'factor')`
inside a `map` callback
**Cause:** A `function` callback gets default binding. Measured against the same
callback that works with a `thisArg`.
**Fix:** Arrow callback, or pass `this` as `map`'s second argument.

**Symptom:** Passing `this` as a second argument to `reduce` silently becomes the
accumulator
**Cause:** `reduce` has no `thisArg` — its second parameter is the initial value.
Measured: `this = undefined` in the probe.
**Fix:** Use an arrow callback.

**Symptom:** Memory use scales with instance count after switching methods to
class fields
**Cause:** A class field arrow is per-instance, not on the prototype.
**Fix:** Keep prototype methods and bind at the one call site that needs it.

## Interview questions

**★ Why does `const f = obj.method; f()` break?**
Implicit binding comes from the call expression, not the function. Removing the
dot removes the receiver, so default binding applies and `this` is `undefined` in
strict mode. Measured: `undefined` for a plain object, and
`TypeError: Cannot read properties of undefined (reading 'name')` for a class
method that dereferences it.

**★ How do you fix a lost `this` in a callback?**
An arrow wrapper (preserves the dot), `bind` (new function, fixed receiver), a
class field arrow (per-instance, survives detaching — measured), or a `thisArg`
where the method supports one. Arrow is the default; `bind` stored once is the
answer when you need a stable reference to remove later.

**★ Why is `removeEventListener` with `bind` a bug?**
`bind` returns a new function object every call, so the reference never matches
the one that was added. The listener stays registered and keeps its closure
alive.

**★ Can you use an arrow function as an object method?**
Not if it needs `this`. It captures the enclosing scope's `this` — measured
`undefined` at module level — rather than the object. Use method shorthand.

**Which array methods accept a `thisArg`?**
`forEach`, `map`, `filter`, `some`, `every`, `find`, `findIndex` and `flatMap` —
all measured as honouring it. `reduce` and `sort` do not; `reduce`'s second
argument is the initial value.

**What is the cost of class field arrows?**
One function object per instance instead of one shared prototype method, and the
method no longer lives on the prototype — so it cannot be overridden or stubbed
there. Acceptable for a few long-lived instances, wasteful for many.

---

← [The four binding rules](./01-the-four-rules.md) · [Topic index](./README.md) · Next → [Arrow functions and `this`](../04-arrow-functions-and-this/README.md)
