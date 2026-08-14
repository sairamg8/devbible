---
title: "06.2 · Grids and state spaces"
sidebar_label: "02 · Grids and state spaces"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-14 — algorithmic material at the standard treatment; JavaScript specifics against MDN ([`Set`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Set), [`Map`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map), [`Array.from()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/from)). Documentation-validated; **no timings**.

**A grid is a graph you did not have to build**, and once you see that, half the "matrix" problems
are BFS with a different `neighbours` function. The other half of this chunk is the harder idea:
the nodes do not have to be places.

## Grids

```js
const DIRS = [[0, 1], [1, 0], [0, -1], [-1, 0]];        // 4-directional

function bfsGrid(grid, startR, startC) {
  const rows = grid.length, cols = grid[0].length;
  const seen = Array.from({ length: rows }, () => new Array(cols).fill(false));

  const queue = [[startR, startC]];
  seen[startR][startC] = true;
  let head = 0, steps = 0;

  while (head < queue.length) {
    const levelSize = queue.length - head;

    for (let i = 0; i < levelSize; i++) {
      const [r, c] = queue[head++];

      for (const [dr, dc] of DIRS) {
        const nr = r + dr, nc = c + dc;
        if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) continue;   // bounds FIRST
        if (seen[nr][nc] || grid[nr][nc] === "#") continue;
        seen[nr][nc] = true;
        queue.push([nr, nc]);
      }
    }
    steps++;
  }
  return steps;
}
```

🔴 **Check bounds before reading the cell.** `grid[nr]` is `undefined` when `nr` is out of range,
and `undefined[nc]` throws. Ordering the two conditions the other way is the single most common
grid bug, and it fails only at the edges — which small test cases often avoid.

🔴 **A direction-vector array beats four copy-pasted blocks.** Switching to 8-directional is adding
four pairs; with copy-pasted blocks it is four more chances to typo a sign.

⚠️ **`new Array(rows).fill(new Array(cols).fill(false))` shares one row object** — every row is the
*same* array, so marking one cell marks a whole column's worth. `Array.from({length: rows}, () =>
…)` builds a distinct row each time. This is the classic 2-D array bug in JavaScript and it is
worth the extra characters every time.

**Marking `seen` on enqueue matters even more on grids**, because a cell typically has four
neighbours that would each enqueue it.

**Coordinates as `Set` keys:** ``seen.add(`${r},${c}`)`` is fine and allocates a string per cell;
`seen.add(r * cols + c)` is a number and avoids the allocation. Either is correct — the encoded
integer is the one to reach for on large grids, and it needs `cols`, not `rows`, as the multiplier.

## State-space BFS

🔴 **The idea that unlocks the hardest BFS problems: a "node" is any state, and an "edge" is any
legal move.** The graph is implicit — you never build it, you generate neighbours on demand.

```js
// fewest operations to turn `start` into `target`
function fewestOps(start, target, moves) {
  const seen = new Set([start]);
  const queue = [start];
  let head = 0, steps = 0;

  while (head < queue.length) {
    const levelSize = queue.length - head;

    for (let i = 0; i < levelSize; i++) {
      const state = queue[head++];
      if (state === target) return steps;

      for (const next of moves(state)) {          // generate, do not look up
        if (seen.has(next)) continue;
        seen.add(next);
        queue.push(next);
      }
    }
    steps++;
  }
  return -1;
}
```

**The problems that are secretly this:**

| Problem | State | Move |
|---|---|---|
| Word ladder | the current word | change one letter to a dictionary word |
| Open the lock | the four-digit code | turn one wheel one notch |
| Minimum knight moves | the square | eight knight jumps |
| Jump game (fewest jumps) | the index | any reachable index |
| Sliding puzzle | the board as a string | swap the blank with a neighbour |
| Water jug | the pair of volumes | fill, empty or pour |

⚠️ **The state must be a *value* for `Set` membership to work.** Objects and arrays compare by
reference under SameValueZero
([Phase 14 · 02](../../phase-14-data-structures/02-hash-maps-and-sets/01-using-the-built-ins.md)),
so a board must be serialised to a string or number before it goes in the `seen` set. Forgetting
this produces a BFS that revisits everything and never terminates on a cyclic state space.

⚠️ **The state space can be enormous.** A 3×3 sliding puzzle has 181,440 reachable states —
fine. A 4×4 has over 10¹³ — not. Bounding the state space, or noticing that you cannot, is part of
the answer.

## Flood fill and connected components

```js
function countIslands(grid) {
  let count = 0;
  for (let r = 0; r < grid.length; r++) {
    for (let c = 0; c < grid[0].length; c++) {
      if (grid[r][c] !== "1") continue;
      count++;
      bfsFrom(grid, r, c);          // marks the whole component as visited
    }
  }
  return count;
}
```

Still O(V + E) overall, because the outer loops visit each cell once and each BFS only touches
unvisited cells.

⚠️ **Mutating the input grid to mark visited (`grid[r][c] = "0"`) saves memory and destroys the
caller's data.** It is a legitimate choice — say you are making it, or copy first.

**BFS or DFS?** For *connectivity* — "how many components", "fill this region" — either works, and
DFS is shorter to write. Use BFS when the **distance** matters, and when the region can be large
enough that recursion would overflow the call stack
([Phase 14 · 04](../../phase-14-data-structures/04-stack/README.md)).

## Gotchas

**Symptom:** `TypeError: Cannot read properties of undefined`
**Cause:** The cell was read before the bounds were checked.
**Fix:** Bounds first, always.

**Symptom:** Marking one cell marks several
**Cause:** `new Array(rows).fill(new Array(cols))` shares one row object.
**Fix:** `Array.from({length: rows}, () => new Array(cols).fill(false))`.

**Symptom:** A grid BFS is much slower than expected
**Cause:** `shift()`, or marking `seen` on dequeue so each cell is enqueued up to four times.
**Fix:** Head index, and mark on enqueue.

**Symptom:** State-space BFS never terminates
**Cause:** States are objects or arrays, which compare by reference in a `Set`.
**Fix:** Serialise each state to a string or number.

**Symptom:** State-space BFS runs out of memory
**Cause:** The state space is exponential.
**Fix:** Bound it, prune, search bidirectionally, or accept that BFS is the wrong tool.

**Symptom:** Coordinate keys collide
**Cause:** `r * rows + c` instead of `r * cols + c`.
**Fix:** Multiply by the number of **columns**.

**Symptom:** The caller's grid is modified
**Cause:** Visited cells were marked in place.
**Fix:** A separate `seen` array, or copy — and say which.

**Symptom:** A deep flood fill throws `RangeError`
**Cause:** Recursive DFS on a large region.
**Fix:** BFS with an explicit queue.

## Interview questions

**★ How is a grid a graph?**
Each cell is a node and each in-bounds, non-blocked neighbour is an edge. You never build the
adjacency structure — the direction vectors generate it. That is why grid problems are BFS with a
different `neighbours` function.

**★ What is the most common grid bug?**
Reading `grid[nr][nc]` before checking bounds. `grid[nr]` is `undefined` off the edge and indexing
it throws — and it only fails at the borders, which small tests often miss.

**★ Why is `new Array(3).fill(new Array(3).fill(0))` wrong?**
All three rows are the **same** array object, so writing one cell appears to write a whole column.
`Array.from({length: 3}, () => new Array(3).fill(0))` builds distinct rows.

**★ What is state-space BFS?**
BFS where a node is any state and an edge is any legal move, with neighbours generated on demand
rather than looked up. Word ladder, open-the-lock, minimum knight moves and sliding puzzles are all
this — the graph is implicit.

**★ What must be true of a state for BFS to work on it?**
It must be a **value**, because `Set` membership uses SameValueZero and objects compare by
reference. Serialise boards and tuples to strings or numbers, or the `seen` check never fires.

**★ BFS or DFS for counting islands?**
Either — connectivity does not care about order, and DFS is shorter. Prefer BFS when distance
matters, or when a region could be large enough that recursive DFS overflows the call stack.

**How do you encode grid coordinates as a single key?**
`r * cols + c` — multiply by the number of **columns**, not rows. It avoids the per-cell string
allocation of a template literal, which matters on large grids.

---

← [01 · The template](./01-the-template.md) · [Topic index](./README.md) ·
Next → [Phase index](../README.md)
