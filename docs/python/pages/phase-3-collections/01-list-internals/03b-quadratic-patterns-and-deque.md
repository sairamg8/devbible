---
title: "A stack is a list and a queue is a `deque` — the front of a list is the single most expensive place in Python to add or remove anything"
sidebar_label: "03b · The queue problem, and deque"
sidebar_position: 6
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-10 against the tutorial
> [Using Lists as Stacks](https://docs.python.org/3.14/tutorial/datastructures.html#using-lists-as-stacks)
> and [Using Lists as Queues](https://docs.python.org/3.14/tutorial/datastructures.html#using-lists-as-queues),
> [`collections.deque`](https://docs.python.org/3.14/library/collections.html#collections.deque),
> [Common Sequence Operations](https://docs.python.org/3.14/library/stdtypes.html#common-sequence-operations),
> and [Time complexity of operations on built-in types](https://docs.python.org/3.14/library/time-complexity.html#list).
> Documentation-validated; **no sandbox run, no timings**.
> Target: **CPython 3.14** (3.14.7).

**"Accidentally quadratic" is not a mysterious failure mode. It has exactly one
shape: an operation whose cost is proportional to the collection's size, placed
inside a loop that runs once per element. The front of a list supplies the two most
common instances — `insert(0, …)` and `pop(0)` — and repeated `+` concatenation
supplies the third. This chunk covers those three, and names `collections.deque`,
which exists precisely because of the first two, and then stops: topic 06 teaches
it.**

## The tutorial says the queue thing out loud

A stack is fine:

> *"The list methods make it very easy to use a list as a stack, where the last
> element added is the first element retrieved (\"last-in, first-out\"). To add an
> item to the top of the stack, use `append()`. To retrieve an item from the top of
> the stack, use `pop()` without an explicit index."*

A queue is not:

> *"It is also possible to use a list as a queue, where the first element added is
> the first element retrieved (\"first-in, first-out\"); however, lists are not
> efficient for this purpose. While appends and pops from the end of list are fast,
> doing inserts or pops from the beginning of a list is slow (because all of the
> other elements have to be shifted by one)."*

> *"To implement a queue, use `collections.deque` which was designed to have fast
> appends and pops from both ends."*

And the `collections` reference gives the comparison in one paragraph:

> *"Though list objects support similar operations, they are optimized for fast
> fixed-length operations and incur O(n) memory movement costs for `pop(0)` and
> `insert(0, v)` operations which change both the size and position of the
> underlying data representation."*

> *"Deques support thread-safe, memory efficient appends and pops from either side
> of the deque with approximately the same O(1) performance in either direction."*

A stack is a list. A queue is a `deque`. That is the whole decision, and topic 06 of
this phase owns everything else about `deque` — `maxlen`, `rotate`, and why indexing
into the middle of one is *not* O(1).

## Pattern 1 · Draining from the front

```python
# quadratic — every pop(0) shifts the whole remaining list
while tasks:
    task = tasks.pop(0)
    handle(task)

# linear — the deque was built for exactly this
from collections import deque

queue = deque(tasks)
while queue:
    handle(queue.popleft())
```

If you cannot change the type — the list came from a caller — iterate it forward
instead of consuming it, and clear once at the end:

```python
for task in tasks:
    handle(task)
tasks.clear()
```

## Pattern 2 · Building from the front

```python
# quadratic — n inserts, each shifting everything already there
out = []
for item in source:
    out.insert(0, transform(item))

# linear — append, then one in-place reverse
out = [transform(item) for item in source]
out.reverse()
```

`list.reverse()` is a single pass of swaps from both ends inward; the docs note it
*"maintains economy of space when reversing a large sequence."* If you only need to
*read* in reverse, use `reversed(out)`, which copies nothing at all.

## Pattern 3 · Concatenating in a loop

```python
# quadratic — `+` builds a NEW list of len(xs)+1 on every iteration
xs = []
for item in source:
    xs = xs + [item]

# linear — in-place growth, amortised O(1) per item
xs = []
for item in source:
    xs.append(item)
```

The documentation states the general form for immutable sequences, and the lesson
carries straight over:

> *"Concatenating immutable sequences always results in a new object. This means
> that building up a sequence by repeated concatenation will have a quadratic
> runtime cost in the total sequence length."*
> … *"if concatenating tuple objects, extend a list instead"*

The complexity page says it again for `str`: *"Each concatenation builds a new
object, so building a string by concatenating many pieces in a loop is quadratic in
the total length."* The fix there is `str.join`; the fix here is `append`/`extend`.

## Pattern 4 · Flattening with `+`

```python
# quadratic in the total length — each + copies everything so far
flat = []
for group in groups:
    flat = flat + group

# linear — extend in place, or chain lazily
flat = []
for group in groups:
    flat.extend(group)

from itertools import chain
flat = list(chain.from_iterable(groups))
```

## Pattern 5 · `pop(0)` hidden behind an abstraction

The pattern survives refactoring because it stops being visible:

```python
class Backlog:
    def __init__(self, items):
        self._items = list(items)

    def next(self):
        return self._items.pop(0)      # O(n), invisible from the call site
```

The fix is one import and one word, and no caller changes:

```python
from collections import deque

class Backlog:
    def __init__(self, items):
        self._items = deque(items)

    def next(self):
        return self._items.popleft()   # O(1)
```

## Gotchas

### The quadratic loop passes every test
**Symptom.** Perfect test suite, perfect staging, and a timeout in production on the
first customer with a large data set.
**Cause.** Quadratic growth is invisible below a threshold. A 100-item fixture and a
100,000-item table differ by 10⁶ in work, and by nothing at all in behaviour.
**Fix.** Test the shape, not just the result — assert that the hot path uses the
right structure:

```python
def test_backlog_uses_a_deque():
    from collections import deque
    assert isinstance(Backlog([])._items, deque)
```

### "I profiled it and `pop` was not hot"
**Symptom.** A profiler attributes the time to a C-level memory move inside `pop`,
or spreads it thinly, and the loop looks innocent.
**Cause.** Moving a block of pointers is extremely fast *per byte*; the cost only
shows as the length grows. Sampling profilers on small inputs will not see it.
**Fix.** Reason about the shape first and measure second. If a loop over n items
calls an O(n) operation on the same collection, it is O(n²) whatever the profiler
says at n = 200.

### Swapping `list` for `deque` and then indexing into it
**Symptom.** A queue rewrite makes the drain fast and some other loop slow.
**Cause.** `deque` is not an array; the docs describe it as optimised for the two
ends. Random access into the middle is not O(1).
**Fix.** Use each for what it is — `deque` for FIFO, `list` when you need indexing:

```python
queue = deque(work)          # popleft/append only
snapshot = list(queue)       # take a list when you need random access
```

### `deque(maxlen=…)` silently discarding data
**Symptom.** A bounded buffer used as a queue loses the oldest items with no error.
**Cause.** The docs are explicit: *"Once a bounded length deque is full, when new
items are added, a corresponding number of items are discarded from the opposite
end."* That is a feature for a tail buffer and a data-loss bug for a work queue.
**Fix.** Leave `maxlen` unset for a work queue; use it only where dropping is the
intent:

```python
recent_errors = deque(maxlen=100)   # a tail buffer — dropping is correct
work = deque()                      # a work queue — never bound it silently
```

### Reaching for `deque` when the real problem is that the list should not exist
**Symptom.** A `deque` rewrite makes the drain O(1) and the process still runs out
of memory.
**Cause.** The structure was never the problem; materialising the whole workload was.
**Fix.** Stream it — process one item at a time and never hold the collection:

```python
for task in iter_tasks_from_queue():   # a generator, one task resident
    handle(task)
```

## Interview questions

**★ What does "accidentally quadratic" mean, and how do you spot it in a review?**
It means an algorithm whose runtime grows with the square of the input because a
linear operation sits inside a linear loop. In Python it is almost always a list
operation that reads as one cheap step: `x in xs`, `xs.index(x)`, `xs.remove(x)`,
`xs.insert(0, x)`, `xs.pop(0)`, or `xs = xs + [x]`. The review test is mechanical:
for each call in a loop body, ask whether its cost depends on the size of the same
collection the loop is walking.

**★ When should a list become a `deque`?**
When the access pattern touches the *front*. Appends and pops at the end are O(1) on
a list; anything at index 0 is O(n) because the whole tail shifts. `deque` is
documented as giving *"approximately the same O(1) performance in either
direction"*. If you also need random access by index, you want a list, and you
should rethink the algorithm rather than the structure.

**Why is `xs = xs + [item]` in a loop worse than `xs.append(item)`?**
`+` builds a *new* list containing every existing element plus the new one, so
iteration `i` copies `i` pointers — quadratic in total, plus n discarded lists for
the collector. `append` writes one pointer into existing spare capacity and only
occasionally reallocates, which is amortised O(1). The docs make the general claim
for immutable sequences: *"building up a sequence by repeated concatenation will
have a quadratic runtime cost in the total sequence length."*

**A list is fine as a stack but not as a queue. Why the asymmetry?**
Because both stack operations happen at the *end*, where nothing has to move:
`append` writes into spare capacity and `pop()` decrements the length. A queue takes
from the *front*, where every remaining element must shift left one slot to keep the
array contiguous. The array layout that makes indexing O(1) is exactly what makes
front removal O(n) — you do not get both from one structure.

**Why does this class of bug survive code review so reliably?**
Because Python's syntax gives no cost signal. `x in xs` and `x in some_set` are the
same three tokens with an enormous difference at scale; `xs.pop(0)` and `xs.pop()`
differ by one character. Nothing in the reading experience says "this line walks the
whole collection". The only defence is knowing the cost table, which is why 3.14
shipping [a first-party one](01b-the-complexity-table.md) is genuinely useful.

---

← [The O(n) shift](03-the-o-n-shift.md) · [Topic index](README.md) · Next → [Linear scans inside loops](03c-linear-scans-in-loops.md)
