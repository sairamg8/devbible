---
title: "__main__ and mypkg.cli are two distinct modules even when they come from one file, so every class in that file exists twice"
sidebar_label: "3 · The double-import trap"
sidebar_position: 7
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-28 against the Python 3.14
> [import system reference § Special considerations for `__main__`](https://docs.python.org/3.14/reference/import.html#special-considerations-for-main),
> [`sys.modules`](https://docs.python.org/3.14/library/sys.html#sys.modules),
> [`pickle`](https://docs.python.org/3.14/library/pickle.html) and
> [`multiprocessing`](https://docs.python.org/3.14/library/multiprocessing.html).
> Version spine: **CPython 3.14.7**.

**This is the one genuinely surprising consequence of the whole mechanism, and
it is stated flatly in the language reference: a file executed as `__main__` and
the same file imported under its real name are *distinct modules*. Two entries
in `sys.modules`, two executions of the body, two of every class, constant,
registry, lock, connection pool and cached value the file defines. The bugs that
follow do not look like import bugs — they look like `isinstance` lying, an
`except` clause missing an exception it should catch, and a singleton that is
not one.**

## The reference, verbatim

> *"Note also that even when `__main__` corresponds with an importable module and
> `__main__.__spec__` is set accordingly, they're still considered **distinct**
> modules. This is due to the fact that blocks guarded by
> `if __name__ == "__main__":` checks only execute when the module is used to
> populate the `__main__` namespace, and not during normal import."*

And why `__main__` is special at all:

> *"The `__main__` module is a special case relative to Python's import system.
> As noted elsewhere, the `__main__` module is directly initialized at
> interpreter startup, much like `sys` and `builtins`. However, unlike those two,
> it doesn't strictly qualify as a built-in module. This is because the manner in
> which `__main__` is initialized depends on the flags and other options with
> which the interpreter is invoked."*

## The mechanism

[Topic 08](../08-imports/01-modules-and-the-cache.md) establishes that the
import system keys its cache on the module's **name**. `__main__` is a name;
`mypkg.cli` is a different name. Nothing in the cache lookup compares file
paths, so:

```
python -m mypkg.cli
  → sys.modules["__main__"]   = <module from mypkg/cli.py>   (body executed)

… and later, anything doing `import mypkg.cli`:
  → cache miss on "mypkg.cli"
  → sys.modules["mypkg.cli"] = <module from mypkg/cli.py>   (body executed AGAIN)
```

One file, two module objects, two runs of the top level. Every `class` statement
executed twice produces two class objects that are not each other, and identity
is all that class comparison has.

```python
# mypkg/cli.py
class Job:
    ...

def main(argv=None) -> int:
    from mypkg.engine import run     # engine.py does `from mypkg.cli import Job`
    return run(Job())

if __name__ == "__main__":
    raise SystemExit(main())
```

`python -m mypkg.cli` creates `__main__.Job` and hands an instance of it to
`run`. `engine.py` imported `mypkg.cli.Job`, a *different class* produced by a
second execution of the same source. `isinstance(job, Job)` inside `engine.py`
is `False`.

## The failure catalogue

Every one of these is the same bug wearing a different hat.

**`isinstance` returns `False` for an object that visibly is that type.** The
repr says `Job`, the class name matches, and the check fails, because the object
is a `__main__.Job` and the check is against `mypkg.cli.Job`.

**An `except` clause misses an exception it obviously should catch.** Exception
matching *is* `isinstance`. A `ValidationError` raised by the `__main__` copy is
not caught by `except ValidationError` in a module that imported the real one —
so it propagates to the top and kills the process.

**A singleton stops being single.** Module-level state is per-module-object:

```python
# mypkg/cli.py
_CONNECTIONS: dict[str, Connection] = {}     # two of these now
```

The entry point populates one; every other module reads the other, empty one.

**A registry is half-populated.** The classic decorator registry:

```python
HANDLERS: dict[str, Callable] = {}

def handler(name):
    def deco(fn):
        HANDLERS[name] = fn
        return fn
    return deco
```

Handlers registered during the `__main__` execution land in one dict, handlers
registered during the `mypkg.cli` execution land in the other, and whichever
half the dispatcher reads is missing the rest.

**`Enum` identity comparisons fail.** `status is Status.ACTIVE` is the whole
point of an enum, and it is `False` across two copies of the class. `Enum`
equality is identity-based, so `==` fails with it.

**A `dataclass` with `eq=True` compares unequal.** The generated `__eq__` begins
by checking `other.__class__ is self.__class__` and returns `NotImplemented`
otherwise, so two structurally identical instances of the two copies are not
equal.

**A module-level lock protects nothing.** `_LOCK = threading.Lock()` executed
twice yields two locks; two threads in two halves of the program each acquire
their own and enter the critical section together.

**`functools.cache` caches twice.** Two decorated function objects, two caches —
double the memory, double the work, and double the outbound requests if the
cache was there to deduplicate them.

**`pickle` cannot find the class again.** `pickle` stores a class by its
`__module__` and `__qualname__`. A class defined in the entry point has
`__module__ == "__main__"`, so the pickle says "look in `__main__`" — which in
the *reading* process is a completely different module. The `multiprocessing`
docs show this exact shape when a function is defined at the interactive prompt:
`AttributeError: Can't get attribute 'f' on <module '__main__' ...>`.

**Module-level logging configuration applies twice.** Two `addHandler` calls, so
every record is emitted twice.

**A `__init_subclass__` hook or metaclass side effect fires twice.** ORM model
registration, plugin discovery and abstract-base bookkeeping run in duplicate,
and the second run usually raises "table already defined" or "duplicate model"
rather than failing quietly — which for once is a mercy.

There are three routes into this state, and [chunk
3b](03b-fixing-and-diagnosing-double-imports.md) walks them, along with how to
confirm the diagnosis and how to make the whole class of bug impossible.

## Gotchas

### `isinstance` fails on an object of the obviously correct class

**Symptom.** `isinstance(job, Job)` is `False`; the repr and the class name look
right; even `type(job).__name__ == Job.__name__` is `True`.
**Cause.** Two class objects from two executions of one file.
**Fix.** Compare `type(obj).__module__` against `Job.__module__` to confirm,
then apply the structural fix in
[chunk 3b](03b-fixing-and-diagnosing-double-imports.md).

### An exception escapes a handler that names it

**Symptom.** `except MyError:` does not catch a `MyError`, and the traceback
shows the exception reaching the top level with the name you thought you caught.
**Cause.** Exception matching is `isinstance`, and there are two `MyError`
classes.
**Fix.** Define exceptions in a dedicated module — `mypkg/errors.py` — which
nothing ever runs. That is good practice independently, and it makes this class
of bug structurally impossible for exceptions.

### A decorator registry is missing half its entries

**Symptom.** A handler that is definitely decorated is not found at dispatch
time; adding a `print` in the decorator shows it running.
**Cause.** Two module objects, two registry dicts, and the dispatcher holds a
reference to one of them.
**Fix.** Move the registry and everything that registers into it out of any
runnable module.

### `Enum` members compare unequal to themselves

**Symptom.** `status is Status.ACTIVE` is `False` for a value that came from
`Status.ACTIVE`; `status == Status.ACTIVE` is `False` too.
**Cause.** `Enum` equality is identity, and there are two `Status` classes with
two disjoint sets of members.
**Fix.** Move the enum out of the entry-point module. Enums are the most painful
case because the failure is total — no two members from the two copies match.

### `pickle` fails to reconstruct an object in another process

**Symptom.** An `AttributeError` in the child naming a class or function that
cannot be found on `__main__`, of the form the `multiprocessing` docs show:
`Can't get attribute 'f' on <module '__main__' ...>`.
**Cause.** `pickle` records `__module__` and `__qualname__`. Anything defined in
the entry point claims to live in `__main__`, and the reading process's
`__main__` is something else — a worker bootstrap, a REPL, `pytest`.
**Fix.** Define everything that crosses a process boundary in an importable
module, and reference it from there.

### A "singleton" appears twice in logs or metrics

**Symptom.** Two connection pools, two schedulers, doubled metric counts, twice
the expected number of open file descriptors.
**Cause.** Module-level construction in a file that is both run and imported.
**Fix.** The structural fix; and prefer an explicitly constructed object passed
down over a module-level global, which makes duplication visible instead of
silent.

### Everything logs twice

**Symptom.** Every log line appears twice, or three times under
`multiprocessing`.
**Cause.** A module-level `addHandler` or `basicConfig` executed once per copy
of the module.
**Fix.** Configure logging inside `main()`, exactly once. See
[chunk 1b](01b-what-belongs-in-the-guard.md).

### ORM models raise "already defined" at import

**Symptom.** SQLAlchemy's `InvalidRequestError` about a table already being
defined, or Django complaining about a duplicate model, when you run a
management script.
**Cause.** The model module was executed twice, and the declarative registry
rejects the second registration.
**Fix.** Never run a module that defines models. Run a thin entry point that
imports them.

### `functools.cache` on an expensive call is hit twice as often

**Symptom.** Cache hit rates that are half what you expect; two identical
outbound HTTP calls for one logical lookup.
**Cause.** The decorated function object exists twice, each with its own cache
dict.
**Fix.** As above. `cache_info()` on both copies showing separate counts is the
confirming observation.

## Interview questions

**★ Why is `python -m mypkg.cli` said to import the module twice?**
Because `__main__` and `mypkg.cli` are separate keys in `sys.modules`, and the
import cache is keyed on the name, not the file. Running the module populates
`__main__`; a later `import mypkg.cli` misses the cache and executes the body a
second time. The language reference states outright that the two are *"still
considered distinct modules"*. The result is two of every class, constant and
piece of module-level state the file defines.

**★ Why would `isinstance(x, Job)` be `False` for an object whose type is
plainly `Job`?**
Because there are two `Job` class objects — one created when the file ran as
`__main__`, one when it was imported under its real name — and class identity is
object identity. `type(x).__module__` will say `'__main__'` while the `Job` in
the checking module says `'mypkg.cli'`. The same mechanism makes `except
MyError:` miss a `MyError`, makes two `Enum` members compare unequal, and makes
a `dataclass`'s generated `__eq__` return `NotImplemented`.

**★ Why does `pickle` break for classes defined in the entry point?**
Because `pickle` serialises a class as the pair (`__module__`, `__qualname__`)
and re-imports it on the other side. A class defined in the entry point has
`__module__ == "__main__"`, and the reading process's `__main__` is whatever
*it* was started with — a worker bootstrap, `pytest`, a notebook kernel — so the
lookup fails with an attribute error naming a module that exists but contains
something else entirely.

**Is this a bug in Python?**
No, it is a documented consequence of two design decisions that are each
reasonable: the import cache is keyed on module name, and the entry point is
named `__main__` so the guard can distinguish running from importing. The
reference presents the second as the *cause* of the first — guarded blocks
*"only execute when the module is used to populate the `__main__` namespace"*,
which is only meaningful if the two are distinct modules. The cost is real; the
mitigation is a two-line file.

**Which failure mode is the worst in practice?**
The exception one, because it is silent and it inverts control. A handler that
should have caught an error does not, so the process dies at the top level with
a traceback naming an exception that is visibly listed in an `except` clause a
few frames down. Everything else — `isinstance`, enums, registries — fails
locally and near the code you are looking at.

**Does this affect `__main__.py` in a package?**
Technically yes: `python -m mypkg` runs `mypkg/__main__.py` as `__main__`, and
something could still `import mypkg.__main__`. Practically no, because the
conventional `__main__.py` defines nothing at all, so duplicating it duplicates
nothing. That is precisely why the convention exists.

---

← Prev: [zipapps, runpy and import __main__](02b-zipapps-runpy-and-import-main.md) · Index: [if __name__ == "__main__"](README.md) · Next → [Fixing and diagnosing double imports](03b-fixing-and-diagnosing-double-imports.md)
