---
title: "Link map · DSA · Part 4 (phases 9–11)"
sidebar_label: "04 · trees, heaps & tries"
sidebar_position: 4
---

# Link map · DSA · Part 4 (phases 9–11)

Covers every topic row of phases 9, 10 and 11 in `docs/dsa/syllabus/04-trees-heaps-and-tries.md`: binary trees and BSTs (T09-01 to T09-14), heaps and priority queues (T10-01 to T10-11) and tries, segment trees and Fenwick trees (T11-01 to T11-11). That is 36 rows. None of them has a written page of ours yet (`docs/dsa/pages` holds phases 0 to 2 only), so every block is marked not written and its delta describes what the syllabus row promises.
*read* = I read the passage that supports the claim on the fetched page; *headings only* = fetched at HTTP 200 and the headings or title checked, passage not read for the claim. Third-party links carry a date only where the page shows one. No `#anchors` are given. Where no good non-official explanation turned up, the block has no "Beyond the docs" line. Official means language and library documentation, university course notes, cp-algorithms and the Wikipedia articles that cite CLRS; blogs and tutorial sites count as beyond the docs.

---

## Phase 9 — Binary trees and BSTs

### T09-01 · Traversals — Master · 🔲 not written
- **Read this:** [Tree traversal](https://en.wikipedia.org/wiki/Tree_traversal) · Wikipedia · covers depth-first (pre, in, post) and level-order; says iterative versions can drop the stack by keeping parent pointers or by threading the tree, and names Morris in-order traversal (*read*) · covers our angle: **partial** — no queue-size-per-level loop and no TypeScript or Java · fetched 2026-10-14
- **Also good:** [Threaded binary tree](https://en.wikipedia.org/wiki/Threaded_binary_tree) · Wikipedia · the null-pointer threading that makes the constant-space traversal possible (*headings only*) · fetched 2026-10-14
- **Beyond the docs:** [Morris Traversal for Preorder](https://www.geeksforgeeks.org/dsa/morris-traversal-for-preorder/) · GeeksforGeeks, last updated 30 Jul 2026 · worked code for the constant-space variant, the one interviewers like named (*headings only*) · fetched 2026-10-14
- **Our delta:** the row promises recursive and iterative forms of all four orders plus Morris named as a trick, in one place with the convert-recursion-to-iterative drill the gate demands.

### T09-02 · BFS by levels — Master · 🔲 not written
- **Read this:** [Tree traversal](https://en.wikipedia.org/wiki/Tree_traversal) · Wikipedia · queue-based level-order needs space proportional to the widest level, which can be about half the nodes (*read*) · covers our angle: **partial** — states the queue and its cost, but not the snapshot-the-size-at-level-start loop or any of the variants (averages, zigzag, right-side view) · fetched 2026-10-14
- **Also good:** [Breadth-first search](https://en.wikipedia.org/wiki/Breadth-first_search) · Wikipedia · the general graph form of the same queue discipline (*headings only*) · fetched 2026-10-14
- **Our delta:** the level loop that reads the queue size once before processing, and the three problems it solves with one-line changes.

### T09-03 · Height, depth, diameter and balance — Master · 🔲 not written
- **Read this:** [Binary tree](https://en.wikipedia.org/wiki/Binary_tree) · Wikipedia · gives the recursive definition of a binary tree as a node with two (possibly empty) subtrees, which is exactly what the postorder return-value pattern consumes (*read*) · covers our angle: **partial** — definitions only, no diameter or balance algorithm · fetched 2026-10-14
- **Also good:** [Tree (abstract data type)](https://en.wikipedia.org/wiki/Tree_(abstract_data_type)) · Wikipedia · terminology for height, depth and level used consistently (*headings only*) · fetched 2026-10-14
- **Our delta:** one return-value pattern, ask children then combine, shared by height, balance and diameter, including the diameter that bypasses the root.

### T09-04 · Lowest common ancestor — Master · 🔲 not written
- **Read this:** [Lowest common ancestor](https://en.wikipedia.org/wiki/Lowest_common_ancestor) · Wikipedia · reduces LCA to a range-minimum query over the depths recorded in an Euler tour, and with parent pointers finds it as the first intersection of the two paths to the root in O(h) (*read*) · covers our angle: **partial** — the preprocessing view and the parent-pointer idea, but nothing on the one-pass postorder recursion, the BST walk-down or aligning depths first · fetched 2026-10-14
- **Also good:** [Lowest Common Ancestor, Binary Lifting](https://cp-algorithms.com/graph/lca_binary_lifting.html) · cp-algorithms · the preprocessed, many-queries approach with jump pointers (*headings only*) · fetched 2026-10-14
- **Also good:** [Lowest Common Ancestor, Farach-Colton and Bender](https://cp-algorithms.com/graph/lca.html) · cp-algorithms · the Euler tour plus RMQ route in contest form (*headings only*) · fetched 2026-10-14
- **Our delta:** the three interview forms (postorder, BST descent, parent pointers by aligning depths) side by side, with the many-queries tools left as pointers.

### T09-05 · Path problems — Master · 🔲 not written
- **Read this:** [Binary tree](https://en.wikipedia.org/wiki/Binary_tree) · Wikipedia · the recursive tree definition that a path-sum function recurses over (*read*) · covers our angle: **partial** — no path problem is worked there · fetched 2026-10-14
- **Also good:** [Maximum subarray problem](https://en.wikipedia.org/wiki/Maximum_subarray_problem) · Wikipedia · the one-dimensional cousin of the keep-or-restart choice behind the maximum path sum (*headings only*) · fetched 2026-10-14
- **Our delta:** the "one arm up, two arms for the answer" rule, with the negative-arm clamp, that separates the value returned from the value recorded.

### T09-06 · Serialise and deserialise — Master · 🔲 not written
- **Read this:** [Tree traversal](https://en.wikipedia.org/wiki/Tree_traversal) · Wikipedia · the traversal orders a codec is built from (*read*) · covers our angle: **partial** — nothing on null markers or a round trip · fetched 2026-10-14
- **Also good:** [Serialization](https://en.wikipedia.org/wiki/Serialization) · Wikipedia · the general idea of turning a structure into a stream and back, with its caveats (*headings only*) · fetched 2026-10-14
- **Our delta:** why preorder needs null markers to be unambiguous, and the level-order alternative, with a round-trip test.

### T09-07 · Search-tree properties — Master · 🔲 not written
- **Read this:** [Binary search tree](https://en.wikipedia.org/wiki/Binary_search_tree) · Wikipedia · inorder walk visits keys in sorted order, successor and predecessor rules, and deletion in three cases: leaf, one child, two children (*read*) · covers our angle: **partial** — the invariant and cases are there, but not validation with bounds or the k-th smallest · fetched 2026-10-14
- **Also good:** [Binary Search Trees](https://algs4.cs.princeton.edu/32bst/) · Sedgewick and Wayne, Princeton · select and rank by subtree sizes, and Hibbard deletion replacing a node by its successor; every operation costs time proportional to the height (*read*) · fetched 2026-10-14
- **Beyond the docs:** [Binary Search Tree](https://www.programiz.com/dsa/binary-search-tree) · Programiz · step-by-step insert, search and delete with diagrams and code (*headings only*) · fetched 2026-10-14
- **Our delta:** validation with open bounds (the classic wrong parent-only check), the k-th smallest by inorder with early exit, and the three deletion cases tested.

### T09-08 · The small recursive classics — Master · 🔲 not written
- **Read this:** [Binary tree](https://en.wikipedia.org/wiki/Binary_tree) · Wikipedia · the recursive definition (a tree is an empty tree or a root with two subtrees) from which same-tree, subtree, symmetric and invert fall out (*read*) · covers our angle: **partial** — the shape, not the four functions · fetched 2026-10-14
- **Our delta:** the shared pattern, base cases then recurse on both children, that makes each a four-line function.

### T09-09 · Constructing trees — Understand · 🔲 not written
- **Read this:** [Tree traversal](https://en.wikipedia.org/wiki/Tree_traversal) · Wikipedia · with distinct keys, preorder or postorder paired with inorder describes the tree uniquely, while preorder with postorder leaves ambiguity (*read*) · covers our angle: **partial** — no reconstruction algorithm · fetched 2026-10-14
- **Also good:** [Binary search tree](https://en.wikipedia.org/wiki/Binary_search_tree) · Wikipedia · unbalanced insertion can degenerate into a list-like tree of height up to n, and self-balancing keeps height logarithmic; it does not describe the midpoint build (*read*) · fetched 2026-10-14
- **Our delta:** preorder gives the root, inorder splits the sides (with a value-to-index map), and sorted-array-to-balanced-BST by midpoint.

### T09-10 · Views and column order — Understand · 🔲 not written
- **Read this:** [Tree traversal](https://en.wikipedia.org/wiki/Tree_traversal) · Wikipedia · level-order as the basis for the views (*headings only*) · covers our angle: **partial** — no views or column bookkeeping · fetched 2026-10-14
- **Our delta:** left, right, top and bottom views as one level-order walk with a column map, plus boundary traversal.

### T09-11 · Balanced search trees — Understand · 🔲 not written
- **Read this:** [Self-balancing binary search tree](https://en.wikipedia.org/wiki/Self-balancing_binary_search_tree) · Wikipedia · height-balanced trees such as AVL and red-black keep height logarithmic; splay trees and treaps balance without a height guarantee (*read*) · covers our angle: **partial** — no Java or JavaScript angle · fetched 2026-10-14
- **Also good:** [Tree rotation](https://en.wikipedia.org/wiki/Tree_rotation) · Wikipedia · a rotation is a constant-time pointer change that preserves inorder order (*read*) · fetched 2026-10-14
- **Also good:** [Balanced Search Trees](https://algs4.cs.princeton.edu/33balanced/) · Sedgewick and Wayne, Princeton · red-black BSTs as a representation of 2-3 trees, left rotation and colour flip, height at most 2 lg N (*read*) · fetched 2026-10-14
- **Also good:** [TreeMap (Java SE 21)](https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/util/TreeMap.html) · Oracle · a red-black tree NavigableMap with guaranteed log(n) containsKey, get, put and remove (*read*) · fetched 2026-10-14
- **Also good:** [NavigableMap (Java SE 21)](https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/util/NavigableMap.html) · Oracle · floorEntry, ceilingEntry, lowerEntry, higherEntry and their Key forms (*read*) · fetched 2026-10-14
- **Beyond the docs:** [AVL Tree](https://www.programiz.com/dsa/avl-tree) · Programiz · balance factor of minus one, zero or plus one, with rotation diagrams (*read*) · fetched 2026-10-14
- **Our delta:** the ideas without implementing a balanced tree, Java's sorted map and set as the tool, and the workarounds for JavaScript having none.

### T09-12 · Tree DP — Understand · 🔲 not written
- **Read this:** [Dynamic programming](https://en.wikipedia.org/wiki/Dynamic_programming) · Wikipedia · optimal substructure and overlapping subproblems, the framing a per-node state returned upward uses (*headings only*) · covers our angle: **partial** — nothing tree-specific · fetched 2026-10-14
- **Also good:** [Maximum independent set](https://en.wikipedia.org/wiki/Maximum_independent_set) · Wikipedia · the house-robber-on-a-tree problem is this on a tree, which is polynomial (*headings only*) · fetched 2026-10-14
- **Our delta:** a state per node (take or skip) returned from the children, previewed for Part 6.

### T09-13 · Trees in TypeScript and Java — Understand · 🔲 not written
- **Read this:** [InternalError: too much recursion](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Errors/Too_much_recursion) · MDN · the message is Maximum call stack size exceeded in Chrome and Safari and too much recursion in Firefox, caused by too many calls or a missing base case (*read*) · covers our angle: **partial** — JavaScript only; no Java and no iterative fallback · fetched 2026-10-14
- **Also good:** [Tail call](https://en.wikipedia.org/wiki/Tail_call) · Wikipedia · why tail-call elimination is not a safe assumption for tree recursion (*headings only*) · fetched 2026-10-14
- **Our delta:** depth on a degenerate tree in both languages, the explicit-stack fallback (general conversion already at `docs/dsa/pages/phase-2-recursion-maths-bits/01f-converting-recursion-to-an-explicit-stack.md`), and the node classes an interviewer supplies.

### T09-14 · N-ary trees and the parent-array form — Know · 🔲 not written
- **Read this:** [Tree (abstract data type)](https://en.wikipedia.org/wiki/Tree_(abstract_data_type)) · Wikipedia · general trees with any number of children and the parent and child vocabulary (*headings only*) · covers our angle: **partial** — no parent-array or edge-list build · fetched 2026-10-14
- **Also good:** [Tree (graph theory)](https://en.wikipedia.org/wiki/Tree_(graph_theory)) · Wikipedia · a tree as a connected acyclic graph, which is why an edge list of n minus one edges builds one (*headings only*) · fetched 2026-10-14
- **Our delta:** traversals and height on n-ary nodes, and building the tree from parent arrays and edge lists.

---

## Phase 10 — Heaps and priority queues

### T10-01 · The binary heap — Master · 🔲 not written
- **Read this:** [Binary heap](https://en.wikipedia.org/wiki/Binary_heap) · Wikipedia · array layout, up-heap and down-heap under their many names, insert in O(log n) worst case, arbitrary search O(n) (*read*) · covers our angle: **partial** — pseudocode only, no TypeScript or comparator discussion · fetched 2026-10-14
- **Also good:** [Priority Queues](https://algs4.cs.princeton.edu/24pq/) · Sedgewick and Wayne, Princeton · swim and sink as the two operations behind insert and delete-max, shown inline, with MinPQ.java and MaxPQ.java linked as full Java (*read*) · fetched 2026-10-14
- **Also good:** [PriorityQueue (Java SE 21)](https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/util/PriorityQueue.html) · Oracle · unbounded, ordered by natural order or a Comparator, null not permitted, O(log n) offer and poll, linear remove(Object) and contains, constant peek, iterator order unspecified (*read*) · fetched 2026-10-14
- **Beyond the docs:** [VisuAlgo, Binary Heap](https://visualgo.net/en/heap) · VisuAlgo, NUS · animated insert and extract on the tree and array views side by side (*headings only*) · fetched 2026-10-14
- **Our delta:** a heap written from memory in TypeScript with a comparator argument, and the Java comparator gotchas for the built-in queue.

### T10-02 · Top-k problems — Master · 🔲 not written
- **Read this:** [Quickselect](https://en.wikipedia.org/wiki/Quickselect) · Wikipedia · average O(n), worst case O(n squared), O(1) extra space, the alternative to a size-k heap (*read*) · covers our angle: **partial** — no heap comparison · fetched 2026-10-14
- **Also good:** [PriorityQueue (Java SE 21)](https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/util/PriorityQueue.html) · Oracle · the log(n) offer and poll that make a size-k min-heap cost O(n log k) (*read*) · fetched 2026-10-14
- **Also good:** [Selection algorithm](https://en.wikipedia.org/wiki/Selection_algorithm) · Wikipedia · the family quickselect and heap selection belong to (*headings only*) · fetched 2026-10-14
- **Our delta:** k largest, most frequent and closest as one pattern, and when to prefer the heap, a sort or quickselect (quickselect is written at `docs/dsa/pages/phase-2-recursion-maths-bits/02f-quickselect.md`).

### T10-03 · Merging k sorted sequences — Master · 🔲 not written
- **Read this:** [k-way merge algorithm](https://en.wikipedia.org/wiki/K-way_merge_algorithm) · Wikipedia · its table of contents shows a direct k-way merge by heap and by tournament tree, with the lower bound on running time (*headings only*) · covers our angle: **partial** — no interview problems · fetched 2026-10-14
- **Also good:** [Priority Queues](https://algs4.cs.princeton.edu/24pq/) · Sedgewick and Wayne, Princeton · names Multiway.java, a client merging several sorted input streams with a priority queue (*read*) · fetched 2026-10-14
- **Our delta:** the heap of heads for lists and arrays, and the smallest covering range as a variation that tracks the current maximum.

### T10-04 · Two heaps — Master · 🔲 not written
- **Read this:** [Binary heap](https://en.wikipedia.org/wiki/Binary_heap) · Wikipedia · the O(log n) insert and extract that rebalancing between a max-heap and a min-heap relies on (*read*) · covers our angle: **partial** — no running-median construction · fetched 2026-10-14
- **Also good:** [Moving average](https://en.wikipedia.org/wiki/Moving_average) · Wikipedia · has a section on the moving median, the sliding-window problem (*headings only*) · fetched 2026-10-14
- **Our delta:** the size-invariant between the two heaps and lazy deletion for the sliding-window median.

### T10-05 · Scheduling with heaps — Master · 🔲 not written
- **Read this:** [Earliest deadline first scheduling](https://en.wikipedia.org/wiki/Earliest_deadline_first_scheduling) · Wikipedia · processes sit in a priority queue and the one closest to its deadline runs next at every scheduling event (*read*) · covers our angle: **partial** — real-time systems view, not interview problems · fetched 2026-10-14
- **Also good:** [ScheduledThreadPoolExecutor (Java SE 21)](https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/util/concurrent/ScheduledThreadPoolExecutor.html) · Oracle · runs commands after a delay or periodically; tasks scheduled for the same time are enabled in FIFO order of submission (*read*) · fetched 2026-10-14
- **Also good:** [Job-shop scheduling](https://en.wikipedia.org/wiki/Job-shop_scheduling) · Wikipedia · the wider optimisation family (*headings only*) · fetched 2026-10-14
- **Our delta:** task scheduler, meeting rooms and CPU simulation as sorted-by-start plus a heap keyed on end time or priority.

### T10-06 · Heapify in linear time — Understand · 🔲 not written
- **Read this:** [Priority Queues](https://algs4.cs.princeton.edu/24pq/) · Sedgewick and Wayne, Princeton · states the proposition that sink-based heap construction is linear time, against n lg n for repeated inserts (*read*) · covers our angle: **partial** — states the bound, leaves the proof to the book · fetched 2026-10-14
- **Also good:** [Binary heap](https://en.wikipedia.org/wiki/Binary_heap) · Wikipedia · building a heap from n unsorted elements takes Theta(n), while repeated insertion is not linear in the worst case (*read*) · fetched 2026-10-14
- **Beyond the docs:** [Building Heap from Array](https://www.geeksforgeeks.org/dsa/building-heap-from-array/) · GeeksforGeeks, last updated 18 Oct 2025 · start at the last non-leaf node and heapify in reverse level order, since leaves already satisfy the property (*read*) · fetched 2026-10-14
- **Our delta:** why most nodes are near the bottom, so the sum of sift distances is linear.

### T10-07 · Greedy with heaps — Understand · 🔲 not written
- **Read this:** [Huffman coding](https://en.wikipedia.org/wiki/Huffman_coding) · Wikipedia · repeatedly remove the two lowest-probability nodes from a priority queue and merge them, the same move as the minimum cost to connect ropes (*read*) · covers our angle: **partial** — compression framing · fetched 2026-10-14
- **Also good:** [Prim's algorithm](https://en.wikipedia.org/wiki/Prim%27s_algorithm) · Wikipedia · always take the cheapest connection, a heap-driven greedy (*headings only*) · fetched 2026-10-14
- **Our delta:** maximising capital and reorganising a string as greedy picks from a heap, with the proof sketch for why the greedy choice is safe.

### T10-08 · Lazy deletion and indexed heaps — Understand · 🔲 not written
- **Read this:** [Dijkstra's algorithm](https://en.wikipedia.org/wiki/Dijkstra%27s_algorithm) · Wikipedia · the priority queue needs add_with_priority, decrease_priority and extract_min, Fibonacci heaps or Brodal queues give the best bounds, and the alternative inserts unconditionally and skips stale entries on extraction (*read*) · covers our angle: **partial** — both routes for Dijkstra, but not lazy deletion for a general heap or the sliding-window median · fetched 2026-10-14
- **Also good:** [Binary heap](https://en.wikipedia.org/wiki/Binary_heap) · Wikipedia · finding an arbitrary element takes O(n), the cost an index map removes; the article itself does not describe the map (*read*) · fetched 2026-10-14
- **Also good:** [Pairing heap](https://en.wikipedia.org/wiki/Pairing_heap) · Wikipedia · an optional decrease-key by cutting the subtree and melding it back (*read*) · fetched 2026-10-14
- **Our delta:** two routes to arbitrary removal, mark-and-skip at pop time or an index map for true decrease-key.

### T10-09 · Heap sort and selection — Know · 🔲 not written
- **Read this:** [Heapsort](https://en.wikipedia.org/wiki/Heapsort) · Wikipedia · in place but not stable, worst case O(n log n), and often used as the fallback inside quicksort variants (*read*) · covers our angle: **full** for the heapsort half · fetched 2026-10-14
- **Also good:** [Quickselect](https://en.wikipedia.org/wiki/Quickselect) · Wikipedia · average linear, worst case quadratic (*read*) · fetched 2026-10-14
- **Also good:** [Median of medians](https://en.wikipedia.org/wiki/Median_of_medians) · Wikipedia · worst-case linear selection with O(log n) auxiliary space (*read*) · fetched 2026-10-14
- **Our delta:** when the heap is the sort, and quickselect for a single order statistic; quickselect itself is already written at `docs/dsa/pages/phase-2-recursion-maths-bits/02f-quickselect.md`, so this row only places it beside the heap.

### T10-10 · Heaps in real systems — Know · 🔲 not written
- **Read this:** [DelayQueue (Java SE 21)](https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/util/concurrent/DelayQueue.html) · Oracle · an unbounded blocking queue of Delayed elements, eligible for removal once their delay expires (*read*) · covers our angle: **partial** — the API, not the heap behind it · fetched 2026-10-14
- **Also good:** [Timers (Node.js)](https://nodejs.org/api/timers.html) · Node.js docs · the scheduling API whose pending timeouts need an ordered structure, though this page does not describe it (*headings only*) · fetched 2026-10-14
- **Also good:** [Token bucket](https://en.wikipedia.org/wiki/Token_bucket) · Wikipedia · the rate-limiter algorithm, as a point of comparison (*headings only*) · fetched 2026-10-14
- **Our delta:** where a priority queue sits inside a timer wheel alternative, a job runner and a rate limiter.

### T10-11 · Variants — Know · 🔲 not written
- **Read this:** [D-ary heap](https://en.wikipedia.org/wiki/D-ary_heap) · Wikipedia · better cache behaviour than binary heaps and cheaper decrease-priority, used when those are common (*read*) · covers our angle: **full** for a concept-only row · fetched 2026-10-14
- **Also good:** [Fibonacci heap](https://en.wikipedia.org/wiki/Fibonacci_heap) · Wikipedia · amortised constant decrease-key and insert, with delete-min amortised O(log n) (*read*) · fetched 2026-10-14
- **Also good:** [Pairing heap](https://en.wikipedia.org/wiki/Pairing_heap) · Wikipedia · a simpler meldable heap that is fast in practice (*read*) · fetched 2026-10-14
- **Our delta:** one paragraph each, and why the binary heap still wins in interviews.

---

## Phase 11 — Tries, segment trees and Fenwick trees

### T11-01 · The trie — Master · 🔲 not written
- **Read this:** [Trie](https://en.wikipedia.org/wiki/Trie) · Wikipedia · each child shares a prefix with its parent and the root is the empty string; basic tries can be memory-intensive; no hash collisions (*read*) · covers our angle: **partial** — no array-versus-map comparison or when a hash set wins · fetched 2026-10-14
- **Also good:** [Tries](https://algs4.cs.princeton.edu/52trie/) · Sedgewick and Wayne, Princeton · R-way tries and ternary search tries, as fast as hashing but with prefix and wildcard operations (*read*) · fetched 2026-10-14
- **Beyond the docs:** [Trie Data Structure](https://www.geeksforgeeks.org/dsa/trie-insert-and-search/) · GeeksforGeeks, last updated 18 Jan 2026 · insert, search and prefix code with a 26-slot child array per node, and names the memory cost of one pointer per alphabet letter as the main disadvantage against hashing (*read*) · fetched 2026-10-14
- **Our delta:** a 26-slot array against a map per node with the memory cost, and the honest case for a hash set.

### T11-02 · Trie applications — Master · 🔲 not written
- **Read this:** [Tries](https://algs4.cs.princeton.edu/52trie/) · Sedgewick and Wayne, Princeton · prefix matching, wildcard search, longest prefix and T9 text input as applications (*read*) · covers our angle: **partial** — no word-search pruning or root replacement · fetched 2026-10-14
- **Also good:** [Trie](https://en.wikipedia.org/wiki/Trie) · Wikipedia · autocomplete, spell checking and IP routing as typical uses (*read*) · fetched 2026-10-14
- **Also good:** [Aho-Corasick algorithm](https://en.wikipedia.org/wiki/Aho%E2%80%93Corasick_algorithm) · Wikipedia · builds a trie from a dictionary, then adds failure links to make a state machine (*read*) · fetched 2026-10-14
- **Our delta:** pruning a word-search DFS with the trie, autocomplete, replace-words and the longest common prefix.

### T11-03 · The binary trie — Understand · 🔲 not written
- **Read this:** [Trie](https://en.wikipedia.org/wiki/Trie) · Wikipedia · describes the bitwise trie, which uses individual bits of fixed-length keys such as integers (*read*) · covers our angle: **partial** — no XOR maximisation · fetched 2026-10-14
- **Also good:** [Radix tree](https://en.wikipedia.org/wiki/Radix_tree) · Wikipedia · the compressed form of a bitwise trie (*headings only*) · fetched 2026-10-14
- **Our delta:** the maximum XOR pair by walking toward the opposite bit, and XOR queries over a range.

### T11-04 · The segment tree — Understand · 🔲 not written
- **Read this:** [Segment Tree](https://cp-algorithms.com/data_structures/segment_tree.html) · cp-algorithms · range sum or minimum in O(log n) with point updates, and the variations (lazy propagation, 2D, persistent) (*read*) · covers our angle: **partial** — C++ and contest framing · fetched 2026-10-14
- **Also good:** [Segment tree](https://en.wikipedia.org/wiki/Segment_tree) · Wikipedia · the structure as defined in computational geometry (*headings only*) · fetched 2026-10-14
- **Beyond the docs:** [Point Update Range Sum](https://usaco.guide/gold/PURS) · USACO Guide · recursive and iterative segment trees side by side, then Fenwick as the shorter form (*read*) · fetched 2026-10-14
- **Also good:** [VisuAlgo, Segment Tree](https://visualgo.net/en/segmenttree) · VisuAlgo, NUS · animated build, update and query (*headings only*) · fetched 2026-10-14
- **Our delta:** the recursive form that can be written under pressure, in TypeScript and Java.

### T11-05 · The Fenwick tree — Understand · 🔲 not written
- **Read this:** [Fenwick Tree](https://cp-algorithms.com/data_structures/fenwick.html) · cp-algorithms · prefix sums with updates, its problem list includes inversion counting (*read*) · covers our angle: **partial** — contest framing · fetched 2026-10-14
- **Also good:** [Fenwick tree](https://en.wikipedia.org/wiki/Fenwick_tree) · Wikipedia · credits Ryabko, 1989, and links to order statistic trees and prefix sums (*read*) · fetched 2026-10-14
- **Beyond the docs:** [Binary Indexed Trees](https://www.topcoder.com/thrive/articles/Binary%20Indexed%20Trees) · Topcoder, 2018-10-31 · index responsibility defined by the lowest set bit: tree at idx covers idx minus 2 to the r plus 1 through idx (*read*) · fetched 2026-10-14
- **Also good:** [VisuAlgo, Fenwick Tree](https://visualgo.net/en/fenwicktree) · VisuAlgo, NUS · animated updates and prefix queries (*headings only*) · fetched 2026-10-14
- **Our delta:** written from memory in a few lines, then counting inversions and order statistics with it; the merge-sort route to inversions is already at `docs/dsa/pages/phase-2-recursion-maths-bits/02e-counting-inversions.md`.

### T11-06 · When these actually appear — Understand · 🔲 not written
- **Read this:** [Point Update Range Sum](https://usaco.guide/gold/PURS) · USACO Guide · positions Fenwick as shorter than a segment tree and lists the order-statistic use (*read*) · covers our angle: **partial** — contest level, not interview-by-company · fetched 2026-10-14
- **Also good:** [Inversion (discrete mathematics)](https://en.wikipedia.org/wiki/Inversion_(discrete_mathematics)) · Wikipedia · what counting smaller elements after self reduces to (*headings only*) · fetched 2026-10-14
- **Our delta:** the "range query with updates" phrasing, calibrated expectations by company type, and the one-sentence over-engineering test.

### T11-07 · Lazy propagation — Know · 🔲 not written
- **Read this:** [Segment Tree](https://cp-algorithms.com/data_structures/segment_tree.html) · cp-algorithms · a section on range updates by lazy propagation: addition and assignment on segments (*read*) · covers our angle: **full** — concept and worked examples · fetched 2026-10-14
- **Our delta:** one worked example with the deferred tag pushed down on the way.

### T11-08 · The sparse table — Know · 🔲 not written
- **Read this:** [Sparse Table](https://cp-algorithms.com/data_structures/sparse-table.html) · cp-algorithms · O(1) minimum queries, limited to immutable arrays; the O(1) trick requires an idempotent function, so range sums need the slower variant (*read*) · covers our angle: **full** · fetched 2026-10-14
- **Also good:** [Range minimum query](https://en.wikipedia.org/wiki/Range_minimum_query) · Wikipedia · the problem and its place in LCA (*headings only*) · fetched 2026-10-14
- **Our delta:** static range minimum with the overlapping-ranges query, and when updates rule it out.

### T11-09 · Suffix structures — Know · 🔲 not written
- **Read this:** [Suffix Array](https://cp-algorithms.com/string/suffix-array.html) · cp-algorithms · naive sorting of suffixes is O(n squared log n), and the doubling approach reaches O(n log n) (*read*) · covers our angle: **full** for a what-it-solves row · fetched 2026-10-14
- **Also good:** [Suffix Automaton](https://cp-algorithms.com/string/suffix-automaton.html) · cp-algorithms · definition, linear-time construction and applications (*headings only*) · fetched 2026-10-14
- **Also good:** [Suffix tree](https://en.wikipedia.org/wiki/Suffix_tree) · Wikipedia · the related structure, linear-time with Ukkonen (*headings only*) · fetched 2026-10-14
- **Our delta:** what they solve and an honest note on why interviews rarely ask.

### T11-10 · Tries in real systems — Know · 🔲 not written
- **Read this:** [httprouter](https://pkg.go.dev/github.com/julienschmidt/httprouter) · pkg.go.dev · a compressing dynamic trie (radix tree) matches request paths and scales to long paths and many routes (*read*) · covers our angle: **partial** — Go router, not Node · fetched 2026-10-14
- **Also good:** [Radix tree](https://en.wikipedia.org/wiki/Radix_tree) · Wikipedia · the compressed trie behind routing and prefix lookups (*headings only*) · fetched 2026-10-14
- **Also good:** [Trie](https://en.wikipedia.org/wiki/Trie) · Wikipedia · names IP routing and forwarding tables as a use (*read*) · fetched 2026-10-14
- **Our delta:** the radix tree inside HTTP routers, and the autocomplete service of the System Design track.

### T11-11 · Order-statistic and interval trees — Know · 🔲 not written
- **Read this:** [Order statistic tree](https://en.wikipedia.org/wiki/Order_statistic_tree) · Wikipedia · each node stores its subtree size, maintained as size of node equals size of left plus size of right plus one (*read*) · covers our angle: **full** for a concept-only row · fetched 2026-10-14
- **Also good:** [Interval tree](https://en.wikipedia.org/wiki/Interval_tree) · Wikipedia · centred and augmented forms, with queries for intervals overlapping a point or an interval (*headings only*) · fetched 2026-10-14
- **Also good:** [Red-black Trees (rbtree) in Linux](https://www.kernel.org/doc/html/latest/core-api/rbtree.html) · Linux kernel docs · an interval tree as the worked example of an augmented rbtree (*read*) · fetched 2026-10-14
- **Our delta:** concept only, by augmenting a balanced tree with a subtree size or a maximum endpoint.
