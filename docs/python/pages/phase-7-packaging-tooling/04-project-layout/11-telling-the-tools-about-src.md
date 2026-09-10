---
title: "Tools that locate code by path — coverage, the type checker, the linter's first-party detection — need to know the package lives in src/ and may run from site-packages; ruff already assumes it, coverage and mypy need a line each"
sidebar_label: "11 · Telling the tools about src"
sidebar_position: 13
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-10 · target **ruff 0.16.6**, **Python 3.14.7** · against ruff settings `src` and `namespace-packages` ([docs.astral.sh](https://docs.astral.sh/ruff/settings/#src)), coverage.py *Configuration reference* ([coverage.readthedocs.io](https://coverage.readthedocs.io/en/latest/config.html)) and *Specifying source files* ([coverage.readthedocs.io](https://coverage.readthedocs.io/en/latest/source.html)), and mypy *Running mypy and managing imports* ([mypy.readthedocs.io](https://mypy.readthedocs.io/en/stable/running_mypy.html#mapping-file-paths-to-modules)). coverage.py and mypy are not pinned in this phase's spine; their pages were read at their current documentation state.
> Documentation-validated — **no sandbox run, no program output**.

**The interpreter finds your package by import name; many tools find it by *path*. After a move to `src/`, those path-based tools have two new facts to cope with: the source lives one directory down, and in a release-guard job the code that actually runs is a copy in site-packages, not the file in `src/`. ruff's default already covers the first fact. coverage.py handles the second only if you measure by package name and tell it which paths are the same file. mypy needs to know where package roots start. None of this is hard; all of it is invisible until a report comes back empty.**

## ruff: first-party detection

ruff's import sorting and several rules need to know which imports are *your* code. It decides with the `src` setting:

> *"The directories to consider when resolving first- vs. third-party imports."*

> *"When omitted, the `src` directory will typically default to including both: 1. The directory containing the nearest `pyproject.toml`, `ruff.toml`, or `.ruff.toml` file (the "project root"). 2. The `"src"` subdirectory of the project root."*

> *"These defaults ensure that Ruff supports both flat layouts and `src` layouts out-of-the-box."*

Default `[".", "src"]`. So for either standard layout, **configure nothing**. You touch it for a non-standard directory — ruff's own example is a `lib/` directory:

> *"In this case, the `./lib` directory should be included in the `src` option (e.g., `src = ["lib"]`), such that when resolving imports, `my_package.foo` is considered first-party."*

and for several source roots, which is what a workspace looks like ([13](13-workspaces-as-a-layout.md)):

> *"This field supports globs. For example, if you have a series of Python packages in a `python_modules` directory, `src = ["python_modules/*"]` would expand to incorporate all packages in that directory."*

```toml
[tool.ruff]
src = ["src", "packages/*/src"]
```

Lint configuration generally is **05 · ruff** *(not written yet)*.

## coverage.py: measure the package, map the paths

The layout problem for coverage is the release-guard job from [04](04-editable-installs-reopen-the-hole.md). There, `invoice_service` is imported from `.venv/lib/python3.14/site-packages/invoice_service/`, not from `src/invoice_service/`. A configuration that names the *directory* measures the wrong place:

> *"If the source option is specified, only code in those locations will be measured."*

`[run] source` accepts either:

> *"A list of packages or directories, the source to measure during execution. If set, `include` is ignored."*

and a sibling exists precisely to remove the ambiguity:

> *"A list of packages, the source to measure during execution. Operates the same as `source`, but only names packages, for resolving ambiguities between packages and directories."* — `source_pkgs`, added in coverage 5.3.

Measuring by package name follows the import to wherever it resolves — `src/` under an editable install, site-packages under a regular one. The data then records whichever path ran, and `[paths]` tells the report which paths are the same file:

> *"The entries in this section are lists of file paths that should be considered equivalent when combining data from different machines"*

> *"The first value must be an actual file path on the machine where the reporting will happen, so that source code can be found. The other values can be file patterns to match against the paths of collected data, or they can be absolute or relative file paths on the current machine."*

```toml
[tool.coverage.run]
source_pkgs = ["invoice_service"]

[tool.coverage.paths]
source = [
    "src/",                  # first: where the source really is, on the reporting machine
    "*/site-packages/",      # then: where it may have run
]
```

The `*/site-packages/` entry is an application of the documented pattern mechanism, not an example copied from coverage's docs — their example remaps CI build directories. Two further documented details apply: *"Remapping will also be done during reporting, but only within the single data file being reported"*, and combining several files requires the `combine` command.

One more consequence of measuring by name, documented in a note:

> *"Modules named as sources may be imported twice, once by coverage.py to find their location, then again by your own code or test suite. Usually this isn't a problem, but could cause trouble if a module has side-effects at import time."*

## mypy: where package roots start

mypy maps file paths to module names itself, and adds the directory *above* the top package to its search path:

> *"For each file to be checked, mypy will attempt to associate the file (e.g. `project/foo/bar/baz.py`) with a fully qualified module name (e.g. `foo.bar.baz`). The directory the package is in (`project`) is then added to mypy's module search paths."*

For a src layout the docs give the instruction directly:

> *"For example, suppose you are trying to add the module `foo.bar.baz` which is located at `~/foo-project/src/foo/bar/baz.py`. In this case, you must run `mypy ~/foo-project/src` (or set the `MYPYPATH` to `~/foo-project/src`)."*

In configuration:

```toml
[tool.mypy]
files = ["src", "tests"]
mypy_path = "src"
```

and for a namespace package with no `__init__.py` at the top, the documented invocation:

```bash
MYPYPATH=src mypy --namespace-packages --explicit-package-bases .
```

Type-checker configuration in depth belongs to **Phase 6 — Typing** *(not written yet)*.

## pytest

Covered in [06](06-pytest-import-modes.md) and [06b](06b-rootdir-and-pythonpath.md). The src-layout configuration is short because the correct amount of path configuration is none:

```toml
[tool.pytest.ini_options]
testpaths = ["tests"]
addopts = ["--import-mode=importlib"]
```

## Gotchas

**★ Symptom: coverage is healthy locally and near zero in the release-guard job.** Cause: `source = ["src"]` names a directory, and in that job the code ran from site-packages — *"only code in those locations will be measured"*. Fix: measure the package by name and map the paths.

```toml
[tool.coverage.run]
source_pkgs = ["invoice_service"]

[tool.coverage.paths]
source = ["src/", "*/site-packages/"]
```

**★ Symptom: the coverage report lists files under `.venv/lib/python3.14/site-packages/…` instead of `src/…`.** Cause: data was collected from the installed copy and no `[paths]` mapping says those files are the ones in `src/`. Fix: add the mapping, with the real source path first.

```toml
[tool.coverage.paths]
source = ["src/", "*/site-packages/"]
```

**Symptom: the `[paths]` mapping does nothing.** Cause: the first entry must be *"an actual file path on the machine where the reporting will happen"*; a pattern or a CI-only path in first position has nowhere to map to. Fix: put the local source directory first.

```toml
[tool.coverage.paths]
source = ["src/", "/home/runner/work/*/src/", "*/site-packages/"]
```

**Symptom: in a flat project, `source = ["invoice_service"]` measures the checkout while the tests exercised the installed package.** Cause: `invoice_service` is both a directory in the root and a package name, and `source` accepts either. Fix: say which you mean.

```toml
[tool.coverage.run]
source_pkgs = ["invoice_service"]
```

**Symptom: a module-level side effect — a connection, a log line, a registration — happens twice under coverage.** Cause: *"Modules named as sources may be imported twice, once by coverage.py to find their location, then again by your own code or test suite."* Fix: move the side effect out of import time.

```python
# src/invoice_service/db.py
import sqlite3
from functools import cache


@cache
def connection() -> sqlite3.Connection:
    return sqlite3.connect("invoices.db")
```

**★ Symptom: ruff sorts `invoice_service` imports into the third-party block.** Cause: the package lives somewhere other than the root or `src/` — a `lib/` directory — so the default `src` does not cover it. Fix: name the directory.

```toml
[tool.ruff]
src = ["lib"]
```

**Symptom: in a workspace, ruff treats sibling members' packages as third-party.** Cause: the default covers only the project root and its `src/`. Fix: a glob for every member's source root.

```toml
[tool.ruff]
src = ["src", "packages/*/src"]
```

**Symptom: `mypy tests` reports `invoice_service` as a missing module.** Cause: mypy maps paths itself, and nothing told it `src/` is a package root. Fix: set the search path.

```toml
[tool.mypy]
files = ["src", "tests"]
mypy_path = "src"
```

## Interview questions

**★ Why does coverage need extra configuration in a src layout?**
Because coverage can select code by directory or by package, and in a src layout those diverge. Under an editable install the package runs from `src/`; under a regular install — the release-guard job — it runs from site-packages. Naming the directory measures only one of those. Naming the package with `source_pkgs` measures it wherever it runs, and a `[paths]` section tells the report that the site-packages files are the files in `src/`, so line numbers land on the source.

**What does ruff's `src` setting do, and when do you change it?**
It lists the directories ruff uses to decide which imports are first-party. The default is the project root plus its `src/` subdirectory, which ruff describes as supporting both flat and src layouts out of the box. You change it only for a non-standard source directory, such as `lib/`, or for several source roots, which it supports with globs like `packages/*/src`.

**What is the difference between coverage's `source` and `source_pkgs`?**
`source` accepts packages or directories and must guess which you meant. `source_pkgs` accepts only package names, which coverage added *"for resolving ambiguities between packages and directories"*. In a flat layout the ambiguity is literal — the package name is also a directory in the root — and the difference decides whether you measure the checkout or the installed copy.

**How do you point mypy at a src-layout project?**
Tell it where the package roots are: either run it on `src` or set `mypy_path = "src"` (or `MYPYPATH`), and list the files to check with `files`. mypy's docs state exactly this for a module at `~/foo-project/src/foo/bar/baz.py`. For a namespace package without a top-level `__init__.py`, add `--explicit-package-bases` so module names are computed relative to the search path.

**Why can naming a package in coverage's `source` cause it to be imported twice, and when does that matter?**
coverage.py imports a module named as a source to find its location, and then your code or test suite imports it again in the normal way; the documentation says this *"could cause trouble if a module has side-effects at import time."* It matters for packages whose `__init__.py` opens connections, registers handlers or reads configuration on import — which is a reason to keep import-time work out of package modules regardless of coverage.

---

← Prev: [10 · The files at the root](10-the-files-at-the-root.md) · [Topic index](README.md) · Next → [12 · `uv init` layouts](12-uv-init-layouts.md)
