---
title: "Stability is a documented language guarantee, not a timsort accident — it is what lets two plain sorts replace one clever key, and it makes a sort's output exactly as reproducible as its input order, no more"
sidebar_label: "08 · Stability and multi-key sorts"
sidebar_position: 19
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-10 against [`list.sort`](https://docs.python.org/3.14/library/stdtypes.html#list.sort),
> [`sorted`](https://docs.python.org/3.14/library/functions.html#sorted),
> [`min`](https://docs.python.org/3.14/library/functions.html#min) /
> [`max`](https://docs.python.org/3.14/library/functions.html#max),
> [`heapq.nlargest`](https://docs.python.org/3.14/library/heapq.html#heapq.nlargest), and the
> [Sorting HOWTO](https://docs.python.org/3.14/howto/sorting.html) — *Sort Stability and
> Complex Sorts*, *Decorate-Sort-Undecorate*, *Odds and Ends*. Documentation-validated;
> **no sandbox run** — the only outputs shown are the HOWTO's own doctests, quoted.
> Target: **Python 3.14** (3.14.7).

**A sort is stable when elements that compare equal come out in the order they went
in. Python does not merely happen to be stable because timsort is; the documentation
*guarantees* it for both `list.sort()` and `sorted()`, with no "CPython implementation
detail" qualifier, which makes it something you may build on. What you build is
multi-key sorting by repeated passes — least significant key first — which is the only
clean way to mix ascending and descending order on keys you cannot negate. The flip
side is less advertised: stability preserves *input* order among ties, so a sort over
data that arrived in a nondeterministic order produces nondeterministic output, and a
`[::-1]` anywhere in the pipeline silently reverses every tie. This chunk is the
guarantee and the multi-key techniques; [08b](08b-ties-and-determinism.md) is what
happens to ties.**

## The guarantee, verbatim

From `list.sort`:

> *"The `sort()` method is guaranteed to be stable. A sort is stable if it guarantees
> not to change the relative order of elements that compare equal — this is helpful
> for sorting in multiple passes (for example, sort by department, then by salary
> grade)."*

From `sorted`:

> *"The built-in `sorted()` function is guaranteed to be stable."*

Neither sentence sits inside a *CPython implementation detail* box — compare the
"appears empty during a sort" note in [06b](06b-during-the-sort.md), which does. So
this is a property of the language, not of one interpreter.

The HOWTO's own demonstration, including its output, verbatim:

```python
>>> data = [('red', 1), ('blue', 1), ('red', 2), ('blue', 2)]
>>> sorted(data, key=itemgetter(0))
[('blue', 1), ('blue', 2), ('red', 1), ('red', 2)]
```

> *"Notice how the two records for blue retain their original order so that
> ('blue', 1) is guaranteed to precede ('blue', 2)."*

The rest of the standard library is consistent with it, by documentation:

> *"If multiple items are minimal, the function returns the first one encountered.
> This is consistent with other sort-stability preserving tools such as
> sorted(iterable, key=keyfunc)[0] and heapq.nsmallest(1, iterable, key=keyfunc)."*

`max` says the same for maximal items, and `heapq.nlargest(n, iterable, key)` is
documented as *"Equivalent to: sorted(iterable, key=key, reverse=True)[:n]."* — so the
top-N helpers inherit the same tie behaviour.

## Multi-key sorting, method 1 — one tuple key

When every key sorts in the same direction, return a tuple. Tuples compare
lexicographically — the DSU section of the HOWTO puts it as *"the first items are
compared; if they are the same then the second items are compared, and so on"*:

```python
from operator import attrgetter, itemgetter

employees.sort(key=attrgetter("department", "grade", "name"))   # all ascending
rows.sort(key=itemgetter(2, 0))                                 # column 2, then 0
```

> *"The operator module functions allow multiple levels of sorting."*

For a descending *numeric* key inside the tuple, negate it:

```python
# highest salary first, then name A→Z
employees.sort(key=lambda e: (-e.salary, e.name))

# newest first, then id ascending — negate a number derived from the datetime
events.sort(key=lambda ev: (-ev.created_at.timestamp(), ev.id))

# booleans: flagged rows first
tickets.sort(key=lambda t: (not t.flagged, t.opened_at))
```

That trick has a hard limit: you cannot negate a string, a `date` or a tuple. The
moment a descending key is one of those, method 2 is the answer.

## Multi-key sorting, method 2 — several stable passes

> *"This wonderful property lets you build complex sorts in a series of sorting steps.
> For example, to sort the student data by descending grade and then ascending age, do
> the age sort first and then sort again using grade"*

```python
>>> s = sorted(student_objects, key=attrgetter('age'))     # sort on secondary key
>>> sorted(s, key=attrgetter('grade'), reverse=True)       # now sort on primary key, descending
[('dave', 'B', 10), ('jane', 'B', 12), ('john', 'A', 15)]
```

The rule is **least significant key first**. The last pass decides the major order;
every earlier pass survives *inside* each group of ties that the later passes leave
alone. The HOWTO generalises it into a recipe, verbatim:

```python
>>> def multisort(xs, specs):
...     for key, reverse in reversed(specs):
...         xs.sort(key=attrgetter(key), reverse=reverse)
...     return xs

>>> multisort(list(student_objects), (('grade', True), ('age', False)))
[('dave', 'B', 10), ('jane', 'B', 12), ('john', 'A', 15)]
```

`specs` is written most-significant first, as a human would say it, and `reversed`
turns it into the order the passes must run in. Note `list(student_objects)`: the
recipe sorts in place, so the HOWTO hands it a copy.

On cost, the documentation's only claim is qualitative:

> *"The Timsort algorithm used in Python does multiple sorts efficiently because it can
> take advantage of any ordering already present in a dataset."*

I have no measurement comparing k passes against one tuple key, and the documentation
gives none. What is certain: each pass is a full sort with its own n key calls, and a
tuple key builds n tuples and compares element by element. Pick by clarity; measure
if it matters.

## Why `reverse=True` must be the parameter, not a slice

[07d](07d-reverse-and-the-pre-sort-check.md) shows the mechanism — reverse, sort
forward, reverse back — and the HOWTO states the consequence: *"The reverse parameter
still maintains sort stability (so that records with equal keys retain the original
order)."* In a multi-pass sort that is load-bearing:

```python
by_age = sorted(students, key=attrgetter("age"))

right = sorted(by_age, key=attrgetter("grade"), reverse=True)
# within each grade: ages still ascending — pass 1 survived

wrong = sorted(by_age, key=attrgetter("grade"))[::-1]
# within each grade: ages DESCENDING — the slice reversed pass 1 as well
```

The `wrong` line produces the same grade order and a different secondary order —
derived from the mechanism, not from a run.

## Gotchas

**★ Symptom: a two-pass sort ends up ordered by the *secondary* key.** Cause: the
passes ran most-significant first, so the last pass (the minor key) decided the major
order. Fix: run passes least-significant first — or write the specs the human way and
reverse them, as the HOWTO's recipe does:

```python
for field, desc in reversed((("grade", True), ("age", False))):
    students.sort(key=attrgetter(field), reverse=desc)
```

**★ Symptom: descending order is right but ties are in the wrong order.** Cause: a
`[::-1]` or `reversed()` after an ascending sort reverses ties too, undoing every
earlier pass. Fix: use `reverse=True` on the sort itself:

```python
rows.sort(key=attrgetter("score"), reverse=True)
```

**Symptom: `TypeError` when negating a key for descending order.** Cause: unary minus
exists for numbers, not for `str`, `date` or `tuple`. Fix: switch to two passes for
that key, or negate a numeric proxy when one exists:

```python
rows.sort(key=attrgetter("name"))                    # secondary, ascending
rows.sort(key=attrgetter("signup_date"), reverse=True)  # primary, descending
```

**Symptom: `sort(key=lambda r: (r.region, r.score), reverse=True)` puts regions in
descending order too, when only the score was meant to descend.** Cause: `reverse`
applies to the whole key — the tuple is compared as one value and the entire result is
reversed. Fix: negate the part that should descend, or use two passes:

```python
rows.sort(key=lambda r: (r.region, -r.score))          # region A→Z, score high→low
```

## Interview questions

**★ What does it mean that Python's sort is stable, and is that guaranteed?**
Elements that compare equal keep their original relative order. It is guaranteed in
the documentation of both `list.sort()` — *"guaranteed to be stable"* — and `sorted()`,
and not marked as a CPython implementation detail, so any conforming implementation
must provide it. `min`, `max`, `heapq.nsmallest` and `heapq.nlargest` are documented in
terms consistent with it: ties resolve to the first one encountered.

**★ How do you sort employees by descending salary, then ascending name?**
With one pass and a tuple key when the descending key is numeric:
`key=lambda e: (-e.salary, e.name)`. When the descending key cannot be negated — a
string or a date — use two stable passes, least significant first:
`sort(key=name)` then `sort(key=signup_date, reverse=True)`. Both rely on stability:
the tuple by construction, the passes by the guarantee.

**Why must the least significant key be sorted first?**
Because each pass fully reorders the list by its own key and only preserves earlier
order *among its ties*. The last pass therefore determines the major order; earlier
passes survive only inside groups the later passes consider equal. Sorting the major
key first and the minor key last leaves you ordered by the minor key.

**Is a multi-pass sort slower than a tuple key?**
The documentation does not give numbers; it says only that timsort *"does multiple
sorts efficiently because it can take advantage of any ordering already present"*.
Each pass calls its key n times and runs a full sort; a tuple key allocates n tuples
and compares them element-wise. I would choose by readability and measure if the sort
is on a hot path.

---

← [`reverse=True` and the pre-sort check](07d-reverse-and-the-pre-sort-check.md) · [Topic index](README.md) · Next → [Ties, DSU and determinism](08b-ties-and-determinism.md)
