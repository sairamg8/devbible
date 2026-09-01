---
title: "complex is a language type, not a library one — and it has no ordering, no // and no %"
sidebar_label: "13 · complex"
sidebar_position: 130
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-31 against the Python 3.14 library reference
> ([Numeric Types — int, float, complex](https://docs.python.org/3.14/library/stdtypes.html#numeric-types-int-float-complex),
> [`complex()`](https://docs.python.org/3.14/library/functions.html#complex),
> [`numbers`](https://docs.python.org/3.14/library/numbers.html),
> [`cmath`](https://docs.python.org/3.14/library/cmath.html))
> and [PEP 3141 — A Type Hierarchy for Numbers](https://peps.python.org/pep-3141/).
> Version spine: **Python 3.14.7**.

**Python has a complex number type in the language itself, not in a library — `3j`
is an imaginary literal, `(1+2j).real` is a float, and `abs(z)` is the modulus. What
it does *not* have is any ordering: the docs state that complex numbers *"do not
support ordering or floor division/modulo operations"*, so `<` raises `TypeError`
and so do `//` and `%` — which means a single complex value in a list is enough to
make `sorted()`, `max()` and `heapq` raise, months after the code was written.
Mixing a `complex` with an `int` widens the `int` to a **float**, not to a complex,
so an integer-valued result comes back with float parts. The functions live one
module away in [`cmath`](13b-cmath.md), and the abstract structure over all the
numeric types is [the numeric tower](13c-the-numeric-tower.md).**

## The concrete type

An imaginary literal is a `j` or `J` suffix, and there is no complex literal as
such — `1+2j` is an `int` plus an imaginary `float`, evaluated at runtime.

```python
z = 1 + 2j
z.real            # 1.0   — always a float, even from an int operand
z.imag            # 2.0
z.conjugate()     # (1-2j)
abs(z)            # the modulus, a float
```

`z.real` and `z.imag` are attributes, not methods, and they are **always floats**.
`conjugate()` is a method. `abs(z)` gives the modulus rather than an absolute value
in any ordering sense, which is the only "size" a complex number has.

`int` and `float` carry `.real`, `.imag` and `.conjugate()` too — `(5).imag` is `0`
— which is what lets generic numeric code handle all three without branching.

### The constructor and its string grammar

`complex()` has three forms — from a number, from a string, or from a real and an
imaginary part. The string form is stricter than people expect:

> *"The string must not contain whitespace between `'+'`, `'-'`, the `'j'` or `'J'`
> suffix, and the decimal number. For example, `complex('1+2j')` is fine, but
> `complex('1 + 2j')` raises `ValueError`."*

Surrounding whitespace and round parentheses *are* allowed and ignored, so the docs'
own example `complex('\t( -1.23+4.5J )\n')` parses. The sign of the imaginary part is
mandatory when both parts are present. Underscores are allowed since 3.6, as in
literals.

For a general object, the conversion chain is `__complex__()`, falling back to
`__float__()`, falling back to `__index__()` — the same shape as `float()`'s chain
one rung down.

**Deprecated in 3.14:** *"Passing a complex number as the `real` or `imag` argument
is now deprecated; it should only be passed as a single positional argument."* So
`complex(1+2j, 3)` warns today. If you were relying on the two-complex-argument
behaviour — the docs define it as returning real component `real.real-imag.imag` and
imaginary component `real.imag+imag.real`, which is multiplication by `1j` in
disguise — write the multiplication instead.

**Added in 3.14:** `complex.from_number(x)`, a classmethod that *"only accepts a
single numeric argument"*, alongside `int.from_number()` and `float.from_number()`.
These exist because the plain constructors also accept strings; `from_number` is the
form to use when a string must be rejected, which is exactly the case at a validation
boundary.

### What complex does not have

> *"Complex numbers do not support ordering or floor division/modulo operations. The
> `<`, `<=`, `>` and `>=` operators raise a `TypeError` exception when one of the
> arguments is a complex number."*

There is no total order on the complex plane that respects arithmetic, so this is
mathematics rather than an omission. The practical consequences:

- `sorted(values)` raises the moment one element is complex.
- `max()`, `min()` and `heapq` raise for the same reason.
- `//`, `%` and `divmod()` raise.
- `==` and `!=` work fine, so `in`, dict keys and sets all work.

If you need to sort complex numbers, sort by a real-valued key you choose —
`key=abs`, or `key=cmath.phase`, or `key=lambda z: (z.real, z.imag)` — and say in a
comment which one, because the three give different orders.

## Mixed-type arithmetic: which operand gets widened

The rule is a three-line ladder in the docs:

> *"If both arguments are complex numbers, no conversion is performed; if either
> argument is a complex or a floating-point number, the other is converted to a
> floating-point number; otherwise, both must be integers and no conversion is
> necessary."*

The second clause is the one that surprises: mixing a `complex` with an `int` widens
the `int` to a **float**, not to a complex, and the arithmetic is then defined by the
formulas the docs give — `x + complex(u, v) = complex(x + u, v)`. The visible effect
is that an integer-valued result comes back with float parts.

Comparisons are exempt from widening: *"A comparison between numbers of different
types behaves as though the exact values of those numbers were being compared."*
That is why `Fraction(1, 3) == 0.3333333333333333` is `False` rather than being
decided by a lossy conversion.

## Where complex is actually used

Worth knowing, because "I have never needed it" is usually true right up until it is
not:

- **Signal processing and FFTs.** The output of a real FFT is complex by definition;
  magnitude is `abs(z)` and phase is `cmath.phase(z)`.
- **2-D geometry and rotation.** Multiplying by `cmath.rect(1, theta)` rotates a
  point about the origin, which is shorter and less error-prone than a rotation
  matrix.
- **Electrical engineering.** Impedance is complex; note that the domain writes the
  imaginary unit as `i` while Python's literal suffix is `j` — which is also the
  engineering convention, and the reason Python chose it.
- **Control theory and root finding.** The roots of a real polynomial are complex in
  general, so any solver returns complex values even for real input.

## Gotchas

### `sorted()` raises on a list that is usually real

**Symptom.** `TypeError: '<' not supported between instances of 'complex' and 'complex'`,
from a sort that has worked for months.
**Cause.** Complex numbers have no ordering; one complex value entered the list.
**Fix.** Sort by an explicit real key and document the choice:

```python
values.sort(key=abs)             # or key=cmath.phase, or key=lambda z: (z.real, z.imag)
```

### `//` and `%` raise on a complex

**Symptom.** A generic numeric helper that works for `int` and `float` raises for
`complex`.
**Cause.** The docs exclude complex from floor division and modulo entirely.
**Fix.** Branch on the type, or restrict the helper's contract to `numbers.Real` and
say so in the signature.

### `complex('1 + 2j')` raises `ValueError`

**Symptom.** A value parsed fine from one source and not from another.
**Cause.** The string grammar forbids whitespace *inside* the number, though it
allows it around the whole thing and inside parentheses.
**Fix.** Strip internal whitespace before parsing, or parse the two parts separately.


### `complex(z, 3)` warns on 3.14

**Symptom.** A `DeprecationWarning` from code that composed a complex from a complex.
**Cause.** *"Passing a complex number as the `real` or `imag` argument is now
deprecated; it should only be passed as a single positional argument."*
**Fix.** Write the arithmetic — `z + 3j`, or `z * 1j` — rather than relying on the
constructor's two-complex-argument formula.

### `complex("nan")` succeeds where you wanted a number

**Symptom.** A NaN reaches a computation from a user-supplied string.
**Cause.** The string form accepts the same tokens `float()` does, including
`Infinity` and `NaN` — the docs' own example is `complex('-Infinity+NaNj')`.
**Fix.** Use `complex.from_number()` (3.14) when a string must be rejected outright,
or check `cmath.isfinite()` after parsing.



## Interview questions

**Is `complex` a library type or a language type?**
A language type. `3j` is an imaginary literal in the grammar, `complex` is a built-in
name, and `z.real` / `z.imag` / `z.conjugate()` are on the object itself. Only the
*functions* — `sqrt`, `exp`, `phase`, `polar` — live in a module, `cmath`.

**Why does `sorted()` raise on complex numbers?**
Because there is no ordering. The docs say complex numbers *"do not support ordering
or floor division/modulo operations"*, and `<`, `<=`, `>`, `>=` raise `TypeError`.
There is no total order on the complex plane compatible with arithmetic, so any sort
needs an explicit real-valued key such as `abs` or `cmath.phase`.

**What type is `(1+2j).real`?**
A `float`, always — even when the operands were integers. Both parts of a complex are
floats by definition.

**When you add an `int` to a `complex`, what is the `int` converted to?**
A **float**, not a complex. The docs' ladder: *"if either argument is a complex or a
floating-point number, the other is converted to a floating-point number."* The
arithmetic is then defined by `x + complex(u, v) = complex(x + u, v)`.




**What do `int.from_number`, `float.from_number` and `complex.from_number` add over
the plain constructors, and when were they added?**
All three arrived in 3.14. They accept *only* a numeric argument, where the
constructors also accept strings. That makes them the right tool at a validation
boundary, where `int("12")` succeeding is precisely the behaviour you do not want.


---

← Prev: [Strings and binary formats](12d-strings-and-binary-formats.md) · Index: [Numbers](README.md) · Next → [cmath](13b-cmath.md)
