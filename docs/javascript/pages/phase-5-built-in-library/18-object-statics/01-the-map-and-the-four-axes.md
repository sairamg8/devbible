---
title: "1 · The map, and the four axes"
sidebar_label: "1 · The map and the four axes"
sidebar_position: 1
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-15 against MDN — [`Object`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object), [`Object.prototype`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/prototype), [`Object.keys()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/keys), [`Object.hasOwn()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/hasOwn), [`Object.prototype.hasOwnProperty()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/hasOwnProperty), [`Object.create()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/create), [`Object.assign()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/assign), [`Object.is()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/is), [Enumerability and ownership of properties](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Enumerability_and_ownership_of_properties), [`for...in`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/for...in). Documentation-validated; **no timings**.

## Why they are statics at all

Every other built-in puts its behaviour on the prototype: `"a".toUpperCase()`,
`[1].map()`, `new Map().get()`. `Object` almost never does. You write
`Object.keys(user)`, not `user.keys()`.

**That is deliberate, and there are two reasons.**

🔴 **Reason one — `Object.prototype` is inherited by nearly everything.** A method
added there appears on every object literal, every array, every class instance in the
program. Worse, a *writable, enumerable* addition there shows up in every `for...in`
loop in every library you did not write:

```js
Object.prototype.keys = function () {};   // 🔴 never do this
for (const k in { a: 1 }) console.log(k); // a, keys  — every loop everywhere breaks
```

So the design rule is: **the `Object` namespace grows, `Object.prototype` does not.**
Nothing has been added to `Object.prototype` in decades of language evolution, while
`Object` itself has gained `assign`, `entries`, `fromEntries`, `hasOwn`, `groupBy` and
more. The details of what a rogue `Object.prototype` addition breaks are in
[Phase 4 · 16 · 02 · Prototype pollution](../../phase-4-objects-and-classes/16-prototype-patterns-to-avoid/02-prototype-pollution.md).

**Reason two — a static works on objects that cannot receive a method.** Two cases,
and both are common:

```js
const dict = Object.create(null);
dict.hasOwnProperty("x");   // 🔴 TypeError — not a function; there is no prototype
Object.hasOwn(dict, "x");   // ✅ false — the static does not care about the chain

const evil = JSON.parse('{"hasOwnProperty": 1}');
evil.hasOwnProperty("a");   // 🔴 TypeError — 1 is not a function; the data shadowed it
Object.hasOwn(evil, "a");   // ✅ false
```

⚠️ **This is exactly why `Object.hasOwn` was added** to replace
`Object.prototype.hasOwnProperty.call(obj, key)` — the incantation existed only to
route around a method that untrusted data could shadow or that a null-prototype object
never had. The full comparison with `in` is in
[Phase 4 · 03 · 01 · `in` and `hasOwn`](../../phase-4-objects-and-classes/03-existence-checks-and-delete/01-in-and-hasown.md).

**The read-through:** a static is a function that takes the object as an argument, so
the object's own contents can never interfere with it. That immunity is the whole point.

## The inventory, by the job it does

Grouped by what you are trying to *do*, with a pointer to where the depth lives.

### Read the shape

| Static | Gives you | Depth |
|---|---|---|
| `Object.keys(o)` | own enumerable string keys | [Phase 4 · 08](../../phase-4-objects-and-classes/08-keys-values-entries/README.md) |
| `Object.values(o)` | their values | same |
| `Object.entries(o)` | `[key, value]` pairs | same |
| `Object.fromEntries(pairs)` | the inverse — pairs back into an object | same |
| `Object.hasOwn(o, k)` | is `k` an **own** property? | [Phase 4 · 03 · 01](../../phase-4-objects-and-classes/03-existence-checks-and-delete/01-in-and-hasown.md) |

### See *everything*, including what the above hide

| Static | Gives you | Depth |
|---|---|---|
| `Object.getOwnPropertyNames(o)` | own string keys, **enumerable or not** | [chunk 2](./02-seeing-everything.md) |
| `Object.getOwnPropertySymbols(o)` | own symbol keys | same |
| `Reflect.ownKeys(o)` | both, in spec order | same |
| `Object.getOwnPropertyDescriptor(o, k)` | one key's full flags | [Phase 4 · 11](../../phase-4-objects-and-classes/11-property-descriptors.md) |
| `Object.getOwnPropertyDescriptors(o)` | every key's flags | [chunk 2](./02-seeing-everything.md) |

### Create and copy

| Static | Does | Depth |
|---|---|---|
| `Object.create(proto, descs?)` | new object with a chosen prototype — including `null` | [Phase 4 · 14 · 02](../../phase-4-objects-and-classes/14-object-creation-patterns/02-object-create-and-dictionaries.md) |
| `Object.assign(target, ...src)` | **mutates** target with own enumerable props of the sources | [Phase 4 · 04 · 01](../../phase-4-objects-and-classes/04-shallow-vs-deep-copy/01-what-shallow-means.md) |
| `Object.defineProperty(o, k, desc)` | add or reconfigure one property with explicit flags | [Phase 4 · 11](../../phase-4-objects-and-classes/11-property-descriptors.md) |
| `Object.defineProperties(o, descs)` | the plural form | same |

### Protect

| Static | Blocks | Depth |
|---|---|---|
| `Object.preventExtensions(o)` | adding | [Phase 4 · 12](../../phase-4-objects-and-classes/12-freeze-and-seal/README.md) |
| `Object.seal(o)` | adding **and** deleting | same |
| `Object.freeze(o)` | adding, deleting **and** writing | same |
| `Object.isExtensible` / `isSealed` / `isFrozen` | the matching questions | same |

### The prototype chain

| Static | Does | Depth |
|---|---|---|
| `Object.getPrototypeOf(o)` | reads the `[[Prototype]]` slot | [Phase 4 · 05](../../phase-4-objects-and-classes/05-the-prototype-chain/README.md) |
| `Object.setPrototypeOf(o, p)` | ⚠️ writes it — MDN warns this is a severe performance hazard; use `Object.create` instead | same |

### Compare and group

| Static | Does | Depth |
|---|---|---|
| `Object.is(a, b)` | SameValue — `NaN` equals itself, `0 !== -0` | [Phase 1 · 16](../../phase-1-values-and-coercion/16-object-is-and-zero.md) |
| `Object.groupBy(items, fn)` | list → null-prototype object of arrays | [chunk 3](./03-grouping-and-the-gaps.md) |
| `Map.groupBy(items, fn)` | list → `Map` of arrays (not an `Object` static, but the pair) | same |

🔴 **The thing to take from this table is its shape, not its contents.** You will not
memorise thirty function names, and you do not need to. What is worth carrying is that
`Object` covers exactly six jobs, and that when you need one of them the answer is a
static on `Object` rather than a method on your value.

## The four axes — the answer key for all of them

Every function above differs from its neighbours along the same four axes. MDN's guide
[Enumerability and ownership of properties](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Enumerability_and_ownership_of_properties)
is built entirely around the first two.

| Axis | The two sides |
|---|---|
| **Own vs inherited** | is the property on *this* object, or somewhere up the prototype chain? |
| **Enumerable vs not** | does its `enumerable` descriptor flag say `true`? |
| **String vs symbol** | is the key a string, or a `Symbol`? |
| **Value vs descriptor** | do you want what it holds, or how it is configured? |

**Plot the reading functions on the first three axes and the whole family falls out:**

| | Own | Inherited | Enumerable | Non-enumerable | Strings | Symbols |
|---|---|---|---|---|---|---|
| `Object.keys` / `values` / `entries` | ✅ | ❌ | ✅ | ❌ | ✅ | ❌ |
| `JSON.stringify` | ✅ | ❌ | ✅ | ❌ | ✅ | ❌ |
| spread `{...o}` / `Object.assign` | ✅ | ❌ | ✅ | ❌ | ✅ | ✅ |
| `for...in` | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ |
| `Object.getOwnPropertyNames` | ✅ | ❌ | ✅ | ✅ | ✅ | ❌ |
| `Object.getOwnPropertySymbols` | ✅ | ❌ | ✅ | ✅ | ❌ | ✅ |
| `Reflect.ownKeys` | ✅ | ❌ | ✅ | ✅ | ✅ | ✅ |

**Three readings worth pausing on:**

- **`for...in` is the odd one out.** It is the only row that walks the prototype chain,
  which is why the advice is always `Object.keys` plus `for...of` instead.
- **Copying sees symbols; listing does not.** Spread and `Object.assign` carry symbol
  keys across, but `Object.keys` will never show you one. So a copy can contain
  properties that every subsequent listing of it hides.
- **`JSON.stringify` shares `Object.keys`'s row exactly.** That is not a coincidence —
  it is the same definition, and it is why a `Symbol` key silently vanishes from JSON
  ([09 · `JSON`](../09-json/README.md)).

⚠️ **The fourth axis is the one that surprises people.** Everything in the table reads
*values*. Only the descriptor family reads *configuration* — and configuration is what
spread and `Object.assign` throw away:

```js
const source = { get id() { return 42; } };
const copy = { ...source };

Object.getOwnPropertyDescriptor(source, "id");  // { get: f, set: undefined, … }
Object.getOwnPropertyDescriptor(copy,   "id");  // { value: 42, writable: true, … }
```

**The getter became a frozen snapshot.** Spread called it once and stored the result.
That is the single most common way a copy stops behaving like its original, and the fix
is in [chunk 2](./02-seeing-everything.md).

## What counts as "an object" here

Since ES2015 these statics **coerce** a non-object argument rather than throwing:

```js
Object.keys("abc");                  // ["0", "1", "2"]
Object.getOwnPropertyNames("abc");   // ["0", "1", "2", "length"]
Object.keys(42);                     // [] — a boxed Number has no own enumerable keys
```

🔴 **`null` and `undefined` still throw**, because there is nothing to box:

```js
Object.keys(null);        // 🔴 TypeError: Cannot convert undefined or null to object
Object.keys(user ?? {});  // ✅ the guard that costs nothing
```

⚠️ **`Object.hasOwn`, `Object.getOwnPropertyDescriptor` and friends behave the same
way** — coerce a primitive, throw on nullish. If the value came from `JSON.parse`, an
API response or a destructured field, the `?? {}` guard is worth writing by reflex.

## Gotchas

**Symptom:** `TypeError: obj.hasOwnProperty is not a function`
**Cause:** The object was made with `Object.create(null)`, or a data key named
`hasOwnProperty` shadowed the method.
**Fix:** `Object.hasOwn(obj, key)` — a static cannot be shadowed.

**Symptom:** `Object.keys` returned `[]` for an object that clearly has properties
**Cause:** They are non-enumerable, or symbol-keyed. Class methods, `length` on arrays
and anything from `Object.defineProperty` without `enumerable: true` are all invisible
to it.
**Fix:** `Object.getOwnPropertyNames` or `Reflect.ownKeys` ([chunk 2](./02-seeing-everything.md)).

**Symptom:** `TypeError: Cannot convert undefined or null to object`
**Cause:** `Object.keys(null)` — the coercion that saves primitives cannot save nullish.
**Fix:** `Object.keys(value ?? {})`.

**Symptom:** A `for...in` loop picked up keys from a library
**Cause:** `for...in` is the one reader that walks the prototype chain, so anything
enumerable added to `Object.prototype` appears in it.
**Fix:** `for (const k of Object.keys(o))`, or guard with `Object.hasOwn(o, k)`.

**Symptom:** Adding a helper to `Object.prototype` broke unrelated code
**Cause:** Every object in the program inherits it, and enumerable additions join every
`for...in`.
**Fix:** Put it in the `Object` namespace of your own module, or use a plain function.

**Symptom:** `Object.setPrototypeOf` made a hot path slow
**Cause:** MDN documents it as a severe performance hazard — engines de-optimise objects
whose prototype changes after creation.
**Fix:** Create the object with the right prototype: `Object.create(proto)`.

## Interview questions

**★ Why is it `Object.keys(o)` and not `o.keys()`?**
Because `Object.prototype` is inherited by nearly every object, so a method added there
appears everywhere — and if it is enumerable, in every `for...in` loop in the process.
Statics let the namespace grow without touching the prototype. They also work where a
method cannot: a null-prototype object has no `hasOwnProperty`, and untrusted data can
shadow one with a non-function value. `Object.hasOwn` exists precisely to replace the
`Object.prototype.hasOwnProperty.call(o, k)` workaround for both cases.

**★ What is the difference between `Object.keys` and `Object.getOwnPropertyNames`?**
One axis: enumerability. Both are own-only and string-only; `getOwnPropertyNames` also
returns non-enumerable properties, which is how you see an array's `length` or a class's
prototype methods. Neither returns symbols — `Reflect.ownKeys` is the one that returns
everything.

**★ Which of the property readers walks the prototype chain?**
Only `for...in`. Everything else — `Object.keys`, `getOwnPropertyNames`,
`getOwnPropertySymbols`, `Reflect.ownKeys`, spread, `Object.assign`, `JSON.stringify` —
is own-only. That asymmetry is why the standard advice is `Object.keys` with `for...of`.

**★ `Object.keys(null)` — what happens?**
`TypeError`. Since ES2015 these statics coerce primitives (`Object.keys("ab")` is
`["0","1"]`), but `null` and `undefined` cannot be boxed. Guard with `?? {}`.

**Why do spread and `Object.assign` copy symbol keys when `Object.keys` will not show
them?**
They are defined on different property sets — the copiers take own *enumerable* keys of
any type, the listers take own enumerable *string* keys. The practical consequence is
that a copied object can carry properties no later listing of it will reveal.

**What does `Object.getOwnPropertyDescriptor` tell you that `Object.entries` cannot?**
Configuration rather than content: `writable`, `enumerable`, `configurable`, and whether
the property is an accessor at all. `entries` calls a getter and hands you the result, so
an accessor and a plain value look identical through it.

---

[Topic index](./README.md) · Next: [2 · Seeing everything](./02-seeing-everything.md) →
