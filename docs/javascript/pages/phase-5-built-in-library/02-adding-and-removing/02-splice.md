---
title: "02.2 · `splice`"
sidebar_label: "02 · splice"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-13 against MDN — [`Array.prototype.splice`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/splice), [`toSpliced`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/toSpliced). Documentation-validated.

**One method that removes, inserts, and replaces** — the general-purpose in-place
editor. MDN: it *"changes the contents of an array by removing or replacing existing
elements and/or adding new elements **in place**"*.

```js
arr.splice(start, deleteCount, ...itemsToInsert)
```

It **returns the removed elements**, as an array — *"an array containing the deleted
elements. Returns an empty array if no elements were removed."* Not the modified array.
That return value is the first thing people get wrong.

## The three jobs

**Remove:**

```js
const myFish = ["parrot", "anemone", "blue", "trumpet", "sturgeon"];
const removed = myFish.splice(2, 2);
// myFish is ["parrot", "anemone", "sturgeon"]
// removed is ["blue", "trumpet"]
```

**Insert without removing** — `deleteCount` of `0`:

```js
const months = ["Jan", "March", "April", "June"];
months.splice(1, 0, "Feb");
console.log(months);
// ["Jan", "Feb", "March", "April", "June"]
```

**Replace** — remove and insert at once, and the counts need not match:

```js
const myFish = ["angel", "clown", "drum", "sturgeon"];
const removed = myFish.splice(2, 1, "trumpet");
// myFish is ["angel", "clown", "trumpet", "sturgeon"]
// removed is ["drum"]
```

MDN: it *"changes the array's `length` if insertion count differs from deletion
count"* — so `splice(2, 1, "a", "b")` grows the array by one.

## The argument rules, which are all edge cases

**`start`:**

- **Negative counts back from the end.** MDN: *"if `-array.length <= start < 0`, then
  `start + array.length` is used"*.

  ```js
  const myFish = ["angel", "clown", "mandarin", "sturgeon"];
  const removed = myFish.splice(-2, 1);
  // myFish is ["angel", "clown", "sturgeon"]
  // removed is ["mandarin"]
  ```

- *"If `start < -array.length`, `0` is used"* — clamped, not an error.
- *"If `start >= array.length`, no elements are deleted; the method acts as an adding
  function"* — it appends.

**`deleteCount`** is where the real trap is:

| `deleteCount` | Effect |
|---|---|
| **omitted** | **deletes everything from `start` to the end** |
| `0` or negative | deletes nothing (insert-only) |
| greater than what remains | deletes to the end |

🔴 **Omitting `deleteCount` is not the same as passing `0`.** MDN: *"If omitted or
greater than remaining elements, all elements from `start` to the end are deleted."*

```js
arr.splice(2);      // truncates from index 2 — everything after is GONE
arr.splice(2, 0);   // does nothing
```

That is the single most damaging `splice` mistake, because `arr.splice(i)` looks like
"do something at `i`" and is actually "throw away the tail". It is also how
`splice` gets used deliberately as a truncate — the same thing `arr.length = i` does,
covered in [01 · Holes and `length`](../01-array-creation-and-shape/02-holes-and-length.md).

## `splice` is the correct way to remove one element

The comparison worth internalising, from
[Phase 4 · 03](../../phase-4-objects-and-classes/03-existence-checks-and-delete/03-delete-and-its-cost.md):

```js
delete arr[3];      // ❌ leaves a HOLE; length unchanged
arr.splice(3, 1);   // ✅ removes it; length decreases; no hole
```

`delete` removes the *property*, leaving the index absent and every hole-skipping
method behaving inconsistently. `splice` removes the *element* and closes the gap.

Removing by value rather than index:

```js
const i = arr.indexOf(value);
if (i !== -1) arr.splice(i, 1);
```

The `!== -1` guard is essential — `splice(-1, 1)` removes the **last** element, so a
missing value would silently delete the wrong one. That is a real bug shape, and it is
why `filter` is often the better answer:

```js
const without = arr.filter((x) => x !== value);   // removes ALL matches, no mutation
```

Note the difference: `splice` + `indexOf` removes the **first** match and mutates;
`filter` removes **every** match and builds a new array.

## Never `splice` inside a forward loop

```js
// ❌ skips elements
for (let i = 0; i < arr.length; i++) {
  if (shouldRemove(arr[i])) arr.splice(i, 1);
}
```

Removing element `i` shifts everything after it down one, so the next iteration's
`i + 1` skips what is now at `i`. Two consecutive removable items — only the first
goes.

Three correct options:

```js
// iterate backwards: removals only affect indices you have already passed
for (let i = arr.length - 1; i >= 0; i--) {
  if (shouldRemove(arr[i])) arr.splice(i, 1);
}

// or don't mutate at all — usually the right answer
const kept = arr.filter((x) => !shouldRemove(x));

// or mutate in place from a filtered copy, if the identity must be preserved
arr.length = 0;
arr.push(...kept);
```

**`filter` is the default.** Reach for backwards iteration only when you must mutate
the original array in place.

## `toSpliced` — the non-mutating counterpart

MDN: *"Use `toSpliced()` to create a new array with modifications without mutating the
original."*

```js
const updated = arr.toSpliced(2, 1, "trumpet");  // arr is untouched
```

Same arguments, but it returns the **new array** rather than the removed elements —
which is usually what you actually wanted. It is part of the ES2023 non-mutating
family alongside `toSorted`, `toReversed` and `with`, and it is the right default in
immutable-state code, where a new array identity is what change detection needs.

One behavioural difference worth knowing: `toSpliced` produces a **dense** array — it
does not preserve holes, whereas MDN notes `splice` *"preserves sparseness in sparse
arrays"*. One more reason not to have holes in the first place.

## Gotchas

**Symptom:** `const result = arr.splice(…)` gives the removed elements, not the array
**Cause:** `splice` returns *"an array containing the deleted elements"* and mutates
the original in place.
**Fix:** Use `arr` itself after the call, or `toSpliced` if you want the new array
returned.

**Symptom:** `arr.splice(2)` deleted everything after index 2
**Cause:** An omitted `deleteCount` deletes **to the end** — it is not the same as `0`.
**Fix:** Pass `deleteCount` explicitly. `arr.splice(2, 0, …)` to insert without
removing.

**Symptom:** A loop that removes items skips every other one
**Cause:** `splice` shifts later elements down, so a forward loop's next index lands
past the element that moved into the current position.
**Fix:** `filter` to build a new array, or iterate **backwards** if you must mutate.

**Symptom:** Removing by value deleted the wrong element
**Cause:** `indexOf` returned `-1` for a missing value, and `splice(-1, 1)` removes the
**last** element.
**Fix:** Guard with `if (i !== -1)`, or use `filter`.

**Symptom:** `delete arr[i]` left a gap that later broke `map`
**Cause:** `delete` leaves a **hole**; only `splice` (or `filter`) actually removes.
**Fix:** `arr.splice(i, 1)`.

**Symptom:** Splicing an array from props or state caused a stale UI
**Cause:** In-place mutation leaves the array identity unchanged, so change detection
sees nothing.
**Fix:** `toSpliced`, or `filter`/spread to produce a new array.

## Interview questions

**★ What does `splice` return?**
The **removed elements**, as an array — empty if nothing was removed — *not* the
modified array. The original is changed **in place**. `toSpliced` is the counterpart
that leaves the original alone and returns the new array.

**★ What is the difference between `splice(2)` and `splice(2, 0)`?**
`splice(2)` **deletes everything from index 2 to the end** — MDN: an omitted
`deleteCount` deletes all remaining elements. `splice(2, 0)` deletes nothing and is the
insert-only form. This is the most damaging `splice` mistake.

**★ Why does removing items in a forward loop skip elements?**
Because `splice` shifts every later element down one index, so after removing at `i`
the next element is *at* `i`, and `i++` steps past it. Iterate backwards, or use
`filter` — which is usually the better answer anyway.

**★ Difference between `delete arr[i]` and `arr.splice(i, 1)`?**
`delete` removes the property and leaves a **hole**, with `length` unchanged, so
hole-skipping methods then behave inconsistently. `splice` removes the element, closes
the gap and decrements `length`. Only `splice` (or `filter`) actually removes.

**How do you remove an element by value?**
`const i = arr.indexOf(v); if (i !== -1) arr.splice(i, 1);` — the guard matters,
because `splice(-1, 1)` would remove the last element. Or `arr.filter(x => x !== v)`,
which removes **all** matches without mutating.

**What does a negative `start` do?**
Counts back from the end — `splice(-2, 1)` removes the second-to-last element. Values
below `-array.length` clamp to `0`, and a `start` at or past `length` makes `splice`
act purely as an adding function.

---

← [`push`, `pop`, `shift`, `unshift`](./01-push-pop-shift-unshift.md) · [Topic index](./README.md) · Next → [Phase index](../README.md)
