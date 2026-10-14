---
title: "Link map · DSA · Part 3 (phases 6-8), file 1"
sidebar_label: "03 · linear structures, binary search (1)"
sidebar_position: 3
---

# Link map · DSA · Part 3 · file 1

Covers rows T06-01 to T06-11 (phase 6, stacks, queues, monotonic structures) and T07-01 (phase 7, first row).
*read* = I read the passage; *headings only* = fetched at 200 and headings checked.

### T06-01 · The stack for matching and parsing — Master · 🔲 not written
- **Read this:** [Stack Overview](https://www.hellointerview.com/learn/code/stack/overview) · Hello Interview · nested sequences and valid parentheses worked from the push/pop rule up, in interview framing · covers our angle: **partial** - valid parentheses only; no path simplification, postfix evaluation or decoding (they appear only as a practice link to Decode String) · fetched 2026-10-14 (*read*)
- **Also good:** [Decode String](https://neetcode.io/solutions/decode-string) · NeetCode · nested decoding as recursion, then a one-stack and a two-stack (counts and strings) version · fetched 2026-10-14
- **Also good:** [Reverse Polish notation](https://en.wikipedia.org/wiki/Reverse_Polish_notation) · Wikipedia · postfix notation and its evaluation with an operand stack · fetched 2026-10-14
- **Beyond the docs:** [Stacks and Queues (Algorithms, 4th ed.)](https://algs4.cs.princeton.edu/13stacks/) · Princeton, Sedgewick and Wayne · Dijkstra's two-stack expression evaluator as a parsing example · fetched 2026-10-14 (*read*)
- **Our delta:** add path simplification (Unix path) and the postfix evaluator as worked rows.

### T06-02 · The monotonic stack — Master · 🔲 not written
- **Read this:** [Monotonic Stack Template: Next Greater Element and More](https://labuladong.online/en/algo/data-structure/monotonic-stack/) · labuladong · one template, its variants, and the circular-array trick, with next greater and daily temperatures · covers our angle: **partial** - stock span is not covered; the each-element-once argument is implied (blocked elements are popped) rather than stated · fetched 2026-10-14 (*read*)
- **Also good:** [Daily Temperatures](https://www.hellointerview.com/learn/code/stack/daily-temperatures) · Hello Interview · index-stack version with explanation then solution · fetched 2026-10-14
- **Our delta:** state the pop-while invariant and the each-element-once amortised argument explicitly; add stock span.

### T06-03 · Largest rectangle in a histogram — Master · 🔲 not written
- **Read this:** [Largest Rectangle in Histogram](https://www.hellointerview.com/learn/code/stack/largest-rectangle-in-histogram) · Hello Interview · explanation then solution of the increasing-height stack · covers our angle: **partial** - states each index is pushed and popped at most once, but no maximal rectangle in a matrix and no sentinel · fetched 2026-10-14 (*read*)
- **Also good:** [85. Maximal Rectangle](https://walkccc.me/LeetCode/problems/85/) · walkccc · code-only: the matrix problem reduced to per-row histograms · fetched 2026-10-14
- **Also good:** [Largest Rectangle In Histogram](https://neetcode.io/solutions/largest-rectangle-in-histogram) · NeetCode · brute force, segment tree, then three stack versions · fetched 2026-10-14
- **Our delta:** draw the width-from-neighbours argument and the sentinel; link the matrix reduction.

### T06-04 · Min-stack and the auxiliary structure — Master · 🔲 not written
- **Read this:** [Minimum Stack / Minimum Queue](https://cp-algorithms.com/data_structures/stack_queue_modification.html) · cp-algorithms · the pair-per-entry stack, with its minimum-queue variants · covers our angle: **partial** - the pair form only; the second-stack and single-stack forms are on the NeetCode page below · fetched 2026-10-14 (*read*)
- **Also good:** [Min Stack](https://neetcode.io/solutions/min-stack) · NeetCode · brute force, a second min-stack, then one stack storing the difference from the minimum · fetched 2026-10-14

### T06-05 · The monotonic deque — Master · 🔲 not written
- **Read this:** [Monotonic Queue to Solve Sliding Window Problems](https://labuladong.online/en/algo/data-structure/monotonic-queue/) · labuladong · builds the framework, then the deque class, for sliding-window maximum · covers our angle: **partial** - no shortest subarray with sum at least k · fetched 2026-10-14 (*read*)
- **Also good:** [862. Shortest Subarray with Sum at Least K](https://walkccc.me/LeetCode/problems/862/) · walkccc · code-only: prefix sums plus a deque of indices, which handles negatives · fetched 2026-10-14
- **Also good:** [Sliding Window Maximum](https://neetcode.io/solutions/sliding-window-maximum) · NeetCode · brute force, heap, then the deque · fetched 2026-10-14
- **Our delta:** add the prefix-sum deque (negatives break the plain window) next to sliding-window maximum.

### T06-06 · Circular buffers and array-backed queues — Master · 🔲 not written
- **Read this:** [Circular buffer](https://en.wikipedia.org/wiki/Circular_buffer) · Wikipedia · start and end indices, and the two ways to tell full from empty · covers our angle: **partial** - nothing on why JavaScript's `shift` is the wrong queue · fetched 2026-10-14 (*read*)
- **Also good:** [Array.prototype.shift()](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/shift) · MDN · says shift moves every remaining value left by one; it states no complexity, so the linear cost is an inference to measure · fetched 2026-10-14
- **Our delta:** a 20-line TypeScript bounded queue and a measured shift-based queue against it.

### T06-07 · A queue from two stacks, a stack from queues — Understand · 🔲 not written
- **Read this:** [Minimum Stack / Minimum Queue](https://cp-algorithms.com/data_structures/stack_queue_modification.html) · cp-algorithms · the in-stack and out-stack queue, built carefully enough to carry a minimum, with a one-line each-element-moves-once cost note · covers our angle: **partial** - no stack from queues, no amortised proof in its own words · fetched 2026-10-14 (*read*)
- **Our delta:** the potential-style argument (each element moves at most once) and the stack-from-one-queue rotation; see the amortised page in phase 1 for the accounting.

### T06-08 · Deques in TypeScript and Java — Understand · 🔲 not written
- **Read this:** [ArrayDeque (Java SE 21)](https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/util/ArrayDeque.html) · Oracle · no capacity limit, nulls prohibited, amortised constant time for most operations · covers our angle: **partial** - Java side only · fetched 2026-10-14 (*read*)
- **Also good:** [Deque (Java SE 21)](https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/util/Deque.html) · Oracle · the first/last method table and the stack-versus-queue methods · fetched 2026-10-14
- **Also good:** [Double-ended queue](https://en.wikipedia.org/wiki/Double-ended_queue) · Wikipedia · array-backed versus linked implementations · fetched 2026-10-14
- **Our delta:** the TypeScript ring-buffer deque written from scratch; nothing good found for a short TS-first walkthrough.

### T06-09 · Stack-based simulation — Understand · 🔲 not written
- **Read this:** [Asteroid Collision](https://neetcode.io/solutions/asteroid-collision) · NeetCode · collision only when a right-mover meets a left-mover, resolved against the stack top · covers our angle: **partial** - stack and in-place-array versions; no editor-buffer example · fetched 2026-10-14 (*read*)
- **Also good:** [1047. Remove All Adjacent Duplicates In String](https://walkccc.me/LeetCode/problems/1047/) · walkccc · code-only: the push-or-cancel stack in a few lines · fetched 2026-10-14
- **Our delta:** an editor buffer (two stacks around a cursor) as the third example.

### T06-10 · Recursion as an explicit stack — Understand · ✅ written `docs/dsa/pages/phase-1-complexity/04b-tail-calls-and-the-explicit-stack.md`
- **Read this:** [Iterative Binary Tree Traversal Using Stack](https://www.enjoyalgorithms.com/blog/iterative-binary-tree-traversals-using-stack/) · EnjoyAlgorithms · starts from the shape of recursive traversal, then pre-, in- and post-order with a stack · covers our angle: full · fetched 2026-10-14 (*read*)
- **Also good:** [Inorder Tree Traversal - Iterative and Recursive](https://www.techiedelight.com/inorder-tree-traversal-iterative-recursive) · Techie Delight · compact side-by-side of both forms · fetched 2026-10-14

### T06-11 · Design problems on stacks and queues — Know · 🔲 not written
- **Read this:** [Design Browser History](https://neetcode.io/solutions/design-browser-history) · NeetCode · four designs compared: two stacks, dynamic array, doubly linked list · covers our angle: **partial** - no undo stack, no queue with a maximum · fetched 2026-10-14 (*read*)
- **Also good:** [Minimum Stack / Minimum Queue](https://cp-algorithms.com/data_structures/stack_queue_modification.html) · cp-algorithms · the same trick gives a queue with constant-time minimum or maximum · fetched 2026-10-14
- **Our delta:** an undo stack with redo; the queue-with-maximum as a short exercise.

### T07-01 · Singly and doubly linked lists — Master · 🔲 not written
- **Read this:** [Linked List Overview](https://www.hellointerview.com/learn/code/linked-list/overview) · Hello Interview · node shape, traversal, deletion, then the dummy-node section and when to use it · covers our angle: **partial** - little on array-versus-list trade-offs and the LRU use · fetched 2026-10-14 (*read*)
- **Also good:** [Linked list](https://en.wikipedia.org/wiki/Linked_list) · Wikipedia · singly, doubly, sentinel nodes, and the array comparison · fetched 2026-10-14
- **Our delta:** the cache-locality case for arrays; point to T07-06 for where lists win.
