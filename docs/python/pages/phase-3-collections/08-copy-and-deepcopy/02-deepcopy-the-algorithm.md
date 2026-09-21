---
title: "deepcopy is a recursive function with a dictionary in its hand: it checks the atomic set, then the memo, then a four-entry dispatch table, then the class's hook and the reduce value, and it records every result by id() so that a shared child is copied once and the copy keeps the sharing"
sidebar_label: "02 · deepcopy, the algorithm"
sidebar_position: 3
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09 on **Python 3.14.7** against the [`copy` documentation](https://docs.python.org/3.14/library/copy.html) and the source of [`Lib/copy.py` at v3.14.7](https://github.com/python/cpython/blob/v3.14.7/Lib/copy.py). Documentation- and source-validated — **no sandbox run**; the traces below are read from the code, not observed.

**`copy.deepcopy(x, memo=None)` does the same first thing as `copy.copy` — look at `type(x)` — and then differs in one way that carries the whole function: it keeps a dictionary, keyed by `id()`, of everything it has already copied in this call. Before it copies anything it asks the dictionary; after it copies something it writes the result in. That one dictionary is why a cycle terminates, why an object referenced twice is copied once and referenced twice in the copy, and why the copy of a big graph needs the originals kept alive until the call returns. The function is pure Python with a four-entry dispatch table; everything else goes through the class's hook or the pickle protocol.**

## The function

`Lib/copy.py` at v3.14.7, verbatim:

```python
def deepcopy(x, memo=None, _nil=[]):
    cls = type(x)

    if cls in _atomic_types:
        return x

    d = id(x)
    if memo is None:
        memo = {}
    else:
        y = memo.get(d, _nil)
        if y is not _nil:
            return y

    copier = _deepcopy_dispatch.get(cls)
    if copier is not None:
        y = copier(x, memo)
    else:
        if issubclass(cls, type):
            y = x # atomic copy
        else:
            copier = getattr(x, "__deepcopy__", None)
            if copier is not None:
                y = copier(memo)
            else:
                reductor = dispatch_table.get(cls)
                if reductor:
                    rv = reductor(x)
                else:
                    reductor = getattr(x, "__reduce_ex__", None)
                    if reductor is not None:
                        rv = reductor(4)
                    else:
                        reductor = getattr(x, "__reduce__", None)
                        if reductor:
                            rv = reductor()
                        else:
                            raise Error(
                                "un(deep)copyable object of type %s" % cls)
                if isinstance(rv, str):
                    y = x
                else:
                    y = _reconstruct(x, memo, *rv)

    # If is its own copy, don't memoize.
    if y is not x:
        memo[d] = y
        _keep_alive(x, memo) # Make sure x lives at least as long as d
    return y
```

The public signature is `deepcopy(obj[, memo])`. The third parameter `_nil=[]` is a private sentinel: a fresh list that nothing else can be, so that `memo.get(d, _nil)` can tell "no entry" from an entry whose value happens to be falsy. Never pass it.

## The order of the checks

| # | Check | If it matches |
|---|---|---|
| 1 | `type(x)` is in `_atomic_types` | return `x` — **before** the memo is consulted |
| 2 | `memo` has an entry for `id(x)` | return that copy |
| 3 | `_deepcopy_dispatch[type(x)]` — the exact types `list`, `tuple`, `dict`, `types.MethodType` | `copier(x, memo)` |
| 4 | `type(x)` is a subclass of `type` | return `x` |
| 5 | `x.__deepcopy__` exists (an **instance** lookup) | `copier(memo)` |
| 6 | a `copyreg.dispatch_table` entry for the exact type | reduce value from `reductor(x)` |
| 7 | `x.__reduce_ex__(4)`, else `x.__reduce__()` | reduce value |
| 8 | the reduce value is a `str` | return `x` |
| 9 | otherwise | `_reconstruct(x, memo, *rv)` |

Then, for every route that gets past step 1 and 2: `if y is not x: memo[d] = y; _keep_alive(x, memo)`.

Three things to notice. The dispatch table has exactly four entries — `set`, `frozenset`, `bytearray`, `deque`, `OrderedDict` and every other container take route 9 in `deepcopy`, even though `copy.copy` has a shortcut for some of them. The dispatch (step 3) comes *before* the hook (step 5), so `__deepcopy__` cannot customise an exact `list`, `tuple` or `dict`, only a subclass. And bound methods are in the table — `deepcopy` builds a new method around a deep copy of the instance it is bound to, which the chunk on callables reads in full.

## A walk through one call

```python
import copy

shared = [1, 2]
data = {"a": shared, "b": shared}
clone = copy.deepcopy(data)

assert clone["a"] is clone["b"]        # one copy, referenced twice
assert clone["a"] is not shared        # and it IS a copy
```

Reading the source, in order:

1. `deepcopy(data)`: `cls` is `dict`, not atomic. `memo is None`, so `memo = {}` — there is nothing to look up on the first call. `_deepcopy_dict(data, memo)` is chosen.
2. `_deepcopy_dict` creates `y = {}` and writes `memo[id(data)] = y` **before copying any child**. This is what will end a cycle that leads back to `data`.
3. Key `"a"`: `deepcopy("a", memo)` is atomic. Value `shared`: `deepcopy(shared, memo)` finds no entry, dispatches to `_deepcopy_list`, which also registers its empty result first (`memo[id(shared)] = y`), copies the two integers, and returns.
4. Back in `deepcopy`, `y is not x`, so `memo[d] = y` and `_keep_alive(shared, memo)` runs. The first call to `_keep_alive` creates `memo[id(memo)] = [shared]`.
5. Key `"b"`: `deepcopy(shared, memo)` → `memo.get(id(shared))` hits → the same new list is returned. That is the whole mechanism of "a shared child is copied once".
6. The outermost `deepcopy` finishes: `memo[id(data)] = y`, `_keep_alive(data, memo)`.

The memo at the end holds three entries: `id(data)` → the new dict, `id(shared)` → the new list, and `id(memo)` → the list `[shared, data]`.

## `_keep_alive`, and why the memo owns your originals

```python
def _keep_alive(x, memo):
    """Keeps a reference to the object x in the memo.

    Because we remember objects by their id, we have
    to assure that possibly temporary objects are kept
    alive by referencing them.
    We store a reference at the id of the memo, which should
    normally not be used unless someone tries to deepcopy
    the memo itself...
    """
    try:
        memo[id(memo)].append(x)
    except KeyError:
        # aha, this is the first one :-)
        memo[id(memo)]=[x]
```

An `id()` is only unique among objects alive at the same time. If an original were freed during the copy, a later object could be allocated at the same address, receive the same `id`, and be answered from the memo with somebody else's copy. Ordinary graphs do not free their nodes mid-copy, but `deepcopy` also copies *temporaries* — for example, `set.__reduce__` builds a fresh list of the set's elements, and that list is deep-copied like any other object and then dropped. `_keep_alive` is what makes the temporary's `id` safe to record.

The consequence to plan for is memory: for the duration of the call the memo holds a strong reference to **every original that was copied**, plus the copies. A deep copy of a large graph needs the original, the duplicate, and the dictionary and list that track them, all at once. The memo is released when the outermost call returns — unless you passed your own dictionary in and kept it.

## What is never memoized

- **Atomic objects** return at step 1, before the memo is touched.
- **Objects that copy to themselves** (`y is x`) — a tuple of immutables, an enum member, a `__deepcopy__` that returns `self` — are skipped by the `if y is not x` guard. Two references to one of them each go through the whole decision again; the result is the same, only the work is repeated.

## Gotchas

**★ Symptom: two configs that shared a child before copying no longer share it after — each got its own.** Cause: the memo lives for one call. Two separate `deepcopy` calls on two structures start with two empty memos, so a child both structures reference is copied twice. Fix: copy them in one call so they share a memo, or pass the same memo to both calls (the next chunk covers reusing it deliberately).

```python
import copy

pool = {"size": 10}
web = {"pool": pool, "name": "web"}
worker = {"pool": pool, "name": "worker"}

web2, worker2 = copy.deepcopy((web, worker))      # one call, one memo
assert web2["pool"] is worker2["pool"]
assert web2["pool"] is not pool
```

**★ Symptom: memory climbs sharply during a deep copy of a large structure and drops when the call ends.** Cause: the memo keeps every original copied alive (`_keep_alive`) alongside the growing copy. Fix: copy pieces rather than the whole, drop references to what you no longer need before the call, or avoid the copy altogether by rebuilding only the levels you change.

```python
import copy


def copy_users_in_batches(users, batch_size=1000):
    for start in range(0, len(users), batch_size):
        yield copy.deepcopy(users[start:start + batch_size])
```

**Symptom: a `__deepcopy__` defined on `dict` or `list` via monkey-patching, or on an exact `dict`, never runs.** Cause: step 3 — the dispatch table — answers for exact `list`, `tuple`, `dict` and bound methods before the hook lookup at step 5. Fix: subclass, and copy the subclass; the hook is honoured there because the subclass type is not in the table.

```python
import copy


class AuditedDict(dict):
    def __deepcopy__(self, memo):
        clone = AuditedDict()
        memo[id(self)] = clone
        for key, value in self.items():
            clone[copy.deepcopy(key, memo)] = copy.deepcopy(value, memo)
        clone.copies = getattr(self, "copies", 0) + 1
        return clone
```

**Symptom: `deepcopy` returns a different object for something that is "obviously" immutable.** Cause: only the atomic set and self-returning hooks are shared; a frozen dataclass, a named tuple, or a `frozenset` is rebuilt (see [01b](01b-atomic-types-and-identity.md)). Fix: compare with `==`, not `is`.

**Symptom: passing a fourth positional argument or `_nil` to `deepcopy` "works" and confuses a reader.** Cause: `_nil` is a private default that happens to be positionally reachable. Fix: use only `deepcopy(x)` and `deepcopy(x, memo)`; the documented signature is `deepcopy(obj[, memo])`.

## Interview questions

**★ What does `deepcopy` do the second time it reaches an object it has already copied?**
It computes `id(x)`, finds the entry in the memo, and returns the stored copy without copying again. That is why a shared child stays shared in the copy, and why a cycle ends: the container registers its empty copy in the memo before it recurses, so the path back to it finds the entry.

**★ Why is the memo keyed by `id()`, and what is stored at `id(memo)`?**
Keying by `id` works for unhashable objects such as lists and dicts, which cannot be dictionary keys. Because an `id` is unique only among live objects, `_keep_alive` stores every original in a list at `memo[id(memo)]` so none of them can be freed and have its `id` reused during the call. The `id(memo)` slot is chosen because nothing else should ever be stored there — the source comment says "unless someone tries to deepcopy the memo itself".

**★ Two separate `deepcopy` calls on two structures that share a child — is the child still shared afterwards, and how do you keep it shared?**
No: each call has its own memo, so the child is copied once per call. Put both structures in one call — `copy.deepcopy((a, b))` — or pass the same memo dictionary to both calls.

**Why is an object that copies to itself not written into the memo?**
The guard `if y is not x` skips it. There is nothing to reuse — the "copy" is the original — and skipping saves a memo entry and a `_keep_alive` append. Atomic types exit even earlier, before the memo is consulted.

**Which builtin containers have their own `deepcopy` routine and which go through the reduce protocol?**
Only `list`, `tuple` and `dict` (plus bound methods) are in `_deepcopy_dispatch`. Sets, frozensets, bytearrays, deques, `OrderedDict`, `Counter` and instances of user classes reach `__deepcopy__` or the reduce route.

**Why can't `__deepcopy__` customise an exact `dict`?**
Because the dispatch table is consulted before the instance's `__deepcopy__` is looked up, and it has an entry for exactly `dict`. A `dict` subclass is a different type and misses the table, so its hook is honoured.

---

← [01b · Atomic types and identity](01b-atomic-types-and-identity.md) · [Topic index](README.md) · Next → [02b · The memo as an API](02b-the-memo-as-an-api.md)
