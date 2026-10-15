---
title: "Link map · DSA · Part 3 (phases 6–8)"
sidebar_label: "03 · linear structures & binary search"
sidebar_position: 3
---

# Link map · DSA · Part 3 (phases 6–8)

Covers every topic row of phases 6, 7 and 8 in `docs/dsa/syllabus/03-linear-structures-and-binary-search.md`: stacks, queues and monotonic structures (T06-01 to T06-11), linked lists (T07-01 to T07-13) and binary search (T08-01 to T08-12). That is 36 rows. Four have a written page of ours; the rest are not written yet, and their "Our delta" line says what the syllabus row promises.
*read* = I read the passage that supports the claim on the fetched page; *headings only* = fetched at HTTP 200 and not read for the claim. Third-party links carry a date only where the page shows one. No `#anchors` are given. Official means language specs, MDN, Oracle Java SE 21 API docs and cp-algorithms; Wikipedia and university course notes are given as reference. Where no good non-official explanation turned up, the block has no "Beyond the docs" line.

---

## Phase 6 — Stacks, queues and monotonic structures

### T06-01 · The stack for matching and parsing — Master · 🔲 not written
- **Read this:** [Stack Overview](https://www.hellointerview.com/learn/code/stack/overview) · Hello Interview · the push and pop rule from LIFO, then valid parentheses worked end to end with a Python solution (*read*) · covers our angle: **partial** — brackets only, in Python; Decode String and Longest Valid Parentheses appear as practice links, with no path simplification or postfix · fetched 2026-10-15
- **Also good:** [Decode String](https://neetcode.io/solutions/decode-string) · NeetCode · nested decoding as recursion, then a one-stack and a two-stack (counts and strings) version, with Java and JavaScript code (*read*) · fetched 2026-10-15
- **Also good:** [Reverse Polish notation](https://en.wikipedia.org/wiki/Reverse_Polish_notation) · Wikipedia · push operands, on an operator pop two, apply, push the result (*read*) · fetched 2026-10-14
- **Beyond the docs:** [Bags, Queues, and Stacks](https://algs4.cs.princeton.edu/13stacks/) · Sedgewick and Wayne, Princeton, last modified 2020-02-13 · Dijkstra's two-stack expression evaluation as numbered steps, with `Evaluate.java` linked rather than shown; exercise 5 asks for a balanced-brackets checker (*read*) · fetched 2026-10-14
- **Our delta:** the syllabus row promises four shapes at once: balanced brackets, path simplification, postfix and nested-string decoding; no source here covers path simplification.

### T06-02 · The monotonic stack — Master · 🔲 not written
- **Read this:** [Monotonic Stack Template: Next Greater Element and More](https://labuladong.online/en/algo/data-structure/monotonic-stack/) · labuladong · the template for next greater element, daily temperatures and the circular-array trick, with Java and JavaScript code; states that each element is pushed once and popped at most once, so the nested loop is O(n) (*read*) · covers our angle: **partial** — no stock span · fetched 2026-10-15
- **Also good:** [Daily Temperatures](https://www.hellointerview.com/learn/code/stack/daily-temperatures) · Hello Interview · a decreasing stack of indices, O(n) against the O(n^2) brute force (*read*) · fetched 2026-10-15
- **Also good:** [All nearest smaller values](https://en.wikipedia.org/wiki/All_nearest_smaller_values) · Wikipedia · the stack method has a nested loop yet is linear, because each inner pop discards an item pushed earlier (*read*) · fetched 2026-10-14
- **Beyond the docs:** [Monotonic Stack and Queue Interview Patterns](https://www.techinterview.org/post/3233465178/monotonic-stack-queue-interview-patterns/) · techinterview.org, 2026-04-17 · "each element is pushed and popped at most once", walked through next greater (with the circular variant) and daily temperatures; the page does not mention stock span (*read*) · fetched 2026-10-14
- **Our delta:** the syllabus row's "pop while" invariant stated once and tied to the push-once, pop-once bound, plus stock span, which none of these sources covers; our amortised page `docs/dsa/pages/phase-1-complexity/03-amortised-analysis.md` only lists it as a case of the 2n bound, with one short code sketch.

### T06-03 · Largest rectangle in a histogram — Master · 🔲 not written
- **Read this:** [Largest Rectangle in Histogram](https://www.hellointerview.com/learn/code/stack/largest-rectangle-in-histogram) · Hello Interview · the first shorter bar on each side sets a bar's width, then an increasing stack of indices finds both in one pass; states each index is pushed and popped at most once; Python code (*read*) · covers our angle: **partial** — no sentinel and no maximal rectangle in a matrix · fetched 2026-10-15
- **Also good:** [Largest Rectangle In Histogram](https://neetcode.io/solutions/largest-rectangle-in-histogram) · NeetCode · brute force, segment tree, then three stack versions, with Java and JavaScript code (*read*) · fetched 2026-10-15
- **Also good:** [85. Maximal Rectangle](https://walkccc.me/LeetCode/problems/85/) · walkccc · code-only: the matrix problem reduced to a per-row histogram, each row passed to the histogram solution (*read*) · fetched 2026-10-15
- **Beyond the docs:** [Monotonic Stack and Queue Interview Patterns](https://www.techinterview.org/post/3233465178/monotonic-stack-queue-interview-patterns/) · techinterview.org, 2026-04-17 · largest rectangle (LC 84) with an increasing stack and a zero appended to flush it (*read*) · fetched 2026-10-14
- **Our delta:** the syllabus row promises the maximal rectangle in a matrix built on the histogram; the only source here for it is the code-only page above.

### T06-04 · Min-stack and the auxiliary structure — Master · 🔲 not written
- **Read this:** [Minimum stack / Minimum queue](https://cp-algorithms.com/data_structures/stack_queue_modification.html) · cp-algorithms · each stored element carries the minimum from the bottom up to itself, so the minimum reads off the top in constant time (*read*) · covers our angle: **full** for the pair form; the second stack and the single-stack form are on the NeetCode page below · fetched 2026-10-14
- **Also good:** [Min Stack](https://neetcode.io/solutions/min-stack) · NeetCode · brute force, a second min-stack, then one stack storing the difference from the minimum (*read*) · fetched 2026-10-15
- **Our delta:** the syllabus row promises both the pair and the second stack as options.

### T06-05 · The monotonic deque — Master · 🔲 not written
- **Read this:** [Monotonic Queue to Solve Sliding Window Problems](https://labuladong.online/en/algo/data-structure/monotonic-queue/) · labuladong · why a window needs a monotonic queue, then the push, pop and max API for sliding window maximum, and why its while loop still gives O(N) overall (*read*) · covers our angle: **partial** — no shortest subarray with sum at least k · fetched 2026-10-15
- **Also good:** [Sliding Window Maximum](https://neetcode.io/solutions/sliding-window-maximum) · NeetCode · brute force, segment tree, heap, DP, then the deque of indices in decreasing value order (*read*) · fetched 2026-10-15
- **Also good:** [862. Shortest Subarray with Sum at Least K](https://walkccc.me/LeetCode/problems/862/) · walkccc · code-only: prefix sums plus a deque of indices (*read*) · fetched 2026-10-15
- **Also good:** [Minimum stack / Minimum queue](https://cp-algorithms.com/data_structures/stack_queue_modification.html) · cp-algorithms · a nondecreasing deque keeps the minimum at the front; applied to the minimum of every fixed-length window in linear time (*read*) · fetched 2026-10-14
- **Our delta:** the syllabus row adds the prefix-sum variant, shortest subarray with a sum of at least k, where negatives break the plain window.

### T06-06 · Circular buffers and array-backed queues — Master · 🔲 not written
- **Read this:** [Circular buffer](https://en.wikipedia.org/wiki/Circular_buffer) · Wikipedia · a fixed-size buffer treated as end-to-end; start and end indexes alone cannot tell full from empty, so use Length minus 1 slots or a separate count (*read*) · covers our angle: **partial** — no TypeScript, and nothing on why `shift` is the wrong queue · fetched 2026-10-14
- **Also good:** [Array.prototype.shift()](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/shift) · MDN · shifts every remaining value left and decrements length; the page gives no complexity figure, so the cost is an inference (*read*) · fetched 2026-10-14
- **Our delta:** a bounded queue you write yourself in TypeScript, and the measured cost of `shift`; the `shift` cost is already tabulated in `docs/dsa/pages/phase-1-complexity/06-hidden-costs.md`.

### T06-07 · A queue from two stacks, a stack from queues — Understand · ✅ written `docs/dsa/pages/phase-1-complexity/03-amortised-analysis.md`
- **Read this:** [Implement Stack with Queue, Implement Queue with Stack](https://labuladong.online/en/algo/data-structure/stack-queue/) · labuladong · a queue from two stacks (elements move between the stacks, amortised O(1) because each moves at most once) and a stack from one queue, with Java and JavaScript code (*read*) · covers our angle: **full** on both halves of the row · fetched 2026-10-15
- **Also good:** [Amortized analysis](https://en.wikipedia.org/wiki/Amortized_analysis) · Wikipedia, last edited 2026-01-08 · the queue example uses an input and an output list and moves elements only when the output is empty, so dequeue is amortised O(1) (*read*) · fetched 2026-10-14
- **Also good:** [Minimum stack / Minimum queue](https://cp-algorithms.com/data_structures/stack_queue_modification.html) · cp-algorithms · method 3 simulates a queue with two modified stacks (*read*) · fetched 2026-10-14
- **Our delta:** our page tabulates the two-stacks queue as Θ(1) amortised with the each-element-moved-once reason; the stack-from-queues half is the syllabus row's addition and is not on our page.

### T06-08 · Deques in TypeScript and Java — Understand · 🔲 not written
- **Read this:** [ArrayDeque](https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/util/ArrayDeque.html) · Oracle Java SE 21 · resizable array, no nulls, likely faster than `Stack` as a stack and `LinkedList` as a queue; most operations amortised constant (*read*) · covers our angle: **partial** — Java only · fetched 2026-10-14
- **Also good:** [Deque](https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/util/Deque.html) · Oracle Java SE 21 · `push` and `pop` work at the head, `add` at the tail; says to use it in preference to the legacy `Stack` (*read*) · fetched 2026-10-14
- **Also good:** [Double-ended queue](https://en.wikipedia.org/wiki/Double-ended_queue) · Wikipedia · linked-list and dynamic-array implementations; notes JavaScript arrays support both ends natively (*read*) · fetched 2026-10-14
- **Our delta:** a five-minute TypeScript deque beside Java's; the Java `ArrayDeque` is covered in `docs/dsa/pages/phase-0-the-interview-and-practice/12-javas-collections-for-interviews.md` but the TypeScript one is not.

### T06-09 · Stack-based simulation — Understand · 🔲 not written
- **Read this:** [Asteroid Collision](https://neetcode.io/solutions/asteroid-collision) · NeetCode · collisions only when a right-mover meets a left-mover, resolved against the stack top; a stack version and an in-place version without a stack, with Java and JavaScript code (*read*) · covers our angle: **partial** — no editor-buffer case · fetched 2026-10-15
- **Also good:** [1047. Remove All Adjacent Duplicates In String](https://walkccc.me/LeetCode/problems/1047/) · walkccc · code-only: the push-or-cancel stack in a few lines (*read*) · fetched 2026-10-15
- **Our delta:** the syllabus row promises asteroid collisions, removing adjacent duplicates and an editor buffer as worked cases; no source here covers the editor buffer (two stacks around a cursor).

### T06-10 · Recursion as an explicit stack — Understand · ✅ written `docs/dsa/pages/phase-2-recursion-maths-bits/01f-converting-recursion-to-an-explicit-stack.md`
- **Read this:** [Iterative Binary Tree Traversal Using Stack](https://www.enjoyalgorithms.com/blog/iterative-binary-tree-traversals-using-stack/) · EnjoyAlgorithms · starts from the call stack that recursion uses, then pre-, in- and post-order with an explicit stack; calls post-order the tricky one (*read*) · covers our angle: **full** on the traversals; its "tail-recursive" label for inorder is loose, so take the mechanics, not the label · fetched 2026-10-15
- **Also good:** [Inorder Tree Traversal - Iterative and Recursive](https://www.techiedelight.com/inorder-tree-traversal-iterative-recursive) · Techie Delight · deferred nodes live in an explicit stack or implicitly in the call stack; inorder in C++, Java and Python (*read*) · fetched 2026-10-15
- **Our delta:** the mechanical conversion: the frame becomes an object you push, children go on in reverse; post-order work needs a resume point, which is `docs/dsa/pages/phase-2-recursion-maths-bits/01g-post-order-and-the-resume-point-frame.md`. Tree traversals themselves arrive in Part 4.

### T06-11 · Design problems on stacks and queues — Know · 🔲 not written
- **Read this:** [Design Browser History](https://neetcode.io/solutions/design-browser-history) · NeetCode · four designs compared: two stacks, a dynamic array, an optimal dynamic array and a doubly linked list with a current pointer (*read*) · covers our angle: **partial** — no undo stack and no queue with a maximum · fetched 2026-10-15
- **Also good:** [Minimum stack / Minimum queue](https://cp-algorithms.com/data_structures/stack_queue_modification.html) · cp-algorithms · the basis of a queue with a constant-time extreme (*read*) · fetched 2026-10-14
- **Our delta:** the syllabus row also promises an undo stack and a queue with a maximum; the second follows from the min-queue trick above.

---

## Phase 7 — Linked lists

### T07-01 · Singly and doubly linked lists — Master · 🔲 not written
- **Read this:** [Linked list](https://en.wikipedia.org/wiki/Linked_list) · Wikipedia · sentinel nodes simplify some list algorithms; doubly linked adds a previous link; against arrays, constant-time insertion at a known node but no constant-time random access and worse cache locality (*read*) · covers our angle: **full** on the concepts, **partial** on the LRU payoff · fetched 2026-10-14
- **Also good:** [Linked List Overview](https://www.hellointerview.com/learn/code/linked-list/overview) · Hello Interview · node shape, traversal and deletion, then fast and slow pointers, reversal, merging and a dummy-node section on when to use it; Python (*read*) · fetched 2026-10-15
- **Also good:** [LinkedList](https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/util/LinkedList.html) · Oracle Java SE 21 · doubly linked `List` and `Deque`; index operations traverse from whichever end is closer (*read*) · fetched 2026-10-14
- **Beyond the docs:** [Coding Interview: Linked List Patterns](https://www.techinterview.org/post/3233474169/coding-interview-linked-list-patterns-reverse-merge-cycle-detection-fast-slow-pointer-dummy-node-techniques/) · techinterview.org, 2026-04-20 · five recurring patterns: reversal, fast-slow, merging, dummy nodes, copy (*read*) · fetched 2026-10-14
- **Our delta:** where a list wins in practice, and where an array beats it, argued for interviews rather than as a catalogue.

### T07-02 · Reversal — Master · 🔲 not written
- **Read this:** [Reverse Linked List](https://neetcode.io/solutions/reverse-linked-list) · NeetCode · recursion and iteration side by side; the iterative form keeps three pointers so the rest of the list is not lost, with Java and JavaScript code (*read*) · covers our angle: **partial** — no reverse-between · fetched 2026-10-15
- **Also good:** [Reverse Nodes In K Group](https://neetcode.io/solutions/reverse-nodes-in-k-group) · NeetCode · recursive and iterative group reversal; the iterative form uses a dummy node and leaves a short last group as it is (*read*) · fetched 2026-10-15
- **Also good:** [92. Reverse Linked List II](https://walkccc.me/LeetCode/problems/92/) · walkccc · code-only: reversing positions left to right, recursive and iterative (*read*) · fetched 2026-10-15
- **Also good:** [Coding Interview: Linked List Patterns](https://www.techinterview.org/post/3233474169/coding-interview-linked-list-patterns-reverse-merge-cycle-detection-fast-slow-pointer-dummy-node-techniques/) · techinterview.org, 2026-04-20 · the three-pointer reversal and its off-by-one pitfalls (*read*) · fetched 2026-10-14
- **Our delta:** the drawn diagram before the code, and all four forms: iterative, recursive, k-groups and between two positions.

### T07-03 · Fast and slow on lists — Master · 🔲 not written
- **Read this:** [Cycle detection](https://en.wikipedia.org/wiki/Cycle_detection) · Wikipedia · two pointers at different speeds meet inside the cycle; reset one to the start and step both to reach the start mu; advance one to find the length lambda (*read*) · covers our angle: **partial** — no list-middle and no palindrome list · fetched 2026-10-14
- **Also good:** [Linked List Cycle](https://www.hellointerview.com/learn/code/linked-list/linked-list-cycle) · Hello Interview · a visited-node set in O(n) space, then fast and slow pointers in O(1) space; Python (*read*) · fetched 2026-10-15
- **Beyond the docs:** [Coding Interview: Linked List Patterns](https://www.techinterview.org/post/3233474169/coding-interview-linked-list-patterns-reverse-merge-cycle-detection-fast-slow-pointer-dummy-node-techniques/) · techinterview.org, 2026-04-20 · the fast-slow section covers the middle, Floyd's meeting point, the cycle start, and the palindrome check by reversing the second half (*read*) · fetched 2026-10-14
- **Our delta:** the syllabus row adds the middle and the palindrome list; happy numbers use the same idea in `docs/dsa/pages/phase-2-recursion-maths-bits/11i-happy-numbers-and-cycle-detection.md`.

### T07-04 · Merging — Master · 🔲 not written
- **Read this:** [Merge K Sorted Lists](https://neetcode.io/solutions/merge-k-sorted-lists) · NeetCode · merging one by one, a min-heap, and divide and conquer both recursive and iterative, with Java and JavaScript code (*read*) · covers our angle: **full** for k lists · fetched 2026-10-15
- **Also good:** [Linked List Overview](https://www.hellointerview.com/learn/code/linked-list/overview) · Hello Interview · its merging-two-lists section is the building block (*read*) · fetched 2026-10-15
- **Beyond the docs:** [Coding Interview: Linked List Patterns](https://www.techinterview.org/post/3233474169/coding-interview-linked-list-patterns-reverse-merge-cycle-detection-fast-slow-pointer-dummy-node-techniques/) · techinterview.org, 2026-04-20 · merging two sorted lists with a dummy head, and k sorted lists with a priority queue or by divide and conquer (*read*) · fetched 2026-10-14
- **Our delta:** k lists both ways in TypeScript and Java, both O(N log k), with the heap's comparator traps.

### T07-05 · One-pass tricks — Master · 🔲 not written
- **Read this:** [Remove Nth Node From End of List](https://neetcode.io/solutions/remove-nth-node-from-end-of-list) · NeetCode · two-pass, recursion, then two pointers kept a gap of n apart (*read*) · covers our angle: **partial** — the k-th from the end is the same gap, not shown on its own · fetched 2026-10-15
- **Our delta:** the gap pointer for the n-th from the end, and the k-th from the end as the same gap without the delete.

### T07-06 · The LRU cache — Master · 🔲 not written
- **Read this:** [Implementing LRU Cache like Building a Lego](https://labuladong.online/en/algo/data-structure/lru-cache/) · labuladong · derives why a hash map plus a doubly linked list gives constant time (why doubly linked, why the node keeps the key), then codes it in Java and other languages (*read*) · covers our angle: **partial** — no JavaScript `Map` shortcut · fetched 2026-10-15
- **Also good:** [LRU Cache](https://neetcode.io/solutions/lru-cache) · NeetCode · brute force, the doubly linked list and map, then a built-in ordered-map version (*read*) · fetched 2026-10-15
- **Also good:** [LinkedHashMap](https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/util/LinkedHashMap.html) · Oracle Java SE 21 · access-order mode via the three-argument constructor is "well-suited to building LRU caches"; `removeEldestEntry` is the eviction hook (*read*) · fetched 2026-10-14
- **Also good:** [Map](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map) · MDN · iteration follows first-insertion order; the page does not say `get` reorders, so the shortcut needs delete and set to refresh (*read*) · fetched 2026-10-14
- **Beyond the docs:** [LeetCode 146 LRU Cache](https://dev.to/zeyame/leetcode-146-lru-cache-57dl) · Zeyad Mohamed, DEV Community, 2025-07-04 · a hash map plus a doubly linked list with dummy head and tail, helper insert and remove, a capacity-2 trace (*read*) · fetched 2026-10-14
- **Our delta:** where the insertion-ordered `Map` shortcut stops being one; the JavaScript track covers the machine-coding side.

### T07-07 · Reorder, rotate and partition — Understand · 🔲 not written
- **Read this:** [Reorder List](https://neetcode.io/solutions/reorder-list) · NeetCode · find the middle with slow and fast pointers, reverse the second half, then merge the halves alternately (*read*) · covers our angle: **partial** — rotate and partition are on the code-only pages below · fetched 2026-10-15
- **Also good:** [61. Rotate List](https://walkccc.me/LeetCode/problems/61/) · walkccc · code-only: close the list into a ring, then cut at the new tail (*read*) · fetched 2026-10-15
- **Also good:** [86. Partition List](https://walkccc.me/LeetCode/problems/86/) · walkccc · code-only: a before list and an after list, order kept, then joined (*read*) · fetched 2026-10-15
- **Our delta:** split, reverse and weave, and stable partition around a value.

### T07-08 · Copying a list with random pointers — Understand · 🔲 not written
- **Read this:** [Copy List With Random Pointer](https://neetcode.io/solutions/copy-list-with-random-pointer) · NeetCode · two hash-map versions, then two space-optimised versions that interleave each copy beside its original and set `random` from the original's `random.next` (*read*) · covers our angle: **full** · fetched 2026-10-15
- **Beyond the docs:** [Coding Interview: Linked List Patterns](https://www.techinterview.org/post/3233474169/coding-interview-linked-list-patterns-reverse-merge-cycle-detection-fast-slow-pointer-dummy-node-techniques/) · techinterview.org, 2026-04-20 · copy list with random pointer both ways: a hash map from old to new node, and interleaving copies for O(1) extra space (*read*) · fetched 2026-10-14
- **Our delta:** the interleaving trick set against a map.

### T07-09 · Arithmetic on lists — Understand · 🔲 not written
- **Read this:** [Add Two Numbers](https://neetcode.io/solutions/add-two-numbers) · NeetCode · digit by digit with a carry, recursive and iterative; the lists store digits in reverse (*read*) · covers our angle: **partial** — reversed-digit form only · fetched 2026-10-15
- **Also good:** [445. Add Two Numbers II](https://walkccc.me/LeetCode/problems/445/) · walkccc · code-only: the forward-digit form, with two stacks (*read*) · fetched 2026-10-15
- **Our delta:** adding with carries, digits stored forward and reversed.

### T07-10 · Intersection of two lists — Understand · 🔲 not written
- **Read this:** [Intersection of Two Linked Lists](https://neetcode.io/solutions/intersection-of-two-linked-lists) · NeetCode · brute force, a hash set, and two two-pointer versions: aligning lengths, and the pointer that jumps to the other list's head at the end (*read*) · covers our angle: **full** · fetched 2026-10-15
- **Our delta:** aligning lengths and the two-pointer switch.

### T07-11 · Lists in Java and TypeScript — Understand · 🔲 not written
- **Read this:** [LinkedList](https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/util/LinkedList.html) · Oracle Java SE 21 · permits nulls, not synchronized, fail-fast iterators as a best-effort bug detector (*read*) · covers our angle: **partial** — nothing on TypeScript or handing you the node class · fetched 2026-10-14
- **Also good:** [Linked list](https://en.wikipedia.org/wiki/Linked_list) · Wikipedia · against arrays, constant-time insertion at a known node but no constant-time random access and worse cache locality (*read*) · fetched 2026-10-14
- **Our delta:** the built-in list against your own nodes, references and garbage, and why the interviewer supplies the node class.

### T07-12 · Flattening and other structural changes — Know · 🔲 not written
- **Read this:** [430. Flatten a Multilevel Doubly Linked List](https://algo.monster/liteproblems/430) · AlgoMonster · a recursive preorder that returns the tail of each flattened segment, then why the call stack grows with every node and how an iterative version with an explicit stack for pending next pointers cuts that to the nesting depth (*read*) · covers our angle: **full** · fetched 2026-10-15
- **Also good:** [Linked list](https://en.wikipedia.org/wiki/Linked_list) · Wikipedia · multiply linked lists, where each node has two or more link fields; nothing on flattening (*read*) · fetched 2026-10-14
- **Our delta:** multilevel lists, recursion against an explicit stack.

### T07-13 · Skip lists — Know · 🔲 not written
- **Read this:** [Skip list](https://en.wikipedia.org/wiki/Skip_list) · Wikipedia · each element is promoted a level with probability p; expected search is O(log n); used in Redis ordered sets, RocksDB's memtable and Java's `ConcurrentSkipListMap` (*read*) · covers our angle: **full** for a concept-only row · fetched 2026-10-14
- **Beyond the docs:** [Skip Lists: A Probabilistic Alternative to Balanced Trees](https://15721.courses.cs.cmu.edu/spring2018/papers/08-oltpindexes1/pugh-skiplists-cacm1990.pdf) · William Pugh, CACM 1990 · the original paper: why random levels, with search, insert and delete in pseudocode (*read*) · fetched 2026-10-15
- **Our delta:** concept only, one line on why it appears in ordered sets.

---

## Phase 8 — Binary search

### T08-01 · The template — Master · ✅ written `docs/dsa/pages/phase-2-recursion-maths-bits/02i-binary-search-as-degenerate-divide-and-conquer.md`
- **Read this:** [Binary Search](https://cp-algorithms.com/num_methods/binary_search.html) · cp-algorithms · lower bound is the first element at least k and upper bound the first greater than k, both from one loop with bounds l = -1 and r = n; states the invariant `A[l] <= k < A[r]`, and warns that `(l + r) / 2` can overflow, offering `l + (r - l) / 2` and C++20 `std::midpoint` (*read*) · covers our angle: **full** on the invariant and the midpoint; nothing in TypeScript or Java · fetched 2026-10-14
- **Also good:** [Extra, Extra - Read All About It: Nearly All Binary Searches and Mergesorts are Broken](https://research.google/blog/extra-extra-read-all-about-it-nearly-all-binary-searches-and-mergesorts-are-broken/) · Joshua Bloch, Google Research, 2006-06-02 · `(low + high) / 2` overflows; fix with `low + ((high - low) / 2)` or `(low + high) >>> 1` (*read*) · fetched 2026-10-14
- **Our delta:** the invariant written as a comment above the loop, and the one hidden-test off-by-one.

### T08-02 · On a sorted array — Master · 🔲 not written
- **Read this:** [Binary Search Algorithm Code Template](https://labuladong.online/en/algo/essential-technique/binary-search-framework/) · labuladong · find a target, then the left and right boundary, with why the loop uses `<=` and why each bound moves by one; a missing target leaves the left bound at the next larger element; Java and JavaScript code (*read*) · covers our angle: **partial** — closest element is not a section · fetched 2026-10-15
- **Also good:** [Binary Search](https://cp-algorithms.com/num_methods/binary_search.html) · cp-algorithms · lower and upper bound as the insert position (*read*) · fetched 2026-10-14
- **Also good:** [Binary search](https://en.wikipedia.org/wiki/Binary_search) · Wikipedia · the plain procedure may return any index equal to the target; separate leftmost and rightmost procedures exist, and rank, predecessor, successor and nearest neighbour build on it (*read*) · fetched 2026-10-14
- **Our delta:** first and last occurrence, insert position and the closest element (lower bound plus a neighbour comparison) written from one invariant.

### T08-03 · Rotated sorted arrays — Master · 🔲 not written
- **Read this:** [Search in Rotated Sorted Array: binary search](https://johnkavanagh.co.uk/articles/search-in-rotated-sorted-array-binary-search/) · John Kavanagh, 2026-01-26 · find the half that is still sorted and test whether the target lies in it, with no pivot search; TypeScript solution; distinct values assumed, and duplicates are flagged as needing extra handling without giving it (*read*) · covers our angle: **partial** — duplicates not solved, no minimum · fetched 2026-10-14
- **Also good:** [Find Minimum In Rotated Sorted Array](https://neetcode.io/solutions/find-minimum-in-rotated-sorted-array) · NeetCode · brute force, binary search, and a lower-bound form, with Java and JavaScript code (*read*) · fetched 2026-10-15
- **Also good:** [81. Search in Rotated Sorted Array II](https://walkccc.me/LeetCode/problems/81/) · walkccc · code-only: the duplicates version, which steps both ends inward when the left, middle and right values tie (*read*) · fetched 2026-10-15
- **Beyond the docs:** [Advanced Binary Search Interview Patterns](https://www.techinterview.org/post/3233466118/binary-search-advanced-patterns/) · techinterview.org, 2026-04-17 · identify the sorted half and narrow accordingly (*read*) · fetched 2026-10-14
- **Our delta:** the duplicates case, where equal ends make the sorted half undecidable and the worst case turns linear, plus the rotated minimum, both as code; our 02i page already states both in one table row and one interview answer.

### T08-04 · Search on the answer — Master · ✅ written `docs/dsa/pages/phase-2-recursion-maths-bits/02i-binary-search-as-degenerate-divide-and-conquer.md`
- **Read this:** [Binary Search](https://cp-algorithms.com/num_methods/binary_search.html) · cp-algorithms · a monotone predicate over a range finds its transition point with the same loop; worked on the maximum floored average over subarrays of a minimum length, checked with prefix sums (*read*) · covers our angle: **partial** — no shipping, eating-speed or pair-distance cases · fetched 2026-10-14
- **Also good:** [Koko Eating Bananas](https://neetcode.io/solutions/koko-eating-bananas) · NeetCode · brute force, then binary search over the speed, with Java and JavaScript code (*read*) · fetched 2026-10-15
- **Also good:** [719. Find K-th Smallest Pair Distance](https://walkccc.me/LeetCode/problems/719/) · walkccc · code-only: search over the distance d, counting pairs at most d with two pointers (*read*) · fetched 2026-10-15
- **Also good:** [410. Split Array Largest Sum](https://walkccc.me/LeetCode/problems/410/) · walkccc · code-only: top-down and bottom-up DP first, then the binary search on the maximum sum as approach 3 (*read*) · fetched 2026-10-15
- **Beyond the docs:** [Binary Search on Answer: the pattern that unlocks hard problems](https://dev.to/alex_hunter_44f4c9ed6671e/binary-search-on-answer-the-pattern-that-unlocks-hard-problems-iil) · Alex Hunter, DEV Community, 2025-12-14 · define the range, write a `can(x)` check, search for the smallest valid value; pitfalls are bad bounds and a non-monotonic predicate; TypeScript for minimum eating speed; names shipping capacity and splitting an array, not the k-th pair distance (*read*) · fetched 2026-10-14
- **Beyond the docs:** [Binary Search](https://www.topcoder.com/thrive/articles/Binary%20Search) · TopCoder Thrive, 2018-10-31 · the search on a predicate, a "main theorem" giving when binary search applies (the predicate must stay true for every larger value), and a worked filing-cabinets problem of the same shape as split-array largest sum; C++ (*read*) · fetched 2026-10-15
- **Our delta:** the predicate-in-place-of-comparison reading, and the k-th smallest pair distance as the hard case.

### T08-05 · Recognising binary search — Master · 🔲 not written
- **Read this:** [Advanced Binary Search Interview Patterns](https://www.techinterview.org/post/3233466118/binary-search-advanced-patterns/) · techinterview.org, 2026-04-17 · binary search works on any condition that flips from false to true exactly once, not only on sorted arrays; its example is worded "the minimum speed such that you can eat all bananas" (*read*) · covers our angle: **partial** — the phrasing is present but not taught as a recognition cue · fetched 2026-10-14
- **Also good:** [Binary Search (Silver)](https://usaco.guide/silver/binary-search) · USACO Guide · binary search on a monotone function, with the first-true and last-true forms for "the minimum x such that f(x) is true", and off-by-one, negative bounds and overflow as named mistakes; Python (*read*) · fetched 2026-10-15
- **Our delta:** the phrasing signals, sorted input or a monotone answer, as a recognition checklist. Our page 02i touches the monotone-predicate idea only.

### T08-06 · In TypeScript and Java — Master · 🔲 not written
- **Read this:** [Collections](https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/util/Collections.html) · Oracle Java SE 21 · `binarySearch` returns the index if found, otherwise `-(insertion point) - 1`, so the result is non-negative if and only if the key is found (*read*) · covers our angle: **partial** — Java only; JavaScript has no built-in · fetched 2026-10-14
- **Also good:** [Arrays](https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/util/Arrays.html) · Oracle Java SE 21 · the array overloads return `-(insertion point) - 1` when absent, results are undefined on an unsorted array, and with duplicates there is no guarantee which index is found (*read*) · fetched 2026-10-14
- **Our delta:** why to write your own every time, and the negative-return trap; our 02i page already notes the Java midpoint.

### T08-07 · On a two-dimensional matrix — Understand · 🔲 not written
- **Read this:** [Search a 2D Matrix](https://neetcode.io/solutions/search-a-2d-matrix) · NeetCode · brute force, the staircase search, then binary search over the flattened matrix in one pass (index 0 to rows times columns minus 1), with Java and JavaScript code (*read*) · covers our angle: **partial** — no k-th smallest · fetched 2026-10-15
- **Also good:** [378. Kth Smallest Element in a Sorted Matrix](https://algo.monster/liteproblems/378) · AlgoMonster · binary search over the value range, with a bottom-left staircase walk as the counting step (*read*) · fetched 2026-10-15
- **Also good:** [Advanced Binary Search Interview Patterns](https://www.techinterview.org/post/3233466118/binary-search-advanced-patterns/) · techinterview.org, 2026-04-17 · start at the top-right corner and move left or down, O(m+n) (*read*) · fetched 2026-10-14
- **Our delta:** row-major flattening and the k-th smallest in a sorted matrix; the staircase is already one row of the table in our 02i page.

### T08-08 · Median of two sorted arrays — Understand · 🔲 not written
- **Read this:** [Median of Two Sorted Arrays](https://neetcode.io/solutions/median-of-two-sorted-arrays) · NeetCode · brute force and two pointers first, then the partition: cut both arrays so the left side holds half the elements and every left value is at most every right value, binary searching only the smaller array; Java and JavaScript code (*read*) · covers our angle: **full** · fetched 2026-10-15
- **Also good:** [Advanced Binary Search Interview Patterns](https://www.techinterview.org/post/3233466118/binary-search-advanced-patterns/) · techinterview.org, 2026-04-17 · the median section is prose only, with no code: a binary search on the partition of the smaller array, O(log(min(m, n))) (*read*) · fetched 2026-10-14
- **Our delta:** the partition search on the smaller array, with the boundary-value checks spelled out.

### T08-09 · Unknown or unbounded length — Understand · 🔲 not written
- **Read this:** [Exponential search](https://en.wikipedia.org/wiki/Exponential_search) · Wikipedia, last edited 2026-08-08 · Bentley and Yao, 1976: find a range holding the key, then binary search it; O(log i) with i the key's position (*read*) · covers our angle: **full** · fetched 2026-10-14
- **Also good:** [Binary Search](https://cp-algorithms.com/num_methods/binary_search.html) · cp-algorithms · its "search with powers of 2" section keeps a pointer and a power instead of a segment, the same doubling idea as a bit-by-bit descent (*read*) · fetched 2026-10-15
- **Our delta:** exponential probing then binary search, tied to the template's invariant.

### T08-10 · Floating-point binary search — Know · 🔲 not written
- **Read this:** [Binary Search](https://cp-algorithms.com/num_methods/binary_search.html) · cp-algorithms · the continuous search approximates a root within a tolerance in O(log((R-L)/delta)), justified by the intermediate value theorem rather than monotonicity (*read*) · covers our angle: **partial** — no square-root or geometry examples · fetched 2026-10-14
- **Beyond the docs:** [Binary Search](https://www.topcoder.com/thrive/articles/Binary%20Search) · TopCoder Thrive, 2018-10-31 · its real-numbers section: no bound-moving traps on reals, then a fixed iteration count (a few hundred, 100 gives about 10^-30 of the range) or a relative rather than absolute tolerance because doubles hold about 15 digits (*read*) · fetched 2026-10-15
- **Our delta:** precision-bounded loops, square roots and geometric answers; our 02i page has the fixed-iteration fix as a gotcha.

### T08-11 · Ternary search and unimodal functions — Know · 🔲 not written
- **Read this:** [Ternary Search](https://cp-algorithms.com/num_methods/ternary_search.html) · cp-algorithms · the algorithm and its run-time analysis, the case of integer arguments, and golden-section search (*read*) · covers our angle: **full** for a concept-only row · fetched 2026-10-15
- **Also good:** [Ternary search](https://en.wikipedia.org/wiki/Ternary_search) · Wikipedia · for a unimodal function, evaluate at the one-third and two-thirds points and drop the outer third that cannot hold the maximum; carries a single-source notice (*read*) · fetched 2026-10-14
- **Also good:** [Interpolation search](https://en.wikipedia.org/wiki/Interpolation_search) · Wikipedia · a sibling idea, about log(log n) comparisons on average when the keys are uniformly distributed (*read*) · fetched 2026-10-14
- **Our delta:** the concept and its rare uses.

### T08-12 · The same idea in trees and databases — Know · 🔲 not written
- **Read this:** [The Balanced Search Tree (B-Tree) in SQL Databases](https://use-the-index-luke.com/sql/anatomy/the-tree) · Use The Index, Luke · why an index needs a balanced search tree over its shuffled leaf pages, and how a lookup runs from the root to a leaf at the same depth everywhere (*read*) · covers our angle: **partial** — no binary search tree preview and no mention of binary search inside a node · fetched 2026-10-15
- **Also good:** [Binary search tree](https://en.wikipedia.org/wiki/Binary_search_tree) · Wikipedia, last edited 2026-06-01 · each comparison rules out about half the remaining nodes; search time follows tree height, which can degrade to linear (*read*) · fetched 2026-10-14
- **Also good:** [B-tree](https://en.wikipedia.org/wiki/B-tree) · Wikipedia · binary search is "typically (but not necessarily)" used inside a node; called "the standard index implementation in almost all relational databases" (*read*) · fetched 2026-10-14
- **Also good:** [B-Tree Indexes](https://www.postgresql.org/docs/current/btree.html) · PostgreSQL docs · PostgreSQL's btree index: any data type with a well-defined sort order can be indexed (*read*) · fetched 2026-10-15
- **Our delta:** the link from the template to the BST (Part 4) and to the PostgreSQL B-tree lookup.