---
title: "Link map · DSA · Part 2 (phases 3–5)"
sidebar_label: "02 · arrays strings hashing"
sidebar_position: 2
---

# Link map · DSA · Part 2 (phases 3–5)

Covers every topic row of phases 3, 4 and 5 in `docs/dsa/syllabus/02-arrays-strings-and-hashing.md`: arrays, hashing and prefix sums (T03-01 to T03-16), two pointers and sliding window (T04-01 to T04-13), and strings (T05-01 to T05-13). That is 42 rows. No page of ours covers any of them yet (our pages stop at phase 2), so every block is `🔲 not written`.
*read* = I read the passage that supports the claim; *headings only* = fetched at 200, headings or opening checked. Third-party links carry a date only where the page shows one. No `#anchors` are given. "Official" here means canonical references (MDN, the Java SE 25 API docs, Wikipedia, cp-algorithms). Where no good non-official explanation turned up, the block has no "Beyond the docs" line. Our solutions are TypeScript first, Java second; picks are language-neutral unless a block says otherwise. Many "Beyond" picks are interview-prep sites, so their code was not run.

---

## Phase 3 — Arrays, hashing and prefix sums

### T03-01 · Hash maps and sets, with their costs — Master · 🔲 not written
- **Read this:** [Map](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map) · MDN · the "Objects vs. Maps" table: any key type against string or symbol, insertion-order iteration, `size` (*read*) · covers our angle: **partial** — JavaScript only · fetched 2026-10-14
- **Also good:** [HashMap](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/util/HashMap.html) · Java SE 25 API · constant-time `get` and `put` only if the hash disperses; keys found by `equals`; no iteration-order guarantee; many equal hash codes slow it down (*read*) · fetched 2026-10-14. Also [Object](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/lang/Object.html) for the `hashCode` contract: equal objects must give equal hash codes, unequal ones need not differ (*read*)
- **Beyond the docs:** [map vs object](https://30secondsofcode.org/js/s/map-vs-object) · 30 seconds of code, 2022-02-13 · short list of the practical differences, including prototype keys and `clear()` · fetched 2026-10-14 (*read*)
- **Our delta:** why average O(1) is an expectation, and the `equals`/`hashCode` failure demo in Java.

### T03-02 · Frequency counting and the two-sum family — Master · 🔲 not written
- **Read this:** [Hash table](https://en.wikipedia.org/wiki/Hash_table) · Wikipedia · load factor, expected Θ(1) search/insert/delete, collision handling (*read*, first 100000 characters) · covers our angle: **partial** — the structure behind the trick, not the trick · fetched 2026-10-14
- **Beyond the docs:** [1. Two Sum](https://neetcode.io/solutions/two-sum) · NeetCode · the one-pass map: compute the complement, look it up before inserting, so no element pairs with itself · fetched 2026-10-14 (*read*)
- **Our delta:** anagrams as frequency signatures and counting pairs, which the page above does not cover (see T05-03 for the anagram side).

### T03-03 · Prefix sums — Master · 🔲 not written
- **Read this:** [Summed-area table](https://en.wikipedia.org/wiki/Summed-area_table) · Wikipedia · the 2D prefix table; any rectangle sum from exactly four lookups (*read*) · covers our angle: **partial** — 2D only; the Wikipedia "Prefix sum" article is about scans and parallel algorithms, not range queries · fetched 2026-10-14
- **Beyond the docs:** [560. Subarray Sum Equals K](https://neetcode.io/solutions/subarray-sum-equals-k) · NeetCode · map of prefix counts, seeded with 0 to count subarrays starting at index 0, lookup before insert · fetched 2026-10-14 (*read*)
- **Also good:** [Prefix Sum Technique on LeetCode](https://dev.to/alex_hunter_44f4c9ed6671e/prefix-sum-technique-on-leetcode-for-beginners-from-intuition-to-patterns-98c) · Alex Hunter, DEV Community, 2025-12-10 · range sums as `prefix[R+1] - prefix[L]`, works with negatives (*read*) · fetched 2026-10-14
- **Our delta:** the 1D range query and the proof that the map version counts each subarray once.

### T03-04 · Kadane's algorithm — Master · 🔲 not written
- **Read this:** [Maximum subarray problem](https://en.wikipedia.org/wiki/Maximum_subarray_problem) · Wikipedia · Kadane with and without empty subarrays, O(n) time and O(1) space (*read*) · covers our angle: **partial** — no circular or product variant · fetched 2026-10-14
- **Beyond the docs:** [How Kadane's algorithm finds the maximum subarray in one pass](https://www.techinterview.org/post/3233476879/kadanes-algorithm-maximum-subarray/) · techinterview.org, 2026-07-27 · reset when the running sum goes negative; circular = max of plain Kadane and total minus the minimum subarray (all-negative fallback); product needs a running max and min (*read*) · fetched 2026-10-14
- **Our delta:** the reset proof and the sign-flip argument in code.

### T03-05 · The Dutch national flag — Master · 🔲 not written
- **Read this:** [Dutch national flag problem](https://en.wikipedia.org/wiki/Dutch_national_flag_problem) · Wikipedia · Dijkstra's three-index pseudocode and the four-region invariant (*read*) · covers our angle: **full** for the partition; sort colours and move zeroes are named only as uses · fetched 2026-10-14
- **Beyond the docs:** [Dutch National Flag](https://allisons.org/ll/AlgDS/Sort/Flag/) · L. Allison, Monash University, undated · derives the two-colour then three-colour version from invariants, notes why the swapped-in value from the high end is not advanced past · fetched 2026-10-14 (*read*)
- **Our delta:** sort colours and move zeroes as two applications.

### T03-06 · Cyclic sort and index-as-hash — Master · 🔲 not written
- **Read this:** [5.1. Cyclic Sort](https://algorithm-spices.readthedocs.io/en/latest/patterns_for_coding_questions/cyclic_sort/) · Algorithm Spices · swap each value to index value-1 in O(n) time and O(1) space; missing, duplicate and corrupt-pair variants (*read*) · covers our angle: **full** — not an official source, but the best structured one found · fetched 2026-10-14
- **Also good:** [Array](https://www.techinterviewhandbook.org/algorithms/array/) · Tech Interview Handbook · "index as a hash key": negate the value at an index to mark presence (*read*) · fetched 2026-10-14
- **Our delta:** why the swap loop is still linear, and the sign-marking alternative that avoids reordering.

### T03-07 · In-place operations — Master · 🔲 not written
- **Read this:** [Coding Interview: Array Problems Comprehensive Guide](https://www.techinterview.org/post/3233474355/coding-interview-array-problems-comprehensive-guide-two-sum-sliding-window-kadane-rotation-merge-intervals-meeting-rooms/) · techinterview.org, 2026-04-20 · rotate by three reversals, slow/fast pointer dedupe of a sorted array (*read*) · covers our angle: **partial** — nothing on merging from the back · fetched 2026-10-14
- **Our delta:** merge sorted arrays from the back (write position never overtakes the unread part of the first array); the in-place dedupe invariant.

### T03-08 · Intervals — Master · 🔲 not written
- **Read this:** [Interval and Sweep Line Patterns](https://www.techinterview.org/post/3233474289/coding-interview-interval-sweep-line-patterns-meeting-rooms-skyline-problem-event-processing-coordinate-compression/) · techinterview.org, 2026-04-20 · Meeting Rooms II as +1/-1 events, sorted, process the end first on a tie; says it equals the heap version but does not walk through the heap (*read*) · covers our angle: **partial** — merge and insert intervals are only linked out · fetched 2026-10-14
- **Also good:** [Sweep line algorithm](https://en.wikipedia.org/wiki/Sweep_line_algorithm) · Wikipedia · the geometric origin; never mentions intervals (*read*) · fetched 2026-10-14
- **Our delta:** merge, insert and the heap version, all with the sort-by-start proof.

### T03-09 · "Sort, then …" and "hash, then …" — Master · 🔲 not written
- **Read this:** [Array](https://www.techinterviewhandbook.org/algorithms/array/) · Tech Interview Handbook · "ask whether sorting first would simplify the problem", but do not sort if original order matters; precomputation with hashing or prefix sums (*read*) · covers our angle: **partial** — a checklist, no decision rule from constraints · fetched 2026-10-14
- **Our delta:** the constraint-driven rule (n, value range, follow-up wants O(1) space). Searched for a source naming "hash then sort" as a two-opening rule; none found.

### T03-10 · Difference arrays — Understand · 🔲 not written
- **Read this:** [Difference array technique](https://dev.to/thetenthman/difference-array-technique-4n5a) · TheTenthMan, DEV Community, 2025-11-16 · add at the left index, subtract just past the right, prefix-sum to rebuild; worked example (*read*) · covers our angle: **partial** — its practice answer looks wrong by one update, so do not copy it · fetched 2026-10-14
- **Our delta:** the booking-count trick, the `n + 1` size, and why it is the inverse of a prefix sum. Codeforces and GeeksforGeeks explainers refused scripted fetches and are not cited.

### T03-11 · Sorting-based approaches — Understand · 🔲 not written
- **Read this:** [Array.prototype.sort()](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/sort) · MDN · comparator contract, stable since ES2019, default sort is by UTF-16 string order (so `[40, 1, 5, 200]` sorts wrongly) (*read*) · covers our angle: **partial** — JavaScript only · fetched 2026-10-14
- **Beyond the docs:** [Sorting Algorithms for Interviews](https://www.techinterview.org/post/3233466068/sorting-algorithms-interview/) · techinterview.org, 2026-04-17 · stable versus unstable sorts, why stability matters for multi-key sorts (*read*; it has no real comparator section) · fetched 2026-10-14
- **Our delta:** custom comparators for "sort then scan" problems; Java `Arrays.sort` on primitives versus objects.

### T03-12 · Matrices — Understand · 🔲 not written
- **Read this:** [Set Matrix Zeroes](https://neetcode.io/solutions/set-matrix-zeroes) · NeetCode · first row and column as markers, a separate flag for row 0, update those two last (*read*) · covers our angle: **partial** · fetched 2026-10-14
- **Also good:** [Spiral Matrix](https://neetcode.io/solutions/spiral-matrix) · NeetCode · four shrinking boundaries and the check that stops a duplicate pass on a single row or column (*read*) · fetched 2026-10-14. [Rotate Image](https://dev.to/rohithv07/leetcode-48-rotate-image-4kmo) · Rohith V, DEV Community, 2021-11-25 · transpose then reverse each row, O(1) space (*read*)
- **Our delta:** search in a sorted matrix and diagonal traversal are not covered by these.

### T03-13 · Product except self — Understand · 🔲 not written
- **Read this:** [238. Product of Array Except Self](https://neetcode.io/solutions/product-of-array-except-self) · NeetCode · prefix and suffix arrays, then folding them into the output array with two running variables (*read*) · covers our angle: **full** · fetched 2026-10-14
- **Our delta:** the zero-handling argument for why division fails.

### T03-14 · Majority element and voting — Understand · 🔲 not written
- **Read this:** [Boyer–Moore majority vote algorithm](https://en.wikipedia.org/wiki/Boyer%E2%80%93Moore_majority_vote_algorithm) · Wikipedia · one candidate, one counter, and the second pass needed to confirm a majority (*read*) · covers our angle: **partial** — the n/3 generalisation is only named (Misra–Gries) · fetched 2026-10-14
- **Beyond the docs:** [229. Majority Element II](https://neetcode.io/solutions/majority-element-ii) · NeetCode · two candidates, check for an existing match before filling an empty slot, mandatory verification pass (*read*) · fetched 2026-10-14
- **Our delta:** the cancellation proof.

### T03-15 · Longest consecutive sequence and set tricks — Understand · 🔲 not written
- **Read this:** [Set](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Set) · MDN · membership is sublinear on average, insertion order, a deleted-then-re-added item goes to the end (*read*) · covers our angle: **partial** — the data structure, not the trick · fetched 2026-10-14
- **Beyond the docs:** [Longest Consecutive Sequence](https://dev.to/tammyvocs/longest-consecutive-sequence-234i) · Tammy Vo, DEV Community, 2022-07-21 · count upward only from a number whose left neighbour is missing, which keeps the total linear (*read*) · fetched 2026-10-14
- **Our delta:** the amortised argument stated precisely.

### T03-16 · Problems over two arrays — Know · 🔲 not written
- **Read this:** [Kth element of two sorted arrays](https://workat.tech/problem-solving/editorial/kth-two-sorted/index.html) · workat.tech · concatenate and sort, versus discarding k/2 from one array per step; the editorial states O(log(n x m)) (*read*) · covers our angle: **partial** — no intersection or merge, and the median is only implied · fetched 2026-10-14
- **Our delta:** intersection and merge with two pointers; the median previewed for Part 3.

---

## Phase 4 — Two pointers and sliding window

### T04-01 · Opposite-direction pointers — Master · 🔲 not written
- **Read this:** [Two Pointers Technique](https://archman.dev/docs/algorithms-and-data-structures/arrays-and-strings/two-pointers) · archman.dev, undated (2026 footer) · pointers at both ends, each move rules out a block of candidates, so O(n) over O(n^2) (*read*) · covers our angle: **partial** — no explicit invariant · fetched 2026-10-14
- **Our delta:** the invariant stated outright (every pair outside the window is already ruled out), and palindromes.

### T04-02 · Same-direction pointers — Master · 🔲 not written
- **Read this:** [Two Pointers Technique](https://archman.dev/docs/algorithms-and-data-structures/arrays-and-strings/two-pointers) · archman.dev · same-direction section, "Remove Duplicates In-Place" among the headings (*read*) · covers our angle: **partial** · fetched 2026-10-14
- **Also good:** [Coding Interview: Array Problems Comprehensive Guide](https://www.techinterview.org/post/3233474355/coding-interview-array-problems-comprehensive-guide-two-sum-sliding-window-kadane-rotation-merge-intervals-meeting-rooms/) · techinterview.org · slow marks the write position, fast scans (*read*) · fetched 2026-10-14
- **Our delta:** remove element and move zeroes as one reader/writer pattern. A dedicated lesson page (AlgoMaster) loaded only as an index, so it is not cited.

### T04-03 · Fast and slow pointers — Master · 🔲 not written
- **Read this:** [Cycle detection](https://en.wikipedia.org/wiki/Cycle_detection) · Wikipedia · Floyd's algorithm: find the meeting point, reset one pointer, step together to find the cycle start; O(1) storage (*read*) · covers our angle: **partial** — no linked-list middle or duplicate-number framing · fetched 2026-10-14
- **Beyond the docs:** [Find the Duplicate Number](https://www.techinterview.org/post/3233474785/find-duplicate-floyd-cycle-detection/) · techinterview.org, 2026-05-01 · treats `i -> a[i]` as a linked list; two indices with one value merge into a tail into a cycle, and the entry is the duplicate (*read*) · fetched 2026-10-14
- **Our delta:** the middle of a list and the proof for the reset step.

### T04-04 · 3-sum and 4-sum — Master · 🔲 not written
- **Read this:** [18. 4Sum](https://neetcode.io/solutions/4sum) · NeetCode · sort, fix two, two pointers, skip duplicates at each level and after a match; a recursive k-sum; 64-bit sums (*read*) · covers our angle: **full** for 4-sum, 3-sum follows by dropping one loop · fetched 2026-10-14
- **Our delta:** the O(n^2) 3-sum count and where duplicates get skipped.

### T04-05 · Container with most water and trapping rain water — Master · 🔲 not written
- **Read this:** [Container With Most Water](https://dev.to/steadbytes/container-with-most-water-3ige) · Ben Steadman, DEV Community (from steadbytes.com), 2020-06-11 · moving the shorter side loses nothing because height is capped by the shorter line (*read*) · covers our angle: **partial** — container only; I found no clean trapping-rain-water source · fetched 2026-10-14
- **Our delta:** trapping rain water with left-max and right-max pointers.

### T04-06 · Fixed-size windows — Master · 🔲 not written
- **Read this:** [Sliding Window Interview Patterns](https://www.techinterview.org/post/3233460634/sliding-window-interview-patterns/) · techinterview.org, 2026-04-16 · build the first window, then add the new element and drop the outgoing one; maximum sum and anagram examples (*read*) · covers our angle: **full** · fetched 2026-10-14
- **Our delta:** the anagram window with a counts array (see T05-03).

### T04-07 · Variable-size windows — Master · 🔲 not written
- **Read this:** [Variable-Size Sliding Window](https://codemia.io/courses/dsa_fundamentals/variable_size_sliding_window) · Codemia · expand right, shrink left while invalid; works only if adding elements never makes the condition easier; at most about 2n pointer moves (*read*) · covers our angle: **full** · fetched 2026-10-14
- **Also good:** [Sliding Window Interview Patterns](https://www.techinterview.org/post/3233460634/sliding-window-interview-patterns/) · techinterview.org · longest substring without repeats as the example (*read*) · fetched 2026-10-14
- **Our delta:** the last-seen-index jump for no-repeat substrings.

### T04-08 · Minimum window substring — Master · 🔲 not written
- **Read this:** [The coverage counter behind Minimum Window Substring](https://www.techinterview.org/post/3233476884/coverage-counter-minimum-window-substring/) · techinterview.org, 2026-07-28 · one `missing` integer instead of comparing two maps; counts may go negative, meaning a surplus copy (*read*) · covers our angle: **full** (it uses "missing" where we say have/need) · fetched 2026-10-14
- **Our delta:** the have/need variant and its classic mistake of comparing counts on the wrong event.

### T04-09 · Sliding-window maximum — Master · 🔲 not written
- **Read this:** [Monotonic Queue to Solve Sliding Window Problems](https://labuladong.online/en/algo/data-structure/monotonic-queue/) · labuladong · push pops smaller tail items, `max()` is the head, `pop` removes the head only if equal; linear because each element enters and leaves once (*read*) · covers our angle: **full** · fetched 2026-10-14
- **Our delta:** the deque of indices (not values) version used in TypeScript.

### T04-10 · Recognising a window — Master · 🔲 not written
- **Read this:** [Prefix Sum Technique on LeetCode](https://dev.to/alex_hunter_44f4c9ed6671e/prefix-sum-technique-on-leetcode-for-beginners-from-intuition-to-patterns-98c) · Alex Hunter, DEV Community, 2025-12-10 · sliding window fits when sums move monotonically (non-negative values); with negatives use prefix sums (*read*) · covers our angle: **full** for the decision · fetched 2026-10-14
- **Also good:** [Variable-Size Sliding Window](https://codemia.io/courses/dsa_fundamentals/variable_size_sliding_window) · Codemia · the monotone-condition rule (*read*) · fetched 2026-10-14
- **Our delta:** a one-page decision table.

### T04-11 · The "at most k" trick — Understand · 🔲 not written
- **Read this:** [992. Subarrays with K Different Integers](https://neetcode.io/solutions/subarrays-with-k-different-integers) · NeetCode · exactly k = at most k minus at most k-1; add `r - l + 1` per right end; worked example 12 - 5 = 7 (*read*) · covers our angle: **full** · fetched 2026-10-14
- **Our delta:** why `r - l + 1` counts each subarray once.

### T04-12 · Two pointers on linked lists and strings — Understand · 🔲 not written
- **Read this:** [The Backspace String Compare Algorithm](https://dev.to/alisabaj/the-backspace-string-compare-algorithm-3ioo) · ab (a_b_102931), DEV Community, 2020-05-18 · scan from the end with a skip counter per string, O(1) space (*read*) · covers our angle: **partial** · fetched 2026-10-14
- **Also good:** [Intersection of Two Linked Lists](https://www.interviewbit.com/blog/intersection-of-two-linked-lists/) · InterviewBit · each pointer switches to the other list's head at the end, so both walk the same distance (*read*) · fetched 2026-10-14
- **Our delta:** merging two sorted lists.

### T04-13 · Windows over streams — Understand · 🔲 not written
- **Read this:** [Sliding Window Rate Limiting](https://arpitbhayani.me/blogs/sliding-window-ratelimiter) · Arpit Bhayani, undated (2026 footer) · per-key request counts over the last window, drop old entries, coarser buckets for long windows, concurrency and deletion races (*read*) · covers our angle: **partial** — a log-style limiter; no moving-average code · fetched 2026-10-14
- **Our delta:** moving average from a stream, and the link to the System Design rate-limiter chapter.

---

## Phase 5 — Strings

### T05-01 · Strings in TypeScript and Java — Master · 🔲 not written
- **Read this:** [String (JavaScript)](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String) · MDN · strings are sequences of UTF-16 code units; indexes are code-unit indexes; `[...s]` iterates by code point (*read*) · covers our angle: **partial** — immutability is implied, never stated · fetched 2026-10-14
- **Also good:** [String (Java SE 25)](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/lang/String.html) · Java SE 25 API · "Strings are constant"; `length()` counts `char` units, `codePointCount` counts code points; `+` may compile to `StringBuilder` or `StringConcatFactory` (*read*, first 100000 characters) · fetched 2026-10-14
- **Our delta:** the real cost of concatenation and of character access in each language.

### T05-02 · Palindromes — Master · 🔲 not written
- **Read this:** [Longest palindromic substring](https://en.wikipedia.org/wiki/Longest_palindromic_substring) · Wikipedia · quadratic centre expansion (separator trick for even lengths) and Manacher's linear algorithm with its three mirror cases (*read*) · covers our angle: **full** for the substring problem; palindrome partitions are not covered · fetched 2026-10-14
- **Our delta:** the two-pointer check, and a note that interviews expect centre expansion, not Manacher.

### T05-03 · Anagrams and frequency signatures — Master · 🔲 not written
- **Read this:** [49. Group Anagrams](https://neetcode.io/solutions/group-anagrams) · NeetCode · sorted-string key O(m n log n) against a 26-slot count key O(m n); the count key only works for lowercase a to z (*read*) · covers our angle: **full** · fetched 2026-10-14
- **Also good:** [Sliding Window Interview Patterns](https://www.techinterview.org/post/3233460634/sliding-window-interview-patterns/) · techinterview.org · anagrams of a pattern as a fixed window (*read*) · fetched 2026-10-14
- **Our delta:** when to prefer a Map over the 26-slot array (any alphabet).

### T05-04 · Parsing problems — Master · 🔲 not written
- **Read this:** [String to Integer (atoi)](https://docs.vultr.com/problem-set/string-to-integer-atoi) · Vultr Docs · skip spaces, one optional sign, digits until a non-digit, clamp to 32 bits (check before adding each digit) (*read*) · covers our angle: **partial** · fetched 2026-10-14
- **Beyond the docs:** [How to Implement a Calculator](https://labuladong.online/algo/en/data-structure/implement-calculator/) · labuladong · stack of numbers, pending sign; `*` and `/` fold into the stack top, final answer is the sum (*read*; its parentheses section did not load) · fetched 2026-10-14
- **Our delta:** nested decode-string and parentheses.

### T05-05 · Building strings efficiently — Master · 🔲 not written
- **Read this:** [StringBuilder](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/lang/StringBuilder.html) · Java SE 25 API · mutable sequence, default capacity 16, new capacity is the larger of the request and twice the old plus 2 (*read*) · covers our angle: **partial** — never says "amortised" · fetched 2026-10-14
- **Beyond the docs:** [Pitfall - String concatenation in a loop does not scale](https://essential-books.onrender.com/essential/java/pitfall-string-concatenation-in-a-loop-does-not-scale-ccba3fe12ff9441297aee4e4b09afb8c.html) · Java Essential Books (no author or date shown) · copies O(M x N^2) characters in a loop; builder declared outside the loop grows O(log N) times (*read*) · fetched 2026-10-14. Java-specific; for JavaScript, collect into an array and `join` once.
- **Our delta:** the JavaScript array-join pattern and why engines hide some of the cost.

### T05-06 · String matching — Understand · 🔲 not written
- **Read this:** [Prefix function - Knuth-Morris-Pratt](https://cp-algorithms.com/string/prefix-function.html) · cp-algorithms · definition, linear construction, search through `s + # + t`, and why total fallbacks are bounded by n (*read*) · covers our angle: **full** for KMP · fetched 2026-10-14
- **Also good:** [Z-function](https://cp-algorithms.com/string/z-function.html) · cp-algorithms · linear build by tracking the rightmost match segment (*read*) · fetched 2026-10-14
- **Beyond the docs:** [String Matching Algorithm Interview Patterns](https://www.techinterview.org/post/3233465044/string-matching-algorithms-interview-patterns/) · techinterview.org, 2026-04-17 · KMP is the one most asked, Rabin-Karp for multi-pattern, the naive O(nm) often enough (*read*) · fetched 2026-10-14
- **Our delta:** Rabin-Karp is covered at T05-12.

### T05-07 · Compression and run-length encoding — Understand · 🔲 not written
- **Read this:** [Run-length encoding](https://en.wikipedia.org/wiki/Run-length_encoding) · Wikipedia · lossless runs as value plus count; can expand data with few runs (*read*) · covers our angle: **partial** — the concept, not the in-place array version · fetched 2026-10-14
- **Beyond the docs:** [In-place Run-Length String Compressions using C++](https://helloacm.com/in-place-run-length-string-compressions-using-c/) · helloacm.com, 2019-06-15 · reader and writer pointers; count digits written reversed then fixed; C++ (*read*) · fetched 2026-10-14
- **Our delta:** why the writer never overtakes the reader.

### T05-08 · The small classics — Understand · 🔲 not written
- **Read this:** [14. Longest Common Prefix](https://neetcode.io/solutions/longest-common-prefix) · NeetCode · horizontal, vertical, sort and trie approaches; edge cases: empty string, one string a prefix of the rest (*read*) · covers our angle: **partial** — nothing on rotation, isomorphic strings or word patterns · fetched 2026-10-14
- **Our delta:** the two-way mapping trap for isomorphic strings and word pattern, and rotation as a search in the doubled string. An AlgoMaster page for isomorphic strings loaded only as an index and is not cited.

### T05-09 · Reversal problems — Understand · 🔲 not written
- **Read this:** [Reverse Words in a Sentence](https://www.educative.io/courses/coderust-hacking-the-coding-interview/reverse-words-in-a-sentence) · Educative · reverse the whole buffer, then each word, O(n) time and O(1) space (*read*) · covers our angle: **partial** · fetched 2026-10-14
- **Also good:** [Reverse Vowels of a String](https://docs.vultr.com/problem-set/reverse-vowels-of-a-string) · Vultr Docs · two pointers skip non-vowels, swap, move inward (*read*) · fetched 2026-10-14
- **Our delta:** reversing in groups of k.

### T05-10 · Subsequence checks — Understand · 🔲 not written
- **Read this:** [Is Subsequence](https://neetcode.io/solutions/is-subsequence) · NeetCode · advance `j` always, `i` on a match; follow-up table of next index per letter, built in O(26 m), each query O(n) (*read*) · covers our angle: **full** (bucketing by next character is the table version) · fetched 2026-10-14
- **Our delta:** the sorted-index-lists plus binary-search variant, which trades memory for O(log m) per step.

### T05-11 · Unicode and locale pitfalls — Know · 🔲 not written
- **Read this:** [String.prototype.normalize()](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/normalize) · MDN · one character as one code point or two (`ñ` as `U+00F1` or `n` plus `U+0303`): unequal under `===` with lengths 1 and 2 until normalised (*read*) · covers our angle: **partial** · fetched 2026-10-14
- **Also good:** [String.prototype.localeCompare()](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/localeCompare) · MDN · German and Swedish order `ä` differently; reuse one `Intl.Collator` when sorting (*read*) · fetched 2026-10-14
- **Beyond the docs:** [JavaScript Strings, Unicode for the Modern Web ch. 3](https://unicodefyi.com/series/modern-web/javascript-strings/) · unicodefyi.com, 2025-06-16, updated 2026-01-22 · `.length` counts code units; `[...s]` counts code points; `Intl.Segmenter` for grapheme clusters (*read*) · fetched 2026-10-14
- **Our delta:** case folding versus `toLowerCase`, and bytes versus characters in an interview.

### T05-12 · String hashing — Know · 🔲 not written
- **Read this:** [String Hashing](https://cp-algorithms.com/string/string-hashing.html) · cp-algorithms · polynomial hash, base near the alphabet size, a large prime modulus (avoid 2^64), collision odds, double hashing (*read*) · covers our angle: **full** · fetched 2026-10-14
- **Beyond the docs:** [String Hashing Interview Patterns](https://www.techinterview.org/post/3233465584/string-hashing-interview-patterns/) · techinterview.org, 2026-04-17 · rolling hash, about 1/MOD false match per comparison, verify matches, problems such as repeated DNA sequences (*read*) · fetched 2026-10-14
- **Our delta:** caches and deduplication use cases.

### T05-13 · The string problems that are really DP — Know · 🔲 not written
- **Read this:** [Edit distance](https://en.wikipedia.org/wiki/Edit_distance) · Wikipedia · the Levenshtein recurrence (diagonal on a match; else min of delete, insert, substitute), Θ(mn) time, two rows for the value only (*read*) · covers our angle: **partial** — edit distance only · fetched 2026-10-14
- **Also good:** [Longest common subsequence](https://en.wikipedia.org/wiki/Longest_common_subsequence) · Wikipedia · the match/mismatch recurrence, O(nm) time (*read*) · fetched 2026-10-14
- **Our delta:** regular-expression matching (no good source found in this pass); all three are only named here and solved in Part 6.
