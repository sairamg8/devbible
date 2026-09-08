---
title: "Randomising the pivot does not make quicksort faster on average — the average was already good — it moves the choice of bad input out of the adversary's hands and into your own coin flips, and that is a different guarantee with different small print"
sidebar_label: "10g · The randomised pivot"
sidebar_position: 10.6
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-08. The analysis on this page is **textbook mathematics, derived or stated as
> standard rather than cited** — the research bank for this phase records that quicksort,
> quickselect and their recurrences have no single primary source to quote. The concentration result
> (recursion depth `O(log n)` with high probability) is stated as a **standard result, not derived
> here and not quoted**. Complexity vocabulary is
> [phase 1 · 09](../phase-1-complexity/09-best-average-and-worst.md); the algorithms are
> [02f](02f-quickselect.md) and [02g](02g-median-of-medians-and-duplicate-heavy-input.md).
> **No sandbox run: no timing, no measured distribution.**

**The single most useful thing randomisation buys you is not speed — it is the removal of the
adversary.** A deterministic pivot rule creates a fixed set of inputs on which the algorithm
degrades, and those inputs are not exotic: for the "always take the last element" rule, sorted data
is the worst case, and sorted data is the most common shape of real data there is. A random pivot
does not improve the average; the average over uniformly random inputs was already `Θ(n log n)`.
What it changes is **who chooses**. The bound stops being a statement about typical inputs and
becomes a statement that holds for *every* input, with the expectation taken over your own coin
flips — which nobody supplying the input can see. This page is about what that guarantee promises,
what it conspicuously does not promise, and the two production analogues of the same trick.

## Any deterministic rule has a bad input, and it is findable

Fix a pivot rule — last element, first element, middle element, median of the first, middle and
last. The algorithm is now a deterministic function, so its behaviour on any input is decidable in
advance, and an adversary who knows your source can construct an input on which every partition is
maximally unbalanced. This is not a thought experiment: an *anti-quicksort* input can be built
incrementally, answering each comparison in whichever way keeps the eventual partition worst, and
the construction needs only `O(n log n)` work — it costs the attacker less than the sort costs you.

Two weaker facts matter more in practice than the adversary does:

- **Sorted and reverse-sorted input is everywhere.** Data arriving from a database with an
  `ORDER BY`, a file appended in time order, a list that was sorted by another key a moment ago.
  Under the last-element rule each of those is the worst case, so the failure is not adversarial at
  all, merely common.
- **Median-of-three fixes the easy cases and not the hard one.** It handles sorted and
  reverse-sorted input, which is why it is the classic mitigation, and it remains deterministic —
  so an input built against *that* rule exists too, and is a known construction.

Randomisation is the only mitigation that removes the whole class rather than an instance of it.

## Two ways to randomise, and they are not the same

**Random pivot per partition.** Draw an index uniformly from the current range and swap it to the
pivot position before partitioning. One draw per partition call.

```ts
function partitionRandom(a: number[], lo: number, hi: number, rng = Math.random): number {
  const k = lo + Math.floor(rng() * (hi - lo + 1));   // uniform in [lo, hi]
  [a[k], a[hi]] = [a[hi], a[k]];                      // move the choice into the usual slot
  return partitionLomuto(a, lo, hi);                  // unchanged; see 02f
}
```

**Shuffle once up front,** then run the deterministic algorithm. One `Θ(n)` Fisher–Yates pass
([10](10-randomisation.md)), and afterwards the input is a uniformly random permutation, so the
deterministic average-case analysis applies to it.

Both give an expected `Θ(n log n)` for quicksort and `Θ(n)` for quickselect, and the choice between
them is practical rather than theoretical:

| | Random pivot | Shuffle first |
|---|---|---|
| Cost of the randomness | one draw per partition | `n` draws, one extra pass |
| Adaptivity to nearly-sorted input | preserved | **destroyed** — you just randomised it |
| Effect on equal elements | none | none, but the input order of equal keys is gone |
| Failure if the generator is predictable | adversary recovers the worst case | adversary recovers the worst case |
| Works when you cannot mutate the input | yes | no — the shuffle is a mutation |

The row that decides it in practice is adaptivity: a library sort that detects existing runs and
exploits them ([02c](02c-merge-sort.md) and the JDK's adaptive merge sort) must not be handed a
shuffled array. Randomising the pivot leaves the data alone.

## What "expected" promises, precisely

The claim is `E[T(n)] = Θ(n log n)` **for every input**, where the expectation is over the
algorithm's random choices. Unpack the two halves, because the interview question lives in the gap
between them.

**For every input.** This is the strong half and the entire point. There is no input on which the
expectation is worse, because the input no longer participates in the choice. Contrast with
average-case analysis, which is an expectation over a distribution of *inputs* — a claim that is
only as good as the assumption that your inputs follow that distribution, and production inputs
notoriously do not.

**Over the coin flips.** This is the half that is routinely overstated. The expectation says nothing
about any single run. The `Θ(n²)` worst case has not been eliminated; it has been made improbable.
The same array sorted twice can take noticeably different amounts of work, which is itself a change
in the system's behaviour — a deterministic sort has repeatable timing and a randomised one does
not.

Two standard strengthenings are worth naming, and I state them as standard results rather than
deriving them here:

- **Concentration.** The recursion depth of randomised quicksort is `O(log n)` with high
  probability — the probability of exceeding a constant multiple decays polynomially in `n` — so the
  running time is not merely good in expectation but tightly clustered. This is why randomised
  quicksort is *usable* rather than merely *good on paper*: without concentration, an expectation
  would leave the tail latency unbounded in a practically relevant way.
- **Markov's inequality is the weak fallback.** With nothing but the expectation, all you may
  conclude is that the probability of exceeding `c` times the mean is at most `1/c`. If someone asks
  what the expectation alone buys you, that is the honest answer, and it is much weaker than the
  concentration result.

**What it does not promise, in four lines you should be able to say:** it is not a worst-case bound;
it does not eliminate the quadratic case, only the ability to *choose* it; it is per-call, so a
service performing millions of sorts will observe the tail, which is a tail-latency question and not
an average-throughput one; and it is void if the randomness is predictable to whoever supplies the
input.

## When the coin is not private

The guarantee rests on the adversary not knowing your pivots. It fails in exactly the ways
[10e](10e-the-security-boundary.md) describes:

- A **fixed seed** — shipped from a debugging session, or a deliberate "reproducible builds"
  decision — makes the pivot sequence a constant, and a deterministic algorithm again.
- A generator seeded from a **low-entropy, guessable** source (a request counter, a timestamp with
  second resolution) is nearly as bad.
- Timing observation, in principle, leaks pivot quality back to an attacker who can submit inputs
  and measure responses.

The mitigation is proportionate to the threat model, and for a sort inside an internal batch job
there is no threat model at all. For a public endpoint that sorts attacker-supplied arrays, the
question is real — and the standard production answer is not a better generator but a **hybrid**:
introsort watches its own recursion depth and switches to heapsort when it exceeds a threshold,
converting the improbable quadratic case into a guaranteed `O(n log n)` one. That is the pattern to
reach for whenever "expected" is not a strong enough promise: keep the fast randomised algorithm,
add a deterministic fallback triggered by the symptom.

The deterministic alternative for selection is median-of-medians
([02g](02g-median-of-medians-and-duplicate-heavy-input.md)), which achieves a true worst-case
linear bound with a constant large enough that the randomised version is what actually gets used —
and knowing *why* it is not used is a better answer than knowing that it exists.

## The same trick, one level up: hash seeds

The pivot is the textbook case; the production case is hashing. A hash table's `O(1)` is an
average-case claim that assumes keys disperse. A deterministic hash function has a fixed set of
colliding keys, so an attacker who can insert keys — form fields, JSON object keys, HTTP headers —
can force every insertion into one bucket and turn a linear number of inserts into quadratic work.
That is hash flooding, and the fix is structurally identical to the randomised pivot: **draw a
random seed per process and mix it into the hash**, so the colliding set is unknown to the attacker
and the guarantee becomes an expectation over your seed rather than an assumption about the input.

Two consequences follow that people find surprising when they meet them, and both are just this
mechanism being visible:

- Iteration order of a hash-based collection may differ between processes, because the seed does.
  Depending on it is depending on a random number.
- A hash value must not be persisted or sent between processes unless the seed is fixed and
  versioned along with it.

The distinction is [phase 1 · 09](../phase-1-complexity/09-best-average-and-worst.md)'s: hashing's
`O(1)` is average-case and its worst case is linear per operation, and randomising the seed is what
makes the average case a promise you can keep against an adversary rather than a hope about inputs.

## Gotchas

**★ Symptom: quicksort is quadratic on production data and fine on the test fixtures.** Cause: a
deterministic pivot rule plus already-sorted input; the fixtures were hand-written in arbitrary
order and the production data came out of an `ORDER BY`. Fix: randomise the pivot. Diagnostic: sort
the same array twice and see whether the second run is fast — if the algorithm degrades on sorted
input, the second run on the now-sorted array is the worst case.

**★ Symptom: "we randomised it, so the worst case is gone".** Cause: reading an expected bound as a
worst-case one. Fix: the quadratic case still exists and still occurs; it is merely no longer
selectable by the input. If you need a genuine worst-case bound, use a hybrid with a depth-triggered
fallback, or an algorithm that has one.

**★ Symptom: a shuffle-then-sort pipeline that got slower after someone added the shuffle.** Cause:
the sort was adaptive and the shuffle destroyed the runs it was exploiting. Fix: randomise the pivot
instead of the data, or drop the shuffle if the sort already has a randomised or adaptive strategy.
Shuffling before an adaptive merge sort is strictly harmful.

**★ Symptom: the randomised sort draws from a generator seeded once per request from a timestamp.**
Cause: treating "we call a random function" as sufficient. Fix: a generator seeded from a guessable
value produces a guessable pivot sequence, so the adversarial input is back. Seed once per process
from a good source, or use the platform generator.

**★ Symptom: tail latency on a sorting endpoint has a long right edge that nobody can reproduce.**
Cause: this is the expected-case bound behaving exactly as documented — most calls near the mean,
occasional calls far above it. Fix: it is not a bug to be found, it is a property to be capped;
introsort's depth limit, or a size threshold above which you use a different algorithm, converts it
into a bound. Do not go looking for a deterministic cause.

**★ Symptom: a randomised algorithm whose "random" pivot is `arr[arr.length / 2]`.** Cause: calling
the middle element random because it is not the end. Fix: the middle element is a deterministic
rule; it happens to be a good one for sorted input and it has its own adversarial family. Randomness
means a draw, not an arbitrary-looking index.

**★ Symptom: iteration order of a `HashMap` differs between runs and a test asserts on it.** Cause:
per-process hash seeding, which is the anti-flooding mitigation working. Fix: sort before asserting,
or use a `LinkedHashMap` if order is genuinely part of the contract. Never "fix" it by disabling the
seed.

## Interview questions

**★ Why randomise the pivot when the average case was already `Θ(n log n)`?**
Because the average case is an expectation over a distribution of *inputs*, and you do not control
the inputs. Under a deterministic rule there is a set of inputs — sorted data, for the common
rules — on which the algorithm is `Θ(n²)`, and those inputs are ordinary rather than contrived. A
random pivot moves the expectation from being over inputs to being over your own coin flips, so the
`Θ(n log n)` bound holds for *every* input, including one constructed by someone who has read your
code. The average did not improve; the guarantee changed shape.

**★ State precisely what the expected bound does and does not promise.**
It promises that, for any fixed input, the mean running time over the algorithm's random choices is
`Θ(n log n)`. It does not promise anything about a single run: the quadratic case still exists and
is still reachable, just with low probability. It is per-call, so a system doing many sorts will see
the tail, and that is a tail-latency concern rather than a throughput one. And it is contingent on
the randomness being unpredictable to whoever supplies the input — a fixed seed removes the whole
guarantee. The standard strengthening is a concentration result: the recursion depth is `O(log n)`
with high probability, which is what makes the algorithm practically usable rather than merely
attractive in expectation.

**★ Random pivot or shuffle the array first?**
Both give the same asymptotic guarantee, because after a uniform shuffle the average-case analysis
applies to any input. Prefer the random pivot: it costs one draw per partition instead of `n` draws
and an extra pass, it does not mutate the caller's array, and — the deciding reason — it does not
destroy pre-existing order that an adaptive algorithm downstream could have exploited. Shuffling
first is the right answer only when you want the randomisation to be visible and auditable as a
separate step.

**★ Your service sorts attacker-supplied arrays. Is a random pivot enough?**
It is enough to stop an input constructed from your source code, provided the randomness is not
predictable — which rules out a fixed seed and a seed derived from a guessable value. It does not
give a worst-case bound, so a determined attacker who can measure timings and submit many requests
is working against probability rather than against a wall. The production answer is a hybrid:
introsort's depth limit converts the improbable quadratic case into a guaranteed `O(n log n)` by
switching to heapsort, which is a hard bound rather than an expectation. Combining a randomised
fast path with a deterministic fallback is the general pattern.

**★ What is hash flooding and how is it the same idea?**
A hash table's constant-time behaviour assumes keys spread across buckets. A deterministic hash
function has a computable set of colliding keys, so an attacker who controls key material can drive
every insert into one bucket and make `n` inserts cost `Θ(n²)`. The fix is the randomised pivot's
fix: mix a per-process random seed into the hash so the colliding set is unknown, which turns an
assumption about inputs into an expectation over your own randomness. The observable side effects —
iteration order varying between processes, hash values not being stable across runs — are the
mechanism showing through, not defects.

**★ Why is median-of-medians not the answer, given that it is worst-case linear?**
Because a worst-case bound with a large constant loses to an expected bound with a small one on
every input anyone actually has. Median-of-medians does five-element groupings and recursive
selection on the medians, and the constant that comes out is large enough that the randomised
version dominates in practice. It is worth knowing precisely because the reasoning generalises:
asymptotic superiority is not a decision, it is one input to a decision.
[02g](02g-median-of-medians-and-duplicate-heavy-input.md) has the algorithm.

{/* FOOTER */}
