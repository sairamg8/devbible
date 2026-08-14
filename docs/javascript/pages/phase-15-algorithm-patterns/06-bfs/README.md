---
title: "06 · BFS"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-14 — algorithmic material at the standard treatment; JavaScript specifics against MDN ([`Set`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Set), [`Map`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map), [`Array.from()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/from), [`Array.prototype.shift()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/shift)). Documentation-validated; **no timings**.

**BFS explores in distance order**, which is the entire reason it — and not DFS — gives shortest
paths in an unweighted graph. Two lines of the template carry both the correctness and the
complexity, and both are commonly written wrong.

## Chunks

| # | Chunk | Covers |
|---|---|---|
| 1 | **[The BFS template](./01-the-template.md)** | The template, and the two lines that matter — 🔴 **mark on enqueue** (marking on dequeue puts O(E) copies in the queue) and 🔴 **a head index, not `shift()`** (which makes the "O(V+E)" solution quadratic); shortest path via a **parent map that doubles as `seen`**, and checking the target on enqueue to stop a level early; why the first arrival is shortest, **and why that argument dies with weighted edges**; level-order, where ⚠️ **the level size must be snapshotted before the inner loop**; 🔴 **multi-source BFS**, the one-line change that turns "nearest X for every cell" from O(V²) into O(V+E); and bidirectional search as the "can you do better?" answer |
| 2 | **[Grids and state spaces](./02-grids-and-state-spaces.md)** | A grid as a graph you never build; 🔴 **bounds before the cell read**, the direction-vector array, and ⚠️ **`new Array(rows).fill(new Array(cols))` sharing one row object**; coordinate encoding as `r * cols + c`; 🔴 **state-space BFS — a node is any state, an edge any legal move** — with the six problems that are secretly this, and the requirement that ⚠️ **a state must be a *value*** because `Set` uses SameValueZero; and flood fill, where BFS is chosen over DFS for distance or to avoid a stack overflow |

## The three sentences to keep

1. **Mark on enqueue, and use a head index.** Those two lines are the difference between O(V+E)
   and quadratic-with-a-memory-problem.
2. **The first arrival is shortest only because every edge costs the same.** Weighted edges mean
   Dijkstra.
3. **A node can be any state.** Once the state is a serialisable value, BFS solves word ladders,
   locks and puzzles the same way it solves grids.

## Phase gate

You are done with this topic when you can write BFS with both correctness lines from memory,
return the path rather than just the distance, count levels without the snapshot bug, recognise a
state-space problem, and say precisely why BFS stops working on a weighted graph.

## Where this connects

- [04 · Hash-map patterns](../04-hash-map-patterns/README.md) — building the adjacency list this traverses
- [Phase 14 · 05 · Queue and deque](../../phase-14-data-structures/05-queue-and-deque/README.md) — why `shift()` is the wrong queue
- [Phase 14 · 04 · Stack](../../phase-14-data-structures/04-stack/README.md) — swap the queue for a stack and you have DFS
- [Phase 13 · 02 · The complexity classes](../../phase-13-complexity/02-complexity-classes/README.md) — why an exponential state space is a wall, not a slowdown

---

Start → [01 · The BFS template](./01-the-template.md)
