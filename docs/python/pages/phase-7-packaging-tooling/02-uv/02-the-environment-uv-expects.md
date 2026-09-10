---
title: "uv expects a `.venv` next to your `pyproject.toml`, creates it for you on first use, and deliberately does not put `pip` inside it"
sidebar_label: "02 · The environment uv expects"
sidebar_position: 5
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-10 against **uv 0.12.12** — *Using Python environments*
> ([docs.astral.sh](https://docs.astral.sh/uv/pip/environments/)), *Project structure and files*
> ([docs.astral.sh](https://docs.astral.sh/uv/concepts/projects/layout/)), the uv CLI reference
> ([docs.astral.sh](https://docs.astral.sh/uv/reference/cli/)), CPython's `venv` documentation
> ([docs.python.org](https://docs.python.org/3.14/library/venv.html)) and *Installing packages
> using pip and virtual environments*
> ([packaging.python.org](https://packaging.python.org/en/latest/guides/installing-using-pip-and-virtual-environments/)).
> Version spine: **uv 0.12.12** (2026-09-09) · **Python 3.14.7** · ruff 0.16.6 · pre-commit 4.6.2.
> Documentation-validated, **no sandbox run, no timings**.

**The environment is the piece of a uv project you should stop thinking about, and two facts get
you there. `.venv` is not a convention uv merely prefers — it is the name uv searches for, which
is why using it makes every subsequent command need no arguments. And a uv-created environment
contains no `pip`, which follows directly from uv being a binary outside the environment: it never
needed one, so it does not install one. That single difference from `python -m venv` accounts for
most of the confusion of a first day with uv. Everything in the directory is derived state:
`rm -rf .venv && uv sync` is a normal debugging step, not a recovery operation.**

## `uv venv` and the name that means something

> *"to create a virtual environment at `.venv`"*

> *"A Python version can be requested, e.g., to create a virtual environment with Python 3.11:
> `uv venv --python 3.11`"*
> — both [using Python environments](https://docs.astral.sh/uv/pip/environments/)

`.venv` is the name uv looks for:

> *"When using the default virtual environment name, uv will automatically find and use the
> virtual environment during subsequent invocations."*
> — [using Python environments](https://docs.astral.sh/uv/pip/environments/)

For a *project* you rarely run `uv venv` at all — the environment appears on first use, per
[01b](01b-the-project-uv-sees.md), *"in a `.venv` directory next to the `pyproject.toml`"*
([project structure and files](https://docs.astral.sh/uv/concepts/projects/layout/)). `uv venv`
is for the pip-interface workflow: a directory with a `requirements.txt` and no project.

The flags worth knowing, verbatim from the
[CLI reference](https://docs.astral.sh/uv/reference/cli/):

| Flag | Reference description | When you want it |
|---|---|---|
| `--python` | *"The Python interpreter to use for the virtual environment."* | always, if you care which Python |
| `--seed` | *"Seed the virtual environment with pip, setuptools, and wheel."* | only when a third-party tool demands an in-env pip |
| `--clear` | *"Remove an existing virtual environment at the target location."* | rebuilding after an interpreter upgrade |
| `--allow-existing` | *"Allow creation of a virtual environment in a non-empty directory."* | recovering a half-created env; risky otherwise |
| `--system-site-packages` | *"Give the virtual environment access to the system site-packages."* | almost never — see the gotcha below |
| `--relocatable` | *"Create a virtual environment with a relative path."* | environments that get copied — [02b](02b-activation-and-discovery.md) |
| `--no-project` | *"Avoid discovering the project or workspace."* | making a scratch env inside a project tree |
| `--link-mode` | *"The method to use when installing packages from the global cache."* | cross-filesystem cases — [01d](01d-the-cache-and-the-speed-claim.md) |
| `--python-preference` | *"The strategy for selecting a Python version."* | managed vs system interpreters — [05](05-uv-python.md) |

## 🔴 A uv-created environment has no `pip` in it

This is the day-one surprise, and it follows from uv being external ([01](01-what-uv-is.md)): uv
never needed an installer inside the environment, so it does not put one there. `--seed` exists
precisely because that is unusual — *"Seed the virtual environment with pip, setuptools, and
wheel."*

Contrast CPython's own tool, where pip is the default:

> `--without-pip`: *"Skips installing or upgrading pip in the virtual environment (pip is
> bootstrapped by default)."*
> — [docs.python.org · venv](https://docs.python.org/3.14/library/venv.html)

So `python -m venv .venv` gives you pip and `uv venv` does not. What to do about it:

```bash
uv pip install requests        # ✅ normal path — uv installs, no in-env pip needed
uv venv --seed                 # only when something genuinely shells out to `pip`
```

Things that genuinely need `--seed` are rarer than they look, but they exist: tools that invoke
`pip` as a subprocess, some IDE "install missing package" buttons, and any script that calls
`python -m pip`. Note also what `--seed` installs — pip, setuptools **and** wheel — which means
seeding puts three undeclared packages in an environment you are otherwise treating as a pure
function of your lockfile.

## What is inside the directory, and why that matters later

CPython documents the layout, and it is worth reading because two absolute paths live in here:

> *"It also creates a `bin` (or `Scripts` on Windows) subdirectory containing a copy or symlink
> of the Python executable (as appropriate for the platform or arguments used at environment
> creation time). It also creates a `lib/pythonX.Y/site-packages` subdirectory (on Windows, this
> is `Lib\site-packages`)."*

> *"This creates the target directory (including parent directories as needed) and places a
> `pyvenv.cfg` file in it with a `home` key pointing to the Python installation from which the
> command was run."*
> — both [docs.python.org · venv](https://docs.python.org/3.14/library/venv.html)

`pyvenv.cfg` is the file that makes a directory an environment rather than a folder of files —
which is the same test uv applies when it decides whether to believe `VIRTUAL_ENV`
([02b](02b-activation-and-discovery.md)). It is also the fastest way to answer "which Python is
this environment built on":

```bash
cat .venv/pyvenv.cfg
```

## The environment is derived state

`uv sync` computes the environment from `uv.lock` ([02c](02c-uv-sync-makes-the-environment-match.md)),
and it will create the environment — and download an interpreter if needed —
without being asked. Which means:

```bash
rm -rf .venv && uv sync        # loses nothing that was declared
```

is a legitimate first move when anything about the environment looks wrong. The corollary is the
discipline: **anything you put in the environment without declaring it is not backed up by
anything.** A `uv pip install` inside a project, a file edited in `site-packages`, a hand-written
`.pth` — all of it vanishes on the next exact sync, and that is the design working, not failing.

## Gotchas

**★ Symptom: `pip: command not found` (or `python -m pip` fails) inside a uv-created environment.**
Cause: uv does not install pip into environments it creates; that is what `--seed` is for. Fix:
install through uv, and only seed when a third-party tool truly needs an in-env pip.

```bash
uv pip install requests       # preferred
uv venv --seed                # last resort, for tools that shell out to pip
```

**★ Symptom: your code imports a package that is not in `pyproject.toml`, and CI cannot find it.**
Cause: the environment was created with `--system-site-packages`, so distro-installed packages
are visible locally and absent in a slim container. Fix: rebuild without it and declare what you
actually use.

```bash
uv venv --clear          # rebuild the environment with no system leakage
uv add requests          # declare the dependency you were accidentally borrowing
```

**★ Symptom: `uv venv` refuses to run because the target directory is not empty.**
Cause: something already exists there — a partially created environment, or a directory that
happens to be called `.venv`. Fix: choose deliberately between replacing it and writing into it.

```bash
uv venv --clear            # remove and recreate — the usual answer
uv venv --allow-existing   # write into a non-empty directory — only if you know why
```

**★ Symptom: a nested scratch environment keeps picking up the surrounding project's Python version.**
Cause: `uv venv` discovers the project you are standing in. Fix: tell it not to.

```bash
uv venv --no-project --python 3.13 /tmp/scratch-env
```

**★ Symptom: after upgrading the project's Python version, imports fail with mismatched extension modules.**
Cause: the environment's `site-packages` is version-specific — CPython puts it under
`lib/pythonX.Y/` — and compiled wheels were built for the old minor version. Fix: recreate rather
than repair; there is nothing in there worth saving.

```bash
uv python pin 3.14
rm -rf .venv && uv sync
```

**★ Symptom: `uv venv --seed` "fixed" a problem and then CI failed on an undeclared import.**
Cause: seeding adds pip, setuptools and wheel to the environment — and `setuptools` in particular
provides `pkg_resources`, which some code imports without declaring. It was there locally by
accident. Fix: declare it, and drop the seed.

```bash
uv add setuptools        # if you genuinely import pkg_resources / setuptools
```

**★ Symptom: two projects on one machine keep breaking each other's dependencies.**
Cause: a single shared environment (or `--system`) instead of one per project — the exact failure
virtual environments exist to prevent. The packaging guide's framing: *"packages can be installed
confidently and will not interfere with another project's environment."* Fix: one `.venv` per
`pyproject.toml`, and let uv find it.

```bash
cd service-a && uv sync
cd ../service-b && uv sync
```

## Interview questions

**★ Why does `uv venv` not install `pip`, when `python -m venv` does?**
Because pip is only needed *inside* an environment by a tool that runs inside it, and uv does
not. uv is an external binary that writes into `site-packages` directly, so an in-env installer
would be dead weight — and worse, a second installer with its own resolver and its own idea of
what is installed. CPython's `venv` bootstraps pip by default (its `--without-pip` flag is
described as skipping *"installing or upgrading pip in the virtual environment (pip is
bootstrapped by default)"*) because without it the environment would be unusable. uv inverts the
default and offers `--seed` for the cases where something *else* shells out to `pip`. The
practical consequence is that copy-pasted instructions beginning `pip install …` do not work
inside a uv environment, and the fix is `uv pip install …`, not seeding.

**★ Is there ever a reason to be nervous about deleting `.venv`?**
Only if you have been treating it as storage — packages installed with `uv pip install` and never
declared, a file edited in place inside `site-packages`, a `.pth` someone added by hand. All of
those are undeclared state that `uv sync` cannot reproduce, and losing them to a delete is the
symptom rather than the disease: an *exact* sync would have removed them anyway. In a
correctly-run project the environment is a pure function of `uv.lock`, deleting it is the standard
first debugging step, and uv treats it as regenerable — it is created automatically *"the first
time you run a project command."*

**★ Why does `uv venv --system-site-packages` exist if it is almost always wrong?**
Because a few situations have no alternative: a distribution-packaged module with no wheel on
PyPI, a vendor-supplied binding installed system-wide by an installer you do not control, an
older scientific stack built against system libraries. What makes it dangerous is that it breaks
the one property environments exist for — the packaging guide's *"packages can be installed
confidently and will not interfere with another project's environment"* — and it does so
invisibly. Code imports something that is nowhere in `pyproject.toml`, works on the machine where
the system package happens to exist, and fails in a container built from a slim base. If you must
use it, treat every borrowed import as a documented, deliberate exception.

**★ What makes a directory a virtual environment, as far as uv is concerned?**
`pyvenv.cfg`. CPython's `venv` *"places a `pyvenv.cfg` file in it with a `home` key pointing to
the Python installation from which the command was run"*, and that file is what PEP 405
compliance means in practice — it is why uv can say that a `VIRTUAL_ENV` pointing at *"a directory
that is not a PEP 405 compliant virtual environment"* is simply ignored
([02b](02b-activation-and-discovery.md)). Practically, `cat .venv/pyvenv.cfg` answers two
questions at once: is this really an environment, and which interpreter is it built on — the
second being the thing you actually want to know when a compiled wheel refuses to import.

**Why does the choice of the name `.venv` matter more with uv than with `virtualenv`?**
Because uv treats it as a search key rather than a style preference. uv's docs tie the ergonomics
directly to the name: *"When using the default virtual environment name, uv will automatically
find and use the virtual environment during subsequent invocations."* Call it `env/` or `venv/`
and every uv command either needs an explicit `--python` or needs `VIRTUAL_ENV` exported, you
lose the auto-generated ignore rule that lives inside `.venv`
([01b](01b-the-project-uv-sees.md)), and project commands will still create a `.venv` alongside
your differently-named one. With `virtualenv` the name was arbitrary because activation was
mandatory; with uv the name *is* the wiring.

**A colleague's `uv sync` recreates the environment from scratch every time. What would you check?**
Whether the environment is actually being found, and whether the interpreter it was built against
still exists. If the directory is not named `.venv` and `UV_PROJECT_ENVIRONMENT` is unset, project
commands will use `.venv` and leave the other directory alone — so it looks like a rebuild every
time. If `pyvenv.cfg`'s `home` points at an interpreter that has been upgraded away (a Homebrew
Python that moved from 3.13 to 3.14, a managed interpreter that was pruned), the environment is
no longer viable and re-creating it is correct. Both are answered by reading two things:
`cat .venv/pyvenv.cfg` and `uv python find`.

---

← Prev: [01d · The cache and the speed claim](01d-the-cache-and-the-speed-claim.md) · [Topic index](README.md) · Next → [02b · Activation and discovery](02b-activation-and-discovery.md)
