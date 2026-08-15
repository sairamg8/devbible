---
title: "06.2 · Use `structuredClone` — and know what it does not do"
sidebar_label: "02 · Use `structuredClone`"
sidebar_position: 2
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-15 against MDN — [`structuredClone()`](https://developer.mozilla.org/en-US/docs/Web/API/Window/structuredClone) and [Structured clone algorithm](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Structured_clone_algorithm). Documentation-validated; **nothing was run**.

The clone in [06.1](./01-writing-it.md) is an interview answer. **In real code, the platform
already ships one**, it is the same algorithm `postMessage` and IndexedDB use, and it handles
cases a hand-written version usually does not.

```js
const clone = structuredClone(original);
```

MDN: it *"creates a deep clone of a value using the structured clone algorithm"*, and the
algorithm *"copies complex JavaScript objects recursively while maintaining a map of
previously visited references to avoid infinite loops"* — the `WeakMap` from
[06.1](./01-writing-it.md), built in.

Cycles are handled, with MDN's own example:

```js
const original = { name: "MDN" };
original.itself = original;

const clone = structuredClone(original);
clone !== original;          // different objects
clone.itself === clone;      // circular reference preserved
```

## What it clones

MDN's supported list, in the shape you will actually need it:

| Category | Types |
|---|---|
| Primitives | everything **except `symbol`** |
| Core objects | `Array`, `Object` (**plain objects only**), `Boolean`, `Number`, `String`, `Date`, `RegExp` (minus `lastIndex`) |
| Collections | `Map`, `Set` |
| Binary | `ArrayBuffer`, `TypedArray`, `DataView` |
| Errors | `Error`, `EvalError`, `RangeError`, `ReferenceError`, `SyntaxError`, `TypeError`, `URIError` |
| Web types | `Blob`, `File`, `FileList`, `ImageData`, `ImageBitmap`, `DOMException`, `CryptoKey`, `DOMMatrix`/`DOMPoint`/`DOMRect`, and others marked `[Serializable]` |

**`Map`, `Set`, `Date`, typed arrays and `Blob`s coming through intact is the whole
argument** over `JSON.parse(JSON.stringify(...))`.

## The four things it cannot do

MDN's "things that don't work" list, and each one matters in practice:

- **Functions throw.** *"Function objects — attempting to clone throws a `DataCloneError`
  exception."* An object with a method as an own property cannot be cloned at all — not
  silently dropped, **thrown**. This is the failure people hit first.
- **DOM nodes throw**, likewise `DataCloneError`.
- **The prototype chain is not walked or duplicated.** A class instance comes back as a
  plain object with the same data and **no methods** — the one place the hand-written clone
  in [06.1](./01-writing-it.md) does more.
- **Metadata is lost.** *"Property descriptors, setters, getters, and similar metadata-like
  features (e.g. readonly objects become read/write in the clone)"*, plus *"class private
  elements are not duplicated"* and `RegExp`'s `lastIndex`.

```js
structuredClone({ fn() {} });          // DataCloneError
structuredClone(document.body);        // DataCloneError
structuredClone(new Playlist());       // a plain object — no methods, no #private fields
Object.isFrozen(structuredClone(Object.freeze({ a: 1 })));   // false — read/write again
```

**`symbol` is not cloneable either**, and symbol-keyed properties do not survive — which
matters if you use them for metadata.

## Transferring instead of copying

For large binary data, copying is the expensive part, and `transfer` avoids it. MDN's
example:

```js
const uInt8Array = Uint8Array.from({ length: 1024 * 1024 * 16 }, (v, i) => i);

const transferred = structuredClone(uInt8Array, { transfer: [uInt8Array.buffer] });
uInt8Array.byteLength;   // 0 — the original is now detached
```

*"Transferred objects are detached from the original and attached to the new object."*
**The original becomes unusable**, which is the trade: ownership moves rather than the bytes
being duplicated. Same mechanism as handing a buffer to a Worker
(**Phase 12 · 07 · Web Workers** *(not written yet)*).

## Choosing

| Situation | Use |
|---|---|
| Plain data with `Date`/`Map`/`Set`/binary, possibly cyclic | **`structuredClone`** |
| Known-JSON payload, already `JSON.stringify`-safe | `JSON.parse(JSON.stringify(x))` — and say why |
| Class instances that must keep their methods | a `clone()` method on the class |
| One level deep | `{...obj}` / `[...arr]` — **and this is usually the right answer** |
| Large binary you are handing off | `structuredClone(x, { transfer: [...] })` |
| React/Redux state update | **none of the above** — a shallow copy of the changed path |

⚠️ **The last row is the one that matters most day to day.** Deep cloning to "be safe" is a
common and expensive mistake: it breaks the referential-equality checks that memoisation and
re-render decisions depend on, so everything downstream sees a new object even where nothing
changed ([Phase 4 · 04 · Shallow vs deep copy](../../phase-4-objects-and-classes/04-shallow-vs-deep-copy/README.md)).
**Shallow is usually correct.** Reach for a deep clone when you genuinely need an independent
graph — snapshotting for undo, isolating a mutable fixture in a test, handing data across a
boundary.

## Making a class cloneable

Since the prototype is not preserved, a class that must survive cloning says so itself:

```js
class Playlist {
  #tracks = [];
  toJSON() { return { tracks: [...this.#tracks] }; }
  static from({ tracks }) { const p = new Playlist(); tracks.forEach((t) => p.add(t)); return p; }
  clone() { return Playlist.from(structuredClone(this.toJSON())); }
}
```

**Explicit serialisation plus a factory** — the same pattern as `toJSON`/`fromJSON` in
[Phase 6 · 12 · A collection class](../../phase-6-iteration-and-destructuring/12-a-collection-class/README.md).
It is more code than `structuredClone(instance)` and it is the only version that is correct.

## Gotchas

**Symptom:** `DataCloneError` from `structuredClone`
**Cause:** Something in the graph is not serializable — a function, a DOM node, a class
instance holding either.
**Fix:** Strip it first (`toJSON`), or clone only the data part.

**Symptom:** The clone lost its methods
**Cause:** *"The prototype chain is not walked or duplicated."*
**Fix:** A `clone()` method on the class, or reconstruct via a static factory.

**Symptom:** A frozen object came back mutable
**Cause:** Descriptors are not preserved — *"readonly objects become read/write in the
clone"*.
**Fix:** Re-freeze after cloning if the invariant matters.

**Symptom:** Symbol-keyed properties disappeared
**Cause:** `symbol` is not a cloneable type.
**Fix:** Use string keys for anything that must survive a clone.

**Symptom:** The original typed array was empty after cloning
**Cause:** Its buffer was listed in `transfer`, so it was moved, not copied.
**Fix:** Drop the `transfer` option if you still need the original.

**Symptom:** Memoisation stopped working after adding a deep clone
**Cause:** Every clone is a new identity, so every `===` check fails.
**Fix:** Shallow-copy the changed path instead; deep clone only when a truly independent
graph is required.

**Symptom:** `structuredClone is not defined`
**Cause:** A very old runtime — MDN notes availability across modern browsers since March
2022.
**Fix:** A polyfill or the hand-written clone from [06.1](./01-writing-it.md).

## Interview questions

**★ Would you write your own deep clone in production?**
No — `structuredClone` is built in, is the same algorithm `postMessage` and IndexedDB use,
handles cycles, and clones `Map`, `Set`, `Date`, typed arrays and `Blob`s. Write one by hand
when you need something it cannot do, mainly preserving prototypes.

**★ What can `structuredClone` not clone?**
Functions and DOM nodes throw `DataCloneError`; symbols are unsupported; the prototype chain
is not duplicated, so class instances come back as plain data; and property descriptors,
getters/setters, private class fields and `RegExp.lastIndex` are not preserved.

**★ How does it handle cycles?**
The algorithm *"maintain[s] a map of previously visited references to avoid infinite loops"*,
so a cyclic object clones correctly and `clone.itself === clone`.

**★ What is the `transfer` option?**
It moves ownership of transferable objects instead of copying them — the original is detached
and left with a zero-length buffer. Used for large binary data, and the same mechanism as
transferring a buffer to a Worker.

**When is a deep clone the wrong tool?**
Most of the time. Shallow copying the path that changed is what immutable state updates want;
deep cloning defeats the identity checks memoisation and re-render logic rely on. Deep clone
for snapshots, test fixtures and boundary crossings.

**How do you make a class survive cloning?**
Give it explicit serialisation — a `toJSON` and a static factory — and a `clone()` that
composes them. Nothing outside the class can reach `#private` fields, so the class has to
cooperate.

---

← Prev [Writing it](./01-writing-it.md) · [Topic index](./README.md)
