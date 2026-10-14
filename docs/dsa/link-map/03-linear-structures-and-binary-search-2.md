---
title: "Link map · DSA · Part 3 (phases 6-8), file 2"
sidebar_label: "03 · linear structures, binary search (2)"
sidebar_position: 3
---

# Link map · DSA · Part 3 · file 2

Covers rows T07-02 to T07-13 (phase 7, linked lists).
*read* = I read the passage; *headings only* = fetched at 200 and headings checked.

### T07-02 · Reversal — Master · 🔲 not written
- **Read this:** [Reverse Linked List](https://neetcode.io/solutions/reverse-linked-list) · NeetCode · recursion and iteration side by side for the pointer rewiring · covers our angle: **partial** - no reverse-between · fetched 2026-10-14 (*headings only*)
- **Also good:** [Reverse Nodes In K Group](https://neetcode.io/solutions/reverse-nodes-in-k-group) · NeetCode · recursive and iterative group reversal · fetched 2026-10-14
- **Also good:** [92. Reverse Linked List II](https://walkccc.me/LeetCode/problems/92/) · walkccc · reversing positions left to right with a dummy head · fetched 2026-10-14
- **Our delta:** the three-pointer diagram before the code.

### T07-03 · Fast and slow on lists — Master · 🔲 not written
- **Read this:** [Cycle detection](https://en.wikipedia.org/wiki/Cycle_detection) · Wikipedia · Floyd's tortoise and hare, with the first-repeat index and cycle length it recovers · covers our angle: **partial** - no middle-of-list or palindrome-list recipe · fetched 2026-10-14 (*headings only*)
- **Also good:** [Linked List Cycle](https://www.hellointerview.com/learn/code/linked-list/linked-list-cycle) · Hello Interview · the interview form of cycle detection · fetched 2026-10-14
- **Also good:** [142. Linked List Cycle II](https://walkccc.me/LeetCode/problems/142/) · walkccc · code-only: the reset-to-head step that finds the cycle start · fetched 2026-10-14
- **Our delta:** the middle pointer and the palindrome list (middle, reverse half, compare).

### T07-04 · Merging — Master · 🔲 not written
- **Read this:** [Merge K Sorted Lists](https://neetcode.io/solutions/merge-k-sorted-lists) · NeetCode · the heap and divide-and-conquer versions, recursive and iterative · covers our angle: full · fetched 2026-10-14 (*headings only*)
- **Also good:** [Linked List Overview](https://www.hellointerview.com/learn/code/linked-list/overview) · Hello Interview · its merging-two-lists section is the building block · fetched 2026-10-14

### T07-05 · One-pass tricks — Master · 🔲 not written
- **Read this:** [Remove Nth Node From End of List](https://neetcode.io/solutions/remove-nth-node-from-end-of-list) · NeetCode · two-pass, recursion, then the gap-pointer version · covers our angle: **partial** - k-th from the end is the same gap, not shown on its own · fetched 2026-10-14 (*headings only*)
- **Our delta:** one line saying the k-th from the end is the gap pointer without the delete.

### T07-06 · The LRU cache — Master · 🔲 not written
- **Read this:** [Implementing LRU Cache like Building a Lego](https://labuladong.online/en/algo/data-structure/lru-cache/) · labuladong · derives why a hash map plus a doubly linked list gives constant time, then codes it · covers our angle: **partial** - no JavaScript `Map` shortcut · fetched 2026-10-14 (*headings only*)
- **Also good:** [LRU Cache](https://neetcode.io/solutions/lru-cache) · NeetCode · brute force, then the doubly linked list and map · fetched 2026-10-14
- **Also good:** [Map](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map) · MDN · keys iterate in insertion order, which is what the delete-and-reset shortcut relies on · fetched 2026-10-14
- **Also good:** [LinkedHashMap (Java SE 21)](https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/util/LinkedHashMap.html) · Oracle · the Java built-in for the same job (access order) · fetched 2026-10-14
- **Our delta:** where the `Map` shortcut stops being an LRU (links to the JavaScript track).

### T07-07 · Reorder, rotate and partition — Understand · 🔲 not written
- **Read this:** [Reorder List](https://neetcode.io/solutions/reorder-list) · NeetCode · split at the middle, reverse the second half, weave · covers our angle: **partial** - rotate and partition are separate pages · fetched 2026-10-14 (*headings only*)
- **Also good:** [61. Rotate List](https://walkccc.me/LeetCode/problems/61/) · walkccc · code-only: close into a ring, cut at the new tail · fetched 2026-10-14
- **Also good:** [86. Partition List](https://walkccc.me/LeetCode/problems/86/) · walkccc · code-only: a before list and an after list, order kept · fetched 2026-10-14

### T07-08 · Copying a list with random pointers — Understand · 🔲 not written
- **Read this:** [Copy List With Random Pointer](https://neetcode.io/solutions/copy-list-with-random-pointer) · NeetCode · hash-map versions first, then two space-optimised interleaving versions · covers our angle: full · fetched 2026-10-14 (*headings only*)

### T07-09 · Arithmetic on lists — Understand · 🔲 not written
- **Read this:** [Add Two Numbers](https://neetcode.io/solutions/add-two-numbers) · NeetCode · digit-by-digit with carry, recursive and iterative · covers our angle: **partial** - reversed-digit form only · fetched 2026-10-14 (*headings only*)
- **Also good:** [445. Add Two Numbers II](https://walkccc.me/LeetCode/problems/445/) · walkccc · the forward-digit form · fetched 2026-10-14

### T07-10 · Intersection of two lists — Understand · 🔲 not written
- **Read this:** [Intersection of Two Linked Lists](https://neetcode.io/solutions/intersection-of-two-linked-lists) · NeetCode · brute force, hash set, and two two-pointer variants (length alignment and the switch) · covers our angle: full · fetched 2026-10-14 (*headings only*)

### T07-11 · Lists in Java and TypeScript — Understand · 🔲 not written
- **Read this:** [LinkedList (Java SE 21)](https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/util/LinkedList.html) · Oracle · the built-in doubly linked list, its deque role and index cost · covers our angle: **partial** - nothing on TypeScript node classes or why the interviewer hands you the node · fetched 2026-10-14 (*headings only*)
- **Also good:** [Linked list](https://en.wikipedia.org/wiki/Linked_list) · Wikipedia · array comparison and per-node overhead · fetched 2026-10-14
- **Our delta:** the `ListNode` class in TypeScript, references versus garbage, and when to reach for the built-in.

### T07-12 · Flattening and other structural changes — Know · 🔲 not written
- **Read this:** [430. Flatten a Multilevel Doubly Linked List](https://walkccc.me/LeetCode/problems/430/) · walkccc · recursive and iterative depth-first versions, code with complexity notes · covers our angle: **partial** - no explicit-stack comparison in prose · fetched 2026-10-14 (*headings only*)
- **Our delta:** one paragraph on recursion versus an explicit stack for deep nesting.

### T07-13 · Skip lists — Know · 🔲 not written
- **Read this:** [Skip list](https://en.wikipedia.org/wiki/Skip_list) · Wikipedia · levels, expected logarithmic search, and uses · covers our angle: full · fetched 2026-10-14 (*headings only*)
- **Beyond the docs:** [Skip Lists: A Probabilistic Alternative to Balanced Trees](https://15721.courses.cs.cmu.edu/spring2018/papers/08-oltpindexes1/pugh-skiplists-cacm1990.pdf) · William Pugh, CACM 1990 · the original short paper, with search, insert and delete in pseudocode · fetched 2026-10-14 (*read*)
