---
title: "importlib.metadata.entry_points() reads entry_points.txt from every distribution on sys.path each time it is called and hands back EntryPoint objects that import nothing until load() — so selection is cheap string matching, the first distribution of a name wins, and the import cost lands exactly where you call load()"
sidebar_label: "05 · Reading entry points at runtime"
sidebar_position: 6
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-10 against the Python 3.14 [`importlib.metadata`](https://docs.python.org/3.14/library/importlib.metadata.html) documentation and its CPython **v3.14.7** source [`Lib/importlib/metadata/__init__.py`](https://github.com/python/cpython/blob/v3.14.7/Lib/importlib/metadata/__init__.py) (line numbers at that tag), the PyPA *Entry points specification* ([packaging.python.org](https://packaging.python.org/en/latest/specifications/entry-points/)) and *Creating and discovering plugins* ([packaging.python.org](https://packaging.python.org/en/latest/guides/creating-and-discovering-plugins/)).
> Target: **Python 3.14.7** · uv 0.12.12 · ruff 0.16.6 · pre-commit 4.6.2. Documentation- and source-validated — **no sandbox run, no program output; the `>>>` lines quoted below are the documentation's own examples**.

**Only `console_scripts` and `gui_scripts` are acted on at install time. Every other group — and those two as well — is plain data in each distribution's `entry_points.txt`, and `importlib.metadata` is the standard-library reader for it. `entry_points(group=...)` walks every distribution visible on `sys.path`, parses their files, and returns `EntryPoint` objects that are nothing but name, group and value strings with a link to their distribution. Nothing is imported until you call `load()`, which runs `import_module` and a chain of `getattr`. Everything a plugin host gets right or wrong follows from those three facts: selection is cheap and exact, duplicates are resolved by `sys.path` order, and the cost and the failures of a plugin arrive at the `load()` call — wherever you chose to put it.**

## The API in 3.14

> *"Returns a `EntryPoints` instance describing entry points for the current environment. Any given keyword parameters are passed to the `select()` method for comparison to the attributes of the individual entry point definitions."*

> *"Details of a collection of installed entry points. Also provides a `.groups` attribute that reports all identified entry point groups, and a `.names` attribute that reports all identified entry point names."*

> *"Each `EntryPoint` instance has `.name`, `.group`, and `.value` attributes and a `.load()` method to resolve the value. There are also `.module`, `.attr`, and `.extras` attributes for getting the components of the `.value` attribute, and `.dist` for obtaining information regarding the distribution package that provides the entry point."*
> — all three [`importlib.metadata`](https://docs.python.org/3.14/library/importlib.metadata.html)

The documentation's own examples, against the `wheel` package:

```python
>>> scripts = entry_points(group='console_scripts')
>>> 'wheel' in scripts.names
True
>>> wheel = scripts['wheel']
>>> (wheel,) = entry_points(group='console_scripts', name='wheel')
>>> wheel.module
'wheel.cli'
>>> wheel.attr
'main'
```

In a host application:

```python
# src/invoice_service/exporters/registry.py
from importlib.metadata import EntryPoint, entry_points

GROUP = "invoice_service.exporters"


def available() -> list[str]:
    return sorted(entry_points(group=GROUP).names)


def find(name: str) -> EntryPoint:
    try:
        return entry_points(group=GROUP)[name]
    except KeyError:
        raise LookupError(
            f"no exporter {name!r}; installed: {', '.join(available()) or 'none'}"
        ) from None


def load(name: str) -> type:
    return find(name).load()
```

`available()` imports nothing. `load("xlsx")` imports exactly one plugin.

### How the API got here

The version history is in the documentation, and it matters when reading older code:

- 3.8 — `importlib.metadata` added.
- 3.10 — *"`importlib.metadata` is no longer provisional"*, and the "selectable" API (`group=`, `select`) arrives.
- 3.12 — *"Prior to those changes, `entry_points` accepted no parameters and always returned a dictionary of entry points, keyed by group. With `importlib_metadata` 5.0 and Python 3.12, `entry_points` always returns an `EntryPoints` object."*
- 3.13 — *"`EntryPoint` objects no longer present a tuple-like interface (`__getitem__()`)."*

The module introduction also names what it replaced: it *"provides the entry point and metadata APIs that were previously exposed by the now-removed `pkg_resources` package."* A project with `requires-python = ">=3.10"` needs neither the dictionary interface nor the `importlib_metadata` backport; the plugin guide's `sys.version_info < (3, 10)` import switch exists only for older floors.

## What `load()` actually does

`EntryPoint.load`, lines 173–181 at v3.14.7:

```python
def load(self) -> Any:
    """Load the entry point from its definition. If only a module
    is indicated by the value, return that module. Otherwise,
    return the named object.
    """
    match = cast(Match, self.pattern.match(self.value))
    module = import_module(match.group('module'))
    attrs = filter(None, (match.group('attr') or '').split('.'))
    return functools.reduce(getattr, attrs, module)
```

That is the specification's lookup recipe in three lines — `import_module` on the part before the colon, then `getattr` for each dotted part after it. Two consequences:

- **A module-only value returns the module.** pytest's `pytest11` plugins are written that way (the specification's own example is `nbval = nbval.plugin`, with the comment *"pytest plugins refer to a module, so there is no ':obj'"*). A host that expects a class must check what it got.
- **Every exception an import can raise, `load()` can raise** — `ModuleNotFoundError` for a plugin whose dependency is missing, `AttributeError` for a renamed class, and anything the plugin's module-level code throws. The host decides whether one bad plugin is fatal.

Selection is equally literal. `EntryPoint.matches` (lines 205–223) compares keyword arguments against attributes with `==`:

```python
attrs = (getattr(self, param) for param in params)
return all(map(operator.eq, params.values(), attrs))
```

So `select` accepts any attribute, not only `group` and `name` — `module=` and `attr=` work — and every comparison is exact and case-sensitive, as the specification requires names to be. `EntryPoints.__getitem__(name)` returns the *first* match and raises `KeyError` when there is none (lines 257–264).

## Where it looks, and who wins a tie

> *"By default, distribution metadata can live on the file system or in zip archives on `sys.path`."*
> — [`importlib.metadata`](https://docs.python.org/3.14/library/importlib.metadata.html)

The module-level function, lines 999–1011, with its docstring omitted:

```python
def entry_points(**params) -> EntryPoints:
    eps = itertools.chain.from_iterable(
        dist.entry_points for dist in _unique(distributions())
    )
    return EntryPoints(eps).select(**params)
```

with `_unique` defined just above as `unique_everseen` keyed on each distribution's normalized name — *"Wrapper for ``distributions`` to return unique distributions by name."* Three facts follow from the source:

1. **The environment is `sys.path`.** Whatever the running interpreter can import from is where metadata is read — the same reason a tool installed with `uv tool install` cannot see your project's plugins, and your project cannot see the tool's.
2. **First distribution of a name wins.** If two `.dist-info` directories for `invoice-plugin-xlsx` are visible — a stale copy in an earlier `sys.path` entry, a user site-packages ahead of the venv — the entry points of the first one found are used and the other is ignored silently.
3. **Every call re-reads.** There is no result cache in `entry_points()`; each call parses `entry_points.txt` for every distribution. The directory listings underneath are cached per path and invalidated by the directory's modification time (`FastPath`, lines 716–770), so a package installed while the process runs is seen by the next call. What that costs in time was not measured for this page.

For one distribution's entries, ask the distribution directly — `Distribution.entry_points` reads that distribution's `entry_points.txt` alone:

```python
from importlib.metadata import distribution

own = distribution("invoice-service").entry_points.select(group="console_scripts")
```

The documentation notes a limit here: *"it is not currently possible to query for entry points based on their `EntryPoint.dist` attribute (as different `Distribution` instances do not currently compare equal, even if they have the same attributes)"*. Filter on the distribution's *name* instead:

```python
from importlib.metadata import entry_points

third_party = [
    ep for ep in entry_points(group="invoice_service.exporters")
    if ep.dist is not None and ep.dist.name != "invoice-service"
]
```

## `--version` from the same metadata

A CLI's version belongs to the distribution, and the same module reads it:

```python
from importlib.metadata import PackageNotFoundError, version


def package_version() -> str:
    try:
        return version("invoice-service")          # the distribution name, not the import name
    except PackageNotFoundError:
        return "0+unknown"                          # running from an uninstalled checkout
```

> *"Raises `PackageNotFoundError` if the named distribution package is not installed in the current Python environment."*

The name is the *distribution* name from `[project] name`, which the documentation warns is *"not necessarily equivalent to or correspond 1:1 with the top-level import package names"*. `packages_distributions()` maps import names to distributions, with the caveat that *"Some editable installs, do not supply top-level names, and thus this function is not reliable with such installs."*

## Gotchas

**★ Symptom: the host finds no plugins, although `pip list` shows the plugin installed.** Cause: the plugin is in a different environment from the process asking — `entry_points()` reads only what is on the running interpreter's `sys.path`. Fix: check from inside the same interpreter.

```bash
.venv/bin/python -c "from importlib.metadata import entry_points; print(sorted(entry_points().groups))"
```

**★ Symptom: `entry_points().get("invoice_service.exporters")` raises `AttributeError`, or `entry_points()["invoice_service.exporters"]` raises `KeyError`.** Cause: code written for the pre-3.12 dictionary interface, removed in 3.12; today `[...]` looks up an entry-point *name*, not a group. Fix: select by keyword.

```python
eps = entry_points(group="invoice_service.exporters")
```

**★ Symptom: `ModuleNotFoundError: No module named 'pkg_resources'` in an old plugin host.** Cause: the host uses `pkg_resources.iter_entry_points`, from the package the documentation calls *"now-removed"*. Fix: the standard library replacement.

```python
from importlib.metadata import entry_points

for ep in entry_points(group="invoice_service.exporters"):
    register(ep.name, ep.load)
```

**★ Symptom: importing the host package takes seconds, and got slower with every plugin installed.** Cause: the host calls `load()` on every entry point at import time, so every plugin's module — and its dependencies — is imported on start-up. Fix: select eagerly, load on demand (`load(name)` above).

```python
def load(name: str) -> type:
    return entry_points(group=GROUP)[name].load()
```

**★ Symptom: one broken plugin — a missing dependency, a renamed class — makes the whole host crash on start-up.** Cause: `load()` raises whatever the import or attribute lookup raises. Fix: contain failures per plugin and report which distribution caused them.

```python
import logging

log = logging.getLogger(__name__)


def load_all() -> dict[str, type]:
    loaded = {}
    for ep in entry_points(group=GROUP):
        try:
            loaded[ep.name] = ep.load()
        except Exception:
            owner = ep.dist.name if ep.dist else "unknown distribution"
            log.exception("exporter %r from %s failed to load", ep.name, owner)
    return loaded
```

**Symptom: a plugin's entry point returns a module where the host expected a class, and fails with a confusing `TypeError` later.** Cause: the value had no `:attr` part, and `load()` then *"return[s] that module"*. Fix: validate what `load()` returned, and name the entry point in the error.

```python
obj = ep.load()
if not isinstance(obj, type):
    raise TypeError(f"entry point {ep.name!r} ({ep.value}) must name a class")
```

**Symptom: an old version of a plugin keeps being used after upgrading it.** Cause: two `.dist-info` directories for the same distribution are visible, and `entry_points()` keeps only the first by `sys.path` order. Fix: find every copy and remove the one you did not mean.

```python
from importlib.metadata import distributions

for dist in distributions():
    if dist.name == "invoice-plugin-xlsx":
        print(dist.version, dist.locate_file(""))   # the directory holding this copy
```

**Symptom: `select(name="XLSX")` finds nothing, although the plugin registered `xlsx`.** Cause: entry-point names are case-sensitive and `matches` compares with `==`. Fix: normalise on the host side if you want case-insensitive lookup.

```python
wanted = name.lower()
matches = [ep for ep in entry_points(group=GROUP) if ep.name.lower() == wanted]
```

**Symptom: `--version` crashes with `PackageNotFoundError` in development.** Cause: the code is running from a checkout that was never installed, or the distribution name passed is the import name. Fix: pass the `[project] name`, and fall back when it is absent, as `package_version()` above does.

## Interview questions

**★ What does `importlib.metadata.entry_points(group=...)` actually do?**
It iterates every distribution the running interpreter can find on `sys.path`, keeps the first distribution of each normalized name, reads each one's `entry_points.txt`, and returns an `EntryPoints` collection filtered by `select(group=...)`. The `EntryPoint` objects are strings — name, group, value — plus a reference to their distribution. Nothing is imported. The import happens only when you call `load()`, which runs `import_module` on the module part and `getattr` for each attribute part.

**★ Why should a plugin host iterate entry points eagerly but load them lazily?**
Because iterating is string work on metadata files and loading is importing code. A host that calls `load()` on every entry point at start-up pays the import time of every installed plugin, and every plugin's dependencies, on every run — including runs that use none of them — and inherits every plugin's import-time failure. Iterating gives the host the names for help text and validation; loading only the plugin the user asked for keeps start-up flat as the ecosystem grows.

**★ How did the `entry_points()` API change between 3.9 and 3.13, and why does it matter?**
Before 3.10 it took no arguments and returned a dictionary keyed by group. 3.10 added keyword selection and `EntryPoints.select`; 3.12 removed the dictionary interface so the function always returns `EntryPoints`; 3.13 removed the tuple-like indexing of `EntryPoint`. Code written against the old shapes — `entry_points().get(group)`, `entry_points()[group]`, unpacking an `EntryPoint` — fails on current Pythons, and a `requires-python` of 3.10 or later means the backport is unnecessary.

**What happens if two installed distributions register the same entry-point name in the same group?**
`importlib.metadata` returns both; it only deduplicates *distributions* by name, not entry points. What happens next is the consumer's decision — the specification says *"If different distributions provide the same name, the consumer decides how to handle such conflicts"*. `EntryPoints[name]` returns the first match, so a host that indexes by name silently picks one; a careful host detects the duplicate and reports both distributions.

**Why can't you select entry points by distribution with `entry_points(dist=...)`?**
Because `select` compares attributes with `==`, and the documentation notes that *"different `Distribution` instances do not currently compare equal, even if they have the same attributes"*. Two lookups of the same installed package produce unequal objects, so an equality match never succeeds. Either ask the distribution for its own entries with `distribution(name).entry_points`, or filter on `ep.dist.name` in a comprehension.

**Why does `version("invoice_service")` fail while `import invoice_service` works?**
Because `version()` takes a *distribution* name — the `[project] name`, here `invoice-service` — and import names are a different namespace; the documentation warns the two need not correspond one to one. Metadata exists only for installed distributions, so a checkout run without installation has no version to report at all, which is why a `--version` implementation needs a `PackageNotFoundError` fallback.

---

← Prev: [04 · `python -m` and `__main__.py`](04-python-m-and-dunder-main.md) · [Topic index](README.md) · Next → [06 · Plugin discovery patterns](06-plugin-discovery-patterns.md)
