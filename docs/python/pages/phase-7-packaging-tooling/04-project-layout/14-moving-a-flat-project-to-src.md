---
title: "Moving a flat project to src changes nothing inside the package and everything that referred to it by path — backend config, the editable install, coverage, lint, CI, the container image — and it is finished only when a built wheel has been listed and tested"
sidebar_label: "14 · Moving flat to src"
sidebar_position: 16
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-10 · target **Python 3.14.7**, **uv 0.12.12**, **ruff 0.16.6** · against PyPUG *src layout vs flat layout* ([packaging.python.org](https://packaging.python.org/en/latest/discussions/src-layout-vs-flat-layout/)), setuptools *Package Discovery* ([setuptools.pypa.io](https://setuptools.pypa.io/en/latest/userguide/package_discovery.html)), hatch *Wheel builder* ([hatch.pypa.io](https://hatch.pypa.io/latest/plugins/builder/wheel/)), the uv build backend ([docs.astral.sh](https://docs.astral.sh/uv/concepts/build-backend/)), uv *Locking and syncing* ([docs.astral.sh](https://docs.astral.sh/uv/concepts/projects/sync/)), ruff `src` ([docs.astral.sh](https://docs.astral.sh/ruff/settings/#src)) and coverage.py configuration ([coverage.readthedocs.io](https://coverage.readthedocs.io/en/latest/config.html)).
> Documentation-validated — **no sandbox run, no program output**.

**The move itself is one `git mv`. Imports inside the package do not change, because the package's name does not change; `from invoice_service.core import issue` is the same line before and after. What changes is every reference to the package's *location*: the backend's discovery settings, the editable install that still points at the old directory, coverage's `source`, an explicit ruff `src`, a pytest `pythonpath`, CI cache keys, a Dockerfile `COPY`, and any code that climbs out of the package with `Path(__file__).parents[…]`. This chunk is the checklist in order, with the fix for each, and the one step that proves it worked: building the wheel, listing it, and testing it installed.**

## 0 · Find every reference to the path

The package name appears in two roles — as an import name, which stays, and as a directory, which moves. Search for the directory role:

```bash
git grep -n -e 'invoice_service/' -e '"invoice_service"' -e "'invoice_service'" -- \
    pyproject.toml setup.cfg setup.py MANIFEST.in noxfile.py tox.ini Makefile Dockerfile \
    .github/ docs/ README.md
```

Every hit that names the directory — `COPY invoice_service/`, `source = ["invoice_service"]`, `include = ["invoice_service"]`, a `hashFiles('invoice_service/**')` cache key — is on the list below.

## 1 · Move the package

```bash
mkdir -p src
git mv invoice_service src/invoice_service
git status --ignored --short invoice_service/     # anything left behind?
rm -rf invoice_service/                           # ignored leftovers: __pycache__, *.egg-info
test ! -e src/__init__.py                         # src must stay a plain directory
```

The leftover check is not optional. `git mv` moves tracked files only; `__pycache__/` and other ignored files stay in the old directory, which then imports as an empty namespace package ([09](09-namespace-packages-and-the-missing-init.md)) and — for hatchling — sits in the first place its heuristic looks ([08](08-hatchling-and-uv-build-discovery.md)).

## 2 · Update the backend configuration

**setuptools.** With nothing configured, auto-discovery recognises the src layout by itself. If the flat project had a `packages.find` table, point it at `src/` — or delete it:

```toml
# before (flat)
[tool.setuptools.packages.find]
include = ["invoice_service*"]
```

```toml
# after (src) — or remove the table entirely and let auto-discovery run
[tool.setuptools.packages.find]
where = ["src"]
```

A legacy `setup.py` needs the same two facts said in Python:

```python
from setuptools import find_packages, setup

setup(
    package_dir={"": "src"},
    packages=find_packages(where="src"),
)
```

**hatchling.** The heuristic's second candidate is `src/<NAME>/__init__.py`, so nothing is required — but the first candidate is the flat directory, so being explicit protects against a leftover:

```toml
[tool.hatch.build.targets.wheel]
packages = ["src/invoice_service"]
```

**uv build backend.** A flat project needed `module-root = ""`; the src layout is the default, so delete it:

```toml
# before (flat)
[tool.uv.build-backend]
module-root = ""
```

```toml
# after (src): no [tool.uv.build-backend] table needed for src/invoice_service/
```

## 3 · Reinstall the project

The existing editable install was made against the old tree.

```bash
uv sync --reinstall-package invoice-service
# or, when anything looks odd
rm -rf .venv && uv sync
```

```bash
python -m pip install -e .        # without uv, inside the activated environment
```

## 4 · Update the tools that locate code by path

```toml
[tool.coverage.run]
source_pkgs = ["invoice_service"]            # was: source = ["invoice_service"] or ["."]

[tool.coverage.paths]
source = ["src/", "*/site-packages/"]

[tool.ruff]
# delete an explicit src = ["."] — the default [".", "src"] covers both layouts

[tool.mypy]
files = ["src", "tests"]
mypy_path = "src"

[tool.pytest.ini_options]
testpaths = ["tests"]
# delete pythonpath = ["."] — the package is installed now
```

Why each line is what it is: [11](11-telling-the-tools-about-src.md) for coverage, ruff and mypy; [06b](06b-rootdir-and-pythonpath.md) for `pythonpath`.

## 5 · Update everything else that names the directory

**Code that climbs out of the package.** `Path(__file__).parents[1]` pointed at the repository root in a flat layout; after the move it points at `src/`, and in an installed package it pointed at site-packages all along. Data a package needs belongs inside it, loaded through the package:

```python
from importlib.resources import files

DEFAULT_CONFIG = (files("invoice_service") / "defaults.toml").read_text()
```

**The container image.** An image that copied the package directory and relied on the working directory being on `sys.path` for `python -m` stops working, because there is no longer a package directory at the top of `/app`. Install the project instead:

```dockerfile
FROM python:3.14-slim
WORKDIR /app
COPY pyproject.toml README.md LICENSE ./
COPY src/ src/
RUN python -m pip install --no-cache-dir .
CMD ["invoice-service"]
```

The uv-based version of this, with layer caching, belongs to **02 · uv** *(not written yet)*.

**CI and task runners.** Cache keys, path filters and `PYTHONPATH` settings:

```yaml
# .github/workflows/ci.yml — only the lines that name the directory
on:
  push:
    paths: ["src/**", "tests/**", "pyproject.toml", "uv.lock"]
```

## 6 · Prove it

The migration is not done when the tests pass — they passed before it, too. It is done when the artifact has been inspected and tested as installed:

```bash
uv build
python -m zipfile -l dist/invoice_service-0.6.0-py3-none-any.whl
uv run --locked --no-editable pytest
```

Look in the listing for every subpackage and data file you expect under `invoice_service/`, and for the absence of anything that should not ship — `tests/`, `tools/`, a stray top-level module. The non-editable test run is the one that now fails if something is missing, which is the whole reason for the move: PyPUG's *"ensuring that the installed copy is used"*.

## Gotchas

**★ Symptom: after the move, hatchling's wheel still contains the old code.** Cause: ignored files kept the old root `invoice_service/` directory alive, and hatchling checks `<NAME>/__init__.py` before `src/<NAME>/__init__.py`. Fix: remove the leftover and pin the selection.

```bash
rm -rf invoice_service/
```

```toml
[tool.hatch.build.targets.wheel]
packages = ["src/invoice_service"]
```

**★ Symptom: ruff now sorts `invoice_service` imports into the third-party block.** Cause: the old configuration set `src = ["."]` explicitly, overriding ruff's default `[".", "src"]`, so `src/` is not searched. Fix: delete the setting or include `src`.

```toml
[tool.ruff]
src = [".", "src"]
```

**★ Symptom: coverage drops to zero, or reports nothing, after the move.** Cause: `source` named the old directory, which no longer exists — or names `src`, while the release job runs the installed copy. Fix: measure by package and map the paths.

```toml
[tool.coverage.run]
source_pkgs = ["invoice_service"]

[tool.coverage.paths]
source = ["src/", "*/site-packages/"]
```

**★ Symptom: the container starts and exits with `ModuleNotFoundError: No module named 'invoice_service'`.** Cause: the image copied `invoice_service/` into the working directory and ran `python -m invoice_service`, which worked only because `-m` puts the working directory on `sys.path`. Fix: install the project in the image.

```dockerfile
COPY pyproject.toml README.md LICENSE ./
COPY src/ src/
RUN python -m pip install --no-cache-dir .
```

**Symptom: code that loads a config file via `Path(__file__).parents[1]` fails after the move.** Cause: the path depth changed by one directory, and the file was outside the package, so it never existed in an installed copy either. Fix: move the file into the package and load it as a resource.

```python
from importlib.resources import files

DEFAULT_CONFIG = (files("invoice_service") / "defaults.toml").read_text()
```

**Symptom: a legacy `setup.py` build produces a wheel with no packages after the move.** Cause: `find_packages()` with no arguments scans the root, where the package no longer is. Fix: point it at `src/` and map the directory.

```python
from setuptools import find_packages, setup

setup(
    package_dir={"": "src"},
    packages=find_packages(where="src"),
)
```

**Symptom: CI keeps restoring a stale cache or skipping jobs after the move.** Cause: cache keys or path filters still name `invoice_service/**`. Fix: update them to the new location.

```yaml
key: deps-${{ hashFiles('uv.lock') }}-src-${{ hashFiles('src/**') }}
```

**Symptom: `git log` on a moved file shows only the move commit.** Cause: history follows renames only when asked. Fix: ask.

```bash
git log --follow -- src/invoice_service/core.py
```

**Symptom: the README's "run it with `python -m invoice_service`" instructions fail for new contributors.** Cause: they worked from a flat checkout without installing; the src layout requires an install first — *"The src layout requires installation of the project to be able to run its code"*. Fix: update the instructions to go through the environment.

```bash
uv sync
uv run invoice-service --help
```

## Interview questions

**★ Walk through moving a flat project to a src layout. What changes and what does not?**
The package's contents and import name do not change, so no import inside the package or in the tests needs editing. What changes is everything that referred to the package's directory: `git mv` it under `src/` and clear ignored leftovers; update or delete the backend's discovery settings; reinstall the editable install; switch coverage to `source_pkgs` with a `[paths]` mapping, remove explicit ruff `src` or pytest `pythonpath` overrides; fix Dockerfiles, CI cache keys and path filters; and replace any code that reaches outside the package by path with `importlib.resources`.

**★ How do you know the migration actually worked?**
By inspecting and testing the artifact rather than re-running the suite that already passed. Build the wheel, list its contents to confirm every subpackage and data file is present and nothing extra is, and run the tests against a non-editable install — `uv run --no-editable pytest` — so that a missing file fails in CI. Before the move that run could not fail for packaging reasons; after it, it can, and that is the point.

**Why can a container image break after the move even though the application code is unchanged?**
Because the image was relying on the flat layout's accidental behaviour: it copied the package directory into the working directory, and `python -m` prepended the working directory to `sys.path`. After the move there is no package directory at the top of `/app`. The robust image installs the project — which also means the image runs the same built artifact the tests ran against.

**Why does an explicit ruff `src = ["."]` suddenly matter after the move?**
Because ruff uses `src` to decide which imports are first-party, and its default `[".", "src"]` covers both layouts. A flat project that set `src = ["."]` explicitly overrode that default, which was harmless while the package sat in the root; after the move, `src/` is no longer searched, and the project's own imports are sorted as third-party.

**Why check for ignored files after `git mv`?**
Because `git mv` moves only tracked files. The old directory survives holding `__pycache__/`, build artefacts or an `*.egg-info` directory, and a directory with the package's name and no `__init__.py` is importable as an empty namespace package. In an environment where the package is not installed, `import invoice_service` then succeeds and every submodule import fails; under hatchling, the leftover sits exactly where the build heuristic looks first.

---

← Prev: [13 · Workspaces as a layout](13-workspaces-as-a-layout.md) · [Topic index](README.md) · Next → **05 · ruff** *(not written yet)*
