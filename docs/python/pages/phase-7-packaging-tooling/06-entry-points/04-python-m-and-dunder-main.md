---
title: "python -m yourpkg reaches the same function as the console script through a different door — no wrapper, no PATH, no frozen interpreter, but the working directory first on sys.path and your module possibly imported twice — so ship a four-line __main__.py beside every console script and know which door each failure lives behind"
sidebar_label: "04 · python -m and __main__.py"
sidebar_position: 5
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-10 against the Python 3.14 documentation — [`__main__`](https://docs.python.org/3.14/library/__main__.html), [command line](https://docs.python.org/3.14/using/cmdline.html), [`argparse` → prog](https://docs.python.org/3.14/library/argparse.html) — CPython **v3.14.7** source [`Lib/runpy.py`](https://github.com/python/cpython/blob/v3.14.7/Lib/runpy.py) and [`Python/ceval.c`](https://github.com/python/cpython/blob/v3.14.7/Python/ceval.c), *Creating and packaging command-line tools* ([packaging.python.org](https://packaging.python.org/en/latest/guides/creating-command-line-tools/)), the uv [CLI reference](https://docs.astral.sh/uv/reference/cli/) and [CHANGELOG](https://github.com/astral-sh/uv/blob/0.12.12/changelogs/0.4.x.md), and real `__main__.py` files at named tags — pip **26.2.1** [`src/pip/__main__.py`](https://github.com/pypa/pip/blob/26.2.1/src/pip/__main__.py), flake8 **7.3.0** [`__main__.py`](https://github.com/PyCQA/flake8/blob/7.3.0/src/flake8/__main__.py), pytest **9.1.1** [`__main__.py`](https://github.com/pytest-dev/pytest/blob/9.1.1/src/pytest/__main__.py).
> Target: **Python 3.14.7** · **uv 0.12.12** · ruff 0.16.6 · pre-commit 4.6.2. Documentation-validated — **no sandbox run, no program output**.

**A console script depends on four things outside your package: an installer having written the wrapper, the scripts directory being on `PATH`, the interpreter path in its shebang still existing, and — on Windows — its `.exe` not being the file you are trying to replace. `python -m invoice_service` depends on none of them. It needs only an interpreter that can import the package, which is the condition your code already requires. That makes it the fallback that works in containers without a shell profile, in broken `PATH`s, in images without `/bin/sh` and during a Windows self-upgrade, and it costs one small `__main__.py`. But it is a different door, not the same one: the working directory goes first on `sys.path`, `argv[0]` and the program name change, the interpreter is whichever `python` you typed, and a module run with `-m` can end up imported twice. Ship both, route both to one function, and know which differences you are signing up for.**

## What `-m` does

> *"Locate the module using the standard import mechanism and execute its contents as the `__main__` module."*

> *"Package names (including namespace packages) are also permitted. When a package name is supplied instead of a normal module, the interpreter will execute `<pkg>.__main__` as the main module."*

> *"If this option is given, the first element of `sys.argv` will be the full path to the module file (while the module file is being located, the first element will be set to `"-m"`). As with the `-c` option, the current directory will be added to the start of `sys.path`."*
> — all three [command line](https://docs.python.org/3.14/using/cmdline.html)

So `python -m invoice_service` imports the package `invoice_service` (running its `__init__.py`), then runs `invoice_service/__main__.py` as `__main__`. The console script instead imports `invoice_service.cli` and calls `main`. A `__main__.py` that delegates makes the two converge:

```python
# src/invoice_service/__main__.py
from invoice_service.cli import main

raise SystemExit(main())
```

That is the shape the Python documentation recommends:

> *"The content of `__main__.py` typically isn't fenced with an `if __name__ == '__main__'` block. Instead, those files are kept short and import functions to execute from other modules. Those other modules can then be easily unit-tested and are properly reusable."*
> — [`__main__`](https://docs.python.org/3.14/library/__main__.html)

The import is absolute on purpose. The documentation's own example uses a relative import (`from .student import search_students`), which works under `-m` because the package context exists — but fails when the directory is run as a script (`python src/invoice_service`), where there is no parent package; topic 04 covers that case and its workaround ([flat and src layout](../04-project-layout/01-flat-and-src-layout.md)).

### To guard or not to guard

The documentation prefers no guard, and gives the reason:

> *"If used, an `if __name__ == '__main__'` block will still work as expected for a `__main__.py` file within a package, because its `__name__` attribute will include the package's path if imported"*

> *"This won't work for `__main__.py` files in the root directory of a `.zip` file though. Hence, for consistency, a minimal `__main__.py` without a `__name__` check is preferred."*

Real projects often keep the guard anyway. flake8 7.3.0:

```python
"""Module allowing for ``python -m flake8 ...``."""
from __future__ import annotations

from flake8.main.cli import main

if __name__ == "__main__":
    raise SystemExit(main())
```

pytest 9.1.1:

```python
"""The pytest entry point."""

from __future__ import annotations

from _pytest.config import _console_main


if __name__ == "__main__":
    raise SystemExit(_console_main())
```

The trade-off is concrete. Without a guard, `import invoice_service.__main__` — legal, the documentation demonstrates it with `asyncio.__main__` — runs the command. With a guard, that import is harmless, and the only thing lost is the zip-root case, which a package inside a wheel is not. Either is defensible; what matters is that the file only delegates.

## The two doors, side by side

| | `invoice` (console script) | `python -m invoice_service` |
|---|---|---|
| Found through | `PATH`, then the wrapper's shebang | the interpreter you typed, then `sys.path` |
| Interpreter | fixed at install time | whichever `python` resolves first |
| `sys.path[0]` | the scripts directory (`.venv/bin`) | 🔴 the current working directory |
| What runs as `__main__` | the wrapper file | `invoice_service/__main__.py` |
| Your CLI module's `__name__` | `invoice_service.cli` | `invoice_service.cli` (via `__main__.py`) — but `__main__` if you run `-m invoice_service.cli` |
| `sys.argv[0]` | the wrapper path, `.exe` stripped | the full path of `__main__.py` |
| `argparse` default `prog` (3.14) | base name of `argv[0]` → `invoice` | *"the Python interpreter name followed by `-m` followed by the module or package name"* |
| Needs the scripts dir on `PATH` | yes | no |
| Survives a moved venv | no — the shebang is absolute | no wrapper to break, but the `venv` docs still say to recreate a moved environment |
| Windows self-upgrade | pip refuses it through `pip.exe` ([02](02-windows-launchers-and-gui-scripts.md)) | the route pip tells you to use |

The `sys.path[0]` row is the one with teeth, and topic 04 builds the whole table of start-up modes around it ([`sys.path[0]`](../04-project-layout/02-sys-path-zero.md)). In a flat-layout checkout, `python -m invoice_service` run from the root imports the checkout's `invoice_service/`, not the installed one — the wrong-copy bug ([04 · the wrong-copy bug](../04-project-layout/03-the-wrong-copy-bug.md)). A stray `logging.py` or `requests.py` in the working directory shadows the real module under `-m` and not under the console script. CPython 3.14 even diagnoses the stdlib case in its import error, with a format string in `ceval.c` that reads *"cannot import name %R from %R (consider renaming %R since it has the same name as the standard library module named %R and prevents importing that standard library module)"*.

pip treats that row as a bug to undo. Its own `src/pip/__main__.py`, verbatim at 26.2.1:

```python
# Remove '' and current working directory from the first entry
# of sys.path, if present to avoid using current directory
# in pip commands check, freeze, install, list and show,
# when invoked as python -m pip <command>
if sys.path[0] in ("", os.getcwd()):
    sys.path.pop(0)
```

Most CLIs do not need that; a src layout removes the checkout from the equation, and `python -P` (or `PYTHONSAFEPATH`) stops the prepend for one run. But a tool that inspects "the current project" — as pip does — should copy it.

## The double-import trap

Run a *submodule* with `-m` — `python -m invoice_service.cli` — and that file executes as `__main__`. If anything else imports `invoice_service.cli` by its real name, it is executed a second time as a separate module object: two copies of every module-level registry, cache, singleton and class. The most common trigger is the package's own `__init__.py` re-exporting from the CLI module, and `runpy` warns about exactly that. `Lib/runpy.py`, lines 121–130 at v3.14.7:

```python
existing = sys.modules.get(mod_name)
if existing is not None and not hasattr(existing, "__path__"):
    from warnings import warn
    msg = "{mod_name!r} found in sys.modules after import of " \
        "package {pkg_name!r}, but prior to execution of " \
        "{mod_name!r}; this may result in unpredictable " \
        "behaviour".format(mod_name=mod_name, pkg_name=pkg_name)
    warn(RuntimeWarning(msg))
```

The fix is structural, not a warning filter: run the *package* (`-m invoice_service`) through a `__main__.py` that imports `main`, and keep `__init__.py` from importing the CLI module at all. Then there is exactly one `invoice_service.cli`, whichever door was used.

## The errors `-m` produces

From `runpy.py`, the format strings behind the messages you will meet:

- *"No module named %s"* — the interpreter you ran cannot import the package: wrong `python`, the project not installed into it, or a src layout run without installation. The packaging guide is explicit that `python -m greetings` *"works immediately with flat layout, but requires installation of the package with src layout"*.
- *"%s; %r is a package and cannot be directly executed"* — the package exists but has no `__main__.py`, so the inner error names `invoice_service.__main__`.
- *"Cannot use package as __main__ module"* and *"%r is a namespace package and cannot be executed"* — two rarer messages from the same function; their exact triggers are in `_get_module_details` and are not traced here.

## `-m` through uv

`uv run -m` was added in uv 0.4.18 (*"Support `uv run -m foo` to run a module"*) and the CLI reference defines it as *"Run a Python module. Equivalent to `python -m <module>`."* — with uv's sync-then-run in front ([`uv run`](../02-uv/04c-uv-run.md)). It fixes the one weakness `-m` has over the console script, the interpreter choice:

```bash
uv run -m invoice_service --customer acme     # the project's interpreter, synced first
uv run python -m invoice_service --customer acme
```

And in a container, where the environment's path is known and a shell may not exist, `-m` avoids the wrapper entirely — including its `#!/bin/sh` trampoline ([01](01-what-the-installer-writes.md)):

```dockerfile
ENTRYPOINT ["/app/.venv/bin/python", "-m", "invoice_service"]
```

## Gotchas

**★ Symptom: `python -m invoice_service` fails with "No module named invoice_service" while `invoice` works.** Cause: `python` resolved to a different interpreter from the one the project is installed in — the console script's shebang pins the right one, `-m` uses whichever `python` is first on `PATH`. Fix: name the environment's interpreter.

```bash
uv run -m invoice_service
.venv/bin/python -m invoice_service
```

**★ Symptom: "… 'invoice_service' is a package and cannot be directly executed".** Cause: the package has no `__main__.py`. Fix: add one that delegates to the console script's function.

```python
# src/invoice_service/__main__.py
from invoice_service.cli import main

raise SystemExit(main())
```

**★ Symptom: a `RuntimeWarning` that `'invoice_service.cli' found in sys.modules after import of package 'invoice_service'`, then registries that are mysteriously empty or duplicated.** Cause: you ran the submodule with `-m` and the package's `__init__.py` had already imported it, so it runs a second time as `__main__`. Fix: run the package, and stop re-exporting the CLI from `__init__.py`.

```python
# src/invoice_service/__init__.py — no import of .cli here
__all__ = ["issue_invoice"]
from invoice_service.issue import issue_invoice
```

**★ Symptom: `python -m invoice_service` behaves differently from `invoice` when run in the project root.** Cause: `-m` puts the working directory first on `sys.path`, so in a flat checkout the source tree's copy is imported, while the console script imports the installed one. Fix: a src layout; for one run, `-P`.

```bash
python -P -m invoice_service --customer acme
```

**Symptom: `python -m invoice_service` fails with an import error about `logging`, `json` or `requests` — only in one directory.** Cause: a file named like that module sits in the working directory and wins, because `-m` searches it first; CPython 3.14's message suggests renaming it when it shadows the standard library. Fix: rename the stray file.

```bash
git mv logging.py log_setup.py
```

**Symptom: `import invoice_service.__main__` — from a test, a docs tool, or an interactive session — starts the command.** Cause: an unguarded `__main__.py` runs on import, and importing it is legal. Fix: guard it, as flake8 and pytest do, if anything in your toolchain imports every module.

```python
from invoice_service.cli import main

if __name__ == "__main__":
    raise SystemExit(main())
```

**Symptom: a multi-call CLI that picks its behaviour from `os.path.basename(sys.argv[0])` works as `invoice-export` and does the wrong thing under `python -m invoice_service`.** Cause: under `-m`, `argv[0]` is the full path of `__main__.py`, so the base name is `__main__.py`. Fix: give each command its own entry point instead of dispatching on `argv[0]`.

```toml
[project.scripts]
invoice = "invoice_service.cli:main"
invoice-export = "invoice_service.cli:export_main"
```

**Symptom: help text says `usage: python -m invoice_service` in one place and `usage: invoice` in another, and a snapshot test fails on 3.14 only.** Cause: 3.14's `argparse` derives the default `prog` from how `__main__` was executed. Fix: set `prog` once.

```python
parser = argparse.ArgumentParser(prog="invoice")
```

## Interview questions

**★ What is actually different between running `invoice` and `python -m invoice_service`?**
The door, not the room. The console script is a generated file found through `PATH` whose shebang pins one interpreter; it puts the scripts directory first on `sys.path` and imports your CLI module under its real name. `-m` runs `invoice_service/__main__.py` as `__main__` under whichever interpreter you typed, puts the working directory first on `sys.path`, sets `argv[0]` to the module's full path and, on 3.14, changes `argparse`'s default program name. With a `__main__.py` that imports and calls the same `main`, both reach identical code — but the import search path, the interpreter and the program name can still differ.

**★ Why ship a `__main__.py` when you already have a console script?**
Because the console script can fail for reasons that have nothing to do with your code — the scripts directory is not on `PATH`, the venv was moved and every shebang points nowhere, a slim image has no `/bin/sh` for a trampoline wrapper, or Windows will not let the running `.exe` be replaced during a self-upgrade. `python -m yourpkg` depends only on the package being importable. It is the documented fallback (pip tells Windows users to use it) and the right `ENTRYPOINT` in containers. The cost is a file that imports `main` and raises `SystemExit(main())`.

**★ Why does `python -m` put the working directory on `sys.path`, and why does pip undo it?**
The documentation defines it that way — *"As with the `-c` option, the current directory will be added to the start of `sys.path`"* — so that `python -m something` can run a module sitting in the current directory. For a tool that inspects "the current project" that is a hazard: a directory containing a package named `pip`, or one that shadows a dependency, would be imported instead of the real thing. pip's `__main__.py` therefore pops `''` or the working directory from `sys.path[0]` before importing anything. A console script never has the problem, because its `sys.path[0]` is the scripts directory.

**What is the double-import trap with `-m`?**
Running a submodule with `python -m package.cli` executes that file as the module `__main__`. If the package's `__init__.py`, or anything else, imports `package.cli` by name, the same source is executed again as a second module object, so module-level state — registries, caches, singletons, class identities — exists twice and `isinstance` checks between them fail. `runpy` warns that the module was *"found in sys.modules after import of package … but prior to execution"*. The cure is to run the package through a delegating `__main__.py` and keep `__init__.py` from importing the CLI module.

**Should `__main__.py` have an `if __name__ == "__main__":` guard?**
The Python documentation prefers a minimal file without one, because the guard does not work for a `__main__.py` at the root of a zip archive and consistency is simpler. flake8 and pytest keep the guard, which makes `import package.__main__` harmless — something the documentation shows is a legal import. For a package installed from a wheel the zip-root case does not arise, so either choice is sound; the rule that matters is that the file only imports and delegates.

**How does `uv run -m` relate to `python -m`?**
uv defines it as *"Equivalent to `python -m <module>`"*, but run through `uv run`, which finds the project, locks and syncs it, and uses the project's interpreter. That removes the one advantage the console script had — a pinned interpreter — while keeping `-m`'s independence from `PATH` and wrappers. It has existed since uv 0.4.18.

---

← Prev: [03 · The function contract](03-the-function-contract.md) · [Topic index](README.md) · Next → [05 · Reading entry points at runtime](05-reading-entry-points-at-runtime.md)
