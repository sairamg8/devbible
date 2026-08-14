---
title: "05.2 · Deques and the two-stack queue"
sidebar_label: "02 · Deques and two stacks"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-14 against MDN — [`Array.prototype.push()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/push), [`Array.prototype.pop()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/pop), [`Array.prototype.unshift()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/unshift). Documentation-validated; **no timings**.

**A deque is a queue you can also use backwards** — insert and remove at both ends — and the
two-stack queue is the interview puzzle that teaches amortised analysis better than any
explanation of it.

## The two-stack queue

Two stacks, `inbox` and `outbox`. Enqueue pushes to `inbox`. Dequeue pops from `outbox` — and when
`outbox` is empty, pours the whole `inbox` into it, which reverses the order.

```js
class TwoStackQueue {
  #in = [];
  #out = [];

  enqueue(x) { this.#in.push(x); return this; }

  dequeue() {
    if (!this.#out.length) {
      while (this.#in.length) this.#out.push(this.#in.pop());   // reverse, once
    }
    return this.#out.pop();
  }

  peek() {
    if (!this.#out.length) while (this.#in.length) this.#out.push(this.#in.pop());
    return this.#out.at(-1);
  }

  get size() { return this.#in.length + this.#out.length; }
}
```

🔴 **The transfer must only happen when `outbox` is empty.** Pouring early interleaves the two
orders and the queue silently stops being FIFO — the single bug in this problem, and it passes
small tests.

**Why it is amortised O(1):** every element is pushed to `inbox` once, popped from `inbox` once,
pushed to `outbox` once and popped from `outbox` once — **four operations per element over its
whole lifetime**, no matter how the calls interleave. An individual `dequeue` can be O(n); n
dequeues cannot exceed O(n) total.

⚠️ **It is amortised, not worst-case.** One unlucky `dequeue` pays for the whole transfer, which
matters if you have a per-operation latency budget — the same caveat as `push` and as the
head-index queue's compaction.

**Is it useful?** Rarely — the head-index queue is simpler and better. It is worth knowing because
**it is the cleanest demonstration of amortised analysis you will meet**, and because "reverse by
moving between two stacks" recurs elsewhere.

## Deques

Insert and remove at both ends. In JavaScript:

```js
// ❌ the obvious version — unshift and shift are O(n)
const d = [];
d.unshift(x); d.push(y); d.shift(); d.pop();
```

A real deque uses **two indices into one array** (head and tail, growing in both directions), a
**doubly linked list**, or a **ring buffer** with wrap-around at both ends —
[01 · Making dequeue O(1)](./01-making-dequeue-o1.md).

For most JavaScript work, ⚠️ **a plain array used as a deque is fine while n is small**, and the
right answer at scale is a ring buffer, because it is the only one with no allocation per
operation.

## The sliding-window maximum — the deque problem

The problem where a deque is genuinely the answer: the maximum of every window of size k.

```js
function maxSlidingWindow(nums, k) {
  const result = [];
  const deque = [];                              // INDICES, values decreasing

  for (let i = 0; i < nums.length; i++) {
    if (deque.length && deque[0] <= i - k) deque.shift();          // drop out-of-window
    while (deque.length && nums[deque.at(-1)] <= nums[i]) deque.pop();  // drop dominated
    deque.push(i);
    if (i >= k - 1) result.push(nums[deque[0]]);
  }
  return result;
}
```

Three things make it work, and they are the answer to "explain your solution":

- **Indices, not values** — so the front can be tested against the window bound.
- **The front is always the window's maximum**, because anything smaller that arrived earlier was
  discarded when a larger element appeared.
- **O(n) overall**: each index enters once and leaves once, exactly the monotonic-stack argument
  from [04 · 02 · Monotonic stacks](../04-stack/02-monotonic-stacks.md).

⚠️ **`deque.shift()` here is O(n) on a plain array**, so this "O(n)" solution is technically
O(n·k) in the worst case as written. With a real deque (two indices or a ring buffer) it is
genuinely O(n). **Say this in an interview** — noticing that your own data structure is the
bottleneck is a strong signal, and the fix is a head index exactly as in the previous chunk.

## BFS — where queues actually earn their keep

```js
function bfs(start, neighbours) {
  const seen = new Set([start]);
  const queue = [start];
  let head = 0;                                  // 🔴 head index, not shift()

  while (head < queue.length) {
    const node = queue[head++];
    for (const next of neighbours(node)) {
      if (seen.has(next)) continue;              // mark on ENQUEUE
      seen.add(next);
      queue.push(next);
    }
  }
  return seen;
}
```

Two details that are the actual interview content:

- 🔴 **Mark as seen when you *enqueue*, not when you dequeue.** Marking on dequeue lets a node be
  enqueued several times before it is first processed, which in a dense graph is an exponential
  blow-up in the queue rather than a small inefficiency.
- **The head index again.** BFS on a large graph is the canonical place the `shift()` mistake
  costs real time, and it is why this whole topic exists.

**BFS gives shortest paths in an unweighted graph** precisely because the queue processes nodes in
distance order — level by level. Swap the queue for a stack and you have DFS, which does not.

## Gotchas

**Symptom:** A two-stack queue returns items out of order
**Cause:** The inbox was poured into a non-empty outbox.
**Fix:** Transfer only when the outbox is empty.

**Symptom:** One `dequeue` occasionally takes much longer than the rest
**Cause:** That call paid for the whole transfer — it is amortised, not worst-case.
**Fix:** Expected; use a linked list if per-operation latency is bounded.

**Symptom:** A deque built on `unshift`/`shift` is slow
**Cause:** Both are O(n).
**Fix:** Two indices, a ring buffer, or a doubly linked list.

**Symptom:** A sliding-window solution described as O(n) is not
**Cause:** `deque.shift()` on a plain array is O(n).
**Fix:** A head index or ring buffer — and say so, rather than claiming the bound.

**Symptom:** BFS revisits nodes and the queue explodes
**Cause:** Nodes marked as seen on dequeue rather than on enqueue.
**Fix:** Mark on enqueue.

**Symptom:** BFS on a large graph is quadratic
**Cause:** `queue.shift()`.
**Fix:** A head index.

**Symptom:** BFS returns a path that is not shortest
**Cause:** A stack was used, making it DFS.
**Fix:** A queue — level order is what gives the shortest path.

## Interview questions

**★ Implement a queue with two stacks.**
`inbox` and `outbox`. Enqueue pushes to `inbox`; dequeue pops from `outbox`, and when `outbox` is
empty pours the whole `inbox` into it, reversing the order. **The transfer must happen only when
`outbox` is empty** — pouring early interleaves the orders and it stops being FIFO.

**★ Why is that amortised O(1)?**
Each element is pushed and popped exactly once on each stack — four operations over its lifetime,
regardless of call interleaving. An individual dequeue can be O(n); n dequeues cost O(n) in total.

**★ Amortised or worst-case — does the difference matter here?**
Yes if you have a per-operation latency budget: one unlucky dequeue pays for the entire transfer.
A linked-list queue gives true per-operation O(1) at the cost of an allocation per item.

**★ Solve sliding-window maximum, and critique your own solution.**
A deque of **indices** with decreasing values: drop the front when it leaves the window, pop from
the back anything the new element dominates, push the index, and read the front as the maximum.
Each index enters and leaves once, so O(n) — **except that `shift()` on a plain array is O(n)**,
so as written it is not. A head index or ring buffer makes the bound real.

**★ In BFS, when do you mark a node as seen?**
On **enqueue**. Marking on dequeue allows the same node to be enqueued many times before it is
first processed, which blows the queue up on a dense graph.

**★ Why does BFS find shortest paths and DFS not?**
Because a queue processes nodes in distance order, level by level, so the first time you reach a
node is by a shortest path. A stack dives deep first and can reach a node by a long path before a
short one.

**When would you actually use a two-stack queue in production?**
Essentially never — the head-index array is simpler and better. Its value is that it is the
clearest demonstration of amortised analysis, which is why it is an interview staple rather than
a library.

---

← [01 · Making dequeue O(1)](./01-making-dequeue-o1.md) · [Topic index](./README.md) ·
Next → [Phase index](../README.md)
