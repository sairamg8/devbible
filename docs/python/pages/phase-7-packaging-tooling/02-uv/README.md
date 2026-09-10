---
title: "02 · uv — one external binary that owns the environment, the resolver, the lockfile and the interpreter, and the pip + venv floor it was designed against"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-10 against **uv 0.12.12** — the uv documentation ([docs.astral.sh](https://docs.astral.sh/uv/)):
> *Projects*, *Locking and syncing*, *Running commands*, *Managing dependencies*, *Resolution*, *Python
> versions*, *Caching*, *Tools*, *Configuration files*, *Workspaces*, *pip compatibility*, *Using uv in
> Docker*, the settings, environment-variable, storage and CLI references — the uv release notes
> ([github.com/astral-sh/uv](https://github.com/astral-sh/uv/releases)), the `venv` module
> documentation ([docs.python.org](https://docs.python.org/3.14/library/venv.html)) and the PyPA guide
> *Installing packages using pip and virtual environments*
> ([packaging.python.org](https://packaging.python.org/en/latest/guides/installing-using-pip-and-virtual-environments/)).
> Version spine: **uv 0.12.12** (2026-09-09) · **Python 3.14.7** · ruff 0.16.6 · pre-commit 4.6.2.
> Documentation-validated — **no sandbox run, no timings, no program output on any page in this topic**.

**uv is a single executable that manages Python from the outside: it creates the virtual environment,
resolves your declared dependencies into a universal lockfile, installs exactly that lockfile, runs
commands in the result, and can install the interpreter itself — none of it requiring a Python to be
present first. Two ideas carry the whole topic. Resolving and installing are separate phases with
separate artefacts — `uv lock` writes `uv.lock`, `uv sync` makes the environment *equal* it, removing
what it does not list — and every CI flag, Docker layer and debugging technique here is one of those
phases switched on or off. And uv is `0.x`, shipping roughly weekly, so every page names the version a
recent flag landed in and pins uv in the places a human is not watching. The last third of the topic is
the ground uv stands on and beside: `pip` + `venv` as the floor that works everywhere, uv's own pip
interface and how it differs from pip, tools run with `uvx`, configuration, and workspaces.**

## The whole workflow, annotated

Each line is covered in depth by the chunk named beside it.

```bash
uv init invoice-service                 # ← 09  · a packaged app: src/, [project.scripts], uv_build
uv python pin 3.14                      # ← 05, 05b · .python-version: a request, not a constraint
uv add 'httpx>=0.28'                    # ← 04  · edits pyproject.toml, re-locks, syncs
uv add --dev pytest ruff==0.16.6        # ← 04, 07d · dev group, synced by default
uv lock                                 # ← 03  · universal resolution → uv.lock (commit it)
uv sync                                 # ← 02c · environment == lockfile; strays removed
uv run pytest                           # ← 04c · lock + sync + run; no activation
uv sync --locked                        # ← 02d · in CI: a stale lockfile fails the job
uv lock --upgrade-package httpx         # ← 03b · move one version, keep the rest
uv export --format requirements.txt     # ← 03c · a derived artefact for tools that cannot read uv.lock
uvx ruff@0.16.6 check .                 # ← 07, 07b · a tool in a disposable env, isolated from the project
uv build --no-sources                   # ← 09b · build as the rest of the world will
```

## Chunks

| # | Chunk | Covers |
|---|---|---|
| 1 | **[What uv actually is](01-what-uv-is.md)** | one static binary outside every environment, what it replaces, and 🔴 resolution and installation as two phases with two failure modes |
| 2 | **[The project uv sees](01b-the-project-uv-sees.md)** | four files and their owners, what `uv init` writes, 🔴 `[build-system]` decides whether *your* code is installed, `[tool.uv]` as spec-scoped |
| 3 | **[Installing and pinning uv](01c-installing-and-pinning-uv.md)** | standalone vs package-manager installs and self-update, the `uv version` trap, pinning in CI, Docker and pre-commit, 🔴 pre-1.0 weekly releases |
| 4 | **[The cache and the speed claim](01d-the-cache-and-the-speed-claim.md)** | the global cache and linking, 🔴 same-filesystem requirement, `prune --ci` vs `clean`, `--refresh` vs `--reinstall`, the 10–100× claim attributed |
| 5 | **[The environment uv expects](02-the-environment-uv-expects.md)** | `.venv` beside `pyproject.toml`, created on demand, 🔴 no `pip` inside it, and the environment as derived state |
| 6 | **[Activation and discovery](02b-activation-and-discovery.md)** | activation only edits `PATH`, 🔴 the two discovery rule sets (project vs pip interface), `--relocatable` |
| 7 | **[uv sync](02c-uv-sync-makes-the-environment-match.md)** | 🔴 exact syncing removes packages, groups and extras, the project installed editable, what sync does not do |
| 8 | **[--frozen and --locked in CI](02d-frozen-and-locked-in-ci.md)** | 🔴 one skips the check, one enforces it, `uv lock --check`, `UV_LOCKED`/`UV_FROZEN` and the 0.12.9 `--no-locked` boundary |
| 9 | **[uv in a container image](02e-uv-inside-a-container-image.md)** | 🔴 `--no-install-project` as the layering flag, `UV_LINK_MODE=copy`, bytecode compilation, `PATH` instead of activation |
| 10 | **[A complete multi-stage Dockerfile](02f-a-complete-multi-stage-dockerfile.md)** | builder and runtime stages, identical paths, `.dockerignore`, `--no-editable` for a source-free image, pinning uv by digest |
| 11 | **[uv.lock](03-the-lockfile.md)** | universal resolution vs a freeze, 🔴 `requires-python` as solver input, forking, reviewing a lockfile diff |
| 12 | **[Upgrading the lockfile](03b-upgrading-the-lockfile.md)** | `--upgrade` vs `--upgrade-package`, resolution strategies, `--exclude-newer`, whether a library commits `uv.lock` |
| 13 | **[Exporting the lockfile](03c-exporting-the-lockfile.md)** | `requirements.txt`, `pylock.toml`, CycloneDX, 🔴 an export is derived — generate or verify it, never trust it |
| 14 | **[uv add and uv remove](04-add-and-remove.md)** | edit + re-lock + sync in one command, 🔴 the lower bound uv writes for you, the four places a dependency can go |
| 15 | **[tool.uv.sources](04b-tool-uv-sources.md)** | *what* vs *where*, 🔴 why sources never reach anyone installing your package, safe and unsafe patterns |
| 16 | **[uv run](04c-uv-run.md)** | discover, lock, sync, execute, 🔴 inexact by default, `--with`, scripts with inline metadata |
| 17 | **[uv run as a process](04d-uv-run-as-a-process.md)** | 🔴 uv stays in the process tree forwarding signals, `--`, Windows script extensions, working-directory discovery |
| 18 | **[uv python](05-uv-python.md)** | install, list, find, pin, 🔴 discovery order and `python-preference`, silent interpreter downloads, standalone-build quirks |
| 19 | **[.python-version vs requires-python](05b-python-version-vs-requires-python.md)** | 🔴 a request for an interpreter vs a constraint on the whole resolution, and which one to change |
| 20 | **[Upgrades and CI matrices](05c-interpreter-upgrades-and-ci-matrices.md)** | `uv python upgrade` moves patches only, interpreter changes invalidate environments, matrices in the CI file |
| 21 | **[pip + venv, the floor](06-pip-and-venv-the-floor.md)** | what `python -m venv` creates, 🔴 activation is optional, why `python -m pip` is the safe form |
| 22 | **[Requirements files and the floor's limits](06b-requirements-files-and-the-floors-limits.md)** | 🔴 `pip freeze` describes one machine, `.in` vs `.txt`, the limitation-to-uv-feature map, the complete floor recipe |
| 23 | **[uv pip vs pip](06c-uv-pip.md)** | drop-in but not a clone, 🔴 uv reads none of pip's configuration, a virtual environment required by default, `[tool.uv.pip]` |
| 24 | **[uv pip: resolver and builds](06d-uv-pip-resolver-and-build-isolation.md)** | why two correct resolvers disagree, pre-release `if-necessary`, 🔴 build isolation and what `--no-build-isolation` obliges |
| 25 | **[uv pip install, sync, compile](06e-uv-pip-install-sync-and-compile.md)** | additive vs converging, platform-specific compile vs `--universal`, 🔴 never mix the pip and project interfaces |
| 26 | **[Migrating to a uv project](06f-migrating-from-requirements-to-a-project.md)** | 🔴 `uv add -r requirements.in -c requirements.txt`, dev and platform files, proving the migration moved no version |
| 27 | **[uvx — running tools](07-uvx-and-tools.md)** | the three environments uv runs commands in, 🔴 `uvx` never sees the project — wrong for pytest and mypy |
| 28 | **[uvx — versions, sources, plugins](07b-uvx-versions-sources-and-plugins.md)** | 🔴 cached-first version selection, `@version`/`@latest`/`--isolated`, `--from`, `--with`, the tool's Python |
| 29 | **[uv tool install](07c-uv-tool-install.md)** | tools directory and `PATH`, which executables install, 🔴 modules not importable, stored constraints, interpreter breakage |
| 30 | **[Tools: config and choosing](07d-tools-config-and-choosing.md)** | 🔴 tool commands ignore project configuration, install vs dev group vs `uvx`, tools in build images |
| 31 | **[Configuration files](08-configuration-files.md)** | project, user and system layers, 🔴 `uv.toml` silently beats `[tool.uv]`, array concatenation, `--no-config`, `--config-file` |
| 32 | **[required-version, UV_* and .env](08b-required-version-env-vars-and-dotenv.md)** | 🔴 the only uv pin that travels with the repo, environment variables outranking files, `.env` losing to the environment |
| 33 | **[tool.uv resolution controls](08c-tool-uv-resolution-controls.md)** | constraints vs 🔴 overrides, `environments`, `required-environments`, `conflicts`, `default-groups`, explicit indexes |
| 34 | **[uv init, uv version, uv tree](09-uv-init-version-and-tree.md)** | 🔴 the 0.12 packaged-by-default scaffold, the init flags, bumping the project version, `uv tree --invert` |
| 35 | **[uv build and uv publish](09b-uv-build-and-uv-publish.md)** | uv as a build frontend, 🔴 `--no-sources` before publishing, checking the artefact outside the project, credentials |
| 36 | **[Workspaces](10-workspaces.md)** | one lockfile, one `requires-python`, one configuration root, `workspace = true`, 🔴 when path dependencies are the better fit |

## Phase gate

You are done with this topic when you can take a repository from nothing to a reproducible CI build and
container image without looking anything up — `uv init`, a pinned interpreter, dependencies in the
right tables, a committed `uv.lock`, `uv sync --locked` in CI, a two-stage Dockerfile whose runtime
stage has no uv — and, given a failure, say which phase produced it. Concretely, you should be able to
answer without a search:

- Why a clean `uv sync` can be followed by `ModuleNotFoundError` on your own package.
- What `--frozen` does that `--locked` refuses to do, and which one belongs in CI.
- Why a package installed with `uv pip install` disappears at the next `uv sync`.
- Why `uvx pytest` fails where `uv run pytest` works.
- What happens to `[tool.uv]` when someone commits a `uv.toml` beside it.
- Where a `pip install -r requirements.txt` repository's intentions and resolutions go when it becomes a
  uv project, and how you prove no version moved.

## Where this connects

- **[01 · pyproject.toml](../01-pyproject-toml/README.md)** is the file every project command here
  reads; it covers the `[project]`, `[build-system]` and `[tool]` tables field by field.
- **[Phase 7 — Packaging, projects and tooling](../README.md)** is the phase this topic belongs to.
- [03 · Dependencies done right](../03-dependencies/README.md) owns the policy this topic's mechanics serve:
  specifiers, extras versus groups, and why applications lock and libraries range.
- [04 · Project layout](../04-project-layout/README.md) owns the src-layout choice that `uv init` makes for you.
- **05 · ruff** *(not written yet)* is the tool most often run with `uvx` or pinned in a dev group.
- **07 · Wheels vs sdists** *(not written yet)* is what `uv build` asks the backend to produce.
- **09 · PEP 723 inline metadata** *(not written yet)* is the third environment `uv run` can build — from
  a script's own declaration.
- **10 · Editable installs** *(not written yet)* is the general practice behind uv's editable project
  install, path sources and workspaces.
- **12 · Publishing to PyPI** *(not written yet)* is the release process around `uv publish`.

---

← Prev: [01 · pyproject.toml](../01-pyproject-toml/README.md) · Next → [01 · What uv actually is](01-what-uv-is.md)
