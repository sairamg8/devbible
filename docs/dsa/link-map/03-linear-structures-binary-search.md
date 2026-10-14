---
title: "Link map · DSA · Part 3 (phases 6–8)"
sidebar_label: "03 · linear structures binary search"
sidebar_position: 3
---

# Link map · DSA · Part 3 (phases 6–8)

Covers every topic row of phases 6, 7 and 8 in `docs/dsa/syllabus/03-linear-structures-and-binary-search.md`: stacks, queues and monotonic structures (T06-01 to T06-11), linked lists (T07-01 to T07-13) and binary search (T08-01 to T08-12). That is 36 rows, each with a block below; tier words are copied from the syllabus tables. `docs/dsa/pages` holds pages for phases 0–2 only, so every row here is not written yet.
*read* = I read the passage that supports the claim; *headings only* = fetched at 200, headings or opening checked. "Official" here means canonical references (Wikipedia, cp-algorithms, Princeton algs4, USACO Guide, the Java and MDN docs). Third-party links carry a date only where the page shows one. No `#anchors` are given. Where no good non-official explanation turned up after a second search, the block has no "Beyond the docs" line. LeetCode problem pages returned 403 to a scripted fetch, so none are linked.

Language notes: most explainers below show Python, C++ or Java; the technique is language-neutral unless a block says otherwise. Our solutions are TypeScript first, Java second. Not used: the Hello Interview kth-smallest-matrix page and the AlgoMaster lesson bodies (paywalled or truncated), the Baeldung skip-list and exponential-search articles (403), and a Vultr Docs maximal-rectangle page whose prose says stack but whose code does not use one.

---

## Phase 6 — Stacks, queues and monotonic structures

### T06-01 · The stack for matching and parsing — Master · 🔲 not written
- **Read this:** [Algorithms 4e, 1.3 Bags, Queues, and Stacks](https://algs4.cs.princeton.edu/13stacks/) · Princeton (Sedgewick and Wayne) · Dijkstra's two-stack expression evaluation, plus array and linked-list stacks; the balanced-brackets program and precedence for unparenthesised input are left as exercises (*read*) · covers our angle: **partial** — no worked brackets, paths or decoding · fetched 2026-10-14
- **Also good:** [Reverse Polish notation](https://en.wikipedia.org/wiki/Reverse_Polish_notation) · Wikipedia · the Explanation section traces `3 4 −` on a stack (3 pushed, then 4, the subtraction pops two and pushes −1) and shows `3 4 − 5 + = (−1) 5 + = 4` as a chain of reductions, not a full stack trace (*read*) · fetched 2026-10-14
- **Beyond the docs:** [Valid Parentheses](https://neetcode.io/solutions/valid-parentheses) · NeetCode · brute-force pair removal (O(n squared)) against the stack (O(n) time and space), code in nine languages including Java and JavaScript (*read*) · fetched 2026-10-14
- **Our delta:** path simplification and decoding nested strings; neither source covers them.

### T06-02 · The monotonic stack — Master · 🔲 not written
- **Read this:** [All nearest smaller values](https://en.wikipedia.org/wiki/All_nearest_smaller_values) · Wikipedia · the pop-while-greater-or-equal stack; linear because every inner-loop pop removes an item pushed in an earlier iteration (the page does not say "pushed once, popped at most once" in those words) (*read*) · covers our angle: **partial** — values only, no indices, no Daily Temperatures or stock span · fetched 2026-10-14
- **Also good:** [Monotonic Stack](https://labuladong.gitbook.io/algo-en/data-structures/monotonic-stack) · labuladong · right-to-left template, a traced table for `[2,1,2,4,3]`, Daily Temperatures by pushing indices, and the circular variant by looping `2n-1` down to 0 with index modulo n (no new array is built) (*read*) · fetched 2026-10-14
- **Beyond the docs:** [Monotonic Stack](https://www.hellointerview.com/learn/code/stack/monotonic-stack) · Hello Interview · states the invariant (stack holds indices still waiting, values decreasing bottom to top, non-strict) and traces `[102, 101, 103, 102, 104, 103]`; Python only (*read*) · fetched 2026-10-14
- **Our delta:** stock span and the increasing-stack mirror, stated as one invariant.

### T06-03 · Largest rectangle in a histogram — Master · 🔲 not written
- **Read this:** [Largest Rectangle in Histogram](https://www.hellointerview.com/learn/code/stack/largest-rectangle-in-histogram) · Hello Interview · increasing stack of indices; on a shorter bar, pop and use the new stack top as the left boundary; leftovers use the array end as the right boundary; O(n) against O(n squared) brute force (*read*) · covers our angle: **partial** — the histogram only, and the page does not mention the maximal rectangle in a matrix · fetched 2026-10-14
- **Also good:** [All nearest smaller values](https://en.wikipedia.org/wiki/All_nearest_smaller_values) · Wikipedia · the previous-smaller and next-smaller stack that the width formula is built from; the page does not mention histograms or rectangles (*read*) · fetched 2026-10-14
- **Beyond the docs:** [Maximum size rectangle binary sub-matrix with all 1s](https://www.geeksforgeeks.org/maximum-size-rectangle-binary-sub-matrix-1s/) · GeeksforGeeks · per-column heights of consecutive 1s (reset on a 0), the histogram routine on every row, worked example with row areas 2, 4, 8, 6; O(n times m) time, O(m) extra space; C++, Java, Python, C#, JavaScript (*read*) · fetched 2026-10-14
- **Our delta:** maximal rectangle in a matrix is the GeeksforGeeks page above; the stack-in-TypeScript version is ours.

### T06-04 · Min-stack and the auxiliary structure — Master · 🔲 not written
- **Read this:** [Minimum Stack / Minimum Queue](https://cp-algorithms.com/data_structures/stack_queue_modification.html) · Algorithms for Competitive Programming · each entry stores its value plus the minimum from that element downward, so push, pop and min are O(1) (*read*) · covers our angle: **full** for the pair form · fetched 2026-10-14
- **Beyond the docs:** [Min Stack](https://neetcode.io/solutions/min-stack) · NeetCode · brute force (`getMin` pops everything into a temporary stack, O(n)), a second stack of minima, and a single stack of encoded differences with the 32-bit overflow caveat (*read*) · fetched 2026-10-14
- **Our delta:** none beyond naming the second-stack form against the pair form.

### T06-05 · The monotonic deque — Master · 🔲 not written
- **Read this:** [Minimum Stack / Minimum Queue](https://cp-algorithms.com/data_structures/stack_queue_modification.html) · Algorithms for Competitive Programming · method 1 keeps a deque in nondecreasing order, popping larger values from the back before pushing, so the head is the minimum; the page admits it does not store all elements; sliding-window minimum in O(n) (*read*) · covers our angle: **partial** — minimum rather than maximum, and no prefix-sum case · fetched 2026-10-14
- **Beyond the docs:** [862. Shortest Subarray with Sum at Least K](https://algo.monster/liteproblems/862) · algo.monster · prefix sums with a deque of increasing prefix values; why pop the front (a later end gives a longer window) and why pop the back (a later start with a smaller or equal prefix is at least as good); Python, Java, C++, TypeScript tabs (*read*) · fetched 2026-10-14
- **Our delta:** sliding-window maximum written out; flip the comparison.

### T06-06 · Circular buffers and array-backed queues — Master · 🔲 not written
- **Read this:** [Circular buffer](https://en.wikipedia.org/wiki/Circular_buffer) · Wikipedia · start and end indices (`head` and `tail` in its code) with modulo wrap-around; the full-versus-empty ambiguity fixed by a spare slot or a count (*read*) · covers our angle: **partial** — the code is C++23, nothing on JavaScript · fetched 2026-10-14
- **Also good:** [Array.prototype.shift()](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/shift) · MDN · says it shifts all values left by 1; gives no cost figure and never mentions queues, so the O(n) claim needs another source (*read*) · fetched 2026-10-14
- **Beyond the docs:** [Queue Feature Request](https://esdiscuss.org/topic/queue-feature-request) · es-discuss thread, Zach Boldyga and Filip Pizlo, 2017-02-25 · a forum post says `shift` is still intended to be O(n), V8's attempt to amortise shift and unshift "comes to a screeching halt with large arrays", and WebKit switches to an amortised deque; informal and old, so measure on a current Node (*read*) · fetched 2026-10-14
- **Our delta:** the benchmark story for `shift()` on large arrays; engines have changed, so measure on a current Node.

### T06-07 · A queue from two stacks, a stack from queues — Understand · 🔲 not written
- **Read this:** [Minimum Stack / Minimum Queue](https://cp-algorithms.com/data_structures/stack_queue_modification.html) · Algorithms for Competitive Programming · method 3, the in-stack and out-stack queue: move everything over only when the out-stack is empty; each element is added once, transferred once and popped once, so O(1) amortised (*read*) · covers our angle: **partial** — a counting argument, no potential function, no stack-from-queues · fetched 2026-10-14
- **Beyond the docs:** [Implement Queue using Stacks](https://neetcode.io/solutions/implement-queue-using-stacks) · NeetCode · the O(n) per-pop brute force and the amortised version, argued by counting (each element moves at most twice); there is no potential-function table (*read*) · fetched 2026-10-14
- **Our delta:** the potential-function argument (phi = 2 times the in-stack size) and stack from queues; no source read for either.

### T06-08 · Deques in TypeScript and Java — Understand · 🔲 not written
- **Read this:** [Deque (Java SE 25)](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/util/Deque.html) · Java API docs · the two tables mapping Queue and Stack methods to Deque methods; says "This interface should be used in preference to the legacy Stack class" (*read*) · covers our angle: **partial** — Java only · fetched 2026-10-14
- **Also good:** [ArrayDeque (Java SE 25)](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/util/ArrayDeque.html) · Java API docs · likely faster than Stack as a stack and than LinkedList as a queue, null elements prohibited, most operations amortised constant (*read*) · fetched 2026-10-14
- **Our delta:** the TypeScript five-minute deque; no good source found (MDN's Array page lists push, pop, shift, unshift only; the `@blakeembrey/deque` repo README says "circular array" but has no design explanation).

### T06-09 · Stack-based simulation — Understand · 🔲 not written
- **Read this:** [Asteroid Collision](https://guides.codepath.org/compsci/Asteroid-Collision) · CodePath · push right-movers, resolve a left-mover against the top (smaller pops, equal both go, larger survives); three traced examples, O(n); Python (*read*) · covers our angle: **partial** — asteroids only · fetched 2026-10-14
- **Also good:** [Remove All Adjacent Duplicates In String](https://docs.vultr.com/problem-set/remove-all-adjacent-duplicates-in-string) · Vultr Docs · a stack of characters, pop when the top matches the current one; `abbaca` traced to `ca`; O(n) time; Java (*read*) · fetched 2026-10-14
- **Also good:** [Stack (abstract data type)](https://en.wikipedia.org/wiki/Stack_(abstract_data_type)) · Wikipedia · applications: expression evaluation and syntax parsing, backtracking (depth-first search as the prototype), the call stack (*read*) · fetched 2026-10-14
- **Our delta:** the editor buffer; no source found for it.

### T06-10 · Recursion as an explicit stack — Understand · 🔲 not written
- **Read this:** [Tree traversal](https://en.wikipedia.org/wiki/Tree_traversal) · Wikipedia · the depth-first section gives iterative pseudocode for pre-, in- and post-order with one stack, and says the iterative forms avoid recursion's stack-space limits, though they still hold a stack as deep as the tree (*read*) · covers our angle: **full** for the three traversals · fetched 2026-10-14
- **Beyond the docs:** [Iterative Binary Tree Traversal Using Stack](https://www.enjoyalgorithms.com/blog/iterative-binary-tree-traversals-using-stack/) · EnjoyAlgorithms · two-stack and last-visited single-stack postorder; O(n) time and O(h) space are stated for the two-stack version only; C++-style pseudocode (*read*) · fetched 2026-10-14
- **Our delta:** graph DFS with an explicit stack is previewed in Part 5.

### T06-11 · Design problems on stacks and queues — Know · 🔲 not written
- **Read this:** [Design Browser History](https://neetcode.io/solutions/design-browser-history) · NeetCode · four designs with a cost table: two stacks, dynamic array, optimal array with a size field, doubly linked list; code in ten languages including TypeScript and Java (*read*) · covers our angle: **partial** — browser history only · fetched 2026-10-14
- **Our delta:** the undo stack and the queue with a maximum (the monotonic deque of T06-05 reused); no source read.

---

## Phase 7 — Linked lists

### T07-01 · Singly and doubly linked lists — Master · 🔲 not written
- **Read this:** [Linked list](https://en.wikipedia.org/wiki/Linked_list) · Wikipedia · sections on singly and doubly linked lists, sentinel (dummy) nodes, and linked lists versus dynamic arrays (*read*, those passages only) · covers our angle: **partial** — reference, not a tutorial · fetched 2026-10-14
- **Also good:** [Algorithms 4e, 1.3](https://algs4.cs.princeton.edu/13stacks/) · Princeton · the node class and insert and remove at the front, insert at the end, traversal (*read*) · fetched 2026-10-14
- **Beyond the docs:** [Using Sentinel Nodes to improve your Doubly Linked Lists](https://codinginterviewsmadesimple.substack.com/p/using-sentinel-nodes-to-improve-your) · Devansh, Technology Made Simple (Substack), 2022-09-28 · dummy head and tail nodes instead of null remove special cases, at the cost of one extra node; a circular doubly linked list in Python (*read*) · fetched 2026-10-14
- **Our delta:** the dummy head as a habit for singly linked lists and the LRU motivation (see T07-06).

### T07-02 · Reversal — Master · 🔲 not written
- **Read this:** [Reverse Linked List (labuladong)](https://labuladong.gitbook.io/algo-en/data-structures/reverse-linked-list) · labuladong · recursive reversal, reverse the first N nodes, reverse between m and n (iterative versions included), reverse in k groups (recursive, with an iterative `reverseN` helper); Java (*read*) · covers our angle: **full** — recursion first, so the drawn three-pointer dance gets less space · fetched 2026-10-14
- **Also good:** [Reverse a Linked List](https://www.enjoyalgorithms.com/blog/reverse-linked-list/) · EnjoyAlgorithms · iterative with prev, curr and a next pointer (O(1) space) and recursive (O(n) space); the iterative section's "O(1)" time line is a typo, the comparison gives O(n); C++, Python, Java (*read*) · fetched 2026-10-14
- **Also good:** [Tricks to Reverse a Linked List Recursively](https://labuladong.online/algo/en/data-structure/reverse-linked-list-recursion/) · labuladong · step-through visualisation panels for the iterative and recursive solutions; the first-N, m-to-n and k-group bodies were not in the text I got (*read*, first two solutions) · fetched 2026-10-14
- **Our delta:** the drawing-first discipline.

### T07-03 · Fast and slow on lists — Master · 🔲 not written
- **Read this:** [Cycle detection](https://en.wikipedia.org/wiki/Cycle_detection) · Wikipedia · Floyd's three phases: meet, reset the tortoise to the start to find mu, then walk the hare to find lambda; O(lambda + mu) operations, O(1) storage (*read*) · covers our angle: **partial** — only a sketch of why it works (and a notation slip in phase 2), and no middle or palindrome list · fetched 2026-10-14
- **Also good:** [Tortoise and Hare Algorithm (Linked List cycle detection)](https://cp-algorithms.com/others/tortoise_and_hare.html) · Algorithms for Competitive Programming · the algebraic proof: a steps from head to the cycle entry, L the cycle length, b from entry to meeting point; the equation a = (y − 2x)L − b shows a more steps from the meeting point reach the entry; no complexity stated (*read*) · fetched 2026-10-14
- **Beyond the docs:** [Palindrome Linked List](https://www.hellointerview.com/learn/code/linked-list/palindrome-linked-list) · Hello Interview · fast and slow pointers to the middle, reverse the second half in place, compare, optionally restore; O(n) time, O(1) space; Python (*read*) · fetched 2026-10-14
- **Our delta:** the L = mC − k form of the proof in our own symbols, and the middle of an even-length list.

### T07-04 · Merging — Master · 🔲 not written
- **Read this:** [Merge K Sorted Lists](https://neetcode.io/solutions/merge-k-sorted-lists) · NeetCode · six approaches: sort everything, scan the heads, merge one by one (O(n times k)), min-heap (O(n log k), O(k) space), divide and conquer recursive (O(n log k), O(log k) stack) and iterative (O(k) space) (*read*) · covers our angle: **partial** — k lists; the two-list merge is assumed · fetched 2026-10-14
- **Also good:** [Merge Two Sorted Lists](https://neetcode.io/solutions/merge-two-sorted-lists) · NeetCode · recursion (O(n + m) stack) and iteration with a dummy node (O(1) space); nine languages (*read*) · fetched 2026-10-14
- **Our delta:** the two-list merge written out in TypeScript.

### T07-05 · One-pass tricks — Master · 🔲 not written
- **Read this:** [Remove Nth Node From End of List](https://leetsolve.readthedocs.io/Two_Pointers/19_Remove_Nth_Node_From_End_of_List.html) · LeetSolve · a fast pointer n ahead, then both move; the slow pointer lands before the target; C++, no dummy node (head removal is a special case) (*read*) · covers our angle: **partial** · fetched 2026-10-14
- **Also good:** [Remove Nth Node From End of List](https://neetcode.io/solutions/remove-nth-node-from-end-of-list) · NeetCode · array, two-pass, recursion and the one-pass gap-pointer version; only the last uses a dummy node, so head removal needs no special case; O(N) time, O(1) space (*read*) · fetched 2026-10-14
- **Our delta:** the k-th from the end variant.

### T07-06 · The LRU cache — Master · 🔲 not written
- **Read this:** [LinkedHashMap (Java SE 25)](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/util/LinkedHashMap.html) · Java API docs · the access-order constructor is "well-suited to building LRU caches"; `removeEldestEntry` evicts; in an access-ordered map merely calling `get` is a structural modification (*read*) · covers our angle: **partial** — the built-in shortcut, not the hand-made list · fetched 2026-10-14
- **Also good:** [Map](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map) · MDN · iteration is in insertion order; the spec asks only for access times that are sublinear on average, so a hash table or a search tree both fit; no mention of LRU (*read*) · fetched 2026-10-14
- **Beyond the docs:** [LRU Cache](https://www.interviewcake.com/concept/lru-cache) · Interview Cake · hash map plus doubly linked list, head is most recent, eviction from the tail; no code, does not explain why the list must be doubly linked, and its cost tables did not render (*read*) · fetched 2026-10-14
- **Our delta:** the JavaScript `Map` delete-then-set trick follows from MDN's insertion-order rule but is not shown there, and where it stops being a shortcut.

### T07-07 · Reorder, rotate and partition — Understand · 🔲 not written
- **Read this:** [Reorder List](https://neetcode.io/solutions/reorder-list) · NeetCode · array (O(n) space), recursion (O(n) stack), and middle plus reverse plus merge in O(1) space (*read*) · covers our angle: **partial** — no rotate · fetched 2026-10-14
- **Also good:** [Rotate List](https://neetcode.io/solutions/rotate-list) · NeetCode · k modulo n, then either cut at position length minus k minus 1 or close the list into a ring and break it at the new tail; forgetting to null the new tail leaves a cycle; O(n) time, O(1) space (*read*) · fetched 2026-10-14
- **Also good:** [Partition List Around Value](https://guides.codepath.org/compsci/Partition-List-Around-Value) · CodePath · two dummy-headed lists, join, end the second with None to avoid a cycle; order kept, O(N) time, O(1) space; Python (*read*) · fetched 2026-10-14
- **Our delta:** the three written out in TypeScript with the same dummy-head habit.

### T07-08 · Copying a list with random pointers — Understand · 🔲 not written
- **Read this:** [Copy List with Random Pointer](https://guides.codepath.org/compsci/Copy-List-with-Random-Pointer) · CodePath · interleave copies after originals, set random from the original's random target, unweave; O(N) time, O(1) extra space; Python (*read*) · covers our angle: **partial** — the hash-map alternative is only named · fetched 2026-10-14
- **Also good:** [138. Copy List with Random Pointer](https://algo.monster/liteproblems/138) · algo.monster · the hash-map version in full with a three-node walkthrough (O(n) time and space); interweaving is only mentioned as the O(1) alternative, with no complete code; Python, Java, C++, TypeScript (*read*) · fetched 2026-10-14
- **Our delta:** the interleave written out in TypeScript after the map baseline.

### T07-09 · Arithmetic on lists — Understand · 🔲 not written
- **Read this:** [Add Two Numbers II](https://neetcode.io/solutions/add-two-numbers-ii) · NeetCode · forward digits by reversing both lists (changes the inputs), or by two stacks that leave the inputs unchanged; both O(m + n) time (*read*) · covers our angle: **partial** — forward order only · fetched 2026-10-14
- **Beyond the docs:** [Add Two Numbers by Two Linked List](https://helloacm.com/add-two-numbers-by-two-linked-list-most-significant-digit-comes-first/) · helloacm, 2019-11-28 · two stacks, prepend each result node, add a final carry node; C++ (*read*) · fetched 2026-10-14
- **Our delta:** the reversed-digit case with the carry flowing forward.

### T07-10 · Intersection of two lists — Understand · 🔲 not written
- **Read this:** [Intersection of Two Linked Lists](https://guides.codepath.org/compsci/Intersection-of-Two-Linked-Lists) · CodePath · each pointer jumps to the other head at the end, so both travel N + M; compare node identity, not value; O(N + M) time, O(1) space; Python (*read*) · covers our angle: **full** for the switch · fetched 2026-10-14
- **Also good:** [Intersection of Two Linked Lists](https://leetsolve.readthedocs.io/Linked_List/160_Intersection_of_Two_Linked_Lists.html) · LeetSolve · a hash map of one list's nodes (O(m) space), and length alignment: advance the longer list by the difference, then walk together (O(1) space); no switch trick; C++ (*read*) · fetched 2026-10-14
- **Our delta:** the two approaches side by side, with why the switch aligns the pointers.

### T07-11 · Lists in Java and TypeScript — Understand · 🔲 not written
- **Read this:** [LinkedList (Java SE 25)](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/util/LinkedList.html) · Java API docs · doubly-linked implementation of List and Deque, permits null, indexing walks from the nearer end, push and pop act on the front (*read*) · covers our angle: **partial** — Java only · fetched 2026-10-14
- **Our delta:** why the interviewer hands you the node class, and JavaScript lists; two searches found only tutorial fragments, so no source read.

### T07-12 · Flattening and other structural changes — Know · 🔲 not written
- **Read this:** [430. Flatten a Multilevel Doubly Linked List](https://algo.monster/liteproblems/430) · algo.monster · recursive DFS that returns the tail, dummy head, O(n) time, O(n) space as written; notes an iterative version with an explicit stack for pending next pointers would cut space to the nesting depth, but gives no code; Python, Java, C++, TypeScript (*read*) · covers our angle: **partial** — the recursion, not the explicit-stack code · fetched 2026-10-14
- **Our delta:** the explicit-stack version, written out.

### T07-13 · Skip lists — Know · 🔲 not written
- **Read this:** [Skip list](https://en.wikipedia.org/wiki/Skip_list) · Wikipedia · express lanes over a linked list, promotion with probability p, O(log n) expected search and insert (worst case O(n)), and who uses it (Redis ordered sets, RocksDB memtable, Java's ConcurrentSkipListMap) (*read*) · covers our angle: **full** for a concept-only topic · fetched 2026-10-14
- **Also good:** [Skip lists lecture notes](https://courses.cs.umbc.edu/undergraduate/341/fall03/Lectures/SkipLists/skip_lists/skip_lists.html) · Thomas A. Anastasio, UMBC, dated 1999-11-22 on the page · random node levels, search, insert, delete described as analogous to insert; C++ class code; figures missing from the text (*read*) · fetched 2026-10-14
- **Beyond the docs:** [Understanding Skip Lists](https://alexshen.substack.com/p/understanding-skip-lists) · Alexander Shen, Substack, 2024-07-07 · the tower of copies per key, search, insert with a random height, delete; expected O(log n); C++-style pseudocode with a few inconsistencies (*read*) · fetched 2026-10-14
- **Our delta:** none.

---

## Phase 8 — Binary search

### T08-01 · The template — Master · 🔲 not written
- **Read this:** [Binary search](https://en.wikipedia.org/wiki/Binary_search) · Wikipedia · the L and R procedure with midpoint L plus floor of (R minus L) over 2, the variant that tests equality once, the leftmost and rightmost procedures; the Implementation issues section says L plus R may exceed the integer range and fixes it with L + (R − L)/2 for nonnegative bounds, and that the bug sat in Bentley's Programming Pearls code and the Java library (*read*) · covers our angle: **partial** — no stated invariant · fetched 2026-10-14
- **Also good:** [Binary Search](https://usaco.guide/silver/binary-search) · USACO Guide · firstTrue and lastTrue templates, and a common-mistakes list (infinite loop with the low midpoint, negative bounds, overflow); the code is Python, C++ appears only in the overflow remark (*read*) · fetched 2026-10-14
- **Beyond the docs:** [Extra, Extra - Read All About It: Nearly All Binary Searches and Mergesorts are Broken](https://research.google/blog/extra-extra-read-all-about-it-nearly-all-binary-searches-and-mergesorts-are-broken/) · Joshua Bloch, Google Research blog, 2006-06-02 · the overflow in (low + high) / 2 and the fixes `low + ((high - low) / 2)` and `>>> 1`; Java, plus a C/C++ fix that a 2008 update says C99 does not guarantee (*read*) · fetched 2026-10-14
- **Our delta:** JavaScript has no integer overflow here (numbers are doubles), so the bug bites in Java and C only.

### T08-02 · On a sorted array — Master · 🔲 not written
- **Read this:** [Binary search](https://en.wikipedia.org/wiki/Binary_search) · Wikipedia · leftmost gives rank, rightmost gives successor, and predecessor, successor and nearest neighbour are built from them (*read*) · covers our angle: **full** — in prose, with no worked problem · fetched 2026-10-14
- **Beyond the docs:** [Find First and Last Position of Element in Sorted Array](https://neetcode.io/solutions/find-first-and-last-position-of-element-in-sorted-array) · NeetCode · linear scan, biased search twice, or lower bound of target and of target plus one, plus a built-in version; its Java `Arrays.binarySearch`-then-expand code is O(n) worst case, which its own comments admit although the section is labelled O(log n) (*read*) · fetched 2026-10-14
- **Our delta:** insert position and the closest element worked as two small functions.

### T08-03 · Rotated sorted arrays — Master · 🔲 not written
- **Read this:** [Find Minimum in Rotated Sorted Array](https://neetcode.io/solutions/find-minimum-in-rotated-sorted-array) · NeetCode · compare mid with right; `right = mid` or `left = mid + 1`; loop while left is below right; unique values assumed (*read*) · covers our angle: **partial** — no duplicates · fetched 2026-10-14
- **Also good:** [Find Minimum in Rotated Sorted Array II](https://docs.vultr.com/problem-set/find-minimum-in-rotated-sorted-array-ii) · Vultr Docs · duplicates: when mid equals high, decrement high by one; says logarithmic in the best and average case but states no worst case, which is our inference (*read*) · fetched 2026-10-14
- **Also good:** [Search in Rotated Sorted Array](https://neetcode.io/solutions/search-in-rotated-sorted-array) · NeetCode · one pass deciding which half is sorted, or find the pivot then search; use `<=` for the left test; unique values (*read*) · fetched 2026-10-14
- **Also good:** [Search in Rotated Sorted Array II](https://neetcode.io/solutions/search-in-rotated-sorted-array-ii) · NeetCode · when the left and mid values are equal move left by one; O(log n) on average, O(n) worst case when most elements are duplicates (*read*) · fetched 2026-10-14
- **Our delta:** an all-equal-values input as the worked worst case.

### T08-04 · Search on the answer — Master · 🔲 not written
- **Read this:** [Binary Search](https://usaco.guide/silver/binary-search) · USACO Guide · binary search on the answer needs a monotonic boolean f(x); worked maximum-median example (Codeforces 1201C: sort, search the median, sum the cost of raising the upper half) (*read*) · covers our angle: **partial** — one example, no shipping or eating-speed problems · fetched 2026-10-14
- **Beyond the docs:** [Binary Search on the Answer: Solving Koko Eating Bananas](https://johnkavanagh.co.uk/articles/binary-search-on-the-answer-solving-koko-eating-bananas/) · John Kavanagh, 2026-01-12 · the `canFinishAtSpeed` predicate, bounds 1 to the largest pile; TypeScript (*read*) · fetched 2026-10-14
- **Our delta:** shipping capacity, minimum days, splitting an array, k-th smallest pair distance.

### T08-05 · Recognising binary search — Master · 🔲 not written
- **Read this:** [Binary Search](https://usaco.guide/silver/binary-search) · USACO Guide · the monotone-function condition for firstTrue and lastTrue (*read*) · covers our angle: **partial** · fetched 2026-10-14
- **Also good:** [Binary Search - Algorithms for Competitive Programming](https://cp-algorithms.com/num_methods/binary_search.html) · cp-algorithms · search on the answer (maximise a floored average over long-enough subarrays by subtracting the candidate and using prefix sums) and lower and upper bound (*read*) · fetched 2026-10-14
- **Our delta:** the "minimum x such that" phrasing as a checklist.

### T08-06 · In TypeScript and Java — Master · 🔲 not written
- **Read this:** [Arrays (Java SE 25)](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/util/Arrays.html) · Java API docs · `binarySearch(int[], int)`: the array must be sorted or results are undefined; with duplicates no guarantee which is found; returns the index if found, otherwise `-(insertion point) - 1`, the insertion point being the first element greater than the key or `a.length`, so the result is nonnegative exactly when the key is found. WebFetch truncated this 400 KB page, so I read the method text from the page HTML (*read*) · covers our angle: **partial** — Java side only · fetched 2026-10-14
- **Our delta:** no bisect in JavaScript; why you write your own. No source read for the JavaScript side.

### T08-07 · On a two-dimensional matrix — Understand · 🔲 not written
- **Read this:** [Search a 2D Matrix](https://neetcode.io/solutions/search-a-2d-matrix) · NeetCode · flatten with `m // COLS` and `m % COLS` (O(log(m n))), two searches (O(log m + log n)), or the staircase from the top-right (O(m + n)) (*read*) · covers our angle: **full** for the first two · fetched 2026-10-14
- **Beyond the docs:** [Kth Smallest Element in Sorted Matrix](https://codemia.io/knowledge-hub/path/kth_smallest_element_in_sorted_matrix) · Codemia · binary search on the value with a bottom-left staircase count (O(n) per count, no overall bound stated), or a min-heap (O(k log n)); Python (*read*) · fetched 2026-10-14
- **Our delta:** the sorted-matrix complexity derivation; the page leaves it implicit.

### T08-08 · Median of two sorted arrays — Understand · 🔲 not written
- **Read this:** [Median of Two Sorted Arrays](https://neetcode.io/solutions/median-of-two-sorted-arrays) · NeetCode · four approaches; the optimal one binary searches the cut in the smaller array; the cross conditions Aleft at most Bright and Bleft at most Aright; infinities or limits at the edges; O(log min(n, m)) (*read*) · covers our angle: **full** — but its code uses two conventions (Python and Swift: `half = total // 2`, the odd median on the right; Java, C++, JavaScript and others: `half = (total + 1) / 2`), so pick one · fetched 2026-10-14
- **Our delta:** one convention, stated once.

### T08-09 · Unknown or unbounded length — Understand · 🔲 not written
- **Read this:** [Exponential search](https://en.wikipedia.org/wiki/Exponential_search) · Wikipedia · double the bound until the element is at least the key, then binary search the last range; O(log i) with i the key's position; Bentley and Yao, 1976 (*read*) · covers our angle: **full** · fetched 2026-10-14
- **Our delta:** the sentinel for out-of-range reads in an interview API.

### T08-10 · Floating-point binary search — Know · 🔲 not written
- **Read this:** [Binary Search - Algorithms for Competitive Programming](https://cp-algorithms.com/num_methods/binary_search.html) · cp-algorithms · continuous search needs only continuity (intermediate value theorem), not monotonicity; about O(log((R minus L) over delta)) steps; never mentions square roots (*read*) · covers our angle: **partial** — no square root, no fixed iteration count · fetched 2026-10-14
- **Beyond the docs:** [Your bisection search is wrong](https://infoarena.ro/blog/your-bisection-search-is-wrong) · Cosmin Negruseri, infoarena blog, 2014-05-19 · an absolute epsilon loops forever at 1e37, a relative epsilon misbehaves near zero, and a fixed 120 iterations fails at 1e60 (about 1100 would cover the double range); Python (*read*) · fetched 2026-10-14
- **Our delta:** fixed iteration counts against tolerance loops, and square roots.

### T08-11 · Ternary search and unimodal functions — Know · 🔲 not written
- **Read this:** [Ternary Search](https://cp-algorithms.com/num_methods/ternary_search.html) · cp-algorithms · unimodal definition, two inner points, golden-section variant, 200 to 300 iterations for 1e-6, integer variant stops when the range is under 3 wide (*read*) · covers our angle: **full** · fetched 2026-10-14
- **Also good:** [Ternary Search](https://usaco.guide/gold/ternary-search) · USACO Guide · integer versions adjust bounds by one, float versions use an epsilon; binary search on the slope as the shorter integer alternative; worked Haybale Distribution; Python and C++ (*read*) · fetched 2026-10-14
- **Our delta:** none.

### T08-12 · The same idea in trees and databases — Know · 🔲 not written
- **Read this:** [B-tree](https://en.wikipedia.org/wiki/B-tree) · Wikipedia · "Searching is similar to searching a binary search tree", with binary search typically (but not necessarily) used within nodes; the intro says the B-tree generalizes the BST (*read*, first part of the page) · covers our angle: **full** for the B-tree half · fetched 2026-10-14
- **Also good:** [Binary search tree](https://en.wikipedia.org/wiki/Binary_search_tree) · Wikipedia · search in O(h), degenerates to O(n) when unbalanced (*read*) · fetched 2026-10-14
- **Also good:** [B-Tree Indexes (PostgreSQL)](https://www.postgresql.org/docs/current/btree.html) · PostgreSQL docs, version 18 when fetched · leaf pages, internal pages with downlinks, page splits; the page does not mention binary search within a page (*read*) · fetched 2026-10-14
- **Beyond the docs:** [Search within a Page](https://scholarsmine.mst.edu/comsci_facwork/348) · H. R. Strong, G. Markowsky and A. K. Chandra, Journal of the ACM, July 1979 · the abstract compares B-tree search, binary search and square-root search inside one page of an ordered index and concludes binary search is generally preferable; full text is behind the ACM, so only the abstract was read (*read*, abstract only) · fetched 2026-10-14
- **Our delta:** the BST is previewed in Part 4.
