---
title: "A tuple has exactly two methods of its own, `count` and `index`, and every other thing it does is a common sequence operation — each a linear scan by equality, which is why `True`, `1` and `1.0` are the same element to all of them"
sidebar_label: "10 · The real surface"
sidebar_position: 27
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-10 against the Python 3.14 library reference —
> [Tuples](https://docs.python.org/3.14/library/stdtypes.html#tuple),
> [Common Sequence Operations](https://docs.python.org/3.14/library/stdtypes.html#common-sequence-operations),
> [Immutable Sequence Types](https://docs.python.org/3.14/library/stdtypes.html#immutable-sequence-types)
> and the new [Time complexity of operations on built-in types](https://docs.python.org/3.14/library/time-complexity.html)
> page; the language reference on
> [Membership test operations](https://docs.python.org/3.14/reference/expressions.html#membership-test-operations)
> and [Booleans](https://docs.python.org/3.14/reference/datamodel.html#booleans); CPython 3.14
> [`Objects/tupleobject.c`](https://github.com/python/cpython/blob/3.14/Objects/tupleobject.c)
> for the `index` error text. Documentation-verified — **no sandbox run, no timings**. Version spine: **CPython 3.14**.

**The complete API of a tuple fits in one sentence: the common sequence operations, plus
`hash()`, plus `count` and `index`. There is nothing to learn about mutation because there is
none, and nothing hidden behind the small surface — which makes it worth knowing precisely what
the few operations do. Every search-shaped one of them (`in`, `count`, `index`) walks the tuple
from the front and asks each item "are you equal to this?", so each is linear, each respects
`==` rather than type, and each therefore treats `1`, `1.0` and `True` as the same value. The
costs of the rest, from `tuple(t)` in constant time to `t * k` in time proportional to the
result, are now in the 3.14 documentation as a table.**

## The whole surface

> *"Tuples implement all of the common sequence operations."* —
> [Tuples](https://docs.python.org/3.14/library/stdtypes.html#tuple)

> *"The only operation that immutable sequence types generally implement that is not also
> implemented by mutable sequence types is support for the `hash` built-in."* —
> [Immutable Sequence Types](https://docs.python.org/3.14/library/stdtypes.html#immutable-sequence-types)

| Operation | What it does on a tuple |
|---|---|
| `x in t`, `x not in t` | linear scan by identity-or-equality |
| `t + u` | new tuple holding both sets of references |
| `t * n` | new tuple repeating the references *n* times |
| `t[i]`, `t[i:j]`, `t[i:j:k]` | item, or a **new** tuple of the sliced references |
| `len(t)`, `min(t)`, `max(t)` | length is stored; `min`/`max` scan |
| `t.index(x[, i[, j]])` | position of the first equal item, or `ValueError` |
| `t.count(x)` | number of equal items |
| `hash(t)` | combined from the items' hashes — [3](03-hashability.md) |

What is *absent* is the entire mutable-sequence table: `append`, `extend`, `insert`, `pop`,
`remove`, `clear`, `sort`, `reverse`, item and slice assignment, `del t[i]`. `sorted(t)` and
`reversed(t)` work because they are built-ins that read any iterable — `sorted` returns a new
**list** and `reversed` an iterator, so `tuple(sorted(t))` is the spelling when a tuple is
needed back.

## `count` and `index`

> *"Return the total number of occurrences of *value* in *sequence*."* (`count`)

> *"Return the index of the first occurrence of *value* in *sequence*. Raises `ValueError` if
> *value* is not found in *sequence*. The *start* or *stop* arguments allow for efficient
> searching of subsections of the sequence, beginning at *start* and ending at *stop*. This is
> roughly equivalent to `start + sequence[start:stop].index(value)`, only without copying any
> data."* — [Common Sequence Operations](https://docs.python.org/3.14/library/stdtypes.html#common-sequence-operations)

```python
STAGES = ("draft", "review", "approved", "published")

def next_stage(current: str) -> str | None:
    i = STAGES.index(current)                 # ValueError for an unknown stage — good
    return STAGES[i + 1] if i + 1 < len(STAGES) else None

HEADER = ("id", "email", "tier", "email")
second_email = HEADER.index("email", HEADER.index("email") + 1)   # start= skips the first
```

`index` raising is usually what you want — an unknown stage *is* a bug. When absence is a
normal outcome, test first or catch the exception; there is no `find` returning `-1` on tuples
(that is a `str` method).

## Membership is a scan, and it uses identity first

> *"For container types such as list, tuple, set, frozenset, dict, or collections.deque, the
> expression `x in y` is equivalent to `any(x is e or x == e for e in y)`."* —
> [Membership test operations](https://docs.python.org/3.14/reference/expressions.html#membership-test-operations)

Two consequences are written into that one line. It is **linear** for a tuple — the 3.14 cost
table lists `x in t` as *O(n)* — where the same test on a `set` or `frozenset` is a hash lookup.
And it checks **identity before equality**, so `nan in (nan,)` is true for the same NaN object
even though `nan == nan` is false.

```python
SAFE_METHODS = ("GET", "HEAD", "OPTIONS")      # three items: a scan is nothing
if request.method in SAFE_METHODS:
    skip_csrf_check = True

BLOCKED_IDS = frozenset(load_blocklist())     # fifty thousand items: hash it
if user_id in BLOCKED_IDS:
    raise PermissionError(f"user {user_id} is blocked")
```

A literal tuple of a handful of constants is the idiomatic membership test. A tuple of
thousands of items checked inside a loop is the nested-loop mistake with better manners.

## Equality, not type: `1`, `1.0` and `True` are one value

Every search operation above compares with `==`, and `bool` is a subtype of `int`:

> *"The Boolean type is a subtype of the integer type, and Boolean values behave like the values
> 0 and 1, respectively, in almost all contexts"* —
> [Booleans](https://docs.python.org/3.14/reference/datamodel.html#booleans)

So in a tuple of mixed flags and counts:

```python
row = (1, True, 1.0, 0, False)

row.count(True)        # 3 — 1, True and 1.0 are all == True
row.index(False)       # 3 — the 0 comes first
0 in (False,)          # True
```

That is the same fact [3b](03b-what-a-hash-value-is-not.md) shows for dict keys, where `1`, `1.0`
and `True` collapse into one key. When the *type* matters, say so:

```python
flags_set = sum(1 for v in row if v is True)
first_false = next(i for i, v in enumerate(row) if v is False)
```

## Gotchas

**★ Symptom: `row.count(True)` reports more `True`s than the row contains.** Cause: `count`
compares with `==`, and `1 == True` and `1.0 == True` — `bool` is a subtype of `int`. Fix: test
identity when you mean the `bool` singleton.

```python
true_flags = sum(1 for v in row if v is True)
```

**★ Symptom: an `if x in ALLOWED:` inside a per-request loop dominates the profile.** Cause:
`ALLOWED` is a large tuple, and membership on a tuple is a linear scan — *O(n)* per test in the
3.14 cost table. Fix: a `frozenset` built once, which answers membership by hash.

```python
ALLOWED = frozenset(load_allowed_ids())
```

**★ Symptom: `AttributeError: 'tuple' object has no attribute 'sort'`.** Cause: `sort` is a
mutable-sequence method; tuples have none. Fix: `sorted()` returns a new list; convert back if a
tuple is required.

```python
ordered = tuple(sorted(scores, reverse=True))
```

**Symptom: `ValueError: tuple.index(x): x not in tuple` on input that is legitimately
optional.** Cause: `index` raises when the value is absent — the message is CPython's, from
`Objects/tupleobject.c` — and tuples have no `find`. Fix: check
membership first, or catch the error at the point where absence is meaningful.

```python
position = STAGES.index(stage) if stage in STAGES else None
```

**Symptom: the second occurrence of a duplicated column name is never found.** Cause: `index`
returns the *first* match. Fix: pass `start` — the docs note it searches *"without copying any
data"*.

```python
first = HEADER.index("email")
second = HEADER.index("email", first + 1)
```

**Symptom: `reversed(t)[0]` raises `TypeError`.** Cause: `reversed` returns an iterator, not a
tuple, and iterators are not subscriptable. Fix: slice for a reversed tuple, or index from the
end.

```python
last = t[-1]
backwards = t[::-1]              # a new tuple
```

## Interview questions

**★ What methods does a tuple have, and why so few?**
Two of its own: `count` and `index`. Everything else is a common sequence operation (`in`, `+`,
`*`, indexing, slicing, `len`, `min`, `max`) or the one extra the immutable sequences add,
`hash()`. The mutable-sequence methods are absent because every one of them changes the object,
and a tuple's contract is that the collection of references it holds never changes. The small
surface is the point — it is what lets a tuple be a dict key and be shared without a lock.

**★ What does `x in some_tuple` actually do?**
The reference defines it for tuples as `any(x is e or x == e for e in y)`: a scan from the front
that stops at the first item that is either the same object or equal. It is linear in the length
of the tuple, which the 3.14 cost table confirms, and the identity check means a NaN is found in
a tuple that contains that same NaN object. For repeated membership tests on more than a handful
of items, a `frozenset` is the right structure.

**Why does `(1, True, 1.0).count(True)` return 3?**
Because `count` counts items equal to the argument, and all three are equal to `True`: `bool` is a
subclass of `int`, `True == 1`, and `1 == 1.0`. Type does not enter the comparison. The same fact
makes `1`, `1.0` and `True` a single dict key, since equal numbers must have equal hashes. When
only the literal `True` should count, test identity, `v is True`, which is safe because `True`
and `False` are the only two `bool` objects.

**How do you find the second occurrence of a value in a tuple?**
`t.index(value, t.index(value) + 1)`. The optional *start* argument begins the search at that
position, and the documentation notes it is equivalent to searching a slice *"only without
copying any data"*. Both calls raise `ValueError` if there is no such occurrence, which is
usually the right behaviour for data that is supposed to contain it.

**Why does `sorted(t)` return a list rather than a tuple?**
Because `sorted` is a general built-in that accepts any iterable — a generator, a set, a dict —
and it always returns a new list. It has no notion of "the input's type". A tuple has no `sort`
method at all, since sorting in place is a mutation. When the result must be a tuple — a cache
key, a frozen record field — wrap it: `tuple(sorted(t))`.

---

← [Sort keys and priority queues](09b-sort-keys-and-priority-queues.md) · [Topic index](README.md) · Next → [What operations cost](10b-what-operations-cost.md)
