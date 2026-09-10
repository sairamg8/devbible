---
title: "islice takes only non-negative integers because a stream has no end to count back from — the last n and all-but-the-last n are written with a bounded deque instead, and a bad bound raises ValueError where the same bound in a slice raises TypeError or is silently clamped"
sidebar_label: "07b · islice bounds and negatives"
sidebar_position: 10
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-10 for **Python 3.14.7** against the 3.14 documentation —
> [`itertools.islice`](https://docs.python.org/3.14/library/itertools.html#itertools.islice),
> [Itertools recipes](https://docs.python.org/3.14/library/itertools.html#itertools-recipes)
> (`tail`), [`collections.deque`](https://docs.python.org/3.14/library/collections.html#collections.deque);
> CPython 3.14 [`Modules/itertoolsmodule.c`](https://github.com/python/cpython/blob/3.14/Modules/itertoolsmodule.c)
> (`islice_new`) and [`Python/ceval.c`](https://github.com/python/cpython/blob/3.14/Python/ceval.c)
> (`_PyEval_SliceIndex`) for the conversion paths and error text — implementation detail.
> Documentation-verified — **no sandbox run, no program output**.

**`islice` *"does not support negative values for *start*, *stop*, or *step*"*, and that is not
an omission. A negative position means "counted from the end", and a stream's end is unknown
until it has been reached — supporting `-1` would mean silently buffering the entire input. So the
two list habits that lean on the end, `s[-n:]` and `s[:-n]`, have to be rewritten for streams, and
the rewrite is a `deque` holding exactly *n* items. The other half of this page is what `islice`
accepts as a bound at all: the same set as a slice, but with different failures — a float or an
oversized integer becomes `ValueError` in `islice`, where a slice raises `TypeError` for the first
and clamps the second without complaint. [07](07-islice-and-iterators.md) is the walk itself.**

## No negative numbers — what to write instead

`islice` rejects negatives outright rather than buffering. What you write instead depends on which
end you want:

```python
from collections import deque
from itertools import islice


def last(n, iterable):
    """The last n items — the docs' `tail` recipe, materialised. Consumes everything."""
    return list(deque(iterable, maxlen=n))


def drop_last(n, iterable):
    """Everything except the last n items, lazily, holding only n items at a time."""
    iterator = iter(iterable)
    window = deque(islice(iterator, n))
    for item in iterator:
        window.append(item)
        yield window.popleft()


assert last(2, iter("abcde")) == ["d", "e"]
assert list(drop_last(2, iter("abcde"))) == ["a", "b", "c"]
assert list(drop_last(0, iter("abc"))) == ["a", "b", "c"]
```

`last` is the documentation's recipe — *"Return an iterator over the last n items."*, implemented
as `iter(deque(iterable, maxlen=n))`. A bounded deque discards from the opposite end when it is
full, so memory stays at *n* however long the stream is; the time is still the whole stream,
because the end has to be reached. The `deque` documentation makes the same point with its own
example: *"Bounded length deques provide functionality similar to the `tail` filter in Unix"*.

`drop_last` is the stream equivalent of `s[:-n]` — and unlike `s[:-n]` it is correct for `n = 0`,
the trap of [01](01-the-three-numbers.md): with `n = 0` the window starts empty and every item is
appended and immediately yielded. It holds *n* items, yields each one *n* positions late, and the
final *n* are still in the window when the input ends — exactly the ones to drop.

If you have a **sequence**, you have its end, and none of this is needed: slice it, or walk it
backwards without copying with `islice(reversed(seq), n)` ("the newest *n*, newest first").
`reversed` requires *"an object which has a `__reversed__` method or supports the sequence
protocol"*, so it works on a list and fails on a generator. A negative **step** has no stream
equivalent at all; reversing needs the whole input in memory first.

```python
from itertools import islice

events = ["e1", "e2", "e3", "e4", "e5"]            # a list: its end is known
assert list(islice(reversed(events), 2)) == ["e5", "e4"]   # no copy of the list is made
```

## What it accepts as a number

`islice_new` converts each argument with `PyNumber_AsSsize_t`, so `None`, an `int`, or any object
with `__index__` is accepted — the same set a slice accepts. What differs is the failure. When a
conversion fails, CPython **clears** the original exception and raises `ValueError` with one of
three messages from the source:

- `Stop argument for islice() must be None or an integer: 0 <= x <= sys.maxsize.` — a stop that
  is exactly `-1`, is not an integer (a `float`, a `str`), or overflows `Py_ssize_t`;
- `Indices for islice() must be None or an integer: 0 <= x <= sys.maxsize.` — a negative or
  unconvertible start, or a stop below `-1`;
- `Step for islice() must be a positive integer or None.` — a step of zero or less.

So `islice(rows, len(rows) / 2)` raises `ValueError`, where `rows[:len(rows) / 2]` raises
`TypeError` — code that catches only one of them for "bad bound" handles only one of the two
spellings. A slice silently clamps a bound above `sys.maxsize` ([03](03-out-of-range-never-raises.md));
`islice` rejects it. Keyword arguments are refused too (`islice_new` calls `_PyArg_NoKeywords`),
so `islice(rows, stop=5)` raises `TypeError`.

Which of the first two messages a negative stop produces depends on its value — `-1` is
`islice_new`'s internal marker for "no stop", so it is tested separately from every other negative.
Do not match on the message text; the exception type is the stable part.

The same conversion rule means a bound computed from user input should be validated as an integer
*before* it reaches either API:

```python
def page_bounds(page: int, size: int) -> tuple[int, int]:
    if page < 0 or size <= 0:
        raise ValueError(f"page must be >= 0 and size > 0, got page={page} size={size}")
    return page * size, page * size + size
```

## Gotchas

**★ Symptom: `ValueError: Stop argument for islice() must be None or an integer: 0 <= x <=
sys.maxsize.` from `islice(log_lines, -1)`.** Cause: a list habit — `lines[:-1]` — applied to a
stream. Fix: buffer the end with a `deque`, as `drop_last` above does.

```python
all_but_trailer = drop_last(1, log_lines)
```

**★ Symptom: "the last 50 lines of the log" is written as `list(log_file)[-50:]` and a large log
takes the service's memory with it.** Cause: `list()` materialises the whole file to reach its
end. Fix: a bounded deque reaches the end holding only 50 lines.

```python
from collections import deque

with open(path, encoding="utf-8") as log_file:
    recent = list(deque(log_file, maxlen=50))
```

**Symptom: `ValueError: Stop argument for islice() …` from `islice(samples, count / 2)`.** Cause:
`/` produces a float, and `islice` turns the conversion `TypeError` into `ValueError`. Fix:
integer division.

```python
first_half = islice(samples, count // 2)
```

**Symptom: a helper that accepts "a list or a generator" catches `TypeError` for bad bounds and
still crashes with `ValueError` on the generator path.** Cause: the list path slices (a float bound
is `TypeError`) and the generator path calls `islice` (the same bound is `ValueError`). Fix:
normalise the bound once, before choosing a path.

```python
import operator
from collections.abc import Sequence
from itertools import islice


def head(items, n):
    n = operator.index(n)            # TypeError for a float, on both paths
    if isinstance(items, Sequence):
        return list(items[:n])
    return list(islice(items, n))
```

**Symptom: `reversed(rows)` raises `TypeError` after `rows` became a generator.** Cause:
`reversed` needs `__reversed__` or the sequence protocol, and a generator has neither. Fix: if the
input really is a stream, the newest-first view requires buffering — bound the buffer if you only
need the newest *n*.

```python
from collections import deque

newest_first = list(deque(rows, maxlen=n))[::-1]
```

**Symptom: an `islice(rows, stop=page_size)` call raises `TypeError`.** Cause: `islice` accepts
positional arguments only. Fix: `islice(rows, page_size)`.

## Interview questions

**★ Why doesn't `islice` accept negative indices, and how do you get the last n items of an
iterator?**
A negative index is relative to the end, and an iterator's length is unknown until it is
exhausted — there is no end to count back from while you are still in the middle. So `islice`
raises `ValueError` rather than silently buffering the whole stream. For the last *n*, consume the
stream into `deque(iterable, maxlen=n)` — the itertools `tail` recipe — which keeps only *n* items
in memory while it walks. For everything except the last *n*, keep a sliding buffer of *n* items
and yield from its front as new items arrive. With a sequence, you know the length: just slice.

**Why does `islice(xs, 2.5)` raise `ValueError` when `xs[:2.5]` raises `TypeError`?**
Because of how `islice_new` converts its arguments: it calls `PyNumber_AsSsize_t`, and when that
fails — a float, a string, a value above `sys.maxsize` — it clears whatever was raised and raises
its own `ValueError` saying the argument must be `None` or an integer in `0 <= x <= sys.maxsize`.
A list slice converts through `_PyEval_SliceIndex`, which raises `TypeError` for a non-integer and
clamps an oversized integer instead of rejecting it. Same idea, two error types: code that
validates bounds should convert them to `int` itself rather than rely on either exception.

**How much memory does "the last n lines of a file" need, and how much time?**
Memory proportional to *n*, time proportional to the whole file. A `deque` with `maxlen=n`
discards its oldest item on every append once full, so it never holds more than *n* lines; but the
only way to know which lines are last is to read to the end, so every line is read once. That is
the stream trade-off — `s[-n:]` on a list is O(n) in both because the list already knows its end.

**How do you write `s[:-n]` for a stream, and why is the stream version safer than the slice?**
Keep a window of the first *n* items; for every further item, append it and yield the window's
oldest. When the input ends, the window holds exactly the last *n*, which are never yielded. It is
safer because it has no `-0` problem: with `n = 0` the window is empty and every item passes
through, whereas `s[:-0]` is `s[:0]`, the empty sequence.

---

← Prev: [07 · itertools.islice and iterators](07-islice-and-iterators.md) · [Topic index](README.md)
