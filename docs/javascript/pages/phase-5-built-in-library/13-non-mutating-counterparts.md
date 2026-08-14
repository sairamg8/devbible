---
title: "13 · Non-mutating array counterparts"
sidebar_label: "13 · Non-mutating counterparts"
sidebar_position: 13
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-15 against MDN — [`Array.prototype.toSorted()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/toSorted), [`Array.prototype.toReversed()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/toReversed), [`Array.prototype.toSpliced()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/toSpliced), [`Array.prototype.with()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/with), [`Array.prototype.sort()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/sort), [`Array.prototype.reverse()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/reverse), [`TypedArray.prototype.toSorted()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/TypedArray/toSorted), [`Object.freeze()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/freeze). Documentation-validated; **no timings**.

**Four array methods mutate in place, and for decades the workaround was to copy first.** ES2023
added a copying counterpart for each, so the intent is in the method name instead of in a
surrounding idiom.

| Mutates | Copies | What it does |
|---|---|---|
| `sort(cmp)` | **`toSorted(cmp)`** | same comparator, new array |
| `reverse()` | **`toReversed()`** | new array, reversed |
| `splice(i, n, …x)` | **`toSpliced(i, n, …x)`** | new array with the edit applied |
| `arr[i] = v` | **`with(i, v)`** | new array with one element replaced |

```js
const scores = [3, 1, 2];

scores.sort();       // 🔴 scores is now [1, 2, 3] — the original is gone
scores.toSorted();   // ✅ returns [1, 2, 3]; scores unchanged
```

## Why they exist: the bug they remove

🔴 **`sort` and `reverse` mutate, and they are the two most commonly written as if they did not.**

```js
const top = users.sort((a, b) => b.score - a.score).slice(0, 3);
```

That line reads like a query and is a mutation: `users` is now permanently reordered, for every
other piece of code holding a reference to it. If `users` came from props, a store, a cache or a
module-level constant, the damage is at a distance and the symptom appears somewhere unrelated.

**In a component framework it is worse than untidy — it is invisible.** Change detection compares
references:

```js
setItems(items.sort(byName));       // 🔴 same array reference — no re-render
setItems(items.toSorted(byName));   // ✅ new reference
```

The state *is* sorted and the UI does not update, which is a genuinely confusing bug because
logging the value shows the correct order.

**These methods make the safe thing the short thing**, which is the whole argument for them.

## `with` is not just `arr[i] = v` on a copy

```js
const a = ["a", "b", "c"];

a.with(1, "B");     // ["a", "B", "c"]
a.with(-1, "C");    // ["a", "b", "C"]   — negative indices, like `at`
a.with(9, "x");     // 🔴 RangeError: Invalid index
```

⚠️ **That `RangeError` is a feature.** `a[9] = "x"` would happily extend the array with holes, so a
typo'd index becomes sparse data rather than an error — one of the oldest quiet failures in the
language ([01 · Array creation and shape](./01-array-creation-and-shape/README.md)). `with` refuses.

## They are shallow copies

```js
const users = [{ name: "Ada" }, { name: "Bob" }];
const sorted = users.toSorted(byName);

sorted[0] === users[0];       // 🔴 true — the same object
sorted[0].name = "changed";   // mutates the original's element too
```

**A new array, the same elements.** These methods solve "do not reorder my array"; they do not solve
"do not mutate my objects". For that, copy the elements too, or freeze them
([Phase 4 · 12 · `Object.freeze` and `seal`](../phase-4-objects-and-classes/12-freeze-and-seal/README.md)),
or — best — do not mutate the objects.

## The comparator rules do not change

```js
[10, 9, 100].toSorted();                 // 🔴 [10, 100, 9] — still the string comparator
[10, 9, 100].toSorted((a, b) => a - b);  // ✅ [9, 10, 100]
```

**`toSorted` is `sort` without the mutation, and nothing else.** The default string comparison, the
comparator contract, and the stability guarantee are all identical — [06 · `sort`](./06-sort/README.md).

## The idioms they replace, which still work

```js
[...arr].sort(cmp)        ≈ arr.toSorted(cmp)
arr.slice().reverse()     ≈ arr.toReversed()
[...arr.slice(0, i), v, ...arr.slice(i + 1)]   ≈ arr.with(i, v)
arr.filter((_, j) => j !== i)                   ≈ arr.toSpliced(i, 1)
```

⚠️ **The copy-first idioms are not deprecated and are more portable.** `toSorted` and friends are
ES2023 — widely available in current engines, but **check your target browsers, your Node version
and your test environment before relying on them**, and remember a transpiler will not polyfill a
method automatically without the right core-js configuration.

**Where the new methods genuinely win** is readability at a glance: `[...arr].sort()` is easy to
misread as `arr.sort()`, and the copy is easy to lose in a refactor. `toSorted` cannot be misread.

## Typed arrays get three of the four

`TypedArray` has `toSorted`, `toReversed` and `with` — but **not `toSpliced`**, because a typed
array's length is fixed and splicing changes it. That asymmetry is a reasonable thing to be caught
by once.

## What still has no copying counterpart

`push`, `pop`, `shift`, `unshift` and `fill` have no `to…` version, because spread already expresses
each one clearly:

```js
[...arr, item]        // push
arr.slice(0, -1)      // pop
[item, ...arr]        // unshift
arr.slice(1)          // shift
```

## Gotchas

**Symptom:** An array changed order somewhere unrelated
**Cause:** `sort` or `reverse` mutated a shared array — a store value, props, a module constant.
**Fix:** `toSorted` / `toReversed`, or copy before sorting.

**Symptom:** State is sorted but the UI does not update
**Cause:** `sort` returned the *same reference*, so change detection saw no change.
**Fix:** `toSorted`. This is the bug the methods exist for.

**Symptom:** `RangeError: Invalid index` from `with`
**Cause:** The index is out of bounds — deliberately an error rather than a silent hole.
**Fix:** Check the index. `a[i] = v` would have created sparse data instead.

**Symptom:** `toSorted()` sorted numbers wrongly
**Cause:** It uses the same default string comparator as `sort`.
**Fix:** Pass `(a, b) => a - b`.

**Symptom:** Mutating an element of a `toSorted` result changed the original
**Cause:** It is a shallow copy — the same element objects.
**Fix:** Copy or freeze the elements, or do not mutate them.

**Symptom:** `arr.toSpliced is not a function`
**Cause:** An older engine, or a typed array — which has `toSorted`, `toReversed` and `with` but not `toSpliced`.
**Fix:** `[...arr]` plus the mutating method, or check the target environment.

## Interview questions

**★ Which array methods mutate, and what are their copying counterparts?**
`sort` → `toSorted`, `reverse` → `toReversed`, `splice` → `toSpliced`, and `arr[i] = v` → `with`.
`push`/`pop`/`shift`/`unshift` mutate too but have no `to…` version, because spread and `slice`
already express them.

**★ Why were these added?**
Because `sort` and `reverse` are routinely written as if they returned a new array, so a shared
array gets reordered at a distance. In a framework it is worse: the mutated array is the *same
reference*, so change detection sees nothing and the UI silently does not update.

**★ What does `with` do that `arr[i] = v` on a copy does not?**
It throws `RangeError` for an out-of-range index instead of extending the array with holes, and it
accepts a negative index. The refusal is the point — a typo'd index becomes an error rather than
sparse data.

**★ Are these deep copies?**
No. A new array containing the same element references. They solve "do not reorder my array", not
"do not mutate my objects".

**★ Does `toSorted` fix the number-sorting problem?**
No. It is `sort` without the mutation — the default comparator still converts to strings, so
`[10, 9, 100].toSorted()` gives `[10, 100, 9]`. Pass a comparator.

**Should you use these or `[...arr].sort()`?**
Either is correct. The new methods read better and cannot be misread as the mutating version, but
they are ES2023 — check the target environments. The spread-copy idiom works everywhere and is not
deprecated.

---

← [12 · String searching](./12-string-searching/README.md) · [Phase index](./README.md) · Next: **14 · `flat`, `flatMap`, `fill`, `copyWithin`** *(not written yet)* →
