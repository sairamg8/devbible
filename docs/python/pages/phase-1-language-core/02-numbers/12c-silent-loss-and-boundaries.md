---
title: "Precision leaves at boundaries you did not write — a JSON parser choosing float, a NUMERIC column rounding, and a type annotation that says float and accepts int"
sidebar_label: "12c · Silent loss and boundaries"
sidebar_position: 122
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-01 against the Python 3.14 library reference for
> [`json`](https://docs.python.org/3.14/library/json.html),
> [`sqlite3`](https://docs.python.org/3.14/library/sqlite3.html),
> [`decimal`](https://docs.python.org/3.14/library/decimal.html),
> [`round()`](https://docs.python.org/3.14/library/functions.html#round) and
> [Numeric Types](https://docs.python.org/3.14/library/stdtypes.html#numeric-types-int-float-complex),
> plus the [PostgreSQL 18 manual on numeric types](https://www.postgresql.org/docs/current/datatype-numeric.html)
> and the [typing specification](https://typing.python.org/en/latest/spec/special-types.html#special-cases-for-float-and-complex).
> Version spine: **Python 3.14.7**; `sqlite3`'s default adapters deprecated since
> **3.12**.

**The conversions you write are the ones you can reason about. The ones that cost you
are the conversions somebody else's code performs on your behalf: a JSON parser that
turns every number into a float, a database driver that maps a `NUMERIC` column to
whichever Python type it prefers, a `round()` that is applied twice, and a type
checker that accepts an `int` where the annotation said `float` and then lets it
widen. None of these raise. All of them are decidable in advance, and each has a
documented switch.**

## round() loses precision twice over

Two documented notes matter here, and they compound.

> *"if two multiples are equally close, rounding is done toward the even choice (so,
> for example, both `round(0.5)` and `round(-0.5)` are `0`, and `round(1.5)` is `2`)"*

> *"The behavior of `round()` for floats can be surprising: for example,
> `round(2.675, 2)` gives `2.67` instead of the expected `2.68`. This is not a bug:
> it's a result of the fact that most decimal fractions can't be represented exactly
> as a float."*

The second is a *conversion* problem wearing a rounding costume. `2.675` was already
slightly below 2.675 before `round` saw it, so rounding to the nearest hundredth
correctly gives `2.67`. The precision was lost at the literal, not at the call.

Then there is the return type, which changes what a later conversion does:

> *"The return value is an integer if `ndigits` is omitted or `None`. Otherwise, the
> return value has the same type as `number`."*

So `round(x)` is an `int` and `round(x, 0)` is a `float` — and a float that then goes
through `int()` truncates rather than rounds. Applying `round` twice is its own defect
class, covered in
[Double rounding and policy](09c-double-rounding-and-policy.md).

## JSON: the parser picks the type, unless you tell it not to

`json` maps every JSON number with a fractional part or exponent to a `float`. For a
money field arriving as `1234.56` that is a lossy decision made before your code sees
the value. The hook exists precisely to override it:

```python
import json
from decimal import Decimal

json.loads('{"amount": 1.1}', parse_float=Decimal)   # {'amount': Decimal('1.1')}
```

`parse_float=Decimal` receives the **original text** of the number, so the `Decimal` is
built from the string and is exactly right — this is not `Decimal(float)`. There is a
matching `parse_int` for the integer case.

Writing is the asymmetric half: `json.dumps` has no `Decimal` support and raises
`TypeError`, so you supply the encoding decision yourself.

```python
json.dumps({"amount": Decimal("1.1")}, default=str)   # '{"amount": "1.1"}'
```

Emitting it as a **string** is the choice that survives contact with other languages,
because a JSON number is read as a double by most JSON parsers — including
JavaScript's, where every number is a double. Emitting `1.1` unquoted hands the
receiver the same precision loss you just avoided. The same reasoning applies to large
integers, which is why 64-bit IDs travel as strings — see
[Identity and boundaries](01c-identity-and-boundaries.md).

## SQL: the column type is a rounding policy

**SQLite** *"natively supports the following types: NULL, INTEGER, REAL, TEXT, BLOB"*.
There is no decimal storage class at all, so a `Decimal` must be adapted — and the
default adapters are **deprecated since 3.12**, so relying on implicit behaviour is
relying on something scheduled for removal.

```python
import sqlite3
from decimal import Decimal

sqlite3.register_adapter(Decimal, str)                      # store as TEXT
sqlite3.register_converter("DECIMAL", lambda b: Decimal(b.decode()))
```

Storing as `TEXT` keeps the value exact and gives up SQL-side arithmetic; storing
minor units as `INTEGER` keeps both and gives up the decimal point. Storing as `REAL`
gives up the exactness — it is a float, and it is the option that looks easiest.

**PostgreSQL** has a real decimal type: `numeric` is *"especially recommended for
storing monetary amounts and other quantities where exactness is required"*. Its two
overflow behaviours are asymmetric and worth knowing before a migration: exceeding the
declared **scale** rounds silently, while exceeding the declared **precision** raises.
So `NUMERIC(10,2)` will quietly turn your third decimal place into a rounded second
one, forever, without an error.

There is a comparison trap across that boundary too: PostgreSQL *"treats `NaN` values
as equal, and greater than all non-`NaN` values"*, which is the opposite of IEEE and
of Python. A query and an in-process filter can therefore disagree about the same
rows.

## Typing: `float` in an annotation means "int, float"

The typing specification defines a shortcut: a parameter annotated `float` also
accepts `int`, and one annotated `complex` accepts `int` and `float`. There is no
implicit conversion at runtime — the object stays an `int` — but a checker will not
flag the call.

```python
def rate(x: float) -> float:
    return x / 3

rate(10**30 + 1)      # a type checker is happy; the division rounds
```

The annotation therefore does not protect against the `int → float` precision loss
from [Conversions and precision loss](12-conversions-and-precision-loss.md). Where the
bound genuinely matters, state it in the body rather than in the annotation, or
annotate the narrower type you actually mean. The numeric tower and how to annotate
against it is covered in [The numeric tower](13c-the-numeric-tower.md).

## The checklist for a boundary

At every point where a number crosses into or out of your process, four questions:

1. **Who chooses the type?** A parser, a driver, or you. If it is not you, find the
   hook — `parse_float`, `register_adapter`, a driver's type map — and make it you.
2. **Is the wire form exact?** A decimal string is; a JSON number is not, because the
   receiver will read it as a double.
3. **Does the store round?** `NUMERIC(p,s)` rounds at the scale and raises at the
   precision. SQLite `REAL` rounds at everything.
4. **Does anything compare across the boundary?** NaN ordering, `-0.0` collapsing and
   the `2**53` bound all differ between Python and the store — see
   **Signed zero and serialisation** *(06c-signed-zero-and-serialisation.md)*.

## Gotchas

### `json.loads` turns money into a float before you see it
**Symptom.** A payment amount is off by a fraction of a cent and the bug predates
every line of your own arithmetic.
**Cause.** The default `parse_float` is `float`.
**Fix.** Override it; the hook receives the original text, so the `Decimal` is exact.
```python
json.loads(body, parse_float=Decimal)
```

### `json.dumps` on a `Decimal` raises
**Symptom.** `TypeError: Object of type Decimal is not JSON serializable`.
**Cause.** There is no built-in encoding for it — deliberately, because the right
choice is application-specific.
**Fix.** Choose explicitly, and prefer a string on the wire.
```python
json.dumps(payload, default=str)
```

### Emitting a decimal as an unquoted JSON number
**Symptom.** The value is exact in your process and wrong in the browser.
**Cause.** A JSON number is a double for most receivers, JavaScript included.
**Fix.** Emit a string and parse it on the other side with a decimal library.

### Relying on `sqlite3`'s default adapters
**Symptom.** A `DeprecationWarning`, and code scheduled to break.
**Cause.** The default adapters have been deprecated since 3.12.
**Fix.** Register your own, and decide TEXT-versus-INTEGER-minor-units deliberately.

### `NUMERIC(10,2)` silently rounding a third decimal place
**Symptom.** Values written with three decimals read back with two, no error anywhere.
**Cause.** PostgreSQL rounds on scale overflow and only raises on precision overflow.
**Fix.** Declare the scale you actually need, and `quantize` in Python first so the
rounding happens where you can see it — see **quantize and fixed-point discipline**
*(10c-quantize-and-fixed-point-discipline.md)*.

### A `float` annotation letting a huge `int` through
**Symptom.** A checker passes; a 19-digit value loses its last digits inside the
function.
**Cause.** The typing spec makes `int` acceptable wherever `float` is annotated, with
no runtime conversion and no checker complaint.
**Fix.** Assert the bound in the body, where it can actually fail.
```python
if abs(x) > 2**53:
    raise ValueError("value cannot survive float arithmetic")
```

### NaN sorting differently in the database
**Symptom.** A query and an in-process filter return different rows for the same
predicate.
**Cause.** PostgreSQL treats `NaN` as equal to itself and greater than everything;
Python and IEEE make every NaN comparison `False`.
**Fix.** Exclude non-finite values explicitly on both sides rather than relying on
either ordering.

## Interview questions

**How do you stop `json` turning a money field into a float?**
Pass `parse_float=Decimal` to `json.loads`. The hook receives the number's original
text, so the `Decimal` is built from a string and is exact — unlike
`Decimal(float(...))`.

**Why does `json.dumps` refuse a `Decimal`?**
There is no built-in encoding, because the choice is application-specific. Supply
`default=`, and prefer emitting a string: a JSON number is read as a double by most
parsers, including JavaScript's.

**Why is `round(2.675, 2)` equal to `2.67`?**
Because the float `2.675` is already slightly less than 2.675 — the loss happened at
the literal, not in `round`. The docs call this out and say it is not a bug.

**What type does `round()` return?**
An `int` when `ndigits` is omitted or `None`, and otherwise the same type as the
argument. So `round(x)` is an `int` and `round(x, 0)` is a `float`.

**How do you store a `Decimal` in SQLite?**
Register an adapter — as TEXT for exactness, or store integer minor units. There is no
decimal storage class, and the default adapters have been deprecated since 3.12.

**What happens when a value exceeds a PostgreSQL `NUMERIC(10,2)`?**
Exceeding the scale rounds silently; exceeding the precision raises. The asymmetry is
the trap — the silent one is the one that reaches production.

**Does annotating a parameter `float` prevent an `int` being passed?**
No. The typing spec makes `int` acceptable wherever `float` is annotated (and both
wherever `complex` is), with no runtime conversion. A huge `int` therefore passes the
checker and loses precision inside the function.

**Where do Python and PostgreSQL disagree about NaN?**
Ordering and equality. PostgreSQL treats `NaN` as equal to itself and greater than all
non-NaN values; Python follows IEEE, where every comparison with NaN is `False`. A
query and an in-process filter can select different rows because of it.

**Name three conversions that lose precision without raising.**
`float(2**53 + 1)`; `json.loads` parsing `1.1` to a float; a `NUMERIC(p,s)` column
rounding at its scale. Range errors raise, precision errors do not.

**What are the four questions to ask at a numeric boundary?**
Who chooses the type, is the wire form exact, does the store round, and does anything
compare across the boundary. Each has a documented hook or a documented behaviour, so
each is decidable before it costs anything.

---

← Prev: [Exact and lossy conversions](12b-exact-and-lossy-conversions.md) · Index: [Numbers](README.md) · Next → [Strings and binary formats](12d-strings-and-binary-formats.md)
