---
title: "Link map · DSA · Part 3 (phases 6-8), file 3"
sidebar_label: "03 · linear structures, binary search (3)"
sidebar_position: 3
---

# Link map · DSA · Part 3 · file 3

Covers rows T08-01 to T08-12 (phase 8, binary search).
*read* = I read the passage; *headings only* = fetched at 200 and headings checked.

### T08-01 · The template — Master · 🔲 not written
- **Read this:** [Binary Search (Silver)](https://usaco.guide/silver/binary-search) · USACO Guide · the first-true and last-true forms on a monotone function, then off-by-one, negative bounds and overflow as named mistakes · covers our angle: **partial** - no loop invariant written out as a sentence · fetched 2026-10-14 (*read*)
- **Also good:** [Binary search](https://cp-algorithms.com/num_methods/binary_search.html) · cp-algorithms · lower and upper bound with an implementation · fetched 2026-10-14
- **Beyond the docs:** [Extra, Extra - Nearly All Binary Searches and Mergesorts are Broken](https://research.google/blog/extra-extra-read-all-about-it-nearly-all-binary-searches-and-mergesorts-are-broken/) · Joshua Bloch · the midpoint overflow bug found in the JDK's own search · fetched 2026-10-14 (*read*)
- **Our delta:** state the invariant before the loop, and the one-element hidden test that breaks `<=` versus `<`.

### T08-02 · On a sorted array — Master · 🔲 not written
- **Read this:** [Binary Search Algorithm Code Template](https://labuladong.online/en/algo/essential-technique/binary-search-framework/) · labuladong · find a target, then the left and right boundary, and why each bound moves as it does · covers our angle: **partial** - closest element is not a section · fetched 2026-10-14 (*read*)
- **Also good:** [Binary search](https://cp-algorithms.com/num_methods/binary_search.html) · cp-algorithms · the lower-bound and upper-bound definitions that give insert position directly · fetched 2026-10-14
- **Our delta:** the closest-element case as lower bound plus a neighbour comparison.

### T08-03 · Rotated sorted arrays — Master · 🔲 not written
- **Read this:** [Search in Rotated Sorted Array](https://www.hellointerview.com/learn/code/binary-search/search-in-rotated-sorted-array) · Hello Interview · explanation, algorithm, solution for the target search · covers our angle: **partial** - no duplicates case · fetched 2026-10-14 (*read*)
- **Also good:** [Find Minimum In Rotated Sorted Array](https://neetcode.io/solutions/find-minimum-in-rotated-sorted-array) · NeetCode · brute force, binary search, and a lower-bound form · fetched 2026-10-14
- **Also good:** [81. Search in Rotated Sorted Array II](https://walkccc.me/LeetCode/problems/81/) · walkccc · code-only: the duplicates version, which skips both ends when they tie · fetched 2026-10-14
- **Our delta:** why duplicates degrade the worst case to linear.

### T08-04 · Search on the answer — Master · 🔲 not written
- **Read this:** [Binary search - Binary search on the answer](https://cp-algorithms.com/num_methods/binary_search.html) · cp-algorithms · the section on searching an arbitrary predicate and on the answer, with the monotonicity requirement · covers our angle: **partial** - few worked interview problems · fetched 2026-10-14 (*read*)
- **Also good:** [Koko Eating Bananas](https://neetcode.io/solutions/koko-eating-bananas) · NeetCode · brute force then binary search over speed · fetched 2026-10-14
- **Also good:** [410. Split Array Largest Sum](https://walkccc.me/LeetCode/problems/410/) · walkccc · code-only: top-down and bottom-up DP first, then the binary search on the maximum sum · fetched 2026-10-14
- **Also good:** [719. Find K-th Smallest Pair Distance](https://walkccc.me/LeetCode/problems/719/) · walkccc · code-only: count pairs at most d, search over d · fetched 2026-10-14
- **Also good:** [1011. Capacity To Ship Packages Within D Days](https://walkccc.me/LeetCode/problems/1011/) · walkccc · code-only: the shipping-capacity check · fetched 2026-10-14
- **Beyond the docs:** [Binary Search](https://www.topcoder.com/thrive/articles/Binary%20Search) · TopCoder Thrive · the discrete binary search on a predicate, a monotonicity theorem, a real-number section, and a worked split-the-cabinets problem (the same shape as split-array largest sum) · fetched 2026-10-14 (*read*)

### T08-05 · Recognising binary search — Master · 🔲 not written
- **Read this:** [Binary Search (Silver)](https://usaco.guide/silver/binary-search) · USACO Guide · frames it as a monotone function and the "minimum x such that" search · covers our angle: full · fetched 2026-10-14 (*read*)
- **Also good:** [Binary search](https://cp-algorithms.com/num_methods/binary_search.html) · cp-algorithms · its search on an arbitrary predicate section · fetched 2026-10-14
- **Our delta:** a short checklist of phrasings (minimum, maximum, at most k) as interview signals.

### T08-06 · In TypeScript and Java — Master · 🔲 not written
- **Read this:** [Arrays (Java SE 21)](https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/util/Arrays.html) · Oracle · `binarySearch` returns a negative value encoding the insertion point; duplicate matches are unspecified · covers our angle: **partial** - JavaScript has no built-in, so nothing to cite for TypeScript · fetched 2026-10-14 (*read*)
- **Our delta:** the TypeScript hand-written `lowerBound`, and decoding the Java return as minus the result minus one.

### T08-07 · On a two-dimensional matrix — Understand · 🔲 not written
- **Read this:** [Search a 2D Matrix](https://neetcode.io/solutions/search-a-2d-matrix) · NeetCode · brute force, staircase, then one- and two-pass binary search over the flattened matrix · covers our angle: **partial** - no k-th smallest · fetched 2026-10-14 (*read*)
- **Also good:** [378. Kth Smallest Element in a Sorted Matrix](https://algo.monster/liteproblems/378) · AlgoMonster · binary search over the value range, with the bottom-left staircase walk as the counting step · fetched 2026-10-14
- **Also good:** [240. Search a 2D Matrix II](https://walkccc.me/LeetCode/problems/240/) · walkccc · code-only: the staircase walk · fetched 2026-10-14

### T08-08 · Median of two sorted arrays — Understand · 🔲 not written
- **Read this:** [Median of Two Sorted Arrays](https://neetcode.io/solutions/median-of-two-sorted-arrays) · NeetCode · brute force and two pointers first, then the binary-search partition · covers our angle: full · fetched 2026-10-14 (*read*)

### T08-09 · Unknown or unbounded length — Understand · 🔲 not written
- **Read this:** [Exponential search](https://en.wikipedia.org/wiki/Exponential_search) · Wikipedia · doubling to find a range, then binary search inside it, for unbounded lists · covers our angle: full · fetched 2026-10-14 (*read*)
- **Also good:** [Binary search - Search with powers of 2](https://cp-algorithms.com/num_methods/binary_search.html) · cp-algorithms · the same idea as a bit-by-bit descent · fetched 2026-10-14

### T08-10 · Floating-point binary search — Know · 🔲 not written
- **Read this:** [Binary search - Continuous search](https://cp-algorithms.com/num_methods/binary_search.html) · cp-algorithms · real-valued predicate, fixed iterations or an epsilon · covers our angle: **partial** - no square-root example in that section · fetched 2026-10-14 (*read*)
- **Beyond the docs:** [Binary Search](https://www.topcoder.com/thrive/articles/Binary%20Search) · TopCoder Thrive · its real-numbers section advises a fixed iteration count or a relative tolerance · fetched 2026-10-14 (*read*)
- **Our delta:** a square-root loop and why a fixed iteration count beats comparing floats for equality.

### T08-11 · Ternary search and unimodal functions — Know · 🔲 not written
- **Read this:** [Ternary Search](https://cp-algorithms.com/num_methods/ternary_search.html) · cp-algorithms · unimodal definition, the two-probe step, integer arguments and golden-section search · covers our angle: full · fetched 2026-10-14 (*read*)
- **Also good:** [Ternary search](https://usaco.guide/gold/ternary-search) · USACO Guide · the same idea with contest problems · fetched 2026-10-14

### T08-12 · The same idea in trees and databases — Know · 🔲 not written
- **Read this:** [The Balanced Search Tree (B-Tree) in SQL Databases](https://use-the-index-luke.com/sql/anatomy/the-tree) · Use The Index, Luke · how a B-tree lookup descends from root to leaf, written for database users · covers our angle: **partial** - no binary search tree preview · fetched 2026-10-14 (*read*)
- **Also good:** [Binary search tree](https://en.wikipedia.org/wiki/Binary_search_tree) · Wikipedia · the in-memory ordered structure the search generalises to · fetched 2026-10-14
- **Also good:** [B-Tree Indexes (PostgreSQL docs)](https://www.postgresql.org/docs/current/btree.html) · PostgreSQL · what a B-tree index supports and its implementation notes · fetched 2026-10-14
- **Our delta:** one paragraph tying binary search over a sorted page to the tree descent.
