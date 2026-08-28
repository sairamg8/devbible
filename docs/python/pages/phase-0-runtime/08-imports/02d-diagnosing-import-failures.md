---
title: "Diagnosing an import failure: what the exception type already told you, and the six commands that finish the job"
sidebar_label: "2d · Diagnosing failures"
sidebar_position: 8
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against
> [built-in exceptions](https://docs.python.org/3.14/library/exceptions.html)
> (`ImportError`, `ModuleNotFoundError`),
> [`importlib.util.find_spec`](https://docs.python.org/3.14/library/importlib.html#importlib.util.find_spec),
> [Command line and environment](https://docs.python.org/3.14/using/cmdline.html)
> (`-v`, `-X importtime`, `PYTHONPROFILEIMPORTTIME`, `-I`) and
> [`importlib.metadata`](https://docs.python.org/3.14/library/importlib.metadata.html).
> Target: **CPython 3.14**.

**An import failure has already told you which half of the problem you are in
before you read a single line of the traceback: `ModuleNotFoundError` means the
search failed and nothing ran, and a plain `ImportError` means the module was
found and something went wrong inside it. Everything after that is six commands
run against the failing interpreter, in the failing working directory, in a fixed
order.**

## `ImportError` versus `ModuleNotFoundError`

```
BaseException → Exception → ImportError → ModuleNotFoundError
```

> *"`ImportError` — Raised when the `import` statement has troubles trying to load
> a module. Also raised when the "from list" in `from ... import` has a name that
> cannot be found."*

> *"`ModuleNotFoundError` — A subclass of `ImportError` which is raised by `import`
> when a module could not be located. It is also raised when `None` is found in
> `sys.modules`."*

The distinction is diagnostic, and it is sharp:

- **`ModuleNotFoundError`** — the search failed. Nothing was executed. This is a
  `sys.path` problem, a spelling problem, or a not-installed problem.
- **`ImportError` that is *not* a `ModuleNotFoundError`** — the module was found.
  Either its body raised, or the name in the `from` list does not exist on it.
  This is a code problem, most often a circular import
  ([chunk 6](06-circular-imports.md)) or a version mismatch where the symbol was
  renamed.

Both carry structured attributes since 3.3: *"The name of the module that was
attempted to be imported"* and *"The path to any file which triggered the
exception"*, so a handler can report usefully:

```python
try:
    import fancy_optional_dep
except ModuleNotFoundError as exc:
    if exc.name != "fancy_optional_dep":
        raise                    # a DIFFERENT module is missing — a real bug
    fancy_optional_dep = None
```

That `exc.name` check is the part people leave out, and it is the part that
matters: without it, a missing transitive dependency of the optional package is
silently swallowed and reported as "the optional feature is not installed".

## A diagnosis order that works

1. `python -c "import sys; print(sys.path)"` — with the *same* interpreter and
   the *same* working directory as the failing process.
2. `python -c "import mymod; print(mymod.__file__)"` — which copy actually
   loaded.
3. `python -c "import importlib.util as u; print(u.find_spec('mymod'))"` — where
   it *would* load from, without executing it.
4. `python -I -c "..."` — does the failure survive isolation? If not, it is the
   environment.
5. `env | grep PYTHON` — `PYTHONPATH` and `PYTHONHOME` first.
6. `python -X importtime -c "import myapp"` — *"to show how long each import
   takes. It shows module name, cumulative time (including nested imports) and
   self time (excluding nested imports)"*. On 3.14, `-X importtime=2` adds a line
   for modules that were already loaded, which doubles as an import-order trace.
7. `python -v` — full verbose import tracing, when everything else has failed.

## Which distribution put this module here?

`__file__` tells you the path; it does not tell you which installed distribution
owns it, and package names and module names routinely differ (`PyYAML` provides
`yaml`, `beautifulsoup4` provides `bs4`, `Pillow` provides `PIL`).
`importlib.metadata` closes that gap:

```python
from importlib.metadata import packages_distributions, version

packages_distributions()["yaml"]     # ['PyYAML']
version("PyYAML")
```

This is the tool for "two distributions both ship a module called `tests`" and
for "which of these three similarly-named packages is actually installed".

## Reading `-v` output without drowning in it

`python -v` traces every import attempt the interpreter makes, including the
hundred or so that happen before your first line. It is a last resort precisely
because of that volume, but it answers one question nothing else does: *which
directories were searched, in which order, before the failure*. Reach for it when
`find_spec` returns `None` and you cannot see why — the trace shows each
candidate path that was tried and rejected.

## The two questions the exception attributes answer

`ImportError` has carried structured data since 3.3 — *"The name of the module
that was attempted to be imported"* and *"The path to any file which triggered
the exception"*. In library code that means an optional-dependency guard can be
written precisely instead of broadly, and a diagnostic can report the offending
file rather than asking the user to reproduce:

```python
try:
    from mylib.accel import fast_path
except ImportError as exc:
    log.warning("accelerator unavailable: %s (module=%s, path=%s)",
                exc, exc.name, exc.path)
    fast_path = None
```

Note this catches plain `ImportError` deliberately: `mylib.accel` exists and is
expected to fail on platforms without the compiled extension, and the `name`
attribute records which import inside it gave up.

## Gotchas

**Symptom:** an optional-dependency guard swallows a real bug
**Cause:** `except ModuleNotFoundError:` catches *any* missing module, including a broken transitive dependency of the optional package
**Fix:** check `exc.name` against the module you were importing and re-raise otherwise

**Symptom:** `except ImportError` catches a failure you wanted to see
**Cause:** `ModuleNotFoundError` is a subclass, but the reverse trap is the real one: a module whose *body* raised `ImportError` looks identical to a missing module unless you distinguish the classes
**Fix:** catch `ModuleNotFoundError` for "is it installed?", and let plain `ImportError` propagate — it means the module exists and is broken

**Symptom:** `pip list` shows the package but `import` fails
**Cause:** `pip` and `python` are different interpreters, or the distribution name and the module name differ
**Fix:** run `python -m pip list` so the interpreter is the same one, and use `importlib.metadata.packages_distributions()` to map module names to distributions

**Symptom:** `find_spec` returns `None` and `sys.path` looks correct
**Cause:** the directory is on the path but does not contain what you think — a typo, a missing `__init__.py` turning a package into something else, or a file created after the finder cached the directory
**Fix:** `python -v` to see which candidates were tried, and `importlib.invalidate_caches()` if the file is newer than the process

**Symptom:** the same command fails under `cron`/systemd and works in your shell
**Cause:** a different working directory, a different `PATH` selecting a different interpreter, and no shell profile so no `PYTHONPATH`
**Fix:** run the diagnosis commands *through the same launcher*. `ExecStart=/usr/bin/env python -c "import sys; print(sys.executable, sys.path)"` answers all three at once

**Symptom:** `python -X importtime` output is unreadable in a threaded program
**Cause:** documented — *"its output may be broken in multi-threaded application"*
**Fix:** measure a minimal `python -X importtime -c "import myapp"` before the application starts threads

**Symptom:** you cannot tell whether a module was imported or served from the cache
**Cause:** plain `-X importtime` only reports modules it actually loaded
**Fix:** `-X importtime=2` on 3.14, which *"enables additional output that indicates when an imported module has already been loaded"* — the string `cached` appears in both time columns

## Interview questions

**★ What is the difference between `ImportError` and `ModuleNotFoundError`, and
why does it matter operationally?**
`ModuleNotFoundError` is a subclass of `ImportError`, raised when the search
failed to locate a module at all (or when `None` was found in `sys.modules`). A
plain `ImportError` means the module *was* found — its body raised, or the name in
a `from` list is not there. So the first is a path/installation problem where
nothing ran, and the second is a code problem where something did. Catching the
broad `ImportError` for an optional-dependency guard hides real failures; catch
`ModuleNotFoundError` and check `exc.name`.

**★ A module is importing the wrong file. What do you run?**
`print(mymod.__file__)` to see which copy loaded, `importlib.util.find_spec` to
see where it *would* load from without executing it, `print(sys.path)` in the
failing process to see the order, and `env | grep PYTHON` for `PYTHONPATH` and
`PYTHONHOME`. Then `python -I` to confirm whether the environment is responsible.
Four commands, in that order, resolve nearly every case.

**How would you find out why startup is slow?**
`python -X importtime`, which reports each module's cumulative and self import
time. On 3.14, `-X importtime=2` also emits a line for modules that were already
loaded, so it doubles as an import-order trace, and `PYTHONPROFILEIMPORTTIME`
is the environment equivalent. The usual finding is a top-level import of
something large in a module that is itself imported unconditionally — which is
the subject of [11 · Startup and import cost](../11-startup-and-import-cost/README.md).

**★ Where do you start when an import fails in production but not locally?**
With the exception type. `ModuleNotFoundError` means nothing ran, so it is a
`sys.path`, interpreter or installation difference — check `sys.executable`,
`sys.path` and the environment, in that order, *from inside the failing process*.
A plain `ImportError` means the module was found and its body or its `from` list
failed, so it is a code or version problem — check whether the symbol still
exists in the installed version, and whether a circular import is involved.

**Why is `python -m pip` preferred over `pip`?**
Because `pip` is a script whose shebang pins one interpreter, and the `python` on
your `PATH` may be a different one. `python -m pip` guarantees the installer and
the importer are the same interpreter, which eliminates the most common cause of
"it says it is installed and it is not importable".

**How do you find out which installed distribution provides a module?**
`importlib.metadata.packages_distributions()` maps top-level module names to the
distributions that provide them. It matters because the names differ so often —
`yaml` from `PyYAML`, `bs4` from `beautifulsoup4`, `PIL` from `Pillow` — and
because when two distributions ship the same top-level name, this is what shows
you both.

**How do you find out why startup is slow?**
`python -X importtime`, which reports each module's name, cumulative time
including nested imports, and self time excluding them. On 3.14,
`-X importtime=2` additionally emits a line for modules that were already loaded,
which turns it into an import-order trace; `PYTHONPROFILEIMPORTTIME` is the
environment equivalent. The usual finding is an unconditional top-level import of
something large — see [11 · Startup and import cost](../11-startup-and-import-cost/README.md).

---

← Prev: [Controlling `sys.path`](02c-controlling-sys-path.md) · Index: [Imports](README.md) · Next → [Shadowing the standard library](03-shadowing-the-stdlib.md)
