---
title: "Java's int wraps on overflow without a word, so the JDK ships an opt-in family that throws instead — and the reason a wrapped int is still the easier bug is that Math.addExact, multiplyExact and toIntExact turn it into an exception at the line where it happened"
sidebar_label: "05c · Java's int, and the checked arithmetic"
sidebar_position: 5.2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-08. `Math.addExact`, `Math.multiplyExact` and `Math.toIntExact` are quoted
> verbatim from the JDK 25
> [`Math`](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/lang/Math.html)
> javadoc, including the thrown `ArithmeticException`; `Integer.MAX_VALUE` and `Integer.MIN_VALUE`
> from the JDK 25
> [`Integer`](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/lang/Integer.html)
> javadoc. ⚠️ **That the plain `+` and `*` wrap silently is stated as the inference the `Exact`
> family's existence licenses**, not as a quoted sentence — no JLS text was fetched. ⚠️ Binary
> numeric promotion (`int * int` is an `int` regardless of the destination type) is likewise stated
> as **mechanism**; the fix given for it is correct either way. `BigInteger` is named without any
> API claim — its javadoc was not consulted. **No sandbox run.** Version spine: **JDK 25**.

**Java's integer overflow is a better bug than JavaScript's rounding, and the reason is not that it
is louder — by default it is just as quiet — but that the platform gives you a one-word opt-in that
converts it into an exception at the exact line where it happened.** An `int` that exceeds its range
wraps: two large positives produce a negative, a length becomes negative, an index goes out of
bounds. Nothing is thrown. `Math.addExact` and its siblings exist precisely so that you can choose
otherwise, and their javadoc is the clearest statement in the JDK that the ordinary operators do not
complain. This page is the range, the wrap, the checked family, the promotion rule that causes most
real Java overflow bugs, and the choice between `int`, `long` and `BigInteger`. The three canonical
overflow *sites* — the midpoint, the modular product, the accumulating sum — are in
[05d](05d-the-three-silent-overflows.md).

## The range, and what happens at its edge

> *"A constant holding the maximum value an `int` can have, 2^31-1."* — JDK 25, `Integer.MAX_VALUE`

> *"A constant holding the minimum value an `int` can have, -2^31."* — JDK 25, `Integer.MIN_VALUE`

Two's complement, 32 bits, with the asymmetry that gives ([04](04-bit-manipulation.md)): one more
negative value than positive, and therefore no positive counterpart to `MIN_VALUE`. `long` is the
same shape at 64 bits, running from −2^63 to 2^63 − 1.

Past the edge, arithmetic wraps around modulo 2^32 and the result is reinterpreted as signed. That
is what makes overflow silent: the operation succeeds, the value is a perfectly ordinary `int`, and
only its *meaning* is wrong. The javadoc's own way of saying so is the existence of an alternative
that does the opposite:

> *"Returns the sum of its arguments, throwing an exception if the result overflows an `int`."* — JDK 25, `Math.addExact(int,int)`, throwing *"`ArithmeticException` - if the result overflows an int"*

> *"Returns the product of the arguments, throwing an exception if the result overflows an `int`."* — JDK 25, `Math.multiplyExact(int,int)`, throwing the same `ArithmeticException`

> *"Returns the value of the `long` argument, throwing an exception if the value overflows an `int`."* — JDK 25, `Math.toIntExact(long)`

⚠️ Those three sentences are the ones fetched for this page. The `Math` class carries more members
of the same family; this page names only what it quoted.

`toIntExact` is the one people forget and the one that catches the most: **a narrowing cast
`(int) someLong` truncates silently**, keeping the low 32 bits and reinterpreting the sign bit, in
exactly the way JavaScript's bitwise operators do. `Math.toIntExact` is the same conversion that
refuses rather than lies.

## Where to actually use the checked family

Not everywhere — a loop counter bounded by an array length does not need `addExact`. Use it at the
places where the operands come from outside your control or where the magnitudes are genuinely
data-dependent:

```java
// a storefront line total: quantity comes from a request body, unit price from a supplier feed
static long lineTotalCents(int quantity, int unitPriceCents) {
    // 🔴 quantity * unitPriceCents is an int expression — the (long) cast makes it a long multiply
    return (long) quantity * unitPriceCents;
}

// a running total that must never silently wrap, with the failure attributed to the line that caused it
static long orderTotalCents(List<OrderLine> lines) {
    long total = 0L;
    for (OrderLine line : lines) {
        total = Math.addExact(total, lineTotalCents(line.quantity(), line.unitPriceCents()));
    }
    return total;
}

// crossing back down to an int-typed API, refusing rather than truncating
static int asIntCents(long cents) {
    return Math.toIntExact(cents);   // ArithmeticException instead of a wrapped value
}
```

The value of `addExact` here is not that it prevents the arithmetic problem — it is that the
`ArithmeticException` names the line, so the stack trace points at the accumulation rather than at
whatever the wrapped total broke three layers later.

## The promotion rule that causes most real Java overflow bugs

🔴 **`long total = price * quantity;` does not do a `long` multiply.** The expression's type is
decided by its operands, not by the variable it is assigned to: both are `int`, so it is an `int`
multiplication, it wraps at 2^31, and the already-wrong 32-bit result is then widened to `long`.
The destination type never enters into it.

```java
int price = 300_000, quantity = 10_000;
long wrong   = price * quantity;            // int multiply, wraps, then widens — a wrong long
long right   = (long) price * quantity;     // one operand is long, so the multiply is 64-bit
long checked = Math.multiplyExact((long) price, quantity);   // and refuses if even that overflows
```

This is the same rule that makes `1 << 40` on a `long` mask wrong in
[04b](04b-the-single-bit-idioms-and-masks.md), and it has the same fix: **make one operand the wider
type before the operation, not after.** A `(long)` cast on the *result* — `(long) (price * quantity)`
— is the version that looks correct in review and changes nothing, because the multiplication has
already happened.

The same trap hides in the streams API. **`IntStream.sum()` sums into an `int`**, so a stream of
large `int` values overflows in the terminal operation, with the same silence:

```java
// wraps if the total exceeds 2^31 - 1
int wrongTotal = orders.stream().mapToInt(Order::totalCents).sum();

// sums into a long — map to the wider type before the terminal operation, not after
long rightTotal = orders.stream().mapToLong(Order::totalCents).sum();
```

## Detecting a wrap without the checked methods

Sometimes you want the test rather than the exception — in a parser, a validator, or code that must
not throw. The naive check does not work: `if (a + b > Integer.MAX_VALUE)` is dead code, because the
sum has already wrapped by the time the comparison runs and can never exceed `MAX_VALUE`. The sign
test does work, and it is derivable rather than memorisable:

**An addition of two `int`s overflows if and only if the operands share a sign and the result has
the opposite one.** Two positives can only exceed the top of the range, landing in the negative half;
two negatives can only fall below the bottom, landing in the positive half; and operands of opposite
signs produce a result between them, which cannot leave the range at all.

```java
static boolean addOverflows(int a, int b) {
    int r = a + b;
    // (a ^ r) is negative exactly when a and r differ in sign; likewise (b ^ r)
    return ((a ^ r) & (b ^ r)) < 0;
}
```

The expression reads directly off that sentence: XOR-ing two values gives a negative result exactly
when their sign bits differ ([04](04-bit-manipulation.md)), so `(a ^ r) < 0` means "`a` and the
result disagree in sign"; ANDing the two XORs and testing the sign bit asks whether *both* disagree,
which is precisely the overflow condition.

⚠️ **Division overflows too, in exactly one place.** `Integer.MIN_VALUE / -1` has no representable
answer, because `-MIN_VALUE` is one past `MAX_VALUE` — the asymmetry of the range again. It is the
only division of two `int`s that can overflow, and it is the same input that makes
`Math.abs(Integer.MIN_VALUE)` negative ([04c](04c-clearing-and-isolating-the-lowest-bit.md)).

## `int`, `long` or `BigInteger`

| Situation | Type |
|---|---|
| Indices, sizes, loop counters bounded by a collection | `int` |
| Money in minor units, per row **and** in aggregate | `long` — an `int` cents field caps at 2,147,483,647 cents, about £21.5 million |
| Any product of two data-dependent values | `long`, with `(long)` on one operand |
| Timestamps in milliseconds or finer | `long` |
| A running product under a modulus near 10^9 | `long` ([05d](05d-the-three-silent-overflows.md)) |
| Exact arithmetic beyond 2^63 — cryptography, factorials, big combinatorics | `BigInteger` |

The storefront line that matters: **money in `int` cents is fine for one consumer order and wrong
for the system.** A single order of £21.5 million is implausible; a `SUM` over a year of orders,
a B2B invoice, or a lifetime-revenue figure passes 2^31 cents easily and wraps to a negative
revenue. Use `long` for every monetary field, not only the aggregate ones, so no one has to know
which fields get summed.

## Gotchas

**★ Symptom: `long total = price * quantity;` produces a negative or absurd total.** Cause: both
operands are `int`, so the multiplication is a 32-bit multiplication that wraps, and only the wrong
result is widened. Fix: `(long) price * quantity` — cast an *operand*, not the result. `(long)
(price * quantity)` is the version that looks right and does nothing.

**★ Symptom: `(int) someLong` produces a plausible but wrong number.** Cause: a narrowing cast keeps
the low 32 bits and reinterprets the sign bit; it never complains. Fix: `Math.toIntExact(someLong)`,
which *"Returns the value of the `long` argument, throwing an exception if the value overflows an
`int`."*

**★ Symptom: `if (a + b > Integer.MAX_VALUE)` never fires.** Cause: the sum wrapped before the
comparison, so it is by definition not greater than `MAX_VALUE` — the check is unreachable. Fix:
`Math.addExact` and catch `ArithmeticException`, or the sign test
`((a ^ r) & (b ^ r)) < 0`, or widen to `long` and compare there.

**★ Symptom: `IntStream.sum()` returns a negative total.** Cause: the terminal operation sums into
an `int`. Fix: `mapToLong(...).sum()`. Mapping to the wider type must happen *before* the terminal
operation; assigning the result to a `long` afterwards is too late, exactly as with the
multiplication.

**★ Symptom: a value that is correct in the database is wrong in the JVM.** Cause: a `bigint` column
read into an `int` field — by an ORM mapping, a `getInt` call, or a narrowing cast in a row mapper.
Fix: `long` in the entity, and `Math.toIntExact` at any boundary that genuinely needs an `int`, so
the truncation becomes an exception rather than a silent change of value.

**Symptom: `Math.abs(x)` returns a negative number.** Cause: `x` was `Integer.MIN_VALUE`, whose
negation is not representable in the asymmetric range. Fix: mask (`x & 0x7FFF_FFFF`) if you wanted a
non-negative index, or widen to `long` before negating if you wanted the magnitude.

**Symptom: an `ArithmeticException` from a division you thought could not fail.** Cause:
`Integer.MIN_VALUE / -1`, the only overflowing division of two `int`s, or a division by zero. Fix:
handle `MIN_VALUE` explicitly, or do the division in `long`.

**Symptom: money went negative in a report but is right on every order page.** Cause: the per-row
field fits an `int` and the aggregate does not — a sum over enough rows crosses 2^31 cents, about
£21.5 million. Fix: `long` for the monetary type everywhere, so the aggregation path cannot be the
one place that was overlooked.

**Symptom: `Math.addExact` in a tight numeric loop is proposed and rejected on performance
grounds.** Cause: an assumption with no measurement behind it. Fix: this page has no benchmark and
neither does the javadoc; if the cost matters, measure that loop. The default should be the checked
form wherever the operands are data-dependent, because a wrong answer is more expensive than a
branch you have not measured.

## Interview questions

**★ What does Java do when an `int` overflows, and how do you make it complain?**
Nothing — the operation wraps around modulo 2^32 and the result is reinterpreted as a signed value,
so two large positives give a negative and no exception is thrown. That the ordinary operators are
silent is exactly what the `Exact` family in `java.lang.Math` is for: `addExact` *"Returns the sum of
its arguments, throwing an exception if the result overflows an `int`"*, `multiplyExact` does the
same for products, and both throw `ArithmeticException`. `toIntExact` covers the narrowing
conversion, which is the other silent lossy operation. Use them where the operands are
data-dependent, so that when arithmetic does go out of range you get a stack trace at the line that
caused it instead of a wrong number three layers away.

**★ `long total = price * quantity;` — what is wrong with this line?**
The multiplication is an `int` multiplication. In Java an expression's type comes from its operands,
not from the variable it is assigned to, so with two `int` operands the product is computed at 32
bits, wraps if it exceeds 2^31 − 1, and only then is widened to `long`. The fix is to widen an
operand before the operation: `(long) price * quantity`. Casting the result — `(long) (price *
quantity)` — changes nothing, because the damage is already done, and it is the version that passes
code review. The same rule is behind `1L << i` for `long` bitmasks and behind `mapToLong` rather
than `mapToInt` in a stream sum.

**★ How would you detect an addition overflow without `Math.addExact`?**
Not by comparing against `MAX_VALUE`, because the sum has already wrapped by the time you compare
and can never exceed it. Use the sign argument: an `int` addition overflows if and only if the two
operands share a sign and the result has the opposite one, since operands of unlike sign produce a
result between them that cannot leave the range. In code that is `((a ^ r) & (b ^ r)) < 0`, which
reads directly off the sentence — XOR is negative exactly when two values' sign bits differ, so the
AND of the two XORs has its sign bit set exactly when both differ. The other correct answer is to
widen to `long`, add there, and compare against the `int` bounds.

**★ Would you store money in an `int`?**
No — in a `long`, in minor units. An `int` cents field caps at 2,147,483,647 cents, about £21.5
million, which is comfortable for a single consumer order and not comfortable for a B2B invoice, a
monthly revenue aggregate or a lifetime total. Since the aggregate is computed from the per-row
type, making the row type `long` is what stops someone discovering the limit in a report. And it
should be integer minor units rather than a floating-point type in either language, because decimal
fractions have no exact binary representation, so a `double` total drifts from the decimal answer
independently of any range question.

**When is `BigInteger` the right answer rather than `long`?**
When the values genuinely exceed 2^63 and must stay exact: cryptographic arithmetic, factorials and
large binomial coefficients computed without a modulus, exact accumulation over an unbounded input.
Below that, `long` is the answer, because it is a machine word and every operation on it is a single
instruction, while arbitrary precision is library work whose cost grows with the operands. The same
containment advice applies as for `BigInt` in JavaScript ([05b](05b-bigint-and-when-to-reach-for-it.md)):
keep it in the layer that needs it. This page makes no claim about `BigInteger`'s API beyond its
existence — its javadoc was not consulted for it.

**Why is a wrapped `int` easier to live with than JavaScript's silent rounding?**
Because it is wrong in a way that tends to break something visibly. A wrapped sum flips sign, a
wrapped length becomes negative, an index derived from it goes out of bounds — the program usually
fails near the arithmetic. Rounding above 2^53 in a double keeps the result positive, plausible and
in the right order of magnitude, and only the low digits differ, which is exactly where identifiers
and checksums live. Java also gives you the `Exact` opt-in and a wider primitive to escape into;
JavaScript has neither for the number type, only the decision to use `BigInt` instead
([05b](05b-bigint-and-when-to-reach-for-it.md)).

---

← Prev: [05b · BigInt, and when to reach for it](05b-bigint-and-when-to-reach-for-it.md) · Index: [Phase 2 — Recursion, maths and bits](README.md) · Next → [05d · The three silent overflows](05d-the-three-silent-overflows.md)
