---
title: "The JDK's shuffle javadoc describes Fisher–Yates in prose and then hedges its own uniformity claim, and the hedge is the more interesting half — the algorithm is exactly uniform, the generator is not, and past about twenty elements most permutations are unreachable from any single seed"
sidebar_label: "10b · Fisher–Yates in practice"
sidebar_position: 10.1
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-08 against the JDK 25 javadoc for
> [`java.util.Collections`](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/util/Collections.html)
> (`shuffle`, quoted verbatim, including the hedge and its explanation) and
> [`java.util.Random`](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/util/Random.html)
> (`nextInt(int bound)`, and the thread-contention note), and MDN,
> [`Math.random()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/random).
> The `2^64 < 21!` comparison is **arithmetic stated in the text**, not a measurement, and the
> generator state width it assumes is stated as a hypothetical rather than attributed to any
> implementation. **No sandbox run.** Version spine: **JDK 25 · MDN as fetched 2026-09-07**.

**[10](10-randomisation.md) proved the loop correct; this page is what happens when you type it.**
The invariant survives the translation into TypeScript and Java, but three practical things attach
to it that the proof does not mention: the multiply-and-floor that turns a float into an index, the
`List` you were handed being a linked list, and the fact that a pseudo-random generator with finite
state cannot supply enough entropy to reach every permutation of a moderately large array. The JDK's
javadoc is unusually candid about the last one and is worth quoting rather than paraphrasing,
because it separates two claims that get conflated: the algorithm is uniform, the source of bits is
not.

## The code, both languages

```ts
function shuffle<T>(a: T[]): T[] {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));   // 0 .. i inclusive
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
```

`Math.random() * (i + 1)` lands in `[0, i+1)` because MDN specifies the source as
*"a floating-point, pseudo-random number that's greater than or equal to 0 and less than 1, with
approximately uniform distribution over that range — which you can then scale to your desired
range"*, and flooring that gives an integer in `[0, i]`. **The half-open interval is what makes the
scaling work**: were the generator's range closed at 1, `Math.floor` would occasionally return
`i + 1` and index past the region. That is also why `Math.round(Math.random() * i)` is wrong — it
maps the two half-width end intervals to `0` and `i`, giving those two indices half the weight of
every other one, which is a real bias introduced entirely in the conversion step and not in the
generator. The generic version of that mistake is [10d](10d-uniform-integers-and-modulo-bias.md).

Note the loop stops at `i > 0`, not `i >= 0`. The final iteration would pick `j` from `[0, 0]` and
swap element 0 with itself — harmless, and one wasted call to the generator. Writing `i >= 0` is not
a bug; writing `i > 0` and *also* excluding the current position from the draw is the bug from
[10](10-randomisation.md).

```java
static <T> void shuffle(List<T> list, Random rnd) {
    for (int i = list.size() - 1; i > 0; i--) {
        int j = rnd.nextInt(i + 1);           // 0 (inclusive) .. i+1 (exclusive)
        Collections.swap(list, i, j);
    }
}
```

`nextInt(bound)` returns *"a pseudorandom, uniformly distributed `int` value between 0 (inclusive)
and the specified value (exclusive), drawn from this random number generator's sequence"*, so
`nextInt(i + 1)` is precisely `[0, i]`. **The bound argument is where the inclusive/exclusive
confusion lands in Java**: `nextInt(i)` is the excluded-current-position bug, and it compiles,
runs, and throws nothing. It also throws `IllegalArgumentException` *"if bound is not positive"*,
which is why the loop condition `i > 0` is load-bearing here in a way it is not in TypeScript — at
`i = 0`, `nextInt(1)` is fine but `nextInt(0)` would throw, so a loop written down to `i >= 0` with
`nextInt(i)` fails loudly rather than silently. That is the one case where the bug announces itself.

In practice you call `Collections.shuffle` and only write this loop when the interviewer asks for it,
or when you need to shuffle a primitive array — `Collections.shuffle` takes a `List`, so shuffling
an `int[]` through it means boxing every element into an `Integer` and unboxing them all back.

## What the JDK documents about its own shuffle

The `Collections.shuffle(List)` javadoc states the algorithm and its invariant, which makes it a
genuine primary source for the loop above rather than a mere API reference:

> *"Randomly permutes the specified list using a default source of randomness. All permutations
> occur with approximately equal likelihood."*

> *"This implementation traverses the list backwards, from the last element up to the second,
> repeatedly swapping a randomly selected element into the "current position". Elements are randomly
> selected from the portion of the list that runs from the first element to the current position,
> inclusive."*

That is Fisher–Yates, described in prose, with the word **inclusive** doing exactly the work that
the first off-by-one in [10](10-randomisation.md) gets wrong. "From the last element up to the
second" is the `i > 0` bound, stated the same way.

⚠️ One trap in the javadoc, worth knowing before you cite it: the two-argument
`shuffle(List, Random)` overload carries **no** algorithm description and no uniformity statement of
its own — it documents only that it *"is equivalent to `shuffle(List, RandomGenerator)` and exists
for backward compatibility."* The sentences above belong to the one-argument form. Cite that one.

## The hedge, and why it is the more interesting half

> *"The hedge "approximately" is used in the foregoing description because default source of
> randomness is only approximately an unbiased source of independently chosen bits. If it were a
> perfect source of randomly chosen bits, then the algorithm would choose permutations with perfect
> uniformity."*

**This is a precise separation of two concerns and it is the paragraph to remember.** The
*algorithm* is exactly uniform — [10](10-randomisation.md) proved it, one execution path per
permutation. The *generator* is not a perfect source of independent bits, and no deterministic
generator with finite state can be.

The consequence is countable. A generator whose entire internal state is `s` bits has at most `2^s`
reachable states, so from a single seed it can produce at most `2^s` distinct output sequences and
therefore at most `2^s` distinct shuffles. Compare that with `n!`: `21!` already exceeds `2^64`. So
if a generator's state were 64 bits wide, then **for arrays of more than about twenty elements the
overwhelming majority of permutations would not be merely unlikely — they would be unreachable**,
with probability exactly zero, no matter how good the bit stream looks. A 52-card deck needs
`log2(52!)`, which is over 225 bits of state before uniformity is even arithmetically possible.

Two honest caveats on that paragraph. It is a statement about state width, and **the state width of
any particular implementation is not something this page asserts** — treat `2^64` as the worked
example it is. And it is not an argument against Fisher–Yates; it is an argument about which
generator to hand it, which is [10e](10e-the-security-boundary.md)'s subject and the
reason a real card room uses a cryptographic source.

## The `List` you were handed may not be an array

```java
Collections.shuffle(linkedList);   // fine — the JDK copies it out first
```

The loop indexes `list.get(i)` and `list.set(i, …)`. On an `ArrayList` those are constant time. On a
`LinkedList` each one walks from an end, so the hand-written loop above is `Θ(n²)` on the same input
where `Collections.shuffle` is linear — because the JDK's implementation dumps a non-random-access
list into an array, shuffles the array, and writes it back through a `ListIterator`. **Do the same
thing for the same reason**: if your input is a linked structure, or a `List` of unknown
implementation, copy to an array first. The general test is `instanceof RandomAccess`, which is the
marker interface the JDK itself branches on.

## Sampling k items without replacement: the partial shuffle

If you need `k` random items out of `n`, do not shuffle all of it. Stop the loop after `k` steps:

```ts
function sampleK<T>(a: T[], k: number): T[] {
  const n = a.length;
  for (let i = 0; i < k; i++) {
    const j = i + Math.floor(Math.random() * (n - i));   // i .. n-1 inclusive
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a.slice(0, k);
}
```

This is the upward Fisher–Yates truncated, and the induction in [10](10-randomisation.md) proves the
first `k` slots hold a uniformly random `k`-subset in uniformly random order. Cost is `Θ(k)` draws
instead of `Θ(n)` — which matters when `k` is 10 and `n` is a million, and matters more when `n` is
not known in advance at all. That last case is what forces reservoir sampling
([10h](10h-reservoir-sampling.md)).

The alternative — "pick `k` random indices, retry on a collision" — is also uniform, and it is the
right choice when `k` is tiny relative to `n` and you must not mutate the input. Its cost is
unbounded in the worst case and its expected number of draws is `n/(n−1) + n/(n−2) + …`, which stays
near `k` while `k ≪ n` and degenerates badly as `k` approaches `n`. The partial shuffle has no such
cliff, at the price of touching the array.

## Gotchas

**★ Symptom: `shuffle()` returns the array but the caller's original is also shuffled.** Cause: the
loop is **in place** and returns the same reference; `[a[i], a[j]] = [a[j], a[i]]` mutates. Fix:
decide deliberately — `shuffle([...a])` for a copy, or write the function to copy first. A shuffle
that silently reorders a caller's array is the kind of shared-mutable bug that surfaces two
components away, in a React render that assumed its props were stable and now flickers on every
re-render.

**★ Symptom: shuffling a large `LinkedList` with a hand-written loop is dramatically slower than
`Collections.shuffle` on the same list.** Cause: `list.get(i)` is `Θ(i)` on a non-random-access
list, making the loop `Θ(n²)`; the JDK's version copies to an array first. Fix: do the copy
yourself, or branch on `instanceof RandomAccess`. State the complexity, never a time.

**★ Symptom: two shuffles started in the same instant produce identical orderings.** Cause: two
generator instances constructed from a clock-derived seed at the same moment. Fix: construct the
generator **once** and reuse it, or use `ThreadLocalRandom.current()`, which is per-thread by
construction. `new Random()` inside a loop, or inside a request handler, is the shape to look for.

**★ Symptom: a shared `Random` in a hot multi-threaded path becomes a contention point.** Cause: the
javadoc is explicit — *"Instances of `java.util.Random` are threadsafe. However, the concurrent use
of the same `java.util.Random` instance across threads may encounter contention and consequent poor
performance."* Fix: the same javadoc's recommendation, *"Consider instead using `ThreadLocalRandom`
in multithreaded designs."* Note this is a correctness-preserving change: threadsafe was never in
doubt, only the contention.

**★ Symptom: the shuffle is correct but results repeat across server restarts.** Cause: a fixed seed
left in from testing. Fix: seed injection should be a constructor parameter with an unseeded
default, never a constant compiled in — see [10f](10f-seeding-and-reproducibility.md) for the shape
that gives you reproducible tests without a deterministic production system.

**★ Symptom: shuffling an array of objects appears to produce duplicates.** Cause: the "swap" was
written as `a[i] = a[j]; a[j] = a[i];` — the second assignment reads the value the first just
overwrote. Fix: destructuring in TypeScript, `Collections.swap` or an explicit temporary in Java.
Not a randomness bug at all, and the one that actually shows up in a live transcript.

**★ Symptom: `Math.round(Math.random() * n)` used to pick an index.** Cause: reaching for `round`
instead of `floor`. Fix: `Math.floor(Math.random() * (n + 1))` for `[0, n]`, or
`Math.floor(Math.random() * n)` for `[0, n)`. `round` maps `[0, 0.5)` to `0` and `[n−0.5, n]` to
`n`, so the two endpoints get half the weight of the interior values, *and* it can return `n` when
you wanted `[0, n)` — an off-by-one and a bias in one character.

**★ Symptom: `Collections.shuffle(Arrays.asList(intArray))` does not compile, or compiles and
shuffles nothing.** Cause: `Arrays.asList` on an `int[]` yields a single-element `List<int[]>`, not a
list of boxed integers. Fix: shuffle the primitive array with the explicit loop, or box explicitly
via a stream. This one is an autoboxing trap wearing a randomness costume.

## Interview questions

**★ Is `Collections.shuffle` guaranteed uniform?**
The javadoc says *"All permutations occur with approximately equal likelihood"* and then explains
the hedge itself: the algorithm would be perfectly uniform given a perfect source of independently
chosen bits, and the default source is only approximately that. So the answer has two parts — the
algorithm is exactly uniform, and the generator is not perfect, so for large `n` the generator's
state space is smaller than `n!` and most permutations are unreachable from any single seed. If
uniformity matters for money or security, pass a `SecureRandom`, which is
[10e](10e-the-security-boundary.md)'s subject.

**★ Why can a 64-bit-state generator not shuffle a deck of cards properly?**
Because a deterministic generator's whole output is a function of its state, so `s` bits of state
give at most `2^s` distinct shuffles, and `52!` is astronomically larger than `2^64` — `21!` already
passes it. The shuffles it *can* produce may be individually indistinguishable from random, but the
set of reachable orderings is a vanishing fraction of all of them. The fix is more entropy, not a
better shuffling loop: reseed from an operating-system source, which is what a cryptographic
generator does by construction.

**★ How would you shuffle a list too large to fit in memory?**
Not with this loop, which needs random access. The standard approach is an external shuffle: assign
each record an independent random key, partition records into buckets by that key, shuffle each
bucket in memory, and concatenate the buckets in key order. Uniformity depends on the keys being
drawn independently and on ties being broken randomly rather than by input order — the same tie
caveat that makes the sort-by-random-key shuffle in
[10c](10c-the-random-comparator-shuffle.md) subtly conditional.

**★ You need to pick 5 distinct winners from 10 million entries. What do you write?**
The partial shuffle: five iterations of the upward Fisher–Yates loop, `Θ(k)` random draws, then take
the first five. Not a full shuffle, which is `Θ(n)` needless work. "Pick five random indices and
retry on collision" is also correct and does not mutate the input; with `k` this much smaller than
`n` the expected retries are negligible, so it is a defensible answer as long as you say why the
collision path terminates. If the entries arrive as a stream you cannot index, it is reservoir
sampling instead ([10h](10h-reservoir-sampling.md)).

**★ Why does the JDK's shuffle copy a `LinkedList` to an array first?**
Because the algorithm's random access pattern is fundamentally hostile to a linked structure: `n`
random `get` calls cost `Θ(n²)` on a list that must be walked. Copying is `Θ(n)`, shuffling the
array is `Θ(n)`, writing back through a `ListIterator` is `Θ(n)`. It is the general lesson that an
algorithm's complexity is a claim about the data structure it runs on, not about the algorithm
alone — the same reason binary search on a linked list is pointless.

**★ Your shuffle needs to be verifiably fair to an auditor. What changes?**
Two things, neither of them the loop. The source of randomness becomes a cryptographic one, so that
the outcome is unpredictable to someone who has seen previous outcomes, and the seed acquires
enough entropy that all `n!` orderings are reachable. Then the *commitment* problem appears: the
auditor cannot verify unpredictability after the fact, so real systems publish a hash of the seed
before the shuffle and reveal the seed afterwards. That is a protocol question rather than an
algorithm question, and recognising the boundary is the answer.

{/* FOOTER */}
