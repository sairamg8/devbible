---
title: "The `+label` suffix is the one part of a version that specifiers must ignore — which is exactly why a patched rebuild satisfies your exact pin and PyPI refuses to host it"
sidebar_label: "02 · Local versions"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-10 against the PyPA **Version specifiers** specification
> ([packaging.python.org](https://packaging.python.org/en/latest/specifications/version-specifiers/))
> and **PEP 440** ([peps.python.org](https://peps.python.org/pep-0440/)); `pip freeze`
> behaviour from the pip CLI reference
> ([pip.pypa.io](https://pip.pypa.io/en/stable/cli/pip_freeze/)). Target: **Python 3.14.7**.
> Documentation-verified, **no sandbox run**.

**A local version identifier is a public version with `+something` glued on, and it has one
property that makes it both extremely useful and a genuine source of two-hour production
mysteries: version specifiers must ignore it entirely. `requests==2.32.3` is satisfied by
`2.32.3+acme1`, which contains code upstream never shipped. That is the designed behaviour —
it is how a distro or an internal build farm slots a backported fix into an environment nobody
re-pinned — and it is why the version you read in a lockfile is not always the code you are
running.**

## The format

> *"Local version identifiers MUST comply with the following scheme:
> `<public version identifier>[+<local version label>]`"*

> *"They consist of a normal public version identifier (as defined in the previous section),
> along with an arbitrary “local version label”, separated from the public version identifier by
> a plus."*

The label's charset is deliberately narrow, so a version is always safe in a filename or a URL:

> *"To ensure local version identifiers can be readily incorporated as part of filenames and
> URLs, and to avoid formatting inconsistencies in hexadecimal hash representations, local
> version labels MUST be limited to the following set of permitted characters: ASCII letters
> (`[a-zA-Z]`) · ASCII digits (`[0-9]`) · periods (`.`)"*

> *"Local version labels MUST start and end with an ASCII letter or digit."*

Valid: `1.2.3+acme1`, `1.2.3+ubuntu.1`, `1.2.3+cuda126`, `1.2.3+g1a2b3c4`.
Invalid: `1.2.3+acme_1` (underscore), `1.2.3+-acme` (leading hyphen), `1.2.3+acme-1` (hyphen at
all), `1.2.3+` (empty label).

## What it is for

> *"Local version identifiers are used to denote fully API (and, if applicable, ABI) compatible
> patched versions of upstream projects. For example, these may be created by application
> developers and system integrators by applying specific backported bug fixes when upgrading to
> a new upstream release would be too disruptive to the application or other integrated system
> (such as a Linux distribution)."*

> *"The inclusion of the local version label makes it possible to differentiate upstream releases
> from potentially altered rebuilds by downstream integrators. The use of a local version
> identifier does not affect the kind of a release but, when applied to a source distribution,
> does indicate that it may not contain the exact same code as the corresponding upstream
> release."*

The spec even names the two roles:

> *"An “upstream project” is a project that defines its own public versions. A “downstream
> project” is one which tracks and redistributes an upstream project, potentially backporting
> security and bug fixes from later versions of the upstream project."*

## 🔴 The rule that causes the surprise

> *"Except where specifically noted below, local version identifiers MUST NOT be permitted in
> version specifiers, and local version labels MUST be ignored entirely when checking if
> candidate versions match a given version specifier."*

Two halves, both load-bearing:

1. **You cannot normally write a local version in a specifier.** `requests==2.32.3+acme1` is not
   a valid dependency declaration for a published distribution. The `<`, `<=`, `>`, `>=` and `~=`
   clauses say so individually — *"Local version identifiers are NOT permitted in this version
   specifier"* — and `~=` repeats it: *"Local version identifiers are NOT permitted in this
   version specifier."*
2. **A candidate's label is discarded before matching.** So `==2.32.3` matches `2.32.3+acme1`,
   `>=2.32.0` matches it, `~=2.32.0` matches it. Every specifier that accepts `2.32.3` accepts
   every local rebuild of `2.32.3`.

There is one narrow exception, for the case where the *specifier* itself carries a label:

> *"If the specified version identifier is a public version identifier (no local version label),
> then the local version label of any candidate versions MUST be ignored when matching versions."*

> *"If the specified version identifier is a local version identifier, then the local version
> labels of candidate versions MUST be considered when matching versions, with the public version
> identifier being matched as described above, and the local version label being checked for
> equivalence using a strict string equality comparison."*

That is what a `requirements.txt` for an internal index can use; it is not something you publish.

## The other lever: `===`

Arbitrary equality is a raw string comparison and therefore *does* see the label:

> *"This operator may also be used to explicitly require an unpatched version of a project such
> as `===1.0` which would not match for a version `1.0+downstream1`."*

```toml
# pyproject.toml — refuse downstream rebuilds of this exact artifact.
# `===` is a plain string comparison: no zero padding, no prefix match, no label stripping.
[project]
dependencies = ["requests===2.32.3"]
```

The spec is blunt about the cost: *"Use of this operator is heavily discouraged and tooling MAY
display a warning when it is used."* Reach for it only when "must be the upstream artifact" is a
real requirement — a reproducibility or compliance audit, not a preference. The better tool for
"exactly these artifacts" is hashes, in [19](19-hashes-and-hash-checking-mode.md).

## Where local versions are refused outright

> *"Local version identifiers SHOULD NOT be used when publishing upstream projects to a public
> index server, but MAY be used to identify private builds created directly from the project
> source."*

🔴 And, absolutely:

> *"As the Python Package Index is intended solely for indexing and hosting upstream projects, it
> MUST NOT allow the use of local version identifiers."*

So a CI job that stamps `1.2.3+${GIT_SHA}` works locally, works against a private index, and then
fails at `twine upload` / `uv publish`. The publishable equivalent of "a build from this commit"
is a **development release**, which is a public identifier:

```bash
# publishable pre-release build number, monotonic per commit
VERSION="1.2.3.dev$(git rev-list --count HEAD)"

# NOT publishable to PyPI — fine for an internal index or a wheelhouse:
# VERSION="1.2.3+$(git rev-parse --short HEAD)"
```

## How labels order against each other

Rarely needed, occasionally decisive when two internal rebuilds both satisfy a pin:

> *"Comparison and ordering of local versions considers each segment of the local version
> (divided by a `.`) separately. If a segment consists entirely of ASCII digits then that section
> should be considered an integer for comparison purposes and if a segment contains any ASCII
> letters then that segment is compared lexicographically with case insensitivity. When comparing
> a numeric and lexicographic segment, the numeric section always compares as greater than the
> lexicographic segment. Additionally a local version with a great number of segments will always
> compare as greater than a local version with fewer segments, as long as the shorter local
> version's segments match the beginning of the longer local version's segments exactly."*

Consequences worth knowing: `1.0+2` sorts above `1.0+acme` (numeric beats alphabetic), and
`1.0+acme.1` sorts above `1.0+acme` (more segments, prefix matches). Also, any local version
sorts above the bare public version: `1.0 < 1.0+anything`.

## Reading them in code

```python
from packaging.version import Version

v = Version("2.32.3+acme.1")
print(v.public)          # the part specifiers actually match against
print(v.local)           # the label, or None for an upstream release
print(v.base_version)    # release segment only — no pre/post/dev, no label

def is_downstream_rebuild(installed: str) -> bool:
    """True when the artifact carries a local label, i.e. it is not the upstream build."""
    return Version(installed).local is not None
```

`Version.public` is precisely "what a specifier sees", which makes it the right thing to log next
to a build identifier in a health endpoint. A deployment that reports only `Version.public` cannot
tell you which rebuild is running — and that is the whole failure mode this page is about.

## Gotchas

**★ Symptom: `requests==2.32.3` is pinned, and the running code contains a patch upstream never
released.** Cause: the installed artifact is `2.32.3+something`, and *"local version labels MUST
be ignored entirely when checking if candidate versions match a given version specifier."* The
pin is satisfied — nothing is broken, the environment simply is not upstream. Fix: surface the
full identifier, do not infer it from the specifier:

```bash
pip freeze | grep -i '^requests'      # prints the +label if there is one
pip show requests | head -3           # Name / Version, Version includes the label
```

and if the upstream artifact is a requirement, express it with `===` or with a hash-checked
lockfile ([19](19-hashes-and-hash-checking-mode.md)) rather than a version comparison.

**★ Symptom: `twine upload` fails on the last step of a release pipeline that has worked all
week.** Cause: the version was stamped with `+${GIT_SHA}`, and PyPI *"MUST NOT allow the use of
local version identifiers."* Fix: switch the CI stamp to a dev release, keeping `+label` for the
internal index only:

```bash
- VERSION="1.2.3+$(git rev-parse --short HEAD)"
+ VERSION="1.2.3.dev$(git rev-list --count HEAD)"
```

**★ Symptom: `pip install "torch==2.4.0+cu124"` fails as an invalid requirement in one tool and
works in another.** Cause: a local label in a *specifier* is only usable where the tool
implements the "specifier carries a label" branch of the rule; a published distribution's
metadata must not contain one. Fix: select the build by **index**, not by label — that is what
extra indexes are for:

```bash
pip install torch --index-url https://download.pytorch.org/whl/cu124
```

```toml
# uv equivalent: pin the source, not the local label
[tool.uv.sources]
torch = { index = "torch-cu124" }

[[tool.uv.index]]
name = "torch-cu124"
url = "https://download.pytorch.org/whl/cu124"
```

**★ Symptom: an internal rebuild "downgraded itself" on the next `pip install --upgrade`.**
Cause: `1.0+acme1` and upstream `1.0` compare as *different* versions, and any local version
sorts *above* the bare public one — so upstream `1.0` never replaces `1.0+acme1`, but upstream
`1.0.1` does, silently dropping your patch. Fix: rebuild the patch on top of each upstream
release you adopt, and gate it in CI by asserting the label is present:

```python
from importlib.metadata import version
from packaging.version import Version

assert Version(version("acme-requests")).local, "patched build missing — plain upstream installed"
```

**★ Symptom: two internal rebuilds of the same release both satisfy the pin and the resolver picks
the "wrong" one.** Cause: label ordering, where *"the numeric section always compares as greater
than the lexicographic segment"* — so `1.0+2` beats `1.0+rc.hotfix`, which is rarely what a human
meant. Fix: use a single monotonic numeric label scheme per project (`+1`, `+2`, `+3`) and never
mix words and numbers in the first segment.

**★ Symptom: a `+label` build is installed and a hash-checked install then fails.** Cause: the
artifact is not the one the index published, so its hash is not the hash in your requirements
file. This is hash-checking mode working correctly — *"Requirements must be pinned (either to a
URL, filesystem path or using `==`)"* and the hash must match the local file. Fix: hash the
rebuild you actually deploy, generating hashes from your own index rather than from PyPI.

**★ Symptom: `sdist` built from a patched tree, and consumers cannot tell it is patched.** Cause:
you rebuilt without adding a label. The spec's point is precisely that a local identifier
*"does indicate that it may not contain the exact same code as the corresponding upstream
release."* Fix: add the label in the build, not by hand — most backends read it from
`[project] version` or a VCS plugin, so set it there once.

## Interview questions

**★ A pin says `requests==2.32.3`, the lockfile agrees, and a security scanner flags code that
upstream 2.32.3 does not contain. Explain.**
The installed artifact is a local version, `2.32.3+something`, produced by a downstream integrator
— a distro rebuild, an internal wheelhouse, a vendored patch. Specifiers must ignore local labels
when matching, so the pin is genuinely satisfied. The lockfile may or may not show the label
depending on how the environment was produced. Confirm with `pip freeze`, which prints the full
local identifier, and decide whether the rebuild is intended. If the upstream artifact is a hard
requirement, enforce it with hashes; `===2.32.3` also works but is *"heavily discouraged"*.

**★ Why can't you just publish `1.2.3+build57` to PyPI and be done with it?**
Because PyPI *"MUST NOT allow the use of local version identifiers"* — the index exists to host
upstream projects, and a local label by definition means "not the upstream artifact". Allowing them
would make "version 1.2.3 of this project" ambiguous across the whole ecosystem, and every consumer
pin would silently span an unbounded set of third-party rebuilds. Publish `1.2.3.dev57` if you need
a public per-build identifier, or keep the local label on a private index.

**★ Is `1.0+acme1` newer or older than `1.0`? And than `1.0.1`?**
Newer than `1.0` — any local version sorts above the bare public version, since the label adds
segments to compare. Older than `1.0.1`, because the *public* part dominates: the local label only
breaks ties among candidates whose public versions are equal. That combination is exactly why a
downstream patch survives an "upgrade to latest 1.0.x" but is silently replaced by upstream
`1.0.1`.

**★ You maintain an internal fork with backported fixes. Local version label, or a fork with a
different project name?**
Local label when the fork is *"fully API (and, if applicable, ABI) compatible"* and short-lived —
you want existing pins and existing locks to keep working, and you want the label to advertise
"this is not upstream". A renamed fork when the divergence is permanent or the API changes, because
then you *want* consumers' resolvers to treat it as a different package and to fail loudly rather
than transparently accept it. The deciding question is whether a consumer who did not know about
the fork would be right to be surprised.

**★ Why is `Version.public` the field you log in a `/healthz` response, and what does that miss?**
Because it is exactly the string specifiers compare against, so it answers "does this deployment
satisfy the pin". What it misses is which *artifact* is running: it strips the local label, which is
the only thing distinguishing a patched rebuild from upstream. Log `str(Version(...))` — the full
identifier — or log both. A health endpoint that prints the public version of a patched build is
technically accurate and operationally useless.

---

← [01 · The version itself](01-pep-440-the-version-itself.md) · [Topic index](README.md) · Next → [03 · Normalization and comparing versions](03-normalization-and-comparing-versions.md)
