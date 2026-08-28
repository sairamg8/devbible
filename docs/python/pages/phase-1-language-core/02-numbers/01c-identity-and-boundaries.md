---
title: "Why is looks like it works on small integers, and why unbounded integers still overflow the moment they leave Python"
sidebar_label: "1c · Identity and boundaries"
sidebar_position: 3
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-28 against the Python 3.14 language reference on
> [objects, values and types](https://docs.python.org/3.14/reference/datamodel.html#objects-values-and-types),
> the library reference on
> [hashing of numeric types](https://docs.python.org/3.14/library/stdtypes.html#hashing-of-numeric-types)
> and [`sys.hash_info`](https://docs.python.org/3.14/library/sys.html#sys.hash_info),
> [`struct`](https://docs.python.org/3.14/library/struct.html),
> [ECMA-262 §21.1.2.6](https://262.ecma-international.org/15.0/index.html#sec-number.max_safe_integer),
> and CPython
> [`Include/internal/pycore_runtime_structs.h`](https://github.com/python/cpython/blob/3.14/Include/internal/pycore_runtime_structs.h).
> Version spine: **Python 3.14.7**.

**Two things follow from `int` being an unbounded immutable object rather than
a machine word, and both of them bite in production. First, CPython is free to
reuse integer objects, and it does — for a small, version-specific window of
values — which makes `is` appear to work on `1` and fail on `907234`. Second,
the absence of overflow is a property of Python's memory, not of the world:
every JSON payload, database column, `struct.pack` and C extension argument
reintroduces a width, and the most damaging of those failures — a 64-bit ID
read by JavaScript — is completely silent on the Python side.**

## `is` on integers is a trap, not a feature

The language reference is deliberate about this:

> *"For example, after `a = 1; b = 1`, `a` and `b` may or may not refer to the
> same object with the value one, depending on the implementation. This is
> because `int` is an immutable type, so the reference to `1` can be reused.
> This behaviour depends on the implementation used, so should not be relied
> upon, but is something to be aware of when making use of object identity
> tests."*

CPython 3.14 preallocates a fixed block of small integers. The constants live
in `Include/internal/pycore_runtime_structs.h`:

```c
#define _PY_NSMALLPOSINTS           257
#define _PY_NSMALLNEGINTS           5
```

So the integers `-5` through `256` are shared singletons and everything outside
that window is not. Constant folding compounds the illusion: two equal literals
in the *same code object* can share one object well outside that range, so
`x is 1000` may behave differently at module level and inside a function, and
differently again after the compiler changes in a future release.

Since Python 3.8 the interpreter warns you:

```python
if status is 200:      # SyntaxWarning: "is" with a literal. Did you mean "=="?
    ...
```

Treat that warning as an error. **Compare numbers with `==`.** Reserve `is` for
`None`, `True`, `False` and sentinel objects — things whose identity *is* their
meaning.

## Numeric hashing: equal across types, not unique

Python guarantees the property every hash table needs, and nothing beyond it:

> *"For numbers `x` and `y`, possibly of different types, it's a requirement
> that `hash(x) == hash(y)` whenever `x == y`. […] For ease of implementation
> and efficiency across a variety of numeric types (including `int`, `float`,
> `decimal.Decimal` and `fractions.Fraction`) Python's hash for numeric types is
> based on a single mathematical function that's defined for any rational
> number […] Essentially, this function is given by reduction modulo `P` for a
> fixed prime `P`."*

`P` is `sys.hash_info.modulus`, documented as *"the prime modulus `P` used for
numeric hash scheme"*, and CPython uses `P = 2**61 - 1` on 64-bit builds.

Two things fall out. The useful one: `1`, `1.0`, `Decimal("1")` and
`Fraction(1)` are the *same dictionary key*, because they compare equal and
therefore must hash equal. The dangerous one: a reduction modulo a prime is
massively many-to-one over unbounded integers, so `hash(n)` is not an
identifier and never was.

## Where overflow comes back: every boundary out of Python

Python's integers are unbounded; the systems you talk to are not. Overflow does
not disappear — it relocates to the edges, where it is harder to test.

| Boundary | The limit that reappears | Failure mode |
|---|---|---|
| JSON read by JavaScript | `Number.MAX_SAFE_INTEGER` = `2**53 - 1` | **Silent.** The corruption happens in the browser's parser, so no Python test sees it |
| PostgreSQL `integer` / `bigint` | 32-bit / 64-bit signed | Loud, but only at write time — the bad value may have travelled a long way first |
| `struct.pack` | The format character's width | Loud — `struct.error` |
| `array.array`, NumPy fixed dtypes | The element width | NumPy **wraps** on overflow in fixed-width integer dtypes |
| C extension arguments | Whatever C type the parameter parses into | Loud — `OverflowError` |
| `float(n)` | About `1.8e308` for range; 53 bits for precision | `OverflowError` above the range, **silent** rounding below it |
| `hash(n)` | Reduction modulo `2**61 - 1` | Silent collisions if you misuse it as an identity |

The one that matters most, because it is silent and crosses a team boundary:

> *"Due to rounding behaviour necessitated by precision limitations of IEEE
> 754-2019, the Number value for every integer greater than
> `Number.MAX_SAFE_INTEGER` is shared with at least one other integer. Such
> large-magnitude integers are therefore not safe, and are not guaranteed to be
> exactly representable as Number values or even to be distinguishable from
> each other."*

So: **serialise 64-bit identifiers as JSON strings.**

```python
def to_json(row):
    return {"id": str(row.id), "name": row.name}      # safe in a browser


def to_json_broken(row):
    return {"id": row.id, "name": row.name}           # rounded above 2**53
```

Twitter shipped an `id_str` field alongside `id` for exactly this reason.
Snowflake IDs, Discord IDs and most 64-bit sequence keys are in the danger zone
the moment they exceed 9007199254740991 — which a millisecond-based ID
generator does immediately.

## Bounding a value on purpose

When you *do* need a width, say so, and let it raise:

```python
import struct

def as_int32(n: int) -> bytes:
    return struct.pack(">i", n)      # struct.error if n does not fit


def check_bigint(n: int) -> int:
    if not -(2**63) <= n < 2**63:
        raise ValueError(f"{n} does not fit in a BIGINT column")
    return n
```

That check is meaningful because it names a *receiving system's* width. A check
against `2**31 - 1` written "because integers overflow" is not.

## Gotchas

### `is` comparison that passes in tests and fails in production
**Symptom.** `if user_id is expected_id:` works for fixture IDs like `1` and
`42` and fails for real IDs like `907234`.
**Cause.** CPython caches `-5` through `256`; larger integers are freshly
allocated objects each time.
**Fix.** `if user_id == expected_id:`. There is no case where `is` is the
correct operator for numeric equality. Enable `SyntaxWarning` as an error in CI
so the literal form cannot merge.

### 64-bit IDs in a JSON API
**Symptom.** A record fetches fine with `curl` and 404s from the browser, with
the last digit or two of the ID different.
**Cause.** `JSON.parse` produces a `Number`, an IEEE-754 double. Integers above
`2**53 - 1` round to the nearest representable value. Nothing on the Python
side is wrong, so nothing on the Python side fails.
**Fix.** Send the ID as a string, or have the client parse with a `BigInt`-aware
reviver. If you own the schema, prefer string or UUID identifiers at the API
boundary regardless of the column type.

### `hash(n)` used as a stable identifier
**Symptom.** Two different large integers collide in a "dedupe by hash" set, or
a stored hash stops matching after an upgrade.
**Cause.** Numeric hashing is reduction modulo `sys.hash_info.modulus`, chosen
for dict distribution across `int`/`float`/`Decimal`/`Fraction`, not for
uniqueness or cross-version stability.
**Fix.** A real digest over an exact byte representation:

```python
import hashlib

def stable_id(n: int) -> str:
    width = (n.bit_length() + 8) // 8 or 1
    return hashlib.sha256(n.to_bytes(width, "big", signed=True)).hexdigest()
```

### A dict that "loses" a key when a float arrives
**Symptom.** `counts[1] = 5` then `counts[1.0] += 1` leaves one entry, not two;
or a `Decimal("1")` key overwrites an `int` key loaded from JSON.
**Cause.** This is the hash requirement working as designed — `1 == 1.0 ==
Decimal("1")`, so all three must hash equally and are one key.
**Fix.** If the types must be distinguished, key on `(type(x).__name__, x)`, or
normalise every key to one type at the boundary. Do not try to defeat the hash.

### NumPy silently wrapping where Python would not
**Symptom.** A sum over an `int64` array is negative; the pure-Python version of
the same loop is correct.
**Cause.** NumPy's fixed-width integer dtypes wrap on overflow — they are C
types, not Python `int`s. The conversion happened at `np.array(...)`.
**Fix.** Use `dtype=object` to keep Python semantics (slow but exact), or
accumulate in a wider dtype, or check the bound before the array is built.

### A guard against overflow that cannot happen
**Symptom.** `if abs(n) > 2**31 - 1: raise ValueError("too large")` rejects
valid data.
**Cause.** A width imported from the C or Java version of the algorithm, with no
receiving system behind it.
**Fix.** Delete it, or replace it with a check named after the real
destination — `check_bigint` above.

## Interview questions

**Why does `a is b` sometimes work for equal integers?**
CPython preallocates `-5` through `256` (`_PY_NSMALLPOSINTS 257`,
`_PY_NSMALLNEGINTS 5`) and reuses those objects, so identity coincides with
equality inside that window; constant folding can extend the coincidence to
literals within a single code object. The language reference explicitly says the
behaviour "should not be relied upon". Use `==`, and treat the `SyntaxWarning`
as an error.

**You are returning a 64-bit database ID in a JSON API consumed by a React
front end. What do you do and why?**
Serialise it as a string. JSON numbers are parsed into JavaScript `Number`,
which is an IEEE-754 double; ECMA-262 says integers above `2**53 - 1` are "not
guaranteed … even to be distinguishable from each other". The rounding happens
inside the browser's parser, so it is invisible to every server-side test.

**Is `hash(x) == hash(y)` a safe way to test that two numbers are equal?**
No, in both directions. Equal numbers of different types *do* hash equally —
that is a documented requirement, and is why `1`, `1.0`, `Decimal("1")` and
`Fraction(1)` are one dict key — but unequal numbers can also collide, because
the numeric hash is a reduction modulo a Mersenne prime. Hash equality is a
necessary condition, never a sufficient one.

**If Python integers never overflow, why did our nightly export corrupt IDs?**
Because the integers stopped being Python integers. Somewhere on the path —
JSON to a browser, a fixed-width NumPy dtype, a `struct.pack`, a 32-bit column —
a width was reimposed. Only some of those raise; JSON-to-JavaScript and NumPy
dtype wraparound are silent. The audit question is not "can Python overflow"
but "where does this integer stop being one".

**Why do `1` and `1.0` collide as dictionary keys, and is that a bug?**
Not a bug: it is required. Python guarantees `hash(x) == hash(y)` whenever
`x == y`, and `1 == 1.0` is true, so they must hash equally and are therefore
the same key. The same holds for `Decimal("1")` and `Fraction(1)`. If you need
to distinguish them, put the type into the key yourself.

**Where would you put a range check on an integer, and where would you not?**
At the boundary where the value leaves Python and enters something with a
width — a database column, a wire format, a C API — named after that
destination. Not in the middle of a pure-Python computation, where no width
exists and the check can only reject good data.

---

← Prev: [Bitwise on an infinite width](01b-bitwise-operations.md) · Index: [Numbers](README.md) · Next → [The integer string conversion limit](02-the-int-str-conversion-limit.md)
