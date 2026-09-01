---
title: "Parsing a number from text accepts far more than a literal does, and packing one into binary32 throws away half the precision a Python float was carrying"
sidebar_label: "12d · Strings and binary formats"
sidebar_position: 123
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-01 against the Python 3.14 library reference for
> [`int()`](https://docs.python.org/3.14/library/functions.html#int),
> [`float()`](https://docs.python.org/3.14/library/functions.html#float),
> [`struct`](https://docs.python.org/3.14/library/struct.html),
> [`array`](https://docs.python.org/3.14/library/array.html) and
> [Numeric Types](https://docs.python.org/3.14/library/stdtypes.html#numeric-types-int-float-complex),
> plus [PEP 515](https://peps.python.org/pep-0515/).
> Version spine: **Python 3.14.7**; `struct`'s `'e'` half-precision code since **3.6**.

**Numbers arrive as text and leave as bytes, and both directions have surprises that
have nothing to do with arithmetic. `int()` and `float()` accept a *strictly larger*
language than the literal grammar the parser accepts, so strings that would be a
`SyntaxError` in source convert happily — and one string that looks fine raises
because of a security limit rather than a parsing one. In the other direction, the
default float format in most binary protocols is **binary32**, which carries about
seven significant decimal digits where a Python float carries about seventeen. Packing
a `float` as `'f'` discards more than half its precision, and it does so without a
word.**

## The parsing language is bigger than the literal language

```python
int('   -12_345\n')     # -12345  — surrounding whitespace and PEP 515 underscores
int('FACE', 16)         # 64206
int('0xface', 0)        # 64206   — base 0 reads the prefix
int('010')              # 10      — leading zeros are fine in a string
int('010', 8)           # 8
int('010', 0)           # ValueError — base 0 disallows leading zeros
float('   -12345\n')    # -12345.0
float('1e-003')         # 0.001
float('+1E6')           # 1000000.0
float('-Infinity')      # -inf
```

Three rules worth holding. **Whitespace around the value is stripped**, but a sign must
have *"no space in between"*. **Underscores are permitted between digits**, matching
the literal rules from PEP 515 — see
[Underscores and constructors](03b-underscores-and-constructors.md). And **base 0 means
"read the prefix"**: `0b`, `0o`, `0x` select the base exactly as a source literal
would, which is why base 0 also inherits the literal grammar's ban on leading zeros
while the default base 10 does not.

`float()`'s string grammar is the one people forget accepts the non-finite values:
*"Case is not significant, so, for example, `"inf"`, `"Inf"`, `"INFINITY"` and
`"iNfINity"` are all acceptable spellings for positive infinity."* `nan` likewise. So a
CSV column containing the literal text `inf` becomes an infinity rather than a
`ValueError`, and it will pass every validation that only checks `float()` did not
raise.

```python
def parse_measurement(text: str) -> float:
    x = float(text)                    # accepts 'inf', 'NaN', '  1e400  ' -> inf
    if not math.isfinite(x):
        raise ValueError(f"not a finite measurement: {text!r}")
    return x
```

## The one string→int conversion that raises for a non-parsing reason

`int(s)` on a decimal string longer than 4300 digits raises `ValueError` — not because
the string is malformed, but because of the integer string conversion limit added in
response to CVE-2020-10735. It is interpreter-wide and it applies to `int(str)`,
`str(int)`, `repr`, and f-string formatting, while the base-16/8/2 conversions are
exempt. The full treatment is in
[The int↔str digit limit](02-the-int-str-conversion-limit.md) and
[Configuring and avoiding it](02b-configuring-and-avoiding-the-limit.md); the point
here is that it is the one parse failure whose cause is a policy rather than the
input's shape.

## Numbers out of a `repr` come back exactly

The round trip through text is exact if you use the right text:

```python
x = 0.1
float(repr(x)) == x                    # True — shortest round-tripping decimal
float.fromhex(x.hex()) == x            # True — exact, and unambiguous
x.as_integer_ratio()                   # (3602879701896397, 36028797018963968)
```

`repr` is the human-readable exact form and `hex()` is the machine-readable one.
`hex()`/`fromhex()` is the better choice for a wire format or a test fixture: it is
shorter, it cannot be misread as a decimal approximation, and it does not depend on
the shortest-repr algorithm being identical at both ends.

## Binary formats: 'f' is not a Python float

> *"For the `'f'`, `'d'` and `'e'` conversion codes, the packed representation uses the
> IEEE 754 binary32, binary64 or binary16 format (for `'f'`, `'d'` or `'e'`
> respectively), regardless of the floating-point format used by the platform."*

| Code | Format | Standard size | Significant decimal digits |
|---|---|---|---|
| `'e'` | binary16 | 2 | ~3 |
| `'f'` | binary32 | 4 | ~7 |
| `'d'` | binary64 | 8 | ~17 |

A Python `float` **is** a binary64. So `'d'` is the only lossless one, and `'f'` — the
one whose name reads like "float" — silently discards more than half the precision:

```python
import struct
struct.unpack('f', struct.pack('f', 0.1))[0]     # 0.10000000149011612
struct.unpack('d', struct.pack('d', 0.1))[0]     # 0.1 — the same float back
```

Nothing raises. The value simply comes back different, and the difference (about
`1.5e-9` here) is far larger than any tolerance you would have chosen for binary64
work. This is the single most common way precision leaves a Python process into a
binary protocol, a graphics buffer or a file format, and the fix is to know which code
the format on the other side actually specifies.

`'e'` is narrower still: *"a sign bit, a 5-bit exponent and 11-bit precision (with 10
bits explicitly stored)"*, representing *"numbers between approximately `6.1e-05` and
`6.5e+04` at full precision"*. Values outside that range do not round — they go to
zero or to infinity.

The `array` module has the same distinction in its typecodes (`'f'` for
single-precision, `'d'` for double), and so does every numeric library's dtype system.
Wherever you see a 4-byte float, precision is being spent.

## Integers into fixed-width fields

The integer codes have the failure mode floats do not: they raise rather than
truncate.

```python
struct.pack('>i', 2**31)      # struct.error — out of range for the format
struct.pack('>q', 2**31)      # fine, 8 bytes
```

That is the right behaviour and it is worth noticing precisely because the float codes
do the opposite. Packing an integer too large for its field is loud; packing a float
too precise for its field is silent. So a schema review should check the float widths
much harder than the integer widths.

## Gotchas

### `float('inf')` accepted from user input
**Symptom.** A validated numeric field ends up holding an infinity, and the failure
appears much later in an aggregate.
**Cause.** `float()`'s documented grammar accepts `inf`, `Infinity` and `nan` in any
case, so parsing succeeds.
**Fix.** Check finiteness after parsing, not just that parsing succeeded.
```python
if not math.isfinite(x):
    raise ValueError(f"non-finite input: {text!r}")
```

### `int('010', 0)` raising while `int('010')` does not
**Symptom.** A base-detecting parser rejects zero-padded input that the plain
converter accepts.
**Cause.** Base 0 follows the source-literal grammar, which disallows leading zeros;
base 10 does not.
**Fix.** Use base 0 only where you genuinely want prefix detection, and strip padding
first if the input is zero-padded.

### Packing with `'f'` and expecting a Python float back
**Symptom.** A value round-trips through a binary format and comes back changed in the
eighth significant digit, with nothing raised.
**Cause.** `'f'` is binary32, roughly seven significant decimal digits; a Python float
is binary64, roughly seventeen.
**Fix.** Use `'d'` when the receiving format allows it, and treat `'f'` as a
deliberate narrowing when it does not.
```python
struct.pack('<d', value)      # lossless for a Python float
```

### `'e'` used for small magnitudes
**Symptom.** Values below about `6.1e-05` come back as zero.
**Cause.** binary16's range is roughly `6.1e-05` to `6.5e+04` at full precision;
outside it, values flush to zero or infinity rather than rounding.
**Fix.** Scale into range before packing, or use a wider code.

### Trusting `float()` succeeding as validation
**Symptom.** Whitespace-padded, underscore-separated or exponent-form values are
accepted where a strict format was intended.
**Cause.** The conversion language is deliberately permissive, and strictly larger than
the literal grammar.
**Fix.** Validate the shape with a pattern first, then convert — or use the 3.14
`from_number` constructors where a string should be rejected entirely.

### A very long digit string raising `ValueError`
**Symptom.** `int(s)` fails on a string that is entirely well-formed digits.
**Cause.** The 4300-digit interpreter-wide conversion limit, not a parsing problem.
**Fix.** Raise the limit deliberately or use an exempt base — the options are in
[Configuring and avoiding it](02b-configuring-and-avoiding-the-limit.md).

### Assuming `repr` round trips across languages
**Symptom.** A fixture written by Python and read by another runtime differs in the
last bit.
**Cause.** `repr` guarantees the round trip *in Python*; another language's parser may
not implement shortest-repr identically.
**Fix.** Use `float.hex()` / `fromhex()`, or the integer ratio, for anything that must
be bit-exact across a boundary.

## Interview questions

**What does `int()` accept that a source literal does not?**
Surrounding whitespace, and leading zeros in base 10. It accepts underscores between
digits like a literal, and with `base=0` it follows the literal grammar exactly —
including the ban on leading zeros.

**What does `float('Infinity')` do?**
Returns positive infinity. The documented grammar accepts `inf`, `Infinity` and `nan`
case-insensitively, so parsing a user-supplied string is not by itself validation.

**Why might `int(s)` raise on a string of nothing but digits?**
The integer string conversion limit — 4300 decimal digits by default, interpreter-wide,
added for CVE-2020-10735. It is a policy limit, not a parse failure, and base 16/8/2
conversions are exempt.

**Which `struct` codes are lossless for a Python float?**
Only `'d'`. A Python float is IEEE 754 binary64; `'f'` is binary32 (~7 significant
digits) and `'e'` is binary16 (~3), and both narrow silently.

**What does `struct.unpack('f', struct.pack('f', 0.1))` give?**
`0.10000000149011612` — the binary32 neighbour of 0.1 widened back to binary64. No
exception is raised; the value is simply different.

**How do integer and float `struct` codes fail differently?**
Integers raise `struct.error` when out of range for the field; floats narrow silently.
So a schema review should scrutinise float widths far harder than integer widths.

**What is the range of `struct`'s `'e'` code?**
Roughly `6.1e-05` to `6.5e+04` at full precision, with a 5-bit exponent and 11-bit
precision. Outside that, values flush to zero or infinity instead of rounding.

**What is the most reliable text form of a float for a fixture or a wire format?**
`float.hex()` with `float.fromhex()`, or `as_integer_ratio()`. `repr` round-trips
exactly within Python, but relies on shortest-repr being implemented identically at
both ends, which another runtime does not guarantee.

**Is a successful `float(text)` enough validation?**
No. It accepts whitespace, underscores, exponent forms and the non-finite spellings.
Validate the shape first, check `math.isfinite` after, or use the 3.14 `from_number`
constructors where a string must be rejected outright.

**Where does `array` fit into this?**
Its typecodes carry the same single/double distinction — `'f'` is 4-byte
single-precision, `'d'` is 8-byte double — so storing Python floats in an `'f'` array
narrows every element on the way in.

---

← Prev: [Silent loss and boundaries](12c-silent-loss-and-boundaries.md) · Index: [Numbers](README.md) · Next → [`complex`](13-complex-and-the-numeric-tower.md)
