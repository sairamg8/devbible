---
title: "Part 2 — Arrays, strings and hashing"
sidebar_label: "2 · Arrays, strings & hashing"
sidebar_position: 2
---

> Phases 3–5 · The patterns behind most easy and medium problems, and the fastest place to gain points per hour of practice

Roughly half of every interview ladder is arrays and strings, and almost all of it reduces to
a dozen patterns: hash for a complement, prefix for a range, two pointers for a sorted
structure, a window for something contiguous. This part names those patterns, shows the
problem shapes that signal each one, and calls out the costs that TypeScript and Java hide.

---

## Phase 3 — Arrays, hashing and prefix sums

The trade of space for time. A hash map turns a quadratic search into a linear one; a
prefix array turns a range question into a subtraction. The rows here are the shapes to
recognise and the tricks for the "without extra space" follow-up.

| Topic | Tier |
|---|---|
| **Hash maps and sets, with their costs** — average constant time, `Map` against a plain object in JavaScript, key types and insertion order; `HashMap` with correct `equals` and `hashCode` in Java | <span className="db-tier t-master">Master</span> |
| **Frequency counting and the two-sum family** — the complement lookup, counting pairs, anagrams as frequency signatures | <span className="db-tier t-master">Master</span> |
| **Prefix sums** — one- and two-dimensional, subarray sum equal to k with a map of prefix counts, range sums in constant time | <span className="db-tier t-master">Master</span> |
| **Kadane's algorithm** — maximum subarray and the reset intuition, the circular variant, maximum product with the sign flip | <span className="db-tier t-master">Master</span> |
| **The Dutch national flag** — a three-way partition in one pass; sort colours, move zeroes | <span className="db-tier t-master">Master</span> |
| **Cyclic sort and index-as-hash** — values in the range one to n placed at their index; the missing and duplicate numbers without extra space | <span className="db-tier t-master">Master</span> |
| **In-place operations** — removing duplicates from a sorted array, rotating an array, merging sorted arrays from the back | <span className="db-tier t-master">Master</span> |
| **Intervals** — merge, insert, count overlaps, minimum meeting rooms by sorting with a heap or a sweep line | <span className="db-tier t-master">Master</span> |
| **"Sort, then …" and "hash, then …"** — the two openings for most array problems; recognising which the constraints and the follow-up allow | <span className="db-tier t-master">Master</span> |
| **Difference arrays** — range updates in constant time, the booking-count trick | <span className="db-tier t-understand">Understand</span> |
| **Sorting-based approaches** — sort then scan, custom comparators, stability, the problems where sorting is the whole trick | <span className="db-tier t-understand">Understand</span> |
| **Matrices** — rotate in place, spiral order, set matrix zeroes, search in a sorted matrix, diagonal traversal | <span className="db-tier t-understand">Understand</span> |
| **Product except self and the "no division" family** — prefix and suffix products in one pass | <span className="db-tier t-understand">Understand</span> |
| **Majority element and voting** — the Boyer–Moore candidate, generalised to a third of the array | <span className="db-tier t-understand">Understand</span> |
| **Longest consecutive sequence and set tricks** — sequence starts, linear time through set membership | <span className="db-tier t-understand">Understand</span> |
| **Problems over two arrays** — intersection, merge, the k-th element; the median of two sorted arrays previewed for [Part 3](03-linear-structures-and-binary-search.md) | <span className="db-tier t-know">Know</span> |

**Gate — move on when:** you can solve subarray-sum-equals-k, merge intervals and the
missing number without extra space cold, each in under fifteen minutes with the complexity
stated, in both TypeScript and Java.

---

## Phase 4 — Two pointers and sliding window

Two indices moving with an invariant between them. The pattern turns quadratic scans into
linear ones whenever the data is sorted or the answer is contiguous — and knowing when it
does *not* apply (negative numbers, non-monotone predicates) is half the skill.

| Topic | Tier |
|---|---|
| **Opposite-direction pointers** — sorted arrays, palindromes, the invariant that lets exactly one pointer move | <span className="db-tier t-master">Master</span> |
| **Same-direction pointers** — the reader and the writer, removing elements, compacting in place | <span className="db-tier t-master">Master</span> |
| **Fast and slow pointers** — the middle, cycle detection, the duplicate number seen as a cycle | <span className="db-tier t-master">Master</span> |
| **3-sum and 4-sum** — sort, fix one, two pointers for the rest, skipping duplicates correctly | <span className="db-tier t-master">Master</span> |
| **Container with most water and trapping rain water** — the greedy pointer move and the proof that it loses nothing | <span className="db-tier t-master">Master</span> |
| **Fixed-size windows** — running sums and counts, maximum average, the anagram window | <span className="db-tier t-master">Master</span> |
| **Variable-size windows** — expand then shrink, longest substring without repeats, minimum-length subarray with a sum | <span className="db-tier t-master">Master</span> |
| **Minimum window substring** — the counts map and the "have versus need" bookkeeping that everyone gets wrong once | <span className="db-tier t-master">Master</span> |
| **Sliding-window maximum** — the monotonic deque, and why the whole pass is linear | <span className="db-tier t-master">Master</span> |
| **Recognising a window** — contiguous, with a predicate that is monotone as the window grows; when a window does not apply and prefix sums take over | <span className="db-tier t-master">Master</span> |
| **The "at most k" trick** — exactly k equals at most k minus at most k−1; subarrays with k distinct values | <span className="db-tier t-understand">Understand</span> |
| **Two pointers on linked lists and strings** — merging, comparing with backspaces, the intersection of two lists | <span className="db-tier t-understand">Understand</span> |
| **Windows over streams** — moving averages and rate windows; where this pattern becomes the rate limiter of the System Design track | <span className="db-tier t-understand">Understand</span> |

**Gate — move on when:** you can explain why a sliding window is wrong for "subarray sum
equals k with negatives", write minimum window substring in twenty minutes, and prove the
container-with-most-water pointer move in two sentences.

---

## Phase 5 — Strings

Strings are arrays with worse costs and more edge cases. The rows here are the string-only
patterns — palindromes, matching, parsing — and the language details (immutability, code
units, builders) that turn a linear idea into a quadratic run.

| Topic | Tier |
|---|---|
| **Strings in TypeScript and Java** — immutability, builders, code units against code points, the real cost of concatenation and character access | <span className="db-tier t-master">Master</span> |
| **Palindromes** — expand around the centre, the two-pointer check, longest palindromic substring; partitions previewed for [Part 6](06-backtracking-greedy-and-dp.md) | <span className="db-tier t-master">Master</span> |
| **Anagrams and frequency signatures** — grouping, sliding-window anagrams, a fixed 26-slot array against a map | <span className="db-tier t-master">Master</span> |
| **Parsing problems** — string to integer, the calculator with a stack and a sign, expression evaluation, decoding nested strings | <span className="db-tier t-master">Master</span> |
| **Building strings efficiently** — collect then join once, `StringBuilder`, the quadratic concatenation in a loop | <span className="db-tier t-master">Master</span> |
| **String matching** — naive, the failure function of KMP, the Z-function, Rabin–Karp rolling hashes; which one an interview actually expects | <span className="db-tier t-understand">Understand</span> |
| **Compression and run-length encoding** — in place, the count-then-write pattern | <span className="db-tier t-understand">Understand</span> |
| **The small classics** — longest common prefix, string rotation, isomorphic strings, word patterns; the traps in each | <span className="db-tier t-understand">Understand</span> |
| **Reversal problems** — words in a sentence, groups of k, vowels only; in place on a character array | <span className="db-tier t-understand">Understand</span> |
| **Subsequence checks** — the two-pointer scan, the follow-up with many queries solved by bucketing on the next character | <span className="db-tier t-understand">Understand</span> |
| **Unicode and locale pitfalls** — surrogate pairs, locale-aware comparison, case folding; when the interviewer means bytes and when they mean characters | <span className="db-tier t-know">Know</span> |
| **String hashing** — polynomial hashes, collisions, double hashing; where it reappears in caches and deduplication | <span className="db-tier t-know">Know</span> |
| **The string problems that are really DP** — edit distance, longest common subsequence, regular-expression matching; named here, solved in [Part 6](06-backtracking-greedy-and-dp.md) | <span className="db-tier t-know">Know</span> |

**Gate — deliverable:** the calculator, group-anagrams and longest-palindromic-substring
written from memory in both languages, plus a one-paragraph explanation of why a naive
string build in a loop is quadratic and what fixes it in each language.

---

← [Part 1 — Foundations](01-foundations.md) · [Index](../README.md) · Next → [Part 3 — Linear structures and binary search](03-linear-structures-and-binary-search.md)
