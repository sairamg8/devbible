---
title: "version is required but may be dynamic, requires-python is optional but is the only field that actually stops an install on the wrong interpreter, and the classifiers everyone writes instead do nothing at all"
sidebar_label: "04 · version and requires-python"
sidebar_position: 4
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-10 against the PyPA *pyproject.toml specification* ([packaging.python.org](https://packaging.python.org/en/latest/specifications/pyproject-toml/)), *Version specifiers* ([packaging.python.org](https://packaging.python.org/en/latest/specifications/version-specifiers/)), *Core metadata specifications* ([packaging.python.org](https://packaging.python.org/en/latest/specifications/core-metadata/)), and *Writing your pyproject.toml* ([packaging.python.org](https://packaging.python.org/en/latest/guides/writing-pyproject-toml/)).
> Target: **Python 3.14.7**. Documentation-validated — **no sandbox run, no program output**.

**Two fields, two completely different jobs, and both are routinely got wrong in the same file. `version` is the identity of one release and is the *only* required key the specification lets you defer to the build backend. `requires-python` is a constraint on the interpreter, it is optional, and it is the sole mechanism that will actually prevent your package being installed on Python 3.9 — the `Programming Language :: Python :: 3.12` classifier you also wrote is, in the packaging guide's own words, used only for searching and browsing on PyPI. Getting the second wrong is worse than leaving it out, because an over-tight upper bound on the interpreter propagates to every consumer's resolver and cannot be overridden by them.**

## `version` — required, but may be deferred

The specification separates "required" from "static":

> *"The keys which are required but may be specified _either_ statically or listed as dynamic are: * `version`"*

> *"The version of the project, as defined in the Version specifier specification."*

So both of these are valid, and exactly one of them may appear:

```toml
[project]
name = "invoice-service"
version = "0.4.2"
```

```toml
[project]
name = "invoice-service"
dynamic = ["version"]

[tool.hatch.version]
path = "src/invoice_service/__about__.py"
```

Hatch documents the second half of that:

> *"When the version is not statically set, configuration is defined in the `tool.hatch.version` table."*

Under setuptools the equivalent lives in its own dynamic table:

```toml
[project]
name = "invoice-service"
dynamic = ["version"]

[tool.setuptools.dynamic]
version = { attr = "invoice_service.__version__" }
```

> *"When these fields are expected to be provided by `setuptools` a corresponding entry is required in the `tool.setuptools.dynamic` table. For example: version = {attr = "my_package.__version__"} [and] readme = {file = ["README.rst", "USAGE.rst"]}"*
> — [setuptools, Configuring setuptools using pyproject.toml](https://setuptools.pypa.io/en/latest/userguide/pyproject_config.html)

Flit derives it from the module instead:

> *"If you want Flit to get this from a `__version__` attribute, leave it out of the TOML config and include "version" in the `dynamic` field."*
> — [flit.pypa.io](https://flit.pypa.io/en/stable/pyproject_toml.html)

Three backends, three mechanisms, one spec-level contract: the key is absent from `[project]` and present in `dynamic`. The full rules for `dynamic` — including what happens when you get this pairing half right — are in **[13 · Dynamic metadata](13-dynamic-metadata.md)**.

⚠️ `Version` is also one of the fields the core metadata spec says *"may not be specified"* in the `Dynamic` metadata field. That is not a contradiction: `dynamic` in `pyproject.toml` says *the backend will fill this in*; `Dynamic` in built metadata says *this may still change*. The version is settled by the time a wheel exists, so it is never `Dynamic` in the artifact even when it was `dynamic` in the source.

### The static-version trade-off

| Choice | You get | You pay |
|---|---|---|
| static `version = "0.4.2"` | one obvious source of truth; readable in a diff; no backend magic | a commit per release; two places to edit if your code also exposes `__version__` |
| `dynamic` from a module attribute | `__version__` and the metadata cannot disagree | the backend must read your source; a syntax error in that file becomes a build failure |
| `dynamic` from VCS tags | releases are tags, nothing to edit | an sdist built outside a git checkout has no tags to read; CI must fetch tags, not just the tip commit |

There is no wrong answer here, but there is a wrong *combination*: a static `version` in `[project]` **and** a `__version__` in your code that you update by hand. That is two sources of truth with no mechanism keeping them equal. Pick one to be authoritative and derive the other:

```python
# src/invoice_service/__init__.py — metadata is authoritative, code reads it
from importlib.metadata import version

__version__ = version("invoice-service")
```

## `requires-python` — the only interpreter gate that works

In `[project]`:

> *"The Python version requirements of the project."*

It maps to the `Requires-Python` core metadata field, described as:

> *"This field specifies the Python version(s) that the distribution is compatible with. Installation tools may look at this when picking which version of a project to install."*

⚠️ Note "may". I could not find a primary sentence stating that installers **MUST** refuse a distribution whose `Requires-Python` does not match the running interpreter; the core metadata wording is permissive. In practice pip and uv both skip non-matching distributions, but treat the *specification-level* guarantee as "installers are told to look at this", not "installation is impossible".

### The classifier does nothing, and the docs say so

This is the single most valuable sentence in the packaging guide:

> *"Although the list of classifiers is often used to declare what Python versions a project supports, this information is only used for searching and browsing projects on PyPI, not for installing projects. To actually restrict what Python versions a project can be installed on, use the `requires-python` argument."*

So this file is a trap:

```toml
[project]
name = "invoice-service"
version = "0.4.2"
classifiers = [
    "Programming Language :: Python :: 3.12",
    "Programming Language :: Python :: 3.13",
]
# 🔴 no requires-python — this installs happily on Python 3.8 and fails at import
```

and this is the fix:

```toml
[project]
name = "invoice-service"
version = "0.4.2"
requires-python = ">=3.12"
classifiers = [
    "Programming Language :: Python :: 3.12",
    "Programming Language :: Python :: 3.13",
    "Programming Language :: Python :: 3.14",
]
```

The classifiers are still worth writing — they are how humans and PyPI's filters find you — but they are documentation, and `requires-python` is enforcement.

## Which specifier to write

`requires-python` takes a version specifier, so all the PEP 440 operators are available. Three of them matter here.

**`>=3.12`** — a floor, no ceiling. What you want for almost every project.

**`>=3.12,<3.15`** — a floor and a ceiling. Rarely right, and expensive when wrong. The day 3.15 ships, every consumer of your package on 3.15 cannot install it, and they cannot override you. If you depend on a CPython implementation detail that genuinely breaks each release, this is honest; otherwise it is a promise you have to keep releasing to maintain.

**`~=3.12`** — almost never what you mean. The compatible-release operator expands mechanically:

> *"For a given release identifier `V.N`, the compatible release clause is approximately equivalent to the pair of comparison clauses: `>= V.N, == V.*`"*

with the spec's own example: `~= 2.2` is equivalent to `>= 2.2, == 2.*`. Applied to a Python version, `~=3.12` means `>=3.12, ==3.*` — which happens to be fine, but `~=3.12.0` means `>=3.12.0, ==3.12.*` and locks you to the 3.12 series. Two characters, an entirely different constraint.

Two more spec facts that bite:

> *"Prefix matching may be requested instead of strict comparison, by appending a trailing `.*` to the version identifier in the version matching clause."*

> *"Pre-releases of any kind, including developmental releases, are implicitly excluded from all version specifiers, _unless_ they are already present on the system, explicitly requested by the user, or if the only available version that satisfies the version specifier is a pre-release."*

The second one is the answer to "why does my package refuse to install on the 3.15 alpha": a pre-release interpreter is not matched by a plain specifier unless the pre-release is already what you are running — which, for the interpreter itself, it is. Testing against pre-release *dependencies*, by contrast, needs an explicit opt-in.

## Version numbers you should not invent

`version` must be a valid PEP 440 version, and PEP 440 is stricter than intuition:

| You write | What happens |
|---|---|
| `1.0` | valid, normalises to `1.0` |
| `1.0.0` | valid, and **not equal** to `1.0` as a string but equal as a version |
| `v1.0.0` | the leading `v` is tolerated and stripped by normalisation |
| `1.0.0-beta.1` | ⚠️ SemVer, not PEP 440 — the PEP 440 form is `1.0.0b1` |
| `1.0.0+build.5` | valid: `+` introduces a local version, which PyPI refuses to accept for upload |
| `2026.09.10` | valid — date-based versioning is legal and normalises to `2026.9.10` |

The trap is `1.0.0-beta.1`. If you have SemVer habits, the hyphenated pre-release form is the one PEP 440 spells differently, and a backend may either reject it or normalise it into something you did not intend.

## Gotchas

**★ Symptom: your package installs on Python 3.9 and immediately raises `SyntaxError` on a `match` statement.** Cause: you declared supported versions with classifiers only, which the packaging guide says are *"only used for searching and browsing projects on PyPI, not for installing projects."* Fix: add the field that is actually consulted.

```toml
[project]
requires-python = ">=3.10"
```

**★ Symptom: consumers on the newest Python cannot install your package at all, and there is nothing they can do about it.** Cause: `requires-python = ">=3.11,<3.14"`. An upper bound is a claim about a version that did not exist when you wrote it, and it is not overridable downstream — the resolver simply has no candidate. Fix: drop the ceiling unless a specific, named incompatibility justifies it, and if it does, say so where a reader will look.

```toml
[project]
requires-python = ">=3.11"
```

**★ Symptom: `pip install .` fails with a version parse error on a version you copied from your CHANGELOG.** Cause: SemVer's `1.2.0-rc.1` is not a PEP 440 version. Fix: use the PEP 440 spelling.

```toml
[project]
version = "1.2.0rc1"
```

**★ Symptom: PyPI rejects your upload with a complaint about a local version.** Cause: a `+something` suffix. `1.4.2+dirty` and `0.1.0+g8f3a21` are valid PEP 440 versions and are exactly what a VCS-derived version produces on an untagged commit. Fix: tag before releasing, or configure the backend's version source to strip the local segment for release builds. Do not hand-edit the artifact.

**★ Symptom: `version` is dynamic, the build works locally, and CI fails saying it cannot determine a version.** Cause: a VCS version source with no tags available — a shallow clone or a tarball has no `.git` history to read. Fix: fetch tags in CI, or build from an sdist that already has the version baked in.

```yaml
# .github/workflows/release.yml — the fetch-depth that matters
- uses: actions/checkout@v4
  with:
    fetch-depth: 0        # 0 = full history + tags; the default 1 has neither
```

**★ Symptom: `__version__` in your code and the installed metadata version disagree.** Cause: two independent sources of truth, both maintained by hand. Fix: make one derive from the other rather than keeping them in sync.

```python
from importlib.metadata import version
__version__ = version("invoice-service")
```

**★ Symptom: `requires-python = "3.12"` is accepted and matches almost nothing.** Cause: a bare version in a specifier context is not "3.12 or later"; a specifier needs an operator, and some tools read a bare version as an exact match. Fix: always write the operator explicitly.

```toml
[project]
requires-python = ">=3.12"
```

**★ Symptom: you set `requires-python = "~=3.12.0"` intending "3.12 and up" and locked yourself to the 3.12 series.** Cause: the compatible-release operator expands to *"`>= V.N, == V.*`"* — so `~=3.12.0` becomes `>=3.12.0, ==3.12.*`, which excludes 3.13. Fix: `>=3.12` if you mean a floor; `~=3.12` (one component shorter) if you really mean "any 3.x from 3.12".

**★ Symptom: an old release of your package is being installed on a new Python instead of the latest one.** Cause: this is `requires-python` working as designed — the resolver skipped the newer releases because their `Requires-Python` excluded the running interpreter, and fell back to the last release that did not. Fix: nothing to fix in the consumer's file; if the fallback is wrong, the old release's metadata needs a yank, because published metadata is immutable.

**★ Symptom: your date-based version sorts wrongly.** Cause: PEP 440 normalises away leading zeros, so `2026.09.10` becomes `2026.9.10`, and comparisons are numeric per component rather than lexical. That is usually what you want, but any tooling of yours that compares version *strings* will disagree with the resolver. Fix: compare with a version parser, never with string comparison.

## Interview questions

**★ Why is `version` allowed to be dynamic when `name` is not?**
Because they are needed at different times. `name` is the key every index page, lockfile entry and installed-package record is filed under, all of which exist before a build — a computed name would make a package's identity depend on building it. `version` is only meaningful once you have a specific artifact, and by then the backend has already run and written the number into the metadata. That is also why `Version` appears among the core metadata fields that may not be listed as `Dynamic` in a built distribution: dynamic in the *source* is compatible with fixed in the *artifact*.

**★ A project declares `Programming Language :: Python :: 3.12` and nothing else about versions. What actually happens on Python 3.8?**
It installs, and then fails at runtime or import time with whatever syntax or stdlib feature is missing. The packaging guide states that classifier information is *"only used for searching and browsing projects on PyPI, not for installing projects"* — no installer consults it as a constraint. The only field that changes install behaviour is `requires-python`, and its absence means "any interpreter".

**★ Why is an upper bound on `requires-python` considered harmful when an upper bound on a dependency is normal practice?**
Because of who can fix it. If you cap a library dependency too tightly, a consumer can override you — pin a different version, patch the constraint, vendor the package. There is no equivalent escape for `requires-python`: the resolver has no candidate distribution for their interpreter, so their only options are to run an older Python or stop using your package. The asymmetry also runs the wrong way in time: an upper bound is a claim about versions of CPython that did not exist when you made it, so it is guaranteed to be wrong eventually and requires a release to correct.

**★ What does `~=3.12` mean, and why is it a poor fit for `requires-python`?**
The compatible-release operator expands to *"`>= V.N, == V.*`"* for a given `V.N`, so `~=3.12` is `>=3.12, ==3.*`. That is not disastrous, but it is an accidental upper bound on the major version, and the near-identical `~=3.12.0` expands to `>=3.12.0, ==3.12.*`, which excludes 3.13 entirely. Since almost every project means a plain floor, `>=3.12` says it exactly and cannot be misread — and it is the form that does not silently change meaning when someone appends a patch component.

**★ Where does a version live if you want exactly one source of truth?**
In `pyproject.toml`, statically, with your code reading it back through `importlib.metadata.version()`. That way the metadata in the artifact is authoritative and the runtime attribute cannot drift. The mirror-image arrangement — the module attribute is authoritative and the backend reads it via `dynamic` — is equally valid, and is what `[tool.setuptools.dynamic] version = {attr = ...}` and flit's `__version__` convention exist for. The only broken arrangement is the one where both are typed by hand.

**★ Why does your package refuse to install on a Python pre-release?**
Because version specifiers exclude pre-releases by default: *"Pre-releases of any kind, including developmental releases, are implicitly excluded from all version specifiers, unless they are already present on the system, explicitly requested by the user, or if the only available version that satisfies the version specifier is a pre-release."* For the interpreter itself the "already present on the system" clause normally applies, so a plain `>=3.12` does match a 3.15 alpha — but a specifier written with an explicit ceiling, or a dependency's own pre-release, still needs an opt-in. If you want to test against pre-release *dependencies*, that is an installer flag, not a metadata change.

**★ Is `1.0` the same version as `1.0.0`?**
As strings, no; as PEP 440 versions, yes — comparison is component-wise with missing trailing components treated as zero, so they are equal and either will satisfy `==1.0`. This matters when your own code compares versions: any string comparison of version numbers will eventually disagree with the resolver, most obviously on `1.10` versus `1.9`. Parse before you compare.

---

← Prev: [03 · name and normalization](03-the-project-name-and-normalization.md) · [Topic index](README.md) · Next → [05 · description and readme](05-description-and-readme.md)
