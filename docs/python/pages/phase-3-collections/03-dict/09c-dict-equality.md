---
title: "Two dicts are equal when their pairs are equal — order never counts, 1 and True are one key, a NaN value equals itself only if it is the same object, < raises, and across mapping types each class chose its own rule, so the same == flips with the operand order"
sidebar_label: "24 · Dict equality"
sidebar_position: 24
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-10 against the Python 3.14 documentation — [Value comparisons](https://docs.python.org/3.14/reference/expressions.html#value-comparisons), [Mapping Types — dict](https://docs.python.org/3.14/library/stdtypes.html#mapping-types-dict), [`OrderedDict` equality](https://docs.python.org/3.14/library/collections.html#ordereddict-objects), [`Counter`](https://docs.python.org/3.14/library/collections.html#counter-objects), [`collections.abc`](https://docs.python.org/3.14/library/collections.abc.html), [Glossary — *hashable*](https://docs.python.org/3.14/glossary.html#term-hashable). The comparison algorithm read from `dict_equal_lock_held` / `dict_richcompare` in `Objects/dictobject.c`, `mappingproxy_richcompare` in `Objects/descrobject.c`, and `Counter.__eq__` / `Mapping.__eq__` in `Lib/`, all at CPython **v3.14.7**. Target: **CPython 3.14** (3.14.7). **No sandbox run.**

**`d1 == d2` is one of the most-used expressions in test suites and one of the least examined. Its definition is a single sentence — equal `(key, value)` pairs, order irrelevant — and every surprise comes from applying that sentence to real keys and real values: keys that compare equal across types, float values that are not equal to themselves, and the moment one side is not a plain `dict` but an `OrderedDict`, a `Counter` or a `UserDict`, each of which brought its own `__eq__`. This chunk is the algorithm, then the cross-type table, then what to do when a dict has to be compared, sorted or hashed.**

## The definition, twice

`stdtypes`:

> *"Dictionaries compare equal if and only if they have the same `(key, value)` pairs (regardless of ordering). Order comparisons ('<', '<=', '>=', '>') raise `TypeError`."*

The language reference adds the clause that decides the `NaN` case:

> *"Mappings (instances of `dict`) compare equal if and only if they have equal `(key, value)` pairs. Equality comparison of the keys and values enforces reflexivity."*

and explains what *"enforces reflexivity"* means for built-in containers generally:

> *"The built-in containers typically assume identical objects are equal to themselves. That lets them bypass equality tests for identical objects to improve performance and to maintain their internal invariants."*

## The algorithm

`dict_equal_lock_held` in `v3.14.7`, in three steps:

1. **Lengths first.** *"can't be equal if # of entries differ"* — unequal sizes return `False` without looking at a single key.
2. **For each entry of the left dict, look its key up in the right dict**, reusing the stored hash. Not found → `False`. That lookup is an ordinary dict lookup, so it uses the right dict's hash-then-`==` rules — which is why `1` on one side finds `True` on the other.
3. **Compare the two values** with `PyObject_RichCompareBool(aval, bval, Py_EQ)` — which returns `True` immediately when both are the same object. First difference exits.

```python
{1: "one"} == {True: "one"}           # True  — 1 == True, same hash: one key
{1.0: "x"} == {1: "x"}                # True
{"a": 1, "b": 2} == {"b": 2, "a": 1}  # True  — order never enters
```

Cost: *O*(n) in the worst case, and faster when it can fail early — but it runs your values' `__eq__`, which may be arbitrarily expensive, or may raise.

## `NaN`: equal to itself only by identity

A `float("nan")` is not equal to itself. Dict equality compares values with an identity shortcut, so the answer depends on whether the two dicts hold **the same NaN object**:

```python
nan = float("nan")
{"x": nan} == {"x": nan}                        # True  — same object; the identity shortcut
{"x": float("nan")} == {"x": float("nan")}      # False — two NaN objects, and nan != nan
```

In practice the second form is what you meet — two dicts parsed from two JSON documents, two rows from two queries — so a round-tripped record containing a NaN never equals the original. Compare with a NaN-aware helper when that matters:

```python
import math

def values_equal(a: object, b: object) -> bool:
    if isinstance(a, float) and isinstance(b, float) and math.isnan(a) and math.isnan(b):
        return True
    return a == b

def dicts_equal(p: dict, q: dict) -> bool:
    return p.keys() == q.keys() and all(values_equal(p[k], q[k]) for k in p)
```

## Across mapping types: each class chose

`dict_richcompare` returns `NotImplemented` unless both operands pass `PyDict_Check` — so a `dict` compares to any `dict` *subclass* with plain dict equality, and to anything else only if that other type provides `__eq__`.

| Comparison | Result rule | Source |
|---|---|---|
| `dict == defaultdict` | pair equality; `default_factory` ignored | `defaultdict` is a `dict` subclass |
| `OrderedDict == OrderedDict` | **order-sensitive** | *"roughly equivalent to `list(od1.items())==list(od2.items())`"* |
| `OrderedDict == dict` (either side) | order-insensitive | *"Equality tests between `OrderedDict` objects and other `Mapping` objects are order-insensitive like regular dictionaries."* |
| `Counter == Counter` | missing counts treated as zero (3.10+) | *"`Counter(a=1) == Counter(a=1, b=0)` returns true"* |
| `Counter == dict` | plain dict equality — zeros count | `Counter.__eq__` returns `NotImplemented` for a non-`Counter` |
| `MappingProxyType == dict` | delegates to the wrapped mapping | `mappingproxy_richcompare` → `PyObject_RichCompare(v->mapping, w, op)` |
| `UserDict == dict` | compares `self.data` with the other | `UserDict.__eq__` |
| your `Mapping` subclass `== dict` | `dict(self.items()) == dict(other.items())` | `Mapping.__eq__` mixin |
| `dict == [(k, v), ...]` | `False` | no shared `__eq__` |
| `d.keys() == {…}` | set equality | views are set-like — [16 · Set operations on views](05d-set-operations-on-views.md) |

The two that bite:

```python
from collections import Counter, OrderedDict

a = OrderedDict(x=1, y=2)
b = OrderedDict(y=2, x=1)
a == b                   # False — both OrderedDict: order-sensitive
a == dict(b)             # True  — one side is a plain dict: order-insensitive
dict(a) == dict(b)       # True

Counter(a=1, b=0) == Counter(a=1)      # True  — zero counts ignored between Counters
Counter(a=1, b=0) == {"a": 1}          # False — dict equality: 'b' is an extra key
```

So the result of `==` between two mappings can change when you convert *one* of them — a refactor that turns a `dict` into an `OrderedDict` "to preserve order", or a `Counter` into a plain dict for serialisation, can silently flip an equality check.

## Order comparisons raise

`{"a": 1} < {"b": 2}` is a `TypeError`: there is no ordering over dicts. The place that bites is sorting a list of them:

```python
from operator import itemgetter

rows = [{"name": "carol", "age": 31}, {"name": "alice", "age": 27}]
# sorted(rows)                                  # TypeError: '<' not supported between instances of 'dict' and 'dict'
by_name = sorted(rows, key=itemgetter("name"))
by_age_then_name = sorted(rows, key=itemgetter("age", "name"))
```

`max(rows)`, `min(rows)`, `heapq.heappush(heap, row)` on dicts, and tuples like `(priority, row)` whose priorities tie, all fail the same way. For the heap case, break ties with a counter so the dicts are never compared:

```python
import heapq
import itertools

tie = itertools.count()
heap: list[tuple[int, int, dict]] = []
heapq.heappush(heap, (job["priority"], next(tie), job))
```

## Dicts are not hashable

A `dict` is a mutable container and, per the glossary, *"mutable containers (such as lists or dictionaries) are not"* hashable — so a dict cannot be a set member or a dict key. When you need a dict *as* a key (deduplicating records, memoising on a config), freeze it:

```python
# values hashable, order irrelevant — equal dicts give equal keys
key = frozenset(record.items())

# order-sensitive, or you want a stable repr
key = tuple(sorted(record.items()))     # requires the keys to be mutually orderable
```

`frozenset(d.items())` matches dict equality exactly — same pairs, any order — as long as every value is hashable. Nested dicts need a recursive freeze.

## Gotchas

**★ Symptom: two `OrderedDict`s with the same contents are unequal, but each equals the same plain dict.** Cause: `OrderedDict` equality is order-sensitive *only* against another `OrderedDict`; against any other mapping it is order-insensitive. Fix: decide which you mean, and convert both sides.

```python
same_pairs = dict(a) == dict(b)
same_pairs_and_order = list(a.items()) == list(b.items())
```

**★ Symptom: a record round-tripped through JSON or a database never equals the original.** Cause: it contains a `NaN`; the two dicts hold two different NaN objects and `nan != nan`, so the identity shortcut does not apply. Fix: compare with a NaN-aware helper, or normalise NaN to `None` at ingestion.

```python
def values_equal(a: object, b: object) -> bool:
    return (a != a and b != b) or a == b       # a != a is True only for NaN-like values
```

**★ Symptom: `TypeError: '<' not supported between instances of 'dict' and 'dict'` from `sorted`, `max`, or `heapq`.** Cause: dicts have no ordering — *"Order comparisons … raise `TypeError`."* In a heap it appears only when two priorities tie and Python compares the next tuple element. Fix: a `key=`, or a tie-breaker.

```python
rows.sort(key=itemgetter("created_at"))
heapq.heappush(heap, (priority, next(tie), job))
```

**★ Symptom: `TypeError: unhashable type: 'dict'` when adding records to a set for deduplication.** Cause: dicts are mutable containers, not hashable. Fix: key on a frozen form.

```python
seen: set[frozenset] = set()
unique = []
for record in records:
    key = frozenset(record.items())
    if key not in seen:
        seen.add(key)
        unique.append(record)
```

**Symptom: `Counter(a=1, b=0) == {"a": 1}` is `False` though the counter "has only a".** Cause: the zero-means-missing rule is `Counter`-to-`Counter` only; against a plain dict, `Counter.__eq__` declines and plain dict equality sees an extra key. Fix: compare counters to counters, or drop zeros first.

```python
assert +counts == Counter(expected)       # unary + drops zero and negative counts
```

**Symptom: a test asserting two configs are equal passes although one was loaded in a different key order.** Cause: dict equality ignores order by definition. Fix: assert the order separately when order is part of the contract — see [03 · Order is a guarantee](02-insertion-order-is-a-guarantee.md).

```python
assert loaded == expected and list(loaded) == list(expected)
```

**Symptom: `{1: "a", True: "b"}` has one entry, and comparing it with `{1: "b"}` is `True`.** Cause: `1 == True` with equal hashes — one key; the value is the last written. Fix: see [08 · Equal keys that collide](03d-equal-keys-that-collide.md); key on something that encodes the type when the distinction matters.

```python
typed = {(type(k).__name__, k): v for k, v in pairs}
```

**Symptom: `dict == list_of_pairs` is always `False`.** Cause: a list is not a mapping; there is no shared `__eq__`. Fix: convert the pairs.

```python
assert result == dict(expected_pairs)
```

**Symptom: an equality check between two large dicts is unexpectedly slow, or raises from inside a value.** Cause: dict equality calls each value's `__eq__` — arbitrary code for custom objects, element-wise for large lists, and some array types refuse to produce a single boolean. Fix: compare a cheap identity field first, or define the comparison you mean explicitly.

```python
def same_rows(a: dict[str, Row], b: dict[str, Row]) -> bool:
    return a.keys() == b.keys() and all(a[k].version == b[k].version for k in a)
```

## Interview questions

**★ Does `{"a": 1, "b": 2} == {"b": 2, "a": 1}`, given that dicts are ordered?**
Yes. Order is guaranteed for iteration, never for equality: *"Dictionaries compare equal if and only if they have the same `(key, value)` pairs (regardless of ordering)."* The algorithm checks lengths, then looks each key of one dict up in the other and compares values — position never enters. If order matters, compare `list(a.items())` as well, or use `OrderedDict` on both sides.

**★ Why can `OrderedDict(x=1, y=2) == OrderedDict(y=2, x=1)` be `False` while both equal the same plain dict?**
Because `OrderedDict` defines order-sensitive equality only between two `OrderedDict`s — *"roughly equivalent to `list(od1.items())==list(od2.items())`"* — and deliberately falls back to ordinary, order-insensitive equality against any other mapping, so that *"`OrderedDict` objects [can] be substituted anywhere a regular dictionary is used."* The consequence is that equality between these objects is not transitive in the way you might assume, and converting one side changes the answer.

**★ Is `{"x": float("nan")} == {"x": float("nan")}` true?**
No, but `{"x": nan} == {"x": nan}` with one shared `nan` object is. Dict equality compares values with an identity shortcut — the reference says container comparison *"enforces reflexivity"* and that built-in containers *"assume identical objects are equal to themselves"* — so the same NaN object compares equal to itself, while two NaN objects fall through to `nan == nan`, which is `False`. Data parsed twice produces two NaN objects, so this is the case you actually meet.

**How would you use a dict as a key in another dict or a set?**
Freeze it: `frozenset(d.items())` when the values are hashable and order should not matter — it has exactly dict equality's semantics — or `tuple(sorted(d.items()))` when you need a canonical ordered form. Dicts themselves are unhashable because they are mutable; the glossary lists dictionaries among the containers that are not hashable. Nested dicts need a recursive conversion.

**Why does `sorted(list_of_dicts)` fail, and how do you sort one?**
Because `<` between dicts raises `TypeError` — a mapping has no natural ordering. Sort with a `key=` that extracts comparable values, typically `operator.itemgetter("field")` or `itemgetter("a", "b")` for a compound key. The same failure appears in `heapq` when two priorities tie and Python moves on to compare the payload dicts; an `itertools.count()` tie-breaker prevents it.

**What does `Counter(a=1, b=0) == Counter(a=1)` return, and why is that version-dependent?**
`True` since 3.10: *"In equality tests, missing elements are treated as having zero counts. Formerly, `Counter(a=3)` and `Counter(a=3, b=0)` were considered distinct."* It only applies between counters — `Counter.__eq__` returns `NotImplemented` for a non-`Counter`, so comparing to a plain dict uses dict equality, where `b: 0` is an extra key and the answer is `False`.

**Is `defaultdict(list) == {}` true?**
Yes. `defaultdict` is a `dict` subclass and compares with ordinary dict equality — pairs only. The `default_factory` is not part of the comparison, so two `defaultdict`s with different factories and the same contents are equal too. The same goes for any subclass that does not override `__eq__`: behaviour is not state, and `==` only looks at state.

**How expensive is `d1 == d2`?**
It returns `False` immediately on a length mismatch. Otherwise it is one hash lookup per key of the left dict — reusing the stored hash — plus one value comparison per key, stopping at the first difference. So it is *O*(n) lookups in the worst case, but the value comparisons run each value type's `__eq__`, which for nested containers is itself recursive, and for custom classes is arbitrary code. Comparing two large nested configs is a deep traversal, not a cheap check.

---

← [23 · `UserDict` and the mapping ABCs](09b-userdict-and-the-mapping-abcs.md) · [Topic index](README.md) · Next → [25 · `dict` across threads](10-dict-across-threads.md)
