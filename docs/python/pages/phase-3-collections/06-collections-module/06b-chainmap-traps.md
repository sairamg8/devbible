---
title: "Every ChainMap trap is the read path and the write path disagreeing — a write lands in a dict someone else owns, del refuses a key the chain plainly shows, a defaultdict layer swallows lookups meant for the layers below it, and new_child(m, **kw) writes into m"
sidebar_label: "06b · ChainMap traps"
sidebar_position: 12
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-10 against the Python 3.14 documentation — [`collections.ChainMap`](https://docs.python.org/3.14/library/collections.html#chainmap-objects) (`maps`, `new_child`, `parents`, the `DeepChainMap` recipe), [`os.environ`](https://docs.python.org/3.14/library/os.html#os.environ), [`types.MappingProxyType`](https://docs.python.org/3.14/library/types.html#types.MappingProxyType). Every method body and error message read from CPython **v3.14.7** [`Lib/collections/__init__.py`](https://github.com/python/cpython/blob/v3.14.7/Lib/collections/__init__.py) (`class ChainMap`, lines 998–1126) and [`Lib/_collections_abc.py`](https://github.com/python/cpython/blob/v3.14.7/Lib/_collections_abc.py) (`Mapping.__eq__`). Target: **Python 3.14.7**. **No sandbox run.**

**[06](06-chainmap-layered-lookup.md) showed that a `ChainMap` reads through every layer and writes only to the first. Nearly every bug it causes is that asymmetry meeting code that assumes a dict. Assigning a key writes into whatever mapping is first — a caller's argument dict, or `os.environ`. Deleting a key the chain returns raises `KeyError` if that key lives in any layer but the first, and `clear()` leaves every lower layer's keys visible. A `defaultdict` or `Counter` in the middle answers every miss itself, so the layers below it are never consulted, and `k in chain` and `chain[k]` stop agreeing. `new_child(m, **kwargs)` updates the `m` you passed in. `parents` writes through to the real enclosing dict — or, on a one-layer chain, into a throwaway dict. None of these raises at the point of the mistake. The fixes are all small: own the front layer, make the others read-only, keep defaulting mappings out of the middle, and flatten a snapshot when a request needs consistent values.**

## Writes land in someone else's dict

`__setitem__` in `v3.14.7` is `self.maps[0][key] = value`, and `update`, `setdefault` and `|=` all end there. Whatever object is first receives the write:

```python
import os
from collections import ChainMap

def settings_for(cli_args: dict[str, str]) -> ChainMap[str, str]:
    return ChainMap(cli_args, os.environ, {"LOG_LEVEL": "INFO"})

settings = settings_for(parsed_args)
settings["LOG_LEVEL"] = "DEBUG"        # 🔴 parsed_args now contains LOG_LEVEL

chain = ChainMap(os.environ, {"LOG_LEVEL": "INFO"})
chain["FEATURE_X"] = "1"               # 🔴 sets a real environment variable for the whole process
```

The second one is worse than it looks. The `os` documentation: *"Assignments to items in `os.environ` are automatically translated into corresponding calls to `putenv()`"* — so the variable is now set in the process environment, seen by every thread and inherited by every subprocess started afterwards. The fix is one method call — `new_child()` puts a fresh dict in front:

```python
settings = ChainMap(parsed_args, os.environ, DEFAULTS).new_child()
settings["LOG_LEVEL"] = "DEBUG"        # lands in the new, private maps[0]
```

## Deleting what you can see

```python
# Lib/collections/__init__.py, v3.14.7 — ChainMap
def __delitem__(self, key):
    try:
        del self.maps[0][key]
    except KeyError:
        raise KeyError(f'Key not found in the first mapping: {key!r}')

def clear(self):
    'Clear maps[0], leaving maps[1:] intact.'
    self.maps[0].clear()
```

`pop` raises the same message and `popitem` raises `KeyError('No keys found in the first mapping.')`. So:

```python
settings = ChainMap({}, {"timeout": "30"})
"timeout" in settings                  # True
del settings["timeout"]                # KeyError: "Key not found in the first mapping: 'timeout'"
settings.clear()
"timeout" in settings                  # still True — clear() only emptied maps[0]
```

There is no way to remove a lower layer's key *through* the chain without changing that layer. When "unset this for this request" is a real requirement, mask it in the front layer:

```python
from collections import ChainMap

_UNSET = object()


class MaskingChainMap(ChainMap):
    """A front-layer value of _UNSET hides the key in every lower layer."""

    def __getitem__(self, key):
        value = super().__getitem__(key)
        if value is _UNSET:
            raise KeyError(key)
        return value

    def __contains__(self, key):
        return any(key in m for m in self.maps) and self.maps[0].get(key, None) is not _UNSET

    def __iter__(self):
        return (k for k in super().__iter__() if self.maps[0].get(k, None) is not _UNSET)

    def __len__(self):
        return sum(1 for _ in self)

    def unset(self, key):
        self.maps[0][key] = _UNSET
```

Because `ChainMap` inherits `get`, `keys`, `items` and friends from `Mapping`, and those are written in terms of `__getitem__`, `__contains__` and `__iter__`, overriding those three (and `__len__`) keeps the whole API consistent.

## When you *do* want deep writes: the documentation's recipe, and its cost

> *"The `ChainMap` class only makes updates (writes and deletions) to the first mapping in the chain
> while lookups will search the full chain. However, if deep writes and deletions are desired, it is
> easy to make a subclass that updates keys found deeper in the chain"*

```python
class DeepChainMap(ChainMap):
    'Variant of ChainMap that allows direct updates to inner scopes'

    def __setitem__(self, key, value):
        for mapping in self.maps:
            if key in mapping:
                mapping[key] = value
                return
        self.maps[0][key] = value

    def __delitem__(self, key):
        for mapping in self.maps:
            if key in mapping:
                del mapping[key]
                return
        raise KeyError(key)
```

That is the right semantics for a scope chain where an assignment should rebind the variable where it lives. For configuration it is dangerous — a write to `timeout` now edits the shared defaults dict for every other user of it. If you use it, wrap the layers that must never change in `MappingProxyType`, so a deep write to them raises `TypeError` instead of succeeding.

## A defaulting layer ends the search

The comment in `__getitem__` — *"can't use 'key in mapping' with defaultdict"* — is the reason it asks each layer for `mapping[key]` and catches `KeyError`. A layer that never raises `KeyError` therefore stops the search:

```python
from collections import ChainMap, Counter, defaultdict

overrides = defaultdict(lambda: None)
defaults = {"timeout": "30"}
settings = ChainMap(overrides, defaults)

"timeout" in settings                  # True — __contains__ uses `in`; found in defaults
settings["timeout"]                    # 🔴 None — overrides["timeout"] ran the factory, INSERTED None, answered
settings.get("timeout")                # 🔴 None too — get() is `self[key] if key in self else default`

"retries" in settings                  # False — no layer has it
settings.get("retries")                # None, from get's default — nothing inserted
settings["retries"]                    # 🔴 None, not KeyError — and "retries" is now a key of overrides
"retries" in settings                  # True from here on
```

A `Counter` layer does the same without inserting: every key reads as `0` from that layer, and nothing below it is ever reached. The rule: **mappings that answer misses (`defaultdict`, `Counter`, any class with `__missing__`) belong at the bottom of a chain, or not in it** — convert them with `dict(layer)` first.

## `new_child(m, **kwargs)` edits `m`

```python
# Lib/collections/__init__.py, v3.14.7
def new_child(self, m=None, **kwargs):      # like Django's Context.push()
    if m is None:
        m = kwargs
    elif kwargs:
        m.update(kwargs)
    return self.__class__(m, *self.maps)
```

The documentation says so too — *"If any keyword arguments are specified, they update passed map or new empty dict"* — and it is still surprising in context:

```python
TENANT_OVERRIDES = {"acme": {"new_checkout": True}}

flags = BASE.new_child(TENANT_OVERRIDES["acme"], debug=True)
TENANT_OVERRIDES["acme"]               # 🔴 {'new_checkout': True, 'debug': True} — for every future request
```

Pass a copy when you pass keywords: `BASE.new_child({**TENANT_OVERRIDES["acme"], "debug": True})`.

## `parents` writes through — or into nothing

`parents` is `self.__class__(*self.maps[1:])`: a new chain over the *same* lower dicts. A write to it lands in what was `maps[1]` — the enclosing scope, which is the `nonlocal` behaviour the documentation compares it to. On a chain with only one map, `maps[1:]` is empty and the constructor substitutes a fresh `{}` (`self.maps = list(maps) or [{}]`), so writes through `parents` go into a dict nobody else can see:

```python
scope = ChainMap({"x": 1})
scope.parents["y"] = 2                 # stored in a brand-new dict, then lost
"y" in scope                           # False
```

## The layers disagree about types

`os.environ` holds strings; a defaults dict usually holds Python values. A chain over both returns whichever layer answered:

```python
settings = ChainMap(os.environ, {"TIMEOUT": 30, "DEBUG": False})
settings["TIMEOUT"] + 5                # works on a dev laptop (int from defaults)…
                                       # …TypeError in production, where TIMEOUT="30" is in the environment
```

Parse each layer into one schema when you build the chain, not when you read it:

```python
def env_layer(names: dict[str, type]) -> dict[str, object]:
    return {name: cast(os.environ[name]) for name, cast in names.items() if name in os.environ}

settings = ChainMap({}, env_layer({"TIMEOUT": int}), {"TIMEOUT": 30})
```

(`bool("false")` is `True`, so booleans need a real parser, not `bool`.)

## Other edges

- **`maps` must never be empty.** *"The list should always contain at least one mapping."* After `chain.maps.clear()`, `__setitem__` fails with an `IndexError` from `self.maps[0]`.
- **Not a dict** — `json.dumps(chain)` raises and `isinstance(chain, dict)` is `False` ([01](01-nine-types-three-families.md)); `dict(chain)`, `{**chain}` and `func(**chain)` all work, because they use the mapping protocol.
- **Equality flattens both sides.** `Mapping.__eq__` in `v3.14.7` is `dict(self.items()) == dict(other.items())` — correct, and a full copy of both on every comparison.
- **`copy()` copies only the front.** *"New ChainMap or subclass with a new copy of maps[0] and refs to maps[1:]"* — writes to the copy are private, changes to lower layers remain shared.
- **Reads are not a snapshot.** Two lookups in one request can straddle a reload of a lower layer. If values must be consistent with each other for the duration of a request, flatten at the start: `config = dict(settings)`.

## Gotchas

**★ Symptom: an environment variable appears in a subprocess although nobody called `os.environ[...] =`.** Cause: a `ChainMap` whose first map is `os.environ` was written to; `maps[0]` receives every write. Fix: never put `os.environ` first; put an owned dict in front.

```python
settings = ChainMap({}, cli_args, os.environ, DEFAULTS)
```

**★ Symptom: `KeyError: "Key not found in the first mapping: 'timeout'"` from `del settings["timeout"]`, though `settings["timeout"]` works.** Cause: deletions only touch `maps[0]`; the key lives lower. Fix: mask it in the front layer (the `MaskingChainMap` above) — or delete from the layer that owns it, deliberately.

```python
settings.unset("timeout")
```

**★ Symptom: a setting defined in the defaults layer reads as `None` (or `0`).** Cause: a `defaultdict` (or `Counter`) sits above it; its `__missing__` answers the lookup, and a defaultdict also inserts. Fix: convert defaulting mappings to plain dicts before chaining them.

```python
settings = ChainMap({}, dict(overrides), defaults)
```

**★ Symptom: a debug flag set for one request is on for every later request of that tenant.** Cause: `new_child(tenant_dict, debug=True)` updates `tenant_dict` in place. Fix: pass a fresh mapping.

```python
flags = BASE.new_child({**tenant_dict, "debug": True})
```

**Symptom: `settings.clear()` "reset" the settings, but every old value is still readable.** Cause: `clear()` empties `maps[0]` only. Fix: rebuild the chain, or clear the specific layer you mean.

```python
settings = ChainMap({}, *settings.maps[1:])
```

**Symptom: `TypeError: unsupported operand type(s) for +: 'str' and 'int'` only in environments that set the variable.** Cause: the environment layer yields strings, the defaults layer ints; the chain returns whichever answers. Fix: parse each layer into one type at build time.

```python
settings = ChainMap({}, env_layer({"TIMEOUT": int}), {"TIMEOUT": 30})
```

**Symptom: a value written through `scope.parents[...]` is gone.** Cause: on a one-map chain, `parents` is a chain over a new empty dict. Fix: check `len(scope.maps) > 1`, or write to the layer you mean explicitly.

```python
target = scope.maps[1] if len(scope.maps) > 1 else scope.maps[0]
target["y"] = 2
```

**Symptom: a `DeepChainMap` write changed the defaults for everyone.** Cause: deep writes update the first layer that contains the key — possibly a shared, module-level dict. Fix: make shared layers read-only so a deep write fails loudly.

```python
settings = DeepChainMap({}, MappingProxyType(DEFAULTS))
```

## Interview questions

**★ Why does `del chain[key]` raise `KeyError` for a key the chain returns?**
Because deletions, like all writes, operate only on `maps[0]`. `ChainMap.__delitem__` in CPython 3.14 is `del self.maps[0][key]`, re-raised as `KeyError('Key not found in the first mapping: …')`. The key you can read lives in a lower layer, which the chain will not modify. Options: delete from that layer explicitly, use the documentation's `DeepChainMap` recipe (deletes from the first layer that has the key), or mask the key with a sentinel in the front layer if the lower layer must stay intact.

**★ What goes wrong if one layer of a `ChainMap` is a `defaultdict`?**
`__getitem__` asks each layer for `mapping[key]` and moves on only when it raises `KeyError` — deliberately, per the source comment *"can't use 'key in mapping' with defaultdict"*. A defaultdict never raises; it calls its factory, inserts the default and returns it, so every key it lacks is answered with the default and the layers below it are never consulted — and each such read mutates the defaultdict. `in` uses each layer's `in`, which a defaultdict answers honestly, so for a key no layer has, `key in chain` is `False` while `chain[key]` returns the default instead of raising. Keep defaulting mappings out of chains, or at the bottom.

**★ How do you make a `ChainMap` of settings that can never write into the caller's data or the environment?**
Put an owned empty dict first — `ChainMap({}, cli, os.environ, file_cfg, DEFAULTS)` or `existing.new_child()` — so every write goes there. Wrap layers that must not change in `types.MappingProxyType`, so that even a deep-write subclass or direct `maps[i]` access raises. Never place `os.environ` at `maps[0]`: writes to it set the real process environment.

**What does `new_child(m, **kwargs)` do to `m`?**
It updates it. The implementation is `if m is None: m = kwargs` / `elif kwargs: m.update(kwargs)`, and the documentation says keyword arguments *"update passed map or new empty dict."* Passing a shared dict plus keywords therefore changes the shared dict for everyone. Build a new mapping yourself — `new_child({**m, **kwargs})` — when `m` is not yours.

**Why can two reads from the same `ChainMap` in one request be inconsistent?**
Because the chain is a live view with no snapshot: each lookup walks the current layers at that moment. If another thread replaces a layer (a config reload assigning `maps[i]`) or updates one between the two reads, the first read can come from the old state and the second from the new. When values must agree with each other for a unit of work, flatten once at the start with `dict(chain)` and read from that.

**Why is `chain.parents[...] = value` sometimes lost?**
`parents` builds a new chain from `maps[1:]`. With two or more maps that is a view over the real enclosing dicts, and the write lands in the next layer down. With one map, `maps[1:]` is empty and the constructor substitutes a fresh `{}`, so the write goes into a temporary dict that is discarded — no error, no effect.

---

← Prev: [06 · `ChainMap` — layered lookup](06-chainmap-layered-lookup.md) · [Topic index](README.md) · Next → [07 · `OrderedDict` — what it still does](07-ordereddict-what-it-still-does.md)
