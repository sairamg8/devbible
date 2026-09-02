---
title: "`@dataclass` turns the mutable-default bug into a `ValueError` at class-creation time, but only for unhashable defaults, which is why the linters still matter"
sidebar_label: "6c · Dataclass defaults and linting"
sidebar_position: 81
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09 against the Python 3.14
> [`dataclasses` — mutable default values](https://docs.python.org/3.14/library/dataclasses.html#mutable-default-values),
> [`dataclasses.field`](https://docs.python.org/3.14/library/dataclasses.html#dataclasses.field),
> and the Ruff rule pages
> [B006](https://docs.astral.sh/ruff/rules/mutable-argument-default/),
> [B008](https://docs.astral.sh/ruff/rules/function-call-in-default-argument/),
> [B039](https://docs.astral.sh/ruff/rules/mutable-contextvar-default/),
> [RUF008](https://docs.astral.sh/ruff/rules/mutable-dataclass-default/),
> [RUF012](https://docs.astral.sh/ruff/rules/mutable-class-default/).
> Target: **CPython 3.14**, Ruff current.

**`@dataclass` is the one place in the language where the mutable-default bug
is detected for you. It raises `ValueError` when a field's default is
unhashable, on the grounds that unhashable is a decent proxy for mutable — and
the documentation is honest that this is *"a partial solution"*. Understanding
exactly what it catches, what slips past it, and which linter rules cover the
gaps is the difference between "the framework protects me" and knowing where
you are still exposed.**

## Why `@dataclass` has to care at all

The docs walk through it starting from a plain class, and the plain-class case
is the one worth memorising because it is [class-attribute
aliasing](07-class-attribute-aliasing.md) in miniature:

> ```python
> class C:
>     x = []
>     def add(self, element):
>         self.x.append(element)
>
> o1 = C()
> o2 = C()
> o1.add(1)
> o2.add(2)
> assert o1.x == [1, 2]
> assert o1.x is o2.x
> ```
>
> *"Note that the two instances of class C share the same class variable x, as
> expected."*

A dataclass field with a default is compiled into exactly that shape — a class
attribute used as a parameter default:

> *"it would generate code similar to:"*
>
> ```python
> class D:
>     x = []
>     def __init__(self, x=x):
>         self.x = x
>     def add(self, element):
>         self.x.append(element)
>
> assert D().x is D().x
> ```
>
> *"This has the same issue as the original example using class C. […] There is
> no general way for Data Classes to detect this condition. Instead, the
> `@dataclass` decorator will raise a `ValueError` if it detects an unhashable
> default parameter. The assumption is that if a value is unhashable, it is
> mutable. This is a partial solution, but it does protect against many common
> errors."*

`assert D().x is D().x` is the sentence to carry away: without the check, two
freshly constructed instances would share one list.

## What the check actually tests

> **Changed in version 3.11:** *"Instead of looking for and disallowing objects
> of type `list`, `dict`, or `set`, unhashable objects are now not allowed as
> default values. Unhashability is used to approximate mutability."*

So the rule since 3.11 is **`hash(default)` must not raise**. Consequences:

```python
@dataclass
class D:
    a: list = []            # ValueError — list is unhashable
    b: dict = {}            # ValueError
    c: set = set()          # ValueError
    d: tuple = ()           # fine — hashable and immutable
    e: frozenset = frozenset()   # fine
    f: MyMutable = MyMutable()   # ALLOWED if MyMutable is hashable — and it is shared
```

That last line is the hole. A user-defined class is hashable by default (the
glossary: *"Objects which are instances of user-defined classes are hashable by
default […] their hash value is derived from their `id()`"*), so an ordinary
mutable object passes the check and is shared by every instance that takes the
default. `@dataclass(eq=True)` on the *inner* class sets its `__hash__` to
`None`, which would make it unhashable and get it caught — but a plain class,
an `attrs` class with `eq=False`, a `Counter` subclass with a custom
`__hash__`, or anything holding a mutable buffer sails through.

## `field(default_factory=...)` is the fix

> *"default_factory: If provided, it must be a zero-argument callable that will
> be called when a default value is needed for this field. Among other
> purposes, this can be used to specify fields with mutable default values, as
> discussed below. It is an error to specify both default and
> default_factory."*

```python
from dataclasses import dataclass, field

@dataclass
class D:
    x: list[int] = field(default_factory=list)

# the docs' own assertion:
assert D().x is not D().x
```

`default_factory=list` — the callable, not `list()`. For a non-trivial default,
a lambda or a named function:

```python
@dataclass
class Job:
    tags: list[str] = field(default_factory=list)
    limits: dict[str, int] = field(default_factory=lambda: {"retries": 3})
    started: datetime = field(default_factory=datetime.now)   # per-instance, per-call
```

That last field is the fix for the frozen-timestamp problem from
[The mutable default argument](06-mutable-default-argument.md): a
`default_factory` is called at construction time, so `datetime.now` produces a
real timestamp per instance instead of the import time.

## `field()` also solves the mutable-in-a-frozen-dataclass shape

`frozen=True` prevents rebinding attributes and does nothing to the objects
they refer to — see
[Raises *and* mutates](04b-tuple-item-raises-and-mutates.md). So the
combination that actually gives you an immutable record is a frozen dataclass
whose fields are immutable types:

```python
@dataclass(frozen=True)
class Config:
    hosts: tuple[str, ...] = ()
    flags: frozenset[str] = frozenset()

    def __post_init__(self):
        # accept lists from callers, store tuples
        object.__setattr__(self, "hosts", tuple(self.hosts))
```

`object.__setattr__` is the documented escape hatch inside `__post_init__`,
necessary because the generated `__setattr__` raises `FrozenInstanceError` —
the docs note *"`__init__()` cannot use simple assignment to initialize fields,
and must use `object.__setattr__()`"* for exactly this reason.

Also worth knowing, because it interacts with everything in
[Hashability](09b-hashability-and-dict-keys.md):

> *"If eq and frozen are both true, by default `@dataclass` will generate a
> `__hash__()` method for you. If eq is true and frozen is false, `__hash__()`
> will be set to `None`, marking it unhashable (which it is, since it is
> mutable)."*

## Gotchas

### `ValueError: mutable default <class 'list'> for field ...`
**Symptom.** A dataclass fails at import time, not at instantiation.
**Cause.** The decorator ran when the class body was executed and rejected an
unhashable default. This is the check working.
**Fix.** `field(default_factory=list)`. Never work around it by making the
default hashable.

### A mutable default that `@dataclass` accepts
**Symptom.** Every instance of a dataclass shares one object, and no
`ValueError` was raised.
**Cause.** The default is an instance of a user-defined class, which is
hashable by default, so the unhashability heuristic — explicitly *"a partial
solution"* — does not fire.
**Fix.** `field(default_factory=MyThing)`. Assume the check catches only
`list`, `dict`, `set` and their unhashable relatives.

### `field(default_factory=list())`
**Symptom.** `TypeError: 'list' object is not callable` at construction.
**Cause.** A value was passed where a callable was required — the same one
character as `defaultdict([])`.
**Fix.** `default_factory=list`.

### Both `default` and `default_factory`
**Symptom.** `ValueError` at class creation.
**Cause.** The docs: *"It is an error to specify both default and
default_factory."*
**Fix.** Choose. An immutable constant belongs in `default`; anything that must
be constructed per instance belongs in `default_factory`.

### A dataclass field defaulted to another dataclass instance
**Symptom.** Every `Job` shares one `Limits` object; changing
`job.limits.retries` changes it for every job that took the default.
**Cause.** `limits: Limits = Limits()` is a single instance created when the
class body ran. Whether it raises depends entirely on whether `Limits` is
hashable — a frozen dataclass is, an `eq=True` non-frozen one is not.
**Fix.** `field(default_factory=Limits)`, or make the inner class frozen with
immutable fields so sharing is harmless.

### `__post_init__` assignment on a frozen dataclass raises
**Symptom.** `FrozenInstanceError` inside your own `__post_init__` while
normalising a field.
**Cause.** The generated `__setattr__` raises for every attribute assignment,
including ones made during construction.
**Fix.** `object.__setattr__(self, "field", value)` — the same mechanism the
generated `__init__` uses, which the docs note is required because
*"`__init__()` cannot use simple assignment to initialize fields"*.

## Interview questions

**★ Q: Why does `@dataclass class D: x: list = []` raise?**
Because a dataclass field default becomes a class attribute that is also the
`__init__` parameter default, so every instance taking the default would share
one list — `D().x is D().x` would be true. The decorator raises `ValueError`
when it detects an unhashable default, on the assumption that unhashable
implies mutable. The fix is `field(default_factory=list)`, which the docs
demonstrate with `assert D().x is not D().x`.


**★ Q: What exactly does the dataclass check test, and what does it miss?**
Since 3.11 it tests hashability of the default rather than looking for `list`,
`dict` or `set` specifically — the docs say *"Unhashability is used to
approximate mutability"* and call it *"a partial solution"*. It misses any
mutable object that is still hashable, which includes ordinary instances of
user-defined classes, since those hash by identity by default.


**Q: What is the difference between `default` and `default_factory`?**
`default` stores one object on the class and reuses it for every instance.
`default_factory` stores a zero-argument callable and invokes it whenever a
default is needed, producing a new object per instance. Specifying both is an
error. It is the same value-versus-factory distinction as `dict.fromkeys(keys,
[])` versus `defaultdict(list)`.


**Q: How do you give a dataclass field a default of "now"?**
`field(default_factory=datetime.now)` — the callable, not `datetime.now()`.
Written as a plain default it would be evaluated once when the class body runs
and every instance would carry the import-time timestamp.


**Q: Does `frozen=True` plus a `list` field give you an immutable record?**
No. `frozen=True` only blocks attribute rebinding — the docs describe it as
emulating immutability — so `obj.items.append(x)` still works. An immutable
record needs immutable field *types*: `tuple[...]`, `frozenset[...]`, other
frozen dataclasses, converted in `__post_init__` via `object.__setattr__` if
callers pass lists.

**Q: Where does a dataclass field's default physically live?**
On the class, as a class attribute, which is then used as the default of the
generated `__init__` parameter. The docs show the generated shape explicitly —
`class D: x = []` with `def __init__(self, x=x)`. That is why the dataclass
case and the plain class-attribute case are the same bug, and why
`assert D().x is D().x` would hold without the check.

**Q: Does `default_factory` run once or per instance?**
Per instance, and only when the field's value is not supplied by the caller. It
is a zero-argument callable invoked from the generated `__init__`, which is
what makes `datetime.now`, `uuid.uuid4`, `list` and `dict` all correct as
factories and all wrong as defaults.

---

← Prev: [Fixing mutable defaults](06b-fixing-mutable-defaults.md) · Index: [Assignment and aliasing](README.md) · Next → [Linting the whole family](06d-linting-mutable-defaults.md)
