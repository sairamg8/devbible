---
title: "`zip` idioms and the neighbours: transposing, `pairwise`, `islice`, `batched`"
sidebar_label: "2b · `zip` idioms and neighbours"
sidebar_position: 82
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09 against the Python 3.14 Library Reference
> [`zip()`](https://docs.python.org/3.14/library/functions.html#zip)
> and [`itertools`](https://docs.python.org/3.14/library/itertools.html)
> (`zip_longest`, `pairwise`, `islice`, `batched`, `tee`),
> and [`collections.deque`](https://docs.python.org/3.14/library/collections.html#collections.deque).
> Target: **CPython 3.14**.

**Three `zip` shapes come up often enough to be worth memorising — building a
dict from parallel sequences, transposing a table with `zip(*rows)`, and walking
a sequence against itself. The third of those has been obsolete since 3.10, when
`itertools.pairwise` arrived and did it in one pass on any iterable. Alongside
them sit `islice` and `batched`, which between them delete the remaining reasons
to compute indices by hand inside a loop.**

## The three `zip` idioms

```python
# 1. build a dict from parallel sequences
record = dict(zip(headers, row, strict=True))

# 2. transpose — zip(*rows) turns rows into columns
rows = [(1, 2, 3), (4, 5, 6)]
list(zip(*rows))                 # [(1, 4), (2, 5), (3, 6)]

# 3. walk a sequence against itself, offset by one
list(zip(xs, xs[1:]))            # consecutive pairs — superseded by pairwise
```

**The dict idiom** is how you turn a CSV header row plus a data row into a
record, and `strict=True` is doing real work there: a row with the wrong number
of fields is exactly the malformed input you want to hear about, and the default
`zip` would quietly build a short record instead.

**The transpose idiom** unpacks the rows as separate arguments, so `zip` pairs
the first element of each, then the second, and so on. Its sharp edge is that it
is still `zip`: a ragged table transposes to a rectangle the width of the
shortest row and loses the rest without complaint. `zip(*rows, strict=True)` is
the safe spelling. Note also that `zip(*rows)` materialises every row as an
argument, so it is not usable on a lazily-read file of a million lines.

## `pairwise` replaced the third idiom

From the docs: *"Return successive overlapping pairs taken from the input
iterable. The number of 2-tuples in the output iterator will be one fewer than
the number of inputs. It will be empty if the input iterable has fewer than two
values."* Added in 3.10.

```python
from itertools import pairwise

for prev, cur in pairwise(readings):
    if cur.ts < prev.ts:
        raise ValueError("readings are not sorted by timestamp")

gaps = [b - a for a, b in pairwise(timestamps)]
```

Why it beats `zip(xs, xs[1:])`:

| | `zip(xs, xs[1:])` | `pairwise(xs)` |
|---|---|---|
| Works on a generator | No — slicing needs a sequence | Yes |
| Copies | Yes, `xs[1:]` is a new list | No |
| Passes over the data | Two | One |
| Empty input | Fine | Fine — yields nothing |
| One-element input | Yields nothing | Yields nothing |

The documented equivalent shows how it holds only one item of state:

```python
def pairwise(iterable):
    # pairwise('ABCDEFG') → AB BC CD DE EF FG
    iterator = iter(iterable)
    a = next(iterator, None)
    for b in iterator:
        yield a, b
        a = b
```

That `next(iterator, None)` is the same defaulted-`next` discipline as
everywhere else: the stdlib does not write a bare `next` either.

## `islice`: slicing for things you cannot slice

```python
from itertools import islice

for row in islice(rows, 10):            # first 10, works on any iterable
    ...
for row in islice(rows, 100, 200):      # a window, without materialising
    ...
for row in islice(rows, 0, None, 2):    # every other item
    ...
```

The docs: it *"works like sequence slicing but does not support negative values
for start, stop, or step"*. It cannot count from the end, because it does not
know where the end is — that is the price of working on an unbounded stream.

The two things `islice` is genuinely for: taking a bounded prefix of a generator
without materialising it, and skipping a header without a flag variable. The
thing it is **not** for is "the last N", where the answer is:

```python
from collections import deque
last_five = deque(rows, maxlen=5)       # keeps only the tail, in one pass
```

Note that `islice` **consumes** from the underlying iterator. Two successive
`islice(gen, 10)` calls give you items 1–10 and then 11–20, not the same ten
twice — which is usually what you want and occasionally a surprise.

## `batched`: fixed-size chunks, 3.12+

```python
from itertools import batched

for chunk in batched(items, 500):
    bulk_insert(chunk)                  # 500 rows per round trip
```

*"Batch data from the iterable into tuples of length n. The last batch may be
shorter than n."* Added in 3.12; 3.13 added `strict`, which *"will raise a
ValueError if the final batch is shorter than n"*.

That `strict` is the same design decision as `zip`'s: forgiving by default, loud
on request, because the silent behaviour was shown to hide real bugs. Use it
when a short final batch means the input was truncated rather than simply
finite — decoding fixed-width records, for instance.

Before 3.12 this was written as an `islice` loop, and you will still see it:

```python
it = iter(items)
while chunk := tuple(islice(it, 500)):      # note: truthiness, and it is safe
    bulk_insert(chunk)                      # here because tuple() gives () at end
```

That one is a legitimate `while ... :=` because an empty tuple is the only falsy
value `tuple(islice(...))` can produce — the general warning about
[truthiness in a walrus loop](../05-truthiness/05-the-walrus-operator.md) still
applies to the cases where it is not.

## Gotchas

**Symptom — transposing a table with `zip(*rows)` silently drops columns.**
Cause: it is `zip`, so it truncates to the shortest row and a ragged table
becomes a rectangle. Fix: `zip(*rows, strict=True)`, or validate row widths
before transposing.

**Symptom — `zip(*rows)` uses enormous memory on a large file.** Cause:
unpacking with `*` materialises every row as a separate argument, so the whole
input is in memory at once regardless of how lazily it was read. Fix: transpose
in chunks, or restructure so you never need the transpose.

**Symptom — `dict(zip(headers, row))` produces a record missing its last
fields, and no error.** Cause: the data row is shorter than the header row and
`zip` truncated. A malformed CSV line is exactly the case you want to catch.
Fix: `strict=True`.

**Symptom — `zip(xs, xs[1:])` raises `TypeError` after someone changes `xs` to a
generator.** Cause: slicing requires a sequence. Fix: `itertools.pairwise(xs)`,
which works on any iterable, in one pass, without a copy.

**Symptom — `pairwise` on a one-element list yields nothing and a downstream
`max()` raises `ValueError: max() arg is an empty sequence`.** Cause: `pairwise`
produces one fewer item than its input, so a single element gives zero pairs.
Fix: this is documented behaviour — guard the downstream aggregate with a
default (`max(gaps, default=0)`).

**Symptom — `islice(rows, -5)` raises.** Cause: `islice` does not support
negative start, stop or step — it cannot count from the end of an iterable whose
length it does not know. Fix: `collections.deque(rows, maxlen=5)` for the last
five, or materialise and slice.

**Symptom — two `islice(gen, 10)` calls return different items.** Cause:
`islice` consumes from the underlying iterator, so the second call continues
where the first stopped. Fix: this is correct for streaming; materialise the
first slice into a list if you need it twice.

**Symptom — `batched` silently returns a short final chunk that downstream code
treats as a full record.** Cause: the last batch may be shorter than `n` by
design. Fix: `strict=True` (3.13+) when a short final batch means truncated
input, or check `len(chunk)` explicitly.

**Symptom — a `while chunk := tuple(islice(it, n)):` loop never terminates.**
Cause: `it` is not an iterator — `islice` restarts from the beginning of a
re-iterable sequence every time. Fix: `it = iter(items)` once, outside the loop.
The bug is that `islice(list, n)` is perfectly legal and simply never advances.

## Interview questions

**★ Q: How do you transpose a list of rows?**
`list(zip(*rows))` — unpacking makes each row a separate argument, so `zip`
pairs them positionally. Add `strict=True`, because it inherits `zip`'s silent
truncation and a ragged table would lose data. It is also not suitable for a
lazily-read large file, since `*` materialises everything.

**★ Q: How do you get consecutive pairs from a sequence?**
`itertools.pairwise(xs)` (3.10+). The old `zip(xs, xs[1:])` works only on
sliceable sequences, copies, and makes two passes; `pairwise` works on any
iterable in one pass. It yields one fewer item than the input and nothing at all
for fewer than two items.

**★ Q: You need the first 10 items of a generator. What do you write?**
`itertools.islice(gen, 10)`. Slicing does not work on a generator, and
`list(gen)[:10]` materialises everything first. Note `islice` does not accept
negative indices, so "the last 10" is a different tool —
`collections.deque(gen, maxlen=10)`, which keeps only the tail in one pass.

**Q: What is `itertools.batched` and how does it relate to `zip`'s `strict`?**
It splits an iterable into tuples of length `n` (3.12+), and *"the last batch may
be shorter than n"*. Python 3.13 added `strict=True`, which raises `ValueError`
if the final batch is short. It is the same design stance as `zip`: forgiving by
default, strict when you ask — because both silent behaviours were shown to hide
real bugs.

**Q: Why can't `islice` take a negative index?**
Because it works on arbitrary iterables, including infinite ones, and it has no
way to know where the end is without consuming everything. Sequence slicing can
count backwards because a sequence knows its length; an iterator does not.

**Q: How do you read the last N lines of a file without loading it?**
`collections.deque(f, maxlen=N)`. The deque discards from the left as it fills,
so memory stays bounded at N lines regardless of file size, in a single pass.

**Q: What is the pre-3.12 idiom for fixed-size batching, and why is it safe to write it with a walrus?**
`it = iter(items)` then `while chunk := tuple(islice(it, n)):`. It is safe
because `tuple(islice(...))` can only ever be falsy by being empty, which
happens exactly at exhaustion — unlike the general `while x := f():` shape,
where a legitimately falsy item ends the loop early. The real trap in this idiom
is forgetting the `iter()`, which makes it loop forever on a list.

---

← Prev: [`enumerate` and `zip`](02-enumerate-and-zip.md) · Index: [Control flow](README.md) · Next → [`for`/`else` and `while`/`else`](03-for-else-and-while-else.md)
