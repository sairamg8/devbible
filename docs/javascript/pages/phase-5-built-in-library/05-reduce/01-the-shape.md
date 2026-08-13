---
title: "05.1 · The shape that stays readable"
sidebar_label: "01 · The shape"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-13 against MDN — [`Array.prototype.reduce`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/reduce). Documentation-validated.

**`reduce` collapses an array into one value.** That value can be a number, a string,
an object, a `Map`, another array — anything. The mechanism is small; the trouble is
entirely in the initial value and in knowing when to use something else.

```js
arr.reduce(callbackFn)
arr.reduce(callbackFn, initialValue)
```

The callback takes **four** arguments — one more than every other iteration method:

```js
callbackFn(accumulator, currentValue, currentIndex, array)
```

`accumulator` is *"the accumulated value from previous iterations (or `initialValue`
on first call)"*. Whatever the callback returns becomes the next `accumulator`.

**Because the second parameter of `reduce` is `initialValue`, there is no `thisArg`.**
That is the asymmetry noted throughout this phase — `forEach`, `map`, `filter`, `find`
and friends take a `thisArg`; `reduce` and `reduceRight` do not.

## It is a `for...of` loop, and MDN says so

```js
// With reduce()
const val = array.reduce((acc, cur) => update(acc, cur), initialValue);

// Equivalent with for loop
let val = initialValue;
for (const cur of array) {
  val = update(val, cur);
}
```

Holding that equivalence in mind is the single best defence against unreadable
`reduce` code. **Any `reduce` you cannot immediately rewrite as that loop is a `reduce`
that should have been the loop.**

## The initial value decides everything

```js
const array = [15, 16, 17, 18, 19];
array.reduce((acc, cur) => acc + cur);
// First call: accumulator=15, currentValue=16, index=1
// Result: 85
```

**With no `initialValue`**, MDN documents three consequences:

- *"The **first array element becomes the accumulator**"*
- *"**Iteration starts at index 1**"* — the first element is never passed as
  `currentValue`
- *"If the array is empty, a **`TypeError` is thrown**"*

That third one is the trap:

```js
[].reduce((a, b) => a + b);      // TypeError
[].reduce((a, b) => a + b, 0);   // 0
```

🔴 **Always pass an initial value.** An empty array is not an exotic case — it is the
first render, the filtered-to-nothing list, the API that returned no rows. A `reduce`
without an initial value is a crash waiting for an empty input.

Passing one also fixes the subtler problem: **without it, the accumulator's type is
whatever the first element happens to be.** With `0`, `""`, `[]` or `{}` you have
declared the type of the result, and the callback's first argument is that type on
every call including the first.

One more documented edge case:

```js
[50].reduce((a, b) => a + b); // 50 (no callback invocation)
```

A single element with no initial value returns that element **without ever calling the
callback** — so a callback with a side effect or a type conversion silently does not
run.

## Holes are skipped; `undefined` is not

```js
[1, 2, , 4].reduce((a, b) => a + b);          // 7   (hole at index 2 skipped)
[1, 2, undefined, 4].reduce((a, b) => a + b); // NaN (undefined is not skipped)
```

`reduce` belongs to the hole-**skipping** family, alongside `forEach`, `map`, `filter`,
`some` and `every` — see
[04 · Callbacks, holes and async](../04-array-iteration-methods/02-callbacks-holes-and-async.md).

Those two lines are the clearest demonstration in the whole corpus of why a hole is not
`undefined`: same-looking arrays, one sums to `7` and the other to `NaN`.

## The shapes worth knowing

**Sum, and anything numeric:**

```js
[1, 2, 3, 4].reduce((acc, cur) => acc + cur, 0); // 10
const total = items.reduce((sum, i) => sum + i.price * i.qty, 0);
const max = nums.reduce((m, n) => (n > m ? n : m), -Infinity);
```

**Into a `Map`** — the accumulator is created once and mutated, which is the efficient
and readable form:

```js
const byId = items.reduce((m, item) => m.set(item.id, item), new Map());
```

`Map.prototype.set` returns the map, so the callback's return value is right without a
separate statement. The same trick does not work for a plain object — `obj[k] = v`
evaluates to `v`, not `obj` — which is why the object version needs a block body:

```js
const byId = items.reduce((acc, item) => {
  acc[item.id] = item;
  return acc;                       // ← easy to forget; the usual reduce bug
}, {});
```

**A missing `return` is the most common `reduce` bug.** The next accumulator becomes
`undefined`, and the failure appears on the *second* iteration, not the first.

**Function composition** — MDN's own example, and the case where `reduce` is
unambiguously the right tool:

```js
const pipe = (...functions) => (initialValue) =>
  functions.reduce((acc, fn) => fn(acc), initialValue);

const asyncPipe = (...functions) => (initialValue) =>
  functions.reduce((acc, fn) => acc.then(fn), Promise.resolve(initialValue));
```

The second sequences promises: each `.then` chains onto the last, giving sequential
execution over a list of functions. Note this is `reduce` over *functions*, not over
data — which is exactly where it reads best.

## `reduceRight`

The same method from the end. It matters only when the operation is **not
associative**:

```js
[[0, 1], [2, 3], [4, 5]].reduce((a, b) => a.concat(b));      // [0,1,2,3,4,5]
[[0, 1], [2, 3], [4, 5]].reduceRight((a, b) => a.concat(b)); // [4,5,2,3,0,1]
```

For a sum the direction is irrelevant. For `compose` (the right-to-left cousin of
`pipe`) and for string building it is the whole point.

## Gotchas

**Symptom:** `TypeError: Reduce of empty array with no initial value`
**Cause:** No `initialValue`, and the array was empty.
**Fix:** Always pass one — `0`, `""`, `[]`, `{}`, `new Map()`. It also fixes the
accumulator's type.

**Symptom:** The accumulator becomes `undefined` after the first iteration
**Cause:** A block-bodied callback with no `return`.
**Fix:** `return acc;` — or use a concise arrow, or an accumulator whose method returns
itself (`map.set(...)`).

**Symptom:** `reduce` over a single-element array never called the callback
**Cause:** With no `initialValue`, MDN: `[50].reduce(...)` is `50` with *"no callback
invocation"*.
**Fix:** Pass an initial value if the callback must run for every element.

**Symptom:** Summing an array gives a number when it should give `NaN`, or vice versa
**Cause:** Holes are **skipped**; a stored `undefined` is not. MDN: `[1,2,,4]` sums to
`7` while `[1,2,undefined,4]` gives `NaN`.
**Fix:** Do not create holes; normalise with `[...arr]` if you received one.

**Symptom:** The first callback call receives a value of an unexpected type
**Cause:** Without `initialValue`, the accumulator starts as the **first element**, so
its type is whatever that element is.
**Fix:** Pass an explicit initial value of the type you intend.

**Symptom:** `reduce(fn, thisObj)` does not set `this`
**Cause:** `reduce`'s second argument is the **initial value**. It has no `thisArg`.
**Fix:** Use an arrow function.

## Interview questions

**★ What happens if you call `reduce` without an initial value?**
The **first element becomes the accumulator** and iteration starts at **index 1**, so
the callback is never called with the first element as `currentValue`. On an **empty
array it throws `TypeError`**, and on a single-element array it returns that element
without calling the callback at all. Always pass an initial value.

**★ How many arguments does the `reduce` callback take?**
Four — `(accumulator, currentValue, currentIndex, array)`. That extra first parameter
is also why `reduce` has **no `thisArg`**: its own second argument is the initial value.

**★ Why does `[1,2,,4].reduce((a,b)=>a+b)` give `7` but `[1,2,undefined,4]` give
`NaN`?**
Because `reduce` **skips holes** but not stored `undefined` values. A hole is the
absence of the property; `undefined` is a value, and `2 + undefined` is `NaN`. It is
the clearest demonstration that the two are different states.

**★ What is the most common `reduce` bug?**
A block-bodied callback that forgets to `return` the accumulator — the next iteration
receives `undefined`, so the failure appears on the second element rather than the
first. Concise arrows or self-returning accumulators (`map.set(…)`) avoid it.

**When is `reduceRight` actually needed?**
Only when the operation is **not associative** — `compose` (right-to-left function
composition), string building, or nested wrapping. For a sum or a max the direction
makes no difference.

**How do you know a `reduce` is too clever?**
MDN gives the test: `reduce` is always equivalent to a `for...of` loop over the same
update function. If you cannot immediately write that loop, the `reduce` should have
been the loop.

---

[Topic index](./README.md) · Next → [When not to use `reduce`](./02-when-not-to-use-it.md)
