---
title: "The integer branch of a custom __getitem__ must convert with operator.index — int() truncates floats and parses strings — and the slice branch must choose its return type on purpose, because list, tuple and str subclasses return their base type and UserList rebuilds your class only if its constructor takes one argument"
sidebar_label: "10b · Integer keys and return types"
sidebar_position: 20
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-10 for **Python 3.14.7** against the 3.14 documentation —
> [`object.__index__`](https://docs.python.org/3.14/reference/datamodel.html#object.__index__),
> [`operator.index`](https://docs.python.org/3.14/library/operator.html#operator.index),
> [Sequences](https://docs.python.org/3.14/reference/datamodel.html#datamodel-sequences),
> [`collections.UserList`](https://docs.python.org/3.14/library/collections.html#collections.UserList);
> CPython 3.14 [`Lib/collections/__init__.py`](https://github.com/python/cpython/blob/3.14/Lib/collections/__init__.py)
> (`UserList.__getitem__`). Documentation-verified — **no sandbox run, no program output**.

**[10](10-slicing-your-own-class.md) delegated both branches of `__getitem__` to a `list` or a
`range`. When the integer branch cannot delegate — the index feeds arithmetic, a byte offset, a
query — it has to do what the built-ins do: convert with `operator.index`, which accepts exactly
the integer-like objects and rejects the rest with `TypeError`. `int()` is the tempting wrong
answer; it converts, so `records[2.9]` silently becomes record 2. The slice branch has a design
decision instead of a validation one: what type comes back. The built-ins answer "the same type",
but a subclass of `list`, `tuple` or `str` gets its *base* type back from every slice unless it
overrides `__getitem__`, and `UserList` rebuilds your class only through a one-argument
constructor.**

## Integers: `operator.index`, never `int()`

When the integer branch cannot delegate — the index goes into arithmetic, an offset, a query —
convert it the way the interpreter does:

> *"Called to implement `operator.index`, and whenever Python needs to losslessly convert the
> numeric object to an integer object (such as in slicing, or in the built-in `bin`, `hex` and
> `oct` functions). Presence of this method indicates that the numeric object is an integer
> type.  Must return an integer."* — [`object.__index__`](https://docs.python.org/3.14/reference/datamodel.html#object.__index__)

`operator.index(a)` — *"Return *a* converted to an integer.  Equivalent to `a.__index__()`."* —
accepts `int`, `bool` and any integer-like type that defines `__index__`, and raises `TypeError`
for everything else. The alternatives each fail differently:

- `int(key)` is a *conversion*, not a check: `int(2.9)` is `2` and `int("3")` is `3`, so
  `records[2.9]` quietly returns record 2.
- `isinstance(key, int)` rejects integer types that implement `__index__` without subclassing
  `int` — the very types `__index__` exists for.
- `key < 0` on a key that was never checked does raise `TypeError` for `None`, a `str` or a
  slice — but from the comparison, with a message about `<` that says nothing about indexing.

```python
import operator


class Ledger:
    """Records stored as fixed 64-byte rows in a bytes blob."""

    ROW = 64

    def __init__(self, blob: bytes) -> None:
        self._blob = blob

    def __len__(self) -> int:
        return len(self._blob) // self.ROW

    def __getitem__(self, key):
        if isinstance(key, slice):
            return [self._row(i) for i in range(*key.indices(len(self)))]
        index = operator.index(key)               # TypeError for 2.9, "3", None
        if index < 0:
            index += len(self)
        if not 0 <= index < len(self):
            raise IndexError("Ledger index out of range")
        return self._row(index)

    def _row(self, i: int) -> bytes:
        return self._blob[i * self.ROW:(i + 1) * self.ROW]
```

`key.indices(len(self))` is also the validation for the slice branch: it raises `TypeError` —
`slice indices must be integers or None or have an __index__ method` — for `slice(None, None,
'spam')`, and `ValueError` for a zero step. Code that reads `key.start` and `key.stop` directly
must handle `None`, negatives, clamping and type checks itself, and usually handles one of them.

## What a slice of your type returns

For the built-ins the reference is explicit — *"When used as an expression, a slice is a sequence
of the same type"* — and callers carry that expectation to your class: a slice of an `Order` list
is expected to be an `Order` list. The choices:

- **The same type** — right when the type carries meaning or metadata (a tag, a unit, a validated
  invariant). It is what `UserList` does, and it is what a `list` or `tuple` *subclass* does not do
  by default ([05](05-slices-are-copies.md)).
- **A plain `list`** — honest for a read-only view onto external storage, like `Ledger` above,
  where "the same type" would mean re-reading the source.
- **A lazy view** — right when the class is itself a view (`Squares`, `range`, `memoryview`); the
  slice costs O(1) and copies nothing, and shares the source's lifetime.

Restoring the type on a `list` subclass means overriding `__getitem__` and rebuilding — the fix for
the `TaggedBatch` of [05](05-slices-are-copies.md), whose `tag` disappeared in every slice:

```python
class TaggedBatch(list):
    def __init__(self, items=(), tag="untagged"):
        super().__init__(items)
        self.tag = tag

    def __getitem__(self, key):
        result = super().__getitem__(key)
        if isinstance(key, slice):
            return type(self)(result, tag=self.tag)
        return result


batch = TaggedBatch(["a", "b", "c"], tag="import-42")
first_two = batch[:2]
assert type(first_two) is TaggedBatch and first_two.tag == "import-42"
assert batch[0] == "a"
```

`UserList` does the rebuild for you, under a documented condition — *"Subclasses of `UserList` are
expected to offer a constructor which can be called with either no arguments or one argument. List
operations which return a new sequence attempt to create an instance of the actual implementation
class. To do so, it assumes that the constructor can be called with a single parameter, which is a
sequence object used as a data source."* A subclass whose constructor takes anything else breaks
slicing, `+` and `copy` all at once.

## Gotchas

**★ Symptom: `records[2.9]` returns record 2 and nobody notices.** Cause: `index = int(key)` —
a conversion that truncates floats and parses strings. Fix: `operator.index(key)`, which raises
`TypeError` for anything that is not integer-like.

```python
index = operator.index(key)
```

**★ Symptom: a `list` subclass loses its extra attributes — or its type — after slicing.** Cause:
`list.__getitem__` builds a plain `list` for a slice. Fix: override `__getitem__` to rebuild the
subclass, as `TaggedBatch` does, or build on `UserList`.

```python
if isinstance(key, slice):
    return type(self)(super().__getitem__(key), tag=self.tag)
```

**Symptom: a `TypeError` about a missing required positional argument from `users[1:]` on a
`UserList` subclass.** Cause: the subclass's constructor takes extra arguments, but `UserList`
rebuilds slices with `self.__class__(self.data[i])`. Fix: keep a one-argument constructor, with the
extras optional.

```python
class UserGroup(UserList):
    def __init__(self, initlist=None, name="group"):
        super().__init__(initlist)
        self.name = name
```

## Interview questions

**Why use `operator.index` rather than `int()` to validate an index?**
`int()` converts: it truncates `2.9` to `2`, parses `"3"`, and calls `__int__` on any numeric type,
so a wrong key silently selects some element. `operator.index` asks whether the object *is* an
integer — it calls `__index__`, which the data model reserves for lossless integer conversion
*"such as in slicing"* — and raises `TypeError` otherwise. It is the conversion the built-in
sequences apply to their own indices, so a class using it behaves like them.

**What should slicing your container return?**
By the built-ins' convention, the same type — the reference says a slice *"is a sequence of the
same type"* — and callers expect it, especially when the type carries metadata or invariants.
`UserList` does it by calling the class with the sliced data, which requires a one-argument
constructor. A plain list is reasonable for a read-only view onto external storage, and a lazy view
is right when the class is already a view. Whatever you choose, subclasses of `list`, `tuple` and
`str` do not choose it for you: their slices are the base type unless you override `__getitem__`.

**★ Why does slicing a `list` subclass return a plain `list`, and how do you make it return the
subclass?**
Because the subclass inherits `list.__getitem__`, which is implemented in C and always allocates a
new plain `list` for a slice — it has no way to know what arguments the subclass's constructor
needs, or which attributes to carry over. The same holds for `tuple` (including named tuples) and
`str`. To keep the type, override `__getitem__`: call `super().__getitem__(key)`, and when the key
is a slice, wrap the result in `type(self)(…)` with whatever extra state the instance carries.
Alternatively build on `collections.UserList`, which does the wrapping itself as long as the
constructor accepts a single sequence argument.

---

← Prev: [10 · Slicing your own class](10-slicing-your-own-class.md) · [Topic index](README.md)
