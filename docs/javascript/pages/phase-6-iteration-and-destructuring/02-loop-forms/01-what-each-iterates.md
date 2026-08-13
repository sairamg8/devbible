---
title: "02.1 · What each one iterates"
sidebar_label: "01 · What each iterates"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-13 against MDN — [`for...in`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/for...in), [`for...of`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/for...of), [`forEach`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/forEach). Documentation-validated.

**Three loops with confusingly similar names, iterating three different things.**

| Loop | Iterates | Over |
|---|---|---|
| `for...in` | **keys** (strings), **including inherited** | any object — property enumeration |
| `for...of` | **values** | anything **iterable** — uses `Symbol.iterator` |
| `forEach` | **values** (plus index and array) | arrays and a few array-likes |

The one-line rule: **`for...of` for values, `Object.keys`/`entries` for object
properties, and `for...in` almost never.**

## `for...in` iterates keys, and walks the prototype chain

MDN: it *"iterates over all **enumerable string properties** of an object (ignoring
properties keyed by symbols), including **inherited enumerable properties**"*, and:

> "The loop will iterate over all enumerable properties of the object itself and those
> the object inherits from its prototype chain."

```js
const object = { a: 1, b: 2, c: 3 };

for (const property in object) {
  console.log(`${property}: ${object[property]}`);
}
// "a: 1"
// "b: 2"
// "c: 3"
```

Fine for a plain literal. The problem appears the moment the object has a prototype with
enumerable properties — MDN's own example:

```js
const triangle = { a: 1, b: 2, c: 3 };

function ColoredTriangle() {
  this.color = "red";
}

ColoredTriangle.prototype = triangle;
const obj = new ColoredTriangle();

for (const prop in obj) {
  if (Object.hasOwn(obj, prop)) {
    console.log(`obj.${prop} = ${obj[prop]}`);
  }
}
// "obj.color = red"
```

**Without the `Object.hasOwn` guard, that loop also yields `a`, `b` and `c`** — inherited
properties nobody put on the instance.

🔴 **If a `for...in` loop needs an `Object.hasOwn` guard, use `Object.keys` instead.**
The guard is the loop telling you it iterated the wrong set. MDN itself lists the
alternatives: `Object.keys()`, `Object.getOwnPropertyNames()`, `for...of`, and
`forEach`.

Note that **`class` methods are non-enumerable**
([Phase 4 · 06](../../phase-4-objects-and-classes/06-class/01-what-class-desugars-to.md)),
so `for...in` over a class instance does *not* show them — but methods assigned as
`Ctor.prototype.m = …` **are** enumerable and do show up. That inconsistency is another
reason to avoid the loop.

## Never use `for...in` on an array

MDN is direct about this:

> "It is better to use a `for` loop with a numeric index, `Array.prototype.forEach()`, or
> the `for...of` loop, because they will return the index as a number instead of a
> string, and also avoid non-index properties."

Three separate problems in that sentence:

**1. The index arrives as a string.**

```js
for (const i in ["a", "b"]) {
  i + 1;        // "01", "11"  ← string concatenation, not arithmetic
}
```

**2. Non-index properties are included.** Anything anyone added to the array object — or
to `Array.prototype` — appears in the loop.

**3. It uses property enumeration, not the iterator.** MDN:

> "Unlike `for...of`, `for...in` uses property enumeration instead of the array's
> iterator. In sparse arrays, `for...of` will visit the empty slots, but `for...in` will
> not."

So `for...in` **skips holes** while `for...of` visits them as `undefined` — the two hole
families from
[Phase 5 · 04](../../phase-5-built-in-library/04-array-iteration-methods/02-callbacks-holes-and-async.md),
appearing again in loop form.

## `for...of` iterates values, via the iterator protocol

```js
for (const value of ["a", "b"]) { … }
for (const char of "hi") { … }               // code POINTS, not code units
for (const [k, v] of map) { … }              // Map yields [key, value] pairs
for (const value of set) { … }
for (const [k, v] of Object.entries(obj)) { … }  // objects need an adapter
```

**`for...of` works on anything with a `Symbol.iterator`** — arrays, strings, `Map`,
`Set`, `NodeList`, `arguments`, generators, and any object you give one. It does **not**
work on plain objects, which is the one thing people expect:

```js
for (const x of { a: 1 }) { … }   // TypeError: {} is not iterable
```

That is deliberate — a plain object is a record, not a sequence, and which of its keys,
values or entries you want is a decision only you can make. `Object.entries` states it.

Two things `for...of` gets right that the others do not: it iterates **strings by code
point**, so emoji stay whole (unlike `split("")` from
[Phase 5 · 07](../../phase-5-built-in-library/07-string-methods/01-slicing-and-splitting.md)),
and it works on `Map` and `Set` directly.

## `forEach` iterates values, but is a method

Covered fully in
[Phase 5 · 04](../../phase-5-built-in-library/04-array-iteration-methods/01-choosing-a-method.md);
the loop-shaped summary:

- Callback gets `(element, index, array)` — the **index as a number**, unlike `for...in`.
- **Skips holes** — `for...of` does not.
- Returns `undefined`; **cannot be broken out of**.
- **Does not await** — an `async` callback's promise is discarded.

## The decision

```js
// values of an array or any iterable
for (const item of items) { … }

// keys and values of a plain object
for (const [key, value] of Object.entries(obj)) { … }

// keys only
for (const key of Object.keys(obj)) { … }

// an index you actually need as a number
for (const [i, item] of items.entries()) { … }

// transform → map/filter, not a loop
const names = users.map((u) => u.name);
```

**`for...in` appears nowhere in that list**, and that is the practical conclusion. Its
only defensible use is deliberately walking an object *including* its inherited
enumerable properties — a debugging or introspection task, and a rare one.

## Gotchas

**Symptom:** A `for...in` loop yields keys nobody assigned
**Cause:** It includes **inherited enumerable** properties from the prototype chain.
**Fix:** `Object.keys(obj)`. If you find yourself adding an `Object.hasOwn` guard, that
is the signal.

**Symptom:** `i + 1` gives `"01"` inside a loop over an array
**Cause:** `for...in` yields indices as **strings**.
**Fix:** `for...of`, or `items.entries()` for a numeric index.

**Symptom:** A `for...in` loop over an array missed elements
**Cause:** It uses **property enumeration**, so it skips holes — MDN: *"In sparse arrays,
`for...of` will visit the empty slots, but `for...in` will not."*
**Fix:** `for...of`, and do not create holes.

**Symptom:** `TypeError: obj is not iterable` from `for...of`
**Cause:** Plain objects have no `Symbol.iterator`.
**Fix:** `Object.entries(obj)`, `Object.keys(obj)`, or a `Map`.

**Symptom:** `for...in` shows methods in one codebase and not another
**Cause:** `class` methods are **non-enumerable**; `Ctor.prototype.m = …` methods are
enumerable.
**Fix:** Do not use `for...in`. `Object.keys` is own-and-enumerable and consistent.

**Symptom:** Iterating a string splits an emoji
**Cause:** Indexed access and `split("")` work on UTF-16 code units.
**Fix:** `for...of`, which iterates **code points**.

## Interview questions

**★ What is the difference between `for...in` and `for...of`?**
`for...in` iterates **keys** — enumerable string-keyed properties, **including inherited
ones** — using property enumeration. `for...of` iterates **values**, using the object's
`Symbol.iterator`. So `for...in` works on any object and `for...of` only on iterables,
and a plain object is not iterable.

**★ Why should you not use `for...in` on an array?**
MDN gives three reasons: the index arrives as a **string**, **non-index properties** are
included, and it uses property enumeration rather than the iterator — so it **skips
holes** where `for...of` visits them. Use `for...of`, `forEach`, or an indexed `for`.

**★ When does a `for...in` loop need `Object.hasOwn`?**
Whenever the object has a prototype carrying enumerable properties — MDN's own example
yields `a`, `b`, `c` from the prototype alongside the instance's `color`. And that need
is itself the signal to switch to `Object.keys`, which is own-only by definition.

**★ How do you loop over a plain object's entries?**
`for (const [key, value] of Object.entries(obj))`. Plain objects are not iterable by
design — which of keys, values or entries you want is a decision the language will not
make for you.

**Which loops can you `break` out of?**
`for`, `for...of` and `for...in`. **Not `forEach`**, which MDN says can only be stopped
by throwing. `for...of` is also the only one of the three value-iterating forms that
supports `await` between iterations.

**Why does `for...of` over a string handle emoji correctly?**
Because it uses the **string iterator**, which yields code points, while indexed access
and `split("")` work on UTF-16 code units and split surrogate pairs.

---

[Topic index](./README.md) · Next → [Control flow: `break`, `await` and choosing](./02-control-flow-and-choosing.md)
