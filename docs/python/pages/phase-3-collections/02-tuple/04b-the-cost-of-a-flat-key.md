---
title: "A flat tuple key buys one lookup and sells you prefix access — plus everything lru_cache does to the arguments you hand it"
sidebar_label: "4b · The cost of a flat key"
sidebar_position: 8
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-10 against the Python 3.14
> [`functools.lru_cache`](https://docs.python.org/3.14/library/functools.html#functools.lru_cache)
> and [`functools.cache`](https://docs.python.org/3.14/library/functools.html#functools.cache);
> [Immutable Sequence Types](https://docs.python.org/3.14/library/stdtypes.html#immutable-sequence-types);
> [`dict`](https://docs.python.org/3.14/library/stdtypes.html#dict) and
> [`dict.items()`](https://docs.python.org/3.14/library/stdtypes.html#dict.items);
> [`collections.namedtuple`](https://docs.python.org/3.14/library/collections.html#collections.namedtuple);
> and [`json` — conversion table](https://docs.python.org/3.14/library/json.html#py-to-json-table).
> Documentation-verified — **no sandbox run**. Version spine: **CPython 3.14**.

**Two things go wrong with composite keys once they are in production, and neither is
visible while you are writing the happy path. The first is `lru_cache`, which builds a key
out of your arguments and therefore inherits every hashability and ordering rule from
[3 · Hashability](03-hashability.md) — including one, about keyword-argument order, that
the documentation states plainly and almost nobody reads. The second is that a flat key
has no prefix: `views["acme"]` is a `KeyError`, not a group, and getting the group back
costs a full scan.**

## Caching: `lru_cache` requires hashable arguments

The tuple key is not always something you build — sometimes the standard library builds it
for you out of your arguments:

> *"Since a dictionary is used to cache results, the positional and keyword arguments to
> the function must be `hashable`."*

> *"Distinct argument patterns may be considered to be distinct calls with separate cache
> entries.  For example, `f(a=1, b=2)` and `f(b=2, a=1)` differ in their keyword argument
> order and may have two separate cache entries."* —
> [`lru_cache`](https://docs.python.org/3.14/library/functools.html#functools.lru_cache)

Both sentences bite in practice:

```python
from functools import lru_cache

@lru_cache(maxsize=1024)
def resolve_permissions(tenant: str, scopes: tuple[str, ...]) -> frozenset[str]:
    ...

# Caller has a list. This raises TypeError: unhashable type: 'list'
resolve_permissions("acme", ["read", "write"])

# Convert at the boundary — and freeze the semantics you want:
resolve_permissions("acme", tuple(scopes))       # order matters
```

And the second sentence: calling `resolve_permissions("acme", scopes=t)` and
`resolve_permissions(tenant="acme", scopes=t)` may occupy two cache entries. Standardise
the call convention if the hit rate matters.

## The cost: you lose prefix lookup

This is the real trade-off, and it is structural rather than a matter of taste.

| Question | Nested dict | Tuple-keyed flat dict |
|---|---|---|
| "count for `(acme, 2026-09-10)`" | two lookups | one lookup |
| "all days for `acme`" | `views["acme"]` — one lookup | **scan every key** |
| "delete everything for `acme`" | `del views["acme"]` | scan and delete |
| "how many tenants" | `len(views)` | scan and build a set |
| a missing intermediate level | guard or `defaultdict` | cannot happen |
| serialising to JSON | works directly | keys must be flattened first |

A flat dict has no notion of a key *prefix*. `views["acme"]` raises `KeyError` because
`"acme"` is not a key — `("acme", "2026-09-10")` is. Answering "all days for acme" means

```python
acme_days = {day: n for (tenant, day), n in views.items() if tenant == "acme"}
```

which is a full scan. **Choose the flat key when the composite is the natural unit of
access and the per-prefix queries are rare or absent; choose nesting when a prefix is a
first-class query.** If both are frequent, keep the flat dict as the source of truth and
build an index — do not maintain two structures by hand.

## When the answer is neither

A tuple key stops paying off at the point where the key itself needs a name:

- **More than three components** — `stats[tenant, region, day, page, device]` is
  unreadable at the call site and impossible to reorder safely. Give the key a
  `NamedTuple`; it still hashes and compares identically, and every field gets a name. See
  [8 · Named records](08-named-records.md).
- **Components that are optional** — a key where `region` is sometimes `None` means two
  different key spaces sharing a dict. Model it explicitly.
- **Millions of rows with range queries** — this is a database, not a dict. Grouping in
  Python what SQL can `GROUP BY` moves the whole table across the wire.

## When the flat key needs a name instead

Past a certain arity the key stops being readable and starts being a source of silent
transposition bugs — `stats[tenant, region, day]` and `stats[tenant, day, region]` are both
valid Python and only one is right. A `NamedTuple` key fixes that without changing a
single property the dict relies on:

```python
from typing import NamedTuple

class ViewKey(NamedTuple):
    tenant: str
    region: str
    day: str

views[ViewKey(tenant="acme", region="eu", day="2026-09-10")] += 1
```

It is still a `tuple` subclass, so it hashes the same way, compares the same way, sorts the
same way, and unpacks the same way — the only thing that changed is that every construction
site names its fields and a transposition becomes a type error rather than a wrong answer.
The full comparison lives in [8 · Named records](08-named-records.md).

## Gotchas

**★ Symptom: `KeyError: 'acme'` when reading a dict you know contains that tenant.**
Cause: the key is the tuple `("acme", day)`; `"acme"` alone is not a key, and a flat dict
has no prefix lookup. Fix: build the whole key, or filter if you genuinely want the group.

```python
n = views[tenant, day]                                       # the whole key
group = {d: c for (t, d), c in views.items() if t == tenant}  # or a scan
```

**★ Symptom: `TypeError: unhashable type: 'list'` from an `@lru_cache`-decorated
function.** Cause: `lru_cache` keys the cache dict on the arguments, so every argument must
be hashable — a list argument cannot be. Fix: convert at the boundary and annotate the
parameter as a tuple so the type checker enforces it.

```python
@lru_cache(maxsize=1024)
def resolve(tenant: str, scopes: tuple[str, ...]) -> frozenset[str]:
    ...
resolve(tenant, tuple(scopes))
```

**★ Symptom: an `lru_cache` hit rate far below what the call pattern predicts.** Cause:
the docs warn that *"`f(a=1, b=2)` and `f(b=2, a=1)` … may have two separate cache
entries"* — keyword order changes the key. Fix: make the parameters positional-only, or
fix one call convention.

```python
@lru_cache(maxsize=1024)
def resolve(tenant, scopes, /):     # positional-only: no keyword variants possible
    ...
```

**Symptom: memory grew unboundedly on a long-running worker keyed by
`(tenant, timestamp)`.** Cause: a timestamp with sub-second resolution makes every event a
new key, so the dict is an unbounded log rather than an aggregate. Fix: truncate the
component to the granularity you actually report on.

```python
views[tenant, event.at.date()] += 1        # one key per day, not per microsecond
```

**★ Symptom: `functools.cache` on a method keeps every instance alive.** Cause: the cache
key includes `self`, so the cache dict holds a strong reference to every receiver it was
ever called with — the `lru_cache` docs note the cache is *"a dictionary"* keyed on the
arguments, and `self` is an argument. Fix: cache a module-level function that takes only
the hashable parts, or use `functools.cached_property` for per-instance memoisation.

```python
@lru_cache(maxsize=512)
def _resolve(tenant: str, scopes: tuple[str, ...]) -> frozenset[str]:
    ...

class Resolver:
    def resolve(self, scopes):
        return _resolve(self.tenant, tuple(scopes))   # no `self` in the key
```

## Interview questions

**★ Your `lru_cache` is never hitting. Name three causes.**
One, an argument is unhashable and every call is raising rather than caching — though that
one is loud. Two, keyword-argument order varies between call sites; the docs say
`f(a=1, b=2)` and `f(b=2, a=1)` *"may have two separate cache entries"*. Three, an argument
is a `tuple(...)` built from an unordered source, so the same logical input produces
different keys — a `frozenset` would collapse them. A fourth, less obvious one: `maxsize`
is smaller than the working set, so entries evict before they are reused.

**★ When is a tuple key the wrong choice?**
When you need prefix access. A flat dict has no notion of a partial key, so "everything
for tenant X" becomes a full scan, and `del` for a whole group becomes a scan too. Nesting
buys you those at the cost of guard clauses on every read. The other case is arity: past
about three components the positional key stops being readable and should become a
`NamedTuple`, which hashes and compares exactly the same way but gives the fields names.

**You need a cache key that includes a set of scopes. Tuple or frozenset?**
`frozenset`, if the scopes are conceptually unordered — it collapses `{"read","write"}`
and `{"write","read"}` into one key and removes duplicates, which is what a permission set
means. `tuple(sorted(scopes))` achieves the same collapse while staying a sequence, which
is useful if you also want to display the key or compare keys in order. A bare
`tuple(scopes)` preserves whatever order the caller happened to have, which is almost
never what you meant.

**A tuple key of `(tenant, timestamp)` made a worker's memory grow without bound. Why?**
Because a high-resolution timestamp makes every event a distinct key, so the "aggregate"
is really an append-only log in a dict. The composite key is only an aggregation if every
component has bounded cardinality over the retention window. Truncate the time component
to the granularity you actually report at, and evict old keys explicitly.

**Both "count for one (tenant, day)" and "everything for one tenant" are hot. What do you
build?**
Keep the flat `Counter` as the source of truth, because that is where every write lands and
a write must not have to touch two structures consistently. Then derive the per-tenant view
— either lazily, by scanning once per report rather than once per request, or by
maintaining a second dict `{tenant: set_of_days}` updated in the *same function* that does
the increment. What you must not do is hand-maintain two independent aggregates from
scattered call sites; that is how they drift.

**★ Why does `lru_cache` include `self` in the key when you decorate a method?**
Because it decorates a plain function and has no idea that the first parameter is special
— `self` is simply the first positional argument, and the cache dict keys on all of them.
Two consequences: instances that compare unequal get separate cache entries even when the
answer would be identical, and the cache keeps every receiver alive for as long as the
entry survives. The fix is to hoist the cacheable computation into a function whose
parameters are only the values that actually determine the result.

---

← [Tuples as keys](04-tuples-as-keys.md) · [Topic index](README.md) · Next → [The comma makes the tuple](05-the-comma-makes-the-tuple.md)
