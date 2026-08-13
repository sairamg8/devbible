---
title: "06.2 · Stability, mutation and `toSorted`"
sidebar_label: "02 · Stability and mutation"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-13 against MDN — [`Array.prototype.sort`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/sort), [`toSorted`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/toSorted). Documentation-validated.

Two properties of `sort` that change how you write code around it: it is **stable**,
and it **mutates**.

## `sort` mutates and returns the same array

MDN: it *"sorts the elements in place"* and *"returns the reference to the same
array"*.

```js
const numbers = [3, 1, 4, 1, 5];
const sorted = numbers.sort((a, b) => a - b);
// numbers and sorted are both [1, 1, 3, 4, 5]
sorted[0] = 10;
console.log(numbers[0]); // 10
```

**`sorted` and `numbers` are the same array.** The return value is a convenience for
chaining, not a copy — which makes `const sorted = arr.sort(…)` actively misleading,
because the name suggests the original was left alone.

This is the most common `sort` bug in application code:

```js
// ❌ mutates props / state / a shared array
function renderTop(users) {
  return users.sort((a, b) => b.score - a.score).slice(0, 10);
}
```

The caller's array is now reordered. In an immutable-state codebase it is worse than
that: the array's **identity** is unchanged, so change detection sees nothing and the
UI may not update at all — the argument from
[Phase 4 · 04 · What shallow means](../../phase-4-objects-and-classes/04-shallow-vs-deep-copy/01-what-shallow-means.md).

**Two fixes:**

```js
[...users].sort((a, b) => b.score - a.score);   // copy first — works everywhere
users.toSorted((a, b) => b.score - a.score);    // ES2023 — says what it means
```

MDN: use `toSorted()` *"to sort without mutating the original array"* — it *"returns a
shallow-copied sorted array"*. Prefer it where available; `[...arr].sort()` is the
portable form.

Note **shallow**: both give a new array of the *same* objects. Sorting does not clone
the elements, so mutating `sorted[0].name` still changes the original object.

## Sort is stable — guaranteed since ES2019

MDN: *"Since version 10 (ECMAScript 2019), the specification guarantees that
`Array.prototype.sort()` is stable"* — elements comparing equal keep their original
relative order. *"Before ES2019, sort stability was not guaranteed."*

This is a real, usable guarantee, and it enables a pattern:

```js
// sort by secondary key first, then by primary — stability preserves the secondary
users.sort((a, b) => a.firstName.localeCompare(b.firstName));  // secondary
users.sort((a, b) => a.lastName.localeCompare(b.lastName));    // primary
```

Two passes, and within each surname the first names stay in order because equal
comparisons do not reorder. **This is how a click-to-sort table column works** — the
user sorts by date, then by status, and the dates remain ordered within each status
group without you tracking a sort history.

For a sort you control in one place, the `||` chain from
[chunk 1](./01-the-default-and-the-comparator.md) is clearer and does one pass. Use the
stability trick when the sort keys arrive over time.

**The historical caveat matters if you read old code or old advice:** before ES2019
engines used different algorithms for short and long arrays, so a sort could be stable
for 10 items and unstable for 1,000. Code written then often carries a manual index
tiebreak (`|| a._i - b._i`) that is no longer necessary.

## `undefined` and holes go to the end

MDN:

- *"All `undefined` elements are sorted to the end of the array"*
- *"Empty slots in sparse arrays are moved to the end, always coming after `undefined`
  elements"*

```js
console.log(["a", "c", , "b"].sort());
// ['a', 'b', 'c', empty]
```

**The comparator is never called for them.** So a comparator that would crash on
`undefined` — `a.name.localeCompare(b.name)` — is safe against *actual* `undefined`
elements, but not against elements whose *property* is `undefined`:

```js
users.sort((a, b) => a.name.localeCompare(b.name));
// throws if any user has no `name`
```

Guard the property, not the element:

```js
users.sort((a, b) => (a.name ?? "").localeCompare(b.name ?? ""));
```

Note the ordering rule puts `undefined` and holes at the end **regardless of the
comparator**, so you cannot sort missing values to the front. If they must lead, map
them to a sentinel first.

## The non-mutating family

`toSorted` is one of four ES2023 methods that mirror a mutating counterpart:

| Mutating | Non-mutating |
|---|---|
| `arr.sort(fn)` | `arr.toSorted(fn)` |
| `arr.reverse()` | `arr.toReversed()` |
| `arr.splice(…)` | `arr.toSpliced(…)` |
| `arr[i] = v` | `arr.with(i, v)` |

All four return a new array and leave the original alone, and all produce **dense**
arrays. They are the right default in any codebase that treats data as immutable, and
they remove the whole class of "who else holds this array?" bugs.

`reverse` deserves the same warning as `sort`: it mutates and returns the same
reference, so `const backwards = arr.reverse()` reorders `arr` too.

## Gotchas

**Symptom:** An array passed into a function came back reordered
**Cause:** `sort` *"sorts the elements in place"* and returns **the same reference** —
`const sorted = arr.sort(…)` does not copy.
**Fix:** `[...arr].sort(…)` or `arr.toSorted(…)`.

**Symptom:** A component does not re-render after sorting
**Cause:** In-place sorting leaves the array identity unchanged, so change detection
sees nothing.
**Fix:** `toSorted` or a spread copy — a new array reference.

**Symptom:** Sorting the copy still changed the original objects
**Cause:** `toSorted` and `[...arr]` are **shallow** — the same element objects are
referenced.
**Fix:** Expected. Clone the elements if you need to mutate them independently.

**Symptom:** `TypeError: Cannot read properties of undefined` inside a comparator
**Cause:** An element's *property* is missing. `undefined` **elements** never reach the
comparator, but an object with an undefined field does.
**Fix:** `(a.name ?? "").localeCompare(b.name ?? "")`.

**Symptom:** Missing values sort to the end and you wanted them first
**Cause:** `undefined` and holes are placed at the end **regardless of the
comparator**, holes after `undefined`.
**Fix:** Map them to a sentinel value before sorting.

**Symptom:** A two-pass sort loses the secondary ordering in an old runtime
**Cause:** Stability was only guaranteed from **ES2019**; earlier engines varied by
array length.
**Fix:** Use a `||` comparator chain, which does not depend on stability.

**Symptom:** `arr.reverse()` reversed an array elsewhere in the program
**Cause:** Like `sort`, it mutates in place and returns the same reference.
**Fix:** `arr.toReversed()`, or `[...arr].reverse()`.

## Interview questions

**★ Does `sort` mutate the array?**
Yes — MDN: it *"sorts the elements in place"* and *"returns the reference to the same
array"*. So `const sorted = arr.sort(…)` gives you the same array under a second name;
mutating `sorted[0]` changes `arr[0]`. Use `toSorted` or `[...arr].sort()` to leave the
original alone.

**★ Is JavaScript's sort stable?**
Yes, **guaranteed since ES2019**. Elements comparing equal keep their relative order.
Before that it was engine- and length-dependent, which is why older code carries manual
index tiebreaks.

**★ What can you do with sort stability?**
Sort by the **secondary** key first and the **primary** key second — the secondary
ordering survives inside each primary group. That is how a multi-column table sort works
when the user picks columns over time. For a one-shot sort, a `||` comparator chain is
clearer.

**★ Where do `undefined` values and holes end up?**
Both at the **end** — MDN: `undefined` elements sort to the end, and empty slots go
after them — and the comparator is **never called** for either. You cannot sort them to
the front; map them to a sentinel if you need that.

**What is `toSorted`?**
The ES2023 non-mutating counterpart, returning a **shallow-copied** sorted array. It
belongs to a family with `toReversed`, `toSpliced` and `with`, all of which leave the
original alone and produce dense arrays.

**Why might sorting a copy still affect the original data?**
Because the copy is **shallow** — it is a new array holding the same element objects.
Reordering is isolated; mutating an element is not.

---

← [The default, and the comparator](./01-the-default-and-the-comparator.md) · [Topic index](./README.md) · Next → [Phase index](../README.md)
