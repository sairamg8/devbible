---
title: "A mutable class attribute is one object shared by every instance, and it survives because reading falls back to the class while writing always lands on the instance"
sidebar_label: "7 · Class-attribute aliasing"
sidebar_position: 83
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09 against the Python 3.14 Language Reference
> [§7.2 Assignment statements](https://docs.python.org/3.14/reference/simple_stmts.html#assignment-statements)
> (the note on class and instance attributes),
> [§3.3 Customizing attribute access](https://docs.python.org/3.14/reference/datamodel.html#customizing-attribute-access),
> [`dataclasses` — mutable default values](https://docs.python.org/3.14/library/dataclasses.html#mutable-default-values),
> and [`typing.ClassVar`](https://docs.python.org/3.14/library/typing.html#typing.ClassVar).
> Target: **CPython 3.14**.

**`class Cart: items = []` gives the whole program one list. Every instance
that calls `self.items.append(x)` writes into it, because attribute *reads*
fall through to the class when the instance has no such attribute, while
attribute *writes* always create an instance attribute. So the mutation path
finds the shared object and the rebinding path never does — which is exactly
why `self.count += 1` on a class attribute appears to work per-instance while
`self.items.append(x)` is silently global.**

## The asymmetry, from the reference

The note in §7.2 is the whole mechanism, stated by the language itself:

> *"If the object is a class instance and the attribute reference occurs on
> both sides of the assignment operator, the right-hand side expression, `a.x`
> can access either an instance attribute or (if no instance attribute exists)
> a class attribute. The left-hand side target `a.x` is always set as an
> instance attribute, creating it if necessary. Thus, the two occurrences of
> `a.x` do not necessarily refer to the same attribute"*
>
> ```python
> class Cls:
>     x = 3             # class variable
> inst = Cls()
> inst.x = inst.x + 1   # writes inst.x as 4 leaving Cls.x as 3
> ```
>
> *"This description does not necessarily apply to descriptor attributes, such
> as properties created with `@property`."*

Now apply it to a mutable attribute. `self.items.append(x)` contains **no
assignment at all** — it is a read (`self.items`, which falls back to the class)
followed by a method call on the object found. There is no left-hand side to
create an instance attribute, so nothing shadows the class attribute, ever.

## The bug in full

```python
class Cart:
    items = []                     # ONE list for the entire process

    def add(self, product):
        self.items.append(product) # reads Cart.items, mutates Cart.items

a, b = Cart(), Cart()
a.add("apple")
b.items                            # ["apple"] — b never added anything
Cart.items                         # ["apple"] — and the class itself holds it
a.items is b.items                 # True
```

The dataclasses docs give the identical example and its assertions:

> ```python
> o1 = C(); o2 = C()
> o1.add(1); o2.add(2)
> assert o1.x == [1, 2]
> assert o1.x is o2.x
> ```

Two carts, one basket. In a web process the "entire process" part is the
severe half: the list is never garbage collected, it grows for the life of the
worker, and every user sees every other user's items.

## The fix is one line in `__init__`

```python
class Cart:
    def __init__(self):
        self.items = []            # a NEW list per instance, bound on the instance
```

Or, with a dataclass, the `default_factory` form from
[Dataclass defaults](06c-dataclass-defaults-and-linting.md):

```python
@dataclass
class Cart:
    items: list[str] = field(default_factory=list)
```

Both do the same thing: run the constructor expression once **per instance**
rather than once per class definition.

## Inheritance makes the sharing wider than the class

```python
class Base:
    registry = []                     # every subclass shares this ONE list

class A(Base): pass
class B(Base): pass

A.registry.append("a")
B.registry                            # ["a"] — B inherited the same object
```

A subclass does not get a copy of the base's attributes; it gets a lookup that
falls through to the base's `__dict__`. So a plugin registry declared on a base
class collects every subclass's entries into one bucket. The per-subclass fix
is `__init_subclass__`:

```python
class Base:
    registry: ClassVar[list[str]]

    def __init_subclass__(cls, **kw):
        super().__init_subclass__(**kw)
        cls.registry = []             # a fresh list bound on EACH subclass
```

Assigning `A.registry = [...]` in one subclass also works and is easy to forget
in the next one; `__init_subclass__` makes it automatic.

## Diagnosing it

```python
vars(instance)            # the instance __dict__ — what this object actually owns
type(instance).__dict__   # what the class owns; a mappingproxy
"items" in vars(instance) # False means every read is hitting the class
a.items is b.items        # the direct question
```

`vars()` returns the instance `__dict__` and the class's is a
`types.MappingProxyType`, which is why you cannot assign into
`SomeClass.__dict__` directly — the docs note that *"classes use a
`types.MappingProxyType` to prevent direct dictionary updates"*.

## Gotchas

### Every instance shares one list
**Symptom.** A second object is created and already has the first object's
data; in a server, every request sees every other request's items.
**Cause.** `class C: items = []` — one list created when the class body
executed, reached by every `self.items` read because no instance attribute
shadows it.
**Fix.** Assign in `__init__`, or `field(default_factory=list)` in a dataclass.

### A base-class registry collects every subclass's entries
**Symptom.** `PluginA.handlers` contains `PluginB`'s handlers.
**Cause.** Attribute lookup falls through to the base's `__dict__`; subclasses
share the one object.
**Fix.** `__init_subclass__` assigning a fresh container on `cls`, or an
explicit per-subclass assignment.

### A mutable class attribute that a linter did not flag
**Symptom.** RUF012 is enabled and a shared attribute got through.
**Cause.** The default was `MyThing()` or a module-level name rather than a
`[]`/`{}`/`set()` literal, which is what the rule matches.
**Fix.** Review class bodies for any attribute whose value is constructed. If
it is not an immutable constant, it belongs in `__init__`.

### Mutating a class attribute through an instance in a thread pool
**Symptom.** Corrupted or missing entries under concurrency, no exception.
**Cause.** `self.shared_list.append(x)` from many threads is a mutation of one
process-wide object with no lock.
**Fix.** Per-instance state, or explicit synchronisation if the sharing is
intentional. `list.append` happens to be atomic under CPython's GIL, but
read-modify-write sequences over the same list are not, and the free-threaded
build removes the incidental protection.

### A "cache" on the class that never empties
**Symptom.** Memory grows for the life of the process and no object appears to
own the data.
**Cause.** `class Service: _cache = {}` is reachable from the class object,
which is reachable from the module, which lives until interpreter shutdown.
Nothing in the instance lifecycle can free it.
**Fix.** Per-instance state, or an explicitly bounded cache
(`functools.lru_cache(maxsize=...)`, `cachetools.TTLCache`) so the growth has a
ceiling — and see
[Caches and long-lived workers](11c-caches-workers-and-orm.md) for the
second problem a cache of mutable objects has.

## Interview questions

**★ Q: `class C: items = []` — what happens when two instances both call
`self.items.append(x)`?**
Both append to the same list, because `self.items` is a read that falls through
to the class attribute and `append` mutates the object it finds. No instance
attribute is ever created, since there is no assignment. `c1.items is c2.items`
is true, and the list persists for the life of the class object.


**★ Q: How do you fix a shared mutable class attribute?**
Bind it per instance: `self.items = []` in `__init__`, or
`field(default_factory=list)` in a dataclass. If the sharing is genuinely
wanted, annotate it `ClassVar` so the intent is explicit and prefer an
immutable value.


**Q: Does a subclass get its own copy of a base class's attributes?**
No. Lookup walks the MRO, so a subclass with no attribute of its own reads the
base's object. A mutable base attribute is therefore shared across every
subclass. `__init_subclass__` assigning a fresh object to `cls` is the standard
per-subclass fix.


**Q: How would you detect this bug in a running program?**
`a.attr is b.attr` for two fresh instances, or `"attr" in vars(a)` — if the
attribute is missing from the instance `__dict__`, every read is hitting the
class. `type(a).__dict__` shows what the class owns; it is a
`MappingProxyType`, which is why you cannot write into it directly.


**Q: Why does the bug survive so easily in review?**
Because the class body reads like a declaration of shape — `items: list = []`
looks like "instances have a list" — while it is actually an executable
statement that creates one object and attaches it to the class. Nothing at the
call site looks wrong either: `self.items.append(x)` is exactly what correct
code looks like. Only a second instance reveals it.

**Q: When does the shared attribute get created, and when is it freed?**
Created when the `class` statement executes, which is at import time for a
module-level class. Freed when the class object itself is collected, which for
a module-level class is at interpreter shutdown. That lifetime is why this bug
is a memory leak as well as a correctness bug in a long-running server.

---

← Prev: [Linting the whole family](06d-linting-mutable-defaults.md) · Index: [Assignment and aliasing](README.md) · Next → [Shadowing, ClassVar and descriptors](07b-shadowing-and-classvar.md)
