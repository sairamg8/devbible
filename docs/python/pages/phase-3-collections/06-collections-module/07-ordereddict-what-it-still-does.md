---
title: "Since 3.7 a plain dict keeps insertion order, so OrderedDict is no longer for order — it is for reordering: O(1) moves to either end, O(1) removal from either end however much churn there has been, and equality that checks order, paid for with a second structure on every entry"
sidebar_label: "07 · OrderedDict — what it still does"
sidebar_position: 13
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-10 against the Python 3.14 documentation — [`collections.OrderedDict`](https://docs.python.org/3.14/library/collections.html#ordereddict-objects) (the list of remaining differences, `popitem`, `move_to_end`, equality, the version notes and recipes), [`json` — `object_pairs_hook`](https://docs.python.org/3.14/library/json.html#json.load), [`collections.namedtuple._asdict`](https://docs.python.org/3.14/library/collections.html#collections.somenamedtuple._asdict). Mechanism read from CPython **v3.14.7** — the pure-Python specification in [`Lib/collections/__init__.py`](https://github.com/python/cpython/blob/v3.14.7/Lib/collections/__init__.py) (lines 89–342), the C implementation in [`Objects/odictobject.c`](https://github.com/python/cpython/blob/v3.14.7/Objects/odictobject.c), and dict iteration in [`Objects/dictobject.c`](https://github.com/python/cpython/blob/v3.14.7/Objects/dictobject.c) — **implementation detail** where the docs are silent. Target: **Python 3.14.7**. **No sandbox run, no timings, no byte counts.**

**The documentation now introduces `OrderedDict` by saying it has *"become less important now that the built-in `dict` class gained the ability to remember insertion order"*. If you only need a mapping that iterates in the order keys were added, use `dict` — [3 · Order is a guarantee](../03-dict/02-insertion-order-is-a-guarantee.md) has the history. What remains is a different design goal, and the documentation states it plainly: `dict` *"was designed to be very good at mapping operations"*; `OrderedDict` *"was designed to be good at reordering operations"*. Underneath the hash table it keeps a doubly-linked list of its keys, so it can move any key to either end, and remove from either end, in constant time — however many insertions and deletions came before. A plain dict can imitate most of that, but its imitation of "take the oldest" slows down on exactly the workload that needs it, and it has no efficient "move to the front" at all. The price is memory and some speed on ordinary operations, which the documentation calls *"secondary"*. This chunk is what an `OrderedDict` still does that a dict does not; [07b · `OrderedDict` as an LRU cache](07b-ordereddict-lru-caches.md) builds the LRU cache it is best known for.**

## What the documentation says still differs

> *"The regular `dict` was designed to be very good at mapping operations. Tracking insertion order
> was secondary."*
> *"The `OrderedDict` was designed to be good at reordering operations. Space efficiency, iteration
> speed, and the performance of update operations were secondary."*
> *"The `OrderedDict` algorithm can handle frequent reordering operations better than `dict`. As
> shown in the recipes below, this makes it suitable for implementing various kinds of LRU caches."*
> *"The equality operation for `OrderedDict` checks for matching order."*
> *"The `popitem()` method of `OrderedDict` has a different signature. It accepts an optional
> argument to specify which item is popped."*
> *"`OrderedDict` has a `move_to_end()` method to efficiently reposition an element to an endpoint."*
> *"Until Python 3.8, `dict` lacked a `__reversed__()` method."*

The last point is history: `reversed(d)` works on a dict since 3.8. The other four are the reasons to choose `OrderedDict` today.

## The structure

The pure-Python version kept in the `v3.14.7` source is the readable specification, and its comments describe the design in five lines:

> *"An inherited dict maps keys to values."* · *"The inherited dict provides `__getitem__`,
> `__len__`, `__contains__`, and get."* · *"The remaining methods are order-aware."* · *"Big-O running
> times for all methods are the same as regular dictionaries."* · *"The internal self.__map dict maps
> keys to links in a doubly linked list."*

The C implementation that actually runs (`Objects/odictobject.c`) keeps the same strategy — *"This implementation is necessarily explicitly equivalent to the pure Python OrderedDict class"* — with a lower-level list and, instead of a second dict, *"an array of node pointers"* that mirrors the dict's own entry order so a key's node can be found in O(1). Either way, every key costs a dict entry *plus* a list node, which is what *"Space efficiency … secondary"* means. The documentation gives no figure, and neither does this page.

## `move_to_end`: both directions, O(1)

> *"Move an existing *key* to either end of an ordered dictionary. The item is moved to the right end
> if *last* is true (the default) or to the beginning if *last* is false. Raises `KeyError` if the
> *key* does not exist"*

The documentation's example: `d = OrderedDict.fromkeys('abcde')`; after `d.move_to_end('b')`, `''.join(d)` is `'acdeb'`; after `d.move_to_end('b', last=False)` it is `'bacde'`. In the source, both directions unlink one node and relink it next to the list's sentinel — no other entry moves.

A plain dict can do the first direction and not the second:

> *"A regular `dict` can emulate OrderedDict's `od.move_to_end(k, last=True)` with `d[k] =
> d.pop(k)` which will move the key and its associated value to the rightmost (last) position."*
> *"A regular `dict` does not have an efficient equivalent for OrderedDict's `od.move_to_end(k,
> last=False)` which moves the key and its associated value to the leftmost (first) position."*

"Move to the front" on a dict means rebuilding it — `d = {k: d[k], **{x: y for x, y in d.items() if x != k}}` — O(*n*) per move. For a most-recently-used list shown newest first, a pinned-items list, or a priority bump, that is the difference.

## `popitem(last=False)`: FIFO that stays O(1)

> *"The pairs are returned in LIFO (last-in, first-out) order if *last* is true or FIFO (first-in,
> first-out) order if false."*

The documentation's dict emulation for the FIFO direction is `(k := next(iter(d)), d.pop(k))` ([4 · Working with the order](../03-dict/02b-working-with-the-order.md)). It is correct, and on a dict that is churned from the front it degrades. In CPython `v3.14.7`, deleting a dict entry leaves a dead slot in the entries array, and a fresh iterator starts at the beginning and skips dead slots one at a time (`dictiter_iternextkey_lock_held`: `while (i < n && entry_ptr->me_value == NULL) { entry_ptr++; i++; }`). A dict used as a FIFO — insert at the back, take the first key and delete it, repeat — accumulates a run of dead slots at the front, and every `next(iter(d))` walks the whole run, until an insertion triggers a resize that rebuilds the array. `OrderedDict.popitem(last=False)` reads the first node of its linked list; the cost does not depend on history. That is the concrete content of *"can handle frequent reordering operations better than `dict`"*.

```python
from collections import OrderedDict

pending: OrderedDict[str, bytes] = OrderedDict()   # message id -> payload, unique, arrival order


def enqueue(message_id: str, payload: bytes) -> None:
    if message_id not in pending:                  # O(1) duplicate check — why not a deque
        pending[message_id] = payload


def next_message() -> tuple[str, bytes]:
    return pending.popitem(last=False)             # oldest first; KeyError('dictionary is empty') if none
```

A deque is the usual FIFO, but it cannot answer "is this ID already queued?" or "cancel message 42" without a linear scan; an `OrderedDict` does both in O(1) and still pops in arrival order.

## Equality that checks order

> *"Equality tests between `OrderedDict` objects are order-sensitive and are roughly equivalent to
> `list(od1.items())==list(od2.items())`."*
> *"Equality tests between `OrderedDict` objects and other `Mapping` objects are order-insensitive
> like regular dictionaries. This allows `OrderedDict` objects to be substituted anywhere a regular
> dictionary is used."*

When order *is* the data — the column order of an export, the header order a signature was computed over, the step order of a pipeline definition — comparing two `OrderedDict`s says whether it matches. The full comparison matrix, including why the answer flips when one side is a plain dict, is [24 · Dict equality](../03-dict/09c-dict-equality.md); the documentation's one-liner for a plain dict is `p == q and all(k1 == k2 for k1, k2 in zip(p, q))`.

## Reassigning a key does not move it — unless you say so

Setting an existing key keeps its position, in both `dict` and `OrderedDict`; the pure-Python `__setitem__` only creates a link *"if key not in self"*. For "order by most recent update", the documentation's recipe:

```python
class LastUpdatedOrderedDict(OrderedDict):
    'Store items in the order the keys were last added'

    def __setitem__(self, key, value):
        super().__setitem__(key, value)
        self.move_to_end(key)
```

This recipe relies on something a plain `dict` subclass would not give you: in `v3.14.7`, `OrderedDict.update()`, the constructor and `setdefault` insert through `PyObject_SetItem` (`mutablemapping_update` in `odictobject.c`), so a subclass's `__setitem__` *is* called on those paths — unlike `dict`, whose methods bypass it ([22 · Subclassing dict](../03-dict/09-subclassing-dict.md)). That is implementation, not documentation; test it if you depend on it.

## Iterating while reordering raises

The C `OrderedDict` keeps an `od_state` counter *"incremented whenever the LL changes"* — every new key, deletion, `clear` and **`move_to_end`**. Its iterator checks it each step and raises `RuntimeError("OrderedDict mutated during iteration")`, or `"OrderedDict changed size during iteration"` if the size changed. So a loop that promotes items while walking the same `OrderedDict` fails, while `od[k] = new_value` for an existing key (no list change) does not:

```python
for key in list(od):                 # iterate a snapshot of the keys…
    if should_promote(key):
        od.move_to_end(key, last=False)   # …so reordering the original is safe
```

## Where it is no longer needed

- **JSON with preserved key order.** `json.loads` returns a dict, which keeps document order. `object_pairs_hook=OrderedDict` (*"a function that is called with the result of any JSON object literal decoded with an ordered list of pairs"*) is only worth it if you need `OrderedDict` operations or order-sensitive equality afterwards.
- **`namedtuple._asdict()`** returns a plain `dict` since 3.8, with the documented remediation `OrderedDict(nt._asdict())` if you need the extras.
- **Keyword arguments** — order is retained for `**kwargs` passed to the constructor and `update` since 3.6 (*"With the acceptance of PEP 468, order is retained for keyword arguments passed to the `OrderedDict` constructor and its `update()` method."*), and plain dicts preserve it too.

## Gotchas

**★ Symptom: a colleague replaces every `dict` with `OrderedDict` "to be safe about order", and memory and serialisation code get worse.** Cause: order is already guaranteed for `dict`; `OrderedDict` adds a linked-list node per key and a different `repr`. Fix: use `OrderedDict` only for `move_to_end`, `popitem(last=False)` under churn, or order-sensitive equality.

```python
settings = dict(sorted(raw.items()))          # ordered, and a plain dict
```

**★ Symptom: a FIFO built on a dict with `next(iter(d))` + `pop` gets slower the longer the service runs, then recovers, then slows again.** Cause: each front deletion leaves a dead entry that every new iterator skips one by one until the next resize (CPython `v3.14.7` dict iteration). Fix: `OrderedDict.popitem(last=False)`, which takes the head of a linked list.

```python
oldest_key, oldest_value = pending.popitem(last=False)
```

**★ Symptom: `RuntimeError: OrderedDict mutated during iteration` in a loop that only calls `move_to_end`.** Cause: moving a key changes the linked list, and the iterator checks the list's state counter. Fix: iterate a snapshot of the keys.

```python
for key in list(recent):
    recent.move_to_end(key)
```

**Symptom: `KeyError` from `move_to_end("sku-9")`.** Cause: *"Raises `KeyError` if the *key* does not exist"* — it moves, it never inserts. Fix: insert if absent, then move.

```python
if key not in recent:
    recent[key] = value
recent.move_to_end(key)
```

**Symptom: an "evict oldest" loop evicts the newest entry.** Cause: `popitem()` defaults to `last=True` — LIFO, on `OrderedDict` as on `dict`. Fix: say which end.

```python
cache.popitem(last=False)
```

**Symptom: two `OrderedDict`s built from the same data in different orders are unequal, but each equals the plain-dict version.** Cause: order-sensitive equality applies only between two `OrderedDict`s. Fix: compare as dicts when order is not the point.

```python
assert dict(expected) == dict(actual)
```

## Interview questions

**★ Now that `dict` preserves insertion order, what is `OrderedDict` still for?**
Reordering. It keeps a doubly-linked list of keys alongside the hash table, which gives O(1) `move_to_end` in both directions (a dict has no efficient move-to-front), O(1) `popitem(last=False)` regardless of how much deletion came before, and equality that checks order between two `OrderedDict`s. Those make it the natural base for LRU and MRU structures and for FIFO maps of unique keys. For plain "iterates in insertion order", `dict` is smaller and faster; the documentation says `OrderedDict` treats space efficiency and iteration speed as secondary.

**★ How is `OrderedDict` implemented?**
As a dict subclass plus a doubly-linked list of its keys. The pure-Python specification in `Lib/collections/__init__.py` maps each key to a link in a second dict and uses a sentinel node; the C implementation in `Objects/odictobject.c` uses its own node list and an array of node pointers mirroring the dict's entry order, so a key's node is found in O(1). Lookups are inherited from dict; everything order-related walks or splices the list. The source comment: *"Big-O running times for all methods are the same as regular dictionaries."*

**Why is `next(iter(d))` plus `pop` a weak FIFO on a plain dict, when the documentation lists it as the emulation?**
It is correct but not constant-time under churn. In CPython, deleted dict entries stay in the entries array as dead slots, and a new iterator skips them one at a time from the start. A FIFO keeps deleting from the front, so dead slots pile up there and every `next(iter(d))` scans them, until a resize compacts the array. `OrderedDict.popitem(last=False)` reads the head of its linked list, whose cost does not depend on history — which is what the documentation means by handling *"frequent reordering operations better than `dict`"*.

**Does assigning to an existing key move it to the end?**
No — in both `dict` and `OrderedDict` an existing key keeps its position and only its value changes. If you want "order of last update", call `move_to_end(key)` after the assignment, or use the documentation's `LastUpdatedOrderedDict` recipe, which overrides `__setitem__` to do exactly that. In CPython that override is also honoured by `update()` and the constructor, because `OrderedDict` inserts through `PyObject_SetItem`, unlike `dict`.

**When would you use an `OrderedDict` instead of a `deque` as a queue?**
When the queue's items are keyed and must be unique or individually cancellable: an `OrderedDict` of message ID to payload answers "already queued?" and "cancel this one" in O(1) with `in` and `pop`, and still yields items in arrival order with `popitem(last=False)`. A deque needs a linear scan for both. For an anonymous stream of items where you only ever touch the ends, the deque is lighter.

**What happens if you call `move_to_end` inside a loop over the same `OrderedDict`?**
The C implementation increments an internal state counter whenever the linked list changes, including on `move_to_end`, and the iterator raises `RuntimeError("OrderedDict mutated during iteration")` at its next step. Iterate over `list(od)` — a snapshot of the keys — and reorder the original.

---

← Prev: [06b · `ChainMap` traps](06b-chainmap-traps.md) · [Topic index](README.md) · Next → [07b · `OrderedDict` as an LRU cache](07b-ordereddict-lru-caches.md)
