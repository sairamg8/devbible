---
title: "Turning a random number into a random index is the step that quietly reintroduces bias, and the whole of it is one divisibility argument — 2^k outcomes cannot divide evenly into n buckets unless n divides 2^k, which is why the fix is rejection and never a cleverer modulo"
sidebar_label: "10d · Uniform integers and modulo bias"
sidebar_position: 10.3
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-08 against MDN,
> [`Math.random()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/random)
> (the half-open range and the *"approximately uniform"* hedge) and
> [`Crypto.getRandomValues()`](https://developer.mozilla.org/en-US/docs/Web/API/Crypto/getRandomValues)
> (the accepted array types and the 65,536-byte limit), and the JDK 25 javadoc for
> [`java.util.Random`](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/util/Random.html)
> (`nextInt(int bound)` and its `IllegalArgumentException`) — all quoted verbatim. The counting
> arguments and every residue count below are **arithmetic performed in the text**, not measured.
> ⚠️ The internal algorithm of `nextInt(bound)` is **not** quoted: the javadoc states the guarantee,
> not the method. **No sandbox run.** Version spine: **JDK 25 · MDN as fetched 2026-09-07**.

**Every randomised algorithm in this topic needs the same primitive — a uniformly random integer in
`[0, n)` — and every language hands you something that is not quite that.** JavaScript gives a
float in `[0, 1)`; Java's `nextInt()` gives 32 uniform bits; the Web Crypto API gives you raw bytes.
Converting any of them to a bounded integer is three characters of arithmetic and the single place
where a provably uniform algorithm ([10](10-randomisation.md)'s Fisher–Yates) becomes a
provably biased program. The argument is the same divisibility one that killed the naive shuffle,
which is the reason to teach them together: **`2^k` equally likely raw values cannot be partitioned
into `n` equal buckets unless `n` divides `2^k`.** This page derives the bias exactly, shows the
rejection loop that removes it, and lists the five ways the conversion goes wrong in practice.

## The two API shapes

**A float in `[0, 1)`.** MDN:

> *"The `Math.random()` static method returns a floating-point, pseudo-random number that's greater
> than or equal to 0 and less than 1, with approximately uniform distribution over that range —
> which you can then scale to your desired range."*

The half-open interval is what makes scaling work. `Math.floor(Math.random() * n)` gives `[0, n)`
because the product lands in `[0, n)` and never reaches `n`. Note MDN's own hedge, *"approximately
uniform"* — the same kind of hedge the JDK attaches to `Collections.shuffle`, and for the same
reason: a finite generator cannot be perfect.

**A bounded integer.** Java:

> *"Returns a pseudorandom, uniformly distributed `int` value between 0 (inclusive) and the
> specified value (exclusive), drawn from this random number generator's sequence."* — `nextInt(int
> bound)`, which also throws `IllegalArgumentException` *"if bound is not positive"*.

Here the platform has already solved the problem for you, and **the whole of the Java advice is: use
this method and never `nextInt() % n`.**

**Raw bytes.** `Crypto.getRandomValues()` fills a typed array; you get uniform bits and the bounding
is entirely yours. That is [10e](10e-the-security-boundary.md)'s API and this page's problem.

## The exact bias, derived

Suppose the generator produces each of the values `0 … 2^k − 1` with probability `2^-k`, and you
write `r % n`. Divide: `2^k = q·n + s` where `0 ≤ s < n`. Then residues `0 … s−1` are each hit by
`q + 1` of the raw values and residues `s … n−1` by `q` of them. If `s = 0` — that is, if `n`
divides `2^k`, which means `n` is a power of two — every residue gets exactly `q` and the result is
uniform. **Otherwise `s > 0` and the first `s` residues are strictly more likely, by a factor of
`(q+1)/q`.**

Two worked cases, both pure arithmetic:

- **`k = 32`, `n = 3`.** `3 × 1431655765 = 4294967295 = 2^32 − 1`, so `q = 1431655765` and `s = 1`.
  Residue `0` has one extra preimage out of about 1.43 billion. The bias exists and is far below
  anything you could observe; for array indices this is the normal case and it is why the bug
  survives review.
- **`k = 32`, `n = 2^31 + 1`.** Now `q = 1`, and `s = 2^32 − (2^31 + 1) = 2^31 − 1`. So `2^31 − 1`
  of the residues have **two** preimages and the rest have one: the most likely outcome is close to
  **twice** as likely as the least. The bias is worst when `n` is a little more than half the raw
  range, and it is nowhere near negligible.

The general bound is that the relative excess is at most about `n / 2^k`. That is the sentence to
carry: **modulo bias is proportional to the ratio of your range to the generator's range**, so it is
invisible for a 100-element array drawn from 32 bits and catastrophic for a range comparable to the
generator's own.

**The float route has the identical structure.** A `double` holds finitely many values in `[0, 1)`,
so `Math.floor(Math.random() * n)` partitions a finite set of raw outcomes into `n` buckets, and
unless `n` divides that count the buckets differ in size by one. ⚠️ MDN does not specify how many
distinct values `Math.random()` can produce, so **no count is asserted here** — but the shape of the
argument is the same, the discrepancy scales the same way, and MDN's *"approximately uniform"* is
the documentation acknowledging exactly this.

## The fix: rejection, not arithmetic

There is no cleverer modulo. The only way to turn `2^k` outcomes into `n` equally likely ones is to
discard some outcomes:

```ts
// Uniform integer in [0, n) from 32 uniform bits, with no modulo bias.
function uniformBelow(n: number): number {
  if (!Number.isInteger(n) || n <= 0) throw new RangeError("n must be a positive integer");
  const buf = new Uint32Array(1);
  const limit = Math.floor(2 ** 32 / n) * n;   // largest multiple of n that fits in 32 bits
  let r: number;
  do {
    crypto.getRandomValues(buf);
    r = buf[0];
  } while (r >= limit);                        // reject the ragged tail
  return r % n;
}
```

The loop discards exactly the `s` raw values that would have made some residues more likely, leaving
`limit = q·n` values that map onto the `n` residues perfectly evenly. Correctness is immediate: every
surviving value is equally likely and each residue has exactly `q` of them.

**Termination is probabilistic and that deserves a straight answer, because it is the objection an
interviewer will raise.** The loop has no bound; it could in principle run forever. But `limit` is at
least half of `2^32` whenever `n ≤ 2^31`, so each iteration succeeds with probability at least `1/2`,
and the expected number of iterations is at most 2. This is a *Las Vegas* algorithm — always
correct, randomly timed — as opposed to a *Monte Carlo* one, which is always fast and sometimes
wrong. Naming the distinction is usually worth a mark.

For an inclusive range:

```ts
const inRange = (lo: number, hi: number) => lo + uniformBelow(hi - lo + 1);
```

and note that `hi - lo + 1` is where an overflow lives in a fixed-width language: in Java, with
`lo = Integer.MIN_VALUE` and `hi = Integer.MAX_VALUE`, the span does not fit in an `int` at all.
[05d](05d-the-three-silent-overflows.md) is that subject; `Random` has a `nextInt(origin, bound)`-style
API precisely so you do not compute the span yourself.

In Java the whole page reduces to one line, because the platform already promises uniformity:

```java
int idx = rnd.nextInt(n);              // ✅ documented uniform over [0, n)
int bad = Math.abs(rnd.nextInt()) % n; // ⛔ two bugs, see below
```

⚠️ The javadoc states the *guarantee*, not the algorithm, so this page does not claim how
`nextInt(bound)` is implemented — only that a correct implementation cannot be a bare modulo, by the
argument above.

## The `Math.abs(nextInt()) % n` line, which has two bugs

It appears in real code and it is a two-for-one.

**Bug 1 — modulo bias**, as derived above. Mild for small `n`, but present.

**Bug 2 — the result can be negative.** `nextInt()` returns any `int`, including
`Integer.MIN_VALUE`, and `Math.abs` of that value is documented to be *itself*:

> *"Note that if the argument is equal to the value of `Integer.MIN_VALUE`, the most negative
> representable `int` value, the result is that same value, which is negative."* — `Math.abs(int)`

So one raw value in `2^32` produces a negative index, and `%` preserves the sign of the dividend
([03k](03k-the-remainder-trap-in-indices-hashes-and-shards.md)), so the expression yields a negative
array index. It is an `ArrayIndexOutOfBoundsException` that fires roughly once in four billion draws,
which is to say: never in testing, and eventually in production. `Math.absExact` throws instead —
*"throwing `ArithmeticException` if the result overflows the positive `int` range"* — which converts
the silent case into a loud one but is still not what you want here. **What you want is
`nextInt(n)`.**

## Gotchas

**★ Symptom: `Math.round(Math.random() * n)` used to pick an index.** Cause: `round` instead of
`floor`. Fix: `Math.floor(Math.random() * n)` for `[0, n)`. `round` maps the half-width intervals at
each end to `0` and `n`, so those two values get half the weight of the interior ones — *and* it can
return `n`, one past the end. An off-by-one and a bias in one character.

**★ Symptom: `Math.floor(Math.random() * (hi - lo)) + lo` never returns `hi`.** Cause: computing the
span as `hi - lo` when the range was meant to be inclusive. Fix: `hi - lo + 1`. Write down whether
your helper is inclusive or exclusive at the top and be consistent; the mixed convention is the
reason this bug recurs even in people who know it.

**★ Symptom: `rnd.nextInt() % n` gives a negative index.** Cause: `nextInt()` is over the whole
`int` range and `%` takes the sign of the dividend. Fix: `nextInt(n)`. Wrapping in `Math.abs` fixes
it for all but one input, and `Integer.MIN_VALUE` is that input.

**★ Symptom: a rejection loop that never terminates.** Cause: `limit` computed as `2^k % n` rather
than `2^k − (2^k % n)`, or an `n` of zero making `limit` zero, so every draw is rejected. Fix:
`limit = floor(2^k / n) * n`, and validate `n > 0` up front — which is exactly what
`nextInt(bound)`'s *"IllegalArgumentException - if bound is not positive"* does for you.

**★ Symptom: `crypto.getRandomValues` throws when asked for a large buffer.** Cause: MDN documents
*"`QuotaExceededError` - Thrown if the `byteLength` of `typedArray` exceeds 65,536."* Fix: fill in
chunks of at most 65,536 bytes. This bites when someone tries to pre-generate a big pool of random
numbers in one call — and pre-generating a pool is itself usually the wrong shape, because the
whole point of the API is that it is cheap to call again.

**★ Symptom: `crypto.getRandomValues(new Float64Array(1))` throws a `TypeMismatchError`.** Cause: the
API takes integer typed arrays only — MDN lists `Int8Array`, `Uint8Array`, `Uint8ClampedArray`,
`Int16Array`, `Uint16Array`, `Int32Array`, `Uint32Array`, `BigInt64Array` and `BigUint64Array`, and
explicitly not the float types. Fix: fill a `Uint32Array` and divide if you genuinely need a float —
and think hard about whether you do, because the division reintroduces the resolution question.

**★ Symptom: a "random" percentage computed as `1 + Math.floor(Math.random() * 100)` that never
returns 100 or never returns 1.** Cause: the classic inclusive/exclusive confusion, in the direction
of whichever end the author was not thinking about. Fix: the range `[1, 100]` has 100 values, so it
is `1 + Math.floor(Math.random() * 100)` — which is correct; the *broken* versions are
`* 99` (never 100) and `Math.ceil(Math.random() * 100)` (returns 0 when the draw is exactly 0, with
probability that is tiny and non-zero because the range is closed at 0).

**★ Symptom: a helper that returns a random element with `arr[Math.random() * arr.length]`.** Cause:
the `Math.floor` omitted. Fix: add it. JavaScript will not complain — a non-integer property access
on an array yields `undefined` rather than throwing, so the failure surfaces as a mysterious
`undefined` far from its cause. In TypeScript the type is still `T`, not `T | undefined`, unless
`noUncheckedIndexedAccess` is on, so the compiler will not save you either.

**★ Symptom: the same "random" value appears across a batch of items created in one request.**
Cause: the random value computed once outside the loop, or a helper memoised by a framework. Fix:
this is a plain evaluation-order bug rather than a randomness bug, but it presents as one, and it is
worth checking before you go looking for bias.

## Interview questions

**★ What is modulo bias, and when does it matter?**
When you reduce a uniform value from `0 … 2^k − 1` modulo `n`, the raw values do not divide evenly
across the `n` residues unless `n` is a power of two: writing `2^k = q·n + s`, the first `s`
residues get `q + 1` preimages and the rest get `q`, so the first `s` outcomes are more likely by a
factor of `(q+1)/q`. The relative excess is on the order of `n / 2^k`, so it is unmeasurably small
for a small array drawn from 32 bits and close to a factor of two when `n` is a little over half the
generator's range. It matters whenever `n` is large relative to the generator, and it always matters
in a security context, where "biased but only slightly" is still a distinguisher.

**★ How do you remove it?**
Rejection sampling: compute the largest multiple of `n` that fits in the generator's range,
`limit = floor(2^k / n) * n`, draw until the value is below `limit`, and only then reduce. The
surviving values are exactly `q` per residue, so the result is exactly uniform. The loop is
unbounded but each iteration succeeds with probability at least `1/2` for any `n` up to half the
range, so the expected number of draws is under two. There is no bias-free arithmetic alternative —
you cannot map `2^k` outcomes onto `n` equal buckets when `n` does not divide `2^k`, which is the
same pigeonhole argument as the naive shuffle's.

**★ Las Vegas or Monte Carlo — which is the rejection loop, and what is the difference?**
Las Vegas: the answer is always correct and the running time is a random variable. Monte Carlo: the
running time is bounded and the answer is correct only with high probability. Rejection sampling and
quickselect with a random pivot are Las Vegas; a Miller–Rabin primality test with a fixed number of
rounds is Monte Carlo. The distinction decides what you are allowed to promise a caller — a Las
Vegas algorithm can be given a deadline only by giving up, and a Monte Carlo one can be given a
deadline by accepting a worse error probability.

**★ Why is `Math.abs(random.nextInt()) % n` wrong in Java, twice over?**
It has modulo bias, and it can return a negative number. `nextInt()` covers the whole `int` range
including `Integer.MIN_VALUE`, whose absolute value is not representable — the javadoc says the
result *"is that same value, which is negative"* — and `%` keeps the sign of the dividend, so the
expression yields a negative index for exactly one raw value in `2^32`. That is an exception that
never fires in testing. The fix is `nextInt(n)`, which the javadoc documents as uniform over
`[0, n)` and which rejects a non-positive bound with `IllegalArgumentException`.

**★ Why does `Math.floor(Math.random() * n)` not need a rejection loop in practice, if the same
argument applies?**
Because the discrepancy is bounded by roughly the ratio of `n` to the number of distinct values the
generator can emit, and for array-sized `n` that ratio is far below any consequence. The argument
still *applies* — it is the same divisibility statement — and it stops being ignorable in two cases:
when `n` approaches the generator's resolution, and when the context is adversarial, because an
attacker's job is precisely to exploit a distinguisher too small to notice. For a security-relevant
range, do the rejection loop over `crypto.getRandomValues` and do not reason about how small the bias
is.

**★ You need a random `BigInt` below some huge bound. What changes?**
The structure does not: draw enough bytes to cover the bound, interpret them as a `BigInt`, and
reject anything at or above the largest multiple of the bound that fits in that many bytes. What
changes is that you cannot use `%` on the raw bits and hope — the ratio `n / 2^k` is now potentially
close to 1, which is exactly the regime where modulo bias is a factor-of-two effect rather than a
rounding curiosity. Draw a few extra bytes beyond the bound's width and the rejection probability
becomes small.

---

← Prev: [10c · The random comparator shuffle](10c-the-random-comparator-shuffle.md) · Index: [Phase 2 — Recursion, maths and bits](README.md) · Next → [10e · The security boundary](10e-the-security-boundary.md)
