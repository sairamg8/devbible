---
title: "04 · Project layout — the src layout, and the import-the-wrong-copy bug the flat layout invites"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-10 · target **Python 3.14.7**, **uv 0.12.12**, **ruff 0.16.6** · against PyPUG *src layout vs flat layout* ([packaging.python.org](https://packaging.python.org/en/latest/discussions/src-layout-vs-flat-layout/)) and *Packaging Python Projects* ([packaging.python.org](https://packaging.python.org/en/latest/tutorials/packaging-projects/)); the CPython 3.14 docs — [`sys.path`](https://docs.python.org/3.14/library/sys.html#sys.path), *Command line* ([docs.python.org](https://docs.python.org/3.14/using/cmdline.html)), *The import system* ([docs.python.org](https://docs.python.org/3.14/reference/import.html)); pytest *Good Integration Practices*, *import mechanisms* and *Configuration* ([docs.pytest.org](https://docs.pytest.org/en/stable/explanation/goodpractices.html)); setuptools *Package Discovery*, *Development Mode* and *Controlling files* ([setuptools.pypa.io](https://setuptools.pypa.io/en/latest/userguide/package_discovery.html)); hatch *Build configuration* ([hatch.pypa.io](https://hatch.pypa.io/latest/config/build/)); uv *build backend*, *Creating projects* and *Using workspaces* ([docs.astral.sh](https://docs.astral.sh/uv/concepts/build-backend/)); ruff, coverage.py and mypy configuration references.
> Documentation-validated — **no sandbox run, no program output on any page in this topic**. Research banked as `research_python_p07_t04_project_layout.md` in the memory store.

**The flat layout keeps your import package in the repository root; the src layout puts it in `src/`. That one directory decides whether Python can import your package without installing it — and because `python -m`, `python -c` and the REPL all put the working directory first on `sys.path`, a flat project's tests can import the checkout instead of the package you built. The result is the classic packaging failure: a subpackage or data file the wheel never contained, a green CI run that imported it from disk anyway, and a release that fails on the first import. This topic builds that bug end to end, shows exactly why the src layout makes the same CI job fail at the right moment, and then covers every place the layout reaches: editable installs that reopen the hole, pytest's import modes, how three build backends find your package, namespace packages, root files, path-based tools, `uv init`'s templates, workspaces, and the migration from flat to src.**

## Chunks

| # | Chunk | Covers |
|---|---|---|
| 1 | **[Flat vs src layout](01-flat-and-src-layout.md)** | the two trees, PyPUG's four consequences verbatim, 🔴 *"requires installation"* as the feature, the `__main__.py` workaround, why `src/` must never have `__init__.py`, and choosing |
| 2 | **[sys.path zero](02-sys-path-zero.md)** | what `-m`, a script path, `-c`, the REPL and a console script each prepend, 🔴 first match wins and `sys.modules` caches it, `-P`/`PYTHONSAFEPATH` (3.11) and `-I`, stdlib shadowing and 3.13's hint |
| 3 | **[The wrong-copy bug](03-the-wrong-copy-bug.md)** | 🔴 the bug built step by step — an `include` pattern that drops a subpackage, a CI job that installs the wheel then tests the checkout — plus the data-file variant, the inverse compiled-module case, and metadata that disagrees with code |
| 3b | **[How src catches it](03b-how-the-src-layout-catches-it.md)** | the same job replayed under `src/` failing at collection, why invocation stops mattering, deleting the `include` table, and 🔴 three ways teams put the hole back |
| 4 | **[Editable installs and layout](04-editable-installs-reopen-the-hole.md)** | what an editable install exposes per layout, 🔴 why src + editable still hides a missing file, strict mode, setuptools' documented limits, and testing a regular install with uv, pip and nox |
| 5 | **[Where tests live](05-where-tests-live.md)** | tests beside vs inside the package, whether they ship per backend, 🔴 `tests/__init__.py` puts the root on `sys.path`, helpers vs fixtures, `testpaths` |
| 6 | **[pytest import modes](06-pytest-import-modes.md)** | the `prepend` basedir walk, 🔴 four routes to the repository root, `append`, `importlib`'s trade-offs, and a choosing table |
| 6b | **[rootdir and pythonpath](06b-rootdir-and-pythonpath.md)** | 🔴 `rootdir` never touches imports, how it is found, `pytest.toml` precedence, `pythonpath` as an explicit `sys.path` edit, `consider_namespace_packages` |
| 7 | **[setuptools package discovery](07-how-backends-find-your-package.md)** | src and flat auto-discovery, the reserved-names list, 🔴 the multi-top-level refusal, `packages.find` semantics, `package-dir` |
| 8 | **[hatchling and uv_build](08-hatchling-and-uv-build-discovery.md)** | hatchling's four-candidate heuristic 🔴 flat first, VCS ignores as build config, uv's single `src/<package_name>/` module, anchored includes vs unanchored excludes, one tree across three backends |
| 9 | **[Namespace packages](09-namespace-packages-and-the-missing-init.md)** | the deliberate shared-namespace layout, and 🔴 the forgotten `__init__.py` — how setuptools, coverage, mypy, ruff and pytest each react |
| 10 | **[The files at the root](10-the-files-at-the-root.md)** | who reads each root file, which reach the sdist per backend, `MANIFEST.in`, 🔴 unanchored `.gitignore` patterns under hatchling, scripts outside `src/` |
| 11 | **[Telling the tools about src](11-telling-the-tools-about-src.md)** | ruff's `src` default, 🔴 coverage `source_pkgs` + `[paths]` for code that runs from site-packages, mypy's `mypy_path` |
| 12 | **[`uv init` layouts](12-uv-init-layouts.md)** | 🔴 apps packaged by default since uv 0.12, `--lib`, `--build-backend`, `--no-package`, `--bare`, and `uv init` inside a project |
| 13 | **[Workspaces as a layout](13-workspaces-as-a-layout.md)** | the members tree, sources and editable members, 🔴 a member importing a sibling's dependency, one `requires-python`, path dependencies instead |
| 14 | **[Moving flat to src](14-moving-a-flat-project-to-src.md)** | the migration in order — move, backend, reinstall, tools, Docker and CI — and 🔴 proving it by listing and testing the built wheel |

## The one diagram

```text
python -m pytest, run from the repository root
│
├── the repository root is prepended to sys.path (the -m rule)
│
├── flat:  ./invoice_service/  ← found first: the CHECKOUT is imported,
│                                site-packages is never searched
│
└── src:   ./src/  ./tests/    ← nothing named invoice_service here,
                                 search continues to site-packages:
                                 the INSTALLED copy is imported
```

## Phase gate

You are done with this topic when you can take a flat project and, without looking anything up:

- Predict, for a given command and working directory, whether a test run imports the checkout or the installed package — and name the four routes by which the repository root reaches `sys.path` in a pytest run.
- Build the wrong-copy bug on paper: which configuration mistake drops a file, which step installs the broken wheel, which `sys.path` entry wins, and why more tests would not have caught it.
- Explain why a src layout tested through an editable install can still ship a missing file, and write the CI job that closes the gap with uv.
- Say what setuptools, hatchling and the uv build backend each need to be told for a package that lives in `src/invoices/` in a project called `invoice-service`.
- Move the project to `src/`, fix coverage, lint, mypy, Docker and CI, and prove the result by listing the built wheel.

## Where this connects

- **[Phase 7 — Packaging, projects and tooling](../README.md)** — the phase this topic belongs to.
- **[01 · pyproject.toml](../01-pyproject-toml/README.md)** — the file every layout decision is configured in; its **[build-system and backends](../01-pyproject-toml/11-build-system-and-choosing-a-backend.md)** chunk is where the backends in chunks 07–08 are chosen, and its **[tool namespace](../01-pyproject-toml/12-the-tool-namespace.md)** chunk explains the `[tool.*]` tables used throughout.
- [02 · uv](../02-uv/README.md) — owns `uv sync`, `uv run`, `[tool.uv.sources]` and uv in containers; this topic covers only `uv init`'s layouts and workspaces as a layout.
- [05 · ruff](../05-ruff/README.md) — lint configuration beyond the `src` setting.
- **07 · Wheels vs sdists** *(not written yet)* — everything about what goes into each artifact; this topic covers file selection only as far as layout decides it.
- **10 · Editable installs** *(not written yet)* — `.pth` files, import hooks and path dependencies in depth; chunk 04 covers only what the layout decides.
- **Phase 12 — Testing with pytest** *(not written yet)* — the test runner this topic configures for layout.

---

← Prev: [Phase 7 — Packaging, projects and tooling](../README.md) · Next → [01 · Flat vs src layout](01-flat-and-src-layout.md)
