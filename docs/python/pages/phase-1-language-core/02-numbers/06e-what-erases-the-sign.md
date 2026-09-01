---
title: "abs, int and any addition of an opposite-signed zero destroy the sign bit, which is why sum() of negative zeros is positive and why x + 0.0 is the one normalisation that changes nothing else"
sidebar_label: "6e · What erases the sign"
sidebar_position: 64
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-01 against the Python 3.14
> [Built-in Functions](https://docs.python.org/3.14/library/functions.html)
> reference (`abs`, `int`, `float`, `sum`, `round`),
> [`math`](https://docs.python.org/3.14/library/math.html) (`fabs`, `fsum`,
> `prod`, `floor`, `ceil`, `trunc`, `copysign`, and the module-wide
> *"all return values are floats"* rule), and
> [`decimal`](https://docs.python.org/3.14/library/decimal.html).
> Version spine: **Python 3.14.7**.

**Half the operations you would expect to be sign-neutral destroy the sign of a
zero, and the split is not intuitive. `abs()` and `math.fabs()` erase it — that
is their job. `int()` erases it, and so does every `math` function that returns
an integral value. And `-0.0 + 0.0` erases it, because IEEE 754's
round-to-nearest says a sum of opposite-signed zeros is `+0` — which is why
`sum()` erases it too, since `sum` starts from the integer `0`. Knowing which
operations are lossy is what lets you pick `x + 0.0` as the one normalisation
that removes negative zeros and changes nothing else in the dataset.**

## The table

| Expression | Result | Sign |
|---|---|---|
| `-(-0.0)` | `0.0` | flipped |
| `+(-0.0)` | `-0.0` | kept — unary plus on a float is identity |
| `abs(-0.0)` | `0.0` | destroyed |
| `math.fabs(-0.0)` | `0.0` | destroyed |
| `int(-0.0)` | `0` | destroyed — `int` has no sign bit |
| `float(int(-0.0))` | `0.0` | destroyed by the round trip |
| `math.floor(-0.0)` | `0` | destroyed — returns an `int` |
| `math.ceil(-0.0)` | `0` | destroyed — returns an `int` |
| `math.trunc(-0.0)` | `0` | destroyed — returns an `int` |
| `round(-0.0)` | `0` | destroyed — no `ndigits` means an `int` |
| `round(-0.0, 2)` | `-0.0` | kept — `ndigits` given, so same type |
| `-0.0 * 1.0` | `-0.0` | kept |
| `-0.0 / 1.0` | `-0.0` | kept |
| `-0.0 // 1.0` | `-0.0` | kept — float `//` returns a float |
| `-0.0 ** 1` | `-0.0` | kept |
| `-0.0 + 0.0` | `0.0` | destroyed |
| `-0.0 - 0.0` | `-0.0` | kept |
| `-0.0 + -0.0` | `-0.0` | kept |
| `sum([-0.0])` | `0.0` | destroyed — `sum` starts at int `0` |
| `math.fsum([-0.0])` | `-0.0` | kept — no integer start value |
| `math.prod([-0.0])` | `-0.0` | kept — start is `1`, and `1 * -0.0` is `-0.0` |
| `math.copysign(1.0, -0.0)` | `-1.0` | read, not erased |
| `Decimal(-0.0)` | `Decimal('-0')` | kept |
| `float(repr(-0.0))` | `-0.0` | kept — `repr` renders the minus |

There are three distinct mechanisms in that table and it is worth naming them
separately, because each has a different scope.

## Mechanism 1: the type has no sign bit

`int` cannot represent a negative zero at all — there is one integer zero and it
is unsigned. So every conversion into `int` is lossy for this one value, and
that includes far more than the obvious `int(x)`:

- `int(x)`;
- `math.floor`, `math.ceil`, `math.trunc`, which the docs describe as returning
  an `Integral` value;
- `round(x)` with `ndigits` omitted or `None`, which is documented to return an
  integer;
- an `INTEGER` column in a database, and `parse_int` in a JSON decoder — see
  [06g](06g-negative-zero-across-a-boundary.md).

This is usually a *good* thing: an integer round trip is the cheapest sign
normalisation there is. But it means a pipeline that passes through an integer
representation is silently lossy in a way that no type annotation and no test
will reveal, because the before and after values still compare equal.

## Mechanism 2: absolute value throws the sign away by definition

`abs(-0.0)` is `0.0` and `math.fabs(-0.0)` is `0.0`. Neither is surprising once
stated; what is surprising is how often `abs()` is reached for as a
negative-zero cleanup by someone who has reasoned "the value is non-negative
anyway, so `abs` is a no-op". It is a no-op right up until a genuinely negative
value appears, at which point it silently changes the number rather than the
zero. The two calls also differ in a second way — `abs()` returns the operand's
type (an `int` for an `int`, a `Decimal` for a `Decimal`, a magnitude for a
`complex`), whereas `math.fabs` always returns a float. See
[14](14-math-vs-the-operators.md).

## Mechanism 3: opposite-signed zeros add to `+0`

Under IEEE 754's default round-to-nearest mode, the sum of two zeros of
**opposite** sign is `+0`; only two zeros of the **same** sign keep that sign.
Subtraction follows from the same rule with the second operand negated, which is
why `-0.0 - 0.0` keeps the sign while `-0.0 + 0.0` does not.

This is a rule of the standard and of the underlying C double arithmetic. The
Python documentation does not state it, so treat it as inherited platform
behaviour rather than a language guarantee — and if your code depends on it,
pin it with a `copysign` assertion in a test rather than reasoning about it from
first principles in a comment.

### Which is why `sum()` erases the sign

`sum()` starts from the integer `0`. So `sum([-0.0])` evaluates `0 + (-0.0)` —
an opposite-signed zero addition — which is `+0.0`. Every subsequent addition is
then `0.0 + (-0.0)`, which is `+0.0` again. **`sum` of an all-negative-zero
iterable gives you a positive zero, and the loss happens on the very first
step.**

`math.fsum` does not have the problem because it does not begin from an integer
start; `math.prod` does not because its documented default start is `1` and
multiplication XORs the sign bits rather than adding magnitudes:

```python
sum([-0.0, -0.0])            # 0.0  - the int 0 start destroyed the sign
sum([-0.0, -0.0], -0.0)      # -0.0 - explicit start of the right sign
math.fsum([-0.0, -0.0])      # -0.0
math.prod([-0.0, 1.0])       # -0.0
```

The `fsum` and `prod` behaviours follow from the same IEEE rules plus the
documented start values; neither is spelled out in the `math` docs, so verify
with `copysign` rather than depending on it silently. See
[05d](05d-accurate-float-arithmetic.md) for what those functions are actually
for.

## The targeted normalisation

If the goal is to remove negative zeros from a pipeline without touching any
other value, the operation is `x + 0.0`:

```python
def normalise_zero(x: float) -> float:
    """-0.0 -> 0.0; every other float unchanged."""
    return x + 0.0
```

Adding a positive zero turns `-0.0` into `0.0` by mechanism 3, and leaves every
finite non-zero float bit-identical, because adding zero to a finite float is
exact — there is no rounding step that could perturb it. It also leaves `inf`,
`-inf` and NaN alone. Compare the alternatives:

| Candidate | Removes `-0.0`? | Damage |
|---|---|---|
| `x + 0.0` | yes | none |
| `abs(x)` | yes | changes every negative value |
| `x if x else 0.0` | yes | correct only because both zeros are falsy; reads as a puzzle |
| `0.0 if x == 0 else x` | yes | correct, but three tokens longer and states the mechanism nowhere |
| `x + 0` | yes | works, but the `int` operand invites a "why?" in review |
| `float(format(x, 'z.17g'))` | yes | a text round trip to change one bit; slow and fragile |

`x + 0.0` wins on being exact, total and one operator wide. If the requirement
is only that the value should not *print* with a minus sign, do not touch the
value at all — use the `'z'` format option,
[06f](06f-printing-negative-zero.md).

## Gotchas

**★ `sum()` of negative zeros is a positive zero, because `sum`'s start is the
integer `0`.** This bites anyone aggregating signed deltas who expects the sign
of an all-zero group to survive to the report. Pass `start=-0.0`, or use
`math.fsum`, or stop treating the sign bit as data. The sneaky part is that it
is not a rounding error and not a precision problem — it is a total loss of one
bit on the very first addition, in a function nobody suspects.

**★ `abs()` and `math.fabs()` both destroy the sign, so "normalise then compare"
hides the problem rather than solving it.** `abs(x)` on a value that could
legitimately be negative changes the number, not just the zero. Reviewers wave
it through because it looks like a no-op on a value they believe is
non-negative, and then the day a genuinely negative value arrives it is silently
made positive. The targeted normalisation is `x + 0.0`.

**★ Every route through `int` loses the sign permanently, and there are more of
them than you think.** `int(x)`, `math.floor`, `math.ceil`, `math.trunc`,
one-argument `round`, an `INTEGER` database column, and a JSON `-0` token routed
through `parse_int`. None of them warns. The values still compare equal
afterwards, so no assertion catches it.

**★ `abs()` and `math.fabs()` are not interchangeable beyond floats.** `abs()`
returns the operand's own type — `int` for `int`, `Decimal` for `Decimal`,
`Fraction` for `Fraction`, and the *magnitude* for a `complex`. `math.fabs`
converts to float and returns a float, per the module rule *"Except when
explicitly noted otherwise, all return values are floats"*, which means it
silently loses precision on a large `int` and raises on a `complex`. Reaching
for `fabs` because it looks more "mathematical" is a downgrade.

**★ `-0.0 - 0.0` keeps the sign but `-0.0 + 0.0` does not, and the two lines
look identical at a glance.** A refactor that rewrites `a - b` as `a + (-b)`, or
that flips the sign convention of an accumulator, changes the sign of the zero
rows. This is the kind of change that passes every test because every test
compares with `==`.

**★ `math.fsum` preserving the sign is not documented.** Neither is
`math.prod`'s. Both follow from the IEEE rules plus the documented start values,
and both are stable in practice, but the `math` documentation does not commit to
them. If a pipeline depends on the sign surviving an aggregation, pin it with an
explicit `copysign` assertion in a test rather than trusting the inference.

**★ `+x` does *not* normalise a float, but it *does* normalise a `Decimal`.**
Unary plus on a float is the identity, so `+(-0.0)` is still `-0.0`. On a
`Decimal`, unary plus applies the context — it is the documented idiom for
rounding a `Decimal` to the current context precision — so `+Decimal('-0')`
goes through the context's rounding. Copying the `+x` idiom across types gives
you two entirely different operations that look the same.

**★ A round trip through `repr` preserves the sign; a round trip through
`format` may not.** `float(repr(-0.0))` gives back `-0.0`, because `repr`
renders the minus. `float(format(-0.0, 'z.2f'))` gives `0.0`, because the `'z'`
option was designed to suppress it. Serialisers built on `format` rather than
`repr` are therefore lossy for this one value — which is fine if it was
deliberate and a bug if the format string was chosen for column width.

## Interview questions

**★ Why does `sum([-0.0, -0.0])` give `0.0`?**
`sum()` starts from the integer `0`, so the first addition is `0 + (-0.0)`.
Under IEEE 754's round-to-nearest, adding two zeros of opposite sign yields
`+0`, so the sign is destroyed on the very first step and never comes back —
every later addition is `0.0 + (-0.0)`, which is `+0.0` again. Passing
`start=-0.0` preserves it, because then every addition is same-sign. This is
standard-and-platform behaviour that Python's own documentation does not spell
out, so it is worth an assertion rather than a comment.

**★ You want to remove negative zeros from a pipeline without changing any other
value. What do you write, and why not `abs`?**
`x + 0.0`. Adding a positive zero turns `-0.0` into `0.0` and leaves every other
float — finite, infinite or NaN — unchanged, because adding zero to a finite
float is exact. `abs(x)` also removes it, but it changes the sign of every
genuinely negative value in the data, which is almost certainly not what was
intended and is invisible in review because `abs` reads as harmless. If the
requirement is only that it must not *print* with a minus, the right tool is the
`'z'` format option and the value should not be touched at all.

**★ Which aggregation functions preserve the sign of an all-negative-zero input,
and why?**
`math.fsum` and `math.prod` do; the built-in `sum` does not. `sum`'s default
start is the integer `0`, which makes the first operation an opposite-signed
zero addition and immediately yields `+0`. `math.prod`'s documented default
start is `1`, and `1 * -0.0` keeps the sign because multiplication XORs the sign
bits. `math.fsum` accumulates exact partial sums with no integer start. None of
this is stated in the `math` documentation, so it should be pinned by a test
rather than assumed.

**★ Name the three distinct mechanisms by which a negative zero loses its
sign.**
One, the destination type has no sign bit — every conversion to `int`, whether
via `int()`, `math.floor`/`ceil`/`trunc`, one-argument `round`, an integer
database column or a JSON integer token. Two, absolute value, which discards the
sign by definition — `abs()` and `math.fabs()`. Three, addition of an
opposite-signed zero, which IEEE 754's round-to-nearest resolves to `+0`; this
is the one that catches people, because it is what makes `sum()` lossy.

**★ `abs(x)` versus `math.fabs(x)` — when does the choice matter?**
Whenever `x` is not already a float. `abs` returns the operand's own type, so
`abs` of a large `int` is exact, `abs` of a `Decimal` stays a `Decimal`, and
`abs` of a `complex` is its magnitude. `math.fabs` converts to float first, so
it loses precision above 2\*\*53 on an `int`, silently changes a `Decimal` into a
float, and raises on a `complex`. For floats the two agree; for everything else
`abs` is the correct default and `fabs` is a narrowing conversion in disguise.

**★ `+x` is proposed as a way to normalise negative zero. Does it work?**
Not for floats — unary plus on a float is the identity, so `+(-0.0)` is still
`-0.0`. It looks plausible because on a `Decimal` unary plus *does* do
something: it applies the current context, and is the documented idiom for
rounding a `Decimal` to the context precision. So the same one-character
operator is a no-op on one type and a rounding operation on another, and copying
it across types is a real source of confusion. Use `x + 0.0` for floats.

---

← Prev: [Where negative zero comes from](06d-where-negative-zero-comes-from.md) · Index: [Numbers](README.md) · Next → [Printing negative zero](06f-printing-negative-zero.md)

{/* FOOTER */}
