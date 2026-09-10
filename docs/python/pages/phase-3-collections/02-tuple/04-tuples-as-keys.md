---
title: "The composite key is the tuple's real job in a service: one dict indexed by (tenant, day) replaces three levels of nested dictionaries and every guard clause that came with them"
sidebar_label: "4 · Tuples as keys"
sidebar_position: 7
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-10 against the Python 3.14 language reference on
> [Comma-separated subscripts](https://docs.python.org/3.14/reference/expressions.html#comma-separated-subscripts);
> [Immutable Sequence Types](https://docs.python.org/3.14/library/stdtypes.html#immutable-sequence-types);
> [`collections.defaultdict`](https://docs.python.org/3.14/library/collections.html#collections.defaultdict)
> and [`collections.Counter`](https://docs.python.org/3.14/library/collections.html#collections.Counter);
> [`functools.lru_cache`](https://docs.python.org/3.14/library/functools.html#functools.lru_cache);
> [Set Types](https://docs.python.org/3.14/library/stdtypes.html#set-types-set-frozenset);
> [`dict.items()`](https://docs.python.org/3.14/library/stdtypes.html#dict.items);
> and the design FAQ on
> [dictionary keys](https://docs.python.org/3.14/faq/design.html#why-must-dictionary-keys-be-immutable).
> Documentation-verified — **no sandbox run**. Version spine: **CPython 3.14**.

**Hashability is the mechanism; the composite key is what you do with it. A tuple key
turns "count page views per user per day" from a nested structure with two levels of
`setdefault` into one flat dict and one line of aggregation. The syntax helps more than
people realise — `counts[tenant, day]` is legal and builds the tuple for you, because the
reference specifies that a comma-separated subscript is passed as a tuple. What the flat
key costs you is prefix lookup, and knowing when that cost bites is the whole decision.**

## The shape it replaces

Nested dictionaries express a composite key as a tree, and every read has to defend
against a missing level:

```python
# Three levels, and a guard at every one.
views = {}
for event in stream:
    if event.tenant not in views:
        views[event.tenant] = {}
    if event.day not in views[event.tenant]:
        views[event.tenant][event.day] = {}
    day = views[event.tenant][event.day]
    day[event.page] = day.get(event.page, 0) + 1
```

Flat, with a tuple key:

```python
from collections import Counter

views = Counter()
for event in stream:
    views[event.tenant, event.day, event.page] += 1
```

`Counter` supplies the zero default; the tuple supplies the composite key; the three
guard clauses have nowhere left to live. The `Counter` documentation describes exactly
this default behaviour:

> *"A `Counter` is a `dict` subclass for counting hashable objects. It is a collection where
> elements are stored as dictionary keys and their counts are stored as dictionary values.
> Counts are allowed to be any integer value including zero or negative counts."* —
> [`Counter`](https://docs.python.org/3.14/library/collections.html#collections.Counter)

## The syntax: the parentheses are optional in a subscript

`views[event.tenant, event.day]` is not sloppy — it is specified:

> *"The subscript can also be given as two or more comma-separated expressions or slices …
> **In this case, the interpreter constructs a `tuple` of the results of the expressions or
> slices, and passes this tuple to the `__getitem__` or `__class_getitem__` special
> method**, as above."* —
> [Comma-separated subscripts](https://docs.python.org/3.14/reference/expressions.html#comma-separated-subscripts)

And the one-element case, which is the same trailing-comma rule as everywhere else:

> *"The subscript may also be given as a single expression or slice followed by a comma, to
> specify a one-element tuple"*

So all four of these are the same lookup:

```python
views[(tenant, day)]      # explicit
views[tenant, day]        # the interpreter builds the tuple
key = (tenant, day)
views[key]                # pre-built
views[*parts]             # starred subscript, 3.11+ (PEP 646) — builds a tuple too
```

⚠️ Pick one and stay with it in a codebase. `views[tenant, day]` reads well for a
matrix-like lookup and badly when the key is conceptually one value that happens to have
two parts — in that case build it once, name it, and pass the name.

## Grouping: `defaultdict` plus a tuple key

The other half of the idiom is collecting rather than counting:

```python
from collections import defaultdict

def group_orders(rows):
    """rows: an iterable of order records. Returns {(tenant, status): [order_id, ...]}"""
    grouped = defaultdict(list)
    for row in rows:
        grouped[row.tenant, row.status].append(row.order_id)
    return grouped
```

> *"Using `list` as the `default_factory`, it is easy to group a sequence of key-value pairs
> into a dictionary of lists"* —
> [`defaultdict`](https://docs.python.org/3.14/library/collections.html#collections.defaultdict)

🔴 **`defaultdict` inserts on read.** `grouped[a, b]` in a plain lookup creates an empty
list under that key. Use `grouped.get((a, b), [])` when you are only inspecting — and note
the parentheses come back, because `get` takes a normal argument, not a subscript.

## Set membership and set algebra on tuple rows

Because tuples are hashable, a set of tuples is a set of rows, and set algebra becomes a
diff:

```python
def reconcile(db_rows, api_rows):
    """Both sides are iterables of (external_id, status) pairs."""
    in_db  = {(r.external_id, r.status) for r in db_rows}
    in_api = {(r["id"], r["status"]) for r in api_rows}

    to_insert = in_api - in_db
    to_delete = in_db - in_api
    unchanged = in_db & in_api
    return to_insert, to_delete, unchanged
```

That replaces a nested loop with three operators. It works only because the row was
projected into a **hashable** shape — the moment one field is a list, the set comprehension
raises. See [3 · Hashability](03-hashability.md).

⚠️ Set operations discard order and duplicates. If two rows can be legitimately identical
and both matter, a set is the wrong container; project a unique id into the tuple, or use
a `Counter`.

## Sorting and reporting a tuple-keyed dict

A flat dict keyed on tuples sorts and slices with `sorted` and `itemgetter`, because
tuples compare lexicographically — the subject of
[9 · Comparison and ordering](09-comparison-and-ordering.md):

```python
from operator import itemgetter

# Top 10 (tenant, day) pairs by view count.
top = sorted(views.items(), key=itemgetter(1), reverse=True)[:10]

# Chronological within each tenant: the key tuple already sorts that way.
for (tenant, day), count in sorted(views.items()):
    print(tenant, day, count)
```

`views.items()` yields `(key, value)` pairs —

> *"Return a new view of the dictionary's items (`(key, value)` pairs)."* —
> [`dict.items()`](https://docs.python.org/3.14/library/stdtypes.html#dict.items)

— so each element of that iteration is a tuple containing a tuple, and
`for (tenant, day), count in ...` unpacks both levels in one statement. That nested
unpacking is [6 · Packing and unpacking](06-packing-and-unpacking.md).

## Gotchas

**★ Symptom: a `defaultdict` grows entries you never wrote to.** Cause: `d[key]` on a
`defaultdict` *inserts* the default before returning it, so every read of a missing key
creates it. Fix: use `.get()` for read-only access.

```python
existing = grouped.get((tenant, status), [])   # no insertion
```

**Symptom: `json.dumps(views)` raises `TypeError: keys must be str, int, float, bool or
None, not tuple`.** Cause: JSON object keys are strings; a tuple key has no JSON
representation. Fix: flatten to a list of records at the serialisation boundary — do not
try to make the key a string and parse it back.

```python
payload = [{"tenant": t, "day": d, "count": c} for (t, d), c in views.items()]
```

**Symptom: two logically identical rows landed under different keys.** Cause: one
component was a `str` and the other an `int`, or one list was ordered differently. Fix:
normalise every component as it enters the key, in one function, and call only that
function.

```python
def view_key(event):
    return (str(event.tenant), event.day.isoformat())
```

**Symptom: `views[tenant, day] += 1` on a plain `dict` raises `KeyError`.** Cause: `+=`
reads before it writes, and the key does not exist yet. Fix: `Counter` or
`defaultdict(int)`, both of which supply the zero.

```python
from collections import Counter
views = Counter()
views[tenant, day] += 1
```

**Symptom: swapping the order of two components silently produced a second, empty
dataset.** Cause: `(tenant, day)` and `(day, tenant)` are different keys and nothing
complains — a tuple key has positions, not names. Fix: build the key in exactly one place,
or give it a `NamedTuple` so the fields are named at every call site.

## Interview questions

**★ How do you count events per user per day in Python?**
One `Counter` keyed on the tuple `(user_id, day)`, incremented in a single line:
`counts[user_id, day] += 1`. The composite key removes the nested structure and every
guard clause that goes with it, and `Counter` supplies the zero default. The follow-up
worth volunteering is the trade-off — this shape answers "how many for this user on this
day" in one lookup and "all days for this user" only by scanning, so if the second query
is common you either nest or keep an index.

**★ Why does `d[a, b]` work without parentheses?**
Because the reference specifies that a comma-separated subscript is collected into a
tuple before being passed to `__getitem__`: *"the interpreter constructs a `tuple` of the
results of the expressions or slices, and passes this tuple to the `__getitem__` … special
method"*. It is the same rule that makes `numpy_array[i, j]` work. `d[a,]` — a single
expression with a trailing comma — passes the 1-tuple `(a,)`, which is the same
comma-makes-the-tuple rule as everywhere else.

**Why can a `set` of tuples do a row diff that a nested loop cannot?**
Because set difference and intersection are hash-based, so the whole comparison is done by
bucket lookup rather than by comparing every left row against every right row. The
precondition is that each row is projected into something hashable — which is precisely
what a tuple of scalars is. The moment a field is a list, the projection has to convert it
(`tuple(...)` or `frozenset(...)`) or the set comprehension raises.

**How do you serialise a tuple-keyed dict to JSON?**
You do not serialise the dict; you serialise a list of records. JSON object keys must be
strings, so a tuple key has no direct representation, and encoding it as `"acme|2026-09-10"`
just moves the parsing problem to the consumer and introduces a delimiter bug. Emit
`[{"tenant": ..., "day": ..., "count": ...}, ...]` and let the consumer index it however it
likes.

---

← [What a hash value is not](03b-what-a-hash-value-is-not.md) · [Topic index](README.md) · Next → [The cost of a flat key](04b-the-cost-of-a-flat-key.md)
