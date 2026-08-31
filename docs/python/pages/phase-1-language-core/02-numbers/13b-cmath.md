---
title: "cmath is a separate module on purpose, and it always returns a complex number even when the answer is real"
sidebar_label: "13b · cmath"
sidebar_position: 131
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-31 against the Python 3.14 library reference
> ([`cmath`](https://docs.python.org/3.14/library/cmath.html),
> [`math`](https://docs.python.org/3.14/library/math.html)).
> Version spine: **Python 3.14.7**.

**`cmath` exists so that `math` does not have to return complex numbers, and the
module says so itself: *"some users aren't interested in complex numbers, and perhaps
don't even know what they are. They would rather have `math.sqrt(-1)` raise an
exception than return a complex number."* The rule that follows is the one that
catches people — *"the functions defined in `cmath` always return a complex number,
even if the answer can be expressed as a real number"* — so `cmath.sqrt(4)` is
`(2+0j)`, and that `+0j` survives into JSON, a database column and every comparison
downstream. Two smaller surprises live here too: `isfinite` requires **both** parts
finite while `isinf` needs only **one** infinite, so they are not each other's
negations; and branch cuts are resolved by the *sign of zero*, which makes this one
of the very few places in Python where `-0.0` changes a returned value rather than
only its display.**

## `cmath` versus `math`

The `cmath` docs explain the split in the module's own words:

> *"The reason for having two modules is that some users aren't interested in complex
> numbers, and perhaps don't even know what they are. They would rather have
> `math.sqrt(-1)` raise an exception than return a complex number."*

and the rule that follows from it:

> *"the functions defined in `cmath` always return a complex number, even if the
> answer can be expressed as a real number (in which case the complex number has an
> imaginary part of zero)."*

So `cmath.sqrt(4)` is `(2+0j)`, not `2.0`. That matters when the result flows into
JSON, a database column, or a comparison — a `+0j` is not silently dropped.

`cmath` functions accept ints and floats as well as complex numbers, and *"any Python
object that has either a `__complex__()` or a `__float__()` method."*

**Polar conversions**, quoted so the argument order is never guessed:

- `phase(z)` — *"Return the phase of z (also known as the argument of z), as a
  float. `phase(z)` is equivalent to `math.atan2(z.imag, z.real)`. The result lies
  in the range [-π, π]"*.
- `polar(z)` — *"Returns a pair `(r, phi)` where r is the modulus of z and phi is the
  phase of z. `polar(z)` is equivalent to `(abs(z), phase(z))`."*
- `rect(r, phi)` — *"Return the complex number z with polar coordinates r and phi.
  Equivalent to `complex(r * math.cos(phi), r * math.sin(phi))`."*

Note that `polar` returns `(modulus, phase)` and `rect` takes `(modulus, phase)` —
the same order, which is the one thing worth remembering about them.

**Classification** differs from `math`'s in a way that catches people:

- `cmath.isfinite(z)` — *"True if **both** the real and imaginary parts of z are
  finite"*.
- `cmath.isinf(z)` — *"True if **either** the real or the imaginary part of z is an
  infinity"*.
- `cmath.isnan(z)` — *"True if **either** the real or the imaginary part of z is a
  NaN"*.

So the predicates are not each other's negations in the way they are for floats: a
value can be non-finite without `isinf` being the reason.

`cmath.isclose` has the same signature and the same documented formula as
`math.isclose` — *"`abs(a-b) <= max(rel_tol * max(abs(a), abs(b)), abs_tol)`"* — and
the same trap: with the default `abs_tol=0.0` it can never report a value as close to
zero.

**Branch cuts** are handled by signed zero: *"for a branch cut along (a portion of)
the real axis we look at the sign of the imaginary part, while for a branch cut along
the imaginary axis we look at the sign of the real part."* This is one of the very
few places in Python where the difference between `0.0` and `-0.0` changes a result
rather than merely a display.

## Gotchas

### `cmath.sqrt(4)` is not `2.0`

**Symptom.** A `+0j` appears in output, or a `== 2.0` comparison behaves oddly in a
serialised payload.
**Cause.** *"the functions defined in `cmath` always return a complex number, even if
the answer can be expressed as a real number."*
**Fix.** Use `math` when the input is known to be real and the result must be real.
Take `.real` explicitly when you have deliberately moved through the complex plane.

### `cmath.isinf` and `cmath.isfinite` are not opposites

**Symptom.** A value is neither `isfinite` nor `isinf`.
**Cause.** `isfinite` requires **both** parts finite; `isinf` requires **either** part
infinite. A `complex(1.0, nan)` is neither.
**Fix.** Test `isfinite` and treat everything else as "not usable", rather than
enumerating `isinf` and `isnan`.

### `cmath.isclose(z, 0)` is always `False`

**Symptom.** A convergence check never fires at zero.
**Cause.** The default `abs_tol=0.0`, and the documented formula
`abs(a-b) <= max(rel_tol * max(abs(a), abs(b)), abs_tol)` is `0` when both are near
zero.
**Fix.** Pass an explicit `abs_tol` whenever zero is a possible target.

## Interview questions

**Why does `cmath.sqrt(4)` return `(2+0j)`?**
Because *"the functions defined in `cmath` always return a complex number, even if
the answer can be expressed as a real number."* The two modules exist so that
`math.sqrt(-1)` can raise for people who never want a complex number back.

**What is the difference between `math.isclose` and `cmath.isclose`?**
The signature and the formula are the same; `cmath`'s accepts complex arguments and
compares by modulus of the difference. Both have `abs_tol=0.0` by default, so both
fail to call anything close to zero unless you pass an explicit `abs_tol`.

**Why does `cmath` care about signed zero?**
Branch cuts. The docs: *"for a branch cut along (a portion of) the real axis we look
at the sign of the imaginary part, while for a branch cut along the imaginary axis we
look at the sign of the real part."* It is one of the few places where `-0.0` versus
`0.0` changes a returned value rather than only its display.

---

← Prev: [complex](13-complex-and-the-numeric-tower.md) · Index: [Numbers](README.md) · Next → [The numeric tower](13c-the-numeric-tower.md)
