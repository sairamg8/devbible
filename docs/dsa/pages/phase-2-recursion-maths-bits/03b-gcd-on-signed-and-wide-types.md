---
title: "A correct Euclid's algorithm still returns a wrong answer on a negative input, because % is a remainder rather than a modulus in both TypeScript and Java, and the obvious guard against that has exactly one int input it silently mishandles"
sidebar_label: "03b · gcd on signed and wide types"
sidebar_position: 3.1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-08 against the **JDK 25** API documentation for
> [`java.lang.Integer`](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/lang/Integer.html)
> (`MAX_VALUE`, `MIN_VALUE`, quoted verbatim below) and
> [MDN's `BigInt` page](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/BigInt)
> (the no-mixing rule, quoted verbatim below) and the **JDK 25**
> [`java.math.BigInteger`](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/math/BigInteger.html)
> javadoc for `gcd`. ⚠️ The claim that `Math.abs(Integer.MIN_VALUE)` is
> negative is **not** a sentence in the `Math` javadoc; it is written here as the arithmetic
> consequence of the two `Integer` constants that are quoted, and marked as such. Stein's binary
> GCD is textbook mathematics, named rather than cited. **No sandbox run.**

**[03](03-mathematical-foundations.md) proved that Euclid's algorithm is correct; this page is about
the two ways a correct Euclid's algorithm returns a wrong number.** Both are properties of the
languages rather than of the mathematics, which is why they survive code review — the algorithm is
visibly right. The first is the sign of `%`: it is a *remainder* in both TypeScript and Java, taking
its sign from the dividend, so one negative input produces a negative gcd with the correct
magnitude, which passes every test whose inputs happen to be positive. The second is the guard
against the first: Java's `Math.abs` has a single `int` for which no absolute value exists, and it
returns the argument unchanged rather than complaining. Layered on top are the two type boundaries a
gcd runs into in practice — `BigInt`'s refusal to mix with `Number`, and the fact that reducing a
fraction by its gcd is only half of canonicalising it.

## The sign of a remainder

`%` in both TypeScript and Java is a **remainder**, whose sign follows the *dividend*, not a
mathematical modulus. So the recursive gcd from [03](03-mathematical-foundations.md) walks

```
gcdRec(-12, 8) → gcdRec(8, -12 % 8) = gcdRec(8, -4) → gcdRec(-4, 8 % -4) = gcdRec(-4, 0) → -4
```

and returns `-4`. The magnitude is right and the sign is wrong, which is the worst failure mode
there is: nothing throws, nothing looks odd in the code, and every test with two positive inputs
passes. The `Math.abs` calls at the top of the iterative version are not defensive padding, they are
the correctness fix — and they have to run **before** the loop, because by the time the base case is
reached the sign has already been carried through.

```ts
// TypeScript — the guard is part of the algorithm, not decoration
export function gcd(a: number, b: number): number {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b !== 0) { const t = a % b; a = b; b = t; }
  return a;
}
```

The general treatment of "`%` is a remainder, not a modulus" — where it bites in an index, a hash
bucket and an answer taken modulo a large prime, and the `Math.floorMod` javadoc that documents it —
is [03j · Modular arithmetic and the remainder trap](03j-modular-arithmetic-and-the-remainder-trap.md).
Here it is enough to know that the sign leaks, and that the fix is absolute values up front.

## The one `int` `Math.abs` cannot take

Java's `Math.abs` has a single input it silently mishandles, and it is a consequence of two
documented constants rather than of anything `Math.abs` says about itself:

> *"A constant holding the maximum value an `int` can have, 2^31-1."* — JDK 25, `Integer.MAX_VALUE`

> *"A constant holding the minimum value an `int` can have, -2^31."* — JDK 25, `Integer.MIN_VALUE`

The two's-complement `int` range is asymmetric: there is one more negative value than there are
positive ones. The negation of `-2^31` is `2^31`, and the largest representable `int` is `2^31 − 1`.
There is no `int` to return, so `Math.abs(Integer.MIN_VALUE)` is still negative. ⚠️ That sentence
is arithmetic, derived from the two quotes above; it is not itself a quotation.

The fix is in the signature, not in the body: **declare the parameters `long`**. Widening happens at
the call site, before `Math.abs` runs, and `-(long) Integer.MIN_VALUE` is `2147483648L`, which a
`long` holds exactly.

```java
// ✅ the parameters are long, so the widening conversion happens before Math.abs
static long gcd(long a, long b) {
    a = Math.abs(a);
    b = Math.abs(b);
    while (b != 0L) { long t = a % b; a = b; b = t; }
    return a;
}

int p = Integer.MIN_VALUE, q = 12;
long g = gcd(p, q);          // ✅ p widens to -2147483648L first; Math.abs of that is exact

// ⛔ the int-typed version below is wrong for exactly one input, and silently so
static int gcdBroken(int a, int b) {
    a = Math.abs(a);         // a is unchanged, and still negative, when a == Integer.MIN_VALUE
    b = Math.abs(b);
    while (b != 0) { int t = a % b; a = b; b = t; }
    return a;
}
```

`long` has the same asymmetry one power of two higher — `Math.abs(Long.MIN_VALUE)` is negative for
the same reason — so widening moves the cliff rather than removing it. It removes it *for `int`
inputs*, which is the case you actually have. The general problem, every place a signed type has no
positive counterpart, belongs to [05 · Integer limits and overflow](05-integer-limits-and-overflow.md).

## `BigInt` and `BigInteger`

Beyond a machine word the identity is unchanged; only the type is. In Java that is `BigInteger`,
which ships `gcd` directly and needs no code from you — and which, notably, has already made the two
decisions this page is about:

> *"Returns a BigInteger whose value is the greatest common divisor of `abs(this)` and `abs(val)`.
> Returns 0 if `this == 0 && val == 0`."* — JDK 25, `BigInteger.gcd(BigInteger)`

It is defined on the absolute values, so the sign leak cannot happen, and it fixes `gcd(0, 0)` at
zero rather than throwing. A primitive implementation has to make both of those choices itself. In TypeScript it is `BigInt`, and the loop
transcribes verbatim — but two of MDN's documented rules bite immediately:

> *"A BigInt value cannot be used with methods in the built-in `Math` object and cannot be mixed
> with a Number value in operations; they must be coerced to the same type."* — MDN, `BigInt`

That single sentence rules out both `Math.abs(b)` and the literal `0` in `while (b !== 0)`. The
first has no BigInt overload at all; the second throws a `TypeError` when the two operands land on
opposite sides of the Number/BigInt line. Write the negation by hand and use `0n`:

```ts
// TypeScript — gcd over BigInt. Math.abs is unavailable by documentation, so negate explicitly.
export function gcdBig(a: bigint, b: bigint): bigint {
  if (a < 0n) a = -a;
  if (b < 0n) b = -b;
  while (b !== 0n) { const t = a % b; a = b; b = t; }
  return a;
}
```

MDN's advice on when to reach for it is one sentence and worth taking literally:

> *"Only use a BigInt value when values greater than 2^53 are reasonably expected."* — MDN, `BigInt`

⚠️ MDN makes **no** performance claim about `BigInt`, and neither does this page. Arbitrary-precision
arithmetic is not a single register operation — that is mechanism, not a measurement — and no figure
is stated here because none was measured.

## Reducing a fraction is not the same as canonicalising one

The most common production use of `gcd` in a storefront is not a puzzle, it is normalising a ratio:
a discount expressed as `15/100`, a rating aggregate, a unit conversion. Dividing by the gcd reduces
it. It does **not** canonicalise it, because the sign can sit on either side: `-1/2` and `1/-2` are
both fully reduced and are different pairs, so they land as two different keys in a `Map` or `Set`
and two different rows in a unique index.

```ts
// TypeScript — reduce AND put the sign on the numerator; only then is it a key
export function normaliseFraction(n: number, d: number): [number, number] {
  if (d === 0) throw new RangeError("zero denominator");
  const g = gcd(n, d) || 1;                  // gcd(0, d) is |d|, so 0/5 reduces to 0/1; gcd(0,0) is 0
  let num = n / g;
  let den = d / g;
  if (den < 0) { num = -num; den = -den; }   // ✅ the sign lives on the numerator, always
  return [num, den];
}
```

The `|| 1` is not laziness: `gcd(0, 0)` is `0`, and without the fallback the two divisions produce
`NaN` rather than throwing. Deciding that degenerate case at the call site is the pattern
[03](03-mathematical-foundations.md) recommends, because `gcd` itself cannot return `1` there
without breaking the identity `gcd(a, 0) = a`.

## Binary GCD, named

Stein's algorithm replaces every division with a shift and a subtraction, using
`gcd(2u, 2v) = 2·gcd(u, v)`, `gcd(2u, v) = gcd(u, v)` for odd `v`, and
`gcd(u, v) = gcd(|u − v|, min(u, v))` for `u` and `v` both odd. It exists because division used to
cost far more than a shift, and it is worth naming so you are not caught out reading it in someone
else's code. The plain remainder loop is still the one to write: it is shorter, it has no parity
bookkeeping, and its bound is the same `Θ(log min(a, b))`. 🔴 In JavaScript, Stein's algorithm is
also a trap rather than an optimisation, because the shift and mask operators it depends on coerce
their operands to 32 bits — the vocabulary for that, and the coercion rules that cause it, are
[04 · Bit manipulation](04-bit-manipulation.md).

## Gotchas

**★ Symptom: `gcd` returns a negative number, and the fraction you were reducing comes out with a
negative denominator.** Cause: `%` is a remainder in both languages, so its sign follows the
dividend; one negative input propagates its sign all the way to the base case, and the magnitude
being correct is what hides it. Fix: take absolute values *before* the loop, never after, and never
inside the recursive step where the sign has already been carried:

```ts
a = Math.abs(a); b = Math.abs(b);          // ✅ first two statements of the function
while (b !== 0) { const t = a % b; a = b; b = t; }
```

**★ Symptom: `Math.abs` returns a negative number and a downstream `assert x >= 0` fires with no
explanation.** Cause: the input was `Integer.MIN_VALUE`; its negation is `2^31` and the largest
`int` is `2^31 − 1`, so there is no value to return and the argument comes back unchanged. Fix:
declare the helper over `long` so the widening conversion happens at the call site before `Math.abs`
is applied — `static long gcd(long a, long b)` called with `int` arguments is correct for every
`int` input, because `-(long) Integer.MIN_VALUE` fits a `long` exactly.

**★ Symptom: `gcd` over `BigInt` throws `TypeError: Cannot mix BigInt and other types`.** Cause: a
`BigInt` met a `Number` in one expression — almost always the literal `0` in `while (b !== 0)`, or a
call to `Math.abs`, both of which MDN rules out in one sentence. Fix: keep the whole function in one
domain: `0n` for the literal, and an explicit `if (a < 0n) a = -a;` in place of `Math.abs`.

**★ Symptom: two mathematically equal fractions land as two different keys in a `Map`, a `Set` or a
unique index.** Cause: reduction is not canonicalisation — `-1/2` and `1/-2` are both fully reduced
and still distinct pairs. Fix: after dividing by the gcd, force the denominator positive by negating
both components, so the sign always lives on the numerator. Guard the zero denominator explicitly
and the zero gcd with `|| 1`, or the divisions silently produce `NaN`.

**Symptom: an `int`-typed `gcd` is "fixed" by adding `if (a == Integer.MIN_VALUE) a = -a;`.** Cause:
the fix restates the bug — negating `MIN_VALUE` in `int` arithmetic yields `MIN_VALUE` again, so the
branch changes nothing. Fix: change the *type*, not the branch. If the signature genuinely must
stay `int`, reject the input rather than pretending to handle it: `if (a == Integer.MIN_VALUE) throw
new IllegalArgumentException("no int absolute value");`

**Symptom: a `BigInt` gcd is introduced "to be safe" for values that fit comfortably in a
`number`.** Cause: treating arbitrary precision as free. Fix: MDN's own guidance — *"Only use a
BigInt value when values greater than 2^53 are reasonably expected."* Below that boundary a
`number` is exact for integers and interoperates with every other API you own; above it, `BigInt`
is the only correct choice and the conversion cost is not the question.

**Symptom: Stein's binary GCD ported to TypeScript disagrees with the remainder loop on large
inputs.** Cause: `>>`, `&` and `|` coerce their operands to 32-bit integers, so every value above
that range is truncated before the algorithm sees it — the algorithm is fine and the operators are
not doing what the code says. Fix: use the remainder loop, whose operators are ordinary arithmetic
and stay in double precision, or move to `BigInt`, whose bitwise operators are documented not to
truncate.

## Interview questions

**★ Why does `gcd(-12, 8)` return `-4` in a textbook-correct implementation, and where exactly do
you fix it?**
Because `%` in both TypeScript and Java is a remainder rather than a modulus, and a remainder takes
its sign from the dividend. The recursion carries that sign to the base case, which returns `a`
verbatim — so the magnitude is right and the sign is not. The fix goes at the top of the function,
before the loop or before the first recursive call: `a = Math.abs(a); b = Math.abs(b);`. Putting it
on the return value works for the top-level call and not for a recursive one, and putting it inside
the loop is wasted work that still leaves the first step signed. The reason it survives review is
that it never throws and the magnitude is always correct.

**★ What is wrong with `static int gcd(int a, int b) { a = Math.abs(a); … }`?**
It is wrong for exactly one input. `Integer.MIN_VALUE` is `-2^31` and `Integer.MAX_VALUE` is
`2^31 − 1`, so the absolute value of `MIN_VALUE` is not a representable `int` and `Math.abs` returns
the argument unchanged, still negative. The two's-complement range is asymmetric — there is one more
negative value than positive — and that asymmetry has no local fix inside an `int`. Declaring the
parameters `long` fixes it, because the widening conversion runs at the call site and
`-(long) Integer.MIN_VALUE` is `2147483648L`. Note that `long` has the same cliff at
`Long.MIN_VALUE`; widening moves the boundary rather than removing it, which is fine, because the
inputs you actually have are `int`s.

**★ When do you reach for `BigInt` or `BigInteger` in a gcd, and what changes in the code?**
When values above `2^53` are reasonably expected — that is MDN's own criterion and it is the right
one, because below that boundary a JavaScript `number` represents integers exactly. The algorithm
does not change at all; the types do. In TypeScript, `Math.abs` becomes unavailable (a BigInt cannot
be passed to a `Math` method) and every numeric literal has to become a BigInt literal, or the
operation throws `TypeError` — MDN states both restrictions in one sentence. In Java, `BigInteger`
already has `gcd`, so there is nothing to write. What does change is the complexity claim: the step
count is still logarithmic, but each division is no longer a constant-time machine instruction.

**Why is reducing a fraction by its gcd not enough to use it as a key?**
Because reduction fixes the magnitudes and says nothing about where the sign sits. `-1/2` and `1/-2`
are both in lowest terms, are equal as rationals, and are different `(numerator, denominator)`
pairs — so they hash differently, compare unequal under structural equality, and produce two rows
where a unique constraint expected one. Canonicalisation is reduction *plus* a rule that puts the
sign on one side, conventionally the numerator. The two degenerate inputs need deciding as well:
a zero denominator should throw, and a zero gcd (which only happens for `0/0`) needs a fallback
before the divisions turn into `NaN`.

**What is Stein's binary GCD, and would you use it?**
It computes the same value using only shifts, subtractions and parity tests, via
`gcd(2u, 2v) = 2·gcd(u, v)`, `gcd(2u, v) = gcd(u, v)` for odd `v`, and
`gcd(u, v) = gcd(|u − v|, min(u, v))` for both odd. It was invented when division was dramatically
more expensive than a shift. I would name it and write the remainder loop: the bound is the same,
the code is a quarter the length, and there is no parity bookkeeping to get wrong. In JavaScript
specifically it is worse than merely unnecessary — the bitwise operators it is built from coerce
their operands to 32 bits, so it is silently wrong above that range while the remainder loop is not.

---

← Prev: [03 · gcd and Euclid's algorithm](03-mathematical-foundations.md) · Index: [Phase 2 — Recursion, maths and bits](README.md) · Next → [03c · lcm and the multiplication order](03c-lcm-and-the-multiplication-order.md)
