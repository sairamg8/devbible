---
title: "`enumerate` and `zip`: the index you actually wanted, and the silent truncation you did not"
sidebar_label: "2 · `enumerate` and `zip`"
sidebar_position: 81
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09 against the Python 3.14 Library Reference
> [`enumerate()`](https://docs.python.org/3.14/library/functions.html#enumerate),
> [`zip()`](https://docs.python.org/3.14/library/functions.html#zip),
> [`itertools`](https://docs.python.org/3.14/library/itertools.html)
> (`zip_longest`, `pairwise`, `islice`, `batched`),
> and [PEP 618](https://peps.python.org/pep-0618/).
> Target: **CPython 3.14**.

**`enumerate` and `zip` are the two functions that make `for i in
range(len(xs)):` unnecessary, and between them they cover almost every loop that
would otherwise need an index. `enumerate` is uncomplicated and its only real
trap is forgetting `start=1`. `zip` is not: by default it stops at the shortest
input and says nothing, so a loop over two lists that have silently drifted out
of sync processes the overlap and discards the rest. `strict=True` — added in
3.10 by PEP 618 — turns that silence into a `ValueError`, and it should be your
default.**

## `enumerate`

The docs give the equivalent code, which is the whole specification:

```python
def enumerate(iterable, start=0):
    n = start
    for elem in iterable:
        yield n, elem
        n += 1
```

So it is lazy, it works on anything iterable (not just sequences), and the
counter is independent of the iterable's own indices:

```python
seasons = ['Spring', 'Summer', 'Fall', 'Winter']
list(enumerate(seasons))            # [(0, 'Spring'), (1, 'Summer'), ...]
list(enumerate(seasons, start=1))   # [(1, 'Spring'), (2, 'Summer'), ...]
```

`start=1` is the one people forget, and it is the difference between a report
that says "line 0" and one a human can use:

```python
for lineno, line in enumerate(config_file, start=1):
    if not line.strip():
        continue
    if "=" not in line:
        raise ConfigError(f"{path}:{lineno}: expected key=value")
```

Because the counter is independent, `enumerate` over a *filtered* iterable
numbers the survivors, not the originals — which is sometimes what you want and
sometimes a bug:

```python
for i, row in enumerate(r for r in rows if r.valid):
    ...        # i counts VALID rows; it is not the row's position in `rows`
```

If you need the original position, enumerate first and filter second:
`for i, row in enumerate(rows): if not row.valid: continue`.

`enumerate` also composes with unpacking, which is where it stops being obvious:

```python
for i, (name, score) in enumerate(pairs, start=1):
    print(f"{i}. {name}: {score}")
```

The parentheses around `(name, score)` are required — without them Python tries
to unpack the two-tuple `(index, pair)` into three targets and raises
`ValueError: not enough values to unpack`.

## `zip`, and the truncation it does not mention

By default `zip` stops when the **shortest** input is exhausted, and the docs are
matter-of-fact about it:

> *"By default, `zip()` stops when the shortest iterable is exhausted. It will
> ignore the remaining items in the longer iterables, cutting off the result to
> the length of the shortest iterable."*

```python
list(zip(range(3), ['fee', 'fi', 'fo', 'fum']))
# [(0, 'fee'), (1, 'fi'), (2, 'fo')]        — 'fum' is gone, silently
```

That is fine when the truncation is the point (pairing an infinite counter
against a finite list) and dangerous when it is not. The dangerous case is the
common one: two collections that are *supposed* to be the same length.

```python
for name, salary in zip(names, salaries):       # if these drift, you lose rows
    payroll[name] = salary                      # ... and nothing tells you
```

A row dropped from `salaries` does not raise, does not warn, and does not
misalign — it silently shortens the payroll. The bug surfaces weeks later as a
missing person.

### `strict=True` — use it

PEP 618 added `strict` in Python 3.10. The output is identical when the lengths
match, and it raises when they do not:

```python
list(zip(('a', 'b', 'c'), (1, 2, 3), strict=True))
# [('a', 1), ('b', 2), ('c', 3)]

for item in zip(range(3), ['fee', 'fi', 'fo', 'fum'], strict=True):
    print(item)
# (0, 'fee')
# (1, 'fi')
# (2, 'fo')
# ValueError: zip() argument 2 is longer than argument 1
```

Note **where** the error appears: after the matching items have already been
yielded. `zip` is lazy — *"the elements won't be processed until the iterable is
iterated on"* — so `strict` cannot check lengths up front; it discovers the
mismatch when one input runs out and another does not. In a `for` loop that
means the body has already run three times before the `ValueError`. If you need
the check *before* any work happens, materialise and compare lengths, or wrap
the `zip` in `list()` first.

The rule worth adopting: **`strict=True` unless you are deliberately truncating,
and a comment when you are.**

### `zip_longest` when the lengths legitimately differ

```python
from itertools import zip_longest
list(zip_longest("abc", [1, 2], fillvalue=0))
# [('a', 1), ('b', 2), ('c', 0)]
```

The docs: *"If the iterables are of uneven length, missing values are filled-in
with fillvalue. If not specified, fillvalue defaults to None. Iteration
continues until the longest iterable is exhausted."* And a warning worth
heeding: *"If one of the iterables is potentially infinite, then the
`zip_longest()` function should be wrapped with something that limits the number
of calls (for example `islice()` or `takewhile()`)"* — because it has no
shortest input to stop it.

The default `fillvalue=None` collides with real data that contains `None`. When
the difference matters, pass a private sentinel instead — the same reasoning as
[the sentinel pattern](../05-truthiness/02b-where-the-gap-opens.md).

## Gotchas

**Symptom — rows go missing from an output built by zipping two lists, with no
error.** Cause: `zip` stops at the shortest input and discards the rest
silently. Fix: `strict=True` (3.10+). Make it the default and comment the places
where truncation is deliberate.

**Symptom — `ValueError: zip() argument 2 is longer than argument 1` fires after
the loop body has already run several times.** Cause: `zip` is lazy, so `strict`
detects the mismatch only when one input is exhausted — the matching items have
already been yielded and processed. Fix: if the check must precede any work,
`list(zip(a, b, strict=True))` first, or compare lengths explicitly.

**Symptom — a line number in an error message is one less than the editor
shows.** Cause: `enumerate` starts at 0. Fix: `enumerate(lines, start=1)`.

**Symptom — `for i, name, score in enumerate(pairs):` raises `ValueError: not
enough values to unpack`.** Cause: `enumerate` yields a 2-tuple
`(index, item)`; unpacking the item too needs its own parentheses. Fix:
`for i, (name, score) in enumerate(pairs):`.

**Symptom — indices from `enumerate` do not match positions in the original
list.** Cause: the iterable was filtered before `enumerate` saw it, so the
counter numbers survivors rather than positions. Fix: `enumerate` the original
and `continue` inside the loop, so the index stays the true position.

**Symptom — `zip_longest` fills with `None` and the fill is indistinguishable
from real data.** Cause: `fillvalue` defaults to `None`, which is a legitimate
value in most datasets. Fix: pass a private sentinel object and test with `is`.

**Symptom — `zip_longest` with an infinite iterable never terminates.** Cause:
it runs until the **longest** input is exhausted, and an infinite one never is.
The docs say to wrap it in `islice` or `takewhile`. Fix: bound it explicitly.

**Symptom — zipping the same generator twice yields nothing the second time, or
`zip(gen, gen)` pairs consecutive items instead of duplicating them.** Cause: a
generator is a single iterator, so `zip(gen, gen)` draws alternate items from
one stream. Fix: materialise into a list first, or use `itertools.tee`.
`itertools.pairwise` is the right tool if consecutive pairs were the goal.

**Symptom — a `zip` over a list and a generator consumes items from the list
that never appear in the output.** Cause: `zip` draws from its arguments
left to right within each round, so when a later iterable is exhausted the
earlier ones have already given up an item for that round. Fix: this is inherent
to lazy zipping — use `strict=True` so the loss is reported rather than silent,
and do not rely on the position of a partially-consumed iterator afterwards.

**Symptom — `enumerate` over a `dict` gives you indices paired with keys, not
values.** Cause: iterating a mapping yields keys. Fix:
`enumerate(d.items(), start=1)` and unpack as `for i, (k, v) in ...`, or
`enumerate(d.values())`.

## Interview questions

**★ Q: What happens when you `zip` two lists of different lengths?**
By default it stops at the shortest and silently discards the rest — no error,
no warning. Since Python 3.10 (PEP 618) `zip(a, b, strict=True)` raises
`ValueError` instead, which is what you want whenever the inputs are supposed to
be the same length. The truncating default is only right when you are
deliberately pairing against something longer or infinite.

**★ Q: Why does `strict=True` raise *during* the loop rather than before it?**
Because `zip` is lazy — it produces items on demand and only discovers a length
mismatch when one input is exhausted while another is not. By then the matching
items have already been yielded and the loop body has run for them. If the check
must happen first, wrap it in `list()` or compare lengths explicitly.

**★ Q: How do you loop with an index, Pythonically?**
`for i, x in enumerate(xs):`, with `start=1` when the number is shown to a
human. It is lazy, works on any iterable rather than just sequences, and keeps
the index and the element in step — which `for i in range(len(xs)):` does not
guarantee once anyone edits the loop.

**Q: Does `enumerate` work on a generator?**
Yes — it works on anything iterable, and it is itself lazy; the documented
equivalent is a generator function. That is one of the reasons to prefer it over
`range(len(...))`, which needs a sized, indexable object.

**Q: `zip_longest` fills with `None`. When is that a problem?**
Whenever `None` is a legal value in the data, because then you cannot tell a
fill from a real value. Pass a private `object()` sentinel as `fillvalue` and
compare with `is` — the same pattern as any other "absent versus null"
distinction.

**Q: You are given `names` and `salaries` and told they are parallel. What do you write?**
`for name, salary in zip(names, salaries, strict=True):`. The whole point of the
sentence "they are parallel" is that a mismatch is a bug, and the default `zip`
would hide it by dropping the tail. `strict` turns the assumption into a check.

**Q: Why does `enumerate(filtered)` give indices that do not match the source?**
Because the counter is independent of the iterable and counts what it actually
receives. Filtering upstream means it numbers survivors. Enumerate the original
sequence and `continue` past the rejects if you need true positions.

---

← Prev: [The `for` statement](01-the-for-statement.md) · Index: [Control flow](README.md) · Next → [`zip` idioms and neighbours](02b-zip-idioms-and-neighbours.md)
