---
title: "Link map · DSA · Part 6 (phases 14-16), file 3"
sidebar_label: "06 · backtracking, greedy, DP (3)"
sidebar_position: 6
---

# Link map · DSA · Part 6, file 3 (phase 16, rows 1-13)

Covers the first 13 rows of phase 16 (dynamic programming, the Master rows and the knapsack row) in `docs/dsa/syllabus/06-backtracking-greedy-and-dp.md`. No page of ours covers DP yet. *read* = I read the passage that supports the claim; *headings only* = fetched at 200 and headings checked.

### T16-01 · The framework — Master · 🔲 not written
- **Read this:** [Lecture 16: Dyn. Prog. Subproblems (MIT 6.006)](https://ocw.mit.edu/courses/6-006-introduction-to-algorithms-spring-2020/28461a74f81101874a13d9679a40584d_MIT6_006S20_lec16.pdf) · MIT OCW · subproblem definition, recurrence, topological order, base case, original problem, with top-down as "recurse but re-use" and bottom-up as "careful brute force" · covers our angle: **partial** - no TypeScript or Java, no rolling rows · fetched 2026-10-14 (*read*)
- **Also good:** [Dynamic programming](https://en.wikipedia.org/wiki/Dynamic_programming) · Wikipedia · overview of the method and its two properties · fetched 2026-10-14
- **Our delta:** the five-step checklist in our wording, in TypeScript and Java, and rolling rows.

### T16-02 · Recognising DP — Master · 🔲 not written
- **Read this:** [Optimal Substructure Explained](https://labuladong.gitbook.io/algo-en/dynamic-programming/optimal-substructure) · labuladong · max or min questions as the signal, then brute force, then look for overlapping subproblems; the school-scores counterexample · covers our angle: **partial** - Java, no phrase list such as "number of ways" · fetched 2026-10-14 (*read*)
- **Also good:** [How to tell which dynamic programming pattern a problem wants](https://www.techinterview.org/post/3233476950/which-dp-pattern-a-problem-wants/) · techinterview.org · maps wording (subset under a target, two strings, paths in a matrix) to a table shape · fetched 2026-10-14
- **Our delta:** the signal phrases table.

### T16-03 · State design — Master · 🔲 not written
- **Read this:** [Optimal Substructure Explained](https://labuladong.gitbook.io/algo-en/dynamic-programming/optimal-substructure) · labuladong · has a section on choosing the size of the dp array · covers our angle: **partial** - sizing and direction only, nothing on a missing dimension against a state that is too big · fetched 2026-10-14 (*headings only*)
- **Also good:** [How to tell which dynamic programming pattern a problem wants](https://www.techinterview.org/post/3233476950/which-dp-pattern-a-problem-wants/) · techinterview.org · says the hard part is defining what one cell means · fetched 2026-10-14
- **Our delta:** worked examples of a too-small state (a wrong answer) and a too-large one (a time limit).

### T16-04 · Memoisation in TypeScript and Java — Master · 🔲 not written
- **Read this:** [Memoization: The Art of Teaching Your Code to Remember](https://rajnandan.com/posts/memoization-optimization-typescript/) · Rajnandan · a `Map<string, ...>` cache keyed by `JSON.stringify(args)`, an LRU variant, and bottom-up chosen to avoid recursion limits · covers our angle: **partial** - TypeScript only, no Java, no depth numbers or cost of string keys · fetched 2026-10-14 (*read*)
- **Our delta:** Java memo arrays and `HashMap` keys, the cost of composite string keys, and where each runtime's recursion depth runs out.

### T16-05 · One-dimensional sequences — Master · 🔲 not written
- **Read this:** [1D Dynamic Programming Interview Patterns](https://www.techinterview.org/post/3233463177/dynamic-programming-1d-interview-patterns/) · techinterview.org · take-or-skip recurrence for house robber, the stairs recurrence, and word break code · covers our angle: **partial** - Python, and the circular robber, decode ways and min-cost climbing are named without code · fetched 2026-10-14 (*read*)
- **Also good:** [213. House Robber II](https://algo.monster/liteproblems/213) · AlgoMonster · the circular variant · fetched 2026-10-14
- **Also good:** [91. Decode Ways](https://algo.monster/liteproblems/91) · AlgoMonster · decoding recurrence · fetched 2026-10-14
- **Also good:** [139. Word Break](https://algo.monster/liteproblems/139) · AlgoMonster · the word break recurrence · fetched 2026-10-14
- **Our delta:** TypeScript and Java code for the circular robber, decode ways and min-cost climbing.

### T16-06 · The coin-change family — Master · 🔲 not written
- **Read this:** [Coin Change: Bottom-Up and Top-Down Dynamic Programming](https://www.techinterview.org/post/3233460127/coin-change-bottom-up-and-top-down-dynamic-programming/) · techinterview.org · fewest coins and number of ways, coins-outer for combinations against amounts-outer for permutations, and the unbounded-knapsack view · covers our angle: **partial** - Python only · fetched 2026-10-14 (*read*)
- **Also good:** [377. Combination Sum IV](https://algo.monster/liteproblems/377) · AlgoMonster · the ordered count with Java and TypeScript · fetched 2026-10-14
- **Our delta:** TypeScript and Java code.

### T16-07 · Longest increasing subsequence — Master · 🔲 not written
- **Read this:** [Longest increasing subsequence](https://en.wikipedia.org/wiki/Longest_increasing_subsequence) · Wikipedia · the quadratic DP via LCS and the O(n log n) method with a binary search per element · covers our angle: **partial** - no TypeScript or Java, no table walk-through · fetched 2026-10-14 (*read*)
- **Also good:** [354. Russian Doll Envelopes](https://algo.monster/liteproblems/354) · AlgoMonster · sort width ascending and height descending on ties, then LIS on heights; Java and TypeScript · fetched 2026-10-14
- **Beyond the docs:** [Longest Increasing Subsequence (Princeton COS 423 slides)](https://www.cs.princeton.edu/courses/archive/spring13/cos423/lectures/LongestIncreasingSubsequence.pdf) · Princeton · the patience-solitaire view of the greedy pile algorithm · fetched 2026-10-14 (*headings only*)
- **Our delta:** the quadratic table written out in TypeScript and Java.

### T16-08 · Grids — Master · 🔲 not written
- **Read this:** [Dynamic Programming on Grids: Unique Paths, Minimum Path Sum, and Dungeon Game](https://www.techinterview.org/post/3233466168/dynamic-programming-grid/) · techinterview.org · covers obstacles, in-place min path sum and the backwards dungeon recurrence `max(1, ...)` · covers our angle: **partial** - Python, no triangle, and the obstacle code mishandles a blocked start · fetched 2026-10-14 (*read*)
- **Also good:** [120. Triangle](https://algo.monster/liteproblems/120) · AlgoMonster · the triangle problem · fetched 2026-10-14
- **Our delta:** triangle, and the blocked-start edge case.

### T16-09 · 0/1 knapsack and subset sums — Master · 🔲 not written
- **Read this:** [Dynamic Programming Knapsack Patterns: 0/1, Unbounded, Subset Sum](https://www.techinterview.org/post/3233461350/dynamic-programming-knapsack-patterns/) · techinterview.org · 0/1 knapsack, subset sum, equal partition, target sum and last stone weight with the 1D reverse loop · covers our angle: **partial** - Python only · fetched 2026-10-14 (*read*)
- **Also good:** [494. Target Sum](https://algo.monster/liteproblems/494) · AlgoMonster · the target-sum reduction · fetched 2026-10-14
- **Our delta:** TypeScript and Java code.

### T16-10 · Two-string tables — Master · 🔲 not written
- **Read this:** [Longest Common Subsequence: DP Solution and Space Optimization](https://www.techinterview.org/post/3233460129/longest-common-subsequence-dp-solution-and-space-optimization/) · techinterview.org · the (m+1) by (n+1) table, backtracking from the corner to rebuild the string, a two-row version · covers our angle: **partial** - Python, no edit distance code, example answers inconsistent · fetched 2026-10-14 (*read*)
- **Also good:** [72. Edit Distance](https://algo.monster/liteproblems/72) · AlgoMonster · the edit distance table · fetched 2026-10-14
- **Our delta:** edit distance with reconstruction.

### T16-11 · The stock family — Master · 🔲 not written
- **Read this:** [Stock problems (labuladong)](https://labuladong.gitbook.io/algo-en/dynamic-programming/stock-problems) · labuladong · one `dp[i][k][0 or 1]` state machine covering one transaction, unlimited, cooldown, fee, k=2 and general k, then a combined function · covers our angle: **partial** - Java, no TypeScript · fetched 2026-10-14 (*read*)
- **Our delta:** TypeScript version.

### T16-12 · Space optimisation — Master · 🔲 not written
- **Read this:** [Dynamic Programming Knapsack Patterns: 0/1, Unbounded, Subset Sum](https://www.techinterview.org/post/3233461350/dynamic-programming-knapsack-patterns/) · techinterview.org · the reverse inner loop that stops an item being used twice, with the forward loop as the unbounded case · covers our angle: **partial** - knapsack only, no rolling rows for grids or LCS · fetched 2026-10-14 (*read*)
- **Also good:** [Longest Common Subsequence: DP Solution and Space Optimization](https://www.techinterview.org/post/3233460129/longest-common-subsequence-dp-solution-and-space-optimization/) · techinterview.org · a two-row LCS · fetched 2026-10-14
- **Our delta:** the rule for choosing the iteration order, across table shapes.

### T16-13 · Unbounded and bounded knapsack — Understand · 🔲 not written
- **Read this:** [377. Combination Sum IV](https://algo.monster/liteproblems/377) · AlgoMonster · sums outer and candidates inner for ordered counts, and `long` in Java to avoid intermediate overflow · covers our angle: **partial** - no perfect squares and no bounded variant · fetched 2026-10-14 (*read*)
- **Also good:** [279. Perfect Squares](https://algo.monster/liteproblems/279) · AlgoMonster · the unbounded minimum-count case · fetched 2026-10-14
- **Our delta:** the bounded variant (counts per item), and binary splitting.
