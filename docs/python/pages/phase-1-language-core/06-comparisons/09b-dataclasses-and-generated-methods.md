---
title: "dataclass(order=True) compares the class as a tuple of its fields in declaration order, which makes reordering a field body a silent behavioural change"
sidebar_label: "9b · Dataclasses"
sidebar_position: 80
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09 against the Python 3.14
> [`dataclasses`](https://docs.python.org/3.14/library/dataclasses.html)
> (`eq`, `order`, `frozen`, `unsafe_hash`, and `field()`'s `compare` and `hash`),
> the [data model](https://docs.python.org/3.14/reference/datamodel.html#object.__hash__),
> and [`typing.NamedTuple`](https://docs.python.org/3.14/library/typing.html#typing.NamedTuple).
> Version spine: **CPython 3.14**.

**`@dataclass` generates comparison methods from the field list, and every one of its
knobs is a decision you would otherwise have made by hand: `eq` controls equality and
therefore hashability, `order` controls whether the class is sortable at all, `frozen`
is what turns the class back into something a `set` will accept, and
`field(compare=False)` is how you keep a payload out of a comparison that would
otherwise raise on ties. The rule that catches people is that field *declaration
order* is the sort order — a cosmetic reshuffle changes behaviour with no error.**

## `@dataclass`: `eq`, `order`, `frozen`

> *"eq: If true (the default), an `__eq__()` method will be generated. This method
> compares the class by comparing each field in order. Both instances in the comparison
> must be of the identical type. If the class already defines `__eq__()`, this parameter
> is ignored."*
>
> *"order: If true (the default is `False`), `__lt__()`, `__le__()`, `__gt__()`, and
> `__ge__()` methods will be generated. These compare the class as if it were a tuple
> of its fields, in order. Both instances in the comparison must be of the identical
> type. If order is true and eq is false, a `ValueError` is raised. If the class already
> defines any of `__lt__()`, `__le__()`, `__gt__()`, or `__ge__()`, then `TypeError` is
> raised."* —
> [`dataclasses`](https://docs.python.org/3.14/library/dataclasses.html)

```python
@dataclass(order=True)
class Version:
    major: int
    minor: int
    patch: int

sorted([Version(1, 10, 0), Version(1, 2, 0)])   # 1.2.0 before 1.10.0 — numeric fields
```

**Field declaration order is the sort order.** Reordering the fields in the class body
— a change that looks purely cosmetic and that a formatter or a reviewer might suggest
— silently changes every comparison in the program. That is the single biggest hazard
of `order=True`, and there is no warning.

"Both instances must be of the identical type" means the generated methods check
`other.__class__ is self.__class__`. Against a different class they return
`NotImplemented`, so `==` falls back to identity (i.e. `False`) and ordering raises
`TypeError` — a subclass therefore does **not** compare with its base, which is the
right default and surprises people who expected `isinstance` semantics.

Two error modes to remember: `order=True, eq=False` raises `ValueError` at class
creation, and `order=True` on a class that already defines any ordering method raises
`TypeError`. Both fire at import time, which is the good kind of failure.

## `field(compare=False)` and `field(hash=...)`

> *"compare: If true (the default), this field is included in the generated equality
> and comparison methods (`__eq__()`, `__gt__()`, et al.)."* —
> [`dataclasses.field`](https://docs.python.org/3.14/library/dataclasses.html#dataclasses.field)

This is the control you need constantly, because most real records carry fields that
are *data about the record* rather than *the record's identity*:

```python
@dataclass(order=True)
class Task:
    priority: int
    created_at: datetime
    payload: dict = field(compare=False)      # not orderable, not identity
    trace_id: str = field(compare=False)      # incidental
```

Without `compare=False`, `payload` would be reached whenever `priority` and
`created_at` tie — and `dict` supports no ordering, so the comparison raises
`TypeError` on exactly the ties. That is the `heapq` bug of
[08c](08c-min-max-heapq-bisect-groupby.md) wearing a dataclass.

The `hash` parameter, and the docs' own advice about it:

> *"hash: This can be a bool or `None`. If true, this field is included in the generated
> `__hash__()` method. If false, this field is excluded from the generated `__hash__()`.
> If `None` (the default), use the value of compare: this would normally be the expected
> behavior, since a field should be included in the hash if it's used for comparisons.
> **Setting this value to anything other than `None` is discouraged.**"*
>
> *"One possible reason to set `hash=False` but `compare=True` would be if a field is
> expensive to compute a hash value for, that field is needed for equality testing, and
> there are other fields that contribute to the type's hash value. Even if a field is
> excluded from the hash, it will still be used for comparisons."*

Leave it at `None`. `compare=False` already removes the field from both, which is
almost always what you want.

## The `__hash__` table

The rules, verbatim, because getting them from memory is how people end up with
`unsafe_hash=True`:

> *"If eq and frozen are both true, by default `@dataclass` will generate a `__hash__()`
> method for you. If eq is true and frozen is false, `__hash__()` will be set to `None`,
> marking it unhashable (which it is, since it is mutable). If eq is false, `__hash__()`
> will be left untouched meaning the `__hash__()` method of the superclass will be used
> (if the superclass is `object`, this means it will fall back to id-based hashing)."*

| `eq` | `frozen` | `__hash__` |
|---|---|---|
| `True` (default) | `True` | generated from the compared fields — **hashable** |
| `True` (default) | `False` (default) | set to `None` — **unhashable** |
| `False` | either | untouched; inherited (identity hash from `object`) |

So the default `@dataclass` is unhashable, and `@dataclass(frozen=True)` is the way to
get a value object you can put in a `set` or use as a dict key. This is exactly the
`__eq__`-removes-`__hash__` rule of [02c](02c-ne-hash-and-the-contract.md), applied
automatically.

`unsafe_hash=True` forces a hash onto a mutable class. The docs are blunt about it:

> *"Although not recommended, you can force `@dataclass` to create a `__hash__()`
> method with unsafe_hash=True. This might be the case if your class is logically
> immutable but can still be mutated. This is a specialized use case and should be
> considered carefully."*

"Logically immutable but can still be mutated" is a narrow doorway. Almost every use
of `unsafe_hash=True` in the wild is someone who wanted `frozen=True` and did not want
to stop assigning to fields.

## The 3.13 `__eq__` change

> *"Changed in version 3.13: The generated `__eq__` method now compares each field
> individually (for example, `self.a == other.a and self.b == other.b`), rather than
> comparing tuples of fields as in previous versions. This change makes the comparison
> faster but it may alter results in cases where attributes compare equal by identity
> but not by value (such as `float('nan')`)."*

Faster because it short-circuits at the first unequal field without building two
tuples. The behavioural change is the NaN case, covered in
[06](06-nan-and-the-protocol.md). Note the ordering methods were *not* changed by
this — they still compare as tuples, so a dataclass holding a NaN can be `!=` to
itself while `<=` to itself, which is the reflexivity break the reference warned
about.

## The alternatives, briefly

- **`typing.NamedTuple` / `collections.namedtuple`** get ordering free, because they
  *are* tuples — lexicographic by field order, comparing equal to plain tuples with
  the same contents. That last part is a trap: `Point(1, 2) == (1, 2)` is `True`,
  which a dataclass would refuse.
- **`enum.Enum`** has no ordering. `IntEnum` orders by value because it is an `int`;
  for a plain `Enum` that needs ordering, give it an explicit `__lt__` over a rank
  attribute rather than reaching for `total_ordering` on an enum, whose metaclass
  makes the interaction subtle.
- **`attrs`** offers `@define(order=True)` with the same field-order semantics and
  per-field `order=False`; **Pydantic v2** generates `__eq__` but not ordering, so you
  supply `__lt__` yourself or sort with `key=`.

## When to use which

| Situation | Reach for |
|---|---|
| Ordering is the field tuple, and the class is a record | `@dataclass(order=True)` |
| Ordering is the field tuple *and* it must be hashable | `@dataclass(order=True, frozen=True)` |
| Ordering is a computed value, not a field tuple | `@total_ordering` + one `__lt__` |
| Ordering is only needed at one call site | neither — `sorted(key=...)` |
| Ordering is hot in a profile | hand-write all six |

The fourth row is the most under-used. A class does not need comparison methods just
because you sorted it once; `key=` keeps the ordering next to the code that wanted it,
and avoids asserting that this ordering is *the* ordering of the type.

## Gotchas

**★ Reordering dataclass fields silently changing every sort in the program.**
`order=True` compares the class as a tuple of its fields *in declaration order*. A
cosmetic reshuffle is a behavioural change with no error. Fix: put a comment above the
field block saying the order is load-bearing, and add a test that asserts a known
ordering.

**★ `@dataclass(order=True)` raising `TypeError` from a comparison, only sometimes.**
A later field is un-orderable (`dict`, `set`, `None`) and is reached only when the
earlier fields tie. Fix: `field(compare=False)` on every field that is not part of the
identity or the order.

**★ `@dataclass(order=True, eq=False)` raising `ValueError` at import.** Documented:
`order` requires `eq`. Fix: leave `eq` at its default `True`.

**★ `@dataclass(order=True)` on a class that already defines `__lt__` raising
`TypeError`.** Also documented, and also at import. Fix: pick one — either the
generated ordering or your own, not both.

**★ A default `@dataclass` instance rejected from a `set` with `TypeError: unhashable
type`.** `eq=True, frozen=False` sets `__hash__` to `None`. Fix: `frozen=True` if the
object is a value; keep it unhashable if it is not.

**★ `unsafe_hash=True` used to get a mutable dataclass into a dict.** It produces
exactly the wrong-bucket bug of [02c](02c-ne-hash-and-the-contract.md) as soon as a
compared field is mutated. Fix: `frozen=True`, or key the dict on an immutable
extracted value.

**★ `Derived(...) == Base(...)` being `False` for a dataclass hierarchy.** The
generated `__eq__` requires *"identical type"*, not `isinstance`. Fix: this is usually
correct; if you genuinely want cross-class equality, write `__eq__` by hand and make
it symmetric and transitive.

**★ `sorted(mixed_dataclasses)` raising even though every class sets `order=True`.**
Ordering against a different dataclass type returns `NotImplemented` and therefore
raises. Fix: sort with an explicit `key=` that extracts a value common to both.

**★ `field(hash=False)` set "to be safe" and producing a hash inconsistent with
equality.** The docs call setting `hash` to anything other than `None` *discouraged*,
and note that a field excluded from the hash is still used for comparisons — so two
unequal objects can share a hash, which is legal but pointless, or you can talk
yourself into the reverse, which is not. Fix: leave `hash=None` and control both with
`compare`.

**★ A `NamedTuple` comparing equal to a plain tuple in a test that meant to check the
type.** Named tuples *are* tuples, so `Point(1, 2) == (1, 2)` is `True` and
`Point(1, 2) == OtherPoint(1, 2)` is `True` too. Fix: assert `isinstance` separately,
or use a dataclass, which requires identical types.

**★ A dataclass with a NaN field comparing `!=` to itself while `<=` itself is
`True`.** The 3.13 `__eq__` change made equality field-by-field (no identity
shortcut); the ordering methods still compare tuples (identity shortcut intact). Fix:
do not rely on `==` for float fields — compare with `math.isclose` or a NaN-aware
helper.

**★ `@dataclass(frozen=True)` on a class with a mutable field, and the hash going
stale.** `frozen=True` blocks attribute *assignment*; it does not make a `list` field
immutable, and `hash()` of that dataclass raises because `list` is unhashable — or
worse, a `tuple` field containing a list hashes and then mutates. Fix: use immutable
field types (`tuple`, `frozenset`) in any frozen dataclass you intend to hash.

**★ A dataclass ordering that disagrees with the domain because a `str` field sorts by
code point.** `order=True` uses the fields' own comparisons, so a `name: str` field
sorts uppercase before lowercase. Fix: `field(compare=False)` on the display field and
add a normalised sort field, or sort with `key=` instead.

## Interview questions

**★ Q: How does `@dataclass(order=True)` order instances?**
As if the class were a tuple of its fields, in declaration order. Both instances must
be of identical type, so a subclass does not compare with its base. Declaration order
is therefore load-bearing: reordering the fields changes every comparison in the
program with no error.

**★ Q: Is a `@dataclass` hashable by default?**
No. With the defaults (`eq=True, frozen=False`), `__hash__` is set to `None`, marking
instances unhashable — correct, since they are mutable. `@dataclass(frozen=True)`
generates a `__hash__` from the compared fields. With `eq=False`, `__hash__` is left
untouched and you inherit identity hashing.

**★ Q: What is `field(compare=False)` for?**
To keep a field out of the generated `__eq__` and ordering methods. It is essential
for fields that are not identity — a payload dict, a trace id, a cached value — and
especially for un-orderable ones, which would otherwise raise `TypeError` on exactly
the comparisons where earlier fields tie.

**Q: When is `unsafe_hash=True` justified?**
Almost never. The docs describe it as a specialised use case for a class that is
"logically immutable but can still be mutated" and say it should be considered
carefully. If a hashed field is ever mutated you get an entry stuck in the wrong
bucket. `frozen=True` is the answer in nearly every case.

**Q: What changed for dataclass `__eq__` in 3.13?**
It compares fields individually instead of building and comparing tuples — faster, and
behaviourally different for values that compare equal by identity but not by value,
which the docs illustrate with `float('nan')`. The ordering methods were not changed.

**Q: What are the two import-time errors `order=True` can raise?**
`ValueError` if `eq=False` (ordering without equality is incoherent) and `TypeError`
if the class already defines any of `__lt__`, `__le__`, `__gt__` or `__ge__`. Both
fire at class creation, which is the good kind of failure.

**Q: `NamedTuple` or `@dataclass(order=True)` for a sortable record?**
`NamedTuple` if you want tuple semantics — free lexicographic ordering, unpacking,
equality with plain tuples. `dataclass` if you want type-strict comparison, mutability
control, per-field `compare`, and defaults with `field(default_factory=...)`. The
`NamedTuple` equality with a bare tuple is the difference that most often decides it.

**Q: How do you make a dataclass usable as a dict key?**
`@dataclass(frozen=True)`, and make every compared field's type hashable — `tuple` not
`list`, `frozenset` not `set`. `frozen=True` blocks assignment, which is what makes
the generated hash safe; it does not deep-freeze the field values.

---

← Prev: [`total_ordering`](09-total-ordering-and-dataclasses.md) · Index: [Comparisons](README.md) · Next → [When equality is not a boolean](10-when-equality-is-not-a-boolean.md)
