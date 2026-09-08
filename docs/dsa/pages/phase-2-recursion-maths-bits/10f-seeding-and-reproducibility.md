---
title: "A randomised algorithm that fails once in a thousand runs is undebuggable unless the randomness is an injected parameter, and JavaScript forces the issue because MDN documents that Math.random's seed cannot be chosen or reset by the user"
sidebar_label: "10f · Seeding and reproducibility"
sidebar_position: 10.5
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-08 against MDN,
> [`Math.random()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/random)
> (the seed cannot be chosen or reset), and the JDK 25 javadocs for
> [`java.util.Random`](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/util/Random.html)
> (same seed, identical sequences),
> [`java.util.concurrent.ThreadLocalRandom`](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/util/concurrent/ThreadLocalRandom.html)
> (`setSeed` unsupported) and
> [`java.security.SecureRandom`](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/security/SecureRandom.html)
> (`setSeed` supplements rather than replaces) — all quoted verbatim. ⚠️ **No specific
> pseudo-random generator's constants are reproduced on this page**, deliberately: reciting
> multipliers from memory is exactly the kind of claim that cannot be verified here. The test-double
> pattern shown instead needs no constants. **No sandbox run.** Version spine: **JDK 25 · MDN as
> fetched 2026-09-07**.

**The reason to care about seeding is not statistics; it is that a randomised algorithm has no
reproducible failure.** A partition bug in quickselect that only triggers when the pivot lands on a
duplicate, a shuffle that corrupts one element in a rare index pattern, a rejection loop that spins
on one bound — each of these is a test that fails on Tuesday and passes on Wednesday, and none of
them can be bisected, attached to a ticket, or verified as fixed. The fix is architectural rather
than mathematical: **the source of randomness becomes a parameter**, so the test can supply a known
one and production can supply a real one. JavaScript makes this non-optional, because the platform
generator cannot be seeded at all.

## JavaScript: you cannot seed it, so you must inject it

> *"The implementation selects the initial seed to the random number generation algorithm; it cannot
> be chosen or reset by the user."* — MDN, `Math.random()`

That sentence closes off the obvious approach. There is no `Math.seedRandom`, and monkey-patching
`Math.random` in a test is a global mutation that leaks between test files, breaks anything else
running concurrently, and has to be restored in a `finally` that someone will eventually forget.

The seam goes in the function signature:

```ts
type Rng = () => number;   // returns a float in [0, 1), like Math.random

function shuffle<T>(a: T[], rng: Rng = Math.random): T[] {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
```

The default argument means every existing call site is unchanged and the production behaviour is
identical. The test supplies its own.

## The test double that needs no generator at all

For unit tests the right double is not a seeded generator — it is a **scripted sequence**, because
what you are testing is that the algorithm consumes the randomness correctly, and a scripted
sequence lets you assert the exact output permutation:

```ts
function scripted(values: readonly number[]): Rng {
  let i = 0;
  return () => {
    if (i >= values.length) throw new Error(`rng exhausted after ${values.length} draws`);
    return values[i++];
  };
}

// Drives j = 0 at every step, so element 0 is swapped into each slot in turn.
const rng = scripted([0, 0, 0]);
```

Two things this buys you that a seeded generator does not. The assertion is on an exact permutation
rather than on a distribution, so the test is a real regression guard against the off-by-one in
[10](10-randomisation.md) — feed it a value that would produce `j = i` and assert the element stays
put, which is precisely the case the buggy loop cannot produce. And the `rng exhausted` throw is a
free assertion on the **number of draws**: a shuffle of three elements must consume exactly two, and
a version that wastes one at `i = 0` will fail loudly rather than silently.

⚠️ If you want many reproducible pseudo-random values — property-based testing, a soak test — you do
need a real seeded generator, and the honest advice is to take one from a library or a published
reference rather than typing constants from memory. **The choice of multiplier and modulus in a
linear congruential generator is the whole of its quality**, bad choices produce visible structure,
and this page will not print a set it cannot verify.

## Java: the seed is part of the API, with three different behaviours

> *"If two instances of `Random` are created with the same seed, and the same sequence of method
> calls is made for each, they will generate and return identical sequences of numbers."*

That is an unusually strong guarantee — it is stated about the class, not about a particular run —
and it is what makes `new Random(seed)` a legitimate test fixture in Java in a way that has no
JavaScript equivalent. The same injection seam still applies, because you want production
randomness to be unseeded:

```java
public final class Deck {
    private final Random rnd;

    public Deck()               { this(new Random()); }      // production
    public Deck(Random rnd)     { this.rnd = rnd; }          // tests pass new Random(42)

    public void shuffle(List<Card> cards) {
        for (int i = cards.size() - 1; i > 0; i--) {
            Collections.swap(cards, i, rnd.nextInt(i + 1));
        }
    }
}
```

The other two generators behave differently and the differences are documented:

- **`ThreadLocalRandom`** — *"Throws `UnsupportedOperationException`. Setting seeds in this
  generator is not supported."* It is deliberately un-seedable, which is a good default for
  production and a hard stop for a test. If a class you want to test calls
  `ThreadLocalRandom.current()` directly, it is untestable; that call is the thing to refactor.
- **`SecureRandom`** — *"The seed supplements, rather than replaces, the existing seed. Thus,
  repeated calls are guaranteed never to reduce randomness."* You cannot pin it to a sequence, by
  design. A "deterministic `SecureRandom` for tests" is not a thing; inject a different generator,
  or test the encoding rather than the bytes ([10e](10e-the-security-boundary.md)).

Modern Java expresses the seam as `RandomGenerator`, the interface all three implement, which is the
type to accept in a constructor when you do not want to commit the caller to `java.util.Random`.

## The pattern that actually catches bugs: log the seed

Injection makes a failure reproducible only if you know *which* randomness produced it. The pattern
is to randomise the seed and record it:

```java
long seed = System.nanoTime();          // or any unpredictable source
Random rnd = new Random(seed);
try {
    runRandomisedTest(rnd);
} catch (AssertionError e) {
    throw new AssertionError("failing seed = " + seed, e);
}
```

Now every run explores different inputs — which is the point of randomised testing — and every
failure comes with the one number needed to replay it exactly. This is what property-based testing
frameworks do internally, and it is the reason they can report a shrunken counterexample: they are
free to re-run the generator from the same seed as many times as they like.

**The complement is a fixed-seed suite for the cases you already found.** A seed that once produced
a failure becomes a permanent regression test, cheap and deterministic. Randomised exploration finds
new bugs; the fixed seeds stop old ones coming back. Running only the second is the common mistake,
because it looks like coverage.

## What a seed does not make reproducible

A seed pins the generator. It does not pin the program, and a "reproducible" test that still flakes
is usually failing on one of these:

- **Concurrency.** Two threads drawing from one generator consume its sequence in a
  non-deterministic interleaving, so the seed no longer determines who got which value. A seeded
  test must be single-threaded, or must give each thread its own seeded generator.
- **Iteration order.** Iterating a hash-based collection and drawing a random number per element
  makes the pairing depend on the iteration order, which is not part of the contract for a
  `HashMap` or an object's keys.
- **Time and identity.** Anything reading the clock, a UUID, a process id or an autoincrement id is
  a second source of non-determinism the seed does not cover.
- **Floating-point summation order.** Reordering additions changes results in the last bits, which
  matters when a test asserts an exact double.

The general form: **a seed makes the *generator* deterministic, and the program is deterministic only
if the generator was its only source of variation.** Say that in an interview and then name the
other sources, because the follow-up is always "and your test is still flaky, why?"

## Gotchas

**★ Symptom: a test monkey-patches `Math.random` and an unrelated test in another file starts
failing.** Cause: a global mutated and not restored, or restored in a path that an early `return`
skipped. Fix: inject the generator as a parameter. MDN's *"it cannot be chosen or reset by the
user"* is the reason there is no supported alternative, so the injection is not a preference.

**★ Symptom: `new Random(42)` in production code, discovered months later.** Cause: a fixed seed
added for debugging and never removed. Fix: the seeded constructor should be reachable only from
tests — a package-private constructor, or a parameter with an unseeded default — so that seeding in
production requires writing something visibly unusual.

**★ Symptom: a seeded test passes locally and fails in CI.** Cause: something other than the
generator varies — thread count, map iteration order, locale, time zone, or a second unseeded
generator somewhere in the call graph. Fix: audit for other sources of variation before doubting the
seed. The `Random` guarantee is about the sequence of values, and it holds; what has changed is the
sequence of *calls*.

**★ Symptom: `ThreadLocalRandom.current().setSeed(0)` throws
`UnsupportedOperationException`.** Cause: it is documented as unsupported. Fix: inject a `Random` or
a `RandomGenerator`; a class that reaches for `ThreadLocalRandom.current()` internally has hardcoded
its randomness and needs the seam added.

**★ Symptom: someone builds a "deterministic `SecureRandom`" for tests by calling `setSeed` first.**
Cause: assuming `setSeed` behaves as it does on `Random`. Fix: it is documented to *supplement*
rather than replace, so the sequence stays unpredictable. Test the code around the secret — length,
encoding, alphabet, uniqueness — and inject a fake byte source if you must assert on the bytes.

**★ Symptom: a randomised test that catches a bug once and can never reproduce it.** Cause: an
unlogged seed. Fix: draw the seed, log it, and include it in the failure message. A flaky failure
with a seed attached is an ordinary bug; without one it is a rumour, and it will be closed as
unreproducible.

**★ Symptom: a seeded shuffle produces different results after a library upgrade.** Cause: the
algorithm consuming the randomness changed the number or order of its draws — the seed is unchanged
but the sequence of calls is not. Fix: do not assert on a specific permutation across a dependency
you do not control; assert on properties (same multiset, correct length) plus your own scripted-rng
tests for your own code.

**★ Symptom: two "independent" seeded generators produce correlated output.** Cause: seeds derived
from the clock a moment apart, or from a counter, so the initial states are adjacent. Fix: derive
each seed from a single well-mixed source, or use one generator. Adjacent seeds giving related
streams is a known weakness of simple generators, and it is why "seed with the loop index" is a bad
habit.

## Interview questions

**★ Can you seed `Math.random()`?**
No. MDN is explicit: *"The implementation selects the initial seed to the random number generation
algorithm; it cannot be chosen or reset by the user."* So a randomised algorithm in JavaScript
cannot be made reproducible by seeding the platform generator, and the supported approach is to
accept the generator as a parameter — `(a: T[], rng: () => number = Math.random)` — so tests can
pass a scripted or seeded one. Monkey-patching the global works until two tests run concurrently.

**★ How do you write a deterministic test for a shuffle?**
Inject the random source and drive it with a scripted sequence, then assert the exact resulting
permutation. That tests the thing that can actually be wrong — the index arithmetic — rather than
the distribution, which is untestable in a unit test. Add an assertion on the number of draws
consumed, since an off-by-one in the loop bound changes it. Separately, a small-`n` chi-squared test
over many runs can guard the distribution, but it is a slow statistical test and belongs in a
different suite from the deterministic one.

**★ Why does Java let you seed but not `SecureRandom`?**
Because reproducibility and unpredictability are opposite requirements. `java.util.Random`
guarantees that *"if two instances of `Random` are created with the same seed … they will generate
and return identical sequences of numbers"*, which is exactly what makes it useless for secrets and
perfect for tests. `SecureRandom` must produce non-deterministic output, so its `setSeed` is
documented to supplement rather than replace, *"guaranteed never to reduce randomness"* — there is
no way to force it into a known sequence, and that is the feature.

**★ What is the seed-logging pattern and why is it better than a fixed seed?**
Draw a fresh seed each run, log it, and include it in any failure message. A fixed seed explores one
input forever and finds a bug once, if at all; a logged random seed explores a new input every run
and still yields a one-number recipe to replay any failure exactly. In practice you want both: the
random seed for exploration, and a fixed-seed regression test for every seed that has ever failed.
This is precisely how property-based testing frameworks operate, and it is why they can shrink a
counterexample — they can re-run from the same seed as often as they like.

**★ Your test is seeded and still flaky. What are you looking for?**
A second source of non-determinism. The most common are concurrency — two threads pulling from one
generator interleave unpredictably, so the seed no longer determines who receives which value —
iteration order over a hash-based collection, the clock, generated identifiers, and floating-point
summation order. A seed pins the generator's *output sequence*; the program is deterministic only if
that sequence is consumed in a deterministic order. That framing turns the debugging into a search
for who else is varying.

**★ Should production randomness ever be seeded?**
Almost never, and the exceptions are worth knowing because they are real: deterministic simulations
that must be replayable from a recorded seed, procedural generation where the seed *is* the content
identifier, and sharding schemes that must agree across machines. In each of those the seed is a
deliberate, documented input rather than a leftover. Everything else — tokens, shuffles, pivots,
jitter — wants an unseeded generator, and a fixed seed in that code is a bug that presents as
"suspiciously repetitive behaviour" rather than as an error.

{/* FOOTER */}
