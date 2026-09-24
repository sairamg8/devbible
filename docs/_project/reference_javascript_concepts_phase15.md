---
name: devbible-javascript-concepts-phase15
description: Load-bearing claims and sources for JavaScript phase 15 — algorithmic patterns
metadata:
  type: reference
---

*Child of [[devbible-javascript-concepts]]. Open when working on phase 15 or any DSA phase.*

Provenance: **documentation-validated**. The algorithms are standard results; every
JavaScript-specific claim is checked against MDN. 🔴 **No page prints a timing.**

Phase 15 has **5 Master topics** — 01, 02, 03, 04 and **06** (topic 05, recursion, is Understand
and deferred). ✅ **All five done** (commit `0c6ec22`). The phase gate is *"name the pattern before
writing code"*, so **every topic ends with a recognition rule**, not just a template.

## Topic 01 · Two pointers
- 🔴 **The discard argument** is the correctness proof: when the sum is too small, `arr[lo]` cannot
  pair with *anything* remaining. It **requires sorted input** — that is the precondition to state.
- 🔴 **Unsorted two-sum is a hash-map problem, not two pointers** — sorting destroys the indices
  the question asks for. This is the classic wrong answer.
- Three-sum needs **three** duplicate skips (anchor, lo, hi). `[...nums].sort((a,b)=>a-b)` — copy
  because `sort` mutates, comparator because the default is **lexicographic** (`[1,10,9]`).
- Palindromes: 3 JS caveats — UTF-16 code units (spread first), `normalize("NFC")`,
  `toLowerCase` is locale-independent (Turkish ı).
- Read/write pointers: 🔴 **`splice` in a loop is a correctness bug (skipped elements) before a
  performance one (O(n²))**; iterate backwards if you must. `arr.length = write` is the forgotten
  truncation. Dedupe compares against `arr[write - 1]`, **not** `read - 1`.
- Floyd: the gap changes by exactly one per step so it must reach zero; `while (fast?.next)` covers
  both terminating cases.
- Merge: `<=` is stability; **both** drain loops required.

## Topic 02 · Sliding window
- The template + **four blanks** (what it tracks / what makes it invalid / what you record /
  max or min). 🔴 **Max records after the shrink loop; min records INSIDE it.**
- O(n) because `left` only advances — say it before being asked.
- Longest-unique: ⚠️ **`lastSeen.get(ch) >= left`** or `left` moves backwards.
- Minimum-window: 🔴 **let counts go negative** and track a single `missing` counter — that is what
  keeps it O(n) instead of O(n · alphabet).
- Counting: 🔴 **`total += right - left + 1`**; ⚠️ **`counts.delete` at zero** or `counts.size` lies.
- "Exactly k" = `atMost(k) - atMost(k-1)` — no direct window, validity is not monotonic.
- 🔴 **Where it stops: negative numbers break sum-based windows SILENTLY** (shrinking no longer
  reduces the sum) → prefix sums + hash map. Also non-contiguous, non-incremental, products with
  zeros.
- Window maxima need a monotonic deque — ⚠️ **and that deque must not use `shift()`**.
- Rate limiter as a sliding log: honest note that it costs one timestamp per request.

## Topic 03 · Binary search
- 🔴 **Why it is hard: three independent binary choices = eight combinations, two correct**, and
  the wrong ones fail only at boundaries.
- One template: half-open `[lo, hi)`, `hi = arr.length`, `while (lo < hi)`, `hi = mid`.
- 🔴 **`upperBound` differs from `lowerBound` by one character** (`<` → `<=`); the six-question
  table, including **counting occurrences in O(log n)** as `upper - lower`.
- 🔴 **Binary search is not automatically a win** — the enabling sort is O(n log n), more than the
  scan. Pays for repeated searches (= a database index).
- Rotated: decide **which half is sorted**, not "is target > mid"; duplicates degrade to O(n).
- 🔴 **`lo + ((hi - lo) >> 1)` — in JS the hazard is not C overflow but that `>>` coerces to
  32-bit SIGNED**, so `(lo+hi)` above 2³¹−1 goes negative. Irrelevant for arrays, **critical for
  answer ranges**.
- **Searching over an answer**: only requirement is a **monotonic predicate**. Ship-capacity
  worked example, bounds `max(weights)`..`sum(weights)`, complexity **O(n log(sum))**.
  Three recognition signals (min/max value asked; a candidate is easy to check; the check is
  monotonic).
- ⚠️ Above `MAX_SAFE_INTEGER`, `mid + 1 === mid` → infinite loop.
- ⚠️ **`Math.max(...arr)` throws `RangeError` on large arrays** (spread = one argument per
  element).
- Real-valued: 🔴 **fixed iteration count (100 halvings), not an epsilon tolerance** — a
  tolerance loop can spin forever; `Number.EPSILON` is a *relative* bound.

## Topic 04 · Hash-map patterns
- Two-sum: 🔴 **check the complement BEFORE storing**, or an element pairs with itself
  (`twoSum([3,5],6)` → `[0,0]`).
- **Complement lookup** as the general reframing, with the family table.
- Seen-sets; SameValueZero → objects by reference; composite string keys collide on the separator.
- **Prefix sums + count map**: 🔴 **seed with `new Map([[0,1]])`** for the empty prefix, or every
  subarray starting at index 0 is missed. Handles **negative numbers**, unlike sliding windows.
- Comparison table vs two pointers and sliding window; **the only real cost is O(n) memory**, and
  an explicit O(1)-space constraint is the interviewer steering elsewhere.
- Signatures: ⚠️ **`counts.join("")` without a separator collides** (`[1,11]` vs `[11,1]`).
  🔴 **Canonicalisation is the hard part** (reduce fractions, normalise sign, round floats).
  ⚠️ **`JSON.stringify` depends on key insertion order** → a bad signature unless keys are sorted.
- 🔴 **`new Map(items.map(i => [i.id, i]))` — the most useful line in application JS.** Two
  failure modes: duplicate keys silently lose records; a stale index returns a **wrong** answer.
- Adjacency lists: ⚠️ **isolated nodes never appear** → `adj.get(n) ?? []`.

## Topic 06 · BFS
- 🔴 **Two lines carry everything: mark on ENQUEUE** (on dequeue → O(E) copies in the queue, a
  different complexity class) **and a head index, not `shift()`** (O(n) → the "O(V+E)" solution is
  quadratic).
- Shortest path via a **parent map that doubles as `seen`**; checking the target on enqueue stops
  one level early.
- 🔴 **"First arrival is shortest" depends on uniform edge cost** — weighted → Dijkstra (BFS with
  a priority queue).
- Level order: ⚠️ **snapshot `queue.length - head` before the inner loop**, or the next level mixes
  in.
- 🔴 **Multi-source BFS**: seed all sources; turns "nearest X for every cell" from O(V²) to O(V+E)
  in a one-line change.
- Bidirectional: ~b^(d/2) twice instead of b^d; needs a known target, a reversible graph, and
  expanding the smaller frontier — a "can you do better?" answer, not a default.
- Grids: 🔴 **bounds BEFORE the cell read** (`grid[nr]` is `undefined` off the edge); direction
  vectors; ⚠️ **`new Array(rows).fill(new Array(cols))` shares ONE row object** → use
  `Array.from({length}, () => …)`; encode coordinates as `r * cols + c` (**cols**, not rows).
- 🔴 **State-space BFS — a node is any state, an edge any legal move**, neighbours generated not
  looked up. Six-problem table (word ladder, lock, knight, jump game, sliding puzzle, water jug).
  ⚠️ **The state must be a VALUE** — objects compare by reference in a `Set`, so serialise.
- Flood fill: BFS vs DFS is a real choice — DFS is shorter, BFS avoids a `RangeError` on large
  regions and is required when distance matters.

## Build trap hit this phase

🔴 **An MDX build failure, not a broken link: `` `seen.add(`${r},${c}`)` `` .** A backtick nested
inside a single-backtick code span terminates it early, so `{r}` lands in prose and **MDX parses it
as a JSX expression** → `ReferenceError: r is not defined`, and the build **fails** (exit non-zero,
unlike broken links which only warn). Fix: wrap in **double** backticks. Worth remembering because
grep for broken links will never find it.
