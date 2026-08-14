---
title: "01.2 · Same direction"
sidebar_label: "02 · Same direction"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-14 — algorithmic material at the standard treatment; JavaScript specifics against MDN ([`Array.prototype.splice()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/splice), [`Array.prototype.filter()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/filter), [`Array.prototype.copyWithin()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/copyWithin)). Documentation-validated; **no timings**.

**Two pointers moving the same way is the in-place-rewrite pattern**: a *read* pointer that visits
every element and a *write* pointer that lags behind, marking where the kept elements go. It is
how you filter an array without allocating a new one, and how the fast/slow trick on linked lists
works.

## The read/write template

```js
function removeValue(arr, value) {
  let write = 0;
  for (let read = 0; read < arr.length; read++) {
    if (arr[read] !== value) {
      arr[write] = arr[read];
      write++;
    }
  }
  arr.length = write;          // truncate — the tail is stale
  return arr;
}
```

**`write` never overtakes `read`**, so overwriting is always safe: the slot being written was
already read. That invariant is the correctness argument, and it is worth saying.

O(n) time, **O(1) extra space** — which is the point. `arr.filter(x => x !== value)` is clearer and
allocates a new array; use `filter` unless the in-place requirement is explicit.

⚠️ **`arr.length = write` truncates the array**, which is the correct final step and also the one
people forget — without it, the stale tail is still there and `length` is unchanged.

🔴 **Never `splice` inside a loop over the same array.** It is O(n) per call — so O(n²) overall —
and it shifts the indices under the loop counter, so elements get skipped. It is a correctness bug
and a performance bug at once:

```js
// ❌ skips elements AND is quadratic
for (let i = 0; i < arr.length; i++) if (arr[i] === value) arr.splice(i, 1);
```

If you must splice while iterating, **iterate backwards** — removals then only affect indices you
have already passed.

## Deduplicating a sorted array in place

```js
function dedupeSorted(sorted) {
  if (!sorted.length) return sorted;
  let write = 1;
  for (let read = 1; read < sorted.length; read++) {
    if (sorted[read] !== sorted[write - 1]) sorted[write++] = sorted[read];
  }
  sorted.length = write;
  return sorted;
}
```

**Comparing against `sorted[write - 1]`, not `sorted[read - 1]`**, is the detail: after some
elements have been skipped those two are different, and the `read - 1` version lets duplicates
through in runs of three or more.

For unsorted input, `[...new Set(arr)]` is O(n) and clearer — dedupe in place is only worth it when
the array is sorted **and** allocation is genuinely a constraint.

## Fast and slow — the linked-list variant

Same direction, different speeds.

```js
// the middle node, in one pass
function middle(head) {
  let slow = head, fast = head;
  while (fast?.next) { slow = slow.next; fast = fast.next.next; }
  return slow;
}
```

```js
// Floyd's cycle detection
function hasCycle(head) {
  let slow = head, fast = head;
  while (fast?.next) {
    slow = slow.next;
    fast = fast.next.next;
    if (slow === fast) return true;
  }
  return false;
}
```

🔴 **Why the fast pointer must catch the slow one inside a cycle:** once both are in the loop, the
gap between them changes by exactly one each step, so it eventually reaches zero. It cannot skip
past — that is the proof, and it is the follow-up question.

⚠️ **`fast?.next` covers both terminating cases** — `fast` itself being `null` and `fast.next`
being `null` — which is the guard people get wrong, producing a `TypeError` on even-length lists.

**Finding the cycle's start** is the extension: after they meet, reset one pointer to the head and
advance both one step at a time; they meet at the entry. Worth knowing that it exists even if the
derivation is not something to reconstruct under pressure.

**The same idea without a list:** to find the *n*th element from the end, advance one pointer n
steps, then move both together until the leader reaches the end.

## Merging two sorted inputs

```js
function mergeSorted(a, b) {
  const out = [];
  let i = 0, j = 0;
  while (i < a.length && j < b.length) out.push(a[i] <= b[j] ? a[i++] : b[j++]);
  while (i < a.length) out.push(a[i++]);
  while (j < b.length) out.push(b[j++]);
  return out;
}
```

O(n + m), one pointer per input. **`<=` rather than `<` preserves stability** — equal elements keep
their relative order, with `a`'s before `b`'s. That is the merge step of merge sort, and the same
reason `Array.prototype.sort` is specified as stable.

⚠️ **Both drain loops are needed.** Only one will actually run, but which one depends on the data,
and dropping either loses the tail of one input.

**The in-place variant** — merging `b` into `a`, which has spare capacity — is the one that comes
up in interviews: **write from the back**, so you never overwrite an element you have not yet
read. Writing forward requires shifting and is O(n·m).

## Gotchas

**Symptom:** Elements are skipped when removing during iteration
**Cause:** `splice` shifts indices under the loop counter.
**Fix:** Read/write pointers, or iterate backwards.

**Symptom:** Removing in a loop is quadratic
**Cause:** `splice` is O(n) per call.
**Fix:** One pass with a write pointer.

**Symptom:** Stale elements remain after an in-place filter
**Cause:** `arr.length = write` was omitted.
**Fix:** Truncate at the end.

**Symptom:** Dedupe leaves duplicates in runs of three or more
**Cause:** Comparing against `arr[read - 1]` rather than `arr[write - 1]`.
**Fix:** Compare against the last **kept** element.

**Symptom:** `TypeError: Cannot read properties of null` in cycle detection
**Cause:** Advancing `fast.next.next` without checking both `fast` and `fast.next`.
**Fix:** `while (fast?.next)`.

**Symptom:** Cycle detection loops forever
**Cause:** Both pointers moving at the same speed.
**Fix:** Fast must move two steps per one.

**Symptom:** A merge loses the tail of one input
**Cause:** Only one drain loop after the main loop.
**Fix:** Both — only one runs, but which one depends on the data.

**Symptom:** A stable merge reorders equal elements
**Cause:** `<` instead of `<=` when choosing from the first input.
**Fix:** `<=` keeps the first input's elements first.

## Interview questions

**★ Remove all instances of a value in place. What is the invariant?**
A read pointer over every element and a write pointer marking the next kept slot. `write` never
overtakes `read`, so overwriting is always safe. Truncate with `arr.length = write` at the end.
O(n) time, O(1) space.

**★ Why not `splice` inside the loop?**
It is O(n) per call — quadratic overall — and it shifts indices under the loop counter, so
elements get skipped. It is a correctness bug before it is a performance one. Iterating backwards
fixes the skipping if you must splice.

**★ Deduplicate a sorted array in place — what is the subtle bug?**
Comparing the current element against `arr[read - 1]` instead of `arr[write - 1]`. Once elements
have been skipped those diverge, and duplicates survive in runs of three or more.

**★ Find the middle of a linked list in one pass.**
Fast and slow pointers: fast moves two, slow moves one; when fast runs out, slow is at the middle.
Guard with `while (fast?.next)` to cover both odd and even lengths.

**★ Why must Floyd's fast pointer catch the slow one?**
Inside the cycle the gap between them changes by exactly one per step, so it reaches zero — it
cannot jump past. That is the whole proof.

**★ Merge two sorted arrays — why `<=` and why two drain loops?**
`<=` takes from the first input on ties, which preserves stability. Both drain loops are required
because only one will run and which one depends on the data; omitting either loses a tail.

**Merging in place into an array with spare capacity — which direction?**
From the **back**. Writing forward would overwrite elements of the first array that have not been
read yet, forcing shifts and making it O(n·m).

---

← [01 · Opposite ends](./01-opposite-ends.md) · [Topic index](./README.md) ·
Next → [Phase index](../README.md)
