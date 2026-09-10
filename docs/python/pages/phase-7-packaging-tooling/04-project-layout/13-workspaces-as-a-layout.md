---
title: "A uv workspace is a layout of layouts — a root project plus members, each with its own pyproject.toml and src/, sharing one lockfile, one environment and one requires-python — and the shared environment is the wrong-copy bug again, one level up"
sidebar_label: "13 · Workspaces as a layout"
sidebar_position: 15
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-10 · target **uv 0.12.12**, **Python 3.14.7** · against uv *Using workspaces* ([docs.astral.sh](https://docs.astral.sh/uv/concepts/projects/workspaces/)), uv *Creating projects* ([docs.astral.sh](https://docs.astral.sh/uv/concepts/projects/init/)), the uv CLI reference for `sync`, `run` and `build` ([docs.astral.sh](https://docs.astral.sh/uv/reference/cli/)) and the uv build backend ([docs.astral.sh](https://docs.astral.sh/uv/concepts/build-backend/)).
> Documentation-validated — **no sandbox run, no program output**. uv is pre-1.0; workspace behaviour is described as of 0.12.12.

**When one repository holds several distributions — a service and the libraries it is built from — each needs its own `pyproject.toml` and its own `src/`. A uv workspace is the layout that ties those together: members are discovered from globs in the root's `pyproject.toml`, resolved into a single `uv.lock`, and installed — editable, into each other — in a single environment. That buys consistency and costs isolation. In one shared environment, a member can import a package that only a *sibling* declared, and it works every time until the member is installed on its own. It is the wrong-copy bug restated for dependencies: the test run sees more than the artifact will. This chunk covers the tree, the rules, that failure, and when path dependencies are the better layout. Monorepo mechanics generally are **10 · Editable installs** *(not written yet)*.**

## What a workspace is

> *"Inspired by the Cargo concept of the same name, a workspace is "a collection of one or more packages, called workspace members, that are managed together.""*

> *"Workspaces organize large codebases by splitting them into multiple packages with common dependencies. Think: a FastAPI-based web application, alongside a series of libraries that are versioned and maintained as separate Python packages, all in the same Git repository."*

> *"In a workspace, each package defines its own `pyproject.toml`, but the workspace shares a single lockfile, ensuring that the workspace operates with a consistent set of dependencies."*

## The tree

uv's own example, verbatim:

```text
albatross
├── packages
│   ├── bird-feeder
│   │   ├── pyproject.toml
│   │   └── src
│   │       └── bird_feeder
│   │           ├── __init__.py
│   │           └── foo.py
│   └── seeds
│       ├── pyproject.toml
│       └── src
│           └── seeds
│               ├── __init__.py
│               └── bar.py
├── pyproject.toml
├── README.md
├── uv.lock
└── src
    └── albatross
        └── __init__.py
```

> *"The most common workspace layout can be thought of as a root project with a series of accompanying libraries."*

Every member is a complete src-layout project in its own directory. The root is one too — its package sits in the root's `src/`, which is why the src layout matters doubly here: in a flat root, `albatross/` would sit next to `packages/` and be importable from the working directory for every command run at the top of the repository.

## The root `pyproject.toml`

```toml
[project]
name = "albatross"
version = "0.1.0"
requires-python = ">=3.12"
dependencies = ["bird-feeder", "tqdm>=4,<5"]

[tool.uv.sources]
bird-feeder = { workspace = true }

[tool.uv.workspace]
members = ["packages/*"]
exclude = ["packages/seeds"]

[build-system]
requires = ["uv_build>=0.12.12,<0.13"]
build-backend = "uv_build"
```

The rules, each verbatim:

> *"To create a workspace, add a `tool.uv.workspace` table to a `pyproject.toml`, which will implicitly create a workspace rooted at that package."*

> *"In defining a workspace, you must specify the `members` (required) and `exclude` (optional) keys, which direct the workspace to include or exclude specific directories as members respectively, and accept lists of globs"*

> *"Every directory included by the `members` globs (and not excluded by the `exclude` globs) must contain a `pyproject.toml` file. However, workspace members can be either applications or libraries; both are supported in the workspace context."*

> *"Every workspace needs a root, which is also a workspace member."*

> *"As such, `uv lock` operates on the entire workspace at once, while `uv run` and `uv sync` operate on the workspace root by default, though both accept a `--package` argument, allowing you to run a command in a particular workspace member from any workspace directory."*

With `exclude = ["packages/seeds"]`, the example has two members: `albatross` and `bird-feeder`.

## Wiring members together

> *"The `workspace = true` key-value pair in the `tool.uv.sources` table indicates the `bird-feeder` dependency should be provided by the workspace, rather than fetched from PyPI or another registry."*

> *"Dependencies between workspace members are editable."*

> *"Any `tool.uv.sources` definitions in the workspace root apply to all members, unless overridden in the `tool.uv.sources` of a specific member."*

> *"If a workspace member provides `tool.uv.sources` for some dependency, it will ignore any `tool.uv.sources` for the same dependency in the workspace root, even if the member's source is limited by a marker that doesn't match the current platform."*

A dependency on a member is still an ordinary requirement in `[project.dependencies]` — `"bird-feeder"` — so the published metadata of `albatross` names a normal distribution. The `workspace = true` source is uv-only routing that tells the resolver where to find it during development; how `[tool.uv.sources]` works in general is **02 · uv** *(not written yet)*.

*"Editable"* is the layout-relevant word. Every member imports every other member's `src/` directly, which is [04](04-editable-installs-reopen-the-hole.md)'s hole at repository scale: a file one member's build configuration would leave out is still importable by its siblings.

## The shared environment, and the bug it hides

> *"As Python does not provide dependency isolation, uv can't ensure that a package uses its declared dependencies and nothing else. For workspaces specifically, uv can't ensure that packages don't import dependencies declared by another workspace member."*

Concretely, in the example above `tqdm` is declared by the root, `albatross`, and not by `bird-feeder`:

```python
# packages/bird-feeder/src/bird_feeder/foo.py
from tqdm import tqdm   # 🔴 bird-feeder never declared tqdm


def fill(feeders: list[str]) -> list[str]:
    return [name.upper() for name in tqdm(feeders)]
```

In the workspace environment, `tqdm` is installed because the root needs it, so this imports, the tests pass, and review sees nothing. Published and installed on its own, `bird-feeder` does not pull in `tqdm`, and the first import fails with `ModuleNotFoundError: No module named 'tqdm'`. The environment the tests ran in contained more than the artifact's dependency closure — the same shape as the checkout containing more than the wheel.

Two ways to see it before a user does. `uv sync --package` narrows the shared environment to one member; its CLI help says *"The workspace's environment (`.venv`) is updated to reflect the subset of dependencies declared by the specified workspace member packages."*

```bash
uv sync --package bird-feeder                                  # environment = bird-feeder's own subset
uv run --package bird-feeder pytest packages/bird-feeder/tests # pytest must be in bird-feeder's dev group
```

And, independent of any workspace semantics, build the member and install its wheel into an environment of its own:

```bash
uv build --package bird-feeder --out-dir dist/bird-feeder
python -m venv .venv-bird-feeder
.venv-bird-feeder/bin/python -m pip install dist/bird-feeder/bird_feeder-*.whl pytest
.venv-bird-feeder/bin/python -P -m pytest packages/bird-feeder/tests
```

## One `requires-python` for everyone

> *"Finally, uv's workspaces enforce a single `requires-python` for the entire workspace, taking the intersection of all members' `requires-python` values. If you need to support testing a given member on a Python version that isn't supported by the rest of the workspace, you may need to use `uv pip` to install that member in a separate virtual environment."*

A library member that promises Python 3.10 support inside a workspace whose service requires 3.12 is never tested on 3.10 by the workspace environment.

## When a workspace is the wrong layout

> *"Workspaces are intended to facilitate the development of multiple interconnected packages within a single repository."*

> *"Workspaces help enforce isolation and separation of concerns. For example, in uv, we have separate packages for the core library and the command-line interface, enabling us to test the core library independently of the CLI, and vice versa."*

uv lists extension-module subroutines and plugin systems as the other common cases, then the boundary:

> *"Workspaces are not suited for cases in which members have conflicting requirements, or desire a separate virtual environment for each member. In this case, path dependencies are often preferable."*

```toml
[project]
name = "albatross"
version = "0.1.0"
requires-python = ">=3.12"
dependencies = ["bird-feeder", "tqdm>=4,<5"]

[tool.uv.sources]
bird-feeder = { path = "packages/bird-feeder" }

[build-system]
requires = ["uv_build>=0.12.12,<0.13"]
build-backend = "uv_build"
```

> *"This approach conveys many of the same benefits, but allows for more fine-grained control over dependency resolution and virtual environment management (with the downside that `uv run --package` is no longer available; instead, commands must be run from the relevant package directory)."*

The same directory tree serves both; the difference is one table in the root. And the uv build backend points the other way for the opposite mistake — several top-level packages crammed into one distribution: *"While we do not recommend this structure (i.e., you should use a workspace with multiple packages instead)"*.

## Gotchas

**★ Symptom: a member works in the workspace and fails with `ModuleNotFoundError` when installed on its own.** Cause: it imports a dependency that only a sibling declared, and the shared environment supplied it — *"uv can't ensure that packages don't import dependencies declared by another workspace member."* Fix: declare it in the member, and test the member against its own dependency subset.

```toml
# packages/bird-feeder/pyproject.toml
[project]
name = "bird-feeder"
version = "0.1.0"
requires-python = ">=3.12"
dependencies = ["tqdm>=4,<5"]
```

```bash
uv sync --package bird-feeder
uv run --package bird-feeder pytest packages/bird-feeder/tests
```

**★ Symptom: `uv run pytest` at the root never runs a member's own configuration or tools.** Cause: *"`uv run` and `uv sync` operate on the workspace root by default"*. Fix: target the member.

```bash
uv run --package bird-feeder pytest packages/bird-feeder/tests
```

**★ Symptom: a member's lower `requires-python` is never exercised in CI.** Cause: the workspace takes *"the intersection of all members' `requires-python` values"*, so its environment only ever uses Pythons every member supports. Fix: test that member in its own environment with `uv pip`, as uv suggests.

```bash
uv venv --python 3.10 .venv-py310
uv pip install --python .venv-py310/bin/python ./packages/bird-feeder pytest
.venv-py310/bin/python -P -m pytest packages/bird-feeder/tests
```

**Symptom: uv reports an error about a member directory when a new folder is added under `packages/`.** Cause: every directory matched by `members` *"must contain a `pyproject.toml` file"*, and `packages/shared-assets/` has none. Fix: exclude it, or keep non-project directories out of the glob.

```toml
[tool.uv.workspace]
members = ["packages/*"]
exclude = ["packages/shared-assets"]
```

**Symptom: a root-level source for a dependency stops applying to one member on one platform.** Cause: the member defines its own source for that dependency, and then *"it will ignore any `tool.uv.sources` for the same dependency in the workspace root, even if the member's source is limited by a marker that doesn't match the current platform."* Fix: give the member the complete set of sources it needs.

```toml
# packages/bird-feeder/pyproject.toml — repeat the root's source, with no marker to fall through
[tool.uv.sources]
tqdm = { git = "https://github.com/tqdm/tqdm" }
```

**Symptom: the workspace cannot be locked because two members need incompatible versions of a dependency.** Cause: one lockfile, one resolution — workspaces *"are not suited for cases in which members have conflicting requirements"*. Fix: make them independent projects joined by path dependencies.

```toml
[tool.uv.sources]
bird-feeder = { path = "packages/bird-feeder" }
```

**Symptom: two members both ship a top-level package called `common`, and one of them silently wins.** Cause: members install into one environment, where a top-level import name can resolve to only one directory. Fix: give every member a distinct import package.

```text
packages/billing/src/billing_common/
packages/ledger/src/ledger_common/
```

**Symptom: a file excluded from one member's wheel is used by another member and nothing fails.** Cause: *"Dependencies between workspace members are editable"*, so siblings import each other's `src/` directly. Fix: in the release-guard job, install members non-editable.

```bash
uv run --locked --no-editable --package albatross pytest
```

## Interview questions

**★ What does a uv workspace look like as a layout?**
A root project — itself a member — whose `pyproject.toml` has a `[tool.uv.workspace]` table listing member directories by glob. Each member is a complete project with its own `pyproject.toml` and, conventionally, its own `src/` package; uv's canonical example puts them under `packages/`. The whole workspace shares one `uv.lock`, one environment and one effective `requires-python`, and members depend on each other through ordinary requirements routed by `{ workspace = true }` sources.

**★ Why can a workspace member import a package it never declared, and how do you catch it?**
Because every member is installed into one environment, and Python has no per-package dependency isolation; uv says outright that it cannot ensure a member does not import a sibling's dependencies. The import works in development and fails when the member is installed alone. Catch it by narrowing the environment to one member — `uv sync --package`, which updates the environment to that member's declared subset — or, most reliably, by building the member's wheel and testing it in a fresh environment.

**When should you use path dependencies instead of a workspace?**
When members have conflicting requirements, need different Python versions, or should each have their own environment. uv's documentation names exactly those cases. Path dependencies keep the same directory tree but give each project its own resolution and environment, at the cost of `uv run --package` — commands are run from each package's directory instead.

**What does "dependencies between workspace members are editable" mean for testing?**
That a member imports its siblings' source trees directly, not their built artifacts. Any file a sibling's build configuration would exclude is still visible, just as in a single project's editable install. A release pipeline should therefore test members installed as regular packages — `--no-editable`, or wheels in a fresh environment — at least once before publishing.

**Why does a workspace have a single `requires-python`?**
Because it has a single lockfile and a single environment: one resolution has to be valid for every member at once, so uv intersects their `requires-python` ranges. The consequence is that a member claiming wider support than the others is never tested on the Pythons only it supports; uv suggests using `uv pip` to install such a member into a separate environment for that testing.

**What is the difference between a workspace and one distribution with several top-level packages?**
A workspace keeps one distribution per package — each with its own `pyproject.toml`, version, dependencies and wheel — and ties them together for development with one lockfile and one environment. A single distribution with several top-level packages ships them as one artifact with one version and one dependency list. The uv build backend supports the latter only through an explicit module list and says it does not recommend it, pointing to a workspace instead; setuptools' flat-layout discovery refuses it unless configured.

---

← Prev: [12 · `uv init` layouts](12-uv-init-layouts.md) · [Topic index](README.md) · Next → [14 · Moving a flat project to src](14-moving-a-flat-project-to-src.md)
