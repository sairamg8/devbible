---
title: "In NumPy and pandas == returns an array, so if arr == 1 raises rather than answering — and the same rule is what lets any library redefine what a comparison means"
sidebar_label: "10 · `==` is not a boolean"
sidebar_position: 81
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09 against the Python 3.14 language reference
> [Comparisons](https://docs.python.org/3.14/reference/expressions.html#comparisons)
> and the [data model](https://docs.python.org/3.14/reference/datamodel.html#object.__lt__),
> [`unittest.mock.ANY`](https://docs.python.org/3.14/library/unittest.mock.html#any),
> NumPy
> [`numpy/_core/src/multiarray/number.c`](https://github.com/numpy/numpy/blob/main/numpy/_core/src/multiarray/number.c)
> for the exact error text, and the
> [SQLAlchemy 2.0 operator reference](https://docs.sqlalchemy.org/en/20/core/operators.html).
> Version spine: **CPython 3.14**; NumPy 2.x; SQLAlchemy 2.0.

**The language reference says it in one sentence and the whole ecosystem is built on
it: *"Custom rich comparison methods may return non-boolean values. In this case Python
will call `bool()` on such value in boolean contexts."* `==` is a method call whose
result is whatever the method returned. Three enormous libraries exploit that — NumPy
and pandas to return element-wise arrays, SQLAlchemy to build SQL, mocking libraries to
match anything — and each one turns a comparison you thought was a `bool` into
something that either raises at the `if` or, worse, is silently truthy.**

## The rule that permits all of it

> *"Comparisons yield boolean values: `True` or `False`. Custom rich comparison methods
> may return non-boolean values. In this case Python will call `bool()` on such value in
> boolean contexts."* —
> [Comparisons](https://docs.python.org/3.14/reference/expressions.html#comparisons)

Two moments, not one. The comparison produces a value; some *later* boolean context
coerces it. Between the two, the non-boolean travels freely — into a variable, a list,
a function argument, a return value. That gap is why the failure often surfaces
somewhere unrelated to the comparison.

## NumPy and pandas: `==` is element-wise

```python
import numpy as np
arr = np.array([1, 2, 3])

arr == 1              # array([ True, False, False])  — an ndarray, not a bool
if arr == 1:          # ValueError
    ...
```

The message, verbatim from NumPy's source:

```
The truth value of an array with more than one element is ambiguous. Use a.any() or a.all()
```

and for an empty array:

```
The truth value of an empty array is ambiguous. Use `array.size > 0` to check that an array is not empty.
```

The correct forms:

```python
if (arr == 1).any(): ...          # at least one matches
if (arr == 1).all(): ...          # all match
if np.array_equal(arr, other): ...# whole-array equality as a single bool

mask = (arr > 0) & (arr < 10)     # element-wise AND — parentheses REQUIRED
mask = (arr > 0) and (arr < 10)   # 🔴 ValueError: `and` calls bool()
```

The parentheses around each comparison are not style: `&` binds *tighter* than the
comparison operators ([01](01-the-six-operators.md)), so `arr > 0 & arr < 10` parses as
`arr > (0 & arr) < 10` — a chained comparison over a bitwise-and, which is a different
expression entirely and usually also raises.

Three more traps specific to array-likes:

- **`and`, `or`, `not` all call `bool()`** and therefore all raise. Use `&`, `|`, `~`.
- **A chained comparison inserts an implicit `and`**, so `0 <= arr < 10` raises for
  exactly the same reason ([03b](03b-what-else-chains.md)).
- **A single-element array is truthy or falsy without complaint**, so a bug that raises
  on real data passes on a one-row fixture.

pandas layers its own rules on top: `df == other` is element-wise, `df.equals(other)`
is the whole-frame boolean, `pd.isna(x)` is the missing-value test, and `s.between(lo,
hi)` is the range check. And `if df:` raises with pandas' own message about ambiguous
truth values — the standard test for a non-empty frame is `if not df.empty:`.

## Gotchas

**★ `if arr == 1:` raising `ValueError: The truth value of an array with more than one
element is ambiguous. Use a.any() or a.all()`.** `==` returned an array and the `if`
tried to reduce it to one boolean. Fix: `(arr == 1).any()` or `.all()`, or
`np.array_equal` for whole-array equality.

**★ The same code passing on a one-row fixture and failing in production.** A
single-element array *has* an unambiguous truth value, so `if arr == 1:` works until
the array has two elements. Fix: never write `if <array>:`; make the reduction explicit
even when the fixture does not force you to.

**★ `(arr > 0) and (arr < 10)` raising while `&` works.** `and` calls `bool()` on its
left operand; `&` is element-wise. Fix: `&`, `|`, `~` — and keep the parentheses,
because `&` binds tighter than the comparison operators.

**★ `arr > 0 & arr < 10` producing a completely different expression.** Without
parentheses it parses as `arr > (0 & arr) < 10`, a chained comparison over a bitwise
and. Fix: parenthesise each comparison.

**★ `0 <= arr < 10` raising even though neither comparison alone does.** Chaining
inserts an implicit `and`, which calls `bool()`. Fix: `(0 <= arr) & (arr < 10)`. See
[03b](03b-what-else-chains.md).

**★ `if df:` raising on a pandas DataFrame.** Same ambiguity. Fix: `if not df.empty:`,
or `if len(df):` if you prefer.

**★ `x == np.nan` never matching anything.** It is element-wise *and* NaN is not equal
to itself. Fix: `np.isnan(arr)` / `pd.isna(x)`.

**★ `df1 == df2` used as an equality test and returning a frame of booleans.** Fix:
`df1.equals(df2)` for the whole-frame boolean, which also treats NaNs in the same
position as equal — deliberately unlike `==`.

**★ A comparison result stored, passed around, and only exploding three functions
later.** The reference splits the two moments: the comparison produces a value, a later
boolean context coerces it. Fix: coerce at the boundary — `bool(a == b)` — so the
failure names the comparison that caused it.

## Interview questions

**★ Q: Why does `if arr == 1:` raise on a NumPy array?**
Because `==` returns whatever `__eq__` returned, and NumPy's returns an element-wise
boolean array. The `if` then calls `bool()` on it, and NumPy raises `ValueError: The
truth value of an array with more than one element is ambiguous. Use a.any() or
a.all()` — there is no single right answer. The language reference explicitly permits
non-boolean comparison results and specifies that `bool()` is called in boolean
contexts.

**★ Q: Why must you write `(a > 0) & (b < 10)` rather than `and` for arrays?**
`and` is a control-flow operator: it evaluates the truth value of its left operand,
which for a multi-element array raises. `&` is `__and__`, which NumPy overloads to do
element-wise logic and which never calls `bool()`. The parentheses are required because
`&` binds tighter than `>` and `<`.

**★ Q: What does the language reference actually guarantee about the result of `==`?**
Almost nothing. It says comparisons yield `True` or `False`, then immediately says
custom rich comparison methods may return non-boolean values and that Python calls
`bool()` on such a value in boolean contexts. So the guarantee is only that a *boolean
context* will attempt a coercion — and that coercion is where the library gets to
raise.

**Q: How do you compare two NumPy arrays for whole-array equality?**
`np.array_equal(a, b)`, which returns a single `bool` and handles shape mismatch.
`(a == b).all()` also works but is `True` for arrays of different shapes that
broadcast, and raises for shapes that do not.

**Q: Why is the failure often far from the comparison?**
Because the comparison and the coercion are two separate moments. `result = a == b`
succeeds and hands you an array; the `if result:` that raises may be in a different
function, or a `filter()`, or an `assert`. Wrapping the comparison in `bool()` at the
point you make it moves the error to where it belongs.

---

← Prev: [Dataclasses](09b-dataclasses-and-generated-methods.md) · Index: [Comparisons](README.md) · Next → [ORMs, mocks and defensive code](10b-orms-mocks-and-defensive-code.md)
