---
title: "uv tool install, uvx and pipx deliver a command by installing your package into a private environment and exposing only that package's console and GUI scripts on PATH — so a package with no [project.scripts] cannot be a tool, a command that lives in a dependency is invisible, a name that differs from the package needs --from or pipx.run, and plugins must be installed into the tool's environment, not beside it"
sidebar_label: "08 · Getting commands to users"
sidebar_position: 10
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-10 against **uv 0.12.12** — *Tools* ([docs.astral.sh](https://docs.astral.sh/uv/concepts/tools/)), *Using tools* ([docs.astral.sh](https://docs.astral.sh/uv/guides/tools/)), the [CLI reference](https://docs.astral.sh/uv/reference/cli/), the [0.8.x changelog](https://github.com/astral-sh/uv/blob/0.12.12/changelogs/0.8.x.md) and source ([`commands/tool/common.rs`](https://github.com/astral-sh/uv/blob/0.12.12/crates/uv/src/commands/tool/common.rs), [`commands/tool/run.rs`](https://github.com/astral-sh/uv/blob/0.12.12/crates/uv/src/commands/tool/run.rs)); **pipx 1.17.2** — *How pipx works*, *Making packages compatible*, *Expose apps*, *Inject packages*, *Configure paths* ([pipx.pypa.io](https://pipx.pypa.io/stable/)) and [`commands/common.py`](https://github.com/pypa/pipx/blob/1.17.2/src/pipx/commands/common.py); PyPUG *Installing stand alone command line tools* and *Creating and packaging command-line tools* ([packaging.python.org](https://packaging.python.org/en/latest/guides/creating-command-line-tools/)).
> Version spine: **uv 0.12.12** · **pipx 1.17.2** · Python 3.14.7 · ruff 0.16.6 · pre-commit 4.6.2. Documentation- and source-validated — **no sandbox run, no program output**.

**A user who wants your command does not want your dependencies in their environment, and does not want theirs in yours. That is the problem the packaging guide says tool installers solve — *"pipx solves this by creating a virtual environment for each package, while also ensuring that its applications are accessible through a directory that is on your `$PATH`"* — and `uv tool install` and `uvx` solve it the same way. For you as the author, the consequences are specific. The tool installer exposes the console and GUI scripts of the package it was asked for and nothing else, so a command defined by a dependency does not appear and a package with no `[project.scripts]` is refused outright. The command name is looked up by package name first, so a mismatch needs `--from` or a `pipx.run` entry. The tool's environment is private, so plugins discovered through entry points must be installed *into* it. And the executable directory is still the user's `PATH` problem. The day-to-day uv mechanics are topic 02's ([`uvx`](../02-uv/07-uvx-and-tools.md), [versions and plugins](../02-uv/07b-uvx-versions-sources-and-plugins.md), [`uv tool install`](../02-uv/07c-uv-tool-install.md), [choosing](../02-uv/07d-tools-config-and-choosing.md)); this page is what they mean for the command you ship.**

## What a tool installer exposes

**uv:**

> *"Tool executables include all console entry points, script entry points, and binary scripts provided by a Python package. Tool executables are symlinked into the executable directory on Unix and copied on Windows."*

> *"Executables provided by dependencies of tool packages are not installed."*
> — both [Tools](https://docs.astral.sh/uv/concepts/tools/)

**pipx:** console and GUI scripts go *"into ``PIPX_BIN_DIR`` (default ``~/.local/bin``), for example ``~/.local/bin/black`` -> ``~/.local/share/pipx/venvs/black/bin/black``"*, and *"That launcher runs the venv's own Python against the installed package, so the app always uses its isolated dependencies and never your system site-packages."* A dependency's commands are likewise *"not exposed by default"* ([Expose apps](https://pipx.pypa.io/stable/how-to/expose-apps/)).

So what reaches `PATH` is exactly the wrappers from [01](01-what-the-installer-writes.md) that belong to the named package, linked (or copied, on Windows) from the tool's private environment. The shebang inside each still names that environment's interpreter, which is why the link keeps working from `~/.local/bin`.

When there is nothing to expose, uv refuses. From `commands/tool/common.rs`: *"No executables are provided by package `{}`; removing tool"*. A library with no `[project.scripts]` is not a tool.

## When the command lives in a dependency

A meta-package, or a thin distribution that depends on the one declaring the command, installs fine and exposes nothing useful. Both installers have an explicit override:

```bash
uv tool install --with-executables-from ansible-core,ansible-lint ansible   # uv
pipx install nox --include-deps                                             # pipx: every dependency's apps
pipx install "nox[tox_to_nox]" --include-resources-from tox                 # pipx: one dependency's apps
```

uv's version landed in 0.8.5 (*"Support installing additional executables in `uv tool install`"*), and its docs draw the line against `--with`: *"`--with` includes additional packages as dependencies but does not install their executables"*, while *"`--with-executables-from` includes both the packages as dependencies and installs their executables"*. For `uvx`, the source adds a hint when the command exists only in a dependency — *"An executable named `{}` is not provided by package `{}` but is available via the dependency `{}`. Consider using `{}` instead."* (`commands/tool/run.rs`).

The author's fix is simpler: declare the command in the package users will install.

## When the command name is not the package name

`uvx NAME` and `pipx run NAME` both start from the assumption that the package and the command share a name — uv's CLI reference says *"By default, the package to install is assumed to match the command name."* `invoice-service` shipping `invoice` breaks the assumption:

```bash
uvx --from invoice-service invoice --customer acme     # uv: name the package
pipx run --spec invoice-service invoice                # pipx: the long form
```

`uv tool install` does not have the problem — *"Unlike `uvx`, `uv tool install` operates on a _package_ and will install all executables provided by the tool"* — and neither does `pipx install`. For `pipx run` the author can remove it with the `pipx.run` group ([06b](06b-plugin-hosts-in-the-wild.md)):

```toml
[project.scripts]
invoice = "invoice_service.cli:main"

[project.entry-points."pipx.run"]
invoice-service = "invoice_service.cli:main"
```

The sources read here show no equivalent group for `uvx`; document the `--from` form in your README.

## Plugins belong inside the tool's environment

A CLI that discovers plugins through entry points ([05](05-reading-entry-points-at-runtime.md)) reads the `sys.path` of the interpreter it runs under — the tool's private environment. A plugin installed anywhere else, including the user's project, is invisible to it. Both installers let the plugin be recorded as part of the tool, so upgrades keep it:

```bash
uv tool install --with invoice-plugin-xlsx invoice-service
uvx --from invoice-service --with invoice-plugin-xlsx invoice export --format xlsx
pipx install invoice-service
pipx inject invoice-service invoice-plugin-xlsx
```

pipx notes that *"Injected packages do not add their entry points to your ``PATH`` by default"* — `--include-apps` exposes them — which is the right default for plugins: they register entry points in your group, not commands.

## `PATH` is still the last mile

The specification leaves `PATH` to the user ([01](01-what-the-installer-writes.md)); the tool installers help without taking it over.

- uv warns when its executable directory is missing from `PATH` — the source's message begins *"`{}` is not on your PATH. To use installed tools, run"* followed by `uv tool update-shell` — and `uv tool dir --bin` prints the directory.
- pipx warns *"'\{local_bin_dir\}' is not on your PATH"* and points to `pipx ensurepath`; *"Pass ``--prepend`` to ``pipx ensurepath`` to prepend the pipx bin directory to ``PATH`` instead of appending it, so pipx-installed binaries win over system binaries of the same name."*
- Neither overwrites a file it did not create. uv: *"Installation of tools will not overwrite executables in the executable directory that were not previously installed by uv. For example, if `pipx` has been used to install a tool, `uv tool install` will fail."* pipx logs *"File exists at … Not modifying."* Collisions are [10](10-name-collisions-and-path-shadowing.md).

pipx 1.17.2 has one more thing to know: it now prefers uv underneath — *"When the **uv backend** is active (the default whenever uv is available, via the ``pipx[uv]`` extra or on ``PATH``) pipx skips the shared environment and uses ``uv venv`` and ``uv pip`` instead"*. The environments it creates are still pipx's.

## Developing a CLI you also use as a tool

`uv tool install .` builds a snapshot: later edits to the source do nothing until you reinstall. For a CLI you are working on, install it editable — *"Install the target package in editable mode, such that changes in the package's source directory are reflected without reinstallation"* ([CLI reference](https://docs.astral.sh/uv/reference/cli/)):

```bash
uv tool install --editable .
```

Code changes are then live; new or renamed commands are not, because the wrappers in the tool's bin directory were written at install time ([09](09-stale-wrappers-and-editable-installs.md)). Re-run the install after editing `[project.scripts]` — uv's CLI reference says *"If the tool was previously installed, the existing tool will generally be replaced."*

## What to put in your README

```bash
uv tool install invoice-service            # permanent, isolated, on PATH
uvx --from invoice-service invoice --help  # one-off run, cached environment
pipx install invoice-service               # the same with pipx
python -m invoice_service --help           # inside any environment that has it installed
```

## Gotchas

**★ Symptom: `uv tool install your-library` fails with *"No executables are provided by package `your-library`; removing tool"*.** Cause: the package declares no `[project.scripts]` or `[project.gui-scripts]`, so there is nothing for a tool install to expose. Fix: add a console script if the package is meant to be run, or tell users to add it as a dependency instead.

```toml
[project.scripts]
your-library = "your_library.cli:main"
```

**★ Symptom: `uv tool install ansible` succeeds but `ansible-lint` is "command not found".** Cause: *"Executables provided by dependencies of tool packages are not installed."* Fix: ask for them.

```bash
uv tool install --with-executables-from ansible-core,ansible-lint ansible
```

**★ Symptom: `uvx invoice-service` says the package provides no executable of that name.** Cause: uvx assumes the command matches the package; yours is `invoice`. Fix: `--from`, and document it.

```bash
uvx --from invoice-service invoice
```

**★ Symptom: the tool runs, but `invoice export --format xlsx` says no such exporter, although `invoice-plugin-xlsx` is installed.** Cause: the plugin is installed in some other environment; entry-point discovery reads only the tool's own. Fix: install it into the tool.

```bash
uv tool install --with invoice-plugin-xlsx invoice-service
pipx inject invoice-service invoice-plugin-xlsx
```

**★ Symptom: after `uv tool install .`, edits to the CLI's code have no effect.** Cause: a non-editable tool install is a snapshot of the source at install time. Fix: reinstall, or install editable while developing.

```bash
uv tool install --editable .
```

**Symptom: with an editable tool install, a newly added subcommand works but a newly added *command* does not exist.** Cause: code is live in an editable install, wrappers are not — they were written when the tool was installed. Fix: install again after changing `[project.scripts]`.

```bash
uv tool install --editable --force .
```

**Symptom: `pipx run invoice-service` needs `--spec` every time.** Cause: pipx looks for a console script named after the package. Fix: add a `pipx.run` entry named after the package.

```toml
[project.entry-points."pipx.run"]
invoice-service = "invoice_service.cli:main"
```

**Symptom: the tool installed, the warning scrolled past, and the command is not found.** Cause: the executable directory is not on `PATH`. Fix: let the installer edit the shell configuration, then start a new shell.

```bash
uv tool update-shell
pipx ensurepath
```

## Interview questions

**★ Why install a CLI with `uv tool install` or `pipx` rather than into your project or the system Python?**
Because a command and a library have opposite needs. A command needs its own dependency versions and nobody else's; the packaging guide describes the global alternative as causing *"version conflicts"* and breaking *"dependencies the operating system has on Python packages"*. Tool installers give each package a private virtual environment and link only its commands into one directory on `PATH`, so tools cannot conflict with each other or with your projects. The flip side is that the tool's modules are not importable from your code — if your code imports it, it is a dependency.

**★ Which executables does a tool install put on `PATH`, and why not the dependencies' too?**
Only those declared by the package you named: uv lists *"all console entry points, script entry points, and binary scripts provided by a Python package"* and adds that *"Executables provided by dependencies of tool packages are not installed"*; pipx behaves the same by default. Exposing every dependency's commands would scatter unrelated binaries into a shared directory and create collisions nobody asked for. When a dependency's command is really wanted, it is requested explicitly — `--with-executables-from` in uv (since 0.8.5), `--include-deps` or `--include-resources-from` in pipx.

**How do you ship a command whose name differs from the package name, and what does that cost users?**
`uv tool install` and `pipx install` are unaffected — they operate on the package and expose all its commands. The one-off runners are not: `uvx` and `pipx run` assume the command is named after the package, so users write `uvx --from invoice-service invoice` or `pipx run --spec invoice-service invoice`. A `pipx.run` entry point named after the package removes the extra argument for pipx; for uvx, document `--from`.

**A CLI discovers plugins through entry points. Where must the plugin be installed when the CLI is a tool?**
In the tool's environment. `importlib.metadata.entry_points()` reads the `sys.path` of the running interpreter, which for a tool is its private virtual environment; a plugin in the user's project or in another tool is invisible. `uv tool install --with PLUGIN TOOL`, `uvx --with`, and `pipx inject` all install into the tool's environment and record the addition so upgrades keep it. pipx's default of not exposing injected packages' entry points fits plugins, which register in a group rather than shipping commands.

**What is the difference between `uv tool install .` and `uv tool install --editable .` for a CLI under development?**
The first builds and installs a snapshot, so later edits have no effect until you reinstall. The second installs the package editable, so code changes are live — but the wrappers on `PATH` were generated at install time, so adding, renaming or removing a command in `[project.scripts]` still needs the install to be re-run. It is the same split between live code and install-time metadata that every editable install has.

---

← Prev: [07 · `uv run` and the project command](07-uv-run-and-the-project-command.md) · [Topic index](README.md) · Next → [09 · Stale wrappers and editable installs](09-stale-wrappers-and-editable-installs.md)
