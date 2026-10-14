---
title: "Link map · DSA · Part 4 (phases 9–11)"
sidebar_label: "04 · trees heaps tries"
sidebar_position: 4
---

# Link map · DSA · Part 4 (phases 9–11)

Covers every topic row of phases 9, 10 and 11 in `docs/dsa/syllabus/04-trees-heaps-and-tries.md`: binary trees and BSTs (T09-01 to T09-14), heaps and priority queues (T10-01 to T10-11), and tries, segment trees and Fenwick trees (T11-01 to T11-11). That is 36 rows, each with a block, and tier words match the syllabus table. `docs/dsa/pages` holds pages for phases 0 to 2 only, so every block here is `🔲 not written`.
*read* = I read the passage that supports the claim; *headings only* = fetched at 200, headings or opening checked. Third-party links carry a date only where the page shows one. No `#anchors` are given. **Read this** and **Also good** are canonical references (Wikipedia, Princeton Algorithms, cp-algorithms, MIT, language docs, VisuAlgo); **Beyond the docs** is a non-canonical explainer. Where no canonical page covers a problem, the block says so and the best walkthrough sits under **Read this**. Where no good explainer turned up after searching, the block has no "Beyond the docs" line.

🔴 **Fetch notes.** LeetCode problem pages returned 403 to scripted requests, so none is linked. Baeldung, GeeksforGeeks, DesignGurus, Codeforces and engineeringhulk.com also failed (403 or 404) and are not used. Dropped after reading: two HackerNoon articles (the sliding-window median article is labelled AI-assisted and its code has unexplained balance and import problems; the timer article is AI-assisted and cites no source for its Linux or BGP claim) and a Codemia inversion-counting page (its worked example maps `[3, 1, 2]` to ranks `[2, 1, 3]` and gets 1 inversion, where the correct ranks are `[3, 1, 2]` and the count is 2). Most explainers below are language-neutral; code samples are Python, Java or C++ unless noted. Our solutions are TypeScript first, Java second.

---

## Phase 9 — Binary trees and BSTs

### T09-01 · Traversals — Master · 🔲 not written
- **Read this:** [Tree traversal](https://en.wikipedia.org/wiki/Tree_traversal) · Wikipedia · pre, in and post-order, stack-based iterative pseudocode, queue-based level order, and a short Morris/threading section (*read*) · covers our angle: **partial** — Morris is named with a three-step outline but has no pseudocode; no time bounds are stated · fetched 2026-10-14
- **Also good:** [Binary Tree Morris Inorder Traversal](https://dev.to/jaspreet_singh_86ae1740ac/binary-tree-morris-inorder-traversal-97h) · Jaspreet Singh, DEV Community · the three cases (no left child, create a thread, remove a thread), a numbered dry run, Java, O(N) time and O(1) extra space (*read*) · fetched 2026-10-14
- **Beyond the docs:** [Iterative Binary Tree Traversals Using Stack](https://www.enjoyalgorithms.com/blog/iterative-binary-tree-traversals-using-stack/) · EnjoyAlgorithms · iterative pre, in and post-order with the one-stack `prevNode` trick for postorder; O(n) time and O(h) space are stated for the first three, implied for the one-stack version; C++-style pseudocode (*read*) · fetched 2026-10-14
- **Our delta:** Morris in TypeScript, including the preorder variant and the fact that the tree is mutated while it runs.

### T09-02 · BFS by levels — Master · 🔲 not written
- **Read this:** [Tree traversal](https://en.wikipedia.org/wiki/Tree_traversal) · Wikipedia · the queue-based `levelorder` procedure, with space proportional to the widest level (*read*) · covers our angle: **partial** — no per-level loop, zigzag or right-side view · fetched 2026-10-14
- **Also good:** [Level Order Traversal of Binary Tree](https://www.enjoyalgorithms.com/blog/level-order-traversal-of-binary-tree/) · EnjoyAlgorithms · O(n) time and O(width) space analysis; its code uses a single loop, not the per-level size trick (*read*) · fetched 2026-10-14
- **Beyond the docs:** [Breadth-First Search fundamentals](https://www.hellointerview.com/learn/code/breadth-first-search/fundamentals) · Hello Interview · sets `level_size = len(queue)` before the inner loop to separate levels, Python, O(N) time and O(N) space; zigzag and right-side view appear only as sidebar links (*read*) · fetched 2026-10-14
- **Our delta:** zigzag (reverse alternate levels) and right-side view (last node per level) built on the size-at-start loop.

### T09-03 · Height, depth, diameter and balance — Master · 🔲 not written
- **Read this:** [Answers to exercises on binary trees](https://www.cs.princeton.edu/courses/archive/fall01/cs126/exercises/trees-sol.html) · Princeton COS 126 · height as a recursive function (0 for the empty tree, else 1 plus the larger child height), and a balance check that returns the height or -1 when unbalanced (*read*) · covers our angle: **partial** — no diameter, and height is not defined in words · fetched 2026-10-14
- **Beyond the docs:** [Diameter of a Binary Tree](https://dev.to/jaspreet_singh_86ae1740ac/diameter-of-a-binary-tree-1a0a) · Jaspreet Singh, DEV Community · one postorder pass returning height while a shared variable tracks left plus right; O(N) time and O(H) space against an O(N²) brute force; says the path may or may not pass through the root; Java (*read*) · fetched 2026-10-14
- **Our delta:** edge-count versus node-count conventions for diameter, stated once.

### T09-04 · Lowest common ancestor — Master · 🔲 not written
- **Read this:** [Lowest common ancestor](https://en.wikipedia.org/wiki/Lowest_common_ancestor) · Wikipedia · the definition (each node is a descendant of itself), the naive parent-pointer walk in O(h), and the Euler-tour/RMQ route to constant-time queries (*read*) · covers our angle: **partial** — no code, no postorder recursion · fetched 2026-10-14
- **Beyond the docs:** [Lowest Common Ancestor](https://www.interviewbit.com/blog/lowest-common-ancestor/) · InterviewBit, 2023-07-24 · recursive binary-tree version (both sides non-null, O(N) time) and the parent-pointer map version, in C++, Java and Python; the BST case is only a one-line FAQ note (*read*) · fetched 2026-10-14
- **Our delta:** BST walk-down and the two-pointer depth alignment for parent pointers.

### T09-05 · Path problems — Master · 🔲 not written
- **Read this:** [Binary Tree Maximum Path Sum](https://neetcode.io/solutions/binary-tree-maximum-path-sum) · NeetCode · no canonical reference covers this problem; global answer is `node + left + right`, returned value is `node + max(left, right)`, children clamped at zero, result seeded with the root value, O(n) time, O(n) worst-case stack, nine languages (*read*) · covers our angle: **partial** — path-sum variants are not covered · fetched 2026-10-14
- **Beyond the docs:** [Tree Dynamic Programming Interview Patterns: Diameter, Path Sum & House Robber](https://www.techinterview.org/post/3233462024/tree-dp-interview-patterns/) · techinterview.org, 2026-04-16 · post-order DFS that returns a value to the parent while a global tracks the answer; diameter and maximum path sum in Python, no Big-O given (*read*) · fetched 2026-10-14
- **Our delta:** root-to-leaf, any-start downward and every-sum path-sum variants.

### T09-06 · Serialise and deserialise — Master · 🔲 not written
- **Read this:** [Serialize and Deserialize Binary Tree](https://neetcode.io/solutions/serialize-and-deserialize-binary-tree) · NeetCode · no canonical reference covers this problem; preorder DFS with `N` markers and a shared index, plus a BFS version, both O(n) time and space; pitfalls: no markers, delimiter choice, empty tree (*read*) · covers our angle: **full** · fetched 2026-10-14
- **Our delta:** why preorder plus markers is unique while inorder alone is not.

### T09-07 · Search-tree properties — Master · 🔲 not written
- **Read this:** [Binary Search Trees](https://algs4.cs.princeton.edu/32bst/) · Princeton Algorithms 3.2 · search, insert, floor, ceiling, select, rank, Hibbard deletion with the successor, inorder traversal (*read*) · covers our angle: **partial** — no bounds-based validation; `isBST()` is left as a creative exercise · fetched 2026-10-14
- **Also good:** [Binary search tree](https://en.wikipedia.org/wiki/Binary_search_tree) · Wikipedia · deletion's three cases and successor/predecessor pseudocode, average Θ(log n) and worst O(n); no validation procedure (*read*) · fetched 2026-10-14
- **Beyond the docs:** [Deletion from BST](https://techiedelight.com/deletion-from-bst) · Techie Delight, updated 2025-09-15 · the three cases and the choice of inorder successor or predecessor (*read*) · fetched 2026-10-14
- **Our delta:** validation with open bounds, and the k-th smallest by inorder.

### T09-08 · The small recursive classics — Master · 🔲 not written
- **Read this:** [Binary tree](https://en.wikipedia.org/wiki/Binary_tree) · Wikipedia · recursive tree definitions and traversal, the base for the same-tree, mirror and invert functions (*read*) · covers our angle: **partial** — none of the four problems is solved there · fetched 2026-10-14
- **Beyond the docs:** [DSA Fundamentals: Binary Trees, Mastering Tree Traversal and Recursion](https://dev.to/jayk0001/dsa-fundamentals-binary-trees-mastering-tree-traversal-and-recursion-4gmg) · jayk0001, DEV Community, 2025-11-12 · invert, symmetric (DFS and BFS) and subtree via a recursive `isSameTree`, all Python; same-tree itself is shown only with a BFS queue, and the height and depth definitions contradict each other (*read*) · fetched 2026-10-14
- **Our delta:** all four (same, subtree, symmetric, invert) as one two-pointer recursion.

### T09-09 · Constructing trees — Understand · 🔲 not written
- **Read this:** [Construct Binary Tree from Preorder and Inorder Traversal](https://docs.vultr.com/problem-set/construct-binary-tree-from-preorder-and-inorder-traversal) · Vultr Docs · no canonical reference covers this problem; inorder index map, shared preorder counter, bounds recursion, C++ code, input and output for `[3,9,20,15,7]` and `[9,3,15,20,7]` without a step trace (*read*) · covers our angle: **partial** — states no complexity (it is O(n) with the map) · fetched 2026-10-14
- **Also good:** [Construct a balanced BST from the given keys](https://techiedelight.com/construct-balanced-bst-given-keys/) · Techie Delight, updated 2025-09-15 · middle element as root, recurse on each half, C++, Java and Python; its O(n log n) includes the sort, the build itself is O(n) (*read*) · fetched 2026-10-14
- **Our delta:** the postorder-plus-inorder mirror image (consume from the end, build right first).

### T09-10 · Views and column order — Understand · 🔲 not written
- **Read this:** [Top View of Binary Tree](https://dev.to/jaspreet_singh_86ae1740ac/top-view-of-binary-tree-level-order-traversal-17di) · Jaspreet Singh, DEV Community · no canonical reference covers this problem; BFS with horizontal distance, first node per distance kept, worked example giving `[4,2,1,3,7]`, O(N log N) with a `TreeMap`, Java (*read*) · covers our angle: **partial** — no vertical order or boundary · fetched 2026-10-14
- **Also good:** [Bottom View of Binary Tree](https://dev.to/jaspreet_singh_86ae1740ac/bottom-view-of-binary-tree-2h2k) · Jaspreet Singh, DEV Community · overwrite the map entry at each distance during BFS, O(N log N), Java; it does not address two nodes at the same depth and distance (*read*) · fetched 2026-10-14
- **Our delta:** the tie rule for equal depth and distance, vertical order, boundary traversal.

### T09-11 · Balanced search trees — Understand · 🔲 not written
- **Read this:** [Balanced Search Trees](https://algs4.cs.princeton.edu/33balanced/) · Princeton Algorithms 3.3 · 2-3 trees, left-leaning red-black BSTs, rotations; height no more than 2 lg N (*read*) · covers our angle: **partial** — AVL not covered, TreeMap only in an exercise · fetched 2026-10-14
- **Also good:** [AVL tree](https://en.wikipedia.org/wiki/AVL_tree) · Wikipedia · balance factor of -1, 0 or 1, single and double rotations, O(log n) operations, height about 1.44 log n against 2 log n for red-black (*read*) · fetched 2026-10-14
- **Also good:** [TreeMap (Java SE 25)](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/util/TreeMap.html) · Oracle · a red-black `NavigableMap` with guaranteed log(n) for `containsKey`, `get`, `put`, `remove` (*read*) · fetched 2026-10-14
- **Our delta:** JavaScript's missing sorted map (npm libraries or a hand-rolled sorted array with binary search; none was vetted here).

### T09-12 · Tree DP — Understand · 🔲 not written
- **Read this:** [House Robber III](https://neetcode.io/solutions/house-robber-iii) · NeetCode · no canonical reference covers this problem; each call returns a pair (with root, without root), the recurrence, O(n) time and O(n) stack (*read*) · covers our angle: **partial** — good nodes and longest same-value path are not covered · fetched 2026-10-14
- **Beyond the docs:** [Tree Dynamic Programming Interview Patterns: Diameter, Path Sum & House Robber](https://www.techinterview.org/post/3233462024/tree-dp-interview-patterns/) · techinterview.org, 2026-04-16 · the return-a-value template, with house robber III and longest univalue path in Python; no Big-O, and no good-nodes problem (*read*) · fetched 2026-10-14
- **Our delta:** good nodes, where the running maximum is passed down rather than returned; linked forward to Part 6.

### T09-13 · Trees in TypeScript and Java — Understand · 🔲 not written
- **Read this:** [Too much recursion](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Errors/Too_much_recursion) · MDN · the engine error (`RangeError` in Chrome and Safari, `InternalError` in Firefox); its example shows a base case set too far away still overflows (*read*) · covers our angle: **partial** — nothing on trees or Java's `StackOverflowError` · fetched 2026-10-14
- **Also good:** [Binary tree](https://en.wikipedia.org/wiki/Binary_tree) · Wikipedia · degenerate trees behave like linked lists, with O(n) search (*read*) · fetched 2026-10-14
- **Our delta:** the iterative-stack fallback and the node classes interviewers supply.

### T09-14 · N-ary trees and the parent-array form — Know · 🔲 not written
- **Read this:** [Tree (abstract data type)](https://en.wikipedia.org/wiki/Tree_(abstract_data_type)) · Wikipedia · representations with child pointers, parent pointers, or both (*read*) · covers our angle: **partial** — no parent-array or edge-list construction · fetched 2026-10-14
- **Beyond the docs:** [Find height of a binary tree represented by the parent array](https://techiedelight.com/find-height-of-binary-tree-represented-by-parent-array) · Techie Delight, updated 2025-09-09 · depth by walking parent links, naive O(n²), memoised and bottom-up O(n), in C, Java and Python; framed for binary trees though the logic only uses parent links (*read*) · fetched 2026-10-14
- **Our delta:** edge list to rooted tree (BFS from a root, skip the node you came from), and the n-ary traversals.

---

## Phase 10 — Heaps and priority queues

### T10-01 · The binary heap — Master · 🔲 not written
- **Read this:** [Priority Queues](https://algs4.cs.princeton.edu/24pq/) · Princeton Algorithms 2.4 · array representation, swim and sink with code, insert at most 1 + lg n compares, remove-max at most 2 lg n, heapsort, indexed PQ (*read*) · covers our angle: **partial** — max-oriented, Java, no comparator-based min-heap in TypeScript · fetched 2026-10-14
- **Also good:** [Binary heap](https://en.wikipedia.org/wiki/Binary_heap) · Wikipedia · index formulas for root at 0 or 1, insert and extract, Floyd build-heap; its infobox says insert is O(1) average while the detailed table says Θ(log n) (*read*) · fetched 2026-10-14
- **Also good:** [Binary heap visualiser](https://visualgo.net/en/heap) · VisuAlgo · step through insert, extract, build in O(N) and O(N log N) and heapsort, tree and array views side by side (*read*) · fetched 2026-10-14
- **Also good:** [PriorityQueue (Java SE 25)](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/util/PriorityQueue.html) · Oracle · comparator or natural order, no iteration-order guarantee, `offer` and `poll` O(log n), `remove(Object)` linear (*read*) · fetched 2026-10-14
- **Our delta:** a TypeScript heap with a comparator callback.

### T10-02 · Top-k problems — Master · 🔲 not written
- **Read this:** [heapq (Python)](https://docs.python.org/3/library/heapq.html) · Python docs · `nlargest` and `nsmallest` are equivalent to sorting and slicing, best for small n, with `min` and `max` better for n of 1 (*read*) · covers our angle: **partial** — Python, no quickselect or frequency counting · fetched 2026-10-14
- **Also good:** [Quickselect](https://en.wikipedia.org/wiki/Quickselect) · Wikipedia · average O(n), worst O(n²), median of medians, introselect (*read*) · fetched 2026-10-14
- **Beyond the docs:** [Top K Frequent Elements: Heap vs Quickselect vs Bucket Sort](https://prachub.com/resources/top-k-frequent-elements) · PracHub, 2026-08-11 · comparison table: heap O(n log k), quickselect O(n) average and O(n²) worst, bucket O(n); Python. Its claim that the frequency heap "works on a stream" is overstated, since counts are not final until the stream ends (*read*) · fetched 2026-10-14
- **Our delta:** k closest points, a TypeScript heap capped at size k, and the streaming caveat above.

### T10-03 · Merging k sorted sequences — Master · 🔲 not written
- **Read this:** [heapq (Python)](https://docs.python.org/3/library/heapq.html) · Python docs · `heapq.merge` merges sorted inputs lazily without loading them all (*read*) · covers our angle: **partial** — Python only, no smallest-range problem · fetched 2026-10-14
- **Beyond the docs:** [632. Smallest Range Covering Elements from K Lists](https://dev.to/mdarifulhaque/632-smallest-range-covering-elements-from-k-lists-30d4) · Md Ariful Haque, DEV Community, 2024-10-13 · min-heap of one element per list while tracking the maximum, O(n log k) with n the total element count and O(k) space; the code is PHP and is elided in the text I read (*read*) · fetched 2026-10-14
- **Our delta:** the heap-of-heads loop with the running maximum for the smallest range, in O(N log k), in TypeScript.

### T10-04 · Two heaps — Master · 🔲 not written
- **Read this:** [295. Find Median From Data Stream](https://neetcode.io/solutions/find-median-from-data-stream) · NeetCode · no canonical reference covers this pattern; max-heap for the lower half, min-heap for the upper, sizes within one, `addNum` O(log n) and `findMedian` O(1), nine languages (*read*) · covers our angle: **partial** — no sliding window or deletion · fetched 2026-10-14
- **Beyond the docs:** [480. Sliding Window Median](https://algo.monster/liteproblems/480) · AlgoMonster · two heaps plus a `delayed` count map, prune a heap only when the stale value reaches its top, with TypeScript, Python, Java and C++; it claims heaps hold at most k elements, which is false while stale entries remain (*read*) · fetched 2026-10-14
- **Our delta:** the size-balancing rule while stale entries remain (track logical sizes), and the plain running median.

### T10-05 · Scheduling with heaps — Master · 🔲 not written
- **Read this:** [Earliest deadline first scheduling](https://en.wikipedia.org/wiki/Earliest_deadline_first_scheduling) · Wikipedia · a priority queue ordered by deadline; it never mentions a heap and gives no Big-O for queue operations (*read*) · covers our angle: **partial** — no meeting rooms, task scheduler or CPU simulation · fetched 2026-10-14
- **Beyond the docs:** [Interval and Greedy Interview Patterns](https://www.techinterview.org/post/3233460897/interval-greedy-interview-patterns/) · techinterview.org, 2026-04-16 · meeting rooms with a min-heap of end times, task scheduler with a max-heap plus cooldown queue, O(N log N), Python; the merge-intervals code fails on empty input (*read*) · fetched 2026-10-14
- **Our delta:** CPU task simulation and earliest deadline first with a heap.

### T10-06 · Heapify in linear time — Understand · 🔲 not written
- **Read this:** [Tutorial 2: Building heaps](https://www.cs.toronto.edu/~wgeorge/csc265/2013/09/19/tutorial-2-building-heaps.html) · University of Toronto CSC 265 · group nodes by level, sum 2^h times the sum of l/2^l, which converges to 2, giving O(n); correctness proof left as TODO, and its pseudocode is flawed (empty swaps, Python 2 `range` that skips the root), so take the bound only (*read*) · covers our angle: **full** for the bound · fetched 2026-10-14
- **Also good:** [Heapsort](https://en.wikipedia.org/wiki/Heapsort) · Wikipedia · Floyd's sift-down build is O(n); Williams' sift-up build can be O(n log n) (*read*) · fetched 2026-10-14
- **Also good:** [Build-heap analysis, DSA notes](https://gtl.csa.iisc.ac.in/dsa/node139.html) · IISc course notes · sum of heights for a perfect tree equals 2^(h+1) - 1 - (h + 1), then the 2^h to 2^(h+1) node range bounds the complete case (*read*) · fetched 2026-10-14
- **Our delta:** a small numeric example of the level counts.

### T10-07 · Greedy with heaps — Understand · 🔲 not written
- **Read this:** [Huffman coding](https://en.wikipedia.org/wiki/Huffman_coding) · Wikipedia · repeatedly remove the two lowest-weight nodes from a priority queue and re-insert their sum, O(n log n); this is the connect-ropes mechanism (*read*) · covers our angle: **partial** — no ropes, no capital selection, no string reorganisation · fetched 2026-10-14
- **Beyond the docs:** [502. IPO](https://neetcode.io/solutions/ipo) · NeetCode · min-heap by capital feeds a max-heap by profit, take the best affordable project each round, O(n log n) time, O(n) space, nine languages (*read*) · fetched 2026-10-14
- **Our delta:** connect ropes as the Huffman merge, and reorganise string (most frequent first, at most half the length).

### T10-08 · Lazy deletion and indexed heaps — Understand · 🔲 not written
- **Read this:** [heapq, Priority Queue Implementation Notes](https://docs.python.org/3/library/heapq.html) · Python docs · mark an entry removed and push a new one rather than reorder the heap, with a tie-breaker counter and working code (*read*) · covers our angle: **partial** — no indexed heap and no decrease-key (the page never uses the term) · fetched 2026-10-14
- **Also good:** [Priority Queues](https://algs4.cs.princeton.edu/24pq/) · Princeton Algorithms 2.4 · names `IndexMinPQ` and `IndexMaxPQ` (*read*) · fetched 2026-10-14
- **Also good:** [Priority Queues and Dijkstra's Algorithm](https://www3.cs.stonybrook.edu/~rezaul/papers/TR-07-54.html) · UT Austin technical report TR-07-54, October 2007 · concludes a plain insert and delete-min queue without decrease-key performs better in most cases; I read the abstract page only (*headings only*) · fetched 2026-10-14
- **Our delta:** why Dijkstra usually pushes duplicates instead of using decrease-key, and when an indexed heap is still worth it.

### T10-09 · Heap sort and selection — Know · 🔲 not written
- **Read this:** [Heapsort](https://en.wikipedia.org/wiki/Heapsort) · Wikipedia · in place, not stable, O(1) auxiliary space; worst and average O(n log n), best O(n) only when all keys are equal (*read*) · covers our angle: **partial** — no selection · fetched 2026-10-14
- **Also good:** [Quickselect](https://en.wikipedia.org/wiki/Quickselect) · Wikipedia · O(n) average, O(n²) worst, median of medians (*read*) · fetched 2026-10-14
- **Our delta:** when each is the right answer for a single order statistic.

### T10-10 · Heaps in real systems — Know · 🔲 not written
- **Read this:** [timer: Refactor the timer wheel, patch V3 cover letter](https://lkml.iu.edu/hypermail/linux/kernel/1606.3/00404.html) · Thomas Gleixner, Linux kernel mailing list, 2016-06-24 · confirms the kernel's timer is a wheel and describes removing cascading by adding a wheel level (*read*) · covers our angle: **partial** — a changelog, not a tutorial, and it says nothing about heaps · fetched 2026-10-14
- **Beyond the docs:** [Hashed and Hierarchical Timing Wheels](https://blog.acolyer.org/2015/11/23/hashed-and-hierarchical-timing-wheels/) · Adrian Colyer, the morning paper, 2015-11-23 · summary of Varghese and Lauck: tree timers insert in O(log n), a simple wheel starts and stops in O(1) at a memory cost, hashed and hierarchical wheels; Kafka is the real-world example, Linux is not mentioned (*read*) · fetched 2026-10-14
- **Our delta:** why a min-heap timer arms one system timer, plus job runners and rate limiters.

### T10-11 · Variants — Know · 🔲 not written
- **Read this:** [D-ary heap](https://en.wikipedia.org/wiki/D-ary_heap) · Wikipedia · insert O(log n / log d), delete-min O(d log n / log d), better cache behaviour in practice (hedged: "may be due to"); notes Fibonacci heaps have the better Dijkstra bound but d-ary heaps are generally at least as fast in practice (*read*) · covers our angle: **full** for concept only · fetched 2026-10-14
- **Our delta:** a one-line note on Fibonacci heaps, nothing more.

---

## Phase 11 — Tries, segment trees and Fenwick trees

### T11-01 · The trie — Master · 🔲 not written
- **Read this:** [Trie](https://en.wikipedia.org/wiki/Trie) · Wikipedia · search in O(m) in the text (the infobox says O(n)), memory cost of one link per alphabet character, and trie versus hash table (*read*) · covers our angle: **partial** — no array-versus-map benchmark · fetched 2026-10-14
- **Also good:** [Tries](https://algs4.cs.princeton.edu/52trie/) · Princeton Algorithms 5.2 · R-way tries and ternary search tries; the page says it is under major construction and states no bounds (*read*) · fetched 2026-10-14
- **Beyond the docs:** [LeetCode Meditations: Implement Trie](https://dev.to/rivea0/leetcode-meditations-implement-trie-prefix-tree-3dfp) · Eda (rivea0), DEV Community, 2024-05-24 · TypeScript trie with a `Map` per node, insert O(n), search and `startsWith` O(n) time and O(1) space with n the word length (*read*) · fetched 2026-10-14
- **Our delta:** 26-slot array against a `Map` per node, and when a hash set of prefixes is smaller.

### T11-02 · Trie applications — Master · 🔲 not written
- **Read this:** [Tries](https://algs4.cs.princeton.edu/52trie/) · Princeton Algorithms 5.2 · says its R-way trie and TST code includes wildcard and prefix matching, and discusses autocomplete and longest-prefix matching (*read*) · covers our angle: **partial** — no word search with pruning, no replace words · fetched 2026-10-14
- **Beyond the docs:** [Trie (Prefix Tree) Interview Patterns](https://www.techinterview.org/post/3233463117/trie-prefix-tree-interview-patterns/) · techinterview.org, 2026-04-17 · autocomplete with a top-K cache per node, Word Search II, Replace Words, wildcard search, Python; O(L) for insert, search and prefix, but insert with the cache is O(L · K log K) (*read*) · fetched 2026-10-14
- **Our delta:** longest common prefix (walk while a node has one child and is not a word end).

### T11-03 · The binary trie — Understand · 🔲 not written
- **Read this:** [Trie](https://en.wikipedia.org/wiki/Trie) · Wikipedia · has a "Bitwise tries" section under implementation strategies (*headings only*) · covers our angle: **partial** — I did not read the section text; no XOR use · fetched 2026-10-14
- **Also good:** [CSES 1655 Maximum Xor Subarray](https://usaco.guide/problems/cses-1655-maximum-xor-subarray/solution) · USACO Guide · prefix XOR plus a binary trie walked toward the opposite bit, O(N log M), C++ (code truncated in what I fetched) (*read*) · fetched 2026-10-14
- **Beyond the docs:** [Maximum XOR of Two Numbers in an Array](https://docs.vultr.com/problem-set/maximum-xor-of-two-numbers-in-an-array) · Vultr Docs · Java, MSB-first trie, walk toward the opposite bit; shows `5 XOR 25 = 28` in binary but no table, and gives no complexity for the trie version (*read*) · fetched 2026-10-14
- **Our delta:** the O(n times 31) bound, and XOR queries over a range (store a count or index per node, or keep one root per prefix); no source read covers the range variant.

### T11-04 · The segment tree — Understand · 🔲 not written
- **Read this:** [Segment Tree](https://cp-algorithms.com/data_structures/segment_tree.html) · cp-algorithms · build O(n), sum query and point update O(log n), 4n vertices (with a 2n memory-efficient variant) (*read*) · covers our angle: **full** · fetched 2026-10-14
- **Beyond the docs:** [Dynamic Range Sum Queries](https://usaco.guide/gold/PURS) · USACO Guide · recursive and iterative sum segment tree plus a Fenwick tree in Python, O((N+Q) log N); lazy propagation deferred to another module (*read*) · fetched 2026-10-14
- **Our delta:** the short recursive form, written to survive pressure.

### T11-05 · The Fenwick tree — Understand · 🔲 not written
- **Read this:** [Fenwick Tree](https://cp-algorithms.com/data_structures/fenwick.html) · cp-algorithms · prefix sums, O(log N) query and update, O(N) linear build, range-update tricks; the default 0-based code uses `idx | (idx + 1)` and the `i + (i & -i)` step appears only in its one-based variant (*read*) · covers our angle: **partial** — no inversion counting or descent; it only lists practice problems · fetched 2026-10-14
- **Beyond the docs:** [Why This Design Works and How a Fenwick Tree Simplifies Inversion Counting](https://www.besthub.dev/articles/why-this-design-works-and-how-a-fenwick-tree-simplifies-inversion-counting-e9cd1dd73142) · YiSu Grain, BestHub, 2024-10-29 · rank compression, right-to-left scan, three Python versions, O(n log n); one inline note says "(3)" where the count is 1 and the total of 4 is never stated (*read*) · fetched 2026-10-14
- **Our delta:** order statistics by descent on the tree.

### T11-06 · When these actually appear — Understand · 🔲 not written
- **Read this:** [Segment Tree and Fenwick Tree: Range Query Interview Patterns](https://www.techinterview.org/post/3233460884/segment-tree-fenwick-tree-interview/?format=md) · techinterview.org, updated 2026-07-05 · no canonical reference covers interview frequency; Fenwick for prefix sums with inverses, segment tree for min and max, inversion counting listed as typical; its text garbles the inversion definition though the code is correct (*read*) · covers our angle: **partial** — says only "senior engineering interviews and competitive programming", no company-type expectations · fetched 2026-10-14
- **Our delta:** Count of Smaller Numbers After Self, and honest odds by company type; no source found gives measured frequency, so those odds are our judgement and must be labelled as such.

### T11-07 · Lazy propagation — Know · 🔲 not written
- **Read this:** [Lazy Tags in Segment Trees](https://soi.ch/wiki/lazy-segment-trees/) · soi.ch wiki · tag semantics (a node's own value is already correct, the tag is owed to its children), push-down after the early exits and before recursing, assignment, additive and general operations; no worked `[1,2,3,4]` example, and its code sizes `lazy` at 2n while `b` is 4n (*read*) · covers our angle: **full** for the concept · fetched 2026-10-14
- **Also good:** [Segment Tree, Range updates (Lazy Propagation)](https://cp-algorithms.com/data_structures/segment_tree.html) · cp-algorithms · addition on segments needs no push; assignment uses a `marked` flag and `push(v)` before partial descent; O(log n) per operation with no formal proof and no worked numbers (*read*) · fetched 2026-10-14
- **Our delta:** a worked example on `[1,2,3,4]` and a TypeScript version.

### T11-08 · The sparse table — Know · 🔲 not written
- **Read this:** [Sparse Table](https://cp-algorithms.com/data_structures/sparse-table.html) · cp-algorithms · O(N log N) build, O(1) range minimum from two overlapping blocks; overlap is safe for idempotent operations only, sums take O(log N) (*read*) · covers our angle: **full** · fetched 2026-10-14
- **Our delta:** none.

### T11-09 · Suffix structures — Know · 🔲 not written
- **Read this:** [Suffix Array](https://cp-algorithms.com/string/suffix-array.html) · cp-algorithms · O(n log n) prefix-doubling construction, substring search, LCP with Kasai, distinct substrings (*read*) · covers our angle: **partial** — suffix automata appear only as a sidebar link · fetched 2026-10-14
- **Our delta:** why interviews rarely ask for them.

### T11-10 · Tries in real systems — Know · 🔲 not written
- **Read this:** [Radix tree](https://en.wikipedia.org/wiki/Radix_tree) · Wikipedia · compressed trie, IP routing, and a Linux kernel entry "used for the page cache, among other things" (*read*) · covers our angle: **partial** — HTTP routers are not mentioned, and the kernel line may be dated (see below) · fetched 2026-10-14
- **Also good:** [XArray](https://docs.kernel.org/core-api/xarray.html) · Linux kernel docs · "The most important user of the XArray is the page cache"; I did not find a line saying it replaced the radix tree (*read*) · fetched 2026-10-14
- **Beyond the docs:** [julienschmidt/httprouter](https://github.com/julienschmidt/httprouter) · README, GitHub · "A compressing dynamic trie (radix tree) structure is used for efficient matching", a Go router (*read*) · fetched 2026-10-14
- **Our delta:** HTTP router matching, and the autocomplete service in the System Design track.

### T11-11 · Order-statistic and interval trees — Know · 🔲 not written
- **Read this:** [Order statistic tree](https://en.wikipedia.org/wiki/Order_statistic_tree) · Wikipedia · subtree size per node gives select and rank in O(log n) when balanced; it does not cover maintaining sizes under rotations (*read*) · covers our angle: **full** · fetched 2026-10-14
- **Also good:** [Interval tree](https://en.wikipedia.org/wiki/Interval_tree) · Wikipedia · the augmented tree stores the maximum high endpoint per subtree; insert and delete O(log n) (*read*) · fetched 2026-10-14
- **Also good:** [Lecture 11: Augmenting Data Structures, Dynamic Order Statistics, Interval Trees](https://ocw.mit.edu/courses/6-046j-introduction-to-algorithms-sma-5503-fall-2005/eebc00db28f8650591e3be446a31f1cf_lec11.pdf) · MIT 6.046J notes · `OS-SELECT` on a `size` field in O(lg n), rotations fix sizes in O(1), interval trees keep `m[x]` as the maximum endpoint (*read*) · fetched 2026-10-14
- **Our delta:** none; concept only.
