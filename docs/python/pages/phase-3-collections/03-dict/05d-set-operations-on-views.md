---
title: "keys() and items() support &, |, - and ^ like real sets — which turns a config diff into three one-line expressions, provided you remember the result is an unordered set, items() needs hashable values, and values() never joins in"
sidebar_label: "16 · Set operations on views"
sidebar_position: 16
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-10 against the Python 3.14 documentation — [Dictionary view objects](https://docs.python.org/3.14/library/stdtypes.html#dictionary-view-objects), [`collections.abc` — ABCs table](https://docs.python.org/3.14/library/collections.abc.html#collections-abstract-base-classes), [Mapping Types — dict](https://docs.python.org/3.14/library/stdtypes.html#mapping-types-dict). Result types and view comparison rules read from `Objects/dictobject.c` at the [CPython **v3.14.7**](https://github.com/python/cpython/blob/v3.14.7/Objects/dictobject.c) tag. Target: **CPython 3.14** (3.14.7). Documentation-validated; **no sandbox run**.

**The single most under-used feature of `dict` is that `d.keys()` is already a set. "Which keys did the new config add, which did it drop, which changed value" is three expressions — `new.keys() - old.keys()`, `old.keys() - new.keys()`, and a difference of `items()` — with no loops and no temporary sets. The feature has four sharp edges, each documented: the result of every operation is a plain, unordered `set`; `items()` only behaves as a set when every value is hashable; `values()` is excluded outright; and views support the set *operators* but not the set *methods*.**

## The documented rule

🔴 > *"Keys views are set-like since their entries are unique and hashable. Items views also have set-like operations since the (key, value) pairs are unique and the keys are hashable. If all values in an items view are hashable as well, then the items view can interoperate with other sets. (Values views are not treated as set-like since the entries are generally not unique.) For set-like views, all of the operations defined for the abstract base class `collections.abc.Set` are available (for example, `==`, `<`, or `^`). While using set operators, set-like views accept any iterable as the other operand, unlike sets which only accept sets as the input."*

Three facts in that paragraph are load-bearing: **keys** views are unconditionally set-like; **items** views are set-like only as far as their values are hashable; **values** views are never set-like. And the operand rule — *"accept any iterable as the other operand"* — is looser than for `set` itself.

## The operators, and what they give back

The `collections.abc` table lists what `Set` provides, and therefore what a keys or items view provides:

> `Set` mixin methods: *"`__le__`, `__lt__`, `__eq__`, `__ne__`, `__gt__`, `__ge__`, `__and__`, `__or__`, `__sub__`, `__rsub__`, `__xor__`, `__rxor__` and `isdisjoint`"*

```python
old = {"host": "db1", "port": 5432, "pool": 10}
new = {"host": "db2", "port": 5432, "timeout": 30}

new.keys() & old.keys()        # {'host', 'port'}   — in both
new.keys() | old.keys()        # {'host', 'port', 'pool', 'timeout'}
new.keys() - old.keys()        # {'timeout'}        — added
old.keys() - new.keys()        # {'pool'}           — removed
new.keys() ^ old.keys()        # {'timeout', 'pool'} — in exactly one
new.keys().isdisjoint({"ssl"}) # True
```

🔴 **Every one of those results is a `set`** — not a view, not a dict. In `v3.14.7` the view operations build their result with `PySet_New`. Two consequences: the result is detached from both dictionaries (it will not change when they do), and it has **no order** — the insertion order of either dictionary is gone.

The documentation's own example shows the operand looseness — a keys view combined with a *list*:

> *"`keys | ['juice', 'juice', 'juice'] == {'bacon', 'spam', 'juice'}`"* → `True`

With a real `set` on the left, `{"a"} | ["b"]` is a `TypeError`; with a keys view on the left, any iterable works.

## The config diff, in full

```python
def diff_config(old: dict[str, object], new: dict[str, object]) -> dict[str, list[str]]:
    added = new.keys() - old.keys()
    removed = old.keys() - new.keys()
    changed = {key for key in new.keys() & old.keys() if new[key] != old[key]}
    return {
        "added": sorted(added),
        "removed": sorted(removed),
        "changed": sorted(changed),
    }
```

The `sorted()` calls are not decoration: the three sets are unordered, and a diff that prints in hash order produces a different report on every run. The `changed` line compares values explicitly rather than differencing `items()`, which is the version that survives unhashable values — see below.

When the values *are* hashable, the items view does the whole job:

```python
flags_before = {"beta": True, "dark_mode": False, "search_v2": True}
flags_after = {"beta": True, "dark_mode": True, "search_v2": True}

flags_after.items() - flags_before.items()     # {('dark_mode', True)}  — new or changed pairs
flags_before.items() - flags_after.items()     # {('dark_mode', False)} — old or removed pairs
```

## `items()` and unhashable values

The items view is set-like *"since the (key, value) pairs are unique and the keys are hashable"* — but combining it with another set means putting pairs into a hash table, which requires hashing the **value** too. The documentation's qualifier is exact: *"If all values in an items view are hashable as well, then the items view can interoperate with other sets."*

```python
old = {"hosts": ["a", "b"], "port": 5432}
new = {"hosts": ["a", "c"], "port": 5432}

new.items() - old.items()      # TypeError — ('hosts', ['a', 'c']) cannot be hashed
```

The diff that works for any values compares keys as sets and values by `==`:

```python
common = new.keys() & old.keys()
changed = {key for key in common if new[key] != old[key]}
```

## `values()` is not a set, at all

`d.values() & other` is a `TypeError`: values views do not implement the set operators, because *"the entries are generally not unique."* If you need set semantics over the values and they are hashable, build the set explicitly:

```python
distinct_regions = set(tenant_region.values())
unused = ALL_REGIONS - distinct_regions
```

## Comparison: views compare to sets, not to lists

The ordering operators are subset and superset tests, exactly as for `set`:

```python
required = {"host", "port"}
config.keys() >= required        # True if every required key is present
config.keys() <= ALLOWED_KEYS    # True if no unknown key is present
```

⚠️ **A keys view is equal only to another set-like object.** In `v3.14.7`, the view comparison begins `if (!PyAnySet_Check(other) && !PyDictViewSet_Check(other)) Py_RETURN_NOTIMPLEMENTED;` — so comparing to a list or tuple is not a content comparison and comes out `False` whatever the contents:

```python
d = {"a": 1, "b": 2}
d.keys() == {"a", "b"}      # True  — set-like against set
d.keys() == ["a", "b"]      # False — always; a list is not set-like
list(d) == ["a", "b"]       # True  — and order-sensitive, which is usually what the test meant
```

## Operators yes, methods no

The ABC table lists *operators* and `isdisjoint`. The named methods that `set` has — `union`, `intersection`, `difference`, `symmetric_difference`, `issubset`, `issuperset` — are **not** in it, and dictionary views do not have them:

```python
d.keys().union(other)          # AttributeError
d.keys() | other               # works — and `other` may be any iterable
set(d).union(a, b, c)          # the method form, when you need several operands at once
```

## Preserving order when you need it

Because every result is a set, "the keys of `d` that are also allowed, *in `d`'s order*" is not an intersection — it is a filtered comprehension:

```python
ALLOWED = {"name", "email", "locale"}

# order lost: the result of & is a set
clean = {key: payload[key] for key in payload.keys() & ALLOWED}

# order kept: iterate the dict, test membership in the set
clean = {key: value for key, value in payload.items() if key in ALLOWED}
```

The second form is also the one that preserves the caller's field order in a JSON response — the thing a client diffing responses will notice.

## Gotchas

**★ Symptom: `AttributeError: 'dict_keys' object has no attribute 'union'`.** Cause: views get the `collections.abc.Set` mixins — operators and `isdisjoint` — not the method surface of `set`. Fix: use the operator, or materialise a set when you need the method.

```python
merged_keys = a.keys() | b.keys()
all_keys = set(a).union(b, c, d)
```

**★ Symptom: a config diff prints its keys in a different order on every run.** Cause: every view set operation returns a `set`, and set iteration order is not guaranteed and varies with the hash seed. Fix: sort at the point of output.

```python
for key in sorted(new.keys() - old.keys()):
    print(f"+ {key}")
```

**★ Symptom: `TypeError: unhashable type: 'list'` from `new.items() - old.items()`.** Cause: set operations on an items view hash the whole pair, and one value is a list — the documentation's *"If all values in an items view are hashable as well"* condition failed. Fix: difference the keys and compare values with `==`.

```python
changed = {key for key in new.keys() & old.keys() if new[key] != old[key]}
```

**★ Symptom: an allow-list filter reorders the fields of an API response.** Cause: `payload.keys() & ALLOWED` is a set; building a dict from it inserts in set order. Fix: iterate the payload, test membership in the allow-list.

```python
clean = {key: value for key, value in payload.items() if key in ALLOWED}
```

**Symptom: `TypeError` from `d.values() & other_values`.** Cause: values views are not set-like — *"(Values views are not treated as set-like since the entries are generally not unique.)"* Fix: build a set of the values, if they are hashable.

```python
shared = set(a.values()) & set(b.values())
```

**Symptom: `assert d.keys() == ["id", "name"]` fails for a dict that has exactly those keys.** Cause: a keys view compares only to set-like objects; against a list the comparison returns `NotImplemented` and ends up `False`. Fix: compare to a set for "same keys", or to `list(d)` for "same keys in this order".

```python
assert d.keys() == {"id", "name"}          # membership
assert list(d) == ["id", "name"]           # membership and order
```

**Symptom: a "which keys differ" report cannot say which side each key came from.** Cause: it used `^`, which merges both one-sided differences into one set. Fix: two differences.

```python
only_new = new.keys() - old.keys()
only_old = old.keys() - new.keys()
```

**Symptom: the result of `d.keys() & allowed` is used later and misses keys added to `d` since.** Cause: the result is a detached `set`, not a live view; it was computed once. Fix: recompute at the point of use, or keep the view and apply the operator where you need the answer.

```python
def visible_keys(d: dict[str, object]) -> set[str]:
    return d.keys() & ALLOWED            # computed fresh on every call
```

**Symptom: a key set diff reports no change although a key went from `1` to `True`.** Cause: `1 == True`, so they are the same key and the same set element — the collision in [08 · Equal keys that collide](03d-equal-keys-that-collide.md). Fix: if the type of a key matters, key on something that encodes the type.

```python
typed_keys = {(type(k).__name__, k) for k in d}
```

**Symptom: `{"a"} | d.keys()` works but `{"a"} | ["b"]` raises.** Cause: set-like views *"accept any iterable as the other operand, unlike sets which only accept sets as the input"*; with a view on either side the view's operator handles it, with two plain operands the `set` rule applies. Fix: when mixing with a list, put a view on one side, or convert explicitly.

```python
wanted = d.keys() | extra_names          # extra_names may be a list
wanted = set(base_names) | set(extra_names)
```

## Interview questions

**★ Why are `keys()` views set-like but `values()` views not?**
Because a set requires unique, hashable elements. Dictionary keys are unique and hashable by construction — that is what a key *is* — so a keys view can offer set operations with no extra conditions. Values carry no such guarantee: two keys may map to the same value, and values may be unhashable. The documentation gives exactly that reason: *"Values views are not treated as set-like since the entries are generally not unique."* Items views sit in between: the pairs are unique because the keys are, but using them with other sets requires the values to be hashable too.

**★ How would you find the keys added, removed and changed between two configuration dicts?**
`new.keys() - old.keys()` for added, `old.keys() - new.keys()` for removed, and for changed either `new.items() - old.items()` when every value is hashable, or `{k for k in new.keys() & old.keys() if new[k] != old[k]}` when they might not be. Sort each result before reporting it, because every one is an unordered `set`. It is linear in the size of the dictionaries and involves no hand-written loop over both.

**★ What type does `d.keys() & other` return?**
A plain `set`. Not a view — so it does not track later changes to `d` — and not a dict, so the values are gone and the insertion order is gone. That is the most common surprise in practice: a filter written as an intersection silently reorders keys. When order matters, the idiom is a comprehension over `d.items()` with a membership test against the other collection.

**Why can a keys view be combined with a list when a set cannot?**
It is a documented design choice: *"While using set operators, set-like views accept any iterable as the other operand, unlike sets which only accept sets as the input."* The `collections.abc.Set` mixins build their result from an iterable, so the right operand only has to be iterable. `set.__or__` is stricter to catch accidental mixing of types. The practical upshot is that `d.keys() | extra_names` works whatever `extra_names` is.

**Why does `d.keys() == ["a", "b"]` return `False` even when those are exactly the keys?**
Because the view's equality is set equality and it only compares against set-like operands — CPython's view comparison returns `NotImplemented` for anything that is not a `set`, `frozenset` or dict view, and a list has nothing to offer in reverse, so the result is `False`. Compare to `{"a", "b"}` if you mean "the same keys", or to `list(d)` if you mean "the same keys in this order".

**Can you call `.union()` or `.issubset()` on a keys view?**
No. Views receive what `collections.abc.Set` provides: the comparison operators, `&`, `|`, `-`, `^` and their reflected forms, and `isdisjoint`. The named methods are part of the concrete `set` type, not the ABC. Use the operators — `<=` for subset — or convert with `set(d)` when you want the method form with several arguments.

**How do you check that a config has every required key and no unknown ones?**
With the view comparison operators, which are subset and superset tests: `config.keys() >= REQUIRED` for "nothing missing" and `config.keys() <= ALLOWED` for "nothing unexpected". For a useful error message, use the differences instead — `REQUIRED - config.keys()` names what is missing and `config.keys() - ALLOWED` names what is unknown — and sort them before printing, since both are unordered sets.

**Does a set operation on views see later changes to the dictionaries?**
No. The operator runs once and builds a plain `set` from the current contents; the result is detached from both dictionaries. Only the view *itself* is live. If you need an always-current answer, keep the views and apply the operator at the point of use, or wrap it in a function.

---

← [15 · The mutations you did not write](05c-the-mutations-you-did-not-write.md) · [Topic index](README.md) · Next → [17 · Building a dict](06-building-a-dict.md)
