---
title: "05 · Queue and deque"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-14 against MDN — [`Array.prototype.shift()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/shift), [`Array.prototype.push()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/push), [`Array.prototype.pop()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/pop), [`Array.prototype.slice()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/slice). Documentation-validated; **no timings**.

**JavaScript gives you a stack for free and makes you build a queue.** `shift()` is O(n), so
`push`/`shift` drains in O(n²) — the most common "it worked in testing" performance bug in the
language, because a queue's size is decided by production load rather than by the developer.

## Chunks

| # | Chunk | Covers |
|---|---|---|
| 1 | **[Making dequeue O(1)](./01-making-dequeue-o1.md)** | Why `[].shift()` disqualifies the plain array; **the head-index queue**, with the two load-bearing lines people omit — 🔴 **nulling the vacated slot** (or a long-running worker leaks every message it has processed) and 🔴 **compacting** (or the array grows forever while `size` stays small); the **ring buffer** and why it needs a separate size counter, plus **the bound as a feature — backpressure**; the **linked-list queue** and its dangling-`tail` bug; and a table for choosing, ending with "n in the dozens? `shift` is fine" |
| 2 | **[Deques and the two-stack queue](./02-deques-and-two-stacks.md)** | The two-stack queue, its single bug (**transfer only when the outbox is empty**), and why four operations per element makes it amortised O(1) — the clearest demonstration of amortised analysis you will meet; deques and why `unshift`/`shift` are both wrong; **sliding-window maximum**, with the instruction to 🔴 **critique your own solution** because `deque.shift()` on a plain array breaks the O(n) claim; and **BFS**, where marking on *enqueue* rather than dequeue is the difference between linear and an exploding queue |

## The three sentences to keep

1. **`push`/`shift` is O(n²) to drain.** A head index fixes it in two extra lines — null the slot,
   and compact.
2. **Amortised is not worst-case.** The two-stack queue and the compaction both pay for a run of
   cheap operations with one expensive one.
3. **In BFS, mark on enqueue.** Marking on dequeue lets the same node enter the queue many times.

## Phase gate

You are done with this topic when you can write an O(1) queue including the leak and growth fixes,
say why a ring buffer needs a size counter, explain the two-stack queue's amortised bound in terms
of operations per element, and spot that a "linear" sliding-window solution is not linear when the
deque is a plain array.

## Where this connects

- [01 · Dynamic arrays](../01-dynamic-arrays/README.md) — where the `shift` cost comes from
- [04 · Stack](../04-stack/README.md) — the same problem at the cheap end, and the monotonic-stack bound this reuses
- [Phase 13 · 01 · Big-O notation](../../phase-13-complexity/01-big-o/README.md) — amortised versus average versus worst
- [Phase 7 · Asynchronous JavaScript](../../phase-7-async/README.md) — the task queues the event loop is built on

---

Start → [01 · Making dequeue O(1)](./01-making-dequeue-o1.md)
