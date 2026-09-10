---
title: "The diamond is not a rare pathology — it is what happens every time two libraries pin the same dependency differently, and Python cannot install two versions of one package into one environment to escape it"
sidebar_label: "15 · The diamond"
sidebar_position: 15
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-10 against pip's **Dependency resolution** topic
> ([pip.pypa.io](https://pip.pypa.io/en/stable/topics/dependency-resolution/)), uv's
> **Resolution** concepts ([docs.astral.sh](https://docs.astral.sh/uv/concepts/resolution/),
> **uv 0.12.12**), the PyPA discussion **install_requires vs requirements files**
> ([packaging.python.org](https://packaging.python.org/en/latest/discussions/install-requires-vs-requirements/))
> and the PyPA **Version specifiers** specification
> ([packaging.python.org](https://packaging.python.org/en/latest/specifications/version-specifiers/)).
> Target: **Python 3.14.7**. Documentation-verified, **no sandbox run** — the error text below is
> quoted from pip's documentation, which labels its packages hypothetical.

**A diamond is two of your dependencies depending on a third. It is not unusual; in any real project
it is the majority of the graph. It becomes a *problem* only when the two constraints on the shared
dependency have an empty intersection, and it is unescapable in Python because a virtual environment
holds exactly one version of each distribution — there is no per-dependency nesting like
`node_modules`. That single environment-shape fact is why an exact pin in a published library is not
merely conservative but actively hostile: it reduces the intersection to one point, and any other
library that excludes that point makes the two mutually uninstallable.**

## The shape

```text
your-app
├── package_coffee 0.44.1  ──→  package_water >=2.4.2,<3.0.0
└── package_tea    4.3.0   ──→  package_water ==2.3.1
```

The resolver must choose **one** `package_water`. The intersection of `>=2.4.2,<3.0.0` and `==2.3.1`
is empty, so no choice exists, and pip reports exactly that — quoted from pip's documentation, whose
packages are its own hypotheticals:

```text
ERROR: Cannot install package_coffee==0.44.1 and package_tea==4.3.0 because these package versions have conflicting dependencies.
The conflict is caused by:
    package_coffee 0.44.1 depends on package_water<3.0.0,>=2.4.2
    package_tea 4.3.0 depends on package_water==2.3.1
```

> *"Note: package_coffee, package_tea, and package_water are hypothetical packages used only to
> illustrate dependency conflicts. They are not real projects you can install."*

This class of failure has a name in pip: a `ResolutionImpossible` error, described as the case
*"where pip cannot install their specified packages due to conflicting dependencies."*

## Why there is no escape hatch

Node solves this by nesting: two copies of one library at different versions, each visible only to
its own dependent. Python cannot, because installation targets a single `site-packages` directory
keyed by distribution name, and `import x` resolves to one module object per interpreter. Two versions
of the same distribution in one environment would mean two modules answering to one name — and worse,
objects created by one crossing into the other, where an `isinstance` check against the "same" class
fails.

So the resolver's job is genuinely to find a **single** assignment satisfying every constraint at once.
uv's minimal illustration:

> *"The project depends on foo and bar. foo has one version, 1.0.0: foo 1.0.0 depends on lib>=1.0.0.
> bar has one version, 1.0.0: bar 1.0.0 depends on lib>=2.0.0. lib has two versions, 1.0.0 and 2.0.0."*

> *"In this example, the resolver must find a set of package versions which satisfies the project
> requirements. Since there is only one version of both foo and bar, those will be used. The resolution
> must also include the transitive dependencies, so a version of lib must be chosen. foo 1.0.0 allows all
> available versions of lib, but bar 1.0.0 requires lib>=2.0.0 so lib 2.0.0 must be used."*

That one resolves. Change `foo 1.0.0` to require `lib<2.0.0` and it does not — nothing about the
resolver changed, only the width of one range.

## Why pinning in a library is the cause, not the symptom

Look again at the failing pair. `package_coffee` declares a *range*; `package_tea` declares `==2.3.1`.
The range can accommodate a great many partners. The pin can accommodate exactly one, and only if that
partner's range happens to contain `2.3.1`.

PyPA's guidance names this consequence directly:

> *"It is not considered best practice to use `install_requires` to pin dependencies to specific versions,
> or to specify sub-dependencies (i.e. dependencies of your dependencies). This is overly-restrictive, and
> prevents the user from gaining the benefit of dependency upgrades."*

and the version specifiers spec supplies the security-shaped version of the same argument:

> *"The use of `==` (without at least the wildcard suffix) when defining dependencies for published
> distributions is strongly discouraged as it greatly complicates the deployment of security fixes."*

The arithmetic is worth stating once, plainly. If library A declares `water>=2.4,<3` and library B
declares `water>=2.0,<2.9`, the intersection is `>=2.4,<2.9` — non-empty, and it *stays* non-empty as
new `2.x` releases appear. If B instead declares `water==2.3.1`, the intersection with A is empty
today and will still be empty after every future release, because a point set cannot grow. **A pin does
not merely narrow the intersection; it removes the possibility that time will fix it.**

The same reasoning applies, more weakly, to speculative upper bounds — see
[06](06-floors-and-ceilings.md). An unjustified `<3` on a widely-used dependency is a pin's cheaper
cousin: it does not eliminate the intersection, but it caps it at a point in the past.

## Multiple versions *do* exist in a lockfile — and that is not the same thing

Reading a universal lock, you will see one package listed twice, which looks like the nesting Python
cannot do. It is not:

> *"During universal resolution, a package may be listed multiple times with different versions or URLs
> within the same lockfile, since different versions may be needed for different platforms or Python
> versions."*

Those entries are mutually exclusive by marker — one for Linux, one for Windows, one per Python minor.
Any single *installation* still gets exactly one. uv's `numpy` illustration makes the shape explicit:

```text
numpy==1.24.4 ; python_version == "3.8"
numpy==2.0.2 ; python_version == "3.9"
numpy==2.2.0 ; python_version >= "3.10"
```

> *"This resolution reflects the fact that NumPy 2.2.0 and later require at least Python 3.10, while
> earlier versions are compatible with Python 3.8 and 3.9."*

uv also lets you trade consistency against recency here:

> *"By default (`--fork-strategy requires-python`), uv will optimize for selecting the latest version of
> each package for each supported Python version, while minimizing the number of selected versions across
> platforms."*

> *"Under `--fork-strategy fewest`, uv will instead minimize the number of selected versions for each
> package, preferring older versions that are compatible with a wider range of supported Python versions or
> platforms."*

`fewest` is the setting to reach for when you want every environment running the same code — for
example when the same lock feeds a container image and a developer laptop and you want bug reports to
be comparable.

## Extras and groups can diamond against themselves

The two constraints do not have to come from two different libraries. uv resolves your whole project
at once:

> *"uv requires that all dependencies declared by a project are compatible with each other and resolves all
> dependencies together when creating the lockfile. This includes project dependencies, optional
> dependencies ("extras"), and dependency groups (development dependencies)."*

So `extra1 = ["numpy==2.1.2"]` and `extra2 = ["numpy==2.0.0"]` in one `pyproject.toml` is a diamond with
you at both corners, and uv reports it as an unsatisfiable project rather than as a third-party conflict.
That case, and the `conflicts` declaration that resolves it, is
[25b](25b-declared-conflicts.md).

## Gotchas

**★ Symptom: two of your libraries cannot be installed together and neither maintainer thinks it is their
fault.** Cause: an empty intersection on a shared transitive dependency; the error names both. Fix, in
order of preference — the same order pip's own documentation uses:

1. *"Audit your top level requirements"* — remove anything unnecessary or out of date, because
   *"Removing these can significantly reduce the complexity of your dependency tree, thereby reducing
   opportunities for conflicts to occur."*
2. *"Loosen your top level requirements"* — if you pinned both, stop:
   ```bash
   python -m pip install "package_coffee>0.44" "package_tea>4.0.0"
   ```
3. *"Loosen the requirements of your dependencies"* — ask the maintainer, or fork, with pip's warning
   attached: *"If you choose to fork the package yourself, you are opting out of any support provided by
   the package maintainers."*
4. Accept there is no solution: *"Sometimes it's simply impossible to find a combination of package
   versions that do not conflict. Welcome to dependency hell."*

**★ Symptom: a pinned library blocks a security upgrade to something you do not even import.** Cause: a
transitive pin. The library you depend on pinned the vulnerable package exactly, so no patched version
satisfies the graph. Fix, short term, is an override that *replaces* the declared requirement — and it is
explicitly a last resort:

```toml
[tool.uv]
override-dependencies = ["package-water>=2.4.3"]
```

uv's framing: overrides are *"a useful last resort for cases in which you know that a dependency is
compatible with a certain version of a package, despite the metadata indicating otherwise."* Long term,
the fix is upstream ([25](25-constraints-overrides-and-declared-conflicts.md)).

**★ Symptom: "it worked last month" and the same two libraries now conflict.** Cause: an upper bound that
was in the future and is now in the past — a `<3` that became binding when the shared dependency released
3.0. Nothing in your project changed. Fix: check which bound is binding before touching anything:

```bash
uv tree --package package-water     # who requires it, and with what constraint
python -m pip install "package_coffee==0.44.1" "package_tea"   # pin the one you care about, free the other
```

That second command is pip's own advice: *"If you want to prioritize one package over another, you can add
version specifiers to only the more important package."*

**★ Symptom: your library gets bug reports about conflicts you cannot reproduce.** Cause: your ranges only
conflict in *combination with someone else's*, so your CI — which installs only your dependencies — never
sees it. Fix: widen what you can justify, and treat every upper bound as a liability with an owner
([06](06-floors-and-ceilings.md)). A useful diagnostic is to install your library alongside the packages
your users actually pair it with, in a scheduled CI job.

**★ Symptom: someone proposes vendoring the conflicting dependency.** Cause: a reasonable instinct
borrowed from ecosystems that nest. It does work — you copy the code into your package under your own
namespace — but it makes you responsible for that code's security updates forever, and it doubles in
memory and import time. Fix: treat vendoring as the option after pip's list is exhausted, and if you take
it, record the upstream version and a review date in the vendored directory.

**★ Symptom: a resolution "succeeds" and something breaks at runtime with an `AttributeError` in a library
you never touched.** Cause: not a diamond — the opposite. Every constraint was satisfiable, so the resolver
picked a version that satisfies the *declared* metadata but not the *actual* requirement, because a
dependency's metadata was too loose. Fix: the constraint that was missing belongs upstream; locally, pin it
in a constraints file so the fix survives re-resolution
([25](25-constraints-overrides-and-declared-conflicts.md)).

**★ Symptom: the lock contains two versions of one package and a reviewer flags it as a bug.** Cause: a
universal resolution forking on markers — *"a package may be listed multiple times with different versions
or URLs within the same lockfile, since different versions may be needed for different platforms or Python
versions."* Any single install still gets one. Fix: nothing, unless you want the platforms to agree, in
which case ask for fewer forks:

```bash
uv lock --fork-strategy fewest
```

**★ Symptom: two extras of your own project cannot be installed together.** Cause: you are both corners of
the diamond — uv *"resolves all dependencies together when creating the lockfile … includ[ing] project
dependencies, optional dependencies ("extras"), and dependency groups."* Fix: if the incompatibility is
genuine, declare it rather than hiding it, so the failure moves from lock time to install time with a clear
message ([25b](25b-declared-conflicts.md)).

## Interview questions

**★ Why can Python not solve a diamond the way npm does?**
Because installation targets a single environment keyed by distribution name: one `site-packages`, one
module object per import name per interpreter. npm can nest a second copy of a library inside the
`node_modules` of the dependent that needs it, so two versions coexist and each dependent sees its own. In
Python that would mean two distributions claiming the same import name, and objects created by one crossing
into the other — where an `isinstance` check against the "same" class fails, which is a far worse failure
than a resolution error. So the resolver must find a single assignment satisfying every constraint, and when
the intersection is empty it reports `ResolutionImpossible` rather than nesting.

**★ Why is an exact pin in a published library worse than a narrow range?**
Because a point set cannot grow. A range like `>=2.4,<3` intersects non-emptily with many other ranges, and
new releases inside it keep the intersection alive; `==2.3.1` intersects only with ranges that happen to
contain that exact release, and no future release can change that. It also blocks security fixes by
construction — the spec's phrasing is *"greatly complicates the deployment of security fixes"* — and PyPA
calls pinning in published metadata *"overly-restrictive"*. The library gets nothing in return: its own
reproducibility comes from its own lock, which consumers never read.

**★ Walk through diagnosing a `ResolutionImpossible` in a real project.**
Read the error first — it names both requirers and both constraints under *"The conflict is caused by:"*,
which is usually enough to identify the shared package. Then work pip's ladder in order: audit and remove
unneeded top-level requirements; loosen your own pins, because *"you have been too strict when you specified
the package version"* is the commonest cause; if the conflict is inside a dependency, ask the maintainer or
fork; and finally accept that some graphs have no solution. Only after that reach for a local override,
because an override *"ignore[s] all declared requirements"* for that package and moves the risk from the
resolver to you.

**★ A lockfile lists `numpy` three times. Is the project broken?**
No — it is a universal resolution with marker-separated forks, one per Python version or platform, and any
single installation selects exactly one. uv's own example shows `numpy==1.24.4` for Python 3.8,
`numpy==2.0.2` for 3.9 and `numpy==2.2.0` for 3.10+, reflecting that *"NumPy 2.2.0 and later require at
least Python 3.10"*. If you would rather all environments run identical code, `--fork-strategy fewest`
*"minimize[s] the number of selected versions for each package, preferring older versions that are
compatible with a wider range"* — at the cost of being behind on the newer platforms.

**★ When is an override the right answer rather than a workaround?**
When you have *evidence* the metadata is wrong and you cannot wait for upstream: uv describes overrides as
for cases *"in which you know that a dependency is compatible with a certain version of a package, despite
the metadata indicating otherwise"*, and the canonical example is an erroneous upper bound — a dependency
declaring `pydantic>=1.0,<2.0` that in fact works with 2.x. The two things that make it defensible are that
you have tested the combination, and that you have opened the upstream issue. What makes it dangerous is
that an override *replaces* the requirement unconditionally — *"if a package has a dependency with a marker,
it is replaced unconditionally when using overrides — it does not matter if the marker evaluates to true or
false"* — so it can silently mask a real incompatibility on a platform you do not test.

---

← [14 · Roles, not project types](14-roles-not-project-types.md) · [Topic index](README.md) · Next → [16 · `requires-python` constrains everything](16-requires-python-constrains-everything.md)
