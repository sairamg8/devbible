---
title: "Tool commands run at the user level and ignore the project's configuration, so the question of where a tool belongs — an install, a dev dependency group, or a `uvx` call — is decided by who needs the same version, not by convenience"
sidebar_label: "07d · Tools: config and choosing"
sidebar_position: 30
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-10 against **uv 0.12.12** — *Configuration files*
> ([docs.astral.sh](https://docs.astral.sh/uv/concepts/configuration-files/)), *Tools*
> ([docs.astral.sh](https://docs.astral.sh/uv/concepts/tools/)), *Storage*
> ([docs.astral.sh](https://docs.astral.sh/uv/reference/storage/)) and the environment variable
> reference ([docs.astral.sh](https://docs.astral.sh/uv/reference/environment/)).
> Version spine: **uv 0.12.12** (2026-09-09) · Python 3.14.7 · **ruff 0.16.6** · pre-commit 4.6.2.
> Documentation-validated, **no sandbox run, no timings**.

**[07c](07c-uv-tool-install.md) covered what a tool install is. This page covers where it sits relative
to everything else. uv treats tools as belonging to the *user*, not to a project: tool commands skip
project and local configuration files, so an index, a setting or a pin in `pyproject.toml` does not
exist for `uvx` or `uv tool install` even when you run them inside that project. That single rule
explains the internal-index failure, and it also answers the design question of where a tool belongs.
If a tool must be the same version for every developer and in CI, it cannot live in a user-level
mechanism; it goes in a committed file. If it is personal, it goes in a tool install or a `uvx` call.
And if it imports your code, it was never a tool at all.**

## 🔴 Tool commands ignore project configuration

> *"For `tool` commands, which operate at the user level, local configuration files will be ignored."*
> — [configuration files](https://docs.astral.sh/uv/concepts/configuration-files/)

A `[[tool.uv.index]]` entry in your project's `pyproject.toml` therefore has no effect on
`uv tool install` or `uvx`, even when you run them inside the project. Tools that come from an internal
index need the index configured where user-level commands look — the user-level `uv.toml` or an
environment variable ([08](08-configuration-files.md)):

```toml
# ~/.config/uv/uv.toml  (macOS and Linux; %APPDATA%\uv\uv.toml on Windows)
[[index]]
name = "internal"
url = "https://pypi.internal.example.com/simple"
default = true
```

## Tool, dev dependency, or `uvx`?

| The tool… | Put it | Because |
|---|---|---|
| imports your code (pytest, mypy) | a dev dependency group, run with `uv run` | it must see the project ([07](07-uvx-and-tools.md)) |
| must be the same version for everyone (a formatter in CI) | a locked dev group, or a pre-commit `rev` | only a committed file is a team contract |
| is a personal daily CLI (httpie, a release helper) | `uv tool install` | permanent, on `PATH`, isolated |
| is run occasionally | `uvx` | *"In most cases, executing a tool with `uvx` is more appropriate than installing the tool."* |
| must exist in a build image | `uv tool install` with `UV_TOOL_BIN_DIR` on `PATH` | the image is the persistent machine |

```dockerfile
ENV UV_TOOL_DIR=/opt/uv-tools \
    UV_TOOL_BIN_DIR=/usr/local/bin
RUN uv tool install ruff@0.16.6
```

## Gotchas

**★ Symptom: `uvx internal-cli` and `uv tool install internal-cli` cannot find the package, while `uv add internal-cli` in the project can.**
Cause: the index is configured in the project, and *"for `tool` commands, which operate at the user
level, local configuration files will be ignored."* Fix: configure it at user level.

```bash
export UV_DEFAULT_INDEX=https://pypi.internal.example.com/simple
uv tool install internal-cli
```

**Symptom: in a container, tools installed at build time are not found by the runtime user.**
Cause: the executables went to the build user's `~/.local/bin`, which is neither shared nor on the
runtime user's `PATH`. Fix: put tools and their executables in system locations at build time.

```dockerfile
ENV UV_TOOL_DIR=/opt/uv-tools UV_TOOL_BIN_DIR=/usr/local/bin
RUN uv tool install ruff@0.16.6
```

**Symptom: CI runs `uvx ruff@0.16.6` and a developer's editor runs a different ruff, and they disagree about formatting.**
Cause: two mechanisms, two versions — the pin exists only in a CI command line, not in anything the
editor reads. Fix: put the version in one committed place and run every consumer from it.

```bash
uv add --dev ruff==0.16.6       # recorded in pyproject.toml and uv.lock
uv run ruff format --check .    # CI
uv run ruff format .            # developers, and the editor's configured command
```

## Interview questions

**★ When do you `uv tool install` a tool, and when do you just `uvx` it?**
Install what you run daily and what a machine must always have; `uvx` everything else. An install
creates a persistent environment in the tools directory and puts the executables on `PATH`, so it
survives cache cleaning, starts immediately, and works without typing `uvx`. `uvx` creates a cached,
disposable environment on demand, which costs nothing to maintain and cannot go stale in the way a
forgotten install does. uv's own guidance leans to the second — *"In most cases, executing a tool with
`uvx` is more appropriate than installing the tool"* — and neither is the answer for a tool whose version
must match across a team, which belongs in a committed file.

**Why do tool commands ignore the project's `[tool.uv]` configuration?**
Because a tool is a user-level thing, not a project-level one. uv states it: *"For `tool` commands, which
operate at the user level, local configuration files will be ignored."* If tools read the configuration
of whatever directory you happened to be in, the same `uv tool install` would produce different results
depending on where you ran it, and an installed tool's environment would silently depend on a project
you might later delete. The cost is practical: an internal index configured in a project does not reach
`uvx` or `uv tool install`, so tools from that index need a user-level `uv.toml` or an environment
variable.

**How would you provision command-line tools in a CI or build image with uv?**
Install them at build time into system locations, with a pinned version each. `UV_TOOL_DIR` moves the
environments out of the build user's home and `UV_TOOL_BIN_DIR` puts the executables in a directory
every user already has on `PATH`, such as `/usr/local/bin`; then `uv tool install ruff@0.16.6` for each
tool. The alternative — `uvx` at job time — works too, but rebuilds tool environments whenever the cache
is cold, and leaves the version to whatever the job's command line says. For tools that must match what
developers run locally, a locked dev dependency group run with `uv run` is still the more reproducible
choice, because the version is then in `uv.lock` rather than in two places.

**A formatter runs as `uvx ruff` in CI and as a dev dependency locally. What is wrong with that?**
It is two sources of truth for one version. The dev dependency is locked in `uv.lock`; the `uvx` call is
pinned — if at all — in a workflow file, and nothing keeps the two equal. When they drift, CI and
developers format differently and every contributor's diff fights the last one. Either mechanism is
fine alone. For a formatter whose output must be identical everywhere, the locked dev dependency run
with `uv run` is usually the better single source, because it is also what an editor integration and a
pre-commit hook can be pointed at; topic **05 · ruff** *(not written yet)* and topic **11 · pre-commit**
*(not written yet)* argue the specifics for those two consumers.

---

← Prev: [07c · uv tool install](07c-uv-tool-install.md) · [Topic index](README.md) · Next → [08 · Configuration files](08-configuration-files.md)
