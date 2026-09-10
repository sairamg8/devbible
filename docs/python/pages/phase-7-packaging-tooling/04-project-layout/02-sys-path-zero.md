---
title: "sys.path[0] is chosen by how you started Python, not by where your package lives — python -m, a script path, -c, the REPL and a console script each put a different directory first, and the first directory that contains a matching name wins"
sidebar_label: "02 · sys.path zero"
sidebar_position: 2
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-10 · target **Python 3.14.7** · against the CPython 3.14 docs — [`sys.path`](https://docs.python.org/3.14/library/sys.html#sys.path), *Command line and environment* ([docs.python.org](https://docs.python.org/3.14/using/cmdline.html)), *The import system* ([docs.python.org](https://docs.python.org/3.14/reference/import.html)), *What's New in Python 3.13* ([docs.python.org](https://docs.python.org/3.14/whatsnew/3.13.html)) — and pytest *pytest import mechanisms and `sys.path`/`PYTHONPATH`* ([docs.pytest.org](https://docs.pytest.org/en/stable/explanation/pythonpath.html)).
> Documentation-validated — **no sandbox run, no program output on this page**.

**The wrong-copy bug is not a packaging bug. It is the import system doing exactly what it is documented to do: search `sys.path` in order, stop at the first entry that contains the name, and cache the answer for the rest of the process. What makes it a trap is that the first entry is decided by the command line — `python -m` prepends the working directory, `python script.py` prepends the script's directory, a console script prepends wherever it was installed — so the same test suite can import two different copies of your package depending on how it was launched and where the shell was standing. This chunk is the table you need to predict which copy wins, and the three switches that turn the behaviour off.**

## How `sys.path` is built

> *"A list of strings that specifies the search path for modules. Initialized from the environment variable `PYTHONPATH`, plus an installation-dependent default."*

On top of that, one more entry goes in front of everything:

> *"By default, as initialized upon program startup, a potentially unsafe path is prepended to `sys.path` (before the entries inserted as a result of `PYTHONPATH`):"*
> *"`python -m module` command line: prepend the current working directory."*
> *"`python script.py` command line: prepend the script's directory. If it's a symbolic link, resolve symbolic links."*
> *"`python -c code` and `python` (REPL) command lines: prepend an empty string, which means the current working directory."*

So the order at startup is: the *potentially unsafe path* chosen by the command line, then anything from `PYTHONPATH`, then the installation's standard library and site-packages. The documentation's own word for that first entry is *unsafe*, and the reason is exactly this topic: it is a directory you did not choose on purpose, and anything in it shadows everything after it.

## The table

What goes first, and what that means when you are standing in the root of the flat `invoice-service` project from [01](01-flat-and-src-layout.md):

| You run | `sys.path[0]` | Flat project, run from the root | src project, run from the root |
|---|---|---|---|
| `python -m pytest` | the current directory | 🔴 `invoice_service/` in the root wins | root has no `invoice_service/` — installed copy used |
| `python -c "import invoice_service"` | `''` — the current directory | 🔴 checkout wins | installed copy |
| `python` (REPL) | `''` — the current directory | 🔴 checkout wins | installed copy (or `ModuleNotFoundError` if not installed) |
| `python tools/report.py` | `tools/` — the script's directory | root not on the path; installed copy | installed copy |
| `python main.py` in the root | the root | 🔴 checkout wins | installed copy |
| `pytest`, `invoice-service` (console scripts) | the directory holding the generated script | root not on the path — *unless pytest adds it* ([06](06-pytest-import-modes.md)) | installed copy |
| `python -P -m pytest` | nothing prepended | installed copy | installed copy |
| `python -I …` | nothing prepended, `PYTHON*` ignored | installed copy | installed copy |

The console-script row is reasoning from the documented rule rather than a separately documented case: on POSIX a generated console script is a Python file run through its shebang, which is the `python script.py` case, so its own directory — the environment's `bin/` — is what gets prepended. I have not confirmed the equivalent for the Windows `.exe` launchers and the page does not assert it. pytest's own documentation confirms the practical consequence for pytest specifically:

> *"Running pytest with `pytest [...]` instead of `python -m pytest [...]` yields nearly equivalent behaviour, except that the latter will add the current directory to `sys.path`, which is standard `python` behavior."*

The command-line reference says the same for the two forms that take the working directory:

> *"If this option is given, the first element of `sys.argv` will be `"-c"` and the current directory will be added to the start of `sys.path` (allowing modules in that directory to be imported as top level modules)."*

> `-m`: *"As with the `-c` option, the current directory will be added to the start of `sys.path`."*

## First match wins, and then it is cached

The path-based finder walks `sys.path` in order for a top-level import and stops at the first entry that has the name. Before it even starts, the import system checks its cache:

> *"The first place checked during import search is `sys.modules`. This mapping serves as a cache of all modules that have been previously imported, including the intermediate paths."*

Two consequences follow, and both matter for this topic.

**One process, one copy.** Once `invoice_service` has been imported from the checkout, every later `import invoice_service` in that process gets the cached module. Nothing re-searches.

**Subpackages come from the same copy as their parent.** A package's submodules are found through its `__path__`, not through `sys.path`:

> *"The `__path__` attribute should be a (possibly empty) sequence of strings enumerating the locations where the package's submodules will be found. By definition, if a module has a `__path__` attribute, it is a package."*

So if `invoice_service` resolved to `./invoice_service/`, then `invoice_service.pdf` is looked up in `./invoice_service/` and nowhere else. You never get a mixture of checkout and installed modules — which is precisely why a subpackage missing from the wheel is invisible to a test run that imported the parent from the checkout. [03](03-the-wrong-copy-bug.md) builds that case.

## Asking Python which copy it used

The only reliable diagnostic is to ask the module where it came from, in the same invocation your tests use:

```python
# where_from.py — run it exactly the way CI runs the tests
import sys

import invoice_service

print("imported from:", invoice_service.__file__)
print("first three sys.path entries:", sys.path[:3])
print("cached as:", sys.modules["invoice_service"])
```

Read `__file__`: a path inside the repository means the checkout won; a path inside the environment's `site-packages` means the installed copy won. For an *editable* install it will point into the repository even though the package is "installed" — that is expected, and [04](04-editable-installs-reopen-the-hole.md) is about why it matters.

## The three switches

**`-P`**, added in Python 3.11:

> *"Don't prepend a potentially unsafe path to `sys.path`"*

It negates each of the three bullets above. **`PYTHONSAFEPATH`**, also 3.11, is the environment-variable form:

> *"If this is set to a non-empty string, don't prepend a potentially unsafe path to `sys.path`: see the `-P` option for details."*

**`-I`**, isolated mode, is the heavier hammer:

> *"Run Python in isolated mode. This also implies `-E`, `-P` and `-s` options."*
> *"In isolated mode `sys.path` contains neither the script's directory nor the user's site-packages directory. All `PYTHON*` environment variables are ignored, too."*

`-P` is the precise tool for this problem: it removes only the working-directory entry. `-I` also discards `PYTHONPATH` and the user site directory, which is what you want when diagnosing "something on my machine is leaking into imports" and more than you want for a normal test run.

```bash
python -P -m pytest                  # tests, without the working directory on sys.path
PYTHONSAFEPATH=1 python -m pytest    # the same, set once for a CI job
python -I where_from.py              # diagnosis with every environment influence removed
```

⚠️ `-P` does not stop *pytest* from inserting directories — its `prepend` import mode does that itself, and [06](06-pytest-import-modes.md) shows when it inserts the root. And it does not change what an editable install puts on the path.

## The stdlib-shadowing cousin

The same rule is why a file in your project root named after a standard-library module breaks code that has nothing to do with it. Python 3.13 added a specific error message because it is so common:

> *"A common mistake is to write a script with the same name as a standard library module. When this results in errors, we now display a more helpful error message"*

The documented example message ends *"(consider renaming '/home/me/random.py' since it has the same name as the standard library module named 'random' and prevents importing that standard library module)"*, and a parallel message covers third-party names: *"(consider renaming '/home/me/numpy.py' if it has the same name as a library you intended to import)"*. Both are the wrong-copy bug with the roles swapped: your file is the copy that should *not* have been found.

## `PYTHONPATH` is the manual version of all this

`PYTHONPATH` entries land right after the unsafe path and before site-packages. `PYTHONPATH=src` is therefore a hand-rolled way of making a src layout importable without installing it — pytest's docs offer it for exactly that (*"`PYTHONPATH=src pytest`"*) — and a global `PYTHONPATH` in a shell profile is a hand-rolled way of making *every* project import from one stale directory. Neither is wrong, but both re-create the "which copy?" question the src layout was adopted to eliminate.

## Gotchas

**★ Symptom: the suite passes under `python -m pytest` and fails under `pytest`, or the other way round.** Cause: `python -m` prepends the working directory and the console script does not, so in a flat project the two invocations import different copies. Fix: move to a src layout so the answer is the same either way; until then, make CI use one form and make the working directory irrelevant.

```bash
python -P -m pytest
```

**★ Symptom: an unrelated library fails with `AttributeError: module 'random' has no attribute …` or similar.** Cause: a file in the directory at `sys.path[0]` has a standard-library module's name, and it shadows the real one for the whole process — on 3.13+ the message ends with the *"consider renaming"* hint. Fix: rename the file, and delete any stale bytecode cache alongside it.

```bash
git mv random.py sample_data.py
find . -name '__pycache__' -type d -prune -exec rm -rf {} +
```

**★ Symptom: a scratch file called `httpx.py` or `requests.py` breaks the real dependency.** Cause: the third-party variant of the same shadowing — the scratch file is found before site-packages. Fix: rename it; scratch files belong outside the root or under a name nothing will ever import.

```bash
git mv httpx.py scratch_httpx_probe.py
```

**Symptom: tests pass when run from the repository root and fail when run from `tests/`.** Cause: `python -m pytest` prepends whatever the current directory is; from the root that includes the flat package, from `tests/` it does not. Fix: always run from the project root in scripts, or remove the dependency on it with a src layout.

```bash
cd "$(git rev-parse --show-toplevel)" && python -m pytest
```

**★ Symptom: a `conftest.py` or test helper contains `sys.path.insert(0, …)` and nobody knows why.** Cause: someone made a flat or uninstalled project importable by hand, hard-wiring every run to the checkout. Fix: delete the hack and install the project, so the test run goes through the same packaging as a user.

```python
# tests/conftest.py — before: sys.path.insert(0, str(pathlib.Path(__file__).parents[1]))
# after: nothing. The package is installed into the environment by `uv sync`.
import pytest


@pytest.fixture
def invoice_number() -> str:
    return "INV-0001"
```

**Symptom: every project on one machine imports an old version of a shared package.** Cause: a `PYTHONPATH` exported in a shell profile or CI environment, whose entries sit ahead of site-packages. Fix: remove it, and diagnose with the environment stripped away.

```bash
env -u PYTHONPATH python -m pytest
python -I -c "import sys; print(sys.path)"
```

**Symptom: turning on `PYTHONSAFEPATH=1` in CI makes a flat project's tests fail to import their own package.** Cause: the package was never installed; the working-directory entry was the only thing making it importable. Fix: this is the flag doing its job — install the project in the CI environment.

```bash
python -m pip install .
PYTHONSAFEPATH=1 python -m pytest
```

**Symptom: a script reached through a symlink imports its neighbours from an unexpected directory.** Cause: for `python script.py`, the prepended directory is the *resolved* location — *"If it's a symbolic link, resolve symbolic links."* Fix: expose the tool as a console script instead of a symlinked file.

```toml
[project.scripts]
invoice-report = "invoice_service.report:main"
```

**Symptom: changing `sys.path` part-way through a session does not change which copy is used.** Cause: `sys.modules` already holds the first copy imported, and the cache is checked before the path. Fix: set the path — or better, the environment — before the first import, in a fresh process.

```bash
uv run python -c "import invoice_service; print(invoice_service.__file__)"
```

## Interview questions

**★ What does Python put at the front of `sys.path` for `python -m x`, `python script.py`, and `python -c`?**
For `-m`, the current working directory. For a script, the script's own directory, with symlinks resolved. For `-c` and the REPL, an empty string, which means the current directory. The documentation calls this entry *"a potentially unsafe path"* and it goes in before anything from `PYTHONPATH`. That single rule is why a flat package in the working directory beats an installed one for three of the four common ways of starting Python.

**★ Why do `pytest` and `python -m pytest` sometimes give different results?**
Because only the second one puts the current directory on `sys.path`; pytest's docs say the two are *"nearly equivalent"* except for exactly that. In a flat project run from the root, `python -m pytest` can import the checkout's package while `pytest` imports the installed one — unless pytest's own `prepend` import mode inserts the root anyway, which it does when `tests/` is a package or a `conftest.py` sits in the root. In a src project there is nothing named after the package in the root, so both forms resolve to the installed copy.

**★ If the same package exists in the working directory and in site-packages, can one process end up using parts of both?**
No. The first `import invoice_service` picks one copy by walking `sys.path` in order and caches it in `sys.modules`; later imports hit the cache. Submodules are then searched through the package's `__path__`, which points into whichever directory the parent came from. So the whole package tree comes from one copy — which is why a module present in the checkout and absent from the wheel is never noticed by a process that imported the parent from the checkout.

**What do `-P` and `PYTHONSAFEPATH` do, and why is it not the default?**
They stop Python prepending the command-line-dependent path, so neither the working directory nor the script's directory is searched first. They arrived in 3.11. Making it the default would break the enormous number of workflows that rely on running `python script.py` next to sibling modules or `python -m tool` from a project root; the flag lets you opt in where the implicit entry is a hazard, such as CI test runs.

**How is `-I` different from `-P`?**
`-I` implies `-P` and adds `-E` and `-s`: the script's directory is not added, `PYTHON*` environment variables — `PYTHONPATH` included — are ignored, and the user site-packages directory is left out. The documentation adds that *"further restrictions may be imposed"*. It is a diagnostic and security tool; for simply keeping the checkout off the path in a test run, `-P` is enough.

**Why does a file called `random.py` in your project break other libraries?**
Because it sits in the directory at `sys.path[0]`, so every `import random` in the process — including inside the standard library and third-party code — finds your file first and caches it. From 3.13 the resulting error carries a hint suggesting you rename the file, which is Python acknowledging how often this happens.

**Is `PYTHONPATH=src pytest` a good substitute for installing a src-layout project?**
It is a legitimate ad-hoc option — pytest documents it — but it bypasses your build configuration exactly as a flat layout does: the tests import whatever is on disk under `src/`, not what the backend would put in a wheel. It is fine for a quick run; it is not a substitute for testing the installed package in CI.

---

← Prev: [01 · Flat vs src layout](01-flat-and-src-layout.md) · [Topic index](README.md) · Next → [03 · The wrong-copy bug](03-the-wrong-copy-bug.md)
