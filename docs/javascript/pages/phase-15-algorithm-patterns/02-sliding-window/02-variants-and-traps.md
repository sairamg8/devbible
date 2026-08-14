---
title: "02.2 · Variants and traps"
sidebar_label: "02 · Variants and traps"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-14 — algorithmic material at the standard treatment; JavaScript specifics against MDN ([`Map`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map), [`Array.prototype.shift()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/shift), [`Number.MAX_SAFE_INTEGER`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number/MAX_SAFE_INTEGER)). Documentation-validated; **no timings**.

**The template covers the standard problems; the variants are where it stops working.** Knowing
where the boundary is matters more than another worked example.

## Counting windows rather than measuring one

"How many subarrays satisfy X?" is a different record step, and the arithmetic is the part people
get wrong.

```js
// count subarrays with at most k distinct values
function atMostK(nums, k) {
  const counts = new Map();
  let left = 0, total = 0;

  for (let right = 0; right < nums.length; right++) {
    counts.set(nums[right], (counts.get(nums[right]) ?? 0) + 1);

    while (counts.size > k) {
      const out = nums[left++];
      const c = counts.get(out) - 1;
      if (c === 0) counts.delete(out); else counts.set(out, c);   // 🔴 delete at zero
    }

    total += right - left + 1;      // every window ending at `right` is valid
  }
  return total;
}
```

🔴 **`total += right - left + 1` is the counting insight.** Every subarray ending at `right` and
starting anywhere in `[left, right]` is valid, and there are exactly that many. Counting them
individually is the O(n²) version.

🔴 **`counts.delete(out)` when the count hits zero is mandatory**, because the validity test is
`counts.size > k`. Leaving a zero-count entry in the map makes `size` wrong and the window never
shrinks enough. This is a genuinely easy bug — the counts are right and the *size* is not.

**"Exactly k" is `atMostK(k) - atMostK(k - 1)`.** There is no direct sliding window for "exactly",
because the validity condition is not monotonic — a window can become invalid and then valid again
as it grows. The subtraction is the standard move and worth remembering as a technique.

## Windows with a maximum or minimum

Tracking a sum or a count is incremental. Tracking a **maximum** is not — removing the current
maximum means the new one has to come from somewhere.

**Monotonic deque** is the answer, covered in
[Phase 14 · 05 · 02](../../phase-14-data-structures/05-queue-and-deque/02-deques-and-two-stacks.md):
keep indices with decreasing values, the front is the window maximum, and each index enters and
leaves once.

⚠️ **And the caveat from that page applies here too**: `deque.shift()` on a plain array is O(n), so
the "O(n)" solution is not O(n) unless the deque uses a head index or a ring buffer. **Noticing
that about your own solution is the strong answer.**

## Windows on streams

When the input arrives over time rather than as an array, the window is a bounded queue:

```js
class RateLimiter {
  #times = [];
  #head = 0;

  constructor(limit, windowMs) { this.limit = limit; this.windowMs = windowMs; }

  allow(now = Date.now()) {
    const cutoff = now - this.windowMs;
    while (this.#head < this.#times.length && this.#times[this.#head] <= cutoff) this.#head++;

    if (this.#times.length - this.#head >= this.limit) return false;
    this.#times.push(now);
    return true;
  }
}
```

**Same expand/shrink structure**, with time as the window bound instead of an index. 🔴 **The head
index rather than `shift()` for the same reason as always** — a rate limiter is exactly the code
that runs under load.

⚠️ **This is a sliding-log limiter, and it stores one timestamp per allowed request.** That is a
memory cost proportional to the limit, and it is why production limiters usually use a fixed
window with a counter, or a token bucket, instead. Say the trade rather than presenting the log as
the answer.

## Where the pattern genuinely stops

| Situation | Why it fails | What to use |
|---|---|---|
| Elements may be skipped | not contiguous | DP, or hash-map patterns |
| Sums with **negative numbers** | shrinking does not monotonically reduce the sum | prefix sums + hash map |
| "Exactly k" conditions | validity is not monotonic in window size | `atMost(k) - atMost(k-1)` |
| The window's value needs a full re-scan | no incremental update | a different structure entirely |
| Product-based windows with zeros | a zero makes the product 0 regardless of the rest | split at zeros, handle separately |

🔴 **Negative numbers are the most common of these in practice**, and the failure is silent: the
code returns a plausible wrong answer. The reason is precisely that the shrink loop assumes
removing an element from the left reduces the window's value — which is false when that element is
negative.

## Two JavaScript-specific notes

**Strings index by UTF-16 code unit.** A window over `str[i]` splits astral characters. Convert
with `[...str]` first when the input can contain emoji or non-BMP text
([Phase 1 · Values, types and coercion](../../phase-1-values-and-coercion/README.md)).

**Sums can exceed `Number.MAX_SAFE_INTEGER`.** For a long window of large integers the running sum
loses precision silently — no error, just wrong digits. `BigInt` is the fix when the values are
genuinely large, and knowing the limit exists (2⁵³ − 1) is the part that matters.

## Gotchas

**Symptom:** "At most k distinct" never shrinks correctly
**Cause:** Zero-count entries left in the map, so `counts.size` overstates the distinct count.
**Fix:** `delete` the key when its count reaches zero.

**Symptom:** Counting subarrays is O(n²)
**Cause:** Enumerating each valid window instead of adding `right - left + 1`.
**Fix:** Every window ending at `right` and starting in `[left, right]` is valid — add the count.

**Symptom:** No sliding window works for "exactly k"
**Cause:** Validity is not monotonic in window size.
**Fix:** `atMost(k) - atMost(k - 1)`.

**Symptom:** A window-maximum solution is quadratic
**Cause:** Recomputing the maximum after each shrink.
**Fix:** A monotonic deque — and use a head index, not `shift()`.

**Symptom:** A sum-based window is wrong on some inputs
**Cause:** Negative numbers; shrinking does not reduce the sum.
**Fix:** Prefix sums with a hash map.

**Symptom:** A rate limiter degrades under load
**Cause:** `shift()` on the timestamp array.
**Fix:** A head index.

**Symptom:** A rate limiter uses more memory than expected
**Cause:** A sliding log stores one timestamp per allowed request.
**Fix:** A fixed window with a counter, or a token bucket, if the memory matters.

**Symptom:** A long sum is subtly wrong
**Cause:** It exceeded `Number.MAX_SAFE_INTEGER` and lost precision silently.
**Fix:** `BigInt` for genuinely large integer sums.

## Interview questions

**★ Count subarrays with at most k distinct values. What is the key line?**
`total += right - left + 1` — every subarray ending at `right` and starting anywhere in
`[left, right]` is valid, so there are exactly that many. Enumerating them is the O(n²) version.

**★ What is the easy bug in that solution?**
Not deleting a key when its count reaches zero. The validity test uses `counts.size`, so a
lingering zero-count entry makes the distinct count wrong and the window under-shrinks.

**★ How do you handle "exactly k"?**
`atMost(k) - atMost(k - 1)`. There is no direct window because validity is not monotonic in window
size — a window can become invalid and valid again as it grows.

**★ Sliding-window maximum — why is the naive version quadratic, and what fixes it?**
Because a maximum cannot be updated incrementally when the maximum itself leaves. A monotonic
deque of indices fixes it, with each index entering and leaving once — provided the deque is not a
plain array using `shift()`, which would be O(n) per removal.

**★ Why do negative numbers break sum-based sliding windows?**
The shrink loop assumes removing a left-hand element reduces the window's value. With negatives it
can increase it, so the loop's exit condition is meaningless. Prefix sums plus a hash map is the
pattern for that case — and the failure is silent, which is what makes it dangerous.

**★ Implement a rate limiter as a sliding window, and state its cost.**
A queue of timestamps with a head index, dropping entries older than the window. It is a
**sliding log**: exact, but it stores one timestamp per allowed request. Production systems
usually accept a fixed-window counter or a token bucket to avoid that memory.

**What are the two JavaScript-specific traps?**
Indexing strings by UTF-16 code unit, which splits astral characters — spread first. And running
sums exceeding `Number.MAX_SAFE_INTEGER`, which loses precision with no error.

---

← [01 · The template](./01-the-template.md) · [Topic index](./README.md) ·
Next → [Phase index](../README.md)
