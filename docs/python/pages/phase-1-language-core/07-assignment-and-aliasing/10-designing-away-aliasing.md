---
title: "The durable fix is not more copying — it is modelling values as immutable records and replacing them instead of mutating them"
sidebar_label: "10 · Designing away aliasing"
sidebar_position: 90
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09 against the Python 3.14
> [`dataclasses`](https://docs.python.org/3.14/library/dataclasses.html),
> [`typing.NamedTuple`](https://docs.python.org/3.14/library/typing.html#typing.NamedTuple),
> [`collections.namedtuple`](https://docs.python.org/3.14/library/collections.html#collections.namedtuple),
> [`copy.replace`](https://docs.python.org/3.14/library/copy.html#copy.replace),
> and the [glossary — named tuple](https://docs.python.org/3.14/glossary.html#term-named-tuple).
> Target: **CPython 3.14**.

**Every other chunk in this topic describes a way to be careful. This one
describes how to stop needing to be. If a value cannot be mutated, aliasing it
is free: pass it anywhere, cache it, share it between threads, use it as a dict
key, and never write a defensive copy again. The cost is that "changing" it
means constructing a new one — which Python supports directly through
`dataclasses.replace`, `NamedTuple._replace` and, since 3.13, `copy.replace` —
and that you must decide which of your objects are values and which are
entities with identity and a lifecycle.**

## Values versus entities

The decision that makes everything else fall out:

- A **value** is defined entirely by its contents. Two money amounts of £5 are
  interchangeable. An address, a date range, a set of feature flags, a parsed
  request, a configuration. Values should be immutable, and equality should be
  by content.
- An **entity** has identity independent of its contents. A user, an order, a
  connection, a session. Entities are mutable by nature, they have a lifecycle,
  and equality should be by id.

Most aliasing bugs are values implemented as entities: a config dict that
twenty modules share and one edits, a "row" dict that is passed around and
patched, a list of tags that everybody appends to. Making them values removes
the bug class rather than the instance.

## The four immutable record types

```python
# 1 — tuple: positional, zero ceremony, no names
point = (3, 4)

# 2 — NamedTuple: a tuple with field names; iterable, indexable, unpackable
class Point(NamedTuple):
    x: int
    y: int

# 3 — frozen dataclass: named fields, no tuple behaviour, full class semantics
@dataclass(frozen=True, slots=True)
class Money:
    amount: Decimal
    currency: str

# 4 — frozenset / tuple for collections of values
tags: frozenset[str] = frozenset({"urgent", "billing"})
```

Choosing between 2 and 3 is the only real decision:

| | `NamedTuple` | frozen `dataclass` |
|---|---|---|
| Is a `tuple` | yes — indexable, unpackable, `==` with plain tuples | no |
| Hashable | yes, if fields are | only with `eq=True, frozen=True` |
| Default values | yes | yes |
| Methods, properties, `__post_init__` | methods yes, no `__post_init__` | all of it |
| Inheritance | awkward | ordinary |
| Modify | `p._replace(x=1)` | `dataclasses.replace(p, x=1)` |
| Memory | tuple-compact | use `slots=True` |
| Risk | compares equal to a plain tuple; unpacking makes field order part of the API | none of that |

The glossary's definition is worth having, because "named tuple" is broader
than `collections.namedtuple`:

> *"The term 'named tuple' applies to any type or class that inherits from
> tuple and whose indexable elements are also accessible using named
> attributes."*

`os.stat()` results and `sys.float_info` are named tuples in that sense.

Use `NamedTuple` for small positional values that benefit from tuple behaviour
(coordinates, ranges, DB rows). Use a frozen dataclass for anything with
behaviour, validation, or more than about four fields — the accidental tuple
equality and positional unpacking of `NamedTuple` become a liability as a type
grows.

## "Changing" an immutable value

```python
p2 = p._replace(x=10)                       # NamedTuple
m2 = dataclasses.replace(m, amount=new)     # dataclass
c2 = copy.replace(cfg, host="db2")          # 3.13+, works on both and on __replace__
```

`copy.replace` is the generic spelling:

> *"`copy.replace()` is more limited than `copy()` and `deepcopy()`, and only
> supports named tuples created by `namedtuple()`, `dataclasses`, and other
> classes which define method `__replace__()`."*

And for dataclasses it is a real construction, not a field poke:

> *"The newly returned object is created by calling the `__init__()` method of
> the dataclass. This ensures that `__post_init__()`, if present, is also
> called."*

Which means your validation runs on the replacement — the property that makes
"replace" safer than "mutate" in the first place.

## The builder shape: mutable inside, immutable at the seam

Immutable values are awkward to *build* incrementally, so do not try. Build with
ordinary mutable structures and freeze once at the boundary:

```python
@dataclass(frozen=True, slots=True)
class Report:
    rows: tuple[Row, ...]
    totals: Mapping[str, Decimal]

def build_report(source) -> Report:
    rows = []                                # mutable, local, unshared
    totals = defaultdict(Decimal)
    for record in source:
        rows.append(...)
        totals[record.key] += record.amount
    return Report(rows=tuple(rows),          # freeze exactly here
                  totals=types.MappingProxyType(dict(totals)))
```

The local list is never aliased by anyone, so mutating it is free; the returned
object cannot be mutated by anyone, so sharing it is free. That is the shape —
often called a functional core with an imperative shell — and it is why
"immutability is slow" is usually false in practice: you mutate freely inside a
function and freeze once on the way out.

`__post_init__` is the enforcement point when callers may hand you a list:

```python
@dataclass(frozen=True)
class Config:
    hosts: tuple[str, ...] = ()

    def __post_init__(self):
        object.__setattr__(self, "hosts", tuple(self.hosts))
```

## When immutability is the wrong call

Be honest about the cases where it costs more than it saves:

- **Large arrays and buffers.** Replacing a 10-million-element structure to
  change one element is absurd. Use `array`, NumPy or `bytearray` and manage
  ownership explicitly.
- **Hot inner loops.** Allocating a new record per iteration has a real cost;
  measure before converting.
- **Genuine entities with a lifecycle.** An open connection, a running job, a
  session — freezing these models the domain wrongly.
- **Incremental accumulation.** Building a list by repeatedly replacing a tuple
  is quadratic. Build mutable, freeze once.

The rule of thumb: **immutable at the seams, mutable in the middle of a
function.**

## Other libraries, briefly

`attrs` offers `@define(frozen=True)` and `attrs.evolve()`, the same design with
different spellings. Pydantic models can be configured frozen and offer
`model_copy(deep=...)`; the exact copy-on-validation semantics vary by major
version and I have not verified the current release against primary
documentation, so confirm the behaviour in your version rather than assuming a
model constructor copies its inputs. Third-party persistent data structures
(`pyrsistent`, `immutables.Map`) give you structural sharing so that
"replacing" a large map is cheap — worth knowing exists, rarely worth the
dependency in application code.

## Gotchas

### `NamedTuple` compares equal to a plain tuple
**Symptom.** A test asserts `result == (1, 2)` and passes for the wrong type;
or a `Point` and a `Size` compare equal.
**Cause.** `NamedTuple` *is* a tuple, and tuple equality is positional and
type-blind.
**Fix.** Use a frozen dataclass when type-distinct equality matters, or assert
on `type(result)` as well.

### `frozen=True` without immutable field types
**Symptom.** The "immutable" record's list field grows.
**Cause.** Frozen blocks rebinding, not mutation — see
[Immutability is shallow too](09-immutability-is-shallow.md).
**Fix.** `tuple`/`frozenset`/nested frozen dataclasses, converted in
`__post_init__`.

### `dataclasses.replace` on a class with `init=False` fields
**Symptom.** `ValueError`, or a derived field silently recomputed.
**Cause.** Documented: it is an error for changes to contain `init=False`
fields, and those fields *"are not copied from the source object"*.
**Fix.** Avoid `init=False` on value types, or write an explicit clone method —
which the docs themselves suggest.

### Building a tuple incrementally
**Symptom.** A loop that does `acc = acc + (item,)` is fine at 100 items and
unusable at 100,000.
**Cause.** Every step allocates and copies the whole tuple — quadratic.
**Fix.** Accumulate in a list, `tuple(...)` once at the end.

### An immutable value holding a mutable one from a caller
**Symptom.** A frozen record's field is the caller's list, and the caller keeps
editing it.
**Cause.** The constructor stored the argument without converting.
**Fix.** Convert in `__post_init__` (or in a classmethod constructor) so there
is exactly one place where external data becomes yours.

### `slots=True` and a default that is mutable
**Symptom.** `ValueError` at class creation, or unexpected behaviour with
inheritance.
**Cause.** `slots=True` recreates the class, and mutable defaults still hit the
unhashable-default check.
**Fix.** `field(default_factory=...)`, as everywhere else.

## Interview questions

**★ Q: How do you "modify" a frozen dataclass?**
You do not — you construct a replacement. `dataclasses.replace(obj, field=new)`
or `copy.replace(obj, field=new)` (3.13+) creates a new instance of the same
type with the listed fields changed. For dataclasses it goes through
`__init__`, so validation and `__post_init__` run on the new object.

**★ Q: `NamedTuple` or frozen dataclass — how do you choose?**
`NamedTuple` when tuple behaviour is wanted: indexing, unpacking, comparing
with plain tuples, minimum memory. Frozen dataclass when you want a real class:
methods, `__post_init__` validation, ordinary inheritance, and equality that
does not accidentally match an unrelated tuple. Beyond a handful of fields, the
dataclass is almost always the better default.

**★ Q: If everything is immutable, how do you build anything?**
Mutable locally, immutable at the boundary. Build with a list or dict inside
the function — where the object is unaliased and mutation is free — and freeze
once when you return. Repeatedly replacing an immutable accumulator in a loop
is the anti-pattern, because it is quadratic.

**Q: What is the difference between a value and an entity, and why does it
matter here?**
A value is fully described by its contents and is interchangeable with any
equal value; an entity has identity that persists as its contents change. Values
should be immutable with content equality, which makes aliasing them harmless.
Entities are mutable by nature; aliasing them is the thing you have to manage
with ownership rules, copies and boundaries.

**Q: When is immutability the wrong choice?**
Large buffers and arrays where copy-on-change is prohibitive, hot loops where
per-iteration allocation shows up in a profile, genuine entities with a
lifecycle, and incremental accumulation. In all of those, mutate deliberately
and control ownership instead.

**Q: Does `copy.replace` work on any object?**
No. The docs state it supports named tuples from `namedtuple()`, dataclasses,
and *"other classes which define method `__replace__()`"*. It is intentionally
narrower than `copy`/`deepcopy` — it is a "same type, some fields different"
operation, not a general copier.

**Q: Your team has a config dict shared by twenty modules. What is the
refactor?**
Model it as a frozen dataclass (or a `MappingProxyType` over immutable values)
built once at startup, and give the few places that need variations a
`replace`-based derivation instead of mutation. That converts "who edited the
config?" from an investigation into a compile-time-ish impossibility, and it is
the same move as
[Where it bites: the shared config](11-where-it-bites.md).

---

← Prev: [Hashability and dict keys](09b-hashability-and-dict-keys.md) · Index: [Assignment and aliasing](README.md) · Next → [Read-only views and boundary types](10b-read-only-views-and-boundaries.md)
