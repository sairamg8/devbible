---
title: "What the import system records about a module: its attributes and its spec"
sidebar_label: "1c · Attributes and specs"
sidebar_position: 3
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against
> [import-related attributes on module objects](https://docs.python.org/3.14/reference/datamodel.html)
> in the Python 3.14 data model,
> [`importlib.machinery.ModuleSpec`](https://docs.python.org/3.14/library/importlib.html#importlib.machinery.ModuleSpec),
> [`importlib.util.find_spec`](https://docs.python.org/3.14/library/importlib.html#importlib.util.find_spec),
> and the [import system reference](https://docs.python.org/3.14/reference/import.html).
> Target: **CPython 3.14**.

**Every module the import machinery creates carries a fixed set of bookkeeping
attributes, filled in from a `ModuleSpec` *before* the body runs. Several of
those attributes are on a removal schedule for Python 3.15, and the ones that
survive are the ones you should be writing today. This chunk is the reference for
what is recorded, which name is authoritative, and how to ask the import system
where a name would resolve to without executing the module you are asking
about.**

## The attributes, and which ones survive 3.15

| Attribute | What it is | Status on 3.14 |
|---|---|---|
| `__name__` | the fully qualified name; `"__main__"` for a directly executed module | authoritative |
| `__spec__` | the `ModuleSpec` — name, loader, origin, `parent`, `submodule_search_locations` | authoritative |
| `__package__` | the package the module belongs to | **deprecated**, removed in 3.15 |
| `__path__` | search locations for a package's submodules | prefer `__spec__.submodule_search_locations` |
| `__file__` | the file it loaded from; optional | may legitimately be absent |
| `__cached__` | the `.pyc` path; optional | prefer `__spec__.cached` |
| `__loader__` | the loader object | prefer `__spec__.loader` |

The data model is blunt about the deprecations:

> *"It is **strongly** recommended that you use `module.__spec__.parent` instead
> of `module.__package__`. `__package__` is now only used as a fallback if
> `__spec__.parent` is not set, and this fallback path is deprecated."*

> *"Deprecated since version 3.13, will be removed in version 3.15: `__package__`
> will cease to be set or taken into consideration by the import system or
> standard library."*

That is a live deadline — 3.15 is due October 2026. Any code that reads or writes
`module.__package__`, including the PEP 366 `__package__ = "…"` boilerplate still
circulating in blog posts, needs to move to `__spec__.parent`. Chunk
[5 · Relative imports](05-relative-imports.md) is where that attribute does real
work: it is what a leading dot is resolved against.

`__cached__` is on the same schedule:

> *"Deprecated since version 3.13, will be removed in version 3.15: Setting
> `__cached__` on a module while failing to set `__spec__.cached` is deprecated.
> In Python 3.15, `__cached__` will cease to be set or taken into consideration
> by the import system or standard library."*

## `__file__` is optional, and treating it as a path is a bug waiting

> *"`__file__` and `__cached__` are both optional attributes that may or may not
> be set. Both attributes should be a `str` when they are available."*

> *"It might be missing for certain types of modules, such as C modules that are
> statically linked into the interpreter, and the import system may opt to leave
> it unset if it has no semantic meaning (for example, a module loaded from a
> database)."*

The everyday consequence is that this line, which appears in thousands of
projects, has a hole in it:

```python
DATA = os.path.join(os.path.dirname(__file__), "templates", "index.html")
```

It breaks for frozen builds (PyInstaller, `python -m zipapp`), for modules loaded
from a zip, and for anything statically linked. The supported replacement reads
the resource through the package rather than through the filesystem:

```python
from importlib import resources

text = resources.files("mypkg").joinpath("templates/index.html").read_text()
```

Reserve `__file__` for diagnostics — printing where a module actually came from
is its best use, and chunk [3 · Shadowing the stdlib](03-shadowing-the-stdlib.md)
leans on exactly that.

## `ModuleSpec` — the object the whole machinery passes around

> *"A specification for a module's import-system-related state. This is typically
> exposed as the module's `__spec__` attribute. Many of these attributes are also
> available directly on a module: for example, `module.__spec__.origin ==
> module.__file__`. Note, however, that while the *values* are usually
> equivalent, they can differ since there is no synchronization between the two
> objects."*

The fields worth memorising:

- **`name`** — *"The module's fully qualified name."*
- **`loader`** — the object that will execute the module.
- **`origin`** — *"The location the loader should use to load the module… In the
  uncommon case that there is not one (like for namespace packages), it should be
  set to `None`."* An `origin` of `None` on something you believe is a package is
  the fastest tell that you have an accidental namespace package
  ([chunk 4c](04c-namespace-packages.md)).
- **`submodule_search_locations`** — *"A (possibly empty) sequence of strings
  enumerating the locations in which a package's submodules will be found… The
  finder should set this attribute to a sequence, even an empty one, to indicate
  to the import system that the module is a package. It should be set to `None`
  for non-package modules."* This is the authoritative "is it a package?" test.
- **`parent`** — *"(Read-only) The fully qualified name of the package the module
  is in (or the empty string for a top-level module)… If the module is a package
  then this is the same as `name`."*
- **`cached`** — the `.pyc` path.
- **`has_location`** — *"`True` if the spec's `origin` refers to a loadable
  location."*

Note the "no synchronization" warning in the class description: `__file__` and
`__spec__.origin` can drift apart because either can be reassigned. When they
disagree, `__spec__` is the one the import system used.

## Asking "where would this import come from?" without importing it

`importlib.util.find_spec` runs the search and stops before execution:

> *"Find the spec for a module, optionally relative to the specified **package**
> name. If the module is in `sys.modules`, then `sys.modules[name].__spec__` is
> returned (unless the spec would be `None` or is not set, in which case
> `ValueError` is raised). Otherwise a search using `sys.meta_path` is done.
> `None` is returned if no spec is found."*

```python
import importlib.util

spec = importlib.util.find_spec("requests")
if spec is None:
    ...                         # not installed / not on sys.path
else:
    spec.origin                 # the file it WOULD load
    spec.submodule_search_locations  # not None => it is a package
```

This is the honest way to answer "is this optional dependency available?" without
paying the import cost or running its side effects, and it is the right first
command when a name resolves to the wrong file — it tells you the origin without
the module body getting a chance to fail first.

Two documented sharp edges:

- *"If **name** is for a submodule (contains a dot), the parent module is
  automatically imported."* So `find_spec("mypkg.sub")` is **not** side-effect
  free: `mypkg/__init__.py` runs.
- Since 3.7 it *"raises `ModuleNotFoundError` instead of `AttributeError` if
  **package** is in fact not a package"*.

## Gotchas

**Symptom:** `os.path.dirname(__file__)` fails, or points into a temp directory, for a module that works fine otherwise
**Cause:** `__file__` is documented as optional and is absent for statically linked C modules; for frozen and zipped applications it may exist but not name a real directory
**Fix:** use `importlib.resources.files(package)` for package data. Reserve `__file__` for diagnostics, where its absence is survivable

**Symptom:** a `DeprecationWarning` about `__package__` appears in a library you did not write
**Cause:** something is relying on the `__package__` fallback for relative-import resolution instead of `__spec__.parent`; 3.12 changed that from `ImportWarning` to `DeprecationWarning`
**Fix:** report it upstream and pin a plan — the fallback path stops existing in 3.15, so the warning is a countdown, not a style note

**Symptom:** `module.__file__` and `module.__spec__.origin` disagree
**Cause:** the class docs state explicitly that there is *"no synchronization between the two objects"* — either can be reassigned independently, and some import hooks do
**Fix:** trust `__spec__`. It is what the import system used; `__file__` is a convenience copy

**Symptom:** `find_spec("mypkg.sub")` ran your package's `__init__.py` and produced side effects
**Cause:** documented — *"If **name** is for a submodule (contains a dot), the parent module is automatically imported"*
**Fix:** there is no side-effect-free variant for submodules. If import-time side effects are the problem, remove them from `__init__.py`; that is chunk [4](04-packages-and-init.md)'s subject

**Symptom:** `find_spec` raises `ValueError` instead of returning `None`
**Cause:** the module is already in `sys.modules` but its `__spec__` is `None` or unset — typically `__main__`, or a module built by hand with `types.ModuleType`
**Fix:** guard for it. `__main__.__spec__` is documented to be `None` whenever the program was started from a file, `-c`, stdin or the REPL

**Symptom:** a module created with `types.ModuleType(...)` behaves oddly under relative imports
**Cause:** the data model notes `__package__` *"defaults to `None` for modules created dynamically using the `types.ModuleType` constructor"*
**Fix:** *"use `importlib.util.module_from_spec()` instead to ensure the attribute is set"* — build the module from a spec so the machinery fills in the bookkeeping

## Interview questions

**★ Which module attribute tells you what package a module is in, on 3.14?**
`module.__spec__.parent`. `__package__` still holds the same value today, but the
data model marks it deprecated since 3.13 and states it will cease to be set or
consulted in 3.15. Anything that writes `__package__` — including the old PEP 366
boilerplate for running a submodule as a script — is on a deadline, and the
fallback path already raises `DeprecationWarning` as of 3.12.

**★ How do you check whether an optional dependency is installed without importing
it?**
`importlib.util.find_spec("name") is not None`. It runs the finder search and
returns the spec without executing the module body, so you pay neither the import
cost nor the side effects. The two caveats are that a dotted name imports the
parent package, and that it raises `ValueError` for a cached module whose
`__spec__` is `None`.

**★ How do you tell a package from a plain module, programmatically?**
Check `spec.submodule_search_locations is not None` — the docs say a finder sets
it to a sequence, *even an empty one*, precisely to signal "this is a package",
and to `None` otherwise. The older `hasattr(mod, "__path__")` test is equivalent
in practice but reads the deprecated-preference attribute rather than the spec.

**What is `spec.origin`, and what does `origin is None` mean?**
It is the location the loader will load from — the filename for a `.py` module.
The docs call out namespace packages as the case where there is no single
location, and say origin *"should be set to `None`"* then. So a package whose
`__spec__.origin` is `None` is a namespace package, which is usually the moment
you discover you forgot an `__init__.py`.

**Why can `module.__file__` and `module.__spec__.origin` differ?**
Because there is no synchronization between them; the docs say so explicitly.
Both are set from the spec at creation time, but either can be reassigned
afterwards, and some loaders and instrumentation tools do reassign `__file__`.
When they disagree, `__spec__.origin` is the one that describes what actually
happened.

---

← Prev: [Reload and monkeypatching](01b-reload-and-monkeypatching.md) · Index: [Imports](README.md) · Next → [Cache surgery](01d-cache-surgery.md)
