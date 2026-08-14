---
title: "1 · The three levels, and how they fail"
sidebar_label: "1 · The three levels"
sidebar_position: 1
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-14 against MDN — [`Object.freeze()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/freeze), [`Object.seal()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/seal), [`Object.preventExtensions()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/preventExtensions), [`Object.isFrozen()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/isFrozen), [`Object.isSealed()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/isSealed), [`Object.isExtensible()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/isExtensible), [`Object.setPrototypeOf()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/setPrototypeOf), [Strict mode](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Strict_mode), [`delete`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/delete). Documentation-validated; **no timings**.

There are three levels of lockdown, and they differ in exactly two questions: **can the set of
properties change**, and **can their values change**.

| | add a property | delete a property | change a value | change the flags | change the prototype |
|---|---|---|---|---|---|
| *(nothing)* | ✅ | ✅ | ✅ | ✅ | ✅ |
| `Object.preventExtensions` | ❌ | ✅ | ✅ | ✅ | ❌ |
| `Object.seal` | ❌ | ❌ | ✅ | ❌ | ❌ |
| `Object.freeze` | ❌ | ❌ | ❌ | ❌ | ❌ |

Each level is the one above it plus one more restriction, so they nest: every frozen object is
sealed, and every sealed object is non-extensible.

```js
const o = { a: 1 };
Object.freeze(o);
Object.isFrozen(o);      // true
Object.isSealed(o);      // true  — freezing implies sealing
Object.isExtensible(o);  // false
```

## What each one actually sets

All three are [property descriptors](../11-property-descriptors.md) underneath, plus one internal
flag on the object itself. That is the whole mechanism — there is no separate "immutable" mode in
the engine.

| | `[[Extensible]]` | `configurable` | `writable` |
|---|---|---|---|
| `preventExtensions` | → `false` | untouched | untouched |
| `seal` | → `false` | → `false` on every own property | untouched |
| `freeze` | → `false` | → `false` on every own property | → `false` on every own **data** property |

Two consequences fall straight out of that table, and both surprise people:

🔴 **`freeze` cannot make an accessor property read-only**, because a getter/setter pair has no
`writable` flag to clear. Freezing an object with a setter leaves the setter installed and callable
— it just cannot be *replaced*. What that setter then does is entirely up to its body, which is
covered in [chunk 2](./02-what-freeze-cannot-reach.md).

⚠️ **`seal` leaves `writable: true`**, so a sealed object is a **fixed shape with mutable
contents**. That is a genuinely different tool from `freeze`, not a weaker version of it.

## The prototype gets locked too, and that is easy to miss

Setting `[[Extensible]]` to `false` also makes the object's prototype immutable:

```js
const o = Object.preventExtensions({});
Object.setPrototypeOf(o, Array.prototype);
// 🔴 TypeError: #<Object> is not extensible
```

So `preventExtensions` — which sounds like the mildest of the three — is already enough to stop
prototype swapping. This is the mechanism behind hardening `Object.prototype` itself against
pollution, which is **16 · Prototype patterns to avoid** *(not written yet)*.

## 🔴 The failure mode is silence, unless you are in strict mode

This is the single most important thing on the page, and it is the reason frozen objects earn a
reputation for "not working".

```js
// sloppy mode — a classic <script> tag, or a CommonJS file with no "use strict"
const config = Object.freeze({ retries: 3 });
config.retries = 99;      // no error
config.timeout = 1000;    // no error
delete config.retries;    // no error, returns false
config.retries;           // 3 — every one of those was a no-op
```

```js
// strict mode — every ES module, every class body
"use strict";
const config = Object.freeze({ retries: 3 });
config.retries = 99;   // 🔴 TypeError: Cannot assign to read only property 'retries' of object
config.timeout = 1000; // 🔴 TypeError: Cannot add property timeout, object is not extensible
delete config.retries; // 🔴 TypeError: Cannot delete property 'retries' of #<Object>
```

**Same object, same operations, opposite developer experience.** In sloppy mode a frozen object is
a bug detector that never reports; in strict mode it is a loud one.

**ES modules are always strict**, and so is every `class` body, so modern application code gets the
throwing behaviour for free. The silent version still shows up in three places worth naming: a
plain `<script>` (not `type="module"`), older CommonJS files without the pragma, and code eval'd
into a sloppy context.

⚠️ **Do not "fix" this by testing the assignment.** Reading the value back to see whether a write
landed is how people end up writing `if (o.x !== v) throw …` by hand. If you want failures to be
loud, the fix is strict mode — which you almost certainly already have.

## `isFrozen`, `isSealed`, and one answer that looks wrong

```js
Object.isFrozen({});                             // false — extensible, so not frozen
Object.isFrozen(Object.preventExtensions({}));   // 🔴 true
```

That second answer is correct and specified. The predicates ask *"is any forbidden operation still
possible?"*, and on an object with **no properties**, `preventExtensions` has already ruled out
every one of them — there is nothing left to write, delete or reconfigure. The same vacuous truth
makes `Object.isSealed(Object.preventExtensions({}))` return `true`.

The practical version: **`isFrozen` is not a record of which function you called.** It is a
computed answer about the object's current state, and two different calls can produce the same
`true`.

## Non-objects are accepted and returned unchanged

```js
Object.freeze(42);        // 42 — no error
Object.isFrozen(42);      // true
Object.freeze("hello");   // "hello"
```

Primitives are already immutable, so freezing one is a no-op that returns its argument. ⚠️ **This
changed:** under ES5 those calls threw a `TypeError`, and ES2015 relaxed them. Code written to
guard `typeof x === "object"` before freezing is defending against an engine nobody runs any more.

The corollary matters more than the trivia: **`Object.freeze` returns the object**, so it composes
in place —

```js
export const STATUS = Object.freeze({ IDLE: "idle", BUSY: "busy" });
```

## When `seal` is the right call, and it is not often

`freeze` is the default answer. `seal` earns its place in one specific shape: **a fixed set of
fields whose values must keep changing.**

```js
"use strict";
const state = Object.seal({ page: 1, query: "", loading: false });

state.page = 2;        // ✅ allowed — the point of sealing rather than freezing
state.pge = 3;         // 🔴 TypeError: Cannot add property pge, object is not extensible
```

That second line is the payoff: **a typo in a property name becomes an error instead of a new
property**. Without sealing, `state.pge = 3` silently succeeds and the bug surfaces somewhere else
entirely — usually as a value that "never updates".

`preventExtensions` alone is rarely what you want. It stops the typo but still allows `delete`, and
a shape you can delete from is not really a fixed shape.

## Gotchas

**Symptom:** A frozen object's properties change anyway, with no error
**Cause:** Sloppy mode — writes to non-writable properties are silent no-ops.
**Fix:** Run the code as an ES module or add `"use strict"`. The freeze was working; the report was missing.

**Symptom:** `TypeError: Cannot assign to read only property 'x' of object` appeared after a refactor
**Cause:** The file became an ES module, so previously silent no-ops now throw.
**Fix:** This is the freeze finally being enforced. Find the write and remove it — do not unfreeze.

**Symptom:** `Object.isFrozen(obj)` is `true` on an object that was never frozen
**Cause:** It has no own properties and is non-extensible, so nothing forbidden is possible.
**Fix:** Nothing — the predicate is about state, not about which call was made.

**Symptom:** A sealed object still lets values change
**Cause:** `seal` clears `configurable`, not `writable`. That is its purpose.
**Fix:** Use `freeze` if values must hold still too.

**Symptom:** `Object.setPrototypeOf` throws on an object you only called `preventExtensions` on
**Cause:** A non-extensible object has an immutable prototype — all three levels imply it.
**Fix:** Set the prototype before locking, or use `Object.create` to build it with the right one.

**Symptom:** `delete obj.x` returns `false` and the property is still there
**Cause:** The object is sealed or frozen, so every property is non-configurable.
**Fix:** In strict mode this throws instead, which is what you want. Do not branch on the return value.

**Symptom:** A guard like `if (typeof x === "object") Object.freeze(x)` looks unnecessary
**Cause:** It is — `Object.freeze` on a primitive returns it unchanged since ES2015.
**Fix:** Drop the guard.

## Interview questions

**★ What is the difference between `Object.freeze` and `Object.seal`?**
Both make the object non-extensible and every own property non-configurable — no adding, no
deleting, no reconfiguring. `freeze` additionally sets `writable: false` on every own data
property, so values cannot change either. `seal` is a fixed shape with mutable values; `freeze` is
a fixed shape with fixed values.

**★ What happens when you assign to a frozen object's property?**
It depends on the mode, which is why this bites. In sloppy mode the assignment is a silent no-op.
In strict mode — which includes every ES module and every class body — it throws
`TypeError: Cannot assign to read only property`.

**★ Does `Object.freeze` do anything that `const` does not?**
They protect different things. `const` freezes the *binding*: you cannot reassign the variable.
`Object.freeze` freezes the object's *own properties*: you cannot change them through any
reference. `const o = {}` still allows `o.x = 1`; a frozen object still allows the variable to be
reassigned if it was declared with `let`.

**★ Why is `Object.isFrozen(Object.preventExtensions({}))` true?**
Because the predicate asks whether any forbidden operation is still possible, and on an object with
no properties there are none. Non-extensible plus zero properties satisfies frozen vacuously.

**★ What does `Object.freeze` do in terms of property descriptors?**
It sets the object's `[[Extensible]]` to `false`, then `configurable: false` on every own property
and `writable: false` on every own data property. Accessor properties have no `writable` flag, so
their getters and setters remain installed and callable.

**When would you seal instead of freeze?**
When the shape must be fixed but the values must keep changing — a mutable state object where a
mistyped property name should be an error rather than a new field. That typo-catching is the main
reason to reach for `seal` at all.

**Can you unfreeze an object?**
No. Freezing sets `configurable: false`, which is irreversible, so there is no route back. The only
way to get a mutable version is to build a new object — a shallow copy via spread, or
`structuredClone` for a deep one. Both produce an unfrozen result.

---

← [Topic index](./README.md) · [Phase index](../README.md) · Next: [2 · Shallow — what freeze cannot reach](./02-what-freeze-cannot-reach.md) →
