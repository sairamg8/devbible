---
title: "dynamic is not a feature you enable, it is a declaration that a key is deliberately absent — and the spec's MUST-level rules about honouring static metadata, forbidding a dynamic name, and appending only are what stop a backend rewriting what you wrote"
sidebar_label: "13 · dynamic metadata"
sidebar_position: 13
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-10 against the PyPA *pyproject.toml specification* ([packaging.python.org](https://packaging.python.org/en/latest/specifications/pyproject-toml/)), PEP 621 ([peps.python.org](https://peps.python.org/pep-0621/)), *Core metadata specifications* ([packaging.python.org](https://packaging.python.org/en/latest/specifications/core-metadata/)), setuptools' *Configuring setuptools using pyproject.toml* ([setuptools.pypa.io](https://setuptools.pypa.io/en/latest/userguide/pyproject_config.html)), flit's *pyproject.toml* reference ([flit.pypa.io](https://flit.pypa.io/en/stable/pyproject_toml.html)), and hatch's *Versioning* docs ([hatch.pypa.io](https://hatch.pypa.io/latest/version/)).
> Target: **Python 3.14.7**. Documentation-validated — **no sandbox run, no program output**.

**`dynamic = ["version"]` does not tell a backend to compute the version. It tells the backend that you left the key out *on purpose*, which is the only information the backend lacks — it can already see the key is missing, but it cannot tell whether that was intent or oversight. PEP 621 says exactly that: requiring dynamic to be declared "disambiguates the intent when metadata goes unspecified." Everything else about the mechanism follows from that framing, including the two half-configurations that fail: a key in `dynamic` with no backend config behind it, and a key both written statically and listed as dynamic.**

## The rule that makes static metadata trustworthy

> *"A build back-end MUST honour statically-specified metadata (which means the metadata did not list the key in `dynamic`)."*

That is the guarantee that makes `[project]` worth reading. Without it, `version = "0.4.2"` in your file would be a suggestion a backend could override, and nobody downstream could trust the file. With it, anything not in `dynamic` is final.

PEP 621 explains what `dynamic` is *for*:

> *"Specifies which fields listed by this PEP were intentionally unspecified so another tool can/will provide such metadata dynamically."*

> *"By requiring that dynamic metadata be specified, it disambiguates the intent when metadata goes unspecified"*

The packaging guide states the consequence in one line:

> *"When a field is dynamic, it is the build backend's responsibility to fill it. Consult your build backend's documentation to learn how it does it."*

So `dynamic` is a contract in two halves. `pyproject.toml` declares the intent; a `[tool.<backend>]` table supplies the mechanism. Neither half works alone.

## What may be dynamic

The specification enumerates the permitted values. As printed today:

`authors`, `classifiers`, `dependencies`, `entry-points`, `gui-scripts`, `import-names`, `import-namespaces`, `keywords`, `license-files`, `maintainers`, `optional-dependencies`, `scripts`, `urls`

plus `version`, which the spec lists separately as *"required but may be specified either statically or listed as dynamic."*

And the absolute prohibition:

> *"A build back-end MUST raise an error if the metadata specifies `name` in `dynamic`."*

The core metadata spec closes the same door from the artifact side — `Name`, `Version` and `Metadata-Version` *"may not be specified"* in the `Dynamic` field of built metadata. That is not a contradiction with `version` being dynamic in `pyproject.toml`: source-level `dynamic` means *the backend will fill this*, artifact-level `Dynamic` means *this may still change*. A version is settled once a wheel exists, so it is never `Dynamic` in the wheel even when it was `dynamic` in the source.

⚠️ `import-names` and `import-namespaces` come from PEP 794 (*Accepted*, introducing core metadata **2.5**). They appear in the spec's list today; whether your backend populates them is a per-backend question I did not verify.

## The two half-configurations that fail

**Half one — declared dynamic, never supplied.** The key is in `dynamic`, no `[tool.*]` table computes it, so the backend has been told to fill a field it has no instruction for. setuptools states its requirement plainly:

> *"When these fields are expected to be provided by `setuptools` a corresponding entry is required in the `tool.setuptools.dynamic` table."*

```toml
[project]
name = "invoice-service"
dynamic = ["version"]
# 🔴 nothing tells the backend where the version comes from
```

```toml
[project]
name = "invoice-service"
dynamic = ["version"]

[tool.setuptools.dynamic]
version = { attr = "invoice_service.__version__" }    # ✅ the other half
```

**Half two — both static and dynamic.** This is a MUST-level error for scalar keys:

> *"Build back-ends MUST raise an error if the metadata specifies a key statically as well as being listed in `dynamic`, _unless_ the key represents a list or arbitrary table that can be extended."*

```toml
[project]
name = "invoice-service"
version = "0.4.2"
dynamic = ["version"]    # 🔴 MUST be an error — both a value and a promise to compute one
```

### The append-only escape for lists and tables

For keys that *are* extensible, the spec permits both — with a strict limit on what the backend may do:

> *"When such a key is specified both statically and listed in `dynamic`: A build back-end MAY only _append_ entries to the value; it MUST NOT remove, reorder, or modify any statically-specified entries."*

```toml
[project]
name = "invoice-service"
dependencies = ["httpx>=0.28"]      # these survive, in this order
dynamic = ["dependencies"]          # the backend may add more after them
```

"MUST NOT remove, reorder, or modify" is unusually specific, and it is what makes the combination safe to read: whatever you wrote is still there, still in that order, and anything the backend contributes is additional. It is the mechanism behind patterns like a static core dependency list plus platform-specific additions computed at build time.

## The three backends, three mechanisms

**setuptools** — a dedicated dynamic table:

```toml
[project]
name = "invoice-service"
dynamic = ["version", "readme"]

[tool.setuptools.dynamic]
version = { attr = "invoice_service.__version__" }
readme = { file = ["README.md", "CHANGELOG.md"], content-type = "text/markdown" }
```

> *"For example: version = \{attr = "my_package.__version__"\} [and] readme = \{file = ["README.rst", "USAGE.rst"]\}"*

**hatchling** — its own version table:

```toml
[project]
name = "invoice-service"
dynamic = ["version"]

[tool.hatch.version]
path = "src/invoice_service/__about__.py"
```

> *"When the version is not statically set, configuration is defined in the `tool.hatch.version` table."*

⚠️ Hatch's own documentation as fetched does not spell out the requirement to list `version` in `dynamic`, and does not print the `source = "vcs"` block — I did not verify either from a primary source, so take the VCS form from hatch's version-source documentation rather than from here.

**flit-core** — convention, no configuration at all:

> *"If you want Flit to get this from a `__version__` attribute, leave it out of the TOML config and include "version" in the `dynamic` field."*

> *"If you want Flit to get this from the module docstring, leave it out of the TOML config and include "description" in the `dynamic` field."*

```toml
[project]
name = "invoice-service"
dynamic = ["version", "description"]
```

```python
# src/invoice_service/__init__.py
"""Issues, stores and reconciles customer invoices."""

__version__ = "0.4.2"
```

Three dialects, one spec-level contract: the key is absent from `[project]` and present in `dynamic`.

## When dynamic is worth it, and when it is not

| Field | Dynamic is worth it when | Cost |
|---|---|---|
| `version` | releases are git tags, or `__version__` must exist in code | an sdist built without tags has nothing to read; CI must fetch them |
| `readme` | the project page concatenates README and CHANGELOG | textual concatenation; two `H1`s, broken relative links |
| `dependencies` | requirements are generated, or a legacy `requirements.txt` is authoritative | the file no longer states its own dependencies; readers must run the backend |
| `classifiers` | generated from a supported-versions matrix | almost never worth it; classifiers rarely change |
| `entry-points` | plugins are discovered from the tree | build-time magic in the least debuggable part of the file |

The default should be static. Every dynamic field is a question whose answer is not in the file, and the whole reason `pyproject.toml` exists is that answers in the file can be read without running anything — see **[01 · The catch-22](01-the-catch-22-that-killed-setup-py.md)**. `version` earns the exception often; `dependencies` earns it rarely; the rest almost never.

## Gotchas

**★ Symptom: the build fails saying a field is missing, or that a field was declared dynamic with nothing configured to supply it.** Cause: half one — the key is in `dynamic` with no `[tool.*]` entry behind it. The message text is backend-specific and I did not verify any of them, so none is quoted here. Fix: supply the other half.

```toml
[project]
dynamic = ["version"]

[tool.setuptools.dynamic]
version = { attr = "invoice_service.__version__" }
```

**★ Symptom: the build fails when you add `dynamic = ["version"]` to a file that already has a version.** Cause: half two — a scalar key both static and dynamic, which backends MUST reject. Fix: delete one. If you want the module to be authoritative, delete the static value; if the file is authoritative, delete the `dynamic` entry.

**★ Symptom: `dynamic = ["name"]` errors with an unhelpful message.** Cause: it is prohibited at MUST level, and there is no dynamic-name mechanism in any backend to switch to. Fix: hard-code the name; a project generator writes it, the build never computes it.

**★ Symptom: your dynamic version reads a module that imports your dependencies, and the build fails on a missing import.** Cause: a version source that reaches into a module whose top-level imports need your runtime dependencies — which are *not* in the isolated build environment. Fix: put the version in a leaf module with no imports.

```python
# src/invoice_service/__about__.py — imports nothing
__version__ = "0.4.2"
```

```python
# src/invoice_service/__init__.py
from invoice_service.__about__ import __version__
```

**★ Symptom: `dynamic = ["dependencies"]` and your static `dependencies` array vanishes.** Cause: a backend that replaced rather than appended — which the spec forbids: it *"MUST NOT remove, reorder, or modify any statically-specified entries."* Fix: this is a backend bug, so raise the floor or report it, and verify what shipped rather than assuming.

```python
from importlib.metadata import metadata
print(metadata("invoice-service").get_all("Requires-Dist"))
```

**★ Symptom: a dynamic version yields `0.0.0` or `0.1.dev1+g<hash>` in CI and the right number locally.** Cause: a VCS version source in a shallow clone — no tags, so the backend falls back to a development version. Fix: fetch the full history.

```yaml
- uses: actions/checkout@v4
  with:
    fetch-depth: 0
```

**★ Symptom: PyPI rejects the upload because the version contains a local segment.** Cause: a VCS-derived version on an untagged or dirty tree produces something like `0.4.2+g8f3a21`, and a `+local` version is a valid PEP 440 version that PyPI will not accept. Fix: build releases from a clean tagged commit, not from whatever the branch is at.

**★ Symptom: a build from an sdist cannot determine the version, though building from the checkout works.** Cause: the sdist has no `.git` directory, so the VCS source has nothing to read. Well-behaved backends write the resolved version into the sdist for exactly this reason; one that does not leaves you with an unbuildable sdist. Fix: build the sdist, then build the wheel *from the sdist*, as part of the release pipeline — it is the only way to catch this before a user does.

**★ Symptom: `dynamic` is a string instead of an array and the file parses.** Cause: `dynamic = "version"` is valid TOML and the wrong type. A strict backend errors; a lenient one may ignore it, at which point you are back to half one with no message. Fix: it is always an array.

```toml
[project]
dynamic = ["version"]
```

**★ Symptom: `dynamic = ["readme"]` produces a project page with two top-level headings.** Cause: multi-file readme assembly is textual concatenation, so both files' `H1`s land in one document. Fix: demote headings in the appended file, or link to the changelog from `[project.urls]` instead of concatenating it.

**★ Symptom: a reviewer cannot tell what your package depends on by reading the repository.** Cause: `dynamic = ["dependencies"]`, so the answer lives in the backend's configuration and in whatever file it reads. That is a real cost, not a style objection — it reintroduces "run something to find out" for the one field resolvers care most about. Fix: prefer a static array, and if a generated list is unavoidable, commit the generated file so it is at least readable.

## Interview questions

**★ Why does a backend need to be *told* a field is dynamic? It can see the field is missing.**
It can see the field is missing but not *why*. A missing `version` could mean "compute this for me" or "I forgot", and those need opposite responses — one is a build instruction, the other should be an error. PEP 621's rationale says exactly this: requiring dynamic to be declared *"disambiguates the intent when metadata goes unspecified."* Without the declaration, every backend would need a heuristic, the heuristics would differ, and a typo'd key would silently become a computed field on one backend and an error on another.

**★ What does "a build back-end MUST honour statically-specified metadata" actually guarantee?**
That anything you wrote in `[project]` and did not list in `dynamic` appears unchanged in the built artifact. It is the rule that makes the file worth reading: without it, a static `version = "0.4.2"` would be advisory and a resolver could not trust `pyproject.toml` as a description of the project. It also draws the boundary for the append-only exception — for list and table keys that appear both statically and in `dynamic`, the backend *"MAY only append entries"* and *"MUST NOT remove, reorder, or modify any statically-specified entries"*, so even in the mixed case your own entries are untouched.

**★ Why is a scalar key that is both static and dynamic an error, while a list key is allowed?**
Because for a scalar there is no coherent merge. If `version` is both `"0.4.2"` and computed, one of them has to lose, and whichever rule the spec picked would surprise half its users — so it made the combination an error and removed the ambiguity. A list or extensible table has an obvious safe merge: keep what was written and append. The spec permits exactly that and constrains it to appending, which is why `dependencies` can sensibly be partly static and partly computed while `version` cannot.

**★ Should a version be static or dynamic?**
Static, unless something specific buys you the alternative. A static version is readable in a diff, is present in an sdist regardless of build environment, and has exactly one source of truth. Dynamic earns its place in two situations: your release process is git tags, so the number genuinely lives in the VCS; or your code must expose `__version__` and you refuse to maintain two copies. In the second case the cleaner arrangement is often the reverse — keep the version static in `pyproject.toml` and have the code read it back with `importlib.metadata.version()`, which needs no dynamic mechanism at all.

**★ Why does a dynamic version sometimes fail to build from an sdist?**
Because the sdist has no VCS history. A version source reading git tags works in a checkout and has nothing to read inside a tarball, so a build from the sdist either errors or produces a fallback version like `0.1.dev1`. Careful backends write the resolved version into the sdist's own metadata so a rebuild from it is fine, but the failure mode is common enough that the release pipeline should build the sdist and then build the wheel *from that sdist* — the same path a consumer takes when no wheel exists for their platform.

**★ How would you check that a dynamic field produced what you expected?**
By reading the built metadata rather than the source. `importlib.metadata.metadata("your-package")` on an installed build shows the fields as the backend wrote them, including `Requires-Dist` lines for a dynamic `dependencies` array and the resolved `Version`. Reading `pyproject.toml` tells you only what you asked for, and for a dynamic field that is precisely the information that is missing — the entire point of the field is that the answer is somewhere else. This is also the check that catches an append-only violation, which no local validation can see.

**★ What is the strongest argument against making `dependencies` dynamic?**
That it undoes the reason `pyproject.toml` exists. The file replaced `setup.py` so that a tool could learn a project's dependencies without executing anything; a dynamic `dependencies` array means the dependency list is once again produced by running code, just code that lives in a `[tool.*]` configuration rather than in a script. Resolvers cope, because they run the backend's metadata hook anyway — but a human reviewing the repository, an auditor, and any static analysis of your supply chain all lose. If the list must be generated, commit the generated file so that something in the repository still states the answer.

---

← Prev: [12 · The tool namespace](12-the-tool-namespace.md) · [Topic index](README.md) · Next → [14 · What still needs setup.py](14-what-still-needs-setup-py.md)
