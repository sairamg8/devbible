---
title: "01.2 · Holes, `length` and sparse arrays"
sidebar_label: "02 · Holes and length"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-13 against MDN — [`Array.prototype.length`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/length), [`Array.from`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/from), [`delete`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/delete). Documentation-validated.

**`length` is a writable property, and an array index can be in three states rather
than two.** Both facts surprise people, and together they produce the sparse-array
behaviour that makes array methods look inconsistent.

## `length` is writable

MDN: *"The `length` property of an Array instance represents the number of slots in
that array. It is a **writable** nonnegative integer less than 2³²."*

Its descriptor: **writable yes, enumerable no, configurable no.** Non-enumerable is
why `Object.keys(["a"])` is `["0"]` and not `["0","length"]`.

### Writing a smaller value truncates

```js
const numbers = [1, 2, 3, 4, 5];

if (numbers.length > 3) {
  numbers.length = 3;
}

console.log(numbers);    // [1, 2, 3]
console.log(numbers[3]); // undefined; the extra elements are deleted
```

**`arr.length = 0` is the classic in-place "empty this array"** — it drops every
element while keeping the same array object, so other references to it see the
emptying. That is either exactly what you wanted or a nasty surprise, depending on
who else holds the reference. `arr = []` instead rebinds and leaves other holders
looking at the full array.

### Writing a larger value creates holes

```js
const arr = [1, 2];
arr.length = 5; // set array length to 5 while currently 2.
console.log(arr);
// [ 1, 2, <3 empty items> ]

arr.forEach((element) => console.log(element));
// 1
// 2
```

Note what `forEach` did: **two iterations, not five.** The three new slots are *empty*
— not `undefined` values — and `forEach` skips them entirely. That is the sparse-array
behaviour in one example.

### Invalid lengths throw

```js
listB.length = 2 ** 32; // 4294967296
// RangeError: Invalid array length

const listC = new Array(-100); // Negative numbers are not allowed
// RangeError: Invalid array length
```

The ceiling is 2³²−1 (4,294,967,295), and negatives and non-integers are rejected the
same way.

## The three states of an index

This is the same three-state distinction as
[Phase 4 · 03](../../phase-4-objects-and-classes/03-existence-checks-and-delete/02-undefined-holes-and-brand-checks.md),
and it is worth repeating here because arrays are where it does damage:

| State | `arr[i]` | `i in arr` | `Object.hasOwn(arr, i)` |
|---|---|---|---|
| present with a value | the value | true | true |
| present holding `undefined` | `undefined` | true | true |
| **a hole** | `undefined` | **false** | **false** |

Reading gives `undefined` for the last two, so **only `in` / `hasOwn` distinguish
them.** A hole is the *absence of the property*, not a stored value.

### Four ways to create holes, all avoidable

```js
new Array(3);            // [ <3 empty items> ]
[1, , 3];                // [1, <1 empty item>, 3]  ← an elision
arr.length = 5;          // extends with holes
delete arr[1];           // leaves a hole, length unchanged
```

`delete arr[1]` is the one that shows up in real code. MDN: *"When you delete an array
element, the array `length` is not affected."* Use `splice(1, 1)` to remove an element
properly, or `filter`/`toSpliced` to build a new array.

## Which methods skip holes and which do not

This is the practical payoff, and the inconsistency is genuine:

| Behaviour | Methods |
|---|---|
| **Skip holes** (callback not called; hole preserved in output) | `forEach`, `map`, `filter`, `some`, `every`, `reduce`, `reduceRight` |
| **Treat holes as `undefined`** | `for...of`, spread `[...arr]`, `Array.from`, `find`, `findIndex`, `includes`, `join`, `sort`, `fill`, `entries` |
| **Never see them** | `Object.keys`, `Object.entries`, `JSON.stringify` (emits `null`) |

So the same array gives different answers depending on which method you use:

```js
const sparse = [1, , 3];
sparse.map((x) => x * 2);   // [2, <1 empty item>, 6]   ← callback ran twice
[...sparse];                // [1, undefined, 3]         ← three values
sparse.includes(undefined); // true  — treats the hole as undefined
sparse.indexOf(undefined);  // -1    — indexOf skips holes
JSON.stringify(sparse);     // "[1,null,3]"
```

**`includes` and `indexOf` disagreeing on the same array** is the sharpest form of it.
There is no rule to memorise here that is better than the real advice:

🔴 **Never create holes.** Then none of this table matters. Use `splice` to remove,
`Array.from({length: n}, fn)` to allocate, and `fill()` if you must start from
`new Array(n)`.

## Normalising a sparse array

If you receive one — from a parsed CSV, a legacy API, or `delete` in somebody else's
code:

```js
[...sparse];                              // holes → undefined
Array.from(sparse);                       // holes → undefined  (MDN: never sparse)
sparse.filter(() => true);                // holes removed entirely, array shortens
Array.from(sparse, (v) => v ?? fallback); // holes → a default, in one pass
```

Note the difference between the first two and the third: spread and `Array.from`
**keep the positions** and fill them with `undefined`; `filter` **removes** them and
shortens the array. Which you want depends on whether the indices carry meaning.

## `length` is not a count of elements

The single sentence worth taking away: **`length` is one more than the highest index,
not the number of values present.**

```js
const a = [];
a[99] = "x";
a.length;                        // 100
Object.keys(a).length;           // 1  ← the real count
a.filter(() => true).length;     // 1
```

Assigning to a large index extends `length` to cover it, filling everything between
with holes. So a "1000-element array" from a sparse assignment holds one value —
which matters when you are about to `map` over it, or reasoning about memory.

## Gotchas

**Symptom:** `map`/`forEach` skipped elements that appear to be there
**Cause:** They are **holes**, not `undefined` values, and those methods skip holes
while preserving them in the output.
**Fix:** Normalise first (`[...arr]` or `Array.from(arr)`), or avoid creating holes.

**Symptom:** `arr.length` is far larger than the number of values
**Cause:** `length` is one more than the highest index. A single `a[99] = "x"` gives
`length` 100.
**Fix:** `Object.keys(arr).length` for the real count, or do not index-assign into
gaps.

**Symptom:** `arr.length = 0` emptied an array somewhere else in the program
**Cause:** It mutates the array **in place**, so every holder of that reference sees
it.
**Fix:** `arr = []` if you only meant to rebind your own variable — but that leaves
other holders looking at the old contents.

**Symptom:** `RangeError: Invalid array length`
**Cause:** A `length` of 2³² or more, a negative, or a non-integer.
**Fix:** Check the value. `new Array(-1)` and `new Array(1.5)` both throw.

**Symptom:** `includes(undefined)` is `true` but `indexOf(undefined)` is `-1`
**Cause:** `includes` treats holes as `undefined`; `indexOf` skips them.
**Fix:** Do not rely on either against a sparse array — normalise it first.

**Symptom:** `JSON.stringify` turned holes into `null`
**Cause:** JSON has no representation for a hole, and `undefined` in an array position
becomes `null`.
**Fix:** Expected. Normalise deliberately if the receiver distinguishes them.

## Interview questions

**★ What are the three states an array index can be in?**
Present with a value, present holding `undefined`, and a **hole** — the property being
absent. Reading gives `undefined` for the last two, so only `in` or `Object.hasOwn`
distinguishes them. Holes come from `new Array(n)`, elisions, `delete`, and extending
`length`.

**★ Is `length` a count of elements?**
No — it is **one more than the highest index**. `a[99] = "x"` on an empty array makes
`length` 100 with one value present. It is also **writable**: shrinking it truncates,
growing it appends holes.

**★ Which array methods skip holes?**
The callback-taking classics — `forEach`, `map`, `filter`, `some`, `every`, `reduce`.
Iteration-protocol operations (`for...of`, spread, `Array.from`) treat holes as
`undefined` instead. So `[1,,3].map(f)` calls `f` twice while `[...[1,,3]]` gives three
values.

**★ How do you remove an element from an array?**
`splice(i, 1)` to mutate, or `filter` / `toSpliced` to build a new one. **Not
`delete`** — MDN: *"the array `length` is not affected"*, so it leaves a hole and every
hole-skipping method then behaves inconsistently.

**How do you normalise a sparse array?**
`[...arr]` or `Array.from(arr)` converts holes to `undefined` while keeping positions;
`arr.filter(() => true)` removes them and shortens the array. Pick by whether indices
carry meaning.

**What is the difference between `arr.length = 0` and `arr = []`?**
The first empties the array **in place**, so every reference to it sees an empty array.
The second rebinds your variable only — other holders still see the original contents.

---

← [Making arrays](./01-making-arrays.md) · [Topic index](./README.md) · Next → [Phase index](../README.md)
