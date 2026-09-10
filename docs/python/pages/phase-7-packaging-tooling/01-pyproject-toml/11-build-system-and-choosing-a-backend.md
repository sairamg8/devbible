---
title: "requires and build-backend are two keys with completely different failure modes — one populates an isolated environment, the other is an import path into it — and the distribution name almost never matches the module name you have to write"
sidebar_label: "11 · build-system and backends"
sidebar_position: 11
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-10 against the PyPA *pyproject.toml specification* ([packaging.python.org](https://packaging.python.org/en/latest/specifications/pyproject-toml/)), the PyPA *packaging tutorial* ([packaging.python.org](https://packaging.python.org/en/latest/tutorials/packaging-projects/)), PEP 517 ([peps.python.org](https://peps.python.org/pep-0517/)), PEP 518 ([peps.python.org](https://peps.python.org/pep-0518/)), and pip's *Build System Interface* ([pip.pypa.io](https://pip.pypa.io/en/stable/reference/build-system/)).
> Target: **Python 3.14.7**. Documentation-validated — **no sandbox run, no program output**.

**`[build-system]` is four lines you write once and then never think about, which is precisely why it is where projects break in ways that make no sense: `requires` is the shopping list for a temporary environment, `build-backend` is an import path evaluated inside that environment, and nothing checks that the two agree. You install `hatchling` and import `hatchling.build`; you install `flit_core` and import `flit_core.buildapi`; you install `pdm-backend` and import `pdm.backend`. Three different relationships between a distribution name and a module name, none of them derivable, all of them an `ImportError` at build time if you guess.**

## `requires` — the only mandatory key

> *"The `[build-system]` table is used to store build-related data. Initially, only one key of the table is valid and is mandatory for the table: `requires`."*

> *"This key must have a value of a list of strings representing dependencies required to execute the build system."*

> *"If the table is specified but is missing required fields then the tool should consider it an error."*

Each string is an ordinary dependency specifier, exactly as in `[project] dependencies` — see **[06 · dependencies and markers](06-dependencies-and-markers.md)**. Markers work here too, which is how a build dependency needed only on one platform is declared:

```toml
[build-system]
requires = [
    "setuptools >= 77.0.3",
    "Cython >= 3.0",
    "numpy >= 2.0; python_version >= '3.13'",
]
build-backend = "setuptools.build_meta"
```

🔴 **`requires` is not `dependencies`.** It populates a throwaway environment used to *produce* the wheel and is discarded afterwards. Nothing in `requires` is installed alongside your package. The two arrays overlap only for something genuinely needed at both times — `numpy` in a compiled extension is the standard example, and it must appear in both.

## `build-backend` — an import path, not a name

> *"`build-backend` is a string naming a Python object that will be used to perform the build... This is formatted following the same `module:object` syntax as a `setuptools` entry point."*

> *"if the string is `"flit.api:main"` as in the example above, this object would be looked up by executing the equivalent of: `import flit.api` then `backend = flit.api.main`"*

No colon means the module itself is the backend object. The full mechanism, hooks and all, is in **[02 · The frontend/backend split](02-pep-517-the-frontend-backend-split.md)**.

## The pairings, verbatim from the PyPA tutorial

These are the blocks the tutorial itself prints. Copy them; do not reconstruct them from memory.

```toml
[build-system]
requires = ["hatchling >= 1.26"]
build-backend = "hatchling.build"
```

```toml
[build-system]
requires = ["setuptools >= 77.0.3"]
build-backend = "setuptools.build_meta"
```

```toml
[build-system]
requires = ["flit_core >= 3.12.0, <5"]
build-backend = "flit_core.buildapi"
```

```toml
[build-system]
requires = ["pdm-backend >= 2.4.0"]
build-backend = "pdm.backend"
```

| Install (distribution) | Import (module) | Relationship |
|---|---|---|
| `hatchling` | `hatchling.build` | submodule of the same name |
| `setuptools` | `setuptools.build_meta` | submodule, different word |
| `flit_core` | `flit_core.buildapi` | underscore in both, different submodule |
| `pdm-backend` | `pdm.backend` | **hyphen becomes a dot and the words swap** |

The `pdm-backend` row is the one that catches people. There is no rule connecting the two columns; the distribution name is what PyPI serves and the module name is what the package chose to define. Getting it wrong produces an `ImportError` from inside the isolated environment, which reads as though the package failed to install rather than as though you mistyped a path.

## Choosing one

> *"this tutorial uses Hatchling by default, but it will work identically with Setuptools, Flit, PDM, and others"*

> *"The build backend determines how your project will specify its configuration, including metadata and input files."*

The guide's advice on the block itself is deliberately unromantic:

> *"Usually, you'll just copy what your build backend's documentation suggests (after choosing your build backend)."*

| Backend | Reach for it when | What it costs |
|---|---|---|
| **hatchling** | pure Python, and you want sensible defaults with a `[tool.hatch.*]` escape hatch | one more `[tool.*]` dialect to learn if you go beyond defaults |
| **setuptools** | C extensions, an existing `setup.py`, or a build that must run code | the largest surface and the most legacy behaviour to know about |
| **flit-core** | a single module or small package where the source *is* the metadata | conventions rather than configuration — less control |
| **pdm-backend** | you are already using PDM's workflow | ties your build to that ecosystem's idioms |
| **maturin** | the extension is written in Rust | ⚠️ the current `requires` pin was not verified here — take it from maturin's own documentation |
| **uv-build** | you are already all-in on uv, which the packaging guide lists among the backends | a young backend; check that your consumers' tooling can build your sdist |

The honest summary: for a pure-Python library any of these produces an equivalent wheel, and the decision is about which configuration dialect you want to read in two years. The decision is *not* equivalent the moment you compile anything, at which point setuptools or maturin are the realistic options.

⚠️ The packaging guide names *"Hatchling, setuptools, Flit, PDM, and uv-build"* as the backends it shows examples for. maturin is real and widely used but was not among the blocks I verified — do not copy a `requires` pin for it from this page, because there is none.

## What to pin, and how tightly

`requires` is resolved fresh at every build, so it is a floating dependency on a tool that can change your artifact.

```toml
[build-system]
requires = ["hatchling"]                 # ⚠️ any version, forever, including majors not yet written
```

```toml
[build-system]
requires = ["hatchling >= 1.26"]         # ✅ a floor: the features you rely on exist
```

```toml
[build-system]
requires = ["flit_core >= 3.12.0, <5"]   # ✅ floor + major ceiling, as flit's own docs pin it
```

```toml
[build-system]
requires = ["hatchling == 1.26.3"]       # ⚠️ exact: reproducible, but you now own the upgrade cadence
```

A floor is the minimum defensible position, because a metadata feature you use has a version it appeared in — PEP 639's `license = "MIT"` needing `setuptools >= 77.0.3` is the current example, covered in **[08 · license and PEP 639](08-license-and-the-pep-639-migration.md)**. A ceiling on the major is defensible for a backend with a history of breaking changes. An exact pin belongs in a project that rebuilds regularly enough to notice it going stale.

## `backend-path` — an in-tree backend

> *"Projects can specify that their backend code is hosted in-tree by including the `backend-path` key in `pyproject.toml`. This key contains a list of directories, which the frontend will add to the start of `sys.path` when loading the backend, and running the backend hooks."*

```toml
[build-system]
requires = []
backend-path = ["build_support"]
build-backend = "local_backend"
```

This exists so a build system can bootstrap itself — a backend cannot list itself in `requires` and be installed from PyPI before its own first release — and for builds that genuinely need custom logic vendored in the repository. It is rare in application code and should stay rare: the directories are prepended to `sys.path`, so anything in them shadows installed packages for the whole build.

## What happens when the table is missing

Two different situations with two different outcomes.

**No `[build-system]` table at all, but the file exists:**

> *"If the file exists but is lacking the `[build-system]` table then the default values as specified above should be used."*

> *"Build tools are expected to use the example configuration file above as their default semantics when a `pyproject.toml` file is not present."*

**No `build-backend` key, whether or not `requires` is present:**

> *"If the `pyproject.toml` file is absent, or the `build-backend` key is missing, the source tree is not using this specification, and tools should revert to the legacy behaviour of running `setup.py` (either directly, or by implicitly invoking the `setuptools.build_meta:__legacy__` backend)."*

pip states its own concrete assumption:

> *"If a project does not have a `pyproject.toml` file containing a `build-system` section, and contains a `setup.py` it will be assumed to have the following backend settings: [build-system] requires = ["setuptools>=40.8.0"] build-backend = "setuptools.build_meta:__legacy__""*

Read together: `requires` without `build-backend` is a legitimate configuration meaning *"build isolation with these packages, then take the legacy setuptools route"*. And a project with neither the table nor a `setup.py` is not buildable at all.

## Gotchas

**★ Symptom: `ModuleNotFoundError: No module named 'pdm'` with `pdm-backend` correctly listed in `requires`.** Cause: the distribution installs as `pdm-backend` and the module is `pdm.backend` — the words swap and the hyphen becomes a dot. Fix: copy the pairing rather than deriving it.

```toml
[build-system]
requires = ["pdm-backend >= 2.4.0"]
build-backend = "pdm.backend"
```

**★ Symptom: a build that worked for a year suddenly fails after a backend release.** Cause: an unpinned `requires`, resolved fresh every time. Fix: a floor at minimum, and a major ceiling for a backend whose history warrants it.

```toml
[build-system]
requires = ["flit_core >= 3.12.0, <5"]
build-backend = "flit_core.buildapi"
```

**★ Symptom: your runtime dependency is in `requires` and the installed package cannot import it.** Cause: `requires` populates a temporary build environment that is discarded; nothing from it is installed with your package. Fix: `[project] dependencies` is the array that ships, and something needed at both times goes in both.

```toml
[build-system]
requires = ["setuptools >= 77.0.3", "numpy >= 2.0"]
build-backend = "setuptools.build_meta"

[project]
dependencies = ["numpy >= 2.0"]
```

**★ Symptom: `[build-system]` with only `build-backend` and no `requires` is rejected.** Cause: `requires` is *"mandatory for the table"*, and the spec says a table missing required fields *"should"* be an error. Fix: name the backend distribution in `requires` too — it will not be installed otherwise.

```toml
[build-system]
requires = ["hatchling >= 1.26"]
build-backend = "hatchling.build"
```

**★ Symptom: you add `[build-system]` to an old setuptools project and the build starts failing on missing imports.** Cause: you switched it from the ambient environment to an isolated one containing only `requires`. Fix: list every import your build performs — this is the moment the project's real build dependencies become visible for the first time.

**★ Symptom: `pip install .` says the directory does not look like a Python project.** Cause: no `[build-system]`, no `setup.py`, so there is no legacy path to fall back to either. Fix: the two tables that make a directory buildable.

```toml
[build-system]
requires = ["hatchling >= 1.26"]
build-backend = "hatchling.build"

[project]
name = "invoice-service"
version = "0.1.0"
```

**★ Symptom: `wheel` in `requires` and a warning or no effect.** Cause: PEP 518's original example included `wheel`, and modern backends declare what they need themselves via `get_requires_for_build_wheel`. The current spec's own example is just `requires = ["setuptools"]`. Fix: drop it unless your backend's documentation still asks for it.

**★ Symptom: a `backend-path` build imports the wrong package.** Cause: the listed directories go to the *start* of `sys.path`, so a file or directory in there sharing a name with an installed module wins for the whole build. Fix: a dedicated directory containing only the backend, named so it cannot collide.

**★ Symptom: your project builds with `pip` and fails with `build` or `uv`, or vice versa.** Cause: frontends differ in which optional hooks they call and in how much they tolerate — a backend missing `prepare_metadata_for_build_wheel` behaves differently under a frontend that wants it. Fix: raise the backend floor, and test the release path with the frontend your release actually uses rather than the one on your laptop.

**★ Symptom: a metadata key you added is silently ignored.** Cause: your backend predates the key. `[build-system] requires` is the version boundary for every `[project]` feature, and there is no error for "backend too old to understand this" — the key is simply not translated into metadata. Fix: raise the floor whenever you adopt a newer `[project]` feature, in the same commit.

**★ Symptom: builds are slow because the backend is downloaded on every run.** Cause: build isolation creates a fresh environment each time, and pip must fetch `requires` for it. Fix: this is the cost of isolation working correctly; address it with a build cache or a warm image in CI, not with `--no-build-isolation`, which changes what is built rather than how fast.

## Interview questions

**★ What is the difference between `[build-system] requires` and `[project] dependencies`?**
`requires` names what must be importable for the *build* to run, and it is installed into an isolated temporary environment that is thrown away once the wheel exists. `dependencies` names what must be installed alongside your package for the *installed code* to run, and it becomes `Requires-Dist` in the artifact's metadata. Nothing in `requires` reaches the user. The two overlap only when a package is genuinely needed at both times — building a C extension against `numpy` headers and then importing `numpy` at runtime — and in that case it must be listed twice, because neither array implies the other.

**★ Why does `build-backend = "pdm.backend"` go with `requires = ["pdm-backend"]`?**
Because they are names in two different namespaces. `requires` takes distribution names, which is what PyPI serves and what pip installs. `build-backend` takes an import path, which is what the package defines once installed. Nothing requires them to match, and `pdm-backend`/`pdm.backend` is the case where they visibly do not. The failure mode is an `ImportError` raised inside the isolated build environment, which is easily misread as "the package failed to install" — so the practical rule is to copy the pairing out of the backend's own documentation rather than deriving one from the other.

**★ What happens if you delete the whole `[build-system]` table?**
It depends on what else is in the directory. The specification says that when the table is missing, tools should use the documented default semantics; PEP 517 says that when `build-backend` is missing the tree *"is not using this specification"* and tools revert to running `setup.py`, either directly or through `setuptools.build_meta:__legacy__`. pip names its assumption: `setuptools>=40.8.0` with the legacy backend, *if* there is a `setup.py`. So a project with a `setup.py` still builds, through the legacy path; a project with neither does not build at all.

**★ Is it acceptable to have `requires` but no `build-backend`?**
Yes, and it is a meaningful configuration rather than an oversight: you get build isolation populated from your declared requirements, and then the legacy setuptools route, because the missing `build-backend` puts you in the case PEP 517 describes as not using the specification. It was the common shape for a while — projects adopted PEP 518's build-dependency declaration before adopting PEP 517's backend interface. There is no reason to write it deliberately today, but recognising it stops you assuming a project is misconfigured when it is merely half-migrated.

**★ How tightly should the backend be pinned?**
At minimum a floor, because every `[project]` feature has a backend version it started working in, and using a newer feature against an older backend produces either a validation error or silently dropped metadata. A ceiling on the major version is reasonable for a backend whose release history includes breaking changes — flit's own documented block writes `flit_core >= 3.12.0, <5`. An exact pin gives reproducibility at the cost of owning the upgrade, which is right for a project that builds often enough to notice the pin ageing and wrong for a library released twice a year, where an old exact pin quietly excludes bug fixes.

**★ When would you use `backend-path`?**
When the backend cannot come from an index. The canonical case is a build system bootstrapping itself: it cannot list its own distribution in `requires` before that distribution exists. The other legitimate case is a genuinely bespoke build step vendored into the repository, where writing and publishing a backend package would be more machinery than the problem deserves. The cost is that the listed directories are prepended to `sys.path` for the entire build, so a name collision there shadows a real package with no warning — which is why the directory should contain only the backend and be named unmistakably.

**★ Does the choice of backend affect the wheel a user installs?**
For a pure-Python project, essentially not — the tutorial states its example *"will work identically with Setuptools, Flit, PDM, and others."* What differs is upstream of that: which files are included by default, how `dynamic` fields are computed, what an editable install does, and which `[tool.*]` dialect you configure it all in. It stops being equivalent the moment compilation is involved, because only some backends know how to build extension modules at all, which is why the choice is a real decision for a compiled project and mostly a taste question for a pure one.

---

← Prev: [10 · Entry points and console scripts](10-entry-points-and-console-scripts.md) · [Topic index](README.md) · Next → [12 · The tool namespace](12-the-tool-namespace.md)
