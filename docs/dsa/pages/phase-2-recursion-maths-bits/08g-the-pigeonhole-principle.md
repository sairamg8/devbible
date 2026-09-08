---
title: "The pigeonhole principle is trivial to state and is the hidden step in a surprising number of interview solutions — n items in m boxes force a box with ⌈n/m⌉ items, which is what guarantees a duplicate exists, that a sequence over a finite state space must cycle, and that some prefix sums share a residue"
sidebar_label: "08g · The pigeonhole principle"
sidebar_position: 8.6
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-08. The principle, its generalised form and every application argued here are
> **mathematics, derived on this page, not cited to a source**. No probability claim is made: the
> distinction between a pigeonhole *guarantee* and a birthday-paradox *likelihood* is one of the
> page's points. Java targets **JDK 25**; TypeScript first, Java second. Closes the counting topic
> that begins at [08](08-combinatorics-for-counting-problems.md). **No sandbox run.**

**"If `n` items go into `m` boxes and `n > m`, some box holds at least two" is not the interesting
part; the interesting part is that it is the hidden first step of solutions that look nothing like a
counting argument.** It is why a duplicate must exist among `n + 1` values drawn from `1…n`, which is
what makes the problem solvable without a hash set. It is why any sequence over a finite state space
must eventually repeat, which is the whole basis of cycle detection. It is why some hash bucket must
hold `⌈n/m⌉` keys, which is the honest worst case of every hash table. In each case, pigeonhole
supplies the **existence**, and the algorithm supplies the *finding* — keeping those two apart is the
skill.

## The statement

**Basic.** `n` items into `m` boxes with `n > m` forces some box to hold at least 2.

**Generalised.** `n` items into `m` boxes forces some box to hold at least `⌈n/m⌉`. Ceiling, not
floor — with 10 items in 3 boxes some box holds at least 4, not 3.

**Contrapositive form**, which is often how you actually use it: if every box holds at most `t`, then
`n ≤ m·t`. That is the version that turns into a bound rather than into an existence claim.

**What it does not say.** It does not say *which* box, it does not say how many boxes are full, and
it says nothing about probability. A pigeonhole conclusion is a certainty about a worst case, not a
statement about a typical one.

## The applications that actually appear

### A duplicate must exist

`n + 1` values, each in `1…n`. Values are the boxes, positions are the items, and there are more
items than boxes, so some value repeats. This is the guarantee that lets "find the duplicate number"
be solved without extra memory: you know a duplicate exists *before* you start looking, so the
algorithm may be one that would loop forever if none did — which is exactly what the Floyd
cycle-finding solution is. Without the pigeonhole step, that algorithm has no termination argument.

### A sequence over a finite state space must cycle

Iterate any function `f` on a set of size `m` from any starting point. After `m + 1` steps you have
visited `m + 1` states drawn from `m`, so two coincide — and because `f` is deterministic, everything
after the first repeat repeats too. So the trajectory is a "rho": a tail and then a cycle, both of
length at most `m`.

That single argument underwrites linked-list cycle detection, the duplicate-number solution above,
detecting a repeating decimal expansion (the remainders live in `0…d−1`, so the digits must cycle
within `d` steps), and Pollard's rho factorisation. **The bound on when the repeat must happen is the
useful output**, not merely the fact of it: it is what tells you the loop is O(m) rather than
unbounded.

### Two prefix sums share a residue

The cleanest place the principle turns directly into code. Given an array of length `n` and a modulus
`k`, consider the `n + 1` prefix sums `p₀ = 0, p₁, …, p_n` taken mod `k`. If `n + 1 > k` then two are
equal, and the subarray between them sums to a multiple of `k`. So **any array of length `k` or more
contains a non-empty subarray whose sum is divisible by `k`** — guaranteed, before any search.

```ts
// Returns [start, end) of a subarray whose sum is divisible by k, or null.
// The pigeonhole guarantees a result whenever nums.length >= k.
export function subarrayDivisibleByK(nums: number[], k: number): [number, number] | null {
  const firstIndexOfResidue = new Map<number, number>();
  firstIndexOfResidue.set(0, 0);                  // the empty prefix has residue 0
  let running = 0;
  for (let i = 0; i < nums.length; i++) {
    running = ((running + nums[i]) % k + k) % k;   // 🔴 % is a remainder; normalise for negatives
    const seen = firstIndexOfResidue.get(running);
    if (seen !== undefined) return [seen, i + 1];
    firstIndexOfResidue.set(running, i + 1);
  }
  return null;                                     // only reachable when nums.length < k
}
```

```java
// Java: Math.floorMod does the normalisation the % operator does not.
public static int[] subarrayDivisibleByK(int[] nums, int k) {
    Map<Integer, Integer> firstIndexOfResidue = new HashMap<>();
    firstIndexOfResidue.put(0, 0);
    int running = 0;
    for (int i = 0; i < nums.length; i++) {
        running = Math.floorMod(running + nums[i], k);
        Integer seen = firstIndexOfResidue.get(running);
        if (seen != null) return new int[] { seen, i + 1 };
        firstIndexOfResidue.put(running, i + 1);
    }
    return null;
}
```

The `% k + k) % k` (or `Math.floorMod`) is not decoration — `%` in both languages is a remainder that
takes the sign of the left operand, so a negative running sum lands on a negative residue and the map
misses the match. The full treatment of that is **Mathematical foundations** *(not written yet)*; the
one-line fix belongs here because this is where it bites.

### Some hash bucket is full

`n` keys into `m` buckets forces a bucket with `⌈n/m⌉` keys. That is the honest worst case of a hash
table with chaining, independent of the hash function's quality — no hash function avoids it, because
it is a counting fact rather than a statistical one. It is also the shape of a hash-collision denial
of service: an adversary who can choose keys can put *all* of them in one bucket, and the defence is a
randomised or keyed hash, not a better fixed one.

### Two of these numbers are related

The classic puzzle forms, both one-line arguments:

- **Among any `n + 1` numbers chosen from `1…2n`, two are consecutive.** Box them as
  `{1,2}, {3,4}, …, {2n−1, 2n}` — `n` boxes, `n + 1` numbers.
- **Among any `n + 1` numbers chosen from `1…2n`, one divides another.** Write each as
  `2^a · (odd)`. There are only `n` odd values in range, so two numbers share one, and the smaller
  divides the larger.

The value of these is not the puzzles; it is that they show what "choosing the right boxes" means. The
principle is trivial and the boxes are the entire creative step.

### A lower bound nobody can beat

`m` boxes cannot hold more than `m·t` items if each holds at most `t`. In that contrapositive form the
principle produces impossibility results: no lossless compressor shrinks every input, because there
are more inputs of length `n` than outputs of length `< n`; a comparison sort needs `⌈log₂(n!)⌉`
comparisons in the worst case, because `c` comparisons distinguish at most `2^c` outcomes and there
are `n!` orderings. Both are counting arguments wearing a pigeonhole hat, and the second is the
standard proof of the Ω(n log n) sorting bound —
[Phase 1 · Proving optimality](../phase-1-complexity/11-proving-optimality.md) has that argument in
full.

## Pigeonhole is not the birthday paradox

They get conflated and they are different in kind.

| | Pigeonhole | Birthday paradox |
|---|---|---|
| Claim | a collision **must** occur | a collision is **likely** |
| Threshold | more than `m` items | around `√m` items |
| Nature | certainty, worst case | probability, average case |
| Used for | correctness and termination arguments | sizing hashes, estimating collision risk |

Saying "by the birthday paradox a duplicate exists" is wrong — likelihood is not existence — and
saying "by the pigeonhole principle a 128-bit hash will collide soon" is wrong in the other direction,
since pigeonhole needs more than `2^128` items while the birthday estimate needs about `2^64`. Both
statements come up, and using the wrong one is a real signal.

## Gotchas

**★ Symptom: `⌊n/m⌋` used where `⌈n/m⌉` was meant, and a bound is one too small.** Cause: the
generalised form misremembered. Fix: 10 items in 3 boxes force a box with at least 4, not 3 — the
average is a lower bound on the maximum, and the maximum of integers is at least the ceiling of the
average. Test the statement on a case where `m` does not divide `n`.

**★ Symptom: pigeonhole used to *find* the duplicate rather than to prove one exists.** Cause: the
existence step confused with the algorithm. Fix: pigeonhole tells you a duplicate is there and says
nothing about where; the finding is a separate algorithm — a hash set, a sort, binary search on the
value range, or Floyd's cycle detection. What the principle buys is the termination argument for the
algorithm you then choose.

**★ Symptom: "by the birthday paradox, a collision must exist."** Cause: conflating likelihood with
certainty. Fix: pigeonhole gives a guarantee once the item count exceeds the box count; the birthday
estimate gives a probability at around the square root of the box count. The thresholds differ by a
square, and which one a problem needs is usually explicit — "must" versus "probably".

**★ Symptom: the prefix-sum-residue solution misses matches on arrays with negative numbers.**
Cause: `%` returns a remainder with the sign of the left operand in both languages, so a negative
running sum produces a negative residue that never matches the stored positive one. Fix:
`((x % k) + k) % k` in TypeScript, `Math.floorMod(x, k)` in Java.

**Symptom: the `p₀ = 0` entry omitted from the prefix-sum map.** Cause: treating the empty prefix as
not a prefix. Fix: seed the map with residue 0 at index 0, or every subarray that starts at index 0
is missed — including the whole array.

**Symptom: a pigeonhole argument made with boxes that are not exhaustive.** Cause: choosing boxes that
some item can fall outside of, which breaks the counting. Fix: check that every item lands in exactly
one box; the argument is only as good as that partition, and choosing the boxes is the only creative
step in the whole method.

**Symptom: a cycle-detection loop with no termination bound.** Cause: knowing a cycle must exist but
not deriving *when*. Fix: over a state space of size `m`, the repeat happens within `m + 1` steps, so
the loop is O(m) — that bound is the practical output of the argument and is what makes the algorithm
presentable.

**Symptom: the principle invoked where the boxes outnumber the items.** Cause: applying the form
without checking `n > m`. Fix: with `n ≤ m` nothing follows at all — every box can hold at most one —
which is why the array-length-`≥ k` condition in the subarray problem is part of the claim rather
than an implementation detail.

## Interview questions

**★ State the pigeonhole principle in its useful form and give a non-obvious use.**
`n` items in `m` boxes force some box to contain at least `⌈n/m⌉` — the ceiling, since the maximum of
a set of integers is at least the ceiling of their average. The non-obvious use is termination: any
deterministic iteration over a state space of size `m` must revisit a state within `m + 1` steps, so
its trajectory is a tail followed by a cycle, both of length at most `m`. That is what makes cycle
detection, the constant-space duplicate-number solution and repeating-decimal detection all
terminating algorithms, and it is where the O(m) bound on each of them comes from.

**★ Why must an array of length at least `k` contain a subarray whose sum is divisible by `k`?**
Take the `k + 1` or more prefix sums `p₀ = 0, p₁, …, p_n` and reduce them mod `k`. There are only `k`
possible residues and at least `k + 1` prefix sums, so two share a residue, and the subarray strictly
between those two indices sums to a multiple of `k`. The implementation is a map from residue to its
first index, seeded with residue 0 at index 0 so that subarrays starting at the beginning are found —
and the residue must be normalised, because `%` in both JavaScript and Java is a remainder that goes
negative for negative operands and would miss the match.

**★ What is the difference between the pigeonhole principle and the birthday paradox?**
Kind, and threshold. Pigeonhole is a certainty about the worst case: once the number of items exceeds
the number of boxes, a collision *must* exist. The birthday estimate is a probability about the
average case: with around the square root of the number of boxes, a collision becomes *likely*. The
thresholds differ by a square, so for a 128-bit hash pigeonhole needs more than `2^128` values while
the birthday argument bites at about `2^64`. Use pigeonhole for correctness and termination arguments
and the birthday estimate for sizing and risk; swapping them is a substantive error, not a wording
one.

**★ How does pigeonhole prove that comparison sorting needs Ω(n log n) comparisons?**
A comparison-based algorithm's execution is determined by the sequence of comparison outcomes, so `c`
comparisons distinguish at most `2^c` different behaviours — those are the boxes. There are `n!`
possible input orderings, all of which must be distinguished, and those are the items. If `2^c < n!`
then two distinct orderings receive identical treatment and at least one is sorted wrongly, so
`c ≥ log₂(n!)`, which is Θ(n log n). The pigeonhole step is exactly "more orderings than outcomes
means two share an outcome"; the rest is Stirling's estimate for `log(n!)`.

**Where does the creativity in a pigeonhole argument actually live?**
In choosing the boxes. The principle itself is one line and is never the hard part; deciding what to
partition by is the whole problem. For "two of any `n+1` numbers from `1…2n` are consecutive", the
boxes are the pairs `{1,2}, {3,4}, …`. For "one divides another", the boxes are the odd parts after
factoring out every power of two. For the subarray problem, the boxes are the residues mod `k`. In
each case the partition has to be exhaustive — every item in exactly one box — and small enough that
the item count exceeds it. Finding that partition is the step worth practising; the conclusion writes
itself once it exists.

{/* FOOTER */}
