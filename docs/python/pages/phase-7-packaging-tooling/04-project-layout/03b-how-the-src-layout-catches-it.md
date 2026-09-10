---
title: "Move the package one directory down, change nothing else, and the same CI job fails — at collection, in the right job, before the release — because no directory Python adds on its own now contains anything called invoice_service"
sidebar_label: "03b · How src catches it"
sidebar_position: 4
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-10 · target **Python 3.14.7** · against PyPUG *src layout vs flat layout* ([packaging.python.org](https://packaging.python.org/en/latest/discussions/src-layout-vs-flat-layout/)), setuptools *Package Discovery* ([setuptools.pypa.io](https://setuptools.pypa.io/en/latest/userguide/package_discovery.html)), pytest *Good Integration Practices* ([docs.pytest.org](https://docs.pytest.org/en/stable/explanation/goodpractices.html)) and *Configuration* reference ([docs.pytest.org](https://docs.pytest.org/en/stable/reference/reference.html)), the CPython 3.14 import system ([docs.python.org](https://docs.python.org/3.14/reference/import.html)), and the uv build backend ([docs.astral.sh](https://docs.astral.sh/uv/concepts/build-backend/)).
> Documentation-validated — **no sandbox run**; the only error string is CPython's standard `ModuleNotFoundError` form.

**[03](03-the-wrong-copy-bug.md) built a flat project that shipped a wheel without its `pdf` subpackage while CI stayed green. This chunk replays the identical build configuration and the identical CI job with the package moved under `src/`. The mistake in `pyproject.toml` is still there; the test that imports the missing subpackage is still there. The only change is that the repository root no longer contains a directory named `invoice_service` — and that is enough to make the job fail at the moment it should. Then it covers the three common ways teams undo the protection without noticing, and why the src layout also makes most of setuptools' `include` patterns unnecessary.**

## The same project, one level down

```text
invoice-service/
├── pyproject.toml
├── src/
│   └── invoice_service/
│       ├── __init__.py
│       ├── core.py
│       └── pdf/
│           ├── __init__.py
│           └── render.py
└── tests/
    ├── test_core.py
    └── test_pdf.py
```

```toml
[build-system]
requires = ["setuptools >= 77.0.3"]
build-backend = "setuptools.build_meta"

[project]
name = "invoice-service"
version = "0.5.0"
requires-python = ">=3.12"

[tool.setuptools.packages.find]
where = ["src"]
include = ["invoice_service"]      # 🔴 the same mistake, deliberately kept
```

The CI job is character-for-character the one from [03](03-the-wrong-copy-bug.md):

```bash
python -m venv .venv
. .venv/bin/activate
python -m pip install .
python -m pip install pytest
python -m pytest
```

## The replay

1. **`pip install .` builds the same broken wheel** — `invoice_service` without `invoice_service.pdf` — and installs it into site-packages.
2. **`python -m pytest` prepends the repository root to `sys.path`**, exactly as before.
3. **pytest inserts `tests/`** at the front to import `test_pdf` as a top-level module, exactly as before.
4. **`from invoice_service.pdf.render import render`** misses `sys.modules`, and the path finder walks `sys.path`.
5. **`tests/` has no `invoice_service`. The repository root has `src/`, `tests/` and `pyproject.toml` — no `invoice_service` either.** The search continues past both.
6. **site-packages has `invoice_service/__init__.py`.** That is the installed copy, and it is imported.
7. **`invoice_service.pdf` is looked up through that package's `__path__`** — the site-packages directory — and is not there.
8. **Collection fails with `ModuleNotFoundError: No module named 'invoice_service.pdf'`.** CI goes red, in the job that built the wheel, before anything is published.

PyPUG's claim, now observable:

> *"The src layout helps avoid this by keeping import packages in a directory separate from the root directory of the project, ensuring that the installed copy is used."*

## What actually made the difference

Not pytest's import mode, not `python -m` versus `pytest`, not the directory CI started in. Every one of those is unchanged from the flat run. The difference is that **the set of directories Python adds implicitly no longer contains a same-named package**, so every invocation resolves the same way:

| Invocation | Flat layout | src layout |
|---|---|---|
| `python -m pytest` from the root | checkout | installed |
| `pytest` from the root | installed, *unless* pytest inserts the root ([06](06-pytest-import-modes.md)) | installed |
| `pytest` with `tests/__init__.py` present | checkout — the root is inserted | installed — the root has nothing to find |
| `python -c "import invoice_service"` | checkout | installed |
| run from `tests/` | installed | installed |

In the flat column the answer depends on four independent facts about the invocation. In the src column it depends on none of them. That is the whole value of the layout: it turns "was this run correct?" from a question about how the run was started into a question about what was installed.

## Fixing the configuration, now that it can fail

With the package isolated under `src/`, the reason the `include` line existed — keeping stray top-level directories out of the distribution — is gone. setuptools says so directly:

> *"This layout is very handy when you wish to use automatic discovery, since you don't have to worry about other Python files or folders in your project root being distributed by mistake."*

So the right fix is not a wildcard; it is deleting the table. Automatic discovery runs only when you configure nothing:

> *"Automatic discovery will **only** be enabled if you **don't** provide any configuration for `packages` and `py_modules`. If at least one of them is explicitly set, automatic discovery will not take place."*

```toml
[build-system]
requires = ["setuptools >= 77.0.3"]
build-backend = "setuptools.build_meta"

[project]
name = "invoice-service"
version = "0.5.1"
requires-python = ">=3.12"
# no [tool.setuptools.packages.find] — src-layout auto-discovery finds every package under src/
```

The uv build backend never had this failure mode in the first place: it ships the *module* — the whole directory at `src/<package_name>/` — rather than a list of discovered packages, so a new subpackage cannot be left out by a pattern. What it can still leave out is a file you excluded, and what it cannot protect you from is testing a copy other than the one it built. The layout is what closes that second gap for every backend.

## Three ways to put the hole back

**1 · An editable install.** `uv sync` installs the project editable by default, and `pip install -e .` does the same thing by hand. An editable install points the environment back at your source tree — in its simplest form by putting `src/` on the path — so `invoice_service.pdf` can be importable from disk again whether or not the wheel would contain it. setuptools documents that an editable install exposes *"at least"* what a regular one would, and possibly more. This is the one that catches careful teams, and it gets its own chunk: [04](04-editable-installs-reopen-the-hole.md).

**2 · Putting `src/` on the path yourself.** pytest documents both forms — ad hoc and permanent — for running a src layout without installing:

> *"If you do not use an editable install and use the `src` layout as above you need to extend the Python's search path for module files to execute the tests against the local copy directly. You can do it in an ad-hoc manner by setting the `PYTHONPATH` environment variable"*

```toml
[tool.pytest.ini_options]
pythonpath = ["src"]      # 🔴 the tests now import src/ from disk — a flat layout by configuration
```

The `pythonpath` value is defined as *"Directories will be added to the head of `sys.path`"*. That is a legitimate choice for a project that is never built. For a project that ships a wheel it re-creates the flat layout's behaviour in configuration, where it is harder to spot.

**3 · Importing through `src`.** A `src/__init__.py` plus an IDE that auto-completes `from src.invoice_service…` gives you an import that only the checkout can satisfy. See [01](01-flat-and-src-layout.md).

## The data-file version, under src

The template case from [03](03-the-wrong-copy-bug.md) is caught the same way, provided the code finds its data relative to the package rather than the repository. `Path(__file__).parent` inside an installed package points into site-packages, so a template the wheel does not contain is missing in CI. Better still, the standard library's resource API asks the *package* for its file and so works identically for a wheel, an editable install, or a zip:

```python
# src/invoice_service/core.py
from importlib.resources import files


def render_html(invoice_number: str) -> str:
    template = (files("invoice_service") / "templates" / "invoice.html").read_text()
    return template.replace("{{ number }}", invoice_number)
```

A path built from the repository — `Path("invoice_service/templates/invoice.html")`, relative to the working directory — works in exactly one place, the checkout, and is the data-file equivalent of `from src.… import`.

## Gotchas

**★ Symptom: the project moved to src, and the missing-subpackage bug still reached a release.** Cause: CI ran the tests through an editable install — the default for `uv sync` and `uv run` — so the tests imported `src/` from disk. Fix: in the job that guards releases, install the project non-editable before testing.

```bash
uv run --no-editable pytest
```

**★ Symptom: `pythonpath = ["src"]` is in the pytest config and nobody remembers adding it.** Cause: it was the quickest way to make an uninstalled src project importable, and it makes every run test the checkout. Fix: delete it and let the environment provide the package.

```toml
[tool.pytest.ini_options]
testpaths = ["tests"]
# pythonpath removed — `uv sync` installs the project
```

**Symptom: after moving to src, CI fails at collection with `ModuleNotFoundError: No module named 'invoice_service'`.** Cause: the CI job never installed the project; the flat layout had been hiding that. Fix: add the install step.

```bash
uv sync --locked
uv run pytest
```

**★ Symptom: after `git mv invoice_service src/invoice_service`, an uninstalled environment imports `invoice_service` successfully and then fails on `invoice_service.core`.** Cause: ignored files such as `__pycache__/` stayed behind in the old `invoice_service/` directory, which now has no `__init__.py` and is therefore importable as an empty namespace package. Fix: remove the leftover directory, then install.

```bash
git status --ignored --short invoice_service/
rm -rf invoice_service/
uv sync
```

**Symptom: a data file loads in the checkout and fails after the move, or only on some machines.** Cause: the path was built from the working directory or the repository, not from the package. Fix: ask the package for its resource.

```python
from importlib.resources import files

schema = (files("invoice_service") / "schemas" / "invoice.json").read_text()
```

**Symptom: the `include` pattern was fixed with a wildcard and a helper package under `src/` is now shipped too.** Cause: `invoice_service*` also matches a sibling like `invoice_service_devtools`. Fix: in a src layout, let auto-discovery take the whole of `src/`, and keep non-shipping code out of `src/` altogether.

```text
invoice-service/
├── src/invoice_service/        shipped
└── tools/devtools.py           not shipped, not under src/
```

## Interview questions

**★ Why does moving the package into `src/` make the same CI job fail?**
Because the failure depended on the repository root containing a directory with the package's name. `python -m pytest` still prepends the root and pytest still inserts `tests/`, but neither directory contains `invoice_service` any more, so the path finder reaches site-packages and imports the installed copy. That copy was built from the faulty configuration, so the missing subpackage now fails to import in CI rather than for users.

**★ Name the ways a team can adopt the src layout and still test the checkout.**
An editable install, which puts `src/` on the path through the environment — the default in `uv sync`. A `PYTHONPATH=src` or pytest `pythonpath = ["src"]` setting, which puts it there explicitly. A `src/__init__.py` with imports written as `from src.invoice_service …`, which only the checkout can satisfy. And loading data files by repository-relative path. All four route imports or file reads back to the working copy.

**Why does the src layout make setuptools' `include` and `exclude` patterns largely unnecessary?**
Those patterns exist mostly to stop things in the project root — `tools/`, `scripts/`, a stray module — from being packaged by automatic discovery. With the package under `src/`, discovery looks only there, and setuptools says the src layout means you *"don't have to worry about other Python files or folders in your project root being distributed by mistake."* Deleting the table restores auto-discovery, which picks up every package under `src/`, including subpackages added later.

**Does the src layout guarantee your wheel is correct?**
No. It guarantees that a test run with a *regular* installation imports what was installed. If you only ever test through an editable install, or never build and install the package in CI at all, the layout protects nothing. It turns a correct test run from an accident of invocation into a property of the environment — you still have to build that environment from the artifact.

**Why prefer `importlib.resources.files()` over `Path(__file__)` for package data?**
Both are package-relative, which is the important part; the difference is that `files()` asks the package's loader for the resource, so it works whether the package was installed from a wheel, installed editable, or imported from a zip. `Path(__file__)` assumes the package is a directory of real files. Either is far better than a path relative to the working directory, which only resolves inside the checkout.

**What would you look for in a pull request to spot the protection being undone?**
Any change that puts the source tree back on the import path or routes imports through it: a new `pythonpath` entry naming `src` or `.` in the pytest configuration, a `PYTHONPATH` in a CI job or Makefile, a `src/__init__.py`, an import written as `from src.…`, a `sys.path.insert` in a `conftest.py`, or a CI job that switched from a regular install to `uv sync` alone. Each is a one-line change that makes every later test run import from disk again.

---

← Prev: [03 · The wrong-copy bug](03-the-wrong-copy-bug.md) · [Topic index](README.md) · Next → [04 · Editable installs reopen the hole](04-editable-installs-reopen-the-hole.md)
