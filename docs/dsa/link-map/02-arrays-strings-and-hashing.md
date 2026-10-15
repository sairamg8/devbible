---
title: "Link map · DSA · Part 2 (phases 3–5)"
sidebar_label: "02 · arrays, strings & hashing"
sidebar_position: 2
---

# Link map · DSA · Part 2 (phases 3–5)

Covers every topic row of phases 3, 4 and 5 in `docs/dsa/syllabus/02-arrays-strings-and-hashing.md`: arrays, hashing and prefix sums (T03-01 to T03-16), two pointers and sliding window (T04-01 to T04-13) and strings (T05-01 to T05-13). That is 42 rows. None has a written page of ours yet (`docs/dsa/pages` holds phases 0 to 2 only), so every block is marked not written and its "Our delta" line records what the syllabus row promises.
*read* = I read the passage that supports the claim on the fetched page; *headings only* = fetched at HTTP 200 and not read for the claim (none left in this file). Third-party links carry a date only where the page shows one. No `#anchors` are given. LeetCode problem pages return 403 to the fetcher, so no LeetCode links are used. Where no good non-official explanation turned up, the block has no "Beyond the docs" line. Official means language specifications and API documentation (MDN, Oracle Javadoc), cp-algorithms, the USACO Guide, and Wikipedia for the named algorithms.

---

## Phase 3 — Arrays, hashing and prefix sums

### T03-01 · Hash maps and sets, with their costs — Master · 🔲 not written
- **Read this:** [Map](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map) · MDN · the "Objects vs. Maps" table: any value as a key against strings and symbols only, insertion-order iteration, and better behaviour under frequent additions and removals (*read*) · covers our angle: **partial** — nothing on average against worst-case cost · fetched 2026-10-14
- **Also good:** [HashMap](https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/util/HashMap.html) · Oracle Javadoc, Java 21 · `get` and `put` are constant time only if the hash disperses well; many keys with one `hashCode()` slow the table; default load factor 0.75 and rehash at twice the buckets (*read*) · covers our angle: **partial** — no worked `equals` and `hashCode` example · fetched 2026-10-14
- **Also good:** [Object](https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/lang/Object.html) · Oracle Javadoc, Java 21 · the `equals` contract (reflexive, symmetric, transitive, consistent, null) and the rule that equal objects must have equal hash codes (*read*) · covers our angle: **partial** — the contract only, with no mutable-key trap · fetched 2026-10-14
- **Also good:** [Hash table](https://en.wikipedia.org/wiki/Hash_table) · Wikipedia · average Θ(1) against worst-case O(n), the load factor, chaining against open addressing (*read*) · fetched 2026-10-14
- **Our delta:** the syllabus row promises the JavaScript `Map` against plain-object choice and the Java `HashMap` key contract in one place, with the cost of each.

### T03-02 · Frequency counting and the two-sum family — Master · 🔲 not written
- **Read this:** [Hash table](https://en.wikipedia.org/wiki/Hash_table) · Wikipedia · why lookup and insert are average constant time, which is what makes a one-pass complement lookup linear (*read*) · covers our angle: **partial** — no two-sum or anagram-signature example · fetched 2026-10-14
- **Also good:** [Anagram](https://en.wikipedia.org/wiki/Anagram) · Wikipedia · the definition only; it gives no sorted-letter or frequency signature (*read*) · fetched 2026-10-14
- **Our delta:** the complement lookup, counting pairs and anagrams as frequency signatures, as one family rather than separate tricks. No source found that does that.

### T03-03 · Prefix sums — Master · 🔲 not written
- **Read this:** [Prefix Sums](https://usaco.guide/silver/prefix-sums) · USACO Guide · builds the cumulative array in linear time and answers a range sum in constant time, and says the idea extends to invertible operations such as XOR (*read*) · covers our angle: **partial** — one-dimensional only, no map of prefix counts · fetched 2026-10-14
- **Also good:** [Summed-area table](https://en.wikipedia.org/wiki/Summed-area_table) · Wikipedia · the two-dimensional table built in one pass, and a rectangle sum from exactly four lookups (*read*) · covers our angle: **partial** — no subarray-sum-equals-k · fetched 2026-10-14
- **Beyond the docs:** [Prefix sums and hash maps: solving subarray sum equals k](https://johnkavanagh.co.uk/articles/prefix-sums-and-hash-maps-solving-subarray-sum-equals-k/) · John Kavanagh, 2025-09-08 · writes a subarray sum as a difference of two running totals, stores counts not presence, and seeds the map with total 0 once, so subarrays from index 0 are not lost · fetched 2026-10-14 (*read*)
- **Our delta:** the three pieces on one page in both languages: one-dimensional, two-dimensional, and the map of prefix counts.

### T03-04 · Kadane's algorithm — Master · 🔲 not written
- **Read this:** [Maximum subarray problem](https://en.wikipedia.org/wiki/Maximum_subarray_problem) · Wikipedia · one left-to-right pass in O(n) time and O(1) space, with `current_sum = max(x, current_sum + x)` and the empty-subarray variant (*read*) · covers our angle: **partial** — no circular variant and no maximum product with the sign flip · fetched 2026-10-14
- **Also good:** [More Prefix Sums](https://usaco.guide/silver/more-prefix-sums) · USACO Guide · gets the maximum subarray from prefix sums and a running minimum of prefixes, and lists Kadane's algorithm as a collapsed alternative solution, not read (*read*) · fetched 2026-10-14
- **Our delta:** the reset intuition, the circular variant (total minus the minimum subarray) and the maximum-product sign flip, none of which the sources above give.

### T03-05 · The Dutch national flag — Master · 🔲 not written
- **Read this:** [Dutch national flag problem](https://en.wikipedia.org/wiki/Dutch_national_flag_problem) · Wikipedia · Dijkstra's single pass with three indices and four regions (below, equal, unsorted, above), in Θ(n) moves (*read*) · covers our angle: **partial** — no sort-colours or move-zeroes framing and no language code · fetched 2026-10-14
- **Our delta:** the region invariant as the way to write it correctly, and move zeroes as the same partition.

### T03-06 · Cyclic sort and index-as-hash — Master · 🔲 not written
- **Read this:** [Cycle sort](https://en.wikipedia.org/wiki/Cycle_sort) · Wikipedia · rotates each permutation cycle into place, minimising writes; it finds each target by counting smaller elements, so it is O(n²) and not the same as the values-one-to-n technique (*read*) · covers our angle: **partial** — related by name and permutation cycles only; no missing or duplicate numbers · fetched 2026-10-14
- **Our delta:** values one to n placed at index value minus one with the target known for free, so missing and duplicate numbers fall out without extra space.

### T03-07 · In-place operations — Master · 🔲 not written
- **Read this:** [Merge algorithm](https://en.wikipedia.org/wiki/Merge_algorithm) · Wikipedia · two sorted lists merge in linear time; avoiding the temporary array is possible but costs speed and simplicity, and in-place merges may give up linear time (*read*) · covers our angle: **partial** — nothing on merging from the back, removing duplicates or rotation · fetched 2026-10-14
- **Our delta:** the back-to-front merge that needs no buffer, the reader and writer for duplicates, and rotation by three reversals.

### T03-08 · Intervals — Master · 🔲 not written
- **Read this:** [Sweep line algorithm](https://en.wikipedia.org/wiki/Sweep_line_algorithm) · Wikipedia · a conceptual line stops at points and only nearby objects matter; Shamos and Hoey detect segment intersection in O(N log N) (*read*) · covers our angle: **partial** — geometric; no event-count sweep for overlaps · fetched 2026-10-14
- **Also good:** [Interval scheduling](https://en.wikipedia.org/wiki/Interval_scheduling) · Wikipedia · the earliest-finish greedy for the maximum non-overlapping set; it names minimising resources but gives no algorithm, so meeting rooms are not covered (*read*) · fetched 2026-10-14
- **Our delta:** merge, insert, count overlaps and minimum meeting rooms with a heap or a sweep over sorted start and end events.

### T03-09 · "Sort, then …" and "hash, then …" — Master · 🔲 not written
- **Read this:** [Sorting and Custom Comparators](https://usaco.guide/silver/sorting-custom) · USACO Guide · sorting by key or comparator, multiple criteria, coordinate compression (*read*) · covers our angle: **partial** — no discussion of when to hash instead, and it says nothing on stability · fetched 2026-10-14
- **Also good:** [Hash table](https://en.wikipedia.org/wiki/Hash_table) · Wikipedia · average Θ(1) lookup with O(n) worst case, which is the cost side of choosing to hash (*read*) · fetched 2026-10-14
- **Our delta:** a decision rule: which opening the constraints and the follow-up (space, order to keep) allow. No source states one.

### T03-10 · Difference arrays — Understand · 🔲 not written
- **Read this:** [More Prefix Sums](https://usaco.guide/silver/more-prefix-sums) · USACO Guide · the difference-array section: add at the start, subtract just past the end, and a prefix sum recovers the values in O(N+M) (*read*) · covers our angle: **partial** — no booking-count framing · fetched 2026-10-14
- **Our delta:** the booking-count trick, and difference arrays as the inverse of prefix sums.

### T03-11 · Sorting-based approaches — Understand · 🔲 not written
- **Read this:** [Array.prototype.sort](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/sort) · MDN · comparator rules (pure, antisymmetric, transitive), stable since ES2019, the default compares UTF-16 code units, and sorting is in place (*read*) · covers our angle: **partial** — JavaScript only · fetched 2026-10-14
- **Also good:** [Arrays](https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/util/Arrays.html) · Oracle Javadoc, Java 21 · object sorts are stable (a TimSort-derived merge sort); primitive sorts use dual-pivot quicksort and are not promised stable (*read*) · fetched 2026-10-14
- **Also good:** [Comparator](https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/util/Comparator.html) · Oracle Javadoc, Java 21 · `comparing` and `thenComparing`, and consistency with `equals`; the page does not mention the subtraction-overflow trap (*read*) · fetched 2026-10-14
- **Our delta:** one sort-then-scan treatment with both languages' comparator traps side by side, and the problems where sorting is the whole trick.

### T03-12 · Matrices — Understand · 🔲 not written
- **Read this:** [Rotating a matrix 90 degrees](https://dev.to/a_b_102931/rotating-a-matrix-90-degrees-4a49) · ab, DEV Community, 2020-06-18 · in-place clockwise rotation as a transpose followed by a reverse of each row (*read*) · covers our angle: **partial** — rotation only; no spiral, set-zeroes, sorted-matrix search or diagonals · fetched 2026-10-14
- **Also good:** [Summed-area table](https://en.wikipedia.org/wiki/Summed-area_table) · Wikipedia · the two-dimensional prefix table, relevant to range sums over a matrix (*read*) · fetched 2026-10-14
- **Our delta:** the five matrix shapes with their index arithmetic and the boundary-shrinking and marker-row techniques.

### T03-13 · Product except self and the "no division" family — Understand · 🔲 not written
- **Read this:** [Prefix Sums](https://usaco.guide/silver/prefix-sums) · USACO Guide · the prefix idea for any invertible operation; products are not covered, and division is the invertible step this family forbids (*read*) · covers our angle: **partial** — the underlying prefix mechanism only · fetched 2026-10-14
- **Beyond the docs:** [Product of Array Except Self](https://neetcode.io/solutions/product-of-array-except-self) · NeetCode · brute force, division with a zero count (division fails on zeros), prefix and suffix arrays, then the result array reused for a prefix pass and a suffix pass in O(1) extra space · fetched 2026-10-14 (*read*)
- **Our delta:** prefix and suffix products in one pass with the output array as storage, and why division fails on zeros.

### T03-14 · Majority element and voting — Understand · 🔲 not written
- **Read this:** [Boyer–Moore majority vote algorithm](https://en.wikipedia.org/wiki/Boyer%E2%80%93Moore_majority_vote_algorithm) · Wikipedia · one candidate and one counter in linear time and constant space; a second pass is needed to confirm a majority exists (*read*) · covers our angle: **partial** — the one-half case; generalisation only named · fetched 2026-10-14
- **Also good:** [Misra–Gries heavy hitters algorithm](https://en.wikipedia.org/wiki/Misra%E2%80%93Gries_heavy_hitters_algorithm) · Wikipedia · a first pass keeps fewer than k distinct values and a second counts them, which is the more-than-n-over-k generalisation (*read*) · fetched 2026-10-14
- **Our delta:** the third-of-the-array case with two candidates, and the second pass as part of the answer.

### T03-15 · Longest consecutive sequence and set tricks — Understand · 🔲 not written
- **Read this:** [Longest Consecutive Sequence](https://neetcode.io/solutions/longest-consecutive-sequence) · NeetCode · four approaches: brute force O(n²), sorting O(n log n), a hash set that starts only where `num - 1` is absent in O(n), and a boundary-length hash map (*read*) · covers our angle: **full** for the set method · fetched 2026-10-14
- **Our delta:** the sequence-start test as an instance of a wider set trick, with the amortised argument that each value is touched at most twice.

### T03-16 · Problems over two arrays — Know · 🔲 not written
- **Read this:** [Merge algorithm](https://en.wikipedia.org/wiki/Merge_algorithm) · Wikipedia · linear-time merge of two sorted sequences (*read*) · covers our angle: **partial** — no intersection or k-th element · fetched 2026-10-14
- **Also good:** [Quickselect](https://en.wikipedia.org/wiki/Quickselect) · Wikipedia · k-th smallest in expected O(n), worst case O(n²), linear with median of medians (*read*) · covers our angle: **partial** — one array, not two sorted ones · fetched 2026-10-14
- **Our delta:** intersection, merge and k-th across two arrays, with the median of two sorted arrays only previewed for Part 3.

**Gate — Phase 3:** subarray-sum-equals-k, merge intervals and the missing number without extra space, cold, in both languages. Links above cover the first only in part.

---

## Phase 4 — Two pointers and sliding window

### T04-01 · Opposite-direction pointers — Master · 🔲 not written
- **Read this:** [Two Pointers](https://usaco.guide/silver/two-pointers) · USACO Guide · the opposite-ends variant on a sorted array for a pair summing to a target, in one pass after sorting (*read*) · covers our angle: **partial** — no palindromes and no statement of the invariant · fetched 2026-10-14
- **Our delta:** the invariant that lets exactly one pointer move, applied to sorted pairs and palindromes.

### T04-02 · Same-direction pointers — Master · 🔲 not written
- **Read this:** [Two Pointers](https://usaco.guide/silver/two-pointers) · USACO Guide · the same-direction variant, with both endpoints moving right, as in the sliding-window section (*read*) · covers our angle: **partial** — a window framing, not reader and writer compaction · fetched 2026-10-14
- **Our delta:** the reader and the writer, removing elements and compacting in place.

### T04-03 · Fast and slow pointers — Master · 🔲 not written
- **Read this:** [Cycle detection](https://en.wikipedia.org/wiki/Cycle_detection) · Wikipedia · tortoise one step, hare two; finds the cycle, then its start by resetting the tortoise to the beginning, then its length, in O(λ + μ) time and O(1) memory (*read*) · covers our angle: **partial** — no array middle and no duplicate number · fetched 2026-10-14
- **Our delta:** the middle of a list, and the duplicate number read as a cycle in the array seen as a function.

### T04-04 · 3-sum and 4-sum — Master · 🔲 not written
- **Read this:** [3SUM](https://en.wikipedia.org/wiki/3SUM) · Wikipedia · sort, fix an element, scan the rest with two pointers, O(n²); the pseudocode assumes distinct values and gives no duplicate handling (*read*) · covers our angle: **partial** — no duplicate skipping and no 4-sum · fetched 2026-10-14
- **Our delta:** skipping duplicates correctly at every level, and 4-sum as one more fixed element.

### T04-05 · Container with most water and trapping rain water — Master · 🔲 not written
- **Read this:** [Container With Most Water: The Two-Pointer Awakening](https://www.techinterview.org/post/3233474773/container-with-most-water-two-pointer/) · techinterview.org, no named author, 2026-05-01, updated 2026-06-30 · if the left line is shorter, every container using it with a closer partner is narrower and no taller, so the left pointer can be dropped (*read*) · covers our angle: **partial** — container only; trapping rain water not covered · fetched 2026-10-14
- **Beyond the docs:** [Trapping Rain Water](https://neetcode.io/solutions/trapping-rain-water) · NeetCode · brute force, prefix and suffix maximum arrays, a stack, and two pointers that move the side with the shorter wall while tracking leftMax and rightMax · fetched 2026-10-14 (*read*)
- **Our delta:** the proof in two sentences, and the matching running-maximum argument for trapping rain water.

### T04-06 · Fixed-size windows — Master · 🔲 not written
- **Read this:** [Sliding Window](https://usaco.guide/gold/sliding-window) · USACO Guide · a constant-size subarray moving left to right; a naive sorted-set version costs O(N log N) (*read*) · covers our angle: **partial** — no running sum, maximum average or anagram window · fetched 2026-10-14
- **Also good:** [Moving average](https://en.wikipedia.org/wiki/Moving_average) · Wikipedia · the incremental update: add the entering value, drop the leaving one (*read*) · fetched 2026-10-14
- **Our delta:** running sums and counts, maximum average and the anagram window as one template.

### T04-07 · Variable-size windows — Master · 🔲 not written
- **Read this:** [Two Pointers](https://usaco.guide/silver/two-pointers) · USACO Guide · the sliding-window section finds the longest contiguous segment whose sum stays within a limit in linear time (*read*) · covers our angle: **partial** — no longest substring without repeats · fetched 2026-10-14
- **Also good:** [Sliding Window](https://usaco.guide/gold/sliding-window) · USACO Guide · two-pointer windows where both ends only move right (*read*) · fetched 2026-10-14
- **Our delta:** the expand-then-shrink loop for longest substring without repeats and for minimum-length subarray with a sum.

### T04-08 · Minimum window substring — Master · 🔲 not written
- **Read this:** [Sliding Window](https://usaco.guide/gold/sliding-window) · USACO Guide · the window mechanics this problem builds on; no counts map or have-versus-need bookkeeping (*read*) · covers our angle: **partial** — only the window mechanics · fetched 2026-10-14
- **Beyond the docs:** [Minimum Window Substring](https://neetcode.io/solutions/minimum-window-substring) · NeetCode · a count map for `t`, a window map, and `have` against `need` (distinct characters that meet their count), shrinking from the left while `have == need` · fetched 2026-10-14 (*read*)
- **Our delta:** the counts map and the have-versus-need counter as the part most people get wrong once, with the off-by-one traps named.

### T04-09 · Sliding-window maximum — Master · 🔲 not written
- **Read this:** [Sliding Window](https://usaco.guide/gold/sliding-window) · USACO Guide · a decreasing monotonic deque with the front removed when it leaves the window, and a two-stack alternative with O(1) per queue operation and O(N) overall (*read*) · covers our angle: **full** on the mechanism · fetched 2026-10-14
- **Also good:** [Minimum stack / minimum queue](https://cp-algorithms.com/data_structures/stack_queue_modification.html) · cp-algorithms · the same deque for fixed-length minima, linear because every element is pushed and popped once (*read*) · fetched 2026-10-14
- **Our delta:** the linear-time argument stated plainly, tied to the amortised analysis of Phase 1.

### T04-10 · Recognising a window — Master · 🔲 not written
- **Read this:** [Prefix sums and hash maps: solving subarray sum equals k](https://johnkavanagh.co.uk/articles/prefix-sums-and-hash-maps-solving-subarray-sum-equals-k/) · John Kavanagh, 2025-09-08 · window logic needs the sum to move predictably, which holds only for non-negative values; negatives send you to prefix sums (*read*) · covers our angle: **partial** — argued for sums only, not as a general monotone-predicate test · fetched 2026-10-14
- **Our delta:** the monotone-predicate test for a window, stated as a general rule with the prefix-sum fallback.

### T04-11 · The "at most k" trick — Understand · 🔲 not written
- **Read this:** [Two Pointers](https://usaco.guide/silver/two-pointers) · USACO Guide · the window mechanics only; the exactly-k identity is not covered (*read*) · covers our angle: **partial** · fetched 2026-10-14
- **Beyond the docs:** [Subarrays with K Different Integers](https://neetcode.io/solutions/subarrays-with-k-different-integers) · NeetCode · reframes exactly k distinct as at most k minus at most k−1, with an `atMostK` helper window that shrinks past k · fetched 2026-10-14 (*read*)
- **Our delta:** exactly k equals at most k minus at most k minus one, for subarrays with k distinct values.

### T04-12 · Two pointers on linked lists and strings — Understand · 🔲 not written
- **Read this:** [Cycle detection](https://en.wikipedia.org/wiki/Cycle_detection) · Wikipedia · two pointers at different speeds over a linked structure (*read*) · covers our angle: **partial** — no merging, backspace comparison or list intersection · fetched 2026-10-14
- **Our delta:** merging, comparing with backspaces from the end, and the intersection of two lists by switching heads.

### T04-13 · Windows over streams — Understand · 🔲 not written
- **Read this:** [How we built rate limiting capable of scaling to millions of domains](https://blog.cloudflare.com/counting-things-a-lot-of-different-things/) · Julien Desgats, Cloudflare Blog, 2017-06-07 · estimates a rate by weighting the previous window's count by its overlap with the current one (42 × 0.75 + 18 = 49.5), assuming a constant rate in the previous period (*read*) · covers our angle: **full** on the rate window · fetched 2026-10-14
- **Also good:** [Moving average](https://en.wikipedia.org/wiki/Moving_average) · Wikipedia · the incremental moving average, with a circular buffer (*read*) · fetched 2026-10-14
- **Our delta:** moving averages and rate windows as the bridge to the rate limiter in the System Design track.

**Gate — Phase 4:** explain why a sliding window fails on subarray sum equals k with negatives, write minimum window substring in twenty minutes, and prove the container pointer move.

---

## Phase 5 — Strings

### T05-01 · Strings in TypeScript and Java — Master · 🔲 not written
- **Read this:** [String](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String) · MDN · strings are UTF-16 code units; `length` and indexing count units, `[...s]` iterates code points, and grapheme clusters need custom code (*read*) · covers our angle: **partial** — no cost model for concatenation · fetched 2026-10-14
- **Also good:** [String](https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/lang/String.html) · Oracle Javadoc, Java 21 · strings are constants; `length` and `charAt` count `char` units, and `codePointCount` and `codePointAt` handle supplementary characters; the first 100,000 characters of the page were read (*read*) · fetched 2026-10-14
- **Our delta:** one table of immutability, code units against code points and the real cost of concatenation and character access, for both languages.

### T05-02 · Palindromes — Master · 🔲 not written
- **Read this:** [Longest palindromic substring](https://en.wikipedia.org/wiki/Longest_palindromic_substring) · Wikipedia · expand around each centre in O(n²), with a separator for even lengths; Manacher's algorithm gives all radii in O(n) (*read*) · covers our angle: **partial** — no two-pointer check and no partition preview · fetched 2026-10-14
- **Our delta:** the two-pointer check, both centre kinds without a separator trick, and partitions previewed for Part 6.

### T05-03 · Anagrams and frequency signatures — Master · 🔲 not written
- **Read this:** [Anagram](https://en.wikipedia.org/wiki/Anagram) · Wikipedia · the definition only (*read*) · covers our angle: **partial** — no grouping, window or 26-slot array · fetched 2026-10-14
- **Our delta:** grouping, sliding-window anagrams, and a fixed 26-slot array against a map.

### T05-04 · Parsing problems — Master · 🔲 not written
- **Read this:** [Shunting yard algorithm](https://en.wikipedia.org/wiki/Shunting_yard_algorithm) · Wikipedia · operators on a stack, popping those of higher or equal precedence (left-associative) before pushing; linear time; it can accept some invalid input (*read*) · covers our angle: **partial** — no sign-and-stack calculator, no nested decoding · fetched 2026-10-14
- **Also good:** [Integer](https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/lang/Integer.html) · Oracle Javadoc, Java 21 · `parseInt` accepts an optional sign then decimal digits only, and throws `NumberFormatException` out of range (*read*) · fetched 2026-10-14
- **Our delta:** string to integer with overflow, the calculator with a stack and a sign, and decoding nested strings.

### T05-05 · Building strings efficiently — Master · 🔲 not written
- **Read this:** [StringBuilder](https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/lang/StringBuilder.html) · Oracle Javadoc, Java 21 · appends reuse the buffer until it overflows, then it grows to at least twice the old capacity plus 2; no word on `String` concatenation or amortisation (*read*) · covers our angle: **partial** · fetched 2026-10-14
- **Also good:** [String](https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/lang/String.html) · Oracle Javadoc, Java 21 · `+` is left to the compiler, which may use `StringBuilder` or `StringConcatFactory` (*read*) · fetched 2026-10-14
- **Our delta:** why concatenation in a loop is quadratic and what collect-then-join fixes, in each language.

### T05-06 · String matching — Understand · 🔲 not written
- **Read this:** [Prefix function. Knuth-Morris-Pratt](https://cp-algorithms.com/string/prefix-function.html) · cp-algorithms · defines the prefix function, derives a linear loop from a cubic one, and searches with `s + # + t` in O(n + m) (*read*) · covers our angle: **partial** — KMP only · fetched 2026-10-14
- **Also good:** [Z-function](https://cp-algorithms.com/string/z-function.html) · cp-algorithms · the Z-array, a linear algorithm with a proof, and pattern search (*read*) · fetched 2026-10-14
- **Also good:** [Rabin-Karp](https://cp-algorithms.com/string/rabin-karp.html) · cp-algorithms · hash the pattern and compare each text window in constant time, linear overall (*read*) · fetched 2026-10-14
- **Also good:** [Knuth–Morris–Pratt algorithm](https://en.wikipedia.org/wiki/Knuth%E2%80%93Morris%E2%80%93Pratt_algorithm) · Wikipedia · O(n + k) against the naive O(k·n), with the million-A's example (*read*) · fetched 2026-10-14
- **Our delta:** which of the four an interview actually expects.

### T05-07 · Compression and run-length encoding — Understand · 🔲 not written
- **Read this:** [Run-length encoding](https://en.wikipedia.org/wiki/Run-length_encoding) · Wikipedia · each run becomes a value and a count; data with few runs can grow (*read*) · covers our angle: **partial** — no in-place count-then-write · fetched 2026-10-14
- **Our delta:** the in-place count-then-write pattern with a reader and a writer.

### T05-08 · The small classics — Understand · 🔲 not written
- **Read this:** [Subsequence](https://en.wikipedia.org/wiki/Subsequence) · Wikipedia · substring against subsequence, a distinction that matters for rotation and pattern-word problems (*read*) · covers our angle: **partial** · fetched 2026-10-14
- **Our delta:** longest common prefix, string rotation, isomorphic strings and word patterns, with the trap in each.

### T05-09 · Reversal problems — Understand · 🔲 not written
- **Read this:** [String](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String) · MDN · strings cannot be edited by assignment, which is why these problems use a character array; `split("")` breaks surrogate pairs (*read*) · covers our angle: **partial** — no algorithms · fetched 2026-10-14
- **Our delta:** words in a sentence, groups of k and vowels only, in place on a character array.

### T05-10 · Subsequence checks — Understand · 🔲 not written
- **Read this:** [Subsequence](https://en.wikipedia.org/wiki/Subsequence) · Wikipedia · a subsequence keeps the original order and need not be consecutive (*read*) · covers our angle: **partial** — definition only · fetched 2026-10-14
- **Our delta:** the two-pointer scan, and the many-queries follow-up by bucketing on the next character.

### T05-11 · Unicode and locale pitfalls — Know · 🔲 not written
- **Read this:** [String.prototype.normalize()](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/normalize) · MDN · canonically equivalent strings compare unequal and differ in length until normalised; NFC against NFD, and NFKC for search (*read*) · covers our angle: **partial** — no case folding · fetched 2026-10-14
- **Also good:** [Intl.Collator](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/Collator) · MDN · the same strings sort differently by locale (German against Swedish ä) (*read*) · fetched 2026-10-14
- **Also good:** [String.prototype.localeCompare()](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/localeCompare) · MDN · do not rely on return values of -1 or 1; `numeric` option; reuse a collator for large sorts (*read*) · fetched 2026-10-14
- **Also good:** [Unicode equivalence](https://en.wikipedia.org/wiki/Unicode_equivalence) · Wikipedia · canonical against compatibility equivalence and normalisation mismatch between systems (*read*) · fetched 2026-10-14
- **Our delta:** when the interviewer means bytes and when they mean characters. The sources cover normalisation and collation but not case folding.

### T05-12 · String hashing — Know · 🔲 not written
- **Read this:** [String Hashing](https://cp-algorithms.com/string/string-hashing.html) · cp-algorithms · polynomial hash, a prime base near the alphabet size, a large prime modulus, why not 2^64, and double hashing (about 10^-6 against 10^-3 collision chance for 10^6 strings) (*read*) · covers our angle: **partial** — no caches or deduplication · fetched 2026-10-14
- **Also good:** [Rolling hash](https://en.wikipedia.org/wiki/Rolling_hash) · Wikipedia · polynomial rolling hash against Rabin fingerprint; at best pairwise independent (*read*) · fetched 2026-10-14
- **Our delta:** where it reappears in caches and deduplication.

### T05-13 · The string problems that are really DP — Know · 🔲 not written
- **Read this:** [Edit distance](https://en.wikipedia.org/wiki/Edit_distance) · Wikipedia · naive recursion is exponential; Wagner–Fischer is Θ(mn) time, space reducible to Θ(min(m,n)) with two rows (*read*) · covers our angle: **partial** — no regular-expression matching · fetched 2026-10-14
- **Also good:** [Longest common subsequence](https://en.wikipedia.org/wiki/Longest_common_subsequence) · Wikipedia · optimal substructure and overlapping subproblems, O(n × m) time (*read*) · fetched 2026-10-14
- **Our delta:** named here and solved in Part 6.

**Gate — Phase 5:** the calculator, group-anagrams and longest-palindromic-substring from memory in both languages, plus the quadratic string-build explanation. Links above cover the last part only.
