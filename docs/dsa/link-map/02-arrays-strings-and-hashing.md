---
title: "Link map · DSA · Part 2 (phases 3–5)"
sidebar_label: "02 · arrays, strings & hashing"
sidebar_position: 2
---

# Link map · DSA · Part 2 (phases 3–5)

Covers every topic row of phases 3, 4 and 5 in `docs/dsa/syllabus/02-arrays-strings-and-hashing.md`: arrays, hashing and prefix sums (T03-01 to T03-16), two pointers and sliding window (T04-01 to T04-13) and strings (T05-01 to T05-13). That is 42 rows. None has a written page of ours yet (`docs/dsa/pages` holds phases 0 to 2 only), so every block is marked not written and its "Our delta" line records what the syllabus row promises.
*read* = I read the passage that supports the claim on the fetched page; *headings only* = fetched at HTTP 200 and not read for the claim (none left in this file). Third-party links carry a date only where the page shows one. No `#anchors` are given. LeetCode problem pages return 403 to the fetcher, so no LeetCode links are used. Where no good non-official explanation turned up, the block has no "Beyond the docs" line. Official means language specifications and API documentation (MDN, Oracle Javadoc), cp-algorithms, the USACO Guide, and Wikipedia for the named algorithms. Where a row is a named interview problem, a problem walkthrough (NeetCode, AlgoMaster, CodePath) is used as the primary read, since the official sources do not frame the interview pattern.

---

## Phase 3 — Arrays, hashing and prefix sums

### T03-01 · Hash maps and sets, with their costs — Master · 🔲 not written
- **Read this:** [Map](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map) · MDN · the "Objects vs. Maps" table: any value as a key against strings and symbols only, insertion-order iteration, and better behaviour under frequent additions and removals (*read*) · covers our angle: **partial** — nothing on average against worst-case cost · fetched 2026-10-14
- **Also good:** [HashMap](https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/util/HashMap.html) · Oracle Javadoc, Java 21 · `get` and `put` are constant time only if the hash disperses well; many keys with one `hashCode()` slow the table; default load factor 0.75 and rehash at twice the buckets (*read*) · covers our angle: **partial** — no worked `equals` and `hashCode` example · fetched 2026-10-14
- **Also good:** [Object](https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/lang/Object.html) · Oracle Javadoc, Java 21 · the `equals` contract (reflexive, symmetric, transitive, consistent, null) and the rule that equal objects must have equal hash codes (*read*) · covers our angle: **partial** — the contract only, with no mutable-key trap · fetched 2026-10-14
- **Also good:** [Hash table](https://en.wikipedia.org/wiki/Hash_table) · Wikipedia · average Θ(1) against worst-case O(n), the load factor, chaining against open addressing (*read*) · fetched 2026-10-14
- **Our delta:** the syllabus row promises the JavaScript `Map` against plain-object choice and the Java `HashMap` key contract in one place, with the cost of each.

### T03-02 · Frequency counting and the two-sum family — Master · 🔲 not written
- **Read this:** [Two Sum](https://neetcode.io/solutions/two-sum) · NeetCode · brute force, sorting with two pointers, a two-pass map and the one-pass complement lookup, each with its cost; the pitfalls list covers reusing one element and duplicate values overwriting indices (*read*) · covers our angle: **partial** — pairs only; anagram signatures are on the next link · fetched 2026-10-15
- **Also good:** [Group Anagrams](https://neetcode.io/solutions/group-anagrams) · NeetCode · sorted string against a 26-slot count array as the map key, the second with no sort (*read*) · covers our angle: **partial** — grouping only, no pair counting · fetched 2026-10-15
- **Also good:** [Hash table](https://en.wikipedia.org/wiki/Hash_table) · Wikipedia · why lookup and insert are average constant time, which is what makes a one-pass complement lookup linear (*read*) · fetched 2026-10-14
- **Our delta:** the complement lookup, counting pairs and anagrams as frequency signatures, as one family rather than separate tricks. The pages above teach each problem alone and none covers counting pairs.

### T03-03 · Prefix sums — Master · 🔲 not written
- **Read this:** [Prefix Sums](https://usaco.guide/silver/prefix-sums) · USACO Guide · builds the cumulative array in linear time and answers a range sum in constant time, and says the idea extends to invertible operations such as XOR (*read*) · covers our angle: **partial** — one-dimensional only, no map of prefix counts · fetched 2026-10-14
- **Also good:** [Summed-area table](https://en.wikipedia.org/wiki/Summed-area_table) · Wikipedia · the two-dimensional table built in one pass, and a rectangle sum from exactly four lookups (*read*) · covers our angle: **partial** — no subarray-sum-equals-k · fetched 2026-10-14
- **Also good:** [Subarray Sum Equals K](https://neetcode.io/solutions/subarray-sum-equals-k) · NeetCode · brute force, then prefix sums with a count map seeded with `{0: 1}` for the empty prefix; the pitfalls list the zero seed, the update-after-check order, and why a sliding window fails once negatives appear (*read*) · covers our angle: **full** for the map of prefix counts · fetched 2026-10-15
- **Beyond the docs:** [Prefix sums and hash maps: solving subarray sum equals k](https://johnkavanagh.co.uk/articles/prefix-sums-and-hash-maps-solving-subarray-sum-equals-k/) · John Kavanagh, 2025-09-08 · writes a subarray sum as a difference of two running totals, stores counts not presence, and seeds the map with total 0 once, so subarrays from index 0 are not lost · fetched 2026-10-14 (*read*)
- **Our delta:** the three pieces on one page in both languages: one-dimensional, two-dimensional, and the map of prefix counts.

### T03-04 · Kadane's algorithm — Master · 🔲 not written
- **Read this:** [Maximum subarray problem](https://en.wikipedia.org/wiki/Maximum_subarray_problem) · Wikipedia · one left-to-right pass in O(n) time and O(1) space, with `current_sum = max(x, current_sum + x)` and the empty-subarray variant (*read*) · covers our angle: **partial** — no circular variant and no maximum product with the sign flip · fetched 2026-10-14
- **Also good:** [Maximum Subarray](https://neetcode.io/solutions/maximum-subarray) · NeetCode · the interview walk-through: if the running sum goes negative, reset to the current element, ending with Kadane's algorithm in constant space (*read*) · fetched 2026-10-15
- **Also good:** [Maximum Product Subarray](https://neetcode.io/solutions/maximum-product-subarray) · NeetCode · keeps both the minimum and the maximum product ending at each index, so a negative can flip them (*read*) · fetched 2026-10-15
- **Also good:** [Maximum Sum Circular Subarray](https://docs.vultr.com/problem-set/maximum-sum-circular-subarray) · Vultr Docs, updated 2025-06-11 · the wrapping case as total sum minus the minimum subarray, answer the larger of that and plain Kadane; edge cases are only gestured at (*read*) · fetched 2026-10-15
- **Also good:** [More Prefix Sums](https://usaco.guide/silver/more-prefix-sums) · USACO Guide · gets the maximum subarray from prefix sums and a running minimum of prefixes, and lists Kadane's algorithm as a collapsed alternative solution, not read (*read*) · fetched 2026-10-14
- **Our delta:** the reset intuition tying the three variants together on one page, and the all-negative edge case of the circular variant.

### T03-05 · The Dutch national flag — Master · 🔲 not written
- **Read this:** [Dutch national flag problem](https://en.wikipedia.org/wiki/Dutch_national_flag_problem) · Wikipedia · Dijkstra's single pass with three indices and four regions (below, equal, unsorted, above), in Θ(n) moves (*read*) · covers our angle: **partial** — no sort-colours or move-zeroes framing and no language code · fetched 2026-10-14
- **Also good:** [Sort Colors](https://neetcode.io/solutions/sort-colors) · NeetCode · sorting, counting sort, then the one-pass three-pointer partition (left boundary, current, right boundary) (*read*) · fetched 2026-10-15
- **Also good:** [Move Zeroes](https://neetcode.io/solutions/move-zeroes) · NeetCode · extra space, two passes, then one pass swapping with a boundary pointer, which is the two-way partition (*read*) · fetched 2026-10-15
- **Our delta:** the region invariant as the way to write it correctly, and move zeroes as the same partition.

### T03-06 · Cyclic sort and index-as-hash — Master · 🔲 not written
- **Read this:** [Mastering Cyclic Sort](https://algocademy.com/blog/mastering-cyclic-sort-a-powerful-algorithm-for-efficient-array-manipulation/) · AlgoCademy Blog, 2024-10-21 · swap each value to index value minus one; solves the missing number, all duplicates and the first missing positive, and its loop only advances when `nums[i] == nums[correct]`, which is what stops an endless loop on duplicates; Python only (*read*) · covers our angle: **partial** — no TypeScript or Java, and the guard is shown but not explained · fetched 2026-10-15
- **Also good:** [What is a cyclic sort algorithm?](https://www.educative.io/blog/what-is-a-cyclic-sort-algorithm) · Educative, 2025-08-18 · the cycle picture and the O(n) time, O(1) space claim; its sample loop `while arr[i] != i + 1` ends only for distinct values one to n and would spin on a duplicate (*read*) · fetched 2026-10-15
- **Also good:** [Find All Numbers Disappeared in an Array](https://neetcode.io/solutions/find-all-numbers-disappeared-in-an-array) · NeetCode · hash set, boolean array, sorting, then negative marking, the in-place alternative to cyclic sort (*read*) · fetched 2026-10-15
- **Also good:** [Set Mismatch](https://neetcode.io/solutions/set-mismatch) · NeetCode · missing and duplicate together by sorting, a frequency count, negative marking, arithmetic or XOR; not cyclic sort (*read*) · fetched 2026-10-15
- **Also good:** [Cycle sort](https://en.wikipedia.org/wiki/Cycle_sort) · Wikipedia · rotates each permutation cycle into place, minimising writes; it finds each target by counting smaller elements, so it is O(n²) and not the same as the values-one-to-n technique (*read*) · fetched 2026-10-14
- **Our delta:** values one to n placed at index value minus one with the target known for free, so missing and duplicate numbers fall out without extra space; the duplicate guard explained, and when mutating the input is allowed.

### T03-07 · In-place operations — Master · 🔲 not written
- **Read this:** [Merge Sorted Array](https://neetcode.io/solutions/merge-sorted-array) · NeetCode · sorting, three pointers with a buffer, then filling `nums1` from the back so no unread element is overwritten (*read*) · covers our angle: **partial** — one of the three sub-topics · fetched 2026-10-15
- **Also good:** [Remove Duplicates From Sorted Array](https://neetcode.io/solutions/remove-duplicates-from-sorted-array) · NeetCode · a sorted set, then two pointers: one marks where the next unique value goes, one scans (*read*) · fetched 2026-10-15
- **Also good:** [Rotate Array](https://neetcode.io/solutions/rotate-array) · NeetCode · brute force, extra space, cyclic traversal and the three-reversal trick (*read*) · fetched 2026-10-15
- **Also good:** [Merge algorithm](https://en.wikipedia.org/wiki/Merge_algorithm) · Wikipedia · two sorted lists merge in linear time; avoiding the temporary array is possible but costs speed and simplicity, and in-place merges may give up linear time (*read*) · fetched 2026-10-14
- **Our delta:** the three as one toolkit: back-to-front merge, reader and writer, rotation by three reversals. No page compares the approaches side by side.

### T03-08 · Intervals — Master · 🔲 not written
- **Read this:** [Meeting Rooms II](https://neetcode.io/solutions/meeting-rooms-ii) · NeetCode · min-heap, sweep line, two pointers and greedy solutions for the room count (*read*) · covers our angle: **partial** — rooms only; merge and insert are separate pages · fetched 2026-10-15
- **Also good:** [Merge Intervals](https://neetcode.io/solutions/merge-intervals) · NeetCode · sorting, sweep line and greedy (*read*) · fetched 2026-10-15
- **Also good:** [Insert Interval](https://neetcode.io/solutions/insert-interval) · NeetCode · linear scan, binary search and greedy (*read*) · fetched 2026-10-15
- **Also good:** [Interval scheduling](https://en.wikipedia.org/wiki/Interval_scheduling) · Wikipedia · the earliest-finish greedy for the maximum non-overlapping set; it names minimising resources but gives no algorithm, so meeting rooms are not covered (*read*) · fetched 2026-10-14
- **Beyond the docs:** [Interval and Sweep Line Patterns](https://www.techinterview.org/post/3233474289/coding-interview-interval-sweep-line-patterns-meeting-rooms-skyline-problem-event-processing-coordinate-compression/) · techinterview.org, no named author, 2026-04-20 · each interval becomes plus one at the start and minus one at the end, sorted, with a running count; on equal times the end event goes first so a freed room is reused · fetched 2026-10-15 (*read*)
- **Our delta:** counting overlaps, and the tie rule for equal end and start times applied to both the heap and the sweep.

### T03-09 · "Sort, then …" and "hash, then …" — Master · 🔲 not written
- **Read this:** [Contains Duplicate](https://neetcode.io/solutions/contains-duplicate) · NeetCode · brute force, sorting and a hash set for one problem, with the time and space of each (*read*) · covers our angle: **partial** — one problem, no general rule for choosing · fetched 2026-10-15
- **Also good:** [Longest Consecutive Sequence](https://neetcode.io/solutions/longest-consecutive-sequence) · NeetCode · sorting against a hash set for the same problem (*read*) · fetched 2026-10-14
- **Also good:** [Sorting and Custom Comparators](https://usaco.guide/silver/sorting-custom) · USACO Guide · sorting by key or comparator, multiple criteria, coordinate compression (*read*) · covers our angle: **partial** — no discussion of when to hash instead, and it says nothing on stability · fetched 2026-10-14
- **Also good:** [Hash table](https://en.wikipedia.org/wiki/Hash_table) · Wikipedia · average Θ(1) lookup with O(n) worst case, which is the cost side of choosing to hash (*read*) · fetched 2026-10-14
- **Our delta:** a decision rule: which opening the constraints and the follow-up (space, order to keep) allow. No source states one.

### T03-10 · Difference arrays — Understand · 🔲 not written
- **Read this:** [More Prefix Sums](https://usaco.guide/silver/more-prefix-sums) · USACO Guide · the difference-array section: add at the start, subtract just past the end, and a prefix sum recovers the values in O(N+M) (*read*) · covers our angle: **partial** — no booking-count framing · fetched 2026-10-14
- **Also good:** [Car Pooling](https://neetcode.io/solutions/car-pooling) · NeetCode · the booking-count use: brute force, min-heap and two line sweeps; the pitfalls say to process drop-offs before pickups at the same location (*read*) · fetched 2026-10-15
- **Beyond the docs:** [Prefix Sum and Difference Array Patterns](https://www.techinterview.org/post/3233474193/coding-interview-prefix-sum-difference-array-patterns-range-query-subarray-sum-2d-prefix-sum-running-total/) · techinterview.org, no named author, 2026-04-20 · the difference array as the inverse of the prefix sum: add V at left, subtract V at right plus one; names flight bookings, range addition and car pooling · fetched 2026-10-15 (*read*)
- **Our delta:** the end-plus-one boundary and the same-location tie rule written out in both languages.

### T03-11 · Sorting-based approaches — Understand · 🔲 not written
- **Read this:** [Array.prototype.sort](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/sort) · MDN · comparator rules (pure, antisymmetric, transitive), stable since ES2019, the default compares UTF-16 code units, and sorting is in place (*read*) · covers our angle: **partial** — JavaScript only · fetched 2026-10-14
- **Also good:** [Arrays](https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/util/Arrays.html) · Oracle Javadoc, Java 21 · object sorts are stable (a TimSort-derived merge sort); primitive sorts use dual-pivot quicksort and are not promised stable (*read*) · fetched 2026-10-14
- **Also good:** [Comparator](https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/util/Comparator.html) · Oracle Javadoc, Java 21 · `comparing` and `thenComparing`, and consistency with `equals`; the page does not mention the subtraction-overflow trap (*read*) · fetched 2026-10-14
- **Our delta:** one sort-then-scan treatment with both languages' comparator traps side by side, and the problems where sorting is the whole trick.

### T03-12 · Matrices — Understand · 🔲 not written
- **Read this:** [Rotate Image](https://neetcode.io/solutions/rotate-image) · NeetCode · in-place rotation by four cells at a time, or reverse the rows vertically and then transpose (*read*) · covers our angle: **partial** — one of five problems · fetched 2026-10-15
- **Also good:** [Spiral Matrix](https://neetcode.io/solutions/spiral-matrix) · NeetCode · recursion, four shrinking boundaries, and a direction-and-step-count version (*read*) · fetched 2026-10-15
- **Also good:** [Set Matrix Zeroes](https://neetcode.io/solutions/set-matrix-zeroes) · NeetCode · constant space with the first row and column as markers, and the matrix[0][0] complication (*read*) · fetched 2026-10-15
- **Beyond the docs:** [Matrix traversal](https://labuladong.gitbook.io/algo-en/algorithmic-thinking/matrix-traversal) · labuladong · rotation as a mirror across the main diagonal then a reversal of each row, and spiral order with four border variables · fetched 2026-10-15 (*read*)
- **Our delta:** search in a sorted matrix and diagonal traversal have no page above; the index arithmetic for all five shapes in both languages.

### T03-13 · Product except self and the "no division" family — Understand · 🔲 not written
- **Read this:** [Product of Array Except Self](https://neetcode.io/solutions/product-of-array-except-self) · NeetCode · brute force, division with a zero count (division fails on zeros), prefix and suffix arrays, then the result array reused for a prefix pass and a suffix pass in O(1) extra space (*read*) · covers our angle: **full** · fetched 2026-10-15
- **Also good:** [Prefix Sums](https://usaco.guide/silver/prefix-sums) · USACO Guide · the prefix idea for any invertible operation; products are not covered, and division is the invertible step this family forbids (*read*) · fetched 2026-10-14
- **Our delta:** prefix and suffix products in one pass with the output array as storage, and why division fails on zeros.

### T03-14 · Majority element and voting — Understand · 🔲 not written
- **Read this:** [Boyer–Moore majority vote algorithm](https://en.wikipedia.org/wiki/Boyer%E2%80%93Moore_majority_vote_algorithm) · Wikipedia · one candidate and one counter in linear time and constant space; a second pass is needed to confirm a majority exists (*read*) · covers our angle: **partial** — the one-half case; generalisation only named · fetched 2026-10-14
- **Also good:** [Misra–Gries heavy hitters algorithm](https://en.wikipedia.org/wiki/Misra%E2%80%93Gries_heavy_hitters_algorithm) · Wikipedia · a first pass keeps fewer than k distinct values and a second counts them, which is the more-than-n-over-k generalisation (*read*) · fetched 2026-10-14
- **Also good:** [Majority Element II](https://neetcode.io/solutions/majority-element-ii) · NeetCode · brute force, sorting, a frequency count, then two-candidate Boyer-Moore voting for more than n/3 with a verifying count (*read*) · covers our angle: **full** for the third case · fetched 2026-10-15
- **Our delta:** why cancelling pairs never remove a true majority, and the second pass as part of the answer.

### T03-15 · Longest consecutive sequence and set tricks — Understand · 🔲 not written
- **Read this:** [Longest Consecutive Sequence](https://neetcode.io/solutions/longest-consecutive-sequence) · NeetCode · four approaches: brute force O(n²), sorting O(n log n), a hash set that starts only where `num - 1` is absent in O(n), and a boundary-length hash map (*read*) · covers our angle: **full** for the set method · fetched 2026-10-14
- **Our delta:** the sequence-start test as an instance of a wider set trick, with the amortised argument that each value is touched at most twice.

### T03-16 · Problems over two arrays — Know · 🔲 not written
- **Read this:** [Intersection of Two Arrays](https://neetcode.io/solutions/intersection-of-two-arrays) · NeetCode · brute force, sorting with two pointers and duplicate skipping, hash set, hash map and built-in functions (*read*) · covers our angle: **partial** — intersection only; merge and k-th are below · fetched 2026-10-15
- **Also good:** [Median of Two Sorted Arrays](https://neetcode.io/solutions/median-of-two-sorted-arrays) · NeetCode · a two-pointer merge up to the middle, then binary search on the smaller array; the preview for Part 3 (*read*) · covers our angle: **partial** — the k-th element version is not stated · fetched 2026-10-15
- **Also good:** [Merge algorithm](https://en.wikipedia.org/wiki/Merge_algorithm) · Wikipedia · linear-time merge of two sorted sequences (*read*) · fetched 2026-10-14
- **Also good:** [Quickselect](https://en.wikipedia.org/wiki/Quickselect) · Wikipedia · k-th smallest in expected O(n), worst case O(n²), linear with median of medians (*read*) · covers our angle: **partial** — one array, not two sorted ones · fetched 2026-10-14
- **Our delta:** intersection, merge and k-th across two arrays, with the median of two sorted arrays only previewed for Part 3.

**Gate — Phase 3:** subarray-sum-equals-k, merge intervals and the missing number without extra space, cold, in both languages. Links above cover the first only in part.

---

## Phase 4 — Two pointers and sliding window

### T04-01 · Opposite-direction pointers — Master · 🔲 not written
- **Read this:** [Two Pointers](https://usaco.guide/silver/two-pointers) · USACO Guide · the opposite-ends variant on a sorted array for a pair summing to a target, in one pass after sorting (*read*) · covers our angle: **partial** — no palindromes and no statement of the invariant · fetched 2026-10-14
- **Also good:** [Two Sum II Input Array Is Sorted](https://neetcode.io/solutions/two-sum-ii-input-array-is-sorted) · NeetCode · brute force, binary search, hash map, then the opposite-ends two pointers (*read*) · fetched 2026-10-15
- **Also good:** [Valid Palindrome](https://neetcode.io/solutions/valid-palindrome) · NeetCode · reverse and compare, then two pointers from both ends (*read*) · fetched 2026-10-15
- **Our delta:** the invariant that lets exactly one pointer move, applied to sorted pairs and palindromes.

### T04-02 · Same-direction pointers — Master · 🔲 not written
- **Read this:** [Remove Duplicates From Sorted Array](https://neetcode.io/solutions/remove-duplicates-from-sorted-array) · NeetCode · a sorted set, then two pointers where one marks where the next unique value goes and one scans (*read*) · covers our angle: **partial** — one problem, not the pattern · fetched 2026-10-15
- **Also good:** [Move Zeroes](https://neetcode.io/solutions/move-zeroes) · NeetCode · extra space, two passes, then one pass swapping with the write boundary, keeping order (*read*) · fetched 2026-10-15
- **Also good:** [Two Pointers](https://usaco.guide/silver/two-pointers) · USACO Guide · the same-direction variant, with both endpoints moving right, as in the sliding-window section (*read*) · covers our angle: **partial** — a window framing, not reader and writer compaction · fetched 2026-10-14
- **Our delta:** the reader and the writer invariant stated once for every removal problem.

### T04-03 · Fast and slow pointers — Master · 🔲 not written
- **Read this:** [Cycle detection](https://en.wikipedia.org/wiki/Cycle_detection) · Wikipedia · tortoise one step, hare two; finds the cycle, then its start by resetting the tortoise to the beginning, then its length, in O(λ + μ) time and O(1) memory (*read*) · covers our angle: **partial** — no array middle and no duplicate number · fetched 2026-10-14
- **Also good:** [Find The Duplicate Number](https://neetcode.io/solutions/find-the-duplicate-number) · NeetCode · seven approaches; the last treats the array as a linked list where each index points to the index given by its value, so the duplicate makes a cycle, then runs fast and slow pointers (*read*) · covers our angle: **full** for the duplicate number · fetched 2026-10-15
- **Our delta:** the middle of a list, and why the array seen as a function from index to value must have a cycle.

### T04-04 · 3-sum and 4-sum — Master · 🔲 not written
- **Read this:** [3Sum](https://neetcode.io/solutions/3sum) · NeetCode · sort, fix one element, two pointers for the rest, skipping duplicates for the first element and after a hit; pitfalls: forgetting to skip duplicates, not sorting, ending early (*read*) · covers our angle: **full** for 3-sum · fetched 2026-10-15
- **Also good:** [4Sum](https://neetcode.io/solutions/4sum) · NeetCode · hash map, two nested fixed elements with two pointers, then a recursive k-sum that skips duplicates at every level (*read*) · fetched 2026-10-15
- **Also good:** [3SUM](https://en.wikipedia.org/wiki/3SUM) · Wikipedia · sort, fix an element, scan the rest with two pointers, O(n²); the pseudocode assumes distinct values and gives no duplicate handling (*read*) · fetched 2026-10-14
- **Our delta:** the duplicate-skipping rule stated once for every level, and 4-sum as one more fixed element.

### T04-05 · Container with most water and trapping rain water — Master · 🔲 not written
- **Read this:** [Container With Most Water: The Two-Pointer Awakening](https://www.techinterview.org/post/3233474773/container-with-most-water-two-pointer/) · techinterview.org, no named author, 2026-05-01, updated 2026-06-30 · if the left line is shorter, every container using it with a closer partner is narrower and no taller, so the left pointer can be dropped (*read*) · covers our angle: **partial** — container only; trapping rain water not covered · fetched 2026-10-14
- **Also good:** [Container With Most Water](https://neetcode.io/solutions/container-with-most-water) · NeetCode · brute force, then two pointers: moving the taller line never helps because the height stays the same and the width shrinks (*read*) · fetched 2026-10-15
- **Beyond the docs:** [Container with Most Water](https://dev.to/steadbytes/container-with-most-water-3ige) · Ben Steadman (DEV Community), 2020-06-11 · a loop-invariant proof that moving the shorter side loses no better container; Rust code · fetched 2026-10-15 (*read*)
- **Beyond the docs:** [Trapping Rain Water](https://neetcode.io/solutions/trapping-rain-water) · NeetCode · brute force, prefix and suffix maximum arrays, a stack, and two pointers that move the side with the shorter wall while tracking leftMax and rightMax · fetched 2026-10-14 (*read*)
- **Our delta:** the proof in two sentences, and the matching running-maximum argument for trapping rain water.

### T04-06 · Fixed-size windows — Master · 🔲 not written
- **Read this:** [Permutation In String](https://neetcode.io/solutions/permutation-in-string) · NeetCode · a fixed window of length `len(s1)` with 26-slot count arrays, updated by removing the left character and adding the right one (*read*) · covers our angle: **partial** — running sums and maximum average are not shown · fetched 2026-10-15
- **Also good:** [Find All Anagrams in a String](https://neetcode.io/solutions/find-all-anagrams-in-a-string) · NeetCode · the anagram window: compare two 26-slot arrays after each slide, then a match counter that updates one slot at a time (*read*) · fetched 2026-10-15
- **Also good:** [Sliding Window](https://usaco.guide/gold/sliding-window) · USACO Guide · a constant-size subarray moving left to right; a naive sorted-set version costs O(N log N) (*read*) · covers our angle: **partial** — no running sum, maximum average or anagram window · fetched 2026-10-14
- **Also good:** [Moving average](https://en.wikipedia.org/wiki/Moving_average) · Wikipedia · the incremental update: add the entering value, drop the leaving one (*read*) · fetched 2026-10-14
- **Our delta:** running sums and counts, maximum average and the anagram window as one template.

### T04-07 · Variable-size windows — Master · 🔲 not written
- **Read this:** [Longest Substring Without Repeating Characters](https://neetcode.io/solutions/longest-substring-without-repeating-characters) · NeetCode · brute force, an expand-then-shrink window, then an optimal version that jumps the left pointer past the previous occurrence using a last-index map (*read*) · covers our angle: **partial** — sum-based shrinking is another page · fetched 2026-10-15
- **Also good:** [Minimum Size Subarray Sum](https://neetcode.io/solutions/minimum-size-subarray-sum) · NeetCode · the shortest window whose sum reaches a target, valid because all elements are positive (*read*) · fetched 2026-10-15
- **Also good:** [Longest Repeating Character Replacement](https://neetcode.io/solutions/longest-repeating-character-replacement) · NeetCode · a window whose validity is a count condition, shrinking when more than k characters differ from the target (*read*) · fetched 2026-10-15
- **Also good:** [Two Pointers](https://usaco.guide/silver/two-pointers) · USACO Guide · the sliding-window section finds the longest contiguous segment whose sum stays within a limit in linear time (*read*) · covers our angle: **partial** — no longest substring without repeats · fetched 2026-10-14
- **Our delta:** the expand-then-shrink loop for longest substring without repeats and for minimum-length subarray with a sum.

### T04-08 · Minimum window substring — Master · 🔲 not written
- **Read this:** [Minimum Window Substring](https://neetcode.io/solutions/minimum-window-substring) · NeetCode · a count map for `t`, a window map, and `have` against `need` (distinct characters that meet their count), shrinking from the left while `have == need` (*read*) · covers our angle: **full** · fetched 2026-10-14
- **Also good:** [Sliding Window](https://usaco.guide/gold/sliding-window) · USACO Guide · the window mechanics this problem builds on; no counts map or have-versus-need bookkeeping (*read*) · covers our angle: **partial** — only the window mechanics · fetched 2026-10-14
- **Our delta:** the counts map and the have-versus-need counter as the part most people get wrong once, with the off-by-one traps named.

### T04-09 · Sliding-window maximum — Master · 🔲 not written
- **Read this:** [Sliding Window](https://usaco.guide/gold/sliding-window) · USACO Guide · a decreasing monotonic deque with the front removed when it leaves the window, and a two-stack alternative with O(1) per queue operation and O(N) overall (*read*) · covers our angle: **full** on the mechanism · fetched 2026-10-14
- **Also good:** [Minimum stack / minimum queue](https://cp-algorithms.com/data_structures/stack_queue_modification.html) · cp-algorithms · the same deque for fixed-length minima, linear because every element is pushed and popped once (*read*) · fetched 2026-10-14
- **Also good:** [Sliding Window Maximum](https://neetcode.io/solutions/sliding-window-maximum) · NeetCode · brute force, segment tree, heap and block-based dynamic programming, then the deque of indices in decreasing value order, where each element is added and removed at most once (*read*) · fetched 2026-10-15
- **Beyond the docs:** [Monotonic Queue to Solve Sliding Window Problems](https://labuladong.online/en/algo/data-structure/monotonic-queue/) · labuladong · builds the monotonic queue as a data structure first, and explains why the inner loop still gives amortised O(1) per push and O(N) overall · fetched 2026-10-15 (*read*)
- **Our delta:** the linear-time argument stated plainly, tied to the amortised analysis of Phase 1.

### T04-10 · Recognising a window — Master · 🔲 not written
- **Read this:** [Prefix sums and hash maps: solving subarray sum equals k](https://johnkavanagh.co.uk/articles/prefix-sums-and-hash-maps-solving-subarray-sum-equals-k/) · John Kavanagh, 2025-09-08 · window logic needs the sum to move predictably, which holds only for non-negative values; negatives send you to prefix sums (*read*) · covers our angle: **partial** — argued for sums only, not as a general monotone-predicate test · fetched 2026-10-14
- **Also good:** [Subarray Sum Equals K](https://neetcode.io/solutions/subarray-sum-equals-k) · NeetCode · its pitfalls say a sliding window fails here because negatives make the running sum non-monotonic, so prefix sums with a hash map are required (*read*) · fetched 2026-10-15
- **Also good:** [Minimum Size Subarray Sum](https://neetcode.io/solutions/minimum-size-subarray-sum) · NeetCode · the positives-only case where the window works, because removing from the left can only lower the sum (*read*) · fetched 2026-10-15
- **Our delta:** the monotone-predicate test for a window, stated as a general rule with the prefix-sum fallback.

### T04-11 · The "at most k" trick — Understand · 🔲 not written
- **Read this:** [Subarrays with K Different Integers](https://neetcode.io/solutions/subarrays-with-k-different-integers) · NeetCode · reframes exactly k distinct as at most k minus at most k−1, with an `atMostK` helper window that shrinks past k (*read*) · covers our angle: **full** · fetched 2026-10-14
- **Also good:** [Two Pointers](https://usaco.guide/silver/two-pointers) · USACO Guide · the window mechanics only; the exactly-k identity is not covered (*read*) · covers our angle: **partial** · fetched 2026-10-14
- **Our delta:** exactly k equals at most k minus at most k minus one, for subarrays with k distinct values.

### T04-12 · Two pointers on linked lists and strings — Understand · 🔲 not written
- **Read this:** [Intersection of Two Linked Lists](https://neetcode.io/solutions/intersection-of-two-linked-lists) · NeetCode · brute force, hash set, aligning the pointers by the length difference, and the jump-to-the-other-head version that needs no lengths (*read*) · covers our angle: **partial** — merging and backspaces are separate pages · fetched 2026-10-15
- **Also good:** [Backspace String Compare](https://neetcode.io/solutions/backspace-string-compare) · NeetCode · a stack, reverse iteration, and two pointers scanning from the end in O(1) extra space (*read*) · fetched 2026-10-15
- **Also good:** [Merge Two Sorted Lists](https://neetcode.io/solutions/merge-two-sorted-lists) · NeetCode · the merge by recursion and by iteration (*read*) · fetched 2026-10-15
- **Beyond the docs:** [Backspace String Comparisons: Two Ways To Approach a Common Algorithm](https://dev.to/alisabaj/the-backspace-string-compare-algorithm-3ioo) · ab (DEV Community), 2020-05-18 · the array-as-stack version and the end-to-start two-pointer version with skip counts, in JavaScript · fetched 2026-10-15 (*read*)
- **Our delta:** merging, comparing with backspaces from the end, and the intersection of two lists by switching heads, in both languages.

### T04-13 · Windows over streams — Understand · 🔲 not written
- **Read this:** [How we built rate limiting capable of scaling to millions of domains](https://blog.cloudflare.com/counting-things-a-lot-of-different-things/) · Julien Desgats, Cloudflare Blog, 2017-06-07 · estimates a rate by weighting the previous window's count by its overlap with the current one (42 × 0.75 + 18 = 49.5), assuming a constant rate in the previous period (*read*) · covers our angle: **full** on the rate window · fetched 2026-10-14
- **Also good:** [Moving average](https://en.wikipedia.org/wiki/Moving_average) · Wikipedia · the incremental moving average, with a circular buffer (*read*) · fetched 2026-10-14
- **Also good:** [Sliding window based Rate limiter](https://arpit.substack.com/p/sliding-window-based-rate-limiter) · Arpit Bhayani · per-key request counts kept per epoch second in a nested dictionary, summed over the window, with old seconds deleted (*read*) · fetched 2026-10-15
- **Our delta:** moving averages and rate windows as the bridge to the rate limiter in the System Design track.

**Gate — Phase 4:** explain why a sliding window fails on subarray sum equals k with negatives, write minimum window substring in twenty minutes, and prove the container pointer move.

---

## Phase 5 — Strings

### T05-01 · Strings in TypeScript and Java — Master · 🔲 not written
- **Read this:** [String](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String) · MDN · strings are UTF-16 code units; `length` and indexing count units, `[...s]` iterates code points, and MDN says grapheme clusters need custom code, though `Intl.Segmenter` now does it (*read*) · covers our angle: **partial** — no cost model for concatenation · fetched 2026-10-14
- **Also good:** [String](https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/lang/String.html) · Oracle Javadoc, Java 21 · strings are constants; `length` and `charAt` count `char` units, and `codePointCount` and `codePointAt` handle supplementary characters; the first 100,000 characters of the page were read (*read*) · fetched 2026-10-14
- **Our delta:** one table of immutability, code units against code points and the real cost of concatenation and character access, for both languages.

### T05-02 · Palindromes — Master · 🔲 not written
- **Read this:** [Longest Palindromic Substring](https://neetcode.io/solutions/longest-palindromic-substring) · NeetCode · brute force, dynamic programming, then a two-pointer expansion around each centre (*read*) · covers our angle: **partial** — no two-pointer check of a whole string and no partition preview · fetched 2026-10-15
- **Also good:** [Longest palindromic substring](https://en.wikipedia.org/wiki/Longest_palindromic_substring) · Wikipedia · expand around each centre in O(n²), with a separator for even lengths; Manacher's algorithm gives all radii in O(n) (*read*) · fetched 2026-10-14
- **Also good:** [Valid Palindrome](https://neetcode.io/solutions/valid-palindrome) · NeetCode · reverse and compare, then two pointers from both ends (*read*) · fetched 2026-10-15
- **Beyond the docs:** [Longest Palindromic Substring](https://www.callicoder.com/longest-palindromic-substring/) · CalliCoder, 2019-10-03, updated 2026-08-26 · Java 17; there are 2n−1 centres, so trying only odd centres misses "bb" in "cbbd", with the two off-by-ones explained · fetched 2026-10-15 (*read*)
- **Our delta:** partitions previewed for Part 6, and the check-then-expand structure for both centre kinds without a separator trick.

### T05-03 · Anagrams and frequency signatures — Master · 🔲 not written
- **Read this:** [Group Anagrams](https://neetcode.io/solutions/group-anagrams) · NeetCode · a sorted string as the key, then a 26-slot count array as the key with no sort (*read*) · covers our angle: **full** for grouping · fetched 2026-10-15
- **Also good:** [Valid Anagram](https://neetcode.io/solutions/valid-anagram) · NeetCode · sorting, a hash map, then a fixed array of counts (*read*) · fetched 2026-10-15
- **Also good:** [Find All Anagrams in a String](https://neetcode.io/solutions/find-all-anagrams-in-a-string) · NeetCode · the sliding-window anagram with two 26-slot arrays and a match counter (*read*) · fetched 2026-10-15
- **Our delta:** grouping, sliding-window anagrams, and a fixed 26-slot array against a map.

### T05-04 · Parsing problems — Master · 🔲 not written
- **Read this:** [Basic Calculator II](https://neetcode.io/solutions/basic-calculator-ii) · NeetCode · a stack that defers plus and minus (pushing negatives) while computing times and divide at once, then a version without the stack (*read*) · covers our angle: **partial** — no parentheses and no string to integer · fetched 2026-10-15
- **Also good:** [Decode String](https://neetcode.io/solutions/decode-string) · NeetCode · nested decoding by recursion, one stack or two stacks (*read*) · fetched 2026-10-15
- **Also good:** [Shunting yard algorithm](https://en.wikipedia.org/wiki/Shunting_yard_algorithm) · Wikipedia · operators on a stack, popping those of higher or equal precedence (left-associative) before pushing; linear time; it can accept some invalid input (*read*) · covers our angle: **partial** — no sign-and-stack calculator, no nested decoding · fetched 2026-10-14
- **Also good:** [Integer](https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/lang/Integer.html) · Oracle Javadoc, Java 21 · `parseInt` accepts an optional sign then decimal digits only, and throws `NumberFormatException` out of range (*read*) · fetched 2026-10-14
- **Our delta:** string to integer with overflow, the calculator with parentheses, and the stack-and-sign pattern shared by all four.

### T05-05 · Building strings efficiently — Master · 🔲 not written
- **Read this:** [StringBuilder](https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/lang/StringBuilder.html) · Oracle Javadoc, Java 21 · appends reuse the buffer until it overflows, then it grows to at least twice the old capacity plus 2; no word on `String` concatenation or amortisation (*read*) · covers our angle: **partial** · fetched 2026-10-14
- **Also good:** [String](https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/lang/String.html) · Oracle Javadoc, Java 21 · `+` is left to the compiler, which may use `StringBuilder` or `StringConcatFactory` (*read*) · fetched 2026-10-14
- **Beyond the docs:** [Back to Basics](https://www.joelonsoftware.com/2001/12/11/back-to-basics/) · Joel Spolsky, 2001-12-11 · repeated `strcat` rescans the C string's terminator each time, which he calls the Shlemiel the painter's algorithm; the cost there is the rescan, where Java copies the string instead (*read*) · fetched 2026-10-15
- **Our delta:** why concatenation in a loop is quadratic and what collect-then-join fixes, in each language.

### T05-06 · String matching — Understand · 🔲 not written
- **Read this:** [Prefix function. Knuth-Morris-Pratt](https://cp-algorithms.com/string/prefix-function.html) · cp-algorithms · defines the prefix function, derives a linear loop from a cubic one, and searches with `s + # + t` in O(n + m) (*read*) · covers our angle: **partial** — KMP only · fetched 2026-10-14
- **Also good:** [Z-function](https://cp-algorithms.com/string/z-function.html) · cp-algorithms · the Z-array, a linear algorithm with a proof, and pattern search (*read*) · fetched 2026-10-14
- **Also good:** [Rabin-Karp](https://cp-algorithms.com/string/rabin-karp.html) · cp-algorithms · hash the pattern and compare each text window in constant time, linear overall (*read*) · fetched 2026-10-14
- **Also good:** [Knuth–Morris–Pratt algorithm](https://en.wikipedia.org/wiki/Knuth%E2%80%93Morris%E2%80%93Pratt_algorithm) · Wikipedia · O(n + k) against the naive O(k·n), with the million-A's example (*read*) · fetched 2026-10-14
- **Our delta:** which of the four an interview actually expects.

### T05-07 · Compression and run-length encoding — Understand · 🔲 not written
- **Read this:** [String Compression](https://neetcode.io/solutions/string-compression) · NeetCode · extra space first, then in place with a read pointer and a write pointer, writing multi-digit counts digit by digit because the output is never longer than the input (*read*) · covers our angle: **full** · fetched 2026-10-15
- **Also good:** [Run-length encoding](https://en.wikipedia.org/wiki/Run-length_encoding) · Wikipedia · each run becomes a value and a count; data with few runs can grow (*read*) · fetched 2026-10-14
- **Our delta:** the in-place count-then-write pattern in TypeScript and Java, and the case where the encoded form grows.

### T05-08 · The small classics — Understand · 🔲 not written
- **Read this:** [Isomorphic Strings](https://neetcode.io/solutions/isomorphic-strings) · NeetCode · one-pass and two-pass hash maps; the pitfalls name the trap of checking the mapping in one direction only (*read*) · covers our angle: **partial** — string rotation is not covered · fetched 2026-10-15
- **Also good:** [Word Pattern](https://neetcode.io/solutions/word-pattern) · NeetCode · the same two-way mapping over words, with a length check (*read*) · fetched 2026-10-15
- **Also good:** [Longest Common Prefix](https://neetcode.io/solutions/longest-common-prefix) · NeetCode · horizontal and vertical scanning, sorting and compare first with last, and a trie (*read*) · fetched 2026-10-15
- **Also good:** [Subsequence](https://en.wikipedia.org/wiki/Subsequence) · Wikipedia · substring against subsequence, a distinction that matters for rotation and pattern-word problems (*read*) · fetched 2026-10-14
- **Our delta:** string rotation by searching for one string inside the doubled other, which no page above covers.

### T05-09 · Reversal problems — Understand · 🔲 not written
- **Read this:** [Reverse Words in a String](https://algomaster.io/learn/dsa/reverse-words-in-a-string) · AlgoMaster, updated 2026-08-19 · extra and leading spaces are the catch; split and reverse, then a right-to-left two-pointer scan, and it names the in-place follow-up of reversing the whole string and then each word (*read*) · covers our angle: **partial** — no mutable-array version in code in the passages read · fetched 2026-10-15
- **Also good:** [Reverse Words in a String II](https://guides.codepath.org/compsci/Reverse-Words-in-a-String-II) · CodePath · reverse the whole character list, then each word, in place with two pointers; Python (*read*) · fetched 2026-10-15
- **Also good:** [String](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String) · MDN · strings cannot be edited by assignment, which is why these problems use a character array; `split("")` breaks surrogate pairs (*read*) · covers our angle: **partial** — no algorithms · fetched 2026-10-14
- **Our delta:** words in a sentence, groups of k and vowels only, in place on a character array.

### T05-10 · Subsequence checks — Understand · 🔲 not written
- **Read this:** [Is Subsequence](https://neetcode.io/solutions/is-subsequence) · NeetCode · recursion, two dynamic programming versions, the two-pointer scan, and the many-queries follow-up that precomputes the next occurrence of each character in a table (*read*) · covers our angle: **full** for the scan and the follow-up · fetched 2026-10-15
- **Also good:** [Subsequence](https://en.wikipedia.org/wiki/Subsequence) · Wikipedia · a subsequence keeps the original order and need not be consecutive (*read*) · covers our angle: **partial** — definition only · fetched 2026-10-14
- **Our delta:** the same follow-up as buckets of positions per character with a binary search, which the page does not give, in TypeScript and Java.

### T05-11 · Unicode and locale pitfalls — Know · 🔲 not written
- **Read this:** [String.prototype.normalize()](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/normalize) · MDN · canonically equivalent strings compare unequal and differ in length until normalised; NFC against NFD, and NFKC for search (*read*) · covers our angle: **partial** — no case folding · fetched 2026-10-14
- **Also good:** [Intl.Collator](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/Collator) · MDN · the same strings sort differently by locale (German against Swedish ä) (*read*) · fetched 2026-10-14
- **Also good:** [String.prototype.localeCompare()](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/localeCompare) · MDN · do not rely on return values of -1 or 1; `numeric` option; reuse a collator for large sorts (*read*) · fetched 2026-10-14
- **Also good:** [Intl.Segmenter](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/Segmenter) · MDN · splits a string into graphemes, words or sentences by locale, the built-in answer for user-perceived characters; Baseline 2024 (*read*) · fetched 2026-10-15
- **Also good:** [Unicode equivalence](https://en.wikipedia.org/wiki/Unicode_equivalence) · Wikipedia · canonical against compatibility equivalence and normalisation mismatch between systems (*read*) · fetched 2026-10-14
- **Beyond the docs:** [The Absolute Minimum Every Software Developer Must Know About Unicode](https://www.joelonsoftware.com/2003/10/08/the-absolute-minimum-every-software-developer-absolutely-positively-must-know-about-unicode-and-character-sets-no-excuses/) · Joel Spolsky, 2003-10-08 · code points against encodings, and UTF-8 as bytes; dated, as it says UTF-8 uses up to six bytes where the current limit is four (*read*) · fetched 2026-10-15
- **Our delta:** when the interviewer means bytes and when they mean characters. The sources cover normalisation and collation but not case folding.

### T05-12 · String hashing — Know · 🔲 not written
- **Read this:** [String Hashing](https://cp-algorithms.com/string/string-hashing.html) · cp-algorithms · polynomial hash, a prime base near the alphabet size, a large prime modulus, why not 2^64, and double hashing (about 10^-6 against 10^-3 collision chance for 10^6 strings) (*read*) · covers our angle: **partial** — no caches or deduplication · fetched 2026-10-14
- **Also good:** [Hashing](https://usaco.guide/gold/hashing) · USACO Guide · a prefix-hash template for substring hashes, collision bounds, the birthday-paradox warning to use a larger modulus, and a random base against hacks (*read*) · fetched 2026-10-15
- **Also good:** [Rolling hash](https://en.wikipedia.org/wiki/Rolling_hash) · Wikipedia · polynomial rolling hash against Rabin fingerprint; at best pairwise independent (*read*) · fetched 2026-10-14
- **Our delta:** where it reappears in caches and deduplication.

### T05-13 · The string problems that are really DP — Know · 🔲 not written
- **Read this:** [Edit distance](https://en.wikipedia.org/wiki/Edit_distance) · Wikipedia · naive recursion is exponential; Wagner–Fischer is Θ(mn) time, space reducible to Θ(min(m,n)) with two rows (*read*) · covers our angle: **partial** — no regular-expression matching · fetched 2026-10-14
- **Also good:** [Longest common subsequence](https://en.wikipedia.org/wiki/Longest_common_subsequence) · Wikipedia · optimal substructure and overlapping subproblems, O(n × m) time (*read*) · fetched 2026-10-14
- **Also good:** [Edit Distance](https://neetcode.io/solutions/edit-distance) · NeetCode · recursion, top-down and bottom-up dynamic programming, then space-optimised versions (*read*) · fetched 2026-10-15
- **Also good:** [Regular Expression Matching](https://neetcode.io/solutions/regular-expression-matching) · NeetCode · the dot and star recurrence from recursion up to a space-optimised table (*read*) · covers our angle: **full** for regex matching · fetched 2026-10-15
- **Our delta:** named here and solved in Part 6.

**Gate — Phase 5:** the calculator, group-anagrams and longest-palindromic-substring from memory in both languages, plus the quadratic string-build explanation. Links above cover the last part only.
