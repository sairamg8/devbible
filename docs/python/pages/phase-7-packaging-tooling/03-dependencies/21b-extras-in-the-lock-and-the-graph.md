---
title: "Every extra is resolved into your lock whether anyone installs it or not, and an installed package carries one set of extras for the whole environment — so an extra's constraints bind your base install, another package's request becomes yours, and a hand-copied `all` extra quietly rots"
sidebar_label: "21b · Extras in the graph"
sidebar_position: 25
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-10 against the PyPA **Dependency specifiers** specification
> ([packaging.python.org](https://packaging.python.org/en/latest/specifications/dependency-specifiers/)),
> the PyPA **pyproject.toml** specification and guide **Writing your pyproject.toml**
> ([packaging.python.org](https://packaging.python.org/en/latest/guides/writing-pyproject-toml/)), uv's
> **Resolution** concepts and **CLI reference** ([docs.astral.sh](https://docs.astral.sh/uv/concepts/resolution/),
> **uv 0.12.12**). Target: **Python 3.14.7**. Documentation-verified, **no sandbox run**.

**Declaring an extra adds lines to your metadata; it also adds nodes to two graphs you do not fully control.
In your own lock, every extra is resolved together with the base, so an extra's ceiling can hold back a
package the base install uses and two incompatible extras make the project unsatisfiable. In a consumer's
environment, the extras requested for a package are the union of every request in the graph, so a library you
depend on can switch on an extra you never asked for. Neither is a bug; both are consequences of one
environment holding one copy of each package, and both argue for the same design rule — extras add
capability, never change behaviour.**

## Every extra is in your lock, installed or not

`--all-extras` only chooses what to *install*. The resolution always includes every extra:

> *"Note that all optional dependencies are always included in the resolution; this option only affects the
> selection of packages to install."*

> *"uv requires that all dependencies declared by a project are compatible with each other and resolves all
> dependencies together when creating the lockfile. This includes project dependencies, optional
> dependencies ("extras"), and dependency groups (development dependencies)."*

That is what makes one lock serve every combination — and it means an extra's constraint participates in the
base resolution. An extra that needs an old version of a package the base install also uses drags the base
install *in your lock* back to that version — so your CI tests the base against the old version, while a
consumer who installs your published package without the extra resolves the new one. Your lock then tests a
combination your users do not get. Two extras that genuinely cannot
coexist make the whole lock unsatisfiable until the conflict is declared
([25b](25b-declared-conflicts.md)).

## Extras are global per package

The specification defines how requested extras combine:

> *"Extras union in the dependencies they define with the dependencies of the distribution they are attached
> to."* · *"If multiple extras are listed, all the dependencies are unioned together."*

and — the part with consequences — whose requests count:

> *"For dependency marker evaluations, the set of extra names used for these comparisons is the full set of
> requested extras for that particular package, whether requested directly in a top level dependency
> declaration, or indirectly in a transitive dependency declaration."*

So there is one set of extras per package per environment. If you depend on `httpx` and some library you
depend on declares `httpx[http2]`, your environment has HTTP/2 support whether you asked for it or not, and no
declaration of yours can take it away. Extras must therefore be *additive capability*, never a mode switch: an
extra that changes behaviour when installed changes it for every package in the environment.

## The convenience extra, and how it rots

The PyPA guide's own before/after, showing the drift a hand-maintained `all` accumulates:

```toml
gui = ["PyQt5"]
cli = [
  "rich>=14.2",   # version range is added after last "all" extra update
  "textual",      # dependency newly added since last "all" extra update
  "click",
]
all = ["PyQt5", "rich", "click"]
```

> *"The combined extra does not need its own manually maintained copy of each referenced extra's
> dependencies, which can otherwise fall out of sync after a few years of maintenance and bug fixes"*

The self-referential form that cannot drift, and which *"Most package managers now support … including pip,
uv, poetry, hatch, pdm and Pipenv"*:

```toml
[project.optional-dependencies]
gui = ["PyQt5"]
cli = ["rich>=14.2", "textual", "click"]
all = ["my-tool[gui,cli]"]
```

## Gotchas

**★ Symptom: adding an extra made the *base* dependency on `pillow` resolve to an older version in the lock.**
Cause: every extra is resolved with the base — *"all optional dependencies are always included in the
resolution"* — so the extra's transitive ceiling now binds everyone. Fix: widen the extra's constraint to a
version that tolerates the modern base, and read the resolution before committing:

```bash
uv tree --package pillow --invert     # which requirement is holding it back
uv lock --upgrade-package reportlab   # move the extra's package to a version with a wider range
```

**★ Symptom: the environment contains `h2` and your code takes the HTTP/2 path, though you never requested
`httpx[http2]`.** Cause: a transitive dependency requested it, and the extras set is *"the full set of requested
extras for that particular package, whether requested directly … or indirectly"*. Fix: treat extras as
capabilities that may appear; if the behaviour must be explicit, make it a runtime setting rather than an
inference from what is installed:

```python
import importlib.util
import os

http2_enabled = (
    os.environ.get("INVOICE_HTTP2") == "1"
    and importlib.util.find_spec("h2") is not None
)
```

**Symptom: the `all` extra is missing a dependency that `cli` gained a year ago.** Cause: a hand-maintained
copy, the drift the PyPA guide warns *"can otherwise fall out of sync after a few years"*. Fix: the
self-referential form:

```toml
all = ["my-tool[gui,cli]"]
```

**Symptom: `uv lock` fails the moment a `cpu` and a `gpu` extra both name `torch`.** Cause: the two extras pin
`torch` from different indexes, and uv resolves all extras together. Fix: declare them conflicting so each
resolves separately ([25b](25b-declared-conflicts.md)):

```toml
[tool.uv]
conflicts = [[{ extra = "cpu" }, { extra = "gpu" }]]
```

## Interview questions

**★ uv resolves every extra even if you never install one. Why, and what does that cost?**
Because the lock is one resolution that must serve every combination a user might request — *"all optional
dependencies are always included in the resolution; this option only affects the selection of packages to
install."* That is what lets `uv sync --extra pdf` work without re-resolving. The cost is coupling: an extra's
constraints participate in the base resolution, so an extra that tolerates only an old version of a shared
dependency pins the base install back too, and two incompatible extras make the project unsatisfiable until
you declare them as conflicts.

**★ Two libraries in your environment request different extras of the same package. What do you get?**
The union. The specification evaluates the `extra` marker against *"the full set of requested extras for that
particular package, whether requested directly in a top level dependency declaration, or indirectly in a
transitive dependency declaration"*, and *"If multiple extras are listed, all the dependencies are unioned
together."* There is one installed copy of the package and one set of extras for it, so every requester gets
everyone's. This is why a well-designed extra only *adds* capability — an extra that switched behaviour would
switch it for code that never asked.

**How do you find which extra is holding a base dependency back in your lock?**
Ask the lock who requires the package, then read the constraints. `uv tree --package <name> --invert` shows
*"the packages that depend on the given package"*, so a ceiling introduced through an extra appears as a
requirement from that extra's package. Because every extra is always part of the resolution, removing the extra
locally — or temporarily loosening its constraint — and re-running `uv lock --dry-run` shows whether it was the
binding constraint. The fix then goes where the constraint lives: the extra's own range, or a declared conflict
if the two genuinely cannot share an environment.

---

← [21 · Extras in practice](21-extras.md) · [Topic index](README.md) · Next → [22 · Dependency groups](22-dependency-groups.md)
