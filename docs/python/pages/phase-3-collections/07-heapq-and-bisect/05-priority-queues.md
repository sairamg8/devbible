---
title: "A heap is a priority queue only once every entry is totally ordered — the counter in (priority, count, item) buys first-in-first-out ties and guarantees the payload is never compared, and the priority itself must be a value that orders, points the right way and cannot starve the queue"
sidebar_label: "05 · Priority queues — ties and the counter"
sidebar_position: 8
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-10 against the Python 3.14 documentation — [`heapq` Priority Queue Implementation Notes](https://docs.python.org/3.14/library/heapq.html#priority-queue-implementation-notes), [`queue.PriorityQueue`](https://docs.python.org/3.14/library/queue.html#queue.PriorityQueue), [`loop.call_later`](https://docs.python.org/3.14/library/asyncio-eventloop.html#asyncio.loop.call_later) — and CPython **v3.14.7** source: [`Lib/sched.py`](https://github.com/python/cpython/blob/v3.14.7/Lib/sched.py) (lines 35–41, 62–75), [`Lib/asyncio/events.py`](https://github.com/python/cpython/blob/v3.14.7/Lib/asyncio/events.py) (lines 162–165). Target: **Python 3.14.7**. **No sandbox run, no timings.**

**`heapq` has no `key=` and no notion of "priority": it orders whole entries with `<`. So a priority queue is a design decision about the entry, and the documentation's answer is a three-part record — the priority, a unique increasing count, then the item. The count does two jobs at once: equal priorities come out in the order they went in, and because no two counts are equal, tuple comparison is always settled before it reaches the item, which therefore never needs to be comparable at all. The standard library shows both sides of this: `sched` puts a `sequence` field in every event, while asyncio's timer heap compares only the deadline and documents the consequence — equal deadlines run in an undefined order. The remaining design questions are about the priority itself: its type must order against every other priority in the queue, its direction must match a min-heap, and a strict priority order will starve low-priority work under sustained load unless the priority is turned into a deadline.**

The tuple-comparison basics — why `(priority, job)` raises only on a tie, and the counter as the
fix — are in [02 · `tuple` — sort keys and priority queues](../02-tuple/09b-sort-keys-and-priority-queues.md).
This chunk takes the entry design the rest of the way.

## The four problems the documentation names

> *"A priority queue is common use for a heap, and it presents several implementation
> challenges:*
> - *Sort stability: how do you get two tasks with equal priorities to be returned in the order
>   they were originally added?*
> - *Tuple comparison breaks for (priority, task) pairs if the priorities are equal and the tasks
>   do not have a default comparison order.*
> - *If the priority of a task changes, how do you move it to a new position in the heap?*
> - *Or if a pending task needs to be deleted, how do you find it and remove it from the queue?"*

> *"A solution to the first two challenges is to store entries as 3-element list including the
> priority, an entry count, and the task. The entry count serves as a tie-breaker so that two
> tasks with the same priority are returned in the order they were added. And since no two entry
> counts are the same, the tuple comparison will never attempt to directly compare two tasks."*

The last two problems — changing and deleting — are the subject of
[05b](05b-removal-and-update.md); here the entry is designed so that the first two can never
happen.

## The entry, written out

```python
import heapq
import itertools
from dataclasses import dataclass

@dataclass(frozen=True)
class EmailJob:
    template: str
    recipient: str

class JobQueue:
    """Lowest priority number first; equal priorities first-in-first-out."""

    def __init__(self) -> None:
        self._heap: list[tuple[int, int, EmailJob]] = []
        self._seq = itertools.count()          # one counter per queue, never reset

    def push(self, priority: int, job: EmailJob) -> None:
        heapq.heappush(self._heap, (priority, next(self._seq), job))

    def pop(self) -> EmailJob:
        _priority, _seq, job = heapq.heappop(self._heap)
        return job

    def __len__(self) -> int:
        return len(self._heap)
```

`EmailJob` has no ordering and needs none. Any two entries differ in the second field, so the
comparison is decided by `(priority, seq)` and the job object is carried, never compared. The
counter must be **unique within the heap** — that is what keeps the payload out of the
comparison — and **increasing in arrival order** — that is what makes ties first-in-first-out.
`itertools.count()` is both, for the life of the process.

The documentation's own recipe stores a three-element **list**, not a tuple, because its removal
scheme later marks an entry dead in place. Without removal, a tuple is the safer choice: it
cannot be changed after it is pushed, so it cannot silently break the invariant.

## The standard library, both ways

`sched` — the general-purpose event scheduler — builds its heap entries with a sequence number
exactly as above:

```python
# Lib/sched.py, v3.14.7, line 35
Event = namedtuple('Event', 'time, priority, sequence, action, argument, kwargs')
```

> *"A continually increasing sequence number that separates events if time and priority are
> equal."* — the `Event.sequence` docstring, `Lib/sched.py`

asyncio's event loop keeps its `call_later` timers in a heap too, but `TimerHandle.__lt__`
compares only the deadline (`self._when < other._when`, `Lib/asyncio/events.py` lines 162–165).
There is no sequence field, so equal deadlines have no defined order, and the documentation says
exactly that:

> *"*callback* will be called exactly once. If two callbacks are scheduled for exactly the same
> time, the order in which they are called is undefined."*

That is a defensible choice for an event loop's timers. It is the wrong one for a job queue whose users
expect "submitted first, runs first".

## The dataclass wrapper, and what it does not give you

The documentation offers a second fix for unorderable tasks, and `queue.PriorityQueue`'s
documentation repeats it:

```python
from dataclasses import dataclass, field
from typing import Any

@dataclass(order=True)
class PrioritizedItem:
    priority: int
    item: Any=field(compare=False)
```

It removes the `TypeError`: two items with equal priority compare as equal and the payload is
excluded from comparison. It does **not** remove the ordering problem. Equal priorities are now
*equal entries*, and a heap is not stable, so they come out in whatever order the sifts leave
them. For FIFO, the wrapper needs the counter too:

```python
import itertools
from dataclasses import dataclass, field
from typing import Any

_seq = itertools.count()

@dataclass(order=True, frozen=True, kw_only=True)
class QueuedTask:
    priority: int
    seq: int = field(default_factory=lambda: next(_seq))
    task: Any = field(default=None, compare=False)

entry = QueuedTask(priority=2, task="rebuild-thumbnails")   # keyword-only: task can never land in seq
```

`order=True` compares instances as tuples of their compared fields, in declaration order —
`(priority, seq)` here — which is the same entry as the tuple form, with names.

## The priority has to order — against every other priority in the queue

Every priority in one heap is compared with others, so every pair of them must support `<`.
Three common designs fail that test:

```python
import enum

class Severity(enum.Enum):          # plain Enum members do not support "<"
    CRITICAL = 0
    HIGH = 1
    LOW = 2

class SeverityLevel(enum.IntEnum):  # IntEnum members are ints: they order, and print by name
    CRITICAL = 0
    HIGH = 1
    LOW = 2

# (Severity.HIGH, 0, job) < (Severity.LOW, 1, job)       -> TypeError
# (SeverityLevel.HIGH, 0, job) < (SeverityLevel.LOW, 1, job) -> True
# (None, 0, job) < (2, 1, job)                           -> TypeError: None does not order
# ("2", 0, job) < (10, 1, job)                           -> TypeError: str vs int
```

A priority read from a request body or a database column is the usual source of the last two:
one row with a `NULL` or a string-typed number, and the push that meets it raises — or, if the
comparison is reached only on a later pop, [02b](02b-when-a-comparison-fails.md) applies. Normalise
at the boundary, once, before the entry exists.

## Direction: smaller wins

A min-heap pops the smallest priority. That matches "P0 is most urgent" and "earliest deadline
first" naturally, and contradicts "score 100 beats score 10". For the second, use the 3.14
max-heap functions or negate a numeric priority ([04](04-max-heaps.md) — and mind the counter's
direction there). Name the field so the direction is visible at every call site:
`urgency_rank`, `run_at`, `neg_score`.

## Starvation, and turning priority into a deadline

A strict priority queue under sustained high-priority load never pops a low-priority entry: it
is always beaten. Aging — raising the priority of entries the longer they wait — cannot be done
in place, because changing an entry's priority breaks the invariant. The usual fix is to make
the priority *static but time-aware* when the entry is created: convert "priority" into "the
latest time this should start", and order by that deadline:

```python
import heapq
import itertools
import time

MAX_WAIT_S = {0: 0.0, 1: 5.0, 2: 60.0, 3: 900.0}    # P0 now, P3 within fifteen minutes

_seq = itertools.count()
queue: list[tuple[float, int, str]] = []

def submit(priority: int, job_id: str) -> None:
    start_by = time.monotonic() + MAX_WAIT_S[priority]
    heapq.heappush(queue, (start_by, next(_seq), job_id))
```

A P3 job submitted fifteen minutes ago now outranks a P1 job submitted a second ago, without
anything in the heap changing. Priorities still separate work that arrives together, and nothing
waits forever.

## Gotchas

**★ Symptom: equal-priority jobs run out of submission order even though nothing raises.** Cause:
the entries are `PrioritizedItem`-style wrappers (or `(priority, item)` with orderable items), so
ties are equal entries and a heap is not stable. Fix: a counter in the second compared position —
`(priority, next(seq), item)` or a `seq` field before the payload in the dataclass.

**★ Symptom: `TypeError: '<' not supported between instances of 'Severity' and 'Severity'`.**
Cause: a plain `Enum` used as the priority; its members do not define ordering. Fix: `IntEnum`
(members are ints) or push `severity.value`:
`heapq.heappush(queue, (SeverityLevel.HIGH, next(seq), job))`.

**Symptom: one malformed request takes down the dispatcher with a `TypeError` about `NoneType`.**
Cause: a `None` priority from an optional field reached the heap and was compared with an int.
Fix: validate and default at the boundary:

```python
priority = int(payload.get("priority", DEFAULT_PRIORITY))
heapq.heappush(queue, (priority, next(seq), job))
```

**Symptom: occasional `TypeError` between two jobs, but only right after a restart.** Cause: the
queue was rebuilt from a database with a fresh `itertools.count()`, and persisted entries kept
their old sequence numbers, so a new entry can collide with a restored one and the comparison
falls through to the payload. Fix: make the tie-break a value that is unique across restarts —
the row's primary key or a persisted sequence — not a per-process counter (an increasing serial
key also keeps ties first-in-first-out):

```python
for row in rows:                                     # rows carry a unique id column
    heapq.heappush(queue, (row.priority, row.id, row.job))
```

**Symptom: ties between jobs are "mostly" FIFO but occasionally inverted, or a `TypeError`
appears under load.** Cause: `time.time()` used as the tie-break. Two pushes can read the same
value, and the wall clock can step backwards. Fix: a counter for the tie-break; if you also want
time in the entry, put it *before* the counter, not instead of it:
`(priority, time.monotonic(), next(seq), job)`.

**Symptom: low-priority jobs are never run on a busy day.** Cause: strict priority order —
there is always something more urgent. Fix: convert priority to a start-by deadline at push time,
as above; do not try to raise priorities of queued entries in place.

**Symptom: the least urgent jobs run first.** Cause: "higher number = more urgent" in the domain,
and a min-heap pops the smallest. Fix: `heappush_max` (3.14) with a negated counter, or push
`-urgency`; and rename the field to state its direction.

## Interview questions

**★ Why store `(priority, count, item)` instead of `(priority, item)` in a heap?**
Because `heapq` compares whole entries. With `(priority, item)`, two equal priorities make tuple
comparison fall through to the items, which raises for unorderable objects and, for orderable
ones, orders ties by the item instead of by arrival. A unique, increasing count in the middle
settles every comparison before the item is reached and makes equal priorities come out in
insertion order. The documentation gives exactly this reasoning.

**★ How do you stop a priority queue from starving low-priority work?**
Make the ordering key time-aware when the entry is created — for example, order by "start by"
deadline, computed as arrival time plus a maximum wait that depends on the priority. Old
low-priority entries then naturally reach the front. Adjusting priorities of entries already in
the heap is not an option, because changing an element's ordering in place breaks the invariant;
it would need removal and re-insertion for every aged entry.

**Does `@dataclass(order=True)` with `field(compare=False)` on the payload make a heap FIFO?**
No. It makes the payload irrelevant to comparison, which prevents the `TypeError`, but two
entries with the same priority then compare equal and a heap does not preserve insertion order
among equals. Add a sequence field before the payload.

**Why is `time.time()` a poor tie-breaker?**
It is not unique — two pushes can read the same timestamp — and it is not monotonic, since the
wall clock can be adjusted backwards. A tie in the timestamp sends the comparison on to the
payload, and a clock step inverts arrival order. A counter is unique and monotonic by
construction.

**What does asyncio do with two callbacks scheduled for the same time, and why?**
The documentation says their order is undefined. The event loop's timer heap orders
`TimerHandle` objects by their deadline alone, with no sequence number, so equal deadlines are
equal entries and the heap may return them in either order.

**Why must every priority in one queue be mutually comparable?**
Because the sift compares entries pairwise along a path, and which pairs meet depends on the
arrival order. A single `None`, a string-typed number or a plain `Enum` member will eventually be
compared with something it cannot be compared with, and the failure happens at an arbitrary
later push or pop rather than at the point where the bad value arrived.

---

← Prev: [04 · Max-heaps in 3.14](04-max-heaps.md) · [Topic index](README.md) · Next → [05b · Removing and re-prioritising entries](05b-removal-and-update.md)
