---
title: "`[tool.uv]` carries the resolver's steering wheel — constraints that limit without installing, overrides that replace other packages' requirements outright, and a list of environments that narrows what \"universal\" means — each one a way to tell the solver something your dependencies got wrong"
sidebar_label: "08c · tool.uv resolution controls"
sidebar_position: 33
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-10 against **uv 0.12.12** — the settings reference
> ([docs.astral.sh](https://docs.astral.sh/uv/reference/settings/)), *Resolution*
> ([docs.astral.sh](https://docs.astral.sh/uv/concepts/resolution/)), *Locking and syncing*
> ([docs.astral.sh](https://docs.astral.sh/uv/concepts/projects/sync/)) and *Managing dependencies*
> ([docs.astral.sh](https://docs.astral.sh/uv/concepts/projects/dependencies/)).
> Version spine: **uv 0.12.12** (2026-09-09) · Python 3.14.7 · ruff 0.16.6 · pre-commit 4.6.2.
> Documentation-validated, **no sandbox run, no timings**.

**`[project.dependencies]` states what *your* code needs. It has no way to say anything about what
*other* packages need — and most real resolution problems are exactly that: a transitive dependency
with an upper bound it does not deserve, a library that only ships wheels for two platforms, a pair of
extras that can never be installed together. uv's answer is a handful of `[tool.uv]` settings that talk
to the resolver directly. Constraints narrow the versions a package may take without adding it.
Overrides *replace* what other packages declare, which is powerful and makes you responsible for the
result. `environments` narrows the universal resolution to the platforms you actually ship to, and
`conflicts` tells it which extras or groups are mutually exclusive so a universal lock is possible at
all. Because all of these live under `[tool.uv]`, none of them reaches anyone who installs your package
with another tool — which is the right scope for an application and a trap for a library.**

## Constraints: limit, never add

> *"Constraints to apply when resolving the project's dependencies. Including a package as a constraint
> will _not_ trigger installation of the package on its own."*
> — [settings reference](https://docs.astral.sh/uv/reference/settings/)

```toml
[tool.uv]
constraint-dependencies = [
    "urllib3<3",          # applies only if something pulls urllib3 in
    "grpcio>=1.66",
]
```

A constraint is a *rule about a package if it appears*. That makes it the right tool for "whatever pulls
in urllib3, it must not be 3.x", and the wrong tool for "we need urllib3" — the second is a dependency.
It is also the mechanism behind the migration trick in [06f](06f-migrating-from-requirements-to-a-project.md):
`uv add -c requirements.txt` holds existing versions without declaring them.

## Overrides: absolute, and yours to answer for

> *"Overrides to apply when resolving the project's dependencies. While constraints are _additive_,
> overrides are _absolute_, completely replacing requirements of constituent packages."*
> — [settings reference](https://docs.astral.sh/uv/reference/settings/)

```toml
[tool.uv]
override-dependencies = ["werkzeug==2.3.0"]
```

"Additive" versus "absolute" is the whole difference. A constraint is intersected with every other
requirement on that package, so a constraint that contradicts a dependency's requirement makes the
resolution fail — correctly. An override *replaces* the requirement other packages declare on it, so a
dependency that says `werkzeug<2.3` is simply not asked. That is the escape hatch for an upper bound a
maintainer set out of caution and never lifted — and it moves the compatibility question from their
metadata to your test suite. Every override deserves a comment saying why, and a date to revisit it.

## `environments`: narrowing what "universal" means

> *"A list of supported environments against which to resolve dependencies. By default, uv will resolve
> for all possible environments during a `uv lock` operation."*
> — [settings reference](https://docs.astral.sh/uv/reference/settings/)

Universal resolution ([03](03-the-lockfile.md)) solves for every platform and Python version your
`requires-python` admits. For an application that only ever runs on Linux and developers' Macs, that is
work spent — and sometimes a *failure* — on platforms that will never install it:

```toml
[tool.uv]
environments = [
    "sys_platform == 'linux'",
    "sys_platform == 'darwin'",
]
```

The entries are environment markers, the same grammar as dependency markers (topic 01's
[dependencies and markers](../01-pyproject-toml/06-dependencies-and-markers.md)). The trade is exact: a
Windows machine can no longer be served by this lockfile.

## `required-environments`: failing at lock time instead of install time

> *"A list of required platforms, for packages that lack source distributions. When a package does not
> have a source distribution, its availability will be limited to the platforms supported by its built
> distributions (wheels)."*
> — [settings reference](https://docs.astral.sh/uv/reference/settings/)

`environments` says *only* these platforms; `required-environments` says *at least* these. The problem it
targets is a wheel-only package: if it publishes no wheel for, say, Linux on ARM, the universal lock can
still succeed by resolving that package only where wheels exist — and the failure arrives later, as an
install error on the ARM machine. Declaring the platform as required moves that failure to `uv lock`,
where it is cheap:

```toml
[tool.uv]
required-environments = [
    "sys_platform == 'linux' and platform_machine == 'aarch64'",
]
```

## `conflicts`: extras and groups that can never coexist

> *"Declare collections of extras or dependency groups that are conflicting (mutually exclusive). By
> making such conflicts explicit, uv can generate a universal resolution for a project."*
> — [settings reference](https://docs.astral.sh/uv/reference/settings/)

The canonical case is a package with a CPU build and a GPU build offered as two extras that pin
incompatible versions of the same dependency. A universal resolution tries to find one answer for the
whole project, including "both extras at once", and there is none — so the lock fails. Declaring the
conflict tells uv that combination will never be requested:

```toml
[project.optional-dependencies]
cpu = ["torch==2.8.0"]
gpu = ["torch==2.8.0+cu128"]

[tool.uv]
conflicts = [
    [{ extra = "cpu" }, { extra = "gpu" }],
]
```

⚠️ The package versions above are illustrative of the shape; a real CPU/GPU split also needs index
routing for the GPU wheels, which is `[tool.uv.sources]` ([04b](04b-tool-uv-sources.md)).

## `default-groups`, `managed`, and the index flags

> `default-groups`: *"The list of `dependency-groups` to install by default. Can also be the literal
> `"all"` to default enable all groups."*

> `managed`: *"Whether the project is managed by uv. If `false`, uv will ignore the project when
> `uv run` is invoked."*
> — both [settings reference](https://docs.astral.sh/uv/reference/settings/)

`default-groups` generalises the special case [02c](02c-uv-sync-makes-the-environment-match.md) documents
— *"The `dev` group is special-cased and synced by default"* — to any set of groups. `managed = false` is
rare and worth recognising: a directory with a `pyproject.toml` that uv should treat as not-a-project.

Index entries carry two flags worth knowing. Paraphrasing the settings reference (its exact wording was
not captured when this page was verified): `default = true` makes an index the lowest-priority fallback
*instead of* PyPI, and `explicit = true` makes an index usable **only** by packages that name it through
`[tool.uv.sources]`.

```toml
[[tool.uv.index]]
name = "internal"
url = "https://pypi.internal.example.com/simple"
explicit = true                       # only packages routed here below may use it

[tool.uv.sources]
our-auth-lib = { index = "internal" }
```

## Gotchas

**★ Symptom: you added a package to `constraint-dependencies` and it is not installed.**
Cause: *"Including a package as a constraint will _not_ trigger installation of the package on its
own."* Fix: if your code needs it, it is a dependency.

```bash
uv add 'urllib3>=2,<3'
```

**★ Symptom: `uv lock` fails because a transitive dependency caps a package below the version you need.**
Cause: the cap is in *their* metadata, and a constraint only intersects with it. Fix: override it —
knowing that an override is *"absolute, completely replacing requirements of constituent packages"*, so
your tests now carry the compatibility claim.

```toml
[tool.uv]
# 2026-09: legacy-sdk declares werkzeug<2.3 without cause; revisit on its next release
override-dependencies = ["werkzeug==2.3.0"]
```

**★ Symptom: `uv lock` fails on a platform the application never runs on.**
Cause: the default universal resolution covers *"all possible environments"*. Fix: say where you ship.

```toml
[tool.uv]
environments = ["sys_platform == 'linux'", "sys_platform == 'darwin'"]
```

**★ Symptom: the lock succeeds, CI on ARM Linux fails at install time with no wheel available.**
Cause: a wheel-only package has no build for that platform, and nothing told the resolver the platform
mattered. Fix: require it, so the gap is found by `uv lock`.

```toml
[tool.uv]
required-environments = ["sys_platform == 'linux' and platform_machine == 'aarch64'"]
```

**★ Symptom: adding a `gpu` extra next to a `cpu` extra makes `uv lock` fail.**
Cause: universal resolution looks for an answer that includes both at once, and there is none. Fix:
declare them mutually exclusive.

```toml
[tool.uv]
conflicts = [[{ extra = "cpu" }, { extra = "gpu" }]]
```

**Symptom: `uv sync` on a fresh clone installs documentation and lint groups that CI does not need.**
Cause: `default-groups` lists them — or is `"all"`. Fix: keep defaults minimal and ask for groups
explicitly where needed.

```toml
[tool.uv]
default-groups = ["dev"]
```

**Symptom: `uv run` in a directory with a `pyproject.toml` behaves as if there were no project.**
Cause: `managed = false` — *"uv will ignore the project when `uv run` is invoked."* Fix: remove it, or
confirm it was intended.

```toml
[tool.uv]
managed = true
```

**Symptom: a package you publish installs fine with uv and fails with pip, because a transitive cap bites.**
Cause: your override lives under `[tool.uv]` and does not travel with the package — the same scoping as
`[tool.uv.sources]` ([04b](04b-tool-uv-sources.md)). Fix: for a library, widen the requirement in real
metadata where you can, and verify the build without uv-only settings.

```bash
uv build --no-sources     # see 09 — builds as other tools would see the project
```

## Interview questions

**★ What is the difference between a constraint and an override in uv?**
Constraints are *additive*, overrides are *absolute* — the settings reference uses those words. A
constraint is one more requirement intersected with everything else declared on a package, so it can
only narrow; if it contradicts a dependency's declared requirement, resolution fails, which is usually
what you want. It also never adds a package on its own. An override replaces what other packages
declare about the target, so a transitive `<2.3` cap is simply not consulted. Use a constraint to keep a
package out of a range you know is bad; use an override only when a dependency's metadata is wrong and
you are prepared to prove the combination works with your own tests.

**★ `uv.lock` is universal by design. Why would you ever restrict `environments`?**
Because "universal" means every platform and Python version your `requires-python` admits, and an
application usually ships to a few. Resolving for the rest costs work and can fail outright — a
package with no support for a platform you will never run on can make the whole lock unsatisfiable.
`environments` — *"A list of supported environments against which to resolve dependencies"* — trades
coverage for a lock that succeeds and describes only what you deploy. A library should hesitate,
because its users' platforms are not its to choose; an application usually should not.

**Why does uv need a `conflicts` declaration to lock a project with CPU and GPU extras?**
Because a universal resolution is a single solution meant to be valid for every combination of extras
and groups someone might request, and "both at once" is one of those combinations. If the two extras
pin incompatible versions of the same package, no solution exists and the lock fails, even though no
user would ever install both. Declaring them in `conflicts` — *"By making such conflicts explicit, uv can
generate a universal resolution for a project"* — removes that combination from the problem. uv then
refuses to install them together, which is the promise the declaration makes.

**What does `required-environments` buy you over `environments`?**
Earlier failure. `environments` limits the platforms uv resolves for; `required-environments` insists
that particular platforms be *installable*, which matters for packages that publish only wheels — the
settings reference notes their *"availability will be limited to the platforms supported by its built
distributions."* Without the declaration, a universal lock can succeed with a wheel-only package simply
unavailable on one platform, and the problem surfaces as an install failure on that machine. With it,
`uv lock` fails where you can see it, on the machine of the person changing dependencies.

**Why is an `explicit = true` index a good default for an internal package index?**
Because it narrows which packages the index can supply to the ones you route there on purpose. An
index consulted for every package means any name on it competes with same-named packages elsewhere; an
explicit index is used only by packages that name it in `[tool.uv.sources]` (paraphrasing the settings
reference). The result is a reviewable list of internal packages in `pyproject.toml`, and less room for a
package from the wrong index to be chosen for a name you did not expect. The cost is one sources entry
per internal package.

---

← Prev: [08b · required-version, UV_* and .env](08b-required-version-env-vars-and-dotenv.md) · [Topic index](README.md) · Next → [09 · uv init, uv version, uv tree](09-uv-init-version-and-tree.md)
