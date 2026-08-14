---
title: "05.1 · Making dequeue O(1)"
sidebar_label: "01 · Making dequeue O(1)"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-14 against MDN — [`Array.prototype.shift()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/shift), [`Array.prototype.push()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/push), [`Array.prototype.slice()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/slice). Documentation-validated; **no timings**.

**JavaScript gives you a stack for free and makes you build a queue.** `push`/`pop` are both at
the cheap end; a queue needs one operation at each end, and `shift` is O(n)
([01 · The cost table](../01-dynamic-arrays/01-the-real-cost-table.md)). Every implementation
below is a different way around that one fact.

## Why `[].shift()` disqualifies the array

```js
const queue = [];
queue.push(job);
const next = queue.shift();     // 🔴 O(n) — every remaining element reindexes
```

Draining n items is **O(n²)**. With 100 items nobody notices; with 100,000 the process stalls, and
the code looks correct at every line.

⚠️ **This is the most common "it worked in testing" performance bug in JavaScript**, because a
queue is exactly the structure whose size is decided by production load rather than by the
developer.

## Approach 1 — a head index (the practical answer)

```js
class Queue {
  #items = [];
  #head = 0;

  enqueue(x) { this.#items.push(x); return this; }

  dequeue() {
    if (this.#head >= this.#items.length) return undefined;
    const x = this.#items[this.#head];
    this.#items[this.#head] = undefined;      // 🔴 release the reference
    this.#head++;

    if (this.#head > 32 && this.#head * 2 >= this.#items.length) {
      this.#items = this.#items.slice(this.#head);   // compact
      this.#head = 0;
    }
    return x;
  }

  peek()  { return this.#items[this.#head]; }
  get size() { return this.#items.length - this.#head; }
}
```

**Both extra lines are load-bearing, and both are usually missing from the version people write:**

- 🔴 **`this.#items[this.#head] = undefined`.** Without it, the backing array holds every dequeued
  item forever. A worker that has processed a million messages keeps a million objects alive —
  a leak that only appears under sustained load, which is exactly when you cannot debug it.
- 🔴 **The compaction.** Without it the array grows without bound even though `size` stays small,
  because `push` keeps extending the tail while the dead prefix is never reclaimed. Compacting
  when the dead prefix reaches half the array makes the O(n) copy rare enough to amortise to O(1).

The `> 32` guard just avoids compacting a tiny queue on every operation.

## Approach 2 — a ring buffer (fixed capacity)

When the maximum size is known, a circular buffer avoids allocation entirely:

```js
class RingBuffer {
  #buf; #head = 0; #tail = 0; #size = 0;

  constructor(capacity) { this.#buf = new Array(capacity); }

  enqueue(x) {
    if (this.#size === this.#buf.length) throw new RangeError("Queue is full");
    this.#buf[this.#tail] = x;
    this.#tail = (this.#tail + 1) % this.#buf.length;
    this.#size++;
  }

  dequeue() {
    if (this.#size === 0) return undefined;
    const x = this.#buf[this.#head];
    this.#buf[this.#head] = undefined;
    this.#head = (this.#head + 1) % this.#buf.length;
    this.#size--;
    return x;
  }

  get size() { return this.#size; }
}
```

🔴 **A separate `#size` counter is not optional.** With only `head` and `tail`, "full" and "empty"
are the same state (`head === tail`) and cannot be distinguished. The alternatives are a size
counter or leaving one slot permanently unused; the counter is clearer.

**When a ring buffer is the right answer:** bounded work queues, audio/sample buffers, the last N
log lines, rate-limiter windows. **The bound is a feature** — a full queue that throws or drops is
backpressure, and an unbounded queue that grows until the process dies is not.

## Approach 3 — a linked list (unbounded, no copies)

```js
class LinkedQueue {
  #head = null; #tail = null; #size = 0;

  enqueue(value) {
    const node = { value, next: null };
    if (this.#tail) this.#tail.next = node;
    else this.#head = node;
    this.#tail = node;
    this.#size++;
  }

  dequeue() {
    if (!this.#head) return undefined;
    const { value } = this.#head;
    this.#head = this.#head.next;
    if (!this.#head) this.#tail = null;      // 🔴 or the tail dangles
    this.#size--;
    return value;
  }

  get size() { return this.#size; }
}
```

True O(1) at both ends with no amortisation and no copying — at the cost of **one object
allocation per item** and worse cache locality than an array.

⚠️ **`if (!this.#head) this.#tail = null` is the classic bug.** Dequeuing the last item leaves
`#tail` pointing at a detached node; the next `enqueue` then attaches to it and the item is lost
from the list while still being counted.

**In practice the head-index array wins for most JavaScript workloads** — allocation is expensive
and arrays are cache-friendly. The linked list is the right answer when you need guaranteed
per-operation cost with no amortised spikes.

## Choosing

| Situation | Use |
|---|---|
| General purpose, unbounded | **head-index array** |
| Known maximum, want backpressure | **ring buffer** |
| No amortised spikes allowed, unbounded | **linked list** |
| Tiny, short-lived, n in the dozens | `push`/`shift` is fine — say so and move on |

🔴 **That last row matters.** A queue of five UI animations does not need a class. The rule is
about queues whose size is decided by load.

## Gotchas

**Symptom:** A queue slows down as it grows
**Cause:** `shift()` is O(n) — draining is O(n²).
**Fix:** A head index, a ring buffer, or a linked list.

**Symptom:** A long-running worker's memory climbs steadily
**Cause:** A head-index queue that never nulls dequeued slots.
**Fix:** `items[head] = undefined` when advancing.

**Symptom:** The backing array grows although `size` stays small
**Cause:** No compaction — `push` extends the tail, the dead prefix is never reclaimed.
**Fix:** `slice(head)` when the dead prefix reaches half the array.

**Symptom:** A ring buffer reports empty when it is full
**Cause:** `head === tail` is both states without a size counter.
**Fix:** Track `size` explicitly.

**Symptom:** Items vanish from a linked queue after it empties
**Cause:** `tail` was not reset to `null` when the last node was removed.
**Fix:** Reset it in `dequeue`.

**Symptom:** An unbounded queue takes the process down under load
**Cause:** No backpressure — producers outpace consumers.
**Fix:** A bounded queue that throws or drops; the bound is the feature.

**Symptom:** `dequeue()` returns `undefined` ambiguously
**Cause:** Empty and a stored `undefined` are indistinguishable.
**Fix:** Check `size` first, or return a sentinel.

## Interview questions

**★ Why can't you use an array as a queue?**
You can, and `shift()` is O(n) because every remaining element reindexes — so draining n items is
O(n²). It is invisible in testing and stalls under production load, which is what makes it the
common version of this bug.

**★ Implement an O(1) queue on an array.**
Keep a head index instead of removing: `push` to enqueue; read `items[head]` and increment to
dequeue. **Null the vacated slot** so items can be collected, and **compact with `slice(head)`**
when the dead prefix reaches half the array — without those two lines it leaks and grows forever.

**★ Why does a ring buffer need a size counter?**
Because `head === tail` describes both "empty" and "full". A size counter distinguishes them; the
alternative is deliberately wasting one slot.

**★ When is a linked-list queue the right choice?**
When you need guaranteed O(1) per operation with no amortised spikes — the array version
occasionally pays an O(n) compaction. The cost is one allocation per item and worse cache
locality, which is why the array usually wins in JavaScript.

**★ What is the bug in most hand-written linked queues?**
Not resetting `tail` to `null` when the last node is dequeued. The next enqueue attaches to a
detached node, so the item is counted but unreachable.

**★ Why is a bounded queue a feature rather than a limitation?**
Because an unbounded queue converts "consumers are too slow" into "the process runs out of
memory". A bound gives you backpressure — throw, drop, or block — which is a decision you can
make deliberately.

**When is `push`/`shift` acceptable?**
When n is small and bounded by something other than load — a handful of UI animations. The
distinction is whether the size is decided by the developer or by production traffic.

---

[Topic index](./README.md) · Next → [02 · Deques and the two-stack queue](./02-deques-and-two-stacks.md)
