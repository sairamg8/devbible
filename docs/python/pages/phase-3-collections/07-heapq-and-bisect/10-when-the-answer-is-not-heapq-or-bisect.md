---
title: "heapq and bisect are the right tools for exactly two shapes — 'smallest right now' and 'search a list that rarely changes' — and the moment a workload needs rank queries on constantly changing data, sharing across processes, or plain FIFO or exact lookup, a different structure or the database is the answer"
sidebar_label: "10 · When the answer is not heapq or bisect"
sidebar_position: 18
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-10 against the Python 3.14 documentation — [`heapq`](https://docs.python.org/3.14/library/heapq.html), [`bisect`](https://docs.python.org/3.14/library/bisect.html) (Performance Notes and its *seealso* on Sorted Collections), [time complexity](https://docs.python.org/3.14/library/time-complexity.html), [`collections.deque`](https://docs.python.org/3.14/library/collections.html#collections.deque) — and the third-party [`sortedcontainers` SortedList documentation](https://grantjenks.com/docs/sortedcontainers/sortedlist.html) (latest release **2.4.0**, per PyPI on 2026-09-10; **not pinned** in this site's `pins.js`, named here as an alternative, not taught). Target: **Python 3.14.7**. **No sandbox run, no timings.**

**Both modules are thin: functions over a `list` you own, with a precondition you maintain. That makes them fast and dependency-free for the shapes they fit — a heap when the only question is "what is smallest now", a sorted list plus `bisect` when the data is built once and searched many times — and the wrong tool the moment the shape changes. A leaderboard needs rank and range queries *and* constant updates, which is O(n) per update for a sorted list and O(n) per rank query for a heap. A FIFO queue is a `deque`, not a heap with a counter. An exact lookup is a `dict`. And anything that must be shared by several worker processes, survive a restart or exceed memory lives in the database, where a B-tree index already is the sorted structure and `ORDER BY … LIMIT`, range predicates and `SKIP LOCKED` are the heap and the bisect. This chunk is the decision, with the cost that forces each switch.**

## The decision table

| The question | Use | Why not `heapq` / `bisect` |
|---|---|---|
| the single smallest / largest, once | `min` / `max` | `nlargest(1, ...)` calls `max` anyway |
| the whole order, once | `sorted()` / `list.sort()` | a heap sort is slower and not stable |
| top K of N, once, K ≪ N | `heapq.nlargest` / `nsmallest` | — this is the fit ([03](03-nlargest-and-nsmallest.md)) |
| repeatedly take the smallest, with inserts | a heap | — this is the fit ([01](01-the-heap-invariant.md)) |
| the same, shared by threads | `queue.PriorityQueue` | a bare heap has no lock ([05d](05d-heaps-across-threads.md)) |
| first in, first out | `collections.deque` | a heap orders by value; FIFO needs no comparisons at all |
| is `x` present / look up by key | `set` / `dict` | *"For locating specific values, dictionaries are more performant."* |
| ranges, nearest, "at or below", on data that rarely changes | sorted `list` + `bisect` | — this is the fit ([09](09-range-queries.md)) |
| ranges *and* rank *and* constant inserts/deletes, in one process | a sorted container (below) | each insert or delete into a list is O(n) ([08](08-insort-and-sorted-list-cost.md)) |
| shared by processes, durable, or larger than memory | a database index | a list lives in one process's memory |

## Rank queries on changing data: the leaderboard

A game or sales leaderboard asks three things: the top N, a player's rank, and "who is near me".
Scores change constantly. Against the two built-in options:

- **A heap** gives the top one in O(1) and the top N in O(N log n) of pops, but a player's rank
  requires popping or scanning — O(n) — and changing a score is the lazy-deletion dance from
  [05b](05b-removal-and-update.md).
- **A sorted list** gives the top N as a slice and a rank as a bisect, both cheap, but every score
  change is a remove and an insert, two O(n) shifts.

What the workload needs is a structure with O(log n)-ish insert, delete *and* positional access.
The standard library has none. The `bisect` documentation's own *seealso* points outside it:

> *"Sorted Collections is a high performance module that uses *bisect* to managed sorted
> collections of data."*

The best-known such library is `sortedcontainers`, whose `SortedList` keeps values in sorted order
across many small internal lists and exposes list-like indexing plus search methods. Its
documentation describes it as *"a sorted mutable sequence"* and states its one precondition in the
same terms as this topic:

> *"Sorted list values must be comparable. The total ordering of values must not change while they
> are stored in the sorted list."*

Its documentation lists `add`, `remove` and positional lookup as approximately logarithmic; this
page has not verified those figures beyond that listing. A leaderboard on it, sketched:

```python
from sortedcontainers import SortedList      # third-party: pin it, e.g. sortedcontainers>=2.4,<3

class Leaderboard:
    def __init__(self) -> None:
        self._board = SortedList()           # entries: (-score, player_id), best first
        self._score: dict[str, int] = {}

    def set_score(self, player_id: str, score: int) -> None:
        old = self._score.get(player_id)
        if old is not None:
            self._board.remove((-old, player_id))   # never mutate an entry in place
        self._board.add((-score, player_id))
        self._score[player_id] = score

    def top(self, n: int) -> list[tuple[str, int]]:
        return [(pid, -neg) for neg, pid in self._board[:n]]

    def rank(self, player_id: str) -> int:
        return self._board.index((-self._score[player_id], player_id)) + 1
```

The `(-score, player_id)` entry is the same design as a heap entry in [05](05-priority-queues.md):
a numeric priority first, a unique tie-break second, nothing mutable. Pulling in the library is a
dependency decision — it needs a version pin in your project and a reason the standard library
could not serve ([Phase 7 — dependencies and markers](../../phase-7-packaging-tooling/01-pyproject-toml/06-dependencies-and-markers.md)).

## When the data is not yours alone

Every structure on this page lives in one process. A web application with eight worker processes
has eight separate heaps, eight separate sorted lists, and eight different answers; all of them
vanish on deploy. When the data is shared, durable or large, the database already maintains the
sorted structure — a B-tree index — and the operations map one to one:

| In-process | In the database |
|---|---|
| `heapq.nlargest(10, rows, key=...)` | `ORDER BY total DESC, id LIMIT 10` on an index |
| two bisects for a range | `WHERE placed_at >= $1 AND placed_at < $2` on an index |
| `heappop` from a shared job heap | `SELECT … ORDER BY priority, run_at, id LIMIT 1 FOR UPDATE SKIP LOCKED` |
| a breakpoint table | a `tiers` table joined on `amount >= lower_bound`, or the same table cached in memory |

A sorted-set type in a key–value store is the other common home for leaderboards and delay queues;
this site's **Redis** track *(not written yet)* is where that belongs. The PostgreSQL side is
[PostgreSQL — B-tree indexes](../../../../postgresql/pages/phase-10-indexes/02-btree.md).

The in-process tools stay right for data the process owns: a snapshot loaded at start-up, a
per-request computation, results merged from several upstream calls, a stream being read once.

## Gotchas

**★ Symptom: a leaderboard service's CPU tracks the number of score updates, and profiling shows
`list.insert` and `list.remove`.** Cause: a sorted list maintained with `insort` — every update
shifts the list twice. Fix: a sorted container with logarithmic updates (the `Leaderboard` sketch),
or a database or sorted-set store if the board is shared.

**★ Symptom: "what is my rank" is the slowest endpoint in a service built on a heap.** Cause: a heap
orders only the root; rank means scanning or popping. Fix: a structure with positional access —
a sorted list if updates are rare, a sorted container if they are not.

**Symptom: after raising a player's score in place, `SortedList` lookups return wrong positions.**
Cause: the entry's ordering changed while it was stored — the library's documented precondition.
Fix: `remove` the old entry and `add` a new one, as `set_score` does.

**Symptom: each web worker shows a different "top 10".** Cause: an in-process heap or sorted list
per worker. Fix: compute from shared storage — `ORDER BY … LIMIT` on an index, or a shared sorted
set — and cache the result if it is expensive.

**Symptom: a priority queue implemented with `heapq` and a counter is used where every item has the
same priority.** Cause: FIFO dressed as a priority queue — O(log n) comparisons per operation for an
order `deque` gives in O(1) with none. Fix:

```python
from collections import deque

pending: deque[str] = deque()
pending.append("job-1")
next_job = pending.popleft()
```

**Symptom: a sorted list is bisected only to answer "is this ID known?".** Cause: exact membership
through a range tool. Fix: `known_ids = set(ids)`; `user_id in known_ids` is average O(1).

**Symptom: a dependency on `sortedcontainers` appears in production without a version constraint.**
Cause: added to fix a performance problem, never pinned. Fix: declare it with a range in the
project's dependencies:

```toml
[project]
name = "leaderboard-service"
version = "1.0.0"
dependencies = ["sortedcontainers>=2.4,<3"]
```

## Interview questions

**★ Design a leaderboard that supports score updates, top N and a player's rank. Which structure?**
Not a heap — rank is O(n) — and not a sorted list with `insort` — every update is O(n). In one
process, a sorted container with logarithmic insert, delete and positional lookup, keyed by
`(-score, player_id)` so ties are deterministic, plus a dict from player to current score so the old
entry can be removed before the new one is added. If the board is shared by several processes or
must survive restarts, it belongs in shared storage: a sorted-set type in a key–value store, or a
database table with an index on the score.

**★ When would you choose a heap, a sorted list, or a balanced tree-like structure?**
A heap when you only ever need the minimum (or maximum) and push and pop continuously — O(log n)
each, O(1) peek. A sorted list with `bisect` when the data changes rarely and you query ranges,
ranks and nearest values often — O(log n) queries, O(n) updates. A tree-like sorted container when
you need both ordered queries and frequent inserts and deletes. And none of them when the question
is exact lookup (`dict`/`set`) or FIFO (`deque`).

**Why move a top-N or range query into the database rather than doing it in Python?**
Because the database keeps a B-tree index that is already sorted, so `ORDER BY … LIMIT` and range
predicates read only the rows they return; the rows are shared by every process and stay correct
under concurrent writes. Doing it in Python means shipping every row, holding them in each worker,
and answering from a snapshot that goes stale.

**What precondition do `heapq`, `bisect` and a sorted container share?**
The ordering of an element must not change while the element is in the structure. A heap's
invariant, a sorted list's order and a sorted container's internal order are all computed when the
element goes in; mutating the compared fields afterwards silently breaks every later operation.
Remove, change, and re-insert.

---

← Prev: [09b · Breakpoint tables and lookup rings](09b-breakpoint-tables-and-rings.md) · [Topic index](README.md) · Next topic → **08 · `copy` vs `deepcopy`** *(not written yet)*
