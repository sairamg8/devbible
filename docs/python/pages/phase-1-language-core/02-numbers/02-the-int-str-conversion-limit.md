---
title: "The 4300-digit integer string conversion limit: the one place an int behaves as if it had a maximum size, and it is not arithmetic"
sidebar_label: "2 · The int↔str digit limit"
sidebar_position: 4
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-28 against the Python 3.14 library reference
> [Integer string conversion length limitation](https://docs.python.org/3.14/library/stdtypes.html#integer-string-conversion-length-limitation)
> and [`sys.int_info`](https://docs.python.org/3.14/library/sys.html#sys.int_info).
> Version spine: **Python 3.14.7**; the limit was added in **3.11** and
> backported to the 3.7–3.10 security branches.

**Since Python 3.11 there is exactly one place where an `int` behaves as if it
had a maximum size, and it is not arithmetic — it is conversion between an
`int` and a base-10 *string*. `int("9" * 5000)` raises `ValueError`. So does
`str(n)` when `n` has more than 4300 digits, and so do `f"{n}"`, `repr(n)` and
`"%d" % n`. This is a deliberate denial-of-service mitigation for
CVE-2020-10735, it does not apply to hex, octal, binary, `to_bytes`, `float` or
`Decimal`, and it bites on **output** at least as often as on input — the
failing line is usually a log statement a long way from where the number was
built.**

## The mechanism

The reference states the reason plainly:

> *"CPython has a global limit for converting between `int` and `str` to
> mitigate denial of service attacks. This limit only applies to decimal or
> other non-power-of-two number bases. Hexadecimal, octal, and binary
> conversions are unlimited. The limit can be configured."*

And the algorithmic fact underneath it:

> *"The `int` type in CPython is an arbitrary length number stored in binary
> form (commonly known as a 'bignum'). There exists no algorithm that can
> convert a string to a binary integer or a binary integer to a string in
> linear time, unless the base is a power of 2. Even the best known algorithms
> for base 10 have sub-quadratic complexity. Converting a large value such as
> `int('1' * 500_000)` can take over a second on a fast CPU."*

> *"Limiting conversion size offers a practical way to avoid CVE 2020-10735."*

That is the attack in full: a JSON body, form field or URL parameter containing
a million digits, parsed by a web framework into an `int`, burns CPU
quadratically on one request. No memory exhaustion, no crash — just a worker
pinned for seconds by a few hundred kilobytes of input, repeated as often as the
attacker likes.

Why powers of two are exempt is worth internalising rather than memorising: in
base 16 each output digit is a fixed group of four input bits, so the conversion
is a regrouping — linear, one pass. In base 10 there is no such alignment, so
the conversion is a sequence of divisions whose cost grows with the size of the
remaining value.

The counting rule is precise:

> *"The limit is applied to the number of digit characters in the input or
> output string when a non-linear conversion algorithm would be involved.
> Underscores and the sign are not counted towards the limit."*

## What is affected and what is not

The reference splits the world exactly.

**Limited** — *"The limitation only applies to potentially slow conversions
between `int` and `str` or `bytes`"*:

- `int(string)` with default base 10
- `int(string, base)` for all bases that are not a power of 2
- `str(integer)`
- `repr(integer)`
- *"any other string conversion to base 10, for example `f"{integer}"`,
  `"{}".format(integer)`, or `b"%d" % integer`"*

**Unlimited** — *"The limitations do not apply to functions with a linear
algorithm"*:

- `int(string, base)` with base 2, 4, 8, 16, or 32
- `int.from_bytes()` and `int.to_bytes()`
- `hex()`, `oct()`, `bin()`
- the format specification mini-language for hex, octal and binary numbers
- `str` to `float`
- `str` to `decimal.Decimal`

Those last two matter more than they look. **`Decimal` is exempt**, so a
service that must accept unbounded decimal input from users can parse it as a
`Decimal` and never encounter the limit at all.

## The numbers, and the error

```python
import sys

sys.int_info.default_max_str_digits      # the compiled-in default
sys.int_info.str_digits_check_threshold  # lowest configurable non-zero value
sys.get_int_max_str_digits()             # the current interpreter-wide limit
```

The reference pins both constants:

> *"The default limit is 4300 digits as provided in
> `sys.int_info.default_max_str_digits`. The lowest limit that can be
> configured is 640 digits as provided in
> `sys.int_info.str_digits_check_threshold`."*

4300 digits is roughly a 14 000-bit integer — orders of magnitude above any
plausible business value, and well below the size at which conversion becomes a
weapon.

The exception is `ValueError`, and its message names the escape hatch. The
reference gives the exact text:

> *"`ValueError: Exceeds the limit (4300 digits) for integer string conversion:
> value has 5432 digits; use sys.set_int_max_str_digits() to increase the
> limit`"*

## The limit bites on output

The reference's own example is the one to remember: `i = int('2' * 4300)`
succeeds, `len(str(i))` is 4300 — and `len(str(i * i))` raises, because the
product has about 8600 digits. Its hexadecimal form is unaffected; the docs show
`len(hex(i_squared))` returning 7144 and
`assert int(hex(i_squared), base=16) == i*i` passing, annotated *"Hexadecimal is
unlimited."*

So the number exists, the arithmetic is exact, and only its decimal rendering
is refused. In practice that means the traceback points at your logging, your
`repr`, your JSON encoder or your assertion message — not at the code that
built the value.

## Gotchas

### `ValueError` from a log line, not from the computation
**Symptom.** A cryptographic or combinatorial routine computes fine, then
`logger.info("result=%s", n)` or an f-string raises `ValueError`.
**Cause.** The limit applies to `str(int)` and `repr(int)` as well as to
parsing, so any base-10 rendering of an over-limit value fails.
**Fix.** Log a bounded summary rather than the value:

```python
logger.info("result: %d bits, 0x%s…", n.bit_length(), format(n, "x")[:32])
```

`format(n, "x")` uses the hexadecimal format spec, which is exempt.

### Squaring a legal value produces an unprintable one
**Symptom.** `int('2' * 4300)` is accepted; `str(x * x)` raises.
**Cause.** Multiplication roughly doubles the digit count, and the limit is
checked per conversion, not per value.
**Fix.** Convert through `hex()` or `to_bytes()`, or widen the limit around
just that conversion — see
[configuring the limit](02b-configuring-and-avoiding-the-limit.md).

### `int(user_input)` on an unbounded field
**Symptom.** An unfamiliar `ValueError` reaches users; or, on a pre-mitigation
interpreter, a worker pins a CPU for seconds.
**Cause.** Unvalidated decimal text going straight into `int()`.
**Fix.** Bound the string at the boundary, where you can return a useful error:

```python
MAX_DIGITS = 100

def parse_quantity(raw: str) -> int:
    if len(raw) > MAX_DIGITS:
        raise ValueError("quantity too long")
    return int(raw)
```

### A `repr` that fails inside a debugger or a test framework
**Symptom.** `pytest` explodes while formatting an assertion, or a debugger
cannot display a variable.
**Cause.** Both call `repr()` on your objects, and `repr(int)` is limited.
**Fix.** Give the containing object a `__repr__` that summarises large integers
instead of rendering them:

```python
class Key:
    def __repr__(self) -> str:
        return f"Key(bits={self.n.bit_length()})"
```

### Treating this as a Python-3.11-only concern
**Symptom.** Code that ran on a 3.9 image starts failing after a base-image
rebuild with no version change.
**Cause.** The mitigation was backported to security releases of 3.7 through
3.10. A `python:3.9-slim` pulled today has it.
**Fix.** Assume the limit is present on every supported interpreter; test the
behaviour, not the version number.

### JSON encoding a huge integer
**Symptom.** `json.dumps({"n": huge})` raises `ValueError` rather than
producing a long number.
**Cause.** The encoder renders `int` in base 10.
**Fix.** Encode it as a hex or decimal *string* deliberately — which you wanted
anyway, since JSON numbers above `2**53 - 1` are unsafe for any JavaScript
consumer.

## Interview questions

**Why does `int('1' * 10000)` raise, when Python integers have unlimited
precision?**
Because the *arithmetic* is unlimited but the base-10 *conversion* is not.
There is no linear algorithm for converting between a binary bignum and a
base-10 string — the best known are sub-quadratic — so a few hundred kilobytes
of digits submitted to an endpoint can burn seconds of CPU per request. Since
3.11 CPython caps that conversion at 4300 digits by default and raises
`ValueError` beyond it. The value itself would be fine; only the decimal
rendering is refused.

**Which operations are exempt, and what do they have in common?**
Bases that are powers of two — `int(s, 16)`, `hex`, `oct`, `bin`, and the
matching format specs — plus `int.to_bytes`/`int.from_bytes`, `str`-to-`float`
and `str`-to-`Decimal`. What they share is linearity: when the base is a power
of two, each output digit is a fixed group of input bits, so the conversion is a
regrouping in one pass rather than a sequence of divisions.

**A `ValueError` about digit limits appears in a stack trace whose top frame is
`logging`. What happened?**
A value exceeding the limit was rendered in base 10 by a log call. The
computation succeeded; the *printing* failed. The same trap catches `repr` in
debuggers and in pytest's assertion rewriting. Log `n.bit_length()` and a hex
prefix instead of the value.

**Where is the right place to defend against the huge-integer DoS?**
At the input boundary, by bounding the length of the incoming string before it
reaches `int()`. The interpreter limit is a backstop that raises deep inside
your stack with a message aimed at a Python developer; a length check at the
parser returns a 400 with a useful message and never allocates the bignum.

**Your API must accept arbitrary-precision decimal quantities from users. How
do you avoid the limit without disabling it?**
Parse them as `decimal.Decimal`. `str`-to-`Decimal` is explicitly exempt,
because `Decimal` already stores digits in base 10 and needs no base conversion
at all. That also gives you exact decimal semantics, which is usually what
"arbitrary-precision quantity" meant in the first place.

---

← Prev: [Identity and boundaries](01c-identity-and-boundaries.md) · Index: [Numbers](README.md) · Next → [Configuring and avoiding the limit](02b-configuring-and-avoiding-the-limit.md)
