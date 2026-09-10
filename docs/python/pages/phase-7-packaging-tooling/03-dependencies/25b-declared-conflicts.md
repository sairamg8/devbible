---
title: "Declaring two extras or groups as conflicting tells uv to resolve them as separate forks instead of failing — the lock succeeds, the combination becomes an install-time error, and the declaration is uv's alone, so it is honest only when nobody should ever want both"
sidebar_label: "25b · Declared conflicts"
sidebar_position: 33
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-10 against uv's **Resolution** concepts (*Conflicting dependencies*)
> ([docs.astral.sh](https://docs.astral.sh/uv/concepts/resolution/), **uv 0.12.12**), uv's **Settings
> reference** ([docs.astral.sh](https://docs.astral.sh/uv/reference/settings/)), uv's **Managing dependencies**
> ([docs.astral.sh](https://docs.astral.sh/uv/concepts/projects/dependencies/)), uv's **CLI reference** for
> `uv sync` ([docs.astral.sh](https://docs.astral.sh/uv/reference/cli/)) and **PEP 751**
> ([peps.python.org](https://peps.python.org/pep-0751/)). Target: **Python 3.14.7**.
> Documentation-verified, **no sandbox run** — the error texts below are quoted from uv's documentation.

**uv resolves a project's dependencies, extras and groups as one problem, so two extras that need different
versions of the same package make the whole project unsatisfiable — even though nobody installs both. A
declared conflict is how you tell uv the combination is not a use case: it resolves each side separately,
the lock succeeds, and asking for both becomes an error at install time instead of at lock time. That is the
right trade when the two really are alternatives — CPU versus GPU builds, two major versions of a backend.
It is the wrong one when users plausibly want both, because it moves the failure onto them, and because the
declaration lives in `[tool.uv]` it tells no other installer anything.**

## Before and after

The two extras, from uv's documentation:

```toml
[project.optional-dependencies]
extra1 = ["numpy==2.1.2"]
extra2 = ["numpy==2.0.0"]
```

`uv lock` fails, and uv's documentation shows the proof (the doubled *"projects's"* is upstream's):

```text
  x No solution found when resolving dependencies:
  `-> Because myproject[extra2] depends on numpy==2.0.0 and myproject[extra1] depends on numpy==2.1.2, we can conclude that myproject[extra1] and
      myproject[extra2] are incompatible.
      And because your project requires myproject[extra1] and myproject[extra2], we can conclude that your projects's requirements are unsatisfiable.
```

The declaration:

```toml
[tool.uv]
conflicts = [
    [
      { extra = "extra1" },
      { extra = "extra2" },
    ],
]
```

> *"Now, running uv lock will succeed. However, now you cannot install both extra1 and extra2 at the same time"*

— and requesting both produces, per the docs:

```text
error: extra `extra1`, extra `extra2` are incompatible with the declared conflicts: {`myproject[extra1]`, `myproject[extra2]`}
```

> *"This error occurs because installing both extra1 and extra2 would result in installing two different versions
> of a package into the same environment."*

The settings reference states the purpose in one sentence: *"By making such conflicts explicit, uv can generate a
universal resolution for a project."*

## What the lock looks like afterwards

The lock now contains a fork per side, marked so an installer can tell them apart — PEP 751's general rule is that
*"Packages MAY be listed multiple times with varying data, but all packages to be installed MUST narrow down to a
single entry at install time."* The same mechanism that forks by platform ([15](15-the-diamond-that-cannot-resolve.md))
now forks by which extra was requested. Two consequences:

- Each fork is a resolution you must test; a green job with `extra1` says nothing about `extra2`.
- The flags that would combine them stop working. `uv sync --all-extras`: *"When two or more extras are declared as
  conflicting in tool.uv.conflicts, using this flag will always result in an error."* `--extra` and `--group`:
  *"When multiple extras or groups are specified that appear in tool.uv.conflicts, uv will report an error."*

## Groups, and workspace members

Groups use the `group` key — *"The only difference from conflicting extras is that you need to use the `group` key
instead of `extra`"*:

```toml
[tool.uv]
conflicts = [[{ group = "group1" }, { group = "group2" }]]
```

In a workspace, every member shares one lock — *"uv requires all workspace members to be compatible with each
other"* — and conflicts can cross members with a `package` key, including a member's base dependencies:

```toml
[tool.uv]
conflicts = [
    [
      { package = "member1", extra = "extra1" },
      { package = "member2", extra = "extra2" },
    ],
    [
      { package = "member3" },
      { package = "member4" },
    ],
]
```

The second form has the consequence you would expect and people still trip over: *"These workspace members will not
be installable together, e.g., the workspace root cannot define `dependencies = ["member1", "member2"]`."*

## The canonical real case: one package, two builds

uv's documentation shows extras selecting the same package from different indexes — CPU and GPU builds of `torch`:

```toml
[project]
dependencies = []

[project.optional-dependencies]
cpu = ["torch"]
gpu = ["torch"]

[tool.uv.sources]
torch = [
  { index = "torch-cpu", extra = "cpu" },
  { index = "torch-gpu", extra = "gpu" },
]

[[tool.uv.index]]
name = "torch-cpu"
url = "https://download.pytorch.org/whl/cpu"

[[tool.uv.index]]
name = "torch-gpu"
url = "https://download.pytorch.org/whl/cu130"
```

The two extras want two different artifacts under one name in one environment, which is the definition of a
conflict — and uv's dependencies page warns that *"If you have optional dependencies that conflict with one another,
resolution will fail unless you explicitly declare them as conflicting."* So the pair is declared:

```toml
[tool.uv]
conflicts = [[{ extra = "cpu" }, { extra = "gpu" }]]
```

and each deployment chooses exactly one: `uv sync --locked --extra cpu` on the CPU fleet, `--extra gpu` on the GPU
fleet.

## Gotchas

**★ Symptom: after declaring a conflict, the CI job that ran `uv sync --all-extras` fails on every run.** Cause:
*"using this flag will always result in an error"* once conflicts are declared. Fix: a matrix of compatible
combinations instead:

```yaml
strategy:
  matrix:
    extras: ["--extra cpu", "--extra gpu"]
steps:
  - run: uv sync --locked ${{ matrix.extras }}
  - run: uv run --locked pytest -q
```

**★ Symptom: users of your library report that installing `yourlib[a,b]` fails, though your lock and CI are
green.** Cause: the conflict declaration is in `[tool.uv]`, so it is not published; pip and every other installer
see two extras that cannot be satisfied together and fail with a resolution error. Fix: if users plausibly want both,
remove the incompatibility — widen one side's range — rather than declaring it; if they genuinely are alternatives,
say so in the documentation next to the install command:

```toml
[project.optional-dependencies]
extra1 = ["numpy>=2.1"]          # needs the 2.1 API
extra2 = ["numpy>=2.0,<2.3"]     # tested through 2.2 — the ranges now intersect, nothing to declare
```

**★ Symptom: a declared conflict made the lock succeed, and a month later a deployment that needed both extras
cannot be built.** Cause: the conflict was declared to silence the lock rather than to record a real exclusivity.
Fix: treat `conflicts` as a product decision with a reason, not a resolver setting:

```toml
[tool.uv]
# cpu and gpu select different torch builds; a machine runs exactly one. See ADR-014.
conflicts = [[{ extra = "cpu" }, { extra = "gpu" }]]
```

**Symptom: the workspace root cannot depend on two members after a conflict between them was declared.** Cause:
declared-conflicting members *"will not be installable together"*, and a root depending on both is exactly that.
Fix: split the deployables so each environment installs one side — separate entry-point packages, or separate
images syncing with `--package`:

```bash
uv sync --locked --package member1
```

**Symptom: `uv lock` still fails after adding `cpu` and `gpu` extras with per-extra sources.** Cause: sources route
each extra to its index, but both extras still name `torch` in one resolution; uv's note is that conflicting
optional dependencies fail *"unless you explicitly declare them as conflicting."* Fix: the declaration:

```toml
[tool.uv]
conflicts = [[{ extra = "cpu" }, { extra = "gpu" }]]
```

**Symptom: one side of a declared conflict breaks unnoticed for weeks.** Cause: each fork is its own resolution and
only the side CI installs is tested. Fix: one job per side, every run — the matrix above — and include both sides in
the scheduled audit:

```bash
uv audit --frozen            # "By default, all extras and groups within the project are audited."
```

## Interview questions

**★ What does declaring a conflict change, in the lock and at install time?**
In the lock, uv stops trying to find one set of versions that satisfies both sides and resolves each separately, so a
project that was unsatisfiable locks successfully — the settings reference says explicit conflicts let uv *"generate
a universal resolution for a project."* At install time the combination becomes an error: requesting both extras or
groups fails with *"are incompatible with the declared conflicts"*, and `--all-extras` *"will always result in an
error."* The failure moves from "nobody can lock" to "nobody can install both", which is correct exactly when nobody
should.

**★ When is declaring a conflict the wrong fix?**
When the two sides are not real alternatives. If a user could reasonably want both extras, declaring them
conflicting just moves the resolution error from your lock to their install — and because the declaration lives in
`[tool.uv]`, pip and other installers never see it and simply fail. The right fix then is to make the requirements
compatible: widen one side's range, or split the features differently. Declared conflicts are for genuine exclusivity
— CPU versus GPU builds, two major versions of a backend — and deserve a comment saying why.

**How do conflicts work across workspace members?**
With a `package` key naming the member, optionally with the extra or group: `{ package = "member1", extra =
"extra1" }`, or `{ package = "member1" }` for a member's base dependencies. Because every member shares one lock, this
is how two services with incompatible pins can live in one workspace. The price is that the conflicting members
*"will not be installable together"* — no root or other member may depend on both — so each deployable environment
must be synced for one side, for example with `uv sync --package`.

**Why is the CPU/GPU `torch` split the textbook case for a declared conflict?**
Because both sides need the same distribution name from different sources, one per machine, and no environment
should ever contain both. uv's docs route each extra to its own index with per-extra `tool.uv.sources`, and the pair
must additionally be declared conflicting, since both extras name `torch` in one resolution. The result is a single
lock that serves the CPU fleet (`--extra cpu`) and the GPU fleet (`--extra gpu`), with the impossible combination
rejected at install time rather than discovered as a broken import in production.

---

← [25 · Constraints, overrides, exclusions](25-constraints-overrides-and-declared-conflicts.md) · [Topic index](README.md) · Next topic → **04 · Project layout** *(not written yet)*
