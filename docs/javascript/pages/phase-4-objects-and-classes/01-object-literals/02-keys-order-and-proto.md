---
title: "01.2 · Keys, order and `__proto__`"
sidebar_label: "02 · Keys, order and __proto__"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-13 against MDN — [Object initializer](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Object_initializer), [`Reflect.ownKeys`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Reflect/ownKeys), [`Object.getOwnPropertyNames`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/getOwnPropertyNames), [`Object.keys`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/keys). Documentation-validated.

Two facts about object keys surprise people, and both cost real debugging time:
**a key is only ever a string or a symbol**, and **the order is not insertion
order**. Then there is `__proto__`, which is not a key at all in the place you
most expect it to be.

## Every key is a string or a symbol

There is no third option. Anything else you use as a key is converted to a string
first:

```js
const o = {};
o[1] = "a";
o["1"] = "b";
console.log(o[1]);          // "b" — same property, overwritten
console.log(Object.keys(o)); // ["1"]
```

`o[1]` and `o["1"]` are the same property, because `1` is stringified to `"1"` on
the way in. The same happens to `true`, `null`, arrays and plain objects:

```js
const o = {};
o[{}] = "x";
console.log(o["[object Object]"]); // "x"
```

Every plain object stringifies to `"[object Object]"`, so **two different objects
used as keys collide into one property**. This is not a quirk to memorise — it is
the reason `Map` exists. `Map` keys are compared by identity and can be any value,
which is exactly what an object-as-a-dictionary cannot do.

Symbols are the exception, and are stored as themselves:

```js
const id = Symbol("id");
const o = { [id]: 1 };
console.log(o[id]); // 1
```

A symbol key never collides with a string key and never appears in
`Object.keys`, `JSON.stringify`, or a `for...in` loop — which makes symbols the
way to attach metadata to an object without it showing up in ordinary iteration.

**The practical rule:** the moment your keys are not naturally strings — they are
objects, or they are numbers you care about as numbers — you want a `Map`, not an
object.

## Property order is specified, and it is not insertion order

For a long time "objects have no order" was true enough to teach. It is not true
now, and the real rule is the one that trips people up.

MDN, on `Reflect.ownKeys`, gives all three tiers with an example:

```js
const sym = Symbol.for("comet");
const sym2 = Symbol.for("meteor");
const obj = {
  [sym]: 0,
  str: 0,
  773: 0,
  0: 0,
  [sym2]: 0,
  "-1": 0,
  8: 0,
  "second str": 0,
};
Reflect.ownKeys(obj);
// [ "0", "8", "773", "str", "-1", "second str", Symbol(comet), Symbol(meteor) ]
// Indexes in numeric order,
// strings in insertion order,
// symbols in insertion order
```

**The three tiers, in order:**

1. **Integer-index keys, ascending numerically** — regardless of when they were
   added. `773` was written before `0` and `8`, and comes last of the three.
2. **All other string keys, in insertion order.** `str` was written first of the
   strings and stays first.
3. **Symbol keys, in insertion order.** Always last, and only visible to
   `Reflect.ownKeys` and `Object.getOwnPropertySymbols`.

MDN states tier 1 and 2 again on `Object.getOwnPropertyNames`: *"The non-negative
integer keys of the object (both enumerable and non-enumerable) are added in
ascending order to the array first, followed by the string keys in the order of
insertion."*

### What counts as an "integer index" is narrower than it looks

Look at where `"-1"` landed in MDN's example: **among the strings, in insertion
order** — not before `"0"`. A key only gets the numeric treatment if it is the
*canonical* string form of a non-negative integer, the same definition the
specification uses for array indices.

| Key | Integer index? | Why |
|---|---|---|
| `"0"`, `"8"`, `"773"` | **yes** | canonical form of a non-negative integer |
| `"-1"` | no | negative — MDN's example shows it sorted with the strings |
| `"01"` | no | not canonical; `String(Number("01"))` is `"1"`, not `"01"` |
| `"1.5"` | no | not an integer |
| `"1e2"` | no | not canonical; the canonical form is `"100"` |

This is why a zero-padded ID (`"007"`) and a plain one (`"7"`) sort into different
tiers of the same object — a genuinely confusing bug when half your IDs are padded.

### Where the order rule actually bites

**An object keyed by numeric ID reorders itself.** This is the big one:

```js
const usersById = {
  1002: { name: "Ada" },
  17:   { name: "Grace" },
  355:  { name: "Alan" },
};
Object.keys(usersById); // ["17", "355", "1002"] — sorted, not insertion order
```

You inserted in relevance order — from a ranked API response, say — and got back
numeric order. Every downstream `Object.entries(...).map(...)` renders in the
wrong sequence, and nothing errors. The fix is not to sort afterwards; it is to
**not use an object as an ordered collection**. Keep the array, or use a `Map`,
which is strictly insertion-ordered for all key types.

**JSON round-trips reorder too.** `JSON.stringify` follows the same key order, so
serialising an object with numeric-looking keys and parsing it back does not
preserve the order you wrote. If you are hashing a JSON string to detect changes,
this is fine — the reordering is deterministic. If you are diffing two JSON
strings by eye, it is not.

**`for...in` adds inherited keys on top.** The per-object ordering above applies
within each level of the prototype chain, and `for...in` walks the chain. That is
one of several reasons `for...in` on a plain object is a code smell; prefer
`Object.keys`, which is own-properties-only.

### The comparison table worth memorising

| Method | Own only | Enumerable only | Strings | Symbols |
|---|---|---|---|---|
| `Object.keys` / `values` / `entries` | yes | yes | yes | no |
| `Object.getOwnPropertyNames` | yes | **no** — includes non-enumerable | yes | no |
| `Object.getOwnPropertySymbols` | yes | no | no | yes |
| `Reflect.ownKeys` | yes | no | yes | **yes** |
| `for...in` | **no** — walks the prototype chain | yes | yes | no |
| `JSON.stringify` | yes | yes | yes | no |

All of them use the same ordering rule. The differences are entirely about *which*
keys are included — and `Reflect.ownKeys` is, as MDN puts it, *"the only way to get
all own properties – enumerable and not enumerable, strings and symbols — in one
call, without extra filtering logic."*

## `__proto__` in a literal is not a property

This is the one genuine trap in object-literal syntax.

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

Read `obj4` carefully: the value was a string, so it was **not** used as a
prototype — *and no property was created either*. The declaration silently did
nothing at all. There is no error and no key.

MDN adds: *"Only a single prototype setter is permitted in an object literal.
Multiple prototype setters are a syntax error."* So unlike every other duplicate
key, which silently takes the last value, this one fails at parse time.

### The three forms that look identical and are not

```js
const __proto__ = "variable";

const obj1 = { __proto__ };              // SHORTHAND — a normal property
console.log(Object.hasOwn(obj1, "__proto__")); // true
console.log(obj1.__proto__);                   // "variable"

const obj3 = { ["__proto__"]: 17 };      // COMPUTED — a normal property
console.log(obj3.__proto__); // 17
```

MDN: *"Property definitions that do not use 'colon' notation are not prototype
setters. They are property definitions that behave identically to similar
definitions using any other name."*

**Only the literal colon form is magic.** Shorthand is not. Computed is not.
Assignment after the fact (`obj.__proto__ = x`) is a different thing again — that
one goes through the deprecated accessor on `Object.prototype` and *does* set the
prototype.

You can even have both in one object:

```js
const obj4 = { ["__proto__"]: 17, __proto__: {} };
// an own property "__proto__" of 17, AND {} as the prototype
```

### JSON is not an object literal

```js
console.log(JSON.parse('{ "__proto__": 0, "__proto__": 1 }')); // {__proto__: 1}
console.log({ "__proto__": 0, "__proto__": 1 });
// SyntaxError: Duplicate __proto__ fields are not allowed in object literals

console.log(JSON.parse('{ "__proto__": {} }')); // { __proto__: {} }
console.log({ "__proto__": {} });               // {} (with {} as prototype)
```

MDN: *"In JSON, `"__proto__"` is a normal property key. In an object literal, it
sets the object's prototype."*

**`JSON.parse` is safe here — it creates a plain own property.** The danger is
never `JSON.parse` itself; it is what you do next. Deep-merging parsed JSON into
an existing object with hand-written recursion, or assigning
`target[key] = source[key]` in a loop, *will* hit the `Object.prototype` setter
when `key` is `"__proto__"` — and then you have modified `Object.prototype` for
every object in the program. That is **prototype pollution**, and it is a real
CVE class, not a curiosity. Guard merge loops by skipping `__proto__`,
`constructor` and `prototype`, or build on a null-prototype object.

## `Object.create(null)` — the true dictionary

```js
const dict = Object.create(null);
dict.toString = "just a string";   // no inherited toString to shadow
```

An object literal always starts with `Object.prototype` behind it, which means
every object you create already "has" `toString`, `valueOf`, `hasOwnProperty`,
`constructor` and more. For a dictionary of user-supplied keys that is a hazard:
`if (dict[key])` is true for `"toString"` on an empty object.

`Object.create(null)` — or the literal `{ __proto__: null }`, the one legitimate
use of the magic form — gives you an object with no prototype at all:

- No inherited keys, so `key in dict` and `dict[key]` mean only what you put there.
- No `__proto__` accessor, so it cannot be prototype-polluted through assignment.
- **No `toString` either** — `` `${dict}` `` throws, and so does
  `dict.hasOwnProperty(k)`. Use `Object.hasOwn(dict, k)`, which is a static method
  and needs nothing from the object. That is
  [03 · Existence checks and `delete`](../03-existence-checks-and-delete/README.md).

`Map` solves the same problem with a nicer interface and real ordering. Reach for
`Object.create(null)` when you specifically need a plain-object shape — because it
is going to `JSON.stringify`, or a library demands one.

## Gotchas

**Symptom:** Two different objects used as keys overwrite each other
**Cause:** Non-symbol keys are stringified, and every plain object stringifies to
`"[object Object]"`.
**Fix:** Use a `Map`, whose keys are compared by identity and may be any value.

**Symptom:** `Object.keys` returns numeric-looking keys in a different order from
the one you inserted
**Cause:** Integer-index keys are enumerated in **ascending numeric order** before
all string keys (MDN, `Object.getOwnPropertyNames`), regardless of insertion.
**Fix:** Do not use an object as an ordered collection keyed by ID. Keep an array,
or use a `Map`.

**Symptom:** Some IDs sort numerically and others do not, in the same object
**Cause:** Only the canonical form of a non-negative integer counts as an index.
`"007"`, `"-1"` and `"1.5"` are ordinary strings — MDN's `Reflect.ownKeys` example
shows `"-1"` sorted among the strings.
**Fix:** Normalise key formats, or stop relying on the order.

**Symptom:** `{ __proto__: someValue }` did not create a `__proto__` property
**Cause:** The colon form is a **prototype setter**, not a property definition. If
the value is not an object or `null`, MDN documents that it does nothing at all —
`Object.hasOwn(obj, "__proto__")` is `false`.
**Fix:** Use `{ ["__proto__"]: value }` for a genuine property of that name.

**Symptom:** `SyntaxError: Duplicate __proto__ fields are not allowed in object
literals`
**Cause:** Two colon-form `__proto__` entries. MDN: *"Only a single prototype
setter is permitted."* Unlike every other duplicate key, this one is a parse error.
**Fix:** Remove one. Note `JSON.parse` of the same text is legal and gives a normal
property.

**Symptom:** Every object in the application suddenly has a property nobody set
**Cause:** Prototype pollution — a recursive merge of untrusted JSON assigned
through a `"__proto__"` key and reached `Object.prototype`.
**Fix:** Skip `__proto__`, `constructor` and `prototype` in merge loops, or merge
into an `Object.create(null)` target. `JSON.parse` itself is safe; the merge is
not.

**Symptom:** `dict.hasOwnProperty is not a function` on a null-prototype object
**Cause:** `Object.create(null)` inherits nothing, including `Object.prototype`'s
methods.
**Fix:** `Object.hasOwn(dict, key)` — a static method that needs nothing from the
object.

## Interview questions

**★ What types can an object key be?**
Strings and symbols only. Everything else is coerced to a string first, so `o[1]`
and `o["1"]` are the same property, and any two plain objects collide on
`"[object Object]"`. `Map` is the answer when you need identity-based or non-string
keys.

**★ Do objects preserve insertion order?**
Partly. Integer-index keys come first in **ascending numeric order** regardless of
insertion; then other string keys in insertion order; then symbol keys in insertion
order. So `{1002: …, 17: …}` enumerates as `17, 1002`. `Map` is insertion-ordered
for everything.

**★ What does `{ __proto__: x }` do?**
It sets the new object's prototype rather than creating a property — MDN: it *"does
not create a property with the name `__proto__`"*. If `x` is not an object or
`null` it does nothing whatsoever, silently. Only the colon form is magic;
shorthand `{ __proto__ }` and computed `{ ["__proto__"]: v }` create ordinary
properties.

**★ Is `JSON.parse` vulnerable to prototype pollution?**
No — MDN notes that in JSON, `"__proto__"` is a normal property key, so parsing
produces a plain own property. The vulnerability is in what you do afterwards: a
recursive merge that *assigns* `target["__proto__"]` goes through the
`Object.prototype` accessor and pollutes every object in the program.

**Why use `Object.create(null)`?**
To get a dictionary with no inherited keys, so `key in dict` reflects only what you
put in, and no `__proto__` accessor to be polluted through. The cost is that it has
no `toString`, `hasOwnProperty` or any other `Object.prototype` method — use
`Object.hasOwn` instead.

**Which enumeration method includes symbols?**
Only `Reflect.ownKeys` and `Object.getOwnPropertySymbols`. `Object.keys`,
`for...in` and `JSON.stringify` are string-keyed and enumerable-only;
`Object.getOwnPropertyNames` includes non-enumerable string keys but still no
symbols.

---

← [Building an object literal](./01-building-an-object.md) · [Topic index](./README.md) · Next → [Phase index](../README.md)
