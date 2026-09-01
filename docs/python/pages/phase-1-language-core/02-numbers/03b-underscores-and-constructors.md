---
title: "Underscores are erased before the value exists, and int() accepts strings the parser would reject"
sidebar_label: "3b · Underscores and constructors"
sidebar_position: 7
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-28 against
> [PEP 515 — Underscores in Numeric Literals](https://peps.python.org/pep-0515/),
> the Python 3.14 language reference
> [Numeric literals](https://docs.python.org/3.14/reference/lexical_analysis.html#numeric-literals),
> and the library reference for
> [`int()`](https://docs.python.org/3.14/library/functions.html#int),
> [`float()`](https://docs.python.org/3.14/library/functions.html#float) and
> [Numeric Types](https://docs.python.org/3.14/library/stdtypes.html#numeric-types-int-float-complex).
> Version spine: **Python 3.14.7**; underscores in literals since **3.6**.

**Underscores in numeric literals are erased by the tokenizer before a value
exists. They carry no meaning, nothing validates that they group in threes, and
a mis-grouped constant is a lie the compiler will never catch. They are also
accepted by `int()`, `float()`, `complex()` and `Decimal()`, and `_` doubles as
a thousands separator in the format mini-language. Separately — and this is the
part that shows up in validators — the constructors accept a strictly larger
language than the parser does: leading whitespace, a sign, base inference, and
decimal digits from any Unicode script.**

## Underscores: PEP 515, and where they are illegal

PEP 515's specification is one sentence:

> *"The current proposal is to allow one underscore between digits, and after
> base specifiers in numeric literals. The underscores have no semantic
> meaning, and literals are parsed as if the underscores were absent."*

The reference gives the exact placement rules:

> *"Underscores can only occur between digits. For example, `_123`, `321_`, and
> `123__321` are not valid literals."*

> *"An underscore can follow the base specifier. For example, `0x_1f` is a valid
> literal, but `0_x1f` and `0x__1f` are not."*

So:

```python
1_000_000        # ok
0b_1110_0101     # ok — underscore after the base specifier
0x_1f            # ok
3.14_15_93       # ok
1_00_00_00_000   # ok, and equal to 1000000000 — grouping is not validated
_123             # NameError: this is an identifier, not a literal
321_             # SyntaxError
123__321         # SyntaxError
1_.5             # SyntaxError — underscore not between digits
1._5             # SyntaxError
```

The `1_00_00_00_000` case is the one to remember: **the grouping is not
checked**. The reference says the underscores are *"ignored for determining the
numeric value of the literal"*, so a mis-grouped constant is a lie the compiler
will not catch. `1_0000_000` reads as ten million to a fast eye and is ten
million — but `1_000_00` reads as a hundred thousand and is also a hundred
thousand; nothing enforces that the reader's assumption matches.

Underscores also work in the constructors, which is what makes them useful for
parsing config and machine-generated text. PEP 515:

> *"Following the same rules for placement, underscores will be allowed in the
> following constructors: `int()` (with any base), `float()`, `complex()`,
> `Decimal()`."*

```python
int("0b_1111_0000", 2)
float("1_000.000_1")
```

And on the way out, `_` is a thousands separator in the format mini-language.
PEP 515 again:

> *"The new-style number-to-string formatting language will be extended to allow
> `_` as a thousands separator, where currently only `,` is supported. […] For
> the `b`, `x` and `o` format specifiers, `_` will be allowed and group by 4
> digits."*

```python
f"{1234567:_}"        # 1_234_567
f"{255:_b}"           # 1111_1111 — groups of four for b/x/o
f"{1234567:,}"        # 1,234,567
```

## What the constructors accept that the parser does not

The reference is explicit that the two are not the same grammar:

> *"The numeric value of a numeric literal is the same as if it were passed as a
> string to the `int`, `float` or `complex` class constructor, respectively.
> Note that not all valid inputs for those constructors are also valid
> literals."*

The differences that matter:

```python
int("   -12_345\n")     # whitespace and a sign are fine for int(); not literals
int("0xface", 0)        # base 0 infers the prefix — no literal equivalent
float("-Infinity")      # accepts "inf", "infinity", "nan", with a sign
float("1e-003")         # leading zeros in the exponent are fine
```

> *"Numeric literals do not include a sign; a phrase like `-1` is actually an
> expression composed of the unary operator '-' and the literal `1`."*

That is why there is no `-0` integer literal, and why `-0.0` is unary minus
applied to `0.0` — which, unlike the integer case, produces a distinct value.
See [NaN, infinity and signed zero](06-nan-inf-and-signed-zero.md).

One more, easy to miss and occasionally a security issue:

> *"The numeric literals accepted include the digits 0 to 9 or any Unicode
> equivalent (code points with the Nd property)."*

This applies to the `int()` and `float()` constructors, so `int("١٢٣")` —
Arabic-Indic digits — parses as 123. A validator that checks
`raw.isdigit()` and then calls `int(raw)` will accept those too, since
`str.isdigit()` is also Unicode-aware.

## Gotchas

### Underscores that lie about the grouping
**Symptom.** A constant reviewed as "10 million" is actually one million.
**Cause.** Underscores are erased before the value is computed; no rule requires
groups of three, and `1_00_00_00_000` is perfectly legal.
**Fix.** Group in threes for decimal and fours for hex and binary, and put the
unit in the name — `TIMEOUT_MS = 30_000` — so a wrong magnitude is visible at a
glance.

### `int(user_input)` accepting non-ASCII digits
**Symptom.** A "validated" numeric field contains Arabic-Indic or Devanagari
digits and still parses; the downstream system then rejects it, or stores
something unexpected.
**Cause.** `int()` accepts *"any Unicode equivalent (code points with the Nd
property)"*, and `str.isdigit()` agrees with it, so the obvious guard does not
help.
**Fix.** Require ASCII explicitly when the consumer expects ASCII:

```python
if not raw.isascii() or not raw.isdigit():
    raise ValueError("expected ASCII digits")
```

### A literal that is silently an identifier
**Symptom.** `_123` raises `NameError` instead of being a number.
**Cause.** Underscores may only appear *between* digits, so a leading underscore
makes the token an identifier rather than a literal.
**Fix.** Move it: `1_23`.

### `int(s)` used where `int(s, 0)` was meant
**Symptom.** `int("0x1f")` raises `ValueError`, even though `0x1f` is a valid
literal.
**Cause.** `int(string)` defaults to base 10 and does not read prefixes. Base
inference is opt-in.
**Fix.** `int("0x1f", 0)` to infer the base from the prefix, or `int("1f", 16)`
if you already know it.

### `float("nan")` accepted from user input
**Symptom.** A parsed configuration or CSV field becomes NaN and poisons every
downstream comparison.
**Cause.** `float()` accepts `"nan"`, `"inf"` and `"infinity"` with an optional
sign, case-insensitively.
**Fix.** Reject non-finite input at the boundary:

```python
import math

value = float(raw)
if not math.isfinite(value):
    raise ValueError("expected a finite number")
```

### A `-0` integer literal that does not exist
**Symptom.** Someone expects `-0` and `0` to be distinguishable for integers, as
they are for floats.
**Cause.** *"Numeric literals do not include a sign"* — `-0` is unary minus
applied to the literal `0`, and integer negation of zero is zero. For floats
`-0.0` is a genuinely distinct value.
**Fix.** Nothing to fix for `int`; for floats see
[NaN, infinity and signed zero](06-nan-inf-and-signed-zero.md).

## Interview questions

**What do underscores in numeric literals do at runtime?**
Nothing. PEP 515: the underscores "have no semantic meaning, and literals are
parsed as if the underscores were absent". They are erased by the tokenizer.
They are also accepted by `int()`, `float()`, `complex()` and `Decimal()`, and
`_` works as a thousands separator in the format mini-language — grouping by
four for the `b`, `x` and `o` specifiers rather than by three.

**Where may an underscore not appear?**
Anywhere that is not between two digits, with one exception: it may follow a
base specifier. So `0x_1f` is legal but `_123`, `321_`, `123__321`, `0_x1f` and
`0x__1f` are not. `_123` is not even a syntax error — it is a valid identifier,
so you get `NameError`.

**How would you write a 32-bit mask so a reviewer can check it at a glance?**
`0xFFFF_FFFF`, or `0b1111_1111_1111_1111_1111_1111_1111_1111`. Hex and binary
group naturally in fours, which is also how the `_` format specifier groups them
on output, so the literal and its formatted form line up.

**Does `int()` accept exactly what the parser accepts as a literal?**
No, and the reference says so directly: "not all valid inputs for those
constructors are also valid literals". `int()` additionally accepts surrounding
whitespace, a leading sign, base-0 prefix inference (`int("0xface", 0)`), and
decimal digits from any Unicode script. In the other direction, literals have no
sign at all — `-1` is unary minus applied to `1`.

**You are validating a numeric form field. What does `str.isdigit()` fail to
catch?**
Two things. It accepts non-ASCII decimal digits — anything with the Unicode `Nd`
property — which `int()` will then happily parse into a number the rest of your
stack may not expect. And it rejects things you probably wanted to allow, such
as a leading sign or surrounding whitespace, both of which `int()` accepts. Pair
`isascii()` with `isdigit()`, or parse inside a `try` and let `int()` define the
grammar.

**Why does `float("infinity")` succeed when there is no such literal?**
Because the constructor has its own grammar. `float()` accepts `"inf"`,
`"infinity"` and `"nan"` with an optional sign — there is no way to write any of
them as a literal, which is why `math.inf` and `math.nan` exist. It is also why
untrusted numeric input needs a `math.isfinite()` check.

---

← Prev: [Numeric literals](03-numeric-literals.md) · Index: [Numbers](README.md) · Next → [`bool` is an `int`](04-bool-is-an-int.md)
