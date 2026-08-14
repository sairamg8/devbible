---
title: "06.1 · The BFS template"
sidebar_label: "01 · The template"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-14 — algorithmic material at the standard treatment; JavaScript specifics against MDN ([`Map`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map), [`Set`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Set), [`Array.prototype.shift()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/shift)). Documentation-validated; **no timings**.

**BFS explores in distance order**, which is why it — and not DFS — gives shortest paths in an
unweighted graph. Everything else about it follows from that one property.

## The template

```js
function bfs(start, neighbours) {
  const seen = new Set([start]);         // 🔴 mark on ENQUEUE
  const queue = [start];
  let head = 0;                          // 🔴 head index, not shift()

  while (head < queue.length) {
    const node = queue[head++];

    for (const next of neighbours(node)) {
      if (seen.has(next)) continue;
      seen.add(next);
      queue.push(next);
    }
  }
  return seen;
}
```

Two lines carry the correctness and the complexity, and both are commonly wrong:

🔴 **Mark as seen on *enqueue*, not on dequeue.** Marking on dequeue lets the same node be enqueued
once per incoming edge before it is first processed. On a dense graph that is a queue containing
O(E) copies of the same nodes — not a small inefficiency but a different complexity class, and the
memory goes first.

🔴 **A head index, not `queue.shift()`.** `shift` is O(n)
([Phase 14 · 01](../../phase-14-data-structures/01-dynamic-arrays/01-the-real-cost-table.md)), so
the "O(V + E)" solution is O(V²) as written. BFS on a large graph is the canonical place this
mistake costs real time.

**Complexity: O(V + E)** — every vertex is enqueued once and every edge examined once.

## Shortest path, and returning it

Distance comes free; the path needs a parent map.

```js
function shortestPath(start, target, neighbours) {
  if (start === target) return [start];

  const parent = new Map([[start, null]]);
  const queue = [start];
  let head = 0;

  while (head < queue.length) {
    const node = queue[head++];

    for (const next of neighbours(node)) {
      if (parent.has(next)) continue;              // parent map doubles as `seen`
      parent.set(next, node);

      if (next === target) {                        // ⚠️ check on enqueue, not dequeue
        const path = [];
        for (let n = target; n !== null; n = parent.get(n)) path.push(n);
        return path.reverse();
      }
      queue.push(next);
    }
  }
  return null;                                      // unreachable
}
```

**The parent map replaces the `seen` set** — one structure, two jobs, and it is what makes the path
reconstructible.

⚠️ **Checking for the target on enqueue rather than on dequeue** returns one full level earlier. It
is correct either way, and it is worth knowing that it is the difference between examining the
target's whole level and stopping immediately.

**Why the first time you reach a node is by a shortest path:** BFS processes nodes in
non-decreasing distance order, so the first arrival is via the fewest edges. 🔴 **That argument
breaks the moment edges have weights** — then you need Dijkstra, which is BFS with a priority
queue in place of the plain one.

## Level-order — when the level number matters

Two ways, and the second is better:

```js
// snapshot the level size before processing it
while (head < queue.length) {
  const levelSize = queue.length - head;
  for (let i = 0; i < levelSize; i++) {
    const node = queue[head++];
    …
  }
  depth++;
}
```

🔴 **`const levelSize = queue.length - head` must be captured *before* the inner loop**, because
the loop pushes onto the same queue. Reading `queue.length` inside the loop mixes the next level
into the current one, and the depth count is silently wrong.

**The alternative is storing the distance with each node** — `queue.push([next, dist + 1])` — which
is simpler and allocates a pair per node. For "how many levels" it is fine; for "process each level
as a group" the snapshot version is the one you want.

**This is how you answer:** minimum number of moves, levels of a tree, "how many steps to reach X",
word-ladder length, rotting-oranges time.

## Multi-source BFS

Seed the queue with **all** starting points at once, and the first time each node is reached is its
distance to the *nearest* source.

```js
const queue = [...sources];
const dist = new Map(sources.map((s) => [s, 0]));
let head = 0;
```

🔴 **This is the trick that turns "for each cell, find the nearest X" from O(V²) into O(V + E).**
Running a separate BFS from each cell is the naive answer; one BFS from all sources simultaneously
is the intended one, and it is a single-line change. Nearest-gate, rotting oranges, and
distance-to-nearest-water are all this.

## Bidirectional BFS

When both ends are known, search from both and stop when the frontiers meet. It explores roughly
**b^(d/2) + b^(d/2)** nodes instead of **b^d** — a square-root improvement in the frontier size,
which is dramatic on large branching factors.

⚠️ **It is harder than it looks:** you must expand the *smaller* frontier each step, handle the
meeting point carefully, and it only works when the graph is traversable in both directions.
Mention it when asked "can you do better?"; reach for it only when the plain version is genuinely
too slow.

## Gotchas

**Symptom:** BFS uses far more memory than expected
**Cause:** Nodes marked as seen on dequeue, so each is enqueued once per incoming edge.
**Fix:** Mark on enqueue.

**Symptom:** BFS on a large graph is quadratic
**Cause:** `queue.shift()` is O(n).
**Fix:** A head index.

**Symptom:** The shortest path returned is not shortest
**Cause:** A stack was used — that is DFS.
**Fix:** A queue. Level order is what guarantees the shortest path.

**Symptom:** Level counts are wrong
**Cause:** `queue.length` read inside the inner loop, after new nodes were pushed.
**Fix:** Snapshot the level size before the loop.

**Symptom:** BFS gives wrong answers on a weighted graph
**Cause:** The "first arrival is shortest" argument requires uniform edge costs.
**Fix:** Dijkstra — BFS with a priority queue.

**Symptom:** "Nearest X for every cell" is O(V²)
**Cause:** A separate BFS per cell.
**Fix:** Multi-source BFS — seed the queue with every X.

**Symptom:** `neighbours(node)` throws for an isolated node
**Cause:** Nodes with no edges are absent from the adjacency map.
**Fix:** `adj.get(node) ?? []`.

**Symptom:** BFS never terminates
**Cause:** No `seen` set, so a cycle revisits forever.
**Fix:** Mark every node on enqueue.

## Interview questions

**★ Write BFS and name the two lines that matter.**
A queue, a `seen` set, and a loop. The two lines are **marking on enqueue** (marking on dequeue
lets a node enter the queue once per incoming edge) and **using a head index instead of
`shift()`** (which is O(n) and makes the whole thing quadratic).

**★ Why does BFS find shortest paths and DFS not?**
BFS processes nodes in non-decreasing distance order, so the first time it reaches a node is via
the fewest edges. DFS dives deep and can reach a node by a long path before a short one.

**★ How do you return the path, not just the distance?**
A `parent` map, which also serves as the `seen` set. Walk back from the target through it and
reverse.

**★ How do you track levels?**
Snapshot `queue.length - head` **before** processing the level — reading it inside the loop mixes
in the nodes just pushed. Alternatively store the distance alongside each node.

**★ "For every cell, find the distance to the nearest gate" — how?**
Multi-source BFS: seed the queue with every gate at distance 0 and run once. The first arrival at
each cell is its distance to the nearest source. Running a BFS per cell is the O(V²) version.

**★ When does BFS stop being the right answer?**
When edges have weights — the "first arrival is shortest" argument depends on uniform cost, and
you need Dijkstra (BFS with a priority queue). Also when the state space is too large to enumerate,
where bidirectional search or A\* helps.

**What is bidirectional BFS worth?**
Roughly a square-root reduction in the frontier — b^(d/2) twice instead of b^d. It requires a
known target, a reversible graph, and expanding the smaller frontier each step, so it is a
"can you do better?" answer rather than a default.

---

[Topic index](./README.md) · Next → [02 · Grids and state spaces](./02-grids-and-state-spaces.md)
