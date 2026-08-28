---
title: "Bitwise operations happen in a two's complement with infinitely many sign bits, which is why every 32-bit algorithm ported from C needs a mask"
sidebar_label: "1b · Bitwise on an infinite width"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-28 against the Python 3.14 library reference
> [Bitwise Operations on Integer Types](https://docs.python.org/3.14/library/stdtypes.html#bitwise-operations-on-integer-types)
> and [Additional Methods on Integer Types](https://docs.python.org/3.14/library/stdtypes.html#additional-methods-on-integer-types),
> the [Boolean Type](https://docs.python.org/3.14/library/stdtypes.html#boolean-type-bool)
> deprecation note, and the language reference on
> [unary arithmetic and bitwise operations](https://docs.python.org/3.14/reference/expressions.html#unary-arithmetic-and-bitwise-operations).
> Version spine: **Python 3.14.7**.

**Because an `int` has no fixed width, it has no sign bit — so Python defines
every bitwise operation as if the value sat in a two's-complement register with
infinitely many sign bits. That one decision explains `~5 == -6`, explains why
`-7 >> 1` is `-4` and not `-3`, explains why nothing ever falls off the top on
a left shift, and explains why every 32-bit hash, CRC or PRNG ported from C is
wrong until you add a mask. The mask is not an optimisation. It is the type
declaration Python does not have.**

## Infinite sign bits

The reference is explicit:

> *"Bitwise operations only make sense for integers. The result of bitwise
> operations is calculated as though carried out in two's complement with an
> infinite number of sign bits."*

Four consequences you should be able to derive on demand.

**`~x` is exactly `-(x + 1)`.** The language reference: *"The bitwise inversion
of `x` is defined as `-(x+1)`."* So `~0` is `-1`, `~5` is `-6`, `~-1` is `0`.
There is no width for the inversion to be relative to, so Python gives the
mathematically consistent answer rather than a width-dependent one like
`0xFFFFFFFA`.

**`x >> n` is floor division, not truncation.** The reference: *"A right shift
by `n` bits is equivalent to floor division by `pow(2, n)`."* Therefore
`-7 >> 1` is `-4`, matching `-7 // 2`. There is no logical (zero-filling) right
shift, because there is nothing to fill *from*.

**`x << n` is exactly multiplication by `2**n`,** unbounded. The reference: *"A
left shift by `n` bits is equivalent to multiplication by `pow(2, n)`."*
Nothing falls off the top; the integer just gets bigger.

**Negative shift counts raise.** *"Negative shift counts are illegal and cause a
`ValueError` to be raised."* Not undefined behaviour, not a reverse shift.

There is a fifth, quieter statement in the reference, and it is the one that
tells you how to reproduce Python's answers on real hardware:

> *"Performing these calculations with at least one extra sign extension bit in
> a finite two's complement representation (a working bit-width of
> `1 + max(x.bit_length(), y.bit_length())` or more) is sufficient to get the
> same result as if there were an infinite number of sign bits."*

## Porting fixed-width code: the mask is the type declaration

In C, `x << 1` on a `uint32_t` drops the top bit — the type *is* the
truncation. Python has no such type, so you write the truncation yourself,
after every operation that can widen the value:

```python
MASK32 = 0xFFFF_FFFF

def fnv1a_32(data: bytes) -> int:
    h = 0x811C_9DC5
    for byte in data:
        h ^= byte
        h = (h * 0x0100_0193) & MASK32   # the mask IS the uint32_t
    return h


def rotl32(x: int, n: int) -> int:
    x &= MASK32
    return ((x << n) | (x >> (32 - n))) & MASK32
```

Omit the mask and two things break at once: the answer diverges from the
reference implementation, and the loop gets slower every iteration as the
bignum grows. Both symptoms have one cause.

Reproducing a *signed* 32-bit type takes one more step, because masking gives
the unsigned interpretation:

```python
def to_int32(x: int) -> int:
    x &= 0xFFFF_FFFF
    return x - 0x1_0000_0000 if x & 0x8000_0000 else x
```

Clearing bits, by contrast, needs no mask at all — the infinite sign bits of
`~MASK` cancel inside the `&`:

```python
flags = flags & ~FLAG_DIRTY          # correct as written, at any width
```

## The integer methods worth knowing

```python
n = 1234

n.bit_length()                 # bits needed, excluding sign and leading zeros
n.bit_count()                  # population count: number of 1 bits (3.10+)
n.to_bytes(4, "big")           # length and byteorder default to 1 and "big" (3.11+)
int.from_bytes(b"\x04\x00", "big")
n.as_integer_ratio()           # (1234, 1) — duck-types with float (3.8+)
n.is_integer()                 # always True; exists for symmetry with float (3.12+)
```

`bit_length` has a precise contract, and it is the correct replacement for a
floating-point logarithm on large values:

> *"More precisely, if `x` is nonzero, then `x.bit_length()` is the unique
> positive integer `k` such that `2**(k-1) <= abs(x) < 2**k`. […] If `x` is
> zero, then `x.bit_length()` returns 0."*

`math.log2(n)` on a 400-digit integer raises `OverflowError`, because it must
build a `float` first. `n.bit_length()` never does.

`bit_count` is documented as *"the number of ones in the binary representation
of the **absolute value** of the integer"*, so `(-19).bit_count()` equals
`(19).bit_count()`. There is no finite two's-complement pattern for it to count
instead.

`to_bytes` and `from_bytes` are exempt from the
[string-conversion limit](02-the-int-str-conversion-limit.md), because base-256
is a power of two and therefore linear.

## Gotchas

### A ported hash or PRNG that diverges after a few rounds
**Symptom.** A CRC32, FNV or xorshift implementation matches the reference
vectors for one-byte inputs and drifts for longer ones.
**Cause.** In C every shift and multiply is implicitly truncated to the word
width; in Python nothing is, so the intermediate grows and every subsequent
step operates on a different number.
**Fix.** `& 0xFFFF_FFFF` after each widening operation — as in `fnv1a_32`
above. Add one test against a published vector, because the bug is invisible
for short inputs.

### The same bug seen as a performance problem
**Symptom.** A loop that "does the same work each time" gets steadily slower,
and the profile is dominated by one multiply.
**Cause.** The unmasked value is growing, and bignum multiplication is
super-linear in digit count.
**Fix.** The mask. A fixed-width algorithm running in constant time is the
*evidence* that the truncation is present.

### `~` used as a logical "not"
**Symptom.** `~found` is `-1` when `found` is `False` — and truthy either way,
so a guard never fires. Or a `DeprecationWarning` appears on `~some_bool`.
**Cause.** `~x` is `-(x+1)`, an arithmetic operation, not a logical one. On a
`bool` it is also being removed: *"The use of the bitwise inversion operator `~`
is deprecated and will raise an error in Python 3.16."*
**Fix.** `not found` for logical negation; `(~word) & 0xFFFF_FFFF` to invert a
fixed-width word.

### `>>` on a negative number expecting truncation
**Symptom.** `-1 >> 1` is `-1` and `-7 >> 1` is `-4`; someone expected `0` and
`-3`.
**Cause.** `>>` is *defined* as floor division by `2**n`, and floor rounds
toward minus infinity.
**Fix.** Negate around the shift when you want truncation toward zero:

```python
def shr_trunc(x: int, n: int) -> int:
    return -((-x) >> n) if x < 0 else x >> n
```

### `int.bit_count()` used to count two's-complement bits
**Symptom.** A "count set bits" routine returns the same answer for `n` and
`-n`.
**Cause.** `bit_count` counts the ones in the absolute value.
**Fix.** Choose a width and mask before counting:
`(n & 0xFFFF_FFFF).bit_count()`.

### `1 << n` used as a bounded flag set
**Symptom.** A bitmask "register" quietly accumulates bits beyond the width the
protocol allows, and only the wire format rejects it.
**Cause.** Left shift never overflows, so a bit index out of range produces a
larger integer instead of an error.
**Fix.** Validate the index, or use `enum.IntFlag`, which gives named members,
a bounded set and a readable `repr`.

## Interview questions

**What does `~5` evaluate to, and why?**
`-6`. The language reference defines `~x` as `-(x+1)` because bitwise
operations are computed as though in two's complement with infinitely many sign
bits. There is no fixed word width for the inversion to be relative to, so
Python gives the mathematically consistent result rather than `0xFFFFFFFA`.

**`x >> 1` on a negative integer — what does it do?**
An arithmetic shift with floor semantics, because `>>` is defined as floor
division by `2**n`. `-7 >> 1` is `-4`. Python has no logical right shift, since
there is no fixed width to zero-fill from; to get one, mask to a width first.

**Someone ports a 32-bit hash from C and the outputs diverge. Diagnose it.**
The C version truncates to 32 bits on every operation because the type says so;
Python does not truncate at all. The intermediate value grows without bound, so
every subsequent step operates on a different number, and the loop also gets
progressively slower as the bignum widens. Mask with `& 0xFFFF_FFFF` after each
widening step; for a signed result, subtract `2**32` when the sign bit is set.

**Does `x << 64` ever lose information in Python?**
No. Left shift is defined as multiplication by `2**n` and `int` is unbounded,
so the value simply grows. That is precisely why fixed-width ports need an
explicit mask — the operation that silently truncates in C is lossless here.

**How do you get the number of bits in a large integer without going through a
float?**
`n.bit_length()`. It is exact — the unique `k` with
`2**(k-1) <= abs(n) < 2**k` — and works far beyond `float` range.
`math.log2(n)` raises `OverflowError` on such values because it must build a
`float` first.

**Why does `flags & ~MASK` work correctly without masking, when `x << n`
doesn't?**
Because `~MASK` is a negative number whose infinite leading sign bits are all
ones, and `&` with those ones is the identity on every high bit of `flags`.
The result is bounded by `flags` itself. A left shift has no such bound: it
produces bits above anything present in the operands, and only an explicit mask
can remove them.

---

← Prev: [`int` never overflows](01-int-never-overflows.md) · Index: [Numbers](README.md) · Next → [Integer identity and the boundaries out of Python](01c-identity-and-boundaries.md)
