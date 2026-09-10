---
title: "In practice islice is the building block of take, nth, consume, sliding windows and batching — and three things about it bite in production: on a list it walks instead of jumping, the islice itself is a single-use iterator that is always truthy, and a generator it stops early is left suspended with its files and cursors still open"
sidebar_label: "07c · islice in practice"
sidebar_position: 11
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-10 for **Python 3.14.7** against the 3.14 documentation —
> [Itertools recipes](https://docs.python.org/3.14/library/itertools.html#itertools-recipes),
> [`itertools.islice`](https://docs.python.org/3.14/library/itertools.html#itertools.islice),
> [`itertools.batched`](https://docs.python.org/3.14/library/itertools.html#itertools.batched),
> [`zip`](https://docs.python.org/3.14/library/functions.html#zip),
> [Time complexity of operations on built-in types](https://docs.python.org/3.14/library/time-complexity.html),
> [`slice.indices`](https://docs.python.org/3.14/reference/datamodel.html#slice.indices).
> Documentation-verified — **no sandbox run, no program output**.

**[07](07-islice-and-iterators.md) established what `islice` does to an iterator: it walks,
discards what it skips, and never pulls the element at *stop*. The itertools documentation builds
half its recipes on exactly those properties — `take`, `nth`, `consume`, `sliding_window` and the
reference implementation of `batched` are each a line or two of `islice`. The same properties
produce three production traps. On a list, `islice(items, 100_000, 100_010)` walks a hundred
thousand elements where `items[100_000:100_010]` jumps; the right no-copy tool for a sequence is a
`range` of indices. The `islice` object is itself an iterator, so it can be read once, has no
length, and is truthy even when it will yield nothing. And stopping a generator early does not
finish it: it stays paused inside its `with` block, holding the file or the connection, until
something closes it. This page is the recipes and the cost on a list; the iterator and generator
lifetimes are [07d](07d-islice-lifetimes.md), and [07b](07b-islice-bounds.md) covers the bounds
`islice` refuses.**

## The recipes are `islice` plus one idea each

From [Itertools recipes](https://docs.python.org/3.14/library/itertools.html#itertools-recipes),
verbatim:

```python
def take(n, iterable):
    "Return first n items of the iterable as a list."
    return list(islice(iterable, n))

def consume(iterator, n=None):
    "Advance the iterator n-steps ahead. If n is None, consume entirely."
    # Use functions that consume iterators at C speed.
    if n is None:
        deque(iterator, maxlen=0)
    else:
        next(islice(iterator, n, n), None)

def nth(iterable, n, default=None):
    "Returns the nth item or a default value."
    return next(islice(iterable, n, None), default)

def sliding_window(iterable, n):
    "Collect data into overlapping fixed-length chunks or blocks."
    # sliding_window('ABCDEFG', 3) → ABC BCD CDE DEF EFG
    iterator = iter(iterable)
    window = deque(islice(iterator, n - 1), maxlen=n)
    for x in iterator:
        window.append(x)
        yield tuple(window)
```

Each one leans on a property from [07](07-islice-and-iterators.md):

- **`consume`** works because the skip to *start* runs before the stop check. `islice(it, n, n)`
  can yield nothing, but its first `next()` still pulls and discards *n* items before discovering
  it is already at *stop*; `next(…, None)` swallows the `StopIteration`. `deque(iterator,
  maxlen=0)` is the "everything" case — a deque that keeps nothing.
- **`nth`** pulls *n + 1* items from an iterator: *n* skipped, one returned. Called on a list it
  consumes nothing of the list, and costs a walk of *n*.
- **`sliding_window`** primes a deque with *n − 1* items, then each new item pushes the oldest out
  because of `maxlen`. With fewer than *n* items in the input the loop body never runs, so it
  yields nothing at all — not one short window.

## Chunking a stream

The documentation's rough equivalent of `batched` is the chunking loop in its finished form:

```python
def batched(iterable, n, *, strict=False):
    # batched('ABCDEFG', 3) → ABC DEF G
    if n < 1:
        raise ValueError('n must be at least one')
    iterator = iter(iterable)
    while batch := tuple(islice(iterator, n)):
        if strict and len(batch) != n:
            raise ValueError('batched(): incomplete batch')
        yield batch
```

`iterator = iter(iterable)` is the line whose absence makes the hand-written version loop forever
on a list. `islice(iterator, n)` stopping *before* the next item is what makes consecutive batches
lossless. The real function: *"Batch data from the *iterable* into tuples of length *n*. The last
batch may be shorter than *n*."* · *"The input is consumed lazily, just enough to fill a batch."*
It was added in **3.12**, and *strict* in **3.13**.

The older idiom is documented under `zip`: *"The left-to-right evaluation order of the iterables is
guaranteed. This makes possible an idiom for clustering a data series into n-length groups using
`zip(*[iter(s)]*n, strict=True)`."* It repeats one iterator *n* times, so each tuple is *n*
consecutive calls. Without `strict=True`, `zip` *"stops when the shortest iterable is exhausted"*,
which here means a trailing partial group is dropped without a word.

```python
from itertools import batched

assert list(batched("ABCDEFG", 3)) == [("A", "B", "C"), ("D", "E", "F"), ("G",)]

stream = iter("ABCDEFG")
assert list(zip(stream, stream, stream)) == [("A", "B", "C"), ("D", "E", "F")]   # "G" is gone
```

Batching as a job — bulk inserts, API page limits, sequences that should stay lists — is in
**Slicing in real code** *(not written yet)*.

## On a sequence, `islice` walks

A list slice costs the length of the slice — the 3.14 cost table prices *"Get slice `l[i:j]`"* at
O(j - i) — because the list jumps to index *i*. `islice` has no jump: *"elements from the iterable
are skipped until *start* is reached"*, one `next()` at a time. So on a list, `islice(items,
start, stop)` costs *stop*, and paging deep into a large list with it gets slower with every page.

What `islice` saves on a list is the copy, not the walk. When you want to iterate part of a
sequence without copying it *and* without walking the prefix, iterate indices — and let
[`slice.indices`](04b-slice-indices.md) do the clamping, whose output is exactly `range`'s
arguments:

```python
def iter_slice(seq, start=None, stop=None, step=None):
    """Yield seq[start:stop:step] one element at a time: no copy, no walk of the prefix."""
    for index in range(*slice(start, stop, step).indices(len(seq))):
        yield seq[index]


data = list(range(10))
assert list(iter_slice(data, 2, 8, 3)) == data[2:8:3]
assert list(iter_slice(data, None, None, -3)) == data[::-3]     # negatives work: it is a slice
```

`iter_slice` reads `len(seq)` once, so a sequence that shrinks while it is being walked makes it
raise `IndexError` — the same rule as any index-based loop. For bytes, a `memoryview` slice is the
no-copy answer ([06](06-slices-that-do-not-copy.md)).

Where `islice` *is* the right tool on a container is a container with no positions to jump to.
A `dict` preserves insertion order but has no "entry 3", so the first *n* entries are a walk
either way — and `islice` avoids building the full list first:

```python
from itertools import islice

settings = {"host": "db", "port": 5432, "user": "app", "timeout": 30}
assert dict(islice(settings.items(), 2)) == {"host": "db", "port": 5432}
```

## Gotchas

**★ Symptom: an admin page that pages through an in-memory list of records gets slower the further
the user clicks.** Cause: `islice(records, offset, offset + size)` walks `offset` elements on every
request. Fix: slice the list — it jumps — or iterate indices if the copy matters.

```python
page = records[offset:offset + size]
```

**Symptom: `batched(rows, 500, strict=True)` raises `TypeError` in one environment only.** Cause:
*strict* was added in 3.13; a 3.12 interpreter rejects the keyword. Fix: require 3.13, or check
the last batch yourself.

```python
for batch in batched(rows, 500):
    if len(batch) != 500 and require_full_batches:
        raise ValueError(f"incomplete final batch of {len(batch)}")
    insert_many(batch)
```

**Symptom: `AttributeError: 'tuple' object has no attribute 'append'` inside a batch handler.**
Cause: `batched` yields tuples. Fix: convert when the handler needs a list.

```python
for batch in batched(rows, 500):
    insert_many(list(batch))
```

**Symptom: a moving average over the last 7 readings yields nothing for a sensor with 5
readings.** Cause: `sliding_window` yields only full windows; fewer than *n* items produce no
output at all. Fix: handle the short case explicitly.

```python
readings = list(readings)
windows = list(sliding_window(readings, 7)) or [tuple(readings)]
```

**Symptom: an export built with `zip(*[iter(rows)] * 3)` silently loses the last one or two
rows.** Cause: `zip` stops at the shortest input, so the trailing partial group is discarded.
Fix: `strict=True` to make it an error, or `batched` to keep the short group.

```python
groups = list(batched(rows, 3))
```

## Interview questions

**★ How do you split an arbitrary iterable into chunks of n items?**
On 3.12 and later, `itertools.batched(iterable, n)`, which yields tuples and makes the last one
short — with `strict=True` (3.13+) to make a short last batch an error. Before 3.12 the same thing
is a loop of `tuple(islice(iterator, n))` over one iterator created with `iter()` first; without
that call a list would yield its first chunk forever. It is lossless because `islice` stops before
pulling the item at *stop*. The `zip(*[iter(s)]*n)` idiom also works but drops a trailing partial
group unless `strict=True` is passed.

**★ Is `islice(big_list, a, b)` cheaper than `big_list[a:b]`?**
It avoids allocating a list of *b − a* references, but it is not cheaper in time: it walks from the
beginning, so it costs *b* steps where the slice costs *b − a*. For a small window near the front
the difference is nothing; deep into a large list `islice` is the slow choice. To iterate a window
of a sequence without copying and without the walk, iterate `range(*slice(a, b).indices(len(seq)))`
and index. `islice` is the right tool when the object has no positions — iterators, generators,
files, dicts.

**How do you get the nth item of an iterator, and what does that cost?**
`next(islice(iterable, n, None), default)` — the `nth` recipe. It pulls *n + 1* items from an
iterator (*n* discarded, one returned), so the iterator is left positioned after the item. On a
list it costs a walk of *n* but consumes nothing, since `islice` gets a fresh iterator; on a list
you would simply index instead.

---

← Prev: [07b · islice bounds and negatives](07b-islice-bounds.md) · [Topic index](README.md) · Next →: [07d · islice lifetimes](07d-islice-lifetimes.md)
