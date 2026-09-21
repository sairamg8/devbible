---
title: "For an ordinary object copy never inspects the object — it asks for x.__reduce_ex__(4), a five-part recipe of a callable, its arguments, a state, and item iterators, and rebuilds from that — so the recipe is the interface, and __init__ is absent from it"
sidebar_label: "04 · The reduce protocol"
sidebar_position: 7
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09 on **Python 3.14.7** against the [`pickle` documentation — pickling class instances](https://docs.python.org/3.14/library/pickle.html#pickling-class-instances), the [`copy`](https://docs.python.org/3.14/library/copy.html) and [`copyreg`](https://docs.python.org/3.14/library/copyreg.html) documentation, and the source at v3.14.7 of [`Objects/typeobject.c`](https://github.com/python/cpython/blob/v3.14.7/Objects/typeobject.c) (`reduce_newobj`, `object_getstate_default`, `object___reduce_ex___impl`), [`Lib/copyreg.py`](https://github.com/python/cpython/blob/v3.14.7/Lib/copyreg.py) and [`Lib/copy.py`](https://github.com/python/cpython/blob/v3.14.7/Lib/copy.py). Documentation- and source-validated — **no sandbox run**.

**Every route in `copy` and `deepcopy` that is not an atomic type, a builtin container or a class hook ends in the same three lines: `rv = x.__reduce_ex__(4)`, then `_reconstruct(x, memo, *rv)`. The `copy` documentation says as much — *"the copy module uses the registered pickle functions from the copyreg module"* — and the pickle documentation calls the pieces "the copy protocol". So to know what a copy of your object will be, you read its reduce value: a callable that builds a new object, the arguments for it, a state to restore, and iterators of list items and dict items. Nothing in that recipe calls `__init__`. Nothing in it looks at the object's class hierarchy beyond `__new__`, `__getnewargs__`, `__getstate__` and `__setstate__`. Every "why did `copy` do that" about an ordinary object is a question about this tuple.**

## The recipe

The pickle documentation defines the reduce value: *"When a tuple is returned, it must be between two and six items long. Optional items can either be omitted, or `None` can be provided as their value."* In order:

1. a callable that creates the initial version of the object;
2. a tuple of arguments for that callable (*"An empty tuple must be given if the callable does not accept any argument."*);
3. optionally, the object's state;
4. optionally, an iterator of items to `append` (*"This is primarily used for list subclasses"*);
5. optionally, an iterator of key-value pairs to store with `obj[key] = value` (*"This is primarily used for dictionary subclasses"*);
6. optionally, a `(obj, state)` callable to apply the state — added in 3.8.

`copy` uses **five**. `_reconstruct(x, memo, func, args, state=None, listiter=None, dictiter=None, *, deepcopy=deepcopy)` takes no sixth item, so a `__reduce__` that returns the six-item form makes the call `_reconstruct(x, None, *rv)` fail with too many arguments. `copy` also fixes the protocol at 4 — `reductor(4)` in the source — regardless of `pickle.DEFAULT_PROTOCOL`, which the documentation says became 5 in Python 3.14.

## What `object.__reduce_ex__(4)` builds by default

For a class that defines no reduce hooks, `object.__reduce_ex__` (C, `typeobject.c`) goes to `reduce_newobj`. The parts that matter, from the v3.14.7 source:

```c
    if (Py_TYPE(obj)->tp_new == NULL) {
        PyErr_Format(PyExc_TypeError,
                     "cannot pickle '%.200s' object",
                     Py_TYPE(obj)->tp_name);
        return NULL;
    }
    if (_PyObject_GetNewArguments(obj, &args, &kwargs) < 0)
        return NULL;
    ...
    state = object_getstate(obj, !(hasargs || PyList_Check(obj) || PyDict_Check(obj)));
    ...
    result = PyTuple_Pack(5, newobj, newargs, state, listitems, dictitems);
```

- **The callable** is `copyreg.__newobj__` — `def __newobj__(cls, *args): return cls.__new__(cls, *args)` — and its arguments are `(cls, *newargs)`. So the new object is made by calling **`__new__`**, never `__init__`. With no `__getnewargs__`, `__new__` is called with no arguments.
- **`newargs`** come from `__getnewargs_ex__` (a pair of positional arguments and keyword arguments, giving `copyreg.__newobj_ex__`) or else `__getnewargs__` (positional only) — the pickle documentation: *"You should implement this method if the `__new__()` method of your class requires keyword-only arguments. Otherwise, it is recommended for compatibility to implement `__getnewargs__()`."*
- **`state`** comes from `__getstate__`. Since 3.11 `object` has a default one, and the documentation lists its four cases: no dict and no slots gives `None`; a dict and no slots gives `self.__dict__`; a dict and slots gives a tuple of that dict and a dict of slot values; slots and no dict gives a tuple whose first item is `None`. An instance whose dict is empty also gets `None`.
- **`listitems`** is `iter(obj)` when `obj` is a `list` (or subclass); **`dictitems`** is `iter(obj.items())` when it is a `dict` (or subclass) — the C code calls the `items` method by name, so an overridden `items` is honoured.
- The `required` flag — true when the class supplied no `__getnewargs__*` and is not a list or dict — is what turns "no way to rebuild this" into a `TypeError` for objects such as locks; see the chunk on what cannot be copied.

## Who supplies the reduce value

`copy` does not care whether the recipe comes from `object` or from the type:

| Type | Source of the recipe |
|---|---|
| plain instance, dataclass, `__slots__` class | `object.__reduce_ex__` → `reduce_newobj` |
| `list`, `dict` subclass | the same, with `listitems` / `dictitems` iterators |
| `set`, `frozenset` | `set.__reduce__`: `(type, ([elements],), state)` |
| `Counter` | `__reduce__`: `(self.__class__, (dict(self),))` |
| `OrderedDict`, `defaultdict`, `deque` | C `__reduce__` returning items iterators |
| `functools.partial` | C `partial_reduce`: `(type, (func,), (func, args, kwargs, dict))` |
| `logging.Logger` | `__reduce__`: `(getLogger, (name,))` |
| named tuple | `__getnewargs__` returns the fields |

## The precedence inside route 5

From the source, the order in which `copy.copy` and `copy.deepcopy` look for a recipe once the hook lookups have failed:

1. `copyreg.dispatch_table.get(type(x))` — a function registered for the **exact type**. `copyreg` ships three: `complex`, the `int | str` union type, and `super`.
2. `x.__reduce_ex__(4)`.
3. `x.__reduce__()` — only if `__reduce_ex__` is missing.
4. Neither: `copy.Error`.

The pickle documentation adds the link between 2 and 3: *"When defined, pickle will prefer it over the `__reduce__()` method. In addition, `__reduce__()` automatically becomes a synonym for the extended version."* The C implementation of `object.__reduce_ex__` is what makes that true: it looks up `__reduce__`, and if the class's version is not `object`'s, calls it. If a **base class defines `__reduce_ex__` itself** and answers directly, `object`'s is bypassed, and a `__reduce__` in a subclass is never consulted.

A string as the reduce value means "this object is a global": `copy` returns `x`. The pickle documentation: *"This behaviour is typically useful for singletons."*

## Reading a reduce value yourself

The recipe is inspectable, which makes it the best diagnostic for a class that copies wrongly:

```python
def describe_reduce(obj, protocol=4):
    """Label the parts of obj.__reduce_ex__(protocol) the way copy reads them."""
    value = obj.__reduce_ex__(protocol)
    if isinstance(value, str):
        return {"global": value}
    names = ("callable", "args", "state", "listitems", "dictitems")
    return dict(zip(names, value))
```

For an ordinary class the labelled result should name `copyreg.__newobj__` as the callable, the class as the only argument, and the instance dictionary as the state. If `obj.__reduce_ex__(4)` raises a `TypeError` mentioning pickling, the object cannot be copied by the default machinery, and the message names the type.

## Making `__new__` work: `__getnewargs__`

A class whose `__new__` requires arguments cannot be built by a bare `cls.__new__(cls)`. Give the protocol the arguments:

```python
import copy


class Money:
    def __new__(cls, amount, currency):
        obj = super().__new__(cls)
        obj.amount = amount
        obj.currency = currency
        return obj

    def __getnewargs__(self):
        return (self.amount, self.currency)


price = Money(1999, "EUR")
same = copy.copy(price)

assert same is not price
assert (same.amount, same.currency) == (1999, "EUR")
```

Without `__getnewargs__` the default recipe calls `Money.__new__(Money)`, which fails for the missing arguments. For a `__new__` with keyword-only parameters use `__getnewargs_ex__`, returning `(args, kwargs)`.

## Making `__init__` run: return the constructor

If the copy must go through validation or registration in `__init__`, return the class itself as the callable:

```python
import copy


class Temperature:
    def __init__(self, kelvin):
        if kelvin < 0:
            raise ValueError("below absolute zero")
        self.kelvin = kelvin

    def __reduce__(self):
        return (Temperature, (self.kelvin,))


warm = Temperature(300.0)
clone = copy.copy(warm)
assert clone is not warm and clone.kelvin == 300.0
```

`object.__reduce_ex__` sees that the class overrides `__reduce__` and calls it; `_reconstruct` then calls `Temperature(300.0)`. This is the one way to have a copy pass through `__init__`, and it costs two things: the class must be importable at top level for pickle to use the same recipe, and subclasses must override `__reduce__` too or their extra state is lost.

## Gotchas

**★ Symptom: `copy.copy(obj)` raises a `TypeError` about missing arguments to `__new__`.** Cause: the default recipe calls `cls.__new__(cls)` with no arguments; a `__new__` with required parameters fails. Fix: define `__getnewargs__` (or `__getnewargs_ex__` for keyword-only parameters), as in `Money` above.

**★ Symptom: a `__reduce__` I wrote is ignored by `copy`, and the copy is an instance of the base class.** Cause: `copy` calls `__reduce_ex__(4)` first. If a class in the MRO defines `__reduce_ex__` and answers directly rather than delegating to `object.__reduce_ex__` (enum members do this), it wins over a subclass's `__reduce__`. Fix: define `__reduce_ex__` in the class that needs the recipe.

```python
class Base:
    def __init__(self, payload):
        self.payload = payload

    def __reduce_ex__(self, protocol):
        return (Base, (self.payload,))          # answers directly


class Snapshot(Base):
    def __init__(self, payload, taken_at):
        super().__init__(payload)
        self.taken_at = taken_at

    def __reduce_ex__(self, protocol):          # not __reduce__: Base's answer would win
        return (Snapshot, (self.payload, self.taken_at))
```

**★ Symptom: `copy.copy` raises a `TypeError` about too many positional arguments to `_reconstruct`.** Cause: `__reduce__` returned the six-item form with a state-setter callable; `copy` reads at most five items. Fix: return five items, and move the state-setting logic into `__setstate__`.

```python
def __reduce__(self):
    return (type(self), (self.name,), self.__dict__.copy())      # five items or fewer
```

**★ Symptom: a `__setstate__` that rebuilds a lock or cache never runs for some instances.** Cause: `_reconstruct` calls `__setstate__` only `if state is not None`, and the default `__getstate__` returns `None` for an instance with an empty `__dict__` (the pickle note: *"If `__reduce__()` returns a state with value `None` at pickling, the `__setstate__()` method will not be called upon unpickling."*). Fix: return a non-`None` state from your own `__getstate__` when `__setstate__` must run.

```python
import threading


class Throttle:
    def __init__(self):
        self._lock = threading.Lock()

    def __getstate__(self):
        return {}                       # not None, so __setstate__ runs

    def __setstate__(self, state):
        self._lock = threading.Lock()
```

**Symptom: a protocol-aware `__reduce_ex__(self, protocol)` takes its old path under `copy`.** Cause: `copy` passes 4, not `pickle.DEFAULT_PROTOCOL` (5 in 3.14). Fix: handle 4 correctly; treat protocol 5 features as optional.

**Symptom: a function registered in `copyreg.pickle(cls, reducer)` is not used for a subclass of `cls`.** Cause: the dispatch table is consulted by exact `type(x)`. Fix: register each class.

```python
import copyreg

for cls in (Client, PooledClient):
    copyreg.pickle(cls, reduce_client)
```

## Interview questions

**★ What does `copy.copy` call for an ordinary object, and what does it do with the result?**
It calls `x.__reduce_ex__(4)` and hands the returned tuple to `_reconstruct`: the first item (usually `copyreg.__newobj__`) is called with the second item as its arguments to build an empty object, the third is the state applied to it, and the fourth and fifth are iterators whose items are appended or stored. Nothing in that sequence calls `__init__`.

**★ Why doesn't copying call `__init__`, and how do you make it?**
Because the default recipe builds the object with `cls.__new__` and restores its attributes directly — the pickle documentation says the default behaviour *"first creates an uninitialized instance and then restores the saved attributes"*. To make `__init__` run, override `__reduce__` to return the class and the constructor arguments, or write `__copy__` and `__deepcopy__` yourself.

**★ What does `__getnewargs__` do for copying?**
It supplies the positional arguments the default recipe passes to `__new__`. Without it `__new__` is called with none, which fails for a `__new__` with required parameters. `__getnewargs_ex__` supplies keyword arguments as well; named tuples use `__getnewargs__` to return their fields.

**Why does `copy` use protocol 4 and not the default pickle protocol?**
The source hard-codes `reductor(4)`. The documentation says the default pickle protocol became 5 in Python 3.14, so the two differ; the recipe for an ordinary object is the same for both.

**In what order does `copy` look for `__reduce_ex__`, `__reduce__` and `copyreg` entries, and when is a subclass's `__reduce__` ignored?**
A `copyreg.dispatch_table` entry for the exact type first, then `__reduce_ex__(4)`, then `__reduce__`. `object.__reduce_ex__` calls an overridden `__reduce__`, but if any class in the MRO defines its own `__reduce_ex__` that answers directly instead of delegating to `object`'s, that one is what `copy` gets, and a `__reduce__` on a subclass is never reached.

**What does a reduce value that is a string mean?**
That the object is a global with that name, so the copy is the object itself. It is the documented way for a singleton to survive copying and pickling.

---

← [03b · Containers built from their children](03b-containers-built-from-their-children.md) · [Topic index](README.md) · Next → [04b · _reconstruct step by step](04b-reconstruct-step-by-step.md)
