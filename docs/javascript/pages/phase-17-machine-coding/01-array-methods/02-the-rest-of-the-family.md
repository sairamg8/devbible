---
title: "01.2 · The rest of the family"
sidebar_label: "02 · The rest of the family"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-14 against MDN — [`Array.prototype.flat()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/flat), [`Array.prototype.flatMap()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/flatMap), [`Array.prototype.some()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/some), [`Array.prototype.every()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/every), [`Array.prototype.includes()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/includes), [`Array.prototype.indexOf()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/indexOf). Documentation-validated; **no timings**.

**The follow-up questions.** Having written `map`, the interviewer asks for one of these — and each
hides exactly one detail that the naive version gets wrong.

## `some` and `every` — short-circuiting and the empty case

```js
Array.prototype.mySome = function (callbackFn, thisArg) {
  const o = Object(this);
  const len = o.length >>> 0;
  for (let i = 0; i < len; i++) {
    if (i in o && callbackFn.call(thisArg, o[i], i, o)) return true;    // 🔴 return, not a flag
  }
  return false;                                                         // empty → false
};

Array.prototype.myEvery = function (callbackFn, thisArg) {
  const o = Object(this);
  const len = o.length >>> 0;
  for (let i = 0; i < len; i++) {
    if (i in o && !callbackFn.call(thisArg, o[i], i, o)) return false;
  }
  return true;                                                          // 🔴 empty → TRUE
};
```

🔴 **`[].every(f)` is `true`.** It is *vacuous truth* — "every element satisfies the predicate" is
trivially true when there are no elements — and it is the detail this pair exists to test.
`[].some(f)` is `false` by the mirror argument.

⚠️ **The practical consequence bites in validation code:** `errors.every(isResolved)` returns
`true` for an empty list, which is usually what you want, while a hand-rolled loop with a flag
often does not. Knowing it is deliberate rather than accidental is the point.

**Both must short-circuit.** Accumulating into a flag and returning it at the end gives the right
answer and calls the predicate for every element — which is observably different when the predicate
has side effects or is expensive.

## `indexOf` versus `includes` — two different equality rules

```js
Array.prototype.myIndexOf = function (searchElement, fromIndex = 0) {
  const o = Object(this);
  const len = o.length >>> 0;
  let start = fromIndex | 0;
  if (start < 0) start = Math.max(len + start, 0);            // negative counts from the end

  for (let i = start; i < len; i++) {
    if (i in o && o[i] === searchElement) return i;           // 🔴 strict equality
  }
  return -1;
};
```

🔴 **`indexOf` uses `===` and `includes` uses SameValueZero.** The observable difference is
`NaN`:

```js
[NaN].indexOf(NaN);      // -1   — NaN !== NaN
[NaN].includes(NaN);     // true — SameValueZero treats NaN as equal to itself
```

And the second difference is holes: `includes` treats a hole as `undefined` and finds it;
`indexOf` skips holes entirely.

```js
[, 1].includes(undefined);   // true
[, 1].indexOf(undefined);    // -1
```

**Two methods that look interchangeable and differ on both `NaN` and holes** — which is exactly
why this is asked.

## `flat` — the recursive one

```js
Array.prototype.myFlat = function (depth = 1) {
  const o = Object(this);
  const len = o.length >>> 0;
  const result = [];

  for (let i = 0; i < len; i++) {
    if (!(i in o)) continue;                                   // 🔴 flat REMOVES holes
    const value = o[i];
    if (Array.isArray(value) && depth > 0) {
      result.push(...Array.prototype.myFlat.call(value, depth - 1));
    } else {
      result.push(value);
    }
  }
  return result;
};
```

Three details:

- 🔴 **`flat` removes empty slots**, at any depth — even with `depth = 0`, `[1, , 3].flat(0)` is
  `[1, 3]`. That is a documented behaviour and a surprising one.
- **`Array.isArray`, not `instanceof Array`.** `instanceof` fails across realms — an array from an
  iframe or a worker is not an `instanceof` your realm's `Array`, and this is the standard reason
  to prefer `Array.isArray`.
- **`depth` defaults to 1** and takes `Infinity`. ⚠️ `push(...spread)` on a very large flattened
  array can throw `RangeError: Maximum call stack size exceeded`, because spread passes each
  element as an argument — an iterative `for` push is safer at scale.

**`flatMap` is `map` then `flat(1)`**, and it is *not* `flat(1)` after a full `map` — the
specification defines it as a single pass, which matters only for observable side-effect ordering.
Depth is fixed at 1 and cannot be changed.

## `sort` — the two things to say

Not usually asked as an implementation, but the two facts are:

- **It mutates and returns the same array**, which is why `toSorted` exists.
- **The default comparator converts elements to strings and compares UTF-16 code units** — so
  `[1, 10, 9].sort()` is `[1, 10, 9]`. This is the most-hit trap in the language, and the fix is
  always `(a, b) => a - b`.
- **The sort is stable**, required since ES2019, which is what makes multi-key sorting work by
  sorting least-significant key first.

## Where a polyfill is genuinely appropriate

⚠️ **Do not ship `Array.prototype.myMap` — or worse, overwrite the real one.** Extending built-in
prototypes:

- collides with future language additions (the `Array.prototype.flatten` / SmooshGate episode is
  the canonical example — a proposed method had to be renamed to `flat` because an old library had
  added an incompatible `flatten`);
- makes properties enumerable in `for…in` unless defined with `Object.defineProperty` and
  `enumerable: false`;
- is invisible to a reader of the call site.

**Write a standalone function.** Prototype extension is an interview exercise and a bad practice,
and saying so is part of a complete answer.

## Gotchas

**Symptom:** `[].every(f)` returns `true` and surprises someone
**Cause:** Vacuous truth — it is the specified behaviour.
**Fix:** Nothing; know it, and guard on length if the empty case should differ.

**Symptom:** A custom `some` calls the predicate for every element
**Cause:** A flag accumulated instead of an early return.
**Fix:** Return immediately; short-circuiting is observable.

**Symptom:** `indexOf` cannot find `NaN`
**Cause:** It uses `===`.
**Fix:** `includes`, which uses SameValueZero.

**Symptom:** `includes(undefined)` is `true` on a sparse array
**Cause:** `includes` treats holes as `undefined`; `indexOf` skips them.
**Fix:** Expected — pick the method whose rule you want.

**Symptom:** `flat(0)` removes holes
**Cause:** Documented — `flat` removes empty slots at any depth.
**Fix:** Expected.

**Symptom:** `instanceof Array` is false for a real array
**Cause:** It came from another realm (iframe, worker).
**Fix:** `Array.isArray`.

**Symptom:** `RangeError` flattening a huge array
**Cause:** `push(...spread)` passes every element as an argument.
**Fix:** An iterative push loop.

**Symptom:** A polyfill breaks a library
**Cause:** Prototype extension colliding with a real or future method.
**Fix:** A standalone function; if you must extend, `Object.defineProperty` with
`enumerable: false`.

## Interview questions

**★ What does `[].every(f)` return, and why?**
`true` — vacuous truth: "all elements satisfy the predicate" holds trivially with no elements.
`[].some(f)` is `false` for the mirror reason. It is the detail the pair is asked about.

**★ Why must `some` and `every` return early rather than set a flag?**
Because short-circuiting is observable — the predicate is not called for the remaining elements.
A flag gives the same answer with different side effects and cost.

**★ `indexOf` versus `includes` — name both differences.**
Equality: `indexOf` uses `===` so it cannot find `NaN`; `includes` uses SameValueZero and can. And
holes: `includes` treats a hole as `undefined` and finds it, `indexOf` skips holes entirely.

**★ Implement `flat`. What surprises people?**
Recursion with a depth counter, `Array.isArray` for the check — and 🔴 **`flat` removes empty slots
at any depth**, including `depth = 0`. Also `Array.isArray` rather than `instanceof`, because
`instanceof` fails across realms.

**★ Why `Array.isArray` and not `instanceof Array`?**
`instanceof` checks the prototype chain against **your realm's** `Array`. An array from an iframe
or a worker has a different `Array.prototype` and fails the check. `Array.isArray` is realm-safe.

**★ Should you actually polyfill onto `Array.prototype`?**
No. It collides with future language additions — the `flatten`→`flat` rename happened because an
old library's incompatible `flatten` broke pages — and it pollutes `for…in` unless defined
non-enumerable. Write a standalone function; saying this is part of the answer.

**Why is `[1, 10, 9].sort()` unchanged?**
The default comparator stringifies and compares UTF-16 code units, so `"10" < "9"`. Always pass
`(a, b) => a - b` for numbers.

---

← [01 · The callback contract](./01-the-callback-contract.md) · [Topic index](./README.md) ·
Next → [Phase index](../README.md)
