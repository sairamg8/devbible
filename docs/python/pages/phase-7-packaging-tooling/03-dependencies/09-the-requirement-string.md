---
title: "One dependency is one string with five slots — name, extras, version specifier, direct URL, marker — and the whole ecosystem is built on parsing it, which is why every entry in `[project.dependencies]` must be one"
sidebar_label: "09 · The requirement string"
sidebar_position: 9
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-10 against the PyPA **Dependency specifiers** specification
> ([packaging.python.org](https://packaging.python.org/en/latest/specifications/dependency-specifiers/)),
> **PEP 508** ([peps.python.org](https://peps.python.org/pep-0508/)), **PEP 631**
> ([peps.python.org](https://peps.python.org/pep-0631/)), the PyPA **pyproject.toml**
> specification
> ([packaging.python.org](https://packaging.python.org/en/latest/specifications/pyproject-toml/))
> and the **core metadata** specification
> ([packaging.python.org](https://packaging.python.org/en/latest/specifications/core-metadata/)).
> Target: **Python 3.14.7**. Documentation-verified, **no sandbox run**.

**A dependency specifier is a single line of text with five slots, four of them optional. It is the
atom the entire packaging ecosystem is built from: every entry in `[project.dependencies]`, every
line of a `requirements.txt`, every `Requires-Dist` field in a wheel's `METADATA`, and every string
in a PEP 735 dependency group is one of these. Learn the five slots and their order and you can read
any of those files — and, more usefully, you can tell which of them a given tool will accept, because
the answer is "only what fits in this grammar" far more often than people expect.**

## The canonical example

PEP 508 opens with every feature at once:

> *"`requests [security,tests] >= 2.8.1, == 2.8.* ; python_version < "2.7"`"*

Five slots, in fixed order:

| Slot | In the example | Required? |
|---|---|---|
| Name | `requests` | **yes** — it is the only mandatory part |
| Extras | `[security,tests]` | no |
| Version specifier | `>= 2.8.1, == 2.8.*` | no |
| Direct URL | — (mutually exclusive with the version specifier) | no |
| Environment marker | `; python_version < "2.7"` | no |

> *"A dependency specification always specifies a distribution name. It may include extras, which
> expand the dependencies of the named distribution to enable optional features. The version installed
> can be controlled using version limits, or giving the URL to a specific artifact to install. Finally
> the dependency can be made conditional using environment markers."*

The grammar, from the canonical spec:

```text
name_req      = name wsp* extras? wsp* versionspec? wsp* quoted_marker?
url_req       = name wsp* extras? wsp* urlspec (wsp+ quoted_marker?)?
specification = wsp* ( url_req | name_req ) wsp*
```

Two structural facts fall straight out of that. First, a specifier is **either** a name requirement
**or** a URL requirement — you cannot write a version range and a URL in the same string. Second, the
marker is always last, introduced by `;`.

## The name

> *"Python distribution names are currently defined in PEP 345. Names act as the primary identifier for
> distributions. They are present in all dependency specifications, and are sufficient to be a
> specification on their own."*

The regex, run with `re.IGNORECASE`:

```text
^([A-Z0-9]|[A-Z0-9][A-Z0-9._-]*[A-Z0-9])$
```

A bare name is a complete, valid specifier — `httpx` means "any version of httpx, from wherever this
tool is configured to look". And because names normalize
([03](03-normalization-and-comparing-versions.md)), `zope.interface`, `zope-interface` and
`zope_interface` in three different files are one dependency.

## Whitespace, and the one place it matters

> *"Non line-breaking whitespace is mostly optional with no semantic meaning. The sole exception is
> detecting the end of a URL requirement."*

So `httpx>=0.27`, `httpx >= 0.27` and `httpx  >=  0.27` are identical. But in a URL requirement the
whitespace before `;` is *load-bearing*, because a URL may legally contain almost anything else —
which is why the grammar writes `urlspec (wsp+ quoted_marker?)?` with a required `wsp+`.

## Where the string ends up

`[project.dependencies]` maps one-to-one onto core metadata:

> *"`dependencies` lists the expected dependencies of the project as an array of strings. Each string
> represents a dependency of the project and MUST be formatted as a valid dependency specifier. Each
> string maps directly to a `Requires-Dist` entry."*

> *"Dependencies listed in this array are always considered for installation, but may still contain
> environment markers that cause them to be skipped in some environments."*

PEP 631 — the PEP that defined this table and was then folded into PEP 621 — adds the validation rule
that makes malformed entries fail early:

> *"All dependency entries MUST be valid PEP 508 strings."*
> *"Build backends SHOULD abort at load time for any parsing errors."*

`Requires-Dist` on the metadata side is the same grammar again:

> *"The format of a requirement string contains from one to four parts: A project name, in the same
> format as the `Name:` field. The only mandatory part. · A comma-separated list of ‘extra' names. …
> · A version specifier. … · An environment marker after a semicolon."*

## Writing them, and parsing one to check

```toml
# pyproject.toml — one specifier per array entry, every slot in order
[project]
name = "acme-reports"
requires-python = ">=3.12"
dependencies = [
  "httpx>=0.27",                                        # name + specifier
  "transformers[torch]>=4.39.3,<5",                     # name + extras + specifier
  "importlib_metadata>=7.1.0; python_version < '3.10'",  # name + specifier + marker
  "tzdata; sys_platform == 'win32'",                    # name + marker only
]
```

```python
from packaging.requirements import Requirement, InvalidRequirement

r = Requirement("requests[security,tests]>=2.8.1,==2.8.*; python_version < '3.13'")
print(r.name)       # requests
print(r.extras)     # the requested extras, as a set
print(r.specifier)  # the SpecifierSet
print(r.marker)     # the parsed marker, or None
print(r.url)        # None here; the URL slot for an @-reference

try:
    Requirement("httpx ^1.0")        # a caret is not in the grammar
except InvalidRequirement as exc:
    print("rejected:", exc)
```

`Requirement` is the same parser build backends use, which makes it the right validator for anything
that *generates* dependency strings — a migration script, a template, a monorepo tool assembling
requirements from several sources.

## Gotchas

**★ Symptom: a build backend rejects `pyproject.toml` with an unhelpful parse error.** Cause: one entry
is not a valid specifier, and *"Build backends SHOULD abort at load time for any parsing errors."*
Common offenders: a caret, a `python` key copied from Poetry, a stray comment inside the string, or a
`-e` prefix pasted from a requirements file. Fix: validate every entry before committing:

```python
import tomllib
from packaging.requirements import Requirement

with open("pyproject.toml", "rb") as fh:
    data = tomllib.load(fh)
for entry in data["project"]["dependencies"]:
    Requirement(entry)          # raises InvalidRequirement, naming the bad string
```

**★ Symptom: `pip install -r requirements.txt` accepts a line that `[project.dependencies]` rejects.**
Cause: a requirements file is a superset — it also accepts pip *options* and paths, and pip's own
documentation warns that *"the full syntax, as described here, is only intended for consumption by pip,
and other tools should take that into account before using it for their own purposes."* Fix: when
migrating, keep only the specifier part of each line; `-e .`, `-r other.txt`, `--index-url` and bare
paths have no equivalent in the standard table.

**★ Symptom: `httpx>=0.27[http2]` is rejected as an invalid requirement.** Cause: slot order. The
grammar is `name wsp* extras? wsp* versionspec?` — extras come **before** the version specifier, always.
Fix: reorder, and remember the same order applies inside a `requirements.txt` line and a dependency
group entry:

```text
- httpx>=0.27[http2]
+ httpx[http2]>=0.27
```

**★ Symptom: a marker in `pyproject.toml` breaks TOML parsing.** Cause: the marker's string constant
needs quotes, and they must not be the same quotes as the TOML string. The specifier grammar allows
either — *"User supplied constants are always given as strings within either `'` or `"` quote marks"* —
so use single quotes inside a double-quoted TOML string:

```toml
- "importlib_metadata>=7.1.0; python_version < "3.10""
+ "importlib_metadata>=7.1.0; python_version < '3.10'"
```

**★ Symptom: a dependency entry works in `requirements.txt` and vanishes from the built wheel.** Cause:
it was declared only in the requirements file. Nothing reads `requirements.txt` at build time — the
build backend reads `[project.dependencies]` and writes `Requires-Dist`. Fix: declare runtime
dependencies in `pyproject.toml`; use requirements files only for *installing* an environment, and let
`uv export` generate them from the lock ([18](18-uv-lock-vs-pip-freeze-vs-pip-compile.md)).

**★ Symptom: two entries for the same package in one `dependencies` array, and only one takes effect.**
Cause: the array is a list of `Requires-Dist` entries, not a mapping, so duplicates are legal and both
are emitted — the *resolver* then intersects them. The result is usually an unsatisfiable intersection
rather than "the last one wins". Fix: express the intent as one string per package, using markers when
the requirement genuinely differs per environment:

```toml
- dependencies = ["django>2.0", "django>2.1"]
+ dependencies = ["django>2.1; os_name != 'nt'", "django>2.0; os_name == 'nt'"]
```

**★ Symptom: a specifier with a `python_version` marker is dropped in `requirements.txt` and kept in
`pyproject.toml`.** Cause: a compiled requirements file is the *output* of resolving markers for one
environment, so conditional dependencies that did not apply are gone by construction — that is
platform-specific resolution ([18](18-uv-lock-vs-pip-freeze-vs-pip-compile.md)). Fix: do not treat a
compiled requirements file as a declaration; regenerate it per target, or use a universal lockfile.

## Interview questions

**★ What are the five parts of a dependency specifier, in order, and which are mutually exclusive?**
Name, extras, version specifier, direct URL, environment marker. Only the name is required. The version
specifier and the direct URL are mutually exclusive: the grammar offers `name_req` (name, extras,
versionspec, marker) *or* `url_req` (name, extras, urlspec, marker), never both — a URL identifies one
artifact, so a range would have nothing to range over. The marker is always last and always introduced
by `;`.

**★ Why is the environment marker last in the grammar, and what does that cost you in TOML?**
Because it is the only slot whose content is an arbitrary expression containing quoted constants and
operators, including `<` and `>` — putting it anywhere but the end would make the rest of the string
ambiguous to parse. The cost in TOML is nested quoting: the marker's constants must be quoted, so a
double-quoted TOML string has to use single quotes inside, as in
`"importlib_metadata>=7.1.0; python_version < '3.10'"`. Getting that wrong is a TOML error, not a
packaging error, which is why the message names a line and not a dependency.

**★ A `requirements.txt` line and a `[project.dependencies]` entry look identical. Are they the same
thing?**
Only when the line happens to contain nothing but a specifier. A requirements file is pip-specific and
strictly larger: it also accepts global options (`--index-url`, `--require-hashes`, `--pre`),
per-requirement options (`--hash`), file references (`-r`, `-c`), editable installs (`-e`), local paths
and bare URLs. pip's documentation says so — *"the full syntax, as described here, is only intended for
consumption by pip"*. `[project.dependencies]` accepts *only* valid dependency specifiers, which is what
makes it readable by every tool rather than one.

**★ You are writing a script that assembles dependency strings from a database of approved packages.
What do you validate, and with what?**
Parse every generated string with `packaging.requirements.Requirement` and let `InvalidRequirement`
fail the build — that is the same parser build backends use, so anything it accepts will load. Then
canonicalize the name with `packaging.utils.canonicalize_name` before comparing against the approved
list, because `.`, `-` and `_` all normalize to `-`
([03](03-normalization-and-comparing-versions.md)). Validating with a regex instead is how a caret or a
stray `-e` reaches `pyproject.toml` and turns into a build failure for every consumer.

---

← [08 · Pre-releases](08-pre-releases-are-excluded.md) · [Topic index](README.md) · Next → [10 · Direct references and sources](10-direct-references-and-sources.md)
