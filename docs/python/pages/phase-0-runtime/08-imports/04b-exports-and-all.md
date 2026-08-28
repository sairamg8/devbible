---
title: "from pkg import name checks an attribute before it imports a submodule, and __all__ only ever governs the star"
sidebar_label: "4b · Exports and __all__"
sidebar_position: 12
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the Python 3.14
> [§7.11 The `import` statement](https://docs.python.org/3.14/reference/simple_stmts.html#the-import-statement)
> (the `from` form's lookup order, and `module.__all__`) and the
> [import system reference](https://docs.python.org/3.14/reference/import.html)
> (submodule binding).
> Target: **CPython 3.14**.

**Three import spellings that look interchangeable bind three different things,
and the differences are specified, not incidental. `from pkg import name` prefers
an *attribute* and falls back to a submodule. `import pkg.sub` binds `pkg`.
`__all__` governs exactly one statement — `from pkg import *` — and does nothing
whatsoever to make a name private. Every ambiguity in a package's public surface
comes out of those three rules.**

## `from pkg import name` is ambiguous by design

The reference specifies the `from` form as a two-step lookup:

> *"1. check if the imported module has an attribute by that name 2. if not,
> attempt to import a submodule with that name and then check the imported module
> again for that attribute"*

So `from mypkg import engine` returns either a *variable* named `engine` defined
in `__init__.py`, or the *submodule* `mypkg.engine` — whichever exists, attribute
first. That fallback is why `from mypkg import engine` works with an empty
`__init__.py`, and it is also why a variable named `engine` in `__init__.py`
silently shadows the submodule of the same name for every `from` importer.

Meanwhile the plain form binds differently:

> *"If the module being imported is *not* a top level module, then the name of the
> top level package that contains the module is bound in the local namespace as a
> reference to the top level package."*

`import mypkg.engine` binds `mypkg`, not `engine`. Combined with the submodule
binding invariant from [chunk 1](01-modules-and-the-cache.md), the effect is that
after any import of `mypkg.engine` anywhere in the process, `mypkg.engine` is a
valid attribute access for everyone — which is exactly the accidental-dependency
trap that chunk described.

## `__all__` — what it controls, and what it does not

> *"The *public names* defined by a module are determined by checking the module's
> namespace for a variable named `__all__`; if defined, it must be a sequence of
> strings which are names defined or imported by that module… The names given in
> `__all__` are all considered public and are required to exist. If `__all__` is
> not defined, the set of public names includes all names found in the module's
> namespace which do not begin with an underscore character (`'_'`).
> `__all__` should contain the entire public API. It is intended to avoid
> accidentally exporting items that are not part of the API (such as library
> modules which were imported and used within the module)."*

Three precise consequences:

- **`__all__` only affects `from module import *`.** It does not make anything
  private, it does not block `from mypkg import _internal`, and it does not
  affect `import mypkg; mypkg.anything`.
- **The names are *required to exist*.** A stale entry in `__all__` after a
  rename turns `from mypkg import *` into an `AttributeError`, which is a real
  and easily-missed way to break a release.
- **Without `__all__`, "public" means "does not start with an underscore"** —
  including every module you imported at the top of the file. A module that does
  `import os` and no `__all__` exports `os` under a star-import.

For a package's `__init__.py`, `__all__` also carries a convention the tooling
depends on: type checkers and linters treat a name listed in `__all__` as a
deliberate re-export rather than an unused import, which is why
`from .engine import Engine` in `__init__.py` needs either an `__all__` entry or
an explicit `as` re-export (`from .engine import Engine as Engine`) to avoid an
"imported but unused" diagnostic.

## Re-export conventions the tooling actually reads

Three spellings mean "this import is deliberately part of my public API", and
static tools treat them differently from a plain import:

```python
# 1 — listed in __all__
from .engine import Engine
__all__ = ["Engine"]

# 2 — redundant alias, the "explicit re-export" convention
from .engine import Engine as Engine

# 3 — a module re-exported by name
from . import engine
__all__ = ["engine"]
```

All three make `from mypkg import Engine` (or `engine`) work at runtime; the
difference is whether a type checker considers the name exported from `mypkg` or
merely visible there. A plain `from .engine import Engine` with no `__all__` is
the case tools disagree about, and it is the one that produces "imported but
unused" warnings in `__init__.py`.

A fourth spelling is worth avoiding entirely:

```python
from .engine import *          # in __init__.py
```

It re-exports whatever `engine.__all__` says today, silently changes when
`engine` changes, and makes it impossible to tell from `__init__.py` what the
package's surface is. If the goal is "everything", write the list.

## Gotchas

**Symptom:** `from mypkg import engine` returns something that is not the module you expected
**Cause:** `__init__.py` defines a variable called `engine`; the `from` form checks attributes *before* trying to import a submodule
**Fix:** do not give a package-level name the same name as a submodule. If you must, `import mypkg.engine` and reference it by full path

**Symptom:** `from mypkg import *` raises `AttributeError` for a name nobody uses
**Cause:** `__all__` lists a name that was renamed or deleted; the language reference says the names *"are required to exist"*
**Fix:** test it — one `from mypkg import *` in the test suite catches every stale entry

**Symptom:** `from mymodule import *` brings `os`, `sys` and `json` into the caller's namespace
**Cause:** no `__all__`, so every non-underscore global counts as public, including imported modules
**Fix:** define `__all__` in any module that might be star-imported. The docs name this exact motivation: *"to avoid accidentally exporting items that are not part of the API (such as library modules which were imported and used within the module)"*

**Symptom:** a linter reports the re-exports in `__init__.py` as unused imports
**Cause:** they are unused *within that file*; the tooling needs a signal that they are deliberate re-exports
**Fix:** list them in `__all__`, or write `from .engine import Engine as Engine`. Both are recognised conventions

**Symptom:** a name is in `__all__` and users still cannot see it in an IDE
**Cause:** `__all__` affects the star import at runtime; editors and type checkers additionally want the name to be a real binding they can resolve statically
**Fix:** for lazily-produced names, add an `if TYPE_CHECKING:` block with the real imports alongside `__all__`

**Symptom:** `dir(mypkg)` does not list a submodule that is definitely importable
**Cause:** the submodule has not been imported yet, so nothing has bound it as an attribute of the package
**Fix:** expected. Use `pkgutil.iter_modules(mypkg.__path__)` to enumerate what *could* be imported rather than what has been

**Symptom:** `from mypkg import submodule` works in production and fails in a fresh interpreter
**Cause:** in production some other module had already imported `mypkg.submodule`, so it was an attribute; the `from` form's fallback then never had to run — until an environment where the import order differs and the fallback exposes a genuine problem in the submodule
**Fix:** never rely on attribute-vs-submodule ambiguity. Import the submodule explicitly where you use it

## Interview questions

**★ What does `__all__` actually do?**
It defines the names bound by `from module import *`, and nothing else. It does
not make other names private, does not affect explicit imports or attribute
access, and it *requires* every listed name to exist — a stale entry turns a
star-import into an `AttributeError`. Without it, "public" means every global not
starting with an underscore, which silently includes the modules you imported at
the top of the file.

**Why does `import xml` not give you `xml.etree`, but `import os` gives you
`os.path`?**
Because importing a package executes only its `__init__.py`, and `os` imports
`os.path` in its own body while `xml` does not import `xml.etree`. Nothing else
distinguishes them. The general rule is that a package's submodules are only
bound after something imports them — and once anything in the process does, the
attribute is there for everyone, which is how code comes to depend on an import
it never wrote.

**What is the difference between `from mypkg import engine` and
`import mypkg.engine`?**
The first checks for an *attribute* named `engine` on the package and only then
falls back to importing a submodule — so a variable in `__init__.py` can shadow
the submodule. It binds `engine` in your namespace. The second always imports the
submodule and binds the *top-level package* name `mypkg`, so you must write
`mypkg.engine` to use it. Both leave `mypkg.engine` bound as an attribute of
`mypkg` for the whole process.

**★ Why can a variable in `__init__.py` shadow a submodule of the same name?**
Because the `from` form is specified to check the imported module for an
attribute of that name *first*, and only *"if not, attempt to import a submodule
with that name"*. A module-level `engine = ...` in `__init__.py` is already an
attribute, so `from mypkg import engine` never reaches the submodule fallback.
`import mypkg.engine` is unambiguous, because it names the submodule directly.

**Does `__all__` make anything private?**
No. Underscore-prefixed names are a convention with no enforcement, and `__all__`
does not add enforcement either — `from mypkg import _internal` and
`mypkg._internal` both work regardless. What `__all__` does is define the names
bound by `from mypkg import *`, and signal deliberate re-export intent to
linters and type checkers.

**What happens if `__all__` lists a name that does not exist?**
`from module import *` raises `AttributeError`. The language reference states the
listed names *"are required to exist"*. Since nothing else exercises `__all__`, a
stale entry survives every test suite that does not contain a star import — which
is the argument for putting exactly one such import in your tests.

---

← Prev: [Packages and `__init__.py`](04-packages-and-init.md) · Index: [Imports](README.md) · Next → [Namespace packages](04c-namespace-packages.md)
