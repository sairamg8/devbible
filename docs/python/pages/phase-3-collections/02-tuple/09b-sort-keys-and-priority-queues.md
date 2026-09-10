---
title: "A tuple sort key gives you a multi-level sort for free, a heap entry needs a counter in the middle so ties never reach the payload, and a one-element tuple is the lower bound that turns a sorted list of keys back into a prefix index"
sidebar_label: "9b · Sort keys and priority queues"
sidebar_position: 26
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-10 against the Python 3.14 [Sorting Techniques](https://docs.python.org/3.14/howto/sorting.html)
> HOWTO; [`operator.itemgetter`](https://docs.python.org/3.14/library/operator.html#operator.itemgetter)
> and [`operator.attrgetter`](https://docs.python.org/3.14/library/operator.html#operator.attrgetter);
> the [`heapq` priority-queue notes](https://docs.python.org/3.14/library/heapq.html#priority-queue-implementation-notes);
> and [`bisect`](https://docs.python.org/3.14/library/bisect.html). Documentation-verified —
> **no sandbox run**. Version spine: **CPython 3.14**.

**Everything useful about tuple ordering comes down to one sentence in the sorting HOWTO:
*"This idiom works because tuples are compared lexicographically; the first items are compared;
if they are the same then the second items are compared, and so on."* That makes `key=lambda r:
(r.tenant, r.day)` a two-level sort, `itemgetter(1, 2)` a two-column one, and `(priority,
count, task)` a heap entry that is ordered by priority and first-in-first-out within a
priority. The traps are the same rule seen from the other side: a tie on the leading items
hands the comparison to the next one, so the next one had better be orderable — which is why
the counter exists, why `reverse=True` cannot mix directions, and why the HOWTO's own
decorated tuples carry an index.**

## A tuple key is a multi-level sort

> *"The operator module functions allow multiple levels of sorting. For example, to sort by
> *grade* then by *age*: `sorted(student_tuples, key=itemgetter(1,2))`"* —
> [Sorting Techniques](https://docs.python.org/3.14/howto/sorting.html)

`itemgetter` and `attrgetter` build the tuple for you — `itemgetter`: *"If multiple items are
specified, returns a tuple of lookup values"*; `attrgetter`: *"If more than one attribute is
requested, returns a tuple of attributes."*

```python
from operator import attrgetter, itemgetter

orders.sort(key=attrgetter("tenant", "created_at"))      # tenant, then time
rows.sort(key=itemgetter(2, 0))                          # column 2, then column 0
orders.sort(key=lambda o: (o.tenant, -o.total_cents))    # tenant asc, total desc
```

The last line is the mixed-direction trick for numbers: negate the field that should descend.
It only works for values with a unary minus. For strings and dates, use the property the HOWTO
calls out — *"Sorts are guaranteed to be stable. That means that when multiple records have the
same key, their original order is preserved"* — and sort twice, least significant key first:

> *"This wonderful property lets you build complex sorts in a series of sorting steps. For
> example, to sort the student data by descending *grade* and then ascending *age*, do the
> *age* sort first and then sort again using *grade*"*

```python
orders.sort(key=attrgetter("created_at"))                  # secondary: ascending
orders.sort(key=attrgetter("tenant"), reverse=True)        # primary: descending
```

`reverse=True` keeps the stability — *"The *reverse* parameter still maintains sort stability
(so that records with equal keys retain the original order)"* — which is what makes the second
pass safe.

## Missing values in a key

From [9](09-comparison-and-ordering.md): a `None` in a key only raises when everything before it
ties. The robust key puts a boolean in front of the optional value:

```python
def discount_key(order):
    return (order.discount_pct is None, order.discount_pct)

orders.sort(key=discount_key)          # real discounts ascending, then all the Nones
```

A real value gives `(False, 12)`; a missing one gives `(True, None)`. Real and missing never
reach the second position against each other — `False` and `True` already differ — and two
missing values tie on `True` and then on `None == None`, which the prefix scan tests with `==`,
not `<`. The HOWTO's alternative is to drop them: *"`None` can be stripped from datasets as
well … This is needed because `None` is not comparable to other types."*

## Decorate-sort-undecorate, and why the index is there

The HOWTO's DSU example decorates each item as `(student.grade, i, student)` and explains the
middle element:

> *"It is not strictly necessary in all cases to include the index *i* in the decorated list,
> but including it gives two benefits:
>  * The sort is stable -- if two items have the same key, their order will be preserved in the
>    sorted list.
>  * The original items do not have to be comparable because the ordering of the decorated
>    tuples will be determined by at most the first two items."*

The second benefit is the important one: indices are unique, so no two decorated tuples ever
tie on the first two positions, and the comparison never reaches the payload. With `key=`,
`list.sort` compares only the keys — *"The key corresponding to each item in the list is
calculated once and then used for the entire sorting process"* — and the HOWTO concludes that
*"now that Python sorting provides key-functions, this technique is not often needed."* Where
it is still needed is anywhere there is no `key=` parameter: heaps.

## Heaps: `(priority, count, task)`

`heapq` has no `key=`, so the entries themselves must order correctly, and the documentation
names the failure a plain pair runs into:

> *"Tuple comparison breaks for (priority, task) pairs if the priorities are equal and the tasks
> do not have a default comparison order."*

> *"A solution to the first two challenges is to store entries as 3-element list including the
> priority, an entry count, and the task.  The entry count serves as a tie-breaker so that two
> tasks with the same priority are returned in the order they were added. And since no two entry
> counts are the same, the tuple comparison will never attempt to directly compare two tasks."* —
> [`heapq` notes](https://docs.python.org/3.14/library/heapq.html#priority-queue-implementation-notes)

```python
import heapq
import itertools

queue: list[tuple[int, int, Job]] = []
counter = itertools.count()

def submit(job: Job, priority: int) -> None:
    heapq.heappush(queue, (priority, next(counter), job))

def next_job() -> Job:
    _priority, _seq, job = heapq.heappop(queue)
    return job
```

⚠️ The documentation's recipe uses a **list** — `entry = [priority, count, task]` — not a
tuple, because its removal scheme later marks an entry dead in place with `entry[-1] = REMOVED`.
If you need lazy deletion, the entry must be mutable; if you do not, a tuple is fine and cannot
be corrupted after it is pushed.

The documented alternative avoids comparing the payload by making it invisible to comparison
— note that it solves the non-comparable-task problem only; equal priorities then compare equal,
and the heap does not promise first-in-first-out among them the way the counter does:

```python
from dataclasses import dataclass, field
from typing import Any

@dataclass(order=True)
class PrioritizedItem:
    priority: int
    item: Any = field(compare=False)
```

## A sorted list of tuple keys is a prefix index

The flat-key cost from [4b](04b-the-cost-of-a-flat-key.md) — a dict keyed on `(tenant, day)`
cannot answer "every day for `acme`" without a full scan — has a cheap answer when the keys are
kept sorted. Because the shorter tuple orders first, `("acme",)` sorts before every
`("acme", day)`, so it is the lower bound of the group:

```python
from bisect import bisect_left

keys = sorted(views)                         # [(tenant, day), ...]

def days_for(tenant: str) -> list[str]:
    i = bisect_left(keys, (tenant,))         # first key with this tenant, or later
    days = []
    while i < len(keys) and keys[i][0] == tenant:
        days.append(keys[i][1])
        i += 1
    return days
```

(Walking by index matters: `keys[i:]` would copy the whole tail of the list before the loop
starts, and the lookup would be linear again.)

That is a binary search plus the size of the group, instead of a scan of every key — worth it
when the group query is frequent and the key set changes rarely.

## Gotchas

**★ Symptom: `TypeError: '<' not supported between instances of 'Job' and 'Job'` from
`heapq.heappush`.** Cause: two entries had equal priorities, so the tuple comparison moved on to
the jobs, which have no ordering — the exact failure the `heapq` documentation describes. Fix:
put a unique counter between the priority and the payload.

```python
heapq.heappush(queue, (priority, next(counter), job))
```

**★ Symptom: `sorted(..., key=lambda r: (r.score, r.name), reverse=True)` put names in reverse
alphabetical order too.** Cause: `reverse=True` reverses the whole comparison, every position of
the key. Fix: negate the numeric field, or sort twice using stability.

```python
ranked = sorted(players, key=lambda p: (-p.score, p.name))
```

**★ Symptom: `TypeError: bad operand type for unary -: 'str'` from a key written to sort names
descending.** Cause: negation only works on numbers. Fix: two stable passes, secondary key first.

```python
users.sort(key=attrgetter("signup_date"))
users.sort(key=attrgetter("last_name"), reverse=True)
```

**Symptom: code that unpacks `itemgetter(*columns)(row)` fails when `columns` has one element.**
Cause: `itemgetter` returns a tuple only *"if multiple items are specified"*; with one item it
returns the bare value. Fix: normalise to a tuple.

```python
def pick(row, columns):
    getter = itemgetter(*columns)
    return (getter(row),) if len(columns) == 1 else getter(row)
```

**Symptom: after switching heap entries from lists to tuples, "cancel job" stopped working.**
Cause: the cancellation marked entries dead in place (`entry[-1] = REMOVED`), which a tuple
refuses. Fix: keep a list entry for the lazy-deletion recipe, or keep tuples and track cancelled
sequence numbers in a set.

```python
cancelled: set[int] = set()

def next_live_job() -> Job:
    while True:
        _priority, seq, job = heapq.heappop(queue)
        if seq not in cancelled:
            return job
        cancelled.discard(seq)
```

**Symptom: a list of `(score, payload_dict)` sorts in tests and raises in production.** Cause:
production data has tied scores, which hands the comparison to the dicts. Fix: key on the score
alone; stability keeps ties in input order.

```python
results.sort(key=itemgetter(0), reverse=True)
```

## Interview questions

**★ How do you sort by one field descending and another ascending?**
If the descending field is numeric, negate it inside a tuple key: `key=lambda r: (-r.total,
r.name)`. Otherwise use stability: sort by the secondary key first, then by the primary key with
`reverse=True`. The HOWTO documents both halves — stability is guaranteed, and `reverse` still
preserves it — so the second pass keeps the first pass's order within each group. `reverse=True`
on a single tuple key cannot do it, because it reverses every position.

**★ Why does a `heapq` entry need a counter?**
Because `heapq` orders the entries themselves, and tuple comparison moves to the next position on
a tie. With `(priority, task)`, two equal priorities make the heap compare the tasks, which
raises if tasks are not orderable and gives an arbitrary order if they are. A monotonically
increasing counter in the middle is unique, so ties are broken by insertion order and the task is
never compared — the documentation's own recipe.

**Why does the HOWTO's decorate-sort-undecorate example include the index?**
Two reasons it gives: stability, since equal keys are then ordered by original position; and
safety, because *"the original items do not have to be comparable"* — unique indices mean no two
decorated tuples ever tie on the first two items, so the comparison never reaches the item.

**What does `itemgetter(1, 2)` return, and what does `itemgetter(1)` return?**
`itemgetter(1, 2)(row)` returns the tuple `(row[1], row[2])`, which is what makes it a
multi-level sort key. `itemgetter(1)(row)` returns `row[1]` itself, not a 1-tuple — the
documentation specifies a tuple only when multiple items are requested. Code that builds getters
from a variable list of columns has to handle the single-column case.

**How do you keep `None` values from breaking a sort key?**
Put a boolean in front: `(value is None, value)`. Present values produce `(False, v)` and sort
among themselves; missing ones produce `(True, None)` and sort after them. A present and a
missing value are decided by the booleans, and two missing values tie through `None == None`,
which the tuple comparison checks with equality rather than ordering. Flip the boolean to put
missing values first.

**How can a sorted list of tuples answer a prefix query?**
With `bisect_left(keys, (prefix,))`. A shorter tuple is ordered before any longer tuple it is a
prefix of, so `(tenant,)` lands exactly at the first `(tenant, …)` key; walk forward by index
from there until the first element changes. It is a binary search plus the size of the group, and it recovers the
prefix lookup a flat tuple-keyed dict gives up.

---

← [Comparison and ordering](09-comparison-and-ordering.md) · [Topic index](README.md) · Next → [The real surface](10-cost-and-the-real-surface.md)
