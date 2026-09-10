---
title: "06 · collections — nine containers that replace the code most people hand-roll, each with a mechanism that decides its cost and a boundary where it stops behaving like the built-in it resembles"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-10 against the Python 3.14 documentation — [`collections`](https://docs.python.org/3.14/library/collections.html), [`collections.abc`](https://docs.python.org/3.14/library/collections.abc.html), [`queue`](https://docs.python.org/3.14/library/queue.html), [`pickle`](https://docs.python.org/3.14/library/pickle.html), [`copy`](https://docs.python.org/3.14/library/copy.html), [`json`](https://docs.python.org/3.14/library/json.html), [`functools.lru_cache`](https://docs.python.org/3.14/library/functools.html#functools.lru_cache) — and CPython source at the [**v3.14.7**](https://github.com/python/cpython/tree/v3.14.7) tag (`Lib/collections/__init__.py`, `Modules/_collectionsmodule.c`, `Objects/odictobject.c`), labelled as implementation detail wherever the documentation is silent. Target: **Python 3.14.7**. Documentation-validated — **no sandbox run, no timings, no byte counts on any page in this topic**.

**`defaultdict` is the group-by, `Counter` is the tally and the top-N, `deque` is the queue that `list.pop(0)` only pretends to be, `ChainMap` is layered configuration, `OrderedDict` is the reorderable mapping an LRU cache needs, and `namedtuple` is a record type with no per-instance dictionary. Each one is a small amount of code wrapped around a specific mechanism — a `__missing__` hook, a doubly-linked list of 64-slot blocks, a list of mappings searched in order, a linked list threaded through a dict — and every surprise it produces comes from that mechanism: a `defaultdict` read that inserts, a `Counter` that keeps zero counts, a `deque` iterator that refuses any append, a `ChainMap` write that lands in the caller's dict. This topic takes each type through its mechanism, its cost, the ways it fails in a running service, and the questions an interviewer uses to find out whether you know the difference.**

## Chunks

| # | Chunk | What it argues |
|---|---|---|
| 1 | **[01 · Nine types, three families](01-nine-types-three-families.md)** | 🔴 dict subclasses are real dicts; `ChainMap`/`User*` are ABC-built and fail `isinstance(x, dict)` and `json.dumps`; `deque` is registered, not inherited; `namedtuple` is a function — plus the hand-rolled-code-to-type table and `collections.abc` since 3.10 |
| 2 | **[02 · `defaultdict` — a factory behind `d[k]`](02-defaultdict.md)** | `__missing__` and nothing else; group-by, distinct-per-key, inverted index, adjacency, per-key `Counter`; 🔴 the factory must build a new object and cannot see the key — `__missing__` on a `dict` subclass can; `format_map` vs `format(**m)`; switching `default_factory` off |
| 3 | **[02b · `defaultdict` in production](02b-defaultdict-in-production.md)** | 🔴 reads that insert grow a long-running service's dict per probe; return a plain `dict`; lambda factories cannot be pickled; JSON drops the factory; `copy()`/`\|`/pickle call the class factory-first; the factory can run twice under contention; class-attribute and dataclass defaults |
| 4 | **[03 · `Counter` — counting semantics](03-counter.md)** | missing reads as `0` without inserting; 🔴 the constructor and `update()` count *elements*, so a `str` counts letters and `(key, n)` pairs count as tuples; `update` adds, `subtract` goes negative; zero counts stay keys; silent `del`; refused `fromkeys`; `repr` sorted by count; non-integer counts |
| 5 | **[03b · `Counter` — top-N and per-group tallies](03b-counter-top-n.md)** | `most_common(n)` is `heapq.nlargest`, `most_common()` a full sort; ties by arrival order and how to make them deterministic; 🔴 `sorted(c)` and `max(c)` rank keys; the phase gate as `defaultdict(Counter)`; merging with `update` not `sum`; a rolling window of per-minute counters |
| 6 | **[03c · `Counter` — multiset arithmetic](03c-counter-multiset-math.md)** | `+ - & \|` and unary ops drop results ≤ 0; 🔴 `stock - order` hides the shortfall that `subtract` shows, and `-=` deletes every zero count in the counter; binary ops need a Counter, in-place ones take any mapping; `<=` is a partial order; list diffs with duplicates; subclasses come back as `Counter` |
| 7 | **[04 · `deque` — the block list underneath](04-deque-the-block-list.md)** | 64-slot blocks in a doubly-linked list: ends O(1) because nothing moves, middle indexing walks blocks, `insert`/`del`/`remove` are rotations; the source-derived cost table; queue, BFS, round-robin; 🔴 `pop()` is LIFO; `+` needs a deque, `==` only matches a deque, `extendleft` reverses, no slicing or `sort` |
| 8 | **[04b · Bounded deques](04b-bounded-deques.md)** | `maxlen` evicts silently from the opposite end — tail, ring buffers, sliding windows, undo; 🔴 data loss in a work queue (use `Queue(maxsize)`); `maxlen=0` keeps nothing; `insert` raises where `append` evicts; `appendleft` evicts the newest; `deque(d)` drops the bound; count is not time in a rate limiter |
| 9 | **[04c · `deque` during iteration and across threads](04c-deque-iteration-and-threads.md)** | 🔴 the state counter: any append or pop kills a live iterator, even at equal length; drain, rotate-filter or snapshot; atomic single calls vs racy `if d: d.popleft()`; 🔴 a health endpoint iterating a shared ring buffer; `copy()` for snapshots; `queue.Queue` and `asyncio.Queue` are deques with synchronisation |
| 10 | **[05 · `namedtuple` from the factory side](05-namedtuple-factory-side.md)** | one call = validate, `eval` a `__new__`, `type()` a new class, stamp the caller's module; 🔴 the per-row class (the `sqlite3` doc recipe) and its fix; why per-call classes break `isinstance` and pickling; the field names CSV headers and SQL columns bring, and normalising them; `_asdict`, `copy.replace`, `SimpleNamespace` |
| 11 | **[06 · `ChainMap` — layered lookup](06-chainmap-layered-lookup.md)** | a list of mappings searched in order, writes to `maps[0]`, live by reference; CLI > env > file > defaults made safe with an owned front dict and `MappingProxyType` layers; per-request overrides with `new_child`; scopes with `parents`; 🔴 every miss is a caught `KeyError` per layer and `len()`/iteration rebuild all keys — when to flatten |
| 12 | **[06b · `ChainMap` traps](06b-chainmap-traps.md)** | 🔴 writes land in the caller's dict or `os.environ`; `del`/`pop`/`clear` touch only `maps[0]`, and masking with a sentinel; `DeepChainMap` and its cost; a `defaultdict` or `Counter` layer ends the search; `new_child(m, **kw)` edits `m`; `parents` into nothing; env strings vs default ints; no snapshot |
| 13 | **[07 · `OrderedDict` — what it still does](07-ordereddict-what-it-still-does.md)** | reordering, not order: a linked list beside the hash table; `move_to_end` both ways vs a dict's one-way emulation; 🔴 why `next(iter(d))` + `pop` slows under front churn and `popitem(last=False)` does not; a unique, cancellable FIFO; order-sensitive `==`; `update` honours a subclass `__setitem__`; reordering mid-iteration raises |
| 14 | **[07b · `OrderedDict` as an LRU cache](07b-ordereddict-lru-caches.md)** | `move_to_end` on hit, `popitem(last=False)` on overflow; `functools.lru_cache` first, and exactly what it cannot do; a locked generic `LRUCache`; the doc's `TimeBoundedLRU` and `MultiHitLRUCache`; per-key invalidation, eviction callbacks, byte budgets; 🔴 `@lru_cache` on a method keeps instances alive |
| 15 | **[08 · `UserList` and `UserDict` — wrappers, not funnels](08-userlist-and-userdict.md)** | 🔴 every `UserList` method writes `self.data` directly, so `__setitem__` validation is bypassed by `append`/`extend`/`insert`/`+=`/the constructor — the path table vs `list` and `MutableSequence`, and both fixes; `UserDict`'s `\|=` and `__copy__` bypass `__setitem__`; shallow instance attributes in copies; `repr` hides the type |
| 16 | **[08b · `UserString`](08b-userstring.md)** | which methods re-wrap in your subclass and which return plain `str`; 🔴 `+`/`%` launder untrusted input into a "safe" subclass — and the escaping override; refused by `json`, `str.join`, `open`, format specs; hashable and equal to the plain string; why a `str` subclass is usually the right base |
| 17 | **[09 · Crossing a boundary — JSON, pickle, copy, `isinstance`](09-crossing-a-boundary.md)** | all nine types through four boundaries in one matrix; 🔴 the JSON encoder writes named tuples and dict subclasses before `default` can see them; an explicit `to_jsonable`; which `__reduce__` drops instance attributes; `.copy()` vs `copy.copy()`; 🔴 `sqlite3` binds a `Counter`'s `0` for a forgotten named parameter and treats a `ChainMap` as a sequence |

## Phase gate

You are done with this topic when you can write *"page views per user per day, then the top ten
users"* as `defaultdict(Counter)` plus `most_common(10)` with no index arithmetic; say in one
sentence why a work queue is a `deque` and not a `list`, and why a `for` loop over that deque must
not append to it; build a CLI-over-environment-over-defaults settings object that never writes into
`os.environ`; and implement an LRU cache on `OrderedDict` — then explain why `functools.lru_cache`
is usually the better answer.

## Where this connects

- **[Phase 3 — Collections in depth](../README.md)** is the phase this topic belongs to.
- [01 · `list` internals](../01-list-internals/README.md) — the O(n) front of a list that `deque` exists to avoid, and the counting and top-N loops that `Counter` replaces.
- [02 · `tuple`](../02-tuple/README.md) — owns everything about a named tuple *being a tuple*; this topic covers only the factory.
- [03 · `dict`](../03-dict/README.md) — `__missing__`, `setdefault`, merging, subclassing and `UserDict` at their boundary with `dict`; this topic links there rather than repeating them.
- [04 · `set` and `frozenset`](../04-set-and-frozenset/README.md) — `Counter` is the multiset a `set` cannot be.
- [05 · Slicing deeply](../05-slicing/README.md) — why a `deque` cannot be sliced and what `islice` does instead.
- **07 · `heapq` and `bisect`** *(not written yet)* — what `Counter.most_common(n)` calls underneath.
- **08 · `copy` vs `deepcopy`** *(not written yet)*, **11 · Choosing a structure** *(not written yet)*.

---

← [Phase index](../README.md) · Start → [01 · Nine types, three families](01-nine-types-three-families.md)
