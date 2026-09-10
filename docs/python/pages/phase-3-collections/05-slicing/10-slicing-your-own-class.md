---
title: "Your class gets slicing through the same __getitem__ as indexing — the key arrives as a slice object that validates nothing, so the method has to tell a slice from an integer, raise TypeError for the wrong kind of key and IndexError for the wrong value, and is simplest when it lets a list or a range interpret the slice"
sidebar_label: "10 · Slicing your own class"
sidebar_position: 19
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-10 for **Python 3.14.7** against the 3.14 documentation —
> [Emulating container types](https://docs.python.org/3.14/reference/datamodel.html#emulating-container-types)
> (`__getitem__`, `__index__`), [Slicings](https://docs.python.org/3.14/reference/expressions.html#slicings),
> [What's New in Python 3.0](https://docs.python.org/3.14/whatsnew/3.0.html),
> [`operator.index`](https://docs.python.org/3.14/library/operator.html#operator.index),
> [`collections.abc.Sequence`](https://docs.python.org/3.14/library/collections.abc.html#collections.abc.Sequence),
> [`collections.UserList`](https://docs.python.org/3.14/library/collections.html#collections.UserList);
> CPython 3.14 [`Lib/_collections_abc.py`](https://github.com/python/cpython/blob/3.14/Lib/_collections_abc.py)
> and [`Lib/collections/__init__.py`](https://github.com/python/cpython/blob/3.14/Lib/collections/__init__.py)
> for the mixin and `UserList` source. Documentation-verified — **no sandbox run, no program output**.

**There is no separate slicing hook. Since Python 3.0 `obj[1:3]` calls the same `__getitem__` as
`obj[1]`, passing a `slice` object instead of an integer — and the `slice` object is a dumb
container: `obj[::'spam']` arrives as `slice(None, None, 'spam')` without complaint. So a class
that wants to be sliced owns four decisions the built-ins make for you. It must branch on the key's
kind: a `slice`, something integer-like, or neither. It must convert integers with
`operator.index` — not `int()`, which truncates `2.9` and parses `"3"`. It must raise `TypeError`
for the wrong kind of key and `IndexError` for an out-of-range integer, because `for` loops and the
`Sequence` mixins stop *only* on `IndexError`. And it must choose what a slice returns — the same
type, a plain list, or a lazy view. The cleanest answer to most of these is to delegate: keep your
positions in a `list` or a `range` and let *it* interpret the slice.**

Integer keys and return types are [10b](10b-integer-keys-and-return-types.md); writing and deleting
through a slice and the ABCs are [10c](10c-setitem-delitem-and-the-abcs.md); type hints and tuple
keys are [10d](10d-typing-and-multidimensional-keys.md).

## What arrives in `__getitem__`

> *"Slicing is handled by `__getitem__`, `__setitem__`, and `__delitem__`. A call like
> `a[1:2] = b` is translated to `a[slice(1, 2, None)] = b` and so forth. Missing slice items are
> always filled in with `None`."* —
> [Emulating container types](https://docs.python.org/3.14/reference/datamodel.html#emulating-container-types)

> *"`__getslice__`, `__setslice__` and `__delslice__` were killed.  The syntax `a[i:j]` now
> translates to `a.__getitem__(slice(i, j))` (or `__setitem__` or `__delitem__`, when used as an
> assignment or deletion target, respectively)."* —
> [What's New in Python 3.0](https://docs.python.org/3.14/whatsnew/3.0.html)

The [Slicings](https://docs.python.org/3.14/reference/expressions.html#slicings) reference shows
the keys with a class whose `__getitem__` prints what it receives; per its own examples:

| Expression | Key passed to `__getitem__` |
|---|---|
| `demo[1]` | `1` |
| `demo[2:3]` | `slice(2, 3, None)` |
| `demo[::'spam']` | `slice(None, None, 'spam')` |
| `demo[1, 2, 3]` | `(1, 2, 3)` |
| `demo[1:2, 3]` | `(slice(1, 2, None), 3)` |

The `'spam'` row is the one to remember: building a slice validates nothing. The bounds are
checked only when something interprets them — `slice.indices()`, or a built-in sequence you hand the
slice to. The tuple rows are *"commonly used with numerical libraries for slicing multi-dimensional
data"*; a one-dimensional class should reject them.

## The contract: `TypeError` for the kind, `IndexError` for the value

> *"If *subscript* is of an inappropriate type, `__getitem__` should raise `TypeError`. If
> *subscript* has an inappropriate value, `__getitem__` should raise an `LookupError` or one of its
> subclasses (`IndexError` for sequences; `KeyError` for mappings)."*
> *"The sequence iteration protocol (used, for example, in `for` loops), expects that an
> `IndexError` will be raised for illegal indexes to allow proper detection of the end of a
> sequence."*

The second sentence is not a style note. `collections.abc.Sequence` supplies `__iter__` as a loop
of `self[i]` for `i = 0, 1, 2, …` that ends only when `IndexError` escapes (`Lib/_collections_abc.py`),
and `__contains__`, `index` and `count` are built on it. A `__getitem__` that clamps an
out-of-range integer, wraps it modulo the length, or raises `ValueError` instead turns every one of
those into an infinite loop or a crash.

## Delegate: let a `list` or a `range` interpret the slice

When the elements live in a list, hand the key to the list. The list applies the clamping,
negatives and step rules, raises the right errors for bad keys, and you only decide the return
type. This is exactly `collections.UserList.__getitem__` in the 3.14 source:

```python
    def __getitem__(self, i):
        if isinstance(i, slice):
            return self.__class__(self.data[i])
        else:
            return self.data[i]
```

When the elements are *computed* — or stored somewhere a list cannot reach — keep the valid
positions as a `range` and slice that. A `range` slice is another `range`, computed in O(1)
([06](06-slices-that-do-not-copy.md)) with the built-in rules, so the class becomes a lazy view
whose slices are also lazy views. This closes the two gaps left open by the `Squares` class of
[04b](04b-slice-indices.md) — it accepted a float index and returned a plain list:

```python
from collections.abc import Sequence


class Squares(Sequence):
    """The squares of the integers in a range, computed on access; slices stay lazy."""

    def __init__(self, bases: range) -> None:
        self._bases = bases

    def __len__(self) -> int:
        return len(self._bases)

    def __getitem__(self, key):
        if isinstance(key, slice):
            return Squares(self._bases[key])      # O(1), clamped exactly like a list slice
        base = self._bases[key]                   # TypeError for 2.5 or "3"; IndexError past the end
        return base * base

    def __repr__(self) -> str:
        return f"Squares({self._bases!r})"


squares = Squares(range(6))
assert squares[2] == 4
assert squares[-1] == 25
assert isinstance(squares[1:4], Squares)
assert list(squares[1:4]) == [1, 4, 9]
assert list(squares[::-2]) == [25, 9, 1]
assert list(squares[-2:100]) == [16, 25]
assert list(squares) == [0, 1, 4, 9, 16, 25]      # the mixin __iter__ stops on IndexError
assert 16 in squares and squares.index(9) == 3    # mixins built on __getitem__
```

`range` already refuses a float (`range indices must be integers or slices, not float`), raises
`IndexError` past the end, and rejects a tuple key — so delegating to it gets the contract right
without a line of validation. When you need the concrete positions instead, to fetch many elements
in one request, `range(*key.indices(len(self)))` produces them with the same semantics
([04b](04b-slice-indices.md)).

## Gotchas

**★ Symptom: `for record in store:` never ends, or `x in store` hangs.** Cause: the class has
`__getitem__` but no `__iter__`, so iteration falls back to `store[0]`, `store[1]`, … — and the
integer branch never raises `IndexError` (it clamps, wraps, or returns `None` past the end). Fix:
raise `IndexError` for out-of-range integers, or define `__iter__` too.

```python
if not 0 <= index < len(self):
    raise IndexError("store index out of range")
```

**★ Symptom: `TypeError: unsupported operand type(s) for +: 'NoneType' and 'int'` from
`store[:10]`.** Cause: `__getitem__` reads `key.start + self._offset`, but an omitted bound is
`None`. Fix: normalise the slice first.

```python
start, stop, step = key.indices(len(self))
```

**Symptom: `store[1:3]` raises `TypeError: '<' not supported between instances of 'slice' and
'int'`.** Cause: `__getitem__` was written for integers only and compares the key against 0. Fix:
branch on `isinstance(key, slice)` first.

```python
if isinstance(key, slice):
    return [self._fetch(i) for i in range(*key.indices(len(self)))]
```

**Symptom: `grid[1, 2]` returns something strange instead of failing.** Cause: the key is the tuple
`(1, 2)`, and the integer branch passed it along to storage that happened to accept it. Fix: reject
tuples explicitly in a one-dimensional class — `operator.index` does it for you.

```python
index = operator.index(key)        # TypeError: 'tuple' object cannot be interpreted as an integer
```

## Interview questions

**★ How does Python pass a slice to a user-defined class?**
Through `__getitem__`, the same method used for indexing. The interpreter builds a `slice` object
from the three expressions between the colons — `None` for any that is missing — and passes it as
the key; `a[1:2] = b` and `del a[1:2]` go to `__setitem__` and `__delitem__` the same way. The
separate `__getslice__` family was removed in Python 3.0. A comma inside the brackets passes a
tuple instead, which may contain slices.

**★ Why must a custom sequence's `__getitem__` raise `IndexError` for an out-of-range integer?**
Because the old-style iteration protocol, and the `Sequence` ABC's mixin `__iter__`, call
`self[0]`, `self[1]`, … until `IndexError` escapes — the documentation states that `for` loops rely
on it to detect the end. Membership, `index` and `count` are built on that iteration. A
`__getitem__` that returns a default, clamps, or raises some other exception makes them loop forever
or fail. `TypeError` is reserved for a key of the wrong kind.

**What is the simplest correct way to implement slicing on a computed sequence?**
Keep the valid positions as a `range` and delegate: `self._positions[key]` for a slice returns a
new `range` with the built-in clamping, negative and step rules, in O(1), and wraps into a new
instance of your class; for an integer it returns the position or raises `IndexError`/`TypeError`
exactly as the built-ins do. When the concrete positions are needed at once,
`range(*key.indices(len(self)))` enumerates them with the same rules.

---

← Prev: [09c · Deletion cost and types](09c-deletion-cost-and-types.md) · [Topic index](README.md) · Next →: [10b · Integer keys and return types](10b-integer-keys-and-return-types.md)
