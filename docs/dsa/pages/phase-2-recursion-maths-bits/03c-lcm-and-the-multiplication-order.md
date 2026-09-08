---
title: "lcm is gcd with one division, and the division has to happen before the multiplication — a / g * b computes the same value as a * b / g and overflows on inputs whose answer fits comfortably in the type, which Java's * will not tell you about"
sidebar_label: "03c · lcm and the multiplication order"
sidebar_position: 3.2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-08 against the **JDK 25** API documentation for
> [`java.lang.Math`](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/lang/Math.html)
> — `multiplyExact` quoted verbatim below, including its documented `ArithmeticException`. The
> identity `gcd(a, b) · lcm(a, b) = a · b` and its proof from unique factorisation are **textbook
> mathematics, derived on this page rather than cited.** **No sandbox run** — this page carries
> code, never program output.

**`lcm` is the shortest function on this topic and the one most likely to be wrong in production,
because the bug is in the order of two operators rather than in the formula.** `lcm(a, b)` is
`a · b / gcd(a, b)`, and writing it in that order computes an intermediate that can be
astronomically larger than the answer: with `a = b = 2^30` the lcm is `2^30`, an unremarkable `int`,
while `a * b` is `2^60`. Java's `*` wraps silently — the existence of `Math.multiplyExact` is the
documentation of that silence — and JavaScript's `*` does something quieter still, rounding past
`2^53 − 1` with no error at all. Dividing first is not a micro-optimisation; it is the difference
between a function that is correct whenever its answer is representable and one that is not. This
page proves the identity, fixes the order, and then handles the case that actually shows up — the
fold of `lcm` across a list, where the accumulator outgrows the type several elements before the
final answer would.

## `lcm`, and the only correct multiplication order

From unique factorisation: for each prime `p`, the exponent of `p` in `gcd(a, b)` is
`min(eₐ, e_b)` and in `lcm(a, b)` is `max(eₐ, e_b)`, and `min(x, y) + max(x, y) = x + y`. Multiply
over all primes:

```
gcd(a, b) · lcm(a, b) = a · b        (for a, b > 0)
```

So `lcm(a, b) = a · b / gcd(a, b)`. **Never write it in that order.** Write it as:

```ts
export function lcm(a: number, b: number): number {
  const g = gcd(a, b);
  if (g === 0) return 0;              // lcm(0, 0) — guard, or you divide by zero
  return Math.abs(a / g * b);         // ✅ divide first: a / g is exact, and the product is the answer
}
```

The reason is not style. `g` divides `a` exactly, so `a / g` is an integer with no rounding; the
product `(a / g) · b` **is** the lcm, so if the answer fits in the type, the computation fits in the
type. Written `a * b / g`, the intermediate `a · b` can be enormously larger than the answer. Take
`a = b = 2^30`. Then `gcd = 2^30`, and `lcm = 2^30`, which is a perfectly ordinary `int` — but
`a * b` is `2^60`, which is not, and Java's `*` does not tell you:

> *"Returns the product of the arguments, throwing an exception if the result overflows an `int`."*
> — JDK 25, `Math.multiplyExact(int, int)`; Throws: *"`ArithmeticException` - if the result
> overflows an int"*

That javadoc sentence is the proof that plain `*` does **not** throw: the entire reason
`multiplyExact` exists is that `*` wraps in silence. So in Java:

```java
static long lcm(long a, long b) {
    long g = gcd(a, b);
    if (g == 0L) return 0L;
    return Math.abs(a / g * b);              // ✅ divide first
    // return Math.abs(a * b / g);           // ⛔ a * b overflows for inputs whose lcm fits
}

// If you want the overflow to be loud rather than wrong, opt in:
static long lcmChecked(long a, long b) {
    long g = gcd(a, b);
    if (g == 0L) return 0L;
    return Math.abs(Math.multiplyExact(a / g, b));   // throws ArithmeticException instead of wrapping
}
```

In TypeScript there is no wrap and no exception: a product past `2^53 − 1` is silently *rounded*,
which is a different and quieter failure. [03j · Modular arithmetic and the remainder trap](03j-modular-arithmetic-and-the-remainder-trap.md) covers that boundary where it matters most;
the general case is **05 · Integer limits and overflow** *(not written yet)*.

## `lcm` over a list

Folding `lcm` across an array is the standard "when do all these cycles line up" question — in the
storefront, the period at which three recurring-order schedules (every 4, 6 and 10 days) coincide.
The fold is right, but note that **each pairwise result is the input to the next step**, so the
running value grows fast and can overflow long before the final answer would:

```ts
// TypeScript — lcm of a list, with the guard that says "the answer left the safe range"
export function lcmAll(xs: number[]): number {
  let acc = 1;
  for (const x of xs) {
    acc = lcm(acc, x);
    if (!Number.isSafeInteger(acc)) throw new RangeError("lcm exceeded Number.MAX_SAFE_INTEGER");
  }
  return acc;
}
```

```java
// Java — same fold; multiplyExact turns the wrap into an exception at the exact step it happens
static long lcmAll(long[] xs) {
    long acc = 1L;
    for (long x : xs) {
        long g = gcd(acc, x);
        acc = Math.multiplyExact(acc / g, x);
    }
    return acc;
}
```

The lcm of the numbers `1..n` grows exponentially in `n` (it is `e^{n(1+o(1))}` — textbook, and the
reason "lcm of 1 to 50" is a `BigInteger` question, not a `long` question). If the problem says
"report the answer modulo 10^9+7", the modular route is *not* to compute the lcm and reduce it — you
cannot reduce and then divide. Factorise instead and take the max exponent per prime, then multiply
the prime powers under the modulus. That is [03h · Factorisation and smallest prime factors](03h-factorisation-and-smallest-prime-factors.md) and [03j · Modular arithmetic and the remainder trap](03j-modular-arithmetic-and-the-remainder-trap.md) territory.

## Gotchas

**★ Symptom: `lcm` returns a wrong or negative value in Java on inputs whose lcm obviously fits in
the type.** Cause: `a * b` was evaluated first and wrapped. `*` in Java does not throw on overflow —
that is precisely what the existence of `Math.multiplyExact` documents — so the wrapped product is
divided by the gcd and produces a plausible-looking wrong number. Fix: divide first, so the only
multiplication performed is the one that produces the answer itself:

```java
static long lcm(long a, long b) {
    long g = gcd(a, b);
    if (g == 0L) return 0L;
    return Math.abs(a / g * b);                        // ✅
    // return Math.abs(a * b / g);                     // ⛔ overflows before the division runs
}
```

**★ Symptom: the same function in TypeScript returns a number that is merely slightly wrong.**
Cause: JavaScript does not wrap, it rounds — a product past `2^53 − 1` is representable only
approximately, so `a * b / g` comes back close to the answer and unequal to it. There is no
exception and no negative value to notice. Fix: divide first, and gate the result:
`if (!Number.isSafeInteger(result)) throw new RangeError(…)`. The rounding boundary itself is
[03j · Modular arithmetic and the remainder trap](03j-modular-arithmetic-and-the-remainder-trap.md)
and **05 · Integer limits and overflow** *(not written yet)*.

**★ Symptom: `lcm(0, 0)` throws, returns `NaN`, or returns `Infinity`.** Cause: `gcd(0, 0)` is `0`
by convention and the formula divides by it. Fix: guard, and decide the degenerate answer
deliberately rather than letting a division define it:

```ts
const g = gcd(a, b);
if (g === 0) return 0;      // ✅ lcm(0, 0) is defined as 0 here, on purpose
```

Note that `lcm(0, n)` for `n ≠ 0` is `0` and needs no guard: `gcd(0, n)` is `n`, and `0 / n * n` is
`0`. That is also the mathematically right answer — zero is a multiple of everything.

**★ Symptom: folding `lcm` over a list produces a plausible small number.** Cause: an intermediate
wrapped (Java) or was rounded (TypeScript) several elements before the end, and every subsequent
step was computed from the corrupted accumulator, so the final value is not merely imprecise, it is
unrelated. Fix: make the failure loud at the step where it happens — `Math.multiplyExact` in Java,
`Number.isSafeInteger` in TypeScript — or move the accumulator to `BigInteger` / `BigInt`, because
the lcm of `1..n` grows exponentially in `n` and no fixed-width type is going to hold it for long.

**★ Symptom: "report the lcm modulo 10^9+7" is answered by computing the lcm and reducing it.**
Cause: the lcm is computed with a division, and division does not survive reduction — you cannot
reduce `a` and `b` modulo `p`, divide by a gcd computed from the reduced values, and get anything
meaningful, because the gcd of the residues has nothing to do with the gcd of the originals. Fix:
factorise instead, take the maximum exponent of each prime across the inputs, and multiply the
prime powers together under the modulus with modular exponentiation. That is
[03h · Factorisation and smallest prime factors](03h-factorisation-and-smallest-prime-factors.md) for the exponents and
[07 · Binary exponentiation](07-fast-exponentiation-and-the-modular-inverse.md) for the powers.

**Symptom: `Math.abs` around the result does not make a negative `lcm` positive.** Cause: the
negative came from an overflow rather than from a negative input, and negating a wrapped value gives
another wrapped value, not the right answer. Fix: `Math.abs` belongs on the *inputs* (or on the
result of a correct computation over non-negative inputs); a negative result from non-negative
inputs is an overflow report, not a sign problem, and should propagate as an exception.

**Symptom: an `lcm` over `int` in Java is "made safe" by casting the result to `long`.** Cause:
`(long)(a * b / g)` performs the whole computation in `int` and widens the already-wrong answer.
Fix: widen the *operands*, before the arithmetic — `(long) a / g * b`, or declare the parameters
`long` so the widening happens at the call site.

## Interview questions

**★ Why do you write `lcm` as `a / g * b` rather than `a * b / g`?**
Because `g` divides `a` exactly, so `a / g` is an exact integer with no rounding, and `(a / g) * b`
**is** the lcm — meaning that if the answer fits in the type, the computation fits in the type. The
other order computes an intermediate, `a * b`, that can be vastly larger than the answer: with
`a = b = 2^30` the lcm is `2^30` and the intermediate is `2^60`. In Java the intermediate wraps
silently, which is exactly what the existence of `Math.multiplyExact` documents — its javadoc says
it throws *"if the result overflows an `int`"*, and the reason that method exists is that `*` does
not. In JavaScript nothing wraps and nothing throws; the product is simply rounded once it passes
`2^53 − 1`, which is a quieter failure and harder to spot.

**★ Why is `gcd(a, b) · lcm(a, b) = a · b`?**
By unique factorisation. Write each of `a` and `b` as a product of prime powers. For each prime `p`,
its exponent in the gcd is `min(eₐ, e_b)` — the gcd is the largest number dividing both, so it takes
as many copies of `p` as the poorer of the two has — and its exponent in the lcm is `max(eₐ, e_b)`,
for the mirror-image reason. Since `min(x, y) + max(x, y) = x + y` for any two numbers, the exponent
of `p` in `gcd · lcm` equals its exponent in `a · b`, for every prime. Two positive integers with
the same exponent on every prime are equal. The identity needs `a, b > 0`; with signs in play it
holds up to absolute value.

**★ How do you compute the lcm of a list, and what goes wrong?**
Fold: `acc = lcm(acc, x)` starting from 1. What goes wrong is that each pairwise result feeds the
next step, so the accumulator grows monotonically and can leave the type well before the final
answer would — and once it has, every later step is computed from a corrupted value, so the result
is not approximately right, it is unrelated. The lcm of `1..n` grows exponentially in `n`, so this
is not an edge case. The defence is to make the step loud rather than to hope: `Math.multiplyExact`
on each multiplication in Java, `Number.isSafeInteger` after each step in TypeScript, or move to
`BigInteger` / `BigInt` if the problem genuinely needs the range.

**★ The problem says "print the lcm modulo 10^9+7". What is the trap?**
That you cannot reduce first and then divide. The lcm formula divides by the gcd, and the gcd of two
residues bears no relation to the gcd of the two original numbers, so `lcm(a % p, b % p)` is
meaningless. Reducing *after* computing the lcm is correct but useless, because the whole reason the
problem asks for a modulus is that the lcm does not fit. The right route is to avoid the division
entirely: factorise each input, take for each prime the maximum exponent across all inputs, and
multiply the resulting prime powers together under the modulus using modular exponentiation. Every
operation there is a multiplication, and multiplication does distribute over the modulus.

**Where does `lcm` actually appear in an application, as opposed to a puzzle?**
Anywhere two independent cycles have to be reasoned about together. In a storefront: three recurring
subscription schedules that fire every 4, 6 and 10 days coincide every `lcm(4, 6, 10) = 60` days,
which is the window a "will these ever collide" alert has to look at. Rotating a set of N shards
across M replicas repeats after `lcm(N, M)` steps. A retry backoff and a cache TTL that are both
periodic resynchronise at their lcm, which is the period at which a thundering herd re-forms. The
reason it is worth recognising is that the naive answer — simulate until they line up — is
`Θ(lcm)` where the formula is `Θ(log min)`.

**Is `lcm(0, n)` zero or undefined?**
Zero, and it needs no special case in a correctly-ordered implementation: `gcd(0, n)` is `n`, so
`0 / n * n` is `0`. It is also the right answer mathematically — zero is a multiple of every
integer, and it is the least such common multiple under the divisibility ordering. The only input
that genuinely needs a guard is `lcm(0, 0)`, because `gcd(0, 0)` is `0` and the formula would divide
by it.

{/* FOOTER */}
