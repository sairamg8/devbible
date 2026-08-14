---
title: "1 · Extending built-ins and monkey patching"
sidebar_label: "1 · Extending and patching"
sidebar_position: 1
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-14 against MDN — [Inheritance and the prototype chain](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Inheritance_and_the_prototype_chain), [`Object.defineProperty()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/defineProperty), [`Array.prototype.flat()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/flat), [`String.prototype.includes()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/includes), [`for...in`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/for...in), [`Object.setPrototypeOf()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/setPrototypeOf), [`Symbol`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Symbol); and the TC39 proposal history for `Array.prototype.flat`. Documentation-validated; **no timings**.

Adding to a built-in prototype looks like the most natural thing in the language. It is also the
one change whose blast radius is *every object of that type in the process* — yours, your
dependencies', and the platform's.

```js
Array.prototype.last = function () { return this[this.length - 1]; };
[1, 2, 3].last();   // 3 — and now every array everywhere has it
```

## Three ways that goes wrong

**1 · It shows up in `for...in`.** Assignment creates an **enumerable** property, so every
`for...in` over any array now yields `"last"`:

```js
for (const k in [1, 2]) console.log(k);   // "0", "1", "last"
```

Library code that iterates an array with `for...in` — older code does — now sees a phantom entry.
`Object.defineProperty` with `enumerable: false` avoids this specific symptom
([11 · Property descriptors](../11-property-descriptors.md)), and it is the minimum bar for any
prototype addition. It does not fix the other two.

**2 · You are competing with the standards committee for the name.** This is not hypothetical, and
it is the reason two methods in the language are named what they are:

- `Array.prototype.flatten` had to be **renamed to `flat`**, because MooTools shipped its own
  `flatten` on `Array.prototype` and the native version broke every site using that library. The
  incident is why the name is `flat`.
- `String.prototype.contains` became **`includes`** for the same reason — again MooTools.

🔴 **The lesson is not "MooTools was careless".** It is that a plausible name on a built-in
prototype is exactly the name the committee will eventually want, and the web cannot break, so
*your* name wins and the standard changes. That only works for a library big enough to matter; for
everyone else, the native method lands and silently replaces or conflicts with yours.

**3 · Two patchers, one property.** Whoever loads last wins, and nothing reports the collision. A
dependency patching the same method with different semantics produces behaviour that depends on
module load order — which is invisible in the source and can change with a bundler upgrade.

## The legitimate exception: a real polyfill

A polyfill implements the **specified** behaviour of a **specified** name, and only when it is
missing:

```js
if (!Array.prototype.at) {
  Object.defineProperty(Array.prototype, "at", {
    value: function at(n) { /* the spec's algorithm */ },
    writable: true, enumerable: false, configurable: true,   // matches a built-in's flags
  });
}
```

Three things make it legitimate: the **feature detection**, so a native implementation is never
overwritten; the **exact name and semantics**, so nothing diverges; and the **non-enumerable,
writable, configurable** flags, which is how every real built-in method is defined. Use a
maintained polyfill library rather than writing this by hand — the spec algorithms have edge cases
that are not obvious.

⚠️ **A "ponyfill" is safer still** — export the function, do not install it:

```js
export const at = (arr, n) => arr[n < 0 ? arr.length + n : n];
```

No global state, no collision, tree-shakeable, and the call site says where it came from.

## What to do instead

| Instead of | Do this |
|---|---|
| `Array.prototype.last = …` | a plain function: `last(arr)` |
| a "richer" `String` | a module of string helpers |
| adding methods to a library's class | wrap it, or compose — [14 · Object creation patterns](../14-object-creation-patterns/01-factory-constructor-class.md) |
| adding to `Object.prototype` | **nothing. Ever.** It reaches every object in the program |

**Subclassing a built-in is an option, with caveats.** `class Stack extends Array` works, and the
built-in methods that return new arrays return your subclass. But the instance is still an array to
every `Array.isArray` check, serialising loses the subclass, and the extra chain link buys little —
composition (an object *holding* an array) is usually clearer. The mechanics are in
[Phase 8 · 03 · Errors and subclasses](../../phase-8-modules-errors/03-error-and-subclasses/README.md),
where subclassing genuinely is the right answer.

## Monkey-patching functions you do not own

The same argument applies to replacing a function rather than adding one — `fetch`, `console.log`,
`JSON.parse`, a library's method. It is sometimes the only option (instrumentation, a test double, a
bug you cannot wait for upstream to fix), so the question is how to do it with the least damage:

```js
const originalFetch = globalThis.fetch;

globalThis.fetch = async function instrumentedFetch(...args) {
  const start = performance.now();
  try {
    return await originalFetch.apply(this, args);
  } finally {
    report(args[0], performance.now() - start);
  }
};
```

Rules that make a patch survivable:

- **Keep the original and always call through it.** A patch that reimplements is a fork.
- **`apply(this, args)`**, not `originalFetch(...args)` — a method patched on an object needs its
  receiver, and forwarding all arguments keeps you correct when the API gains a parameter.
- **Patch once**, at startup, in one named place. A patch applied twice wraps twice.
- **Name the function** (`instrumentedFetch`), so it appears in stack traces instead of `anonymous`
  — [Phase 3 · 19 · Function properties](../../phase-3-functions/19-function-properties.md).
- **Return what the original returns**, including the promise. Swallowing a rejection here is
  invisible everywhere.

🔴 **The real cost is not correctness, it is debuggability.** Every future engineer reading
`fetch(...)` sees the standard function and reasons about standard behaviour. Nothing at the call
site says otherwise. That is why instrumentation belongs in a wrapper module you import
(`import { fetch } from "./http"`) whenever you have the choice — the indirection is visible.

## And do not reassign `.prototype` or swap prototypes at runtime

```js
function User(name) { this.name = name; }
const u = new User("Ada");
User.prototype = { greet() {} };   // 🔴 u is no longer `instanceof User`
```

Existing instances keep the old object; `instanceof` compares against the new one
([13 · `instanceof`](../13-instanceof-and-hasinstance/01-what-it-really-asks.md)). Add to the
prototype, never replace it.

⚠️ **`Object.setPrototypeOf` on a live object is worse.** MDN documents it as a very slow operation
in every engine because it invalidates the shape-based optimisations property access depends on —
build the object with the right prototype instead ([14 · `Object.create`](../14-object-creation-patterns/02-object-create-and-dictionaries.md)).

## Gotchas

**Symptom:** A `for...in` loop over an array produced an unexpected key
**Cause:** Something added an enumerable property to `Array.prototype`.
**Fix:** Do not extend built-ins; if you must, use `Object.defineProperty` with `enumerable: false`. And prefer `for...of` over arrays.

**Symptom:** Code broke after a browser or Node upgrade, with no code change
**Cause:** A native method landed with the same name as a prototype extension, and the two differ.
**Fix:** Remove the extension. This is the history behind `flat` and `includes` being named that way.

**Symptom:** A patched method behaves differently depending on import order
**Cause:** Two patchers, one property. Last one loaded wins, silently.
**Fix:** Patch in exactly one place at startup, or do not patch at all.

**Symptom:** A `this`-using method broke after being wrapped
**Cause:** The wrapper called the original as a plain function, losing the receiver.
**Fix:** `original.apply(this, args)`.

**Symptom:** Stack traces are full of `anonymous`
**Cause:** The patch used an anonymous function expression.
**Fix:** Name it.

**Symptom:** Instances stopped satisfying `instanceof` their own constructor
**Cause:** `.prototype` was reassigned after they were created.
**Fix:** Add to the existing prototype; never replace it.

**Symptom:** A polyfill overwrote a working native implementation
**Cause:** No feature detection, or a truthiness check that a native method failed.
**Fix:** `if (!X.prototype.method)`, and prefer a maintained polyfill library.

## Interview questions

**★ Why should you not extend built-in prototypes?**
Three reasons. Assignment creates an enumerable property, so it appears in every `for...in`. You are
competing with TC39 for the name, and the web cannot break — so a native method arriving later
either conflicts with yours or forces the committee to rename theirs. And two libraries patching the
same name silently resolve by load order.

**★ Name a real case where this changed the language.**
`Array.prototype.flatten` was renamed to `flat` because MooTools had shipped its own `flatten` and
the native one broke sites using it. `String.prototype.contains` became `includes` for the same
reason. The names in the standard today are the scar tissue.

**★ When is adding to a built-in prototype acceptable?**
A genuine polyfill: feature-detected, implementing the specified name with the specified semantics,
defined with `enumerable: false, writable: true, configurable: true` to match a real built-in. A
ponyfill — exporting the function instead of installing it — is safer still.

**★ How do you monkey-patch a function responsibly?**
Keep a reference to the original and always call through it with `apply(this, args)`; patch exactly
once, at startup, in one named place; give the replacement a real name so stack traces are useful;
and return whatever the original returns, promises included. The lasting cost is that nothing at the
call site reveals the patch — which is why a wrapper module you import is better when you have the
choice.

**★ What breaks when you reassign a constructor's `.prototype`?**
Every instance created before the reassignment. `instanceof` compares against whatever `.prototype`
holds now, so those objects stop matching, while still having all their methods. Add to the
prototype rather than replacing it.

**Is subclassing a built-in a good alternative?**
Sometimes. `extends Array` works and array methods return your subclass, but the instance is still
an array to `Array.isArray`, serialisation loses the subclass, and the extra chain link rarely pays
for itself. `Error` is the case where subclassing genuinely is right.

**Why avoid `Object.setPrototypeOf` on an existing object?**
MDN documents it as very slow in every engine — changing an object's prototype invalidates the shape
optimisations that make property access fast. Create the object with the prototype it should have.

---

← [Topic index](./README.md) · [Phase index](../README.md) · Next: [2 · Prototype pollution](./02-prototype-pollution.md) →
