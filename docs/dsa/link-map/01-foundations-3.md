---
title: "Link map · DSA · Part 1 (phases 0-2), file 3"
sidebar_label: "01 · foundations (3)"
sidebar_position: 3
---

# Link map · DSA · Part 1, file 3 (phase 2)

Covers the 13 topic rows of phase 2 (T02-01 to T02-13). *read* = I read the passage; *headings only* = fetched at 200 and headings checked. All fetched 2026-10-14.

### T02-01 · Recursion and the call stack — Master · ✅ written `docs/dsa/pages/phase-2-recursion-maths-bits/01-recursion-and-the-call-stack.md`
- **Read this:** [Recursion and stack](https://javascript.info/recursion) · javascript.info · the execution context stack and recursion depth explained in JS · covers our angle: **partial** - no explicit-stack conversion · fetched 2026-10-14 (*read*)
- **Beyond the docs:** [Considering the performance implications of converting recursion to an explicit stack](https://devblogs.microsoft.com/oldnewthing/20180927-00/?p=99835) · Raymond Chen, The Old New Thing · weighs when the explicit-stack version is worth it · fetched 2026-10-14 (*headings only*)
- **Our delta:** converting to an explicit stack and Node's depth limit as an interview constraint.

### T02-02 · Divide and conquer — Master · ✅ written `docs/dsa/pages/phase-2-recursion-maths-bits/02-divide-and-conquer.md`
- **Read this:** [2.2 Mergesort](https://algs4.cs.princeton.edu/22mergesort/) · Princeton Algorithms · merge sort with analysis and code · covers our angle: **partial** - no quickselect or inversions · fetched 2026-10-14 (*headings only*)
- **Also good:** [Divide and Conquer: Counting Inversions](https://cs.dartmouth.edu/~deepc/LecNotes/cs31/lec5.pdf) · Dartmouth lecture notes (PDF) · counts cross inversions during the merge · fetched 2026-10-14
- **Also good:** [Quickselect](https://en.wikipedia.org/wiki/Quickselect) · Wikipedia · the algorithm and its expected cost · fetched 2026-10-14

### T02-03 · Mathematical foundations — Master · ✅ written `docs/dsa/pages/phase-2-recursion-maths-bits/03-mathematical-foundations.md`
- **Read this:** [Euclidean algorithm for computing the greatest common divisor](https://cp-algorithms.com/algebra/euclid-algorithm.html) · cp-algorithms · gcd, lcm and the extended version with proofs · covers our angle: **partial** - gcd and lcm only · fetched 2026-10-14 (*headings only*)
- **Also good:** [Sieve of Eratosthenes](https://cp-algorithms.com/algebra/sieve-of-eratosthenes.html) · cp-algorithms · the sieve with its asymptotics and optimisations · fetched 2026-10-14
- **Also good:** [Modular Inverse](https://cp-algorithms.com/algebra/module-inverse.html) · cp-algorithms · inverses under a modulus · fetched 2026-10-14
- **Our delta:** why answers are taken modulo a large prime, and the remainder trap with negatives.

### T02-04 · Bit manipulation — Master · ✅ written `docs/dsa/pages/phase-2-recursion-maths-bits/04-bit-manipulation.md`
- **Read this:** [Bit manipulation](https://cp-algorithms.com/algebra/bit-manipulation.html) · cp-algorithms · set, clear, test, lowest bit and popcount in one page · covers our angle: **partial** - C++ builtins, no JS 32-bit ceiling · fetched 2026-10-14 (*headings only*)
- **Beyond the docs:** [Bit Twiddling Hacks](https://graphics.stanford.edu/~seander/bithacks.html) · Sean Eron Anderson, Stanford · the classic catalogue of counting and parity tricks · fetched 2026-10-14 (*headings only*)
- **Our delta:** the 32-bit ceiling in JavaScript and XOR interview problems.

### T02-05 · Integer limits and overflow — Master · ✅ written `docs/dsa/pages/phase-2-recursion-maths-bits/05-integer-limits-and-overflow.md`
- **Read this:** [Number.MAX_SAFE_INTEGER](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number/MAX_SAFE_INTEGER) · MDN · the safe range and why it exists (52-bit mantissa) · covers our angle: **partial** - JavaScript side only · fetched 2026-10-14 (*read*)
- **Also good:** [Math (Java SE 21)](https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/lang/Math.html) · Oracle · `addExact` and the exact-arithmetic family · fetched 2026-10-14
- **Also good:** [BigInt: arbitrary-precision integers in JavaScript](https://v8.dev/features/bigint) · V8 · when BigInt is the fix · fetched 2026-10-14
- **Our delta:** Java `int` against `long` and overflow used on purpose in hashing.

### T02-06 · The backtracking skeleton — Understand · ✅ written `docs/dsa/pages/phase-2-recursion-maths-bits/06-the-backtracking-skeleton.md`
- **Read this:** [Introduction to Backtracking](https://algomaster.io/learn/dsa/backtracking-introduction) · AlgoMaster · sections on the template, choose-explore-unchoose, base case and pruning · covers our angle: full · fetched 2026-10-14 (*headings only*)
- **Beyond the docs:** [Backtracking (chapter 2)](https://jeffe.cs.illinois.edu/teaching/algorithms/book/02-backtracking.pdf) · Jeff Erickson, Algorithms book (PDF) · the recursive-strategy view from a textbook author · fetched 2026-10-14 (*headings only*)

### T02-07 · Fast exponentiation and the modular inverse — Understand · ✅ written `docs/dsa/pages/phase-2-recursion-maths-bits/07-fast-exponentiation-and-the-modular-inverse.md`
- **Read this:** [Binary Exponentiation](https://cp-algorithms.com/algebra/binary-exp.html) · cp-algorithms · the squaring loop with modular and matrix variants · covers our angle: **partial** - no JS overflow in the multiply · fetched 2026-10-14 (*headings only*)
- **Also good:** [Modular Inverse](https://cp-algorithms.com/algebra/module-inverse.html) · cp-algorithms · the Fermat route and the extended-Euclid route · fetched 2026-10-14
- **Also good:** [Binomial Coefficients](https://cp-algorithms.com/combinatorics/binomial-coefficients.html) · cp-algorithms · computing them under a modulus · fetched 2026-10-14
- **Our delta:** an exact modular multiply in JavaScript.

### T02-08 · Combinatorics for counting problems — Understand · ✅ written `docs/dsa/pages/phase-2-recursion-maths-bits/08-combinatorics-for-counting-problems.md`
- **Read this:** [Binomial Coefficients](https://cp-algorithms.com/combinatorics/binomial-coefficients.html) · cp-algorithms · the base for counting: formulas, Pascal's rule, modular use · covers our angle: **partial** - no derangements or pigeonhole · fetched 2026-10-14 (*headings only*)
- **Also good:** [Catalan Numbers](https://cp-algorithms.com/combinatorics/catalan-numbers.html) · cp-algorithms · includes the balanced-parentheses interpretation · fetched 2026-10-14
- **Also good:** [The Inclusion-Exclusion Principle](https://cp-algorithms.com/combinatorics/inclusion-exclusion.html) · cp-algorithms · the principle with worked uses · fetched 2026-10-14
- **Our delta:** when a counting problem is really dynamic programming.

### T02-09 · Bitmask enumeration — Understand · ✅ written `docs/dsa/pages/phase-2-recursion-maths-bits/09-bitmask-enumeration.md`
- **Read this:** [Bitmask DP](https://usaco.guide/plat/dp-bitmasks) · USACO Guide · subsets as integers, the submask loop and the exponential limit · covers our angle: full · fetched 2026-10-14 (*headings only*)
- **Also good:** [Enumerating submasks of a bitmask](https://cp-algorithms.com/algebra/all-submasks.html) · cp-algorithms · the submask iteration and its count · fetched 2026-10-14

### T02-10 · Randomisation — Understand · ✅ written `docs/dsa/pages/phase-2-recursion-maths-bits/10-randomisation.md`
- **Read this:** [Fisher-Yates shuffle](https://en.wikipedia.org/wiki/Fisher%E2%80%93Yates_shuffle) · Wikipedia · the algorithm, its modulo-bias and naive-bias pitfalls · covers our angle: **partial** - no Java secure APIs, little on the random-comparator sort · fetched 2026-10-14 (*headings only*)
- **Also good:** [Reservoir sampling](https://en.wikipedia.org/wiki/Reservoir_sampling) · Wikipedia · the streaming sample · fetched 2026-10-14
- **Beyond the docs:** [Fisher-Yates Shuffle](https://bost.ocks.org/mike/shuffle/) · Mike Bostock · a visual walk-through of why the algorithm is uniform · fetched 2026-10-14 (*read*)
- **Our delta:** why shuffling with a random comparator is measurably biased, and the randomised pivot.

### T02-11 · Number problems that recur — Understand · ✅ written `docs/dsa/pages/phase-2-recursion-maths-bits/11-number-problems-that-recur.md`
- **Read this:** [Integer square root](https://en.wikipedia.org/wiki/Integer_square_root) · Wikipedia · the integer square root and its search and iteration methods · covers our angle: **partial** - one of six problems · fetched 2026-10-14 (*headings only*)
- **Also good:** [parseInt()](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/parseInt) · MDN · what the platform parser accepts and returns · fetched 2026-10-14
- **Beyond the docs:** [Binary Search's infamous pitfall](https://www.invak.id/binary-search-infamous-pitfall) · inva's personal corner · the midpoint overflow trap that bites an integer square root search · fetched 2026-10-14 (*headings only*)
- **Our delta:** Roman numerals, palindromic numbers, reversing an integer, `pow`.

### T02-12 · Matrix exponentiation — Know · ✅ written `docs/dsa/pages/phase-2-recursion-maths-bits/12-matrix-exponentiation.md`
- **Read this:** [Matrix Exponentiation](https://algomaster.io/learn/dsa/matrix-exponentiation) · AlgoMaster · from a recurrence to a matrix, then binary exponentiation of it, then any linear recurrence · covers our angle: full · fetched 2026-10-14 (*headings only*)
- **Also good:** [Fibonacci Numbers](https://cp-algorithms.com/algebra/fibonacci-numbers.html) · cp-algorithms · matrix and fast-doubling forms · fetched 2026-10-14

### T02-13 · Geometry basics — Know · ✅ written `docs/dsa/pages/phase-2-recursion-maths-bits/13-geometry-basics.md`
- **Read this:** [Check if two segments intersect](https://cp-algorithms.com/geometry/check-segments-intersection.html) · cp-algorithms · the cross-product orientation test, in integers · covers our angle: **partial** - segments only · fetched 2026-10-14 (*headings only*)
- **Also good:** [Geometry Primitives](https://usaco.guide/plat/geo-pri) · USACO Guide · points, vectors and cross products from first principles · fetched 2026-10-14
- **Also good:** [Basic Geometry](https://cp-algorithms.com/geometry/basic-geometry.html) · cp-algorithms · dot and cross product toolbox · fetched 2026-10-14
- **Our delta:** floating-point epsilon decisions, point in polygon, closest pair.
