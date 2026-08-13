---
title: "04.3 · JSON round trips and hand-written clones"
sidebar_label: "03 · JSON and hand-written clones"
sidebar_position: 3
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-13 against MDN — [`JSON.stringify`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/JSON/stringify), [The structured clone algorithm](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Structured_clone_algorithm). Documentation-validated.

The old answer and the interview answer. `JSON.parse(JSON.stringify(x))` is still
the most-written deep clone in JavaScript and is **lossy in seven documented ways**;
writing one by hand is a standard interview question whose real content is cycles.

## The JSON round trip loses seven things

Every item below is documented on MDN's `JSON.stringify` page.

**1. `undefined`, functions and symbols — dropped or nulled depending on where they
are.** MDN: *"`undefined`, `Function`, and `Symbol` values are not valid JSON
values. If any such values are encountered during conversion, they are either
omitted (when found in an object) or changed to `null` (when found in an array)."*

```js
JSON.stringify({ x: [10, undefined, function () {}, Symbol("")] });
// '{"x":[10,null,null,null]}'

JSON.stringify({ x: undefined, y: Object, z: Symbol("") });
// '{}'
```

**The inconsistency is the danger.** The same value vanishes in an object and
becomes `null` in an array — so a round trip silently changes an array's contents
while merely shrinking an object's. A function stored as a property is gone with no
error at all.

**2. `Infinity` and `NaN` become `null`.** MDN: *"The numbers `Infinity` and `NaN`,
as well as the value `null`, are all considered `null`."*

```js
JSON.stringify([NaN, null, Infinity]); // '[null,null,null]'
```

A `NaN` that meant "no reading" comes back as `null`, and three distinct values
collapse into one.

**3. `Date` becomes a string.** MDN: *"`Date` objects implement `toJSON()`, which
returns the same as `toISOString()`."*

```js
JSON.stringify(new Date(1906, 0, 2, 15, 4, 5));
// '"1906-01-02T15:04:05.000Z"'
```

So `clone.createdAt.getTime()` throws — the clone holds a string. This is the single
most common JSON-clone bug in application code, because dates are everywhere and the
failure appears far from the clone.

**4. `Map`, `Set`, `WeakMap`, `WeakSet` become `{}`.** MDN: *"Only enumerable own
properties are visited. This means `Map`, `Set`, etc. will become `"{}"`."*

```js
JSON.stringify([new Set([1]), new Map([[1, 2]]), new WeakSet([{ a: 1 }]), new WeakMap([[{ a: 1 }, 2]])]);
// '[{},{},{},{}]'
```

Total, silent data loss — the contents live in internal slots, not own properties.

**5. `BigInt` throws.** *"Attempting to serialize `BigInt` values will throw."*

```js
JSON.stringify({ x: 2n }); // TypeError: BigInt value can't be serialized in JSON
```

**6. Cycles throw.** *"a `TypeError` will be thrown if one attempts to encode an
object with circular references."*

```js
const circularReference = {};
circularReference.myself = circularReference;
JSON.stringify(circularReference); // TypeError: cyclic object value
```

This is the hard limit: **the JSON round trip cannot clone a cyclic graph at all.**

**7. Symbol keys and non-enumerable properties are ignored.** *"All `Symbol`-keyed
properties will be completely ignored, even when using the `replacer` parameter"*,
and only enumerable own properties are visited:

```js
JSON.stringify({ [Symbol("foo")]: "foo" }); // '{}'

JSON.stringify(
  Object.create(null, {
    x: { value: "x", enumerable: false },
    y: { value: "y", enumerable: true },
  }),
); // '{"y":"y"}'
```

And, as with every copy in this topic, **the prototype is lost** — the result is
always plain objects and arrays.

### So when is a JSON round trip acceptable?

When the data is **already JSON-shaped** — it came from an API response or is going
to one, so it contains only objects, arrays, strings, finite numbers, booleans and
`null`, with no cycles. That is a real and common situation, and in it the round trip
is correct and unsurprising.

Outside that, `structuredClone` does strictly more and fails loudly instead of
silently. There is no remaining reason to reach for JSON *as a cloning technique*
in a modern runtime.

## Writing a deep clone by hand

The interview question. A first attempt usually looks like this:

```js
function deepClone(value) {
  if (value === null || typeof value !== "object") return value; // primitives
  if (Array.isArray(value)) return value.map(deepClone);
  return Object.fromEntries(
    Object.entries(value).map(([k, v]) => [k, deepClone(v)]),
  );
}
```

That is a reasonable answer and it is **wrong on a cycle** — infinite recursion until
`RangeError: Maximum call stack size exceeded`. The fix is the same one MDN
describes the structured clone algorithm using: *"maintaining a map of previously
visited references, to avoid infinitely traversing cycles."*

```js
function deepClone(value, seen = new WeakMap()) {
  if (value === null || typeof value !== "object") return value;

  // already cloned this exact object — return the SAME clone, preserving identity
  if (seen.has(value)) return seen.get(value);

  // built-ins that need their own constructor
  if (value instanceof Date) return new Date(value);
  if (value instanceof RegExp) return new RegExp(value.source, value.flags);

  const result = Array.isArray(value) ? [] : {};
  seen.set(value, result);            // ← register BEFORE recursing

  if (value instanceof Map) {
    const map = new Map();
    seen.set(value, map);
    for (const [k, v] of value) map.set(deepClone(k, seen), deepClone(v, seen));
    return map;
  }
  if (value instanceof Set) {
    const set = new Set();
    seen.set(value, set);
    for (const v of value) set.add(deepClone(v, seen));
    return set;
  }

  for (const key of Reflect.ownKeys(value)) {
    result[key] = deepClone(value[key], seen);
  }
  return result;
}
```

**The four things being demonstrated, which is what the question is actually
testing:**

1. **`seen.set(value, result)` happens *before* recursing.** This is the whole
   trick. Register the (still empty) clone first, so when the recursion comes back
   around to the same object it finds the clone already in the map. Doing it after
   the loop does not terminate.
2. **A `WeakMap`, not a `Map`.** Keys are held weakly, so the bookkeeping does not
   pin every visited object in memory for the duration.
3. **Identity is preserved, not just cycles.** If two properties point at the *same*
   object, the clone's two properties point at the same *clone* — because the second
   visit is a cache hit. A naive clone would produce two separate copies and quietly
   change the graph's shape.
4. **Built-ins need explicit handling.** `Date`, `RegExp`, `Map` and `Set` are not
   reconstructible from their own enumerable properties, so each needs its
   constructor.

**What this still does not do**, and you should say so rather than being caught out:
it drops the prototype (plain object result), it does not copy property descriptors
or accessors — `value[key]` *invokes* getters — and it cannot handle private fields.
Fixing the first two means `Object.create(Object.getPrototypeOf(value))` plus
`Object.getOwnPropertyDescriptors`, at which point you have reimplemented a library.

**And the honest conclusion:** in production, call `structuredClone`. The
hand-written version exists to demonstrate that you understand cycles and identity,
not because you should ship it.

## Gotchas

**Symptom:** `clone.createdAt.getTime is not a function`
**Cause:** A JSON round trip turned the `Date` into an ISO string — `Date` implements
`toJSON()` returning `toISOString()` (MDN).
**Fix:** `structuredClone`, which preserves `Date`. Or revive with the `JSON.parse`
reviver argument.

**Symptom:** A cloned object is missing a callback property, with no error
**Cause:** Functions are *"omitted (when found in an object)"* by `JSON.stringify`.
**Fix:** `structuredClone` throws `DataCloneError` instead, which is what you want.
Keep functions out of data you clone.

**Symptom:** `null` appears where an array element used to be
**Cause:** `undefined`, functions and symbols are *"changed to `null` (when found in
an array)"* — the opposite treatment from objects.
**Fix:** `structuredClone`, which preserves `undefined` in arrays.

**Symptom:** `TypeError: cyclic object value` / `Converting circular structure to
JSON`
**Cause:** `JSON.stringify` throws on circular references (MDN).
**Fix:** `structuredClone`, which rebuilds cycles correctly.

**Symptom:** `RangeError: Maximum call stack size exceeded` from a hand-written clone
**Cause:** No visited-map, so a cycle recurses forever.
**Fix:** A `WeakMap` of source → clone, populated **before** recursing into
children.

**Symptom:** A hand-written clone turned one shared nested object into two separate
copies
**Cause:** No visited-map, so each path to the object cloned it again. The graph's
shape changed even without a cycle.
**Fix:** The same `WeakMap` — a cache hit returns the existing clone and preserves
identity.

**Symptom:** `NaN` or `Infinity` became `null` after a round trip
**Cause:** MDN: *"`Infinity` and `NaN`, as well as the value `null`, are all
considered `null`."*
**Fix:** `structuredClone`, or encode the sentinel explicitly if the data must be
JSON.

## Interview questions

**★ What does `JSON.parse(JSON.stringify(x))` lose?**
Seven things: `undefined`/functions/symbols (dropped in objects, **nulled in
arrays**); `NaN` and `Infinity` become `null`; `Date` becomes a string; `Map`/`Set`
become `{}`; symbol keys and non-enumerable properties are ignored; the prototype is
lost. And it **throws** on `BigInt` and on cycles.

**★ Write a deep clone that handles cycles.**
Recurse over the value; return primitives as-is; keep a **`WeakMap` from source
object to its clone**, and **register the clone before recursing into children** so
a cycle finds it. Handle `Date`, `RegExp`, `Map` and `Set` with their own
constructors. The map also preserves **identity** — two properties pointing at one
object still do after cloning.

**★ Why must the visited-map be populated before recursing?**
Because the cycle is discovered *during* the recursion into children. If the clone
is only registered after the loop finishes, the recursive call finds nothing in the
map, clones again, and never terminates.

**★ When is a JSON round trip an acceptable deep clone?**
When the data is already JSON-shaped — objects, arrays, strings, finite numbers,
booleans and `null`, with no cycles — which is typical for an API payload. Outside
that, `structuredClone` does strictly more and fails loudly rather than silently.

**Why a `WeakMap` rather than a `Map` for the visited set?**
So the bookkeeping holds its keys weakly and does not keep every visited object
alive for the duration of the clone. The map is scratch state, and it should not
extend the lifetime of the graph being cloned.

**What does your hand-written clone still get wrong?**
It produces plain objects, so the prototype is lost; it reads `value[key]`, which
**invokes getters** and stores their results rather than copying accessors; it
ignores property descriptors, so frozen or read-only becomes writable; and private
fields are inaccessible. Fixing those means `Object.create` plus
`getOwnPropertyDescriptors` — at which point `structuredClone` is the better answer.

---

← [`structuredClone`](./02-structuredclone.md) · [Topic index](./README.md) · Next → [Phase index](../README.md)
