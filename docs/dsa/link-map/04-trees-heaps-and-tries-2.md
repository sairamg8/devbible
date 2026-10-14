---
title: "Link map · DSA · Part 4 (phases 9-11), file 2"
sidebar_label: "04 · trees, heaps, tries (2)"
sidebar_position: 4
---

# Link map · DSA · Part 4, file 2

Rows T10-01 to T10-11 (phase 10, heaps and priority queues).
*read* = a verifier read the passage that supports the claim on 2026-10-14 (NeetCode solution pages are server-rendered, so their text was read too); *headings only* = fetched at 200 and headings or keywords checked. No page of ours covers these phases yet.

### T10-01 · The binary heap — Master · 🔲 not written
- **Read this:** [Priority Queues](https://algs4.cs.princeton.edu/24pq/) · Princeton Algorithms · array layout, swim and sink, with code; also heapsort and the index priority queue · covers our angle: **partial** - Java, no TypeScript heap · fetched 2026-10-14 (*read*)
- **Also good:** [PriorityQueue (Java SE 21)](https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/util/PriorityQueue.html) · Oracle · comparator constructors; O(log n) offer and poll, linear remove(Object), unordered iterator · fetched 2026-10-14 (*read*)
- **Also good:** [Binary heap](https://en.wikipedia.org/wiki/Binary_heap) · Wikipedia · insert and extract with sift terminology, heapify, index equations · fetched 2026-10-14 (*read*)
- **Our delta:** a hand-written TypeScript heap with a comparator.

### T10-02 · Top-k problems — Master · 🔲 not written
- **Read this:** [Top K Frequent Elements: Heap vs Quickselect vs Bucket Sort](https://prachub.com/resources/top-k-frequent-elements) · PracHub · size-k min-heap O(n log k), bucket sort O(n), quickselect average O(n) with the O(n squared) worst case, and when each fits (the company-question anecdotes were not checked) · covers our angle: full · fetched 2026-10-14 (*read*)
- **Also good:** [Top K Frequent Elements](https://neetcode.io/solutions/top-k-frequent-elements) · NeetCode · sorting, min-heap and bucket solutions; pitfall: max-heap instead of min-heap · fetched 2026-10-14 (*read*)

### T10-03 · Merging k sorted sequences — Master · 🔲 not written
- **Read this:** [Merge k Sorted Lists](https://neetcode.io/solutions/merge-k-sorted-lists) · NeetCode · heap of list heads, plus divide and conquer · covers our angle: **partial** - arrays case only implied · fetched 2026-10-14 (*read*)
- **Also good:** [Find smallest range containing elements from k lists](https://www.geeksforgeeks.org/dsa/find-smallest-range-containing-elements-from-k-lists/) · GeeksforGeeks · min-heap of (value, row, column) nodes plus a running maximum, O(n k log k) · fetched 2026-10-14 (*read*)
- **Our delta:** a TypeScript version over k sorted arrays with index triples (the GFG page has the C++ shape).

### T10-04 · Two heaps — Master · 🔲 not written
- **Read this:** [Find Median in a Stream: The Two-Heaps Insight](https://www.techinterview.org/post/3233474781/find-median-stream-two-heaps/) · techinterview.org · size invariant and rebalancing, brute force against sorted list against two heaps · covers our angle: **partial** - sliding window median only named, lazy deletion in one sentence · fetched 2026-10-14 (*read*)
- **Also good:** [Find Median from Data Stream](https://neetcode.io/solutions/find-median-from-data-stream) · NeetCode · sort, then max-heap plus min-heap halves; pitfalls on balance and even counts · fetched 2026-10-14 (*read*)
- **Our delta:** sliding-window median with lazy deletion.

### T10-05 · Scheduling with heaps — Master · 🔲 not written
- **Read this:** [Heap and Priority Queue Interview Patterns](https://techinterview.org/heap-priority-queue-interview-patterns/) · techinterview.org · task scheduler (max-heap plus cooldown queue) and reorganize string with code; meeting rooms only listed by name · covers our angle: **partial** - no CPU simulation or deadlines · fetched 2026-10-14 (*read*)
- **Also good:** [Meeting Rooms II](https://neetcode.io/solutions/meeting-rooms-ii) · NeetCode · min-heap of end times, plus sweep line, two pointers and greedy · fetched 2026-10-14 (*read*)
- **Also good:** [Task Scheduler](https://neetcode.io/solutions/task-scheduler) · NeetCode · max-heap with cooldown queue, then greedy and math forms · fetched 2026-10-14 (*read*)
- **Our delta:** CPU scheduling and earliest deadline first.

### T10-06 · Heapify in linear time — Understand · 🔲 not written
- **Read this:** [Heap lecture notes, build-heap analysis](https://cs.utexas.edu/~djimenez/utsa/cs3343/lecture6.html) · UT San Antonio (hosted at cs.utexas.edu) · why naive O(n log n) is loose and the level-by-level sum gives O(n); the key sum is asserted by induction, not shown · covers our angle: full · fetched 2026-10-14 (*read*)
- **Also good:** [Heap complexity notes](https://courses.washington.edu/css343/zander/NotesProbs/heapcomplexity) · University of Washington · the full sum-of-heights proof by doubling and subtracting · fetched 2026-10-14 (*read*)

### T10-07 · Greedy with heaps — Understand · 🔲 not written
- **Read this:** [IPO](https://neetcode.io/solutions/ipo) · NeetCode · min-heap by capital feeding a max-heap by profit · covers our angle: **partial** - one problem · fetched 2026-10-14 (*read*)
- **Also good:** [Reorganize String](https://neetcode.io/solutions/reorganize-string) · NeetCode · max-heap of counts with a held-back previous character · fetched 2026-10-14 (*read*)
- **Also good:** [Connect n ropes with minimal cost](https://www.techiedelight.com/connect-n-ropes-with-minimal-cost/) · Techie Delight · repeatedly merge the two smallest ropes with a min-heap, worked example [5, 4, 2, 8] gives 36 · fetched 2026-10-14 (*read*)
- **Our delta:** name the Huffman-coding link ourselves; the rope page does not mention it.

### T10-08 · Lazy deletion and indexed heaps — Understand · 🔲 not written
- **Read this:** [Dijkstra on sparse graphs](https://cp-algorithms.com/graph/dijkstra_sparse.html) · cp-algorithms · set with erase and reinsert, against a priority_queue that cannot remove so keeps stale pairs and skips them on pop; notes the no-decrease-key variant ran faster · covers our angle: **partial** - C++ only, graph context · fetched 2026-10-14 (*read*)
- **Also good:** [IndexMinPQ.java](https://algs4.cs.princeton.edu/24pq/IndexMinPQ.java.html) · Princeton Algorithms · a heap with position tracking (qp and pq arrays) and decrease-key · fetched 2026-10-14 (*read*)
- **Our delta:** the stale-entry check on pop stated for general removal, not only Dijkstra.

### T10-09 · Heap sort and selection — Know · 🔲 not written
- **Read this:** [Quickselect](https://en.wikipedia.org/wiki/Quickselect) · Wikipedia · pivot partitioning, average O(n) and worst O(n squared), median of medians as the fix · covers our angle: **partial** - heap sort on another page · fetched 2026-10-14 (*read*)
- **Also good:** [Heapsort](https://en.wikipedia.org/wiki/Heapsort) · Wikipedia · in-place, not stable, built from a max-heap; used as the fallback inside quicksort variants · fetched 2026-10-14 (*read*)

### T10-10 · Heaps in real systems — Know · 🔲 not written
- **Read this:** [8 Timer Implementation Patterns](https://hackernoon.com/8-timer-implementation-patterns-for-systems-and-network-software) · HackerNoon · min-heap timers (one system timer armed for the soonest expiry, O(log n)) against timer wheels (O(1)); short listicle · covers our angle: **partial** - no rate limiter or job runner · fetched 2026-10-14 (*read*)
- **Beyond the docs:** [Apache Kafka purgatory and hierarchical timing wheels](https://www.confluent.io/blog/apache-kafka-purgatory-hierarchical-timing-wheels/) · Confluent · a real broker moving from a DelayQueue (priority queue, O(log n)) to timing wheels, yet still keeping a DelayQueue of buckets to drive the clock · fetched 2026-10-14 (*read*)
- **Our delta:** job-runner and rate-limiter examples.

### T10-11 · Variants — Know · 🔲 not written
- **Read this:** [d-ary heap](https://en.wikipedia.org/wiki/D-ary_heap) · Wikipedia · branching factor trade-off: faster decrease-key, slower delete-min, better cache behaviour · covers our angle: **partial** - others elsewhere · fetched 2026-10-14 (*read*)
- **Also good:** [Pairing heap](https://en.wikipedia.org/wiki/Pairing_heap) · Wikipedia · cheap decrease-key in practice; cites the Larkin, Sen, Tarjan experiments · fetched 2026-10-14 (*read*)
- **Beyond the docs:** [A Back-to-Basics Empirical Study of Priority Queues](https://arxiv.org/pdf/1403.0252) · Larkin, Sen, Tarjan · measures which heap wins in practice (abstract read; the PDF body was not) · fetched 2026-10-14 (*headings only*)
- **Our delta:** one line each for binomial and Fibonacci heaps.
