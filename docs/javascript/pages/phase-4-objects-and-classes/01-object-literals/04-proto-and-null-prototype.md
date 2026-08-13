---
title: "01.4 · `__proto__` and null-prototype objects"
sidebar_label: "04 · __proto__ and null prototypes"
sidebar_position: 4
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-13 against MDN — [Object initializer](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Object_initializer), [`Object.create`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/create), [`Object.hasOwn`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/hasOwn). Documentation-validated.

The one genuine trap in object-literal syntax: **`__proto__` written with a colon
is not a property at all.** Three forms that look identical behave differently, and
one of them is the root of a real vulnerability class.

## The colon form sets the prototype

MDN: *"A property definition of the form `__proto__: value` or `"__proto__": value`
does not create a property with the name `__proto__`. Instead, if the provided
value is an object or `null`, it points the `[[Prototype]]` of the created object
to that value."*

```js
const obj1 = {};
console.log(Object.getPrototypeOf(obj1) === Object.prototype); // true

const obj2 = { __proto__: null };
console.log(Object.getPrototypeOf(obj2)); // null

const protoObj = {};
const obj3 = { "__proto__": protoObj };
console.log(Object.getPrototypeOf(obj3) === protoObj); // true

const obj4 = { __proto__: "not an object or null" };
console.log(Object.getPrototypeOf(obj4) === Object.prototype); // true
console.log(Object.hasOwn(obj4, "__proto__")); // false
```

Read `obj4` carefully. The value was a string, so it was **not** used as a
prototype — *and no property was created either*. The declaration silently did
nothing whatsoever. No error, no key, no effect.

MDN adds: *"Only a single prototype setter is permitted in an object literal.
Multiple prototype setters are a syntax error."* So unlike every other duplicate
key — which silently takes the last value, per
[chunk 2](./02-methods-accessors-and-spread.md) — this one fails at parse time.

## Three forms that look identical and are not

```js
const __proto__ = "variable";

const obj1 = { __proto__ };              // SHORTHAND — an ordinary property
console.log(Object.hasOwn(obj1, "__proto__")); // true
console.log(obj1.__proto__);                   // "variable"

const obj3 = { ["__proto__"]: 17 };      // COMPUTED — an ordinary property
console.log(obj3.__proto__); // 17
```

MDN: *"Property definitions that do not use 'colon' notation are not prototype
setters. They are property definitions that behave identically to similar
definitions using any other name."*

**Only the literal colon form is magic.** Shorthand is not. Computed is not. And
assignment after the fact (`obj.__proto__ = x`) is a fourth thing again — that goes
through the deprecated accessor inherited from `Object.prototype`, and it *does* set
the prototype.

You can even have both in one object:

```js
const obj4 = { ["__proto__"]: 17, __proto__: {} };
// an own property "__proto__" holding 17, AND {} as the prototype
```

| Form | Effect |
|---|---|
| `{ __proto__: p }` | sets the **prototype** (if `p` is an object or `null`); creates no property |
| `{ __proto__: "str" }` | **nothing at all** — no prototype change, no property |
| `{ __proto__ }` (shorthand) | ordinary own property named `__proto__` |
| `{ ["__proto__"]: v }` (computed) | ordinary own property named `__proto__` |
| `obj.__proto__ = p` (assignment) | sets the prototype, via the deprecated accessor |

## JSON is not an object literal

```js
console.log(JSON.parse('{ "__proto__": 0, "__proto__": 1 }')); // {__proto__: 1}
console.log({ "__proto__": 0, "__proto__": 1 });
// SyntaxError: Duplicate __proto__ fields are not allowed in object literals

console.log(JSON.parse('{ "__proto__": {} }')); // { __proto__: {} }
console.log({ "__proto__": {} });               // {} (with {} as prototype)
```

MDN: *"In JSON, `"__proto__"` is a normal property key. In an object literal, it
sets the object's prototype."*

**`JSON.parse` is safe here.** It creates a plain own property, every time. This is
worth stating clearly because the opposite is widely assumed.

## Prototype pollution

The danger is never `JSON.parse` itself — it is what you do with the result.

```js
// A hand-written deep merge. This is the vulnerability.
function merge(target, source) {
  for (const key of Object.keys(source)) {
    if (typeof source[key] === "object" && source[key] !== null) {
      target[key] ??= {};
      merge(target[key], source[key]);   // ← recurses into target["__proto__"]
    } else {
      target[key] = source[key];         // ← assigns through the accessor
    }
  }
  return target;
}
```

Feed that a parsed payload containing `{"__proto__": {"isAdmin": true}}` and the
assignment goes through `Object.prototype`'s `__proto__` accessor. From that moment
**every object in the program** inherits `isAdmin: true`, including ones created
before the attack. Any later `if (user.isAdmin)` passes.

That is **prototype pollution**, a real CVE class that has hit widely used merge and
query-string libraries repeatedly — not a curiosity.

**Three defences, in order of strength:**

1. **Merge into a null-prototype target.** `Object.create(null)` has no `__proto__`
   accessor to go through, so the assignment creates an ordinary property.
2. **Skip the dangerous keys explicitly** — `__proto__`, `constructor` and
   `prototype`. `constructor` matters because `constructor.prototype` reaches the
   same place by another route.
3. **Use `Object.defineProperty`** for the write instead of assignment; it defines
   an own property and never invokes an inherited setter.

And the structural answer: prefer a schema validator that builds a known-shape
object from the payload over a generic deep merge of untrusted input.

## `Object.create(null)` — the true dictionary

```js
const dict = Object.create(null);
dict.toString = "just a string";   // no inherited toString to shadow
```

An object literal always starts with `Object.prototype` behind it, so every object
you create already "has" `toString`, `valueOf`, `hasOwnProperty`, `constructor` and
more. For a dictionary of user-supplied keys that is a hazard: `if (dict[key])` is
truthy for `"toString"` on an *empty* object.

`Object.create(null)` — or the literal `{ __proto__: null }`, the one legitimate use
of the magic form — gives an object with no prototype at all:

- **No inherited keys**, so `key in dict` and `dict[key]` mean only what you put
  there.
- **No `__proto__` accessor**, so it cannot be polluted through assignment.
- **No `toString` either** — so `` `${dict}` `` throws
  `TypeError: Cannot convert object to primitive value`, `dict + ""` throws, and
  `console.log` in some tools renders it differently. This is the cost, and it is
  real: a null-prototype object is not a drop-in replacement for a plain one.
- **No `hasOwnProperty`** — use `Object.hasOwn(dict, k)`, a static method that needs
  nothing from the object. That is
  [03 · The four existence checks](../03-existence-checks-and-delete/01-in-and-hasown.md).

**`Map` solves the same problem with a better interface**: real insertion order, any
key type, a `size` property, and `delete` that is a first-class operation. Reach for
`Object.create(null)` when you specifically need a plain-object *shape* — because it
is going to `JSON.stringify`, or a library demands one.

## Gotchas

**Symptom:** `{ __proto__: someValue }` did not create a `__proto__` property
**Cause:** The colon form is a **prototype setter**, not a property definition. If
the value is not an object or `null`, MDN documents that it does nothing at all —
`Object.hasOwn(obj, "__proto__")` is `false`.
**Fix:** Use `{ ["__proto__"]: value }` for a genuine property of that name.

**Symptom:** `SyntaxError: Duplicate __proto__ fields are not allowed in object
literals`
**Cause:** Two colon-form `__proto__` entries. MDN: *"Only a single prototype setter
is permitted."* Unlike every other duplicate key, this is a parse error.
**Fix:** Remove one. Note `JSON.parse` of the same text is legal and yields a normal
property.

**Symptom:** An object built from parsed JSON behaves as though it inherited
something
**Cause:** A recursive merge assigned through a `"__proto__"` key and reached
`Object.prototype` — prototype pollution.
**Fix:** Merge into an `Object.create(null)` target, skip `__proto__`,
`constructor` and `prototype`, or write with `Object.defineProperty`. `JSON.parse`
itself is safe.

**Symptom:** Every object in the application suddenly has a property nobody set
**Cause:** `Object.prototype` was polluted earlier in the process. It affects
objects created *before* the attack too, because lookup is dynamic.
**Fix:** Find the merge. Freezing `Object.prototype` at startup is a blunt but
effective containment measure.

**Symptom:** `TypeError: Cannot convert object to primitive value` when logging or
concatenating a dictionary
**Cause:** A null-prototype object has no `toString`.
**Fix:** `JSON.stringify(dict)`, or `Object.fromEntries(Object.entries(dict))` to
get a plain object for display.

**Symptom:** `dict.hasOwnProperty is not a function`
**Cause:** `Object.create(null)` inherits nothing, including `Object.prototype`'s
methods.
**Fix:** `Object.hasOwn(dict, key)`.

## Interview questions

**★ What does `{ __proto__: x }` do?**
It sets the new object's prototype rather than creating a property — MDN: it *"does
not create a property with the name `__proto__`"*. If `x` is not an object or
`null` it does **nothing at all**, silently. Only the colon form is magic;
shorthand `{ __proto__ }` and computed `{ ["__proto__"]: v }` create ordinary
properties.

**★ Is `JSON.parse` vulnerable to prototype pollution?**
No. MDN notes that in JSON, `"__proto__"` is a normal property key, so parsing
produces a plain own property. The vulnerability is in what happens next: a
recursive merge that **assigns** `target["__proto__"]` goes through
`Object.prototype`'s accessor and pollutes every object in the program.

**★ How do you defend a deep merge against prototype pollution?**
Merge into an `Object.create(null)` target so there is no accessor to go through;
skip the keys `__proto__`, `constructor` and `prototype`; and write with
`Object.defineProperty` rather than assignment. Better still, validate the payload
into a known shape instead of generically merging untrusted input.

**★ Why use `Object.create(null)`?**
To get a dictionary with no inherited keys, so `key in dict` reflects only what you
put in, and no `__proto__` accessor to be polluted through. The cost is that it has
**no** `toString`, `hasOwnProperty` or any other `Object.prototype` method — string
conversion throws, and existence checks need `Object.hasOwn`.

**What is the difference between `{ __proto__: p }` and `obj.__proto__ = p`?**
The literal form is dedicated syntax handled at object creation and creates no
property. The assignment form goes through the **deprecated accessor** inherited
from `Object.prototype` — which is why a null-prototype object has no such accessor
and the assignment there creates an ordinary property instead.

**When would you choose `Map` over `Object.create(null)`?**
Almost always, when the collection is a genuine dictionary: `Map` gives insertion
order for all key types, any key type at all, a `size`, and first-class `delete`.
Choose `Object.create(null)` when you specifically need a plain-object shape for
`JSON.stringify` or a library API.

---

← [Keys and enumeration order](./03-keys-and-order.md) · [Topic index](./README.md) · Next → [Phase index](../README.md)
