---
title: "`__copy__`, `__deepcopy__` and the pickle protocol let a class decide what copying means, which is the only correct answer for objects that own a socket, a lock or a session"
sidebar_label: "8c · Copy hooks and uncopyable objects"
sidebar_position: 87
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09 against the Python 3.14
> [`copy`](https://docs.python.org/3.14/library/copy.html),
> [`pickle` — `__getstate__`/`__setstate__`/`__reduce_ex__`](https://docs.python.org/3.14/library/pickle.html#pickling-class-instances),
> [`dataclasses.replace`](https://docs.python.org/3.14/library/dataclasses.html#dataclasses.replace),
> and [`copyreg`](https://docs.python.org/3.14/library/copyreg.html).
> Target: **CPython 3.14**.

**"Just deepcopy it" is not a safe default because a large share of real objects
are not copyable in any meaningful sense. A lock has identity as its entire
purpose; a database session is a handle to a remote thing; a socket is a file
descriptor the kernel owns. Python's answer is not to guess — it is to let the
class say, through `__copy__`, `__deepcopy__` or the pickle protocol, what a
copy of it means. Writing those three methods correctly, including the memo
registration, is what separates a class you can safely put in a copied graph
from one that will fail confusingly.**

## The hooks, verbatim

> **`object.__copy__(self)`** — *"Called to implement the shallow copy
> operation; no additional arguments are passed."*

> **`object.__deepcopy__(self, memo)`** — *"Called to implement the deep copy
> operation; it is passed one argument, the memo dictionary. If the
> `__deepcopy__` implementation needs to make a deep copy of a component, it
> should call the `deepcopy()` function with the component as first argument
> and the memo dictionary as second argument. The memo dictionary should be
> treated as an opaque object."*

> **`object.__replace__(self, /, **changes)`** *(added 3.13)* — *"This method
> should create a new object of the same type, replacing fields with values
> from changes."*

> **`copy.Error`** — *"Raised for module specific errors."*

If a class defines neither `__copy__` nor `__deepcopy__`, `copy` falls back to
the pickle protocol — `__reduce_ex__`, `__reduce__`, `__getstate__` /
`__setstate__`, and functions registered in `copyreg`. That is why "copyable"
and "picklable" overlap so heavily, and why a class that cannot be pickled
usually cannot be copied either.

## Writing `__deepcopy__` correctly

Three rules, and the second is the one everyone forgets:

1. Build the new instance without running side effects.
2. **Register it in the memo before recursing**, so a cycle back to `self`
   finds the copy instead of recursing forever.
3. Recurse with `copy.deepcopy(component, memo)` — passing the memo along is
   what preserves cycles and shared references across the whole pass.

```python
import copy

class Client:
    def __init__(self, session, cache):
        self._session = session      # a live connection — must NOT be copied
        self._cache = cache          # ordinary data — should be copied

    def __deepcopy__(self, memo):
        new = object.__new__(type(self))
        memo[id(self)] = new                      # rule 2, before any recursion
        new._session = self._session              # shared on purpose
        new._cache = copy.deepcopy(self._cache, memo)
        return new

    def __copy__(self):
        new = object.__new__(type(self))
        new.__dict__.update(self.__dict__)        # shallow: share everything
        return new
```

The equivalent via the pickle protocol, which also fixes `pickle`, is
`__getstate__`/`__setstate__`:

```python
class Client:
    def __getstate__(self):
        state = self.__dict__.copy()
        state["_session"] = None      # drop the unpicklable/uncopyable part
        return state

    def __setstate__(self, state):
        self.__dict__.update(state)
        self._session = None          # caller must re-attach
```

This is the more common approach in libraries, because it serves `copy`,
`pickle`, `multiprocessing` and caching in one place. Its cost is that the copy
comes back with a hole in it, so the class needs a documented way to re-attach.

## The singleton hook

For an object that must never be duplicated — a connection pool, a registry, a
sentinel, a configured logger — the correct hooks are two lines:

```python
class Pool:
    def __copy__(self):     return self
    def __deepcopy__(self, memo):  return self
```

Now the object can sit anywhere in a graph that gets deep-copied and simply
passes through. This is the same behaviour the `copy` module already gives
functions, classes and modules: *"It does 'copy' functions and classes (shallow
and deeply), by returning the original object unchanged."*

## What the module refuses, and what actually happens

> *"This module does not copy types like module, method, stack trace, stack
> frame, file, socket, window, or any similar types."*

Read that as a statement of *scope* rather than a promise about behaviour.
Objects of those kinds have no meaningful copy, and what you observe when one
turns up inside a `deepcopy` depends on the type: some are returned unchanged,
and others raise from the pickle fallback because they define no `__reduce__`.
A `threading.Lock`, for example, is not picklable, and `copy.deepcopy` of a
structure containing one raises rather than quietly sharing it. I have not
found a documented, per-type table of which does which, so the honest guidance
is: **do not let these objects into a graph you intend to copy**, and if they
must live there, give their owning class an explicit hook.

The list of things to look for before calling `deepcopy` on an unfamiliar
object: open files and `io` objects, sockets, `threading` and `multiprocessing`
primitives, database connections/cursors/sessions, HTTP client sessions and
connection pools, loggers and handlers, generators and iterators, frames and
tracebacks, C extension objects holding native handles, and anything holding a
`weakref` to something that is about to be copied.

## `copy.replace()` — the 3.13 addition worth adopting

> *"Creates a new object of the same type as obj, replacing fields with values
> from changes."* … *"`copy.replace()` is more limited than `copy()` and
> `deepcopy()`, and only supports named tuples created by `namedtuple()`,
> `dataclasses`, and other classes which define method `__replace__()`."*

```python
new_cfg = copy.replace(cfg, host="db2")          # dataclass, NamedTuple, or __replace__
new_cfg = dataclasses.replace(cfg, host="db2")   # the dataclass-specific spelling
new_pt  = pt._replace(x=3)                       # the namedtuple spelling
```

This is usually what "copy with a change" should have been all along: it is
shallow, explicit about what changes, type-preserving, and — for dataclasses —
runs the constructor, which the docs highlight: *"The newly returned object is
created by calling the `__init__()` method of the dataclass. This ensures that
`__post_init__()`, if present, is also called."*

Two documented sharp edges of `dataclasses.replace`: fields declared
`init=False` may not appear in *changes* (a `ValueError`), and *"They are not
copied from the source object, but rather are initialized in
`__post_init__()`, if they're initialized at all."* So a derived field can come
back different from the original's.

## Enum members and other singletons

Enum members are intended to behave as singletons, and code commonly assumes
`copy.deepcopy(Color.RED) is Color.RED`. I could not find a sentence in the
3.14 `enum` documentation stating the `copy`/`deepcopy` behaviour explicitly,
so I am not going to assert it as a guarantee — check it in the version you are
on if identity matters to your logic, or compare members with `==`/`is` against
the class attribute rather than against a copied value.

## Gotchas

### `TypeError: cannot pickle ...` from `copy.deepcopy`
**Symptom.** A deep copy fails with an error that mentions pickling, in code
that never pickles anything.
**Cause.** `copy` falls back to the pickle protocol when a class defines no
copy hooks, so unpicklable members surface as pickling errors.
**Fix.** Give the owning class `__deepcopy__` (share the resource) or
`__getstate__`/`__setstate__` (drop it), or pre-seed the memo at the call site.

### `__deepcopy__` that recurses forever
**Symptom.** `RecursionError` from your own hook on a structure with a
parent/child cycle.
**Cause.** The new object was not put into the memo before recursing, so the
cycle back to `self` started a second copy.
**Fix.** `memo[id(self)] = new` immediately after constructing `new` and before
any `deepcopy` call — this is why the hook is handed the memo at all.

### `__deepcopy__` that forgets to pass the memo
**Symptom.** Shared objects inside the copy become duplicated; a cycle deeper
in the graph blows the stack.
**Cause.** `copy.deepcopy(component)` was called without the second argument,
starting a fresh memo for that subtree.
**Fix.** Always `copy.deepcopy(component, memo)`. The docs are explicit that
the memo should be passed on and *"treated as an opaque object"*.

### A copy that skipped `__init__` and is missing derived state
**Symptom.** A copied object raises `AttributeError` for an attribute the
constructor computes, or has a stale cached value.
**Cause.** Both `copy.copy` and `copy.deepcopy` reconstruct through the copy or
pickle protocol; neither calls `__init__`.
**Fix.** Implement `__copy__`/`__setstate__` to rebuild derived state, or use
`copy.replace`/`dataclasses.replace`, which do call `__init__`.

### `dataclasses.replace` and an `init=False` field
**Symptom.** A derived field is `None` or recomputed in the replaced object,
or passing it raises `ValueError`.
**Cause.** The docs: it is an error for *changes* to contain `init=False`
fields, and such fields *"are not copied from the source object, but rather are
initialized in `__post_init__()`"*.
**Fix.** Use `init=False` fields sparingly; where they exist, write an explicit
clone method, which the docs themselves suggest.

### A `__deepcopy__` that returns `self` on something that should be copied
**Symptom.** A deep copy shares state with the original and nobody can find
where.
**Cause.** A class in the graph — often a base class from a library — defines
the singleton hook.
**Fix.** Check the classes in the graph before assuming independence. A quick
audit: `[c for c in types_in_graph if "__deepcopy__" in vars(c)]`.

### Copying an object holding a `weakref`
**Symptom.** A copied object's weak reference is dead, or the copy keeps the
referent alive unexpectedly.
**Cause.** Weak references have no sensible copy semantics — the copy either
gets a reference to the original referent or a dead one.
**Fix.** Exclude them in `__getstate__` and rebuild the link after copying.

## Interview questions

**★ Q: How does a class control what `copy.copy` and `copy.deepcopy` do to it?**
By defining `__copy__(self)` and `__deepcopy__(self, memo)`. If it defines
neither, `copy` uses the same machinery as `pickle` — `__reduce_ex__`,
`__getstate__`/`__setstate__`, and `copyreg` registrations — which is why
copyability and picklability track each other so closely.

**★ Q: What is the `memo` argument to `__deepcopy__` for, and what must you do
with it?**
It maps `id()` of already-copied objects to their copies for the current pass.
You must register your new object in it *before* recursing
(`memo[id(self)] = new`) so that cycles terminate, and you must pass it to
every nested `copy.deepcopy(component, memo)` call so that shared references
stay shared. The docs say to treat it as an opaque object.

**★ Q: How do you make an object that must never be duplicated safe to put in a
deep-copied graph?**
Define `__copy__` and `__deepcopy__` to return `self`. That is exactly how the
`copy` module already treats functions, classes and modules — "copying" them by
returning the original unchanged.

**Q: `copy.deepcopy` on an object holding a database connection — what
happens?**
It depends on the class. Frequently it raises from the pickle fallback, because
sockets and connections define no `__reduce__`. The `copy` docs list file and
socket types among those the module does not copy, which is best read as
"these must not be in the graph". The fixes are the memo pre-seed at the call
site, a `__deepcopy__` that shares the connection, or `__getstate__` dropping
it.

**Q: What is `copy.replace()` and when would you use it?**
Added in 3.13, it *"creates a new object of the same type as obj, replacing
fields with values from changes"*, and works on named tuples, dataclasses and
anything defining `__replace__`. It is the right tool for "same object with one
field different" — shallower, more explicit and cheaper than a deep copy, and
for dataclasses it calls `__init__` so `__post_init__` runs.

**Q: Does copying call `__init__`?**
`copy.copy` and `copy.deepcopy` do not — they reconstruct through the copy or
pickle protocol and restore state directly. `copy.replace` and
`dataclasses.replace` do, which the dataclasses docs call out as the reason
`__post_init__` is invoked.

**Q: A library class you do not control fails to deep-copy. What are your
options, in order?**
Pre-seed the memo so it is shared rather than copied; wrap it in your own class
with a `__deepcopy__`; register a `copyreg` reduction function for its type;
restructure so the object is not reachable from the graph you copy — usually by
holding a key or a factory instead of the live object. The last is the design
fix and the others are workarounds.

---

← Prev: [deepcopy](08b-deepcopy.md) · Index: [Assignment and aliasing](README.md) · Next → [Immutability is shallow too](09-immutability-is-shallow.md)
