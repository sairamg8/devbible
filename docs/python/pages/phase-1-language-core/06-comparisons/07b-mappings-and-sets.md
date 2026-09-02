---
title: "dict supports only == and !=, set overloads < and <= to mean subset, and a partial order is why not (a < b) does not imply a >= b"
sidebar_label: "7b · Mappings and sets"
sidebar_position: 75
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09 against the Python 3.14 language reference
> [Value comparisons](https://docs.python.org/3.14/reference/expressions.html#value-comparisons),
> the library reference on
> [Set Types](https://docs.python.org/3.14/library/stdtypes.html#set-types-set-frozenset),
> [Dictionary view objects](https://docs.python.org/3.14/library/stdtypes.html#dictionary-view-objects)
> (verified against
> [`Doc/library/stdtypes.rst`](https://github.com/python/cpython/blob/3.14/Doc/library/stdtypes.rst)),
> and [`collections.Counter`](https://docs.python.org/3.14/library/collections.html#collections.Counter).
> Version spine: **CPython 3.14**.

**`set` is the one built-in type where `<` does not mean "less than". It means
"proper subset", and subset is a *partial* order — two sets can be unequal, with
neither smaller nor larger than the other. Every intuition trained on total orders
fails there: `not (a < b)` does not imply `a >= b`, `sorted()` on a list of sets
produces a documented "undefined result" without raising, and `max()` returns
something meaningless. `dict`, meanwhile, refuses ordering outright and only answers
`==`.**

## `dict`: equality only

> *"Mappings (instances of `dict`) compare equal if and only if they have equal
> `(key, value)` pairs. Equality comparison of the keys and values enforces
> reflexivity."*
>
> *"Order comparisons (`<`, `>`, `<=`, and `>=`) raise `TypeError`."* —
> [Value comparisons](https://docs.python.org/3.14/reference/expressions.html#value-comparisons)

```python
{"a": 1, "b": 2} == {"b": 2, "a": 1}     # True — insertion order is irrelevant
{"a": 1} < {"a": 1, "b": 2}              # TypeError
```

**Insertion order is not part of equality.** `dict` has preserved insertion order
since 3.7 and it affects iteration, `repr`, `list(d)` and JSON serialisation — but
never `==`. If you need order-sensitive comparison, compare `list(d.items())`.

"Enforces reflexivity" is the identity-first shortcut of [06](06-nan-and-the-protocol.md):
a `dict` whose value is a NaN compares equal to another `dict` holding the *same* NaN
object.

There is no ordering to be had here even in principle — what would it mean for one
mapping to be less than another? — so `TypeError` is the honest answer rather than a
gap.

## `dict` views *are* set-like, and they compare

This is the useful part people miss:

> *"Keys views are set-like since their entries are unique and hashable. Items views
> also have set-like operations since the (key, value) pairs are unique and the keys
> are hashable. If all values in an items view are hashable as well, then the items
> view can interoperate with other sets. (Values views are not treated as set-like
> since the entries are generally not unique.) For set-like views, all of the
> operations defined for the abstract base class `collections.abc.Set` are available
> (for example, `==`, `<`, or `^`). While using set operators, set-like views accept
> any iterable as the other operand, unlike sets which only accept sets as the
> input."* —
> [Dictionary view objects](https://github.com/python/cpython/blob/3.14/Doc/library/stdtypes.rst)

So:

```python
required = {"id", "name", "email"}
required <= payload.keys()        # every required key present — no allocation
payload.keys() - required         # unexpected keys
config.items() <= defaults.items()   # every config entry matches a default
                                     # (needs hashable values)
d.values() < other.values()          # TypeError-ish: values views are not set-like
```

`required <= payload.keys()` is the idiomatic "are all required keys present" check
and it is better than `all(k in payload for k in required)` because it reads as the
mathematical statement it is. Note the direction: subset on the left.

The last sentence of the quote is a real asymmetry: `payload.keys() | ["a", "b"]`
works (a view accepts any iterable), while `{"x"} | ["a", "b"]` raises `TypeError` (a
set does not).

## `set`: `<` means subset

> *"Sets (instances of `set` or `frozenset`) can be compared within and across their
> types. They define order comparison operators to mean subset and superset tests.
> Those relations do not define total orderings (for example, the two sets `{1,2}` and
> `{2,3}` are not equal, nor subsets of one another, nor supersets of one another).
> Accordingly, sets are not appropriate arguments for functions which depend on total
> ordering (for example, `min()`, `max()`, and `sorted()` produce undefined results
> given a list of sets as inputs)."* —
> [Value comparisons](https://docs.python.org/3.14/reference/expressions.html#value-comparisons)

The operator table, from the set types documentation:

| Operator | Method | Meaning |
|---|---|---|
| `s <= t` | `s.issubset(t)` | *"Test whether every element in the set is in other."* |
| `s < t` | — | *"Test whether the set is a proper subset of other, that is, `set <= other and set != other`."* |
| `s >= t` | `s.issuperset(t)` | *"Test whether every element in other is in the set."* |
| `s > t` | — | *"Test whether the set is a proper superset of other, that is, `set >= other and set != other`."* |
| — | `s.isdisjoint(t)` | *"Return `True` if the set has no elements in common with other."* |

And the operator/method asymmetry, verbatim:

> *"Note, the non-operator versions of `union()`, `intersection()`, `difference()`,
> `symmetric_difference()`, `issubset()`, and `issuperset()` methods will accept any
> iterable as an argument. In contrast, their operator based counterparts require
> their arguments to be sets. This precludes error-prone constructions like `set('abc')
> & 'cbs'` in favor of the more readable `set('abc').intersection('cbs')`."* —
> [Set Types](https://docs.python.org/3.14/library/stdtypes.html#set-types-set-frozenset)

```python
{1, 2}.issubset([1, 2, 3])      # True  — method takes any iterable
{1, 2} <= [1, 2, 3]             # TypeError — operator requires a set
```

## The partial-order trap

This is the consequence worth memorising:

```python
a, b = {1, 2}, {2, 3}

a == b        # False
a < b         # False
b < a         # False
a <= b        # False
a >= b        # False
```

**Every one of them is false.** For a total order, `not (a < b)` implies `a >= b`; for
a partial order it does not, and the reference's consistency rule 4 explicitly limits
itself to *"totally ordered collections (e.g. to sequences, but not to sets or
mappings)"*.

Practical fallout:

- **`if not (a < b): ...` is not "a is at least b".** Write the condition you mean:
  `a.issuperset(b)`, `a == b`, `a.isdisjoint(b)`.
- **`sorted(list_of_sets)` does not raise and does not sort.** The docs say `min()`,
  `max()` and `sorted()` *"produce undefined results"* on sets. Timsort will call `<`,
  get `False` in both directions, treat the elements as equal, and — being stable —
  leave them in input order. You get a plausible-looking list that means nothing.
- **`max(list_of_sets)` returns an arbitrary set.** Sort by an explicit key instead:
  `max(sets, key=len)`, or `sorted(sets, key=lambda s: sorted(s))`.

## `set` and `frozenset` compare across their types

```python
{1, 2} == frozenset({1, 2})      # True
{1, 2} <= frozenset({1, 2, 3})   # True
hash(frozenset({1, 2}))          # fine; hash({1,2}) raises — set is unhashable
```

The reference says sets can be compared *"within and across their types"*, and
`frozenset` hashes to match. So a `set` and a `frozenset` with the same members are
equal but only one of them can be a dict key — and `{frozenset({1,2}): "x"}[{1,2}]`
raises `TypeError` because the *lookup key* has to be hashable, not because it is
unequal.

## `Counter`: a multiset with the same shape

Since 3.10, `Counter` has the same partial-order structure over multisets:

> *"Counters support rich comparison operators for equality, subset, and superset
> relationships: `==`, `!=`, `<`, `<=`, `>`, `>=`. All of those tests treat missing
> elements as having zero counts so that `Counter(a=1) == Counter(a=1, b=0)` returns
> true."*
>
> *"Changed in version 3.10: Rich comparison operations were added."*
>
> *"Changed in version 3.10: In equality tests, missing elements are treated as having
> zero counts. Formerly, `Counter(a=3)` and `Counter(a=3, b=0)` were considered
> distinct."* —
> [`collections.Counter`](https://docs.python.org/3.14/library/collections.html#collections.Counter)

Two upgrade notes hide there. `Counter` is a `dict` subclass, so before 3.10 `<` raised
`TypeError` (inherited from `dict`) and now it silently means "subset" — code that
relied on the exception is now taking a branch. And the equality change means
`Counter(a=3) == Counter(a=3, b=0)` flipped from `False` to `True` in 3.10.

## Gotchas

**★ `{"a": 1} < {"a": 1, "b": 2}` raising `TypeError`.** `dict` supports only `==` and
`!=`; ordering is documented to raise. Fix: `d1.items() <= d2.items()` if you meant
"every entry of d1 is in d2" (values must be hashable), or
`d1.keys() <= d2.keys()` for keys only.

**★ `sorted(list_of_sets)` returning a plausible order that means nothing.** Subset is
a partial order, and the docs say `min`, `max` and `sorted` produce undefined results
on sets. Nothing raises. Fix: always pass an explicit `key=` — `key=len`,
`key=sorted`, `key=frozenset` — so a total order actually exists.

**★ `if not (a < b):` read as "a is a superset of b".** For a partial order both
`a < b` and `b < a` can be false. Fix: say what you mean —
`a.issuperset(b)`, `a.isdisjoint(b)`, or `a == b`.

**★ `{1, 2} <= [1, 2, 3]` raising `TypeError` while `.issubset([1,2,3])` works.** The
operator forms require sets; the method forms accept any iterable. The docs say this
is deliberate, to preclude constructions like `set('abc') & 'cbs'`. Fix: use the
method when the other operand is not already a set.

**★ Two dicts comparing equal despite different key order, breaking a test that meant
to check order.** Insertion order is preserved but is not part of `==`. Fix: compare
`list(d.items())`.

**★ `{"x": [1]} == {"x": [1]}` working while `{"x": [1]}` cannot go in a set.**
Equality of dict *values* has no hashability requirement; membership of a hashed
container does. Fix: `frozenset`/`tuple` the values if the dict itself must be
hashable — or use a `frozendict` from a library, since the standard library has none.

**★ `Counter(a=3) == Counter(a=3, b=0)` changing answer between 3.9 and 3.10.** The
3.10 release made missing elements count as zero in equality tests. Fix: normalise
with `+Counter(...)` (unary plus drops non-positive counts) before comparing if you
need version-stable behaviour.

**★ `counter1 < counter2` silently succeeding on 3.10+ where it used to raise.**
`Counter` gained rich comparisons meaning multiset subset. Code that caught the old
`TypeError` now takes a different branch. Fix: audit any `try: ... except TypeError`
around Counter comparisons on upgrade.

**★ `{1, 2} == frozenset({1, 2})` being `True` and someone concluding they are
interchangeable.** They compare equal and hash compatibly, but only `frozenset` is
hashable, so only it can be a dict key or a set member. Fix: freeze at the boundary
where the value enters a hashed container.

**★ `d.values() & other` raising.** Values views are explicitly not set-like, because
their entries are generally not unique. Fix: `set(d.values()) & other`, accepting the
allocation and the deduplication that comes with it.

**★ A "do these two configs match" check written as `a <= b` on sets of keys, missing
the values entirely.** Fix: `a.items() <= b.items()` — but note it requires hashable
values, so a config with list values needs a different comparison.

## Interview questions

**★ Q: What does `<` mean for sets?**
Proper subset — the docs define `set < other` as `set <= other and set != other`.
Sets overload the four ordering operators to mean subset and superset tests, not
ordering, and the reference notes that these relations do not define total orderings.

**★ Q: For sets `a = {1,2}` and `b = {2,3}`, what are `a == b`, `a < b` and `b < a`?**
All three are `False`. That is the definition of a partial order: neither set contains
the other and they are not equal. It also means `not (a < b)` does not imply
`a >= b`, which is the assumption most code accidentally makes.

**★ Q: What does `sorted()` do with a list of sets?**
Something undefined. The reference says explicitly that sets are not appropriate
arguments for functions depending on total ordering, and that `min()`, `max()` and
`sorted()` produce undefined results given a list of sets. It does not raise: `<`
returns `False` in both directions, the sort treats the elements as equal, and
stability leaves them in input order. Always pass an explicit `key=`.

**★ Q: Can you compare two dicts with `<`?**
No — `TypeError`. `dict` supports only `==` and `!=`, defined as having equal
`(key, value)` pairs. If you want a containment relation, use the views:
`d1.items() <= d2.items()` (requires hashable values) or `d1.keys() <= d2.keys()`.

**Q: Does dict equality care about insertion order?**
No. Order is preserved since 3.7 and affects iteration, `repr` and serialisation, but
`==` is defined purely by the set of `(key, value)` pairs. Compare `list(d.items())`
if order matters.

**Q: Why does `{1,2}.issubset([1,2,3])` work when `{1,2} <= [1,2,3]` does not?**
The documentation says the non-operator versions accept any iterable while the
operator versions require sets, and gives the motivation: it precludes error-prone
constructions like `set('abc') & 'cbs'`, where the string would be silently treated as
a set of characters.

**Q: Which dictionary views are set-like?**
`keys()` always, because keys are unique and hashable. `items()` has set-like
operations because the pairs are unique and the keys are hashable, and it can
interoperate with other sets when the *values* are hashable too. `values()` is not
set-like, because the entries are generally not unique.

**Q: What changed about `Counter` comparison in 3.10?**
Rich comparison operators were added, giving `<`, `<=`, `>`, `>=` multiset
subset/superset meaning — previously they raised `TypeError` from `dict`. And equality
began treating missing elements as zero counts, so `Counter(a=3) == Counter(a=3, b=0)`
changed from `False` to `True`.

**Q: Are a `set` and a `frozenset` with the same members equal?**
Yes — the reference says sets can be compared within and across their types, and their
hashes are compatible. They are not interchangeable, though: only `frozenset` is
hashable, so only it can be a dict key or an element of another set.

---

← Prev: [Sequences and strings](07-sequences-and-strings.md) · Index: [Comparisons](README.md) · Next → [Sorting](08-sorting.md)
