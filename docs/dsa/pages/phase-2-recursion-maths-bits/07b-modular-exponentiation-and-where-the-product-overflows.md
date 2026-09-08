---
title: "The modular form of binary exponentiation is one extra % per multiply, and the trap is the multiply itself — the product of two residues near a billion is near 10^18, which a Java long holds, a Java int wraps silently, and a JavaScript number rounds silently with no error at all"
sidebar_label: "07b · Modular exponentiation and overflow"
sidebar_position: 7.1
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-08 against
> [MDN's `Number.MAX_SAFE_INTEGER`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number/MAX_SAFE_INTEGER),
> [MDN's `BigInt` page](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/BigInt),
> the **JDK 25**
> [`java.lang.Math`](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/lang/Math.html)
> javadoc (`multiplyExact`) and the **JDK 25**
> [`java.math.BigInteger`](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/math/BigInteger.html)
> javadoc (`modPow`) — all quoted verbatim below. Every numeric bound is arithmetic performed in the
> text. **No sandbox run.**

**The modular version of [07](07-fast-exponentiation-and-the-modular-inverse.md) is a one-character
change — `%` after each multiply — and the reason it is a separate page is that the multiply itself
is where every language-level failure in this topic lives.** Reducing after each step is what keeps
the operands below the modulus, but the *product formed before the reduction* is up to `M²`. With
the conventional `M = 10^9 + 7` that is about `10^18`. A Java `long` holds it with room to spare. A
Java `int` wraps to something unrelated and does not say so. And a JavaScript `number` — which is a
double — rounds it, silently, with no exception, producing an answer that is *close* to correct and
therefore much harder to notice than a wrap. This page is the modular loop in both languages and the exact
boundary in each; [07c](07c-an-exact-modular-multiply-in-javascript.md) is the three things you can
do about the JavaScript one, [07d](07d-the-modular-inverse.md) is the inverse this machinery makes
possible, and [07e](07e-binomial-coefficients-under-a-modulus.md) is its main consumer.

## The modular loop

```java
// Java — long throughout, deliberately. mod must be positive.
static long powMod(long base, long exp, long mod) {
    if (mod <= 0) throw new IllegalArgumentException("mod must be positive");
    if (mod == 1L) return 0L;                       // ✅ everything is congruent to 0 modulo 1
    long result = 1L;
    long b = Math.floorMod(base, mod);              // ✅ normalise a possibly negative base — see 03k
    long e = exp;
    while (e > 0) {
        if ((e & 1L) == 1L) result = result * b % mod;
        b = b * b % mod;                            // ✅ reduce EVERY multiply, not just the last
        e >>= 1;
    }
    return result;
}
```

Every multiplication is followed by a reduction, so both operands of the next multiplication are
below `mod` — that is the invariant, and it is the whole reason the routine is computable. Reducing
only at the end is not slower-but-correct; `b` squares each iteration, so after twenty steps it is
`a^(2^20)`, which is not a number any fixed-width type is going to hold.

The `mod == 1` guard is not decoration: modulo 1 every integer is congruent to 0, so the correct
answer is `0` and the loop's initialised `result = 1` would return `1`.

## Java: where it overflows

`long` holds up to `2^63 − 1 ≈ 9.22 × 10^18`, and `(10^9 + 6)² ≈ 10^18`, so the conventional modulus
has an order of magnitude of headroom. Two things still go wrong.

**An `int` multiply assigned to a `long`.** The multiplication happens in `int` and the wrapped
result is *then* widened. The cast has to be on an operand:

```java
int a = 1_000_000_006, b = 1_000_000_006;
long wrong = a * b;                 // ⛔ computed in int, wraps, then widens the wrong value
long right = (long) a * b;          // ✅ one operand widened first; the multiply happens in long
```

That `*` wraps rather than throwing is documented by the existence of its checked counterpart:

> *"Returns the product of the arguments, throwing an exception if the result overflows an `int`."*
> — JDK 25, `Math.multiplyExact(int, int)`; Throws: *"`ArithmeticException` - if the result
> overflows an int"*

If you want the wrap to be loud during development, `Math.multiplyExact(a, b)` is the opt-in.

**A modulus above about `3 × 10^9`.** The constraint is `M² ≤ 2^63 − 1`, so
`M ≤ √(9.22 × 10^18) ≈ 3.04 × 10^9`. Above that, even `long` wraps and the routine needs
`BigInteger` — which ships the whole thing:

> *"Returns a BigInteger whose value is `(this`ˣᵖᵒⁿᵉⁿᵗ `mod m)`. (Unlike `pow`, this method permits
> negative exponents.)"* — Throws: *"`ArithmeticException` - `m` ≤ 0 or the exponent is negative and
> this BigInteger is not relatively prime to `m`."* — JDK 25, `BigInteger.modPow`

That "permits negative exponents" clause is worth reading twice: `modPow` with exponent `-1` is a
modular inverse, and the documented exception condition — negative exponent on a value not
relatively prime to `m` — is precisely the condition under which no inverse exists. See
[07d](07d-the-modular-inverse.md).

## 🔴 JavaScript: where it stops being exact, and why nothing tells you

A JavaScript `number` is a double, and MDN is unambiguous about the integer range:

> *"The `Number.MAX_SAFE_INTEGER` static data property represents the maximum safe integer in
> JavaScript (2^53 – 1)."* — value *"9007199254740991"* — MDN

> *"Double precision floating point format only has 52 bits to represent the mantissa, so it can
> only safely represent integers between -(2^53 – 1) and 2^53 – 1. 'Safe' in this context refers to
> the ability to represent integers exactly and to compare them correctly."* — MDN

`2^53 − 1` is about `9.01 × 10^15`. The product of two residues below `10^9 + 7` reaches about
`10^18` — **roughly a hundred times larger**. So `result * b` in a naive port of the Java loop is not
computed; it is *approximated*, and `% mod` of an approximation is an arbitrary number in the right
range. MDN's own illustration of what "not safe" means:

> *"For example, `Number.MAX_SAFE_INTEGER + 1 === Number.MAX_SAFE_INTEGER + 2` will evaluate to
> true, which is mathematically incorrect."* — MDN

No exception, no `NaN`, no `Infinity` — just a wrong digit somewhere in the middle. This is the most
expensive trap in this phase, because the answer is plausible. There are three ways out —
`BigInt`, a smaller modulus, or a `mulmod` that never forms the big product — and they are
[07c · An exact modular multiply in JavaScript](07c-an-exact-modular-multiply-in-javascript.md).

## Gotchas

**★ Symptom: in TypeScript, a modular power is wrong and the wrong value looks reasonable.** Cause:
`result * b` with both operands near `10^9` produces about `10^18`, which is roughly a hundred times
past `2^53 − 1`, so it is rounded rather than computed. Nothing throws. Fix: `BigInt`, a modulus
below `94906265`, or a `mulmod` that never forms the product — all three in
[07c](07c-an-exact-modular-multiply-in-javascript.md). ⚠️ The
distinguishing symptom against Java's failure is that JavaScript's answer is *close*: a wrap
produces something unrelated, a rounding produces something almost right.

**★ Symptom: in Java, `long product = a * b;` with `int a, b` gives a negative or tiny number.**
Cause: the multiplication is performed in `int` and the already-wrapped result is widened. Fix: cast
an *operand*, not the product — `(long) a * b`. That `*` wraps silently rather than throwing is what
the existence of `Math.multiplyExact` documents; use it when you want the failure to be loud.

**★ Symptom: reducing only at the end of the loop, and everything overflows.** Cause: treating `%`
as output formatting. The squaring `b = b * b` doubles the exponent each iteration, so after twenty
iterations `b` is `a^(2^20)` — nothing holds that. Fix: reduce after *every* multiplication. The
[ring property](03j-modular-arithmetic-and-the-remainder-trap.md) is exactly the licence to do so
without changing the answer.

**★ Symptom: `powMod(a, e, 1)` returns `1`.** Cause: no `mod === 1` guard, and the accumulator is
initialised to the identity. Every integer is congruent to `0` modulo 1, so the answer is `0`. Fix:
`if (mod === 1) return 0;` before the loop. It is the kind of case that only appears when a modulus
is read from input.

**★ Symptom: a negative base produces a negative result.** Cause: the base was not normalised before
the loop, and `%` is a remainder. Fix: `Math.floorMod(base, mod)` in Java, `((base % mod) + mod) % mod`
in TypeScript, once, before the loop — after that every value is a reduced residue and stays
non-negative. See [03k](03k-the-remainder-trap-in-indices-hashes-and-shards.md).

**★ Symptom: a modulus above `3 × 10^9` gives negative results in Java despite everything being
`long`.** Cause: `M² > 2^63 − 1`. Fix: `BigInteger.modPow`, which is documented to compute
`this^exponent mod m` directly and needs no loop from you. There is no `long`-only fix short of
128-bit multiplication techniques.

**Symptom: `Math.pow(a, e) % mod` or `a ** e % mod` is used.** Cause: computing the power first and
reducing afterwards. For any interesting exponent the power is `Infinity` or a rounded double long
before the `%` runs. Fix: the modular loop. Note the operator-precedence hazard too — `a ** e % mod`
parses as `(a ** e) % mod`, which is the wrong thing but at least parses as it reads.

## Interview questions

**★ Where exactly does modular exponentiation overflow, in Java and in JavaScript?**
In the product formed *before* the reduction. Both operands are below the modulus, so the product is
up to `M²`. With `M = 10^9 + 7` that is about `10^18`. A Java `long` tops out just above
`9.22 × 10^18`, so it fits with an order of magnitude to spare — but a Java `int` tops out at
`2^31 − 1`, so an `int` multiply wraps by nine orders of magnitude and does so silently, which is
why every Java modular routine is written over `long`. A JavaScript `number` is a double and MDN
documents its exact-integer range as `2^53 − 1`, about `9.01 × 10^15` — roughly a hundred times
smaller than the product. So JavaScript does not wrap, it *rounds*, with no exception and no
`NaN`; the answer is close to right and therefore much harder to catch.

**★ Why is `long product = a * b;` wrong when `a` and `b` are `int`?**
Because the multiplication is performed in `int` — the type of the expression is determined by the
operands, not by the assignment target — so it wraps first and the wrapped value is then widened.
The fix is to widen an operand: `(long) a * b`. `(long)(a * b)` does not help for the same reason.
And Java's `*` never signals the overflow: the reason `Math.multiplyExact` exists, with a javadoc
that says it throws *"if the result overflows an `int`"*, is precisely that plain `*` does not.

**★ Why must the reduction happen after every multiply rather than at the end?**
Because the squaring step doubles the exponent every iteration: after `k` iterations the running base
is `a^(2^k)`, and no fixed-width type holds that for `k` past a handful. Reducing at every step keeps
both operands below the modulus, so the largest value ever formed is `M²`, which is the bound the
whole design is built around. The licence to reduce whenever you like is the ring property —
addition, subtraction and multiplication are well defined on residue classes — so the reductions
cost nothing in correctness and are the only thing making the computation possible.

**Does Java give you this for free?**
Yes, for `BigInteger`: `modPow` is documented to return `this^exponent mod m`, and — unusually — to
permit negative exponents, with an `ArithmeticException` when the exponent is negative and the base
is not relatively prime to `m`. That is a modular inverse in disguise, since exponent `-1` is exactly
the inverse and the documented exception condition is exactly the condition under which no inverse
exists. There is no primitive-typed equivalent in the JDK, so for `long` arithmetic you write the
loop.

---

← Prev: [07 · Binary exponentiation](07-fast-exponentiation-and-the-modular-inverse.md) · Index: [Phase 2 — Recursion, maths and bits](README.md) · Next → [07c · An exact modular multiply in JS](07c-an-exact-modular-multiply-in-javascript.md)
