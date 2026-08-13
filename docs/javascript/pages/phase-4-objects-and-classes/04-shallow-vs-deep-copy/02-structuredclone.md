---
title: "04.2 · `structuredClone`"
sidebar_label: "02 · structuredClone"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-13 against MDN — [`structuredClone()`](https://developer.mozilla.org/en-US/docs/Web/API/Window/structuredClone), [The structured clone algorithm](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Structured_clone_algorithm). Documentation-validated.

**The deep clone the language now ships.** For a decade the answer to "how do I deep
clone?" was a JSON round trip or a library; `structuredClone` replaced both for most
cases, and knowing precisely where it stops is what makes it usable.

```js
const clone = structuredClone(value);
```

MDN: it *"creates a deep clone of a value using the structured clone algorithm"* —
the same algorithm that already moved values to Web Workers and IndexedDB, exposed
as a plain function.

## It handles cycles

This is the headline capability, and the thing a hand-written clone gets wrong
first:

```js
const original = { name: "MDN" };
original.itself = original;

const clone = structuredClone(original);

console.assert(clone !== original);      // different identity
console.assert(clone.name === "MDN");    // same values
console.assert(clone.itself === clone);  // circular reference preserved
```

Note the third assertion. The cycle is not merely *survived* — it is **rebuilt
correctly**, pointing at the clone rather than at the original. MDN describes the
mechanism: the algorithm *"clones by recursing through the input object while
maintaining a map of previously visited references, to avoid infinitely traversing
cycles."*

That visited-map is also what you must write yourself if you hand-roll a clone —
see [chunk 3](./03-json-and-hand-written.md).

## What it clones

MDN's supported list, for the JavaScript types you will actually meet:

> Array, ArrayBuffer, Boolean, DataView, Date, Error types, Map, Number, Object
> (plain objects only), Primitive types (except symbol), RegExp, Set, String,
> TypedArray

**`Map`, `Set`, `Date` and `RegExp` are the important ones**, because those are
exactly the types a JSON round trip destroys. A `Map` comes back as a `Map` with
cloned keys and values; a `Date` comes back as a `Date`, not a string.

The Web/API list is long — `Blob`, `File`, `FileList`, `ImageData`, `DOMException`,
`CryptoKey`, `DOMRect` and many more — which matters mostly in browser code.

## What it silently loses

This is the half people skip, and each item is a real bug waiting to happen. MDN's
"things that don't work" list:

**1. The prototype chain.** *"The prototype chain is not walked or duplicated."*

```js
class User { greet() { return "hi"; } }
const clone = structuredClone(new User());
clone.greet(); // TypeError — clone is a plain object
```

Same failure as spreading an instance. `structuredClone` deep-clones **data**, not
**types**. If your objects are class instances, this is the limit of the tool.

**2. Property descriptors, getters and setters.** *"Property descriptors, setters,
getters, and similar metadata-like features are not duplicated. For example, if an
object is marked readonly with a property descriptor, it will be read/write in the
duplicate, since that's the default."*

Read that example carefully: a **frozen or read-only object comes back writable**.
If you rely on a descriptor as a safety property, cloning silently removes it.
Getters are invoked and their values stored, as with spread.

**3. Class private elements.** *"Class private elements are not duplicated."*
Another consequence of it cloning data rather than types.

**4. `RegExp.lastIndex`.** *"The `lastIndex` property of `RegExp` objects is not
preserved."* A niche loss, but if you are cloning a stateful `/g` regex mid-scan,
the clone restarts from zero.

## What it throws on

**Functions and DOM nodes.** MDN is explicit on both:

> *"`Function` objects cannot be duplicated by the structured clone algorithm;
> attempting to throws a `DataCloneError` exception."*
> *"Cloning DOM nodes likewise throws a `DataCloneError` exception."*

The exception is a `DOMException` named `DataCloneError`, thrown *"if any part of
the input value is not serializable"*.

**This throwing is a feature.** Contrast the JSON round trip, which *silently drops*
functions — you get an object that looks fine and is missing behaviour, and you find
out later. `structuredClone` fails at the clone, naming the problem.

The practical consequence: **an options object with a callback in it cannot be
structured-cloned.** Neither can anything holding a DOM element, a class with
methods stored as own properties, a `Promise`, a `WeakMap`, or a `Symbol`.

## Transferables — moving rather than copying

```js
const uInt8Array = Uint8Array.from({ length: 1024 * 1024 * 16 }, (v, i) => i);

const transferred = structuredClone(uInt8Array, {
  transfer: [uInt8Array.buffer],
});
console.log(uInt8Array.byteLength); // 0 - original buffer is cleared
```

MDN: transferable objects *"can be moved (not cloned) to the new object"*, and
transferred objects are *"detached from the original"* and become inaccessible.

Note `byteLength` is **0** afterwards. This is ownership transfer, not copying —
the point is to move a large buffer without duplicating the memory. Use it when
handing a big `ArrayBuffer` somewhere and you are finished with the original;
**never** when the original still has readers, because they get an empty buffer with
no warning.

You can transfer a subset, cloning the rest:

```js
const transferred = structuredClone(
  { x: { y: { z: arrayBuffer1, w: arrayBuffer2 } } },
  { transfer: [arrayBuffer1] }, // only arrayBuffer1 is transferred
);
```

## When to use it

**Use `structuredClone` when** you need a genuinely independent copy of plain data:
a snapshot to diff against later, a defensive copy of input you are about to mutate,
or state you are handing to code you do not control. It handles cycles, `Map`,
`Set`, `Date` and typed arrays, which covers most real data.

**Do not use it when** your objects are class instances (the prototype is gone), you
depend on descriptors or frozen-ness (silently lost), or the graph contains
functions or DOM nodes (it throws). And do not use it as a reflex — most of the
time a shallow copy of the path you are changing is correct and much cheaper, as
[chunk 1](./01-what-shallow-means.md) argues.

## Gotchas

**Symptom:** `DataCloneError: … could not be cloned`
**Cause:** The graph contains something non-serialisable — a function, a DOM node, a
`Promise`, a `WeakMap`, or a symbol. MDN: functions and DOM nodes each *"throws a
`DataCloneError` exception."*
**Fix:** Strip the offending values first, or clone only the data sub-object.
Treat the throw as useful — a JSON round trip would have dropped them silently.

**Symptom:** A cloned object lost all its methods
**Cause:** *"The prototype chain is not walked or duplicated."* `structuredClone`
clones data, not types.
**Fix:** Reconstruct: `Object.assign(new User(), structuredClone(data))`, or give the
class a `clone()` method.

**Symptom:** A frozen or read-only object came back writable after cloning
**Cause:** MDN: property descriptors are not duplicated, so *"it will be read/write
in the duplicate, since that's the default."*
**Fix:** Re-`freeze` the clone, or re-apply descriptors with
`Object.defineProperties`. Do not rely on cloning to preserve a safety property.

**Symptom:** Private `#fields` are missing from the clone
**Cause:** *"Class private elements are not duplicated."*
**Fix:** Clone through a method on the class that has access to them.

**Symptom:** The original `ArrayBuffer` is empty after cloning — `byteLength` is `0`
**Cause:** It was passed in `transfer`, so it was **moved**, not copied, and detached
from the original.
**Fix:** Omit it from `transfer` if the original still has readers. Transfer only
when you are done with the source.

**Symptom:** A `/g` regex clone restarts matching from the beginning
**Cause:** *"The `lastIndex` property of `RegExp` objects is not preserved."*
**Fix:** Copy `lastIndex` across manually, or avoid cloning regexes mid-scan.

## Interview questions

**★ What is `structuredClone` and what does it handle that JSON does not?**
A built-in deep clone using the structured clone algorithm. It handles **cyclic
references** (rebuilding them to point at the clone), and preserves `Map`, `Set`,
`Date`, `RegExp`, typed arrays and `Error` types — all of which a JSON round trip
destroys or throws on.

**★ What does `structuredClone` lose?**
The **prototype chain**, so class instances come back as plain objects without
methods; **property descriptors, getters and setters**, so a read-only object comes
back writable; **class private elements**; and `RegExp.lastIndex`. It clones data,
not types.

**★ What does it throw on, and why is that better than the alternative?**
Functions and DOM nodes, with a `DataCloneError` `DOMException`. It is better
because `JSON.parse(JSON.stringify(x))` **silently drops** functions — you get an
object that looks correct and is missing behaviour, and you discover it later.
Failing at the clone names the problem.

**★ What is the `transfer` option?**
It **moves** transferable objects instead of copying them — the original is detached
and becomes inaccessible (`byteLength` goes to `0`). It exists to hand over a large
`ArrayBuffer` without duplicating the memory. Only use it when nothing still reads
the original.

**How would you deep clone a class instance?**
Not with `structuredClone` alone, since the prototype is lost. Either give the class
a `clone()` method that constructs a new instance, or clone the data and reattach:
`Object.assign(new User(), structuredClone(plainData))` — noting that private fields
still need the class's cooperation.

**Is `structuredClone` always the right deep-clone answer?**
No — first ask whether you need a deep clone at all. Immutable update patterns copy
only the changed path and share the rest deliberately. Reach for it when you need a
genuinely independent graph: a snapshot, a defensive copy, or data crossing a trust
boundary.

---

← [What shallow actually means](./01-what-shallow-means.md) · [Topic index](./README.md) · Next → [JSON round trips and hand-written clones](./03-json-and-hand-written.md)
