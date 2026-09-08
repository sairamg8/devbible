---
title: "Phase 2 — Recursion, maths and bits"
sidebar_label: "Overview"
sidebar_position: 0
---

> Verified: 2026-09-07. Language-behaviour claims on every page name their primary source on a
> `> Verified:` line — MDN for JavaScript (bitwise operand coercion to 32 bits, `Number.MAX_SAFE_INTEGER`,
> `BigInt`, the `Array.prototype.sort` comparator contract, `Math.random`, "too much recursion")
> and the JDK 25 API documentation for Java (`Math.addExact` / `multiplyExact` / `floorMod` /
> `floorDiv`, `Integer`'s bit methods, `Collections.shuffle`). The algorithms themselves — Euclid,
> the sieve, binary exponentiation, Fisher–Yates, Catalan numbers, matrix exponentiation, cross
> products — are **mathematics**, derived on the page rather than cited. Solutions are TypeScript
> first, Java second. **No sandbox run**; these pages carry code, never program output, and never
> a timing or a stack-depth figure.

**The foundations the harder phases quietly assume, and the arithmetic that turns a correct
algorithm into a wrong program.** Every later phase recurses — trees, graphs, backtracking, divide
and conquer — so the call stack has to be something you can convert to an explicit stack on
demand. Every counting problem lands on a modulus, and `%` is a remainder rather than a modulus in
both languages, so a subtraction makes the answer negative. Every "subsets of a set" problem wants
a bitmask, and JavaScript's bitwise operators silently truncate to 32 signed bits while Java's
`long` does not. This phase is that layer: recursion and its conversion to iteration, divide and
conquer as a template, the small set of number theory that keeps reappearing, bit manipulation and
where it overflows, integer limits in both languages, and the counting and randomisation
techniques the later phases build on. [Phase 1](../phase-1-complexity/README.md) gave the language
for stating a cost; this phase gives the operations whose cost you will be stating.

✅ **All 13 topics written** — 111 files.

| # | Page | Tier | State |
|---|---|---|---|
| 01 | **[Recursion and the call stack](./01-recursion-and-the-call-stack.md)** | <span className="db-tier t-master">Master</span> | ✅ written |
| 01b | **[The three ways the contract breaks](./01b-the-three-ways-the-contract-breaks.md)** | <span className="db-tier t-master">Master</span> | ✅ written — one topic in several files |
| 01c | **[Recursion as the shape of the data](./01c-recursion-as-the-shape-of-the-data.md)** | <span className="db-tier t-master">Master</span> | ✅ written — one topic in several files |
| 01d | **[Tail position and mutual recursion](./01d-tail-position-and-mutual-recursion.md)** | <span className="db-tier t-master">Master</span> | ✅ written — one topic in several files |
| 01e | **[Memoising a recursive function](./01e-memoising-a-recursive-function.md)** | <span className="db-tier t-master">Master</span> | ✅ written — one topic in several files |
| 01f | **[Converting to an explicit stack](./01f-converting-recursion-to-an-explicit-stack.md)** | <span className="db-tier t-master">Master</span> | ✅ written — one topic in several files |
| 01g | **[Post-order and the resume-point frame](./01g-post-order-and-the-resume-point-frame.md)** | <span className="db-tier t-master">Master</span> | ✅ written — one topic in several files |
| 01h | **[Choosing, and reading the overflow](./01h-choosing-recursion-and-reading-the-overflow.md)** | <span className="db-tier t-master">Master</span> | ✅ written — one topic in several files |
| 01b | **[The three ways the contract breaks](./01b-the-three-ways-the-contract-breaks.md)** | <span className="db-tier t-master">Master</span> | ✅ written — one topic in several files |
| 01c | **[Recursion as the shape of the data](./01c-recursion-as-the-shape-of-the-data.md)** | <span className="db-tier t-master">Master</span> | ✅ written — one topic in several files |
| 01d | **[Tail position and mutual recursion](./01d-tail-position-and-mutual-recursion.md)** | <span className="db-tier t-master">Master</span> | ✅ written — one topic in several files |
| 01e | **[Memoising a recursive function](./01e-memoising-a-recursive-function.md)** | <span className="db-tier t-master">Master</span> | ✅ written — one topic in several files |
| 01f | **[Converting to an explicit stack](./01f-converting-recursion-to-an-explicit-stack.md)** | <span className="db-tier t-master">Master</span> | ✅ written — one topic in several files |
| 01g | **[Post-order and the resume-point frame](./01g-post-order-and-the-resume-point-frame.md)** | <span className="db-tier t-master">Master</span> | ✅ written — one topic in several files |
| 01h | **[Choosing, and reading the overflow](./01h-choosing-recursion-and-reading-the-overflow.md)** | <span className="db-tier t-master">Master</span> | ✅ written — one topic in several files |
| 02 | **[Divide and conquer](./02-divide-and-conquer.md)** | <span className="db-tier t-master">Master</span> | ✅ written |
| 02b | **[Base cases, induction, and when to reach for it](./02b-base-cases-induction-and-when-to-reach-for-it.md)** | <span className="db-tier t-master">Master</span> | ✅ written — one topic in several files |
| 02c | **[Merge sort](./02c-merge-sort.md)** | <span className="db-tier t-master">Master</span> | ✅ written — one topic in several files |
| 02d | **[Stability and the comparator contract](./02d-stability-and-the-comparator-contract.md)** | <span className="db-tier t-master">Master</span> | ✅ written — one topic in several files |
| 02e | **[Counting inversions](./02e-counting-inversions.md)** | <span className="db-tier t-master">Master</span> | ✅ written — one topic in several files |
| 02f | **[Quickselect](./02f-quickselect.md)** | <span className="db-tier t-master">Master</span> | ✅ written — one topic in several files |
| 02g | **[Median of medians, and duplicates](./02g-median-of-medians-and-duplicate-heavy-input.md)** | <span className="db-tier t-master">Master</span> | ✅ written — one topic in several files |
| 02h | **[Solve halves, combine — without sorting](./02h-solve-halves-combine-when-it-is-not-sorting.md)** | <span className="db-tier t-master">Master</span> | ✅ written — one topic in several files |
| 02i | **[Binary search as degenerate D&C](./02i-binary-search-as-degenerate-divide-and-conquer.md)** | <span className="db-tier t-master">Master</span> | ✅ written — one topic in several files |
| 02b | **[Base cases, induction, and when to reach for it](./02b-base-cases-induction-and-when-to-reach-for-it.md)** | <span className="db-tier t-master">Master</span> | ✅ written — one topic in several files |
| 02c | **[Merge sort](./02c-merge-sort.md)** | <span className="db-tier t-master">Master</span> | ✅ written — one topic in several files |
| 02d | **[Stability and the comparator contract](./02d-stability-and-the-comparator-contract.md)** | <span className="db-tier t-master">Master</span> | ✅ written — one topic in several files |
| 02e | **[Counting inversions](./02e-counting-inversions.md)** | <span className="db-tier t-master">Master</span> | ✅ written — one topic in several files |
| 02f | **[Quickselect](./02f-quickselect.md)** | <span className="db-tier t-master">Master</span> | ✅ written — one topic in several files |
| 02g | **[Median of medians, and duplicates](./02g-median-of-medians-and-duplicate-heavy-input.md)** | <span className="db-tier t-master">Master</span> | ✅ written — one topic in several files |
| 02h | **[Solve halves, combine — without sorting](./02h-solve-halves-combine-when-it-is-not-sorting.md)** | <span className="db-tier t-master">Master</span> | ✅ written — one topic in several files |
| 02i | **[Binary search as degenerate D&C](./02i-binary-search-as-degenerate-divide-and-conquer.md)** | <span className="db-tier t-master">Master</span> | ✅ written — one topic in several files |
| 03 | **[Mathematical foundations](./03-mathematical-foundations.md)** | <span className="db-tier t-master">Master</span> | ✅ written |
| 03b | **[gcd on signed and wide types](./03b-gcd-on-signed-and-wide-types.md)** | <span className="db-tier t-master">Master</span> | ✅ written — one topic in several files |
| 03c | **[lcm and the multiplication order](./03c-lcm-and-the-multiplication-order.md)** | <span className="db-tier t-master">Master</span> | ✅ written — one topic in several files |
| 03d | **[Extended Euclid and Bézout](./03d-the-extended-euclidean-algorithm-and-bezout.md)** | <span className="db-tier t-master">Master</span> | ✅ written — one topic in several files |
| 03e | **[The Chinese remainder theorem](./03e-the-chinese-remainder-theorem.md)** | <span className="db-tier t-master">Master</span> | ✅ written — one topic in several files |
| 03f | **[Primality by trial division](./03f-primality-by-trial-division.md)** | <span className="db-tier t-master">Master</span> | ✅ written — one topic in several files |
| 03g | **[The sieve of Eratosthenes](./03g-the-sieve-of-eratosthenes.md)** | <span className="db-tier t-master">Master</span> | ✅ written — one topic in several files |
| 03h | **[Factorisation and smallest prime factors](./03h-factorisation-and-smallest-prime-factors.md)** | <span className="db-tier t-master">Master</span> | ✅ written — one topic in several files |
| 03i | **[Divisor functions and the totient](./03i-divisor-functions-and-the-totient.md)** | <span className="db-tier t-master">Master</span> | ✅ written — one topic in several files |
| 03j | **[Modular arithmetic as a ring](./03j-modular-arithmetic-and-the-remainder-trap.md)** | <span className="db-tier t-master">Master</span> | ✅ written — one topic in several files |
| 03k | **[The remainder trap](./03k-the-remainder-trap-in-indices-hashes-and-shards.md)** | <span className="db-tier t-master">Master</span> | ✅ written — one topic in several files |
| 03l | **[Why modulo a large prime](./03l-why-answers-are-taken-modulo-a-large-prime.md)** | <span className="db-tier t-master">Master</span> | ✅ written — one topic in several files |
| 03b | **[gcd on signed and wide types](./03b-gcd-on-signed-and-wide-types.md)** | <span className="db-tier t-master">Master</span> | ✅ written — one topic in several files |
| 03c | **[lcm and the multiplication order](./03c-lcm-and-the-multiplication-order.md)** | <span className="db-tier t-master">Master</span> | ✅ written — one topic in several files |
| 03d | **[Extended Euclid and Bézout](./03d-the-extended-euclidean-algorithm-and-bezout.md)** | <span className="db-tier t-master">Master</span> | ✅ written — one topic in several files |
| 03e | **[The Chinese remainder theorem](./03e-the-chinese-remainder-theorem.md)** | <span className="db-tier t-master">Master</span> | ✅ written — one topic in several files |
| 03f | **[Primality by trial division](./03f-primality-by-trial-division.md)** | <span className="db-tier t-master">Master</span> | ✅ written — one topic in several files |
| 03g | **[The sieve of Eratosthenes](./03g-the-sieve-of-eratosthenes.md)** | <span className="db-tier t-master">Master</span> | ✅ written — one topic in several files |
| 03h | **[Factorisation and smallest prime factors](./03h-factorisation-and-smallest-prime-factors.md)** | <span className="db-tier t-master">Master</span> | ✅ written — one topic in several files |
| 03i | **[Divisor functions and the totient](./03i-divisor-functions-and-the-totient.md)** | <span className="db-tier t-master">Master</span> | ✅ written — one topic in several files |
| 03j | **[Modular arithmetic as a ring](./03j-modular-arithmetic-and-the-remainder-trap.md)** | <span className="db-tier t-master">Master</span> | ✅ written — one topic in several files |
| 03k | **[The remainder trap](./03k-the-remainder-trap-in-indices-hashes-and-shards.md)** | <span className="db-tier t-master">Master</span> | ✅ written — one topic in several files |
| 03l | **[Why modulo a large prime](./03l-why-answers-are-taken-modulo-a-large-prime.md)** | <span className="db-tier t-master">Master</span> | ✅ written — one topic in several files |
| 04 | **[Bit manipulation](./04-bit-manipulation.md)** | <span className="db-tier t-master">Master</span> | ✅ written |
| 04b | **[Single-bit idioms and masks](./04b-the-single-bit-idioms-and-masks.md)** | <span className="db-tier t-master">Master</span> | ✅ written — one topic in several files |
| 04c | **[Clearing and isolating the lowest bit](./04c-clearing-and-isolating-the-lowest-bit.md)** | <span className="db-tier t-master">Master</span> | ✅ written — one topic in several files |
| 04d | **[Counting set bits, and the platform methods](./04d-counting-set-bits-and-the-platform-methods.md)** | <span className="db-tier t-master">Master</span> | ✅ written — one topic in several files |
| 04e | **[XOR, and the problems it solves](./04e-xor-and-the-problems-it-solves.md)** | <span className="db-tier t-master">Master</span> | ✅ written — one topic in several files |
| 04f | **[Submasks, and the 3^n count](./04f-submasks-and-the-3-to-the-n-count.md)** | <span className="db-tier t-master">Master</span> | ✅ written — one topic in several files |
| 04g | **[The 32-bit ceiling, and what to use instead](./04g-the-32-bit-ceiling-and-what-to-use-instead.md)** | <span className="db-tier t-master">Master</span> | ✅ written — one topic in several files |
| 04b | **[Single-bit idioms and masks](./04b-the-single-bit-idioms-and-masks.md)** | <span className="db-tier t-master">Master</span> | ✅ written — one topic in several files |
| 04c | **[Clearing and isolating the lowest bit](./04c-clearing-and-isolating-the-lowest-bit.md)** | <span className="db-tier t-master">Master</span> | ✅ written — one topic in several files |
| 04d | **[Counting set bits, and the platform methods](./04d-counting-set-bits-and-the-platform-methods.md)** | <span className="db-tier t-master">Master</span> | ✅ written — one topic in several files |
| 04e | **[XOR, and the problems it solves](./04e-xor-and-the-problems-it-solves.md)** | <span className="db-tier t-master">Master</span> | ✅ written — one topic in several files |
| 04f | **[Submasks, and the 3^n count](./04f-submasks-and-the-3-to-the-n-count.md)** | <span className="db-tier t-master">Master</span> | ✅ written — one topic in several files |
| 04g | **[The 32-bit ceiling, and what to use instead](./04g-the-32-bit-ceiling-and-what-to-use-instead.md)** | <span className="db-tier t-master">Master</span> | ✅ written — one topic in several files |
| 05 | **[Integer limits and overflow](./05-integer-limits-and-overflow.md)** | <span className="db-tier t-master">Master</span> | ✅ written |
| 05b | **[BigInt, and when to reach for it](./05b-bigint-and-when-to-reach-for-it.md)** | <span className="db-tier t-master">Master</span> | ✅ written — one topic in several files |
| 05c | **[Java's int, and the checked arithmetic](./05c-javas-int-and-the-checked-arithmetic.md)** | <span className="db-tier t-master">Master</span> | ✅ written — one topic in several files |
| 05d | **[The three silent overflows](./05d-the-three-silent-overflows.md)** | <span className="db-tier t-master">Master</span> | ✅ written — one topic in several files |
| 05e | **[Overflow on purpose](./05e-overflow-on-purpose.md)** | <span className="db-tier t-master">Master</span> | ✅ written — one topic in several files |
| 05f | **[The cross-language trap](./05f-the-cross-language-trap.md)** | <span className="db-tier t-master">Master</span> | ✅ written — one topic in several files |
| 05b | **[BigInt, and when to reach for it](./05b-bigint-and-when-to-reach-for-it.md)** | <span className="db-tier t-master">Master</span> | ✅ written — one topic in several files |
| 05c | **[Java's int, and the checked arithmetic](./05c-javas-int-and-the-checked-arithmetic.md)** | <span className="db-tier t-master">Master</span> | ✅ written — one topic in several files |
| 05d | **[The three silent overflows](./05d-the-three-silent-overflows.md)** | <span className="db-tier t-master">Master</span> | ✅ written — one topic in several files |
| 05e | **[Overflow on purpose](./05e-overflow-on-purpose.md)** | <span className="db-tier t-master">Master</span> | ✅ written — one topic in several files |
| 05f | **[The cross-language trap](./05f-the-cross-language-trap.md)** | <span className="db-tier t-master">Master</span> | ✅ written — one topic in several files |
| 06 | **[The backtracking skeleton](./06-the-backtracking-skeleton.md)** | <span className="db-tier t-understand">Understand</span> | ✅ written |
| 06b | **[Copies and the two path designs](./06b-copies-and-the-two-path-designs.md)** | <span className="db-tier t-understand">Understand</span> | ✅ written — one topic in several files |
| 06c | **[The cost of the search tree](./06c-the-cost-of-the-search-tree.md)** | <span className="db-tier t-understand">Understand</span> | ✅ written — one topic in several files |
| 06d | **[Subsets and combinations](./06d-subsets-and-combinations.md)** | <span className="db-tier t-understand">Understand</span> | ✅ written — one topic in several files |
| 06e | **[Permutations and the used array](./06e-permutations-and-the-used-array.md)** | <span className="db-tier t-understand">Understand</span> | ✅ written — one topic in several files |
| 06f | **[Duplicates in subsets and combinations](./06f-duplicates-in-subsets-and-combinations.md)** | <span className="db-tier t-understand">Understand</span> | ✅ written — one topic in several files |
| 06g | **[Duplicates in permutations](./06g-duplicates-in-permutations.md)** | <span className="db-tier t-understand">Understand</span> | ✅ written — one topic in several files |
| 06h | **[Feasibility pruning](./06h-feasibility-pruning.md)** | <span className="db-tier t-understand">Understand</span> | ✅ written — one topic in several files |
| 06i | **[Bound pruning and ordering](./06i-bound-pruning-and-ordering.md)** | <span className="db-tier t-understand">Understand</span> | ✅ written — one topic in several files |
| 06j | **[N-Queens and symmetry](./06j-n-queens-and-symmetry.md)** | <span className="db-tier t-understand">Understand</span> | ✅ written — one topic in several files |
| 06k | **[State that is not the path](./06k-state-that-is-not-the-path.md)** | <span className="db-tier t-understand">Understand</span> | ✅ written — one topic in several files |
| 06b | **[Copies and the two path designs](./06b-copies-and-the-two-path-designs.md)** | <span className="db-tier t-understand">Understand</span> | ✅ written — one topic in several files |
| 06c | **[The cost of the search tree](./06c-the-cost-of-the-search-tree.md)** | <span className="db-tier t-understand">Understand</span> | ✅ written — one topic in several files |
| 06d | **[Subsets and combinations](./06d-subsets-and-combinations.md)** | <span className="db-tier t-understand">Understand</span> | ✅ written — one topic in several files |
| 06e | **[Permutations and the used array](./06e-permutations-and-the-used-array.md)** | <span className="db-tier t-understand">Understand</span> | ✅ written — one topic in several files |
| 06f | **[Duplicates in subsets and combinations](./06f-duplicates-in-subsets-and-combinations.md)** | <span className="db-tier t-understand">Understand</span> | ✅ written — one topic in several files |
| 06g | **[Duplicates in permutations](./06g-duplicates-in-permutations.md)** | <span className="db-tier t-understand">Understand</span> | ✅ written — one topic in several files |
| 06h | **[Feasibility pruning](./06h-feasibility-pruning.md)** | <span className="db-tier t-understand">Understand</span> | ✅ written — one topic in several files |
| 06i | **[Bound pruning and ordering](./06i-bound-pruning-and-ordering.md)** | <span className="db-tier t-understand">Understand</span> | ✅ written — one topic in several files |
| 06j | **[N-Queens and symmetry](./06j-n-queens-and-symmetry.md)** | <span className="db-tier t-understand">Understand</span> | ✅ written — one topic in several files |
| 07 | **[Fast exponentiation and the modular inverse](./07-fast-exponentiation-and-the-modular-inverse.md)** | <span className="db-tier t-understand">Understand</span> | ✅ written |
| 07b | **[Modular exponentiation and overflow](./07b-modular-exponentiation-and-where-the-product-overflows.md)** | <span className="db-tier t-understand">Understand</span> | ✅ written — one topic in several files |
| 07c | **[An exact modular multiply in JS](./07c-an-exact-modular-multiply-in-javascript.md)** | <span className="db-tier t-understand">Understand</span> | ✅ written — one topic in several files |
| 07d | **[The modular inverse](./07d-the-modular-inverse.md)** | <span className="db-tier t-understand">Understand</span> | ✅ written — one topic in several files |
| 07e | **[Binomials under a modulus](./07e-binomial-coefficients-under-a-modulus.md)** | <span className="db-tier t-understand">Understand</span> | ✅ written — one topic in several files |
| 07f | **[Any associative operation](./07f-any-associative-operation.md)** | <span className="db-tier t-understand">Understand</span> | ✅ written — one topic in several files |
| 07b | **[Modular exponentiation and overflow](./07b-modular-exponentiation-and-where-the-product-overflows.md)** | <span className="db-tier t-understand">Understand</span> | ✅ written — one topic in several files |
| 07c | **[An exact modular multiply in JS](./07c-an-exact-modular-multiply-in-javascript.md)** | <span className="db-tier t-understand">Understand</span> | ✅ written — one topic in several files |
| 07d | **[The modular inverse](./07d-the-modular-inverse.md)** | <span className="db-tier t-understand">Understand</span> | ✅ written — one topic in several files |
| 07e | **[Binomials under a modulus](./07e-binomial-coefficients-under-a-modulus.md)** | <span className="db-tier t-understand">Understand</span> | ✅ written — one topic in several files |
| 08 | **[Combinatorics for counting problems](./08-combinatorics-for-counting-problems.md)** | <span className="db-tier t-understand">Understand</span> | ✅ written |
| 08b | **[Pascal's rule and the DP table](./08b-pascals-rule-and-the-dp-table.md)** | <span className="db-tier t-understand">Understand</span> | ✅ written — one topic in several files |
| 08c | **[Stars and bars, multisets](./08c-stars-and-bars-and-multisets.md)** | <span className="db-tier t-understand">Understand</span> | ✅ written — one topic in several files |
| 08d | **[Catalan numbers](./08d-catalan-numbers.md)** | <span className="db-tier t-understand">Understand</span> | ✅ written — one topic in several files |
| 08e | **[Inclusion–exclusion, derangements](./08e-inclusion-exclusion-and-derangements.md)** | <span className="db-tier t-understand">Understand</span> | ✅ written — one topic in several files |
| 08f | **[Closed form, or DP?](./08f-closed-form-or-dp.md)** | <span className="db-tier t-understand">Understand</span> | ✅ written — one topic in several files |
| 08g | **[The pigeonhole principle](./08g-the-pigeonhole-principle.md)** | <span className="db-tier t-understand">Understand</span> | ✅ written — one topic in several files |
| 08b | **[Pascal's rule and the DP table](./08b-pascals-rule-and-the-dp-table.md)** | <span className="db-tier t-understand">Understand</span> | ✅ written — one topic in several files |
| 08c | **[Stars and bars, multisets](./08c-stars-and-bars-and-multisets.md)** | <span className="db-tier t-understand">Understand</span> | ✅ written — one topic in several files |
| 08d | **[Catalan numbers](./08d-catalan-numbers.md)** | <span className="db-tier t-understand">Understand</span> | ✅ written — one topic in several files |
| 08e | **[Inclusion–exclusion, derangements](./08e-inclusion-exclusion-and-derangements.md)** | <span className="db-tier t-understand">Understand</span> | ✅ written — one topic in several files |
| 08f | **[Closed form, or DP?](./08f-closed-form-or-dp.md)** | <span className="db-tier t-understand">Understand</span> | ✅ written — one topic in several files |
| 08g | **[The pigeonhole principle](./08g-the-pigeonhole-principle.md)** | <span className="db-tier t-understand">Understand</span> | ✅ written — one topic in several files |
| 09 | **[Bitmask enumeration](./09-bitmask-enumeration.md)** | <span className="db-tier t-understand">Understand</span> | ✅ written |
| 09b | **[Precedence and the 32-bit bound](./09b-precedence-and-the-32-bit-loop-bound.md)** | <span className="db-tier t-understand">Understand</span> | ✅ written — one topic in several files |
| 09c | **[Generating masks in a useful order](./09c-generating-masks-in-a-useful-order.md)** | <span className="db-tier t-understand">Understand</span> | ✅ written — one topic in several files |
| 09d | **[Fixed-size subsets and Gray code](./09d-fixed-size-subsets-and-gray-code.md)** | <span className="db-tier t-understand">Understand</span> | ✅ written — one topic in several files |
| 09e | **[DP over masks: shape and cost](./09e-dp-over-masks-the-shape-and-the-cost.md)** | <span className="db-tier t-understand">Understand</span> | ✅ written — one topic in several files |
| 09f | **[dp[mask][last] and the tour](./09f-dp-over-masks-with-a-last-element.md)** | <span className="db-tier t-understand">Understand</span> | ✅ written — one topic in several files |
| 09g | **[Submask DP and partitions](./09g-submask-dp-and-partitions.md)** | <span className="db-tier t-understand">Understand</span> | ✅ written — one topic in several files |
| 09h | **[Sum over subsets and Möbius](./09h-sum-over-subsets-and-the-mobius-inverse.md)** | <span className="db-tier t-understand">Understand</span> | ✅ written — one topic in several files |
| 09i | **[Where n stops fitting](./09i-where-n-stops-fitting.md)** | <span className="db-tier t-understand">Understand</span> | ✅ written — one topic in several files |
| 09b | **[Precedence and the 32-bit bound](./09b-precedence-and-the-32-bit-loop-bound.md)** | <span className="db-tier t-understand">Understand</span> | ✅ written — one topic in several files |
| 09c | **[Generating masks in a useful order](./09c-generating-masks-in-a-useful-order.md)** | <span className="db-tier t-understand">Understand</span> | ✅ written — one topic in several files |
| 09d | **[Fixed-size subsets and Gray code](./09d-fixed-size-subsets-and-gray-code.md)** | <span className="db-tier t-understand">Understand</span> | ✅ written — one topic in several files |
| 09e | **[DP over masks: shape and cost](./09e-dp-over-masks-the-shape-and-the-cost.md)** | <span className="db-tier t-understand">Understand</span> | ✅ written — one topic in several files |
| 09f | **[dp[mask][last] and the tour](./09f-dp-over-masks-with-a-last-element.md)** | <span className="db-tier t-understand">Understand</span> | ✅ written — one topic in several files |
| 09g | **[Submask DP and partitions](./09g-submask-dp-and-partitions.md)** | <span className="db-tier t-understand">Understand</span> | ✅ written — one topic in several files |
| 09h | **[Sum over subsets and Möbius](./09h-sum-over-subsets-and-the-mobius-inverse.md)** | <span className="db-tier t-understand">Understand</span> | ✅ written — one topic in several files |
| 09i | **[Where n stops fitting](./09i-where-n-stops-fitting.md)** | <span className="db-tier t-understand">Understand</span> | ✅ written — one topic in several files |
| 10 | **[Randomisation](./10-randomisation.md)** | <span className="db-tier t-understand">Understand</span> | ✅ written |
| 10b | **[Fisher–Yates in practice](./10b-fisher-yates-in-practice.md)** | <span className="db-tier t-understand">Understand</span> | ✅ written — one topic in several files |
| 10c | **[The random comparator shuffle](./10c-the-random-comparator-shuffle.md)** | <span className="db-tier t-understand">Understand</span> | ✅ written — one topic in several files |
| 10d | **[Uniform integers and modulo bias](./10d-uniform-integers-and-modulo-bias.md)** | <span className="db-tier t-understand">Understand</span> | ✅ written — one topic in several files |
| 10e | **[The security boundary](./10e-the-security-boundary.md)** | <span className="db-tier t-understand">Understand</span> | ✅ written — one topic in several files |
| 10f | **[Seeding and reproducibility](./10f-seeding-and-reproducibility.md)** | <span className="db-tier t-understand">Understand</span> | ✅ written — one topic in several files |
| 10g | **[The randomised pivot](./10g-the-randomised-pivot.md)** | <span className="db-tier t-understand">Understand</span> | ✅ written — one topic in several files |
| 10h | **[Reservoir sampling](./10h-reservoir-sampling.md)** | <span className="db-tier t-understand">Understand</span> | ✅ written — one topic in several files |
| 10i | **[Why add randomness](./10i-why-add-randomness.md)** | <span className="db-tier t-understand">Understand</span> | ✅ written — one topic in several files |
| 10j | **[The secure APIs, in both languages](./10j-the-secure-apis-in-both-languages.md)** | <span className="db-tier t-understand">Understand</span> | ✅ written — one topic in several files |
| 10b | **[Fisher–Yates in practice](./10b-fisher-yates-in-practice.md)** | <span className="db-tier t-understand">Understand</span> | ✅ written — one topic in several files |
| 10c | **[The random comparator shuffle](./10c-the-random-comparator-shuffle.md)** | <span className="db-tier t-understand">Understand</span> | ✅ written — one topic in several files |
| 10d | **[Uniform integers and modulo bias](./10d-uniform-integers-and-modulo-bias.md)** | <span className="db-tier t-understand">Understand</span> | ✅ written — one topic in several files |
| 10e | **[The security boundary](./10e-the-security-boundary.md)** | <span className="db-tier t-understand">Understand</span> | ✅ written — one topic in several files |
| 10f | **[Seeding and reproducibility](./10f-seeding-and-reproducibility.md)** | <span className="db-tier t-understand">Understand</span> | ✅ written — one topic in several files |
| 10g | **[The randomised pivot](./10g-the-randomised-pivot.md)** | <span className="db-tier t-understand">Understand</span> | ✅ written — one topic in several files |
| 10h | **[Reservoir sampling](./10h-reservoir-sampling.md)** | <span className="db-tier t-understand">Understand</span> | ✅ written — one topic in several files |
| 10i | **[Why add randomness](./10i-why-add-randomness.md)** | <span className="db-tier t-understand">Understand</span> | ✅ written — one topic in several files |
| 11 | **[Number problems that recur](./11-number-problems-that-recur.md)** | <span className="db-tier t-understand">Understand</span> | ✅ written |
| 11b | **[Reversing an integer](./11b-reversing-an-integer.md)** | <span className="db-tier t-understand">Understand</span> | ✅ written — one topic in several files |
| 11c | **[Palindromic numbers](./11c-palindromic-numbers.md)** | <span className="db-tier t-understand">Understand</span> | ✅ written — one topic in several files |
| 11d | **[Integer pow](./11d-integer-pow.md)** | <span className="db-tier t-understand">Understand</span> | ✅ written — one topic in several files |
| 11e | **[Integer square root](./11e-integer-square-root.md)** | <span className="db-tier t-understand">Understand</span> | ✅ written — one topic in several files |
| 11f | **[Roman numerals](./11f-roman-numerals.md)** | <span className="db-tier t-understand">Understand</span> | ✅ written — one topic in several files |
| 11g | **[String to integer (atoi)](./11g-string-to-integer.md)** | <span className="db-tier t-understand">Understand</span> | ✅ written — one topic in several files |
| 11h | **[What the platform parsers do](./11h-what-the-platform-parsers-do.md)** | <span className="db-tier t-understand">Understand</span> | ✅ written — one topic in several files |
| 11i | **[Happy numbers and cycles](./11i-happy-numbers-and-cycle-detection.md)** | <span className="db-tier t-understand">Understand</span> | ✅ written — one topic in several files |
| 11j | **[Base conversion and digit sums](./11j-base-conversion-and-digit-sums.md)** | <span className="db-tier t-understand">Understand</span> | ✅ written — one topic in several files |
| 11b | **[Reversing an integer](./11b-reversing-an-integer.md)** | <span className="db-tier t-understand">Understand</span> | ✅ written — one topic in several files |
| 11c | **[Palindromic numbers](./11c-palindromic-numbers.md)** | <span className="db-tier t-understand">Understand</span> | ✅ written — one topic in several files |
| 11d | **[Integer pow](./11d-integer-pow.md)** | <span className="db-tier t-understand">Understand</span> | ✅ written — one topic in several files |
| 11e | **[Integer square root](./11e-integer-square-root.md)** | <span className="db-tier t-understand">Understand</span> | ✅ written — one topic in several files |
| 11f | **[Roman numerals](./11f-roman-numerals.md)** | <span className="db-tier t-understand">Understand</span> | ✅ written — one topic in several files |
| 11g | **[String to integer (atoi)](./11g-string-to-integer.md)** | <span className="db-tier t-understand">Understand</span> | ✅ written — one topic in several files |
| 11h | **[What the platform parsers do](./11h-what-the-platform-parsers-do.md)** | <span className="db-tier t-understand">Understand</span> | ✅ written — one topic in several files |
| 11i | **[Happy numbers and cycles](./11i-happy-numbers-and-cycle-detection.md)** | <span className="db-tier t-understand">Understand</span> | ✅ written — one topic in several files |
| 11j | **[Base conversion and digit sums](./11j-base-conversion-and-digit-sums.md)** | <span className="db-tier t-understand">Understand</span> | ✅ written — one topic in several files |
| 12 | **[Matrix exponentiation](./12-matrix-exponentiation.md)** | <span className="db-tier t-know">Know</span> | ✅ written |
| 12b | **[Augmenting the state](./12b-augmenting-the-state.md)** | <span className="db-tier t-know">Know</span> | ✅ written — one topic in several files |
| 12c | **[The multiply and the modulus](./12c-the-multiply-the-power-and-the-modulus.md)** | <span className="db-tier t-know">Know</span> | ✅ written — one topic in several files |
| 12d | **[Walks, and when not to bother](./12d-counting-walks-and-when-not-to-bother.md)** | <span className="db-tier t-know">Know</span> | ✅ written — one topic in several files |
| 12e | **[Fast doubling, and not Binet](./12e-fast-doubling-and-why-not-binet.md)** | <span className="db-tier t-know">Know</span> | ✅ written — one topic in several files |
| 12b | **[Augmenting the state](./12b-augmenting-the-state.md)** | <span className="db-tier t-know">Know</span> | ✅ written — one topic in several files |
| 12c | **[The multiply and the modulus](./12c-the-multiply-the-power-and-the-modulus.md)** | <span className="db-tier t-know">Know</span> | ✅ written — one topic in several files |
| 12d | **[Walks, and when not to bother](./12d-counting-walks-and-when-not-to-bother.md)** | <span className="db-tier t-know">Know</span> | ✅ written — one topic in several files |
| 12e | **[Fast doubling, and not Binet](./12e-fast-doubling-and-why-not-binet.md)** | <span className="db-tier t-know">Know</span> | ✅ written — one topic in several files |
| 13 | **[Geometry basics](./13-geometry-basics.md)** | <span className="db-tier t-know">Know</span> | ✅ written |
| 13b | **[The cross product](./13b-the-cross-product.md)** | <span className="db-tier t-know">Know</span> | ✅ written — one topic in several files |
| 13c | **[Orientation and segment intersection](./13c-orientation-and-segment-intersection.md)** | <span className="db-tier t-know">Know</span> | ✅ written — one topic in several files |
| 13d | **[Shoelace area and convexity](./13d-shoelace-area-and-convexity.md)** | <span className="db-tier t-know">Know</span> | ✅ written — one topic in several files |
| 13e | **[Point in polygon by ray casting](./13e-point-in-polygon-by-ray-casting.md)** | <span className="db-tier t-know">Know</span> | ✅ written — one topic in several files |
| 13f | **[Floating point and the epsilon decision](./13f-floating-point-and-the-epsilon-decision.md)** | <span className="db-tier t-know">Know</span> | ✅ written — one topic in several files |
| 13g | **[Integer exactness, and where it ends](./13g-integer-exactness-and-where-it-ends.md)** | <span className="db-tier t-know">Know</span> | ✅ written — one topic in several files |
| 13h | **[Closest pair of points](./13h-closest-pair-of-points.md)** | <span className="db-tier t-know">Know</span> | ✅ written — one topic in several files |
| 13i | **[Convex hull and the sweep line](./13i-convex-hull-and-the-sweep-line.md)** | <span className="db-tier t-know">Know</span> | ✅ written — one topic in several files |
| 13j | **[Max points on a line](./13j-max-points-on-a-line.md)** | <span className="db-tier t-know">Know</span> | ✅ written — one topic in several files |
| 13k | **[Geometry in backend work](./13k-geometry-in-backend-work.md)** | <span className="db-tier t-know">Know</span> | ✅ written — one topic in several files |
| 13b | **[The cross product](./13b-the-cross-product.md)** | <span className="db-tier t-know">Know</span> | ✅ written — one topic in several files |
| 13c | **[Orientation and segment intersection](./13c-orientation-and-segment-intersection.md)** | <span className="db-tier t-know">Know</span> | ✅ written — one topic in several files |
| 13d | **[Shoelace area and convexity](./13d-shoelace-area-and-convexity.md)** | <span className="db-tier t-know">Know</span> | ✅ written — one topic in several files |
| 13e | **[Point in polygon by ray casting](./13e-point-in-polygon-by-ray-casting.md)** | <span className="db-tier t-know">Know</span> | ✅ written — one topic in several files |
| 13f | **[Floating point and the epsilon decision](./13f-floating-point-and-the-epsilon-decision.md)** | <span className="db-tier t-know">Know</span> | ✅ written — one topic in several files |
| 13g | **[Integer exactness, and where it ends](./13g-integer-exactness-and-where-it-ends.md)** | <span className="db-tier t-know">Know</span> | ✅ written — one topic in several files |
| 13h | **[Closest pair of points](./13h-closest-pair-of-points.md)** | <span className="db-tier t-know">Know</span> | ✅ written — one topic in several files |
| 13i | **[Convex hull and the sweep line](./13i-convex-hull-and-the-sweep-line.md)** | <span className="db-tier t-know">Know</span> | ✅ written — one topic in several files |
| 13j | **[Max points on a line](./13j-max-points-on-a-line.md)** | <span className="db-tier t-know">Know</span> | ✅ written — one topic in several files |
| 13k | **[Geometry in backend work](./13k-geometry-in-backend-work.md)** | <span className="db-tier t-know">Know</span> | ✅ written — one topic in several files |

## Phase gate

Iterative and recursive versions of the same tree walk, a sieve and a modular binomial
coefficient written from memory in TypeScript and Java, and the subsets of a set enumerated by
bitmask — each with its complexity stated.

## Where this connects

- [Part 1 of the syllabus](../../syllabus/01-foundations.md) is the inventory this phase is
  written from; phase 3 there (arrays, hashing and prefix sums) is next.
- [Phase 1 · Space and the recursion stack](../phase-1-complexity/04-space-and-the-recursion-stack.md)
  and [Phase 1 · Tail calls, and the explicit stack](../phase-1-complexity/04b-tail-calls-and-the-explicit-stack.md)
  own the *cost* of recursion; this phase owns writing and converting it.
- [Phase 1 · Recurrences and the master theorem](../phase-1-complexity/08-recurrences-and-the-master-theorem.md)
  is where every divide-and-conquer bound on this phase's pages is solved.
- [Phase 0 · Language choice and runtime traps](../phase-0-the-interview-and-practice/04-language-choice-and-runtime-traps.md)
  carries the language facts the overflow and bit pages build on.
- The [JavaScript track](../../../javascript/README.md) and the [Java track](../../../java/README.md)
  hold the language mechanics in full.
