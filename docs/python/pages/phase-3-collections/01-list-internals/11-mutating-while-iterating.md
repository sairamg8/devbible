---
title: "A list iterator is nothing but an index that keeps counting, so removing during a `for` loop skips the next element, appending can loop forever, and Python raises nothing — unlike dicts and sets, which detect it"
sidebar_label: "11 · Mutating while iterating"
sidebar_position: 26
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-10 against [Common sequence operations](https://docs.python.org/3.14/library/stdtypes.html#common-sequence-operations)
> (the iterator-index note), the tutorial's
> [`for` statements](https://docs.python.org/3.14/tutorial/controlflow.html#for-statements),
> and CPython's [`Objects/listobject.c`](https://github.com/python/cpython/blob/3.14/Objects/listobject.c)
> (`listiter_next`, `listreviter_next`, `listiter_len`), with the dict and set error
> strings from [`Objects/dictobject.c`](https://github.com/python/cpython/blob/3.14/Objects/dictobject.c)
> and [`Objects/setobject.c`](https://github.com/python/cpython/blob/3.14/Objects/setobject.c).
> Documentation-validated; **no sandbox run** — the index traces below are worked by
> hand from the documented mechanism, not captured output. Target: **CPython 3.14**
> (3.14.7).

**A `for` loop over a list does not take a snapshot. It creates an iterator holding
two things — a reference to the list and an integer index — and every step reads
`list[index]` and adds one. The documentation says precisely this, and everything
people call "weird" follows: delete the current element and the next one slides into
the slot the index just left, so it is skipped; append and the index has more road
ahead, possibly forever; insert at the front and the same element comes round again.
Python does not detect any of it for lists — dicts and sets raise `RuntimeError` when
their size changes mid-iteration, lists never do. The fixes are all the same idea —
iterate one thing, mutate another — and they are
[11b](11b-safe-ways-to-mutate.md).**

## The documented mechanism

> *"Forward and reversed iterators over mutable sequences access values using an
> index. That index will continue to march forward (or backward) even if the
> underlying sequence is mutated. The iterator terminates only when an `IndexError`
> or a `StopIteration` is encountered (or when the index drops below zero)."*

And the tutorial's advice, stated as a strategy:

> *"Code that modifies a collection while iterating over that same collection can be
> tricky to get right. Instead, it is usually more straight-forward to loop over a
> copy of the collection or to create a new collection"*

## What the iterator actually holds

`listiter_next` in 3.14, lightly trimmed:

```c
    Py_ssize_t index = FT_ATOMIC_LOAD_SSIZE_RELAXED(it->it_index);
    if (index < 0) {
        return NULL;
    }

    PyObject *item = list_get_item_ref(it->it_seq, index);
    if (item == NULL) {
        // out-of-bounds
        FT_ATOMIC_STORE_SSIZE_RELAXED(it->it_index, -1);
        ...
        return NULL;
    }
    FT_ATOMIC_STORE_SSIZE_RELAXED(it->it_index, index + 1);
    return item;
```

There is no length recorded at the start, no version counter, no check against the
list's state. The loop ends the first time `index` is out of bounds *at the moment it
is read*. Two further consequences are in those lines:

- **An exhausted iterator stays exhausted.** On running off the end it sets
  `it_index = -1` (and, in the default build, drops its reference to the list). If the
  list grows afterwards, that iterator still returns nothing.
- **`reversed(xs)` is the same machine walking down.** `listreviter_next` reads
  `index`, then stores `index - 1`, and stops when a read falls out of bounds or the
  index goes negative.

## Four mutations, traced

Each trace follows the index by hand, using the rule above.

### Removing the current element skips the next

```python
xs = ["a", "b", "c", "d"]
for x in xs:
    xs.remove(x)
```

| Step | index read | `xs` before | yields | `xs` after `remove` |
|---:|---:|---|---|---|
| 1 | 0 | `a b c d` | `a` | `b c d` |
| 2 | 1 | `b c d` | `c` | `b d` |
| 3 | 2 | `b d` | out of bounds → stop | |

`b` and `d` were never visited and survive. The same shape — "every other element
survives" — is what a filter written this way produces on real data, and it passes
any test whose bad elements are never adjacent.

### Appending gives the index more road

```python
tasks = [root]
for t in tasks:
    tasks.extend(children(t))   # visited too — the index keeps finding new items
```

This terminates only if `children` eventually returns nothing. As a deliberate
worklist it works; as an accident — appending a "retry" entry for every failure — it
loops for as long as failures keep happening, and the list grows without bound.

### Inserting at the front repeats an element forever

```python
for x in xs:
    if needs_header(x):
        xs.insert(0, header_for(x))   # x shifts to index+1 — seen again next step
```

After the insert, the element just yielded sits one slot to the right — exactly where
the index goes next. If `needs_header(x)` is still true, it inserts again, and the
loop never ends.

### Assigning in place is fine

```python
for i, price in enumerate(prices):
    prices[i] = round(price * 1.2, 2)    # same length, every slot visited once
```

Replacing an element does not move anything, so the index and the list stay in step.
This is the one mutation during iteration that is always safe.

## Lists do not detect it; dicts and sets do

Dicts and sets check their size on each step and raise `RuntimeError` with
`"dictionary changed size during iteration"` or `"Set changed size during iteration"`
— the literal strings in `Objects/dictobject.c` and `Objects/setobject.c`. Lists carry
no such check; the documentation instead *describes* the index behaviour as the
contract. So the failure for a list is always silent: skipped elements, repeated
elements, or no termination.

## Laziness makes it worse: generators, `map`, `filter`, `zip`

Anything lazy that iterates a list holds a list iterator, and reads the list *when it
is consumed*, not when it was created:

```python
active = (u for u in users if u.active)   # nothing has run yet
users.clear()                             # the generator will now find nothing
send_digest(list(active))                 # empty
```

Materialise at the point where you mean "now" — a list comprehension instead of a
generator expression.

## Gotchas

**★ Symptom: a loop that removes bad items leaves some bad items behind.** Cause: each
`remove` shifts the next element into the current slot, and the iterator's index moves
past it. Fix: rebuild instead of removing:

```python
orders[:] = [o for o in orders if not o.cancelled]
```

**★ Symptom: a loop over a list never finishes, and memory climbs.** Cause: the body
appends to the list it iterates — the index always finds another element. Fix: append
to a separate list, then combine:

```python
retries = []
for job in jobs:
    if not run(job):
        retries.append(job)
jobs.extend(retries)       # or schedule them — but not inside the same loop
```

**Symptom: indices from `enumerate` point at the wrong elements after the loop
inserted something.** Cause: `enumerate` counts iterations, not positions; an insert
shifts everything after it. Fix: collect the edits, apply them after the loop, from
the highest index down:

```python
inserts = [(i, marker) for i, x in enumerate(xs) if needs_marker(x)]
for i, marker in reversed(inserts):
    xs.insert(i, marker)
```

**Symptom: a generator or `filter` object built from a list yields nothing, or stale
data.** Cause: it reads the list when consumed, after the list changed. Fix:
materialise immediately when you mean "the current contents":

```python
current = list(filter(is_open, tickets))
```

**Symptom: an iterator reused after the list was refilled produces nothing.** Cause:
once exhausted, a list iterator sets its index to -1 and stays exhausted. Fix: create
a new iterator — iterate the list again:

```python
it = iter(buffer)
drain(it)
buffer.extend(more)
drain(iter(buffer))        # a fresh iterator; `it` is spent for good
```

## Interview questions

**★ Why does removing items inside a `for` loop over a list skip elements?**
Because the loop's iterator is just an index into the list. After yielding `xs[i]`, it
will read `xs[i+1]` next. Removing `xs[i]` shifts every later element left by one, so
the element that was at `i+1` is now at `i` — behind the index — and is never
visited. The docs describe this directly: the index *"will continue to march forward
… even if the underlying sequence is mutated."*

**Why doesn't Python raise an error for lists the way it does for dicts?**
Dicts and sets check their size on each iteration step and raise `RuntimeError` with
*dictionary changed size during iteration* or *Set changed size during iteration*. The
list iterator carries no such state — just an index and the list — and the
documentation defines its behaviour under mutation instead. So a list mutation during
iteration is never an error, only a logic bug.

**What happens if you append to a list while iterating over it?**
The iterator sees the new elements, because it compares its index against the list's
current length at every step. If each iteration appends, the loop never terminates.
Used deliberately with a condition that eventually stops appending, it behaves like a
worklist — but a `deque` consumed from the front is clearer and releases processed
items.

**Is `xs[i] = value` inside a loop over `xs` safe?**
Yes. Replacing an element changes no positions, so the iterator's index and the
elements stay aligned; every element is visited exactly once. Only operations that
change the length — `append`, `insert`, `remove`, `del`, `pop`, slice assignment of a
different length — shift what the index points at.

**A list iterator hits the end, then the list grows. What does the iterator do?**
Nothing more: on running out of bounds it sets its index to -1, and every later
`next()` returns immediately. Iterating the list again creates a new iterator that
starts from 0.

---

← [Copies and aliasing](10-copies-and-aliasing.md) · [Topic index](README.md) · Next → [Safe ways to mutate a list you are walking](11b-safe-ways-to-mutate.md)
