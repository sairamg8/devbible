---
title: "dict.fromkeys gives every key the same object, not a copy of it — the documentation says so in one sentence, and ignoring that sentence produces a dict where appending to one key appends to all of them"
sidebar_label: "12 · fromkeys"
sidebar_position: 12
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-10 against the Python 3.14 documentation — [Mapping Types — dict](https://docs.python.org/3.14/library/stdtypes.html#mapping-types-dict), [Dictionary displays](https://docs.python.org/3.14/reference/expressions.html#dictionary-displays), [Thread Safety Guarantees — dict](https://docs.python.org/3.14/library/threadsafety.html#thread-safety-for-dict-objects). Construction behaviour for subclasses read from `_PyDict_FromKeys` in `Objects/dictobject.c` at the [CPython **v3.14.7**](https://github.com/python/cpython/blob/v3.14.7/Objects/dictobject.c) tag. Target: **CPython 3.14** (3.14.7). Documentation-validated; **no sandbox run**.

**`dict.fromkeys` has one famous bug and one genuinely excellent use, and most codebases have them the wrong way round. The bug is `dict.fromkeys(keys, [])`, where every key shares a single list — the documentation warns about it explicitly and people write it anyway. The excellent use is `list(dict.fromkeys(seq))`, which is the shortest correct way to deduplicate a sequence while preserving order, and it only became correct in 3.7 when insertion order became a guarantee.**

## What it does

> *"`fromkeys(iterable, value=None, /)` — Create a new dictionary with keys from *iterable* and values set to *value*."*

🔴 > *"`fromkeys` is a class method that returns a new dictionary. *value* defaults to `None`. **All of the values refer to just a single instance, so it generally doesn't make sense for *value* to be a mutable object such as an empty list. To get distinct values, use a dict comprehension instead.**"*

That second paragraph is the whole page. Read it as three separate facts:

1. It is a **classmethod** — `dict.fromkeys(...)`, not `d.fromkeys(...)`, though both work.
2. `value` defaults to `None`, so `dict.fromkeys(keys)` is "these keys, all null".
3. **One object, shared by every key.** Not one copy per key. Not a factory.

## The shared-mutable trap

```python
inventory = dict.fromkeys(["north", "south", "east"], [])

inventory["north"].append("widget")
# every key now sees ["widget"] — they are one list
```

There is no copying anywhere in `fromkeys`. It evaluates `[]` once, before the call, and stores that one reference three times. It is the same mechanism as Python's mutable-default-argument trap, applied to a dict constructor, and it is invisible in review because the code looks like it is initialising three empty buckets.

The documentation names the fix, and it is a dict comprehension:

```python
inventory = {region: [] for region in ["north", "south", "east"]}
```

A comprehension re-evaluates the value expression per iteration — the language reference says the elements are *"inserted in the new dictionary in the order they are produced"*, one production per key — so each key gets its own list.

⚠️ The trap is **only** about mutable values. `dict.fromkeys(keys, 0)` and `dict.fromkeys(keys, "")` and `dict.fromkeys(keys)` are all completely fine, because sharing an immutable object is unobservable. That is why the documentation says *"it generally doesn't make sense for value to be a mutable object"* rather than banning the second argument.

| Call | Safe? | Why |
|---|---|---|
| `dict.fromkeys(ks)` | ✅ | every value is `None`, shared and immutable |
| `dict.fromkeys(ks, 0)` | ✅ | `int` is immutable |
| `dict.fromkeys(ks, "")` | ✅ | `str` is immutable |
| `dict.fromkeys(ks, ())` | ✅ | empty tuple is immutable |
| `dict.fromkeys(ks, [])` | 🔴 | one list, shared by every key |
| `dict.fromkeys(ks, {})` | 🔴 | one dict, shared |
| `dict.fromkeys(ks, set())` | 🔴 | one set, shared |
| `dict.fromkeys(ks, Counter())` | 🔴 | one counter, shared |

## The good use: order-preserving deduplication

```python
seen_in_order = list(dict.fromkeys(raw_ids))
```

That is the canonical Python answer to "remove duplicates, keep the first occurrence of each". It works because:

- `fromkeys` inserts each key once — a repeat is an update, and *"updating a key does not affect the order"*, so the *first* occurrence keeps its position;
- iteration order is insertion order, guaranteed since 3.7 (see [03 · Order is a guarantee](02-insertion-order-is-a-guarantee.md));
- everything is *O*(n) — one hash per element.

Compare the alternatives:

```python
# loses order: set iteration order is not guaranteed
unique = list(set(raw_ids))

# O(n^2): membership on a list is a scan
unique = []
for item in raw_ids:
    if item not in unique:
        unique.append(item)

# O(n) and ordered, but three lines and a second structure
seen: set[str] = set()
unique = []
for item in raw_ids:
    if item not in seen:
        seen.add(item)
        unique.append(item)
```

The `fromkeys` version is the same complexity as the last one, in one expression, with the ordering guarantee doing the bookkeeping. The elements must be hashable, exactly as for a `set`.

**It also gives you an "ordered set" for free**, which Python does not otherwise have:

```python
ordered_tags = dict.fromkeys(tags)        # keys are the members, values are None
"beta" in ordered_tags                     # O(1) membership
list(ordered_tags)                         # members in first-seen order
```

## The keys come from *iterating* the argument

`fromkeys` iterates its first argument, and the surprises follow from what iteration means for that type:

```python
dict.fromkeys("abc")                 # keys 'a', 'b', 'c' — a str iterates by character
dict.fromkeys(range(3))              # keys 0, 1, 2
dict.fromkeys({"a": 1, "b": 2})      # keys 'a', 'b' — iterating a dict yields keys
dict.fromkeys({"x", "y"})            # keys from a set: order NOT guaranteed
```

🔴 The `str` case is the one that bites. `dict.fromkeys(user_id)` where `user_id` is a string does not create one key — it creates one key **per character**, silently, with no error. Wrap a single value in a list or tuple.

```python
dict.fromkeys([user_id])             # exactly one key
```

The set case matters for reproducibility: a `dict` built from a `set` inherits the set's unspecified iteration order, which is the one place [02 · What O(1) does not promise](01b-what-o1-does-not-promise.md)'s hash-seed discussion leaks into a `dict`.

## As a classmethod on a subclass

`fromkeys` constructs an instance of the class it is called on. In CPython `v3.14.7`, `_PyDict_FromKeys` begins with `_PyObject_CallNoArgs(cls)` — it calls the class **with no arguments**. So:

```python
class Registry(dict):
    pass

Registry.fromkeys(["a", "b"])        # a Registry, as you would hope
```

but a subclass whose `__init__` requires an argument cannot be built this way. That is the same incompatibility PEP 584 raises about `defaultdict`:

> *"`type(d1)({**d1, **d2})` fails for dict subclasses such as defaultdict that have an incompatible `__init__` method."*

`defaultdict.fromkeys(...)` therefore does not give you a `defaultdict` with a factory — the no-argument call produces one with `default_factory` unset. If you need both, build it explicitly:

```python
from collections import defaultdict

buckets = defaultdict(list, dict.fromkeys(known_keys, 0))   # explicit, and the
                                                             # shared-0 is safe
```

## Thread safety, for free-threaded builds

The `dict` thread-safety page singles `fromkeys` out twice:

> *"When using the `dict.fromkeys` method, dictionary creation is atomic when the argument is a `dict`, `tuple`, `set` or `frozenset`."*

> *"`fromkeys` locks both the new dictionary and the iterable when the iterable is exactly a `dict`, `set`, or `frozenset` (not subclasses)."*

and warns about the general case:

> *"When updating from a non-dict iterable, only the target dictionary is locked. The iterable may be concurrently modified by another thread."*

So `dict.fromkeys(some_list)` on a free-threaded build can observe a list another thread is mutating. Full treatment in [25 · `dict` across threads](10-dict-across-threads.md).

## Gotchas

**★ Symptom: appending to one key's list changes every key's list.** Cause: `dict.fromkeys(keys, [])` stores one list object under every key — *"All of the values refer to just a single instance."* Fix: a dict comprehension, which builds a fresh value per key.

```python
inventory = {region: [] for region in regions}
```

**★ Symptom: `dict.fromkeys(user_id)` creates one key per character.** Cause: the first argument is iterated, and a `str` iterates by character. Fix: wrap the single value.

```python
lookup = dict.fromkeys([user_id], 0)
```

**★ Symptom: deduplication loses the original order.** Cause: `list(set(seq))` — set iteration order is not guaranteed and varies with the hash seed. Fix: `dict.fromkeys`, which preserves first-seen order by the 3.7 guarantee.

```python
unique = list(dict.fromkeys(raw_ids))
```

**★ Symptom: a `defaultdict` built with `fromkeys` has no `default_factory`.** Cause: `fromkeys` constructs the class by calling it with no arguments, so the factory argument is never supplied. Fix: build the `defaultdict` explicitly and seed it.

```python
buckets = defaultdict(list)
buckets.update(dict.fromkeys(known_keys, None))    # or seed with a comprehension
```

**Symptom: `dict.fromkeys(counts, Counter())` accumulates every count into one counter.** Cause: same single-instance rule; `Counter()` is mutable. Fix: comprehension.

```python
per_tenant = {tenant: Counter() for tenant in tenants}
```

**Symptom: `SomeDictSubclass.fromkeys(...)` raises `TypeError` about missing arguments.** Cause: `fromkeys` calls the class with no arguments, and the subclass's `__init__` requires some. Fix: construct explicitly and populate.

```python
result = SomeDictSubclass(required_arg)
result.update(dict.fromkeys(keys, default))
```

**Symptom: a dict built with `dict.fromkeys(a_set)` iterates in a different order on each run.** Cause: it inherits the set's iteration order, which Python has never guaranteed. Fix: sort the source.

```python
lookup = dict.fromkeys(sorted(tag_set), 0)
```

**Symptom: `d.fromkeys(...)` on an existing instance returns a new dict rather than modifying `d`.** Cause: it is a classmethod — *"`fromkeys` is a class method that returns a new dictionary."* Calling it on an instance is legal and does nothing to that instance. Fix: assign the result, and prefer the explicit `dict.fromkeys(...)` spelling so nobody misreads it as a mutator.

```python
d = dict.fromkeys(keys, 0)
```

**Symptom: a value that should be per-key is shared, but the values are tuples so "it is fine".** Cause: it *is* fine — an immutable shared value is unobservable — but the next refactor that turns the tuple into a list reintroduces the bug silently. Fix: if a value is conceptually per-key, build it per key from the start.

```python
per_key = {key: () for key in keys}      # same result, immune to the refactor
```

## Interview questions

**★ What is wrong with `dict.fromkeys(keys, [])`?**
Every key gets the *same* list. The documentation states it outright — *"All of the values refer to just a single instance, so it generally doesn't make sense for value to be a mutable object such as an empty list"* — because the argument is evaluated once, before the call, and stored by reference under each key. Appending through one key is visible through all of them. It is exactly the mutable-default-argument trap in a different costume, and the documented fix is a dict comprehension, which evaluates the value expression once per key.

**★ Is `dict.fromkeys(keys, 0)` also wrong?**
No, and understanding why is the point. Sharing an immutable object is unobservable: you cannot mutate `0`, so "one instance shared" and "one instance per key" are indistinguishable. The documentation's wording is *"it generally doesn't make sense for value to be a mutable object"*, not "never pass a value". `0`, `""`, `()`, `None` and `frozenset()` are all safe. The risk is a refactor that later changes the value type to something mutable without revisiting the constructor.

**★ How do you deduplicate a list while preserving order?**
`list(dict.fromkeys(seq))`. It is *O*(n), it keeps the first occurrence of each element, and it needs no second data structure. It works because `fromkeys` inserts each key once — a repeat is an update, and updating a key does not change its position — and because dict iteration order has been guaranteed to be insertion order since 3.7. `list(set(seq))` is the wrong answer: set order is not guaranteed and varies with the hash seed, so the output differs between processes.

**★ Why does `dict.fromkeys("hello")` give five keys?**
Four, actually — `'h'`, `'e'`, `'l'`, `'o'`, because `'l'` repeats and repeats collapse. The underlying point is that `fromkeys` *iterates* its first argument, and a string iterates by character. The failure mode in real code is `dict.fromkeys(single_id)` where `single_id` is a string: no error, no warning, just a dictionary with one key per character. Wrap single values in a list.

**Does `MyDict.fromkeys(...)` give you a `MyDict`?**
Yes for a subclass that can be constructed with no arguments — `fromkeys` is a classmethod and CPython builds the result by calling the class with no arguments. It fails for subclasses with a required `__init__` parameter, which is the same incompatibility PEP 584 cites when it says *"`type(d1)({**d1, **d2})` fails for dict subclasses such as defaultdict that have an incompatible `__init__` method."* Practically: `defaultdict.fromkeys(...)` produces a `defaultdict` with no factory, which is almost never what the caller wanted.

**Can you use a dict as an ordered set?**
Yes, and `dict.fromkeys` is how you build one. The keys give you *O*(1) membership and guaranteed first-seen ordering; the values are `None` and cost one pointer each. What you do not get is set algebra on the object itself — for that you take `.keys()`, which *is* set-like, and that is [16 · Set operations on views](05d-set-operations-on-views.md). It is a real pattern, not a hack: Python has no built-in ordered set, and this is the standard substitute.

---

← [11 · `setdefault`](04c-setdefault.md) · [Topic index](README.md) · Next → [13 · The three views](05-the-three-views.md)
