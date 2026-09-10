---
title: "PEP 517 turned 'run setup.py' into a named Python object with four hooks, and that single indirection is what made hatchling, flit, pdm-backend and maturin possible without pip knowing any of them exist"
sidebar_label: "02 · The frontend/backend split"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-10 against PEP 517 — *A build-system independent format for source trees* ([peps.python.org](https://peps.python.org/pep-0517/)), PEP 660 — *Editable installs for pyproject.toml based builds* ([peps.python.org](https://peps.python.org/pep-0660/)), and pip's *Build System Interface* reference ([pip.pypa.io](https://pip.pypa.io/en/stable/reference/build-system/)).
> Target: **Python 3.14.7**. Documentation-validated — **no sandbox run, no program output**.

**`build-backend = "hatchling.build"` is not a name pip recognises. It is an import path pip evaluates, on a package pip installed a moment earlier into a throwaway environment, before calling a function on the result. That is the whole mechanism, and it is why the packaging ecosystem could add five competing build systems without a single change to pip. Once you can see the frontend/backend boundary, the confusing failures stop being confusing: build isolation, `--no-build-isolation`, "no module named setuptools" during someone else's build, and editable installs that quietly do nothing are all one side of the boundary failing to hold up its end.**

## Two roles, and which of your tools is which

PEP 517 splits the job in two:

- A **frontend** wants a wheel. It has a source tree and no idea how to build it. `pip`, `build`, `uv pip`, `uv build`, and your CI job are frontends.
- A **backend** knows how to build *this kind of project*. It is an ordinary Python package on PyPI. `setuptools.build_meta`, `hatchling.build`, `flit_core.buildapi`, `pdm.backend`, `maturin`, `uv_build` are backends.

The frontend never imports your project. It imports the *backend*, and hands it a directory.

> *"The `pyproject.toml` tells build frontend tools like pip and build which backend to use for your project."*
> — [packaging.python.org, packaging tutorial](https://packaging.python.org/en/latest/tutorials/packaging-projects/)

### Why this was necessary at all

PEP 517 lays out the three problems it is fixing, and the third is the structural one:

> *"While `distutils` / `setuptools` have taken us a long way, they suffer from three serious problems: (a) they're missing important features like usable build-time dependency declaration, autoconfiguration, and even basic ergonomic niceties like DRY-compliant version number management, and (b) extending them is difficult, so while there do exist various solutions to the above problems, they're often quirky, fragile, and expensive to maintain, and yet (c) it's very difficult to use anything else, because distutils/setuptools provide the standard interface for installing packages expected by both users and installation tools like `pip`."*

(a) and (b) are complaints about setuptools. (c) is a complaint about the *architecture*: there was no interface, so setuptools' CLI *was* the interface, so nothing could compete with it. PEP 517 defines the interface, and setuptools becomes one implementation of it.

## `build-backend` is an import statement in string form

The syntax is not decorative. PEP 517 spells out the lookup:

> *"`build-backend` is a string naming a Python object that will be used to perform the build... This is formatted following the same `module:object` syntax as a `setuptools` entry point."*

> *"if the string is `"flit.api:main"` as in the example above, this object would be looked up by executing the equivalent of: `import flit.api` then `backend = flit.api.main`"*

So `build-backend = "hatchling.build"` — no colon — means `import hatchling.build` and use the *module itself* as the backend object. `build-backend = "setuptools.build_meta:__legacy__"` means `import setuptools.build_meta` then `backend = setuptools.build_meta.__legacy__`.

```toml
[build-system]
requires = ["hatchling >= 1.26"]
build-backend = "hatchling.build"      # import hatchling.build; backend = that module
```

The practical consequence: **a typo in `build-backend` is an `ImportError`, not a "backend not found" message**, and the module name is not always the distribution name. You install `hatchling` and import `hatchling.build`; you install `flit_core` and import `flit_core.buildapi`; you install `pdm-backend` and import `pdm.backend`. Getting the pairing wrong is the single most common `[build-system]` mistake — see **[11 · Choosing a backend](11-build-system-and-choosing-a-backend.md)** for the verbatim pairs.

## The hooks the backend must and may provide

Two are mandatory:

```python
# pseudo-code — the interface a backend module implements
def build_wheel(wheel_directory, config_settings=None, metadata_directory=None):
    """Produce a .whl in wheel_directory; return its basename."""

def build_sdist(sdist_directory, config_settings=None):
    """Produce a .tar.gz in sdist_directory; return its basename."""
```

> *"Must build a .whl file, and place it in the specified `wheel_directory`. It must return the basename (not the full path) of the `.whl` file it creates, as a unicode string."*

> *"Must build a .tar.gz source distribution and place it in the specified `sdist_directory`."*

Two optional ones matter for real-world behaviour:

**`get_requires_for_build_wheel`** lets a backend add build dependencies it can only work out by looking at the tree:

> *"This hook MUST return an additional list of strings containing PEP 508 dependency specifications, above and beyond those specified in the `pyproject.toml` file, to be installed when calling the `build_wheel` or `prepare_metadata_for_build_wheel` hooks."*

This is how setuptools can pull in extra requirements without you listing them, and it is why the set of packages installed into a build environment is sometimes larger than your `requires` array.

**`prepare_metadata_for_build_wheel`** is the fast path a resolver wants — metadata without a full build:

> *"Must create a `.dist-info` directory containing wheel metadata inside the specified `metadata_directory`... This directory MUST be a valid `.dist-info` directory as defined in the wheel specification, except that it need not contain `RECORD` or signatures."*

A backend that does not implement it forces the frontend to build a whole wheel just to read your `dependencies` array. For a project with a C extension, that is the difference between a resolver step taking a moment and taking a compile.

### The editable-install hook, added later

PEP 660 added `build_editable` for the same reason: before it, `pip install -e .` had exactly one implementation.

> *"The only way to retain editable installs for these distributions was to provide a compatible setup.py develop implementation."*

It is optional — PEP 660 lists it among *"three optional hooks"* — and what it produces is a normal wheel:

> *"The .whl file must comply with the Wheel binary file format specification (PEP 427)."*

> *"Build backends may use different techniques to achieve the goals of an editable install. This section provides examples and is not normative."*

That last sentence is why `pip install -e .` behaves differently across backends: `.pth` files, import hooks and symlinked trees are all conforming implementations, and they differ in whether a *newly added* module is picked up without reinstalling.

## Build isolation — the part that surprises people

pip does not build in your environment. It builds in a fresh one:

> *"For building packages using this interface, pip uses an _isolated environment_. That is, pip will install build-time Python dependencies in a temporary directory which will be added to `sys.path` for the build commands."*
> — [pip, Build System Interface](https://pip.pypa.io/en/stable/reference/build-system/)

PEP 517 imposes matching obligations on the backend:

> *"All requirements specified by the project's build-requirements must be available for import from Python."*

> *"A build backend MUST be prepared to function in any environment which meets the above criteria. In particular, it MUST NOT assume that it has access to any packages except those that are present in the stdlib, or that are explicitly declared as build-requirements."*

And on the frontend, per hook:

> *"Frontends should call each hook in a fresh subprocess, so that backends are free to change process global state (such as environment variables or the working directory)."*

Read those three together and the model is complete: a subprocess, a `sys.path` containing the stdlib plus exactly your `requires`, and a backend forbidden from assuming anything else. **Whatever is installed in your virtualenv is irrelevant to the build.**

### Turning isolation off, and the bill that comes with it

```bash
# You are now the build environment manager.
pip install --no-build-isolation -e .
```

> *"This can be disabled using the `--no-build-isolation` flag -- users supplying this flag are responsible for ensuring the build environment is managed appropriately, including ensuring that all required build-time dependencies are installed, since pip does not manage build-time dependencies when this flag is passed."*

Legitimate reasons to use it: an air-gapped build with no index to install `requires` from; a package that must compile against the exact `numpy` already in the environment rather than the one the resolver would pick; a conda environment where the build tools are conda-managed. Illegitimate reason: your `requires` array is incomplete and this makes the error go away on your machine only.

## When the source tree is not PEP 517 at all

This is the fallback that keeps a decade of old projects installable:

> *"If the `pyproject.toml` file is absent, or the `build-backend` key is missing, the source tree is not using this specification, and tools should revert to the legacy behaviour of running `setup.py` (either directly, or by implicitly invoking the `setuptools.build_meta:__legacy__` backend)."*

pip states the concrete assumption it makes:

> *"If a project does not have a `pyproject.toml` file containing a `build-system` section, and contains a `setup.py` it will be assumed to have the following backend settings: [build-system] requires = ["setuptools>=40.8.0"] build-backend = "setuptools.build_meta:__legacy__""*

Two things follow. First, `requires` without `build-backend` is a real and defensible configuration — you get build isolation with your declared requirements *and* the legacy setuptools path. Second, `setuptools.build_meta:__legacy__` differs from `setuptools.build_meta` in that it is the backend used when no backend was declared; pip's documentation does not spell out a behavioural comparison between the two, so treat the difference as "which one the tool picked for you" rather than a documented feature set.

## Reading a build failure through the boundary

| The message you see | Which side failed | What to change |
|---|---|---|
| an import failure naming the backend module itself | frontend could not load the backend | the `requires`/`build-backend` pairing |
| `No module named 'numpy'` during someone else's install | backend ran without a declared build dep | add it to *their* `requires`, or `--no-build-isolation` locally |
| a compiler or linker error, or a complaint that no C toolchain was found | backend ran, build tools missing | a wheel, not a config change |
| the frontend says the directory is not a Python project | no `pyproject.toml`, no `setup.py` | add `[build-system]` + `[project]` |
| Metadata generation failed but wheel build succeeds elsewhere | `prepare_metadata_for_build_wheel` path | usually a backend version too old for the file |

## Gotchas

**★ Symptom: your build works locally and fails in CI with an import error inside the backend.** Cause: your local environment happens to have the missing package installed, and until you added `[build-system]` pip was building in that environment. With isolation on, the build environment contains the stdlib plus `requires` only — PEP 517 is explicit that a backend *"MUST NOT assume that it has access to any packages except those that are present in the stdlib, or that are explicitly declared as build-requirements."* Fix: declare it.

```toml
[build-system]
requires = ["setuptools >= 77.0.3", "Cython >= 3.0", "numpy >= 1.26"]
build-backend = "setuptools.build_meta"
```

**★ Symptom: `ModuleNotFoundError: No module named 'hatchling'` even though `hatchling` is in your virtualenv.** Cause: the backend is loaded from the *isolated* environment, not yours, and `requires` is what populates it. Having it in your venv is irrelevant. Fix: put it in `requires`, where the frontend will look.

```toml
[build-system]
requires = ["hatchling >= 1.26"]
build-backend = "hatchling.build"
```

**★ Symptom: an unpinned `requires` array breaks a build months later with no change to your code.** Cause: `requires` is resolved fresh at build time, so a new major of your backend can change behaviour under you. Fix: put a floor *and* a ceiling on the backend, as flit's own documented block does:

```toml
[build-system]
requires = ["flit_core >= 3.12.0, <5"]
build-backend = "flit_core.buildapi"
```

**★ Symptom: `pip install -e .` succeeds, then a module you just created cannot be imported.** Cause: PEP 660 says the editable mechanism is *"not normative"* — a backend may map only the packages that existed at install time, so a *new* top-level module or package is outside the mapping. Fix: reinstall after adding a new package, or use a backend/mode that maps the directory rather than the file list. Either way, `-e` is not a live filesystem view by specification.

**★ Symptom: a `backend-path` project fails with a confusing import from the wrong package.** Cause: `backend-path` prepends directories to `sys.path` — *"which the frontend will add to the start of `sys.path` when loading the backend"* — so a local directory named like an installed package shadows it for the whole build. Fix: keep the in-tree backend in a dedicated directory whose contents cannot collide.

```toml
[build-system]
requires = []
backend-path = ["build_support"]
build-backend = "local_backend"
```

**★ Symptom: `--no-build-isolation` fixes your machine and breaks every other machine.** Cause: it does not fix the project, it stops pip from checking. Your environment supplies the undeclared dependency; a clean checkout has nothing to supply it. Fix: use the flag to *diagnose* what is missing, then move that name into `requires` and remove the flag.

**★ Symptom: resolving your package is slow, and the resolver appears to compile it.** Cause: the backend does not implement `prepare_metadata_for_build_wheel`, so the only way to get a `.dist-info` is to run `build_wheel`. Fix: publish wheels so no build happens at all, and prefer a backend that implements the metadata hook for source builds. This is a backend-selection decision, not something you can configure away in your own file.

**★ Symptom: a build behaves differently depending on the order of hooks the frontend calls.** Cause: PEP 517 only says frontends *should* call each hook in a fresh subprocess — so a backend that mutates `os.environ` or `os.chdir()` and a frontend that reuses a process can interact. Fix: never write a backend hook or a `setup.py` that depends on state left by a previous hook; treat each invocation as cold.

## Interview questions

**★ Walk me through what `pip install .` actually does with `pyproject.toml`.**
It reads the file, finds `[build-system]`, and creates an isolated temporary environment into which it installs everything in `requires`. It then loads the object named by `build-backend` by importing the module and, if there is a colon, taking the named attribute. It may call `get_requires_for_build_wheel` and install whatever additional specifiers that returns. It calls `build_wheel`, receives the basename of a `.whl` file, and installs that wheel. Your project's own code is never imported by pip; it is only read by the backend. If `[build-system]` is absent and there is a `setup.py`, pip assumes `setuptools>=40.8.0` with `setuptools.build_meta:__legacy__` and takes the legacy route.

**★ Why is `build-backend` a `module:object` string rather than a name pip looks up in a registry?**
Because a registry would mean pip has to know about every backend, which is exactly the coupling PEP 517 exists to remove. An import path needs no registry: pip installs whatever `requires` names, imports the path, and calls documented functions on the result. New backends therefore ship as ordinary PyPI packages with no coordination. The cost is that the pairing between the distribution in `requires` and the module in `build-backend` is unchecked — `pdm-backend` provides `pdm.backend`, and nothing catches a mismatch until the import fails.

**★ What breaks if a backend assumes a package is installed without declaring it in `requires`?**
It builds correctly for anyone whose environment happens to contain that package and fails for everyone else, and the failure surfaces during *their* `pip install`, attributed to your project. PEP 517 forbids the assumption in exactly these words: a backend *"MUST NOT assume that it has access to any packages except those that are present in the stdlib, or that are explicitly declared as build-requirements."* The reason it is a MUST rather than a SHOULD is that the frontend has no way to discover the omission — the isolated environment is built solely from `requires`.

**★ When is `--no-build-isolation` the right answer rather than a workaround?**
When the build must link against a specific already-installed artifact, and letting the resolver choose a fresh one would produce a broken binary — compiling a C extension against the exact `numpy` ABI present in the target environment is the standard case. Also when there is no index to install from, as in an offline or vendored build. In both, you have accepted pip's stated condition that you are *"responsible for ensuring the build environment is managed appropriately."* It is the wrong answer whenever the honest description is "my `requires` list is incomplete".

**★ Why did editable installs need their own PEP?**
Because `setup.py develop` was setuptools-specific, and the PEP 517 interface had no way to express "install this such that source edits take effect". PEP 660 adds `build_editable`, and deliberately leaves the *mechanism* unspecified — it states the techniques section *"is not normative"*. That freedom is why editable behaviour is not portable: whether a newly created module is importable without reinstalling depends on whether your backend mapped a directory or a list of files, and no specification requires either.

**★ What is `backend-path` for, and what is the risk?**
It declares that the backend code lives inside the project tree rather than being installed from an index: *"This key contains a list of directories, which the frontend will add to the start of `sys.path` when loading the backend."* It is how a build system bootstraps itself — a backend cannot list itself in `requires` and be installed from PyPI on its first release. The risk is the same as any `sys.path` prepend: the listed directories shadow installed packages for the duration of the build, so a directory or module in there that shares a name with something real silently wins.

**★ If both `build_wheel` and `build_sdist` are mandatory, why do some projects publish only wheels?**
Because "mandatory" applies to the *backend implementing the hook*, not to the maintainer invoking it. A backend must be able to produce an sdist; a release process is free never to ask for one. Publishing wheels only means anyone on an unsupported platform cannot build from source at all, which is a policy choice, not a specification violation.

---

← Prev: [01 · The catch-22](01-the-catch-22-that-killed-setup-py.md) · [Topic index](README.md) · Next → [03 · name and normalization](03-the-project-name-and-normalization.md)
