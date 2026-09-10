---
title: "bisect's key= is applied to the list's elements and never to the value you search for, insort's key= is applied to the record you insert — the same keyword with opposite meanings for x — and because the key runs on every probe, the fast version searches a list of precomputed keys"
sidebar_label: "07b · The key= parameter and its asymmetry"
sidebar_position: 14
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-10 against the Python 3.14 [`bisect` documentation](https://docs.python.org/3.14/library/bisect.html) (the `key` paragraphs of each function, [Performance Notes](https://docs.python.org/3.14/library/bisect.html#performance-notes), [Examples](https://docs.python.org/3.14/library/bisect.html#examples)) and CPython **v3.14.7** source — [`Lib/bisect.py`](https://github.com/python/cpython/blob/v3.14.7/Lib/bisect.py) (lines 4–18, 48–54, 100–107), [`Modules/_bisectmodule.c`](https://github.com/python/cpython/blob/v3.14.7/Modules/_bisectmodule.c) (lines 90–96, 201–234) and `Lib/test/test_bisect.py` (`test_lookups_with_key_function`, `test_insort_keynotNone`, `test_large_range`). Target: **Python 3.14.7**. **No sandbox run, no timings.**

**Since 3.10 every `bisect` function takes a keyword-only `key=`, so a list of records sorted by a field can be searched by that field. The trap is that the keyword means different things for `x` depending on the function. The search functions apply `key` to the *elements* only: you pass a key value — a timestamp, an ID — not a record. The insertion functions apply `key` to `x` as well, because they need the record to insert: you pass the record. Swap them and you get a `TypeError` or a silently wrong position. The second trap is cost: the search functions keep nothing between calls, so the key is recomputed for every element each search probes — about log2(n) calls per lookup, and the same elements again on the next lookup. The documentation's answer is a parallel list of precomputed keys. And because the key is applied to whatever the sequence returns, `bisect_left(range(lo, hi), True, key=predicate)` is binary search over a monotonic yes/no question without building any list at all.**

The general rules for key functions — `itemgetter`, `attrgetter`, multi-field keys — belong to
**10 · Sorting compound data** *(not written yet)*; the `key=` contract shared by `min`, `max`,
`heapq` and `bisect` is summarised in
[Phase 1 — `min`, `max`, `heapq`, `bisect`, `groupby`](../../phase-1-language-core/06-comparisons/08c-min-max-heapq-bisect-groupby.md).

## The two sentences that define it

> *"*key* specifies a key function of one argument that is used to extract a comparison key from
> each element in the array. To support searching complex records, the key function is not
> applied to the *x* value."* — `bisect_left`

> *"To support inserting records in a table, the *key* function (if any) is applied to *x* for the
> search step but not for the insertion step."* — `insort_left`

The source makes the asymmetry concrete. The search compares `key(a[mid])` with `x` as given; the
insertion computes `key(x)` once and then searches with it:

```python
# Lib/bisect.py, v3.14.7 — bisect_left, keyed branch shown
def bisect_left(a, x, lo=0, hi=None, *, key=None):
    if lo < 0:
        raise ValueError('lo must be non-negative')
    if hi is None:
        hi = len(a)
    while lo < hi:
        mid = (lo + hi) // 2
        if key(a[mid]) < x:               # key on the element, never on x
            lo = mid + 1
        else:
            hi = mid
    return lo

def insort_left(a, x, lo=0, hi=None, *, key=None):
    if key is None:
        lo = bisect_left(a, x, lo, hi)
    else:
        lo = bisect_left(a, key(x), lo, hi, key=key)   # key on x, once
    a.insert(lo, x)                                    # the record itself goes in
```

| Call | What `x` must be | What `key` is applied to |
|---|---|---|
| `bisect_left(a, x, key=f)` / `bisect_right` | a **key value** — `f(some_record)` | each probed element `a[mid]` |
| `insort_left(a, x, key=f)` / `insort_right` | a **record** — the thing stored in `a` | `x` once, then each probed element |

The documentation's own example, with a list of `namedtuple` records sorted by year:

```python
from bisect import bisect, insort
from collections import namedtuple
from operator import attrgetter

Movie = namedtuple('Movie', ('name', 'released', 'director'))
movies = [
    Movie('Jaws', 1975, 'Spielberg'),
    Movie('Titanic', 1997, 'Cameron'),
    Movie('The Birds', 1963, 'Hitchcock'),
    Movie('Aliens', 1986, 'Cameron'),
]

by_year = attrgetter('released')
movies.sort(key=by_year)
first_after_1960 = movies[bisect(movies, 1960, key=by_year)]   # search: pass a year

romance = Movie('Love Story', 1970, 'Hiller')
insort(movies, romance, key=by_year)                            # insert: pass the record
```

The key used to search must be the key the list is sorted by. Nothing enforces it; searching a
list sorted by `released` with `key=attrgetter('name')` returns a meaningless index.

## The key runs on every probe

> *"The search functions are stateless and discard key function results after they are used.
> Consequently, if the search functions are used in a loop, the key function may be called again
> and again on the same array elements. If the key function isn't fast, consider wrapping it with
> `functools.cache` to avoid duplicate computations. Alternatively, consider searching an array of
> precomputed keys to locate the insertion point (as shown in the examples section below)."*

A lookup probes about log2(n) elements and calls the key on each. For `attrgetter` that is cheap;
for a key that parses a timestamp string or computes a distance, a loop of lookups repeats the
same work on the same central elements — the midpoint of the full range is probed by *every*
search.

`functools.cache` only helps when the elements are hashable — a cached key over dicts raises
`TypeError: unhashable type` — and it keeps every element alive in the cache. The general fix is
the one the documentation shows: compute the keys once into a parallel sorted list, search that
with no key at all, and use the index on the records:

```python
from bisect import bisect_left, bisect_right
from datetime import datetime

class EventLog:
    """Events sorted by timestamp, with O(log n) range lookups and no per-probe parsing."""

    def __init__(self, events: list[dict]) -> None:
        self._events = sorted(events, key=lambda e: datetime.fromisoformat(e["ts"]))
        self._stamps = [datetime.fromisoformat(e["ts"]) for e in self._events]   # parsed once

    def between(self, start: datetime, end: datetime) -> list[dict]:
        i = bisect_left(self._stamps, start)     # no key: plain datetime comparisons
        j = bisect_left(self._stamps, end)       # half-open: [start, end)
        return self._events[i:j]

    def add(self, event: dict) -> None:
        stamp = datetime.fromisoformat(event["ts"])
        i = bisect_right(self._stamps, stamp)
        self._stamps.insert(i, stamp)            # both lists, same index, same moment
        self._events.insert(i, event)
```

The two lists must change together, at the same index, or every later lookup returns the wrong
record. Wrapping them in one class, as above, is how that stays true.

## Binary search on the answer

`bisect` searches whatever the sequence's `__getitem__` returns, and the key is applied to that.
A `range` is a sequence of candidate answers that is never materialised; a key that returns
`False` below the answer and `True` from the answer on turns "find the smallest value for which
this holds" into `bisect_left(range(...), True, key=...)`, because `False < True`:

```python
from bisect import bisect_left
from collections.abc import Callable

def smallest_batch_that_fits(max_batch: int, fits: Callable[[int], bool]) -> int | None:
    """fits(n) must be False for all n below the answer and True from it on."""
    candidates = range(1, max_batch + 1)
    i = bisect_left(candidates, True, key=fits)   # about log2(max_batch) calls to fits()
    return candidates[i] if i < len(candidates) else None
```

The same shape finds the first deployment in an ordered release list whose health check fails,
the lowest rate limit that keeps a replayed traffic sample under a latency budget, or the first
day on which cumulative spend crosses a budget. CPython's test suite bisects a
`range(sys.maxsize - 1)`, so the size of the candidate space is not a concern — only that the
predicate is **monotonic**. If `fits` can go `True`, `False`, `True`, the answer is arbitrary.
The documentation does not show this pattern; it follows from the documented behaviour of `key`
and from `range` being a sequence.

## Keys that change the question

- **Case-insensitive search.** Sort with `key=str.casefold` and search with the same key — then
  `x` must already be case-folded, because the key is not applied to it:
  `bisect_left(names, query.casefold(), key=str.casefold)`.
- **Descending order.** Search a descending numeric list with a negating key and a negated `x`:
  `bisect_left(scores_desc, -91, key=lambda s: -s)` ([07](07-bisect-left-and-right.md)).
- **Tuple keys and prefixes.** A shorter tuple sorts before every longer tuple it is a prefix of,
  so `(tenant,)` is the lower bound of all `(tenant, day)` keys —
  [02 · `tuple` — sort keys](../02-tuple/09b-sort-keys-and-priority-queues.md) walks through it.

## Gotchas

### Passing the record to a search function
**Symptom.** `TypeError: '<' not supported between instances of 'int' and 'Movie'` — or, with
records that happen to compare, an index that is off.
**Cause.** The search compares `key(a[mid]) < x`; `x` must already be a key value.
**Fix.** Apply the key yourself on the way in:

```python
i = bisect_left(movies, by_year(target_movie), key=by_year)
```

### Passing a key value to an insertion function
**Symptom.** `AttributeError: 'int' object has no attribute 'released'` from `insort`, or a
`TypeError` from calling the key on a bare value.
**Cause.** `insort` computes `key(x)`; it needs the record, and the record is what gets stored.
**Fix.** `insort(movies, romance, key=by_year)` — never `insort(movies, 1970, key=by_year)`.

### Searching with a different key from the one the list was sorted by
**Symptom.** Lookups by `name` on a list sorted by `created_at` return random-looking positions.
**Cause.** Binary search assumes the keys it computes are in ascending order along the list.
**Fix.** One sort key per list. For a second access path keep a second sorted list — or a dict
for exact lookups.

### A slow key inside a loop of lookups
**Symptom.** A batch job that places 100,000 values into sorted buckets spends most of its time
in the key function.
**Cause.** About log2(n) key calls per lookup, recomputed for the same elements every time.
**Fix.** Precompute the keys once into a parallel list and search it without `key=`, as
`EventLog` does.

### `functools.cache` on a key over unhashable records
**Symptom.** `TypeError: unhashable type: 'dict'` after following the documentation's caching
suggestion.
**Cause.** `functools.cache` keys its cache by the argument, and dicts are not hashable.
**Fix.** Precomputed keys, which work for anything:
`stamps = [parse_ts(e) for e in events]`, then `bisect_left(stamps, target)`.

### Parallel key list out of step with the records
**Symptom.** After a few inserts, `between()` returns events outside the requested window.
**Cause.** A record was inserted into one list and not the other, or at a different index.
**Fix.** Mutate both lists in one method, using one computed index (`EventLog.add`).

### A non-monotonic predicate in a binary search on the answer
**Symptom.** "Smallest batch that fits" returns a size that does not fit, or skips a smaller one
that does.
**Cause.** Bisection assumes every `False` comes before every `True`. A flaky or non-monotonic
check breaks that.
**Fix.** Make the predicate monotonic — repeat noisy measurements, or define "fits" with a
safety margin — and verify the answer and its neighbour after the search:
`assert fits(answer) and (answer == 1 or not fits(answer - 1))`.

### Case-insensitive search with an un-folded query
**Symptom.** `"Zoe"` is not found in a list that contains `"zoe"`, sorted with `key=str.casefold`.
**Cause.** The key is applied to elements, not to the query.
**Fix.** `bisect_left(names, "Zoe".casefold(), key=str.casefold)`.

## Interview questions

**★ Why does `bisect_left(a, x, key=f)` not apply `f` to `x`, while `insort_left(a, x, key=f)` does?**
Because they are used on different things. Searching a table of records is usually done with a
bare key — a year, a timestamp — and the documentation says the key is not applied to `x` *"to
support searching complex records"*. Inserting into a table needs the record itself, since that
is what gets stored, so `insort` applies the key to `x` for the search step and inserts the
untransformed record. Mixing them up gives `TypeError`s or silently wrong positions.

**★ How can you use `bisect` to find the smallest input for which a condition holds?**
Pass a `range` of candidates and a key that returns the condition's boolean:
`bisect_left(range(lo, hi), True, key=condition)`. Because `False < True`, the first index whose
key is `True` is exactly the insertion point for `True`. It makes about log2 of the range's length
calls, never builds a list, and is only correct if the condition is monotonic — false up to the
answer, true from it on.

**How do you avoid calling an expensive key function over and over during many searches?**
Precompute the keys once into a list aligned with the records, search that list with no key, and
use the resulting index into the records. `functools.cache` is the documentation's other
suggestion, but it needs hashable elements and keeps them alive.

**How many times does a single `bisect_left(a, x, key=f)` call `f`?**
Once per probe — about log2(len(a)) times — and never on `x`. It keeps nothing between calls, so
the next search pays again, including for the midpoint of the whole list, which every search
probes first.

**What must be true of the list for a keyed search to be correct?**
It must be sorted ascending by the same key: `a == sorted(a, key=f)`. `bisect` never checks this.

---

← Prev: [07 · `bisect_left` and `bisect_right`](07-bisect-left-and-right.md) · [Topic index](README.md) · Next → [08 · `insort` and the cost of keeping a list sorted](08-insort-and-sorted-list-cost.md)
