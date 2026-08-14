---
title: "11 · Property descriptors"
sidebar_label: "11 · Property descriptors"
sidebar_position: 11
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-14 against MDN — [`Object.defineProperty()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/defineProperty), [`Object.defineProperties()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/defineProperties), [`Object.getOwnPropertyDescriptor()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/getOwnPropertyDescriptor), [`Object.getOwnPropertyDescriptors()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/getOwnPropertyDescriptors), [`Object.getOwnPropertyNames()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/getOwnPropertyNames), [Enumerability and ownership of properties](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Enumerability_and_ownership_of_properties), [`delete`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/delete), [Classes guide](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Using_classes), [Strict mode](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Strict_mode). Documentation-validated; **no timings**.

**Every property carries three or four hidden flags**, and reading them explains a surprising
number of "why did that not show up" bugs.

```js
const user = { name: "Ada" };
Object.getOwnPropertyDescriptor(user, "name");
// { value: "Ada", writable: true, enumerable: true, configurable: true }
```

There are two kinds of descriptor and they do not mix:

| | Data property | Accessor property |
|---|---|---|
| the value | `value`, `writable` | `get`, `set` |
| shared flags | `enumerable`, `configurable` | `enumerable`, `configurable` |

🔴 **A property is one or the other, never both.** Redefining a data property with `get` converts
it — you cannot have a `value` and a `get`, and trying throws `TypeError: Invalid property
descriptor`.

## The default that catches everyone

```js
const a = {};
a.x = 1;                                  // all three flags TRUE
Object.defineProperty(a, "y", { value: 2 });   // 🔴 all three flags FALSE

Object.keys(a);            // ["x"]        — y is not enumerable
a.y = 99; a.y;             // 2            — y is not writable
delete a.y;                // false        — y is not configurable
```

🔴 **Assignment gives you `true, true, true`. `defineProperty` gives you `false, false, false`.**
Every omitted flag defaults to `false`, so a property added with `defineProperty` is invisible to
`Object.keys`, spread and `JSON.stringify`, silently rejects writes, and can never be redefined or
deleted.

**Say what you mean, every time:**

```js
Object.defineProperty(a, "y", {
  value: 2, writable: true, enumerable: true, configurable: true,
});
```

⚠️ **The defaults are different for an *existing* property.** `defineProperty` on a property that
already exists changes only the fields you pass and leaves the rest as they were — so the
false-by-default rule applies to *creation* only. Knowing which case you are in is the difference
between a tweak and a lockdown.

## `writable` — and where it stops

```js
"use strict";
Object.defineProperty(config, "version", { value: "1.0", enumerable: true });

config.version = "2.0";   // 🔴 TypeError: Cannot assign to read only property
```

In sloppy mode the assignment is a **silent no-op**, which is how a "constant" quietly fails to
take effect. Modules are always strict, so in modern code you get the error.

⚠️ **`writable: false` protects the binding, not the contents.** A non-writable property holding an
object still lets you mutate that object — you just cannot replace it. That is the same shallowness
that makes `Object.freeze` shallow: [12 · `Object.freeze` and `seal`](./12-freeze-and-seal/README.md).

## `enumerable` — the flag that decides what "the properties" means

Non-enumerable properties are skipped by everything that walks an object casually:

| Sees non-enumerable? | |
|---|---|
| `Object.keys` / `values` / `entries` | ❌ |
| `for...in` | ❌ |
| spread `{...o}` and `Object.assign` | ❌ |
| `JSON.stringify` | ❌ |
| `Object.getOwnPropertyNames` | ✅ |
| `Object.hasOwn` and the `in` operator | ✅ |
| direct access `o.x` | ✅ |

🔴 **This is why `for...in` over a class instance does not list its methods.** Class methods are
defined on the prototype as **non-enumerable**, deliberately — so iterating an instance gives you
its data and not its behaviour. An object literal's methods *are* enumerable, so the same loop over
a literal lists them. The two shapes behave oppositely, exactly as with getters in
[10 · Getters and setters](./10-getters-and-setters.md).

**Use it for anything that should exist but not participate**: a cached value, a back-reference to
a parent, a library's bookkeeping property. It keeps `JSON.stringify` output clean without
requiring a `toJSON`.

⚠️ **It is not privacy.** `getOwnPropertyNames`, `Reflect.ownKeys` and devtools all show it. For
actual privacy use `#private` fields.

## `configurable` — the one-way door

`configurable: false` means the property cannot be deleted, and its flags cannot be changed:

```js
Object.defineProperty(o, "id", { value: 1, writable: true });
delete o.id;                                        // false (TypeError in strict mode)
Object.defineProperty(o, "id", { enumerable: true }); // 🔴 TypeError: Cannot redefine property: id
```

🔴 **It is irreversible.** There is no way back to `configurable: true`, so it is the one flag
worth thinking twice about — a property locked by mistake stays locked for the life of the object.

Two exceptions worth knowing, because they look like bugs:

- **`writable` can still be turned from `true` to `false`** on a non-configurable data property.
  That direction only tightens, so the spec allows it. The reverse throws.
- **The `value` can still be changed** while `writable` is `true`. Non-configurable does not mean
  constant; it means the *shape* is fixed.

## Reading and copying descriptors

```js
Object.getOwnPropertyDescriptors(source);   // every own property, including symbols and accessors
```

The plural form exists for exactly one job — **a copy that preserves accessors and flags**, which
spread and `Object.assign` cannot do because they read values and write plain data properties:

```js
const clone = Object.create(
  Object.getPrototypeOf(source),
  Object.getOwnPropertyDescriptors(source),
);
```

⚠️ **This is still a shallow copy.** Nested objects are shared; it preserves *property shape*, not
value independence. Deep copying is [04 · Shallow vs deep copy](./04-shallow-vs-deep-copy/README.md).

`Object.defineProperties(obj, descriptorMap)` is the bulk form, and is what `Object.create`'s
second argument takes.

## Where this actually shows up

**Making a value genuinely constant.** `const` protects the *binding*; a non-writable,
non-configurable property protects the *property*. They are different guarantees and you often want
both.

**Hiding bookkeeping.** A parent reference or memo cache added as non-enumerable stays out of
serialisation and out of every diff.

**Framework internals.** Vue 2's reactivity was built by walking a data object and replacing each
property with an accessor via `defineProperty` — which is also why it could not detect properties
added later, and why Vue 3 moved to `Proxy`. That limitation *is* the descriptor model: you can
redefine the properties that exist, and nothing tells you about ones that do not.
**19 · `Proxy` and `Reflect`** *(not written yet)* is the other half of that story.

**Understanding built-ins.** `Array.prototype.length` is `writable: true, enumerable: false,
configurable: false` — which is why assigning to `length` truncates an array but `Object.keys`
never lists it.

## Gotchas

**Symptom:** A property added with `defineProperty` is missing from `Object.keys` or JSON
**Cause:** `enumerable` defaults to `false` on creation.
**Fix:** Pass all four flags explicitly.

**Symptom:** An assignment to a defined property does nothing, silently
**Cause:** `writable: false` in sloppy mode.
**Fix:** Pass `writable: true` — and note a module would have thrown a `TypeError` instead.

**Symptom:** `TypeError: Cannot redefine property: x`
**Cause:** The property is non-configurable, which is permanent.
**Fix:** None after the fact. Decide `configurable` deliberately at creation.

**Symptom:** `delete` returned `false` and the property is still there
**Cause:** Non-configurable. In strict mode it throws instead.
**Fix:** Same — the flag is the decision.

**Symptom:** `TypeError: Invalid property descriptor`
**Cause:** A descriptor mixing `value`/`writable` with `get`/`set`.
**Fix:** Pick one kind — a property is data or accessor, never both.

**Symptom:** `for...in` over a class instance does not list its methods
**Cause:** Class methods are non-enumerable on the prototype, by design.
**Fix:** Nothing — and note the same loop over an object literal *does* list them.

**Symptom:** A non-writable property's object still got mutated
**Cause:** `writable` protects the binding, not the referenced object.
**Fix:** Freeze the nested object too, or hand out a copy.

**Symptom:** A spread copy lost a property's flags and accessors
**Cause:** Spread reads values and writes plain enumerable data properties.
**Fix:** `Object.create(Object.getPrototypeOf(o), Object.getOwnPropertyDescriptors(o))`.

**Symptom:** A reactivity system did not notice a property added later
**Cause:** `defineProperty` can only instrument properties that already exist.
**Fix:** A `Proxy`, which intercepts the operation rather than the property.

## Interview questions

**★ What is a property descriptor?**
The set of flags behind every property. Data properties have `value` and `writable`; accessor
properties have `get` and `set`; both have `enumerable` and `configurable`. A property is one kind
or the other, never both.

**★ What is the difference between `obj.x = 1` and `Object.defineProperty(obj, "x", { value: 1 })`?**
The flags. Assignment creates the property with `writable`, `enumerable` and `configurable` all
`true`; `defineProperty` defaults every omitted flag to `false`, so the property is read-only,
invisible to `Object.keys`, spread and `JSON.stringify`, and can never be deleted or redefined.

**★ What does `enumerable: false` actually hide the property from?**
`Object.keys`/`values`/`entries`, `for...in`, spread, `Object.assign` and `JSON.stringify`. It is
still visible to `getOwnPropertyNames`, `Reflect.ownKeys`, `in`, `Object.hasOwn` and direct access
— so it is a visibility choice, not privacy.

**★ Why does `for...in` over a class instance not show its methods?**
Because class methods are defined on the prototype as non-enumerable. An object literal's methods
are enumerable, so the same loop over a literal does list them.

**★ Why is `configurable` the flag to think hardest about?**
It is irreversible. Once `false`, the property cannot be deleted and its flags cannot be changed —
there is no route back. Two exceptions look like bugs but are specified: `writable` may still go
`true → false`, and the value may still change while `writable` is `true`.

**★ How do you copy an object without losing its getters and flags?**
`Object.create(Object.getPrototypeOf(o), Object.getOwnPropertyDescriptors(o))`. Spread and
`Object.assign` read values and write plain data properties, so accessors are flattened and flags
are reset.

**★ What is `defineProperty` used for in real libraries?**
Constants that assignment cannot overwrite, non-enumerable bookkeeping that stays out of
serialisation, and property-level instrumentation — Vue 2's reactivity was built on it. Its limit
is that it can only instrument properties that already exist, which is why `Proxy` replaced it.

**Does `const` make an object property constant?**
No. `const` freezes the *binding* — you cannot reassign the variable. Property-level immutability
is `writable: false` plus `configurable: false`, and even that protects only the binding, not the
referenced object's contents.

---

← [10 · Getters and setters](./10-getters-and-setters.md) · [Phase index](./README.md) · Next: [12 · `Object.freeze` and `seal`](./12-freeze-and-seal/README.md) →
