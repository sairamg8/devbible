---
title: "Raising the matrix costs Θ(k³ log n) because each of the log n squarings is a triple loop — and the modulus is not a formatting detail, because the product of two residues near a billion is near 10^18, which a Java long holds only until you add the next one and which a JavaScript number cannot hold at all"
sidebar_label: "12c · The multiply and the modulus"
sidebar_position: 12.2
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-09-08. The multiplication definition, the `Θ(k³)` and `Θ(k³ log n)` counts and the
> identity-as-base-case are **mathematics derived on this page**. The JavaScript exactness limit is
> quoted verbatim from MDN,
> [`Number.MAX_SAFE_INTEGER`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number/MAX_SAFE_INTEGER),
> and the `BigInt` rules from MDN,
> [`BigInt`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/BigInt).
> Java's `int` and `long` bounds and their wrapping behaviour are quoted in
> [05c](05c-javas-int-and-the-checked-arithmetic.md) and
> [05d](05d-the-three-silent-overflows.md) from the JDK 25 javadoc. ⚠️ The loop-order remark is
> stated as **mechanism**; no measurement supports it and none is offered. **No sandbox run.**
> Version spine: **JDK 25 · MDN as fetched 2026-09-07**.

**Two things stand between the construction in [12](12-matrix-exponentiation.md) and a program that
returns the right number: the multiplication, whose cost is the whole complexity story, and the
modulus, which is where the arithmetic quietly stops being exact.** Neither is difficult, and both
are where these solutions fail — the first by being applied to a `k` that makes the cubic
unaffordable, the second by overflowing in a way that neither language reports.

## The multiplication, and its Θ(k³)

```
C[i][j] = Σ over t of A[i][t] · B[t][j]
```

`k²` output cells, `k` multiply-adds each: **`Θ(k³)`**. There is nothing subtle here and the code
should be written from the definition rather than recalled:

```ts
export function multiply(A: number[][], B: number[][]): number[][] {
  const k = A.length;
  const C: number[][] = Array.from({ length: k }, () => new Array<number>(k).fill(0));
  for (let i = 0; i < k; i++) {
    for (let t = 0; t < k; t++) {
      const a = A[i][t];
      if (a === 0) continue;                    // skip a whole inner row for sparse companions
      for (let j = 0; j < k; j++) C[i][j] += a * B[t][j];
    }
  }
  return C;
}
```

```java
static long[][] multiply(long[][] A, long[][] B) {
    int k = A.length;
    long[][] C = new long[k][k];
    for (int i = 0; i < k; i++)
        for (int t = 0; t < k; t++) {
            long a = A[i][t];
            if (a == 0) continue;
            for (int j = 0; j < k; j++) C[i][j] += a * B[t][j];
        }
    return C;
}
```

⚠️ The loop order above is `i, t, j` rather than the textbook `i, j, t`. Both compute the same thing;
the `i, t, j` form walks `B` and `C` along rows in the innermost loop instead of walking `B` down a
column. That is a claim about memory access patterns, stated as **mechanism only** — no measurement
is offered here, and you should not quote a factor for it.

**The `a === 0` skip is not a micro-optimisation for companion matrices, it is most of the work.** A
`k × k` companion matrix has `k` non-zero entries in the top row and `k - 1` in the shifted identity,
so the first squaring skips almost everything. It stops helping after a squaring or two, once the
powers fill in.

## The identity is the base case

`M^0` is the identity — ones on the diagonal, zeros elsewhere — because the identity is what leaves
every vector unchanged, which is what applying a transition zero times does.

```ts
export const identity = (k: number): number[][] =>
  Array.from({ length: k }, (_, i) =>
    Array.from({ length: k }, (_, j) => (i === j ? 1 : 0)));
```

🔴 **Seed the accumulator with the identity, never with `M`.** Seeding with `M` gives you `M^(n+1)`
and it is indistinguishable from the off-by-one in the exponent convention
([12](12-matrix-exponentiation.md)), so the two errors mask each other and a fix to one appears to
break the code.

## The power, by the same squaring schedule as any other exponentiation

Matrix multiplication is associative, so the ordinary binary-exponentiation schedule applies
unchanged: square the base at every step, and multiply the accumulator by the current square
whenever the exponent's bit is set. **Fast exponentiation and the modular inverse**
*(not written yet)* derives why that is correct and why it takes about `log₂ n` squarings; nothing
about the argument depends on the operands being numbers, so it is not re-derived here.

```ts
export function matrixPow(M: number[][], n: number): number[][] {
  let result = identity(M.length);
  let base = M;
  let e = n;
  while (e > 0) {
    if (e % 2 === 1) result = multiply(result, base);
    base = multiply(base, base);
    e = Math.floor(e / 2);
  }
  return result;
}
```

🔴 **`e >>= 1` is wrong here and `e % 2` is right.** The exponent in these problems is routinely
`10^12` or larger, and a JavaScript bitwise operator truncates its operand to 32 bits
([04g](04g-the-32-bit-ceiling-and-what-to-use-instead.md),
[09b](09b-precedence-and-the-32-bit-loop-bound.md)) — so shifting the exponent silently computes a
power of the wrong number with no error. Use `Math.floor(e / 2)` and `e % 2`, or make the exponent a
`BigInt`. In Java, `long e` with `e >>= 1` is fine; with `int e` it is fine up to `2^31 - 1` and not
beyond.

**Total cost: `Θ(k³ log n)`** — about `log₂ n` squarings, plus up to `log₂ n` more multiplications
for the set bits, each `Θ(k³)`. Against the loop's `Θ(n · k)`, the technique wins when `n` is
enormous and `k` is small, and the crossover is not subtle: at `k = 2` and `n = 10^18` it is roughly
sixty multiplications of a 2×2 against `10^18` additions.

## The modulus, and exactly where it overflows

These numbers explode immediately — Fibonacci grows exponentially — so the problem will ask for the
answer modulo a prime ([03l](03l-why-answers-are-taken-modulo-a-large-prime.md)). The modular
multiply is one `%` per accumulation, and *where* you put it is the entire question.

**Java.** With a modulus near `10^9`, each residue is under `10^9` and each product is under
`10^18`. A `long` holds up to `2^63 - 1`, which is about `9.22 × 10^18`, so **one** product fits —
and the sum of ten of them does not.

```java
static long[][] multiplyMod(long[][] A, long[][] B, long MOD) {
    int k = A.length;
    long[][] C = new long[k][k];
    for (int i = 0; i < k; i++)
        for (int t = 0; t < k; t++) {
            long a = A[i][t] % MOD;
            if (a == 0) continue;
            for (int j = 0; j < k; j++)
                C[i][j] = (C[i][j] + a * B[t][j]) % MOD;    // reduce on EVERY accumulation
        }
    return C;
}
```

🔴 **The `%` must be inside the innermost loop.** Moving it outside — accumulating the whole dot
product and reducing once — is the classic optimisation and it is wrong for `k` above about nine, in
a way that produces plausible wrong answers rather than an exception, because Java's `long`
arithmetic wraps silently ([05d](05d-the-three-silent-overflows.md)). If the modulus is small enough
that `k · MOD²` fits in a `long`, the outer reduction is legitimate — but then *say* that bound out
loud, because it is a claim about the input, not about the code.

An `int` matrix is simply wrong here: `a * b` with two `int` operands is computed as an `int` and
wraps before any widening happens ([05c](05c-javas-int-and-the-checked-arithmetic.md),
[05f](05f-the-cross-language-trap.md)). Declare the matrix `long[][]`.

**JavaScript.** The same product is fatal for a different reason. MDN:

> *"Double precision floating point format only has 52 bits to represent the mantissa, so it can only safely represent integers between -(2^53 – 1) and 2^53 – 1. 'Safe' in this context refers to the ability to represent integers exactly and to compare them correctly."*

`2^53 - 1` is 9,007,199,254,740,991 — about `9 × 10^15`, which is a **thousand times smaller** than
the `10^18` product. So a modular matrix multiply with a `10^9` modulus is inexact in a plain
`number` from the very first multiplication, with no exception, no `NaN` and no warning. MDN's own
advice:

> *"For larger integers, consider using `BigInt`."*

> *"Only use a BigInt value when values greater than 2^53 are reasonably expected."*

which is exactly this case.

```ts
export function multiplyMod(A: bigint[][], B: bigint[][], MOD: bigint): bigint[][] {
  const k = A.length;
  const C: bigint[][] = Array.from({ length: k }, () => new Array<bigint>(k).fill(0n));
  for (let i = 0; i < k; i++) {
    for (let t = 0; t < k; t++) {
      const a = A[i][t] % MOD;
      if (a === 0n) continue;
      for (let j = 0; j < k; j++) C[i][j] = (C[i][j] + a * B[t][j]) % MOD;
    }
  }
  return C;
}
```

Every literal carries the `n` suffix, because MDN is explicit that the types do not mix:

> *"A BigInt value cannot be used with methods in the built-in `Math` object and cannot be mixed with a Number value in operations; they must be coerced to the same type."*

⚠️ **No performance claim is made or available.** The mechanism is enough: arbitrary precision is not
a register operation ([05b](05b-bigint-and-when-to-reach-for-it.md)). The alternative, if `BigInt`
is unacceptable, is a modulus small enough that `k · MOD²` stays under `2^53 - 1` — with `k = 2` that
allows a modulus up to roughly `6.7 × 10^7`, which is a real constraint on the problem rather than a
free choice.

## When many queries share one matrix

If you must answer `q` queries `F(n₁), F(n₂), …` for the same recurrence, do not run the power from
scratch each time. Precompute `M^(2^0), M^(2^1), …, M^(2^b)` once — `b ≈ log₂(max n)` squarings — and
answer each query by multiplying together the powers named by its exponent's set bits. That is
`Θ(k³ log n)` once plus `Θ(k³ log n)` per query in the worst case, but with the squarings shared, and
it is the same binary-lifting table that appears in tree ancestor queries.

**Strassen's algorithm** multiplies in about `Θ(k^2.81)` and is worth naming if asked about the
cubic bound, along with the honest follow-up: for the `k` values this technique is used at — two,
three, maybe six — the asymptotic improvement is irrelevant and the constant is worse. It is never
the answer to an interview question about a linear recurrence.

## Gotchas

**★ Symptom: the modular answer is wrong for a recurrence with many terms but right for Fibonacci.**
Cause: the `%` was hoisted out of the innermost loop, so `k` products each near `10^18` were summed
in a `long` before reduction, and the sum wrapped past `2^63 - 1`. Fix: reduce on every accumulation.
If you want the hoisted version, prove `k · MOD² < 2^63` first and write the bound in a comment.

**★ Symptom: a JavaScript modular matrix power returns numbers that are close but wrong.** Cause:
the products exceed `2^53 - 1`, so the `number` results are rounded rather than exact — MDN is
explicit that only integers up to `2^53 - 1` are represented exactly. Fix: `BigInt` throughout, or a
modulus small enough that `k · MOD²` stays inside the safe range. There is no third option and
nothing reports the error.

**★ Symptom: the exponent loop terminates far too early and returns a wrong power.** Cause: `e >>= 1`
on an exponent above `2^31 - 1` — a JavaScript bitwise operator truncated it to 32 bits. Fix:
`e = Math.floor(e / 2)` with `e % 2` for the bit test, or a `BigInt` exponent. In Java use `long`,
and note that `>>>` on a `long` is fine while `int` silently caps the usable exponent.

**★ Symptom: every result is one application of `M` too many.** Cause: the accumulator was seeded
with `M` instead of the identity. Fix: seed with the identity, which is the correct value of `M^0`.
This error is dangerous specifically because it looks identical to the exponent off-by-one from
[12](12-matrix-exponentiation.md), so fixing one while the other is present appears to break the
code.

**★ Symptom: a Java implementation overflows even though every value is small.** Cause: the matrix
was declared `int[][]`, so `a * b` is evaluated as `int` and wraps before it is widened to whatever
it is assigned to ([05c](05c-javas-int-and-the-checked-arithmetic.md)). Fix: `long[][]`, and cast
operands explicitly if any `int` survives in the expression.

**Symptom: the result matrix accumulates values from a previous call.** Cause: a reused scratch
buffer was not zeroed, or `multiply` wrote into one of its own inputs. Fix: allocate the output
fresh, or zero it explicitly; **never write the product into `A` or `B`** — a matrix multiply is not
safe in place, because a cell of `C` depends on cells of `A` and `B` that later cells still need.

**Symptom: the modulus is applied to the final matrix only.** Cause: reducing at the end rather than
throughout. Fix: the intermediate powers are the problem — `M^(2^40)` has entries far past any
integer type long before the last multiplication. Reduce inside the multiply.

**Symptom: a negative entry appears in a modular result.** Cause: a recurrence with negative
coefficients, and `%` in both languages is a *remainder* that keeps the dividend's sign
([03j](03j-modular-arithmetic-and-the-remainder-trap.md)). Fix: normalise with `((x % MOD) + MOD) %
MOD`, or `Math.floorMod` in Java, at every place a value could go negative.

## Interview questions

**★ What does raising the matrix cost, and where does the log come from?**
`Θ(k³ log n)`. Each multiplication is `k²` output cells with `k` multiply-adds each, so `Θ(k³)`, and
the exponentiation performs about `log₂ n` squarings plus one extra multiplication per set bit of the
exponent — the same binary schedule as any other fast exponentiation, valid here because matrix
multiplication is associative. Compare it against the plain loop's `Θ(n · k)` and the trade is
obvious in both directions: enormous `n` and small `k` favours the matrix; a `k` of a hundred means
`10^6` per multiply and the loop is probably better unless `n` is astronomical.

**★ You are asked for the answer modulo `10^9 + 7`. What breaks?**
The product, in both languages, for different reasons. In Java each residue is under `10^9` so each
product is under `10^18`, which a `long` holds — but a dot product sums `k` of them, and ten such
products exceed `2^63 - 1`, so the `%` has to be inside the innermost accumulation rather than
hoisted out of it. In JavaScript it is worse: MDN says a `number` represents integers exactly only up
to `2^53 - 1`, about `9 × 10^15`, so a single `10^18` product is already inexact — silently, with no
exception. The answer there is `BigInt`, or a modulus small enough that `k · MOD²` fits in the safe
range.

**★ Why must the accumulator start as the identity?**
Because the identity is `M^0`, and the exponentiation loop's invariant is "`result` holds `M` to the
power of the exponent bits processed so far" — which is zero bits at the start. Seeding with `M`
gives an answer one application too far. It is worth naming because it collides with the other
off-by-one in this technique, the choice between `M^(n-1)·v(1)` and `M^n·v(0)`, and two off-by-ones
in opposite directions look like a working program on exactly one input.

**★ Can you multiply the matrices in place to save memory?**
No. Every cell of the product depends on a whole row of `A` and a whole column of `B`, and later
cells still need the original values, so writing into either operand corrupts the rest of the
computation. The memory is `Θ(k²)` per matrix and `k` is small in every problem where this technique
applies, so there is nothing to save. What you *can* do is reuse two preallocated buffers across the
`log n` multiplications and swap them, which avoids repeated allocation without ever writing into an
operand of the multiply currently running.

**How would you answer a thousand queries on the same recurrence?**
Precompute the binary-lifting table: `M^(2^0)` through `M^(2^b)` for `b ≈ log₂(max n)`, which costs
`b` squarings once. Each query then multiplies together the stored powers named by the set bits of
its exponent, so the squarings — the bulk of the work — are shared across all queries instead of
repeated. It is the same structure as a level-ancestor table on a tree, and recognising that the two
are the same idea is usually what the question is after.

{/* FOOTER */}
