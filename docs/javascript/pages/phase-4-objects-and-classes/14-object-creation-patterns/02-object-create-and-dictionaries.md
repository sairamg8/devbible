---
title: "2 · `Object.create` and null-prototype dictionaries"
sidebar_label: "2 · Object.create and dictionaries"
sidebar_position: 2
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-14 against MDN — [`Object.create()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/create), [`Object.setPrototypeOf()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/setPrototypeOf), [`Object.getPrototypeOf()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/getPrototypeOf), [`Object.hasOwn()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/hasOwn), [`Object.prototype.hasOwnProperty()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/hasOwnProperty), [`Object.prototype.__proto__`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/proto), [`Map`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map), [`JSON.stringify()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/JSON/stringify). Documentation-validated; **no timings**.

`Object.create` is the low-level creation primitive the other patterns are built on: **it makes an
object with the prototype you name, and nothing else.**

```js
const animal = { speak() { return `${this.name} makes a sound`; } };

const dog = Object.create(animal);   // prototype is `animal`, no constructor involved
dog.name = "Rex";
dog.speak();                          // "Rex makes a sound"
Object.getPrototypeOf(dog) === animal; // true
```

Its second argument is a **descriptor map**, the same shape `Object.defineProperties` takes — which
is what makes it the one way to build an object with accessors and flags intact
([11 · Property descriptors](../11-property-descriptors.md)):

```js
const clone = Object.create(
  Object.getPrototypeOf(source),
  Object.getOwnPropertyDescriptors(source),
);
```

⚠️ **Prefer `Object.create` over `Object.setPrototypeOf`.** MDN is explicit that changing an
object's prototype after creation is a very slow operation in every engine, because it invalidates
the optimisations engines build around object shape. Set the prototype when you build the object.

## `Object.create(null)` — an object with no inheritance at all

```js
const dict = Object.create(null);
Object.getPrototypeOf(dict);   // null
dict.toString;                 // undefined — there is no Object.prototype above it
"toString" in dict;            // false
```

The literal shorthand does the same thing, and reads better in most code:

```js
const dict = { __proto__: null };
```

⚠️ **That is a special form, valid only in an object literal.** Written as `{ ["__proto__"]: null }`
or assigned afterwards, `__proto__` is an ordinary property name and the prototype is untouched.

## The bug it exists to prevent

Every plain object inherits about a dozen properties, and a lookup keyed by data cannot tell an
inherited one from a real entry:

```js
const counts = {};
for (const word of words) {
  if (counts[word]) counts[word]++;
  else counts[word] = 1;
}
```

Feed that the word **`"toString"`** and `counts["toString"]` is a *function* — truthy — so the
branch increments a function and the count is `NaN`. `"constructor"`, `"valueOf"` and
`"hasOwnProperty"` do the same. With `Object.create(null)` there is nothing above the object, so a
miss is a miss.

🔴 **The security version of this is prototype pollution.** A merge or a `JSON.parse` result written
key-by-key into a plain object can carry `__proto__`:

```js
const evil = JSON.parse('{"__proto__": {"isAdmin": true}}');
merge({}, evil);            // a naive deep merge writes through to Object.prototype
({}).isAdmin;               // 🔴 true — every object in the process now has it
```

**A null-prototype target neuters it**: with no `Object.prototype` above, `__proto__` is an ordinary
string key that lands as own data and reaches nothing. This is the substance of
**16 · Prototype patterns to avoid** *(not written yet)*; the short version is that any object built
from untrusted keys should either have a null prototype or be a `Map`.

## What you give up

| | Plain `{}` | `Object.create(null)` |
|---|---|---|
| `dict.hasOwnProperty(k)` | ✅ | 🔴 `TypeError: dict.hasOwnProperty is not a function` |
| `String(dict)`, `` `${dict}` `` | ✅ | 🔴 `TypeError: Cannot convert object to primitive value` |
| `dict.toString()`, `valueOf` | ✅ | 🔴 absent |
| `JSON.stringify(dict)` | ✅ | ✅ works |
| `Object.keys` / `entries` / spread | ✅ | ✅ works |
| `for...in` | ✅ | ✅ works, and is *safer* — nothing inherited to skip |

The replacements are one-liners, and `Object.hasOwn` is the modern one — see
[03 · Existence checks and `delete`](../03-existence-checks-and-delete/README.md):

```js
Object.hasOwn(dict, key);                            // ES2022, the right answer
Object.prototype.hasOwnProperty.call(dict, key);     // the older portable form
```

⚠️ **The `String()` failure is the one that surprises people at 2 a.m.** — it fires from a template
literal, from string concatenation, and from anything that logs the object into a message. Devtools
and Node print it as `[Object: null prototype] { … }`, which is at least a clear signal.

**Some libraries assume `Object.prototype` exists.** A null-prototype object passed into code that
calls `value.toString()` or `value.hasOwnProperty(...)` will throw. Keep them internal, or convert
with `{ ...dict }` at the boundary.

## `Map` is usually the better answer

Almost everything a null-prototype object is chosen for, `Map` does better:

| | Null-prototype object | `Map` |
|---|---|---|
| key types | strings and symbols only | **anything**, including objects and `NaN` |
| accidental inheritance | none | none |
| size | `Object.keys(o).length` | `map.size` |
| iteration order | **integer-like keys first**, then insertion order | pure insertion order |
| `JSON.stringify` | ✅ direct | ❌ needs `Object.fromEntries` |
| deleting entries | `delete`, which engines handle poorly | `map.delete`, designed for it |

That integer-key row is a real trap: an object with keys `"2"`, `"10"` and `"1"` iterates as `1, 2,
10` regardless of insertion order — see
[01 · Object literals](../01-object-literals/README.md). If order matters, that alone decides it.

**Choose in one pass:**

- **Fixed, known keys** — a plain object literal. This is most code, and it needs nothing else.
- **Keys from data, and the value must serialise to JSON** — `Object.create(null)`.
- **Keys from data, anything else** — `Map`.
- **Keys are objects, or you need `size`, or insertion order matters** — `Map`, no contest.

## Where `Object.create` still earns its place beyond dictionaries

- **The descriptor-preserving clone** shown at the top — nothing else copies accessors and flags.
- **A prototype without a constructor**, when you want shared methods but no `new`:
  ```js
  const proto = { greet() { return `Hi, ${this.name}`; } };
  const makeUser = (name) => Object.assign(Object.create(proto), { name });
  ```
  That is a factory *with* prototype sharing — the middle ground between
  [chunk 1](./01-factory-constructor-class.md)'s two options.
- **Reading legacy code.** `Child.prototype = Object.create(Parent.prototype)` is how inheritance
  was wired before `class`, and it is still in every older codebase.

## Gotchas

**Symptom:** `TypeError: dict.hasOwnProperty is not a function`
**Cause:** The object has a null prototype, so it inherits nothing.
**Fix:** `Object.hasOwn(dict, key)`.

**Symptom:** `TypeError: Cannot convert object to primitive value` when logging or interpolating
**Cause:** No `toString` — the same null prototype.
**Fix:** `JSON.stringify(dict)` or `{ ...dict }` for display. It is not a bug in the object.

**Symptom:** A word-count of real text produced `NaN` for one entry
**Cause:** A key like `"toString"` or `"constructor"` hit an inherited property, so the truthiness test lied.
**Fix:** `Object.create(null)`, a `Map`, or `Object.hasOwn` on every read.

**Symptom:** Every object in the app suddenly has a property nobody set
**Cause:** Prototype pollution — a merge or parse wrote `__proto__` through to `Object.prototype`.
**Fix:** Build untrusted objects with a null prototype or a `Map`, and reject `__proto__`, `constructor` and `prototype` as keys in any merge.

**Symptom:** `{ ["__proto__"]: null }` did not give a null-prototype object
**Cause:** The prototype-setting form works only as a plain literal key, not computed or assigned.
**Fix:** `{ __proto__: null }` or `Object.create(null)`.

**Symptom:** Object keys come out in the wrong order
**Cause:** Integer-like keys are enumerated first, ascending, whatever the insertion order — a null prototype does not change that.
**Fix:** Use a `Map` when order matters.

**Symptom:** A third-party function threw on a null-prototype object
**Cause:** It called `.toString()` or `.hasOwnProperty()` on it.
**Fix:** Convert at the boundary with `{ ...dict }`, and keep the null-prototype version internal.

## Interview questions

**★ What does `Object.create(null)` give you, and why would you want it?**
An object with no prototype — no `toString`, no `hasOwnProperty`, no `__proto__` setter. It is the
safe shape for a dictionary keyed by data you did not write, because a lookup can no longer collide
with an inherited property and a `__proto__` key cannot reach `Object.prototype`.

**★ What breaks when you use a null-prototype object?**
Anything inherited: `hasOwnProperty` and the rest are gone, and `String(dict)` or interpolating it
throws `Cannot convert object to primitive value`. `Object.keys`, spread, `for...in` and
`JSON.stringify` all still work. Use `Object.hasOwn`, and convert at the boundary before handing it
to code that assumes a normal object.

**★ What is prototype pollution, and how do you prevent it?**
Writing a `__proto__` key from untrusted data through to `Object.prototype`, which adds a property
to *every* object in the process. Prevent it by building untrusted objects with a null prototype or
a `Map`, and by rejecting `__proto__`, `constructor` and `prototype` as keys in any merge or
assignment loop.

**★ When would you use a `Map` instead of a null-prototype object?**
Almost always, unless you need direct `JSON.stringify`. `Map` takes any key type including objects,
has `size`, iterates in pure insertion order — a plain object puts integer-like keys first — and its
`delete` is designed for the job.

**★ Why prefer `Object.create(proto)` over `Object.setPrototypeOf(obj, proto)`?**
MDN documents changing an existing object's prototype as a very slow operation in every engine,
because it invalidates the shape-based optimisations property access depends on. Set the prototype
at creation.

**What is `Object.create`'s second argument?**
A property-descriptor map, exactly as `Object.defineProperties` takes. It is what makes
`Object.create(Object.getPrototypeOf(o), Object.getOwnPropertyDescriptors(o))` the one clone that
preserves getters, setters and flags.

**How was inheritance wired before `class`?**
`Child.prototype = Object.create(Parent.prototype)`, then resetting `Child.prototype.constructor`
and calling `Parent.call(this, …)` inside the child constructor. `class` and `super` do all of that,
which is why the older form only matters now for reading old code.

---

← [1 · Factory, constructor, class](./01-factory-constructor-class.md) · [Topic index](./README.md) · [Phase index](../README.md) →
