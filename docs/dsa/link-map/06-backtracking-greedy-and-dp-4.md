---
title: "Link map · DSA · Part 6 (phases 14-16), file 4"
sidebar_label: "06 · backtracking, greedy, DP (4)"
sidebar_position: 6
---

# Link map · DSA · Part 6, file 4 (phase 16, rows 14-26)

Covers the last 13 rows of phase 16 (the Understand and Know DP rows) in `docs/dsa/syllabus/06-backtracking-greedy-and-dp.md`. No page of ours covers DP yet. *read* = I read the passage that supports the claim; *headings only* = fetched at 200 and headings checked.

### T16-14 · Palindromic subsequences and substrings — Understand · 🔲 not written
- **Read this:** [Longest palindromic subsequence DP solution](https://codemia.io/knowledge-hub/path/longest_palindromic_subsequence_dp_solution) · Codemia · the interval recurrence: ends match gives the inner value plus 2, else the max of the two shorter windows, filled by length · covers our angle: **partial** - prose only, no code, no substring counting · fetched 2026-10-14 (*read*)
- **Also good:** [647. Palindromic Substrings](https://algo.monster/liteproblems/647) · AlgoMonster · counting palindromic substrings · fetched 2026-10-14
- **Also good:** [516. Longest Palindromic Subsequence](https://algo.monster/liteproblems/516) · AlgoMonster · the same problem with code · fetched 2026-10-14
- **Our delta:** TypeScript and Java code for both.

### T16-15 · String matching by DP — Understand · 🔲 not written
- **Read this:** [Coding Interview: DP on Strings](https://www.techinterview.org/post/3233474367/coding-interview-dp-on-strings-edit-distance-longest-common-subsequence-regex-matching-word-break-interleaving-strings/) · techinterview.org · recurrences for regex, wildcard, distinct subsequences and edit distance in one place · covers our angle: **partial** - interleaving string has no recurrence, and there is no code · fetched 2026-10-14 (*read*)
- **Also good:** [97. Interleaving String](https://algo.monster/liteproblems/97) · AlgoMonster · the missing interleaving case · fetched 2026-10-14
- **Also good:** [10. Regular Expression Matching](https://algo.monster/liteproblems/10) · AlgoMonster · regex with code · fetched 2026-10-14
- **Our delta:** code in TypeScript and Java.

### T16-16 · Interval DP — Understand · 🔲 not written
- **Read this:** [312. Burst Balloons](https://algo.monster/liteproblems/312) · AlgoMonster · pick the balloon burst last in each interval, padded with 1 at both ends · covers our angle: **partial** - matrix chain and cutting a stick are elsewhere · fetched 2026-10-14 (*headings only*)
- **Also good:** [Matrix chain multiplication](https://en.wikipedia.org/wiki/Matrix_chain_multiplication) · Wikipedia · the bottom-up `m[i, j]` minimum over split `k`, filled by increasing length, with a memoised Python version · fetched 2026-10-14 (*read*)
- **Our delta:** cutting a stick and the "last operation" framing in plain words.

### T16-17 · DP on trees — Understand · 🔲 not written
- **Read this:** [Tree Dynamic Programming Interview Patterns: Diameter, Path Sum & House Robber](https://www.techinterview.org/post/3233462024/tree-dp-interview-patterns/) · techinterview.org · postorder depth with a global max for the diameter, and a (rob, skip) pair per node for House Robber III · covers our angle: **partial** - Python only · fetched 2026-10-14 (*read*)
- **Also good:** [337. House Robber III](https://algo.monster/liteproblems/337) · AlgoMonster · the same problem with code · fetched 2026-10-14
- **Our delta:** TypeScript and Java versions, avoiding a mutable global.

### T16-18 · Bitmask DP — Understand · 🔲 not written
- **Read this:** [Bitmask DP (USACO Guide)](https://usaco.guide/gold/dp-bitmasks) · USACO Guide · `dp[S][i]` routes over subsets, why merging subsets costs O(3^N) · covers our angle: **partial** - counts routes rather than a minimum tour, assignment only in the problem list, C++ and Python · fetched 2026-10-14 (*read*)
- **Also good:** [Held-Karp algorithm](https://en.wikipedia.org/wiki/Held%E2%80%93Karp_algorithm) · Wikipedia · the named travelling-salesman DP over subsets · fetched 2026-10-14 (*headings only*)
- **Our delta:** minimum-cost tour and an assignment example in TypeScript and Java.

### T16-19 · Game DP and minimax — Understand · 🔲 not written
- **Read this:** [Game theory (labuladong)](https://labuladong.gitbook.io/algo-en/dynamic-programming/game-theory) · labuladong · stone game as a first-minus-second score table, predict the winner as difference at least 0, filled bottom-up · covers our angle: **partial** - Java, tuple state rather than the single-difference recurrence · fetched 2026-10-14 (*read*)
- **Also good:** [486. Predict the Winner](https://algo.monster/liteproblems/486) · AlgoMonster · the problem with code · fetched 2026-10-14
- **Our delta:** the single-number "difference" recurrence in TypeScript.

### T16-20 · Counting DP and modular answers — Understand · 🔲 not written
- **Read this:** [Modulo 10^9+7](https://www.geeksforgeeks.org/dsa/modulo-1097-1000000007/) · GeeksforGeeks · reduce after each step, the negative-remainder fix `(a % m + m) % m`, and code in Java and JavaScript · covers our angle: **partial** - not DP-specific, nothing on JavaScript `Number` precision near 10^18 or `BigInt` · fetched 2026-10-14 (*read*)
- **Also good:** [377. Combination Sum IV](https://algo.monster/liteproblems/377) · AlgoMonster · intermediate overflow in Java, `long` array · fetched 2026-10-14
- **Our delta:** the multiplication trap in TypeScript (`Number` against `BigInt`) and Java (`int` times `int`).

### T16-21 · Kadane and prefix tricks as DP — Understand · 🔲 not written
- **Read this:** [Maximum subarray problem](https://en.wikipedia.org/wiki/Maximum_subarray_problem) · Wikipedia · Kadane as the best sum ending at each position, with the empty-subarray variants · covers our angle: **partial** - no maximum product · fetched 2026-10-14 (*read*)
- **Beyond the docs:** [Using dynamic programming for maximum product subarray](https://www.redgreencode.com/using-dynamic-programming-for-maximum-product-subarray/) · Red Green Code · a max array and a min array, because a negative flips the smallest into the largest · fetched 2026-10-14 (*read*)
- **Our delta:** O(1) space code in TypeScript and Java.

### T16-22 · Reconstructing the answer — Understand · 🔲 not written
- **Read this:** [Lecture 16: Dyn. Prog. Subproblems (MIT 6.006)](https://ocw.mit.edu/courses/6-006-introduction-to-algorithms-spring-2020/28461a74f81101874a13d9679a40584d_MIT6_006S20_lec16.pdf) · MIT OCW · store parent pointers, and for LCS add a character when the pointer moves both indices · covers our angle: **partial** - slides, no code · fetched 2026-10-14 (*read*)
- **Also good:** [Longest Common Subsequence: DP Solution and Space Optimization](https://www.techinterview.org/post/3233460129/longest-common-subsequence-dp-solution-and-space-optimization/) · techinterview.org · backtrack from the corner and reverse, with working code · fetched 2026-10-14
- **Our delta:** TypeScript and Java reconstruction, and the tie-breaking rule.

### T16-23 · The common DP interview set — Understand · 🔲 not written
- **Read this:** [20 patterns to master dynamic programming](https://blog.algomaster.io/p/20-patterns-to-master-dynamic-programming) · AlgoMaster · twenty patterns from easy to hard, each with three named problems · covers our angle: **partial** - a list of problems, no practice order justification · fetched 2026-10-14 (*read*)
- **Our delta:** our own twenty and the order.

### T16-24 · DP with binary search or monotonic structures — Know · 🔲 not written
- **Read this:** [Divide and Conquer DP](https://cp-algorithms.com/dynamic_programming/divide-and-conquer-dp.html) · cp-algorithms · applies when the optimal split is monotone, taking O(m n²) down to O(m n log n) · covers our angle: **partial** - C++, and no monotonic deque or the n log n LIS · fetched 2026-10-14 (*read*)
- **Beyond the docs:** [DP optimization](https://soi.ch/wiki/dp-optimization/) · SOI wiki · convex hull trick and related optimisations · fetched 2026-10-14 (*headings only*)
- **Our delta:** the monotonic-deque jump problem, and the n log n LIS (see T16-07).

### T16-25 · Digit DP — Know · 🔲 not written
- **Read this:** [Digit DP (USACO Guide)](https://usaco.guide/gold/digit-dp) · USACO Guide · state of position, count, an `under` flag against the bound, and a `started` flag for leading zeros · covers our angle: **partial** - one solved problem, Java fragment, no step-by-step example · fetched 2026-10-14 (*read*)
- **Our delta:** one fully worked count in TypeScript.

### T16-26 · Probability and expectation DP — Know · 🔲 not written
- **Read this:** [688. Knight Probability in Chessboard](https://algo.monster/liteproblems/688) · AlgoMonster · `dp[h][i][j]` summing neighbours over 8 with a layered table, plus a two-layer space version, in Java and TypeScript · covers our angle: **partial** - no dice sums and no expectation · fetched 2026-10-14 (*read*)
- **Our delta:** a dice-sum example and an expected-value recurrence.
