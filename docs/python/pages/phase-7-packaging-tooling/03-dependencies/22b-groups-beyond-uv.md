---
title: "A dependency group has no install syntax of its own and never implies the project, so outside uv you install it with pip's --group plus the project, or export it from the lock — and a repository with no package at all can be nothing but groups"
sidebar_label: "22b · Groups beyond uv"
sidebar_position: 27
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-10 against **PEP 735** ([peps.python.org](https://peps.python.org/pep-0735/)), the
> PyPA **Dependency groups** specification
> ([packaging.python.org](https://packaging.python.org/en/latest/specifications/dependency-groups/)), pip's
> **pip install** reference ([pip.pypa.io](https://pip.pypa.io/en/stable/cli/pip_install/), pip docs
> v26.2.1) and uv's **CLI reference** for `uv export`
> ([docs.astral.sh](https://docs.astral.sh/uv/reference/cli/), **uv 0.12.12**). Target: **Python 3.14.7**.
> Documentation-verified, **no sandbox run**.

**The specification deliberately gives groups no install syntax — *"There is no syntax or
specification-defined interface for installing or referring to dependency groups. Tools are expected to
provide dedicated interfaces for this purpose."* — so every tool that installs one does it its own way, and
two facts carry across all of them. A group is only its list: it never brings the project, its
dependencies or its extras. And a tool that predates groups can still consume one, as a requirements file
generated from the lock. The same design makes groups the natural shape for a repository that is not a
package at all.**

## Outside uv: pip, and tools that predate groups

pip installs a group from a `pyproject.toml` directly — its reference, as of pip docs v26.2.1:

> *"`--group <[path:]group>` — Install a named dependency-group from a "pyproject.toml" file. If a path is
> given, the name of the file must be "pyproject.toml". Defaults to using "pyproject.toml" in the current
> directory."*

⚠️ I could not confirm from pip's documentation which release first shipped `--group`; the flag is present in
the v26.2.1 reference. Note that a group never implies the project:

> *"Note that none of these Dependency Group declarations implicitly install the current package, its
> dependencies, or any optional dependencies. Use of a Dependency Group like `test` to test a package requires
> that the user's configuration or toolchain also installs the current package (`.`)."*

```bash
python -m pip install --group test -e .      # the group AND the project
```

PEP 735 predicted the adoption lag honestly — *"broad ecosystem support could take many months or even some
number of years to arrive"* — so a tool that only reads requirements files gets one generated from the lock,
per group:

```bash
uv export --locked --only-group docs -o docs/requirements.txt    # e.g. for a hosted docs builder
```

## Groups without a package at all

PEP 735 names non-package projects as a primary use case — *"How should dependencies be defined for projects
which do not build distributions (non-package projects)?"* — and lists *"Data science projects with groups of
dependencies but no core package"*. A repository of scripts or notebooks can declare everything as groups and
never define a build system:

```toml
[project]
name = "quarterly-analysis"
version = "0"
requires-python = ">=3.14"
dependencies = []

[dependency-groups]
ingest = ["polars>=1.9", "pyarrow>=18.0"]
plots  = ["matplotlib>=3.9"]
```

```bash
uv sync --group ingest --group plots
```

## Gotchas

**★ Symptom: `pip install --group test` then `pytest` fails to import your package.** Cause: groups never
install the project — *"Use of a Dependency Group like `test` to test a package requires that the user's
configuration or toolchain also installs the current package (`.`)."* Fix:

```bash
python -m pip install --group test -e .
```

**Symptom: a hosted docs builder or a legacy task runner cannot install your `docs` group.** Cause: it reads
requirements files; PEP 735 expected *"a degradation in their workflows and tool support"* during adoption. Fix:
generate one from the lock in CI rather than maintaining it:

```bash
uv export --locked --only-group docs -o docs/requirements.txt
```

**Symptom: a group that used to install fine now errors with a message about an invalid item, but only in the
one job that uses it.** Cause: validation is lazy by design — *"Tools SHOULD NOT eagerly validate the contents of
all dependency groups unless they have a need to do so"* — so a malformed entry in `docs` is invisible until
something installs `docs`. Fix: one CI step that touches every group:

```bash
uv sync --locked --all-groups
```

## Interview questions

**How do you use dependency groups with a tool that does not understand them?**
Export. `uv export --locked --only-group docs -o docs/requirements.txt` turns one group's slice of the lock into
a requirements file any pip-based tool can install, with hashes by default. pip itself reads groups directly with
`--group` in current releases, but remember that a group never implies the project: *"Use of a Dependency Group
like `test` to test a package requires that the user's configuration or toolchain also installs the current
package"*. PEP 735 expected this transitional period, warning of *"a degradation in their workflows and tool
support"* while adoption spread.

**Can a project with no package at all use dependency groups?**
Yes — it is one of the two problems PEP 735 set out to solve: *"How should dependencies be defined for projects
which do not build distributions (non-package projects)?"* A scripts repository or an analysis project declares
a `[project]` table for its name and Python range, leaves `dependencies` empty or minimal, defines no build
system, and puts every toolset in a group that `uv sync --group …` installs. Unlike extras, groups do not need a
package to attach to, which is exactly the distinction PEP 735 draws.

---

← [22 · Dependency groups in practice](22-dependency-groups.md) · [Topic index](README.md) · Next → [22c · Groups share one resolution](22c-groups-share-one-resolution.md)
