---
name: plan-dsa
description: The per-phase topic scope for every DSA syllabus part (parts 01–08, phases 0–20), banked at the 90 % usage kill switch on 2026-09-06 so the next session writes without re-deriving. Companion to CURSOR-DSA-SYSTEM-DESIGN.md.
metadata:
  type: project
---

# DSA track — the banked plan for parts 01–08 (nothing written yet)

**How to use:** same contract as System Design — [BRIEF-DSA-SYSTEM-DESIGN.md](BRIEF-DSA-SYSTEM-DESIGN.md),
style of `docs/system-design/syllabus/01-*.md`. Title "DSA — Syllabus", key `dsa`. Solutions are
discussed **TypeScript/JavaScript first, Java second**; no Python rows. Each bullet is a candidate
row; exhaust beyond it. ⚠️ JavaScript phases 13–17 (`docs/javascript/syllabus/04-dsa-and-machine-coding.md`,
parked beyond Master) already hold JS-specific implementations — **link, never duplicate**: this
track is the interview-prep layer (patterns, problem ladders, the method), theirs is the language layer.

## 01-foundations — Phases 0–2
**Ph 0 · The DSA interview and the practice system:** what the rounds grade (correctness, complexity, code quality, communication) · the 45-minute shape and the UMPIRE-style method (understand, match, plan, implement, review, evaluate) · language choice and runtime traps: recursion depth in Node, no built-in heap/TreeMap in JS, sort comparator and stability, BigInt, integer overflow in Java, string immutability costs · the ladders (Blind 75, NeetCode 150/250, Striver's A2Z) and how they map to this track · spaced repetition and the mistake log · mock interviews · reading constraints to infer the intended complexity · the "when stuck" protocol · how this track relates to JS phases 13–17 and Java collections (phase 3).
**Ph 1 · Complexity analysis:** Big-O/Θ/Ω · amortised analysis (dynamic array, union-find) · recurrences and the master theorem · space and the recursion stack · reading a bound off loops and recursion · common classes and what n ≤ 10⁵ vs 10⁸ implies · hidden costs (string concat, slice, spread, hash collisions) · benchmarking vs analysis, cache effects (Know).
**Ph 2 · Recursion, math and bits:** recursion and the call stack, converting to iteration · divide and conquer · backtracking skeleton (forward link) · GCD/LCM, primes and the sieve, modular arithmetic, fast exponentiation, modular inverse, nCr with a modulus, Catalan numbers · bit manipulation: masks, XOR tricks, counting bits, subsets by mask, lowest set bit · matrix exponentiation · randomisation and Fisher–Yates · overflow and BigInt.

## 02-arrays-strings-and-hashing — Phases 3–5
**Ph 3 · Arrays, hashing and prefix sums:** hash map/set costs and JS `Map` vs object · frequency counting, two-sum family · prefix sums (1D/2D), subarray sum equals k, difference arrays · Kadane · Dutch national flag · cyclic sort / index-as-hash · in-place operations · sorting-based approaches · intervals: merge, insert, minimum rooms, non-overlapping · matrices: rotation, spiral, set zeroes, search sorted matrix · the "sort, then …" pattern.
**Ph 4 · Two pointers and sliding window:** opposite-direction and same-direction pointers · fast/slow · 3-sum / 4-sum with dedup · container with most water · trapping rain water · fixed and variable windows · longest substring without repeats · minimum window substring · sliding-window maximum (monotonic deque) · "at most k" subtraction trick · window over a stream.
**Ph 5 · Strings:** builders and immutability costs · palindromes (expand around centre; Manacher as Know) · anagram grouping · matching: naive, KMP, Z-function, Rabin–Karp rolling hash · compression and run-length · parsing: atoi, calculator, expression evaluation with a stack · Unicode pitfalls · longest common prefix · edit distance, LCS, regex matching are DP (forward link).

## 03-linear-structures-and-binary-search — Phases 6–8
**Ph 6 · Stacks, queues and monotonic structures:** stack for matching and parsing · monotonic stack: next greater, daily temperatures, largest rectangle in histogram, stock span · min-stack · queue via two stacks · monotonic deque · circular buffer · array-backed implementations in JS and Java.
**Ph 7 · Linked lists:** singly and doubly · reversal (iterative, recursive, in k-groups) · fast/slow: middle, cycle, cycle start · merge two, merge k (heap) · reorder · remove nth from end · copy with random pointer · LRU cache from a doubly linked list + map (link JS phase 14) · flatten multilevel · add numbers · skip list (Know).
**Ph 8 · Binary search:** the invariant template, lower/upper bound · rotated arrays · search on the answer (capacity, k-th smallest pair, minimum days) · 2D matrix · infinite/unknown length · median of two sorted arrays · bisect in JS (none built in) vs Java's binarySearch · floating-point binary search · ternary search (Know).

## 04-trees-heaps-and-tries — Phases 9–11
**Ph 9 · Binary trees and BSTs:** traversals recursive, iterative, Morris · BFS levels, zigzag · height, diameter, balanced · LCA (tree and BST) · serialise/deserialise · path sums · build from traversals · views · BST validate, k-th smallest, successor, delete · balanced trees: AVL/red-black concept, Java TreeMap, what JS lacks and the alternatives · tree DP intro (max path sum, house robber III).
**Ph 10 · Heaps and priority queues:** binary heap implementation (JS has none; Java PriorityQueue) · heapify · top-k, k-th largest · merge k sorted · two heaps for a running median · scheduling: task scheduler, meeting rooms II, CPU · greedy with heaps (IPO) · lazy deletion / indexed heap · d-ary heaps (Know).
**Ph 11 · Tries, segment trees and Fenwick trees:** trie insert/search/prefix, word search II, autocomplete, replace words · binary trie (maximum XOR) · suffix structures (Know) · segment tree: point update, range query, lazy propagation · Fenwick/BIT: range sums, inversion count, order statistics · sparse table for RMQ · when interviews actually ask these.

## 05-graphs — Phases 12–13
**Ph 12 · Graph fundamentals, traversal and union-find:** representations · BFS/DFS recursive and iterative · components, islands, flood fill · cycle detection directed/undirected · bipartite check · topological sort (Kahn, DFS), course schedule family · clone graph · multi-source BFS (rotten oranges, walls and gates) · 0-1 BFS · implicit graphs (word ladder, knight moves) · union-find with path compression and rank: provinces, redundant connection, accounts merge · Kruskal and Prim.
**Ph 13 · Shortest paths and advanced graph algorithms:** Dijkstra with a heap · Bellman–Ford, negative edges, k stops · Floyd–Warshall · A* · network delay, cheapest flights, minimum effort path · SCC (Kosaraju, Tarjan) · bridges and articulation points · Eulerian path (reconstruct itinerary) · max flow / bipartite matching concept (Know) · alien dictionary · the decision table: which algorithm for which graph.

## 06-backtracking-greedy-and-dp — Phases 14–16 (expect a split at 301 lines: 06a / 06b)
**Ph 14 · Backtracking:** choose/explore/unchoose template · subsets, permutations, combinations with duplicates · combination sum · N-Queens · Sudoku · word search · palindrome partitioning · generate parentheses · letter combinations · pruning and ordering · bitmask enumeration · complexity of backtracking.
**Ph 15 · Greedy:** the exchange argument · greedy vs DP, proving it · intervals: activity selection, minimum arrows, non-overlapping · jump game I/II · gas station · candy · task scheduler · Huffman · partition labels · two-city scheduling · boats · Kruskal/Dijkstra as greedy · fractional vs 0/1 knapsack · when greedy fails.
**Ph 16 · Dynamic programming:** the framework (state, transition, base, order, answer; memo vs tabulation; space optimisation) · recognising DP · 1D: stairs, house robber, decode ways, word break, coin change, LIS (n log n) · 2D grids · knapsack family: 0/1, unbounded, subset sum, partition, target sum · strings: LCS, edit distance, palindromic subsequence, distinct subsequences, regex/wildcard, interleaving · intervals: burst balloons, matrix chain · stock family · DP on trees · bitmask DP · digit DP (Know) · game/minimax DP · counting DP · DP with binary search · memo keys in JS (Map, string keys) vs Java arrays · Kadane and LIS as DP.

## 07-design-flavoured-and-applied — Phases 17–18
**Ph 17 · Design-flavoured problems and concurrency:** LRU/LFU · min stack · design Twitter · hit counter · rate limiter · time-based KV · randomised set O(1) · snake game · browser history · autocomplete system · file system · logger rate limiter · leaderboard · tic-tac-toe · iterators (peeking, flatten nested, zigzag) · skip list · in-memory DB with transactions · concurrency: print in order, bounded buffer, dining philosophers (Java); promise pool and scheduler (Node — link JS phase 7/17).
**Ph 18 · The algorithms behind the systems you run:** consistent hashing · rate-limiter algorithms · bloom filter · count-min / top-k · reservoir sampling · LRU in Redis · external sort · merge join / hash join in PostgreSQL · B-tree, GIN, GiST lookups (link PG track) · diffing (Myers, React reconciliation) · inverted index · shortest paths in maps · cron and priority scheduling · topological sort in build tools and package managers · union-find in networking · radix tries in HTTP routers · how to explain a complexity trade-off to a senior interviewer.

## 08-the-ladder-and-the-plan — Phases 19–20
**Ph 19 · The problem ladder, pattern by pattern:** one row per pattern naming 5–8 canonical problems (by name; numbers only if verified) · Blind 75 mapped onto phases · NeetCode 150 additions · Striver A2Z coverage · timing drills · the weekly plan · the review method (mistake log, spaced repetition) · mock format and grading · whiteboard/CoderPad setup · explaining while coding.
**Ph 20 · Interview formats, the plan and the last two weeks:** formats by company type phrased as tendencies (product companies vs FAANG vs startups) — no invented statistics · contest-style vs interview-style · competitive programming as optional acceleration · the 12-week plan alongside system design · the last-two-weeks plan · the day-of checklist · after a rejection: the loop back into the ladder.
