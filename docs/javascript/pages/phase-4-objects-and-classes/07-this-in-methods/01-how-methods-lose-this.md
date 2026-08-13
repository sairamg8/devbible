---
title: "07.1 · How a method loses `this`"
sidebar_label: "01 · How a method loses this"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-13 against MDN — [`this`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/this), [Classes](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Classes). Documentation-validated.

**A method is not attached to its object.** It is a function that happens to be
reachable through one, and `this` is decided by *how it is called*, never by where it
was defined. Every bug in this topic is that one sentence not being believed.

MDN: *"if the function call is in the form `obj.f()`, then `this` refers to `obj`."*
The binding is created **by the call expression** — by the dot — and it evaporates
the moment the function is called any other way.

## The same function, three receivers

```js
function getThis() {
  return this;
}

const obj1 = { name: "obj1" };
const obj2 = { name: "obj2" };

obj1.getThis = getThis;
obj2.getThis = getThis;

console.log(obj1.getThis()); // { name: 'obj1', getThis: [Function: getThis] }
console.log(obj2.getThis()); // { name: 'obj2', getThis: [Function: getThis] }
```

One function object, two different `this` values, decided entirely at the call site.
There is no "owner". A method borrowed onto another object simply works on that
object:

```js
const obj4 = { name: "obj4", getThis() { return this; } };
const obj5 = { name: "obj5" };

obj5.getThis = obj4.getThis;
console.log(obj5.getThis()); // { name: 'obj5', getThis: [Function: getThis] }
```

That is method borrowing, and it is a feature — it is what
[Phase 3 · 05 · `call`, `apply` and `bind`](../../phase-3-functions/05-call-apply-bind/README.md)
is built on. It is also why extracting a method is dangerous: nothing travels with
the function.

## Detaching it: `this` becomes `undefined`

```js
function getThisStrict() {
  "use strict";
  return this;
}

console.log(typeof getThisStrict()); // "undefined"
```

MDN: *"If the function is called without being accessed on anything, `this` will be
`undefined` — but only if the function is in strict mode."*

The sloppy-mode caveat matters for reading old code. MDN describes **`this`
substitution**: in non-strict mode `undefined` or `null` is replaced with
`globalThis`, so `this` is *always* an object:

```js
function getThis() { return this; }
console.log(getThis() === globalThis); // true
```

**Which mode you are in decides the symptom**, and the strict one is far better:

| Mode | Detached `this` | Symptom |
|---|---|---|
| strict (every module, every class body) | `undefined` | **`TypeError: Cannot read properties of undefined`** — immediate, at the right line |
| sloppy (classic script, old CommonJS) | `globalThis` | reads give `undefined`, **writes silently create globals** — fails far away |

The sloppy version is the nastier one: `this.count = 0` in a detached method does not
throw, it creates a global `count`, and the object you meant to update stays
unchanged. Since class bodies and modules are strict, most modern code gets the loud
failure.

## The four ways it happens in real code

**1. Assigning the method to a variable.**

```js
const speak = obj.speak;
speak(); // this is undefined
```

No dot at the call, so no receiver. MDN states this directly for classes: *"methods
lose their `this` binding when detached"*.

**2. Passing it as a callback** — the same thing wearing a disguise:

```js
element.addEventListener("click", this.handleClick);   // detached
setTimeout(this.tick, 1000);                           // detached
items.forEach(this.process);                           // detached
promise.then(this.onResolve);                          // detached
```

Each of these hands over the *function*, and whoever calls it later does so without
your object. MDN: *"Callbacks are typically called with `this` set to `undefined`"*:

```js
function logThis() {
  "use strict";
  console.log(this);
}

[1, 2, 3].forEach(logThis); // undefined, undefined, undefined
```

**This is the single most common form of the bug**, because passing a method by name
reads so naturally.

**3. Destructuring it out.**

```js
const { start, stop } = timer;
start(); // this is undefined
```

Destructuring is assignment, so it detaches exactly like case 1. A tempting API shape
(`const { get, set } = useStore()`) only works if those functions never use `this` —
which is why store libraries return closures rather than methods.

**4. Re-attaching it to a different object.** MDN's example, and the one worth
studying:

```js
class Car {
  sayHi() { console.log(`Hello from ${this.name}`); }
  get name() { return "Ferrari"; }
}
class Bird {
  get name() { return "Tweety"; }
}

const car = new Car();
const bird = new Bird();

car.sayHi();          // Hello from Ferrari
bird.sayHi = car.sayHi;
bird.sayHi();         // Hello from Tweety  ← this = bird
```

Not an error — just a completely different result. `sayHi` reads `this.name`, and
`this` is whatever it was called on.

## `thisArg`: the APIs that let you supply a receiver

```js
[1, 2, 3].forEach(logThis, { name: "obj" });
// { name: 'obj' }, { name: 'obj' }, { name: 'obj' }
```

`forEach`, `map`, `filter`, `some`, `every`, `find`, `findIndex` and `flatMap` all
take an optional second argument used as `this` inside the callback.

**But not all of them** — `reduce` and `reduceRight` do not (their second argument is
the initial value), and neither does `sort`. That asymmetry was confirmed against MDN
and measured in
[Phase 3 · 02 · Parameters](../../phase-3-functions/02-parameters/README.md).

In practice `thisArg` is legacy ergonomics. An arrow function reads better and works
with every API:

```js
items.forEach((item) => this.process(item));   // ✅ works everywhere
items.forEach(this.process, this);             // works, but only where thisArg exists
```

## Class fields are different — and that is the fix

```js
class C {
  instanceField = this;
  static staticField = this;
}

const c = new C();
console.log(c.instanceField === c); // true
console.log(C.staticField === C);   // true
```

A field initialiser runs with `this` already bound — to the instance for an instance
field, to the class for a static one. That is *why* an arrow function stored in a
field captures the instance permanently, which is
[chunk 2](./02-the-fixes.md)'s main subject.

## Gotchas

**Symptom:** `TypeError: Cannot read properties of undefined (reading 'x')` inside a
method
**Cause:** The method was detached — assigned to a variable, destructured, or passed
as a callback — so `this` is `undefined` in strict mode.
**Fix:** Bind it, wrap it in an arrow at the call site, or make it a class field
arrow. See [chunk 2](./02-the-fixes.md).

**Symptom:** A method silently does nothing, and a global variable appears
**Cause:** Sloppy mode. `this` substitution made `this` `globalThis`, so
`this.count = 0` created a global instead of throwing.
**Fix:** Use modules or classes, which are strict — the same code then throws at the
right line.

**Symptom:** `this.handleClick` works when called as `this.handleClick()` and fails
as an event handler
**Cause:** `addEventListener` stores the function and calls it later with its own
receiver. Passing `this.handleClick` passes only the function.
**Fix:** `addEventListener("click", (e) => this.handleClick(e))`, or a bound/field
version.

**Symptom:** Destructuring an object's methods breaks them
**Cause:** Destructuring is assignment — it detaches exactly like
`const f = obj.f`.
**Fix:** Call them through the object, or design the API to return closures rather
than `this`-dependent methods.

**Symptom:** A borrowed method returns another object's data
**Cause:** `this` is the receiver at the call site. MDN's example: `bird.sayHi()`
logs `Tweety` even though `sayHi` came from `Car`.
**Fix:** Usually intended (method borrowing). If not, bind the method to its original
object.

**Symptom:** `arr.reduce(fn, thisObj)` does not set `this`
**Cause:** `reduce`'s second argument is the **initial value**, not `thisArg`. Only
some iteration methods take a `thisArg`.
**Fix:** Use an arrow function, which needs no `thisArg` anywhere.

## Interview questions

**★ What determines `this` inside a method?**
The **call site**, not the definition. MDN: *"if the function call is in the form
`obj.f()`, then `this` refers to `obj`."* The binding is created by the call
expression, so the same function object gives different `this` values depending on
what it was called on, and none at all when called bare.

**★ What happens when you pass `obj.method` as a callback?**
It is detached — only the function is passed, not the receiver — so `this` is
`undefined` in strict mode and `globalThis` in sloppy mode. MDN: *"Callbacks are
typically called with `this` set to `undefined`"*, demonstrated with
`[1,2,3].forEach(logThis)` logging `undefined` three times.

**★ Why is the strict-mode failure better than the sloppy-mode one?**
Strict mode gives `undefined`, so the first property access throws `TypeError` at the
offending line. Sloppy mode substitutes `globalThis`, so reads quietly give
`undefined` and **writes silently create globals** — the object you meant to change
is untouched and the failure surfaces far away.

**★ Do all array methods accept a `thisArg`?**
No. `forEach`, `map`, `filter`, `some`, `every`, `find`, `findIndex` and `flatMap` do;
`reduce` and `reduceRight` do not — their second argument is the **initial value** —
and neither does `sort`. An arrow function sidesteps the whole question.

**What is `this` inside a class field initialiser?**
The instance for an instance field, and the class itself for a static field — MDN's
example has `c.instanceField === c` and `C.staticField === C`. That is exactly why an
arrow function in a field captures the instance permanently.

**Is a method "owned" by its object?**
No. It is an ordinary function reachable through the object, and nothing travels with
it when you extract it. Assigning `bird.sayHi = car.sayHi` and calling it gives
`this === bird` — which is method borrowing, a deliberate feature of the same rule.

---

[Topic index](./README.md) · Next → [The fixes, and which to choose](./02-the-fixes.md)
