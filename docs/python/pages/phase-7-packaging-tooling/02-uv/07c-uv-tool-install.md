---
title: "`uv tool install` gives a command its own permanent environment and puts only its executables on `PATH` — its modules are never importable, its version constraint is remembered by every upgrade, and it breaks if the Python it was built on disappears"
sidebar_label: "07c · uv tool install"
sidebar_position: 29
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-10 against **uv 0.12.12** — *Tools* ([docs.astral.sh](https://docs.astral.sh/uv/concepts/tools/)),
> *Using tools* ([docs.astral.sh](https://docs.astral.sh/uv/guides/tools/)), *Storage*
> ([docs.astral.sh](https://docs.astral.sh/uv/reference/storage/)), *Configuration files*
> ([docs.astral.sh](https://docs.astral.sh/uv/concepts/configuration-files/)) and the CLI reference
> ([docs.astral.sh](https://docs.astral.sh/uv/reference/cli/)).
> Version spine: **uv 0.12.12** (2026-09-09) · Python 3.14.7 · **ruff 0.16.6** · pre-commit 4.6.2.
> Documentation-validated, **no sandbox run, no timings**.

**`uv tool install` is the `pipx install` half of uv: one command, one dedicated virtual environment in
uv's tools directory, and the command's executables linked into a directory that should be on your
`PATH`. The design has four consequences that each produce a support question. The tool's modules are
deliberately not importable anywhere else, so installing `black` as a tool does not let your code
`import black`. The version constraint you gave at install time is stored and respected by every
`uv tool upgrade`, so `upgrade` never crosses a bound you set months ago. The environment is tied to
the interpreter it was created with, so uninstalling that interpreter breaks the tool. And tool
commands ignore your project's configuration entirely — they operate at the user level — so an
internal index configured in `pyproject.toml` does not exist for them.**

## What an install creates, and where

> *"Tools can also be installed with `uv tool install`, in which case their executables are available
> on the `PATH`."*

> *"When installing a tool with `uv tool install`, a virtual environment is created in the uv tools
> directory."*
> — both [tools](https://docs.astral.sh/uv/concepts/tools/)

The two directories involved, from the storage reference:

| What | Default | Override |
|---|---|---|
| tool environments | *"a `tools/` subdirectory of the persistent data directory, e.g., `~/.local/share/uv/tools`"* | `UV_TOOL_DIR` |
| tool executables | Unix: `$XDG_BIN_HOME`, then `$XDG_DATA_HOME/../bin`, then `$HOME/.local/bin` · Windows: `%XDG_BIN_HOME%`, `%XDG_DATA_HOME%\..\bin`, `%USERPROFILE%\.local\bin` | `UV_TOOL_BIN_DIR` |

— [storage](https://docs.astral.sh/uv/reference/storage/)

`uv tool dir` prints the first — *"Show the directory where uv tool commands are installed"* — and
`uv tool list` *"List all installed tool commands"* ([CLI reference](https://docs.astral.sh/uv/reference/cli/)).
If the executable directory is not on `PATH`:

> *"If it's not on the `PATH`, a warning will be displayed and `uv tool update-shell` can be used to add
> it to the `PATH`."*
> — [using tools](https://docs.astral.sh/uv/guides/tools/)

```bash
uv tool install ruff@0.16.6
uv tool list
uv tool update-shell          # only if the install warned that the bin directory is not on PATH
uv tool uninstall ruff
```

## Which executables land on `PATH` — and which do not

> *"Tool executables include all console entry points, script entry points, and binary scripts provided
> by a Python package."*

> *"Executables provided by dependencies of tool packages are not installed."*

> *"Installation of tools will not overwrite executables in the executable directory that were not
> previously installed by uv."*
> — all three [tools](https://docs.astral.sh/uv/concepts/tools/)

The second sentence matters for metapackages and wrappers: if the command you want is defined by a
*dependency* of the package you installed, it is in the tool's environment but not on your `PATH`.
Install the package that actually declares the command. The third sentence is a safety property — a
`ruff` from Homebrew or an old `pip install --user` is not silently replaced — and `--force`, *"Force
reinstall even if already installed"*, is the deliberate override
([CLI reference](https://docs.astral.sh/uv/reference/cli/)).

## 🔴 A tool's modules are not importable

> *"Unlike `uv pip install`, installing a tool does not make its modules available in the current
> environment."*
> — [using tools](https://docs.astral.sh/uv/guides/tools/)

That is the whole value of a tool environment: the tool's dependencies cannot conflict with your
project's, because they are never in the same environment. The price is that "I installed it" does not
mean "my code can use it". If your code imports it, it is a dependency, and it goes in
`pyproject.toml` ([04](04-add-and-remove.md)).

## Versions and upgrades: the constraint is remembered

> *"Unless a specific version is requested, `uv tool install` will install the latest available of the
> requested tool."*

> *"Tool upgrades will respect the version constraints provided when installing the tool."*
> — both [tools](https://docs.astral.sh/uv/concepts/tools/)

So the constraint is part of the install, not of the moment. `uv tool install 'black<24'` today means
every `uv tool upgrade black` stays below 24 until you *re-install* with a different constraint — which
is the documented way to change it. The upgrade verbs, as the tools page shows them:

```bash
uv tool upgrade black                               # within the stored constraint
uv tool upgrade --all                               # every installed tool
uv tool upgrade black --upgrade-package click       # one dependency inside the tool's environment
uv tool upgrade black --reinstall                   # rebuild every package in it
uv tool install 'black>=24'                         # change the stored constraint
```

`uv tool install` also accepts the `{package}@{version}` and `{package}@latest` forms that `uvx` does
([07b](07b-uvx-versions-sources-and-plugins.md)).

## The interpreter is part of the tool

> *"Each tool environment is linked to a specific Python version."*

> *"If the Python version used by a tool is _uninstalled_, the tool environment will be broken and the
> tool may be unusable."*
> — both [tools](https://docs.astral.sh/uv/concepts/tools/)

This is the same property every virtual environment has ([02b](02b-activation-and-discovery.md)) —
an environment is a redirection layer over one interpreter — made visible because tools outlive the
projects they were installed alongside. Removing an old managed Python ([05](05-uv-python.md)) is the
usual trigger. Choose the interpreter at install time when it matters:

```bash
uv tool install --python 3.14 ruff@0.16.6
```

## Do not modify a tool environment by hand

> *"Tool environments are not intended to be mutated directly. It is strongly recommended never to
> mutate a tool environment manually."*
> — [tools](https://docs.astral.sh/uv/concepts/tools/)

A plugin belongs in the install command, where uv records it and re-creates it on upgrade:

```bash
uv tool install --with mkdocs-material mkdocs
```

> *"Tool environments may be upgraded via `uv tool upgrade`, or re-created entirely via subsequent
> `uv tool install` operations"*
> — [tools](https://docs.astral.sh/uv/concepts/tools/)

## Tools in a project, a team and an image

Why tool commands ignore your project's configuration — and what that does to an internal index — and
how to choose between a tool install, a dev dependency and `uvx`, including provisioning tools in a
build image, is [07d](07d-tools-config-and-choosing.md).

## Gotchas

**★ Symptom: `uv tool install httpie` succeeded and `http` is "command not found".**
Cause: the executable directory is not on `PATH`; uv says *"a warning will be displayed and
`uv tool update-shell` can be used to add it to the `PATH`."* Fix:

```bash
uv tool update-shell
exec "$SHELL" -l            # start a new login shell so the change is read
```

**★ Symptom: `import black` fails in your project although `uv tool install black` succeeded.**
Cause: *"installing a tool does not make its modules available in the current environment."* Fix: if
your code imports it, declare it.

```bash
uv add --dev black
```

**★ Symptom: `uv tool upgrade black` reports nothing to do, though a new major version is out.**
Cause: *"Tool upgrades will respect the version constraints provided when installing the tool"* — an
old install with an upper bound is still in force. Fix: re-install with the constraint you want now.

```bash
uv tool install 'black>=24'
```

**★ Symptom: an installed tool stopped working after you cleaned up old Python versions.**
Cause: *"If the Python version used by a tool is uninstalled, the tool environment will be broken."*
Fix: re-create it on an interpreter you are keeping.

```bash
uv tool install --force --python 3.14 ruff@0.16.6
```

**★ Symptom: `uv tool install ruff` refuses to install the `ruff` executable.**
Cause: a `ruff` not installed by uv already occupies the executable directory, and uv *"will not
overwrite executables … that were not previously installed by uv."* Fix: find out what owns it, then
decide.

```bash
command -v ruff                     # whose ruff is this?
uv tool install --force ruff@0.16.6 # replace it deliberately
```

**Symptom: a plugin you added to a tool's environment with `uv pip install` vanished after `uv tool upgrade`.**
Cause: tool environments *"are not intended to be mutated directly"*; the upgrade re-created it from
what uv recorded, which did not include your change. Fix: record the plugin in the install.

```bash
uv tool install --with mkdocs-material mkdocs
```

**Symptom: the tool installed fine, but a command you expected from it is missing.**
Cause: that command is declared by one of the tool's *dependencies*, and *"executables provided by
dependencies of tool packages are not installed."* Fix: install the package that declares the command
as the tool itself.

```bash
uv tool list                     # shows the executables each installed tool provides
uv tool install jupyterlab       # the package that declares the command you want
```

## Interview questions

**★ Why can't your code import a package you installed with `uv tool install`?**
Because isolation is the purpose of a tool environment. Each tool gets its own virtual environment so
its dependencies can never conflict with your project's or with another tool's; uv states the
consequence directly: *"Unlike `uv pip install`, installing a tool does not make its modules available in
the current environment."* If your code imports something, that something is a dependency of your
project and belongs in `pyproject.toml`. A tool install is for a *command*, not a *library*.

**★ How does `uv tool upgrade` treat the version you asked for at install time?**
As a standing constraint. *"Tool upgrades will respect the version constraints provided when installing
the tool"*, so an install of `'black<24'` keeps every later upgrade below 24, indefinitely. That is the
right behaviour — you set the bound for a reason — and it surprises people who have forgotten setting
it. The documented way to change the bound is to re-run `uv tool install` with the new constraint;
`upgrade` never widens it. The same page shows the finer controls: `--upgrade-package` to move one
dependency inside the tool's environment, and `--reinstall` to rebuild it.

**What happens to installed tools when you remove the Python they were created with, and why?**
They break. *"Each tool environment is linked to a specific Python version"*, and *"if the Python
version used by a tool is uninstalled, the tool environment will be broken and the tool may be
unusable."* A tool environment is a virtual environment, and every virtual environment is a thin layer
over one interpreter — its `pyvenv.cfg` names that interpreter's home. Remove the interpreter and the
layer points at nothing. The fix is to re-create the tool on an interpreter you are keeping, with
`--python` to make the choice explicit; the prevention is to check `uv tool list` before cleaning up
managed Pythons.

**Why does `uv tool install` refuse to overwrite an existing executable, and what does `--force` change?**
Because the executable directory is shared with everything else that puts commands in `~/.local/bin` —
an old `pip install --user`, a `pipx` install, a hand-copied binary — and silently replacing one of
those would change what a command means on your machine without telling you. uv documents the rule:
*"Installation of tools will not overwrite executables in the executable directory that were not
previously installed by uv."* `--force` is the deliberate override, described as *"Force reinstall even
if already installed"*. The right sequence is to find out what owns the existing command first
(`command -v ruff`), decide which one you want, and only then force — otherwise you may have replaced a
tool some other part of your setup depends on.

---

← Prev: [07b · uvx — versions, sources, plugins](07b-uvx-versions-sources-and-plugins.md) · [Topic index](README.md) · Next → [07d · Tools: config and choosing](07d-tools-config-and-choosing.md)
