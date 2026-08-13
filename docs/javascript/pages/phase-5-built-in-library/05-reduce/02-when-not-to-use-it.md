---
title: "05.2 · When not to use `reduce`"
sidebar_label: "02 · When not to use it"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-13 against MDN — [`Array.prototype.reduce`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/reduce), [`Object.groupBy`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/groupBy). Documentation-validated.

**MDN has a section titled "When to not use `reduce()`".** That is unusual for a
built-in method, and it is worth taking seriously: `reduce` is the most over-applied
method in the language, and the over-application has a documented cost.

## The O(N²) anti-pattern

MDN's own example of what not to write:

```js
// ❌ Avoid: copying the accumulator each iteration
const countedNames = names.reduce((allNames, name) => {
  return {
    ...allNames,                        // Copies entire object every iteration
    [name]: (allNames[name] ?? 0) + 1,
  };
}, {});
```

And its recommended replacement:

```js
// ✅ Better: use a for loop
const countedNames = Object.create(null);
for (const name of names) {
  countedNames[name] = (countedNames[name] ?? 0) + 1;
}
```

**The spread is the problem.** Each iteration copies every key accumulated so far, so
the work grows with the square of the input: N iterations copying an average of N/2
keys. For 10 names it is invisible; for 10,000 it is roughly 50 million property
copies to do 10,000 increments.

This shape is everywhere, because it is what "immutable style" looks like if you apply
it without thinking. **Inside a `reduce`, the accumulator is already private** — you
created it, nothing else can see it, and mutating it is not a purity violation. The
immutability that matters is at the boundary: return a new object *from the function*,
not a new object *per iteration*.

So the same rule, stated positively:

```js
// ✅ mutate the private accumulator
const counted = names.reduce((acc, name) => {
  acc[name] = (acc[name] ?? 0) + 1;
  return acc;
}, Object.create(null));
```

That is linear, and it is fine. But note MDN prefers the plain loop even here — and it
is right, because the loop needs no `return acc` and reads better.

🔴 **Note on the complexity claim:** this is MDN's own analysis of the algorithm, not a
benchmark. This corpus builds no benchmarks, so there is **no measured multiplier
here** — the point is the shape, which is quadratic by construction.

## There is usually a better-named method

MDN's table of `reduce` misuses and what to use instead:

| Task | Use this instead |
|---|---|
| Flattening arrays | `array.flat()` |
| Grouping objects | `Object.groupBy()` |
| Concatenating arrays | `array.flatMap()` |
| Removing duplicates | `Array.from(new Set(array))` |
| Finding elements | `array.find()`, `array.some()` |
| Filtering | `array.filter()` |

Each of these has a `reduce` version that people genuinely write:

```js
// ❌ reduce                                    // ✅ what it should be
arr.reduce((a, b) => a.concat(b), [])           arr.flat()
arr.reduce((a, x) => a.includes(x) ? a : [...a, x], [])
                                                Array.from(new Set(arr))
arr.reduce((a, x) => f(x) ? [...a, x] : a, [])  arr.filter(f)
items.reduce((m, i) => { (m[i.type] ??= []).push(i); return m; }, {})
                                                Object.groupBy(items, (i) => i.type)
```

**`Object.groupBy` and `Map.groupBy` are the big ones**, because grouping is the most
common legitimate-looking `reduce`. `Map.groupBy` is usually the better of the two — a
`Map` accepts any key type and keeps insertion order, per
[Phase 4 · 01 · Keys and order](../../phase-4-objects-and-classes/01-object-literals/03-keys-and-order.md).

Note the dedupe row is doubly bad in the `reduce` form: `includes` inside the callback
makes it quadratic *and* the spread makes it quadratic again.

## Where `reduce` is genuinely the right answer

MDN's own "appropriate use cases", and they share a shape:

```js
// ✅ Summing values
[1, 2, 3, 4].reduce((acc, cur) => acc + cur, 0); // 10

// ✅ Function composition (pipe)
const pipe = (...functions) => (initialValue) =>
  functions.reduce((acc, fn) => fn(acc), initialValue);

// ✅ Promise sequencing
const asyncPipe = (...functions) => (initialValue) =>
  functions.reduce((acc, fn) => acc.then(fn), Promise.resolve(initialValue));
```

The pattern: **a genuine fold to a single scalar, or a fold over functions rather than
over data.** `pipe` and `asyncPipe` are the clearest cases — there is no named method
for "apply each of these in turn", and the `reduce` reads exactly as the operation.

The promise-sequencing one is worth keeping: it runs an array of async steps
**sequentially**, which `Promise.all` cannot do and a `for...of` with `await` can only
do with a fixed body.

Two more that are fine:

```js
// a single pass producing several results at once
const { sum, count, max } = nums.reduce(
  (a, n) => ({ sum: a.sum + n, count: a.count + 1, max: Math.max(a.max, n) }),
  { sum: 0, count: 0, max: -Infinity },
);

// building a Map, where set() returns the map
const byId = items.reduce((m, i) => m.set(i.id, i), new Map());
```

The first spreads a **fixed, small** object per iteration — three keys, not N — so it
is linear. That is the distinction from the anti-pattern: spreading a *bounded* shape
is fine, spreading the *accumulated* shape is not.

## The readability rule

The honest summary, and it is a judgement call rather than a law:

- **A `reduce` that folds to a scalar** — sum, max, count, a boolean — is clear.
- **A `reduce` whose accumulator is a growing collection** is usually a loop, a
  `filter`/`map`, or a `groupBy` in disguise. Name it correctly.
- **A `reduce` you cannot rewrite as MDN's `for...of` equivalent at a glance** is too
  clever. From [chunk 1](./01-the-shape.md): `reduce` *is* that loop.

Team convention matters more than the individual call. A codebase where everything is
a `reduce` is hard to read; so is one where a three-line fold has been expanded into
twelve lines of loop. **Optimise for the reader who did not write it.**

## Gotchas

**Symptom:** A `reduce` that builds an object gets dramatically slower as input grows
**Cause:** MDN's documented anti-pattern — spreading the accumulator each iteration
*"copies entire object every iteration"*, which is quadratic by construction.
**Fix:** Mutate the private accumulator and `return` it, or use a `for...of` loop as
MDN recommends.

**Symptom:** A dedupe built with `reduce` + `includes` is slow
**Cause:** Quadratic twice over — the `includes` scan and the spread.
**Fix:** `Array.from(new Set(arr))`.

**Symptom:** A grouping `reduce` is hard to read
**Cause:** It is `Object.groupBy` / `Map.groupBy` written by hand.
**Fix:** Use those. Prefer `Map.groupBy` — any key type, and insertion order.

**Symptom:** `arr.reduce((a, b) => a.concat(b), [])` to flatten
**Cause:** A hand-rolled `flat`, and `concat` allocates a new array each step.
**Fix:** `arr.flat()`, or `arr.flatMap(f)` when mapping as well.

**Symptom:** Reviewers keep asking what a `reduce` does
**Cause:** The accumulator is doing more than one job, or it is a collection rather
than a scalar.
**Fix:** Rewrite as the equivalent `for...of` loop and see if it reads better. Usually
it does.

**Symptom:** Sequential async work run with `reduce` behaves concurrently
**Cause:** The callback returns promises that are not chained — only
`acc.then(fn)` (or `await` inside a loop) sequences them.
**Fix:** MDN's `asyncPipe` shape, or a `for...of` with `await`.

## Interview questions

**★ When should you not use `reduce`?**
MDN devotes a section to this. Chiefly when the accumulator is **copied each
iteration** — spreading it is quadratic by construction — and when a better-named
method exists: `flat` for flattening, `Object.groupBy`/`Map.groupBy` for grouping,
`Array.from(new Set(x))` for dedupe, `filter`/`find`/`some` for their own jobs.

**★ Why is `reduce((acc, x) => ({...acc, [x]: …}), {})` a problem?**
Because each iteration copies **every key accumulated so far**, so N iterations copy
roughly N²/2 properties. Inside a `reduce` the accumulator is private — mutating it is
not an immutability violation, and MDN's recommended fix is a plain `for...of` loop.

**★ When is `reduce` genuinely the right tool?**
Folding to a **scalar** (sum, max, count), and folding over **functions** rather than
data — `pipe` and promise sequencing, both of which are MDN's own examples. Also a
single pass producing several results at once, where the per-iteration object is a
fixed small shape rather than the growing accumulator.

**★ How do you group an array by a key?**
`Object.groupBy(items, fn)` or `Map.groupBy(items, fn)` — prefer the `Map` version,
which takes any key type and preserves insertion order. The hand-written `reduce`
version is the most common legitimate-looking misuse.

**How do you run async steps sequentially over an array?**
Chain them: `fns.reduce((acc, fn) => acc.then(fn), Promise.resolve(init))` — MDN's
`asyncPipe`. Or a `for...of` with `await`. `Promise.all` over a `map` is concurrent, not
sequential.

**What is the test for a `reduce` being too clever?**
Whether you can immediately rewrite it as the `for...of` loop MDN gives as its
equivalent. If not, write the loop.

---

← [The shape that stays readable](./01-the-shape.md) · [Topic index](./README.md) · Next → [Phase index](../README.md)
