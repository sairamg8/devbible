---
title: "A set keeps one element per equality class, and Python's numeric equality crosses types — `1`, `1.0`, `True` and `Decimal('1')` are one element and `True in {1}` is `True` — while NaN is equal to nothing, so a set holds every NaN object separately and finds one only by identity"
sidebar_label: "7 · Equal but distinct elements"
sidebar_position: 19
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-10 on **Python 3.14.7** against the library reference —
> [hashing of numeric types](https://docs.python.org/3.14/library/stdtypes.html#hashing-of-numeric-types),
> [numeric types](https://docs.python.org/3.14/library/stdtypes.html#typesnumeric),
> [boolean type](https://docs.python.org/3.14/library/stdtypes.html#boolean-type-bool) — the language
> reference — [value comparisons](https://docs.python.org/3.14/reference/expressions.html#value-comparisons),
> [membership tests](https://docs.python.org/3.14/reference/expressions.html#membership-test-operations)
> — the [data model](https://docs.python.org/3.14/reference/datamodel.html#set-types) and the
> [3.10 What's New](https://docs.python.org/3.14/whatsnew/3.10.html) (NaN hashing); CPython v3.14.7
> `Objects/setobject.c` for which element survives, marked *implementation detail*.
> Documentation-verified — **no sandbox run, no program output**.

**A set's notion of "the same element" is exactly `hash()` plus `==`. For most types that matches
yours. For numbers it is wider: equality compares mathematical values across `int`, `float`, `bool`,
`Decimal` and `Fraction`, and the hashes are required to agree, so values you would call different
collapse into one element. For NaN it is narrower: NaN is not equal to itself, so no two NaN objects
are ever the same element, and a NaN is found only when the very same object is looked up. Both
directions produce membership tests that answer the wrong question without raising anything.**

## The rule that makes numbers collapse

> *"For set elements, the same immutability rules apply as for dictionary keys. Note that numeric
> types obey the normal rules for numeric comparison: if two numbers compare equal (e.g., `1` and
> `1.0`), only one of them can be contained in a set."* —
> [data model](https://docs.python.org/3.14/reference/datamodel.html#set-types)

"The normal rules for numeric comparison" are exact-value rules:

> *"A comparison between numbers of different types behaves as though the exact values of those
> numbers were being compared."* — [numeric types](https://docs.python.org/3.14/library/stdtypes.html#typesnumeric)

And the hash is made to agree with them, across types:

> *"For numbers `x` and `y`, possibly of different types, it's a requirement that `hash(x) == hash(y)`
> whenever `x == y`"* · *"Python's hash for numeric types is based on a single mathematical function
> that's defined for any rational number, and hence applies to all instances of `int` and
> `fractions.Fraction`, and all finite instances of `float` and `decimal.Decimal`."* —
> [hashing of numeric types](https://docs.python.org/3.14/library/stdtypes.html#hashing-of-numeric-types)

`bool` joins in because it is an integer:

> *"`bool` is a subclass of `int`. … In many numeric contexts, `False` and `True` behave like the
> integers 0 and 1, respectively."* — [boolean type](https://docs.python.org/3.14/library/stdtypes.html#boolean-type-bool)

So, with equal hashes and `==` true, the table treats each of these groups as one element:

| Group | One element because |
|---|---|
| `1`, `1.0`, `True`, `Decimal("1")`, `Fraction(1, 1)` | all equal to the integer 1 |
| `0`, `0.0`, `-0.0`, `False`, `Decimal("0")` | all equal to zero — the float's sign does not count |
| `2.5`, `Fraction(5, 2)`, `Decimal("2.5")` | `2.5` is exactly representable as a float |

And these, which look the same, are **different** elements, because the comparison is exact:

| Not equal | Why |
|---|---|
| `0.1` and `Decimal("0.1")` | the float `0.1` is the nearest binary fraction, not exactly one tenth |
| `0.1` and `Fraction(1, 10)` | same reason |
| `1` and `"1"` | no cross-type equality between numbers and strings |

### Which one survives

The docs say *"only one of them can be contained"* and stop there. In 3.14.7 an insertion that finds
an equal element already present keeps the stored object and drops the new one (implementation
detail — `found_active` in `Objects/setobject.c`), so the **first** arrival wins: `{1, True}`
contains the int `1`, `{True, 1}` contains `True`, and `{1.0} | {1}` keeps `1.0` because the result
starts as a copy of the left operand. The element you get back out has the type of whichever value
got there first — which is why a set built from JSON can render `1.0` where the source said `1`.

### Membership asks the same question

`in` is the same lookup, so `1.0 in {1}` is `True`, and so is `True in {1, 2, 3}`. That one ships as
a bug: a value that should have been an ID arrives as a boolean — a JSON `true`, a checkbox, a
defaulted flag — and passes a membership check against a set of integer IDs as if it were ID 1.
When the type is part of the contract, check the type before the value:

```python
ALLOWED_ACCOUNT_IDS: frozenset[int] = frozenset({1, 2, 3})

def may_access(account_id: object) -> bool:
    return type(account_id) is int and account_id in ALLOWED_ACCOUNT_IDS   # rejects True, 1.0, Decimal(1)
```

`type(x) is int`, not `isinstance(x, int)`: `isinstance(True, int)` is `True`, because `bool` is a
subclass of `int`.

## NaN: equal to nothing, found by identity

> *"The not-a-number values `float('NaN')` and `decimal.Decimal('NaN')` are special. Any ordered
> comparison of a number to a not-a-number value is false. A counter-intuitive implication is that
> not-a-number values are not equal to themselves."* —
> [value comparisons](https://docs.python.org/3.14/reference/expressions.html#value-comparisons)

A set would therefore never find a NaN at all — except that membership checks identity first:

> *"For container types such as list, tuple, set, frozenset, dict, or collections.deque, the
> expression `x in y` is equivalent to `any(x is e or x == e for e in y)`."* —
> [membership tests](https://docs.python.org/3.14/reference/expressions.html#membership-test-operations)

> *"The built-in containers typically assume identical objects are equal to themselves. That lets
> them bypass equality tests for identical objects to improve performance and to maintain their
> internal invariants."* — [value comparisons](https://docs.python.org/3.14/reference/expressions.html#value-comparisons)

So the rule for NaN in a set is **the same object is found, a different NaN never is**:

```python
def nan_membership() -> tuple[bool, bool, int]:
    x = float("nan")
    same_object = x in {x}                                     # True: identity short-circuits ==
    other_object = float("nan") in {x}                         # False: a different NaN is never equal
    distinct = len({float("nan"), float("nan"), float("nan")}) # 3: three objects, three elements
    return same_object, other_object, distinct
```

`math.nan` is a single module-level object, so tests written with it pass —
`math.nan in {math.nan}` is `True` — while production data, where every parsed NaN is a new float
object, never matches.

Since 3.10 the hash agrees with this: each NaN object hashes by identity.

> *"Hashes of NaN values of both `float` type and `decimal.Decimal` type now depend on object
> identity. Formerly, they always hashed to `0` even though NaN values are not equal to one another.
> This caused potentially quadratic runtime behavior due to excessive hash collisions when creating
> dictionaries and sets containing multiple NaNs."* —
> [What's New in 3.10](https://docs.python.org/3.14/whatsnew/3.10.html)

The fix removed the quadratic build ([1c](01c-what-constant-time-does-not-promise.md)); it did not,
and could not, make NaNs deduplicate. A column with a NaN in every other row gives a set with one
NaN per row. If "missing" is what NaN means in your data, say so with a value that has ordinary
equality before the set sees it:

```python
import math
from collections.abc import Iterable


def distinct_readings(readings: Iterable[float]) -> set[float | None]:
    return {None if math.isnan(r) else r for r in readings}    # every NaN becomes the one None
```

Set *comparison* inherits the identity shortcut. The reference says *"Comparison of sets enforces
reflexivity of its elements"* — `{x} == {x}` is `True` for a NaN `x` because both sets hold the same
object, while two sets each built from a freshly parsed NaN are not equal.

## Gotchas

**★ Symptom: a request with `"account_id": true` is authorised as account 1.** Cause: `True == 1` and
`hash(True) == hash(1)`, so `True in {1, 2, 3}` is `True`. Fix: check the exact type before the
value — `may_access` above.

**★ Symptom: a report of distinct values in a mixed column shows one value where the data has `1`,
`1.0` and `true`.** Cause: those compare equal across types, and a set keeps one element per
equality class. Fix: make the type part of the key when it is part of the meaning.

```python
def distinct_typed(values: list[object]) -> int:
    return len({(type(v), v) for v in values})
```

**★ Symptom: a dedupe step keeps thousands of NaN rows, and `float("nan") in seen` is always
`False`.** Cause: NaN is not equal to itself, and since 3.10 each NaN object hashes by identity, so
every NaN is its own element. Fix: map NaN to a sentinel with ordinary equality —
`distinct_readings` above.

**★ Symptom: a price whitelist rejects every price loaded from the database.** Cause: the whitelist
was written with floats (`{0.1, 0.25}`), the database driver returns `Decimal`, and `Decimal("0.1")`
is not equal to the float `0.1` — comparison is exact. Fix: build the set from the same type the data
has, constructing `Decimal` from strings, never from floats.

```python
from decimal import Decimal

ALLOWED_PRICES = frozenset(Decimal(p) for p in ("0.10", "0.25", "1.00"))
```

**Symptom: a test using `math.nan` passes; the same check fails on real data.** Cause: `math.nan` is
one object, and membership checks identity first; parsed data produces a new NaN object each time.
Fix: never test membership of NaN — test `math.isnan` explicitly.

```python
import math

def has_missing(values: set[float]) -> bool:
    return any(math.isnan(v) for v in values)
```

**Symptom: a set of sensor readings has lost the sign of a negative zero.** Cause: `-0.0 == 0.0`, so
only one of them can be in the set, and the first to arrive wins. Fix: if the sign carries meaning,
key on it explicitly.

```python
import math

def signed_key(v: float) -> tuple[float, float]:
    return (v, math.copysign(1.0, v))
```

**Symptom: an API that returns the union of two ID sets renders `1.0` where the stored ID was `1`.**
Cause: `{1.0} | {1}` keeps the left operand's `1.0` — the first arrival survives. Fix: normalise
types at the boundary, before building the set: `{int(x) for x in raw_ids}`.

## Interview questions

**★ How many elements does `{1, 1.0, True}` have, and which one is kept?**
One. Numeric comparison works on exact values across types, `bool` is a subclass of `int`, and the
numeric hash is required to agree whenever values are equal — so the three are a single equality
class. The docs say only one of them *"can be contained in a set"*; in CPython the first one inserted
is kept, here the int `1`. Written as `{True, 1, 1.0}` the set would hold `True`.

**★ Why is `float("nan") in {float("nan")}` `False`, while `x in {x}` is `True` for `x = float("nan")`?**
NaN is not equal to anything, itself included. Membership in a built-in container is defined as
`any(x is e or x == e for e in y)` — identity is checked before equality — so the same NaN object is
found and a different NaN object is not. Since 3.10 the hash also depends on identity, so a
different NaN usually is not even in the same slot.

**Why did Python 3.10 change the hash of NaN?**
Every NaN used to hash to `0`, and no two NaNs compare equal, so a set or dict with many NaNs put
them all in one collision chain and building it took quadratic time. Hashing by identity spreads
distinct NaN objects across the table. It does not make them deduplicate — they are still unequal —
it only makes holding many of them cheap.

**Is `Decimal("0.1") in {0.1}`? Is `Decimal("1") in {1}`?**
No, and yes. Comparisons between numeric types compare exact values: the float `0.1` is a binary
approximation that is not exactly one tenth, so it is not equal to `Decimal("0.1")`; `Decimal("1")`
and `1` are the same exact value, equal, and — by the numeric hashing rule — hash the same, so the
lookup finds it.

**Why must equal numbers of different types have the same hash?**
Because a set or dict finds an element by hash first and compares with `==` only inside the slots
that hash leads to. If `1` and `1.0` were equal but hashed differently, `1.0 in {1}` would look in
the wrong place and report `False` while `1.0 == 1` is `True`. The documentation states the
requirement directly: `hash(x) == hash(y)` whenever `x == y`, *"possibly of different types"*.

---

← Prev: [Iteration order](06-iteration-order.md) · [Topic index](README.md) · Next → [Custom classes as elements](08-custom-classes-as-elements.md)
