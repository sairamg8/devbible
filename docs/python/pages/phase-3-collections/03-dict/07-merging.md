---
title: "d | e, d |= e, d.update(e) and {**d, **e} all agree that the right-hand value wins — they disagree about what they return, what they accept, and whether a dict somebody else is holding changes underneath them"
sidebar_label: "19 · Merging"
sidebar_position: 19
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-10 against [PEP 584 — Add Union Operators To dict](https://peps.python.org/pep-0584/) and the Python 3.14 documentation — [Mapping Types — dict](https://docs.python.org/3.14/library/stdtypes.html#mapping-types-dict), [Dictionary displays](https://docs.python.org/3.14/reference/expressions.html#dictionary-displays), [`collections.ChainMap`](https://docs.python.org/3.14/library/collections.html#chainmap-objects), [Time complexity](https://docs.python.org/3.14/library/time-complexity.html). `dict_or` / `dict_ior` read from `Objects/dictobject.c` at the [CPython **v3.14.7**](https://github.com/python/cpython/blob/v3.14.7/Objects/dictobject.c) tag. Target: **CPython 3.14** (3.14.7). Documentation-validated; **no sandbox run**.

**Python has five ways to combine two mappings and one rule they share: when a key is in both, the right-hand side's value wins, and the key keeps the position it had on the left. Everything else differs. `|` builds a new dict and insists both sides are dicts; `|=` mutates in place and accepts any iterable of pairs; `update` mutates and returns `None`; `{**a, **b}` always produces a plain `dict`; `ChainMap` does not merge at all and resolves conflicts the other way round. The production bugs are almost never about which value won — they are about a shared defaults dictionary that one request quietly rewrote for every request after it.**

## The one rule they share

PEP 584 states it and lists every operation it covers:

🔴 > *"Key conflicts will be resolved by keeping the rightmost value. This matches the existing behavior of similar dict operations, where the last seen value always wins"*

— `{'a': 1, 'a': 2}`, `{**d, **e}`, `d.update(e)`, `d[k] = v`, `{k: v for x in (d, e) for (k, v) in x.items()}` — *"All of the above follow the same rule."* And the order:

> *"Similarly, the iteration order of the key-value pairs in the dictionary will follow the same semantics as the examples above, with each newly added key (and its value) being appended to the current sequence."*

```python
defaults = {"timeout": 30, "retries": 3, "region": "eu"}
overrides = {"retries": 5, "debug": True}

merged = defaults | overrides
# {'timeout': 30, 'retries': 5, 'region': 'eu', 'debug': True}
#  'retries' keeps its first position and takes the right-hand value; 'debug' is appended
```

The PEP draws the consequence explicitly: *"This means that dict union is not commutative; in general `d | e != e | d`."* `overrides | defaults` would put the defaults back on top.

## The five spellings, side by side

| Spelling | New object or in place | Returns | Right operand may be | Result type |
|---|---|---|---|---|
| `a \| b` | new | the new dict | a `dict` (or subclass) only | `dict` for plain dicts — see [20 · What a merge returns](07b-what-a-merge-returns.md) |
| `a \|= b` | in place | `a` | any mapping, or any iterable of pairs | unchanged |
| `a.update(b)` | in place | **`None`** | any mapping, iterable of pairs, and/or keyword args | unchanged |
| `{**a, **b}` | new | the new dict | any mapping | always `dict` |
| `ChainMap(b, a)` | neither — a view over both | the chain | any mappings | `ChainMap` |

**`|` wants dicts; `|=` does not.** The documentation for the two operators is worded differently on purpose:

> `d | other`: *"Create a new dictionary with the merged keys and values of d and other, which must both be dictionaries."*
> `d |= other`: *"Update the dictionary d with keys and values from other, which may be either a mapping or an iterable of key/value pairs."*

PEP 584 explains the asymmetry by analogy — *"This is analogous to `list +=` and `list.extend`, which accept any iterable, not just lists"* — and gives the example: `d | [('spam', 999)]` raises `TypeError: can only merge dict (not "list") to dict`, while `d |= [('spam', 999)]` succeeds. In `v3.14.7` that is visible in the source: `dict_or` returns `NotImplemented` unless `PyDict_Check` passes on both operands, while `dict_ior` is just `dict_update_arg(self, other)` — the same routine `update()` uses — followed by `return Py_NewRef(self)`.

**`update` returns `None`.** *"Update the dictionary with the key/value pairs from mapping or iterable and kwargs, overwriting existing keys. Return `None`."* It is a mutator in the `list.sort` tradition.

## Why `|` was added at all

PEP 584's motivation is a list of what was wrong with each existing spelling:

> *"`d1.update(d2)` modifies d1 in-place. `e = d1.copy(); e.update(d2)` is not an expression and needs a temporary variable."*

> *"`{**d1, **d2}` ignores the types of the mappings and always returns a dict. `type(d1)({**d1, **d2})` fails for dict subclasses such as defaultdict that have an incompatible `__init__` method."*

> *"`dict(d1, **d2)` — This "neat trick" is not well-known, and only works when d2 is entirely string-keyed"*

and, on `ChainMap`:

> *"ChainMap is unfortunately poorly-known and doesn't qualify as "obvious". It also resolves duplicate keys in the opposite order to that expected ("first seen wins" instead of "last seen wins")."* … *"Further, ChainMaps wrap their underlying dicts, so writes to the ChainMap will modify the original dict."*

So the modern defaults are: **`a | b` when you want a new dict, `a |= b` or `a.update(b)` when you mean to mutate `a`**, and `{**a, **b}` when you are merging arbitrary mappings into a plain dict or mixing in literal keys.

## The shared-defaults bug

A module-level defaults dictionary is shared by every caller in the process. Any in-place merge into it is a write every later request inherits:

```python
DEFAULT_OPTIONS = {"timeout": 30, "verify_tls": True, "retries": 3}

def fetch(url: str, **options: object) -> Response:
    # 🔴 mutates the module-level dict; one caller's verify_tls=False sticks for everyone
    settings = DEFAULT_OPTIONS
    settings.update(options)
    return _send(url, settings)
```

The fix is to make the merge produce a new dict, and optionally to make the defaults unwritable so the mistake cannot recur:

```python
from types import MappingProxyType

DEFAULT_OPTIONS = MappingProxyType({"timeout": 30, "verify_tls": True, "retries": 3})

def fetch(url: str, **options: object) -> Response:
    settings = {**DEFAULT_OPTIONS, **options}       # new plain dict; the proxy is never written
    return _send(url, settings)
```

`MappingProxyType` supports `|` too — its documentation says the operator *"simply delegates to the underlying mapping"* — but `|=` on it is refused, which is exactly what you want from a defaults object. [20 · What a merge returns](07b-what-a-merge-returns.md) has the details.

The same bug appears with `|=` on a function *argument*: the caller's dictionary is mutated.

```python
def with_tracing(headers: dict[str, str]) -> dict[str, str]:
    return headers | {"traceparent": new_trace_id()}   # new dict; caller's headers untouched
```

## Merging many dicts

`a | b | c | d` creates a new dict at every `|`. PEP 584 names the cost and the alternative:

> *"Repeated dict union is inefficient: `d | e | f | g | h` creates and destroys three temporary mappings."* … *"If one expects to be merging a large number of dicts where performance is an issue, it may be better to use an explicit loop and in-place merging"*

```python
merged: dict[str, object] = {}
for layer in config_layers:          # lowest priority first
    merged |= layer
```

The loop form matters more than it looks. `result = result | layer` inside a loop copies the *growing* result on every iteration — total work proportional to the square of the number of layers times their size. `result |= layer` touches only the new layer each time, which is the documented *O*(len(*t*)) for `d |= t`.

## One level deep, always

Every spelling on this page is shallow: a nested dict on the right **replaces** the nested dict on the left, it is not merged into it; and a nested object that survives into the result is **the same object** as in the input.

```python
base = {"db": {"host": "db1", "port": 5432}, "debug": False}
override = {"db": {"host": "db2"}}

merged = base | override
merged["db"]                       # {'host': 'db2'} — port is gone: the subtree was replaced

merged = base | {"debug": True}
merged["db"]["port"] = 6543        # 🔴 also changes base["db"] — the nested dict is shared
```

There is no built-in deep merge; [10 · Nested access](04b-nested-access.md) has a recursive `deep_merge`, and `copy.deepcopy` — **08 · `copy` vs `deepcopy`** *(not written yet)* — is how you break the sharing.

## Conflicts that should not be silent

PEP 584 considered and rejected alternative conflict rules — raising, adding the values, first-seen-wins, collecting into a list — and left every one of them *"to subclasses of dict"*. When two sources are supposed to be disjoint, write the check:

```python
def merge_disjoint(*mappings: dict[str, object]) -> dict[str, object]:
    merged: dict[str, object] = {}
    for mapping in mappings:
        clash = merged.keys() & mapping.keys()
        if clash:
            raise ValueError(f"conflicting keys: {sorted(clash)}")
        merged |= mapping
    return merged
```

## `ChainMap`: a lookup order, not a merge

`ChainMap` does not copy anything. It searches its maps in order — *"Lookups search the underlying mappings successively until a key is found. In contrast, writes, updates, and deletions only operate on the first mapping."* — so the **first** map wins, the opposite of `|`:

```python
from collections import ChainMap

settings = ChainMap(cli_args, env_vars, file_config, DEFAULTS)   # highest priority first
settings["timeout"]              # first map that has it
settings["timeout"] = 5          # written into cli_args — the first map
```

It is the right tool when the layers change after the lookup object is built — *"if one of the underlying mappings gets updated, those changes will be reflected in `ChainMap`"* — and the wrong one when you wanted a snapshot. `ChainMap` belongs to **06 · `collections`** *(not written yet)*; the merge-specific fact is its reversed priority.

## Gotchas

**★ Symptom: `settings = settings.update(overrides)` leaves `settings` as `None`.** Cause: `update` is documented as *"Return `None`."* Fix: call it as a statement, or use the operator that returns the dict.

```python
settings.update(overrides)       # mutate
settings = settings | overrides  # or build a new one
```

**★ Symptom: one request's option becomes every later request's default.** Cause: an in-place merge — `update`, `|=` — into a module-level defaults dict. Fix: merge into a new dict, and make the defaults read-only.

```python
DEFAULTS = MappingProxyType({"timeout": 30, "verify_tls": True})
settings = {**DEFAULTS, **options}
```

**★ Symptom: `TypeError: can only merge dict (not "list") to dict`.** Cause: `|` requires dicts on both sides — *"which must both be dictionaries."* Fix: use `|=` on a copy, which accepts pairs, or build a dict first.

```python
merged = dict(base)
merged |= [("spam", 999)]
```

**★ Symptom: user overrides are ignored and defaults always win.** Cause: the operands are the wrong way round; union is *"not commutative"* and the right-hand side wins. Fix: lowest priority on the left.

```python
effective = DEFAULTS | user_settings
```

**★ Symptom: merging a config override deleted sibling keys in a nested section.** Cause: merges are one level deep — the right-hand nested dict replaces the left-hand one wholesale. Fix: a recursive merge.

```python
def deep_merge(base: dict, override: dict) -> dict:
    merged = dict(base)
    for key, value in override.items():
        if isinstance(value, dict) and isinstance(merged.get(key), dict):
            merged[key] = deep_merge(merged[key], value)
        else:
            merged[key] = value
    return merged
```

**★ Symptom: after `merged = base | extra`, changing `merged["db"]["port"]` also changes `base`.** Cause: the nested dict is the same object in both — every merge is shallow. Fix: deep-copy the part you intend to mutate.

```python
import copy
merged = copy.deepcopy(base) | extra
```

**★ Symptom: building a config from many layers gets slower than linearly as layers are added.** Cause: `result = result | layer` in a loop copies the whole accumulated result each time. Fix: the PEP's in-place loop.

```python
result: dict[str, object] = {}
for layer in layers:
    result |= layer
```

**Symptom: a function that adds a header to its argument changes the caller's headers.** Cause: `headers |= {...}` or `headers.update(...)` mutates the object the caller passed. Fix: return a new dict.

```python
def with_auth(headers: dict[str, str], token: str) -> dict[str, str]:
    return headers | {"Authorization": f"Bearer {token}"}
```

**Symptom: `dict(base, **overrides)` raises `TypeError: keywords must be strings`.** Cause: the keyword-argument trick needs identifier-like string keys — PEP 584: it *"only works when d2 is entirely string-keyed"*. Fix: a real merge, which takes any hashable keys.

```python
merged = base | overrides          # or {**base, **overrides} for non-dict mappings
```

**Symptom: two sources that should never overlap silently overwrite each other.** Cause: every built-in merge is last-wins; the PEP left stricter rules to subclasses. Fix: check the key intersection first.

```python
clash = a.keys() & b.keys()
if clash:
    raise ValueError(f"conflicting keys: {sorted(clash)}")
merged = a | b
```

**Symptom: a value set through a `ChainMap` appears in the user's CLI-args dict.** Cause: *"writes, updates, and deletions only operate on the first mapping"* — and the first mapping is a real dict you passed in. Fix: put a fresh dict first, via `new_child()`.

```python
scope = ChainMap(cli_args, env_vars, DEFAULTS).new_child()   # writes land in the new empty map
scope["timeout"] = 5
```

**Symptom: priorities are reversed after replacing a `ChainMap` with `|`.** Cause: `ChainMap` is first-seen-wins, `|` is last-seen-wins. Fix: reverse the order when translating.

```python
# ChainMap(high, mid, low)  ==  low | mid | high  (as a snapshot)
snapshot = low | mid | high
```

## Interview questions

**★ When two dicts share a key, which value survives a merge, and where does the key end up?**
The right-hand one, for every built-in spelling — `|`, `|=`, `update`, `{**a, **b}`, `dict(a, **b)`. PEP 584: *"Key conflicts will be resolved by keeping the rightmost value … the last seen value always wins."* The key keeps the position it already had on the left, because replacing a value does not move a key; only keys new to the left side are appended, in the right-hand side's order. The one exception in the standard library is `ChainMap`, which searches its maps first-to-last and so is first-seen-wins.

**★ What is the difference between `|` and `|=` besides one creating a new object?**
What they accept. `d | other` requires both operands to be dicts — anything else returns `NotImplemented` and ends in `TypeError`. `d |= other` behaves like `d.update(other)`: it accepts any mapping, or any iterable of key/value pairs. PEP 584 justifies it with the list analogy — `list +=` accepts any iterable where `list +` accepts only lists. The practical rule: if the right side might be a list of tuples or a non-dict mapping, use `|=` on a copy, or convert first.

**★ Why is `update()` returning `None` a bug magnet?**
Because the natural-looking `config = config.update(overrides)` replaces your dict with `None`, and the failure appears later as `'NoneType' object is not subscriptable` somewhere else. It is the same convention as `list.sort()` and `list.append()` — mutators return `None` so that you cannot mistake them for producers. `|` exists partly because the PEP found that `e = d1.copy(); e.update(d2)` *"is not an expression and needs a temporary variable."*

**How do you merge twenty dicts efficiently?**
Start from an empty dict and `|=` each one in, lowest priority first. PEP 584 names the problem with `d | e | f | …` — *"creates and destroys three temporary mappings"* for five operands — and recommends the explicit in-place loop. Each `|=` costs *O*(len) of the dict being merged in, so the whole thing is linear in the total number of entries. Rebinding with `result = result | d` in a loop is the version that goes quadratic, because it copies the accumulating result every time.

**When would you choose `ChainMap` over `|`?**
When the layers are live and you want lookups to reflect later changes to any of them — CLI arguments over environment over file over defaults, where the environment might change — or when you need a cheap scope stack with `new_child()`. `|` produces a snapshot. The two things to remember about `ChainMap` are that it is first-seen-wins, the opposite of `|`, and that writes go into the first underlying mapping, which is someone's real dict unless you put a fresh one there.

**Why did PEP 584 not also add `&` and `-` to dicts?**
Because the value semantics are unclear. The PEP: *"While it is easy to determine the intersection of keys in two dicts, it is not clear what to do with the values."* It deliberately left the rest of the set API *"for a later PEP"*. The key-level versions already exist on views — `a.keys() & b.keys()`, `a.keys() - b.keys()` — which answer the question without having to invent a value rule.

**Is there a deep merge in the standard library?**
No. Every built-in merge is one level deep: a nested dict on the right replaces the one on the left, and a nested object carried into the result is shared with the input. A deep merge is a policy decision — what to do when one side has a dict and the other a list, whether lists concatenate — and the standard library leaves it to you. Write the recursion explicitly, and copy anything you intend to mutate afterwards.

---

← [18 · Dict comprehensions](06b-dict-comprehensions.md) · [Topic index](README.md) · Next → [20 · What a merge returns](07b-what-a-merge-returns.md)
