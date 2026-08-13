---
title: "10.2 · Choosing, and what `Map` costs"
sidebar_label: "02 · Choosing and costs"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-13 against MDN — [`Map`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map), [`JSON.stringify`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/JSON/stringify), [`WeakMap`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/WeakMap). Documentation-validated.

[Chunk 1](./01-the-six-differences.md) said `Map` wins on six axes. This chunk is the
other half: **the three real costs**, and a decision rule.

## Cost 1 — `Map` does not serialise

```js
JSON.stringify(new Map([["a", 1]]));   // '{}'
```

MDN, on `JSON.stringify`: *"Only enumerable own properties are visited. This means
`Map`, `Set`, etc. will become `"{}"`."* A `Map`'s entries live in internal slots, not
own properties.

**This is the single biggest reason plain objects survive.** Anything crossing a network
boundary, going into `localStorage`, or being written to a file has to be JSON — so the
edges of your program are objects whether you like it or not.

The conversions are one call each:

```js
Object.fromEntries(map)            // out — only valid if keys are strings
new Map(Object.entries(obj))       // in
```

Note the asymmetry: converting **out** stringifies non-string keys and silently loses
the distinction between `1` and `"1"`. If your keys are objects or numbers, a `Map`
cannot round-trip through JSON at all without a custom encoding.

A `toJSON` on a subclass makes it automatic
([09 · stringify](../09-json/01-stringify.md)):

```js
class Registry extends Map {
  toJSON() { return Object.fromEntries(this); }
}
```

## Cost 2 — no literal syntax, and more ceremony

```js
const o = { a: 1, b: 2 };
const m = new Map([["a", 1], ["b", 2]]);

o.a;                    // property access
m.get("a");             // a method call

o.count = (o.count ?? 0) + 1;
m.set("count", (m.get("count") ?? 0) + 1);
```

There is no `Map` literal, no destructuring of a `Map`, no spread into one, and no
optional chaining shortcut. For a small fixed set of known keys — a config object, a
props bag, an options argument — the object is simply better code, and its "weaknesses"
never come up because the keys are yours and there are five of them.

`Map` also does not work with the tooling built around object shapes: TypeScript
interfaces, JSON Schema, and most validation libraries describe objects.

## Cost 3 — no structural typing

An object's shape is its type. A `Map<string, User>` says nothing about which keys
exist, so the compiler cannot tell you `config.get("retires")` is a typo where
`config.retires` would be caught. For a **known, fixed** set of keys, that is a real
loss.

For an **open, dynamic** set — user IDs, request IDs, arbitrary tags — there was never
any type safety to lose, and `Map` costs nothing.

## The decision rule

**Use a `Map` when the keys are data. Use an object when the keys are code.**

| Use a `Map` when | Use an object when |
|---|---|
| Keys come from **user input or data** — IDs, tags, filenames | Keys are **written by you** — a config, options, a props bag |
| Keys are **not strings** — objects, DOM nodes, numbers | Keys are a small known set of strings |
| The set is **open-ended** and changes at runtime | The shape is **fixed** and typed |
| You **add and remove** frequently | It is created once and read |
| **Insertion order** matters | Order is irrelevant |
| You need **`size`** or direct iteration | It has to be **JSON** |

The single clearest tell, repeated from earlier topics: **if you are calling `delete` in
a loop, you wanted a `Map`.** Close behind: if you have written
`Object.keys(o).length` in a hot path, or hit the numeric-key reordering, or reached for
`Object.create(null)` to keep user keys safe — all three are a `Map` in disguise.

## `Map` grouping and the ES2024 statics

```js
Map.groupBy(items, (i) => i.type);      // a Map, keyed by whatever the callback returns
Object.groupBy(items, (i) => i.type);   // a null-prototype object, string keys only
```

**Prefer `Map.groupBy`.** The grouping key is data — it is exactly the "keys are data"
case — and `Map.groupBy` keeps any key type and insertion order, where `Object.groupBy`
stringifies the key and re-sorts numeric ones.

Both replace the hand-written `reduce` that
[05 · When not to use `reduce`](../05-reduce/02-when-not-to-use-it.md) argues against.

## `WeakMap`, in one paragraph

A `WeakMap` holds its **keys weakly**: if nothing else references a key object, the entry
is collectable. Keys must be objects, and it is **not iterable** and has **no `size`** —
because the contents can change whenever the collector runs.

Its use is attaching data to an object you do not own without preventing that object
from being freed: per-DOM-node state, per-request metadata, private data keyed by
instance. A plain `Map` in that role is a **memory leak** — it keeps every key alive
forever. It is the last resort in this topic and gets its own Know-tier page later.

## Gotchas

**Symptom:** `JSON.stringify(map)` produced `{}`
**Cause:** MDN: *"Only enumerable own properties are visited. This means `Map`, `Set`,
etc. will become `"{}"`."*
**Fix:** `Object.fromEntries(map)` before serialising, or a `toJSON` on a subclass. Note
non-string keys do not survive.

**Symptom:** Round-tripping a `Map` through JSON lost the key types
**Cause:** `Object.fromEntries` stringifies keys, so `1` and `"1"` collapse.
**Fix:** Serialise as an array of pairs — `JSON.stringify([...map])` — and rebuild with
`new Map(parsed)`.

**Symptom:** `map.a` is `undefined`
**Cause:** `Map` entries are not properties. `map.a` reads a property that does not
exist.
**Fix:** `map.get("a")`. Note this fails silently, which is the main ergonomic hazard.

**Symptom:** A `Map` keyed by objects grows forever
**Cause:** A `Map` holds its keys **strongly**, so every key object stays reachable.
**Fix:** `WeakMap`, when the entry should die with the key.

**Symptom:** Spreading or destructuring a `Map` does not work as expected
**Cause:** `{...map}` gives `{}` (no own enumerable properties); `[...map]` gives an
array of `[k, v]` pairs.
**Fix:** `Object.fromEntries(map)` for an object, `[...map]` deliberately for pairs.

**Symptom:** `Object.groupBy` re-sorted numeric group keys
**Cause:** It produces an object, so integer-like keys enumerate ascending.
**Fix:** `Map.groupBy`.

## Interview questions

**★ When would you choose a `Map` over an object?**
**When the keys are data rather than code** — user IDs, tags, DOM nodes, anything
open-ended or non-string — and when insertion order, `size`, direct iteration, or
frequent add/remove matter. Use an object for a small fixed set of keys you wrote
yourself, and whenever the value has to be JSON.

**★ What is the biggest practical drawback of `Map`?**
**It does not serialise** — `JSON.stringify(map)` is `{}`, because only own enumerable
properties are visited. Since every network and storage boundary is JSON, objects
survive at the edges of the program. Converting out with `Object.fromEntries` also
stringifies non-string keys.

**★ How do you serialise a `Map` without losing key types?**
`JSON.stringify([...map])` — an array of `[key, value]` pairs — and rebuild with
`new Map(parsed)`. `Object.fromEntries` is only safe when the keys are already strings.

**★ `Map.groupBy` or `Object.groupBy`?**
`Map.groupBy`, in almost all cases. The grouping key is data, and `Map.groupBy` accepts
any key type and preserves insertion order, while `Object.groupBy` stringifies keys and
re-sorts integer-like ones.

**What does `WeakMap` do that `Map` cannot?**
It holds keys **weakly**, so an entry is collectable once nothing else references its key
object. That makes it the right tool for attaching data to objects you do not own — a
plain `Map` there is a memory leak. The cost is that keys must be objects, and it is
neither iterable nor sized.

**Why is `map.a` a silent bug?**
Because `Map` entries are not properties, so `map.a` is an ordinary property lookup that
finds nothing and yields `undefined` — no error. It is the main ergonomic hazard of
`Map`, and the reason a mixed codebase should be consistent about which it uses.

---

← [The six differences](./01-the-six-differences.md) · [Topic index](./README.md) · Next → [Phase index](../README.md)
