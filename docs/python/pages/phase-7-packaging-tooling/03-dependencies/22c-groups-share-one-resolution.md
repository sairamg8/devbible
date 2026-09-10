---
title: "Every dependency group is resolved together with your production dependencies into one lock, so a documentation tool's ceiling can decide which version of a library your service runs — and the fixes are to loosen it, isolate the tool with uvx, or give it a project of its own"
sidebar_label: "22c · Groups share one resolution"
sidebar_position: 28
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-10 against uv's **Managing dependencies** and **Resolution** concepts
> ([docs.astral.sh](https://docs.astral.sh/uv/concepts/projects/dependencies/), **uv 0.12.12**), uv's
> **CLI reference** for `uv tool run`, `uv lock` and `uv audit`
> ([docs.astral.sh](https://docs.astral.sh/uv/reference/cli/)), **PEP 735**
> ([peps.python.org](https://peps.python.org/pep-0735/)) and the PyPA **Dependency groups** specification
> ([packaging.python.org](https://packaging.python.org/en/latest/specifications/dependency-groups/)).
> Target: **Python 3.14.7**. Documentation-verified, **no sandbox run**.

**Groups never reach your published metadata; they very much reach your lock. uv resolves the project's
dependencies, every extra and every group as one problem, because one lock must serve every combination a
developer or a CI job might install. The consequence surprises people exactly once: a constraint in a group
nobody deploys can still choose the version of a package production runs. That is the same coupling extras
have ([21b](21b-extras-in-the-lock-and-the-graph.md)), with a different set of exits — tools that never import
your code do not need to be in the resolution at all.**

## One resolution, stated

> *"uv requires that all dependency groups are compatible with each other and resolves all groups together when
> creating the lockfile."*

> *"uv requires that all dependencies declared by a project are compatible with each other and resolves all
> dependencies together when creating the lockfile. This includes project dependencies, optional dependencies
> ("extras"), and dependency groups (development dependencies)."*

and within a group, includes cannot escape it either:

> *"An included group's dependencies cannot conflict with the other dependencies declared in a group."*

An illustration, with hypothetical constraints: your service depends on `jinja2>=3.1`, and an old version of your
docs toolchain declares `jinja2<3.1.4`. Nothing about that is unsatisfiable, so the lock resolves `jinja2` to the
newest release below `3.1.4` — for *every* environment, including the production image built with `--no-dev`.
Excluding the group at install time does not re-resolve; it selects from a resolution the group already
constrained.

## The exits, in order of preference

**1 · Loosen or upgrade the tool.** Usually the constraint is stale, and a newer release of the tool has a
wider range:

```bash
uv tree --package jinja2 --invert          # who constrains it, and how
uv lock --upgrade-group docs               # move every package in the docs group
```

`--upgrade-group` is documented as *"Allow upgrades for all packages in a dependency group, ignoring pinned
versions in any existing output file"*.

**2 · Take tools that never import your code out of the resolution.** A formatter, a linter, a pre-commit
runner, a release tool — none of them needs to share an environment with your application. uv runs them in an
isolated, ephemeral environment:

> *"Packages are installed into an ephemeral virtual environment in the uv cache directory."* · *"The name of the
> command can include an exact version in the format `<package>@<version>`"*

```bash
uvx ruff@0.16.6 check .          # "uvx is provided as a convenient alias for uv tool run"
```

The trade-off is explicit: the tool's version is now pinned by the command rather than by `uv.lock`, so pin it
exactly, in one place (a Makefile target, a pre-commit config), or developers and CI will drift.

This exit does **not** apply to pytest, mypy, or anything that imports your package — those must resolve with
your dependencies, because they test them.

**3 · Give a genuinely separate toolchain its own project.** A docs site with a heavy, slow-moving toolchain
can be a standalone project in a subdirectory with its own `pyproject.toml` and its own lock. It must not be a
workspace member: uv applies the same rule across a workspace — *"uv requires all workspace members to be
compatible with each other."*

```text
repo/
├── pyproject.toml        # the service, its groups, uv.lock
├── uv.lock
└── docs/
    ├── pyproject.toml    # docs toolchain only; its own uv.lock, not a workspace member
    └── uv.lock
```

**4 · Declare groups that cannot coexist.** When two *groups* need incompatible versions of the same package,
uv resolves them separately once told:

```toml
[tool.uv]
conflicts = [
    [
      { group = "group1" },
      { group = "group2" },
    ],
]
```

*"The only difference from conflicting extras is that you need to use the `group` key instead of `extra`."*
This separates the two groups from each other; the mechanics and the cost are
[25b](25b-declared-conflicts.md).

## A group can have its own Python range

A group whose tools need a newer interpreter than the project supports would otherwise fail the universal
resolution ([16](16-requires-python-constrains-everything.md)). uv lets the group narrow it:

> *"By default, dependency groups must be compatible with your project's `requires-python` range. If a
> dependency group requires a different range of Python versions than your project, you can specify a
> `requires-python` for the group in `[tool.uv.dependency-groups]`"*

```toml
[project]
requires-python = ">=3.10"

[dependency-groups]
dev = ["pytest"]

[tool.uv.dependency-groups]
dev = { requires-python = ">=3.12" }
```

## Ranges in groups, exactness in the lock

It is tempting to `==`-pin every tool in a group "for reproducibility". The lock already does that, and PEP
735's list of use cases carries the caveat in its own parenthesis — *"Input data to lockfile generation
(Dependency Groups should generally not be used as a location for locked dependency data)"*. Exact pins in a
group make the group a second lock, tighten the shared resolution for no benefit, and turn every tool upgrade
into a manual edit. Write ranges; let `uv lock --upgrade-group` move them.

## The legacy table

Before PEP 735, uv read `[tool.uv] dev-dependencies`. It still does, merged into `dev`:

> *"Dependencies declared in this section will be combined with the contents in the dependency-groups.dev.
> Eventually, the dev-dependencies field will be deprecated and removed."*

> *"If a tool.uv.dev-dependencies field exists, uv add --dev will use the existing section instead of adding a new
> dependency-groups.dev section."*

```toml
- [tool.uv]
- dev-dependencies = ["pytest>=8.3"]
+ [dependency-groups]
+ dev = ["pytest>=8.3"]
```

## Gotchas

**★ Symptom: upgrading nothing but the docs toolchain changes a library version in the production image.** Cause:
groups and production share one resolution — *"resolves all dependencies together when creating the lockfile"* —
and `--no-dev` selects from that resolution rather than re-resolving. Fix: find the binding constraint, then
loosen it or move the tool out of the lock:

```bash
uv tree --package jinja2 --invert
uv lock --upgrade-group docs
```

**★ Symptom: `ruff format` in CI disagrees with `ruff format` on developers' machines.** Cause: CI runs
`uvx ruff` (latest, isolated) while developers run the version locked in the `lint` group — or the reverse. Fix:
choose one source of truth; for an isolated tool, pin it in the command:

```bash
uvx ruff@0.16.6 format --check .
```

**★ Symptom: `uv lock` fails after adding a group, citing two versions of one package required by two groups.**
Cause: *"uv requires that all dependency groups are compatible with each other"*. Fix: if the groups are never
installed together, declare it:

```toml
[tool.uv]
conflicts = [[{ group = "legacy-tests" }, { group = "test" }]]
```

**Symptom: adding a tool to `dev` fails resolution because the tool needs Python 3.12 and the project supports
3.10.** Cause: groups must fit the project's `requires-python` by default. Fix: narrow the group's range:

```toml
[tool.uv.dependency-groups]
dev = { requires-python = ">=3.12" }
```

**Symptom: a group and an extra share a name, and a tool or a colleague installs the wrong one.** Cause: the
spec allows it but advises against it — *"users are advised to avoid creating dependency groups whose names match
extras, and tools MAY treat such matching as an error."* Fix: rename the group:

```toml
[project.optional-dependencies]
docs = ["docutils>=0.21"]          # a user-facing feature: render docstrings

[dependency-groups]
docs-build = ["mkdocs>=1.6"]       # your site generator
```

**Symptom: `uv add --dev pytest-xdist` does not appear in `[dependency-groups]`.** Cause: a legacy
`tool.uv.dev-dependencies` table exists, and *"uv add --dev will use the existing section"*. Fix: move its
contents into `[dependency-groups] dev` and delete the legacy table.

**Symptom: the deploy gate fails on a vulnerability in a test-only package.** Cause: `uv audit` covers everything
by default — *"By default, all extras and groups within the project are audited."* Fix: gate deploys on what
deploys, and audit the rest on a schedule ([23](23-keeping-a-lock-current.md)):

```bash
uv audit --frozen --no-dev             # the production set
uv audit --frozen                      # everything, nightly
```

**Symptom: every tool in `dev` is `==`-pinned and each upgrade is a hand edit that breaks the lock.** Cause: the
group is being used as a lock, which PEP 735 advises against. Fix: ranges in the group, exact versions in
`uv.lock`:

```toml
dev = ["pytest>=8.3", "ruff>=0.16"]
```

## Interview questions

**★ How can a documentation tool change what runs in production?**
Through the lock. uv resolves the project's dependencies and every dependency group together — *"uv requires
that all dependency groups are compatible with each other and resolves all groups together when creating the
lockfile"* — so a ceiling in a docs tool constrains the version chosen for a package production also uses.
Installing with `--no-dev` does not help, because it selects packages from the existing resolution rather than
resolving again. The fixes are to loosen the tool's constraint, run tools that do not import your code outside
the lock with `uvx`, or give a heavy separate toolchain its own project and lock.

**★ When should a tool run through `uvx` rather than live in a dependency group?**
When it never imports your code. A formatter, linter or release tool reads files; it does not need your
dependencies, and putting it in the shared resolution only adds constraints. `uvx` installs it *"into an
ephemeral virtual environment in the uv cache directory"* and accepts an exact version as `<package>@<version>`.
The cost is that the version is no longer in `uv.lock`, so it must be pinned in the command, in one place. Test
runners and type checkers are the opposite case: they import your package, so they must be resolved with it.

**Why does PEP 735 say groups should not hold locked data?**
Because groups are *inputs* to locking, not outputs. PEP 735 lists *"Input data to lockfile generation
(Dependency Groups should generally not be used as a location for locked dependency data)"* among its use cases.
Exact pins in a group duplicate what the lock records, tighten the shared resolution that production also
depends on, and turn upgrades into hand edits that must be kept consistent with the lock. The division of labour
is the same as for `[project.dependencies]`: declare ranges, let the lock hold exact versions.

**What does declaring two groups as conflicting buy, and what does it cost?**
It lets two toolsets that need incompatible versions of one package coexist in one project: uv resolves them
separately instead of failing, using the `group` key in `[tool.uv] conflicts`. The cost is that they can never be
installed together — a combined request is an error — and the lock now contains separate resolutions that each
need testing. It separates the groups from each other; it does not free production from a group's constraints,
because each group is still resolved alongside the project's dependencies.

---

← [22b · Groups beyond uv](22b-groups-beyond-uv.md) · [Topic index](README.md) · Next → [23 · Keeping a lock current](23-keeping-a-lock-current.md)
