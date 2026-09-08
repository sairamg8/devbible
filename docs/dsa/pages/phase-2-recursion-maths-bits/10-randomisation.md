---
title: "A shuffle is only correct if all n! orderings are equally likely, and the naive one-line version fails a counting argument before it fails a test — Fisher–Yates is the loop you get when you insist the swap partner include the current position"
sidebar_label: "10 · Randomisation"
sidebar_position: 10
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-08. Fisher–Yates and the counting arguments on this page are **elementary
> mathematics and common practice, derived here rather than cited** — the research bank for this
> phase records that the algorithm has no single primary source. The one citation is MDN,
> [`Math.random()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/random),
> for the range of the generator. The JDK's own description of the algorithm is quoted in
> [10b](10b-fisher-yates-in-practice.md). **No sandbox run: no distribution below was measured,
> every count is arithmetic performed in the text.** Version spine: **JDK 25 · MDN as fetched
> 2026-09-07**.

**"Shuffle this array" is the shortest interview question with a wrong answer that looks right, and
the reason it is wrong is arithmetic rather than empirical.** A correct shuffle produces each of the
`n!` orderings with probability `1/n!`. The naive version — walk the array and swap each element
with a uniformly random element of the *whole* array — has `n^n` equally likely execution paths, and
`n!` does not divide `n^n` for any `n ≥ 3`, so the paths cannot possibly distribute evenly across
the orderings. That argument settles the question without running anything, which is exactly why it
is the answer to give. Fisher–Yates is what you get when you fix the flaw the counting exposes: the
random index must be drawn from the part of the array that has **not yet been decided**, and it must
include the current position. This page derives it and names the two off-by-ones that break it;
[10b](10b-fisher-yates-in-practice.md) writes it in both languages and quotes what the JDK
documents about its own implementation. The `sort(() => Math.random() - 0.5)` answer gets
[10c](10c-the-random-comparator-shuffle.md) to itself, because its failure is a different one — a
comparator contract violation, not a counting error.

## What "uniform" has to mean before you can check it

A permutation of `n` distinct items is one of `n!` arrangements. A shuffle is *uniform* when the
algorithm, considered as a random process, outputs each of those `n!` arrangements with probability
exactly `1/n!`. Two weaker properties are frequently mistaken for it and neither is sufficient:

- **Every element can end up in every position.** True of the naive shuffle, true of many biased
  shuffles, and it says nothing about the *joint* distribution.
- **Every element ends in each position with probability `1/n`.** This is *marginal* uniformity. It
  is necessary but not sufficient: a shuffle that rotates the array by a uniformly random amount
  gives every element a `1/n` chance of every position and produces only `n` of the `n!` orderings.
  The rotation shuffle is the cleanest demonstration that "looks random" is not a test.

So the property to argue about is the joint one, and the tool for arguing about it is counting the
algorithm's execution paths. That tool generalises: **any shuffle assembled from a family of `f(n)`
operations produces at most `f(n)` orderings, so unless `f(n) ≥ n!` it is not uniform.** Rotations
give `f(n) = n`. Reversals give 2. A single pass of pairwise "maybe swap neighbours" gives `2^(n−1)`,
which does exceed `n!` for small `n` and still is not uniform, because exceeding the count is
necessary and not sufficient — the paths must also divide evenly.

## The naive shuffle, and the counting argument that kills it

Here is the version almost everyone writes first:

```ts
// ⛔ WRONG — biased. Kept only to be argued against.
function naiveShuffle<T>(a: T[]): T[] {
  for (let i = 0; i < a.length; i++) {
    const j = Math.floor(Math.random() * a.length);   // draws from the WHOLE array
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
```

Count its execution paths. The loop runs `n` times; each iteration picks `j` from `n` equally likely
values; the picks are independent. So there are exactly `n^n` execution paths, each with probability
`1/n^n`, and every path deterministically produces some permutation. If the output distribution were
uniform, each of the `n!` permutations would be produced by exactly `n^n / n!` paths — and that
number would have to be an integer.

**It is not, for any `n ≥ 3`.** Take `n = 3`: there are `27` paths and `6` permutations, and
`27 / 6 = 4.5`. Since path counts are whole numbers that sum to 27, some permutation is reachable by
more paths than another, so it is strictly more likely. No measurement is required and none would
add anything.

The general statement holds for the same reason. For every `n ≥ 3` there is a prime `p ≤ n` that
does **not** divide `n` — if every prime up to `n` divided `n`, their product would divide `n` and
therefore be at most `n`, but the product of the primes up to `n` exceeds `n` once `n ≥ 3`
(`2 · 3 = 6 > 3`, and the product only grows faster from there). That prime `p` appears in the
factorisation of `n!` and not in the factorisation of `n^n`, so `n!` does not divide `n^n`, so
`n^n / n!` is not an integer, so the distribution is not uniform. ∎

Two things are worth noticing about this proof. It says the shuffle is biased but says **nothing
about which permutations are favoured** — deriving that needs a per-permutation path count, which is
a different and much longer exercise, and it is the part people wrongly try to recall. And it
applies to *any* shuffle whose path count is a power that `n!` does not divide, which makes it a
reusable smell test for a homegrown randomiser.

## Deriving Fisher–Yates instead of reciting it

Build the output one position at a time, and think of it as dealing cards rather than as swapping.

**Position `n−1` first.** Choose which of the `n` items lands in the last slot: pick a uniformly
random index `j` in `[0, n−1]` and swap it into place. Every item had probability `1/n` of being
chosen, which is exactly the requirement for that slot.

**Then position `n−2`.** The last slot is now fixed and must never be touched again. The remaining
`n−1` items occupy indices `0 … n−2` in some order, and by the same logic pick a uniformly random
`j` in `[0, n−2]` and swap it into slot `n−2`.

**Continue down to position 1.** Slot `0` needs no work: one item remains and it is already there.

The correctness is an induction on the number of undecided slots. Suppose that after choosing the
last `k` slots, the remaining `n−k` items are in a uniformly random order in the prefix — every one
of the `(n−k)!` arrangements equally likely. The next step picks one of them uniformly to occupy the
next slot; conditioned on that choice, the other `n−k−1` items are still in a uniformly random order
by the inductive hypothesis, so all `(n−k)! = (n−k) · (n−k−1)!` combinations of (chosen item,
arrangement of the rest) are equally likely. The base case is a prefix of length 1, trivially
uniform. Multiplying the per-step probabilities gives `1/n · 1/(n−1) · … · 1/2 = 1/n!` for every
outcome. ∎

The path count confirms it: iteration `i` has `i+1` choices, so the algorithm has exactly
`n · (n−1) · … · 2 = n!` execution paths — one per permutation, and they are equally likely. **The
naive version's `n^n` could never have divided evenly; this one divides exactly.** That
correspondence, one path per outcome, is the strongest possible form of the argument and worth
saying aloud: the algorithm is a bijection between its coin flips and its answers.

## The two off-by-ones

Both are one character, both are the classic bug, and they fail differently.

**1 — Excluding the current position.** Drawing `j` from `[0, i)` instead of `[0, i]` means an item
can never stay where it is at its own step. The path count becomes
`(n−1) · (n−2) · … · 1 = (n−1)!`, which is smaller than `n!`, so **some permutations become
unreachable** — the identity permutation among them. This is a stronger failure than mere bias: it
is not that the distribution is uneven, it is that entire orderings have probability zero. What it
does generate, uniformly, is the set of cyclic permutations — Sattolo's algorithm — which is a real
algorithm for a real purpose and a bug when you wanted a shuffle.

**2 — Looping the wrong way with the wrong range.** Downward with `[0, i]` is correct; upward with
`[i, n−1]` is also correct, by the mirror-image induction (decide slot `0` first from all `n` items,
then slot `1` from the remaining `n−1`). What is *not* correct is upward with `[0, n−1]`, which is
the naive shuffle again, or downward with `[0, n−1]`, likewise. **The invariant, not the direction,
is the thing to remember: the draw is over the undecided region, inclusive of the slot being
decided.** State the invariant in the interview before you write the loop and the off-by-one
cannot happen; recite the loop from memory and it is a coin flip whether you get it right.

## Gotchas

**★ Symptom: the shuffle "works" — every element appears in every position across a few runs — and
the reviewer still rejects it.** Cause: eyeballing marginal behaviour cannot detect a joint-
distribution bias, and the rotation shuffle above proves it. Fix: argue by path count, not by
observation. `n^n` paths cannot divide into `n!` outcomes; `n!` paths can and do.

**★ Symptom: "how would you test a shuffle?" and the honest answer is that you cannot, easily.**
Cause: the property is a statement about `n!` outcomes, so a direct test needs a chi-squared test
over all of them — feasible for `n = 4` or `5`, hopeless beyond. Fix: say exactly that. The proof is
the primary artefact and the small-`n` distribution test is a regression guard against someone
"optimising" the loop later. A weaker but useful test injects a fake generator returning a scripted
sequence of indices and asserts the exact resulting permutation — that catches the off-by-one
without any statistics at all, and it is the test to actually write.

**★ Symptom: the identity permutation never appears, and neither do several others.** Cause: the
draw excludes the current position — `[0, i)` rather than `[0, i]`. Fix: draw from `[0, i]`.
Diagnostic: for `n = 3`, an unbiased shuffle has `3! = 6` reachable outcomes and the buggy one has
`(3−1)! = 2`; a reachability collapse is far more visible in a small-`n` test than a bias would be.

**★ Symptom: a "shuffle" built from a random rotation, a random reversal, or a random number of
adjacent swaps.** Cause: reaching for an operation that feels random rather than one that
enumerates. Fix: count what the family can produce. Unless it can reach all `n!` orderings it is not
a shuffle, and reaching them is still not enough — the paths must divide evenly across them.

**★ Symptom: someone "improves" the shuffle by running it twice.** Cause: the intuition that
composing two biased shuffles washes out the bias. Fix: it does not follow, and it must be argued
rather than assumed. Composing the naive shuffle with itself gives `n^(2n)` paths, and `n!` divides
`n^(2n)` no more than it divides `n^n` — the same prime argument applies unchanged. Running a
*correct* shuffle twice is merely `2n` wasted draws.

## Interview questions

**★ Why is `for i in 0..n-1: swap(a[i], a[random(0, n-1)])` biased? Prove it without running it.**
Because it has `n^n` equally likely execution paths and `n!` possible outputs, and `n!` does not
divide `n^n` for `n ≥ 3`. If the output were uniform each permutation would be produced by exactly
`n^n / n!` paths, and that is not a whole number — for `n = 3`, 27 paths into 6 permutations is 4.5
each. The general argument is that some prime `p ≤ n` fails to divide `n` (the primes up to `n`
have a product exceeding `n` for `n ≥ 3`), so `p` divides `n!` but not `n^n`. The correct version
draws from `[0, i]` and has exactly `n!` paths, one per permutation.

**★ In Fisher–Yates, why must the random index be allowed to equal the current index?**
Because the item currently in the slot being decided is one of the candidates for that slot, and
excluding it gives it probability zero of staying. Formally, the induction requires each of the
`i+1` undecided items to have probability `1/(i+1)` of being chosen; excluding one leaves `i`
candidates and drops the path count from `n!` to `(n−1)!`, which makes some permutations
unreachable rather than merely unlikely. The JDK's javadoc phrases the correct range as running to
the current position *"inclusive"* — quoted in full in [10b](10b-fisher-yates-in-practice.md).

**★ What does the excluded-current-position bug actually generate?**
Uniformly random **cyclic** permutations — permutations consisting of a single `n`-cycle, of which
there are exactly `(n−1)!`, matching the path count. That is Sattolo's algorithm, and it is the
right algorithm if you genuinely want a derangement that is a single cycle: assigning every
participant in a gift exchange someone else to give to, in one closed loop with nobody drawing
themselves and no two-person mutual pairs. It is a bug only because it was reached by accident.

**★ Marginal uniformity versus joint uniformity — give an example where they differ.**
The random rotation. Rotate the array by `r` where `r` is uniform in `[0, n)`: every element lands
in every position with probability exactly `1/n`, so each element's *marginal* distribution is
perfect, and yet the algorithm produces only `n` of the `n!` orderings, so the joint distribution is
concentrated on a vanishing fraction of them. Any test that checks "does element `x` appear in
position `k` about `1/n` of the time" passes it. This is the example to have ready, because
"positions are uniform" is the defence people offer for a biased shuffle.

**★ Does Fisher–Yates need extra space, and can it be done on a stream?**
It is `Θ(1)` extra space and `Θ(n)` time, in place, which is why it is the answer. It cannot be done
on a stream of unknown length, because it indexes backwards from the end and therefore needs `n` up
front — and the whole sequence in memory. The streaming problem is reservoir sampling
([10h](10h-reservoir-sampling.md)), which is a genuinely different algorithm rather than a variant.

**★ Is there a shuffle that uses fewer than `n` random draws?**
Not one that is uniform. A uniform shuffle must be able to produce `n!` distinct outcomes, so it
needs at least `log2(n!)` bits of randomness — about `n log n` bits by Stirling — and each draw of a
bounded integer supplies `O(log n)` of them. `n` draws is therefore optimal up to the constant, and
Fisher–Yates achieves it. The interesting corollary is the one in
[10b](10b-fisher-yates-in-practice.md): a generator whose entire state is 64 bits cannot supply
`log2(n!)` bits for `n` past about 20, no matter how many times you call it.

---

← Prev: [09i · Where n stops fitting](09i-where-n-stops-fitting.md) · Index: [Phase 2 — Recursion, maths and bits](README.md) · Next → [10b · Fisher–Yates in practice](10b-fisher-yates-in-practice.md)
