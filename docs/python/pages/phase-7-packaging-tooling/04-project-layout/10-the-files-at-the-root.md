---
title: "Every file in the project root is owned by some tool with its own discovery rule, and a handful of them are read by the build backend too — so the root is where a stray ignore pattern, a misnamed MANIFEST or an undeclared licence quietly changes what you ship"
sidebar_label: "10 · The files at the root"
sidebar_position: 12
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-10 · target **Python 3.14.7**, **uv 0.12.12** · against PyPUG *Packaging Python Projects* ([packaging.python.org](https://packaging.python.org/en/latest/tutorials/packaging-projects/)), setuptools *Controlling files in the distribution* ([setuptools.pypa.io](https://setuptools.pypa.io/en/latest/userguide/miscellaneous.html)), hatch *Build configuration* ([hatch.pypa.io](https://hatch.pypa.io/latest/config/build/)) and *sdist builder* ([hatch.pypa.io](https://hatch.pypa.io/latest/plugins/builder/sdist/)), the uv build backend ([docs.astral.sh](https://docs.astral.sh/uv/concepts/build-backend/)), uv *Working on projects* ([docs.astral.sh](https://docs.astral.sh/uv/guides/projects/)), pytest *Configuration* ([docs.pytest.org](https://docs.pytest.org/en/stable/reference/customize.html)), GitHub Actions *Workflow syntax* ([docs.github.com](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax)) and nox *Configuration & API* ([nox.thea.codes](https://nox.thea.codes/en/stable/config.html)).
> Documentation-validated — **no sandbox run, no program output**.

**Once the import package moves under `src/`, the root is left holding everything else — configuration, lockfile, licence, docs, tests, CI, task runners — and each of those files has an owner that finds it by name and location. Most owners never touch your build. A few do: the build backend reads `pyproject.toml`, the readme and licence files it is pointed at, and — depending on which backend — `MANIFEST.in` or your `.gitignore`. This chunk is the map: who reads each root file, what their rule is, and which ones change the contents of your sdist. What goes into each artifact in full is **07 · Wheels vs sdists** *(not written yet)*.**

## A complete src-layout root

```text
invoice-service/
├── .github/
│   └── workflows/
│       └── ci.yml
├── .gitignore
├── .python-version
├── LICENSE
├── README.md
├── pyproject.toml
├── uv.lock
├── noxfile.py
├── docs/
│   └── index.md
├── tools/
│   └── backfill_invoices.py
├── src/
│   └── invoice_service/
│       ├── __init__.py
│       └── core.py
└── tests/
    ├── conftest.py
    └── test_core.py
```

## Who reads what

| File | Read by | The rule |
|---|---|---|
| `pyproject.toml` | build frontends and backends; every tool with a `[tool.*]` table | [pyproject.toml · 12 · The tool namespace](../01-pyproject-toml/12-the-tool-namespace.md) |
| `README.md` | the backend, *if* `project.readme` names it | [pyproject.toml · 05 · description and readme](../01-pyproject-toml/05-description-and-readme.md) |
| `LICENSE` | the backend, via `license-files` | [pyproject.toml · 08 · license and PEP 639](../01-pyproject-toml/08-license-and-the-pep-639-migration.md) |
| `.gitignore` | git; **hatchling** for file selection | *"By default, Hatch will respect the first `.gitignore` or `.hgignore` file found in your project's root directory or parent directories."* |
| `uv.lock` | uv | created at first `uv run`/`uv sync`/`uv lock` — **02 · uv** *(not written yet)* |
| `.python-version` | uv | created by `uv init`, pins the interpreter uv uses — **02 · uv** *(not written yet)* |
| `.venv/` | uv, your editor | *"uv will create a virtual environment and `uv.lock` file in the root of your project the first time you run a project command"* |
| `tests/` | pytest | [05](05-where-tests-live.md) |
| `conftest.py` in the root | pytest | its directory is inserted into `sys.path` in `prepend` mode — [06](06-pytest-import-modes.md) |
| `pytest.toml`, `pytest.ini`, `tox.ini`, `setup.cfg` | pytest, as configuration candidates | searched in that family, first match wins — [06b](06b-rootdir-and-pythonpath.md) |
| `noxfile.py` | nox | *"Nox looks for configuration in a file named `noxfile.py` by default."* |
| `.github/workflows/*.yml` | GitHub Actions | *"You must store workflow files in the `.github/workflows` directory of your repository."* |
| `MANIFEST.in` | setuptools only | *"This file contains instructions that tell `setuptools` which files exactly should be part of the `sdist` (or not)."* |
| `Makefile` | make | no Python packaging tool gives it any meaning |
| `build/`, `dist/`, `*.egg-info/` | setuptools, as output | *"Setuptools automatically creates a few directories to host build artefacts and cache files, such as `build`, `dist`, `*.egg-info`."* |

Three notes on that table.

**nox's location is a convention, not a rule.** Its documentation says it looks for `noxfile.py` *by default* and documents a `--noxfile` option for another path; it does not require the root. Everyone puts it there because the default is the root of wherever you run `nox`.

**GitHub's location is a rule.** The workflow directory is fixed, and *"Workflow files use YAML syntax, and must have either a `.yml` or `.yaml` file extension."*

**`Makefile` has no packaging meaning.** No PyPA specification or backend documentation I checked gives it special treatment. It is a task runner; it matters only if its recipes set `PYTHONPATH` and quietly undo the src layout.

## Which root files reach the sdist

| Root file | setuptools default | hatchling default | uv build backend default |
|---|---|---|---|
| `pyproject.toml` | yes — in its default list | yes — always, not excludable | yes |
| `README.md` | yes — *"`README`, `README.txt`, `README.rst` or `README.md`"* | yes — unless VCS-ignored, and always if it is the declared `readme` | yes, if referenced by `project.readme` |
| `LICENSE` | yes — `LICEN[CS]E*`, `COPYING*`, `NOTICE*`, `AUTHORS**` when `license-files` is unset | yes — unless VCS-ignored, and always for defined `license-files` | yes, if referenced by `project.license-files` |
| `tests/` | `tests/test*.py` only | yes, unless VCS-ignored | no, unless in `source-include` |
| `.gitignore` | no | yes — always | no |
| `docs/`, `tools/`, `noxfile.py` | no (unless `MANIFEST.in` adds them) | yes, unless VCS-ignored | no, unless in `source-include` |

The uv column is the one that surprises people coming from hatchling: the uv backend includes what `pyproject.toml` *references* plus the module, and nothing because it merely exists.

```toml
[project]
name = "invoice-service"
version = "0.6.0"
readme = "README.md"            # uv ships it because it is referenced here
license = "MIT"
license-files = ["LICENSE"]     # …and this

[tool.uv.build-backend]
source-include = ["tests/**", "docs/**"]
```

## `MANIFEST.in`, for setuptools projects

> *"if you need finer control over the files (e.g. you don't want to distribute CI/CD-related files) or you need automatically generated files, you can add a `MANIFEST.in` file at the root of your project, to specify any files that the default file location algorithm doesn't catch."*

> *"Please note that `setuptools` supports the `MANIFEST.in`, and not `MANIFEST` (no extension)."*

> *"Commands are processed in the order they appear in the `MANIFEST.in` file."*

The commands are `include`, `exclude`, `recursive-include`, `recursive-exclude`, `global-include`, `global-exclude`, `graft` and `prune`.

```text
# MANIFEST.in
graft docs
prune docs/_build
include noxfile.py
global-exclude *.py[cod]
```

It governs the sdist. The wheel is then built from that sdist, and setuptools' own footnote explains why the two differ: *"the `sdist` can contain files that are useful during development or the build process itself, but not in runtime (e.g. tests, docs, examples, etc...). The `wheel`, on the other hand, … only contains items that are required during runtime."*

## Scripts and tools belong outside `src/`

`tools/backfill_invoices.py` is not part of the package and should not ship. In a src layout it also cannot be imported by accident. Run it through the project environment:

```bash
uv run python tools/backfill_invoices.py
```

`python tools/backfill_invoices.py` prepends `tools/` — the script's directory — to `sys.path` ([02](02-sys-path-zero.md)), not the root, so `import invoice_service` inside it resolves to the installed package. That is the src layout working in your favour: operational scripts use exactly the code that ships. A script that must be a real command belongs in `[project.scripts]` instead.

## Gotchas

**★ Symptom: a setuptools sdist ignores the file-list instructions you wrote.** Cause: the file is named `MANIFEST`, and *"`setuptools` supports the `MANIFEST.in`, and not `MANIFEST` (no extension)."* Fix: rename it.

```bash
git mv MANIFEST MANIFEST.in
```

**★ Symptom: a subpackage named `build` is missing from a hatchling-built wheel.** Cause: `.gitignore` contains `build/`, which git matches at any depth, and hatchling uses the ignore file for selection — so `src/invoice_service/build/` is ignored too. Fix: anchor the pattern to the root.

```text
# .gitignore
/build/
/dist/
*.egg-info/
.venv/
```

**★ Symptom: the uv-built sdist and wheel have no licence file, though `LICENSE` is in the root.** Cause: the uv backend includes *"the files referenced by `project.license-files`"*, not files that merely exist. Fix: reference it.

```toml
[project]
license = "MIT"
license-files = ["LICENSE"]
```

**Symptom: a uv-built package shows no description on the index.** Cause: `project.readme` is unset, so the backend neither ships the file nor copies it into metadata. Fix: declare it.

```toml
[project]
readme = "README.md"
```

**★ Symptom: a CI workflow never runs.** Cause: it sits in `.github/workflow/` (singular) or has a `.yaml.txt`-style extension; GitHub requires `.github/workflows` and a `.yml` or `.yaml` extension. Fix: move it.

```bash
git mv .github/workflow/ci.yml .github/workflows/ci.yml
```

**Symptom: pytest ignores `[tool.pytest.ini_options]` in a project that also has an old `pytest.ini`.** Cause: `pytest.ini` comes before `pyproject.toml` in the documented configuration search — *"`pytest.toml`, `.pytest.toml`, `pytest.ini`, `.pytest.ini`, `pyproject.toml`, `tox.ini`, and `setup.cfg`"*. Fix: consolidate into one file.

```bash
git rm pytest.ini
```

**Symptom: `make test` passes and `uv run pytest` fails, or the reverse.** Cause: the Makefile recipe sets `PYTHONPATH=.` or `PYTHONPATH=src`, putting the source tree ahead of the installation. Fix: make the recipe call the project environment.

```make
test:
	uv run pytest
```

**Symptom: `nox` says it cannot find a noxfile when run from a subdirectory.** Cause: it looks for `noxfile.py` by default, relative to where it runs. Fix: run it from the root or name the file.

```bash
nox --noxfile ../noxfile.py
```

**Symptom: stale copies of the package under `build/lib/` turn up in search results, type-checker runs and test collection.** Cause: setuptools writes build artefacts into the root. Fix: delete them and ignore them at the root.

```bash
rm -rf build/ dist/ src/*.egg-info *.egg-info
```

## Interview questions

**★ Which root files does a build backend actually read?**
`pyproject.toml` always. The readme and licence files only as far as `pyproject.toml` points at them — `project.readme` and `project.license-files` — with setuptools additionally picking up conventionally named README and licence files by default. setuptools reads `MANIFEST.in`; hatchling reads your `.gitignore`. Everything else in the root — lockfile, `.python-version`, noxfile, workflows, Makefile — belongs to other tools and does not change what the backend builds unless a backend's file selection happens to sweep it into the sdist.

**★ Why does `.gitignore` matter to hatchling and not to setuptools?**
Because hatchling uses the VCS ignore file as its default file-selection filter — its sdist is everything *"not ignored by your VCS"* — while setuptools decides from its own default list plus `MANIFEST.in` and any VCS plugin you add. So in a hatchling project an ignore pattern is packaging configuration, and an unanchored one like `build/` can remove a real subpackage from the build.

**Where should one-off operational scripts live in a src layout?**
Outside `src/`, in something like `tools/`, and they should be run through the project environment — `uv run python tools/x.py`. Run by path, a script puts its own directory on `sys.path`, not the root, so it imports the installed package: the same code that ships. If a script becomes something users run, it graduates to a `[project.scripts]` entry inside the package.

**Why can a leftover `pytest.ini` override configuration you wrote in `pyproject.toml`?**
Because pytest's configuration search walks a fixed list of file names — `pytest.toml`, `.pytest.toml`, `pytest.ini`, `.pytest.ini`, `pyproject.toml`, `tox.ini`, `setup.cfg` — and the first match becomes the config file and fixes the `rootdir`. A `pytest.ini` from an older setup is earlier in that list than `pyproject.toml`. Root files carry meaning for tools other than the one they look like they belong to, and `tox.ini` and `setup.cfg` are pytest configuration candidates as well.

**Does the uv build backend include your `README.md` and `LICENSE` automatically?**
Only if `pyproject.toml` references them: its sdist includes *"the files referenced by `project.license-files` and `project.readme`"*, and the wheel copies licence files into `.dist-info` and the readme into metadata. Unlike setuptools, it has no built-in list of conventional names it picks up because they exist.

---

← Prev: [09 · Namespace packages](09-namespace-packages-and-the-missing-init.md) · [Topic index](README.md) · Next → [11 · Telling the tools about src](11-telling-the-tools-about-src.md)
