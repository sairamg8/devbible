---
title: "Tool environments and pipx: which interpreter a tool is bound to, why uv refuses to overwrite pipx's executables, and when uv run is the right answer instead"
sidebar_label: "11 · Tool environments and pipx"
sidebar_position: 11
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-28 against the uv
> [Tools](https://docs.astral.sh/uv/concepts/tools/) documentation (page last
> updated 2025-11-24), the [pipx documentation](https://pipx.pypa.io/stable/),
> and [PEP 668](https://peps.python.org/pep-0668/), whose recommendations to
> distributors name `pipx` explicitly.
> Version spine: **Python 3.14.7**.

**A tool environment is a virtual environment you do not own and are told not to
touch, bound to an interpreter chosen independently of whatever project you are
standing in. Both of those properties are deliberate and both produce
characteristic failures: a tool that breaks when you remove a Python version, and
an install that refuses to proceed because another tool manager already owns that
executable name.**

### Which Python a tool runs on

> *"Each tool environment is linked to a specific Python version. This uses the
> same Python version discovery logic as other virtual environments created by
> uv, but will ignore non-global Python version requests like .python-version
> files and the requires-python value from a pyproject.toml."*

That is deliberate — a tool should not change version because you `cd`'d into a
project — and it has a sharp consequence:

> *"If the Python version used by a tool is uninstalled, the tool environment will
> be broken and the tool may be unusable."*

Use `uv tool install --python 3.14 <tool>` when you care, and reinstall tools
after removing an interpreter they were built on.

### Executables, and the collision with pipx

> *"Tool executables include all console entry points, script entry points, and
> binary scripts provided by a Python package. Tool executables are symlinked
> into the executable directory on Unix and copied on Windows."*

> *"Executables provided by dependencies of tool packages are not installed."*

> *"Installation of tools will not overwrite executables in the executable
> directory that were not previously installed by uv. For example, if pipx has
> been used to install a tool, uv tool install will fail. The --force flag can be
> used to override this behavior."*

That last one is the standard experience of migrating from pipx to uv: the
install fails, correctly, because something else owns that executable name.
`pipx uninstall <tool>` first, or `--force` if you know what you are replacing.

## `pipx`

`pipx` is the older tool with the same model — one isolated environment per
application, executables exposed on `PATH` — built on `pip` and `venv`.

```bash
pipx install ruff
pipx run ruff check .        # like uvx: run without installing
pipx list
pipx upgrade ruff
pipx upgrade-all
pipx inject <tool> <extra-package>   # add a dependency to a tool's environment
pipx ensurepath              # add pipx's bin directory to PATH
pipx reinstall-all           # rebuild every tool env, e.g. after a Python upgrade
```

It is worth knowing rather than treating as legacy for one reason: PEP 668's
recommendations to distributors name it directly —

> *"Consider arranging things so your distro's package / environment for Python
> for end users (e.g., python3 on Fedora or python3-full on Debian) depends on
> pipx."*

and the Debian error message quoted in [chunk 1](01-never-the-system-python.md)
recommends `pipx install xyz` by name. So on a machine where `uv` is not
available or not permitted, `pipx` is the answer your distribution is already
pointing you at.

## The relationship to `uv run`

The docs give the equivalence explicitly:

> *"The invocation uv tool run `<name>` (or uvx `<name>`) is nearly equivalent to:
> `uv run --no-project --with <name> -- <name>`"*

with four stated differences: the package is inferred from the command name, the
temporary environment is cached, `--no-project` is implied because tools are
always run isolated from the project, and `uv tool run` will use an installed
version where `uv run` will not.

Which gives a clean decision rule:

| The tool needs to… | Use |
|---|---|
| see your project's dependencies (`pytest`, `mypy`) | `uv run` |
| see only your files (`ruff`, `black`, `httpie`) | `uvx` or `uv tool install` |
| be available to other programs or to a Docker image's users | `uv tool install` / `pipx install` |
| be importable from your code | it is a library — put it in `pyproject.toml` |


## Gotchas

**Symptom:** the tool installs but the command is not found
**Cause:** the executable directory is not on `PATH`. Both tools warn about this and both provide a fixer
**Fix:** `uv tool update-shell` or `pipx ensurepath`, then open a new shell — a `PATH` change does not reach an already-running one

**Symptom:** `uv tool install` fails saying the executable already exists
**Cause:** something else — usually pipx — owns that name in the executable directory, and uv refuses to overwrite executables it did not install
**Fix:** uninstall the other copy first, or pass `--force` if you have decided to replace it. The refusal is protecting you from an invisible swap

**Symptom:** an installed tool stopped working after you removed a Python version
**Cause:** each tool environment is bound to a specific interpreter, and the docs say plainly that removing it leaves the environment broken
**Fix:** reinstall the tool (`uv tool install --force`, or `pipx reinstall-all`), and pass `--python` when you want a tool bound to a version you intend to keep

**Symptom:** `.python-version` in the project is ignored when running a tool
**Cause:** deliberate — tool environments ignore non-global version requests like `.python-version` and `requires-python`, so a tool does not change interpreter as you move between projects
**Fix:** if a tool genuinely must run on the project's interpreter, that is a sign it should be a project dependency run through `uv run`

**Symptom:** an executable you expected from a tool's dependency is missing
**Cause:** *"Executables provided by dependencies of tool packages are not installed"* — only the named package's own entry points are exposed
**Fix:** `--with-executables-from <package>` names the dependency whose executables you also want. `--with` alone adds the dependency but not its commands

**Symptom:** on Windows, replacing a tool leaves a stale executable behind
**Cause:** executables are symlinked on Unix but *copied* on Windows, so the copy does not follow a changed target
**Fix:** reinstall rather than expecting an in-place update, and be aware that a Windows tool executable is a snapshot rather than a pointer

**Symptom:** `pytest` run through `uvx` cannot import the project's code
**Cause:** `uv tool run` is always isolated from the project — that isolation is the point of a tool environment
**Fix:** `uv run pytest`. The docs name `pytest` and `mypy` as the canonical cases where `uv run` is correct and `uv tool run` is not

**Symptom:** every tool broke after upgrading the interpreter they were installed with
**Cause:** the tool environments still point at the removed interpreter
**Fix:** `pipx reinstall-all`, or reinstall the uv tools. Doing this as a deliberate step after any interpreter removal turns a mysterious future failure into a two-minute task

**Symptom:** a shared machine has some tools under pipx and some under uv, and nobody knows which
**Cause:** both put executables in the same conventional directory, and both are happy to coexist until they collide
**Fix:** `uv tool list` and `pipx list` together give the full picture. Pick one manager per machine and migrate the rest

## Interview questions

**★ Why does `uv tool install` refuse to overwrite an executable installed by pipx?**
Because uv only overwrites executables it installed itself. If pipx owns
`~/.local/bin/ruff`, silently replacing it would change what that command means
with no record of why, and the two managers would then disagree about what is
installed. The failure is the safe behaviour; `--force` is available once you
have decided the replacement is what you want.

**★ Is pipx obsolete now that uv exists?**
No — and PEP 668's recommendations to distributors name pipx explicitly,
suggesting distros make their end-user Python package depend on it. Debian's
`EXTERNALLY-MANAGED` message recommends `pipx install` by name. So on a machine
where you cannot install uv, pipx is the route the operating system itself is
pointing you at, and it implements the same one-environment-per-application
model.

**★ What decides which Python version a tool runs on?**
uv's normal discovery logic, but with project-scoped requests deliberately
ignored — a `.python-version` file or a `requires-python` in the current
directory does not change a tool's interpreter, so the tool behaves the same
wherever you run it. You pin it explicitly with `--python`, and you have to
remember that removing that interpreter breaks the tool environment until it is
reinstalled.

**When is `uv run` the right answer rather than `uvx`?**
Whenever the tool must see the project's dependencies. `uv tool run` is always
isolated from the project — the docs list that as one of its defining
differences from `uv run` — so `pytest`, which imports your code, and `mypy`,
which type-checks against your installed library versions, both need `uv run`.
The two commands are otherwise near-equivalent: `uvx <name>` is close to
`uv run --no-project --with <name> -- <name>`.

**What is the difference between `--with` and `--with-executables-from`?**
`--with` adds a package as a dependency of the tool environment but does not
expose its commands; `--with-executables-from` adds the package *and* installs
its executables. The Ansible example in the docs is the archetype: installing
`ansible` with executables from `ansible-core` and `ansible-lint` puts all three
packages' commands on `PATH` from one shared environment.

**Why are tool executables symlinked on Unix and copied on Windows?**
Because Windows symlink support is conditional on privileges and configuration,
so uv copies instead. The practical difference is that a Unix executable follows
its target when the environment changes, while a Windows one is a snapshot —
which is why an in-place update can appear not to take on Windows and a
reinstall fixes it.

**A colleague's `mypy` reports errors yours does not, on the same commit. Where do you look first?**
At which environment each `mypy` is seeing. If one of you is running it through
a tool environment it is type-checking against whatever library versions that
isolated environment happens to have, not the project's — so the stubs and the
installed package versions differ. Running it with `uv run mypy`, against the
project's own environment and lockfile, makes the result a function of the
repository rather than of the machine.

---

← Prev: [Installing applications, not libraries](10-installing-applications.md) · Index: [Installing and versions](README.md) · Next → [Free-threaded builds](12-free-threaded-builds.md)
