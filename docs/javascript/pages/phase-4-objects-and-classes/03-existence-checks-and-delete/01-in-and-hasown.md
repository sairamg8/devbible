---
title: "03.1 · `in` and `Object.hasOwn`"
sidebar_label: "01 · in and Object.hasOwn"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-13 against MDN — [`in`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/in), [`Object.hasOwn`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/hasOwn), [`Object.prototype.hasOwnProperty`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/hasOwnProperty). Documentation-validated.

**"Does this object have that property?" has four answers, and they disagree on
purpose.** They differ on two axes. This chunk is the first axis — **does the
prototype chain count?** — which is where `in`, `Object.hasOwn` and
`hasOwnProperty` part company.

| Check | Own | Inherited | Exists but `undefined` |
|---|---|---|---|
| `"k" in obj` | ✅ | ✅ **yes** | ✅ |
| `Object.hasOwn(obj, "k")` | ✅ | ❌ | ✅ |
| `obj.hasOwnProperty("k")` | ✅ | ❌ | ✅ |
| `obj.k !== undefined` | ✅ | ✅ | ❌ |

The fourth row is the second axis, and it is
[chunk 2](./02-undefined-holes-and-brand-checks.md).

## `in` — own *or* inherited

```js
const ages = { alice: 18, bob: 27 };

function hasPerson(name) {
  return name in ages;
}

hasPerson("hasOwnProperty"); // true — inherited from Object.prototype
```

That is MDN's own example, and it is the entire argument against `in` for
dictionary lookups. `ages` has no person called `hasOwnProperty`, but `in` walks
the prototype chain and finds `Object.prototype.hasOwnProperty`. So does
`"toString" in ages`, `"constructor" in ages`, `"valueOf"`, and every other name on
`Object.prototype`.

**If the key comes from user input, `in` is a bug.** A user named `constructor`
gets a `true` from a dictionary that never heard of them — and depending on what
you do next, that is an authorisation check passing on a name nobody registered.
MDN's own remedy is on the same page: *"To check only own properties, use
`Object.hasOwn()`."*

### Where `in` is exactly right

Checking for a **capability** rather than a data key, where inherited absolutely
should count:

```js
if ("scrollBehavior" in document.documentElement.style) { /* feature detection */ }
if ("then" in value) { /* thenable — promise-like */ }
if ("IntersectionObserver" in window) { /* API availability */ }
```

Feature detection is the canonical `in` use case: a DOM method lives on the
prototype, so `Object.hasOwn` would return `false` for every one of them. The rule
of thumb — **`in` for behaviour, `hasOwn` for data.**

### `in` throws on primitives

```js
const color1 = new String("green");
"length" in color1; // true

const color2 = "coral";
"length" in color2; // TypeError: cannot use 'in' operator to search for 'x' in 'y'
```

`in` requires an object on the right. A primitive string is not one — and unlike
property *access*, which auto-boxes, `in` does not. So `"length" in someString`
throws while `someString.length` works fine.

This bites when a value that is usually an object is occasionally a string, which
describes most things coming out of an API. `Object.hasOwn` does not have the
problem: it coerces its first argument to an object, so
`Object.hasOwn("coral", "length")` is `true` rather than an exception.

`in` on `null` or `undefined` throws too, for the same reason — so a `?.` guard
does not help you here, and the check itself needs guarding.

## `Object.hasOwn` — the modern default

```js
const example = {};
example.prop = "exists";

Object.hasOwn(example, "prop");            // true
Object.hasOwn(example, "toString");        // false
Object.hasOwn(example, "hasOwnProperty");  // false

"prop" in example;                         // true
"toString" in example;                     // true
"hasOwnProperty" in example;               // true
```

**This is the one to reach for by default.** MDN recommends it explicitly over
`hasOwnProperty`, *"because it works for null-prototype objects and with objects
that have overridden the inherited `hasOwnProperty()` method."*

Those are two distinct cases, and both are cases where the idiom of the previous
fifteen years is actively broken.

### Broken case 1 — a null-prototype object has no such method

```js
const foo = Object.create(null);
foo.prop = "exists";

foo.hasOwnProperty("prop");
// Uncaught TypeError: foo.hasOwnProperty is not a function

Object.hasOwn(foo, "prop"); // true
```

Note the trap this closes: `Object.create(null)` is the recommended shape for a
dictionary of untrusted keys (see
[01 · `__proto__` and null-prototype objects](../01-object-literals/04-proto-and-null-prototype.md)),
and own-property checking is exactly what you do with such a dictionary. **The two
techniques you would naturally combine are the two that do not work together** —
unless the check is `Object.hasOwn`.

### Broken case 2 — the object shadowed the method

```js
const foo = {
  hasOwnProperty() {
    return false;
  },
  bar: "The dragons be out of office",
};

foo.hasOwnProperty("bar");   // false  ← lies
Object.hasOwn(foo, "bar");   // true
```

`obj.hasOwnProperty(k)` is an ordinary property lookup **on `obj`**, so the object
gets to decide what it means. It can override it accidentally, or deliberately if
the object came from somewhere untrusted — and parsing JSON containing a
`"hasOwnProperty"` key is enough to arm this.

`Object.hasOwn` is a **static** method on `Object`. The object being tested has no
say in it, which is the whole point.

The old workaround was `Object.prototype.hasOwnProperty.call(obj, prop)`, which
does work, but MDN's assessment is that `Object.hasOwn()` is *"more intuitive and
concise."* `Object.hasOwn` is ES2022, so the `.call` form remains the fallback for
a pre-2022 runtime — every current runtime has the static method.

## Choosing between the three

- **`Object.hasOwn(obj, key)`** — default for data. Own-only, safe on
  null-prototype objects, immune to shadowing, coerces primitives instead of
  throwing.
- **`key in obj`** — feature and capability detection, where inherited members
  *should* count. Never for user-supplied keys, never on a value that might be a
  primitive.
- **`obj.hasOwnProperty(key)`** — legacy. MDN recommends `Object.hasOwn` instead.
  Keep `Object.prototype.hasOwnProperty.call(obj, key)` for old runtimes only.

## Gotchas

**Symptom:** A dictionary lookup returns `true` for a key nobody added — `toString`,
`constructor`, `hasOwnProperty`
**Cause:** `in` walks the prototype chain. MDN's example:
`hasPerson("hasOwnProperty")` is `true`.
**Fix:** `Object.hasOwn(obj, key)`. MDN: *"To check only own properties, use
`Object.hasOwn()`."*

**Symptom:** `TypeError: foo.hasOwnProperty is not a function`
**Cause:** The object was created with `Object.create(null)` and inherits nothing.
**Fix:** `Object.hasOwn(foo, prop)` — a static method that needs nothing from the
object.

**Symptom:** `hasOwnProperty` returns `false` for a property that is plainly there
**Cause:** The object has its **own** `hasOwnProperty` shadowing the inherited one —
MDN's example returns `false` for a key whose value sits right beside it. Parsed
JSON can introduce this.
**Fix:** `Object.hasOwn`, or `Object.prototype.hasOwnProperty.call(obj, prop)`.

**Symptom:** `TypeError: cannot use 'in' operator to search for 'x' in 'y'`
**Cause:** The right operand is a primitive, `null` or `undefined`. `in` requires an
object and does not auto-box, unlike property access.
**Fix:** `Object.hasOwn`, which coerces — or guard with
`typeof v === "object" && v !== null` first.

**Symptom:** A feature-detection check returns `false` for a DOM API that exists
**Cause:** It used `Object.hasOwn`. DOM methods live on the prototype, so own-only
checks miss all of them.
**Fix:** `in` is the correct operator for capability detection. This is the one
place the prototype chain is what you want.

## Interview questions

**★ Difference between `in` and `hasOwnProperty`?**
`in` returns `true` for **inherited** properties as well as own ones;
`hasOwnProperty` is own-only. So `"toString" in {}` is `true` while
`{}.hasOwnProperty("toString")` is `false`. Use `in` for feature detection and
own-checks for data — and prefer `Object.hasOwn` to `hasOwnProperty`.

**★ Why is `Object.hasOwn` preferred over `obj.hasOwnProperty()`?**
Two documented reasons. It works on **null-prototype objects**, which do not
inherit the method at all and throw `TypeError`; and it works on objects that have
**overridden** `hasOwnProperty`, which parsed JSON can introduce. It is a static
method, so the object under test cannot interfere with the answer.

**★ Why does `"length" in "coral"` throw?**
`in` requires an object on the right-hand side and does **not** auto-box primitives,
even though property access does. `new String("green")` is an object and works; the
primitive throws. `Object.hasOwn` coerces its argument, so it does not.

**When is `in` the right choice rather than `Object.hasOwn`?**
Feature and capability detection — `"IntersectionObserver" in window`,
`"then" in value` — where the thing you are looking for lives on a prototype and
inheritance is exactly what you want to detect. Never for keys that came from a
user.

**How would you write an own-property check that works on every runtime and every
object?**
`Object.hasOwn(obj, key)` where available; otherwise
`Object.prototype.hasOwnProperty.call(obj, key)`, which bypasses both the
null-prototype and the shadowing problem by not looking the method up on the object
at all.

---

[Topic index](./README.md) · Next → [`undefined`, holes and brand checks](./02-undefined-holes-and-brand-checks.md)
