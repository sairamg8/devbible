---
title: "A ChainMap is a list of mappings searched front to back on every lookup — nothing is copied, so later changes to any layer show through, a per-request override is one new_child() away, and the price is that every miss walks the whole chain and len() rebuilds a set of every key"
sidebar_label: "06 · ChainMap — layered lookup"
sidebar_position: 11
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-10 against the Python 3.14 documentation — [`collections.ChainMap`](https://docs.python.org/3.14/library/collections.html#chainmap-objects) (`maps`, `new_child`, `parents`, iteration order, the examples and recipes). Method bodies read from CPython **v3.14.7** [`Lib/collections/__init__.py`](https://github.com/python/cpython/blob/v3.14.7/Lib/collections/__init__.py) (`class ChainMap`, lines 998–1126) — implementation detail where the docs are silent. Target: **Python 3.14.7**. **No sandbox run, no timings.**

**Configuration in a service comes in layers — command-line flags over environment variables over a config file over built-in defaults — and so do template contexts, per-tenant feature flags and variable scopes. `ChainMap` represents the layering directly: it keeps a list of mappings and answers `chain[key]` by trying each one in order until one has the key. *"There is no other state."* Nothing is merged or copied, so a change to any layer is visible immediately, building a chain costs nothing, and pushing a per-request override on top is `chain.new_child(overrides)`. Writes, by contrast, go only to the first mapping. The costs follow from the same design: a lookup that misses tries every layer, each miss in a layer is a caught `KeyError`, and `len()` and iteration have to union the keys of every layer each time they are called. This chunk is the mechanism and the patterns; [06b · `ChainMap` traps](06b-chainmap-traps.md) is where writes, deletes and odd layers go wrong.**

## The mechanism

> *"A `ChainMap` groups multiple dicts or other mappings together to create a single, updateable
> view. If no *maps* are specified, a single empty dictionary is provided so that a new chain
> always has at least one mapping."*
> *"The underlying mappings are stored in a list. That list is public and can be accessed or updated
> using the *maps* attribute. There is no other state."*
> *"Lookups search the underlying mappings successively until a key is found. In contrast, writes,
> updates, and deletions only operate on the first mapping."*
> *"A `ChainMap` incorporates the underlying mappings by reference. So, if one of the underlying
> mappings gets updated, those changes will be reflected in `ChainMap`."*

The read path in `v3.14.7`, in full:

```python
# Lib/collections/__init__.py, v3.14.7 — ChainMap
def __getitem__(self, key):
    for mapping in self.maps:
        try:
            return mapping[key]             # can't use 'key in mapping' with defaultdict
        except KeyError:
            pass
    return self.__missing__(key)            # support subclasses that define __missing__

def __contains__(self, key):
    for mapping in self.maps:
        if key in mapping:
            return True
    return False

def __len__(self):
    return len(set().union(*self.maps))     # reuses stored hash values if possible

def __iter__(self):
    d = {}
    for mapping in map(dict.fromkeys, reversed(self.maps)):
        d |= mapping                        # reuses stored hash values if possible
    return iter(d)
```

And the write path is one line: `__setitem__` is `self.maps[0][key] = value`.

## Layered settings: the documentation's example, made safe

The documentation's recipe lets command-line arguments override environment variables, which override defaults:

```python
import os, argparse

defaults = {'color': 'red', 'user': 'guest'}

parser = argparse.ArgumentParser()
parser.add_argument('-u', '--user')
parser.add_argument('-c', '--color')
namespace = parser.parse_args()
command_line_args = {k: v for k, v in vars(namespace).items() if v is not None}

combined = ChainMap(command_line_args, os.environ, defaults)
print(combined['color'])
print(combined['user'])
```

Priority is the order of the arguments — first wins. Reading is exactly right. Writing is where it bites: `combined["color"] = "blue"` lands in `command_line_args`, a dict other code may hold; and if someone reorders the layers so `os.environ` is first, a write sets a real process environment variable. The robust shape puts an empty, owned dict on top and makes the lower layers read-only:

```python
import os
from collections import ChainMap
from types import MappingProxyType

DEFAULTS = MappingProxyType({"color": "red", "user": "guest", "timeout": "30"})


def load_settings(cli: dict[str, str], file_config: dict[str, str]) -> ChainMap[str, str]:
    return ChainMap(
        {},                                   # runtime overrides land here, and only here
        MappingProxyType(cli),
        os.environ,                           # read-through; never maps[0]
        MappingProxyType(file_config),
        DEFAULTS,
    )
```

Every write goes to the anonymous dict at `maps[0]`; the proxies make an accidental write to a lower layer (through a `DeepChainMap`-style subclass, or direct `maps[i]` access) raise instead of succeed. [06b · `ChainMap` traps](06b-chainmap-traps.md) has the failures this prevents.

## Per-request overrides: `new_child()`

> *"Returns a new `ChainMap` containing a new map followed by all of the maps in the current
> instance. If `m` is specified, it becomes the new map at the front of the list of mappings; if not
> specified, an empty dict is used, so that a call to `d.new_child()` is equivalent to:
> `ChainMap({}, *d.maps)`."* … *"This method is used for creating subcontexts that can be updated
> without altering values in any of the parent mappings."*

A request that carries its own overrides — a tenant's feature flags, an A/B bucket, a header that forces a debug mode — gets its own chain without copying the base configuration:

```python
from collections import ChainMap
from types import MappingProxyType

BASE_FLAGS = ChainMap(MappingProxyType({"new_checkout": False, "search_v2": True}))
TENANT_FLAGS: dict[str, dict[str, bool]] = {"acme": {"new_checkout": True}}


def flags_for(tenant: str, request_overrides: dict[str, bool]) -> ChainMap[str, bool]:
    tenant_layer = MappingProxyType(TENANT_FLAGS.get(tenant, {}))
    return BASE_FLAGS.new_child(tenant_layer).new_child(dict(request_overrides))
```

Each call builds a list of three references — no dictionary is copied, however large the base is. The request's chain can be written to freely (its `maps[0]` is a fresh dict), and nothing it does reaches another request.

## Scopes: `new_child()` to enter, `parents` to look outward

> *"Property returning a new `ChainMap` containing all of the maps in the current instance except the
> first one. This is useful for skipping the first map in the search. Use cases are similar to those
> for the `nonlocal` keyword used in nested scopes."*

The documentation's own illustration:

```python
c = ChainMap()        # Create root context
d = c.new_child()     # Create nested child context
e = c.new_child()     # Child of c, independent from d
e.maps[0]             # Current context dictionary -- like Python's locals()
e.maps[-1]            # Root context -- like Python's globals()
e.parents             # Enclosing context chain -- like Python's nonlocals

d['x'] = 1            # Set value in current context
d['x']                # Get first key in the chain of contexts
del d['x']            # Delete from current context
list(d)               # All nested values
k in d                # Check all nested values
len(d)                # Number of nested values
d.items()             # All nested items
dict(d)               # Flatten into a regular dictionary
```

That is the whole of a variable-scoping implementation for a small rules language or template engine: each block runs with `scope = scope.new_child()`, assignments go to the innermost scope, lookups fall through to enclosing ones. The documentation's seealso notes that *"Django's Context class for templating is a read-only chain of mappings"* with push and pop *"similar to the `new_child()` method and the `parents` property."*

## `maps` is a public list

*"A user updateable list of mappings. The list is ordered from first-searched to last-searched. It is the only stored state and can be modified to change which mappings are searched. The list should always contain at least one mapping."* You can insert a layer into a live chain — `settings.maps.insert(1, feature_overrides)` — and every holder of that chain sees it. That is a feature for hot-reloading one layer (replace `maps[i]` with the newly parsed file) and a hazard when a chain is shared and one caller rearranges it for everyone.

## What it costs, and when to flatten

From the source above:

- **A hit in layer *k*** costs *k* lookups, and each of the *k*−1 misses raises and catches a `KeyError`.
- **A total miss** tries every layer, then raises.
- **`in`** tries every layer with `in`; no exceptions.
- **`len(chain)`** builds a `set` of every key in every layer — O(total keys) on *every* call.
- **Iterating** builds a `dict` of every key in every layer — O(total keys) before the first key is yielded.
- **`bool(chain)`** is `any(self.maps)`: cheap.

The documentation's performance claim is about *building* a combined view — *"It is often much faster than creating a new dictionary and running multiple `update()` calls"* — and that is true because building a chain is building a list. For a configuration read once per request, the chain is the right trade. For a lookup in a hot loop against layers that do not change, flatten once: `dict(chain)` (or `{**chain}`) produces an ordinary dict with first-layer-wins values and O(1) lookups — and loses the live view. Never call `len(chain)` or iterate a large chain inside a per-item loop.

## Iteration order

> *"Note, the iteration order of a `ChainMap` is determined by scanning the mappings last to
> first"* — with `baseline = {'music': 'bach', 'art': 'rembrandt'}` and `adjustments = {'art': 'van
> gogh', 'opera': 'carmen'}`, the documentation shows `list(ChainMap(adjustments, baseline))` as
> `['music', 'art', 'opera']`.

Keys come out in the order a series of `dict.update` calls from the last layer to the first would produce; values come from the first layer that has the key. So `dict(chain)` is exactly `{**last, …, **first}`.

## Gotchas

**★ Symptom: a key set through the settings object appears in the user's CLI-args dict (or in `os.environ`).** Cause: *"writes, updates, and deletions only operate on the first mapping"*, and the first mapping is a real dict someone else holds. Fix: put an empty, owned dict first — `new_child()` does exactly that. ([06b · `ChainMap` traps](06b-chainmap-traps.md) has the `os.environ` case.)

```python
settings = ChainMap(cli_args, os.environ, DEFAULTS).new_child()
```

**★ Symptom: a request handler that calls `len(settings)` or iterates the settings chain is the slowest thing in the profile.** Cause: `__len__` unions the keys of every layer into a new set, and `__iter__` builds a new dict of all keys, on every call. Fix: flatten once when the layers are static, or avoid `len`/iteration on the hot path.

```python
FLAT_SETTINGS = dict(settings)          # at startup; O(1) lookups afterwards
```

**★ Symptom: a lookup in a deep chain of mostly-missing layers is unexpectedly slow.** Cause: every layer that lacks the key raises and catches a `KeyError` inside `__getitem__`. Fix: keep chains shallow; put the most-hit layer first; flatten static layers into one dict.

```python
settings = ChainMap({}, MappingProxyType({**file_config, **DEFAULTS}))   # one static layer
```

**Symptom: a change to the config file on disk is not reflected after "reloading" the settings.** Cause: the reload built a new dict but the chain still references the old one — `ChainMap` holds mappings by reference. Fix: replace the layer in `maps`, or mutate the layer in place.

```python
settings.maps[3] = MappingProxyType(parse_config_file(path))
```

**Symptom: `priority` comes from the wrong layer after converting `ChainMap(a, b)` to `a | b`.** Cause: a ChainMap is first-found-wins; `|` is last-wins ([19 · Merging](../03-dict/07-merging.md)). Fix: reverse the order.

```python
flat = b | a                            # same values as dict(ChainMap(a, b))
```

**Symptom: keys come out of `list(chain)` in an order that matches none of the layers.** Cause: iteration scans the mappings last to first, as a series of `update` calls would. Fix: if order matters, define it explicitly.

```python
ordered_keys = sorted(chain)
```

## Interview questions

**★ How does `ChainMap` look up a key, and what happens on a write?**
It keeps a list of mappings, `maps`, and `chain[key]` tries `mapping[key]` on each in order, returning the first hit and raising `KeyError` if none has it. Writes, updates and deletions touch only `maps[0]`. Nothing is copied: the mappings are held by reference, so later changes to any layer show through. That combination — search every layer, write the first — is exactly Python's own name resolution, which the documentation mirrors with `ChainMap(locals(), globals(), vars(builtins))`.

**★ When would you choose `ChainMap` over merging with `|` or `{**a, **b}`?**
When the layers are live or the view is short-lived: settings where one layer (environment, a hot-reloaded file) can change underneath, per-request override stacks where copying a large base per request would be waste, and nested scopes. A merge produces a snapshot dict with O(1) lookups and no connection to its inputs; a chain produces a live view whose lookups cost one probe per layer. Also mind the priority: `ChainMap(a, b)` prefers `a`, `a | b` prefers `b`.

**★ What do `new_child()` and `parents` do?**
`new_child(m=None)` returns a new chain with `m` (or a fresh empty dict) in front of all the current maps — the documentation's *"subcontexts that can be updated without altering values in any of the parent mappings"*. `parents` returns a new chain of every map except the first — *"Use cases are similar to those for the `nonlocal` keyword"*. Together they are push and pop for a scope stack: enter a block with `scope = scope.new_child()`, read an enclosing binding through `scope.parents`.

**What are the costs of `len()` and iteration on a `ChainMap`?**
Both are O(total number of keys across all layers) per call. In CPython 3.14, `__len__` builds `set().union(*self.maps)` to count distinct keys and `__iter__` builds a dict by merging `dict.fromkeys` of each map from last to first. Neither is cached, because the layers may have changed since the last call. On a hot path, flatten once with `dict(chain)` if the layers are static.

**Why does `ChainMap.__getitem__` use `try`/`except KeyError` instead of `if key in mapping`?**
The source comment says why: *"can't use 'key in mapping' with defaultdict"*. Asking each layer for `mapping[key]` lets a layer's own missing-key behaviour (a `defaultdict` factory, a `Counter`'s zero) take part in the lookup. The price is an exception per missed layer — and, as [06b · `ChainMap` traps](06b-chainmap-traps.md) shows, a layer that never raises ends the search at that layer.

**How would you give each request its own feature-flag overrides on top of tenant and global flags?**
Build a chain per request: `BASE.new_child(tenant_layer).new_child(request_overrides)`. It costs a short list of references, not a copy of the base flags; lookups fall through request → tenant → global; writes land in the request's own front dict and never leak into shared layers. Wrapping the shared layers in `MappingProxyType` makes an accidental write to them raise.

---

← Prev: [05 · `namedtuple` from the factory side](05-namedtuple-factory-side.md) · [Topic index](README.md) · Next → [06b · `ChainMap` traps](06b-chainmap-traps.md)
