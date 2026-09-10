---
title: "The wrong-copy bug, built end to end — a subpackage the wheel never contained, a CI job that installed the wheel and then tested the checkout instead, and a release that fails on the first import"
sidebar_label: "03 · The wrong-copy bug"
sidebar_position: 3
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-10 · target **Python 3.14.7** · against PyPUG *src layout vs flat layout* ([packaging.python.org](https://packaging.python.org/en/latest/discussions/src-layout-vs-flat-layout/)), setuptools *Package Discovery* ([setuptools.pypa.io](https://setuptools.pypa.io/en/latest/userguide/package_discovery.html)), the CPython 3.14 docs — [`sys.path`](https://docs.python.org/3.14/library/sys.html#sys.path), *The import system* ([docs.python.org](https://docs.python.org/3.14/reference/import.html)) — and pytest *pytest import mechanisms and `sys.path`/`PYTHONPATH`* ([docs.pytest.org](https://docs.pytest.org/en/stable/explanation/pythonpath.html)).
> Documentation-validated — **no sandbox run**. The one error string on this page is CPython's standard `ModuleNotFoundError` form; nothing here is captured output.

**Everyone has heard that the src layout "prevents importing the wrong copy". Almost nobody has watched it happen, so it stays abstract. This chunk builds the bug on purpose: a flat project whose build configuration quietly leaves a subpackage out of the wheel, a CI job that does the responsible thing — builds and installs the package — and a test suite that passes anyway because every import resolved to the working copy. Then the release. Every step is traced through the documented rules from [02](02-sys-path-zero.md), so you can see exactly where the installed copy was bypassed and why no amount of test coverage could have noticed.**

## The project

A flat setuptools project that has just grown a PDF renderer in a new subpackage:

```text
invoice-service/
├── pyproject.toml
├── invoice_service/
│   ├── __init__.py
│   ├── core.py
│   └── pdf/                 ← new this sprint
│       ├── __init__.py
│       └── render.py
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
include = ["invoice_service"]      # 🔴 matches the top-level package only
```

```python
# invoice_service/pdf/render.py
def render(invoice_number: str) -> bytes:
    return f"%PDF-1.7 invoice {invoice_number}".encode()
```

```python
# tests/test_pdf.py
from invoice_service.pdf.render import render


def test_render_includes_the_number() -> None:
    assert b"INV-0042" in render("INV-0042")
```

## The configuration mistake

The `include` line was written months ago, when the package had no subpackages, to stop a stray top-level directory being packaged. It looks like it says "the `invoice_service` package". setuptools reads it as a pattern over *full* dotted names:

> *"`include` and `exclude` accept strings representing glob patterns. These patterns should match the **full** name of the Python module (as if it was written in an `import` statement)."*

> *"For example if you have `util` pattern, it will match `util/__init__.py` but not `util/files/__init__.py`."*

> *"The fact that the parent package is matched by the pattern will not dictate if the submodule will be included or excluded from the distribution. You will need to explicitly add a wildcard (e.g. `util*`) if you want the pattern to also match submodules."*

So the discovered package list is `invoice_service` — and not `invoice_service.pdf`. The wheel will contain `invoice_service/__init__.py` and `invoice_service/core.py`, and no `pdf/` directory at all. Nothing warns: a pattern that matches fewer packages than you meant is not an error.

## The CI job

A careful job. It does not test the raw checkout; it builds and installs the package first:

```bash
python -m venv .venv
. .venv/bin/activate
python -m pip install .          # build the wheel through the backend, install it
python -m pip install pytest
python -m pytest
```

## What happens, step by step

1. **`pip install .` builds a wheel from the declared configuration** and installs it into `.venv/lib/python3.14/site-packages/`. That installed `invoice_service/` has no `pdf/` subpackage. The environment now contains a correct copy of a broken package.
2. **`python -m pytest` starts.** Because this is the `-m` form, the current directory — the repository root — is prepended to `sys.path`: *"`python -m module` command line: prepend the current working directory."*
3. **pytest collects `tests/test_pdf.py`.** In its default `prepend` import mode, with no `__init__.py` in `tests/`, it inserts `tests/` at the front of `sys.path` so it can import the file as the top-level module `test_pdf`. The front of `sys.path` is now roughly `tests/`, then the repository root, then — much later — site-packages.
4. **The test module runs `from invoice_service.pdf.render import render`.** The import system checks `sys.modules` first — *"The first place checked during import search is `sys.modules`"* — and misses.
5. **The path-based finder walks `sys.path` in order.** `tests/` has no `invoice_service`. The repository root does: `./invoice_service/__init__.py`. The search stops there. The copy in site-packages is never consulted.
6. **`invoice_service.pdf` is looked up through the parent's `__path__`**, which is `[<repo>/invoice_service]` — the checkout. `pdf/` exists on disk there, so it imports.
7. **The test passes.** It exercised real code that really works — code that is not in the artifact.

The PyPUG sentence that describes all seven steps:

> *"This means that if an import package exists in the current working directory with the same name as an installed import package, the variant from the current working directory will be used. This can lead to subtle misconfiguration of the project's packaging tooling, which could result in files not being included in a distribution."*

## What the user sees

The wheel is published. A consumer installs it and makes the same import the test made:

```python
from invoice_service.pdf.render import render
```

and gets `ModuleNotFoundError: No module named 'invoice_service.pdf'`. There is no checkout on their machine to fall back on — the only copy is the one the backend built.

## Why no amount of testing would have caught it

It is tempting to read this as a coverage gap. It is not: `test_pdf.py` *did* import the missing module and *did* exercise it. The test was structurally unable to observe the artifact, because the process that ran it had the checkout ahead of site-packages. Adding tests only adds more passing imports from the same wrong copy. The information that would have revealed the bug — the file list of the installed package — was present in the environment the whole time and shadowed by a directory nobody chose to put on the path.

That is also why the bug survives code review. The diff that introduced `pdf/` touched no packaging configuration, and the diff that wrote `include = ["invoice_service"]` was correct when it was written.

## The same bug with a data file

The subpackage is the cleanest case because it fails at import. The more common version involves a non-Python file:

```text
invoice_service/
├── __init__.py
├── core.py
└── templates/
    └── invoice.html
```

```python
# invoice_service/core.py
from pathlib import Path

TEMPLATE = Path(__file__).parent / "templates" / "invoice.html"


def render_html(invoice_number: str) -> str:
    return TEMPLATE.read_text().replace("{{ number }}", invoice_number)
```

In the checkout, `Path(__file__).parent` is the working copy's `invoice_service/`, where the template exists on disk, so every test passes. Whether the *wheel* contains `templates/invoice.html` is a separate question answered by the backend's file-selection rules. setuptools, for instance, lists the files it puts in an sdist by default — Python modules of the discovered packages, `README`, `LICEN[CS]E*` and a handful of others — and adds package data only when told to, and it warns that *"when using `include_package_data=True`, only files **inside the package directory** are included in the final `wheel`, by default."* An HTML file nobody declared is the kind of file that is present on disk and absent from the artifact. The user's `read_text()` then fails on a missing file. The fix is to declare it:

```toml
[tool.setuptools.package-data]
invoice_service = ["templates/*.html"]
```

Other backends select files differently — hatchling ships what your VCS does not ignore, and the uv backend ships the whole module directory — so the exact file that goes missing varies. The mechanism that hides it does not. Which files each backend puts in each artifact is **07 · Wheels vs sdists** *(not written yet)*; the layout's only job here is to make sure the test run uses the result.

## The inverse: works installed, fails in the checkout

The wrong copy is not always the more complete one. A project with a compiled extension has a built module in its wheel that does not exist as a file in the checkout until someone builds it in place. In a flat layout, `python -m pytest` from the root imports the checkout's package, which lacks the compiled module, and the tests fail on an import that works perfectly for every user. Developers then learn to build in place or to run from a different directory — both are workarounds for the same first-match rule. A src layout plus an installed package removes the checkout from the search entirely, so what is imported is what was built.

## Metadata and code can disagree

A flat checkout shadows the installed *code*, but not the installed *metadata*. `importlib.metadata` finds distribution metadata — the `.dist-info` directory — in the installed environment, because a plain checkout has none of its own:

```python
from importlib.metadata import version

import invoice_service

print(version("invoice-service"))   # read from the installed .dist-info
print(invoice_service.__file__)     # may be the checkout's copy
```

In the scenario above those two lines describe different things: the version of the wheel that was installed, and the location of code that was never in it. A `--version` flag or a startup log line that reports the metadata version is then confidently reporting a release that is not what is running.

There is a second twist for setuptools projects. setuptools documents that it *"automatically creates a few directories to host build artefacts and cache files, such as `build`, `dist`, `*.egg-info`"*, and an in-tree build can leave an `invoice_service.egg-info/` directory in the root of a flat project. That is a metadata directory sitting in a `sys.path` entry that precedes site-packages, so the metadata lookup can reach a stale build artefact first. Either way, the version you read and the code you run came from two different searches.

## Gotchas

**★ Symptom: CI is green, the published wheel fails with `ModuleNotFoundError` on a subpackage.** Cause: a `packages.find` `include` pattern without a wildcard matches the top-level package only, and a flat-layout test run imported the checkout, which has the subpackage on disk. Fix: include submodules explicitly — and move to a src layout so the next such mistake fails in CI.

```toml
[tool.setuptools.packages.find]
include = ["invoice_service*"]
```

**★ Symptom: a template, JSON schema or other data file is missing for users and present in every test.** Cause: the file exists in the checkout next to the code, the backend's file selection did not include it in the wheel, and `Path(__file__)` in a flat-layout test run points into the checkout. Fix: declare the data for your backend.

```toml
[tool.setuptools.package-data]
invoice_service = ["templates/*.html"]
```

**★ Symptom: the fix above was made, and you have no evidence it worked.** Cause: the same flat test run would pass with or without it. Fix: look inside the artifact rather than at the checkout — the standard library can list a wheel's contents.

```bash
python -m pip wheel . --no-deps -w dist
python -m zipfile -l dist/invoice_service-0.5.0-py3-none-any.whl
```

**Symptom: tests fail on an import in the checkout that works for every user.** Cause: the inverse wrong copy — a compiled or generated module exists only in the built artifact, and a flat-layout run from the root imports the incomplete checkout. Fix: test the installed package with the checkout off the path.

```bash
python -m pip install .
python -P -m pytest
```

**Symptom: the application reports version `0.5.0` in its logs while running code that is not in `0.5.0`.** Cause: `importlib.metadata.version()` reads installed metadata, while the flat checkout supplied the code. Fix: log where the code came from alongside the version when diagnosing.

```python
import logging
from importlib.metadata import version

import invoice_service

logging.getLogger(__name__).info(
    "invoice-service %s loaded from %s", version("invoice-service"), invoice_service.__file__
)
```

**Symptom: someone "fixes" the failing user report by adding the missing subpackage to `packages` by hand, and the next new subpackage goes missing too.** Cause: an explicit list must be maintained per subpackage; the pattern that caused the bug is still there in spirit. Fix: let discovery find everything under a root, and constrain it by the root rather than by names.

```toml
[tool.setuptools.packages.find]
where = ["src"]
```

## Interview questions

**★ Walk through how a flat-layout project can pass CI and ship a broken wheel.**
The build configuration omits something — here, a `packages.find` pattern with no wildcard drops a new subpackage. CI builds and installs the wheel, so site-packages holds the broken package. Then `python -m pytest` prepends the repository root to `sys.path`, the path finder reaches the root before site-packages, and `import invoice_service` resolves to the checkout. Submodules are found through that package's `__path__`, so the missing subpackage is imported from disk. Every test passes against code the wheel does not contain, and the first user import fails.

**★ Why can't more tests catch this?**
Because the tests already import and exercise the missing module; the problem is where they import it from. The process has the checkout ahead of the installed package on `sys.path`, so the artifact is never loaded. More tests are more imports from the same wrong copy. The fix is to change what is importable — the src layout — not how much is tested.

**Why does the import never mix the checkout's `invoice_service` with the installed `invoice_service.pdf`?**
Because only the top-level name is searched on `sys.path`. Once `invoice_service` is found, its submodules are searched in its `__path__`, which lists the directory it was loaded from. The installed copy's directory is not on that list, so every submodule comes from the same copy as the parent — and the result is cached in `sys.modules` for the rest of the process.

**What is the inverse form of the bug, and who hits it?**
Projects with compiled extensions or generated modules. The built wheel contains a module that does not exist as a file in the checkout, so a flat-layout test run from the root imports the checkout and fails on something that works for users. It is the same first-match rule; the checkout is simply the less complete copy this time.

**How do you prove a packaging fix actually changed the artifact?**
Inspect the artifact. Build the wheel and list its contents — `python -m zipfile -l` on the `.whl` — or install it into a fresh environment and run the tests with the checkout off the path. Re-running a flat-layout test suite proves nothing, because it passed before the fix as well.

**Why can `importlib.metadata.version()` report a version that is not what is running?**
Metadata is read from the installed distribution's `.dist-info`, and a flat checkout has none, so the lookup reaches site-packages. The code, meanwhile, can come from the checkout because the working directory precedes site-packages for `import`. The two lookups use different data sources, and a flat layout lets them disagree.

**★ Without migrating to src, what is the cheapest CI change that would have caught this?**
Make the test run unable to see the checkout: install the wheel into a fresh environment, then run the suite with nothing from the repository root on `sys.path` — plain `pytest` rather than `python -m pytest` (or `python -P -m pytest`), no `tests/__init__.py`, no root `conftest.py`, no `pythonpath` entry for the root. Each of those conditions is fragile, which is the argument for the src layout: it makes the same guarantee without depending on four details of the invocation. Running the suite from a different directory — what tox's `changedir` exists for — is the other classic workaround.

**Why does this bug survive code review?**
Because no single diff contains it. The `include` pattern was correct when it was written, months before the subpackage existed; the diff that added `pdf/` touched no packaging configuration; and the CI log shows the new test passing. The defect lives in the interaction between a file-selection rule and a directory added later, and the only thing that would reveal it — the wheel's file list — is not part of any review.

---

← Prev: [02 · sys.path zero](02-sys-path-zero.md) · [Topic index](README.md) · Next → [03b · How the src layout catches it](03b-how-the-src-layout-catches-it.md)
