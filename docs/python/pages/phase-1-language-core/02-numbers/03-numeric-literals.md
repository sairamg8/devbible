---
title: "Numeric literals: 0x/0o/0b prefixes, the leading zero that is a SyntaxError, and the fact that 1e6 is a float while 1000000 is not"
sidebar_label: "3 · Numeric literals"
sidebar_position: 6
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-28 against the Python 3.14 language reference
> [Numeric literals](https://docs.python.org/3.14/reference/lexical_analysis.html#numeric-literals),
> the library reference on
> [Numeric Types](https://docs.python.org/3.14/library/stdtypes.html#numeric-types-int-float-complex)
> and [`int()`](https://docs.python.org/3.14/library/functions.html#int) /
> [`float()`](https://docs.python.org/3.14/library/functions.html#float),
> and [PEP 515 — Underscores in Numeric Literals](https://peps.python.org/pep-0515/).
> Version spine: **Python 3.14.7**; underscores in literals since **3.6**.

**Two literal facts do most of the damage. `1e6` is a `float` and `1_000_000`
is an `int`, so the innocuous-looking `TIMEOUT_MS = 1e3` puts a float into
something that will later index, `range()` or format as an integer. And `0123`
is a `SyntaxError`, not the number 123, because Python 3 refuses C-style octal
outright rather than silently changing the base — which is exactly what you
want when a zero-padded zip code gets pasted into source.**

## Integer literals

> *"Unadorned integer literals (including hex, octal and binary numbers) yield
> integers. Numeric literals containing a decimal point or an exponent sign
> yield floating-point numbers. Appending `'j'` or `'J'` to a numeric literal
> yields an imaginary number."*

```python
7
0b1001_1011        # binary,      prefix 0b or 0B
0o755              # octal,       prefix 0o or 0O
0xDead_Beef        # hexadecimal, prefix 0x or 0X, digits case-insensitive
100_000_000_000
```

The grammar, verbatim from the reference:

```text
integer:      decinteger | bininteger | octinteger | hexinteger | zerointeger
decinteger:   nonzerodigit (["_"] digit)*
bininteger:   "0" ("b" | "B") (["_"] bindigit)+
octinteger:   "0" ("o" | "O") (["_"] octdigit)+
hexinteger:   "0" ("x" | "X") (["_"] hexdigit)+
zerointeger:  "0"+ (["_"] "0")*
```

Read `zerointeger` carefully: `0`, `00` and `0_0` are all legal and all zero.
That is the *only* case where a leading zero survives, and it exists so that
`00` does not have to be a special case in every parser.

> *"Leading zeros in a non-zero decimal number are not allowed. For example,
> `0123` is not a valid literal. This is for disambiguation with C-style octal
> literals, which Python used before version 3.0."*

This is the trap when data is pasted into source: zero-padded identifiers,
zip codes, phone extensions. `zip = 02138` is a `SyntaxError`; the value was
never a number in the first place and belongs in a string.

There is no width, and no suffix:

> *"There is no limit for the length of integer literals apart from what can be
> stored in available memory."*

## Floating-point literals, and where `1e6` bites

> *"Floating-point (float) literals, such as `3.14` or `1.5`, denote
> approximations of real numbers. […] Either of these parts, but not both, can
> be empty."*

```python
2.71828
4.0
10.               # equivalent to 10.0
.001              # equivalent to 0.001
1e3               # equivalent to 1.e3 and 1.0e3 — a FLOAT
1.166e-5
6.02214076e+23
96_485.332_123
```

Two rules that catch people:

- **Leading zeros *are* allowed here.** *"Unlike in integer literals, leading
  zeros are allowed. For example, `077.010` is legal, and denotes the same
  number as `77.01`."* So `0123` is a `SyntaxError` and `0123.0` is fine.
- **An exponent makes it a float, with no decimal point required.** *"In floats
  with only integer and exponent parts, the decimal point may be omitted:
  `1e3` (equivalent to `1.e3` and `1.0e3`)."*

That second rule is the whole gotcha. `1e6` is not a shorthand for a million as
an integer — it is a `float`, and every downstream consequence follows: it
cannot index a sequence, it formats with a `.0`, it loses exactness above
`2**53`, and `range(1e6)` raises `TypeError`.

```python
CHUNK = 1e6          # float — range(CHUNK) raises TypeError
CHUNK = 1_000_000    # int — say what you mean
CHUNK = int(1e6)     # works, but why round-trip through a float at all
```

Above `2**53` the difference stops being cosmetic: `1e17 + 1 == 1e17` is true,
while `10**17 + 1` is exact.

## Imaginary literals

> *"Appending `'j'` or `'J'` to a numeric literal yields an imaginary number (a
> complex number with a zero real part) which you can add to an integer or float
> to get a complex number with real and imaginary parts."*

```python
3j
1 + 2j            # an expression, not a literal: addition of int and imaginary
```

There is no complex *literal* — `1 + 2j` is `int + imaginary`, evaluated at
compile time by the constant folder but syntactically an expression. See
[complex and the numeric tower](13-complex-and-the-numeric-tower.md).

## Gotchas

### `1e6` where an `int` was meant
**Symptom.** `TypeError: 'float' object cannot be interpreted as an integer`
from `range()`, a slice or `bytes()`; or a report that says `1000000.0`.
**Cause.** An exponent makes a literal a `float`, with or without a decimal
point.
**Fix.** Write `1_000_000`. If a float is genuinely wanted, keep `1e6` but do
not let it flow into integer contexts.

### A zero-padded number pasted into source
**Symptom.** `SyntaxError` about leading zeros in a decimal integer literal.
**Cause.** Python 3 reserves leading zeros so that C-style octal cannot be
misread; only `0`, `00` and `0_0` are legal.
**Fix.** It was never a number — make it a string: `zip_code = "02138"`. If you
really meant octal, write `0o…`.

### `float` used for a millisecond or byte count
**Symptom.** Log lines full of `1500.0`, or an off-by-one in an offset above
`2**53`.
**Cause.** `1.5e3` and friends leak a float into an integral quantity.
**Fix.** Integral quantities get integer literals; use the format spec for
display, `f"{ms:_} ms"`.

### `0o` forgotten when porting a file mode
**Symptom.** `os.chmod(path, 755)` silently sets the wrong permissions.
**Cause.** `755` is decimal 755, which is `0o1363` — a nonsense mode, and
Python cannot warn because both are valid integers.
**Fix.** `os.chmod(path, 0o755)`. Any mode written without `0o` is a bug.

### `1 + 2j` treated as a literal
**Symptom.** A regex or parser that recognises numeric literals misses complex
values, or `ast.literal_eval` behaves unexpectedly around them.
**Cause.** Only `2j` is a literal; `1 + 2j` is an *expression* — the addition of
an integer and an imaginary number.
**Fix.** Parse it as an expression, or construct with `complex(1, 2)`.

## Interview questions

**Is `1e6` an `int` or a `float`, and why does it matter?**
A `float`. The reference says literals containing a decimal point *or an
exponent* yield floating-point numbers, so the exponent alone is enough. It
matters because a float cannot index a sequence or drive `range()`, formats
with a trailing `.0`, and stops being exact above `2**53` — so `1e17 + 1 ==
1e17` while `10**17 + 1` is exact.

**Why is `0123` a `SyntaxError`?**
Python 2 used a leading zero for octal, as C does. Python 3 removed that syntax
and made a leading zero an error rather than silently changing the base, so code
ported from C or Python 2 fails loudly instead of computing a different number.
Only literal zeros — `0`, `00`, `0_0` — may carry leading zeros.

**Why are leading zeros legal in `077.010` but not in `0123`?**
Because the ambiguity only ever existed for integers. There was never a
float-octal syntax to disambiguate from, so the reference states plainly that
"unlike in integer literals, leading zeros are allowed" for floating-point
literals.

**Is there a complex literal in Python?**
No — there is an *imaginary* literal, written with a `j` or `J` suffix, which
yields a complex number with a zero real part. `1 + 2j` is an expression that
adds an `int` to an imaginary number. The constant folder evaluates it at
compile time, but syntactically it is still an operator applied to two operands.

**How large can an integer literal be?**
Unbounded: "there is no limit for the length of integer literals apart from what
can be stored in available memory." There is no width suffix and no `L`. The one
practical caveat is that a very long *decimal* literal can trip the
[integer string conversion limit](02-the-int-str-conversion-limit.md) at parse
time if that limit has been lowered — the same constant written in hexadecimal
is immune.

---

← Prev: [Configuring and avoiding the limit](02b-configuring-and-avoiding-the-limit.md) · Index: [Numbers](README.md) · Next → [Underscores and the constructors](03b-underscores-and-constructors.md)
