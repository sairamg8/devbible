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
- **Also good:** [Iterative binary tree traversals using stack](https://www.enjoyalgorithms.com/blog/iterative-binary-tree-traversals-using-stack/) · EnjoyAlgorithms · step-by-step stack versions of pre, in and post order (*read*) · fetched 2026-10-15
- **Also good:** [Binary Tree Interview Patterns](https://www.techinterview.org/post/3233461462/binary-tree-interview-patterns/) · techinterview.org · iterative in-order, pre-order and a short Morris note (*read*) · fetched 2026-10-15
- **Also good:** [Threaded binary tree](https://en.wikipedia.org/wiki/Threaded_binary_tree) · Wikipedia · the null-pointer threading that makes the constant-space traversal possible (*headings only*) · fetched 2026-10-14
- **Beyond the docs:** [Morris Traversal for Preorder](https://www.geeksforgeeks.org/dsa/morris-traversal-for-preorder/) · GeeksforGeeks, last updated 30 Jul 2026 · worked code for the constant-space variant, the one interviewers like named (*read*) · fetched 2026-10-15
- **Our delta:** the row promises recursive and iterative forms of all four orders plus Morris named as a trick, in one place with the convert-recursion-to-iterative drill the gate demands.

### T09-02 · BFS by levels — Master · 🔲 not written
- **Read this:** [Binary Tree Level Order Traversal](https://neetcode.io/solutions/binary-tree-level-order-traversal) · NeetCode · DFS and queue-per-level BFS with the level-size loop (*read*) · covers our angle: **partial** — no zigzag or averages · fetched 2026-10-15
- **Also good:** [Binary Tree Right Side View](https://neetcode.io/solutions/binary-tree-right-side-view) · NeetCode · the last-node-per-level variant, BFS and DFS (*read*) · fetched 2026-10-15
- **Also good:** [Zigzag Level Order](https://neetcode.io/solutions/binary-tree-zigzag-level-order-traversal) · NeetCode · reverse per level, then the index-flip version with no reversal (*read*) · fetched 2026-10-15
- **Our delta:** level averages are not on a single page; write them as a three-line variation.

### T09-03 · Height, depth, diameter and balance — Master · 🔲 not written
- **Read this:** [Diameter of Binary Tree](https://neetcode.io/solutions/diameter-of-binary-tree) · NeetCode · height returned upward while a running maximum tracks left plus right; pitfall note that the path need not pass the root (*read*) · covers our angle: **partial** — balance is a separate page · fetched 2026-10-15
- **Also good:** [Balanced Binary Tree](https://neetcode.io/solutions/balanced-binary-tree) · NeetCode · brute force, then one DFS returning an isBalanced and height pair (*read*) · fetched 2026-10-15
- **Beyond the docs:** [Binary Tree Interview Patterns](https://www.techinterview.org/post/3233461462/binary-tree-interview-patterns/) · techinterview.org · names two shapes (bottom-up return value, top-down state), the global-variable trick for diameter and the -1 return for balance (*read*) · fetched 2026-10-15
- **Our delta:** the diameter that skips the root needs an explicit example.

### T09-04 · Lowest common ancestor — Master · 🔲 not written
- **Read this:** [Lowest Common Ancestor](https://www.interviewbit.com/blog/lowest-common-ancestor/) · InterviewBit · recursive binary-tree case and the parent-pointer map walk (*read*) · covers our angle: **partial** — the BST case is one FAQ sentence; no depth alignment · fetched 2026-10-15
- **Also good:** [LCA of a Binary Tree](https://neetcode.io/solutions/lowest-common-ancestor-of-a-binary-tree) · NeetCode · boolean-flag DFS, then the return-the-node postorder version, plus BFS parent map (*read*) · fetched 2026-10-15
- **Beyond the docs:** [Lowest common ancestor, Euler tour](https://cp-algorithms.com/graph/lca.html) · cp-algorithms · the Euler tour plus range-minimum view for many queries on a general tree (*read*) · fetched 2026-10-15
- **Our delta:** depth alignment with parent pointers and the BST walk-down.

### T09-05 · Path problems — Master · 🔲 not written
- **Read this:** [Binary Tree Maximum Path Sum](https://neetcode.io/solutions/binary-tree-maximum-path-sum) · NeetCode · best downward arm returned up, both arms through the node for the answer, negative arms clamped to zero (*read*) · covers our angle: **partial** — plain path-sum variants absent · fetched 2026-10-15
- **Also good:** [Binary Tree Interview Patterns](https://www.techinterview.org/post/3233461462/binary-tree-interview-patterns/) · techinterview.org · path sum as the top-down (pass remaining target down) example (*read*) · fetched 2026-10-15
- **Our delta:** path sum I, II, III and the prefix-sum version.

### T09-06 · Serialise and deserialise — Master · 🔲 not written
- **Read this:** [Serialize and Deserialize a Binary Tree](https://www.techinterview.org/post/3233476083/serialize-deserialize-binary-tree/) · techinterview.org · preorder with null markers, level-order BFS, BST and N-ary variants, edge cases (*read*) · covers our angle: full · fetched 2026-10-15
- **Also good:** [Serialize and Deserialize Binary Tree](https://neetcode.io/solutions/serialize-and-deserialize-binary-tree) · NeetCode · preorder DFS and BFS versions; pitfall list includes delimiter conflicts (*read*) · fetched 2026-10-15
- **Also good:** [Serialize and Deserialize a Binary Tree](https://www.geeksforgeeks.org/dsa/serialize-deserialize-binary-tree/) · GeeksforGeeks · preorder and level-order with a -1 marker array (*read*) · fetched 2026-10-15

### T09-07 · Search-tree properties — Master · 🔲 not written
- **Read this:** [Binary Search Trees](https://algs4.cs.princeton.edu/32bst/) · Princeton Algorithms · rank, select, floor and Hibbard deletion in one place (*read*) · covers our angle: **partial** — Java only; bounds validation is only an exercise (isBST) · fetched 2026-10-15
- **Also good:** [Validate Binary Search Tree](https://neetcode.io/solutions/validate-binary-search-tree) · NeetCode · the bounds approach; pitfall: comparing only with the parent (*read*) · fetched 2026-10-15
- **Also good:** [Deletion from BST](https://www.techiedelight.com/deletion-from-bst) · Techie Delight · the three delete cases with successor (*read*) · fetched 2026-10-15
- **Also good:** [Binary Tree Interview Patterns](https://www.techinterview.org/post/3233461462/binary-tree-interview-patterns/) · techinterview.org · BST section: validate with a min/max range, k-th smallest by inorder counter, sorted array to BST (*read*) · fetched 2026-10-15
- **Our delta:** TypeScript versions, the inorder successor, and the k-th smallest by iterative inorder.

### T09-08 · The small recursive classics — Master · 🔲 not written
- **Read this:** [Invert Binary Tree](https://neetcode.io/solutions/invert-binary-tree) · NeetCode · the smallest example of the shared recursive shape (BFS, DFS, iterative DFS) (*read*) · covers our angle: **partial** — one problem per page · fetched 2026-10-15
- **Also good:** [Symmetric Tree](https://neetcode.io/solutions/symmetric-tree) · NeetCode · mirror comparison of node pairs (*read*) · fetched 2026-10-15
- **Also good:** [Subtree of Another Tree](https://neetcode.io/solutions/subtree-of-another-tree) · NeetCode · same-tree check inside a walk, plus a serialisation variant (*read*) · fetched 2026-10-15
- **Our delta:** the single page showing all four share one skeleton.

### T09-09 · Constructing trees — Understand · 🔲 not written
- **Read this:** [Construct Binary Tree from Preorder and Inorder](https://neetcode.io/solutions/construct-binary-tree-from-preorder-and-inorder-traversal) · NeetCode · root from preorder, split by inorder index map, plus a limit-based variant; pitfall: build left before right (*read*) · covers our angle: **partial** — postorder and sorted-array forms missing · fetched 2026-10-15
- **Also good:** [0105 Construct Binary Tree](https://books.halfrost.com/leetcode/en/ChapterFour/0100~0199/0105.Construct-Binary-Tree-from-Preorder-and-Inorder-Traversal/) · halfrost LeetCode book · one-sentence idea and two Go solutions (slice ranges, index map); no derivation (*read*) · fetched 2026-10-15
- **Our delta:** postorder plus inorder (build right first) and sorted array to balanced BST.

### T09-10 · Views and column order — Understand · 🔲 not written
- **Read this:** [Top view of Binary Tree](https://www.interviewbit.com/blog/top-view-of-binary-tree/) · InterviewBit · horizontal distance in a map, preorder with level tracking (*read*) · covers our angle: **partial** — top view only; no boundary traversal · fetched 2026-10-15
- **Also good:** [Top view of binary tree, level order](https://dev.to/jaspreet_singh_86ae1740ac/top-view-of-binary-tree-level-order-traversal-17di) · DEV Community · Java BFS with a TreeMap keyed by horizontal distance; notes that bottom and vertical views follow the same pattern (*read*) · fetched 2026-10-15
- **Our delta:** left, right and bottom views, boundary traversal, and the row-then-value tie-break of vertical order.

### T09-11 · Balanced search trees — Understand · 🔲 not written
- **Read this:** [Self-balancing binary search tree](https://en.wikipedia.org/wiki/Self-balancing_binary_search_tree) · Wikipedia · height-balanced trees such as AVL and red-black keep height logarithmic; splay trees and treaps balance without a height guarantee (*read*) · covers our angle: **partial** — no Java or JavaScript angle · fetched 2026-10-14
- **Also good:** [Tree rotation](https://en.wikipedia.org/wiki/Tree_rotation) · Wikipedia · a rotation is a constant-time pointer change that preserves inorder order (*read*) · fetched 2026-10-14
- **Also good:** [Balanced Search Trees](https://algs4.cs.princeton.edu/33balanced/) · Sedgewick and Wayne, Princeton · red-black BSTs as a representation of 2-3 trees, left rotation and colour flip, height at most 2 lg N (*read*) · fetched 2026-10-14
- **Also good:** [TreeMap (Java SE 21)](https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/util/TreeMap.html) · Oracle · a red-black tree NavigableMap with guaranteed log(n) containsKey, get, put and remove (*read*) · fetched 2026-10-14
- **Also good:** [NavigableMap (Java SE 21)](https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/util/NavigableMap.html) · Oracle · floorEntry, ceilingEntry, lowerEntry, higherEntry and their Key forms (*read*) · fetched 2026-10-14
- **Beyond the docs:** [AVL Tree](https://www.programiz.com/dsa/avl-tree) · Programiz · balance factor of minus one, zero or plus one, with rotation diagrams (*read*) · fetched 2026-10-14
- **Our delta:** the ideas without implementing a balanced tree, Java's sorted map and set as the tool, and the workarounds for JavaScript having none.

### T09-12 · Tree DP — Understand · 🔲 not written
- **Read this:** [House Robber III](https://neetcode.io/solutions/house-robber-iii) · NeetCode · recursion, memoisation, then the rob/skip pair returned per node (*read*) · covers our angle: **partial** — good nodes and same-value path absent · fetched 2026-10-15
- **Also good:** [Tree Dynamic Programming](https://yennj12.js.org/CS_basics/algo_demo/dp-tree.html) · yennj12 · interactive visualiser; short text on a tuple of states per node, post-order, for House Robber III, max path sum and diameter (*read*) · fetched 2026-10-15
- **Our delta:** the other two named problems.

### T09-13 · Trees in TypeScript and Java — Understand · 🔲 not written
- **Read this:** [How to Optimize Tree Recursion in JavaScript](https://hackernoon.com/how-to-optimize-tree-recursion-in-javascript) · HackerNoon · deep-tree stack overflow, no tail-call optimisation in most engines, explicit-stack fallback (*read*) · covers our angle: **partial** — preorder only; no Java side or node-class conventions · fetched 2026-10-15
- **Also good:** [InternalError: too much recursion](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Errors/Too_much_recursion) · MDN · the message is Maximum call stack size exceeded in Chrome and Safari and too much recursion in Firefox, caused by too many calls or a missing base case (*read*) · fetched 2026-10-14
- **Our delta:** depth on a degenerate tree in both languages (neither page covers Java), the explicit-stack fallback (general conversion already at `docs/dsa/pages/phase-2-recursion-maths-bits/01f-converting-recursion-to-an-explicit-stack.md`), and the node classes an interviewer supplies.

### T09-14 · N-ary trees and the parent-array form — Know · 🔲 not written
- **Read this:** [N-ary Tree Data Structure](https://www.enjoyalgorithms.com/blog/n-ary-tree) · EnjoyAlgorithms · child-array and first-child/next-sibling representations, traversals (*read*) · covers our angle: **partial** — no parent array or edge list · fetched 2026-10-15
- **Also good:** [Height of a generic tree from parent array](https://www.geeksforgeeks.org/dsa/height-generic-tree-parent-array/) · GeeksforGeeks · builds adjacency from a parent array, then BFS, plus a no-map O(n) variant (*read*) · fetched 2026-10-15
- **Our delta:** edge list to rooted tree by skipping the parent.

---

## Phase 10 — Heaps and priority queues

### T10-01 · The binary heap — Master · 🔲 not written
- **Read this:** [Binary heap](https://en.wikipedia.org/wiki/Binary_heap) · Wikipedia · array layout, up-heap and down-heap under their many names, insert in O(log n) worst case, arbitrary search O(n) (*read*) · covers our angle: **partial** — pseudocode only, no TypeScript or comparator discussion · fetched 2026-10-14
- **Also good:** [Priority Queues](https://algs4.cs.princeton.edu/24pq/) · Sedgewick and Wayne, Princeton · swim and sink as the two operations behind insert and delete-max, shown inline, with MinPQ.java and MaxPQ.java linked as full Java (*read*) · fetched 2026-10-14
- **Also good:** [PriorityQueue (Java SE 21)](https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/util/PriorityQueue.html) · Oracle · unbounded, ordered by natural order or a Comparator, null not permitted, O(log n) offer and poll, linear remove(Object) and contains, constant peek, iterator order unspecified (*read*) · fetched 2026-10-14
- **Beyond the docs:** [VisuAlgo, Binary Heap](https://visualgo.net/en/heap) · VisuAlgo, NUS · animated insert and extract on the tree and array views side by side (*headings only*) · fetched 2026-10-14
- **Our delta:** a heap written from memory in TypeScript with a comparator argument, and the Java comparator gotchas for the built-in queue.

### T10-02 · Top-k problems — Master · 🔲 not written
- **Read this:** [Top K Frequent Elements: Heap vs Quickselect vs Bucket Sort](https://prachub.com/resources/top-k-frequent-elements) · PracHub · size-k min-heap O(n log k), bucket sort O(n), quickselect average O(n) with the O(n squared) worst case, and when each fits (the company-question anecdotes were not checked) (*read*) · covers our angle: full · fetched 2026-10-15
- **Also good:** [Top K Frequent Elements](https://neetcode.io/solutions/top-k-frequent-elements) · NeetCode · sorting, min-heap and bucket solutions; pitfall: max-heap instead of min-heap (*read*) · fetched 2026-10-15
- **Also good:** [Quickselect](https://en.wikipedia.org/wiki/Quickselect) · Wikipedia · average O(n), worst case O(n squared), O(1) extra space, the alternative to a size-k heap (*read*) · fetched 2026-10-14
- **Our delta:** k largest, most frequent and closest as one pattern, and when to prefer the heap, a sort or quickselect (quickselect is written at `docs/dsa/pages/phase-2-recursion-maths-bits/02f-quickselect.md`).

### T10-03 · Merging k sorted sequences — Master · 🔲 not written
- **Read this:** [Merge k Sorted Lists](https://neetcode.io/solutions/merge-k-sorted-lists) · NeetCode · heap of list heads, plus divide and conquer (*read*) · covers our angle: **partial** — arrays case only implied · fetched 2026-10-15
- **Also good:** [Find smallest range containing elements from k lists](https://www.geeksforgeeks.org/dsa/find-smallest-range-containing-elements-from-k-lists/) · GeeksforGeeks · min-heap of (value, row, column) nodes plus a running maximum, O(n k log k) (*read*) · fetched 2026-10-15
- **Our delta:** a TypeScript version over k sorted arrays with index triples (the GFG page has the C++ shape).

### T10-04 · Two heaps — Master · 🔲 not written
- **Read this:** [Find Median in a Stream: The Two-Heaps Insight](https://www.techinterview.org/post/3233474781/find-median-stream-two-heaps/) · techinterview.org · size invariant and rebalancing, brute force against sorted list against two heaps (*read*) · covers our angle: **partial** — sliding window median only named, lazy deletion in one sentence · fetched 2026-10-15
- **Also good:** [Find Median from Data Stream](https://neetcode.io/solutions/find-median-from-data-stream) · NeetCode · sort, then max-heap plus min-heap halves; pitfalls on balance and even counts (*read*) · fetched 2026-10-15
- **Our delta:** sliding-window median with lazy deletion.

### T10-05 · Scheduling with heaps — Master · 🔲 not written
- **Read this:** [Heap and Priority Queue Interview Patterns](https://techinterview.org/heap-priority-queue-interview-patterns/) · techinterview.org · task scheduler (max-heap plus cooldown queue) and reorganize string with code; meeting rooms only listed by name (*read*) · covers our angle: **partial** — no CPU simulation or deadlines · fetched 2026-10-15
- **Also good:** [Meeting Rooms II](https://neetcode.io/solutions/meeting-rooms-ii) · NeetCode · min-heap of end times, plus sweep line, two pointers and greedy (*read*) · fetched 2026-10-15
- **Also good:** [Task Scheduler](https://neetcode.io/solutions/task-scheduler) · NeetCode · max-heap with cooldown queue, then greedy and math forms (*read*) · fetched 2026-10-15
- **Also good:** [Earliest deadline first scheduling](https://en.wikipedia.org/wiki/Earliest_deadline_first_scheduling) · Wikipedia · processes sit in a priority queue and the one closest to its deadline runs next at every scheduling event (*read*) · fetched 2026-10-14
- **Our delta:** the CPU-simulation problem (jobs by arrival time and priority); the earliest-deadline-first page above describes the policy, not an interview problem.

### T10-06 · Heapify in linear time — Understand · 🔲 not written
- **Read this:** [Heap lecture notes, build-heap analysis](https://cs.utexas.edu/~djimenez/utsa/cs3343/lecture6.html) · UT San Antonio (hosted at cs.utexas.edu) · why naive O(n log n) is loose and the level-by-level sum gives O(n); the key sum is asserted by induction, not shown (*read*) · covers our angle: full · fetched 2026-10-15
- **Also good:** [Heap complexity notes](https://courses.washington.edu/css343/zander/NotesProbs/heapcomplexity) · University of Washington · the full sum-of-heights proof by doubling and subtracting (*read*) · fetched 2026-10-15
- **Beyond the docs:** [Building Heap from Array](https://www.geeksforgeeks.org/dsa/building-heap-from-array/) · GeeksforGeeks, last updated 18 Oct 2025 · start at the last non-leaf node and heapify in reverse level order, since leaves already satisfy the property (*read*) · fetched 2026-10-14
- **Our delta:** why most nodes are near the bottom, so the sum of sift distances is linear.

### T10-07 · Greedy with heaps — Understand · 🔲 not written
- **Read this:** [IPO](https://neetcode.io/solutions/ipo) · NeetCode · min-heap by capital feeding a max-heap by profit (*read*) · covers our angle: **partial** — one problem · fetched 2026-10-15
- **Also good:** [Reorganize String](https://neetcode.io/solutions/reorganize-string) · NeetCode · max-heap of counts with a held-back previous character (*read*) · fetched 2026-10-15
- **Also good:** [Connect n ropes with minimal cost](https://www.techiedelight.com/connect-n-ropes-with-minimal-cost/) · Techie Delight · repeatedly merge the two smallest ropes with a min-heap, worked example [5, 4, 2, 8] gives 36 (*read*) · fetched 2026-10-15
- **Also good:** [Huffman coding](https://en.wikipedia.org/wiki/Huffman_coding) · Wikipedia · repeatedly remove the two lowest-probability nodes from a priority queue and merge them, the same move as the minimum cost to connect ropes (*read*) · fetched 2026-10-14
- **Our delta:** the proof sketch for why each greedy choice is safe; the rope page does not mention Huffman coding, so draw the link ourselves (the Huffman page above shows the same merge-two-smallest move).

### T10-08 · Lazy deletion and indexed heaps — Understand · 🔲 not written
- **Read this:** [Dijkstra on sparse graphs](https://cp-algorithms.com/graph/dijkstra_sparse.html) · cp-algorithms · set with erase and reinsert, against a priority_queue that cannot remove so keeps stale pairs and skips them on pop; notes the no-decrease-key variant ran faster (*read*) · covers our angle: **partial** — C++ only, graph context · fetched 2026-10-15
- **Also good:** [IndexMinPQ.java](https://algs4.cs.princeton.edu/24pq/IndexMinPQ.java.html) · Princeton Algorithms · a heap with position tracking (qp and pq arrays) and decrease-key (*read*) · fetched 2026-10-15
- **Also good:** [Dijkstra's algorithm](https://en.wikipedia.org/wiki/Dijkstra%27s_algorithm) · Wikipedia · the priority queue needs add_with_priority, decrease_priority and extract_min, Fibonacci heaps or Brodal queues give the best bounds, and the alternative inserts unconditionally and skips stale entries on extraction (*read*) · fetched 2026-10-14
- **Our delta:** two routes to arbitrary removal, mark-and-skip at pop time or an index map for true decrease-key, with the stale-entry check stated for general removal and not only for Dijkstra.

### T10-09 · Heap sort and selection — Know · 🔲 not written
- **Read this:** [Heapsort](https://en.wikipedia.org/wiki/Heapsort) · Wikipedia · in place but not stable, worst case O(n log n), and often used as the fallback inside quicksort variants (*read*) · covers our angle: **full** for the heapsort half · fetched 2026-10-14
- **Also good:** [Quickselect](https://en.wikipedia.org/wiki/Quickselect) · Wikipedia · average linear, worst case quadratic (*read*) · fetched 2026-10-14
- **Also good:** [Median of medians](https://en.wikipedia.org/wiki/Median_of_medians) · Wikipedia · worst-case linear selection with O(log n) auxiliary space (*read*) · fetched 2026-10-14
- **Our delta:** when the heap is the sort, and quickselect for a single order statistic; quickselect itself is already written at `docs/dsa/pages/phase-2-recursion-maths-bits/02f-quickselect.md`, so this row only places it beside the heap.

### T10-10 · Heaps in real systems — Know · 🔲 not written
- **Read this:** [8 Timer Implementation Patterns](https://hackernoon.com/8-timer-implementation-patterns-for-systems-and-network-software) · HackerNoon · min-heap timers (one system timer armed for the soonest expiry, O(log n)) against timer wheels (O(1)); short listicle (*read*) · covers our angle: **partial** — no rate limiter or job runner · fetched 2026-10-15
- **Beyond the docs:** [Apache Kafka purgatory and hierarchical timing wheels](https://www.confluent.io/blog/apache-kafka-purgatory-hierarchical-timing-wheels/) · Confluent · a real broker moving from a DelayQueue (priority queue, O(log n)) to timing wheels, yet still keeping a DelayQueue of buckets to drive the clock (*read*) · fetched 2026-10-15
- **Also good:** [DelayQueue (Java SE 21)](https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/util/concurrent/DelayQueue.html) · Oracle · an unbounded blocking queue of Delayed elements, eligible for removal once their delay expires (*read*) · fetched 2026-10-14
- **Our delta:** job-runner and rate-limiter examples.

### T10-11 · Variants — Know · 🔲 not written
- **Read this:** [D-ary heap](https://en.wikipedia.org/wiki/D-ary_heap) · Wikipedia · better cache behaviour than binary heaps and cheaper decrease-priority, used when those are common (*read*) · covers our angle: **full** for a concept-only row · fetched 2026-10-14
- **Also good:** [Fibonacci heap](https://en.wikipedia.org/wiki/Fibonacci_heap) · Wikipedia · amortised constant decrease-key and insert, with delete-min amortised O(log n) (*read*) · fetched 2026-10-14
- **Also good:** [Pairing heap](https://en.wikipedia.org/wiki/Pairing_heap) · Wikipedia · a simpler meldable heap that is fast in practice (*read*) · fetched 2026-10-14
- **Beyond the docs:** [A Back-to-Basics Empirical Study of Priority Queues](https://arxiv.org/abs/1403.0252) · Larkin, Sen, Tarjan · measures which heap wins in practice; the abstract reports the L1 cache miss rate appears strongly correlated with wall-clock time (*read*, abstract only) · fetched 2026-10-15
- **Our delta:** one paragraph each, and why the binary heap still wins in interviews.

---

## Phase 11 — Tries, segment trees and Fenwick trees

### T11-01 · The trie — Master · 🔲 not written
- **Read this:** [Implement Trie](https://neetcode.io/solutions/implement-trie-prefix-tree) · NeetCode · insert, search, startsWith with a 26-slot array node and a hash-map node; pitfall: search against startsWith (*read*) · covers our angle: **partial** — no memory cost or hash-set comparison · fetched 2026-10-15
- **Also good:** [Trie Interview Patterns](https://techinterview.org/trie-interview-patterns/) · techinterview.org · closing table of trie against hash set (prefix queries against exact membership), higher memory per character, map children for Unicode (*read*) · fetched 2026-10-15
- **Beyond the docs:** [Trie Data Structure](https://www.geeksforgeeks.org/dsa/trie-insert-and-search/) · GeeksforGeeks, last updated 18 Jan 2026 · insert, search and prefix code with a 26-slot child array per node, and names the memory cost of one pointer per alphabet letter as the main disadvantage against hashing (*read*) · fetched 2026-10-14
- **Also good:** [Trie](https://en.wikipedia.org/wiki/Trie) · Wikipedia · each child shares a prefix with its parent and the root is the empty string; basic tries can be memory-intensive; no hash collisions (*read*) · fetched 2026-10-14
- **Our delta:** when a hash set of prefixes beats a trie, with numbers (the table above says it only in words).

### T11-02 · Trie applications — Master · 🔲 not written
- **Read this:** [Trie Interview Patterns: A Complete Guide](https://techinterview.org/trie-interview-patterns/) · techinterview.org · wildcard dictionary, word search II with pruning, autocomplete with top-k cached per node, replace words, bitwise trie for max XOR (*read*) · covers our angle: **partial** — no longest-common-prefix walk · fetched 2026-10-15
- **Also good:** [Word Search II](https://neetcode.io/solutions/word-search-ii) · NeetCode · backtracking, then trie plus hash set, then trie with reference counts that cut dead branches (*read*) · fetched 2026-10-15
- **Our delta:** longest common prefix by single-child walk.

### T11-03 · The binary trie — Understand · 🔲 not written
- **Read this:** [Maximum XOR of Two Numbers in an Array](https://docs.vultr.com/problem-set/maximum-xor-of-two-numbers-in-an-array) · Vultr Docs · bitwise trie with greedy opposite-bit walk (Java) (*read*) · covers our angle: **partial** — range XOR queries absent · fetched 2026-10-15
- **Also good:** [Trie Interview Patterns](https://techinterview.org/trie-interview-patterns/) · techinterview.org · its bitwise-trie section for LeetCode 421 (*read*) · fetched 2026-10-15
- **Our delta:** XOR queries over a range (offline).

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
- **Also good:** [Point Update Range Sum](https://usaco.guide/gold/PURS) · USACO Guide · short BIT section with order-statistic-with-a-BIT and inversion-counting subsections (Python code, thin prose) (*read*) · fetched 2026-10-15
- **Also good:** [VisuAlgo, Fenwick Tree](https://visualgo.net/en/fenwicktree) · VisuAlgo, NUS · animated updates and prefix queries (*headings only*) · fetched 2026-10-14
- **Our delta:** written from memory in a few lines, then counting inversions and order statistics with it; the merge-sort route to inversions is already at `docs/dsa/pages/phase-2-recursion-maths-bits/02e-counting-inversions.md`.

### T11-06 · When these actually appear — Understand · 🔲 not written
- **Read this:** [Segment Tree and Fenwick Tree Interview Patterns](https://techinterview.org/segment-tree-fenwick-tree-patterns/) · techinterview.org · when-to-use-which table and key problems (307, 315, 327, 699); says only "senior engineering interviews and competitive programming" (*read*) · covers our angle: **partial** — no company expectations · fetched 2026-10-15
- **Also good:** [315. Count of Smaller Numbers After Self](https://walkccc.me/LeetCode/problems/315/) · walkccc · Fenwick, two segment-tree and merge-sort solutions (code only, little prose) (*read*) · fetched 2026-10-15
- **Our delta:** honest expectations by company type; no source found, so say it is a judgement.

### T11-07 · Lazy propagation — Know · 🔲 not written
- **Read this:** [Lazy Segment Trees (Recursive)](https://soi.ch/wiki/lazy-segment-trees) · SOI wiki · additive updates with pending tags pushed down on read, then combining additive and destructive updates (C++) (*read*) · covers our angle: full · fetched 2026-10-15
- **Also good:** [Segment Tree](https://cp-algorithms.com/data_structures/segment_tree.html) · cp-algorithms · lazy propagation section: addition, assignment, add-and-max (*read*) · fetched 2026-10-15

### T11-08 · The sparse table — Know · 🔲 not written
- **Read this:** [Sparse Table](https://cp-algorithms.com/data_structures/sparse-table.html) · cp-algorithms · O(1) minimum queries, limited to immutable arrays; the O(1) trick requires an idempotent function, so range sums need the slower variant (*read*) · covers our angle: **full** · fetched 2026-10-14
- **Also good:** [Range minimum query](https://en.wikipedia.org/wiki/Range_minimum_query) · Wikipedia · the problem and its place in LCA (*headings only*) · fetched 2026-10-14
- **Our delta:** static range minimum with the overlapping-ranges query, and when updates rule it out.

### T11-09 · Suffix structures — Know · 🔲 not written
- **Read this:** [Suffix Array](https://cp-algorithms.com/string/suffix-array.html) · cp-algorithms · naive sorting of suffixes is O(n squared log n), and the doubling approach reaches O(n log n) (*read*) · covers our angle: **full** for a what-it-solves row · fetched 2026-10-14
- **Also good:** [Suffix Automaton](https://cp-algorithms.com/string/suffix-automaton.html) · cp-algorithms · definition, linear-time construction and applications (*headings only*) · fetched 2026-10-14
- **Also good:** [Suffix tree](https://en.wikipedia.org/wiki/Suffix_tree) · Wikipedia · the related structure, linear-time with Ukkonen (*headings only*) · fetched 2026-10-14
- **Also good:** [Suffix Structures](https://usaco.guide/adv/string-suffix) · USACO Guide · suffix automaton, suffix tree and suffix array with conversions, C++ code, resource links (*read*) · covers our angle: **partial** — what they solve is one sentence; no note on interview frequency · fetched 2026-10-15
- **Our delta:** what they solve and an honest note on why interviews rarely ask.

### T11-10 · Tries in real systems — Know · 🔲 not written
- **Read this:** [httprouter](https://pkg.go.dev/github.com/julienschmidt/httprouter) · pkg.go.dev · a compressing dynamic trie (radix tree) matches request paths and scales to long paths and many routes (*read*) · covers our angle: **partial** — Go router, not Node · fetched 2026-10-14
- **Also good:** [Radix tree](https://en.wikipedia.org/wiki/Radix_tree) · Wikipedia · the compressed trie; names IP routing and inverted indexes of text documents as uses, and its references point to Linux and BSD kernel radix trees (*read*) · fetched 2026-10-14
- **Also good:** [Trie](https://en.wikipedia.org/wiki/Trie) · Wikipedia · names IP routing and forwarding tables as a use (*read*) · fetched 2026-10-14
- **Our delta:** the radix tree inside HTTP routers, and the autocomplete service of the System Design track.

### T11-11 · Order-statistic and interval trees — Know · 🔲 not written
- **Read this:** [Order statistic tree](https://en.wikipedia.org/wiki/Order_statistic_tree) · Wikipedia · each node stores its subtree size, maintained as size of node equals size of left plus size of right plus one (*read*) · covers our angle: **full** for a concept-only row · fetched 2026-10-14
- **Also good:** [Interval tree](https://en.wikipedia.org/wiki/Interval_tree) · Wikipedia · centred and augmented forms, with queries for intervals overlapping a point or an interval (*headings only*) · fetched 2026-10-14
- **Also good:** [Red-black Trees (rbtree) in Linux](https://www.kernel.org/doc/html/latest/core-api/rbtree.html) · Linux kernel docs · an interval tree as the worked example of an augmented rbtree (*read*) · fetched 2026-10-14
- **Our delta:** concept only, by augmenting a balanced tree with a subtree size or a maximum endpoint.
