---
title: "12.1 · The shape to copy"
sidebar_label: "01 · The shape to copy"
sidebar_position: 1
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08-15 against MDN — [`Set`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Set), [`Map`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map) and [Iteration protocols](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Iteration_protocols). Documentation-validated.

**The built-in collections are the specification for what "iterates cleanly" means.** If
your class exposes what `Set` and `Map` expose, every reader already knows how to use it and
every built-in that takes an iterable already accepts it. Copy the shape rather than
inventing one.

What `Set` actually provides, from MDN:

| Member | Detail |
|---|---|
| `size` | an **instance property** — *"returns the number of values in the `Set` object"*, read as `s.size`, not `s.size()` |
| `values()` | *"a new iterator object that yields the values… in insertion order"* |
| `keys()` | *"an alias for `Set.prototype.values()`"* |
| `entries()` | pairs, for symmetry with `Map` |
| `[Symbol.iterator]()` | yields the **values** — same as `values()` |
| `forEach(cb)` | *"calls `callbackFn` once for each value… in insertion order"*, and the callback receives `(value, value, set)` |
| `[Symbol.toStringTag]` | the string `"Set"` |

`Map` differs in exactly two ways worth internalising: **its default iterator is
`entries()`, not `values()`**, and `keys()` is a real, distinct iterator. Everything else
lines up.

## The class

```js
class Playlist {
  #tracks = [];

  add(track) {
    this.#tracks.push(track);
    return this;                                  // chainable, like Set#add
  }

  has(track) { return this.#tracks.includes(track); }
  delete(track) {
    const i = this.#tracks.indexOf(track);
    if (i === -1) return false;
    this.#tracks.splice(i, 1);
    return true;                                  // boolean, like Set#delete
  }
  clear() { this.#tracks.length = 0; }

  get size() { return this.#tracks.length; }      // a GETTER, not a method

  *values() { yield* this.#tracks; }
  *keys() { yield* this.#tracks.keys(); }
  *entries() { yield* this.#tracks.entries(); }
  [Symbol.iterator]() { return this.values(); }   // the default view

  forEach(cb, thisArg) {
    for (const t of this.#tracks) cb.call(thisArg, t, t, this);
  }

  get [Symbol.toStringTag]() { return "Playlist"; }
}
```

Everything the language offers now works, with no further code:

```js
const p = new Playlist().add("one").add("two");

[...p];                    // ["one", "two"]
for (const t of p) { }
const [first] = p;
new Set(p);                // constructors that take an iterable
Array.from(p);
Object.prototype.toString.call(p);   // "[object Playlist]"
```

## Why each decision is that way

**`size` is a getter.** `arr.length` and `set.size` are both properties; a `size()` method
would be the one collection in the codebase that reads differently. It also stays correct
automatically — there is no cached count to forget to update.

**`[Symbol.iterator]()` delegates to `values()` rather than duplicating it.** One
implementation, and the default view is declared in one line. Follow `Map` and point it at
`entries()` if your collection is fundamentally key/value.

**The iterator methods are generator methods.** Each call produces a *new* generator, so the
collection is restartable — MDN's guidance from
[04.2](../04-iteration-protocols/02-making-your-own-object-iterable.md): *"it's better for
`iterable[Symbol.iterator]()` to return different iterators that always start from the
beginning, like `Set.prototype[Symbol.iterator]()` does."* Returning a stored iterator
instead would make the collection iterable exactly once.

**`#tracks` is private.** Consumers get values through the protocol, never a reference to
the backing array — so `[...p]` cannot be mutated into your internals, and you can change
the backing store later.

**`add` returns `this`, `delete` returns a boolean.** Copying `Set`'s return conventions
means chaining works where people expect it and `if (p.delete(x))` reads correctly.

**`forEach` passes `(value, value, collection)`.** Odd-looking, and it is what `Set` does —
the doubled argument keeps the callback signature interchangeable with `Map`'s
`(value, key, map)`.

## What you get free from the protocol

Because the class is iterable, all of this works without a line of support code:

```js
new Map(pairs);  new Set(p);  Promise.all(p);  Object.groupBy(p, fn);
Array.from(p, (t) => t.id);
Math.max(...p.values().map((t) => t.duration));       // iterator helpers, via values()
const [head, ...rest] = p;
```

**That is the argument for implementing the protocol rather than exposing a `toArray()`.**
One symbol-keyed method admits the class to every iterable-consuming syntax and API in the
language ([04.1](../04-iteration-protocols/01-two-protocols-one-handshake.md)).

## When not to write the class at all

Be honest about this before writing any of the above:

- **If it is a set of primitives, use `Set`.** If it is a keyed lookup, use `Map`
  ([Phase 5 · 10 · `Map` vs object](../../phase-5-built-in-library/10-map-vs-object/README.md)).
  A wrapper that adds nothing is a layer to maintain.
- **A wrapper *is* justified** when there is domain behaviour to protect — an invariant
  (sorted, capped, unique by id), a different notion of identity, or an API you want to keep
  stable while the storage changes.
- **Composition over `extends Set`.** Subclassing a built-in inherits methods that return
  the base type and behaviours you did not choose; holding a private `Set` and exposing what
  you mean is simpler to reason about
  ([Phase 4 · 09 · `extends` and `super`](../../phase-4-objects-and-classes/09-extends-and-super/README.md)).

## Gotchas

**Symptom:** `[...collection]` throws "not iterable"
**Cause:** No `[Symbol.iterator]` — a `toArray()` or `items` getter is not the protocol.
**Fix:** Add `[Symbol.iterator]()`, ideally delegating to `values()`.

**Symptom:** The collection iterated once and was empty afterwards
**Cause:** `[Symbol.iterator]()` returns a stored iterator instead of making a new one.
**Fix:** Make it a generator method, or return `this.values()` where `values` is one.

**Symptom:** `size` was `undefined`
**Cause:** Defined as a method (`size()`) and read as a property, or the other way round.
**Fix:** `get size()`, matching `Set`/`Map`.

**Symptom:** A consumer mutated the collection's internals
**Cause:** A getter returned the backing array by reference.
**Fix:** Keep it in a `#private` field and expose values only through iteration.

**Symptom:** `new Set(collection)` produced a set of one item
**Cause:** The collection is not iterable, so it was treated as a single value — or an
`items` array was passed instead.
**Fix:** Implement the protocol; the constructor then consumes it correctly.

**Symptom:** `Object.prototype.toString.call(c)` said `"[object Object]"`
**Cause:** No `Symbol.toStringTag`.
**Fix:** `get [Symbol.toStringTag]() { return "Playlist"; }`.

## Interview questions

**★ What does a class need to work with `for...of` and spread?**
One method: `[Symbol.iterator]()`, returning a fresh iterator. Writing it as a generator
method — `*[Symbol.iterator]() { yield* this.#items; }` — satisfies both the protocol and
the restartability guidance in one line.

**★ Why should `[Symbol.iterator]()` return a new iterator each call?**
So the collection can be iterated more than once. MDN recommends it explicitly, pointing at
`Set.prototype[Symbol.iterator]()`. Returning `this` or a cached iterator makes it one-shot.

**★ What does `Set` expose that a custom collection should copy?**
`size` as a property, `values`/`keys`/`entries` iterators, `[Symbol.iterator]` aliased to
the default view, `forEach` with `(value, key, collection)`, `has`/`delete` returning
booleans, chainable `add`, and a `Symbol.toStringTag`.

**★ How does `Map`'s iteration differ from `Set`'s?**
`Map`'s default iterator is `entries()` — `[key, value]` pairs — while `Set`'s is
`values()`. `Set.prototype.keys` is an alias of `values`; `Map`'s `keys` is genuinely
different.

**Should you extend `Set` or wrap it?**
Wrap it, in a private field. Subclassing a built-in brings inherited methods that return the
base type and behaviour you did not opt into; composition exposes exactly the API you meant.

**When is a custom collection class not worth writing?**
When `Set` or `Map` already does the job. Write one when there is an invariant to protect, a
different notion of identity, or a stable API you want to keep while the storage changes.

---

[Topic index](./README.md) · Next → [The details that make it feel native](./02-details-that-feel-native.md)
