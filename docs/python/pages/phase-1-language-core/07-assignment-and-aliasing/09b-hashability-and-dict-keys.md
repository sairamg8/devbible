---
title: "A hash value must never change during an object's lifetime, so a mutable object used as a dict key becomes unfindable the moment somebody mutates it"
sidebar_label: "9b · Hashability and dict keys"
sidebar_position: 89
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09 against the Python 3.14
> [glossary — hashable](https://docs.python.org/3.14/glossary.html#term-hashable),
> [`hash()`](https://docs.python.org/3.14/library/functions.html#hash),
> [`object.__hash__`](https://docs.python.org/3.14/reference/datamodel.html#object.__hash__),
> [`dataclasses`](https://docs.python.org/3.14/library/dataclasses.html),
> and [`functools.lru_cache`](https://docs.python.org/3.14/library/functools.html#functools.lru_cache).
> Target: **CPython 3.14**.

**The glossary's definition of hashable contains the entire failure mode in its
first clause: an object is hashable *"if it has a hash value which never
changes during its lifetime"*. A dict stores a key in the bucket its hash
selects and never re-checks it. Mutate a key so its hash changes and the entry
is still in the dict — iterating finds it — but a lookup computes the new hash,
goes to the wrong bucket, and reports `KeyError`. Nothing raises at the moment
of the mistake, which is why this bug is diagnosed by staring at a dict that
visibly contains a key it says it does not have.**

## The definition and the rule

> *"An object is hashable if it has a hash value which never changes during its
> lifetime (it needs a `__hash__()` method), and can be compared to other
> objects (it needs an `__eq__()` method). Hashable objects which compare equal
> must have the same hash value."*

> *"Most of Python's immutable built-in objects are hashable; mutable
> containers (such as lists or dictionaries) are not; immutable containers
> (such as tuples and frozensets) are only hashable if their elements are
> hashable. Objects which are instances of user-defined classes are hashable by
> default. They all compare unequal (except with themselves), and their hash
> value is derived from their `id()`."*

And the data model's instruction to class authors:

> *"If a class defines mutable objects and implements an `__eq__()` method, it
> should not implement `__hash__()`, since the implementation of hashable
> collections requires that a key's hash value is immutable (if the object's
> hash value changes, it will be in the wrong hash bucket)."*

That parenthetical is the mechanism, stated by the language reference itself.

## The bug, in full

```python
@dataclass(eq=True, frozen=False)
class Tag:
    name: str
    def __hash__(self):          # explicitly re-added; dataclass had set it to None
        return hash(self.name)

t = Tag("urgent")
index = {t: [1, 2, 3]}

t.name = "critical"              # the object is a key AND it just changed

index[t]                         # KeyError: Tag(name='critical')
t in index                       # False
list(index)                      # [Tag(name='critical')] — it is right there
len(index)                       # 1
```

Nothing is corrupted in the sense of memory; the entry sits in the bucket for
`hash("urgent")` while every lookup now computes `hash("critical")`. The
dictionary is, from the outside, both containing and not containing the key.
Rehashing does not fix it — a resize re-inserts using the *current* hash of the
stored key object, which will move it to the new correct bucket only by
accident of when the resize happens.

Built-in mutable types are exempt because Python refuses up front:

```python
{[1, 2]: "x"}      # TypeError: unhashable type: 'list'
{{"a": 1}: "x"}    # TypeError: unhashable type: 'dict'
{ {1, 2}: "x" }    # TypeError: unhashable type: 'set'
```

The exposure is entirely in **user-defined classes**, because they are hashable
by default and their author can define `__hash__` over mutable fields.

## What Python does for you, and where it stops

The data model:

> *"If a class does not define an `__eq__()` method it should not define a
> `__hash__()` operation either; if it defines `__eq__()` but not
> `__hash__()`, its instances will not be usable as items in hashable
> collections."*

So defining `__eq__` on a plain class sets `__hash__` to `None` automatically,
making instances unhashable — a deliberate safety net, because a custom
`__eq__` almost always compares mutable fields. Dataclasses encode the same
policy:

> *"If eq and frozen are both true, by default `@dataclass` will generate a
> `__hash__()` method for you. If eq is true and frozen is false, `__hash__()`
> will be set to `None`, marking it unhashable (which it is, since it is
> mutable). If eq is false, `__hash__()` will be left untouched meaning the
> `__hash__()` method of the superclass will be used."*

Read that table as: **the only combination that gets you a value-based hash is
`eq=True, frozen=True`**, and that is the correct one. Every route to a
mutable-and-hashable object involves you overriding the default — with
`__hash__ = ...`, with `@dataclass(eq=False)`, or with `unsafe_hash=True`,
whose name is the documentation.

If you need to keep a parent's identity-based hash while overriding equality,
the reference gives the incantation:

> *"If a class that overrides `__eq__()` needs to retain the implementation of
> `__hash__()` from a parent class, the interpreter must be told this
> explicitly by setting `__hash__ = <ParentClass>.__hash__`."*

## Equal objects must hash equally — including across types

> *"Numeric values that compare equal have the same hash value (even if they
> are of different types, as is the case for 1 and 1.0)."*

Which produces a collapse people meet in real data:

```python
{1: "a", 1.0: "b", True: "c"}     # ONE entry: key 1, value "c"
```

`1 == 1.0 == True`, so all three hash equally and compare equal; the later
assignments overwrite the value while **keeping the first key object**. Reading
`d[True]` returns `"c"`; iterating shows the key as `1`. If your dict keys come
from JSON or a database and can be `0`/`1`/`False`/`True`, this is a live
hazard — see [`bool` is an `int`](../02-numbers/04-bool-is-an-int.md).

## Making a mutable thing usable as a key

Four options, in order of preference:

1. **Key on an immutable identifier.** `index[tag.id]` rather than
   `index[tag]`. Almost always the right answer, and it makes the lifetime
   question explicit.
2. **Make the object frozen.** `@dataclass(frozen=True, eq=True)` with
   immutable field types, per
   [Immutability is shallow too](09-immutability-is-shallow.md).
3. **Hash on identity deliberately.** Do not define `__eq__`, or define
   `__hash__ = object.__hash__` alongside it, and accept that two equal-looking
   objects are different keys.
4. **Freeze a snapshot into the key.** `key = (tag.name, tag.priority)` —
   a tuple built at insertion time, which cannot change afterwards no matter
   what happens to `tag`.

What you must not do is define `__hash__` over fields you intend to mutate.

## `lru_cache` inherits all of this

> *"Since a dictionary is used to cache results, the positional and keyword
> arguments to the function must be hashable."*

So `@lru_cache` on a function taking a list raises `TypeError: unhashable type:
'list'` at call time, and the usual workaround is to convert at the boundary:

```python
@lru_cache(maxsize=256)
def score(features: tuple[float, ...]) -> float: ...

score(tuple(feature_list))
```

The docs also note that *"Distinct argument patterns may be considered to be
distinct calls with separate cache entries. For example, `f(a=1, b=2)` and
`f(b=2, a=1)` differ in their keyword argument order and may have two separate
cache entries."* — a second, unrelated way the cache key can surprise you.

And a mutable-but-hashable argument creates the same wrong-bucket problem
inside the cache: the entry is stored under the old hash and never hit again,
so the cache silently degrades to zero hit rate and grows without bound. See
[Caches, workers and ORM instances](11c-caches-workers-and-orm.md) for the
mirror-image problem with cached *return* values.

## Gotchas

### A key is in the dict and `d[key]` raises `KeyError`
**Symptom.** `key in d` is `False`, `list(d)` shows the key, `len(d)` counts
it.
**Cause.** The key object was mutated after insertion and its `__hash__`
depends on the mutated field, so lookups search the wrong bucket.
**Fix.** Key on an immutable identifier, or freeze the key type. To recover an
existing dict, rebuild it: `d = {k: v for k, v in d.items()}` re-inserts using
current hashes.

### `unsafe_hash=True` used to "make the dataclass work as a key"
**Symptom.** A dataclass is put in a set, and set membership behaves
erratically after any field is assigned.
**Cause.** `unsafe_hash=True` generates a field-based `__hash__` on a *mutable*
class, which is precisely the configuration the data model warns against.
**Fix.** `frozen=True`, or key on an id field. The parameter's name is the
warning.

### `TypeError: unhashable type: 'dict'` when building a set of records
**Symptom.** Deduplicating a list of dicts fails immediately.
**Cause.** Dicts are mutable and deliberately unhashable.
**Fix.** Key on a chosen field, or freeze:
`frozenset(d.items())` for a flat dict of hashable values, or
`tuple(sorted(d.items()))` if you need an ordered, comparable key. Both break
for nested values, which need a recursive freeze.

### Adding `__eq__` breaks existing set/dict usage
**Symptom.** After adding value equality to a class, `TypeError: unhashable
type` appears everywhere it was used as a key.
**Cause.** Defining `__eq__` without `__hash__` sets `__hash__` to `None`, as
the data model specifies.
**Fix.** Decide deliberately: if the class is immutable, add a matching
`__hash__` over the same fields; if it is mutable, keep it unhashable and key
on an id; if you want the parent behaviour back, `__hash__ =
SomeParent.__hash__`.

### `{1: "a", True: "b"}` collapses to one entry
**Symptom.** A lookup table built from mixed JSON keys is missing entries.
**Cause.** `True == 1` and they hash equally, so the second assignment
overwrites the first's value while keeping the first's key object.
**Fix.** Normalise key types at the boundary — `str(k)` or `int(k)` — and never
mix booleans and integers as keys.

### `lru_cache` on a function taking a dict
**Symptom.** `TypeError: unhashable type: 'dict'` from the decorator, at the
first call.
**Cause.** The cache is a dict; arguments must be hashable.
**Fix.** Convert at the boundary — a tuple of items, a frozenset, a
`NamedTuple` or a frozen dataclass parameter — rather than hashing a mutable
object, which would reintroduce the wrong-bucket failure inside the cache.

### Equal objects with different hashes
**Symptom.** A set contains two objects that compare equal; a dict has two
entries for what should be one key.
**Cause.** `__eq__` and `__hash__` were written over different sets of fields,
violating the glossary's rule that *"Hashable objects which compare equal must
have the same hash value."*
**Fix.** Derive both from the same tuple of fields:
`def __hash__(self): return hash((self.a, self.b))` alongside an `__eq__` over
`(self.a, self.b)`.

## Interview questions

**★ Q: Why can't a list be a dictionary key?**
Because a dict places a key in a bucket chosen by its hash at insertion time
and never revisits that decision. A list is mutable, so its hash could not
remain stable, and the glossary requires a hashable object to have *"a hash
value which never changes during its lifetime"*. Python enforces this by not
giving `list` a `__hash__` at all.

**★ Q: What happens if you use a mutable object as a key and then mutate it?**
The entry stays where it was inserted, but lookups compute the new hash and
probe a different bucket, so `d[key]` raises `KeyError` and `key in d` is
`False` while iteration still yields the key. The data model describes the
cause exactly: *"if the object's hash value changes, it will be in the wrong
hash bucket"*.

**★ Q: You add `__eq__` to a class and it stops working as a set member. Why?**
Defining `__eq__` without `__hash__` sets `__hash__` to `None`, making
instances unhashable. It is a deliberate safeguard, because a value-based
`__eq__` on a mutable class almost always implies a hash that would not be
stable.

**Q: What must be true of `__eq__` and `__hash__` together?**
Objects that compare equal must hash equal — the glossary states it directly.
The converse is not required; unequal objects may collide. In practice, derive
both from the same tuple of fields, and only from fields that do not change.

**Q: Which dataclass configuration gives you a usable value-based hash?**
`eq=True, frozen=True`. With `eq=True, frozen=False` the decorator sets
`__hash__` to `None` because the instance is mutable; with `eq=False` the
superclass's `__hash__` (usually identity-based) is left in place.
`unsafe_hash=True` will generate one for a mutable class, and its name is the
documentation.

**Q: `{1: 'a', 1.0: 'b', True: 'c'}` — how many entries, and what is the key?**
One entry. All three compare equal and, per the `hash()` docs, numeric values
that compare equal hash equal. The first key object is kept and the value ends
up `'c'`, so the dict displays as `{1: 'c'}`.

**Q: How would you use a mutable domain object as a cache key?**
Do not. Key on an immutable identifier it carries (a primary key, a UUID), or
build an immutable snapshot at insertion time — a tuple of the relevant
fields, a `NamedTuple`, or a frozen dataclass. Hashing the live object couples
the cache's correctness to the object's future.

**Q: Why does `functools.lru_cache` reject a list argument?**
Because it stores results in a dictionary keyed by the arguments, and the docs
state that positional and keyword arguments must be hashable. Converting to a
tuple at the call boundary is the standard fix — and it is the right fix,
because it also freezes the key against later mutation.

---

← Prev: [Immutability is shallow too](09-immutability-is-shallow.md) · Index: [Assignment and aliasing](README.md) · Next → [Designing away aliasing](10-designing-away-aliasing.md)
