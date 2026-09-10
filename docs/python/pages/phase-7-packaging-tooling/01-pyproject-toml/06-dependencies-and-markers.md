---
title: "Every string in dependencies is a four-part grammar — name, extras, version specifier, environment marker — and shipping the result of a condition instead of the condition itself is the mistake that makes a wheel correct on exactly one machine"
sidebar_label: "06 · dependencies and markers"
sidebar_position: 6
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-10 against the PyPA *Dependency specifiers* specification ([packaging.python.org](https://packaging.python.org/en/latest/specifications/dependency-specifiers/)), the *pyproject.toml specification* ([packaging.python.org](https://packaging.python.org/en/latest/specifications/pyproject-toml/)), *Version specifiers* ([packaging.python.org](https://packaging.python.org/en/latest/specifications/version-specifiers/)), *Core metadata specifications* ([packaging.python.org](https://packaging.python.org/en/latest/specifications/core-metadata/)), and hatch's *Metadata* configuration reference ([hatch.pypa.io](https://hatch.pypa.io/latest/config/metadata/)).
> Target: **Python 3.14.7**. Documentation-validated — **no sandbox run, no program output**.

**`dependencies` is a flat array of strings, and each string is a miniature language with a published grammar. Getting the grammar wrong is not usually a parse error — it is a dependency that resolves to something you did not mean, on a platform you never tested. The single most valuable thing on this page is the environment marker: a marker ships the *condition* in the metadata so the installer evaluates it on the target machine, which is exactly what a `setup.py` branching on `sys.platform` could not do, because it shipped the *answer* it computed on the build machine.**

## The grammar, verbatim

The dependency-specifiers specification gives the shape directly:

```
name_req = name wsp* extras? wsp* versionspec? wsp* quoted_marker?
quoted_marker = ';' wsp* marker
url_req = name wsp* extras? wsp* urlspec
```

Four optional parts after the name, in a fixed order. In `[project]`:

> *"Each string represents a dependency of the project and MUST be formatted as a valid dependency specifier."*

> *"Each string maps directly to a Requires-Dist entry."*

That mapping is the whole story: a `dependencies` array of five strings produces five `Requires-Dist` lines in the built metadata, and installers read those, not your `pyproject.toml`.

```toml
[project]
dependencies = [
    "httpx",                                        # name only
    "pydantic>=2.9,<3",                             # name + version specifier
    "celery[redis]>=5.4",                           # name + extras + specifier
    "uvloop>=0.20; sys_platform != 'win32'",        # name + specifier + marker
    "tzdata; sys_platform == 'win32'",              # name + marker
]
```

⚠️ **Order matters and the marker is last.** `"httpx; python_version >= '3.12' >=0.28"` is not a valid specifier. The semicolon terminates everything before it: *"quoted_marker = ';' wsp* marker"*.

## Version specifiers: which operator says what you mean

| Operator | Means | Use it when |
|---|---|---|
| `>=2.9` | at least 2.9, no ceiling | almost always, for a library |
| `>=2.9,<3` | at least 2.9, below 3 | the dependency uses SemVer and you have read its breaking-change policy |
| `~=2.9` | `>=2.9, ==2.*` | you want the major pinned and cannot be bothered writing it out |
| `~=2.9.1` | `>=2.9.1, ==2.9.*` | you want the *minor* pinned — note the difference from the row above |
| `==2.9.1` | exactly this | an application with a lockfile, or a workaround for a known-bad release |
| `==2.9.*` | any 2.9 patch | prefix matching, per the spec |
| `!=2.9.3` | anything but that release | one release is broken and you cannot wait for the next |

The compatible-release operator is defined mechanically:

> *"For a given release identifier `V.N`, the compatible release clause is approximately equivalent to the pair of comparison clauses: `>= V.N, == V.*`"*

with the spec's own worked case: `~= 2.2` is equivalent to `>= 2.2, == 2.*`. Prefix matching is separate:

> *"Prefix matching may be requested instead of strict comparison, by appending a trailing `.*` to the version identifier in the version matching clause."*

And the rule that explains "why did it not pick the release candidate":

> *"Pre-releases of any kind, including developmental releases, are implicitly excluded from all version specifiers, _unless_ they are already present on the system, explicitly requested by the user, or if the only available version that satisfies the version specifier is a pre-release."*

Read that last clause carefully: if the *only* satisfying version is a pre-release, you get the pre-release. A specifier like `>=3.0` on a package whose only 3.x release is `3.0.0rc1` installs the release candidate, silently.

⚠️ **Whether to put a ceiling on a library dependency is a policy question, not a syntax question**, and it belongs to **03 · Dependencies done right** *(not written yet)*. The one-line version: an application pins through a lockfile and leaves ranges open in `pyproject.toml`; a library that caps its dependencies makes itself unco-installable with everything else that capped differently.

## Environment markers: ship the condition, not the answer

The specification tables the marker variables. The ones you will actually use:

| Marker | Type | Example values (from the spec) |
|---|---|---|
| `python_version` | Version | `3.9`, `3.15` |
| `sys_platform` | String | `linux`, `win32`, `darwin` |
| `platform_machine` | String | `x86_64`, `aarch64` |
| `os_name` | String | `posix`, `java` |
| `extra` | Special | the extra currently being installed |

```toml
[project]
dependencies = [
    "uvloop>=0.20; sys_platform != 'win32'",
    "tzdata; sys_platform == 'win32'",
    "exceptiongroup>=1.2; python_version < '3.11'",
    "pywin32>=306; sys_platform == 'win32' and platform_machine == 'AMD64'",
]
```

Every one of those is evaluated **on the installing machine, at install time**. The wheel is identical everywhere; the resolution is not. That is the property `setup.py` could not have.

Markers combine with `and`, `or` and parentheses, and compare with `==`, `!=`, `<`, `>`, `<=`, `>=`, `in` and `not in`. String values must be quoted; the marker *names* must not be.

### `python_version` is not `python_full_version`

`python_version` is the `major.minor` string — `"3.14"`. `python_full_version` includes the patch and any pre-release suffix — `"3.14.7"`. Comparing `python_version` to `"3.14.7"` compares two versions of unequal length and will not do what you expect; comparing `python_full_version >= "3.14.0"` is the precise form. Reach for `python_full_version` only when a patch release genuinely matters.

### `extra` is the marker that makes extras work

> *"extra == "name" in a dependency declaration is similar to "name" in extras, while extra != "name" is similar to "name" not in extras."*

You almost never write this yourself. It is what a backend inserts when it converts `[project.optional-dependencies]` into `Requires-Dist` lines — see **[07 · Extras and dependency groups](07-extras-and-dependency-groups.md)** — and it is why an extra's dependencies are inert until the extra is requested.

⚠️ The spec also warns about newer marker variables in published metadata:

> *"publishing tools SHOULD emit an error if projects attempt to reference the extras or dependency_groups fields in their published dependency declaration metadata"*

Those two markers exist for local resolution, not for wire metadata.

## Direct URL references, and why your backend refuses them

The grammar's second production is `url_req = name wsp* extras? wsp* urlspec`:

```toml
[project]
dependencies = [
    "internal-sdk @ https://artifacts.example.com/internal_sdk-2.1.0-py3-none-any.whl",
    "patched-lib @ git+https://github.com/example/patched-lib@v1.4.2",
]
```

This is legal specifier syntax. It is also a landmine, and hatchling blocks it by default:

> *"By default, dependencies are not allowed to define direct references. To disable this check, set `allow-direct-references` to `true`"*
> — [hatch.pypa.io, Metadata](https://hatch.pypa.io/latest/config/metadata/)

```toml
[tool.hatch.metadata]
allow-direct-references = true
```

Why the guard exists: a URL dependency is unresolvable by anyone without access to that URL, is unversioned from the resolver's point of view, and cannot be substituted by an index mirror or a proxy. It is right for a private application built inside your own network and wrong for anything published.

⚠️ I could **not** confirm from the dependency-specifiers specification that PyPI rejects uploads containing direct URL references — that page does not say so. Treat "PyPI will refuse it" as widely-reported behaviour I did not verify here, and treat `allow-direct-references` as the documented fact.

## Reading a `Requires-Dist` line back

Because the mapping is direct, the metadata in an installed distribution is the fastest way to check what your file actually declared:

```python
from importlib.metadata import metadata

md = metadata("invoice-service")
for line in md.get_all("Requires-Dist") or []:
    print(line)
```

That reads the *installed* metadata, which is the thing resolvers see — not your source file, and not your lockfile. If a marker is missing or an extra ended up in the wrong place, this is where it shows.

## Gotchas

**★ Symptom: a Windows user reports `ModuleNotFoundError: No module named 'uvloop'` from your package.** Cause: you conditionally imported `uvloop` in code but declared it unconditionally, or the reverse — declared it with a marker excluding Windows while importing it unguarded. Fix: the marker in metadata and the guard in code must agree.

```toml
[project]
dependencies = ["uvloop>=0.20; sys_platform != 'win32'"]
```

```python
import sys

if sys.platform != "win32":
    import uvloop
    uvloop.install()
```

**★ Symptom: a dependency resolves to a release candidate you never asked for.** Cause: the specifier's only satisfying version is a pre-release, and the spec allows it *"if the only available version that satisfies the version specifier is a pre-release."* Fix: exclude it explicitly rather than hoping.

```toml
[project]
dependencies = ["some-lib>=3.0,!=3.0.0rc1"]
```

**★ Symptom: `~=2.9.1` behaves nothing like `~=2.9`.** Cause: the compatible-release clause expands relative to the number of components you wrote — `~=2.9` is `>=2.9, ==2.*`, `~=2.9.1` is `>=2.9.1, ==2.9.*`. Fix: write the two clauses out and never rely on remembering which component `~=` pins.

```toml
[project]
dependencies = ["pydantic>=2.9,<3"]
```

**★ Symptom: your specifier string is rejected with a parse error and looks fine.** Cause: the marker is not last, or the version follows the semicolon. Fix: the order is name, extras, version, `;`, marker — always.

```toml
[project]
dependencies = ["celery[redis]>=5.4; python_version >= '3.12'"]
```

**★ Symptom: `python_version >= '3.10'` matches on a machine you expected it not to.** Cause: markers compare *versions*, not strings, so `'3.9'` versus `'3.10'` compares numerically — which is what you want — but a value with three components compared against a two-component marker does not. Fix: compare `python_version` against `major.minor` only, and use `python_full_version` when the patch matters.

```toml
[project]
dependencies = ["some-lib>=1.0; python_full_version >= '3.12.4'"]
```

**★ Symptom: hatchling fails the build with a direct-reference error on a dependency that worked under setuptools.** Cause: hatchling's default — *"dependencies are not allowed to define direct references"*. Fix: opt in deliberately, and only for a project you are not publishing.

```toml
[tool.hatch.metadata]
allow-direct-references = true
```

**★ Symptom: a git dependency installs a different commit on every machine.** Cause: `git+https://…/lib@main` is a moving target; the resolver has no version to compare and no cache key to trust. Fix: pin to an immutable ref, and prefer a private index over a VCS URL for anything more than a stopgap.

```toml
[project]
dependencies = ["patched-lib @ git+https://github.com/example/patched-lib@8f3a21c"]
```

**★ Symptom: a dependency you removed from `pyproject.toml` is still importable, and CI passes.** Cause: your environment still has it because something else pulled it in, or because you never recreated the venv. Metadata and environment are different things; nothing prunes on edit. Fix: recreate the environment from the file rather than trusting the one you have.

**★ Symptom: TOML rejects your marker with a quoting error.** Cause: a double-quoted TOML string containing double-quoted marker values. Fix: single quotes inside double quotes, which is why every example on this page reads `sys_platform == 'win32'`.

```toml
[project]
dependencies = ["tzdata; sys_platform == 'win32'"]
```

**★ Symptom: you add `extras` or `dependency_groups` markers to a published package's dependencies and a publishing tool complains.** Cause: the spec instructs exactly that — *"publishing tools SHOULD emit an error if projects attempt to reference the extras or dependency_groups fields in their published dependency declaration metadata."* Fix: those markers are for local resolution; express the same intent with `[project.optional-dependencies]` if it must be published.

**★ Symptom: a dependency is listed twice with different specifiers and no tool complains.** Cause: `dependencies` is an array, not a mapping — `["httpx>=0.28", "httpx<1"]` produces two `Requires-Dist` lines, and a resolver intersects them. It works, but a human reading the file sees two facts and cannot tell which is current. Fix: one entry per project, with the clauses comma-joined in one string.

```toml
[project]
dependencies = ["httpx>=0.28,<1"]
```

## Interview questions

**★ What is the practical difference between an environment marker and a conditional in `setup.py`?**
A marker ships the condition; a conditional in `setup.py` ships the result. `install_requires=["pywin32"] if sys.platform == "win32" else []` is evaluated once, on the machine that built the artifact, and what ends up in the metadata is either `pywin32` or nothing — with no record that the choice was conditional. A marker like `"pywin32; sys_platform == 'win32'"` becomes a `Requires-Dist` line containing the condition itself, so the installer evaluates it on the target. One wheel is then correct on every platform, which is the property that makes universal wheels possible at all.

**★ `~=1.4` or `>=1.4,<2` — is there a reason to prefer one?**
They mean the same thing, so the reason is entirely about how a human reads them. `>=1.4,<2` states both bounds where you can see them; `~=1.4` states one and implies the other by a rule that changes depending on how many components you wrote, which is why `~=1.4.2` silently means `>=1.4.2,==1.4.*` and excludes 1.5. In a file that outlives your memory of the operator's expansion, the explicit form is cheaper to audit. `~=` earns its place mainly in generated files where nobody reads it.

**★ Why is a direct URL dependency dangerous in a published package?**
Because it removes the resolver's ability to do its job. There is no version to compare, so no upgrade path and no conflict detection; the URL is not on any index, so a mirror, proxy or offline install cannot serve it; and anyone without network access to that host cannot install your package at all. Hatchling encodes the judgement in its default — *"dependencies are not allowed to define direct references"* — and makes you set `allow-direct-references = true` to override. Inside a private application with a lockfile, that override is reasonable. In something you upload, it is a package that only works for you.

**★ Someone writes `"httpx>=0.28"` and `"httpx<1"` as two array entries. Is that wrong?**
Not mechanically — each becomes its own `Requires-Dist` line and a resolver intersects them into `>=0.28,<1`. It is wrong as *documentation*: a reviewer scanning the array sees two independent-looking constraints, a `grep` for the package returns two hits with different answers, and an edit to one is easy to make without noticing the other. One entry per distribution, with the clauses joined by commas inside a single string, is the form that stays readable.

**★ Where does `extra == "name"` come from, given that you rarely write it?**
It is the mechanism behind `[project.optional-dependencies]`. The backend takes each entry under an extra and emits a `Requires-Dist` line with an `extra == "<that extra>"` marker appended, so the dependency is present in the metadata but evaluates false unless the extra is requested. The spec describes the semantics as *"extra == "name" in a dependency declaration is similar to "name" in extras"*. This is also why extras can only add dependencies and never remove or change them: the only tool available is a marker on an additional line.

**★ Why did a package install a `3.0.0rc1` when the specifier was just `>=3.0`?**
Because the pre-release exclusion is conditional. Pre-releases are *"implicitly excluded from all version specifiers"* — unless one of three escape clauses applies, the third being that the only available satisfying version is itself a pre-release. If the project has published `2.9.5` and `3.0.0rc1` and nothing else in the 3.x line, then `>=3.0` has exactly one candidate and it is the release candidate. The defence is an explicit exclusion, not a tighter lower bound.

**★ How would you verify what your `dependencies` array actually produced?**
Read the built metadata rather than the source file, because the backend sits between them: `importlib.metadata.metadata("your-package").get_all("Requires-Dist")` returns the exact lines a resolver sees, with the markers a backend added for extras already in place. Checking the source file only tells you what you asked for; checking `Requires-Dist` tells you what shipped — and those differ whenever a `dynamic` mechanism, an extra, or a backend default is involved.

---

← Prev: [05 · description and readme](05-description-and-readme.md) · [Topic index](README.md) · Next → [07 · Extras and dependency groups](07-extras-and-dependency-groups.md)
