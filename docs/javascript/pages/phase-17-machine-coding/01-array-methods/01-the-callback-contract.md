---
title: "01.1 · The callback contract"
sidebar_label: "01 · The callback contract"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-14 against MDN — [`Array.prototype.map()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/map), [`Array.prototype.filter()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/filter), [`Array.prototype.reduce()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/reduce), [`Array.prototype.forEach()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/forEach), [Iterative methods](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array#iterative_methods). Documentation-validated; **no timings**.

**Anyone can write a `map` that works on `[1, 2, 3]`.** The interview is entirely about the four
details that separate that from the real one: the callback's three arguments, `thisArg`, sparse
arrays, and mutation during iteration.

## The contract, from the specification's own description

MDN, on the callback arguments:

> **`element`** — "The current element being processed in the array."
> **`index`** — "The index of the current element being processed in the array."
> **`array`** — "The array `map()` was called upon."

**`thisArg`** — "A value to use as `this` when executing `callbackFn`."

And on genericity:

> "`map()` method is generic. It only expects the `this` value to have a `length` property and
> integer-keyed properties."

🔴 **All four matter in the implementation**, and forgetting the third callback argument is the
most common omission — it is the one that lets a callback reference its own array without a
closure.

## `map`

```js
Array.prototype.myMap = function (callbackFn, thisArg) {
  if (this == null) throw new TypeError("Array.prototype.myMap called on null or undefined");
  if (typeof callbackFn !== "function") throw new TypeError(callbackFn + " is not a function");

  const o = Object(this);                       // generic: works on array-likes
  const len = o.length >>> 0;                   // ToUint32 — the spec's length coercion
  const result = new Array(len);                // preserve length, including holes

  for (let i = 0; i < len; i++) {
    if (i in o) {                               // 🔴 skip holes, do not skip undefined
      result[i] = callbackFn.call(thisArg, o[i], i, o);
    }
  }
  return result;
};
```

Four lines carry the interview:

- 🔴 **`if (i in o)`** — MDN: *"`callbackFn` is invoked only for array indexes which have assigned
  values. It is not invoked for empty slots in sparse arrays."* So `[1, , 3].map(f)` calls `f`
  twice and returns `[2, empty, 6]` — a hole in, a hole out. `if (o[i] !== undefined)` is **wrong**,
  because an explicit `undefined` is a real element.
- **`const o = Object(this)`** — this is what makes the method generic, so
  `Array.prototype.myMap.call({length: 3, 0: 'a'}, f)` works.
- **`o.length >>> 0`** — the specification's `ToUint32` coercion. It turns a negative or fractional
  or `undefined` length into a sane loop bound. ⚠️ It also caps at 2³² − 1, which is the array
  length limit, so this is correct rather than a hack.
- **`new Array(len)`** — the result has the same length as the input even where holes are skipped.

**The `thisArg` line is `callbackFn.call(thisArg, ...)`** — and note that an **arrow function
callback ignores it entirely**, because arrows have no own `this`. That is worth saying: `thisArg`
is a pre-arrow-function affordance, and most modern code should not use it.

## `filter` and `forEach` — the same skeleton

```js
Array.prototype.myFilter = function (callbackFn, thisArg) {
  const o = Object(this);
  const len = o.length >>> 0;
  const result = [];                             // 🔴 no length preservation here

  for (let i = 0; i < len; i++) {
    if (i in o && callbackFn.call(thisArg, o[i], i, o)) result.push(o[i]);
  }
  return result;
};
```

⚠️ **`filter` compacts and `map` does not.** `map` returns an array of the same length with holes
preserved; `filter` returns a shorter, dense array. Getting this backwards is a real difference in
behaviour, not a style choice.

```js
Array.prototype.myForEach = function (callbackFn, thisArg) {
  const o = Object(this);
  const len = o.length >>> 0;
  for (let i = 0; i < len; i++) {
    if (i in o) callbackFn.call(thisArg, o[i], i, o);
  }
  return undefined;                              // 🔴 always undefined
};
```

**`forEach` returns `undefined`, and cannot be broken out of.** `break` is a syntax error inside a
callback, and `return` only exits that one invocation. **If you need to stop early, `for…of`,
`some` or `find` are the answers** — `throw` to escape a `forEach` is a real anti-pattern.

## `reduce` — the one with the real edge case

```js
Array.prototype.myReduce = function (callbackFn, ...rest) {
  const o = Object(this);
  const len = o.length >>> 0;

  if (typeof callbackFn !== "function") throw new TypeError(callbackFn + " is not a function");

  let i = 0;
  let acc;

  if (rest.length > 0) {                         // 🔴 rest.length, not initialValue !== undefined
    acc = rest[0];
  } else {
    while (i < len && !(i in o)) i++;            // find the first non-hole
    if (i >= len) throw new TypeError("Reduce of empty array with no initial value");
    acc = o[i++];
  }

  for (; i < len; i++) {
    if (i in o) acc = callbackFn(acc, o[i], i, o);
  }
  return acc;
};
```

Three details, and the first is the classic:

- 🔴 **Detect the initial value with `arguments.length` / a rest parameter, not by comparing
  against `undefined`.** `[1,2].reduce(f, undefined)` **did** pass an initial value, and treating
  it as absent silently changes the result. This is the single most-probed detail in the whole
  topic.
- 🔴 **`reduce` on an empty array with no initial value throws `TypeError: Reduce of empty array
  with no initial value`** — that exact behaviour, not a silent `undefined`.
- **The callback takes four arguments**: accumulator, current, index, array — and `reduce` takes
  **no `thisArg`**, unlike `map`/`filter`/`forEach`. Adding one is a common invention.

## Mutation during iteration

The specification pins this down, and the behaviour is genuinely surprising:

- **The range is fixed at the start.** `len` is read once, so **elements appended during iteration
  are never visited**.
- **Changes to not-yet-visited elements *are* seen**, because the value is read at visit time.
- **Deleting an element ahead** means that index becomes a hole and is skipped.

```js
const arr = [1, 2, 3];
arr.forEach((x, i) => { if (i === 0) arr.push(99); console.log(x); });   // 1, 2, 3 — no 99

const b = [1, 2, 3];
b.forEach((x, i) => { if (i === 0) b[2] = 30; console.log(x); });        // 1, 2, 30
```

⚠️ **This is why mutating the array you are iterating is a bug even when it appears to work.** The
rules are consistent but almost nobody predicts them correctly, and a reader certainly will not.

## Gotchas

**Symptom:** A custom `map` calls the callback for holes
**Cause:** Looping without `if (i in o)`.
**Fix:** Test with `in`; MDN: *"not invoked for empty slots in sparse arrays."*

**Symptom:** A custom `map` skips explicit `undefined` values
**Cause:** `if (o[i] !== undefined)` used as the hole check.
**Fix:** `in` distinguishes a hole from a stored `undefined`.

**Symptom:** The mapped array is shorter than the input
**Cause:** `push`ing instead of assigning by index — that is `filter`'s behaviour.
**Fix:** `result[i] = …` and preserve `length`.

**Symptom:** `reduce` gives the wrong answer when `undefined` is passed as the seed
**Cause:** Detecting the initial value by comparing to `undefined`.
**Fix:** Check `arguments.length` or a rest parameter's length.

**Symptom:** `reduce` on `[]` returns `undefined` instead of throwing
**Cause:** The no-initial-value case was not handled.
**Fix:** Throw `TypeError: Reduce of empty array with no initial value`.

**Symptom:** `thisArg` has no effect
**Cause:** The callback is an arrow function, which has no own `this`.
**Fix:** A regular function — or do not use `thisArg`.

**Symptom:** Elements appended during `forEach` are not visited
**Cause:** The length is captured before the first call.
**Fix:** Expected. Do not mutate while iterating.

**Symptom:** `break` inside `forEach` is a syntax error
**Cause:** It is a callback, not a loop body.
**Fix:** `for…of`, `some`, or `find`.

## Interview questions

**★ Implement `Array.prototype.map`. What are the four details?**
The three callback arguments (element, index, array); `thisArg` passed via `callbackFn.call`;
**skipping holes with `i in o`** while still visiting explicit `undefined`s; and preserving the
result's length. Plus `Object(this)` and `length >>> 0` if you want it generic as the spec is.

**★ Why `if (i in o)` rather than `if (o[i] !== undefined)`?**
Because a hole and a stored `undefined` are different. MDN: the callback *"is not invoked for
empty slots in sparse arrays"* — but it **is** invoked for an element whose value is `undefined`.
Only `in` distinguishes them.

**★ How does `reduce` know whether an initial value was passed?**
By the **argument count**, not by comparing to `undefined` — `arr.reduce(f, undefined)` did pass
one. Getting this wrong silently changes the result, which is why it is the most-probed detail
here.

**★ What does `[].reduce((a, b) => a + b)` do?**
Throws `TypeError: Reduce of empty array with no initial value`. It does not return `undefined`.

**★ What is the difference in the returned array between `map` and `filter` on a sparse input?**
`map` preserves length and holes; `filter` compacts into a shorter dense array. Both skip the
holes when calling the callback.

**★ What happens if you push to an array inside `forEach`?**
The new elements are never visited — the length is captured before the first callback. But
**changes to elements not yet visited are seen**, because values are read at visit time. Consistent
rules that nobody predicts, which is why mutating while iterating is a bug even when it works.

**Why does `thisArg` do nothing with an arrow callback?**
Arrows have no own `this` — it is lexically inherited and cannot be set by `call`. `thisArg` is a
pre-arrow affordance.

---

[Topic index](./README.md) · Next → [02 · The rest of the family](./02-the-rest-of-the-family.md)
