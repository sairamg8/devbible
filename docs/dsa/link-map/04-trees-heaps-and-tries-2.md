---
title: "Link map · DSA · Part 4 (phases 9-11), file 2"
sidebar_label: "04 · trees, heaps, tries (2)"
sidebar_position: 4
---

# Link map · DSA · Part 4, file 2

Rows T10-01 to T10-11 (phase 10, heaps and priority queues).
*read* = I read the passage; *headings only* = fetched at 200 and headings or keywords checked. Every row below is *headings only*. No page of ours covers these phases yet.

### T10-01 · The binary heap — Master · 🔲 not written
- **Read this:** [Priority Queues](https://algs4.cs.princeton.edu/24pq/) · Princeton Algorithms · array layout, swim and sink, with code · covers our angle: **partial** - Java, no TypeScript heap · fetched 2026-10-14 (*headings only*)
- **Also good:** [PriorityQueue (Java SE 21)](https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/util/PriorityQueue.html) · Oracle · comparator constructors and costs · fetched 2026-10-14
- **Also good:** [Binary heap](https://en.wikipedia.org/wiki/Binary_heap) · Wikipedia · insert and extract with sift terminology · fetched 2026-10-14
- **Our delta:** a hand-written TypeScript heap with a comparator.

### T10-02 · Top-k problems — Master · 🔲 not written
- **Read this:** [Top K Frequent Elements: Heap vs Quickselect vs Bucket Sort](https://prachub.com/resources/top-k-frequent-elements) · PracHub · compares size-k heap, quickselect and sorting · covers our angle: full · fetched 2026-10-14 (*headings only*)
- **Also good:** [Top K Frequent Elements](https://neetcode.io/solutions/top-k-frequent-elements) · NeetCode · heap and bucket solutions · fetched 2026-10-14

### T10-03 · Merging k sorted sequences — Master · 🔲 not written
- **Read this:** [Merge k Sorted Lists](https://neetcode.io/solutions/merge-k-sorted-lists) · NeetCode · heap of list heads · covers our angle: **partial** - arrays case only implied · fetched 2026-10-14 (*headings only*)
- **Also good:** [Smallest Range Covering Elements from K Lists](https://neetcode.io/solutions/smallest-range-covering-elements-from-k-lists) · NeetCode · heap plus running maximum · fetched 2026-10-14
- **Our delta:** merging k sorted arrays by index triples.

### T10-04 · Two heaps — Master · 🔲 not written
- **Read this:** [Find Median in a Stream: The Two-Heaps Insight](https://www.techinterview.org/post/3233474781/find-median-stream-two-heaps/) · techinterview.org · size invariant and rebalancing · covers our angle: **partial** - sliding window median not detailed · fetched 2026-10-14 (*headings only*)
- **Also good:** [Find Median from Data Stream](https://neetcode.io/solutions/find-median-from-data-stream) · NeetCode · short solution · fetched 2026-10-14
- **Our delta:** sliding-window median with lazy deletion.

### T10-05 · Scheduling with heaps — Master · 🔲 not written
- **Read this:** [Heap and Priority Queue Interview Patterns](https://techinterview.org/heap-priority-queue-interview-patterns/) · techinterview.org · meeting rooms and task scheduler as heap patterns · covers our angle: **partial** - no CPU simulation or deadlines · fetched 2026-10-14 (*headings only*)
- **Also good:** [Meeting Rooms II](https://neetcode.io/solutions/meeting-rooms-ii) · NeetCode · min-heap of end times · fetched 2026-10-14
- **Also good:** [Task Scheduler](https://neetcode.io/solutions/task-scheduler) · NeetCode · max-heap with cooldown queue · fetched 2026-10-14
- **Our delta:** CPU scheduling and earliest deadline first.

### T10-06 · Heapify in linear time — Understand · 🔲 not written
- **Read this:** [Heap lecture notes, build-heap analysis](https://cs.utexas.edu/~djimenez/utsa/cs3343/lecture6.html) · UT San Antonio · level-by-level sum showing the O(n) bound · covers our angle: full · fetched 2026-10-14 (*headings only*)
- **Also good:** [Heap complexity notes](https://courses.washington.edu/css343/zander/NotesProbs/heapcomplexity) · University of Washington · sum of heights argument · fetched 2026-10-14

### T10-07 · Greedy with heaps — Understand · 🔲 not written
- **Read this:** [IPO](https://neetcode.io/solutions/ipo) · NeetCode · two-heap capital selection · covers our angle: **partial** - one problem · fetched 2026-10-14 (*headings only*)
- **Also good:** [Reorganize String](https://neetcode.io/solutions/reorganize-string) · NeetCode · max-heap of counts · fetched 2026-10-14
- **Our delta:** minimum cost to connect ropes (no verifiable page found) as the Huffman-style case.

### T10-08 · Lazy deletion and indexed heaps — Understand · 🔲 not written
- **Read this:** [IndexMinPQ.java](https://algs4.cs.princeton.edu/24pq/IndexMinPQ.java.html) · Princeton Algorithms · a heap with position tracking and decrease-key · covers our angle: **partial** - no lazy deletion explanation · fetched 2026-10-14 (*headings only*)
- **Also good:** [Dijkstra on sparse graphs](https://cp-algorithms.com/graph/dijkstra_sparse.html) · cp-algorithms · set-based removal and reinsert instead of decrease-key · fetched 2026-10-14
- **Our delta:** the stale-entry check on pop.

### T10-09 · Heap sort and selection — Know · 🔲 not written
- **Read this:** [Quickselect](https://en.wikipedia.org/wiki/Quickselect) · Wikipedia · pivot partitioning, expected and worst cost, median of medians · covers our angle: **partial** - heap sort on another page · fetched 2026-10-14 (*headings only*)
- **Also good:** [Heapsort](https://en.wikipedia.org/wiki/Heapsort) · Wikipedia · in-place sort from a max-heap · fetched 2026-10-14

### T10-10 · Heaps in real systems — Know · 🔲 not written
- **Read this:** [8 Timer Implementation Patterns](https://hackernoon.com/8-timer-implementation-patterns-for-systems-and-network-software) · HackerNoon · heap against timer wheel · covers our angle: **partial** - no rate limiter or job runner · fetched 2026-10-14 (*headings only*)
- **Beyond the docs:** [timing-wheel crate](https://docs.rs/timing-wheel) · docs.rs · a wheel that still keeps a heap to find the next expiry · fetched 2026-10-14 (*headings only*)
- **Our delta:** job-runner and rate-limiter examples.

### T10-11 · Variants — Know · 🔲 not written
- **Read this:** [d-ary heap](https://en.wikipedia.org/wiki/D-ary_heap) · Wikipedia · branching factor trade-off · covers our angle: **partial** - others elsewhere · fetched 2026-10-14 (*headings only*)
- **Also good:** [Pairing heap](https://en.wikipedia.org/wiki/Pairing_heap) · Wikipedia · cheap decrease-key in practice · fetched 2026-10-14
- **Beyond the docs:** [A Back-to-Basics Empirical Study of Priority Queues](https://arxiv.org/pdf/1403.0252) · Larkin, Sen, Tarjan · measures which heap wins in practice · fetched 2026-10-14 (*headings only*)
- **Our delta:** one line each for binomial and Fibonacci heaps.
