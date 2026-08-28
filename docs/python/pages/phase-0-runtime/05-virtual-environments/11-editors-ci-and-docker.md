---
title: "In an editor the venv is a setting you must select, in CI it is a path you must name, and in Docker it is a PATH you set once and never activate"
sidebar_label: "11 · Editors, CI and Docker"
sidebar_position: 11
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-28 against the
> [VS Code Python environments documentation](https://code.visualstudio.com/docs/python/environments),
> the Python 3.14 [`venv` docs](https://docs.python.org/3.14/library/venv.html),
> the [uv documentation](https://docs.astral.sh/uv/concepts/projects/run/) and
> [uv environment variables](https://docs.astral.sh/uv/reference/environment/),
> and the [official `python` Docker image documentation](https://hub.docker.com/_/python).
> Version spine: **Python 3.14.7**.

**Three environments where "just activate it" is not available, for three
different reasons. An editor is a long-running process that was started before
your shell had an environment, so it needs to be told which interpreter to use
and remembers that choice. A CI job is a fresh machine every time with no
interactive shell, so the interpreter must be named by path or by `uv run`. A
container's every `RUN` is its own shell, so the only durable form of activation
is `ENV PATH`. Get these three right and the daily friction of virtual
environments essentially disappears.**

## Editors

VS Code resolves the interpreter through a documented order — a configured Python
project, then `defaultEnvManager`, then the legacy `python.defaultInterpreterPath`,
then auto-discovery, with the rule that *"User-configured settings always win over
defaults"*. Discovery itself is a glob: the extension *"searches your entire
workspace for virtual environments using the glob pattern `./**/.venv`"*, which is
the practical argument for that exact directory name
([chunk 9](09-where-the-venv-lives.md)).

Once selected, *"the extension automatically activates your selected Python
environment so that `python`, `pip`, and related commands use the correct
interpreter"* in new terminals. That auto-activation is convenient and is also
the source of the classic confusion: the integrated terminal has an environment
your external terminal does not.

The symptoms of a wrongly-selected interpreter are worth memorising, because none
of them says "wrong interpreter":

| Symptom | What is really happening |
|---|---|
| Imports underlined as unresolved, but the code runs | the language server is on a different interpreter from the run configuration |
| The run button fails with `ModuleNotFoundError`, the terminal works | the run configuration points at the system Python |
| Autocomplete lists a package version you do not have installed | the server is indexing another environment's `site-packages` |
| A newly installed package is invisible until you restart the editor | the language server cached the environment's contents at startup |

Two habits remove most of it. First, verify from inside the tool rather than
guessing — in a terminal, a notebook cell or a debug console:

```python
import sys
print(sys.executable)
print(sys.prefix, sys.base_prefix, sep="\n")
```

Second, do not commit an absolute interpreter path in
`.vscode/settings.json` — `${workspaceFolder}/.venv/bin/python` is portable
between machines and `/Users/you/...` is not.

PyCharm asks the same question in different words: an "existing environment"
pointing at `<project>/.venv/bin/python` is the setting you want, and the
"system interpreter" default is the one that produces mysterious import errors.

**Jupyter deserves its own warning.** A kernel is a separate registered
interpreter, so the notebook's environment is whatever the kernel was installed
against — not the environment you launched `jupyter` from. Check it in a cell
with `import sys; print(sys.executable)`, and install into *that* interpreter
using the `%pip install` magic rather than `!pip install`, which shells out to
whatever `PATH` provides. If the kernel needs pip present, that is one of the
cases for `uv venv --seed` ([chunk 7](07-uv-venv-and-uv-run.md)).

## CI

The rules are short:

1. **Never `source activate` in a job step.** Some CI systems run each step in a
   fresh shell, so it may not even persist; and it buys nothing over a path.
2. **Name the interpreter, or use `uv run`.**
3. **Cache the package cache, not the environment.**

```yaml
# GitHub Actions, stdlib tooling
- run: python -m venv .venv
- run: .venv/bin/python -m pip install -r requirements.txt
- run: .venv/bin/python -m pytest -q
```

```yaml
# GitHub Actions, uv
- uses: astral-sh/setup-uv@v6
- run: uv sync --locked
- run: uv run pytest -q
```

`uv run` is doing the work of the first two steps here — the docs' guarantee that
*"uv will ensure that the project environment is up-to-date before running the
given command"* is exactly what a CI step needs.

On caching: an environment is not relocatable and is bound to a specific base
interpreter ([chunks 5](05-not-relocatable.md) and
[6](06-when-the-base-interpreter-moves.md)), so a cached `.venv` is only safe when
the runner image, the Python version *and* the absolute path are identical, and
it goes stale invisibly when any of them changes. The package cache has none of
those constraints:

```yaml
- uses: actions/cache@v4
  with:
    path: ~/.cache/uv           # or ~/.cache/pip
    key: ${{ runner.os }}-py3.14-${{ hashFiles('uv.lock') }}
```

Note the Python version in the key. That is the guard against failure mode 4 from
[chunk 6](06-when-the-base-interpreter-moves.md) arriving via a cache.

## Docker

There are two defensible shapes.

**Shape A — no virtual environment.** The container *is* the isolation; there is
exactly one application in it. Install into the image's interpreter. This is fine
with the official `python` images, which are not marked as externally managed the
way a distro Python is.

**Shape B — a virtual environment, built in one stage and copied to the next.**
This is the shape to know, because it produces a small runtime image that
contains no compiler:

```dockerfile
# syntax=docker/dockerfile:1
FROM python:3.14.7-slim AS builder
WORKDIR /app
RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

FROM python:3.14.7-slim
COPY --from=builder /opt/venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH" \
    PYTHONUNBUFFERED=1
WORKDIR /app
COPY . .
CMD ["python", "-m", "myapp"]
```

Four details carry the whole pattern:

- **`ENV PATH="/opt/venv/bin:$PATH"` replaces activation.** It is precisely what
  `activate` does — prepend one directory — but at image scope, so it survives
  every later `RUN`, the `CMD`, and `docker exec`
  ([chunk 4](04-activation-is-only-path.md)).
- **The environment is at the same absolute path in both stages,** and the base
  interpreter is at the same path because both stages use the same image. That is
  why this copy is not a "move" and does not violate
  [chunk 5](05-not-relocatable.md).
- **The tag is pinned to a patch version** in *both* stages. `python:3.14` in one
  and `python:3.14.7-slim` in the other is how you build an image whose venv
  points at an interpreter minor version it was not built for.
- **`/opt/venv`, not `/app/.venv`.** Keeping the environment out of the working
  directory means a bind-mounted source tree in development cannot shadow it.

The uv equivalent avoids the venv-in-image question entirely by pointing the
project environment at a system path:

```dockerfile
FROM python:3.14.7-slim
COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv
ENV UV_PROJECT_ENVIRONMENT=/usr/local UV_COMPILE_BYTECODE=1
WORKDIR /app
COPY pyproject.toml uv.lock ./
RUN uv sync --locked --no-dev --no-install-project
COPY . .
RUN uv sync --locked --no-dev
CMD ["python", "-m", "myapp"]
```

And in every case, `.venv/` belongs in `.dockerignore`
([chunk 9](09-where-the-venv-lives.md)) so that a host environment is never copied
in.

## Gotchas

**Symptom:** the editor reports unresolved imports for packages that are definitely installed
**Cause:** the selected interpreter is not the project's environment, or the language server started before the packages were installed
**Fix:** re-select the interpreter (`Python: Select Interpreter` → the `.venv` entry), then restart the language server. Confirm with `sys.executable` from the tool's own console, not from your shell

**Symptom:** an absolute interpreter path in `.vscode/settings.json` breaks every colleague's checkout
**Cause:** a machine-specific path committed to the repository
**Fix:** `${workspaceFolder}/.venv/bin/python`, or omit the setting entirely and rely on the `./**/.venv` discovery

**Symptom:** a Jupyter notebook cannot import a package you just installed in the terminal
**Cause:** the kernel is a different interpreter from the environment your terminal is in
**Fix:** check `sys.executable` in a cell, and install with the `%pip` magic, which targets the kernel's interpreter. `!pip` targets whatever `PATH` gives the shell, which is the bug

**Symptom:** a CI job passes locally and fails on the runner with a missing dependency
**Cause:** the local environment has something installed that is not in the requirements file or lockfile — often a leftover from a manual `pip install`
**Fix:** treat the lockfile as the source of truth and use `uv sync --locked`, which fails if the lockfile is out of date rather than resolving around it

**Symptom:** a cached `.venv` in CI works for weeks, then produces "no module named" errors for everything
**Cause:** the runner image's Python moved to a new minor version while the cache key did not mention it — [chunk 6](06-when-the-base-interpreter-moves.md), failure 4, delivered by a cache
**Fix:** cache `~/.cache/uv` or `~/.cache/pip` instead, and include the Python version in the key if you cache an environment at all

**Symptom:** a Dockerfile does `RUN . /opt/venv/bin/activate && pip install ...` and the next `RUN` cannot find anything
**Cause:** each `RUN` is a separate shell; sourced changes do not persist between instructions
**Fix:** `ENV PATH="/opt/venv/bin:$PATH"` once, then plain `RUN pip install ...`

**Symptom:** an image built with a venv copied between stages fails at runtime with missing standard-library modules
**Cause:** the two stages used different base images (or different tags), so the interpreter the venv points at is not the one in the runtime image
**Fix:** identical, patch-pinned base images in both stages, and the environment at the identical path

**Symptom:** a development bind mount (`-v $(pwd):/app`) hides the environment inside the container
**Cause:** the environment was created at `/app/.venv` and the mount replaces `/app` wholesale
**Fix:** put the environment outside the mounted directory — `/opt/venv` — or use `UV_PROJECT_ENVIRONMENT` to point it somewhere else

**Symptom:** container logs appear only when the process exits or crashes
**Cause:** stdout is block-buffered when it is not a terminal — not a venv problem at all, but it is always blamed on one
**Fix:** `ENV PYTHONUNBUFFERED=1`, or run with `python -u`. See
[`../06-running-code/05-options-worth-knowing.md`](../06-running-code/05-options-worth-knowing.md)

**Symptom:** a pre-commit hook or a git hook uses the wrong interpreter
**Cause:** hooks run with a minimal environment and a `PATH` that does not include your shell's activation
**Fix:** absolute paths in the hook, or let `pre-commit` manage its own environments — which it does, by creating venvs per hook repository

## Interview questions

**★ How does an editor decide which Python it is using, and why does it get it wrong?**
It uses an explicitly selected interpreter if there is one, otherwise a
configured default, otherwise auto-discovery — VS Code globs the workspace for
`./**/.venv`. It gets it wrong when the environment is created after the editor
indexed the workspace, when the environment is not where discovery looks, when
the language server and the run configuration disagree, or when an absolute path
from someone else's machine is committed in the workspace settings.

**★ Why should CI never activate an environment?**
Because activation is a mutation of an interactive shell's `PATH`, and CI steps
frequently run in separate shells, so it may not persist; and because a path or
`uv run` states the interpreter explicitly, which is easier to read and impossible
to get wrong later in the job. Activation adds a hidden precondition to every
subsequent step.

**★ Is it a good idea to cache the virtual environment in CI?**
Rarely. An environment is not relocatable and is bound to a specific base
interpreter, so a cached one is only valid for an identical runner image, Python
version and absolute path — and it fails silently when any of those changes.
Caching the package cache (`~/.cache/uv`, `~/.cache/pip`) gives most of the speed
with none of the coupling.

**★ Do you need a virtual environment inside a Docker image?**
Not for isolation — the container provides that. You want one when you are doing
a multi-stage build and want to copy a self-contained set of dependencies into a
runtime image without the build toolchain, or when the base image is a distro
Python marked as externally managed. If you use one, replace activation with
`ENV PATH`, keep it at a fixed path outside the working directory, and use the
same patch-pinned base image in both stages.

**★ Why is `ENV PATH="/opt/venv/bin:$PATH"` equivalent to activation?**
Because that is all activation does — prepend the environment's `bin` directory
to `PATH`. Setting it at image scope makes it apply to every subsequent
instruction, the container's entrypoint, and any `docker exec`, none of which
share a shell with the `RUN` where a sourced `activate` would have executed.

---

← Prev: [venv, virtualenv and conda](10-venv-virtualenv-conda.md) · Index: [Virtual environments](README.md) · Next → [Running code](../06-running-code/README.md)
