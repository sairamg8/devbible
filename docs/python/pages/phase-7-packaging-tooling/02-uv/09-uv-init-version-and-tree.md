---
title: "`uv init` in uv 0.12 scaffolds a packaged, src-layout project with a build backend already declared — unlike the flat `main.py` older tutorials show — and `uv version` and `uv tree` are the two commands that read the project back to you"
sidebar_label: "09 · uv init, uv version, uv tree"
sidebar_position: 34
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-10 against **uv 0.12.12** — *Creating projects*
> ([docs.astral.sh](https://docs.astral.sh/uv/concepts/projects/init/)), *Working on projects*
> ([docs.astral.sh](https://docs.astral.sh/uv/guides/projects/)), *Configuring projects*
> ([docs.astral.sh](https://docs.astral.sh/uv/concepts/projects/config/)), *Building and publishing a
> package* ([docs.astral.sh](https://docs.astral.sh/uv/guides/package/)) and the CLI reference
> ([docs.astral.sh](https://docs.astral.sh/uv/reference/cli/)).
> Version spine: **uv 0.12.12** (2026-09-09) · Python 3.14.7 · ruff 0.16.6 · pre-commit 4.6.2.
> Documentation-validated, **no sandbox run, no timings**.

**`uv init` is where most projects' `pyproject.toml` comes from, so its defaults become most projects'
defaults — and in the uv the documentation describes for 0.12.12 those defaults are more opinionated
than a lot of the material you will find online. An application created with a bare `uv init` gets a
`src/` layout, a `[project.scripts]` entry and a `[build-system]` naming `uv_build` with a version range
tied to the uv that created it; it is a *package* from day one, which means uv installs it into the
environment ([01b](01b-the-project-uv-sees.md)). The flags change exactly that: `--lib` adds a typing
marker and drops the script, `--no-package` removes the build system, `--bare` writes one file and
nothing else. Two commands complete the picture — `uv version` reads and bumps the *project's* version
(not uv's), and `uv tree` shows the resolved dependency graph, the fastest answer to "why is this package
here".**

## What `uv init` writes, in the documentation for uv 0.12.12

> *"By default, uv will create a project for an application."*

> *"Application projects are suitable for web servers, scripts, and command-line interfaces."*
> — both [creating projects](https://docs.astral.sh/uv/concepts/projects/init/)

The documented result of `uv init example-app`:

```text
example-app/
├── .python-version
├── README.md
├── pyproject.toml
└── src
    └── example_app
        └── __init__.py
```

```toml
[project]
name = "example-app"
version = "0.1.0"
description = "Add your description here"
readme = "README.md"
requires-python = ">=3.11"
dependencies = []

[project.scripts]
example-app = "example_app:main"

[build-system]
requires = ["uv_build>=0.12.12,<0.13"]
build-backend = "uv_build"
```

— [creating projects](https://docs.astral.sh/uv/concepts/projects/init/)

Four things in that file are decisions `uv init` made for you:

- **It is a package.** `[build-system]` is present, so *"uv uses the presence of a build system to
  determine if a project contains a package that should be installed in the project virtual
  environment"* ([configuring projects](https://docs.astral.sh/uv/concepts/projects/config/)) — your
  code is installed, editable, on the first sync.
- **The backend is `uv_build`, bounded to the creating uv's minor** — `>=0.12.12,<0.13`. The bound is
  written at creation time and does not move by itself; it is the backend's version, installed in an
  isolated build environment, not the version of the `uv` binary you run.
- **`requires-python` came from an interpreter.** The CLI reference documents `--python` for `uv init`
  as *"The Python interpreter to use to determine the minimum supported Python version"*
  ([CLI reference](https://docs.astral.sh/uv/reference/cli/)). The floor it writes is a starting point,
  not a decision — and it is the most consequential line in the file ([05b](05b-python-version-vs-requires-python.md)).
- **There is a console script.** `[project.scripts]` needs a package to exist, and the default app has
  one. What an entry point is and how it becomes a command is topic 01's
  [entry points and console scripts](../01-pyproject-toml/10-entry-points-and-console-scripts.md).

⚠️ Older uv versions, and much of the material written about them, show `uv init` producing a flat
`main.py` with no build system. This page did not establish which release changed the default; if
what you see differs from the tree above, check `uv self version` before assuming the documentation is
wrong.

## The flags that change the shape

| Flag | CLI reference | Effect on the scaffold |
|---|---|---|
| `--app` | *"Create a project for an application"* | the default above |
| `--lib` | *"Create a project for a library"* | `src/` layout, a `py.typed` marker, a build system, no script |
| `--package` | *"Set up the project to be built as a Python package"* | forces a build system |
| `--no-package` | *"Do not set up the project to be built as a Python package."* | no `[build-system]`; uv installs only the dependencies |
| `--bare` | *"Only create a `pyproject.toml`"* | nothing else — no README, no `.python-version`, no source |
| `--build-backend` | *"Initialize a build-backend of choice for the project."* | e.g. `hatchling` instead of `uv_build` |
| `--no-pin-python` | *"Do not create a `.python-version` file for the project."* | no interpreter request file |
| `--no-workspace` | *"Avoid discovering a workspace and create a standalone project."* | see [10](10-workspaces.md) |
| `--script` | *"Create a script with embedded metadata"* | a PEP 723 script, not a project |

— [CLI reference](https://docs.astral.sh/uv/reference/cli/)

> *"Libraries can be created by using the `--lib` flag"* · *"Libraries always require a packaged
> project."*
> — [creating projects](https://docs.astral.sh/uv/concepts/projects/init/)

Which *layout* to choose, and why `src/` protects you from importing the wrong copy of your own code, is
topic [04 · Project layout](../04-project-layout/README.md). `--script` belongs to topic **09 · PEP 723 inline
metadata** *(not written yet)*. What this page owns is what each flag does to the project uv then
manages.

```bash
uv init invoice-service                          # packaged application, uv_build
uv init --lib invoice-models                     # library: py.typed, no console script
uv init --app --no-package ops-scripts           # dependencies only; uv never installs the code
uv init --build-backend hatchling billing-api    # packaged, with a different backend
uv init --bare                                   # adopt an existing directory: pyproject.toml only
```

## `uv version` — the project's version, not uv's

> `uv version` — *"Read or update the project's version"*

> `uv self version` — *"Display the installed uv version"*
> — both [CLI reference](https://docs.astral.sh/uv/reference/cli/)

The naming trap is covered in [01c](01c-installing-and-pinning-uv.md). The useful half is `--bump`:

> *"To increase the version of your package semantics, use the `--bump` option"*
> — [building and publishing a package](https://docs.astral.sh/uv/guides/package/)

```bash
uv version                          # print the project's version
uv version --bump minor             # 1.2.3 → 1.3.0
uv version --bump patch --bump beta # the guide's example of combining a release and a pre-release bump
```

`uv version` edits the static `version` in `[project]` — a convenience over editing the line by hand.
⚠️ What it does for a project whose version is `dynamic` — derived from a git tag by the backend, with no
static line to edit (topic 01's [dynamic metadata](../01-pyproject-toml/13-dynamic-metadata.md)) — is
not something the pages verified for this topic state; check it on your uv before scripting a release
around it. The version is also project metadata that the lockfile describes, so after a bump run
`uv lock --check`, and commit `uv.lock` if it moved.

## `uv tree` — the resolved graph, read back

> `uv tree` — *"Display the project's dependency tree"* · `--outdated` *"Display outdated
> dependencies"* · `--invert` *"Invert the dependency tree display"*
> — [CLI reference](https://docs.astral.sh/uv/reference/cli/)

```bash
uv tree                    # what depends on what, as locked
uv tree --invert           # turned upside down: for each package, what pulled it in
uv tree --outdated         # annotate packages that have newer versions available
```

`--invert` is the one to remember. "Why is `cffi` in my production image?" is a question about
*reverse* edges — which of my direct dependencies pulled it in — and an inverted tree answers it by
reading upward instead of searching downward. `--outdated` is the input to an upgrade review
([03b](03b-upgrading-the-lockfile.md)).

## Gotchas

**★ Symptom: the tutorial says `uv init` creates `main.py`; you got `src/` and a `[build-system]`.**
Cause: the default changed; in the documentation for uv 0.12.12, a bare `uv init` creates a packaged
application with `uv_build`. Fix: if you wanted the unpackaged form, ask for it.

```bash
uv init --app --no-package ops-scripts
```

**★ Symptom: a library created on a fresh machine declares `requires-python = ">=3.14"` and users on 3.12 cannot install it.**
Cause: `uv init` derives the floor from the interpreter it used — *"to determine the minimum supported
Python version"*. Fix: set the floor you actually support, before the first release.

```toml
[project]
requires-python = ">=3.12"
```

**★ Symptom: `uv sync` in an `--no-package` project succeeds and `import ops_scripts` fails.**
Cause: with no build system, uv *"will not attempt to build or install the project itself, just its
dependencies."* Fix: run the code by path, or make it a package.

```bash
uv run python scripts/rotate_keys.py     # run by path — the dependencies are all there
```

```toml
# or make it a package: declare a backend (01b), with the code under src/ops_scripts/
[build-system]
requires = ["uv_build>=0.12.12,<0.13"]
build-backend = "uv_build"
```

**★ Symptom: `uv version` prints `0.1.0` and you expected uv's version.**
Cause: *"Read or update the project's version"* — it is the project command. Fix:

```bash
uv self version
```

**Symptom: CI fails with a lockfile-out-of-date error right after a version bump.**
Cause: the bump changed project metadata the lockfile describes, and `--locked` refuses to run against a
lockfile that would change ([02d](02d-frozen-and-locked-in-ci.md)). Fix: commit the lockfile with the
bump.

```bash
uv version --bump minor
uv lock
git add pyproject.toml uv.lock
```

**Symptom: a scratch project created with `uv init` inside a workspace tree behaves as part of that workspace.**
Cause: `uv init` discovers an enclosing workspace unless told not to — `--no-workspace` exists to
*"Avoid discovering a workspace and create a standalone project"* ([10](10-workspaces.md)). The
documentation as verified does not spell out every change `uv init` makes to the workspace root, so
check `git diff` after creating a project inside one. Fix: create it standalone.

```bash
git status                                   # see what the first attempt touched
uv init --no-workspace tools/scratch
```

**Symptom: months after `uv init`, the build still uses an old `uv_build` though the team runs a newer uv.**
Cause: the `requires = ["uv_build>=0.12.12,<0.13"]` range was written once and bounds the *backend*
package, which is installed separately from the `uv` binary. Fix: move the bound deliberately when you
adopt a new minor.

```toml
[build-system]
requires = ["uv_build>=0.13,<0.14"]
build-backend = "uv_build"
```

## Interview questions

**★ What does a bare `uv init` produce in uv 0.12, and why does "it is a package" matter?**
A `src/`-layout application with a `[project.scripts]` entry and a `[build-system]` naming `uv_build`,
per the documentation for 0.12.12. Being a package changes what uv does on every sync: *"uv uses the
presence of a build system to determine if a project contains a package that should be installed in the
project virtual environment"*, so your own code is installed editable and importable, console scripts
become real commands, and `uv build` can produce a wheel. Without the build system — `--no-package` —
uv installs only the dependencies, which suits a folder of scripts and surprises anyone who expected
`import myproject` to work.

**★ Where does the `requires-python` that `uv init` writes come from, and why should you revisit it?**
From the interpreter `uv init` used: its `--python` option is documented as *"The Python interpreter to
use to determine the minimum supported Python version."* That is a sensible guess for an application
you deploy on one interpreter, and a real problem for a library, because `requires-python` is the one
metadata field that stops an install on an unsupported interpreter — a floor copied from whatever
Python the author had that day excludes users for no reason. It is also an input to universal
resolution, so widening it later can change the lockfile ([05b](05b-python-version-vs-requires-python.md)).
Decide it before the first release.

**Why does `uv init` bound `uv_build` to the current uv minor?**
Because uv — and therefore its backend — is pre-1.0, where a minor release is allowed to change
behaviour. The generated `requires = ["uv_build>=0.12.12,<0.13"]` means a build tomorrow uses a backend
from the same line as the one the project was created with, whatever uv the builder happens to run —
the backend is installed into an isolated build environment, separately from the `uv` binary. The cost
is maintenance: the bound never moves on its own, so adopting a new minor includes editing it, ideally
in the same reviewed change that moves `required-version` ([08b](08b-required-version-env-vars-and-dotenv.md)).

**How do you find out why a package you never asked for is in your environment?**
`uv tree --invert`. A normal tree reads from your direct dependencies down, which answers "what does X
pull in" but makes "who pulled in Y" a search. Inverting it — *"Invert the dependency tree display"* —
puts each package at the top with its dependants beneath, so the chain from the unexpected package up to
the direct dependency responsible is read off directly. That chain is what you need to decide between
the three real options: accept it, constrain it, or replace the direct dependency that brings it.

---

← Prev: [08c · tool.uv resolution controls](08c-tool-uv-resolution-controls.md) · [Topic index](README.md) · Next → [09b · uv build and uv publish](09b-uv-build-and-uv-publish.md)
