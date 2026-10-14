---
title: "Link map · DSA · Part 1 (phases 0-2), file 2"
sidebar_label: "01 · foundations (2)"
sidebar_position: 2
---

# Link map · DSA · Part 1, file 2 (phase 1)

Covers the 11 topic rows of phase 1 (T01-01 to T01-11). *read* = I read the passage; *headings only* = fetched at 200 and headings checked. All fetched 2026-10-14.

### T01-01 · Big-O, Theta and Omega — Master · ✅ written `docs/dsa/pages/phase-1-complexity/01-big-o-theta-and-omega.md`
- **Read this:** [Big O notation](https://en.wikipedia.org/wiki/Big_O_notation) · Wikipedia · the formal definitions of all the bounds and their families in one place · covers our angle: **partial** - formal, nothing on what interviewers mean or when constants matter · fetched 2026-10-14 (*headings only*)
- **Also good:** [Algorithm Analysis](https://cs.lmu.edu/~ray/notes/alganalysis/) · LMU course notes · Theta and growth rates with small code examples · fetched 2026-10-14
- **Our delta:** the interview reading of "complexity" and the cases where constants matter.

### T01-02 · Reading complexity off code — Master · ✅ written `docs/dsa/pages/phase-1-complexity/02-reading-complexity-off-code.md`
- **Read this:** [Algorithm Analysis](https://cs.lmu.edu/~ray/notes/alganalysis/) · LMU course notes · derives a halving loop as the ceiling of log base 2 of n, plus nested and sequential loops · covers our angle: **partial** - no two-pointer or monotonic-stack linear loops · fetched 2026-10-14 (*read*)
- **Our delta:** the loop that looks quadratic but is linear.

### T01-03 · Amortised analysis — Master · ✅ written `docs/dsa/pages/phase-1-complexity/03-amortised-analysis.md`
- **Read this:** [Lecture 25: Amortized Analysis](https://www.cs.cornell.edu/courses/cs3110/2014fa/lectures/25/lec25.html) · Cornell CS 3110 · the doubling-array argument worked out, including why a fixed increment fails · covers our angle: **partial** - no union-find or "each element pushed once" · fetched 2026-10-14 (*read*)
- **Also good:** [Amortized analysis](https://en.wikipedia.org/wiki/Amortized_analysis) · Wikipedia · aggregate, accounting and potential methods side by side · fetched 2026-10-14
- **Our delta:** the one-sentence version an interviewer will believe.

### T01-04 · Space and the recursion stack — Master · ✅ written `docs/dsa/pages/phase-1-complexity/04-space-and-the-recursion-stack.md`
- **Read this:** [Your recursion is lying to you about stack safety](https://hackernoon.com/your-recursion-is-lying-to-you-about-stack-safety) · HackerNoon · a per-runtime table showing V8 (Chrome, Node) gives no proper tail calls · covers our angle: **partial** - nothing on auxiliary space or in-place · fetched 2026-10-14 (*read*)
- **Also good:** [InternalError: too much recursion](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Errors/Too_much_recursion) · MDN · the failure mode itself (the page is the Firefox wording) · fetched 2026-10-14
- **Our delta:** auxiliary space vs in-place, and the depth of a recursive DFS.

### T01-05 · The common classes and what the limits imply — Master · ✅ written `docs/dsa/pages/phase-1-complexity/05-the-common-classes-and-what-the-limits-imply.md`
- **Read this:** [Complexity calculations](https://usaco.guide/bronze/time-comp) · USACO Guide · pairs each class with the input size it allows · covers our angle: full · fetched 2026-10-14 (*read*)
- **Also good:** [Big-O Algorithm Complexity Cheat Sheet](https://www.bigocheatsheet.com/) · bigocheatsheet.com · the growth chart for the classes · fetched 2026-10-14

### T01-06 · Hidden costs — Master · ✅ written `docs/dsa/pages/phase-1-complexity/06-hidden-costs.md`
- **Read this:** [Back to Basics](https://www.joelonsoftware.com/2001/12/11/back-to-basics/) · Joel on Software · the classic walk-through of why repeated string appends go quadratic (the strcat example) · covers our angle: **partial** - C strings, not JS or Java · fetched 2026-10-14 (*read*)
- **Also good:** [How to Work with Strings in JavaScript - Tips for Efficient String Concatenation](https://www.freecodecamp.org/news/efficient-string-building-in-javascript/) · freeCodeCamp · the JavaScript side of concatenation cost · fetched 2026-10-14
- **Our delta:** slicing and spreading arrays, `includes` in a loop, hash collisions, and V8 rope behaviour.

### T01-07 · Complexity of the built-ins — Master · ✅ written `docs/dsa/pages/phase-1-complexity/07-complexity-of-the-built-ins.md`
- **Read this:** [Big-O Algorithm Complexity Cheat Sheet](https://www.bigocheatsheet.com/) · bigocheatsheet.com · array, hash and tree operation tables and the sorting table · covers our angle: **partial** - generic structures, not JS `Array`/`Map` or Java lists · fetched 2026-10-14 (*headings only*)
- **Also good:** [ECMAScript Language Specification, Set objects](https://tc39.es/ecma262/#sec-set-objects) · TC39 · requires on average sublinear access for Map and Set · fetched 2026-10-14
- **Also good:** [ArrayList (Java SE 21)](https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/util/ArrayList.html) · Oracle · documented cost of each list operation · fetched 2026-10-14
- **Our delta:** `shift`/`indexOf` on JS arrays and the Java list implementations compared.

### T01-08 · Recurrences and the master theorem — Understand · ✅ written `docs/dsa/pages/phase-1-complexity/08-recurrences-and-the-master-theorem.md`
- **Read this:** [1.9 Master Theorem and Summary of Common Recurrences](https://web.engr.oregonstate.edu/~huanlian/algorithms_course/1-datastructures/master.html) · Oregon State course notes · the three cases with a summary of common recurrences · covers our angle: full · fetched 2026-10-14 (*headings only*)
- **Also good:** [Master theorem (analysis of algorithms)](https://en.wikipedia.org/wiki/Master_theorem_%28analysis_of_algorithms%29) · Wikipedia · states the regularity condition for case 3 and gives examples · fetched 2026-10-14

### T01-09 · Best, average and worst — Understand · ✅ written `docs/dsa/pages/phase-1-complexity/09-best-average-and-worst.md`
- **Read this:** [Quicksort](https://en.wikipedia.org/wiki/Quicksort) · Wikipedia · the worst-case quadratic, best and average figures and the pivot choices behind them · covers our angle: **partial** - quicksort only, not hashing · fetched 2026-10-14 (*read*)
- **Also good:** [Hash table](https://en.wikipedia.org/wiki/Hash_table) · Wikipedia · average vs worst for lookups and the load factor · fetched 2026-10-14
- **Our delta:** which case to state aloud and when.

### T01-10 · Benchmarking vs analysis — Know · ✅ written `docs/dsa/pages/phase-1-complexity/10-benchmarking-vs-analysis.md`
- **Read this:** [1.4 Analysis of Algorithms](https://algs4.cs.princeton.edu/14analysis/) · Princeton Algorithms · the scientific method of timing runs against mathematical models · covers our angle: **partial** - little on cache effects · fetched 2026-10-14 (*headings only*)
- **Also good:** [Experimental analysis](https://tarjotin.cs.aalto.fi/CS-A1140/2023/notes/intro-experimental.html) · Aalto CS-A1140 notes · why constant factors need measurement (examples in Scala) · fetched 2026-10-14
- **Our delta:** why a linearithmic solution can beat a linear one at real sizes.

### T01-11 · Proving optimality — Know · ✅ written `docs/dsa/pages/phase-1-complexity/11-proving-optimality.md`
- **Read this:** [Lower Bounds for Sorting](https://tarjotin.cs.aalto.fi/cs-a1141/OpenDSA/Books/CS-A1141/html/SortingLowerBound.html) · Aalto OpenDSA · the decision-tree argument for comparison sorting · covers our angle: **partial** - sorting only · fetched 2026-10-14 (*headings only*)
- **Also good:** [Comparison sort](https://en.wikipedia.org/wiki/Comparison_sort) · Wikipedia · the bound stated with its limits · fetched 2026-10-14
- **Our delta:** answering "can we do better?" for non-sorting problems.
