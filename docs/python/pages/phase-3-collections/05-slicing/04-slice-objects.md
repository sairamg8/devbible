---
title: "a[1:5:2] is a[slice(1, 5, 2)] — a slice is an ordinary, hashable, reusable object, so a fixed-width layout can be a table of named slices that the reader and the writer share, and since 3.12 a dict sliced by mistake fails as a missing key"
sidebar_label: "04 · slice objects"
sidebar_position: 5
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-10 for **Python 3.14.7** against the 3.14 documentation —
> [`slice`](https://docs.python.org/3.14/library/functions.html#slice),
> [Slice objects](https://docs.python.org/3.14/reference/datamodel.html#slice-objects),
> [Slicings](https://docs.python.org/3.14/reference/expressions.html#slicings),
> [`operator`](https://docs.python.org/3.14/library/operator.html#operator.itemgetter) and
> [What's New in 3.12](https://docs.python.org/3.14/whatsnew/3.12.html). Documentation-verified —
> **no sandbox run, no program output**.

**The colon syntax builds a `slice` object — three attributes and one method — and passes it to
`__getitem__`. Because it is an object, you can build it once, name it and reuse it: a
fixed-width file layout becomes a table of named slices that the parser and the writer share, and
`operator.itemgetter` accepts slices, so one callable can cut a record into all its fields. Since
Python 3.12 a slice is hashable, so it can be a dict key or an `lru_cache` argument — and a dict
you slice by mistake now raises `KeyError` instead of `TypeError`. The object validates nothing:
its attributes may be of any type, and the sequence that receives it is what enforces the
rules. Its one method, `indices()`, and the negative-step trap in it, are
[04b](04b-slice-indices.md).**

## The object behind the colon

> *"When a slice is evaluated, the interpreter constructs a `slice` object whose `start`, `stop`
> and `step` attributes, respectively, are the results of the expressions between the colons.
> Any missing expression evaluates to `None`. This `slice` object is then passed to the
> `__getitem__` or `__class_getitem__` special method"* —
> [Slicings](https://docs.python.org/3.14/reference/expressions.html#slicings)

> *"Return a slice object representing the set of indices specified by `range(start, stop,
> step)`.  The *start* and *step* arguments default to `None`."* · *"These read-only attributes
> are set to the argument values (or their default).  They have no other explicit functionality;
> however, they are used by NumPy and other third-party packages."* —
> [`slice`](https://docs.python.org/3.14/library/functions.html#slice)

The data model adds that the attributes *"can have any type"* — the reference's own example passes
`demo[::'spam']` and shows the receiving `__getitem__` getting `slice(None, None, 'spam')`. A slice
object validates nothing; the sequence that receives it decides what the attributes mean and
rejects what it cannot use. The `operator` module states the equivalence directly: slicing is
`getitem(seq, slice(i, j))`, slice assignment is `setitem(seq, slice(i, j), values)`, and slice
deletion is `delitem(seq, slice(i, j))`.

```python
import operator

report = "Quarterly revenue report"
title_word = slice(0, 9)

assert report[title_word] == report[0:9] == "Quarterly"
assert operator.getitem(report, title_word) == "Quarterly"
assert slice(3) == slice(None, 3, None)          # one argument is the stop
```

## Naming a slice: the fixed-width layout

Fixed-width files — bank statements, payroll exports, mainframe extracts — define each field by
column position. Writing the positions as literals in the parser, then again in the writer, then
again in a validation script, is how a widened field breaks one of the three silently. A table of
named slices is a single source of truth, and it can check itself:

```python
from operator import itemgetter

ACCOUNT = slice(0, 10)
BRANCH = slice(10, 14)
AMOUNT_CENTS = slice(14, 26)
CURRENCY = slice(26, 29)
RECORD_WIDTH = 29

LAYOUT = (ACCOUNT, BRANCH, AMOUNT_CENTS, CURRENCY)
split_record = itemgetter(*LAYOUT)


def check_layout(layout, width):
    """Fields must be contiguous, non-overlapping, and cover the record exactly."""
    position = 0
    for field in layout:
        if field.start != position or field.stop <= field.start or field.step is not None:
            raise ValueError(f"layout broken at {field!r}")
        position = field.stop
    if position != width:
        raise ValueError(f"layout covers {position} characters, record is {width}")


check_layout(LAYOUT, RECORD_WIDTH)

line = "0012345678LOND000000012550GBP"
account, branch, amount, currency = split_record(line)
assert (account, branch, currency) == ("0012345678", "LOND", "GBP")
assert int(amount) == 12550
assert line[AMOUNT_CENTS] == amount
```

`itemgetter` accepts slices because it simply calls `__getitem__` — the documentation: *"The items
can be any type accepted by the operand's `__getitem__` method.  Dictionaries accept any hashable
value.  Lists, tuples, and strings accept an index or a slice"*, with the example
`itemgetter(slice(2, None))('ABCDEFG')` returning `'CDEFG'`. With several items it returns a
tuple, which is what makes `split_record(line)` unpack into four fields in one call. The 1-based
column numbering of real specifications, and why the slicing should happen on bytes rather than
text, are in [11c](11c-fixed-width-records.md).

A slice key works for sorting too: to order CSV rows by their first two columns, the key is a
two-element list, and lists compare lexicographically.

```python
rows = [
    ["Okafor", "Ada", "engineering"],
    ["Lindqvist", "Bo", "operations"],
    ["Okafor", "Chidi", "sales"],
]
by_name = sorted(rows, key=itemgetter(slice(0, 2)))
assert [row[1] for row in by_name] == ["Bo", "Ada", "Chidi"]
```

## Hashable since 3.12

> *"Changed in version 3.12: Slice objects are now hashable (provided `start`, `stop`, and `step`
> are hashable)."* — [`slice`](https://docs.python.org/3.14/library/functions.html#slice)

> *"slice objects are now hashable, allowing them to be used as dict keys and set items."* —
> [What's New in Python 3.12](https://docs.python.org/3.14/whatsnew/3.12.html)

That makes a slice a legal argument to a cached function, which before 3.12 raised because the
cache key could not be hashed:

```python
from functools import lru_cache


@lru_cache(maxsize=256)
def window_total(prices: tuple[float, ...], window: slice) -> float:
    return sum(prices[window])


assert window_total((1.0, 2.0, 3.0), slice(1, None)) == 5.0
```

It also changed what happens when a dict is sliced by mistake. A dict looks the key up by hash;
before 3.12 hashing the slice failed with `TypeError`, and from 3.12 the hash succeeds and the
lookup fails with a `KeyError` whose key is the slice object. Both are errors, but the new one
reads like a missing key rather than a type confusion, which is worth recognising in a traceback.
The hash covers all three attributes, so a slice whose attributes include something unhashable —
a list as a bound, say — is still unhashable.

## Gotchas

**★ Symptom: after a field was widened in the export job, the import job reads every amount one
digit short.** Cause: the column positions were literals copied into two programs, and only one
was updated. Fix: one shared layout of named slices, checked when the module loads.

```python
check_layout(LAYOUT, RECORD_WIDTH)          # fails fast if a field was changed inconsistently
```

**Symptom: a layout loaded from YAML constructs fine and then raises `TypeError` on the first
record.** Cause: `slice()` accepts attributes of *any type*, so `slice(0, 10.0)` is created
without complaint; the float is rejected only when the slice is applied. Fix: validate the
numbers when the layout is built.

```python
import operator


def field_slice(spec: dict) -> slice:
    return slice(operator.index(spec["start"]), operator.index(spec["stop"]))
```

**★ Symptom: a traceback shows `KeyError` with a `slice(...)` as the key.** Cause: code sliced a
mapping — often `rows[:10]` where `rows` turned out to be a dict of rows keyed by ID. Since 3.12
the slice hashes, so the dict treats it as a key that is not present. Fix: slice something
ordered — the dict's items, lazily.

```python
from itertools import islice

first_ten = dict(islice(rows.items(), 10))
```

**Symptom: `itemgetter(slice(0, 2))` works on `csv.reader` rows and raises `KeyError` on
`csv.DictReader` rows.** Cause: a `DictReader` row is a dict, and *"Dictionaries accept any
hashable value"* — the slice is looked up as a key. Fix: fetch dict rows by field name.

```python
key = itemgetter("last_name", "first_name")
```

**Symptom: `lru_cache` on a function taking a slice raises `TypeError` on one server and works on
another.** Cause: the failing server runs Python 3.11 or older, where slices are unhashable; the
3.12 change is what makes the cache key legal. Fix: pass the bounds, which have always been
hashable, if the code must run on both.

```python
@lru_cache(maxsize=256)
def window_total(prices: tuple[float, ...], start: int, stop: int) -> float:
    return sum(prices[start:stop])
```

## Interview questions

**★ What exactly happens when Python evaluates `a[1:5:2]`?**
The interpreter evaluates the three expressions, builds `slice(1, 5, 2)` — with `None` for any
omitted part — and calls `type(a).__getitem__(a, that_slice)`. There is no dedicated slicing
method; `__getslice__` was removed in Python 3. The slice object carries no behaviour of its own
beyond its attributes and `indices()`, so everything about clamping, negatives and the result
type is decided by the sequence that receives it.

**Why would you give a slice a name?**
For the same reason you name a constant: the positions mean something. A fixed-width record layout
expressed as `ACCOUNT = slice(0, 10)` and friends is readable, lives in one place shared by the
reader and the writer, can be checked for gaps and overlaps, and composes with `itemgetter` to cut
a record into all its fields at once.

**What changed about slices in 3.12, and what does it enable or break?**
They became hashable when their attributes are. That lets a slice be a dict key, a set member or
an argument to `functools.lru_cache`. The visible side effect is that slicing a dict by mistake
now fails with `KeyError` rather than `TypeError: unhashable type`, because the lookup itself
proceeds.

**What types can a slice's `start`, `stop` and `step` be?**
Any type — the data model says so, and the reference's own example passes a string as the step.
The built-in sequences accept only integers, `None`, or objects with `__index__`, and raise
`TypeError` for anything else when the slice is applied. Third-party containers such as NumPy
arrays, or your own classes, may interpret other types; that freedom is why `slice` validates
nothing, and why a layout built from configuration should be checked with `operator.index` when
it is loaded.

**How does `operator.itemgetter` interact with slices?**
It calls `__getitem__` with whatever it was given, so on a list, tuple or string a slice argument
slices, and several arguments return a tuple of results — one callable can cut a record into all
its fields, or serve as a sort key over a run of columns. On a dict the same slice is treated as a
key, which is why an `itemgetter` built for positional rows fails on dict rows.

---

← Prev: [03 · Out of range never raises](03-out-of-range-never-raises.md) · [Topic index](README.md) · Next → [04b · slice.indices()](04b-slice-indices.md)
