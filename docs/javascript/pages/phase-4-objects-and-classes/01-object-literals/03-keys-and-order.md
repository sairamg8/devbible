---
title: "01.3 · Keys and enumeration order"
sidebar_label: "03 · Keys and order"
sidebar_position: 3
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-13 against MDN — [`Reflect.ownKeys`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Reflect/ownKeys), [`Object.getOwnPropertyNames`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/getOwnPropertyNames), [`Object.keys`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/keys). Documentation-validated.

Two facts about object keys cost real debugging time: **a key is only ever a string
or a symbol**, and **the order you get back is not the order you inserted**.

## Every key is a string or a symbol

There is no third option. Anything else is converted to a string on the way in:

```js
const o = {};
o[1] = "a";
o["1"] = "b";
console.log(o[1]);           // "b" — same property, overwritten
console.log(Object.keys(o)); // ["1"]
```

`o[1]` and `o["1"]` are the same property. The same happens to `true`, `null`,
arrays and plain objects:

```js
const o = {};
o[{}] = "x";
console.log(o["[object Object]"]); // "x"
```

Every plain object stringifies to `"[object Object]"`, so **two different objects
used as keys collide into one property**. This is not a quirk to memorise — it is
the reason `Map` exists. `Map` keys are compared by identity and may be any value,
which is exactly what an object-as-dictionary cannot do.

Symbols are the exception and are stored as themselves:

```js
const id = Symbol("id");
const o = { [id]: 1 };
console.log(o[id]); // 1
```

A symbol key never collides with a string key and never appears in `Object.keys`,
`JSON.stringify`, or `for...in` — which makes symbols the way to attach metadata to
an object without it showing up in ordinary iteration.

**The practical rule:** the moment your keys are not naturally strings — they are
objects, or numbers you care about *as numbers* — you want a `Map`.

## Property order is specified, and it is not insertion order

"Objects have no order" was true enough to teach for a long time. It is not true
now, and the real rule is the part that trips people up. MDN's `Reflect.ownKeys`
page gives all three tiers with an example:

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

**The three tiers:**

1. **Integer-index keys, ascending numerically** — regardless of when they were
   added. `773` was written before `0` and `8`, and comes last of the three.
2. **All other string keys, in insertion order.** `str` was written first among the
   strings and stays first.
3. **Symbol keys, in insertion order.** Always last, and visible only to
   `Reflect.ownKeys` and `Object.getOwnPropertySymbols`.

MDN states tiers 1 and 2 again on `Object.getOwnPropertyNames`: *"The non-negative
integer keys of the object (both enumerable and non-enumerable) are added in
ascending order to the array first, followed by the string keys in the order of
insertion."*

### "Integer index" is narrower than it looks

Look at where `"-1"` landed in MDN's example: **among the strings, in insertion
order** — not before `"0"`. A key gets the numeric treatment only if it is the
*canonical* string form of a non-negative integer, the same definition the
specification uses for array indices.

| Key | Integer index? | Why |
|---|---|---|
| `"0"`, `"8"`, `"773"` | **yes** | canonical form of a non-negative integer |
| `"-1"` | no | negative — MDN's example shows it sorted with the strings |
| `"01"` | no | not canonical; `String(Number("01"))` is `"1"`, not `"01"` |
| `"1.5"` | no | not an integer |
| `"1e2"` | no | not canonical; the canonical form is `"100"` |

So a zero-padded ID (`"007"`) and a plain one (`"7"`) sort into **different tiers of
the same object** — a genuinely confusing bug when half your IDs are padded.

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

You inserted in relevance order — from a ranked API response, say — and got numeric
order back. Every downstream `Object.entries(...).map(...)` renders in the wrong
sequence, and nothing errors.

The fix is not to sort afterwards. It is to **stop using an object as an ordered
collection**: keep the array you got, or use a `Map`, which is strictly
insertion-ordered for every key type.

**JSON round-trips reorder too.** `JSON.stringify` follows the same key order, so
serialising an object with numeric-looking keys and parsing it back does not
preserve the order you wrote. If you are hashing the JSON to detect changes this is
harmless — the reordering is deterministic. If you are diffing two payloads by eye,
it is not.

**`for...in` adds inherited keys on top.** The ordering above applies within each
level of the prototype chain, and `for...in` walks the whole chain. That is one of
several reasons `for...in` on a plain object is a smell; `Object.keys` is
own-properties-only.

## Which enumeration method sees what

| Method | Own only | Enumerable only | Strings | Symbols |
|---|---|---|---|---|
| `Object.keys` / `values` / `entries` | yes | yes | yes | no |
| `Object.getOwnPropertyNames` | yes | **no** — includes non-enumerable | yes | no |
| `Object.getOwnPropertySymbols` | yes | no | no | yes |
| `Reflect.ownKeys` | yes | no | yes | **yes** |
| `for...in` | **no** — walks the prototype chain | yes | yes | no |
| `JSON.stringify` | yes | yes | yes | no |

All of them use the same ordering rule; the differences are entirely about *which*
keys are included. `Reflect.ownKeys` is, as MDN puts it, *"the only way to get all
own properties – enumerable and not enumerable, strings and symbols — in one call,
without extra filtering logic."*

**In practice:** `Object.entries` for iterating data, `Reflect.ownKeys` when you are
writing something generic (a cloner, a serialiser, a proxy handler), and
`for...in` almost never.

## Gotchas

**Symptom:** Two different objects used as keys overwrite each other
**Cause:** Non-symbol keys are stringified, and every plain object stringifies to
`"[object Object]"`.
**Fix:** Use a `Map`, whose keys are compared by identity and may be any value.

**Symptom:** `o[1]` and `o["1"]` turn out to be the same property
**Cause:** Number keys are coerced to strings. There is no numeric key type on a
plain object.
**Fix:** Expected behaviour — but if you need numeric keys kept distinct from
strings, that is a `Map`.

**Symptom:** `Object.keys` returns numeric-looking keys in a different order from
the one you inserted
**Cause:** Integer-index keys are enumerated in **ascending numeric order** before
all string keys (MDN), regardless of insertion.
**Fix:** Do not use an object as an ordered collection keyed by ID. Keep an array,
or use a `Map`.

**Symptom:** Some IDs sort numerically and others do not, in the same object
**Cause:** Only the canonical form of a non-negative integer counts as an index.
`"007"`, `"-1"` and `"1.5"` are ordinary strings — MDN's `Reflect.ownKeys` example
shows `"-1"` among the strings.
**Fix:** Normalise the key format, or stop relying on the order.

**Symptom:** A symbol-keyed property vanished after `JSON.stringify` or a
`for...in` loop
**Cause:** Symbol keys are excluded from `Object.keys`, `for...in` and
`JSON.stringify`.
**Fix:** That is the point of symbol keys. Use `Reflect.ownKeys` or
`Object.getOwnPropertySymbols` when you need to see them.

**Symptom:** A generic clone or serialiser drops non-enumerable or symbol
properties
**Cause:** It was built on `Object.keys`, which is enumerable-and-string-only.
**Fix:** `Reflect.ownKeys` plus `Object.getOwnPropertyDescriptor` for a faithful
copy.

## Interview questions

**★ What types can an object key be?**
Strings and symbols only. Everything else is coerced to a string, so `o[1]` and
`o["1"]` are the same property and any two plain objects collide on
`"[object Object]"`. `Map` is the answer when you need identity-based or non-string
keys.

**★ Do objects preserve insertion order?**
Partly. **Integer-index keys come first, in ascending numeric order**, regardless
of insertion; then other string keys in insertion order; then symbol keys in
insertion order. So `{1002: …, 17: …}` enumerates as `17, 1002`. `Map` is
insertion-ordered for everything.

**★ Which keys count as "integer indices" for ordering?**
Only the canonical string form of a non-negative integer. `"-1"`, `"01"`, `"1.5"`
and `"1e2"` are ordinary string keys — MDN's own `Reflect.ownKeys` example shows
`"-1"` sorted among the strings rather than before `"0"`.

**★ Which enumeration method includes symbols?**
Only `Reflect.ownKeys` and `Object.getOwnPropertySymbols`. `Object.keys`,
`for...in` and `JSON.stringify` are string-keyed and enumerable-only;
`Object.getOwnPropertyNames` adds non-enumerable string keys but still no symbols.

**Why is `for...in` discouraged on plain objects?**
It walks the **prototype chain**, so it can yield inherited keys you never added,
and the ordering rule applies per level of that chain. `Object.keys` /
`Object.entries` are own-only and are what you almost always meant.

**You need to copy an object faithfully, including non-enumerable and symbol
properties. What do you use?**
`Reflect.ownKeys` to get every own key, and `Object.getOwnPropertyDescriptor` /
`Object.defineProperty` per key so accessors and flags survive. Spread and
`Object.keys` both silently drop part of the object.

---

← [Methods, accessors and spread](./02-methods-accessors-and-spread.md) · [Topic index](./README.md) · Next → [`__proto__` and null-prototype objects](./04-proto-and-null-prototype.md)
