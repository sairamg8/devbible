---
title: "An installed command is two things installed at two different moments — your code, which an editable install keeps live, and the wrapper plus entry_points.txt, which are written once at install time — so renaming a function breaks the command only when it runs, a new command needs a reinstall, and a wrapper can outlive the interpreter or the package it points at"
sidebar_label: "09 · Stale wrappers and editable installs"
sidebar_position: 11
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-10 against setuptools **84.0.0** *Development mode* ([setuptools.pypa.io](https://setuptools.pypa.io/en/latest/userguide/development_mode.html)), uv **0.12.12** *Cache → Dynamic metadata* ([docs.astral.sh](https://docs.astral.sh/uv/concepts/cache/#dynamic-metadata)) and [CLI reference](https://docs.astral.sh/uv/reference/cli/), the Python 3.14 [`sysconfig`](https://docs.python.org/3.14/library/sysconfig.html), [`venv`](https://docs.python.org/3.14/library/venv.html) and [`importlib.metadata`](https://docs.python.org/3.14/library/importlib.metadata.html) documentation, CPython **v3.14.7** [`Python/ceval.c`](https://github.com/python/cpython/blob/v3.14.7/Python/ceval.c), and pip **26.2.1** [`req_uninstall.py`](https://github.com/pypa/pip/blob/26.2.1/src/pip/_internal/req/req_uninstall.py) and [`wheel.py`](https://github.com/pypa/pip/blob/26.2.1/src/pip/_internal/operations/install/wheel.py).
> Target: **Python 3.14.7** · **uv 0.12.12** · ruff 0.16.6 · pre-commit 4.6.2. Documentation- and source-validated — **no sandbox run, no program output**. Editable-install mechanics in general are topic **10 · Editable installs** *(not written yet)*; this page covers only what they do to commands.

**An editable install makes one half of an installed command live and leaves the other half frozen. Your modules are read from the source tree, so edits take effect on the next run. But the wrapper in the scripts directory and the `entry_points.txt` it was generated from are files written at install time, and nothing rewrites them when you edit. setuptools says it plainly: *"Adding new dependencies, entry-points or changing your project's metadata require a fresh "editable" re-installation."* The failures that follow all have the same shape — the frozen half disagrees with the live half, or with the machine. A renamed function breaks the wrapper only when someone runs it. A new command does not exist until a reinstall. A removed one keeps working. And a wrapper whose interpreter was moved or uninstalled, or whose package was removed by hand, sits on `PATH` pointing at nothing.**

## What is live and what is frozen

| You change | Editable install (`pip install -e .`, uv's project install, `uv tool install --editable .`) | Regular install (`pip install .`, `uv tool install .`) |
|---|---|---|
| a function body, a module's code | live on the next run | 🔴 frozen — reinstall |
| the *name* of the function an entry point names | 🔴 wrapper fails at run time | frozen until reinstall — then it fails |
| the module path an entry point names | 🔴 wrapper fails at run time | the same |
| add, rename or remove a `[project.scripts]` entry | frozen — reinstall (uv's project sync does it for you) | frozen — reinstall |
| add an entry in a plugin group | frozen — `entry_points()` reads the installed `entry_points.txt` | frozen |
| the interpreter the environment was built on | 🔴 every wrapper dies | 🔴 every wrapper dies |

uv's project workflow hides the most common case. Its cache documentation says an editable local project is rebuilt and reinstalled *"if the `pyproject.toml`, `setup.py`, or `setup.cfg` file in the directory root has changed, or if a `src` directory is added or removed"*, so a new `[project.scripts]` entry appears on the next `uv run` or `uv sync` ([07](07-uv-run-and-the-project-command.md)). `pip install -e .` and `uv tool install --editable .` have no such trigger: nothing runs between your edit and your next command.

## The renamed function: a build that passes and a command that fails

```python
# src/invoice_service/cli.py — main() was renamed to run() in a refactor
def run(argv: list[str] | None = None) -> int:
    return 0
```

```toml
[project.scripts]
invoice = "invoice_service.cli:main"      # not updated
```

Nothing notices at build time — uv's build backend does not validate object references ([01](01-what-the-installer-writes.md)) — and nothing notices at install time either: installers check that a script value *has* a callable part, not that the callable exists. The wrapper's `from invoice_service.cli import main` fails only when the command runs, with CPython's standard message, whose format string in `ceval.c` is *"cannot import name %R from %R (%S)"*. Moving the module instead of renaming the function gives `ModuleNotFoundError` for the old path.

The test that catches both, in the project's own suite, without a subprocess — load every entry point the installed distribution declares:

```python
# tests/test_entry_points.py
from importlib.metadata import distribution

import pytest

ENTRY_POINTS = sorted(
    distribution("invoice-service").entry_points,
    key=lambda ep: (ep.group, ep.name),
)


@pytest.mark.parametrize("ep", ENTRY_POINTS, ids=lambda ep: f"{ep.group}:{ep.name}")
def test_entry_point_resolves(ep):
    target = ep.load()                  # import_module + getattr, exactly as a host would
    if ep.group in {"console_scripts", "gui_scripts"}:
        assert callable(target)
```

It reads the *installed* metadata, so it is only as fresh as the last install. Under `uv run pytest` that is not a problem — the edit to `pyproject.toml` triggers the re-install before the test starts. Under a bare `pytest` in a `pip install -e .` environment, re-install first. The end-to-end version, which runs the real wrapper from a real wheel, is in [12](12-when-the-command-fails.md).

## The command that should not exist any more

Reinstalling removes the old wrappers, because uninstalling is driven by what the *installed* distribution recorded. pip's uninstaller collects script files by the entry-point names in the installed metadata (`req_uninstall.py`, the `iter_scripts_to_remove` helper), and uv records every wrapper in `RECORD` when it writes it. So a renamed command disappears on the reinstall that creates its replacement.

A wrapper survives when that bookkeeping is bypassed:

- **The metadata was deleted by hand** — a `rm -rf` of a `.dist-info` or `.egg-info` directory. The wrapper is now owned by nothing, and no uninstall will find it.
- **Another distribution overwrote it** — pip installs with `clobber = True` (*"Ensure old scripts are overwritten"*), so two packages shipping one command name leave one file, owned by whichever installed last; uninstalling that one removes the command the other still expects ([10](10-name-collisions-and-path-shadowing.md)).
- **It lives in a directory shared across interpreters** — see the next section.

## Wrappers that point at nothing

A wrapper names its interpreter by absolute path ([01](01-what-the-installer-writes.md)), so it goes stale whenever that path does:

- **The environment moved.** The `venv` documentation's instruction is to recreate it: *"If you move an environment because you moved a parent directory of it, you should recreate the environment in its new location. Otherwise, software installed into the environment may not work as expected."*
- **The interpreter was uninstalled.** uv's tool docs spell out the tool case — *"If the Python version used by a tool is _uninstalled_, the tool environment will be broken and the tool may be unusable"* ([07c](../02-uv/07c-uv-tool-install.md)) — and the same holds for any environment built on a removed pyenv, Homebrew or system Python.
- **The user scheme shares one `bin` across Python versions.** `sysconfig`'s `posix_user` scheme puts `purelib` in `userbase/lib/pythonX.Y/site-packages` — per version — but `scripts` in `userbase/bin` — for every version at once. `pip install --user invoice-service` under 3.12 and again under 3.14 writes one `~/.local/bin/invoice`, pointing at whichever interpreter ran last; removing that interpreter, or uninstalling from the other version, leaves the file behind or takes it away from the wrong one.

A short audit for a POSIX scripts directory — every file whose shebang names an interpreter that no longer exists (symlinked tool commands are followed to their target):

```python
# tools/find_dead_wrappers.py
import sys
from pathlib import Path


def interpreter_of(script: Path) -> Path | None:
    try:
        with script.open("rb") as fh:
            first = fh.readline().decode("utf-8", "replace").strip()
    except OSError:
        return None
    if not first.startswith("#!") or first.startswith("#!/bin/sh"):
        return None                       # binaries and /bin/sh trampolines: check by hand
    return Path(first[2:].split()[0])


def main(argv: list[str] | None = None) -> int:
    bin_dir = Path((argv or sys.argv[1:] or [str(Path.home() / ".local" / "bin")])[0])
    dead = [p for p in sorted(bin_dir.iterdir())
            if p.is_file() and (exe := interpreter_of(p)) and not exe.exists()]
    for script in dead:
        print(f"{script}  ->  {interpreter_of(script)}")
    return 1 if dead else 0


if __name__ == "__main__":
    raise SystemExit(main())
```

## Gotchas

**★ Symptom: after a refactor the test suite is green, and the installed `invoice` command fails with `ImportError: cannot import name 'main' from 'invoice_service.cli' (…)`.** Cause: the entry point still names the old function; neither the build backend nor the installer checks that the callable exists, and unit tests call the new function directly. Fix: update the entry point, and add the entry-point test above so the next rename fails in CI.

```toml
[project.scripts]
invoice = "invoice_service.cli:run"
```

**★ Symptom: you added `invoice-export` to `[project.scripts]`, and after `pip install -e .` weeks ago the command does not exist.** Cause: wrappers are written at install time; *"Adding new dependencies, entry-points or changing your project's metadata require a fresh "editable" re-installation."* Fix: reinstall.

```bash
pip install -e .
uv sync                     # in a uv project this happens automatically on the next run
```

**★ Symptom: a command you removed from `pyproject.toml` still runs — the old code, or an `ImportError`.** Cause: the wrapper was written by an earlier install and nothing has reinstalled since. Fix: reinstall, which removes the scripts the installed metadata still lists.

```bash
uv sync --reinstall-package invoice-service
```

**★ Symptom: a plugin under development registered a new exporter and the host does not list it.** Cause: `entry_points()` reads the plugin's installed `entry_points.txt`, written when the plugin was installed. Fix: reinstall the plugin.

```bash
uv sync --reinstall-package invoice-plugin-xlsx
```

**★ Symptom: every command in `~/.local/bin` installed with `pip install --user` broke after removing an old Python.** Cause: the user scheme's `scripts` directory is shared by every Python version, and those wrappers named the removed interpreter. Fix: find the dead wrappers, then reinstall the tools you still want — preferably as isolated tools.

```bash
python3 tools/find_dead_wrappers.py ~/.local/bin
uv tool install invoice-service
```

**Symptom: edits to a CLI installed with `uv tool install .` have no effect.** Cause: a non-editable install is a snapshot of the code as well as the wrappers. Fix: reinstall after each change, or install editable while developing.

```bash
uv tool install --editable .
```

**Symptom: a wrapper remains on `PATH` although no installed package claims it.** Cause: the package's metadata directory was deleted by hand, so no uninstall knows the file exists. Fix: remove the file yourself — nothing else will.

```bash
command -v invoice && rm "$(command -v invoice)"
```

**Symptom: in CI the entry-point test passes, but it tested old metadata.** Cause: the job ran `pytest` in an environment installed before the change, without a sync that would reinstall the project. Fix: run the suite through uv, which reinstalls the edited project first.

```bash
uv run --locked pytest
```

## Interview questions

**★ What exactly is "live" in an editable install, and what is not?**
The code. An editable install points the environment at your source tree, so edits to modules take effect on the next run. Everything the installer generated is not: the console-script wrappers in the scripts directory and the `.dist-info` metadata, including `entry_points.txt`, are files written once. setuptools lists entry points among the things that *"require a fresh "editable" re-installation"*. So a changed function body is live, while a new, renamed or removed command — or a new plugin entry — needs a reinstall.

**★ Why does renaming the function an entry point names not fail the build?**
Because nothing between the build and the first run checks that the callable exists. The build backend writes the object reference into `entry_points.txt` as a string — uv's backend explicitly does not validate it — and the installer only checks that a script value has a callable part before writing a wrapper that says `from module import name`. The import runs when the command runs. The fix is a test that iterates the installed distribution's entry points and calls `load()` on each, which performs exactly the wrapper's import.

**Why does reinstalling remove a command you deleted from `pyproject.toml`?**
Because uninstalling is driven by what was recorded at install time, not by the new `pyproject.toml`. pip's uninstaller collects script files by the entry-point names in the installed distribution's metadata, and uv lists each wrapper it writes in the distribution's `RECORD`. A reinstall uninstalls the old distribution — removing its old wrappers — before installing the new one. The wrapper survives only when that record is gone, overwritten by another package, or in a directory shared with other installs.

**How can two Python versions break each other's commands?**
Through the user scheme. `sysconfig` gives `posix_user` a per-version `site-packages` but one `scripts` directory, `userbase/bin`, for all versions. Installing the same tool with `pip install --user` under two versions writes one wrapper whose shebang names whichever interpreter installed last; uninstalling under one version, or removing that interpreter, breaks or removes the command for the other. Isolated tool installs with `uv tool install` or `pipx` avoid it by giving each tool its own environment.

**Why does uv's project workflow usually hide stale wrappers when `pip install -e .` does not?**
Because `uv run` and `uv sync` check whether the editable project needs rebuilding before every run, and uv's heuristic treats a changed `pyproject.toml`, `setup.py` or `setup.cfg` — or a `src` directory appearing or disappearing — as a reason to rebuild and reinstall. Adding a script edits `pyproject.toml`, so the wrapper is regenerated automatically. pip has no step between your edit and your next command. The heuristic has limits — entry points generated from other files need `tool.uv.cache-keys` — and it does not apply to `uv tool install --editable`, whose wrappers change only when the tool is reinstalled.

---

← Prev: [08 · Getting commands to users](08-getting-commands-to-users.md) · [Topic index](README.md) · Next → [10 · Name collisions and `PATH` shadowing](10-name-collisions-and-path-shadowing.md)
