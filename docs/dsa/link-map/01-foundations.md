---
title: "Link map · DSA · Part 1 (phases 0–2)"
sidebar_label: "01 · foundations"
sidebar_position: 1
---

# Link map · DSA · Part 1 (phases 0–2)

Covers every topic row of phases 0, 1 and 2 in `docs/dsa/syllabus/01-foundations.md`: the interview and practice system (T00-01 to T00-14), complexity analysis (T01-01 to T01-11) and recursion, maths and bits (T02-01 to T02-13). That is 38 rows, and each has a written page of ours (a chunked topic shows its first chunk file).
*read* = I read the passage that supports the claim in the fetched text; *headings only* = fetched at 200 and the headings or opening checked. Third-party links carry a date only where the page shows one. No `#anchors` are given. Where no good non-official explanation turned up, the block has no "Beyond the docs" line. "Official" means canonical references (cp-algorithms, Princeton algs4, MDN, the Java docs, Wikipedia for definitions). Phase 0 is process advice, so its picks are mostly interview-prep writing, and the claims in them are one author's view. Tier words are the tier badges in the syllabus tables.
Two things to know. LeetCode problem pages returned 403 to the fetcher, so no problem links are given. cp-algorithms, MDN and the Java SE 25 docs were live on 2026-10-14. The language of each Beyond pick is noted (JavaScript, Python, Java, or language-neutral); our solutions are TypeScript first, Java second.

---

## Phase 0 — The DSA interview and the practice system

### T00-01 · What the coding rounds grade — Master · ✅ written `docs/dsa/pages/phase-0-the-interview-and-practice/01-what-the-coding-rounds-grade.md`
- **Read this:** [Coding interview signals](https://www.techinterviewhandbook.org/coding-signals/) · Tech Interview Handbook · four graded dimensions: communication, problem solving (including whether hints were needed), technical competency (working, clean code) and testing (*read*) · covers our angle: **partial** — no senior-level follow-up that changes constraints · fetched 2026-10-14
- **Beyond the docs:** [Technical interview rubric: how companies score coding, design and communication](https://prachub.com/resources/technical-interview-rubric-how-companies-score-coding-design-and-communication) · PracHub, 2026-08-03 · a 1 to 4 self-scoring rubric tied to observed evidence, with handling hints and adapting to new information under communication; language-neutral (*read*) · fetched 2026-10-14
- **Our delta:** the senior twist (the follow-up that changes the constraints) is not in either page.

### T00-02 · The 45-minute shape — Master · ✅ written `docs/dsa/pages/phase-0-the-interview-and-practice/02-the-45-minute-shape.md`
- **Read this:** [Coding interview cheatsheet](https://www.techinterviewhandbook.org/coding-interview-cheatsheet/) · Tech Interview Handbook · six steps: clarify, agree an approach with the interviewer (a few minutes, up to 5 to 10 on hard ones), code only after the go-ahead, then test and restate complexity (*read*) · covers our angle: **partial** — gives few minute counts, no full 45-minute budget · fetched 2026-10-14
- **Our delta:** the per-phase time box and the "start typing now" trigger are ours; published budgets differ by source, so none is quoted.

### T00-03 · The method: understand, match, plan, implement, review, evaluate — Master · ✅ written `docs/dsa/pages/phase-0-the-interview-and-practice/03-the-method.md`
- **Read this:** [UMPIRE Interview Strategy](https://guides.codepath.org/compsci/UMPIRE-Interview-Strategy) · CodePath · the six steps under their names; Match means naming the problem category and which patterns are likely, unlikely or neutral; Review means checking the code like a debugger assuming a bug exists (*read*) · covers our angle: **full** — the same six steps; it redirects from guides.codepath.com · fetched 2026-10-14
- **Our delta:** the pattern index this track builds, so Match has something to match against.

### T00-04 · Language choice and runtime traps — Master · ✅ written `docs/dsa/pages/phase-0-the-interview-and-practice/04-language-choice-and-runtime-traps.md`
- **Read this:** [Array.prototype.sort](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/sort) · MDN · stable since ES2019; default order is by string, so `[1, 30, 4, 21, 100000].sort()` is not numeric; the comparator must be consistent or behaviour differs per engine (*read*) · covers our angle: **partial** — the sort trap only · fetched 2026-10-14
- **Also good:** [Number.MAX_SAFE_INTEGER](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number/MAX_SAFE_INTEGER) · MDN · safe range plus or minus 2^53 - 1, and `MAX_SAFE_INTEGER + 1 === MAX_SAFE_INTEGER + 2` (*read*) · fetched 2026-10-14
- **Also good:** [Integer.valueOf and Integer.compare](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/lang/Integer.html) · Java SE 25 API · `valueOf` always caches -128 to 127, which is why `==` on boxed values misleads; `Integer.compare` is the overflow-safe comparator (*read*) · fetched 2026-10-14
- **Our delta:** no built-in heap or sorted map in JavaScript, Node's recursion depth and string cost; no fetched source states these, so they stand on our own page. Java's `Math.multiplyExact` is under T02-05.

### T00-05 · Reading the constraints — Master · ✅ written `docs/dsa/pages/phase-0-the-interview-and-practice/05-reading-the-constraints.md`
- **Beyond the docs:** [Read Constraints the Right Way](https://dev.to/alimalim77/read-constraints-the-right-way-3aka) · Alim Mohammad, DEV Community, 2022-10-31 · a list pairing input size with allowed complexity (N = 10^5 allows N, N log N, N root N; N up to about 20 allows exponential) and a constraint-to-approach list; language-neutral (*read*) · covers our angle: **full** · fetched 2026-10-14
- **Our delta:** no canonical reference was fetchable (the CSES handbook PDF is not text-extractable here, the Codeforces blog returned 403), so this block has only the one pick; the divide-by-hundreds-of-millions-per-second reasoning is ours.

### T00-06 · Spaced repetition and the mistake log — Master · ✅ written `docs/dsa/pages/phase-0-the-interview-and-practice/06-spaced-repetition-and-the-mistake-log.md`
- **Beyond the docs:** [Spaced repetition for LeetCode](https://studycardsai.com/blog/spaced-repetition-for-leetcode) · Charlie Groves, StudyCards AI, 2026-05-30 · first review at 24 hours, easy solves move to 3 days, a failed review resets to 1 day; suggests 1, 3, 7, 14 days; does not recommend a dedicated mistake log (*read*) · covers our angle: **partial** · fetched 2026-10-14
- **Our delta:** the 3, 7 and 21-day schedule and logging why a problem was missed are ours; the page is a vendor blog.

### T00-07 · The "when stuck" protocol — Master · ✅ written `docs/dsa/pages/phase-0-the-interview-and-practice/07-the-when-stuck-protocol.md`
- **Beyond the docs:** [What to do when you get stuck in a coding interview](https://prachub.com/resources/what-to-do-when-you-get-stuck-in-a-coding-interview-hints-recovery-and-communication) · PracHub · "name, shrink, ask": restate the contract, put a correct baseline on the table, use a tiny example to recover the invariant, then ask for the smallest useful hint and apply it aloud (*read*) · covers our angle: **full** · fetched 2026-10-14
- **Our delta:** the explicit "name the bottleneck" step and the time before asking.

### T00-08 · Testing your own code live — Master · ✅ written `docs/dsa/pages/phase-0-the-interview-and-practice/08-testing-your-own-code-live.md`
- **Beyond the docs:** [5 effective strategies for dry running code with test cases](https://algocademy.com/blog/5-effective-strategies-for-dry-running-code-with-test-cases/) · AlgoCademy, 2025-01-06 · hand-tracing, simple cases first, and the edge cases empty, minimum and maximum, single element, negatives; language-neutral (*read*) · covers our angle: **partial** — no off-by-one boundary method · fetched 2026-10-14
- **Also good:** [Coding interview signals](https://www.techinterviewhandbook.org/coding-signals/) · Tech Interview Handbook · the Testing signal: typical cases, corner cases, self-corrected bugs (*read*) · fetched 2026-10-14
- **Our delta:** the off-by-one hunt at every boundary and the overflow edge case.

### T00-09 · The ladders — Understand · ✅ written `docs/dsa/pages/phase-0-the-interview-and-practice/09-the-ladders.md`
- **Beyond the docs:** [LeetCode patterns by frequency: Top 75, Blind 75, NeetCode 150 compared](https://www.techinterview.org/post/3233474682/leetcode-patterns-by-frequency/) · techinterview.org, 2026-04-27 (updated 2026-07-13) · NeetCode 150 extends Top 75 with 75 more problems on the same pattern structure; suggested 2 to 3 months for the first, 3 to 5 for the second; notes Blind 75 is light on graphs and advanced DP (*read*) · covers our angle: **partial** · fetched 2026-10-14
- **Our delta:** how each list maps to our phases and why order beats count; the page is a comparison, not an official list.

### T00-10 · Mock interviews — Understand · ✅ written `docs/dsa/pages/phase-0-the-interview-and-practice/10-mock-interviews.md`
- **Beyond the docs:** [How to think out loud in a coding interview](https://ad.intervue.io/blog/how-to-think-out-loud-coding-interview) · Sakshi Jhunjhunwala, Intervue.io, 2026-07-23 · practice methods: record yourself, take turns with a peer and give feedback at the end, then expert mocks (the last is a vendor pitch); language-neutral (*read*) · covers our angle: **partial** — no rubric · fetched 2026-10-14
- **Also good:** [Technical interview rubric](https://prachub.com/resources/technical-interview-rubric-how-companies-score-coding-design-and-communication) · PracHub, 2026-08-03 · a 4-level self-scoring rubric for grading a timed practice session (*read*) · fetched 2026-10-14
- **Our delta:** grading peers against our own rubric from T00-01.

### T00-11 · Communication mechanics — Understand · ✅ written `docs/dsa/pages/phase-0-the-interview-and-practice/11-communication-mechanics.md`
- **Beyond the docs:** [How to think out loud in a coding interview](https://ad.intervue.io/blog/how-to-think-out-loud-coding-interview) · Intervue.io, 2026-07-23 · name the pattern and why, narrate while coding, voice mistakes as you catch them, finish with a walkthrough, time and space, edge cases and what you would improve (*read*) · covers our angle: **full** except naming the invariant · fetched 2026-10-14
- **Our delta:** stating the invariant before the code; the page does not use that word.

### T00-12 · Java's collections for interviews — Understand · ✅ written `docs/dsa/pages/phase-0-the-interview-and-practice/12-javas-collections-for-interviews.md`
- **Read this:** [PriorityQueue](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/util/PriorityQueue.html) · Java SE 25 API · O(log n) for `offer`, `poll`, `remove()` and `add`; linear for `remove(Object)` and `contains`; constant for `peek`; iteration order is not sorted (*read*) · covers our angle: **partial** — one class · fetched 2026-10-14
- **Also good:** [TreeMap](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/util/TreeMap.html) · Java SE 25 API · log(n) for `containsKey`, `get`, `put`, `remove`; the ordering must be consistent with `equals` or the map breaks the `Map` contract (*read*) · fetched 2026-10-14
- **Also good:** [ArrayDeque](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/util/ArrayDeque.html) · Java SE 25 API · most operations amortised constant; `remove(Object)`, `contains` and iterator removal are linear; null elements are prohibited; likely faster than `Stack` and `LinkedList` (*read*) · fetched 2026-10-14
- **Our delta:** the short list of APIs to know cold, and the comparator-ties-lose-keys trap in one place.

### T00-13 · How this track relates to the JavaScript track — Know · ✅ written `docs/dsa/pages/phase-0-the-interview-and-practice/13-how-this-track-relates-to-javascript.md`
- **Read this:** [Map](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map) · MDN · the spec only requires access times that are on average sublinear, so a hash table or a search tree both qualify; iteration is in insertion order (*read*) · covers our angle: **partial** — one example of language-level guarantees vs interview use · fetched 2026-10-14
- **Our delta:** this row is about our own cross-links to phases 13 to 17 of the JavaScript track; no external page covers it.

### T00-14 · Competitive programming vs interviews — Know · ✅ written `docs/dsa/pages/phase-0-the-interview-and-practice/14-competitive-programming-vs-interviews.md`
- **Beyond the docs:** [CPFAQ: How do coding interviews differ from coding contests?](https://www.redgreencode.com/cpfaq-how-do-coding-interviews-differ-from-coding-contests/) · Duncan Smith, RedGreenCode, 13 December (year not shown) · contests are machine-judged so syntax must be exact, interviews are a conversation with a human; contests are narrow and deep, interviews cover a common CS core (*read*) · covers our angle: **full** · fetched 2026-10-14
- **Our delta:** contests as timed practice only, with what transfers (speed, pattern recognition) named.

---

## Phase 1 — Complexity analysis

### T01-01 · Big-O, Theta and Omega — Master · ✅ written `docs/dsa/pages/phase-1-complexity/01-big-o-theta-and-omega.md`
- **Read this:** [Big O notation](https://en.wikipedia.org/wiki/Big_O_notation) · Wikipedia · formal definition, Knuth's big Omega (the reverse of big O) and big Theta (both bounds), with worked bounds such as 6x^4 - 2x^3 + 5 is O(x^4) (*read*) · covers our angle: **partial** — the definitions, not what an interviewer means by "complexity" · fetched 2026-10-14
- **Also good:** [Analysis of algorithms](https://algs4.cs.princeton.edu/14analysis/) · Princeton Algorithms, 4th ed. · order-of-growth classes and tilde notation, which keeps the leading constant that big-O drops (*read*) · fetched 2026-10-14
- **Our delta:** "tight worst-case bound of your code" as the working meaning, and when constants matter.

### T01-02 · Reading complexity off code — Master · ✅ written `docs/dsa/pages/phase-1-complexity/02-reading-complexity-off-code.md`
- **Read this:** [Time Complexity Analysis of Loop in Programming](https://www.enjoyalgorithms.com/blog/time-complexity-analysis-of-loop-in-programming/) · EnjoyAlgorithms (no byline or date shown) · nested loops, a dependent inner loop (`j = i + 1` gives n(n-1)/2, still O(n^2)), and halving loops giving O(log n) (*read*) · covers our angle: **partial** — no recursion trees and no two-pointer or monotonic-stack case · fetched 2026-10-14
- **Our delta:** the loop that looks quadratic but is linear (each pointer or stack element moves once).

### T01-03 · Amortised analysis — Master · ✅ written `docs/dsa/pages/phase-1-complexity/03-amortised-analysis.md`
- **Read this:** [Lecture 21: Amortized Analysis](https://www.cs.cornell.edu/courses/cs3110/2009fa/lectures/lec21.html) · Cornell CS 3110 · dynamic array doubling by the potential method, potential 2n - m, amortised cost 3 per insert; notes the banker's method gives the same (*read*) · covers our angle: **partial** — no union-find and no one-sentence form · fetched 2026-10-14
- **Also good:** [Analysis of algorithms](https://algs4.cs.princeton.edu/14analysis/) · Princeton Algorithms · defines amortised analysis as a worst-case guarantee over a sequence of operations (*read*) · fetched 2026-10-14
- **Our delta:** the one-sentence version for the interviewer and union-find.

### T01-04 · Space and the recursion stack — Master · ✅ written `docs/dsa/pages/phase-1-complexity/04-space-and-the-recursion-stack.md`
- **Read this:** [Proper tail calls in JavaScript](https://www.mgmarlow.com/words/2021-03-27-proper-tail-calls-js/) · Graham Marlow, 2021-03-27 · only Safari's JavaScriptCore supports proper tail calls; V8 implemented them and removed them (*read*) · covers our angle: **partial** — the V8 half only; JavaScript-specific · fetched 2026-10-14
- **Also good:** [Analysis of algorithms](https://algs4.cs.princeton.edu/14analysis/) · Princeton Algorithms · the "Memory usage" section on estimating space for primitives, objects and arrays (*read*) · fetched 2026-10-14
- **Our delta:** auxiliary space vs in-place, and the depth of a recursive DFS; a blog about a 2016 V8 change, not a current V8 doc.

### T01-05 · The common classes and what the limits imply — Master · ✅ written `docs/dsa/pages/phase-1-complexity/05-the-common-classes-and-what-the-limits-imply.md`
- **Read this:** [Time Complexity](https://www.cs.kzoo.edu/cs210/resources/TimeComplexity.html) · Kalamazoo College CS 210 notes, 2025-09-25 (the page credits Google Gemini with edits by Alyce Brady) · the seven classes from O(1) to O(n!) with an example each (*read*) · covers our angle: **partial** — no input-size table · fetched 2026-10-14
- **Also good:** [Read Constraints the Right Way](https://dev.to/alimalim77/read-constraints-the-right-way-3aka) · Alim Mohammad, 2022-10-31 · the size-to-class mapping (*read*) · fetched 2026-10-14
- **Also good:** [Big-O Cheat Sheet](https://www.bigocheatsheet.com/) · bigocheatsheet.com · complexity chart, data-structure operations and sorts (*headings only*) · fetched 2026-10-14
- **Our delta:** our input-size table is the primary here.

### T01-06 · Hidden costs — Master · ✅ written `docs/dsa/pages/phase-1-complexity/06-hidden-costs.md`
- **Beyond the docs:** [Efficient string building in JavaScript](https://dev.to/andreygermanov/efficient-string-building-in-javascript-2bej) · Andrey Germanov, DEV Community, 2022-11-25 (edited 2023-03-22) · repeated `+=` copies the string each time; his test of 100 million appends took about 1 min 26 s vs about 8 s with `push` then one `join`; he says engines differ, and the page does not mention V8 ropes (*read*) · covers our angle: **partial** — strings only; JavaScript-specific · fetched 2026-10-14
- **Our delta:** slicing and spreading arrays, `includes` in a loop, substring copies, hash collisions. Searched for a single source on `includes` in a loop and found none.

### T01-07 · Complexity of the built-ins — Master · ✅ written `docs/dsa/pages/phase-1-complexity/07-complexity-of-the-built-ins.md`
- **Read this:** [Map](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map) · MDN · the spec only demands average sublinear access (O(1) hash or O(log N) tree both fit) (*read*) · covers our angle: **partial** — Map only · fetched 2026-10-14
- **Also good:** [PriorityQueue](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/util/PriorityQueue.html) and [TreeMap](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/util/TreeMap.html) · Java SE 25 API · the stated costs for each (*read*) · fetched 2026-10-14
- **Also good:** [Array.prototype.sort](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/sort) · MDN · stable since ES2019; gives no complexity figure (*read*) · fetched 2026-10-14
- **Our delta:** `indexOf`, front removal with `shift` (engines optimise some cases, the spec is generic and linear) and Java list implementations; no pick found for `shift` that I could fetch.

### T01-08 · Recurrences and the master theorem — Understand · ✅ written `docs/dsa/pages/phase-1-complexity/08-recurrences-and-the-master-theorem.md`
- **Read this:** [Master Theorem and Summary of Common Recurrences](https://web.engr.oregonstate.edu/~huanlian/algorithms_course/1-datastructures/master.html) · Oregon State course notes · the three cases as leaf-heavy, equilibrium and root-heavy, with merge sort (case 2, n log n) and binary search (case 2, log n) worked (*read*) · covers our angle: **full** · fetched 2026-10-14
- **Also good:** [Master theorem (analysis of algorithms)](https://en.wikipedia.org/wiki/Master_theorem_(analysis_of_algorithms)) · Wikipedia · generic form, an example per case, inadmissible equations, and a table for common algorithms (*headings only*) · fetched 2026-10-14
- **Our delta:** tree recursion (two calls on n-1) is outside the theorem; we say so.

### T01-09 · Best, average and worst — Understand · ✅ written `docs/dsa/pages/phase-1-complexity/09-best-average-and-worst.md`
- **Read this:** [Quicksort](https://en.wikipedia.org/wiki/Quicksort) · Wikipedia · worst case O(n^2) when a partition leaves n - 1, average O(n log n), pivot choices, and the randomised pivot's expected bound holding for any input (*read*, first 100,000 characters) · covers our angle: **partial** — nothing on hashing · fetched 2026-10-14
- **Also good:** [Map](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map) · MDN · "on average" is the wording the spec uses for hashing-style structures (*read*) · fetched 2026-10-14
- **Our delta:** which case to state and why, hash worst case vs average.

### T01-10 · Benchmarking vs analysis — Know · ✅ written `docs/dsa/pages/phase-1-complexity/10-benchmarking-vs-analysis.md`
- **Read this:** [Experimental analysis](https://tarjotin.cs.aalto.fi/CS-A1140/2023/notes/intro-experimental.html) · Aalto CS-A1140 notes, 2023 · constant factors matter in practice (68 s vs 0.45 s on the same-scaling matrix multiply); JIT and garbage collection make short JVM timings unreliable (*read*) · covers our angle: **partial** — Scala and JVM-flavoured; no cache-effect explanation · fetched 2026-10-14
- **Also good:** [Analysis of algorithms](https://algs4.cs.princeton.edu/14analysis/) · Princeton Algorithms · the "Observations" section with a doubling test (*read*) · fetched 2026-10-14
- **Our delta:** why an n log n solution can beat a linear one at real sizes. A search for a clean source on that exact case found none.

### T01-11 · Proving optimality — Know · ✅ written `docs/dsa/pages/phase-1-complexity/11-proving-optimality.md`
- **Read this:** [Sorting lower bound](https://tarjotin.cs.aalto.fi/cs-a1141/OpenDSA/Books/CS-A1141/html/SortingLowerBound.html) · Aalto OpenDSA · the decision-tree argument in three steps: comparisons form a tree, at least n! leaves, depth at least Omega(n log n) (*read*) · covers our angle: **partial** — outlines the steps; the `2^d >= n!` step is left out · fetched 2026-10-14
- **Our delta:** the missing step (`n! <= 2^d`, so `d >= log n!`) and answering "can we do better?" in a sentence.

---

## Phase 2 — Recursion, maths and bits

### T02-01 · Recursion and the call stack — Master · ✅ written `docs/dsa/pages/phase-2-recursion-maths-bits/01-recursion-and-the-call-stack.md`
- **Read this:** [Too much recursion](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Errors/Too_much_recursion) · MDN · the error appears with a missing base case or with a correct one that goes too deep; Chrome says `Maximum call stack size exceeded`; gives no depth figure (*read*) · covers our angle: **partial** · fetched 2026-10-14
- **Beyond the docs:** [Converting recursion to iteration using a stack](https://dev.to/frorning/converting-recursion-to-iteration-using-a-stack-a-practical-guide-n0m) · Piyush Chauhan, DEV Community, 2024-12-14 · five steps (push the start state, loop, base case becomes `continue`, process, push next states) with an in-order traversal in JavaScript (*read*) · fetched 2026-10-14
- **Our delta:** the resume-point frame for post-order work, and Node's depth as a constraint; the post covers only the simple case.

### T02-02 · Divide and conquer — Master · ✅ written `docs/dsa/pages/phase-2-recursion-maths-bits/02-divide-and-conquer.md`
- **Read this:** [Mergesort](https://algs4.cs.princeton.edu/22mergesort/) · Princeton Algorithms · mergesort as the standard divide-and-conquer example, top-down and bottom-up, with the compare bounds stated (not derived) (*read*) · covers our angle: **partial** — no inversion counting; Java · fetched 2026-10-14
- **Also good:** [Quickselect](https://en.wikipedia.org/wiki/Quickselect) · Wikipedia · partition then recurse into one side; O(n) average, O(n^2) worst; median of medians for worst-case linear (*read*) · fetched 2026-10-14
- **Our delta:** counting inversions in the merge step. Kleinberg and Tardos' slides (Princeton) cover it but were too large for the fetcher, so they are not linked.

### T02-03 · Mathematical foundations — Master · ✅ written `docs/dsa/pages/phase-2-recursion-maths-bits/03-mathematical-foundations.md`
- **Read this:** [Euclidean algorithm for computing the greatest common divisor](https://cp-algorithms.com/algebra/euclid-algorithm.html) · cp-algorithms · algorithm, a Lamé's-theorem argument for O(log) steps (stated, not fully proved), LCM from GCD with the overflow note, binary GCD (*read*) · covers our angle: **partial** — GCD and LCM only · fetched 2026-10-14
- **Also good:** [Sieve of Eratosthenes](https://cp-algorithms.com/algebra/sieve-of-eratosthenes.html) · cp-algorithms · O(n log log n) analysis, segmented sieve, linear sieve pointer (*read*) · fetched 2026-10-14
- **Also good:** [Integer factorization](https://cp-algorithms.com/algebra/factorization.html) · cp-algorithms · trial division with wheel and precomputed primes, then Pollard's methods (*headings only*) · fetched 2026-10-14
- **Beyond the docs:** [Modular arithmetic](https://usaco.guide/gold/modular) · USACO Guide · why results are taken modulo a large prime (10^9+7 and 998,244,353 named as the common ones) to avoid overflow; Python and C++ code (*read*) · fetched 2026-10-14

### T02-04 · Bit manipulation — Master · ✅ written `docs/dsa/pages/phase-2-recursion-maths-bits/04-bit-manipulation.md`
- **Read this:** [Bit manipulation](https://cp-algorithms.com/algebra/bit-manipulation.html) · cp-algorithms · set, clear, flip, check a bit; clear the right-most set bit; Brian Kernighan's popcount; power-of-two test (*headings only*) · covers our angle: **partial** — C++, no XOR problems · fetched 2026-10-14
- **Also good:** [Bit Twiddling Hacks](https://graphics.stanford.edu/~seander/bithacks.html) · Sean Eron Anderson, Stanford · power-of-two test `v & (v - 1)` with the zero fix, several popcount methods, XOR swap; `v & -v` appears only in passing; C (*read*) · fetched 2026-10-14
- **Beyond the docs:** [Bit manipulation interview patterns: XOR tricks, bit masks, power of two](https://www.techinterview.org/post/3233466313/bit-manipulation-patterns/?format=md) · techinterview.org, 2026-04-16 · single number via XOR, `n & (n-1)`, get/set/clear/toggle, counting bits by DP, swap without a temp; Python (*read*) · fetched 2026-10-14

### T02-05 · Integer limits and overflow — Master · ✅ written `docs/dsa/pages/phase-2-recursion-maths-bits/05-integer-limits-and-overflow.md`
- **Read this:** [NUM00-J. Detect or prevent integer overflow](https://cmu-sei.github.io/secure-coding-standards/sei-cert-oracle-coding-standard-for-java/rules/numeric-types-and-operations-num/num00-j) · SEI CERT Java · operators do not signal overflow; `Math.abs` and negation overflow on the minimum; `compareTo` by subtraction can break; fixes are precondition checks, `Math.*Exact` (Java 8), upcasting, `BigInteger`; notes hash-code overflow can be intended (*read*) · covers our angle: **full** for Java · fetched 2026-10-14
- **Also good:** [BigInt](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/BigInt) · MDN · no mixing with Number (TypeError), no `Math` methods, division truncates toward zero, exact beyond `MAX_SAFE_INTEGER` (*read*) · fetched 2026-10-14
- **Also good:** [Number.MAX_SAFE_INTEGER](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number/MAX_SAFE_INTEGER) · MDN (*read*) · fetched 2026-10-14
- **Our delta:** the cross-language trap in one table.

### T02-06 · The backtracking skeleton — Understand · ✅ written `docs/dsa/pages/phase-2-recursion-maths-bits/06-the-backtracking-skeleton.md`
- **Beyond the docs:** [Backtracking: master it like a pro](https://dev.to/nishchay7pixels/backtracking-master-it-like-a-pro-259k) · Nishchya Verma, DEV Community, 2025-06-10 · a generic template with `Choose`, `Explore`, `Unchoose` comments, then permutations and combinations in Python and Java (*read*) · covers our angle: **partial** — no pruning or copy discussion · fetched 2026-10-14
- **Our delta:** this phase previews the skeleton; mastery is in Part 6, so no deeper pick here. Copying the path before saving it is our page's point.

### T02-07 · Fast exponentiation and the modular inverse — Understand · ✅ written `docs/dsa/pages/phase-2-recursion-maths-bits/07-fast-exponentiation-and-the-modular-inverse.md`
- **Read this:** [Binary Exponentiation](https://cp-algorithms.com/algebra/binary-exp.html) · cp-algorithms · O(log n) multiplications, recursive and iterative versions, modular exponentiation and other applications such as Fibonacci and paths in a graph (*headings only*) · covers our angle: **partial** · fetched 2026-10-14
- **Also good:** [Modular Multiplicative Inverse](https://cp-algorithms.com/algebra/module-inverse.html) · cp-algorithms · extended Euclid, Fermat or Euler via binary exponentiation (needs phi(m)), the linear precomputation for all inverses, and the array trick with one inverse (*headings only*) · fetched 2026-10-14
- **Beyond the docs:** [Modular arithmetic](https://usaco.guide/gold/modular) · USACO Guide · Python code for modular exponentiation and the Fermat inverse, with a warning about dividing by a value that is zero after the modulus (*read*) · fetched 2026-10-14

### T02-08 · Combinatorics for counting problems — Understand · ✅ written `docs/dsa/pages/phase-2-recursion-maths-bits/08-combinatorics-for-counting-problems.md`
- **Read this:** [Binomial Coefficients](https://cp-algorithms.com/combinatorics/binomial-coefficients.html) · cp-algorithms · Pascal's triangle, the factorial form with modular inverses, Lucas's theorem named in one bullet (*headings only*) · covers our angle: **partial** · fetched 2026-10-14
- **Also good:** [Catalan Numbers](https://cp-algorithms.com/combinatorics/catalan-numbers.html) · cp-algorithms · recursive and analytical formulas for the Catalan sequence (*headings only*) · fetched 2026-10-14
- **Also good:** [Inclusion-Exclusion Principle](https://cp-algorithms.com/combinatorics/inclusion-exclusion.html) · cp-algorithms · statement, proof, and a worked list including derangements (about n!/e) (*read*) · fetched 2026-10-14
- **Beyond the docs:** [Combinatorics](https://usaco.guide/gold/combo) · USACO Guide · binomials by Pascal DP in O(n^2) or by modular inverses in O(n + log MOD), derangements by inclusion-exclusion or DP, stars and bars (*headings only*) · fetched 2026-10-14

### T02-09 · Bitmask enumeration — Understand · ✅ written `docs/dsa/pages/phase-2-recursion-maths-bits/09-bitmask-enumeration.md`
- **Read this:** [Enumerating all submasks of a bitmask](https://cp-algorithms.com/algebra/all-submasks.html) · cp-algorithms · the loop `for (s = m; s; s = (s-1) & m)`, and two proofs that all masks together cost 3^n (*read*) · covers our angle: **partial** — submasks, not DP over masks · fetched 2026-10-14
- **Beyond the docs:** [Bit manipulation interview patterns](https://www.techinterview.org/post/3233466313/bit-manipulation-patterns/?format=md) · techinterview.org, 2026-04-16 · bitmask DP with subsets as integers and a travelling-salesman example in Python (*read*) · fetched 2026-10-14
- **Our delta:** the loop skips the empty submask (handle it separately); the 32-bit loop bound in JavaScript.

### T02-10 · Randomisation — Understand · ✅ written `docs/dsa/pages/phase-2-recursion-maths-bits/10-randomisation.md`
- **Read this:** [Fisher–Yates shuffle](https://en.wikipedia.org/wiki/Fisher%E2%80%93Yates_shuffle) · Wikipedia · the modern algorithm, the biased naive swap, and modulo bias (*headings only*) · covers our angle: **partial** — no random-comparator discussion · fetched 2026-10-14
- **Also good:** [Reservoir sampling](https://en.wikipedia.org/wiki/Reservoir_sampling) · Wikipedia · Algorithm R and its induction proof (item survives with k/(i+1)) (*read*) · fetched 2026-10-14
- **Beyond the docs:** [Fisher-Yates Shuffle: an algorithm every developer should know](https://spin.atomicobject.com/fisher-yates-shuffle-randomization-algorithm/) · Matt Nedrich, Atomic Object, 2014-08-11 · the N^N vs N! argument for why the naive swap is biased; Python; says nothing about `sort` with a random comparator (*read*) · fetched 2026-10-14
- **Our delta:** the random-comparator shuffle bias, measured; one search found secondary claims only.

### T02-11 · Number problems that recur — Understand · ✅ written `docs/dsa/pages/phase-2-recursion-maths-bits/11-number-problems-that-recur.md`
- **Beyond the docs:** [LeetCode problem: Palindrome Number](https://dev.to/goosamsf_8/leetcode-problem-palindrome-number-48l2) · goosamsf_8, DEV Community, 2023-12-28 · revert half of the number; edge cases negatives, zero, non-zero multiples of 10, single digits; Go; O(log10 N) (*read*) · covers our angle: **partial** — one problem of the six · fetched 2026-10-14
- **Also good:** [Binary Exponentiation](https://cp-algorithms.com/algebra/binary-exp.html) · cp-algorithms · the method behind integer `pow` (*headings only*) · fetched 2026-10-14
- **Our delta:** reverse integer, integer square root, Roman numerals and string-to-integer. LeetCode problem pages returned 403, and no clean write-up for the others was fetched.

### T02-12 · Matrix exponentiation — Know · ✅ written `docs/dsa/pages/phase-2-recursion-maths-bits/12-matrix-exponentiation.md`
- **Read this:** [Matrix Exponentiation](https://usaco.guide/plat/matrix-expo) · USACO Guide · Fibonacci as the power of `[[1,1],[1,0]]` proved by induction, the general k-term recurrence, cost O(K^3 log N), and "derive the matrix from how the state vector changes"; Python and C++ (*read*) · covers our angle: **full** · fetched 2026-10-14
- **Also good:** [Fast Fibonacci algorithms](https://www.nayuki.io/page/fast-fibonacci-algorithms) · Nayuki, last updated 2023-01-22 · matrix exponentiation and fast doubling, each with a proof (*headings only*) · fetched 2026-10-14
- **Our delta:** why not Binet's formula (floating point).

### T02-13 · Geometry basics — Know · ✅ written `docs/dsa/pages/phase-2-recursion-maths-bits/13-geometry-basics.md`
- **Read this:** [Basic Geometry](https://cp-algorithms.com/geometry/basic-geometry.html) · cp-algorithms · points and linear operations, dot product, cross product with a 2D version; no separate distance section (*headings only*) · covers our angle: **partial** · fetched 2026-10-14
- **Also good:** [Oriented area of a triangle](https://cp-algorithms.com/geometry/oriented-triangle-area.html) · cp-algorithms · the 2D cross product `cross(p2 - p1, p3 - p2)`: negative is clockwise, positive counter-clockwise, zero collinear (*read*) · fetched 2026-10-14
- **Our delta:** segment intersection, point in polygon and the floating-point epsilon decision are ours.
