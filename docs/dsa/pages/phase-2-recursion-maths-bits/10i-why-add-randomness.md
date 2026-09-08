---
title: "Randomness is added to a deterministic problem for six specific reasons and never for vagueness — it removes the adversary, it buys simplicity, it breaks symmetry, it makes sublinear space possible, it dodges structure in the data, and it balances load; everything else in this topic is one of those six"
sidebar_label: "10i · Why add randomness"
sidebar_position: 10.8
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-08. Every structure named on this page — skip lists, treaps, Bloom filters,
> Miller–Rabin, the sketches — is **named as a pointer to the literature and is deliberately not
> derived, analysed or quoted here**; each is a topic in its own right and this page's job is to say
> what class it belongs to and why the randomness is there. The Las Vegas / Monte Carlo distinction
> and the six motivations are **standard framing, stated as such**. The pages that do carry primary
> sources for the surrounding machinery are [10e](10e-the-security-boundary.md) and
> [10d](10d-uniform-integers-and-modulo-bias.md). **No sandbox run: no error rate, false-positive
> rate or timing below is measured or quantified.**

**"Why would you ever add randomness to a deterministic problem?" is the closing question of this
topic, and the answer that scores is a list, not an adjective.** Randomness is not added because a
problem is hard or because an answer is uncertain — it is added because it converts a specific
structural weakness into a probabilistic one that you control. There are six such conversions, they
recur across every randomised algorithm anyone will ask you about, and every technique in this topic
is an instance of one or more of them. This page names the six, classifies the structures that use
them, and states the price — because the price is where a candidate who has only read the marketing
gives themselves away.

## The six reasons

**1 — It removes the adversary.** A deterministic algorithm has a fixed worst-case input, which
someone can supply and which ordinary data sometimes *is*. Randomising moves the choice into your
coin flips, so the bound holds for every input. This is the randomised pivot
([10g](10g-the-randomised-pivot.md)) and it is hash seeding. It is the reason most likely to be the
expected answer.

**2 — It buys simplicity.** A treap is a binary search tree that maintains a heap invariant on
randomly assigned priorities; it has expected `O(log n)` depth and needs no rebalancing cases at
all, against a red-black tree's rotations and colour rules. A skip list gets ordered-map behaviour
from a coin flip per level. **Randomised structures are routinely a third of the code of their
deterministic equivalents, and correctness that fits on a page is a real engineering property**, not
an aesthetic one.

**3 — It breaks symmetry.** Two identical processes that must not do the same thing have no
deterministic way to differ. Retry backoff with jitter, leader election, choosing which replica to
read from, deciding which node backs off in a collision — all of them need a tiebreaker that is not
a function of state, because the states are equal.

**4 — It makes sublinear space possible.** Counting distinct items exactly needs space proportional
to the number of distinct items. Accepting a small error probability lets a sketch do it in
kilobytes. This is not an optimisation of an exact algorithm; it is a different problem statement in
which the answer is approximate and the error is quantified and tunable.

**5 — It dodges structure in the data.** Real data is periodic, clustered, sorted, and correlated in
ways your algorithm did not anticipate. Sampling every hundredth item from a log with a
hundred-item cycle samples one phase of the cycle forever; sampling randomly does not. Hashing with
a fixed function collides on whatever structure the keys happen to have.

**6 — It balances load.** Assigning work to the least-loaded of two randomly chosen servers is
dramatically better than assigning to one random server, and needs no global state — the "power of
two choices". Consistent hashing places keys on a ring by hash, so no coordinator decides placement.
Randomness here is a *coordination-free* allocation mechanism, and the absence of coordination is
the point.

## The structures, named and classified

**None of these is derived here.** Each is named with the reason its randomness exists, so you can
say the right sentence about it and then go and read the real treatment.

| Structure | Where the randomness is | Which reason | Class |
|---|---|---|---|
| **Skip list** | a coin flip per element decides its height | 2 (simplicity) | Las Vegas |
| **Treap** | a random priority per key, kept as a heap | 2 (simplicity) | Las Vegas |
| **Randomised quicksort / quickselect** | the pivot | 1 (adversary) | Las Vegas |
| **Universal / seeded hashing** | a per-process seed mixed into the hash | 1, 5 | Las Vegas |
| **Bloom filter** | the hash functions, not a coin | 4 (space) | Monte Carlo |
| **Count-min sketch, HyperLogLog** | the hash functions | 4 (space) | Monte Carlo |
| **Miller–Rabin primality** | the bases tested | — (speed vs certainty) | Monte Carlo |
| **Karger's min cut** | which edge is contracted | 2, plus repetition | Monte Carlo |
| **Freivalds' matrix-product check** | the test vector | — (verification) | Monte Carlo |
| **Locality-sensitive hashing** | the projections | 4, 5 | Monte Carlo |
| **Reservoir sampling** ([10h](10h-reservoir-sampling.md)) | the acceptance coin | 4 (one pass, `Θ(k)`) | Las Vegas |
| **Retry jitter, load balancing** | the delay, the choice of server | 3, 6 | — |

Two of those rows deserve a sentence more.

**Bloom filters** are the cleanest illustration of reason 4 and of the Monte Carlo bargain. A Bloom
filter answers "is `x` in the set?" with **no false negatives and some false positives**: an absent
answer is certain, a present answer is probable. That asymmetry is the whole design, and it is what
makes it usable as a *front door* — check the filter, and only touch the expensive store when the
filter says "maybe". A false positive costs one wasted lookup; a false negative would cost
correctness, and there are none. ⚠️ The false-positive rate is a function of the number of bits,
hash functions and inserted elements; **this page states no formula and no figure**, because that is
the Bloom filter's own topic.

**Miller–Rabin** is the randomised counterpart to [03f](03f-primality-by-trial-division.md)'s trial
division, and it is what makes primality testing on cryptographic-sized numbers feasible at all. It
tests a number against randomly chosen bases using modular exponentiation
([07](07-fast-exponentiation-and-the-modular-inverse.md)); a composite is caught by most bases, so
repeating with independent bases drives the error down while a "probably prime" verdict is never
upgraded to certainty by more rounds — only made less likely to be wrong. ⚠️ **No per-round error
bound is quoted here**; the well-known bound belongs on that algorithm's page with its derivation.

## Las Vegas and Monte Carlo, since the table uses them

- **Las Vegas** — always correct, running time is a random variable. Randomised quicksort, the
  rejection loop in [10d](10d-uniform-integers-and-modulo-bias.md), skip list operations. You can
  never get a wrong answer; you can get an unlucky one.
- **Monte Carlo** — bounded running time, correct with high probability. Bloom filters,
  Miller–Rabin, sketches. You always get an answer on time; it is sometimes wrong, in a direction
  and with a probability the algorithm specifies.

The conversion between them is worth knowing: a Las Vegas algorithm becomes Monte Carlo by cutting
it off at a deadline and returning whatever it has, and a Monte Carlo algorithm becomes Las Vegas if
you have a cheap way to *verify* an answer and can repeat until it verifies. **"Can I check the
answer cheaply?" is therefore the question that decides which kind you are allowed to build**, and
it is the follow-up an interviewer will ask.

## The price, which you must state unprompted

- **Reproducibility.** A failure is no longer reproducible unless the randomness is injected and the
  seed logged — [10f](10f-seeding-and-reproducibility.md).
- **Testing.** You cannot assert on the output of a randomised function; you assert on invariants,
  or you inject a scripted source. Distribution tests are slow and statistical, and belong in a
  different suite.
- **Tail latency.** An expected bound leaves a tail, and in a service that tail is a user-visible
  latency percentile, not an academic footnote.
- **The source matters.** All of it is void if the randomness is predictable to whoever supplies the
  input, or if a fixed seed was left in — [10e](10e-the-security-boundary.md).
- **Debuggability.** "It worked the first four times" is a much worse starting point for an
  investigation than a deterministic failure.

## Gotchas

**★ Symptom: "we made it randomised, so the answer is now approximate."** Cause: conflating Las
Vegas with Monte Carlo. Fix: randomised quicksort's answer is exactly sorted, every time; only the
running time varies. Approximation is a property of the Monte Carlo class, not of randomisation.
Getting this backwards in an interview is expensive because it is a definitional error.

**★ Symptom: "expected `O(n log n)`" quoted as if it were "average case `O(n log n)`".** Cause: the
two words being used interchangeably. Fix: expected is over the algorithm's coin flips and holds for
every input; average is over a distribution of inputs and holds only if your inputs follow it.
[phase 1 · 09](../phase-1-complexity/09-best-average-and-worst.md) is the vocabulary page and the
distinction is the point of it.

**★ Symptom: retries randomised with jitter, and the service still collapses under a thundering
herd.** Cause: jitter applied as a small fraction of a fixed delay, so every client still retries
inside the same narrow window. Fix: the jitter must be a substantial fraction of the interval —
"full jitter", a uniform draw over the whole backoff window — for the symmetry to actually break.
Reason 3 with too small a coin is reason 3 not working.

**★ Symptom: a distributed system where two nodes must agree, and randomness is used to pick.**
Cause: applying symmetry-breaking where *agreement* is the requirement. Fix: independent random
choices do not agree. Symmetry breaking works when the nodes must *differ*; when they must match,
you need a deterministic function of shared state, or consensus. Randomness can still appear inside
a consensus protocol — as a way to escape a livelock — but not as the decision itself.

**★ Symptom: a Bloom filter used where a false positive is unacceptable.** Cause: the asymmetry
misremembered. Fix: no false negatives, some false positives — so a Bloom filter can safely say "not
present, skip the expensive lookup" and must never be the final authority on "present". If your use
needs the other asymmetry, a Bloom filter is not the structure.

**★ Symptom: a randomised structure chosen for performance and it is slower.** Cause: expected
bounds with poor constants, or a generator call in the inner loop. Fix: a skip list's expected
`O(log n)` involves random draws and pointer chasing that a cache-friendly array-backed structure
does not. The reason to pick a treap or a skip list is usually reason 2 — simplicity, or the ease of
making it concurrent — and choosing one on a speed argument you have not measured is the mistake.
Do not quantify it here; say that the constants are the deciding factor and that they must be
measured.

**★ Symptom: "we run Miller–Rabin more times to make it deterministic".** Cause: treating a shrinking
error probability as an eventual certainty. Fix: more rounds reduce the probability of a wrong
"probably prime"; they never reach zero. If certainty is required, a deterministic primality proof
is a different algorithm with a different cost, and choosing the probabilistic answer is a
deliberate trade rather than an approximation of the certain one.

**★ Symptom: a data pipeline that samples randomly and produces different reports on rerun.** Cause:
correct behaviour of an unseeded sampler, meeting a business expectation of reproducibility. Fix:
seed from a stable value the pipeline already has — the partition key, the date — so the same input
produces the same sample, and record the seed alongside the output. This is one of the few
legitimate uses of a fixed seed in production ([10f](10f-seeding-and-reproducibility.md)).

## Interview questions

**★ Why would you ever add randomness to a deterministic problem?**
Six reasons, and the good answer names the one that applies rather than gesturing at all of them. To
remove the adversary: a deterministic algorithm has a fixed worst-case input, and randomising means
the bound holds for every input because the input no longer chooses. For simplicity: a treap or a
skip list gets balanced behaviour from a coin flip instead of a case analysis. To break symmetry:
identical processes that must differ have no deterministic way to do so — jitter, leader election,
replica choice. For sublinear space: accepting a bounded error probability lets a sketch answer in
kilobytes what exactness would need gigabytes for. To dodge structure in the data: real inputs are
periodic and clustered in ways a fixed rule aligns with. And to balance load without coordination:
two random choices, consistent hashing. Everything in this topic is one of those.

**★ Las Vegas or Monte Carlo — define both and place three algorithms.**
Las Vegas is always correct with a randomly varying running time; Monte Carlo has a bounded running
time and is correct with high probability. Randomised quicksort is Las Vegas — the output is exactly
sorted, only the time varies. A Bloom filter is Monte Carlo — the answer can be a false positive,
never a false negative, and the lookup is always fast. Miller–Rabin is Monte Carlo, since "probably
prime" is never upgraded to certain by more rounds. You convert Las Vegas to Monte Carlo by
imposing a deadline, and Monte Carlo to Las Vegas when you can cheaply verify an answer and repeat
until it checks out.

**★ Name a randomised data structure and say what the randomness buys.**
A skip list: each element's height comes from repeated coin flips, giving expected `O(log n)` search
without any rebalancing logic. What the randomness buys is not speed — a balanced tree matches the
asymptotics — but the absence of a case analysis, which in turn makes a lock-free concurrent version
tractable in a way a rotation-based tree is not. A treap makes the same trade with random priorities
and a heap invariant. The honest framing is "expected `O(log n)` with far less code and much easier
concurrency", and never "faster".

**★ What is the price of randomisation, and how do you pay it?**
Reproducibility, first: a failure that happened once cannot be replayed unless the generator was an
injected parameter and the seed was logged. Testing, second: you assert on invariants and inject a
scripted source, because you cannot assert on the output. Tail latency, third: an expected bound
leaves a tail that a user experiences as a slow percentile, and if that is unacceptable you need a
hybrid with a deterministic fallback. And the source, fourth: every guarantee is void if the
randomness is predictable to whoever supplies the input, or if someone left a fixed seed in.

**★ Where does randomness genuinely not help?**
Where agreement is required rather than difference — two nodes that must reach the same decision
cannot get there by flipping independent coins. Where the result must be auditable and repeatable —
a billing calculation, a compliance report. Where the input is already known to be benign and the
deterministic algorithm's constants are better. And where the "randomness" is being used to paper
over a missing specification: "pick one at random" is sometimes an admission that nobody decided
which one should be picked, and the fix for that is a decision, not a coin.

**★ Your interviewer says "just use a deterministic algorithm with a good worst case". Answer?**
Sometimes that is right and you should say when: if a hard bound is required, median-of-medians for
selection and heapsort for sorting exist, and introsort's depth-triggered fallback is precisely the
engineered version of that answer. The reason it is not the default is constants — a worst-case
linear selection with a large constant loses on every real input to an expected linear one with a
small constant. The decision is therefore "is the tail acceptable?", and if it is not, the answer is
usually a hybrid rather than an all-deterministic algorithm, because the hybrid keeps the fast path
and bounds the bad one.

{/* FOOTER */}
