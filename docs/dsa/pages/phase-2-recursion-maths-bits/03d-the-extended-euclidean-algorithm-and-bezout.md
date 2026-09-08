---
title: "The extended Euclidean algorithm is the same recursion carrying two accumulators, and what it returns — Bézout's coefficients x and y with ax + by = gcd(a, b) — is what makes modular inverses, linear Diophantine equations and the Chinese remainder theorem all one algorithm"
sidebar_label: "03d · Extended Euclid and Bézout"
sidebar_position: 3.3
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-08 against the **JDK 25** API documentation for
> [`java.lang.Math`](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/lang/Math.html)
> — `floorDiv` and `floorMod` quoted verbatim below with their documented value pairs. The extended
> Euclidean algorithm, Bézout's identity, the solvability condition for linear Diophantine equations
> and the Chinese remainder theorem are **textbook mathematics, derived on this page rather than
> cited.** **No sandbox run.**

**Euclid's recursion already computes more than it returns, and the extended form is what it costs
to keep the rest.** Run the same sequence of divisions while carrying two accumulators and you get
not just `g = gcd(a, b)` but a pair of integers `x`, `y` with `a·x + b·y = g` — Bézout's
coefficients. That one extra return value is the entire machinery behind three things an interview
will ask for by different names: inverting a number modulo a composite (where Fermat's little
theorem does not apply), deciding whether `ax + by = c` has an integer solution and producing one,
and combining congruences with the Chinese remainder theorem, which is built from a Bézout pair and
gets its own page in [03e](03e-the-chinese-remainder-theorem.md). The algorithm itself is one
substitution. The bug that survives testing is subtler than in plain gcd: the returned `g` stays
correct even when the coefficients are wrong, so a test that only checks the gcd passes a broken
implementation.

## The extended Euclidean algorithm

Euclid's recursion already knows more than it returns. Run it while carrying the coefficients and it
returns not just `g = gcd(a, b)` but a pair `(x, y)` with `a·x + b·y = g`.

**Derivation.** Base case: `gcd(a, 0) = a`, and `a·1 + 0·0 = a`, so `(x, y) = (1, 0)`. Inductive
step: suppose the recursive call on `(b, r)` where `r = a − q·b` returned `(g, x₁, y₁)` with

```
b·x₁ + r·y₁ = g
```

Substitute `r = a − q·b`:

```
b·x₁ + (a − q·b)·y₁ = g
a·y₁ + b·(x₁ − q·y₁) = g
```

So `(x, y) = (y₁, x₁ − q·y₁)`. That is the whole algorithm — one substitution.

```ts
// TypeScript — returns [g, x, y] with a*x + b*y == g. Inputs must be non-negative; see the note below.
export function extGcd(a: number, b: number): [number, number, number] {
  if (b === 0) return [a, 1, 0];
  const q = Math.floor(a / b);
  const [g, x1, y1] = extGcd(b, a - q * b);
  return [g, y1, x1 - q * y1];
}
```

```java
// Java — iterative, so there is no stack to think about. out = {g, x, y} with a*x + b*y == g.
static long[] extGcd(long a, long b) {
    long oldR = a, r = b;
    long oldS = 1, s = 0;
    long oldT = 0, t = 1;
    while (r != 0) {
        long q = oldR / r;
        long tmp;
        tmp = oldR - q * r; oldR = r; r = tmp;
        tmp = oldS - q * s; oldS = s; s = tmp;
        tmp = oldT - q * t; oldT = t; t = tmp;
    }
    return new long[] { oldR, oldS, oldT };   // oldR == gcd(a, b)
}
```

The invariant the iterative form maintains, and the one to state if asked why it works:
`oldS·a + oldT·b == oldR` and `s·a + t·b == r`, at the top of every iteration. Both are true
initially (`1·a + 0·b == a`, `0·a + 1·b == b`) and each triple update subtracts `q` times the second
from the first, which preserves both.

🔴 **The `q` and the `r` must come from the same division.** The derivation used only one fact:
`a = q·b + r`. Java's `/` truncates toward zero and Java's `%` matches it, so `(a/b, a%b)` is a
consistent pair and the recurrence holds even for negative inputs; `Math.floorDiv` and
`Math.floorMod` are a *different* consistent pair and also work, together. Mixing them — computing
`q` with `/` and `r` with `Math.floorMod` — breaks `a = q·b + r` and the coefficients come out
wrong while `g` still comes out right, which is a bug that survives every test that only checks
the gcd.

> *"If the signs of the arguments are different, `floorDiv` returns the largest integer less than
> or equal to the quotient while the `/` operator returns the smallest integer greater than or
> equal to the quotient. They differ if and only if the quotient is not an integer."* — JDK 25,
> `Math.floorDiv(int, int)`; documented: `floorDiv(-4, 3) == -2`, whereas `(-4 / 3) == -1`

## Bézout's identity, and what it buys

**Bézout's identity.** For integers `a`, `b` not both zero, there exist integers `x`, `y` with
`a·x + b·y = gcd(a, b)`; and `gcd(a, b)` is the *smallest positive* integer expressible as
`a·x + b·y`. Extended Euclid is the constructive proof — it hands you the witnesses.

Three consequences you will be asked to use:

1. **Modular inverse.** `a` has an inverse modulo `m` **iff** `gcd(a, m) = 1`. If it is 1, extended
   Euclid gives `a·x + m·y = 1`, so `a·x ≡ 1 (mod m)` and `x mod m` is the inverse. This works for
   any modulus, prime or not — see
   [07d · The modular inverse](07d-the-modular-inverse.md).
2. **Linear Diophantine equations.** `a·x + b·y = c` has an integer solution **iff** `gcd(a, b)`
   divides `c`. Everything on the left is a multiple of `g`, so the right must be too; conversely,
   scale Bézout's witnesses by `c / g`.
3. **Reachability with two step sizes.** The set of values `a·x + b·y` over all integers `x`, `y` is
   exactly the multiples of `gcd(a, b)`. That is why "jugs of 3 and 5 litres can measure any whole
   number of litres" and "jugs of 4 and 6 cannot measure 3".

```ts
// Solve a*x + b*y = c over the integers, or report that it has no solution.
export function solveDiophantine(a: number, b: number, c: number): { x: number; y: number } | null {
  const [g, x0, y0] = extGcd(Math.abs(a), Math.abs(b));
  if (g === 0 || c % g !== 0) return null;      // gcd must divide c
  const k = c / g;
  const x = x0 * k * Math.sign(a || 1);
  const y = y0 * k * Math.sign(b || 1);
  return { x, y };
}
```

Every other solution is `(x + t·(b/g), y − t·(a/g))` for integer `t`, because that shift adds
`a·(b/g) − b·(a/g) = 0` to the left-hand side. That parametrisation is what "find the smallest
positive solution" questions want.

## Gotchas

**★ Symptom: `extGcd` returns the right `g` but coefficients that do not satisfy `a·x + b·y = g`.**
Cause: `q` and `r` came from different division conventions — typically `q` from `/` and `r` from
`Math.floorMod`. The derivation uses `a = q·b + r` and nothing else, so the pair has to be
consistent. The gcd stays correct because it depends only on the sequence of remainders. Fix: pick
one pair and use it for both, and assert the identity in a test, which catches this class outright:

```java
long[] e = extGcd(a, b);
assert a * e[1] + b * e[2] == e[0];        // ✅ one line, catches every mismatched-convention bug
```

> *"If the signs of the arguments are different, `floorDiv` returns the largest integer less than
> or equal to the quotient while the `/` operator returns the smallest integer greater than or
> equal to the quotient. They differ if and only if the quotient is not an integer."* — JDK 25,
> `Math.floorDiv(int, int)`; documented: `floorDiv(-4, 3) == -2`, whereas `(-4 / 3) == -1`

**★ Symptom: a modular inverse built from `extGcd` is negative, and using it as an array index or a
final answer produces a negative result.** Cause: Bézout's coefficients are routinely negative —
there is no reason for the algorithm to prefer a positive `x`, and it does not. Fix: reduce it into
`[0, m)` before returning, with `Math.floorMod` in Java or the `((x % m) + m) % m` idiom in
TypeScript, whose mechanics are
[03j · Modular arithmetic and the remainder trap](03j-modular-arithmetic-and-the-remainder-trap.md):

```ts
export function inverseMod(a: number, m: number): number {
  const [g, x] = extGcd(((a % m) + m) % m, m);
  if (g !== 1) throw new RangeError(`${a} has no inverse modulo ${m}`);
  return ((x % m) + m) % m;                // ✅ never return a raw Bézout coefficient
}
```

**★ Symptom: an inverse is computed for a value that has none, and the wrong number propagates
silently.** Cause: `extGcd` was called and the returned `g` ignored. An inverse of `a` modulo `m`
exists **iff** `gcd(a, m) = 1`; when it does not, `extGcd` still returns a perfectly valid Bézout
pair for whatever `g` turned out to be, and `x` is simply not an inverse. Fix: check `g === 1` and
throw. This is the failure mode that makes "just use extended Euclid, it works for any modulus"
dangerous advice — it works for any modulus *coprime to `a`*.

**Symptom: `extGcd(0, 0)` returns something and the caller uses it.** Cause: it returns
`(0, 1, 0)`, satisfying `0·1 + 0·0 = 0` — mathematically fine, and useless, because Bézout's
identity requires `a` and `b` not both zero for the "smallest positive" characterisation to mean
anything. Fix: reject the input at the boundary; there is nothing to compute.

**Symptom: the recursive `extGcd` is written with `a % b` for the remainder and `a / b` for the
quotient in TypeScript, and it is wrong for large values.** Cause: `/` in TypeScript is
floating-point division, not integer division — `7 / 2` is `3.5`, and the coefficients built from
it are not integers. Fix: `Math.floor(a / b)` for non-negative inputs, or `Math.trunc(a / b)` to
match the `%` operator's truncation for signed ones. The two must match the remainder operator, per
the first gotcha on this page.

**Symptom: "find the smallest positive `x` with `ax + by = c`" returns a negative number.** Cause:
only one solution was produced, and Bézout's witness has no reason to be the smallest positive one.
Fix: use the parametrisation. Every solution is `(x₀ + t·(b/g), y₀ − t·(a/g))`; the smallest
non-negative `x` is `Math.floorMod(x₀, b/g)`, and `y` follows from substituting it back.

## Interview questions

**★ What does the extended Euclidean algorithm give you that plain gcd does not, and what is it
for?**
Bézout's witnesses: integers `x`, `y` with `a·x + b·y = gcd(a, b)`. Three uses, and they are asked
under three different names. First, the modular inverse: if `gcd(a, m) = 1` then `a·x + m·y = 1`, so
`a·x ≡ 1 (mod m)` and `x` reduced into `[0, m)` inverts `a` — and unlike Fermat's little theorem
this needs no primality, so it is the method for a composite modulus. Second, linear Diophantine
equations: `a·x + b·y = c` is solvable over the integers exactly when `gcd(a, b)` divides `c`, and
the witnesses scaled by `c/g` are a solution. Third, the Chinese remainder theorem, whose
construction is a Bézout pair for the two moduli. All three are the same eight lines of code.

**★ Derive the extended algorithm.**
Base case: `gcd(a, 0) = a`, and `a·1 + 0·0 = a`, so return `(a, 1, 0)`. Inductive step: let
`r = a − q·b` where `q = ⌊a/b⌋`, and suppose the recursive call on `(b, r)` returned `(g, x₁, y₁)`
with `b·x₁ + r·y₁ = g`. Substitute for `r`: `b·x₁ + (a − q·b)·y₁ = g`, and regroup as
`a·y₁ + b·(x₁ − q·y₁) = g`. So `(x, y) = (y₁, x₁ − q·y₁)`. That is the whole thing — one
substitution and one regrouping — which is why it is reconstructible on a whiteboard rather than
something to memorise. The iterative form maintains the same fact as an invariant on two triples:
`oldS·a + oldT·b == oldR` and `s·a + t·b == r`, both preserved by subtracting `q` times the second
triple from the first.

**★ Someone hands you an `extGcd` whose `g` is always right but whose `x` and `y` sometimes are not.
Where do you look?**
At the division. The derivation depends on `a = q·b + r` and on nothing else, so `q` and `r` must
come from the same convention. Java's `/` truncates toward zero and `%` matches it; `Math.floorDiv`
and `Math.floorMod` round toward negative infinity and match each other. The `floorDiv` javadoc
states that the two disagree exactly when the signs differ and the quotient is not an integer —
`floorDiv(-4, 3) == -2` against `(-4 / 3) == -1`. Mixing one of each leaves the gcd correct, because
the gcd depends only on the remainder sequence, and quietly ruins the coefficients. In TypeScript
the same bug appears as plain `/`, which is floating-point division and produces non-integer
coefficients. The test is one line: assert `a*x + b*y == g`.

**★ When is `a·x + b·y = c` unsolvable over the integers, and how do you enumerate the solutions
when it is solvable?**
Unsolvable exactly when `gcd(a, b)` does not divide `c`: every value of the left-hand side is a
multiple of `g`, so any `c` that is not a multiple of `g` is unreachable. When `g` does divide `c`,
take Bézout's `(x₀, y₀)` and scale by `c/g`. The full solution set is
`(x₀·c/g + t·(b/g), y₀·c/g − t·(a/g))` for every integer `t`, because that shift adds
`a·(b/g) − b·(a/g) = 0` to the left-hand side and therefore changes nothing. "Smallest non-negative
`x`" is then one `Math.floorMod(x, b/g)` — and it has to be `floorMod` rather than `%`, or the
answer comes back negative for a negative witness.

**Why does `a` have an inverse modulo `m` exactly when `gcd(a, m) = 1`?**
Both directions come from Bézout. If `gcd(a, m) = 1`, extended Euclid produces `x`, `y` with
`a·x + m·y = 1`; reducing modulo `m` kills the second term and leaves `a·x ≡ 1`, so `x` is the
inverse. Conversely, if `a·x ≡ 1 (mod m)` then `a·x − 1 = k·m` for some integer `k`, so
`a·x − m·k = 1`, and any common divisor of `a` and `m` divides the left-hand side and therefore
divides `1` — so the gcd is 1. That is why an inverse-by-extended-Euclid must check the returned
`g`: when it is not 1 the algorithm still returns a valid Bézout pair, it just is not an inverse.

**How large do Bézout's coefficients get?**
Bounded: for `a, b > 0` the coefficients produced by the algorithm satisfy `|x| ≤ b/(2g)` and
`|y| ≤ a/(2g)`, so they never exceed the inputs and the accumulators themselves do not overflow on
inputs the type can hold. That is worth knowing because it says the *coefficients* are not where
overflow comes from — the overflow comes from what you do with them, most commonly the
`r₁·m₂·q` product in a CRT, where three modulus-sized values are multiplied together.

**Why is the iterative form usually preferred over the recursive one here, given that gcd's
recursion is only logarithmically deep?**
Not for stack safety — the depth is the same `Θ(log min(a, b))` and it is not a risk. It is because
the recursive version returns a tuple at every level, which in TypeScript means allocating an array
per frame, and because the iterative version makes its invariant explicit: `oldS·a + oldT·b == oldR`
is a line you can point at, whereas the recursive version's correctness lives in a substitution the
reader has to redo. When the coefficients are wrong, the iterative form is the one you can debug by
printing the invariant at each step.

{/* FOOTER */}
