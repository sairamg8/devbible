---
title: "In a uv project, uv run invoice works because sync installed your project editable and wrote its wrapper into .venv/bin, then uv put that directory first on the child's PATH — and uv re-installs the project when pyproject.toml changes, so a new [project.scripts] entry appears on the next run unless the build system, --no-sync or dynamic metadata gets in the way"
sidebar_label: "07 · uv run and the project command"
sidebar_position: 8
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-10 against **uv 0.12.12** — *Running commands in projects* ([docs.astral.sh](https://docs.astral.sh/uv/concepts/projects/run/)), *Configuring projects → Entry points* ([docs.astral.sh](https://docs.astral.sh/uv/concepts/projects/config/#entry-points)), *Cache → Dynamic metadata* ([docs.astral.sh](https://docs.astral.sh/uv/concepts/cache/#dynamic-metadata)), the [CLI reference](https://docs.astral.sh/uv/reference/cli/) (live, 2026-09-10), and the source of [`crates/uv/src/commands/project/run.rs`](https://github.com/astral-sh/uv/blob/0.12.12/crates/uv/src/commands/project/run.rs) at the 0.12.12 tag.
> Version spine: **uv 0.12.12** (2026-09-09) · Python 3.14.7 · ruff 0.16.6 · pre-commit 4.6.2. Documentation- and source-validated — **no sandbox run, no program output**.

**`uv run` does not know what `invoice` is. It syncs the project environment, which installs your project editable and — because the project has a build system — makes the installer write `.venv/bin/invoice`; then it starts the command with the environment's scripts directory prepended to `PATH`, so the name resolves to that wrapper before anything else on your machine. Every "`uv run invoice` fails" case is one of those links breaking: no build system, so no install and no wrapper; a stale install that predates the entry point; `--no-sync` skipping the re-install; metadata the re-install heuristic cannot see; or a name that is not a command at all. uv's own documentation settles the question topic 02 left open — edits to `pyproject.toml` trigger a rebuild and re-install of the project — and the source shows the rest.**

## The chain, link by link

```toml
# pyproject.toml
[project]
name = "invoice-service"
version = "1.4.0"
requires-python = ">=3.12"
dependencies = []

[project.scripts]
invoice = "invoice_service.cli:main"

[build-system]
requires = ["uv_build>=0.12.12,<0.13"]
build-backend = "uv_build"
```

```bash
uv run invoice --customer acme
```

1. **Sync.** *"When using `run`, uv will ensure that the project environment is up-to-date before running the given command"* ([running commands](https://docs.astral.sh/uv/concepts/projects/run/)). Lock, sync and discovery are topic 02's [`uv run`](../02-uv/04c-uv-run.md).
2. **Install the project, editable.** Sync installs the project itself as an editable package ([`uv sync`](../02-uv/02c-uv-sync-makes-the-environment-match.md)) — which is when the installer writes the wrapper ([01](01-what-the-installer-writes.md)). This link needs a build system: uv's configuration docs say *"Using the entry point tables requires a build system to be defined."* Without one the project is not installed and no wrapper exists ([02 · the project uv sees](../02-uv/01b-the-project-uv-sees.md)).
3. **Prepend the scripts directory.** In `run.rs` (lines 1269–1293) uv builds the child's `PATH` from the ephemeral environment's scripts directory if there is one, then the project environment's, then your inherited `PATH`, and sets `VIRTUAL_ENV` for a virtual environment (lines 1301–1304). So `invoice` resolves to `.venv/bin/invoice` even when another `invoice` exists earlier on your own `PATH` — and any subprocess your command starts sees the same order.
4. **Spawn.** The wrapper runs, its shebang picks `.venv/bin/python`, and your function's return value becomes the exit status, which `uv run` reports back.

## When the name is not a command

With no command at all, `uv run` lists what it could run. From `run.rs` (lines 1205–1263): it prints *"Provide a command or script to invoke with `uv run <command>` or `uv run <script>.py`."* and then, under *"The following commands are available in the environment:"*, every executable file in the environment's scripts directory, minus the `activate` scripts. That is the fastest check that the wrapper exists:

```bash
uv run            # lists the environment's commands; is `invoice` there?
```

When the name is not found, the error is generic. The spawn at lines 1319–1322 carries a `TODO(zanieb): Throw a nicer error message if the command is not found` and fails with the context *"Failed to spawn: `{}`"*. "Failed to spawn: `invoice`" therefore means only "no executable of that name on the constructed `PATH`" — go back to the chain above.

The four spellings that reach the same function, and what each needs:

| You type | What runs | Needs |
|---|---|---|
| `uv run invoice` | the wrapper in `.venv/bin` | a build system, and the project installed since the entry point was added |
| `uv run -m invoice_service` | `invoice_service/__main__.py` | a `__main__.py` ([04](04-python-m-and-dunder-main.md)); `-m` since uv 0.4.18 |
| `uv run python -m invoice_service` | the same, spelled out | the same |
| `uv run src/invoice_service/cli.py` | 🔴 the file *as a script* — *"`uv run file.py` is equivalent to `uv run python file.py`"* | nothing, and that is the problem: the file runs as `__main__` with its own directory on `sys.path`, so relative imports fail and a second copy of the module can load |

## A new entry point appears on the next run — here is why

Topic 02 left this explicitly unconfirmed ([02c](../02-uv/02c-uv-sync-makes-the-environment-match.md)). uv's cache documentation settles it:

> *"By default, uv will _only_ rebuild and reinstall local directory dependencies (e.g., editables) if the `pyproject.toml`, `setup.py`, or `setup.cfg` file in the directory root has changed, or if a `src` directory is added or removed. This is a heuristic and, in some cases, may lead to fewer re-installs than desired."*
> — [cache → dynamic metadata](https://docs.astral.sh/uv/concepts/cache/#dynamic-metadata)

Your project is a local directory installed editable. Adding `invoice-export = "invoice_service.cli:export_main"` to `[project.scripts]` edits `pyproject.toml`, so the next `uv run` or `uv sync` rebuilds and reinstalls the project and the new wrapper is written. Renaming or removing an entry works the same way: the old installation's recorded files, wrappers included, are removed with it ([01](01-what-the-installer-writes.md)).

The heuristic misses entry points that are *not* spelled out in those files — a `setup.py` computing them from another file, a build-backend plugin generating them, `[project] dynamic = ["scripts"]` filled by the backend. For those, widen the cache key, remembering that it replaces the defaults:

> *"Setting `tool.uv.cache-keys` will replace defaults, so any necessary files (like `pyproject.toml`) should still be included in the user-defined cache keys."*

```toml
[tool.uv]
cache-keys = [{ file = "pyproject.toml" }, { file = "commands.toml" }]
```

or take the documented escape hatch, at the cost of a rebuild on every run:

```toml
[tool.uv]
reinstall-package = ["invoice-service"]
```

The one-off version of the same thing is the flag topic 02 already recommends:

```bash
uv sync --reinstall-package invoice-service
```

## Flags that skip the chain

- **`--no-sync`** — *"Avoid syncing the virtual environment."* No sync means no re-install, so a wrapper added since the last sync does not exist yet and a renamed one still does.
- **`--frozen`** — *"Run without updating the `uv.lock` file"*; it still syncs from the lock. It is about the lockfile, not the wrapper.
- **`--package`** — *"Run the command in a specific package in the workspace."* In a workspace, a member's commands exist only once that member is installed into the shared environment; `--all-packages` is *"Run the command with all workspace members installed."*
- **`--with`** — adds packages in *"a separate, ephemeral environment"* layered over the project's, and its scripts directory goes first on `PATH`: a tool's command brought in with `--with` shadows a same-named one from your project for that run.
- **`--no-editable`** — *"Install any editable dependencies, including the project and any workspace members, as non-editable."* The wrapper is written either way; what changes is whether it imports your source tree or an installed copy, which is the choice a production image wants ([02e](../02-uv/02e-uv-inside-a-container-image.md)).

## `uv run invoice` is a developer command, not an `ENTRYPOINT`

uv *"does not cede control of the process to the spawned command"* — it stays in the process tree forwarding signals, and it syncs before every start ([04d](../02-uv/04d-uv-run-as-a-process.md)). In an image, sync once at build time and start the wrapper — or the module — directly:

```dockerfile
RUN uv sync --locked --no-dev --no-editable
ENTRYPOINT ["/app/.venv/bin/invoice"]
```

The `-m` form avoids the wrapper's shebang, which matters when the path is long enough for the `#!/bin/sh` trampoline and the image has no shell ([01](01-what-the-installer-writes.md)).

## Gotchas

**★ Symptom: `uv run invoice` fails with *"Failed to spawn: `invoice`"* in a project created with an old `uv init`.** Cause: no `[build-system]`, so the project was never installed and no wrapper was written — *"Using the entry point tables requires a build system to be defined."* Fix: add a build system and a package directory (or force installation with `tool.uv.package = true` if a backend can build it).

```toml
[build-system]
requires = ["uv_build>=0.12.12,<0.13"]
build-backend = "uv_build"
```

**★ Symptom: a command added to `[project.scripts]` works with `uv run` but not with `.venv/bin/invoice-export` typed directly.** Cause: nothing has synced since the edit; `uv run` re-installed the project on its way in, typing the path does not. Fix: sync, then use the path.

```bash
uv sync && .venv/bin/invoice-export
```

**★ Symptom: `uv run --no-sync invoice-export` fails while `uv run invoice-export` works.** Cause: `--no-sync` skips the re-install that writes the new wrapper. Fix: sync once, then `--no-sync` is safe.

```bash
uv sync --locked
uv run --no-sync invoice-export
```

**★ Symptom: entry points generated by the build backend from another file never update.** Cause: uv re-installs an editable project only when `pyproject.toml`, `setup.py` or `setup.cfg` change, or `src` appears or disappears — *"a heuristic"*. Fix: add the real source of the metadata to `tool.uv.cache-keys`, keeping `pyproject.toml` in the list.

```toml
[tool.uv]
cache-keys = [{ file = "pyproject.toml" }, { file = "commands.toml" }]
```

**Symptom: `uv run src/invoice_service/cli.py` fails with *"attempted relative import with no known parent package"*, or runs with two copies of the module loaded.** Cause: a path ending in `.py` is run as a script — the file becomes `__main__` with its own directory first on `sys.path`, outside its package. Fix: run the command or the module.

```bash
uv run invoice
uv run -m invoice_service
```

**Symptom: in a workspace, `uv run api-server` works from the root but a sibling member's command is "Failed to spawn".** Cause: that member is not installed into the environment for this run. Fix: run in the member, or install every member.

```bash
uv run --package invoice-worker invoice-worker
uv run --all-packages invoice-worker
```

**Symptom: during one `uv run --with some-tool invoice`, a different `invoice` runs.** Cause: the `--with` environment's scripts directory is prepended ahead of the project's, so a same-named command from `some-tool` wins. Fix: do not layer a package that ships your command's name; if you must, name the path.

```bash
uv run --with some-tool .venv/bin/invoice
```

**Symptom: the container's `invoice` process does not shut down cleanly, and start-up re-resolves on every restart.** Cause: `ENTRYPOINT ["uv", "run", "invoice"]` syncs on each start and keeps uv in the tree between the orchestrator and your process. Fix: sync at build time, exec the wrapper.

```dockerfile
ENTRYPOINT ["/app/.venv/bin/invoice"]
```

## Interview questions

**★ What has to be true for `uv run invoice` to work?**
The project must have a build system, so that sync installs it; it must have been synced since the `[project.scripts]` entry was added, so the wrapper exists in `.venv/bin`; and the name must match the entry exactly. `uv run` then prepends the environment's scripts directory to the child's `PATH` and spawns the name, so the wrapper wins over anything else on your machine. If any link is missing, uv's only report is *"Failed to spawn"* — run bare `uv run` to list what the environment actually contains.

**★ Does adding a console script require a manual re-install in a uv project?**
Not normally. uv's cache documentation says it rebuilds and reinstalls editable local projects when `pyproject.toml`, `setup.py` or `setup.cfg` change, or a `src` directory appears or disappears — and adding a `[project.scripts]` entry edits `pyproject.toml`. So the next `uv run` or `uv sync` writes the new wrapper. It does need a manual step when the entry points come from somewhere the heuristic does not watch — dynamic metadata, a backend plugin, a separate file — or when you passed `--no-sync`; then `tool.uv.cache-keys`, `reinstall-package`, or `uv sync --reinstall-package` fix it.

**Why does a command started with `uv run` find the project's other commands too?**
Because uv sets the child's `PATH` itself: the ephemeral `--with` environment's scripts directory, then the project environment's, then your inherited `PATH`, and it sets `VIRTUAL_ENV`. The wrapper's shebang already guarantees the right interpreter for the command itself; the `PATH` order guarantees that anything the command runs by name — another console script, a `subprocess.run(["alembic", ...])` — resolves inside the same environment first.

**Why is `uv run src/invoice_service/cli.py` different from `uv run invoice`?**
A path ending in `.py` is a script, which uv's CLI reference defines as *"equivalent to `uv run python file.py`"*. Python runs that file as `__main__` with its directory — `src/invoice_service/` — first on `sys.path`, so it is outside its package: relative imports have no parent, and if something imports `invoice_service.cli` by name the same source loads a second time. `uv run invoice` runs the generated wrapper, which imports the module under its real name from the installed project.

**Why not use `uv run` as a container's `ENTRYPOINT`?**
Because it re-syncs the environment on every start and, by design, stays in the process tree forwarding signals rather than handing the process over — reasonable for a developer command, a cost for PID 1. An image should sync once at build time, with `--locked`, `--no-dev` and usually `--no-editable`, and start `/app/.venv/bin/invoice` or `/app/.venv/bin/python -m invoice_service` directly.

---

← Prev: [06b · Plugin hosts in the wild](06b-plugin-hosts-in-the-wild.md) · [Topic index](README.md) · Next → [08 · Getting commands to users](08-getting-commands-to-users.md)
