---
title: "fromkeys shares one value object, dict merges are right-wins, and every key a comprehension produces must be hashable"
sidebar_label: "6b · Merging, fromkeys, hashability"
sidebar_position: 103
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09 against the Python 3.14 Language Reference
> [Dictionary displays](https://docs.python.org/3.14/reference/expressions.html#dictionary-displays),
> [Set displays](https://docs.python.org/3.14/reference/expressions.html#set-displays),
> the Library Reference
> [Mapping Types — dict](https://docs.python.org/3.14/library/stdtypes.html#mapping-types-dict),
> [Set Types](https://docs.python.org/3.14/library/stdtypes.html#set-types-set-frozenset),
> the [Glossary — hashable](https://docs.python.org/3.14/glossary.html#term-hashable),
> and [PEP 448](https://peps.python.org/pep-0448/),
> [PEP 584](https://peps.python.org/pep-0584/),
> [PEP 572](https://peps.python.org/pep-0572/).
> Target: **CPython 3.14**.

**Three things about dict and set comprehensions that are not about collisions.
`dict.fromkeys` looks like a dict comprehension and is not — it evaluates the
value once and shares it, which turns a mutable default into an aliasing bug. A
merge has three spellings with identical semantics and only one reason to pick
the comprehension. And every key a dict comprehension produces, and every element
a set comprehension produces, must be hashable — which is where the most common
`TypeError` from these constructs comes from, and where `1`, `1.0` and `True`
quietly become one element.**

## `dict.fromkeys` and the shared value

`dict.fromkeys(iterable, value)` builds a dict with every key mapped to the same
object. The documentation notes that *value* defaults to `None` and **is shared**
among all keys — so a mutable default is a single object that every key aliases:

```python
dict.fromkeys("abc", [])          # every value is the SAME list
{k: [] for k in "abc"}            # each value is a fresh list
```

Appending to one value of the first dict appends to all of them. This is the
[mutable default argument](../07-assignment-and-aliasing/06-mutable-default-argument.md)
bug in a different costume, and the dict comprehension is the fix because its
value expression is re-evaluated per key.

`fromkeys` is right for immutable values — `dict.fromkeys(keys, 0)`,
`dict.fromkeys(keys)` — and for the deduplicate-preserving-order idiom, where the
values are irrelevant:

```python
list(dict.fromkeys(items))        # dedupe, order preserved
list(set(items))                  # dedupe, order NOT preserved
```

That is the standard answer to "deduplicate a list but keep the order", and it
works because dictionaries preserve insertion order.

## `{**a, **b}` versus a dict comprehension versus `|`

Three ways to merge, and they are not interchangeable:

```python
{**a, **b}                              # merge, b wins on conflict
a | b                                   # same, since 3.9 (PEP 584)
{k: v for d in (a, b) for k, v in d.items()}    # same, more typing
{k: f(v) for k, v in {**a, **b}.items()}        # merge AND transform
```

Use `|` or `{**a, **b}` when you are only merging — they are clearer and they do
not invite a reader to check for a hidden filter. Reach for the comprehension
only when the keys or values are being transformed as well, which is the one
thing the other two cannot do.

## Key and value evaluation order

Since 3.8 the order is defined, and the reference records the change:

> *"Prior to Python 3.8, in dict comprehensions, the evaluation order of key and
> value was not well-defined. In CPython, the value was evaluated before the key.
> Starting with 3.8, the key is evaluated before the value, as proposed by
> PEP 572."*

This matters only when both expressions have side effects or share a walrus —
`{(k := norm(x)): score(k) for x in xs}` works because the key is evaluated
first. Relying on it is still a bad idea, but knowing the rule is how you read
someone else's code that does.

## Set comprehensions and hashability

A set comprehension deduplicates by hash and equality, which means it silently
merges elements you consider distinct if they compare equal:

```python
{round(x, 2) for x in measurements}     # near-duplicates collapse
{1, 1.0, True}                          # a single element — they are all equal
```

That last one is the `bool`-is-an-`int` consequence; see
[bool is an int](../02-numbers/04-bool-is-an-int.md). And unhashable elements
raise rather than collapsing:

```python
{tuple(row) for row in rows}            # fine — tuples hash
{list(row) for row in rows}             # TypeError: unhashable type: 'list'
```

The same applies to dict comprehension *keys*, and it is the most common
`TypeError` from a dict comprehension: a key expression that produced a list or a
dict.

## Gotchas

**★ Symptom — every value in a dict built with `dict.fromkeys(keys, [])` changes
when you append to one.** Cause: the documentation states the value *"is shared"*
among all keys — it is one object, evaluated once. Fix: `{k: [] for k in keys}`,
whose value expression is evaluated per key.

**★ Symptom — `TypeError: unhashable type: 'list'` from a dict or set
comprehension.** Cause: the key or element expression produced a mutable object;
the reference requires the key type to be hashable, *"which excludes all mutable
objects"*. Fix: convert to a tuple (`tuple(row)`), or a `frozenset` for an
unordered key, or key on an immutable field rather than the whole object.

**★ Symptom — a set comprehension over numbers loses elements you expected to
keep, and `{1, 1.0, True}` has one member.** Cause: those three are equal and
hash equally, so the set keeps whichever arrived first. Fix: key the set on
something that distinguishes them — `{(type(x).__name__, x) for x in xs}` — or
use a list if multiplicity or type matters. See
[bool is an int](../02-numbers/04-bool-is-an-int.md).

**Symptom — a merge written as `{**a, **b}` produced `b`'s values where you
wanted `a`'s.** Cause: later unpackings replace earlier ones, by definition —
the reference says *"Later values replace values already set by earlier dict
items and earlier dictionary unpackings"*. Fix: swap the order, `{**b, **a}`,
rather than adding a filter.

**Symptom — `a | b` raises `TypeError` where `{**a, **b}` worked.** Cause: `|` is
defined for `dict` operands; `**` unpacking accepts any *mapping*. Fix: use
`{**a, **b}` for arbitrary mappings, or convert with `dict(m)` first.

**Symptom — `dict.fromkeys(keys)` produced `None` values and downstream code
crashed on them.** Cause: the value parameter defaults to `None`. Fix: pass the
value you want — `dict.fromkeys(keys, 0)` — or use a comprehension if the value
depends on the key.

**Symptom — a dedupe via `set()` reordered the data and a test comparing lists
started failing intermittently.** Cause: a set has no ordering guarantee. Fix:
`list(dict.fromkeys(items))`, which preserves first-seen order because dicts
preserve insertion order.

**Symptom — a set comprehension over dataclass instances keeps duplicates you
expected it to merge.** Cause: the class defines `__eq__` without `__hash__`, in
which case it is unhashable and would raise, or it uses the default
identity-based hash and equality, in which case distinct-but-equal objects are
distinct. Fix: `@dataclass(frozen=True)` gives you both consistently — see
[`__eq__`, `__hash__` and the contract](../06-comparisons/02c-ne-hash-and-the-contract.md).

**Symptom — a walrus in a dict comprehension's *value* is not visible in the
key.** Cause: since 3.8 the key is evaluated before the value, so a name bound in
the value expression does not exist yet when the key runs. Fix: put the walrus in
the key — `{(k := norm(x)): score(k) for x in xs}` — which is the order PEP 572
established.

**Symptom — `{**a, **b}` on two large dicts is slower than expected in a hot
path.** Cause: it builds a third dict and copies every item from both. Fix: if
`a` is disposable, mutate it — `a.update(b)`, or `a |= b` since 3.9 — which
copies only `b`'s items.

## Interview questions

**★ Q: `dict.fromkeys(keys, [])` versus `{k: [] for k in keys}` — what is the
difference?**
`fromkeys` evaluates the value once and shares that one object across every key,
which the documentation states explicitly, so mutating one value mutates them
all. The dict comprehension evaluates the value expression per key and gives each
one a fresh list. `fromkeys` is correct only for immutable values, or when the
values do not matter — as in `list(dict.fromkeys(items))` for order-preserving
deduplication.

**★ Q: How do you deduplicate a list while preserving order?**
`list(dict.fromkeys(items))`. Dictionaries preserve insertion order, so the keys
come out in first-seen order; `set` gives no ordering guarantee at all. It
requires the items to be hashable, exactly as a set would, and it is one of the
few places `fromkeys` is the clearest tool for the job.

**★ Q: `{**a, **b}`, `a | b`, or a dict comprehension — which and when?**
`{**a, **b}` or `a | b` (3.9, PEP 584) when you are only merging: both are
shorter and both say "merge". The comprehension only when you are also
transforming the keys or values, which neither of the others can do. All three
are right-wins on conflict, by the same documented rule about later values
replacing earlier ones. `**` accepts any mapping; `|` requires dicts.

**Q: Which is evaluated first in a dict comprehension, the key or the value?**
The key, since 3.8, by PEP 572. Before that CPython evaluated the value first and
the reference describes the earlier order as *"not well-defined"*. It matters
only when one expression has a side effect the other depends on — typically a
walrus in the key that the value reads.

**Q: Why does `{tuple(row) for row in rows}` work when `{list(row) ...}` does
not?**
Because set elements and dict keys must be hashable, and the glossary's
definition excludes mutable objects. A tuple of hashable items is hashable; a
list never is, because its hash would change as it is mutated and it would go
missing from the set it lives in.

**Q: Can a dict comprehension key be a tuple?**
Yes, and it is the standard way to build a composite-key index —
`{(r.year, r.month): r for r in rows}`. It needs no extra parentheses in the
dict form because the colon disambiguates; in a *list* comprehension a tuple
element expression does need them.

**Q: What is the relationship between this and the mutable-default-argument
bug?**
It is the same bug. A default argument is evaluated once at function definition
and shared by every call; `fromkeys`'s value is evaluated once and shared by
every key. Both are "one object where the reader assumed one per use", and both
are fixed by moving the construction inside the per-use expression.

---

← Prev: [Dict and set comprehensions](06-dict-and-set-comprehensions.md) · Index: [Comprehensions](README.md) · Next → [Performance](07-performance.md)
