---
title: "Integer square root is binary search on a monotone predicate, and the reason not to write Math.sqrt then floor is not style — it is that a correctly rounded double can round the true root up to the next integer, and above 2^53 the input was never exact to begin with"
sidebar_label: "11e · Integer square root"
sidebar_position: 11.4
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-08 against the JDK 25 javadoc for
> [`java.lang.Math`](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/lang/Math.html)
> — `sqrt(double)` (*"correctly rounded"*, and the NaN case) — and MDN,
> [`Number.MAX_SAFE_INTEGER`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number/MAX_SAFE_INTEGER)
> for the 52-bit mantissa and the exact-integer limit, both quoted verbatim. The ulp argument and
> every numeric bound below are **arithmetic performed in the text, not measured**; no specific input
> is claimed to fail on any specific platform, only that the rounding boundary exists and where it
> is. Binary search as a technique is
> [02i](02i-binary-search-as-degenerate-divide-and-conquer.md); the midpoint overflow is
> [05d](05d-the-three-silent-overflows.md). **No sandbox run.** Version spine: **JDK 25 · MDN as
> fetched 2026-09-07**.

**`isqrt(n)` is the largest integer `r` with `r² ≤ n`, and the whole problem is that the predicate
`r² ≤ n` is monotone — true for every `r` up to the answer and false after — which is precisely the
shape binary search consumes.** That framing is worth more than the code, because it is the same
framing that solves "minimum capacity to ship packages in D days" and every other
binary-search-on-the-answer problem. What makes this particular instance a good interview question
is that the obvious shortcut, `Math.floor(Math.sqrt(n))`, is wrong in two distinct ways at large
`n`, and being able to say which two is the difference between having read the problem and having
understood it.

## Why `Math.sqrt` then floor is not the answer

Java's javadoc is a strong guarantee, and it is still not enough:

> *"Returns the correctly rounded positive square root of a `double` value."*

Two independent failures follow, and they bite at different magnitudes.

**Failure 1 — the rounding can go up.** Take `n = k² − 1`. The true root is just below `k`:
`√(k² − 1) ≈ k − 1/(2k)`. "Correctly rounded" means the returned double is the one nearest the true
value — so if the true root is within half an ulp of `k`, the nearest double **is** `k`, and the
floor gives `k` when the answer is `k − 1`. Where is that boundary? Near a magnitude of `k`, the
spacing of doubles is about `k · 2^-52`, so half an ulp is about `k · 2^-53`. The gap to close is
`1/(2k)`. Setting `1/(2k) ≈ k · 2^-53` gives `k² ≈ 2^52`, i.e. `k ≈ 2^26` and `n ≈ 2^52`. **So the
failure region begins around `n` near `2^52` — comfortably inside the range of a `long`, and
comfortably inside JavaScript's exact-integer range too.** The floor is off by one there, silently.

**Failure 2 — above `2^53` the input is not itself exact.** MDN:

> *"Double precision floating point format only has 52 bits to represent the mantissa, so it can only
> safely represent integers between -(2^53 – 1) and 2^53 – 1. 'Safe' in this context refers to the
> ability to represent integers exactly and to compare them correctly."*

A `long` has 64 bits of magnitude and a double has 53 bits of significand, so converting a large
`long` to a `double` — which is what passing it to `Math.sqrt` does — cannot be exact for every
value. You are then taking the correctly rounded square root of **the wrong number**, and no amount
of care with the result recovers it.

**The consequence is not "never use `Math.sqrt`".** It is: use it as a *starting guess* and then
correct with integer arithmetic, or do not use it at all. The correction is two lines:

```java
long r = (long) Math.sqrt((double) n);
while (r > 0 && r > n / r) r--;          // too big: step down
while ((r + 1) <= n / (r + 1)) r++;      // too small: step up
```

Both loops run at most a small number of times because the guess is close, and both are written with
division rather than multiplication so that `r * r` never overflows. That is a legitimate production
implementation. It is not the interview answer, because the interviewer wants the search.

Note also the negative case, which the javadoc settles: *"If the argument is NaN or less than zero,
then the result is NaN."* An `isqrt` should reject a negative input explicitly rather than propagate
a `NaN` that becomes a `0` on the cast.

## The binary search, with the invariant written down

```java
static long isqrt(long n) {
    if (n < 0) throw new IllegalArgumentException("isqrt of a negative number");
    long lo = 0, hi = n, ans = 0;
    while (lo <= hi) {
        long mid = lo + (hi - lo) / 2;          // never (lo + hi) / 2 — see 05d
        if (mid == 0 || mid <= n / mid) {       // mid*mid <= n, written without the product
            ans = mid;
            lo = mid + 1;
        } else {
            hi = mid - 1;
        }
    }
    return ans;
}
```

**The invariant, stated exactly**, because "binary search but for squares" is not an answer:

> At the top of every iteration, `ans² ≤ n`; every integer strictly greater than `hi` has a square
> strictly greater than `n`; and the true answer lies in `[lo − 1, hi]`.

The loop preserves it. If `mid² ≤ n` then `mid` is a valid candidate, so recording it in `ans`
maintains the first clause, and everything at or below `mid` is now known to be dominated, so the
search moves to `mid + 1`. If `mid² > n` then by monotonicity everything from `mid` upwards fails,
so `hi = mid - 1` maintains the second clause. Termination is `lo > hi`, at which point the range is
empty and `ans` holds the largest candidate ever validated. **`ans` is not a convenience variable;
it is the carrier of the invariant**, which is why this form is easier to get right than the
`while (lo < hi)` variant where the answer must be read off a boundary.

Two implementation details that are the actual content:

- **`mid <= n / mid` instead of `mid * mid <= n`.** The product overflows for a `long` input well
  before `mid` gets large, and the division form is exact for the comparison: for positive `mid`,
  `mid² ≤ n` if and only if `mid ≤ floor(n / mid)`, because integer division truncates downward.
  The `mid == 0` guard exists solely to avoid dividing by zero on the first iteration when `n = 0`.
  In TypeScript the equivalent guard is `Number.isSafeInteger(mid * mid)`, or simply doing the whole
  thing in `BigInt` ([05b](05b-bigint-and-when-to-reach-for-it.md)).
- **`lo + (hi - lo) / 2`.** `(lo + hi) / 2` overflows when both are large, which for this problem
  they are on the first iteration — `hi` starts at `n`.
  [05d](05d-the-three-silent-overflows.md) owns that argument.

A tighter initial `hi` is available and worth mentioning: the answer never exceeds `n` and never
exceeds `2^32` for a `long` input, so `hi = min(n, 3037000499L)` — the largest `long` whose square
fits — removes the first few iterations. It is not needed for correctness and it is a nice thing to
notice.

```ts
function isqrt(n: number): number {
  if (n < 0) throw new RangeError("isqrt of a negative number");
  let lo = 0, hi = n, ans = 0;
  while (lo <= hi) {
    const mid = lo + Math.trunc((hi - lo) / 2);
    if (mid === 0 || mid <= Math.trunc(n / mid)) { ans = mid; lo = mid + 1; }
    else hi = mid - 1;
  }
  return ans;
}
```

`Math.trunc` on both divisions, for the reason in [11](11-number-problems-that-recur.md): `/` here
is floating-point division and a fractional `mid` breaks the invariant immediately. For `n` above
`Number.MAX_SAFE_INTEGER` this is unsalvageable in `number` and the answer is `BigInt`.

## Newton's method, and why it is not the interview answer

Newton's iteration for `√n` is `r ← (r + n/r) / 2`, done in integers:

```java
static long isqrtNewton(long n) {
    if (n == 0) return 0;
    long r = n, prev;
    do { prev = r; r = (r + n / r) / 2; } while (r < prev);
    return prev;
}
```

It converges quadratically — the number of correct digits roughly doubles each step — so it takes
far fewer iterations than binary search's `Θ(log n)`. Three reasons it is still not what to write on
a whiteboard: the termination condition is subtle (the sequence decreases and then oscillates by one,
so `r < prev` is doing careful work), a bad starting value can make it diverge or loop, and the
correctness argument is analysis rather than an invariant you can state in one sentence. **Binary
search's invariant is checkable in the room; Newton's convergence is not.** Mention Newton as the
faster alternative, write the search.

## The pattern this is an instance of

`isqrt` is *binary search on the answer*: the search space is not an array but the range of possible
outputs, and the array's "is it sorted" precondition is replaced by "is the predicate monotone".
Here the predicate is `r² ≤ n`, which is monotone in `r` because squaring is increasing on
non-negatives. Once you see it, the same template gives you integer cube root, the minimum ship
capacity, the smallest divisor to keep a sum under a threshold, and Koko eating bananas.
[02i](02i-binary-search-as-degenerate-divide-and-conquer.md) is the template;
[03f](03f-primality-by-trial-division.md) is where `isqrt` earns its keep, since trial division must
stop at `√n` and computing that bound with a float is exactly the bug this page is about.

## Gotchas

**★ Symptom: `isqrt` is off by one for large inputs and correct for everything you tested.** Cause:
`(long) Math.sqrt(n)` with no integer correction. The correctly rounded double root of `k² − 1` can
be exactly `k` once the true root is within half an ulp of `k`, which by the arithmetic above starts
around `n ≈ 2^52`. Fix: keep the float result as a seed and correct with `while (r > n / r) r--` and
the matching step-up.

**★ Symptom: a `long` input gives a wildly wrong root.** Cause: the implicit `long → double`
conversion at the `Math.sqrt` call is lossy above 53 significand bits, so the root taken is of a
different number. Fix: integer-only search, or `BigInteger.sqrt`. There is no correction loop that
recovers from having lost the input.

**★ Symptom: the search overflows and hangs or returns nonsense.** Cause: `mid * mid` for a large
`mid`, or `(lo + hi) / 2`. Fix: compare with `mid <= n / mid`, and compute the midpoint as
`lo + (hi - lo) / 2`.

**★ Symptom: division by zero on the first iteration.** Cause: the `mid <= n / mid` form with
`mid == 0`, which happens for `n = 0` and `n = 1`. Fix: the explicit `mid == 0` short-circuit. This
is the price of the division trick and it is worth paying.

**★ Symptom: the TypeScript version returns a fraction, or loops forever.** Cause: `/` left as
floating-point division for the midpoint or the comparison. Fix: `Math.trunc` on both. A fractional
`mid` violates the invariant immediately, and the loop can then fail to make progress.

**★ Symptom: `isqrt(-1)` returns 0.** Cause: `Math.sqrt` of a negative is `NaN` — documented, *"If
the argument is NaN or less than zero, then the result is NaN"* — and casting `NaN` to an integer
yields zero rather than throwing. Fix: validate the input and throw. A `NaN` that becomes a `0` is
the worst class of numeric bug because the wrong value is a plausible one.

**★ Symptom: `hi` initialised to `n / 2` "because the root is at most half".** Cause: an intuition
that is false for `n = 1`, where the root is `1` and `n / 2` is `0`. Fix: `hi = n`, or clamp with a
correct bound like `min(n, 3037000499)`. Off-by-one initial bounds in binary search fail on exactly
the smallest inputs, which is where people stop testing.

**★ Symptom: a perfect-square test written as `Math.sqrt(n) % 1 === 0`.** Cause: using the float
directly as an oracle. Fix: `const r = isqrt(n); return r * r === n;` — an exact integer comparison.
The float test inherits both failure modes above and adds a comparison against an exact zero, which
is the classic floating-point mistake.

## Interview questions

**★ Compute `floor(sqrt(n))` for a non-negative integer without using the library.**
Binary search on the answer. The predicate `r² ≤ n` is monotone in `r`, so search `[0, n]`: take
`mid = lo + (hi − lo) / 2`, and if `mid² ≤ n` record `mid` as the best candidate and move `lo` up,
otherwise move `hi` down. The invariant is that the recorded answer always satisfies the predicate
and everything above `hi` always fails it, so when the range empties the recorded value is the
largest that works. Two boundary details: write the comparison as `mid <= n / mid` so the square
never overflows, and use `lo + (hi − lo) / 2` so the midpoint never does.

**★ Why not `(int) Math.sqrt(n)`?**
Two reasons. First, the double result is correctly rounded, which means it can round *up*: for
`n = k² − 1` the true root is `k − 1/(2k)`, and once that gap is smaller than half an ulp at
magnitude `k` — which happens around `n ≈ 2^52` — the nearest double is exactly `k`, so the floor is
one too large. Second, above `2^53` the integer input itself cannot be represented as a double, so
the conversion at the call site loses information and you take the root of a different number. The
float result is a fine *seed*; it needs an integer correction step, and a search needs none.

**★ State the loop invariant.**
At the top of each iteration: the recorded answer squared is at most `n`; every integer greater than
`hi` has a square greater than `n`; and the true answer lies in `[lo − 1, hi]`. Each branch
preserves it — a passing `mid` becomes the new recorded answer and pushes `lo` past it, a failing
`mid` pushes `hi` below it — and termination at `lo > hi` leaves the recorded answer as the largest
value ever validated. Being able to state this is the difference between binary search you can
debug and binary search you rewrite until the tests pass.

**★ Newton's method converges faster. Why not use it?**
Because its correctness argument is convergence analysis rather than an invariant, its termination
condition is delicate — the integer sequence descends and then oscillates by one, so you stop when
it stops decreasing — and a poor initial guess can misbehave. In production, where it is written
once and tested, it is a good choice; in an interview the search is checkable line by line. The
honest answer names the trade rather than declaring one universally better, and does not quantify
the speed difference without measuring it.

**★ Where does `isqrt` actually matter?**
Trial division: to test `n` for primality you divide by candidates up to `√n`, and computing that
bound with a float means either testing one divisor too few — a wrong answer — or looping past it
forever. [03f](03f-primality-by-trial-division.md) uses the `i * i <= n` form for exactly this
reason, which is the same trick as the division comparison here: keep the boundary in integer
arithmetic. It also underlies exact perfect-square tests, which show up in Pythagorean-triple and
Diophantine problems.

{/* FOOTER */}
