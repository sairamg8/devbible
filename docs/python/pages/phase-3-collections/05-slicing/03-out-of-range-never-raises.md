---
title: "An index outside the sequence raises and a slice outside it never does — slicing clamps silently, so it cannot tell you a record was short, a bound was swapped, or a window you computed ran off the front and wrapped around to the end"
sidebar_label: "03 · Out of range never raises"
sidebar_position: 4
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-10 for **Python 3.14.7** against the 3.14 documentation —
> [Common Sequence Operations](https://docs.python.org/3.14/library/stdtypes.html#common-sequence-operations)
> (notes 3, 4 and 8), the data model's
> [Sequences](https://docs.python.org/3.14/reference/datamodel.html#datamodel-sequences) and
> [`__index__`](https://docs.python.org/3.14/reference/datamodel.html#object.__index__), the
> [tutorial on strings](https://docs.python.org/3.14/tutorial/introduction.html#text); CPython 3.14
> [`Python/ceval.c`](https://github.com/python/cpython/blob/3.14/Python/ceval.c) (`_PyEval_SliceIndex`)
> and [`Objects/abstract.c`](https://github.com/python/cpython/blob/3.14/Objects/abstract.c) for
> error text. Documentation-verified — **no sandbox run, no program output**.

**`s[10]` on a five-element sequence raises `IndexError`; `s[10:]` returns an empty sequence of
the same type. Both behaviours are documented, and the second is deliberate — it is what lets
`items[:limit]` mean "at most `limit` items" without a length check. But clamping is silence,
and silence has a cost: a slice cannot distinguish "there was nothing there" from "you asked for
the wrong place". A fixed-width record that arrived short yields empty fields instead of an
error; bounds passed in the wrong order yield nothing; and — the one that survives code review —
a window computed as `i - 2` does not clamp at zero when `i` is small, it *wraps*, because only
positions below `-len(s)` clamp and every other negative number counts from the end.**

## The documented asymmetry

For indexing, note (8) of the sequence table: *"An `IndexError` is raised if *i* is outside the
sequence range."* For slicing, the data model:

> *"Note that no error is raised if a slice position is less than zero or larger than the length
> of the sequence."* — [Sequences](https://docs.python.org/3.14/reference/datamodel.html#datamodel-sequences)

The tutorial shows both side by side — `word[42]` raising `IndexError: string index out of range`,
then *"However, out of range slice indexes are handled gracefully when used for slicing"* with
`word[4:42]` giving `'on'` and `word[42:]` giving `''`. The rules that make it graceful are note
(4)'s clamps: a bound below `-len(s)` becomes `0`, a bound above `len(s)` becomes `len(s)`, and a
start at or past the stop gives an empty slice.

## Two clamps, and the gap between them

The clamps apply at the *outer* edges only. Between `-len(s)` and `-1`, a negative bound is not
clamped at all; it is re-based to `len(s) + i` by note (3). So a bound that drifts slightly below
zero lands near the *end* of the sequence:

```python
lines = [f"line {n}" for n in range(10)]

assert lines[-100:3] == ["line 0", "line 1", "line 2"]   # far below: clamped to 0
assert lines[-2:3] == []                                 # slightly below: position 8, past the stop
assert lines[7:100] == ["line 7", "line 8", "line 9"]    # far above: clamped to len
```

That middle line is the bug in every "context around line `i`" helper written as
`lines[i - radius:i + radius + 1]`. For `i` near the start it returns nothing — or, on a short
file where the wrapped start still lies before the stop, *the wrong lines*:

```python
def context_buggy(lines, i, radius=2):
    return lines[i - radius:i + radius + 1]


def context(lines, i, radius=2):
    """Lines around line i, for an error report."""
    if not 0 <= i < len(lines):
        raise IndexError("line number out of range")
    return lines[max(i - radius, 0):i + radius + 1]


lines = [f"line {n}" for n in range(10)]
assert context_buggy(lines, 0) == []                      # start -2 became 8
assert context_buggy(["a", "b", "c", "d"], 0) == ["c"]    # start -2 became 2: wrong line
assert context(lines, 0) == ["line 0", "line 1", "line 2"]
assert context(lines, 9) == ["line 7", "line 8", "line 9"]
```

The stop needs no clamp — past the end, note (4) clamps it. The start needs `max(..., 0)` whenever
it is computed by subtraction.

## How far the clamping goes

The bounds do not even have to fit in a machine integer. CPython's `_PyEval_SliceIndex` documents
its own behaviour in a comment:

> *"Silently reduce values larger than PY_SSIZE_T_MAX to PY_SSIZE_T_MAX, and silently boost
> values less than PY_SSIZE_T_MIN to PY_SSIZE_T_MIN."* —
> [`Python/ceval.c`](https://github.com/python/cpython/blob/3.14/Python/ceval.c)

So `s[:10**100]` is simply `s[:]`. Indexing gets no such treatment: `list_subscript` converts the
index with `IndexError` as the overflow exception, so `s[10**100]` raises `IndexError` with the
message `cannot fit 'int' into an index-sized integer` (the literal in `Objects/abstract.c`). That
is a CPython detail; the documented part is only that slices do not raise and indexes do.

## What a bound may be

A slice bound must be an integer, `None`, or an object with `__index__`. Anything else fails when
the slice is *applied*, not when it is written — CPython raises `TypeError` with the message
`slice indices must be integers or None or have an __index__ method` from `_PyEval_SliceIndex`.

> *"`object.__index__(self)` — Called to implement `operator.index`, and whenever Python needs to
> losslessly convert the numeric object to an integer object (such as in slicing, or in the
> built-in `bin`, `hex` and `oct` functions). Presence of this method indicates that the numeric
> object is an integer type."* —
> [data model](https://docs.python.org/3.14/reference/datamodel.html#object.__index__)

That is why a NumPy integer works as a bound and a `float` never does, even `2.0`. The usual
source of a float is `/`, which always returns one:

```python
title = "Quarterly revenue report"

# title[:len(title) / 2]  -> TypeError: slice indices must be integers ...
first_half = title[:len(title) // 2]
assert first_half + title[len(title) // 2:] == title
```

`bool` is a subclass of `int`, so `s[True:]` is `s[1:]`. Some code uses that deliberately —
`rows[has_header:]` — and it works, but only while `has_header` is really a `bool`; the day it
arrives as the string `"true"` from a config file, the slice raises.

## Clamping on purpose

The asymmetry is a feature when "up to" is what you mean. These are all safe on empty input:

```python
def preview(items, limit=5):
    return items[:limit]                   # at most `limit`, never an error


def first_or_none(items):
    return next(iter(items), None)         # works on any iterable, not just sequences


def is_comment(line):
    return line[:1] == "#"                 # "" on a blank line, never IndexError


assert preview([], 5) == []
assert first_or_none([]) is None
assert is_comment("") is False
assert is_comment("# note") is True
```

`line[:1]` is a string of length 0 or 1 — the documentation's own identity, *"for a non-empty
string s, `s[0] == s[0:1]`"*, extended safely to the empty case. For prefix tests,
`line.startswith("#")` says the same thing more plainly.

## When silence is a bug, make it loud

Clamping is the wrong behaviour whenever the data has a promised shape: a fixed-width record, a
header of known length, a page number that must exist. Check the length before slicing; the
check is one line and turns a silent empty field into an error that names the record.

```python
RECORD_WIDTH = 29


def parse_payment(line: str) -> tuple[str, str, int]:
    record = line.rstrip("\r\n")
    if len(record) != RECORD_WIDTH:
        raise ValueError(f"payment record must be {RECORD_WIDTH} chars, got {len(record)}")
    account, branch, amount = record[0:10], record[10:14], record[14:26]
    return account, branch, int(amount)
```

Named slices for such layouts, and the column-numbering bugs specific to fixed-width files, are in
[04](04-slice-objects.md) and [11c](11c-fixed-width-records.md).

## Gotchas

**★ Symptom: an error report shows no surrounding lines for errors near the top of a file — or
shows lines from the end of the file.** Cause: `lines[i - 2:i + 3]` with `i < 2` produces a small
negative start, which is re-based from the end rather than clamped; only starts below `-len(lines)`
clamp to 0. Fix: clamp computed starts.

```python
window = lines[max(i - 2, 0):i + 3]
```

**★ Symptom: `IndexError: string index out of range` from a config parser, only on files with
blank lines.** Cause: `if line[0] == "#"` indexes an empty string; indexing raises where slicing
would not. Fix: test the prefix, or slice.

```python
if line.startswith("#"):
    continue
```

**★ Symptom: `TypeError: slice indices must be integers or None or have an __index__ method`
after porting code from Python 2.** Cause: `/` is true division in Python 3 and returns a
`float`, which has no `__index__`. Fix: floor division.

```python
middle = len(values) // 2
lower, upper = values[:middle], values[middle:]
```

**Symptom: a batch importer loads records with empty account numbers instead of rejecting a
truncated file.** Cause: `record[0:10]` on a short line is `""` — note (4) clamps the bounds and
nothing raises. Fix: validate the length first, as `parse_payment` above does.

**Symptom: a date-range filter returns nothing, and no error, when the caller passes the dates in
the wrong order.** Cause: *"If i is greater than or equal to j, the slice is empty."* A reversed
pair of bounds is indistinguishable from an empty range. Fix: validate the order at the boundary.

```python
def rows_between(rows, first, last):
    if first > last:
        raise ValueError(f"first ({first}) is after last ({last})")
    return rows[first:last + 1]
```

**Symptom: a limit read from a JSON request body works in tests and raises `TypeError` in
production.** Cause: some client sent `20.0`, JSON has one number type, and the decoder produced
a `float`; the slice rejects it only when it is applied. Fix: validate integers where they enter.

```python
def parse_limit(raw) -> int:
    if isinstance(raw, bool) or not isinstance(raw, int):
        raise ValueError("limit must be an integer")
    if not 1 <= raw <= 100:
        raise ValueError("limit must be between 1 and 100")
    return raw
```

## Interview questions

**★ Why does `s[10]` raise but `s[10:]` return an empty sequence?**
Because an index names one element, and if it does not exist there is nothing to return; a slice
names a range, and a range that lies partly or wholly outside the sequence has a well-defined
intersection with it. The documentation states both: note (8) raises `IndexError` for an index
outside the range, and the data model says *"no error is raised if a slice position is less than
zero or larger than the length"*. The design pays off in idioms like `items[:limit]`, which means
"at most `limit`" with no length check.

**★ Why does `lines[i - 2:i + 3]` misbehave for small `i`?**
Because the clamp to 0 applies only to bounds below `-len(lines)`. A start of `-1` or `-2` is a
perfectly ordinary negative index, re-based to `len(lines) - 1` or `len(lines) - 2`, so the window
starts near the end — usually past the stop, giving an empty list, and on a short list giving the
wrong lines. Any start computed by subtraction needs `max(start, 0)`.

**What may a slice bound be, and why does `s[:len(s) / 2]` fail?**
An `int` (including subclasses such as `bool`), `None`, or any object implementing `__index__`,
which the data model describes as the method Python uses to *"losslessly convert the numeric
object to an integer object (such as in slicing"*. `len(s) / 2` is a `float` even when it is
whole, and floats deliberately do not implement `__index__`, so the slice raises `TypeError`; use
`//`.

**Is `s[0:10**100]` an error? Is `s[10**100]`?**
The slice is not: slice bounds are clamped, and CPython even reduces values beyond the platform's
largest index silently before clamping, so it equals `s[:]`. The index is: CPython converts it
with `IndexError` as the overflow error, so it raises `IndexError` — as it would for any index
outside the sequence.

**How do you take the first element, or a default, without `try`/`except`?**
For any iterable, `next(iter(items), default)`. For a sequence where an empty *sequence* is an
acceptable answer, `items[:1]`, which is safe on empty input and keeps the type. Avoid
`items[0] if items else default` in code that may receive iterators, since an iterator is always
truthy.

**When is the silent clamping the wrong behaviour, and what do you do about it?**
Whenever the data promises a shape: a fixed-width record, a binary header, a page that the caller
believes exists, a pair of bounds that must be ordered. Clamping turns those violations into empty
or truncated values that fail far away from the cause. Check the length or the bounds before
slicing and raise with a message that names the record — slicing itself will never do it for you.

---

← Prev: [02b · Strides and reversal](02b-strides-and-reversal.md) · [Topic index](README.md) · Next → [04 · slice objects](04-slice-objects.md)
