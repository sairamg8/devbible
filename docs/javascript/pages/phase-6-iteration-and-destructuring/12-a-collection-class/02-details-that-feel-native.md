---
title: "12.2 · The details that make it feel native"
sidebar_label: "02 · The details that make it feel native"
sidebar_position: 2
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08-15 against MDN — [`Set`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Set), [`Map`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map), [Iteration protocols](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Iteration_protocols), [`JSON.stringify()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/JSON/stringify) and [`Iterator`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Iterator). Documentation-validated.

The class in [12.1](./01-the-shape-to-copy.md) is correct. These are the details that decide
whether it *feels* like part of the language or like a wrapper someone wrote — and two of
them are silent data-loss bugs.

## Views, and letting the caller choose

`keys`, `values` and `entries` are not three ways to spell the same thing; they are three
**views**, and the caller picks:

```js
for (const t of playlist) { }            // the default view
for (const [i, t] of playlist.entries()) { }
for (const i of playlist.keys()) { }
```

Because each is a generator method, each returns a **proper iterator** — so the iterator
helpers from [11 · Iterator helpers](../11-iterator-helpers/README.md) apply to a view
without any work on your part:

```js
playlist.values().filter((t) => t.duration > 300).take(3).toArray();
```

**That is a real reason to expose views rather than a single `toArray()`.** A view composes
lazily; an array does not.

## `JSON.stringify` ignores your iterator — provide `toJSON`

This is the silent one. `JSON.stringify` serialises **own enumerable properties**, and a
collection's contents live in a private field:

```js
JSON.stringify(new Set([1, 2]));   // "{}"
JSON.stringify(new Map());         // "{}"
JSON.stringify(playlist);          // "{}" — the tracks are simply gone
```

The built-ins have the same behaviour, which is exactly why you should not copy it:

```js
class Playlist {
  toJSON() { return [...this]; }        // or { tracks: [...this] } if there is metadata
  static fromJSON(arr) { return arr.reduce((p, t) => p.add(t), new Playlist()); }
}
```

**Pair `toJSON` with a static `fromJSON`.** Serialisation that cannot be reversed is a
half-feature, and the round trip is the thing worth testing
([Phase 5 · 09 · JSON](../../phase-5-built-in-library/09-json/README.md)).

## Decide whether iteration is live or a snapshot — and say so

MDN's warning applies to your class the moment it wraps an array:

> "Almost all iterables have the same underlying semantic: they don't copy the data at the
> time when iteration starts. Rather, they keep a pointer and move it around. Therefore, if
> you add, delete, or modify elements in the collection while iterating over the collection,
> you may inadvertently change whether other *unchanged* elements in the collection are
> visited."

```js
*values() { yield* this.#tracks; }        // LIVE — mutations during iteration are visible
*values() { yield* [...this.#tracks]; }   // SNAPSHOT — a copy per iteration
```

Neither is wrong; **not choosing is**. Live matches the built-ins and costs nothing.
Snapshot is safer for a collection callers mutate while looping, at the cost of an
allocation per iteration. Whichever you pick, put it in the doc comment — it is the kind of
behaviour nobody can infer.

## Operations return new collections

`Set` added `union`, `intersection`, `difference` and friends, and they all return a **new**
`Set` rather than mutating the receiver. Follow that: mutators (`add`, `delete`, `clear`)
change the instance and return `this`/a boolean; everything else is pure.

```js
filter(fn) { return Playlist.from(this.values().filter(fn)); }
static from(iterable) { const p = new Playlist(); for (const t of iterable) p.add(t); return p; }
```

A static `from` taking any iterable is worth having for its own sake — it accepts an array,
a `Set`, a generator or another `Playlist`, exactly like `Array.from`.

## Identity: what counts as "the same item"

`Set` and `Map` key on **SameValueZero**, which for objects means reference identity. If two
distinct objects with the same `id` should be one entry, you need your own keying:

```js
class ById {
  #byId = new Map();
  add(item) { this.#byId.set(item.id, item); return this; }
  has(item) { return this.#byId.has(item.id); }
  get size() { return this.#byId.size; }
  *values() { yield* this.#byId.values(); }
  [Symbol.iterator]() { return this.values(); }
}
```

**This is the most common legitimate reason to write a collection class at all** — a
domain-specific notion of identity that `Set` cannot express
([Phase 5 · 10 · `Map` vs object](../../phase-5-built-in-library/10-map-vs-object/README.md)).

## Debug output

```js
get [Symbol.toStringTag]() { return "Playlist"; }
toString() { return `Playlist(${this.size})`; }
```

`Symbol.toStringTag` is what makes `Object.prototype.toString.call(p)` report
`"[object Playlist]"`, matching `Set`'s `"Set"`. A short `toString` keeps template-literal
logging useful. Do not dump the whole contents from `toString` — that is what iterating is
for.

## If the backing store is remote or closable

Two extensions, both mechanical:

```js
async *[Symbol.asyncIterator]() { for await (const row of this.#cursor) yield row; }
[Symbol.dispose]() { this.#handle?.close(); }
```

An `[Symbol.asyncIterator]` makes the collection work with `for await...of`
([06 · Async iterators](../06-async-iterators/README.md)); a `[Symbol.dispose]` plugs it into
`using` declarations, the same protocol iterator helpers use to close their source.

## The checklist

Before calling a collection class done:

- [ ] `[Symbol.iterator]()` returns a **fresh** iterator, and iterating twice works
- [ ] `size` is a getter, and stays correct after `delete`/`clear`
- [ ] `values`/`keys`/`entries` exist, and the default view matches the collection's nature
- [ ] `toJSON` round-trips through a static `fromJSON`
- [ ] Internals are private; nothing returns the backing store by reference
- [ ] Live-versus-snapshot iteration is chosen and documented
- [ ] `has`/`delete` return booleans; `add` returns `this`
- [ ] `Symbol.toStringTag` is set
- [ ] `new Set(c)`, `Array.from(c)`, `[...c]` and destructuring all behave

## Gotchas

**Symptom:** `JSON.stringify(collection)` produced `{}`
**Cause:** It serialises own enumerable properties; contents in a private field are
invisible — the same reason `JSON.stringify(new Set([1,2]))` is `"{}"`.
**Fix:** Add `toJSON() { return [...this]; }`, plus a static `fromJSON`.

**Symptom:** Elements were skipped when items were deleted mid-loop
**Cause:** Live iteration keeps *"a pointer"* into the backing array and does not copy.
**Fix:** Snapshot in `values()`, or document that mutation during iteration is unsupported.

**Symptom:** Two objects with the same `id` both ended up in the collection
**Cause:** `Set` compares by reference (SameValueZero).
**Fix:** Key by the domain identity with a `Map`, as in `ById` above.

**Symptom:** A "pure" `filter` mutated the receiver
**Cause:** It filtered the backing array in place.
**Fix:** Build and return a new collection; keep mutators explicit.

**Symptom:** `console.log` showed `{}` or `[object Object]`
**Cause:** Private fields do not show, and there is no `Symbol.toStringTag`.
**Fix:** Add the tag and a short `toString`.

**Symptom:** `structuredClone(collection)` failed or lost data
**Cause:** Class instances are not cloned as their class, and private fields are not carried
across.
**Fix:** Serialise deliberately — `fromJSON(structuredClone(c.toJSON()))`.

## Interview questions

**★ Why does `JSON.stringify` return `{}` for a `Set` or a custom collection?**
Because it serialises own enumerable properties, and the contents are internal slots or
private fields — the iterator is never consulted. Add a `toJSON()` returning an array, and a
static `fromJSON` so the round trip is real.

**★ Should iterating your collection see concurrent mutations?**
That is a design decision you must make explicitly. The built-ins are live — MDN notes they
*"keep a pointer and move it around"* rather than copying — so a live view matches
expectations; a snapshot (`yield* [...this.#items]`) is safer when callers mutate while
looping, at one allocation per iteration.

**★ How do you make a collection where two objects with the same id are one entry?**
Key on the domain identity yourself, usually with a `Map` from id to item. `Set` compares
with SameValueZero, which for objects is reference identity.

**★ What do `keys()`, `values()` and `entries()` give you beyond `[Symbol.iterator]`?**
Named views the caller can choose, each returning a proper iterator — so iterator helpers
apply to them directly, and a `Map`-like collection can offer keys and pairs as well as
values.

**How should mutating and non-mutating operations differ?**
Mutators change the instance and return `this` or a boolean, like `add` and `delete`.
Everything else returns a new collection, like `Set`'s `union` and `intersection`.

**What makes a custom collection print sensibly?**
`Symbol.toStringTag` for `Object.prototype.toString`, and a short `toString` for template
literals. The contents belong to iteration, not to `toString`.

---

← Prev [The shape to copy](./01-the-shape-to-copy.md) · [Topic index](./README.md)
