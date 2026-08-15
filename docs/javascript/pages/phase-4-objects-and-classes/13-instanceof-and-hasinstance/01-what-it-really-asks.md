---
title: "1 · What `instanceof` really asks"
sidebar_label: "1 · What it really asks"
sidebar_position: 1
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-14 against MDN — [`instanceof`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/instanceof), [`Symbol.hasInstance`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Symbol/hasInstance), [`Function.prototype.bind()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Function/bind), [`Object.prototype.isPrototypeOf()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/isPrototypeOf), [`Object.create()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/create), [Inheritance and the prototype chain](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Inheritance_and_the_prototype_chain), [Arrow functions](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Functions/Arrow_functions). Documentation-validated; **no timings**.

**`x instanceof C` does not ask "was `x` made by `C`". It asks: is the object `C.prototype`
anywhere in `x`'s prototype chain?**

Every surprising result on this page and the next follows from that one substitution. It is a
question about a *chain of objects*, not about origin, type or class membership.

```js
class Animal {}
class Dog extends Animal {}

const d = new Dog();
d instanceof Dog;      // true  — Dog.prototype is the first link
d instanceof Animal;   // true  — Animal.prototype is the second
d instanceof Object;   // true  — Object.prototype is the third
```

Written out, `instanceof` is this walk — see
[05 · The prototype chain](../05-the-prototype-chain/README.md) for the mechanism it reuses:

```js
function ordinaryInstanceOf(obj, Ctor) {
  const target = Ctor.prototype;
  let proto = Object.getPrototypeOf(obj);
  while (proto !== null) {
    if (proto === target) return true;
    proto = Object.getPrototypeOf(proto);
  }
  return false;
}
```

## The proof that it is about the chain, not about construction

```js
class User {}
const u = new User();

User.prototype = {};       // repoint the constructor's prototype
u instanceof User;         // 🔴 false — u was still made by User
```

Nothing about `u` changed. `User.prototype` is now a different object, and the operator compares
against whatever that property holds *at the moment you ask*. The reverse works too:

```js
const plain = {};
Object.setPrototypeOf(plain, User.prototype);
plain instanceof User;     // 🔴 true — never constructed, never touched by User
```

⚠️ **So `instanceof` is not a provenance check and cannot be used as one.** If you need to know
that a value came from a particular factory, record that yourself — a brand property, a `WeakSet`
of issued instances, a `#private` field checked in a static method.

## `Symbol.hasInstance` — the operator is a method call

Since ES2015 `instanceof` is not hard-wired. It looks for a `Symbol.hasInstance` method on the
right-hand side first, and only falls back to the chain walk if there is none:

```js
class Even {
  static [Symbol.hasInstance](value) {
    return typeof value === "number" && Number.isInteger(value) && value % 2 === 0;
  }
}

4 instanceof Even;      // true
5 instanceof Even;      // false
"4" instanceof Even;    // false
```

Two details that are easy to miss:

🔴 **The right-hand side does not have to be callable if it has the hook.** The method lookup
happens *before* the callable check, so a plain object works:

```js
const Positive = { [Symbol.hasInstance]: (v) => typeof v === "number" && v > 0 };
5 instanceof Positive;   // true — Positive is not a function at all
```

⚠️ **You cannot override the default globally.** `Function.prototype[Symbol.hasInstance]` is
non-writable and non-configurable, so it is per-class or nothing. That is deliberate — the default
behaviour of every ordinary function is not up for redefinition.

**Use it sparingly.** A `static [Symbol.hasInstance]` that answers a *structural* question is
legitimate and reads well at the call site. One that lies — returning `true` for things that are
not related — makes every `instanceof` in the codebase untrustworthy, and there is no way for a
reader to tell from the call site that the hook exists.

## The two `TypeError`s, and why they are different

```js
2 instanceof 5;          // 🔴 TypeError: Right-hand side of 'instanceof' is not callable
2 instanceof (() => {}); // 🔴 TypeError: Function has non-object prototype 'undefined'
```

The first is the right-hand side being neither callable nor equipped with `Symbol.hasInstance`.

The second is more interesting: **arrow functions have no `prototype` property**, so there is
nothing for the walk to compare against. The same applies to methods defined with shorthand syntax
and to generator-less concise methods — none of them are constructors, and `instanceof` against one
throws rather than returning `false`. The lesson is that a *failed* `instanceof` and an *invalid*
`instanceof` are different outcomes, and only one of them is a `boolean`.

## Primitives are always `false`

```js
"hello" instanceof String;   // false
42 instanceof Number;        // false
new String("hello") instanceof String;   // true
```

A primitive has no prototype chain of its own to walk — the wrapper object it is temporarily boxed
into during property access is not what the operator sees. **`typeof` is the check for primitives,
`instanceof` for objects**, and mixing them up is the usual reason a `typeof x === "object"` guard
sits in front of an `instanceof` that could never have been true anyway.

## Three chain edge cases worth recognising

**`Object.create(null)`** — a genuinely prototype-less object:

```js
const dict = Object.create(null);
dict instanceof Object;   // 🔴 false
```

Correct and useful: the chain is empty, so nothing is in it. This is the shape used for true
dictionaries, and it is also why a `null`-prototype object cannot be checked with `instanceof` at
all.

**Bound functions delegate.** `bind` produces a new function with no meaningful `prototype` of its
own, and the operator forwards to the bound target:

```js
class Point {}
const P = Point.bind(null);
new P() instanceof P;       // true — the check delegates to Point
new P() instanceof Point;   // true
```

**Subclass instances satisfy every ancestor**, which is the useful half of the whole feature and
the reason `err instanceof Error` works for `TypeError`, `RangeError` and your own subclasses — see
[Phase 8 · 03 · Errors and subclasses](../../phase-8-modules-errors/03-error-and-subclasses/README.md).

## `isPrototypeOf` — the same question, asked honestly

```js
Animal.prototype.isPrototypeOf(d);   // true
d instanceof Animal;                 // true — identical question
```

`isPrototypeOf` takes the **prototype object directly** instead of reaching through a constructor's
`.prototype` property. Two consequences: it works on prototype objects that have no constructor
function (an object-literal prototype used with `Object.create`), and it cannot be intercepted by
`Symbol.hasInstance`.

**Prefer `instanceof` for readability, reach for `isPrototypeOf` when there is no constructor to
name** — or when you specifically want the un-hookable version.

## Gotchas

**Symptom:** `x instanceof C` is `false` for an object `C` definitely created
**Cause:** `C.prototype` was reassigned after the object was made, so the chain no longer contains it.
**Fix:** Do not reassign `.prototype` on a constructor in use. Add methods to it instead.

**Symptom:** `TypeError: Function has non-object prototype 'undefined' in instanceof check`
**Cause:** The right-hand side is an arrow function or a shorthand method — neither has a `prototype`.
**Fix:** Use a real function or class on the right, or a `Symbol.hasInstance` hook.

**Symptom:** `TypeError: Right-hand side of 'instanceof' is not callable`
**Cause:** The right-hand side is a primitive or a plain object with no `Symbol.hasInstance`.
**Fix:** Check what you are passing — this is usually a variable holding an instance rather than a class.

**Symptom:** `"abc" instanceof String` is `false`
**Cause:** Primitives are never instances; only the boxed wrapper object is.
**Fix:** `typeof x === "string"` — and note it also catches the wrapper case if you use `typeof x === "string" || x instanceof String`.

**Symptom:** `instanceof Object` is `false` on a real object
**Cause:** It was made with `Object.create(null)`, so its chain is empty.
**Fix:** Expected. Use `typeof x === "object" && x !== null`, or `Object.prototype.hasOwnProperty.call(x, k)` for property checks.

**Symptom:** An `instanceof` check returns `true` for something unrelated
**Cause:** A `static [Symbol.hasInstance]` hook on the class is answering instead of the chain walk.
**Fix:** Read the class. The hook is invisible from the call site, which is why it should be rare.

**Symptom:** A `Symbol.hasInstance` override on `Function.prototype` silently did nothing
**Cause:** That property is non-writable and non-configurable by design.
**Fix:** Define the hook per class, as a `static` method.

## Interview questions

**★ What does `instanceof` actually check?**
Whether the object on the right's `.prototype` appears anywhere in the left operand's prototype
chain. It walks the chain link by link. It is not a check of what constructed the value.

**★ Can `instanceof` be `false` for an object a constructor definitely created?**
Yes. Reassign `C.prototype` after construction and existing instances stop matching, because the
operator compares against whatever `.prototype` holds when you ask. The inverse also works —
`Object.setPrototypeOf` on a plain object makes it pass without ever going near the constructor.

**★ What is `Symbol.hasInstance`?**
The hook `instanceof` consults before doing anything else. A class can define
`static [Symbol.hasInstance](value)` and completely replace the chain walk — which means the
right-hand side does not even have to be a function, since the method lookup happens before the
callable check. `Function.prototype`'s default is non-writable, so it cannot be overridden globally.

**★ Why does `x instanceof someArrowFunction` throw?**
Arrow functions have no `prototype` property, so there is nothing to compare the chain against. It
is a `TypeError`, not a `false` — an invalid check and a failed check are different outcomes.

**★ Why is `"hello" instanceof String` false?**
Primitives have no prototype chain of their own; the boxing that happens during property access is
transient and is not what the operator inspects. Use `typeof` for primitives.

**What is the difference between `instanceof` and `isPrototypeOf`?**
They ask the same question. `instanceof` reaches through a constructor's `.prototype` property and
can be intercepted by `Symbol.hasInstance`; `isPrototypeOf` is called on the prototype object
directly and cannot. Use the latter when there is no constructor function to name.

**Does `instanceof` work on a bound function?**
Yes. A bound function delegates the check to its target, so `new P() instanceof P` and
`new P() instanceof Point` are both `true` when `P = Point.bind(null)`.

---

← [Topic index](./README.md) · [Phase index](../README.md) · Next: [2 · Where it fails, and what to use instead](./02-where-it-fails.md) →
