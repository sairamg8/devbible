---
title: "Python has four display paths for a float and they disagree about negative zero, which is why PEP 682 added a 'z' option that fixes exactly one of them"
sidebar_label: "6f · Printing negative zero"
sidebar_position: 65
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-01 against the Python 3.14
> [Format Specification Mini-Language](https://docs.python.org/3.14/library/string.html#format-specification-mini-language)
> (the `'z'` option, the `'g'` and `'f'` and `'e'` and `None` presentation
> types), [PEP 682 — Format Specifier for Signed Zero](https://peps.python.org/pep-0682/),
> [printf-style String Formatting](https://docs.python.org/3.14/library/stdtypes.html#printf-style-string-formatting),
> and [`logging`](https://docs.python.org/3.14/library/logging.html) on
> formatting styles.
> Version spine: **Python 3.14.7**; `'z'` added in **3.11**.

**`str(-0.0)`, `format(-0.0, '.1f')`, `format(-0.0, 'g')` and `'%.1f' % -0.0` do
not all produce the same string, and the difference is not a bug — the format
mini-language documents a special rule for `'g'` that renders any zero as `0` or
`-0` "regardless of the precision", while `'f'` and the default path render the
digits. PEP 682 added a `'z'` option in 3.11 that coerces negative zero to
positive zero **after rounding**, which is the only supported way to suppress
the minus without touching the value. It reaches the format mini-language and
nothing else: not `repr`, not `str`, not `%`-formatting, not `json`, not the
default `logging` style. Knowing which of your output paths it covers is the
whole job.**

## The four display paths, and what each does with `-0.0`

| Path | Spelling | Result for `-0.0` |
|---|---|---|
| `repr` / `str` | `repr(-0.0)`, `str(-0.0)`, `f"{x!r}"`, `f"{x=}"` | `'-0.0'` |
| Format spec, no type | `format(-0.0, '')`, `f"{x}"` | `'-0.0'` |
| Format spec, `'f'` | `f"{x:.2f}"` | `'-0.00'` |
| Format spec, `'e'` | `f"{x:.2e}"` | `'-0.00e+00'` |
| Format spec, `'g'` or `'n'` | `f"{x:g}"`, `f"{x:.10g}"` | `'-0'` |
| Format spec with `'z'` | `f"{x:z.2f}"` | `'0.00'` |
| printf-style | `'%.2f' % -0.0` | `'-0.00'` |
| `json.dumps` | `json.dumps(-0.0)` | `'-0.0'` |
| `Decimal` | `str(Decimal('-0'))` | `'-0'` |

Every row keeps the minus except the one that was designed not to. There is no
"safe default": the sign leaks through `str`, through f-strings, through
`%`-formatting, through `json`, and through `csv` (which writes `str(x)`).

## The `'g'` rule, quoted

The special-value sentence people remember belongs specifically to the `'g'`
presentation type, and it is the reason `f"{x:g}"` and `f"{x:.2f}"` disagree:

> *"Positive and negative infinity, positive and negative zero, and nans, are
> formatted as `inf`, `-inf`, `0`, `-0` and `nan` respectively, regardless of
> the precision."*

"Regardless of the precision" is the load-bearing phrase. `'g'` normally rounds
to `p` significant digits and then strips insignificant trailing zeros — but for
the five special values it short-circuits entirely, so `f"{x:.10g}"` and
`f"{x:g}"` both give `-0`, with no decimal point and no digits. `'n'` inherits
this because the docs define it as *"the same as `'g'`, except that it uses the
current locale setting to insert the appropriate digit group separators"*.

`'f'` has no such rule. It is documented to format *"as a decimal number with
exactly `p` digits following the decimal point"*, so a negative zero at
precision 2 is `-0.00`, sign and all.

## Why the default path keeps the `.0`

The empty presentation type is documented as being like `'g'`, and yet
`f"{-0.0}"` gives `-0.0` rather than `-0`. The entry explains itself:

> *"For `float` this is like the `'g'` type, except that when fixed-point
> notation is used to format the result, it always includes at least one digit
> past the decimal point, and switches to the scientific notation when
> `exp >= p - 1`. When the precision is not specified, the latter will be as
> large as needed to represent the given value faithfully."*

> *"The overall effect is to match the output of `str()` as altered by the other
> format modifiers."*

So the default path is anchored to `str()`, which round-trips — and a
round-tripping representation of `-0.0` has to carry the minus, otherwise
`float(str(x)) == x` would not hold bit-for-bit. That is exactly why you cannot
"fix" the default: `repr` is contractually the string that reconstructs the
value.

## `'z'`: the supported fix

PEP 682 added an option that sits between the sign and the `'#'` in the grammar:

```
options: [[fill]align][sign]["z"]["#"]["0"]
```

and its documented behaviour is one sentence:

> *"The `'z'` option coerces negative zero floating-point values to positive
> zero after rounding to the format precision. This option is only valid for
> floating-point presentation types."*

The words **after rounding** are what make it worth having. The obvious
hand-rolled alternative — normalise the value first, then format — is wrong
whenever the value is a small negative that has not yet been rounded:

```python
# WRONG: normalising first does not help, because the value is not zero yet.
x = -0.004
f"{(x + 0.0):.2f}"     # x is -0.004, not -0.0; still formats as '-0.00'

# RIGHT: let the format spec round, then suppress the sign of the result.
f"{x:z.2f}"            # '0.00'
```

PEP 682 says this outright, noting that the pre-round workaround is *"prone to
error if the rounding doesn't precisely match that of the format spec"*. You
cannot correctly pre-normalise without reimplementing the format spec's own
rounding, which is the thing you were trying to avoid.

```python
f"{-0.004:.2f}"        # '-0.00'
f"{-0.004:z.2f}"       # '0.00'
f"{-0.0:z.2f}"         # '0.00'
f"{-0.0:zg}"           # '0'
f"{-3.5:z.1f}"         # '-3.5'  - z only touches zeros
f"{-0.0:z}"            # z with the default presentation type
```

`'z'` combines with everything else in the options block, so
`f"{x:>+z10.2f}"` is a right-aligned, always-signed, zero-suppressing,
two-decimal field.

## Where `'z'` does not reach

**`%`-formatting.** PEP 682 deliberately did not extend printf-style
formatting — the PEP notes this is consistent with the precedent of not adding
new options there. So `'%.2f' % x` has no way to suppress the sign, and neither
does anything built on it.

**`logging`, in its default style.** `logging`'s default formatting style is
`%`-style, so `logger.info("total: %.2f", x)` goes down the printf path and
prints `-0.00`. A `Formatter` constructed with `style='{'` uses `str.format`
and therefore accepts `'z'` — but that is a configuration change, not a call-site
one.

**`repr`, `str`, and therefore `csv` and `print`.** `print(x)` calls `str`.
`csv.writer` writes `str(x)` for a float. Neither consults a format spec.

**`json`.** `json.dumps` serialises floats itself and takes no format spec —
[06g](06g-negative-zero-across-a-boundary.md).

**The value itself.** `'z'` changes a *string*. The float in memory is still
`-0.0`, so a later comparison, hash or serialisation of the same object still
sees a negative zero. If the requirement is that the value be normalised, that
is `x + 0.0` ([06e](06e-what-erases-the-sign.md)); if the requirement is that it
not print with a minus, that is `'z'`. They are different requirements and doing
both "to be safe" means the `'z'` is dead code that a later reader will
misinterpret.

## `Decimal`

`Decimal` implements the same mini-language — the docs introduce the
floating-point presentation types with *"The available presentation types for
`float` and `Decimal` values are:"* — and the `'z'` restriction is stated in
terms of those presentation types rather than in terms of `float`. The
documentation does not give a worked `Decimal` example for `'z'`, so confirm it
in your own build before depending on it.

What is certain is that `Decimal`'s *default* string form shows the sign:
`str(Decimal('-0'))` renders the sign field, and the `None` presentation type
for `Decimal` is documented as *"the same as either `'g'` or `'G'` depending on
the value of `context.capitals`"*. So a `Decimal` pipeline displays negative
zeros by default, consistently, and cannot be talked out of it by switching to
`str`.

## Gotchas

**★ `f"{x:g}"` and `f"{x:.2f}"` disagree about negative zero, and only one of
them is in the docs' special-case sentence.** `'g'` short-circuits every zero to
`0` or `-0` regardless of precision; `'f'` prints the requested number of
decimal places. A report that mixes the two — say `'g'` for a summary line and
`'.2f'` for the table — shows the same value two ways on the same page.

**★ Normalising before formatting does not work, and the failure is silent.**
`f"{(x + 0.0):.2f}"` looks like a fix and is not, because `x` is typically
`-0.004`, not `-0.0` — the negative zero is created *by the rounding inside the
format spec*, after your normalisation has already run. This is the exact
scenario PEP 682 was written for, and it is why the `'z'` option is documented
as acting "after rounding to the format precision".

**★ `'z'` is unavailable in `%`-formatting, and `logging` uses `%`-formatting by
default.** A codebase that switched all its display formatting to `'z'` will
still emit `-0.00` from every log line, because `logger.info("%.2f", x)` never
reaches the format mini-language. Fixing that means constructing the
`logging.Formatter` with `style='{'`, or normalising the value before it is
logged.

**★ `'z'` does not change the value, so a `'z'`-formatted number that is later
re-parsed is a different float.** `float(f"{x:z.2f}")` gives `0.0` where
`float(f"{x:.2f}")` gives `-0.0`. If a format string is being used as a
serialisation step rather than a display step — writing a fixed-width file, for
instance — adding `'z'` silently changes the data, not just its appearance.

**★ `'z'` is only valid for floating-point presentation types, so `f"{n:zd}"` is
an error.** PEP 682 explicitly disallowed it for integer types, on the grounds
that there is no negative integer zero to suppress. A generic formatting helper
that pastes `'z'` in front of a caller-supplied type character breaks the moment
someone passes `'d'`.

**★ `str()` and `repr()` cannot be fixed, by design.** `repr` is contractually
the shortest string that reconstructs the float, and reconstructing `-0.0`
requires the minus. Anything that goes through `str` — `print`, `csv.writer`,
`json`, an f-string with no format spec, `%s` — will show the sign. The fix has
to be applied to the value or at an explicit format spec; there is no global
switch.

**★ A `-0` in a golden file or approval test is a one-character diff that no
assertion catches.** The test compares strings, so it fails; the developer
compares values, so they look equal; and the cause — that a rounding step in a
format spec produced a negative zero — is three layers away from the diff.
Normalise at the point where output is generated, and record in the test why.

**★ `f"{x:.0f}"` on a negative zero gives `-0`, which looks like the `'g'`
output but arrives by a different route.** `'f'` with `p=0` omits the decimal
point (*"If `p=0`, the decimal point is omitted unless the `#` option is
used"*), so you get `-0` from the ordinary digit-rendering path rather than from
the special-value short circuit. It matters because `'.0f'` obeys `'z'` and the
special-case sentence is irrelevant to it — the two produce the same characters
for different reasons.

## Interview questions

**★ Why does `f"{-0.0:g}"` give `-0` but `f"{-0.0:.1f}"` give `-0.0`?**
Because the format mini-language documents a special case for the `'g'`
presentation type only: *"Positive and negative infinity, positive and negative
zero, and nans, are formatted as `inf`, `-inf`, `0`, `-0` and `nan`
respectively, regardless of the precision."* `'g'` short-circuits the five
special values before its significant-digit rounding ever runs. `'f'` has no
such rule; it renders exactly `p` digits after the point as documented, so a
negative zero at precision 1 comes out as `-0.0`.

**★ What does the `'z'` format option do, and why is "after rounding" the
important part?**
It *"coerces negative zero floating-point values to positive zero after rounding
to the format precision"*. The "after rounding" clause is the whole value of the
feature: the common case is not a value that is already `-0.0`, it is a small
negative like `-0.004` that *becomes* `-0.0` when the format spec rounds it to
two places. Normalising the value before formatting therefore does not help, and
PEP 682 notes that pre-rounding is *"prone to error if the rounding doesn't
precisely match that of the format spec"*. `'z'` is applied at the only point
where the negative zero actually exists.

**★ You add `'z'` everywhere and still see `-0.00` in the logs. Why?**
Because `logging` formats with `%`-style by default, and PEP 682 deliberately
did not extend printf-style formatting with the new option. `logger.info("%.2f",
x)` never touches the format mini-language. Either construct the `Formatter`
with `style='{'` so that `str.format` and its options apply, or normalise the
value with `x + 0.0` before it reaches the logging call.

**★ Should you fix negative zero in the value or in the format string?**
In the format string, unless the value itself is wrong. `'z'` is a display
decision applied at the display site, which keeps the arithmetic honest and
leaves `copysign` still able to tell you what happened. Normalising the value
with `x + 0.0` is correct when the sign genuinely carries no meaning in your
domain and you want it gone before it can reach a hash, a set, a database or a
serialiser — that is, when the problem is at a boundary rather than on a screen.
Doing both means one of the two is dead code.

**★ Why can't `repr` just drop the minus?**
Because `repr` of a float is contractually a string that reconstructs the same
float, and `float('0.0')` is not `-0.0`. Dropping the sign would break
`float(repr(x)) == x` at the bit level and would make `eval(repr(x))` lossy for
a value the language can represent. The `None` presentation type is documented
as matching `str()` for exactly this reason, which is why the default f-string
path shows the sign too.

**★ Does `Decimal` get the `'z'` option?**
The mini-language introduces the floating-point presentation types as shared by
`float` and `Decimal`, and restricts `'z'` to *"floating-point presentation
types"* rather than to the `float` type — which reads as though `Decimal` is
included. The documentation gives no `Decimal` example, so this is worth
confirming in your own build rather than asserting. What is certain is that
`Decimal` renders its sign field in `str()` and its default presentation type is
`'g'`-family, so a `Decimal` pipeline will show negative zeros unless something
suppresses them.

---

← Prev: [What erases the sign](06e-what-erases-the-sign.md) · Index: [Numbers](README.md) · Next → [Negative zero across a boundary](06g-negative-zero-across-a-boundary.md)

{/* FOOTER */}
