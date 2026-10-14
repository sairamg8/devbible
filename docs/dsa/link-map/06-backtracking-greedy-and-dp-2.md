---
title: "Link map · DSA · Part 6 (phases 14-16), file 2"
sidebar_label: "06 · backtracking, greedy, DP (2)"
sidebar_position: 6
---

# Link map · DSA · Part 6, file 2 (phase 15)

Covers the 14 rows of phase 15 (greedy) in `docs/dsa/syllabus/06-backtracking-greedy-and-dp.md`. No page of ours covers greedy yet. *read* = I read the passage that supports the claim; *headings only* = fetched at 200 and headings checked.

### T15-01 · What makes greedy correct — Master · 🔲 not written
- **Read this:** [Greedy Algorithms (Erickson, Algorithms chapter 4)](https://jeffe.cs.illinois.edu/teaching/algorithms/book/04-greedy.pdf) · Jeff Erickson · states the exchange argument as swapping the optimal choice for the greedy one without making it worse, with worked scheduling and Huffman proofs · covers our angle: **partial** - textbook proofs, no interview-length two-sentence version · fetched 2026-10-14 (*read*)
- **Also good:** [Greedy algorithm](https://en.wikipedia.org/wiki/Greedy_algorithm) · Wikipedia · definition and the matroid and failure discussion · fetched 2026-10-14
- **Our delta:** the two-sentence spoken proof.

### T15-02 · Greedy against DP — Master · 🔲 not written
- **Read this:** [Change-making problem](https://en.wikipedia.org/wiki/Change-making_problem) · Wikipedia · greedy section with canonical systems and the 25, 10, 1 counterexample (40 cents) · covers our angle: **partial** - no decision rule for telling greedy from DP in an interview · fetched 2026-10-14 (*read*)
- **Also good:** [Why greedy fails on Coin Change, and the DP that fixes it](https://www.techinterview.org/post/3233476079/why-greedy-fails-coin-change-dp/) · techinterview.org · coins 1, 3, 4 with target 6 and the forward-loop DP · fetched 2026-10-14
- **Our delta:** a short checklist for deciding which you are facing.

### T15-03 · Intervals — Master · 🔲 not written
- **Read this:** [435. Non-overlapping Intervals](https://algo.monster/liteproblems/435) · AlgoMonster · sort by end, with the `[1, 100]` against `[2, 3]` example showing why start time is wrong · covers our angle: full for this problem (Java and TypeScript) · fetched 2026-10-14 (*read*)
- **Also good:** [452. Minimum Arrows to Burst Balloons](https://algo.monster/liteproblems/452) · AlgoMonster · same sort, strict comparison, and the Java comparator overflow note · fetched 2026-10-14

### T15-04 · Jump game I and II — Master · 🔲 not written
- **Read this:** [45. Jump Game II](https://algo.monster/liteproblems/45) · AlgoMonster · furthest-reach scan with a current-range end, O(n) time and O(1) space · covers our angle: **partial** - no Jump Game I and no BFS-levels framing · fetched 2026-10-14 (*read*)
- **Also good:** [45. Jump Game II (NeetCode)](https://neetcode.io/solutions/jump-game-ii) · NeetCode · expected to frame the same scan as BFS windows · fetched 2026-10-14 (*headings only*)
- **Our delta:** Jump Game I reachability and the BFS-levels link.

### T15-05 · Fractional against 0/1 knapsack — Master · 🔲 not written
- **Read this:** [Continuous knapsack problem](https://en.wikipedia.org/wiki/Continuous_knapsack_problem) · Wikipedia · sort by value-to-weight ratio, with a worked example of 142 and the contrast with the NP-hard 0/1 version · covers our angle: **partial** - no explicit 0/1 counterexample · fetched 2026-10-14 (*read*)
- **Our delta:** a three-item 0/1 case where the best ratio blocks the optimum.

### T15-06 · When greedy fails — Master · 🔲 not written
- **Read this:** [Greedy Algorithms (Interview Cake)](https://www.interviewcake.com/concept/java/greedy) · Interview Cake · prove it or test it thoroughly, with the cake thief and nearest-city failures · covers our angle: **partial** - no small-case drill · fetched 2026-10-14 (*read*)
- **Also good:** [Change-making problem](https://en.wikipedia.org/wiki/Change-making_problem) · Wikipedia · concrete counterexamples to copy · fetched 2026-10-14
- **Our delta:** the try-a-small-case routine.

### T15-07 · Gas station and circular greedy — Understand · 🔲 not written
- **Read this:** [134. Gas Station](https://algo.monster/liteproblems/134) · AlgoMonster · total gas against total cost for feasibility, and discarding the failed stretch for the start · covers our angle: **partial** - sufficiency of the total condition is asserted, not proved · fetched 2026-10-14 (*read*)
- **Our delta:** the short proof that the total condition suffices.

### T15-08 · Two-pass greedy — Understand · 🔲 not written
- **Read this:** [135. Candy](https://algo.monster/liteproblems/135) · AlgoMonster · left-to-right then right-to-left arrays, take the max per child · covers our angle: full (Java and TypeScript) · fetched 2026-10-14 (*read*)

### T15-09 · Frequency greedy — Understand · 🔲 not written
- **Read this:** [621. Task Scheduler](https://algo.monster/liteproblems/621) · AlgoMonster · the max of task count and `(x - 1) * (n + 1) + s` with a worked idle-slot example · covers our angle: full (Java and TypeScript) · fetched 2026-10-14 (*read*)

### T15-10 · Huffman coding — Understand · 🔲 not written
- **Read this:** [Greedy Algorithms (Erickson, Algorithms chapter 4)](https://jeffe.cs.illinois.edu/teaching/algorithms/book/04-greedy.pdf) · Jeff Erickson · has a Huffman Codes section with the algorithm worked by example and its exchange-style proof · covers our angle: **partial** - no heap-based code · fetched 2026-10-14 (*read*)
- **Also good:** [Data Compression via Huffman Coding (Berkeley CS 170 notes)](https://people.eecs.berkeley.edu/~jordan/courses/170-fall05/notes/lecture10.pdf) · UC Berkeley · short four-page note with the algorithm pseudocode · fetched 2026-10-14 (*headings only*)
- **Our delta:** a min-heap implementation in TypeScript and Java.

### T15-11 · Last-occurrence scans — Understand · 🔲 not written
- **Read this:** [763. Partition Labels](https://algo.monster/liteproblems/763) · AlgoMonster · last-index table then a window that closes at the farthest reach · covers our angle: full (Java and TypeScript) · fetched 2026-10-14 (*read*)

### T15-12 · Sort-then-pair greedies — Understand · 🔲 not written
- **Read this:** [1029. Two City Scheduling](https://algo.monster/liteproblems/1029) · AlgoMonster · sort by the difference of the two costs, first half to A · covers our angle: **partial** - one of the three problems · fetched 2026-10-14 (*read*)
- **Also good:** [881. Boats to Save People](https://algo.monster/liteproblems/881) · AlgoMonster · sort and two pointers · fetched 2026-10-14
- **Also good:** [455. Assign Cookies](https://algo.monster/liteproblems/455) · AlgoMonster · smallest sufficient cookie to the least greedy child · fetched 2026-10-14

### T15-13 · Kruskal and Dijkstra as greedy — Understand · 🔲 not written
- **Read this:** [Minimum spanning tree: Kruskal's algorithm](https://cp-algorithms.com/graph/mst_kruskal.html) · cp-algorithms · has a Proof of correctness section using an exchange argument · covers our angle: **partial** - C++ only, and nothing on Dijkstra · fetched 2026-10-14 (*read*)
- **Also good:** [Algorithms 4e, 4.4 Shortest paths](https://algs4.cs.princeton.edu/44sp/) · Princeton · Java Dijkstra with its edge-relaxation reasoning · fetched 2026-10-14 (*headings only*)
- **Our delta:** the greedy-with-a-proof framing for Dijkstra.

### T15-14 · Scheduling classics — Know · 🔲 not written
- **Read this:** [Lecture 8: Greedy Algorithms - Exchange Arguments](https://people.cs.umass.edu/~sheldon/teaching/cs311/lec/lec08.pdf) · UMass CS 311 · minimising maximum lateness by deadline order, proved by an exchange argument · covers our angle: full for lateness · fetched 2026-10-14 (*read*)
