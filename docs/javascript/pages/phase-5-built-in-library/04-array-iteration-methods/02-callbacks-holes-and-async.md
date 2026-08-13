---
title: "04.2 · Callbacks, holes and async"
sidebar_label: "02 · Callbacks, holes, async"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-13 against MDN — [`forEach`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/forEach), [`find`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/find), [`every`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/every). Documentation-validated.

Three things every iteration method shares, and one of them is a trap that silently
produces wrong results.

## The callback signature is always three arguments

```js
arr.forEach((element, index, array) => { … });
arr.map((element, index, array) => { … });
```

MDN, for `forEach`: the callback receives *"`element` — the current element being
processed, `index` — the index of the current element, `array` — the array `forEach()`
was called upon."* Every iteration method on this page follows it.

**The third argument is why passing a named function directly can misfire:**

```js
["1", "2", "3"].map(parseInt);   // [1, NaN, NaN]
```

`map` calls `parseInt("1", 0)`, `parseInt("2", 1)`, `parseInt("3", 2)` — the index
arrives as `parseInt`'s **radix**. Radix `0` is treated as 10, radix `1` is invalid,
and `"3"` is not a valid base-2 digit. The fix is to control the arity:

```js
["1", "2", "3"].map(Number);            // [1, 2, 3] — Number takes one argument
["1", "2", "3"].map((s) => parseInt(s, 10)); // [1, 2, 3]
```

The same shape bites with any function whose second or third parameter means something
— `map(fn)` where `fn(value, options)` quietly receives the index as `options`. **When
passing an existing function to an iteration method, check its arity.**

All of these also take an optional `thisArg` after the callback — except `reduce` and
`reduceRight`, whose second argument is the initial value, and `sort`, which has none.
An arrow function makes the whole question moot, per
[Phase 4 · 07](../../phase-4-objects-and-classes/07-this-in-methods/01-how-methods-lose-this.md).

## Holes: the methods disagree, and MDN documents both sides

This is the part worth memorising, because the two behaviours look identical until a
sparse array shows up.

**`forEach` (and `map`, `filter`, `some`, `every`, `reduce`) skip holes.** MDN's
example:

```js
const arraySparse = [1, 3, /* empty */, 7];
let numCallbackRuns = 0;

arraySparse.forEach((element) => {
  console.log({ element });
  numCallbackRuns++;
});

// { element: 1 }
// { element: 3 }
// { element: 7 }
// { numCallbackRuns: 3 }
```

Four slots, **three callback runs**. MDN on `every` says the same thing in general
terms: *"`callbackFn` is invoked only for array indexes which have assigned values. It
is not invoked for empty slots in sparse arrays."*

**`find` and `findIndex` do the opposite.** MDN: *"`callbackFn` is invoked for *every*
index of the array, not just those with assigned values"*, and *"Empty slots in sparse
arrays behave the same as `undefined`."* Its example:

```js
const array = [0, 1, , , , 5, 6];

array.find((value, index) => {
  console.log("Visited index", index, "with value", value);
  return false;
});
// Visited index 0 with value 0
// Visited index 1 with value 1
// Visited index 2 with value undefined
// Visited index 3 with value undefined
// Visited index 4 with value undefined
// Visited index 5 with value 5
// Visited index 6 with value 6
```

**Seven visits, three of them holes reported as `undefined`.**

So on the same array, `forEach` runs three times and `find` runs seven. And the
skipping produces genuinely surprising results:

```js
[1, , 3].every((x) => x !== undefined); // true  — the hole was never tested
[2, , 2].every((x) => x === 2);         // true  — same reason
```

Both of MDN's `every` examples return `true` for arrays that visibly contain a gap.

| Behaviour | Methods |
|---|---|
| **Skip holes** | `forEach`, `map`, `filter`, `some`, `every`, `reduce`, `reduceRight` |
| **Visit holes as `undefined`** | `find`, `findIndex`, `findLast`, `findLastIndex`, `for...of`, spread, `Array.from` |

🔴 **The fix is upstream, not here: do not create holes.** See
[01 · Holes and `length`](../01-array-creation-and-shape/02-holes-and-length.md). If you
receive a sparse array, normalise it with `[...arr]` before iterating.

Note `map` *preserves* holes in its output — it does not call the callback for them,
but it does keep the slot empty — so a `map` over a sparse array stays sparse.

## Mutating the array while iterating

The range of elements is decided **before** the first callback runs. So:

- **Elements appended during iteration are not visited** — the method already knows
  where it stops.
- **Elements removed during iteration cause skips**, exactly as in the `splice`-in-a-
  forward-loop case from [02 · `splice`](../02-adding-and-removing/02-splice.md).
- **Changing an element's value** before it is reached *is* seen, because the value is
  read at visit time.

```js
const arr = [1, 2, 3];
arr.forEach((x) => { if (x === 1) arr.push(99); });  // 99 is never visited
```

**Do not mutate the array you are iterating.** Build a new one — `filter`, `map`, or a
fresh array you push into — which is the same advice as everywhere else in this phase.

## The async trap

The one that silently produces wrong answers. MDN's example:

```js
const ratings = [5, 4, 5];
let sum = 0;

const sumFunction = async (a, b) => a + b;

ratings.forEach(async (rating) => {
  sum = await sumFunction(sum, rating);
});

console.log(sum);
// Naively expected output: 14
// Actual output: 0
```

**`0`, not `14`.** MDN: *"`forEach()` expects a synchronous function"* and *"does not
wait for promises"*.

An `async` callback returns a **promise**, and `forEach` throws that promise away. All
three callbacks start, none has resolved by the time `console.log` runs, and `sum` is
still `0`. Worse, each `await sumFunction(sum, …)` captured `sum` as `0` before
suspending, so even after they settle the result is wrong — a lost-update race, not
just a timing issue.

The same applies to `map`, `filter`, `find`, `some` and `every`. `filter(async …)` is
especially nasty: every promise is truthy, so **nothing is filtered out**.

**The three correct patterns:**

```js
// sequential — each waits for the previous
for (const r of ratings) {
  sum = await sumFunction(sum, r);
}

// concurrent, collecting results — map returns promises, Promise.all awaits them
const results = await Promise.all(items.map(async (i) => fetchOne(i)));

// concurrent, tolerating failures
const settled = await Promise.allSettled(items.map((i) => fetchOne(i)));
```

**`for...of` with `await` is sequential; `Promise.all` over a `map` is concurrent.**
That is the choice, and it is a real one — sequential is slower but bounded and
ordered; concurrent is faster but fires every request at once. MDN points at promise
composition for the sequential case.

## Gotchas

**Symptom:** `["1","2","3"].map(parseInt)` gives `[1, NaN, NaN]`
**Cause:** The callback receives `(element, index, array)`, and `parseInt` reads the
index as its **radix**.
**Fix:** `map(Number)` or `map((s) => parseInt(s, 10))`. Check the arity of any named
function you pass.

**Symptom:** `forEach` ran fewer times than the array's length
**Cause:** Holes. MDN: *"`callbackFn` is not invoked for empty slots"* — its example
runs 3 times over 4 slots.
**Fix:** Normalise with `[...arr]`, and do not create holes upstream.

**Symptom:** `[1, , 3].every(x => x !== undefined)` is `true`
**Cause:** `every` never tested the hole, so nothing falsified the predicate.
**Fix:** The array should not be sparse. Normalise before validating.

**Symptom:** `find` visits more indices than `forEach` on the same array
**Cause:** They are documented to differ — `find` is *"invoked for every index"* and
treats holes as `undefined`; `forEach` skips them.
**Fix:** Expected. Know which family a method belongs to.

**Symptom:** A value computed inside an `async` `forEach` callback is unchanged
afterwards
**Cause:** MDN: `forEach` *"does not wait for promises"* — the callbacks' promises are
discarded. Its own example prints `0` where `14` was expected.
**Fix:** `for...of` with `await` for sequential work, or
`await Promise.all(arr.map(async …))` for concurrent.

**Symptom:** `filter(async (x) => test(x))` filters nothing out
**Cause:** Every promise is truthy, so every element passes.
**Fix:** `const flags = await Promise.all(arr.map(test));` then
`arr.filter((_, i) => flags[i])`.

**Symptom:** Items pushed during a `forEach` are never visited
**Cause:** The range of elements is fixed before the first callback runs.
**Fix:** Do not mutate the array you are iterating — build a new one.

## Interview questions

**★ Why does `["1","2","3"].map(parseInt)` return `[1, NaN, NaN]`?**
Because every iteration callback receives `(element, index, array)`, and `parseInt`'s
second parameter is the **radix**. So it calls `parseInt("1",0)`, `parseInt("2",1)`,
`parseInt("3",2)`. Use `map(Number)` or wrap it in an arrow that passes only the value.

**★ Which iteration methods skip holes?**
`forEach`, `map`, `filter`, `some`, `every` and `reduce` — MDN: *"invoked only for
array indexes which have assigned values"*. But `find` and `findIndex` are documented
to be *"invoked for every index"*, treating holes as `undefined`. So `forEach` runs 3
times and `find` runs 7 on the same sparse array.

**★ What happens if you pass an `async` function to `forEach`?**
The promise is discarded and nothing is awaited. MDN's own example expects `14` and
prints **`0`**. Use `for...of` with `await` for sequential work, or
`await Promise.all(arr.map(async …))` for concurrent work. `filter(async …)` is worse —
every promise is truthy, so nothing is filtered.

**★ What is the difference between `for...of` + `await` and `Promise.all(map(...))`?**
The first is **sequential** — each iteration waits for the previous, so order is
guaranteed and concurrency is one. The second is **concurrent** — every call starts at
once and you wait for all of them. Pick by whether the operations are independent and
whether the target can take the load.

**Can you mutate an array while iterating it?**
You should not. The range is fixed before the first callback, so appended elements are
never visited and removals cause skips. Build a new array instead.

**Do all iteration methods take a `thisArg`?**
Most do — `forEach`, `map`, `filter`, `find`, `findIndex`, `some`, `every`, `flatMap`.
But **`reduce` and `reduceRight` do not** (their second argument is the initial value)
and neither does `sort`. An arrow function avoids the question entirely.

---

← [Choosing a method](./01-choosing-a-method.md) · [Topic index](./README.md) · Next → [Phase index](../README.md)
