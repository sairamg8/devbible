---
title: "setup.py is not deprecated, it is demoted — it stopped being the interface and became one backend's input file, which leaves exactly three situations where writing one is still correct and a much longer list where it is not"
sidebar_label: "14 · What still needs setup.py"
sidebar_position: 14
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-10 against setuptools' *Configuring setuptools using pyproject.toml* ([setuptools.pypa.io](https://setuptools.pypa.io/en/latest/userguide/pyproject_config.html)), PEP 517 ([peps.python.org](https://peps.python.org/pep-0517/)), PEP 660 ([peps.python.org](https://peps.python.org/pep-0660/)), pip's *Build System Interface* ([pip.pypa.io](https://pip.pypa.io/en/stable/reference/build-system/)), and the PyPA *pyproject.toml specification* ([packaging.python.org](https://packaging.python.org/en/latest/specifications/pyproject-toml/)).
> Target: **Python 3.14.7**. Documentation-validated — **no sandbox run, no program output**.

**The useful framing is not "is `setup.py` dead" but "what is it now". It used to be the interface: every frontend's only way to interact with a project was to invoke it. Since PEP 517 the interface is a backend object, and `setup.py` is one particular backend's configuration file — one that happens to be written in Python, which is exactly what makes it still necessary for the small set of jobs that cannot be expressed as data. Everything else that used to require it has a declarative replacement, and the honest way to close this topic is to name both lists.**

## What setuptools actually says

The one sentence I could verify on the subject is narrower than the folklore in either direction:

> *"If compatibility with legacy builds or versions of tools that don't support certain packaging standards (e.g. PEP 517 or PEP 660), a simple `setup.py` script can be added to your project (while keeping the configuration in `pyproject.toml`)"*
> — [setuptools, Configuring setuptools using pyproject.toml](https://setuptools.pypa.io/en/latest/userguide/pyproject_config.html)

⚠️ Note what that page does **not** say. I could not find a sentence in it declaring `setup.py` obsolete or optional in general terms, nor a warning against running `python setup.py`. Statements of that kind are widespread in the community and I am not attributing them to a primary source here.

## The three jobs that still need Python

### 1 · Compiled extension modules

An `Extension` describes source files, include directories, macros, compiler and linker flags. Some of those values can only be discovered by asking another installed package where its headers are — which is a function call, not a literal:

```python
# setup.py — configuration that must run code
from setuptools import Extension, setup
import numpy

setup(
    ext_modules=[
        Extension(
            name="invoice_service._fastsum",
            sources=["src/invoice_service/_fastsum.c"],
            include_dirs=[numpy.get_include()],
            define_macros=[("NPY_NO_DEPRECATED_API", "NPY_1_7_API_VERSION")],
        )
    ]
)
```

```toml
[build-system]
requires = ["setuptools >= 77.0.3", "numpy >= 2.0"]
build-backend = "setuptools.build_meta"

[project]
name = "invoice-service"
version = "0.4.2"
requires-python = ">=3.12"
```

Note the division of labour: **all metadata is in `pyproject.toml`; `setup.py` contains only the part that must execute.** `numpy` is in `requires` because the build imports it — build isolation gives the build environment nothing but `requires`, as **[02 · The frontend/backend split](02-pep-517-the-frontend-backend-split.md)** covers.

⚠️ `numpy.get_include()` is a documented numpy call, cited here as the standard idiom rather than as something I verified against numpy's documentation in this pass.

### 2 · A custom build step

Generating a parser, compiling translations, embedding a build identifier, downloading a schema — anything that has to happen between "sources exist" and "wheel exists" and is not a compiler invocation. Under setuptools that is a subclassed command:

```python
# setup.py
from setuptools import setup
from setuptools.command.build_py import build_py


class BuildWithGeneratedParser(build_py):
    def run(self):
        from invoice_build import generate_parser      # a module in your own repo

        generate_parser(out_dir="src/invoice_service/_generated")
        super().run()


setup(cmdclass={"build_py": BuildWithGeneratedParser})
```

This is genuinely a program, and no amount of TOML will express it. The alternative worth knowing is that you can write your own PEP 517 backend in-tree with `backend-path` and skip setuptools entirely — more work up front, and a cleaner boundary afterwards.

### 3 · Compatibility with a tool that predates the standards

The case setuptools' own documentation names. If something in your pipeline cannot drive a PEP 517 backend or does not implement PEP 660, a minimal shim keeps it working while the real configuration stays declarative:

```python
# setup.py — a shim, not a configuration file
from setuptools import setup

setup()
```

Every argument comes from `pyproject.toml`; the file exists purely so that a legacy caller has something to call.

## What no longer needs it

| Used to need `setup.py` | Declarative replacement | Where |
|---|---|---|
| `name`, `version`, `author`, `description` | `[project]` keys | **[03](03-the-project-name-and-normalization.md)**, **[04](04-version-and-requires-python.md)**, **[09](09-authors-classifiers-and-urls.md)** |
| `install_requires` | `[project] dependencies` | **[06](06-dependencies-and-markers.md)** |
| `extras_require` | `[project.optional-dependencies]` | **[07](07-extras-and-dependency-groups.md)** |
| `tests_require` | `[dependency-groups]` | **[07](07-extras-and-dependency-groups.md)** |
| `entry_points={"console_scripts": [...]}` | `[project.scripts]` | **[10](10-entry-points-and-console-scripts.md)** |
| `python_requires` | `[project] requires-python` | **[04](04-version-and-requires-python.md)** |
| `long_description` + `_content_type` | `[project] readme` | **[05](05-description-and-readme.md)** |
| `license` + classifiers | `[project] license` SPDX expression | **[08](08-license-and-the-pep-639-migration.md)** |
| `packages=find_packages()` | `[tool.setuptools.packages.find]` | **[12](12-the-tool-namespace.md)** |
| `setup_requires` | `[build-system] requires` | **[11](11-build-system-and-choosing-a-backend.md)** |
| a version read from a module | `dynamic` + a backend table | **[13](13-dynamic-metadata.md)** |
| `python setup.py develop` | `pip install -e .` via PEP 660 | this page |

If your `setup.py` contains only things in the left column, it can be deleted. That is the majority of `setup.py` files in existence.

## `setup.py develop` and what replaced it

PEP 660 exists because editable installs had exactly one implementation:

> *"The only way to retain editable installs for these distributions was to provide a compatible setup.py develop implementation."*

The replacement is a hook, and it is optional for backends — PEP 660 lists `build_editable` among *"three optional hooks"*. What it produces is an ordinary wheel:

> *"The .whl file must comply with the Wheel binary file format specification (PEP 427)."*

with the mechanism deliberately unconstrained:

> *"Build backends may use different techniques to achieve the goals of an editable install. This section provides examples and is not normative."*

That non-normativity is the reason editable installs are not portable in their *behaviour*: whether a newly created module becomes importable without reinstalling depends on whether your backend mapped a directory or a file list, and no specification requires either. It also explains why a project targeting an old tool might still ship a `setup.py` — a frontend that cannot call `build_editable` can still call `setup.py develop`.

## The legacy path, precisely

The fallback that keeps a decade of projects installable:

> *"If the `pyproject.toml` file is absent, or the `build-backend` key is missing, the source tree is not using this specification, and tools should revert to the legacy behaviour of running `setup.py` (either directly, or by implicitly invoking the `setuptools.build_meta:__legacy__` backend)."*

and pip's concrete assumption:

> *"If a project does not have a `pyproject.toml` file containing a `build-system` section, and contains a `setup.py` it will be assumed to have the following backend settings: [build-system] requires = ["setuptools>=40.8.0"] build-backend = "setuptools.build_meta:__legacy__""*

Two readings worth holding onto. A `setup.py`-only project is not broken — it takes a documented path with an implied backend. And that path is *worse than declaring the same thing*, because the implied `requires` is a floor from an old setuptools rather than the version your build actually needs.

## Migrating: what to check

1. **Move every metadata keyword into `[project]`.** Use the table above; anything with a declarative home has one.
2. **Add `[build-system]` with a real floor.** `setuptools >= 77.0.3` if you use the PEP 639 `license` string.
3. **Declare every import your build performs in `requires`.** Isolation means the build environment has nothing else. This is the step that surfaces build dependencies nobody had written down.
4. **Configure discovery under `[tool.setuptools]`.** `[project]` says nothing about where your code lives.
5. **Delete `setup.py`, or reduce it to what must execute.** If nothing must, delete it.
6. **Build an sdist, then build a wheel *from that sdist*.** It catches a missing readme, a version source that needs `.git`, and files the backend did not include.

## Gotchas

**★ Symptom: after migrating, the wheel installs and the package is empty.** Cause: you moved the metadata but not the discovery — `packages=find_packages(where="src")` had no `[project]` equivalent because discovery is backend configuration. Fix:

```toml
[tool.setuptools.packages.find]
where = ["src"]
```

**★ Symptom: `setup.py` and `pyproject.toml` both declare a version and they disagree.** Cause: a half-finished migration where `setup(version=...)` was left in place. Which value wins depends on the backend, so the project has two answers. Fix: `[project]` is authoritative; `setup()` takes no arguments in a migrated project.

```python
from setuptools import setup

setup()
```

**★ Symptom: `python setup.py sdist bdist_wheel` behaves differently from `python -m build`.** Cause: they are different paths — the first invokes setuptools' command machinery directly with no build isolation, the second drives the PEP 517 interface with an isolated environment built from `requires`. Fix: use the frontend for anything you publish, so that what you test is the path your users take.

```bash
python -m build          # sdist + wheel, through the declared backend
```

**★ Symptom: your build works with `pip install .` and fails in a clean container.** Cause: an import in `setup.py` that is satisfied by your environment and absent from `requires`. Fix: declare it — the isolated environment contains the stdlib plus `requires` and nothing else.

```toml
[build-system]
requires = ["setuptools >= 77.0.3", "Cython >= 3.0"]
build-backend = "setuptools.build_meta"
```

**★ Symptom: `pip install -e .` fails on a project that has no `setup.py`.** Cause: the frontend or backend is too old for PEP 660, so the only editable mechanism it knows is `setup.py develop`. Fix: upgrade the toolchain first; if you genuinely cannot, this is exactly the case setuptools documents a shim for.

```python
from setuptools import setup

setup()
```

**★ Symptom: an editable install stops reflecting your edits after you add a new subpackage.** Cause: the editable mechanism is *"not normative"*, so a backend may have mapped the packages that existed at install time. Fix: reinstall after adding a top-level package; do not treat `-e` as a live filesystem view.

**★ Symptom: your C extension builds on your machine and fails for users with a compiler error.** Cause: you are shipping only an sdist, so every user compiles. Fix: build wheels per platform in CI. There is no `pyproject.toml` setting for this — it is a release-pipeline problem, and it belongs to **07 · Wheels vs sdists** *(not written yet)*.

**★ Symptom: you deleted `setup.py`, and a downstream consumer's pipeline broke.** Cause: something in their toolchain drives `setup.py` directly rather than a PEP 517 frontend. Fix: the shim is the compatibility layer setuptools names for exactly this, and it costs two lines while the real configuration stays declarative.

**★ Symptom: `setup.py` reads its own version by importing the package, and the build fails.** Cause: importing your package at build time requires your runtime dependencies, which are not in the isolated build environment. Fix: never import the package to get its version. Read the file, or use a `dynamic` mechanism against a leaf module with no imports — see **[13 · Dynamic metadata](13-dynamic-metadata.md)**.

**★ Symptom: a `setup.py`-only project resolves an ancient setuptools.** Cause: the implied legacy configuration pins `setuptools>=40.8.0`, which is a floor, not your requirement — so the resolver is free to pick something far older than what you tested. Fix: declare `[build-system]` even if you keep `setup.py`; `requires` without `build-backend` is a valid halfway house that at least fixes the floor.

**★ Symptom: your migration passed locally and the published sdist cannot be built.** Cause: files the old `MANIFEST.in` included are not included by the new configuration — the readme, a header file, a data file. Nothing warns you, because building from a checkout finds them on disk. Fix: build the sdist, then build the wheel from the sdist, in CI.

## Interview questions

**★ Is `setup.py` deprecated?**
Not as a file, and the more precise statement is that it was *demoted*. Before PEP 517 it was the interface — the only way a frontend could interact with a project was to run it. Now the interface is a backend object named in `[build-system]`, and `setup.py` is one backend's input file that happens to be executable. What has genuinely fallen out of favour is invoking it directly as a command; setuptools' own documentation still describes adding *"a simple `setup.py` script … (while keeping the configuration in `pyproject.toml`)"* for compatibility, which tells you the file has a supported role and that role is not "hold your metadata".

**★ Name a case where you cannot avoid Python in the build.**
A C extension whose include path comes from another installed package. `include_dirs=[numpy.get_include()]` is a function call whose result depends on where numpy was installed in this particular build environment, and there is no TOML expression for it. The same applies to a generated parser, compiled translations, or an embedded build identifier — anything that must *happen* between sources existing and a wheel existing. The right shape is to keep every piece of metadata in `pyproject.toml` and let `setup.py` contain only the executable part, so the declarative surface stays readable.

**★ What replaced `python setup.py develop`, and why is the replacement's behaviour inconsistent?**
PEP 660's `build_editable` hook, invoked by `pip install -e .`. It is inconsistent because the PEP deliberately does not specify the mechanism — it says backends *"may use different techniques"* and that its examples are *"not normative"*. So one backend may install a `.pth` file pointing at your source directory, another a finder that maps specific packages, another something else. All conform. The practical consequence is that whether a newly created top-level module is importable without reinstalling depends on your backend, and no standard entitles you to either behaviour.

**★ A project has a `setup.py` and no `pyproject.toml`. What does `pip install .` do?**
It takes the legacy path. PEP 517 says a tree with no `pyproject.toml` or no `build-backend` key *"is not using this specification"* and tools should revert to running `setup.py`, directly or through `setuptools.build_meta:__legacy__`; pip documents assuming `setuptools>=40.8.0` with that legacy backend. So it works, but with an implied build requirement that is a very old floor rather than the setuptools version the project was actually tested against — which is why adding `[build-system]` is worth doing even for a project you have no intention of otherwise modernising.

**★ How do you decide whether a `setup.py` can be deleted?**
Read it and ask, for each thing it does, whether there is a declarative home. Metadata keywords, `install_requires`, `extras_require`, `entry_points`, `python_requires`, `long_description`, `packages=find_packages()` and `setup_requires` all have one — in `[project]`, `[dependency-groups]`, `[build-system]` or `[tool.setuptools]`. If everything maps, delete the file. If something must execute — an `Extension`, a `cmdclass`, a generated artifact — keep the file but strip it to exactly that, with `setup()` receiving no metadata. The residue is usually either nothing or five lines.

**★ Why does declaring `[build-system]` sometimes break a build that previously worked?**
Because it switches the build from your ambient environment to an isolated one containing the stdlib plus `requires`. Every import your `setup.py` performed that was satisfied by something happening to be installed now fails. That is the feature working: it makes the project's real build dependencies explicit for the first time, and PEP 517 requires a backend not to assume access to *"any packages except those that are present in the stdlib, or that are explicitly declared as build-requirements."* The correct response is to add the names to `requires`, not to pass `--no-build-isolation`.

**★ If you must run custom logic at build time, is `setup.py` the only option?**
No. You can write a PEP 517 backend in your own repository and point at it with `backend-path`, which the spec supports precisely so that backend code can be *"hosted in-tree"*. That gives you a clean interface — implement `build_wheel` and `build_sdist`, delegate the ordinary parts to another backend — instead of subclassing setuptools commands whose contracts are largely undocumented. It is more work up front, so `setup.py` with a `cmdclass` remains the pragmatic choice for a small step; the in-tree backend earns its cost when the custom logic is substantial or when you want it testable.

---

← Prev: [13 · Dynamic metadata](13-dynamic-metadata.md) · [Topic index](README.md) · Next → **02 · uv** *(not written yet)*
