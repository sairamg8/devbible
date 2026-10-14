---
title: "Link map · DSA · Part 2 (phases 3-5), file 1"
sidebar_label: "02 · arrays, strings, hashing (1)"
sidebar_position: 2
---

# Link map · DSA · Part 2 · file 1

Covers rows T03-01 to T03-16 (phase 3, arrays, hashing and prefix sums). No page of ours covers these rows yet, so every block is marked not written.
*read* means I read the passage; *headings only* means the page was fetched at HTTP 200 and its title and headings or key terms were checked.

### T03-01 · Hash maps and sets, with their costs — Master · 🔲 not written
- **Read this:** [Map - JavaScript (MDN)](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map) · MDN · the reference for key types, insertion order and Map against Object in JavaScript · covers our angle: **partial** - no Java side · fetched 2026-10-14 (*headings only*)
- **Also good:** [HashMap (Java SE 21)](https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/util/HashMap.html) · Oracle · constant-time contract, load factor, hashCode and equals reliance · fetched 2026-10-14
- **Also good:** [Object (Java SE 21)](https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/lang/Object.html) · Oracle · the official equals and hashCode contract · fetched 2026-10-14
- **Our delta:** the cost model (average against worst case, resizing) must be written by us; neither page teaches it as an interview topic.

### T03-02 · Frequency counting and the two-sum family — Master · 🔲 not written
- **Read this:** [Two Sum](https://neetcode.io/solutions/two-sum) · NeetCode · brute force to one-pass complement lookup, with complexity · covers our angle: **partial** - anagram signatures are elsewhere · fetched 2026-10-14 (*headings only*)
- **Also good:** [Group Anagrams](https://neetcode.io/solutions/group-anagrams) · NeetCode · frequency signature as the map key · fetched 2026-10-14
- **Also good:** [Contains Duplicate](https://neetcode.io/solutions/contains-duplicate) · NeetCode · the set-membership warm-up · fetched 2026-10-14
- **Our delta:** counting pairs and the pair-count variants are not on these pages.

### T03-03 · Prefix sums — Master · 🔲 not written
- **Read this:** [Introduction to Prefix Sums](https://usaco.guide/silver/prefix-sums) · USACO Guide · 1D prefix sums and range queries with code in Java · covers our angle: **partial** - no map of prefix counts · fetched 2026-10-14 (*headings only*)
- **Also good:** [More on Prefix Sums](https://usaco.guide/silver/more-prefix-sums) · USACO Guide · the 2D prefix sum and difference arrays · fetched 2026-10-14
- **Also good:** [Subarray Sum Equals K](https://neetcode.io/solutions/subarray-sum-equals-k) · NeetCode · the running-sum plus count map · fetched 2026-10-14
- **Beyond the docs:** [Prefix Sums and Hash Maps: Subarray Sum Equals K](https://johnkavanagh.co.uk/articles/prefix-sums-and-hash-maps-solving-subarray-sum-equals-k) · John Kavanagh · a focused article on why the map starts with a zero prefix · fetched 2026-10-14 (*headings only*)
- **Our delta:** the TypeScript version and the 2D subarray-sum extension.

### T03-04 · Kadane's algorithm — Master · 🔲 not written
- **Read this:** [Maximum subarray problem](https://en.wikipedia.org/wiki/Maximum_subarray_problem) · Wikipedia · Kadane's reset idea and its variants in one place · covers our angle: **partial** - interview framing is thin · fetched 2026-10-14 (*headings only*)
- **Also good:** [Maximum Subarray](https://neetcode.io/solutions/maximum-subarray) · NeetCode · the interview walk-through of the reset · fetched 2026-10-14
- **Also good:** [Maximum Sum Circular Subarray](https://docs.vultr.com/problem-set/maximum-sum-circular-subarray) · Vultr Docs · the circular variant via total minus minimum · fetched 2026-10-14
- **Also good:** [Maximum Product Subarray](https://neetcode.io/solutions/maximum-product-subarray) · NeetCode · tracking both max and min for the sign flip · fetched 2026-10-14
- **Our delta:** one unified page tying the three variants to the same reset intuition.

### T03-05 · The Dutch national flag — Master · 🔲 not written
- **Read this:** [Dutch national flag problem](https://en.wikipedia.org/wiki/Dutch_national_flag_problem) · Wikipedia · Dijkstra's three-way partition with pseudocode and the link to quicksort · covers our angle: **partial** - not framed as sort colours · fetched 2026-10-14 (*headings only*)
- **Also good:** [Sort Colors](https://neetcode.io/solutions/sort-colors) · NeetCode · the interview form with the low, mid, high pointers · fetched 2026-10-14
- **Also good:** [Move Zeroes](https://neetcode.io/solutions/move-zeroes) · NeetCode · the two-way special case · fetched 2026-10-14
- **Our delta:** the loop invariant written out region by region.

### T03-06 · Cyclic sort and index-as-hash — Master · 🔲 not written
- **Read this:** [Cyclic Sort](https://algorithm-spices.readthedocs.io/en/latest/patterns_for_coding_questions/cyclic_sort/) · Algorithm Spices · the pattern plus missing and duplicate number variants · covers our angle: **partial** - code is not TypeScript or Java first · fetched 2026-10-14 (*headings only*)
- **Also good:** [Set Mismatch](https://neetcode.io/solutions/set-mismatch) · NeetCode · missing and duplicate together · fetched 2026-10-14
- **Also good:** [Find All Numbers Disappeared in an Array](https://neetcode.io/solutions/find-all-numbers-disappeared-in-an-array) · NeetCode · the sign-marking alternative · fetched 2026-10-14
- **Our delta:** when mutating the input is allowed, and the infinite-loop trap on duplicates.

### T03-07 · In-place operations — Master · 🔲 not written
- **Read this:** [Merge Sorted Array](https://neetcode.io/solutions/merge-sorted-array) · NeetCode · merging from the back so nothing unread is overwritten · covers our angle: **partial** - one of three sub-topics · fetched 2026-10-14 (*headings only*)
- **Also good:** [Remove Duplicates From Sorted Array](https://neetcode.io/solutions/remove-duplicates-from-sorted-array) · NeetCode · reader and writer indices · fetched 2026-10-14
- **Also good:** [Rotate Array](https://neetcode.io/solutions/rotate-array) · NeetCode · the three-reversal trick and the extra-space options · fetched 2026-10-14
- **Our delta:** none of these pages compares the approaches side by side.

### T03-08 · Intervals — Master · 🔲 not written
- **Read this:** [Meeting Rooms II](https://neetcode.io/solutions/meeting-rooms-ii) · NeetCode · min-heap and sweep line solutions for the room count · covers our angle: **partial** - merge and insert are separate pages · fetched 2026-10-14 (*headings only*)
- **Also good:** [Merge Intervals](https://neetcode.io/solutions/merge-intervals) · NeetCode · sort by start then extend · fetched 2026-10-14
- **Also good:** [Insert Interval](https://neetcode.io/solutions/insert-interval) · NeetCode · the three-phase scan · fetched 2026-10-14
- **Beyond the docs:** [Interval and Sweep Line Patterns](https://www.techinterview.org/post/3233474289/coding-interview-interval-sweep-line-patterns-meeting-rooms-skyline-problem-event-processing-coordinate-compression/) · techinterview.org · puts the whole interval family under one sweep-line idea · fetched 2026-10-14 (*headings only*)
- **Our delta:** counting overlaps and the tie rule for equal end and start times.

### T03-09 · "Sort, then …" and "hash, then …" — Master · 🔲 not written
- **Read this:** none found - tried: sort then scan vs hash set array problems when to sort interview; the results were homework sheets and forum threads, nothing that teaches the choice.
- **Our delta:** this is a decision page we write ourselves, using the cost trade (sorting costs time, hashing costs space).

### T03-10 · Difference arrays — Understand · 🔲 not written
- **Read this:** [More on Prefix Sums](https://usaco.guide/silver/more-prefix-sums) · USACO Guide · difference arrays for range updates, then 2D · covers our angle: full · fetched 2026-10-14 (*headings only*)
- **Also good:** [Car Pooling](https://neetcode.io/solutions/car-pooling) · NeetCode · the booking-count use of the trick · fetched 2026-10-14
- **Beyond the docs:** [Prefix Sum and Difference Array Patterns](https://www.techinterview.org/post/3233474193/coding-interview-prefix-sum-difference-array-patterns-range-query-subarray-sum-2d-prefix-sum-running-total/) · techinterview.org · prefix sums and difference arrays as inverse operations · fetched 2026-10-14 (*headings only*)

### T03-11 · Sorting-based approaches — Understand · 🔲 not written
- **Read this:** [Custom Comparators and Coordinate Compression](https://usaco.guide/silver/sorting-custom) · USACO Guide · comparators and sort-then-scan problems with Java code · covers our angle: **partial** - no TypeScript comparator pitfalls · fetched 2026-10-14 (*headings only*)
- **Also good:** [Array.prototype.sort() (MDN)](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/sort) · MDN · default string ordering and comparator rules · fetched 2026-10-14
- **Also good:** [Stable Array.prototype.sort](https://v8.dev/features/stable-sort) · V8 · why stability became guaranteed · fetched 2026-10-14
- **Our delta:** the default lexicographic sort of numbers in JavaScript as the first trap.

### T03-12 · Matrices — Understand · 🔲 not written
- **Read this:** [Rotate Image](https://neetcode.io/solutions/rotate-image) · NeetCode · in-place rotation by transpose and reverse or by layers · covers our angle: **partial** - one of five problems · fetched 2026-10-14 (*headings only*)
- **Also good:** [Spiral Matrix](https://neetcode.io/solutions/spiral-matrix) · NeetCode · the four shrinking boundaries · fetched 2026-10-14
- **Also good:** [Set Matrix Zeroes](https://neetcode.io/solutions/set-matrix-zeroes) · NeetCode · constant space with the first row and column as markers · fetched 2026-10-14
- **Beyond the docs:** [Matrix traversal (labuladong)](https://labuladong.gitbook.io/algo-en/algorithmic-thinking/matrix-traversal) · labuladong · rotation and spiral as one traversal family · fetched 2026-10-14 (*headings only*)
- **Our delta:** search in a sorted matrix and diagonal traversal have no page here.

### T03-13 · Product except self and the "no division" family — Understand · 🔲 not written
- **Read this:** [Product of Array Except Self](https://neetcode.io/solutions/product-of-array-except-self) · NeetCode · prefix and suffix products, then the single-output-array version · covers our angle: full · fetched 2026-10-14 (*headings only*)

### T03-14 · Majority element and voting — Understand · 🔲 not written
- **Read this:** [Boyer–Moore majority vote algorithm](https://en.wikipedia.org/wiki/Boyer%E2%80%93Moore_majority_vote_algorithm) · Wikipedia · the candidate and counter with the second verification pass · covers our angle: **partial** - the third-of-array case is only hinted · fetched 2026-10-14 (*headings only*)
- **Also good:** [Majority Element II](https://neetcode.io/solutions/majority-element-ii) · NeetCode · two candidates for the more-than-a-third version · fetched 2026-10-14
- **Also good:** [Misra–Gries summary](https://en.wikipedia.org/wiki/Misra%E2%80%93Gries_summary) · Wikipedia · the general k-candidate version · fetched 2026-10-14
- **Our delta:** an argument for why the cancelling pairs never remove a true majority.

### T03-15 · Longest consecutive sequence and set tricks — Understand · 🔲 not written
- **Read this:** [Longest Consecutive Sequence](https://neetcode.io/solutions/longest-consecutive-sequence) · NeetCode · sorting, then the set with sequence starts for linear time · covers our angle: full · fetched 2026-10-14 (*headings only*)

### T03-16 · Problems over two arrays — Know · 🔲 not written
- **Read this:** [Median of Two Sorted Arrays](https://neetcode.io/solutions/median-of-two-sorted-arrays) · NeetCode · the binary-search partition on the smaller array · covers our angle: **partial** - merge and k-th element are not shown · fetched 2026-10-14 (*headings only*)
- **Also good:** [Intersection of Two Arrays](https://neetcode.io/solutions/intersection-of-two-arrays) · NeetCode · set, sort and two-pointer options · fetched 2026-10-14
- **Our delta:** the k-th element version that leads into the median.
