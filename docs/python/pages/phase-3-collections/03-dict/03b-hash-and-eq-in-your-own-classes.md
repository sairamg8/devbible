---
title: "Defining __eq__ silently deletes your class's __hash__, and every other rule about custom keys is a consequence of that one line in the data model"
sidebar_label: "06 · __hash__ and __eq__ in your classes"
sidebar_position: 6
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-10 against the Python 3.14 documentation — [`object.__hash__`](https://docs.python.org/3.14/reference/datamodel.html#object.__hash__), [Glossary — *hashable*](https://docs.python.org/3.14/glossary.html#term-hashable), [`dataclasses.dataclass`](https://docs.python.org/3.14/library/dataclasses.html#dataclasses.dataclass). Target: **CPython 3.14** (3.14.7). Documentation-validated; **no sandbox run**.

**The most common way to break a dict key is to add an `__eq__` to a class that was working fine as one. Python responds by setting `__hash__` to `None` — silently, at class-creation time — and the class becomes unhashable. That behaviour is deliberate and correct, because a class that redefines equality without redefining hashing would violate the one invariant hash tables cannot survive. This chunk is the whole `__eq__`/`__hash__` protocol: what the defaults are, what overriding does, how to get the parent's hash back, how to remove hashability on purpose, and what `@dataclass` decides for you.**

## The defaults, and why they are consistent

> *"User-defined classes have `__eq__()` and `__hash__()` methods by default (inherited from the `object` class); with them, all objects compare unequal (except with themselves) and `x.__hash__()` returns an appropriate value such that `x == y` implies both that `x is y` and `hash(x) == hash(y)`."*

The glossary says the same from the other side: *"Objects which are instances of user-defined classes are hashable by default. They all compare unequal (except with themselves), and their hash value is derived from their `id()`."*

So the default pair is coherent: equality *is* identity, and hash is derived from identity. Two instances holding identical data are two different keys, and that is the documented, intended behaviour:

```python
class Session:
    def __init__(self, token: str) -> None:
        self.token = token

a, b = Session("abc"), Session("abc")

registry = {a: "first", b: "second"}    # two distinct keys — by design
len(registry)                            # 2
```

## Overriding `__eq__` removes `__hash__`

🔴 > *"A class that overrides `__eq__()` and does not define `__hash__()` will have its `__hash__()` implicitly set to `None`. When the `__hash__()` method of a class is `None`, instances of the class will raise an appropriate `TypeError` when a program attempts to retrieve their hash value, and will also be correctly identified as unhashable when checking `isinstance(obj, collections.abc.Hashable)`."*

This is not a warning, it is a mechanism: the class object really gets `__hash__ = None`, and every hash-consuming operation then raises. The rationale is in the preceding paragraph:

> *"If a class does not define an `__eq__()` method it should not define a `__hash__()` operation either; if it defines `__eq__()` but not `__hash__()`, its instances will not be usable as items in hashable collections."*

The failure looks like this — a class that was a perfectly good key stops being one because someone added value equality for a test assertion:

```python
import functools


class Session:
    def __init__(self, token: str) -> None:
        self.token = token

    def __eq__(self, other: object) -> bool:      # added for a test
        return isinstance(other, Session) and self.token == other.token

# every one of these now raises TypeError: unhashable type: 'Session'
registry = {Session("abc"): "first"}
seen = {Session("abc")}
functools.lru_cache()(handler)(Session("abc"))
```

The fix is to define `__hash__` alongside, using the shape the data model itself recommends:

> *"it is advised to mix together the hash values of the components of the object that also play a part in comparison of objects by packing them into a tuple and hashing the tuple"*

```python
class Session:
    def __init__(self, token: str) -> None:
        self.token = token

    def __eq__(self, other: object) -> bool:
        return isinstance(other, Session) and self.token == other.token

    def __hash__(self) -> int:
        return hash((self.token,))     # same field the __eq__ compares
```

🔴 **The tuple inside `__hash__` and the tuple inside `__eq__` must contain the same fields.** If `__eq__` compares three fields and `__hash__` hashes two, the class is still *correct* — equal objects still hash equal — but it produces avoidable collisions. If `__hash__` hashes a field `__eq__` does *not* compare, the class is **broken**: two equal objects can hash differently, and both will exist in the same dict at once.

## Getting the parent's hash back

> *"If a class that overrides `__eq__()` needs to retain the implementation of `__hash__()` from a parent class, the interpreter must be told this explicitly by setting `__hash__ = <ParentClass>.__hash__`."*

That is the documented spelling, angle brackets and all — you substitute the real class name. The common case is keeping identity hashing while adding value equality, which is legitimate only when you also accept the consequence:

```python
class Node:
    def __init__(self, label: str) -> None:
        self.label = label

    def __eq__(self, other: object) -> bool:
        return isinstance(other, Node) and self.label == other.label

    __hash__ = object.__hash__      # keep identity hashing
```

⚠️ **This class violates the hash invariant.** Two `Node("a")` objects compare equal but hash differently, so a dict can hold both — and which one a lookup finds depends on the table's internals. Do this only when equality is a convenience for assertions and the objects are never used as keys, and say so in a comment. When they *are* used as keys, hash the same fields `__eq__` compares.

## Removing hashability on purpose

> *"If a class that does not override `__eq__()` wishes to suppress hash support, it should include `__hash__ = None` in the class definition."*

Useful for a mutable value object that people keep accidentally putting in a set:

```python
class MutableConfig:
    """Deliberately unhashable: this object is mutated in place after creation."""
    __hash__ = None

    def __init__(self, values: dict[str, str]) -> None:
        self.values = values
```

And the caveat the data model attaches, which is a real hole in duck-typed checks:

🔴 > *"A class which defines its own `__hash__()` that explicitly raises a `TypeError` would be incorrectly identified as hashable by an `isinstance(obj, collections.abc.Hashable)` call."*

So `isinstance(x, Hashable)` answers "does this type have a non-`None` `__hash__`", not "will hashing this succeed". If you must check, the honest check is to try it:

```python
from collections.abc import Hashable

def is_really_hashable(obj: object) -> bool:
    """isinstance(obj, Hashable) can lie; hashing cannot."""
    if not isinstance(obj, Hashable):
        return False
    try:
        hash(obj)
    except TypeError:
        return False
    return True
```

⚠️ `isinstance(x, Hashable)` also returns `True` for a tuple containing a list — `tuple` has a real `__hash__`; it just raises when it reaches the list. That is the same hole, reached from a different direction, and it is the far more common one.

## `@dataclass` decides for you, by a documented table

The `dataclasses` documentation gives the rule in three sentences, and every dataclass you have ever written follows it:

🔴 > *"If *eq* and *frozen* are both true, by default `@dataclass` will generate a `__hash__` method for you. If *eq* is true and *frozen* is false, `__hash__` will be set to `None`, marking it unhashable (which it is, since it is mutable). If *eq* is false, `__hash__` will be left untouched meaning the `__hash__` method of the superclass will be used (if the superclass is `object`, this means it will fall back to id-based hashing)."*

Since `eq=True` is the default and `frozen=False` is the default, **a plain `@dataclass` is unhashable** — which surprises everyone exactly once:

| Declaration | `__eq__` | `__hash__` | Usable as a key? |
|---|---|---|---|
| `@dataclass` | generated | **`None`** | ❌ `TypeError` |
| `@dataclass(frozen=True)` | generated | **generated** | ✅ by field values |
| `@dataclass(eq=False)` | inherited from `object` | inherited from `object` | ✅ by identity |
| `@dataclass(unsafe_hash=True)` | generated | forced | ⚠️ see below |

```python
from dataclasses import dataclass

@dataclass
class Point:
    x: int
    y: int

# {Point(1, 2): "origin-ish"} -> TypeError: unhashable type: 'Point'

@dataclass(frozen=True)
class FrozenPoint:
    x: int
    y: int

grid = {FrozenPoint(1, 2): "origin-ish"}     # works, keyed by value
```

`unsafe_hash=True` is named the way it is on purpose, and the documentation is blunt about when it applies:

> *"Although not recommended, you can force `@dataclass` to create a `__hash__` method with `unsafe_hash=True`. This might be the case if your class is logically immutable but can still be mutated. This is a specialized use case and should be considered carefully."*

And a general principle worth keeping, from the same section:

> *"Having a `__hash__` implies that instances of the class are immutable."*

⚠️ `frozen=True` freezes *attribute assignment*, not the objects the attributes point at. A frozen dataclass with a `list` field is still hashable-by-declaration and still a landmine — hashing it raises, because tuple-style hashing of the fields reaches the list. Freeze the field type too:

```python
@dataclass(frozen=True)
class Route:
    origin: str
    legs: tuple[str, ...]      # not list[str]
```

## Hash width, and the one platform gotcha

> *"`hash()` truncates the value returned from an object's custom `__hash__()` method to the size of a `Py_ssize_t`. This is typically 8 bytes on 64-bit builds and 4 bytes on 32-bit builds. If an object's `__hash__()` must interoperate on builds of different bit sizes, be sure to check the width on all supported builds."*

The documentation gives its own probe for the width — `python -c "import sys; print(sys.hash_info.width)"` — and this page does not publish a number for it, because that is a property of the machine you run it on. The practical consequence is narrow but real: **never persist a `hash()` value.** It is truncated per build, salted per process for `str` and `bytes`, and carries no cross-version stability promise. If you need a stable digest, use `hashlib`.

```python
import hashlib

# NOT stable across processes or builds
key = hash(user_email)

# stable everywhere, forever
key = hashlib.sha256(user_email.encode()).hexdigest()
```

## Gotchas

**★ Symptom: `TypeError: unhashable type: 'MyClass'` appears after a commit that only added an `__eq__`.** Cause: *"A class that overrides `__eq__()` and does not define `__hash__()` will have its `__hash__()` implicitly set to `None`."* Fix: add `__hash__` over the same fields.

```python
def __eq__(self, other: object) -> bool:
    return isinstance(other, Money) and (self.amount, self.currency) == (other.amount, other.currency)

def __hash__(self) -> int:
    return hash((self.amount, self.currency))
```

**★ Symptom: a `@dataclass` cannot be used as a dict key or put in a set.** Cause: the default is `eq=True, frozen=False`, and the documented rule is that this combination sets `__hash__` to `None`. Fix: `frozen=True` if the object is a value, `eq=False` if identity semantics were what you wanted all along.

```python
@dataclass(frozen=True)
class CacheKey:
    tenant: str
    resource: str
```

**★ Symptom: a dict contains two keys that compare equal.** Cause: `__hash__` and `__eq__` disagree — either `__hash__` was pinned to `object.__hash__` while `__eq__` compares fields, or `__hash__` includes a field `__eq__` ignores. The glossary rule is absolute: *"Hashable objects which compare equal must have the same hash value."* Fix: derive both from the same tuple, and write the tuple once.

```python
class Money:
    def _key(self) -> tuple[int, str]:
        return (self.amount, self.currency)

    def __eq__(self, other: object) -> bool:
        return isinstance(other, Money) and self._key() == other._key()

    def __hash__(self) -> int:
        return hash(self._key())
```

**★ Symptom: `isinstance(obj, Hashable)` returns `True` and `hash(obj)` then raises.** Cause: two documented holes — a class whose own `__hash__` raises *"would be incorrectly identified as hashable"*, and a tuple containing a list has a real `__hash__` that fails on its contents. Fix: if you need certainty, hash it inside a `try`.

```python
try:
    cache[key] = value
except TypeError:
    logger.warning("unhashable cache key %r; skipping cache", key)
```

**Symptom: a subclass of a hashable class becomes unhashable.** Cause: the subclass added `__eq__` — the implicit `__hash__ = None` applies at every level of the hierarchy, not just to classes deriving directly from `object`. Fix: either define `__hash__`, or restore the parent's explicitly with the documented spelling `__hash__ = <ParentClass>.__hash__`.

```python
class TimestampedSession(Session):
    def __eq__(self, other: object) -> bool:
        return isinstance(other, TimestampedSession) and self.token == other.token

    __hash__ = Session.__hash__      # explicit; nothing else restores it
```

**Symptom: a `frozen=True` dataclass raises `TypeError: unhashable type: 'list'` when used as a key.** Cause: `frozen` blocks attribute *assignment*; it does not make the field values immutable, and the generated `__hash__` hashes the fields. Fix: use immutable field types.

```python
@dataclass(frozen=True)
class Route:
    origin: str
    legs: tuple[str, ...] = ()
```

**Symptom: a hash value stored in a database or a cache key file stops matching after a restart.** Cause: `hash()` on `str`/`bytes` is salted per process, and the result is truncated to the build's `Py_ssize_t` width. Fix: `hashlib`, not `hash`.

```python
import hashlib
digest = hashlib.blake2b(payload, digest_size=16).hexdigest()
```

**Symptom: a class defines `__hash__` but not `__eq__`, and lookups miss.** Cause: without `__eq__` the class still compares by identity, so a freshly built "equal" object never matches — the hash gets you to the right bucket and the identity comparison rejects it. The documentation states the pairing rule in the other direction too: *"If a class does not define an `__eq__()` method it should not define a `__hash__()` operation either."* Fix: define both, or neither.

**Symptom: `unsafe_hash=True` was added to make a dataclass usable as a key, and stale entries appear.** Cause: the flag forces a hash onto a *mutable* class — the documentation calls it *"not recommended"* and reserves it for classes that are *"logically immutable but can still be mutated"*. Mutating a field after insertion strands the entry. Fix: `frozen=True`, or key on an explicitly extracted immutable tuple instead of the object.

## Interview questions

**★ What happens to `__hash__` when you define `__eq__`?**
Python sets it to `None` on the class. The data model states it directly: *"A class that overrides `__eq__()` and does not define `__hash__()` will have its `__hash__()` implicitly set to `None`."* Instances then raise `TypeError` on any hash attempt, and `isinstance(obj, collections.abc.Hashable)` correctly reports `False`. The reasoning is that redefining equality without redefining hashing would break the invariant that equal objects hash equally — Python would rather make the class unusable as a key than let it corrupt a table.

**★ Why is a plain `@dataclass` not usable as a dict key?**
Because `eq=True` and `frozen=False` are both defaults, and the documented rule for that combination is *"If *eq* is true and *frozen* is false, `__hash__` will be set to `None`, marking it unhashable (which it is, since it is mutable)."* The dataclass machinery is applying exactly the same principle the data model applies to hand-written classes. `frozen=True` makes it hashable by field values; `eq=False` leaves the inherited identity hash in place.

**★ You have a class where `__eq__` compares three fields. What should `__hash__` do?**
Hash a tuple of those same three fields, in the same order — the data model's own advice is to *"mix together the hash values of the components of the object that also play a part in comparison of objects by packing them into a tuple and hashing the tuple."* Hashing *fewer* fields is legal but produces avoidable collisions. Hashing *more* fields is a bug: two objects that `__eq__` calls equal could then hash differently, and a dict would happily hold both.

**★ When is `__hash__ = object.__hash__` the right thing to write?**
When you deliberately want identity hashing on a class that also defines value equality — and you accept that this violates the equal-implies-same-hash invariant, so the class must never be a dict key or set member. The documentation gives the spelling for the legitimate version of this, retaining a *parent's* hash rather than `object`'s: *"the interpreter must be told this explicitly by setting `__hash__ = <ParentClass>.__hash__`."* In practice the honest options are usually "hash the fields `__eq__` compares" or "do not define `__eq__` at all".

**Is `isinstance(x, collections.abc.Hashable)` a reliable test?**
No, and the documentation says why: *"A class which defines its own `__hash__()` that explicitly raises a `TypeError` would be incorrectly identified as hashable."* The check inspects whether a non-`None` `__hash__` exists; it does not call it. The far more common false positive is a tuple containing a list — `tuple.__hash__` is perfectly real and raises when it reaches the list. If the answer must be right, call `hash()` inside a `try`.

**Can you store a `hash()` value in a database?**
No. Three separate reasons, all documented: `str` and `bytes` hashes are *"salted with an unpredictable random value"* per process, `hash()` truncates a custom `__hash__` to the build's `Py_ssize_t` width (*"typically 8 bytes on 64-bit builds and 4 bytes on 32-bit builds"*), and nothing promises stability across Python versions. `hash()` is an in-process bucketing device. For persistence use `hashlib`.

**A mutable object with the default `__hash__` — is that safe as a key?**
Yes, and this is the case that shows "immutable" is the wrong mental model. The default hash comes from `id()`, which never changes for the object's lifetime, and the default equality is identity. Mutating the object's attributes changes neither. The entry stays findable, because the key's *identity* is what the table indexed. It stops being safe the instant someone adds an `__eq__` — at which point either the class becomes unhashable, or you have hand-written a hash that the mutation can invalidate.

---

← [05 · Hashability — the contract](03-hashability-the-contract.md) · [Topic index](README.md) · Next → [07 · The key that mutates](03c-the-key-that-mutates.md)
