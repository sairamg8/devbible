---
title: "04 · Stack"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-14 against MDN — [`Array.prototype.push()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/push), [`Array.prototype.pop()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/pop), [`Array.prototype.at()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/at), [`RangeError`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/RangeError). Documentation-validated; **no timings**.

**In JavaScript a stack is an array** — `push` and `pop` at the cheap end, O(1), done. Which means
this topic is not about the implementation; it is about the five problems a stack exists to solve
and how to recognise them.

## Chunks

| # | Chunk | Covers |
|---|---|---|
| 1 | **[The structure](./01-the-structure.md)** | The trivial implementation and the one ambiguity in it (`pop()` on empty returns `undefined`); the **call stack as the same idea** — why traces read bottom-up, why recursion depth is space, and 🔴 **why tail-call rewriting does not save you** (proper tail calls are specified, unimplemented in most engines); the mechanical recursion→iteration conversion, with ⚠️ **the reversed push** everyone forgets; bracket matching and its two easy bugs; and undo/redo, where 🔴 **clearing the redo stack is the whole design** |
| 2 | **[Monotonic stacks and expressions](./02-monotonic-stacks.md)** | The pattern that turns a family of O(n²) problems into O(n) — 🔴 **push indices, not values**, and why the inner `while` is still linear (each index pushed once, popped once); **the recognition rule** — if the brute force is "for each element, scan until a comparison holds", it is a monotonic stack — with the six-problem family table; RPN evaluation and ⚠️ **the operand-order bug everyone writes once**, plus `trunc` vs `floor`; shunting-yard as deferred operators; and where stacks show up outside interviews |

## The three sentences to keep

1. **A stack is an array; the skill is recognising the problems.** Nesting, deferral and
   backtracking are all stack-shaped.
2. **Deep recursion needs an explicit stack, not a tail call.** Engines have not shipped proper
   tail calls.
3. **Monotonic stack: push indices, and the inner `while` is still O(n)** because each index is
   pushed once and popped at most once.

## Phase gate

You are done with this topic when you can convert any recursion to an explicit stack including the
child-ordering detail, write a bracket matcher without either classic bug, recognise a monotonic
stack from the brute-force description, and justify its linear bound to someone who sees nested
loops.

## Where this connects

- [01 · Dynamic arrays](../01-dynamic-arrays/README.md) — why `push`/`pop` are the cheap end
- [05 · Queue and deque](../05-queue-and-deque/README.md) — the same problem at the other end
- [Phase 13 · 01 · Big-O notation](../../phase-13-complexity/01-big-o/README.md) — total-work bounds, and recursion depth as space
- [Phase 9 · The DOM](../../phase-9-dom/README.md) — the deep trees that overflow a recursive walk

---

Start → [01 · The structure](./01-the-structure.md)
