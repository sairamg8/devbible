---
title: "An unknown marker field takes the whole package version out of consideration rather than guessing True or False — and two marker fields exist that a lock file may use and a published library may not"
sidebar_label: "12 · Marker fields and portability"
sidebar_position: 12
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-10 against the PyPA **Dependency specifiers** specification
> ([packaging.python.org](https://packaging.python.org/en/latest/specifications/dependency-specifiers/)),
> **PEP 508** ([peps.python.org](https://peps.python.org/pep-0508/)), **PEP 751**
> ([peps.python.org](https://peps.python.org/pep-0751/)) and uv's **Resolution** concepts
> ([docs.astral.sh](https://docs.astral.sh/uv/concepts/resolution/), **uv 0.12.12**). Target:
> **Python 3.14.7**. Documentation-verified, **no sandbox run**.

**Two things about markers do not fit on the operator page, and both are about *forward
compatibility*. First: what happens when an installer meets a marker field it has never heard of —
the answer is neither True nor False, but "this package version is now ineligible", and the
specification explains at length why both simpler answers are worse. Second: the marker language
grew set-valued fields (`extras`, `dependency_groups`) that only a lock file may use, precisely so
that an older installer reading published metadata never meets one. Together they are the reason a
universal, cross-platform lockfile is expressible at all.**

## Unknown fields make a package ineligible, not False

> *"References to unknown marker fields SHOULD render a package version ineligible for installation or
> inclusion in a locked dependency tree rather than resulting in a comparison that evaluates to True or
> False. This is so that published package versions with unknown marker fields are either ignored when
> resolving dependencies or emit a descriptive installation failure, rather than producing an apparently
> successful installation that then fails at runtime due to missing dependencies (if the unknown marker is
> treated as False) or a potentially cryptic installation failure of a dependency that is not valid for the
> current platform (if the unknown marker is treated as True)."*

That single paragraph is the marker system's design philosophy in miniature. Both naive answers produce a
**quiet** wrong outcome; making the version ineligible produces a **loud** one — either an older version is
selected, or the install fails with a message about the version rather than about a dependency you have
never heard of.

PEP 508's original rule was blunter — *"Unknown variables must raise an error rather than resulting in a
comparison that evaluates to True or False"* — and the canonical spec's refinement is the more useful
behaviour, because it lets a resolver keep going by choosing a different version.

For fields that *are* known but cannot be computed on a given runtime:

> *"Variables whose value cannot be calculated on a given Python implementation should evaluate to `0` for
> Version fields, and an empty string for all other variables (including Version | String fields)."*

So a marker comparing `platform_release` on an exotic implementation may be comparing against `""`, which
is well-defined and almost never what the author intended. Prefer `sys_platform`, which the spec calls
*"the most well defined field for use when declaring platform specific dependencies"*.

## `extra`, `extras` and `dependency_groups`

Three special fields, all carrying the caveat *"ONLY when defined by a containing layer"* in the grammar:

> *"`extra` — Used to indicate optional dependencies in project dependency metadata. An error except when
> defined by the context interpreting the specifier."*

> *"`extras` — Used to indicate optional public dependencies in lock files."*
> *"`dependency_groups` — Used to indicate optional project internal dependencies in lock files."*

`extras` and `dependency_groups` are **Set of strings**, a marker field type that did not exist in PEP
508, and the only operations defined on them are containment:

> *"For Set of String fields, as there is no marker syntax for set literals, the only valid operations are
> `in` and `not in` comparisons with a user supplied string literal as the left operand. Publishing tools
> SHOULD emit an error if environment markers attempt to use any other comparison operations on these
> fields and index servers MAY disallow uploads containing such environment markers, while locking and
> installation tools SHOULD treat such operations as always being False."*

🔴 Where they may appear is restricted, and the reason is exactly the ineligibility rule above:

> *"For backwards compatibility with older locking and installation tools, the `extras` and
> `dependency_groups` fields are currently only valid for use in `packages.marker` fields in lock files.
> For these comparisons, the `extras` and `dependency_groups` sets used for the marker evaluation refer to
> the currently selected extras and dependency groups when installing from the lock file, not the full set
> of defined extras and dependency groups listed in the corresponding top level lock file fields."*

> *"Publishing tools SHOULD emit an error if projects attempt to reference the `extras` or
> `dependency_groups` fields in their published dependency declaration metadata, and index servers SHOULD
> NOT accept uploads referencing these fields. Outside lock file processing, marker evaluation environments
> DO NOT need to define these fields."*

The singular `extra` is the older, published-metadata form, and the spec spells out the correspondence:

> *"The `extra` field is also special, as it expects set-like behaviour, but predates the addition of Set of
> strings as a defined marker field type. Accordingly, `extra == "name"` in a dependency declaration is
> similar to `"name" in extras`, while `extra != "name"` is similar to `"name" not in extras`. For
> dependency marker evaluations, the set of extra names used for these comparisons is the full set of
> requested extras for that particular package, whether requested directly in a top level dependency
> declaration, or indirectly in a transitive dependency declaration."*

> *"Other comparison operations on `extra` are not defined and publishing tools SHOULD emit an error, index
> servers MAY disallow uploads containing such environment markers, while locking and installation tools
> SHOULD evaluate them as False."*

You never write `extra == "..."` by hand: the build backend generates it from
`[project.optional-dependencies]` — that mechanism is [21](21-extras.md), and the core metadata pair looks
like this:

```text
Provides-Extra: pdf
Requires-Dist: reportlab; extra == 'pdf'
```

PEP 751 is where the set-valued fields earn their keep: a single `pylock.toml` can describe several
use-cases because *"this PEP supports additions to Environment Markers that allows for specifying extras
and dependency groups as appropriate. This allows for a single lock file to support those cases."*

## Why markers are what make a lockfile portable

uv's framing of the problem:

> *"Markers are important for resolution because their values change the required dependencies. Typically,
> Python package resolvers use the markers of the current platform to determine which dependencies to use
> since the package is often being installed on the current platform. However, for locking dependencies this
> is problematic — the lockfile would only work for developers using the same platform the lockfile was
> created on. To solve this problem, platform-independent, or "universal" resolvers exist."*

> *"During universal resolution, a package may be listed multiple times with different versions or URLs if
> different versions are needed for different platforms — the markers determine which version will be used.
> A universal resolution is often more constrained than a platform-specific resolution, since we need to
> take the requirements for all markers into account."*

The cost is in that last sentence, and it is real: a universal lock can **fail** where a platform-specific
compile would have succeeded, because every marker branch must be satisfiable at once. uv's own note on
wheel-only packages:

> *"Packages that lack source distributions cause problems for universal resolution, since there will
> typically be at least one platform or Python version for which the package is not installable."*

The lever for that is narrowing the set of environments you solve for:

> *"If your project supports only a limited set of platforms or Python versions, you can constrain the set of
> solved platforms via the `environments` setting, which accepts a list of PEP 508 environment markers. In
> other words, you can use the `environments` setting to reduce the set of supported platforms."*

> *"Entries in the `environments` setting must be disjoint (i.e., they must not overlap). For example,
> `sys_platform == 'darwin'` and `sys_platform == 'linux'` are disjoint, but `sys_platform == 'darwin'` and
> `python_version >= '3.9'` are not, since both could be true at the same time."*

and its mirror image, which *widens* the requirement rather than narrowing the search:

> *"While the `environments` setting limits the set of environments that uv will consider when resolving
> dependencies, `required-environments` expands the set of platforms that uv must support when resolving
> dependencies."*

> *"For example, `environments = ["sys_platform == 'darwin'"]` would limit uv to solving for macOS (and
> ignoring Linux and Windows). On the other hand, `required-environments = ["sys_platform == 'darwin'"]`
> would require that any package without a source distribution include a wheel for macOS in order to be
> installable (and would fail if no such wheel is available)."*

```toml
# pyproject.toml — we deploy to Linux and develop on macOS; nothing runs on Windows
[tool.uv]
environments = [
    "sys_platform == 'darwin'",
    "sys_platform == 'linux'",
]

# and we still support Intel Macs, so wheel-only packages must have an x86_64 macOS wheel
required-environments = [
    "sys_platform == 'darwin' and platform_machine == 'x86_64'",
]
```

uv's note on why the second one is worth the trouble: *"In practice, `required-environments` can be useful
for declaring explicit support for non-latest platforms, since this often requires backtracking past the
latest published versions of those packages."*

## Gotchas

**★ Symptom: a package is skipped entirely, with no message about the dependency you were looking at.**
Cause: an unknown marker field somewhere in *that package's* metadata makes the whole version ineligible —
*"References to unknown marker fields SHOULD render a package version ineligible for installation or
inclusion in a locked dependency tree"*. Usually a typo (`sys_platfrom`) or a field from a newer spec than
your installer implements. Fix: upgrade the installer first, then inspect the offending metadata; the
resolver is behaving correctly by refusing to guess.

**★ Symptom: `extra == "dev"` written by hand into a dependency string is rejected.** Cause: `extra` is only
valid *"when defined by the context interpreting the specifier"* — i.e. inside `Requires-Dist` entries
generated from `[project.optional-dependencies]`. A hand-written dependency string is outside that context.
Fix: declare the extra properly and let the backend emit the marker:

```toml
[project.optional-dependencies]
pdf = ["reportlab>=4.2"]
```

**★ Symptom: `"test" in dependency_groups` in `pyproject.toml` is rejected by the build backend.** Cause:
those fields are *"currently only valid for use in `packages.marker` fields in lock files"*, and
*"Publishing tools SHOULD emit an error if projects attempt to reference the `extras` or `dependency_groups`
fields in their published dependency declaration metadata."* Fix: dependency groups are selected by the
installing tool, not by a marker in your metadata — use `[dependency-groups]` and `--group`
([22](22-dependency-groups.md)).

**★ Symptom: two markers that should be mutually exclusive both evaluate True, and a lock contains two
versions of one package.** Cause: overlapping marker sets. uv requires disjointness where it matters:
*"Entries in the `environments` setting must be disjoint"*, and its own counter-example is
`sys_platform == 'darwin'` versus `python_version >= '3.9'`. Fix: partition on one field:

```toml
[tool.uv]
environments = ["sys_platform == 'darwin'", "sys_platform == 'linux'"]
```

**★ Symptom: a marker works in a `requirements.txt` and disappears when the file is regenerated.** Cause: a
compiled requirements file is the *output* of evaluating markers for one target environment, so branches
that did not apply are gone by construction. Fix: keep the marker in `pyproject.toml`, treat the compiled
file as disposable, and regenerate per target — or use a universal lock, where the marker survives
([18](18-uv-lock-vs-pip-freeze-vs-pip-compile.md)).

**★ Symptom: `uv lock` fails on a package that installs fine with `pip`.** Cause: universal resolution must
satisfy every marker branch, and *"Packages that lack source distributions cause problems for universal
resolution, since there will typically be at least one platform or Python version for which the package is
not installable."* `pip` only had to solve for the machine it was on. Fix: narrow the solved set to the
platforms you actually support:

```toml
[tool.uv]
environments = ["sys_platform == 'linux'"]
```

**★ Symptom: a lockfile silently stops covering Intel macOS after a routine upgrade.** Cause: a wheel-only
dependency dropped that platform, and by default uv only requires *"at least one wheel that is compatible
with the target Python version"* — not one per platform. Fix: state the requirement so the next upgrade
fails instead:

```toml
[tool.uv]
required-environments = ["sys_platform == 'darwin' and platform_machine == 'x86_64'"]
```

**★ Symptom: `platform_version` comparisons behave differently on two machines running the same OS.**
Cause: it is a *Version | String* field, so *"there is no consistent cross-platform expectation that the
parsing of the marker field value or the user supplied constant as a valid version will succeed, so tools
SHOULD fall back to processing the field as a String field if parsing either value as a version fails."*
Its sample values are kernel build strings — on macOS they may parse as a version, on Linux they will not.
Fix: do not put logic on `platform_version`; use `sys_platform` and `platform_machine`.

## Interview questions

**★ Why does an unknown marker field make a package version ineligible rather than evaluating to False?**
Because both simple answers are worse, and the specification says which way each fails. Treating it as False
*"produc[es] an apparently successful installation that then fails at runtime due to missing dependencies"*;
treating it as True produces *"a potentially cryptic installation failure of a dependency that is not valid
for the current platform."* Making the version ineligible means an older, understandable version gets
selected, or the failure names the version — something you can act on. It is a deliberate preference for a
loud failure over a quiet one, and it is also what makes it safe to add new marker fields to the spec at all.

**★ How do markers make a cross-platform lockfile possible, and what does that cost?**
A universal resolver solves for *all* marker values rather than the current machine's and records the marker
beside each locked package, so one file describes every target: *"a package may be listed multiple times with
different versions or URLs if different versions are needed for different platforms — the markers determine
which version will be used."* The cost is that the resolution is harder and sometimes impossible: *"A
universal resolution is often more constrained than a platform-specific resolution, since we need to take the
requirements for all markers into account."* A package that publishes Linux wheels only will fail a universal
resolution that a Linux-only `pip-compile` would have completed — which is why `environments` exists.

**★ What are `extras` and `dependency_groups` as marker fields, and why can a library not use them?**
They are Set-of-string fields that let a *lock file* record "this package is only needed when extra X or group
Y was selected". The spec restricts them: they are *"currently only valid for use in `packages.marker` fields
in lock files"*, and *"Publishing tools SHOULD emit an error if projects attempt to reference the `extras` or
`dependency_groups` fields in their published dependency declaration metadata."* The reason is the
ineligibility rule: an older installer reading them in published metadata would treat them as unknown fields
and drop your package version. In published metadata the singular `extra` field does the equivalent job —
`extra == "name"` being *"similar to `"name" in extras`"* — and the build backend writes it for you.

**★ What is the difference between `environments` and `required-environments` in uv, and when do you reach
for each?**
`environments` *reduces* the set of platforms uv solves for; `required-environments` *expands* the set uv must
be able to install on. uv's own contrast: `environments = ["sys_platform == 'darwin'"]` limits solving to
macOS, while `required-environments = ["sys_platform == 'darwin'"]` *"would require that any package without a
source distribution include a wheel for macOS in order to be installable (and would fail if no such wheel is
available)."* Reach for `environments` when a universal resolution fails because of a platform you do not
support; reach for `required-environments` when you *do* support a platform and want the lock to fail rather
than quietly stop covering it.

**★ Why must entries in `environments` be disjoint?**
Because they partition the resolution into forks, and overlapping forks would let two different solutions both
claim the same environment — at install time the tool could not say which locked version applies. uv's example
is precise: *"`sys_platform == 'darwin'` and `sys_platform == 'linux'` are disjoint, but
`sys_platform == 'darwin'` and `python_version >= '3.9'` are not, since both could be true at the same time."*
In practice, partition on exactly one field and add other conditions with `and` inside a single entry.

---

← [11 · Environment markers](11-environment-markers.md) · [Topic index](README.md) · Next → [13 · Applications lock, libraries range](13-applications-lock-libraries-range.md)
