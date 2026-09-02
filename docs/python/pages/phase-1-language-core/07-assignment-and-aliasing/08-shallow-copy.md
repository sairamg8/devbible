---
title: "A shallow copy duplicates the container and shares everything inside it, which is the right answer far more often than deepcopy and the wrong one in exactly one situation"
sidebar_label: "8 · Shallow copy"
sidebar_position: 85
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09 against the Python 3.14
> [`copy` — Shallow and deep copy operations](https://docs.python.org/3.14/library/copy.html),
> [Built-in Types](https://docs.python.org/3.14/library/stdtypes.html#mutable-sequence-types),
> the [Programming FAQ — "How do I copy an object in Python?"](https://docs.python.org/3.14/faq/programming.html#how-do-i-copy-an-object-in-python),
> and [`collections.abc`](https://docs.python.org/3.14/library/collections.abc.html).
> Target: **CPython 3.14**.

**The `copy` module's one-sentence definition is the whole concept: a shallow
copy *"constructs a new compound object and then (to the extent possible)
inserts references into it to the objects found in the original."* New
container, same contents. That makes adding, removing and replacing elements
private to the copy, and mutating an element visible to both. Nearly every
"defensive copy" you should write is this one; `deepcopy` is the exception you
reach for when the elements themselves are containers you will write into.**

## The definitions, verbatim

> *"A shallow copy constructs a new compound object and then (to the extent
> possible) inserts references into it to the objects found in the original."*
>
> *"A deep copy constructs a new compound object and then, recursively, inserts
> copies into it of the objects found in the original."*

The parenthetical *"to the extent possible"* is doing quiet work: for an
immutable object there is nothing to construct, so `copy.copy` may hand back
the original. That is safe by the same argument as everywhere else in this
topic — sharing an immutable object is unobservable.

## Every spelling, and when to use which

```python
# list
b = list(a)          # preferred: explicit, works on ANY iterable
b = a[:]             # sequence slice; terse, and easy to misread as a[:] = x
b = a.copy()         # method; requires a to actually be a list
b = copy.copy(a)     # generic; needed only when the type is unknown
b = [*a]             # unpacking; fine, slightly less obvious

# dict
b = dict(d)          # preferred
b = d.copy()
b = {**d}
b = copy.copy(d)

# set
b = set(s)  /  s.copy()  /  {*s}  /  copy.copy(s)

# any object
b = copy.copy(obj)   # the general answer for user-defined types
```

Rules of thumb: **`list(x)` / `dict(x)` / `set(x)` for concrete built-ins**, and
`copy.copy` when the type is a parameter you did not choose. `x[:]` is fine but
carries the risk described in
[Targets, binding forms and `del`](01b-assignment-targets-and-del.md) —
on the *left* of `=` the same three characters mean an in-place overwrite.
`x.copy()` is the one that breaks when someone passes a tuple or a generator.

The FAQ's own summary:

> *"In general, try `copy.copy()` or `copy.deepcopy()` for the general case.
> Not all objects can be copied, but most can. Some objects can be copied more
> easily. Dictionaries have a `copy()` method: `newdict = olddict.copy()`.
> Sequences can be copied by slicing: `new_l = l[:]`."*

One footnote from Built-in Types worth knowing before you write a generic
helper:

> *"The `copy()` method is not part of the `MutableSequence` ABC, but most
> concrete mutable sequence types provide it."*

So `x.copy()` is not guaranteed by the interface — `list(x)` and `copy.copy(x)`
are the portable spellings.

## What "shallow" means, concretely

```python
original = {"name": "ada", "tags": ["x", "y"]}
shallow = dict(original)

shallow["name"] = "grace"      # isolated — replaces a binding in the new dict
del shallow["tags"]            # isolated — removes a key from the new dict
shallow["new"] = 1             # isolated

shallow2 = dict(original)
shallow2["tags"].append("z")   # NOT isolated — one list, two dicts
```

The boundary is exact: **operations on the container are private; operations on
the contents are shared.** So a shallow copy is completely sufficient when the
values are immutable (strings, numbers, tuples, frozensets, `None`, frozen
dataclasses) and insufficient the moment a value is a list, dict, set or
mutable instance you intend to write into.

## Copying a user-defined object

`copy.copy(obj)` on an ordinary class creates a new instance of the same class
and gives it a shallow copy of the original's `__dict__`. So:

```python
a = Order(lines=[Line("x")], customer=cust)
b = copy.copy(a)

b.customer = other       # isolated — rebinds an attribute on b
b.lines.append(Line("y"))  # NOT isolated — a.lines is the same list
b.lines is a.lines       # True
```

Which is the identical rule one level up: attributes are rebindable
independently, attribute *values* are shared. `copy.copy` does not call
`__init__`; it constructs the instance through the pickle protocol
(`__reduce_ex__`) unless the class defines `__copy__` — see
[Copy hooks](08c-copy-hooks-and-uncopyable.md).

## Immutable inputs: the copy that is not a copy

```python
t = (1, 2, 3)
copy.copy(t) is t        # True in CPython — nothing to copy
tuple(t) is t            # True in CPython for an exact tuple
"abc"[:] is "abc"        # the same string object
frozenset(f) is f        # for an exact frozenset
```

CPython returns the original for immutable built-ins because a distinct copy
would be indistinguishable and wasteful. The `copy` docs hedge this as *"to the
extent possible"* rather than guaranteeing it, so write code that does not care
— which you can, precisely because the objects are immutable. What you must not
do is conclude "copy returned the same object, so copying is broken"; it is
correct, and it is also why `tuple(x)` is a cheap way to freeze a boundary when
`x` might already be a tuple.

## Where the shallow copy is exactly right

- **Iterating while mutating.** `for item in list(items): items.remove(item)` —
  the copy exists to give the loop a stable sequence, and sharing the elements
  is desired.
- **Freezing a snapshot of keys.** `for key in list(d): del d[key]`.
- **Defensive copy of a flat structure.** `config = dict(config)` where values
  are scalars.
- **Publishing internal state.** `return list(self._items)` — callers can
  reorder their copy without touching yours, and the elements are shared
  deliberately because they are the same domain objects.
- **Detaching a slice.** `page = rows[offset:offset + limit]` is a shallow copy
  of a range of the list.

## Where it is not enough

One situation, stated precisely: **when you will mutate an element, and the
original must not see it.** Nested config dicts, rows-of-lists, an object graph
you are about to edit as a draft. That is
[deepcopy](08b-deepcopy.md)'s territory — and the reason it is a separate
chunk is that `deepcopy` is not free and not always safe.

A third option is often better than either: build the new structure
explicitly.

```python
# instead of deepcopy + edit
updated = {**config, "db": {**config["db"], "host": new_host}}
```

That copies exactly the two levels you are changing, shares everything else,
does not recurse into a socket, and reads as a statement of intent.

## Gotchas

### `dict(config)` taken and the nested values still change
**Symptom.** A "copy" of a config is edited and the original changes too — but
only for some keys.
**Cause.** The copy is one level deep. Top-level keys are isolated; nested
containers are shared.
**Fix.** Copy the levels you will write to (`{**config, "db": {**config["db"]}}`)
or use `copy.deepcopy` if the nesting is deep and irregular.

### `x.copy()` on something that is not a list
**Symptom.** `AttributeError: 'tuple' object has no attribute 'copy'`, or
`'generator' object has no attribute 'copy'`.
**Cause.** `copy()` is a concrete-type method, not part of the
`MutableSequence` ABC.
**Fix.** `list(x)` — which also accepts generators, ranges, tuples and any
iterable — or `copy.copy(x)` if the result must keep the original type.

### `items[:]` written where `items[:] =` was meant, or vice versa
**Symptom.** Either the caller's list is unexpectedly replaced, or a "copy" was
supposed to be a replace and nothing propagated.
**Cause.** On the right of `=` a full slice copies; on the left it overwrites
in place.
**Fix.** Prefer `list(items)` for the copy so the two operations do not look
alike.

### `copy.copy(obj)` did not run `__init__`
**Symptom.** An object copied with `copy.copy` is missing state that `__init__`
computed, or a `__post_init__` side effect never happened.
**Cause.** `copy.copy` reconstructs via the pickle protocol and copies
`__dict__`; it does not call the constructor.
**Fix.** Define `__copy__` to construct properly, or use a purpose-built
`replace`/`clone` method — `dataclasses.replace` calls `__init__`, which the
docs highlight as the reason `__post_init__` runs.

### A shallow copy used to "reset" a shared object
**Symptom.** `self._items = list(self._items)` is added to stop a leak and the
leak continues.
**Cause.** The copy detached the container from other holders *going forward*,
but every element is still shared, and any existing alias of the old list is
unaffected.
**Fix.** Identify what is actually being mutated. If it is an element, the copy
must be deeper; if it is the old list, the other holder needs to be fixed.

### Copying a list of dicts for a test fixture
**Symptom.** Tests pass individually and fail as a suite; one test's edits show
up in another.
**Cause.** `FIXTURE.copy()` shares every dict inside the list, so a test that
edits `rows[0]["x"]` edits the module-level fixture.
**Fix.** `copy.deepcopy(FIXTURE)` in the fixture function, or build the fixture
from a factory so each test constructs its own.

## Interview questions

**★ Q: What is a shallow copy?**
The `copy` docs define it as constructing *"a new compound object"* and
inserting *"references into it to the objects found in the original"*. The
container is new; the contents are the same objects. Structural changes to the
copy — adding, removing, replacing — do not affect the original; mutating a
contained object affects both.

**★ Q: Give three ways to shallow-copy a list, and say which you prefer.**
`list(a)`, `a[:]`, `a.copy()`, plus `copy.copy(a)` and `[*a]`. `list(a)` is the
best default: it is explicit, it works on any iterable rather than only on
lists, and it cannot be confused with slice assignment the way `a[:]` can.
`copy.copy` earns its place when the argument's type is not yours to assume.

**★ Q: `d2 = dict(d1)` — what is shared?**
Every value object. The keys are shared too, but keys must be hashable and are
therefore normally immutable, so it does not matter. Adding, deleting or
reassigning a key in `d2` is invisible to `d1`; calling a mutating method on
`d2[k]` is visible to both.

**Q: Why does `copy.copy` sometimes return the same object?**
For immutable types there is nothing to copy and no way to observe the
difference, so the module returns the original — consistent with its own
qualification *"(to the extent possible)"*. `copy.copy((1, 2))` and
`copy.copy("x")` behave this way in CPython.

**Q: Does `copy.copy` call `__init__`?**
No. It builds the new instance through the copy/pickle machinery —
`__copy__` if the class defines one, otherwise `__reduce_ex__` — and copies the
instance `__dict__` shallowly. If construction has side effects or computes
derived state, define `__copy__` or use an explicit clone method.
`dataclasses.replace` is the counterexample: the docs state it calls
`__init__`, *"This ensures that `__post_init__()`, if present, is also
called."*

**Q: Is `x.copy()` always available on a mutable sequence?**
No — Built-in Types notes that `copy()` *"is not part of the MutableSequence
ABC, but most concrete mutable sequence types provide it"*. Use `list(x)` or
`copy.copy(x)` in generic code.

**Q: You need to delete items from a list while looping over it. What do you
write?**
`for item in list(items):` and then mutate `items` inside the loop — the
shallow copy gives the iteration a stable sequence while the elements stay
shared, which is exactly what you want. The alternative is to build a new list
with a comprehension and rebind, which is usually clearer and is required if
other code holds the original.

**Q: When is a shallow copy definitively insufficient?**
When you will mutate an object *inside* the copy and the original must not see
that mutation. Flat structures of immutable values never need more; nested
mutable structures do — either a targeted per-level copy or `copy.deepcopy`.

---

← Prev: [Shadowing, ClassVar and descriptors](07b-shadowing-and-classvar.md) · Index: [Assignment and aliasing](README.md) · Next → [deepcopy](08b-deepcopy.md)
