---
title: "01 · pyproject.toml — three tables, one file, and the twenty-year problem they were invented to end"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-10 against the PyPA specifications — *pyproject.toml* ([packaging.python.org](https://packaging.python.org/en/latest/specifications/pyproject-toml/)), *Core metadata* ([packaging.python.org](https://packaging.python.org/en/latest/specifications/core-metadata/)), *Dependency specifiers* ([packaging.python.org](https://packaging.python.org/en/latest/specifications/dependency-specifiers/)), *Dependency groups* ([packaging.python.org](https://packaging.python.org/en/latest/specifications/dependency-groups/)), *Entry points* ([packaging.python.org](https://packaging.python.org/en/latest/specifications/entry-points/)), *Name normalization* ([packaging.python.org](https://packaging.python.org/en/latest/specifications/name-normalization/)) — plus PEPs 517, 518, 621, 639, 660 and 794 ([peps.python.org](https://peps.python.org/)).
> Target: **Python 3.14.7**. Documentation-validated — **no sandbox run, no program output on any page in this topic**.

**One file, three tables, and every one of them exists because `setup.py` was a program. PEP 518 gave us `[build-system]` so a tool could learn what a project needs to build without executing it; PEP 517 turned "run setup.py" into a named backend object so hatchling and maturin could exist; PEP 621 gave us `[project]` so metadata stopped being keyword arguments; and PEP 518's `[tool]` namespace, secured by a one-sentence PyPI ownership rule, is the reason your linter, type checker, test runner and build backend all read the same file. This topic works through the whole file field by field, with the rules quoted verbatim from the specifications, and it ends where it should end — on the small, real list of things that still need Python in the build.**

## The whole file, annotated

Everything below is covered in detail by the chunk named beside it.

```toml
[build-system]                                  # ← 02, 11
requires = ["hatchling >= 1.26"]                # populates a throwaway build env
build-backend = "hatchling.build"               # an import path, evaluated inside it

[project]
name = "invoice-service"                        # ← 03 · static, MUST NOT be dynamic
version = "0.4.2"                               # ← 04 · required, may be dynamic
description = "Issues and reconciles invoices."  # ← 05 · one line, becomes Summary
readme = "README.md"                            # ← 05 · becomes Description
requires-python = ">=3.12"                      # ← 04 · the only interpreter gate that works
license = "MIT"                                 # ← 08 · an SPDX expression, PEP 639
license-files = ["LICENSE"]                     # ← 08 · glob patterns, MUST be included
authors = [{ name = "Priya Raman", email = "priya@example.com" }]   # ← 09 · no commas in name
keywords = ["invoicing", "billing"]             # ← 09
classifiers = ["Programming Language :: Python :: 3.14"]   # ← 09 · search only, no enforcement
dependencies = [                                # ← 06 · one Requires-Dist each
    "httpx>=0.28",
    "uvloop>=0.20; sys_platform != 'win32'",    # ← 06 · the condition ships, not the answer
]

[project.optional-dependencies]                 # ← 07 · published extras
postgres = ["psycopg[binary]>=3.2"]

[project.scripts]                               # ← 10 · a function installed as a command
invoice = "invoice_service.cli:main"

[project.urls]                                  # ← 09
Repository = "https://github.com/example/invoice-service"

[dependency-groups]                             # ← 07 · top level, MUST NOT be published
dev = ["pytest>=8.3", "ruff>=0.16"]

[tool.ruff]                                     # ← 12 · owned because ruff owns the PyPI name
line-length = 100
```

Two keys are absent from that file on purpose and have their own chunks: `dynamic`, in **[13](13-dynamic-metadata.md)**, and `backend-path`, in **[11](11-build-system-and-choosing-a-backend.md)**.

## Chunks

| # | Chunk | Covers |
|---|---|---|
| 1 | **[The catch-22 that killed setup.py](01-the-catch-22-that-killed-setup-py.md)** | PEP 518's exact framing of the circular dependency, `setup_requires`, why TOML beat JSON/YAML/`configparser`, the three tables, and 🔴 why PEP 621 forbids tools extending `[project]` |
| 2 | **[The frontend/backend split](02-pep-517-the-frontend-backend-split.md)** | `build-backend` as an import path, the four hooks, 🔴 build isolation and what `--no-build-isolation` really buys, `backend-path`, PEP 660, and the `setuptools.build_meta:__legacy__` fallback |
| 3 | **[name and normalization](03-the-project-name-and-normalization.md)** | the valid-name regex, the `[-_.]+` collapse rule and why the `+` matters, distribution name vs import name, PEP 794's `import-names`, and 🔴 why `name` MUST be static |
| 4 | **[version and requires-python](04-version-and-requires-python.md)** | static vs dynamic version, PEP 440 vs SemVer spellings, 🔴 classifiers do **not** restrict interpreters, why an upper bound on `requires-python` cannot be overridden downstream, and the `~=3.12.0` trap |
| 5 | **[description and readme](05-description-and-readme.md)** | one-line `Summary`, string vs table form, 🔴 `content-type` is a MUST in the table form, the `description`/`Description` name inversion, and why relative image paths always break on PyPI |
| 6 | **[dependencies and markers](06-dependencies-and-markers.md)** | the four-part specifier grammar, every operator's real meaning, 🔴 markers ship the condition rather than the answer, `python_version` vs `python_full_version`, and direct URL references plus `allow-direct-references` |
| 7 | **[Extras and dependency groups](07-extras-and-dependency-groups.md)** | `Provides-Extra` + the `extra ==` marker, why extras can only add, the self-referential `all` pattern, and 🔴 PEP 735's MUST that groups never reach built metadata |
| 8 | **[license and PEP 639](08-license-and-the-pep-639-migration.md)** | SPDX expressions, `AND` vs `OR` as a legal statement, `license-files` globs, the deprecated classifier and table subkeys, and 🔴 the `setuptools >= 77.0.3` boundary |
| 9 | **[authors, classifiers, urls](09-authors-classifiers-and-urls.md)** | the RFC 822 comma rule, the `Author`/`Author-email` split, Trove validation at upload time, 🔴 `Private :: Do Not Upload` as a real guard, and the `[project.urls]` label conventions |
| 10 | **[Entry points and scripts](10-entry-points-and-console-scripts.md)** | the object-reference grammar, what the installer generates and where, `gui-scripts` on Windows, plugin groups via `importlib.metadata`, and 🔴 why `[project.entry-points.console_scripts]` MUST error |
| 11 | **[build-system and backends](11-build-system-and-choosing-a-backend.md)** | `requires` vs `dependencies`, the verbatim backend pairings, 🔴 `pdm-backend` → `pdm.backend`, how tightly to pin, `backend-path`, and what happens when the table is missing |
| 12 | **[The tool namespace](12-the-tool-namespace.md)** | 🔴 PEP 518's *if and only if* PyPI ownership rule, who owns which subtable, why `[tool.pytest.ini_options]` has the extra level, what still cannot live here, and the backend's own `[tool]` half |
| 13 | **[dynamic metadata](13-dynamic-metadata.md)** | `dynamic` as a declaration of intent, the MUST to honour static metadata, 🔴 the two half-configurations that fail, the append-only rule for lists, and three backends' three mechanisms |
| 14 | **[What still needs setup.py](14-what-still-needs-setup-py.md)** | the three jobs that genuinely need Python, the full keyword-to-table migration map, `setup.py develop` → PEP 660, and 🔴 why declaring `[build-system]` can break a build that worked |

## Phase gate

You are done with this topic when you can write a complete `pyproject.toml` for a real project from memory — build system with a justified version floor, full `[project]` table, extras separated from dependency groups, a console script, and a PEP 639 licence expression — and, given a broken one, say from the symptom alone which of the three tables is at fault. Concretely, you should be able to answer without looking anything up:

- Why `pip install .` in a directory with only `[tool.ruff]` in its `pyproject.toml` fails.
- Which field stops your package installing on Python 3.9, and which field only *looks* like it does.
- Why `pytest` belongs in `[dependency-groups]` and `psycopg` in `[project.optional-dependencies]`.
- What `requires = ["pdm-backend"]` must be paired with, and why you cannot derive it.
- What `dynamic = ["version"]` does *not* do on its own.

## Where this connects

- **[Phase 7 — Packaging, projects and tooling](../README.md)** is the phase this topic opens; everything else in it configures itself inside this file.
- [02 · uv](../02-uv/README.md) is the tool that reads `[project]` and `[dependency-groups]` to build and lock an environment, and adds `[tool.uv]`.
- [03 · Dependencies done right](../03-dependencies/README.md) takes over the policy question this topic deliberately leaves open: ranges versus a committed lockfile, and why an application locks while a library ranges.
- [04 · Project layout](../04-project-layout/README.md) owns the src-layout decision that `[tool.setuptools.packages.find]` and its hatchling equivalent exist to configure.
- [05 · ruff](../05-ruff/README.md) is the largest single `[tool.*]` subtable most projects will ever write.
- **06 · Entry points** *(not written yet)* goes further into the console-script and plugin surface that chunk 10 introduces.
- **07 · Wheels vs sdists** *(not written yet)* is what the backend in `[build-system]` actually produces, and why a missing wheel makes users compile.
- **12 · Publishing to PyPI** *(not written yet)* is where every field in `[project]` becomes visible to strangers, and where the immutability of published metadata starts to matter.

---

← Prev: [Phase 7 — Packaging, projects and tooling](../README.md) · Next → [01 · The catch-22 that killed setup.py](01-the-catch-22-that-killed-setup-py.md)
