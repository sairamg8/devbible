---
title: "Floor division rounds toward minus infinity and modulo takes the sign of the divisor, which is the opposite of Java, C, C# and JavaScript"
sidebar_label: "8 · Floor division and modulo"
sidebar_position: 80
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-31 against the Python 3.14 language reference
> [Binary arithmetic operations](https://docs.python.org/3.14/reference/expressions.html#binary-arithmetic-operations),
> the library reference
> [Numeric Types — int, float, complex](https://docs.python.org/3.14/library/stdtypes.html#numeric-types-int-float-complex)
> and [`divmod()`](https://docs.python.org/3.14/library/functions.html#divmod),
> and — for the cross-language contrast — the Java SE 21 javadoc for
> [`java.lang.Math.floorDiv` / `floorMod`](https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/lang/Math.html).
> Version spine: **Python 3.14.7**.

**`-7 // 2` is `-4` in Python and `-3` in every C-derived language you have
ever used. This is not a quirk and it is not a bug: Python picked *floored*
division, so the quotient always rounds toward minus infinity and the remainder
always carries the sign of the **divisor**. That single choice makes `x % n`
safe for clock arithmetic, ring buffers, hash sharding and day-of-week
calculations on negative inputs — cases where C's `%` hands you a negative
index and a crash. It also means every formula you port from Java, C, C# or
JavaScript that involves `/` or `%` on a possibly-negative numerator is wrong
until you check it, and every formula you port *out* of Python is wrong in the
other direction.**

This chunk covers the rule and the invariant behind it.
[08b](08b-ceiling-division-and-integer-edges.md) covers ceiling division and
integer exactness; [08c](08c-zero-divisors-and-the-operator-protocol.md) covers
zero divisors, result types and the operator protocol;
[08d](08d-modulo-on-floats-and-decimals.md) covers the fact that `Decimal`
truncates where `int` floors; and
[08e](08e-float-modulo-fmod-and-remainder.md) covers what happens on floats.

## The rule, stated exactly

The library reference gives the definition and the four sign cases in one
sentence, and the examples are worth memorising because they cover every
combination:

> *"Also referred to as integer division. For operands of type `int`, the
> result has type `int`. For operands of type `float`, the result has type
> `float`. In general, the result is a whole integer, though the result's type
> is not necessarily `int`. The result is always rounded towards minus
> infinity: `1//2` is `0`, `(-1)//2` is `-1`, `1//(-2)` is `-1`, and
> `(-1)//(-2)` is `0`."*

The language reference says the same thing about the operator itself:

> *"Division of integers yields a float, while floor division of integers
> results in an integer; the result is that of mathematical division with the
> 'floor' function applied to the result."*

And for `%`:

> *"The modulo operator always yields a result with the same sign as its second
> operand (or zero); the absolute value of the result is strictly smaller than
> the absolute value of the second operand."*

Read those two together. `//` floors — it rounds *down the number line*, not
toward zero. `%` takes the sign of the **right-hand** operand. Those are not
two independent design decisions; the second follows from the first.

## The invariant that forces it

Python guarantees one identity, and everything else is a consequence:

> *"The floor division and modulo operators are connected by the following
> identity: `x == (x//y)*y + (x%y)`. Floor division and modulo are also
> connected with the built-in function `divmod()`: `divmod(x, y) == (x//y,
> x%y)`."*

Work `-7` and `2` through it. If `//` floors, `-7 // 2` is `-4`. The identity
then pins the remainder: `-7 == (-4)*2 + r`, so `r == 1`. Positive — the sign
of the divisor. If instead `//` truncated toward zero you would get `-3`, and
the identity would force `-7 == (-3)*2 + r`, so `r == -1`. Negative — the sign
of the dividend. That is exactly the C/Java behaviour. **You cannot have
floored division and a dividend-signed remainder at the same time; the
invariant does not allow it.**

```python
# Every sign combination, and the invariant holding in each.
for x, y in [(7, 2), (-7, 2), (7, -2), (-7, -2)]:
    q, r = divmod(x, y)
    assert q * y + r == x                  # always true
    assert r == 0 or (r < 0) == (y < 0)    # remainder sign follows divisor
```

`divmod()` is not a convenience wrapper — it is the natural primitive here, and
computing both halves at once is the shape most real code wants:

```python
minutes, seconds = divmod(total_seconds, 60)
hours,   minutes = divmod(minutes, 60)
days,    hours   = divmod(hours, 24)
```

Nested `divmod` for unit breakdown is correct for negative totals too, because
each remainder is guaranteed non-negative when the divisor is positive. The
truncating version of the same code produces `-1` seconds.

## What every other language does — and why this bites on ports

Java's own standard library documents the contrast, because Java had to *add*
floored operators later:

> *"Normal integer division operates under the round to zero rounding mode
> (truncation). This operation instead acts under the round toward negative
> infinity (floor) rounding mode. The floor rounding mode gives different
> results from truncation when the exact quotient is not an integer and is
> negative."* — javadoc for `Math.floorDiv`

> *"The floor modulus is `r = x - (floorDiv(x, y) * y)`, has the same sign as
> the divisor `y` or is zero […] If neither `floorMod(x, y)` nor `x % y` is
> zero, they differ exactly when the signs of the arguments differ."*
> — javadoc for `Math.floorMod`

The javadoc even lists the divergence cases, which double as a Python
translation table:

| Operands | Java `/` , `%` | Python `//` , `%` |
|---|---|---|
| `+4, +3` | `1` , `+1` | `1` , `1` |
| `-4, -3` | `1` , `-1` | `1` , `-1` |
| `+4, -3` | `-1` , `+1` | `-2` , `-2` |
| `-4, +3` | `-1` , `-1` | `-2` , `2` |

So: **Python's `a // b` is Java's `Math.floorDiv(a, b)`, and Python's `a % b`
is Java's `Math.floorMod(a, b)`.** They agree with Java's bare `/` and `%` only
when the operands share a sign. JavaScript's `%` and C's `%` (mandated
truncating since C99) behave like Java's.

The practical consequence: a ported algorithm that only ever sees non-negative
inputs works perfectly for months, and then one negative offset — a timestamp
before the epoch, a longitude west of Greenwich, a scroll position of `-1` —
picks the wrong branch. There is no error, only a wrong answer.

## What floored semantics actually buys you

Every one of these is *correct with no special case* in Python, and needs a
guard in C:

```python
# 1. Clock / angle wrap-around. Works for any offset, positive or negative.
hour = (hour + delta) % 24
bearing = (bearing + turn) % 360

# 2. Ring buffer index. Never negative, so never an IndexError.
slot = buffer[cursor % len(buffer)]

# 3. Hash sharding. hash() returns negative values roughly half the time.
shard = hash(key) % shard_count          # always in [0, shard_count)

# 4. Day of week from a signed day offset.
weekday = (base_weekday + day_delta) % 7

# 5. Grid coordinates from a signed linear index.
row, col = divmod(index, width)          # col is always in [0, width)
```

Point 3 is the one that actually catches people, and it catches them in the
other direction: developers who *learned* C write `abs(hash(key)) % n`, which
is unnecessary in Python and is subtly worse — it maps two different hashes
onto the same shard and biases the distribution.

## Gotchas

**★ A ported C or Java formula with a negative numerator silently returns a
different answer.** No exception, no warning, just an off-by-one that only
appears for negative inputs. The mechanical translation is `Math.floorDiv`
→ `//` and `Math.floorMod` → `%`. If the original really wanted truncation,
write it explicitly and stay in the integer domain:

```python
def trunc_div(a: int, b: int) -> int:
    """C-style truncating division, exact for arbitrarily large ints."""
    q = abs(a) // abs(b)
    return q if (a < 0) == (b < 0) else -q

def c_mod(a: int, b: int) -> int:
    """C-style remainder: sign follows the dividend."""
    return a - trunc_div(a, b) * b
```

**★ Porting *out* of Python fails the same way, and nobody checks that
direction.** A Python expression `(i - 1) % n` reimplemented verbatim in Go,
Rust, C# or JavaScript produces a negative index for `i == 0`. In Java write
`Math.floorMod(i - 1, n)`; in Rust use `(i - 1).rem_euclid(n)`; in JavaScript
there is no built-in, so write `((i - 1) % n + n) % n`. Reviewing a port only
in the incoming direction catches half the bugs.

**★ `abs(hash(key)) % n` is a C habit that biases your sharding.** `hash()`
legitimately returns negatives; `%` already normalises them into `[0, n)`.
Taking `abs()` first folds `h` and `-h` onto the same bucket. Write
`hash(key) % n`.

**★ `hash()` is not a *stable* shard key across processes.** `str` and `bytes`
hashing is randomised per interpreter run unless `PYTHONHASHSEED` is fixed, so
`hash(key) % n` reshuffles every restart. That is a different bug from the sign
one, and the fix is a stable digest:

```python
import hashlib

def shard_of(key: str, n: int) -> int:
    digest = hashlib.blake2b(key.encode("utf-8"), digest_size=8).digest()
    return int.from_bytes(digest, "big") % n
```

**★ The invariant is a promise about *exact* arithmetic, not about floats.**
`x == (x//y)*y + (x%y)` is exact in the integer domain. For floats it holds
approximately, and the docs give a case where it visibly does not — see
[08e](08e-float-modulo-fmod-and-remainder.md).

**★ `Decimal` breaks the rule this whole page states.** `Decimal(-7) // Decimal(4)`
is `Decimal('-1')`, not `-2`: `Decimal`'s `//` truncates toward zero. If a
codebase mixes `int` arithmetic with `Decimal` arithmetic, the *same expression*
gives two answers depending on the operand type. This is the single highest-value
fact in the numbers topic and it has its own chunk,
[08d](08d-modulo-on-floats-and-decimals.md).

## Interview questions

**★ Why is `-7 // 2` equal to `-4` rather than `-3`?**
Because `//` is defined as mathematical division with `floor` applied, and
`floor(-3.5)` is `-4` — it rounds down the number line, not toward zero. The
docs state it directly: *"The result is always rounded towards minus
infinity."* Java, C, C# and JavaScript truncate toward zero and produce `-3`.
Neither is more correct; they are different conventions with different
downstream consequences.

**★ Given that `//` floors, derive the sign of `%` without looking it up.**
Python guarantees `x == (x//y)*y + (x%y)`. Rearranged, `x % y == x - (x//y)*y`.
If `//` floors, then `(x//y)*y` is the largest multiple of `y` at or below `x`
when `y` is positive, so the leftover is in `[0, y)` — non-negative. When `y`
is negative, floor moves the multiple the other way and the leftover lands in
`(y, 0]` — non-positive. Either way the remainder carries the sign of `y`.
Floored division and a divisor-signed remainder are the same fact stated twice.

**★ You are porting `int idx = (i - 1) % n;` from Java. What breaks?**
When `i` is `0`, Java gives `-1 % n == -1`, and the original code presumably
guards for that or indexes from the end deliberately. Python gives `n - 1`. If
the Java code had an `if (idx < 0) idx += n;` fix-up line, that line is now dead
in Python and harmless; if it *didn't*, the Java code was relying on a negative
index to signal something, and the Python port silently wraps instead. Either
way, read the guard, don't just translate the expression.

**★ Why is `hash(key) % shard_count` safe in Python but not in C?**
Because Python's `%` returns a result with the sign of the divisor, so a
negative hash still lands in `[0, shard_count)`. In C the remainder takes the
sign of the dividend, so a negative hash yields a negative index and the array
access is undefined behaviour. The Python idiom needs no `abs()` and no guard.

**★ What does `divmod(x, y)` give you that `x // y` and `x % y` do not?**
One operation instead of two, and — for user-defined types — a single
`__divmod__` call rather than two independent dispatches that could disagree.
For built-in ints the docs define it as exactly the pair `(x // y, x % y)`, so
semantically nothing; the value is expressive and, for large integers, avoids
performing the division twice.

**★ Name three real algorithms that are simpler because of floored modulo.**
Clock and compass wrap-around (`(h + delta) % 24`), ring-buffer indexing
(`buf[cursor % len(buf)]`), and hash sharding (`hash(k) % n`). In all three the
C version needs an `if (r < 0) r += n;` correction that Python's semantics make
unnecessary — and that correction is the line people forget.

**★ Is the invariant `x == (x//y)*y + (x%y)` guaranteed for every numeric
type?**
It is the identity the *language reference* states for the built-in operators,
and `Decimal` explicitly preserves it — but it preserves it by making `//`
truncate rather than floor, so `Decimal` satisfies the invariant while
disagreeing with `int` on both halves. The invariant is a consistency promise
between `//` and `%` within a type, not a cross-type promise about the value of
either one.

---

← Prev: **Comparing floats** *(not written yet)* · Index: [Numbers](README.md) · Next → [Ceiling division and integer edges](08b-ceiling-division-and-integer-edges.md)

{/* FOOTER */}
