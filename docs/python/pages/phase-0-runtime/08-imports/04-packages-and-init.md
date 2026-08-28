---
title: "A package is a module with a __path__, and everything you re-export from __init__.py is paid for by every importer"
sidebar_label: "4 · Packages and __init__.py"
sidebar_position: 11
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the Python 3.14
> [import system reference](https://docs.python.org/3.14/reference/import.html)
> (regular packages, submodules, `__path__` attributes on modules) and
> [customizing module attribute access](https://docs.python.org/3.14/reference/datamodel.html)
> ([PEP 562](https://peps.python.org/pep-0562/) module `__getattr__`).
> Target: **CPython 3.14**.

**A package is not a special kind of object — it is a module that happens to have
a `__path__`, which the import machinery searches the way it searches `sys.path`.
`__init__.py` is that module's body, so every line in it runs the first time
anybody imports *anything* underneath the package. That is why a convenient
`from .core import Engine` in `__init__.py` turns a two-millisecond
`import mypkg.version` into a full application load, and it is the single design
decision that determines whether your library is cheap or expensive to import.**

## The definition, and the only thing that distinguishes a package

> *"Specifically, any module that contains a `__path__` attribute is considered a
> package."*

> *"A regular package is typically implemented as a directory containing an
> `__init__.py` file. When a regular package is imported, this `__init__.py` file
> is implicitly executed, and the objects it defines are bound to names in the
> package's namespace. The `__init__.py` file can contain the same Python code
> that any other module can contain, and Python will add some additional
> attributes to the module when it is imported."*

`__path__` behaves like a private `sys.path` for that package:

> *"A package's `__path__` attribute is used during imports of its subpackages.
> Within the import machinery, it functions much the same as `sys.path`… The same
> rules used for `sys.path` also apply to a package's `__path__`.
> `sys.path_hooks` are consulted when traversing a package's `__path__`."*

The authoritative modern test for "is this a package?" is not `hasattr(mod,
"__path__")` but `mod.__spec__.submodule_search_locations is not None`, since the
spec attribute is the one the machinery actually sets and the module attribute is
the one the docs now recommend against reading directly.

## Importing a subpackage runs every `__init__.py` above it

The reference gives the layout and the consequence:

```
parent/
    __init__.py
    one/
        __init__.py
    two/
        __init__.py
    three/
        __init__.py
```

> *"Importing `parent.one` will implicitly execute `parent/__init__.py` and
> `parent/one/__init__.py`. Subsequent imports of `parent.two` or `parent.three`
> will execute `parent/two/__init__.py` and `parent/three/__init__.py`
> respectively."*

Two facts to hold together. **Parents run first, all the way down**, so
`import a.b.c.d` executes four module bodies. And **each runs once**, because
`sys.modules` caches every intermediate name — the reference notes the cache
contains *"entries for `foo`, `foo.bar`, and `foo.bar.baz`"*.

That first fact is the whole cost story. There is no way to import a submodule
without running its package's `__init__.py`. Whatever you put there is a tax on
every entry point into the package, including the ones that do not need it.

## What re-exporting in `__init__.py` actually costs

The convenience is real:

```python
# mypkg/__init__.py
from .engine import Engine
from .client import Client
from .config import Config

__all__ = ["Engine", "Client", "Config"]
```

Now `from mypkg import Engine` works and users never see the internal layout. The
price is that `import mypkg.version` — or `import mypkg` for any reason at all —
now executes `engine.py`, `client.py` and `config.py`, plus everything *they*
import at module level. If `client.py` imports `httpx` and `engine.py` imports
`numpy`, then reading your package's version number loads an HTTP stack and a
numerical library.

This is why a CLI written as a package with a rich `__init__.py` feels slow, and
why `--help` can take a second. The measurement tool is `python -X importtime`
([chunk 2d](02d-diagnosing-import-failures.md)); the cost analysis belongs to
[11 · Startup and import cost](../11-startup-and-import-cost/README.md).

There are three honest positions, and picking one deliberately is the point:

**1. Empty `__init__.py`, explicit submodule imports.** Cheapest, most honest,
worst ergonomics. Users write `from mypkg.engine import Engine`. Every import
costs exactly what it uses. This is what the standard library does — `import
xml` gives you nothing, as [chunk 1](01-modules-and-the-cache.md) covered.

**2. Eager re-export.** Best ergonomics, full cost on every import, and it is
correct when the package is small or when every user needs everything anyway.

**3. Lazy re-export with a module-level `__getattr__`.** Both, at the cost of
five lines and a small amount of magic. PEP 562 added it in 3.7 and the data
model documents the protocol:

> *"Special names `__getattr__` and `__dir__` can be also used to customize
> access to module attributes. The `__getattr__` function at the module level
> should accept one argument which is the name of an attribute and return the
> computed value or raise an `AttributeError`. If an attribute is not found on a
> module object through the normal lookup, i.e. `object.__getattribute__`, then
> `__getattr__` is searched in the module `__dict__` before raising an
> `AttributeError`. If found, it is called with the attribute name and the result
> is returned."*

```python
# mypkg/__init__.py
import importlib

__all__ = ["Engine", "Client", "Config"]
_LAZY = {"Engine": ".engine", "Client": ".client", "Config": ".config"}

def __getattr__(name):
    if name in _LAZY:
        module = importlib.import_module(_LAZY[name], __name__)
        value = getattr(module, name)
        globals()[name] = value        # cache it; __getattr__ won't run again
        return value
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")

def __dir__():
    return sorted(__all__)
```

`from mypkg import Engine` now imports `mypkg.engine` and nothing else. The
`globals()[name] = value` line matters: module `__getattr__` is only consulted
*after* normal lookup fails, so writing the value into the module dict makes
every subsequent access a plain dict hit.

The documented limitation is worth quoting, because it is the one that surprises:

> *"Defining module `__getattr__` and setting module `__class__` only affect
> lookups made using the attribute access syntax — directly accessing the module
> globals (whether by code within the module, or via a reference to the module's
> globals dictionary) is unaffected."*

So code *inside* `__init__.py` that refers to a bare `Engine` will still raise
`NameError`. The lazy names exist for importers, not for the module itself.

The `__dir__` half is not optional in practice: without it, tab completion and
`dir(mypkg)` show none of the lazy names, and static analysers already need a
`if TYPE_CHECKING:` block of real imports to see them at all.

## `__path__` is writable, and that used to be the whole game

> *"A package's `__init__.py` file may set or alter the package's `__path__`
> attribute, and this was typically the way namespace packages were implemented
> prior to PEP 420. With the adoption of PEP 420, namespace packages no longer
> need to supply `__init__.py` files containing only `__path__` manipulation
> code; the import machinery automatically sets `__path__` correctly for the
> namespace package."*

If you meet an `__init__.py` whose entire content is
`__path__ = __import__('pkgutil').extend_path(__path__, __name__)` or a
`pkg_resources.declare_namespace(__name__)` call, that is pre-3.3 namespace
machinery. [Chunk 4c](04c-namespace-packages.md) covers the replacement; the
short version is that both are obsolete and the correct modern form of that file
is no file at all.

Deliberately extending `__path__` for any other purpose — pointing a package at a
plugins directory, say — still works and is still a bad idea: it makes the
package's contents depend on runtime state, it defeats every static tool, and
`importlib.resources` and entry points solve the same problems without it.

## Gotchas

**Symptom:** importing one small helper from a package pulls in the entire dependency tree
**Cause:** `__init__.py` eagerly re-exports, and every parent `__init__.py` runs before the submodule
**Fix:** empty the `__init__.py`, or move the re-exports behind a module-level `__getattr__`. Measure with `python -X importtime` before and after

**Symptom:** `python -X importtime` shows a package importing `numpy`/`pandas`/`httpx` in a program that never uses them
**Cause:** a transitive `__init__.py` re-export chain
**Fix:** the same lazy `__getattr__`. It is the only mechanism that keeps `from mypkg import Thing` working while not importing the rest

**Symptom:** a lazy `__getattr__` works from outside the package but `NameError`s inside it
**Cause:** documented — module `__getattr__` *"only affect[s] lookups made using the attribute access syntax"*; a bare global reference inside the module is not attribute access
**Fix:** inside the package, import what you need explicitly. The lazy layer is an external API, not an internal one

**Symptom:** a lazily-exported name is invisible to autocompletion and to the type checker
**Cause:** the name exists only at runtime, produced by a function
**Fix:** define `__dir__` returning `__all__`, and add an `if TYPE_CHECKING:` block with the real imports so static tools see them. Both are needed; neither costs anything at runtime

**Symptom:** `__init__.py` opens a connection, reads a config file or configures logging, and it happens at import
**Cause:** `__init__.py` is a module body; it runs on the first import of anything in the package, in whatever order imports happen to occur
**Fix:** move it into an explicit `configure()` or `create_app()` the caller invokes. A library that configures logging at import time is a bug in every application that uses it

**Symptom:** circular imports appear as soon as `__init__.py` gains re-exports
**Cause:** `mypkg/__init__.py` imports `mypkg.engine`, which does `from mypkg import something` — and `mypkg` is only partially initialised at that moment
**Fix:** submodules should never import from their own package's `__init__.py`. Use `from mypkg.constants import X`, not `from mypkg import X`. [Chunk 6](06-circular-imports.md) covers the mechanism

**Symptom:** a subdirectory of your package is importable but has none of the package's behaviour
**Cause:** it has no `__init__.py`, so it is a namespace *subpackage* of the enclosing regular package — the reference describes exactly this case
**Fix:** add the `__init__.py`. Inside a single distribution there is no reason for a namespace subpackage

**Symptom:** an `__init__.py` contains only `extend_path` or `declare_namespace`
**Cause:** pre-PEP 420 namespace machinery, obsolete since Python 3.3
**Fix:** delete the file entirely if a namespace package is wanted, or replace it with a normal `__init__.py` if it is not

**Symptom:** a package's contents change depending on how the program was started
**Cause:** something mutates `__path__` at runtime — usually plugin discovery bolted onto `__init__.py`
**Fix:** use entry points or an explicit registry. A package whose members depend on runtime state cannot be reasoned about or type-checked

## Interview questions

**★ What is `__init__.py` for, and what does putting code in it cost?**
It is the package module's body — the file that executes when the package is
first imported, binding whatever it defines as attributes of the package. The
cost is that it runs before *any* submodule import, and every parent package's
`__init__.py` runs too. So a re-export chain in `__init__.py` means importing the
smallest thing in the package pays for the largest. That is the trade: a clean
public API in exchange for import cost on every entry point.

**★ How do you get a convenient top-level API without the import cost?**
A module-level `__getattr__` (PEP 562, available since 3.7). It is called only
when normal attribute lookup fails, so you import the submodule on demand, cache
the result into `globals()`, and every later access is a plain dict lookup.
Add `__dir__` for introspection and an `if TYPE_CHECKING:` block of real imports
for static analysis. The documented limitation is that it does not affect direct
access to the module globals, so code inside the package cannot rely on it.

**Should `__init__.py` be empty?**
For a library where import cost matters, or where the package is a namespace of
loosely related modules: yes, or nearly. For a small package where every user
needs the same three names: a few re-exports are better ergonomics and the cost
is negligible. What it should never contain is *behaviour* — connections, logging
configuration, environment reads, thread starts — because those happen at an
unpredictable point determined by whoever imports first.

**Why do circular imports so often start in `__init__.py`?**
Because a re-exporting `__init__.py` imports its own submodules, and those
submodules are frequently written to import names back from the package root.
When `mypkg/__init__.py` is halfway through its body, `mypkg` exists in
`sys.modules` but most of its attributes do not yet, so `from mypkg import X`
inside a submodule fails. Importing from the defining submodule
(`from mypkg.constants import X`) rather than from the package removes the cycle
entirely.

**What is `__path__`, and why can you write to it?**
It is the package's own search path — the reference says it *"functions much the
same as `sys.path`"* within the import machinery, and `sys.path_hooks` apply to
it. It is writable because before PEP 420 that was the only way to build a
namespace package: an `__init__.py` that extended `__path__` with directories
found elsewhere. Since 3.3 the machinery does that itself, so writing to
`__path__` is legacy code or a plugin hack, and neither should survive review.

**Where should a package put code that must run once at startup?**
Not in `__init__.py`. Put it in a function — `configure()`, `create_app()`,
`setup_logging()` — that the application calls explicitly. Import time is chosen
by whoever imports first, not by you: it can happen during test collection,
during a documentation build, inside a `multiprocessing` child, or in a process
that only wanted to read `__version__`.

---

← Prev: [Diagnosis and prevention](03b-diagnosing-and-preventing-shadowing.md) · Index: [Imports](README.md) · Next → [Exports, binding forms and `__all__`](04b-exports-and-all.md)
