---
title: "Every idiom in this topic is a wrapper around an iterator's `__next__`, so what it requires, what it consumes and what it leaves behind decide whether two of them can share one stream of data — and each builtin answers those three questions differently"
sidebar_label: "01 · Requires and consumes"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09 against the Python 3.14 documentation — [glossary: *iterable*, *iterator*, *sequence*](https://docs.python.org/3.14/glossary.html), [Iterator Types](https://docs.python.org/3.14/library/stdtypes.html#typeiter), [built-in functions](https://docs.python.org/3.14/library/functions.html), [the `for` statement](https://docs.python.org/3.14/reference/compound_stmts.html#the-for-statement) — and the CPython [**v3.14.7**](https://github.com/python/cpython/tree/v3.14.7) source (`Python/bltinmodule.c`, `Objects/enumobject.c`, `Python/ceval.c`, `Modules/_io/iobase.c`). Documentation- and source-validated — **no sandbox run**.

**Every builtin in this topic ends in the same C call — the iterator's `tp_iternext` — and differs only in what it asks for first and what it does with the results. `next()` insists on an iterator and refuses a list; `reversed()` refuses an iterator and needs a length; `min()` eats the whole stream; `any()` stops at the first decisive item and leaves the rest; `a, b = it` takes one item more than it needs. Two of them on one iterator are a bug in waiting, and no error message says so: the second one just sees a shorter stream, or none. This page is the ledger — for each idiom, what it needs, what it consumes and what remains — so every later chunk can say "this drains its argument" in three words.**

## Three kinds of argument

The glossary defines the terms the rest of the topic leans on. An *iterable* is anything `iter()` accepts:

> *"An object capable of returning its members one at a time. Examples of iterables include all sequence types (such as `list`, `str`, and `tuple`) and some non-sequence types like `dict`, file objects, and objects of any classes you define with an `__iter__()` method or with a `__getitem__()` method that implements sequence semantics."*

An *iterator* is the stream itself, and it is the only kind of object that gets used up:

> *"When no more data are available a `StopIteration` exception is raised instead. At this point, the iterator object is exhausted and any further calls to its `__next__()` method just raise `StopIteration` again. Iterators are required to have an `__iter__()` method that returns the iterator object itself so every iterator is also iterable and may be used in most places where other iterables are accepted. One notable exception is code which attempts multiple iteration passes. A container object (such as a `list`) produces a fresh new iterator each time you pass it to the `iter()` function or use it in a `for` loop. Attempting this with an iterator will just return the same exhausted iterator object used in the previous iteration pass, making it appear like an empty container."*

The last sentence is the whole topic in miniature: **a drained iterator looks like an empty container**. `min()` of it raises `ValueError`, `sum()` of it is `0`, `all()` of it is `True`, `zip()` with it produces nothing — each a different silent symptom of the same cause. The third kind is the *sequence*: an iterable that also has a `__len__` and integer `__getitem__`. `reversed()` is the one builtin here that needs it.

## The ledger

| Idiom | Needs | Calls `iter()` | Consumes | Leaves behind |
|---|---|---|---|---|
| `for x in it` | an iterable | once, before the first pass | one item per pass of the body | everything after the item that made you `break` |
| `enumerate(it, start)` | an iterable; `start` int-like | at construction | one item per step, lazily | the rest |
| `zip(a, b, …)` | any number of iterables | each argument, at construction | one item from each per round, left to right | the rest — except that the round that ends has already taken from the earlier arguments |
| `reversed(x)` | `__reversed__`, or `__len__` plus `__getitem__` | never; indexes | nothing — it reads by position from a captured length | the sequence, untouched |
| `any(it)` / `all(it)` | an iterable | at the call | items until the answer is known | everything after the deciding item |
| `min(it)` / `max(it)` | an iterable, non-empty unless `default=` | at the call | all of it | nothing |
| `sum(it, start)` | an iterable of numbers | at the call | all of it | nothing |
| `next(it, default)` | 🔴 an **iterator** | never | one item | the rest |
| `iter(fn, sentinel)` | a zero-argument callable | not applicable | one call of `fn` per step | whatever `fn` has not produced yet |
| `a, b = it` | an iterable | at the assignment | exactly as many as there are targets, **plus one** to prove the end | on a longer iterator, one item consumed and discarded |

Three details in the table are source facts, not documentation promises, and the later chunks lean on them:

- `zip` and `enumerate` turn their arguments into iterators **when they are constructed**, not when they are first advanced — `zip_new` and `enum_new_impl` call `PyObject_GetIter` in the constructor. A non-iterable argument therefore fails at the call, with `PyObject_GetIter`'s format `'%.200s' object is not iterable`, before any item is read. `reversed` does its checks at construction too: it looks up `__reversed__`, falls back to the sequence protocol, and captures the length.
- `builtin_next` opens with `if (!PyIter_Check(it))` and raises `TypeError` with the format `'%.200s' object is not an iterator`. A list is iterable and not an iterator, so `next(items)` is refused. Every other consumer in the table calls `iter()` for you.
- The unpack routine in `Python/ceval.c` pulls `argcnt` items and then one more, to check that the iterator is empty. Only if that extra item exists does it raise `too many values to unpack` — after already taking it.

## Who is their own iterator

The glossary's rule — *"a fresh new iterator each time"* for a container, the same object for an iterator — sorts everything you meet into one-pass and many-pass:

| Object | `iter(x)` gives | A second `for` loop |
|---|---|---|
| `list`, `tuple`, `str`, `range`, `dict`, `set`, `deque` | a new iterator | walks everything again |
| `dict.keys()`, `.values()`, `.items()` views | a new iterator | walks everything again |
| a file from `open()` | the file itself (`iobase_iter` returns `self`) | continues from the current position — at end of file, nothing |
| a generator or generator expression | itself | nothing |
| `zip`, `map`, `filter`, `enumerate`, `reversed` objects | themselves | nothing, or the remainder |
| a `csv.reader` | itself — it has `__next__` | nothing |

`Iterator`-versus-`Iterable` is also the difference between the two annotations a function can use, and it is worth choosing deliberately:

```python
from collections.abc import Collection, Iterable, Iterator


def mean_length(names: Collection[str]) -> float:
    # Collection = sized and re-iterable, so len() and a loop are both safe.
    if not names:
        return 0.0
    return sum(len(name) for name in names) / len(names)


def stream_first_error(lines: Iterable[str]) -> str | None:
    # Iterable = one pass promised, nothing more.
    for line in lines:
        if line.startswith("ERROR"):
            return line
    return None


def drain(events: Iterator[bytes]) -> int:
    # Iterator = the caller hands over a stream that this function will use up.
    return sum(1 for _ in events)
```

## Four designs that survive a second pass

A function that needs its data twice has four honest options. **One pass that computes both results** — a fold — costs no memory:

```python
from collections.abc import Iterable


def price_range(prices: Iterable[float]) -> tuple[float, float]:
    it = iter(prices)
    try:
        low = high = next(it)
    except StopIteration:
        raise ValueError("price_range() needs at least one price") from None
    for price in it:
        if price < low:
            low = price
        elif price > high:
            high = price
    return low, high
```

**Materialise once, then read it as often as you like** — costs memory proportional to the input, and only that:

```python
def rescale(scores: Iterable[float]) -> list[float]:
    values = list(scores)
    low, high = min(values), max(values)
    span = (high - low) or 1.0
    return [(v - low) / span for v in values]
```

**Ask for a container in the signature** (`Collection`, `Sequence`) so the caller decides. Or **ask for a factory** — a callable that produces a fresh iterator, as `iter(fn, sentinel)` does — and call it once per pass. Phase 5 owns the iterator protocol and `itertools.tee` in depth, and **the iterator protocol** *(not written yet)* is where two independent passes over one stream are treated properly.

## Gotchas

**★ Symptom: a function returns the right answer for a list and a wrong one for a generator.** Cause: it reads its argument twice — `min(values)` then `max(values)`, or a length check then a loop — and the generator was empty by the second read. Fix: decide in the signature. Either fold into one pass or materialise at the top:

```python
def spread(values: Iterable[float]) -> float:
    data = list(values)          # a list passes through the copy unchanged in meaning
    return max(data) - min(data)
```

**★ Symptom: `TypeError: 'list' object is not an iterator` from `next(items)`.** Cause: `next()` calls the type's `tp_iternext` and checks `PyIter_Check` first; a list has `__iter__` but no `__next__`. Fix: take the iterator yourself, once, and keep it.

```python
first_pending = next(iter(pending), None)      # a fresh iterator each call; fine for one lookup

it = iter(pending)                              # keep it if you will pull more than one item
header = next(it)
rows = list(it)
```

**★ Symptom: `ValueError: max() iterable argument is empty` on data that was plainly not empty.** Cause: an earlier `min()`, `sum()`, `list()` or `for` loop drained the same iterator. `min_max` raises `%s() iterable argument is empty` for a stream with no items — it cannot tell "empty" from "already read". Fix: one pass, as `price_range` above, or `max(it, default=None)` **only if** an empty stream is a legitimate answer and you know nothing else touched it.

**★ Symptom: a second loop over a file, `csv.reader`, `zip` or `map` object does nothing, with no error.** Cause: each is its own iterator, so `for` gets the same, exhausted object back. Fix: re-create it, or materialise it.

```python
import csv

with open("orders.csv", newline="", encoding="utf-8") as handle:
    rows = list(csv.reader(handle))     # one read, many passes

header, body = rows[0], rows[1:]
```

**Symptom: after a `for … break` the next loop over the same iterator misses the element you broke on.** Cause: the loop assigned that element to its target and the iterator moved past it; `break` does not put it back. Fix: keep the element in a variable, or peek instead of consuming.

```python
lines = iter(["skip", "skip", "BEGIN", "a", "b"])
marker = None
for line in lines:
    if line == "BEGIN":
        marker = line
        break
body = list(lines)                  # continues after BEGIN; marker holds BEGIN
```

**Symptom: a custom iterable can be looped over once.** Cause: `__iter__` returns `self` and the position lives on the instance, so the object is its own iterator. Fix: make `__iter__` produce a fresh iterator each time, which a generator method does for free.

```python
from collections.abc import Iterator


class Countdown:
    def __init__(self, start: int) -> None:
        self.start = start

    def __iter__(self) -> Iterator[int]:      # a new generator per loop
        current = self.start
        while current > 0:
            yield current
            current -= 1
```

**Symptom: `a, b = it` raises `too many values to unpack` and the next `next(it)` skips an item.** Cause: the unpack pulled a third item to test for the end and discarded it. Fix: take exactly what you want without proving the end — a starred target, or [`islice`](../05-slicing/07-islice-and-iterators.md) — and never reuse an iterator after a failed unpack.

```python
a, b, *rest = iter([1, 2, 3, 4])      # rest is the list of everything else
```

**Symptom: `TypeError: object of type 'zip' has no len()`, or the same for `enumerate`, `map` and generators.** Cause: `len()` needs `__len__`, which streams do not have. Fix: `len(list(stream))` if you can afford the list, or count while you consume.

```python
count = sum(1 for _ in stream)        # one pass, constant memory, the stream is then used up
```

**Symptom: an iterator shared between threads yields duplicates or skips items on the free-threaded build.** Cause: the glossary says *"free-threaded CPython does not guarantee thread-safe behavior of iterator operations"*. Fix: one iterator per thread, or hand out work through a `queue.Queue`; the list-specific versions are in [11c](../01-list-internals/11c-thread-safety-under-free-threading.md) and [11d](../01-list-internals/11d-sharing-a-list-between-threads.md).

## Interview questions

**★ What is the difference between an iterable and an iterator, and why is `next(my_list)` an error?**
An iterable can produce an iterator (`iter(x)` succeeds); an iterator produces items (`next(x)` succeeds) and returns itself from `iter()`. A list is only the first, so `next(my_list)` fails the `PyIter_Check` in `builtin_next` with `'list' object is not an iterator`. The practical consequence is that a container can be looped over as often as you like — each loop gets a fresh iterator — and an iterator can be looped over once.

**★ Why does a second `for` loop over a generator, a file or a `zip` object produce nothing, and not an error?**
Because the object is its own iterator and the first loop drained it. The protocol says of an exhausted iterator that it *"must continue to do so on subsequent calls"* — keep raising `StopIteration` — and a `for` loop treats that as a normal end. The glossary describes the effect: the iterator *"appear[s] like an empty container"*. Nothing is wrong from the interpreter's point of view; the bug is in the code that assumed two passes.

**★ What happens if you call `min(it)` and then `max(it)` on the same generator?**
`min` consumes it completely, so `max` sees an empty stream and raises `ValueError: max() iterable argument is empty`. If the two calls were `sum(it)` and `len(list(it))` the second would return `0` — a silent wrong answer, not an exception. The fix is one pass that tracks both, or `list(it)` first when memory allows.

**Which of `any`, `min`, `sum`, `enumerate` and `next` consume their whole argument?**
`min` and `sum` always do. `any` and `all` stop at the first item that decides the answer and leave the rest. `enumerate` and `next` consume one item per step — `enumerate` lazily as you iterate it, `next` exactly one per call. The distinction matters when the iterator is used afterwards: a later loop resumes after whatever `any` or `next` took.

**Why does `a, b = it` on a three-item iterator lose an item?**
The unpack code in `Python/ceval.c` pulls exactly as many items as there are targets and then one more, to check that the iterator is exhausted. If that extra item exists, it raises `ValueError` — but it has already been taken from the iterator. The message includes `got N` only for an exact `list`, `tuple` or `dict`; for any other iterable it just says `expected N`.

**Why do `zip`, `enumerate` and `reversed` fail at the call rather than at the first item when handed a non-iterable?**
Their constructors call `PyObject_GetIter` (or, for `reversed`, look up `__reversed__` and check the sequence protocol) immediately. Only advancing the resulting object is lazy. This is also why `zip(a, b)` binds to the *iterators* over `a` and `b` at that moment: a later rebinding of the name `a` does not change what the zip walks, though a later mutation of the list it points to does.

**Why is it worth typing a parameter `Collection` or `Iterable` instead of `list`?**
Because the annotation states the contract: `Iterable` promises one pass, `Collection` promises `len`, membership and re-iteration, `Iterator` says the function will drain the argument. A function annotated `Iterable[float]` that loops twice is a bug the annotation should have made visible; a linter or a reviewer can catch it, and a caller can pick the right object.

---

← [Topic index](README.md) · Next → **02 · `enumerate` — the counter is not the position** *(not written yet)*
