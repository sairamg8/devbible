---
title: "09.1 · `JSON.stringify` and what it drops"
sidebar_label: "01 · stringify"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-13 against MDN — [`JSON.stringify`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/JSON/stringify). Documentation-validated.

**`JSON.stringify` is lossy, and it is lossy silently.** It throws on exactly two
things and quietly discards or transforms half a dozen others. Knowing which is which
is the whole topic.

## What it silently drops or changes

**`undefined`, functions and symbols.** MDN: *"`undefined`, `Function`, and `Symbol`
values are not valid JSON values. If any such values are encountered during conversion,
they are either **omitted** (when found in an object) or changed to **`null`** (when
found in an array)."*

```js
JSON.stringify({ x: [10, undefined, function () {}, Symbol("")] });
// '{"x":[10,null,null,null]}'

JSON.stringify({ x: undefined, y: Object, z: Symbol("") });
// '{}'
```

🔴 **The inconsistency is the danger**: the same value **vanishes** in an object and
becomes **`null`** in an array. So a round trip silently shortens an object and silently
changes an array's contents. A function stored as a property is gone with no warning.

**`Infinity` and `NaN` become `null`.** MDN: *"The numbers `Infinity` and `NaN`, as well
as the value `null`, are all considered `null`."*

```js
JSON.stringify([NaN, null, Infinity]); // '[null,null,null]'
```

Three distinct values collapse into one — a `NaN` meaning "no reading" is
indistinguishable from an explicit `null` after serialising.

**`Date` becomes a string**, because `Date` implements `toJSON`:

```js
JSON.stringify(new Date(1906, 0, 2, 15, 4, 5));
// '"1906-01-02T15:04:05.000Z"'
```

So `JSON.parse(JSON.stringify(x)).createdAt.getTime()` throws — the clone holds a
string. **The single most common JSON bug in application code**, because dates are
everywhere and the failure appears far from the serialisation.

**`Map`, `Set`, `WeakMap`, `WeakSet` become `{}`.** MDN: *"Only enumerable own
properties are visited. This means `Map`, `Set`, etc. will become `"{}"`."*

```js
JSON.stringify([new Set([1]), new Map([[1, 2]]), new WeakSet([{ a: 1 }]), new WeakMap([[{ a: 1 }, 2]])]);
// '[{},{},{},{}]'
```

Total, silent data loss — their contents live in internal slots, not own properties.

**Symbol keys and non-enumerable properties are skipped.** MDN: *"All `Symbol`-keyed
properties will be completely ignored, even when using the `replacer` parameter"*:

```js
JSON.stringify({ [Symbol("foo")]: "foo" }); // '{}'

JSON.stringify(
  Object.create(null, {
    x: { value: "x", enumerable: false },
    y: { value: "y", enumerable: true },
  }),
); // '{"y":"y"}'
```

**And the prototype is gone** — the output is always plain objects and arrays, so class
instances lose their methods.

**`JSON.stringify` sees exactly the set `Object.keys` sees**: own, enumerable,
string-keyed. That equivalence, from
[Phase 4 · 08](../../phase-4-objects-and-classes/08-keys-values-entries/01-what-they-include.md),
answers "what will this serialise to?" in one step.

## What it throws on

Only two things, and both are loud:

```js
JSON.stringify({ x: 2n });
// TypeError: BigInt value can't be serialized in JSON

const circularReference = {};
circularReference.myself = circularReference;
JSON.stringify(circularReference);
// TypeError: cyclic object value
```

MDN on `BigInt`: *"This constraint ensures that a proper serialization (and, very
likely, its accompanying deserialization) behavior is always explicitly provided by the
user."* In other words, the language refuses to guess whether your `BigInt` should
become a string or a number.

**A cycle is a hard limit** — there is no option to make `JSON.stringify` handle one.
`structuredClone` does ([Phase 4 · 04](../../phase-4-objects-and-classes/04-shallow-vs-deep-copy/02-structuredclone.md)),
but it does not produce a string.

## `toJSON` — the hook

Any object with a `toJSON()` method has that method's **return value** serialised
instead of the object. `Date` uses it, and so can you:

```js
class Money {
  constructor(cents) { this.cents = cents; }
  toJSON() { return { amount: this.cents / 100, currency: "GBP" }; }
}

JSON.stringify({ price: new Money(1250) });
// '{"price":{"amount":12.5,"currency":"GBP"}}'
```

This is the clean answer for a class that must serialise — better than a `replacer`,
because it lives with the type and applies everywhere the object is stringified. It is
also how you serialise a `Map`:

```js
class Registry extends Map {
  toJSON() { return Object.fromEntries(this); }
}
```

## The `replacer`

Two forms.

**As a function**, called for every key — including the root, with key `""`:

```js
JSON.stringify(obj, (key, value) =>
  key === "password" ? undefined : value,   // returning undefined omits the key
);
```

Returning `undefined` **omits** the property, which makes the function form the
general-purpose redactor. It applies at every level, so nested `password` fields are
removed too.

**As an array**, an allowlist of keys to include:

```js
JSON.stringify(user, ["id", "name"]);   // '{"id":1,"name":"Ada"}'
```

The array form is a **deny-by-default** filter, which is the safer shape for anything
crossing a trust boundary — a new field added to the model does not accidentally leak.

Note MDN's caveat: symbol-keyed properties are ignored *"even when using the `replacer`
parameter"* — you cannot re-include them.

## The `space` argument

```js
JSON.stringify(obj, null, 2);     // indent with 2 spaces
JSON.stringify(obj, null, "\t");  // indent with tabs
```

The third argument pretty-prints. Numbers are clamped to 10; a string is used
literally (and truncated to 10 characters).

**Use it for logs and files, not for network payloads** — indentation is bytes on the
wire that nothing reads.

Note that `JSON.stringify(a) === JSON.stringify(b)` is a tempting deep-equality check
and is **not one**: key order follows the object's own enumeration order
([Phase 4 · 01](../../phase-4-objects-and-classes/01-object-literals/03-keys-and-order.md)),
so two objects with the same content in a different insertion order produce different
strings.

## Gotchas

**Symptom:** A `Date` came back as a string after a round trip
**Cause:** `Date` implements `toJSON`, returning the ISO string.
**Fix:** Revive it — [chunk 2](./02-parse-and-the-reviver.md) — or use `structuredClone`
when you want a clone rather than a string.

**Symptom:** A property vanished from the output with no error
**Cause:** Its value is `undefined`, a function or a symbol — *"omitted (when found in an
object)"*.
**Fix:** Expected. If the key must appear, use `null`.

**Symptom:** An array element became `null`
**Cause:** The same values are *"changed to `null` (when found in an array)"* — the
opposite treatment from objects.
**Fix:** Normalise before serialising if the receiver distinguishes them.

**Symptom:** `TypeError: cyclic object value` / `Converting circular structure to JSON`
**Cause:** A cycle. There is no option to handle it.
**Fix:** Break the cycle with a `replacer` that tracks seen objects, or use
`structuredClone` if you need a clone rather than a string.

**Symptom:** `TypeError: BigInt value can't be serialized in JSON`
**Cause:** Deliberate — MDN says the serialisation must be *"explicitly provided by the
user"*.
**Fix:** A `toJSON` on the wrapper, or a `replacer` converting `BigInt` to a string.

**Symptom:** A `Map` serialised as `{}`
**Cause:** Only own enumerable properties are visited; a `Map`'s entries are internal.
**Fix:** `Object.fromEntries(map)`, or a `toJSON` on a `Map` subclass.

**Symptom:** `JSON.stringify(a) === JSON.stringify(b)` says two equal objects differ
**Cause:** Key order follows enumeration order, which depends on insertion and on
integer-like keys sorting first.
**Fix:** Use a real deep-equality function, or sort keys with a `replacer` first.

## Interview questions

**★ What does `JSON.stringify` silently drop?**
`undefined`, functions and symbols — **omitted in objects, turned into `null` in
arrays**; `NaN` and `Infinity` become `null`; `Map`/`Set` become `{}`; symbol-keyed and
non-enumerable properties are skipped; and the prototype is lost. It sees exactly the
set `Object.keys` sees.

**★ What does it throw on?**
Only **`BigInt`** and **cycles**. MDN explains the `BigInt` refusal as forcing the user
to provide an explicit serialisation. A cycle is a hard limit with no option to work
around it in `JSON.stringify`.

**★ What is `toJSON`?**
A method the serialiser calls, using its **return value** instead of the object. `Date`
implements it — which is why dates become ISO strings. Adding it to your own class is
the cleanest way to control serialisation, because it travels with the type instead of
living in a `replacer` at every call site.

**★ What are the two `replacer` forms?**
A **function** called for every key (returning `undefined` omits that property — the
general-purpose redactor), or an **array of keys** acting as an allowlist. The array
form is deny-by-default, which is safer for anything crossing a trust boundary.

**Is `JSON.stringify(a) === JSON.stringify(b)` a valid deep-equality check?**
No. Key order follows the object's enumeration order, so the same content inserted in a
different order produces a different string. It also fails for every value the format
cannot represent.

**How do you serialise a `Map`?**
`Object.fromEntries(map)` if the keys are strings, or a `toJSON` on a `Map` subclass.
By default it becomes `{}`, because only own enumerable properties are visited.

---

[Topic index](./README.md) · Next → [`JSON.parse` and the reviver](./02-parse-and-the-reviver.md)
