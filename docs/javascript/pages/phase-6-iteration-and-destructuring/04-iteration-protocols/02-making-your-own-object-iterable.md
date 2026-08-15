---
title: "04.2 · Making your own object iterable"
sidebar_label: "02 · Making your own object iterable"
sidebar_position: 2
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-15 against MDN — [Iteration protocols](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Iteration_protocols) and [`Iterator`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Iterator). Documentation-validated.

Implementing the protocol is four lines. **Implementing it *correctly* is a decision** —
whether `[Symbol.iterator]()` hands back a fresh cursor or hands back itself, and whether
anything needs cleaning up when a loop stops early. Both choices are invisible until
something iterates your object twice or `break`s out of the loop, which is why they are
worth settling before you write the method.

## The two shapes

```js
// Shape 1 — a collection: every call returns a NEW iterator
const bag = {
  items: ["a", "b"],
  [Symbol.iterator]() {
    let i = 0;
    return { next: () => (i < this.items.length ? { value: this.items[i++], done: false }
                                                : { value: undefined, done: true }) };
  },
};

// Shape 2 — an ITERABLE ITERATOR: the iterator returns itself
const cursor = {
  i: 0,
  next() { return this.i < 3 ? { value: this.i++, done: false } : { value: undefined, done: true }; },
  [Symbol.iterator]() { return this; },
};
```

MDN on shape 2: *"It is very easy to make an iterator also iterable: just implement a
`[Symbol.iterator]()` method that returns `this`. Such object is called an* iterable
iterator *… the generator object is an example."*

**The difference shows up the second time you iterate:**

```js
[...bag];    [...bag];     // ["a", "b"]  then ["a", "b"]  — restartable
[...cursor]; [...cursor];  // [0, 1, 2]   then []          — exhausted, permanently
```

MDN is unambiguous about which to prefer: *"when possible, it's better for
`iterable[Symbol.iterator]()` to return different iterators that always start from the
beginning, like `Set.prototype[Symbol.iterator]()` does."*

**Shape 1 for anything that represents a collection. Shape 2 only for something that
genuinely is a one-shot stream** — a paginated fetch, a queue being drained, a reader over
a socket. The rule of thumb: if iterating it twice *ought* to give the same values, it must
be shape 1.

### The one-shot trap, in the wild

Generator objects are shape 2, and this catches people constantly:

```js
const g = numbers();          // a generator object
const total = [...g].length;
const max = Math.max(...g);   // -Infinity — g is already drained
```

Anything you hand to two consumers must be a **collection** (shape 1) or an array. This is
the same hazard as passing an iterator into `Promise.all` and then trying to log it — the
combinator consumed it. Generators get their own topic in **05 · Generators**
*(not written yet)*.

## The generator-method shorthand

Once you know generators, the whole manual iterator collapses to one line — `function*`
returns an object that already satisfies the iterator protocol:

```js
const bag = {
  items: ["a", "b"],
  *[Symbol.iterator]() {
    yield* this.items;
  },
};
```

**This is shape 1**, and that surprises people: `[Symbol.iterator]()` is a generator
*function*, so each call creates a **new** generator object. The one-shot-ness lives in
the generator object, not in the method. Calling the method twice gives two independent
cursors, which is exactly what you want.

Prefer this form in real code. The manual object above is worth writing once, to see what
`function*` is doing for you — no more.

## On a class

```js
class Playlist {
  #tracks = [];
  add(track) { this.#tracks.push(track); return this; }
  *[Symbol.iterator]() { yield* this.#tracks; }
}

const p = new Playlist().add("one").add("two");
[...p];                       // ["one", "two"]
for (const t of p) { /* … */ }
const [head] = p;             // "two" tracks exist; destructuring takes one and stops
new Set(p);                   // works — Set's constructor takes an iterable
```

Defining `[Symbol.iterator]` on the class body puts it on the **prototype**
([Phase 4 · 05](../../phase-4-objects-and-classes/05-the-prototype-chain/README.md)), so
every instance is iterable and nothing is stored per instance. The internals stay private —
consumers get values, not your `#tracks` array. Doing this properly, including `size`,
`entries()` and matching the built-in collection conventions, is **12 · A collection class
that iterates cleanly** *(not written yet)*.

## `return()` — the cleanup hook nobody implements

MDN describes exactly when it fires:

> "When built-in syntaxes are iterating an iterator, and the last result's `done` is
> `false` (i.e., the iterator is able to produce more values) but no more values are
> needed, the `return` method will get called if present. This can happen, for example, if
> a `break` or `return` is encountered in a `for...of` loop, or if all identifiers are
> already bound in an array destructuring."

So all of these close the iterator:

```js
for (const x of it) { if (x > 2) break; }   // break
for (const x of it) { return x; }           // return out of the enclosing function
for (const x of it) { throw new Error(); }  // throw
const [a, b] = it;                          // destructuring — bound both, stops
```

That last one is the surprising member of the set. **Array destructuring takes exactly as
many values as it has identifiers and then closes the iterator** — it does not drain it.

If your iterator holds a resource, `return()` is where you release it:

```js
function readLines(handle) {
  return {
    [Symbol.iterator]() { return this; },
    next() { /* … */ },
    return(value) {
      handle.close();                 // runs on break, return, throw or destructuring
      return { value, done: true };
    },
  };
}
```

**Without `return()`, a `break` leaks the handle** — the loop simply stops calling `next()`
and nothing ever tells the iterator it is finished. Nothing in the language warns you.

Two related notes:

- **`Iterator.prototype[Symbol.dispose]()` calls `return()`**, which is how iterators plug
  into the disposable protocol and `using` declarations.
- A generator's `return()` is provided for you, and it runs the generator's `finally`
  blocks — the reason `try { … } finally { cleanup(); }` inside a generator is reliable
  even when the consumer breaks out early.

MDN's caution when you drive an iterator yourself: *"you may catch the error and retry
calling `next()`, but in general you should assume the iterator is already closed."*

## Infinite is fine — until the consumer is greedy

An iterator never has to finish. `next()` may return `done: false` forever, because values
are produced on demand:

```js
const naturals = { i: 1, next() { return { value: this.i++, done: false }; },
                   [Symbol.iterator]() { return this; } };

for (const n of naturals) { if (n > 5) break; }   // fine
[...naturals];                                    // hangs, then runs out of memory
```

**The consumer decides whether laziness is preserved.** `for...of` with a `break`, array
destructuring and `Iterator.prototype.take()` all stop early; spread, `Array.from` and
`Promise.all` are greedy and will pull forever. Never spread anything you did not confirm
is finite.

## Getting the helper methods

Iterator helpers (`map`, `filter`, `take`, `drop`, `toArray`, …) live on
**`Iterator.prototype`**, and MDN notes that *"all built-in iterators inherit from the
`Iterator` class"*. A hand-rolled object literal does **not** — it inherits from
`Object.prototype`, so `myIterator.take(3)` is a `TypeError`.

Two ways to get them:

```js
Iterator.from({ next() { /* … */ } });   // wrap a bare iterator into a "proper" one
function* gen() { /* … */ }              // generator objects already inherit them
```

MDN calls the target a **proper iterator** — *"one that both conforms to the iterator
protocol and inherits from `Iterator`, and most code expects iterators to be proper
iterators."* `Iterator` itself is not directly constructible: it *"throws an error when
constructed by itself"*, and is *"intended to be extended by other classes that create
iterators."* The helpers themselves are **11 · Iterator helpers** *(not written yet)*.

## Checking whether something is iterable

```js
const isIterable = (v) => v != null && typeof v[Symbol.iterator] === "function";
```

`v != null` first, because reading a property off `null` or `undefined` throws
([Phase 1 · nullish handling](../../phase-1-values-and-coercion/README.md)). Test for a
**function**, not merely presence — `{ [Symbol.iterator]: 1 }` passes an `in` check and
still throws when iterated.

**Do not use `Array.isArray` as a proxy for "can I loop over this".** It says no to
strings, `Set`s, `Map`s, `NodeList`s and generators, all of which iterate perfectly well.
And do not use `typeof v.length === "number"` either — that is the array-**like** test,
which is a different question again, and the one `Array.from` answers.

## Gotchas

**Symptom:** The object iterated correctly once and produced nothing afterwards
**Cause:** `[Symbol.iterator]()` returns `this` — an iterable iterator, exhausted after one
pass.
**Fix:** Return a **new** iterator each call, as `Set.prototype[Symbol.iterator]()` does.
MDN recommends this *"when possible"*.

**Symptom:** `Math.max(...gen)` gave `-Infinity` after the generator had been spread once
**Cause:** Generator objects are one-shot; the first consumer drained it.
**Fix:** Materialise once into an array, or make the *source* a restartable iterable.

**Symptom:** A file handle or subscription leaked when the loop `break`ed
**Cause:** No `return()` method, so nothing told the iterator it was finished.
**Fix:** Implement `return(value)` returning `{ value, done: true }` — or use a generator
with a `finally` block.

**Symptom:** `const [a, b] = it` left the iterator unusable
**Cause:** Destructuring closes the iterator once *"all identifiers are already bound"*.
**Fix:** Expected. Spread first if you need the rest — `const [a, b, ...rest] = it`.

**Symptom:** `TypeError: it.take is not a function`
**Cause:** Iterator helpers live on `Iterator.prototype`; a plain object literal does not
inherit from it.
**Fix:** `Iterator.from(it)`, or produce the iterator from a `function*`.

**Symptom:** Spreading an iterable hung the tab
**Cause:** The iterable is infinite and spread is greedy.
**Fix:** Bound it — `break`, or `Iterator.from(it).take(n).toArray()`.

**Symptom:** `[...obj]` still throws after adding an `iterator` method
**Cause:** The key must be the **symbol** `Symbol.iterator`, not the string `"iterator"`.
**Fix:** `[Symbol.iterator]() { … }` — computed key, square brackets included.

## Interview questions

**★ How do you make a custom object work with `for...of`?**
Give it a `[Symbol.iterator]()` method returning an object with `next()`, where `next()`
returns `{ value, done }`. In practice write it as a generator method —
`*[Symbol.iterator]() { yield* this.items; }` — which gives a fresh, correct iterator per
call.

**★ Should `[Symbol.iterator]()` return `this`?**
Only for genuine one-shot streams. MDN: *"when possible, it's better for
`iterable[Symbol.iterator]()` to return different iterators that always start from the
beginning, like `Set.prototype[Symbol.iterator]()` does."* Returning `this` makes an
iterable iterator, which iterates once and is then permanently empty.

**★ What is `return()` on an iterator for, and when does it run?**
Cleanup. It runs when a built-in syntax stops early while `done` was still `false` — a
`break`, a `return`, a `throw`, or an array destructuring that has bound all its
identifiers. Without it, resources held by the iterator leak on early exit. A generator's
`finally` block is driven by exactly this.

**★ Can an iterator be infinite?**
Yes — values are produced on demand, so `next()` can return `done: false` forever. Whether
that is safe depends on the consumer: `for...of` with `break`, destructuring and `take()`
stop; spread, `Array.from` and `Promise.all` will pull until memory runs out.

**Why does `[...gen, ...gen]` give the elements once and then nothing?**
A generator object is its own iterator and is exhausted after the first spread. The second
spread calls `next()` on an already-finished iterator, which keeps returning `done: true`.

**How do you check whether a value can be iterated?**
`v != null && typeof v[Symbol.iterator] === "function"`. Not `Array.isArray` — that rejects
strings, `Set`s, `Map`s and generators — and not a `length` check, which tests array-like
instead.

**Why does a hand-written iterator not have `.map()` or `.take()`?**
Those helpers live on `Iterator.prototype`, which built-in iterators inherit from and a
plain object literal does not. `Iterator.from()` wraps a bare iterator into a *proper*
iterator that has them.

---

← Prev [Two protocols, one handshake](./01-two-protocols-one-handshake.md) ·
[Topic index](./README.md)
