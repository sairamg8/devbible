---
title: "`enumerate` yields a counter that starts where you say and advances once per item pulled — it is not the item's position, not a length and not reversible — and every bug with it is a place where those three were confused"
sidebar_label: "02 · enumerate — the counter"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09 against the Python 3.14 documentation — [`enumerate()`](https://docs.python.org/3.14/library/functions.html#enumerate), [the `for` statement](https://docs.python.org/3.14/reference/compound_stmts.html#the-for-statement), [`csv` reader objects](https://docs.python.org/3.14/library/csv.html#reader-objects) — and the CPython [**v3.14.7**](https://github.com/python/cpython/tree/v3.14.7) source (`Objects/enumobject.c`, `Objects/abstract.c`, `Modules/_io/textio.c`). Documentation- and source-validated — **no sandbox run**. Target: **Python 3.14.7**.

**`enumerate(iterable, start=0)` pairs each item with a counter, and the counter belongs to `enumerate`, not to the data: it is an integer that starts at `start` and goes up by one every time an item is pulled. Phase 1 covers the everyday use — [`start=1` for humans, parentheses for nested unpacking, and numbering survivors after a filter](../../phase-1-language-core/08-control-flow/02-enumerate-and-zip.md). This chunk is the part underneath: what the counter is made of, the four situations where it stops equalling the position, and the three things an `enumerate` object cannot do because it is an iterator and not a sequence.**

## What the object is

The documentation's equivalent code is the specification, and it is short:

```python
def enumerate(iterable, start=0):
    n = start
    for elem in iterable:
        yield n, elem
        n += 1
```

The real object is a C iterator, and three properties of the C code are worth knowing, all from `Objects/enumobject.c` at `v3.14.7`:

- **`start` goes through `PyNumber_Index`.** Anything with an `__index__` is accepted, anything else fails at the call with the format `'%.200s' object cannot be interpreted as an integer` (`Objects/abstract.c`). A `float` start is refused, even `1.0`.
- **The counter does not overflow.** It is a machine integer until it reaches `PY_SSIZE_T_MAX`, and then `enum_next_long` carries on with a Python `int`. A `start` too large for a machine word is stored the same way, so a huge `start` is fine.
- **The item is pulled before the tuple is built.** `enum_next` calls the underlying iterator's `tp_iternext` first; an exhausted or failing iterator therefore ends or raises before the counter moves. The counter counts *items delivered*, which is exactly what `n += 1` after `yield` says.

The type has `__reduce__` and `__class_getitem__` and nothing else of note — in particular **no `__len__`, no `__reversed__` and no `__length_hint__`**. That is the source of the three refusals in the last section.

## `start=` is for the reader, not for the data

`start` exists so a counter can be shown to a person or continued from a previous batch. It changes nothing about the items:

```python
def render_page(rows: list[str], page: int, page_size: int = 50) -> list[str]:
    first = page * page_size + 1
    return [f"{number:>5}  {row}" for number, row in enumerate(rows, start=first)]
```

Used to *index*, the same counter is a bug. The failure is quiet when the off-by-one lands inside the list and loud only at the end:

```python
from dataclasses import dataclass


@dataclass
class Node:
    name: str
    next: "Node | None" = None


def link_neighbours(nodes: list[Node]) -> None:
    for n, node in enumerate(nodes, start=1):
        node.next = nodes[n]              # n is one ahead of the position: right for every node
                                          # except the last, where it raises IndexError
```

Keep the two numbers in different variables and convert only where the person reads it:

```python
def link_neighbours(nodes: list[Node]) -> None:
    for position, node in enumerate(nodes):
        if position + 1 < len(nodes):
            node.next = nodes[position + 1]
```

## Four situations where the counter is not the position

The counter equals the item's position in the source only if `start=0`, the iterable is a sequence you are iterating from its beginning, nothing upstream removed items, and nobody mutates the list under the loop. Break any one and the number is a delivery count.

**1 · A skipped header.** Something consumed the first item before the loop:

```python
with open("orders.txt", encoding="utf-8") as handle:
    header = next(handle)
    for lineno, line in enumerate(handle, start=2):    # start=2: the header was line 1
        check(lineno, line)
```

**2 · A generator or a filter upstream** — phase 1's case; the counter numbers what it receives.

**3 · Records that span lines.** `enumerate(reader)` on a `csv.reader` counts *records*. The reader has its own attribute for the physical line, and the documentation says why they differ:

> *"The number of lines read from the source iterator. This is not the same as the number of records returned, as records can span multiple lines."*

```python
import csv

with open("tickets.csv", newline="", encoding="utf-8") as handle:
    reader = csv.reader(handle)
    for record_number, row in enumerate(reader, start=1):
        if not row[0]:
            raise ValueError(f"record {record_number} (line {reader.line_num}): empty id")
```

**4 · A list mutated under the loop.** The documentation says of forward iterators over mutable sequences that the index *"will continue to march forward (or backward) even if the underlying sequence is mutated"*. `enumerate` counts those steps, so after each deletion the counter still equals the position in the *shrunken* list — one less than the item's original position — and the element that slid into the deleted slot is skipped:

```python
def drop_blank(lines: list[str]) -> None:
    for i, line in enumerate(lines):
        if not line.strip():
            del lines[i]                  # the next line slid into slot i and is never examined
```

The mechanics and the four safe shapes are in [list 11](../01-list-internals/11-mutating-while-iterating.md) and [11b](../01-list-internals/11b-safe-ways-to-mutate.md). The `enumerate`-specific fix keeps the loop read-only and applies the deletions afterwards, or rebuilds:

```python
def drop_blank(lines: list[str]) -> None:
    blank = [i for i, line in enumerate(lines) if not line.strip()]
    for i in reversed(blank):             # highest index first, so the lower ones do not shift
        del lines[i]
```

## `tell()` and the text-file iterator

A text file used as the iterable makes `enumerate(handle, start=1)` the standard line counter. It has one trap, and it is in the file, not in `enumerate`. `TextIOWrapper.__next__` clears an internal `telling` flag on every call (`self->telling = 0` in `textiowrapper_iternext_lock_held`, `Modules/_io/textio.c`), and `tell()` refuses to run while it is clear:

```c
if (!self->telling) {
    PyErr_SetString(PyExc_OSError,
                    "telling position disabled by next() call");
```

The flag is restored only when the iterator reaches end of file. So the position of each line — for an index, a resume marker, a seek table — cannot be read with `handle.tell()` inside `for line in handle`. (In text mode `tell()` is documented to return *"an opaque number"* that *"does not usually represent a number of bytes in the underlying binary storage"*; it is a cookie to hand back to `seek()`, not an offset to do arithmetic on.) `readline()` does not clear the flag, so drive the loop with `readline`:

```python
def index_lines(path: str) -> list[tuple[int, int]]:
    offsets: list[tuple[int, int]] = []
    with open(path, encoding="utf-8") as handle:
        lineno = 0
        while True:
            start = handle.tell()
            line = handle.readline()
            if not line:
                break
            lineno += 1
            offsets.append((lineno, start))
    return offsets
```

That is the readable form. It uses `readline` directly, keeps `tell()` legal, and needs no `enumerate` because the counter is incremented next to the read that earns it. The same loop written as `for line in iter(handle.readline, "")` is the two-argument form of `iter`, which has its own chunk **(not written yet)**.

## What an `enumerate` object cannot do

It is an iterator, so it refuses everything that needs a sequence. Each refusal has a one-line fix:

```python
pairs = enumerate(names)

# len(pairs)        TypeError: no __len__
# pairs[0]          TypeError: not subscriptable
# reversed(pairs)   TypeError: 'enumerate' object is not reversible

count = len(names)                                  # the length lives on the source
first = next(enumerate(names), None)                # an enumerate object is an iterator, so next() takes it
last_first = list(enumerate(names))[::-1]           # materialise, then slice
```

`reversed(enumerate(xs))` fails because `reversed_new_impl` finds neither `__reversed__` nor the sequence protocol (`PySequence_Check` is false). If you want the items last-to-first **with their original positions**, walk two reversed views in step:

```python
for position, name in zip(reversed(range(len(names))), reversed(names)):
    audit(position, name)
```

`enumerate(reversed(names))` is different and usually wrong: it numbers from `start` upwards over the reversed order, so the counter no longer matches the position. What `reversed` accepts and why gets its own chunk **(not written yet)**.

## Gotchas

**★ Symptom: `IndexError` (or a silently wrong neighbour) from `items[n]` inside `for n, item in enumerate(items, start=1)`.** Cause: `start=1` shifts the counter one ahead of every position; it is a display value. Fix: keep `position` zero-based for indexing and add one at the point of formatting — never subscript with a counter that has `start` set.

```python
for position, item in enumerate(items):
    print(f"{position + 1}. {item.title}")
    if position > 0:
        item.previous = items[position - 1]
```

**★ Symptom: every other blank line survives a cleanup loop.** Cause: `del lines[i]` inside `for i, line in enumerate(lines)` shifts the tail down while the list iterator's index still advances by one, so the item that slid into slot `i` is never seen. Fix: collect the indexes, delete from the highest (shown above), or rebuild with a comprehension.

```python
lines[:] = [line for line in lines if line.strip()]
```

**★ Symptom: after a loop, `NameError` (or `UnboundLocalError` in a function) from `i + 1` used as "the number of rows".** Cause: the reference says *"if the sequence is empty, they will not have been assigned to at all by the loop"* — an empty input never binds `i`. Fix: pre-bind the counter and let `start=1` make it the total:

```python
processed = 0
for processed, row in enumerate(rows, start=1):
    handle(row)
# processed is the number of rows; it is 0, not a NameError, when rows was empty
```

**★ Symptom: the inverse map `{value: i for i, value in enumerate(values)}` returns the last position for duplicated values, while `values.index(value)` returns the first.** Cause: a dictionary built from repeated keys keeps the last value — the constructor's documentation says *"If a key occurs more than once, the last value for that key becomes the corresponding value"* — and a comprehension assigns in order. Fix: keep the first occurrence explicitly.

```python
first_position: dict[str, int] = {}
for position, name in enumerate(names):
    first_position.setdefault(name, position)
```

**Symptom: `TypeError: 'float' object cannot be interpreted as an integer` from `enumerate(rows, start=page_number / 2)`.** Cause: `start` goes through `PyNumber_Index`; only integers and objects with `__index__` pass. Fix: convert deliberately.

```python
for number, row in enumerate(rows, start=page_number // 2):
    render(number, row)
```

**Symptom: a line number in an error message is wrong by the number of header rows, or by embedded newlines.** Cause: the counter counts items delivered after the loop began, and a CSV *record* can span several physical lines. Fix: set `start` to match what was consumed first, and use `reader.line_num` when the reader is the source.

```python
header = next(reader)
for record_number, row in enumerate(reader, start=2):
    validate(record_number, reader.line_num, row)
```

**Symptom: `OSError: telling position disabled by next() call` from `handle.tell()` inside a `for lineno, line in enumerate(handle)` loop.** Cause: text-file iteration clears the `telling` flag on each `__next__` until end of file. Fix: drive the loop with `readline()` as in `index_lines`. (This page read the text-file implementation only; it did not check what binary-mode iteration does with `tell()`.)

**Symptom: iterating an `enumerate` object twice gives nothing the second time.** Cause: it is its own iterator ([the ledger](01-what-each-builtin-requires-and-consumes.md)). Fix: call `enumerate` again, or `list()` it once.

```python
numbered = list(enumerate(names, start=1))
first_pass = [label for _, label in numbered]
second_pass = dict(numbered)
```

## Interview questions

**★ Is the number `enumerate` yields the item's index?**
No — it is a counter that starts at `start` and increases by one per item delivered. It equals the index only when `start` is `0`, the iterable is a sequence read from its beginning, nothing upstream filtered or consumed anything, and nobody mutated the list during the loop. Every wrong-number bug with `enumerate` is one of those four assumptions failing.

**★ What goes wrong if you delete from a list inside `for i, x in enumerate(xs)`?**
The list iterator advances an internal index by one per step and never checks the length; deleting at `i` shifts every later element one slot down, so the element that moved into slot `i` is skipped. `enumerate` adds nothing to the fix — it just counts the steps — so the standard repairs apply: iterate over a copy, rebuild with a comprehension, or collect indexes and delete from the highest down.

**★ Can you call `len()` or `reversed()` on an `enumerate` object? How do you count down with the original indexes?**
Neither — the type has no `__len__` and no `__reversed__`, and `reversed()` also fails the sequence-protocol check. Count down with two reversed views walked together, `zip(reversed(range(len(xs))), reversed(xs))`, or materialise with `reversed(list(enumerate(xs)))`. `enumerate(reversed(xs))` compiles and runs but numbers the reversed order from zero, which is rarely what the caller wanted.

**How do you count the items in a loop so that an empty input gives `0` and not a `NameError`?**
Pre-bind the counter and use `enumerate(..., start=1)` as the loop target: `n = 0; for n, item in enumerate(items, start=1): ...`. After the loop `n` is the number of items, and if the loop never ran, `n` keeps its initial `0`. The reference states why the naive version fails: names in the target list are *"not deleted when the loop is finished, but if the sequence is empty, they will not have been assigned to at all"*.

**What types can `start` be?**
Any integer or object with `__index__`, because the constructor calls `PyNumber_Index`. A `float` raises `TypeError` even when it is integral. A `start` beyond the machine word is fine: the C code keeps the counter in a Python `int` from that point.

**Why can `handle.tell()` raise inside a loop over a text file?**
`TextIOWrapper.__next__` sets an internal `telling` flag to `0` on each call and only restores it at end of file; `tell()` checks the flag and raises `OSError: telling position disabled by next() call`. Iterating with `readline()` in a `while` loop never clears it, so if you need a position alongside each line number, that is the loop to write.

---

← [01 · Requires and consumes](01-what-each-builtin-requires-and-consumes.md) · [Topic index](README.md) · Next → **02b · `enumerate` and index-shaped problems** *(not written yet)*
