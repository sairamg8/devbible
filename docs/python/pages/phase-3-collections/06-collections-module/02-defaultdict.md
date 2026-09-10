---
title: "A defaultdict is a dict whose d[k] calls a zero-argument factory on a miss and stores the result — so it is exactly the tool for building a grouping, and the factory's two limits (it cannot see the key, and it fires on every read) decide everything else"
sidebar_label: "02 · defaultdict — a factory behind d[k]"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-10 against the Python 3.14 documentation — [`collections.defaultdict`](https://docs.python.org/3.14/library/collections.html#defaultdict-objects) and its examples, [Mapping Types — `dict`](https://docs.python.org/3.14/library/stdtypes.html#mapping-types-dict) (`__missing__`), [`str.format_map`](https://docs.python.org/3.14/library/stdtypes.html#str.format_map). Mechanism read from CPython **v3.14.7** [`Modules/_collectionsmodule.c`](https://github.com/python/cpython/blob/v3.14.7/Modules/_collectionsmodule.c) (`defdict_missing`, `defdict_init`, the `default_factory` member) — implementation detail where the docs are silent. Target: **Python 3.14.7**. **No sandbox run.**

**`defaultdict` changes one thing about `dict`: what `d[key]` does when the key is absent. Instead of raising `KeyError`, it calls `default_factory()` — with no arguments — stores the result under the key, and returns it. That single behaviour turns the four-line "if the key is missing, create an empty list, then append" into `groups[key].append(item)`, and the documentation calls it *"simpler and faster than an equivalent technique using `dict.setdefault()`"*. The factory also has two limits that are the source of every defaultdict bug: it is called without the key, so it cannot build a key-specific default; and it runs on every missing `d[key]`, including the ones that were only meant to read. This chunk is the mechanism and the build-phase patterns; **02b · `defaultdict` in production** *(not written yet)* is what happens when a defaultdict leaves the function that built it.**

## The mechanism: `__missing__`, and nothing else

`dict.__getitem__` has one documented hook for subclasses — *"If a subclass of dict defines a method `__missing__` and *key* is not present, the `d[key]` operation calls that method with the key *key* as argument."* `defaultdict` is a `dict` subclass that defines it:

> *"If the `default_factory` attribute is `None`, this raises a `KeyError` exception with the
> *key* as argument."*
> *"If `default_factory` is not `None`, it is called without arguments to provide a default value
> for the given *key*, this value is inserted in the dictionary for the *key*, and returned."*
> *"If calling `default_factory` raises an exception this exception is propagated unchanged."*

The C implementation's own docstring gives it as pseudo-code:

```python
# pseudo-code — the docstring of defdict_missing in Modules/_collectionsmodule.c, v3.14.7
def __missing__(self, key):
    if self.default_factory is None:
        raise KeyError((key,))
    self[key] = value = self.default_factory()
    return value
```

In `v3.14.7` the actual insert is `PyDict_SetDefaultRef` — insert only if the key is still absent, and return whatever ends up stored. That detail matters only under concurrency, and **02b** *(not written yet)* covers it.

And the scope rule, which is the one to remember:

> *"Note that `__missing__()` is *not* called for any operations besides `__getitem__()`. This
> means that `get()` will, like normal dictionaries, return `None` as a default rather than using
> `default_factory`."*

So `d[k]` creates; `d.get(k)`, `k in d`, `d.pop(k, None)` and `d.setdefault(k, x)` do not. The dict topic owns those four — [9 · Reading a key](../03-dict/04-reading-a-key.md) and [11 · `setdefault`](../03-dict/04c-setdefault.md).

## The build-phase patterns

**Group-by** — the documentation's first example, and the one to reach for by reflex:

```python
from collections import defaultdict
from dataclasses import dataclass


@dataclass(frozen=True)
class Order:
    order_id: int
    customer_id: str
    total_cents: int


def orders_by_customer(orders: list[Order]) -> dict[str, list[Order]]:
    grouped: defaultdict[str, list[Order]] = defaultdict(list)
    for order in orders:
        grouped[order.customer_id].append(order)
    return dict(grouped)            # hand back a plain dict — see 02b
```

On each first sighting of a customer, `grouped[...]` misses, `list()` builds an empty list, it is stored, and `.append` runs on it. Every later sighting is an ordinary lookup. The documentation's `setdefault` comparison is the same loop written as `d.setdefault(k, []).append(v)` — which builds and discards a new empty list on *every* iteration, hit or miss, because arguments are evaluated before the call.

**Distinct values per key** — `set` as the factory:

```python
def tags_by_article(pairs: list[tuple[int, str]]) -> dict[int, set[str]]:
    tags: defaultdict[int, set[str]] = defaultdict(set)
    for article_id, tag in pairs:
        tags[article_id].add(tag)
    return dict(tags)
```

**An inverted index** — the search-service staple, one line of real work:

```python
import re


def build_index(documents: dict[int, str]) -> dict[str, set[int]]:
    index: defaultdict[str, set[int]] = defaultdict(set)
    for doc_id, text in documents.items():
        for word in re.findall(r"\w+", text.lower()):
            index[word].add(doc_id)
    return dict(index)
```

**Adjacency lists** — a dependency graph from edge rows:

```python
def adjacency(edges: list[tuple[str, str]]) -> dict[str, list[str]]:
    graph: defaultdict[str, list[str]] = defaultdict(list)
    for source, target in edges:
        graph[source].append(target)
        graph[target]                 # deliberate read: make sinks appear as keys too
    return dict(graph)
```

That bare `graph[target]` is the factory used on purpose — a read that inserts, so nodes with no outgoing edges still show up. It is also the exact behaviour that becomes a bug everywhere it is *not* on purpose.

**Per-key tallies** — the factory can be any zero-argument callable, including a class:

```python
from collections import Counter


def status_codes_by_endpoint(log: list[tuple[str, int]]) -> dict[str, Counter[int]]:
    per_endpoint: defaultdict[str, Counter[int]] = defaultdict(Counter)
    for path, status in log:
        per_endpoint[path][status] += 1
    return dict(per_endpoint)
```

`defaultdict(int)` counts too — the documentation says it makes *"the `defaultdict` useful for counting (like a bag or multiset in other languages)"* — but a `Counter` gives you `most_common`, `total` and multiset arithmetic for the same line of code, so prefer it for counting (**03 · `Counter`** *(not written yet)*).

## The factory is a callable, not a value

`defaultdict`'s first argument is stored and *called*. In `v3.14.7`, `defdict_init` checks it and raises `TypeError("first argument must be callable or None")` for anything else — so `defaultdict([])` and `defaultdict(0)` fail at construction, which is the good outcome. The silent version is a callable that returns the *same* object every time:

```python
empty: list[str] = []
broken = defaultdict(lambda: empty)      # every key gets THE list `empty`
broken["a"].append("x")
broken["b"]                              # ['x'] — shared, exactly like dict.fromkeys(keys, [])
```

The factory must build a new object on each call; `list`, `set`, `dict` and `Counter` do. For a constant default, the documentation's own advice is a lambda:

> *"The function `int()` which always returns zero is just a special case of constant functions.
> A faster and more flexible way to create constant functions is to use a lambda function which
> can supply any constant value (not just zero)"*

— fine for immutable constants (`lambda: "unknown"`, `lambda: 0.0`), and the shared-object bug above for mutable ones.

## The factory cannot see the key

*"It is called without arguments"* — so a default that depends on the key (a per-tenant configuration loaded from a database, a lazily compiled regex per pattern) cannot be a `defaultdict`. It is a `dict` subclass with its own `__missing__`, which *does* receive the key:

```python
import re


class PatternCache(dict[str, re.Pattern[str]]):
    """Compile each pattern on first use, then reuse it."""

    def __missing__(self, pattern: str) -> re.Pattern[str]:
        compiled = self[pattern] = re.compile(pattern)
        return compiled


patterns = PatternCache()
patterns[r"^/api/v\d+/"].match("/api/v2/orders")     # compiled once, stored, returned
```

The same hook without the store gives "a default for unknown keys that is not remembered" — the `str.format_map` documentation's example, which is also the clean way to render a template that may reference fields you do not have:

```python
class Blank(dict[str, str]):
    def __missing__(self, key: str) -> str:
        return ""                          # not stored — the mapping does not grow


"Hello {first} {last}".format_map(Blank(first="Ada"))       # 'Hello Ada '
```

`format_map` is the method that makes this work: the documentation says it is *"Similar to `str.format(**mapping)`, except that `mapping` is used directly and not copied to a `dict`. This is useful if for example `mapping` is a dict subclass"*. `str.format(**m)` copies into a plain dict first, and the hook is lost.

## `default_factory` is writable — turn it off when building is done

`default_factory` is an ordinary writable attribute (*"it is initialized from the first argument to the constructor, if present, or to `None`, if absent"*). Setting it to `None` turns the object back into a dict that raises `KeyError`, without copying:

```python
def build_groups(orders: list[Order]) -> defaultdict[str, list[Order]]:
    grouped: defaultdict[str, list[Order]] = defaultdict(list)
    for order in orders:
        grouped[order.customer_id].append(order)
    grouped.default_factory = None          # reads that miss now raise KeyError
    return grouped
```

The type is still `defaultdict` and its `repr` still says `defaultdict(None, {...})`, so returning `dict(grouped)` is usually clearer; switching the factory off is the zero-copy option for a large structure.

## Gotchas

**★ Symptom: `TypeError: first argument must be callable or None` from `defaultdict([])` or `defaultdict(0)`.** Cause: the first argument is the factory, which is called on each miss — a value is not callable. Fix: pass the type (or a lambda).

```python
groups = defaultdict(list)
counts = defaultdict(int)
```

**★ Symptom: appending to one key's list appends to every key's list.** Cause: the factory returns the same object every time — `defaultdict(lambda: shared)`. Fix: make the factory build a new object per call.

```python
groups = defaultdict(list)                 # or: defaultdict(lambda: [])
```

**★ Symptom: `grouped.get(customer_id)` returns `None` for a customer who has orders "somewhere".** Cause: nothing — the customer genuinely has no key; `get` never calls the factory, by design. The trap is the reverse assumption, that `get` would return `[]`. Fix: index when you want the default, `get` when you want to know.

```python
orders = grouped[customer_id]              # [] for an unknown customer — and inserts the key
orders = grouped.get(customer_id, [])      # [] for an unknown customer — inserts nothing
```

**★ Symptom: a key-dependent default is needed — "load this tenant's config on first access" — and `defaultdict(load_config)` raises `TypeError: load_config() missing 1 required positional argument`.** Cause: the factory is *"called without arguments"*. Fix: a `dict` subclass whose `__missing__` receives the key.

```python
class TenantConfigs(dict[str, dict[str, str]]):
    def __missing__(self, tenant: str) -> dict[str, str]:
        config = self[tenant] = load_config(tenant)
        return config
```

**Symptom: `if grouped[customer_id]:` leaves an empty entry for every customer checked.** Cause: that is `d[k]`, and a miss inserts. Fix: test membership, or `get`.

```python
if grouped.get(customer_id):
    notify(customer_id)
```

**Symptom: a template rendered with `"{missing}".format(**defaults)` raises `KeyError` even though `defaults` is a `defaultdict`.** Cause: `**` copies into a plain `dict` before `format` sees it, so `__missing__` is gone. Fix: `format_map`, which uses the mapping directly.

```python
"{name} ran to {object}".format_map(defaultdict(lambda: "<missing>", name="John"))
```

**Symptom: an ID allocator built as `defaultdict(itertools.count().__next__)` hands out IDs for names nobody registered.** Cause: that factory is a genuine and neat trick — the first `ids[name]` assigns the next integer — but any read, including a debug log of `ids[name]`, is an assignment. Fix: read with `get` everywhere except the one place that registers.

```python
import itertools

ids: defaultdict[str, int] = defaultdict(itertools.count().__next__)
user_id = ids["ada"]                  # registers ada → 0
known = ids.get("grace")              # None — does not register grace
```

**Symptom: the factory raised (say, a database error inside a `__missing__`-style loader) and the key is absent afterwards.** Cause: *"If calling `default_factory` raises an exception this exception is propagated unchanged"* — nothing is stored, which is correct. Fix: nothing to fix; do not wrap the lookup in a `try` that swallows the error and then assume the key exists.

```python
try:
    config = configs[tenant]
except DatabaseError:
    config = FALLBACK_CONFIG             # the key is still absent; the next access retries
```

## Interview questions

**★ How does `defaultdict` work?**
It is a `dict` subclass that defines `__missing__`, the hook `dict.__getitem__` calls when a key is absent. Its `__missing__` calls `default_factory()` with no arguments, inserts the result under the key, and returns it; if `default_factory` is `None` it raises `KeyError` like a plain dict. Only subscription triggers it — `get`, `in`, `pop` and `setdefault` behave exactly as on a `dict`. Everything else is inherited from `dict` unchanged.

**★ Why is `defaultdict(list)` better than `d.setdefault(k, []).append(v)`?**
The documentation calls it *"simpler and faster"*, and the mechanism is why: `setdefault`'s default argument is evaluated before the call, so the loop builds and throws away an empty list on every iteration, including every hit. `defaultdict` calls `list()` only on a miss. `setdefault` remains the right tool when the default differs per call site or the result must stay a plain `dict` — see [11 · `setdefault`](../03-dict/04c-setdefault.md).

**★ How do you give a mapping a default that depends on the key?**
Not with `defaultdict` — its factory is called without arguments. Subclass `dict` and define `__missing__(self, key)`, which receives the key: store the computed value with `self[key] = value` to memoise it, or just return it to supply a default without growing the mapping. That second form, used with `str.format_map`, renders templates with missing fields.

**What does `default_factory = None` do to an existing `defaultdict`?**
It switches the default off: `__missing__` then raises `KeyError`, so the object behaves like a plain dict under `d[k]` while keeping its contents and its type. It is a zero-copy way to stop a finished grouping from growing when someone reads a missing key. `dict(d)` achieves the same with a copy and also changes the type, which is usually clearer at an API boundary.

**What happens if the factory raises?**
The documentation: the exception *"is propagated unchanged"*. `__missing__` has not inserted anything at that point, so the key stays absent and the next `d[k]` calls the factory again. That makes a raising factory safe to retry, and means a caught exception must not be followed by code that assumes the key now exists.

**Why is `defaultdict(lambda: [])` correct but `defaultdict(lambda: my_list)` wrong?**
Both are zero-argument callables, but the first evaluates `[]` on each call and returns a new list, while the second returns the same existing list every time. Every key then shares one list — the same aliasing bug as `dict.fromkeys(keys, [])` ([12 · `fromkeys`](../03-dict/04d-fromkeys.md)). The factory's job is to *build* a default, not to name one.

---

← Prev: [01 · Nine types, three families](01-nine-types-three-families.md) · [Topic index](README.md)
