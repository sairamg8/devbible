---
title: "uv is one static binary that lives outside every environment it manages, and that single structural fact explains almost everything else it does"
sidebar_label: "01 · What uv actually is"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-10 against **uv 0.12.12** — the uv documentation home
> ([docs.astral.sh](https://docs.astral.sh/uv/)), *Locking and syncing*
> ([docs.astral.sh](https://docs.astral.sh/uv/concepts/projects/sync/)), *Project structure and
> files* ([docs.astral.sh](https://docs.astral.sh/uv/concepts/projects/layout/)), *pip
> compatibility* ([docs.astral.sh](https://docs.astral.sh/uv/pip/compatibility/)), and
> *Installing packages using pip and virtual environments*
> ([packaging.python.org](https://packaging.python.org/en/latest/guides/installing-using-pip-and-virtual-environments/)).
> Version spine: **uv 0.12.12** (2026-09-09) · Python 3.14.7 · ruff 0.16.6 · pre-commit 4.6.2.
> Documentation-validated, **no sandbox run, no timings**.

**uv is a single statically-linked executable written in Rust that manages Python
environments from the outside. Every other Python packaging tool you have used — pip,
pip-tools, virtualenv, pipx — is itself a Python program that must be installed *into* an
interpreter before it can act on that interpreter. uv is not. It needs no Python to run, it
is not a package inside the environment it modifies, and it can install an interpreter that
does not yet exist on the machine. That inversion is not packaging trivia: it removes the
bootstrap ordering problem, it lets one binary drive several interpreters at once, and it is
why uv can split "work out which versions to use" from "put files on disk" into two commands
with two separate failure modes. Learn the split and the rest of uv reads as consequence.**

## What it claims to replace, in its own words

The documentation home is unusually direct about scope:

> *"An extremely fast Python package and project manager, written in Rust."*
> — [docs.astral.sh/uv](https://docs.astral.sh/uv/)

> *"A single tool to replace `pip`, `pip-tools`, `pipx`, `poetry`, `pyenv`, `twine`, `virtualenv`, and more."*
> — [docs.astral.sh/uv](https://docs.astral.sh/uv/)

Read that list as a map of the surface you have to learn, because each entry corresponds to a
different uv subcommand group with different rules:

| It replaces | With | Covered in |
|---|---|---|
| `virtualenv`, `python -m venv` | `uv venv` and the implicit `.venv` | [02](02-the-environment-uv-expects.md) |
| `pip install` | `uv add`, `uv sync` (and `uv pip install` as the escape hatch) | [04](04-add-and-remove.md), [06c](06c-uv-pip.md) |
| `pip-tools` (`pip-compile`/`pip-sync`) | `uv lock` + `uv sync`, or `uv pip compile` | [03](03-the-lockfile.md), [06e](06e-uv-pip-install-sync-and-compile.md) |
| `pyenv` | `uv python install`, `uv python pin` | [05](05-uv-python.md) |
| `pipx` | `uvx` / `uv tool install` | [07](07-uvx-and-tools.md) |
| `twine` | `uv publish` | topic **12 · Publishing to PyPI** *(not written yet)* |

Two of uv's other highlights matter for how you structure a project:

> *"Provides comprehensive project management, with a universal lockfile."*

> *"Includes a pip-compatible interface for a performance boost with a familiar CLI."*
> — both [docs.astral.sh/uv](https://docs.astral.sh/uv/)

Those are **two different interfaces to the same resolver**, and the single most common way
to get confused by uv is to mix them. The project interface (`uv add`, `uv lock`, `uv sync`,
`uv run`) owns `pyproject.toml` and `uv.lock`. The pip interface (`uv pip install`,
`uv pip compile`, `uv pip sync`) owns nothing — it mutates whatever environment it finds and
keeps no record. [06c](06c-uv-pip.md) through [06f](06f-migrating-from-requirements-to-a-project.md) are entirely about that seam.

## The binary is outside the environment — what that buys

`pip` ships inside a virtual environment. That is why `pip install --upgrade pip` is a
program rewriting its own files while running, why `python -m pip` is the safe invocation and
bare `pip` is not, and why a broken environment often cannot repair itself. uv sidesteps the
whole category:

> *"Installable without Rust or Python via `curl` or `pip`."*
> — [docs.astral.sh/uv](https://docs.astral.sh/uv/)

Concretely, because uv is one external binary:

- **There is no bootstrap step.** You do not create an environment, activate it, then
  upgrade the installer inside it. `uv venv` and `uv sync` both work with nothing installed
  anywhere.
- **A uv-created environment contains no installer at all.** `uv venv` does not put `pip` in
  the new environment; that requires the explicit `--seed` flag, whose reference description
  is *"Seed the virtual environment with pip, setuptools, and wheel"*
  ([CLI reference](https://docs.astral.sh/uv/reference/cli/)). This surprises people daily and
  it is [02](02-the-environment-uv-expects.md)'s first gotcha.
- **One uv drives many interpreters.** The interpreter is an *argument* (`--python 3.13`), not
  the host of the tool, so nothing about uv's own installation constrains which Python
  versions you can use.
- **uv can install Python itself.** A tool living inside an interpreter cannot provision
  interpreters without a chicken-and-egg problem. uv *"bundles a list of downloadable CPython
  and PyPy distributions for macOS, Linux, and Windows"*
  ([Python versions](https://docs.astral.sh/uv/concepts/python-versions/)) — see
  [05](05-uv-python.md).

## Resolution and installation are two phases, two artefacts, two failure modes

This is the sentence to memorise:

> *"Locking is the process of resolving your project's dependencies into a lockfile. Syncing
> is the process of installing a subset of packages from the lockfile into the project
> environment."*
> — [locking and syncing](https://docs.astral.sh/uv/concepts/projects/sync/)

Four consequences fall straight out of it.

**1 · The resolver does not need the target environment to exist.** Its inputs are your
declared requirements, `requires-python`, and what the index says. Its output is a file. That
is why the lockfile can describe platforms you are not sitting on:

> *"`uv.lock` is a universal or cross-platform lockfile that captures the packages that would
> be installed across all possible Python markers such as operating system, architecture, and
> Python version."*
> — [project structure and files](https://docs.astral.sh/uv/concepts/projects/layout/)

A `pip freeze` cannot do this, because `pip freeze` reads an environment rather than computing
over an index. [03](03-the-lockfile.md) works that difference in full.

**2 · Install is the only phase that mutates the filesystem.** So `uv lock` in CI is safe on a
machine you do not want changed, and `uv sync` is the step whose failures are about platforms,
wheels and compilers.

**3 · The two failures need different fixes.** A message about incompatible constraints or
`requires-python` came from the resolver — the fix is in `pyproject.toml`. A message about a
missing wheel, a C compiler, or a build backend came from the installer — the fix is a system
package, a `--no-build-isolation`, or a different Python version. Diagnosing an installer
failure by editing version ranges is the most common wasted hour with any Python packaging
tool.

**4 · Both phases are automatic unless you say otherwise.**

> *"Locking and syncing are automatic in uv. For example, when `uv run` is used, the project
> is locked and synced before invoking the requested command."*
> — [locking and syncing](https://docs.astral.sh/uv/concepts/projects/sync/)

That automation is a gift locally and a hazard in CI and in a container image, where you want
the lockfile treated as read-only. The flags that switch it off — `--frozen`, `--locked`,
`--no-sync` — are [02d](02d-frozen-and-locked-in-ci.md).

## Where the rest of this topic goes

The project surface uv reads — the three files, `uv init`, and the `[build-system]` rule that
decides whether *your* code gets installed — is [01b](01b-the-project-uv-sees.md). Installing
and pinning uv itself, including the `uv version` trap, is
[01c](01c-installing-and-pinning-uv.md). The global cache and the mechanisms behind uv's
published speed claim are [01d](01d-the-cache-and-the-speed-claim.md).

## Gotchas

**★ Symptom: a command works in your shell and CI resolves something completely different.**
Cause: you are using two interfaces. `uv pip install` mutates an environment and records
nothing; `uv add`/`uv sync` records everything in `uv.lock`. A local `uv pip install` is
invisible to CI — and worse, it is *removed* the next time `uv sync` runs, because sync is
exact. Fix: declare it.

```bash
uv add httpx            # writes pyproject.toml AND uv.lock
git add pyproject.toml uv.lock
```

**★ Symptom: `uv` is installed but every project command says it cannot find a project.**
Cause: uv locates a project by walking up for `pyproject.toml`, and there is none — you are in
a `requirements.txt` repository. Fix: either adopt a `pyproject.toml`, or stay on the pip
interface, which does not need one.

```bash
uv pip install -r requirements.txt      # no project needed
```

**★ Symptom: you spend an hour widening version ranges to fix a failure that was never a resolution failure.**
Cause: the resolve/install split means the two phases print different kinds of error, and
`uv sync` runs both, so the output arrives interleaved with one exit code. Fix: separate them
and see which one fails.

```bash
uv lock --check     # resolution only: is uv.lock consistent with pyproject.toml?
uv sync --frozen    # installation only: use the lockfile as-is, do not resolve
```

If `uv lock --check` passes and `uv sync --frozen` fails, the problem is a wheel, a compiler
or a platform — not your constraints.

**★ Symptom: `which pip` inside a uv-created environment finds nothing, and every tutorial you follow starts with `pip install`.**
Cause: uv is external, so it never needed pip in the environment, and it does not put one
there. Fix: use uv's own installer, or ask for pip explicitly when a third-party tool insists
on it.

```bash
uv pip install requests          # uv installs into the environment; no pip needed
uv venv --seed                   # only if something genuinely requires pip in the env
```

**★ Symptom: activating a venv, then running `uv pip install`, then finding the package in a different environment.**
Cause: an activated environment and uv's *project* environment are resolved by different
rules — the pip interface follows `VIRTUAL_ENV`, project commands use the project's `.venv`.
Fix: stop activating, and let uv name the environment.

```bash
uv run python -c "import sys; print(sys.executable)"   # prints the project interpreter
```

The full rule set for that seam is [02](02-the-environment-uv-expects.md).

## Interview questions

**★ Why does it matter that uv is not written in Python?**
Because a packaging tool written in Python is a package inside the environment it must modify,
and that creates ordering problems no amount of good design removes: you need an interpreter
before you can install the installer, upgrading the installer means a program rewriting
itself, and a broken environment can lose the ability to repair itself. A single external
binary has none of those. It also makes the interpreter an argument rather than a host, which
is what allows one uv to manage several Python versions and to *install* Python versions —
uv's docs describe it as *"Installable without Rust or Python via `curl` or `pip`"* and as
bundling *"a list of downloadable CPython and PyPy distributions"*. The Rust part is what
makes it fast; the *external binary* part is what makes it structurally different, and the
structure is the more important half.

**★ What is the difference between locking and syncing, and why is it worth having two commands?**
uv's own definition: locking *"is the process of resolving your project's dependencies into a
lockfile"*, syncing *"is the process of installing a subset of packages from the lockfile into
the project environment"*. Two commands because the phases have different inputs, different
outputs and different failure modes. Locking reads declared requirements plus the index and
writes one file — no environment required, which is why the result can be *universal* across
operating systems and Python versions. Syncing reads that file and writes to a specific
environment on a specific platform. In CI you want the first phase forbidden (`--locked`) and
the second phase to be the only thing that runs; in a Docker layer you want the dependency
half of syncing to happen before your source code is even copied in. Neither is expressible if
resolving and installing are one indivisible step.

**★ Why can `uv.lock` be shared across Linux, macOS and Windows when a `pip freeze` output cannot?**
Because they are produced by different operations over different inputs. `pip freeze`
*"is useful for creating Requirements Files that can re-create the exact versions of all
packages installed in an environment"*
([packaging.python.org](https://packaging.python.org/en/latest/guides/installing-using-pip-and-virtual-environments/))
— it reports the environment in front of it, on this OS, for this interpreter, including
whatever you installed by hand and any platform-conditional dependency that happened to be
selected. uv's lock is the output of a *universal resolution* that *"captures the packages that
would be installed across all possible Python markers such as operating system, architecture,
and Python version."* One is a snapshot of a machine; the other is a solution to a constraint
problem over all machines.

**★ Someone hands you a repo with `requirements.txt` and no `pyproject.toml` and asks you to "switch it to uv". What do you actually have to decide?**
Whether you are adopting the project interface or only the pip interface. `uv pip install -r
requirements.txt` works immediately and buys you speed and a shared cache with nothing else
changed — no `pyproject.toml`, no lockfile, no new concepts for the team. The project interface
buys reproducibility, but it requires a `pyproject.toml` (uv *"requires this file to identify
the root directory of a project"*), a decision about whether the project is a package
(`[build-system]` present or not — [01b](01b-the-project-uv-sees.md)), a real dependency
declaration rather than a frozen snapshot, and a committed `uv.lock` that becomes a
merge-conflict surface. Those are the trade-offs to put in front of the team; conflating "we
use uv now" with "we have reproducible builds now" is the mistake.

**Given a `uv sync` that fails, how do you decide in one command whether to talk to the resolver or to the platform?**
Run `uv lock --check`. It asks only *"is the lockfile up to date with respect to
`pyproject.toml`"* — uv's docs describe it as *"You can check if the lockfile is up-to-date by
passing the `--check` flag to `uv lock`"* — and it does not install anything. If that passes,
the resolution is fine and the failure is in the install phase: a source distribution that
must be compiled, a missing wheel for your platform, a build backend that needs a header
package. Then re-run the install half alone with `uv sync --frozen` so the resolver is out of
the picture entirely and the error you read is unambiguous.

**Why is "uv is a faster pip" an incomplete description, even though the docs advertise a speed multiplier?**
Because speed is the least structural of the differences. The pip interface really is intended
as a *"drop-in replacement for common `pip` and `pip-tools` workflows"*, but the project
interface changes the artefacts you keep: a declarative `pyproject.toml` instead of a frozen
list, a universal `uv.lock` instead of a per-machine snapshot, and an *exact* sync that removes
undeclared packages instead of an install that only ever adds. A team that adopts uv purely for
speed keeps every reproducibility problem it had, just encountered sooner.

---

← Prev: [Topic index](README.md) · Next → [01b · The project uv sees](01b-the-project-uv-sees.md)
