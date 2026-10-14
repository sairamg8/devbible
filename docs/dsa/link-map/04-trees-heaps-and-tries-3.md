---
title: "Link map · DSA · Part 4 (phases 9-11), file 3"
sidebar_label: "04 · trees, heaps, tries (3)"
sidebar_position: 4
---

# Link map · DSA · Part 4, file 3

Rows T11-01 to T11-11 (phase 11, tries, segment trees and Fenwick trees).
*read* = a verifier read the passage that supports the claim on 2026-10-14 (NeetCode solution pages are server-rendered, so their text was read too); *headings only* = fetched at 200 and headings or keywords checked. No page of ours covers these phases yet.

### T11-01 · The trie — Master · 🔲 not written
- **Read this:** [Implement Trie](https://neetcode.io/solutions/implement-trie-prefix-tree) · NeetCode · insert, search, startsWith with a 26-slot array node and a hash-map node; pitfall: search against startsWith · covers our angle: **partial** - no memory cost or hash-set comparison · fetched 2026-10-14 (*read*)
- **Also good:** [Trie Interview Patterns](https://techinterview.org/trie-interview-patterns/) · techinterview.org · closing table of trie against hash set (prefix queries against exact membership), higher memory per character, map children for Unicode · fetched 2026-10-14 (*read*)
- **Also good:** [Trie](https://en.wikipedia.org/wiki/Trie) · Wikipedia · O(m) lookup, replacement for hash tables, and vector-of-pointers against linked-list node trade-offs · fetched 2026-10-14 (*read*)
- **Also good:** [Tries](https://algs4.cs.princeton.edu/52trie/) · Princeton Algorithms · short outline page: R-way trie and ternary search trie (code is in linked TrieST.java and TST.java), wildcard and prefix match, lazy against eager delete · fetched 2026-10-14 (*read*)
- **Our delta:** when a hash set of prefixes beats a trie, with numbers.

### T11-02 · Trie applications — Master · 🔲 not written
- **Read this:** [Trie Interview Patterns: A Complete Guide](https://techinterview.org/trie-interview-patterns/) · techinterview.org · wildcard dictionary, word search II with pruning, autocomplete with top-k cached per node, replace words, bitwise trie for max XOR · covers our angle: **partial** - no longest-common-prefix walk · fetched 2026-10-14 (*read*)
- **Also good:** [Word Search II](https://neetcode.io/solutions/word-search-ii) · NeetCode · backtracking, then trie plus hash set, then trie with reference counts that cut dead branches · fetched 2026-10-14 (*read*)
- **Our delta:** longest common prefix by single-child walk.

### T11-03 · The binary trie — Understand · 🔲 not written
- **Read this:** [Maximum XOR of Two Numbers in an Array](https://docs.vultr.com/problem-set/maximum-xor-of-two-numbers-in-an-array) · Vultr Docs · bitwise trie with greedy opposite-bit walk (Java) · covers our angle: **partial** - range XOR queries absent · fetched 2026-10-14 (*read*)
- **Also good:** [Trie Interview Patterns](https://techinterview.org/trie-interview-patterns/) · techinterview.org · its bitwise-trie section for LeetCode 421 · fetched 2026-10-14 (*read*)
- **Our delta:** XOR queries over a range (offline).

### T11-04 · The segment tree — Understand · 🔲 not written
- **Read this:** [Segment Tree](https://cp-algorithms.com/data_structures/segment_tree.html) · cp-algorithms · build, point update and range query, memory-efficient form, plus lazy propagation and other extensions · covers our angle: **partial** - C++ only · fetched 2026-10-14 (*read*)
- **Also good:** [Point Update Range Sum](https://usaco.guide/gold/PURS) · USACO Guide · segment tree for point update and range query on any associative operation, recursive and iterative versions (Python code on the page); mostly resource links; warns that recursive Python is too slow for CSES · fetched 2026-10-14 (*read*)
- **Our delta:** a TypeScript recursive version.

### T11-05 · The Fenwick tree — Understand · 🔲 not written
- **Read this:** [Fenwick Tree](https://cp-algorithms.com/data_structures/fenwick.html) · cp-algorithms · prefix sums with point updates, range operations, 2D; inversions appear only as practice-problem links · covers our angle: **partial** - no inversion counting or order statistics explained · fetched 2026-10-14 (*read*)
- **Also good:** [Point Update Range Sum](https://usaco.guide/gold/PURS) · USACO Guide · short BIT section with order-statistic-with-a-BIT and inversion-counting subsections (Python code, thin prose) · fetched 2026-10-14 (*read*)
- **Our delta:** counting inversions and order statistics, written out.

### T11-06 · When these actually appear — Understand · 🔲 not written
- **Read this:** [Segment Tree and Fenwick Tree Interview Patterns](https://techinterview.org/segment-tree-fenwick-tree-patterns/) · techinterview.org · when-to-use-which table and key problems (307, 315, 327, 699); says only "senior engineering interviews and competitive programming" · covers our angle: **partial** - no company expectations · fetched 2026-10-14 (*read*)
- **Also good:** [315. Count of Smaller Numbers After Self](https://walkccc.me/LeetCode/problems/315/) · walkccc · Fenwick, two segment-tree and merge-sort solutions (code only, little prose) · fetched 2026-10-14 (*read*)
- **Our delta:** honest expectations by company type; no source found, so say it is a judgement.

### T11-07 · Lazy propagation — Know · 🔲 not written
- **Read this:** [Lazy Segment Trees (Recursive)](https://soi.ch/wiki/lazy-segment-trees) · SOI wiki · additive updates with pending tags pushed down on read, then combining additive and destructive updates (C++) · covers our angle: full · fetched 2026-10-14 (*read*)
- **Also good:** [Segment Tree](https://cp-algorithms.com/data_structures/segment_tree.html) · cp-algorithms · lazy propagation section: addition, assignment, add-and-max · fetched 2026-10-14 (*read*)

### T11-08 · The sparse table — Know · 🔲 not written
- **Read this:** [Sparse Table](https://cp-algorithms.com/data_structures/sparse-table.html) · cp-algorithms · overlapping power-of-two blocks, O(1) minimum on an immutable array, idempotent functions only · covers our angle: full · fetched 2026-10-14 (*read*)
- **Also good:** [Range minimum query](https://en.wikipedia.org/wiki/Range_minimum_query) · Wikipedia · the same power-of-two table without the name "sparse table", plus the Cartesian-tree route to O(n) space · fetched 2026-10-14 (*read*)

### T11-09 · Suffix structures — Know · 🔲 not written
- **Read this:** [Suffix Structures](https://usaco.guide/adv/string-suffix) · USACO Guide · suffix automaton, suffix tree and suffix array with conversions, C++ code, resource links · covers our angle: **partial** - what they solve is one sentence; no note on interview frequency · fetched 2026-10-14 (*read*)
- **Also good:** [Suffix Array](https://cp-algorithms.com/string/suffix-array.html) · cp-algorithms · O(n log n) construction and applications (substring search, distinct substrings, LCP) · fetched 2026-10-14 (*read*)
- **Also good:** [Suffix Automaton](https://cp-algorithms.com/string/suffix-automaton.html) · cp-algorithms · linear construction and applications (occurrence check, distinct substrings, k-th substring) · fetched 2026-10-14 (*read*)
- **Our delta:** why interviews rarely ask these; no source found, so say it is a judgement.

### T11-10 · Tries in real systems — Know · 🔲 not written
- **Read this:** [Radix tree](https://en.wikipedia.org/wiki/Radix_tree) · Wikipedia · compressed trie; IP routing, inverted indexes, Linux and FreeBSD kernel uses · covers our angle: **partial** - no HTTP router detail · fetched 2026-10-14 (*read*)
- **Our delta:** HTTP routers; the httprouter source page returned 403, so it is not listed.

### T11-11 · Order-statistic and interval trees — Know · 🔲 not written
- **Read this:** [Order statistic tree](https://en.wikipedia.org/wiki/Order_statistic_tree) · Wikipedia · subtree-size augmentation for select and rank in O(log n) · covers our angle: **partial** - interval trees on another page · fetched 2026-10-14 (*read*)
- **Also good:** [Interval tree](https://en.wikipedia.org/wiki/Interval_tree) · Wikipedia · augmented tree keeping the maximum upper endpoint per node for overlap queries · fetched 2026-10-14 (*read*)
