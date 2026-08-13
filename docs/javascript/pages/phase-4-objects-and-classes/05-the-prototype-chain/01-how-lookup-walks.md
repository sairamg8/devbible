---
title: "05.1 · How lookup walks the chain"
sidebar_label: "01 · How lookup walks"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-13 against MDN — [Inheritance and the prototype chain](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Inheritance_and_the_prototype_chain). Documentation-validated.

**Every object has a hidden link to another object.** That is the whole of
JavaScript's inheritance model — no classes underneath, no copying of members, just
a chain of links that property lookup walks until it finds a name or runs out.

MDN: *"each object has an internal link to another object called its prototype. That
prototype object has a prototype of its own, and so on until an object is reached
with `null` as its prototype. This chain of linked objects is called the prototype
chain."*

The specification writes that link as `someObject.[[Prototype]]` — an **internal
slot**, not a property. MDN: it *"can be accessed and modified with
`Object.getPrototypeOf()` [and] `Object.setPrototypeOf()`"*, and *"is equivalent to
the non-standard `__proto__` accessor."*

## The lookup algorithm, in MDN's own example

```js
const o = {
  a: 1,
  b: 2,
  __proto__: {
    b: 3,
    c: 4,
  },
};

// o.[[Prototype]] has properties b and c.
// o.[[Prototype]].[[Prototype]] is Object.prototype
// o.[[Prototype]].[[Prototype]].[[Prototype]] is null

console.log(o.a); // 1
console.log(o.b); // 2  ← the prototype's b is NOT visited: property shadowing
console.log(o.c); // 4  ← found one level up
console.log(o.d); // undefined ← walked to null, gave up
```

The algorithm is exactly what it looks like:

1. Does the object have this as an **own** property? If yes, stop — return it.
2. If no, move to `[[Prototype]]` and ask the same question.
3. Repeat until an object has it, or until `[[Prototype]]` is `null`.
4. If `null` was reached, **return `undefined`**.

MDN on the terminator: *"`null` has no prototype and acts as the final link in the
prototype chain. Once `null` is reached, the property is considered not to exist and
`undefined` is returned."*

**Two consequences worth extracting:**

- **The first match wins, and own properties are always first.** `o.b` is `2` even
  though the prototype also has a `b`. MDN names this **property shadowing** — the
  nearer binding hides the further one. Nothing was overwritten; the prototype's `b`
  is still `3` and still reachable via `Object.getPrototypeOf(o).b`.
- **A missing property costs a full walk.** `o.d` returned `undefined` only after
  visiting `o`, its prototype, `Object.prototype`, and finding `null`. MDN notes
  this directly: *"Accessing non-existent properties traverses the entire chain."*
  Testing for absence in a hot loop is not free.

## Why every plain object already has methods

```js
const o = {};
o.toString;       // function — from Object.prototype
o.hasOwnProperty; // function — from Object.prototype
```

An object literal's chain is `o ---> Object.prototype ---> null`, so everything on
`Object.prototype` is reachable from every object you create. That is why
`{}.toString()` works, and why `"toString" in {}` is `true` while
`Object.hasOwn({}, "toString")` is `false` — the distinction from
[03 · `in` and `Object.hasOwn`](../03-existence-checks-and-delete/01-in-and-hasown.md).

It is also why `Object.create(null)` is the right shape for a dictionary of
untrusted keys: cut the chain at the start and nothing is inherited to collide with.

The same applies to every built-in. An array's chain is
`arr ---> Array.prototype ---> Object.prototype ---> null`, which is where `map`,
`filter` and `push` live — **not** on the array itself. That is why
`Object.keys(arr)` shows only the indices and `length`, and why spreading an array
into an object gives you no methods.

## `this` is resolved at the call site, not where the method lives

This is where the chain stops being trivia and starts mattering:

```js
const parent = {
  value: 2,
  method() {
    return this.value + 1;
  },
};

const child = {
  __proto__: parent,
};

console.log(child.method()); // 3
```

`method` was **found on `parent`**, but `this` is `child`, because `this` comes from
the object the method was called *on*. So `this.value` restarts the lookup from
`child`, misses, and finds `parent.value` — giving `3`.

MDN's own commentary: *"When `child.method` is called, `this` refers to `child`. The
property `value` is sought on `child`, not found, so it's found on `parent`."*

**Two lookups happen in one expression**, and they can land in different places: the
method comes from one level of the chain, and each property the method touches is
resolved separately from the receiver. Hold those apart and inherited methods stop
being confusing — it is the same rule as
[Phase 3 · 03 · `this`](../../phase-3-functions/03-this/README.md), applied along a
chain.

## Reading a chain

Two ways to see it, and one of them is deprecated:

```js
Object.getPrototypeOf(obj)   // ✅ the standard accessor
obj.__proto__                // ⚠️ the legacy accessor — works, but deprecated
```

`__proto__` is an accessor property inherited from `Object.prototype`, kept for web
compatibility. It works everywhere and reads more easily, which is why it is still
common — but it is **absent on null-prototype objects**, so code that relies on it
breaks exactly where dictionaries are safest. Prefer `Object.getPrototypeOf`.

Walking a chain to the end, when debugging:

```js
let p = obj;
while ((p = Object.getPrototypeOf(p))) console.log(p);
```

The loop terminates because `null` is falsy — the chain's terminator doing double
duty.

## Gotchas

**Symptom:** An object "has" a property nobody assigned to it — `toString`,
`constructor`, `valueOf`
**Cause:** It inherits from `Object.prototype`, which is the default end of every
plain object's chain.
**Fix:** Check with `Object.hasOwn` rather than `in` or truthiness. For a dictionary
of untrusted keys, `Object.create(null)`.

**Symptom:** Changing a property on one object did not affect another that
"inherits" it
**Cause:** The read found a shadowing **own** property first. The prototype's value
is unchanged and still reachable via `Object.getPrototypeOf`.
**Fix:** Expected behaviour. If you meant to change the shared value, assign to the
prototype explicitly — and consider whether shared mutable state is what you want.

**Symptom:** A method inherited from a prototype reads `undefined` for a property
that clearly exists
**Cause:** `this` is the **receiver**, not the object the method was found on. The
property is being sought from the caller's object, not from the prototype.
**Fix:** Check what `this` actually is at the call site. A detached method
(`const m = obj.method; m()`) has lost its receiver entirely.

**Symptom:** `obj.__proto__` is `undefined` on an object you built as a dictionary
**Cause:** `__proto__` is an accessor **inherited** from `Object.prototype`, so a
null-prototype object does not have it.
**Fix:** `Object.getPrototypeOf(obj)`, which is the standard accessor and works on
everything.

**Symptom:** A hot loop testing for missing properties is slower than expected
**Cause:** MDN: *"Accessing non-existent properties traverses the entire chain."* A
miss is the most expensive lookup, not the cheapest.
**Fix:** Hoist the check, use a `Map` for genuine lookups, or restructure so the
common path is a hit.

## Interview questions

**★ What is the prototype chain?**
Every object has an internal `[[Prototype]]` link to another object; that object has
its own, and so on until one has `null`. Property lookup walks the chain, returning
the **first** match, and returns `undefined` if it reaches `null`. That walk is
JavaScript's entire inheritance mechanism — nothing is copied onto instances.

**★ What happens when you read a property that does not exist?**
The engine checks the object, then each prototype in turn, and on reaching `null`
returns `undefined`. So a **miss is the most expensive lookup** — MDN notes it
*"traverses the entire chain"* — which is the opposite of most people's intuition.

**★ What is property shadowing?**
An own property hiding a same-named property further up the chain. `o.b` returns the
own `2` even though the prototype has `b: 3`. Nothing is overwritten; the prototype's
value is untouched and still reachable via `Object.getPrototypeOf(o).b`.

**★ In an inherited method, what is `this`?**
The object the method was **called on**, not the object it was found on. So a method
living on `parent` and called as `child.method()` has `this === child`, and every
property it reads restarts the lookup from `child`. Two lookups — finding the
method, and resolving each property — and they can land at different levels.

**Why does every object have `toString`?**
Because a plain object's chain ends `obj ---> Object.prototype ---> null`, and
`toString` lives on `Object.prototype`. `Object.create(null)` opts out, which is why
such objects throw on string conversion.

**Difference between `Object.getPrototypeOf(o)` and `o.__proto__`?**
They read the same internal slot, but `__proto__` is a **deprecated accessor
inherited from `Object.prototype`**, so it is absent on null-prototype objects.
`Object.getPrototypeOf` is the standard function and works on everything.

---

[Topic index](./README.md) · Next → [`prototype` vs `[[Prototype]]`](./02-prototype-vs-the-slot.md)
