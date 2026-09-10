---
title: "Tests live either beside the package or inside it, and the choice decides whether they ship, whether they can run against the installed copy, and whether adding one tests/__init__.py silently re-imports your checkout"
sidebar_label: "05 · Where tests live"
sidebar_position: 6
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-10 · target **Python 3.14.7**, **uv 0.12.12** · against pytest *Good Integration Practices* ([docs.pytest.org](https://docs.pytest.org/en/stable/explanation/goodpractices.html)), pytest *import mechanisms* ([docs.pytest.org](https://docs.pytest.org/en/stable/explanation/pythonpath.html)) and *Configuration* reference ([docs.pytest.org](https://docs.pytest.org/en/stable/reference/reference.html)), PyPUG *Packaging Python Projects* ([packaging.python.org](https://packaging.python.org/en/latest/tutorials/packaging-projects/)), setuptools *Controlling files in the distribution* ([setuptools.pypa.io](https://setuptools.pypa.io/en/latest/userguide/miscellaneous.html)), hatch *sdist builder* ([hatch.pypa.io](https://hatch.pypa.io/latest/plugins/builder/sdist/)) and the uv build backend ([docs.astral.sh](https://docs.astral.sh/uv/concepts/build-backend/)).
> Documentation-validated — **no sandbox run, no program output**.

**pytest documents two places to put tests: in a `tests/` directory beside the package, or in a `tests` subpackage inside it. The first is the default for good reason — the tests can run against whatever is installed, and they never ship to users. The second ships tests inside the wheel and lets anyone run them with `--pyargs` against the installed copy. Either way, the layout interacts with pytest's import mechanics in one place that catches people: making `tests/` a package so two files can share a name causes pytest to put the repository root on `sys.path` — harmless in a src layout, and the wrong-copy bug in a flat one. How pytest does that is [06](06-pytest-import-modes.md); this chunk is where the files go and what each placement costs.**

## Tests beside the package

pytest's diagram, verbatim:

```text
pyproject.toml
src/
    mypkg/
        __init__.py
        app.py
        view.py
tests/
    test_app.py
    test_view.py
    ...
```

> *"This has the following benefits:"*
> *"Your tests can run against an installed version after executing `pip install .`."*
> *"Your tests can run against the local copy with an editable install after executing `pip install --editable .`."*

The PyPUG tutorial's canonical tree has the same shape and treats `tests/` as a first-class member of the root, even when empty:

```text
packaging_tutorial/
├── LICENSE
├── pyproject.toml
├── README.md
├── src/
│   └── example_package_YOUR_USERNAME_HERE/
│       ├── __init__.py
│       └── example.py
└── tests/
```

> *"tests/ is a placeholder for test files. Leave it empty for now."*

pytest pairs this with its layout recommendation:

> *"Generally, but especially if you use the default import mode `prepend`, it is **strongly** suggested to use a `src` layout. Here, your application root package resides in a sub-directory of your root, i.e. `src/mypkg/` instead of `mypkg`."*

For the flat variant with no install, it documents the reliance on the working directory explicitly:

> *"If you do not use an editable install and do not use the `src` layout (`mypkg` directly in the root directory) you can rely on the fact that Python by default puts the current directory in `sys.path` to import your package and run `python -m pytest` to execute the tests against the local copy directly."*

That sentence is the wrong-copy bug described as a feature: it works *because* the checkout wins.

## Tests inside the package

```text
pyproject.toml
[src/]mypkg/
    __init__.py
    app.py
    view.py
    tests/
        __init__.py
        test_app.py
        test_view.py
        ...
```

> *"Inlining test directories into your application package is useful if you have direct relation between tests and application modules and want to distribute them along with your application"*

> *"In this scheme, it is easy to run your tests using the `--pyargs` option"*

```bash
pytest --pyargs mypkg
```

> *"`pytest` will discover where `mypkg` is installed and collect tests from there."*

> *"Note that this layout also works in conjunction with the `src` layout mentioned in the previous section."*

This is the scheme for a library that wants users — or a downstream redistributor — to be able to verify an installation in place. The cost is that the tests are part of the wheel: shipped, installed, and in scope for anything that scans installed packages.

## Do the tests ship?

For tests *beside* the package, the wheel answer is the same for every backend: no — the wheel contains the import package. The sdist answer differs, and it matters to anyone who builds or tests from source:

| Backend | `tests/` in the sdist by default? | Source |
|---|---|---|
| setuptools | **files matching `tests/test*.py` and `test/test*.py`** are in its default list | *"Files that match the following glob patterns: `tests/test*.py`, `test/test*.py`"* |
| hatchling | **yes, if not VCS-ignored** | *"All files that are not ignored by your VCS will be included."* |
| uv build backend | **no** — only `pyproject.toml`, the module, readme/licence files, data directories and `source-include` patterns | the sdist include list on the build-backend page |

setuptools spells out the split between the two artifacts:

> *"Please note that, when using `include_package_data=True`, only files **inside the package directory** are included in the final `wheel`, by default."*
> *"So for example, if you create a Python project that uses `setuptools-scm` and have a `tests` directory outside of the package folder, the `tests` directory will be present in the `sdist` but not in the `wheel`."*

With the uv backend, ship the tests in the sdist explicitly if anyone downstream runs them:

```toml
[tool.uv.build-backend]
source-include = ["tests/**"]
```

Includes are anchored — *"`pyproject.toml` includes only `<root>/pyproject.toml`"* — so `tests/**` means the root `tests/` directory and everything under it. The full per-backend file-selection story is **07 · Wheels vs sdists** *(not written yet)*.

For tests *inside* the package, the reverse question arises: they ship in the wheel unless excluded. With setuptools discovery, a nested `tests` subpackage is an ordinary package and is found like any other; excluding it takes a pattern over the full dotted name:

```toml
[tool.setuptools.packages.find]
where = ["src"]
exclude = ["invoice_service.tests*"]
```

## `tests/__init__.py` — the layout decides

Without it, pytest's default mode imports each test file as a top-level module, so basenames must be unique across the whole suite:

> *"Since there are no packages to derive a full package name from, `pytest` will import your test files as top-level modules. The test files in the first example (src layout) would be imported as `test_app` and `test_view` top-level modules by adding `tests/` to `sys.path`."*
> *"This results in a drawback compared to the import mode `importlib`: your test files must have **unique names**."*

The documented workaround, and its documented cost:

> *"If you need to have test modules with the same name, as a workaround you might add `__init__.py` files to your `tests` directory and subdirectories, changing them to packages"*
> *"Now pytest will load the modules as `tests.foo.test_view` and `tests.bar.test_view`, allowing you to have modules with the same name. But now this introduces a subtle problem: in order to load the test modules from the `tests` directory, pytest prepends the root of the repository to `sys.path`, which adds the side-effect that now `mypkg` is also importable."*
> *"This is problematic if you are using a tool like tox to test your package in a virtual environment, because you want to test the installed version of your package, not the local code from the repository."*

Read that against the two layouts. *"Now `mypkg` is also importable"* is true only if `mypkg` is in the repository root — the flat layout. In a src layout the root is on `sys.path` and contains nothing named `mypkg`, so the side effect is empty. Hence the practical rule:

| Layout | `tests/__init__.py` in `prepend` mode | Alternative |
|---|---|---|
| src | safe — the root holds no package | — |
| flat | 🔴 puts the checkout on `sys.path` ahead of the installation | `--import-mode=importlib`, or move to src |

## Shared helpers and fixtures

Fixtures go in `conftest.py`, which pytest discovers without an import:

> *"Important: by "test utility modules", we mean functions/classes which are imported by other tests directly; this does not include fixtures, which should be placed in `conftest.py` files, along with the test modules, and are discovered automatically by pytest."*

Helper *functions* that tests import are a layout decision, because they must be importable. Under the `importlib` import mode, a `tests.helpers` module is not:

> *"Testing utility modules in the tests directories (for example a `tests.helpers` module containing test-related functions/classes) are not importable. The recommendation in this case is to place testing utility modules together with the application/library code, for example `app.testing.helpers`."*

```text
src/invoice_service/
├── __init__.py
├── core.py
└── testing/
    ├── __init__.py
    └── factories.py        ← importable as invoice_service.testing.factories, and shipped
tests/
├── conftest.py             ← fixtures
└── test_core.py
```

Shipping a small `testing` subpackage is a deliberate, common trade: downstream projects can use your factories too.

## Pointing pytest at the right directory

```toml
[tool.pytest.ini_options]
testpaths = ["tests"]
```

> *"Useful when all project tests are in a known location to speed up test collection and to avoid picking up undesired tests by accident."*

Without it, a bare `pytest` from the root recurses into everything — `src/`, `docs/`, a vendored directory, an old `build/` tree — and can collect copies of tests from places that are not the suite.

## Gotchas

**★ Symptom: pytest errors out because two test files in different directories share a basename.** Cause: in the default `prepend` mode with no `__init__.py`, both are imported as the same top-level module name — *"pytest will raise an error if it finds two tests with the same name."* Fix: in a src layout, make the test directories packages.

```text
tests/
├── __init__.py
├── api/
│   ├── __init__.py
│   └── test_invoices.py
└── pdf/
    ├── __init__.py
    └── test_invoices.py
```

**★ Symptom: adding `tests/__init__.py` to a flat project makes the suite start testing the checkout.** Cause: pytest *"prepends the root of the repository to `sys.path`"*, which contains the flat package. Fix: leave `tests/` without `__init__.py` and use the `importlib` mode, or move the package under `src/`.

```toml
[tool.pytest.ini_options]
addopts = ["--import-mode=importlib"]
```

**★ Symptom: `from tests.helpers import make_invoice` fails after switching to `--import-mode=importlib`.** Cause: in that mode *"Testing utility modules in the tests directories … are not importable."* Fix: move helpers into the package, or turn them into fixtures in `conftest.py`.

```python
# tests/conftest.py
import pytest

from invoice_service.testing.factories import make_invoice


@pytest.fixture
def invoice() -> dict[str, str]:
    return make_invoice("INV-0042")
```

**Symptom: the wheel contains a `tests` subpackage, including fixture files a security scanner flags.** Cause: tests inlined in the package are discovered as an ordinary subpackage. Fix: exclude them from the build, or move them beside the package.

```toml
[tool.setuptools.packages.find]
where = ["src"]
exclude = ["invoice_service.tests*"]
```

**Symptom: a downstream packager reports that your sdist contains no tests.** Cause: the uv build backend's sdist includes only the module and a fixed set of root files unless told otherwise. Fix: add an anchored `source-include`.

```toml
[tool.uv.build-backend]
source-include = ["tests/**"]
```

**Symptom: a bare `pytest` collects tests twice, or from `build/` or `docs/`.** Cause: without `testpaths`, pytest recurses from the root into every directory. Fix: name the test directory.

```toml
[tool.pytest.ini_options]
testpaths = ["tests"]
```

**Symptom: `pytest --pyargs invoice_service` finds no tests.** Cause: `--pyargs` collects from where the package is *installed*; either it is not installed in this environment, or the tests are beside the package rather than inside it. Fix: install the project, and use `--pyargs` only with inlined tests.

```bash
uv sync
uv run pytest --pyargs invoice_service
```

**Symptom: a helper module under `tests/` is importable locally and not in the release-guard job.** Cause: locally, something — a `tests/__init__.py`, a root `conftest.py`, or a flat editable install — puts the root on `sys.path`; the guard job does not. Fix: helpers that tests import belong in the package or in `conftest.py`, never on an accidental path.

```python
from invoice_service.testing.factories import make_invoice
```

## Interview questions

**★ Tests beside the package or inside it — what decides?**
Whether the tests should ship. Beside the package — `tests/` next to `src/` — is the default: tests do not go into the wheel, and the same suite runs against an editable install in development and a regular install in CI. Inside the package suits a library whose users or redistributors should be able to verify an installation with `pytest --pyargs mypkg`, at the cost of shipping test code and any fixtures with it.

**★ Should `tests/` have an `__init__.py`?**
It depends on the layout and the import mode. In the default `prepend` mode, without `__init__.py` every test file must have a unique basename; with it, names can repeat but pytest inserts the repository root into `sys.path`. In a src layout that is harmless because the root contains no package. In a flat layout it puts the checkout ahead of the installation. So: src layout, add it freely; flat layout, prefer `--import-mode=importlib` instead.

**Do tests end up in the sdist and the wheel?**
Tests beside the package never reach the wheel with any mainstream backend. The sdist depends on the backend: setuptools includes `tests/test*.py` by default, hatchling includes whatever the VCS does not ignore, and the uv backend includes neither unless you add a `source-include` pattern. Tests inside the package are part of the package and reach both artifacts unless excluded.

**Where should shared test helpers go?**
Fixtures in `conftest.py`, which pytest discovers without importing. Helper functions that tests import either in the package — pytest's docs suggest something like `app.testing.helpers` — or, under `prepend` mode, in a `tests` package. The one place they should not depend on is an implicit `sys.path` entry, because the helpers then import in one environment and not another.

**What does `pytest --pyargs mypkg` do, and when is it useful?**
It treats the argument as an importable package name rather than a path, finds where that package is installed, and collects tests from there. It is useful with inlined tests, because it runs the installed copy's tests against the installed copy — the exact thing a src layout and a regular install are trying to guarantee.

---

← Prev: [04 · Editable installs and layout](04-editable-installs-reopen-the-hole.md) · [Topic index](README.md) · Next → [06 · pytest import modes](06-pytest-import-modes.md)
