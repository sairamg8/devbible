---
title: "pytest's rootdir decides node IDs, the cache location and what relative config paths mean — it never touches sys.path — while the pythonpath setting does exactly that, and pointing it at src/ turns a src layout back into a flat one"
sidebar_label: "06b · rootdir and pythonpath"
sidebar_position: 8
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-10 · target **Python 3.14.7** · against pytest *Configuration* ([docs.pytest.org](https://docs.pytest.org/en/stable/reference/customize.html)), the *API reference* confvals `pythonpath`, `testpaths`, `consider_namespace_packages` ([docs.pytest.org](https://docs.pytest.org/en/stable/reference/reference.html)) and *Good Integration Practices* ([docs.pytest.org](https://docs.pytest.org/en/stable/explanation/goodpractices.html)). pytest stable docs are the **9.x** line.
> Documentation-validated — **no sandbox run, no program output**.

**Two pytest concepts are routinely confused with import behaviour, and the confusion runs in opposite directions. `rootdir` sounds as if it should make the project importable and does not affect imports at all. `pythonpath` sounds like harmless configuration and is a direct edit of `sys.path` for the whole session. Both are anchored to where your configuration file sits, which is a layout decision — and in a monorepo or uv workspace, where several `pyproject.toml` files exist, *which* one pytest picks changes both. This chunk is the configuration side of [06](06-pytest-import-modes.md).**

## `rootdir` does not touch imports

> *"`rootdir` is **NOT** used to modify `sys.path`/`PYTHONPATH` or influence how modules are imported."*

What it is used for, verbatim:

> *"Construct nodeids during collection; each test is assigned a unique nodeid which is rooted at the `rootdir`"*

> *"Is used by plugins as a stable location to store project/test run specific information; for example, the internal cache plugin creates a `.pytest_cache` subdirectory in `rootdir` to store its cross-test run state."*

It is also the anchor for relative paths in configuration — `pythonpath` entries are *"relative to the `rootdir` directory"*, and `testpaths` applies *"when executing pytest from the `rootdir` directory"* — and, under `importlib` mode, the base from which pytest derives unique module names.

### How pytest finds it

> *"If `-c` is passed in the command-line, use that as configuration file, and its directory as `rootdir`."*

> *"Determine the common ancestor directory for the specified `args` that are recognised as paths that exist in the file system. If no such paths are found, the common ancestor directory is set to the current working directory."*

> *"Look for `pytest.toml`, `.pytest.toml`, `pytest.ini`, `.pytest.ini`, `pyproject.toml`, `tox.ini`, and `setup.cfg` files in the ancestor directory and upwards. If one is matched, it becomes the `configfile` and its directory becomes the `rootdir`."*

> *"If no configuration file was found, look for `setup.py` upwards from the common ancestor directory to determine the `rootdir`."*

> *"If no `configfile` was found and no configuration argument is passed, use the already determined common ancestor as root directory."*

For a single project with `pyproject.toml` at the root, the root is the `rootdir` and everything is anchored there. In a layout with nested projects — a uv workspace with `packages/*/pyproject.toml`, covered in [13](13-workspaces-as-a-layout.md) — the upward search from inside a member stops at the member's file. The same `pytest` command therefore uses a different configuration, a different cache and different node IDs depending on which directory you pass it.

## Which file holds the configuration

> *"`pytest.toml` files take precedence over other files, even when empty."* — new in pytest 9.0.

> *"Use `[tool.pytest]` to leverage native TOML types (supported since pytest 9.0)"*

> *"Use `[tool.pytest.ini_options]` for INI-style configuration (supported since pytest 6.0)"*

> *"Usage of `setup.cfg` is not recommended unless for very simple use cases."*

The pages in this topic use `[tool.pytest.ini_options]`, which every pytest since 6.0 reads. Why the table has that extra `.ini_options` level is covered in [pyproject.toml · 12 · The tool namespace](../01-pyproject-toml/12-the-tool-namespace.md).

## `pythonpath` — an explicit `sys.path` edit

> *"Sets list of directories that should be added to the python search path. Directories will be added to the head of `sys.path`. Similar to the `PYTHONPATH` environment variable, the directories will be included in where Python will look for imported modules. Paths are relative to the `rootdir` directory. Directories remain in path for the duration of the test session."*

*"Added to the head of `sys.path`"* is the phrase to read carefully. A directory listed here is searched before site-packages for the entire session. That makes it the configuration-file form of `PYTHONPATH=src pytest`, which pytest documents for running an uninstalled src project:

> *"You can do it in an ad-hoc manner by setting the `PYTHONPATH` environment variable"* … *"or in a permanent manner by using the `pythonpath` configuration variable"*

Legitimate uses exist — a repository of scripts that is never built, or a directory of test-only support code that must be importable under `importlib` mode:

```toml
[tool.pytest.ini_options]
pythonpath = ["tests/support"]     # test-only helpers, never shipped, importable by name
addopts = ["--import-mode=importlib"]
testpaths = ["tests"]
```

The illegitimate use is the common one: `pythonpath = ["src"]` or `pythonpath = ["."]` in a project that ships a wheel. Either puts the package's source tree ahead of the installation for every test, which is the flat layout's behaviour recreated in a file nobody reads.

⚠️ The documentation says both the interpreter's working-directory entry and the `pythonpath` entries go at the head of `sys.path`, but neither page states their relative order when both are present. This page does not guess; a src layout without a `pythonpath` entry for `src/` makes the question irrelevant.

## `testpaths`

> *"Sets list of directories that should be searched for tests when no specific directories, files or test ids are given in the command line when executing pytest from the `rootdir` directory."*

> *"Useful when all project tests are in a known location to speed up test collection and to avoid picking up undesired tests by accident."*

Note the qualifier: it applies to a bare `pytest` run *from the `rootdir`*. Run from a subdirectory, or with explicit paths, and it does not constrain collection.

## `consider_namespace_packages`

Added in pytest 8.1, default `false`:

> *"Controls if pytest should attempt to identify namespace packages when collecting Python modules."*
> *"Set to `True` if the package you are testing is part of a namespace package."*
> *"Only native namespace packages are supported, with no plans to support legacy namespace packages."*
> *"For best results when using `consider_namespace_packages`, pytest needs to be able to import your namespace packages. This is best achieved by installing the packages in your environment, most commonly in "editable" mode."*

It matters only when tests live inside a PEP 420 namespace; [09](09-namespace-packages-and-the-missing-init.md) covers the layout side.

## A configuration for the src layout

Everything above, applied to the running example:

```toml
[tool.pytest.ini_options]
testpaths = ["tests"]
addopts = ["--import-mode=importlib"]
# no pythonpath: the package is importable because it is installed
```

With an installed package, `importlib` mode and no `pythonpath`, nothing pytest does and nothing in its configuration puts your source tree on `sys.path`. The copy under test is whatever the environment holds — editable in development, a regular install in the release-guard job from [04](04-editable-installs-reopen-the-hole.md).

## Gotchas

**★ Symptom: settings in `[tool.pytest.ini_options]` are suddenly ignored.** Cause: a `pytest.toml` appeared — *"`pytest.toml` files take precedence over other files, even when empty."* An empty one committed by a template or an editor is enough. Fix: delete it or move the configuration into it; keep one source.

```bash
git rm pytest.toml
```

**★ Symptom: someone expects `rootdir` to make the project importable.** Cause: *"`rootdir` is **NOT** used to modify `sys.path`/`PYTHONPATH` or influence how modules are imported."* Fix: make the package importable by installing it.

```bash
uv sync
uv run pytest
```

**★ Symptom: in a uv workspace, `pytest` behaves differently from the repository root and from inside a member.** Cause: rootdir discovery walks upward from the paths given and stops at the first configuration file, so the member's `pyproject.toml` wins inside the member. Fix: choose the configuration explicitly when running from the root.

```bash
uv run --package bird-feeder pytest -c packages/bird-feeder/pyproject.toml packages/bird-feeder/tests
```

**Symptom: a `pythonpath` entry works on one machine and imports nothing on another.** Cause: entries are *"relative to the `rootdir` directory"*, and `rootdir` moved — a different configuration file was found, or `-c` was used. Fix: remove the dependency; install the package instead of pointing at its directory.

```toml
[tool.pytest.ini_options]
testpaths = ["tests"]
```

**Symptom: the release-guard job passes a packaging bug even with a non-editable install.** Cause: `pythonpath = ["src"]` puts the source tree at the head of `sys.path` for the whole session. Fix: delete the entry.

```toml
[tool.pytest.ini_options]
testpaths = ["tests"]
addopts = ["--import-mode=importlib"]
```

**Symptom: settings in a `[tool.pytest]` table have no effect on one CI runner.** Cause: the native-TOML `[tool.pytest]` table is *"supported since pytest 9.0"*; an older pytest reads only `[tool.pytest.ini_options]`. Fix: put a floor on pytest in the dev group, or use the INI-style table.

```toml
[dependency-groups]
dev = ["pytest>=9.0"]
```

**Symptom: `testpaths` is set and a run still collects from `docs/`.** Cause: `testpaths` applies only when no paths are given *and* pytest runs from the `rootdir`. Fix: run from the root without paths, or pass the test directory explicitly.

```bash
uv run pytest tests
```

**Symptom: `.pytest_cache/` directories appear inside subpackages or members.** Cause: the cache is created in whatever `rootdir` each run found. Fix: run from one place, and ignore the cache everywhere.

```text
# .gitignore
.pytest_cache/
```

## Interview questions

**★ Does pytest's `rootdir` affect how your package is imported?**
No, and the documentation says so in bold: it is not used to modify `sys.path` or influence imports. It anchors node IDs, the `.pytest_cache` location, relative configuration paths such as `pythonpath` and `testpaths`, and the names `importlib` mode derives for test modules. What makes your package importable is the environment — or, dangerously, an explicit `pythonpath` setting.

**How does pytest decide the `rootdir`?**
`-c` wins outright. Otherwise it takes the common ancestor of the path arguments, or the current directory if there are none, and searches that directory and its ancestors for `pytest.toml`, `.pytest.toml`, `pytest.ini`, `.pytest.ini`, `pyproject.toml`, `tox.ini` and `setup.cfg`; the first match is the config file and its directory is the `rootdir`. Failing that it looks upward for `setup.py`, and failing that uses the common ancestor. In a repository with several projects, this is why the directory you run from changes which configuration applies.

**★ What does the `pythonpath` setting do, and when is it legitimate?**
It adds directories, relative to the `rootdir`, to the head of `sys.path` for the whole session — the configuration equivalent of `PYTHONPATH`. It is legitimate for code that is never installed: a scripts repository, or a test-support directory that must be importable under `importlib` mode. It is a trap in a project that ships a wheel, because `pythonpath = ["src"]` makes every test import the source tree ahead of the installation.

**What is the difference between `[tool.pytest]` and `[tool.pytest.ini_options]`?**
`[tool.pytest.ini_options]` is the INI-style table supported since pytest 6.0, in which values follow INI semantics. `[tool.pytest]`, supported since 9.0, reads native TOML types. Both live in `pyproject.toml`; the newer one requires pytest 9 on every machine that runs the suite.

**Why set `testpaths` at all?**
To keep a bare `pytest` from recursing into directories that are not the suite — `src/` with inlined examples, `docs/`, a `build/` tree containing copies of test files — which slows collection and can collect the same tests twice. pytest's documentation gives both reasons. It only applies when pytest is run from the `rootdir` without explicit paths.

**Why can an empty `pytest.toml` break a project's test configuration?**
Because pytest 9's documentation says `pytest.toml` files *"take precedence over other files, even when empty."* An empty one becomes the configuration file and fixes the `rootdir` at its directory, so every setting in `[tool.pytest.ini_options]` stops applying — `testpaths`, `addopts`, the import mode — without any error. It is the configuration equivalent of the wrong-copy bug: a file nobody meant to be authoritative is found first.

---

← Prev: [06 · pytest import modes](06-pytest-import-modes.md) · [Topic index](README.md) · Next → [07 · How backends find your package](07-how-backends-find-your-package.md)
