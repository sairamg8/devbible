---
title: "Reading falls back to the class and writing always lands on the instance, which makes class-level defaults a real pattern and a real trap in the same three lines"
sidebar_label: "7b · Shadowing, ClassVar and descriptors"
sidebar_position: 84
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09 against the Python 3.14 Language Reference
> [§7.2 Assignment statements](https://docs.python.org/3.14/reference/simple_stmts.html#assignment-statements)
> (the note on class and instance attributes),
> [§3.3.2 Implementing descriptors](https://docs.python.org/3.14/reference/datamodel.html#implementing-descriptors),
> [`typing.ClassVar`](https://docs.python.org/3.14/library/typing.html#typing.ClassVar),
> [`vars()`](https://docs.python.org/3.14/library/functions.html#vars),
> and [`__slots__`](https://docs.python.org/3.14/reference/datamodel.html#slots).
> Target: **CPython 3.14**.

**The same asymmetry that hides a shared mutable attribute also powers a
legitimate and widely used pattern: class-level defaults that instances may
override individually. The rule to internalise is that an instance write
*shadows* rather than *updates*, permanently and silently, and that
descriptors — `@property`, slots, anything with `__set__` — are the documented
exception to it.**

## When a class attribute is right

Class attributes are not the problem; *mutable* ones used as per-instance state
are. These are correct and idiomatic:

```python
class HttpClient:
    DEFAULT_TIMEOUT = 30.0                       # immutable constant
    RETRYABLE: ClassVar[frozenset[int]] = frozenset({502, 503, 504})
    _instances: ClassVar[list["HttpClient"]] = []    # deliberately shared registry
```

`typing.ClassVar` is the annotation that says "this is class-level and shared on
purpose"; it is what distinguishes a registry from a mistake, it stops
`@dataclass` treating the attribute as a field, and it silences ruff's RUF012
by asserting intent rather than by fixing anything. Prefer immutable values —
`frozenset`, `tuple`, `types.MappingProxyType` over a dict — so that even the
deliberate sharing cannot be edited by accident.

## Where the shadowing bites you back

The read-falls-back/write-creates asymmetry produces a second, quieter class of
bug — attributes that *look* shared and are not:

```python
class Config:
    retries = 3

c = Config()
c.retries += 1          # creates c.retries = 4; Config.retries is still 3
Config.retries = 5      # every instance WITHOUT a shadow now sees 5
c.retries               # 4 — c has its own, and no longer tracks the class
del c.retries           # removes the shadow; c.retries is 5 again
```

So "change the default at runtime and all objects pick it up" works only for
instances that never wrote to the attribute. Mixing class-level defaults with
per-instance overrides is a legitimate pattern (Django's `Meta`, many ORM and
form libraries use it), but it must be a deliberate design, and `del inst.attr`
is the documented way to un-shadow.

Note also the reference's caveat: *"This description does not necessarily apply
to descriptor attributes"*. A `@property`, a `__slots__` slot, or any data
descriptor defines `__set__`, and data descriptors take precedence over the
instance `__dict__` — so `inst.x = v` calls the descriptor rather than creating
a shadow. `__slots__`, incidentally, does not protect you here at all: a slot
holding a list still holds one list per instance, which is fine, but a
class-level `items = []` alongside `__slots__` is still shared.

## What a shadow costs

Once `inst.x` exists in the instance `__dict__`, that instance has opted out of
the class default forever. There is no notification, no "linked" state, and
`del inst.x` is the only way back. Designs that rely on "change the class
attribute and everything picks it up" therefore work exactly until the first
instance-level override — which is often a test fixture, which is why this
manifests as "the test suite passes and one test in isolation does not".

If you want defaults that *stay* linked, use a lookup rather than an attribute:

```python
class Config:
    _DEFAULTS = types.MappingProxyType({"timeout": 30, "retries": 3})

    def __init__(self, **overrides):
        self._overrides = dict(overrides)

    def __getattr__(self, name):          # only called when normal lookup fails
        try:
            return self._overrides.get(name, Config._DEFAULTS[name])
        except KeyError:
            raise AttributeError(name) from None
```

Now the default is consulted on every read, so changing it is visible to every
instance that has not overridden it — which is the behaviour people *thought*
class attributes had.

## Gotchas

### `self.count += 1` does not update the class counter
**Symptom.** A class-level counter stays at its initial value; every instance
counts alone.
**Cause.** The read finds the class attribute, the write creates an instance
attribute — the reference's `inst.x = inst.x + 1` note exactly.
**Fix.** `type(self).count += 1` if a shared counter is intended, and then deal
with the fact that it is unsynchronised shared state.

### Changing a class default stops affecting an instance
**Symptom.** `Config.timeout = 60` updates most objects and not one particular
one.
**Cause.** That instance previously assigned `self.timeout`, creating a shadow
that wins every subsequent read.
**Fix.** `del inst.timeout` to remove the shadow, or stop using class
attributes as live defaults and pass values through `__init__`.

### `__slots__` assumed to prevent it
**Symptom.** A class with `__slots__` still shares a list between instances.
**Cause.** `__slots__` removes the instance `__dict__`; it says nothing about
class attributes. A `class C: __slots__ = ("a",); items = []` still has one
`items`. (Naming the same attribute in both places raises `ValueError` at class
creation, which is a different error entirely.)
**Fix.** Initialise per-instance state in `__init__`, as always.

### A `@property` that does not shadow
**Symptom.** `inst.x = 5` raises `AttributeError: can't set attribute` on a
class where other attributes accept assignment fine.
**Cause.** `@property` creates a data descriptor. Data descriptors take
precedence over the instance `__dict__`, so the assignment goes to the
descriptor's `__set__` — and a property with no setter has none. The reference
flags this: *"This description does not necessarily apply to descriptor
attributes, such as properties created with `@property`."*
**Fix.** Add a setter if assignment should be allowed, or use a plain attribute.

### `del inst.attr` raising `AttributeError` on an inherited default
**Symptom.** Trying to "reset to the class default" fails.
**Cause.** `del` on an attribute removes it from the *instance* `__dict__`; if
the instance never shadowed it, there is nothing there to delete and the class
attribute is not deletable through the instance.
**Fix.** Guard with `vars(inst).pop("attr", None)`, which removes a shadow if
one exists and is a no-op otherwise.

## Interview questions

**★ Q: Why does `self.count += 1` behave differently from
`self.items.append(x)` when both attributes are defined on the class?**
`+=` is an assignment, and the reference states the left-hand side *"is always
set as an instance attribute, creating it if necessary"* — so the first `+=`
forks a per-instance copy and the class attribute stays put. `.append` is not
an assignment at all, so it reaches the shared class-level object.


**Q: What is `typing.ClassVar` for?**
It marks an attribute as class-level and shared. Practically: it tells a type
checker that instances must not assign to it, it tells `@dataclass` not to treat
the attribute as a field, and it documents deliberate sharing so a reviewer
does not "fix" it. It is not a runtime guard.


**Q: Does `__slots__` prevent shared class attributes?**
No. `__slots__` eliminates the per-instance `__dict__` and reserves storage for
named attributes; a class-level `items = []` defined alongside it is still one
object shared by all instances. (Defining the same name in `__slots__` and as a
class attribute is an error at class creation, but that is a different problem.)


**Q: Is there a case where a mutable class attribute is the right design?**
Yes — a deliberate registry or cache that is genuinely per-class: plugin
tables, interned instances, memo dictionaries. Mark them `ClassVar`, give them
a leading underscore, and if concurrency is in play, guard them. What makes the
common case a bug is that the attribute was meant to be per-instance state.

**★ Q: `Config.timeout = 60` updates most instances but not one. Why?**
That instance previously assigned `self.timeout`, which — per the reference —
*"is always set as an instance attribute, creating it if necessary"*. The
instance `__dict__` entry shadows the class attribute on every subsequent read,
so the class-level change cannot reach it. `del inst.timeout` removes the
shadow.

**Q: Why is `@property` an exception to the "writes always create an instance
attribute" rule?**
Because a property is a data descriptor — it defines `__set__` — and data
descriptors are consulted before the instance `__dict__` on both read and
write. So `inst.x = v` calls `property.__set__`, which either runs your setter
or raises. The reference explicitly excludes descriptors from the note about
class and instance attributes.

**Q: How would you implement class-level defaults that stay live?**
Not with a plain class attribute, since the first instance write breaks the
link permanently. Consult the default on each read instead: a `__getattr__`
fallback into a defaults mapping, a `property` that reads the class value, or
an explicit `get(name)` method. Store the defaults in something immutable —
`MappingProxyType` or a frozen dataclass — so they cannot be edited by
accident.

---

← Prev: [Class-attribute aliasing](07-class-attribute-aliasing.md) · Index: [Assignment and aliasing](README.md) · Next → [Shallow copy](08-shallow-copy.md)
