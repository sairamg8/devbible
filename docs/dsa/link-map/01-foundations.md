---
title: "Link map · DSA · Part 1 (phases 0–2)"
sidebar_label: "01 · foundations"
sidebar_position: 1
---

# Link map · DSA · Part 1 (phases 0–2)

Covers every topic row of `docs/dsa/syllabus/01-foundations.md`: Phase 0 (the interview and the practice system, 14 rows), Phase 1 (complexity analysis, 11 rows) and Phase 2 (recursion, maths and bits, 13 rows). All 38 rows have a written page of ours under `docs/dsa/pages`; the path shown is the first chunk file of the topic.
*read* = I read the passage that supports the claim in the fetched text; *headings only* = fetched at 200, headings or opening checked, passage not read. Fetches returned condensed text, so *read* means the stated claim was in that text. Third-party links carry a date only where the page shows one. No `#anchors` are given. Where no good non-official explanation turned up, the block has no "Beyond the docs" line. Every URL below was fetched on 2026-10-14 and returned 200 at the address shown.

---

## Phase 0 — The DSA interview and the practice system

### T00-01 · What the coding rounds grade — Master · ✅ written `docs/dsa/pages/phase-0-the-interview-and-practice/01-what-the-coding-rounds-grade.md`
- **Read this:** [Coding interview rubrics](https://www.techinterviewhandbook.org/coding-interview-rubrics/) · Tech Interview Handbook, updated Aug 7, 2026 · four graded dimensions (communication, problem solving, technical competency, testing), each scored in bands from strong hire to strong no hire (*read*) · covers our angle: **partial** — nothing on how a senior candidate is graded on the changed-constraints follow-up or on taking a hint · fetched 2026-10-14
- **Also good:** [Coding interview preparation](https://www.techinterviewhandbook.org/coding-interview-prep/) · Tech Interview Handbook · lists the four criteria (communication, problem solving, technical competency, testing) and says a round is typically 30 to 45 minutes; it defines no stages (*read*) · fetched 2026-10-14
- **Our delta:** the senior twist: the follow-up that changes the constraints after you have solved it, and how a hint is scored.

### T00-02 · The 45-minute shape — Master · ✅ written `docs/dsa/pages/phase-0-the-interview-and-practice/02-the-45-minute-shape.md`
- **Read this:** [Coding interview preparation](https://www.techinterviewhandbook.org/coding-interview-prep/) · Tech Interview Handbook · a round is "typically 30 - 45 minutes"; the page grades four criteria but names no stages and gives no per-step time breakdown (*read*) · covers our angle: **partial** — no time box per stage and no rule for when to start typing · fetched 2026-10-14
- **Also good:** [Coding interview techniques](https://www.techinterviewhandbook.org/coding-interview-techniques/) · Tech Interview Handbook · discuss a few approaches before coding, draw the problem, write the high-level function first and fill in helpers (*read*) · fetched 2026-10-14
- **Our delta:** a minute budget for each stage and the exact moment to start typing.

### T00-03 · The method: understand, match, plan, implement, review, evaluate — Master · ✅ written `docs/dsa/pages/phase-0-the-interview-and-practice/03-the-method.md`
- **Read this:** [How to Solve It](https://en.wikipedia.org/wiki/How_to_Solve_It) · Wikipedia · Polya's four phases (understand, devise a plan, carry out, look back) and the heuristics list: related simpler problem, look for a pattern, work backwards (*read*) · covers our angle: **partial** — the general method, with no step that matches the problem to a known algorithmic pattern before designing · fetched 2026-10-14
- **Also good:** [Coding interview techniques](https://www.techinterviewhandbook.org/coding-interview-techniques/) · Tech Interview Handbook · "apply common data structures and algorithms", starting with hash maps (*read*) · fetched 2026-10-14
- **Our delta:** the six-step version with the "which pattern is this" reflex placed before design, which the rest of the track trains.

### T00-04 · Language choice and runtime traps — Master · ✅ written `docs/dsa/pages/phase-0-the-interview-and-practice/04-language-choice-and-runtime-traps.md`
- **Read this:** [Array.prototype.sort](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/sort) · MDN · default sort compares UTF-16 strings, comparator returns negative, positive or zero, sort has been stable since ES2019 (*read*) · covers our angle: **partial** — sort only, not recursion limits or heap and sorted-map gaps · fetched 2026-10-14
- **Also good:** [BigInt](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/BigInt) · MDN · precision past `Number.MAX_SAFE_INTEGER`, no implicit mixing with Number, `Math` rejects BigInt (*read*) · fetched 2026-10-14
- **Also good:** [Too much recursion](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Errors/Too_much_recursion) · MDN · the stack-overflow error across engines, base case, convert unbounded recursion to a loop; gives no numeric limit (*read*) · fetched 2026-10-14
- **Also good:** [java.lang.Math](https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/lang/Math.html) · Oracle Java SE 21 · `addExact` and `multiplyExact` throw on `int` or `long` overflow, `floorMod` follows the divisor sign (*read*) · fetched 2026-10-14
- **Our delta:** the per-problem choice between TypeScript and Java, with the trap list for each side in one place.

### T00-05 · Reading the constraints — Master · ✅ written `docs/dsa/pages/phase-0-the-interview-and-practice/05-reading-the-constraints.md`
- **Read this:** [Time complexity](https://usaco.guide/bronze/time-comp) · USACO Guide · a table of conservative upper bounds on n per class (n up to 5 · 10^5 for n log n, 7500 for n squared, 20 for 2^n · n) and a warning that small limits do not reveal the intended class (*read*) · covers our angle: **full** for the table; contest limits, not interview-style input sizes · fetched 2026-10-14
- **Also good:** [Time complexity](https://en.wikipedia.org/wiki/Time_complexity) · Wikipedia · the table of named classes from constant to factorial with example algorithms (*read*) · fetched 2026-10-14
- **Our delta:** working backwards from the limit to the intended solution, and what to say aloud when the limit contradicts the obvious approach.

### T00-06 · Spaced repetition and the mistake log — Master · ✅ written `docs/dsa/pages/phase-0-the-interview-and-practice/06-spaced-repetition-and-the-mistake-log.md`
- **Read this:** [Spaced repetition](https://en.wikipedia.org/wiki/Spaced_repetition) · Wikipedia · the spacing effect, Mace's 1932 proposal of gaps roughly doubling from one day, and the note that meta-analyses often find expanding and uniform spacing similar (*read*) · covers our angle: **partial** — the memory science, nothing on problem-solving practice or a mistake log · fetched 2026-10-14
- **Our delta:** the 3, 7 and 21-day re-solve schedule from a blank editor, and logging why a problem was missed.

### T00-07 · The "when stuck" protocol — Master · ✅ written `docs/dsa/pages/phase-0-the-interview-and-practice/07-the-when-stuck-protocol.md`
- **Read this:** [Coding interview techniques](https://www.techinterviewhandbook.org/coding-interview-techniques/) · Tech Interview Handbook · draw the problem, solve it by hand, try more examples, break it into independent parts (*read*) · covers our angle: **partial** — the shrink-the-example moves, not the order of the protocol or when to ask for a hint · fetched 2026-10-14
- **Beyond the docs:** [Solving Coding Problems Without Overthinking](https://algocademy.com/blog/solving-coding-problems-without-overthinking-how-to-trust-your-instincts/) · AlgoCademy, Oct 15, 2024 · share initial thoughts even when not sure they are correct, and do not dismiss a hint the interviewer offers (*read*) · fetched 2026-10-14
- **Our delta:** an ordered protocol (restate, shrink, brute force aloud, name the bottleneck, ask) with a time trigger for the hint.

### T00-08 · Testing your own code live — Master · ✅ written `docs/dsa/pages/phase-0-the-interview-and-practice/08-testing-your-own-code-live.md`
- **Read this:** [Coding interview rubrics](https://www.techinterviewhandbook.org/coding-interview-rubrics/) · Tech Interview Handbook, updated Aug 7, 2026 · Testing is a graded dimension: common and corner cases, and whether you fix your own bugs (*read*) · covers our angle: **partial** — says tests are graded, not how to trace by hand or hunt off-by-ones · fetched 2026-10-14
- **Also good:** [Coding interview techniques](https://www.techinterviewhandbook.org/coding-interview-techniques/) · Tech Interview Handbook · reuse the extra examples you invented as test cases (*read*) · fetched 2026-10-14
- **Also good:** [Data structures and algorithms study cheatsheets](https://www.techinterviewhandbook.org/algorithms/study-cheatsheet/) · Tech Interview Handbook · the General interview tips list includes validating inputs, checking for off-by-one errors and testing with example inputs; each study guide lists corner cases per topic (*read*) · fetched 2026-10-14
- **Our delta:** the edge-case checklist (empty, one element, duplicates, negatives, overflow) and boundary-by-boundary off-by-one hunting.

### T00-09 · The ladders — Understand · ✅ written `docs/dsa/pages/phase-0-the-interview-and-practice/09-the-ladders.md`
- **Read this:** [Coding interview study plan](https://www.techinterviewhandbook.org/coding-interview-study-plan/) · Tech Interview Handbook · three months at about 11 hours a week, topics by priority, then 75 questions from the Grind 75 tool, worked in order of priority, high-priority topics first (*read*) · covers our angle: **partial** — one ladder, no map onto our phases · fetched 2026-10-14
- **Also good:** [NeetCode 150](https://neetcode.io/practice/practice/neetcode150) · NeetCode · Blind 75 plus 75 more, 28 easy, 101 medium, 21 hard, in 18 categories (*read*) · fetched 2026-10-14
- **Also good:** [Grind 75](https://www.techinterviewhandbook.org/grind75/) · Tech Interview Handbook · "a better Blind 75 you can customize, by the author of Blind 75"; the fetched page gives no list detail (*headings only*) · fetched 2026-10-14
- **Beyond the docs:** [Blind 75 vs NeetCode 150 vs Educative](https://www.educative.io/blog/blind75-vs-neetcode-vs-educative) · Educative blog, Aisha Noor, Jun 15, 2026 · compares Blind 75, NeetCode 150 and Educative's pattern paths and advises working category by category, easy before hard within each (*read*) · fetched 2026-10-14
- **Our delta:** how each ladder maps onto phases 0 to 17 here, and why order matters more than count.

### T00-10 · Mock interviews — Understand · ✅ written `docs/dsa/pages/phase-0-the-interview-and-practice/10-mock-interviews.md`
- **Read this:** [Coding interview study plan](https://www.techinterviewhandbook.org/coding-interview-study-plan/) · Tech Interview Handbook · start booking mock coding interviews at about 60 percent through the plan (*read*) · covers our angle: **partial** — a timing rule only, no rubric or recording advice · fetched 2026-10-14
- **Our delta:** peer mocks graded against our rubric, recording yourself, thinking aloud as a trained habit.

### T00-11 · Communication mechanics — Understand · ✅ written `docs/dsa/pages/phase-0-the-interview-and-practice/11-communication-mechanics.md`
- **Read this:** [Coding interview rubrics](https://www.techinterviewhandbook.org/coding-interview-rubrics/) · Tech Interview Handbook, updated Aug 7, 2026 · Communication means asking clarifying questions and explaining approach and reasoning while coding (*read*) · covers our angle: **partial** — the criterion, not the mechanics · fetched 2026-10-14
- **Also good:** [Coding interview techniques](https://www.techinterviewhandbook.org/coding-interview-techniques/) · Tech Interview Handbook · outline the high-level functions first to show structured thinking, and state the best theoretical time complexity to the interviewer (*read*) · fetched 2026-10-14
- **Beyond the docs:** [Solving Coding Problems Without Overthinking](https://algocademy.com/blog/solving-coding-problems-without-overthinking-how-to-trust-your-instincts/) · AlgoCademy, Oct 15, 2024 · narrating your process lets the interviewer follow the logic and step in with guidance (*read*) · fetched 2026-10-14
- **Our delta:** narrate the plan before code, name the invariant, state complexity unprompted, say what you would do with more time.

### T00-12 · Java's collections for interviews — Understand · ✅ written `docs/dsa/pages/phase-0-the-interview-and-practice/12-javas-collections-for-interviews.md`
- **Read this:** [PriorityQueue](https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/util/PriorityQueue.html) · Oracle Java SE 21 · `offer`, `poll`, `add` are O(log n), `remove(Object)` and `contains` are linear, iteration order is not sorted, null is rejected, not thread-safe (*read*) · covers our angle: **partial** — one class of several · fetched 2026-10-14
- **Also good:** [TreeMap](https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/util/TreeMap.html) · Oracle Java SE 21 · guaranteed log(n) for `containsKey`, `get`, `put`, `remove`; `floorKey` and `ceilingKey` return the nearest key or null, with no stated bound (*read*) · fetched 2026-10-14
- **Also good:** [ArrayDeque](https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/util/ArrayDeque.html) · Oracle Java SE 21 · faster than `Stack` and `LinkedList` as stack or queue, nulls prohibited, most operations amortised constant (*read*) · fetched 2026-10-14
- **Also good:** [Collections Framework overview](https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/util/doc-files/coll-overview.html) · Oracle Java SE 21 · the table of general-purpose implementations by interface (*read*) · fetched 2026-10-14
- **Our delta:** the handful of calls to know cold, with the trap beside each (PriorityQueue iteration order, comparator overflow).

### T00-13 · How this track relates to the JavaScript track — Know · ✅ written `docs/dsa/pages/phase-0-the-interview-and-practice/13-how-this-track-relates-to-javascript.md`
- **Read this:** [Data structures and algorithms study cheatsheets](https://www.techinterviewhandbook.org/algorithms/study-cheatsheet/) · Tech Interview Handbook · per-topic study guides with a time-complexity cheatsheet and general interview tips; headings: What is this, Contents of each study guide, Study guides list, General interview tips, Recommended courses (*read*) · covers our angle: **partial** — a generic precedent for a separate interview layer; the row itself is about our own two tracks · fetched 2026-10-14
- **Our delta:** phases 13 to 17 of the JavaScript track hold the language-level implementations; this track is patterns, ladders and method. Link, never duplicate.

### T00-14 · Competitive programming vs interviews — Know · ✅ written `docs/dsa/pages/phase-0-the-interview-and-practice/14-competitive-programming-vs-interviews.md`
- **Read this:** [Competitive programming](https://en.wikipedia.org/wiki/Competitive_programming) · Wikipedia · contests are judged automatically on secret tests; contest skill helps with interviews, and Norvig's Google observation on contest winners is quoted with his later caveat (*read*) · covers our angle: **partial** — the existence of the link, not which skills transfer · fetched 2026-10-14
- **Beyond the docs:** [How do coding interviews differ from coding contests](https://www.redgreencode.com/cpfaq-how-do-coding-interviews-differ-from-coding-contests/) · Duncan Smith, redgreencode · a compiler needs exact syntax, a person forgives it; interviews are collaborative and draw on a narrower range of algorithms (*read*) · fetched 2026-10-14
- **Our delta:** what transfers (speed, pattern recognition) and what does not (obscure tricks); contests as timed practice, nothing more.

---

## Phase 1 — Complexity analysis

### T01-01 · Big-O, Theta and Omega — Master · ✅ written `docs/dsa/pages/phase-1-complexity/01-big-o-theta-and-omega.md`
- **Read this:** [Big O notation](https://en.wikipedia.org/wiki/Big_O_notation) · Wikipedia · Big O as an upper bound with an implied constant, Omega as the mirror lower bound, Theta as both at once, keep the fastest-growing term and drop constant factors (*read*, first 100000 characters) · covers our angle: **partial** — the maths, not what interviewers mean by "complexity" or when constants matter · fetched 2026-10-14
- **Also good:** [Know Thy Complexities](https://www.bigocheatsheet.com/) · bigocheatsheet.com · average and worst-case tables for 14 data structures and 13 sorts (*headings only*) · fetched 2026-10-14
- **Our delta:** what an interviewer means by the word, and the moments constants matter anyway.

### T01-02 · Reading complexity off code — Master · ✅ written `docs/dsa/pages/phase-1-complexity/02-reading-complexity-off-code.md`
- **Read this:** [Analysis of algorithms](https://algs4.cs.princeton.edu/14analysis/) · Princeton, Sedgewick and Wayne · worked loop fragments (exercise 2): a halving outer loop whose inner loop runs to the current n is linear (N + N/2 + N/4 + …), a doubling outer loop whose inner loop runs to N is linearithmic (*read*) · covers our angle: **partial** — nested and halving loops, not recursion trees or the two-pointer and monotonic-stack case · fetched 2026-10-14
- **Our delta:** the loop that looks quadratic but is linear (two pointers, a monotonic stack) and recursion read as a tree.

### T01-03 · Amortised analysis — Master · ✅ written `docs/dsa/pages/phase-1-complexity/03-amortised-analysis.md`
- **Read this:** [Amortized analysis](https://en.wikipedia.org/wiki/Amortized_analysis) · Wikipedia · aggregate, accounting and potential methods, and the dynamic-array push worked as a geometric series totalling O(n) (*read*) · covers our angle: **partial** — the methods, not the one-sentence interview explanation · fetched 2026-10-14
- **Also good:** [Disjoint set union](https://cp-algorithms.com/data_structures/disjoint_set_union.html) · cp-algorithms · path compression with union by size gives amortised O(alpha(n)), with inverse Ackermann at most 4 for any reasonable n (*read*) · fetched 2026-10-14
- **Also good:** [Analysis of algorithms](https://algs4.cs.princeton.edu/14analysis/) · Princeton · resizing arrays take time proportional to N for any N operations, so amortised constant (*read*) · fetched 2026-10-14
- **Our delta:** "each element is pushed once" as a single sentence the interviewer believes.

### T01-04 · Space and the recursion stack — Master · ✅ written `docs/dsa/pages/phase-1-complexity/04-space-and-the-recursion-stack.md`
- **Read this:** [Recursion and stack](https://javascript.info/recursion) · javascript.info · depth equals the number of contexts on the stack, 10000 is a safe depth and 100000 probably is not, tail-call optimisation "not yet supported everywhere" (*read*) · covers our angle: **partial** — no auxiliary-space or in-place discussion · fetched 2026-10-14
- **Also good:** [ECMAScript 6 Proper Tail Calls in WebKit](https://webkit.org/blog/6240/ecmascript-6-proper-tail-calls-in-webkit/) · WebKit blog, May 23, 2016 · what a proper tail call reuses and the strict-mode and return conditions; describes JavaScriptCore only and names no other engine (*read*) · fetched 2026-10-14
- **Our delta:** why tail calls do not save you in V8, and the recursion depth of a DFS counted as space.

### T01-05 · The common classes and what the limits imply — Master · ✅ written `docs/dsa/pages/phase-1-complexity/05-the-common-classes-and-what-the-limits-imply.md`
- **Read this:** [Time complexity](https://en.wikipedia.org/wiki/Time_complexity) · Wikipedia · the table of classes from constant to factorial with example algorithms (*read*) · covers our angle: **partial** — the classes, not the input-size mapping · fetched 2026-10-14
- **Also good:** [Time complexity](https://usaco.guide/bronze/time-comp) · USACO Guide · the n-to-class table (*read*) · fetched 2026-10-14
- **Our delta:** one table from input size to intended class, tuned to interview input sizes.

### T01-06 · Hidden costs — Master · ✅ written `docs/dsa/pages/phase-1-complexity/06-hidden-costs.md`
- **Read this:** [Array.prototype.shift](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/shift) · MDN · shift moves every remaining value left by one and reindexes; the page states no complexity (*read*) · covers our angle: **partial** — only the front-removal case, and the cost is implied, not stated · fetched 2026-10-14
- **Also good:** [Array.prototype.includes](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/includes) · MDN · searches front to back with SameValueZero; no complexity stated (*read*) · fetched 2026-10-14
- **Also good:** [Set](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Set) · MDN · the spec requires sublinear average access, and `has` is on average faster than `includes` on an equal-size array (*read*) · fetched 2026-10-14
- **Also good:** [HashMap](https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/util/HashMap.html) · Oracle Java SE 21 · constant time only if the hash disperses well, and many equal-hash keys are "a sure way to slow down" the table (*read*) · fetched 2026-10-14
- **Our delta:** the accidental quadratic that fails the large test: concatenation in a loop, slicing and spreading, substring copies.

### T01-07 · Complexity of the built-ins — Master · ✅ written `docs/dsa/pages/phase-1-complexity/07-complexity-of-the-built-ins.md`
- **Read this:** [ArrayList](https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/util/ArrayList.html) · Oracle Java SE 21 · `get`, `set`, `size` constant, `add` amortised constant, everything else roughly linear (*read*) · covers our angle: **partial** — Java lists only · fetched 2026-10-14
- **Also good:** [LinkedList](https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/util/LinkedList.html) · Oracle Java SE 21 · indexed operations traverse from whichever end is closer; no Big-O stated (*read*) · fetched 2026-10-14
- **Also good:** [Know Thy Complexities](https://www.bigocheatsheet.com/) · bigocheatsheet.com · tables for structures and sorts (*headings only*) · fetched 2026-10-14
- **Our delta:** the numbers you must not guess, for JavaScript sort, Map, Set, `indexOf` and front removal as well as Java.

### T01-08 · Recurrences and the master theorem — Understand · ✅ written `docs/dsa/pages/phase-1-complexity/08-recurrences-and-the-master-theorem.md`
- **Read this:** [Master theorem](https://en.wikipedia.org/wiki/Master_theorem_(analysis_of_algorithms)) · Wikipedia · the three cases by comparing f(n) with n to the log base b of a; its application table puts binary search and merge sort in case 2 and binary tree traversal in case 1 (*read*) · covers our angle: **full** for the cases and all three of our examples · fetched 2026-10-14
- **Our delta:** recognising the case at a glance in merge sort, binary search and tree recursion.

### T01-09 · Best, average and worst — Understand · ✅ written `docs/dsa/pages/phase-1-complexity/09-best-average-and-worst.md`
- **Read this:** [Best, worst and average case](https://en.wikipedia.org/wiki/Best,_worst_and_average_case) · Wikipedia · the three definitions, hash tables as poor worst case but rarely hit, quicksort average n log n against worst n squared (*read*) · covers our angle: **partial** — no guidance on which to state in an interview · fetched 2026-10-14
- **Also good:** [Quicksort](https://en.wikipedia.org/wiki/Quicksort) · Wikipedia · worst case when the pivot is always the smallest or largest, a random pivot makes the expected bound hold for any input (*read*, first 100000 characters) · fetched 2026-10-14
- **Our delta:** which bound to state and when.

### T01-10 · Benchmarking vs analysis — Know · ✅ written `docs/dsa/pages/phase-1-complexity/10-benchmarking-vs-analysis.md`
- **Read this:** [Galactic algorithm](https://en.wikipedia.org/wiki/Galactic_algorithm) · Wikipedia · asymptotically better methods whose constants make them lose on any realistic input, such as the expected linear-time minimum spanning tree that beats Borůvka only above about 9 · 10^151 (*read*) · covers our angle: **partial** — constant factors only, nothing on cache effects · fetched 2026-10-14
- **Our delta:** when to measure, cache effects, and why a linearithmic solution can beat a linear one at real sizes.

### T01-11 · Proving optimality — Know · ✅ written `docs/dsa/pages/phase-1-complexity/11-proving-optimality.md`
- **Read this:** [Comparison sort](https://en.wikipedia.org/wiki/Comparison_sort) · Wikipedia · the decision-tree argument: n factorial leaves force at least log2 of n factorial comparisons, which is Omega of n log n (*read*) · covers our angle: **full** for the comparison-sort bound · fetched 2026-10-14
- **Also good:** [Mergesort](https://algs4.cs.princeton.edu/22mergesort/) · Princeton, Sedgewick and Wayne · no compare-based sort can beat lg(N!) compares, so mergesort is asymptotically optimal (*read*) · fetched 2026-10-14
- **Our delta:** answering "can we do better?" with a reason rather than a shrug, beyond sorting.

---

## Phase 2 — Recursion, maths and bits

### T02-01 · Recursion and the call stack — Master · ✅ written `docs/dsa/pages/phase-2-recursion-maths-bits/01-recursion-and-the-call-stack.md`
- **Read this:** [Recursion and stack](https://javascript.info/recursion) · javascript.info · each call pushes an execution context, depth is limited by the engine, "any recursion can be rewritten as a loop" (*read*) · covers our angle: **partial** — no explicit-stack conversion worked for trees · fetched 2026-10-14
- **Also good:** [Too much recursion](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Errors/Too_much_recursion) · MDN · a missing base case or too many calls triggers the error; it gives no numeric depth (*read*) · fetched 2026-10-14
- **Our delta:** the frame as a resume point, converting to an explicit stack, and Node's depth limit as a real constraint.

### T02-02 · Divide and conquer — Master · ✅ written `docs/dsa/pages/phase-2-recursion-maths-bits/02-divide-and-conquer.md`
- **Read this:** [Mergesort](https://algs4.cs.princeton.edu/22mergesort/) · Princeton, Sedgewick and Wayne · top-down mergesort splits, sorts halves and merges, with N log N time and N extra space (*read*) · covers our angle: **partial** — merge sort only · fetched 2026-10-14
- **Also good:** [Quickselect](https://en.wikipedia.org/wiki/Quickselect) · Wikipedia · average O(n), worst O(n squared), recurses into one side only, median of medians gives a linear worst case (*read*) · fetched 2026-10-14
- **Also good:** [Inversion (discrete mathematics)](https://en.wikipedia.org/wiki/Inversion_(discrete_mathematics)) · Wikipedia · says comparison sorts can be adapted to count inversions in O(n log n), without showing how (*read*) · fetched 2026-10-14
- **Our delta:** the solve-halves-combine template applied to counting inversions.

### T02-03 · Mathematical foundations — Master · ✅ written `docs/dsa/pages/phase-2-recursion-maths-bits/03-mathematical-foundations.md`
- **Read this:** [Euclidean algorithm](https://cp-algorithms.com/algebra/euclid-algorithm.html) · cp-algorithms · GCD in O(log min(a, b)), LCM as a times b over GCD with a divided first to avoid overflow (*read*) · covers our angle: **partial** — GCD and LCM only · fetched 2026-10-14
- **Also good:** [Sieve of Eratosthenes](https://cp-algorithms.com/algebra/sieve-of-eratosthenes.html) · cp-algorithms · O(n log log n), start the inner loop at i squared, segmented and odd-only variants (*read*) · fetched 2026-10-14
- **Also good:** [Integer factorization](https://cp-algorithms.com/algebra/factorization.html) · cp-algorithms · trial division in O(sqrt n), then wheel, Fermat, Pollard methods (*read*) · fetched 2026-10-14
- **Also good:** [Modular arithmetic](https://usaco.guide/gold/modular) · USACO Guide · modular arithmetic is used to avoid overflow, and the modulus is usually a large prime, most often 10^9+7 or 998244353; it gives no reason why a prime and does not treat negative remainders (*read*) · fetched 2026-10-14
- **Our delta:** why answers are taken modulo a large prime, and the remainder trap with negatives.

### T02-04 · Bit manipulation — Master · ✅ written `docs/dsa/pages/phase-2-recursion-maths-bits/04-bit-manipulation.md`
- **Read this:** [Bit manipulation](https://cp-algorithms.com/algebra/bit-manipulation.html) · cp-algorithms · `n & (n-1)` clears the lowest set bit, `n & -n` extracts it, Kernighan popcount, the power-of-two test with the zero guard; submask iteration is not on this page (*read*) · covers our angle: **partial** · fetched 2026-10-14
- **Also good:** [Bit Twiddling Hacks](https://graphics.stanford.edu/~seander/bithacks.html) · Sean Eron Anderson, Stanford · the power-of-2 test with its zero caveat, several ways to count set bits (naive, table, Kernighan, parallel), and XOR swap with its same-location failure (*read*) · fetched 2026-10-14
- **Also good:** [Bitwise AND](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Bitwise_AND) · MDN · Number operands are converted to 32-bit integers and higher bits discarded; BigInt has no truncation (*read*) · fetched 2026-10-14
- **Also good:** [Integer](https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/lang/Integer.html) · Oracle Java SE 21 · `bitCount`, `lowestOneBit`, `numberOfTrailingZeros` (*read*) · fetched 2026-10-14
- **Our delta:** the single-number XOR and swap, and the JavaScript 32-bit trap next to the Java versions.

### T02-05 · Integer limits and overflow — Master · ✅ written `docs/dsa/pages/phase-2-recursion-maths-bits/05-integer-limits-and-overflow.md`
- **Read this:** [Number.MAX_SAFE_INTEGER](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number/MAX_SAFE_INTEGER) · MDN · integers are exact only up to 2^53 minus 1, past which `MAX_SAFE_INTEGER + 1 === MAX_SAFE_INTEGER + 2`; use BigInt beyond it (*read*) · covers our angle: **partial** — JavaScript side only · fetched 2026-10-14
- **Also good:** [java.lang.Math](https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/lang/Math.html) · Oracle Java SE 21 · the `Exact` methods throw `ArithmeticException` on overflow; `abs` of `Integer.MIN_VALUE` silently stays negative (*read*, first 100000 characters) · fetched 2026-10-14
- **Also good:** [BigInt](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/BigInt) · MDN · do not coerce between BigInt and Number (*read*) · fetched 2026-10-14
- **Our delta:** the multiplication that overflowed silently, and overflow used on purpose in hashing.

### T02-06 · The backtracking skeleton — Understand · ✅ written `docs/dsa/pages/phase-2-recursion-maths-bits/06-the-backtracking-skeleton.md`
- **Read this:** [Backtracking](https://en.wikipedia.org/wiki/Backtracking) · Wikipedia · the reject, accept, first and next skeleton over a potential search tree, and pruning as the main performance lever (*read*) · covers our angle: **partial** — the abstract form, not choose, explore, un-choose in code · fetched 2026-10-14
- **Our delta:** the choose, explore, un-choose shape previewed here and mastered in Part 6.

### T02-07 · Fast exponentiation and the modular inverse — Understand · ✅ written `docs/dsa/pages/phase-2-recursion-maths-bits/07-fast-exponentiation-and-the-modular-inverse.md`
- **Read this:** [Binary exponentiation](https://cp-algorithms.com/algebra/binary-exp.html) · cp-algorithms · a to the n in O(log n) multiplications, modular version, any associative operation (*read*) · covers our angle: **partial** — no binomial coefficients · fetched 2026-10-14
- **Also good:** [Modular multiplicative inverse](https://cp-algorithms.com/algebra/module-inverse.html) · cp-algorithms · a to the m minus 2 for prime m, extended Euclid otherwise, linear-time inverses of 1 to n (*read*) · fetched 2026-10-14
- **Also good:** [Binomial coefficients](https://cp-algorithms.com/combinatorics/binomial-coefficients.html) · cp-algorithms · factorials and inverse factorials mod a prime, O(1) per query after precompute (*read*) · fetched 2026-10-14
- **Our delta:** the three pieces chained into a modular binomial written from memory.

### T02-08 · Combinatorics for counting problems — Understand · ✅ written `docs/dsa/pages/phase-2-recursion-maths-bits/08-combinatorics-for-counting-problems.md`
- **Read this:** [Catalan numbers](https://cp-algorithms.com/combinatorics/catalan-numbers.html) · cp-algorithms · counts bracket sequences, binary trees and triangulations; the sum recurrence and the closed form C(2n, n) over n+1 (*read*) · covers our angle: **partial** — Catalan only · fetched 2026-10-14
- **Also good:** [Inclusion-exclusion](https://cp-algorithms.com/combinatorics/inclusion-exclusion.html) · cp-algorithms · the alternating-sum principle with derangements as an application (*read*) · fetched 2026-10-14
- **Also good:** [Binomial coefficients](https://cp-algorithms.com/combinatorics/binomial-coefficients.html) · cp-algorithms · Pascal's triangle in O(n squared) and the modular route (*read*) · fetched 2026-10-14
- **Our delta:** the counting problem that is dynamic programming in disguise, and when a closed form replaces it.

### T02-09 · Bitmask enumeration — Understand · ✅ written `docs/dsa/pages/phase-2-recursion-maths-bits/09-bitmask-enumeration.md`
- **Read this:** [Enumerating submasks](https://cp-algorithms.com/algebra/all-submasks.html) · cp-algorithms · `s = (s-1) & m` walks submasks in descending order, zero handled separately, total work 3 to the n over all masks (*read*) · covers our angle: **partial** — submasks, not subset-per-integer enumeration or mask DP · fetched 2026-10-14
- **Also good:** [Bit Twiddling Hacks](https://graphics.stanford.edu/~seander/bithacks.html) · Stanford · bit-level primitives behind mask work (*headings only*) · fetched 2026-10-14
- **Our delta:** subsets as integers, where exponential is intended, and DP over masks previewed.

### T02-10 · Randomisation — Understand · ✅ written `docs/dsa/pages/phase-2-recursion-maths-bits/10-randomisation.md`
- **Read this:** [Fisher–Yates shuffle](https://en.wikipedia.org/wiki/Fisher%E2%80%93Yates_shuffle) · Wikipedia · the in-place modern algorithm, why the naive swap is biased (n to the n outcomes cannot split evenly over n factorial), modulo bias, off-by-one range errors, and a Sorting section warning that a random comparator gives highly non-uniform results (*read*) · covers our angle: **full** for Fisher–Yates and the comparator-shuffle warning; no measured counts · fetched 2026-10-14
- **Also good:** [Reservoir sampling](https://en.wikipedia.org/wiki/Reservoir_sampling) · Wikipedia · Algorithm R and the induction that every item ends with probability k over n (*read*) · fetched 2026-10-14
- **Also good:** [Quicksort](https://en.wikipedia.org/wiki/Quicksort) · Wikipedia · a random pivot makes the expected bound hold for any input (*read*, first 100000 characters) · fetched 2026-10-14
- **Beyond the docs:** [The Danger of Naïveté](https://blog.codinghorror.com/the-danger-of-naivete/) · Jeff Atwood, Dec 7, 2007 · runs a naive shuffle 600,000 times on three cards and shows the skewed counts against Knuth–Fisher–Yates, which is the measured bias made visible (*read*) · fetched 2026-10-14
- **Our delta:** why a random comparator in `sort` is measurably biased.

### T02-11 · Number problems that recur — Understand · ✅ written `docs/dsa/pages/phase-2-recursion-maths-bits/11-number-problems-that-recur.md`
- **Read this:** [Integer square root](https://en.wikipedia.org/wiki/Integer_square_root) · Wikipedia · binary search and Newton both compute the floor, with the example isqrt(2000000) = 1414 in 21 binary steps; the article ignores overflow (*read*) · covers our angle: **partial** — square root only · fetched 2026-10-14
- **Also good:** [Roman numerals](https://en.wikipedia.org/wiki/Roman_numerals) · Wikipedia · six subtractive pairs (IV, IX, XL, XC, CD, CM) and the standard form up to 3999 (*read*, first 100000 characters) · fetched 2026-10-14
- **Also good:** [Integer](https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/lang/Integer.html) · Oracle Java SE 21 · `parseInt` throws `NumberFormatException` on null, empty, bad digits and out-of-range values, with worked examples (*read*) · fetched 2026-10-14
- **Our delta:** digit manipulation, palindromic numbers, `pow` and the boundary details that hide bugs.

### T02-12 · Matrix exponentiation — Know · ✅ written `docs/dsa/pages/phase-2-recursion-maths-bits/12-matrix-exponentiation.md`
- **Read this:** [Fibonacci numbers](https://cp-algorithms.com/algebra/fibonacci-numbers.html) · cp-algorithms · the matrix of ones and a zero raised to the n, plus the fast-doubling identities; the page ties O(log n) to the matrix route (*read*) · covers our angle: **partial** — Fibonacci only, no general linear recurrence · fetched 2026-10-14
- **Also good:** [Binary exponentiation](https://cp-algorithms.com/algebra/binary-exp.html) · cp-algorithms · applications include Fibonacci, path counting and transformation matrices (*read*) · fetched 2026-10-14
- **Beyond the docs:** [Fast Fibonacci algorithms](https://www.nayuki.io/page/fast-fibonacci-algorithms) · Project Nayuki · shows fast doubling as matrix exponentiation with redundant work removed, with benchmarks on one old machine (*read*) · fetched 2026-10-14
- **Our delta:** the matrix as the transition for any linear recurrence, and when not to bother.

### T02-13 · Geometry basics — Know · ✅ written `docs/dsa/pages/phase-2-recursion-maths-bits/13-geometry-basics.md`
- **Read this:** [Basic geometry](https://cp-algorithms.com/geometry/basic-geometry.html) · cp-algorithms · dot product, 2D cross product sign as orientation, line and plane intersection; point-to-line distance is not covered (*read*) · covers our angle: **partial** — no convex hull or segment-intersection problems · fetched 2026-10-14
- **Our delta:** the few geometry problems that actually appear in interviews, and exactness with integers.
