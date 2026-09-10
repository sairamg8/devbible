---
title: "Copying a tuple is free and everything that builds one costs the size of the result — so a tuple grown one `+` at a time is quadratic, `t * 3` repeats references rather than objects, and whether a tuple beats a list on speed or memory is a question the documentation declines to answer"
sidebar_label: "10b · What operations cost"
sidebar_position: 28
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-10 against the Python 3.14 library reference —
> [Time complexity of operations on built-in types](https://docs.python.org/3.14/library/time-complexity.html),
> [Common Sequence Operations](https://docs.python.org/3.14/library/stdtypes.html#common-sequence-operations)
> (notes on repetition and concatenation), [`sum`](https://docs.python.org/3.14/library/functions.html#sum)
> and [`collections.namedtuple`](https://docs.python.org/3.14/library/collections.html#collections.namedtuple);
> and CPython 3.14 [`Objects/tupleobject.c`](https://github.com/python/cpython/blob/3.14/Objects/tupleobject.c)
> (`tuple_hash`). Documentation-verified — **no sandbox run, no timings, no byte counts**.
> Version spine: **CPython 3.14**.

**Python 3.14's documentation now carries a cost table for the built-in types, and the tuple
section of it is short because a tuple can do so little: indexing and length are constant,
copying is constant because a copy is the same object, and every operation that produces a
tuple — slicing, `+`, `*` — costs the size of what it produces. The consequences are the
familiar immutable-sequence ones. A tuple built by repeated `+` is rebuilt in full every time,
which the documentation itself calls quadratic; `sum(parts, ())` is the same loop in disguise;
and `*` copies references, not objects, so a tuple of three "empty lists" made with `*` holds
one list three times. What the documentation does *not* give — and this topic will not invent —
is any figure for how much faster or smaller a tuple is than a list.**

## The documented table

> *"This page documents the time complexity of various operations on built-in types in
> CPython. Other Python implementations may have different performance characteristics.
> Additionally, the listed costs assume exact built-in types, as instances of subclasses may
> have different costs."*

> *"A tuple is an immutable sequence. Because a tuple can never change, there are no insertion
> or deletion costs, and making a copy simply returns the same object, so is constant time
> (O(1))."* — [Time complexity of operations on built-in types](https://docs.python.org/3.14/library/time-complexity.html)

| Operation | Complexity |
|---|---|
| Copy (`tuple(t)`) | O(1) |
| Get item (`t[k]`) | O(1) |
| Get slice (`t[i:j]`) | O(j − i) |
| Concatenate (`t1 + t2`) | O(len(t1) + len(t2)) |
| Multiply (`t * k`) | O(nk) |
| Iteration | O(n) |
| `x in t` | O(n) |
| `min(t)`, `max(t)` | O(n) |
| Get length (`len(t)`) | O(1) — *"The number of elements is stored in the object"* |

`count` and `index` are not in the tuple table; both scan, as [10](10-cost-and-the-real-surface.md)
shows. Note the caveat about subclasses: a named tuple is a subclass, and the table does not
promise it the same figures, although for the operations above nothing in its generated class
overrides the tuple's own ([8](08-named-records.md)).

## Growing a tuple in a loop is quadratic

> *"Concatenating immutable sequences always results in a new object.  This means that building
> up a sequence by repeated concatenation will have a quadratic runtime cost in the total
> sequence length.  To get a linear runtime cost, you must switch to one of the alternatives
> below: … **if concatenating `tuple` objects, extend a `list` instead**"* —
> [Common Sequence Operations](https://docs.python.org/3.14/library/stdtypes.html#common-sequence-operations)

The table says why: each `t1 + t2` costs the length of the result, and in a loop the result is
everything so far.

```python
# Quadratic: iteration k copies k-1 existing references into a new tuple.
events = ()
for record in stream:
    events += (parse(record),)

# Linear: amortised O(1) appends, one O(n) conversion at the end.
collected = []
for record in stream:
    collected.append(parse(record))
events = tuple(collected)

# Or, when the loop is a pure transformation:
events = tuple(parse(record) for record in stream)
```

`sum` is the same loop with a different face. `sum(chunks, ())` starts from `()` and adds each
chunk with `+`, left to right — the documentation describes it as summing *"start and the items
of an iterable from left to right"* — so it is quadratic in the total length. It also points to
the right tool:

> *"To concatenate a series of iterables, consider using `itertools.chain`."* —
> [`sum`](https://docs.python.org/3.14/library/functions.html#sum)

```python
from itertools import chain

all_ids = tuple(chain.from_iterable(id_batches))
```

## `t * n` repeats references

Note (2) of the common-operations table, which applies to every sequence:

> *"Values of *n* less than `0` are treated as `0` (which yields an empty sequence of the same
> type as *s*).  Note that items in the sequence *s* are not copied; they are referenced
> multiple times.  This often haunts new Python programmers"*

For immutable items that is harmless and efficient — `(0,) * 1024` is a thousand references to
one zero, and nothing can change it. For a mutable item it is one object, many times:

```python
buckets = ([],) * 3              # one list, referenced three times
buckets[0].append("job-1")       # all three "buckets" now contain "job-1"

buckets = tuple([] for _ in range(3))   # three distinct lists
```

The tuple adds no protection here, for the reason [1](01-what-immutability-freezes.md) gives: it
freezes which objects it references, not what they contain.

## Slices copy, and recursion on `t[1:]` copies every level

A slice is a new tuple of the selected references, O(j − i). That makes the head/tail recursion
style from functional languages quadratic on tuples:

```python
def total(values: tuple[int, ...]) -> int:
    if not values:
        return 0
    return values[0] + total(values[1:])        # 🔴 copies n-1, n-2, ... references
```

Walk by index or just iterate; the built-in is also linear and has no recursion limit:

```python
def total(values: tuple[int, ...]) -> int:
    return sum(values)
```

## Hashing costs the length of the tuple — once per object in CPython 3.14

The dict section of the same cost page states its assumption plainly: *"They also assume that
hashing and comparing a key is O(1)."* A tuple key does not meet that assumption by default —
its hash is combined from every element's hash, and equality compares element by element — so
a composite key of *k* parts makes each dict operation cost roughly *k* element hashes or
comparisons on top of the table's figure. For the two- and three-part keys of
[4](04-tuples-as-keys.md) that is negligible; for a key built from a hundred-element tuple it is
not.

CPython 3.14's source adds a detail the documentation does not mention: `tuple_hash` reads a
cached value from an `ob_hash` field before computing, and stores the result there afterwards.
So hashing the *same tuple object* again is cheap in this build. That is an implementation
detail, absent from the language documentation and the 3.14 cost table, and it only helps when
the same object is reused — a hot loop that builds a fresh `(tenant, day)` tuple for every
lookup pays for the hash every time. Hoist the key out of the loop when it does not change, and
do not design anything that depends on the cache existing.

## What is not documented: tuple versus list, in speed and in bytes

I could not find — and this topic does not claim — any documented statement that a tuple is
faster to create, iterate or index than a list, or that it uses less memory. The cost table
gives both types the same complexity for every operation they share. The only documented memory
comparison involving tuples is the named tuple one, *"require no more memory than regular
tuples"*, which compares a named tuple to a tuple, not a tuple to a list. If the difference
matters at your scale, measure it on your build with `sys.getsizeof` and `timeit`; the reasons
to choose a tuple in this topic are semantic — a fixed shape, hashability, safe sharing — and
none of them depends on a constant factor.

## Gotchas

**★ Symptom: an export job that builds a tuple of rows gets dramatically slower as the export
grows.** Cause: `rows += (row,)` rebuilds the whole tuple on every iteration — the documentation's
*"quadratic runtime cost in the total sequence length"*. Fix: collect into a list and convert
once.

```python
rows = []
for record in cursor:
    rows.append(to_row(record))
result = tuple(rows)
```

**★ Symptom: flattening batches with `sum(batches, ())` is the slowest line in the profile.**
Cause: `sum` adds left to right with `+`, which is the quadratic concatenation loop. Fix:
`itertools.chain`, as the `sum` documentation suggests.

```python
flat = tuple(chain.from_iterable(batches))
```

**★ Symptom: appending to one bucket appends to all of them.** Cause: `([],) * 3` references the
same list three times — *"items in the sequence s are not copied; they are referenced multiple
times"*. Fix: build a distinct object per slot.

```python
buckets = tuple([] for _ in range(3))
```

**Symptom: a recursive function over a tuple is slow and hits `RecursionError` on large input.**
Cause: `values[1:]` copies the remaining references at every level, and each level is a stack
frame. Fix: iterate.

```python
def count_positive(values: tuple[int, ...]) -> int:
    return sum(1 for v in values if v > 0)
```

**Symptom: a dict lookup in an inner loop is slower than expected for a "constant" key.** Cause:
the key tuple is rebuilt on every iteration, so each lookup allocates a tuple and hashes all its
elements again; CPython 3.14's per-object hash cache cannot help a new object. Fix: build the key
once outside the loop.

```python
from collections import defaultdict

totals = defaultdict(lambda: defaultdict(float))
key = (tenant_id, report_day)
for metric in metrics:
    totals[key][metric.name] += metric.value
```

## Interview questions

**★ Why is building a tuple with `+=` in a loop quadratic, and what do you do instead?**
Because a tuple cannot grow. Each `t += (x,)` creates a new tuple containing every existing
reference plus one, which the 3.14 cost table prices at the length of the result; summed over
*n* iterations that is proportional to *n²*. The documentation states it — *"building up a
sequence by repeated concatenation will have a quadratic runtime cost"* — and gives the fix for
tuples specifically: *"extend a list instead"*, then convert once with `tuple(list)`.

**★ Is a tuple faster or smaller than a list?**
The documentation does not say, and I would not claim a figure without measuring it. What is
documented is that the two share the same complexity for every common operation, and that
copying a tuple with `tuple(t)` is O(1) because it returns the same object, where copying a list
is O(n). The reasons to prefer a tuple are semantic — fixed shape, hashability, safe sharing — and
if constant-factor speed or size matters, the answer comes from `timeit` and `sys.getsizeof` on
the build you deploy.

**What does `t * 3` cost, and does it copy the elements?**
It costs the size of the result — O(nk) in the cost table — because it builds a new tuple of
*n·k* references. It does not copy the elements themselves: note (2) of the sequence table says
the items *"are not copied; they are referenced multiple times"*. That is ideal for immutable
items and a trap for mutable ones, where every position refers to the same object.

**Why is `tuple(t)` O(1) when `list(l)` is O(n)?**
Because the tuple constructor returns its argument unchanged when it is already a tuple — the
library reference says so, and the cost table prices the copy at O(1). There is nothing a copy
could protect against, since neither the caller nor the callee can change the tuple. A list copy
must allocate and fill a new list precisely because either side could mutate the original.

**Is hashing a tuple a constant-time operation?**
Not in general. The hash is combined from every element's hash, so the first computation is
proportional to the tuple's length plus whatever its elements' hashes cost. CPython 3.14's source
caches the result on the tuple object, making repeat hashes of the same object cheap, but that is
an undocumented implementation detail and does nothing for a freshly built equal tuple. The
dict cost table explicitly assumes O(1) hashing, so for long tuple keys its figures are
optimistic.

**Given the costs, when would you choose a tuple over a list?**
When the collection has a fixed shape or must be hashable or safely shared: a record, a
composite key, a function's multiple results, a constant table of options, a snapshot handed to
other threads or cached. When the collection grows, shrinks or is sorted in place, a list —
building a list and converting at the end is the documented way to produce a tuple of unknown
length. And when the question is membership, neither: a `frozenset`.

---

← [The real surface](10-cost-and-the-real-surface.md) · [Topic index](README.md) · Next topic → **03 · `dict`** *(not written yet)* · Phase: [Phase 3 — Collections in depth](../README.md)
