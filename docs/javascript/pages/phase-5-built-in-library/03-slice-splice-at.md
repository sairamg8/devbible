---
title: "03 · `slice` vs `splice` vs `at`"
sidebar_label: "03 · slice vs splice vs at"
sidebar_position: 3
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-15 against MDN — [`Array.prototype.slice()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/slice), [`Array.prototype.splice()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/splice), [`Array.prototype.at()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/at), [`Array.prototype.toSpliced()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/toSpliced), [`String.prototype.slice()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/slice), [`String.prototype.substring()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/substring), [`Array.prototype.filter()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/filter). Documentation-validated; **no timings**.

**Two methods one letter apart do opposite things.** `slice` copies and leaves the array alone;
`splice` cuts the array open and changes it. Everything else on this page is detail.

```js
const a = [1, 2, 3, 4, 5];

a.slice(1, 3);    // [2, 3]      — a is still [1,2,3,4,5]
a.splice(1, 3);   // [2, 3, 4]   — 🔴 a is now [1, 5]
```

⚠️ **Both return an array of the elements they selected**, which is why the mutation goes unnoticed
in review: the two calls *look* interchangeable at the call site and only one of them is safe.

**The mnemonic that sticks: `sPlice` performs surgery.** The `p` is for the operation that changes
the patient.

## `slice(start, end)` — a shallow copy of a range

```js
const a = ["a", "b", "c", "d"];

a.slice(1, 3);    // ["b", "c"]   — end is EXCLUSIVE
a.slice(2);       // ["c", "d"]   — to the end
a.slice(-2);      // ["c", "d"]   — negative counts back from the end
a.slice(1, -1);   // ["b", "c"]   — mix freely
a.slice();        // a full shallow copy
```

- **`end` is exclusive**, so `slice(1, 3)` gives two elements. `end - start` is the length.
- **Negative indices count from the end** — `-1` is the last element.
- **Out-of-range is not an error**: `a.slice(10)` is `[]`, and `a.slice(0, 99)` is the whole array.
- 🔴 **The copy is shallow.** Objects inside are shared, so mutating `copy[0].name` changes the
  original's element too — [Phase 4 · 04 · Shallow vs deep copy](../phase-4-objects-and-classes/04-shallow-vs-deep-copy/README.md).

`slice()` with no arguments and `[...a]` do the same job; the spread reads better in new code, and
`slice.call(arrayLike)` remains the old idiom for converting array-likes (topic **22 ·
Array-likes and iterables** *(not written yet)* covers the modern `Array.from`).

## `splice(start, deleteCount, ...items)` — remove, insert, or both

```js
const a = ["a", "b", "c", "d"];

a.splice(1, 2);             // returns ["b","c"];  a is ["a","d"]
a.splice(1, 0, "x", "y");   // returns [];         a is ["a","x","y","d"]   — pure insert
a.splice(1, 1, "z");        // returns ["x"];      a is ["a","z","y","d"]   — replace
```

🔴 **The second argument is a COUNT, not an end index.** That is the difference from `slice` that
actually causes bugs — `slice(1, 3)` and `splice(1, 3)` select different ranges.

⚠️ **Omitting `deleteCount` is not the same as passing `0`:**

```js
a.splice(2);      // removes EVERYTHING from index 2 onward
a.splice(2, 0);   // removes nothing
```

Two more worth knowing: **negative `start` counts from the end** (`a.splice(-1, 1)` removes the last
element), and **the return value is the removed elements**, which is easy to discard by accident
when you wanted them.

**`splice` at the front is O(n)** — every later element shifts down — the same cost that makes
`shift` in a loop quadratic in [02 · Adding and removing](./02-adding-and-removing/README.md).

## `at(index)` — the reason `arr[-1]` never worked

```js
const a = [10, 20, 30];

a[-1];        // 🔴 undefined — a property named "-1", not an index
a.at(-1);     // 30
a.at(0);      // 10
a.at(99);     // undefined
```

`arr[-1]` is not an out-of-range index — it is a *property lookup* for the key `"-1"`, which does
not exist ([Phase 4 · 02 · Property access](../phase-4-objects-and-classes/02-property-access.md)).
`at` does the arithmetic for you, and it works on **strings and typed arrays** too.

Before `at`, the idiom was `a[a.length - 1]` or `a.slice(-1)[0]` — both still correct, both noisier,
and the second allocates an array to throw away.

## The loop bug this topic exists to prevent

🔴 **Splicing inside a forward loop skips elements**, because every removal shifts the rest down
while the index keeps going up:

```js
const items = ["a", "bad", "bad", "b"];
for (let i = 0; i < items.length; i++) {
  if (items[i] === "bad") items.splice(i, 1);   // 🔴
}
items;   // ["a", "bad", "b"] — the second "bad" survived
```

Three fixes, in order of preference:

```js
const kept = items.filter((x) => x !== "bad");        // ✅ non-mutating, clearest
for (let i = items.length - 1; i >= 0; i--) { … }      // ✅ backwards, if you must mutate in place
for (let i = 0; i < items.length; i++) { …; i--; }     // ⚠️ works, and reads like a puzzle
```

**`filter` is the answer in almost every case.** Reach for backwards iteration only when the array
identity must be preserved because something else holds a reference to it.

⚠️ **The same trap applies to `forEach`** — mutating the array being iterated gives visited-element
behaviour that is specified but not intuitive. Do not.

## The non-mutating replacements

ES2023 added copying counterparts, so "I want splice but without the mutation" now has a direct
answer:

```js
const a = [1, 2, 3, 4];
a.toSpliced(1, 2);        // [1, 4] — a is unchanged
a.with(0, 99);            // [99, 2, 3, 4]
```

Covered in **13 · Non-mutating array counterparts** *(not written yet)*, along with `toSorted` and
`toReversed`. ⚠️ **They are recent** — check your target environments before relying on them, and
note `slice`/`filter`/spread have always been non-mutating and need no support caveat.

## Strings: `slice` is the one to use

`String.prototype.slice` behaves exactly like the array version — same exclusive end, same negative
indices. `substring` is the older sibling and behaves differently in two ways that make it worth
avoiding:

```js
"hello".slice(-3);        // "llo"
"hello".substring(-3);    // "hello"  — negatives clamp to 0
"hello".substring(3, 1);  // "el"     — 🔴 it SWAPS the arguments
"hello".slice(3, 1);      // ""       — no swap, empty range
```

**Strings have no `splice`**, because they are immutable. Building a modified string means
`slice` plus concatenation, or `replace`
([07 · String methods](./07-string-methods/README.md)).

## Choosing, in one line each

| You want | Use |
|---|---|
| a copy of part of an array | `slice(start, end)` |
| a full shallow copy | `[...a]` (or `slice()`) |
| one element, counting from the end | `at(-n)` |
| to remove or insert **in place** | `splice(start, count, …items)` |
| to remove or insert **without mutating** | `toSpliced`, or `filter` / spread |
| to remove matching elements | `filter` — never `splice` in a loop |

## Gotchas

**Symptom:** The original array changed unexpectedly
**Cause:** `splice` where `slice` was meant — one letter apart, both return the selected elements.
**Fix:** `slice` copies. Remember `sPlice` performs surgery.

**Symptom:** `splice(1, 3)` removed a different range than `slice(1, 3)` selected
**Cause:** `splice`'s second argument is a **count**; `slice`'s is an **exclusive end index**.
**Fix:** Read the second argument every time. They are not the same parameter.

**Symptom:** `splice(2)` emptied the tail of the array
**Cause:** An omitted `deleteCount` means "to the end", unlike `0`.
**Fix:** Pass the count explicitly, always.

**Symptom:** A loop with `splice` left some matches behind
**Cause:** Each removal shifts the remaining elements down while the index still increments.
**Fix:** `filter`, or iterate backwards if the array identity must be preserved.

**Symptom:** `arr[-1]` is `undefined`
**Cause:** It is a property key, not an index. Negative indexing never existed for brackets.
**Fix:** `arr.at(-1)`.

**Symptom:** A `slice()` copy still shares nested objects
**Cause:** It is a shallow copy.
**Fix:** `structuredClone` for a deep one — topic **21 · `structuredClone`** *(not written yet)*.

**Symptom:** `substring` returned the whole string for a negative argument, or swapped a range
**Cause:** `substring` clamps negatives to `0` and swaps arguments when `start > end`.
**Fix:** Use `slice` on strings. There is no case where `substring` is better.

**Symptom:** The removed elements were needed and are gone
**Cause:** `splice`'s return value — the removed elements — was discarded.
**Fix:** `const removed = a.splice(...)`.

## Interview questions

**★ What is the difference between `slice` and `splice`?**
`slice` returns a shallow copy of a range and leaves the array untouched; `splice` mutates the array
in place, removing and/or inserting, and returns the removed elements. Both return an array of the
selected elements, which is why the mutation is easy to miss in review.

**★ What does the second argument mean in each?**
In `slice` it is an **exclusive end index**; in `splice` it is a **count of elements to delete**. So
`slice(1, 3)` takes two elements ending before index 3, while `splice(1, 3)` removes three starting
at index 1.

**★ Why does `arr[-1]` not give the last element?**
Because `-1` is a property key, not an index — array indices are string keys `"0"`, `"1"`, and
`"-1"` is simply a property that does not exist. `arr.at(-1)` does the arithmetic and works on
strings and typed arrays too.

**★ What goes wrong when you `splice` inside a `for` loop?**
Every removal shifts the remaining elements down while the loop index keeps increasing, so the
element after each removal is skipped. Use `filter`, or iterate backwards when the array identity
must be preserved.

**★ What is the difference between omitting `deleteCount` and passing `0`?**
Omitting it removes everything from `start` to the end; passing `0` removes nothing and makes the
call a pure insert. Passing it explicitly avoids the whole question.

**Why prefer `slice` over `substring` on strings?**
`substring` clamps negative arguments to `0` and silently swaps them when `start > end`, so
`"hello".substring(3, 1)` returns `"el"`. `slice` supports negative indices and never reorders your
arguments.

**What is the non-mutating version of `splice`?**
`toSpliced`, added in ES2023, alongside `toSorted`, `toReversed` and `with`. Check environment
support before relying on them; `filter` and spread have always been non-mutating.

---

← [02 · Adding and removing](./02-adding-and-removing/README.md) · [Phase index](./README.md) · Next: [04 · Array iteration methods](./04-array-iteration-methods/README.md) →
