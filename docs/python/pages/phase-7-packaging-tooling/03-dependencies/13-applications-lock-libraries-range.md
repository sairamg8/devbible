---
title: "Applications lock and libraries range — not as a style preference but because a library's dependencies are abstract requirements that intersect with everyone else's, while an application's are a concrete set of files that must be identical on every machine"
sidebar_label: "13 · Apps lock, libraries range"
sidebar_position: 13
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-10 against the PyPA discussion **install_requires vs requirements files**
> ([packaging.python.org](https://packaging.python.org/en/latest/discussions/install-requires-vs-requirements/)),
> the PyPA **Version specifiers** specification
> ([packaging.python.org](https://packaging.python.org/en/latest/specifications/version-specifiers/)),
> **PEP 751** ([peps.python.org](https://peps.python.org/pep-0751/)) and uv's project layout
> documentation ([docs.astral.sh](https://docs.astral.sh/uv/concepts/projects/layout/),
> **uv 0.12.12**). Target: **Python 3.14.7**. Documentation-verified, **no sandbox run**.

**This is the load-bearing rule of the whole topic, and it is not a convention. A library's
dependency declarations are *abstract*: names and ranges that get intersected with the declarations
of every other library the user installs, so a narrow range is a constraint imposed on strangers. An
application's dependencies are *concrete*: a specific set of files that must be identical in CI,
staging and production, so a range alone is not reproducible. Those are two different jobs done by
two different files — `[project.dependencies]` and a lockfile — and the failure mode of confusing
them is symmetric: a library that pins becomes uninstallable, an application that only ranges
becomes unreproducible.**

## The distinction PyPA actually draws

The canonical statement is about `install_requires`, and it transfers verbatim to
`[project.dependencies]`:

> *"`install_requires` is a Setuptools `setup.py` keyword that should be used to specify what a project
> minimally needs to run correctly. When the project is installed by pip, this is the specification that
> is used to install its dependencies."*

🔴 The sentence that names the two halves:

> *"Lastly, it's important to understand that `install_requires` is a listing of “Abstract”
> requirements, i.e just names and version restrictions that don't determine where the dependencies will
> be fulfilled from (i.e. from what index or source). The where (i.e. how they are to be made “Concrete”)
> is to be determined at install time using pip options."*

And the four contrasts, quoted in the order PyPA lists them:

> *"Whereas `install_requires` defines the dependencies for a single project, Requirements Files are often
> used to define the requirements for a complete Python environment."*

> *"Whereas `install_requires` requirements are minimal, requirements files often contain an exhaustive
> listing of pinned versions for the purpose of achieving repeatable installations of a complete
> environment."*

> *"Whereas `install_requires` requirements are “Abstract”, i.e. not associated with any particular index,
> requirements files often contain pip options like `--index-url` or `--find-links` to make requirements
> “Concrete”, i.e. associated with a particular index or directory of packages."*

> *"Whereas `install_requires` metadata is automatically analyzed by pip during an install, requirements
> files are not, and only are used when a user specifically installs them using `python -m pip install
> -r`."*

Four sentences, one idea: **the declaration describes the project, the lock describes an
environment.** They are not two spellings of the same thing and neither substitutes for the other.

## Why a library must not pin

> *"It is not considered best practice to use `install_requires` to pin dependencies to specific versions,
> or to specify sub-dependencies (i.e. dependencies of your dependencies). This is overly-restrictive, and
> prevents the user from gaining the benefit of dependency upgrades."*

The version specifiers spec says the same thing from the operator side:

> *"The use of `==` (without at least the wildcard suffix) when defining dependencies for published
> distributions is strongly discouraged as it greatly complicates the deployment of security fixes. The
> strict version comparison operator is intended primarily for use when defining dependencies for
> repeatable deployments of applications while using a shared distribution index."*

The mechanism behind "overly-restrictive" is intersection. When a user installs your library, the
resolver must find one version of every shared dependency that satisfies **every** declaration in the
graph at once. Your range is not a preference the resolver weighs; it is a hard constraint it must
respect. Pin exactly, and the set of versions that satisfies you has exactly one member — so any other
library that excludes that member makes the two of you mutually uninstallable. That is the diamond in
[15](15-the-diamond-that-cannot-resolve.md).

## Why an application must not merely range

A range is a *set* of acceptable environments, and a resolver picks a member of that set at install
time, preferring the latest. Two installs a week apart from the same `pyproject.toml` legitimately
produce different environments, because the index changed. That is not a bug — it is what a range means.

uv states the requirement a lockfile satisfies:

> *"Unlike the `pyproject.toml`, which is used to specify the broad requirements of your project, the
> lockfile contains the exact resolved versions that are installed in the project environment. This file
> should be checked into version control, allowing for consistent and reproducible installations across
> machines."*

> *"A lockfile ensures that developers working on the project are using a consistent set of package
> versions. Additionally, it ensures when deploying the project as an application that the exact set of
> used package versions is known."*

PEP 751 gives the standards-track version of the same motivation:

> *"Currently, no standard exists to create an immutable record, such as a lock file, which specifies what
> direct and indirect dependencies should be installed into a virtual environment."*

> *"The file format is also designed to not require a resolver at install time. This greatly simplifies
> reasoning about what would be installed when consuming a lock file."*

That last sentence is the operational payoff and it is worth stating plainly: **installing from a lock
performs no resolution.** There is no search, no backtracking, no dependence on what the index looks
like today, and therefore no way for a deploy to differ from the CI run that approved it.

## The two files, side by side

```toml
# pyproject.toml — the DECLARATION. Abstract. Committed. Reviewed when intent changes.
[project]
name = "acme-reports"
version = "2.4.0"
requires-python = ">=3.12"
dependencies = [
  "httpx>=0.27",
  "sqlalchemy>=2.0,!=2.0.26",
  "pydantic>=2.7",
]

[dependency-groups]
dev = ["pytest>=8.2", "ruff>=0.16"]
```

```text
uv.lock            # the RESOLUTION. Concrete. Committed. Reviewed when versions change.
                   # generated by `uv lock`; never edited by hand
```

The division of labour is what makes an upgrade legible. Changing intent (`httpx>=0.27` →
`httpx>=0.28`) is a one-line diff in a file a human wrote. Changing versions (`uv lock --upgrade`) is a
large diff in a file no human wrote. Merging those two into one file — exact pins in
`pyproject.toml` — means every routine version bump looks like a change of intent, and reviewers stop
reading either.

## Gotchas

**★ Symptom: your library cannot be installed alongside another popular one.** Cause: an exact pin or a
narrow range in your published metadata, intersected with theirs, leaves an empty set. *"This is
overly-restrictive, and prevents the user from gaining the benefit of dependency upgrades."* Fix: widen the
declaration and move exactness into your own lock:

```toml
# pyproject.toml
- dependencies = ["httpx==0.27.2"]
+ dependencies = ["httpx>=0.27"]
```

```bash
uv lock          # your CI still installs exactly 0.27.2, from uv.lock
```

**★ Symptom: an application deploys a different set of versions than CI tested.** Cause: the deploy
resolved from ranges instead of installing from a lock. Fix: commit the lock and make the deploy refuse to
resolve:

```bash
uv sync --locked          # errors if uv.lock is missing or stale
```

**★ Symptom: every dependency bump is a 400-line `pyproject.toml` diff.** Cause: exact pins in the
declaration, so the file that records *intent* is also the file that records *versions*. Fix: put ranges in
`pyproject.toml`, let the lock hold the numbers, and review the two kinds of change separately.

**★ Symptom: `pip install -r requirements.txt` reproduces a working environment on Linux and fails on
macOS.** Cause: a compiled requirements file is *"often used to define the requirements for a complete
Python environment"* — and that environment is the one it was compiled on. Markers that did not apply were
evaluated away. Fix: a universal lock, or one compiled file per target
([18](18-uv-lock-vs-pip-freeze-vs-pip-compile.md)).

**★ Symptom: a library's `pyproject.toml` lists transitive dependencies it does not import.** Cause:
someone copied `pip freeze` output into `dependencies`. PyPA names this specifically:
*"It is not considered best practice to use `install_requires` … to specify sub-dependencies (i.e.
dependencies of your dependencies)."* Fix: declare only what you `import`, and let the resolver find the
rest:

```toml
- dependencies = ["httpx==0.27.2", "httpcore==1.0.5", "h11==0.14.0", "certifi==2024.7.4"]
+ dependencies = ["httpx>=0.27"]
```

**★ Symptom: an application's `pyproject.toml` contains `--index-url` or a `--find-links` path.** Cause:
concrete install options in an abstract declaration. Those are *"pip options like `--index-url` or
`--find-links` to make requirements “Concrete”"* and they belong in a requirements file, a tool table or CI
configuration. Fix, for uv:

```toml
[[tool.uv.index]]
name = "internal"
url = "https://packages.internal.example/simple"
```

## Interview questions

**★ What does "abstract versus concrete dependency" mean, and which file holds which?**
Abstract means names plus version restrictions with no statement about *where* the artifacts come from —
PyPA's own words: *"just names and version restrictions that don't determine where the dependencies will be
fulfilled from (i.e. from what index or source). The where … is to be determined at install time."* That is
`[project.dependencies]`, and it is what gets published. Concrete means a specific set of artifacts,
usually with an index and often with hashes: that is a lockfile or a compiled requirements file, and it is
never published as part of the distribution. The whole rule follows: publish abstract, deploy concrete.

**★ Why is pinning exact versions in a library actively harmful rather than merely conservative?**
Because dependency declarations *intersect*. A resolver must satisfy every declaration in the graph
simultaneously, so an exact pin reduces the acceptable set for that dependency to one version, for every
consumer, forever. Any other package that excludes that version makes you mutually uninstallable, and a
security fix in that dependency cannot be adopted until you publish again — which the specification names
directly: *"strongly discouraged as it greatly complicates the deployment of security fixes."* A range costs
you nothing you actually need, because your own reproducibility comes from your own lock.

**★ If an application declares ranges and commits a lockfile, why keep the ranges at all?**
Because the ranges are the *intent* and the lock is a *consequence*. The ranges tell the resolver — and the
next maintainer — which upgrades are acceptable without a human decision, which is what makes
`uv lock --upgrade` safe to run at all. They also tell you what an upgrade means: if `pyproject.toml` says
`>=0.27` and the lock moves 0.27.2 → 0.28.1, the range is where you ask "should it?" Delete the ranges and
pin everywhere, and every upgrade becomes a manual edit with nothing recording whether it was allowed.

**★ Someone proposes deleting `uv.lock` because "the ranges are enough". What is the concrete failure you
predict?**
A deploy that differs from the CI run that approved it. A range is a set, and resolvers prefer the newest
member, so the environment is a function of the index at install time rather than of anything in your repo.
The first symptom is usually a transitive dependency you have never heard of releasing a change, and the
second is that you cannot reproduce yesterday's build to bisect it. PEP 751's motivation is precisely that
gap: no standard existed *"to create an immutable record … which specifies what direct and indirect
dependencies should be installed"*, and installing from a lock *"does not require a resolver at install
time"*, which is what removes the variability.

---

← [12 · Marker fields and portability](12-markers-special-fields-and-portability.md) · [Topic index](README.md) · Next → [14 · Roles, not project types](14-roles-not-project-types.md)
