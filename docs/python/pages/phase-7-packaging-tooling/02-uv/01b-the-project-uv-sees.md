---
title: "A uv project is four files with four different owners, and the one table that decides whether uv installs your own code is `[build-system]`"
sidebar_label: "01b · The project uv sees"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-10 against **uv 0.12.12** — *Project structure and files*
> ([docs.astral.sh](https://docs.astral.sh/uv/concepts/projects/layout/)), *Configuring projects*
> ([docs.astral.sh](https://docs.astral.sh/uv/concepts/projects/config/)), *Working on projects*
> ([docs.astral.sh](https://docs.astral.sh/uv/guides/projects/)), the release list
> ([github.com](https://github.com/astral-sh/uv/releases)), and the `pyproject.toml`
> specification
> ([packaging.python.org](https://packaging.python.org/en/latest/specifications/pyproject-toml/)).
> Version spine: **uv 0.12.12** (2026-09-09) · Python 3.14.7 · ruff 0.16.6 · pre-commit 4.6.2.
> Documentation-validated, **no sandbox run, no timings**.

**Four files make up a uv project, and each one has exactly one legitimate author: you write
`pyproject.toml`, uv writes `uv.lock`, `uv python pin` writes `.python-version`, and nobody
writes `.venv` — it is derived state. Get the ownership wrong and you get the two classic uv
bugs: hand-edited lockfiles that stop matching reality, and committed virtual environments
that break on the next machine. There is also one table, `[build-system]`, whose mere presence
decides whether uv installs *your* package into the environment at all; its absence is the
reason a clean `uv sync` can be followed by `ModuleNotFoundError` on your own code.**

## The four files, and who owns each

```text
my-project/
├── pyproject.toml      declared intent      — you edit it (through uv add, ideally)
├── uv.lock             resolved fact        — uv writes it, you commit it, nobody edits it
├── .python-version     interpreter request  — uv python pin writes it, you commit it
└── .venv/              derived state        — disposable, never committed
```

> *"Python project metadata is defined in a `pyproject.toml` file. uv requires this file to
> identify the root directory of a project."*
> — [project structure and files](https://docs.astral.sh/uv/concepts/projects/layout/)

That sentence is the operative definition of "project" for every uv command that says
*project*: uv walks up from the working directory looking for `pyproject.toml`. No
`pyproject.toml`, no project — and `uv add` then has nothing to write to. Topic
[01 · pyproject.toml](../01-pyproject-toml/README.md) owns that file's contents; this topic owns
everything uv does with it.

The lockfile and the environment both land beside it:

> *"uv creates a `uv.lock` file next to the `pyproject.toml`."*

> *"It is not recommended to include the `.venv` directory in version control; it is
> automatically excluded from `git` with an internal `.gitignore` file."*
> — both [project structure and files](https://docs.astral.sh/uv/concepts/projects/layout/)

🔴 Read that second quote precisely. The `.gitignore` is **inside** `.venv`, so it protects
you only for an environment actually named `.venv` in that location. Point
`UV_PROJECT_ENVIRONMENT` at `env/` or `venv/` and nothing is ignoring it — the repository's own
`.gitignore` has to.

## `uv init` writes the set, but not the lockfile

> *"uv will create the following files and directories: .git/, .gitignore, .python-version,
> pyproject.toml, README.md and src/hello\_world/\_\_init\_\_.py"*
> — [working on projects](https://docs.astral.sh/uv/guides/projects/)

Note what is *not* in that list: `uv.lock` and `.venv/`. They arrive later, on first use:

> *"uv will create a virtual environment and `uv.lock` file in the root of your project the
> first time you run a project command, i.e., `uv run`, `uv sync`, or `uv lock`."*
> — [working on projects](https://docs.astral.sh/uv/guides/projects/)

This is why a freshly-`init`ed repository has nothing to review in a lockfile, and why the
first `uv run` on a colleague's checkout does noticeably more work than the second — it is
resolving and creating an environment, not just executing.

And `.python-version` is a *request*, not a constraint:

> *"The `.python-version` file contains the project's default Python version. This file tells
> uv which Python version to use when creating the project's virtual environment."*
> — [working on projects](https://docs.astral.sh/uv/guides/projects/)

The constraint is `requires-python` in `pyproject.toml`. Two files, two jobs, and mixing them
up is common enough that [05b](05b-python-version-vs-requires-python.md) is dedicated to it.

## 🔴 `[build-system]` decides whether uv installs *your* code

uv does not guess whether your project is a package. It looks for one table:

> *"uv uses the presence of a build system to determine if a project contains a package that
> should be installed in the project virtual environment."*

> *"If a build system is not defined, uv will not attempt to build or install the project
> itself, just its dependencies."*
> — both [configuring projects](https://docs.astral.sh/uv/concepts/projects/config/)

So a `pyproject.toml` with no `[build-system]` gives you an environment full of dependencies in
which `import my_package` fails, because your own package was never installed. Two ways to fix
it — pick the first unless you have a reason:

```toml
# my-project/pyproject.toml — declare a backend; uv drives it
[build-system]
requires = ["hatchling"]
build-backend = "hatchling.build"
```

```toml
# or force uv's decision explicitly, either way
[tool.uv]
package = true     # install the project even with no build system
# package = false  # do NOT install the project even though a build system exists
```

uv's own rule of thumb for which side you are on:

> *"You probably need a package if you want to: Add commands to the project, Distribute the
> project to others, Use a `src` and `test` layout, Write a library. You probably do not need a
> package if you are: Writing scripts, Building a simple application, Using a flat layout"*
> — [configuring projects](https://docs.astral.sh/uv/concepts/projects/config/)

The src-layout row is the one that catches people, and it is not arbitrary: with `src/`, the
package is not importable from the project root unless it is installed, which is exactly the
property src layout exists to give you. Topic **04 · Project layout** *(not written yet)*
argues that at length.

## `[tool.uv]` is uv-specific by specification, not by accident

Every uv setting that is not standard packaging metadata lives under `[tool.uv]` —
`tool.uv.package`, `tool.uv.sources`, `tool.uv.cache-dir`. That table is defined by the
packaging specification, not by uv:

> *"The `[tool]` table is where any tool related to your Python project, not just build tools,
> can have users specify configuration data as long as they use a sub-table within `[tool]`"*

> *"A project can use the subtable `tool.$NAME` if, and only if, they own the entry for `$NAME`
> in the Cheeseshop/PyPI."*
> — both [pyproject.toml specification](https://packaging.python.org/en/latest/specifications/pyproject-toml/)

The consequence is the one to remember: **anything you configure under `[tool.uv]` is
invisible to every other installer.** A git dependency expressed as `[tool.uv.sources]` is not
a fact about your package; it is an instruction to uv. [04](04-add-and-remove.md) shows what
that means when someone installs your project with pip.

## What uv is *not*

- **Not a build backend.** `[build-system]` still names a backend — hatchling, setuptools,
  others; uv invokes it. Publishing is topic **12 · Publishing to PyPI** *(not written yet)*.
- **Not a task runner.** `uv run pytest` runs a command in the project environment; it does
  not read a script table out of `pyproject.toml` the way `npm run` reads `scripts`. Named
  commands come from `[project.scripts]`, which requires a package — topic
  **06 · Entry points** *(not written yet)*.
- **Not a linter, formatter or type checker.** That is ruff (topic **05 · ruff** *(not written
  yet)*, pinned at **0.16.6**) and a type checker of your choice.
- **Not a drop-in pip in every case.** `uv pip` is *"designed as a drop-in replacement for
  common `pip` and `pip-tools` workflows"* but *"uv is not intended to be an exact clone of
  `pip`"* ([pip compatibility](https://docs.astral.sh/uv/pip/compatibility/)). The deliberate
  differences are [06c](06c-uv-pip.md) and [06d](06d-uv-pip-resolver-and-build-isolation.md); [06](06-pip-and-venv-the-floor.md) is the baseline you
  fall back to when uv is not available.

One thing uv also is not: **stable**. It is `0.x`, it ships roughly weekly, and flags land in
patch releases. That belongs with the question of which uv you are running, so it is
[01c](01c-installing-and-pinning-uv.md).

## Gotchas

**★ Symptom: `uv sync` finishes cleanly and `import my_package` still raises `ModuleNotFoundError`.**
Cause: `pyproject.toml` has no `[build-system]` table, so per uv's rule it installed *"just its
dependencies"* and never your own code. Fix: add a backend, or force the decision.

```toml
[build-system]
requires = ["hatchling"]
build-backend = "hatchling.build"
```

**★ Symptom: `git status` shows hundreds of files under `env/` after you set a custom environment path.**
Cause: the auto-generated `.gitignore` lives *inside* `.venv`, so it only covers an environment
at that exact path. Fix: ignore it in the repository, not in the environment.

```bash
echo 'env/' >> .gitignore
git rm -r --cached env
```

**★ Symptom: another team member's checkout ignores your `.python-version`.**
Cause: it was never committed — `uv init` creates it, but it is easy to lose in a
`.gitignore` copied from a pyenv-era template that ignores `.python-version` by habit. Fix:
check the ignore rules and commit the file.

```bash
git check-ignore -v .python-version    # prints the rule that is hiding it, if any
git add .python-version
```

**★ Symptom: you hand-edited `uv.lock` to bump one version and the next `uv sync` reverted it — or worse, kept it.**
Cause: the lockfile is uv's output, not an input you may amend. uv's docs state it *"is managed
by uv and should not be edited manually"*. Fix: express the change where it belongs and let uv
re-derive.

```bash
uv lock --upgrade-package httpx      # move one package, keep the rest pinned
```

**★ Symptom: a `[tool.uv.sources]` git dependency works for your team and breaks for anyone installing your published package.**
Cause: `[tool]` sub-tables are tool-specific by specification — only uv reads
`[tool.uv.sources]`. The published distribution carries the requirement from
`[project.dependencies]`, with no idea where you were getting it from. Fix: for anything you
publish, the dependency must be resolvable from an index; keep the source override for local
development only.

```toml
[project]
dependencies = ["my-lib>=1.4"]          # this is what consumers see

[tool.uv.sources]
my-lib = { path = "../my-lib", editable = true }   # uv-only, local development
```

## Interview questions

**★ Why does uv sometimes not install the project you are standing in, and how do you tell it to?**
Because uv keys that decision off `[build-system]`: *"uv uses the presence of a build system to
determine if a project contains a package that should be installed in the project virtual
environment"*, and *"if a build system is not defined, uv will not attempt to build or install
the project itself, just its dependencies."* That is deliberate — a directory of scripts with a
flat layout does not need to be a package, and forcing it to be one means every dependency
change rebuilds a wheel. To opt in, declare a `[build-system]` naming any PEP 517 backend, or
set `tool.uv.package = true`; to opt out even with a build system present, set it to `false`.
The symptom of getting this wrong is unmistakable: dependencies import fine, your own package
does not.

**★ Which of the four project files belong in version control, and what breaks if you get each one wrong?**
`pyproject.toml`, `uv.lock` and `.python-version` are committed; `.venv` is not. Committing
`.venv` ships absolute paths and platform-specific binaries — CPython's own docs say
environments *"are inherently non-portable, in the general case"* — so the checkout is broken
on any other machine and the repository grows without bound. *Not* committing `uv.lock` throws
away the reproducibility that is the entire point: every machine and every CI run resolves
independently, so a dependency published an hour ago can appear in production without a single
line of your code changing. Not committing `.python-version` means colleagues silently get
whatever interpreter uv finds instead of the one you tested on. And hand-editing `uv.lock`,
which is committed and therefore looks editable, produces a file that no longer corresponds to
any resolution uv would compute.

**★ `[tool.uv.sources]` lets you point a dependency at a git URL or a local path. Why is that safe for an application and dangerous for a library?**
Because `[tool]` sub-tables are, by the packaging specification, configuration for one named
tool: *"any tool related to your Python project… can have users specify configuration data as
long as they use a sub-table within `[tool]`"*. `[tool.uv.sources]` therefore never travels
with the built distribution — a consumer installing your wheel with pip sees only
`[project.dependencies]`. For an application that is fine: your deployment uses uv and the
lockfile records the real source. For a library it is a trap, because the version range you
published may be satisfiable from PyPI in a way you have literally never tested — you were
always installing the git checkout. The rule is that the requirement in
`[project.dependencies]` must stand on its own, with the source override being a development
convenience layered on top.

**Why does `uv init` deliberately not create `uv.lock`?**
Because there is nothing to lock yet, and a lockfile is a resolution result rather than a
template. uv's docs place its creation at first use: *"uv will create a virtual environment and
`uv.lock` file in the root of your project the first time you run a project command, i.e., `uv
run`, `uv sync`, or `uv lock`."* Creating an empty one at `init` would mean either a file with
no packages that still has to be committed and reviewed, or a resolution performed before you
have declared a single dependency. The practical consequence is that "first `uv run` in a fresh
clone is slow" is expected behaviour, not a symptom.

**A colleague says "uv replaces poetry, so it must be a build backend too." What is wrong with that?**
Conflating the front end with the backend. uv drives the build — `uv build` and the install of
your own project both invoke whatever backend `[build-system]` names — but the code that turns
your source tree into a wheel is that backend's, not uv's. This matters when a build fails: the
error is coming from hatchling or setuptools, and its configuration lives in that backend's
`[tool.*]` table, not in `[tool.uv]`. The same distinction explains why uv is not a task runner
or a linter: it is a package and project manager, and everything it appears to "include" is
either its own resolver/installer or an external tool it invokes.

---

← Prev: [01 · What uv actually is](01-what-uv-is.md) · [Topic index](README.md) · Next → [01c · Installing and pinning uv](01c-installing-and-pinning-uv.md)
