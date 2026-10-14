---
title: "Link map · DSA · Part 8 (phases 19-20), file 1"
sidebar_label: "08 · the ladder and the plan (1)"
sidebar_position: 8
---

# Link map · DSA · Part 8 (phases 19-20), file 1

Rows T19-01 to T19-16 of `08-the-ladder-and-the-plan.md`. *read* = I read the passage that supports the claim; *headings only* = fetched at 200 and headings checked. Verified a second time on 2026-10-14: every URL returns 200, and pages whose text was cut short (account wall) are marked as intro only.
Pattern pages are chosen for the ladder problems named in each row; a delta says what the page does not cover.

### T19-01 · Arrays and hashing — Master · 🔲 not written
- **Read this:** [Array cheatsheet for coding interviews](https://www.techinterviewhandbook.org/algorithms/array/) · Tech Interview Handbook · techniques section names precomputation (prefix sums, hashing) and index-as-hash-key; lists two sum, product of array except self and contains duplicate as practice · covers our angle: **partial** - no frequency-map or bucket (top-k) walkthrough, no anagram problems · fetched 2026-10-14 (*read*)
- **Our delta:** the frequency-map and bucket (top-k) patterns, anagram keys, encode and decode strings, and the eight named problems.

### T19-02 · Two pointers — Master · 🔲 not written
- **Read this:** [Two Pointer Techniques for Array Problems](https://labuladong.online/algo/en/essential-technique/array-two-pointers-summary/) · labuladong · fast/slow and left/right families; works two sum on a sorted array and a palindrome check with expand-from-centre, and links out for n-sum · covers our angle: **partial** - no 3-sum body, container with most water or trapping rain water on this page · fetched 2026-10-14 (*read*)
- **Also good:** [Array cheatsheet](https://www.techinterviewhandbook.org/algorithms/array/) · Tech Interview Handbook · short two-pointers section that calls it a more general sliding window; lists 3Sum and Container With Most Water as practice · fetched 2026-10-14 (*read*)
- **Our delta:** TypeScript and Java code, the sort-then-converge reasoning for 3-sum, and the two-pointer argument behind trapping rain water.

### T19-03 · Sliding window — Master · 🔲 not written
- **Read this:** [Sliding Window Algorithm Code Template](https://labuladong.online/algo/en/essential-technique/sliding-window-framework/) · labuladong · one template applied to minimum window substring, permutation in string, find all anagrams and longest substring without repeats · covers our angle: **partial** - no stock, character-replacement or sliding-window-maximum problem · fetched 2026-10-14 (*read*)
- **Also good:** [Monotonic Queue to Solve Sliding Window Problems](https://labuladong.online/algo/en/data-structure/monotonic-queue/) · labuladong · builds the deque-based monotonic queue for sliding window maximum (LeetCode 239) · fetched 2026-10-14 (*read*)
- **Also good:** [Array cheatsheet](https://www.techinterviewhandbook.org/algorithms/array/) · Tech Interview Handbook · sliding window listed first among array techniques, with the visit-at-most-twice argument for O(n) · fetched 2026-10-14 (*read*)
- **Our delta:** stock as a degenerate window, longest repeating character replacement, and TypeScript and Java deques.

### T19-04 · Stack — Master · 🔲 not written
- **Read this:** [Monotonic Stack Code Template](https://labuladong.online/algo/en/data-structure/monotonic-stack/) · labuladong · next-greater-element template, the push-once-pop-once O(n) argument, then daily temperatures and the circular variant · covers our angle: **partial** - no car fleet or largest rectangle in histogram · fetched 2026-10-14 (*read*)
- **Also good:** [Stack cheatsheet for coding interviews](https://www.techinterviewhandbook.org/algorithms/stack/) · Tech Interview Handbook · corner cases, API table, and a practice list with valid parentheses, min stack, daily temperatures and largest rectangle; no technique prose on the monotonic idea · fetched 2026-10-14 (*read*)
- **Our delta:** car fleet, largest rectangle with sentinels, evaluate RPN and generate parentheses.

### T19-05 · Binary search — Master · 🔲 not written
- **Read this:** [Binary Search Template: Find Target, Left and Right Bound](https://labuladong.online/algo/en/essential-technique/binary-search-framework/) · labuladong · template with exact-match, left-bound and right-bound variants and the why behind each loop condition, the usual source of off-by-one bugs · covers our angle: **partial** - no search-on-answer, rotated array or median of two arrays · fetched 2026-10-14 (*read*)
- **Also good:** [Binary Search in Action](https://labuladong.online/algo/en/frequency-interview/binary-search-in-action/) · labuladong · intro frames Koko eating bananas and ship capacity as left-boundary searches over the answer; only the intro and boundary code are visible without an account, so the worked solutions are unread · fetched 2026-10-14 (*read*, intro only)
- **Also good:** [Sorting and searching cheatsheet](https://www.techinterviewhandbook.org/algorithms/sorting-searching/) · Tech Interview Handbook · sorted-input technique and a practice list with rotated arrays, 2D matrix and median of two sorted arrays · fetched 2026-10-14 (*read*)
- **Our delta:** rotated arrays, time-based store, median of two sorted arrays. Related page of ours, partial only: `docs/dsa/pages/phase-2-recursion-maths-bits/02i-binary-search-as-degenerate-divide-and-conquer.md`.

### T19-06 · Linked list — Master · 🔲 not written
- **Read this:** [Two Pointer Techniques for Linked List Problems](https://labuladong.online/algo/en/essential-technique/linked-list-skills-summary/) · labuladong · merge two sorted lists, merge k sorted lists with a heap, k-th from the end, middle, cycle detection and intersection · covers our angle: **partial** - no reverse, reorder, copy-random-pointer, add two numbers or k-group reversal · fetched 2026-10-14 (*read*)
- **Also good:** [Linked list cheatsheet for coding interviews](https://www.techinterviewhandbook.org/algorithms/linked-list/) · Tech Interview Handbook · sentinel nodes, common routines (reverse in place, middle, merge) and corner cases; practice list includes reorder list and remove nth from end · fetched 2026-10-14 (*read*)
- **Also good:** [Implementing LRU Cache like Building a Lego](https://labuladong.online/algo/en/data-structure/lru-cache/) · labuladong · designs the hash map plus doubly linked list for LeetCode 146 · fetched 2026-10-14 (*read*)
- **Our delta:** reverse in k-groups, copy with random pointer, find the duplicate number as cycle detection, and TypeScript and Java LRU.

### T19-07 · Trees — Master · 🔲 not written
- **Read this:** [Tree cheatsheet for coding interviews](https://www.techinterviewhandbook.org/algorithms/tree/) · Tech Interview Handbook · traversals, BST validation, recursion with the note that a function may need to return two values, level order by BFS, and a practice list that includes max path sum, serialise and build from traversals · covers our angle: **partial** - names the problems but works none of them · fetched 2026-10-14 (*read*)
- **Also good:** [Passing Values Down and Helper Functions](https://www.hellointerview.com/learn/code/depth-first-search/global-variables) · Hello Interview · count good nodes worked as carry-state recursion, with a helper function and a closure-held result list; sits beside their return-values page · fetched 2026-10-14 (*read*)
- **Our delta:** the return-a-value versus carry-state recursion split stated as one rule; max path sum, build from traversals, serialisation.

### T19-08 · Heaps — Master · 🔲 not written
- **Read this:** [Heap cheatsheet for coding interviews](https://www.techinterviewhandbook.org/algorithms/heap/) · Tech Interview Handbook · property, API per language (JavaScript: none built in), complexities, and the "mention of k" cue with a size-k min-heap for the top k · covers our angle: **partial** - merge k lists, k closest points, top-k and median are only named, none worked · fetched 2026-10-14 (*read*)
- **Also good:** [295. Find Median from Data Stream](https://neetcode.io/solutions/find-median-from-data-stream) · NeetCode · max-heap for the lower half, min-heap for the upper half, balance rule · fetched 2026-10-14 (*read*)
- **Our delta:** task scheduler, design-a-feed merge, last stone weight, and a JavaScript heap written by hand since the language has none.

### T19-09 · Backtracking — Master · ✅ written `docs/dsa/pages/phase-2-recursion-maths-bits/06-the-backtracking-skeleton.md`
- **Read this:** [Backtracking Algorithm Common Patterns and Code Template](https://labuladong.online/algo/en/essential-technique/backtrack-framework/) · labuladong · choose, recurse, undo loop worked through on permutations · covers our angle: **partial** - read only the permutations example; subsets, combinations and N-Queens are linked out, not worked · fetched 2026-10-14 (*read*)
- **Also good:** [Backtracking](https://en.wikipedia.org/wiki/Backtracking) · Wikipedia · definition, the search-tree view (the traversed tree is only a part of the potential tree) and the eight queens example · fetched 2026-10-14 (*read*)
- **Our delta:** our pages cover the skeleton, subsets and combinations (`06d`), permutations (`06e`), duplicates (`06f`, `06g`), pruning (`06h`, `06i`), N-Queens (`06j`) and grid marks for word search (`06k`) in the same folder; letter combinations and palindrome partitioning are not worked yet.

### T19-10 · Graphs — Master · 🔲 not written
- **Read this:** [Graph cheatsheet for coding interviews](https://www.techinterviewhandbook.org/algorithms/graph/) · Tech Interview Handbook · representations, DFS and BFS templates on a matrix, visited-set warning, and a Kahn-style topological sort; practice list names islands, rotting oranges, clone graph, Pacific Atlantic, course schedule, alien dictionary · covers our angle: **partial** - no multi-source BFS body, union-find or word ladder · fetched 2026-10-14 (*read*)
- **Also good:** [Topological Sorting](https://cp-algorithms.com/graph/topological-sort.html) · cp-algorithms · DFS exit-time method; says an order exists only if the graph has no cycle but leaves the cycle check to the DFS article, so course schedule needs that extra step; no in-degree (Kahn) version · fetched 2026-10-14 (*read*)
- **Our delta:** multi-source BFS grids, union-find (redundant connection, components, valid tree), word ladder, cycle detection folded into topological sort.

### T19-11 · One-dimensional DP — Master · 🔲 not written
- **Read this:** [Dynamic Programming Common Patterns and Code Template](https://labuladong.online/algo/en/essential-technique/dynamic-programming-framework/) · labuladong · state, choices and dp definition; Fibonacci then coin change from brute force to memo to table, with the optimal-substructure independence test · covers our angle: **partial** - coin change only; no house robber, LIS, word break or decode ways · fetched 2026-10-14 (*read*)
- **Also good:** [Dynamic programming cheatsheet for coding interviews](https://www.techinterviewhandbook.org/algorithms/dynamic-programming/) · Tech Interview Handbook · a thin page: one technique line (keep only the last values) and practice lists with climbing stairs, house robber, LIS, decode ways · no recurrences · fetched 2026-10-14 (*read*)
- **Our delta:** state, transition and base case for house robber, LIS, word break, partition equal subset sum.

### T19-12 · Two-dimensional DP — Master · 🔲 not written
- **Read this:** [Classic DP: Edit Distance](https://labuladong.online/algo/en/dynamic-programming/edit-distance/) · labuladong · two-string DP with pointers i and j, the insert, delete, replace and skip cases, base cases, then memo and table versions · covers our angle: **partial** - one of eleven row problems · fetched 2026-10-14 (*read*)
- **Also good:** [Dynamic programming cheatsheet for coding interviews](https://www.techinterviewhandbook.org/algorithms/dynamic-programming/) · Tech Interview Handbook · names LCS and unique paths, notes that the last two rows can replace the full table · no worked tables · fetched 2026-10-14 (*read*)
- **Our delta:** LCS table, grid paths, interval DP (burst balloons), regex matching, interleaving string, distinct subsequences.

### T19-13 · Intervals — Master · 🔲 not written
- **Read this:** [Interval cheatsheet for coding interviews](https://www.techinterviewhandbook.org/algorithms/interval/) · Tech Interview Handbook · sort by start, overlap test, merge step, and the clarify-whether-touching-counts warning · covers our angle: **partial** - meeting rooms II heap and the query problem not covered · fetched 2026-10-14 (*read*)
- **Also good:** [Intervals Overview](https://www.hellointerview.com/learn/code/intervals/overview) · Hello Interview · why non-overlapping intervals sorts by end time while merging sorts by start · fetched 2026-10-14 (*read*)
- **Our delta:** min-heap of end times for meeting rooms II; offline queries sorted by size.

### T19-14 · How the ladders nest — Master · ✅ written `docs/dsa/pages/phase-0-the-interview-and-practice/09-the-ladders.md`
- **Read this:** [NeetCode 150](https://neetcode.io/practice/practice/neetcode150) · NeetCode · states the list is the Blind 75 plus 75 more problems, meant for people who already know basic algorithms and data structures · covers our angle: **partial** - one sentence on the nesting; the interactive list is not readable as text and nothing on easy-medium-hard order · fetched 2026-10-14 (*read*)
- **Also good:** [Best practice questions](https://www.techinterviewhandbook.org/best-practice-questions/) · Tech Interview Handbook · the author of Blind 75 explains how the list spread, then gives a 50-question, 5-week schedule and points to Grind 75 as the customisable successor · fetched 2026-10-14 (*read*)
- **Our delta:** the page above already covers the three depths and the climbing order; add the 75-in-150 relation with a dated count.

### T19-15 · The review method — Master · ✅ written `docs/dsa/pages/phase-0-the-interview-and-practice/06-spaced-repetition-and-the-mistake-log.md`
- **Read this:** [LeetCode Tip 10: Planning a Spaced Repetition Schedule](https://www.redgreencode.com/leetcode-tip-10-planning-a-spaced-repetition-schedule/) · Red-Green-Code · why one solve is not enough, then a rule of thumb: daily at first, then double the gap (two, four, eight days) and adjust by difficulty · covers our angle: **partial** - a doubling schedule, not our three, seven, twenty-one days; no mistake-log format or sixty-second test · fetched 2026-10-14 (*read*)
- **Also good:** [Spaced repetition](https://en.wikipedia.org/wiki/Spaced_repetition) · Wikipedia · expanding intervals, the Leitner box system and the forgetting-curve background; it does not give any 3, 7, 21 schedule · fetched 2026-10-14 (*read*)
- **Our delta:** the 3, 7, 21 gaps are our method choice, not sourced; say so beside the doubling alternative.

### T19-16 · Tries — Understand · 🔲 not written
- **Read this:** [Trie cheatsheet for coding interviews](https://www.techinterviewhandbook.org/algorithms/trie/) · Tech Interview Handbook · O(m) operations, corner cases, dictionary-to-trie technique; practice list names add and search word and word search II · covers our angle: **partial** - names the problems, works none · fetched 2026-10-14 (*read*)
- **Also good:** [Trie](https://en.wikipedia.org/wiki/Trie) · Wikipedia · structure, insertion and lookup, and memory trade-offs against hash tables · fetched 2026-10-14 (*read*)
- **Our delta:** wildcard search and pruning a grid DFS with a trie.
