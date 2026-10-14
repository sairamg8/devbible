---
title: "Link map · DSA · Part 2 (phases 3-5), file 2"
sidebar_label: "02 · arrays, strings, hashing (2)"
sidebar_position: 2
---

# Link map · DSA · Part 2 · file 2

Covers rows T04-01 to T04-13 (phase 4, two pointers and sliding window). No page of ours covers these rows yet, so every block is marked not written.
*read* means I read the passage; *headings only* means the page was fetched at HTTP 200 and its title and headings or key terms were checked.

### T04-01 · Opposite-direction pointers — Master · 🔲 not written
- **Read this:** [Two Pointers](https://usaco.guide/silver/two-pointers) · USACO Guide · the sorted-array pair search and why one pointer moves · covers our angle: **partial** - palindromes are not featured · fetched 2026-10-14 (*read*)
- **Also good:** [Two Sum II Input Array Is Sorted](https://neetcode.io/solutions/two-sum-ii-input-array-is-sorted) · NeetCode · the canonical opposite-pointer problem · fetched 2026-10-14
- **Also good:** [Valid Palindrome](https://neetcode.io/solutions/valid-palindrome) · NeetCode · the palindrome check · fetched 2026-10-14

### T04-02 · Same-direction pointers — Master · 🔲 not written
- **Read this:** [Remove Duplicates From Sorted Array](https://neetcode.io/solutions/remove-duplicates-from-sorted-array) · NeetCode · the reader and writer compaction · covers our angle: **partial** - one problem, not the pattern · fetched 2026-10-14 (*read*)
- **Also good:** [Move Zeroes](https://neetcode.io/solutions/move-zeroes) · NeetCode · compacting while keeping order · fetched 2026-10-14
- **Our delta:** the reader and writer invariant stated once for all removal problems.

### T04-03 · Fast and slow pointers — Master · 🔲 not written
- **Read this:** [Cycle detection](https://en.wikipedia.org/wiki/Cycle_detection) · Wikipedia · Floyd's tortoise and hare, with the steps that locate the cycle start and length · covers our angle: **partial** - the duplicate-number framing is elsewhere · fetched 2026-10-14 (*read*)
- **Also good:** [Find The Duplicate Number](https://neetcode.io/solutions/find-the-duplicate-number) · NeetCode · the array seen as a linked list · fetched 2026-10-14
- **Also good:** [Linked List Cycle](https://neetcode.io/solutions/linked-list-cycle) · NeetCode · detection only · fetched 2026-10-14

### T04-04 · 3-sum and 4-sum — Master · 🔲 not written
- **Read this:** [3Sum](https://neetcode.io/solutions/3sum) · NeetCode · sort, fix one, two pointers, skipping duplicates · covers our angle: full · fetched 2026-10-14 (*read*)
- **Also good:** [4Sum](https://neetcode.io/solutions/4sum) · NeetCode · the same idea one level deeper and the k-sum generalisation · fetched 2026-10-14

### T04-05 · Container with most water and trapping rain water — Master · 🔲 not written
- **Read this:** [Container With Most Water](https://neetcode.io/solutions/container-with-most-water) · NeetCode · greedy pointer move on the shorter line · covers our angle: **partial** - it argues why the shorter pointer moves, but does not extend it to trapping rain water · fetched 2026-10-14 (*read*)
- **Also good:** [Trapping Rain Water](https://neetcode.io/solutions/trapping-rain-water) · NeetCode · prefix maxima, stack and two-pointer versions · fetched 2026-10-14
- **Beyond the docs:** [Container with Most Water](https://dev.to/steadbytes/container-with-most-water-3ige) · steadbytes (DEV) · an article built around a proof that moving the taller pointer can never help · fetched 2026-10-14 (*read*)
- **Our delta:** the same proof idea applied to trapping rain water.

### T04-06 · Fixed-size windows — Master · 🔲 not written
- **Read this:** [Permutation In String](https://neetcode.io/solutions/permutation-in-string) · NeetCode · a fixed window with a 26-slot count array, slid one step at a time · covers our angle: **partial** - running sums and maximum average are not shown · fetched 2026-10-14 (*read*)
- **Also good:** [Find All Anagrams in a String](https://neetcode.io/solutions/find-all-anagrams-in-a-string) · NeetCode · the anagram window, first via prefix counts and then the slide-and-update version · fetched 2026-10-14

### T04-07 · Variable-size windows — Master · 🔲 not written
- **Read this:** [Longest Substring Without Repeating Characters](https://neetcode.io/solutions/longest-substring-without-repeating-characters) · NeetCode · expand then shrink with a set or map · covers our angle: **partial** - sum-based shrinking is another page · fetched 2026-10-14 (*read*)
- **Also good:** [Minimum Size Subarray Sum](https://neetcode.io/solutions/minimum-size-subarray-sum) · NeetCode · the shortest window with a sum condition · fetched 2026-10-14
- **Also good:** [Longest Repeating Character Replacement](https://neetcode.io/solutions/longest-repeating-character-replacement) · NeetCode · a window whose validity is a formula · fetched 2026-10-14

### T04-08 · Minimum window substring — Master · 🔲 not written
- **Read this:** [Minimum Window Substring](https://neetcode.io/solutions/minimum-window-substring) · NeetCode · the have-versus-need counters and when to shrink · covers our angle: full · fetched 2026-10-14 (*read*)

### T04-09 · Sliding-window maximum — Master · 🔲 not written
- **Read this:** [Sliding Window Maximum](https://neetcode.io/solutions/sliding-window-maximum) · NeetCode · heap first, then the deque of indices and why it is linear · covers our angle: full · fetched 2026-10-14 (*read*)
- **Also good:** [Sliding Window](https://usaco.guide/gold/sliding-window) · USACO Guide · the monotonic deque for window minimum with Java code · fetched 2026-10-14
- **Beyond the docs:** [Monotonic Queue to Solve Sliding Window Problems](https://labuladong.online/en/algo/data-structure/monotonic-queue/) · labuladong · builds the monotonic queue as a data structure first · fetched 2026-10-14 (*read*)

### T04-10 · Recognising a window — Master · 🔲 not written
- **Read this:** [Subarray Sum Equals K](https://neetcode.io/solutions/subarray-sum-equals-k) · NeetCode · explains why a sliding window fails once negatives appear and switches to prefix sums with a hash map · covers our angle: **partial** - the negatives case only; no general monotone-predicate test; a dedicated recognition article was searched for and not found · fetched 2026-10-14 (*read*)
- **Also good:** [Minimum Size Subarray Sum](https://neetcode.io/solutions/minimum-size-subarray-sum) · NeetCode · the positives-only case where the window works, with a prefix-sum and binary search alternative · fetched 2026-10-14
- **Our delta:** the monotone-predicate test is ours to write; negative numbers breaking the window is the key case.

### T04-11 · The "at most k" trick — Understand · 🔲 not written
- **Read this:** [Subarrays with K Different Integers](https://neetcode.io/solutions/subarrays-with-k-different-integers) · NeetCode · exactly k as at most k minus at most k-1 · covers our angle: full · fetched 2026-10-14 (*read*)

### T04-12 · Two pointers on linked lists and strings — Understand · 🔲 not written
- **Read this:** [Intersection of Two Linked Lists](https://neetcode.io/solutions/intersection-of-two-linked-lists) · NeetCode · the length-equalising and jump-to-other-head solutions · covers our angle: **partial** - merging is a separate page · fetched 2026-10-14 (*read*)
- **Also good:** [Backspace String Compare](https://neetcode.io/solutions/backspace-string-compare) · NeetCode · stack and constant-space backward scan · fetched 2026-10-14
- **Also good:** [Merge Two Sorted Lists](https://neetcode.io/solutions/merge-two-sorted-lists) · NeetCode · the merge by two pointers · fetched 2026-10-14
- **Beyond the docs:** [Backspace String Comparisons: Two Ways To Approach a Common Algorithm](https://dev.to/alisabaj/the-backspace-string-compare-algorithm-3ioo) · Alisa Bajramovic (DEV) · walks the stack and two-pointer versions side by side · fetched 2026-10-14 (*headings only*)

### T04-13 · Windows over streams — Understand · 🔲 not written
- **Read this:** [Sliding window based Rate limiter](https://arpit.substack.com/p/sliding-window-based-rate-limiter) · Arpit Bhayani · the window as a rate limiter, with per-second request counters · covers our angle: **partial** - moving averages are not covered · fetched 2026-10-14 (*read*)
- **Also good:** [Solution: Moving Average from Data Stream](https://devpath.com/courses/grokking-coding-interview/solution-moving-average-from-data-stream) · DevPath · queue plus running sum · fetched 2026-10-14
- **Our delta:** the link forward to the System Design track.
