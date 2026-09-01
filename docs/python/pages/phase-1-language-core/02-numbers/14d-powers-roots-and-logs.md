---
title: "math.pow always returns a float and raises where ** returns a complex number, three-argument pow() has no math equivalent at all, and math.isqrt is the only exact square root in the standard library"
sidebar_label: "14d · Powers and roots"
sidebar_position: 143
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-01 against the Python 3.14
> [`math`](https://docs.python.org/3.14/library/math.html) reference (`pow`,
> `sqrt`, `isqrt`, `cbrt`, and the CPython implementation-detail note),
> [Built-in Functions](https://docs.python.org/3.14/library/functions.html)
> (`pow`), the
> [data model](https://docs.python.org/3.14/reference/datamodel.html#emulating-numeric-types)
> on `__pow__`, and [`cmath`](https://docs.python.org/3.14/library/cmath.html).
> Version spine: **Python 3.14.7**; `math.cbrt` added in **3.11**;
> `math.pow(0.0, -inf)` changed in **3.11**; `math.isqrt` added in **3.8**.

**There are three ways to raise a number to a power in Python and they are not
variants of one function. `math.pow` is the IEEE 754 float operation: it
converts both arguments, always returns a float, and raises `ValueError` on a
negative base with a non-integral exponent. `**` dispatches through `__pow__`,
keeps `int` exact at any size, and is documented to deliver a *complex* result
for the case `math.pow` rejects. And `pow(base, exp, mod)` — the three-argument
built-in — computes modular exponentiation and modular inverses, with no
equivalent anywhere in `math`. Square roots split the same way, with a fourth
option, `math.isqrt`, that is the only exact one.
[14e](14e-logarithms-and-exponentials.md) is the logarithm and exponential
family, where for once the `math` function beats the operator.**

## `math.pow` versus `**` versus `pow()`

The `math` entry, in full:

> *"Return x raised to the power y. Exceptional cases follow the IEEE 754
> standard as far as possible. In particular, `pow(1.0, x)` and `pow(x, 0.0)`
> always return `1.0`, even when x is a zero or a NaN. If both x and y are
> finite, x is negative, and y is not an integer then `pow(x, y)` is undefined,
> and raises `ValueError`."*

> *"Unlike the built-in `**` operator, `math.pow()` converts both its arguments
> to type `float`. Use `**` or the built-in `pow()` function for computing exact
> integer powers."*

The docs make the recommendation themselves. The built-in adds the type rules:

> *"For `int` operands, the result has the same type as the operands (after
> coercion) unless the second argument is negative; in that case, all arguments
> are converted to float and a float result is delivered. For example,
> `pow(10, 2)` returns `100`, but `pow(10, -2)` returns `0.01`. For a negative
> base of type `int` or `float` and a non-integral exponent, a complex result is
> delivered. For example, `pow(-9, 0.5)` returns a value close to `3j`. Whereas,
> for a negative base of type `int` or `float` with an integral exponent, a
> float result is delivered. For example, `pow(-9, 2.0)` returns `81.0`."*

So the same expression has three outcomes depending on which name you type:

| Expression | Result |
|---|---|
| `2 ** 1000` | an exact 302-digit `int` |
| `math.pow(2, 1000)` | a float |
| `2 ** 10000` | an exact `int` |
| `math.pow(2, 10000)` | `OverflowError` — outside the float range |
| `(-9) ** 0.5` | a `complex` close to `3j` |
| `math.pow(-9, 0.5)` | `ValueError` |
| `(-9) ** 2.0` | `81.0`, a float |
| `pow(10, -2)` | `0.01`, a float |
| `pow(38, -1, 97)` | `23`, an `int` — a modular inverse |

`**` also honours `__pow__`, including the ternary form: the data model says
`__pow__` is *"called to implement the power operator `**` or the three-argument
form of the built-in `pow()` function: `pow(self, other, modulo)`"*. A domain
type can define what raising it to a power means. `math.pow` cannot see any of
that — it converts and calls C.

### The special cases `math.pow` has that `**` does not

`math.pow` follows IEEE 754 deliberately, which is why it has answers where you
might expect errors: *"`pow(1.0, x)` and `pow(x, 0.0)` always return `1.0`, even
when x is a zero or a NaN."* So `math.pow(float('nan'), 0.0)` is `1.0`, not NaN
— the module's own implementation note calls this out as one of the exceptions
to "NaN in, NaN out".

One case changed recently:

> *"Changed in version 3.11: The special cases `pow(0.0, -inf)` and
> `pow(-0.0, -inf)` were changed to return `inf` instead of raising
> `ValueError`, for consistency with IEEE 754."*

That is the shape of `math.pow`: it is the function to reach for when you are
implementing something *to a standard*, and the wrong one to reach for when you
just want an exponent in application code.

### Three-argument `pow()` has no `math` equivalent

```python
pow(base, exp, mod)        # modular exponentiation, computed efficiently
pow(38, -1, mod=97)        # 23 - the modular inverse of 38 mod 97
```

The docs describe both:

> *"if mod is present, return base to the power exp, modulo mod (computed more
> efficiently than `pow(base, exp) % mod`)"*

> *"If mod is present and exp is negative, base must be relatively prime to mod.
> In that case, `pow(inv_base, -exp, mod)` is returned, where inv_base is an
> inverse to base modulo mod."*

The efficiency clause is not cosmetic: `pow(base, exp) % mod` computes the full
`base ** exp` first, which for cryptographic sizes is an integer with millions
of digits. The three-argument form reduces modulo `mod` at each step. Anyone
who writes `(base ** exp) % mod` in a key-exchange or hashing routine has
written something that will not finish.

## Square roots: four options

```python
math.sqrt(x)      # float. ValueError for negative x.
x ** 0.5          # float for non-negative; complex for negative x
cmath.sqrt(x)     # always complex, including cmath.sqrt(-9) -> 3j
math.isqrt(n)     # exact int floor of the square root, for a non-negative int
```

`math.isqrt` is the one that does not narrow:

> *"Return the integer square root of the nonnegative integer n. This is the
> floor of the exact square root of n, or equivalently the greatest integer a
> such that a² ≤ n."*

and the docs give the ceiling recipe, which is worth stealing rather than
deriving:

> *"For some applications, it may be more convenient to have the least integer a
> such that n ≤ a², or in other words the ceiling of the exact square root. For
> positive n, this can be computed using `a = 1 + isqrt(n - 1)`."*

Use `isqrt` for anything integer-flavoured — primality trials, grid dimensions,
divisor loops — because `int(math.sqrt(n))` is wrong for large `n` in two
directions at once: the float conversion loses bits, *and* the subsequent
truncation can land one below the true floor when the float rounds down.

On accuracy for the float versions: IEEE 754 requires the square-root operation
to be correctly rounded, and `math.sqrt` is the thin wrapper over it. The Python
documentation makes **no** statement about whether `x ** 0.5` is bit-identical
to `math.sqrt(x)`, and I could not settle it from the docs — so if the last bit
matters, use `math.sqrt` because it is the operation the standard constrains.

`math.cbrt(x)` (3.11) is the cube-root equivalent, and it is the answer to a
real annoyance: `(-8) ** (1/3)` gives a complex number, because `1/3` is not an
integral exponent and the built-in `pow` rules apply. The `math.cbrt` entry says
only *"Return the cube root of x"* and does not spell out the negative case, so
while C99's `cbrt` is defined for negative arguments and `math` is documented as
a thin wrapper over the C library, treat the negative-input behaviour as worth
confirming rather than assumed.

## Gotchas

**★ `math.pow(2, 10000)` raises `OverflowError` while `2 ** 10000` is an exact
integer.** The conversion to float is what fails, not the exponentiation. Any
"make it more mathematical" refactor from `**` to `math.pow` introduces an
overflow ceiling at roughly 1.8e308 that the original never had.

**★ `math.pow` returns `8.0` where `2 ** 3` returns `8`, and float results
propagate.** A float used as a list index, a `range` bound, a `bytes` length or
a dict key is a `TypeError` or a distinct key. The `math.pow` docs say it
plainly: *"Use `**` or the built-in `pow()` function for computing exact integer
powers."*

**★ `(-9) ** 0.5` is a complex number, not an error.** The built-in `pow` docs
document it: *"For a negative base of type `int` or `float` and a non-integral
exponent, a complex result is delivered."* So a formula that should have
rejected negative input instead returns a `complex`, and the failure surfaces
several functions later as a `TypeError` on a comparison, because complex
numbers are unordered. If negative input is a bug, use `math.sqrt` or
`math.pow`, which raise.

**★ `(base ** exp) % mod` is not a slow version of `pow(base, exp, mod)`, it is
a non-terminating one.** The two-argument form materialises the full integer
before the modulo. At cryptographic sizes that is an allocation of hundreds of
thousands of digits. The docs describe the three-argument form as *"computed
more efficiently"*, which considerably understates it.

**★ `int(math.sqrt(n))` is wrong for large `n`, in two ways at once.** The float
conversion loses bits above 2\*\*53, and truncating a float square root that
rounded *down* lands one below the true integer square root. `math.isqrt(n)` is
exact by construction. This shows up as an off-by-one in primality trials and
divisor loops, on inputs large enough that nobody wrote a test for them.

**★ `math.pow(float('nan'), 0.0)` is `1.0`.** The IEEE special cases mean a NaN
does not always propagate — the module's implementation note lists this exact
call as an exception to "NaN in, NaN out". A pipeline that relies on "a NaN
anywhere poisons the result, so I will detect it at the end" has a hole here.
Detect at the boundary with `math.isfinite`
([06b](06b-detecting-nan-and-containers.md)).

**★ `math.pow(0.0, -inf)` returns `inf` as of 3.11, where earlier versions
raised `ValueError`.** If you are reading code that catches `ValueError` around
a `math.pow`, that handler may now be dead. The change was made *"for
consistency with IEEE 754"*, so the new behaviour is the standard-conforming
one and the old code was working around a deviation.

**★ `cmath.sqrt` always returns a `complex`, even for a positive input.**
`cmath.sqrt(4)` is a complex number, not `2.0`, so switching a function from
`math` to `cmath` to handle one negative case changes the return type of *every*
call — see [13b](13b-cmath.md). If you want "complex only when necessary", that
is `x ** 0.5`, which the docs say delivers a complex result only for a negative
base.

**★ `2 ** -1` is `0.5`, not `0`.** The built-in `pow` docs spell out that for
`int` operands *"unless the second argument is negative; in that case, all
arguments are converted to float and a float result is delivered"*. A
bit-manipulation expression with an accidental negative shift amount silently
becomes float arithmetic instead of raising.

**★ `math.cbrt` is the only clean cube root, and its negative case is not
documented.** `(-8) ** (1/3)` gives a complex number because `1/3` is not an
integral exponent, and `-(8 ** (1/3))` is the usual hand-rolled workaround.
`math.cbrt` exists from 3.11 for exactly this, but its entry says only *"Return
the cube root of x"* — verify the negative case on your platform rather than
assuming it, since `math` defers exceptional cases to the C library.

## Interview questions

**★ Give three ways to compute a power in Python and say when each is right.**
`**` (equivalently two-argument `pow`) for application code: it dispatches
through `__pow__`, keeps `int` exact at any size, and delivers a complex result
for a negative base with a non-integral exponent. `math.pow` when you need the
IEEE 754 float operation with its documented special cases — `pow(1.0, x)` and
`pow(x, 0.0)` always `1.0`, `pow(0.0, -inf)` giving `inf` since 3.11 — accepting
that it converts to float and can overflow. And three-argument `pow(b, e, m)`
for modular exponentiation and modular inverses, which has no `math` equivalent
at all and is the only usable way to do it at scale.

**★ Why is `int(math.sqrt(n))` wrong and `math.isqrt(n)` right?**
`math.sqrt` converts to float, which is lossy above 2\*\*53 and raises above the
float range; the truncation then compounds it, because a float square root that
rounded down truncates to one below the true floor. `math.isqrt` is documented
as *"the floor of the exact square root of n"* and works entirely in integer
arithmetic, so it is correct at any magnitude. If you want the ceiling, the docs
hand you the recipe: `1 + isqrt(n - 1)` for positive `n`.

**★ `math.sqrt(-1)` raises but `(-1) ** 0.5` does not. Which do you want?**
It depends on whether a negative input is a bug or a case. If it is a bug, you
want the exception, because a complex number propagates silently until something
tries to order it and raises a `TypeError` a long way from the cause. If
negatives are legitimate, use `cmath.sqrt`, which always returns a complex and
therefore gives you one predictable return type instead of a type that depends
on the sign of the input.

**★ What is wrong with `(base ** exp) % mod`?**
It computes `base ** exp` in full first. For a 2048-bit modulus that is an
integer with hundreds of thousands of digits, allocated and multiplied out
before a single reduction happens. `pow(base, exp, mod)` is documented as
*"computed more efficiently than `pow(base, exp) % mod`"* because it reduces at
every step. In cryptographic code the two-argument version is not slow, it is
unusable — and it also stresses the integer-to-string conversion limit if
anything ever tries to print the intermediate
([02](02-the-int-str-conversion-limit.md)).

**★ Why does `math.pow` exist if the docs themselves tell you to use `**`?**
Because it is a different function, not an inferior one. `math.pow` is the IEEE
754 float power operation with the standard's special cases: *"`pow(1.0, x)` and
`pow(x, 0.0)` always return `1.0`, even when x is a zero or a NaN"*, and since
3.11 `pow(0.0, -inf)` is `inf`. That is what you want when implementing a
numerical algorithm to a specification. The docs' recommendation is specifically
about *"computing exact integer powers"*, which is a different job.

**★ How would you compute a modular inverse in pure Python?**
`pow(base, -1, mod)`, which has been available since 3.8 — the docs give the
example `pow(38, -1, mod=97)` returning `23` and note that `base` must be
relatively prime to `mod`. Before 3.8 this needed a hand-written extended
Euclidean algorithm; now it is one call, and it is the only place in the numeric
built-ins where a negative exponent does something other than produce a float.

---

← Prev: [trunc, int() and remainders](14c-trunc-int-and-the-remainder-family.md) · Index: [Numbers](README.md) · Next → [Logarithms and exponentials](14e-logarithms-and-exponentials.md)

{/* FOOTER */}
