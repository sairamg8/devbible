---
title: "A broken console script fails at exactly one of four stages — the wrapper does not exist, it exists but the shell cannot reach it, it runs but cannot import your code, or it imports your code and exits wrongly — and each stage has a one-line test, so diagnose in that order instead of reinstalling until it works"
sidebar_label: "12 · When the command fails"
sidebar_position: 13
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-10 against every source of this topic's chunks 01–11 — the PyPA *Entry points specification* ([packaging.python.org](https://packaging.python.org/en/latest/specifications/entry-points/)), the Python 3.14 [`importlib.metadata`](https://docs.python.org/3.14/library/importlib.metadata.html) and [command line](https://docs.python.org/3.14/using/cmdline.html) documentation, CPython **v3.14.7** [`Python/ceval.c`](https://github.com/python/cpython/blob/v3.14.7/Python/ceval.c), pip **26.2.1**, uv **0.12.12** ([docs.astral.sh](https://docs.astral.sh/uv/)) and pipx **1.17.2** source — plus the GNU Bash manual's [`type`](https://www.gnu.org/software/bash/manual/html_node/Bash-Builtins.html) and [`hash`](https://www.gnu.org/software/bash/manual/html_node/Bourne-Shell-Builtins.html). Action pins checked 2026-09-10: `actions/checkout` **v7** (v7.0.1), `astral-sh/setup-uv` **v10.0.1** (no floating major tag).
> Target: **Python 3.14.7** · **uv 0.12.12** · ruff 0.16.6 · pre-commit 4.6.2. Documentation-validated — **no sandbox run, no program output; error texts are quoted from the format strings in source**.

**Every failure of an installed command lives at one of four stages, and the stages are ordered: a wrapper file must exist; the shell must resolve the name to that file; the file's interpreter must import the module and attribute the entry point names; and your function must return the right status. Reinstalling blindly fixes the first stage by accident and the others not at all — a dependency missing from `[project.dependencies]` survives any number of reinstalls into your development environment, and a stale wrapper earlier on `PATH` survives them all. The runbook below checks the stages in order with one command each, then shows the CI job that fails before users do: build the wheel, install it into an empty environment, and run the command.**

## Stage 1 — does the wrapper exist?

Ask the environment, not the shell:

```bash
uv run                                              # lists every command in the project environment
ls .venv/bin/invoice                                # POSIX; .venv\Scripts\invoice.exe on Windows
.venv/bin/python -c "from importlib.metadata import entry_points; print(entry_points(group='console_scripts', name='invoice'))"
```

The last line separates *"the metadata says there is an `invoice` command"* from *"a file was written"*. Metadata present, file absent: the environment was modified without the installer (a copied `site-packages`, a hand-deleted file). Neither present:

| Cause | Where it is explained | Fix |
|---|---|---|
| no `[build-system]`, so the project was never installed | [07](07-uv-run-and-the-project-command.md) | add a build system |
| entry point added after the last install (`pip install -e .`, `uv tool install --editable .`, `uv run --no-sync`) | [09](09-stale-wrappers-and-editable-installs.md) | reinstall |
| the command belongs to a dependency of a tool | [08](08-getting-commands-to-users.md) | `--with-executables-from`, `--include-deps` |
| declared in `[project.entry-points."…"]` instead of `[project.scripts]` | [01](01-what-the-installer-writes.md) | move it to `[project.scripts]` |
| installed into a different environment | — | install into this one, or run that one's copy |

## Stage 2 — does the shell reach it?

```bash
type -a invoice                     # every alias, function, builtin and file of that name, in order
echo "$PATH" | tr ':' '\n'
hash -r                             # forget a remembered location, then try again
```

The scripts directory is not on `PATH` — the specification makes that explicitly not the installer's job ([01](01-what-the-installer-writes.md)) — or another `invoice` wins: an earlier directory, a builtin, an alias, a location bash hashed before the new one existed ([10](10-name-collisions-and-path-shadowing.md)). For tools, `uv tool update-shell` or `pipx ensurepath`; for a project, `uv run invoice` or activation.

## Stage 3 — does the wrapper start and import your code?

Look at the first line — it names the interpreter the wrapper will start:

```bash
head -n 2 "$(command -v invoice)"
```

- **The named interpreter does not exist** — the environment moved, or its base Python was uninstalled. Recreate it ([09](09-stale-wrappers-and-editable-installs.md)).
- **The first line is `#!/bin/sh`** — the path was long, contained a space, or the environment is relocatable; the image needs `/bin/sh` ([01](01-what-the-installer-writes.md)).

Then reproduce the wrapper's import with that interpreter — the exact thing the wrapper does, minus the call:

```bash
.venv/bin/python -c "from invoice_service.cli import main"
```

What the import errors mean:

| Error | Meaning | Fix |
|---|---|---|
| `ModuleNotFoundError: No module named 'invoice_service'` | the package is not installed in the interpreter the shebang names — or the wheel does not contain it (backend discovery: [04 · how backends find your package](../04-project-layout/07-how-backends-find-your-package.md)) | install into that environment; check the wheel's contents |
| `ModuleNotFoundError: No module named 'invoice_service.cli'` | the module was moved or renamed, or not included in the wheel | update the entry point; fix packaging |
| a `ModuleNotFoundError` naming a *third-party* package | your code imports a package that is not in `[project.dependencies]` — present in your environment through a dev group or by accident | declare it |
| *"cannot import name %R from %R (%S)"* (CPython's format string) | the function was renamed; the entry point was not | update the entry point ([09](09-stale-wrappers-and-editable-installs.md)) |
| `AttributeError` after a successful import | a dotted attribute path (`module:App.run`) no longer resolves | update the entry point |

The third row is the one reinstalling never fixes. `uv sync` installs the `dev` group by default ([02c](../02-uv/02c-uv-sync-makes-the-environment-match.md)), so a CLI that imports `rich` from the dev group works for every developer and fails for every user who installed the wheel. Only an install without the dev group shows it — which is what the CI job below does.

## Stage 4 — does it exit with the right status?

```bash
.venv/bin/invoice --customer acme; echo "exit status: $?"
```

A failure that exits 0, a success that exits 1, a `BrokenPipeError` traceback when piped into `head`, status 120 at shutdown, a coroutine printed instead of run — all are the function contract ([03](03-the-function-contract.md)). A command that behaves differently as `python -m invoice_service` than as `invoice` is the other door ([04](04-python-m-and-dunder-main.md)): working directory on `sys.path`, a different interpreter, a different `prog`.

## The CI job that fails before users do

Unit tests exercise functions; the entry-point test in [09](09-stale-wrappers-and-editable-installs.md) exercises the metadata of the environment you develop in. Neither installs what users install. This job does — the wheel, without the dev group, without the source tree on `sys.path` — and runs every door:

```yaml
# .github/workflows/installed-command.yml
name: installed command

on:
  push:
  pull_request:

jobs:
  smoke:
    strategy:
      fail-fast: false
      matrix:
        os: [ubuntu-latest, windows-latest, macos-latest]
    runs-on: ${{ matrix.os }}
    defaults:
      run:
        shell: bash
    steps:
      - uses: actions/checkout@v7
      - uses: astral-sh/setup-uv@v10.0.1

      - name: Build the wheel as the world will
        run: uv build --no-sources

      - name: Install it into an empty environment
        run: |
          uv venv "$RUNNER_TEMP/smoke" --python 3.14
          VIRTUAL_ENV="$RUNNER_TEMP/smoke" uv pip install dist/*.whl

      - name: Run every door, from outside the checkout
        working-directory: ${{ runner.temp }}
        run: |
          if [ "$RUNNER_OS" = "Windows" ]; then BIN="$RUNNER_TEMP/smoke/Scripts"; else BIN="$RUNNER_TEMP/smoke/bin"; fi
          "$BIN/invoice" --help
          "$BIN/invoice-export" --help
          "$BIN/python" -m invoice_service --help
          "$BIN/python" - <<'EOF'
          from importlib.metadata import distribution
          for ep in distribution("invoice-service").entry_points:
              ep.load()
              print("ok", ep.group, ep.name)
          EOF
```

What each piece rules out:

- **`uv build --no-sources`** builds the way anyone else will, ignoring `[tool.uv.sources]` ([02 · `uv build`](../02-uv/09b-uv-build-and-uv-publish.md)).
- **A fresh environment and `uv pip install` of the wheel** — no editable install, no dev group, so undeclared dependencies and files the wheel does not contain fail here.
- **`working-directory: ${{ runner.temp }}`** keeps the checkout off `sys.path` for the `-m` step, which puts the working directory first ([04](04-python-m-and-dunder-main.md)).
- **Three operating systems** — Windows gets the `.exe` launcher, and the only place a `gui-scripts` mistake is visible ([02](02-windows-launchers-and-gui-scripts.md)).
- **`ep.load()` on every entry point** catches renamed targets in plugin groups too, which `--help` never reaches.

`actions/checkout@v7` is the current major; `astral-sh/setup-uv` publishes no floating major tag, so it is pinned to the full `v10.0.1` — the reasoning is topic 05's [CI runner](../05-ruff/11b-the-ci-runner.md).

## Gotchas

**★ Symptom: the CLI works for every developer and fails for users with `ModuleNotFoundError` for a third-party package.** Cause: the package is in the dev group (or arrived transitively) but not in `[project.dependencies]`; `uv sync` installs the dev group by default, so no developer ever saw it missing. Fix: declare it — and let the CI job install without the dev group.

```bash
uv add rich
```

**★ Symptom: `invoice: command not found`, and reinstalling "fixes" it only in some shells.** Cause: stage 2, not stage 1 — the file exists, but a shell has a stale hash, a different `PATH`, or an alias. Fix: diagnose the shell, not the package.

```bash
type -a invoice && hash -r
```

**★ Symptom: `ModuleNotFoundError: No module named 'invoice_service'` from the wrapper, although `uv run python -c "import invoice_service"` works.** Cause: the wrapper's shebang names a different interpreter — an old environment, a user-scheme install — than the one `uv run` uses. Fix: read the shebang, then remove or reinstall the stale copy.

```bash
head -n 1 "$(command -v invoice)"
```

**★ Symptom: the installed wheel lacks a module or data file that the editable install had.** Cause: the editable install reads the source tree, so packaging mistakes are invisible until a wheel is installed ([04 · editable installs reopen the hole](../04-project-layout/04-editable-installs-reopen-the-hole.md)). Fix: the wheel-install CI job above.

**Symptom: the CI smoke step passes on Linux and the same wheel fails on Windows.** Cause: a Windows-only path — the `.exe` launcher, `pythonw` for a GUI script, a self-update refused on the running `.exe`. Fix: keep Windows in the matrix; it is the only place those paths run.

```yaml
matrix:
  os: [ubuntu-latest, windows-latest, macos-latest]
```

**Symptom: the `-m` smoke step passes in CI but `python -m invoice_service` fails for users.** Cause: the step ran from the checkout root, so the working directory on `sys.path` supplied the source package. Fix: run it from outside the checkout, as the job's `working-directory` does.

```yaml
working-directory: ${{ runner.temp }}
```

**Symptom: the workflow fails before any step runs, on the `setup-uv` line.** Cause: a floating `@v10` tag, which setup-uv does not publish. Fix: the full version.

```yaml
- uses: astral-sh/setup-uv@v10.0.1
```

## Interview questions

**★ A user reports "your command doesn't work". What do you check, in what order?**
Four stages, in order, each with one command. Does the wrapper exist in the environment — `uv run` with no arguments, or the environment's scripts directory, and `entry_points(group="console_scripts")` for the metadata? Does the shell reach it — `type -a`, `PATH`, `hash -r`? Does it start and import — the shebang line, then `python -c "from pkg.cli import main"` with that interpreter? Does it return the right status — `echo $?`, and the function contract? Each stage has its own causes, and a fix aimed at the wrong stage — typically a reinstall — changes nothing.

**★ Why do unit tests not catch a broken console script?**
Because they import your functions from your development environment, which is not what a user runs. The wrapper is generated at install time from metadata, imports a module path and attribute by name, starts under an interpreter chosen at install time, and runs from an environment that has only `[project.dependencies]` — not the dev group, not the source tree. A renamed function, a module missing from the wheel, and an undeclared dependency all pass unit tests. Building the wheel, installing it into an empty environment and running the command catches all three.

**Why must the smoke test install the wheel rather than run `uv sync` and call the command?**
`uv sync` installs the project editable and the dev group by default. Editable means the source tree answers every import, so files missing from the wheel are invisible; the dev group means dependencies you forgot to declare are present anyway. Installing the built wheel into a fresh environment reproduces a user's install exactly, and building with `--no-sources` reproduces how anyone else will build it.

**How do you tell "the wrong interpreter" from "the package is broken" when the wrapper raises `ModuleNotFoundError` for your own package?**
Read the wrapper's first line and run the same import with the interpreter it names. If that interpreter is not the environment you think — an old venv, a user-scheme install, a removed Python — the package is fine and the wrapper is stale. If it is the right interpreter and the import still fails, the package is not installed there or the wheel does not contain the module; check the wheel's file list and the backend's package discovery.

**What does a cross-platform smoke job buy that a Linux one does not?**
The Windows code paths, which no Linux or macOS run exercises: the `.exe` launcher and its embedded shebang, the console/GUI split and `pythonw`'s missing standard streams, and the rule that a running launcher cannot be the file an upgrade replaces. A `gui-scripts` mistake is invisible everywhere except Windows, so a matrix without it cannot catch one.

---

← Prev: [11 · The import-time cost of a CLI](11-import-time-cost.md) · [Topic index](README.md) · Next topic → **07 · Wheels vs sdists** *(not written yet)*
