---
title: "A tuple fixes which objects it holds and nothing about what those objects contain, so \"I made it immutable\" is a claim about one level only"
sidebar_label: "9 · Immutability is shallow too"
sidebar_position: 88
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09 against the Python 3.14
> [§3.1 Objects, values and types](https://docs.python.org/3.14/reference/datamodel.html#objects-values-and-types),
> [Built-in Types — sequence types](https://docs.python.org/3.14/library/stdtypes.html#immutable-sequence-types),
> the [glossary](https://docs.python.org/3.14/glossary.html#term-immutable),
> [`dataclasses`](https://docs.python.org/3.14/library/dataclasses.html#frozen-instances),
> and [`copy`](https://docs.python.org/3.14/library/copy.html).
> Target: **CPython 3.14**.

**Every immutable container in Python is immutable exactly one level deep. A
tuple guarantees its length and the identity of each element; it guarantees
nothing about those elements' contents. A frozen dataclass guarantees that its
attributes cannot be rebound; it guarantees nothing about the objects they
refer to. This is not a design flaw — a deep guarantee would require the
language to police an arbitrary object graph — but it does mean that "make it
immutable" is only a real defence when every type in the reachable graph is
also immutable.**

## The guarantee a tuple actually makes

```python
t = ([1, 2], "x")

t[0] = []            # TypeError — cannot rebind a slot
t.append(3)          # AttributeError — no such method
del t[0]             # TypeError

t[0].append(3)       # fine. t is now ([1, 2, 3], 'x')
t[0].clear()         # fine
```

The glossary defines immutable as *"An object with a fixed value […] Such an
object cannot be altered."* The subtlety is what "the value" of a tuple *is*:
the sequence of references it holds. Those references never change. What they
point at is somebody else's business.

The same rule, restated for every immutable container you will meet:

| Container | Fixed | Not fixed |
|---|---|---|
| `tuple` | length, element identities | element contents |
| `frozenset` | membership | members' contents (though members must be hashable) |
| frozen `dataclass` | attribute bindings | attribute values' contents |
| `NamedTuple` | fields, identities | field values' contents |
| `MappingProxyType` | *nothing you own* — it is a live view | keys, values, and the underlying dict |
| `str`, `bytes`, `int` | everything — elements are values, not objects | — |

`str` and `bytes` are the only genuinely deep cases, because their "elements"
are code points and integers rather than references to objects. That is what
makes them safe to share without thought, and it is a useful benchmark for what
"immutable" would mean if it were deep.

## `frozenset` is stricter, and still not deep

A `frozenset` requires its members to be hashable, which rules out lists and
dicts directly:

```python
frozenset([[1], [2]])          # TypeError: unhashable type: 'list'
frozenset([(1,), (2,)])        # fine
frozenset([([1],), ([2],)])    # TypeError — hashing the tuple hashes the list
```

That last line is the useful one: hashing a tuple hashes its elements, so the
unhashability propagates upward. Built-in Types states the rule for immutable
sequences:

> *"The only operation that immutable sequence types generally implement that
> is not also implemented by mutable sequence types is support for the `hash()`
> built-in. […] Attempting to hash an immutable sequence that contains
> unhashable values will result in `TypeError`."*

So `frozenset` and `hash()` reject *one* particular kind of nested mutability —
built-in mutable containers — and accept every other kind. A frozenset of
instances of your own mutable class is perfectly legal, because user-defined
classes are hashable by identity, and it is exactly as shallow as a tuple.

## `hash()` as a (partial) deep-immutability check

```python
def probably_deeply_immutable(obj) -> bool:
    try:
        hash(obj)
    except TypeError:
        return False
    return True
```

This is a genuinely useful smoke test at a boundary: it walks nested tuples and
frozensets and fails if any list, dict, set or bytearray is in there. It is the
same heuristic `@dataclass` uses, and it has the same hole, stated in the
dataclasses docs: *"The assumption is that if a value is unhashable, it is
mutable. This is a partial solution, but it does protect against many common
errors."* A mutable instance of a user class passes it. Use it as a guard, not
as a proof.

## Frozen dataclasses and named tuples

```python
@dataclass(frozen=True)
class Config:
    hosts: list[str]

cfg = Config(hosts=["a"])
cfg.hosts = []             # FrozenInstanceError
cfg.hosts.append("b")      # works — cfg.hosts is ["a", "b"]
```

The docs say what `frozen=True` is:

> *"It is not possible to create truly immutable Python objects. However, by
> passing `frozen=True` to the `@dataclass` decorator you can emulate
> immutability. In that case, dataclasses will add `__setattr__()` and
> `__delattr__()` methods to the class. These methods will raise a
> `FrozenInstanceError` when invoked."*

"Emulate" is the operative word: two methods are installed that raise. Nothing
else changes. `NamedTuple` is the same story with tuple mechanics instead of
`__setattr__` — the fields cannot be rebound and the field *values* are
ordinary mutable objects.

The complete recipe for a deeply immutable record is therefore recursive:
freeze the class **and** choose immutable field types **and** apply the same
rule to those types.

```python
@dataclass(frozen=True)
class Address:
    lines: tuple[str, ...]

@dataclass(frozen=True)
class Customer:
    name: str
    address: Address                 # frozen, holding a tuple of str
    tags: frozenset[str]
```

Every leaf is `str` or a number; nothing in the graph can be mutated. Now the
object is safe to share across threads, use as a cache value, hand to twenty
modules, and hash.

## Copying interacts with this

```python
t = ([1], [2])
copy.copy(t) is t          # True — nothing to copy at the tuple level
d = copy.deepcopy(t)
d is t                     # False — the inner lists were copied, so a new tuple was built
d[0] is t[0]               # False
```

`deepcopy` *does* descend into a tuple, because the tuple's elements may be
mutable. In CPython, if every element's deep copy turns out to be the original
object — which is the case for a tuple of atomics — the implementation returns
the original tuple rather than building an equal one; that is an optimisation
you can observe with `is` but should not depend on. Either way the semantics
are right: you cannot tell the difference for a tuple whose contents are
immutable, and you get a genuine copy for a tuple whose contents are not.

## Threads, and why this is not pedantry

The glossary's entry for immutable makes the payoff explicit:

> *"Immutable objects are inherently thread-safe because their state cannot be
> modified after creation, eliminating concerns about improperly synchronized
> concurrent modification."*

That guarantee is exactly as shallow as the immutability that produces it. A
tuple of lists shared between threads is not thread-safe in any useful sense —
the tuple is stable and the lists are a data race. Under 3.14's free-threaded
build, where genuine parallel execution of Python bytecode is possible, this
stops being theoretical.

## Gotchas

### A tuple used to make a config "safe" and the config still changes
**Symptom.** `SETTINGS = ("prod", {"debug": False})` and somebody flips
`SETTINGS[1]["debug"]`.
**Cause.** The tuple fixed the two element references; the dict is untouched by
that.
**Fix.** Make the elements immutable too — `MappingProxyType` over a dict of
scalars, or a frozen dataclass, or a tuple of pairs.

### `frozen=True` treated as deep
**Symptom.** A frozen dataclass's list field grows.
**Cause.** `frozen=True` installs `__setattr__`/`__delattr__` that raise; it
does not touch field values.
**Fix.** Immutable field types, converted in `__post_init__` with
`object.__setattr__` if callers pass lists.

### `TypeError: unhashable type: 'list'` from something with no list in sight
**Symptom.** Building a set or a dict key raises, pointing at a list you did
not think you had.
**Cause.** Hashing is recursive through tuples, so a list nested three levels
inside a tuple surfaces at the top.
**Fix.** Convert the nested structure recursively — a small
`freeze()` helper that maps lists to tuples, dicts to `tuple(sorted(items))`
or a frozen mapping, and sets to frozensets.

### A frozenset of mutable objects
**Symptom.** A frozenset "loses" a member, or `x in fs` is `False` for
something that is definitely in it.
**Cause.** The members are instances of a user class with a `__hash__` derived
from mutable state, and something mutated them after insertion — the classic
wrong-bucket failure, covered in
[Hashability and dict keys](09b-hashability-and-dict-keys.md).
**Fix.** Hash on immutable identity only.

### A "frozen" object shared across threads that is not
**Symptom.** Rare, unreproducible corruption in a multi-threaded or
free-threaded program.
**Cause.** The object graph was frozen at the top and mutable underneath, so the
thread-safety property the glossary describes does not hold.
**Fix.** Freeze to the leaves, or synchronise. There is no partial credit here.

### `copy.copy(t) is t` read as a bug
**Symptom.** A defensive `copy.copy` on a tuple appears to do nothing.
**Cause.** It correctly returns the original, because a tuple cannot be
altered and a distinct copy would be unobservable.
**Fix.** Nothing — unless the tuple contains mutable elements, in which case
you needed `deepcopy` or a different design.

## Interview questions

**★ Q: Is a tuple immutable?**
Yes, one level deep: its length and the identity of each element are fixed, so
you cannot assign to a slot, append, or delete. What the elements *contain* is
not fixed — `t[0].append(x)` on a tuple holding a list works fine. The
guarantee is about the tuple's own references, not about the object graph
below it.

**★ Q: `t = ([1], [2])` — is `t` hashable?**
No. Hashing a tuple hashes its elements, and lists are unhashable, so
`hash(t)` raises `TypeError`. Built-in Types states it: attempting to hash an
immutable sequence containing unhashable values raises `TypeError`. This is
also the check `@dataclass` uses to reject mutable field defaults.

**★ Q: Does `@dataclass(frozen=True)` make an instance immutable?**
It emulates immutability by installing `__setattr__` and `__delattr__` that
raise `FrozenInstanceError`, so attributes cannot be rebound. The docs are
explicit that *"It is not possible to create truly immutable Python objects."*
Mutable field values remain fully mutable, so deep immutability requires
immutable field types all the way down.

**Q: How would you check that a structure is deeply immutable?**
`hash(obj)` is the cheapest approximation: it recurses through tuples and
frozensets and raises on any list, dict, set or bytearray. It is a heuristic —
instances of user-defined classes hash by identity and pass regardless of
mutability — which is why the dataclasses docs call the same test *"a partial
solution"*.

**Q: Which built-in types are immutable all the way down?**
`str`, `bytes`, `int`, `float`, `complex`, `bool`, `None` — types whose
"contents" are values rather than references to other objects. `tuple` and
`frozenset` are immutable containers of arbitrary objects and are therefore
only as deep as what you put in them.

**Q: `copy.deepcopy` of a tuple — what do you get?**
A tuple whose elements are deep copies. If every element's copy turns out to be
the original object (a tuple of numbers and strings), CPython returns the
original tuple, which is observable with `is` but not otherwise. If any element
is mutable, you get a genuinely new tuple holding new objects.

**Q: Why does the glossary call immutable objects inherently thread-safe, and
where does that break?**
Because their state cannot change, so there is nothing to synchronise. It
breaks at the first mutable object in the graph: a tuple of lists shared
between threads gives you a stable tuple and a racy list. The property is
exactly as deep as the immutability.

---

← Prev: [Copy hooks and uncopyable objects](08c-copy-hooks-and-uncopyable.md) · Index: [Assignment and aliasing](README.md) · Next → [Hashability and dict keys](09b-hashability-and-dict-keys.md)
