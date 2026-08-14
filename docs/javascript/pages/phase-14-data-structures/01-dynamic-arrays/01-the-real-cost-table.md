---
title: "01.1 · The real cost of each operation"
sidebar_label: "01 · The cost table"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-14 against MDN — [`Array.prototype.push()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/push), [`Array.prototype.shift()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/shift), [`Array.prototype.splice()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/splice), [`Array.prototype.slice()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/slice), [`Array`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array) — and the V8 blog, [Elements kinds in V8](https://v8.dev/blog/elements-kinds). Documentation-validated; **no timings**.

**A JavaScript array is not an array.** The specification defines it as an object with
integer-like keys and a `length` that maintains itself; engines *implement* it as a contiguous
block when they can, and fall back to a dictionary when they cannot. Both halves matter, and the
cost table follows from them.

## The table

| Operation | Cost | Why |
|---|---|---|
| `arr[i]` read/write | **O(1)** | direct offset, while the array is packed |
| `arr.length` | **O(1)** | maintained, not computed |
| `push(x)` | **amortised O(1)** | writes at the end; occasionally grows the backing store |
| `pop()` | **O(1)** | no reindexing |
| `shift()` | **O(n)** | every remaining element's index changes |
| `unshift(x)` | **O(n)** | same, in the other direction |
| `splice(i, k)` | **O(n)** | everything after `i` shifts |
| `slice(i, j)` | **O(j − i)** | copies |
| `concat` / `[...a, ...b]` | **O(n + m)** | copies both |
| `indexOf` / `includes` / `find` | **O(n)** | scan |
| `sort()` | **O(n log n)** | comparison sort |
| `reverse()` | **O(n)** | in place |
| `map` / `filter` / `reduce` / `forEach` | **O(n)** | one pass, plus allocation for `map`/`filter` |

🔴 **Two rows carry almost all the practical weight: `push`/`pop` are cheap at the end, and
`shift`/`unshift` are linear at the front.** Everything in this topic follows from that asymmetry.

## Why `push` is amortised O(1)

MDN: `push()` *"adds the specified elements to the end of an array and returns the new length of
the array."* The interesting part is what happens when the backing store is full.

A dynamic array does not grow by one slot — it allocates a **larger** block (engines grow
geometrically) and copies. So:

- most pushes write into spare capacity — O(1);
- occasionally one push copies n elements — O(n);
- but the copies happen with **geometrically decreasing frequency**, so n pushes cost O(n) in
  total.

**That is what "amortised" means: a guarantee over the sequence, not an average over inputs.** Any
individual push can be slow; a run of them cannot be.

⚠️ **Amortisation assumes the pattern.** Pushing and popping repeatedly across the boundary where
the store resizes can defeat it in principle, and pre-sizing (`new Array(n)` then assigning by
index, or `Array.from({length: n})`) avoids the copies entirely when you know the size — at the
cost of a holey array if you leave gaps.

## Why `shift` is O(n), and what to do instead

`shift()` removes index 0. Every remaining element must move down one index, because the array's
contract is that its elements live at `0…length-1`. There is no way to make that O(1) for a real
array.

🔴 **So a queue built on `push`/`shift` is O(n) per dequeue — draining n items is O(n²).**

```js
// ❌ O(n²) to drain
const queue = [];
queue.push(job);
const next = queue.shift();

// ✅ O(1) amortised — a head index instead of a removal
class Queue {
  #items = [];
  #head = 0;

  enqueue(x) { this.#items.push(x); }

  dequeue() {
    if (this.#head >= this.#items.length) return undefined;
    const x = this.#items[this.#head];
    this.#items[this.#head] = undefined;   // release the reference
    this.#head++;
    if (this.#head > 32 && this.#head * 2 >= this.#items.length) {
      this.#items = this.#items.slice(this.#head);   // compact, amortised
      this.#head = 0;
    }
    return x;
  }

  get size() { return this.#items.length - this.#head; }
}
```

Two details worth keeping:

- **`this.#items[this.#head] = undefined` matters.** Without it, the array keeps a reference to
  every dequeued item and the queue leaks — a job queue that has processed a million messages
  holds a million objects alive.
- **The compaction step is what keeps memory bounded.** Without it the backing array grows forever
  even as `size` stays small. Compacting when the dead prefix is at least half the array keeps the
  amortised cost O(1).

Full treatment in **05 · Queue and deque** *(not written yet)*.

## The two representations

V8 tracks an array's **elements kind**, and the transitions are one-way — an array degrades to a
more general representation and does not come back. The distinction that matters for cost:

- **Packed** — no gaps. Fast paths apply, iteration is a straight walk.
- **Holey** — at least one index is absent. Reads must check the prototype chain for the missing
  index, which is why it is slower rather than merely different.

```js
const a = [1, 2, 3];      // packed
a[10] = 11;               // ⚠️ holey — indices 3..9 do not exist
delete a[0];              // ⚠️ holey — and a.length is still 11
new Array(5);             // ⚠️ holey from birth
Array.from({ length: 5 }); // ✅ packed, filled with undefined
```

🔴 **`delete arr[i]` is the one to unlearn.** It removes the *property*, not the element: `length`
does not change, a hole appears, and the array is permanently in the slower representation.
`splice(i, 1)` actually removes; `filter` builds a new dense array.

**Holes are also semantically inconsistent across methods** — some skip them, some treat them as
`undefined` — which is a correctness problem before it is a performance one.

## Gotchas

**Symptom:** A queue gets slower the longer it runs
**Cause:** `shift()` is O(n) — the whole array reindexes per dequeue.
**Fix:** A head index, with periodic compaction.

**Symptom:** A head-index queue leaks memory
**Cause:** Dequeued slots still reference their items.
**Fix:** Null the slot when advancing the head.

**Symptom:** A head-index queue's memory grows without bound
**Cause:** No compaction — the dead prefix is never reclaimed.
**Fix:** `slice(head)` when the dead prefix reaches half the array.

**Symptom:** `arr.length` does not match the number of elements
**Cause:** `delete arr[i]`, or assigning past the end, leaves holes.
**Fix:** `splice`/`filter`; never `delete` on an array.

**Symptom:** `new Array(5).map(f)` does nothing
**Cause:** The array is holey; `map` skips holes.
**Fix:** `Array.from({ length: 5 }, f)`.

**Symptom:** Array operations slow down permanently after one odd assignment
**Cause:** The array transitioned to a holey elements kind and does not transition back.
**Fix:** Keep arrays dense; rebuild rather than patch.

**Symptom:** Building a big array is slower than expected
**Cause:** Repeated growth and copying.
**Fix:** Pre-size when the length is known.

**Symptom:** `[...acc, x]` in a loop is quadratic
**Cause:** Spread copies the whole array each time.
**Fix:** `push`, then return the array.

## Interview questions

**★ Why is `push` O(1) but `shift` O(n)?**
`push` writes at the end into spare capacity, growing the backing store geometrically — so any n
pushes cost O(n) in total, which is what amortised O(1) means. `shift` removes index 0, and the
array's contract requires elements to live at `0…length-1`, so everything reindexes.

**★ Implement an O(1) queue on a JavaScript array.**
Keep a head index instead of removing from the front: `push` to enqueue, read `items[head]` and
increment to dequeue. Null the vacated slot so the item can be collected, and compact with
`slice(head)` once the dead prefix reaches half the array — otherwise it leaks and grows forever.

**★ What does "amortised" mean here, precisely?**
A guarantee over a *sequence* of operations, not an average over inputs. An individual `push` may
copy the whole array; a run of n pushes still costs O(n) because the copies happen with
geometrically decreasing frequency.

**★ What is wrong with `delete arr[i]`?**
It deletes the property, not the element. `length` is unchanged, a hole is left, methods disagree
about how to treat it, and the engine moves the array to a slower "holey" representation it will
not move back from. Use `splice` or `filter`.

**★ Why is `new Array(5).map(f)` a no-op?**
The array has length 5 and no elements — it is holey — and `map` skips holes. `Array.from({length:
5}, f)` produces a packed array.

**★ Is a JavaScript array really an array?**
Specification-wise it is an object with integer-like keys and a self-maintaining `length`. Engines
implement it as a contiguous block **while they can**, and fall back to a dictionary when the
array becomes sparse enough — which is why keeping arrays dense is a performance decision, not
just a tidiness one.

**When would you pre-size an array?**
When the final length is known and large — it avoids the repeated grow-and-copy. Use
`Array.from({length: n})` rather than `new Array(n)` if you are going to iterate it, so it is
packed rather than holey.

---

[Topic index](./README.md) · Next → [02 · Copying, slicing and the modern methods](./02-copying-and-modern-methods.md)
