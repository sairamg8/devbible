---
title: "The object islice returns is an ordinary iterator — one pass, no length, always truthy — and the generator it stops early is suspended, not finished: its with block stays open until someone closes it, and since 3.14 the only way to read the stream twice is tee or a list"
sidebar_label: "07d · islice lifetimes"
sidebar_position: 12
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-10 for **Python 3.14.7** against the 3.14 documentation —
> [Truth value testing](https://docs.python.org/3.14/library/stdtypes.html#truth-value-testing),
> [Yield expressions](https://docs.python.org/3.14/reference/expressions.html#yieldexpr) and
> [`generator.close`](https://docs.python.org/3.14/reference/expressions.html#generator.close),
> [`itertools.tee`](https://docs.python.org/3.14/library/itertools.html#itertools.tee),
> [What's New in 3.14](https://docs.python.org/3.14/whatsnew/3.14.html) (itertools); CPython 3.14
> [`Modules/itertoolsmodule.c`](https://github.com/python/cpython/blob/3.14/Modules/itertoolsmodule.c)
> (`islice_next`) for when `islice` releases its input — implementation detail.
> Documentation-verified — **no sandbox run, no program output**.

**An `islice` hands back a lazy iterator, and code written against lists keeps treating it like
one: it counts it and then iterates it (the second pass is empty), tests it with `if page:` (always
true), or calls `len()` on it (`TypeError`). The generator underneath has a lifetime problem of its
own. Stopping it after five rows does not finish it — it is paused at its `yield`, inside whatever
`with` block opened the file or the cursor, and it stays there until it is closed or finalized.
In CPython that can be immediate or never, depending on who else holds a reference. Finally,
reading a stream twice: 3.14 removed `copy` and `pickle` support from itertools iterators, which
leaves `tee` — with a buffer and a rule of its own — or a list.
[07c](07c-islice-in-practice.md) is the recipes and the cost of `islice` on a list.**

## An `islice` is an iterator: one pass, no length, always truthy

The object `islice` returns is an iterator like any other — iterate it once and it is exhausted.
It defines neither `__len__` nor `__bool__`, and the truth-testing rule is explicit about what that
means:

> *"By default, an object is considered true unless its class defines either a `__bool__` method
> that returns `False` or a `__len__` method that returns zero, when called with the object."* —
> [Truth value testing](https://docs.python.org/3.14/library/stdtypes.html#truth-value-testing)

So `if page:` on an `islice` is always true, even when the input is already exhausted, and
`len(page)` raises `TypeError`. Anything that needs to ask "how many" or "any at all" needs the
items materialised first — `page = list(islice(rows, 10))` — which for a bounded page is cheap.

## Stopping a generator early leaves it running

A generator stopped part-way is *suspended*, not finished. If it was reading inside a `with`
block, the file is still open; if it held a database cursor, the cursor is still open. The language
reference says when it finally gets cleaned up:

> *"If the generator is not resumed before it is finalized (by reaching a zero reference count or
> by being garbage collected), the generator-iterator's `close` method will be called, allowing any
> pending `finally` clauses to execute."* —
> [Yield expressions](https://docs.python.org/3.14/reference/expressions.html#yieldexpr)

In CPython, when `islice` holds the *only* reference, reaching *stop* drops it
(`Py_CLEAR(lz->it)` in `islice_next`) and the generator is finalized at once. That is reference
counting — an implementation detail — and it does not apply when your code keeps its own
reference, which it usually does. Close it yourself: `close()` *"Raises a `GeneratorExit` exception
at the point where the generator function was paused"*, so the `with` block exits and the file
closes.

```python
from itertools import islice


def read_rows(path):
    with open(path, encoding="utf-8") as source:
        for line in source:
            yield line.rstrip("\n").split(",")


def preview(path, n=5):
    rows = read_rows(path)
    try:
        return list(islice(rows, n))
    finally:
        rows.close()        # GeneratorExit at the paused yield: the with block closes the file
```

## Copying an iterator's position

> *"Remove support for copy, deepcopy, and pickle operations from `itertools` iterators. These have
> emitted a `DeprecationWarning` since Python 3.12."* —
> [What's New in Python 3.14](https://docs.python.org/3.14/whatsnew/3.14.html)

So `copy.copy(some_islice)` — which "worked" with a warning on 3.12 and 3.13 — fails on 3.14. The
documented way to read a stream twice is `tee`: *"Return *n* independent iterators from a single
iterable."* Its costs are documented too — *"`tee` iterators are not threadsafe"* and *"This
itertool may require significant auxiliary storage (depending on how much temporary data needs to
be stored). In general, if one iterator uses most or all of the data before another iterator
starts, it is faster to use `list` instead of `tee`."*

The documentation's rough equivalent of `tee` also shows a rule it does not state in words: each
tee iterator pulls from the original iterator only when it runs past the shared buffer. An item
you pull from the *original* after calling `tee` never enters that buffer, so the tee iterators
never see it. Once you have called `tee`, use only what it returned.

## Gotchas

**★ Symptom: an "empty result" branch never runs, and the page renders with no rows.** Cause:
`if not page:` on an `islice` object is always false, because an iterator with no `__len__` or
`__bool__` is truthy. Fix: materialise the page first.

```python
page = list(islice(rows, page_size))
if not page:
    return render_empty()
```

**★ Symptom: the log says "exporting 10 rows" and the export file is empty.** Cause: the code
counted the page with `sum(1 for _ in page)` and then iterated `page` again — the `islice` was
exhausted by the count. Fix: a list, read as often as needed.

```python
page = list(islice(rows, 10))
logger.info("exporting %d rows", len(page))
write_export(page)
```

**★ Symptom: `TypeError: object of type 'itertools.islice' has no len()` from a "showing N rows"
label.** Cause: `len()` goes through `PyObject_Size`, which finds no length slot on an iterator and
raises from the format `object of type '%.200s' has no len()` in `Objects/abstract.c` — an
iterator cannot know how many items it has left without consuming them. Fix: materialise the
bounded page and take the length of the list.

```python
page = list(islice(rows, page_size))
label = f"showing {len(page)} rows"
```

**★ Symptom: "too many open files" — or a database pool running dry — in a service that previews
the first rows of uploaded files.** Cause: each preview stops a reading generator after *n* rows;
the caller keeps a reference, so the generator sits paused inside `with open(…)` until it is
collected. Fix: close the generator when you are done with it.

```python
rows = read_rows(path)
try:
    head = list(islice(rows, 5))
finally:
    rows.close()
```

**Symptom: code that checkpointed an iterator with `copy.copy` fails after the upgrade to 3.14.**
Cause: 3.14 removed copy, deepcopy and pickle support from itertools iterators, after two releases
of `DeprecationWarning`. Fix: split the stream with `tee` — or, if one reader finishes before the
other starts, a list.

```python
from itertools import tee

for_validation, for_import = tee(records, 2)
```

**Symptom: after `a, b = tee(rows)`, both `a` and `b` are missing the rows a logging call read
from `rows`.** Cause: items pulled from the original iterator after `tee` never reach the tee
buffer. Fix: read only through the tee iterators.

```python
rows, audit = tee(rows)
log_first(next(audit))
```

**Symptom: memory climbs steadily while two `tee` iterators are in use.** Cause: one iterator runs
far ahead, so every item between them is held in tee's buffer. Fix: the documentation's advice —
if one consumer reads most of the data before the other starts, use a list.

```python
records = list(records)
validate(records)
load(records)
```

## Interview questions

**★ What happens to a generator's `with` block when you stop consuming it through `islice`?**
Nothing, yet. The generator is paused at its `yield`, still inside the block. It is cleaned up when
it is finalized — its reference count reaches zero or the garbage collector reclaims it — at which
point `close()` raises `GeneratorExit` at the paused `yield` and the `with` exits. In CPython that
happens immediately if `islice` held the only reference, but code usually holds its own, so the
resource stays open indefinitely. Call `close()` in a `finally`, or structure the generator so the
caller owns the resource.

**Why is `if islice(rows, 10):` always true?**
Because an object is true unless its class defines `__bool__` returning `False` or `__len__`
returning zero, and an iterator defines neither — it cannot know whether it has items without
consuming one. Materialise with `list()` first, or pull the first item with `next(it, sentinel)`
and chain it back.

**How do you read an iterator twice in Python 3.14?**
Either materialise it into a list, or split it with `itertools.tee`, which returns independent
iterators sharing a buffer of the items between the slowest and fastest reader. Copying the
iterator with `copy.copy` no longer works: 3.14 removed copy, deepcopy and pickle support from
itertools iterators. Prefer a list when one reader will finish before the other starts, and never
touch the original iterator after calling `tee`.

---

← Prev: [07c · islice in practice](07c-islice-in-practice.md) · [Topic index](README.md)
