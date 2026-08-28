---
title: "The format spec mini-language: everything after the colon"
sidebar_label: "3c · The format spec mini-language"
sidebar_position: 7
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the Python 3.14 Library Reference
> [Format Specification Mini-Language](https://docs.python.org/3.14/library/string.html#format-specification-mini-language),
> [`format()`](https://docs.python.org/3.14/library/functions.html#format),
> [`object.__format__`](https://docs.python.org/3.14/reference/datamodel.html#object.__format__),
> [PEP 682](https://peps.python.org/pep-0682/) (the `z` option, 3.11),
> [PEP 515](https://peps.python.org/pep-0515/) (the `_` grouping option), and
> [`datetime.__format__`](https://docs.python.org/3.14/library/datetime.html).
> Target: **CPython 3.14**.

**The text after the colon in `f"{value:>10,.2f}"` is not part of the f-string
machinery at all — it is handed verbatim to `format(value, spec)`, which calls
`value.__format__(spec)`. That indirection is the whole design: the same
grammar formats numbers, and any type is free to define its own spec language,
which is why `f"{now:%Y-%m-%d}"` works with no date handling anywhere in the
string code. Learn the grammar once and it applies to `str.format`, to
`format()`, and to every f-string you will ever write.**

## The grammar

```
format_spec:  [[options][width_and_precision]][type]
options:      [[fill]align][sign]["z"]["#"]["0"]
fill:         <any character>
align:        "<" | ">" | "=" | "^"
sign:         "+" | "-" | " "
width:        digit+
grouping:     "," | "_"
precision:    "." digit+
type:         b c d e E f F g G n o s x X %
```

Read a spec right to left and it decodes itself: `>10,.2f` is *fixed-point, two
decimal places, comma grouping, width 10, right-aligned*.

## Alignment and fill

| Option | Meaning |
|---|---|
| `<` | Left-align — *"the default for most objects"* |
| `>` | Right-align — *"the default for numbers"* |
| `^` | Centre |
| `=` | Pad **after the sign but before the digits**; numeric types only |

```python
f"{'name':<10}|"          # "name      |"
f"{'name':>10}|"          # "      name|"
f"{'name':^10}|"          # "   name   |"
f"{'name':*^10}|"         # "***name***|"   — fill is any character
f"{-42:=8}"               # "-     42"      — sign first, then padding
f"{-42:>8}"               # "     -42"
```

The fill character goes *before* the alignment character, which is why the fill
must be followed by an explicit alignment: `f"{x:*10}"` is a spec with no
alignment and a fill of `*` is not what it means.

## Sign, `z`, `#`, `0`

```python
f"{42:+}"                 # "+42"    — sign on positives too
f"{42:-}"                 # "42"     — the default
f"{42: }"                 # " 42"    — space for positives; aligns with negatives

f"{-0.0001:.2f}"          # "-0.00"  — a negative zero after rounding
f"{-0.0001:z.2f}"         # "0.00"   — 3.11+, PEP 682
```

The docs on `z`: *"The `'z'` option coerces negative zero floating-point values
to positive zero after rounding to the format precision. This option is only
valid for floating-point presentation types."* It exists because `-0.00` in a
financial report is a support ticket.

```python
f"{255:#x}"               # "0xff"   — alternate form adds the base prefix
f"{255:#b}"               # "0b11111111"
f"{42:05}"                # "00042"  — sign-aware zero padding
f"{-42:05}"               # "-0042"
```

`0` before the width is equivalent to a fill of `0` with `=` alignment. Since
3.10 it no longer affects the default alignment for strings.

## Grouping

```python
f"{1234567:,}"            # "1,234,567"
f"{1234567:_}"            # "1_234_567"
f"{1234567.891:,.2f}"     # "1,234,567.89"   — the money spec
f"{0xdeadbeef:_x}"        # underscores every FOUR digits for b/o/x/X
```

`,` and `_` are supported for the integer type `d` and for floating-point
types, *excluding* `n`. For `b`, `o`, `x` and `X` only `_` is allowed, and it
groups every four digits rather than three — which is exactly right for reading
a hex mask.

**New in 3.14:** the grouping option is supported for the *fractional* part as
well, so a precision may carry its own grouping separator. Before 3.14 grouping
applied only to the integral part.

## Precision means two different things

- For `f`, `F`, `e`, `E`, `%`: *digits after the decimal point*.
- For `g`, `G`: *significant digits*.
- For **string** types: *"the field indicates the maximum field size — in other
  words, how many characters will be used from the field content."*

```python
f"{3.14159:.2f}"          # "3.14"   — two decimals
f"{3.14159:.2g}"          # "3.1"    — two significant digits
f"{'truncated':.5}"       # "trunc"  — a MAXIMUM, silently cutting the string
```

That last one is the trap: a precision on a string is a silent truncation, not
a minimum width. `f"{name:.10}"` will quietly shorten a long name; `f"{name:10}"`
pads a short one. Precision is *not allowed* for integer presentation types —
`f"{42:.2d}"` raises.

## Type codes

| Type | Meaning |
|---|---|
| `d` | Decimal integer |
| `b` `o` `x` `X` | Binary, octal, lower/upper hex |
| `c` | The integer's Unicode character |
| `e` `E` | Scientific notation |
| `f` `F` | Fixed point (`F` renders `nan`/`inf` as `NAN`/`INF`) |
| `g` `G` | General — fixed or scientific, whichever is shorter |
| `n` | Like `d`/`g` but with **locale-dependent** separators |
| `%` | Multiply by 100 and render as fixed point with a `%` |
| `s` | String (the default for `str`) |

```python
f"{0.4567:.1%}"           # "45.7%"
f"{65:c}"                 # "A"
f"{1e-5:e}"               # scientific notation
```

`n` is the one to avoid unless you mean it: it reads process-global locale
state, the default locale is not the system locale, and it needs an explicit
`locale.setlocale(locale.LC_NUMERIC, ...)` to do anything useful. In a server
that is shared mutable state across threads. Format for a user's locale with
`babel` or the database, not with `n`.

## Gotchas

### A precision on a string silently truncates
**Symptom.** Long values appear cut off in a report with no error and no
ellipsis.
**Cause.** For string presentation types, precision is a *maximum field size*.
`f"{name:.10}"` uses at most ten characters of `name`.
**Fix.** Use width, not precision, when you meant padding — and truncate
explicitly when you meant truncation.
```python
f"{name:10}"                                  # pad to 10
f"{(name[:9] + '…') if len(name) > 10 else name:10}"   # visible truncation
```

### Fill without alignment
**Symptom.** `f"{x:*10}"` raises `ValueError: Invalid format specifier`, or
formats in a way you did not expect.
**Cause.** A fill character is only recognised when immediately followed by an
alignment character.
**Fix.** `f"{x:*>10}"`, `f"{x:*^10}"`.

### `-0.00` in a report
**Symptom.** A total of exactly zero prints as `-0.00` when the underlying
float is a tiny negative.
**Cause.** Rounding to two places does not remove the sign bit.
**Fix.** `f"{total:z.2f}"` (3.11+), or normalise the value before formatting.

### Using `n` for thousands separators
**Symptom.** Grouping works on one machine and silently does nothing on
another, or a thread changes the format of another thread's output.
**Cause.** `n` reads the process-global `LC_NUMERIC` locale, which defaults to
the C locale rather than the system one, and `locale.setlocale` is not
thread-safe.
**Fix.** Use `,` for a fixed format, and a real i18n library for user-facing
locale formatting.

### Precision on an integer
**Symptom.** `ValueError: Precision not allowed in integer format specifier`.
**Cause.** `.2` is meaningless for `d`; the author wanted a width or a float.
**Fix.** `f"{n:05d}"` for zero padding, or `f"{n:.2f}"` after converting.

### Assuming `{:,}` works on a `str`
**Symptom.** `ValueError: Cannot specify ',' with 's'.`
**Cause.** Grouping is a numeric option. The value arrived as a string —
usually straight from JSON or a form.
**Fix.** Convert first: `f"{int(raw):,}"`.

## Interview questions

**Q: Decode `>10,.2f`.**
Right-aligned, minimum width 10, comma thousands grouping, two digits after the
decimal point, fixed-point notation. The standard money spec.

**Q: What does precision mean for a string?**
Maximum field size — it truncates. `f"{'truncated':.5}"` is `"trunc"`. For `f`
it is decimal places; for `g` it is significant digits; for integers it is an
error.

**Q: What is the `z` option and why does it exist?**
Added in 3.11 by PEP 682. It coerces a negative zero float to positive zero
*after* rounding to the format precision, so a rounded-to-zero negative prints
as `0.00` rather than `-0.00`. Floating-point presentation types only.

**Q: `,` versus `_` for grouping?**
Both group digits. `,` works for `d` and float types; `_` additionally works
for `b`, `o`, `x`, `X`, where it groups every four digits instead of three.
Neither works with `n`.

**Q: Why avoid the `n` type code on a server?**
It depends on process-global locale state that defaults to the C locale, and
setting it is neither thread-safe nor per-request. Use `,` for a stable format
and an i18n library for user locales.

**Q: `f"{0.4567:.1%}"` — what is the output and what did `%` do?**
`"45.7%"`. The `%` type multiplies by 100, formats as fixed point with the
given precision, and appends a percent sign.

**Q: What changed about grouping in 3.14?**
Grouping is now supported for the fractional part of a number, not only the
integral part.

**Q: Why must fill be followed by an alignment character?**
The grammar is `[[fill]align]` — fill is only recognised in that pair. Without
an explicit `<`, `>`, `^` or `=`, the character is parsed as something else and
usually raises.

---

← Prev: [When not to use an f-string](03b-when-not-to-use-an-f-string.md) · Index: [Strings](README.md) · Next → [`__format__`, the protocol behind the spec](03d-the-format-protocol.md)
