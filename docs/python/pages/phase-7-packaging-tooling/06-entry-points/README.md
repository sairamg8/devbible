---
title: "06 · Entry points — a console script is a file the installer writes from three lines of metadata, so the command belongs to one environment, runs your module at import time, and turns your function's return value into the process exit status"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-10 against the PyPA *Entry points specification* ([packaging.python.org](https://packaging.python.org/en/latest/specifications/entry-points/)), the *pyproject.toml specification* ([packaging.python.org](https://packaging.python.org/en/latest/specifications/pyproject-toml/)), the Python 3.14 documentation ([`importlib.metadata`](https://docs.python.org/3.14/library/importlib.metadata.html), [`__main__`](https://docs.python.org/3.14/library/__main__.html), [command line](https://docs.python.org/3.14/using/cmdline.html)), the uv documentation ([docs.astral.sh](https://docs.astral.sh/uv/)), pipx ([pipx.pypa.io](https://pipx.pypa.io/stable/)), and installer source at named tags — pip **26.2.1**, pypa/installer **1.0.1**, uv **0.12.12** — see each chunk's own `> Verified:` line.
> Target: **Python 3.14.7** · **uv 0.12.12** · ruff 0.16.6 · pre-commit 4.6.2. Documentation- and source-validated — **no sandbox run, no program output on any page in this topic**.

**`[project.scripts]` is declared in one line of TOML, and everything that goes wrong with it happens somewhere else: in the wrapper file an installer generates, in the directory that file lands in, in the `PATH` that may or may not include it, in the interpreter path frozen into its first line, and in the import your module performs before your function is ever called. This topic follows a command from metadata to process exit — what pip, pypa/installer and uv actually write, how Windows differs, what the function you name must promise, why `python -m yourpkg` is the door to keep open beside it, how `importlib.metadata` turns the same mechanism into a plugin system, and how the command finally reaches a user through `uv tool install`, `uvx` or `pipx`. The field syntax itself is topic 01's [entry points and console scripts](../01-pyproject-toml/10-entry-points-and-console-scripts.md); this topic owns the installed command and the runtime.**

:::caution In progress
This topic is being written. The chunks below are complete and verified; the rest of the plan,
listed under *Still to come*, is not written yet and will be linked here as each chunk lands.
:::

## Chunks

| # | Chunk | What it argues |
|---|---|---|
| 1 | **[01 · What the installer writes](01-what-the-installer-writes.md)** | `entry_points.txt` at build time, a real file per `console_scripts`/`gui_scripts` name at install time; the pip 26.2.1, installer 1.0.1 and uv 0.12.12 templates verbatim; 🔴 an absolute interpreter shebang — or a `#!/bin/sh` trampoline past 127 bytes, with a space, or when relocatable; `PATH` is not the installer's job; a colon-less value builds with uv_build and fails at install |
| 2 | **[02 · Windows launchers and GUI scripts](02-windows-launchers-and-gui-scripts.md)** | a Windows command is launcher `.exe` + shebang + zip of the same wrapper (installer's eight `t*`/`w*` launchers, distlib's, uv's trampoline); console vs GUI matters only on Windows — 🔴 GUI means `pythonw`, streams that can be `None`, and a shell that does not wait for the exit code; `argv[0]` suffix stripping; a running `.exe` cannot upgrade itself, so pip demands `python -m pip` |
| 3 | **[03 · The function contract](03-the-function-contract.md)** | called with no arguments, return value straight to `sys.exit`: `None` is 0, 🔴 a returned string is status 1, other objects (a coroutine) too, 0–127 only, an escaped exception is 1, Ctrl-C exits via SIGINT; flake8's `main(argv=None) -> int`; exceptions mapped to codes in the entry point, 2 for usage; 🔴 `BrokenPipeError` handled per the SIGPIPE note, as pytest's `_console_main` does, or shutdown makes it 120; testing without a subprocess |

## Still to come

- **04 · `python -m` and `__main__.py`** *(not written yet)*
- **05 · Reading entry points at runtime** *(not written yet)*
- **06 · Plugin discovery patterns** *(not written yet)*
- **07 · `uv run` and the project's own command** *(not written yet)*
- **08 · Getting commands to users — `uv tool`, `uvx`, `pipx`** *(not written yet)*
- **09 · Stale wrappers and editable installs** *(not written yet)*
- **10 · Name collisions and `PATH` shadowing** *(not written yet)*
- **11 · The import-time cost of a CLI** *(not written yet)*
- **12 · When the command fails — a runbook** *(not written yet)*

## Phase gate

You are done with this topic when you can say, for a command that "does not work", which of four
things is broken — the wrapper file does not exist, it exists but is not on `PATH`, it runs but
cannot import your code, or it imports your code and exits with the wrong status — and fix each
without reinstalling blindly; ship a CLI that works as `yourcmd`, as `python -m yourpkg` and as
`uvx yourpkg`; and build a plugin host that finds third-party plugins through an entry-point group
without importing any plugin it was not asked for.

## Where this connects

- [01 · Entry points and console scripts](../01-pyproject-toml/10-entry-points-and-console-scripts.md) — the three `[project]` tables, the object-reference grammar, and the one construct the specification forbids.
- [02 · `uv tool install`](../02-uv/07c-uv-tool-install.md), [`uvx`](../02-uv/07-uvx-and-tools.md) and [`uv run`](../02-uv/04c-uv-run.md) — the uv surfaces a command is installed and run through.
- [02 · `uv sync`](../02-uv/02c-uv-sync-makes-the-environment-match.md) — the project is installed editable, which is when its wrappers are written.
- [04 · `sys.path[0]`](../04-project-layout/02-sys-path-zero.md) and [editable installs](../04-project-layout/04-editable-installs-reopen-the-hole.md) — why `python -m` and a console script can import different copies of your package.
- [04 · `uv init` layouts](../04-project-layout/12-uv-init-layouts.md) — the application template ships a `[project.scripts]` entry and a build system.
- **10 · Editable installs** *(not written yet)* owns editable mechanics; this topic covers only the stale-wrapper angle. **07 · Wheels vs sdists** *(not written yet)* and **12 · Publishing to PyPI** *(not written yet)* are where the wheel carrying `entry_points.txt` is built and shipped.

---

← [Phase index](../README.md) · Start → [01 · What the installer writes](01-what-the-installer-writes.md)
