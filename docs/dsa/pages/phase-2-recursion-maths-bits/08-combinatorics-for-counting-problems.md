---
title: "Every counting problem reduces to two rules — multiply independent choices, add disjoint cases — and permutations and combinations are not formulas to remember but the two rules applied once and then divided by a deliberate over-count"
sidebar_label: "08 · Counting: the two principles"
sidebar_position: 8
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-08. The counting principles, nPr, nCk, the over-count division and the
> multiset formula are **mathematics — derived on this page, not cited to a source**. The two
> language-behaviour facts are primary-sourced: MDN's
> [`Number.MAX_SAFE_INTEGER`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number/MAX_SAFE_INTEGER)
> and the JDK 25 javadoc for
> [`java.lang.Integer`](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/lang/Integer.html),
> both quoted below. Java targets **JDK 25**; TypeScript first, Java second. **No sandbox run** —
> the factorial values quoted are arithmetic, not program output.

**There are exactly two counting rules, and everything on this page and the next four is those two
applied and then corrected for over-counting.** Multiply when a construction is a sequence of
independent choices; add when it splits into cases that cannot both happen. The interview skill is
not recalling `n!/(k!(n−k)!)` — it is *decomposing* the object being counted until one of the two
rules applies, and then noticing that the decomposition counted some objects more than once and
dividing by exactly that factor. Do it in that order and permutations, combinations, multiset
arrangements and stars-and-bars all fall out of the same three lines of reasoning.
[08b](08b-pascals-rule-and-the-dp-table.md) is Pascal's rule and the table,
[08c](08c-stars-and-bars-and-multisets.md) is stars and bars,
[08d](08d-catalan-numbers.md) is Catalan numbers,
[08e](08e-inclusion-exclusion-and-derangements.md) is inclusion–exclusion, and
[08f](08f-closed-form-or-dp.md) and [08g](08g-the-pigeonhole-principle.md) are the two recognition
skills the whole topic exists to build.

## The two principles

**Multiplication.** If an object is built by making choice 1 in `a` ways, then choice 2 in `b`
ways — where `b` does not depend on which choice was made first — the number of objects is `a · b`.
The independence clause is the whole content: *how many* options the second choice has must be the
same regardless of the first, though *which* options they are may differ.

**Addition.** If the objects split into disjoint cases, count each case and add. Disjoint is the
whole content: if an object can land in two cases, addition over-counts it, and you need
[inclusion–exclusion](08e-inclusion-exclusion-and-derangements.md) instead.

Those two clauses — "does not depend on" and "disjoint" — are where nearly every wrong count comes
from, and they are worth checking out loud:

> "Is the number of options at step 2 the same for every outcome of step 1?" and
> "Can one object be counted by two of my cases?"

A storefront example of each. *Multiplication:* a product variant is a colour (4) and a size (5)
and a fit (2) — 40 variants, valid because every colour comes in every size. *Not multiplication:*
if two colours only come in three sizes, the count is not `4 · 5` and you must split into cases and
add. *Addition:* orders are either shipped or collected, never both, so total = shipped + collected.
*Not addition:* orders that used a promo and orders that used a gift card overlap, so the total is
not the sum.

## Permutations: arrangements of distinct things

Filling `k` ordered positions from `n` distinct items: `n` choices for the first, `n − 1` for the
second — the count of options at each step is the same regardless of which items were used, so the
multiplication principle applies:

```
nPr = P(n, k) = n · (n−1) · … · (n−k+1) = n! / (n−k)!
```

`k = n` gives `n!`, the arrangements of everything. The factorial notation is a compression of the
product, not a separate idea; `n! / (n−k)!` is how you *write* it, and the descending product is
how you *compute* it, because the quotient form builds two enormous numbers to produce a small one.

## Combinations: the over-count division

A combination is a permutation that has forgotten its order. Each set of `k` items is produced by
`k!` different orderings, so `P(n, k)` counts every set exactly `k!` times:

```
nCk = C(n, k) = P(n, k) / k! = n! / (k! · (n−k)!)
```

**This is the move worth internalising, because it generalises far beyond combinations:** count
with order (easy, multiplication principle), then divide by the number of orderings that produce
the same object (easy, another multiplication). Everything below is that pattern with a different
divisor.

The two properties that get used constantly:

- **Symmetry:** `C(n, k) = C(n, n−k)` — choosing which `k` to take is the same as choosing which
  `n−k` to leave. Compute with `min(k, n−k)` and the loop is half as long.
- **Sum:** `Σ_{k=0}^{n} C(n, k) = 2^n` — every subset has some size, and there are 2^n subsets.
  This is the identity that connects this page to the subsets enumeration in
  [06d](06d-subsets-and-combinations.md), and it is the cleanest proof that the enumeration's Θ(2^n)
  is not an over-estimate.

## Multiset permutations: the same division, a different divisor

Arrangements of `n` items where the values repeat with multiplicities `m₁, m₂, …`:

```
n! / (m₁! · m₂! · … )
```

Same argument: `n!` counts arrangements as if every item were distinct, and each genuinely distinct
arrangement is produced `m₁! · m₂! · …` times, once per way of permuting the equal copies among
their positions. `MISSISSIPPI` is `11! / (1! · 4! · 4! · 2!)` — one M, four I, four S, two P.

This is the same formula that bounds the duplicate-skipping permutation search in
[06g](06g-duplicates-in-permutations.md), and the correspondence is exact: the search reaches one
leaf per distinct arrangement because it keeps exactly one representative — the one using equal
values left to right — of each class of `m₁!·m₂!·…` equivalent orderings.

## Computing C(n, k) without building n!

🔴 **Never compute `n! / (k!(n−k)!)` by evaluating the three factorials.** They overflow long before
the answer does, and the answer is often small. The multiplicative form multiplies and divides
alternately, and stays exact:

```ts
// C(n, k) by the multiplicative formula. Exact in integers — see the divisibility note below.
export function choose(n: number, k: number): number {
  if (k < 0 || k > n) return 0;
  k = Math.min(k, n - k);                 // symmetry: halve the loop
  let result = 1;
  for (let i = 1; i <= k; i++) {
    result = (result * (n - k + i)) / i;  // exact at every step: result is C(n-k+i, i)
  }
  return result;
}
```

```java
// Java: identical, in long. Overflows for large n — see the note on moduli below.
public static long choose(int n, int k) {
    if (k < 0 || k > n) return 0L;
    k = Math.min(k, n - k);
    long result = 1L;
    for (int i = 1; i <= k; i++) {
        result = result * (n - k + i) / i;   // exact: result is C(n-k+i, i) after step i
    }
    return result;
}
```

**Why the division is exact and not a truncation.** After step `i` the accumulator is exactly
`C(n−k+i, i)`, which is an integer — the product of `i` consecutive integers is always divisible by
`i!`, and this loop consumes that divisibility one factor at a time. Reordering the loop to do all
the multiplications first and then divide is arithmetically identical and overflows;
reordering it to divide before multiplying truncates and is wrong. The order in the line above is
load-bearing.

## Where these numbers stop fitting

The counts explode, and both languages fail quietly rather than loudly.

**JavaScript.** Numbers are doubles:

> *"Double precision floating point format only has 52 bits to represent the mantissa, so it can
> only safely represent integers between -(2^53 – 1) and 2^53 – 1."* — MDN, `Number.MAX_SAFE_INTEGER`

> *"For example, `Number.MAX_SAFE_INTEGER + 1 === Number.MAX_SAFE_INTEGER + 2` will evaluate to
> true, which is mathematically incorrect."*

`MAX_SAFE_INTEGER` is 9007199254740991. `18!` is 6402373705728000 and fits; `19!` is
121645100408832000 and does not. So a factorial-based count in plain JavaScript numbers is
trustworthy to `n = 18` and silently wrong after it — no exception, no `NaN`, just a value that is
close and unequal. MDN's own advice: *"For larger integers, consider using `BigInt`."*

**Java.** The javadoc pins the two constants:

> *"A constant holding the maximum value an `int` can have, 2^31-1."* — JDK 25, `Integer.MAX_VALUE`

`12!` is 479001600 and fits in an `int`; `13!` is 6227020800 and does not, and Java's `*` wraps
without complaining. A `long` reaches `20!` = 2432902008176640000 and `21!` overflows it. So: `int`
to 12, `long` to 20, and `BigInteger` beyond — and note `C(n, k)` fits far longer than `n!` does,
which is exactly why the multiplicative loop above is worth writing.

🔴 **This is why competitive and interview counting problems are stated "modulo 10^9 + 7".** Past a
small `n` the exact answer does not fit any machine integer, so the problem asks for the residue
instead — and then every multiplication has to be reduced, every division becomes a multiplication
by a modular inverse, and `%` in both languages is a *remainder* that goes negative after a
subtraction. **This page does not own that machinery.** The modular arithmetic is
**Fast exponentiation and the modular inverse** *(not written yet)*, and the underlying `%` and
overflow behaviour is **Mathematical foundations** *(not written yet)*. What this page owns is
knowing that you need it, and at what size.

## Gotchas

**★ Symptom: a count computed as `factorial(n) / (factorial(k) * factorial(n-k))` is wrong for
moderate n.** Cause: the intermediate factorials overflow long before the answer does — `13!`
exceeds a Java `int` and `19!` exceeds JavaScript's safe-integer range, while `C(n, k)` itself may
be tiny. Fix: the multiplicative loop, alternating one multiplication and one division so the
accumulator is always a binomial coefficient and always exact.

**★ Symptom: the multiplicative loop returns a non-integer or an off-by-one value.** Cause: the
multiplication and division reordered — dividing before multiplying truncates, and doing every
multiplication first re-introduces the overflow. Fix: `result = result * (n - k + i) / i` in that
exact order; the invariant is that `result` equals `C(n−k+i, i)` after step `i`, and the product of
`i` consecutive integers is divisible by `i`.

**★ Symptom: a JavaScript count is right for small inputs and silently wrong for larger ones, with
no error.** Cause: doubles represent integers exactly only up to 2^53 − 1, and past that
arithmetic quietly rounds — MDN documents that `MAX_SAFE_INTEGER + 1` and `+ 2` compare equal. Fix:
`BigInt` if the exact value is wanted, or reduce modulo a prime if the problem asks for a residue.
There is no runtime signal for this; you have to know the threshold.

**★ Symptom: the multiplication principle applied where the second choice depends on the first.**
Cause: skipping the independence check — "four colours and five sizes" is 20 only if every colour
comes in every size. Fix: ask "is the *number* of options at step 2 the same for every outcome of
step 1?" If not, split into cases and add.

**★ Symptom: the addition principle applied to overlapping cases and the total is too high.**
Cause: the cases are not disjoint — orders with a promo and orders with a gift card include orders
with both. Fix: either redefine the cases so they cannot overlap, or use inclusion–exclusion. The
tell is a total larger than the size of the set being counted.

**Symptom: `C(n, k)` computed with `k` large and the loop runs n − 1 times.** Cause: the symmetry
`C(n, k) = C(n, n−k)` not applied. Fix: `k = Math.min(k, n - k)` before the loop. It halves the work
and, more importantly, halves the number of multiplications that could overflow.

**Symptom: `nPr` computed as `n! / (n−k)!` and it overflows for n where the answer fits.** Cause:
the quotient form evaluated literally. Fix: the descending product `n · (n−1) · … · (n−k+1)`, which
never builds a value larger than the answer.

**Symptom: a multiset arrangement count that is a multiple of the right answer.** Cause: `n!` used
without dividing by the multiplicities' factorials. Fix: divide by `m₁!·m₂!·…`; the tell is that the
wrong answer is the right one times a product of small factorials.

**Symptom: `Σ C(n, k)` computed in a loop to get the number of subsets.** Cause: not recognising
the identity. Fix: it is `2^n`, by the argument that every subset has exactly one size — and that
identity is worth knowing because it also proves the subset enumeration's bound is tight.

## Interview questions

**★ Derive `C(n, k)` rather than quoting it.**
Start with ordered selections: filling `k` positions from `n` distinct items gives
`n · (n−1) · … · (n−k+1)` by the multiplication principle, because the number of remaining options
at each step is the same regardless of which items were used. That is `P(n, k) = n!/(n−k)!`. Now
notice that a *set* of `k` items is produced by `k!` different orderings, so `P(n, k)` counts each
set exactly `k!` times, and dividing gives `C(n, k) = n!/(k!(n−k)!)`. The reason to derive it rather
than recall it is that the same two steps — count with order, divide by the over-count — give the
multiset arrangement count and the stars-and-bars formula, and those are the ones people cannot
recall under pressure.

**★ How do you compute a binomial coefficient without overflowing?**
Never by evaluating three factorials — they overflow long before the answer does. Use the
multiplicative form: start at 1 and for `i` from 1 to `k` do `result = result * (n - k + i) / i`,
which is exact at every step because the accumulator is always `C(n−k+i, i)`, an integer. Apply the
symmetry `C(n, k) = C(n, n−k)` first so the loop runs `min(k, n−k)` times. If the answer itself does
not fit — which happens quickly — the choices are `BigInt`/`BigInteger` for an exact value, a
Pascal's-triangle DP table which only ever adds, or the modular route the problem is usually asking
for.

**★ At what point does an exact count stop fitting, in each language?**
In JavaScript, integers are exact only to 2^53 − 1 = 9007199254740991, so `18!` fits and `19!` does
not, and past the boundary arithmetic rounds silently — MDN documents that `MAX_SAFE_INTEGER + 1`
and `+ 2` compare equal. In Java, `int` is 2^31 − 1 so `12!` fits and `13!` does not; `long` reaches
`20!` and `21!` overflows it, and Java's `*` wraps without an exception unless you opt into
`Math.multiplyExact`. Binomial coefficients fit far longer than factorials, which is the practical
reason to compute them multiplicatively. Beyond that it is `BigInt`/`BigInteger` for exact values,
or a modulus.

**★ When a problem says "return the answer modulo 10^9 + 7", what is it telling you?**
That the exact answer does not fit in a machine integer, so the grader wants a residue. Three
consequences follow immediately: every multiplication must be reduced as you go, and in Java it must
be done in `long` because two reduced `int`s multiply to something an `int` cannot hold; every
division becomes a multiplication by a modular inverse, which is why the modulus is prime; and any
subtraction can make the running value negative, because `%` in both languages is a remainder rather
than a mathematical modulus. The arithmetic itself belongs to the modular-inverse topic; what
belongs here is recognising the signal and knowing that a "divide by k!" in your formula has become
the hardest part of the implementation.

**What are the two independence conditions you check before multiplying or adding?**
For multiplication: the *number* of options at each step must not depend on the earlier choices —
which options they are may differ, how many there are may not. Four colours times five sizes is
twenty only if every colour comes in every size; if two colours come in three sizes, the product is
wrong and the count must be split into cases. For addition: the cases must be disjoint, so no object
is counted twice. Orders that used a promo plus orders that used a gift card double-counts orders
that used both, and the fix is either to redefine the cases or to reach for inclusion–exclusion. Most
wrong counts are one of those two conditions violated silently, and both take one sentence to check.

{/* FOOTER */}
