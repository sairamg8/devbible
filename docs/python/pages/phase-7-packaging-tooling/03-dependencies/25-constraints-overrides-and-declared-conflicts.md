---
title: "When loosening is not enough there are three levers of rising force — a constraint can only narrow, an override replaces every requirement on a package, an exclusion deletes it from the graph — and all three live in your tool table, so they fix your environment and never your consumers'"
sidebar_label: "25 · Constraints, overrides, exclusions"
sidebar_position: 32
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-10 against uv's **Resolution** concepts (*Dependency constraints*, *Dependency
> overrides*, *Dependency exclusions*) ([docs.astral.sh](https://docs.astral.sh/uv/concepts/resolution/),
> **uv 0.12.12**), uv's **Settings reference** ([docs.astral.sh](https://docs.astral.sh/uv/reference/settings/)),
> uv's **CLI reference** for `uv pip compile` ([docs.astral.sh](https://docs.astral.sh/uv/reference/cli/)) and
> pip's **Dependency resolution** topic ([pip.pypa.io](https://pip.pypa.io/en/stable/topics/dependency-resolution/),
> pip docs v26.2.1). Target: **Python 3.14.7**. Documentation-verified, **no sandbox run**.

**The first answer to a resolution failure is to change a declaration — yours, or upstream's
([24](24-reading-a-resolution-failure.md)). When you cannot, uv gives you three ways to change the graph
itself, and they differ in force, not in syntax. A constraint narrows the versions a package may take but can
never add a package or widen a range. An override throws away every declared requirement on a package and
substitutes yours, which is the only way past an upper bound you know is wrong. An exclusion removes a
package from the graph entirely. All three are read from `[tool.uv]` at the workspace root, and none of them
is published: they change what *your* lock resolves, and a library that uses them to get its own CI green
still ships metadata that fails for everyone downstream. The fourth lever — declaring that two extras or
groups can never coexist — splits the resolution instead of editing it, and is
[25b](25b-declared-conflicts.md).**

## The order to reach for them

| Lever | Can it widen? | Can it add a package? | Can it remove one? | Force |
|---|---|---|---|---|
| change a declaration | yes | yes | yes | the right fix |
| constraint | **no** — *"only reduce"* | **no** | no | gentle |
| override | **yes** | no (global) / yes (scoped) | no | last resort |
| exclusion | n/a | no | **yes** | surgical |
| `dependency-metadata` | rewrites one package's declared metadata | — | — | for broken metadata ([10](10-direct-references-and-sources.md)) |

## Constraints: narrow only

> *"Like pip, uv supports constraint files (`--constraint constraints.txt`) which narrow the set of acceptable
> versions for the given packages. Constraint files are similar to requirements files, but being listed as a
> constraint alone will not cause a package to be included to the resolution. Instead, constraints only take
> effect if a requested package is already pulled in as a direct or transitive dependency."*

> *"Constraints are useful for reducing the range of available versions for a transitive dependency. They can also
> be used to keep a resolution in sync with some other set of resolved versions, regardless of which packages are
> overlapping between the two."*

In a project, the setting — from uv's settings reference, *"Constraints are used to restrict the versions of
dependencies that are selected during resolution"*:

```toml
[tool.uv]
constraint-dependencies = [
    "urllib3>=2.2.2",     # security floor on a transitive dependency you do not import
    "grpcio<1.65",        # the settings reference's own example
]
```

and in the pip-compatible interfaces:

```bash
python -m pip install -r requirements.txt -c constraints.txt
uv pip compile requirements.in -c constraints.txt -o requirements.txt   # "equivalent to pip's --constraint option"
```

Three jobs constraints do well: a security floor on a transitive package without making it a direct dependency
(which, in a library, would leak into your published metadata); a cap on a transitive package with a known bad
release; and alignment with an organisation-wide set of approved versions — the *"keep a resolution in sync with
some other set of resolved versions"* case. pip adds a fourth, for search that goes too deep: *"If you need to
impose additional version restrictions on transitive dependencies (dependencies of dependencies), consider using a
constraint file."*

## Overrides: replace, and therefore widen

> *"Dependency overrides allow bypassing unsuccessful or undesirable resolutions by overriding a package's declared
> dependencies. Overrides are a useful last resort for cases in which you know that a dependency is compatible with
> a certain version of a package, despite the metadata indicating otherwise."*

uv's example is the canonical case — a transitive dependency with an upper bound it does not need:

> *"For example, if a transitive dependency declares the requirement `pydantic>=1.0,<2.0`, but does work with
> `pydantic>=2.0`, the user can override the declared dependency by including `pydantic>=1.0,<3` in the overrides,
> thereby allowing the resolver to choose a newer version of pydantic."*

> *"Concretely, if `pydantic>=1.0,<3` is included as an override, uv will ignore all declared requirements on
> pydantic, replacing them with the override."*

```toml
[tool.uv]
override-dependencies = ["pydantic>=1.0,<3"]
```

The rules that make overrides dangerous, all quoted:

- They replace *every* requirement on the package, your own direct one included: *"By default, an override applies
  to every requirement for the named dependency, including direct requirements."*
- They ignore markers: *"If a package has a dependency with a marker, it is replaced unconditionally when using
  overrides — it does not matter if the marker evaluates to true or false."*
- Several overrides for one package *"must be differentiated with markers."*
- A global override adds nothing on its own: *"global overrides do not add a dependency on the package and only take
  effect if the package is requested in a direct or transitive dependency."*

The narrower tool is a **scoped** override, which replaces the requirement only as declared by one package:

```toml
[tool.uv]
override-dependencies = [
    "foo>1",
    { package = { name = "bar", version = "0.0.5" }, dependencies = ["foo>2"] },
]
```

> *"In this example, `foo>1` is the global override, while `foo>2` replaces requirements for `foo` declared by
> `bar==0.0.5`. If `bar` does not declare a dependency on `foo`, the scoped override adds it. Other dependencies
> declared by `bar` are unchanged."*

with two limits: *"A version-specific entry takes precedence over an all-versions entry, and a scoped override takes
precedence over a global override for the same dependency"*, and *"Scoped overrides currently support registry
version specifiers only. Direct URL and path sources, including Git sources, and explicit indexes are not
supported."*

In the pip-compatible interface, overrides are a file — *"overrides are absolute, in that they completely replace
the requirements of the constituent packages"*:

```bash
uv pip compile requirements.in --override overrides.txt -o requirements.txt
```

pip itself has no override mechanism; the pip-side answer is to fork or wait for upstream, as its fix ladder says
([15](15-the-diamond-that-cannot-resolve.md)).

## Exclusions: delete from the graph

> *"Dependency exclusions remove packages from the dependency graph. By default, an exclusion applies to every
> requirement for the named dependency, including direct requirements"*

```toml
[tool.uv]
exclude-dependencies = [
    { package = { name = "bar", version = "0.0.5" }, dependencies = ["foo"] },
]
```

Combined with a scoped override, an exclusion swaps one dependency for another — uv's own example replaces a
renamed package:

```toml
[tool.uv]
override-dependencies = [
    { package = { name = "bar", version = "0.0.5" }, dependencies = ["pytorch-lightning"] },
]
exclude-dependencies = [
    { package = { name = "bar", version = "0.0.5" }, dependencies = ["lightning"] },
]
```

and when both touch the same dependency in the same scope: *"the exclusion takes precedence."*

## Where they are read, and who sees them

The settings reference is explicit for each of `constraint-dependencies`, `override-dependencies` and
`exclude-dependencies`:

> *"In `uv lock`, `uv sync`, and `uv run`, uv will only read `override-dependencies` from the `pyproject.toml` at the
> workspace root, and will ignore any declarations in other workspace members or `uv.toml` files."*

And because they live under `[tool.uv]`, none of them becomes `Requires-Dist` in a wheel. A consumer resolving your
published library sees your `[project.dependencies]` and nothing else.

## Gotchas

**★ Symptom: a package listed in `constraint-dependencies` is not installed.** Cause: working as specified —
*"being listed as a constraint alone will not cause a package to be included to the resolution."* Fix: if you
import it, declare it:

```toml
[project]
dependencies = ["urllib3>=2.2.2"]
```

**★ Symptom: adding a constraint to "allow" a newer version made resolution fail.** Cause: constraints *"can only
reduce the set of acceptable versions"*; the upstream ceiling still applies, and your constraint intersected with
it to nothing. Fix: widening is what overrides are for — with evidence:

```toml
[tool.uv]
override-dependencies = ["pydantic>=1.0,<3"]
```

**★ Symptom: an override fixed Linux and broke Windows, where the dependency had a platform-specific pin.** Cause:
*"it is replaced unconditionally when using overrides — it does not matter if the marker evaluates to true or
false."* Fix: scope the override to the one requirer you tested, and give it markers if it must differ by
platform:

```toml
[tool.uv]
override-dependencies = [
    { package = { name = "legacy-sdk" }, dependencies = ["pydantic>=2,<3"] },
]
```

**★ Symptom: an override in a workspace member's `pyproject.toml` has no effect.** Cause: *"uv will only read
`override-dependencies` from the `pyproject.toml` at the workspace root"*. Fix: move it to the root:

```toml
# ./pyproject.toml — the workspace root
[tool.uv]
override-dependencies = ["pydantic>=1.0,<3"]
```

**★ Symptom: your library's CI is green, and users report the exact conflict you "fixed".** Cause: the fix was an
override or exclusion in `[tool.uv]`, which is not published; consumers resolve your `Requires-Dist` and the upstream
metadata unchanged. Fix: for a library, change the published declaration — widen your own range — and push the
upstream fix; document the override for application users if it is genuinely required:

```toml
[project]
dependencies = ["legacy-sdk>=4.2"]     # 4.2 is the first release without the pydantic<2 ceiling
```

**Symptom: an exclusion made `uv lock` succeed and the service fails at startup with `ModuleNotFoundError`.**
Cause: the excluded package was imported at runtime by the package that required it; exclusions remove it *"from
the dependency graph"* without asking. Fix: exclude only dependencies you have verified are unused on your code
paths, scope the exclusion to one requirer, and keep a smoke test that imports the entry points:

```bash
uv run --locked python -c "import invoice_service.api"
```

**Symptom: an override you added has no effect on one package's requirement.** Cause: the same dependency is also
excluded in that scope — *"If the same dependency is both overridden and excluded in a matching scope, the exclusion
takes precedence."* Fix: decide which you mean; to swap a dependency, override one name and exclude the other, as in
uv's `lightning` example.

**Symptom: a scoped override pointing at a Git fork is rejected.** Cause: *"Scoped overrides currently support
registry version specifiers only. Direct URL and path sources, including Git sources, and explicit indexes are not
supported."* Fix: a source entry for the fork plus a global override if a range must widen:

```toml
[tool.uv.sources]
legacy-sdk = { git = "https://github.com/acme/legacy-sdk", rev = "9c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d" }
```

## Interview questions

**★ What is the difference between a constraint and an override?**
Direction and scope of force. A constraint intersects with every other requirement on a package — it *"can only
reduce the set of acceptable versions"* — and it never adds the package to the graph. An override discards every
declared requirement on the package and substitutes its own, so it *"can expand the set of acceptable versions,
providing an escape hatch for erroneous upper version bounds."* Use a constraint for a security floor or a cap on a
transitive dependency; use an override only when you have tested that the metadata is wrong.

**★ Your application cannot install because a dependency declares `pydantic<2`, and you know it works with 2.x.
What do you do?**
Short term, an override — `override-dependencies = ["pydantic>=1.0,<3"]`, which makes uv *"ignore all declared
requirements on pydantic, replacing them with the override"* — ideally scoped to that one requirer so no other
package's pydantic requirement is discarded too. Then the parts that make it defensible: a test that exercises the
dependency's code paths against pydantic 2, a comment naming the upstream issue, and a pull request to the
dependency widening its range. When upstream releases the fix, delete the override and raise your floor on that
dependency instead.

**Why does an override not help the users of your library?**
Because it is not part of what you publish. Overrides, constraints and exclusions live under `[tool.uv]`, uv reads
them from the workspace root when locking, and a built wheel carries only `Requires-Dist` from `[project]`. A
consumer's resolver sees your declared ranges and the upstream package's metadata, exactly as they were before your
override. For a library, the only fix that reaches users is a change to published metadata — yours or upstream's.

**When would you use an exclusion rather than an override?**
When the right number of copies of a dependency is zero: a package pulled in by a requirer for a feature you never
use, a heavy optional backend a library mistakenly made mandatory, or a renamed package you want to swap for its
successor with a paired scoped override. It is surgical and dangerous in equal measure — the requirer will fail at
import if it actually uses what you removed — so scope it to one requirer and keep a smoke test that imports your
entry points.

---

← [24 · Reading a resolution failure](24-reading-a-resolution-failure.md) · [Topic index](README.md) · Next → [25b · Declared conflicts](25b-declared-conflicts.md)
