---
title: "06.1 · Writing it"
sidebar_label: "01 · Writing it"
sidebar_position: 1
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-15 against MDN — [`structuredClone()`](https://developer.mozilla.org/en-US/docs/Web/API/Window/structuredClone), [Structured clone algorithm](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Structured_clone_algorithm), [`Map`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map), [`Object.getOwnPropertyDescriptors()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/getOwnPropertyDescriptors). Documentation-validated; **nothing was run**.

"Write a deep clone" is a question about **how many cases you remember**, not about
recursion. The recursion is four lines. The interview is arrays versus plain objects,
`Date`, `RegExp`, `Map`, `Set`, cycles, and knowing that the platform already ships one.

## The version worth writing

```js
function deepClone(value, seen = new WeakMap()) {
  // 1. primitives and functions — return as-is
  if (value === null || typeof value !== "object") return value;

  // 2. cycles and shared references
  if (seen.has(value)) return seen.get(value);

  // 3. the built-ins that are not plain objects
  if (value instanceof Date) return new Date(value.getTime());
  if (value instanceof RegExp) return new RegExp(value.source, value.flags);

  // 4. containers — register BEFORE recursing
  if (Array.isArray(value)) {
    const out = [];
    seen.set(value, out);
    for (const item of value) out.push(deepClone(item, seen));
    return out;
  }
  if (value instanceof Map) {
    const out = new Map();
    seen.set(value, out);
    for (const [k, v] of value) out.set(deepClone(k, seen), deepClone(v, seen));
    return out;
  }
  if (value instanceof Set) {
    const out = new Set();
    seen.set(value, out);
    for (const v of value) out.add(deepClone(v, seen));
    return out;
  }

  // 5. plain objects — keep the prototype, copy symbol keys too
  const out = Object.create(Object.getPrototypeOf(value));
  seen.set(value, out);
  for (const key of Reflect.ownKeys(value)) out[key] = deepClone(value[key], seen);
  return out;
}
```

Every numbered block is a question someone will ask.

## Why each block is there

**1 · Primitives fall straight through.** `typeof null === "object"` is the reason `null` is
tested first — the classic ordering bug
([Phase 1 · Values and coercion](../../phase-1-values-and-coercion/README.md)). Functions are
returned by reference on purpose: a function is not data, and there is no meaningful way to
copy one.

**2 · Cycles.** `const a = {}; a.self = a;` makes a naive clone recurse forever. A `WeakMap`
from original → clone fixes it, and — just as importantly — **preserves shared references**:
if two properties point at the same object, the clone's two properties point at the same
clone. A `Map` would work too, but `WeakMap` does not keep the originals alive
(**Phase 5 · 23 · `WeakMap`/`WeakSet`** *(not written yet)*).

**3 · `Date` and `RegExp` are objects whose state is internal.** `{...date}` gives `{}` and
recursing over a `Date`'s own keys gives nothing, because the time value is an internal slot,
not a property. Same for `RegExp` — copy `source` and `flags`, and note that MDN lists the
`lastIndex` property of `RegExp` objects among the things structured cloning does *not*
preserve either.

**4 · Register the clone before recursing.** `seen.set(value, out)` must happen *before* the
loop, or a cycle re-enters `deepClone` for the same object before it has been registered and
recursion never terminates. This is the line most hand-written clones get wrong.

**5 · `Reflect.ownKeys` and the prototype.** `Object.keys` misses symbol keys and
non-enumerable properties; `Reflect.ownKeys` gets both string and symbol own keys.
`Object.create(Object.getPrototypeOf(value))` keeps a class instance's prototype so methods
still work — which is more than the platform's own clone does.

## What this version still does not do

Be able to say this list out loud; it is what separates "I wrote a clone" from "I know what
a clone is":

- **Getters and setters become plain data.** Reading `value[key]` invokes a getter and stores
  the result. Preserving accessors means copying descriptors instead:
  `Object.defineProperties(out, Object.getOwnPropertyDescriptors(value))` — but then nested
  values are not cloned, so a correct version has to walk descriptors and recurse into
  `descriptor.value` only.
- **Non-enumerable and read-only flags are lost** by plain assignment, for the same reason.
- **Private class fields (`#x`) cannot be copied** from outside the class. Nothing can reach
  them; a class that must be cloneable needs its own `clone()` method.
- **Objects with identity are copied when they should not be.** A DOM node, a socket, a
  `WeakRef` — cloning them is meaningless.

## The one-liner people reach for, and why it is wrong

```js
const copy = JSON.parse(JSON.stringify(original));
```

It is fast to type and silently lossy:

| Input | Result |
|---|---|
| `undefined`, functions, symbols (as object values) | **dropped** |
| `Date` | becomes an ISO **string** |
| `Map`, `Set` | becomes `{}` |
| `NaN`, `Infinity` | becomes `null` |
| `BigInt` | **throws** `TypeError` |
| Cyclic object | **throws** `TypeError: circular structure` |
| Class instance | becomes a plain object |
| Getter | evaluated, then stored as data |

**The `Date`-to-string one is the bug that ships**, because everything still "works" until
something calls `.getTime()` three screens away
([Phase 5 · 09 · JSON](../../phase-5-built-in-library/09-json/README.md)). Use it only for
data you know is JSON to begin with — a payload straight off the wire — and say so.

## Gotchas

**Symptom:** `RangeError: Maximum call stack size exceeded`
**Cause:** A cyclic reference, or registering the clone *after* recursing.
**Fix:** A `WeakMap` of original → clone, populated **before** the recursive walk.

**Symptom:** `typeof null === "object"` sent `null` down the object branch
**Cause:** The `null` check came after the `typeof` check.
**Fix:** Test `value === null` first.

**Symptom:** Cloned `Date`s became `{}`
**Cause:** A `Date`'s time is an internal slot, not an own property.
**Fix:** `new Date(value.getTime())`, before the plain-object branch.

**Symptom:** Two properties that shared an object no longer share it after cloning
**Cause:** No `seen` map, so each path cloned it separately.
**Fix:** The same `WeakMap` that fixes cycles preserves sharing.

**Symptom:** Cloned class instances lost their methods
**Cause:** `{...obj}` or a fresh `{}` — methods live on the prototype.
**Fix:** `Object.create(Object.getPrototypeOf(value))`, and accept that `#private` fields
still cannot come along.

**Symptom:** Getters turned into fixed values
**Cause:** `out[key] = value[key]` invokes the getter and stores the result.
**Fix:** Walk `Object.getOwnPropertyDescriptors` and re-define accessors — or accept it, and
say so.

**Symptom:** `JSON.parse(JSON.stringify(x))` lost half the object
**Cause:** JSON has no `undefined`, `Date`, `Map`, `Set`, `NaN` or `BigInt`.
**Fix:** `structuredClone`, or a hand-written clone.

## Interview questions

**★ Write a deep clone.**
Return primitives and functions as-is (checking `null` before `typeof`); look the value up in
a `WeakMap` of already-cloned objects; special-case `Date`, `RegExp`, `Map`, `Set` and arrays;
otherwise create an object with the same prototype, **register it in the map before
recursing**, and copy `Reflect.ownKeys`.

**★ Why is the `seen` map registered before the recursion?**
Because a cycle re-enters the function for the same object while it is still being built. If
it has not been registered yet, the lookup misses and the recursion never terminates.

**★ What does `JSON.parse(JSON.stringify(x))` lose?**
`undefined`, functions and symbol values are dropped; `Date` becomes a string; `Map` and
`Set` become `{}`; `NaN`/`Infinity` become `null`; `BigInt` throws; cycles throw; class
instances become plain objects; getters are flattened.

**★ Why do `Date` and `Map` need special cases?**
Their contents live in internal slots rather than own properties, so a generic
walk-the-own-keys clone produces an empty object with the right prototype.

**What can a hand-written clone never copy?**
Private class fields — nothing outside the class can read them — and anything whose identity
is the point: DOM nodes, sockets, live handles.

**Does your clone preserve getters?**
Not as written: reading the property invokes the getter. Preserving accessors means copying
property descriptors and recursing only into `descriptor.value`.

---

[Topic index](./README.md) · Next → [Use `structuredClone`](./02-use-structuredclone.md)
