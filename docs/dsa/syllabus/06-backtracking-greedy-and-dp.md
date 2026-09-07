---
title: "Part 6 — Backtracking, greedy and dynamic programming"
sidebar_label: "6 · Backtracking, greedy & DP"
sidebar_position: 6
---

> Phases 14–16 · Enumerating everything, choosing locally with a proof, and the pattern that turns exponential into polynomial

Three ways of searching a space of choices. Backtracking explores it all with pruning;
greedy commits to one choice and needs a proof that nothing better was lost; dynamic
programming reuses answers to overlapping subproblems. Knowing which of the three a problem
wants is the single most valuable recognition skill in the hard set — and DP is where
interview outcomes at the senior level are most often decided.

---

## Phase 14 — Backtracking

One template — choose, explore, un-choose — and the pruning that keeps it from being
brute force. The problems here are the enumeration classics that every ladder includes,
plus the discipline of stating the exponential bound and why it is acceptable.

| Topic | Tier |
|---|---|
| **The template** — choose, explore, un-choose; the path as shared mutable state, copying only at the leaf | <span className="db-tier t-master">Master</span> |
| **Subsets, permutations and combinations** — the three enumerations and their duplicate-handling variants by sorting and skipping | <span className="db-tier t-master">Master</span> |
| **Combination sum** — with and without reuse, the start index, pruning on sorted candidates | <span className="db-tier t-master">Master</span> |
| **N-Queens** — column and diagonal sets, counting against listing | <span className="db-tier t-master">Master</span> |
| **Word search** — depth-first on the grid with in-place marking; the trie-accelerated version from [Part 4](04-trees-heaps-and-tries.md) | <span className="db-tier t-master">Master</span> |
| **Generate parentheses and letter combinations** — the "valid prefix" pruning idea | <span className="db-tier t-master">Master</span> |
| **Pruning and ordering** — sort first, bound the remaining sum, the branch-and-bound mindset | <span className="db-tier t-master">Master</span> |
| **Complexity of backtracking** — the output-size bound, why exponential and factorial are expected, and saying so to the interviewer before being asked | <span className="db-tier t-master">Master</span> |
| **Sudoku solver** — constraint sets per row, column and box, the cell order, failing early | <span className="db-tier t-understand">Understand</span> |
| **Palindrome partitioning** — cut positions with a precomputed palindrome table | <span className="db-tier t-understand">Understand</span> |
| **String backtracking** — restoring IP addresses, adding operators to an expression; segment-length pruning | <span className="db-tier t-understand">Understand</span> |
| **Iterative enumeration by bitmask** — subsets as integers, when it replaces recursion cleanly | <span className="db-tier t-understand">Understand</span> |
| **Constraint satisfaction, generally** — variables, domains and constraints as the vocabulary for the harder problems | <span className="db-tier t-know">Know</span> |

**Gate — move on when:** subsets-with-duplicates, combination sum and N-Queens come out
correct from memory, and you state the bound and the pruning before you write the loop.

---

## Phase 15 — Greedy

Greedy is easy to write and hard to justify. The rows here are the exchange argument that
makes a greedy choice safe, the classic problems where it works, and the habit of testing a
small counterexample before committing — because the coin-change trap catches everyone once.

| Topic | Tier |
|---|---|
| **What makes greedy correct** — the exchange argument, the greedy-choice property, optimal substructure; the two-sentence proof an interviewer wants to hear | <span className="db-tier t-master">Master</span> |
| **Greedy against DP** — the coin-change trap that works for canonical coins and fails otherwise; deciding which you are facing | <span className="db-tier t-master">Master</span> |
| **Intervals** — activity selection, non-overlapping intervals, minimum arrows; sorting by end time and why start time is wrong | <span className="db-tier t-master">Master</span> |
| **Jump game I and II** — the furthest-reach scan, the breadth-first idea in disguise for the minimum number of jumps | <span className="db-tier t-master">Master</span> |
| **Fractional against 0/1 knapsack** — the boundary of greedy shown in one example | <span className="db-tier t-master">Master</span> |
| **When greedy fails** — recognising the counterexample quickly; trying a small case before committing to the approach | <span className="db-tier t-master">Master</span> |
| **Gas station and circular greedy** — the total-versus-local argument | <span className="db-tier t-understand">Understand</span> |
| **Two-pass greedy** — the candy problem: left to right, then right to left | <span className="db-tier t-understand">Understand</span> |
| **Frequency greedy** — the task scheduler: most frequent first, the idle-slot arithmetic | <span className="db-tier t-understand">Understand</span> |
| **Huffman coding** — the heap-driven greedy and its proof | <span className="db-tier t-understand">Understand</span> |
| **Last-occurrence scans** — partition labels and the expanding window | <span className="db-tier t-understand">Understand</span> |
| **Sort-then-pair greedies** — two-city scheduling, boats to save people, assigning cookies | <span className="db-tier t-understand">Understand</span> |
| **Kruskal and Dijkstra as greedy** — the algorithms of [Part 5](05-graphs.md) seen as greedy with a proof | <span className="db-tier t-understand">Understand</span> |
| **Scheduling classics** — minimising lateness and the rest of the exchange-argument family | <span className="db-tier t-know">Know</span> |

**Gate — move on when:** for any greedy solution you propose, you can state the exchange
argument in two sentences, and for coin change you can produce the counterexample that
breaks greedy without looking it up.

---

## Phase 16 — Dynamic programming

DP is a framework, not a bag of problems: define the state, the transition, the base case,
the order and where the answer lives. Everything below is that framework applied to the
families that interviews draw from, with the two language details — memo keys and recursion
depth — that turn a correct idea into a wrong submission.

| Topic | Tier |
|---|---|
| **The framework** — state, transition, base case, order, answer; top-down with memoisation against bottom-up tabulation; rolling rows for space | <span className="db-tier t-master">Master</span> |
| **Recognising DP** — optimal substructure and overlapping subproblems; the phrases ("number of ways", "minimum cost", "longest", "is it possible") that signal it | <span className="db-tier t-master">Master</span> |
| **State design** — choosing what to remember; the state that is too small (a missing dimension) and the one that is too big (a time limit) | <span className="db-tier t-master">Master</span> |
| **Memoisation in TypeScript and Java** — maps with composite string keys and their cost, arrays for integer states, the recursion depth that pushes you to tabulation | <span className="db-tier t-master">Master</span> |
| **One-dimensional sequences** — climbing stairs, the house robber and its circular variant, decode ways, word break, minimum-cost climbing | <span className="db-tier t-master">Master</span> |
| **The coin-change family** — fewest coins, number of ways with and without order, the unbounded-knapsack view | <span className="db-tier t-master">Master</span> |
| **Longest increasing subsequence** — the quadratic table, the patience-sorting version in n log n, Russian dolls | <span className="db-tier t-master">Master</span> |
| **Grids** — unique paths with obstacles, minimum path sum, the dungeon game solved backwards, the triangle | <span className="db-tier t-master">Master</span> |
| **0/1 knapsack and subset sums** — subset sum, equal partition, target sum, last stone weight; the boolean table and its one-dimensional compression | <span className="db-tier t-master">Master</span> |
| **Two-string tables** — longest common subsequence and edit distance, with reconstruction of the answer | <span className="db-tier t-master">Master</span> |
| **The stock family** — one transaction, unlimited, with cooldown, with a fee, at most k; the state-machine view that unifies all of them | <span className="db-tier t-master">Master</span> |
| **Space optimisation** — rolling arrays, in-place tables, the iteration order that makes the one-dimensional version correct | <span className="db-tier t-master">Master</span> |
| **Unbounded and bounded knapsack** — combination sum IV, perfect squares, the bounded variant | <span className="db-tier t-understand">Understand</span> |
| **Palindromic subsequences and substrings** — the longest palindromic subsequence, counting palindromic substrings, the interval table | <span className="db-tier t-understand">Understand</span> |
| **String matching by DP** — regular expressions, wildcards, distinct subsequences, interleaving strings | <span className="db-tier t-understand">Understand</span> |
| **Interval DP** — burst balloons, matrix-chain multiplication, cutting a stick; the "last operation" trick | <span className="db-tier t-understand">Understand</span> |
| **DP on trees** — the postorder state per node from [Part 4](04-trees-heaps-and-tries.md), the diameter and the robber revisited | <span className="db-tier t-understand">Understand</span> |
| **Bitmask DP** — the travelling salesman on a dozen nodes, assignment problems, counting with masks | <span className="db-tier t-understand">Understand</span> |
| **Game DP and minimax** — the stone game, predicting the winner, the "difference" formulation | <span className="db-tier t-understand">Understand</span> |
| **Counting DP and modular answers** — number of ways under a modulus, the overflow trap in both languages | <span className="db-tier t-understand">Understand</span> |
| **Kadane and prefix tricks as DP** — the maximum subarray as a one-state DP, the maximum product with two states | <span className="db-tier t-understand">Understand</span> |
| **Reconstructing the answer** — parent pointers through the table; the "print the actual subsequence" follow-up | <span className="db-tier t-understand">Understand</span> |
| **The common DP interview set** — the twenty problems that cover every pattern above, and the order to practise them | <span className="db-tier t-understand">Understand</span> |
| **DP with binary search or monotonic structures** — the n log n subsequence, jump problems with a deque; the optimisations an interviewer may ask about | <span className="db-tier t-know">Know</span> |
| **Digit DP** — counting numbers with a property; the concept and one worked example | <span className="db-tier t-know">Know</span> |
| **Probability and expectation DP** — the knight's probability, dice sums; the concept and one example | <span className="db-tier t-know">Know</span> |

**Gate — deliverable:** the framework applied cold to five problems from different
families (a sequence, a grid, a knapsack, two strings, an interval), each written top-down
first and then bottom-up with rolling space, in both languages, with the state written as a
comment before any code.

---

{/* NAV */}
