---
title: "A leading dot is resolved against __spec__.parent, which is why python mypkg/module.py can never work"
sidebar_label: "5 · Relative imports"
sidebar_position: 14
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the Python 3.14
> [import system reference](https://docs.python.org/3.14/reference/import.html)
> (package relative imports, special considerations for `__main__`),
> [§7.11 The `import` statement](https://docs.python.org/3.14/reference/simple_stmts.html#the-import-statement),
> [import-related attributes on module objects](https://docs.python.org/3.14/reference/datamodel.html)
> (the `__package__` deprecation),
> and [PEP 328](https://peps.python.org/pep-0328/).
> Target: **CPython 3.14**.

**A relative import does not look at the filesystem. It takes the module's
*package name* — `__spec__.parent` — strips one component per extra dot, and
performs an ordinary absolute import of the result. A file executed directly has
no package name, so there is nothing to strip and nothing to resolve, which is
the entire reason `python mypkg/module.py` raises `attempted relative import with
no known parent package` while `python -m mypkg.module` works. Once you see
relative imports as string arithmetic on a package name, every error message in
this chunk becomes obvious.**

## The syntax, and the one thing it cannot do

> *"Relative imports use leading dots. A single leading dot indicates a relative
> import, starting with the current package. Two or more leading dots indicate a
> relative import to the parent(s) of the current package, one level per dot
> after the first."*

For the reference's layout:

```
package/
    __init__.py
    subpackage1/
        __init__.py
        moduleX.py
        moduleY.py
    subpackage2/
        __init__.py
        moduleZ.py
    moduleA.py
```

> *"In either `subpackage1/moduleX.py` or `subpackage1/__init__.py`, the
> following are valid relative imports:"*

```python
from .moduleY import spam
from .moduleY import spam as ham
from . import moduleY
from ..subpackage1 import moduleY
from ..subpackage2.moduleZ import eggs
from ..moduleA import foo
```

There is no `import .moduleY`, and the reference explains why:

> *"Absolute imports may use either the `import <>` or `from <> import <>`
> syntax, but relative imports may only use the second form; the reason for this
> is that `import XXX.YYY.ZZZ` should expose `XXX.YYY.ZZZ` as a usable
> expression, but .moduleY is not a valid expression."*

So `from . import moduleY` is the relative equivalent of `import moduleY`, and it
is the form to reach for when you want the module object rather than a name out
of it — which, per [chunk 1b](01b-reload-and-monkeypatching.md), is also the form
that survives patching and cycles.

## Why implicit relative imports were removed

Before Python 3, a bare `import foo` inside a package would find a sibling
`foo.py` before looking at `sys.path`. PEP 328 removed that, and its rationale is
worth reading because it is the same failure as
[chunk 3](03-shadowing-the-stdlib.md) at package scope:

> *"Imports can be ambiguous in the face of packages; within a package, it's not
> clear whether `import foo` refers to a module within the package or some module
> outside the package. (More precisely, a local module or package can shadow
> another hanging directly off `sys.path`.)"*

> *"In Python 2.4 and earlier, if you're reading a module located inside a
> package, it is not clear whether `import foo` refers to a top-level module or to
> another module inside the package. As Python's library expands, more and more
> existing package internal modules suddenly shadow standard library modules by
> accident. It's a particularly difficult problem inside packages because there's
> no way to specify which module is meant. To resolve the ambiguity, it is
> proposed that `foo` will always be a module or package reachable from
> `sys.path`. This is called an absolute import."*

The result on 3.14: **`import foo` inside a package is always absolute.** A
sibling module is reachable only as `from . import foo` or by its full dotted
path. That is why adding a `logging.py` to your package is safe, and adding it to
your project root is not.

## What the dots are actually resolved against

The dots are stripped from the module's *package name*, and that name lives on
the spec. The data model:

> *"`module.__package__` — The package a module belongs to. If the module is
> top-level (that is, not a part of any specific package) then the attribute
> should be set to `''` (the empty string). Otherwise, it should be set to the
> name of the module's package (which can be equal to `module.__name__` if the
> module itself is a package)."*

> *"This attribute is used instead of `__name__` to calculate explicit relative
> imports for main modules."*

and the `ModuleSpec` documentation, for the attribute that replaces it:

> *"`parent` — (Read-only) The fully qualified name of the package the module is
> in (or the empty string for a top-level module)… If the module is a package
> then this is the same as `name`."*

So for `mypkg.sub.moduleX`:

| Expression | Resolves to |
|---|---|
| `__spec__.parent` | `"mypkg.sub"` |
| `from . import y` | `mypkg.sub.y` |
| `from .. import y` | `mypkg.y` |
| `from ...pkg2 import y` | *fails* — nothing left to strip |

And for `mypkg/sub/__init__.py`, `__spec__.parent` is `"mypkg.sub"` itself, not
`"mypkg"` — a package is its own parent for this purpose. That off-by-one is why
`from . import x` in `__init__.py` imports a *sibling of the `__init__.py` file*,
i.e. a submodule, and not a sibling of the package directory.

**Use `__spec__.parent`, not `__package__`.** The data model is explicit:

> *"It is **strongly** recommended that you use `module.__spec__.parent` instead
> of `module.__package__`. `__package__` is now only used as a fallback if
> `__spec__.parent` is not set, and this fallback path is deprecated."*

> *"Deprecated since version 3.13, will be removed in version 3.15: `__package__`
> will cease to be set or taken into consideration by the import system or
> standard library."*

That deadline matters here more than anywhere else in this topic, because
`__package__` is the attribute the old PEP 366 workaround assigns:

```python
# PEP 366 boilerplate — do NOT adopt this on 3.13+
if __name__ == "__main__" and __package__ is None:
    __package__ = "expected.package.name"
```

PEP 366 proposed it in 2007 as a way to make relative imports work in a directly
executed file. It stops working in 3.15. The replacement is not a different
attribute — it is `python -m`.

## The two error messages, and what each one means

Both are raised by the import machinery in `importlib._bootstrap`.

**`attempted relative import with no known parent package`** — the module's
package name is empty, so there is nothing for a dot to refer to. Every
occurrence of this message means one of exactly three things:

1. The file was run directly (`python mypkg/module.py`), so it is `__main__` with
   no package.
2. The file was imported as a *top-level* module because its directory, not its
   parent, was on `sys.path` — usually the same root cause.
3. The directory is not actually a package from the interpreter's point of view.

**`attempted relative import beyond top-level package`** — the package name ran
out of components before the dots ran out. `from ... import x` inside
`mypkg.sub.mod` (parent `mypkg.sub`, two components) has one dot too many.
Relative imports cannot escape the top-level package; if you need something above
it, that something is a separate top-level import.

## Doing a relative import dynamically

`importlib.import_module` accepts the same dotted syntax, but a relative name
needs an explicit anchor because there is no calling module for it to infer:

> *"The *name* argument specifies what module to import in absolute or relative
> terms (e.g. either `pkg.mod` or `..mod`). If the name is specified in relative
> terms, then the *package* argument must be set to the name of the package which
> is to act as the anchor for resolving the package name (e.g.
> `import_module('..mod', 'pkg.subpkg')` will import `pkg.mod`)."*

```python
import importlib

mod = importlib.import_module(".plugins.csv", package=__spec__.parent)
```

Passing `__spec__.parent` rather than `__package__` keeps this working past 3.15.
For a plugin loader, though, the absolute name is usually clearer — the anchor
adds a second thing that can be wrong.

## Relative imports inside a namespace package

They work, and they resolve exactly the same way, because the dots are resolved
against the package *name*, not against a directory. A module in a namespace
package `acme.tools` has `__spec__.parent == "acme.tools"` and `from . import x`
imports `acme.tools.x` — which may live in a different portion, in a different
distribution, on a different part of `sys.path`. That is the intended behaviour
([chunk 4c](04c-namespace-packages.md)), and it is also why a relative import in
a namespace package can start resolving to someone else's file after an install.

## Gotchas

**Symptom:** `ImportError: attempted relative import with no known parent package`
**Cause:** the file was executed directly, so it is `__main__` with `__spec__` set to `None` and no package name for the dots to resolve against
**Fix:** `python -m mypkg.module` from the directory above `mypkg`. Adding `__init__.py` does not help; the problem is how the file was launched, not what is next to it

**Symptom:** `ImportError: attempted relative import beyond top-level package`
**Cause:** more dots than the package name has components — `from ... import x` in a module whose `__spec__.parent` is `mypkg.sub`
**Fix:** count the dots against `__spec__.parent`, not against directories on disk. If you genuinely need something outside the package, import it absolutely

**Symptom:** `import helpers` inside a package finds a *different* `helpers` from the one next to it
**Cause:** since PEP 328, `import helpers` inside a package is absolute — it searches `sys.path`, not the package directory
**Fix:** `from . import helpers`, or `from mypkg import helpers`. Implicit relative imports have not existed since Python 3.0

**Symptom:** `from . import x` in `__init__.py` imports something you did not expect
**Cause:** for a package, `__spec__.parent` is the package itself, so a single dot means "inside this package" — not "next to this package directory"
**Fix:** count from `__spec__.parent`. To reach a sibling *of the package*, you need two dots, and the package must not be top-level

**Symptom:** an editor or type checker flags a relative import that runs fine
**Cause:** the tool resolved the file as a standalone module because the directory has no `__init__.py`, or its configured source roots differ from the runtime `sys.path`
**Fix:** add the `__init__.py` and configure the tool's source root to match how the code is actually launched. A disagreement here usually means the runtime arrangement is fragile too

**Symptom:** `importlib.import_module(".mod")` raises `TypeError` about a relative import
**Cause:** a relative name requires the `package` anchor; the docs state it *"must be set to the name of the package which is to act as the anchor"*
**Fix:** pass `package=__spec__.parent`, or use the absolute name. Do not pass `__package__` — it disappears in 3.15

**Symptom:** `from . import *` in `__init__.py` does not import the submodules you expected
**Cause:** a star import binds the *public names of the package module*, which for a package means whatever `__init__.py` has already defined — submodules that nothing imported are not attributes yet
**Fix:** list the submodules explicitly, or enumerate them with `pkgutil.iter_modules(__path__)` and import each by name

**Symptom:** a relative import inside a namespace package starts resolving to another distribution's file
**Cause:** the dots resolve against the package *name*, and a namespace package's portions can come from anywhere on `sys.path`
**Fix:** this is what namespace packages are for; if it was not intended, the directory should have had an `__init__.py`

## Interview questions

**★ What are relative imports resolved against?**
The module's package name, `__spec__.parent` — a string, not a directory. One
leading dot means that package; each extra dot strips one trailing component. A
top-level module has an empty parent, so any dot fails with `attempted relative
import with no known parent package`, and running out of components before you
run out of dots gives `attempted relative import beyond top-level package`.
Nothing about this consults the filesystem.

**★ Why can you not write `import .module`?**
Because `import X.Y.Z` is specified to make `X.Y.Z` a usable expression, and
`.module` is not a valid expression — the reference gives exactly that reason.
The relative equivalent is `from . import module`, which binds the module object
under a legal name.

**What happened to implicit relative imports, and why?**
PEP 328 removed them. Inside a package, `import foo` used to find a sibling
`foo.py` first; now it is always absolute. The PEP's reason was ambiguity: *"a
local module or package can shadow another hanging directly off `sys.path`"*, and
*"more and more existing package internal modules suddenly shadow standard
library modules by accident"*. Removing them is what makes a `logging.py` inside
a package harmless.

**How do you perform a relative import dynamically?**
`importlib.import_module(".sub.mod", package=__spec__.parent)`. The anchor is
mandatory for a relative name because there is no importing module for the
function to infer one from. Use `__spec__.parent`, not `__package__`, since the
latter stops being set in 3.15 — and consider whether an absolute name would be
clearer, since a dynamic import is usually reading a name from configuration
anyway.

**Do relative imports work inside a namespace package?**
Yes, identically, because resolution is string arithmetic on the package name and
never touches the filesystem. `from . import x` in a module of `acme.tools`
imports `acme.tools.x` regardless of which portion — which directory, which
installed distribution — actually provides it. That is the feature, and it is
also why an accidental namespace package can start resolving relative imports to
files you did not write.

---

← Prev: [Namespace packages](04c-namespace-packages.md) · Index: [Imports](README.md) · Next → [Running a module: `-m` versus a file](05b-running-a-module.md)
