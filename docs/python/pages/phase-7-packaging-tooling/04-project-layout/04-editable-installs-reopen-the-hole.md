---
title: "An editable install is an install that points back at your source tree, so it re-opens exactly the hole the src layout closed — the layout limits what it exposes, and only a regular install in CI proves what the wheel contains"
sidebar_label: "04 · Editable installs and layout"
sidebar_position: 5
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-10 · target **Python 3.14.7**, **uv 0.12.12** · against setuptools *Development Mode (a.k.a. "Editable Installs")* ([setuptools.pypa.io](https://setuptools.pypa.io/en/latest/userguide/development_mode.html)), PyPUG *src layout vs flat layout* ([packaging.python.org](https://packaging.python.org/en/latest/discussions/src-layout-vs-flat-layout/)), pytest *Good Integration Practices* ([docs.pytest.org](https://docs.pytest.org/en/stable/explanation/goodpractices.html)), uv *Locking and syncing* ([docs.astral.sh](https://docs.astral.sh/uv/concepts/projects/sync/)) and the uv CLI reference ([docs.astral.sh](https://docs.astral.sh/uv/reference/cli/)).
> Documentation-validated — **no sandbox run, no program output**. The editable *mechanism* is deliberately not named: setuptools states it gives no guarantee which one it uses.

**The src layout's promise is that an import succeeds only for what was installed. An editable install is an installation whose whole purpose is to make your source tree importable without rebuilding — so it quietly hands back the thing the layout took away. That is correct for development and wrong for the job that decides whether a release is safe. What the layout still does under an editable install is limit the damage: a flat project's editable install can expose every file in the repository root as an importable module, while a src project's exposes only `src/`. This chunk covers what each layout exposes, the limits setuptools documents, and how to make CI test a regular install — with uv, with pip, and with nox. The mechanics of editable installs themselves belong to **10 · Editable installs** *(not written yet)*.**

## What an editable install is, as far as layout is concerned

> *"An "editable installation" works very similarly to a regular install with `pip install .`, except that it only installs your package dependencies, metadata and wrappers for console and GUI scripts. Under the hood, setuptools will try to create a special `.pth` file in the target directory (usually `site-packages`) that extends the `PYTHONPATH` or install a custom import hook."*

setuptools lists three techniques — a static `.pth` file adding a directory to `sys.path`, *"a farm of file links that mimic the project structure"* added the same way, and *"a dynamic `.pth` file"* installing an import finder — and then declines to commit to any of them:

> *"`Setuptools` offers **no guarantee** of which technique will be used to perform an editable installation."*

So nothing on this page depends on a specific `.pth` filename or path. What matters is the consequence, which is the same for all three: `import invoice_service` resolves to files in your working tree.

## What each layout exposes

setuptools states the general rule:

> *"Please note that, by default an editable install will expose at least all the files that would be available in a regular installation. However, depending on the file and directory organization in your project, it might also expose as a side effect files that would not be normally available. This is allowed so you can iteratively create new Python modules."*

*"Depending on the file and directory organization"* is the layout. When the editable install works by putting a directory on the path, that directory's entire contents become importable.

```text
flat — the directory on the path is the repository root
invoice-service/
├── noxfile.py          → import noxfile         works in dev, not installed
├── conftest.py         → import conftest        works in dev, not installed
├── scripts_helpers.py  → import scripts_helpers works in dev, not installed
├── tests/              → import tests.factories works in dev — as a namespace package even with no __init__.py
└── invoice_service/    → import invoice_service intended

src — the directory on the path is src/
invoice-service/
├── noxfile.py          not importable
├── tests/              not importable
└── src/
    └── invoice_service/ → import invoice_service  intended, and the only thing there
```

PyPUG names this exact difference:

> *"The src layout helps enforce that an editable installation is only able to import files that were meant to be importable."*

> *"The flat layout would add the other project files (eg: `README.md`, `tox.ini`) and packaging/tooling configuration files (eg: `setup.py`, `noxfile.py`) on the import path. This would make certain imports work in editable installations but not regular installations."*

The damaging case is package code that comes to depend on something outside the package — `from tests.factories import make_invoice` inside `invoice_service/seed.py` — which works for every developer and fails for every user.

## Why a src editable install still hides a missing file

The src layout limits *which directory* is exposed. It does not make an editable install apply your file selection, because an editable install exposes *at least* the regular set, and possibly the whole tree under the package directory. In [03b](03b-how-the-src-layout-catches-it.md)'s scenario, a `pdf/` subpackage that the build configuration excludes is still sitting inside `src/invoice_service/`, and an editable install that exposes the directory exposes it.

setuptools is candid that the two goals conflict:

> *"1. It should allow developers to add new files (or split/rename existing ones) and have them automatically exposed. 2. It should behave as close as possible to a regular installation and help users to detect problems (e.g. new files not being included in the distribution)."*
> *"Unfortunately these expectations are in conflict with each other."*

It offers a strict mode that chooses the second:

```bash
python -m pip install -e . --config-settings editable_mode=strict
```

> *"In this mode, new files **won't** be exposed and the editable installs will try to mimic as much as possible the behavior of a regular install. Under the hood, `setuptools` will create a tree of file links in an auxiliary directory (`$your_project_dir/build`) and add it to `PYTHONPATH` via a `.pth` file."*

Strict mode is a setuptools feature, and even it only *mimics* a regular install. setuptools' own conclusion is the one to act on:

> *"Editable installs are **not a perfect replacement for regular installs** in a test environment. When in doubt, please test your projects as installed via a regular wheel. There are tools in the Python ecosystem, like tox or nox, that can help you with that"*

That is also what PyPUG meant by *"typically, an editable installation is used for development and a regular installation is used for testing"*.

## The limits you will meet day to day

setuptools documents these, and each is a layout-adjacent surprise:

> *"The editable term is used to refer only to Python modules inside the package directories. Non-Python files, external (data) files, executable script files, binary extensions, headers and metadata may be exposed as a snapshot of the version they were at the moment of the installation."*

> *"Adding new dependencies, entry-points or changing your project's metadata require a fresh "editable" re-installation."*

> *"There is no guarantee that files outside the top-level package directory will be accessible after an editable install."*

> *"There is no guarantee that attributes like `__path__` or `__file__` will correspond to the exact location of the original files"*

> *"Support for PEP 420-style implicit namespace packages for projects structured using flat-layout is still **experimental**. If you experience problems, you can try converting your package structure to the src-layout."*

> *"File system entries in the current working directory whose names coincidentally match installed packages may take precedence in Python's import system. Users are encouraged to avoid such scenarios."* — with the footnote *"Techniques like the src-layout or tooling-specific options like tox's changedir can be used to prevent such kinds of situations"*.

## Testing a regular install in CI

The discipline is two environments: editable for the inner loop, regular for the job that guards a release.

**uv.** Syncing installs the project editable by default, and the same page documents the opt-out:

> *"When the environment is synced, uv will install the project (and other workspace members) as editable packages, such that re-syncing is not necessary for changes to be reflected in the environment."*
> *"To opt-out of this behavior, use the `--no-editable` option."*

`uv run` takes the same flag — *"Install any editable dependencies, including the project and any workspace members, as non-editable"* — so the release-guard job is one line:

```bash
uv run --locked --no-editable pytest
```

Pass the flag to the command that runs the tests. `uv run` brings the environment up to date before running, and I could not confirm from the documentation whether a plain `uv run` after `uv sync --no-editable` keeps or replaces the non-editable install — so do not build a CI job on that sequence.

**pip.** A regular install into a fresh environment:

```bash
python -m venv .venv-release
. .venv-release/bin/activate
python -m pip install .
python -m pip install pytest
python -P -m pytest
```

**nox.** A session installs `.` as a regular package into its own virtualenv, which is the pattern setuptools points to:

```python
# noxfile.py
import nox


@nox.session
def tests_installed(session: nox.Session) -> None:
    session.install(".")
    session.install("pytest")
    session.run("pytest")
```

pytest's documentation says the same about tox: *"It will run tests against the installed package and not against your source code checkout, helping to detect packaging glitches."* — with the caveat that in a flat layout, the working directory can still put the checkout first; that is what tox's `changedir` and the src layout exist to prevent.

### Proving the job tested the installed copy

A job configuration can drift back to editable without anyone noticing. A session-scoped fixture can make the release-guard job refuse to run against anything but site-packages:

```python
# tests/conftest.py
import os
import pathlib

import pytest

import invoice_service


@pytest.fixture(scope="session", autouse=True)
def require_installed_copy() -> None:
    if os.environ.get("REQUIRE_INSTALLED_PACKAGE") != "1":
        return
    location = pathlib.Path(invoice_service.__file__).resolve()
    assert "site-packages" in location.parts, (
        f"invoice_service was imported from {location}, not from an installed wheel"
    )
```

```bash
REQUIRE_INSTALLED_PACKAGE=1 uv run --locked --no-editable pytest
```

The environment variable is set only in that job, because locally the package is editable and `__file__` points into `src/` — which is correct there.

## Gotchas

**★ Symptom: the project uses a src layout, and a file excluded from the wheel still passed every test.** Cause: tests ran through the editable install `uv sync` creates by default, which exposes at least the regular set and possibly the whole package directory. Fix: run the release-guard tests against a non-editable install.

```bash
uv run --locked --no-editable pytest
```

**★ Symptom: a new `[project.scripts]` command or a new dependency is not available after editing `pyproject.toml`.** Cause: *"Adding new dependencies, entry-points or changing your project's metadata require a fresh "editable" re-installation."* Fix: reinstall the project.

```bash
uv sync --reinstall-package invoice-service
python -m pip install -e .                   # the pip equivalent
```

**★ Symptom: package code imports `tests.factories` or `noxfile` and works for every developer.** Cause: a flat-layout editable install exposed the repository root, so anything in it is importable. Fix: move shared helpers into the package, and move the package under `src/` so the root is not exposed.

```python
# src/invoice_service/testing/factories.py — shipped, importable everywhere
def make_invoice(number: str = "INV-0001") -> dict[str, str]:
    return {"number": number}
```

**Symptom: after moving from flat to src, imports still find the old location, or fail oddly.** Cause: the existing editable install still points at the pre-move tree. Fix: reinstall the project, or rebuild the environment.

```bash
uv sync --reinstall-package invoice-service
rm -rf .venv && uv sync                       # when in doubt
```

**Symptom: an edited template or JSON file is not picked up in development.** Cause: non-Python files *"may be exposed as a snapshot of the version they were at the moment of the installation."* Fix: reinstall after changing data, or keep data inside the package directory, where exposure is most likely to be live.

```bash
uv sync --reinstall-package invoice-service
```

**Symptom: under strict mode, a module you just created is not importable.** Cause: that is strict mode — *"new files **won't** be exposed"*. Fix: reinstall after adding files; that friction is what lets strict mode catch files your configuration would not ship.

```bash
python -m pip install -e . --config-settings editable_mode=strict
```

**Symptom: code that computes paths from `__file__` or `__path__` breaks under one editable mode and not another.** Cause: *"There is no guarantee that attributes like `__path__` or `__file__` will correspond to the exact location of the original files"*. Fix: load resources through the package.

```python
from importlib.resources import files

template = (files("invoice_service") / "templates" / "invoice.html").read_text()
```

**Symptom: the installed-copy guard fixture fails on every developer's machine.** Cause: local environments are editable, so `__file__` is under `src/`. Fix: gate it on an environment variable set only in the release-guard CI job.

```bash
REQUIRE_INSTALLED_PACKAGE=1 uv run --locked --no-editable pytest
```

**Symptom: a flat-layout project with a PEP 420 namespace package behaves inconsistently under editable installs.** Cause: setuptools calls that combination *"still **experimental**"*. Fix: its own recommendation — convert to the src layout.

```text
src/
└── acme/                 no __init__.py: the namespace
    └── invoices/
        └── __init__.py
```

## Interview questions

**★ If the src layout prevents importing the wrong copy, why does PyPUG still say to use a regular install for testing?**
Because an editable install deliberately makes the source tree the installed copy. The layout ensures the *working directory* cannot shadow the installation; an editable installation points the installation itself back at `src/`, and setuptools says it exposes *"at least"* what a regular install would, possibly more. A file your build configuration excludes can still be importable through it. Only a regular install applies the backend's file selection, so only a regular install tests the artifact.

**★ What does an editable install expose in a flat layout versus a src layout?**
When it works by adding a directory to the path, everything in that directory. In a flat layout that is the repository root, so `noxfile.py`, `conftest.py`, `setup.py`, helper scripts and a `tests` package all become importable. In a src layout it is `src/`, which holds only what you meant to ship. That is PyPUG's *"only able to import files that were meant to be importable"*.

**What is setuptools' strict editable mode, and why is it not the default?**
A mode in which new files are not exposed and the install mimics a regular one as closely as it can, implemented with a tree of links under `build/`. It is not the default because the two goals of an editable install conflict — setuptools says so in as many words: developers want new files exposed automatically, and they also want the install to reveal files that would not be distributed. The default favours the first; strict mode favours the second at the cost of reinstalling whenever you add a module.

**Why do new entry points need a reinstall when code changes do not?**
An editable install makes your *modules* live; console-script wrappers and distribution metadata are generated at install time. setuptools lists metadata, entry points and non-Python files among the things that may be a snapshot. So a new `[project.scripts]` entry does not exist until the project is reinstalled.

**How would you make a uv-based CI pipeline test the installed artifact?**
Keep the default editable environment for the fast lint-and-test job, and add a release-guard job that runs `uv run --locked --no-editable pytest`, which installs the project and workspace members as regular packages. Pair it with a guard fixture that asserts the package was imported from site-packages when an environment variable is set, so the job cannot silently regress to editable. Alternatively, a nox session that `session.install(".")`s into a fresh virtualenv does the same job independent of uv.

**Why is it a problem that setuptools gives no guarantee about the editable mechanism?**
Because anything that inspects the mechanism — code computing paths from `__file__`, tooling that parses a `.pth` file, a test that asserts a specific directory is on `sys.path` — can break on a setuptools upgrade or under a different mode. The robust stance is to depend only on the documented contract: modules in the package directory are importable and live; everything else may be a snapshot. Load data through `importlib.resources`, and never rely on where the finder happens to point.

---

← Prev: [03b · How the src layout catches it](03b-how-the-src-layout-catches-it.md) · [Topic index](README.md) · Next → [05 · Where tests live](05-where-tests-live.md)
