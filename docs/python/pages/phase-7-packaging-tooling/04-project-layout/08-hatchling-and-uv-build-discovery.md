---
title: "hatchling tries four places in a fixed order — the flat one first — and the uv build backend looks in exactly one, src/<package_name>/, so the same tree can build three different wheels depending on which backend you named"
sidebar_label: "08 · hatchling and uv_build"
sidebar_position: 10
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-10 · target **uv 0.12.12** (`uv_build>=0.12.12,<0.13`), **Python 3.14.7** · against hatch *Build configuration* ([hatch.pypa.io](https://hatch.pypa.io/latest/config/build/)), hatch *Wheel builder* ([hatch.pypa.io](https://hatch.pypa.io/latest/plugins/builder/wheel/)) and *Source distribution builder* ([hatch.pypa.io](https://hatch.pypa.io/latest/plugins/builder/sdist/)), and uv *The uv build backend* ([docs.astral.sh](https://docs.astral.sh/uv/concepts/build-backend/)).
> Documentation-validated — **no sandbox run, no program output**; no backend error message is quoted.

**setuptools guesses from the layout ([07](07-how-backends-find-your-package.md)). hatchling and the uv build backend are more literal. hatchling takes your project name and checks four candidate paths in a documented order, shipping the first that exists — and the flat candidate comes before the src one, which matters the day a half-finished migration leaves both. The uv backend expects one module at `src/<package_name>/__init__.py` and makes you say so if it lives anywhere else, in exchange for validating the structure and refusing layouts it considers mistakes. Knowing both rules is how you read an unfamiliar `pyproject.toml` and predict what its wheel will contain.**

## hatchling

### The default: four candidates, in order

> *"When the user has not set any file selection options, the project name will be used to determine the package to ship in the following heuristic order:"*
> 1. `<NAME>/__init__.py`
> 2. `src/<NAME>/__init__.py`
> 3. `<NAME>.py`
> 4. `<NAMESPACE>/<NAME>/__init__.py`
>
> *"If none of these heuristics are satisfied, an error will be raised."*

The order is the whole story. A flat package directory is checked *before* the src one, so if both exist, the root copy is the one that ships. And a directory whose name is not derived from the project name matches none of the four, and the build fails rather than guessing. The page says the *project name* is used; it does not spell out how a hyphenated name such as `invoice-service` is converted to a directory name, so this page will not assert the conversion — if the heuristic does not pick your directory up, state it explicitly as below.

There is an escape hatch for projects that intentionally ship nothing selected by the heuristic — `bypass-selection`, *"Whether or not to suppress the error when one has not defined any file selection options and all heuristics have failed to determine what to ship"* — which is rarely what you want; an explicit selection is clearer.

### Explicit selection

The one line most src projects need when the heuristic does not fit:

```toml
[tool.hatch.build.targets.wheel]
packages = ["src/invoice_service"]
```

> *"The `packages` option is semantically equivalent to `only-include` (which takes precedence) except that the shipped path will be collapsed to only include the final component."*

hatch documents that `packages = ["src/foo"]` is equivalent to:

```toml
[tool.hatch.build.targets.wheel]
only-include = ["src/foo"]
sources = ["src"]
```

`sources` is the path-rewriting mechanism; the table form maps one prefix to another — `"src/foo" = "bar"` *"would distribute the file `src/foo/file.ext` as `bar/file.ext`"*. And `only-include` changes traversal:

> *"You can use the `only-include` option to prevent directory traversal starting at the project root and only select specific relative paths to directories or files. Using this option ignores any defined `include` patterns."*

### Your VCS ignore file is build configuration

> *"By default, Hatch will respect the first `.gitignore` or `.hgignore` file found in your project's root directory or parent directories."*

> sdist: *"All files that are not ignored by your VCS will be included."* — plus, always, `/pyproject.toml`, `/hatch.toml`, `/hatch_build.py`, `/.gitignore` or `/.hgignore`, the `readme` and all `license-files`.

That makes `.gitignore` part of your packaging. A generated module you ignore in git — a `_version.py` written by a build hook, a compiled file — is ignored by the build too, unless you declare it an artifact:

> *"If you want to include files that are ignored by your VCS, such as those that might be created by build hooks, you can use the `artifacts` option. This option is semantically equivalent to `include`."*

```toml
[tool.hatch.build.targets.wheel]
packages = ["src/invoice_service"]
artifacts = ["src/invoice_service/_version.py"]
```

`include` and `exclude` are *"Git-style glob pattern"*s, *"with `exclude` taking precedence"*; artifacts, notably, *"are not affected by the `exclude` option."*

## The uv build backend

### One module, in one place

> *"Python packages are expected to contain one or more Python modules, which are directories containing an `__init__.py`. By default, a single root module is expected at `src/<package_name>/__init__.py`."*

> *"uv normalizes the package name to determine the default module name: the package name is lowercased and dots and dashes are replaced with underscores, e.g., `Foo-Bar` would be converted to `foo_bar`."*

> *"The `src/` directory is the default directory for module discovery."*

So `name = "invoice-service"` means the backend looks for `src/invoice_service/__init__.py`, and nothing else. Anything else is configured with two keys:

> *"These defaults can be changed with the `module-name` and `module-root` settings."*

```toml
# a flat project whose module is FOO/ in the root — uv's own example
[tool.uv.build-backend]
module-name = "FOO"
module-root = ""
```

```toml
# a src project whose directory name differs from the distribution name
[tool.uv.build-backend]
module-name = "invoices"
```

### What it refuses, and why

> *"There are no specific wheel includes. There must only be one top level module, and all data files must either be under the module root or in the appropriate data directory."*

Two top-level packages under `src/` are supported only through an explicit list, which the documentation discourages:

> *"While we do not recommend this structure (i.e., you should use a workspace with multiple packages instead), it is supported by setting `module-name` to a list of names"*

```toml
[tool.uv.build-backend]
module-name = ["foo", "bar"]
```

The recommended alternative — one distribution per package in a workspace — is [13](13-workspaces-as-a-layout.md). Namespace packages are covered in [09](09-namespace-packages-and-the-missing-init.md).

The backend's scope is deliberate:

> *"The uv build backend currently **only supports pure Python code**."*

> *"While the backend supports a number of options for configuring your project structure, when build scripts or a more flexible project layout are required, consider using the hatchling build backend instead."*

### Includes are anchored, excludes are not

> *"Includes are anchored, which means that `pyproject.toml` includes only `<root>/pyproject.toml` and not `<root>/bar/pyproject.toml`. To recursively include all files under a directory, use a `/**` suffix, e.g. `src/**`."*

> *"Excludes are not anchored, which means that `__pycache__` excludes all directories named `__pycache__` regardless of its parent directory. All children of an exclusion are excluded as well. To anchor a directory, use a `/` prefix, e.g., `/dist` will exclude only `<root>/dist`."*

That asymmetry decides whether an exclusion aimed at a root directory also hits a same-named directory inside your package:

```toml
[tool.uv.build-backend]
source-exclude = ["/data"]      # only <root>/data — not src/invoice_service/data
```

### Pinning it

> *"The uv build backend follows the same versioning policy as uv. Including an upper bound on the `uv_build` version ensures that your package continues to build correctly as new versions are released."*

```toml
[build-system]
requires = ["uv_build>=0.12.12,<0.13"]
build-backend = "uv_build"
```

## One tree, three backends

The same src project, and what each backend needs to be told:

| Tree | setuptools | hatchling | uv_build |
|---|---|---|---|
| `src/invoice_service/` for `invoice-service` | nothing | nothing, if the heuristic resolves the name; else `packages = ["src/invoice_service"]` | nothing |
| `src/invoices/` for `invoice-service` | nothing — discovery is by location | `packages = ["src/invoices"]` | `module-name = "invoices"` |
| `invoice_service/` in the root | nothing — flat auto-discovery | nothing — candidate 1 | `module-root = ""` |
| two packages under `src/` | nothing | `packages = ["src/a", "src/b"]` | `module-name = ["a", "b"]` — or a workspace |
| C extension | supported | via build hooks/plugins | not supported |

## Gotchas

**★ Symptom: after moving to `src/`, hatchling still ships the old code.** Cause: a root `invoice_service/` directory survived the migration, and the heuristic checks `<NAME>/__init__.py` *before* `src/<NAME>/__init__.py`. Fix: delete the root copy, and make the selection explicit so it cannot recur.

```toml
[tool.hatch.build.targets.wheel]
packages = ["src/invoice_service"]
```

**★ Symptom: hatchling fails to build a project whose package directory is not named after the project.** Cause: none of the four heuristic candidates exists, and *"If none of these heuristics are satisfied, an error will be raised."* Fix: name the directory.

```toml
[tool.hatch.build.targets.wheel]
packages = ["src/invoices"]
```

**★ Symptom: the uv backend cannot find the module in a project it did not scaffold.** Cause: it looks only at `src/<normalized name>/__init__.py`; a flat directory or a differently named one is invisible to it. Fix: say where the module is.

```toml
[tool.uv.build-backend]
module-name = "invoice_service"
module-root = ""
```

**★ Symptom: a generated `_version.py` is missing from a hatchling build and present on disk.** Cause: it is listed in `.gitignore`, and hatchling respects VCS ignore files for file selection. Fix: declare it an artifact.

```toml
[tool.hatch.build.targets.wheel]
artifacts = ["src/invoice_service/_version.py"]
```

**Symptom: an `include` pattern for an extra file has no effect once `packages` is set.** Cause: `packages` is `only-include`, and `only-include` *"ignores any defined `include` patterns"*. Fix: keep the file inside the package directory, or force-include it at an explicit destination.

```toml
[tool.hatch.build.targets.wheel.force-include]
"schemas/invoice.json" = "invoice_service/schemas/invoice.json"
```

**Symptom: a `source-exclude` meant for a root directory removed package data too.** Cause: excludes are *"not anchored"*, so `data` matches every directory named `data`. Fix: anchor it with a leading slash.

```toml
[tool.uv.build-backend]
source-exclude = ["/data"]
```

**Symptom: the uv backend rejects a second top-level package under `src/`.** Cause: *"There must only be one top level module"* unless `module-name` lists several, which uv does not recommend. Fix: split into workspace members, or list the modules explicitly if the single distribution is intentional.

```toml
[tool.uv.build-backend]
module-name = ["invoice_service", "invoice_admin"]
```

**Symptom: a project adds a Cython or Rust extension and the uv backend cannot build it.** Cause: *"The uv build backend currently **only supports pure Python code**."* Fix: change backend — uv can scaffold one with `uv init --build-backend maturin` or `scikit-build-core` ([12](12-uv-init-layouts.md)).

```toml
[build-system]
requires = ["setuptools >= 77.0.3", "Cython >= 3.0"]
build-backend = "setuptools.build_meta"
```

**Symptom: a build that worked yesterday fails after a new `uv_build` release.** Cause: an unbounded `requires`, against a backend that *"follows the same versioning policy as uv"* — pre-1.0, where minor releases may break. Fix: the upper bound uv's own template writes.

```toml
[build-system]
requires = ["uv_build>=0.12.12,<0.13"]
build-backend = "uv_build"
```

## Interview questions

**★ How does hatchling decide what goes into a wheel when you configure nothing?**
It uses the project name to try four paths in order — `<NAME>/__init__.py`, `src/<NAME>/__init__.py`, `<NAME>.py`, `<NAMESPACE>/<NAME>/__init__.py` — and ships the first that exists, raising an error if none does. The order means a flat package beats a src one when both exist, and a directory not named after the project is never found without explicit configuration.

**★ What does the uv build backend expect, and what does it refuse?**
Exactly one module at `src/<package_name>/__init__.py`, where the name is the project name lowercased with dots and dashes turned into underscores. `module-name` and `module-root` change that. It refuses more than one top-level module unless you list them, recommends a workspace instead, requires data to live under the module or in a declared data directory, and supports only pure Python.

**Why does hatchling's `.gitignore` handling matter for layout?**
Because hatchling uses the VCS ignore file to decide what to ship: the sdist is *"all files that are not ignored by your VCS"*, and ignored directories are not traversed. A generated file you keep out of git is kept out of the build unless declared under `artifacts`. Your ignore file becomes part of your packaging configuration, which it is not for setuptools.

**What does `packages = ["src/foo"]` do in hatchling, precisely?**
It is `only-include = ["src/foo"]` plus `sources = ["src"]`: traversal is restricted to that directory, and the `src/` prefix is stripped so the wheel contains `foo/`. Because it is an `only-include`, any `include` patterns are ignored.

**Why are uv's includes anchored but excludes not?**
Includes name what you want from specific places, so anchoring them to the root is precise and reproducible — uv even recommends avoiding unanchored include patterns. Excludes are usually aimed at junk that can appear anywhere, like `__pycache__`, so they match at any depth, and a leading `/` anchors one when you mean only the root. The trap is an exclude written for a root directory that also matches a directory of the same name inside the package.

**A half-migrated project has both `invoice_service/` and `src/invoice_service/`. What does each backend ship?**
hatchling ships the root copy: its documented heuristic checks `<NAME>/__init__.py` before `src/<NAME>/__init__.py`. The uv backend ships the src copy, because its default module root is `src/` and it looks nowhere else unless `module-root` says so. setuptools' documentation describes both layouts but does not state which wins when both are present, so this page does not guess. The practical answer is the same for all three: delete the stale copy and make the selection explicit.

---

← Prev: [07 · setuptools package discovery](07-how-backends-find-your-package.md) · [Topic index](README.md) · Next → [09 · Namespace packages and the missing `__init__.py`](09-namespace-packages-and-the-missing-init.md)
