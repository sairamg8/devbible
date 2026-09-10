---
title: "`list(set(items))` removes duplicates and several things you may have needed with them — the arrival order, the counts, and the choice of which duplicate survived — so dedupe with `dict.fromkeys`, a seen-set or a `Counter`, depending on which of those the caller still needs"
sidebar_label: "4 · Dedupe and what it destroys"
sidebar_position: 14
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-10 on **Python 3.14.7** against the
> [Programming FAQ](https://docs.python.org/3.14/faq/programming.html#how-do-you-remove-duplicates-from-a-list),
> the [`itertools` recipes](https://docs.python.org/3.14/library/itertools.html#itertools-recipes),
> [`dict`](https://docs.python.org/3.14/library/stdtypes.html#dict) (insertion order, `fromkeys`),
> [Set Types](https://docs.python.org/3.14/library/stdtypes.html#set-types-set-frozenset), the
> [data model](https://docs.python.org/3.14/reference/datamodel.html#set-types),
> [`json`](https://docs.python.org/3.14/library/json.html) and the
> [operator precedence footnotes](https://docs.python.org/3.14/reference/expressions.html#operator-precedence);
> CPython v3.14.7 `Objects/setobject.c` and `Lib/json/encoder.py` for behaviour and error strings the
> docs do not state, marked *implementation detail*. Documentation-verified — **no sandbox run, no
> program output**.

**Removing duplicates is the second of the three uses the documentation lists for a set, and the
one that loses the most information. `list(set(items))` is O(n) and correct for one question — *which
distinct values occur?* — and it throws away the order the values arrived in, how many times each
occurred, which of several equal values was kept, the difference between values Python considers
equal (`1`, `1.0`, `True`), and the list type itself. Each loss is a production bug somewhere. This
page takes the first three; what dedupe decides about equality, and what the container change breaks, are
[4b](04b-dedupe-equality-and-the-container.md).**

## What the documentation offers, and its condition

> *"If all elements of the list may be used as set keys (that is, they are all hashable) this is
> often faster"* — `mylist = list(set(mylist))` — *"This converts the list into a set, thereby
> removing duplicates, and then back into a list."* —
> [Programming FAQ](https://docs.python.org/3.14/faq/programming.html#how-do-you-remove-duplicates-from-a-list)

The FAQ's other answer opens with the condition this one leaves implicit: *"If you don't mind
reordering the list, sort it and then scan from the end of the list, deleting duplicates as you
go"*. Both answers reorder. Neither is wrong; each is an answer to a narrower question than "remove
the duplicates".

## Loss 1 — the order

A set iterates in slot order, which is determined by the hashes, and for strings the hashes are
salted per process — so `list(set(names))` is not only reordered, it is reordered **differently in
every run** (the mechanism is **Iteration order** *(not written yet)*). Output built from it cannot be
diffed, cached by content or asserted in a test.

A `dict` keeps insertion order, and its keys are exactly as unique as a set's elements:

> *"Dictionaries preserve insertion order. Note that updating a key does not affect the order. Keys
> added after deletion are inserted at the end."* — [`dict`](https://docs.python.org/3.14/library/stdtypes.html#dict)

> *"Create a new dictionary with keys from iterable and values set to value."* —
> [`dict.fromkeys`](https://docs.python.org/3.14/library/stdtypes.html#dict.fromkeys)

So the order-preserving dedupe of hashable values is one line, still O(n):

```python
def dedupe_keep_order(items: list[str]) -> list[str]:
    return list(dict.fromkeys(items))       # each value at the position of its first occurrence
```

When the values should be compared by some key — case-insensitively, by ID — the `itertools`
recipes give the general form. It is printed in the docs as a recipe, not an importable function
(*"The primary purpose of the itertools recipes is educational"*; the page points to the
`more-itertools` package for installable versions):

```python
from itertools import filterfalse

def unique_everseen(iterable, key=None):
    "Yield unique elements, preserving order. Remember all elements ever seen."
    # unique_everseen('AAAABBBCCDAABBB') → A B C D
    # unique_everseen('ABBcCAD', str.casefold) → A B c D
    seen = set()
    if key is None:
        for element in filterfalse(seen.__contains__, iterable):
            seen.add(element)
            yield element
    else:
        for element in iterable:
            k = key(element)
            if k not in seen:
                seen.add(k)
                yield element
```

It is lazy — it yields each new element as soon as it is seen — so it works on a stream. Its memory
still grows with the number of **distinct** keys, because the seen-set remembers all of them. If the
input is already sorted or grouped, the sibling recipe `unique_justseen` (*"Remember only the
element just seen"*) dedupes adjacent runs in constant memory.

`sorted(set(items))` is the other order you can get back — deterministic, but by value, not by
arrival — and it needs values that compare: a set of mixed `int` and `str` makes `sorted` raise
`'<' not supported between instances of 'str' and 'int'` (format string, `Objects/object.c`).

## Loss 2 — the counts

A duplicate is sometimes the data. Two lines with the same SKU on an order are a quantity of two;
dedupe turns it into one. If the question is "how many of each", the structure is a counter, not a
set:

```python
from collections import Counter

def quantities(skus: list[str]) -> dict[str, int]:
    return dict(Counter(skus))              # distinct SKUs AND how often each occurred
```

`Counter` keys are the distinct values in first-seen order, so `list(Counter(skus))` is also an
order-preserving dedupe — one that kept the counts.

## Loss 3 — which duplicate survived

When two elements are equal, the set keeps one. Which one is not stated anywhere in the set
documentation; in 3.14.7 an `add` that finds an equal element already present leaves the stored
object in place and drops the new one (implementation detail: `found_active` in
`set_add_entry_takeref`; the method's docstring is *"This has no effect if the element is already
present."*). So `set(items)` keeps the **first** of each group of equal values.

That only matters when "equal" is coarser than "identical" — which is exactly the case for records
deduplicated by a key. The two usual spellings keep different records, and one of them has an order
most people get wrong:

```python
def first_per_key(rows: list[dict], key: str) -> list[dict]:
    seen: set = set()
    kept: list[dict] = []
    for row in rows:
        if row[key] not in seen:
            seen.add(row[key])
            kept.append(row)                 # the FIRST row for each key, in first-seen order
    return kept


def last_per_key(rows: list[dict], key: str) -> list[dict]:
    return list({row[key]: row for row in rows}.values())
    # the LAST row for each key — but at the position where the key FIRST appeared,
    # because "updating a key does not affect the order"
```

`last_per_key` is the right dedupe for "latest version wins", and its output order is neither
first-row order nor last-row order. If consumers need the latest rows in the order they arrived,
sort afterwards by the field that encodes arrival.

## Gotchas

**★ Symptom: a list of tags comes back in a different order on every request, breaking HTTP caching
and snapshot tests.** Cause: `list(set(tags))` orders by slot, and string hashes are salted per
process. Fix: `list(dict.fromkeys(tags))` for arrival order, or `sorted(set(tags))` for a stable
value order.

**★ Symptom: an order total is lower than the sum of its lines.** Cause: the lines were deduplicated
by SKU before summing, so repeated SKUs counted once. Fix: count instead of dedupe — `Counter`.

**★ Symptom: after deduplicating a feed by ID, the service shows stale records.** Cause: the
seen-set dedupe keeps the **first** record per ID, and the feed lists older versions first. Fix:
`last_per_key` — and remember its order is first-appearance order.

**Symptom: `'<' not supported between instances of 'str' and 'int'` from `sorted(set(values))`.**
Cause: mixed types have no order. Fix: sort with a key that orders the types first —
`sorted(set(values), key=lambda v: (type(v).__name__, v))` — only if each type is itself orderable;
otherwise keep arrival order with `dict.fromkeys`.

**Symptom: a dedupe step on a long-running stream grows memory without bound.** Cause: the seen-set
of `unique_everseen` remembers every distinct key ever seen. Fix: if the input is sorted or grouped,
`unique_justseen` needs only the previous element; otherwise bound the window (for example, dedupe
per batch or per time bucket) and accept that duplicates across windows pass.

**Symptom: dedupe of a few thousand names takes seconds.** Cause: `if name not in result:
result.append(name)` is a list membership test per element, O(n²) overall — the loop
[3](03-set-algebra-instead-of-nested-loops.md) rewrites. Fix: `dict.fromkeys`, or a seen-set beside
the list.

## Interview questions

**★ How do you remove duplicates from a list while keeping the original order?**
For hashable values, `list(dict.fromkeys(items))`: a dict's keys are unique and the docs guarantee
insertion order, so each value lands at the position of its first occurrence, in O(n). For dedupe
by a key — case-insensitive, by ID — a generator with a seen-set, which is the `unique_everseen`
recipe; it is lazy, so it also works on a stream. `list(set(items))` does not preserve order; the
FAQ presents it with the condition *"if you don't mind reordering"* and the requirement that all
elements be hashable.

**★ What does `list(set(items))` lose besides duplicates?**
The order of arrival (and it reorders differently between processes for strings), the count of each
value, the choice of which equal value is kept (the first, in CPython), the distinction between
values that compare equal across types (`1`, `1.0`, `True`), and the list type — the result is not
indexable and not JSON-serialisable. It also fails outright on unhashable elements.

**When two records have the same ID, which one does a dict comprehension keep, and where does it put
it?**
`{r["id"]: r for r in rows}` keeps the last record for each ID, because each later assignment
replaces the value. It keeps it at the position where the ID first appeared, because the dict docs
say *"updating a key does not affect the order"*. So the result is "latest version, earliest
position" — correct for many syncs, surprising if you expected either first-row or last-row order.

---

← Prev: [Removal and mutation mid-loop](03h-removal-and-mutation-during-iteration.md) · [Topic index](README.md) · Next → [Dedupe: equality and the container](04b-dedupe-equality-and-the-container.md)
