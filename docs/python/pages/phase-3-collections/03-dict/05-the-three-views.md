---
title: "keys(), values() and items() are live windows onto the dictionary, not copies of it — which makes them free to create, dangerous to hold, and the reason list(d) exists"
sidebar_label: "13 · The three views"
sidebar_position: 13
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-10 against the Python 3.14 documentation — [Dictionary view objects](https://docs.python.org/3.14/library/stdtypes.html#dictionary-view-objects), [Mapping Types — dict](https://docs.python.org/3.14/library/stdtypes.html#mapping-types-dict), [Glossary — *dictionary view*](https://docs.python.org/3.14/glossary.html#term-dictionary-view), [`types.MappingProxyType`](https://docs.python.org/3.14/library/types.html#types.MappingProxyType). Target: **CPython 3.14** (3.14.7). Documentation-validated; **no sandbox run**.

**A view is not a list and it is not a snapshot. `d.keys()` does not walk the dictionary, does not allocate one element per key and does not freeze anything — it hands back a small object that reads the dictionary every time you ask it something. That makes creating a view *O*(1) and essentially free, which is why `for k in d.keys()` is not slow. It also means a view you stored five lines ago reflects a dictionary someone else has since changed, which is the source of every surprise on this page and the next.**

## The definition

> *"The objects returned by `dict.keys()`, `dict.values()` and `dict.items()` are *view objects*. They provide a dynamic view on the dictionary's entries, which means that when the dictionary changes, the view reflects these changes."*

The glossary repeats it and then gives the escape:

> *"They provide a dynamic view on the dictionary's entries, which means that when the dictionary changes, the view reflects these changes. **To force the dictionary view to become a full list use `list(dictview)`.**"*

```python
config = {"host": "db", "port": 5432}
keys = config.keys()

config["ssl"] = True
len(keys)                # 3 — the view saw the insertion
list(keys)               # a real list, frozen at this moment
```

That is the whole model. Everything below follows from it.

## What a view supports

| Operation | Documented as |
|---|---|
| `len(dictview)` | *"Return the number of entries in the dictionary."* |
| `iter(dictview)` | *"Return an iterator over the keys, values or items (represented as tuples of `(key, value)`) in the dictionary."* |
| `x in dictview` | *"Return `True` if *x* is in the underlying dictionary's keys, values or items (in the latter case, *x* should be a `(key, value)` tuple)."* |
| `reversed(dictview)` | *"Return a reverse iterator over the keys, values or items of the dictionary. The view will be iterated in reverse order of the insertion."* (3.8+) |
| `dictview.mapping` | *"Return a `types.MappingProxyType` that wraps the original dictionary to which the view refers."* (3.10+) |

And what it does **not** support: indexing, slicing, `.append`, `.sort`, `+`. A view is not a sequence.

```python
d.keys()[0]          # TypeError — 'dict_keys' object is not subscriptable
d.items()[1:3]       # TypeError — no slicing
list(d)[0]           # the correct spelling, at the cost of a full copy
next(iter(d))        # the O(1) spelling for "the first key"
```

## The co-ordering guarantee

> *"Keys and values are iterated over in insertion order. This allows the creation of `(value, key)` pairs using `zip()`: `pairs = zip(d.values(), d.keys())`. Another way to create the same list is `pairs = [(v, k) for (k, v) in d.items()]`."*

Two separate views over the same dictionary walk it in the same order. That is what makes `zip(d.values(), d.keys())` meaningful, and it is a documented promise rather than an accident of the implementation.

⚠️ It holds only while the dictionary is unmodified between the two iterations. `zip` consumes both lazily, so a mutation in the middle of the zip breaks the pairing — and, per [14 · Mutating while iterating](05b-mutating-while-iterating.md), usually raises.

## `values()` is never equal to anything, including itself

🔴 > *"An equality comparison between one `dict.values()` view and another will always return `False`. This also applies when comparing `dict.values()` to itself"*

The documentation demonstrates it with `d = {'a': 1}` and `d.values() == d.values()` giving `False`.

The reason is structural: `keys()` and `items()` are set-like, so they inherit set equality; `values()` is not set-like — *"(Values views are not treated as set-like since the entries are generally not unique.)"* — and no other equality is defined for it, so it falls back to identity, and two calls to `d.values()` produce two objects.

```python
d.keys() == d.keys()          # True   — set-like
d.items() == d.items()        # True   — set-like
d.values() == d.values()      # False  — always, documented
```

This is a real trap in tests:

```python
# always fails, whatever the data
assert response.values() == expected.values()

# compare the materialised sequences instead
assert list(response.values()) == list(expected.values())

# or, if order should not matter and the values are hashable
assert sorted(response.values()) == sorted(expected.values())
```

## `.mapping` — a read-only handle back to the dictionary

Added in 3.10:

> *"Return a `types.MappingProxyType` that wraps the original dictionary to which the view refers."*

and `MappingProxyType` is itself documented as *"Read-only proxy of a mapping. It provides a dynamic view on the mapping's entries, which means that when the mapping changes, the view reflects these changes."*

```python
values = settings.values()
proxy = values.mapping           # a read-only view of `settings`
proxy["host"]                    # works
proxy["host"] = "other"          # TypeError — the proxy is read-only
```

That is the safe way to hand a caller "look at my dictionary" without handing them the dictionary. The proxy is *not* a copy — a write through the original is visible through the proxy — so it protects against accidental mutation by the recipient, not against a race.

```python
from collections.abc import Mapping
from types import MappingProxyType


class Settings:
    def __init__(self, values: dict[str, str]) -> None:
        self._values = values

    @property
    def values(self) -> Mapping[str, str]:
        """A live, read-only view. Callers cannot mutate; they do see updates."""
        return MappingProxyType(self._values)
```

## Views are free; lists are not

Creating a view is a small fixed cost. Materialising it is *O*(n) in both time and memory — the complexity page lists iteration at *O*(n) and copying at *O*(n).

```python
# free: no allocation proportional to the dict
for key in d:                    # iter(d) is documented as a shortcut for iter(d.keys())
    emit(key)
for key, value in d.items():
    emit(key, value)
present = "host" in d
n = len(d)

# O(n) allocation, and each one is a separate full copy
keys = list(d.keys())
items = list(d.items())
```

🔴 **`list(d)` is not a wasteful habit — it is sometimes the *only* correct spelling**, because it snapshots. That is the entire subject of [14 · Mutating while iterating](05b-mutating-while-iterating.md).

Two more consequences of "a view is a handle, not a copy":

**A view keeps the dictionary alive.** Holding `d.keys()` holds a reference to `d`, so the dictionary cannot be collected while any of its views are reachable. Storing a view on a long-lived object to "save memory" over storing a list can therefore pin the *whole* dictionary, values included, when a list of keys would have pinned only the keys.

**A view returned from a function leaks write-visibility.** Returning `self._data.keys()` from a method looks read-only, and it is — the caller cannot mutate through it — but they *can* see every subsequent change, including entries added after the call. If the contract is "the keys as of now", materialise:

```python
def known_regions(self) -> list[str]:
    return list(self._data)        # a snapshot; the caller sees a fixed answer
```

## `iter(d)`, `d.keys()` and the redundant spelling

> *"`iter(d)` — Return an iterator over the keys of the dictionary. This is a shortcut for `iter(d.keys())`."*

So `for k in d` and `for k in d.keys()` are the same operation, and the shorter one is idiomatic. `.keys()` earns its place in exactly two situations: when you want the **set-like** operations ([16 · Set operations on views](05d-set-operations-on-views.md)), and when you want `.mapping`. Everywhere else it is noise.

```python
for key in mapping:                       # idiomatic
    emit(key)

changed = new_config.keys() - old_config.keys()    # .keys() is doing real work
```

## Gotchas

**★ Symptom: a test comparing `d.values()` to another `d.values()` always fails.** Cause: documented behaviour — *"An equality comparison between one `dict.values()` view and another will always return `False`."* Fix: materialise both sides.

```python
assert list(response.values()) == list(expected.values())
```

**★ Symptom: a stored `d.keys()` reports keys that were added after it was created.** Cause: a view is a live window — *"when the dictionary changes, the view reflects these changes."* Fix: snapshot with `list()` at the moment the answer should be fixed.

```python
self._known = list(config)        # not config.keys()
```

**★ Symptom: `TypeError: 'dict_keys' object is not subscriptable`.** Cause: a view is not a sequence; it supports `len`, iteration, membership and `reversed`, and nothing else. Fix: index a list if you need a position, or use `next(iter(...))` if you only need the first.

```python
first = next(iter(d))          # O(1)
third = list(d)[2]             # O(n), but honest about the cost
```

**★ Symptom: a method returns `self._data.items()` and a caller sees later mutations.** Cause: the view is bound to the live dictionary, not to its state at return time. Fix: return a snapshot, or a read-only proxy if live-but-unwritable is what you meant.

```python
from collections.abc import Mapping
from types import MappingProxyType

def snapshot(self) -> dict[str, str]:
    return dict(self._data)                 # frozen at this instant

def live(self) -> Mapping[str, str]:
    return MappingProxyType(self._data)     # live, read-only
```

**Symptom: memory does not drop after a large dictionary "goes out of scope".** Cause: a view of it is still reachable, and a view holds a reference to the whole dictionary — values included. Fix: store a materialised list of just what you need.

```python
self._region_names = list(regions)     # not regions.keys()
```

**Symptom: `zip(d.values(), d.keys())` pairs the wrong values with the wrong keys.** Cause: the dictionary was mutated between the two lazily-consumed iterations. The co-ordering promise — *"Keys and values are iterated over in insertion order"* — describes two unmodified traversals. Fix: use `items()`, which produces the pair in one traversal.

```python
pairs = [(value, key) for key, value in d.items()]
```

**Symptom: a `MappingProxyType` handed to a caller still shows changes.** Cause: it is a proxy, not a copy — *"It provides a dynamic view on the mapping's entries, which means that when the mapping changes, the view reflects these changes."* Fix: if the caller must see a fixed state, hand them `dict(self._data)`.

**Symptom: `x in d.values()` is slow.** Cause: `values()` is not set-like and has no index; membership over it is a linear scan, unlike `x in d`, which is *O*(1). Fix: build an inverse mapping once if the test is repeated.

```python
by_value = {value: key for key, value in d.items()}
```

**Symptom: a lint rule or reviewer objects to `for k in d.keys()`.** Cause: `iter(d)` is documented as *"a shortcut for `iter(d.keys())`"*, so `.keys()` constructs a view purely to be iterated. Fix: drop it, unless you are using the set-like operations or `.mapping`.

## Interview questions

**★ What is a dictionary view, and how is it different from a list of keys?**
It is a small object that reads the dictionary on demand rather than copying it. The documentation calls it *"a dynamic view on the dictionary's entries, which means that when the dictionary changes, the view reflects these changes."* Creating one is *O*(1) and allocates nothing proportional to the dictionary; a list of keys is *O*(n) in time and memory and is frozen at the moment you build it. That difference is why `for k in d.keys()` is not slow, and why `list(d)` is sometimes the only correct spelling — it is how you deliberately stop being live.

**★ Why does `d.values() == d.values()` return `False`?**
Because values views are not set-like and define no value equality, so the comparison falls back to identity — and the two calls produced two different objects. The documentation states the outcome without hedging: *"An equality comparison between one `dict.values()` view and another will always return `False`. This also applies when comparing `dict.values()` to itself."* The reason values views are excluded from set-likeness is given in the same section: *"the entries are generally not unique."* `keys()` and `items()` *are* set-like, so those compare by content.

**★ You return `self._data.keys()` from a method. What have you actually given the caller?**
A live, read-only window. They cannot mutate through it, so it feels safe, but they will see every key added or removed afterwards — and if they store it, they pin the entire dictionary in memory, values included. If the contract is "the keys as of now", return `list(self._data)`. If it is "a live read-only view of the whole mapping", return `MappingProxyType(self._data)`, which at least says so in the type.

**★ How do you get the first key of a dict, and why is `list(d)[0]` the wrong habit?**
`next(iter(d))`. Views are not subscriptable, so people reach for `list(d)[0]`, which copies every key to read one — *O*(n) time and *O*(n) memory for a constant-time answer. On a large mapping inside a request path that is a genuine cost, and it hides behind a familiar-looking index expression. The same applies to `list(d)[-1]` versus `next(reversed(d))` on 3.8 and later.

**What is `.mapping` on a view for?**
It gives you back a read-only handle to the dictionary the view belongs to, as a `types.MappingProxyType`, added in 3.10. The use is symmetric to the view itself: given only a `values()` view, you can recover keyed access without being handed the mutable dictionary. It is a proxy rather than a copy, so it stays live — good for exposing configuration to a plugin, useless as a defence against concurrent modification.

**Is there any cost to calling `d.items()` inside a loop condition?**
It allocates a fresh view object each time, which is a small constant, and it does not copy the dictionary. So `while d.items():` is not the performance problem it looks like — but it is still worse than `while d:`, which asks the dictionary directly. The general principle: views are cheap to make and cheap to query; the expensive operation is `list()`, and that is the one to look for in a hot path.

---

← [12 · `fromkeys`](04d-fromkeys.md) · [Topic index](README.md) · Next → [14 · Mutating while iterating](05b-mutating-while-iterating.md)
