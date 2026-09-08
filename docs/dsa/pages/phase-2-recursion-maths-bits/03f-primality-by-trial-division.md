---
title: "Trial division to the square root is four lines with four boundary bugs in them — one is off by one and reports every square of a prime as prime, one overflows an int exactly at 46341 and keeps looping past the bound it was supposed to stop at, and the other two are 1 and 2"
sidebar_label: "03f · Primality by trial division"
sidebar_position: 3.5
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-08. The `√n` bound, the `6k ± 1` wheel and the complexity argument are
> **textbook mathematics, derived on this page rather than cited.** The language facts are
> primary-sourced: the **JDK 25**
> [`java.lang.Integer`](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/lang/Integer.html)
> javadoc (`MAX_VALUE`) and
> [MDN's `Number.MAX_SAFE_INTEGER`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number/MAX_SAFE_INTEGER)
> (the IEEE 754 double mantissa), both quoted verbatim below. ⚠️ Deterministic witness sets for
> Miller–Rabin are **named but not stated** here; no source for a specific set was consulted.
> **No sandbox run.**

**"Is `n` prime" is the shortest interview question with the highest bug density, because the
algorithm is one loop and the loop has four boundaries.** The mathematics takes one line: if `n`
factors as `a·b` with `1 < a ≤ b`, then `a ≤ √n`, so a composite must have a divisor at or below its
square root and testing up to `√n` is sufficient. Everything after that line is edge cases — the
comparison that must be `≤` rather than `<` or every square of a prime is reported prime; the
product `i * i` that overflows an `int` at exactly `i = 46341` and makes the loop condition
*true* when it should be false; the value `1`, which the loop happily reports as prime because it
never runs; and the value `2`, which the "skip even numbers" optimisation eliminates on its way to
being an optimisation. This page derives the bound, writes the loop correctly in both languages, and
then walks each boundary, because the boundaries are what is actually being tested.

## Why `√n` is enough

Suppose `n > 1` is composite, so `n = a · b` with `1 < a ≤ b < n`. Then `a² ≤ a·b = n`, so
`a ≤ √n`. In words: **the smaller of any pair of factors is at most the square root**, so if no
divisor exists at or below `√n`, none exists at all. The contrapositive is the algorithm: test every
candidate from 2 up to `√n`; if none divides `n`, it is prime.

Notice that the argument gives `a ≤ √n`, not `a < √n`. The case `a = b = √n` — a perfect square of a
prime — is the boundary, and it is the reason the comparison must be inclusive. `25 = 5 · 5` has no
divisor strictly below its square root.

## The loop

```ts
// TypeScript — trial division. The four boundary decisions are marked.
export function isPrime(n: number): boolean {
  if (!Number.isInteger(n)) throw new TypeError("isPrime expects an integer");
  if (n < 2) return false;                    // ① 1, 0 and negatives are not prime
  if (n < 4) return true;                     // ② 2 and 3 are, and the wheel below assumes it
  if (n % 2 === 0 || n % 3 === 0) return false;
  for (let i = 5; i * i <= n; i += 6) {       // ③ i*i, not Math.sqrt; ④ <=, not <
    if (n % i === 0 || n % (i + 2) === 0) return false;
  }
  return true;
}
```

```java
// Java — same algorithm; note the loop condition, which is NOT i * i <= n. See below.
static boolean isPrime(long n) {
    if (n < 2) return false;
    if (n < 4) return true;
    if (n % 2 == 0 || n % 3 == 0) return false;
    for (long i = 5; i <= n / i; i += 6) {          // ✅ no product, so nothing to overflow
        if (n % i == 0 || n % (i + 2) == 0) return false;
    }
    return true;
}
```

`i <= n / i` is exactly equivalent to `i·i ≤ n` for positive integers — `i ≤ ⌊n/i⌋` holds iff
`i ≤ n/i` as reals iff `i² ≤ n` — and it computes no product at all, so there is nothing to
overflow. It costs one division per iteration instead of one multiplication, which is the right
trade for a function whose entire body is already a division.

## The `6k ± 1` wheel, derived

Every integer is `6k + r` for `r` in `{0, 1, 2, 3, 4, 5}`. The residues `0`, `2` and `4` are even;
the residue `3` gives a multiple of 3. So every prime greater than 3 is congruent to `1` or `5`
modulo 6 — equivalently, is of the form `6k ± 1`. Stepping `i` by 6 and testing `i` and `i + 2`
starting from 5 visits exactly `5, 7, 11, 13, 17, 19, …`, which is every candidate of that form.

That is why the guard `if (n < 4) return true;` and the explicit `n % 2` / `n % 3` tests are not
optional decoration: **the wheel is only valid for `n` that is not itself 2 or 3**, because 2 and 3
are prime and are not of the form `6k ± 1`. The wheel tests two candidates per six integers instead
of six, so it does a third of the work of the naive loop — a constant factor, not a change of
complexity.

## The complexity, and why it is worse than it looks

The loop performs `Θ(√n)` divisions. That is fast for anything an interview will hand you and
useless for anything cryptographic, and the reason is worth being able to say precisely: `√n` is
**exponential in the size of the input**. A number `n` is written in about `b = log₂ n` bits, so
`√n = 2^(b/2)`. Doubling the number of digits squares the running time. An algorithm is
polynomial-time when its cost is polynomial in `b`, not in `n`, and trial division is not — it is
*pseudo-polynomial*, the same distinction
[Phase 1 · Big-O, Θ and Ω](../phase-1-complexity/01-big-o-theta-and-omega.md) draws between the
magnitude of a value and the size of its representation.

There is no recurrence here to solve — the loop is flat — but the contrast is the same one that
[Phase 1 · Recurrences and the master theorem](../phase-1-complexity/08-recurrences-and-the-master-theorem.md)
uses when it distinguishes an input's *value* from an input's *length*.

**When trial division is the wrong tool.** For a 2048-bit modulus it is not slow, it is impossible.
The real algorithm is **Miller–Rabin**, which is probabilistic and polynomial in the bit length, and
which becomes deterministic below a bound if you use a published set of witness bases. ⚠️ I have not
verified a specific witness set or bound here and will not state one from memory — look it up rather
than recall it. In Java, `BigInteger.isProbablePrime(int certainty)` is the shipped implementation
and is what you should reach for; in JavaScript there is no built-in and you write Miller–Rabin over
`BigInt`. Pollard's rho is the companion for *factoring* rather than testing.

**When trial division is the wrong tool for a different reason.** If you need primality for many
numbers in a range rather than for one number, `Θ(√n)` per query is the wrong shape entirely — sieve
the whole range once instead, which is [03g · The sieve of Eratosthenes](03g-the-sieve-of-eratosthenes.md).

## Gotchas

**★ Symptom: `isPrime(1)` returns `true`, and so does `isPrime(0)`.** Cause: the loop body never
executes — `2 * 2 > 1` — so the function falls through to `return true`. Nothing is wrong with the
loop; the guard is missing. Fix: `if (n < 2) return false;` as the first statement. One is not
prime by definition, and the definition is not arbitrary: unique factorisation would fail if 1 were
prime, because `12 = 2²·3 = 1·2²·3 = 1²·2²·3` would be three different factorisations.

**★ Symptom: `isPrime(25)`, `isPrime(49)` and `isPrime(121)` all return `true`.** Cause: the loop
condition is strict — `i < Math.sqrt(n)` or `i * i < n`. For `n = 25` the candidates run 2, 3, 4 and
stop, never testing 5. Every square of a prime is misreported, and nothing else is, which makes the
bug rare enough in random testing to survive. Fix: the comparison is inclusive, because the
factor-pair argument gives `a ≤ √n` with equality exactly at these numbers:

```ts
for (let i = 5; i * i <= n; i += 6) {                  // ✅ <=, and the reason is n = p²
  if (n % i === 0 || n % (i + 2) === 0) return false;
}
```

**★ Symptom: in Java, `isPrime` on a large `int` runs for an extraordinarily long time and then
returns `false` for a number that is prime.** Cause: the loop condition was `i * i <= n` with `i` an
`int`. At `i = 46341` the mathematical product is `2147488281`, and `Integer.MAX_VALUE` is
documented as `2^31-1 = 2147483647`, so the product wraps to `2147488281 − 2^32 = −2147479015`. A
negative value **is** `<= n`, so the condition stays true and the loop continues past the bound it
was written to enforce. It keeps going until `i` itself wraps negative, and `n % -1` is `0` for
every `n`, at which point the function reports a factor that does not exist. Fix: either compare
without forming the product, or widen:

```java
for (long i = 5; i <= n / i; i += 6)      // ✅ no product exists, so nothing wraps
for (int  i = 5; (long) i * i <= n; i += 6)   // ✅ alternative: widen BEFORE multiplying
// for (int i = 5; i * i <= n; i += 6)    // ⛔ wraps at i = 46341
```

Note that `(long)(i * i)` does **not** fix it — the multiplication happens in `int` and the wrapped
result is then widened. The cast must be on an operand, not on the product.

**★ Symptom: `isPrime(2)` returns `false` after the "skip even numbers" optimisation is added.**
Cause: the optimisation begins `if (n % 2 === 0) return false;`, which is true of 2 itself. The same
bug appears one level up in the `6k ± 1` wheel, where 3 is the casualty. Fix: handle the small
primes explicitly *before* the divisibility tests, and make the guard cover every value the wheel
excludes:

```ts
if (n < 2) return false;
if (n < 4) return true;                      // ✅ 2 and 3, which are not of the form 6k ± 1
if (n % 2 === 0 || n % 3 === 0) return false;
```

**★ Symptom: a `long`-based `isPrime` using `i <= Math.sqrt(n)` disagrees with one using `i * i <= n`
for a handful of very large inputs.** Cause: `Math.sqrt` returns a `double`, and a `double` cannot
represent every `long` exactly, so the computed square root can land on the wrong side of an integer
boundary. MDN states the format constraint for the same IEEE 754 double that Java uses:

> *"Double precision floating point format only has 52 bits to represent the mantissa, so it can
> only safely represent integers between -(2^53 – 1) and 2^53 – 1."* — MDN, `Number.MAX_SAFE_INTEGER`

Fix: never put a square root in the loop condition. `i <= n / i` is exact integer arithmetic and
also avoids recomputing `Math.sqrt(n)` on every iteration, which the naive form does unless the
value is hoisted.

**Symptom: the wheel is written as `i += 6` testing only `i`, not `i + 2`.** Cause: half the wheel
was dropped — the form `6k − 1` is being tested and `6k + 1` is not, so `7`, `13`, `19` are never
tried as divisors and numbers like `7 · 7 = 49` are reported prime. Fix: test both `i` and `i + 2`
inside each step, which is what makes the stride of 6 legitimate.

**Symptom: `isPrime` is called inside a loop over a million candidates and the whole thing is
`Θ(n√n)`.** Cause: a per-query algorithm used for a range query. Fix: sieve once in
`Θ(n log log n)` and answer every query in `Θ(1)` — that is
[03g · The sieve of Eratosthenes](03g-the-sieve-of-eratosthenes.md), and recognising which of
the two shapes the problem has is most of the value of knowing both.

**Symptom: `isPrime` is handed a non-integer and returns something.** Cause: TypeScript's `number`
is a double, so `isPrime(7.5)` runs the loop with `n % i` on a fractional value and returns a
meaningless boolean rather than throwing. Fix: `if (!Number.isInteger(n)) throw new TypeError(…)`
at the top. Java's static typing removes this class entirely, which is worth saying out loud when
the interview is in TypeScript.

**Symptom: trial division is proposed for a 2048-bit RSA modulus "with an optimisation".** Cause:
treating a `Θ(√n)` bound as large-but-finite. Fix: state the size relation — `√n = 2^(b/2)` for a
`b`-bit input, so a 2048-bit modulus needs about `2^1024` divisions and no constant factor touches
that. The algorithms that work are polynomial in `b`: Miller–Rabin for testing, Pollard's rho and
better for factoring.

## Interview questions

**★ Why is it enough to test divisors up to `√n`?**
Because if `n` is composite it factors as `a · b` with `1 < a ≤ b`, and then `a² ≤ a·b = n`, so
`a ≤ √n`. The smaller member of any factor pair is at most the square root, so a composite is
guaranteed to have a divisor in `[2, √n]`; finding none proves primality. The bound is inclusive,
and the reason is visible in the derivation: equality happens exactly when `a = b`, that is, when
`n` is the square of a prime. `25` has no divisor strictly below `5`, which is why `i < √n` reports
it prime.

**★ What is the complexity, and why do people say trial division is "not polynomial"?**
It performs `Θ(√n)` divisions. That is polynomial in the *value* of `n` and exponential in the
*size* of `n`: an input of `b` bits has magnitude about `2^b`, so `√n = 2^(b/2)` and doubling the
number of digits squares the running time. Complexity classes are defined against the length of the
encoding, so this is exponential-time — the term of art is pseudo-polynomial. That is precisely why
RSA is safe from it and why Miller–Rabin, which is polynomial in `b`, exists. It also explains why
the `6k ± 1` wheel is worth writing but not worth arguing about: it removes a constant factor of
three from an exponential.

**★ Name the boundary bugs in a four-line `isPrime`.**
Four. **`n < 2`** — the loop never runs, so `1`, `0` and negatives are reported prime unless
guarded. **Strict comparison** — `i * i < n` or `i < Math.sqrt(n)` misses `i = √n`, so every square
of a prime is reported prime, and only those, which is why it survives testing. **`i * i` in `int`
arithmetic** — at `i = 46341` the product exceeds `Integer.MAX_VALUE` and wraps negative, so the
condition stays true and the loop runs far past its bound. **The even-number optimisation** —
`if (n % 2 == 0) return false;` is true of 2, so 2 must be handled before it, and the `6k ± 1`
version has the same problem with 3.

**★ How do you skip even numbers without breaking `isPrime(2)`, and how far can you take it?**
Handle the small cases first: return `false` below 2, return `true` for 2 and 3, then reject
multiples of 2 and 3, and only then run the loop. The generalisation is the `6k ± 1` wheel: every
integer is `6k + r`, and `r ∈ {0, 2, 4}` is even while `r = 3` is a multiple of 3, so every prime
above 3 is `6k ± 1`. Stepping by 6 and testing `i` and `i + 2` visits exactly those, doing a third
of the work. You can extend the wheel to `30k ± {1,7,11,13}` by also excluding multiples of 5, and
the returns diminish quickly — the density of surviving residues tends to zero only logarithmically,
and the code stops being readable long before that pays.

**★ When do you use trial division and when do you sieve?**
Trial division answers one question in `Θ(√n)` with `O(1)` memory; the sieve answers every question
below `n` in `Θ(n log log n)` total with `Θ(n)` memory. So: one number, possibly very large — trial
division. Many numbers, all below a bound you can afford to allocate — sieve once, answer in `Θ(1)`.
The tell that someone has the wrong shape is `isPrime` called inside a loop over a range, which is
`Θ(n√n)` where the sieve is nearly linear. A third case exists: many numbers, all very large,
scattered — neither works, and the answer is Miller–Rabin per query.

**Why is 1 not prime?**
Because unique factorisation would fail. The fundamental theorem of arithmetic says every integer
above 1 has exactly one factorisation into primes up to order; if 1 were prime, `12` would factor as
`2²·3`, `1·2²·3`, `1²·2²·3` and so on without end. The definition "exactly two distinct positive
divisors" excludes 1 for the same reason and is the one to state. In code this matters because
`isPrime(1)` is the single most common wrong answer a trial-division loop gives, and it gives it by
never executing.

**What do you do when the number is too large for trial division?**
Miller–Rabin. It is a probabilistic test that runs in time polynomial in the bit length, and its
error probability falls geometrically in the number of rounds; there are also published sets of
witness bases that make it deterministic below stated bounds — I would look the set up rather than
recall it, because getting one wrong is a silent correctness failure. In Java the shipped answer is
`BigInteger.isProbablePrime(certainty)`, so there is nothing to write. In JavaScript there is no
built-in and you implement it over `BigInt`, using the modular exponentiation from
[07 · Binary exponentiation](07-fast-exponentiation-and-the-modular-inverse.md). If the task is
*factoring* rather than testing, the corresponding step up is Pollard's rho.

---

← Prev: [03e · The Chinese remainder theorem](03e-the-chinese-remainder-theorem.md) · Index: [Phase 2 — Recursion, maths and bits](README.md) · Next → [03g · The sieve of Eratosthenes](03g-the-sieve-of-eratosthenes.md)
