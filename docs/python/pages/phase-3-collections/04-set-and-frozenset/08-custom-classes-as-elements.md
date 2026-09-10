---
title: "Your own objects are set elements by identity until you define `__eq__`, unhashable the moment you do, and correct only when `__eq__` and `__hash__` read the same fields and those fields never change while the object is in a set — mutate one and the element is stranded, findable by iteration and by nothing else"
sidebar_label: "8 · Custom classes as elements"
sidebar_position: 20
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-10 on **Python 3.14.7** against the data model —
> [`object.__hash__`](https://docs.python.org/3.14/reference/datamodel.html#object.__hash__) — the
> [glossary](https://docs.python.org/3.14/glossary.html#term-hashable),
> and [`dataclasses`](https://docs.python.org/3.14/library/dataclasses.html);
> CPython v3.14.7 `Include/cpython/setobject.h` and `Objects/setobject.c` for the stored-hash
> mechanism, marked *implementation detail*. Documentation-verified — **no sandbox run, no program
> output**.

**A set asks two questions of every element — what is your hash, and are you equal to this — and a
class you write answers both, by default or on purpose. The default answer is identity, which is
right for objects that *are* something (a connection, a task, a listener) and wrong for objects that
*describe* something (an email address, a SKU, a coordinate). Changing the answer is three rules in
the data model, and breaking any of them produces a set that holds what it cannot find.**

## The default: every instance is distinct

> *"Objects which are instances of user-defined classes are hashable by default. They all compare
> unequal (except with themselves), and their hash value is derived from their `id()`."* —
> [glossary](https://docs.python.org/3.14/glossary.html#term-hashable)

So two `Sku("A-100")` objects are two elements, `Sku("A-100") in {Sku("A-100")}` is `False`, and a
dedupe over freshly constructed or freshly loaded objects removes nothing. That is correct for
objects with identity and a surprise for value objects.

## Rule 1 — defining `__eq__` removes the hash

> *"A class that overrides `__eq__()` and does not define `__hash__()` will have its `__hash__()`
> implicitly set to `None`. When the `__hash__()` method of a class is `None`, instances of the class
> will raise an appropriate `TypeError` when a program attempts to retrieve their hash value, and
> will also be correctly identified as unhashable when checking
> `isinstance(obj, collections.abc.Hashable)`."* —
> [`object.__hash__`](https://docs.python.org/3.14/reference/datamodel.html#object.__hash__)

This is a safety feature: the inherited identity hash would disagree with your new equality. The
first `add` then fails; on 3.14 the message names the class, module-qualified, as the thing that
cannot be a set element, followed by the plain `unhashable type` part.

The rule applies to **subclasses** too, which is the version that bites: a subclass that adds its own
`__eq__` loses the parent's `__hash__` even when the parent defined one.

> *"If a class that overrides `__eq__()` needs to retain the implementation of `__hash__()` from a
> parent class, the interpreter must be told this explicitly by setting
> `__hash__ = <ParentClass>.__hash__`."* —
> [`object.__hash__`](https://docs.python.org/3.14/reference/datamodel.html#object.__hash__)

## Rule 2 — equal objects must hash equal

> *"The `__hash__()` method should return an integer. The only required property is that objects
> which compare equal have the same hash value; it is advised to mix together the hash values of the
> components of the object that also play a part in comparison of objects by packing them into a
> tuple and hashing the tuple."* — [`object.__hash__`](https://docs.python.org/3.14/reference/datamodel.html#object.__hash__)

Hash and equality must be computed from **the same fields in the same form**. A set compares only
elements whose hash matches ([1](01-the-hash-table-underneath.md)), so two objects that are `==` but
hash differently are never compared — the set holds both, and a lookup for one misses the other:

```python
class Email:
    def __init__(self, address: str) -> None:
        self.address = address

    def __eq__(self, other: object) -> bool:
        if not isinstance(other, Email):
            return NotImplemented
        return self.address.casefold() == other.address.casefold()    # case-insensitive

    def __hash__(self) -> int:
        return hash(self.address)       # BUG: case-sensitive — "A@x.io" and "a@x.io" are == but hash apart
```

The fix is to hash exactly what you compare — and returning `NotImplemented` for foreign types keeps
equality from silently crossing into types whose hashes you do not control:

```python
class Email:
    __slots__ = ("address", "_key")

    def __init__(self, address: str) -> None:
        self.address = address
        self._key = address.strip().casefold()

    def __eq__(self, other: object) -> bool:
        if not isinstance(other, Email):
            return NotImplemented
        return self._key == other._key

    def __hash__(self) -> int:
        return hash(self._key)          # the same normalised value equality uses
```

If equality deliberately crosses types — a `Tag` equal to the string with the same name — the hash
must equal that type's hash too (`hash(self.name)`), or `"python" in {Tag("python")}` is `False`
while `Tag("python") == "python"` is `True`.

## Rule 3 — the hash must not change while the object is in a set

> *"If a class defines mutable objects and implements an `__eq__()` method, it should not implement
> `__hash__()`, since the implementation of hashable collections requires that a key's hash value is
> immutable (if the object's hash value changes, it will be in the wrong hash bucket)."* —
> [`object.__hash__`](https://docs.python.org/3.14/reference/datamodel.html#object.__hash__)

*"The wrong hash bucket"* is concrete. In 3.14.7 each slot stores the element's hash beside it
(`setentry.hash`, *"Cached hash code of the key"*) and the set never recomputes it
([1b](01b-what-the-table-costs-you.md)). Mutate a field the hash reads, and:

- `obj in s` hashes the object *now*, probes from the new slot, and never reaches the old one —
  `False`.
- `s.remove(obj)` raises `KeyError`; `s.discard(obj)` silently does nothing.
- `for x in s` still yields it, and `len(s)` still counts it.
- `s.add(obj)` stores **the same object a second time**: a match requires the stored hash to equal
  the new one before identity is even checked (`set_add_entry_takeref`), so the stale entry is never
  recognised.
- Copying the set (`set(s)`, `s.copy()`, `s | t`) carries the stale stored hash along; only
  rebuilding from a non-set iterable re-hashes.

```python
class Location:
    def __init__(self, warehouse: str, shelf: str) -> None:
        self.warehouse = warehouse
        self.shelf = shelf

    def __eq__(self, other: object) -> bool:
        if not isinstance(other, Location):
            return NotImplemented
        return (self.warehouse, self.shelf) == (other.warehouse, other.shelf)

    def __hash__(self) -> int:
        return hash((self.warehouse, self.shelf))


def restock(pending: set[Location], loc: Location) -> None:
    loc.shelf = "B-12"          # loc is inside `pending`: its stored hash is now stale
    pending.discard(loc)        # does nothing — the lookup starts from the new hash's slot
```

Three fixes, in order of preference. Make value objects immutable, so the hash cannot change:

```python
from dataclasses import dataclass


@dataclass(frozen=True)
class Location:
    warehouse: str
    shelf: str                  # eq=True and frozen=True: dataclasses generate a consistent __hash__
```

Or hash only the fields that never change — an immutable ID — and keep equality on the same field.
Or, if a hashed field genuinely must change, take the object out first and put it back after:

```python
def move(pending: set[Location], loc: Location, new_shelf: str) -> Location:
    pending.discard(loc)                     # removed while its hash still matches its slot
    moved = Location(loc.warehouse, new_shelf)
    pending.add(moved)
    return moved
```

## What `@dataclass` generates

> *"If eq and frozen are both true, by default `@dataclass` will generate a `__hash__()` method for
> you. If eq is true and frozen is false, `__hash__()` will be set to `None`, marking it unhashable
> (which it is, since it is mutable). If eq is false, `__hash__()` will be left untouched meaning
> the `__hash__()` method of the superclass will be used (if the superclass is `object`, this means it
> will fall back to id-based hashing)."* — [`dataclasses`](https://docs.python.org/3.14/library/dataclasses.html)

| Decorator | Equality | Hash | As a set element |
|---|---|---|---|
| `@dataclass` | by fields | `None` | `TypeError` — rule 1, applied for you |
| `@dataclass(frozen=True)` | by fields | by fields | correct value semantics |
| `@dataclass(eq=False)` | identity | identity | correct identity semantics |
| `@dataclass(unsafe_hash=True)` | by fields | by fields | a mutable object with a value hash — rule 3 is now your job |

A frozen dataclass with a mutable *field* — a `set` or `list` — is a separate trap:
[5b](05b-frozenset-beside-set.md).

## Identity-hashed elements

Objects that *are* something — a connection, a task, a listener — belong in a set as themselves, and
the set's strong reference to them is either the leak or the point. That, and why entities loaded
twice are two elements, is [8b · When identity is the equality you want](08b-identity-elements.md).

## Gotchas

**★ Symptom: `TypeError` naming your class as something that *"cannot"* be *"a set element"*, right
after you added an `__eq__`.** Cause: overriding `__eq__` sets `__hash__` to `None`. Fix: define
`__hash__` over the same fields — or `@dataclass(frozen=True)`.

**★ Symptom: an element is visible when you iterate the set, but `x in s` is `False` and
`s.remove(x)` raises `KeyError`.** Cause: a field the hash reads was mutated after insertion; the
stored hash is stale. Fix: immutable value objects, or remove-mutate-re-add — `move()` above. To
repair a set already in this state, rebuild it from a non-set iterable: `s = set(list(s))` re-hashes
every element (`set(s)` does not).

**★ Symptom: a set of emails contains `"A@x.io"` and `"a@x.io"`, although the class says they are
equal.** Cause: `__eq__` compares a normalised form and `__hash__` hashes the raw one, so the two are
never compared. Fix: hash exactly what equality compares — the second `Email` above.

**★ Symptom: a subclass that added `__eq__` can no longer be put in a set, although its parent could.**
Cause: rule 1 applies per class. Fix: say which hash to keep.

```python
class Product:
    def __init__(self, sku: str) -> None:
        self.sku = sku

    def __eq__(self, other: object) -> bool:
        return isinstance(other, Product) and self.sku == other.sku

    def __hash__(self) -> int:
        return hash(self.sku)


class DiscountedProduct(Product):
    def __init__(self, sku: str, percent: int) -> None:
        super().__init__(sku)
        self.percent = percent

    def __eq__(self, other: object) -> bool:
        return super().__eq__(other) and getattr(other, "percent", None) == self.percent

    __hash__ = Product.__hash__      # still consistent: equal objects share a sku, so share a hash
```

**Symptom: the same object appears twice in a set.** Cause: its hash changed after it was added, and
`add` compares stored hashes before identity, so the stale entry is not recognised. Fix: as for the
stranded element — never mutate hashed fields of an element.

**Symptom: `"python" in {Tag("python")}` is `False` although `Tag("python") == "python"` is `True`.**
Cause: cross-type equality without a matching hash. Fix: return `NotImplemented` for foreign types,
or make `__hash__` return `hash(self.name)` so it agrees with the string's hash.

## Interview questions

**★ What are the rules for making a class usable as a set element with value semantics?**
Define `__eq__` and `__hash__` over the same fields in the same normalised form, so that equal
objects always hash equal; build the hash by hashing a tuple of those fields; and make sure those
fields cannot change while the object is in a set — in practice, make the class immutable. A frozen
dataclass does all three.

**★ What happens if you mutate an object after adding it to a set, in a way that changes its hash?**
The set keeps the old hash stored beside the element and never recomputes it. Lookups hash the
object afresh, start from a different slot and never reach the old one, so `in` is `False`, `remove`
raises and `discard` does nothing — while iteration and `len` still see the element. Adding it again
stores the same object a second time. The data model's phrase for this is *"it will be in the wrong
hash bucket"*.

**Why does defining `__eq__` make a class unhashable?**
The inherited `object.__hash__` is identity-based; paired with a value-based `__eq__` it would give
equal objects different hashes and break every set and dict they entered. So Python sets `__hash__`
to `None` when a class overrides `__eq__` without defining `__hash__`, and the first attempt to hash
an instance raises. A subclass that overrides `__eq__` must restore a parent's hash explicitly with
`__hash__ = Parent.__hash__`.

**What does `@dataclass` do about `__hash__`?**
With the default `eq=True` and `frozen=False` it sets `__hash__` to `None`, because a mutable object
with value equality must not be hashable. With `frozen=True` it generates a hash from the fields.
With `eq=False` it leaves identity hashing in place. `unsafe_hash=True` forces a value hash on a
mutable class, which is only safe if you never mutate an instance while it is in a set or dict.

---

← Prev: [Equal but distinct elements](07-equal-but-distinct-elements.md) · [Topic index](README.md) · Next → [When identity is the equality you want](08b-identity-elements.md)
