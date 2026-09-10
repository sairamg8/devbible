---
title: "Ten spellings, one version — normalization is why two tools can disagree about whether `1.1.a1` and `1.1a1` are the same release, and why every version comparison belongs to `packaging`"
sidebar_label: "03 · Normalization"
sidebar_position: 3
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-10 against the PyPA **Version specifiers** specification
> ([packaging.python.org](https://packaging.python.org/en/latest/specifications/version-specifiers/)),
> **PEP 440** ([peps.python.org](https://peps.python.org/pep-0440/)) and the PyPA
> **Names and normalization** specification
> ([packaging.python.org](https://packaging.python.org/en/latest/specifications/name-normalization/)).
> Target: **Python 3.14.7**. Documentation-verified, **no sandbox run** — no comparison below
> was executed; each is quoted from the specification's own normalization examples.

**PEP 440 accepts a legacy zoo of spellings and defines a normal form for every one of them,
which means two version strings that look different are routinely the *same version*. A tool
that compares raw strings — a shell script diffing a git tag against `__version__`, a CI job
matching a wheel filename, a `if version == "1.1.a1"` — will disagree with pip, uv and every
build backend, all of which normalize first. The same trap exists one level up for *names*:
`Friendly-Bard`, `friendly_bard` and `friendly.bard` are one package. This page is the
lookup table plus the one API you should route every comparison through.**

## Why normalization exists at all

> *"In order to maintain better compatibility with existing versions there are a number of
> “alternative” syntaxes that MUST be taken into account when parsing versions. These syntaxes
> MUST be considered when parsing a version, however they should be “normalized” to the standard
> syntax defined above."*

The design goal was to let twenty years of published artifacts stay installable, and the price
is that "is this the same version?" is a question with a wrong intuitive answer.

The spec also warns you off the tolerated shapes:

> *"Some hard to read version identifiers are permitted by this scheme in order to better
> accommodate the wide range of versioning practices across existing public and private Python
> projects. Accordingly, some of the versioning practices which are technically permitted by the
> PEP are strongly discouraged for new projects."*

## The full normalization table

| Input | Normalizes to | Rule, quoted |
|---|---|---|
| `1.1RC1` | `1.1rc1` | *"All ascii letters should be interpreted case insensitively within a version and the normal form is lowercase."* |
| `1.0.00` | `1.0.0` | *"All integers are interpreted via the `int()` built in and normalize to the string form of the output. This means that an integer version of `00` would normalize to `0` while `09000` would normalize to `9000`."* |
| `1.1.a1`, `1.1-a1`, `1.1_a1` | `1.1a1` | *"Pre-releases should allow a `.`, `-`, or `_` separator between the release segment and the pre-release segment. The normal form for this is without a separator."* |
| `1.0a.1` | `1.0a1` | *"It should also allow a separator to be used between the pre-release signifier and the numeral."* |
| `1.1alpha1` | `1.1a1` | *"Pre-releases allow the additional spellings of `alpha`, `beta`, `c`, `pre`, and `preview` for `a`, `b`, `rc`, `rc`, and `rc` respectively."* |
| `1.1beta2` | `1.1b2` | same rule |
| `1.1c3`, `1.1pre3`, `1.1preview3` | `1.1rc3` | same rule |
| `1.2a` | `1.2a0` | *"Pre releases allow omitting the numeral in which case it is implicitly assumed to be `0`."* |
| `1.2-post2`, `1.2post2` | `1.2.post2` | *"Post releases allow a `.`, `-`, or `_` separator as well as omitting the separator all together. The normal form of this is with the `.` separator."* |
| `1.2.post-2` | `1.2.post2` | *"this also allows an optional separator between the post release signifier and the numeral."* |
| `1.0-r4`, `1.0rev4` | `1.0.post4` | *"Post-releases allow the additional spellings of `rev` and `r`."* |
| `1.2.post` | `1.2.post0` | *"Post releases allow omitting the numeral in which case it is implicitly assumed to be `0`."* |
| `1.0-1` | `1.0.post1` | *"Post releases allow omitting the post signifier all together. When using this form the separator MUST be `-` and no other form is allowed."* |
| `1.2-dev2`, `1.2dev2`, `1.2_dev2` | `1.2.dev2` | *"Development releases allow a `.`, `-`, or a `_` separator as well as omitting the separator all together."* |

And the one combination that is simply invalid:

> *"This particular normalization MUST NOT be used in conjunction with the implicit post release
> number rule. In other words, `1.0-` is not a valid version and it does not normalize to
> `1.0.post0`."*

`c` and `rc` are the *same phase*, not merely similar:

> *"Installation tools SHOULD interpret `c` versions as being equivalent to `rc` versions (that
> is, `c1` indicates the same version as `rc1`)."*

> *"Build tools, publication tools and index servers SHOULD disallow the creation of both `rc` and
> `c` releases for a common release segment."*

Two practical consequences fall out of the table. First, `1.0-1` means *post-release 1 of 1.0* —
not "1.0, revision 1" and not a Debian-style `-1` build suffix. Second, leading zeros vanish, so
a date-based scheme emitting `2026.04` and `2026.4` has published one version twice.

## Names normalize too, and more aggressively

> *"The name should be lowercased with all runs of the characters `.`, `-`, or `_` replaced with a
> single `-` character. This can be implemented in Python with the `re` module:"*

```python
import re

def normalize(name: str) -> str:
    return re.sub(r"[-_.]+", "-", name).lower()
```

The spec's own list of equivalent spellings:

> *"`friendly-bard` (normalized form) · `Friendly-Bard` · `FRIENDLY-BARD` · `friendly.bard` ·
> `friendly_bard` · `friendly--bard` · `FrIeNdLy-._.-bArD` (a terrible way to write a name, but it
> is valid)"*

The valid-name regex, run with `re.IGNORECASE`:

```text
^([A-Z0-9]|[A-Z0-9][A-Z0-9._-]*[A-Z0-9])\Z
```

with a change that matters if you have your own validator:

> *"August 2025: The suggested name validation regex was fixed to match the field specification (it
> previously finished with `$` instead of `\Z`, incorrectly permitting trailing newlines)"*

So `typing_extensions` and `typing-extensions` are one project; `Django` and `django` are one
project; the *import* name is unrelated to either and is a separate question entirely.

Extra names normalize by the same function, and since core metadata 2.3 the normalized form is the
only legal one — see [21](21-extras.md).

## The one API to route comparisons through

```python
from packaging.version import Version, InvalidVersion
from packaging.specifiers import SpecifierSet

# 1 — normalization happens on construction
assert Version("1.1.A1") == Version("1.1a1")
assert Version("1.0-1") == Version("1.0.post1")
assert Version("1.0.00") == Version("1.0.0")

# 2 — ordering is PEP 440, not lexicographic
tags = ["1.9", "1.10", "1.2.1", "1.10.0rc1"]
latest = max(tags, key=Version)          # not max(tags)

# 3 — classification, instead of substring tests
v = Version("1.1rc1.post1")
v.is_prerelease, v.is_postrelease, v.is_devrelease

# 4 — does a candidate satisfy a specifier? Let the library apply the padding rules
SpecifierSet("~=1.4.5").contains(Version("1.4.9"))

# 5 — invalid input fails loudly rather than sorting oddly
try:
    Version("1.0-")
except InvalidVersion as exc:
    print("rejected:", exc)
```

Three habits follow from that list, and each one replaces a bug seen in real release automation:

- **Never compare version strings with `==`, `<`, `sorted()` or `sort -V`.** Parse first.
- **Never test `"rc" in version`.** Use `Version(v).is_prerelease`, which also catches `a`, `b`,
  `alpha`, `preview` and `.dev`.
- **Never re-implement specifier matching.** `SpecifierSet` implements the zero padding, the prefix
  match and the pre-release exclusion rule; a hand-rolled `>=` will get all three wrong.

## Canonicalising a name before you look it up

```python
from packaging.utils import canonicalize_name, canonicalize_version

canonicalize_name("Typing_Extensions")   # the normalized project name
canonicalize_version("1.0.00")           # the normalized version string
```

`canonicalize_name` is the function to call before comparing a name you were given (a CLI argument,
a row in a spreadsheet of approved packages, a line scraped from a `requirements.txt`) against a
name you already hold. An allowlist keyed on un-normalized names has a hole in it the size of one
underscore.

## Gotchas

**★ Symptom: a release job publishes, then the "did the tag match the package version?" check
fails.** Cause: the tag is `v1.1.A1` or `1.1.a1` and the built metadata says `1.1a1`, because the
backend normalized and the shell `test` did not. Fix: normalize both sides in Python:

```python
import subprocess, sys
from packaging.version import Version
from importlib.metadata import version

tag = subprocess.check_output(["git", "describe", "--tags", "--abbrev=0"], text=True).strip().lstrip("v")
if Version(tag) != Version(version("myproject")):
    sys.exit(f"tag {tag} does not match packaged version {version('myproject')}")
```

**★ Symptom: `sorted(versions)[-1]` picks `1.9` over `1.10`.** Cause: string ordering. Fix:
`max(versions, key=Version)`. The same bug in a shell pipeline (`sort -V`) is closer to correct
but still not PEP 440 — it has no notion of `.dev` sorting below `a1`, no epoch handling and no
local-label rules.

**★ Symptom: two internal tools disagree about whether a version is a pre-release.** Cause: one
checks `"rc" in v` or `"-" in v`; the other parses. `1.1preview3`, `1.1c3` and `1.1.dev4` are all
pre-releases with no `rc` in them, and `1.0-1` contains a hyphen while being a *post*-release. Fix:
one shared helper, used by both:

```python
from packaging.version import Version

def is_stable(raw: str) -> bool:
    v = Version(raw)
    return not (v.is_prerelease or v.is_devrelease)
```

**★ Symptom: an allowlist of approved packages lets an unapproved one through.** Cause: the list
holds `Pillow`, the request says `pillow`, or the list holds `zope.interface` and the request says
`zope-interface`. Fix: canonicalize on both sides of the membership test:

```python
from packaging.utils import canonicalize_name

APPROVED = {canonicalize_name(n) for n in ("Pillow", "zope.interface", "typing_extensions")}

def approved(requested: str) -> bool:
    return canonicalize_name(requested) in APPROVED
```

**★ Symptom: a date-based release scheme published "the same version twice".** Cause: leading zeros
normalize away, so `2026.04` and `2026.4` are one version, and the index rejected the second upload
as a duplicate — or worse, accepted a file under a name that already existed. Fix: format the date
components without zero padding, since that is what the normal form is anyway:
`f"{year}.{month}"` with `month` an `int`.

**★ Symptom: a wheel filename does not match the version you set.** Cause: wheel filenames carry the
*normalized* version (and a normalized, escaped project name), so setting `1.1.A1` produces a file
saying `1.1rc1`... no — saying `1.1a1`. Either way, not what you typed. Fix: never parse a version
out of a filename to compare against a source string; read it from metadata with
`importlib.metadata.version()`.

**★ Symptom: `Version("1.0-")` crashes a script that was "just validating input".** Cause: it is
genuinely invalid — the implicit-post-release form requires a numeral — and `packaging` raises
`InvalidVersion` rather than guessing. Fix: catch it and report the offending input; do not fall back
to a string comparison, which is how an invalid version ends up in a lockfile.

**★ Symptom: an index page lists a version your specifier "should" match and the resolver ignores
it.** Cause, one of two: the candidate is a pre-release and pre-releases are excluded by default
([08](08-pre-releases-are-excluded.md)), or the published version does not conform and is being
skipped — *"Installation tools SHOULD ignore any public versions which do not comply with this
scheme but MUST also include the normalizations specified below."* A non-conforming version is
invisible, not an error.

## Interview questions

**★ Two tools disagree about whether `1.1.a1` and `1.1a1` are the same version. Who is right?**
The one that normalizes. The separator between the release segment and the pre-release segment is
optional and *"The normal form for this is without a separator"*, so both parse to `1.1a1` and they
are the same release. Anything doing version logic should go through `packaging.version.Version`,
which normalizes on construction. A raw string comparison — in a shell script, a CI matcher, a
config file lookup — is the tool that is wrong.

**★ What does `1.0-1` mean?**
Post-release 1 of version 1.0, i.e. it normalizes to `1.0.post1`. It does *not* mean "build 1 of
1.0" and it is not a Debian-style revision, even though it looks exactly like one. The spec allows
omitting the `post` signifier only with a `-` separator, which is precisely why that shape exists —
and it is why `1.0-` is invalid rather than meaning `1.0.post0`.

**★ Why is `canonicalize_name` necessary if PyPI is already case-insensitive?**
Because case is only one of the three things that normalize. Runs of `.`, `-` and `_` all collapse to
a single `-`, so `zope.interface`, `zope-interface` and `zope_interface` are one project, and
`friendly--bard` is the same as `friendly-bard`. Any code that compares a user-supplied name against a
stored one — an allowlist, a vulnerability database lookup, a cache key — has a hole in it unless both
sides go through the same normalization. Case-insensitive comparison alone closes about a third of it.

**★ You need "the newest stable version" from a list of published versions. Write the expression and
say what each part defends against.**
```python
from packaging.version import Version
newest_stable = max(
    (v for v in candidates if not Version(v).is_prerelease),
    key=Version,
)
```
`key=Version` defends against lexicographic ordering (`1.10` vs `1.9`). `is_prerelease` defends
against `a`, `b`, `rc`, `c`, `alpha`, `pre`, `preview` and `.dev` spellings that a substring test
would miss. Wrapping in `max` rather than `sorted(...)[-1]` is only style. What it deliberately does
*not* filter is post-releases — those are stable and *"receive no special treatment in version
specifiers"*.

**★ A published version on an index does not conform to PEP 440. What happens?**
It is ignored, quietly. *"Installation tools SHOULD ignore any public versions which do not comply
with this scheme"*, with a MAY on warning the user. So the failure mode is "the version you can see
in a browser is not a candidate", which reads like a caching problem and is not one. The reason the
spec chose silence over an error is that one malformed artifact would otherwise make an entire
project uninstallable.

---

← [02 · Local versions](02-local-versions-and-the-plus-label.md) · [Topic index](README.md) · Next → [04 · Equality and exclusion](04-equality-and-exclusion.md)
