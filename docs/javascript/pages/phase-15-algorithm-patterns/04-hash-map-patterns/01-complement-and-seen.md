---
title: "04.1 · Complement and seen-sets"
sidebar_label: "01 · Complement and seen"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-14 — algorithmic material at the standard treatment; JavaScript specifics against MDN ([`Map`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map), [`Set`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Set), [SameValueZero](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Equality_comparisons_and_sameness#same-value-zero_equality)). Documentation-validated; **no timings**.

**Trade memory for time.** That is the entire pattern: a hash map turns "search for the thing I
need" into "look it up", which turns a nested loop into a single pass. Recognising when it applies
is worth more than any individual solution.

## Two-sum, and the move it teaches

```js
function twoSum(nums, target) {
  const seen = new Map();                     // value → index

  for (let i = 0; i < nums.length; i++) {
    const complement = target - nums[i];
    if (seen.has(complement)) return [seen.get(complement), i];
    seen.set(nums[i], i);                     // 🔴 store AFTER checking
  }
  return null;
}
```

O(n) time, O(n) space, and it returns the **original indices** — which is why this beats sorting
plus two pointers for unsorted input
([01 · Opposite ends](../01-two-pointers/01-opposite-ends.md)).

🔴 **Storing after checking is what handles `target = 2 * nums[i]` correctly.** Store first and an
element pairs with *itself*: `twoSum([3, 5], 6)` would return `[0, 0]`. It is a one-line ordering
detail with a wrong answer behind it.

**The move to internalise: instead of asking "does a partner exist somewhere?", compute what the
partner would have to be and look it up.** That reframing — *complement lookup* — is what turns
O(n²) into O(n), and it generalises far beyond two-sum:

| Problem | The complement |
|---|---|
| Two-sum | `target - x` |
| Pair with difference k | `x + k` and `x - k` |
| Subarray sum equals k | `runningSum - k` (see below) |
| Two strings are anagrams | the character-count signature |
| Four-sum as two two-sums | the sum of the other pair |

## Seen-sets: the membership half

When you only need "have I encountered this?", a `Set` is enough:

```js
const hasDuplicate = new Set(nums).size !== nums.length;

function firstDuplicate(nums) {
  const seen = new Set();
  for (const x of nums) {
    if (seen.has(x)) return x;
    seen.add(x);
  }
  return null;
}
```

⚠️ **`new Set(nums).size !== nums.length` reads better and allocates the whole set**; the loop
short-circuits at the first duplicate. For "is there one?" on large inputs the loop wins; for
clarity on small ones, the one-liner does. Say which and why rather than treating one as correct.

🔴 **SameValueZero means objects compare by reference**
([Phase 14 · 02](../../phase-14-data-structures/02-hash-maps-and-sets/01-using-the-built-ins.md)),
so a `Set` of records does not deduplicate by content. Key on something canonical:

```js
const seen = new Set(items.map((i) => `${i.type}:${i.id}`));    // composite key
const byId = new Map(items.map((i) => [i.id, i]));              // or keep the item
```

⚠️ **Composite string keys collide if a part can contain the separator.** Pick a separator the data
cannot contain, or nest maps.

## Prefix sums plus a hash map

The pattern that solves the whole "subarray summing to k" family — including the case sliding
windows cannot handle, because it does not care about negative numbers
([02 · Variants and traps](../02-sliding-window/02-variants-and-traps.md)).

```js
function countSubarraysWithSum(nums, k) {
  const counts = new Map([[0, 1]]);        // 🔴 the empty prefix
  let running = 0, total = 0;

  for (const x of nums) {
    running += x;
    total += counts.get(running - k) ?? 0;          // how many prefixes make a valid subarray
    counts.set(running, (counts.get(running) ?? 0) + 1);
  }
  return total;
}
```

**The insight:** a subarray `(i, j]` sums to k exactly when `prefix[j] - prefix[i] === k`. So at
each position, the number of valid subarrays ending here is the number of earlier prefixes equal
to `running - k` — a lookup, not a search.

🔴 **`new Map([[0, 1]])` is the line everyone forgets.** It represents the empty prefix, and without
it every subarray that starts at index 0 is missed. The symptom is an answer that is correct except
when the match includes the first element — which small tests often do not cover.

**Same shape, different question:** the *longest* such subarray stores the first index at which
each prefix appeared and takes `i - firstIndex[running - k]`. Storing the first occurrence rather
than the count is the only change.

## Where the pattern beats the alternatives

| Situation | Hash map | Two pointers | Sliding window |
|---|---|---|---|
| Unsorted input | ✅ | needs a sort | ✅ if contiguous |
| Original indices required | ✅ | ❌ sorting destroys them | ✅ |
| Non-contiguous elements | ✅ | ✅ | ❌ |
| Negative numbers | ✅ | ✅ | ❌ for sums |
| O(1) extra space required | ❌ O(n) | ✅ | ✅ |

🔴 **The only real cost is memory**, and the only situation where that decides against it is an
explicit O(1)-space constraint — which is exactly when an interviewer is steering you toward two
pointers or a cycle-detection trick.

## Gotchas

**Symptom:** Two-sum pairs an element with itself
**Cause:** The value was stored in the map before the complement was checked.
**Fix:** Check first, then store.

**Symptom:** Two-sum returns positions in a sorted copy
**Cause:** The array was sorted to use two pointers.
**Fix:** Hash map on the original array.

**Symptom:** A `Set` does not deduplicate identical records
**Cause:** SameValueZero compares objects by reference.
**Fix:** Key on an id or a canonical string.

**Symptom:** Composite keys collide
**Cause:** A key part contained the separator.
**Fix:** A separator the data cannot contain, or nested maps.

**Symptom:** Subarray-sum count is short by exactly the subarrays starting at index 0
**Cause:** The map was not seeded with `[0, 1]` for the empty prefix.
**Fix:** Seed it.

**Symptom:** A sliding-window sum solution fails on negative numbers
**Cause:** Shrinking does not monotonically reduce the sum.
**Fix:** Prefix sums with a hash map — this pattern.

**Symptom:** Memory grows on very large inputs
**Cause:** The map holds an entry per distinct value.
**Fix:** Accept it, or switch pattern if O(1) space is required.

**Symptom:** A running sum is subtly wrong on long inputs
**Cause:** It exceeded `Number.MAX_SAFE_INTEGER`.
**Fix:** `BigInt` when the values are genuinely large.

## Interview questions

**★ Solve two-sum on an unsorted array. Why not sort and use two pointers?**
A `Map` from value to index, checking for `target - x` **before** inserting `x`. O(n), and it
returns the **original** indices — sorting destroys them, which is what the question asks for.

**★ Why does the insertion order within the loop matter?**
Storing before checking lets an element pair with itself, so `twoSum([3,5], 6)` returns `[0,0]`.
Check the complement, then store.

**★ What is "complement lookup" as a general move?**
Instead of searching for a partner, compute what the partner must be and look it up. It converts
"for each element, scan the rest" into one pass, and it generalises to difference pairs, subarray
sums, anagram signatures and four-sum.

**★ Count subarrays summing to k, including negative numbers.**
Prefix sums with a count map: a subarray sums to k when `prefix[j] - prefix[i] === k`, so add
`counts.get(running - k)` at each position. **Seed the map with `{0: 1}`** for the empty prefix, or
every subarray starting at index 0 is missed.

**★ Why not a sliding window for that problem?**
Because with negative numbers, extending the window can decrease the sum, so the shrink condition
is meaningless. The failure is silent — a plausible wrong answer.

**★ What does the hash-map pattern cost?**
O(n) memory. That is the only thing that decides against it, and an explicit O(1)-space constraint
is usually the interviewer steering you toward two pointers or a cycle-detection trick.

**How do you deduplicate objects by content?**
Not with a `Set` — SameValueZero compares by reference. Key on an id or a canonical string with a
`Map`, watching for separator collisions in composite keys.

---

[Topic index](./README.md) · Next → [02 · Signatures and index maps](./02-signatures-and-index-maps.md)
