---
title: "venv, virtualenv and conda solve three different problems, and the only one that manages non-Python binaries is conda"
sidebar_label: "10 · venv, virtualenv, conda"
sidebar_position: 10
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-28 against the Python 3.14
> [`venv` docs](https://docs.python.org/3.14/library/venv.html),
> [PEP 405](https://peps.python.org/pep-0405/),
> [virtualenv's own comparison with the stdlib module](https://virtualenv.pypa.io/en/latest/explanation.html),
> the [conda user guide on environments](https://docs.conda.io/projects/conda/en/stable/user-guide/concepts/environments.html),
> and the [uv documentation](https://docs.astral.sh/uv/pip/environments/).
> Version spine: **Python 3.14.7**.

**Three tools, three different scopes. `venv` isolates Python packages for one
interpreter you already have. `virtualenv` does the same thing faster and for
interpreters other than the one it is running under. `conda` is a different
species: it installs the interpreter itself, and compiled non-Python software
alongside it, from its own package universe. Choosing between them is not a
matter of taste — it is a question about what you need isolated, and the answer is
usually "just the Python packages", which is why the standard library's answer is
right most of the time.**

## `venv` — the standard library

The floor, and the thing every other tool is compatible with. PEP 405's model:
one directory, `pyvenv.cfg`, a shared standard library, an isolated
`site-packages`.

- **Always present** in any Python 3.3+ that has not been dismembered by a distro
  packager.
- **Only the version it runs under.** No fetching, no selection.
- **Bootstraps pip through `ensurepip`**, which is the slow part.
- **No plugin system**, a minimal `EnvBuilder` API.

Choose it when: you have the interpreter, you want no extra tooling, or you are
writing instructions that must work on a machine you do not control. Every
Dockerfile and CI config in the world can run `python -m venv`.

## `virtualenv` — the third-party original

virtualenv predates `venv` (which was derived from it) and is still actively
developed. Its documentation makes the comparison itself; these are **its own
claims** about the difference:

> Performance: virtualenv is *"Fast; caches pre-built install images, subsequent
> creation < 1 second"*; venv is *"Slowest (60s+); spawns pip as a subprocess to
> seed."*
>
> Extensibility: a *"Plugin system for discovery, creation, seeding, and
> activation"* versus *"No plugin system."*
>
> Cross-version support: *"Any installed Python via auto-discovery (registry,
> uv-managed, PATH)"* versus *"Only the Python version it runs under."*
>
> Upgradeability: *"Independent via PyPI"* versus *"Tied to Python releases."*
>
> Programmatic API: *"Full Python API; can describe environments without creating
> them"* versus a *"Basic `create()` function."*

The 60-second figure is a worst case (cold cache, slow network) rather than a
typical one, but the direction is not in dispute: seeding via `ensurepip` is what
makes `python -m venv` slow, and caching is what makes the alternatives fast.

Choose it when: you create environments constantly (a test matrix, `tox`, a build
farm), you need to create an environment for an interpreter other than the one
running the tool, or you are building tooling on top and want the API and plugin
hooks. `tox` and several other tools depend on it directly.

## `conda` — a different kind of environment

The conda user guide's definition is deliberately broader than PEP 405's:

> *"An environment is a directory that contains a specific collection of packages
> that you have installed."*

Note what is absent from that sentence: any mention of Python. A conda
environment contains its own Python interpreter as one package among many, and
can equally contain compiled libraries, command-line tools, R, or a CUDA
toolchain. Its documentation is explicit that it manages non-Python dependencies
and tracks binary dependencies explicitly — the interpreter is *"independent from
system"* rather than shared with a base installation the way a venv's is.

That is the whole trade:

| | `venv` / `virtualenv` | `conda` |
|---|---|---|
| Interpreter | shared with a base installation you installed separately | installed *into* the environment as a package |
| Package source | PyPI (wheels and sdists) | conda channels (`conda-forge`, defaults, private) |
| Non-Python binaries | not managed; wheels bundle what they can | managed as first-class packages |
| Compiler / toolchain | your system's | can be provided by the environment |
| Environment file | `requirements.txt` / `pyproject.toml` | `environment.yml` |
| Interoperability | universal; everything understands a venv | its own universe, with pip as an escape hatch |

Choose conda when the hard part of your dependency problem is **not Python**: a
scientific stack pinned to specific BLAS/MPI/CUDA builds, geospatial libraries
(GDAL, PROJ) that are painful to build, bioinformatics pipelines that mix Python
with compiled tools and R. Avoid it when your dependencies are pure PyPI —
you gain nothing and take on a second package manager.

Practical notes if you do use it: `conda-forge` is the community channel most
projects standardise on, the Anaconda-hosted default channels have their own
commercial licensing terms that you should check for your organisation, and
`mamba`, `micromamba` and `pixi` are faster front-ends to the same package model.
`conda activate` is not the same script as a venv's `activate` and the two do not
compose cleanly.

## The project managers

`poetry`, `pdm`, `hatch`, `pipenv` and `uv` are not a fourth kind of environment
— they all create ordinary virtual environments and then manage dependency
resolution, locking and script running on top. What differs is where they put the
environment and how much they hide it:

- **`uv`** — `.venv` in the project, `uv run` syncs before executing.
  [Chunk 7](07-uv-venv-and-uv-run.md).
- **`hatch`** — named environments per project, with a matrix for multi-version
  testing.
- **`poetry` / `pdm`** — a cached environment by default, configurable to
  in-project.
- **`pipenv`** — a cached environment keyed by project path, with `Pipfile.lock`.

The relevant fact for this topic is that all of them produce a directory you can
inspect with everything you have learned here, and all of them are subject to the
same non-relocatability and base-interpreter dependencies.

## Gotchas

**Symptom:** `pip install` inside a conda environment produces a package conda does not know about, and a later `conda install` overwrites or conflicts with it
**Cause:** two package managers with two separate records of what is installed, writing to the same `site-packages`
**Fix:** install with conda where a conda package exists, use pip only for what conda does not have, do it *after* the conda installs, and record both in `environment.yml` (which has a `pip:` section for exactly this)

**Symptom:** a venv created on top of an activated conda environment behaves unpredictably
**Cause:** the venv's base is the conda environment's interpreter, so it inherits conda's runtime library layout while adding another prefix on top
**Fix:** pick one model per project. If you need conda for binary dependencies, use conda environments; do not stack a venv on one

**Symptom:** `tox` or a build tool fails because `virtualenv` is missing, on a machine where `python -m venv` works fine
**Cause:** those tools depend on virtualenv's API and its ability to create environments for interpreters other than the one running
**Fix:** install virtualenv as a tool (`uv tool install tox`, `pipx install tox`), not into the project environment

**Symptom:** a `requirements.txt` exported from a conda environment does not install anywhere else
**Cause:** conda package names and versions are not PyPI names and versions, and some have no PyPI equivalent at all
**Fix:** export `environment.yml` for conda consumers. If you need to leave conda, re-resolve the dependencies against PyPI rather than translating names

**Symptom:** environment creation dominates CI time
**Cause:** `python -m venv` seeding pip through `ensurepip` on every job, with no cache
**Fix:** cache the package downloads and built wheels, or switch creation to `uv venv` or `virtualenv`, both of which are built around caching. [Chunk 11](11-editors-ci-and-docker.md) covers what is safe to cache

**Symptom:** documentation for a project says "create a virtualenv" and a reader runs `python -m venv`, then hits a flag that does not exist
**Cause:** "virtualenv" is used colloquially for the concept and specifically for the tool, and their command-line interfaces differ
**Fix:** read it as the concept unless a virtualenv-only flag appears. When writing instructions, name the exact command

**Symptom:** an environment manager's cached environment is on a different disk or gets cleaned by the OS, and a project stops working
**Cause:** poetry- and pipenv-style caches live outside the project, keyed by path — rename the project directory and the key changes
**Fix:** configure in-project environments if that suits you better, and in any case ensure the lockfile is committed so recreation is a single command

## Interview questions

**★ What is the difference between `venv` and `virtualenv`?**
`venv` is the standard library module, derived from virtualenv, and it can only
create environments for the interpreter that runs it. `virtualenv` is a
third-party package that ships independently of Python releases, discovers other
installed interpreters and creates environments for them, caches its seed
packages so creation is much faster, and exposes a plugin system and a full API
that tools like `tox` build on. The environments they produce are compatible.

**★ How is a conda environment fundamentally different from a venv?**
A venv shares its standard library with a base installation and isolates only
Python packages installed from PyPI. A conda environment contains its own Python
interpreter as a package and can contain arbitrary compiled software — C
libraries, CLI tools, R, CUDA components — from conda channels. Conda is a
general-purpose package manager that happens to be popular for Python; venv is a
redirection layer for one interpreter's `site-packages`.

**★ When is conda the right choice?**
When the difficult part of the dependency problem is not Python: pinned numeric
libraries with specific BLAS or MPI builds, geospatial or bioinformatics stacks
with heavy compiled dependencies, GPU toolchains, or pipelines mixing Python with
non-Python tools. For a web service whose dependencies are all on PyPI, conda
adds a second package manager and buys nothing.

**★ Why is mixing pip and conda in one environment risky?**
Because each maintains its own record of what is installed and neither consults
the other. pip can overwrite files conda placed and conda can later replace files
pip wrote, and neither's dependency solver accounts for the other's work. The
containment strategy is to install everything possible with conda first, use pip
only afterwards and only for what conda lacks, and record the pip requirements
inside `environment.yml`.

**★ Do poetry, pdm, hatch and uv replace virtual environments?**
No — they create and manage them. Underneath each is an ordinary virtual
environment with a `pyvenv.cfg`, subject to the same rules about relocation,
absolute shebangs and dependence on the base interpreter. What they add is
dependency resolution, lockfiles and a command runner so you never have to
activate anything.

---

← Prev: [Where the venv lives](09-where-the-venv-lives.md) · Index: [Virtual environments](README.md) · Next → [Editors, CI and Docker](11-editors-ci-and-docker.md)
