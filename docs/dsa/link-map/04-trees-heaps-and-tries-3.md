---
title: "Link map · DSA · Part 4 (phases 9-11), file 3"
sidebar_label: "04 · trees, heaps, tries (3)"
sidebar_position: 4
---

# Link map · DSA · Part 4, file 3

Rows T11-01 to T11-11 (phase 11, tries, segment trees and Fenwick trees).
*read* = I read the passage; *headings only* = fetched at 200 and headings or keywords checked. Every row below is *headings only*. No page of ours covers these phases yet.

### T11-01 · The trie — Master · 🔲 not written
- **Read this:** [Tries](https://algs4.cs.princeton.edu/52trie/) · Princeton Algorithms · R-way trie with code and memory discussion · covers our angle: **partial** - Java, no hash-set comparison · fetched 2026-10-14 (*headings only*)
- **Also good:** [Implement Trie](https://neetcode.io/solutions/implement-trie-prefix-tree) · NeetCode · insert, search, startsWith · fetched 2026-10-14
- **Also good:** [Trie](https://en.wikipedia.org/wiki/Trie) · Wikipedia · definition and cost trade-offs · fetched 2026-10-14
- **Our delta:** when a hash set of prefixes beats a trie.

### T11-02 · Trie applications — Master · 🔲 not written
- **Read this:** [Trie Interview Patterns: A Complete Guide](https://techinterview.org/trie-interview-patterns/) · techinterview.org · word search, replace words, prefix problems · covers our angle: **partial** - autocomplete thin · fetched 2026-10-14 (*headings only*)
- **Also good:** [Word Search II](https://neetcode.io/solutions/word-search-ii) · NeetCode · trie pruning inside a grid DFS · fetched 2026-10-14
- **Our delta:** longest common prefix by single-child walk.

### T11-03 · The binary trie — Understand · 🔲 not written
- **Read this:** [Maximum XOR of Two Numbers in an Array](https://docs.vultr.com/problem-set/maximum-xor-of-two-numbers-in-an-array) · Vultr Docs · bitwise trie with greedy opposite-bit walk · covers our angle: **partial** - range XOR queries absent · fetched 2026-10-14 (*headings only*)
- **Our delta:** XOR queries over a range (offline).

### T11-04 · The segment tree — Understand · 🔲 not written
- **Read this:** [Segment Tree](https://cp-algorithms.com/data_structures/segment_tree.html) · cp-algorithms · build, point update and range query, plus extensions · covers our angle: **partial** - C++ only · fetched 2026-10-14 (*headings only*)
- **Also good:** [Segment tree](https://en.wikipedia.org/wiki/Segment_tree) · Wikipedia · definition · fetched 2026-10-14
- **Our delta:** a TypeScript recursive version.

### T11-05 · The Fenwick tree — Understand · 🔲 not written
- **Read this:** [Fenwick Tree](https://cp-algorithms.com/data_structures/fenwick.html) · cp-algorithms · prefix sums with updates and range extensions · covers our angle: **partial** - inversions elsewhere · fetched 2026-10-14 (*headings only*)
- **Also good:** [Range Sum Queries with Updates](https://usaco.guide/gold/PURS) · USACO Guide · Fenwick against segment tree · fetched 2026-10-14
- **Our delta:** counting inversions and order statistics.

### T11-06 · When these actually appear — Understand · 🔲 not written
- **Read this:** [Segment Tree and Fenwick Tree Interview Patterns](https://techinterview.org/segment-tree-fenwick-tree-patterns/) · techinterview.org · which problems call for them · covers our angle: **partial** - no company expectations · fetched 2026-10-14 (*headings only*)
- **Also good:** [315. Count of Smaller Numbers After Self](https://walkccc.me/LeetCode/problems/315/) · walkccc · Fenwick solution · fetched 2026-10-14
- **Our delta:** honest expectations by company type.

### T11-07 · Lazy propagation — Know · 🔲 not written
- **Read this:** [Lazy Segment Trees (Recursive)](https://soi.ch/wiki/lazy-segment-trees) · SOI wiki · deferred tags in the recursive form · covers our angle: full · fetched 2026-10-14 (*headings only*)
- **Also good:** [Segment Tree](https://cp-algorithms.com/data_structures/segment_tree.html) · cp-algorithms · has a lazy propagation section · fetched 2026-10-14

### T11-08 · The sparse table — Know · 🔲 not written
- **Read this:** [Sparse Table](https://cp-algorithms.com/data_structures/sparse-table.html) · cp-algorithms · overlapping power-of-two blocks, constant-time minimum · covers our angle: full · fetched 2026-10-14 (*headings only*)
- **Also good:** [Range minimum query](https://en.wikipedia.org/wiki/Range_minimum_query) · Wikipedia · alternatives · fetched 2026-10-14

### T11-09 · Suffix structures — Know · 🔲 not written
- **Read this:** [Suffix Structures](https://usaco.guide/adv/string-suffix) · USACO Guide · what suffix arrays and automata solve · covers our angle: full · fetched 2026-10-14 (*headings only*)
- **Also good:** [Suffix Array](https://cp-algorithms.com/string/suffix-array.html) · cp-algorithms · construction · fetched 2026-10-14
- **Also good:** [Suffix Automaton](https://cp-algorithms.com/string/suffix-automaton.html) · cp-algorithms · construction · fetched 2026-10-14

### T11-10 · Tries in real systems — Know · 🔲 not written
- **Read this:** [Radix tree](https://en.wikipedia.org/wiki/Radix_tree) · Wikipedia · compressed trie and its use in IP routing · covers our angle: **partial** - no HTTP router detail · fetched 2026-10-14 (*headings only*)
- **Our delta:** HTTP routers; the httprouter source page returned 403, so it is not listed.

### T11-11 · Order-statistic and interval trees — Know · 🔲 not written
- **Read this:** [Order statistic tree](https://en.wikipedia.org/wiki/Order_statistic_tree) · Wikipedia · subtree-size augmentation for rank and select · covers our angle: **partial** - interval trees on another page · fetched 2026-10-14 (*headings only*)
- **Also good:** [Interval tree](https://en.wikipedia.org/wiki/Interval_tree) · Wikipedia · augmented tree for overlap queries · fetched 2026-10-14
