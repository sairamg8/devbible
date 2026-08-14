---
title: "03.1 · The template that avoids off-by-one"
sidebar_label: "01 · The template"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-14 — algorithmic material at the standard treatment; JavaScript specifics against MDN ([`Math.floor()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/floor), [`Number.MAX_SAFE_INTEGER`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number/MAX_SAFE_INTEGER), [`Array.prototype.sort()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/sort)). Documentation-validated; **no timings**.

**Everyone can describe binary search and most people cannot write it correctly under pressure.**
The fix is to use one template with one invariant, rather than re-deriving the bounds each time.

## Why it is hard to write

Three independent decisions, and each has two plausible options:

- `hi = arr.length` or `arr.length - 1`?
- `while (lo < hi)` or `lo <= hi`?
- `hi = mid` or `mid - 1`?

**Eight combinations, of which two are correct** — and the wrong ones fail only on specific inputs
(empty arrays, one element, the target at a boundary), which is exactly what a quick test misses.

🔴 **Pick one template and use it always.** The one below is the half-open interval form, which
generalises to `lowerBound`/`upperBound` without change.

## The template: half-open `[lo, hi)`

```js
function lowerBound(arr, target) {
  let lo = 0, hi = arr.length;              // hi is EXCLUSIVE

  while (lo < hi) {                          // strict — the interval shrinks to empty
    const mid = lo + ((hi - lo) >> 1);
    if (arr[mid] < target) lo = mid + 1;     // mid is too small — exclude it
    else hi = mid;                           // mid might be the answer — keep it
  }
  return lo;                                 // first index with arr[i] >= target
}
```

**The invariant:** the answer is always in `[lo, hi)`. Everything before `lo` is too small;
everything from `hi` on is too big. When the interval is empty, `lo` is the answer.

Three details:

- **`hi = arr.length`**, not `length - 1` — the answer can legitimately be "past the end", which
  is what "no element is ≥ target" means.
- **`hi = mid`, not `mid - 1`** — `mid` might be the answer, so it stays in the interval.
- **`lo + ((hi - lo) >> 1)`** rather than `(lo + hi) >> 1`. In JavaScript the overflow this avoids
  is not the C integer overflow — it is that `>>` coerces to **32-bit signed**, so `(lo + hi)`
  above 2³¹ − 1 goes negative. Irrelevant for arrays (which cannot be that long) and **very
  relevant when binary-searching over an answer range**, which is the next chunk. Use the safe form
  by habit. `Math.floor((lo + hi) / 2)` is equally safe and slower to read.

## The three functions you actually need

```js
// first index where arr[i] >= target
const lowerBound = (arr, target) => { … as above … };

// first index where arr[i] > target
function upperBound(arr, target) {
  let lo = 0, hi = arr.length;
  while (lo < hi) {
    const mid = lo + ((hi - lo) >> 1);
    if (arr[mid] <= target) lo = mid + 1;    // 🔴 only <= changes
    else hi = mid;
  }
  return lo;
}

// exact match, or -1
function binarySearch(arr, target) {
  const i = lowerBound(arr, target);
  return i < arr.length && arr[i] === target ? i : -1;
}
```

🔴 **`upperBound` differs from `lowerBound` by one character** — `<` becomes `<=`. Deriving
everything from these two removes the whole class of off-by-one bugs:

| Question | Answer |
|---|---|
| Does it exist? | `binarySearch(arr, x) !== -1` |
| How many equal x? | `upperBound(arr, x) - lowerBound(arr, x)` |
| Insert position keeping order | `lowerBound(arr, x)` |
| First element > x | `arr[upperBound(arr, x)]` |
| Last element < x | `arr[lowerBound(arr, x) - 1]` |
| How many < x | `lowerBound(arr, x)` |

**Counting occurrences as `upperBound - lowerBound` is worth internalising** — it is O(log n) where
the obvious scan is O(k), and it is the answer to a surprising number of "count how many…"
questions on sorted data.

## The preconditions, which are the real content

**The array must be sorted** by the same order the comparison uses. A "sorted" array of strings
sorted by the default comparator is in **lexicographic** order, so numeric binary search over it is
wrong ([Phase 5 · 06 · `sort`](../../phase-5-built-in-library/06-sort/README.md)).

🔴 **Binary search is not automatically a win.** Sorting to enable it costs O(n log n) — more than
the O(n) scan it replaces. It pays only when you search **repeatedly** against the same sorted
data, which is the same reasoning that justifies a database index
([Phase 13 · 02 · 01](../../phase-13-complexity/02-complexity-classes/01-constant-to-linearithmic.md)).

⚠️ **Duplicates require `lowerBound`/`upperBound`, not a plain search.** A plain binary search
returns *some* matching index, not the first or the last, and which one depends on the array's
length. Code that assumes "the first" is wrong intermittently.

## Rotated and unsorted-ish arrays

A rotated sorted array (`[4,5,6,7,0,1,2]`) is still searchable in O(log n), because **at least one
half of any split is properly sorted**:

```js
function searchRotated(nums, target) {
  let lo = 0, hi = nums.length - 1;
  while (lo <= hi) {
    const mid = lo + ((hi - lo) >> 1);
    if (nums[mid] === target) return mid;

    if (nums[lo] <= nums[mid]) {                       // left half is sorted
      if (nums[lo] <= target && target < nums[mid]) hi = mid - 1;
      else lo = mid + 1;
    } else {                                            // right half is sorted
      if (nums[mid] < target && target <= nums[hi]) lo = mid + 1;
      else hi = mid - 1;
    }
  }
  return -1;
}
```

**The decision is "which half is sorted, and is the target inside it?"** — not "is the target
bigger than mid". ⚠️ This variant uses the closed-interval form (`lo <= hi`, `hi = mid - 1`)
because it returns an exact match rather than a boundary; mixing the two forms in one codebase is
how off-by-ones return.

⚠️ **With duplicates, rotated search degrades to O(n)** — `nums[lo] === nums[mid]` no longer tells
you which half is sorted, and the only safe move is to shrink by one. Worth stating; it is the
follow-up question.

## Gotchas

**Symptom:** Binary search misses the target at index 0 or the last index
**Cause:** A mismatched bound/condition combination.
**Fix:** One template, one invariant — half-open `[lo, hi)` with `lo < hi` and `hi = mid`.

**Symptom:** An infinite loop
**Cause:** `hi = mid` with `lo <= hi`, or `lo = mid` — the interval stops shrinking.
**Fix:** Every branch must strictly reduce the interval: `lo = mid + 1` or `hi = mid`.

**Symptom:** Wrong index with duplicates
**Cause:** A plain binary search returns an arbitrary match.
**Fix:** `lowerBound` for the first, `upperBound - 1` for the last.

**Symptom:** Correct on arrays, broken on a large numeric range
**Cause:** `(lo + hi) >> 1` coerces to 32-bit signed and goes negative above 2³¹ − 1.
**Fix:** `lo + ((hi - lo) >> 1)`.

**Symptom:** Search over a "sorted" string array fails
**Cause:** It was sorted lexicographically and searched numerically, or vice versa.
**Fix:** Search with the same comparator the sort used.

**Symptom:** Adding binary search made things slower
**Cause:** The enabling sort costs more than the scan it replaced.
**Fix:** Only worth it for repeated searches on stable data.

**Symptom:** Rotated search loops or misses with duplicates
**Cause:** `nums[lo] === nums[mid]` leaves the sorted half ambiguous.
**Fix:** Shrink by one and accept O(n) worst case.

## Interview questions

**★ Write binary search and state the invariant.**
Half-open `[lo, hi)` with `hi = arr.length`; `while (lo < hi)`; `arr[mid] < target ? lo = mid + 1
: hi = mid`. The invariant is that the answer always lies in `[lo, hi)` — everything before `lo` is
too small, everything from `hi` on is too big. When the interval empties, `lo` is the answer.

**★ Why is it so easy to get wrong?**
Three independent binary choices — inclusive or exclusive `hi`, `<` or `<=`, `mid` or `mid - 1` —
give eight combinations of which two work, and the broken ones fail only on empty, single-element
or boundary inputs. Using one template removes the class of bug.

**★ How do you count occurrences of a value in a sorted array in O(log n)?**
`upperBound(x) - lowerBound(x)`. The two functions differ by a single character (`<` vs `<=`), and
deriving everything from them removes the off-by-one guessing.

**★ Why `lo + ((hi - lo) >> 1)` in JavaScript?**
Not C integer overflow — `>>` coerces its operand to a **32-bit signed** integer, so `(lo + hi)`
above 2³¹ − 1 becomes negative. Arrays cannot be that long, but binary search **over an answer
range** easily can be.

**★ When is binary search not worth it?**
When you search once. The sort that enables it is O(n log n), more than the O(n) scan it replaces.
It pays for repeated searches against stable data — the same argument as a database index.

**★ Search a rotated sorted array. What is the decision at each step?**
Which half is properly sorted (compare `nums[lo]` with `nums[mid]`), and whether the target lies
inside that half's range. Not "is the target bigger than mid".

**What breaks rotated search with duplicates?**
`nums[lo] === nums[mid]` makes the sorted half ambiguous, so the only safe move is to shrink by
one — O(n) worst case.

---

[Topic index](./README.md) · Next → [02 · Searching over an answer](./02-searching-over-an-answer.md)
