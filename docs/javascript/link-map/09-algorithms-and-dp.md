---
title: "Link map · JavaScript · Part 9 (phases 15–16)"
sidebar_label: "09 · algorithms and dp"
sidebar_position: 9
---

# Link map · JavaScript · Part 9 (phases 15–16)

Covers every topic row of `docs/javascript/syllabus/04-dsa-and-machine-coding.md` in phase 15 (T15-01 to T15-20, algorithmic patterns) and phase 16 (T16-01 to T16-16, dynamic programming and the harder set). That is 36 rows. Written pages exist for T15-01 to T15-04, T15-06 and T16-01 to T16-03 (✅); T15-05 (recursion) has no page yet, nor do the other rows (🔲).
*read* = the passage that supports the claim was found in the fetched text; *headings only* = the page loaded and its scope was checked, not the passage. Third-party links carry a date only where the page shows one. No `#anchors` are given.

🔴 **Search pass.** An earlier note here said the WebSearch budget was used up and nothing was searched. That is no longer true: the verifier's searches ran, and every one of the 36 blocks has now had at least one real query (several had two or three: binary search, DP, sorting, rate limiters, DAG DP, string and matrix problems). Every URL below was fetched and returned 200. A block with no "Beyond the docs" line means the searches turned up only listicles, paywalled or marketing pages, or pages that blocked the fetch (Codeforces and LeetCode posts returned 403 and could not be read, so none is linked). Better pages may exist.

🔴 **Version note.** Our syllabus targets **Node 24 LTS** (`docs/javascript/README.md`). MDN pages track current engines. Most algorithm pages here are language-neutral: their code is C++ or pseudocode, so the JavaScript translation is ours. The USACO Guide pages use C++, Java and Python tabs; cp-algorithms uses C++. The Erickson book (revision dated by the PDF itself, not re-checked) is pseudocode.

---

## Phase 15 — Algorithmic patterns

### T15-01 · Two pointers — Master · ✅ written `docs/javascript/pages/phase-15-algorithm-patterns/01-two-pointers/01-opposite-ends.md`
- **Read this:** [Two Pointers](https://usaco.guide/silver/two-pointers) · USACO Guide · opposite-ends search for a sorted pair, then the same-direction window for contiguous subarrays (*read*) · covers our angle: **partial** — no linked-list or string cases, C++ not JavaScript · fetched 2026-10-13
- **Our delta:** strings and linked lists, and the "which pointer moves, and why is it safe" argument.

### T15-02 · Sliding window — Master · ✅ written `docs/javascript/pages/phase-15-algorithm-patterns/02-sliding-window/01-the-template.md`
- **Read this:** [Sliding Window](https://usaco.guide/gold/sliding-window) · USACO Guide · the sliding window as a two-pointer variant, then the O(N) window maximum with a monotonic deque (*read*) · covers our angle: **partial** — numeric windows only, no character-count (anagram, longest substring) problems · fetched 2026-10-13
- **Also good:** [Two Pointers](https://usaco.guide/silver/two-pointers) · USACO Guide · the sliding-window method for contiguous subarrays (*read*) · fetched 2026-10-13
- **Beyond the docs:** [Longest Substring Without Repeating Characters](https://www.hellointerview.com/learn/code/sliding-window/longest-substring-without-repeating-characters) · Hello Interview · a variable-length window with a per-character count dictionary that shrinks from the left on a duplicate, animated step by step; fills the character-count gap the USACO page leaves (Python code) · fetched 2026-10-13 (*read*)
- **Our delta:** the single expand/shrink template applied to string problems.

### T15-03 · Binary search — Master · ✅ written `docs/javascript/pages/phase-15-algorithm-patterns/03-binary-search/01-the-template.md`
- **Read this:** [Binary Search](https://cp-algorithms.com/num_methods/binary_search.html) · cp-algorithms · lower bound as the first element greater or equal to k, upper bound as the first greater than k, plus search on an arbitrary predicate such as an average (*read*) · covers our angle: **full** (C++ code) · fetched 2026-10-13
- **Also good:** [Binary Search](https://usaco.guide/silver/binary-search) · USACO Guide · binary search on the answer needs a monotonic boolean function (*read*) · fetched 2026-10-13
- **Beyond the docs:** [Binary search](https://csa.gigamonkeys.com/slides/binary-search/) · Gigamonkeys CS slides · states the half-open invariant (if the target is present, its index i satisfies low at most i, and i is below high), shows each branch keeping it, and explains the overflow bug in the textbook midpoint; Java code, no lower or upper bound and no search over an answer · fetched 2026-10-13 (*read*)
- **Our delta:** one off-by-one-proof loop in JavaScript, with integer midpoint handled.

### T15-04 · Hash-map patterns — Master · ✅ written `docs/javascript/pages/phase-15-algorithm-patterns/04-hash-map-patterns/01-complement-and-seen.md`
- **Read this:** [Map](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map) · MDN · SameValueZero key equality (`NaN` matches `NaN`, `0` matches `-0`, objects by reference) and insertion-order iteration (*read*) · covers our angle: **partial** — the data structure, not the two-sum or anagram patterns · fetched 2026-10-13
- **Our delta:** the patterns themselves, and why an object key is wrong for signatures made of arrays.

### T15-05 · Recursion and the recursion tree — Understand · 🔲 not written
- **Read this:** [Recursion (Algorithms, chapter 1)](https://jeffe.cs.illinois.edu/teaching/algorithms/book/01-recursion.pdf) · Jeff Erickson · the "Recursion Fairy" way of designing a base case and trusting the smaller calls, with mergesort as a worked case (*read*, via local text extraction) · covers our angle: **partial** — no tree-to-loop conversion · fetched 2026-10-13
- **Also good:** [Too much recursion](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Errors/Too_much_recursion) · MDN · a missing or unreachable base case overflows the stack; Chrome and Safari throw `RangeError`, Firefox `InternalError` (*read*) · fetched 2026-10-13
- **Beyond the docs:** [Recursion Tree and DAG](https://visualgo.net/en/recursion) · VisuAlgo, NUS · draws the recursion tree of a recursive function you write in JavaScript, depth-first, with base cases and repeated subproblems coloured, then the same recursion as a DAG; no stack-to-loop rewrite · fetched 2026-10-13 (*read*, intro and outline)
- **Our delta:** drawing the call tree, and the explicit-stack rewrite for JavaScript's call-depth limit.

### T15-06 · BFS — Master · ✅ written `docs/javascript/pages/phase-15-algorithm-patterns/06-bfs/01-the-template.md`
- **Read this:** [Breadth First Search](https://cp-algorithms.com/graph/breadth-first-search.html) · cp-algorithms · shortest paths in unweighted and 0-1 graphs, shortest cycles (*read*) · covers our angle: **partial** — no level-order tree walk or grid flood fill · fetched 2026-10-13
- **Also good:** [Graph Traversal](https://usaco.guide/silver/graph-traversal) · USACO Guide · BFS visits nodes in order of distance; components and two-colouring (*read*) · fetched 2026-10-13
- **Beyond the docs:** [Introduction to the A* Algorithm](https://www.redblobgames.com/pathfinding/a-star/introduction.html) · Amit Patel, Red Blob Games · BFS drawn as a frontier expanding evenly on a map, the clearest picture of why it finds shortest unweighted paths · fetched 2026-10-13 (*read*)
- **Our delta:** the JavaScript queue trap (`shift` cost) and grid state spaces.

### T15-07 · Prefix sums and difference arrays — Understand · 🔲 not written
- **Read this:** [Competitive Programmer's Handbook](https://cses.fi/book/book.pdf) · Antti Laaksonen · "Sum queries": a prefix array answers range sums in O(1), then the two-dimensional version with the S(A) - S(B) - S(C) + S(D) formula (*read*, via local text extraction; range queries chapter) · covers our angle: **partial** — the difference array appears only later, in the "Range updates" passage of the binary indexed tree chapter, as a way to reuse a tree for range updates; not as a standalone O(n) technique · fetched 2026-10-13
- **Also good:** [Introduction to Prefix Sums](https://usaco.guide/silver/prefix-sums) · USACO Guide · one-dimensional only; the page does not cover 2-D (*read*) · fetched 2026-10-13
- **Our delta:** difference arrays as a plain O(n) tool (range update, one pass to read), and the off-by-one in the 2-D inclusion-exclusion formula.

### T15-08 · Sorting algorithms — Understand · 🔲 not written
- **Read this:** [Sorting (VisuAlgo)](https://visualgo.net/en/sorting) · Steven Halim and Felix Halim, NUS · animated bubble, selection, insertion, merge, quick, counting and radix sort with pseudocode and an e-Lecture; the input can be random, sorted, nearly sorted or duplicate-heavy; has sections on in-place and stable sorting, and notes merge sort needs extra O(N) storage (*read*, e-Lecture text) · covers our angle: **partial** — no JavaScript, no guidance on which to hand-write · fetched 2026-10-13
- **Also good:** [Recursion (Algorithms, chapter 1)](https://jeffe.cs.illinois.edu/teaching/algorithms/book/01-recursion.pdf) · Jeff Erickson · has a section on Mergesort and its history (*read*, via local text extraction) · fetched 2026-10-13
- **Our delta:** a space-cost table across all the algorithms, and which two to write by hand.

### T15-09 · `Array.prototype.sort` in practice — Understand · 🔲 not written
- **Read this:** [Array.prototype.sort](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/sort) · MDN · stable since ECMAScript 2019; comparator must be pure, reflexive, anti-symmetric and transitive; `undefined` goes last and is never passed to the comparator (*read*) · covers our angle: **full** except multi-key sorting · fetched 2026-10-13
- **Also good:** [String.prototype.localeCompare](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/localeCompare) · MDN · for large arrays create one `Intl.Collator` and reuse its `compare` (*read*) · [Stable Array.prototype.sort](https://v8.dev/features/stable-sort) · V8, published 2019-07-02 · sorting objects by a rating field with the stability guarantee shown on a worked example (*read*) · fetched 2026-10-13
- **Beyond the docs:** [Getting things sorted in V8](https://v8.dev/blog/array-sort) · Simon Zünd, v8.dev, 2018-09-28 · why V8 moved to TimSort for stability (V8 7.0 / Chrome 70) and what it did to speed on presorted input · fetched 2026-10-13 (*read*)
- **Our delta:** multi-key comparators and the `(a, b) => a - b` overflow and `NaN` traps.

### T15-10 · DFS — Understand · 🔲 not written
- **Read this:** [Depth First Search](https://cp-algorithms.com/graph/depth-first-search.html) · cp-algorithms · back edges complete cycles, which is how DFS detects them; strongly connected components (*read*) · covers our angle: **partial** — undirected components only in passing · fetched 2026-10-13
- **Also good:** [Graph Traversal](https://usaco.guide/silver/graph-traversal) · USACO Guide · connected components ("Building Roads") with recursive DFS (*read*) · fetched 2026-10-13
- **Beyond the docs:** [Depth-first search revisited](https://www.usna.edu/Users/cs/wcbrown/courses/S18SI335/lec/l15/lec.html) · US Naval Academy SI335 course notes · white / gray / black marking, an iterative version whose stack is exactly the gray path, and a proof that a directed graph has a cycle if and only if the search meets a gray vertex; pseudocode, no undirected case · fetched 2026-10-13 (*read*)
- **Our delta:** the three-colour marking for directed cycles versus parent-skipping for undirected, and an iterative version.

### T15-11 · Backtracking — Understand · 🔲 not written
- **Read this:** [Backtracking (Algorithms, chapter 2)](https://jeffe.cs.illinois.edu/teaching/algorithms/book/02-backtracking.pdf) · Jeff Erickson · opens with the n Queens problem as "the prototypical backtracking problem" and builds the recursion from there (*read*, via local text extraction) · covers our angle: **partial** — pseudocode, no permutations or sudoku · fetched 2026-10-13
- **Beyond the docs:** [Backtracking Algorithm Common Patterns and Code Template](https://labuladong.online/en/algo/essential-technique/backtrack-framework/) · labuladong · backtracking as walking a decision tree, with path, choice list and termination condition, and the make choice / recurse / undo choice loop worked on Permutations; code tabs include JavaScript · fetched 2026-10-13 (*read*)
- **Our delta:** the choose / explore / unchoose template in JavaScript and the copy-on-push trap for results.

### T15-12 · Divide and conquer — Understand · 🔲 not written
- **Read this:** [Master theorem (analysis of algorithms)](https://en.wikipedia.org/wiki/Master_theorem_%28analysis_of_algorithms%29) · Wikipedia · the three cases for T(n) = aT(n/b) + f(n), compared against log base b of a (*read*) · covers our angle: **partial** — formal; our row wants it informal · fetched 2026-10-13
- **Also good:** [Quickselect](https://en.wikipedia.org/wiki/Quickselect) · Wikipedia · expected linear, in place (*read*) · [Recursion (Algorithms, chapter 1)](https://jeffe.cs.illinois.edu/teaching/algorithms/book/01-recursion.pdf) · Jeff Erickson · mergesort and quicksort as divide and conquer, with a Recursion Trees section for solving the recurrences (*read*, via local text extraction) · fetched 2026-10-13
- **Beyond the docs:** [1.9 Master Theorem and Summary of Common Recurrences](https://web.engr.oregonstate.edu/~huanlian/algorithms_course/1-datastructures/master.html) · Oregon State University algorithms course notes · derives the three cases from the recursion tree and names them leaf-heavy, equilibrium and root-heavy, which is the informal "which level dominates" reading our row wants · fetched 2026-10-13 (*read*)
- **Our delta:** the informal "which level dominates" reading of the master theorem.

### T15-13 · Topological sort — Understand · 🔲 not written
- **Read this:** [Topological sorting](https://en.wikipedia.org/wiki/Topological_sorting) · Wikipedia · has both a Kahn's algorithm subsection (repeatedly take vertices with no incoming edges) and a depth-first one (prepend each node after its descendants) (*read*) · covers our angle: **partial** — the dependency framing is only a line or two, no build-order walkthrough · fetched 2026-10-13
- **Also good:** [Topological Sorting](https://cp-algorithms.com/graph/topological-sort.html) · cp-algorithms · DFS version only; no Kahn (*read*) · fetched 2026-10-13
- **Our delta:** the dependency graph you already build at work, and cycle detection as the failure case.

### T15-14 · Dijkstra and A* — Understand · 🔲 not written
- **Read this:** [Introduction to the A* Algorithm](https://www.redblobgames.com/pathfinding/a-star/introduction.html) · Amit Patel, Red Blob Games · BFS, then Dijkstra for varying costs, then A* adding a heuristic toward the goal (*read*) · covers our angle: **partial** — Python, not JavaScript · fetched 2026-10-13
- **Also good:** [Dijkstra](https://cp-algorithms.com/graph/dijkstra.html) · cp-algorithms · non-negative weights; this page uses the O(n squared plus m) linear scan and points to a separate article for the heap version (*read*) · fetched 2026-10-13
- **Our delta:** a JavaScript heap (the language has none built in) and when BFS already suffices.

### T15-15 · Greedy — Understand · 🔲 not written
- **Read this:** [Greedy Algorithms (chapter 4)](https://jeffe.cs.illinois.edu/teaching/algorithms/book/04-greedy.pdf) · Jeff Erickson · uses an inductive exchange argument to justify a greedy choice, the honest answer to "how do you know it is safe" (*read*, via local text extraction) · covers our angle: **partial** · fetched 2026-10-13
- **Also good:** [Greedy Algorithms with Sorting](https://usaco.guide/silver/greedy-sorting) · USACO Guide · earliest-finish interval scheduling, with counterexamples for earliest-start and for coin change `{1, 3, 4}` (*read*) · fetched 2026-10-13
- **Beyond the docs:** [Guide to Greedy Algorithms](https://web.stanford.edu/class/archive/cs/cs161/cs161.1138/handouts/120%20Guide%20to%20Greedy%20Algorithms.pdf) · Stanford CS161 handout, Summer 2013 (July 29, 2013; based on a handout by Tim Roughgarden, Alexa Sharp and Tom Wexler) · how to structure the two proof styles, "greedy stays ahead" and exchange arguments, and when each fits; proof technique, not code · fetched 2026-10-13 (*read*)
- **Our delta:** jump games, and a stated test for when to distrust greedy.

### T15-16 · Intervals — Understand · 🔲 not written
- **Read this:** [Competitive Programmer's Handbook](https://cses.fi/book/book.pdf) · Antti Laaksonen · the "Sweep line algorithms" chapter opens with the maximum number of employees in the office at once, done by sorting arrival and leaving events and counting; the chapter is otherwise geometric (*read*, via local text extraction) · covers our angle: **partial** — overlap counting only, no merge or insert · fetched 2026-10-13
- **Also good:** [Greedy Algorithms with Sorting](https://usaco.guide/silver/greedy-sorting) · USACO Guide · the Movie Festival interval-scheduling example (*read*) · fetched 2026-10-13
- **Our delta:** merge and insert on JavaScript arrays, and the +1/-1 event form of overlap counting in JavaScript.

### T15-17 · Linear-time sorting — Know · 🔲 not written
- **Read this:** [Counting sort](https://en.wikipedia.org/wiki/Counting_sort) · Wikipedia · keys must be non-negative integers, and the key range should not be significantly greater than the number of items; O(n + k) time and space (*read*) · covers our angle: **partial** — counting sort only; bucket and radix are on separate pages · fetched 2026-10-13
- **Also good:** [Sorting (VisuAlgo)](https://visualgo.net/en/sorting) · NUS · animations for counting and radix sort, each with an e-Lecture section (*read*, e-Lecture outline) · fetched 2026-10-13
- **Our delta:** the constraints that make each legal.

### T15-18 · String algorithms — Know · 🔲 not written
- **Read this:** [Prefix function. Knuth-Morris-Pratt](https://cp-algorithms.com/string/prefix-function.html) · cp-algorithms · defines the prefix function and uses it for substring search in O(n + m) (*read*) · covers our angle: **partial** · fetched 2026-10-13
- **Also good:** [String Hashing](https://cp-algorithms.com/string/string-hashing.html) · cp-algorithms · the polynomial rolling hash (*read*) · fetched 2026-10-13
- **Beyond the docs:** [Reconstructing the Knuth-Morris-Pratt algorithm](https://gallium.inria.fr/blog/kmp/) · François Pottier, Gagallium blog, 2013-12-21 · asks "how do I reconstruct it?" rather than "how does it work?", deriving the failure function from a naive search; the code is OCaml · fetched 2026-10-13 (*read*, opening and approach)
- **Our delta:** palindromes, and why `indexOf` is usually the right call.

### T15-19 · Bit manipulation — Know · 🔲 not written
- **Read this:** [Bitwise AND (&)](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Bitwise_AND) · MDN · number operands are converted to 32-bit integers and high bits discarded; mixing BigInt and Number throws `TypeError` (*read*) · covers our angle: **partial** — the 32-bit trap only · fetched 2026-10-13
- **Also good:** [Bit Twiddling Hacks](https://graphics.stanford.edu/~seander/bithacks.html) · Sean Eron Anderson · counting set bits, power-of-two test, XOR swap (*read*) · [Competitive Programmer's Handbook](https://cses.fi/book/book.pdf) · Antti Laaksonen · "Bit representation" and generating subsets with bits (*read*, via local text extraction) · fetched 2026-10-13
- **Beyond the docs:** [A guide to JavaScript bitwise operators](https://blog.logrocket.com/guide-javascript-bitwise-operators/) · LogRocket Blog, editor's note says last updated 13 April 2023 by Ibiyemi Adewakun · every operator with its 32-bit two's complement behaviour, including the sign bit and the 2^31 - 1 limit, then config flags as a mask use case; no subset enumeration · fetched 2026-10-13 (*read*)
- **Our delta:** single-number XOR and subset enumeration with masks in JavaScript.

### T15-20 · Maths for interviews — Know · 🔲 not written
- **Read this:** [Euclidean algorithm for computing the greatest common divisor](https://cp-algorithms.com/algebra/euclid-algorithm.html) · cp-algorithms · O(log min(a, b)) (*read*) · covers our angle: **partial** · fetched 2026-10-13
- **Also good:** [Sieve of Eratosthenes](https://cp-algorithms.com/algebra/sieve-of-eratosthenes.html) · cp-algorithms · marking composites, plus speedups (*read*) · [BigInt](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/BigInt) · MDN · exact beyond 2^53 minus 1, never mixed with Number (*read*) · fetched 2026-10-13
- **Our delta:** modular arithmetic with `BigInt` to avoid overflow.

---

## Phase 16 — Dynamic programming and the harder set

### T16-01 · What DP is — Master · ✅ written `docs/javascript/pages/phase-16-dynamic-programming/01-what-dp-is/01-the-two-conditions.md`
- **Read this:** [Dynamic Programming (chapter 3)](https://jeffe.cs.illinois.edu/teaching/algorithms/book/03-dynprog.pdf) · Jeff Erickson · starts from Fibonacci and shows the repeated subproblems, then the recurrence-first design method (*read*, via local text extraction) · covers our angle: **partial** · fetched 2026-10-13
- **Also good:** [Introduction to DP](https://usaco.guide/gold/intro-dp) · USACO Guide · breaks a problem into reusable subproblems; Frog 1 contrasts exponential recursion with O(N) DP (*read*) · fetched 2026-10-13
- **Beyond the docs:** [Dynamic Programming: From Novice to Advanced](https://www.topcoder.com/thrive/articles/Dynamic%20Programming:%20From%20Novice%20to%20Advanced) · Dumitru, Topcoder tutorials, page dated October 31, 2018 · starts from "what is a state" with a minimum-coins example and builds up by worked examples rather than theory (*read*, opening) · fetched 2026-10-13
- **Our delta:** spotting both conditions from the problem statement.

### T16-02 · Memoization, top-down — Master · ✅ written `docs/javascript/pages/phase-16-dynamic-programming/02-memoization/01-the-transformation.md`
- **Read this:** [Dynamic Programming (chapter 3)](https://jeffe.cs.illinois.edu/teaching/algorithms/book/03-dynprog.pdf) · Jeff Erickson · explains memoization (the name has no R) as the optimisation that stores results and cuts the running time (*read*, via local text extraction) · covers our angle: **partial** — no cache-key design · fetched 2026-10-13
- **Also good:** [Introduction to DP](https://usaco.guide/gold/intro-dp) · USACO Guide · pull DP versus push DP (*read*) · fetched 2026-10-13
- **Our delta:** choosing the cache key in JavaScript (tuple to string, `Map`).

### T16-03 · A problem-solving method — Master · ✅ written `docs/javascript/pages/phase-16-dynamic-programming/03-problem-solving-method/01-the-loop.md`
- **Read this:** [Introduction to DP](https://usaco.guide/gold/intro-dp) · USACO Guide · suggests writing a slower solution first for partial credit, the nearest thing found to the brute-force-then-optimise loop (*read*) · covers our angle: **partial** — one step of seven · fetched 2026-10-13
- **Our delta:** the full clarify, examples, brute force, optimise, code, test, complexity loop. No page found that states it end to end.

### T16-04 · Tabulation, bottom-up — Understand · 🔲 not written
- **Read this:** [Dynamic Programming (chapter 3)](https://jeffe.cs.illinois.edu/teaching/algorithms/book/03-dynprog.pdf) · Jeff Erickson · subproblem dependency figures give a valid evaluation order for the table (*read*, via local text extraction) · covers our angle: **full** (pseudocode) · fetched 2026-10-13
- **Also good:** [Introduction to DP](https://usaco.guide/gold/intro-dp) · USACO Guide · push versus pull as the two ways to fill states (*read*) · fetched 2026-10-13
- **Our delta:** mechanical top-down to bottom-up conversion in JavaScript.

### T16-05 · 1-D DP — Understand · 🔲 not written
- **Read this:** [Dynamic Programming (chapter 3)](https://jeffe.cs.illinois.edu/teaching/algorithms/book/03-dynprog.pdf) · Jeff Erickson · Fibonacci and the Longest Increasing Subsequence section (*read*, via local text extraction) · covers our angle: **partial** — no stairs, house robber or coin change · fetched 2026-10-13
- **Also good:** [Knapsack DP](https://usaco.guide/gold/knapsack) · USACO Guide · CSES Dice Combinations, a recurrence over the previous six values, close to climbing stairs (*read*) · fetched 2026-10-13
- **Beyond the docs:** [One Method to Solve All House Robber Problems](https://labuladong.online/en/algo/dynamic-programming/house-robber/) · labuladong · House Robber 198, 213 and 337 as one "find the state and the choices" method; code tabs include JavaScript; no stairs or coin change · fetched 2026-10-13 (*read*, opening)
- **Our delta:** the four named problems, each as state, transition, base case.

### T16-06 · 2-D DP — Understand · 🔲 not written
- **Read this:** [Dynamic Programming (chapter 3)](https://jeffe.cs.illinois.edu/teaching/algorithms/book/03-dynprog.pdf) · Jeff Erickson · has an Edit Distance section defined over two strings (*read*, via local text extraction) · covers our angle: **partial** · fetched 2026-10-13
- **Also good:** [Knapsack DP](https://usaco.guide/gold/knapsack) · USACO Guide · the worked example is Dice Combinations (unbounded, one dimension); 0/1 knapsack appears only as a resource link to the Competitive Programmer's Handbook and an Errichto video (*read*) · fetched 2026-10-13
- **Beyond the docs:** [Lecture 20: Edit distance (via Dynamic Programming)](https://opencourse.inf.ed.ac.uk/sites/default/files/2026-01/iads_20_edit.pdf) · Mary Cryan, University of Edinburgh IADS slides · edit distance as sequence alignment, a recurrence for d[i, j] over two prefixes, then the table fill; pseudocode, no LCS or grid paths · fetched 2026-10-13 (*read*)
- **Our delta:** grid paths and LCS, plus table-filling order in JavaScript.

### T16-07 · State design — Understand · 🔲 not written
- **Read this:** [Dynamic Programming (chapter 3)](https://jeffe.cs.illinois.edu/teaching/algorithms/book/03-dynprog.pdf) · Jeff Erickson · defines each subproblem in words first (for LIS, LISbigger(i, j) is the longest increasing subsequence of A[j..n] whose elements all exceed A[i]; the second recurrence, LISfirst(i), is the one that starts with A[i]) before writing the recurrence (*read*, via local text extraction) · covers our angle: **partial** · fetched 2026-10-13
- **Also good:** [How to Design Transition Equations](https://labuladong.online/en/algo/dynamic-programming/longest-increasing-subsequence/) · labuladong · Longest Increasing Subsequence worked by induction: assume the earlier states, then ask how they give the next one (*read*, opening) · fetched 2026-10-13
- **Beyond the docs:** [Dynamic Programming States and State Transitions](https://www.redgreencode.com/dynamic-programming-states-and-state-transitions/) · Duncan Smith, Red-Green-Code (page shows Feb 14, no year) · a state is the set of variables that uniquely identifies a subproblem; inputs shared by every subproblem, like coin denominations in Coin Change, are not state (*read*) · fetched 2026-10-13
- **Our delta:** the naming discipline as a checklist.

### T16-08 · Space optimisation — Understand · 🔲 not written
- **Read this:** [state-compression](https://labuladong.gitbook.io/algo-en/dynamic-programming/state-compression) · labuladong (algo-en) · the rolling-array idea: if the transition depends only on adjacent states, keep only those; says outright that it is optional because it makes code harder to read and debug, and shows iterating in reverse to keep the transitions correct (*read*) · covers our angle: **partial** — Java and C++ style code on the English gitbook, not JavaScript · fetched 2026-10-13
- **Also good:** [Knapsack DP](https://usaco.guide/gold/knapsack) · USACO Guide · the Dice Combinations recurrence reads only the previous six dp values, so it is a rolling-window case, but the page never says so and never discusses space reduction (*read*) · fetched 2026-10-13
- **Our delta:** one-row knapsack iteration direction in JavaScript, and when the readability cost is not worth it.

### T16-09 · DP on strings — Understand · 🔲 not written
- **Read this:** [Dynamic Programming (chapter 3)](https://jeffe.cs.illinois.edu/teaching/algorithms/book/03-dynprog.pdf) · Jeff Erickson · Edit Distance: insertions, deletions and substitutions turning one string into another, with FOOD to MONEY as the example (*read*, via local text extraction) · covers our angle: **partial** — no palindromic substrings or wildcard/regex matching · fetched 2026-10-13
- **Beyond the docs:** [regular-expression](https://labuladong.gitbook.io/algo-en/dynamic-programming/regular-expression) · labuladong (algo-en) · LeetCode 10, matching a pattern with `.` and `*` against a text, built on the edit-distance article; covers regex but not wildcard-only or palindromic substrings · fetched 2026-10-13 (*read*, opening)
- **Our delta:** palindromic substrings and wildcard/regex matching.

### T16-10 · Monotonic stack and monotonic queue — Understand · 🔲 not written
- **Read this:** [Monotonic Stack Code Template](https://labuladong.online/en/algo/data-structure/monotonic-stack/) · labuladong · next greater element (LeetCode 496, 503) and daily temperatures (739) from one template, scanning right to left (*read*) · covers our angle: **partial** — no queue · fetched 2026-10-13
- **Also good:** [Sliding Window](https://usaco.guide/gold/sliding-window) · USACO Guide · monotonic queue for the O(N) window maximum, elements leave the front when out of range (*read*) · fetched 2026-10-13
- **Our delta:** one invariant statement for both structures.

### T16-11 · Top-K and streaming — Understand · 🔲 not written
- **Read this:** [Quickselect](https://en.wikipedia.org/wiki/Quickselect) · Wikipedia · expected O(n), worst case O(n squared), in place (*read*) · covers our angle: **partial** — no heap comparison · fetched 2026-10-13
- **Also good:** [Reservoir sampling](https://en.wikipedia.org/wiki/Reservoir_sampling) · Wikipedia · Algorithm R: fill k slots, then replace slot j with probability based on the item's position (*read*) · fetched 2026-10-13
- **Our delta:** the heap versus quickselect versus sort decision table.

### T16-12 · Randomised algorithms — Understand · 🔲 not written
- **Read this:** [Fisher-Yates shuffle](https://en.wikipedia.org/wiki/Fisher%E2%80%93Yates_shuffle) · Wikipedia · modulo bias, and that shuffling by sorting with a random comparator is likely to produce highly non-uniform distributions (*read*) · covers our angle: **partial** — no measurement in JavaScript · fetched 2026-10-13
- **Also good:** [Fisher-Yates Shuffle](https://bost.ocks.org/mike/shuffle/) · Mike Bostock · walks from a slow shuffle to the in-place linear one, with JavaScript code; it does not discuss sort-based bias (*read*) · [The Danger of Naïveté](https://blog.codinghorror.com/the-danger-of-naivete/) · Jeff Atwood, 2007-12-07 · a plausible-looking shuffle with 27 equally likely swap sequences against 6 orderings, so some orderings must come up more often; written about C#, the reasoning transfers (*read*) · fetched 2026-10-13
- **Beyond the docs:** [Shuffle an array](https://javascript.info/task/shuffle) · javascript.info · runs `array.sort(() => Math.random() - 0.5)` one million times on `[1, 2, 3]` and tallies the six orderings, showing two of them far more frequent in its example run (engine-dependent); this is the measurement our delta describes · fetched 2026-10-13 (*read*)
- **Our delta:** counting the `sort(() => Math.random() - 0.5)` bias in V8 over many runs.

### T16-13 · Async-flavoured problems — Understand · 🔲 not written
- **Read this:** [Scaling your API with rate limiters](https://stripe.com/blog/rate-limiters) · Paul Tarjan, Stripe, 2017-03-30 · four limiter types in production, among them a request rate limiter (N requests per second) and a concurrent-requests limiter (N in flight at once, which is the semaphore shape; the page does not use that word) (*read*) · covers our angle: **partial** — design, not JavaScript code; no token bucket walkthrough, no dependency scheduler · fetched 2026-10-13
- **Also good:** [Token bucket rate limiter with Redis and Node.js](https://redis.io/docs/latest/develop/use-cases/rate-limiter/nodejs/) · Redis docs · the token bucket (capacity, constant refill, atomic take) written as a Lua script called from Node.js with async/await; distributed, not an in-process limiter (*read*) · fetched 2026-10-13
- **Our delta:** promise-based task scheduler with dependencies, token bucket and semaphore in JavaScript. No readable explanation of the scheduler or semaphore found.

### T16-14 · DP on trees and graphs — Know · 🔲 not written
- **Read this:** [DP on Trees - Introduction](https://usaco.guide/gold/dp-trees) · USACO Guide · roots the tree and defines two states per node (dp1 and dp2) for CSES Tree Matching, with a greedy alternative (*read*) · covers our angle: **partial** · fetched 2026-10-13
- **Beyond the docs:** [Dynamic Programming (CSE 421 lecture slides)](https://courses.cs.washington.edu/courses/cse421/22sp/lecture-20.pdf) · Shayan Oveis Gharan, University of Washington · longest path in a DAG: order the vertices topologically, let OPT(j) be the longest path ending at j, then a parent pointer to recover the path; pseudocode · fetched 2026-10-13 (*read*)
- **Our delta:** DAG DP in topological order; the link to T15-13 (topological sort) is the prerequisite.

### T16-15 · Matrix and simulation problems — Know · 🔲 not written
- **Read this:** [Conway's Game of Life](https://en.wikipedia.org/wiki/Conway%27s_Game_of_Life) · Wikipedia · the rules (B3/S23): each cell's next state depends on its eight neighbours, evolving in discrete generations (*read*) · covers our angle: **partial** — the rules only; nothing on simulating a generation in place · fetched 2026-10-13
- **Our delta:** spiral order and in-place rotate; no explanation found for either.

### T16-16 · Recognising NP-hardness — Know · 🔲 not written
- **Read this:** [NP-Hardness (chapter 12)](https://jeffe.cs.illinois.edu/teaching/algorithms/book/12-nphard.pdf) · Jeff Erickson · NP-hard, NP-easy and NP-complete defined, with reductions (*read*, via local text extraction) · covers our angle: **partial** — recognition, not the approximation step · fetched 2026-10-13
- **Also good:** [Approximation algorithm](https://en.wikipedia.org/wiki/Approximation_algorithm) · Wikipedia · the simple edge-picking vertex cover is within a factor of 2; Christofides gives 3/2 for metric TSP (*read*) · fetched 2026-10-13
- **Beyond the docs:** [More Reductions (CSE 421 Autumn 22, Lecture 26)](https://courses.cs.washington.edu/courses/cse421/22au/lecture/26-reductions2.pdf) · University of Washington lecture slides · P, NP, NP-hard and NP-complete with a map of where known problems sit, and how to prove a suspected problem NP-hard by reducing from 3-SAT; proof technique, not interview advice · fetched 2026-10-13 (*read*)
- **Our delta:** the "say so, then offer an approximation" interview script.
