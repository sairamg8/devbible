---
title: "Euclid's algorithm is one identity and everything that follows from it — a and b have exactly the same common divisors as b and a mod b, which is why four lines of code find the greatest common divisor in logarithmically many divisions rather than by trying every candidate"
sidebar_label: "03 · gcd and Euclid's algorithm"
sidebar_position: 3
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-08. Euclid's algorithm, its termination argument, its logarithmic step bound and
> Lamé's theorem are **textbook mathematics, derived on this page rather than cited** — there is no
> primary source to quote for them, and the research bank for this phase says so explicitly. One
> language fact is primary-sourced: the **JDK 25**
> [`java.math.BigInteger`](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/math/BigInteger.html)
> javadoc for `gcd`, quoted verbatim below, which is where the `gcd(0, 0) = 0` convention is visible
> in a shipped API. The complexity vocabulary is
> [Phase 1](../phase-1-complexity/01-big-o-theta-and-omega.md)'s.
> **No sandbox run** — this page carries code, never program output, and no timing.

**Every number-theory question an interview asks is downstream of one identity, and the identity is
three lines of arithmetic: `gcd(a, b) = gcd(b, a mod b)`.** Reduce a fraction, find the period at
which two cycles line up, tile a rectangle with squares, decide whether `ax + by = c` has an integer
solution, invert a number modulo a composite — all of it is Euclid's algorithm, or Euclid's
algorithm with two extra accumulators. This page derives the identity so you can reconstruct it
under pressure rather than recall it, proves the two things an interviewer will actually push on —
that it terminates, and that it takes logarithmically many steps rather than linearly many — and
gives the recursive and iterative forms in both languages. It deliberately stops there. The sign and
type traps that make a correct `gcd` return a wrong answer are
[03b](03b-gcd-on-signed-and-wide-types.md), because they are about the languages rather than about
the mathematics, and they are where the bugs actually are. The rest of the topic:
[03c](03c-lcm-and-the-multiplication-order.md) is `lcm` and the multiplication order,
[03d](03d-the-extended-euclidean-algorithm-and-bezout.md) is the extended algorithm and Bézout,
[03e](03e-the-chinese-remainder-theorem.md) is the Chinese remainder theorem,
[03f](03f-primality-by-trial-division.md), [03g](03g-the-sieve-of-eratosthenes.md) and
[03h](03h-factorisation-and-smallest-prime-factors.md) are primes and factorisation,
[03i](03i-divisor-functions-and-the-totient.md) is the divisor functions and Euler's totient, and
[03j](03j-modular-arithmetic-and-the-remainder-trap.md),
[03k](03k-the-remainder-trap-in-indices-hashes-and-shards.md) and
[03l](03l-why-answers-are-taken-modulo-a-large-prime.md) are modular arithmetic, the sign of `%`,
and why counting answers are reported modulo a large prime.

## The identity, derived

Fix integers `a` and `b` with `b > 0`, and write the division with remainder:

```
a = q·b + r        where q = ⌊a / b⌋ and 0 ≤ r < b
```

Claim: **the set of common divisors of `(a, b)` is exactly the set of common divisors of `(b, r)`.**
Not "they have the same greatest one" — the same *set*, which is a stronger and much easier thing
to prove.

- Let `d` divide both `a` and `b`. Then `d` divides `a − q·b`, because `d` divides each term. And
  `a − q·b` is `r`. So `d` divides both `b` and `r`.
- Let `d` divide both `b` and `r`. Then `d` divides `q·b + r`, which is `a`. So `d` divides both
  `a` and `b`.

The two sets contain each other, so they are equal, so their maxima are equal:
`gcd(a, b) = gcd(b, r) = gcd(b, a mod b)`. That is the entire algorithm. The base case is
`gcd(a, 0) = a`: every integer divides `0`, so the common divisors of `(a, 0)` are just the
divisors of `a`, and the greatest of those is `a` itself. (By the usual convention `gcd(0, 0) = 0`,
because there is no greatest element of "all integers" — a definition, not a theorem.)

## Why it terminates, and why it is logarithmic

**Termination.** The second argument is a remainder, so `0 ≤ r < b`: it strictly decreases and is
bounded below by zero. A strictly decreasing sequence of non-negative integers is finite. That is
the whole proof, and it is the one to say out loud.

**The step bound.** Assume `a ≥ b > 0`. Then `a mod b < a / 2`, always, by two cases:

- if `b ≤ a / 2`, then `a mod b < b ≤ a / 2`, because a remainder is smaller than its divisor;
- if `b > a / 2`, then `q = 1` and `a mod b = a − b < a / 2`.

So one step takes the pair `(a, b)` to `(b, r)` with `r < a / 2`: after **two** steps the larger
argument has at least halved. The number of division steps is therefore `O(log a)`, and since
`a` and `b` swap on the first step if `a < b`, `Θ(log min(a, b))` division steps is the honest
bound. Each step is one machine division, so on `int`/`long` inputs the whole thing is
`Θ(log min(a, b))` operations — see
[Phase 1 · Big-O, Θ and Ω](../phase-1-complexity/01-big-o-theta-and-omega.md) for why the base of
that logarithm does not need stating. The worst case is a pair of consecutive Fibonacci numbers,
where every quotient is `1` and no step does better than the bound — that is Lamé's theorem, and it
is textbook rather than something to derive on a board.

As a recurrence: `T(a, b) = T(b, a mod b) + Θ(1)`, depth `Θ(log min(a, b))`. It is not a
divide-and-conquer recurrence and the master theorem does not apply to it —
[Phase 1 · Recurrences and the master theorem](../phase-1-complexity/08-recurrences-and-the-master-theorem.md)
covers which recurrences that method does and does not cover.

## The code

Recursive, which is the form to write on a whiteboard because it is the identity transcribed:

```ts
// TypeScript — the identity, transcribed. Requires a >= 0 and b >= 0; see below for why.
export function gcdRec(a: number, b: number): number {
  return b === 0 ? a : gcdRec(b, a % b);
}
```

The recursion is tail-recursive and its depth is `Θ(log min(a, b))`, so it will not exhaust the
stack for any pair of machine integers — but no JavaScript engine in production eliminates the
frame, which is
[Phase 1 · Tail calls, and the explicit stack](../phase-1-complexity/04b-tail-calls-and-the-explicit-stack.md).
The iterative form is the one to ship:

```ts
// TypeScript — iterative, and safe for negative inputs.
export function gcd(a: number, b: number): number {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b !== 0) {
    const t = a % b;
    a = b;
    b = t;
  }
  return a;
}
```

```java
// Java — the same loop. Note the parameter type: see "the one input Math.abs cannot take".
static long gcd(long a, long b) {
    a = Math.abs(a);
    b = Math.abs(b);
    while (b != 0L) {
        long t = a % b;
        a = b;
        b = t;
    }
    return a;
}
```

For values beyond a machine word, the identity is unchanged; only the type changes. In Java that is
`BigInteger`, which carries its own `gcd`. In TypeScript it is `BigInt`, and the same loop works
verbatim with `0n` for the literal — `BigInt`'s `%` is also a remainder, so the sign handling below
still applies.

## Gotchas

**★ Symptom: the loop never terminates, or terminates with the wrong value.** Cause: the base-case
test and the return value were written against different variables — `while (a !== 0)` paired with
`return a`, or a swap added "to make sure `a ≥ b`" that runs inside the loop instead of before it.
Fix: one convention, and the destructuring form makes it hard to get wrong. The `a < b` case needs
no special handling at all: `gcd(4, 18)` steps to `gcd(18, 4)` on the first iteration and costs one
extra division, which is why every version on this page omits the swap.

```ts
while (b !== 0) [a, b] = [b, a % b];      // ✅ test on b, return a — no swap needed
return a;
```

**★ Symptom: a caller divides by the value `gcd` returned and divides by zero.** Cause: `gcd(0, 0)`
is `0`, which is a convention rather than a theorem — every integer divides zero, so the common
divisors of `(0, 0)` are all the integers and there is no greatest one. The JDK made the same
choice and documents it:

> *"Returns a BigInteger whose value is the greatest common divisor of `abs(this)` and `abs(val)`.
> Returns 0 if `this == 0 && val == 0`."* — JDK 25, `BigInteger.gcd(BigInteger)`

Note that the same sentence also settles the sign question for you: `BigInteger.gcd` is defined on
the *absolute values*, which is exactly the guard [03b](03b-gcd-on-signed-and-wide-types.md) says
you must add by hand to a primitive implementation. Fix: guard at the call site, where you know what
the right answer is for your problem, rather than inside `gcd`, where returning `1` would break the
identity `gcd(a, 0) = a`:

```ts
const g = gcd(n, d);
const reduced = g === 0 ? [0, 1] : [n / g, d / g];   // ✅ decide the degenerate case deliberately
```

**★ Symptom: the `Θ(log min(a, b))` claim is challenged on 200-digit inputs and you cannot defend
it.** Cause: the bound counts **division steps**, and a division is a constant-time machine
instruction only on values that fit a register; on `BigInteger` or `BigInt` each division costs
something that grows with the operand length. Fix: state it as "logarithmically many divisions" and
say explicitly that the per-division cost is constant only for machine words. Choosing the unit of
work, and saying which one you chose, is exactly what
[Phase 1 · Big-O, Θ and Ω](../phase-1-complexity/01-big-o-theta-and-omega.md) is for.

**Symptom: a "factorise both numbers and multiply the shared primes" gcd is offered and rejected.**
Cause: it is perfectly correct and enormously slower — factorisation by trial division is `Θ(√n)`
where Euclid is `Θ(log n)`, which on a 64-bit input is the difference between about `2^32` divisions
and about 64 of them. Fix: Euclid. Factorisation is the right tool when you need the *factors*
themselves; see [03f · Primality by trial division](03f-primality-by-trial-division.md).

**Symptom: the recursive form is rewritten with an accumulator "to make it tail-recursive" and
nothing changes.** Cause: it already was tail-recursive — `return gcdRec(b, a % b)` is the last
thing the function does, with no pending work. Fix: if the goal is to remove frames, remove them:
write the loop. No production JavaScript engine performs the elimination, which is
[Phase 1 · Tail calls, and the explicit stack](../phase-1-complexity/04b-tail-calls-and-the-explicit-stack.md).

## Interview questions

**★ Why is `gcd(a, b) = gcd(b, a mod b)`?**
Because the two pairs have exactly the same *set* of common divisors, not merely the same greatest
one — which is a stronger claim and a much easier proof. Write `a = q·b + r`. If `d` divides `a` and
`b`, it divides `a − q·b = r`, so it divides `b` and `r`. If `d` divides `b` and `r`, it divides
`q·b + r = a`, so it divides `a` and `b`. Two sets that contain each other are equal, so their
maxima are equal. The base case is `gcd(a, 0) = a` because every integer divides zero, so the common
divisors of `(a, 0)` are precisely the divisors of `a`, of which `a` is the greatest.

**★ Why does Euclid's algorithm terminate, and how many steps does it take?**
It terminates because the second argument is a remainder, so it strictly decreases and never goes
below zero, and a strictly decreasing sequence of non-negative integers is finite. That is the whole
proof and it is the one to say out loud. The step count is `Θ(log min(a, b))`, and the argument is
two cases: for `a ≥ b`, `a mod b < a / 2` — if `b ≤ a/2` the remainder is smaller than `b` and hence
smaller than `a/2`; if `b > a/2` the quotient is 1 and the remainder is `a − b < a/2`. So the larger
of the two arguments at least halves every two steps. The worst case is a pair of consecutive
Fibonacci numbers, where every quotient is 1 and no step does better than the bound; that is Lamé's
theorem, textbook rather than something to derive on a board.

**★ Someone proposes computing the gcd by looping down from `Math.min(a, b)` and testing each
candidate. What is wrong with it?**
Nothing is wrong with its correctness — the first common divisor found from the top is the greatest
one. It is `Θ(min(a, b))` where Euclid is `Θ(log min(a, b))`, which is the difference between linear
in the *value* and linear in the *number of digits* of the value. That distinction —
pseudo-polynomial in the magnitude versus polynomial in the input size — is the same one that makes
trial-division primality fine for an interview and useless for cryptography, and naming it is a
better answer than "it's slower", because it says *in what*.

**★ Is the recursive gcd a stack-overflow risk?**
No, and the reason is the step bound rather than any property of recursion: the depth is
`Θ(log min(a, b))`, so on machine integers it is a few tens of frames at worst, and on
arbitrary-precision inputs it grows with the number of *digits*, not with the value. It is also
perfectly tail-recursive, though no production JavaScript engine eliminates the frame — the gap
between what the specification permits and what engines do is
[Phase 1 · Tail calls, and the explicit stack](../phase-1-complexity/04b-tail-calls-and-the-explicit-stack.md).
Ship the iterative form regardless: it costs nothing and removes the question.

**Why is `gcd(0, 0)` defined as 0 rather than left undefined or set to 1?**
Because every integer divides zero, so the common divisors of `(0, 0)` are all the integers and
there is no greatest one — the definition has to be supplied rather than derived. Zero is chosen so
that `gcd` stays a total function, so that the identity `gcd(a, 0) = a` holds with no special case,
and because it makes `gcd` the meet operation on the divisibility lattice with 0 as the top element.
In code it matters for exactly one reason: it is the single input for which a caller that divides by
the gcd will divide by zero. The JDK encodes the same convention explicitly — `BigInteger.gcd` is
documented to *"return 0 if `this == 0 && val == 0`"* — which is a useful thing to be able to cite
when someone insists the answer should be 1.

**Does the order of the arguments matter?**
No, and the reason is worth being able to say: if `a < b`, the first step computes `a mod b = a` and
the pair becomes `(b, a)`, so the algorithm sorts them itself at a cost of one extra division. An
explicit swap is not a correctness fix, it is a micro-optimisation of one iteration, and it is a
common source of the bug where the swap is written inside the loop instead of before it.

---

← Prev: [02i · Binary search as degenerate D&C](02i-binary-search-as-degenerate-divide-and-conquer.md) · Index: [Phase 2 — Recursion, maths and bits](README.md) · Next → [03b · gcd on signed and wide types](03b-gcd-on-signed-and-wide-types.md)
