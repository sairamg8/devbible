---
title: "PEP 420 namespace packages: the missing __init__.py that works in the repo and breaks once installed"
sidebar_label: "4c · Namespace packages"
sidebar_position: 13
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against
> [PEP 420](https://peps.python.org/pep-0420/) (implicit namespace packages), the
> Python 3.14 [import system reference](https://docs.python.org/3.14/reference/import.html)
> (namespace packages, `__path__` attributes on modules),
> [`importlib.machinery.ModuleSpec`](https://docs.python.org/3.14/library/importlib.html#importlib.machinery.ModuleSpec)
> and [`importlib.invalidate_caches`](https://docs.python.org/3.14/library/importlib.html#importlib.invalidate_caches).
> Target: **CPython 3.14**.

**Since Python 3.3, a directory with no `__init__.py` is still importable — it
becomes a namespace package, assembled from every directory of that name found
anywhere on the search path. That is a deliberate feature for splitting one
package across several distributions, and it is also why forgetting an
`__init__.py` produces something that imports perfectly in your checkout and
fails, or silently loses modules, once the code is packaged and installed.**

## How one gets created

PEP 420 specifies the scan precisely. For each directory on the parent path,
looking for a name `foo`:

> *"If `<directory>/foo/__init__.py` is found, a regular package is imported and
> returned."*

> *"If not, but `<directory>/foo.{py,pyc,so,pyd}` is found, a module is imported
> and returned."*

> *"If not, but `<directory>/foo` is found and is a directory, it is recorded and
> the scan continues with the next directory in the parent path."*

> *"Otherwise the scan continues with the next directory in the parent path."*

If the scan finishes without finding a module or a regular package, and at least
one directory was recorded, a namespace package is created from the recorded
paths.

Three things fall out of that ordering and they are all load-bearing:

1. **A regular package wins immediately.** The first `__init__.py` found ends the
   scan; later directories of the same name contribute nothing. Mixing a regular
   package and namespace portions of the same name silently drops the portions.
2. **A module wins over a directory.** A `foo.py` earlier on the path beats a
   `foo/` directory later.
3. **A namespace package is only created when *nothing else matched anywhere*.**
   The scan runs to the end of the path before deciding, which is why a namespace
   package's cost is a full path walk rather than a first-hit stop.

The reference adds the nesting rule:

> *"Namespace packages may also be nested inside a regular package. When the
> import system searches a regular package's `__path__` and encounters a
> subdirectory that does not contain an `__init__.py` file, that subdirectory
> becomes a portion contributing to a namespace subpackage of the enclosing
> regular package."*

So a missing `__init__.py` in a *subdirectory* of a proper package produces a
namespace subpackage, not an error. This is the form the accident usually takes.

## What a namespace package is, at runtime

> *"A namespace package is a composite of various portions, where each portion
> contributes a subpackage to the parent package. Portions may reside in
> different locations on the file system… Namespace packages may or may not
> correspond directly to objects on the file system; they may be virtual modules
> that have no concrete representation."*

> *"With namespace packages, there is no `parent/__init__.py` file. In fact, there
> may be multiple `parent` directories found during import search, where each one
> is provided by a different portion. Thus `parent/one` may not be physically
> located next to `parent/two`."*

Its `__path__` is not a list:

> *"Namespace packages do not use an ordinary list for their `__path__`
> attribute. They instead use a custom iterable type which will automatically
> perform a new search for package portions on the next import attempt within
> that package if the path of their parent package (or `sys.path` for a top level
> package) changes."*

PEP 420 states the rule as: *"The import machinery will behave as if a namespace
package's `__path__` is recomputed before each portion is loaded."* The PEP gives
the motivating scenario — a `sys.path` mutated after the namespace was first
imported should still make newly added portions discoverable.

And the spec has no origin, per the `ModuleSpec` documentation:

> *"The location the loader should use to load the module… In the uncommon case
> that there is not one (like for namespace packages), it should be set to
> `None`."*

**That gives you the one-line test.** A package whose `__spec__.origin` is `None`
and whose `__spec__.submodule_search_locations` is a `_NamespacePath` rather than
a list is a namespace package — intended or not.

```python
import mypkg
mypkg.__spec__.origin      # None  => namespace package
                           # a path to __init__.py => regular package
```

There is no `__file__` on a namespace package either — PEP 420 says the new
package *"Does not have a `__file__` attribute"* — which is a second, cruder tell:
code that does `os.path.dirname(mypkg.__file__)` breaks the moment an
`__init__.py` goes missing.

The PEP is also categorical about the other direction: *"Namespace packages
cannot contain an `__init__.py`. As a consequence, `pkgutil.extend_path` and
`pkg_resources.declare_namespace` become obsolete for purposes of namespace
package creation. There will be no marker file or directory for specifying a
namespace package."* If you find either of those two calls in a project, it is
pre-3.3 namespace machinery that should be deleted.

And creation is eager, not lazy: *"Note that if "import foo" is executed and
"foo" is found as a namespace package (using the above rules), then "foo" is
immediately created as a package. The creation of the namespace package is not
deferred until a sub-level import occurs."*

## The accident: it works in the repo and breaks once installed

This is the failure the feature is famous for.

```
myproject/
    mypkg/
        core.py          # note: NO __init__.py
        util.py
    tests/
```

Running from `myproject/`, `sys.path[0]` is `myproject/`, so `mypkg` resolves as
a namespace package with one portion, `import mypkg.core` works, and the test
suite is green. Everything looks correct.

Then the project is packaged. Two things go wrong, and which one you get depends
on the build backend:

- **The package is not included at all.** Most backends' automatic discovery
  looks for directories containing `__init__.py`. With no `__init__.py`, `mypkg`
  is not detected as a package, the wheel ships without it, and the installed
  application fails with `ModuleNotFoundError: No module named 'mypkg'` — while
  the same code runs fine from a checkout, because the checkout has
  `sys.path[0]`.
- **The package is included, and now collides.** If it *is* shipped as a
  namespace portion and any other installed distribution provides a `mypkg`
  directory, the two merge into one namespace package. Imports resolve across
  both, in `sys.path` order, and the result is a package whose contents depend on
  installation order.

The second failure also has a nastier variant that catches people during
migration: **adding an `__init__.py` to one portion of a genuine namespace
package destroys it.** Per the scan order, the first directory with an
`__init__.py` wins outright and the other portions vanish. A `google.cloud`-style
distributed namespace breaks completely if one distribution ships an
`__init__.py`.

## When a namespace package is the right answer

The feature exists for one job: letting several independently-released
distributions contribute subpackages under a shared top-level name — the
`zope.*`, `google.cloud.*`, `backports.*` pattern. If you are shipping one
distribution, you do not want it.

The rule that follows is simple and worth stating as policy: **every directory in
your own project that is meant to be a package gets an `__init__.py`, even an
empty one.** The cost is zero and it removes an entire category of packaging
surprise. Reserve namespace packages for the case where you are deliberately
splitting one import name across multiple distributions, and then make sure no
portion ships an `__init__.py`.

`tests/` deserves a specific mention. Test directories without `__init__.py` are
common and are usually fine — but they make each test module a *top-level* name,
which is why two files called `test_api.py` in different directories collide, and
why a `tests/utils.py` can shadow something. Adding `__init__.py` to test
directories fixes both.

## Costs and second-order effects

- **Import is a full path scan.** A regular package stops at the first
  `__init__.py`; a namespace package cannot stop until the path is exhausted,
  because a later directory might contribute a portion. On a long `sys.path` this
  is measurable at startup.
- **`__path__` is dynamic.** PEP 420 requires the path to be recomputed when the
  parent path changes, which the reference implements by detecting parent path
  changes rather than recomputing on every access. Code that caches
  `list(pkg.__path__)` is caching something the machinery expects to be able to
  change.
- **Data files are harder.** No `__file__`, and `importlib.resources` on a
  namespace package has to deal with multiple portions.
- **Tooling gets confused.** Coverage measurement, `mypy` package discovery and
  auto-discovery in build backends all treat namespace packages as a special
  case, and each one has its own configuration switch for it.

## Gotchas

**Symptom:** `import mypkg` works from the repository root and fails after `pip install .`
**Cause:** `mypkg/` has no `__init__.py`, so the build backend's package auto-discovery did not detect it and the wheel does not contain it
**Fix:** add `__init__.py`. If the namespace behaviour is genuinely wanted, configure the backend's namespace-package discovery explicitly

**Symptom:** a submodule "disappears" after installing a second internal library
**Cause:** two distributions both provide a directory of the same top-level name, and they merged into one namespace package resolved in `sys.path` order
**Fix:** rename one, or make the shared name a real namespace package that both sides ship correctly — with *no* `__init__.py` in either portion

**Symptom:** adding `__init__.py` to "tidy up" a namespace package makes half of it vanish
**Cause:** the PEP 420 scan returns immediately on the first `__init__.py` found; the remaining portions are never recorded
**Fix:** for a genuine namespace package, no portion may have an `__init__.py`. This is all-or-nothing by design

**Symptom:** `mypkg.__file__` raises `AttributeError`
**Cause:** namespace packages have no single origin, so no `__file__`
**Fix:** the presence of `__file__` is a usable "is this a regular package?" test — but the precise one is `__spec__.origin is None`

**Symptom:** `pkg_resources`-style data loading or `os.path.dirname(__file__)` breaks in one deployment and not another
**Cause:** the package became a namespace package in that deployment because the `__init__.py` was excluded from the wheel or dropped by a build step
**Fix:** check `__spec__.origin` at runtime in a startup assertion if this has bitten you before; use `importlib.resources` for the data itself

**Symptom:** a subdirectory of a proper package is importable but behaves oddly
**Cause:** it has no `__init__.py`, so it is a *namespace subpackage* of the enclosing regular package — the reference describes this explicitly
**Fix:** add the `__init__.py`. There is almost never a reason for a namespace subpackage inside a single distribution

**Symptom:** two test files with the same basename in different directories collide
**Cause:** without `__init__.py`, each test module is imported under a top-level name, so both want the same `sys.modules` key
**Fix:** add `__init__.py` to the test directories, which also stops `tests/utils.py` from becoming a top-level `utils`

**Symptom:** startup got slower after removing `__init__.py` files
**Cause:** namespace resolution scans the entire parent path instead of stopping at the first match
**Fix:** put the `__init__.py` files back. The scan cost is proportional to `sys.path` length and is paid on every namespace import

**Symptom:** a directory added to `sys.path` at runtime does not contribute a portion to an already-imported namespace package
**Cause:** the recomputation is triggered by the parent path changing, and the finders may still be holding a cached view
**Fix:** `importlib.invalidate_caches()` — the 3.10 note states namespace packages installed in a different `sys.path` location after the namespace was already imported are now noticed

**Symptom:** an empty leftover directory keeps shadowing a standard library name after you deleted its `__init__.py`
**Cause:** the directory is now an implicit namespace package and still matches the name
**Fix:** remove the directory. Deleting `__init__.py` makes a package *more* permissive, not less — see [chunk 3b](03b-diagnosing-and-preventing-shadowing.md)

## Interview questions

**★ What is a namespace package and how is one created?**
A package assembled from one or more directories — "portions" — that share a name
and contain no `__init__.py`. The import machinery scans every entry on the
parent path; a directory with `__init__.py` returns a regular package
immediately, a matching module file returns a module, and a bare directory is
*recorded* while the scan continues. If the scan ends with nothing else found and
at least one directory recorded, a namespace package is created from all of them.
It exists so several distributions can contribute subpackages under one name.

**★ Why does forgetting `__init__.py` work in development and break after
packaging?**
Because in development your project root is `sys.path[0]`, so the directory is
found and turned into a namespace package with one portion — imports succeed.
Once packaged, most build backends' automatic package discovery keys on
`__init__.py`, so the directory is simply not included in the wheel, and the
installed application cannot import it. The bug is invisible until the artefact
is built, which is why "it works locally" is such a reliable symptom here.

**★ How do you tell a namespace package from a regular one at runtime?**
`pkg.__spec__.origin is None`, because the `ModuleSpec` docs say origin is `None`
in the *"uncommon case that there is not one (like for namespace packages)"*.
Corroborating tells: no `__file__`, and a `__path__` that is a custom iterable
rather than a list — the reference describes that iterable as re-searching for
portions when the parent path changes.

**What happens if one portion of a namespace package adds an `__init__.py`?**
The namespace package stops existing. The scan returns the regular package as
soon as it finds that `__init__.py`, so every other portion is dropped. For a
distributed namespace like `google.cloud.*`, a single distribution shipping an
`__init__.py` breaks every other distribution under that name.

**When should you actually use a namespace package?**
When several separately-released distributions must live under one import name,
and only then — `zope.*`, `backports.*`, a company's internal `acme.*` plugins.
For a single distribution it buys nothing and costs a full `sys.path` scan per
import plus a category of packaging failure. Inside your own project, every
package directory should have an `__init__.py`, even an empty one.

**Is a namespace package slower?**
Yes, on import. A regular package's search stops at the first directory
containing `__init__.py`; a namespace package's search cannot stop, because any
later directory on the path may contribute another portion. So resolution is
O(length of `sys.path`) rather than O(position of the first match), paid on the
first import of the package and again whenever the parent path changes.

---

← Prev: [Exports and `__all__`](04b-exports-and-all.md) · Index: [Imports](README.md) · Next → [Absolute and relative imports](05-relative-imports.md)
