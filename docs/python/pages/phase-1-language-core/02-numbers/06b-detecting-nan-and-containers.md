---
title: "math.isfinite is the boundary check that rejects all four bad values at once, and inside containers NaN behaves as two different things depending on whether the identity shortcut fires"
sidebar_label: "6b · Detecting NaN, and containers"
sidebar_position: 61
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-31 against the Python 3.14 library reference for
> [`math`](https://docs.python.org/3.14/library/math.html)
> (`isnan`, `isinf`, `isfinite`),
> [Hashing of numeric types](https://docs.python.org/3.14/library/stdtypes.html#hashing-of-numeric-types),
> the language reference
> [Membership test operations](https://docs.python.org/3.14/reference/expressions.html#membership-test-operations)
> and [Value comparisons](https://docs.python.org/3.14/reference/expressions.html#value-comparisons),
> and [What's New in Python 3.10](https://docs.python.org/3.14/whatsnew/3.10.html)
> on NaN hashing.
> Version spine: **Python 3.14.7**; identity-based NaN hashing since **3.10**.

**`math.isfinite()` is one call that rejects NaN, `+inf` and `-inf` together, and
it belongs on the first line of every function that accepts a float from
outside. Inside containers the story is stranger: `x in [x]` is `True` for a NaN
because membership tests identity before equality, while `float('nan') in
[float('nan')]` is `False` — so the same *value* is present or absent depending
on whether it is the same *object*. Since 3.10 NaN hashes by identity, so a set
can hold arbitrarily many NaNs that are all "equal to nothing", and a sort
containing one produces an order that is not merely wrong but not
well-defined.**

## Detecting the special values

```python
import math

math.isnan(x)       # "Return True if x is a NaN (not a number)"
math.isinf(x)       # "True if x is a positive or negative infinity"
math.isfinite(x)    # "True if x is neither an infinity nor a NaN"
                    # -- the docs add: "(Note that 0.0 is considered finite.)"
```

`math.isfinite` is the boundary check. It is a single call that excludes all four
values that break arithmetic and comparison, and it is cheap:

```python
def set_threshold(value: float) -> None:
    if not math.isfinite(value):
        raise ValueError(f"threshold must be a finite number, got {value!r}")
    ...
```

The `x != x` idiom for NaN detection works and turns up in performance-sensitive
code, but `math.isnan(x)` says what it means and the docs explicitly direct you
to it: *"use the `isnan()` function to test for NaNs instead of `is` or `==`"*.
`x != x` also quietly returns `False` for objects whose `__ne__` does something
unrelated, whereas `math.isnan` raises `TypeError` on an argument that cannot be
converted to a float — which is the failure you want at a boundary.

⚠️ `math.isnan` converts its argument via `__float__`, so it does answer
correctly for `Decimal('nan')`. For `Decimal` values prefer the type's own
`is_nan()`, `is_infinite()` and `is_finite()` methods: they understand `sNaN`
and do not route the value through binary floating point on the way to the
answer.

## Membership: `in` tests identity first

The language reference defines membership precisely, and the definition is the
whole gotcha:

> *"For container types such as `list`, `tuple`, `set`, `frozenset`, `dict`, or
> `collections.deque`, the expression `x in y` is equivalent to
> `any(x is e or x == e for e in y)`."*

> *"The built-in containers typically assume identical objects are equal to
> themselves. That lets them bypass equality tests for identical objects to
> improve performance and to maintain their internal invariants."*

So for a NaN:

```python
import math

n = float("nan")
n in [n]                        # True  -- the identity shortcut fires
float("nan") in [float("nan")]  # False -- two objects, equality is False
math.nan in [math.nan]          # True  -- math.nan is one object, so identity
```

This is not a wart, it is a deliberate invariant: a list must be able to find
its own elements, `list.remove()` must work, and `list.index()` must be able to
locate a NaN it contains. The price is that membership for NaN is a question
about object identity dressed up as a question about value.

The same shortcut makes `[float('nan')] == [float('nan')]` `False` while
`xs == xs` is `True` for a list `xs` containing a NaN: list equality compares
element-wise with the same identity-first rule.

## Hashing: NaN as a dict key

Since 3.10, NaN hashes by identity:

> *"Hashes of NaN values of both `float` type and `decimal.Decimal` type now
> depend on object identity. Formerly, they always hashed to `0` even though NaN
> values are not equal to one another. This caused potentially quadratic runtime
> behavior due to excessive hash collisions when creating dictionaries and sets
> containing multiple NaNs."*

Combined with the identity shortcut in `dict` lookup, this gives a coherent but
alarming model: **each distinct NaN object is its own key.**

```python
n1, n2 = float("nan"), float("nan")
d = {n1: "first", n2: "second"}   # two entries -- different objects
d[n1]                             # "first"  -- found via identity
d[float("nan")]                   # KeyError -- a third object, equal to nothing

s = {float("nan") for _ in range(1000)}   # 1000 distinct elements
```

That last line is the one to remember: **deduplicating a column that contains
NaNs with `set()` does not deduplicate the NaNs.** A thousand missing values
become a thousand set members. Before 3.10 they all collided into one hash
bucket instead, which is the quadratic behaviour the change fixed — worse
performance, same wrong answer.

Infinities have none of these problems. The hashing rules state that
*"The particular values `sys.hash_info.inf` and `-sys.hash_info.inf` are used as
hash values for positive infinity or negative infinity (respectively)"*, and
infinities compare equal to themselves, so `math.inf` is a perfectly ordinary
dict key.

## Sorting, `min` and `max`

There is no documented ordering behaviour for sequences containing NaN, and
there cannot be: sorting requires a consistent ordering relation, and the
language reference says *"Any ordered comparison of a number to a not-a-number
value is false"*. A NaN is therefore neither less than, greater than, nor equal
to its neighbours, which is not an order at all.

The consequences are concrete:

- `sorted(xs)` with a NaN in `xs` returns a permutation, not a sorted list. The
  elements around the NaN can end up out of order relative to each other,
  because the algorithm's comparisons against the NaN all answered "no" and it
  drew conclusions from that.
- `max` and `min` are documented to return "the largest/smallest item", which
  they compute by a single pass of pairwise comparisons. Whether a NaN wins
  depends on whether it happened to be the running extreme when a comparison was
  made, which depends on its position in the input. `max([1.0, nan, 2.0])` and
  `max([nan, 1.0, 2.0])` need not agree.
- `statistics.median` sorts first, so it inherits all of the above and returns a
  number with no meaning rather than raising.
- `bisect` on a list containing a NaN is undefined for the same reason: it
  assumes a sorted list and every comparison against the NaN misleads it.

**None of these raise.** The only defence is to not let the NaN into the
sequence:

```python
import math

clean = [x for x in values if math.isfinite(x)]
# or, if NaNs must be kept but ordered last:
ranked = sorted(values, key=lambda x: (math.isnan(x), x))
```

That `key` trick works because the tuple's first element is a `bool`, which
sorts before comparing the second — but note that Python's sort is not
guaranteed to leave the second element uncompared, so it is only safe when the
NaNs form their own group at the end. In practice, filter.

## Gotchas

**★ `set()` does not deduplicate NaNs, and since 3.10 it does not even collide
them.** A thousand `float('nan')` values from a thousand parsed rows are a
thousand distinct set members. Deduplicate on a canonical representation
(`None`, a sentinel string, or a filtered-out row), never on the float.

**★ `x in [x]` being `True` while `float('nan') in [float('nan')]` is `False` is
not a bug.** Membership is defined as `any(x is e or x == e for e in y)`. The
container is allowed to short-circuit on identity, and the docs say it does so
*"to maintain their internal invariants"*. Write membership tests for floats
against a value you can compare, or use `math.isnan` in a comprehension.

**★ A NaN in an aggregate destroys the aggregate with no error.** `sum`,
`statistics.mean` and `max` over a list containing one NaN produce a NaN or a
meaningless number. Filter with `math.isfinite` when *building* the list, not
when reading the result — by then the offending row is unidentifiable.

**★ `list.count(float('nan'))` returns 0 for a list full of NaNs.** Same rule:
`count` uses the identity-or-equality test, and a freshly constructed NaN is
neither identical nor equal to any of them. Count with
`sum(1 for x in xs if math.isnan(x))`.

**★ `list.remove()` and `.index()` *do* find a NaN you already hold a reference
to.** This is the mirror image of the previous gotcha and is just as
surprising: whether the operation works depends on whether you kept the original
object. Code that round-trips values through JSON in between will lose the
identity and start failing.

**★ `sorted()` on data containing NaN does not raise, does not warn, and does
not sort.** It returns a permutation that looks plausible. Any pipeline that
sorts user-supplied floats needs an `isfinite` filter upstream, or it will
produce a silently mis-ranked leaderboard.

**★ `math.isnan` and friends raise `TypeError` on `None`.** A column that uses
`None` for "missing" and `float('nan')` for "computed but undefined" needs both
checks in order: `if value is None or not math.isfinite(value)`. Mixing the two
representations of missing in one field is the real bug; the `TypeError` is
merely where you discover it.

**★ `functools.lru_cache` keyed on a float argument caches NaNs by identity.**
The cache key is a tuple of the arguments and lookup uses hashing plus the same
identity-first equality, so every distinct NaN object is a cache miss that
allocates a new entry. A function called in a loop with a fresh NaN each time
has an unbounded-growth cache with a nominal `maxsize`. Reject non-finite
arguments before the cached call.

**★ Pandas and NumPy do not follow these rules, and mixing them with plain
Python does.** `numpy.nan` is a Python float and behaves exactly as described
here; pandas' `.isna()`, `.drop_duplicates()` and `groupby` implement their own
NaN semantics that treat NaNs as equal to each other. Code that moves values
between a DataFrame and a plain dict changes NaN semantics at the boundary
without any conversion being visible.

## Interview questions

**★ Why is `float('nan') in [float('nan')]` `False` but `n in [n]` `True`?**
Because membership is defined as `any(x is e or x == e for e in y)` — identity
first, equality second. Two separately constructed NaNs are different objects
that compare unequal, so both halves fail. The same object passes the identity
half. The docs justify the shortcut as letting containers *"bypass equality
tests for identical objects to improve performance and to maintain their
internal invariants"* — a list must be able to find its own elements.

**★ What happens if I put NaNs in a set?**
Since 3.10 each distinct NaN object hashes differently (by identity) and none
compare equal, so each is a separate element. A set built from a thousand parsed
NaNs has a thousand members. Before 3.10 they all hashed to `0`, so they still
did not deduplicate but they did collide, giving *"potentially quadratic runtime
behavior"* — the reason for the change.

**★ Why did NaN hashing change in 3.10?**
Not for correctness — NaNs never deduplicated either way — but for performance.
Hashing every NaN to `0` piled them into one bucket, so building a dict or set
containing many NaNs degraded to quadratic time. Identity-based hashing spreads
them out.

**★ What does `sorted()` do with a NaN in the list?**
Something unspecified. Sorting needs a consistent ordering and NaN provides
none: every ordered comparison against it is false, so it is neither greater nor
less than anything. The result is a permutation of the input that is not
ordered, produced without any error or warning. Filter with `math.isfinite`
first.

**★ How do you deduplicate a list of floats that may contain NaN?**
Not with `set()`. Either filter the non-finite values out first, or map them to
a canonical sentinel — `None`, or a string — before deduplicating, and map back
afterwards if the distinction between "missing" and "present" matters.

**★ `math.isnan` versus `x != x` versus `x is math.nan` — which and why?**
`math.isnan`. It states intent, it handles anything with `__float__`, and it
raises `TypeError` on garbage instead of quietly answering. `x != x` is correct
but obscure and can be defeated by an unusual `__ne__`. `x is math.nan` is
simply wrong: NaN-ness is a property of the value, and the docs say to use
`isnan()` *"instead of `is` or `==`"*.

**★ Is `float('inf')` the same object as `math.inf`?**
The values are equal and `math.inf` is documented as *"Equivalent to the output
of `float('inf')`"*, but object identity is neither guaranteed nor relevant.
Compare with `==` or `math.isinf`, never with `is` — the same discipline the
docs prescribe for NaN, for the same reason.

**★ You inherit a service where one metric occasionally reports NaN. How do you
find the source?**
Not from where it was observed: NaN propagates through every arithmetic
operation, so the observation point tells you nothing. Instrument the
*boundaries* — assert `math.isfinite` on every deserialised payload, every value
entering an aggregation, and every division result. The first assertion that
fires is the source, and leaving those assertions in place is also the permanent
fix.

---

← Prev: [NaN, infinity and signed zero](06-nan-inf-and-signed-zero.md) · Index: [Numbers](README.md) · Next → [Signed zero and serialisation](06c-signed-zero-and-serialisation.md)

{/* FOOTER */}
