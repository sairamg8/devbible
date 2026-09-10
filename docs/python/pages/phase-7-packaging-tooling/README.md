---
title: "Phase 7 — Packaging, projects and tooling"
sidebar_label: "Overview"
sidebar_position: 0
---

> **Target: Python 3.14** (3.14.7, 2026-08-05) · **uv 0.12.12** (2026-09-09) ·
> **ruff 0.16.6** (2026-09-03) · **pre-commit 4.6.2** (2026-08-10).
> Documentation-validated — every page names its sources on a `> Verified:` line
> (packaging.python.org, the PyPA specifications, docs.astral.sh, the PEPs). No
> sandbox: pages carry configuration and commands, never fabricated program output.

Packaging was Python's long-running embarrassment, and the reason is worth stating
plainly: for twenty years the *installer* also had to be the *build system*, so
`setup.py` was an executable script that ran arbitrary code to answer the question
"what are this project's dependencies?" Every tool downstream had to execute your
project to learn about it. PEP 518 and PEP 621 ended that by making the answer
declarative data in `pyproject.toml`, and everything modern in this phase follows
from that one change.

So this phase is opinionated on purpose. One config file, one tool that owns the
environment, one tool that owns the lint-and-format pass: `pyproject.toml`, `uv`,
`ruff`. The older stack — `setup.py`, `requirements.txt`, `pip` + `venv`,
flake8 + isort + black — is not skipped; you need it to read the projects you will
actually be handed, and `pip install -r requirements.txt` remains the fallback that
works on any machine anywhere. But it is taught as the baseline you fall back to,
not the default you reach for.

The three **Master** rows are the ones that decide whether a project is reproducible
by someone other than you. Everything else in this phase is a consequence of getting
those three right.

🚧 **In flight — 1 of 12.**

| # | Topic | Tier | In one line |
|---|---|---|---|
| 01 | **[`pyproject.toml`](./01-pyproject-toml/README.md)** · 14 chunks | <span className="db-tier t-master">Master</span> | The one config file: metadata, dependencies, tool config, and the death of `setup.py` |
| 02 | **`uv`** *(not written yet)* | <span className="db-tier t-master">Master</span> | venv + resolver + lockfile + `uv run` — and `pip` + `venv` as the floor |
| 03 | **Dependencies done right** *(not written yet)* | <span className="db-tier t-master">Master</span> | Ranges vs a committed lockfile, extras, groups — why apps lock and libraries range |
| 04 | **Project layout** *(not written yet)* | <span className="db-tier t-understand">Understand</span> | The src layout, and the import-the-wrong-copy bug flat layout invites |
| 05 | **`ruff`** *(not written yet)* | <span className="db-tier t-understand">Understand</span> | Linter + formatter in one, rule selection, `--fix`, CI and pre-commit |
| 06 | **Entry points** *(not written yet)* | <span className="db-tier t-understand">Understand</span> | `[project.scripts]` — a function installed as a command |
| 07 | **Wheels vs sdists** *(not written yet)* | <span className="db-tier t-understand">Understand</span> | Why `pip install` sometimes compiles C, and what a missing wheel looks like |
| 08 | **Config and secrets** *(not written yet)* | <span className="db-tier t-understand">Understand</span> | Environment variables, `.env` in dev only, typed settings — 12-factor in Python |
| 09 | **PEP 723 inline metadata** *(not written yet)* | <span className="db-tier t-know">Know</span> | A single-file script that carries its own dependencies |
| 10 | **Editable installs** *(not written yet)* | <span className="db-tier t-know">Know</span> | `-e .`, path dependencies, simple monorepos and workspaces |
| 11 | **`pre-commit`** *(not written yet)* | <span className="db-tier t-know">Know</span> | The hook harness the ecosystem standardised on |
| 12 | **Publishing to PyPI** *(not written yet)* | <span className="db-tier t-know">Know</span> | Build backends, `uv build`/`twine`, versioning, trusted publishing from CI |

## Phase gate

The deliverable: a src-layout project where `uv sync` on a clean machine reproduces
the environment exactly from a committed lockfile, `ruff check` and the type checker
pass in CI, and a console script declared in `[project.scripts]` installs and runs.
You should also be able to say, without looking it up, which of your dependency
declarations belongs in `[project.dependencies]` and which belongs in a dependency
group — and why a library must not commit the lockfile it resolves.

## Where this connects

- **[Phase 0 — The runtime](../phase-0-runtime/README.md)** owns what a virtual
  environment *is* and how the interpreter finds modules; this phase is what
  manages one.
- **Phase 6 — Typing** is where the type checker this phase puts in CI gets
  configured, and where its `pyproject.toml` section comes from.
- **Phase 9 — The web service** and **Phase 11 — REST APIs and CRUD** are built
  inside the project layout this phase establishes.
- **Phase 12 — Testing with pytest** shares this phase's config file and its
  dependency groups: `pytest` is the canonical member of the `dev` group.
- **Phase 13 — Production and performance** is where the wheel this phase builds
  becomes a container image.

---

← Prev: **Phase 6 — Typing** *(not written yet)* · Index: [Python — Explanations](../README.md)
