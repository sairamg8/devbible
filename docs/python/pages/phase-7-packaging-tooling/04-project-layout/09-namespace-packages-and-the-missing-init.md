---
title: "A directory without __init__.py still imports — as a namespace package — so a forgotten file never fails where you would notice; it fails later and differently in the build backend, the coverage report, the type checker and pytest"
sidebar_label: "09 · Namespace packages"
sidebar_position: 11
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-10 · target **Python 3.14.7**, **uv 0.12.12** · against *The import system* ([docs.python.org](https://docs.python.org/3.14/reference/import.html)), setuptools *Package Discovery* ([setuptools.pypa.io](https://setuptools.pypa.io/en/latest/userguide/package_discovery.html)) and *Development Mode* ([setuptools.pypa.io](https://setuptools.pypa.io/en/latest/userguide/development_mode.html)), the uv build backend ([docs.astral.sh](https://docs.astral.sh/uv/concepts/build-backend/)), hatch *Wheel builder* ([hatch.pypa.io](https://hatch.pypa.io/latest/plugins/builder/wheel/)), pytest `consider_namespace_packages` ([docs.pytest.org](https://docs.pytest.org/en/stable/reference/reference.html)), coverage.py *Specifying source files* ([coverage.readthedocs.io](https://coverage.readthedocs.io/en/latest/source.html)), mypy *Running mypy* ([mypy.readthedocs.io](https://mypy.readthedocs.io/en/stable/running_mypy.html#mapping-file-paths-to-modules)) and ruff `namespace-packages` ([docs.astral.sh](https://docs.astral.sh/ruff/settings/#namespace-packages)).
> Documentation-validated — **no sandbox run, no program output**.

**Since PEP 420, Python does not need `__init__.py` to import a directory: a directory without one is a *namespace package*, a legitimate construct for splitting one import name across several distributions. The consequence for layout is that forgetting `__init__.py` is not an error at import time. The code runs, the tests pass — and then the tools that decide what exists by looking for `__init__.py` disagree with the interpreter. setuptools may or may not ship the directory depending on one flag; the uv backend and hatchling may not find your package at all; coverage silently leaves the files out of the report. This chunk separates the deliberate namespace layout from the accidental one and shows each tool's reaction.**

## Regular versus namespace

> *"A regular package is typically implemented as a directory containing an `__init__.py` file. When a regular package is imported, this `__init__.py` file is implicitly executed, and the objects it defines are bound to names in the package's namespace."*

> *"A namespace package is a composite of various portions, where each portion contributes a subpackage to the parent package."*

> *"With namespace packages, there is no `parent/__init__.py` file."*

The legitimate use: several independently released distributions contributing subpackages to one shared top-level name — `acme.invoices` in one wheel, `acme.payments` in another, both importable under `acme`.

## The deliberate layout

```text
acme-invoices/
├── pyproject.toml              name = "acme-invoices"
└── src/
    └── acme/                   no __init__.py — the shared namespace
        └── invoices/
            ├── __init__.py     regular package, owned by this distribution
            └── core.py
```

Each backend is told the same thing in its own dialect. **uv** identifies namespace modules by a dot:

> *"Namespace package modules are identified by a `.` in the `module-name`."*

```toml
[tool.uv.build-backend]
module-name = "acme.invoices"
```

> *"The `__init__.py` file is not included in `foo`, since it's the shared namespace module."*

**hatchling**'s fourth heuristic candidate is `<NAMESPACE>/<NAME>/__init__.py` at the root; under `src/`, say it explicitly:

```toml
[tool.hatch.build.targets.wheel]
packages = ["src/acme"]
```

**setuptools** finds it with `packages.find`, whose `pyproject.toml` default already considers implicit namespaces:

```toml
[tool.setuptools.packages.find]
where = ["src"]
```

The src layout is the recommended home for this. setuptools says the src layout can be *"less error-prone … when using PEP 420-style packages"*, and warns about the alternative in editable installs: *"Support for PEP 420-style implicit namespace packages for projects structured using flat-layout is still **experimental**."*

uv also has a blanket switch, with a warning attached:

> *"Using `namespace = true` disables safety checks. Using an explicit list of module names is strongly recommended outside of legacy projects."*

## The accidental layout

The more common case: a regular package where one subdirectory lost — or never had — its `__init__.py`.

```text
src/invoice_service/
├── __init__.py
├── core.py
└── pdf/                        🔴 no __init__.py
    └── render.py
```

`from invoice_service.pdf.render import render` works: `pdf` imports as a namespace package inside the regular one. Everything that relies on the *interpreter* is happy. Everything that relies on *looking for `__init__.py`* is not:

| Tool | What it does with `pdf/` | Source |
|---|---|---|
| setuptools `packages.find`, default | includes it — *"setuptools will consider implicit namespaces by default"* | package discovery |
| setuptools `packages.find`, `namespaces = false` | 🔴 **excludes it** — *"This will prevent any folder without an `__init__.py` file from being scanned."* | package discovery |
| coverage.py with `source` set | 🔴 **leaves its unexecuted files out of the report** — *"Only importable files (ones at the root of the tree, or in directories with a `__init__.py` file) will be considered."* | specifying source files |
| mypy, default | treats it as a package, using *"the location of the highest `__init__.py[i]` in the directory tree to determine the top-level package"* | running mypy |
| mypy, `--no-namespace-packages` | crawls up only *"for as long as it continues to find `__init__.py`"* — so `render.py` gets the wrong module name | running mypy |
| ruff | resolves it for first-party detection only if told: `namespace-packages` *"Mark the specified directories as namespace packages"* | ruff settings |
| pytest | does not resolve namespace packages unless `consider_namespace_packages = true` | confvals |

And if the missing file is the *top-level* `src/invoice_service/__init__.py`, the uv backend — which expects *"directories containing an `__init__.py`"* at `src/<package_name>/__init__.py` — and hatchling — whose candidates all end in `__init__.py` or `.py` — have nothing to find.

The coverage row is the quiet one. A subpackage with no tests and no `__init__.py` is not reported as 0% covered; it is not reported at all, so the total goes *up*.

## pytest and namespace packages

> *"Controls if pytest should attempt to identify namespace packages when collecting Python modules."*
> *"Set to `True` if the package you are testing is part of a namespace package."*
> *"Only native namespace packages are supported, with no plans to support legacy namespace packages."*
> *"For best results when using `consider_namespace_packages`, pytest needs to be able to import your namespace packages. This is best achieved by installing the packages in your environment, most commonly in "editable" mode."*

```toml
[tool.pytest.ini_options]
consider_namespace_packages = true
```

Added in pytest 8.1, default `false`. pytest's *Good Integration Practices* adds the layout note: *"If you use one of the two recommended file system layouts above but leave away the `__init__.py` files from your directories, it should just work. From "inlined tests", however, you will need to use absolute imports for getting at your application code."*

## The rule

Every directory inside a package you own gets an `__init__.py`. Omit it only for a namespace you are deliberately sharing across distributions — and then say so explicitly to every backend and tool that has a setting for it.

## Gotchas

**★ Symptom: coverage looks healthy, and a whole untested subpackage is missing from the report.** Cause: with `source` configured, coverage considers only *"directories with a `__init__.py` file"* when looking for files that never ran. Fix: add the file.

```bash
touch src/invoice_service/pdf/__init__.py
```

**★ Symptom: a subpackage disappeared from the setuptools wheel after adding `namespaces = false`.** Cause: that setting skips *"any folder without an `__init__.py` file"*, and the subpackage never had one. Fix: add the `__init__.py`; keep `namespaces = false` if you have no deliberate namespaces.

```bash
touch src/invoice_service/pdf/__init__.py
```

**★ Symptom: two distributions sharing the `acme` namespace work when both are installed from wheels, and one's subpackage becomes unimportable as soon as the other is installed editable.** Cause: one of them ships `acme/__init__.py`, making `acme` a regular package. Installed side by side, both copies land in the same `site-packages/acme/` directory and the problem hides; once the portions live in different `sys.path` entries, the regular package found first owns `acme` and the other directory is never searched. Fix: remove it from the shared directory, as uv's docs describe.

```bash
git rm src/acme/__init__.py
```

**Symptom: the uv backend or hatchling cannot find a package that imports fine locally.** Cause: `src/invoice_service/` has no `__init__.py`, so it imports as a namespace package, but both backends look for `__init__.py` by default. Fix: add it.

```bash
touch src/invoice_service/__init__.py
```

**Symptom: `import invoice_service` succeeds, but `invoice_service.__file__` is `None` and nothing inside it imports.** Cause: a stray directory with that name and no `__init__.py` — a leftover after a move, holding only `__pycache__` — was found as an empty namespace package. Fix: delete the stray directory and import the real package from the environment.

```bash
rm -rf invoice_service/
uv run python -c "import invoice_service; print(invoice_service.__file__)"
```

**Symptom: pytest cannot import tests that live inside a namespace package.** Cause: by default pytest *"will not attempt to resolve namespace packages automatically"*. Fix: enable the setting and install the packages.

```toml
[tool.pytest.ini_options]
consider_namespace_packages = true
```

**Symptom: `namespace = true` in `[tool.uv.build-backend]` builds, and ships a directory you did not intend.** Cause: the option *"disables safety checks"*. Fix: list the modules explicitly.

```toml
[tool.uv.build-backend]
module-name = "acme.invoices"
```

**Symptom: mypy assigns the wrong module name to files in a directory without `__init__.py`.** Cause: with namespace packages turned off, mypy derives names only by crawling up through `__init__.py` files. Fix: add the files, or tell mypy where package roots are.

```toml
[tool.mypy]
mypy_path = "src"
explicit_package_bases = true
```

**Symptom: ruff classifies imports from a namespace package as third-party.** Cause: ruff's first-party resolution treats a directory without `__init__.py` as a package only when configured. Fix: declare it.

```toml
[tool.ruff]
namespace-packages = ["src/acme"]
```

## Interview questions

**★ What happens if you forget `__init__.py` in a subpackage?**
At runtime, usually nothing: the directory imports as a namespace package inside the regular one. The damage is in tooling that locates packages by the file. setuptools with `namespaces = false` leaves it out of the wheel; coverage leaves its unexecuted files out of the report; mypy can assign wrong module names; if it is the top-level package, the uv backend and hatchling cannot find it. It is a bug that the interpreter hides and the toolchain exposes piecemeal.

**★ When should you deliberately omit `__init__.py`?**
Only for a namespace package — a top-level name shared by several distributions, each contributing its own subpackage, such as `acme.invoices` and `acme.payments` shipped separately. The shared directory must have no `__init__.py` in any of them; the subpackages each distribution owns should still have one. Anything else is a regular package and should be marked as one.

**Why does a missing `__init__.py` make coverage numbers go up?**
Because with `source` configured, coverage searches for never-executed files only in the tree root and in directories with an `__init__.py`. An untested subpackage without one is neither measured nor listed as unexecuted, so it contributes nothing to the denominator. The report looks better precisely because code is missing from it.

**Why must a shared namespace directory not contain `__init__.py`?**
Because an `__init__.py` makes it a regular package, and a regular package lives in one place. When the portions sit in different `sys.path` entries — an editable install beside a regular one, or two workspace members — whichever copy is found first owns `acme`, and the others' subpackages are no longer part of it. (Installed from wheels into one site-packages, the directories merge and the mistake hides until the day they do not.) Namespace packages work precisely because no single distribution owns the parent; uv's docs note that the `__init__.py` is not included in the shared namespace module for this reason.

**Why does the src layout matter more for namespace packages?**
Because a namespace portion is *any* directory with the right name on `sys.path`, with no `__init__.py` to mark it. In a flat layout the repository root is often on the path, so stray directories there can join the namespace. setuptools says the src layout can be less error-prone with PEP 420 packages, and calls flat-layout namespace support in editable installs *"still experimental"*.

---

← Prev: [08 · hatchling and uv_build discovery](08-hatchling-and-uv-build-discovery.md) · [Topic index](README.md) · Next → [10 · The files at the root](10-the-files-at-the-root.md)
