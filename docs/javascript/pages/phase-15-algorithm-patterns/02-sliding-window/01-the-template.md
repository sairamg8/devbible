---
title: "02.1 · The expand/shrink template"
sidebar_label: "01 · The template"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-14 — algorithmic material at the standard treatment; JavaScript specifics against MDN ([`Map`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map), [`Set`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Set)). Documentation-validated; **no timings**.

**One template solves most sliding-window problems**, and the useful skill is filling in its four
blanks rather than re-deriving the loop each time.

## The template

```js
function slidingWindow(items) {
  let left = 0;
  let best = 0;
  const state = new Map();                 // whatever the window must track

  for (let right = 0; right < items.length; right++) {
    add(state, items[right]);              // 1. expand

    while (isInvalid(state)) {             // 2. shrink until valid again
      remove(state, items[left]);
      left++;
    }

    best = Math.max(best, right - left + 1);   // 3. record
  }
  return best;                                 // 4. answer
}
```

The four blanks:

1. **What the window tracks** — a count map, a sum, a set of characters, a frequency signature.
2. **What makes it invalid** — a duplicate, a sum over the target, more than k distinct values.
3. **What you record** — the longest window, the shortest, a count of windows.
4. **Whether you want maximum or minimum**, which decides where the record step goes.

🔴 **It is O(n) even though there is a `while` inside a `for`.** `left` only ever increases, and it
cannot exceed `right`, so across the whole run each index is added once and removed at most once —
the same total-work argument as monotonic stacks
([Phase 14 · 04 · 02](../../phase-14-data-structures/04-stack/02-monotonic-stacks.md)). **Say this
out loud in an interview**; "isn't that nested loops?" is the standard follow-up.

## Longest substring without repeating characters

```js
function longestUnique(str) {
  const lastSeen = new Map();
  let left = 0, best = 0;

  for (let right = 0; right < str.length; right++) {
    const ch = str[right];
    if (lastSeen.has(ch) && lastSeen.get(ch) >= left) {
      left = lastSeen.get(ch) + 1;         // jump past the previous occurrence
    }
    lastSeen.set(ch, right);
    best = Math.max(best, right - left + 1);
  }
  return best;
}
```

⚠️ **`lastSeen.get(ch) >= left` is the guard that matters.** Without it, a character last seen
*before* the current window drags `left` backwards, and the window silently expands to include
duplicates. It is the most common bug in this specific problem.

**The jump version is an optimisation over the plain template**, which would shrink one character
at a time. Both are O(n); the jump is fewer operations and slightly harder to get right. Either is
a good answer — say which you wrote.

## Minimum window substring — the shrinking variant

When you want the **shortest** valid window, the record step moves inside the shrink loop:

```js
function minWindow(s, t) {
  const need = new Map();
  for (const ch of t) need.set(ch, (need.get(ch) ?? 0) + 1);

  let missing = t.length;                  // how many still needed, counting multiplicity
  let left = 0, bestLeft = 0, bestLen = Infinity;

  for (let right = 0; right < s.length; right++) {
    const ch = s[right];
    if ((need.get(ch) ?? 0) > 0) missing--;
    need.set(ch, (need.get(ch) ?? 0) - 1);          // may go negative — that is fine

    while (missing === 0) {                          // valid → try to shrink
      if (right - left + 1 < bestLen) {
        bestLen = right - left + 1;
        bestLeft = left;
      }
      const out = s[left++];
      need.set(out, need.get(out) + 1);
      if (need.get(out) > 0) missing++;              // now genuinely missing
    }
  }
  return bestLen === Infinity ? "" : s.slice(bestLeft, bestLeft + bestLen);
}
```

🔴 **Letting counts go negative is the trick.** A negative count means "we have surplus of this
character", so removing one only makes us *missing* it when the count climbs back above zero.
Tracking `missing` as a single number rather than comparing two maps is what keeps it O(n) instead
of O(n · alphabet).

**Maximum problems record after shrinking; minimum problems record while valid, inside the shrink
loop.** That is the structural difference, and getting it backwards is the other common error.

## Fixed-size windows

When k is given, there is no shrink loop at all — the window slides:

```js
function maxSumOfK(nums, k) {
  let sum = 0;
  for (let i = 0; i < k; i++) sum += nums[i];

  let best = sum;
  for (let right = k; right < nums.length; right++) {
    sum += nums[right] - nums[right - k];    // add one, drop one
    best = Math.max(best, sum);
  }
  return best;
}
```

⚠️ **Recomputing the sum for each window is the O(n·k) version** that this replaces. The whole
point is the incremental update — add the entering element, subtract the leaving one.

**Anagram search** is the same shape with a frequency signature instead of a sum: maintain counts
of the window, compare against the target's counts, and update incrementally. Comparing two maps
each step is O(alphabet) per position, which is acceptable and worth naming as the cost.

## Recognising it

🔴 **The rule: a contiguous subarray or substring, and a property that can be updated incrementally
as elements enter and leave.** Both halves are required.

- **"Contiguous"** — if the problem allows skipping elements, it is not a window (that is usually
  DP or a hash-map pattern).
- **"Incrementally updatable"** — a sum, a count map, a distinct-count. If evaluating the window
  requires re-examining all of it, the pattern gives you nothing.

⚠️ **Negative numbers break the "shrink when the sum is too big" logic**, because adding an element
can *decrease* the sum. Sliding window on sums assumes non-negative values; with negatives, prefix
sums plus a hash map is the pattern instead.

## Gotchas

**Symptom:** The window includes duplicates
**Cause:** `left` was moved backwards by a character last seen before the window.
**Fix:** Only jump if `lastSeen.get(ch) >= left`.

**Symptom:** The "shortest window" answer is too long
**Cause:** The record step is outside the shrink loop.
**Fix:** Minimum problems record **inside** the `while`, while the window is still valid.

**Symptom:** A fixed-window solution is O(n·k)
**Cause:** The window's value is recomputed each step.
**Fix:** Add the entering element and subtract the leaving one.

**Symptom:** A sum-based window gives wrong answers on some inputs
**Cause:** Negative numbers — adding an element can decrease the sum, so shrinking is not
monotonic.
**Fix:** Prefix sums with a hash map instead.

**Symptom:** The solution is called O(n²) in review
**Cause:** The inner `while` is being counted as a nested loop.
**Fix:** `left` only advances, at most n times overall — O(n).

**Symptom:** Off-by-one in the window length
**Cause:** `right - left` instead of `right - left + 1`.
**Fix:** Inclusive bounds means `+ 1`; pick one convention and keep it.

**Symptom:** Counts get confused when characters repeat
**Cause:** Trying to compare two frequency maps instead of tracking a single `missing` counter.
**Fix:** Let counts go negative and track how many are still genuinely needed.

**Symptom:** Window logic misbehaves on non-BMP characters
**Cause:** Indexing a string by UTF-16 code unit.
**Fix:** Convert to an array of code points first.

## Interview questions

**★ Give the sliding-window template and its four blanks.**
Expand `right`; shrink from `left` while invalid; record; answer. The blanks are what the window
tracks, what makes it invalid, what you record, and whether you want a maximum or a minimum —
which decides whether the record step sits inside or after the shrink loop.

**★ Why is it O(n) with a `while` inside a `for`?**
`left` only increases and never exceeds `right`, so each index is added once and removed at most
once. Total work is bounded by 2n, regardless of nesting depth.

**★ Longest substring without repeats — what is the classic bug?**
Moving `left` backwards. A character last seen *before* the current window must not drag `left`
back; guard with `lastSeen.get(ch) >= left`.

**★ How does the template differ for a minimum-length window?**
The record step moves inside the shrink loop — you record while the window is still valid and
then shrink further. Maximum problems record after the window has become valid again.

**★ In minimum-window-substring, why let the counts go negative?**
A negative count means surplus. Removing a surplus character does not make the window invalid, so
tracking a single `missing` counter — incremented only when a count climbs back above zero — keeps
the whole thing O(n) instead of comparing two maps at every position.

**★ When does the sliding-window pattern not apply?**
When the subsequence need not be contiguous, or when the window's property cannot be updated
incrementally. And specifically: **sum-based windows break with negative numbers**, because
adding an element can decrease the sum — use prefix sums with a hash map there.

**How do you spot it from a problem statement?**
"Contiguous subarray/substring" plus a property that changes predictably as one element enters and
one leaves. Both halves are required.

---

[Topic index](./README.md) · Next → [02 · Variants and traps](./02-variants-and-traps.md)
