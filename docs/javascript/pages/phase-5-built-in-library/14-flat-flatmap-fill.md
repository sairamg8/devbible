---
title: "14 · `flat`, `flatMap`, `fill`, `copyWithin`"
sidebar_label: "14 · flat, flatMap, fill"
sidebar_position: 14
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-15 against MDN — [`Array.prototype.flat()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/flat), [`Array.prototype.flatMap()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/flatMap), [`Array.prototype.fill()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/fill), [`Array.prototype.copyWithin()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/copyWithin), [`Array.prototype.includes()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/includes), [`Array.prototype.indexOf()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/indexOf), [`Array.from()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/from), [`Object.is()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/is), [Equality comparisons and sameness](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Equality_comparisons_and_sameness). Documentation-validated; **no timings**.

## `flat` — one level by default

```js
[1, [2, [3, [4]]]].flat();          // [1, 2, [3, [4]]]   — one level
[1, [2, [3, [4]]]].flat(2);         // [1, 2, 3, [4]]
[1, [2, [3, [4]]]].flat(Infinity);  // [1, 2, 3, 4]       — however deep it goes
```

⚠️ **`flat()` with no argument flattens exactly one level**, which is the most common surprise. Pass
`Infinity` when the nesting depth is unknown — a tree of comments, a recursive menu, a grouped API
response.

🔴 **`flat` also removes empty slots**, which makes it the shortest way to densify a sparse array:

```js
[1, , 3].flat();   // [1, 3] — the hole is gone, and the length is 2
```

That is documented behaviour, not a side effect to be surprised by — but it does mean `flat()` is
not purely "one level down": it changes length for sparse input too
([01 · Array creation and shape](./01-array-creation-and-shape/README.md)).

## `flatMap` — map, then flatten one level

```js
[1, 2, 3].flatMap((n) => [n, n * 2]);   // [1, 2, 2, 4, 3, 6]
```

**`flatMap(fn)` is `map(fn).flat()`** — and only ever one level, with no depth argument. Its real
value is the two shapes it makes clean:

```js
// expand: one input, many outputs
orders.flatMap((o) => o.items);

// filter AND map in one pass — return [] to drop, [value] to keep
users.flatMap((u) => (u.email ? [u.email.toLowerCase()] : []));
```

That second idiom replaces `.filter(...).map(...)` when the predicate and the transform share work,
and — in TypeScript — it narrows better than a `filter(Boolean)` chain, which needs a type predicate
to drop `undefined` from the type.

⚠️ **Returning a non-array from the callback is fine** — it is included as-is. Returning `undefined`
puts `undefined` in the result; returning `[]` is what drops the element.

## `fill` — and the shared-reference trap

```js
new Array(3).fill(0);        // [0, 0, 0]        — the idiom for a dense zero array
[1, 2, 3, 4].fill(9, 1, 3);  // [1, 9, 9, 4]     — start inclusive, end exclusive
```

`fill` **mutates** and returns the same array. It also fills holes, which is why
`new Array(n).fill(0)` is the standard way to get a dense array from the sparse one `Array(n)`
produces.

🔴 **The trap, and it is a real one:**

```js
const rows = new Array(3).fill([]);
rows[0].push("x");
rows;   // [["x"], ["x"], ["x"]]   — 🔴 ALL THREE are the same array
```

**`fill` evaluates its argument once** and writes that one value into every slot. For objects and
arrays that means three references to one thing. The fix is to produce a value per index:

```js
Array.from({ length: 3 }, () => []);   // ✅ three distinct arrays
```

`Array.from` calls its map function once per index, so each slot gets its own object. **Use `fill`
for primitives and `Array.from` for anything else.**

## `copyWithin` — you will read it, not write it

```js
[1, 2, 3, 4, 5].copyWithin(0, 3);   // [4, 5, 3, 4, 5]
```

It copies a slice of the array onto another position **in place**, never changing the length. It
exists because typed arrays needed a fast in-place move, and it is genuinely useful there —
ring buffers, audio and image data. In ordinary application code it is almost always a `slice` and a
spread expressed obscurely. **Recognise it; do not reach for it.**

## `includes` vs `indexOf`: the two cases where they disagree

They answer nearly the same question with different equality rules, and the difference matters
exactly twice:

```js
[NaN].indexOf(NaN);     // 🔴 -1     — indexOf uses ===, and NaN !== NaN
[NaN].includes(NaN);    // ✅ true   — includes uses SameValueZero

[, ,].indexOf(undefined);   // 🔴 -1    — indexOf skips holes
[, ,].includes(undefined);  // ✅ true  — includes treats a hole as undefined
```

🔴 **`indexOf` can never find `NaN`.** Any "is this value in the array" check on numeric data that
might contain `NaN` must be `includes`.

**One place they agree, surprisingly:** both treat `-0` and `0` as the same.

```js
[0].includes(-0);    // true
[-0].indexOf(0);     // 0
Object.is(0, -0);    // 🔴 false — the only algorithm that distinguishes them
```

### The three equality algorithms, in one table

| Algorithm | Used by | `NaN` vs `NaN` | `0` vs `-0` |
|---|---|---|---|
| **strict equality `===`** | `===`, `indexOf`, `lastIndexOf`, `switch` | not equal | equal |
| **SameValueZero** | `includes`, `Map`/`Set` keys | **equal** | equal |
| **SameValue** | `Object.is` | **equal** | **not equal** |

**This is why `NaN` works as a `Map` key or a `Set` member** while `indexOf` can never find it —
`Map` and `Set` use SameValueZero, the same rule as `includes`. The full picture of equality is in
[Phase 1 · Values, types and coercion](../phase-1-values-and-coercion/README.md).

## Gotchas

**Symptom:** `flat()` left nested arrays behind
**Cause:** The default depth is 1.
**Fix:** `flat(Infinity)` when the depth is unknown.

**Symptom:** `flat()` changed the array's length unexpectedly
**Cause:** It removes empty slots as well as flattening.
**Fix:** Expected behaviour — and it is the shortest way to densify a sparse array.

**Symptom:** `flatMap` did not flatten deeply nested results
**Cause:** It flattens exactly one level and takes no depth argument.
**Fix:** `map(fn).flat(depth)`.

**Symptom:** Every row of a grid built with `fill` changed together
**Cause:** `fill` writes the *same reference* into every slot.
**Fix:** `Array.from({ length: n }, () => [])`.

**Symptom:** `new Array(3).map(fn)` did nothing
**Cause:** The array is sparse — holes are skipped by `map`.
**Fix:** `new Array(3).fill(0).map(fn)` or `Array.from({ length: 3 }, fn)`.

**Symptom:** A check for `NaN` in an array never matches
**Cause:** `indexOf` uses `===`, and `NaN !== NaN`.
**Fix:** `includes`, or `some(Number.isNaN)`.

**Symptom:** `indexOf(undefined)` missed an obviously-empty slot
**Cause:** `indexOf` skips holes; `includes` treats them as `undefined`.
**Fix:** `includes`, and prefer dense arrays.

**Symptom:** `-0` and `0` compared equal where the sign mattered
**Cause:** Only `Object.is` distinguishes them.
**Fix:** `Object.is(x, -0)`.

## Interview questions

**★ What does `flat()` do by default, and what else does it do?**
Flattens exactly one level. It also removes empty slots, so it changes the length of a sparse array
— which makes `flat()` the shortest way to densify one. Pass `Infinity` for unknown depth.

**★ What is `flatMap` good for beyond expanding?**
Filtering and mapping in one pass: return `[]` to drop an element and `[value]` to keep it. That
avoids a separate `filter` and, in TypeScript, narrows better than a `filter(Boolean)` chain.

**★ Why does `new Array(3).fill([])` cause bugs?**
`fill` evaluates its argument once and writes that same reference into every slot, so all three
elements are the *same* array. Use `Array.from({ length: 3 }, () => [])`, which calls the function
per index.

**★ Why can `indexOf` never find `NaN`?**
It uses strict equality, and `NaN !== NaN`. `includes` uses SameValueZero, which treats `NaN` as
equal to itself — the same rule `Map` and `Set` use for keys, which is why `NaN` works as a key.

**★ Name the three equality algorithms and one place each is used.**
Strict equality (`===`, `indexOf`) — `NaN` unequal to itself, `0 === -0`. SameValueZero (`includes`,
`Map`/`Set` keys) — `NaN` equal to itself, `0` and `-0` still equal. SameValue (`Object.is`) — `NaN`
equal to itself and `0` **not** equal to `-0`.

**When would you use `copyWithin`?**
In typed-array code — ring buffers, audio or image data — where an in-place move matters. In
ordinary application code it is a `slice` and a spread written obscurely; recognise it rather than
reach for it.

**What is the difference between `fill` and `Array.from` for initialising?**
`fill` writes one evaluated value into every slot, which is right for primitives and wrong for
objects. `Array.from({ length: n }, fn)` calls `fn` per index, so each element is distinct.

---

← [13 · Non-mutating array counterparts](./13-non-mutating-counterparts.md) · [Phase index](./README.md) · Next: **15 · Regular expressions — the syntax** *(not written yet)* →
