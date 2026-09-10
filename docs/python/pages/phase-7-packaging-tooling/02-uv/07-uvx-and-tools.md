---
title: "`uvx` runs a tool in a throwaway environment that can never see your project, which is exactly right for a formatter and exactly wrong for pytest or mypy — and the version it runs is whatever it cached first unless you say otherwise"
sidebar_label: "07 · uvx — running tools"
sidebar_position: 27
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-10 against **uv 0.12.12** — *Tools* ([docs.astral.sh](https://docs.astral.sh/uv/concepts/tools/)),
> *Using tools* ([docs.astral.sh](https://docs.astral.sh/uv/guides/tools/)), *Storage*
> ([docs.astral.sh](https://docs.astral.sh/uv/reference/storage/)), *Caching*
> ([docs.astral.sh](https://docs.astral.sh/uv/concepts/cache/)) and the CLI reference
> ([docs.astral.sh](https://docs.astral.sh/uv/reference/cli/)).
> Version spine: **uv 0.12.12** (2026-09-09) · Python 3.14.7 · **ruff 0.16.6** · pre-commit 4.6.2.
> Documentation-validated, **no sandbox run, no timings**.

**uv can run a command in three different environments, and choosing the wrong one is the whole class
of bug this page is about. `uv run` uses the project's environment, so the command sees your code and
your dependencies. `uv run script.py` on a script with inline metadata builds an environment from the
script's own declaration. And `uvx` — an alias for `uv tool run` — builds a separate, cached,
disposable environment containing one tool and its dependencies, *isolated from the project by
design*. That isolation is the point for a formatter, a linter, or a one-off CLI: nothing the tool
needs leaks into your project, and nothing in your project can break the tool. It is fatal for
anything that has to import your code — pytest, mypy, a Django management command — and uv's own
guide says so. The second trap is the version: `uvx ruff` does not mean "the latest ruff", it means
"the ruff I cached the first time", unless you ask for something else.**

## `uvx` is `uv tool run`, and the environment is not yours

> *"This is exactly equivalent to: `$ uv tool run ruff`"* · *"`uvx` is provided as an alias for
> convenience."*

> *"Tools are installed into temporary, isolated environments when using `uvx`."*
> — both [using tools](https://docs.astral.sh/uv/guides/tools/)

> *"When running a tool with `uvx`, a virtual environment is stored in the uv cache directory and is
> treated as disposable."*

> *"Tools are always run isolated from the project."*
> — both [tools](https://docs.astral.sh/uv/concepts/tools/)

The most precise description uv gives is an equivalence with a project-free `uv run`:

> *"`uv tool run <name>` (or `uvx <name>`) is nearly equivalent to: `uv run --no-project --with <name>
> -- <name>`"*
> — [tools](https://docs.astral.sh/uv/concepts/tools/)

"Nearly" covers three differences: the package is inferred from the command name, the temporary
environment is cached in a dedicated location, and *"If a tool is already installed, `uv tool run`
will use the installed version but `uv run` will not"* ([tools](https://docs.astral.sh/uv/concepts/tools/)).
The equivalence is worth memorising anyway, because it tells you exactly what `uvx` cannot see:
`--no-project` means your project's environment is not consulted at all.

## The three environments, side by side

| Command | Environment | Sees your package? | Sees your dependencies? | Declared in |
|---|---|---|---|---|
| `uv run pytest` | the project's `.venv` | ✅ (if packaged — [01b](01b-the-project-uv-sees.md)) | ✅ | `pyproject.toml` + `uv.lock` |
| `uv run tools/report.py` with a `# /// script` block | built from the script's block | ❌ | ❌ | the script itself |
| `uvx ruff check` | a cached tool environment | ❌ | ❌ | nothing — the command line |

The inline-metadata row is [04c](04c-uv-run.md)'s territory for how `uv run` treats it, and topic
**09 · PEP 723 inline metadata** *(not written yet)* owns the format. This page is the third row.

## 🔴 When `uvx` is the wrong tool

> *"If you are running a tool in a _project_ and the tool requires that your project is installed,
> e.g., when using `pytest` or `mypy`, you'll want to use `uv run` instead of `uvx`."*
> — [using tools](https://docs.astral.sh/uv/guides/tools/)

The test is a single question: **does the tool import your code, or only read it as text?**

| Tool | Imports your code? | Use |
|---|---|---|
| ruff (lint + format) | no — it parses files | `uvx` is fine; a pinned dev-group entry is better for a team |
| pytest | yes — it imports your modules and fixtures | `uv run pytest` |
| mypy / pyright | yes, in effect — it resolves your imports against installed packages | `uv run mypy` |
| `python -m myapp`, `alembic`, `django-admin` | yes | `uv run` |
| httpie, cookiecutter, a release helper | no | `uvx` |

A type checker is the subtle row. It does not execute your code, but it has to find the *installed*
stubs and packages your code imports, and a `uvx` environment has none of them — so every third-party
import reports as missing, which looks like a type-checker configuration problem rather than the wrong
environment.

## What `uvx` runs, precisely

Which *version* of a tool `uvx` runs — cached, installed, or latest — how to name a package whose command
has a different name, how to add a plugin to the tool's environment, and which Python the tool gets,
is [07b](07b-uvx-versions-sources-and-plugins.md). Installing a tool permanently, the `pipx` role, is
[07c](07c-uv-tool-install.md).

## Gotchas

**★ Symptom: `uvx pytest` fails with `ModuleNotFoundError` for your own package.**
Cause: `uvx` is *"nearly equivalent to `uv run --no-project --with <name> -- <name>`"* — the project is
never consulted, so neither your package nor its dependencies exist in pytest's environment. Fix: run
it in the project.

```bash
uv add --dev pytest
uv run pytest
```

**★ Symptom: `uvx mypy` reports every third-party import as missing, though the code runs fine.**
Cause: the type checker resolves imports against the environment it is installed in, and the tool
environment contains mypy and nothing of yours. Fix: install it where your dependencies are.

```bash
uv add --dev mypy
uv run mypy src/
```

**Symptom: after `uv cache clean`, the first `uvx` of every tool is slow again.**
Cause: the tool environment lived in the cache — it *"is stored in the uv cache directory and is treated
as disposable"*. Fix: nothing is broken; if a machine needs the tool permanently, install it instead of
relying on the cache ([07c](07c-uv-tool-install.md)).

```bash
uv tool install ruff@0.16.6
```

**Symptom: every CI job spends time building the same tool environments.**
Cause: the tool environments live in the uv cache, and the runner starts with an empty one. Fix: put the
cache somewhere the CI system persists, and pin the tool so the cache key is stable.

```yaml
env:
  UV_CACHE_DIR: ${{ github.workspace }}/.uv-cache
steps:
  - uses: actions/cache@v4
    with:
      path: .uv-cache
      key: uv-${{ runner.os }}-ruff-0.16.6
  - run: uvx ruff@0.16.6 check .
```

## Interview questions

**★ What is the difference between `uv run` and `uvx`?**
Which environment the command runs in. `uv run` locks and syncs the *project* environment first and
then runs the command inside it, so the command sees your package and every declared dependency.
`uvx` — an alias for `uv tool run` — runs the command in a separate tool environment built from the
command line alone, cached and disposable, and uv states that *"tools are always run isolated from the
project."* The docs' own equivalence makes it concrete: `uvx <name>` is *"nearly equivalent to
`uv run --no-project --with <name> -- <name>`"*. So the decision rule is whether the tool needs to import
your code: pytest and mypy do and belong under `uv run`; a formatter or a standalone CLI does not and
can use `uvx`.

**★ Why does `uvx pytest` fail in a project when `uv run pytest` works?**
Because the tool environment never contains the project. pytest has to import your modules, your
conftest and your dependencies, and `uvx` builds an environment holding pytest and its own dependencies
only. uv's guide calls this out directly — for a tool that *"requires that your project is installed,
e.g., when using `pytest` or `mypy`, you'll want to use `uv run` instead of `uvx`."* The fix is to
declare pytest in a dev group and run it with `uv run`, which also pins its version in `uv.lock` so CI
and every developer run the same one.

**What does "disposable" mean for a `uvx` environment, and what follows from it?**
That uv makes no promise to keep it. The environment *"is stored in the uv cache directory and is
treated as disposable"* — it exists to make the second invocation fast, not to be a managed install.
Three things follow. Clearing or pruning the cache deletes it, and the next run rebuilds it. You must
never modify it by hand, because it can vanish or be rebuilt under you. And if a machine needs a tool to
be permanently present — a build agent image, a developer's everyday CLI — the right command is
`uv tool install`, which creates a persistent environment in the tools directory rather than the cache.

**Is `uvx` a replacement for `pipx`?**
For half of it. `pipx` has two jobs — run a CLI once without installing it, and install a CLI into its
own environment with its command on `PATH` — and uv splits them across two commands. `uvx` is the
first job: a temporary, cached, disposable environment, isolated from any project. `uv tool install` is
the second: *"a virtual environment is created in the uv tools directory"* and the tool's executables
are placed on `PATH`. uv's own advice leans towards the first — *"In most cases, executing a tool with
`uvx` is more appropriate than installing the tool"* — which is a reasonable default for anything you
run occasionally; install the few tools you run daily, and the ones a build image must carry.

---

← Prev: [06f · Migrating to a uv project](06f-migrating-from-requirements-to-a-project.md) · [Topic index](README.md) · Next → [07b · uvx — versions, sources, plugins](07b-uvx-versions-sources-and-plugins.md)
