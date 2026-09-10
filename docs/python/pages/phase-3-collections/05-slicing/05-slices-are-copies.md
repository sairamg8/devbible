---
title: "Slicing a list, tuple, str, bytes or bytearray builds a new object of the base type holding the same references — shallow, costing the length of the slice, blind to your subclass — except where CPython hands an immutable full slice straight back"
sidebar_label: "05 · Slices are copies"
sidebar_position: 7
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-10 for **Python 3.14.7** against the 3.14 documentation — the data model's
> [Sequences](https://docs.python.org/3.14/reference/datamodel.html#datamodel-sequences),
> [`copy`](https://docs.python.org/3.14/library/copy.html),
> [Time complexity of operations on built-in types](https://docs.python.org/3.14/library/time-complexity.html),
> the [tutorial on lists](https://docs.python.org/3.14/tutorial/introduction.html#lists); CPython
> 3.14 [`Objects/tupleobject.c`](https://github.com/python/cpython/blob/3.14/Objects/tupleobject.c),
> [`Objects/unicodeobject.c`](https://github.com/python/cpython/blob/3.14/Objects/unicodeobject.c),
> [`Objects/bytesobject.c`](https://github.com/python/cpython/blob/3.14/Objects/bytesobject.c) and
> [`Objects/listobject.c`](https://github.com/python/cpython/blob/3.14/Objects/listobject.c) for the
> identity shortcuts, labelled as implementation detail. Documentation-verified — **no sandbox
> run, no program output**.

**For every built-in sequence that stores its own elements, a slice is a new object: the
language reference says *"a slice is a sequence of the same type"*, and the tutorial says *"All
slice operations return a new list"*. What it copies is references — the new list points at the
same dicts, the same nested lists, the same objects — so a slice is exactly as shallow as
`list.copy()`. It costs time proportional to the length of the slice. It comes back as the
*base* type, so a slice of a named tuple is a plain tuple and a slice of your `list` subclass is a
plain `list`. And for immutable types CPython takes a shortcut the documentation does not
promise: a full slice of an exact `tuple`, `str` or `bytes` returns the original object, because
there is nothing a copy could protect.**

## The rule, in the documentation's words

> *"When used as an expression, a slice is a sequence of the same type."* —
> [Sequences](https://docs.python.org/3.14/reference/datamodel.html#datamodel-sequences)

> *"All slice operations return a new list containing the requested elements.  This means that
> the following slice returns a shallow copy of the list"* —
> [tutorial](https://docs.python.org/3.14/tutorial/introduction.html#lists)

> *"Shallow copies of many collections can be made using the corresponding `copy()` method (such
> as `list.copy()`, `dict.copy()` or `set.copy()`), and of sequences (such as lists or bytearrays)
> by making a slice of the entire sequence (`sequence[:]`). However, these methods and slicing can
> create an instance of the base type when copying an instance of a subclass, whereas
> `copy.copy()` normally returns an instance of the same type."* —
> [`copy`](https://docs.python.org/3.14/library/copy.html)

The five spellings of a list copy — `a[:]`, `list(a)`, `a.copy()`, `copy.copy(a)`, `[*a]` — and
exactly how they differ are covered once, in
[`list` internals · 10](../01-list-internals/10-copies-and-aliasing.md). This page is about what
slicing specifically adds: partial copies, per-type behaviour, and the base-type rule.

## What a slice copies: references

```python
orders = [{"id": 1, "status": "new"}, {"id": 2, "status": "new"}]
snapshot = orders[:]

snapshot[0]["status"] = "shipped"             # the dicts are shared
assert orders[0]["status"] == "shipped"

snapshot.append({"id": 3, "status": "new"})   # the list is not
assert len(orders) == 2
```

A slice gives you a new *container* and the same *contents*. Whether that is enough depends only on
whether anyone mutates the contents — the full treatment of shallow versus deep copying is
[Phase 1 · 07 — Shallow copy](../../phase-1-language-core/07-assignment-and-aliasing/08-shallow-copy.md).
When the elements are immutable — strings, numbers, tuples of those — a shallow copy is a complete
one.

## Type by type

| Type | `s[i:j]` gives | Full slice `s[:]` in CPython 3.14 | Cost, 3.14 table |
|---|---|---|---|
| `list` | a new `list` | a new list, always | O(j − i) |
| `tuple` | a new `tuple` | the same object, if it is an exact `tuple` | O(j − i) |
| `str` | a new `str` | the same object, if it is an exact `str` | O(j − i) |
| `bytes` | a new `bytes` | the same object, if it is exact `bytes` | O(j − i) |
| `bytearray` | a new `bytearray` | a new bytearray, always | O(j − i) |
| `range` | a new `range`, computed | a new range, computed | O(1) |
| `memoryview` | a new view on the same buffer | a new view | O(1) |
| `collections.deque` | not sliceable | — | — |

The cost column is the 3.14 documentation's
[time-complexity table](https://docs.python.org/3.14/library/time-complexity.html) — *"Get slice
(`l[i:j]`) O(j - i)"* for lists and the same for tuples, strings, bytes and bytearrays. The two
rows that cost O(1) are the two that do not copy elements, and they are
[06](06-slices-that-do-not-copy.md). `array.array` slices produce a new array; the cost table does
not list `array`.

## The base type, not your type

The copy documentation's warning — slicing *"can create an instance of the base type when copying
an instance of a subclass"* — bites hardest on the subclasses people forget are subclasses. A
named tuple is a `tuple` subclass, and CPython's `tuple_subscript` builds a plain tuple for any
slice of it:

```python
from typing import NamedTuple


class Trade(NamedTuple):
    symbol: str
    quantity: int
    price_cents: int


trade = Trade("ACME", 100, 1250)
head = trade[:2]

assert head == ("ACME", 100)
assert type(head) is tuple                    # the record type is gone
assert not hasattr(head, "symbol")
```

A `list` subclass fares the same, because `list` slicing always allocates a plain list:

```python
class TaggedBatch(list):
    def __init__(self, items=(), tag="untagged"):
        super().__init__(items)
        self.tag = tag


batch = TaggedBatch(["a", "b", "c"], tag="import-42")
first_two = batch[:2]

assert first_two == ["a", "b"]
assert type(first_two) is list
assert not hasattr(first_two, "tag")
```

For a `str` subclass used as a *marker* — a type meaning "this text has been validated" or "this
text came from a user" — the marker silently disappears in every slice, which matters if the rest
of the code trusts it. A subclass that must survive slicing has to override `__getitem__`;
[10b](10b-integer-keys-and-return-types.md) shows how, and when `collections.UserList` does it for you.

## When the "copy" is the original

Two shortcuts are documented. For tuples, the constructor: *"If *iterable* is already a tuple, it
is returned unchanged."* For strings and bytes, the cost page: *"`str` and `bytes` objects are
immutable sequences of characters and bytes, respectively. As with tuples, copying one returns the
original object."* Neither sentence names slicing. The CPython 3.14 source does the same thing for
a full slice — an implementation detail, not a promise:

```c
/* Objects/tupleobject.c, tuple_subscript */
if (slicelength <= 0) {
    return tuple_get_empty();
}
else if (start == 0 && step == 1 &&
         slicelength == PyTuple_GET_SIZE(self) &&
         PyTuple_CheckExact(self)) {
    return Py_NewRef(self);
}
```

`unicode_subscript` and `bytes_subscript` have the same full-slice check, and `str` routes it
through `unicode_result_unchanged`, whose comment explains the subclass case: *"Subtype -- return
genuine unicode string with the same value."* Empty slices return the shared empty tuple or
string. `list` has no shortcut at all — `list_slice_lock_held` always allocates — because a list
copy exists precisely so that one side can mutate without the other seeing it.

Nothing *semantic* depends on this for immutable types: a copy and the original are
indistinguishable except by `is` and `id()`. That is exactly where it bites — code that uses
identity to decide whether a copy was made, or keys a cache on `id()`.

## Strings do not share memory with their slices

In CPython 3.14 a string slice is built by `PyUnicode_Substring`, which copies the selected code
points into a new object. So a twenty-character slice of a fifty-megabyte document is an
independent twenty-character string, and the document can be freed as soon as nothing else
refers to it. That is the opposite trade-off from a view: a `memoryview` slice costs O(1) to make
but keeps its whole buffer alive ([06](06-slices-that-do-not-copy.md)). The documentation does not
promise either behaviour for `str`; it is how the 3.14 implementation is written.

## Gotchas

**★ Symptom: a "preview" of pending orders, made with `orders[:]`, marks the real orders as
shipped.** Cause: the slice copied the list, not the dicts in it — a shallow copy. Fix: copy the
level you intend to mutate, or build new records.

```python
preview = [dict(order) for order in orders]
preview[0]["status"] = "shipped"
```

**★ Symptom: `AttributeError: 'tuple' object has no attribute '_asdict'` — or JSON output without
field names — after taking the first columns of a named-tuple row.** Cause: `row[:2]` is a plain
`tuple`; slicing returns the base type. Fix: select fields by name.

```python
summary = {"symbol": trade.symbol, "quantity": trade.quantity}
```

**Symptom: a batch's `tag` attribute vanishes after the batch is split into halves.** Cause:
slicing a `list` subclass returns a plain `list`. Fix: rebuild the subclass explicitly, or make
`__getitem__` do it ([10b](10b-integer-keys-and-return-types.md)).

```python
halves = [TaggedBatch(batch[:mid], tag=batch.tag), TaggedBatch(batch[mid:], tag=batch.tag)]
```

**Symptom: user-supplied text that is truncated for a preview skips the sanitiser that every
`UserText` value passes through.** Cause: `UserText` is a `str` subclass used as a marker, and
`text[:80]` is a plain `str`. Fix: wrap instead of subclassing, so there is no `__getitem__` to
lose the marker, and sanitise at the point of output.

```python
from dataclasses import dataclass


@dataclass(frozen=True)
class UserText:
    raw: str

    def preview(self, limit: int = 80) -> "UserText":
        return UserText(self.raw[:limit])
```

**Symptom: a change-detection check — `if config_tuple[:] is not config_tuple:` — never fires.**
Cause: CPython returns the same object for a full slice of an exact tuple, so the "copy" is
always identical by `is`. Fix: immutables need no defensive copy; compare by value if you must
detect a change.

```python
changed = new_config != old_config
```

**Symptom: code writes into a slice of a received `bytearray` to patch a header, and the buffer
is unchanged.** Cause: `buffer[0:4]` is a new `bytearray`; writing to it touches only the copy.
Fix: assign to the slice of the original, or take a `memoryview` slice, which writes through.

```python
buffer[0:4] = new_header
view = memoryview(buffer)
view[0:4] = new_header
```

## Interview questions

**★ Is `a[:]` a deep or a shallow copy, and what does that mean for a list of dicts?**
Shallow. The new list holds references to the same dict objects, so appending to or removing from
the copy leaves the original list alone, but mutating a dict through either list is visible
through both. The tutorial calls the full slice *"a shallow copy of the list"*; for a copy you can
mutate at every level, copy each level you intend to change, or use `copy.deepcopy` when the
structure is arbitrary.

**★ Does slicing a tuple or a string copy the data?**
A partial slice does: it builds a new object holding the selected elements, at a cost proportional
to the slice length. A full slice of an exact `tuple`, `str` or `bytes` returns the original object
in CPython 3.14 — an implementation shortcut, not documented for slicing, though the documentation
does say that `tuple(t)` returns `t` and that copying a `str` or `bytes` returns the original.
Since these types are immutable, no code can observe the difference except through `is` or `id()`.

**What type does slicing an instance of a subclass return, and why?**
The base type. The built-in implementations allocate their own type for the result — a plain
`list`, a plain `tuple` — because they cannot know how to construct an arbitrary subclass, whose
`__init__` may need extra arguments. The `copy` documentation warns about exactly this. A slice
of a named tuple is therefore a plain tuple, and a subclass that needs to survive slicing must
override `__getitem__`.

**Why can a small slice of a huge string not keep the huge string alive in CPython, when a
`memoryview` slice can?**
Because CPython's string slicing copies the selected code points into a new, independent string,
so the slice holds no reference to the original. A `memoryview` slice is a new view onto the same
buffer — that is what makes it O(1) — so it holds the underlying object alive, and for a
`bytearray` it even blocks resizing while it exists.

**When would you choose `copy.copy(x)` over `x[:]`?**
When `x` might be a subclass and the copy must keep its type, or when `x` might not be a sequence
at all. `copy.copy` *"normally returns an instance of the same type"*, while slicing returns the
base type. For a plain list the two are interchangeable; `x.copy()` or `list(x)` state the intent
more clearly than `x[:]`.

---

← Prev: [04b · slice.indices()](04b-slice-indices.md) · [Topic index](README.md) · Next → [06 · Slices that do not copy](06-slices-that-do-not-copy.md)
