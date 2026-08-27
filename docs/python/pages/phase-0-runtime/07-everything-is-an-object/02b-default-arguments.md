---
title: "Default arguments: objects created once, at def time"
sidebar_label: "2b · Default arguments"
sidebar_position: 3
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the Python 3.14 Language Reference §8.7
> [Function definitions](https://docs.python.org/3.14/reference/compound_stmts.html)
> (default parameter evaluation), the
> [Programming FAQ](https://docs.python.org/3.14/faq/programming.html) entry on
> shared default values, and the
> [`dataclasses`](https://docs.python.org/3.14/library/dataclasses.html)
> documentation on mutable defaults. Target: **CPython 3.14**.

**A default value is an object, and it is created exactly once — when the `def`
statement runs, not when the function is called. Every call that omits the
argument binds the parameter to that same object. For an immutable default that
is invisible; for a mutable one it is the most famous bug in the language, and
it wears at least four disguises that people do not recognise as the same bug.**

This chunk continues [2 · Binding in functions](02-binding-in-functions.md),
which covers what parameter binding is in the first place.

## Default arguments are objects, created once

The Language Reference states the rule directly:

> *"Default parameter values are evaluated from left to right when the function
> definition is executed."*

"When the function definition is executed" means once, at `def` time — not per
call. The resulting objects are stored on the function object (visible as
`f.__defaults__`) and rebound to the parameter names on every call that omits the
argument.

For an immutable default that is invisible. For a mutable one it is a bug:

```python
def add(item, items=[]):     # the default list is created ONCE, at def time
    items.append(item)
    return items

add("a")     # ['a']
add("b")     # ['a', 'b']  ← the same list, still there
```

The fix is a sentinel plus construction inside the body:

```python
def add(item, items=None):
    if items is None:
        items = []
    items.append(item)
    return items
```

`None` is the right sentinel here because it is a singleton you can test with
`is` (chunk 3, **Identity and equality** *(not written yet)*, covers why that
matters). When `None` is itself a legal argument
value, use a private module-level sentinel object instead:

```python
_MISSING = object()

def fetch(key, default=_MISSING):
    ...
    if default is _MISSING:
        raise KeyError(key)
    return default
```

The same rule bites in three other shapes people do not recognise as the same
bug:

```python
def log(msg, ts=datetime.now()):        # timestamp frozen at import time
    ...

@dataclass
class Job:
    tags: list[str] = []                 # ValueError at class creation — dataclass
                                         # rejects mutable defaults; use
                                         # field(default_factory=list)

class Task:
    subtasks = []                        # ONE list shared by every instance
```

`datetime.now()` in a default evaluates when the module is imported, so every log
line carries process-start time. `dataclasses` special-cases list/dict/set
defaults and raises rather than let you ship the bug — which is why
`field(default_factory=list)` exists. The class attribute is the same object
shared by all instances; `self.subtasks.append(x)` mutates the shared list, while
`self.subtasks = [x]` would create an instance attribute and silently mask the
problem for that one instance.

Phase 2's **Parameters in full** *(not written yet)* goes further into signature
design; the model behind all of it is here.

## Gotchas

**Symptom:** a function with a `=[]` or `={}` default accumulates data across calls, and the bug only shows up in a long-running server
**Cause:** default values are evaluated once, when `def` runs, and stored on the function object
**Fix:** default to `None` and build the container inside the body. A short-lived script hides this bug because the process dies before the accumulation matters; a worker process does not

**Symptom:** every record carries the same timestamp, equal to process start
**Cause:** `def log(msg, ts=datetime.now())` — the call in the default expression ran once, at import
**Fix:** `ts=None` plus `if ts is None: ts = datetime.now()`. Any *call* in a default expression is a frozen value, not a per-call computation

**Symptom:** `ValueError: mutable default <class 'list'> for field tags is not allowed` when defining a dataclass
**Cause:** `dataclasses` detects list/dict/set defaults and refuses, precisely because the shared-object bug is so common
**Fix:** `tags: list[str] = field(default_factory=list)` — the factory is called per instance

**Symptom:** a class attribute mutated on one instance shows up on every instance
**Cause:** `class C: items = []` creates one list owned by the class; `self.items.append(...)` finds it via the class and mutates it
**Fix:** initialise mutable per-instance state in `__init__`, or use `field(default_factory=list)`. Note `self.items = [...]` "fixes" one instance by shadowing the class attribute, which makes the bug look intermittent

**Symptom:** `None` is a legitimate argument value, so the `if x is None` sentinel pattern cannot distinguish "not passed" from "passed None"
**Cause:** `None` is overloaded as both a value and a marker
**Fix:** use a private module-level sentinel — `_MISSING = object()` — and test `if x is _MISSING`. Identity comparison against a unique object is exactly what `is` is for

## Interview questions

**★ Why does `def f(items=[])` accumulate across calls?**
Because the default value is an object created once, when the `def` statement is
executed, and stored on the function object (`f.__defaults__`). Every call that
omits the argument binds the parameter to that same list, so appends accumulate
for the life of the process. Default to `None` and construct inside the body.

**★ How do you handle a default when `None` is a valid value the caller might pass?**
Create a unique module-private sentinel: `_MISSING = object()`, default to it,
and test with `if value is _MISSING`. `object()` instances are distinct from
everything else in the process, so identity comparison is exact and cheap. This
is the same technique the standard library uses in places like
`dict.pop(key[, default])`, where "no default" and "default of None" must differ.

**What does `f.__defaults__` contain, and why is that useful to know?**
A tuple of the default objects for the trailing positional parameters
(keyword-only defaults live in `f.__kwdefaults__`). It is useful because it makes
the mutable-default bug concrete: you can look at the function object and see the
one shared list sitting there between calls. It is also why decorators that
rebuild signatures have to copy these attributes across.

---

← Prev: [Binding in functions](02-binding-in-functions.md) · Index: [Everything is an object](README.md) · Next → **Identity and equality** *(not written yet)*
