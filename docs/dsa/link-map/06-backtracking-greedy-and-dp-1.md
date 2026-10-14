---
title: "Link map · DSA · Part 6 (phases 14-16), file 1"
sidebar_label: "06 · backtracking, greedy, DP (1)"
sidebar_position: 6
---

# Link map · DSA · Part 6, file 1 (phase 14)

Covers the 13 rows of phase 14 (backtracking) in `docs/dsa/syllabus/06-backtracking-greedy-and-dp.md`. No page of ours covers backtracking yet. *read* = I read the passage that supports the claim; *headings only* = fetched at 200 and headings checked.

### T14-01 · The template — Master · 🔲 not written
- **Read this:** [Backtracking overview](https://www.hellointerview.com/learn/code/backtracking/overview) · Hello Interview · path list shared across calls, pop before returning, copy the path at the leaf · covers our angle: **partial** - taught through one tree problem, no choose/explore/unchoose naming, no subsets or permutations · fetched 2026-10-14 (*read*)
- **Also good:** [Backtracking](https://en.wikipedia.org/wiki/Backtracking) · Wikipedia · the general definition and pseudocode · fetched 2026-10-14
- **Our delta:** the named three-step template and the copy-at-leaf pitfall shown on a flat array problem in TypeScript.

### T14-02 · Subsets, permutations and combinations — Master · 🔲 not written
- **Read this:** [Backtracking: subsets, permutations, combinations (labuladong)](https://labuladong.gitbook.io/algo-en/interview/subset-permutation-combination) · labuladong · all three enumerations in the no-duplicate and duplicate, reuse and no-reuse variants, with the sort-and-skip rules · covers our angle: **partial** - Java only, no complexity analysis · fetched 2026-10-14 (*read*)
- **Also good:** [Backtracking LeetCode pattern: permutations vs subsets in Java](https://hackernoon.com/backtracking-leetcode-pattern-permutations-vs-subsets-in-java) · HackerNoon · states O(N·2^N) and O(N·N!) with the copying cost · fetched 2026-10-14
- **Our delta:** TypeScript versions and the complexity statement.

### T14-03 · Combination sum — Master · 🔲 not written
- **Read this:** [39. Combination Sum](https://algo.monster/liteproblems/39) · AlgoMonster · reuse by passing the same index, start index against reordered duplicates, sort then cut off by the remaining sum · covers our angle: full (Java and TypeScript code) · fetched 2026-10-14 (*read*)

### T14-04 · N-Queens — Master · 🔲 not written
- **Read this:** [51. N-Queens](https://algo.monster/liteproblems/51) · AlgoMonster · one queen per row, column array plus two diagonal arrays keyed by sum and difference, with Java and TypeScript · covers our angle: **partial** - the counting variant (N-Queens II) is not shown · fetched 2026-10-14 (*read*)
- **Also good:** [Eight queens puzzle](https://en.wikipedia.org/wiki/Eight_queens_puzzle) · Wikipedia · solution counts per n and the bitwise-tracking remark · fetched 2026-10-14
- **Our delta:** counting against listing, using sets instead of arrays.

### T14-05 · Word search — Master · 🔲 not written
- **Read this:** [212. Word Search II](https://algo.monster/liteproblems/212) · AlgoMonster · DFS from every cell, in-place `'#'` marking restored on return, trie pruning of dead prefixes · covers our angle: full (Java and TypeScript) · fetched 2026-10-14 (*read*)
- **Also good:** [79. Word Search](https://algo.monster/liteproblems/79) · AlgoMonster · the single-word version without a trie · fetched 2026-10-14

### T14-06 · Generate parentheses and letter combinations — Master · 🔲 not written
- **Read this:** [Generate Parentheses without the brute-force detour](https://www.techinterview.org/post/3233476885/generate-parentheses-backtracking/) · techinterview.org · open while opens are below n, close only while closes are below opens; groups letter combinations under the same pattern · covers our angle: **partial** - Python code, letter combinations only mentioned · fetched 2026-10-14 (*read*)
- **Our delta:** a worked letter-combinations example (enumerate only, no pruning) in TypeScript and Java.

### T14-07 · Pruning and ordering — Master · 🔲 not written
- **Read this:** [Branch and bound](https://en.wikipedia.org/wiki/Branch_and_bound) · Wikipedia · discard a node whose bound cannot beat the best solution so far; lists 0/1 knapsack as an application · covers our angle: **partial** - generic, no sorted-candidates or remaining-sum examples · fetched 2026-10-14 (*read*)
- **Also good:** [39. Combination Sum](https://algo.monster/liteproblems/39) · AlgoMonster · the sorted-candidate cutoff in practice · fetched 2026-10-14
- **Our delta:** the interview-sized version: sort first, bound by remaining sum, keep a best-so-far.

### T14-08 · Complexity of backtracking — Master · 🔲 not written
- **Read this:** [Backtracking LeetCode pattern: permutations vs subsets in Java](https://hackernoon.com/backtracking-leetcode-pattern-permutations-vs-subsets-in-java) · HackerNoon · derives 2^N calls from the recurrence and adds the O(N) copy per result · covers our angle: **partial** - Java, no word on saying it to the interviewer · fetched 2026-10-14 (*read*)
- **Our delta:** the output-size bound as the honest lower bound, and the spoken one-liner.

### T14-09 · Sudoku solver — Understand · 🔲 not written
- **Read this:** [Sudoku Solver: Backtracking with Constraint Propagation](https://www.techinterview.org/post/3233460180/sudoku-solver-backtracking-with-constraint-propagation/) · techinterview.org · row, column and box sets with O(1) checks, then fewest-candidates cell ordering · covers our angle: **partial** - Python code · fetched 2026-10-14 (*headings only*)
- **Beyond the docs:** [Solving Every Sudoku Puzzle](https://norvig.com/sudoku.html) · Peter Norvig · constraint propagation plus search, picking the square with fewest possibilities · fetched 2026-10-14 (*read*)
- **Our delta:** a plain row/column/box solver in TypeScript and Java without propagation.

### T14-10 · Palindrome partitioning — Understand · 🔲 not written
- **Read this:** [131. Palindrome Partitioning](https://algo.monster/liteproblems/131) · AlgoMonster · fills an `n x n` palindrome table first, then backtracks over palindromic prefixes; states O(n·2^n) · covers our angle: full (Java and TypeScript) · fetched 2026-10-14 (*read*)

### T14-11 · String backtracking — Understand · 🔲 not written
- **Read this:** [93. Restore IP Addresses](https://algo.monster/liteproblems/93) · AlgoMonster · segment length at most 3, leading-zero and 255 cutoffs, exactly four segments · covers our angle: **partial** - the operator-insertion problem is on another page · fetched 2026-10-14 (*read*)
- **Also good:** [282. Expression Add Operators](https://algo.monster/liteproblems/282) · AlgoMonster · carries the previous operand so multiplication can undo the last add; `long` in Java · fetched 2026-10-14

### T14-12 · Iterative enumeration by bitmask — Understand · 🔲 not written
- **Read this:** [Iterating through submasks](https://cp-algorithms.com/algebra/all-submasks.html) · cp-algorithms · the `(s - 1) & m` loop and the 3^n total over all masks · covers our angle: **partial** - C++ only, and it is submask enumeration, not the plain 0 to 2^n minus 1 subset loop · fetched 2026-10-14 (*read*)
- **Our delta:** the plain integer-as-subset loop with TypeScript's 32-bit shift limit and Java `int` and `long`.

### T14-13 · Constraint satisfaction, generally — Know · 🔲 not written
- **Read this:** [Constraint satisfaction problem](https://en.wikipedia.org/wiki/Constraint_satisfaction_problem) · Wikipedia · formal definition of variables, domains and constraints, and basic backtracking over partial assignments · covers our angle: full for vocabulary · fetched 2026-10-14 (*read*)
- **Also good:** [Constraint Satisfaction lecture notes](https://www.comp.nus.edu.sg/~kanmy/courses/3243_2004/lectureNotes/m5-csp-pub_files/v3_outline_expanded.htm) · NUS · backtracking, forward checking and arc consistency in outline form · fetched 2026-10-14
