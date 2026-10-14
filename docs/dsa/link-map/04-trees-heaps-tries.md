---
title: "Link map · DSA · Part 4 (phases 9–11)"
sidebar_label: "04 · trees heaps tries"
sidebar_position: 4
---

# Link map · DSA · Part 4 (phases 9–11)

Covers every topic row of phases 9, 10 and 11 in `docs/dsa/syllabus/04-trees-heaps-and-tries.md`: binary trees and BSTs (T09-01 to T09-14), heaps and priority queues (T10-01 to T10-11), and tries, segment trees and Fenwick trees (T11-01 to T11-11). That is 36 rows. `docs/dsa/pages` holds pages for phases 0 to 2 only, so every block here is `🔲 not written`.
*read* = I read the passage that supports the claim; *headings only* = fetched at 200, headings or opening checked. Third-party links carry a date only where the page shows one. No `#anchors` are given. Where no good non-official explanation turned up, the block has no "Beyond the docs" line.

🔴 **Fetch notes.** LeetCode problem pages returned 403 to scripted requests, so none is linked. Baeldung, GeeksforGeeks and DesignGurus also failed (403 or 404) and are not used. Most explainers below are language-neutral; code samples are Python, Java or C++ unless noted. Our solutions are TypeScript first, Java second.

---

## Phase 9 — Binary trees and BSTs

### T09-01 · Traversals — Space · 🔲 not written
- **Read this:** [Tree traversal](https://en.wikipedia.org/wiki/Tree_traversal) · Wikipedia · pre, in and post-order, stack-based iterative pseudocode, queue-based level order, and a short Morris/threading section (*read*) · covers our angle: **partial** — Morris is named but has no pseudocode · fetched 2026-10-14
- **Beyond the docs:** [Iterative Binary Tree Traversals Using Stack](https://www.enjoyalgorithms.com/blog/iterative-binary-tree-traversals-using-stack/) · EnjoyAlgorithms · iterative pre, in and post-order with the one-stack `prevNode` trick for postorder, O(n) time and O(h) space (*read*) · language-neutral · fetched 2026-10-14
- **Our delta:** the O(1)-space Morris traversal worked step by step, since neither pick gives code for it.

### T09-02 · BFS by levels — Side · 🔲 not written
- **Read this:** [Breadth-First Search fundamentals](https://www.hellointerview.com/learn/code/breadth-first-search/fundamentals) · Hello Interview · captures the queue length before the inner loop to separate levels, with code (*read*) · covers our angle: **partial** — zigzag and right-side view appear only as sidebar links · fetched 2026-10-14
- **Also good:** [Level Order Traversal of Binary Tree](https://www.enjoyalgorithms.com/blog/level-order-traversal-of-binary-tree/) · EnjoyAlgorithms · O(n) time and O(width) space analysis; its code uses a single loop, not the per-level size trick (*read*) · fetched 2026-10-14
- **Our delta:** zigzag (reverse alternate levels) and right-side view (last node per level) built on the size-at-start loop.

### T09-03 · Height, depth, diameter and balance — Master · 🔲 not written
- **Read this:** [Answers to exercises on binary trees](https://www.cs.princeton.edu/courses/archive/fall01/cs126/exercises/trees-sol.html) · Princeton COS 126 · height definition, and a balance check that returns the height or -1 when unbalanced (*read*) · covers our angle: **partial** — no diameter · fetched 2026-10-14
- **Beyond the docs:** [Diameter of a Binary Tree](https://dev.to/jaspreet_singh_86ae1740ac/diameter-of-a-binary-tree-1a0a) · Jaspreet Singh, DEV Community · one postorder pass returning height while a shared variable tracks left plus right; says the path may or may not pass through the root (*read*) · fetched 2026-10-14
- **Our delta:** edge-count versus node-count conventions for diameter, stated once.

### T09-04 · Lowest common ancestor — Master · 🔲 not written
- **Read this:** [Lowest common ancestor](https://en.wikipedia.org/wiki/Lowest_common_ancestor) · Wikipedia · the definition (a node is its own descendant), the naive parent-pointer walk in O(h), and the Euler-tour/RMQ route to constant-time queries (*read*) · covers our angle: **partial** — no code, no postorder recursion · fetched 2026-10-14
- **Beyond the docs:** [Lowest Common Ancestor](https://www.interviewbit.com/blog/lowest-common-ancestor/) · InterviewBit, 2023-07-24 · recursive binary-tree version (both sides non-null) and the parent-pointer map version; the BST case is only a one-line FAQ note (*read*) · fetched 2026-10-14
- **Our delta:** BST walk-down and the two-pointer depth alignment for parent pointers.

### T09-05 · Path problems — Master · 🔲 not written
- **Read this:** [Binary Tree Maximum Path Sum](https://neetcode.io/solutions/binary-tree-maximum-path-sum) · NeetCode · global answer is `node + left + right`, returned value is `node + max(left, right)`, children clamped at zero, result seeded with the root value, O(n) (*read*) · covers our angle: **partial** — path-sum variants are not covered · fetched 2026-10-14
- **Our delta:** root-to-leaf, any-start downward and every-sum path-sum variants.

### T09-06 · Serialise and deserialise — Master · 🔲 not written
- **Read this:** [Serialize and Deserialize Binary Tree](https://neetcode.io/solutions/serialize-and-deserialize-binary-tree) · NeetCode · preorder DFS with `N` markers and a shared index, plus a BFS version, both O(n); pitfalls: no markers, delimiter choice, empty tree (*read*) · covers our angle: **full** · fetched 2026-10-14
- **Our delta:** why preorder plus markers is unique while inorder alone is not.

### T09-07 · Search-tree properties — Master · 🔲 not written
- **Read this:** [Binary Search Trees](https://algs4.cs.princeton.edu/32bst/) · Princeton Algorithms 3.2 · search, insert, floor, ceiling, select, rank, Hibbard deletion with the successor, inorder traversal (*read*) · covers our angle: **partial** — no bounds-based validation · fetched 2026-10-14
- **Also good:** [Binary search tree](https://en.wikipedia.org/wiki/Binary_search_tree) · Wikipedia · deletion's three cases and successor/predecessor pseudocode; no validation procedure (*read*) · fetched 2026-10-14
- **Beyond the docs:** [Deletion from BST](https://techiedelight.com/deletion-from-bst) · Techie Delight, updated 2025-09-15 · the three cases and the choice of inorder successor or predecessor (*read*) · fetched 2026-10-14
- **Our delta:** validation with open bounds, and the k-th smallest by inorder.

### T09-08 · The small recursive classics — Master · 🔲 not written
- **Read this:** [Binary tree](https://en.wikipedia.org/wiki/Binary_tree) · Wikipedia · recursive tree definitions and traversal, the base for the same-tree, mirror and invert functions (*read*) · covers our angle: **partial** — none of the four problems is solved there · fetched 2026-10-14
- **Our delta:** all four (same, subtree, symmetric, invert) as one two-pointer recursion. No good explainer was fetched and read.

### T09-09 · Constructing trees — Understand · 🔲 not written
- **Read this:** [Construct Binary Tree from Preorder and Inorder Traversal](https://docs.vultr.com/problem-set/construct-binary-tree-from-preorder-and-inorder-traversal) · Vultr Docs · inorder index map, shared preorder counter, bounds recursion, full worked example on `[3,9,20,15,7]` (*read*) · covers our angle: **partial** — states no complexity (it is O(n) with the map) · fetched 2026-10-14
- **Our delta:** the postorder-plus-inorder mirror image (consume from the end, build right first) and sorted array to balanced BST.

### T09-10 · Views and column order — Understand · 🔲 not written
- **Read this:** [Top View of Binary Tree](https://dev.to/jaspreet_singh_86ae1740ac/top-view-of-binary-tree-level-order-traversal-17di) · Jaspreet Singh, DEV Community · BFS with horizontal distance, first node per distance kept, worked example, O(N log N) with a `TreeMap` (*read*) · covers our angle: **partial** — no bottom view, vertical order or boundary · fetched 2026-10-14
- **Our delta:** bottom view (overwrite), vertical order with tie rules, boundary traversal.

### T09-11 · Balanced search trees — Understand · 🔲 not written
- **Read this:** [Balanced Search Trees](https://algs4.cs.princeton.edu/33balanced/) · Princeton Algorithms 3.3 · 2-3 trees, left-leaning red-black BSTs, rotations (*read*) · covers our angle: **partial** — AVL not covered, TreeMap only in an exercise · fetched 2026-10-14
- **Also good:** [TreeMap (Java SE 25)](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/util/TreeMap.html) · Oracle · a red-black `NavigableMap` with guaranteed log(n) for `containsKey`, `get`, `put`, `remove` (*read*) · fetched 2026-10-14
- **Our delta:** the AVL idea, and JavaScript's missing sorted map (npm libraries or a hand-rolled sorted array with binary search; none was vetted here).

### T09-12 · Tree DP — Understand · 🔲 not written
- **Read this:** [House Robber III](https://neetcode.io/solutions/house-robber-iii) · NeetCode · each call returns a pair (robbed, skipped), the recurrence, O(n) time (*read*) · covers our angle: **partial** — good nodes and longest same-value path are not covered · fetched 2026-10-14
- **Our delta:** the same return-a-state pattern for the other two problems, linked forward to Part 6.

### T09-13 · Trees in TypeScript and Java — Understand · 🔲 not written
- **Read this:** [Too much recursion](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Errors/Too_much_recursion) · MDN · the engine error (`RangeError` in Chrome and Safari, `InternalError` in Firefox) and that a valid base case can still overflow (*read*) · covers our angle: **partial** — nothing on trees or Java's `StackOverflowError` · fetched 2026-10-14
- **Also good:** [Binary tree](https://en.wikipedia.org/wiki/Binary_tree) · Wikipedia · degenerate trees behave like linked lists, with O(n) search (*read*) · fetched 2026-10-14
- **Our delta:** the iterative-stack fallback and the node classes interviewers supply.

### T09-14 · N-ary trees and the parent-array form — Array · 🔲 not written
- **Read this:** [Tree (abstract data type)](https://en.wikipedia.org/wiki/Tree_(abstract_data_type)) · Wikipedia · representations with child pointers, parent pointers, or both (*read*) · covers our angle: **partial** — no parent-array or edge-list construction · fetched 2026-10-14
- **Our delta:** edge list to rooted tree (BFS from a root, skip the node you came from), parent array to height. The GeeksforGeeks parent-array article returned 403.

---

## Phase 10 — Heaps and priority queues

### T10-01 · The binary heap — Master · 🔲 not written
- **Read this:** [Priority Queues](https://algs4.cs.princeton.edu/24pq/) · Princeton Algorithms 2.4 · array representation, swim and sink with code, insert at most 1 + lg n compares, remove-max at most 2 lg n, heapsort, indexed PQ (*read*) · covers our angle: **partial** — max-oriented, Java, no comparator-based min-heap in TypeScript · fetched 2026-10-14
- **Also good:** [PriorityQueue (Java SE 25)](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/util/PriorityQueue.html) · Oracle · comparator or natural order, no iteration-order guarantee, `offer` and `poll` O(log n), `remove(Object)` linear (*read*) · fetched 2026-10-14
- **Also good:** [Binary heap](https://en.wikipedia.org/wiki/Binary_heap) · Wikipedia · index formulas for root at 0 or 1, insert and extract, Floyd build-heap (*read*) · fetched 2026-10-14
- **Our delta:** a TypeScript heap with a comparator callback.

### T10-02 · Top-k problems — Master · 🔲 not written
- **Read this:** [Top K Frequent Elements: Heap vs Quickselect vs Bucket Sort](https://prachub.com/resources/top-k-frequent-elements) · PracHub, 2026-08-11 · comparison table: heap O(n log k), quickselect O(n) average and O(n²) worst, bucket O(n); streaming support (*read*) · covers our angle: **full** · fetched 2026-10-14
- **Also good:** [Quickselect](https://en.wikipedia.org/wiki/Quickselect) · Wikipedia · average and worst case, median of medians, introselect (*read*) · fetched 2026-10-14
- **Our delta:** k closest points, and a TypeScript heap capped at size k.

### T10-03 · Merging k sorted sequences — Master · 🔲 not written
- **Read this:** [heapq (Python)](https://docs.python.org/3/library/heapq.html) · Python docs · `heapq.merge` merges sorted inputs lazily without loading them all (*read*) · covers our angle: **partial** — Python only, no smallest-range problem · fetched 2026-10-14
- **Also good:** [632. Smallest Range Covering Elements from K Lists](https://dev.to/mdarifulhaque/632-smallest-range-covering-elements-from-k-lists-30d4) · Md Ariful Haque, DEV Community, 2024-10-13 · problem statement only; the solution text fell past the read window (*headings only*) · fetched 2026-10-14
- **Our delta:** the heap-of-heads loop with the running maximum for the smallest range, in O(N log k).

### T10-04 · Two heaps — Master · 🔲 not written
- **Read this:** [Mastering Median Statistics in Sliding Windows](https://hackernoon.com/coding-interview-prep-mastering-median-statistics-in-sliding-windows) · Aleksei Babenkov, HackerNoon, 2024-03-27 · max-heap for the lower half, min-heap for the upper half, a dictionary of pending deletions purged at the heap top (*read*) · covers our angle: **partial** — Python; the running median alone is not walked through · fetched 2026-10-14
- **Our delta:** the size-balancing rule while stale entries remain, and the plain running median.

### T10-05 · Scheduling with heaps — Master · 🔲 not written
- **Read this:** [Interval and Greedy Interview Patterns](https://techinterview.org/interval-greedy-interview-patterns/) · techinterview.org, 2026-04-16 · meeting rooms with a min-heap of end times, task scheduler with a max-heap plus cooldown queue, O(N log N) (*read*) · covers our angle: **partial** — no CPU simulation or earliest-deadline-first · fetched 2026-10-14
- **Our delta:** CPU task simulation and earliest deadline first.

### T10-06 · Heapify in linear time — Understand · 🔲 not written
- **Read this:** [Tutorial 2: Building heaps](https://www.cs.toronto.edu/~wgeorge/csc265/2013/09/19/tutorial-2-building-heaps.html) · University of Toronto CSC 265 · group nodes by level, sum 2^h times the sum of l/2^l, which converges to 2, giving O(n); correctness proof left as TODO (*read*) · covers our angle: **full** for the bound · fetched 2026-10-14
- **Also good:** [Heapsort](https://en.wikipedia.org/wiki/Heapsort) · Wikipedia · Floyd's sift-down build versus Williams' sift-up build, which can be O(n log n) (*read*) · fetched 2026-10-14
- **Our delta:** a small numeric example of the level counts.

### T10-07 · Greedy with heaps — Understand · 🔲 not written
- **Read this:** [502. IPO](https://neetcode.io/solutions/ipo) · NeetCode · min-heap by capital feeds a max-heap by profit, take the best affordable project each round, O(n log n) (*read*) · covers our angle: **partial** — ropes and string reorganisation are not covered · fetched 2026-10-14
- **Our delta:** connect ropes (merge the two smallest) and reorganise string (most frequent first, at most half the length).

### T10-08 · Lazy deletion and indexed heaps — Understand · 🔲 not written
- **Read this:** [heapq, Priority Queue Implementation Notes](https://docs.python.org/3/library/heapq.html) · Python docs · mark an entry removed and push a new one rather than reorder the heap, with a tie-breaker counter and working code (*read*) · covers our angle: **partial** — no indexed heap and no decrease-key · fetched 2026-10-14
- **Also good:** [Priority Queues](https://algs4.cs.princeton.edu/24pq/) · Princeton Algorithms 2.4 · names `IndexMinPQ` and `IndexMaxPQ` (*read*) · fetched 2026-10-14
- **Our delta:** why Dijkstra usually pushes duplicates instead of using decrease-key. A Stanford CS166 PDF was fetched but its text was unreadable.

### T10-09 · Heap sort and selection — Know · 🔲 not written
- **Read this:** [Heapsort](https://en.wikipedia.org/wiki/Heapsort) · Wikipedia · in place, unstable, O(n log n) in all cases, O(1) auxiliary space (*read*) · covers our angle: **partial** — no selection · fetched 2026-10-14
- **Also good:** [Quickselect](https://en.wikipedia.org/wiki/Quickselect) · Wikipedia · O(n) average, O(n²) worst, median of medians (*read*) · fetched 2026-10-14
- **Our delta:** when each is the right answer for a single order statistic.

### T10-10 · Heaps in real systems — Know · 🔲 not written
- **Read this:** [8 Timer Implementation Patterns](https://hackernoon.com/8-timer-implementation-patterns-for-systems-and-network-software) · vijayananda, HackerNoon, 2026-09-06 · min-heap timers arm one system timer; timer wheels give O(1) insert at large counts (*read*) · covers our angle: **partial** — the Linux and BGP claim is the article's own and unchecked · fetched 2026-10-14
- **Our delta:** job runners and rate limiters.

### T10-11 · Variants — Know · 🔲 not written
- **Read this:** [D-ary heap](https://en.wikipedia.org/wiki/D-ary_heap) · Wikipedia · insert O(log n / log d), delete-min O(d log n / log d), better cache behaviour in practice (*read*) · covers our angle: **full** for concept only · fetched 2026-10-14
- **Our delta:** a one-line note on Fibonacci heaps, nothing more.

---

## Phase 11 — Tries, segment trees and Fenwick trees

### T11-01 · The trie — Master · 🔲 not written
- **Read this:** [Trie](https://en.wikipedia.org/wiki/Trie) · Wikipedia · search, insert and delete in O(m), memory cost of one link per alphabet character, and trie versus hash table (*read*) · covers our angle: **partial** — no array-versus-map benchmark · fetched 2026-10-14
- **Also good:** [Tries](https://algs4.cs.princeton.edu/52trie/) · Princeton Algorithms 5.2 · R-way tries and ternary search tries; the page says it is under construction (*read*) · fetched 2026-10-14
- **Our delta:** 26-slot array against a `Map` per node, and when a hash set of prefixes is smaller.

### T11-02 · Trie applications — Master · 🔲 not written
- **Read this:** [Trie (Prefix Tree) Interview Patterns](https://techinterview.org/trie-prefix-tree-interview-patterns/) · techinterview.org, 2026-04-17 · autocomplete with a top-K cache per node, Word Search II, Replace Words, wildcard search; O(L) per operation (*read*) · covers our angle: **partial** — no longest common prefix · fetched 2026-10-14
- **Our delta:** longest common prefix (walk while a node has one child and is not a word end).

### T11-03 · The binary trie — Understand · 🔲 not written
- **Read this:** [Maximum XOR of Two Numbers in an Array](https://docs.vultr.com/problem-set/maximum-xor-of-two-numbers-in-an-array) · Vultr Docs · MSB-first binary trie, walk toward the opposite bit, worked table for 25 giving 28 (*read*) · covers our angle: **partial** — no complexity given (O(n times 31)) and no XOR-over-a-range queries · fetched 2026-10-14
- **Our delta:** XOR queries over a range.

### T11-04 · The segment tree — Understand · 🔲 not written
- **Read this:** [Segment Tree](https://cp-algorithms.com/data_structures/segment_tree.html) · cp-algorithms · build O(n), sum query and point update O(log n), 4n memory (*read*) · covers our angle: **full** · fetched 2026-10-14
- **Our delta:** the short recursive form, written to survive pressure.

### T11-05 · The Fenwick tree — Understand · 🔲 not written
- **Read this:** [Fenwick Tree](https://cp-algorithms.com/data_structures/fenwick.html) · cp-algorithms · prefix sums, point update via `i + (i & -i)`, range update tricks (*read*) · covers our angle: **partial** — no inversion counting; it only lists practice problems · fetched 2026-10-14
- **Beyond the docs:** [Counting Inversions using BIT](https://codemia.io/knowledge-hub/path/counting_inversions_using_bit) · Codemia · rank compression, right-to-left scan; its worked example has a wrong rank mapping, so use the method and not the numbers (*read*) · fetched 2026-10-14
- **Our delta:** order statistics by descent on the tree.

### T11-06 · When these actually appear — Understand · 🔲 not written
- **Read this:** [Segment Tree and Fenwick Tree: Range Query Interview Patterns](https://www.techinterview.org/post/3233460884/segment-tree-fenwick-tree-interview/?format=md) · techinterview.org, updated 2026-07-05 · Fenwick for prefix sums with inverses, segment tree for min and max; the page lists inversion counting and counting problems as typical (*read*) · covers our angle: **partial** — the company-type expectations are not covered · fetched 2026-10-14
- **Our delta:** Count of Smaller Numbers After Self, and honest odds by company type.

### T11-07 · Lazy propagation — Know · 🔲 not written
- **Read this:** [Lazy Tags in Segment Trees](https://soi.ch/wiki/lazy-segment-trees) · soi.ch wiki · tag semantics, push-down before touching children, worked example on `[1,2,3,4]` (*read*) · covers our angle: **full** · fetched 2026-10-14
- **Also good:** [Segment Tree, Range Updates](https://cp-algorithms.com/data_structures/segment_tree.html) · cp-algorithms · addition and assignment on segments (*headings only*) · fetched 2026-10-14
- **Our delta:** none beyond a TypeScript version.

### T11-08 · The sparse table — Time · 🔲 not written
- **Read this:** [Sparse Table](https://cp-algorithms.com/data_structures/sparse-table.html) · cp-algorithms · O(N log N) build, O(1) range minimum from two overlapping blocks; overlap is safe for idempotent operations only (*read*) · covers our angle: **full** · fetched 2026-10-14
- **Our delta:** none.

### T11-09 · Suffix structures — Know · 🔲 not written
- **Read this:** [Suffix Array](https://cp-algorithms.com/string/suffix-array.html) · cp-algorithms · O(n log n) construction, substring search, LCP, distinct substrings (*read*) · covers our angle: **partial** — suffix automata are not covered · fetched 2026-10-14
- **Our delta:** why interviews rarely ask for them.

### T11-10 · Tries in real systems — Know · 🔲 not written
- **Read this:** [Radix tree](https://en.wikipedia.org/wiki/Radix_tree) · Wikipedia · compressed trie, IP routing, the Linux kernel page cache (*read*) · covers our angle: **partial** — HTTP routers are not mentioned · fetched 2026-10-14
- **Our delta:** HTTP router matching, and the autocomplete service in the System Design track.

### T11-11 · Order-statistic and interval trees — Know · 🔲 not written
- **Read this:** [Order statistic tree](https://en.wikipedia.org/wiki/Order_statistic_tree) · Wikipedia · subtree size per node gives select and rank in O(log n) (*read*) · covers our angle: **full** · fetched 2026-10-14
- **Also good:** [Interval tree](https://en.wikipedia.org/wiki/Interval_tree) · Wikipedia · the augmented tree stores the maximum high endpoint per subtree (*read*) · fetched 2026-10-14
- **Our delta:** none; concept only.
