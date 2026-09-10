---
title: "d[k], d.get(k) and key in d answer three different questions, and the one that quietly loses information is the one everybody reaches for"
sidebar_label: "09 · Reading a key"
sidebar_position: 9
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-10 against the Python 3.14 documentation — [Mapping Types — dict](https://docs.python.org/3.14/library/stdtypes.html#mapping-types-dict), [Membership test operations](https://docs.python.org/3.14/reference/expressions.html#membership-test-operations), [`collections.defaultdict`](https://docs.python.org/3.14/library/collections.html#collections.defaultdict), [`collections.Counter`](https://docs.python.org/3.14/library/collections.html#collections.Counter). Target: **CPython 3.14** (3.14.7). Documentation-validated; **no sandbox run**.

**`d[k]` says "this key must be here." `d.get(k)` says "it might not be, and I do not care to distinguish absent from `None`." `k in d` says "I only want to know whether it exists." Choosing the wrong one is not a style problem — `get` in particular collapses two distinct states into one, and the bug that produces is a silent wrong answer rather than an exception. This chunk is the four read paths, what each documents, and where each one lies to you.**

## The four spellings

| Spelling | Missing key | Returns |
|---|---|---|
| `d[k]` | raises `KeyError` | the value |
| `d.get(k)` | returns `None` | the value, or `None` |
| `d.get(k, default)` | returns `default` | the value, or `default` |
| `k in d` | — | `True` / `False` |

The documented text for each:

> *"`d[key]` — Return the item of *d* with key *key*. Raises a `KeyError` if *key* is not in the map."*

> *"`get(key, default=None, /)` — Return the value for *key* if *key* is in the dictionary, else *default*. If *default* is not given, it defaults to `None`, so that this method never raises a `KeyError`."*

> *"`key in d` — Return `True` if *d* has a key *key*, else `False`."*

Note the signature: `get(key, default=None, /)` — both parameters are **positional-only** (that is what the `/` means), so `d.get(key=k)` is a `TypeError`, and a dict that happens to have a key called `"default"` is not a problem.

## `d[k]` is the right default

The reflex to reach for `get` everywhere is a mistake. `d[k]` says something true and useful: *this key is part of the contract*. When it is missing, that is a bug, and a `KeyError` names the exact key at the exact line. `get` converts that into a `None` that travels for a while before failing somewhere less informative.

```python
# the key is part of the schema — a missing 'user_id' is a bug, not a case
user_id = payload["user_id"]

# the key is genuinely optional — absence is a normal, expected state
nickname = payload.get("nickname")
```

The general argument — why Python code asks forgiveness rather than permission, and when it should not — is **not** re-argued here. It belongs to [Phase 1 · 12 · EAFP vs LBYL](../../phase-1-language-core/12-eafp-vs-lbyl/README.md), which owns it in full. What is specific to `dict` is below.

## The `None` ambiguity, and the sentinel that fixes it

🔴 **`d.get(k)` returning `None` means either "no such key" or "the key is there and its value is `None`."** Those are different facts and `get` erases the difference.

```python
settings = {"timeout": None}          # explicitly configured as "no timeout"

settings.get("timeout")               # None
settings.get("retries")               # None — indistinguishable
```

That matters whenever `None` is a legal value, which for configuration, database rows and JSON payloads is most of the time. There are three correct answers depending on what you need:

**Ask the membership question directly.** Cheapest and clearest when the two states lead to different code:

```python
if "timeout" in settings:
    apply_timeout(settings["timeout"])       # may legitimately be None
else:
    apply_timeout(DEFAULT_TIMEOUT)
```

**Use a private sentinel.** The right shape when a function must pass "absent" onward:

```python
_MISSING = object()

def read(settings: dict[str, object], key: str) -> object:
    value = settings.get(key, _MISSING)
    if value is _MISSING:
        raise ConfigError(f"{key} is not configured")
    return value                                  # may be None, legitimately
```

`object()` is the standard sentinel because it is unique, hashable, falsy-free and cannot be produced accidentally by user data. **Do not** use `None`, `False`, `-1`, `""` or `NotImplemented` — every one of them is a value some payload will legitimately contain.

**Let `d[k]` raise and catch it.** The EAFP form, one lookup, no sentinel:

```python
try:
    timeout = settings["timeout"]
except KeyError:
    timeout = DEFAULT_TIMEOUT
```

## `get` evaluates its default eagerly

This is not a `dict` rule, it is Python's call semantics — arguments are evaluated before the call — but it produces a `dict`-shaped bug often enough to state plainly:

```python
# fetch_default() runs on EVERY call, hit or miss
value = cache.get(key, fetch_default())
```

`get` is a method call, so `fetch_default()` has already run by the time `get` decides it did not need the default. If the default is expensive, has side effects, or raises, that is wrong. The fix is to branch:

```python
if key in cache:
    value = cache[key]
else:
    value = fetch_default()
```

or, when the default is cheap to *describe* but expensive to *build*, to use the two-lookup form only on the miss path:

```python
value = cache.get(key, _MISSING)
if value is _MISSING:
    value = fetch_default()
```

⚠️ The same trap catches `d.get(k, [])` and `d.get(k, {})` — those allocate a fresh empty container on every call whether or not it is used. Harmless for correctness, wasteful in a loop, and a genuine bug if you then mutate the returned container expecting it to be stored (it is not — see [11 · `setdefault`](04c-setdefault.md)).

## `in` tests keys, and `in d` beats `in d.keys()`

Membership on a dict tests **keys**, never values:

> *"All built-in sequences and set types support this as well as dictionary, for which `in` tests whether the dictionary has a given key."*

```python
"timeout" in settings          # key test — O(1)
None in settings.values()      # value test — O(n), a linear scan
```

`k in d.keys()` is correct and redundant: `d.keys()` builds a view object only to ask it the question `d` would have answered directly. Prefer `k in d`.

The same expression documentation defines what `in` actually does, which matters for the NaN case covered in [08 · Equal keys that collide](03d-equal-keys-that-collide.md):

> *"For container types such as list, tuple, set, frozenset, dict, or collections.deque, the expression `x in y` is equivalent to `any(x is e or x == e for e in y)`."*

For a dict that equivalence describes the *semantics*, not the algorithm — the dict does not scan; it hashes. But the identity-then-equality ordering is exactly what a hash-table probe does when it compares a candidate key.

## `__missing__` — the hook `d[k]` calls and `get` does not

> *"If a subclass of dict defines a method `__missing__` and *key* is not present, the `d[key]` operation calls that method with the key *key* as argument. The `d[key]` operation then returns or raises whatever is returned or raised by the `__missing__(key)` call."*

🔴 > *"No other operations or methods invoke `__missing__`. If `__missing__` is not defined, `KeyError` is raised. `__missing__` must be a method; it cannot be an instance variable."*

That second paragraph is the whole reason `defaultdict.get()` does not create entries — `get` is one of the "no other operations". The documentation's own example is a counter:

```python
class Counter(dict):
    def __missing__(self, key):
        return 0
```

and it tells you where you have already met it: *"The example above shows part of the implementation of `collections.Counter`. A different `__missing__` method is used by `collections.defaultdict`."*

The consequences, which trip people up in both directions:

```python
from collections import defaultdict

buckets = defaultdict(list)

buckets["a"]            # creates and returns [] — __missing__ fired
buckets.get("b")        # None; NOTHING created — get never calls __missing__
"c" in buckets          # False; nothing created
len(buckets)            # 1 — only "a" exists
```

`defaultdict` is topic [06 · `collections`](../06-collections-module/README.md), and it is the right answer to most "insert-if-missing" code. This page does not teach it; it names it, and it tells you the one interaction that surprises people: `get` and `in` bypass the factory entirely.

## Gotchas

**★ Symptom: a value is `None` downstream and no exception was ever raised.** Cause: `d.get(k)` returned `None` for a missing key and the caller could not tell it apart from a stored `None`. Fix: use a private sentinel so absence is representable.

```python
_MISSING = object()

value = config.get("region", _MISSING)
if value is _MISSING:
    raise ConfigError("region is not configured")
```

**★ Symptom: an expensive function runs on every cache hit.** Cause: `d.get(k, expensive())` evaluates the default before `get` is called — ordinary argument evaluation, not a dict rule. Fix: branch, so the default is only built on a miss.

```python
if key in cache:
    value = cache[key]
else:
    value = expensive()
```

**★ Symptom: `defaultdict.get(k)` returns `None` instead of the factory's value.** Cause: *"No other operations or methods invoke `__missing__`."* Only `d[key]` does. Fix: index it — that is the whole point of a `defaultdict`.

```python
buckets = defaultdict(list)
buckets[key].append(item)        # not buckets.get(key).append(item)
```

**Symptom: `d.get(key=some_key)` raises `TypeError`.** Cause: the signature is `get(key, default=None, /)` — the trailing `/` makes both parameters positional-only. Fix: pass positionally.

```python
value = d.get(some_key, fallback)
```

**Symptom: a membership test over a large dict is slow.** Cause: it tested values, not keys — `x in d.values()` is a linear scan, documented at *O*(n) for iteration. Fix: if you need value membership repeatedly, build the inverse index once.

```python
by_value = {value: key for key, value in d.items()}
if target in by_value:
    handle(by_value[target])
```

**Symptom: a lint rule flags `if k in d.keys()`.** Cause: `d.keys()` constructs a view to answer a question `d` answers directly, and `iter(d)` is documented as *"a shortcut for `iter(d.keys())`"*. Fix: drop `.keys()`.

```python
if key in mapping:
    handle(mapping[key])
```

**Symptom: `d.get(k, [])` is mutated and the change does not stick.** Cause: `get` returns the default; it never stores it. Fix: `setdefault`, or a `defaultdict` — see [11 · `setdefault`](04c-setdefault.md).

```python
groups.setdefault(key, []).append(item)
```

**Symptom: code checks `if d.get(k):` and skips legitimate entries.** Cause: it is testing truthiness, not presence — `0`, `""`, `[]`, `0.0` and `False` are all falsy values a dict can legitimately hold. Fix: test membership, or compare against the sentinel.

```python
if key in counters:            # not `if counters.get(key):`
    increment(counters[key])
```

## Interview questions

**★ When do you use `d[k]` and when `d.get(k)`?**
`d[k]` when the key is part of the contract — a missing key is a defect and you want a `KeyError` naming it at the line it happened. `d.get(k)` when absence is a normal, expected state that the surrounding code handles. The failure mode of over-using `get` is that a missing key becomes a `None` which travels through several frames before failing somewhere that cannot tell you what was actually missing. The failure mode of over-using `d[k]` is an exception where a default would have been fine — which is much cheaper to diagnose.

**★ What is wrong with `d.get(k)` when `None` is a valid value?**
It cannot distinguish "the key is absent" from "the key is present and its value is `None`", because both return `None`. That is a real ambiguity in configuration, JSON and database rows, where null is meaningful. Three fixes: test `k in d` first; pass a private sentinel `_MISSING = object()` as the default and compare with `is`; or index and catch `KeyError`. Never use `None`, `-1`, `""` or `False` as the sentinel — each is a value some payload legitimately contains.

**★ Does `d.get(k, expensive())` avoid calling `expensive()` when the key is present?**
No. `get` is an ordinary method call, so its arguments are evaluated first — `expensive()` has already run by the time `get` looks anything up. There is no lazy-default form of `get`; the equivalents are an explicit branch on `k in d`, a sentinel default followed by an `is` check, or `defaultdict`, whose factory *is* called lazily but only through `d[k]`.

**★ Why does `defaultdict(list).get("x")` return `None` instead of `[]`?**
Because `get` does not call `__missing__`. The `dict` documentation is explicit: *"No other operations or methods invoke `__missing__`."* Only `d[key]` does. That is deliberate — `get`, `in`, `pop` and `setdefault` all need to be able to report absence, and a factory that fired on every one of them would make a `defaultdict` impossible to query without mutating it. If you want the factory, index.

**Why is `k in d` better than `k in d.keys()`?**
Both are correct, and `in d` is the direct form: the dict answers membership itself, while `.keys()` constructs a view object first. The same asymmetry runs through the whole API — `iter(d)` is documented as *"a shortcut for `iter(d.keys())`"*, and `for k in d` is idiomatic where `for k in d.keys()` is noise. The one place `.keys()` earns its keep is when you want a *set-like* object to combine with another, which is [16 · Set operations on views](05d-set-operations-on-views.md).

**What does `__missing__` do, and which operations trigger it?**
It is a hook a `dict` *subclass* may define; when `d[key]` finds no entry, it calls `self.__missing__(key)` and returns or raises whatever that produces. Exactly one operation triggers it — subscription — and the documentation says so: *"No other operations or methods invoke `__missing__`."* It also has to be a real method on the class: *"`__missing__` must be a method; it cannot be an instance variable."* `collections.Counter` and `collections.defaultdict` are both built on it, with different implementations.


---

← [08 · Equal keys that collide](03d-equal-keys-that-collide.md) · [Topic index](README.md) · Next → [10 · Nested access](04b-nested-access.md)
