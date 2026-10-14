---
title: "Link map · DSA · Part 8 (phases 19–20)"
sidebar_label: "08 · the ladder & the plan"
sidebar_position: 8
---

# Link map · DSA · Part 8 (phases 19–20)

Covers every topic row of phases 19 and 20 in `docs/dsa/syllabus/08-the-ladder-and-the-plan.md`: the problem ladder pattern by pattern (T19-01 to T19-22) and the interview formats, plan and last two weeks (T20-01 to T20-10). That is 32 rows. Four rows have a written page of ours (the ladders, the review method, the mock cadence and contest against interview); the other 28 are not written yet, and their "Our delta" line says what the syllabus row promises. The ladder pages exist only for phase 0 so far, so the per-pattern ladder rows point at the pattern phases that are still to come.
*read* = I read the passage that supports the claim in the fetched text; *headings only* = fetched at HTTP 200 and the opening checked, passage not read for the claim. Fetches returned condensed text, so *read* means the stated claim was in that text. Third-party links carry a date only where the page shows one. No `#anchors` are given. Where no good non-official explanation turned up, the block has no "Beyond the docs" line. Every URL below was fetched on 2026-10-14 and returned 200 at the address shown. The Tech Interview Handbook is a community guide rather than an official source, but it is the closest thing to a primary reference for what the ladders contain; LeetCode and NeetCode pages returned 403 or no body, so no problem statement is linked.

---

## Phase 19 — The problem ladder, pattern by pattern

### T19-01 · Arrays and hashing — Master · 🔲 not written
- **Read this:** [Array interview cheatsheet](https://www.techinterviewhandbook.org/algorithms/array/) · Tech Interview Handbook · essential questions Two Sum, Product of Array Except Self and Maximum Subarray, recommended Contains Duplicate and others; no Valid Anagram or Top K Frequent on this page (*read*) · covers our angle: **partial** — the array half of the row only; the hashing half is on the next page · fetched 2026-10-14
- **Also good:** [Hash table interview cheatsheet](https://www.techinterviewhandbook.org/algorithms/hash-table/) · Tech Interview Handbook · essentials Two Sum and Ransom Note, recommended Group Anagrams, Insert Delete GetRandom O(1), LRU Cache; says average-case complexity is the one that matters in interviews (*read*) · fetched 2026-10-14
- **Also good:** [String interview cheatsheet](https://www.techinterviewhandbook.org/algorithms/string/) · Tech Interview Handbook · Valid Anagram essential, Group Anagrams and Encode and Decode Strings recommended; a counter over a fixed alphabet is O(1) space (*read*) · fetched 2026-10-14
- **Our delta:** the eight named problems in easy, medium, hard order, with the pattern to name before coding each one.

### T19-02 · Two pointers — Master · 🔲 not written
- **Read this:** [Array interview cheatsheet](https://www.techinterviewhandbook.org/algorithms/array/) · Tech Interview Handbook · two pointers is the broader pattern where pointers can cross and run over different arrays; 3Sum and Container With Most Water are on the recommended list (*read*) · covers our angle: **partial** — no Valid Palindrome, sorted two-sum or Trapping Rain Water here · fetched 2026-10-14
- **Also good:** [Stack interview cheatsheet](https://www.techinterviewhandbook.org/algorithms/stack/) · Tech Interview Handbook · lists Trapping Rain Water among its recommended questions (*read*) · fetched 2026-10-14
- **Our delta:** the five-problem set with the pointer-move rule stated for each, and trapping rain water as the hard that proves the pattern.

### T19-03 · Sliding window — Master · 🔲 not written
- **Read this:** [Array interview cheatsheet](https://www.techinterviewhandbook.org/algorithms/array/) · Tech Interview Handbook · sliding window suits many subarray and substring problems; both pointers move the same way and never pass each other, so each value is visited at most twice and the work stays O(n); Sliding Window Maximum is listed (*read*) · covers our angle: **partial** — no per-problem walk-through · fetched 2026-10-14
- **Also good:** [String interview cheatsheet](https://www.techinterviewhandbook.org/algorithms/string/) · Tech Interview Handbook · Longest Substring Without Repeating Characters essential; Longest Repeating Character Replacement and Minimum Window Substring recommended (*read*) · fetched 2026-10-14
- **Our delta:** the six-problem set ordered from stock profit to window maximum, with the shrink condition written out per problem.

### T19-04 · Stack — Master · 🔲 not written
- **Read this:** [Stack interview cheatsheet](https://www.techinterviewhandbook.org/algorithms/stack/) · Tech Interview Handbook · Valid Parentheses essential; Min Stack, Evaluate Reverse Polish Notation, Daily Temperatures and Largest Rectangle in Histogram recommended; stacks are LIFO with O(1) push and pop and O(n) search (*read*) · covers our angle: **partial** — no Generate Parentheses or Car Fleet on this page · fetched 2026-10-14
- **Our delta:** the seven-problem set, with the monotonic stack introduced at daily temperatures and proved on the histogram.

### T19-05 · Binary search — Master · 🔲 not written
- **Read this:** [Sorting and searching interview cheatsheet](https://www.techinterviewhandbook.org/algorithms/sorting-searching/) · Tech Interview Handbook · essentials Binary Search and Search in Rotated Sorted Array; recommended Search a 2D Matrix, Find Minimum in Rotated Sorted Array and Median of Two Sorted Arrays; sorted input should make you think of binary search first (*read*) · covers our angle: **partial** — no Koko eating bananas or time-based key-value store, the answer-space variants · fetched 2026-10-14
- **Our delta:** the seven-problem set ending on the median of two sorted arrays, with the search-on-the-answer variant called out.

### T19-06 · Linked list — Master · 🔲 not written
- **Read this:** [Linked list interview cheatsheet](https://www.techinterviewhandbook.org/algorithms/linked-list/) · Tech Interview Handbook · Reverse a Linked List and Detect Cycle essential; Merge Two Sorted Lists, Merge K Sorted Lists, Remove Nth Node From End and Reorder List recommended; use a dummy head node and fast and slow pointers, modify in place (*read*) · covers our angle: **partial** — no LRU cache design, add two numbers or reverse in k-group · fetched 2026-10-14
- **Also good:** [Hash table interview cheatsheet](https://www.techinterviewhandbook.org/algorithms/hash-table/) · Tech Interview Handbook · lists LRU Cache as a recommended question (*read*) · fetched 2026-10-14
- **Our delta:** the eleven-problem set, with LRU cache and k-group reversal as the proof problems.

### T19-07 · Trees — Master · 🔲 not written
- **Read this:** [Tree interview cheatsheet](https://www.techinterviewhandbook.org/algorithms/tree/) · Tech Interview Handbook · essentials Maximum Depth, Invert and LCA of a BST; recommended Same Tree, Subtree of Another Tree, Level Order, Right Side View, Validate BST, Kth Smallest, Build from Preorder and Inorder, Maximum Path Sum, Serialize and Deserialize; recursion with a null base case, BFS for level problems (*read*) · covers our angle: **full** for the problem set apart from diameter, balanced and count good nodes · fetched 2026-10-14
- **Our delta:** the fifteen-problem set with the recursive return-value shape named for each.

### T19-08 · Heaps — Master · 🔲 not written
- **Read this:** [Heap interview cheatsheet](https://www.techinterviewhandbook.org/algorithms/heap/) · Tech Interview Handbook · for the k largest keep a min heap of size k; O(1) access to the top and O(log n) insert and remove; Top K Frequent Elements and Find Median from Data Stream recommended, K Closest Points essential (*read*) · covers our angle: **partial** — no task scheduler, last stone weight or feed design · fetched 2026-10-14
- **Our delta:** the seven-problem set with the heap-size rule for each and the two-heap median as the hard.

### T19-09 · Backtracking — Master · 🔲 not written
- **Read this:** [Recursion interview cheatsheet](https://www.techinterviewhandbook.org/algorithms/recursion/) · Tech Interview Handbook · essentials Generate Parentheses, Combinations and Subsets; recommended Letter Combinations of a Phone Number, Subsets II, Permutations; handle duplicates and always define a base case; the page does not name backtracking (*read*) · covers our angle: **partial** — no combination sum, word search, palindrome partitioning or N-Queens · fetched 2026-10-14
- **Also good:** [N-queens problem](https://en.wikipedia.org/wiki/N-queens_problem) · Wikipedia · 92 distinct solutions for n equal to 8, solutions exist for every n of 4 or more, and Dijkstra's 1972 depth-first backtracking description (*read*) · fetched 2026-10-14
- **Our delta:** the nine-problem set grouped by the choose, explore, unchoose template and by how duplicates are skipped.

### T19-10 · Graphs — Master · 🔲 not written
- **Read this:** [Graph interview cheatsheet](https://www.techinterviewhandbook.org/algorithms/graph/) · Tech Interview Handbook · essentials Number of Islands, Flood Fill, 01 Matrix; recommended Rotting Oranges, Clone Graph, Pacific Atlantic Water Flow, Number of Connected Components, Graph Valid Tree, Course Schedule; grids as graphs, track visited, use a deque for BFS; Word Ladder is not listed (*read*) · covers our angle: **partial** — no walls and gates, redundant connection or word ladder · fetched 2026-10-14
- **Also good:** [Topological sorting](https://cp-algorithms.com/graph/topological-sort.html) · cp-algorithms · an order exists only for an acyclic directed graph; run DFS and reverse the exit order; the page states no complexity (*read*) · fetched 2026-10-14
- **Our delta:** the twelve-problem set sorted into flood-fill, multi-source BFS, topological and union-find families.

### T19-11 · One-dimensional DP — Master · 🔲 not written
- **Read this:** [Dynamic programming interview cheatsheet](https://www.techinterviewhandbook.org/algorithms/dynamic-programming/) · Tech Interview Handbook · essentials Climbing Stairs, Coin Change, House Robber, Longest Increasing Subsequence; recommended Partition Equal Subset Sum, Word Break, House Robber II, Decode Ways; often only the last two values need keeping (*read*) · covers our angle: **partial** — no palindromic substring problems or maximum product subarray · fetched 2026-10-14
- **Our delta:** the eleven-problem set with state, transition and base case written for each.

### T19-12 · Two-dimensional DP — Master · 🔲 not written
- **Read this:** [Dynamic programming interview cheatsheet](https://www.techinterviewhandbook.org/algorithms/dynamic-programming/) · Tech Interview Handbook · lists Longest Common Subsequence and Unique Paths as recommended; edit distance is not on the page; keep only the last two rows when memory matters (*read*) · covers our angle: **partial** — most of the row is missing: edit distance, burst balloons, regular-expression matching, interleaving string · fetched 2026-10-14
- **Our delta:** the eleven-problem set with the table shape and fill order drawn for each, ending on regular-expression matching.

### T19-13 · Intervals — Master · 🔲 not written
- **Read this:** [Interval interview cheatsheet](https://www.techinterviewhandbook.org/algorithms/interval/) · Tech Interview Handbook · Merge Intervals and Insert Interval essential; Non-overlapping Intervals, Meeting Rooms and Meeting Rooms II recommended; sort by start, take the minimum start and maximum end to merge, ask whether touching intervals overlap (*read*) · covers our angle: **full** for the pattern; minimum interval to include each query is not covered · fetched 2026-10-14
- **Our delta:** the six-problem set, with the sort key and tie rule stated for each.

### T19-14 · How the ladders nest — Master · ✅ written `docs/dsa/pages/phase-0-the-interview-and-practice/09-the-ladders.md`
- **Read this:** [Grind 75](https://www.techinterviewhandbook.org/grind75/) · Tech Interview Handbook · "A better Blind 75 you can customize", by the author of Blind 75; the page says nothing about weeks or ordering (*read*) · covers our angle: **partial** — names the list but not how it relates to the 150 · fetched 2026-10-14
- **Also good:** [Coding interview study plan](https://www.techinterviewhandbook.org/coding-interview-study-plan/) · Tech Interview Handbook · weeks 1 to 4 by topic, weeks 5 to 12 the 75 Grind 75 problems ordered by difficulty; says to skip or redo problems already done (*read*) · fetched 2026-10-14
- **Beyond the docs:** [Blind 75 vs NeetCode 150 vs Educative](https://www.educative.io/blog/blind75-vs-neetcode-vs-educative) · Aisha Noor, Educative blog, June 15, 2026 · says the 150 "adds 75 more problems" to the Blind 75 and is organised by category, finish the easy ones in a category first; the article is vendor marketing for Educative, so the nesting claim is the only part to rely on · fetched 2026-10-14 (*read*)
- **Our delta:** the three depths (75, 150, long sheets) and the pattern-by-pattern order, easy then medium then the one hard.

### T19-15 · The review method — Master · ✅ written `docs/dsa/pages/phase-0-the-interview-and-practice/06-spaced-repetition-and-the-mistake-log.md`
- **Read this:** [Spaced repetition](https://en.wikipedia.org/wiki/Spaced_repetition) · Wikipedia · early advice to revise at one, two, four and eight days; the Leitner box system sends a wrong card back to the first box; evidence on expanding against uniform intervals is mixed (*read*) · covers our angle: **partial** — the schedule principle, with no mistake log and no sixty-second explain test · fetched 2026-10-14
- **Also good:** [Forgetting curve](https://en.wikipedia.org/wiki/Forgetting_curve) · Wikipedia · Ebbinghaus's 1885 curve; each repetition lengthens the interval before the next review (*read*) · fetched 2026-10-14
- **Our delta:** the three, seven and twenty-one day re-solve schedule, the per-problem log of pattern missed, bug or time, and the sixty-second test.

### T19-16 · Tries — Understand · 🔲 not written
- **Read this:** [Trie interview cheatsheet](https://www.techinterviewhandbook.org/algorithms/trie/) · Tech Interview Handbook · Implement Trie essential; Add and Search Word, Word Break and Word Search II recommended; insert, search and remove are O(m) in the key length; suits prefix problems and autocomplete (*read*) · covers our angle: **full** for the three-problem set · fetched 2026-10-14
- **Also good:** [Trie](https://en.wikipedia.org/wiki/Trie) · Wikipedia · nodes do not store keys, the position and the character links determine them; search is O(m); basis of autocomplete (*read*) · fetched 2026-10-14
- **Our delta:** the three problems, with the wildcard branch of add-and-search and the pruned search of word search II explained.

### T19-17 · Advanced graphs — Understand · 🔲 not written
- **Read this:** [Eulerian path](https://en.wikipedia.org/wiki/Eulerian_path) · Wikipedia · for a directed trail at most one vertex has out minus in equal to 1 and at most one the reverse; Hierholzer's algorithm runs in O(E) (*read*) · covers our angle: **partial** — reconstruct itinerary only · fetched 2026-10-14
- **Also good:** [Dijkstra's algorithm](https://cp-algorithms.com/graph/dijkstra.html) · cp-algorithms · edge weights must be non-negative; the main version is O(n squared plus m) with a sparse-graph variant elsewhere; path restored through a predecessor array (*read*) · fetched 2026-10-14
- **Also good:** [Minimum spanning tree: Kruskal](https://cp-algorithms.com/graph/mst_kruskal.html) · cp-algorithms · sort edges, add an edge when its ends lie in different trees; the DSU version is about O(M log N) (*read*) · fetched 2026-10-14
- **Also good:** [Bellman-Ford](https://cp-algorithms.com/graph/bellman_ford.html) · cp-algorithms · after phase i every shortest path of at most i edges is correct, which is the hook for a stop cap on edges (*read*) · fetched 2026-10-14
- **Our delta:** six problems each tied to one algorithm: Hierholzer, Kruskal or Prim, Dijkstra twice, topological order, Bellman-Ford with a cap.

### T19-18 · Greedy — Understand · 🔲 not written
- **Read this:** [Greedy algorithms with sorting](https://usaco.guide/silver/greedy-sorting) · USACO Guide · a greedy takes the best move at each step; the earliest-ending event rule has an informal correctness argument; greedy fails for coin change with coins 1, 3, 4 and for knapsack (*read*) · covers our angle: **partial** — the technique, not the jump game or gas station problems · fetched 2026-10-14
- **Also good:** [Maximum subarray problem](https://en.wikipedia.org/wiki/Maximum_subarray_problem) · Wikipedia · Kadane's algorithm is one pass, O(n) time and O(1) space; with non-empty subarrays an all-negative array returns the largest element (*read*) · fetched 2026-10-14
- **Also good:** [Dynamic programming interview cheatsheet](https://www.techinterviewhandbook.org/algorithms/dynamic-programming/) · Tech Interview Handbook · lists Jump Game among its recommended questions (*read*) · fetched 2026-10-14
- **Our delta:** seven problems with the one-line exchange argument for each, so the greedy choice is justified rather than guessed.

### T19-19 · Math and geometry — Understand · 🔲 not written
- **Read this:** [Matrix interview cheatsheet](https://www.techinterviewhandbook.org/algorithms/matrix/) · Tech Interview Handbook · Spiral Matrix and Set Matrix Zeroes essential, Rotate Image recommended; check empty, 1 by 1 and single-row cases; row and column from a flat index (*read*) · covers our angle: **partial** — no happy number, plus one, power, multiply strings or detect squares · fetched 2026-10-14
- **Also good:** [Binary exponentiation](https://cp-algorithms.com/algebra/binary-exp.html) · cp-algorithms · a to the n in O(log n) multiplications by repeated squaring; the page treats non-negative exponents only, so the negative-exponent case for the power problem is not covered (*read*) · fetched 2026-10-14
- **Also good:** [Happy number](https://en.wikipedia.org/wiki/Happy_number) · Wikipedia · in base 10 the only cycle is 4, 16, 37, 58, 89, 145, 42, 20, so every number reaches 1 or that cycle (*read*) · fetched 2026-10-14
- **Our delta:** eight problems with the in-place trick (transpose then reverse, first-row markers) and the overflow guard stated.

### T19-20 · Bit manipulation — Understand · 🔲 not written
- **Read this:** [Binary interview cheatsheet](https://www.techinterviewhandbook.org/algorithms/binary/) · Tech Interview Handbook · Sum of Two Integers and Number of 1 Bits essential; Counting Bits, Missing Number, Reverse Bits, Single Number recommended; set, clear, toggle and test a bit, power-of-two check (*read*) · covers our angle: **partial** — no reverse integer · fetched 2026-10-14
- **Also good:** [Bit manipulation](https://cp-algorithms.com/algebra/bit-manipulation.html) · cp-algorithms · clear the lowest set bit with n and n minus 1, isolate it with n and minus n, Kernighan popcount (*read*) · fetched 2026-10-14
- **Beyond the docs:** [Hamming weight](https://en.wikipedia.org/wiki/Hamming_weight) · Wikipedia · the clear-lowest-bit loop runs once per set bit, so its cost depends on the count of ones, not the word size; compares it with table and bit-parallel methods (*read*) · fetched 2026-10-14
- **Our delta:** seven problems tied to the idioms taught in phase 2, with the 32-bit overflow case of reverse integer.

### T19-21 · Timing drills — Understand · 🔲 not written
- **Read this:** [Coding interview preparation](https://www.techinterviewhandbook.org/coding-interview-prep/) · Tech Interview Handbook · a round is 30 to 45 minutes and the page budgets about 30 minutes per question; it does not recommend timed drills explicitly (*read*) · covers our angle: **partial** — the round length, no targets for a medium or a hard · fetched 2026-10-14
- **Also good:** [Coding interview study plan](https://www.techinterviewhandbook.org/coding-interview-study-plan/) · Tech Interview Handbook · gives each of the 75 problems a suggested duration, mostly 15 to 45 minutes (*read*) · fetched 2026-10-14
- **Our delta:** twenty-five minutes for a medium and forty for a hard, read the solution when time is up, then re-solve the next day without it.

### T19-22 · The whiteboard and the editor — Understand · 🔲 not written
- **Read this:** [Coding interview cheatsheet](https://www.techinterviewhandbook.org/coding-interview-cheatsheet/) · Tech Interview Handbook · set up editor shortcuts in CoderPad or CodePen, leave gaps between lines on a whiteboard, explain as you code, write working code rather than pseudocode (*read*) · covers our angle: **partial** — nothing about practising without autocomplete · fetched 2026-10-14
- **Also good:** [Interview formats](https://www.techinterviewhandbook.org/software-engineering-interview-guide/) · Tech Interview Handbook · phone screens use a collaborative editor where you usually cannot run code, though CoderPad can (*read*) · fetched 2026-10-14
- **Our delta:** practising with autocomplete off, in the interviewer's tool, camera on and talking throughout.

**Gate — move on when:** every Master row has been solved in order at least once, the mistake log covers every miss, and the second pass of the core set is under the timing targets for mediums.

---

## Phase 20 — Interview formats, the plan and the last two weeks

### T20-01 · Interview formats by company type — Master · 🔲 not written
- **Read this:** [Software engineering interview guide](https://www.techinterviewhandbook.org/software-engineering-interview-guide/) · Tech Interview Handbook · phone screen is the most common format; onsite has several rounds across coding, design and behavioural; take-home is rare and likelier at startups and small companies; online assessments are an occasional first filter (*read*) · covers our angle: **partial** — no round breakdown per company type, which matches our own caveat that these are tendencies · fetched 2026-10-14
- **Our delta:** two coding rounds plus design at product companies, a screen and a loop at large firms, a take-home or pairing at startups, and the order to confirm the real process per company.

### T20-02 · The twelve-week plan — Master · 🔲 not written
- **Read this:** [Coding interview study plan](https://www.techinterviewhandbook.org/coding-interview-study-plan/) · Tech Interview Handbook · about 11 hours a week over 12 weeks; weeks 1 to 4 topic study (array, string, hash table, recursion, then sorting, matrix, linked list, queue, stack, then tree, graph, heap, trie, then interval, DP, binary, math); weeks 5 to 12 the 75 Grind 75 problems with hards in weeks 11 and 12; mocks from about 60 percent of the way through (*read*) · covers our angle: **partial** — no HLD and LLD pairing and no timed mixed sets · fetched 2026-10-14
- **Also good:** [Software engineering interview guide](https://www.techinterviewhandbook.org/software-engineering-interview-guide/) · Tech Interview Handbook · recommends about 3 months at roughly 11 hours a week, 2 to 3 hours a day (*read*) · fetched 2026-10-14
- **Our delta:** the pattern-first weeks, hards and mocks in weeks nine and ten, and one HLD and one LLD a week from the System Design track.

### T20-03 · Daily structure with a full-time job — Master · 🔲 not written
- **Read this:** [Coding interview study plan](https://www.techinterviewhandbook.org/coding-interview-study-plan/) · Tech Interview Handbook · budgets about 11 hours a week and advises keeping estimates conservative to avoid burnout; breadth-first or depth-first-then-breadth, depth-first if time is short (*read*) · covers our angle: **partial** — no daily minimum, weekend rule or what to drop · fetched 2026-10-14
- **Our delta:** one problem a day minimum, two at weekends, a fixed review slot, and what to drop and what never to drop when the week collapses.

### T20-04 · The last two weeks — Master · 🔲 not written
- **Read this:** [Coding interview study plan](https://www.techinterviewhandbook.org/coding-interview-study-plan/) · Tech Interview Handbook · ends with the week 12 hard problems and describes no taper or final-days schedule (*read*) · covers our angle: **partial** — confirms the plan stops at timed hards and leaves the taper open · fetched 2026-10-14
- **Also good:** [Coding interview cheatsheet](https://www.techinterviewhandbook.org/coding-interview-cheatsheet/) · Tech Interview Handbook · a before, during and after checklist: clarify, agree an approach, test with edge cases, ask closing questions (*read*) · fetched 2026-10-14
- **Our delta:** no new topics, one problem per pattern per day, the mistake log re-read and the when-stuck protocol rehearsed aloud.

### T20-05 · The mock cadence — Understand · ✅ written `docs/dsa/pages/phase-0-the-interview-and-practice/10-mock-interviews.md`
- **Read this:** [Coding interview study plan](https://www.techinterviewhandbook.org/coding-interview-study-plan/) · Tech Interview Handbook · start scheduling mock coding interviews once about 60 percent of the plan is done, using interviewing.io (*read*) · covers our angle: **partial** — a start point, no weekly cadence, rubric or recording · fetched 2026-10-14
- **Also good:** [Mock interviews](https://interviewing.io/mocks) · interviewing.io · a library of recorded mock interviews shared with both participants' permission; the page describes no feedback process (*headings only*) · fetched 2026-10-14
- **Our delta:** one peer mock a week from week five, graded against the rubric, recorded and reviewed, acting on one piece of feedback per mock.

### T20-06 · Tracking readiness — Understand · 🔲 not written
- **Read this:** [Coding interview rubrics](https://www.techinterviewhandbook.org/coding-interview-rubrics/) · Tech Interview Handbook · four graded dimensions scored in bands from strong hire to strong no hire, the yardstick a readiness dashboard should be measured against (*headings only*) · covers our angle: **partial** — the grading dimensions, no per-pattern tracking · fetched 2026-10-14
- **Our delta:** problems per pattern, solve rate and time per medium on one simple dashboard that says whether you are ready rather than whether you feel ready.

### T20-07 · The day-of checklist — Understand · 🔲 not written
- **Read this:** [Coding interview cheatsheet](https://www.techinterviewhandbook.org/coding-interview-cheatsheet/) · Tech Interview Handbook · virtual onsite: pen and paper, earphones, quiet room, test internet, webcam and audio; ask at least two or three clarifying questions, test before saying you are done, ask closing questions; gives no advice for the night before (*read*) · covers our angle: **partial** — no rule for when to stop practising · fetched 2026-10-14
- **Our delta:** the setup, the tool, the opening questions, the closing summary and when to stop practising the night before.

### T20-08 · After a rejection — Understand · 🔲 not written
- **Read this:** [Coding interview cheatsheet](https://www.techinterviewhandbook.org/coding-interview-cheatsheet/) · Tech Interview Handbook · after the interview, record the questions and your answers for future reference (*read*) · covers our angle: **partial** — the record-keeping step only · fetched 2026-10-14
- **Beyond the docs:** [What should you do after you fail the technical interview?](https://dev.to/madisonkanna/what-should-you-do-after-you-fail-the-technical-interview-2pib) · Madison Kanna, DEV Community, February 10, 2019 · work out the answer afterwards, find the knowledge gap and close it; commenters add asking the interviewer for feedback · fetched 2026-10-14 (*read*)
- **Our delta:** asking for feedback, a cooling-off period, and re-entering the ladder at the pattern that failed rather than restarting the plan.

### T20-09 · Contest-style against interview-style — Know · ✅ written `docs/dsa/pages/phase-0-the-interview-and-practice/14-competitive-programming-vs-interviews.md`
- **Read this:** [CPFAQ: how do coding interviews differ from coding contests?](https://www.redgreencode.com/cpfaq-how-do-coding-interviews-differ-from-coding-contests/) · Duncan Smith, Red-Green-Code, December 13 (year not shown) · a human interviewer forgives syntax and expects collaboration; contests use a wider range of algorithms; "Competitive programming is narrow and deep", interview preparation "wide and shallow" (*read*) · covers our angle: **full** for the contrast; no advice on using contests for timing · fetched 2026-10-14
- **Also good:** [Greedy algorithms with sorting](https://usaco.guide/silver/greedy-sorting) · USACO Guide · a sample of contest-style problems with CSES and Codeforces practice sets (*headings only*) · fetched 2026-10-14
- **Our delta:** speed and tricks against communication and clean code, with contests kept for timing practice only.

### T20-10 · Keeping the edge after the offer — Know · 🔲 not written
- **Read this:** [Forgetting curve](https://en.wikipedia.org/wiki/Forgetting_curve) · Wikipedia · people lose about half of new material within days or weeks unless they review it, and each repetition lengthens the interval before the next review (*read*) · covers our angle: **partial** — the general decay, with nothing specific to DSA · fetched 2026-10-14
- **Our delta:** one problem a week as a maintenance set, and DSA as a skill that decays measurably in months.

---

← [Part 8 syllabus — The ladder and the plan](../syllabus/08-the-ladder-and-the-plan.md) · [Link map index](01-foundations.md)
