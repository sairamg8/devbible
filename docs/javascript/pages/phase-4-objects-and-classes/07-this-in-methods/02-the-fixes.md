---
title: "07.2 · The fixes, and which to choose"
sidebar_label: "02 · The fixes"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-13 against MDN — [`this`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/this), [`Function.prototype.bind`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Function/bind), [Classes](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Classes). Documentation-validated.

Four ways to keep `this`, and they are not interchangeable. Each puts the binding in
a different place, and that decides whether the method can still be overridden,
whether it costs memory per instance, and whether it can be removed as an event
listener.

## 1. `bind` in the constructor

```js
class Car {
  constructor() {
    // Bind methods in constructor to preserve this
    this.sayBye = this.sayBye.bind(this);
  }

  sayHi()  { console.log(`Hello from ${this.name}`); }
  sayBye() { console.log(`Bye from ${this.name}`); }

  get name() { return "Ferrari"; }
}

const car = new Car();
const bird = new Bird();       // has its own `name` getter -> "Tweety"

bird.sayHi = car.sayHi;
bird.sayHi();   // Hello from Tweety  ← unbound: this = bird

bird.sayBye = car.sayBye;
bird.sayBye();  // Bye from Ferrari   ← bound: this = car, permanently
```

MDN's example, and it isolates the mechanism exactly: two methods on one class,
identical bodies, and only the bound one survives being re-attached to another
object.

**What `bind` actually does** is create a *new function* whose `this` is fixed. So
`this.sayBye = …` in the constructor puts an **own property** on the instance that
shadows the prototype method. From then on `car.sayBye` finds the bound copy first.

**And the binding is permanent** — from
[Phase 3 · 05 · `call`, `apply` and `bind`](../../phase-3-functions/05-call-apply-bind/README.md),
where it was measured:

```js
const g = f.bind({ a: "azerty" });
const h = g.bind({ a: "yoo" }); // bind only works once!
console.log(h()); // azerty
```

Re-binding a bound function does nothing. `call` and `apply` cannot override it
either.

## 2. A class field holding an arrow

```js
class Button {
  count = 0;
  handleClick = () => {
    this.count++;      // `this` is permanently the instance
  };
}
```

Recall from [06 · `class`](../06-class/01-what-class-desugars-to.md) that a field
initialiser runs with `this` already bound to the instance — MDN:
`c.instanceField === c`. The arrow captures that lexically and never rebinds,
because arrows have no `this` of their own.

The result is very close to option 1: an **own property per instance** holding a
function locked to that instance. It is shorter to write and impossible to forget
for a newly added method.

## 3. Wrap at the call site

```js
element.addEventListener("click", (e) => this.handleClick(e));
setTimeout(() => this.tick(), 1000);
items.forEach((item) => this.process(item));
```

The arrow captures `this` from the surrounding scope; the *call* inside it is
`this.handleClick(e)`, a normal method call with a receiver. **The method stays a
plain prototype method** — nothing is bound, nothing is copied.

This is usually the best default. It is explicit at the point where the loss would
have happened, it costs nothing per instance, and it keeps the method overridable.

🔴 **The one place it is wrong: removable event listeners.**

```js
// ❌ cannot be removed — a NEW function every time
element.addEventListener("click", (e) => this.handleClick(e));
element.removeEventListener("click", (e) => this.handleClick(e)); // no-op

// ✅ same function object both times
this.onClick = this.handleClick.bind(this);
element.addEventListener("click", this.onClick);
element.removeEventListener("click", this.onClick);
```

`removeEventListener` matches by **identity**. Every arrow expression creates a new
function, so the second one is not the listener you added, and the removal silently
does nothing. This is a real and common leak: components that add wrapped listeners
on mount and fail to remove them on unmount.

## 4. `call` / `apply` / `thisArg`

```js
add.call(o, 5, 7);      // 16
add.apply(o, [10, 20]); // 34
[1, 2, 3].forEach(logThis, { name: "obj" });
```

These set `this` for **one call**, not permanently. Useful for method borrowing and
for the older iteration APIs, but not a fix for the detached-method problem —
you have to be at the call site anyway, and if you are, option 3 reads better.

Remember `reduce`, `reduceRight` and `sort` take **no** `thisArg`.

## Choosing

| | Where the binding lives | Per-instance cost | Still overridable? | `super`? | Removable listener? |
|---|---|---|---|---|---|
| **`bind` in constructor** | own property (bound copy) | one function per instance | no — the own property shadows | prototype method still exists | ✅ store the bound function |
| **Arrow class field** | own property | one function per instance | **no** | **no** | ✅ it is one stable function |
| **Wrap at call site** | nowhere — method untouched | none | ✅ yes | ✅ yes | ❌ new function each time |
| **`call`/`apply`/`thisArg`** | that one call | none | ✅ yes | ✅ yes | n/a |

**Defaults worth adopting:**

- **Wrap at the call site** unless you have a reason not to. It is explicit, free,
  and preserves prototype semantics.
- **Arrow class field** when the method is *always* used as a callback — a React
  event handler, a subscription callback. Accept that it is no longer a prototype
  method.
- **`bind` in the constructor** when you need a stable function identity, above all
  for `addEventListener` / `removeEventListener` pairs.
- **Never** rely on `thisArg` — it does not exist on every API.

### The cost of the two "own property" options

Both option 1 and option 2 create **one function object per instance** rather than
one shared on the prototype. For a handful of objects that is irrelevant. For
thousands — a list row component, a particle, a record in a large collection — it is
real memory, and worth the call-site wrapper instead.

More importantly, both **take the method off the prototype**, so:

- a subclass cannot override it through the prototype chain in the normal way, and
- `super.handleClick()` cannot reach it,

because the own property is found before the chain is ever walked. If a method is
part of your class's extension surface, keep it a prototype method and wrap at the
call site.

## What *not* to do

**`const self = this`** — the pre-arrow workaround. It still works and you will meet
it in older code, but an arrow does the same thing with less ceremony and no extra
name. Do not write it in new code.

**Binding in `render` or in a hot path** — `onClick={this.handle.bind(this)}` creates
a new function on every render, which defeats memoisation on the child receiving it
(the same identity argument as
[04 · Shallow vs deep copy](../04-shallow-vs-deep-copy/01-what-shallow-means.md)).
Bind once in the constructor, or use a field.

**Reaching for arrows everywhere in an object literal** — an arrow in an object
literal captures the *enclosing scope's* `this`, which is not the object. That is the
mistake from
[01 · Methods, accessors and spread](../01-object-literals/02-methods-accessors-and-spread.md),
and it is the opposite error to the one this page fixes.

## Gotchas

**Symptom:** `removeEventListener` does nothing and the listener keeps firing
**Cause:** The handler was an inline arrow, so removal passed a **different function
object**. Matching is by identity.
**Fix:** Store one bound function (`this.onClick = this.handleClick.bind(this)`) and
pass that to both calls.

**Symptom:** `bind` appears to be ignored when re-binding
**Cause:** A bound function's `this` is permanent — MDN: *"bind only works once!"*
`call`/`apply` cannot override it either.
**Fix:** Bind from the original function, not from the already-bound one.

**Symptom:** A subclass cannot override a parent method, or `super.method()` fails
**Cause:** The method is an **own property** — an arrow field or a constructor-bound
copy — so it is found before the prototype chain is walked.
**Fix:** Keep it a prototype method and wrap at the call site instead.

**Symptom:** Memory grows with the number of instances
**Cause:** Every arrow field and every constructor `bind` creates a function object
**per instance** rather than sharing one on the prototype.
**Fix:** Prototype method plus a call-site arrow, for classes with many instances.

**Symptom:** A memoised child re-renders on every parent render
**Cause:** A new function identity each render — `.bind(this)` or an inline arrow in
the render path.
**Fix:** Bind once in the constructor or use a class field, so the prop identity is
stable.

**Symptom:** An arrow in an **object literal** has the wrong `this`
**Cause:** Arrows capture the enclosing scope, which is not the object literal. This
is the reverse of the problem this page solves.
**Fix:** Use method shorthand there. Arrows are for callbacks, not for object members
that need `this`.

## Interview questions

**★ How do you keep `this` when passing a method as a callback?**
Four options: **wrap at the call site** with an arrow (`() => this.m()`), which
leaves the method a plain prototype method and costs nothing; an **arrow class
field**, which binds permanently per instance; **`bind` in the constructor**, which
does the same and gives a stable identity; or `call`/`apply`/`thisArg` for a single
call. The call-site wrapper is the best default.

**★ Why can an arrow wrapper not be used with `removeEventListener`?**
Because removal matches by **function identity**, and every arrow expression creates
a new function object — so the one passed to `removeEventListener` is not the one
that was added, and the call silently does nothing. Store a single bound function and
pass it to both.

**★ What does `bind` actually return, and can it be re-bound?**
A **new function** whose `this` is permanently fixed. It cannot be re-bound — MDN:
*"bind only works once!"* — and `call`/`apply` cannot override it. Binding in a
constructor also creates an **own property** that shadows the prototype method.

**★ What is the cost of an arrow class field?**
One function object **per instance** instead of one shared on the prototype, and the
method is no longer on the prototype at all — so a subclass cannot override it
normally and `super` cannot reach it. Fine for a few instances and for
always-a-callback handlers; wrong for a class with thousands of instances or a real
extension surface.

**Why is `const self = this` no longer needed?**
Arrow functions capture `this` lexically, which is exactly what the `self` alias was
emulating. It still works and appears in older code, but there is no reason to write
it now.

**When should you use `thisArg`?**
Rarely. It exists on `forEach`, `map`, `filter`, `some`, `every`, `find`,
`findIndex` and `flatMap` — but **not** on `reduce`, `reduceRight` or `sort`, so it
is not a technique you can apply uniformly. An arrow function works everywhere.

---

← [How a method loses `this`](./01-how-methods-lose-this.md) · [Topic index](./README.md) · Next → [Phase index](../README.md)
