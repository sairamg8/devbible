---
title: "Flat and src layouts differ by one directory, and that directory decides whether Python can import your package without installing it — which is the whole argument, not a matter of tidiness"
sidebar_label: "01 · Flat vs src layout"
sidebar_position: 1
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-10 · target **Python 3.14.7**, **uv 0.12.12** · against PyPUG *src layout vs flat layout* ([packaging.python.org](https://packaging.python.org/en/latest/discussions/src-layout-vs-flat-layout/)), PyPUG *Packaging Python Projects* ([packaging.python.org](https://packaging.python.org/en/latest/tutorials/packaging-projects/)), setuptools *Package Discovery* ([setuptools.pypa.io](https://setuptools.pypa.io/en/latest/userguide/package_discovery.html)), uv *Creating projects* ([docs.astral.sh](https://docs.astral.sh/uv/concepts/projects/init/)) and uv *Locking and syncing* ([docs.astral.sh](https://docs.astral.sh/uv/concepts/projects/sync/)).
> Documentation-validated — **no sandbox run, no program output on this page**.

**The flat layout puts your import package in the repository root; the src layout puts it one directory down, in `src/`. That is the entire structural difference, and it looks cosmetic until you notice that Python puts the current directory on the import path for most of the ways you start it. In a flat project, the repository root *is* an import root, so `import invoice_service` silently finds the checkout instead of the installed copy — and your tests pass against code that is not what you ship. The src layout removes the package from the directory Python is looking in, so the only way to import it is to install it. This chunk is the decision; the rest of the topic is the mechanism behind it and every tool that has to be told about it.**

## The two trees

The Python Packaging User Guide defines both in one sentence each:

> *"The "flat layout" refers to organising a project's files in a folder or repository, such that the various configuration files and import packages are all in the top-level directory."*

> *"The "src layout" deviates from the flat layout by moving the code that is intended to be importable (i.e. `import awesome_package`, also known as import packages) into a subdirectory. This subdirectory is typically named `src/`, hence "src layout"."*

The same project both ways — the running example for this whole topic:

```text
invoice-service/                 flat layout
├── pyproject.toml
├── README.md
├── noxfile.py
├── invoice_service/             ← import package, in the root
│   ├── __init__.py
│   ├── core.py
│   └── cli.py
└── tests/
    └── test_core.py
```

```text
invoice-service/                 src layout
├── pyproject.toml
├── README.md
├── noxfile.py
├── src/                         ← a plain directory, NOT a package
│   └── invoice_service/         ← import package, one level down
│       ├── __init__.py
│       ├── core.py
│       └── cli.py
└── tests/
    └── test_core.py
```

Nothing inside `invoice_service/` changes. Imports inside the package are identical — `from invoice_service.core import issue` in both. What changes is *which directory contains a directory named `invoice_service`*, and therefore which `sys.path` entries can find it.

## The only difference that matters

> *"The src layout requires installation of the project to be able to run its code, and the flat layout does not."*

Every other consequence follows from this. In the flat tree, any process whose `sys.path` contains the repository root can import `invoice_service` directly from your working copy. Python adds exactly that entry for `python -m …`, `python -c …` and the bare REPL when you start them from the root — [02](02-sys-path-zero.md) is the full table. In the src tree, the root contains `src/`, `tests/` and configuration files, and none of them is named `invoice_service`. The path entry is still added; it just finds nothing, and the import falls through to wherever the package was *installed*.

That is why the guide frames it as a guard rather than a style:

> *"The src layout helps prevent accidental usage of the in-development copy of the code."*

> *"This is relevant since the Python interpreter includes the current working directory as the first item on the import path. This means that if an import package exists in the current working directory with the same name as an installed import package, the variant from the current working directory will be used. This can lead to subtle misconfiguration of the project's packaging tooling, which could result in files not being included in a distribution."*

> *"The src layout helps avoid this by keeping import packages in a directory separate from the root directory of the project, ensuring that the installed copy is used."*

The phrase to hold on to is *files not being included in a distribution*. The failure is not "the wrong version runs on my laptop". It is "a release goes out missing a module, and the test suite that should have caught it was importing a different copy". [03](03-the-wrong-copy-bug.md) builds that bug end to end.

## The four consequences, and where each is covered

| PyPUG says | What it means in practice | Chunk |
|---|---|---|
| src *"requires installation of the project to be able to run its code"* | a fresh clone cannot `import` anything until `uv sync` or `pip install -e .` has run | this one |
| src *"helps prevent accidental usage of the in-development copy"* | tests and scripts started from the root import the *installed* package | [02](02-sys-path-zero.md), [03](03-the-wrong-copy-bug.md) |
| src *"helps enforce that an editable installation is only able to import files that were meant to be importable"* | a flat editable install can expose `noxfile.py` and friends as importable modules | [04](04-editable-installs-reopen-the-hole.md) |
| an *"additional step in the development workflow"* | editable install for development, regular install for testing | [04](04-editable-installs-reopen-the-hole.md) |

The editable-install point deserves its verbatim form now, because it is the one people do not expect:

> *"The flat layout would add the other project files (eg: `README.md`, `tox.ini`) and packaging/tooling configuration files (eg: `setup.py`, `noxfile.py`) on the import path. This would make certain imports work in editable installations but not regular installations."*

## What the src layout costs

It costs one step, and the guide names it:

> *"This means that the src layout involves an additional step in the development workflow of a project (typically, an editable installation is used for development and a regular installation is used for testing)."*

setuptools states the same trade from the other side:

> *"On the other hand you cannot rely on the implicit `PYTHONPATH=.` to fire up the Python REPL and play with your package (you will need an editable install to be able to do that)."*

In a uv project the step is invisible, because syncing installs the project for you:

> *"When the environment is synced, uv will install the project (and other workspace members) as editable packages, such that re-syncing is not necessary for changes to be reflected in the environment."*

So the day-to-day loop in a src project is:

```bash
uv sync                                   # installs invoice_service editable into .venv
uv run python -c "import invoice_service" # the REPL and scripts go through the environment
uv run pytest
```

and without uv:

```bash
python -m venv .venv
. .venv/bin/activate
python -m pip install -e .
python -m pytest
```

Editable-install mechanics in depth — `.pth` files, import hooks, what gets snapshotted — belong to **10 · Editable installs** *(not written yet)*; [04](04-editable-installs-reopen-the-hole.md) covers only the part the layout decides.

### Running a CLI straight from the source tree

The one workflow the src layout genuinely makes awkward is running the package without installing it. The guide's own workaround, verbatim:

> *"Due to the firstly mentioned specialty of the src layout, a command-line interface can not be run directly from the source tree, but requires installation of the package in Development Mode for testing purposes. Since this can be unpractical in some situations, a workaround could be to prepend the package folder to Python's `sys.path` when called via its `__main__.py` file:"*

```python
# src/invoice_service/__main__.py
import os
import sys

if not __package__:
    # Make CLI runnable from source tree with
    #    python src/invoice_service
    package_source_path = os.path.dirname(os.path.dirname(__file__))
    sys.path.insert(0, package_source_path)

from invoice_service.cli import main  # absolute import: works run either way

main()
```

`python src/invoice_service` runs the directory's `__main__.py` as a script, so `__package__` is empty and the guard inserts `src/` at the head of `sys.path`; `python -m invoice_service` after installation sets `__package__` to `"invoice_service"` and skips it. The `from invoice_service.cli import main` line must be absolute — a relative import has no parent package to be relative to when the file runs as a script. Use this for a tool that people genuinely run from a checkout; for anything else, `uv run invoice-service` through a `[project.scripts]` entry (see [pyproject.toml · 10 · Entry points and console scripts](../01-pyproject-toml/10-entry-points-and-console-scripts.md)) is simpler.

## `src` is a directory, never a package

`src/` must not contain an `__init__.py`. With one, `src` becomes an importable regular package — the import system says a regular package is *"typically implemented as a directory containing an `__init__.py` file"* — and IDE auto-import will happily write `from src.invoice_service.core import issue`. That line works from the repository root, because the root is on `sys.path` and contains a package named `src`, and fails everywhere the project is installed, because the wheel contains `invoice_service`, not `src`. It is the flat-layout bug reintroduced through the back door, with the added insult that the import now names a directory that does not exist in production.

## Naming the package directory

> *"The directory containing the Python files should match the project name. This simplifies the configuration and is more obvious to users who install the package."*

"Match" means the *normalised* name: the distribution `invoice-service` ships the import package `invoice_service`. Backends lean on this. uv's build backend derives the directory it looks for — *"the package name is lowercased and dots and dashes are replaced with underscores"* — and expects it at `src/<package_name>/__init__.py`; hatchling's wheel builder tries `<NAME>/__init__.py` and then `src/<NAME>/__init__.py`. Choose a different directory name and you owe every backend an explicit setting, covered in [07](07-how-backends-find-your-package.md) and [08](08-hatchling-and-uv-build-discovery.md). The distribution-name rules themselves are in [pyproject.toml · 03 · name and normalization](../01-pyproject-toml/03-the-project-name-and-normalization.md).

## Choosing

| Project | Layout | Why |
|---|---|---|
| Library you publish | **src** | uv: *"A `src` layout is particularly valuable when developing libraries."* The wrong-copy bug ships to strangers. |
| Service or CLI with a package and a test suite | **src** | the bug is about tests passing against a copy you do not deploy; that is not library-specific. uv's own default since 0.12 (see [12](12-uv-init-layouts.md)). |
| Single-file script, one-off automation | no package at all | `uv init --no-package` gives a flat `main.py` that is never installed, or a PEP 723 script — **09 · PEP 723 inline metadata** *(not written yet)*. |
| Existing flat project that works | leave it, or migrate deliberately | the migration is mechanical but touches CI and tooling config — [14](14-moving-a-flat-project-to-src.md). |

setuptools' own summary of the flat layout is fair to it: *"This layout is very practical for using the REPL, but in some situations it can be more error-prone (e.g. during tests or if you have a bunch of folders or Python files hanging around your project root)."* Flat is not broken. It makes a correct test run depend on where you happen to be standing and how you started Python, and the src layout removes that dependency.

## Gotchas

**★ Symptom: `ModuleNotFoundError: No module named 'invoice_service'` the moment you move the package into `src/`.** Cause: nothing installed it. In the flat layout the repository root on `sys.path` was doing the job of an install; in the src layout nothing is named `invoice_service` in the root, so the import has nowhere to succeed until the package is in the environment. Fix: install it, editable for development.

```bash
uv sync                          # uv project: installs the project editable
python -m pip install -e .       # or, without uv, inside an activated venv
```

**★ Symptom: `from src.invoice_service.core import issue` works in the repo and fails for every user.** Cause: a `src/__init__.py` made `src` a regular package, and the repository root on `sys.path` lets it import; the wheel ships `invoice_service` only. Fix: delete the file and import the package by its own name.

```bash
git rm src/__init__.py
```

```python
from invoice_service.core import issue
```

**Symptom: running `python src/invoice_service/cli.py` fails with the relative-import `ImportError`.** Cause: a file run by path executes as `__main__` with no parent package, so `from .core import issue` has nothing to be relative to — and in a src layout its directory, not `src/`, is what lands on `sys.path`. Fix: run the module through the installed package.

```bash
uv run python -m invoice_service.cli
```

**Symptom: the REPL in the repository root cannot import the package.** Cause: the src layout working as designed — the root is on `sys.path` for the REPL and contains no `invoice_service`. Fix: start the interpreter inside the environment where the package is installed.

```bash
uv run python
```

**Symptom: the build backend cannot find your package, or finds nothing to put in the wheel.** Cause: the directory under `src/` is not the normalised project name — `src/invoices/` for a project called `invoice-service` — so the uv backend's `src/<package_name>/__init__.py` default and hatchling's `src/<NAME>/__init__.py` heuristic both miss. Fix: rename the directory, or tell the backend explicitly.

```toml
[tool.uv.build-backend]
module-name = "invoices"
```

**Symptom: after the move, tests pass but a colleague's `from invoice_service import …` in a notebook fails.** Cause: the notebook kernel's working directory used to be the repository root, which made the flat package importable by accident. Fix: start Jupyter through the project environment, where the package is installed, instead of from a global install that relied on the working directory.

```bash
uv run --with jupyter jupyter lab
```

**Symptom: the `__main__.py` workaround is in place and `python src/invoice_service` still fails on an import.** Cause: another module in the package uses a relative import that is only reached through the script entry, or `__main__.py` itself uses one. Fix: make the imports reachable from `__main__.py` absolute, as in the guide's pattern.

```python
from invoice_service.cli import main
```

## Interview questions

**★ What is the actual difference between a flat and a src layout?**
Whether the directory containing your import package is one Python puts on `sys.path` by default. In a flat layout the package sits in the repository root, and `python -m`, `python -c` and the REPL all prepend the current directory, so from the root the package is importable straight from the working copy. In a src layout the package sits in `src/`, which nothing adds to `sys.path` automatically, so the only way to import it is to install it. The file contents are identical; the import resolution is not.

**★ Why is "the src layout requires installation" treated as a feature rather than a cost?**
Because installation is the step that applies your packaging configuration. If code can be imported only after it has gone through the build backend's file selection, then an import that works in CI is evidence that the *installed* package contains that module. In a flat layout the working copy satisfies the import whether or not the build would have included the file, so a green test run says nothing about the artifact. The cost — one `uv sync` or `pip install -e .` — is paid once per environment and is automatic in a uv project.

**★ Is the src layout worth it for an application that is never published to PyPI?**
Usually yes, because the bug it prevents is not specific to publishing. If a service is deployed from a wheel, or from an image that installs the project, then "tests import the checkout" and "production imports the build" are still two different copies. uv itself changed its default in 0.12 so that `uv init` gives applications a build system and a `src/` package. The case where it is not worth it is a project with no importable package at all — a single script — which is exactly what `uv init --no-package` is for.

**Why must `src/` not contain an `__init__.py`?**
Because it would make `src` an importable package, and the repository root on `sys.path` would then let `from src.invoice_service import …` succeed during development. The wheel contains `invoice_service` and no `src`, so that import fails for every consumer. The layout's guarantee depends on `src` being a plain directory that nothing can import.

**When is the flat layout the right choice?**
When there is nothing to install or the convenience outweighs the guard: a single-module distribution, a script, an exploratory project where REPL access from the root is the point. setuptools itself calls the flat layout *"very practical for using the REPL"*. It is also the honest choice for an existing flat project with no packaging problems — migrating is mechanical but touches CI, coverage and lint configuration, and should be a deliberate change rather than a reflex.

**What does it mean that the src layout makes an editable install "only able to import files that were meant to be importable"?**
When an editable install works by putting a directory on `sys.path`, everything in that directory becomes importable. In a flat layout that directory is the repository root, so `noxfile.py`, `setup.py`, `conftest.py` and any stray helper script become importable modules — code can come to depend on them and work only in development. In a src layout the directory is `src/`, which contains only the packages you meant to ship.

**How does the working directory interact with the layout when you run tests?**
For `python -m pytest`, the current directory is prepended to `sys.path`. Run from the root of a flat project, that makes the checkout's package win over the installed one; run from the root of a src project, it finds nothing and the installed package is used. So in a flat project the correctness of a CI run depends on the directory the job started in and on how pytest was invoked; in a src project it does not.

---

← Prev: [Overview](README.md) · Next → [02 · sys.path zero](02-sys-path-zero.md)
