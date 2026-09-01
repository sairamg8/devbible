---
title: "quantize is the only thing that holds a Decimal at two places, and knowing which operations break that invariant is the whole of fixed-point discipline"
sidebar_label: "10c · quantize and fixed point"
sidebar_position: 102
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-01 against the Python 3.14 library reference for
> [`Decimal.quantize`](https://docs.python.org/3.14/library/decimal.html#decimal.Decimal.quantize),
> [`Decimal.normalize`](https://docs.python.org/3.14/library/decimal.html#decimal.Decimal.normalize),
> [`Decimal.same_quantum`](https://docs.python.org/3.14/library/decimal.html#decimal.Decimal.same_quantum),
> [rounding a `Decimal` with `round()`](https://docs.python.org/3.14/library/decimal.html#decimal.Decimal.__round__)
> and the [`decimal` FAQ](https://docs.python.org/3.14/library/decimal.html#decimal-faq).
> Version spine: **Python 3.14.7**.

**`Decimal` is a floating-point type: nothing in it pins a value to two decimal
places. A money invariant — *every amount in this system has exponent `-2`* — is
something you impose, and `quantize` is the one operation that imposes it. The
discipline has two halves: know which operations preserve the invariant (addition,
subtraction, multiplication by an integer) and which destroy it (division,
multiplication by anything else), and follow the destroyers with a `quantize`.**

## Significance: why the invariant needs defending

`Decimal` keeps trailing zeros because the exponent is part of the value:

> *"The decimal module incorporates a notion of significant places so that
> `1.30 + 1.20` is `2.50`. The trailing zero is kept to indicate significance.
> This is the customary presentation for monetary applications. For
> multiplication, the 'schoolbook' approach uses all the figures in the
> multiplicands. For instance, `1.3 * 1.2` gives `1.56` while `1.30 * 1.20` gives
> `1.5600`."*

Two consequences run through everything below. First, `str(Decimal('2.50'))` is
`'2.50'` — the type formats money correctly with no format string, which is
exactly why code prints `Decimal` directly and then produces `'325.6224'` in an
invoice the day someone multiplies by a rate. Second, **multiplication grows the
scale**: two two-place values produce a four-place value. *Amount times rate is
not money.* It is an intermediate, and it becomes money only when you quantize it.

## `quantize` in one sentence, and two rules that are unique to it

> *"Return a value equal to the first operand after rounding and having the
> exponent of the second operand."*

```python
from decimal import Decimal

Decimal('1.41421356').quantize(Decimal('1.000'))   # Decimal('1.414')

TWOPLACES = Decimal(10) ** -2                      # same as Decimal('0.01')
Decimal('3.214').quantize(TWOPLACES)               # Decimal('3.21')
```

The second operand is used only for its **exponent**; its digits are irrelevant.
`Decimal('0.01')`, `Decimal('1.00')` and `Decimal('9.99')` all quantize to two
places. Naming the constant — `TWOPLACES`, or `CENTS` — is worth doing precisely
because the literal reads like a value and is not one.

**Rule 1 — it can raise where other operations would silently round.**

> *"Unlike other operations, if the length of the coefficient after the quantize
> operation would be greater than precision, then an `InvalidOperation` is
> signaled. This guarantees that, unless there is an error condition, the
> quantized exponent is always equal to that of the right-hand operand."*

Read the guarantee, because it is the reason to accept the exception: after a
successful `quantize`, the exponent **is** the one you asked for. There is no
"mostly two places". Every other operation in the module will quietly discard
digits from the right to fit `prec`; `quantize` refuses, because silently
returning a three-place number from a call whose entire purpose was to produce two
places would be worse than failing.

The failure is a *precision* failure, not a scale failure. Quantizing a
twelve-digit amount to two places needs fourteen significant digits; under a
context with `prec=9` it raises. This is a live risk in any code that reduces
`prec` — `BasicContext` and `ExtendedContext` both set it to nine — or that
handles large nominal currencies.

```python
from decimal import Decimal, localcontext, InvalidOperation

with localcontext(prec=9):
    Decimal('123456789012.5').quantize(Decimal('0.01'))   # raises InvalidOperation
```

**Rule 2 — it never signals `Underflow`.**

> *"Also unlike other operations, quantize never signals `Underflow`, even if the
> result is subnormal and inexact."*

So a tiny value quantized to two places gives `Decimal('0.00')` and sets `Inexact`
and `Rounded`, but not `Underflow`. If you are watching flags to detect "a value
vanished" ([10d](10d-signals-flags-and-traps.md)), `Underflow` is the wrong flag —
watch `Inexact`.

There is still an outer boundary: *"An error is returned whenever the resulting
exponent is greater than `Emax` or less than `Etiny()`."* Money never reaches it
with the default `Emin`/`Emax`; a context copied from an IEEE interchange format
can.

## Which operations preserve the invariant

Straight from the FAQ, and worth committing to memory:

> *"**Q: Once I have valid two place inputs, how do I maintain that invariant
> throughout an application?** A: Some operations like addition, subtraction, and
> multiplication by an integer will automatically preserve fixed point. Others
> operations, like division and non-integer multiplication, will change the number
> of decimal places and need to be followed-up with a `quantize()` step"*

```python
a = Decimal('102.72')            # Initial fixed-point values
b = Decimal('3.17')
a + b                            # Decimal('105.89') — addition preserves fixed-point
a - b                            # Decimal('99.55')
a * 42                           # Decimal('4314.24') — so does integer multiplication
(a * b).quantize(TWOPLACES)      # Decimal('325.62') — must quantize non-integer multiplication
(b / a).quantize(TWOPLACES)      # Decimal('0.03')   — and quantize division
```

Note *why* the rules are what they are: adding two values with exponent `-2` gives
exponent `-2`; multiplying by an integer (exponent `0`) gives `-2 + 0`;
multiplying two two-place values gives `-4`; division gives whatever `prec`
allows, typically 28 places of a repeating expansion.

The FAQ's own recommendation is to make the follow-up unforgettable by wrapping it:

> *"In developing fixed-point applications, it is convenient to define functions to
> handle the `quantize()` step"*

```python
def mul(x, y, fp=TWOPLACES):
    return (x * y).quantize(fp)

def div(x, y, fp=TWOPLACES):
    return (x / y).quantize(fp)
```

In a real codebase this becomes a `Money` type whose `__mul__` and `__truediv__`
quantize, so the invariant cannot be broken by forgetting. The rounding mode is a
policy decision that belongs on that type, not at each call site
([10e](10e-rounding-modes-for-money.md)).

## Validation: the `Inexact` trap idiom

The same call does double duty. Quantizing a value that *already* has the right
scale is a no-op — unless you ask to be told:

> *"The `quantize()` method rounds to a fixed number of decimal places. If the
> `Inexact` trap is set, it is also useful for validation"*

```python
from decimal import Decimal, Context, Inexact

TWOPLACES = Decimal(10) ** -2

Decimal('3.21').quantize(TWOPLACES, context=Context(traps=[Inexact]))   # fine
Decimal('3.214').quantize(TWOPLACES, context=Context(traps=[Inexact]))  # raises Inexact
```

This is the tool for an input boundary where "rounding it silently" would be
fraud. A payment instruction that arrives as `100.005` should not become `100.01`
without a decision; the `Inexact` trap makes the arrival of an over-precise amount
an error you can return to the caller. Note that the `context=` keyword scopes the
trap to this one call — no global state, no `localcontext` block.

The two modes give you the whole boundary policy in one primitive:

```python
def to_money(d: Decimal, *, strict: bool) -> Decimal:
    if strict:                       # inbound instruction: over-precision is an error
        return d.quantize(TWOPLACES, context=Context(traps=[Inexact]))
    return d.quantize(TWOPLACES)     # computed result: rounding is expected
```

## Checking the invariant instead of hoping

```python
Decimal('2.50').as_tuple().exponent            # -2
Decimal('2.50').same_quantum(Decimal('0.01'))  # True
```

`same_quantum` is *"Test whether self and other have the same exponent or whether
both are `NaN`"*, and *"This operation is unaffected by context and is quiet: no
flags are changed and no rounding is performed."* Quiet and context-free makes it
the right assertion for a hot path or a `__post_init__`:

```python
from dataclasses import dataclass
from decimal import Decimal

CENT = Decimal('0.01')

@dataclass(frozen=True)
class Money:
    amount: Decimal
    currency: str

    def __post_init__(self):
        if not self.amount.is_finite() or not self.amount.same_quantum(CENT):
            raise ValueError(f"not a two-place amount: {self.amount!r}")
```

The `is_finite()` guard is load-bearing: `same_quantum` returns `True` when *both*
operands are `NaN`, and a `Decimal('NaN')` compared against `CENT` is `False`, so
the finiteness check is what actually keeps `NaN` out.

## Gotchas

**★ `Decimal` does not stay at two places by itself.** There is no fixed-point
type here. `Decimal('10.00') / 4` is `Decimal('2.5')` — one place — and
`Decimal('10.00') / 3` has twenty-eight. Every place in the codebase that produces
money from a division or a rate must quantize, or the invariant is decorative.

**★ `quantize` can raise `InvalidOperation` on a perfectly ordinary amount.** The
rule is about `prec`, not about scale: coefficient length after quantizing must
fit the context precision. A reduced `prec` (`BasicContext` is nine) plus a large
amount is enough. If you lower `prec` anywhere, audit every `quantize` reachable
from it — and prefer setting `prec` from your widest amount rather than tuning it
for speed.

**★ The second argument's digits are ignored, so a typo is invisible.**
`d.quantize(Decimal('0.1'))` and `d.quantize(Decimal('0.01'))` differ by one
character and by a factor of ten in your output. Because only the exponent is
read, `Decimal('1.00')` also means two places — which reads like "one" to a
reviewer. Use a named constant.

**★ `normalize()` is not "clean up the number" — it strips your scale.**
*"…if the final result is finite it is reduced to its simplest form, with all
trailing zeros removed"*, so `Decimal('2.50').normalize()` is `Decimal('2.5')` and
`Decimal('200').normalize()` is `Decimal('2E+2')`. It is for producing a canonical
representative of an equivalence class, not for display. Calling it on money
destroys the two-place invariant and can turn `100.00` into `1E+2` in a report.

**★ `Underflow` will not tell you that an amount rounded away to zero.** `quantize`
never signals it. A per-unit fee of `0.004` on one unit quantizes to `Decimal('0.00')`
and sets `Inexact`; watch that flag, or compare against zero explicitly, if
"charged nothing" needs to be detected.

**★ `same_quantum` is `True` for two `NaN`s.** *"Test whether self and other have
the same exponent or whether both are `NaN`."* An invariant check written only as
`amount.same_quantum(CENT)` passes a `NaN` amount if `CENT` were ever `NaN`, and
more practically returns `False` for a `NaN` amount without telling you *why*.
Check `is_finite()` explicitly so the error message is honest.

## Interview questions

**★ Why does `Decimal` keep trailing zeros, and where does that bite?**
Because significance is part of the value: a `Decimal` is a sign, coefficient
digits and an exponent, and the exponent is not normalised away. That is the
schoolbook convention — `1.30 + 1.20` is `2.50` — and it is why money prints
correctly with a bare `str()`. It bites in three places. Multiplication grows the
scale (`1.30 * 1.20` is `1.5600`), so a product is not money until quantized;
`str()` is representation-sensitive, so idempotency keys or signatures built from
it diverge between `2.5` and `2.50`; and `normalize()`, which looks like a
tidy-up, strips the zeros and breaks the invariant.

**★ Which operations preserve a two-place `Decimal`, and which do not?**
Addition, subtraction and multiplication by an integer preserve it — the exponents
work out. Division and multiplication by a non-integer do not: multiplying two
two-place values yields four places, and division yields whatever the context
precision allows. Those two need a `quantize` follow-up, which is why the FAQ
recommends wrapping them in `mul`/`div` helpers, or in a `Money` type whose
operators quantize for you.

**★ `quantize` raised `InvalidOperation` on `Decimal('123456789012.5')` at two
places. Why, and what do you change?**
Because `quantize` is the one operation that refuses to lose digits to fit
precision: quantizing that value to two places needs a fourteen-digit coefficient,
and the context's `prec` was smaller. The documented rule is that if the
coefficient after quantizing would exceed `prec`, `InvalidOperation` is signalled —
which guarantees that a successful `quantize` always produces exactly the exponent
you asked for. The fix is to raise `prec` to cover your widest amount plus its
scale, not to catch the exception.

**★ How do you validate that an incoming amount has no more than two decimal places,
without rounding it?**
Quantize it with the `Inexact` trap set for that one call:
`d.quantize(TWOPLACES, context=Context(traps=[Inexact]))`. If the value already
fits, you get it back; if it carries extra non-zero digits, `Inexact` is raised
and you can reject the request instead of silently rounding someone's money. The
`context=` keyword confines the trap to the call, so no global state is touched.

**★ How would you make the two-place invariant impossible to break in a large
codebase?**
Stop passing bare `Decimal`s. Define a `Money` value object that quantizes in its
constructor, asserts `same_quantum` plus `is_finite` in `__post_init__`, refuses
construction from `float`, carries its currency, and whose `__mul__` and
`__truediv__` quantize the result with an explicit rounding mode. Then the
invariant is enforced by the type, and code review only has to check the small
number of places that construct one — with `FloatOperation` trapped in CI
([10d](10d-signals-flags-and-traps.md)) to catch the rest.

---

← Prev: [Contexts, precision and signals](10b-contexts-precision-and-signals.md) · Index: [Numbers](README.md) · Next → [Signals, flags and traps](10d-signals-flags-and-traps.md)

{/* FOOTER */}
