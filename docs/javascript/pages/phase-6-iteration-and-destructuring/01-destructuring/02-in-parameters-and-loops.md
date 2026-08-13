---
title: "01.2 · Destructuring in parameters and loops"
sidebar_label: "02 · In parameters and loops"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-13 against MDN — [Destructuring](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Destructuring), [Default parameters](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Functions/Default_parameters). Documentation-validated.

Where destructuring earns its place: **function signatures** and **loops**. Both turn a
positional or nested access into a named one at the point of use.

## The options object

```js
function whois({ displayName, fullName: { firstName: name } }) {
  return `${displayName} is ${name}`;
}

function drawChart({ size = "big", coords = { x: 0, y: 0 } } = {}) {
  console.log(size, coords);
}
```

MDN's second example carries the whole pattern, and the **`= {}` at the end is the part
people forget**:

```js
function f({ a } = {}) { … }
f();          // ✅ fine — the parameter defaults to {}, then `a` is undefined
function g({ a }) { … }
g();          // ❌ TypeError: Cannot destructure property 'a' of 'undefined'
```

Without it, calling with no argument destructures `undefined` and throws
([chunk 1](./01-the-patterns.md)). **Any destructured parameter that is optional needs
`= {}`.**

This is the answer to "JavaScript has no named arguments":

```js
createUser(name, email, true, false, null);            // ❌ unreadable at the call site
createUser({ name, email, admin: true, notify: false }); // ✅
```

The options object gives you order-independence, self-documenting call sites, and the
ability to add a parameter without touching existing callers. The cost is one allocation
per call and a slightly noisier signature — worth it beyond two or three parameters,
especially when several share a type.

Note the parameter list's own scoping rules still apply: defaults evaluate left to
right in a scope that is the **parent** of the body's, so a default cannot see a body
`var` — [Phase 3 · 08 · Block functions and parameters](../../phase-3-functions/08-hoisting-and-tdz/05-block-functions-and-parameters.md).

## Destructuring in a `for...of`

```js
for (const [key, value] of Object.entries(obj)) { … }
for (const [key, value] of map) { … }
for (const { id, name } of users) { … }
```

The first two are the everyday shapes. A `Map` yields `[key, value]` pairs directly, so
the array pattern matches it without an adapter — the reason
`for (const [k, v] of map)` reads so well, and one of `Map`'s ergonomic advantages from
[Phase 5 · 10](../../phase-5-built-in-library/10-map-vs-object/README.md).

The third destructures each element, which keeps the loop body free of `user.` prefixes.

**Skipping and renaming work here too:**

```js
for (const [, value] of Object.entries(obj)) { … }        // values only
for (const { id: userId, name } of users) { … }
```

## In callbacks

```js
items.map(({ id, name }) => ({ id, label: name }));
Object.entries(obj).map(([k, v]) => `${k}=${v}`);
promise.then(([a, b]) => …);                    // after Promise.all
```

`Promise.all` returning a positional array is the case where **array** destructuring is
genuinely right — the order is the order you passed in:

```js
const [user, posts, settings] = await Promise.all([
  fetchUser(id),
  fetchPosts(id),
  fetchSettings(id),
]);
```

That reads well and is the standard shape. Its hazard is that the names are bound purely
by position, so reordering the array silently reassigns them — a bug no type system
catches if the three have the same type.

## The destructuring-detaches-`this` trap

```js
const { start, stop } = timer;
start();   // ❌ TypeError — `this` is undefined
```

Destructuring is assignment, so it **detaches methods** exactly like
`const f = obj.f`. This is the fourth loss mode from
[Phase 4 · 07](../../phase-4-objects-and-classes/07-this-in-methods/01-how-methods-lose-this.md),
and it is why library APIs that expect to be destructured return closures rather than
`this`-dependent methods:

```js
const { get, set } = useStore();   // works only because these are closures
```

**Do not destructure methods off an object you did not design for it.**

## Function `length` and arity

A destructured parameter counts as **one** toward `fn.length`, and a parameter with a
default stops the count entirely — from
[Phase 3 · 02](../../phase-3-functions/02-parameters/README.md):

```js
(function ({ a, b }) {}).length;      // 1
(function ({ a } = {}) {}).length;    // 0
```

That matters for libraries that dispatch on arity — some middleware and test frameworks
inspect `fn.length` to decide whether to pass a callback. Adding `= {}` to a signature
silently changes its reported arity from 1 to 0.

## When not to destructure

- **When the object name carries meaning.** `event.target.value` says where the value
  came from; a bare `value` in a long function does not.
- **When the shape is uncertain.** Deeply nested destructuring of an API response throws
  on the first missing level; `data?.user?.name` degrades to `undefined`.
- **When you need the whole object too.** `const { id } = user` then also passing `user`
  reads worse than just using `user.id`.
- **For methods**, as above.

Destructuring is at its best when a **known** shape is being taken apart **once**, at the
top of a function or in a loop header. It is at its worst as a substitute for property
access scattered through a body.

## Gotchas

**Symptom:** `TypeError: Cannot destructure property 'x' of 'undefined'` when a function
is called with no arguments
**Cause:** A destructured parameter with no `= {}` default.
**Fix:** `function f({ a } = {}) { … }` — MDN's own `drawChart` example shows the shape.

**Symptom:** Destructured methods throw on `this`
**Cause:** Destructuring is assignment, so it detaches the method from its receiver.
**Fix:** Call through the object, or bind. APIs designed for destructuring return
closures.

**Symptom:** `Promise.all` results are assigned to the wrong names
**Cause:** Array destructuring binds by **position** only.
**Fix:** Keep the promise array and the destructuring pattern adjacent, and consider an
object of named promises for long lists.

**Symptom:** A library stopped passing a callback after `= {}` was added to a signature
**Cause:** A parameter with a default stops the `fn.length` count, so arity went from 1
to 0.
**Fix:** Check whether anything dispatches on `fn.length` before adding a default.

**Symptom:** A nested destructure of an API response crashes intermittently
**Cause:** An intermediate level is sometimes absent, so the inner pattern is applied to
`undefined`.
**Fix:** Default each risky level, or use optional chaining when the shape is uncertain.

**Symptom:** Code is harder to read after destructuring
**Cause:** The object name carried meaning that the bare binding does not.
**Fix:** Keep the property access. Destructuring is for known shapes taken apart once.

## Interview questions

**★ Why does `function f({ a }) {}` throw when called as `f()`?**
Because the parameter defaults to `undefined` and destructuring `undefined` is a
`TypeError`. The fix is `function f({ a } = {})` — MDN's `drawChart` example — so the
parameter falls back to an object before the pattern is applied.

**★ Why is an options object preferred over positional parameters?**
Order-independence, self-documenting call sites, and the ability to add a parameter
without touching callers — `createUser({ name, admin: true })` versus
`createUser(name, email, true, false, null)`. The cost is an allocation per call; worth
it past two or three parameters.

**★ What happens when you destructure methods off an object?**
They lose `this` — destructuring is assignment, so it detaches the method from its
receiver exactly like `const f = obj.f`. APIs meant to be destructured (`const { get } =
useStore()`) return **closures**, not `this`-dependent methods.

**★ When is array destructuring the right choice over object destructuring?**
When the source is genuinely positional — `Promise.all` results, `Object.entries` pairs,
`Map` iteration, a regex match array, or the swap idiom. Its hazard is that names bind by
position, so reordering silently reassigns them.

**How does destructuring affect `fn.length`?**
A destructured parameter counts as **1**, and any parameter with a default stops the
count — so `({a, b}) => {}` has length 1 and `({a} = {}) => {}` has length 0. Libraries
that dispatch on arity are affected by adding a default.

**When should you not destructure?**
When the object name carries meaning (`event.target.value`), when the shape is uncertain
(use optional chaining instead), when you also need the whole object, and for methods.

---

← [The patterns](./01-the-patterns.md) · [Topic index](./README.md) · Next → [Phase index](../README.md)
