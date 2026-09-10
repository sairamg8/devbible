---
title: "An iterator has no positions, so it cannot be sliced — itertools.islice imitates a slice by walking from the front and discarding what it skips, which means it consumes the iterator it was given, stops exactly at stop, and refuses negative numbers because a stream has no end to count back from"
sidebar_label: "07 · itertools.islice and iterators"
sidebar_position: 9
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-10 for **Python 3.14.7** against the 3.14 documentation —
> [`itertools.islice`](https://docs.python.org/3.14/library/itertools.html#itertools.islice),
> [`itertools.takewhile`](https://docs.python.org/3.14/library/itertools.html#itertools.takewhile),
> [`itertools.tee`](https://docs.python.org/3.14/library/itertools.html#itertools.tee),
> [Itertools recipes](https://docs.python.org/3.14/library/itertools.html#itertools-recipes),
> [Glossary: iterator](https://docs.python.org/3.14/glossary.html#term-iterator),
> [`zip`](https://docs.python.org/3.14/library/functions.html#zip); CPython 3.14
> [`Modules/itertoolsmodule.c`](https://github.com/python/cpython/blob/3.14/Modules/itertoolsmodule.c)
> (`islice_new`, `islice_next`) and
> [`Objects/abstract.c`](https://github.com/python/cpython/blob/3.14/Objects/abstract.c) for the
> mechanism and error text, marked as implementation detail where the docs are silent.
> Documentation-verified — **no sandbox run, no program output**.

**Slicing needs positions: `s[1000:1010]` jumps straight to index 1000 because a sequence can
hand over any element by number. A generator, a file, a `map`, a `zip`, a `csv.reader` or a
database cursor has no positions — only "the next one" — so subscripting it raises `TypeError`.
`itertools.islice` gives those streams slice-like syntax by doing the only thing possible: it
calls `next()` and throws away what it skips. Everything surprising about it follows from that.
It advances the iterator you pass it, so the same call gives successive chunks of a stream but
the same first items of a list forever. It walks from the front, so on a list it costs the
*stop* position, not the slice length. It stops exactly at *stop* without pulling one more item,
which is what makes chunking loops lossless. And it cannot take negative numbers, because
counting from the end requires having already seen the end. This page is the mechanism;
[07b](07b-islice-bounds.md) is the bounds it refuses.**

The recipes built on `islice`, its cost on a list, and the lifetime traps of a half-consumed
generator are in [07c · islice in practice](07c-islice-in-practice.md) and
[07d · islice lifetimes](07d-islice-lifetimes.md).

## An iterator has no positions

> *"An object representing a stream of data.  Repeated calls to the iterator's `__next__` method
> (or passing it to the built-in function `next`) return successive items in the stream.  When
> no more data are available a `StopIteration` exception is raised instead."* —
> [Glossary: iterator](https://docs.python.org/3.14/glossary.html#term-iterator)

Subscription goes through `PyObject_GetItem` in `Objects/abstract.c`. An object with neither a
mapping subscript nor a sequence item slot gets `TypeError` built from the format
`'%.200s' object is not subscriptable` — so `events[:10]` on a generator fails with
`'generator' object is not subscriptable`. The same happens for `map`, `filter`, `zip`,
`enumerate`, `reversed`, the dict views (`d.keys()[:3]` fails) and every file object. None of
them is broken; there is simply no "item 7" to ask for without producing items 0 to 6 first.

## What `islice` promises

> *"Make an iterator that returns selected elements from the iterable. Works like sequence
> slicing but does not support negative values for *start*, *stop*, or *step*."*
> *"If *start* is zero or `None`, iteration starts at zero.  Otherwise, elements from the
> iterable are skipped until *start* is reached."*
> *"If *stop* is `None`, iteration continues until the input is exhausted, if at all.
> Otherwise, it stops at the specified position."*
> *"If *step* is `None`, the step defaults to one.  Elements are returned consecutively unless
> *step* is set higher than one which results in items being skipped."* —
> [`itertools.islice`](https://docs.python.org/3.14/library/itertools.html#itertools.islice)

Two signatures, like `range`: `islice(iterable, stop)` and `islice(iterable, start, stop[, step])`.
The documentation's *"roughly equivalent"* Python makes the walk explicit — note `slice(*args)`
reusing the built-in object from [04](04-slice-objects.md), and the `zip` that pairs a counter
with the input from its first element:

```python
def islice(iterable, *args):
    # islice('ABCDEFG', 2) → A B
    # islice('ABCDEFG', 2, 4) → C D
    # islice('ABCDEFG', 2, None) → C D E F G
    # islice('ABCDEFG', 0, None, 2) → A C E G

    s = slice(*args)
    start = 0 if s.start is None else s.start
    stop = s.stop
    step = 1 if s.step is None else s.step
    if start < 0 or (stop is not None and stop < 0) or step <= 0:
        raise ValueError

    indices = count() if stop is None else range(max(start, stop))
    next_i = start
    for i, element in zip(indices, iterable):
        if i == next_i:
            yield element
            next_i += step
```

So `islice` differs from a slice in three ways that matter: it returns a lazy iterator, not a
sequence; it reaches *start* by consuming every element before it; and it accepts only
non-negative numbers.

## It consumes what it was given

`islice_new` in `Modules/itertoolsmodule.c` calls `PyObject_GetIter(seq)` on its argument and
keeps the result. For a container that is a *fresh* iterator; for an iterator it is the iterator
itself, because an iterator's `__iter__` returns `self`. The glossary states the consequence:

> *"A container object (such as a `list`) produces a fresh new iterator each time you pass it to
> the `iter` function or use it in a `for` loop.  Attempting this with an iterator will just
> return the same exhausted iterator object used in the previous iteration pass, making it
> appear like an empty container."*

```python
from itertools import islice

rows = ["r0", "r1", "r2", "r3", "r4"]
assert list(islice(rows, 2)) == ["r0", "r1"]
assert list(islice(rows, 2)) == ["r0", "r1"]     # a list: a fresh iterator every call

stream = iter(rows)
assert list(islice(stream, 2)) == ["r0", "r1"]
assert list(islice(stream, 2)) == ["r2", "r3"]   # an iterator: the same stream, advanced
```

That second behaviour is the useful one. A file object is an iterator over its lines, so a header
can be read with `islice` and the loop that follows resumes after it:

```python
from itertools import islice


def read_report(path):
    with open(path, encoding="utf-8") as report:
        preamble = [line.rstrip("\n") for line in islice(report, 3)]   # lines 0-2
        body = [line.rstrip("\n") for line in report]                  # resumes at line 3
    return preamble, body
```

## Exactly how far it advances

> *"If the input is an iterator, then fully consuming the *islice* advances the input iterator by
> `max(start, stop)` steps regardless of the *step* value."*

`islice_next` shows where each of those steps is taken — implementation detail, but it is what the
documented sentence means in practice:

- **Nothing happens at construction.** The skip to *start* runs inside the first `next()` call
  (`while (lz->cnt < lz->next)` pulls and discards).
- **The element at *stop* is never pulled.** The check `lz->cnt >= stop` comes *before* the next
  `iternext` call, so after `list(islice(stream, 3))` the stream's next item is the fourth. This
  is why a loop of `islice(stream, n)` calls loses nothing between chunks.
- **With a step, the gaps are consumed.** Items between yields are pulled and discarded, and the
  call that ends the iteration pulls whatever remains up to *stop* — hence `max(start, stop)`.
- **Stopping early advances less.** If you take one item and walk away, only the items up to that
  one have been pulled.
- **A short source stops it silently.** It ends when the input is exhausted, raising nothing —
  the same forgiveness as a slice past the end ([03](03-out-of-range-never-raises.md)). On
  finishing, CPython drops its reference to the input (`Py_CLEAR(lz->it)`).

```python
from itertools import islice

stream = iter(range(20))
assert list(islice(stream, 0, 8, 3)) == [0, 3, 6]
assert next(stream) == 8          # 7 was pulled and discarded on the call that ended the islice

stream = iter(range(20))
assert next(islice(stream, 5, 10)) == 5
assert next(stream) == 6          # only 0-5 were pulled; 6-9 are still in the stream

stream = iter(range(20))
assert list(islice(stream, 3)) == [0, 1, 2]
assert next(stream) == 3          # the element at stop was never touched
```

The last property is the contrast with `takewhile`, which must pull an element to learn it fails
the predicate: *"Note, the element that first fails the predicate condition is consumed from the
input iterator and there is no way to access it."* —
[`itertools.takewhile`](https://docs.python.org/3.14/library/itertools.html#itertools.takewhile).

## What it will not take

`islice` accepts only `None` or non-negative integers, because a negative position means "counted
from the end" and a stream has no known end. The rewrites for `s[-n:]` and `s[:-n]` on a stream, and
the `ValueError` that replaces a slice's `TypeError` for a bad bound, are
[07b · islice bounds and negatives](07b-islice-bounds.md).

## Gotchas

**★ Symptom: `TypeError: 'generator' object is not subscriptable` after a function that returned
a list was changed to `yield`.** Cause: callers still write `fetch_events()[:10]`; a generator has
no positions. Fix: take the prefix by walking it.

```python
from itertools import islice

first_page = list(islice(fetch_events(), 10))
```

**★ Symptom: a batching loop never ends, and every batch is the first 100 rows.** Cause: `rows` is
a list, so each `islice(rows, 100)` starts a fresh iterator at index 0. Fix: make one iterator
before the loop — or on 3.12 and later use `itertools.batched` ([07c](07c-islice-in-practice.md)).

```python
iterator = iter(rows)
while batch := list(islice(iterator, 100)):
    insert_many(batch)
```

**★ Symptom: an importer skips the first record of every file after an "is the file empty?"
check was added.** Cause: `if not list(islice(records, 1)): return` pulled the first record out of
the stream to test it, and nothing puts it back. Fix: keep the pulled item and chain it back on —
or make the stream peekable with the documented `tee(iterator, 1)` idiom.

```python
from itertools import chain

_EMPTY = object()
first = next(records, _EMPTY)
if first is _EMPTY:
    return
for record in chain([first], records):
    load(record)
```

**Symptom: pairing alternate lines of a key/value file produces the wrong pairs and loses half the
data.** Cause: `zip(islice(lines, 0, None, 2), islice(lines, 1, None, 2))` — both `islice` objects
pull from the *same* iterator, each discarding items the other one wanted. Tracing `islice_next`:
the first pair is lines 0 and 2, the second lines 4 and 6. Fix: zip the one iterator with itself —
the `zip` documentation guarantees *"The left-to-right evaluation order of the iterables"* for
exactly this idiom — or slice if `lines` is a list.

```python
stream = iter(lines)
pairs = dict(zip(stream, stream, strict=True))    # (line 0, line 1), (line 2, line 3), …

pairs = dict(zip(lines[0::2], lines[1::2], strict=True))   # when lines is a list
```

**Symptom: after sampling every tenth line of a file with `islice(lines, 0, 1000, 10)`, the main
loop starts at line 1000 and lines 1–999 are never processed.** Cause: the step's gaps are pulled
and discarded; `islice` advanced the file by `max(start, stop)`. Fix: sample and process in one
pass.

```python
sample = []
for number, line in enumerate(lines):
    if number < 1000 and number % 10 == 0:
        sample.append(line)
    process(line)
```

**Symptom: a header parser rewritten from `islice(lines, 3)` to `takewhile(is_comment, lines)`
silently drops the first data line.** Cause: `takewhile` consumes the element that fails the
predicate; `islice` never pulls past *stop*. Fix: stop with a `for` loop and push the boundary line
back.

```python
from itertools import chain

header = []
for line in lines:
    if not is_comment(line):
        body = chain([line], lines)
        break
    header.append(line)
else:
    body = iter(())
```

## Interview questions

**★ Why can't you slice a generator, and what does `islice` do instead?**
A slice asks for elements by position, and a generator has no positions — it can only produce the
next value, and has no `__getitem__`, so subscription raises `TypeError`. `islice` gets the same
selection by iteration: it calls `next()` on the input, discards everything before *start*, yields
every *step*-th item after that, and stops at *stop*. The price is that it must consume every
element up to the last one it yields, it returns an iterator rather than a sequence, and it
advances the input, which the caller may or may not want.

**★ How far does `islice` advance the iterator it is given?**
Fully consumed, by `max(start, stop)` steps whatever the step is — the documentation says so
explicitly. Three details sit behind that: nothing is consumed until the first `next()`; the
element *at* stop is never pulled, so a following `next(stream)` returns it; and with a step, the
skipped items and the tail up to *stop* are pulled and discarded. Taken only partially — one
`next()` on `islice(stream, 5, 10)` — it has consumed just the items up to the one returned.

**What is the difference between calling `islice(data, 3)` twice on a list and on an iterator?**
`islice` calls `iter()` on its argument. A list returns a new iterator at index 0 each time, so
both calls give the first three elements. An iterator returns itself, so the second call continues
where the first stopped and gives the next three. That is why a chunking loop over a list must call
`iter()` once first — otherwise it repeats the first chunk forever.

**Why does a loop of `islice(stream, n)` calls not lose the item between chunks, when a loop of
`takewhile` calls does?**
`islice` knows where to stop by counting, so it can stop *before* pulling the element at *stop*.
`takewhile` knows where to stop only by testing an element, so it must pull the first failing one,
and there is no way to put an item back into an iterator. The lost boundary element is the
documented cost of predicate-based stopping; the fix is a manual loop that keeps the boundary item
and chains it back in front of the remaining stream.

---

← Prev: [06 · Slices that do not copy](06-slices-that-do-not-copy.md) · [Topic index](README.md) · Next →: [07b · islice bounds and negatives](07b-islice-bounds.md)
