---
title: "Installing applications, not libraries: a CLI written in Python is not a dependency, and putting it in your project's environment couples two things that have no business being coupled"
sidebar_label: "10 · Applications not libraries"
sidebar_position: 10
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-28 against the uv
> [Tools](https://docs.astral.sh/uv/concepts/tools/) documentation (page last
> updated 2025-11-24), [PEP 668](https://peps.python.org/pep-0668/) — whose
> recommendation to distributors names `pipx` explicitly — and the
> [pipx documentation](https://pipx.pypa.io/stable/).
> Version spine: **Python 3.14.7**.

**`ruff`, `black`, `httpie`, `ansible`, `pre-commit` and `mypy` are written in
Python, but from your project's point of view they are not Python — they are
programs, no different from `jq` or `ripgrep`. Installing them into your
project's virtual environment forces your dependency resolver to satisfy their
requirements alongside yours, for no benefit, and installing them into the
system Python is the thing [chunk 1](01-never-the-system-python.md) is about.
The right answer is a third place: one private environment per application, with
only the executables on your `PATH`.**

## The distinction, and why it is load-bearing

| | A library | An application |
|---|---|---|
| You interact with it via | `import` | a shell command |
| It belongs in | your project's environment | its own environment |
| It appears in | `pyproject.toml` dependencies and the lockfile | a tool install, or a dev dependency if it must match the project |
| Its version is chosen by | your resolver, jointly with everything else | you, independently |

Putting an application in the project environment has three costs that are
easy to miss until they bite:

1. **Resolution coupling.** A linter that pins `click<8.2` now constrains your
   application code's dependency graph, and a genuine conflict makes your
   project uninstallable for a reason that has nothing to do with your project.
2. **Duplication.** Ten projects means ten copies of the same tool, each
   resolved separately, each upgraded separately.
3. **Availability.** The command exists only while that environment is active,
   so a shell without activation cannot lint anything.

There is one important exception. **A tool whose *output* must match the
project's own dependency set belongs in the project.** `mypy` and `pytest` are
the standard examples: `mypy` type-checks against the versions of the libraries
your project actually installs, and `pytest` imports your code and its
dependencies. The uv docs make exactly this call:

> *"If the tool should not be isolated from the project, e.g., when running
> pytest or mypy, then uv run should be used instead of uv tool run."*

So the rule is not "all CLIs go outside". It is: **if the tool needs to see your
dependencies, it goes in the project; if it only needs to see your files, it
goes in its own environment.**

## `uv tool` and `uvx`

Two commands, two lifetimes:

> *"Tools can be invoked without installation using uv tool run, in which case
> their dependencies are installed in a temporary virtual environment isolated
> from the current project."*

> *"Because it is very common to run tools without installing them, a uvx alias
> is provided for uv tool run — the two commands are exactly equivalent."*

> *"Tools can also be installed with uv tool install, in which case their
> executables are available on the PATH — an isolated virtual environment is
> still used, but it is not removed when the command completes."*

```bash
uvx ruff check .                 # run without installing
uv tool install ruff             # install, executables on PATH
uv tool list                     # what is installed
uv tool upgrade ruff             # upgrade one
uv tool upgrade --all            # upgrade everything
uv tool uninstall ruff
uv tool update-shell             # put the executable directory on PATH
```

The guidance on which to use:

> *"In most cases, executing a tool with uvx is more appropriate than installing
> the tool. Installing the tool is useful if you need the tool to be available to
> other programs on your system, e.g., if some script you do not control requires
> the tool, or if you are in a Docker image and want to make the tool available
> to users."*

### The caching rule that surprises people

`uvx` is not "always latest". The docs are precise:

> *"uvx will use the latest available version of the requested tool on the first
> invocation. After that, uvx will use the cached version of the tool unless a
> different version is requested, the cache is pruned, or the cache is
> refreshed."*

So `uvx ruff` on a machine you have used before runs whatever version was cached
then. To force the current release:

```bash
uvx ruff@latest check .        # refresh the cache and use the newest
uvx ruff@0.6.0 check .         # a specific version
uvx --isolated ruff check .    # ignore an installed version without refreshing
```

And once a tool *is* installed, `uvx` defers to it: *"Once a tool is installed
with uv tool install, uvx will use the installed version by default."* That is
the usual explanation for "uvx runs an old version and I never asked it to".

### Tool environments are not yours to edit

> *"When running a tool with uvx, a virtual environment is stored in the uv cache
> directory and is treated as disposable, i.e., if you run uv cache clean the
> environment will be deleted."*

> *"Tool environments are not intended to be mutated directly. It is strongly
> recommended never to mutate a tool environment manually, e.g., with a pip
> operation."*

If a tool needs an extra package — a plugin, a backend, a formatter's optional
dependency — say so at install or run time instead:

```bash
uvx --with <extra-package> <tool>
uv tool install --with <extra-package> <tool-package>
uvx --with '<extra-package>==<version>' <tool-package>
```

and note the failure mode the docs name: *"If the requested version conflicts
with the requirements of the tool package, package resolution will fail and the
command will error."*

There is a second, distinct option for when you want *more executables* rather
than more dependencies:

> *"--with includes additional packages as dependencies but does not install
> their executables. --with-executables-from includes both the packages as
> dependencies and installs their executables."*

```bash
uv tool install --with-executables-from ansible-core,ansible-lint ansible
```

Which interpreter a tool environment is bound to, how uv and `pipx` collide over
executable names, and when to reach for `uv run` instead, are
[the next chunk](11-tool-environments-and-pipx.md).

## Gotchas

**Symptom:** adding a linter to the project broke dependency resolution
**Cause:** the tool's own pins now have to be satisfied jointly with your application's. A tool you only run from the shell has no business in that graph
**Fix:** `uv tool install` or `pipx install` it instead. Keep in the project only the tools that must see your dependencies

**Symptom:** `uvx <tool>` runs an old version and you never pinned one
**Cause:** either the cached environment from the first invocation is being reused, or the tool is installed and `uvx` prefers the installed version
**Fix:** `uvx <tool>@latest` to refresh the cache, or `uvx --isolated <tool>` to bypass the installed version without refreshing

**Symptom:** a tool's plugin is not picked up
**Cause:** the plugin was installed somewhere else, or someone `pip install`ed it into the tool's environment directly, which the docs strongly recommend against
**Fix:** `uv tool install --with <plugin> <tool>` (or `pipx inject`), so the environment is rebuilt with the plugin as a declared part of it

**Symptom:** `uvx --with <package>==<version>` fails to resolve
**Cause:** *"If the requested version conflicts with the requirements of the tool package, package resolution will fail and the command will error"* — the extra package and the tool disagree
**Fix:** relax the pin, or use a tool version whose requirements are compatible. This is a genuine conflict, not a uv quirk

**Symptom:** `uvx` in CI downloads the tool on every job
**Cause:** the cache is empty in a fresh runner, and `uvx` resolves the latest version on first invocation
**Fix:** cache uv's directory, and pin the version — `uvx ruff@0.6.0` — so the job is reproducible rather than tracking upstream releases silently

**Symptom:** two developers get different results from the same linter
**Cause:** unpinned tools resolve to whatever each machine cached first
**Fix:** for anything that gates a build, pin the version explicitly and check the pin into the repository. `pre-commit` exists largely to solve this problem

**Symptom:** a tool environment vanished
**Cause:** `uvx` environments live in the uv cache and are explicitly disposable — `uv cache clean` deletes them
**Fix:** that is by design and costs only a re-resolve. If you need the environment to persist, that is what `uv tool install` is for

**Symptom:** you customised a tool's environment and the customisation disappeared after an upgrade
**Cause:** manual mutation of a tool environment is unsupported — the docs say never to do it — and an upgrade rebuilds the environment from its declared inputs
**Fix:** express the customisation as `--with` at install time, so it is part of the declaration and survives every rebuild

## Interview questions

**★ Why shouldn't you `pip install ruff` into your project's virtual environment?**
Because `ruff` is an application, not a dependency: you invoke it as a command,
never `import` it. Putting it in the project environment makes your resolver
satisfy its requirements jointly with your application's, so a version conflict
in a linter can make your project uninstallable. It also duplicates the tool
across every project and makes the command unavailable in an unactivated shell.
A private environment per tool — `uv tool install` or `pipx install` — gives you
the command on `PATH` and keeps the two dependency graphs apart.

**★ Which tools *should* live inside the project environment?**
The ones whose behaviour depends on your dependencies. `mypy` type-checks against
the installed versions of the libraries you import, and `pytest` imports your
code and its dependencies, so both need to see the project environment — the uv
docs say to use `uv run` rather than `uv tool run` for exactly those two. The
test is whether the tool needs to see your *dependencies* or only your *files*.

**★ What is the difference between `uvx ruff` and `uv tool install ruff`?**
`uvx` (an exact alias for `uv tool run`) creates a disposable environment in the
uv cache, runs the command and leaves the environment cached for speed.
`uv tool install` creates a persistent environment and puts the executables on
your `PATH`, so other programs and other shells can use them. The docs recommend
`uvx` in most cases, and installation when something outside your own shell —
another script, or a user of your Docker image — needs the command to exist.

**Why does `uvx <tool>` sometimes run an old version?**
Two reasons. The first invocation resolves the latest version and caches the
environment; later invocations reuse the cache unless a different version is
requested, the cache is pruned, or it is refreshed. And if the tool has been
installed with `uv tool install`, `uvx` uses the installed version by default.
`@latest` forces a refresh; `--isolated` ignores the installed copy.

**How do you add a plugin to a tool's environment?**
Declaratively, at install or run time — `uv tool install --with <plugin> <tool>`
or `pipx inject <tool> <plugin>` — never by activating the environment and
running `pip`. The uv docs say tool environments are not intended to be mutated
directly, and a manual `pip install` into one is lost the moment the tool is
upgraded or the cache is cleaned.

**How do you make a CI job that uses `uvx` reproducible?**
Pin the tool version in the invocation — `uvx ruff@0.6.0` — rather than relying
on the cache, because a fresh runner has no cache and will resolve the newest
release. Then cache uv's directory for speed. Without the pin, the job's
behaviour changes on the day the tool publishes a release, which is the
definition of a non-reproducible build.

**Where does a `uvx` environment actually live, and what happens to it?**
In uv's cache directory, treated as disposable — `uv cache clean` removes it and
the next invocation recreates it. The caching exists purely to avoid re-resolving
and re-downloading on every run, not to give you a stable place to modify. That
is the technical reason the docs say never to mutate a tool environment by hand.

---

← Prev: [`python` vs `python3`](09-python-vs-python3.md) · Index: [Installing and versions](README.md) · Next → [Tool environments and pipx](11-tool-environments-and-pipx.md)
