---
title: "copyreg.pickle is the only way to change how copy treats a class you cannot edit, and it is a process-wide table keyed by exact type — so it fixes a vendor client in one line, silently changes pickling for everyone else, and is the wrong tool for your own classes"
sidebar_label: "05b · copyreg and types you cannot edit"
sidebar_position: 11
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09 on **Python 3.14.7** against the [`copyreg` documentation](https://docs.python.org/3.14/library/copyreg.html), the [`pickle` documentation — dispatch tables](https://docs.python.org/3.14/library/pickle.html#dispatch-tables), and the source of [`Lib/copyreg.py`](https://github.com/python/cpython/blob/v3.14.7/Lib/copyreg.py) and [`Lib/copy.py`](https://github.com/python/cpython/blob/v3.14.7/Lib/copy.py) at v3.14.7. Documentation- and source-validated — **no sandbox run**.

**Every hook in the previous chunk lives in the class being copied. When that class belongs to a vendor package, an ORM, or the standard library, you cannot add `__deepcopy__` to it — but `copy` has a second, external lookup that runs before it asks the object for a reduce value: `copyreg.dispatch_table`, a plain dictionary from a class to a reduction function. One `copyreg.pickle(Client, reduce_client)` call changes what `copy` and `deepcopy` build for every instance of `Client` in the process. It is the right tool for a foreign type held in structures you do not control, and it is process-wide, exact-type only, shared with `pickle`, and has no undo in the documentation. Use it once, at the edge of your application, and prefer a wrapper or a hook everywhere else.**

## What it is and where it ranks

The `copyreg` documentation defines it in two sentences:

> *"The copyreg module offers a way to define functions used while pickling specific objects. The pickle and copy modules use those functions when pickling/copying those objects."*

> *"Declares that function should be used as a "reduction" function for objects of type type. function must return either a string or a tuple containing between two and six elements."*

In the source, `copyreg.pickle` is three lines that matter:

```python
dispatch_table = {}

def pickle(ob_type, pickle_function, constructor_ob=None):
    if not callable(pickle_function):
        raise TypeError("reduction functions must be callable")
    dispatch_table[ob_type] = pickle_function
```

and `Lib/copy.py` begins with `from copyreg import dispatch_table` — the *same dictionary object*, so a registration made after `copy` was imported is still seen. Inside `copy.copy` the lookup is `reductor = dispatch_table.get(cls)` with `cls = type(x)`, **after** the atomic set, the builtin-container shortcut, the class check and `__copy__`, and **before** `__reduce_ex__`. Inside `deepcopy` it comes after the dispatch table for `list`/`tuple`/`dict`, and after `__deepcopy__`. So a registration never overrides a class hook, and can never change an exact `list`, `dict`, `tuple` or any atomic type.

The reduction function takes the object and returns the same reduce value as `__reduce__` ([04](04-the-reduce-protocol.md)), of at most five items for `copy`. `copyreg` already registers three: `complex`, the `int | str` union type, and `super`. Its own module docstring says what the table is for:

> *"This is only useful to add pickle support for extension types defined in C, not for instances of user-defined classes."*

## Rebuild from configuration

A vendor client holds a lock and a session; `deepcopy` of anything that references it fails. You cannot edit the class, but you can say how to make another one:

```python
import copy
import copyreg
import threading


class ApiClient:
    """Stands in for a class from a vendor package that we cannot edit."""

    def __init__(self, base_url, token):
        self.base_url = base_url
        self.token = token
        self._lock = threading.Lock()


def _reduce_api_client(client):
    return ApiClient, (client.base_url, client.token)


copyreg.pickle(ApiClient, _reduce_api_client)

settings = {"client": ApiClient("https://api.example.test", "t0ken"), "retries": [1, 2, 4]}
clone = copy.deepcopy(settings)

assert clone["client"] is not settings["client"]
assert clone["client"].base_url == settings["client"].base_url
assert clone["client"]._lock is not settings["client"]._lock
```

`deepcopy` finds `ApiClient` in the table, calls the function, and `_reconstruct` calls `ApiClient(base_url, token)` — `__init__` runs, so the copy has its own lock. (Without the registration `deepcopy` reaches the lock through the instance's state and fails; the message table is in the chunk on what cannot be copied.)

## Return the same object by name

Sometimes the copy *should* be the original. `logging.Logger.__reduce__` returns `getLogger, (self.name,)`, so a copy is the registered logger. The same pattern for a foreign type — reduce to a lookup:

```python
import copy
import copyreg


class Connection:
    def __init__(self, name):
        self.name = name


_CONNECTIONS = {}


def connection(name):
    if name not in _CONNECTIONS:
        _CONNECTIONS[name] = Connection(name)
    return _CONNECTIONS[name]


copyreg.pickle(Connection, lambda conn: (connection, (conn.name,)))

primary = connection("primary")
snapshot = copy.deepcopy({"conn": primary, "rows": [1, 2]})

assert snapshot["conn"] is primary
assert snapshot["rows"] == [1, 2]
```

No pre-seeded memo and no `__deepcopy__` on the holder: every reference to a `Connection` anywhere in the graph now resolves to the registered one. The cost is the same as the memo trick's — the rule is global rather than per call.

## The scope is the whole process

The pickle documentation spells out the difference between the three places a table can live:

> *"If one wants to customize pickling of some classes without disturbing any other code which depends on pickling, then one can create a pickler with a private dispatch table."*
> *"… `copyreg.pickle(SomeClass, reduce_SomeClass)` … modifies the global dispatch table shared by all users of the copyreg module."*

`copy` has no private table: it reads `copyreg.dispatch_table` directly. So a registration made to help `deepcopy` also changes what `pickle.dumps` does for that type, unless the pickler was given a private table. That has two consequences. First, register once, in the application's start-up, never in a library — a library that registers a vendor's type changes behaviour for every other library in the process. Second, do not register a reduction that makes something "work" that used to fail loudly:

```python
import copyreg
import threading

LockType = type(threading.Lock())


def _reduce_lock(lock):
    return threading.Lock, ()


copyreg.pickle(LockType, _reduce_lock)      # possible; rarely wise
```

That makes every copy of a lock — locked or not — an *unlocked* new lock, and lets `pickle` write locks to a cache, where they come back unlocked in another process. A lock's meaning is its state and its owners; a silent reset is a worse failure than the `TypeError` it replaced.

There is no documented way to unregister. The table is an ordinary dictionary, so `copyreg.dispatch_table.pop(ApiClient, None)` works in a test's teardown, but the documentation does not promise it.

## Wrap or subclass when you control the holder

The alternative that has no global effect is a class you own:

```python
import copy


class SharedClient:
    """Holds a vendor client and decides what copying it means."""

    def __init__(self, client):
        self._client = client

    def __copy__(self):
        return self

    def __deepcopy__(self, memo):
        return self

    def __getattr__(self, name):
        if name.startswith("_"):
            raise AttributeError(name)
        return getattr(self._client, name)
```

Use `copyreg` when instances of the foreign type are scattered through structures that you receive, not create. Use a wrapper or a memo seed when you create the holder ([02b](02b-the-memo-as-an-api.md)).

## Gotchas

**★ Symptom: `copyreg.pickle(Base, reducer)` has no effect on instances of `Sub(Base)`.** Cause: `dispatch_table.get(cls)` looks up the exact type. Fix: register every class that needs it.

```python
for cls in (Client, PooledClient, AsyncClient):
    copyreg.pickle(cls, reduce_client)
```

**★ Symptom: after registering a reducer to fix `deepcopy`, some unrelated `pickle.dumps` call starts succeeding (or produces different bytes).** Cause: the pickler uses `copyreg.dispatch_table` unless it has a private one. Fix: register in one place at start-up, choose reductions that are safe for pickling too, or pass a private table to the picklers that matter.

```python
import io
import pickle


def dumps_with_private_table(obj, table):
    buffer = io.BytesIO()
    pickler = pickle.Pickler(buffer)
    pickler.dispatch_table = table
    pickler.dump(obj)
    return buffer.getvalue()
```

**★ Symptom: a registration for `list`, `dict`, `tuple`, `str` or a function type is ignored.** Cause: those types return before the table is consulted — atomic sets, the builtin-container shortcut, and `deepcopy`'s own dispatch. Fix: subclass and register the subclass, or wrap.

**Symptom: a registered reducer is ignored for a class that defines `__copy__` or `__deepcopy__`.** Cause: the class hooks come first. Fix: remove the hook, or put the logic in it.

**Symptom: `TypeError` about too many arguments when `copy.copy` calls the reducer's result.** Cause: the reducer returned six items (the state-setter form). Fix: return at most five.

**Symptom: the registration disappears (or appears twice) between test runs.** Cause: the table is module-global state, so it survives across tests and `importlib.reload`. Fix: register in a fixture that removes the entry.

```python
import copyreg
import pytest


@pytest.fixture
def registered_reducer():
    copyreg.pickle(ApiClient, _reduce_api_client)
    yield
    copyreg.dispatch_table.pop(ApiClient, None)
```

## Interview questions

**★ How do you make `deepcopy` handle a class from a library you cannot edit?**
Register a reduction function with `copyreg.pickle(TheClass, reducer)`. `copy` looks in `copyreg.dispatch_table` for the object's exact type before it calls `__reduce_ex__`, so the reducer's return value — usually `(constructor, args)` — decides how the copy is built. If you create the holding object yourself, wrapping the foreign object in a class with `__copy__`/`__deepcopy__`, or seeding the memo, has no global effect and is usually better.

**★ What are the dangers of `copyreg.pickle`?**
It is global to the process and shared by `pickle`, so a registration meant for `deepcopy` also changes serialisation for every user of the table; it matches the exact type only, so subclasses are missed; and it has no documented unregister. Register once at start-up and never from a library.

**Where does `copyreg.dispatch_table` rank in the lookup, and what can it not override?**
After the atomic types, the builtin-container shortcut and the class check, and after `__copy__`, in `copy`; after the dispatch for `list`/`tuple`/`dict`/methods and after `__deepcopy__`, in `deepcopy`; and before `__reduce_ex__` in both. So it cannot change atomic types or exact builtin containers, and a class hook overrides it.

**What is the difference between rebuilding and returning the same object in a reducer?**
A reducer returning `(Class, args)` makes each copy a new object built by the constructor — `__init__` runs. A reducer returning `(lookup, (key,))` makes each copy the registered object, which is how loggers behave. Choose by whether the thing is a value or a shared resource.

**Why does the `copyreg` module say it is only for C extension types?**
Because for your own classes there are better hooks — `__reduce__`, `__getstate__` and `__deepcopy__` live with the class and cost nothing globally. The registry exists for types you cannot add methods to, which in practice means built-in and foreign C types.

---

← [05 · Writing copy hooks](05-writing-copy-hooks.md) · [Topic index](README.md) · Next → [06 · __slots__ classes](06-slots-classes.md)
