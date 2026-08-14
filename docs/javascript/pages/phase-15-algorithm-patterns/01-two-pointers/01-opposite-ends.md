---
title: "01.1 · Opposite ends"
sidebar_label: "01 · Opposite ends"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-14 — algorithmic material at the standard treatment; JavaScript specifics against MDN ([`Array.prototype.sort()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/sort), [`String.prototype.normalize()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/normalize), [`Intl.Collator`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/Collator)). Documentation-validated; **no timings**.

**Two pointers converging from the ends turns an O(n²) pairwise search into O(n)** — but only when
the input has an order the pointers can exploit. That precondition is the whole pattern, and
stating it is what separates knowing the trick from knowing when it applies.

## The template

```js
let lo = 0, hi = arr.length - 1;

while (lo < hi) {
  const result = evaluate(arr[lo], arr[hi]);
  if (result === target) return [lo, hi];
  if (result < target) lo++;          // need bigger → move the small end up
  else hi--;                          // need smaller → move the large end down
}
```

🔴 **The correctness argument, which is what an interviewer wants:** when the sum is too small,
`arr[lo]` cannot pair with anything — every remaining partner is `arr[hi]` or smaller, so no pair
involving `lo` can reach the target. Discarding it is safe. The mirror argument covers `hi--`.
**Each pointer only moves inward, so the total movement is n and the loop is O(n).**

That argument depends entirely on the array being **sorted**. On unsorted input the pattern is
simply wrong — and "sort first" costs O(n log n), which may still beat O(n²) but must be stated.

## Two-sum on a sorted array

```js
function twoSum(sorted, target) {
  let lo = 0, hi = sorted.length - 1;
  while (lo < hi) {
    const sum = sorted[lo] + sorted[hi];
    if (sum === target) return [lo, hi];
    if (sum < target) lo++;
    else hi--;
  }
  return null;
}
```

⚠️ **`lo < hi`, not `lo <= hi`** — equality would pair an element with itself, which is almost
never what the problem means. If it does, say so explicitly.

**On an *unsorted* array, use a hash map instead** — O(n) with no sort, and it returns the
original indices rather than positions in a sorted copy
([04 · Hash-map patterns](../04-hash-map-patterns/README.md)). 🔴 **Choosing two pointers for
unsorted two-sum is the classic wrong answer**, because sorting destroys the indices the problem
asks for.

## Three-sum — the pattern nested once

```js
function threeSum(nums) {
  const sorted = [...nums].sort((a, b) => a - b);      // ⚠️ numeric comparator required
  const result = [];

  for (let i = 0; i < sorted.length - 2; i++) {
    if (i > 0 && sorted[i] === sorted[i - 1]) continue;          // skip duplicate anchors
    let lo = i + 1, hi = sorted.length - 1;

    while (lo < hi) {
      const sum = sorted[i] + sorted[lo] + sorted[hi];
      if (sum === 0) {
        result.push([sorted[i], sorted[lo], sorted[hi]]);
        while (lo < hi && sorted[lo] === sorted[lo + 1]) lo++;   // skip duplicates
        while (lo < hi && sorted[hi] === sorted[hi - 1]) hi--;
        lo++; hi--;
      } else if (sum < 0) lo++;
      else hi--;
    }
  }
  return result;
}
```

O(n²) — one linear scan inside one loop, which beats the O(n³) brute force.

🔴 **`[...nums].sort((a, b) => a - b)` — both halves matter.** `sort` mutates, so copy first; and
the default comparator sorts **lexicographically as strings**, so `[10, 9, 1]` becomes
`[1, 10, 9]`. Omitting the numeric comparator is the most common bug in any sorting-based
JavaScript solution, and it produces plausible-looking wrong answers rather than an error.

**The duplicate-skipping is the other half of the problem.** Three separate skips — the anchor,
the low pointer and the high pointer — and missing any of them yields duplicate triples.

## Palindromes and the string cases

```js
function isPalindrome(str) {
  const chars = [...str.toLowerCase()].filter((c) => /[a-z0-9]/.test(c));
  let lo = 0, hi = chars.length - 1;
  while (lo < hi) {
    if (chars[lo] !== chars[hi]) return false;
    lo++; hi--;
  }
  return true;
}
```

Three JavaScript-specific caveats that a language-agnostic solution misses:

- ⚠️ **Iterate code points, not code units.** `str[i]` indexes UTF-16 units, so an emoji or any
  astral character is split in half and compared to nothing. Spreading into an array first — as
  above — iterates code points.
- ⚠️ **Normalise before comparing.** `"café"` written with a combining accent is a different code
  point sequence from the precomposed form, and they compare unequal.
  `str.normalize("NFC")` first.
- ⚠️ **`toLowerCase()` is locale-independent and occasionally wrong** — Turkish dotless ı is the
  standard example. `Intl.Collator` with `sensitivity: "base"` is the correct comparison when text
  is genuinely user-facing rather than ASCII puzzle input.

**Reversing to compare is the other common approach** and it is O(n) space:
`str === [...str].reverse().join("")`. Two pointers is O(1) space. Say which you chose and why.

## The rest of the family

| Problem | The move |
|---|---|
| Container with most water | move the **shorter** side inward — the taller one cannot improve |
| Trapping rain water | two pointers with running max on each side |
| Reverse an array/string in place | swap and converge, O(1) space |
| Valid palindrome with one deletion | on mismatch, try skipping either side |
| Merge two sorted arrays from the back | write from the end so nothing is overwritten |
| Squares of a sorted array | largest magnitude is at one end or the other |

🔴 **The recognition rule: the input is sorted (or can be), and the answer involves a *pair* whose
relationship is monotonic in the pointer positions.** If moving a pointer does not predictably
change the result, the pattern does not apply.

## Gotchas

**Symptom:** Two-sum returns wrong indices
**Cause:** The array was sorted first, destroying the original positions.
**Fix:** Use a hash map on unsorted input — it is O(n) and preserves indices.

**Symptom:** `sort()` produces `[1, 10, 9]`
**Cause:** The default comparator compares stringified values.
**Fix:** `(a, b) => a - b`.

**Symptom:** The caller's array is reordered
**Cause:** `sort` mutates.
**Fix:** `[...nums].sort(...)` or `toSorted`.

**Symptom:** Duplicate triples in three-sum
**Cause:** Only one of the three duplicate skips is present.
**Fix:** Skip duplicate anchors, and duplicates at both pointers after a hit.

**Symptom:** An element is paired with itself
**Cause:** `lo <= hi` instead of `lo < hi`.
**Fix:** Strict inequality, unless self-pairing is intended.

**Symptom:** A palindrome check fails on emoji
**Cause:** Indexing a string gives UTF-16 code units.
**Fix:** Spread to an array of code points first.

**Symptom:** Visually identical strings compare unequal
**Cause:** Different Unicode normalisation forms.
**Fix:** `normalize("NFC")` before comparing.

**Symptom:** The pattern gives wrong answers
**Cause:** The input was not sorted, so the discard argument does not hold.
**Fix:** Sort first (and state the O(n log n)), or use a different pattern.

## Interview questions

**★ Why is converging two pointers O(n)?**
Each pointer only moves inward and never back, so total movement is bounded by n. The `while` is
not a nested loop in disguise — it is a single pass with two cursors.

**★ Justify discarding a pointer's element.**
If the pair's sum is too small, `arr[lo]` cannot reach the target with **any** remaining partner,
because every remaining candidate is `arr[hi]` or smaller. So no pair involving `lo` can succeed
and it is safe to discard. The argument requires the array to be sorted.

**★ Two-sum on an unsorted array — two pointers or a hash map?**
Hash map. It is O(n) with no sort, and it returns the **original** indices; sorting to enable two
pointers destroys them. Choosing two pointers here is the classic wrong answer.

**★ What is the complexity of three-sum and how do you avoid duplicates?**
O(n²) — a linear two-pointer scan inside one loop, after an O(n log n) sort. Duplicates need
**three** skips: duplicate anchors, and duplicates at both pointers after recording a hit.

**★ Name the JavaScript-specific bug in a palindrome check.**
Indexing a string yields UTF-16 code units, so astral characters are split. Spread into an array
first for code points, and `normalize("NFC")` so composed and decomposed accents compare equal.

**★ Container with most water — which pointer moves?**
The **shorter** side. Height is limited by the shorter wall, so moving the taller one inward can
only reduce the width without raising the limit; moving the shorter one is the only move that can
improve the area.

**How do you recognise the pattern from a problem statement?**
Sorted input (or sortable), and an answer about a **pair** whose relationship changes predictably
as the pointers move. If moving a pointer does not monotonically change the value you are testing,
it is a different pattern.

---

[Topic index](./README.md) · Next → [02 · Same direction](./02-same-direction.md)
