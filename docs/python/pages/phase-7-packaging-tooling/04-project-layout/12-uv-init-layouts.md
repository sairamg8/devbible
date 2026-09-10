---
title: "Since uv 0.12, uv init gives applications and libraries the same src layout with a build system, and the only flat template left — --no-package — is one that is never installed at all; each flag is a layout decision made for you"
sidebar_label: "12 · uv init layouts"
sidebar_position: 14
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-10 · target **uv 0.12.12** (templates write `uv_build>=0.12.12,<0.13`), **Python 3.14.7** · against uv *Creating projects* ([docs.astral.sh](https://docs.astral.sh/uv/concepts/projects/init/)), the uv CLI reference for `uv init` ([docs.astral.sh](https://docs.astral.sh/uv/reference/cli/)), uv *Locking and syncing* ([docs.astral.sh](https://docs.astral.sh/uv/concepts/projects/sync/)), uv *Using workspaces* ([docs.astral.sh](https://docs.astral.sh/uv/concepts/projects/workspaces/)) and the uv build backend ([docs.astral.sh](https://docs.astral.sh/uv/concepts/build-backend/)).
> Documentation-validated — **no sandbox run**. The trees below are uv's documented trees, not captured output.

**`uv init` is where most new projects get their layout, so its defaults are the de facto answer to [01](01-flat-and-src-layout.md)'s question. As of uv 0.12 that answer is: an importable package under `src/<name>/`, a build system, and an installation into the environment — for applications as well as libraries. The flat layout survives only as `--no-package`, which produces a `main.py` in the root and deliberately never installs anything. This chunk reads each template as a layout: what tree it writes, whether the project is installed, and what that means for the wrong-copy bug. uv's commands in general are [02 · uv](../02-uv/README.md).**

## What changed in 0.12

> *"When creating projects, uv supports two basic templates: applications and libraries. By default, uv will create a project for an application. The `--lib` flag can be used to create a project for a library instead."*

> *"In both cases, uv prefers to define a build system and place source files in a dedicated `src/<project_name>/` directory. Defining a build system allows use of various Python packaging features, such as adding command-line entry points, and avoids common points of confusion with the Python import system. Use of a build system can be disabled by using the `--no-package` or `--bare` options."*

> *"Prior to v0.12, uv did not define a build system for applications by default."*

*"Avoids common points of confusion with the Python import system"* is uv's one-line summary of this whole topic. The CLI help says the same about the flag that is now implicit: `--package` *"Set up the project to be built as a Python package. Defines a `[build-system]` for the project. This is the default behavior."*

## `uv init` / `uv init --app`

> *"Application projects are suitable for web servers, scripts, and command-line interfaces."*

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

> *"A build system is defined, so the project will be installed into the environment"*

Three layout facts follow. The package is under `src/`, so nothing in the root can shadow it. It is installed — editable, per uv's sync behaviour — so `uv run` imports it from the environment. And the command comes from `[project.scripts]`, so `uv run example-app` runs the installed entry point rather than a file by path. The `requires-python = ">=3.11"` is simply the value in uv's documentation example; whatever `uv init` writes for you, set it deliberately — [pyproject.toml · 04 · version and requires-python](../01-pyproject-toml/04-version-and-requires-python.md).

## `uv init --lib`

> *"A library provides functions and objects for other projects to consume. Libraries are intended to be built and distributed, e.g., by uploading them to PyPI."*

> *"Libraries always require a packaged project."*

```text
example-lib/
├── .python-version
├── README.md
├── pyproject.toml
└── src
    └── example_lib
        ├── py.typed
        └── __init__.py
```

> *"A `py.typed` marker is included to indicate to consumers that types can be read from the library"*

> *"A `src` layout is particularly valuable when developing libraries. It ensures that the library is isolated from any `python` invocations in the project root and that distributed library code is well separated from the rest of the project source."*

The library template differs from the app template in exactly two ways: `py.typed` in the package, and no `[project.scripts]`. The layout is the same.

## `--build-backend`

> *"You can select a different build backend template by using `--build-backend` with `hatchling`, `uv_build`, `flit-core`, `pdm-backend`, `setuptools`, `maturin`, or `scikit-build-core`. An alternative backend is required if you want to create a library with extension modules."*

> *"Using `--build-backend` implies `--package`."*

The CLI reference lists the flag's own value names as `uv`, `hatch`, `flit`, `pdm`, `poetry`, `setuptools`, `maturin` and `scikit`; the distribution names in the quote above (`hatchling`, `uv_build`, `flit-core`, `pdm-backend`, `scikit-build-core`) are accepted as aliases in uv's source.

For an extension module the tree grows a second language alongside the Python package, still under `src/`:

```text
example-ext/
├── .python-version
├── Cargo.toml
├── README.md
├── pyproject.toml
└── src
    ├── lib.rs
    └── example_ext
        ├── __init__.py
        └── _core.pyi
```

> *"If using `scikit-build-core`, you'll see CMake configuration and a `main.cpp` file instead."*

> *"When creating a project with maturin or scikit-build-core, uv configures `tool.uv.cache-keys` to include common source file types. To force a rebuild, e.g. when changing files outside `cache-keys` or when not using `cache-keys`, use `--reinstall`."*

The compiled `_core` module exists only after a build, which is the inverse wrong-copy case from [03](03-the-wrong-copy-bug.md): it is exactly why this template keeps the Python package out of the root.

## `uv init --no-package`

> *"While defining a build system generally provides a better experience, there are some cases in which it can be easier to omit it and define your Python modules directly in the top-level directory."*

```text
example-app/
├── .python-version
├── README.md
├── main.py
└── pyproject.toml
```

> *"It does not include a build system, it is not a package, and will not be installed into the environment"*

The CLI help is blunter: *"This option creates the project structure as a flat directory that is not importable as a module and has no `[build-system]` entry. It can be used for applications that are not expected to be distributed as a package."*

This is the flat layout without its trap. There is no installed copy to confuse with the checkout, because there is no installed copy. `uv run main.py` puts the root on `sys.path` as the script's directory, so `main.py` can import a sibling `helpers.py` — which is the whole design. The trap appears only when such a project grows tests, a second entry point and a deployment artifact while staying unpackaged; that is the point to convert it ([14](14-moving-a-flat-project-to-src.md)).

## `uv init --bare`

> *"uv will skip creating a Python version pin file, a README, and any source directories or files. Additionally, uv will not initialize a version control system (i.e., `git`)."*

```text
example-bare
└── pyproject.toml
```

> *"The `--bare` option can be used with other options like `--lib` or `--build-backend` — in these cases uv will still configure a build system but will not create the expected file structure."*

That last sentence is a layout trap in waiting: `uv init --bare --lib` produces a build system that expects `src/<package_name>/__init__.py` and no such directory.

## Inside an existing directory

> *"If there's already a project in the target directory, i.e., if there's a `pyproject.toml`, uv will exit with an error."*

> *"By default, running `uv init` inside an existing package will add the newly created member to the workspace, creating a `tool.uv.workspace` table in the workspace root if it doesn't already exist."*

The opt-out, from the CLI help: `--no-workspace` — *"Avoid discovering a workspace and create a standalone project. By default, uv searches for workspaces in the current directory or any parent directory."* Workspaces as a layout are [13](13-workspaces-as-a-layout.md).

## Choosing a flag

| You are building | Flag | Layout you get | Installed? |
|---|---|---|---|
| web service, CLI, worker | *(none)* or `--app` | `src/<name>/` + `[project.scripts]` | yes |
| library for other projects | `--lib` | `src/<name>/` + `py.typed` | yes |
| anything with Rust or C/C++ | `--build-backend maturin` / `scikit-build-core` | `src/<name>/` + native sources | yes |
| a script-sized app you will never package | `--no-package` | flat `main.py` | no |
| a `pyproject.toml` for an existing tree | `--bare` | none | as configured |

## Gotchas

**★ Symptom: an application created with an older uv has a `[project.scripts]` entry and the command does not exist.** Cause: before 0.12 the app template had no build system, and uv's sync documentation is explicit: *"If the project does not define a build system, it will not be installed."* No install, no entry point. Fix: add a build system and a package directory.

```toml
[build-system]
requires = ["uv_build>=0.12.12,<0.13"]
build-backend = "uv_build"
```

```bash
mkdir -p src/example_app
git mv main.py src/example_app/__init__.py
uv sync
```

**★ Symptom: `uv init tools/report` inside your project edits the root `pyproject.toml` and adds a workspace.** Cause: *"running `uv init` inside an existing package will add the newly created member to the workspace"*. Fix: say you want a standalone project.

```bash
uv init --no-workspace tools/report
```

**Symptom: `uv init --bare --lib` builds fail because the module is missing.** Cause: `--bare` configures the build system but *"will not create the expected file structure"*, and the uv backend expects `src/<package_name>/__init__.py`. Fix: create it.

```bash
mkdir -p src/example_lib
touch src/example_lib/__init__.py src/example_lib/py.typed
```

**Symptom: `uv init` in an existing project refuses to run.** Cause: *"if there's a `pyproject.toml`, uv will exit with an error."* Fix: edit the existing file instead of re-initialising — add the table the template would have written.

```toml
[build-system]
requires = ["uv_build>=0.12.12,<0.13"]
build-backend = "uv_build"
```

**Symptom: after editing `src/lib.rs` in a maturin project, the Python side still runs the old code.** Cause: the extension is compiled at install time; uv rebuilds only when `tool.uv.cache-keys` sees a change. Fix: force it.

```bash
uv sync --reinstall
```

**Symptom: consumers' type checkers ignore your library's annotations.** Cause: the project was started with the app template, or converted by hand, and has no `py.typed` marker — the file the lib template adds *"to indicate to consumers that types can be read from the library"*. Fix: add it inside the package.

```bash
touch src/invoice_service/py.typed
```

**Symptom: `uv run example-lib` fails in a library project.** Cause: the library template defines no `[project.scripts]`. Fix: call the code through Python, or add an entry point if the library also ships a command.

```bash
uv run python -c "import example_lib; print(example_lib.hello())"
```

**Symptom: combining `--no-package` with `--build-backend` or `--lib` is rejected.** Cause: `--build-backend` *"Implicitly sets `--package`"*, and libraries *"always require a packaged project"*; the options contradict each other. Fix: pick the packaged form.

```bash
uv init --lib --build-backend hatchling invoice-lib
```

## Interview questions

**★ What layout does `uv init` produce today, and what changed?**
An application project with its package at `src/<name>/__init__.py`, a `[project.scripts]` entry, and a `uv_build` build system, so the project is installed into the environment. Before uv 0.12 the application template had no build system and was never installed; libraries always had the src layout. uv's docs justify the change by saying a build system *"avoids common points of confusion with the Python import system"* — the wrong-copy bug, in their words.

**★ When is `uv init --no-package` the right choice?**
For an application you will never distribute as a package — a script-sized tool, a notebook companion, a one-off job — where the convenience of a flat `main.py` with sibling modules outweighs installation. It is safe precisely because nothing is installed, so there is no second copy to shadow. Once the project grows tests and a deployment artifact, it should become a package.

**What is the practical difference between the app and lib templates?**
Two files: the library adds `py.typed` so consumers' type checkers read its annotations, and the application adds a `[project.scripts]` entry point. Both use the same src layout and build system, and both are installed into the project environment.

**What does `--bare` do to layout?**
It writes only `pyproject.toml` — no README, no `.python-version`, no `src/`, no git repository. Combined with `--lib` or `--build-backend` it still writes a build system, which then expects a package directory that `--bare` did not create. It is for adding uv to an existing tree, not for starting one.

**Why does running `uv init` inside a project create a workspace?**
Because uv discovers workspaces upward from the current directory by default, and treats a new project inside an existing package as a new member, creating the `[tool.uv.workspace]` table in the root if needed. That is right for a monorepo and surprising for a standalone tool that happens to sit in a subdirectory; `--no-workspace` opts out.

---

← Prev: [11 · Telling the tools about src](11-telling-the-tools-about-src.md) · [Topic index](README.md) · Next → [13 · Workspaces as a layout](13-workspaces-as-a-layout.md)
