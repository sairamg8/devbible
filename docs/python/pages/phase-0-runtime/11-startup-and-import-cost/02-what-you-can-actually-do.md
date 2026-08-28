---
title: "What you can actually do about it today: move the import into the function, keep `typing` out of the runtime, and stop trusting `LazyLoader`"
sidebar_label: "2 · What you can do today"
sidebar_position: 2
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08-28 against
> [`importlib.util.LazyLoader`](https://docs.python.org/3.14/library/importlib.html#importlib.util.LazyLoader)
> (including its documented restrictions and the "heavily discouraged" warning),
> [`typing.TYPE_CHECKING`](https://docs.python.org/3.14/library/typing.html#typing.TYPE_CHECKING),
> the [`site` module](https://docs.python.org/3.14/library/site.html) on `.pth`
> files, and the
> [command line documentation](https://docs.python.org/3.14/using/cmdline.html)
> for `-S`, `-E`, `-I` and `-P`.
> Target: **CPython 3.14.7**. The 3.15 `lazy` keyword is chunk
> [3](03-lazy-imports.md); this chunk is what works now.

**Chunk [1](01-where-the-time-goes.md) found the cost. This chunk removes it.
There is one technique that does almost all the work — move the import to where
it is used — and a short list of others that are situational, plus one that the
standard library itself tells you not to reach for.**

## The function-level import

The whole technique:

```python
# module level: paid by every invocation, including --help and --version
import pandas as pd

def export_report(rows):
    return pd.DataFrame(rows).to_csv()
```

```python
# deferred: paid only when someone actually exports a report
def export_report(rows):
    import pandas as pd
    return pd.DataFrame(rows).to_csv()
```

The second import is nearly free: after the first call the module is in
`sys.modules`, and the statement becomes a dictionary lookup. You pay the full
cost once, at first use, instead of once per process at startup.

**This deliberately contradicts PEP 8**, which puts imports at the top of the
file, and that is fine — PEP 8 is a style guide with stated exceptions, and
deferring a genuinely expensive import for a documented startup reason is one.
What matters is that it is *deliberate and commented*, not scattered:

```python
def export_report(rows):
    import pandas as pd          # deferred: ~half of CLI startup, used by one subcommand
    return pd.DataFrame(rows).to_csv()
```

⚠️ **Do not do this reflexively.** Applied to cheap imports it buys nothing and
costs readability, and it moves `ImportError` from startup to runtime — a
missing dependency now surfaces when a user runs the one subcommand that needs
it, possibly in production, rather than immediately. Defer the expensive
imports you have *measured*, and leave the rest at the top.

## Keep typing out of the runtime

Annotations that exist only for a type checker do not need the module at run
time:

```python
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    import pandas as pd           # never imported at run time
    from myapp.models import User

def summarise(df: "pd.DataFrame", user: "User") -> str:
    ...
```

`TYPE_CHECKING` is `False` at run time and `True` for type checkers, so the
block is dead code to the interpreter and live code to mypy or pyright. The
annotations must then be strings (or the module must use deferred annotation
evaluation) because the names do not exist at run time.

This is the cheapest structural win available in a typed codebase, because the
type-only imports tend to be numerous and to pull in exactly the heavy modules
you were trying to avoid. Typing in full is Phase 6.

## Restructure the entry point

For a CLI, the shape matters more than any individual import:

```python
# cli.py — top level stays deliberately thin
import argparse

def main() -> int:
    parser = argparse.ArgumentParser()
    sub = parser.add_subparsers(dest="cmd", required=True)
    sub.add_parser("export")
    sub.add_parser("serve")
    args = parser.parse_args()

    if args.cmd == "export":
        from myapp.commands.export import run   # only this path's deps load
        return run(args)
    if args.cmd == "serve":
        from myapp.commands.serve import run
        return run(args)
```

`--help`, `--version` and an argument error now cost only `argparse`. Every
subcommand's dependencies load only when that subcommand is chosen. Note that
this also means each command module is free to import whatever it wants at *its*
top level, which keeps the readability cost contained to one place.

Two further structural moves worth knowing:

- **Do work in `main()`, not at module scope.** Module-level constants that
  compile regexes, build lookup tables or read files run at import. Move them
  into a function, or make them lazy with `functools.cache`.
- **Defer plugin discovery.** Scanning entry points at startup to find plugins
  costs real time in `importlib.metadata`; do it when a plugin is first needed.

## `importlib.util.LazyLoader`, and why to be careful

The standard library has a lazy-import mechanism, and its own documentation is
notably discouraging about it. What it does:

> *"A class which postpones the execution of the loader of a module until the
> module has an attribute accessed."*

The documented usage is not a one-liner — you build the module from its spec
yourself:

```python
>>> import importlib.util
>>> import sys
>>> def lazy_import(name):
...     spec = importlib.util.find_spec(name)
...     loader = importlib.util.LazyLoader(spec.loader)
...     spec.loader = loader
...     module = importlib.util.module_from_spec(spec)
...     sys.modules[name] = module
...     loader.exec_module(module)
...     return module
...
>>> lazy_typing = lazy_import("typing")
>>> #lazy_typing is a real module object,
>>> #but it is not loaded in memory yet.
>>> lazy_typing.TYPE_CHECKING
False
```

🔴 **The warning is the important part, and it is the library's own wording:**

> *"For projects where startup time is not essential then use of this class is
> **heavily** discouraged due to error messages created during loading being
> postponed and thus occurring out of context."*

An `ImportError`, a syntax error, a failing module-level initialisation — all of
them now surface at the first attribute access, arbitrarily far from the import,
with a traceback that points at the wrong place. That is a bad trade unless
startup time is genuinely essential.

It also has real restrictions: it works **only** with loaders defining
`exec_module()`; the loader's `create_module()` must return `None` or a type
whose `__class__` can be mutated; the module type must not use `__slots__`; and
modules that substitute the object placed into `sys.modules` do not work at all
and raise `ValueError`.

**In practice, prefer the function-level import.** It achieves the same deferral
with none of the machinery, and errors still surface with a sensible traceback
at the point of the deferred import. `LazyLoader` earns its place mainly in
libraries that want to expose a heavy submodule as an attribute without paying
for it — and chunk [3](03-lazy-imports.md) is the language-level replacement.

## Interpreter flags, and their narrow usefulness

| Flag | Effect | When it helps |
|---|---|---|
| `-S` | Disables importing `site` and its `sys.path` manipulations | Diagnosing `.pth` cost; almost never right for an application, since site-packages goes with it |
| `-E` | Ignores all `PYTHON*` environment variables | Reproducible measurement, and isolation |
| `-I` | Isolated mode; implies `-E`, `-P` and `-s`; `sys.path` gets neither the script's directory nor user site-packages | The strongest isolation, useful for a stable baseline |
| `-P` | Keeps the script directory / cwd off `sys.path` | Security and shadowing, more than speed |

`-S` is the diagnostic one. If `python -S -c pass` is much faster than
`python -c pass`, the cost is in `site` processing — which usually means `.pth`
files.

⚠️ **`.pth` files can execute code.** A `.pth` file in site-packages whose line
begins with `import` is executed by `site` at every interpreter start, before
your program runs at all. Some packages install these. They are the reason a
machine with a large, old environment can start slowly with no program at all,
and the reason a fresh virtual environment sometimes "fixes" startup — the venv
simply has fewer of them.

## Gotchas

**Symptom:** deferred the import, startup unchanged
**Cause:** something else still imports the module at startup — a sibling module,
a package `__init__.py`, or a plugin scan
**Fix:** `-X importtime=2` shows every import site, marking already-loaded ones
`cached`. A package's `__init__.py` re-exporting its submodules is the classic
culprit: importing anything from the package pulls in everything it re-exports

**Symptom:** moving imports into functions made a hot loop slower
**Cause:** the import statement still runs on every call. It is a `sys.modules`
lookup rather than a load, which is cheap but not free
**Fix:** bind it once outside the loop, or accept it — but do not defer imports
inside functions called thousands of times per second without measuring

**Symptom:** a missing dependency now crashes in production instead of at startup
**Cause:** exactly what deferral does — `ImportError` moved from import time to
first use
**Fix:** this is the real cost of the technique. Keep a startup-time check, or
cover every subcommand in tests, so a missing dependency is caught before a user
finds it

**Symptom:** `if TYPE_CHECKING:` import, then `NameError` at run time
**Cause:** the name genuinely does not exist at run time. Anything that
*evaluates* the annotation — a runtime-introspecting library, `pydantic`,
`typing.get_type_hints()` — will fail
**Fix:** quote the annotations, and do not use `TYPE_CHECKING` for types that a
runtime library must resolve. Those imports have to be real

**Symptom:** `LazyLoader` raises `ValueError` on a particular module
**Cause:** documented — modules that substitute the object placed into
`sys.modules` do not work with it, and the module type must not use `__slots__`
**Fix:** do not use `LazyLoader` for that module. A function-level import has
none of these constraints

**Symptom:** an error traceback from a lazily loaded module points somewhere
that makes no sense
**Cause:** the documented consequence — loading was postponed, so the error
occurs out of context
**Fix:** this is the reason the standard library discourages `LazyLoader` unless
startup time is essential. Weigh it before adopting it

**Symptom:** `python -c pass` alone is slow on one machine
**Cause:** `site` processing, most often `.pth` files in a large site-packages
executing at every start
**Fix:** compare against `python -S -c pass` to confirm, then look at what is
installing `.pth` files. A clean virtual environment is often the practical fix

**Symptom:** startup improved locally but not in the deployed image
**Cause:** the deployed environment has different installed packages, hence
different `.pth` files and a different `sys.path`, and possibly a cold
`__pycache__` on a read-only filesystem
**Fix:** measure in the deployed image, per chunk [1](01-where-the-time-goes.md)

## Interview questions

**What is the single most effective way to cut a Python CLI's startup time?**
Move expensive imports out of module scope into the function that uses them, and
structure the entry point so that argument parsing happens before any
subcommand's dependencies are imported. `--help` should cost `argparse` and
nothing else.

**Doesn't that violate PEP 8?**
Yes, and PEP 8 is a style guide with exceptions rather than a rule. Deferring a
measured, expensive import for a documented startup reason is a legitimate one.
It should be deliberate and commented, not applied to every import — deferring
cheap imports costs readability and buys nothing.

**What does deferring an import cost you?**
Error timing. A missing or broken dependency raises at first use rather than at
startup, which can mean a user in production discovers it instead of your test
suite. The mitigation is to cover each deferred path in tests, or keep an
explicit startup check.

**How do you avoid importing a module you only need for type annotations?**
Put the import inside `if TYPE_CHECKING:` and quote the annotation. The block is
`False` at run time and `True` for the type checker. The caveat is that anything
which evaluates annotations at run time — `get_type_hints`, pydantic, a
runtime-validating framework — then fails, so those imports must stay real.

**When would you use `importlib.util.LazyLoader`?**
Rarely, and only where startup time is essential — its own documentation
*heavily* discourages it otherwise, because errors during loading are postponed
and surface out of context. It also requires a loader with `exec_module()`, a
module type without `__slots__`, and fails on modules that replace their entry
in `sys.modules`. A function-level import is usually the better tool.

**Why might a bare `python -c pass` be slow?**
`site` processing at interpreter start, usually `.pth` files in a large
site-packages — a `.pth` line beginning with `import` is executed on every
start. Compare with `python -S -c pass`, which skips `site` entirely, to confirm
that is where the time is going.

**What does `-I` do and why would you use it when measuring?**
Isolated mode: it implies `-E`, `-P` and `-s`, so `PYTHON*` environment
variables are ignored and `sys.path` contains neither the script's directory nor
user site-packages. It gives a reproducible baseline that a developer's
environment cannot skew.

---

← Prev: [Where the time goes](01-where-the-time-goes.md) · Index: [Startup and import cost](README.md) · Next → [Lazy imports: the coming answer](03-lazy-imports.md)
