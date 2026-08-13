---
title: "Part 4 — DSA and machine coding"
sidebar_label: "4 · DSA & machine coding"
sidebar_position: 4
---

> **Phases 13–17 · 81 topics · 20 Master**
> Data structures and algorithms **in JavaScript specifically**, then the
> "implement it yourself" round that fullstack interviews actually run.

Two things make this track different from a generic DSA course:

1. **Every structure is measured against what JavaScript really gives you.**
   `Array` is not a C array, `Map` is not a `Record`, and `shift` is not `pop`.
2. **Phase 17 is the brief's "custom functions" requirement.** Writing `map`,
   `bind`, `debounce`, `Promise.all` and an `LRU` from an empty file is the round
   most fullstack candidates fail, and it is the fastest way to prove Parts 1–2
   actually landed.

---

## Phase 13 — Complexity and JavaScript's real costs

*10 topics.* Big-O first, then the part most courses skip: what the notation
means once V8 is underneath it.

| Topic | Tier |
|---|---|
| **Big-O notation** — time and space, best/average/worst, dropping constants, and reading a bound straight off a loop nest | <span className="db-tier t-master">Master</span> |
| **The complexity classes you actually meet** — O(1), O(log n), O(n), O(n log n), O(n²), O(2ⁿ), O(n!), with a JavaScript example of each | <span className="db-tier t-master">Master</span> |
| **Choosing a structure from the operations you need** — a decision table keyed on lookup, insert, delete, ordering and iteration | <span className="db-tier t-master">Master</span> |
| **Space complexity and the call stack** — recursion depth counts as space, and the stack limit you will hit | <span className="db-tier t-understand">Understand</span> |
| **What a JavaScript array really is** — packed versus holey elements, the point it degrades into a dictionary, and why `delete arr[i]` is a mistake | <span className="db-tier t-understand">Understand</span> |
| **Object versus `Map` performance** — key coercion, insertion-order iteration, and where each actually wins | <span className="db-tier t-understand">Understand</span> |
| **Amortised analysis** — why `push` counts as O(1) even though the backing store resizes | <span className="db-tier t-understand">Understand</span> |
| **Recursion versus iteration in V8** — stack limits, the absence of tail-call optimisation, and converting a recursion to a loop mechanically | <span className="db-tier t-understand">Understand</span> |
| **Measuring honestly** — `performance.now`, warm-up runs, JIT effects, and why a micro-benchmark usually measures the wrong thing | <span className="db-tier t-understand">Understand</span> |
| **Stating a bound in an interview** — how to justify it, and how to answer "can you do better?" | <span className="db-tier t-know">Know</span> |

**Gate — move on when:** you can explain why building a string with `+=` in a
loop is fine in V8 but concatenating arrays with spread in a loop is O(n²).

---

## Phase 14 — Core data structures in JavaScript

*17 topics.* Each structure gets a working implementation, the operations table,
and the problems it exists to solve. Where a built-in already covers it (`Map`,
`Set`), the page explains the built-in first and implements it only to show the
mechanism.

| Topic | Tier |
|---|---|
| **Dynamic arrays** — the real cost of each operation, and why `shift`/`unshift` disqualify an array as a queue | <span className="db-tier t-master">Master</span> |
| **Hash maps and hash sets** — `Map`/`Set` versus a plain object, how hashing and collisions work in principle, and load factor | <span className="db-tier t-master">Master</span> |
| **Frequency maps and grouping** — the single most useful pattern in interview problems, and `Object.groupBy`/`Map.groupBy` | <span className="db-tier t-master">Master</span> |
| **Stack** — array-backed, and the problems it exists for: bracket matching, undo, expression evaluation, monotonic stacks | <span className="db-tier t-master">Master</span> |
| **Queue and deque** — the two-stack queue, a ring buffer, and a linked-list queue, with the O(1) requirement made explicit | <span className="db-tier t-master">Master</span> |
| **Binary trees** — representation, the four traversals recursively and iteratively, depth versus height, and level-order | <span className="db-tier t-understand">Understand</span> |
| **Singly linked list** — build, insert, delete, reverse (iterative and recursive), find the middle, and Floyd cycle detection | <span className="db-tier t-understand">Understand</span> |
| **Doubly linked list** — and the O(1) LRU cache it makes possible when paired with a `Map` | <span className="db-tier t-understand">Understand</span> |
| **Binary search trees** — insert, search, delete with all three cases, in-order as a sort, and how a BST degenerates into a list | <span className="db-tier t-understand">Understand</span> |
| **Heaps and priority queues** — array representation, sift up/down, `heapify` in O(n), and top-K problems | <span className="db-tier t-understand">Understand</span> |
| **Graphs** — adjacency list versus matrix, directed/undirected, weighted, and building one from an edge list | <span className="db-tier t-understand">Understand</span> |
| **Union-Find (disjoint set)** — path compression, union by rank, and the problems it turns from hard into trivial | <span className="db-tier t-understand">Understand</span> |
| **Tries** — prefix search and autocomplete, insertion and lookup, and the memory trade-off against a `Set` | <span className="db-tier t-understand">Understand</span> |
| **Matrices and grids** — traversal, direction vectors, bounds checking, in-place rotation, and treating a grid as a graph | <span className="db-tier t-understand">Understand</span> |
| **Balanced trees in one page** — AVL and red-black at the level you need to *discuss*, and why you rarely implement one | <span className="db-tier t-know">Know</span> |
| **Bitsets, sparse structures and circular buffers** — the space-constrained tools | <span className="db-tier t-know">Know</span> |
| **Persistent and immutable structures** — structural sharing, and why UI frameworks care about it | <span className="db-tier t-know">Know</span> |

**Gate — move on when:** you can implement a min-heap and an LRU cache from
scratch and state the complexity of every method.

---

## Phase 15 — Algorithmic patterns

*20 topics.* Patterns, not problems. Each row is a template you can recognise
from a problem statement, with two or three worked examples in JavaScript.

| Topic | Tier |
|---|---|
| **Two pointers** — opposite ends and same direction, on sorted arrays, strings and linked lists | <span className="db-tier t-master">Master</span> |
| **Sliding window** — fixed and variable size, and the expand/shrink template that solves most of them | <span className="db-tier t-master">Master</span> |
| **Binary search** — the template that avoids off-by-one, `lowerBound`/`upperBound`, and searching over an *answer* rather than an array | <span className="db-tier t-master">Master</span> |
| **Hash-map patterns** — the two-sum family, anagram grouping, seen-sets, and complement lookup | <span className="db-tier t-master">Master</span> |
| **Recursion and the recursion tree** — designing a base case, tracing calls, and converting a tree walk into a loop | <span className="db-tier t-understand">Understand</span> |
| **BFS** — shortest path in an unweighted graph, level-order traversal, and grid flood fill | <span className="db-tier t-master">Master</span> |
| **Prefix sums and difference arrays** — range queries in O(1), and the 2-D version | <span className="db-tier t-understand">Understand</span> |
| **Sorting algorithms** — insertion and selection for the ideas, merge and quick for real use, and their space costs | <span className="db-tier t-understand">Understand</span> |
| **`Array.prototype.sort` in practice** — comparators, guaranteed stability, sorting objects by several keys, and `localeCompare` for text | <span className="db-tier t-understand">Understand</span> |
| **DFS** — recursive and iterative, cycle detection in directed and undirected graphs, and connected components | <span className="db-tier t-understand">Understand</span> |
| **Backtracking** — permutations, combinations, subsets, N-queens and sudoku, and the pruning that makes it finish | <span className="db-tier t-understand">Understand</span> |
| **Divide and conquer** — merge sort, quickselect, and the master theorem stated informally | <span className="db-tier t-understand">Understand</span> |
| **Topological sort** — Kahn's algorithm and DFS ordering, framed as the dependency graph you already build at work | <span className="db-tier t-understand">Understand</span> |
| **Dijkstra and A\*** — weighted shortest paths with a heap, and when BFS is already enough | <span className="db-tier t-understand">Understand</span> |
| **Greedy** — interval scheduling, jump games, and the honest answer to "how do you know greedy is safe here?" | <span className="db-tier t-understand">Understand</span> |
| **Intervals** — merging, inserting, counting overlaps, and the sweep-line technique | <span className="db-tier t-understand">Understand</span> |
| **Linear-time sorting** — counting, bucket and radix sort, and the constraints that make them legal | <span className="db-tier t-know">Know</span> |
| **String algorithms** — palindromes, the KMP idea, rolling hashes, and why `indexOf` is often the right answer | <span className="db-tier t-know">Know</span> |
| **Bit manipulation** — masks, the single-number trick, enumerating subsets with bits, and JavaScript's 32-bit trap | <span className="db-tier t-know">Know</span> |
| **Maths for interviews** — GCD, the sieve of Eratosthenes, modular arithmetic, and overflow handled with `BigInt` | <span className="db-tier t-know">Know</span> |

**Gate — move on when:** given an unseen problem you can name the pattern before
writing code, and say why the alternative patterns do not fit.

---

## Phase 16 — Dynamic programming and the harder set

*16 topics.* DP gets its own phase because it is the pattern people bounce off,
and because the top-down → bottom-up conversion is mechanical once seen.

| Topic | Tier |
|---|---|
| **What DP is** — overlapping subproblems plus optimal substructure, and how to spot both in a problem statement | <span className="db-tier t-master">Master</span> |
| **Memoization, top-down** — turning a plain recursion into DP mechanically, and choosing the cache key | <span className="db-tier t-master">Master</span> |
| **A problem-solving method** — clarify, examples, brute force, optimise, code, test, state complexity: the loop to run under pressure | <span className="db-tier t-master">Master</span> |
| **Tabulation, bottom-up** — building the table, iteration order, and converting between the two directions | <span className="db-tier t-understand">Understand</span> |
| **1-D DP** — climbing stairs, house robber, coin change, longest increasing subsequence | <span className="db-tier t-understand">Understand</span> |
| **2-D DP** — grid paths, edit distance, longest common subsequence, 0/1 knapsack | <span className="db-tier t-understand">Understand</span> |
| **State design** — the genuinely hard part: naming the state so the transition writes itself | <span className="db-tier t-understand">Understand</span> |
| **Space optimisation** — rolling arrays, and the readability it costs | <span className="db-tier t-understand">Understand</span> |
| **DP on strings** — palindromic substrings, wildcard and regex matching | <span className="db-tier t-understand">Understand</span> |
| **Monotonic stack and monotonic queue** — next greater element, daily temperatures, sliding-window maximum | <span className="db-tier t-understand">Understand</span> |
| **Top-K and streaming** — heap versus quickselect versus sort, and reservoir sampling for unknown lengths | <span className="db-tier t-understand">Understand</span> |
| **Randomised algorithms** — Fisher–Yates shuffle, and why `sort(() => Math.random() - 0.5)` is measurably biased | <span className="db-tier t-understand">Understand</span> |
| **Async-flavoured problems** — task scheduling with dependencies, rate limiters, and semaphores, which is what fullstack interviews ask instead of N-queens | <span className="db-tier t-understand">Understand</span> |
| **DP on trees and graphs** — and the point where DP and BFS meet | <span className="db-tier t-know">Know</span> |
| **Matrix and simulation problems** — spiral order, rotate in place, game of life | <span className="db-tier t-know">Know</span> |
| **Recognising NP-hardness** — spotting it, saying so, and offering an approximation instead | <span className="db-tier t-know">Know</span> |

**Gate — move on when:** you can solve coin change top-down, convert it to
bottom-up without looking, and state both complexities.

---

## Phase 17 — Machine coding: implement it yourself

*18 topics.* The brief's **custom functions** requirement, and the round that
separates people who have used JavaScript from people who understand it. Every
row is a from-scratch implementation with the edge cases interviewers probe.

| Topic | Tier |
|---|---|
| **`map`, `filter`, `reduce`, `forEach` on `Array.prototype`** — the callback contract (value, index, array), `thisArg`, sparse arrays, and mutation during iteration | <span className="db-tier t-master">Master</span> |
| **`call`, `apply` and `bind`** — including a `bind` that still works when the bound function is called with `new` | <span className="db-tier t-master">Master</span> |
| **`debounce` and `throttle`** — with leading/trailing options, `cancel`, `flush`, and preserving `this` and the return value | <span className="db-tier t-master">Master</span> |
| **`Promise.all`, `race`, `any`, `allSettled`** — implemented over a raw promise, with the empty-array and non-promise cases handled | <span className="db-tier t-master">Master</span> |
| **An `EventEmitter`** — `on`, `once`, `off`, `emit`, and the listener-array mutation-during-emit bug | <span className="db-tier t-understand">Understand</span> |
| **Deep clone** — cycles, `Map`/`Set`/`Date`/`RegExp`, prototypes, and why `structuredClone` is usually the right answer instead | <span className="db-tier t-understand">Understand</span> |
| **A concurrency-limited task queue** — N in flight, results in order, and errors that do not stall the queue | <span className="db-tier t-understand">Understand</span> |
| **Retry with exponential backoff, jitter and an `AbortSignal`** — and deciding which failures are retryable | <span className="db-tier t-understand">Understand</span> |
| **An LRU cache in O(1)** — `Map` insertion order versus a doubly linked list, and the eviction test | <span className="db-tier t-understand">Understand</span> |
| **A Promise from scratch** — states, the `then` queue, microtask scheduling, and chaining that actually flattens | <span className="db-tier t-understand">Understand</span> |
| **`memoize`** — a custom key resolver, `WeakMap` keys for object arguments, TTL, and cache size limits | <span className="db-tier t-understand">Understand</span> |
| **Deep equality** — the cases (`NaN`, `-0`, `Date`, `Map`, prototypes) and where it should stop | <span className="db-tier t-understand">Understand</span> |
| **`curry`, `pipe` and `compose`** — variadic currying, placeholder arguments, and async composition | <span className="db-tier t-understand">Understand</span> |
| **`promisify` and a callback↔promise bridge** — including multi-argument callbacks | <span className="db-tier t-understand">Understand</span> |
| **A rate limiter** — token bucket and sliding window, on the client and shared with the server design | <span className="db-tier t-understand">Understand</span> |
| **`new`, `Object.create` and `instanceof`** implemented by hand — the clearest proof you understand prototypes | <span className="db-tier t-know">Know</span> |
| **A tiny pub/sub and a reactive `signal`** — dependency tracking, and the 40 lines behind modern reactivity | <span className="db-tier t-know">Know</span> |
| **A virtual-DOM diff in outline** — keyed children, the reconciliation rules, and why React keys matter | <span className="db-tier t-know">Know</span> |

**Gate — move on when:** you can write `bind`, `debounce`, `Promise.all` and an
`EventEmitter` from an empty file in under thirty minutes, and name the edge case
each one hides.

---

## Where this connects

- **Phase 17 → Phase 3 and Phase 7** — every implementation here is a closure, a
  `this` binding or a promise state machine. If a row is hard, the gap is in
  Part 1 or Part 2, not in DSA.
- **Phase 14 → PostgreSQL Phase 10** — B-trees, hashes and heaps are the same
  structures the query planner picks between; the
  [index pages](/docs/postgresql/pages/phase-10-indexes/) are the applied version.
- **Phase 13 → Node.js Phase 10** — measuring honestly, warm-up and JIT effects
  carry straight over to server benchmarking.
- **Phase 16 → Phase 7** — task scheduling, rate limiting and semaphores are DSA
  problems wearing async clothes.
- **Deliberately not here:** language-agnostic proofs, competitive-programming
  tricks, and anything requiring a language JavaScript does not have.

---

← [Part 3 — Web APIs](./03-web-apis.md) · Next: [Part 5 — Applied storefront](./05-applied-storefront.md) →
