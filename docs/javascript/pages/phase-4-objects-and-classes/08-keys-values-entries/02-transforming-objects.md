---
title: "08.2 · Transforming objects"
sidebar_label: "02 · Transforming objects"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-13 against MDN — [`Object.fromEntries`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/fromEntries), [`Object.entries`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/entries). Documentation-validated.

**Objects have no `map` or `filter`.** `Object.entries` plus `Object.fromEntries` is
how you get them — convert to an array of pairs, use the array methods you already
know, convert back.

MDN: `Object.fromEntries()` *"transforms a list of key-value pairs into an object. It
performs the reverse of `Object.entries()`."*

## The round trip

```js
const object1 = { a: 1, b: 2, c: 3 };

const object2 = Object.fromEntries(
  Object.entries(object1).map(([key, val]) => [key, val * 2]),
);

console.log(object2);
// { a: 2, b: 4, c: 6 }
```

That is the whole pattern, and it generalises to everything:

```js
// map over VALUES
const doubled = Object.fromEntries(
  Object.entries(o).map(([k, v]) => [k, v * 2]),
);

// map over KEYS
const upper = Object.fromEntries(
  Object.entries(o).map(([k, v]) => [k.toUpperCase(), v]),
);

// FILTER
const defined = Object.fromEntries(
  Object.entries(o).filter(([, v]) => v !== undefined),
);

// PICK / OMIT
const pick = (o, keys) =>
  Object.fromEntries(Object.entries(o).filter(([k]) => keys.includes(k)));
```

Note the destructuring in the callbacks — `([k, v])` unpacks each pair, and `([, v])`
skips the key with an elision. That reads much better than `e => e[1]`, and it is why
`entries` is usually preferred over `keys` even when you only need values.

**A `pick` built this way is safer than `delete`.** It builds a new object with a
stable shape rather than mutating one and destabilising it — the argument from
[03 · `delete` and its cost](../03-existence-checks-and-delete/03-delete-and-its-cost.md).
And for the omit case, rest destructuring
(`const { password, ...rest } = user`) is shorter still.

## What `fromEntries` accepts

MDN: it *"accepts any iterable that implements the `[Symbol.iterator]()` method"*.
Not just arrays of pairs — **a `Map` works directly**:

```js
const map = new Map([
  ["foo", "bar"],
  ["baz", 42],
]);
const obj = Object.fromEntries(map);
console.log(obj); // { foo: "bar", baz: 42 }
```

MDN: *"With `Object.fromEntries`, you can convert from `Map` to `Object`."* And the
reverse is just as direct, because `Object.entries` produces exactly the pair array
the `Map` constructor takes:

```js
const map = new Map(Object.entries(obj));   // Object → Map
const obj = Object.fromEntries(map);        // Map → Object
```

**That pair is worth memorising.** It is the bridge between the two representations,
and it is how you get an object's data into a structure with real insertion order and
non-string keys — the fix for every ordering complaint in
[chunk 1](./01-what-they-include.md).

MDN adds one implementation note: *"Unlike `Array.from()`, `Object.fromEntries()`
does not use the value of `this`, so calling it on another constructor does not
create objects of that type."* You always get a plain object.

## Web APIs that speak the same protocol

Several browser APIs are iterables of key-value pairs, so they drop straight in:

```js
Object.fromEntries(new URLSearchParams("a=1&b=2"));  // { a: "1", b: "2" }
Object.fromEntries(new FormData(formElement));       // { field: "value", … }
Object.fromEntries(response.headers);                // { "content-type": …, … }
```

The `URLSearchParams` and `FormData` cases are the everyday ones — turning a query
string or a submitted form into a plain object in a single expression.

🔴 **But both can carry repeated keys**, and an object cannot:

```js
Object.fromEntries(new URLSearchParams("tag=a&tag=b")); // { tag: "b" } — 'a' is LOST
```

Later entries overwrite earlier ones, silently, because that is ordinary object
assignment. For a query string with repeated parameters — `?tag=a&tag=b`, a
multi-select form field — use `params.getAll("tag")` instead, or keep the
`URLSearchParams` object. **The conversion is lossy exactly where the source allows
duplicates.**

## What the round trip loses

Every restriction from [chunk 1](./01-what-they-include.md) applies to the *output*
of `Object.entries`, so anything it could not see cannot come back:

| Lost in an `entries` → `fromEntries` round trip | Why |
|---|---|
| **symbol-keyed properties** | `entries` is string-keyed only |
| **non-enumerable properties** | `entries` is enumerable only |
| **inherited properties and methods** | `entries` is own-only |
| **the prototype** | `fromEntries` always builds a plain object |
| **getters and setters** | `entries` *invokes* getters and stores the value |
| **property descriptors** | flags reset to the assignment defaults |
| **key order for numeric keys** | re-sorted ascending on the way out |

So the round trip is a **shallow, plain-object normalisation** — closely related to
spread (`{ ...o }`), which copies own enumerable string *and symbol* keys and is the
better choice when you are not transforming anything.

Values are copied by reference, so nested objects are still shared. This is a shallow
operation, and everything in
[04 · Shallow vs deep copy](../04-shallow-vs-deep-copy/README.md) applies.

## When to reach for something else

- **Just copying?** `{ ...o }` — shorter, and it keeps symbol keys.
- **Just iterating?** `for (const [k, v] of Object.entries(o))` — no intermediate
  object, and `break`/`continue` work.
- **Keys that are not strings, or order that matters?** A `Map`. Stop converting.
- **Large objects in a hot path?** The round trip allocates an array of N pair arrays
  and then a fresh object. For a handful of keys this is irrelevant; inside a
  per-frame or per-request loop, a plain `for...of` over `Object.keys` with direct
  assignment avoids the intermediate arrays. No measurement here — just note it is not
  free.
- **Repeated keys in the source?** Do not convert to an object at all.

## Gotchas

**Symptom:** A query-string parameter that appeared twice has only one value
**Cause:** `Object.fromEntries` on `URLSearchParams` assigns each pair in turn, so the
last duplicate wins.
**Fix:** `params.getAll("tag")`, or keep the `URLSearchParams`. An object cannot
represent repeated keys.

**Symptom:** A transformed object lost its symbol keys or its class methods
**Cause:** `Object.entries` sees only own, enumerable, string-keyed properties, and
`fromEntries` always produces a plain object.
**Fix:** Use `{ ...o }` for a copy that keeps symbols, or `Reflect.ownKeys` plus
`Object.defineProperty` for a faithful reconstruction.

**Symptom:** A getter turned into a fixed value after transforming
**Cause:** `Object.entries` **invokes** getters and stores the returned value.
**Fix:** Copy descriptors with `Object.getOwnPropertyDescriptors` if the accessor
must stay live.

**Symptom:** `TypeError: Iterator value … is not an entry object`
**Cause:** `fromEntries` was given an iterable whose items are not two-element
key-value pairs.
**Fix:** Check the shape — `.map()` callbacks must **return** `[key, value]`. A
missing `return` in a block-bodied arrow is the usual cause.

**Symptom:** Numeric keys are reordered after a round trip
**Cause:** `Object.entries` emits integer-index keys ascending, and rebuilding the
object preserves that.
**Fix:** Use a `Map` — `new Map(Object.entries(o))` keeps insertion order for
everything.

**Symptom:** Nested objects are still shared after "copying" via the round trip
**Cause:** It is **shallow** — values are copied by reference.
**Fix:** `structuredClone` if you need an independent graph.

## Interview questions

**★ How do you `map` over an object's values?**
`Object.fromEntries(Object.entries(o).map(([k, v]) => [k, f(v)]))` — MDN's own
example doubles every value this way. Objects have no `map`/`filter`, so you convert
to pairs, use the array methods, and convert back.

**★ How do you convert between a `Map` and an object?**
`Object.fromEntries(map)` and `new Map(Object.entries(obj))`. `fromEntries` accepts
*any* iterable of pairs — MDN: *"any iterable that implements the
`[Symbol.iterator]()` method"* — and a `Map` is one, so no adapter is needed.

**★ What is lost in an `entries` → `fromEntries` round trip?**
Symbol keys, non-enumerable properties, everything inherited, the prototype, accessors
(getters are invoked and their values stored), property descriptors, and the original
order of numeric keys. It is a shallow, plain-object normalisation.

**★ Why is `Object.fromEntries(new URLSearchParams(qs))` risky?**
Because a query string may repeat a key and an object cannot. `"tag=a&tag=b"` becomes
`{ tag: "b" }` — the first value is silently lost. Use `getAll` for parameters that
can repeat.

**When would you not use this pattern?**
When you are only copying (`{ ...o }` is shorter and keeps symbols); when you are only
iterating (`for...of` over `Object.entries` needs no intermediate object and supports
`break`); when keys are not strings or order matters (use a `Map`); and in a hot path,
where the intermediate pair arrays are avoidable allocation.

**Why prefer `Object.entries` over `Object.keys` when you need values?**
Because destructuring the pair (`([k, v]) => …`) reads far better than
`k => [k, o[k]]`, and it avoids a second property lookup per key. `Object.keys` is
right when you genuinely only need the names.

---

← [What they include and what they skip](./01-what-they-include.md) · [Topic index](./README.md) · Next → [Phase index](../README.md)
