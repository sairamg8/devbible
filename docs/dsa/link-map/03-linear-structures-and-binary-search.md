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
- **Read this:** [Stack (abstract data type)](https://en.wikipedia.org/wiki/Stack_(abstract_data_type)) · Wikipedia · LIFO with push, pop and peek; names compilers' syntax parsing and reverse Polish evaluation as stack uses, but does not name balanced brackets (*read*) · covers our angle: **partial** — no bracket matching, path simplification or nested decoding · fetched 2026-10-14
- **Also good:** [Reverse Polish notation](https://en.wikipedia.org/wiki/Reverse_Polish_notation) · Wikipedia · push operands, on an operator pop two, apply, push the result (*read*) · fetched 2026-10-14
- **Also good:** [Shunting yard algorithm](https://en.wikipedia.org/wiki/Shunting_yard_algorithm) · Wikipedia · operators wait on a stack and are popped by precedence and associativity; carries a missing-citations notice (*read*) · fetched 2026-10-14
- **Beyond the docs:** [Bags, Queues, and Stacks](https://algs4.cs.princeton.edu/13stacks/) · Sedgewick and Wayne, Princeton, last modified 2020-02-13 · Dijkstra's two-stack expression evaluation, worked as code (*read*) · fetched 2026-10-14
- **Our delta:** the syllabus row promises four shapes at once: balanced brackets, path simplification, postfix and nested-string decoding.

### T06-02 · The monotonic stack — Master · 🔲 not written
- **Read this:** [All nearest smaller values](https://en.wikipedia.org/wiki/All_nearest_smaller_values) · Wikipedia · the stack method has a nested loop yet is linear, because each inner pop discards an item pushed earlier (*read*) · covers our angle: **partial** — the linear argument is there, with no next-greater or stock-span framing · fetched 2026-10-14
- **Beyond the docs:** [Monotonic Stack Interview Patterns: Next Greater Element, Largest Rectangle, and Stock Span](https://techinterview.org/stack-monotonic-interview-patterns/) · techinterview.org, 2026-04-17 · "each element is pushed and popped at most once", walked through next greater and daily temperatures; the page does not mention stock span (*read*) · fetched 2026-10-14
- **Our delta:** the syllabus row's "pop while" invariant stated once and tied to the push-once, pop-once bound; our amortised page `docs/dsa/pages/phase-1-complexity/03-amortised-analysis.md` only lists it as a case of the 2n bound.

### T06-03 · Largest rectangle in a histogram — Master · 🔲 not written
- **Read this:** [Cartesian tree](https://en.wikipedia.org/wiki/Cartesian_tree) · Wikipedia · stack-based construction maintains a stack holding a subsequence of the input; the histogram problem is not mentioned (*read*) · covers our angle: **partial** — the machinery only; no rectangles and no matrix extension · fetched 2026-10-14
- **Beyond the docs:** [Monotonic Stack Interview Patterns](https://techinterview.org/stack-monotonic-interview-patterns/) · techinterview.org, 2026-04-17 · largest rectangle (LC 84) with an increasing stack and a zero appended to flush it (*read*) · fetched 2026-10-14
- **Our delta:** the syllabus row promises the maximal rectangle in a matrix built on the histogram, which these sources do not give.

### T06-04 · Min-stack and the auxiliary structure — Master · 🔲 not written
- **Read this:** [Minimum stack / Minimum queue](https://cp-algorithms.com/data_structures/stack_queue_modification.html) · cp-algorithms · each stored element carries the minimum from the bottom up to itself, so the minimum reads off the top in constant time (*read*) · covers our angle: **full** for the pair form; the second-stack variant is not named · fetched 2026-10-14
- **Our delta:** the syllabus row promises both the pair and the second stack as options.

### T06-05 · The monotonic deque — Master · 🔲 not written
- **Read this:** [Minimum stack / Minimum queue](https://cp-algorithms.com/data_structures/stack_queue_modification.html) · cp-algorithms · a nondecreasing deque keeps the minimum at the front; applied to the minimum of every fixed-length window in linear time (*read*) · covers our angle: **partial** — minimum, not maximum, and no shortest-subarray-with-sum-at-least-k · fetched 2026-10-14
- **Also good:** [Monotonic Stack Interview Patterns](https://techinterview.org/stack-monotonic-interview-patterns/) · techinterview.org, 2026-04-17 · sliding window maximum with a monotonic deque (LC 239) (*read*) · fetched 2026-10-14
- **Our delta:** the syllabus row adds the prefix-sum variant, shortest subarray with a sum of at least k.

### T06-06 · Circular buffers and array-backed queues — Master · 🔲 not written
- **Read this:** [Circular buffer](https://en.wikipedia.org/wiki/Circular_buffer) · Wikipedia · a fixed-size buffer treated as end-to-end; start and end indexes alone cannot tell full from empty, so use Length minus 1 slots or a separate count (*read*) · covers our angle: **partial** — no TypeScript, and nothing on why `shift` is the wrong queue · fetched 2026-10-14
- **Also good:** [Array.prototype.shift()](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/shift) · MDN · shifts every remaining value left and decrements length; the page gives no complexity figure, so the cost is an inference (*read*) · fetched 2026-10-14
- **Our delta:** a bounded queue you write yourself in TypeScript, and the measured cost of `shift`; the `shift` cost is already tabulated in `docs/dsa/pages/phase-1-complexity/06-hidden-costs.md`.

### T06-07 · A queue from two stacks, a stack from queues — Understand · ✅ written `docs/dsa/pages/phase-1-complexity/03-amortised-analysis.md`
- **Read this:** [Amortized analysis](https://en.wikipedia.org/wiki/Amortized_analysis) · Wikipedia, last edited 2026-01-08 · the queue example uses an input and an output list and moves elements only when the output is empty, so dequeue is amortised O(1) (*read*) · covers our angle: **partial** — a stack built from queues is not covered · fetched 2026-10-14
- **Also good:** [Minimum stack / Minimum queue](https://cp-algorithms.com/data_structures/stack_queue_modification.html) · cp-algorithms · method 3 simulates a queue with two modified stacks (*read*) · fetched 2026-10-14
- **Our delta:** our page tabulates the two-stacks queue as Θ(1) amortised with the each-element-moved-once reason; the stack-from-queues half is the syllabus row's addition.

### T06-08 · Deques in TypeScript and Java — Understand · 🔲 not written
- **Read this:** [ArrayDeque](https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/util/ArrayDeque.html) · Oracle Java SE 21 · resizable array, no nulls, likely faster than `Stack` as a stack and `LinkedList` as a queue; most operations amortised constant (*read*) · covers our angle: **partial** — Java only · fetched 2026-10-14
- **Also good:** [Deque](https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/util/Deque.html) · Oracle Java SE 21 · `push` and `pop` work at the head, `add` at the tail; says to use it in preference to the legacy `Stack` (*read*) · fetched 2026-10-14
- **Also good:** [Double-ended queue](https://en.wikipedia.org/wiki/Double-ended_queue) · Wikipedia · linked-list and dynamic-array implementations; notes JavaScript arrays support both ends natively (*read*) · fetched 2026-10-14
- **Our delta:** a five-minute TypeScript deque beside Java's; the Java `ArrayDeque` is covered in `docs/dsa/pages/phase-0-the-interview-and-practice/12-javas-collections-for-interviews.md` but the TypeScript one is not.

### T06-09 · Stack-based simulation — Understand · 🔲 not written
- **Read this:** [Stack (abstract data type)](https://en.wikipedia.org/wiki/Stack_(abstract_data_type)) · Wikipedia · push, pop, peek and underflow on an empty pop (*read*) · covers our angle: **partial** — the structure only; no collisions, duplicate removal or editor buffer · fetched 2026-10-14
- **Our delta:** the syllabus row promises asteroid collisions, removing adjacent duplicates and an editor buffer as worked cases.

### T06-10 · Recursion as an explicit stack — Understand · ✅ written `docs/dsa/pages/phase-2-recursion-maths-bits/01f-converting-recursion-to-an-explicit-stack.md`
- **Read this:** [Stack (abstract data type)](https://en.wikipedia.org/wiki/Stack_(abstract_data_type)) · Wikipedia · a stack can record the last correct point so a search can return to it, which is how depth-first search works (*read*) · covers our angle: **partial** — no conversion recipe · fetched 2026-10-14
- **Our delta:** the mechanical conversion: the frame becomes an object you push, children go on in reverse, post-order work needs a resume point. Tree traversals themselves arrive in Part 4.

### T06-11 · Design problems on stacks and queues — Know · 🔲 not written
- **Read this:** [Queue (abstract data type)](https://en.wikipedia.org/wiki/Queue_(abstract_data_type)) · Wikipedia · array-as-circle with indices modulo size, and an amortised queue from two lists; carries a missing-citations notice (*read*) · covers our angle: **partial** — no browser history, undo or queue-with-maximum · fetched 2026-10-14
- **Also good:** [Minimum stack / Minimum queue](https://cp-algorithms.com/data_structures/stack_queue_modification.html) · cp-algorithms · the basis of a queue with a constant-time extreme (*read*) · fetched 2026-10-14
- **Our delta:** the syllabus row promises browser history, an undo stack and a queue with a maximum.

---

## Phase 7 — Linked lists

### T07-01 · Singly and doubly linked lists — Master · 🔲 not written
- **Read this:** [Linked list](https://en.wikipedia.org/wiki/Linked_list) · Wikipedia · sentinel nodes simplify some list algorithms; doubly linked adds a previous link; against arrays, constant-time insertion at a known node but no constant-time random access and worse cache locality (*read*) · covers our angle: **full** on the concepts, **partial** on the LRU payoff · fetched 2026-10-14
- **Also good:** [LinkedList](https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/util/LinkedList.html) · Oracle Java SE 21 · doubly linked `List` and `Deque`; index operations traverse from whichever end is closer (*read*) · fetched 2026-10-14
- **Beyond the docs:** [Coding Interview: Linked List Patterns](https://www.techinterview.org/post/3233474169/coding-interview-linked-list-patterns-reverse-merge-cycle-detection-fast-slow-pointer-dummy-node-techniques/) · techinterview.org, 2026-04-20 · five recurring patterns: reversal, fast-slow, merging, dummy nodes, copy (*read*) · fetched 2026-10-14
- **Our delta:** where a list wins in practice, and where an array beats it, argued for interviews rather than as a catalogue.

### T07-02 · Reversal — Master · 🔲 not written
- **Read this:** [Daily bit(e) of C++ — Reverse k-groups in a list](https://simontoth.substack.com/p/daily-bite-of-c-reverse-k-groups) · Šimon Tóth, 2023-04-30 · reverses each group of k by building a new list at the front, tracking the processed tail and the unprocessed head (*read*) · covers our angle: **partial** — groups of k only, in C++ · fetched 2026-10-14
- **Also good:** [Coding Interview: Linked List Patterns](https://www.techinterview.org/post/3233474169/coding-interview-linked-list-patterns-reverse-merge-cycle-detection-fast-slow-pointer-dummy-node-techniques/) · techinterview.org, 2026-04-20 · the three-pointer reversal and its off-by-one pitfalls (*read*) · fetched 2026-10-14
- **Our delta:** the drawn diagram before the code, and all four forms: iterative, recursive, k-groups and between two positions.

### T07-03 · Fast and slow on lists — Master · 🔲 not written
- **Read this:** [Cycle detection](https://en.wikipedia.org/wiki/Cycle_detection) · Wikipedia · two pointers at different speeds meet inside the cycle; reset one to the start and step both to reach the start mu; advance one to find the length lambda (*read*) · covers our angle: **partial** — no list-middle and no palindrome list · fetched 2026-10-14
- **Our delta:** the syllabus row adds the middle and the palindrome list; happy numbers use the same idea in `docs/dsa/pages/phase-2-recursion-maths-bits/11i-happy-numbers-and-cycle-detection.md`.

### T07-04 · Merging — Master · 🔲 not written
- **Read this:** [Coding Interview: Linked List Patterns](https://www.techinterview.org/post/3233474169/coding-interview-linked-list-patterns-reverse-merge-cycle-detection-fast-slow-pointer-dummy-node-techniques/) · techinterview.org, 2026-04-20 · merging sorted lists with a dummy head (*read*) · covers our angle: **partial** — k lists is not given a full treatment there · fetched 2026-10-14
- **Our delta:** k lists both ways: a heap and divide and conquer, both O(N log k).

### T07-05 · One-pass tricks — Master · 🔲 not written
- **Read this:** [Coding Interview: Linked List Patterns](https://www.techinterview.org/post/3233474169/coding-interview-linked-list-patterns-reverse-merge-cycle-detection-fast-slow-pointer-dummy-node-techniques/) · techinterview.org, 2026-04-20 · fast-slow and dummy-node techniques (*read*) · covers our angle: **partial** — no gap pointer · fetched 2026-10-14
- **Our delta:** the gap pointer for the n-th from the end, and the k-th from the end.

### T07-06 · The LRU cache — Master · 🔲 not written
- **Read this:** [LinkedHashMap](https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/util/LinkedHashMap.html) · Oracle Java SE 21 · access-order mode via the three-argument constructor is "well-suited to building LRU caches"; `removeEldestEntry` is the eviction hook (*read*) · covers our angle: **partial** — the shortcut, not the hand-built list · fetched 2026-10-14
- **Also good:** [Map](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map) · MDN · iteration follows first-insertion order; the page does not say `get` reorders, so the shortcut needs delete and set to refresh (*read*) · fetched 2026-10-14
- **Also good:** [Cache replacement policies](https://en.wikipedia.org/wiki/Cache_replacement_policies) · Wikipedia · LRU evicts the least recently used item (*read*) · fetched 2026-10-14
- **Beyond the docs:** [LeetCode 146 LRU Cache](https://dev.to/zeyame/leetcode-146-lru-cache-57dl) · Zeyad Mohamed, DEV Community, 2025-07-04 · a hash map plus a doubly linked list with dummy head and tail, helper insert and remove, a capacity-2 trace (*read*) · fetched 2026-10-14
- **Our delta:** where the insertion-ordered `Map` shortcut stops being one; the JavaScript track covers the machine-coding side.

### T07-07 · Reorder, rotate and partition — Understand · 🔲 not written
- **Read this:** [Coding Interview: Linked List Patterns](https://www.techinterview.org/post/3233474169/coding-interview-linked-list-patterns-reverse-merge-cycle-detection-fast-slow-pointer-dummy-node-techniques/) · techinterview.org, 2026-04-20 · reconstruction patterns built from the same primitives (*headings only*) · covers our angle: **partial** · fetched 2026-10-14
- **Our delta:** split, reverse and weave, and stable partition around a value.

### T07-08 · Copying a list with random pointers — Understand · 🔲 not written
- **Read this:** [Coding Interview: Linked List Patterns](https://www.techinterview.org/post/3233474169/coding-interview-linked-list-patterns-reverse-merge-cycle-detection-fast-slow-pointer-dummy-node-techniques/) · techinterview.org, 2026-04-20 · lists copy and reconstruct as one of five patterns (*headings only*) · covers our angle: **partial** · fetched 2026-10-14
- **Our delta:** the interleaving trick set against a map.

### T07-09 · Arithmetic on lists — Understand · 🔲 not written
- **Read this:** [Linked list](https://en.wikipedia.org/wiki/Linked_list) · Wikipedia · the structure the digits ride on (*headings only*) · covers our angle: **partial** — no carries · fetched 2026-10-14
- **Our delta:** adding with carries, digits stored forward and reversed.

### T07-10 · Intersection of two lists — Understand · 🔲 not written
- **Read this:** [Linked list](https://en.wikipedia.org/wiki/Linked_list) · Wikipedia · basic structure only (*headings only*) · covers our angle: **partial** — nothing on intersection · fetched 2026-10-14
- **Our delta:** aligning lengths and the two-pointer switch.

### T07-11 · Lists in Java and TypeScript — Understand · 🔲 not written
- **Read this:** [LinkedList](https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/util/LinkedList.html) · Oracle Java SE 21 · permits nulls, not synchronized, fail-fast iterators as a best-effort bug detector (*read*) · covers our angle: **partial** — nothing on TypeScript or handing you the node class · fetched 2026-10-14
- **Our delta:** the built-in list against your own nodes, references and garbage, and why the interviewer supplies the node class.

### T07-12 · Flattening and other structural changes — Know · 🔲 not written
- **Read this:** [Linked list](https://en.wikipedia.org/wiki/Linked_list) · Wikipedia · covers multiply linked lists as a concept (*headings only*) · covers our angle: **partial** · fetched 2026-10-14
- **Our delta:** multilevel lists, recursion against an explicit stack.

### T07-13 · Skip lists — Know · 🔲 not written
- **Read this:** [Skip list](https://en.wikipedia.org/wiki/Skip_list) · Wikipedia · each element is promoted a level with probability p; expected search is O(log n); used in Redis ordered sets, RocksDB's memtable and Java's `ConcurrentSkipListMap` (*read*) · covers our angle: **full** for a concept-only row · fetched 2026-10-14
- **Our delta:** concept only, one line on why it appears in ordered sets.

---

## Phase 8 — Binary search

### T08-01 · The template — Master · ✅ written `docs/dsa/pages/phase-2-recursion-maths-bits/02i-binary-search-as-degenerate-divide-and-conquer.md`
- **Read this:** [Binary Search](https://cp-algorithms.com/num_methods/binary_search.html) · cp-algorithms · lower bound is the first element at least k and upper bound the first greater than k, both from one loop with bounds l = -1 and r = n (*read*) · covers our angle: **partial** — no stated invariant, no overflow note · fetched 2026-10-14
- **Also good:** [Extra, Extra - Read All About It: Nearly All Binary Searches and Mergesorts are Broken](https://research.google/blog/extra-extra-read-all-about-it-nearly-all-binary-searches-and-mergesorts-are-broken/) · Joshua Bloch, Google Research, 2006-06-02 · `(low + high) / 2` overflows; fix with `low + ((high - low) / 2)` or `(low + high) >>> 1` (*read*) · fetched 2026-10-14
- **Our delta:** the invariant written as a comment above the loop, and the one hidden-test off-by-one.

### T08-02 · On a sorted array — Master · 🔲 not written
- **Read this:** [Binary search](https://en.wikipedia.org/wiki/Binary_search) · Wikipedia · the plain procedure may return any index equal to the target; separate leftmost and rightmost procedures exist, and rank, predecessor, successor and nearest neighbour build on it (*read*) · covers our angle: **full** on first and last occurrence · fetched 2026-10-14
- **Also good:** [Binary Search](https://cp-algorithms.com/num_methods/binary_search.html) · cp-algorithms · lower and upper bound as the insert position (*read*) · fetched 2026-10-14
- **Our delta:** first and last occurrence, insert position and closest element written from one invariant.

### T08-03 · Rotated sorted arrays — Master · 🔲 not written
- **Read this:** [Search in Rotated Sorted Array: binary search](https://johnkavanagh.co.uk/articles/search-in-rotated-sorted-array-binary-search) · John Kavanagh, 2026-01-26 · find the half that is still sorted and test whether the target lies in it, with no pivot search; TypeScript solution; distinct values assumed (*read*) · covers our angle: **partial** — no duplicates, no minimum · fetched 2026-10-14
- **Beyond the docs:** [Advanced Binary Search Interview Patterns](https://www.techinterview.org/post/3233461982/binary-search-advanced-interview-patterns/) · techinterview.org, 2026-04-17 · identify the sorted half and narrow accordingly (*read*) · fetched 2026-10-14
- **Our delta:** the duplicates case, where equal ends make the sorted half undecidable and the worst case turns linear, plus the rotated minimum.

### T08-04 · Search on the answer — Master · ✅ written `docs/dsa/pages/phase-2-recursion-maths-bits/02i-binary-search-as-degenerate-divide-and-conquer.md`
- **Read this:** [Binary Search](https://cp-algorithms.com/num_methods/binary_search.html) · cp-algorithms · a monotone predicate over a range finds its transition point with the same loop; worked on a maximum-average subarray problem (*read*) · covers our angle: **partial** — no shipping, eating-speed or pair-distance cases · fetched 2026-10-14
- **Beyond the docs:** [Binary Search on Answer: the pattern that unlocks hard problems](https://dev.to/alex_hunter_44f4c9ed6671e/binary-search-on-answer-the-pattern-that-unlocks-hard-problems-iil) · Alex Hunter, DEV Community, 2025-12-14 · define the range, write a `can(x)` check, search for the smallest valid value; pitfalls are bad bounds and a non-monotonic predicate; TypeScript for minimum eating speed (*read*) · fetched 2026-10-14
- **Our delta:** the predicate-in-place-of-comparison reading, and the k-th smallest pair distance as the hard case.

### T08-05 · Recognising binary search — Master · 🔲 not written
- **Read this:** [Advanced Binary Search Interview Patterns](https://www.techinterview.org/post/3233461982/binary-search-advanced-interview-patterns/) · techinterview.org, 2026-04-17 · binary search works on any condition that flips once, not only on sorted arrays (*read*) · covers our angle: **partial** — no "minimum x such that" phrasing cue · fetched 2026-10-14
- **Our delta:** the phrasing signals, sorted input or a monotone answer, as a recognition checklist. Our page 02i touches the monotone-predicate idea only.

### T08-06 · In TypeScript and Java — Master · 🔲 not written
- **Read this:** [Collections](https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/util/Collections.html) · Oracle Java SE 21 · `binarySearch` returns the index if found, otherwise `-(insertion point) - 1`, so the result is non-negative if and only if the key is found (*read*) · covers our angle: **partial** — Java only; JavaScript has no built-in · fetched 2026-10-14
- **Also good:** [Arrays](https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/util/Arrays.html) · Oracle Java SE 21 · the array overloads (page truncated before the `binarySearch` detail) (*headings only*) · fetched 2026-10-14
- **Our delta:** why to write your own every time, and the negative-return trap; our 02i page already notes the Java midpoint.

### T08-07 · On a two-dimensional matrix — Understand · 🔲 not written
- **Read this:** [Advanced Binary Search Interview Patterns](https://www.techinterview.org/post/3233461982/binary-search-advanced-interview-patterns/) · techinterview.org, 2026-04-17 · start at the top-right corner and move left or down, O(m+n) (*read*) · covers our angle: **partial** — no row-major flattening and no k-th smallest · fetched 2026-10-14
- **Our delta:** row-major flattening, the staircase, and the k-th smallest in a sorted matrix.

### T08-08 · Median of two sorted arrays — Understand · 🔲 not written
- **Read this:** [Advanced Binary Search Interview Patterns](https://www.techinterview.org/post/3233461982/binary-search-advanced-interview-patterns/) · techinterview.org, 2026-04-17 · lists the median of two sorted arrays among the techniques, with Python code (*headings only*) · covers our angle: **partial** · fetched 2026-10-14
- **Our delta:** the partition search on the smaller array, with the boundary-value checks spelled out.

### T08-09 · Unknown or unbounded length — Understand · 🔲 not written
- **Read this:** [Exponential search](https://en.wikipedia.org/wiki/Exponential_search) · Wikipedia, last edited 2026-08-08 · Bentley and Yao, 1976: find a range holding the key, then binary search it; O(log i) with i the key's position (*read*) · covers our angle: **full** · fetched 2026-10-14
- **Also good:** [Binary Search](https://cp-algorithms.com/num_methods/binary_search.html) · cp-algorithms · a "search with powers of 2" section (*headings only*) · fetched 2026-10-14
- **Our delta:** exponential probing then binary search, tied to the template's invariant.

### T08-10 · Floating-point binary search — Know · 🔲 not written
- **Read this:** [Binary Search](https://cp-algorithms.com/num_methods/binary_search.html) · cp-algorithms · the continuous search approximates a root within a tolerance in O(log((R-L)/delta)) (*read*) · covers our angle: **partial** — no square-root or geometry examples · fetched 2026-10-14
- **Our delta:** precision-bounded loops, square roots and geometric answers.

### T08-11 · Ternary search and unimodal functions — Know · 🔲 not written
- **Read this:** [Ternary search](https://en.wikipedia.org/wiki/Ternary_search) · Wikipedia · for a unimodal function, evaluate at the one-third and two-thirds points and drop the outer third that cannot hold the maximum; carries a single-source notice (*read*) · covers our angle: **full** for a concept-only row · fetched 2026-10-14
- **Also good:** [Interpolation search](https://en.wikipedia.org/wiki/Interpolation_search) · Wikipedia · a sibling idea, about O(log log n) on uniform data (*headings only*) · fetched 2026-10-14
- **Our delta:** the concept and its rare uses.

### T08-12 · The same idea in trees and databases — Know · 🔲 not written
- **Read this:** [Binary search tree](https://en.wikipedia.org/wiki/Binary_search_tree) · Wikipedia, last edited 2026-06-01 · each comparison rules out about half the remaining nodes; search time follows tree height, which can degrade to linear (*read*) · covers our angle: **partial** — nothing on databases · fetched 2026-10-14
- **Also good:** [B-tree](https://en.wikipedia.org/wiki/B-tree) · Wikipedia · descend one level at a time, binary search inside a node; the default relational index (*read*) · fetched 2026-10-14
- **Our delta:** the link from the template to the BST (Part 4) and to the PostgreSQL B-tree lookup.
